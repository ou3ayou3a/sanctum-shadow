import * as THREE from 'three';

export class CameraObstruction{
  constructor(engine){this.engine=engine;this.raycaster=new THREE.Raycaster();this.raycaster.camera=engine.camera;this.blocked=new Map();this.elapsed=0;this.occluders=[];engine.zone.root.traverse(object=>{if(!object.isMesh||object.isInstancedMesh||object===engine.zone.ground||object.userData?.interactionId)return;const name=((object.name||'')+' '+(object.parent?.name||'')).toLowerCase();if(/roof|wall|house|keep|tower|gate|building|production/.test(name))this.occluders.push(object);});}
  update(dt){
    this.elapsed+=dt;if(this.elapsed<.09)return;this.elapsed=0;
    const target=this.engine.controls.target,camera=this.engine.camera.position,direction=camera.clone().sub(target),distance=direction.length();if(distance<.1)return;direction.normalize();this.raycaster.set(target,direction);this.raycaster.far=distance-.25;
    const hits=this.raycaster.intersectObjects(this.occluders,false),next=new Set();for(const hit of hits){const mesh=hit.object;next.add(mesh);if(!this.blocked.has(mesh)){const original=Array.isArray(mesh.material)?mesh.material: [mesh.material],faded=original.map(material=>{const clone=material.clone();clone.transparent=true;clone.opacity=Math.min(clone.opacity,.18);clone.depthWrite=false;return clone;});this.blocked.set(mesh,{original,faded});mesh.material=Array.isArray(mesh.material)?faded:faded[0];}}
    for(const [mesh,state]of this.blocked)if(!next.has(mesh)){for(const material of state.faded)material.dispose();mesh.material=state.original.length>1?state.original:state.original[0];this.blocked.delete(mesh);}
  }
  dispose(){for(const [mesh,state]of this.blocked){for(const material of state.faded)material.dispose();mesh.material=state.original.length>1?state.original:state.original[0];}this.blocked.clear();}
}
