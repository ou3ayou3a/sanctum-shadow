/* =========================================================================
   charbuilder.js — Sanctum & Shadow procedural character system
   -------------------------------------------------------------------------
   This is the SAME primitive-modeling builder used in the Character Creator,
   refactored into a per-instance factory so the player AND every NPC can be
   built from one config object. Nothing here is new art: box/cyl/cone/sphere
   primitives, flat shading, the same RACES table, the same equip slots and
   builders, the same tint/skin/hair material helpers.

   Usage:
     import { createCharacter, RACES } from './charbuilder.js';
     const c = createCharacter({ race:'human', class:'warrior', skin:'#c98b63',
                                 hair:'#3a2a1a', tint:'#9aa0a8',
                                 equipped:{helmet:'platehelm', ...} });
     parent.add(c.root);
     c.setWalk(phase, speed01);   // drive the walk cycle each frame
     c.idle(time);                // breathing / sway when standing still
     c.dispose();                 // free all geometry + materials
   ========================================================================= */
import * as THREE from 'three';

/* ---- material + primitive helpers (identical to the creator) ---- */
export function mat(color, opt = {}) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opt.rough ?? 0.72, metalness: opt.metal ?? 0.0,
    flatShading: opt.flat ?? true, emissive: opt.emissive ?? 0x000000,
    emissiveIntensity: opt.emi ?? 1
  });
  if (opt.tag) m.userData[opt.tag] = true;
  if (opt.base !== undefined) m.userData.base = opt.base;
  return m;
}
export function mesh(geo, material) { const m = new THREE.Mesh(geo, material); m.castShadow = true; m.receiveShadow = true; return m; }
export function box(w, h, d, material) { return mesh(new THREE.BoxGeometry(w, h, d), material); }
export function cyl(rt, rb, h, material, seg = 8) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material); }
export function sphere(r, material, s = 12) { return mesh(new THREE.SphereGeometry(r, s, s), material); }

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); }
  });
}

/* ---- RACES (identical) ---- */
export const RACES = {
  human:   { name:'Human',    h:1.00, w:1.00, head:1.00, ear:'normal',  skin:'#c98b63', tusk:false, beard:false, brow:0.0 },
  dwarf:   { name:'Dwarf',    h:0.80, w:1.30, head:1.12, ear:'normal',  skin:'#c08254', tusk:false, beard:true,  brow:0.4 },
  elf:     { name:'Elf',      h:1.05, w:0.88, head:0.96, ear:'pointed', skin:'#e3bfa3', tusk:false, beard:false, brow:0.0 },
  highelf: { name:'High Elf', h:1.10, w:0.85, head:0.95, ear:'pointed', skin:'#f1ddca', tusk:false, beard:false, brow:0.0 },
  darkelf: { name:'Dark Elf', h:1.05, w:0.86, head:0.95, ear:'pointed', skin:'#6a5566', tusk:false, beard:false, brow:0.0, hair:'#d9d2e6' },
  orc:     { name:'Orc',      h:1.14, w:1.40, head:1.05, ear:'large',   skin:'#6f8f4e', tusk:true,  beard:false, brow:0.7 },
  goblin:  { name:'Goblin',   h:0.64, w:1.00, head:1.30, ear:'large',   skin:'#8aa24d', tusk:true,  beard:false, brow:0.5 },
};

export const CLASS_LOADOUTS = {
  warrior: { helmet:'platehelm', chest:'plate', shoulders:'heavy', gauntlets:'heavy', boots:'heavy', weapon:'greatsword', tint:'#9aa0a8' },
  paladin: { helmet:'holycirclet', chest:'holyarmor', shoulders:'heavy', gauntlets:'light', boots:'heavy', weapon:'mace', tint:'#d9a93f' },
  cleric:  { helmet:'leatherhood', chest:'clothrobe', shoulders:'none', gauntlets:'none', boots:'light', weapon:'staff', tint:'#b07a3a' },
  mage:    { helmet:'none', chest:'clothrobe', shoulders:'none', gauntlets:'none', boots:'none', weapon:'staff', tint:'#8a9099' },
  rogue:   { helmet:'leatherhood', chest:'leather', shoulders:'light', gauntlets:'light', boots:'light', weapon:'dagger', tint:'#2b2d33' },
};

