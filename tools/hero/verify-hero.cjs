// Hero asset gates (BUILD-SPEC §6.1), node only, no browser.
//
// usage: node tools/hero/verify-hero.cjs --hero <final.glb> --human <human.glb>
//          [--pre <transplanted, pre-quantize glb>] [--canary <canary glb with clips>] [--labels <labels.json>]
//          [--k-leg <value used>] [--max-bytes 4194304] [--out <report.json>] [--skip-deform] [--allow-documented]
//
//  1  joint-name sha1, clip-name sha1, 3,849 channels, Character rotation/scale, FP_Sword present + unskinned, one skin
//  2  every joint translation direction within 0.01 deg of human.glb's; before quantize (--pre): rest jointWorld*IBM ~ I
//  3  canary replay (poc_check.cjs): worst single-bone offset <= 0.5 mm (Idle, Walk, Attack_Smite, Death, TPose)
//  4  ground contact: lowest skinned vertex at Idle mid, every Walk frame, every Run frame within +-0.015 m of y = 0
//  5  deformation, every key time of the 25 mapped clips:
//     a. edges inside a locked plate (both ends locked) stretch <= 10 % (border edges reported, not gated)
//     b. per clip, the hero's worst single-edge elongation <= the human.glb control's worst in the same clip,
//        separately for the body and for the cape. Replaces the spec's "no edge > 50 %", which the live human.glb
//        itself fails in 25/25 clips (Idle included); the literal numbers for both models stay in the report.
//     Death is measured as the game renders it: with the FP_CapeDrape corrective morph at the influence character-actor.js
//     gives it (smoothstep of the clip progress over DRAPE_RAMP); every other clip renders the morph at 0.
//  1b the body primitive carries exactly one morph target, FP_CapeDrape (POSITION only), and it moves cape vertices only
//  6  size <= 4 MiB, extensionsRequired within {KHR_mesh_quantization, EXT_texture_webp}, only TEXCOORD_0,
//     normalTexture.texCoord missing or 0, glTF validator 0 errors
// Exit code 1 if any gate fails. Gates listed in DOCUMENTED_DEVIATIONS still fail (R.ok stays false) but are reported
// separately with the reason; --allow-documented exits 0 when they are the only failures. Informational numbers
// (triangles, draw calls, texture sizes) are in the report.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const G = require('./glb.cjs');
const { check: canaryCheck } = require('./poc_check.cjs');

const JOINT_SHA1 = '0517163dd961e4e448aba9882c1bed4dff22831e';
const CLIP_SHA1 = '24c68fde57a288083fdcaa8e1bb49e3d7acbb34c';
const ALLOWED_REQUIRED = ['KHR_mesh_quantization', 'EXT_texture_webp'];
// Cape drape corrective (tools/hero/cape-drape.mjs); the same target name and ramp are used by character-actor.js.
const DRAPE_TARGET = 'FP_CapeDrape';
const DRAPE_RAMP = [0.15, 0.65];
const drapeInfluence = (t, duration) => { const u = Math.min(1, Math.max(0, (t / duration - DRAPE_RAMP[0]) / (DRAPE_RAMP[1] - DRAPE_RAMP[0]))); return u * u * (3 - 2 * u); };
// Known failures that are documented and await the owner's decision (they are NOT passes). Remove an entry once fixed.
const DOCUMENTED_DEVIATIONS = {
  '5.cape_edge_elongation_le_human_control': 'The cape is one skinned sheet with no bones of its own (49-joint contract): Spine2 -> Hips blend over its height plus a symmetric 0.4 thigh share at the hem. Death is now measured with the FP_CapeDrape corrective morph (tools/hero/cape-drape.mjs, driven by character-actor.js over 15-65 % of the clip): worst cape edge 201 -> 111 mm (human.glb body 97 mm), Death-end cape-to-body gap median 30 -> 6 cm, max 45 -> 18 cm. Still over the human control: Attack_Heavy (118 vs 64 mm; warrior clip, never played by a paladin), Hit (88 vs 57 mm; 0.54 s reaction, cape bows out behind the hunched body), Attack_Smite (48.7 vs 47.8 mm). These are the outside of deep spine bends on 15-24 cm Tripo edges; no tearing or leg poke-through is visible at the gameplay camera (round-2 renders). Fix if wanted: BUILD-SPEC v1.1 cape bones, or more per-clip correctives like FP_CapeDrape. Owner sign-off pending.',
};
// Clip-name -> state mapping exactly as character-actor.js L44-70 ("last match wins" is avoided by break).
const MAP = [['combat_idle'], ['walk_start'], ['walk_stop'], ['turn_left'], ['turn_right'], ['weapon_sheathe'], ['weapon_draw'], ['interact'], ['talk'], ['work'], ['drink'], ['idle'], ['walk'], ['run'], ['death'], ['hit'], ['dodge'], ['block'], ['bow', 'bow_shot'], ['cast'], ['heavy', 'attack_heavy'], ['dual', 'attack_dual'], ['staff_strike'], ['smite', 'attack_smite'], ['attack', 'attack_slash']];

