#!/usr/bin/env bash
# Full hero chain for one weighting mode (BUILD-SPEC §2.3, §3, §4, §6.1):
#   Blender bind/export (no animations) -> clip transplant -> cape drape corrective (cape-drape.mjs) -> compression (§4.3)
#   -> gates (§6.1)
#   -> one-step k_leg correction from the ground-contact gate if it fails (§6.1.4).
#
# usage: tools/hero/build-hero.sh <copy|heat|distance> <out-dir> [work-dir]
#   writes <out-dir>/fallen_paladin.glb, gate-report.json, build-report.json, transplant-report.json, drape-report.json,
#   sockets-report.json
# env:   BLENDER (default /Applications/Blender.app/Contents/MacOS/Blender)
#        GLTF_TRANSFORM_CLI (default: npx --yes @gltf-transform/cli@4.5.1, or the cached copy if found)
#        K_LEG (override the k_leg computed by the Blender build)
#        HERO_BUILD_ARGS (extra flags for the Blender script, e.g. "--smooth 0")
#        HERO_PY (python with numpy for sword-sockets.py; default: Blender's bundled python)
set -euo pipefail
MODE=${1:?mode copy|heat|distance}; OUT=${2:?out dir}; WORK=${3:-$OUT/work}
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../.." && pwd)
HUMAN="$ROOT/site/world3d/assets/production/characters/human.glb"
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
if [[ -z "${GLTF_TRANSFORM_CLI:-}" ]]; then
  CACHED=$(ls -d "$HOME"/.npm/_npx/*/node_modules/@gltf-transform/cli/bin/cli.js 2>/dev/null | while read -r f; do grep -q '"version": "4.5.1"' "$(dirname "$f")/../package.json" && echo "$f"; done | head -1 || true)
  if [[ -n "$CACHED" ]]; then GT=(node "$CACHED"); else GT=(npx --yes @gltf-transform/cli@4.5.1); fi
else read -r -a GT <<< "$GLTF_TRANSFORM_CLI"; fi
mkdir -p "$OUT" "$WORK"
json() { node -e "const j=require(process.argv[1]);console.log(eval('j'+process.argv[2]))" "$1" "$2"; }

echo "== [$MODE] Blender bind/export"
"$BLENDER" --background --python-exit-code 1 --python "$ROOT/tools/blender/build_fallen_paladin_hero.py" -- \
  --out "$WORK/bind.glb" --weights "$MODE" --canary --canary-out "$WORK/canary-bind.glb" \
  --report "$WORK/build-report.json" --labels "$WORK/labels.json" ${HERO_BUILD_ARGS:-} > "$WORK/blender.log" 2>&1 || { tail -40 "$WORK/blender.log"; exit 1; }
grep '\[hero\]' "$WORK/blender.log" || true
cp "$WORK/build-report.json" "$OUT/build-report.json"
KLEG=${K_LEG:-$(json "$WORK/build-report.json" ".k_leg")}

chain() {   # $1 = k_leg ; writes $WORK/final.glb and $WORK/gate-report.json
  local k=$1
  echo "== [$MODE] transplant clips (k_leg=$k)"
  node "$HERE/transplant-clips.mjs" --hero "$WORK/bind.glb" --human "$HUMAN" --out "$WORK/anim.glb" --k-leg "$k" --report "$WORK/transplant-report.json"
  node "$HERE/transplant-clips.mjs" --hero "$WORK/canary-bind.glb" --human "$HUMAN" --out "$WORK/canary.glb" --k-leg "$k" --report "$WORK/transplant-canary-report.json" > /dev/null
  echo "== [$MODE] cape drape corrective (Death end pose)"
  node "$HERE/cape-drape.mjs" --in "$WORK/anim.glb" --labels "$WORK/labels.json" --out "$WORK/drape.glb" --report "$WORK/drape-report.json"
  local MR
  MR=$(node -e "const fs=require('fs');const b=fs.readFileSync(process.argv[1]);const j=JSON.parse(b.slice(20,20+b.readUInt32LE(12)));const m=j.materials[0];console.log(j.images[j.textures[m.pbrMetallicRoughness.metallicRoughnessTexture.index].source].name)" "$WORK/anim.glb")
  echo "== [$MODE] compress (MR image: $MR)"
  "${GT[@]}" dedup    "$WORK/drape.glb" "$WORK/a.glb" > "$WORK/gt.log" 2>&1
  "${GT[@]}" prune    "$WORK/a.glb" "$WORK/b.glb" --keep-leaves true --keep-attributes false >> "$WORK/gt.log" 2>&1
  "${GT[@]}" resize   "$WORK/b.glb" "$WORK/c.glb" --width 1024 --height 1024 --pattern "$MR" >> "$WORK/gt.log" 2>&1
  "${GT[@]}" webp     "$WORK/c.glb" "$WORK/d.glb" --quality 85 --slots "baseColorTexture" >> "$WORK/gt.log" 2>&1
  "${GT[@]}" webp     "$WORK/d.glb" "$WORK/e.glb" --quality 85 --slots "metallicRoughnessTexture" >> "$WORK/gt.log" 2>&1
  "${GT[@]}" webp     "$WORK/e.glb" "$WORK/f.glb" --quality 92 --slots "normalTexture" >> "$WORK/gt.log" 2>&1
  "${GT[@]}" quantize "$WORK/f.glb" "$WORK/final.glb" >> "$WORK/gt.log" 2>&1
  "${GT[@]}" validate "$WORK/final.glb" > "$WORK/validate.txt" 2>&1 || true
  echo "== [$MODE] gates"
  node "$HERE/verify-hero.cjs" --hero "$WORK/final.glb" --human "$HUMAN" --pre "$WORK/drape.glb" --canary "$WORK/canary.glb" \
       --labels "$WORK/labels.json" --k-leg "$k" --out "$WORK/gate-report.json" || true
}

chain "$KLEG"
GROUND_OK=$(json "$WORK/gate-report.json" ".gates['4.ground_contact_within_0.015m'].ok")
K2=$(json "$WORK/gate-report.json" ".info.kLegSuggested")
if [[ "$GROUND_OK" != "true" && -z "${K_LEG:-}" ]] && node -e "process.exit(Math.abs($K2-$KLEG)>1e-5?0:1)"; then
  echo "== [$MODE] ground contact failed; one-step k_leg correction $KLEG -> $K2"
  KLEG=$K2; chain "$KLEG"
fi
# Sword sockets (class-equipment.js FALLEN_LONGSWORD_SOCKETS) re-checked against this build's skin: needs numpy, so
# it runs on Blender's bundled python unless HERO_PY is set.
PYNP=${HERO_PY:-$(ls "$(dirname "$BLENDER")"/../Resources/*/python/bin/python3.* 2>/dev/null | grep -v config | head -1)}
echo "== [$MODE] sword sockets"
if "${PYNP:-python3}" -I "$HERE/sword-sockets.py" --glb "$WORK/final.glb" --labels "$WORK/labels.json" --json "$WORK/sockets-report.json" > "$WORK/sockets.log" 2>&1; then SOCKETS=ok; else SOCKETS=FAIL; fi
tail -1 "$WORK/sockets.log"
cp "$WORK/sockets-report.json" "$OUT/sockets-report.json" 2>/dev/null || true
cp "$WORK/final.glb" "$OUT/fallen_paladin.glb"
cp "$WORK/gate-report.json" "$OUT/gate-report.json"
cp "$WORK/transplant-report.json" "$OUT/transplant-report.json"
cp "$WORK/drape-report.json" "$OUT/drape-report.json"
cp "$WORK/validate.txt" "$OUT/validate.txt"
echo "$KLEG" > "$OUT/k_leg.txt"
node -e "const r=require(process.argv[1]);console.log(JSON.stringify({ok:r.ok,failed:r.failed,documentedDeviations:Object.keys(r.documentedDeviations||{}),undocumentedFailures:r.undocumentedFailures,sockets:process.argv[2],bytes:r.info.bytes,triangles:r.info.triangles}))" "$OUT/gate-report.json" "$SOCKETS"
