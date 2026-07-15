import * as THREE from 'three';
import {cinematicDurationFor,cinematicShotFor,normalizeCinematicKind} from './cinematic-policy.mjs?v=145';

const UP=new THREE.Vector3(0,1,0);
const DIALOGUE_SHOTS=new Set(['wide','two','player','npc']);
const heightFor=actor=>1.45*(actor?.profile?.proportions?.[1]||1);
const facing=(from,to)=>Math.atan2(to.x-from.x,to.z-from.z);
const pointFor=value=>value?.position?.clone?.()||value?.clone?.()||new THREE.Vector3(value?.x||0,value?.y||0,value?.z||0);

export class CinematicDirector{
  constructor(engine){
    this.engine=engine;this.active=false;this.mode=null;this.phase='idle';this.shot='two';this.position=new THREE.Vector3();this.lookAt=new THREE.Vector3();this.shake=0;this.elapsed=0;this.reducedMotion=document.body.classList.contains('ui-reduce-motion');
    this.onCamera=event=>{const shot=event.detail?.shot;if(this.active&&this.mode==='conversation'&&DIALOGUE_SHOTS.has(shot))this.setShot(shot);};
    window.addEventListener('npc:camera',this.onCamera);
  }

  capture(){const{camera,controls}=this.engine;return{camera:camera.position.clone(),target:controls.target.clone(),fov:camera.fov,controlsEnabled:controls.enabled};}
  engage(){this.active=true;this.phase='presenting';this.elapsed=0;this.engine.controls.enabled=false;document.body.classList.toggle('world3d-moment-active',this.mode==='moment');}

  enter(record){
    if(!record?.actor)return false;if(this.active&&this.mode==='conversation'&&this.record===record)return true;if(this.active)this.finish(true);
    const{camera,actor}=this.engine,npc=record.actor,party=[...(this.engine.partyManager?.records?.values?.()||[])].filter(entry=>entry.actor?.visible&&entry.actor.position.distanceTo(actor.position)<8);
    this.saved={...this.capture(),playerRotation:actor.rotation.y,npcRotation:npc.rotation.y,party:party.map(entry=>({actor:entry.actor,rotation:entry.actor.rotation.y})),playerRing:actor.selectionRing?.visible,npcRing:npc.selectionRing?.visible};
    this.mode='conversation';this.record=record;this.party=party;this.source=actor;this.target=npc;this.engage();actor.stop();npc.stop();actor.rotation.y=facing(actor.position,npc.position);npc.rotation.y=facing(npc.position,actor.position);for(const entry of party)entry.actor.rotation.y=facing(entry.actor.position,npc.position);if(actor.selectionRing)actor.selectionRing.visible=false;if(npc.selectionRing)npc.selectionRing.visible=false;camera.fov=42;camera.updateProjectionMatrix();this.setShot('wide',true);clearTimeout(this.introTimer);this.introTimer=setTimeout(()=>{if(this.active&&this.mode==='conversation'&&this.shot==='wide')this.setShot('two');},850);return true;
  }

  playMoment(kind,source=this.engine.actor,target=null,{duration=null,caption='',subcaption=''}={}){
    const normalized=normalizeCinematicKind(kind);if(this.active&&this.mode==='conversation')return false;
    if(!this.active){this.saved=this.capture();this.mode='moment';this.engage();}else{this.mode='moment';this.phase='presenting';document.body.classList.add('world3d-moment-active');}
    this.kind=normalized;this.source=source||this.engine.actor;this.target=target;this.shot=cinematicShotFor(normalized);this.elapsed=0;clearTimeout(this.momentTimer);const length=duration??cinematicDurationFor(normalized,this.reducedMotion);if(caption)this.caption(caption,subcaption,length);this.momentTimer=setTimeout(()=>this.release(),Math.max(.12,length)*1000);return true;
  }

