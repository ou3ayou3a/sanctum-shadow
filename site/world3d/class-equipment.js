import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const EQUIPMENT_ROOT='world3d/assets/production/equipment';
const EQUIPMENT_CACHE=new Map();
async function productionEquipment(name){
  const url=`${EQUIPMENT_ROOT}/${name}.glb`;
  if(!EQUIPMENT_CACHE.has(url))EQUIPMENT_CACHE.set(url,new GLTFLoader().loadAsync(url).then(gltf=>gltf.scene).catch(error=>{EQUIPMENT_CACHE.delete(url);throw error;}));
  const object=(await EQUIPMENT_CACHE.get(url)).clone(true);object.name=`production-equipment:${name}`;object.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;}});return object;
}

const material=(color,{metalness=.55,roughness=.38,emissive=0,emissiveIntensity=0}={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
const box=(w,h,d,mat)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
const cylinder=(radius,height,mat,segments=12)=>new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,segments),mat);
function attach(model,boneName,object,{position=[0,0,0],rotation=[0,0,0]}={}){const bone=model.getObjectByName(boneName);if(!bone)return null;object.position.set(...position);object.rotation.set(...rotation);object.userData.equipmentSlot='held';object.traverse(o=>{if(o.isMesh)o.castShadow=true;});bone.add(object);return object;}
function sword(profile,length=58){const group=new THREE.Group(),steel=material(profile.metal),accent=material(profile.accent,{metalness:.7,roughness:.28});const blade=box(4,length,1.8,steel);blade.position.y=length*.48;group.add(blade);const tip=new THREE.Mesh(new THREE.ConeGeometry(2.2,8,4),steel);tip.position.y=length+3;group.add(tip);const guard=box(18,2.2,3,accent);group.add(guard);const grip=cylinder(1.5,14,material(0x39291d,{metalness:.05,roughness:.9}));grip.position.y=-7;group.add(grip);return group;}
function dagger(profile){const group=sword(profile,25);group.scale.setScalar(.75);return group;}
function shield(profile){const group=new THREE.Group(),face=new THREE.Mesh(new THREE.CylinderGeometry(17,17,3,10),material(profile.metal,{metalness:.65,roughness:.42}));face.rotation.x=Math.PI/2;group.add(face);const boss=new THREE.Mesh(new THREE.SphereGeometry(5,12,8),material(profile.accent,{metalness:.8,roughness:.25}));boss.position.z=2.2;group.add(boss);return group;}
function staff(profile,arcane=false){const group=new THREE.Group(),shaft=cylinder(1.8,82,material(0x5b3e27,{metalness:.05,roughness:.86}));shaft.position.y=28;group.add(shaft);const head=new THREE.Mesh(arcane?new THREE.OctahedronGeometry(7):new THREE.TorusGeometry(7,1.6,8,20),material(profile.accent,{metalness:.3,roughness:.25,emissive:profile.accent,emissiveIntensity:1.5}));head.position.y=72;if(!arcane)head.rotation.x=Math.PI/2;group.add(head);const light=new THREE.PointLight(profile.accent,3,2.4);light.position.y=72;group.add(light);return group;}
function mace(profile){const group=new THREE.Group(),handle=cylinder(1.8,52,material(0x4a3424,{metalness:.1,roughness:.8}));handle.position.y=18;group.add(handle);const head=new THREE.Mesh(new THREE.DodecahedronGeometry(8),material(profile.accent,{metalness:.75,roughness:.3}));head.position.y=48;group.add(head);return group;}
function bow(profile){const group=new THREE.Group(),arc=new THREE.Mesh(new THREE.TorusGeometry(30,1.7,8,34,Math.PI*1.55),material(0x7b4f2d,{metalness:.05,roughness:.85}));arc.rotation.z=.72;group.add(arc);const points=[new THREE.Vector3(-21,21,0),new THREE.Vector3(5,0,0),new THREE.Vector3(21,-21,0)];group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xded4b8})));return group;}
function stow(parent,object,position,rotation,scale=.012){object.scale.setScalar(scale);object.position.set(...position);object.rotation.set(...rotation);object.userData.equipmentSlot='stowed';parent.add(object);return object;}

