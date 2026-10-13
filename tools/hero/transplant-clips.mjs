// Copy the 26 human.glb clips onto the hero bind GLB at the glTF level (BUILD-SPEC §2.3 step 9, §4.2).
//
//   rotation + scale tracks      : copied unchanged
//   mixamorig:Hips translation   : copied, every key multiplied by k_leg
//   every other translation      : constant = the hero node's own rest translation, one key per input key
//   interpolation                : as in the source (STEP / LINEAR only)
//
// Gates (exit code 1 on failure): 26 animations, 3,849 channels, 0 dropped, clip-name + joint-name sha1,
// same joint order + parents, every joint translation direction within 0.01 deg of human.glb's,
// rest jointWorld * IBM within 1e-5 of identity.
//
// usage: node tools/hero/transplant-clips.mjs --hero <bind.glb> --human <human.glb> --out <out.glb>
//                                             [--k-leg 1.04156] [--report <report.json>]
// Needs @gltf-transform/core + /extensions 4.5.1 (devDependencies per spec §4.2). If they are not installed in
// this checkout, set GLTF_TRANSFORM_DIR=<.../node_modules/@gltf-transform> or keep `npx @gltf-transform/cli@4.5.1`
// in the npx cache; the script then loads them from there.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const JOINT_SHA1 = '0517163dd961e4e448aba9882c1bed4dff22831e';
export const CLIP_SHA1 = '24c68fde57a288083fdcaa8e1bb49e3d7acbb34c';
export const CLIP_COUNT = 26;
export const CHANNEL_COUNT = 3849;
export const COPYRIGHT = 'Fallen Paladin in Corrupted Black Plate Armor by Pigcraft (https://sketchfab.com/3d-models/fallen-paladin-in-corrupted-black-plate-armor-df3056caff7e4f079bd4eec0fa9bcd54), CC BY 4.0; rigged to the Sanctum & Shadow skeleton, sword separated, textures re-encoded.';

export async function loadGltfTransform() {
  const tryImport = async (dir) => {
    const core = await import(pathToFileURL(path.join(dir, 'core/dist/index.js')).href);
    const ext = await import(pathToFileURL(path.join(dir, 'extensions/dist/index.js')).href);
    return { ...core, ALL_EXTENSIONS: ext.ALL_EXTENSIONS, source: dir };
  };
  try {
    const core = await import('@gltf-transform/core');
    const ext = await import('@gltf-transform/extensions');
    return { ...core, ALL_EXTENSIONS: ext.ALL_EXTENSIONS, source: 'node_modules' };
  } catch { /* fall through */ }
  const dirs = [];
  if (process.env.GLTF_TRANSFORM_DIR) dirs.push(process.env.GLTF_TRANSFORM_DIR);
  const npx = path.join(os.homedir(), '.npm/_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) dirs.push(path.join(npx, d, 'node_modules/@gltf-transform'));
  for (const dir of dirs) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'core/package.json'), 'utf8'));
      if (pkg.version !== '4.5.1' && !process.env.GLTF_TRANSFORM_DIR) continue;
      return await tryImport(dir);
    } catch { /* next */ }
  }
  throw new Error('@gltf-transform/core 4.5.1 not found (npm i -D @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1, or set GLTF_TRANSFORM_DIR)');
}

export const sha1 = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex');

// column-major mat4 helpers
export function mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
export function maxDevFromIdentity(m) { let d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(m[i] - (i % 5 === 0 ? 1 : 0))); return d; }
const angleDeg = (a, b) => { const la = Math.hypot(...a), lb = Math.hypot(...b); if (la < 1e-9 || lb < 1e-9) return 0; const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb); return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI; };

// The hero must have exactly one skin. human.glb has two (vanguard_Mesh, vanguard_visor) with identical joint lists.
export function skinJointNames(root, { single = true } = {}) {
  const skins = root.listSkins();
  if (!skins.length || (single && skins.length !== 1)) throw new Error(`expected 1 skin, got ${skins.length}`);
  const lists = skins.map((s) => JSON.stringify(s.listJoints().map((j) => j.getName())));
  if (lists.some((l) => l !== lists[0])) throw new Error('skins disagree on joints');
  return JSON.parse(lists[0]);
}

