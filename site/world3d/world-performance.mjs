import * as THREE from 'three';
import {performanceProfileFor} from './performance-policy.mjs?v=181';

function hierarchyName(object,root){let current=object,name='';while(current&&current!==root){name+=` ${current.name||''}`;current=current.parent;}return name;}

export class WorldPerformanceManager{
  constructor(engine){
    this.engine=engine;this.records=[];this.lights=[];this.elapsed=0;this.cameraPosition=engine.camera.position;this.stats={tracked:0,culled:0,shadowCasters:0,activeLights:0,tiers:{}};
    engine.zone.root.updateMatrixWorld(true);engine.zone.root.traverse(object=>{
      if(object.isPointLight){this.lights.push({object,position:object.getWorldPosition(new THREE.Vector3()),originalVisible:object.visible});return;}
      if((!object.isMesh&&!object.isInstancedMesh)||object.isSkinnedMesh||object===engine.zone.ground||object.userData?.interactionId)return;
      const geometry=object.geometry;if(!geometry)return;if(!geometry.boundingSphere)geometry.computeBoundingSphere();const radius=(geometry.boundingSphere?.radius||1)*Math.max(Math.abs(object.scale.x),Math.abs(object.scale.y),Math.abs(object.scale.z)),profile=performanceProfileFor(hierarchyName(object,engine.zone.root),{radius,isInstanced:!!object.isInstancedMesh});
      object.frustumCulled=true;const record={object,profile,position:object.getWorldPosition(new THREE.Vector3()),originalVisible:object.visible,originalCastShadow:object.castShadow,visible:object.visible};this.records.push(record);this.stats.tiers[profile.tier]=(this.stats.tiers[profile.tier]||0)+1;
    });
    this.stats.tracked=this.records.length;this.refresh(true);
  }

  refresh(force=false){
    const quality=this.engine.worldPolish?.quality||'medium',distanceScale=quality==='low'?.32:quality==='high'?.72:.48,shadowScale=quality==='low'?0:quality==='high'?.82:.55;
    let culled=0,shadowCasters=0;for(const record of this.records){const{object,profile}=record;if(!object.parent)continue;const distance=this.cameraPosition.distanceTo(record.position),margin=record.visible?4:-4,visible=record.originalVisible&&distance<=profile.cullDistance*distanceScale+margin;if(force||visible!==record.visible){object.visible=visible;record.visible=visible;}if(!visible){culled++;continue;}const castShadow=shadowScale>0&&record.originalCastShadow&&distance<=profile.shadowDistance*shadowScale;if(object.castShadow!==castShadow)object.castShadow=castShadow;if(castShadow)shadowCasters++;}
    const lightBudget=quality==='low'?4:quality==='high'?10:7,nearest=this.lights.map(record=>({record,distance:this.cameraPosition.distanceToSquared(record.position)})).sort((a,b)=>a.distance-b.distance);for(const[index,item]of nearest.entries())item.record.object.visible=item.record.originalVisible&&index<lightBudget;
    this.stats.culled=culled;this.stats.shadowCasters=shadowCasters;this.stats.activeLights=Math.min(lightBudget,nearest.length);
  }

  update(dt){this.elapsed+=dt;if(this.elapsed<.3)return;this.elapsed=0;this.refresh();const render=this.engine.renderer.info.render;this.engine.canvas.dataset.worldDrawCalls=String(render.calls||0);this.engine.canvas.dataset.worldTriangles=String(render.triangles||0);this.engine.canvas.dataset.worldCulled=String(this.stats.culled);this.engine.canvas.dataset.worldLights=String(this.stats.activeLights);}
  snapshot(){return{...this.stats,tiers:{...this.stats.tiers}};}
  dispose(){for(const record of this.records){record.object.visible=record.originalVisible;record.object.castShadow=record.originalCastShadow;}for(const record of this.lights)record.object.visible=record.originalVisible;this.records.length=0;this.lights.length=0;for(const key of['worldDrawCalls','worldTriangles','worldCulled','worldLights'])delete this.engine.canvas.dataset[key];}
}