export async function equipClass(actor,profile){
  const gear=new THREE.Group();gear.name=`class-gear:${profile.id}`;actor.add(gear);
  try{
    if(profile.weapon==='greatsword'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('greatsword'),{position:[0,8,0],rotation:[0,0,.05]});stow(gear,await productionEquipment('greatsword'),[.42,.78,-.22],[.08,.12,-.5]);}
    if(profile.weapon==='mace_shield'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('mace'),{position:[0,7,0]});attach(actor.model,'mixamorig:LeftForeArm',await productionEquipment('shield'),{position:[0,16,7],rotation:[0,0,0]});stow(gear,await productionEquipment('mace'),[.36,.72,-.22],[.05,.1,-.35]);stow(gear,await productionEquipment('shield'),[-.38,1.02,-.24],[0,0,.08]);}
    if(profile.weapon==='holy_staff'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('holy_staff'),{position:[0,4,0],rotation:[0,0,.08]});stow(gear,await productionEquipment('holy_staff'),[.4,.46,-.25],[.04,.08,-.18]);}
    if(profile.weapon==='arcane_staff'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('arcane_staff'),{position:[0,4,0],rotation:[0,0,.08]});stow(gear,await productionEquipment('arcane_staff'),[.4,.46,-.25],[.04,.08,-.18]);}
    if(profile.weapon==='twin_daggers'){attach(actor.model,'mixamorig:RightHand',await productionEquipment('dagger'),{position:[0,5,0]});attach(actor.model,'mixamorig:LeftHand',await productionEquipment('dagger'),{position:[0,5,0]});stow(gear,await productionEquipment('dagger'),[.32,.72,-.28],[.1,.1,-.7],.014);stow(gear,await productionEquipment('dagger'),[-.32,.72,-.28],[-.1,-.1,.7],.014);}
    if(profile.weapon==='bow_quiver'){
    attach(actor.model,'mixamorig:LeftHand',await productionEquipment('bow'),{position:[0,7,0],rotation:[0,.15,0]});stow(gear,await productionEquipment('bow'),[-.38,1.05,-.27],[.08,.15,-.35]);
    const quiver=new THREE.Group(),tube=cylinder(.11,.85,material(0x5f3c25,{metalness:.05,roughness:.9}),10);tube.position.y=.42;quiver.add(tube);for(let i=0;i<5;i++){const arrow=cylinder(.012,1.12,material(0xb7a47a,{metalness:.05,roughness:.8}),6);arrow.position.set((i-2)*.035,.82,(i%2)*.025);quiver.add(arrow);}quiver.position.set(.38,.75,-.24);quiver.rotation.z=-.28;gear.add(quiver);
    }
  }catch(error){
    console.warn(`Production equipment failed for ${profile.id}; using procedural fallback.`,error);
    if(profile.weapon==='greatsword')attach(actor.model,'mixamorig:RightHand',sword(profile),{position:[0,8,0],rotation:[0,0,.05]});
    if(profile.weapon==='mace_shield'){attach(actor.model,'mixamorig:RightHand',mace(profile),{position:[0,7,0]});attach(actor.model,'mixamorig:LeftForeArm',shield(profile),{position:[0,16,7]});}
    if(profile.weapon==='holy_staff')attach(actor.model,'mixamorig:RightHand',staff(profile,false),{position:[0,4,0],rotation:[0,0,.08]});
    if(profile.weapon==='arcane_staff')attach(actor.model,'mixamorig:RightHand',staff(profile,true),{position:[0,4,0],rotation:[0,0,.08]});
    if(profile.weapon==='twin_daggers'){attach(actor.model,'mixamorig:RightHand',dagger(profile),{position:[0,5,0]});attach(actor.model,'mixamorig:LeftHand',dagger(profile),{position:[0,5,0]});}
    if(profile.weapon==='bow_quiver')attach(actor.model,'mixamorig:LeftHand',bow(profile),{position:[0,7,0],rotation:[0,.15,0]});
  }
  const aura=new THREE.Mesh(new THREE.RingGeometry(.58,.65,36),new THREE.MeshBasicMaterial({color:profile.accent,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));aura.rotation.x=-Math.PI/2;aura.position.y=.035;gear.add(aura);actor.classAura=aura;actor.classGear=gear;
  actor.heldEquipment=[];actor.stowedEquipment=[];actor.model.traverse(object=>{if(object.userData?.equipmentSlot==='held')actor.heldEquipment.push(object);});gear.traverse(object=>{if(object.userData?.equipmentSlot==='stowed')actor.stowedEquipment.push(object);});
  actor.setEquipmentDrawn?.(false);return gear;
}

export function applyClassPose(actor,profile,progress){
  const wave=Math.sin(progress*Math.PI),armR=actor.model.getObjectByName('mixamorig:RightArm'),armL=actor.model.getObjectByName('mixamorig:LeftArm'),spine=actor.model.getObjectByName('mixamorig:Spine2');
  if(profile.pose==='slash'){if(armR)armR.rotation.z-=wave*1.35;if(spine)spine.rotation.y+=Math.sin(progress*Math.PI*2)*.32;}
  if(profile.pose==='smite'){if(armR)armR.rotation.x-=wave*1.15;if(spine)spine.rotation.x-=wave*.18;}
  if(profile.pose==='channel'||profile.pose==='cast'){if(armR)armR.rotation.z-=wave*.9;if(armL)armL.rotation.z+=wave*.9;if(spine)spine.rotation.x-=wave*.12;}
  if(profile.pose==='dual_slash'){if(armR)armR.rotation.z-=wave*1.1;if(armL)armL.rotation.z+=wave*1.1;if(spine)spine.rotation.y+=Math.sin(progress*Math.PI*2)*.25;}
  if(profile.pose==='draw'){if(armR)armR.rotation.z-=wave*.8;if(armL)armL.rotation.z+=wave*.45;if(spine)spine.rotation.y-=wave*.18;}
  if(actor.classAura){actor.classAura.material.opacity=wave*.8;actor.classAura.scale.setScalar(1+wave*1.7);}
}