function computeDims(cfg) {
  const h = cfg.h, w = cfg.w;
  const footH = 0.13;
  const shin = 0.62 * h, thigh = 0.62 * h;
  const hipY = footH + shin + thigh;
  const pelvisH = 0.40 * h, pelvisW = 0.86 * w, pelvisD = 0.56 * w;
  const torsoBottom = hipY + pelvisH * 0.42;
  const torsoH = 0.92 * h, torsoW = 1.04 * w, torsoD = 0.58 * w;
  const torsoTop = torsoBottom + torsoH;
  const shoulderY = torsoTop - 0.12 * h;
  const neckH = 0.16 * h, neckR = 0.15 * w;
  const headSize = 0.54 * cfg.head;
  const headBottom = torsoTop + neckH * 0.45;
  const headCenterY = headBottom + headSize / 2;
  return {
    cfg, h, w, footH, shin, thigh, hipY,
    pelvisH, pelvisW, pelvisD, pelvisCenterY: hipY + pelvisH * 0.28,
    torsoBottom, torsoH, torsoW, torsoD, torsoTop, torsoCenterY: torsoBottom + torsoH / 2,
    shoulderY, neckH, neckR, headSize, headCenterY,
    armR: 0.145 * Math.sqrt(w), upper: 0.58 * h, fore: 0.54 * h, hand: 0.17,
    hipX: 0.24 * w, legR: 0.185 * w,
  };
}

const LEATHER = '#5a3c24', LEATHER_D = '#43291a', CLOTH = '#3a4d63', CLOTH_TRIM = '#b48a36';
const STEEL = '#b8c0c8', WOOD = '#5a3f28', GOLDW = '#d9a93f', GEMW = '#7fd4e6';

function metalMat(opt = {}) { return mat('#888', { rough: opt.rough ?? 0.42, metal: opt.metal ?? 0.85, tag: 'metal', flat: opt.flat ?? true }); }
function softMat(color, opt = {}) { return mat(color, { rough: opt.rough ?? 0.8, metal: 0.0, flat: opt.flat ?? true, tag: 'soft', base: color }); }
function clothMat(color, main = false) {
  const m = mat(color, { rough: 0.9, metal: 0.0, flat: true });
  m.userData.cloth = true; m.userData.clothBase = color;
  if (main) m.userData.clothMain = true;
  return m;
}

function buildEars(headGroup, cfg, hw, hh, hd, skinMat) {
  const earY = hh * 0.02, earX = hw * 0.5;
  for (const sx of [-1, 1]) {
    if (cfg.ear === 'pointed') {
      const e = mesh(new THREE.ConeGeometry(hw * 0.13, hh * 0.5, 5), skinMat());
      e.position.set(sx * earX, earY + hh * 0.08, -hd * 0.05);
      e.rotation.z = sx * -0.9; e.rotation.y = sx * -0.3; headGroup.add(e);
    } else if (cfg.ear === 'large') {
      const e = box(hw * 0.1, hh * 0.4, hd * 0.5, skinMat());
      e.position.set(sx * earX * 1.05, earY + hh * 0.04, -hd * 0.02);
      e.rotation.z = sx * -0.4; e.rotation.y = sx * 0.4; headGroup.add(e);
    } else {
      const e = box(hw * 0.1, hh * 0.26, hd * 0.32, skinMat());
      e.position.set(sx * earX, earY, 0); headGroup.add(e);
    }
  }
}
function buildHair(headGroup, cfg, hw, hh, hd, hairMat) {
  const cap = box(hw * 1.06, hh * 0.5, hd * 1.08, hairMat()); cap.position.set(0, hh * 0.34, -hd * 0.04); headGroup.add(cap);
  const back = box(hw * 1.02, hh * 0.55, hd * 0.42, hairMat()); back.position.set(0, hh * 0.05, -hd * 0.55); headGroup.add(back);
  const fringe = box(hw * 1.0, hh * 0.12, hd * 0.16, hairMat()); fringe.position.set(0, hh * 0.32, hd * 0.46); headGroup.add(fringe);
}

