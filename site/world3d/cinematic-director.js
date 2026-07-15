import * as THREE from 'three';

const UP=new THREE.Vector3(0,1,0);
const heightFor=actor=>1.45*(actor?.profile?.proportions?.[1]||1);
const facing=(from,to)=>Math.atan2(to.x-from.x,to.z-from.z);

export class CinematicDirector{
  constructor(engine){
    this.engine=engine;this.active=false;this.shot='two';this.position=new THREE.Vector3();this.lookAt=new THREE.Vector3();
    this.onCamera=event=>{const shot=event.detail?.shot;if(this.active&&['wide','two','player','npc'].includes(shot))this.setShot(shot);};
    window.addEventListener('npc:camera',this.onCamera);
  }

  enter(record){
    if(!record?.actor)return;
    if(this.active&&this.record===record)return;
    if(this.active)this.exit();
    const {camera,controls,actor}=this.engine,npc=record.actor;
    const party=[...(this.engine.partyManager?.records?.values?.()||[])].filter(entry=>entry.actor?.visible&&entry.actor.position.distanceTo(actor.position)<8);
    this.saved={camera:camera.position.clone(),target:controls.target.clone(),fov:camera.fov,controlsEnabled:controls.enabled,playerRotation:actor.rotation.y,npcRotation:npc.rotation.y,party:party.map(entry=>({actor:entry.actor,rotation:entry.actor.rotation.y})),playerRing:actor.selectionRing?.visible,npcRing:npc.selectionRing?.visible};
    this.record=record;this.party=party;this.active=true;actor.stop();npc.stop();actor.rotation.y=facing(actor.position,npc.position);npc.rotation.y=facing(npc.position,actor.position);for(const entry of party)entry.actor.rotation.y=facing(entry.actor.position,npc.position);if(actor.selectionRing)actor.selectionRing.visible=false;if(npc.selectionRing)npc.selectionRing.visible=false;controls.enabled=false;camera.fov=42;camera.updateProjectionMatrix();this.setShot('wide',true);clearTimeout(this.introTimer);this.introTimer=setTimeout(()=>{if(this.active&&this.shot==='wide')this.setShot('two');},850);
  }

  setShot(shot,immediate=false){this.shot=shot;this.compose();if(immediate){this.engine.camera.position.copy(this.position);this.engine.controls.target.copy(this.lookAt);this.engine.camera.lookAt(this.lookAt);}}

  compose(){
    const player=this.engine.actor,npc=this.record?.actor;if(!player||!npc)return;
    const direction=npc.position.clone().sub(player.position).setY(0);if(direction.lengthSq()<.01)direction.set(0,0,1);direction.normalize();
    const side=new THREE.Vector3(-direction.z,0,direction.x),playerHead=player.position.clone().addScaledVector(UP,heightFor(player)),npcHead=npc.position.clone().addScaledVector(UP,heightFor(npc));
    if(this.shot==='npc'){
      this.position.copy(player.position).addScaledVector(direction,-1.12).addScaledVector(side,.9).addScaledVector(UP,heightFor(player)*1.08);
      this.lookAt.copy(npcHead).addScaledVector(side,-.08);
    }else if(this.shot==='player'){
      this.position.copy(npc.position).addScaledVector(direction,1.12).addScaledVector(side,-.9).addScaledVector(UP,heightFor(npc)*1.08);
      this.lookAt.copy(playerHead).addScaledVector(side,.08);
    }else if(this.shot==='wide'){
      const center=player.position.clone().lerp(npc.position,.5);for(const entry of this.party||[])center.lerp(entry.actor.position,.16);this.lookAt.copy(center).addScaledVector(UP,1.15);this.position.copy(center).addScaledVector(side,6.4).addScaledVector(direction,-1.35).addScaledVector(UP,4.2);
    }else{
      this.lookAt.copy(playerHead).lerp(npcHead,.5);
      this.position.copy(player.position).lerp(npc.position,.5).addScaledVector(side,4.15).addScaledVector(direction,-.45).addScaledVector(UP,2.35);
    }
  }

  update(dt){
    if(!this.active)return;this.compose();const blend=1-Math.exp(-dt*7.5);this.engine.camera.position.lerp(this.position,blend);this.engine.controls.target.lerp(this.lookAt,blend);this.engine.camera.lookAt(this.engine.controls.target);
  }

  exit(){
    if(!this.active)return;const {camera,controls,actor}=this.engine,npc=this.record?.actor,saved=this.saved;this.active=false;
    clearTimeout(this.introTimer);if(saved){camera.position.copy(saved.camera);controls.target.copy(saved.target);camera.fov=saved.fov;camera.updateProjectionMatrix();actor.rotation.y=saved.playerRotation;if(npc)npc.rotation.y=saved.npcRotation;for(const entry of saved.party||[])entry.actor.rotation.y=entry.rotation;if(actor.selectionRing)actor.selectionRing.visible=saved.playerRing;if(npc?.selectionRing)npc.selectionRing.visible=saved.npcRing;controls.enabled=saved.controlsEnabled;controls.update();}
    this.record=null;this.party=[];this.saved=null;this.shot='two';
  }

  dispose(){this.exit();window.removeEventListener('npc:camera',this.onCamera);}
}
