// Cape drape corrective for the Fallen Paladin hero (round-2 fix for the "stiff arch" cape at the end of Death).
//
// The cape is one skinned sheet on the 49-joint contract (no cape bones). At the end of Death the pelvis lies ~90 deg
// face-down with the legs locked to it and the torso hanging forward, so ANY linear-blend weighting turns the cape into a
// rigid dome that keeps its standing bell shape 20-45 cm above the prone body. This step adds ONE morph target,
// 'FP_CapeDrape', to the body primitive: a pose-specific corrective computed in the Death END pose:
//   1. skin the body at the last key of Death (same maths as three.js / verify-hero.cjs);
//   2. move every cape vertex toward the nearest torso/leg surface point, stopping OFFSET metres outside it along that
//      point's normal (vertices already closer stay put; the top band that is sewn to the hood/pauldrons is pinned:
//      full effect below y = PIN_Y - PIN_BAND, none above PIN_Y);
//   3. diffuse the displacement over the welded cape graph (ITERS Laplacian passes, pinned vertices fixed) so the
//      sheet moves as a whole and keeps its sculpted folds;
//   3b. RELAX passes of stretch-only edge constraints (rest lengths) in that pose, re-projecting free vertices to OFFSET
//      outside the body every 10 passes: over the hip fold the cape slides up instead of stretching around its outside
//      (worst Death-end cape edge 198 mm -> ~85 mm; human.glb's own body: 97 mm);
//   4. convert each world displacement to bind space with that vertex's own Death-end skinning matrix
//      (delta_bind = (sum_k w_k J_k)^-1 delta_world), so at influence 1 in the Death end pose the cape lands exactly on
//      the drape target whatever its weights are.
// character-actor.js drives the influence only while the actor is in the 'death' state:
//   influence = smoothstep((deathAction.time / duration - RAMP[0]) / (RAMP[1] - RAMP[0]))
// RAMP = [0.15, 0.65]: the spine starts folding at ~15 % and the body is within ~14 deg of its end pose at 65 %, so the
// cape settles onto the body during the fall (a later ramp left a 20-45 cm dome over the body for most of the fall, and the
// mid-fall cape stretch peaked at 173 mm instead of ~110 mm). Every other clip renders with influence 0, i.e. exactly the
// weights from the Blender build.
// No joints, channels or clips change; the morph adds one VEC3 accessor (quantized to int16 by the compression chain).
//
// usage: node tools/hero/cape-drape.mjs --in <anim.glb> --labels <labels.json> --out <out.glb>
//                                        [--offset 0.03] [--iters 24] [--relax 300] [--report <json>]
import fs from 'node:fs';
import path from 'node:path';
import { loadGltfTransform } from './transplant-clips.mjs';

export const DRAPE_TARGET = 'FP_CapeDrape';
export const DRAPE_RAMP = [0.15, 0.65];
const PIN_Y = 1.45, PIN_BAND = 0.15, RELAX_PROJECT = 10;

