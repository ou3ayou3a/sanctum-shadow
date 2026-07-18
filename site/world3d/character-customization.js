import * as THREE from 'three';

const bone=(model,name)=>model?.getObjectByName(name)||model?.getObjectByName(name.replace(':',''))||null;
const material=(color,{metalness=0,roughness=.78}={})=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const mesh=(geometry,mat,name)=>{const object=new THREE.Mesh(geometry,mat);object.name=`appearance:${name}`;object.castShadow=true;object.userData.characterAppearance=true;return object;};
function attach(model,boneName,object,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){const target=bone(model,boneName);if(!target)return null;object.position.set(...position);object.rotation.set(...rotation);object.scale.set(...scale);target.add(object);return object;}

function addMedievalBody(model,appearance){
  model.traverse(object=>{if(object.isMesh&&!object.userData.characterAppearance){object.visible=false;object.userData.replacedCharacterBody=true;}});
  const skin=material(appearance.skinColor,{roughness:.82}),[primary,,dark]=appearance.palette,cloth=material(primary,{roughness:.92}),leather=material(dark,{roughness:.9}),iron=material(0x6d7070,{metalness:.58,roughness:.5});
  const part=(boneName,geometry,mat,name,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1])=>attach(model,boneName,mesh(geometry,mat,`body-${name}`),position,rotation,scale);
  part('mixamorig:Head',new THREE.SphereGeometry(6.4,14,10),skin,'head',[0,1,0],[0,0,0],[appearance.face.jaw,.98,1.02]);
  part('mixamorig:Neck',new THREE.CylinderGeometry(3.2,3.5,8,10),skin,'neck',[0,3.2,0]);
  part('mixamorig:Spine2',new THREE.BoxGeometry(23,24,12),cloth,'torso',[0,-5,0],[0,0,0],[appearance.build==='broad'?1.08:appearance.build==='lean'?.94:1,1,1]);
  part('mixamorig:Spine',new THREE.BoxGeometry(20,16,11),cloth,'waist',[0,-3,0]);
  part('mixamorig:Hips',new THREE.CylinderGeometry(12.5,9.5,20,10),cloth,'tunic-skirt',[0,-4,0]);
  part('mixamorig:Hips',new THREE.TorusGeometry(10.2,1.3,7,18),leather,'waist-belt',[0,5,0],[Math.PI/2,0,0]);
  for(const side of['Left','Right']){
    part(`mixamorig:${side}Shoulder`,new THREE.SphereGeometry(4.7,10,7),appearance.armor?iron:cloth,`${side.toLowerCase()}-shoulder`,[0,1,0],[0,0,0],[1.2,.8,1]);
    part(`mixamorig:${side}Arm`,new THREE.CapsuleGeometry(3.7,13,4,8),cloth,`${side.toLowerCase()}-upper-arm`,[0,8,0]);
    part(`mixamorig:${side}ForeArm`,new THREE.CapsuleGeometry(3.25,12,4,8),appearance.armor?iron:leather,`${side.toLowerCase()}-forearm`,[0,7,0]);
    part(`mixamorig:${side}Hand`,new THREE.SphereGeometry(3.8,10,8),skin,`${side.toLowerCase()}-hand`,[0,2.2,0],[0,0,0],[.82,1.05,.7]);
    for(let finger=0;finger<4;finger++)part(`mixamorig:${side}Hand`,new THREE.CapsuleGeometry(.48,2.8,3,6),skin,`${side.toLowerCase()}-finger-${finger}`,[(finger-1.5)*1.05,5.2,0]);
    part(`mixamorig:${side}UpLeg`,new THREE.CapsuleGeometry(4.6,17,4,8),cloth,`${side.toLowerCase()}-thigh`,[0,10,0]);
    part(`mixamorig:${side}Leg`,new THREE.CapsuleGeometry(3.8,17,4,8),leather,`${side.toLowerCase()}-boot`,[0,10,0]);
    part(`mixamorig:${side}Foot`,new THREE.BoxGeometry(7,9,6),leather,`${side.toLowerCase()}-foot`,[0,4,2]);
  }
}

