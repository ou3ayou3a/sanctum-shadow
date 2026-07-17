import * as THREE from 'three';
import {CharacterActor} from './character-actor.js?v=163';

const MOVE_RANGE=4.5;

function localCombatantId(){return window.mp?.sessionCode&&window.mp?.playerId?window.mp.playerId:'player';}
function displayName(combatant){return String(combatant?.name||'').trim()||'Hostile Creature';}
function inferRace(combatant){const text=`${combatant.id||''} ${combatant.name||''}`.toLowerCase();for(const race of['goblin','orc','dwarf'])if(text.includes(race))return race;if(/drow|dark elf/.test(text))return'dark_elf';if(/high elf/.test(text))return'high_elf';if(text.includes('elf'))return'elf';return'human';}
function inferClass(combatant){const text=`${combatant.id||''} ${combatant.name||''}`.toLowerCase();if(/archer|ranger|hunter/.test(text))return'ranger';if(/mage|wizard|witch|cultist|warlock|voice/.test(text))return'mage';if(/cleric|priest|sister|brother/.test(text))return'cleric';if(/rogue|thief|assassin|bandit/.test(text))return'rogue';if(/paladin|templar/.test(text))return'paladin';return'warrior';}

export class Combat3DController{
  constructor(engine){this.engine=engine;this.records=new Map();this.hp=new Map();this.active=false;this.starting=false;this.lastTurnId=null;this.modelUrl=engine.characterConfig.modelUrl;this.presented=new Set();this.presentationTimers=new Set();}

  state(){return window.combatState;}
  currentId(){const state=this.state();return state?.turnOrder?.[state.currentTurnIndex]||null;}
  isLocalTurn(){const state=this.state(),id=this.currentId(),local=localCombatantId();return !!state?.active&&(id===local||(!window.mp?.sessionCode&&state.combatants?.[id]?.isPlayer));}