/* ---------- equipment builders (identical geometry to the creator) ---------- */
function helmetBuilders(d) {
  const hs = d.headSize, hw = hs * 0.92, hh = hs * 1.06, hd = hs * 0.86;
  return {
    none: () => null,
    leatherhood: () => { const g = new THREE.Group();
      const hood = box(hw*1.16, hh*0.7, hd*1.18, softMat(LEATHER)); hood.position.y = hh*0.2; g.add(hood);
      const back = box(hw*1.12, hh*0.7, hd*0.5, softMat(LEATHER_D)); back.position.set(0,-hh*0.05,-hd*0.5); g.add(back);
      const peak = box(hw*1.0, hh*0.12, hd*0.3, softMat(LEATHER_D)); peak.position.set(0,hh*0.42,hd*0.5); peak.rotation.x=-0.3; g.add(peak);
      return g; },
    chaincoif: () => { const g = new THREE.Group(); const m = metalMat({rough:0.55,metal:0.7});
      const coif = box(hw*1.18, hh*0.95, hd*1.2, m); coif.position.y = hh*0.02; g.add(coif);
      const drape = box(hw*1.16, hh*0.4, hd*0.55, m.clone()); drape.material.userData.metal=true; drape.position.set(0,-hh*0.5,-hd*0.35); g.add(drape);
      const faceCut = box(hw*0.78, hh*0.5, 0.04, mat('#000',{rough:1})); faceCut.position.set(0,-hh*0.02,hd*0.61); g.add(faceCut);
      return g; },
    platehelm: () => { const g = new THREE.Group(); const m = metalMat({rough:0.34});
      const dome = mesh(new THREE.SphereGeometry(hw*0.66, 12, 10, 0, Math.PI*2, 0, Math.PI*0.62), m); dome.position.y=hh*0.18; dome.scale.set(1,1.15,1.05); g.add(dome);
      const skirt = box(hw*1.18, hh*0.62, hd*1.2, m); skirt.position.y=-hh*0.06; g.add(skirt);
      const visor = box(hw*1.0, hh*0.16, 0.05, mat('#0a0a0a',{rough:1})); visor.position.set(0,hh*0.04,hd*0.62); g.add(visor);
      const nasal = box(hw*0.12, hh*0.42, 0.06, mat('#0a0a0a',{rough:1})); nasal.position.set(0,-hh*0.12,hd*0.62); g.add(nasal);
      const crest = box(hw*0.1, hh*0.5, hd*1.1, mat('#7c2a23',{rough:0.7})); crest.position.set(0,hh*0.5,-hd*0.05); g.add(crest);
      return g; },
    holycirclet: () => { const g = new THREE.Group(); const m = metalMat({rough:0.3,metal:0.95});
      const band = mesh(new THREE.TorusGeometry(hw*0.6, hw*0.06, 8, 20), m); band.rotation.x=Math.PI/2; band.position.y=hh*0.28; band.scale.set(1,1.1,1); g.add(band);
      const gem = mesh(new THREE.OctahedronGeometry(hw*0.12), mat('#7fd4e6',{rough:0.2,metal:0.3,emissive:0x2a6b78,emi:0.6})); gem.position.set(0,hh*0.32,hd*0.66); g.add(gem);
      for (let i=0;i<5;i++){ const ray=mesh(new THREE.ConeGeometry(hw*0.05,hh*0.3,4),m); const a=(i-2)*0.34; ray.position.set(Math.sin(a)*hw*0.6, hh*0.42+Math.cos(a)*0.04, Math.cos(a)*hd*0.55); ray.rotation.x=-0.2; ray.rotation.z=a; g.add(ray);}
      return g; }
  };
}
function chestBuilders(d) {
  const w = d.torsoW, h = d.torsoH, dep = d.torsoD;
  return {
    clothrobe: () => { const g = new THREE.Group();
      const robe = box(w*1.08, h*1.06, dep*1.1, clothMat(CLOTH, true)); g.add(robe);
      const skirt = mesh(new THREE.CylinderGeometry(w*0.62, w*0.95, h*1.15, 10), clothMat(CLOTH, true)); skirt.position.y=-h*1.0; g.add(skirt);
      const trim = box(w*1.1, h*0.12, dep*1.12, clothMat(CLOTH_TRIM)); trim.position.y=h*0.36; g.add(trim);
      const sash = box(w*1.12, h*0.14, dep*1.12, clothMat('#7c2a23')); sash.position.y=-h*0.2; g.add(sash);
      return g; },
    leather: () => { const g = new THREE.Group();
      const body = box(w*1.06, h*0.96, dep*1.08, softMat(LEATHER)); g.add(body);
      const belt = box(w*1.1, h*0.12, dep*1.1, softMat(LEATHER_D)); belt.position.y=-h*0.34; g.add(belt);
      for (const sx of [-1,1]){ const strap=box(w*0.12,h*0.9,dep*0.1,softMat(LEATHER_D)); strap.position.set(sx*w*0.2,0,dep*0.55); g.add(strap);}
      const collar = box(w*1.04, h*0.16, dep*1.06, softMat(LEATHER_D)); collar.position.y=h*0.42; g.add(collar);
      return g; },
    chainmail: () => { const g = new THREE.Group(); const m = metalMat({rough:0.55,metal:0.7});
      const body = box(w*1.08, h*1.0, dep*1.1, m); g.add(body);
      const hauberk = mesh(new THREE.CylinderGeometry(w*0.56,w*0.66,h*0.5,10), m.clone()); hauberk.material.userData.metal=true; hauberk.position.y=-h*0.6; g.add(hauberk);
      const belt = box(w*1.12, h*0.1, dep*1.12, softMat(LEATHER_D)); belt.position.y=-h*0.3; g.add(belt);
      return g; },
    plate: () => { const g = new THREE.Group(); const m = metalMat({rough:0.32});
      const chest = box(w*1.12, h*0.66, dep*1.14, m); chest.position.y=h*0.16; g.add(chest);
      const ridge = mesh(new THREE.CylinderGeometry(w*0.5,w*0.5,dep*1.16,3), m); ridge.rotation.z=Math.PI/2; ridge.rotation.y=Math.PI/2; ridge.position.set(0,h*0.18,0); ridge.scale.set(0.5,1,0.4); g.add(ridge);
      const abs = box(w*0.96, h*0.5, dep*1.06, m); abs.position.y=-h*0.3; g.add(abs);
      const fauld = mesh(new THREE.CylinderGeometry(w*0.55,w*0.62,h*0.4,10), m); fauld.position.y=-h*0.62; g.add(fauld);
      const gorget = box(w*0.7, h*0.16, dep*1.04, m); gorget.position.y=h*0.46; g.add(gorget);
      return g; },
    holyarmor: () => { const g = new THREE.Group(); const m = metalMat({rough:0.26,metal:0.95});
      const chest = box(w*1.14, h*0.68, dep*1.16, m); chest.position.y=h*0.16; g.add(chest);
      const abs = box(w*0.98, h*0.5, dep*1.08, m); abs.position.y=-h*0.3; g.add(abs);
      const fauld = mesh(new THREE.CylinderGeometry(w*0.56,w*0.64,h*0.42,12), m); fauld.position.y=-h*0.62; g.add(fauld);
      const disc = mesh(new THREE.CylinderGeometry(w*0.26,w*0.26,0.05,16), mat('#f0d272',{rough:0.3,metal:0.6,emissive:0x6a4e10,emi:0.5})); disc.rotation.x=Math.PI/2; disc.position.set(0,h*0.2,dep*0.6); g.add(disc);
      for (let i=0;i<10;i++){ const ray=box(w*0.05,h*0.18,0.04,mat('#f6e29a',{rough:0.3,metal:0.5,emissive:0x6a4e10,emi:0.4})); const a=i/10*Math.PI*2; ray.position.set(Math.cos(a)*w*0.32, h*0.2+Math.sin(a)*w*0.32, dep*0.58); ray.rotation.z=a; g.add(ray);}
      const gorget = box(w*0.72, h*0.18, dep*1.06, m); gorget.position.y=h*0.46; g.add(gorget);
      return g; }
  };
}
function shoulderBuilders(d) {
  const r = d.armR;
  return {
    none: () => null,
    light: () => { const g = new THREE.Group(); const p = box(r*2.4, r*1.4, r*2.6, softMat(LEATHER)); p.position.y=r*0.2; g.add(p); return g; },
    heavy: () => { const g = new THREE.Group(); const m = metalMat({rough:0.34});
      const dome = mesh(new THREE.SphereGeometry(r*1.7, 12, 10, 0, Math.PI*2, 0, Math.PI*0.6), m); dome.position.y=r*0.3; dome.scale.set(1.25,1,1.2); g.add(dome);
      const trim = mesh(new THREE.TorusGeometry(r*1.5, r*0.16, 6, 16), m); trim.rotation.x=Math.PI/2; trim.scale.set(1.25,1.2,1); g.add(trim);
      const spike = mesh(new THREE.ConeGeometry(r*0.4, r*1.4, 6), m); spike.position.y=r*1.2; g.add(spike);
      return g; }
  };
}
function gauntletBuilders(d) {
  const r = d.armR;
  return {
    none: () => null,
    light: () => { const g = new THREE.Group(); const sleeve = cyl(r*1.15,r*1.0,d.fore*0.7,softMat(LEATHER)); g.add(sleeve);
      const cuff = cyl(r*1.3,r*1.2,r*0.5,softMat(LEATHER_D)); cuff.position.y=-d.fore*0.32; g.add(cuff); return g; },
    heavy: () => { const g = new THREE.Group(); const m = metalMat({rough:0.34});
      const sleeve = cyl(r*1.28,r*1.05,d.fore*0.8,m); g.add(sleeve);
      const cuff = mesh(new THREE.CylinderGeometry(r*1.5,r*1.3,r*0.6,10), m); cuff.position.y=-d.fore*0.34; g.add(cuff);
      for (let i=0;i<3;i++){ const ridge=mesh(new THREE.TorusGeometry(r*1.2,r*0.08,6,12),m); ridge.rotation.x=Math.PI/2; ridge.position.y=d.fore*0.1-i*d.fore*0.18; ridge.scale.set(1.05,1,1.05); g.add(ridge);}
      return g; }
  };
}
function bootBuilders(d) {
  const r = d.legR;
  return {
    none: () => null,
    light: () => { const g = new THREE.Group();
      const boot = box(r*1.9, d.footH*1.8, r*3.2, softMat(LEATHER)); boot.position.set(0,d.footH*0.2,r*0.2); g.add(boot);
      const cuff = cyl(r*1.0,r*0.95,d.shin*0.5,softMat(LEATHER_D)); cuff.position.set(0,d.footH*0.9+d.shin*0.25,-r*0.2); g.add(cuff); return g; },
    heavy: () => { const g = new THREE.Group(); const m = metalMat({rough:0.36});
      const boot = box(r*2.0, d.footH*2.0, r*3.4, m); boot.position.set(0,d.footH*0.25,r*0.25); g.add(boot);
      const toe = box(r*1.6, d.footH*1.4, r*0.9, m); toe.position.set(0,d.footH*0.1,r*1.6); g.add(toe);
      const greave = cyl(r*1.1,r*0.95,d.shin*0.7,m); greave.position.set(0,d.footH*1.0+d.shin*0.35,-r*0.15); g.add(greave);
      const knee = mesh(new THREE.SphereGeometry(r*0.7,10,8,0,Math.PI*2,0,Math.PI*0.6), m); knee.position.set(0,d.footH*1.0+d.shin*0.72,r*0.2); g.add(knee);
      return g; }
  };
}
function weaponBuilders(d) {
  const sc = d.h;
  const steel = () => mat(STEEL, { rough: 0.3, metal: 0.9 });
  const dark = () => mat('#2b2f33', { rough: 0.5, metal: 0.6 });
  const wood = () => mat(WOOD, { rough: 0.85 });
  const gold = () => mat(GOLDW, { rough: 0.35, metal: 0.85 });
  return {
    none: () => null,
    sword: () => { const g = new THREE.Group();
      const blade=box(0.1,1.5*sc,0.03,steel()); blade.position.y=0.95*sc; g.add(blade);
      const tip=mesh(new THREE.ConeGeometry(0.07,0.22*sc,4),steel()); tip.position.y=1.72*sc; g.add(tip);
      const guard=box(0.42,0.07,0.1,gold()); guard.position.y=0.18*sc; g.add(guard);
      const grip=cyl(0.05,0.05,0.34*sc,dark()); g.add(grip);
      const pommel=sphere(0.075,gold()); pommel.position.y=-0.2*sc; g.add(pommel);
      g.position.y=-0.2*sc; return g; },
    greatsword: () => { const g = new THREE.Group();
      const blade=box(0.16,2.2*sc,0.045,steel()); blade.position.y=1.35*sc; g.add(blade);
      const tip=mesh(new THREE.ConeGeometry(0.1,0.3*sc,4),steel()); tip.position.y=2.55*sc; g.add(tip);
      const fuller=box(0.03,2.0*sc,0.05,dark()); fuller.position.y=1.35*sc; g.add(fuller);
      const guard=box(0.66,0.09,0.13,gold()); guard.position.y=0.2*sc; g.add(guard);
      const grip=cyl(0.06,0.06,0.52*sc,dark()); grip.position.y=-0.1*sc; g.add(grip);
      const pommel=mesh(new THREE.OctahedronGeometry(0.1),gold()); pommel.position.y=-0.4*sc; g.add(pommel);
      g.position.y=-0.25*sc; return g; },
    mace: () => { const g = new THREE.Group();
      const haft=cyl(0.05,0.05,1.1*sc,dark()); haft.position.y=0.4*sc; g.add(haft);
      const head=mesh(new THREE.IcosahedronGeometry(0.2*sc,0),steel()); head.position.y=1.0*sc; g.add(head);
      for (let i=0;i<6;i++){ const fl=box(0.07,0.16*sc,0.07,gold()); const a=i/6*Math.PI*2; fl.position.set(Math.cos(a)*0.2*sc,1.0*sc,Math.sin(a)*0.2*sc); fl.lookAt(new THREE.Vector3(Math.cos(a)*0.5,1.0*sc,Math.sin(a)*0.5)); g.add(fl);}
      const cap=sphere(0.06,gold()); cap.position.y=1.2*sc; g.add(cap);
      const grip=cyl(0.06,0.06,0.3*sc,mat(LEATHER_D,{rough:0.8})); g.add(grip);
      g.position.y=-0.2*sc; return g; },
    staff: () => { const g = new THREE.Group();
      const shaft=cyl(0.045,0.05,2.2*sc,wood()); shaft.position.y=0.75*sc; g.add(shaft);
      const claw=mesh(new THREE.ConeGeometry(0.14,0.3*sc,5),wood()); claw.position.y=1.9*sc; g.add(claw);
      const orb=sphere(0.15*sc,mat(GEMW,{rough:0.15,metal:0.2,emissive:0x2a6b78,emi:1.2})); orb.position.y=2.05*sc; g.add(orb);
      const halo=mesh(new THREE.TorusGeometry(0.2*sc,0.018,6,18),gold()); halo.position.y=2.05*sc; halo.rotation.x=0.5; g.add(halo);
      const wrap=cyl(0.06,0.06,0.3*sc,mat(LEATHER_D,{rough:0.8})); wrap.position.y=0.2*sc; g.add(wrap);
      g.position.y=-0.55*sc; return g; },
    dagger: () => { const g = new THREE.Group();
      const blade=mesh(new THREE.ConeGeometry(0.06,0.6*sc,4),steel()); blade.position.y=0.5*sc; g.add(blade);
      const guard=box(0.22,0.05,0.08,dark()); guard.position.y=0.2*sc; g.add(guard);
      const grip=cyl(0.04,0.04,0.22*sc,mat(LEATHER_D,{rough:0.8})); grip.position.y=0.05*sc; g.add(grip);
      const pommel=sphere(0.05,dark()); pommel.position.y=-0.08*sc; g.add(pommel);
      g.position.y=-0.1*sc; return g; }
  };
}

