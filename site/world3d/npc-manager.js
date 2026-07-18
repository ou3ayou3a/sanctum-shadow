import * as THREE from 'three';
import {CharacterActor} from './character-actor.js?v=179';
import {ambientDelay,ambientGesture} from './animation-policy.mjs?v=163';
import {npcActorBudget,npcStreamRadius,selectNpcActorIds} from './actor-streaming-policy.mjs?v=182';

export class NPCManager{
  constructor(engine,configs=[]){this.engine=engine;this.configs=configs;this.records=[];this.modelUrl=engine.characterConfig.modelUrl;this.streamElapsed=0;this.streaming=false;}

  async initialize(){for(const[index,config]of this.configs.entries())this.register(config,index);await this.refreshStreaming(true);return this;}

  register(config,index){
    const position=new THREE.Vector3(...config.position);
    const collider=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,3,10),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));collider.position.copy(position);collider.position.y=1.45;collider.userData.npcId=config.id;this.engine.scene.add(collider);
    const label=document.createElement('button');label.type='button';label.className='world3d-npc-label';label.dataset.npcAction=config.action||'dialogue';label.setAttribute('aria-label',`${config.action==='shop'?'Trade with':'Speak with'} ${config.name}`);label.innerHTML=`<strong>${config.name}</strong><span>${config.title}</span>`;label.style.display='none';this.engine.overlay.appendChild(label);
    const interaction={id:`npc:${config.id}`,object:collider,position,range:2.3,label:config.action==='shop'?`Trade with ${config.name}`:config.action==='ambient'?`Greet ${config.name}`:`Speak with ${config.name}`};
    const record={config,index,position,actor:null,loading:null,collider,label,interaction,active:true,streamWanted:false,priority:config.id==='captain_rhael',patrolIndex:0,nextPatrol:4+index*.7,lastSchedule:'',ambientCycle:index,nextAmbient:3+index*.43};interaction.onInteract=()=>this.interact(record);label.addEventListener('click',()=>{record.actor?.stop();this.engine.goToInteraction(interaction);});this.records.push(record);this.engine.registerInteraction(interaction);this.applySchedule(record,true);
  }

  quality(){return this.engine.worldPolish?.quality||'medium';}

  async ensureActor(record){
    if(record.actor)return record.loading||record.actor;
    const {config}=record,actor=new CharacterActor({modelUrl:this.modelUrl,race:config.race||'human',characterClass:config.classId||'warrior',scale:.94});actor.position.copy(record.position);actor.rotation.y=config.facing||0;actor.userData.npcId=config.id;actor.showLoadingFallback();this.engine.scene.add(actor);record.actor=actor;
    record.loading=actor.load().then(()=>{actor.mixer?.setTime((record.index*.731)%2.8);actor.traverse(object=>{object.userData.npcId=config.id;if(object.isMesh){object.castShadow=false;object.frustumCulled=true;}});return actor;}).catch(error=>{console.warn('NPC actor could not load',config.name,error);return actor;}).finally(()=>{record.loading=null;this.applyActorVisibility(record);});
    this.applyActorVisibility(record);return record.loading;
  }

  releaseActor(record){if(!record.actor||record.loading)return;record.position.copy(record.actor.position);this.engine.scene.remove(record.actor);record.actor.dispose();record.actor=null;record.label.style.display='none';}

  async refreshStreaming(initial=false){
    if(this.streaming)return;this.streaming=true;
    try{
      const quality=this.quality(),wanted=selectNpcActorIds(this.records,this.engine.actor.position,quality),budget=npcActorBudget(quality),radius=npcStreamRadius(quality);let loadedCount=this.records.filter(record=>!!record.actor).length;
      for(const record of this.records){record.streamWanted=wanted.has(record.config.id);if(record.actor&&!record.streamWanted){const distance=record.position.distanceTo(this.engine.actor.position),before=record.actor;if(distance>radius+4||loadedCount>budget)this.releaseActor(record);if(before&&!record.actor)loadedCount--;}this.applyActorVisibility(record);}
      const missing=this.records.filter(record=>record.streamWanted&&!record.actor).sort((a,b)=>a.position.distanceToSquared(this.engine.actor.position)-b.position.distanceToSquared(this.engine.actor.position));
      const batch=initial?missing:missing.slice(0,2);await Promise.all(batch.map(record=>this.ensureActor(record)));
      const loaded=this.records.filter(record=>!!record.actor).length;this.engine.canvas.dataset.worldNpcActors=String(loaded);this.engine.canvas.dataset.worldNpcTotal=String(this.records.length);this.engine.canvas.dataset.worldNpcBudget=String(budget);
    }finally{this.streaming=false;}
  }

  interact(record){record.actor?.stop();record.actor?.turnToward(this.engine.actor);record.actor?.playOneShot('interact');if(!record.actor)this.ensureActor(record);const config=record.config;if(config.action==='shop'){window.openShop?.();return;}if(config.action==='ambient'){this.engine.toast(config.ambientLine||`${config.name} nods, then returns to work.`,4200);return;}window.startNPCConversation?.(config.dialogueId||config.id);}
  activeAt(config,hour){if(!config.activeHours)return true;const[from,to]=config.activeHours;return from<=to?hour>=from&&hour<to:hour>=from||hour<to;}

  applySchedule(record,force=false){
    const hour=window.worldClock?.hour??10,{config,actor,collider,label}=record,active=this.activeAt(config,hour),slot=(config.schedule||[]).find(item=>hour>=item.from&&hour<item.to),key=`${active}:${slot?.from??'base'}`;if(!force&&key===record.lastSchedule)return;record.lastSchedule=key;record.active=active;collider.visible=active;if(!active){label.style.display='none';actor?.stop();this.applyActorVisibility(record);return;}
    if(slot?.position){const[x,z]=slot.position;if(actor){const path=this.engine.navigation.findPath(actor.position,{x,z});if(path.length)actor.moveAlong(path,{run:false});}else record.position.set(x,0,z);}
    record.activePatrol=slot?.patrol||config.patrol;record.nextPatrol=0;this.applyActorVisibility(record);
  }

  applyActorVisibility(record){if(!record.actor)return;record.actor.visible=record.active&&record.streamWanted&&!this.engine.combatController?.active;}

  restoreAfterCombat(){for(const record of this.records){record.collider.visible=record.active;this.applyActorVisibility(record);}this.streamElapsed=.5;}

  update(dt,time){
    this.streamElapsed+=dt;if(this.streamElapsed>=.45){this.streamElapsed=0;this.refreshStreaming();}
    const rect=this.engine.canvas.getBoundingClientRect();
    for(const record of this.records){this.applySchedule(record);const {actor,collider,config}=record;if(!actor||!actor.visible){record.label.style.display='none';continue;}const distanceToCamera=record.position.distanceTo(this.engine.camera.position);if(distanceToCamera<28||actor.path.length)actor.update(dt);record.position.copy(actor.position);collider.position.copy(record.position);collider.position.y=1.45;
      const conversationActive=window.npcConvState?.active&&window.npcConvState?.npc?.id===(config.dialogueId||config.id);
      const patrol=record.activePatrol||config.patrol;if(!conversationActive&&!actor.path.length&&actor.oneShotTime<=0&&time>=record.nextAmbient){const gesture=ambientGesture(config,record.ambientCycle++);if(gesture==='turn_left'||gesture==='turn_right')actor.playLocomotionTransition(gesture);else actor.playOneShot(gesture);record.nextAmbient=time+ambientDelay(config,record.ambientCycle);}
      if(patrol?.length&&!conversationActive&&!actor.path.length&&actor.oneShotTime<=0&&time>=record.nextPatrol){record.patrolIndex=(record.patrolIndex+1)%patrol.length;const[x,z]=patrol[record.patrolIndex];const path=this.engine.navigation.findPath(actor.position,{x,z});if(path.length)actor.moveAlong(path,{run:false});record.nextPatrol=time+(config.patrolDelay||8);}
      const world=new THREE.Vector3(record.position.x,2.3*actor.profile.proportions[1],record.position.z),projected=world.project(this.engine.camera),distanceToPlayer=record.position.distanceTo(this.engine.actor.position),visible=projected.z<1&&projected.x>-1.1&&projected.x<1.1&&projected.y>-1.1&&projected.y<1.1&&distanceToCamera<24&&distanceToPlayer<13;
      record.label.style.display=visible?'block':'none';if(visible){record.label.style.left=`${rect.left+(projected.x*.5+.5)*rect.width}px`;record.label.style.top=`${rect.top+(-projected.y*.5+.5)*rect.height}px`;}
    }
  }

  dispose(){for(const record of this.records){this.engine.scene.remove(record.collider);if(record.actor){this.engine.scene.remove(record.actor);record.actor.dispose();}record.collider.geometry.dispose();record.collider.material.dispose();record.label.remove();}this.records=[];delete this.engine.canvas.dataset.worldNpcActors;delete this.engine.canvas.dataset.worldNpcTotal;delete this.engine.canvas.dataset.worldNpcBudget;}
}
