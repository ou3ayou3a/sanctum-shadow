const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const source=fs.readFileSync(require.resolve('../site/story.js'),'utf8'),start=source.indexOf('  monastery_dungeon_entry: () =>'),end=source.indexOf('  cartographer_missing: () =>',start);
 const root={sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q2'}],completedQuests:[],character:{hp:10,maxHp:100,mp:5,maxMp:100,holyPoints:30,inventory:[]}},document:{body:{classList:{contains:()=>true}}},holy:0,logs:[],addLog(text){root.logs.push(text);}};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantHolyPoints=n=>root.holy+=n;root.generateEnemy=id=>({id});root.startCombat=(enemies,options)=>{root.encounter={enemies,options};};
 const engine=root.__world3d={zone:{id:'monastery_aldric',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:null,hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 const scenes=vm.runInNewContext('({'+source.slice(start,end)+'\n})',root);let current=null;
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
 const f=fixture();f.root.sceneState.flags.entered_monastery_dungeon=true;f.engine.zone.id='monastery_cellar';f.interact('monastery_first_altar');const take=f.scene().options[1];take.onSuccess();take.onSuccess();assert.equal(f.root.gameState.character.inventory.length,1);assert.equal(f.root.encounter.enemies.length,2);assert.equal(f.root.encounter.options.victoryScene,'monastery_deep_chamber');
 take.onFail();assert.equal(f.root.encounter.enemies.length,3);assert.equal(f.root.encounter.options.victoryScene,'monastery_deep_chamber');
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