function addHair(model,appearance){
  if(appearance.hair==='shaved')return;
  const hair=material(appearance.hairColor,{roughness:.96}),head=new THREE.Group();head.name=`appearance:hair:${appearance.hair}`;
  const cap=mesh(new THREE.SphereGeometry(7.15,14,10,0,Math.PI*2,0,Math.PI*.57),hair,'hair-cap');cap.position.y=1.7;cap.scale.set(1.02,1,.98);head.add(cap);
  if(appearance.hair==='cropped')cap.scale.y=.72;
  if(appearance.hair==='swept'){for(let i=-2;i<=2;i++){const lock=mesh(new THREE.ConeGeometry(1.35,.25,8,1),hair,'hair-swept-lock');lock.position.set(i*2.2,4.8-i*.25,-.8);lock.rotation.z=-.35;head.add(lock);}}
  if(appearance.hair==='shoulder'){for(const side of[-1,1]){const fall=mesh(new THREE.CapsuleGeometry(2.15,10,4,8),hair,'hair-shoulder');fall.position.set(side*5.2,-3,-1);fall.rotation.z=side*.08;head.add(fall);}}
  if(appearance.hair==='topknot'){const knot=mesh(new THREE.SphereGeometry(3.1,10,8),hair,'hair-knot');knot.position.set(0,8.1,-.8);head.add(knot);}
  if(appearance.hair==='tonsure'){const crown=mesh(new THREE.TorusGeometry(5.2,1.5,7,18),hair,'hair-tonsure');crown.rotation.x=Math.PI/2;crown.position.y=4.5;head.add(crown);cap.visible=false;}
  attach(model,'mixamorig:Head',head,[0,1,0]);
}

function addFace(model,appearance){
  const skin=material(appearance.skinColor,{roughness:.82}),hair=material(appearance.hairColor,{roughness:.98}),group=new THREE.Group();group.name=`appearance:face:${appearance.face.shape}`;
  const jaw=mesh(new THREE.SphereGeometry(4.8,12,8),skin,'jaw');jaw.position.set(0,-3.4,2.2);jaw.scale.set(appearance.face.jaw,.62,.62);group.add(jaw);
  const nose=mesh(new THREE.ConeGeometry(.85+(appearance.face.nose*.12),3.1,8),skin,'nose');nose.position.set(0,.1,6.3);nose.rotation.x=Math.PI/2;group.add(nose);
  for(const side of[-1,1]){const brow=mesh(new THREE.BoxGeometry(3.6,.55,.65),hair,'eyebrow');brow.position.set(side*2.35,2.1,6.05);brow.rotation.z=side*(appearance.face.brow-1)*.08;group.add(brow);}
  if(appearance.age!=='adult')for(const side of[-1,1]){const line=mesh(new THREE.BoxGeometry(2.6,.16,.2),material(0x6d5143,{roughness:1}),'age-line');line.position.set(side*2.4,-.4,6.45);line.rotation.z=side*.12;group.add(line);}
  if(appearance.beard!=='none'){
    const length={stubble:2.3,short:5,full:9,braided:12}[appearance.beard]||5,beard=mesh(new THREE.ConeGeometry(4.9,length,12),hair,`beard-${appearance.beard}`);beard.position.set(0,-4.4,4.4);beard.rotation.x=-.14;group.add(beard);
    if(appearance.beard==='braided'){const tie=mesh(new THREE.TorusGeometry(1.1,.38,6,12),material(appearance.palette[1],{metalness:.45,roughness:.4}),'beard-ring');tie.rotation.x=Math.PI/2;tie.position.set(0,-10,4.1);group.add(tie);}
  }
  attach(model,'mixamorig:Head',group);
}

