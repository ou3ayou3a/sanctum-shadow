import * as THREE from 'three';
import {createMedievalMaterialLibrary} from '../medieval-materials.mjs';

export function buildMolWellShaft(){
  const root=new THREE.Group(),obstacles=[],interactables=[],library=createMedievalMaterialLibrary();
  root.name='Mol — Below the Well';root.userData.interior=true;root.userData.zoneKit='dungeon';
  const stone=library.material('stone',0x605e52,{bumpScale:.06}),iron=library.material('metal',0x39382e),ropeMaterial=new THREE.MeshStandardMaterial({color:0x8d7452,roughness:1});
  const box=(name,x,y,z,w,h,d,material=stone,collision=false)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y+h/2,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);if(collision)obstacles.push({x,z,hw:w/2,hd:d/2});return mesh;};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(9,10),stone);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;root.add(ground);
  box('shaft-west-wall',-4.5,0,0,.4,7,10,stone,true);box('shaft-east-wall',4.5,0,0,.4,7,10,stone,true);
  box('shaft-north-wall',0,0,5,9,7,.4,stone,true);box('shaft-south-wall',0,0,-5,9,7,.4,stone,true);
  box('ancient-sealing-stone',0,0,3.5,3,2.5,.6,stone,true);
  box('old-cross-vertical',0,.7,3.16,.1,.8,.035,iron);box('old-cross-horizontal',0,1.15,3.14,.55,.1,.035,iron);
  const rope=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,12,8),ropeMaterial);rope.name='return-rope';rope.position.set(-2,6,-2.7);root.add(rope);
  const light=new THREE.PointLight(0xe6ba75,20,13,2);light.position.set(-2,3,-2);root.add(light);
  const exit=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,1,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));exit.position.set(-2,.5,-2.7);root.add(exit);
  interactables.push({id:'well_rope_exit',label:'Climb the rope to Mol',object:exit,position:new THREE.Vector3(-2,0,-2.7),range:1.8,actions:[{id:'climb_out',direct:true,label:'Climb out of the well',onSelect:engine=>engine.transitionToWorldLocation('mol_village','Mol — The Village Green')}]});
  return{id:'mol_well_shaft',name:'Mol — The Bottom of the Well',profile:{id:'mol_well_shaft',kit:'dungeon',danger:1},root,ground,obstacles,interactables,npcs:[],spawn:new THREE.Vector3(-2,0,-1.4),bounds:{minX:-4,maxX:4,minZ:-4.5,maxZ:4.5},cameraOffset:new THREE.Vector3(0,8,-7),scene:{background:0x171918,fog:0x171918,fogDensity:.018,exposure:1.3,ambientIntensity:1.5,sunIntensity:.15},dispose(){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
