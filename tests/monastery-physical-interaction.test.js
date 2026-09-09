const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const source=fs.readFileSync(require.resolve('../site/story.js'),'utf8'),start=source.indexOf('  monastery_dungeon_entry: () =>'),end=source.indexOf('  cartographer_missing: () =>',start);
 const root={sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q2'}],completedQuests:[],character:{hp:10,maxHp:100,mp:5,maxMp:100,holyPoints:30,inventory:[]}},document:{body:{classList:{contains:()=>true}}},holy:0,logs:[],addLog(text){root.logs.push(text);}};root.window=root;root.PhysicalQuestFlow=Flow;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantHolyPoints=n=>root.holy+=n;root.generateEnemy=id=>({id});root.startCombat=(enemies,options)=>{root.encounter={enemies,options};};
 const engine=root.__world3d={zone:{id:'monastery_aldric',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:null,hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 const scenes=vm.runInNewContext('var MISSING_SCENES=({'+source.slice(start,end)+'\n});MISSING_SCENES',root);let current=null;
 root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;root.sceneState.currentScene=id;current=scenes[id]();return true;};
 return {root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);}};
}
test('entering the dungeon requires its interior target, not the monastery courtyard',()=>{
 const f=fixture();assert.equal(f.root.runScene('monastery_dungeon_entry'),false);assert.equal(f.root.sceneState.flags.entered_monastery_dungeon,undefined);assert.equal(f.interact('monastery_depths_entry'),false);
 f.engine.zone.id='monastery_cellar';f.interact('monastery_depths_entry');assert.equal(f.root.sceneState.flags.entered_monastery_dungeon,true);
 f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.encounter,undefined);f.interact('monastery_first_altar');assert.match(f.scene().narration,/journal/);
});
test('wall-check success and failure both hand off to the physical altar',()=>{
 for(const result of ['onSuccess','onFail']){const f=fixture();f.engine.zone.id='monastery_cellar';f.interact('monastery_depths_entry');f.scene().options[1][result]();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.physicalSceneRequests.monastery_first_altar,'monastery_first_chamber');}
});
test('the altar preserves the skeleton rosters and journal reward cannot duplicate',()=>{
 const f=fixture();f.root.sceneState.flags.entered_monastery_dungeon=true;f.engine.zone.id='monastery_cellar';f.interact('monastery_first_altar');const take=f.scene().options[1];take.onSuccess();take.onSuccess();assert.equal(f.root.gameState.character.inventory.length,1);assert.equal(f.root.encounter.enemies.length,2);assert.equal(f.root.encounter.options.victoryScene,'monastery_altar_cleared');
 take.onFail();assert.equal(f.root.encounter.enemies.length,3);assert.equal(f.root.encounter.options.victoryScene,'monastery_altar_cleared');
});
test('clearing the dungeon cannot speak to the courtyard monk or grant his reward remotely',()=>{
 const f=fixture();f.engine.zone.id='monastery_cellar';f.root.runScene('monastery_dungeon_cleared');assert.equal(f.root.sceneState.flags.monastery_voice_cleared,true);assert.doesNotMatch(f.scene().narration,/he asks|God help/);
 f.scene().options[1].action();assert.equal(f.scene(),null);assert.equal(f.root.holy,0);assert.equal(f.interact('npc:recovering_monastery_monk'),false);
 f.engine.zone.id='monastery_aldric';f.engine.physicalContext=null;assert.equal(f.root.runScene('monastery_recovered_monk'),false);f.interact('npc:recovering_monastery_monk');assert.equal(f.root.holy,5);f.root.runScene('monastery_recovered_monk');assert.equal(f.root.holy,5);
});
test('the monk is unavailable before victory and remains reachable in older completed-quest saves',()=>{
 const f=fixture();assert.equal(Flow.nextScene('npc:recovering_monastery_monk',f.root.sceneState,f.root.gameState),null);assert.equal(Flow.npcStage('recovering_monastery_monk','monastery_aldric',f.root.sceneState,f.root.gameState).active,false);
 f.root.gameState.activeQuests=[];f.root.gameState.completedQuests=[{id:'c1q2'}];f.interact('npc:recovering_monastery_monk');assert.equal(f.root.holy,5);
});
test('withdrawing does not falsely report quest failure or teleport to the capital',()=>{
 const f=fixture();f.engine.zone.id='monastery_cellar';f.interact('monastery_depths_entry');f.scene().options[2].action();assert.equal(f.engine.zone.id,'monastery_cellar');assert.ok(f.root.logs.every(text=>!text.includes('QUEST FAILED')));
});