  async start(){
    if(this.active||this.starting)return;this.starting=true;this.active=true;this.victoryShown=false;document.body.classList.add('world3d-combat');this.engine.actor.stop();this.engine.pendingInteraction=null;this.engine.hidePrompt();this.engine.marker.visible=false;
    if(this.engine.npcManager){for(const record of this.engine.npcManager.records){record.actor.visible=false;record.collider.visible=false;record.label.style.display='none';}}
    this.makeRange();this.makeHud();
    const state=this.state(),origin=this.engine.actor.position.clone(),local=localCombatantId(),localPosition=state.combatants?.[local]?.position||state.combatants?.player?.position||{x:0,z:0};this.battleOrigin=origin.clone().sub(new THREE.Vector3(localPosition.x||0,0,localPosition.z||0));let ally=0,enemy=0;this.makeCover();
    const tasks=Object.values(state.combatants||{}).map(async combatant=>{
      this.hp.set(combatant.id,combatant.hp);
      if(combatant.id===local||(!window.mp?.sessionCode&&combatant.id==='player')){this.engine.actor.setCombatStance(true);this.engine.actor.userData.combatantId=combatant.id;this.records.set(combatant.id,{combatant,actor:this.engine.actor,owned:false,label:this.makeLabel(combatant),audioPosition:this.engine.actor.position.clone(),stepDistance:0,stepCount:0});return;}
      const partyCharacter=window.mp?.session?.players?.[combatant.playerId||combatant.id]?.character;
      const angle=combatant.isPlayer?Math.PI/2+(ally++-.5)*.75:Math.PI+(enemy++-.5)*.62;
      const radius=combatant.isPlayer?2.2:4.7+Math.floor(enemy/4)*1.15;
      const desired=combatant.position?this.battleOrigin.clone().add(new THREE.Vector3(combatant.position.x,0,combatant.position.z)):origin.clone().add(new THREE.Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius));const cell=this.engine.navigation.nearestOpen(this.engine.navigation.cellAt(desired)),position=cell?this.engine.navigation.pointAt(cell):desired;
      const actor=new CharacterActor({modelUrl:this.modelUrl,race:partyCharacter?.race||inferRace(combatant),characterClass:partyCharacter?.class||inferClass(combatant),scale:combatant.boss?1.12:.94});actor.position.set(position.x,0,position.z);actor.lookAt(origin.x,0,origin.z);actor.userData.combatantId=combatant.id;this.engine.scene.add(actor);
      try{await actor.load();actor.setCombatStance(true);actor.traverse(object=>{object.userData.combatantId=combatant.id;if(object.isMesh)object.castShadow=false;});}catch(error){console.warn('Combat actor could not load',displayName(combatant),error);}
      this.records.set(combatant.id,{combatant,actor,owned:true,label:this.makeLabel(combatant),audioPosition:actor.position.clone(),stepDistance:0,stepCount:0});
    });
    await Promise.all(tasks);this.starting=false;if(!this.state()?.active){this.stop();return;}this.sync(true);const firstEnemy=[...this.records.values()].find(record=>!record.combatant.isPlayer&&record.actor.visible);if(firstEnemy){this.lockAction(1.2);this.engine.cinematicDirector?.playMoment('combat_intro',this.engine.actor,firstEnemy.actor,{duration:1.15,caption:'ROLL FOR INITIATIVE',subcaption:displayName(firstEnemy.combatant)});}this.engine.toast('Combat: click the ground to spend 1 AP moving. Click an enemy to target.');
  }

  makeRange(){const material=new THREE.MeshBasicMaterial({color:0x79b9a0,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});this.range=new THREE.Mesh(new THREE.CircleGeometry(MOVE_RANGE,64),material);this.range.rotation.x=-Math.PI/2;this.range.position.copy(this.engine.actor.position);this.range.position.y=.018;this.engine.scene.add(this.range);}
  makeCover(){this.coverMeshes=[];for(const item of this.state()?.tactical?.cover||[]){const material=new THREE.MeshStandardMaterial({color:0x6b4b31,roughness:.92,transparent:true,opacity:.78}),object=new THREE.Mesh(new THREE.BoxGeometry((item.radius||.7)*2,.72,.28),material);object.position.copy(this.battleOrigin).add(new THREE.Vector3(item.x||0,.36,item.z||0));object.castShadow=object.receiveShadow=true;object.name=`tactical-cover:${item.id||'cover'}`;this.engine.scene.add(object);this.coverMeshes.push(object);}}
  makeHud(){
    const hud=document.createElement('section');hud.className='world3d-combat-hud';hud.setAttribute('aria-label','Tactical combat controls');
    hud.innerHTML='<div class="w3c-initiative" aria-label="Initiative order"></div><div class="w3c-summary"><span class="w3c-encounter">ENCOUNTER</span><strong>TACTICAL COMBAT</strong><span class="w3c-round"></span><span class="w3c-turn"></span><span class="w3c-ap"></span></div><div class="w3c-target"><span class="w3c-target-kicker">CURRENT TARGET</span><strong class="w3c-target-name">Select an enemy</strong><span class="w3c-target-detail">Click a hostile character in the world</span><div class="w3c-target-health" aria-hidden="true"><i></i></div></div><div class="w3c-action-deck"><div class="w3c-actions"><button data-action="attack"><kbd>1</kbd><span>⚔</span><strong>Attack</strong></button><button data-action="item"><kbd>2</kbd><span>◇</span><strong>Item</strong></button><button class="w3c-end-turn" data-action="end"><kbd>Space</kbd><span>↪</span><strong>End Turn</strong></button></div><div class="w3c-spells"></div></div>';
    hud.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const action=button.dataset.action;if(action==='attack')this.attack();else if(action==='item')window.combatItem?.();else if(action==='end')window.endPlayerTurn?.();else if(action==='spell')this.chooseSpell(button.dataset.spell);});
    this.engine.overlay.appendChild(hud);this.hud=hud;
  }
  makeLabel(combatant){const label=document.createElement('button');label.type='button';label.className=`world3d-combatant-label ${combatant.isPlayer?'ally':'enemy'}`;label.addEventListener('click',()=>this.select(combatant.id));this.engine.overlay.appendChild(label);return label;}

  chooseSpell(id){if(!this.isLocalTurn())return;window.selectSpell?.(id);this.sync(true);this.engine.toast('Spell readied — click a target to cast.');}
  handleKey(code){
    if(!this.active)return false;
    if(code==='Digit1'){this.attack();return true;}
    if(code==='Digit2'){if(this.isLocalTurn())window.combatItem?.();return true;}
    if(code==='Space'){if(this.isLocalTurn())window.endPlayerTurn?.();return true;}
    const index=Number(String(code).replace('Digit',''))-3,spell=(this.state()?.combatants?.[localCombatantId()]||this.state()?.combatants?.player)?.spells?.[index];if(index>=0&&spell){this.chooseSpell(spell.id);return true;}
    return false;
  }
  attackAssessment(){const state=this.state(),local=state?.combatants?.[localCombatantId()]||state?.combatants?.player,target=state?.combatants?.[state?.selectedTarget];return window.TacticalCombat?.validateAttack(local,target,{cover:state?.tactical?.cover||[]})||{ok:true,range:null,distance:null,coverBonus:0};}
  schedule(callback,delay){const timer=setTimeout(()=>{this.presentationTimers.delete(timer);callback();},Math.max(0,delay));this.presentationTimers.add(timer);return timer;}
  lockAction(seconds){this.actionLockUntil=Math.max(this.actionLockUntil||0,performance.now()+Math.max(0,seconds)*1000);this.actionLocked=true;this.schedule(()=>{if(performance.now()+8>=this.actionLockUntil)this.actionLocked=false;},Math.max(0,seconds)*1000);}
  missReaction(targetRecord,eventId='solo'){const name=window.CombatPresentation?.missReaction(targetRecord?.combatant,eventId)||'dodge';targetRecord?.actor?.playOneShot(name);}
  beginSoloAction({action='attack',spell=null,targetId,resolve}){
    const targetRecord=this.records.get(targetId),source=this.engine.actor;if(!targetRecord?.actor)return false;
    const timing=source.playCombatAction({action,spell,target:targetRecord.actor});if(!timing)return false;
    this.engine.cinematicDirector?.playMoment(action==='spell'?'spell':'attack',source,targetRecord.actor,{duration:Math.min(1.15,timing.impactDelay+.28)});
    this.lockAction(timing.recoveryDelay);
    this.schedule(()=>{
      const profile={...timing,hit:true};
      this.engine.abilityEffects?.present(profile,source,targetRecord.actor,{onImpact:()=>{
        const before=Number(this.state()?.combatants?.[targetId]?.hp);this.impactActorId=localCombatantId();resolve?.();const after=Number(this.state()?.combatants?.[targetId]?.hp);
        if(Number.isFinite(before)&&after===before&&action!=='spell')this.missReaction(targetRecord);
        if(this.state()?.active===false&&Number.isFinite(before)&&after<before){targetRecord.combatant=this.state()?.combatants?.[targetId]||targetRecord.combatant;this.hp.set(targetId,after);if(after<=0)window.AudioEngine?.playWorldSound?.('death',targetRecord.actor.position,{emitterId:`combat:${targetId}`,eventId:`solo:${performance.now()}:death`});this.hitFeedback(targetRecord,before-after,after<=0);this.endingUntil=performance.now()+(after<=0?1600:800);}else this.sync(true);this.impactActorId=null;
      }});
    },timing.releaseDelay*1000);
    return true;
  }
  beginMultiplayerAction({action='attack',spell=null,targetId,resolve}){
    const target=this.records.get(targetId)?.actor,timing=this.engine.actor.playCombatAction({action,spell,target});if(!timing)return false;
    this.engine.cinematicDirector?.playMoment(action==='spell'?'spell':'attack',this.engine.actor,target,{duration:Math.min(1.15,timing.impactDelay+.28)});
    this.lockAction(timing.recoveryDelay+.18);this.pendingLocalPresentation={actorId:localCombatantId(),action,startedAt:performance.now(),timing};resolve?.();
    this.schedule(()=>{this.pendingLocalPresentation=null;},(timing.recoveryDelay+.18)*1000);return true;
  }
  attack(){if(this.actionLocked)return;if(!this.isLocalTurn()){this.engine.toast('Wait for your turn.');return;}const state=this.state(),targetId=state?.selectedTarget;if(!targetId){this.engine.toast('Select an enemy first.');return;}const assessment=this.attackAssessment();if(!assessment.ok){this.engine.toast(`Target is out of range — ${assessment.distance?.toFixed(1)}m away, ${assessment.range}m reach.`);return;}const data={targetId,resolve:()=>window.combatAttack?.()};if(window.mp?.sessionCode)this.beginMultiplayerAction(data);else this.beginSoloAction(data);}
  cast(targetId,spell){if(this.actionLocked||!spell)return;const data={action:'spell',spell,targetId,resolve:()=>window.castSelectedSpell?.()};if(window.mp?.sessionCode)this.beginMultiplayerAction(data);else this.beginSoloAction(data);}
  select(id){const state=this.state(),target=state?.combatants?.[id],spell=state?.selectedSpell;if(!target||target.hp<=0)return;const allySpell=target.isPlayer&&['heal','revive','buff'].includes(spell?.type);if(target.isPlayer&&!allySpell)return;window.selectTarget?.(id);if(spell&&this.isLocalTurn())this.cast(id,spell);this.sync(true);}

  presentAuthoritativeUpdate(nextState,presentation,apply){
    if(!presentation||!['attack','spell'].includes(presentation.action)||this.presented.has(presentation.id))return false;
    const sourceRecord=this.records.get(presentation.actorId),targetRecord=this.records.get(presentation.targetId);if(!sourceRecord?.actor||!targetRecord?.actor)return false;
    this.presented.add(presentation.id);const localPending=this.pendingLocalPresentation?.actorId===presentation.actorId&&this.pendingLocalPresentation?.action===presentation.action;
    const timing=localPending?this.pendingLocalPresentation.timing:sourceRecord.actor.playCombatAction({action:presentation.action,spell:presentation.spell,target:targetRecord.actor,force:true});
    if(!timing)return false;
    if(!localPending&&(presentation.actorId===localCombatantId()||presentation.targetId===localCombatantId()||sourceRecord.combatant.boss))this.engine.cinematicDirector?.playMoment(presentation.action==='spell'?'spell':'attack',sourceRecord.actor,targetRecord.actor,{duration:Math.min(1.15,(timing.impactDelay||.6)+.28)});
    const elapsed=localPending?(performance.now()-this.pendingLocalPresentation.startedAt)/1000:0;
    const releaseDelay=Math.max(0,(timing.releaseDelay||presentation.releaseDelay||0)-elapsed),travelDuration=presentation.travelDuration??timing.travelDuration??0;
    this.lockAction(Math.max(.12,(timing.recoveryDelay||presentation.recoveryDelay||.8)-elapsed));
    this.schedule(()=>this.engine.abilityEffects?.present({...presentation,travelDuration},sourceRecord.actor,targetRecord.actor,{onImpact:()=>{
      this.impactActorId=presentation.actorId;apply();if(!presentation.hit&&!presentation.healing)this.missReaction(targetRecord,presentation.id);
      if(nextState?.active===false&&presentation.damage>0){const hp=Number(nextState.combatants?.[presentation.targetId]?.hp)||0;targetRecord.combatant=nextState.combatants?.[presentation.targetId]||targetRecord.combatant;this.hp.set(presentation.targetId,hp);if(hp<=0)window.AudioEngine?.playWorldSound?.('death',targetRecord.actor.position,{emitterId:`combat:${presentation.targetId}`,eventId:`${presentation.id}:death`});this.hitFeedback(targetRecord,presentation.damage,hp<=0);this.endingUntil=performance.now()+(hp<=0?1600:800);}else this.sync(true);this.impactActorId=null;
    }}),releaseDelay*1000);
    return true;
  }

  handleTap(event,raycaster){
    if(!this.active)return false;raycaster.setFromCamera(this.engine.ndc(event),this.engine.camera);
    const actors=[...this.records.values()].filter(record=>record.owned).map(record=>record.actor);const hit=raycaster.intersectObjects(actors,true)[0];
    if(hit){let object=hit.object;while(object&&!object.userData.combatantId)object=object.parent;if(object?.userData.combatantId)this.select(object.userData.combatantId);return true;}
    const ground=raycaster.intersectObject(this.engine.zone.ground,true)[0];if(!ground)return true;this.move(ground.point,event.shiftKey);return true;
  }
  move(point,run=false){
    const state=this.state();if(!this.isLocalTurn()){this.engine.toast('You can move only on your turn.');return;}if((state.apRemaining||0)<1){this.engine.toast('No AP remains.');return;}
    const target=point.clone();target.y=0;const distance=target.distanceTo(this.engine.actor.position);if(distance>MOVE_RANGE){this.engine.toast(`Movement is limited to ${MOVE_RANGE}m per AP.`);return;}
    const tacticalPosition={x:Number((target.x-this.battleOrigin.x).toFixed(3)),z:Number((target.z-this.battleOrigin.z).toFixed(3))},local=state.combatants?.[localCombatantId()]||state.combatants?.player,validation=window.TacticalCombat?.validateMove(local?.position,tacticalPosition,{maxDistance:state.tactical?.moveRange||MOVE_RANGE,bounds:state.tactical?.bounds||12});if(validation&&!validation.ok){this.engine.toast('That destination is outside the tactical battlefield.');return;}
    const path=this.engine.navigation.findPath(this.engine.actor.position,target);if(!path.length){this.engine.toast('That route is blocked.');return;}this.engine.marker.position.copy(target);this.engine.marker.visible=true;this.engine.actor.moveAlong(path,{run,onArrive:()=>{this.engine.marker.visible=false;window.combatMove?.(validation?.position||tacticalPosition);this.sync(true);}});
  }

  sync(force=false){
    const state=this.state();if(!state?.active)return;const current=this.currentId();
    for(const [id,record]of this.records){const combatant=state.combatants?.[id];if(!combatant)continue;record.combatant=combatant;if(record.owned&&combatant.position)record.targetPosition=this.battleOrigin.clone().add(new THREE.Vector3(combatant.position.x,0,combatant.position.z));const previous=this.hp.get(id);if(previous!==undefined&&combatant.hp<previous){if(combatant.hp<=0)window.AudioEngine?.playWorldSound?.('death',record.actor.position,{emitterId:`combat:${id}`,eventId:`defeat:${state.round||0}:${id}:${previous}`});this.hitFeedback(record,previous-combatant.hp,combatant.hp<=0);}this.hp.set(id,combatant.hp);record.actor.visible=combatant.hp>0||performance.now()<(record.deathUntil||0);record.actor.selectionRing?.material.color.set(id===state.selectedTarget?0xff5252:(combatant.isPlayer?0x71c99b:0xb7473f));record.actor.selectionRing?.scale.setScalar(id===current?1.35:1);record.label.disabled=combatant.hp<=0;}
    this.lastTurnId=current;
    this.engine.abilityEffects?.syncStatuses(this.records,state.statusEffects);
    this.range.position.x=this.engine.actor.position.x;this.range.position.z=this.engine.actor.position.z;this.range.visible=this.isLocalTurn()&&(state.apRemaining||0)>0;this.renderHud(force);
  }
  hitFeedback(record,damage,dead=false){const attacker=this.records.get(this.impactActorId||this.lastTurnId)?.actor;this.engine.cinematicDirector?.addImpact(dead ? .15 : .075);if(dead){record.deathUntil=performance.now()+1600;record.actor.playOneShot('death',{returnToIdle:false});if(this.state()?.active===false&&!this.victoryShown){this.victoryShown=true;this.engine.cinematicDirector?.playMoment('victory',attacker||this.engine.actor,record.actor,{duration:1.45,caption:'VICTORY',subcaption:`${displayName(record.combatant)} defeated`});}else if(attacker)this.engine.cinematicDirector?.playMoment('finisher',attacker,record.actor,{duration:1.05});}else{if(attacker)record.actor.applyImpactReaction(attacker,{distance:.24+Math.min(.18,damage*.006),duration:.34});if(!record.actor.playOneShot('hit')){record.actor.scale.multiplyScalar(.92);setTimeout(()=>record.actor?.scale.multiplyScalar(1/.92),130);}}const text=document.createElement('div');text.className='world3d-damage';text.textContent=`−${damage}`;this.engine.overlay.appendChild(text);this.positionElement(text,record.actor.position,2.4);setTimeout(()=>text.remove(),900);}
  updateCombatAudio(record){const emitterId=`combat:${record.combatant.id}`,position=record.actor.position,active=record.actor.visible&&(record.combatant.hp>0||performance.now()<(record.deathUntil||0));window.AudioEngine?.updateWorldEmitter?.(emitterId,{position:{x:position.x,y:1.15,z:position.z},active,maxDistance:30,refDistance:1.7});if(!active){record.stepDistance=0;record.audioPosition.copy(position);return;}const moved=record.audioPosition.distanceTo(position);record.audioPosition.copy(position);record.stepDistance+=moved;if(record.stepDistance<.76)return;record.stepDistance%=.76;record.stepCount++;window.AudioEngine?.playWorldSound?.('footstep',position,{emitterId,volume:.88,variant:record.stepCount,maxDistance:18});if(record.stepCount%4===0)window.AudioEngine?.playWorldSound?.('armor',position,{emitterId,volume:.55,variant:record.stepCount,maxDistance:15});}
  positionElement(element,position,height=2.2){const projected=new THREE.Vector3(position.x,height,position.z).project(this.engine.camera),rect=this.engine.canvas.getBoundingClientRect();element.style.left=`${rect.left+(projected.x*.5+.5)*rect.width}px`;element.style.top=`${rect.top+(-projected.y*.5+.5)*rect.height}px`;}
  renderHud(){
    if(!this.hud)return;const state=this.state(),current=state.combatants?.[this.currentId()],local=state.combatants?.[localCombatantId()]||state.combatants?.player,target=state.combatants?.[state.selectedTarget];
    this.hud.querySelector('.w3c-round').textContent=`ROUND ${state.round||1}`;this.hud.querySelector('.w3c-turn').textContent=this.isLocalTurn()?'YOUR TURN':`${displayName(current).toUpperCase()} ACTS`;const ap=Math.max(0,state.apRemaining||0);this.hud.querySelector('.w3c-ap').innerHTML=`<b>${Array.from({length:3},(_,index)=>`<i class="${index<ap?'filled':''}"></i>`).join('')}</b><span>${ap} AP</span>`;
    const assessment=target?this.attackAssessment():null,targetName=this.hud.querySelector('.w3c-target-name'),targetDetail=this.hud.querySelector('.w3c-target-detail'),targetHealth=this.hud.querySelector('.w3c-target-health i');
    targetName.textContent=target?displayName(target):'Select an enemy';targetDetail.textContent=target?`${target.boss?'Unknown vitality':`${target.hp}/${target.maxHp} HP`}${assessment?.distance!==null?` · ${assessment.distance.toFixed(1)}m · ${assessment.coverBonus?'Half cover':'Clear line'}`:''}`:'Click a hostile character in the world';targetHealth.style.width=target&&!target.boss?`${Math.max(0,Math.min(100,target.hp/Math.max(1,target.maxHp)*100))}%`:'0%';
    const initiativeSignature=(state.turnOrder||[]).map(id=>`${id}:${state.combatants?.[id]?.hp||0}:${id===this.currentId()}`).join('|');if(initiativeSignature!==this.initiativeSignature){this.initiativeSignature=initiativeSignature;const initiative=this.hud.querySelector('.w3c-initiative');initiative.replaceChildren();for(const id of state.turnOrder||[]){const combatant=state.combatants?.[id];if(!combatant)continue;const chip=document.createElement('button');chip.type='button';chip.className=`w3c-initiative-chip ${combatant.isPlayer?'ally':'enemy'} ${id===this.currentId()?'active':''}`;chip.disabled=combatant.hp<=0;chip.setAttribute('aria-label',`${displayName(combatant)}${id===this.currentId()?', current turn':''}`);chip.textContent=displayName(combatant).split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase();if(!combatant.isPlayer)chip.addEventListener('click',()=>this.select(id));initiative.appendChild(chip);}}
    for(const button of this.hud.querySelectorAll('.w3c-actions [data-action]')){const costsAp=button.dataset.action==='attack'||button.dataset.action==='item';button.disabled=!this.isLocalTurn()||(costsAp&&(state.apRemaining||0)<1)||(button.dataset.action==='attack'&&assessment&&!assessment.ok);}
    const knownSpells=local?.spells||[],myTurn=this.isLocalTurn();const signature=knownSpells.map(spell=>`${spell.id}:${myTurn&&local.mp>=spell.mp&&state.apRemaining>=spell.ap}:${state.selectedSpell?.id===spell.id}`).join('|');
    if(signature!==this.spellSignature){this.spellSignature=signature;const spells=this.hud.querySelector('.w3c-spells');spells.replaceChildren();for(const [index,spell]of knownSpells.entries()){const button=document.createElement('button');button.type='button';button.dataset.action='spell';button.dataset.spell=spell.id;const key=document.createElement('kbd');key.textContent=String(index+3);const icon=document.createElement('span');icon.textContent=spell.icon||'✦';const name=document.createElement('strong');name.textContent=spell.name;const cost=document.createElement('small');cost.textContent=`${spell.ap} AP · ${spell.mp} MP`;button.append(key,icon,name,cost);button.disabled=!myTurn||local.mp<spell.mp||state.apRemaining<spell.ap;button.classList.toggle('selected',state.selectedSpell?.id===spell.id);spells.appendChild(button);}}
  }
  update(dt){
    const state=this.state();if(state?.active&&!this.active){this.start();return;}if(!state?.active&&this.active&&performance.now()>=(this.endingUntil||0)){this.stop();return;}if(!this.active)return;for(const record of this.records.values())if(record.owned){record.actor.update(dt);if(record.targetPosition)record.actor.position.lerp(record.targetPosition,1-Math.exp(-dt*8));}this.sync();for(const record of this.records.values()){this.updateCombatAudio(record);if(record.actor.visible){this.positionElement(record.label,record.actor.position,2.5*record.actor.profile.proportions[1]);record.label.style.display='block';const c=record.combatant,pct=Math.max(0,Math.round(c.hp/c.maxHp*100));record.label.textContent=`${displayName(c)} · ${c.boss?'???':`${pct}%`}`;}else record.label.style.display='none';}
  }
  stop(){
    if(!this.active&&!this.starting)return;this.active=false;this.starting=false;this.actionLocked=false;this.actionLockUntil=0;this.endingUntil=0;this.pendingLocalPresentation=null;this.spellSignature='';this.victoryShown=false;for(const timer of this.presentationTimers)clearTimeout(timer);this.presentationTimers.clear();this.presented.clear();document.body.classList.remove('world3d-combat');if(this.engine.cinematicDirector?.mode==='moment')this.engine.cinematicDirector.exit({immediate:true});this.engine.actor?.setCombatStance(false);this.engine.abilityEffects?.dispose();for(const record of this.records.values()){window.AudioEngine?.removeWorldEmitter?.(`combat:${record.combatant.id}`);record.label.remove();if(record.owned){this.engine.scene.remove(record.actor);record.actor.dispose();}}delete this.engine.actor?.userData?.combatantId;this.records.clear();this.hp.clear();this.hud?.remove();this.hud=null;if(this.range){this.engine.scene.remove(this.range);this.range.geometry.dispose();this.range.material.dispose();this.range=null;}for(const object of this.coverMeshes||[]){this.engine.scene.remove(object);object.geometry.dispose();object.material.dispose();}this.coverMeshes=[];if(this.engine.npcManager)for(const record of this.engine.npcManager.records){record.actor.visible=true;record.collider.visible=true;}this.engine.toast('Combat ended. Exploration resumed.');
  }
  dispose(){this.stop();}
}
