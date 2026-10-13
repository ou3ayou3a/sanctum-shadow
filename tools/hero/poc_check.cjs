// Canary replay check (BUILD-SPEC §6.1.3), adapted from the fp-hero proof-of-concept poc_check.cjs.
//
// Input: the --canary build of the hero (vanguard_Mesh kept as a second skinned mesh, clips transplanted) and
// human.glb. For each of Idle, Walk, Attack_Smite, Death (mid-clip) and TPose (first key) it replays
//   - the HERO's own transplanted channels on the hero, and
//   - human.glb's channels on human.glb,
// then compares every single-bone (w > 0.995) vanguard_Mesh vertex's offset from its own joint origin
// (chamfer, mm). Rotations are identical and offsets are rigid, so the error must be ~0 regardless of the
// hero's bone lengths. Required: worst <= 0.5 mm.
//
// Leg check: the proof of concept required "leg error 0 mm" in absolute position because its legs were not
// lengthened and Hips was unscaled. The hero's thigh/shin are lengthened (x1.009 / x1.073) and Hips is scaled by
// k_leg, so absolute leg positions legitimately differ by centimetres. The invariant that still holds exactly is
// position relative to the Hips joint for UpLeg-bound vertices (UpLeg offsets are unchanged); that is gated at
// <= 0.5 mm. Lower-leg differences are reported for information.
//
// usage: node tools/hero/poc_check.cjs <hero-canary.glb> <human.glb>   (prints JSON; exit 1 on failure)
'use strict';
const G = require('./glb.cjs');

function model(g) {
  const j = g.json, parent = new Array(j.nodes.length).fill(-1);
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
  const byName = {}; j.nodes.forEach((n, i) => (byName[n.name] = i));
  const acc = new Map(); const read = (i) => { if (!acc.has(i)) acc.set(i, G.readAccessor(g, i)); return acc.get(i); };
  return { g, j, parent, byName, read };
}
function worldFor(m, overrides) {
  const W = new Array(m.j.nodes.length);
  const loc = (i) => { const n = m.j.nodes[i], o = overrides[i] || {}; return n.matrix && !overrides[i] ? n.matrix.slice() : G.compose(o.t || n.translation, o.r || n.rotation, o.s || n.scale); };
  const get = (i) => W[i] || (W[i] = m.parent[i] < 0 ? loc(i) : G.mul(get(m.parent[i]), loc(i)));
  m.j.nodes.forEach((_, i) => get(i)); return W;
}
function slerp(a, b, t) { let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map((x) => -x); d = -d; } const o = a.map((x, k) => x + (b[k] - x) * t); const l = Math.hypot(...o); return o.map((x) => x / l); }
function sample(m, anim, ch, t) {
  const s = anim.samplers[ch.sampler]; const tin = m.read(s.input).map((v) => v[0]); const out = m.read(s.output);
  if (t <= tin[0]) return out[0]; if (t >= tin[tin.length - 1]) return out[out.length - 1];
  let i = 0; while (tin[i + 1] < t) i++;
  if (s.interpolation === 'STEP') return out[i];
  const f = (t - tin[i]) / (tin[i + 1] - tin[i]);
  return ch.target.path === 'rotation' ? slerp(out[i], out[i + 1], f) : out[i].map((x, k) => x + (out[i + 1][k] - x) * f);
}
function poseOverrides(m, anim, t) {
  const o = {};
  for (const ch of anim.channels) {
    const idx = ch.target.node; const v = sample(m, anim, ch, t); o[idx] = o[idx] || {};
    if (ch.target.path === 'rotation') o[idx].r = v;
    if (ch.target.path === 'scale') o[idx].s = v;
    if (ch.target.path === 'translation') o[idx].t = v;
  }
  return o;
}
function clipTimes(m, anim) { let best = []; for (const s of anim.samplers) { const t = m.read(s.input).map((v) => v[0]); if (t.length > best.length) best = t; } return best; }
function skinnedSingles(m, W, meshName) {
  const node = m.j.nodes.find((n) => n.name === meshName && n.skin !== undefined);
  if (!node) throw new Error(`${meshName} not found as a skinned mesh`);
  const skin = m.j.skins[node.skin], ibm = m.read(skin.inverseBindMatrices);
  const jm = skin.joints.map((ji, k) => G.mul(W[ji], ibm[k]));
  const hips = G.xform(W[m.byName['mixamorig:Hips']], [0, 0, 0]);
  const out = {};
  for (const p of m.j.meshes[node.mesh].primitives) {
    const P = m.read(p.attributes.POSITION), J = m.read(p.attributes.JOINTS_0), Wt = m.read(p.attributes.WEIGHTS_0);
    for (let i = 0; i < P.length; i++) {
      let k0 = -1; for (let k = 0; k < 4; k++) if (Wt[i][k] > 0.995) k0 = k;
      if (k0 < 0) continue;
      const jIdx = J[i][k0], ji = skin.joints[jIdx], name = m.j.nodes[ji].name;
      const v = G.xform(jm[jIdx], P[i]), o = G.xform(W[ji], [0, 0, 0]);
      (out[name] = out[name] || []).push({ off: G.sub(v, o), rel: G.sub(v, hips) });
    }
  }
  return out;
}
function chamfer(A, Bv, key) { let max = 0, sum = 0; for (const a of A) { let best = Infinity; for (const b of Bv) { const d = G.len(G.sub(a[key], b[key])); if (d < best) best = d; } max = Math.max(max, best); sum += best; } return { mean: +(sum / A.length * 1000).toFixed(3), max: +(max * 1000).toFixed(3) }; }

