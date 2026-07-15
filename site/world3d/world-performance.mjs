import * as THREE from 'three';
import {performanceProfileFor} from './performance-policy.mjs?v=144';

function hierarchyName(object,root){let current=object,name='';while(current&&current!==root){name+=` ${current.name||''}`;current=current.parent;}return name;}

export class WorldPerformanceManager{
  constructor(engine){
    this.engine=engine;this.records=[];this.elapsed=0;this.position=new THREE.Vector3();this.cameraPosition=engine.camera.position;this.stats={tracked:0,culled:0,shadowCasters:0,tiers:{}};
    engine.zone.root.updateMatrixWorld(true);engine.zone.root.traverse(object=>{
      if((!object.isMesh&&!object.isInstancedMesh)||object.isSkinnedMesh||object===engine.zone.ground||object.userData?.interactionId)return;
      const geometry=object.geometry;if(!geometry)return;if(!geometry.boundingSphere)geometry.computeBoundingSphere();const radius=(geometry.boundingSphere?.radius||1)*Math.max(Math.abs(object.scale.x),Math.abs(object.scale.y),Math.abs(object.scale.z)),profile=performanceProfileFor(hierarchyName(object,engine.zone.root),{radius,isInstanced:!!object.isInstancedMesh});
      object.frustumCulled=true;const record={object,profile,originalVisible:object.visible,originalCastShadow:object.castShadow,visible:object.visible};this.records.push(record);this.stats.tiers[profile.tier]=(this.stats.tiers[profile.tier]||0)+1;
    });
    this.stats.tracked=this.records.length;this.refresh(true);
  }

  refresh(force=false){
    let culled=0,shadowCasters=0;for(const record of this.records){const{object,profile}=record;if(!object.parent)continue;object.getWorldPosition(this.position);const distance=this.cameraPosition.distanceTo(this.position),margin=record.visible?4:-4,visible=record.originalVisible&&distance<=profile.cullDistance+margin;if(force||visible!==record.visible){object.visible=visible;record.visible=visible;}if(!visible){culled++;continue;}const castShadow=record.originalCastShadow&&distance<=profile.shadowDistance;if(object.castShadow!==castShadow)object.castShadow=castShadow;if(castShadow)shadowCasters++;}this.stats.culled=culled;this.stats.shadowCasters=shadowCasters;
  }

  update(dt){this.elapsed+=dt;if(this.elapsed<.24)return;this.elapsed=0;this.refresh();}
  snapshot(){return{...this.stats,tiers:{...this.stats.tiers}};}
  dispose(){for(const record of this.records){record.object.visible=record.originalVisible;record.object.castShadow=record.originalCastShadow;}this.records.length=0;}
}