test('skeleton victory unlocks a physical doorway without starting the Voice remotely or replaying skeletons',()=>{
 const f=fixture();f.engine.zone.id='monastery_cellar';f.root.sceneState.flags.entered_monastery_dungeon=true;
 f.engine.zone.interactables.push({id:'entrance_monastery_depths'});
 const destination={id:'monastery_depths'};f.engine.physicalContext='entrance_monastery_depths';assert.equal(Flow.canTravel(f.root,destination),false);
 f.interact('monastery_first_altar');f.scene().options[0].action();f.root.runScene(f.root.encounter.options.victoryScene);
 assert.equal(f.root.sceneState.flags.monastery_first_chamber_cleared,true);assert.equal(f.root.sceneState.flags.monastery_deep_respite,undefined);
 f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(Flow.canTravel(f.root,destination),false);
 f.engine.physicalContext='entrance_monastery_depths';assert.equal(Flow.canTravel(f.root,destination),true);
 f.engine.physicalReach=()=>false;assert.equal(Flow.canTravel(f.root,destination),false);f.engine.physicalReach=()=>true;
 f.interact('monastery_first_altar');assert.equal(f.scene().options.length,1);assert.doesNotMatch(f.scene().options[0].label,/Fight/);
 f.engine.zone.id='monastery_depths';f.interact('monastery_voice');assert.equal(f.root.sceneState.flags.monastery_deep_respite,true);
 const hp=f.root.gameState.character.hp;f.interact('monastery_voice');assert.equal(f.root.gameState.character.hp,hp);
});

test('the rune check requires leaving the Voice and binding revalidates proximity and cannot spend twice',()=>{
 const f=fixture();f.engine.zone.id='monastery_depths';f.root.sceneState.flags.monastery_first_chamber_cleared=true;
 f.interact('monastery_voice');f.scene().options[2].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.knows_voice_weakness,undefined);
 f.interact('monastery_binding_circle');assert.equal(f.scene().options[0].roll.dc,15);f.scene().options[0].onSuccess();const bind=f.scene().options[0].action;
 f.engine.physicalContext='monastery_voice';bind();assert.equal(f.root.gameState.character.holyPoints,30);
 f.interact('monastery_binding_circle');bind();assert.equal(f.root.gameState.character.holyPoints,15);assert.equal(f.root.sceneState.flags.voice_bound,true);
 bind();assert.equal(f.root.gameState.character.holyPoints,15);assert.equal(Flow.nextScene('monastery_binding_circle',f.root.sceneState,f.root.gameState),null);assert.equal(Flow.nextScene('monastery_voice',f.root.sceneState,f.root.gameState),null);
});

test('willing binding moves to the circle and grants its bonus only once',()=>{
 const f=fixture();f.engine.zone.id='monastery_depths';f.root.sceneState.flags.monastery_first_chamber_cleared=true;
 f.interact('monastery_voice');f.scene().options[1].onSuccess();f.scene().options[1].onSuccess();assert.equal(f.root.sceneState.flags.voice_agreed_binding,true);
 f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.gameState.character.holyPoints,30);
 f.interact('monastery_binding_circle');const bind=f.scene().options[0].action;bind();bind();assert.equal(f.root.gameState.character.holyPoints,15);assert.equal(f.root.holy,10);
});

test('failed deciphering and insufficient Holy Points preserve the Voice combat continuation',()=>{
 for(const mode of ['check','power']){const f=fixture();f.engine.zone.id='monastery_depths';f.root.sceneState.flags.monastery_first_chamber_cleared=true;f.interact('monastery_binding_circle');
 if(mode==='check')f.scene().options[0].onFail();else{f.scene().options[0].onSuccess();f.root.gameState.character.holyPoints=14;f.scene().options[0].action();assert.equal(f.root.gameState.character.holyPoints,14);}
 assert.equal(f.root.encounter.options.victoryScene,'monastery_dungeon_cleared');assert.equal(f.root.encounter.enemies[0].id,'the_voice_below');
 }
});

test('older progressed saves unlock the chamber and the exit still requires an explicit nearby interaction',()=>{
 for(const flag of ['monastery_deep_respite','spoke_with_voice','knows_voice_weakness','voice_agreed_binding'])assert.equal(Flow.monasteryUnlocked({flags:{[flag]:true}},{}),true);
 assert.equal(Flow.monasteryUnlocked({flags:{}},{completedQuests:['c1q2']}),true);assert.equal(Flow.monasteryUnlocked({flags:{}},{}),false);
 const f=fixture();f.engine.zone.id='monastery_depths';f.engine.zone.interactables.push({id:'interior_exit'});assert.equal(Flow.canTravel(f.root,{id:'monastery_cellar'}),false);
 f.engine.physicalContext='interior_exit';assert.equal(Flow.canTravel(f.root,{id:'monastery_cellar'}),true);assert.equal(Flow.canTravel(f.root,{id:'monastery_aldric'}),false);
});
