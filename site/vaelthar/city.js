/* =========================================================================
   city.js — VAELTHAR, THE FRACTURED CAPITAL (procedural geometry)
   -------------------------------------------------------------------------
   Builds the walkable cobbled square and every building from primitives,
   exactly the modeling approach of the Character Creator. No external
   textures: cobble / banner / parchment surfaces are drawn to a <canvas>
   in code and used as CanvasTextures.

   Coordinate convention:  +X = east,  +Z = south,  -Z = north (the Gate).
   The player spawns at (0,0). Camera rests to the south looking north.
   ========================================================================= */
import * as THREE from 'three';
import { mat, mesh, box, cyl, sphere } from './charbuilder.js';

/* ---- palette (the game's identity) ---- */
export const PAL = {
  ink: 0x0c0a08, gold: 0xc9a24b, goldBright: 0xe7c977, goldDeep: 0x8c6d2a,
  crimson: 0x7c2a23, parch: 0xe8dcc0, leather: 0x5a3c24,
  stone: 0x6f6a60, stoneDark: 0x4a463e, stoneLight: 0x8b8576, stoneCold: 0x575a5e,
  timber: 0x3c2c1c, timberLight: 0x6a4c30, slate: 0x39383c, churchWhite: 0xe8dcc0,
};

/* ====================== procedural canvas textures ====================== */
function noise(c, x, y, w, h, a) {
  const img = c.getImageData(x, y, w, h); const dd = img.data;
  for (let i = 0; i < dd.length; i += 4) { const n = (Math.random() - 0.5) * a; dd[i] += n; dd[i+1] += n; dd[i+2] += n; }
  c.putImageData(img, x, y);
}
function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