export function restIdentityDeviation(root) {
  const skin = root.listSkins()[0];
  const ibm = skin.getInverseBindMatrices();
  let worst = 0;
  skin.listJoints().forEach((j, k) => { const m = ibm.getElement(k, new Array(16)); worst = Math.max(worst, maxDevFromIdentity(mul(j.getWorldMatrix(), m))); });
  return worst;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k.startsWith('--')) { out[k.slice(2)] = argv[i + 1]; i++; } }
  return out;
}

export async function transplant({ heroPath, humanPath, outPath, kLeg = 1.0, reportPath }) {
  const GT = await loadGltfTransform();
  const io = new GT.NodeIO().registerExtensions(GT.ALL_EXTENSIONS);
  const hero = await io.read(heroPath), human = await io.read(humanPath);
  const hr = hero.getRoot(), ur = human.getRoot();
  const report = { hero: heroPath, human: humanPath, out: outPath, kLeg, gltfTransform: GT.source, gates: {} };
  const fail = [];
  const gate = (name, ok, detail) => { report.gates[name] = { ok: !!ok, ...(detail === undefined ? {} : { detail }) }; if (!ok) fail.push(name); };

  // Joint contract.
  const jh = skinJointNames(hr), ju = skinJointNames(ur, { single: false });
  gate('joint_count_49', jh.length === 49, jh.length);
  gate('joint_order_matches_human', JSON.stringify(jh) === JSON.stringify(ju));
  gate('joint_name_sha1', sha1(jh) === JOINT_SHA1, sha1(jh));
  const nameMap = (root) => new Map(root.listNodes().map((n) => [n.getName(), n]));
  const heroNodes = nameMap(hr), humanNodes = nameMap(ur);
  const parentName = (n) => { const p = n.getParentNode(); return p ? p.getName() : null; };
  const parentMismatch = ju.filter((n) => !heroNodes.get(n) || parentName(heroNodes.get(n)) !== parentName(humanNodes.get(n)));
  gate('joint_parents_match', parentMismatch.length === 0, parentMismatch);
  const dup = [...heroNodes.keys()].filter((n) => /\.\d{3}$|^mixamorig_/.test(n));
  gate('no_renamed_nodes', dup.length === 0, dup);
  const rootH = heroNodes.get('Character'), rootU = humanNodes.get('Character');
  const rr = (v) => v.map((x) => +x.toFixed(5));
  gate('character_root_matches', rootH && JSON.stringify(rr(rootH.getRotation())) === JSON.stringify(rr(rootU.getRotation())) && JSON.stringify(rr(rootH.getScale())) === JSON.stringify(rr(rootU.getScale())),
    rootH ? { rotation: rootH.getRotation(), scale: rootH.getScale() } : null);

  // Translation directions: only lengths may change.
  const dirs = {}; let worstDir = 0; const ratios = {};
  for (const n of ju) {
    const th = heroNodes.get(n).getTranslation(), tu = humanNodes.get(n).getTranslation();
    const a = angleDeg(th, tu); dirs[n] = +a.toFixed(5); worstDir = Math.max(worstDir, a);
    const r = Math.hypot(...th) / (Math.hypot(...tu) || 1); if (Math.abs(r - 1) > 1e-3) ratios[n.replace('mixamorig:', '')] = +r.toFixed(4);
  }
  gate('joint_direction_within_0.01deg', worstDir <= 0.01, +worstDir.toFixed(6));
  report.lengthRatios = ratios;
  const leafNames = ['mixamorig:LeftHandThumb3', 'mixamorig:LeftHandPinky3', 'mixamorig:RightHandPinky3'];
  report.leafNodeDirectionDeg = Object.fromEntries(leafNames.map((n) => [n, heroNodes.get(n) ? +angleDeg(heroNodes.get(n).getTranslation(), humanNodes.get(n).getTranslation()).toFixed(5) : null]));
  gate('finger_tip_leaf_nodes_present', leafNames.every((n) => heroNodes.get(n)));
  const restDev = restIdentityDeviation(hr);
  gate('rest_jointWorld_x_IBM_identity_1e-5', restDev <= 1e-5, restDev);

  // Copy clips.
  const buffer = hr.listBuffers()[0];
  for (const a of hr.listAnimations()) a.dispose();
  let dropped = 0, channels = 0; const droppedList = []; const interp = new Set();
  for (const ua of ur.listAnimations()) {
    const ha = hero.createAnimation(ua.getName());
    for (const uc of ua.listChannels()) {
      const srcNode = uc.getTargetNode(); const target = srcNode && heroNodes.get(srcNode.getName());
      if (!target) { dropped++; droppedList.push(`${ua.getName()}:${srcNode && srcNode.getName()}`); continue; }
      const us = uc.getSampler(), pathName = uc.getTargetPath();
      const it = us.getInterpolation(); interp.add(it);
      if (it !== 'STEP' && it !== 'LINEAR') throw new Error(`unsupported interpolation ${it}`);
      const inArr = us.getInput().getArray().slice();
      const input = hero.createAccessor().setType('SCALAR').setArray(inArr).setBuffer(buffer);
      let outArr = us.getOutput().getArray().slice();
      if (!(outArr instanceof Float32Array)) throw new Error('non-float animation output');
      if (pathName === 'translation') {
        if (target.getName() === 'mixamorig:Hips') outArr = outArr.map((v) => v * kLeg);
        else { const t = target.getTranslation(); outArr = new Float32Array(inArr.length * 3); for (let i = 0; i < inArr.length; i++) outArr.set(t, i * 3); }
      }
      const output = hero.createAccessor().setType(us.getOutput().getType()).setArray(outArr).setBuffer(buffer);
      const hs = hero.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(it);
      ha.addSampler(hs).addChannel(hero.createAnimationChannel().setTargetNode(target).setTargetPath(pathName).setSampler(hs));
      channels++;
    }
  }
  const clipNames = hr.listAnimations().map((a) => a.getName());
  gate('clip_count_26', clipNames.length === CLIP_COUNT, clipNames.length);
  gate('clip_names_order_identical', JSON.stringify(clipNames) === JSON.stringify(ur.listAnimations().map((a) => a.getName())));
  gate('clip_name_sha1', sha1(clipNames) === CLIP_SHA1, sha1(clipNames));
  gate('channels_3849', channels === CHANNEL_COUNT, channels);
  gate('dropped_0', dropped === 0, droppedList);
  report.interpolations = [...interp];
  report.channelsPerClip = Object.fromEntries(hr.listAnimations().map((a) => [a.getName(), a.listChannels().length]));

  hr.getAsset().copyright = COPYRIGHT;
  await io.write(outPath, hero);
  report.ok = fail.length === 0; report.failed = fail;
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const a = parseArgs(process.argv.slice(2));
  if (!a.hero || !a.human || !a.out) { console.error('usage: transplant-clips.mjs --hero <bind.glb> --human <human.glb> --out <out.glb> [--k-leg n] [--report f]'); process.exit(2); }
  const r = await transplant({ heroPath: a.hero, humanPath: a.human, outPath: a.out, kLeg: Number(a['k-leg'] || 1), reportPath: a.report });
  console.log(JSON.stringify({ ok: r.ok, failed: r.failed, kLeg: r.kLeg, channels: r.gates.channels_3849.detail, clips: r.gates.clip_count_26.detail, worstDirDeg: r.gates['joint_direction_within_0.01deg'].detail, restDev: r.gates['rest_jointWorld_x_IBM_identity_1e-5'].detail }));
  if (!r.ok) process.exit(1);
}
