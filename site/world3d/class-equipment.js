import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const EQUIPMENT_ROOT='world3d/assets/production/equipment';
const EQUIPMENT_CACHE=new Map();
export function rigBone(model,boneName){return model?.getObjectByName(boneName)||model?.getObjectByName(String(boneName).replace(':',''))||null;}
async function productionEquipment(name){
  const url=`${EQUIPMENT_ROOT}/${name}.glb`;
  if(!EQUIPMENT_CACHE.has(url))EQUIPMENT_CACHE.set(url,new GLTFLoader().loadAsync(url).then(gltf=>gltf.scene).catch(error=>{EQUIPMENT_CACHE.delete(url);throw error;}));
  const object=(await EQUIPMENT_CACHE.get(url)).clone(true);object.name=`production-equipment:${name}`;object.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;child.userData.sharedActorGeometry=true;child.userData.sharedActorMaterial=true;}});return object;
}

const material=(color,{metalness=.55,roughness=.38,emissive=0,emissiveIntensity=0}={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
const box=(w,h,d,mat)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
const cylinder=(radius,height,mat,segments=12)=>new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments),mat);
function attach(model,boneName,object,{position=[0,0,0],rotation=[0,0,0]}={}){const bone=rigBone(model,boneName);if(!bone)return null;object.position.set(...position);object.rotation.set(...rotation);object.userData.equipmentSlot='held';object.userData.equipmentBone=boneName;object.traverse(o=>{if(o.isMesh)o.castShadow=true;});bone.add(object);return object;}
function sword(profile,length=58){const group=new THREE.Group(),steel=material(profile.metal),accent=material(profile.accent,{metalness:.7,roughness:.28});const blade=box(4,length,1.8,steel);blade.position.y=length*.48;group.add(blade);const tip=new THREE.Mesh(new THREE.ConeGeometry(2.2,8,4),steel);tip.position.y=length+3;group.add(tip);const guard=box(18,2.2,3,accent);group.add(guard);const grip=cylinder(1.5,14,material(0x39291d,{metalness:.05,roughness:.9}));grip.position.y=-7;group.add(grip);return group;}
function dagger(profile){const group=sword(profile,25);group.scale.setScalar(.75);return group;}
function shield(profile){const group=new THREE.Group(),face=new THREE.Mesh(new THREE.CylinderGeometry(17,17,3,10),material(profile.metal,{metalness:.65,roughness:.42}));face.rotation.x=Math.PI/2;group.add(face);const boss=new THREE.Mesh(new THREE.SphereGeometry(5,12,8),material(profile.accent,{metalness:.8,roughness:.25}));boss.position.z=2.2;group.add(boss);return group;}
function staff(profile,arcane=false){const group=new THREE.Group(),shaft=cylinder(1.8,82,material(0x5b3e27,{metalness:.05,roughness:.86}));shaft.position.y=28;group.add(shaft);const head=new THREE.Mesh(arcane?new THREE.OctahedronGeometry(7):new THREE.TorusGeometry(7,1.6,8,20),material(profile.accent,{metalness:.3,roughness:.25,emissive:profile.accent,emissiveIntensity:1.5}));head.position.y=72;if(!arcane)head.rotation.x=Math.PI/2;group.add(head);const light=new THREE.PointLight(profile.accent,3,2.4);light.position.y=72;group.add(light);return group;}
function mace(profile){const group=new THREE.Group(),handle=cylinder(1.8,52,material(0x4a3424,{metalness:.1,roughness:.8}));handle.position.y=18;group.add(handle);const head=new THREE.Mesh(new THREE.DodecahedronGeometry(8),material(profile.accent,{metalness:.75,roughness:.3}));head.position.y=48;group.add(head);return group;}
function bow(profile){const group=new THREE.Group(),arc=new THREE.Mesh(new THREE.TorusGeometry(30,1.7,8,34,Math.PI*1.55),material(0x7b4f2d,{metalness:.05,roughness:.85}));arc.rotation.z=.72;group.add(arc);const points=[new THREE.Vector3(-21,21,0),new THREE.Vector3(5,0,0),new THREE.Vector3(21,-21,0)];group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xded4b8})));return group;}
// Fallen Paladin hero sword sockets (BUILD-SPEC §5.3 / §6.4 grip loop). Derived and checked against every clip by
// tools/hero/sword-sockets.py (it prints these values and exits 1 if an acceptance check fails) and by the close-up
// renders of tools/qa/hero-pose-renders.cjs:
//  held   - RightHand-local, cm. The grip runs through the knight's curled right gauntlet (channel centre (-4.5,9.75,0),
//           axis tilted 32 deg toward the back of the hand and 16 deg toward the fingers) with the crossguard against the
//           index finger and the long grip + pommel below the fist; the blade leaves on the thumb side, edge toward the
//           knuckles. In game: Combat_Idle holds it forward and ~22 deg up, Cast raises it, Attack_Smite strikes forward
//           without crossing the body; blade and crossguard stay >= 1 cm clear of legs, tabard, tassets, cape and left arm
//           in every drawn-sword paladin clip (Idle, Combat_Idle, Block, Cast, Attack_Smite, draw/sheathe). The Hit clip
//           presses the fist into the thigh, so the blade crosses the leg there for a few frames whatever the socket.
//  stowed - actor space at model scale 1 (multiplied by the hero's model scale at equip time), parented to Hips like
//           the other stowed class weapons. Tight left-hip carry: the crossguard sits on the scabbard's locket just in
//           front of the left hip plate at hip height, the sheathed blade runs 50 deg back from vertical and 9 deg out,
//           flat to the thigh, so the scabbard hugs the hip plate and thigh and the chape trails behind the left calf.
//           Hilt and scabbard stay >= 0.8 cm clear of legs, tabard, tassets (and never cross the cape) in every clip a hero
//           plays; tip >= 0.38 m above the floor. The left forearm hangs and swings over the hilt and the top of the
//           scabbard (accepted, as in most games; sword-sockets.py reports it).
//  swap   - Weapon_Draw / Weapon_Sheathe fractions at which held and stowed swap for this sword (overrides
//           animation-policy.mjs). The shared clips draw out to the right side and never bring the right hand to the
//           left hip, so the hilt changes hands at the clip start / end, where the hand is nearest (~0.9 m), not
//           mid-flourish (1.3 m).
export const FALLEN_LONGSWORD_SOCKETS=Object.freeze({
  held:Object.freeze({position:[2.971,12.156,12.238],rotation:[3.1416,1.0123,-1.8093]}),
  stowed:Object.freeze({position:[0.33,1.12,0.2],rotation:[-0.7042,1.4507,-1.5708],scale:.01,bone:'mixamorig:Hips'}),
  swap:Object.freeze({weapon_draw:.08,weapon_sheathe:.92})
});
// Fallen Paladin scabbard (worn slot). Procedural, in sword space (cm: blade +Y, crossguard at the origin, blade axis
// at `axis`) and seated with the stowed socket, so the stowed hilt sits in its locket. It is always visible: while the
// sword is drawn the empty scabbard stays on the hip (setEquipmentDrawn only toggles held/stowed). Stations are the
// outer surface [y, half-width, half-thickness(, cusp)]: dark leather over the blade's taper, tarnished-steel locket,
// suspension band and chape (cusp: the ring dips that far toward the chape at the middle of each face, so the locket's
// lower edge and the chape's upper edge are pointed like a gothic fitting). Two leather hangers run from the waist belt
// (paths in actor space at model scale 1, like the stowed socket) over the hip plate to the locket and to the band;
// that two-point suspension is what tilts the scabbard back. sword-sockets.py derives the hangers (design_hangers) and
// checks the stations and hangers against every clip; it exits 1 if they differ from its design.
export const FALLEN_SCABBARD=Object.freeze({
  axis:[1.05,0.1],
  hilt:4.6,
  leather:[[12.4,5.75,2.3],[30,5.5,2.15],[60,4.9,2.0],[84.8,3.85,1.75]],
  steel:[[[3.6,6.4,3.05],[4.3,6.6,3.15],[5.0,6.45,3.0],[11.8,6.25,2.85,2.6],[12.8,5.95,2.45,2.6]],[[23.6,5.9,2.45],[24.2,6.05,2.58],[27.0,6.0,2.52],[27.6,5.85,2.4]],[[84.2,4.1,1.95,-2.8],[85.0,4.2,2.02,-2.8],[91.5,3.15,1.65],[96.0,2.0,1.25],[98.8,1.15,0.95],[99.6,1.3,1.1],[100.6,1.05,0.95],[101.3,0.35,0.35]]],
  hangers:[{path:[[0.17,1.25,0.101],[0.199,1.226,0.102],[0.227,1.202,0.103],[0.255,1.179,0.104],[0.284,1.155,0.105],[0.312,1.131,0.106],[0.341,1.107,0.107]],width:0.032,buckle:0.3},{path:[[0.195,1.25,0.005],[0.235,1.207,-0.001],[0.251,1.164,-0.005],[0.278,1.121,-0.01],[0.306,1.078,-0.015],[0.334,1.035,-0.019],[0.362,0.992,-0.024]],width:0.028,buckle:0.35}]
});
// Steel fittings are tarnished toward the knight's blackened plate (a brighter, smoother steel read as chrome on the chape).
const SCABBARD_LEATHER=0x46301f,SCABBARD_STRAP=0x5a3826,SCABBARD_STEEL=0x6b675f,SCABBARD_SECTION=1.1;
function meshBuilder(){
  const position=[],color=[],uv=[],index=[];
  return{position,color,uv,index,
    vertex(p,c,u=0,v=0){position.push(p.x,p.y,p.z);color.push(c,c,c);uv.push(u,v);return position.length/3-1;},
    quad(a,b,c,d){index.push(a,b,c,a,c,d);},
    geometry(){
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
      // Seam vertices (texture wrap) share one normal so the scabbard edge shades smoothly.
      const normal=g.attributes.normal,groups=new Map();for(let i=0;i<position.length/3;i++){const key=`${position[i*3].toFixed(3)},${position[i*3+1].toFixed(3)},${position[i*3+2].toFixed(3)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
      const n=new THREE.Vector3(),m=new THREE.Vector3();for(const list of groups.values()){if(list.length<2)continue;n.set(0,0,0);for(const i of list)n.add(m.fromBufferAttribute(normal,i));n.normalize();for(const i of list)normal.setXYZ(i,n.x,n.y,n.z);}
      return g;}};
}
// Lenticular cross-section (superellipse, exponent SCABBARD_SECTION): width along sword X, thickness along sword Z. One extra
// vertex closes the ring so the leather texture wraps (u around the section, v along the scabbard: y/100).
function scabbardRing(builder,[y,a,b,cusp=0],segments,shade){
  const [cx,cz]=FALLEN_SCABBARD.axis,first=builder.position.length/3;
  for(let s=0;s<=segments;s++){const t=s/segments*Math.PI*2,c=Math.cos(t),n=Math.sin(t),x=Math.sign(c)*Math.abs(c)**SCABBARD_SECTION,z=Math.sign(n)*Math.abs(n)**SCABBARD_SECTION,yy=y+cusp*n*n;builder.vertex(new THREE.Vector3(cx+a*x,yy,cz+b*z),shade(yy,Math.abs(c)),s/segments,yy/100);}
  return first;
}
function loft(builder,stations,segments,shade,{capStart=false,capEnd=false}={}){
  const rings=stations.map(station=>scabbardRing(builder,station,segments,shade));
  for(let r=0;r+1<rings.length;r++)for(let s=0;s<segments;s++)builder.quad(rings[r]+s,rings[r]+s+1,rings[r+1]+s+1,rings[r+1]+s);
  const [cx,cz]=FALLEN_SCABBARD.axis;
  const cap=(ring,station,flip)=>{const centre=builder.vertex(new THREE.Vector3(cx,station[0]+(flip?.25:-.1),cz),shade(station[0],.5),.5,station[0]/100);for(let s=0;s<segments;s++){if(flip)builder.index.push(ring+s,ring+s+1,centre);else builder.index.push(ring+s+1,ring+s,centre);}};
  if(capStart)cap(rings[0],stations[0],false);
  if(capEnd)cap(rings[rings.length-1],stations[stations.length-1],true);
}
// Leather stations every ~6 cm between the given ones (denser where the taper is read in silhouette).
function leatherStations(){
  const base=FALLEN_SCABBARD.leather,out=[];const at=y=>{for(let i=0;i+1<base.length;i++){const [y0,a0,b0]=base[i],[y1,a1,b1]=base[i+1];if(y<=y1||i+2===base.length){const u=(y-y0)/(y1-y0);return[y,a0+(a1-a0)*u,b0+(b1-b0)*u];}}};
  const ys=new Set([base[0][0],base[base.length-1][0]]);for(let y=base[0][0]+5;y<base[base.length-1][0]-2;y+=6)ys.add(+y.toFixed(2));
  for(const y of[...ys].sort((p,q)=>p-q))out.push(at(y));return out;
}
function leatherShade(y,edge){let v=.86+.14*edge**3;if(y<14||y>83)v*=.85;return Math.min(1,v);}
function steelShade(y,edge){return .62+.38*edge**3;}
// Tooled leather (canvas, cached per page): grain, a border groove on each face, diamond panels under the locket and at
// mid-length, stitching along the back edge and scuffed edges. Used as colour and bump map; skipped without a DOM.
let SCABBARD_TEXTURE;
function scabbardTexture(){
  if(SCABBARD_TEXTURE!==undefined)return SCABBARD_TEXTURE;
  if(typeof document==='undefined'){SCABBARD_TEXTURE=null;return null;}
  const W=64,H=512,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const g=canvas.getContext('2d'),image=g.createImageData(W,H);
  let seed=1337;const random=()=>(seed=seed*16807%2147483647)/2147483647;
  const value=new Float32Array(W*H);for(let i=0;i<W*H;i++)value[i]=.8+(random()-.5)*.16;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=x/W,v=1-y/H,face=Math.min(Math.abs(u-.25),Math.abs(u-.75)),edge=Math.min(u,Math.abs(u-.5),1-u);let k=value[y*W+x]*(1+.06*Math.sin(v*41+Math.sin(u*25))*Math.sin(v*13));
    if(edge<.05)k*=1.16-edge*2;
    if(v>.13&&v<.85&&Math.abs(face-.155)<.012)k*=.38;
    if((v>.15&&v<.3||v>.5&&v<.6)&&face<.14){const d1=((v*H*.9+u*W*1.6)%22+22)%22,d2=((v*H*.9-u*W*1.6)%22+22)%22;if(d1<1.6||d2<1.6)k*=.45;}
    if([.145,.31,.49,.61,.83].some(line=>Math.abs(v-line)<.004)&&face<.17)k*=.4;
    if(Math.abs(u-.5)<.02&&y%7<3)k*=.62;
    const c=Math.max(0,Math.min(255,Math.round(k*255)));image.data.set([c,c,c,255],(y*W+x)*4);
  }
  g.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;
  SCABBARD_TEXTURE=texture;return texture;
}
// A flat leather strap following a Catmull-Rom path; `outward` gives the direction away from the body (strap face).
function strapGeometry(builder,points,width,thickness,outward){
  const curve=new THREE.CatmullRomCurve3(points),samples=curve.getPoints(Math.max(6,points.length*4)),rows=[];
  for(let k=0;k<samples.length;k++){
    const p=samples[k],tangent=samples[Math.min(samples.length-1,k+1)].clone().sub(samples[Math.max(0,k-1)]).normalize();
    const out=outward(p);out.addScaledVector(tangent,-out.dot(tangent)).normalize();const side=new THREE.Vector3().crossVectors(tangent,out).normalize();
    const shade=.9+.08*Math.sin(k*.9);
    rows.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,o])=>[p.clone().addScaledVector(side,s*width/2).addScaledVector(out,o*thickness/2),shade]));
  }
  for(let k=0;k+1<rows.length;k++)for(let f=0;f<4;f++){const g=(f+1)%4,edge=f%2===0?.72:1;const v=[rows[k][f],rows[k][g],rows[k+1][g],rows[k+1][f]].map(([p,shade])=>builder.vertex(p,shade*edge,.5,.5));builder.quad(v[0],v[1],v[2],v[3]);}
  return samples;
}
// A small square buckle frame on a strap (four bars).
function buckleGeometry(builder,centre,along,out,width){
  const side=new THREE.Vector3().crossVectors(along,out).normalize(),w=width*.68,h=width*.5,bar=width*.12;
  const box=(c,u,v,n,su,sv,sn)=>{const corners=[];for(const k of[-1,1])for(const j of[-1,1])for(const i of[-1,1])corners.push(builder.vertex(c.clone().addScaledVector(u,i*su).addScaledVector(v,j*sv).addScaledVector(n,k*sn),.95));
    const q=(a,b,c2,d)=>builder.quad(corners[a],corners[b],corners[c2],corners[d]);q(0,1,3,2);q(4,6,7,5);q(0,4,5,1);q(2,3,7,6);q(0,2,6,4);q(1,5,7,3);};
  const lift=out.clone().multiplyScalar(width*.12);
  box(centre.clone().add(lift).addScaledVector(along,h),side,along,out,w,bar,bar);box(centre.clone().add(lift).addScaledVector(along,-h),side,along,out,w,bar,bar);
  box(centre.clone().add(lift).addScaledVector(side,w),side,along,out,bar,h,bar);box(centre.clone().add(lift).addScaledVector(side,-w),side,along,out,bar,h,bar);
}
function fallenScabbard(socket){
  const group=new THREE.Group();group.name='FP_Scabbard';
  const leather=meshBuilder(),strap=meshBuilder(),steel=meshBuilder();
  loft(leather,leatherStations(),14,leatherShade);
  FALLEN_SCABBARD.steel.forEach((stations,i)=>loft(steel,stations,14,steelShade,{capStart:i===0,capEnd:i===FALLEN_SCABBARD.steel.length-1}));
  // Hangers: belt anchor -> scabbard ring, authored in actor space at model scale 1 and moved into sword space here.
  const toSword=new THREE.Matrix4().compose(new THREE.Vector3(...socket.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...socket.rotation)),new THREE.Vector3(socket.scale,socket.scale,socket.scale)).invert();
  const hip=new THREE.Vector3(0,1.06,0).applyMatrix4(toSword),up=new THREE.Vector3(0,1,0).transformDirection(toSword);
  const outward=p=>{const v=p.clone().sub(hip);return v.addScaledVector(up,-v.dot(up)).normalize();};
  for(const hanger of FALLEN_SCABBARD.hangers){
    const points=hanger.path.map(p=>new THREE.Vector3(...p).applyMatrix4(toSword)),samples=strapGeometry(strap,points,hanger.width*100,.55,outward);
    const k=Math.min(samples.length-2,Math.round(samples.length*hanger.buckle)),along=samples[k+1].clone().sub(samples[k]).normalize();
    buckleGeometry(steel,samples[k],along,outward(samples[k]),hanger.width*100);
  }
  const texture=scabbardTexture();
  const leatherMesh=new THREE.Mesh(leather.geometry(),new THREE.MeshStandardMaterial({color:SCABBARD_LEATHER,roughness:.8,metalness:.04,vertexColors:true,map:texture,bumpMap:texture,bumpScale:1.6}));leatherMesh.name='FP_Scabbard_leather';
  const meshes=[leatherMesh];
  if(strap.index.length){const strapMesh=new THREE.Mesh(strap.geometry(),new THREE.MeshStandardMaterial({color:SCABBARD_STRAP,roughness:.78,metalness:.03,vertexColors:true}));strapMesh.name='FP_Scabbard_hangers';meshes.push(strapMesh);}
  const steelMesh=new THREE.Mesh(steel.geometry(),new THREE.MeshStandardMaterial({color:SCABBARD_STEEL,roughness:.42,metalness:.88,vertexColors:true}));steelMesh.name='FP_Scabbard_steel';meshes.push(steelMesh);
  for(const mesh of meshes){mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  return group;
}
// FP_Sword_stowed keeps only the hilt (sword-space y < FALLEN_SCABBARD.hilt): the blade is inside the scabbard.
function swordHilt(sword){
  const hilt=sword.clone();hilt.updateMatrixWorld(true);const toSword=new THREE.Matrix4().copy(hilt.matrixWorld).invert();
  hilt.traverse(object=>{
    if(!object.isMesh)return;const source=object.geometry,matrix=new THREE.Matrix4().multiplyMatrices(toSword,object.matrixWorld),p=source.attributes.position,v=new THREE.Vector3();
    const keep=new Uint8Array(p.count);for(let i=0;i<p.count;i++)keep[i]=v.fromBufferAttribute(p,i).applyMatrix4(matrix).y<FALLEN_SCABBARD.hilt?1:0;
    const index=source.index?Array.from(source.index.array):[...Array(p.count).keys()],kept=[];
    for(let i=0;i<index.length;i+=3)if(keep[index[i]]&&keep[index[i+1]]&&keep[index[i+2]])kept.push(index[i],index[i+1],index[i+2]);
    const geometry=source.clone();geometry.setIndex(kept);geometry.computeBoundingSphere();object.geometry=geometry;object.userData.sharedActorGeometry=false;
  });
  return hilt;
}
function stow(parent,object,position,rotation,scale=.012,boneName='mixamorig:Spine2',slot='stowed'){object.scale.setScalar(scale);object.position.set(...position);object.rotation.set(...rotation);if(slot==='worn')object.userData.equipmentSlot='worn';else object.userData.equipmentSlot='stowed';object.userData.equipmentBone=boneName;parent.add(object);return object;}

// Stowed and worn objects are authored in actor space and re-parented to their bone in the bind pose. Only the stowed
// ones are returned (setEquipmentDrawn toggles them); worn ones (the Fallen Paladin's scabbard) stay visible.
function bindStowedSockets(actor,gear){
  const objects=[];gear.traverse(object=>{const slot=object.userData?.equipmentSlot;if(slot==='stowed'||slot==='worn')objects.push(object);});
  actor.updateWorldMatrix(true,true);
  for(const object of objects){const bone=rigBone(actor.model,object.userData.equipmentBone);if(bone)bone.attach(object);}
  return objects.filter(object=>object.userData.equipmentSlot==='stowed');
}

export async function equipClass(actor,profile){
  const gear=new THREE.Group();gear.name=`class-gear:${profile.id}`;actor.add(gear);actor.equipmentSwap=null;
  try{
    if(profile.weapon==='greatsword'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('greatsword'),{position:[-10,0,0],rotation:[0,0,Math.PI/2]});stow(gear,await productionEquipment('greatsword'),[.12,.9,-.13],[.08,.12,-.5]);}
    if(profile.weapon==='mace_shield'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('mace'),{position:[5,0,0],rotation:[0,0,Math.PI/2]});attach(actor.model,'mixamorig:LeftForeArm',await productionEquipment('shield'),{position:[0,11,0],rotation:[0,0,0]});stow(gear,await productionEquipment('mace'),[.14,.7,-.1],[.05,.1,-.35],.012,'mixamorig:Hips');stow(gear,await productionEquipment('shield'),[-.05,1.02,-.14],[0,0,.08]);}
    if(profile.weapon==='fallen_longsword'){
      // Player hero sword: the hero GLB's own unskinned FP_Sword node (blade +Y, crossguard at the origin, cm units).
      // Held in the right hand; its hilt sits in a worn scabbard on the left hip. Held/stowed visibility follows
      // setEquipmentDrawn; the scabbard (slot 'worn') stays on. Sockets and clearances: FALLEN_LONGSWORD_SOCKETS above.
      const blade=actor.model.getObjectByName('FP_Sword');
      if(!blade)throw new Error('FP_Sword node missing from hero model');
      const k=actor.model.scale.y||1;blade.removeFromParent();blade.scale.setScalar(1);blade.name='FP_Sword';
      const sheathed=swordHilt(blade);sheathed.name='FP_Sword_stowed';
      const {held,stowed}=FALLEN_LONGSWORD_SOCKETS;
      attach(actor.model,'mixamorig:RightHand',blade,held);
      stow(gear,sheathed,stowed.position.map(v=>v*k),stowed.rotation,stowed.scale*k,stowed.bone);
      stow(gear,fallenScabbard(stowed),stowed.position.map(v=>v*k),stowed.rotation,stowed.scale*k,stowed.bone,'worn');
      actor.equipmentSwap=FALLEN_LONGSWORD_SOCKETS.swap;
    }
    if(profile.weapon==='holy_staff'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('holy_staff'),{position:[10,0,0],rotation:[0,0,Math.PI/2]});stow(gear,await productionEquipment('holy_staff'),[.1,.5,-.14],[.04,.08,-.18]);}
    if(profile.weapon==='arcane_staff'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('arcane_staff'),{position:[10,0,0],rotation:[0,0,Math.PI/2]});stow(gear,await productionEquipment('arcane_staff'),[.1,.5,-.14],[.04,.08,-.18]);}
    if(profile.weapon==='twin_daggers'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('dagger'),{position:[-6,0,0],rotation:[0,0,Math.PI/2]});attach(actor.model,'mixamorig:LeftHand',await productionEquipment('dagger'),{position:[6,0,0],rotation:[0,0,-Math.PI/2]});stow(gear,await productionEquipment('dagger'),[.14,.68,-.08],[.1,.1,-.7],.014,'mixamorig:Hips');stow(gear,await productionEquipment('dagger'),[-.14,.68,-.08],[-.1,-.1,.7],.014,'mixamorig:Hips');}
    if(profile.weapon==='bow_quiver'){
    attach(actor.model,'mixamorig:LeftHand',await productionEquipment('bow'),{position:[0,0,0],rotation:[0,.15,Math.PI/2]});stow(gear,await productionEquipment('bow'),[-.08,1.02,-.14],[.08,.15,-.35]);
    const quiver=new THREE.Group(),tube=cylinder(.11,.85,material(0x5f3c25,{metalness:.05,roughness:.9}),10);tube.position.y=.42;quiver.add(tube);for(let i=0;i<5;i++){const arrow=cylinder(.012,1.12,material(0xb7a47a,{metalness:.05,roughness:.8}),6);arrow.position.set((i-2)*.035,.82,(i%2)*.025);quiver.add(arrow);}stow(gear,quiver,[.13,.78,-.12],[0,0,-.28],1);
    }
  }catch(error){
    console.warn(`Production equipment failed for ${profile.id}; using procedural fallback.`,error);
    if(profile.weapon==='greatsword')attach(actor.model,'mixamorig:RightHand',sword(profile),{position:[-10,0,0],rotation:[0,0,Math.PI/2]});
    if(profile.weapon==='mace_shield'){attach(actor.model,'mixamorig:RightHand',mace(profile),{position:[5,0,0],rotation:[0,0,Math.PI/2]});attach(actor.model,'mixamorig:LeftForeArm',shield(profile),{position:[0,11,0]});}
    if(profile.weapon==='fallen_longsword')attach(actor.model,'mixamorig:RightHand',sword(profile,95),FALLEN_LONGSWORD_SOCKETS.held);
    if(profile.weapon==='holy_staff')attach(actor.model,'mixamorig:RightHand',staff(profile,false),{position:[10,0,0],rotation:[0,0,Math.PI/2]});
    if(profile.weapon==='arcane_staff')attach(actor.model,'mixamorig:RightHand',staff(profile,true),{position:[10,0,0],rotation:[0,0,Math.PI/2]});
    if(profile.weapon==='twin_daggers'){attach(actor.model,'mixamorig:RightHand',dagger(profile),{position:[-6,0,0],rotation:[0,0,Math.PI/2]});attach(actor.model,'mixamorig:LeftHand',dagger(profile),{position:[6,0,0],rotation:[0,0,-Math.PI/2]});}
    if(profile.weapon==='bow_quiver')attach(actor.model,'mixamorig:LeftHand',bow(profile),{position:[0,0,0],rotation:[0,.15,Math.PI/2]});
  }
  const aura=new THREE.Mesh(new THREE.RingGeometry(.58,.65,36),new THREE.MeshBasicMaterial({color:profile.accent,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));aura.rotation.x=-Math.PI/2;aura.position.y=.035;gear.add(aura);actor.classAura=aura;actor.classGear=gear;
  actor.stowedEquipment=bindStowedSockets(actor,gear);actor.wornEquipment=[];actor.model.traverse(object=>{if(object.userData?.equipmentSlot==='worn')actor.wornEquipment.push(object);});actor.heldEquipment=[];actor.model.traverse(object=>{if(object.userData?.equipmentSlot==='held')actor.heldEquipment.push(object);});
  actor.setEquipmentDrawn?.(false);return gear;
}

export function applyClassPose(actor,profile,progress){
  const wave=Math.sin(progress*Math.PI),armR=rigBone(actor.model,'mixamorig:RightArm'),armL=rigBone(actor.model,'mixamorig:LeftArm'),spine=rigBone(actor.model,'mixamorig:Spine2');
  actor.classPoseBase=actor.classPoseBase||new Map();for(const bone of[armR,armL,spine]){if(!bone)continue;if(!actor.classPoseBase.has(bone))actor.classPoseBase.set(bone,bone.rotation.clone());else bone.rotation.copy(actor.classPoseBase.get(bone));}
  if(profile.pose==='slash'){if(armR)armR.rotation.z-=wave*1.35;if(spine)spine.rotation.y+=Math.sin(progress*Math.PI*2)*.32;}
  if(profile.pose==='smite'){if(armR)armR.rotation.x-=wave*1.15;if(spine)spine.rotation.x-=wave*.18;}
  if(profile.pose==='channel'||profile.pose==='cast'){if(armR)armR.rotation.z-=wave*.9;if(armL)armL.rotation.z+=wave*.9;if(spine)spine.rotation.x-=wave*.12;}
  if(profile.pose==='dual_slash'){if(armR)armR.rotation.z-=wave*1.1;if(armL)armL.rotation.z+=wave*1.1;if(spine)spine.rotation.y+=Math.sin(progress*Math.PI*2)*.25;}
  if(profile.pose==='draw'){if(armR)armR.rotation.z-=wave*.8;if(armL)armL.rotation.z+=wave*.45;if(spine)spine.rotation.y-=wave*.18;}
  if(actor.classAura){actor.classAura.material.opacity=wave*.8;actor.classAura.scale.setScalar(1+wave*1.7);}
}
