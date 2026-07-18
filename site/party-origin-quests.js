// Sanctum & Shadow - shared three-part origin questlines.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PartyOriginQuests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ORIGIN_LINES = Object.freeze({
    fallen_noble:Object.freeze({
      label:'Fallen Noble', npc:Object.freeze({id:'origin_steward_elira',name:'Elira Voss',title:'Former Household Steward',portrait:'🗝',faction:'citizens'}),
      targetLocation:'church_archive', targetLabel:'the Church Archive deed room',
      quests:Object.freeze([
        Object.freeze({title:'Ashes of the House',desc:'Meet Elira Voss, the steward who carried your family seal out of the fire.',xp:180}),
        Object.freeze({title:'The Stolen Estate',desc:'Recover the altered deed that transferred your ruined estate before the flames were cold.',xp:260}),
        Object.freeze({title:'A Name Reclaimed',desc:'Decide what your family name will mean now that the truth is known.',xp:360}),
      ]),
      evidence:'a deed overwritten in three inks, transferring the estate before the night of the fire',
      enemy:'House Voss Claim-Keeper', enemyIcon:'🗡', history:'paid for the company’s first winter coats before the family fortune vanished',
    }),
    orphan_war:Object.freeze({
      label:'War Orphan', npc:Object.freeze({id:'origin_sergeant_dain',name:'Mara Dain',title:'Last Survivor of Greybank',portrait:'🪖',faction:'city_watch'}),
      targetLocation:'fortress_harren', targetLabel:'the sealed muster room at Harren’s fortress',
      quests:Object.freeze([
        Object.freeze({title:'The Commander’s Name',desc:'Meet Mara Dain, who survived the raid that destroyed your village.',xp:180}),
        Object.freeze({title:'Orders in Black Wax',desc:'Find the original muster order and identify who commanded the Greybank raid.',xp:260}),
        Object.freeze({title:'What the Survivors Owe',desc:'Choose justice, mercy, or vengeance for the officer who made you an orphan.',xp:360}),
      ]),
      evidence:'a black-wax field order bearing the commander’s true name and the patron who paid him',
      enemy:'Greybank Veteran', enemyIcon:'⚔', history:'could recognize an ambush by the silence before it and kept the others alive at Red Ford',
    }),
    cursed_bloodline:Object.freeze({
      label:'Cursed Bloodline', npc:Object.freeze({id:'origin_bloodkeeper_ysra',name:'Ysra Vey',title:'Keeper of the Red Genealogy',portrait:'🩸',faction:'underworld'}),
      targetLocation:'monastery_cellar', targetLabel:'the sealed crypt beneath Saint Aldric',
      quests:Object.freeze([
        Object.freeze({title:'The Grandmother’s Bargain',desc:'Meet Ysra Vey, who recorded the bargain hidden in your family blood.',xp:180}),
        Object.freeze({title:'The Name in the Blood',desc:'Open the crypt ledger and learn what has been speaking through your bloodline.',xp:260}),
        Object.freeze({title:'Inheritance or Chain',desc:'Bind, break, or willingly inherit the old family bargain.',xp:360}),
      ]),
      evidence:'a genealogy written in dried blood, with your name entered decades before your birth',
      enemy:'Bloodline Collector', enemyIcon:'🩸', history:'heard danger in dreams before it reached camp and woke the company before Blackmere fell',
    }),
    divine_chosen:Object.freeze({
      label:'Divinely Chosen', npc:Object.freeze({id:'origin_pilgrim_oren',name:'Brother Oren',title:'Blind Pilgrim of the Old Road',portrait:'☩',faction:'church',gender:'male'}),
      targetLocation:'temple_quarter', targetLabel:'the buried chapel in the Temple Quarter',
      quests:Object.freeze([
        Object.freeze({title:'The Dream That Repeats',desc:'Meet Brother Oren, who has dreamed the same impossible road as you.',xp:180}),
        Object.freeze({title:'The Unnamed Chapel',desc:'Follow the shared vision to a chapel erased from every Church map.',xp:260}),
        Object.freeze({title:'Chosen For What',desc:'Accept, reinterpret, or refuse the calling that has followed you since childhood.',xp:360}),
      ]),
      evidence:'a stone relief showing your recurring dream, carved four centuries before you were born',
      enemy:'Censor of the Flame', enemyIcon:'🔥', history:'kept hope alive during the siege when food, orders, and ordinary courage had run out',
    }),
    exile:Object.freeze({
      label:'The Exiled', npc:Object.freeze({id:'origin_recorder_cael',name:'Cael Orr',title:'Disgraced Court Recorder',portrait:'📜',faction:'citizens',gender:'male'}),
      targetLocation:'archive_scriptorium', targetLabel:'the restricted court record in the Archive Scriptorium',
      quests:Object.freeze([
        Object.freeze({title:'The False Witness',desc:'Meet Cael Orr, the recorder who preserved the testimony used to exile you.',xp:180}),
        Object.freeze({title:'Two Versions of the Truth',desc:'Recover the original testimony and its politically edited replacement.',xp:260}),
        Object.freeze({title:'Pardoned or Avenged',desc:'Choose whether the truth restores your place, destroys your accusers, or frees you from both.',xp:360}),
      ]),
      evidence:'two versions of the same testimony, one honest and one carrying the seal that condemned you',
      enemy:'Court Seal-Bearer', enemyIcon:'⚖', history:'knew every road that did not ask questions and led the company home after the armistice',
    }),
    monster_hunter:Object.freeze({
      label:'Monster Hunter', npc:Object.freeze({id:'origin_hunter_veyra',name:'Veyra Holt',title:'Quartermaster of the Broken Hunt',portrait:'🏹',faction:'underworld'}),
      targetLocation:'thornwood_passage', targetLabel:'the old killing ground in Thornwood Passage',
      quests:Object.freeze([
        Object.freeze({title:'The Contract That Started It',desc:'Meet Veyra Holt, keeper of the contract from your first disastrous hunt.',xp:180}),
        Object.freeze({title:'The Beast That Learned',desc:'Return to the killing ground and discover why the creature deliberately spared you.',xp:260}),
        Object.freeze({title:'Hunter or Witness',desc:'Kill the truth, expose the client, or end the contract that created the monster.',xp:360}),
      ]),
      evidence:'the original contract, naming the supposed monster as a transformed witness rather than a beast',
      enemy:'The Contract Beast', enemyIcon:'🐺', history:'taught the others which tracks to fear and which frightening things were only hungry animals',
    }),
    corrupted_saint:Object.freeze({
      label:'Corrupted Saint', npc:Object.freeze({id:'origin_confessor_ilyan',name:'Father Ilyan',title:'Your Former Confessor',portrait:'🕯',faction:'church',gender:'male'}),
      targetLocation:'monastery_aldric', targetLabel:'the abandoned confessional at Saint Aldric',
      quests:Object.freeze([
        Object.freeze({title:'The Night of the Fall',desc:'Meet Father Ilyan, the only living witness to the bargain that stained your vows.',xp:180}),
        Object.freeze({title:'The Demon’s Invoice',desc:'Find the hidden confession and learn what the darkness believes you still owe.',xp:260}),
        Object.freeze({title:'Saint or Sinner',desc:'Confess, defy the collector, or complete the bargain on your own terms.',xp:360}),
      ]),
      evidence:'your sealed confession beside an infernal invoice listing one final unpaid act',
      enemy:'Infernal Collector', enemyIcon:'⛧', history:'treated the wounded when holy magic failed and never asked whether the dying deserved mercy',
    }),
    blood_debt:Object.freeze({
      label:'Blood Debt', npc:Object.freeze({id:'origin_senna_vale',name:'Senna Vale',title:'Bearer of the Unpaid Debt',portrait:'🫱',faction:'citizens'}),
      targetLocation:'merchant_road', targetLabel:'the cairn beside the Merchant Road',
      quests:Object.freeze([
        Object.freeze({title:'Where the Debt Went',desc:'Meet Senna Vale, who knows what became of the person who saved your life.',xp:180}),
        Object.freeze({title:'The Price They Paid',desc:'Open the roadside cairn and learn the complete cost of your survival.',xp:260}),
        Object.freeze({title:'Earned or Forgiven',desc:'Repay the sacrifice, accept forgiveness, or turn the debt into another weapon.',xp:360}),
      ]),
      evidence:'a final letter proving the sacrifice was freely chosen and never meant to become your prison',
      enemy:'Debt Collector', enemyIcon:'🪙', history:'carried the wounded out of Blackmere because leaving anyone behind felt like taking another loan',
    }),
  });

  const state = { manifest:null, context:null, pending:null, scenesRegistered:false };
  const slug = value => String(value || 'hero').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,28) || 'hero';
  function stableHash(value) { let h=2166136261; for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return (h>>>0).toString(36); }

  function ownerKey(character, playerName, index=0) {
    return `${slug(playerName || character?.name)}_${stableHash(`${playerName}|${character?.name}|${character?.origin}|${index}`)}`;
  }

  function questsForCharacter(character, options={}) {
    const line=ORIGIN_LINES[character?.origin];
    if(!line)return [];
    const key=options.ownerKey || ownerKey(character,options.playerName || character.name,options.index || 0);
    return line.quests.map((quest,index)=>({
      ...quest,id:`oq_${key}_${character.origin}_${index+1}`,type:'origin',chapter:1,order:index+1,
      stage:index+1,origin:character.origin,ownerKey:key,ownerName:character.name || options.playerName || 'Unknown Hero',
      npcId:line.npc.id,npcName:line.npc.name,targetLocation:line.targetLocation,targetLabel:line.targetLabel,
      shared:true,status:index===0?'active':'locked',
    }));
  }

  function buildPartyHistory(roster) {
    const members=(roster || []).filter(entry=>entry?.character).map(entry=>({
      playerName:entry.playerName || entry.name || entry.character.name,
      character:entry.character,
    })).sort((a,b)=>`${a.playerName}|${a.character.name}`.localeCompare(`${b.playerName}|${b.character.name}`));
    if(!members.length)return '';
    const names=members.map(entry=>entry.character.name || entry.playerName);
    const list=names.length===1?names[0]:names.length===2?`${names[0]} and ${names[1]}`:`${names.slice(0,-1).join(', ')}, and ${names.at(-1)}`;
    const memories=members.map(entry=>{
      const line=ORIGIN_LINES[entry.character.origin];
      return line?`${entry.character.name} ${line.history}`:`${entry.character.name} stood with the company when it mattered`;
    });
    return `${list} first knew one another as children around Saint Orra’s hospice, where noble wards, war refugees, exiles’ children, and foundlings shared one muddy yard. Years later they found one another again in the same free company. They survived Red Ford, the siege of Blackmere, and the Last Border War together. ${memories.join('; ')}. They did not arrive in Vaelthar as strangers. They arrived as the people who already know which promises each of them breaks when afraid.`;
  }

  function buildManifest(roster) {
    const members=(roster || []).filter(entry=>entry?.character && ORIGIN_LINES[entry.character.origin])
      .map(entry=>({playerName:entry.playerName || entry.name || entry.character.name,character:entry.character}))
      .sort((a,b)=>`${a.playerName}|${a.character.name}|${a.character.origin}`.localeCompare(`${b.playerName}|${b.character.name}|${b.character.origin}`));
    const owners=members.map((entry,index)=>{
      const key=ownerKey(entry.character,entry.playerName,index);
      return {ownerKey:key,playerName:entry.playerName,characterName:entry.character.name,origin:entry.character.origin,
        race:entry.character.race,classId:entry.character.class,quests:questsForCharacter(entry.character,{ownerKey:key,playerName:entry.playerName,index})};
    });
    return {version:1,history:buildPartyHistory(members),owners};
  }

  function rosterFromGame() {
    const players=Object.values(globalThis.mp?.session?.players || {}).filter(player=>player?.connected!==false && player?.character);
    if(players.length)return players.map(player=>({playerName:player.name,character:player.character}));
    return globalThis.gameState?.character?[{playerName:globalThis.gameState.character.name,character:globalThis.gameState.character}]:[];
  }
  function allQuests(){return state.manifest?.owners?.flatMap(owner=>owner.quests || []) || [];}
  function getQuest(id){return allQuests().find(quest=>quest.id===id) || null;}
  function activeQuestForNpc(npcId){return (globalThis.gameState?.activeQuests || []).find(quest=>quest.type==='origin' && quest.npcId===npcId) || null;}
  function activeStageAtLocation(locationId){return (globalThis.gameState?.activeQuests || []).find(quest=>quest.type==='origin' && quest.stage===2 && quest.targetLocation===locationId) || null;}
  function ownerForQuest(quest){return state.manifest?.owners?.find(owner=>owner.ownerKey===quest?.ownerKey) || null;}
  function lineForQuest(quest){return ORIGIN_LINES[quest?.origin] || null;}

  function syncLocalCharacter() {
    const character=globalThis.gameState?.character;if(!character||!state.manifest)return;
    const localPlayerName=globalThis.mp?.session?.players?.[globalThis.mp?.playerId]?.name;
    const owner=state.manifest.owners.find(candidate=>localPlayerName && candidate.playerName===localPlayerName)
      || state.manifest.owners.find(candidate=>candidate.characterName===character.name && candidate.origin===character.origin);
    if(!owner)return;
    const active=new Set((globalThis.gameState.activeQuests || []).map(quest=>quest.id));
    const completed=new Set((globalThis.gameState.completedQuests || []).map(quest=>quest.id));
    character.personalQuests=owner.quests.map(quest=>({...quest,status:completed.has(quest.id)?'completed':active.has(quest.id)?'active':'locked'}));
  }

  function hydrate(manifest) {
    if(!manifest || !Array.isArray(manifest.owners))return false;
    state.manifest=JSON.parse(JSON.stringify(manifest));
    if(globalThis.sceneState?.knownFacts)globalThis.sceneState.knownFacts.party_shared_history=state.manifest.history;
    syncLocalCharacter();return true;
  }
  function serialize(){return state.manifest?JSON.parse(JSON.stringify(state.manifest)):null;}

  function initialize() {
    if(globalThis.mp?.sessionCode && !globalThis.mp?.isHost)return false;
    if(state.manifest?.owners?.length){syncLocalCharacter();return true;}
    const manifest=buildManifest(rosterFromGame());if(!manifest.owners.length)return false;
    hydrate(manifest);
    const existing=new Set([...(globalThis.gameState?.activeQuests || []),...(globalThis.gameState?.completedQuests || [])].map(quest=>quest.id));
    globalThis.gameState.activeQuests=(globalThis.gameState.activeQuests || []).filter(quest=>!String(quest?.id||'').startsWith('pq_'));
    for(const owner of manifest.owners){const first=owner.quests[0];if(!existing.has(first.id))globalThis.gameState.activeQuests.push({...first,status:'active'});}
    globalThis.addLog?.('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━','system');
    globalThis.addLog?.('⚔ PARTY HISTORY — You did not meet in Vaelthar. You came here together.','system');
    globalThis.addLog?.(manifest.history,'narrator');
    globalThis.addLog?.(`🔖 ${manifest.owners.length} origin ${manifest.owners.length===1?'story':'stories'} joined the Shared Chronicle. Speak with the marked contacts in Vaelthar.`,'system');
    syncLocalCharacter();globalThis.renderQuestList?.();globalThis.mpBroadcastCampaignState?.('party_origin_manifest');return true;
  }

  function completeStage(outcome) {
    const quest=getQuest(state.context?.questId);if(!quest)return false;
    globalThis.setFlag?.(`origin_${quest.ownerKey}_${quest.stage}_${slug(outcome)}`,true);
    globalThis.completeQuest?.(quest.id,{activateNext:false});
    const owner=ownerForQuest(quest);const next=owner?.quests?.[quest.stage];
    if(next)globalThis.activateQuest?.(next.id,true);
    else globalThis.addLog?.(`🔖 ${quest.ownerName}’s ${lineForQuest(quest)?.label || 'origin'} story is complete. The whole party carries what happened next.`,'holy');
    syncLocalCharacter();globalThis.mpBroadcastCampaignState?.(`origin:${quest.id}:${outcome}`);return true;
  }

  function setContext(quest){state.context={questId:quest.id,ownerKey:quest.ownerKey,origin:quest.origin};}
  function runQuestScene(quest,suffix){setContext(quest);globalThis.runScene?.(`origin_shared_${quest.origin}_${suffix}`);}

  function beginNpcQuest(npcId, options={}) {
    if(!state.manifest)return false;
    const quest=activeQuestForNpc(npcId);if(!quest)return false;
    if(globalThis.mp?.sessionCode && !globalThis.mp?.isHost && !options.remote){
      globalThis.mpBroadcastStoryEvent?.('origin_quest_request',{npcId});
      globalThis.__world3d?.toast?.('The party gathers around this contact.',2600);return true;
    }
    if(quest.stage===2){
      globalThis.addLog?.(`🔖 ${quest.npcName}: “The next answer is waiting at ${quest.targetLabel}. I cannot bring it here.”`,'narrator');
      globalThis.__world3d?.toast?.(`Origin quest: travel to ${quest.targetLabel}`,4200);return true;
    }
    runQuestScene(quest,quest.stage===1?'reunion':'reckoning');return true;
  }

  function onLocationEntered(locationId) {
    if(globalThis.mp?.sessionCode && !globalThis.mp?.isHost)return false;
    const quest=activeStageAtLocation(locationId);if(!quest)return false;
    state.pending={questId:quest.id,locationId};return resumePending();
  }
  function resumePending(){
    const pending=state.pending;if(!pending)return false;
    const blocked=globalThis._travelEncounterScheduled || globalThis.combatState?.active || globalThis.npcConvState?.active
      || globalThis.document?.getElementById?.('ambush-panel') || globalThis.document?.getElementById?.('travel-encounter-panel')
      || globalThis.document?.getElementById?.('scene-panel');
    if(blocked)return false;
    const quest=getQuest(pending.questId);state.pending=null;if(!quest)return false;
    runQuestScene(quest,'trail');return true;
  }

  function bestPartyCharacter(ability) {
    const key=String(ability||'wis').toLowerCase();
    return rosterFromGame().map(entry=>entry.character).sort((a,b)=>(Number(b.stats?.[key])||10)-(Number(a.stats?.[key])||10))[0] || globalThis.gameState?.character;
  }
  function check(skill,ability,dc){return {skill,stat:ability.toUpperCase(),dc,character:bestPartyCharacter(ability)};}
  function startLineCombat(line){
    const quest=getQuest(state.context?.questId);if(!quest)return;
    globalThis.startCombat?.([{id:`origin_enemy_${quest.ownerKey}_${quest.origin}`,name:line.enemy,icon:line.enemyIcon,hp:52,ac:14,atk:6,xp:180,level:4}],
      {id:`origin_${quest.origin}`,victoryScene:`origin_shared_${quest.origin}_trail_resolved`});
  }

  function registerScenes() {
    const scenes=globalThis.SCENES;if(!scenes||state.scenesRegistered)return false;
    for(const [origin,line] of Object.entries(ORIGIN_LINES)){
      scenes[`origin_shared_${origin}_reunion`]=()=>{
        const quest=getQuest(state.context?.questId),owner=ownerForQuest(quest);if(!quest||!owner)return null;
        return{location:`Vaelthar — ${line.npc.name}`,locationIcon:line.npc.portrait,
          narration:`${line.npc.name} recognizes ${quest.ownerName} before the party finishes approaching. “I wondered which of you would come back first,” ${line.npc.name} says. Then the contact looks over the companions who survived Red Ford and Blackmere beside ${quest.ownerName}. “Good. This belongs to all of you now.”\n\n${line.npc.name} reveals the first lead in ${quest.ownerName}’s ${line.label.toLowerCase()} past. The trail points to ${line.targetLabel}.`,
          sub:`This quest belongs to ${quest.ownerName}, but the choice and its consequences belong to the whole party.`,
          options:[
            {icon:'🤝',label:`Stand beside ${quest.ownerName} and hear the complete account`,type:'talk',action:()=>completeStage('party_stands_together')},
            {icon:'👁',label:`Read ${line.npc.name} before trusting the lead`,type:'explore',roll:check('insight','wis',12),onSuccess:()=>{globalThis.changeRep?.('party',2,'stood watch over a companion’s past');completeStage('contact_read');},onFail:()=>completeStage('contact_guarded')},
            {icon:'⚖',label:'Demand proof before the party risks itself',type:'talk',roll:check('persuasion','cha',13),onSuccess:()=>completeStage('proof_given'),onFail:()=>completeStage('uneasy_alliance')},
          ]};
      };
      scenes[`origin_shared_${origin}_trail`]=()=>{
        const quest=getQuest(state.context?.questId);if(!quest)return null;
        return{location:line.targetLabel,locationIcon:'🔖',threat:'⚠ ORIGIN RECKONING',
          narration:`The entire party reaches ${line.targetLabel} because this is no longer only ${quest.ownerName}’s secret. Together they find ${line.evidence}. Someone is already waiting to make certain it never leaves this place: ${line.enemy}.`,
          sub:`The evidence can resolve the second quest. Failure turns the discovery into a shared battle.`,
          options:[
            {icon:'🔍',label:'Reconstruct the evidence before the guardian can destroy it',type:'explore',roll:check('investigation','int',14),onSuccess:()=>completeStage('evidence_recovered'),onFail:()=>startLineCombat(line)},
            {icon:'⚔',label:`Protect ${quest.ownerName} and take the evidence by force`,type:'combat',action:()=>startLineCombat(line)},
            {icon:'🗣',label:'Make the guardian admit who ordered the destruction',type:'talk',roll:check('intimidation','cha',15),onSuccess:()=>{globalThis.changeRep?.('party',2,'faced an old enemy together');completeStage('confession_won');},onFail:()=>startLineCombat(line)},
          ]};
      };
      scenes[`origin_shared_${origin}_trail_resolved`]=()=>{
        const quest=getQuest(state.context?.questId);if(!quest)return null;
        return{location:line.targetLabel,locationIcon:'📜',
          narration:`When the fighting stops, ${quest.ownerName} does not have to search alone. One companion holds the light, another watches the door, and another reads the line that hurts too much to read twice. The party leaves with ${line.evidence}.`,
          sub:`The truth is secured. Return to ${line.npc.name} in Vaelthar for the final decision.`,
          options:[{icon:'🤝',label:'Carry the truth home together',type:'move',action:()=>completeStage('evidence_defended')}],};
      };
      scenes[`origin_shared_${origin}_reckoning`]=()=>{
        const quest=getQuest(state.context?.questId);if(!quest)return null;
        return{location:`Vaelthar — ${line.npc.name}`,locationIcon:line.npc.portrait,
          narration:`${line.npc.name} reads the recovered evidence in silence. The last decision is given to ${quest.ownerName}, but nobody pretends it affects only one life. The companions who grew up and fought beside ${quest.ownerName} remain in the room. Whatever is chosen, they will be witnesses—and they will carry the consequences together.`,
          sub:`Final quest of ${quest.ownerName}’s ${line.label} origin arc. The party votes.`,
          options:[
            {icon:'⚖',label:'Expose the complete truth and demand lawful judgment',type:'talk',action:()=>{globalThis.changeRep?.('citizens',5,`stood for ${quest.ownerName}’s truth`);completeStage('justice') }},
            {icon:'🕊',label:'End the old chain without creating another victim',type:'talk',action:()=>{globalThis.changeRep?.('party',5,'chose mercy together');completeStage('mercy') }},
            {icon:'🩸',label:'Use the truth as a weapon against everyone responsible',type:'combat',action:()=>{globalThis.changeRep?.('underworld',4,'settled an old debt decisively');completeStage('vengeance') }},
          ]};
      };
    }
    state.scenesRegistered=true;return true;
  }

  const npcRegistry=Object.freeze(Object.fromEntries(Object.values(ORIGIN_LINES).map(line=>[line.npc.id,Object.freeze({
    ...line.npc,gender:line.npc.gender || 'female',disposition:'neutral',originQuestNpc:true,
    personality:`You are ${line.npc.name}, ${line.npc.title}. You are the recurring contact for the ${line.label} origin story. You know the party fought together at Red Ford and Blackmere. Treat the owner’s past as a shared party responsibility, never as a private cutaway. Speak plainly, preserve established facts, and direct the party toward ${line.targetLabel}.`,
  })])));

  function installResumeHook(){
    const original=globalThis.resumePendingArrivalScene;if(typeof original!=='function')return false;
    if(original.__originWrapped)return true;
    const wrapped=function(){const result=original.apply(this,arguments);setTimeout(resumePending,25);return result;};
    wrapped.__originWrapped=true;globalThis.resumePendingArrivalScene=wrapped;return true;
  }
  if(typeof window!=='undefined')window.addEventListener('DOMContentLoaded',()=>{registerScenes();if(!installResumeHook())setTimeout(installResumeHook,500);});

  return Object.freeze({ORIGIN_LINES,npcRegistry,ownerKey,questsForCharacter,buildPartyHistory,buildManifest,getQuest,
    initialize,hydrate,serialize,syncLocalCharacter,beginNpcQuest,onLocationEntered,resumePending,registerScenes,
    isQuestNpc:id=>Object.values(ORIGIN_LINES).some(line=>line.npc.id===id)});
});
