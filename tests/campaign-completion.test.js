'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Quests=require('../site/quests.js');
const QuestEntries=require('../site/quest-entry-hooks.js');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');
const storyFiles=fs.readdirSync(path.join(project,'site')).filter(file=>/^story(?:-extra-[a-z-]+)?\.js$/.test(file));
const storySource=storyFiles.map(file=>read(`site/${file}`)).join('\n');
function sourceFiles(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(path.join(directory,entry.name)):/\.(?:js|mjs)$/.test(entry.name)?[path.join(directory,entry.name)]:[]);
}
const runtimeSource=sourceFiles(path.join(project,'site')).filter(file=>!file.endsWith(`${path.sep}quests.js`)).map(file=>fs.readFileSync(file,'utf8')).join('\n');

function sceneIsAuthored(sceneId){
  return new RegExp(`(?:^|\\W)${sceneId.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*:`, 'm').test(storySource);
}

test('all twenty core quests have authored milestones and physical post-opening entries',async()=>{
  const {CHAPTER_ONE_ZONE_IDS}=await import('../site/world3d/zones/zone-profiles.mjs');
  const zones=new Set(CHAPTER_ONE_ZONE_IDS);
  for(let order=1;order<=20;order++){
    const questId=`c1q${order}`,objectives=Quests.getObjectives(questId);
    assert.ok(objectives.length>=3,`${questId} lacks a complete objective chain`);
    for(const objective of objectives){
      for(const eventKey of objective.events){
        if(eventKey.startsWith('scene:'))assert.ok(sceneIsAuthored(eventKey.slice(6))||runtimeSource.includes(eventKey),`${questId}:${objective.id} references missing ${eventKey}`);
        else if(eventKey.startsWith('combat:victory:'))assert.ok(runtimeSource.includes(eventKey)||sceneIsAuthored(eventKey.slice('combat:victory:'.length)),`${questId}:${objective.id} has no producer for ${eventKey}`);
        else assert.ok(runtimeSource.includes(eventKey),`${questId}:${objective.id} has no producer for ${eventKey}`);
      }
    }
    if(order===1)continue;
    const entry=QuestEntries.ENTRY[questId];
    assert.ok(entry,`${questId} has no recoverable physical entry`);
    assert.equal(entry.objective,objectives[0].id,`${questId} entry targets the wrong objective`);
    assert.ok(objectives[0].events.includes(`scene:${entry.scene}`),`${questId} entry does not emit its first milestone`);
    assert.ok(zones.has(entry.location),`${questId} entry location ${entry.location} is not playable`);
  }
});

test('one authoritative walkthrough completes all twenty quests in order and claims each reward once',()=>{
  const progress={},completed=[],character={xp:0,questRewardsClaimed:[]};
  let active='c1q1';
  for(let order=1;order<=20;order++){
    const questId=`c1q${order}`;
    assert.equal(active,questId);
    let completionCount=0;
    for(const objective of Quests.getObjectives(questId)){
      const result=Quests.reduceQuestEvent({activeQuestIds:[active],completedQuestIds:completed,progress},objective.events[0]);
      assert.ok(result.updates.some(update=>update.objectiveId===objective.id),`${questId}:${objective.id} did not advance`);
      progress[questId]=progress[questId]||{objectives:{}};
      for(const update of result.updates)progress[questId].objectives[update.objectiveId]={eventKey:update.eventKey};
      completionCount+=result.completions.filter(id=>id===questId).length;
    }
    assert.equal(completionCount,1,`${questId} did not complete exactly once`);
    completed.push(questId);
    assert.equal(Quests.claimReward(character,questId,100),true);
    assert.equal(Quests.claimReward(character,questId,100),false);
    active=order<20?`c1q${order+1}`:null;
  }
  assert.equal(completed.length,20);
  assert.equal(new Set(character.questRewardsClaimed).size,20);
  assert.equal(character.xp,2000);
});