const SLOT_ANCHORS = {
  helmet: ['head'], chest: ['chest'], shoulders: ['shoulderL', 'shoulderR'],
  gauntlets: ['foreL', 'foreR'], boots: ['footL', 'footR'], weapon: ['handR'],
};

/* =========================================================================
   FACTORY — one independent character instance
   ========================================================================= */
export function createCharacter(rawState) {
  // resolve a class loadout into equipment if equipped not given explicitly
  const state = Object.assign({
    race: 'human', class: null, skin: null, hair: '#3a2a1a', tint: '#8a9099',
    equipped: { helmet: 'none', chest: 'leather', shoulders: 'none', gauntlets: 'none', boots: 'light', weapon: 'sword' }
  }, rawState || {});
  if (state.class && CLASS_LOADOUTS[state.class] && !rawState.equipped) {
    const lo = CLASS_LOADOUTS[state.class];
    state.equipped = { helmet: lo.helmet, chest: lo.chest, shoulders: lo.shoulders, gauntlets: lo.gauntlets, boots: lo.boots, weapon: lo.weapon };
    if (!rawState.tint) state.tint = lo.tint;
  }
  const cfg = RACES[state.race] || RACES.human;
  if (!state.skin) state.skin = cfg.skin;
  if (cfg.hair && !rawState.hair) state.hair = cfg.hair;

  const d = computeDims(cfg);
  const root = new THREE.Group();
  const skinMats = [], hairMats = [];
  const skinMat = () => { const m = mat(state.skin, { rough: 0.82, tag: 'skin' }); skinMats.push(m); return m; };
  const hairMat = () => { const m = mat(state.hair, { rough: 0.85, tag: 'hair' }); hairMats.push(m); return m; };
  const eyeWhite = mat('#efe9dd', { rough: 0.4 });
  const eyeDark = mat('#1b1410', { rough: 0.5 });
  const ivory = mat('#e8e2cf', { rough: 0.5 });

  const torsoBody = new THREE.Group();
  const torso = box(d.torsoW, d.torsoH, d.torsoD, skinMat()); torso.position.y = d.torsoCenterY; torsoBody.add(torso);
  const pelvis = box(d.pelvisW, d.pelvisH, d.pelvisD, skinMat()); pelvis.position.y = d.pelvisCenterY; torsoBody.add(pelvis);
  const neck = cyl(d.neckR, d.neckR * 1.05, d.neckH, skinMat()); neck.position.y = d.torsoTop + d.neckH * 0.4; torsoBody.add(neck);
  root.add(torsoBody);

  const chestAnchor = new THREE.Object3D(); chestAnchor.position.set(0, d.torsoCenterY + d.torsoH * 0.06, 0); torsoBody.add(chestAnchor);
  const pelvisAnchor = new THREE.Object3D(); pelvisAnchor.position.set(0, d.pelvisCenterY, 0); torsoBody.add(pelvisAnchor);

  /* head */
  const headGroup = new THREE.Group(); headGroup.position.y = d.headCenterY;
  const hs = d.headSize, hw = hs * 0.92, hh = hs * 1.06, hd = hs * 0.86;
  const head = box(hw, hh, hd, skinMat()); headGroup.add(head);
  const jaw = box(hw * 0.78, hh * 0.32, hd * 0.92, skinMat()); jaw.position.set(0, -hh * 0.46, hd * 0.02); headGroup.add(jaw);
  if (cfg.brow > 0) { const brow = box(hw * 0.92, hh * 0.1, hd * 0.18, skinMat()); brow.position.set(0, hh * 0.16, hd * 0.46); headGroup.add(brow); }
  const eyeY = hh * 0.04, eyeX = hw * 0.23, eyeZ = hd * 0.47;
  for (const sx of [-1, 1]) {
    const w1 = sphere(hw * 0.11, eyeWhite); w1.scale.set(1, 1.15, 0.6); w1.position.set(sx * eyeX, eyeY, eyeZ); headGroup.add(w1);
    const p = sphere(hw * 0.055, eyeDark); p.position.set(sx * eyeX, eyeY, eyeZ + hw * 0.05); headGroup.add(p);
    const bl = box(hw * 0.28, hh * 0.045, 0.03, hairMat()); bl.position.set(sx * eyeX, eyeY + hh * 0.13, eyeZ); bl.rotation.z = sx * 0.12; headGroup.add(bl);
  }
  const nose = mesh(new THREE.ConeGeometry(hw * 0.12, hh * 0.26, 4), skinMat()); nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4; nose.position.set(0, -hh * 0.06, hd * 0.5); headGroup.add(nose);
  const mouth = box(hw * 0.34, hh * 0.04, 0.03, eyeDark); mouth.position.set(0, -hh * 0.28, hd * 0.48); headGroup.add(mouth);
  if (cfg.tusk) { for (const sx of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(hw * 0.07, hh * 0.26, 6), ivory); t.position.set(sx * hw * 0.2, -hh * 0.34, hd * 0.42); t.rotation.z = sx * 0.14; headGroup.add(t); } }
  buildEars(headGroup, cfg, hw, hh, hd, skinMat);
  buildHair(headGroup, cfg, hw, hh, hd, hairMat);
  if (cfg.beard) {
    const beard = box(hw * 0.7, hh * 0.5, hd * 0.4, hairMat()); beard.position.set(0, -hh * 0.55, hd * 0.28); headGroup.add(beard);
    const stache = box(hw * 0.5, hh * 0.08, hd * 0.2, hairMat()); stache.position.set(0, -hh * 0.22, hd * 0.46); headGroup.add(stache);
  }
  torsoBody.add(headGroup);

  /* arms */
  const arms = {};
  for (const side of ['l', 'r']) {
    const s = side === 'r' ? 1 : -1;
    const g = new THREE.Group();
    g.position.set(s * (d.torsoW / 2 + d.armR * 0.7), d.shoulderY, 0);
    g.rotation.z = -s * 0.14; g.rotation.x = 0.04;
    const up = cyl(d.armR, d.armR * 0.92, d.upper, skinMat()); up.position.y = -d.upper / 2; g.add(up);
    const shoulderBall = sphere(d.armR * 1.05, skinMat()); g.add(shoulderBall);
    const elbow = new THREE.Group(); elbow.position.y = -d.upper; g.add(elbow); elbow.rotation.x = 0.12;
    const fore = cyl(d.armR * 0.9, d.armR * 0.8, d.fore, skinMat()); fore.position.y = -d.fore / 2; elbow.add(fore);
    const hand = box(d.armR * 1.7, d.hand, d.armR * 1.5, skinMat()); hand.position.y = -d.fore - d.hand / 2; elbow.add(hand);
    torsoBody.add(g);
    const shoulderAnchor = new THREE.Object3D(); g.add(shoulderAnchor);
    const foreAnchor = new THREE.Object3D(); foreAnchor.position.set(0, -d.fore * 0.55, 0); elbow.add(foreAnchor);
    const handAnchor = new THREE.Object3D(); handAnchor.position.set(0, -d.fore - d.hand * 0.6, d.armR * 0.3); elbow.add(handAnchor);
    arms[side] = { group: g, restZ: -s * 0.14, shoulderAnchor, foreAnchor, handAnchor, elbow };
  }

  /* legs */
  const legs = {};
  for (const side of ['l', 'r']) {
    const s = side === 'r' ? 1 : -1;
    const g = new THREE.Group();
    g.position.set(s * d.hipX, d.hipY, 0);
    const thigh = cyl(d.legR, d.legR * 0.88, d.thigh, skinMat()); thigh.position.y = -d.thigh / 2; g.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -d.thigh; g.add(knee);
    const shin = cyl(d.legR * 0.82, d.legR * 0.66, d.shin, skinMat()); shin.position.y = -d.shin / 2; knee.add(shin);
    const foot = box(d.legR * 1.7, d.footH, d.legR * 3.0, skinMat()); foot.position.set(0, -d.shin - d.footH / 2, d.legR * 0.9); knee.add(foot);
    torsoBody.add(g);
    const footAnchor = new THREE.Object3D(); footAnchor.position.set(0, -d.shin - d.footH / 2, d.legR * 0.5); knee.add(footAnchor);
    const shinAnchor = new THREE.Object3D(); shinAnchor.position.set(0, -d.shin * 0.5, 0); knee.add(shinAnchor);
    legs[side] = { group: g, knee, footAnchor, shinAnchor };
  }

  const anchors = {
    head: headGroup, headGroup, chest: chestAnchor, pelvis: pelvisAnchor,
    shoulderL: arms.l.shoulderAnchor, shoulderR: arms.r.shoulderAnchor,
    foreL: arms.l.foreAnchor, foreR: arms.r.foreAnchor,
    handL: arms.l.handAnchor, handR: arms.r.handAnchor,
    footL: legs.l.footAnchor, footR: legs.r.footAnchor,
    shinL: legs.l.shinAnchor, shinR: legs.r.shinAnchor
  };

  const equippedMeshes = {};
  let currentTint = new THREE.Color(state.tint);

  function applyTint() {
    root.traverse(o => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (m.userData.metal) { m.color.copy(currentTint); }
        else if (m.userData.soft) { m.color.copy(new THREE.Color(m.userData.base)).lerp(currentTint, 0.14); }
      });
    });
  }

  function equip(slot, id) {
    const old = equippedMeshes[slot];
    if (old) old.forEach(o => { o.parent && o.parent.remove(o); disposeTree(o); });
    equippedMeshes[slot] = [];
    let builders;
    if (slot === 'helmet') builders = helmetBuilders(d);
    else if (slot === 'chest') builders = chestBuilders(d);
    else if (slot === 'shoulders') builders = shoulderBuilders(d);
    else if (slot === 'gauntlets') builders = gauntletBuilders(d);
    else if (slot === 'boots') builders = bootBuilders(d);
    else if (slot === 'weapon') builders = weaponBuilders(d);
    const builder = builders && builders[id];
    if (!builder) return;
    SLOT_ANCHORS[slot].forEach(aName => {
      const piece = builder();
      if (!piece) return;
      anchors[aName].add(piece);
      equippedMeshes[slot].push(piece);
    });
    applyTint();
  }

  // build initial equipment
  for (const slot in state.equipped) equip(slot, state.equipped[slot]);
  applyTint();

  /* ---- animation ---- */
  const api = {
    root, dims: d, state, anchors, torsoBody, arms, legs, height: d.headCenterY + d.headSize,
    setSkin(hex) { state.skin = hex; skinMats.forEach(m => m.color.set(hex)); },
    setHair(hex) { state.hair = hex; hairMats.forEach(m => m.color.set(hex)); },
    setTint(hex) { currentTint = new THREE.Color(hex); state.tint = hex; applyTint(); },
    // recolor the main robe body (leaves trim/sash accents)
    setCloth(hex) {
      const col = new THREE.Color(hex);
      root.traverse(o => { if (o.material && o.material.userData && o.material.userData.clothMain) o.material.color.copy(col); });
    },
    equip,
    // idle breathing + gentle head turn (matches the creator's resting pose)
    idle(t, headLook = true) {
      const br = 1 + Math.sin(t * 1.4) * 0.016;
      torsoBody.scale.set(1 + (br - 1) * 0.5, br, 1 + (br - 1) * 0.4);
      if (headLook) headGroup.rotation.y = Math.sin(t * 0.33 + d.hipX) * 0.1;
      // ease limbs back to rest
      for (const side of ['l', 'r']) {
        legs[side].group.rotation.x *= 0.8;
        legs[side].knee.rotation.x *= 0.8;
        arms[side].group.rotation.x += (0.04 - arms[side].group.rotation.x) * 0.2;
      }
    },
    // walk cycle, phase in radians, amp 0..1
    walk(phase, amp = 1) {
      const swing = 0.7 * amp;
      legs.r.group.rotation.x = Math.sin(phase) * swing;
      legs.l.group.rotation.x = Math.sin(phase + Math.PI) * swing;
      legs.r.knee.rotation.x = Math.max(0, -Math.sin(phase - 0.5)) * swing * 1.1;
      legs.l.knee.rotation.x = Math.max(0, -Math.sin(phase + Math.PI - 0.5)) * swing * 1.1;
      arms.r.group.rotation.x = Math.sin(phase + Math.PI) * swing * 0.7;
      arms.l.group.rotation.x = Math.sin(phase) * swing * 0.7;
      const bob = Math.abs(Math.sin(phase)) * 0.03 * amp;
      torsoBody.position.y = bob;
    },
    resetWalk() { torsoBody.position.y = 0; },
    dispose() { disposeTree(root); }
  };
  return api;
}