function check(heroFile, humanFile, { clips = ['Idle', 'Walk', 'Attack_Smite', 'Death', 'TPose'], limitMm = 0.5 } = {}) {
  const h = model(G.readGLB(heroFile)), u = model(G.readGLB(humanFile));
  const res = { hero: heroFile, limitMm, clips: {} };
  const legUpper = ['mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg'];
  const legLower = ['LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightLeg', 'RightFoot', 'RightToeBase'].map((s) => 'mixamorig:' + s);
  let worst = 0, worstUpLeg = 0;
  for (const clip of clips) {
    const aH = h.j.animations.find((a) => a.name === clip), aU = u.j.animations.find((a) => a.name === clip);
    if (!aH || !aU) throw new Error(`clip ${clip} missing`);
    const tin = clipTimes(u, aU);
    const t = clip === 'TPose' ? tin[0] : (tin[0] + tin[tin.length - 1]) / 2;
    const SH = skinnedSingles(h, worldFor(h, poseOverrides(h, aH, t)), 'vanguard_Mesh');
    const SU = skinnedSingles(u, worldFor(u, poseOverrides(u, aU, t)), 'vanguard_Mesh');
    const perBone = {}; let w = 0, wUp = 0; const lower = {};
    for (const b of Object.keys(SH)) {
      if (!SU[b] || SH[b].length < 3) continue;
      const c = chamfer(SH[b], SU[b], 'off'); perBone[b.replace('mixamorig:', '')] = c.max; w = Math.max(w, c.max);
      if (legUpper.includes(b)) wUp = Math.max(wUp, chamfer(SH[b], SU[b], 'rel').max);
      if (legLower.includes(b)) lower[b.replace('mixamorig:', '')] = chamfer(SH[b], SU[b], 'rel').max;
    }
    res.clips[clip] = { t: +t.toFixed(3), bonesCompared: Object.keys(perBone).length, worstRigidOffset_mm: w, upLegRelHips_mm: wUp, lowerLegRelHips_mm_info: lower, perBone };
    worst = Math.max(worst, w); worstUpLeg = Math.max(worstUpLeg, wUp);
  }
  res.worstRigidOffset_mm = worst; res.worstUpLegRelHips_mm = worstUpLeg;
  res.ok = worst <= limitMm && worstUpLeg <= limitMm;
  return res;
}

module.exports = { check };
if (require.main === module) {
  const [heroFile, humanFile] = process.argv.slice(2);
  if (!heroFile || !humanFile) { console.error('usage: poc_check.cjs <hero-canary.glb> <human.glb>'); process.exit(2); }
  const r = check(heroFile, humanFile);
  console.log(JSON.stringify(r, null, 1));
  if (!r.ok) process.exit(1);
}
