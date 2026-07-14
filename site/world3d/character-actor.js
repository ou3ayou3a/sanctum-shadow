import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getRaceProfile } from './race-profiles.mjs';
import { getClassProfile } from './class-profiles.mjs';
import { equipClass,applyClassPose } from './class-equipment.js';
import { productionRaceModel } from './production-assets.mjs';

const MODEL_CACHE=new Map();
async function loadModelTemplate(url){if(!MODEL_CACHE.has(url))MODEL_CACHE.set(url,new GLTFLoader().loadAsync(url).catch(error=>{MODEL_CACHE.delete(url);throw error;}));return MODEL_CACHE.get(url);}

export class CharacterActor extends THREE.Group {
  constructor({ modelUrl, race = 'human', characterClass = 'warrior', scale = 1, rotationOffset = Math.PI } = {}) {
    super();
    this.profile=getRaceProfile(race);this.race=this.profile.id;this.modelUrl=productionRaceModel(this.race,modelUrl);this.productionModel=this.modelUrl.includes('/assets/production/characters/');this.modelScale = scale; this.rotationOffset = rotationOffset;this.classProfile=getClassProfile(characterClass);this.characterClass=this.classProfile.id;this.actionTime=0;this.actionDuration=.72;
    this.mixer = null; this.actions = {}; this.activeAction = null; this.state = 'loading';
    this.path = []; this.speed = 2.5; this.arrivalRadius = .12; this.onArrive = null;
  }