function args(argv) { const o = {}; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; } } } return o; }
const sha1 = (v) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
const angleDeg = (a, b) => { const la = Math.hypot(...a), lb = Math.hypot(...b); if (la < 1e-9 || lb < 1e-9) return 0; const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb); return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI; };

function model(file) {
  const g = G.readGLB(file); const j = g.json;
  const parent = new Array(j.nodes.length).fill(-1);
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
  const byName = {}; j.nodes.forEach((n, i) => (byName[n.name] = i));
  const cache = new Map(); const read = (i) => { if (!cache.has(i)) cache.set(i, G.readAccessor(g, i)); return cache.get(i); };
  return { file, g, j, parent, byName, read, size: g.size };
}
function localMat(n, o) { if (n.matrix && !o) return n.matrix.slice(); o = o || {}; return G.compose(o.t || n.translation, o.r || n.rotation, o.s || n.scale); }
function worlds(m, ov = {}) { const W = new Array(m.j.nodes.length); const get = (i) => W[i] || (W[i] = m.parent[i] < 0 ? localMat(m.j.nodes[i], ov[i]) : G.mul(get(m.parent[i]), localMat(m.j.nodes[i], ov[i]))); m.j.nodes.forEach((_, i) => get(i)); return W; }
function slerp(a, b, t) { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map((x) => -x); d = -d; } const o = a.map((x, k) => x + (b[k] - x) * t); const l = Math.hypot(...o); return o.map((x) => x / l); }
function sampleChannel(m, anim, ch, t) {
  const s = anim.samplers[ch.sampler]; const tin = m.read(s.input); const out = m.read(s.output); const n = tin.length;
  if (t <= tin[0][0]) return out[0]; if (t >= tin[n - 1][0]) return out[n - 1];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tin[mid][0] <= t) lo = mid; else hi = mid; }
  if (s.interpolation === 'STEP') return out[lo];
  const f = (t - tin[lo][0]) / (tin[hi][0] - tin[lo][0]);
  return ch.target.path === 'rotation' ? slerp(out[lo], out[hi], f) : out[lo].map((x, k) => x + (out[hi][k] - x) * f);
}
function pose(m, anim, t) { const o = {}; for (const ch of anim.channels) { const i = ch.target.node; const v = sampleChannel(m, anim, ch, t); o[i] = o[i] || {}; o[i][{ rotation: 'r', translation: 't', scale: 's' }[ch.target.path]] = v; } return o; }
function keyTimes(m, anim) { const set = new Set(); for (const s of anim.samplers) for (const v of m.read(s.input)) set.add(+v[0].toFixed(6)); return [...set].sort((a, b) => a - b); }

// Flattened skinned body for fast replay.
function skinData(m, preferName) {
  const skinned = m.j.nodes.filter((n) => n.skin !== undefined && n.mesh !== undefined);
  const node = skinned.find((n) => n.name === preferName) || skinned[0];
  const skin = m.j.skins[node.skin]; const ibm = m.read(skin.inverseBindMatrices);
  const prims = m.j.meshes[node.mesh].primitives;
  const P = [], J = [], Wt = [], tris = [];
  let base = 0;
  for (const p of prims) {
    const pos = m.read(p.attributes.POSITION), jo = m.read(p.attributes.JOINTS_0), we = m.read(p.attributes.WEIGHTS_0);
    for (let i = 0; i < pos.length; i++) { P.push(pos[i]); J.push(jo[i]); const s = we[i][0] + we[i][1] + we[i][2] + we[i][3]; Wt.push(we[i].map((x) => x / s)); }
    const idx = p.indices !== undefined ? m.read(p.indices).map((v) => v[0]) : pos.map((_, i) => i);
    for (let i = 0; i < idx.length; i += 3) tris.push([idx[i] + base, idx[i + 1] + base, idx[i + 2] + base]);
    base += pos.length;
  }
  const N = P.length;
  const pos = new Float64Array(N * 3), jnt = new Uint16Array(N * 4), wt = new Float64Array(N * 4);
  for (let i = 0; i < N; i++) { pos.set(P[i], i * 3); jnt.set(J[i], i * 4); wt.set(Wt[i], i * 4); }
  // Morph targets of the (single) body primitive, by name (mesh.extras.targetNames).
  const mesh = m.j.meshes[node.mesh]; const names = mesh.extras?.targetNames || []; const targets = {};
  if (prims.length === 1) (prims[0].targets || []).forEach((t, k) => { const d = new Float64Array(N * 3); if (t.POSITION !== undefined) m.read(t.POSITION).forEach((v, i) => d.set(v, i * 3)); targets[names[k] || `#${k}`] = { delta: d, attributes: Object.keys(t) }; });
  return { node, skin, ibm, N, pos, jnt, wt, tris, targets, targetCount: prims.reduce((n, p) => n + (p.targets || []).length, 0) };
}
function skinFrame(m, sd, W, out, morph = null, influence = 0) {
  const J = sd.skin.joints.map((ji, k) => G.mul(W[ji], sd.ibm[k]));
  const { N, pos, jnt, wt } = sd; const md = morph && influence > 0 ? morph : null;
  for (let i = 0; i < N; i++) {
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; let ox = 0, oy = 0, oz = 0;
    if (md) { x += influence * md[i * 3]; y += influence * md[i * 3 + 1]; z += influence * md[i * 3 + 2]; }
    for (let k = 0; k < 4; k++) {
      const w = wt[i * 4 + k]; if (w === 0) continue; const M = J[jnt[i * 4 + k]];
      ox += w * (M[0] * x + M[4] * y + M[8] * z + M[12]); oy += w * (M[1] * x + M[5] * y + M[9] * z + M[13]); oz += w * (M[2] * x + M[6] * y + M[10] * z + M[14]);
    }
    out[i * 3] = ox; out[i * 3 + 1] = oy; out[i * 3 + 2] = oz;
  }
  return out;
}
function minY(arr) { let m = Infinity; for (let i = 1; i < arr.length; i += 3) if (arr[i] < m) m = arr[i]; return m; }

