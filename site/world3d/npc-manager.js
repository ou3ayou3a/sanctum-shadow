import * as THREE from 'three';
import {CharacterActor} from './character-actor.js';

export class NPCManager{
  constructor(engine,configs=[]){this.engine=engine;this.configs=configs;this.records=[];this.modelUrl=engine.characterConfig.modelUrl;}
  async initialize(){await Promise.all(this.configs.map((config,index)=>this.spawn(config,index)));return this;}
  async spawn(config,index){
    const actor=new CharacterActor({modelUrl:this.modelUrl,race:config.race||'human',characterClass:config.classId||'warrior',scale:.94});actor.position.set(...config.position);actor.rotation.y=config.facing||0;actor.userData.npcId=config.id;this.engine.scene.add(actor);await actor.load();actor.mixer?.setTime((index*.731)%2.8);
    actor.traverse(object=>{object.userData.npcId=config.id;if(object.isMesh){object.castShadow=false;object.frustumCulled=true;}});
    const collider=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,3,14),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));collider.position.copy(actor.position);collider.position.y=1.45;collider.userData.npcId=config.id;this.engine.scene.add(collider);
    const label=document.createElement('button');label.type='button';label.className='world3d-npc-label';label.setAttribute('aria-label',`${config.action==='shop'?'Trade with':'Speak with'} ${config.name}`);label.innerHTML=`<strong>${config.name}</strong><span>${config.title}</span>`;this.engine.overlay.appendChild(label);
    const interaction={id:`npc:${config.id}`,object:collider,position:actor.position,range:2.3,label:config.action==='shop'?`Trade with ${config.name}`:`Speak with ${config.name}`,onInteract:()=>this.interact(record)};
    const record={config,actor,collider,label,interaction,patrolIndex:0,nextPatrol:4+index*.7};label.addEventListener('click',()=>{actor.stop();this.engine.goToInteraction(interaction);});this.records.push(record);this.engine.registerInteraction(interaction);
  }
  interact(record){record.actor.stop();const config=record.config;if(config.action==='shop'){window.openShop?.();return;}window.startNPCConversation?.(config.dialogueId||config.id);}
  update(dt,time){
    for(const record of this.records){const {actor,collider,config}=record;const distanceToCamera=actor.position.distanceTo(this.engine.camera.position);if(distanceToCamera<28||actor.path.length)actor.update(dt);collider.position.copy(actor.position);collider.position.y=1.45;
      const conversationActive=window.npcConvState?.active&&window.npcConvState?.npc?.id===(config.dialogueId||config.id);
      if(config.patrol?.length&&!conversationActive&&!actor.path.length&&time>=record.nextPatrol){record.patrolIndex=(record.patrolIndex+1)%config.patrol.length;const [x,z]=config.patrol[record.patrolIndex];const path=this.engine.navigation.findPath(actor.position,{x,z});if(path.length)actor.moveAlong(path,{run:false});record.nextPatrol=time+8;}
      const world=new THREE.Vector3(actor.position.x,2.3*actor.profile.proportions[1],actor.position.z),projected=world.clone().project(this.engine.camera);const rect=this.engine.canvas.getBoundingClientRect();const visible=projected.z<1&&projected.x>-1.1&&projected.x<1.1&&projected.y>-1.1&&projected.y<1.1&&distanceToCamera<24;
      record.label.style.display=visible?'block':'none';if(visible){record.label.style.left=`${rect.left+(projected.x*.5+.5)*rect.width}px`;record.label.style.top=`${rect.top+(-projected.y*.5+.5)*rect.height}px`;}
    }
  }
  dispose(){for(const record of this.records){this.engine.scene.remove(record.actor,record.collider);record.actor.dispose();record.collider.geometry.dispose();record.collider.material.dispose();record.label.remove();}this.records=[];}
}
