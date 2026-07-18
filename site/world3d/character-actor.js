import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getRaceProfile } from './race-profiles.mjs';
import { getClassProfile } from './class-profiles.mjs';
import { equipClass,applyClassPose,rigBone } from './class-equipment.js?v=163';
import { productionRaceModel } from './production-assets.mjs?v=147';
import {WALK_SPEED,RUN_SPEED,advanceSpeed,angleDelta,locomotionBlend,normalizePresenceState,normalizeNetworkSpeed,turnState} from './locomotion.mjs';
import {blendDuration,equipmentSwapFraction,isCombatGesture,normalizeGesture} from './animation-policy.mjs?v=163';

const MODEL_CACHE=new Map();
async function loadModelTemplate(url){if(!MODEL_CACHE.has(url))MODEL_CACHE.set(url,new GLTFLoader().loadAsync(url).catch(error=>{MODEL_CACHE.delete(url);throw error;}));return MODEL_CACHE.get(url);}

export class CharacterActor extends THREE.Group {
  constructor({ modelUrl, race = 'human', characterClass = 'warrior', scale = 1, rotationOffset = Math.PI } = {}) {
    super();
    this.profile=getRaceProfile(race);this.race=this.profile.id;this.modelUrl=productionRaceModel(this.race,modelUrl);this.productionModel=this.modelUrl.includes('/assets/production/characters/');this.modelScale = scale; this.rotationOffset = rotationOffset;this.classProfile=getClassProfile(characterClass);this.characterClass=this.classProfile.id;this.actionTime=0;this.actionDuration=.72;
    this.mixer = null; this.actions = {}; this.activeAction = null; this.state = 'loading';
    this.path=[];this.speed=WALK_SPEED;this.targetSpeed=0;this.currentSpeed=0;this.arrivalRadius=.12;this.onArrive=null;this.movementIntent='walk';this.transitionTime=0;this.lastRemoteState='idle';this.gestureSequence=0;this.currentGesture=null;this.gestureUntil=0;this.reactionTime=0;this.reactionDuration=.32;this.reactionVector=new THREE.Vector3();
  }

