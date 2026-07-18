import * as THREE from 'three';

const TARGET_RULES=[
  [/covenant_hall|signing/i,'signing_hall'],[/scribe/i,'npc:trembling_scribe'],[/rhael/i,'npc:captain_rhael'],[/mourne/i,'npc:sister_mourne'],[/temple/i,'temple_quarter'],[/cartographer/i,'npc:drunk_cartographer'],[/tarnished_cup/i,'tarnished_cup'],[/archive/i,'church_archive'],[/merchant_road|thornwood|monastery|fortress|mol_village/i,'north_gate'],
];

function activeQuests(){return window.gameState?.activeQuests||[];}
function objectiveState(questId){return window.gameState?.questProgress?.[questId]?.objectives||{};}
function objectives(questId){return window.SanctumQuests?.getObjectives?.(questId)||[];}
function currentObjective(quest){const done=objectiveState(quest.id);return objectives(quest.id).find(objective=>!done[objective.id])||null;}
function questSignature(){return JSON.stringify({active:activeQuests().map(quest=>quest.id),progress:window.gameState?.questProgress||{},completed:(window.gameState?.completedQuests||[]).map(quest=>quest.id)});}

export class Chronicle3DAdapter{
  constructor(engine){this.engine=engine;this.markers=[];this.signature='';this.completed=new Set((window.gameState?.completedQuests||[]).map(quest=>quest.id));}
  initialize(){this.buildTracker();this.refresh();this.syncCinematic();return this;}
  buildTracker(){const panel=document.createElement('aside');panel.className='world3d-quest-tracker';panel.innerHTML='<div class="w3q-header"><span>ACTIVE QUESTS</span><button type="button" aria-label="Open quest journal">J</button></div><div class="w3q-list"></div>';panel.querySelector('button').addEventListener('click',()=>window.showQuestLog?.());this.engine.overlay.appendChild(panel);this.panel=panel;this.list=panel.querySelector('.w3q-list');}
  refresh(){
    this.signature=questSignature();this.list.replaceChildren();const quests=activeQuests().slice(0,5);if(!quests.length){const empty=document.createElement('div');empty.className='w3q-empty';empty.textContent='No active objectives';this.list.appendChild(empty);}for(const quest of quests){const item=document.createElement('article'),objective=currentObjective(quest),done=Object.keys(objectiveState(quest.id)).length,total=objectives(quest.id).length;item.className=`w3q-item ${quest.type==='origin'||String(quest.id).startsWith('pq_')?'personal':''}`;const title=document.createElement('strong');title.textContent=quest.title||'Untitled Quest';const text=document.createElement('span');text.textContent=objective?.label||quest.desc||'Continue the Chronicle.';const count=document.createElement('small');count.textContent=total?`${done}/${total}`:'ACTIVE';item.append(title,text,count);this.list.appendChild(item);}this.rebuildMarkers(quests);
    const completedNow=new Set((window.gameState?.completedQuests||[]).map(quest=>quest.id));for(const id of completedNow)if(!this.completed.has(id)){const quest=(window.gameState.completedQuests||[]).find(entry=>entry.id===id);this.showCompletion(quest);}this.completed=completedNow;
  }
  targetFor(objective,quest){
    if(quest?.type==='origin'&&(quest.stage===1||quest.stage===3)){
      const record=this.engine.npcManager?.records.find(entry=>entry.config.id===quest.npcId);
      if(record)return{position:record.actor.position,interaction:record.interaction,actor:record.actor};
    }
    if(quest?.type==='origin'&&quest.stage===2){
      const targetId=window.mapState?.currentLocation===quest.targetLocation?'location_focus':'north_gate';
      const exact=this.engine.zone.interactables.find(entry=>entry.id===targetId);
      if(exact)return{position:exact.position,interaction:exact};
    }
    const events=(objective?.events||[]).join(' ');
    const rule=TARGET_RULES.find(([pattern])=>pattern.test(events));
    const targetId=rule?.[1]||'location_focus';
    if(targetId.startsWith('npc:')){
      const id=targetId.slice(4);
      const record=this.engine.npcManager?.records.find(entry=>entry.config.id===id);
      if(record)return{position:record.actor.position,interaction:record.interaction,actor:record.actor};
    }else{
      const exact=this.engine.zone.interactables.find(entry=>entry.id===targetId);
      if(exact)return{position:exact.position,interaction:exact};
    }
    // Campaign rules name Vaelthar-specific landmarks such as `north_gate`,
    // but generic road/forest/village/fortress zones expose `location_focus`.
    // Keep the objective actionable instead of silently dropping its marker.
    const fallback=this.engine.zone.interactables.find(entry=>entry.id==='location_focus');
    return fallback?{position:fallback.position,interaction:fallback}:null;
  }
  rebuildMarkers(quests){for(const marker of this.markers)marker.element.remove();this.markers=[];for(const quest of quests){const objective=currentObjective(quest),target=this.targetFor(objective,quest);if(!target)continue;const element=document.createElement('button');element.type='button';element.className='world3d-quest-marker';element.setAttribute('aria-label',`${quest.title}: ${objective?.label||'Quest objective'}`);const icon=document.createElement('b');icon.textContent='!';const label=document.createElement('span');label.textContent=quest.title;element.append(icon,label);element.addEventListener('click',()=>this.engine.goToInteraction(target.interaction));this.engine.overlay.appendChild(element);this.markers.push({element,target});}}
  showCompletion(quest){if(!quest)return;const banner=document.createElement('div');banner.className='world3d-quest-complete';const small=document.createElement('span');small.textContent='QUEST COMPLETE';const strong=document.createElement('strong');strong.textContent=quest.title;const reward=document.createElement('em');reward.textContent=quest.xp?`+${quest.xp} XP`:'Reward granted';banner.append(small,strong,reward);this.engine.overlay.appendChild(banner);this.engine.abilityEffects?.aura(this.engine.actor,'holy');this.engine.cinematicDirector?.playMoment('victory',this.engine.actor,null,{duration:1.35});setTimeout(()=>banner.remove(),4200);}
  syncCinematic(){const scene=document.getElementById('scene-panel'),conversation=document.getElementById('conv-panel'),active=!!(scene||conversation),director=this.engine.cinematicDirector;document.body.classList.toggle('world3d-cinematic-active',active);scene?.classList.add('world3d-cinematic');conversation?.classList.add('world3d-cinematic');const npcId=conversation?.dataset.npcId||window.npcConvState?.npc?.id,record=conversation?this.engine.npcManager?.records.find(entry=>entry.config.id===npcId||entry.config.dialogueId===npcId):null;if(record&&director?.record!==record)director?.enter(record);if(!record&&director?.active&&director.mode==='conversation')director.exit();if(active!==this.cinematicActive){this.cinematicActive=active;if(active)this.engine.actor?.stop();}if(this.engine.controls&&!director?.active)this.engine.controls.enabled=!active;if(conversation)this.engine.cinematicFocus=record?.actor||null;else this.engine.cinematicFocus=null;}
  update(){if(questSignature()!==this.signature)this.refresh();this.syncCinematic();for(const marker of this.markers){const world=new THREE.Vector3(marker.target.position.x,marker.target.actor?2.9*marker.target.actor.profile.proportions[1]:1.9,marker.target.position.z),projected=world.project(this.engine.camera),rect=this.engine.canvas.getBoundingClientRect(),visible=projected.z<1&&Math.abs(projected.x)<1.08&&Math.abs(projected.y)<1.08&&!this.engine.combatController?.active;marker.element.style.display=visible?'flex':'none';if(visible){marker.element.style.left=`${rect.left+(projected.x*.5+.5)*rect.width}px`;marker.element.style.top=`${rect.top+(-projected.y*.5+.5)*rect.height}px`;}}}
  dispose(){this.panel?.remove();for(const marker of this.markers)marker.element.remove();this.markers=[];document.body.classList.remove('world3d-cinematic-active');this.engine.cinematicDirector?.exit();this.engine.cinematicFocus=null;if(this.engine.controls)this.engine.controls.enabled=true;}
}