  async load() {
    const template=await loadModelTemplate(this.modelUrl);const gltf={scene:cloneSkeleton(template.scene),animations:template.animations};
    this.model = gltf.scene;const [width,height,depth]=this.productionModel?[1,1,1]:this.profile.proportions;this.model.scale.set(width*this.modelScale,height*this.modelScale,depth*this.modelScale);this.model.rotation.y = this.rotationOffset;
    const tint=new THREE.Color(this.profile.materialTint);
    this.model.traverse(o => { if (o.isMesh) {o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){if(material.color)material.color.multiply(tint);material.envMapIntensity=1.15;material.needsUpdate=true;}o.castShadow = true; o.receiveShadow = true; } });
    this.add(this.model);if(!this.productionModel)this.applyRaceDetails();this.addSelectionRing();await equipClass(this,this.classProfile);this.mixer = new THREE.AnimationMixer(this.model);
    for (const clip of gltf.animations) {
      const name = clip.name.toLowerCase();
      if (name.includes('idle')) this.actions.idle = this.mixer.clipAction(clip);
      else if (name.includes('walk')) this.actions.walk = this.mixer.clipAction(clip);
      else if (name.includes('run')) this.actions.run = this.mixer.clipAction(clip);
      else if (name.includes('death')) this.actions.death = this.mixer.clipAction(clip);
      else if (name.includes('hit')) this.actions.hit = this.mixer.clipAction(clip);
      else if (name.includes('dodge')) this.actions.dodge = this.mixer.clipAction(clip);
      else if (name.includes('block')) this.actions.block = this.mixer.clipAction(clip);
      else if (name.includes('bow')) this.actions.bow_shot = this.mixer.clipAction(clip);
      else if (name.includes('cast')) this.actions.cast = this.mixer.clipAction(clip);
      else if (name.includes('smite')) this.actions.attack_smite = this.mixer.clipAction(clip);
      else if (name.includes('attack')||name.includes('slash')) this.actions.attack_slash = this.mixer.clipAction(clip);
    }
    this.setState('idle', true);
    return this;
  }

  applyRaceDetails(){
    const head=this.model.getObjectByName('mixamorig:Head');if(!head)return;
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
      for(const name of['mixamorig:LeftShoulder','mixamorig:RightShoulder']){const bone=this.model.getObjectByName(name);if(!bone)continue;const pad=new THREE.Mesh(new THREE.SphereGeometry(5.3,12,8),new THREE.MeshStandardMaterial({color:0x43563d,metalness:.25,roughness:.72}));pad.scale.set(1.35,.72,1);bone.add(pad);}
    }
  }

  addSelectionRing(){
    const material=new THREE.MeshBasicMaterial({color:this.profile.accent,transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false});
    const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.55,32),material);ring.rotation.x=-Math.PI/2;ring.position.y=.025;ring.userData.raceRing=true;this.add(ring);this.selectionRing=ring;
  }

  setState(state, immediate = false) {
    if (this.state === state && !immediate) return;
    this.state = state;
    const next = this.actions[state] || this.actions.idle;
    if (!next || next === this.activeAction) return;
    next.reset().fadeIn(immediate ? 0 : .2).play();
    if (this.activeAction) this.activeAction.fadeOut(immediate ? 0 : .2);
    this.activeAction = next;
    this.dispatchEvent({type:'statechange',state});
  }

  moveAlong(path, { run = false, onArrive = null } = {}) {
    this.path = path.map(p => new THREE.Vector3(p.x, 0, p.z));
    this.speed = run ? 4.8 : 2.5; this.onArrive = onArrive;
    this.setState(run ? 'run' : 'walk');
  }

  stop() {
    this.path.length = 0; this.setState('idle');
  }

  actionForClass(){if(this.classProfile.pose==='smite')return this.actions.attack_smite;if(this.classProfile.pose==='cast'||this.classProfile.pose==='channel')return this.actions.cast;if(this.classProfile.pose==='draw')return this.actions.bow_shot;return this.actions.attack_slash;}
  playOneShot(name,{returnToIdle=true}={}){const action=this.actions[name];if(!action)return false;this.stop();action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(.08).play();if(this.activeAction&&this.activeAction!==action)this.activeAction.fadeOut(.08);this.activeAction=action;this.state=name;const duration=Math.max(.35,action.getClip().duration);clearTimeout(this.oneShotTimer);if(returnToIdle)this.oneShotTimer=setTimeout(()=>{if(this.state===name)this.setState('idle',true);},duration*1000);return true;}
  playPrimaryAction(){if(!this.model||this.actionTime>0)return false;this.stop();const action=this.actionForClass();this.actionTime=action?Math.max(.55,action.getClip().duration):this.actionDuration;this.currentActionDuration=this.actionTime;this.usingAuthoredAction=!!action;if(action){action.reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.fadeIn(.08).play();if(this.activeAction&&this.activeAction!==action)this.activeAction.fadeOut(.08);this.activeAction=action;this.state='attack';}this.dispatchEvent({type:'classaction',action:this.classProfile.action,impactDelay:Math.min(.52,this.actionTime*.56)});return true;}

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    if(this.actionTime>0){this.actionTime=Math.max(0,this.actionTime-dt);const progress=1-this.actionTime/Math.max(.001,this.currentActionDuration||this.actionDuration);if(!this.usingAuthoredAction)applyClassPose(this,this.classProfile,progress);if(this.actionTime===0){this.usingAuthoredAction=false;if(this.classAura)this.classAura.material.opacity=0;this.setState('idle',true);}}
    if(this.selectionRing)this.selectionRing.rotation.z+=dt*.35;
    if (!this.path.length) return;
    const target = this.path[0]; const delta = target.clone().sub(this.position); delta.y = 0;
    const distance = delta.length();
    if (distance <= this.arrivalRadius) {
      this.position.set(target.x, this.position.y, target.z); this.path.shift();
      if (!this.path.length) { const callback = this.onArrive; this.onArrive = null; this.stop(); if (callback) callback(); }
      return;
    }
    const direction = delta.normalize();
    this.position.addScaledVector(direction, Math.min(distance, this.speed * dt));
    const desired = Math.atan2(direction.x, direction.z); let difference = desired - this.rotation.y;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    this.rotation.y += difference * Math.min(1, dt * 12);
  }

  dispose() {
    this.stop();clearTimeout(this.oneShotTimer); if (this.mixer) this.mixer.stopAllAction();
    this.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose()); });
  }
}