  showLoadingFallback(){
    if(this.model||this.loadingFallback)return this.loadingFallback;
    const group=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:this.profile.skinColor||0xd3b08d,roughness:.78}),cloth=new THREE.MeshStandardMaterial({color:this.classProfile.accent||this.profile.accent||0x496056,roughness:.72,metalness:.08});
    const part=(geometry,material,position,scale=null)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);if(scale)mesh.scale.set(...scale);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
    part(new THREE.CapsuleGeometry(.34,.72,5,8),cloth,[0,1.08,0]);part(new THREE.SphereGeometry(.28,12,9),skin,[0,1.82,0]);
    for(const side of[-1,1]){part(new THREE.CapsuleGeometry(.1,.62,4,7),cloth,[side*.43,1.14,0], [1,1,1]);part(new THREE.CapsuleGeometry(.12,.72,4,7),cloth,[side*.2,.38,0]);}
    group.scale.setScalar(this.modelScale);group.name='character-loading-fallback';group.userData.actorFallback=true;this.add(group);this.loadingFallback=group;this.model=group;if(!this.selectionRing)this.addSelectionRing();if(!this.weaponTrail)this.addWeaponTrail();return group;
  }

  clearLoadingFallback(){
    const group=this.loadingFallback;if(!group)return;group.traverse(object=>{object.geometry?.dispose();if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());});this.remove(group);if(this.model===group)this.model=null;this.loadingFallback=null;
  }

  async load() {
    this.showLoadingFallback();
    try{
    const template=await loadModelTemplate(this.modelUrl);const gltf={scene:cloneSkeleton(template.scene),animations:template.animations};
    this.clearLoadingFallback();
    this.model = gltf.scene;const [width,height,depth]=this.productionModel?[1,1,1]:this.profile.proportions;this.model.scale.set(width*this.modelScale,height*this.modelScale,depth*this.modelScale);this.model.rotation.y = this.rotationOffset;
    const tint=new THREE.Color(this.profile.materialTint);
    this.model.traverse(o => { if (o.isMesh) {o.userData.sharedActorGeometry=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){if(material.color)material.color.multiply(tint);material.envMapIntensity=1.15;material.needsUpdate=true;}o.castShadow = true; o.receiveShadow = true; } });
    this.add(this.model);if(!this.productionModel)this.applyRaceDetails();if(!this.selectionRing)this.addSelectionRing();if(!this.weaponTrail)this.addWeaponTrail();await equipClass(this,this.classProfile);this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();
      if (name.includes('combat_idle')) this.actions.combat_idle = this.mixer.clipAction(clip);
      else if (name.includes('walk_start')) this.actions.walk_start = this.mixer.clipAction(clip);
      else if (name.includes('walk_stop')) this.actions.walk_stop = this.mixer.clipAction(clip);
      else if (name.includes('turn_left')) this.actions.turn_left = this.mixer.clipAction(clip);
      else if (name.includes('turn_right')) this.actions.turn_right = this.mixer.clipAction(clip);
      else if (name.includes('weapon_sheathe')) this.actions.weapon_sheathe = this.mixer.clipAction(clip);
      else if (name.includes('weapon_draw')) this.actions.weapon_draw = this.mixer.clipAction(clip);
      else if (name.includes('interact')) this.actions.interact = this.mixer.clipAction(clip);
      else if (name.includes('talk')) this.actions.talk = this.mixer.clipAction(clip);
      else if (name.includes('work')) this.actions.work = this.mixer.clipAction(clip);
      else if (name.includes('drink')) this.actions.drink = this.mixer.clipAction(clip);
      else if (name.includes('idle')) this.actions.idle = this.mixer.clipAction(clip);
      else if (name.includes('walk')) this.actions.walk = this.mixer.clipAction(clip);
      else if (name.includes('run')) this.actions.run = this.mixer.clipAction(clip);
      else if (name.includes('death')) this.actions.death = this.mixer.clipAction(clip);
      else if (name.includes('hit')) this.actions.hit = this.mixer.clipAction(clip);
      else if (name.includes('dodge')) this.actions.dodge = this.mixer.clipAction(clip);
      else if (name.includes('block')) this.actions.block = this.mixer.clipAction(clip);
      else if (name.includes('bow')) this.actions.bow_shot = this.mixer.clipAction(clip);
      else if (name.includes('cast')) this.actions.cast = this.mixer.clipAction(clip);
      else if (name.includes('heavy')) this.actions.attack_heavy = this.mixer.clipAction(clip);
      else if (name.includes('dual')) this.actions.attack_dual = this.mixer.clipAction(clip);
      else if (name.includes('staff_strike')) this.actions.staff_strike = this.mixer.clipAction(clip);
      else if (name.includes('smite')) this.actions.attack_smite = this.mixer.clipAction(clip);
      else if (name.includes('attack')||name.includes('slash')) this.actions.attack_slash = this.mixer.clipAction(clip);
    }
    this.setState('idle', true);
    }catch(error){
      this.loadError=error;this.showLoadingFallback();this.state='idle';this.dispatchEvent({type:'statechange',state:'idle'});console.warn(`Character model failed for ${this.race}; using the lightweight fallback.`,error);
    }
    return this;
  }

  applyRaceDetails(){
    const head=rigBone(this.model,'mixamorig:Head');if(!head)return;
    const skin=new THREE.MeshStandardMaterial({color:this.profile.skinColor,roughness:.76});
    const metal=new THREE.MeshStandardMaterial({color:this.profile.accent,metalness:.62,roughness:.35});
    const addEar=(side,size=1)=>{const ear=new THREE.Mesh(new THREE.ConeGeometry(2.4*size,10.5*size,12),skin);ear.rotation.z=side*Math.PI/2;ear.rotation.y=.3;ear.position.set(side*7.3,4,0);ear.castShadow=true;head.add(ear);};
    if(this.profile.features.includes('pointed_ears')){addEar(-1);addEar(1);}
    if(this.profile.features.includes('large_ears')){addEar(-1,1.45);addEar(1,1.45);}
    if(this.profile.features.includes('circlet')||this.profile.features.includes('silver_circlet')){const circlet=new THREE.Mesh(new THREE.TorusGeometry(6.4,.55,8,24),metal);circlet.rotation.x=Math.PI/2;circlet.position.y=5.2;head.add(circlet);}
    if(this.profile.features.includes('tusks'))for(const side of[-1,1]){const tusk=new THREE.Mesh(new THREE.ConeGeometry(1.25,6,10),new THREE.MeshStandardMaterial({color:0xe4d8b7,roughness:.65}));tusk.position.set(side*2.9,-2.5,5);tusk.rotation.x=-.35;head.add(tusk);}
    if(this.profile.features.includes('beard')){const beard=new THREE.Mesh(new THREE.ConeGeometry(5.5,12,12),new THREE.MeshStandardMaterial({color:0x70452d,roughness:1}));beard.position.set(0,-5,4);beard.rotation.x=-.18;head.add(beard);}
    if(this.profile.features.includes('brow')){const brow=new THREE.Mesh(new THREE.BoxGeometry(10,1.6,2),skin);brow.position.set(0,3.2,5);brow.rotation.x=.1;head.add(brow);}
    if(this.profile.features.includes('heavy_shoulders')){
      for(const name of['mixamorig:LeftShoulder','mixamorig:RightShoulder']){const bone=rigBone(this.model,name);if(!bone)continue;const pad=new THREE.Mesh(new THREE.SphereGeometry(5.3,12,8),new THREE.MeshStandardMaterial({color:0x43563d,metalness:.25,roughness:.72}));pad.scale.set(1.35,.72,1);bone.add(pad);}
    }
  }

  addSelectionRing(){
    const material=new THREE.MeshBasicMaterial({color:this.profile.accent,transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.55,32),material);ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.userData.raceRing=true;this.add(ring);this.selectionRing=ring;
  }

  addWeaponTrail(){const material=new THREE.MeshBasicMaterial({color:this.classProfile.accent,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),trail=new THREE.Mesh(new THREE.RingGeometry(.52,.68,32,1,-.72,1.42),material);trail.position.set(0,1.08,.34);trail.rotation.z=-.42;trail.visible=false;trail.name='combat:weapon-trail';this.add(trail);this.weaponTrail=trail;}

  setState(state, immediate = false) {
    if (this.state === state && !immediate) return;
    this.oneShotTime=0;this.oneShotLocked=false;
    const previousState=this.state;this.state = state;
    const next = this.actions[state] || this.actions.idle;
    if (!next || next === this.activeAction) return;
    const blend=immediate?0:blendDuration(previousState,state);
    if(state!=='walk'&&state!=='run')for(const locomotion of[this.actions.walk,this.actions.run])if(locomotion&&locomotion!==next)locomotion.fadeOut(blend);
    next.reset().fadeIn(blend).play();
    if (this.activeAction) this.activeAction.fadeOut(blend);
    this.activeAction = next;
    this.dispatchEvent({type:'statechange',state});
  }

  moveAlong(path, { run = false, onArrive = null } = {}) {
    this.remoteControlled=false;this.path=path.map(p=>new THREE.Vector3(p.x,0,p.z));while(this.path.length&&this.path[0].distanceTo(this.position)<this.arrivalRadius)this.path.shift();
    this.speed=run?RUN_SPEED:WALK_SPEED;this.targetSpeed=this.speed;this.movementIntent=run?'run':'walk';this.onArrive=onArrive;this.arrivalPending=false;this.setEquipmentDrawn(false);
    if(this.currentSpeed<.12)this.playLocomotionTransition('walk_start');
  }

  stop({immediate=true}={}) {
    this.path.length=0;this.targetSpeed=0;this.arrivalPending=false;this.onArrive=null;
    if(immediate){this.currentSpeed=0;this.transitionTime=0;this.setState(this.combatStance?'combat_idle':'idle');}
  }

  beginStop(){this.path.length=0;this.targetSpeed=0;this.arrivalPending=true;if(this.currentSpeed>.12)this.playLocomotionTransition('walk_stop');}
  setEquipmentDrawn(drawn){this.equipmentDrawn=!!drawn;for(const object of this.heldEquipment||[])object.visible=this.equipmentDrawn;for(const object of this.stowedEquipment||[])object.visible=!this.equipmentDrawn;}
  playLocomotionTransition(name){const action=this.actions[name];if(!action||this.transitionTime>0&&this.state===name)return false;this.oneShotTime=0;this.oneShotLocked=false;for(const locomotion of[this.actions.walk,this.actions.run])locomotion?.fadeOut(.1);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(.08).play();if(this.activeAction&&this.activeAction!==action)this.activeAction.fadeOut(.08);this.activeAction=action;this.transitionTime=Math.max(.2,action.getClip().duration);const previous=this.state;this.state=name;if(previous!==name)this.dispatchEvent({type:'statechange',state:name});return true;}
  updateLocomotionBlend(speed=this.currentSpeed){if(this.actionTime>0||this.transitionTime>0||this.oneShotTime>0||this.oneShotLocked)return;const blend=locomotionBlend(speed),idleState=this.combatStance?'combat_idle':'idle';if(blend.state==='idle'){this.setState(idleState);return;}const walk=this.actions.walk,run=this.actions.run;if(!walk||!run){this.setState(blend.state);return;}for(const action of[walk,run])if(!action.isRunning()){action.reset().play();}walk.enabled=run.enabled=true;walk.setEffectiveWeight(blend.walk);run.setEffectiveWeight(blend.run);walk.setEffectiveTimeScale(.82+Math.min(1,speed/WALK_SPEED)*.28);run.setEffectiveTimeScale(.84+Math.min(1,speed/RUN_SPEED)*.3);if(this.activeAction!==walk&&this.activeAction!==run)this.activeAction?.fadeOut(.14);this.activeAction=blend.state==='run'?run:walk;const previous=this.state;this.state=blend.state;if(previous!==this.state)this.dispatchEvent({type:'statechange',state:this.state});}
  setRemoteLocomotion(state,speed=0){this.remoteControlled=true;const normalized=normalizePresenceState(state),value=normalizeNetworkSpeed(speed);if(normalized!==this.lastRemoteState&&['walk_start','walk_stop','turn_left','turn_right'].includes(normalized))this.playLocomotionTransition(normalized);this.lastRemoteState=normalized;this.remoteSpeed=value;this.remoteState=normalized;}

  actionForClass(){if(this.classProfile.id==='warrior')return this.actions.attack_heavy||this.actions.attack_slash;if(this.classProfile.id==='rogue')return this.actions.attack_dual||this.actions.attack_slash;if(this.classProfile.id==='cleric')return this.actions.staff_strike||this.actions.cast;if(this.classProfile.pose==='smite')return this.actions.attack_smite;if(this.classProfile.pose==='cast')return this.actions.cast;if(this.classProfile.pose==='draw')return this.actions.bow_shot;return this.actions.attack_slash;}
  setCombatStance(active,{animate=true}={}){const desired=!!active;if(this.combatStance===desired&&this.equipmentDrawn===desired)return;this.stop();this.combatStance=desired;const transition=desired?'weapon_draw':'weapon_sheathe',action=this.actions[transition];clearTimeout(this.equipmentSwapTimer);clearTimeout(this.stanceTimer);if(animate&&action){this.setEquipmentDrawn(!desired);this.playOneShot(transition,{returnToIdle:false});const duration=Math.max(.25,action.getClip().duration);this.equipmentSwapTimer=setTimeout(()=>this.setEquipmentDrawn(desired),duration*equipmentSwapFraction(transition)*1000);this.stanceTimer=setTimeout(()=>{this.setEquipmentDrawn(desired);this.setState(desired?'combat_idle':'idle',true);},duration*1000);}else{this.setEquipmentDrawn(desired);this.setState(desired?'combat_idle':'idle',true);}}
  faceTarget(target){if(!target)return;const position=target.position||target,dx=position.x-this.position.x,dz=position.z-this.position.z;if(Math.hypot(dx,dz)>.001){this.rotation.y=Math.atan2(dx,dz);this.desiredFacing=null;}}
  turnToward(target){if(!target)return;const position=target.position||target,dx=position.x-this.position.x,dz=position.z-this.position.z;if(Math.hypot(dx,dz)>.001)this.desiredFacing=Math.atan2(dx,dz);}
  recordGesture(name,duration){this.gestureSequence=(this.gestureSequence+1)%2147483647;this.currentGesture=normalizeGesture(name);this.gestureUntil=performance.now()+Math.max(.2,duration)*1000;}
  playOneShot(name,{returnToIdle=true,record=true}={}){const action=this.actions[name];if(!action)return false;this.path.length=0;this.currentSpeed=0;this.targetSpeed=0;this.transitionTime=0;const blend=blendDuration(this.state,name);action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(blend).play();if(this.activeAction&&this.activeAction!==action)this.activeAction.fadeOut(blend);this.activeAction=action;const previous=this.state;this.state=name;if(previous!==name)this.dispatchEvent({type:'statechange',state:name,previousState:previous});const duration=Math.max(.35,action.getClip().duration);this.oneShotTime=duration;this.oneShotLocked=!returnToIdle;if(record)this.recordGesture(name,duration);clearTimeout(this.oneShotTimer);if(returnToIdle)this.oneShotTimer=setTimeout(()=>{if(this.state===name)this.setState(this.combatStance?'combat_idle':'idle',true);},duration*1000);return true;}
  playNetworkGesture(name){const gesture=normalizeGesture(name);if(!gesture)return false;if(isCombatGesture(gesture)){this.setEquipmentDrawn(true);this.transientEquipmentDrawn=!this.combatStance;}const played=this.playOneShot(gesture,{record:false});if(played&&this.transientEquipmentDrawn){clearTimeout(this.networkEquipmentTimer);const duration=Math.max(.4,this.actions[gesture]?.getClip().duration||.8);this.networkEquipmentTimer=setTimeout(()=>{if(!this.combatStance)this.setEquipmentDrawn(false);this.transientEquipmentDrawn=false;},duration*1000);}return played;}
  applyImpactReaction(source,{distance=.28,duration=.34}={}){if(!this.model||!source)return;const origin=source.position||source;this.reactionVector.set(this.position.x-origin.x,0,this.position.z-origin.z);if(this.reactionVector.lengthSq()<.001)this.reactionVector.set(0,0,1);this.reactionVector.normalize().multiplyScalar(distance);this.reactionDuration=Math.max(.16,duration);this.reactionTime=this.reactionDuration;}
  playCombatAction({action='attack',spell=null,target=null,force=false}={}){
    if(!this.model||(!force&&this.actionTime>0))return null;
    this.path.length=0;this.currentSpeed=0;this.targetSpeed=0;this.oneShotTime=0;this.oneShotLocked=false;this.faceTarget(target);this.setEquipmentDrawn(true);this.transientEquipmentDrawn=!this.combatStance;
    const presentation=globalThis.CombatPresentation?.profileFor({combatant:{characterClass:this.characterClass},action,spell})||{clip:null,duration:this.actionDuration,impactFraction:.56,impactDelay:.4,recoveryDelay:this.actionDuration};
    const animation=this.actions[presentation.clip]||this.actionForClass();
    const duration=animation?Math.max(.35,animation.getClip().duration):presentation.duration,scale=duration/Math.max(.001,presentation.duration||duration);
    const releaseDelay=Math.max(.08,(presentation.releaseDelay??presentation.impactDelay??duration*.56)*scale),travelDuration=(presentation.travelDuration||0)*scale,impactDelay=Math.max(releaseDelay,(presentation.impactDelay??releaseDelay)*scale),recoveryDelay=Math.max(duration,(presentation.recoveryDelay||duration)*scale);
    this.actionTime=recoveryDelay;this.currentActionDuration=recoveryDelay;this.usingAuthoredAction=!!animation;this.currentCombatAction={...presentation,duration,releaseDelay,travelDuration,impactDelay,recoveryDelay,startedAt:performance.now()};
    if(animation){const clipName=presentation.clip||this.classProfile.pose;animation.reset().setLoop(THREE.LoopOnce,1);animation.clampWhenFinished=true;animation.fadeIn(.07).play();if(this.activeAction&&this.activeAction!==animation)this.activeAction.fadeOut(.07);this.activeAction=animation;this.state=clipName;this.recordGesture(clipName,recoveryDelay);}
    this.dispatchEvent({type:'classaction',action:spell?.name||this.classProfile.action,releaseDelay,impactDelay,duration:recoveryDelay,profile:presentation});
    return this.currentCombatAction;
  }
  playPrimaryAction(){return!!this.playCombatAction();}

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    if(this.currentGesture&&performance.now()>=this.gestureUntil)this.currentGesture=null;
    if(this.desiredFacing!==null&&this.desiredFacing!==undefined&&!this.path.length){const difference=angleDelta(this.rotation.y,this.desiredFacing);this.rotation.y+=difference*Math.min(1,dt*8.5);if(Math.abs(difference)<.015)this.desiredFacing=null;}
    if(this.reactionTime>0&&this.model){this.reactionTime=Math.max(0,this.reactionTime-dt);const progress=1-this.reactionTime/this.reactionDuration,ease=Math.sin(progress*Math.PI);this.model.position.copy(this.reactionVector).multiplyScalar(ease);if(this.reactionTime===0)this.model.position.set(0,0,0);}
    if(this.oneShotTime>0)this.oneShotTime=Math.max(0,this.oneShotTime-dt);
    if(this.actionTime>0){this.actionTime=Math.max(0,this.actionTime-dt);const duration=Math.max(.001,this.currentActionDuration||this.actionDuration),progress=1-this.actionTime/duration,impact=(this.currentCombatAction?.impactDelay||duration*.52)/duration,trailDistance=Math.abs(progress-impact);if(this.weaponTrail){const melee=this.currentCombatAction?.effect==='melee';this.weaponTrail.visible=melee&&trailDistance<.13;this.weaponTrail.material.opacity=this.weaponTrail.visible?Math.max(0,1-trailDistance/.13)*.28:0;this.weaponTrail.rotation.z=-.75+progress*1.7;}if(!this.usingAuthoredAction)applyClassPose(this,this.classProfile,progress);if(this.actionTime===0){this.usingAuthoredAction=false;this.currentCombatAction=null;if(this.weaponTrail)this.weaponTrail.visible=false;if(this.classAura)this.classAura.material.opacity=0;if(this.transientEquipmentDrawn){this.transientEquipmentDrawn=false;this.setEquipmentDrawn(false);}this.setState(this.combatStance?'combat_idle':'idle',true);}}
    if(this.transitionTime>0)this.transitionTime=Math.max(0,this.transitionTime-dt);
    if(this.selectionRing)this.selectionRing.rotation.z+=dt*.35;
    if(this.remoteControlled){if(this.transitionTime<=0)this.updateLocomotionBlend(['walk','run'].includes(this.remoteState)?this.remoteSpeed:0);return;}
    if(!this.path.length){this.currentSpeed=advanceSpeed(this.currentSpeed,0,dt);this.updateLocomotionBlend(this.currentSpeed);if(this.arrivalPending&&this.currentSpeed<=.03){this.arrivalPending=false;const callback=this.onArrive;this.onArrive=null;if(callback)callback();}return;}
    const target = this.path[0]; const delta = target.clone().sub(this.position); delta.y = 0;
    const distance = delta.length();
    if (distance <= Math.max(this.arrivalRadius,this.currentSpeed*dt)) {
      this.position.set(target.x, this.position.y, target.z); this.path.shift();
      if (!this.path.length) this.beginStop();
      return;
    }
    const direction = delta.normalize();
    const desired=Math.atan2(direction.x,direction.z),difference=angleDelta(this.rotation.y,desired),turningInPlace=Math.abs(difference)>.62&&this.currentSpeed<.42;
    if(turningInPlace&&this.transitionTime<=0)this.playLocomotionTransition(turnState(difference));
    this.rotation.y+=difference*Math.min(1,dt*(turningInPlace?7.5:10));
    this.currentSpeed=advanceSpeed(this.currentSpeed,turningInPlace?0:this.speed,dt);if(!turningInPlace)this.position.addScaledVector(direction,Math.min(distance,this.currentSpeed*dt));this.updateLocomotionBlend(this.currentSpeed);
  }

  dispose() {
    this.combatStance=false;this.stop();clearTimeout(this.oneShotTimer);clearTimeout(this.stanceTimer);clearTimeout(this.equipmentSwapTimer);clearTimeout(this.networkEquipmentTimer); if (this.mixer) this.mixer.stopAllAction();
    this.traverse(o => { if (o.geometry&&!o.userData?.sharedActorGeometry) o.geometry.dispose(); if (o.material&&!o.userData?.sharedActorMaterial) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); });
  }
}