function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fmt = buf.toString('ascii', 12, 16);
  if (fmt === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (fmt === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
  if (fmt === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  return null;
}
function pngSize(buf) { return buf.readUInt32BE(0) === 0x89504e47 ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null; }

function findValidator() {
  const tries = [];
  try { return require('gltf-validator'); } catch { /* next */ }
  const npx = path.join(os.homedir(), '.npm/_npx');
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) tries.push(path.join(npx, d, 'node_modules/gltf-validator'));
  for (const t of tries) { try { return require(t); } catch { /* next */ } }
  return null;
}

// Human control for gate 5: worst single-edge elongation per mapped clip, plus the spec-literal stretch numbers.
function controlDeformation(m, sd, actions, animOf) {
  const es = new Set(); const E = [];
  for (const [p, q, r] of sd.tris) for (const [u, v] of [[p, q], [q, r], [r, p]]) { const k = u < v ? u * 1e6 + v : v * 1e6 + u; if (!es.has(k)) { es.add(k); E.push([u, v]); } }
  const buf = new Float64Array(sd.N * 3); skinFrame(m, sd, worlds(m), buf);
  const rest = E.map(([u, v]) => Math.hypot(buf[u * 3] - buf[v * 3], buf[u * 3 + 1] - buf[v * 3 + 1], buf[u * 3 + 2] - buf[v * 3 + 2]));
  const perClip = {}; const over = new Set(); let worst = 0, worstClip = null; const clipsOver50 = [];
  for (const clipName of Object.values(actions)) {
    const an = animOf(clipName); let el = 0, sMax = 0;
    for (const t of keyTimes(m, an)) {
      skinFrame(m, sd, worlds(m, pose(m, an, t)), buf);
      for (let e = 0; e < E.length; e++) {
        const [u, v] = E[e]; const d = Math.hypot(buf[u * 3] - buf[v * 3], buf[u * 3 + 1] - buf[v * 3 + 1], buf[u * 3 + 2] - buf[v * 3 + 2]);
        if (d - rest[e] > el) el = d - rest[e];
        if (rest[e] >= 0.002) { const s = d / rest[e] - 1; if (s > sMax) sMax = s; if (s > 0.5) over.add(e); if (s > worst) { worst = s; worstClip = clipName; } }
      }
    }
    perClip[clipName] = { elong_mm: +(el * 1000).toFixed(1), worstStretchPct: +(sMax * 100).toFixed(1) };
    if (sMax > 0.5) clipsOver50.push(clipName);
  }
  return { perClip, worstPct: +(worst * 100).toFixed(1), worstClip, edgesOver50: over.size, edges: E.length, clipsOver50: `${clipsOver50.length}/${Object.keys(actions).length}` };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.hero || !a.human) { console.error('usage: verify-hero.cjs --hero <glb> --human <glb> [--pre glb] [--canary glb] [--labels json] [--k-leg n] [--out json]'); process.exit(2); }
  const maxBytes = Number(a['max-bytes'] || 4 * 1024 * 1024);
  const H = model(a.hero), U = model(a.human);
  const R = { hero: a.hero, gates: {}, info: {} }; const failed = [];
  const gate = (k, ok, detail) => { R.gates[k] = { ok: !!ok, detail }; if (!ok) failed.push(k); };
  const j = H.j;

  // ---- 1. contract
  const skinsH = j.skins || [];
  gate('1.one_skin', skinsH.length === 1, skinsH.length);
  const jointsH = skinsH[0].joints.map((i) => j.nodes[i].name);
  const jointsU = U.j.skins[0].joints.map((i) => U.j.nodes[i].name);
  gate('1.joint_name_sha1', sha1(jointsH) === JOINT_SHA1, sha1(jointsH));
  const clips = (j.animations || []).map((x) => x.name);
  gate('1.clip_name_sha1', sha1(clips) === CLIP_SHA1, sha1(clips));
  const channels = (j.animations || []).reduce((s, x) => s + x.channels.length, 0);
  gate('1.channels_3849', channels === 3849, channels);
  const ch = j.nodes[H.byName.Character], cu = U.j.nodes[U.byName.Character];
  const near = (p, q) => p && q && p.length === q.length && p.every((v, i) => Math.abs(v - q[i]) < 1e-6);
  gate('1.character_root', !!ch && near(ch.rotation, cu.rotation) && near(ch.scale, cu.scale), ch && { rotation: ch.rotation, scale: ch.scale });
  const swordIdx = H.byName.FP_Sword; const sword = j.nodes[swordIdx];
  const subtree = (i) => [i, ...((j.nodes[i].children || []).flatMap(subtree))];
  const swordMeshNodes = sword ? subtree(swordIdx).filter((i) => j.nodes[i].mesh !== undefined) : [];
  const sceneRoots = j.scenes[j.scene || 0].nodes;
  gate('1.FP_Sword_present_unskinned', !!sword && swordMeshNodes.length === 1 && swordMeshNodes.every((i) => j.nodes[i].skin === undefined) && sceneRoots.includes(swordIdx) && H.parent[swordIdx] < 0,
    sword && { rootLevel: sceneRoots.includes(swordIdx), scale: sword.scale, translation: sword.translation || [0, 0, 0], meshNodes: swordMeshNodes.map((i) => j.nodes[i].name) });
  const leafs = ['mixamorig:LeftHandThumb3', 'mixamorig:LeftHandPinky3', 'mixamorig:RightHandPinky3'];
  gate('1.finger_tip_leaf_nodes_kept', leafs.every((n) => H.byName[n] !== undefined), leafs.filter((n) => H.byName[n] === undefined));
  const dropped = []; for (const an of j.animations || []) for (const c of an.channels) if (c.target.node === undefined) dropped.push(an.name);
  gate('1.no_untargeted_channels', dropped.length === 0, dropped.length);
  // Clip mapping as the game does it: 25 states, TPose unmapped.
  const actions = {}; for (const name of clips) { const n = name.toLowerCase(); for (const [k, s] of MAP) { if (n.includes(k) || (k === 'attack' && n.includes('slash'))) { actions[s || k] = name; break; } } }
  gate('1.game_clip_mapping_25_states', Object.keys(actions).length === 25, actions);

  // ---- 2. directions + rest identity
  let worstDir = 0; for (const n of jointsU) worstDir = Math.max(worstDir, angleDeg(j.nodes[H.byName[n]].translation || [0, 0, 0], U.j.nodes[U.byName[n]].translation || [0, 0, 0]));
  gate('2.joint_direction_within_0.01deg', worstDir <= 0.01, +worstDir.toFixed(6));
  if (a.pre) {
    const P = model(a.pre); const W = worlds(P); const sk = P.j.skins[0]; const ibm = P.read(sk.inverseBindMatrices);
    let dev = 0; sk.joints.forEach((ji, k) => { const M = G.mul(W[ji], ibm[k]); for (let q = 0; q < 16; q++) dev = Math.max(dev, Math.abs(M[q] - (q % 5 === 0 ? 1 : 0))); });
    gate('2.pre_quantize_rest_identity_1e-5', dev <= 1e-5, dev);
  }

  // ---- 3. canary
  if (a.canary) {
    const c = canaryCheck(a.canary, a.human);
    gate('3.canary_worst_rigid_offset_le_0.5mm', c.worstRigidOffset_mm <= 0.5, c.worstRigidOffset_mm);
    gate('3.canary_upleg_rel_hips_le_0.5mm', c.worstUpLegRelHips_mm <= 0.5, c.worstUpLegRelHips_mm);
    R.info.canary = Object.fromEntries(Object.entries(c.clips).map(([k, v]) => [k, { worstRigidOffset_mm: v.worstRigidOffset_mm, upLegRelHips_mm: v.upLegRelHips_mm, lowerLegRelHips_mm_info: v.lowerLegRelHips_mm_info }]));
  }

  // ---- 4. ground contact
  // Idle mid: absolute, lowest skinned vertex within +-0.015 m of y = 0.
  // Walk / Run: the spec's literal rule is absolute on every frame, but human.glb's own Run has flight phases
  // (both feet up) and its Walk dips below 0, so each frame is compared with the human control at the same
  // time (|hero - human| <= 0.015 m). Absolute values are reported alongside.
  const sd = skinData(H); const buf = new Float64Array(sd.N * 3);
  const sdU = skinData(U, 'vanguard_Mesh'); const bufU = new Float64Array(sdU.N * 3);
  const anim = (n) => j.animations.find((x) => x.name === n);
  const animU = (n) => U.j.animations.find((x) => x.name === n);
  const ground = {}; let worstRel = 0, worstRelSigned = 0;
  const yAt = (m, sdx, b, an, t) => minY(skinFrame(m, sdx, worlds(m, pose(m, an, t)), b));
  { const an = anim('Idle'); const ts = keyTimes(H, an); const t = (ts[0] + ts[ts.length - 1]) / 2;
    const y = yAt(H, sd, buf, an, t), yu = yAt(U, sdU, bufU, animU('Idle'), t);
    ground.Idle_mid = { hero: +y.toFixed(4), human: +yu.toFixed(4) }; if (Math.abs(y) > worstRel) { worstRel = Math.abs(y); worstRelSigned = y; } }
  for (const c of ['Walk', 'Run']) {
    const g = ground[c] = { heroMin: Infinity, heroMax: -Infinity, humanMin: Infinity, humanMax: -Infinity, worstDelta: 0, worstDeltaT: null, frames: 0, worstDeltaHumanPlanted: 0, worstDeltaHumanAirborne: 0 };
    for (const t of keyTimes(H, anim(c))) {
      const y = yAt(H, sd, buf, anim(c), t), yu = yAt(U, sdU, bufU, animU(c), t); const dlt = y - yu;
      g.heroMin = Math.min(g.heroMin, y); g.heroMax = Math.max(g.heroMax, y); g.humanMin = Math.min(g.humanMin, yu); g.humanMax = Math.max(g.humanMax, yu); g.frames++;
      if (Math.abs(dlt) > Math.abs(g.worstDelta)) { g.worstDelta = dlt; g.worstDeltaT = +t.toFixed(3); }
      const k = yu <= 0.01 ? 'worstDeltaHumanPlanted' : 'worstDeltaHumanAirborne';   // human lowest point within 1 cm of the floor = planted
      if (Math.abs(dlt) > Math.abs(g[k])) g[k] = dlt;
      if (Math.abs(dlt) > worstRel) { worstRel = Math.abs(dlt); worstRelSigned = dlt; }
    }
    for (const k of ['heroMin', 'heroMax', 'humanMin', 'humanMax', 'worstDelta', 'worstDeltaHumanPlanted', 'worstDeltaHumanAirborne']) g[k] = +g[k].toFixed(4);
  }
  gate('4.ground_contact_within_0.015m', worstRel <= 0.015, { worst_m: +worstRelSigned.toFixed(4), rule: 'Idle mid absolute; Walk/Run per frame vs human control', perClip: ground });
  const restMin = minY(skinFrame(H, sd, worlds(H), buf));
  R.info.restPoseLowestY_m = +restMin.toFixed(4);
  if (a['k-leg']) { const k = Number(a['k-leg']); R.info.kLegUsed = k; R.info.kLegSuggested = +(k - ground.Idle_mid.hero / 1.0342).toFixed(5); }

  // ---- 1b. cape drape corrective morph
  { const dr = sd.targets[DRAPE_TARGET]; let moved = 0, maxD = 0;
    if (dr) for (let i = 0; i < sd.N; i++) { const l = Math.hypot(dr.delta[i * 3], dr.delta[i * 3 + 1], dr.delta[i * 3 + 2]); if (l > 1e-5) { moved++; maxD = Math.max(maxD, l); } }
    R.info.capeDrape = { target: DRAPE_TARGET, present: !!dr, morphTargets: sd.targetCount, attributes: dr?.attributes, movedVertices: moved, maxDelta_m: +maxD.toFixed(4), ramp: DRAPE_RAMP };
    gate('1.cape_drape_morph', !!dr && sd.targetCount === 1 && dr.attributes.join() === 'POSITION' && moved > 0 && maxD < 0.6, R.info.capeDrape); }

  // ---- 5. deformation
  if (!a['skip-deform']) {
    let labels = null;
    if (a.labels) {
      const L = JSON.parse(fs.readFileSync(a.labels, 'utf8'));
      const key = (x, y, z) => `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`; // 0.5 mm cells
      const grid = new Map(); const np = L.positions.length / 3;
      for (let i = 0; i < np; i++) { const k = key(L.positions[i * 3], L.positions[i * 3 + 1], L.positions[i * 3 + 2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
      skinFrame(H, sd, worlds(H), buf); // rest positions of the final (quantized) mesh
      const region = new Int16Array(sd.N).fill(-1), locked = new Uint8Array(sd.N); let unmatched = 0, worstMatch = 0;
      for (let i = 0; i < sd.N; i++) {
        const x = buf[i * 3], y = buf[i * 3 + 1], z = buf[i * 3 + 2]; let best = -1, bd = Infinity;
        const cx = Math.round(x * 2000), cy = Math.round(y * 2000), cz = Math.round(z * 2000);
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
          const arr = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!arr) continue;
          for (const q of arr) { const d = Math.hypot(L.positions[q * 3] - x, L.positions[q * 3 + 1] - y, L.positions[q * 3 + 2] - z); if (d < bd) { bd = d; best = q; } }
        }
        if (best < 0) { unmatched++; continue; }
        worstMatch = Math.max(worstMatch, bd); region[i] = L.region[best]; locked[i] = L.locked[best];
      }
      labels = { names: L.region_names, region, locked, unmatched, worstMatch_mm: +(worstMatch * 1000).toFixed(3) };
      R.info.labelMatch = { unmatched, worstMatch_mm: labels.worstMatch_mm };
    }
    if (labels && sd.targets[DRAPE_TARGET]) {
      // The drape moves cape vertices only; Death-end cape-to-body gap with the morph at 0 and at the game's end influence.
      const d = sd.targets[DRAPE_TARGET].delta; const capeR = labels.names.indexOf('cape'); let offCape = 0;
      for (let i = 0; i < sd.N; i++) if (labels.region[i] !== capeR && Math.hypot(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]) > 1e-4) offCape++;
      R.info.capeDrape.nonCapeVerticesMoved = offCape;
      if (offCape) gate('1.cape_drape_morph', false, { ...R.info.capeDrape, error: `${offCape} non-cape vertices moved` });
      const an = anim('Death'); const kt = keyTimes(H, an); const tEnd = kt[kt.length - 1]; const Wd = worlds(H, pose(H, an, tEnd));
      const capeV = [], bodyV = []; for (let i = 0; i < sd.N; i += 2) { if (labels.region[i] === capeR) capeV.push(i); else if (labels.region[i] >= 0) bodyV.push(i); }
      const gapStats = (inf) => { skinFrame(H, sd, Wd, buf, d, inf); const g = capeV.map((i) => { let b = Infinity; for (const j of bodyV) { const dd = (buf[i * 3] - buf[j * 3]) ** 2 + (buf[i * 3 + 1] - buf[j * 3 + 1]) ** 2 + (buf[i * 3 + 2] - buf[j * 3 + 2]) ** 2; if (dd < b) b = dd; } return Math.sqrt(b); }).sort((x, y) => x - y);
        const q = (p) => +(g[Math.min(g.length - 1, Math.floor(p * g.length))] * 100).toFixed(1); return { median_cm: q(0.5), p90_cm: q(0.9), max_cm: q(1) }; };
      R.info.capeDrape.deathEndCapeGap = { influence: +drapeInfluence(tEnd, tEnd).toFixed(3), withoutDrape: gapStats(0), withDrape: gapStats(drapeInfluence(tEnd, tEnd)), note: 'distance from cape vertices to the nearest other body vertex at the last Death key, every 2nd vertex' };
    }
    const es = new Set(); const E = [];
    for (const [p, q, r] of sd.tris) for (const [u, v] of [[p, q], [q, r], [r, p]]) { const k = u < v ? u * 1e6 + v : v * 1e6 + u; if (!es.has(k)) { es.add(k); E.push(u < v ? [u, v] : [v, u]); } }
    skinFrame(H, sd, worlds(H), buf);
    const rest = new Float64Array(E.length); const valid = new Uint8Array(E.length);
    const MIN_EDGE = 0.002; // relative stretch is meaningless on slivers; they are counted, and covered by the elongation metric
    let slivers = 0;
    E.forEach(([u, v], e) => { const d = Math.hypot(buf[u * 3] - buf[v * 3], buf[u * 3 + 1] - buf[v * 3 + 1], buf[u * 3 + 2] - buf[v * 3 + 2]); rest[e] = d; valid[e] = d >= MIN_EDGE ? 1 : 2; if (d < MIN_EDGE) slivers++; });
    let worstElong = { el: 0 }; const elongByRegion = {};
    const regionOf = (e) => { if (!labels) return 'all'; const [u, v] = E[e]; const ru = labels.region[u], rv = labels.region[v]; const nu = ru >= 0 ? labels.names[ru] : '?', nv = rv >= 0 ? labels.names[rv] : '?'; return nu === nv ? nu : [nu, nv].sort().join('|'); };
    const isPlate = (e) => labels && (labels.locked[E[e][0]] || labels.locked[E[e][1]]);          // plate border (info)
    const isPlateInterior = (e) => labels && labels.locked[E[e][0]] && labels.locked[E[e][1]];    // inside a locked plate (gate)
    const capeId = labels ? labels.names.indexOf('cape') : -1;
    const isCape = new Uint8Array(E.length);
    if (capeId >= 0) E.forEach(([u, v], e) => { isCape[e] = labels.region[u] === capeId || labels.region[v] === capeId ? 1 : 0; });
    const clipElong = {};                                  // clip -> { body, cape } worst single-edge elongation (m)
    let worstPlateInterior = { s: 0 };
    const perRegion = {}; let worstAll = { s: 0 }, worstPlate = { s: 0 }; let frames = 0;
    const over50 = new Map();
    const drape = sd.targets[DRAPE_TARGET]?.delta || null;
    for (const [state, clipName] of Object.entries(actions)) {
      const an = anim(clipName); const kt = keyTimes(H, an); const dur = kt[kt.length - 1];
      for (const t of kt) {
        skinFrame(H, sd, worlds(H, pose(H, an, t)), buf, state === 'death' ? drape : null, state === 'death' ? drapeInfluence(t, dur) : 0); frames++;
        const ce = clipElong[clipName] || (clipElong[clipName] = { body: 0, cape: 0, bodyT: null, capeT: null });
        for (let e = 0; e < E.length; e++) {
          const [u, v] = E[e];
          const d = Math.hypot(buf[u * 3] - buf[v * 3], buf[u * 3 + 1] - buf[v * 3 + 1], buf[u * 3 + 2] - buf[v * 3 + 2]);
          const el = d - rest[e];
          if (isCape[e]) { if (el > ce.cape) { ce.cape = el; ce.capeT = +t.toFixed(3); } } else if (el > ce.body) { ce.body = el; ce.bodyT = +t.toFixed(3); }
          if (el > 0.01) { const reg = regionOf(e); if (el > (elongByRegion[reg] || 0)) elongByRegion[reg] = el; if (el > worstElong.el) worstElong = { el, clip: clipName, t: +t.toFixed(3), region: reg }; }
          if (valid[e] !== 1) continue;
          const s = d / rest[e] - 1; if (s <= 0.02) continue;
          const reg = regionOf(e); const pr = perRegion[reg] || (perRegion[reg] = { s: 0 });
          if (s > pr.s) Object.assign(pr, { s, clip: clipName, t: +t.toFixed(3) });
          if (s > worstAll.s) worstAll = { s, clip: clipName, t: +t.toFixed(3), region: reg, edge: e };
          if (isPlate(e) && s > worstPlate.s) worstPlate = { s, clip: clipName, t: +t.toFixed(3), region: reg, edge: e };
          if (isPlateInterior(e) && s > worstPlateInterior.s) worstPlateInterior = { s, clip: clipName, t: +t.toFixed(3), region: reg, edge: e };
          if (s > 0.5) { const o = over50.get(e) || { s: 0, clip: '', region: reg }; if (s > o.s) Object.assign(o, { s, clip: clipName }); over50.set(e, o); }
        }
      }
    }
    const fmt = (o) => ({ ...o, s: undefined, stretchPct: +(o.s * 100).toFixed(1) });
    const regions = Object.fromEntries(Object.entries(perRegion).sort((x, y) => y[1].s - x[1].s).map(([k, v]) => [k, fmt(v)]));
    const over50ByRegion = {}; const over50ByClip = {};
    for (const o of over50.values()) { over50ByRegion[o.region] = (over50ByRegion[o.region] || 0) + 1; over50ByClip[o.clip] = (over50ByClip[o.clip] || 0) + 1; }
    R.info.deformation = { frames, edges: E.length, sliversUnder2mmSkippedForStretch: slivers,
      worstElongation_mm: { ...worstElong, el: undefined, mm: +(worstElong.el * 1000).toFixed(1) },
      elongationOver10mmByRegion_mm: Object.fromEntries(Object.entries(elongByRegion).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, +(v * 1000).toFixed(1)])), edgesOver50pctAnyFrame: over50.size, over50ByRegion, over50ByClip, worstEdge: fmt(worstAll), worstPlateEdge: fmt(worstPlate), perRegionMaxStretch: regions };
    // Locked plates (§3.1.2): an edge INSIDE a plate (both ends locked to one limb bone) must stay rigid. An edge with
    // one locked end belongs to the joint band ("joint bands keep the copied blend") and is reported, not gated.
    if (labels) gate('5.locked_plate_edges_stretch_le_10pct', worstPlateInterior.s <= 0.10,
      { interiorWorstPct: +(worstPlateInterior.s * 100).toFixed(2), rule: 'edges with both endpoints locked',
        borderWorstPct_info: +(worstPlate.s * 100).toFixed(1), borderWorst_info: fmt(worstPlate) });
    // "No edge stretches > 50 %" (spec literal) is failed by the live human.glb in every clip, Idle included (276 % worst),
    // so it cannot separate good from bad weights. The gate compares, clip by clip, the hero's worst single-edge
    // elongation with the human control's worst in the same clip (same code, same frames): body and cape separately.
    const ctrl = controlDeformation(U, sdU, actions, animU);
    const cmp = (part) => { const out = {}; let ok = true; for (const [clip, v] of Object.entries(clipElong)) { const hero = +(v[part] * 1000).toFixed(1), human = ctrl.perClip[clip].elong_mm; const pass = hero <= human; if (!pass) ok = false; out[clip] = { hero_mm: hero, human_mm: human, at: v[part + 'T'], ...(pass ? {} : { over: true }) }; } return { ok, out }; };
    const body = cmp('body'), cape = cmp('cape');
    gate('5.body_edge_elongation_le_human_control', body.ok, { rule: 'per clip: hero worst non-cape edge elongation <= human.glb worst edge elongation', perClip: body.out });
    if (labels) gate('5.cape_edge_elongation_le_human_control', cape.ok, { rule: 'per clip: hero worst cape edge elongation <= human.glb worst edge elongation', clipsOver: Object.entries(cape.out).filter(([, v]) => v.over).map(([k, v]) => `${k} ${v.hero_mm}>${v.human_mm}`), perClip: cape.out });
    R.info.deformation.specLiteral_allEdges50pct = { note: 'informational: the spec-literal rule, measured the same way on both models (edges >= 2 mm)',
      hero: { worstPct: +(worstAll.s * 100).toFixed(1), clip: worstAll.clip, region: worstAll.region, edgesOver50: over50.size, edges: E.length },
      human: { worstPct: ctrl.worstPct, clip: ctrl.worstClip, edgesOver50: ctrl.edgesOver50, edges: ctrl.edges, clipsFailingLiteralRule: ctrl.clipsOver50 } };
  }

  // ---- 6. size, extensions, attributes, validator
  gate('6.size_le_4MiB', H.size <= maxBytes, H.size);
  const req = j.extensionsRequired || [];
  gate('6.extensionsRequired_allowed', req.every((x) => ALLOWED_REQUIRED.includes(x)), req);
  const used = j.extensionsUsed || [];
  gate('6.no_draco_meshopt_ktx2', !used.some((x) => /draco|meshopt|ktx|basisu/i.test(x)), used);
  const attrs = new Set(); let prims = 0, tris = 0;
  for (const me of j.meshes) for (const p of me.primitives) { prims++; Object.keys(p.attributes).forEach((k) => attrs.add(k)); tris += (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3; }
  gate('6.only_TEXCOORD_0', [...attrs].filter((k) => k.startsWith('TEXCOORD')).join() === 'TEXCOORD_0', [...attrs]);
  const texCoords = []; for (const m of j.materials || []) { const t = [m.normalTexture, m.pbrMetallicRoughness?.baseColorTexture, m.pbrMetallicRoughness?.metallicRoughnessTexture, m.occlusionTexture, m.emissiveTexture].filter(Boolean); t.forEach((x) => texCoords.push(x.texCoord || 0)); }
  gate('6.normalTexture_texCoord_0', (j.materials || []).every((m) => !m.normalTexture || !m.normalTexture.texCoord), texCoords);
  const validator = findValidator();
  if (validator) {
    const rep = await validator.validateBytes(new Uint8Array(fs.readFileSync(a.hero)), { maxIssues: 50 });
    gate('6.validator_0_errors', rep.issues.numErrors === 0, { errors: rep.issues.numErrors, warnings: rep.issues.numWarnings, infos: rep.issues.numInfos, messages: rep.issues.messages.filter((x) => x.severity <= 1).slice(0, 12).map((x) => `${x.code} ${x.pointer || ''}`) });
  } else gate('6.validator_0_errors', false, 'gltf-validator not found');

  // ---- info
  const imgs = (j.images || []).map((im) => { const bv = j.bufferViews[im.bufferView]; const b = H.g.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); return { name: im.name, mime: im.mimeType, bytes: bv.byteLength, size: webpSize(Buffer.from(b)) || pngSize(Buffer.from(b)) }; });
  const mat = (j.materials || [])[0] || {};
  const texOf = (ref) => { if (!ref) return null; const t = j.textures[ref.index]; const src = t.source ?? t.extensions?.EXT_texture_webp?.source; return src === undefined ? null : imgs[src]; };
  R.info.textures = { baseColor: texOf(mat.pbrMetallicRoughness?.baseColorTexture), metallicRoughness: texOf(mat.pbrMetallicRoughness?.metallicRoughnessTexture), normal: texOf(mat.normalTexture), all: imgs };
  R.info.bytes = H.size; R.info.MiB = +(H.size / 1048576).toFixed(3);
  R.info.triangles = tris; R.info.primitives = prims; R.info.materials = (j.materials || []).length;
  R.info.drawCallsVisible = 'body (1 primitive) + one sword (held or stowed) = 2';
  R.info.bodyTriangles = sd.tris.length; R.info.bodyVertices = sd.N;
  R.info.extensionsUsed = used; R.info.extensionsRequired = req;
  R.info.copyright = j.asset.copyright || null;
  gate('info.copyright_credit', /Pigcraft/.test(j.asset.copyright || '') && /CC BY 4\.0/.test(j.asset.copyright || ''), j.asset.copyright || null);
  R.info.standingHeight_m = (() => { skinFrame(H, sd, worlds(H), buf); let mx = -Infinity; for (let i = 1; i < buf.length; i += 3) mx = Math.max(mx, buf[i]); return +mx.toFixed(4); })();

  R.ok = failed.length === 0; R.failed = failed;
  R.documentedDeviations = Object.fromEntries(failed.filter((k) => DOCUMENTED_DEVIATIONS[k]).map((k) => [k, DOCUMENTED_DEVIATIONS[k]]));
  R.undocumentedFailures = failed.filter((k) => !DOCUMENTED_DEVIATIONS[k]);
  if (a.out) fs.writeFileSync(a.out, JSON.stringify(R, null, 1));
  console.log(JSON.stringify({ ok: R.ok, failed, documented: Object.keys(R.documentedDeviations), undocumented: R.undocumentedFailures, bytes: H.size, triangles: tris, ground: R.gates['4.ground_contact_within_0.015m'].detail.worst_m, kLegSuggested: R.info.kLegSuggested, deform: R.info.deformation && { worstPct: R.info.deformation.worstEdge.stretchPct, worstPlateBorderPct: R.info.deformation.worstPlateEdge.stretchPct, over50: R.info.deformation.edgesOver50pctAnyFrame } }));
  if (R.undocumentedFailures.length || (!R.ok && !a['allow-documented'])) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