  caption(title,subtitle='',duration=1.2){this.captionElement?.remove();const element=document.createElement('div');element.className='world3d-cinematic-caption';element.setAttribute('role','status');const strong=document.createElement('strong');strong.textContent=title;element.appendChild(strong);if(subtitle){const small=document.createElement('span');small.textContent=subtitle;element.appendChild(small);}this.engine.overlay.appendChild(element);this.captionElement=element;requestAnimationFrame(()=>element.classList.add('visible'));clearTimeout(this.captionTimer);this.captionTimer=setTimeout(()=>{element.classList.remove('visible');setTimeout(()=>element.remove(),260);if(this.captionElement===element)this.captionElement=null;},Math.max(.5,duration)*1000);}
  addImpact(amount=.08){if(this.reducedMotion)return;this.shake=Math.max(this.shake,THREE.MathUtils.clamp(amount,0,.2));}
  setShot(shot,immediate=false){this.shot=shot;this.compose();if(immediate){this.engine.camera.position.copy(this.position);this.engine.controls.target.copy(this.lookAt);this.engine.camera.lookAt(this.lookAt);}}

  composeConversation(){
    const player=this.engine.actor,npc=this.record?.actor;if(!player||!npc)return;const direction=pointFor(npc).sub(player.position).setY(0);if(direction.lengthSq()<.01)direction.set(0,0,1);direction.normalize();const side=new THREE.Vector3(-direction.z,0,direction.x),playerHead=player.position.clone().addScaledVector(UP,heightFor(player)),npcHead=npc.position.clone().addScaledVector(UP,heightFor(npc));
    if(this.shot==='npc'){this.position.copy(player.position).addScaledVector(direction,-1.12).addScaledVector(side,.9).addScaledVector(UP,heightFor(player)*1.08);this.lookAt.copy(npcHead).addScaledVector(side,-.08);}
    else if(this.shot==='player'){this.position.copy(npc.position).addScaledVector(direction,1.12).addScaledVector(side,-.9).addScaledVector(UP,heightFor(npc)*1.08);this.lookAt.copy(playerHead).addScaledVector(side,.08);}
    else if(this.shot==='wide'){const center=player.position.clone().lerp(npc.position,.5);for(const entry of this.party||[])center.lerp(entry.actor.position,.16);this.lookAt.copy(center).addScaledVector(UP,1.15);this.position.copy(center).addScaledVector(side,6.4).addScaledVector(direction,-1.35).addScaledVector(UP,4.2);}
    else{this.lookAt.copy(playerHead).lerp(npcHead,.5);this.position.copy(player.position).lerp(npc.position,.5).addScaledVector(side,4.15).addScaledVector(direction,-.45).addScaledVector(UP,2.35);}
  }

  composeMoment(){
    const source=this.source||this.engine.actor,sourcePoint=pointFor(source),targetPoint=this.target?pointFor(this.target):sourcePoint.clone().add(new THREE.Vector3(Math.sin(source.rotation?.y||0)*3,0,Math.cos(source.rotation?.y||0)*3)),direction=targetPoint.clone().sub(sourcePoint).setY(0);if(direction.lengthSq()<.01)direction.set(0,0,1);direction.normalize();const side=new THREE.Vector3(-direction.z,0,direction.x),sourceHead=sourcePoint.clone().addScaledVector(UP,heightFor(source)),targetHead=targetPoint.clone().addScaledVector(UP,heightFor(this.target));
    if(this.shot==='combat_wide'){const center=sourcePoint.clone().lerp(targetPoint,.5);this.lookAt.copy(center).addScaledVector(UP,1.15);this.position.copy(center).addScaledVector(side,6.2).addScaledVector(direction,-1.8).addScaledVector(UP,4.5);}
    else if(this.shot==='attack'||this.shot==='spell'){this.lookAt.copy(targetHead);this.position.copy(sourceHead).addScaledVector(direction,-2.35).addScaledVector(side,this.shot==='spell'?1.45:1.1).addScaledVector(UP,.65);}
    else if(this.shot==='finisher'){this.lookAt.copy(sourceHead).lerp(targetHead,.6);this.position.copy(sourcePoint).lerp(targetPoint,.5).addScaledVector(side,3.1).addScaledVector(direction,-.35).addScaledVector(UP,2.05);}
    else if(this.shot==='victory'){const orbit=this.elapsed*.55+.6;this.lookAt.copy(sourceHead);this.position.copy(sourcePoint).add(new THREE.Vector3(Math.sin(orbit)*4.4,2.65,Math.cos(orbit)*4.4));}
    else{this.lookAt.copy(sourceHead).lerp(targetHead,.58);this.position.copy(sourcePoint).lerp(targetPoint,.45).addScaledVector(side,3.7).addScaledVector(direction,-1.05).addScaledVector(UP,2.85);}
  }