test('Varek resolutions continue to quest two instead of prematurely starting Chapter II',()=>{
  const source=read('site/story.js');
  const ids=['chapter1_end_arrest','chapter1_end_surrender','chapter1_end_rhael_leads'];
  for(let index=0;index<ids.length;index++){
    const start=source.indexOf(`${ids[index]}: () =>`),end=index+1<ids.length?source.indexOf(`${ids[index+1]}: () =>`,start):source.indexOf('monastery_caught_sneaking:',start);
    const block=source.slice(start,end);
    assert.ok(start>=0&&end>start,`${ids[index]} scene is missing`);
    assert.match(block,/runScene\('monastery_dungeon_entry'\)/);
    assert.doesNotMatch(block,/beginChapterTwo\(/);
    assert.doesNotMatch(block,/setFlag\('chapter1_complete'\)/);
  }
});

test('combat resolutions cannot strand the monastery or Harren quest',()=>{
  const source=read('site/story.js');
  const voiceCalls=[...source.matchAll(/startCombat\(\[generateEnemy\('the_voice_below', 4\)\][^\n]*/g)].map(match=>match[0]);
  assert.equal(voiceCalls.length,9);
  assert.ok(voiceCalls.every(call=>call.includes("victoryScene:'monastery_dungeon_cleared'")));
  assert.match(source,/id: 'harren'.*victoryScene:'harren_fallen'/);
  assert.match(source,/harren_fallen: \(\) =>/);
  assert.match(source,/victoryScene:'harren_joins'/);
  assert.ok(Quests.getObjectives('c1q6').find(objective=>objective.id==='resolve_harren').events.includes('scene:harren_fallen'));
});

function freshOrigins(){
  const modulePath=require.resolve('../site/party-origin-quests.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

function hero(name,origin){return{name,origin,class:'warrior',race:'human',xp:0,questRewardsClaimed:[],stats:{str:14,dex:13,con:14,int:12,wis:12,cha:12}};}

function installOriginRuntime(Origins,roster){
  global.gameState={character:roster[0].character,activeQuests:[{id:'c1q1'}],completedQuests:[],questProgress:{}};
  global.mp=roster.length>1?{sessionCode:'ORIGINS',isHost:true,playerId:roster[0].id,session:{players:Object.fromEntries(roster.map(player=>[player.id,player]))}}:{};
  global.sceneState={knownFacts:{},flags:{}};
  global.SCENES={};global.document={getElementById(){return null;}};
  global.addLog=()=>{};global.renderQuestList=()=>{};global.mpBroadcastCampaignState=()=>{};global.changeRep=()=>{};
  global.setFlag=(key,value=true)=>{global.sceneState.flags[key]=value;};
  global.activateQuest=id=>{const quest=Origins.getQuest(id);if(!quest)return false;global.gameState.activeQuests.push({...quest,status:'active'});return true;};
  global.completeQuest=id=>{const quest=global.gameState.activeQuests.find(entry=>entry.id===id);if(!quest)return false;global.gameState.activeQuests=global.gameState.activeQuests.filter(entry=>entry.id!==id);global.gameState.completedQuests.push({...quest,status:'completed'});if(!global.gameState.character.questRewardsClaimed.includes(id)){global.gameState.character.questRewardsClaimed.push(id);global.gameState.character.xp+=quest.xp||0;}return true;};
  let sceneId='',victoryScene='';
  global.runScene=id=>{sceneId=id;};
  global.startCombat=(enemies,options={})=>{assert.ok(enemies.length);victoryScene=options.victoryScene||'';};
  assert.equal(Origins.initialize(),true);assert.equal(Origins.registerScenes(),true);
  return{scene:()=>sceneId,victory:()=>victoryScene};
}

test('all eight origin arcs complete reunion, combat investigation, and reckoning',()=>{
  const originIds=Object.keys(freshOrigins().ORIGIN_LINES);
  for(const [index,origin] of originIds.entries()){
    const Origins=freshOrigins(),character=hero(`Hero ${index+1}`,origin),runtime=installOriginRuntime(Origins,[{id:'host',name:'Host',connected:true,character}]);
    const line=Origins.ORIGIN_LINES[origin];
    assert.equal(Origins.beginNpcQuest(line.npc.id),true);
    global.SCENES[runtime.scene()]().options[0].action();
    const second=global.gameState.activeQuests.find(quest=>quest.type==='origin');
    assert.equal(second.stage,2);
    assert.equal(Origins.onLocationEntered(second.targetLocation),true);
    global.SCENES[runtime.scene()]().options[1].action();
    assert.equal(runtime.victory(),`origin_shared_${origin}_trail_resolved`);
    global.runScene(runtime.victory());
    global.SCENES[runtime.scene()]().options[0].action();
    const third=global.gameState.activeQuests.find(quest=>quest.type==='origin');
    assert.equal(third.stage,3);
    Origins.beginNpcQuest(line.npc.id);
    global.SCENES[runtime.scene()]().options[index%3].action();
    assert.equal(global.gameState.completedQuests.filter(quest=>quest.type==='origin').length,3);
    assert.equal(character.questRewardsClaimed.length,3);
    assert.equal(character.xp,800);
  }
});

test('four characters with the same origin finish all twelve quests without repeated travel',()=>{
  const Origins=freshOrigins(),origin='orphan_war';
  const roster=Array.from({length:4},(_,index)=>({id:`p${index}`,name:`Player ${index}`,connected:true,character:hero(`Hero ${index}`,origin)}));
  const runtime=installOriginRuntime(Origins,roster),line=Origins.ORIGIN_LINES[origin],realSetTimeout=global.setTimeout;
  global.setTimeout=fn=>{fn();return 1;};
  try{
    for(let i=0;i<4;i++){Origins.beginNpcQuest(line.npc.id);global.SCENES[runtime.scene()]().options[0].action();}
    assert.equal(global.gameState.activeQuests.filter(quest=>quest.type==='origin'&&quest.stage===2).length,4);
    Origins.onLocationEntered(line.targetLocation);
    for(let i=0;i<4;i++)global.SCENES[runtime.scene()]().options[0].onSuccess();
    assert.equal(global.gameState.activeQuests.filter(quest=>quest.type==='origin'&&quest.stage===3).length,4);
    for(let i=0;i<4;i++){Origins.beginNpcQuest(line.npc.id);global.SCENES[runtime.scene()]().options[1].action();}
    assert.equal(global.gameState.completedQuests.filter(quest=>quest.type==='origin').length,12);
    assert.equal(global.gameState.activeQuests.some(quest=>quest.type==='origin'),false);
  }finally{global.setTimeout=realSetTimeout;}
});
