const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const source=fs.readFileSync(require.resolve('../site/story.js'),'utf8'),start=source.indexOf('  merchant_road_investigation: () =>'),end=source.indexOf('  mol_village_arrival: () =>',start);
 const root={sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q4'}],completedQuests:[]},document:{body:{classList:{contains:()=>true}}},addLog(){}};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.startCombat=enemies=>{root.enemies=enemies;root.combatSource=root.sceneState.currentScene;};
 const engine=root.__world3d={zone:{id:'merchant_road',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:null,hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 const scenes=vm.runInNewContext('({'+source.slice(start,end)+'\n})',root);let current=null;
 root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;root.sceneState.currentScene=id;current=scenes[id]();return true;};
 return {root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);}};
}
test('the caravan introduction cannot question the survivor or examine the bodies remotely',()=>{
 const f=fixture();assert.equal(f.root.runScene('merchant_road_investigation'),false);assert.equal(f.root.sceneState.flags.merchant_road_quest_started,undefined);
 f.interact('merchant_caravan');assert.ok(f.scene().options.every(o=>!o.roll));assert.doesNotMatch(f.scene().narration,/They came from the ground/);
 f.scene().options[1].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.merchant_road_survivor_heard,undefined);
 f.interact('npc:merchant_road_survivor');assert.match(f.scene().narration,/They came from the ground/);
});
test('body and survivor checks reveal a physical confrontation, not a remote battle',()=>{
 for(const [target,flag]of [['merchant_ritual_bodies','merchant_road_symbol_found'],['npc:merchant_road_survivor','merchant_road_survivor_heard']]){
  const f=fixture();f.root.sceneState.flags.merchant_road_quest_started=true;f.interact(target);f.scene().options[0].onSuccess();
  assert.equal(f.root.sceneState.flags[flag],true);assert.equal(f.root.sceneState.flags.merchant_road_ambush_revealed,true);assert.equal(f.scene(),null);assert.equal(f.root.enemies,undefined);
  assert.equal(Flow.npcStage('merchant_cultist_leader','merchant_road',f.root.sceneState,f.root.gameState).active,true);
  f.interact('npc:merchant_cultist_leader');f.scene().options[0].action();assert.equal(f.root.enemies.length,3);assert.equal(f.root.combatSource,'merchant_road_ambush');
 }
});
test('failed investigations still reach the confrontation without granting successful clues',()=>{
 for(const target of ['merchant_ritual_bodies','npc:merchant_road_survivor']){const f=fixture();f.root.sceneState.flags.merchant_road_quest_started=true;f.interact(target);f.scene().options[0].onFail();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.merchant_road_symbol_found,undefined);assert.equal(f.root.sceneState.flags.merchant_road_survivor_heard,undefined);f.interact('npc:merchant_cultist_leader');assert.ok(f.scene());}
});
test('persuasion keeps the authored success and failure enemy rosters and completion source',()=>{
 for(const success of [true,false]){const f=fixture();f.root.sceneState.flags.merchant_road_ambush_revealed=true;f.root.sceneState.physicalSceneRequests={'npc:merchant_cultist_leader':'merchant_road_ambush'};f.interact('npc:merchant_cultist_leader');f.scene().options[1][success?'onSuccess':'onFail']();assert.equal(f.root.enemies.length,success?2:3);assert.equal(f.root.combatSource,'merchant_road_ambush');assert.equal(!!f.root.sceneState.flags.merchant_road_varek_connected,success);}
});
test('cultists stay concealed before discovery and absent after completion, including stale requests',()=>{
 const f=fixture();assert.equal(Flow.nextScene('npc:merchant_cultist_leader',f.root.sceneState,f.root.gameState),null);
 for(const id of ['merchant_cultist_leader','merchant_cultist_left','merchant_cultist_right'])assert.equal(Flow.npcStage(id,'merchant_road',f.root.sceneState,f.root.gameState).active,false);
 f.root.sceneState.physicalSceneRequests={'npc:merchant_cultist_leader':'merchant_road_ambush'};assert.deepEqual(Flow.restoreRequests(f.root.sceneState.physicalSceneRequests),f.root.sceneState.physicalSceneRequests);
 f.root.gameState.completedQuests=['c1q4'];f.engine.physicalContext='npc:merchant_cultist_leader';assert.equal(f.root.runScene('merchant_road_ambush'),false);assert.equal(f.root.sceneState.physicalSceneRequests['npc:merchant_cultist_leader'],undefined);
 assert.equal(Flow.npcStage('merchant_cultist_leader','merchant_road',f.root.sceneState,f.root.gameState).active,false);
});
test('wrong zones and blocked reach cannot open the survivor conversation',()=>{
 const f=fixture();f.root.sceneState.flags.merchant_road_quest_started=true;f.engine.zone.id='vaelthar_city';assert.equal(f.interact('npc:merchant_road_survivor'),false);f.engine.zone.id='merchant_road';f.engine.physicalReach=()=>false;assert.equal(f.interact('npc:merchant_road_survivor'),false);
});
