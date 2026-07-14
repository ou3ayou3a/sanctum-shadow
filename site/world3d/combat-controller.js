import * as THREE from 'three';
import {CharacterActor} from './character-actor.js';

const MOVE_RANGE=4.5;

function localCombatantId(){return window.mp?.sessionCode&&window.mp?.playerId?window.mp.playerId:'player';}
function displayName(combatant){return String(combatant?.name||'').trim()||'Hostile Creature';}
function inferRace(combatant){const text=`${combatant.id||''} ${combatant.name||''}`.toLowerCase();for(const race of['goblin','orc','dwarf'])if(text.includes(race))return race;if(/drow|dark elf/.test(text))return'dark_elf';if(/high elf/.test(text))return'high_elf';if(text.includes('elf'))return'elf';return'human';}
function inferClass(combatant){const text=`${combatant.id||''} ${combatant.name||''}`.toLowerCase();if(/archer|ranger|hunter/.test(text))return'ranger';if(/mage|wizard|witch|cultist|warlock|voice/.test(text))return'mage';if(/cleric|priest|sister|brother/.test(text))return'cleric';if(/rogue|thief|assassin|bandit/.test(text))return'rogue';if(/paladin|templar/.test(text))return'paladin';return'warrior';}

export class Combat3DController{
  constructor(engine){this.engine=engine;this.records=new Map();this.hp=new Map();this.active=false;this.starting=false;this.lastTurnId=null;this.modelUrl=engine.characterConfig.modelUrl;}

  state(){return window.combatState;}
  currentId(){const state=this.state();return state?.turnOrder?.[state.currentTurnIndex]||null;}
  isLocalTurn(){const state=this.state(),id=this.currentId(),local=localCombatantId();return !!state?.active&&(id===local||(!window.mp?.sessionCode&&state.combatants?.[id]?.isPlayer));}