function addOutfit(model,appearance){
  const [primary,accent,dark]=appearance.palette,cloth=material(primary,{roughness:.9}),trim=material(accent,{metalness:appearance.armor?.45:.08,roughness:appearance.armor?.48:.82}),leather=material(dark,{metalness:.06,roughness:.88}),role=appearance.role;
  const torso=new THREE.Group();torso.name=`appearance:outfit:${role}`;
  const collar=mesh(new THREE.TorusGeometry(8.2,1.35,7,18),role==='guard'?trim:cloth,'collar');collar.rotation.x=Math.PI/2;collar.scale.z=.76;torso.add(collar);
  const chest=mesh(new THREE.BoxGeometry(15.5,17,7.2),appearance.armor?trim:cloth,'chest-layer');chest.position.set(0,-7.2,1);chest.scale.x=appearance.build==='broad'?1.08:appearance.build==='lean'?.92:1;torso.add(chest);
  if(role==='cleric'||role==='scholar'){const stole=mesh(new THREE.BoxGeometry(3.1,24,.75),trim,'stole');stole.position.set(0,-13,5);torso.add(stole);}
  if(role==='worker'){const apron=mesh(new THREE.BoxGeometry(13,22,.8),leather,'apron');apron.position.set(0,-15,5);torso.add(apron);}
  if(role==='merchant'||role==='noble'){const brooch=mesh(new THREE.OctahedronGeometry(2.1),trim,'brooch');brooch.position.set(0,-1,6);torso.add(brooch);const mantle=mesh(new THREE.TorusGeometry(9.2,2.2,8,20,Math.PI),cloth,'mantle');mantle.rotation.set(Math.PI/2,0,Math.PI);mantle.position.y=-2;torso.add(mantle);}
  if(role==='rogue'){const hood=mesh(new THREE.TorusGeometry(7.6,2.4,8,18),leather,'hood');hood.rotation.x=Math.PI/2;hood.position.y=1;torso.add(hood);}
  if(role==='ranger'){const strap=mesh(new THREE.BoxGeometry(3,25,1.2),leather,'ranger-strap');strap.position.set(0,-10,5);strap.rotation.z=-.55;torso.add(strap);}
  attach(model,'mixamorig:Spine2',torso,[0,0,0]);
  const belt=mesh(new THREE.TorusGeometry(8.4,1.15,7,18),leather,'belt');belt.rotation.x=Math.PI/2;attach(model,'mixamorig:Hips',belt,[0,2,0],[0,0,0],[1,.78,1]);
  if(role==='guard'||role==='hostile')for(const side of[-1,1]){const pad=mesh(new THREE.SphereGeometry(4.2,10,7),trim,'pauldron');pad.scale.set(1.3,.7,1);attach(model,side<0?'mixamorig:LeftShoulder':'mixamorig:RightShoulder',pad,[0,0,0]);}
  if(['merchant','noble','cleric','scholar'].includes(role)){const cloak=mesh(new THREE.BoxGeometry(15,24,.7),cloth,'cloak');cloak.position.set(0,-10,-5.5);cloak.rotation.x=.08;attach(model,'mixamorig:Spine2',cloak);}
}

function addFantasyRaceDetails(actor,appearance){
  const head=bone(actor.model,'Head');if(!head)return;const skin=material(appearance.skinColor,{roughness:.82}),hair=material(appearance.hairColor,{roughness:.96}),metal=material(actor.profile.accent,{metalness:.62,roughness:.34}),group=new THREE.Group();group.name=`appearance:fantasy-race:${actor.race}`;
  const ear=(side,size=1)=>{const item=mesh(new THREE.ConeGeometry(.038*size,.16*size,8),skin,'fantasy-ear');item.position.set(side*.115,.09,.005);item.rotation.z=side*Math.PI/2;group.add(item);};
  if(['elf','high_elf','dark_elf'].includes(actor.race)){ear(-1);ear(1);}
  if(actor.race==='goblin'){ear(-1,1.55);ear(1,1.55);const brow=mesh(new THREE.BoxGeometry(.15,.018,.025),skin,'fantasy-brow');brow.position.set(0,.1,.095);group.add(brow);}
  if(actor.race==='dwarf'||appearance.beard!=='none'){const length=actor.race==='dwarf'?.19:appearance.beard==='full'||appearance.beard==='braided'?.15:.085,beard=mesh(new THREE.ConeGeometry(.078,length,10),hair,'fantasy-beard');beard.position.set(0,.015,.065);group.add(beard);}
  if(actor.race==='orc')for(const side of[-1,1]){const tusk=mesh(new THREE.ConeGeometry(.012,.07,7),material(0xd8cfb2,{roughness:.7}),'fantasy-tusk');tusk.position.set(side*.032,.02,.11);tusk.rotation.x=-.25;group.add(tusk);}
  if(['high_elf','dark_elf'].includes(actor.race)){const circlet=mesh(new THREE.TorusGeometry(.105,.008,6,20),metal,'fantasy-circlet');circlet.rotation.x=Math.PI/2;circlet.position.y=.11;group.add(circlet);}
  head.add(group);
}

export function applyCharacterCustomization(actor,appearance){
  if(!actor?.model||!appearance)return null;
  const [x,y,z]=appearance.bodyScale;actor.model.scale.multiply(new THREE.Vector3(x,y,z));
  if(actor.nativeFantasyModel){
    const primary=new THREE.Color(appearance.palette[0]);actor.model.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];for(const item of materials){if(item?.color)item.color.lerp(primary,.28);if(item)item.roughness=Math.max(.52,item.roughness||0);}});
    addFantasyRaceDetails(actor,appearance);
  }else{addMedievalBody(actor.model,appearance);addFace(actor.model,appearance);addHair(actor.model,appearance);addOutfit(actor.model,appearance);}
  actor.userData.appearance=appearance;actor.appearance=appearance;return appearance;
}
