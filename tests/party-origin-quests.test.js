'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OriginQuests=require('../site/party-origin-quests.js');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');
const hero=(name,origin,classId='warrior',race='human')=>({name,origin,class:classId,race,stats:{str:14,dex:12,con:13,int:11,wis:12,cha:10}});

test('every origin has exactly three authored shared quests and a distinct contact',()=>{
  const lines=Object.values(OriginQuests.ORIGIN_LINES);
  assert.equal(lines.length,8);
  assert.equal(new Set(lines.map(line=>line.npc.id)).size,8);
  for(const line of lines){
    assert.equal(line.quests.length,3,`${line.label} must have three quests`);
    assert.ok(line.targetLocation);
    for(const quest of line.quests){assert.ok(quest.title);assert.ok(quest.desc);assert.ok(quest.xp>0);}
  }
});

test('a four-person party receives twelve unique quests regardless of race or class composition',()=>{
  const manifest=OriginQuests.buildManifest([
    {playerName:'A',character:hero('Aldren','fallen_noble','paladin')},
    {playerName:'B',character:hero('Bessa','orphan_war','paladin')},
    {playerName:'C',character:hero('Corin','exile','warrior')},
    {playerName:'D',character:hero('Dara','blood_debt','warrior')},
  ]);
  const quests=manifest.owners.flatMap(owner=>owner.quests);
  assert.equal(manifest.owners.length,4);
  assert.equal(quests.length,12);
  assert.equal(new Set(quests.map(quest=>quest.id)).size,12);
  assert.ok(quests.every(quest=>quest.shared&&quest.type==='origin'));
  for(const memory of['Saint Orra','Red Ford','Blackmere','Last Border War'])assert.match(manifest.history,new RegExp(memory));
});

test('duplicate origins still remain separate character-owned party questlines',()=>{
  const manifest=OriginQuests.buildManifest([
    {playerName:'One',character:hero('Rowan','orphan_war')},
    {playerName:'Two',character:hero('Rowan','orphan_war')},
  ]);
  assert.notEqual(manifest.owners[0].ownerKey,manifest.owners[1].ownerKey);
  assert.equal(new Set(manifest.owners.flatMap(owner=>owner.quests.map(quest=>quest.id))).size,6);
});

test('an origin arc advances reunion, world investigation, and reckoning for the shared party',()=>{
  const roster=[{id:'host',name:'Host',connected:true,character:hero('Aldren','fallen_noble','paladin')}];
  global.gameState={character:roster[0].character,activeQuests:[{id:'c1q1'}],completedQuests:[],questProgress:{}};
  global.mp={sessionCode:'TEST',isHost:true,playerId:'host',session:{players:{host:roster[0]}}};
  global.sceneState={knownFacts:{},flags:{}};
  global.SCENES={};
  global.document={getElementById(){return null;}};
  let sceneId='';
  global.runScene=id=>{sceneId=id;};
  global.addLog=()=>{};global.renderQuestList=()=>{};global.mpBroadcastCampaignState=()=>{};
  global.setFlag=(key,value)=>{global.sceneState.flags[key]=value;};global.changeRep=()=>{};
  global.completeQuest=id=>{const quest=global.gameState.activeQuests.find(entry=>entry.id===id);global.gameState.activeQuests=global.gameState.activeQuests.filter(entry=>entry.id!==id);global.gameState.completedQuests.push(quest);return true;};
  global.activateQuest=id=>{global.gameState.activeQuests.push({...OriginQuests.getQuest(id),status:'active'});return true;};

  assert.equal(OriginQuests.initialize(),true);
  const first=global.gameState.activeQuests.find(quest=>quest.type==='origin');
  assert.equal(first.stage,1);
  OriginQuests.registerScenes();
  assert.equal(OriginQuests.beginNpcQuest(first.npcId),true);
  assert.match(sceneId,/reunion$/);
  global.SCENES[sceneId]().options[0].action();
  const second=global.gameState.activeQuests.find(quest=>quest.type==='origin');
  assert.equal(second.stage,2);
  OriginQuests.onLocationEntered(second.targetLocation);
  assert.match(sceneId,/trail$/);
  global.SCENES[sceneId]().options[0].onSuccess();
  const third=global.gameState.activeQuests.find(quest=>quest.type==='origin');
  assert.equal(third.stage,3);
  OriginQuests.beginNpcQuest(third.npcId);
  assert.match(sceneId,/reckoning$/);
  global.SCENES[sceneId]().options[1].action();
  assert.equal(global.gameState.activeQuests.some(quest=>quest.type==='origin'),false);
  assert.equal(global.gameState.completedQuests.filter(quest=>quest.type==='origin').length,3);
});

test('origin quest runtime is wired into creation, travel, dialogue, saves, multiplayer, and 3D NPCs',()=>{
  const index=read('site/index.html'),game=read('site/game.js'),story=read('site/story.js');
  assert.match(index,/party-origin-quests\.js/);
  assert.match(game,/YOUR THREE ORIGIN QUESTS/);
  assert.match(game,/PartyOriginQuests\?\.getQuest/);
  assert.match(story,/PartyOriginQuests\.initialize/);
  assert.match(story,/character: option\.roll\.character \|\| char/);
  assert.match(read('site/dialogue.js'),/beginNpcQuest/);
  assert.match(read('site/travel.js'),/PartyOriginQuests\?\.onLocationEntered/);
  assert.match(read('site/saves.js'),/partyOrigins/);
  assert.match(read('site/multiplayer.js'),/partyOrigins/);
  assert.match(read('site/multiplayer.js'),/origin_quest_request/);
  const npcs=read('site/world3d/vaelthar-npcs.mjs');
  for(const line of Object.values(OriginQuests.ORIGIN_LINES))assert.match(npcs,new RegExp(line.npc.id));
});