  async start(){
    if(this.active||this.starting)return;this.starting=true;this.active=true;document.body.classList.add('world3d-combat');this.engine.actor.stop();this.engine.pendingInteraction=null;this.engine.hidePrompt();this.engine.marker.visible=false;
    if(this.engine.npcManager){for(const record of this.engine.npcManager.records){record.actor.visible=false;record.collider.visible=false;record.label.style.display='none';}}
    this.makeRange();this.makeHud();
    const state=this.state(),origin=this.engine.actor.position.clone(),local=localCombatantId();let ally=0,enemy=0;
    const tasks=Object.values(state.combatants||{}).map(async combatant=>{
      this.hp.set(combatant.id,combatant.hp);
      if(combatant.id===local||(!window.mp?.sessionCode&&combatant.id==='player')){this.records.set(combatant.id,{combatant,actor:this.engine.actor,owned:false,label:this.makeLabel(combatant)});return;}
      const partyCharacter=window.mp?.session?.players?.[combatant.playerId||combatant.id]?.character;
      const angle=combatant.isPlayer?Math.PI/2+(ally++-.5)*.75:Math.PI+(enemy++-.5)*.62;
      const radius=combatant.isPlayer?2.2:4.7+Math.floor(enemy/4)*1.15;
      const desired=origin.clone().add(new THREE.Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius));const cell=this.engine.navigation.nearestOpen(this.engine.navigation.cellAt(desired));const position=this.engine.navigation.pointAt(cell);
      const actor=new CharacterActor({modelUrl:this.modelUrl,race:partyCharacter?.race||inferRace(combatant),characterClass:partyCharacter?.class||inferClass(combatant),scale:combatant.boss?1.12:.94});actor.position.set(position.x,0,position.z);actor.lookAt(origin.x,0,origin.z);actor.userData.combatantId=combatant.id;this.engine.scene.add(actor);
      try{await actor.load();actor.traverse(object=>{object.userData.combatantId=combatant.id;if(object.isMesh)object.castShadow=false;});}catch(error){console.warn('Combat actor could not load',displayName(combatant),error);}
      this.records.set(combatant.id,{combatant,actor,owned:true,label:this.makeLabel(combatant)});
    });
    await Promise.all(tasks);this.starting=false;if(!this.state()?.active){this.stop();return;}this.sync(true);this.engine.toast('Combat: click the ground to spend 1 AP moving. Click an enemy to target.');
  }

  makeRange(){const material=new THREE.MeshBasicMaterial({color:0x79b9a0,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});this.range=new THREE.Mesh(new THREE.CircleGeometry(MOVE_RANGE,64),material);this.range.rotation.x=-Math.PI/2;this.range.position.copy(this.engine.actor.position);this.range.position.y=.018;this.engine.scene.add(this.range);}
  makeHud(){
    const hud=document.createElement('section');hud.className='world3d-combat-hud';hud.setAttribute('aria-label','Tactical combat controls');
    hud.innerHTML='<div class="w3c-summary"><strong>TACTICAL COMBAT</strong><span class="w3c-round"></span><span class="w3c-turn"></span><span class="w3c-ap"></span></div><div class="w3c-target"></div><div class="w3c-actions"><button data-action="attack">⚔ Attack</button><button data-action="item">◈ Item</button><button data-action="end">End Turn</button></div><div class="w3c-spells"></div>';
    hud.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const action=button.dataset.action;if(action==='attack')this.attack();else if(action==='item')window.combatItem?.();else if(action==='end')window.endPlayerTurn?.();else if(action==='spell')this.chooseSpell(button.dataset.spell);});
    this.engine.overlay.appendChild(hud);this.hud=hud;
  }
  makeLabel(combatant){const label=document.createElement('button');label.type='button';label.className=`world3d-combatant-label ${combatant.isPlayer?'ally':'enemy'}`;label.addEventListener('click',()=>this.select(combatant.id));this.engine.overlay.appendChild(label);return label;}

  chooseSpell(id){if(!this.isLocalTurn())return;window.selectSpell?.(id);this.sync(true);this.engine.toast('Spell readied — click a target to cast.');}
  attack(){if(this.actionLocked)return;if(!this.isLocalTurn()){this.engine.toast('Wait for your turn.');return;}const state=this.state(),targetId=state?.selectedTarget;if(!targetId){this.engine.toast('Select an enemy first.');return;}const target=this.records.get(targetId)?.actor;this.actionLocked=true;this.engine.actor.playPrimaryAction();this.engine.abilityEffects?.basicAttack(this.engine.actor,target,this.engine.actor.characterClass);setTimeout(()=>window.combatAttack?.(),420);setTimeout(()=>{this.actionLocked=false;},720);}
  select(id){const state=this.state(),target=state?.combatants?.[id];if(!target||target.hp<=0)return;if(target.isPlayer){return;}window.selectTarget?.(id);if(state.selectedSpell&&this.isLocalTurn()){const spell=state.selectedSpell;this.engine.actor.playPrimaryAction();this.engine.abilityEffects?.cast(this.engine.actor,this.records.get(id)?.actor,spell);window.castSelectedSpell?.();}this.sync(true);}

  handleTap(event,raycaster){
    if(!this.active)return false;raycaster.setFromCamera(this.engine.ndc(event),this.engine.camera);
    const actors=[...this.records.values()].filter(record=>record.owned).map(record=>record.actor);const hit=raycaster.intersectObjects(actors,true)[0];
    if(hit){let object=hit.object;while(object&&!object.userData.combatantId)object=object.parent;if(object?.userData.combatantId)this.select(object.userData.combatantId);return true;}
    const ground=raycaster.intersectObject(this.engine.zone.ground,true)[0];if(!ground)return true;this.move(ground.point,event.shiftKey);return true;
  }
  move(point,run=false){
    const state=this.state();if(!this.isLocalTurn()){this.engine.toast('You can move only on your turn.');return;}if((state.apRemaining||0)<1){this.engine.toast('No AP remains.');return;}
    const target=point.clone();target.y=0;const distance=target.distanceTo(this.engine.actor.position);if(distance>MOVE_RANGE){this.engine.toast(`Movement is limited to ${MOVE_RANGE}m per AP.`);return;}
    const path=this.engine.navigation.findPath(this.engine.actor.position,target);if(!path.length){this.engine.toast('That route is blocked.');return;}this.engine.marker.position.copy(target);this.engine.marker.visible=true;this.engine.actor.moveAlong(path,{run,onArrive:()=>{this.engine.marker.visible=false;window.combatMove?.();this.sync(true);}});
  }

  sync(force=false){
    const state=this.state();if(!state?.active)return;const current=this.currentId();
    for(const [id,record]of this.records){const combatant=state.combatants?.[id];if(!combatant)continue;record.combatant=combatant;const previous=this.hp.get(id);if(previous!==undefined&&combatant.hp<previous)this.hitFeedback(record,previous-combatant.hp,combatant.hp<=0);this.hp.set(id,combatant.hp);record.actor.visible=combatant.hp>0||performance.now()<(record.deathUntil||0);record.actor.selectionRing?.material.color.set(id===state.selectedTarget?0xff5252:(combatant.isPlayer?0x71c99b:0xb7473f));record.actor.selectionRing?.scale.setScalar(id===current?1.35:1);record.label.disabled=combatant.hp<=0;}
    if(this.lastTurnId&&this.lastTurnId!==current){const previous=this.records.get(this.lastTurnId),local=this.records.get(localCombatantId())||this.records.get('player');if(previous?.actor&&this.lastTurnId!==localCombatantId()&&this.lastTurnId!=='player'){previous.actor.playPrimaryAction();this.engine.abilityEffects?.enemyAttack(previous.actor,local?.actor,previous.combatant);}}this.lastTurnId=current;
    this.engine.abilityEffects?.syncStatuses(this.records,state.statusEffects);
    this.range.position.x=this.engine.actor.position.x;this.range.position.z=this.engine.actor.position.z;this.range.visible=this.isLocalTurn()&&(state.apRemaining||0)>0;this.renderHud(force);
  }
  hitFeedback(record,damage,dead=false){if(dead){record.deathUntil=performance.now()+1400;record.actor.playOneShot('death',{returnToIdle:false});}else if(!record.actor.playOneShot('hit')){record.actor.scale.multiplyScalar(.92);setTimeout(()=>record.actor?.scale.multiplyScalar(1/.92),130);}const text=document.createElement('div');text.className='world3d-damage';text.textContent=`−${damage}`;this.engine.overlay.appendChild(text);this.positionElement(text,record.actor.position,2.4);setTimeout(()=>text.remove(),900);}
  positionElement(element,position,height=2.2){const projected=new THREE.Vector3(position.x,height,position.z).project(this.engine.camera),rect=this.engine.canvas.getBoundingClientRect();element.style.left=`${rect.left+(projected.x*.5+.5)*rect.width}px`;element.style.top=`${rect.top+(-projected.y*.5+.5)*rect.height}px`;}
  renderHud(){
    if(!this.hud)return;const state=this.state(),current=state.combatants?.[this.currentId()],local=state.combatants?.[localCombatantId()]||state.combatants?.player,target=state.combatants?.[state.selectedTarget];
    this.hud.querySelector('.w3c-round').textContent=`Round ${state.round||1}`;this.hud.querySelector('.w3c-turn').textContent=this.isLocalTurn()?'YOUR TURN':`${displayName(current)} acts`;this.hud.querySelector('.w3c-ap').textContent=`${state.apRemaining||0}/3 AP`;
    this.hud.querySelector('.w3c-target').textContent=target?`Target: ${displayName(target)} · ${target.boss?'???':`${target.hp}/${target.maxHp}`} HP`:'Select an enemy';
    for(const button of this.hud.querySelectorAll('.w3c-actions [data-action]'))button.disabled=!this.isLocalTurn();
    const knownSpells=local?.spells||[],myTurn=this.isLocalTurn();const signature=knownSpells.map(spell=>`${spell.id}:${myTurn&&local.mp>=spell.mp&&state.apRemaining>=spell.ap}:${state.selectedSpell?.id===spell.id}`).join('|');
    if(signature!==this.spellSignature){this.spellSignature=signature;const spells=this.hud.querySelector('.w3c-spells');spells.replaceChildren();for(const spell of knownSpells){const button=document.createElement('button');button.type='button';button.dataset.action='spell';button.dataset.spell=spell.id;button.textContent=`${spell.icon||'✦'} ${spell.name} · ${spell.ap}AP`;button.disabled=!myTurn||local.mp<spell.mp||state.apRemaining<spell.ap;button.classList.toggle('selected',state.selectedSpell?.id===spell.id);spells.appendChild(button);}}
  }
  update(dt){
    const state=this.state();if(state?.active&&!this.active){this.start();return;}if(!state?.active&&this.active){this.stop();return;}if(!this.active)return;for(const record of this.records.values())if(record.owned)record.actor.update(dt);this.sync();for(const record of this.records.values()){if(record.actor.visible){this.positionElement(record.label,record.actor.position,2.5*record.actor.profile.proportions[1]);record.label.style.display='block';const c=record.combatant,pct=Math.max(0,Math.round(c.hp/c.maxHp*100));record.label.textContent=`${displayName(c)} · ${c.boss?'???':`${pct}%`}`;}else record.label.style.display='none';}
  }
  stop(){
    if(!this.active&&!this.starting)return;this.active=false;this.starting=false;this.actionLocked=false;this.spellSignature='';document.body.classList.remove('world3d-combat');this.engine.abilityEffects?.dispose();for(const record of this.records.values()){record.label.remove();if(record.owned){this.engine.scene.remove(record.actor);record.actor.dispose();}}this.records.clear();this.hp.clear();this.hud?.remove();this.hud=null;if(this.range){this.engine.scene.remove(this.range);this.range.geometry.dispose();this.range.material.dispose();this.range=null;}if(this.engine.npcManager)for(const record of this.engine.npcManager.records){record.actor.visible=true;record.collider.visible=true;}this.engine.toast('Combat ended. Exploration resumed.');
  }
  dispose(){this.stop();}
}
