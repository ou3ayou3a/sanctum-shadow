import * as THREE from 'three';

export function createInteriorKit({root,obstacles,materials,definition}){
  const clothColor=new THREE.Color(definition.accent||0x8f5548).lerp(new THREE.Color(0x281915),.72),animated=[],width=definition.size[0],depth=definition.size[2],timber=materials.material('timber',0x754b2d),dark=materials.material('timber',0x51321f),stone=materials.material('stone',0x897d69),metal=materials.material('metal',0x50534d,{metalness:.68,roughness:.45}),cloth=new THREE.MeshStandardMaterial({color:clothColor,roughness:.94,side:THREE.DoubleSide});
  const mesh=(geometry,material,position=[0,0,0],rotation=[0,0,0],name='interior-detail')=>{const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.rotation.set(...rotation);object.name=name;object.castShadow=object.receiveShadow=true;root.add(object);return object;};
  const box=(x,z,w,h,d,material=timber,{y=0,rotation=0,collision=false,name='interior-fixture'}={})=>{const object=mesh(new THREE.BoxGeometry(w,h,d),material,[x,y+h/2,z],[0,rotation,0],name);if(collision){const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));obstacles.push({x,z,hw:c*w/2+s*d/2,hd:s*w/2+c*d/2});}return object;};
  const cylinder=(x,z,r,h,material=timber,y=0,name='interior-cylinder')=>mesh(new THREE.CylinderGeometry(r,r,h,16),material,[x,y+h/2,z],[0,0,0],name);
  const fixtureKind=definition.kind;
  if(fixtureKind==='tavern'){
    box(0,depth/2-1.25,width*.55,1.05,.72,dark,{collision:true,name:'interior-bar'});
    for(const x of[-width*.25,width*.25]){box(x,-.7,2.2,.15,1.1,timber,{y:.82,collision:true,name:'interior-table'});for(const side of[-1,1])box(x+side*.75,-.7,.18,.8,.18,dark,{name:'table-leg'});}
    for(let i=0;i<5;i++)cylinder(-width/2+1.15+i*.52,depth/2-1.05,.16,.55,stone,.02,'tavern-bottle');
  }else if(fixtureKind==='archive'){
    for(const x of[-width/2+1,width/2-1]){box(x,.4,.75,3.2,depth*.55,dark,{collision:true,name:'archive-shelf'});for(const y of[.7,1.5,2.3])box(x,.4,.95,.1,depth*.5,timber,{y,name:'shelf-board'});}
    box(0,1.2,3,.18,1.5,timber,{y:.82,collision:true,name:'archive-reading-table'});
  }else if(fixtureKind==='temple'){
    box(0,depth/2-1.65,4.1,.75,2.4,stone,{collision:true,name:'temple-altar-dais'});box(0,depth/2-1.65,2.4,1.5,1.1,stone,{y:.75,collision:true,name:'layered-temple-altar'});
    for(const x of[-width*.3,width*.3])for(const z of[-2.4,0,2.4])box(x,z,2.1,.55,.42,dark,{collision:true,name:'temple-pew'});
  }else if(fixtureKind==='castle'){
    box(0,depth/2-1.55,4.2,.42,2.2,stone,{collision:true,name:'command-dais'});box(0,depth/2-1.55,2.1,2.3,.7,dark,{y:.42,collision:true,name:'oath-seat'});
    for(const x of[-width/2+1.35,width/2-1.35])box(x,.5,.7,2.5,depth*.45,metal,{collision:true,name:'armory-rack'});
  }else if(fixtureKind==='house'){
    box(0,depth/2-1.1,2.4,1.9,1.3,stone,{collision:true,name:'house-hearth'});box(-width*.22,.2,2.2,.16,1.2,timber,{y:.78,collision:true,name:'house-table'});box(width*.25,1.15,1.7,.55,2.5,dark,{collision:true,name:'house-bed'});
  }else{
    for(const x of[-width*.29,width*.29]){box(x,1.8,1.55,2.7,depth*.38,metal,{collision:true,name:'dungeon-cell-bars'});for(let z=-.2;z<depth*.38;z+=.55)cylinder(x,z,.055,2.5,metal,.1,'cell-bar');}
    box(0,depth/2-1.45,3.1,.8,1.4,stone,{collision:true,name:'dungeon-altar'});
  }

  // A real hinged door provides visual continuity during entrance transitions.
  const pivot=new THREE.Group();pivot.position.set(-1.1,0,-depth/2+.24);pivot.name='animated-interior-exit-door';root.add(pivot);const door=box(1.1,-depth/2+.24,2.2,2.75,.18,timber,{name:'interior-exit-door'});root.remove(door);door.position.set(1.1,1.375,0);pivot.add(door);for(const y of[.55,1.38,2.2]){const band=new THREE.Mesh(new THREE.BoxGeometry(2.05,.1,.22),metal);band.position.set(1.1,y,0);band.name='door-iron-band';pivot.add(band);}const handle=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),metal);handle.position.set(1.78,1.35,-.14);pivot.add(handle);
  const openDoor=()=>{animated.push({kind:'door',object:pivot,target:-1.22});};

  root.add(new THREE.HemisphereLight(0xffe6bd,0x302820,1.45));const lightColor=definition.accent||0xff9b52;for(const x of[-width*.28,width*.28]){const light=new THREE.PointLight(lightColor,10,12,1.65);light.position.set(x,3.5,0);root.add(light);const flame=mesh(new THREE.ConeGeometry(.1,.34,8),new THREE.MeshStandardMaterial({color:0xffcf78,emissive:lightColor,emissiveIntensity:4,transparent:true,opacity:.86}),[x,2.65,0],[0,0,0],'interior-flame');animated.push({kind:'flame',object:flame,phase:x});}
  const motes=[];for(let i=0;i<18;i++){const mote=mesh(new THREE.SphereGeometry(.018,5,4),new THREE.MeshBasicMaterial({color:0xd9c28d,transparent:true,opacity:.22,depthWrite:false}),[(i*1.91%width)-width/2+.5,.5+(i*.73%2.8),(i*2.37%depth)-depth/2+.7],[0,0,0],'interior-dust');mote.castShadow=mote.receiveShadow=false;motes.push({object:mote,base:mote.position.y,phase:i*.61});}
  return{openDoor,update(time,dt=.016){for(const item of animated){if(item.kind==='door')item.object.rotation.y=THREE.MathUtils.damp(item.object.rotation.y,item.target,8,dt);else item.object.scale.y=.84+Math.sin(time*9+item.phase)*.16;}for(const mote of motes){mote.object.position.y=mote.base+(time*.08+mote.phase)%1.2;mote.object.material.opacity=.12+.1*Math.sin(time*.7+mote.phase);}}};
}

