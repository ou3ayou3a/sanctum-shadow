import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CharacterActor } from './character-actor.js';
import { NavigationGrid } from './navigation-grid.mjs';
import { NPCManager } from './npc-manager.js';
import { Combat3DController } from './combat-controller.js';
import { AbilityEffects } from './ability-effects.js';
import { Party3DManager } from './party-manager.js';
import { Chronicle3DAdapter } from './chronicle-adapter.js';
import { WorldPolish } from './world-polish.js';
import { CinematicDirector } from './cinematic-director.js';

export class WorldEngine extends EventTarget {
  constructor({canvas,overlay,zoneFactory,character}) {
    super(); this.canvas=canvas; this.overlay=overlay; this.zoneFactory=zoneFactory; this.characterConfig=character;
    this.clock=new THREE.Clock(); this.running=false; this.raycaster=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    this.interactionObjects=[]; this.pendingInteraction=null;
  }

  async initialize() {
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.camera=new THREE.PerspectiveCamera(44,1,.1,180);this.camera.position.set(7.2,7.2,9.2);
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=5.5;this.controls.maxDistance=18;this.controls.minPolarAngle=.42;this.controls.maxPolarAngle=1.12;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x10201d);this.scene.fog=new THREE.FogExp2(0x10201d,.025);
    this.scene.add(new THREE.HemisphereLight(0xa2c9c1,0x162018,1.8));
    const moon=new THREE.DirectionalLight(0xd8e9e2,4);moon.position.set(-9,18,10);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-24;moon.shadow.camera.right=24;moon.shadow.camera.top=24;moon.shadow.camera.bottom=-24;moon.shadow.bias=-.0003;this.scene.add(moon);
    this.zone=this.zoneFactory();if(this.zone.scene){this.scene.background=new THREE.Color(this.zone.scene.background);this.scene.fog=new THREE.FogExp2(this.zone.scene.fog,this.zone.scene.fogDensity??.025);}this.scene.add(this.zone.root);this.worldLabels=[];this.worldLabelPosition=new THREE.Vector3();this.zone.root.traverse(object=>{if(Array.isArray(object.userData?.worldLabelBase))this.worldLabels.push(object);});
    this.navigation=new NavigationGrid({...this.zone.bounds,cellSize:.75,obstacles:this.zone.obstacles});
    this.interactionObjects=this.zone.interactables.map(i=>i.object);
    this.actor=new CharacterActor(this.characterConfig);this.actor.position.copy(this.restoredPosition());this.actor.rotation.y=this.restoredRotation();this.scene.add(this.actor);this.controls.target.copy(this.actor.position).add(new THREE.Vector3(0,1.25,0));this.camera.position.copy(this.actor.position).add(new THREE.Vector3(0,7.5,8));this.controls.update();
    this.actor.addEventListener('statechange',e=>this.setStateLabel(e.state));
    this.buildOverlay();this.bindInput();this.resize();if(this.zone.ready){const detail=this.loadingElement?.querySelector('span');if(detail)detail.textContent='Loading authored buildings and forest…';await this.zone.ready;}await this.actor.load();if(this.zone.npcs?.length){this.npcManager=new NPCManager(this,this.zone.npcs);await this.npcManager.initialize();}this.abilityEffects=new AbilityEffects(this);this.combatController=new Combat3DController(this);this.partyManager=new Party3DManager(this);await this.partyManager.initialize();this.cinematicDirector=new CinematicDirector(this);this.chronicleAdapter=new Chronicle3DAdapter(this);this.chronicleAdapter.initialize();this.worldPolish=new WorldPolish(this);this.worldPolish.initialize();this.loadingElement?.remove();this.setStateLabel('idle');this.toast('Click the ground to move. Shift-click to run.');
    this.dispatchEvent(new Event('ready')); return this;
  }

  buildOverlay(){
    this.overlay.replaceChildren();
    const hud=document.createElement('div');hud.className='world3d-hud';hud.innerHTML=`<div class="world3d-loading"><i></i><strong>ENTERING ${this.zone.name.toUpperCase()}</strong><span>Preparing the world…</span></div><div class="world3d-title"><span>EXPLORATION · ${this.actor.profile.name.toUpperCase()} ${this.actor.classProfile.name.toUpperCase()}</span><strong>${this.zone.name}</strong></div><button class="world3d-class-action" type="button"><kbd>1</kbd><span>${this.actor.classProfile.action}</span></button><nav class="world3d-utility-bar" aria-label="Game menus"><button type="button" data-world-action="character" title="Character (C)" aria-label="Character"><span aria-hidden="true">♙</span><small>Character</small></button><button type="button" data-world-action="inventory" title="Inventory (I)" aria-label="Inventory"><span aria-hidden="true">▣</span><small>Inventory</small></button><button type="button" data-world-action="journal" title="Journal (J)" aria-label="Journal"><span aria-hidden="true">☷</span><small>Journal</small></button><button type="button" data-world-action="map" title="Map (M)" aria-label="Map"><span aria-hidden="true">◇</span><small>Map</small></button><button type="button" data-world-action="camp" title="Camp" aria-label="Camp"><span aria-hidden="true">♨</span><small>Camp</small></button><button type="button" data-world-action="settings" title="Settings" aria-label="Settings"><span aria-hidden="true">⚙</span><small>Settings</small></button></nav><div class="world3d-state"><i></i><span>IDLE</span></div><div class="world3d-help">Click to move <b>·</b> Shift-click to run <b>·</b> Drag to orbit <b>·</b> Scroll to zoom</div><div class="world3d-prompt" hidden><button type="button"><kbd>E</kbd><span></span></button></div><section class="world3d-interaction-menu" role="dialog" aria-modal="false" aria-label="Environmental actions" hidden><header><span>INTERACT</span><strong></strong><button type="button" data-env-close aria-label="Close environmental actions">×</button></header><div class="world3d-interaction-choices"></div><form class="world3d-custom-action"><label for="world3d-custom-action-input">Try something else…</label><div><input id="world3d-custom-action-input" maxlength="240" autocomplete="off" placeholder="Describe what you do with this object"><button type="submit">Try</button></div></form></section><div class="world3d-toast" role="status" aria-live="polite"></div>`;
    this.overlay.appendChild(hud);this.loadingElement=hud.querySelector('.world3d-loading');this.stateLabel=hud.querySelector('.world3d-state span');this.prompt=hud.querySelector('.world3d-prompt');this.promptText=this.prompt.querySelector('span');this.toastElement=hud.querySelector('.world3d-toast');this.interactionMenu=hud.querySelector('.world3d-interaction-menu');this.interactionTitle=this.interactionMenu.querySelector('header strong');this.interactionChoices=this.interactionMenu.querySelector('.world3d-interaction-choices');this.customActionForm=this.interactionMenu.querySelector('form');this.customActionInput=this.customActionForm.querySelector('input');
    this.classActionButton=hud.querySelector('.world3d-class-action');this.classActionText=this.classActionButton.querySelector('span');this.utilityBar=hud.querySelector('.world3d-utility-bar');this.prompt.querySelector('button').addEventListener('click',()=>this.confirmInteraction());this.interactionMenu.querySelector('[data-env-close]').addEventListener('click',()=>this.closeInteractionMenu());this.interactionChoices.addEventListener('click',event=>{const button=event.target.closest('[data-env-action]');if(button)this.selectInteractionAction(Number(button.dataset.envAction));});this.customActionForm.addEventListener('submit',event=>{event.preventDefault();this.submitCustomEnvironmentAction();});this.classActionButton.addEventListener('click',()=>this.playClassAction());this.utilityBar.addEventListener('click',event=>{const button=event.target.closest('[data-world-action]');if(button)this.openUtility(button.dataset.worldAction);});
  }

  openUtility(action){
    if(this.combatController?.active)return;
    const actions={
      character:()=>window.openCharSheet?.(),
      inventory:()=>window.openCharSheet?.('inventory'),
      journal:()=>window.showQuestLog?.(),
      map:()=>window.openWorldMap?.(),
      camp:()=>window.openCampPanel?.(),
      settings:()=>window.SanctumUI?.openAccessibilityPanel?.()
    };
    const handler=actions[action];if(handler)handler();
  }

  setStateLabel(state){if(this.stateLabel)this.stateLabel.textContent=String(state).toUpperCase();}
  restoredPosition(){if(new URLSearchParams(location.search).has('fresh3d'))return this.zone.spawn;const saved=window.gameState?.world3dPositions?.[this.zone.id];if(!saved||!Number.isFinite(saved.x)||!Number.isFinite(saved.z))return this.zone.spawn;const point={x:THREE.MathUtils.clamp(saved.x,this.zone.bounds.minX,this.zone.bounds.maxX),z:THREE.MathUtils.clamp(saved.z,this.zone.bounds.minZ,this.zone.bounds.maxZ)};const cell=this.navigation.nearestOpen(this.navigation.cellAt(point)),open=this.navigation.pointAt(cell);return new THREE.Vector3(open.x,0,open.z);}
  restoredRotation(){const rotation=window.gameState?.world3dPositions?.[this.zone.id]?.rotation;return Number.isFinite(rotation)?rotation:0;}
  persistPosition(){if(!this.actor||!window.gameState)return;window.gameState.world3dPositions=window.gameState.world3dPositions||{};window.gameState.world3dPositions[this.zone.id]={x:Number(this.actor.position.x.toFixed(3)),z:Number(this.actor.position.z.toFixed(3)),rotation:Number(this.actor.rotation.y.toFixed(3))};}
  toast(message,duration=3200){if(!this.toastElement)return;this.toastElement.textContent=message;this.toastElement.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toastElement?.classList.remove('visible'),duration);}
  bindInput(){
    let down=null;this.onPointerDown=e=>{down={x:e.clientX,y:e.clientY};};
    this.onPointerUp=e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}down=null;this.handleTap(e);};
    this.onKey=e=>{if(!this.running)return;const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');if(e.code==='Escape'&&!this.interactionMenu?.hidden){e.preventDefault();this.closeInteractionMenu();return;}if(e.code==='Escape'&&window.npcConvState?.active){e.preventDefault();window.closeConvPanel?.();return;}if((e.code==='KeyE'||e.code==='Enter')&&this.pendingInteraction&&!editing){e.preventDefault();this.confirmInteraction();}if(e.code==='Digit1'&&!editing&&!window.npcConvState?.active){e.preventDefault();this.playClassAction();}if(!editing&&!this.combatController?.active&&!window.npcConvState?.active){const shortcuts={KeyC:'character',KeyI:'inventory',KeyJ:'journal',KeyM:'map'};if(shortcuts[e.code]){e.preventDefault();this.openUtility(shortcuts[e.code]);}}};
    this.onResize=()=>this.resize();this.canvas.addEventListener('pointerdown',this.onPointerDown);this.canvas.addEventListener('pointerup',this.onPointerUp);addEventListener('keydown',this.onKey);addEventListener('resize',this.onResize);
  }

  ndc(e){const r=this.canvas.getBoundingClientRect();return new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);}
  handleTap(e){
    if(window.npcConvState?.active||document.getElementById('scene-panel'))return;
    if(this.combatController?.handleTap(e,this.raycaster))return;
    this.raycaster.setFromCamera(this.ndc(e),this.camera);
    const interactionHit=this.raycaster.intersectObjects(this.interactionObjects,true)[0];
    if(interactionHit){const record=this.zone.interactables.find(i=>i.object===interactionHit.object||i.object===interactionHit.object.parent);if(record){this.goToInteraction(record,e.shiftKey);return;}}
    const groundHit=this.raycaster.intersectObject(this.zone.ground,true)[0];if(!groundHit)return;
    const target=groundHit.point;target.x=THREE.MathUtils.clamp(target.x,this.zone.bounds.minX,this.zone.bounds.maxX);target.z=THREE.MathUtils.clamp(target.z,this.zone.bounds.minZ,this.zone.bounds.maxZ);
    this.pendingInteraction=null;this.hidePrompt();this.closeInteractionMenu();this.moveActor(target,e.shiftKey);
  }
  moveActor(target,run=false,onArrive=null){const path=this.navigation.findPath(this.actor.position,target);if(!path.length){this.toast('That route is blocked.');return;}this.marker.position.copy(target);this.marker.visible=true;this.actor.moveAlong(path,{run,onArrive:()=>{this.marker.visible=false;this.persistPosition();if(onArrive)onArrive();}});}
  goToInteraction(record,run=false){this.closeInteractionMenu();this.pendingInteraction=null;this.hidePrompt();const direction=this.actor.position.clone().sub(record.position).setY(0).normalize();const stop=record.position.clone().addScaledVector(direction,record.range*.72);this.moveActor(stop,run,()=>{this.pendingInteraction=record;this.showPrompt(record);});}
  showPrompt(record){this.promptText.textContent=record.label;this.prompt.querySelector('button').setAttribute('aria-label',`Interact: ${record.label}`);this.prompt.hidden=false;}
  hidePrompt(){this.prompt.hidden=true;}
  confirmInteraction(){const record=this.pendingInteraction;if(!record)return;this.pendingInteraction=null;this.hidePrompt();if(Array.isArray(record.actions)&&record.actions.length>1){this.openInteractionMenu(record);return;}record.onInteract?.(this);}
  openInteractionMenu(record){this.activeInteraction=record;this.interactionTitle.textContent=record.label;this.interactionChoices.replaceChildren();for(const [index,action] of record.actions.entries()){const button=document.createElement('button');button.type='button';button.dataset.envAction=String(index);const icon=document.createElement('span');icon.textContent=action.icon||'◆';const copy=document.createElement('span');const label=document.createElement('strong');label.textContent=action.label;copy.appendChild(label);if(action.check){const detail=document.createElement('small');detail.textContent=`${String(action.check.skill||action.check.ability).replaceAll('_',' ').toUpperCase()} · DC ${action.check.dc}`;copy.appendChild(detail);}button.append(icon,copy);this.interactionChoices.appendChild(button);}this.customActionInput.value='';this.interactionMenu.hidden=false;}
  closeInteractionMenu(){if(this.interactionMenu)this.interactionMenu.hidden=true;this.activeInteraction=null;}
  async selectInteractionAction(index){const record=this.activeInteraction,action=record?.actions?.[index];if(!record||!action)return;this.closeInteractionMenu();if(action.direct){record.onInteract?.(this);return;}const result=await window.resolveEnvironmentalAction?.({zoneId:this.zone.id,targetId:record.id,targetLabel:record.label,action});if(result?.pending)this.toast('Waiting for the Session Master to resolve that action.');else if(result?.message)this.toast(result.message,4800);}
  async submitCustomEnvironmentAction(){const record=this.activeInteraction,text=this.customActionInput.value.trim();if(!record||!text)return;this.customActionInput.disabled=true;try{const result=await window.resolveEnvironmentalAction?.({zoneId:this.zone.id,targetId:record.id,targetLabel:record.label,text});if(result?.pending){this.closeInteractionMenu();this.toast('Waiting for the Session Master to resolve that action.');return;}this.customActionInput.value='';if(result?.message)this.toast(result.message,4800);}catch(error){console.error('Environmental action failed:',error);this.toast('That action could not be resolved. Please try again.');}finally{this.customActionInput.disabled=false;}}
  playClassAction(){if(this.combatController?.active){this.combatController.attack();return;}if(this.actor.playPrimaryAction())this.toast(this.actor.classProfile.action,900);}
  registerInteraction(record){this.zone.interactables.push(record);this.interactionObjects.push(record.object);}

  makeMarker(){const group=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.5,32),new THREE.MeshBasicMaterial({color:0xe2c779,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;group.add(ring);group.visible=false;this.scene.add(group);this.marker=group;this.markerRing=ring;}
  updateWorldLabels(){for(const label of this.worldLabels||[]){label.getWorldPosition(this.worldLabelPosition);const distance=this.camera.position.distanceTo(this.worldLabelPosition),base=label.userData.worldLabelBase;label.visible=distance>2.5;const factor=THREE.MathUtils.clamp(distance/18,.16,1);label.scale.set(base[0]*factor,base[1]*factor,base[2]);}}
  resize(){const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;this.renderer?.setSize(w,h,false);if(this.camera){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}}
  start(){if(this.running)return;this.running=true;if(!this.marker)this.makeMarker();this.clock.start();this.frame();}
  frame(){if(!this.running)return;const dt=Math.min(this.clock.getDelta(),.05),time=this.clock.elapsedTime;if(document.hidden){this.raf=requestAnimationFrame(()=>this.frame());return;}this.actor?.update(dt);if(!this.combatController?.active)this.npcManager?.update(dt,time);this.combatController?.update(dt);this.partyManager?.update(dt);this.chronicleAdapter?.update(dt);this.worldPolish?.update(dt);this.abilityEffects?.update(dt);if(this.classActionText)this.classActionText.textContent=this.combatController?.active?'Attack Target':this.actor.classProfile.action;if(this.cinematicDirector?.active)this.cinematicDirector.update(dt);else{if(this.actor){const focusActor=this.cinematicFocus||this.actor,focus=focusActor.position.clone().add(new THREE.Vector3(0,1.25,0));this.controls.target.lerp(focus,1-Math.exp(-dt*4.5));}this.controls.update();}if(this.marker?.visible)this.markerRing.rotation.z+=dt*1.8;this.zone?.update?.(time,dt);this.updateWorldLabels();this.renderer.render(this.scene,this.camera);this.raf=requestAnimationFrame(()=>this.frame());}
  stop(){this.running=false;cancelAnimationFrame(this.raf);}
  dispose(){this.persistPosition();this.stop();clearTimeout(this.toastTimer);this.canvas.removeEventListener('pointerdown',this.onPointerDown);this.canvas.removeEventListener('pointerup',this.onPointerUp);removeEventListener('keydown',this.onKey);removeEventListener('resize',this.onResize);this.cinematicDirector?.dispose();this.controls?.dispose();this.worldPolish?.dispose();this.chronicleAdapter?.dispose();this.combatController?.dispose();this.partyManager?.dispose();this.abilityEffects?.dispose();this.npcManager?.dispose();this.actor?.dispose();this.zone?.dispose?.();this.renderer?.dispose();this.overlay.replaceChildren();}
}
