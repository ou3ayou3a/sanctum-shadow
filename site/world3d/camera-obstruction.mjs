import * as THREE from 'three';

const OCCLUDER_NAMES=/roof|wall|house|keep|tower|gate|building|production|tavern|temple|citadel|church|shop|warehouse|workshop|estate|interior|canopy/;

export class CameraObstruction{
  constructor(engine){
    this.engine=engine;this.raycaster=new THREE.Raycaster();this.raycaster.camera=engine.camera;this.blocked=new Map();this.elapsed=0;this.occluders=[];this.related=new Map();this.target=new THREE.Vector3();this.direction=new THREE.Vector3();this.offset=new THREE.Vector3();this.cameraRight=new THREE.Vector3();
    engine.zone.root.traverse(object=>{
      if(!object.isMesh||object.isInstancedMesh||object===engine.zone.ground||object.userData?.interactionId)return;
      let current=object,name='';while(current&&current!==engine.zone.root){name+=` ${current.name||''}`;current=current.parent;}
      if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();const radius=(object.geometry.boundingSphere?.radius||0)*Math.max(object.scale.x,object.scale.y,object.scale.z);
      if(OCCLUDER_NAMES.test(name.toLowerCase())||radius>1.65)this.occluders.push(object);
    });
    const set=new Set(this.occluders),clusters=new Map();for(const mesh of this.occluders){let cluster=mesh,current=mesh.parent;while(current&&current!==engine.zone.root){if(current.userData?.environmentAsset||OCCLUDER_NAMES.test((current.name||'').toLowerCase()))cluster=current;current=current.parent;}if(!clusters.has(cluster))clusters.set(cluster,[]);clusters.get(cluster).push(mesh);}for(const meshes of clusters.values())for(const mesh of meshes)this.related.set(mesh,meshes);this.occluderRecords=this.occluders.map(object=>({object,position:object.getWorldPosition(new THREE.Vector3())}));this.occluderSet=set;
  }

  fade(mesh){
    if(this.blocked.has(mesh))return this.blocked.get(mesh);
    const original=Array.isArray(mesh.material)?mesh.material:[mesh.material],faded=original.map(material=>{const clone=material.clone();clone.transparent=true;clone.depthWrite=false;clone.colorWrite=true;clone.opacity=material.opacity??1;return clone;}),state={original,faded,target:.12};
    this.blocked.set(mesh,state);mesh.material=Array.isArray(mesh.material)?faded:faded[0];return state;
  }

  relatedMeshes(mesh){
    return this.related.get(mesh)||[mesh];
  }

  restore(mesh,state){for(const material of state.faded)material.dispose();mesh.material=state.original.length>1?state.original:state.original[0];this.blocked.delete(mesh);}

  updateFades(dt){
    const blend=1-Math.exp(-dt*13);for(const[mesh,state]of this.blocked){let restored=true;for(let index=0;index<state.faded.length;index++){const material=state.faded[index],base=state.original[index]?.opacity??1,target=state.target<1?Math.min(base,state.target):base;material.opacity=THREE.MathUtils.lerp(material.opacity,target,blend);if(Math.abs(material.opacity-base)>.015)restored=false;}if(state.target===1&&restored)this.restore(mesh,state);}
  }

  update(dt){
    this.elapsed+=dt;this.updateFades(dt);const quality=this.engine.worldPolish?.quality||'medium',interval=quality==='low'?.18:quality==='high'?.09:.12;if(this.elapsed<interval)return;this.elapsed=0;
    const target=this.engine.controls.target,camera=this.engine.camera.position;this.direction.copy(camera).sub(target);const distance=this.direction.length();if(distance<.1)return;this.direction.normalize();this.cameraRight.setFromMatrixColumn(this.engine.camera.matrixWorld,0).multiplyScalar(.34);
    const candidates=this.occluderRecords.filter(record=>record.object.visible&&(record.position.distanceTo(target)<=distance+8||record.position.distanceTo(camera)<=distance+8)).map(record=>record.object),next=new Set(),origins=quality==='low'?[this.target.copy(target)]:[this.target.copy(target),target.clone().add(this.cameraRight),target.clone().sub(this.cameraRight)];
    for(const origin of origins){this.raycaster.set(origin,this.direction);this.raycaster.far=distance-.18;const hits=this.raycaster.intersectObjects(candidates,false);for(const hit of hits){for(const mesh of this.relatedMeshes(hit.object)){next.add(mesh);this.fade(mesh).target=.045;}}}
    for(const[mesh,state]of this.blocked)if(!next.has(mesh))state.target=1;
  }

  dispose(){for(const[mesh,state]of[...this.blocked])this.restore(mesh,state);this.blocked.clear();this.occluders.length=0;this.occluderRecords.length=0;this.related.clear();this.occluderSet.clear();}
}
