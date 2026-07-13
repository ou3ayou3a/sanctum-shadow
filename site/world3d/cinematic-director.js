import * as THREE from 'three';

const UP=new THREE.Vector3(0,1,0);
const heightFor=actor=>1.45*(actor?.profile?.proportions?.[1]||1);
const facing=(from,to)=>Math.atan2(to.x-from.x,to.z-from.z);

export class CinematicDirector{
  constructor(engine){
    this.engine=engine;this.active=false;this.shot='two';this.position=new THREE.Vector3();this.lookAt=new THREE.Vector3();
    this.onCamera=event=>{const shot=event.detail?.shot;if(this.active&&['two','player','npc'].includes(shot))this.setShot(shot);};
    window.addEventListener('npc:camera',this.onCamera);
  }

  enter(record){
    if(!record?.actor)return;
    if(this.active&&this.record===record)return;
    if(this.active)this.exit();
    const {camera,controls,actor}=this.engine,npc=record.actor;
    this.saved={camera:camera.position.clone(),target:controls.target.clone(),fov:camera.fov,controlsEnabled:controls.enabled,playerRotation:actor.rotation.y,npcRotation:npc.rotation.y,playerRing:actor.selectionRing?.visible,npcRing:npc.selectionRing?.visible};
    this.record=record;this.active=true;actor.stop();npc.stop();actor.rotation.y=facing(actor.position,npc.position);npc.rotation.y=facing(npc.position,actor.position);if(actor.selectionRing)actor.selectionRing.visible=false;if(npc.selectionRing)npc.selectionRing.visible=false;controls.enabled=false;camera.fov=42;camera.updateProjectionMatrix();this.setShot('two',true);
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
    if(saved){camera.position.copy(saved.camera);controls.target.copy(saved.target);camera.fov=saved.fov;camera.updateProjectionMatrix();actor.rotation.y=saved.playerRotation;if(npc)npc.rotation.y=saved.npcRotation;if(actor.selectionRing)actor.selectionRing.visible=saved.playerRing;if(npc?.selectionRing)npc.selectionRing.visible=saved.npcRing;controls.enabled=saved.controlsEnabled;controls.update();}
    this.record=null;this.saved=null;this.shot='two';
  }

  dispose(){this.exit();window.removeEventListener('npc:camera',this.onCamera);}
}