export function createInteriorEntrance({root,definition,materials}){
  const [x,z]=definition.entrance||[0,-7],group=new THREE.Group();group.position.set(x,0,z);group.name=`physical-entrance:${definition.id}`;root.add(group);const stone=materials.material('stone',0x5c5549),timber=materials.material('timber',0x422719),metal=materials.material('metal',0x30332f,{metalness:.7});
  const add=(geometry,material,position,name)=>{const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.name=name;object.castShadow=object.receiveShadow=true;group.add(object);return object;};
  add(new THREE.BoxGeometry(3.2,.42,.7),stone,[0,.21,0],'entrance-threshold');add(new THREE.BoxGeometry(.42,3.3,.6),stone,[-1.42,1.65,0],'entrance-left-jamb');add(new THREE.BoxGeometry(.42,3.3,.6),stone,[1.42,1.65,0],'entrance-right-jamb');add(new THREE.BoxGeometry(3.25,.42,.65),stone,[0,3.1,0],'entrance-lintel');const pivot=new THREE.Group();pivot.position.set(-1.18,.2,.04);group.add(pivot);const door=add(new THREE.BoxGeometry(2.36,2.7,.16),timber,[0,0,0],'entrance-door');group.remove(door);door.position.set(1.18,1.35,0);pivot.add(door);for(const y of[.55,1.35,2.15]){const band=new THREE.Mesh(new THREE.BoxGeometry(2.15,.1,.2),metal);band.position.set(1.18,y,0);pivot.add(band);}return{position:new THREE.Vector3(x,0,z),open(){pivot.rotation.y=-1.18;}};
}
