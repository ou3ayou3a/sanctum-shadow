// Minimal read-only GLB parser + math helpers (no deps). Copied from the fp-hero proof-of-concept (spec §6.1).
'use strict';
const fs = require('fs');

function readGLB(file) {
  const b = fs.readFileSync(file);
  if (b.toString('utf8', 0, 4) !== 'glTF') throw new Error('not GLB: ' + file);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.toString('utf8', off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 'JSON') json = JSON.parse(data.toString('utf8'));
    else if (type.startsWith('BIN')) bin = data;
    off += 8 + len;
  }
  return { json, bin, size: b.length };
}

const COMP = { 5120: [1, 'getInt8', 127], 5121: [1, 'getUint8', 255], 5122: [2, 'getInt16', 32767], 5123: [2, 'getUint16', 65535], 5125: [4, 'getUint32', 4294967295], 5126: [4, 'getFloat32', 1] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function readAccessor(g, idx) {
  const { json, bin } = g; const a = json.accessors[idx];
  const n = NCOMP[a.type]; const [cs, fn, max] = COMP[a.componentType];
  const out = new Array(a.count);
  if (a.bufferView === undefined) { for (let i = 0; i < a.count; i++) out[i] = new Array(n).fill(0); }
  else {
    const bv = json.bufferViews[a.bufferView];
    const stride = bv.byteStride || cs * n;
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    for (let i = 0; i < a.count; i++) {
      const v = new Array(n);
      for (let c = 0; c < n; c++) {
        let x = dv[fn](base + i * stride + c * cs, true);
        if (a.normalized) x = a.componentType === 5126 ? x : Math.max(x / max, -1);
        v[c] = x;
      }
      out[i] = v;
    }
  }
  if (a.sparse) throw new Error('sparse accessor not handled');
  return out;
}

// column-major 4x4 like glTF
function ident() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function compose(t = [0,0,0], q = [0,0,0,1], s = [1,1,1]) {
  const [x, y, z, w] = q; const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  return [ (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
           (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
           (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
           t[0], t[1], t[2], 1 ];
}
function localMatrix(n) { return n.matrix ? n.matrix.slice() : compose(n.translation, n.rotation, n.scale); }
function xform(m, p) { const [x, y, z] = p; return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]]; }
function xdir(m, d) { const [x, y, z] = d; return [m[0]*x+m[4]*y+m[8]*z, m[1]*x+m[5]*y+m[9]*z, m[2]*x+m[6]*y+m[10]*z]; }
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
function r(v, d = 4) { return Array.isArray(v) ? v.map(x => r(x, d)) : (typeof v === 'number' ? +v.toFixed(d) : v); }
function quatToEulerDeg(q) { // XYZ intrinsic -> report as rotation about axes (deg), approximate for display
  const [x, y, z, w] = q;
  const sinr = 2 * (w * x + y * z), cosr = 1 - 2 * (x * x + y * y);
  const sinp = 2 * (w * y - z * x);
  const siny = 2 * (w * z + x * y), cosy = 1 - 2 * (y * y + z * z);
  return [Math.atan2(sinr, cosr), Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp), Math.atan2(siny, cosy)].map(a => +(a * 180 / Math.PI).toFixed(3));
}
function maxAbsDiffIdent(m) { const I = ident(); let d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(m[i] - I[i])); return d; }

function buildWorld(json) {
  const parent = new Array(json.nodes.length).fill(-1);
  json.nodes.forEach((n, i) => (n.children || []).forEach(c => (parent[c] = i)));
  const world = new Array(json.nodes.length);
  const get = i => world[i] || (world[i] = parent[i] < 0 ? localMatrix(json.nodes[i]) : mul(get(parent[i]), localMatrix(json.nodes[i])));
  json.nodes.forEach((_, i) => get(i));
  return { parent, world };
}

module.exports = { readGLB, readAccessor, ident, mul, compose, localMatrix, xform, xdir, sub, len, norm, r, quatToEulerDeg, maxAbsDiffIdent, buildWorld };