function parseArgs(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1]; i++; } return o; }
const ss = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
function mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function compose(t, q, s) {
  const [x, y, z, w] = q; const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [(1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0, (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
}
function inv3(m) {   // 3x3 row-major [a b c; d e f; g h i] -> inverse (row-major)
  const [a, b, c, d, e, f, g, h, i] = m; const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g; const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

// Sample one animation at time t (last key when t >= end) -> Map(node -> {t, r, s}).
function sampleAnimation(anim, t) {
  const ov = new Map();
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode(); if (!node) continue;
    const s = ch.getSampler(); const tin = s.getInput().getArray(); const out = s.getOutput().getArray(); const n = tin.length;
    const k = { translation: 3, rotation: 4, scale: 3 }[ch.getTargetPath()]; if (!k) continue;
    let v;
    if (t <= tin[0]) v = Array.from(out.slice(0, k));
    else if (t >= tin[n - 1]) v = Array.from(out.slice((n - 1) * k, n * k));
    else {
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tin[m] <= t) lo = m; else hi = m; }
      const a = Array.from(out.slice(lo * k, lo * k + k)), b = Array.from(out.slice(hi * k, hi * k + k));
      if (s.getInterpolation() === 'STEP') v = a;
      else { let f = (t - tin[lo]) / (tin[hi] - tin[lo]); if (k === 4 && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) for (let i = 0; i < 4; i++) b[i] = -b[i];
        v = a.map((x, i) => x + (b[i] - x) * f); if (k === 4) { const l = Math.hypot(...v); v = v.map((x) => x / l); } }
    }
    const o = ov.get(node) || {}; o[{ translation: 't', rotation: 'r', scale: 's' }[ch.getTargetPath()]] = v; ov.set(node, o);
  }
  return ov;
}
function worldOf(node, ov, cache) {
  if (cache.has(node)) return cache.get(node);
  const o = ov.get(node) || {};
  const L = compose(o.t || node.getTranslation(), o.r || node.getRotation(), o.s || node.getScale());
  const p = node.getParentNode(); const W = p ? mul(worldOf(p, ov, cache), L) : L;
  cache.set(node, W); return W;
}

export function skinMatrices(skin, ov) {
  const cache = new Map(); const ibm = skin.getInverseBindMatrices();
  return skin.listJoints().map((j, k) => mul(worldOf(j, ov, cache), ibm.getElement(k, new Array(16))));
}

export async function addCapeDrape({ inPath, labelsPath, outPath, offset = 0.03, iters = 24, relax = 300, slack = 0.3, reportPath }) {
  const GT = await loadGltfTransform();
  const io = new GT.NodeIO().registerExtensions(GT.ALL_EXTENSIONS);
  const doc = await io.read(inPath); const root = doc.getRoot();
  const bodyNode = root.listNodes().find((n) => n.getSkin() && n.getMesh());
  if (!bodyNode) throw new Error('no skinned body node');
  const mesh = bodyNode.getMesh(); const prims = mesh.listPrimitives();
  if (prims.length !== 1) throw new Error(`expected 1 body primitive, got ${prims.length}`);
  const prim = prims[0];
  if (prim.listTargets().length) throw new Error('body primitive already has morph targets');
  const P = prim.getAttribute('POSITION').getArray(), Nrm = prim.getAttribute('NORMAL').getArray();
  const Jt = prim.getAttribute('JOINTS_0').getArray(), Wt = prim.getAttribute('WEIGHTS_0').getArray();
  const N = P.length / 3; const skin = bodyNode.getSkin();
  const death = root.listAnimations().find((a) => a.getName() === 'Death');
  if (!death) throw new Error('Death clip missing (run after transplant-clips.mjs)');
  let tEnd = 0; for (const s of death.listSamplers()) { const a = s.getInput().getArray(); tEnd = Math.max(tEnd, a[a.length - 1]); }
  const J = skinMatrices(skin, sampleAnimation(death, tEnd));

  // Death-end skinned positions/normals and per-vertex 3x3 skinning matrices.
  const PP = new Float64Array(N * 3), NN = new Float64Array(N * 3), M3 = new Float64Array(N * 9);
  for (let i = 0; i < N; i++) {
    const m = new Array(12).fill(0); let ws = 0;
    for (let k = 0; k < 4; k++) { const w = Wt[i * 4 + k]; if (!w) continue; ws += w; const A = J[Jt[i * 4 + k]]; for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) m[c * 3 + r] += w * A[c * 4 + r]; }
    for (let c = 0; c < 12; c++) m[c] /= ws;
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    PP[i * 3] = m[0] * x + m[3] * y + m[6] * z + m[9]; PP[i * 3 + 1] = m[1] * x + m[4] * y + m[7] * z + m[10]; PP[i * 3 + 2] = m[2] * x + m[5] * y + m[8] * z + m[11];
    const nx = Nrm[i * 3], ny = Nrm[i * 3 + 1], nz = Nrm[i * 3 + 2];
    let qx = m[0] * nx + m[3] * ny + m[6] * nz, qy = m[1] * nx + m[4] * ny + m[7] * nz, qz = m[2] * nx + m[5] * ny + m[8] * nz; const l = Math.hypot(qx, qy, qz) || 1;
    NN[i * 3] = qx / l; NN[i * 3 + 1] = qy / l; NN[i * 3 + 2] = qz / l;
    // row-major 3x3 of the linear part
    M3.set([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]], i * 9);
  }

  // Labels (glTF world rest positions == POSITION, bind is identity): cape region and torso/leg segment.
  const L = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const capeId = L.region_names.indexOf('cape'); if (capeId < 0) throw new Error('labels have no cape region');
  const key = (x, y, z) => `${Math.round(x * 2000)},${Math.round(y * 2000)},${Math.round(z * 2000)}`;
  const grid = new Map(); for (let q = 0; q < L.positions.length / 3; q++) { const k = key(L.positions[q * 3], L.positions[q * 3 + 1], L.positions[q * 3 + 2]); if (!grid.has(k)) grid.set(k, q); }
  const isCape = new Uint8Array(N), isBody = new Uint8Array(N); let unmatched = 0;
  for (let i = 0; i < N; i++) {
    const cx = Math.round(P[i * 3] * 2000), cy = Math.round(P[i * 3 + 1] * 2000), cz = Math.round(P[i * 3 + 2] * 2000); let q;
    for (let dx = -1; dx <= 1 && q === undefined; dx++) for (let dy = -1; dy <= 1 && q === undefined; dy++) for (let dz = -1; dz <= 1 && q === undefined; dz++) q = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
    if (q === undefined) { unmatched++; continue; }
    if (L.region[q] === capeId) isCape[i] = 1; else if (L.segment[q] === 0) isBody[i] = 1;
  }
  const capeIdx = [], bodyIdx = []; for (let i = 0; i < N; i++) { if (isCape[i]) capeIdx.push(i); else if (isBody[i]) bodyIdx.push(i); }

  // Nearest torso/leg surface point in the Death end pose -> drape target.
  const C = capeIdx.length; const D = new Float64Array(C * 3); const pin = new Float64Array(C); const gap0 = new Float64Array(C);
  for (let c = 0; c < C; c++) {
    const i = capeIdx[c]; const x = PP[i * 3], y = PP[i * 3 + 1], z = PP[i * 3 + 2]; let best = Infinity, bj = -1;
    for (const j of bodyIdx) { const dx = PP[j * 3] - x, dy = PP[j * 3 + 1] - y, dz = PP[j * 3 + 2] - z; const d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; bj = j; } }
    const d = Math.sqrt(best); gap0[c] = d;
    pin[c] = ss((PIN_Y - P[i * 3 + 1]) / PIN_BAND);          // rest height (glTF Y up): 0 = sewn to the hood, 1 = free
    const ox = x - PP[bj * 3], oy = y - PP[bj * 3 + 1], oz = z - PP[bj * 3 + 2];
    const outside = ox * NN[bj * 3] + oy * NN[bj * 3 + 1] + oz * NN[bj * 3 + 2];
    if (d <= offset || outside <= 0) continue;               // already on the body (or on its inner side): leave it
    const tx = PP[bj * 3] + NN[bj * 3] * offset, ty = PP[bj * 3 + 1] + NN[bj * 3 + 1] * offset, tz = PP[bj * 3 + 2] + NN[bj * 3 + 2] * offset;
    D[c * 3] = (tx - x) * pin[c]; D[c * 3 + 1] = (ty - y) * pin[c]; D[c * 3 + 2] = (tz - z) * pin[c];
  }
  // Diffuse over the welded cape graph (UV seams are split vertices at one position: weld by rounded rest position).
  const wk = new Map(); const weld = new Int32Array(C);
  for (let c = 0; c < C; c++) { const i = capeIdx[c]; const k = `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)}`; if (!wk.has(k)) wk.set(k, wk.size); weld[c] = wk.get(k); }
  const nw = wk.size; const local = new Int32Array(N).fill(-1); capeIdx.forEach((i, c) => (local[i] = c));
  const idx = prim.getIndices().getArray(); const edges = new Set();
  for (let t = 0; t < idx.length; t += 3) for (const [u, v] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
    if (local[u] < 0 || local[v] < 0) continue; const a = weld[local[u]], b = weld[local[v]]; if (a === b) continue; edges.add(a < b ? a * nw + b : b * nw + a);
  }
  const E = [...edges].map((k) => [Math.floor(k / nw), k % nw]);
  const Dw = new Float64Array(nw * 3), cnt = new Float64Array(nw), fixed = new Uint8Array(nw), deg = new Float64Array(nw);
  for (let c = 0; c < C; c++) { const w = weld[c]; for (let k = 0; k < 3; k++) Dw[w * 3 + k] += D[c * 3 + k]; cnt[w]++; if (pin[c] < 1e-3) fixed[w] = 1; }
  for (let w = 0; w < nw; w++) for (let k = 0; k < 3; k++) Dw[w * 3 + k] /= cnt[w];
  for (const [a, b] of E) { deg[a]++; deg[b]++; }
  for (let it = 0; it < iters; it++) {
    const acc = new Float64Array(nw * 3);
    for (const [a, b] of E) for (let k = 0; k < 3; k++) { acc[a * 3 + k] += Dw[b * 3 + k]; acc[b * 3 + k] += Dw[a * 3 + k]; }
    for (let w = 0; w < nw; w++) if (!fixed[w]) for (let k = 0; k < 3; k++) Dw[w * 3 + k] = (Dw[w * 3 + k] + acc[w * 3 + k]) / (1 + deg[w]);
  }
  // Stretch relaxation in the Death end pose (position-based, stretch-only edge constraints on the welded cape graph):
  // a cape lying over the hip fold must slide up rather than stretch around its outside. Pinned (hood) vertices and the
  // non-cape vertices the cape is sewn to stay where the skin puts them; every RELAX_PROJECT passes each free vertex is
  // pushed back to at least OFFSET outside its nearest torso/leg vertex (re-found, along that vertex's normal).
  if (relax > 0) {
    const X = new Float64Array(nw * 3), R0 = new Map(), restW = new Float64Array(nw * 3), cntW = new Float64Array(nw);
    for (let c = 0; c < C; c++) { const i = capeIdx[c], w = weld[c]; for (let k = 0; k < 3; k++) { restW[w * 3 + k] += P[i * 3 + k]; X[w * 3 + k] += PP[i * 3 + k]; } cntW[w]++; }
    for (let w = 0; w < nw; w++) for (let k = 0; k < 3; k++) { restW[w * 3 + k] /= cntW[w]; X[w * 3 + k] = X[w * 3 + k] / cntW[w] + Dw[w * 3 + k]; }
    const rl = E.map(([a, b]) => Math.hypot(restW[a * 3] - restW[b * 3], restW[a * 3 + 1] - restW[b * 3 + 1], restW[a * 3 + 2] - restW[b * 3 + 2]));
    // edges from free cape vertices to the (fixed, skinned) non-cape vertices they are sewn to
    const sewn = []; for (let t = 0; t < idx.length; t += 3) for (const [u, v] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      if ((local[u] >= 0) === (local[v] >= 0)) continue; const cv = local[u] >= 0 ? u : v, ov = cv === u ? v : u;
      sewn.push([weld[local[cv]], ov, Math.hypot(P[cv * 3] - P[ov * 3], P[cv * 3 + 1] - P[ov * 3 + 1], P[cv * 3 + 2] - P[ov * 3 + 2])]); }
    // Relaxation pins: everything sewn to / near the hood (pin < 0.5) holds; only fully free vertices are re-projected.
    const hold = new Uint8Array(nw), free = new Uint8Array(nw).fill(1);
    for (let c = 0; c < C; c++) { if (pin[c] < 0.5) hold[weld[c]] = 1; if (pin[c] < 0.99) free[weld[c]] = 0; }
    const project = () => { for (let w = 0; w < nw; w++) { if (!free[w]) continue; const x = X[w * 3], y = X[w * 3 + 1], z = X[w * 3 + 2]; let best = Infinity, bj = -1;
      for (const j of bodyIdx) { const d = (PP[j * 3] - x) ** 2 + (PP[j * 3 + 1] - y) ** 2 + (PP[j * 3 + 2] - z) ** 2; if (d < best) { best = d; bj = j; } }
      const s = (x - PP[bj * 3]) * NN[bj * 3] + (y - PP[bj * 3 + 1]) * NN[bj * 3 + 1] + (z - PP[bj * 3 + 2]) * NN[bj * 3 + 2];
      if (s < offset) { const k = offset - s; X[w * 3] += NN[bj * 3] * k; X[w * 3 + 1] += NN[bj * 3 + 1] * k; X[w * 3 + 2] += NN[bj * 3 + 2] * k; } } };
    for (let it = 0; it < relax; it++) {
      E.forEach(([a, b], e) => { const dx = X[b * 3] - X[a * 3], dy = X[b * 3 + 1] - X[a * 3 + 1], dz = X[b * 3 + 2] - X[a * 3 + 2]; const d = Math.hypot(dx, dy, dz); const lim = rl[e] * (1 + slack); if (d <= lim || d < 1e-9) return;
        if (hold[a] && hold[b]) return; const fa = hold[a] ? 0 : hold[b] ? 1 : 0.5, fb = hold[b] ? 0 : hold[a] ? 1 : 0.5; const k = (d - lim) / d;
        X[a * 3] += dx * k * fa; X[a * 3 + 1] += dy * k * fa; X[a * 3 + 2] += dz * k * fa; X[b * 3] -= dx * k * fb; X[b * 3 + 1] -= dy * k * fb; X[b * 3 + 2] -= dz * k * fb; });
      for (const [w, ov, r0] of sewn) { if (hold[w]) continue; const dx = PP[ov * 3] - X[w * 3], dy = PP[ov * 3 + 1] - X[w * 3 + 1], dz = PP[ov * 3 + 2] - X[w * 3 + 2]; const d = Math.hypot(dx, dy, dz); const lim = r0 * (1 + slack); if (d <= lim) continue; const k = (d - lim) / d; X[w * 3] += dx * k; X[w * 3 + 1] += dy * k; X[w * 3 + 2] += dz * k; }
      if ((it + 1) % RELAX_PROJECT === 0 || it === relax - 1) project();
    }
    const rep = new Int32Array(nw).fill(-1); for (let c = 0; c < C; c++) if (rep[weld[c]] < 0) rep[weld[c]] = capeIdx[c];
    for (let w = 0; w < nw; w++) { if (hold[w]) continue; const i = rep[w]; Dw[w * 3] = X[w * 3] - PP[i * 3]; Dw[w * 3 + 1] = X[w * 3 + 1] - PP[i * 3 + 1]; Dw[w * 3 + 2] = X[w * 3 + 2] - PP[i * 3 + 2]; }
  }
  // World displacement -> bind-space morph delta through each vertex's Death-end skinning matrix.
  const delta = new Float32Array(N * 3); let moved = 0, maxBind = 0, maxWorld = 0;
  for (let c = 0; c < C; c++) {
    const i = capeIdx[c]; const w = weld[c]; const dx = Dw[w * 3], dy = Dw[w * 3 + 1], dz = Dw[w * 3 + 2];
    const dl = Math.hypot(dx, dy, dz); if (dl < 1e-5) continue;
    const Mi = inv3(Array.from(M3.subarray(i * 9, i * 9 + 9)));
    const bx = Mi[0] * dx + Mi[1] * dy + Mi[2] * dz, by = Mi[3] * dx + Mi[4] * dy + Mi[5] * dz, bz = Mi[6] * dx + Mi[7] * dy + Mi[8] * dz;
    delta[i * 3] = bx; delta[i * 3 + 1] = by; delta[i * 3 + 2] = bz; moved++; maxBind = Math.max(maxBind, Math.hypot(bx, by, bz)); maxWorld = Math.max(maxWorld, dl);
  }
  // Death-end gap after the drape (influence 1), for the report.
  const gap1 = []; for (let c = 0; c < C; c += 2) {
    const i = capeIdx[c]; const w = weld[c]; const x = PP[i * 3] + Dw[w * 3], y = PP[i * 3 + 1] + Dw[w * 3 + 1], z = PP[i * 3 + 2] + Dw[w * 3 + 2]; let best = Infinity;
    for (let b = 0; b < bodyIdx.length; b += 2) { const j = bodyIdx[b]; const d = (PP[j * 3] - x) ** 2 + (PP[j * 3 + 1] - y) ** 2 + (PP[j * 3 + 2] - z) ** 2; if (d < best) best = d; }
    gap1.push(Math.sqrt(best)); }
  // Worst cape-edge elongation at the Death end, without / with the drape (edges touching a cape vertex; rest = POSITION).
  const edgeStats = (withDrape) => { let worst = { mm: 0 }; const seen = new Set();
    for (let t = 0; t < idx.length; t += 3) for (const [u, v] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      if (!isCape[u] && !isCape[v]) continue; const k = u < v ? u * N + v : v * N + u; if (seen.has(k)) continue; seen.add(k);
      const r0 = Math.hypot(P[u * 3] - P[v * 3], P[u * 3 + 1] - P[v * 3 + 1], P[u * 3 + 2] - P[v * 3 + 2]);
      const pu = [0, 1, 2].map((c) => PP[u * 3 + c] + (withDrape && isCape[u] ? Dw[weld[local[u]] * 3 + c] : 0)), pv = [0, 1, 2].map((c) => PP[v * 3 + c] + (withDrape && isCape[v] ? Dw[weld[local[v]] * 3 + c] : 0));
      const el = (Math.hypot(pu[0] - pv[0], pu[1] - pv[1], pu[2] - pv[2]) - r0) * 1000;
      if (el > worst.mm) worst = { mm: +el.toFixed(1), restLength_cm: +(r0 * 100).toFixed(1), restY: [+P[u * 3 + 1].toFixed(2), +P[v * 3 + 1].toFixed(2)], restX: [+P[u * 3].toFixed(2), +P[v * 3].toFixed(2)] };
    } return worst; };
  const deathEdge = { withoutDrape: edgeStats(false), withDrape: edgeStats(true) };
  const pct = (arr, p) => { const s = Array.from(arr).sort((a, b) => a - b); return +(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 100).toFixed(1); };

  const buffer = root.listBuffers()[0];
  const acc = doc.createAccessor(`${DRAPE_TARGET}_POSITION`).setType('VEC3').setArray(delta).setBuffer(buffer);
  const target = doc.createPrimitiveTarget(DRAPE_TARGET).setAttribute('POSITION', acc);
  prim.addTarget(target);
  mesh.setWeights([0]);
  mesh.setExtras({ ...(mesh.getExtras() || {}), targetNames: [DRAPE_TARGET] });
  await io.write(outPath, doc);
  const report = { in: inPath, out: outPath, target: DRAPE_TARGET, ramp: DRAPE_RAMP, offset_m: offset, iterations: iters, relaxIterations: relax, stretchSlack: slack, pin: { y: PIN_Y, band: PIN_BAND },
    deathEndTime: +tEnd.toFixed(4), capeVertices: C, bodyTargetVertices: bodyIdx.length, unmatchedLabelVertices: unmatched, movedVertices: moved,
    maxWorldDisplacement_m: +maxWorld.toFixed(4), maxBindDelta_m: +maxBind.toFixed(4),
    deathEndWorstCapeEdgeElongation: deathEdge,
    deathEndCapeGap_cm: { before: { median: pct(gap0, 0.5), p90: pct(gap0, 0.9), max: pct(gap0, 0.9999) }, after: { median: pct(gap1, 0.5), p90: pct(gap1, 0.9), max: pct(gap1, 0.9999) } } };
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const a = parseArgs(process.argv.slice(2));
  if (!a.in || !a.labels || !a.out) { console.error('usage: cape-drape.mjs --in <anim.glb> --labels <labels.json> --out <out.glb> [--offset 0.03] [--iters 24] [--relax 300] [--report json]'); process.exit(2); }
  addCapeDrape({ inPath: a.in, labelsPath: a.labels, outPath: a.out, offset: Number(a.offset ?? 0.03), iters: Number(a.iters ?? 24), relax: Number(a.relax ?? 300), slack: Number(a.slack ?? 0.3), reportPath: a.report })
    .then((r) => console.log(JSON.stringify({ moved: r.movedVertices, cape: r.capeVertices, unmatched: r.unmatchedLabelVertices, gap: r.deathEndCapeGap_cm, edge_mm: [r.deathEndWorstCapeEdgeElongation.withoutDrape.mm, r.deathEndWorstCapeEdgeElongation.withDrape.mm], maxWorld: r.maxWorldDisplacement_m })))
    .catch((e) => { console.error(e); process.exit(1); });
}