let _cobble;
export function cobbleTexture() {
  if (_cobble) return _cobble;
  const s = 512, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  c.fillStyle = '#1c1813'; c.fillRect(0, 0, s, s); // grout
  const cols = 9, rows = 9, cw = s / cols, ch = s / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const ox = (j % 2) * cw * 0.5;
      const cx = i * cw + ox + cw * 0.5 + (Math.random() - 0.5) * 6;
      const cy = j * ch + ch * 0.5 + (Math.random() - 0.5) * 6;
      const rw = cw * (0.40 + Math.random() * 0.08), rh = ch * (0.40 + Math.random() * 0.08);
      const g = 0x36 + Math.floor(Math.random() * 0x18);
      c.fillStyle = `rgb(${g+6},${g+2},${g-6})`;
      c.beginPath();
      c.ellipse(cx, cy, rw, rh, (Math.random() - 0.5) * 0.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgba(0,0,0,0.25)`;
      c.beginPath(); c.ellipse(cx + 1.5, cy + 2, rw, rh, 0, 0, Math.PI * 2); c.fill();
    }
  }
  noise(c, 0, 0, s, s, 26);
  _cobble = new THREE.CanvasTexture(cv);
  _cobble.wrapS = _cobble.wrapT = THREE.RepeatWrapping;
  _cobble.repeat.set(10, 10);
  _cobble.anisotropy = 4;
  return _cobble;
}

// torn white Church banner with the Eternal Flame emblem; bottom edge ragged + transparent
export function bannerTexture(torn = true) {
  const w = 192, h = 384, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, w, h);
  // cloth body (parchment white), ragged bottom if torn
  c.fillStyle = '#e8dcc0';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0);
  if (torn) {
    let y = h * 0.62;
    c.lineTo(w, y);
    for (let x = w; x >= 0; x -= w / 7) {
      y = h * (0.5 + Math.random() * 0.34);
      c.lineTo(x, y);
    }
  } else { c.lineTo(w, h); c.lineTo(0, h); }
  c.lineTo(0, torn ? h * 0.55 : h); c.closePath(); c.fill();
  // shading + soil
  const grad = c.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(255,255,255,0.12)'); grad.addColorStop(1, 'rgba(60,40,20,0.32)');
  c.fillStyle = grad; c.fill();
  // crimson border bands
  c.strokeStyle = '#7c2a23'; c.lineWidth = 10;
  c.beginPath(); c.moveTo(14, 6); c.lineTo(14, h * 0.5); c.moveTo(w - 14, 6); c.lineTo(w - 14, h * 0.5); c.stroke();
  // Eternal Flame emblem (gold teardrop flame)
  c.fillStyle = '#c9a24b';
  c.beginPath();
  c.moveTo(w / 2, h * 0.1);
  c.bezierCurveTo(w * 0.78, h * 0.22, w * 0.74, h * 0.40, w / 2, h * 0.46);
  c.bezierCurveTo(w * 0.26, h * 0.40, w * 0.22, h * 0.22, w / 2, h * 0.1);
  c.fill();
  c.fillStyle = '#7c2a23';
  c.beginPath(); c.ellipse(w / 2, h * 0.31, w * 0.07, h * 0.06, 0, 0, Math.PI * 2); c.fill();
  noise(c, 0, 0, w, h, 14);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

// nailed proclamation parchment with ink scrawl
let _proc;
export function proclamationTexture() {
  if (_proc) return _proc;
  const w = 128, h = 160, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#d8c9a4'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(90,60,30,0.18)'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8);
  c.fillStyle = '#3a2c1a';
  c.font = 'bold 17px serif'; c.textAlign = 'center';
  c.fillText('BY ORDER OF', w / 2, 26); c.fillText('THE CROWN', w / 2, 44);
  c.strokeStyle = '#4a3823'; c.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const y = 62 + i * 12; c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14 - Math.random() * 20, y); c.stroke(); }
  // red wax seal
  c.fillStyle = '#7c2a23'; c.beginPath(); c.arc(w / 2, h - 26, 13, 0, Math.PI * 2); c.fill();
  noise(c, 0, 0, w, h, 18);
  _proc = new THREE.CanvasTexture(cv); _proc.anisotropy = 4; return _proc;
}

/* ====================== stone material helpers ====================== */
const stone = (col = PAL.stone, rough = 0.95) => mat(hex(col), { rough, metal: 0 });
const woodMat = (col = PAL.timber) => mat(hex(col), { rough: 0.9 });

/* a chunky stone block that casts/receives shadow */
function block(w, h, d, col, rough) { return box(w, h, d, stone(col, rough)); }

/* ====================== building pieces ====================== */
// crenellated wall top
function crenellate(parent, w, y, d, col) {
  const n = Math.max(2, Math.round(w / 0.7));
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const m = block(w / n * 0.92, 0.5, d, col); m.position.set(-w / 2 + (i + 0.5) * (w / n), y, 0); parent.add(m);
  }
}

// torn banner hung from a bar at (x,y,z), facing +z by default
function tornBanner(parent, x, y, z, ry = 0, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  const tex = bannerTexture(true);
  const mt = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, side: THREE.DoubleSide, alphaTest: 0.35 });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1 * scale, 2.2 * scale), mt);
  cloth.position.y = -1.1 * scale; cloth.castShadow = false; cloth.receiveShadow = true;
  // slight slump/curl
  cloth.rotation.x = 0.04;
  g.add(cloth);
  // hanging bar
  const bar = cyl(0.05, 0.05, 1.3 * scale, mat(hex(PAL.timberLight), { rough: 0.8 }), 6); bar.rotation.z = Math.PI / 2; g.add(bar);
  parent.add(g);
  return g;
}

// Eternal Flame torch sconce — returns its flame position for FX lights
function flameSconce(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const bracket = box(0.12, 0.5, 0.12, mat('#2b2722', { rough: 0.6, metal: 0.5 })); g.add(bracket);
  const cup = cyl(0.16, 0.1, 0.2, mat('#2b2722', { rough: 0.5, metal: 0.6 })); cup.position.y = 0.32; g.add(cup);
  const flame = mesh(new THREE.ConeGeometry(0.12, 0.42, 6), mat('#ffae3b', { rough: 0.4, emissive: 0xff7a1a, emi: 2.4 })); flame.position.y = 0.58; g.add(flame);
  const inner = mesh(new THREE.ConeGeometry(0.06, 0.24, 5), mat('#ffe39a', { emissive: 0xffd060, emi: 3 })); inner.position.y = 0.6; g.add(inner);
  parent.add(g);
  return { group: g, flame, worldPos: new THREE.Vector3(x, y + 0.58, z) };
}

/* ====================== THE CITY ====================== */
export function buildCity() {
  const root = new THREE.Group();
  const obstacles = [];   // {x,z,hw,hd} axis-aligned blockers (XZ)
  const braziers = [];    // {worldPos, flame, kind} for flicker lights
  const doors = [];       // {id, kind, position:Vector3, label, locationId?}
  const labels = [];      // {position:Vector3, text, sub} static world signs

  const addObstacle = (x, z, hw, hd) => obstacles.push({ x, z, hw, hd });

  /* ---------- ground: cobbled plaza ---------- */
  const groundMat = new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 1, metalness: 0, color: 0x8a8276 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);

  // darker outer dirt ring beyond the plaza
  const dirt = new THREE.Mesh(new THREE.RingGeometry(34, 60, 48), mat('#15110c', { rough: 1 }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.01; dirt.receiveShadow = true; root.add(dirt);

  /* ====================================================================
     CENTER — defaced Covenant monument / fountain
     ==================================================================== */
  const mon = new THREE.Group(); root.add(mon);
  const fountBase = cyl(3.0, 3.3, 0.4, stone(PAL.stoneLight, 0.9), 12); fountBase.position.y = 0.2; mon.add(fountBase);
  const fountInner = cyl(2.5, 2.6, 0.46, mat('#26201a', { rough: 0.9 }), 12); fountInner.position.y = 0.27; mon.add(fountInner);
  const water = mesh(new THREE.CircleGeometry(2.5, 24), mat('#2a3a3e', { rough: 0.2, metal: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.42; mon.add(water);
  // cracked central pillar (Covenant memorial), tilted + broken top
  const plinth = block(1.3, 0.7, 1.3, PAL.stoneLight, 0.9); plinth.position.y = 0.75; mon.add(plinth);
  const col1 = block(0.9, 2.4, 0.9, PAL.stoneLight, 0.85); col1.position.set(0, 2.1, 0); mon.add(col1);
  const col2 = block(0.8, 1.0, 0.8, PAL.stoneLight, 0.85); col2.position.set(0.12, 3.5, 0); col2.rotation.z = 0.16; mon.add(col2);
  // shattered top stone fallen into the basin
  const shard = mesh(new THREE.DodecahedronGeometry(0.5), stone(PAL.stoneLight, 0.9)); shard.position.set(1.7, 0.55, 0.6); shard.rotation.set(0.4, 0.6, 0.3); mon.add(shard);
  const shard2 = mesh(new THREE.DodecahedronGeometry(0.32), stone(PAL.stoneLight, 0.9)); shard2.position.set(-1.4, 0.5, 1.2); mon.add(shard2);
  // defaced crimson slash across the memorial
  const slash = box(0.06, 1.8, 0.95, mat(hex(PAL.crimson), { rough: 0.7 })); slash.position.set(0.46, 2.1, 0); slash.rotation.z = -0.5; mon.add(slash);
  addObstacle(0, 0, 1.8, 1.8);
  labels.push({ position: new THREE.Vector3(0, 4.4, 0), text: 'THE COVENANT STONE', sub: 'defaced · three days past' });

  /* ====================================================================
     NORTH — Thornwood Gate (large stone gate, torn banners, exit)
     ==================================================================== */
  const gate = new THREE.Group(); gate.position.set(0, 0, -22); root.add(gate);
  for (const sx of [-1, 1]) {
    const tower = block(3.4, 9.5, 3.4, PAL.stoneCold, 0.95); tower.position.set(sx * 4.4, 4.75, 0); gate.add(tower);
    crenellate(tower, 3.4, 9.9, 3.4, PAL.stoneCold);
    // arrow slit
    const slit = box(0.4, 1.6, 0.2, mat('#0a0908', { rough: 1 })); slit.position.set(sx * 4.4, 6, 1.7); gate.add(slit);
    addObstacle(sx * 4.4, -22, 1.7, 1.7);
  }
  // arch lintel
  const lintel = block(6.4, 1.8, 3.0, PAL.stoneCold, 0.95); lintel.position.set(0, 7.6, 0); gate.add(lintel);
  const archInner = mesh(new THREE.CylinderGeometry(2.6, 2.6, 3.0, 16, 1, true, 0, Math.PI), mat('#0a0908', { rough: 1 })); archInner.rotation.z = Math.PI / 2; archInner.rotation.y = Math.PI / 2; archInner.position.set(0, 5.0, 0); gate.add(archInner);
  // portcullis bars (raised)
  for (let i = -2; i <= 2; i++) { const b = cyl(0.08, 0.08, 2.2, mat('#1a1814', { rough: 0.5, metal: 0.6 }), 6); b.position.set(i * 0.9, 7.0, 1.3); gate.add(b); }
  // torn white banners from the gate posts
  tornBanner(gate, -4.4, 6.8, 1.85, 0, 1.1);
  tornBanner(gate, 4.4, 6.6, 1.85, 0, 1.0);
  // dark road beyond the arch + glowing exit
  const road = mesh(new THREE.PlaneGeometry(5, 16), mat('#0e0b07', { rough: 1 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -30); gate.add(road);
  doors.push({ id: 'thornwood_gate', kind: 'exit', position: new THREE.Vector3(0, 0, -25), label: 'Thornwood Gate', sub: 'Leave the city · the Thornwood', locationId: 'thornwood_gate' });
  labels.push({ position: new THREE.Vector3(0, 9.6, -22), text: 'THORNWOOD GATE', sub: 'the north road' });

  /* ====================================================================
     EAST — Cathedral of the Eternal Flame (tall, flame motif, 1 torn banner)
     ==================================================================== */
  const cath = new THREE.Group(); cath.position.set(19, 0, -7); root.add(cath);
  const nave = block(8, 11, 11, PAL.stoneLight, 0.92); nave.position.set(1.5, 5.5, 0); cath.add(nave);
  // gabled roof
  const roof = mesh(new THREE.CylinderGeometry(0.01, 4.2, 12, 3), mat(hex(PAL.slate), { rough: 0.85 })); roof.rotation.z = 0; roof.position.set(1.5, 13.0, 0); roof.scale.set(1, 1, 1.0); cath.add(roof);
  // tall spire/tower at front
  const tower = block(4.2, 17, 4.2, PAL.stoneLight, 0.9); tower.position.set(-3.0, 8.5, 0); cath.add(tower);
  const spire = mesh(new THREE.ConeGeometry(3.0, 6, 4), mat(hex(PAL.slate), { rough: 0.85 })); spire.position.set(-3.0, 20, 0); spire.rotation.y = Math.PI / 4; cath.add(spire);
  const finial = mesh(new THREE.ConeGeometry(0.4, 1.6, 6), mat(hex(PAL.gold), { rough: 0.35, metal: 0.85, emissive: 0x3a2c0d, emi: 0.4 })); finial.position.set(-3.0, 23.6, 0); cath.add(finial);
  // big arched doors on the west face (facing the square, -x)
  const doorArch = mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 16, 1, false, 0, Math.PI), mat('#1a1410', { rough: 0.9 })); doorArch.rotation.z = -Math.PI / 2; doorArch.position.set(-5.1, 3.4, 0); cath.add(doorArch);
  const doorBody = box(0.6, 4.4, 3.0, woodMat(PAL.timber)); doorBody.position.set(-5.1, 2.2, 0); cath.add(doorBody);
  // giant flame/torch motif over the doors (gold)
  const flameMotif = mesh(new THREE.ConeGeometry(1.1, 3.0, 6), mat(hex(PAL.gold), { rough: 0.4, metal: 0.7, emissive: 0x6a4410, emi: 0.7 }));
  flameMotif.position.set(-5.2, 7.4, 0); flameMotif.rotation.x = -Math.PI / 2; flameMotif.rotation.z = Math.PI; cath.add(flameMotif);
  const flameCore = mesh(new THREE.ConeGeometry(0.5, 1.7, 5), mat('#e7c977', { emissive: 0xffcf66, emi: 1.2 })); flameCore.position.set(-5.35, 7.4, 0); flameCore.rotation.x = -Math.PI / 2; flameCore.rotation.z = Math.PI; cath.add(flameCore);
  // rose window
  const rose = mesh(new THREE.TorusGeometry(1.1, 0.16, 6, 18), mat(hex(PAL.gold), { rough: 0.4, metal: 0.7 })); rose.position.set(-5.15, 11, 0); rose.rotation.y = Math.PI / 2; cath.add(rose);
  const rosePane = mesh(new THREE.CircleGeometry(1.0, 18), mat('#7fa6c4', { rough: 0.2, emissive: 0x24506e, emi: 0.5 })); rosePane.position.set(-5.13, 11, 0); rosePane.rotation.y = -Math.PI / 2; cath.add(rosePane);
  // ONE torn banner beside the doors
  tornBanner(cath, -5.2, 6.0, 2.4, Math.PI / 2, 1.0);
  // flame sconces flanking the steps
  braziers.push(flameSconce(cath, -5.4, 2.6, 2.6));
  braziers.push(flameSconce(cath, -5.4, 2.6, -2.6));
  // steps
  for (let i = 0; i < 3; i++) { const st = block(2.2, 0.3, 6 - i * 0.6, PAL.stoneLight, 0.9); st.position.set(-6.0 - i * 0.5, 0.15 + i * 0.28, 0); cath.add(st); }
  addObstacle(20.5, -7, 4.5, 5.5);
  addObstacle(16, -7, 2.4, 2.4);
  labels.push({ position: new THREE.Vector3(13.5, 9, -7), text: 'CATHEDRAL OF THE ETERNAL FLAME', sub: 'the Temple Quarter' });

  /* ====================================================================
     EAST/SE — Archive entrance (heavy sealed doors, fortified low building)
     ==================================================================== */
  const arch = new THREE.Group(); arch.position.set(18, 0, 8); root.add(arch);
  const arBody = block(9, 6, 8, PAL.stoneCold, 0.95); arBody.position.set(1, 3, 0); arch.add(arBody);
  crenellate(arBody, 9, 6.3, 8, PAL.stoneCold);
  // buttresses
  for (const sz of [-1, 1]) { const but = block(1.2, 5.4, 1.2, PAL.stoneDark, 0.95); but.position.set(-3.2, 2.7, sz * 3.0); but.rotation.y = 0.0; arch.add(but); }
  // heavy sealed iron-banded doors facing west (-x)
  const sealFrame = block(0.5, 4.6, 3.6, PAL.stoneDark, 0.9); sealFrame.position.set(-3.5, 2.3, 0); arch.add(sealFrame);
  const sealDoor = box(0.35, 4.0, 3.0, woodMat(0x2a2018)); sealDoor.position.set(-3.75, 2.0, 0); arch.add(sealDoor);
  for (let i = 0; i < 3; i++) { const band = box(0.4, 0.22, 3.1, mat('#1a1814', { rough: 0.5, metal: 0.6 })); band.position.set(-3.78, 1.0 + i * 1.1, 0); arch.add(band); }
  // big iron seal/lock disc
  const lock = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 12), mat('#23211c', { rough: 0.4, metal: 0.7 })); lock.rotation.z = Math.PI / 2; lock.position.set(-3.95, 2.0, 0); arch.add(lock);
  // nailed proclamation on the door
  const procMat = new THREE.MeshStandardMaterial({ map: proclamationTexture(), roughness: 0.95 });
  const proc = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.15), procMat); proc.position.set(-3.97, 2.6, 1.0); proc.rotation.y = -Math.PI / 2; arch.add(proc);
  braziers.push(flameSconce(arch, -3.9, 2.4, 2.2));
  addObstacle(19, 8, 4.6, 4.2);
  doors.push({ id: 'archive', kind: 'sealed', position: new THREE.Vector3(13.6, 0, 8), label: 'The Archive', sub: 'sealed · fortified by Crown order' });
  labels.push({ position: new THREE.Vector3(13.5, 7, 8), text: 'THE ARCHIVE', sub: 'sealed' });

  /* ====================================================================
     SOUTHWEST — The Tarnished Cup (enterable tavern)
     ==================================================================== */
  const tav = new THREE.Group(); tav.position.set(-16, 0, 12); root.add(tav);
  const tBody = block(8, 5, 7, PAL.timberLight, 0.92); tBody.position.set(0, 2.5, 0); tav.add(tBody);
  // timber framing (dark beams)
  const beamMat = woodMat(PAL.timber);
  for (const bx of [-3.5, 0, 3.5]) { const b = box(0.3, 5, 0.3, beamMat); b.position.set(bx, 2.5, 3.55); tav.add(b); }
  const beamH = box(8, 0.3, 0.3, beamMat); beamH.position.set(0, 4.4, 3.55); tav.add(beamH);
  const beamH2 = box(8, 0.3, 0.3, beamMat); beamH2.position.set(0, 2.4, 3.55); tav.add(beamH2);
  // upper jettied storey
  const tUpper = block(8.6, 3, 7.4, PAL.timberLight, 0.92); tUpper.position.set(0, 6.5, 0); tav.add(tUpper);
  // steep roof
  const tRoof = mesh(new THREE.CylinderGeometry(0.01, 5.4, 9.4, 3), mat('#2c2620', { rough: 0.9 })); tRoof.rotation.y = Math.PI / 2; tRoof.position.set(0, 9.4, 0); tav.add(tRoof);
  // chimney + warm smoke source
  const chimney = block(1.0, 3, 1.0, PAL.stoneDark, 0.95); chimney.position.set(2.6, 9.5, -1.5); tav.add(chimney);
  // shuttered windows glowing warm
  const winMat = mat('#ffb55e', { rough: 0.5, emissive: 0xff9b3a, emi: 1.4 });
  for (const wz of [-1.8, 1.8]) { const win = box(0.2, 1.4, 1.1, winMat); win.position.set(-4.05, 2.6, wz); tav.add(win); const shz = box(0.12, 1.5, 0.2, beamMat); shz.position.set(-4.12, 2.6, wz + 0.7); tav.add(shz); }
  // door facing the square (+x side toward center... tavern is SW so face NE, toward -x? center is at +x,-z from tavern). Door on +x face.
  const tDoorFrame = block(0.5, 3.4, 2.4, PAL.timber, 0.9); tDoorFrame.position.set(4.0, 1.7, 1.5); tav.add(tDoorFrame);
  const tDoor = box(0.3, 2.8, 1.8, woodMat(0x3a2a18)); tDoor.position.set(4.2, 1.4, 1.5); tav.add(tDoor);
  // warm spill light handled in FX via brazier list (interior glow)
  braziers.push({ worldPos: new THREE.Vector3(-12.0, 1.8, 13.5), flame: null, kind: 'window' });
  // hanging iron sign: dented cup
  const signArm = box(1.4, 0.16, 0.16, mat('#1a1814', { rough: 0.5, metal: 0.6 })); signArm.position.set(4.6, 3.6, 1.5); tav.add(signArm);
  const signPlate = box(0.1, 1.3, 1.3, mat('#23211c', { rough: 0.5, metal: 0.6 })); signPlate.position.set(5.2, 2.9, 1.5); tav.add(signPlate);
  const cup = cyl(0.32, 0.22, 0.5, mat(hex(PAL.gold), { rough: 0.45, metal: 0.7 }), 10); cup.position.set(5.15, 2.9, 1.5); cup.rotation.z = 0.3; tav.add(cup);
  addObstacle(-16, 12, 4.4, 3.8);
  doors.push({ id: 'tarnished_cup', kind: 'tavern', position: new THREE.Vector3(-11.2, 0, 13.5), label: 'The Tarnished Cup', sub: 'Enter · the last open tavern' });
  labels.push({ position: new THREE.Vector3(-16, 11.4, 12), text: 'THE TARNISHED CUP', sub: 'tavern' });

  /* ====================================================================
     WEST — Market Row: Brennan's Sundries + covered stalls
     ==================================================================== */
  const mkt = new THREE.Group(); mkt.position.set(-21, 0, -4); root.add(mkt);
  const shop = block(7, 4.5, 6, PAL.stoneLight, 0.92); shop.position.set(0, 2.25, 0); mkt.add(shop);
  const shopRoof = mesh(new THREE.CylinderGeometry(0.01, 4.4, 7.6, 3), mat('#3a2c1e', { rough: 0.9 })); shopRoof.rotation.y = Math.PI / 2; shopRoof.position.set(0, 5.8, 0); mkt.add(shopRoof);
  // awning over the shopfront (facing +x toward square)
  const awning = box(1.6, 0.16, 5.5, mat(hex(PAL.crimson), { rough: 0.8 })); awning.position.set(4.0, 3.0, 0); awning.rotation.z = -0.18; mkt.add(awning);
  // counter + shutter
  const counter = box(0.5, 1.2, 4, woodMat(PAL.timberLight)); counter.position.set(3.7, 0.9, 0); mkt.add(counter);
  const shutter = box(0.2, 1.8, 4, woodMat(PAL.timber)); shutter.position.set(3.55, 3.0, 0); mkt.add(shutter);
  // goods on counter (sparse — tense times)
  for (let i = 0; i < 3; i++) { const crate = box(0.6, 0.6, 0.6, woodMat(PAL.timberLight)); crate.position.set(3.7, 1.7, -1.2 + i * 1.2); mkt.add(crate); }
  const barrel = cyl(0.4, 0.35, 1.0, woodMat(PAL.timber), 10); barrel.position.set(4.4, 0.5, -2.2); mkt.add(barrel);
  // two covered stalls (half-empty)
  for (let k = 0; k < 2; k++) {
    const st = new THREE.Group(); st.position.set(3.5, 0, 6 + k * 4); mkt.add(st);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const post = box(0.16, 2.2, 0.16, beamMat); post.position.set(sx * 1.1, 1.1, sz * 1.0); st.add(post); }
    const canopy = box(2.6, 0.12, 2.4, mat(k ? '#5b5340' : hex(PAL.crimson), { rough: 0.85 })); canopy.position.y = 2.3; canopy.rotation.x = 0.06; st.add(canopy);
    const table = box(2.2, 0.12, 1.6, woodMat(PAL.timberLight)); table.position.y = 1.0; st.add(table);
    addObstacle(-17.5, (6 + k * 4) - 4, 1.3, 1.2);
  }
  braziers.push(flameSconce(mkt, 3.9, 2.0, 2.6));
  addObstacle(-21.5, -4, 4.0, 3.4);
  doors.push({ id: 'brennan_sundries', kind: 'shop', position: new THREE.Vector3(-16.5, 0, -4), label: "Brennan's Sundries", sub: 'Trade · general goods' });
  labels.push({ position: new THREE.Vector3(-21, 7, -4), text: "BRENNAN'S SUNDRIES", sub: 'Market Row' });

  /* ====================================================================
     PERIMETER — filler row houses + boarded-up house + walls
     ==================================================================== */
  function rowHouse(x, z, w, h, dp, col, ry = 0, boarded = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const b = block(w, h, dp, col, 0.93); b.position.y = h / 2; g.add(b);
    const r = mesh(new THREE.CylinderGeometry(0.01, Math.max(w, dp) * 0.62, Math.max(w, dp) + 1, 3), mat('#2c2620', { rough: 0.9 })); r.rotation.y = Math.PI / 2; r.position.y = h + 0.8; g.add(r);
    if (boarded) {
      // boarded window planks
      for (let i = 0; i < 3; i++) { const pk = box(0.12, 0.3, 1.6, woodMat(PAL.timberLight)); pk.position.set(w / 2 + 0.05, h * 0.55 + (i - 1) * 0.35, 0); pk.rotation.x = (i - 1) * 0.2; g.add(pk); }
      const xb1 = box(0.13, 0.25, 2.0, woodMat(PAL.timber)); xb1.position.set(w / 2 + 0.06, h * 0.55, 0); xb1.rotation.x = 0.7; g.add(xb1);
      const xb2 = xb1.clone(); xb2.rotation.x = -0.7; g.add(xb2);
    } else {
      const win = box(0.1, 0.9, 0.8, mat('#15110b', { rough: 1 })); win.position.set(w / 2 + 0.02, h * 0.55, 0); g.add(win);
    }
    root.add(g);
    addObstacle(x, z, w / 2 + 0.2, dp / 2 + 0.2);
    return g;
  }
  // south side row (behind spawn / camera) and corners
  rowHouse(-7, 20, 6, 6.5, 5, PAL.stoneLight, 0);
  const boarded = rowHouse(-1, 21, 5, 5.5, 5, 0x6a5f4c, 0, true);
  labels.push({ position: new THREE.Vector3(-1, 6.6, 21), text: 'BOARDED HOUSE', sub: 'emptied · no one speaks of it' });
  rowHouse(8, 21, 6, 7, 5, PAL.stoneCold, 0);
  rowHouse(-30, 14, 7, 8, 6, PAL.stoneLight, 0.3);   // SW corner mass
  rowHouse(-30, -16, 8, 9, 6, PAL.stoneCold, -0.2);  // NW corner
  rowHouse(30, 16, 7, 7, 6, PAL.stoneLight, -0.3);   // SE corner

  /* ====================================================================
     ROADS OFF-MAP — gated exits (NE monastery, SE merchant road)
     ==================================================================== */
  function roadExit(x, z, ry, id, label, sub) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    for (const sx of [-1, 1]) { const post = block(1.0, 4.5, 1.0, PAL.stoneDark, 0.95); post.position.set(sx * 2.2, 2.25, 0); g.add(post); }
    const top = block(5.6, 1.0, 1.2, PAL.stoneDark, 0.95); top.position.set(0, 4.6, 0); g.add(top);
    const rd = mesh(new THREE.PlaneGeometry(3.6, 14), mat('#0e0b07', { rough: 1 })); rd.rotation.x = -Math.PI / 2; rd.position.set(0, 0.02, -8); g.add(rd);
    doors.push({ id, kind: 'exit', position: new THREE.Vector3(x, 0, z), label, sub, locationId: id });
    labels.push({ position: new THREE.Vector3(x, 5.6, z), text: label.toUpperCase(), sub });
  }
  roadExit(26, -18, -Math.PI * 0.72, 'monastery_aldric', 'Monastery of Saint Aldric', 'the northeast road');
  roadExit(26, 22, -Math.PI * 0.32, 'merchant_road', 'The Merchant Road', 'the southeast road');

  /* ====================================================================
     ENVIRONMENTAL STORYTELLING — proclamation posts + hidden cross
     ==================================================================== */
  // free-standing proclamation post near the monument
  const post = box(0.3, 2.6, 0.3, woodMat(PAL.timber)); post.position.set(-4.5, 1.3, 4); root.add(post);
  const noticeMat = new THREE.MeshStandardMaterial({ map: proclamationTexture(), roughness: 0.95 });
  const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.2), noticeMat); notice.position.set(-4.5, 2.0, 4.18); root.add(notice);

  // ground fog-stained scattered debris (low blocks)
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 18;
    const deb = box(0.3 + Math.random() * 0.4, 0.2, 0.3 + Math.random() * 0.5, stone(PAL.stoneDark, 1));
    deb.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r); deb.rotation.y = Math.random() * Math.PI; root.add(deb);
  }

  // HIDDEN: crude two-plank cross scratched into a wall in the alley by the tavern (the Remnant)
  const alleyWall = block(0.4, 5, 5, PAL.stoneDark, 0.98); alleyWall.position.set(-22, 2.5, 14); root.add(alleyWall);
  const crossV = box(0.08, 1.2, 0.16, woodMat(PAL.timberLight)); crossV.position.set(-21.78, 2.4, 14); root.add(crossV);
  const crossH = box(0.08, 0.16, 0.7, woodMat(PAL.timberLight)); crossH.position.set(-21.78, 2.6, 14); root.add(crossH);
  addObstacle(-22, 14, 0.6, 2.6);
  // (intentionally NO label — only the lore-aware will spot it)

  return { root, obstacles, braziers, doors, labels,
    bounds: { minX: -32, maxX: 32, minZ: -20, maxZ: 24 } };
}

/* =========================================================================
   TAVERN INTERIOR — dim, candlelit (bar, low tables, hearth, back room)
   ========================================================================= */
export function buildTavernInterior() {
  const root = new THREE.Group();
  const obstacles = [];
  const candles = [];
  const doors = [];
  const labels = [];
  const addObstacle = (x, z, hw, hd) => obstacles.push({ x, z, hw, hd });

  const W = 18, D = 14;
  // floor (warm boards)
  const floorMat = mat('#2a1d12', { rough: 0.95 });
  const floor = mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
  // plank seams
  for (let i = -4; i <= 4; i++) { const seam = box(W, 0.02, 0.04, mat('#1a120a', { rough: 1 })); seam.position.set(0, 0.011, i * 1.4); root.add(seam); }
  // walls
  const wallMat = mat('#3a2a1c', { rough: 0.95 });
  const beam = mat('#241810', { rough: 0.9 });
  function wall(x, z, w, h, ry) { const g = new THREE.Group(); g.position.set(x, h / 2, z); g.rotation.y = ry; const b = box(w, h, 0.4, wallMat); g.add(b); root.add(g); return g; }
  wall(0, -D / 2, W, 6, 0);        // north
  wall(0, D / 2, W, 6, 0);         // south
  wall(-W / 2, 0, D, 6, Math.PI / 2); // west
  wall(W / 2, 0, D, 6, Math.PI / 2);  // east
  // ceiling beams
  for (let i = -3; i <= 3; i++) { const cb = box(0.4, 0.4, D, beam); cb.position.set(i * 2.4, 5.6, 0); root.add(cb); }
  const ceil = mesh(new THREE.PlaneGeometry(W, D), mat('#1a120a', { rough: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 5.9; root.add(ceil);

  // hearth (west wall) with fire
  const hearth = box(0.6, 4, 4, mat('#26201a', { rough: 0.95 })); hearth.position.set(-W / 2 + 0.5, 2, -3); root.add(hearth);
  const fireBox = box(0.4, 1.2, 2.2, mat('#1a120a', { rough: 1 })); fireBox.position.set(-W / 2 + 0.9, 1.0, -3); root.add(fireBox);
  const fire = mesh(new THREE.ConeGeometry(0.5, 1.4, 6), mat('#ff9b3a', { emissive: 0xff7a1a, emi: 2.6 })); fire.position.set(-W / 2 + 1.1, 1.2, -3); root.add(fire);
  candles.push({ worldPos: new THREE.Vector3(-W / 2 + 1.4, 1.4, -3), flame: fire, kind: 'hearth' });

  // the bar (along north wall)
  const barTop = box(7, 0.3, 1.4, mat('#4a3320', { rough: 0.7 })); barTop.position.set(2, 1.2, -D / 2 + 1.6); root.add(barTop);
  const barFront = box(7, 1.2, 0.5, mat('#3a2a18', { rough: 0.85 })); barFront.position.set(2, 0.6, -D / 2 + 2.3); root.add(barFront);
  for (let i = 0; i < 4; i++) { const bot = cyl(0.12, 0.12, 1.0, mat('#3a4d2a', { rough: 0.4, metal: 0.1 }), 6); bot.position.set(0 + i * 1.2, 1.85, -D / 2 + 1.2); root.add(bot); }
  addObstacle(2, -D / 2 + 1.9, 3.5, 1.0);
  // shelf of bottles behind bar
  const shelf = box(7, 0.2, 0.5, mat('#241810', { rough: 0.9 })); shelf.position.set(2, 2.6, -D / 2 + 0.4); root.add(shelf);

  // low tables + stools
  function table(x, z) {
    const top = cyl(0.9, 0.9, 0.16, mat('#3a2a18', { rough: 0.8 }), 12); top.position.set(x, 0.9, z); root.add(top);
    const leg = cyl(0.12, 0.12, 0.9, mat('#241810', { rough: 0.9 }), 6); leg.position.set(x, 0.45, z); root.add(leg);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const stool = cyl(0.28, 0.28, 0.5, mat('#2a1d12', { rough: 0.9 }), 8); stool.position.set(x + Math.cos(a) * 1.5, 0.25, z + Math.sin(a) * 1.5); root.add(stool); }
    // candle on table
    const c = cyl(0.06, 0.08, 0.3, mat('#e8dcc0', { rough: 0.7 }), 6); c.position.set(x, 1.13, z); root.add(c);
    const fl = sphere(0.06, mat('#ffe39a', { emissive: 0xffcf66, emi: 3 })); fl.position.set(x, 1.32, z); root.add(fl);
    candles.push({ worldPos: new THREE.Vector3(x, 1.4, z), flame: fl, kind: 'candle' });
    addObstacle(x, z, 0.9, 0.9);
  }
  table(-2.5, 1.5); table(4.5, 2.5); table(-5, 4);

  // back room doorway (south-east), darker
  const arch = box(0.4, 4, 2.4, mat('#1a120a', { rough: 1 })); arch.position.set(W / 2 - 0.3, 2, 3.5); root.add(arch);
  const backGlow = sphere(0.1, mat('#6a4a9a', { emissive: 0x3a2a6a, emi: 1.5 })); backGlow.position.set(W / 2 - 0.6, 2, 3.5); root.add(backGlow);

  // exit door (south wall) back to the square
  const exitDoor = box(2.2, 4, 0.5, mat('#3a2a18', { rough: 0.85 })); exitDoor.position.set(-5, 2, D / 2 - 0.1); root.add(exitDoor);
  doors.push({ id: 'leave_tavern', kind: 'exit-interior', position: new THREE.Vector3(-5, 0, D / 2 - 1.6), label: 'Step Outside', sub: 'back to the square' });

  return { root, obstacles, candles, doors, labels,
    spawn: new THREE.Vector3(-2, 0, 3.0), spawnFace: -1,
    bounds: { minX: -W / 2 + 1, maxX: W / 2 - 1, minZ: -D / 2 + 1, maxZ: D / 2 - 1 } };
}