  compose(){if(this.mode==='conversation')this.composeConversation();else this.composeMoment();}
  release(duration=.42){if(!this.active||this.phase==='restoring')return;clearTimeout(this.momentTimer);this.phase='restoring';this.restoreDuration=this.reducedMotion ? 0.08 : Math.max(.12,duration);this.restoreElapsed=0;}

  update(dt){
    if(!this.active)return;this.elapsed+=dt;const{camera,controls}=this.engine;
    if(this.phase==='restoring'&&this.saved){this.restoreElapsed+=dt;const blend=1-Math.exp(-dt*10);camera.position.lerp(this.saved.camera,blend);controls.target.lerp(this.saved.target,blend);camera.fov=THREE.MathUtils.lerp(camera.fov,this.saved.fov,blend);camera.updateProjectionMatrix();camera.lookAt(controls.target);if(this.restoreElapsed>=this.restoreDuration||camera.position.distanceToSquared(this.saved.camera)<.0025)this.finish();return;}
    this.compose();const blend=1-Math.exp(-dt*(this.mode==='conversation'?7.5:9));camera.position.lerp(this.position,blend);controls.target.lerp(this.lookAt,blend);const desiredFov=this.shot==='combat_wide'?46:this.shot==='attack'||this.shot==='spell'?38:42;camera.fov=THREE.MathUtils.lerp(camera.fov,desiredFov,blend);camera.updateProjectionMatrix();if(this.shake>.001){camera.position.x+=(Math.random()-.5)*this.shake;camera.position.y+=(Math.random()-.5)*this.shake*.7;this.shake*=Math.exp(-dt*18);}camera.lookAt(controls.target);
  }

  exit({immediate=false}={}){if(!this.active)return;if(immediate)this.finish(true);else this.release(this.mode==='conversation'?.5:.34);}
  finish(immediate=false){
    if(!this.active&&!this.saved)return;const{camera,controls,actor}=this.engine,npc=this.record?.actor,saved=this.saved;clearTimeout(this.introTimer);clearTimeout(this.momentTimer);if(saved){camera.position.copy(saved.camera);controls.target.copy(saved.target);camera.fov=saved.fov;camera.updateProjectionMatrix();controls.enabled=saved.controlsEnabled;}if(this.mode==='conversation'&&saved){actor.rotation.y=saved.playerRotation;if(npc)npc.rotation.y=saved.npcRotation;for(const entry of saved.party||[])entry.actor.rotation.y=entry.rotation;if(actor.selectionRing)actor.selectionRing.visible=saved.playerRing;if(npc?.selectionRing)npc.selectionRing.visible=saved.npcRing;}controls.update();document.body.classList.remove('world3d-moment-active');this.active=false;this.mode=null;this.phase='idle';this.record=null;this.party=[];this.source=null;this.target=null;this.saved=null;this.shot='two';this.shake=0;if(immediate)this.captionElement?.remove();
  }
  dispose(){this.exit({immediate:true});clearTimeout(this.captionTimer);this.captionElement?.remove();window.removeEventListener('npc:camera',this.onCamera);}
}
