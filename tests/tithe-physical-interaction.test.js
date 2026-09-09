const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const root={SCENES:{},sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q12'}],character:{inventory:[]}},document:{body:{classList:{contains:()=>true}}},addLog(){},grantHolyPoints(){},xp:0};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantXP=n=>root.xp+=n;
 const engine=root.__world3d={zone:{id:'mol_village',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},hasPhysicalInteraction:id=>engine.context===id,physicalReach:()=>true,toast(){}};
 let current=null;root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;current=root.SCENES[id]();return true;};
 vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-tithe.js'),'utf8'),root);
 return{root,engine,scene:()=>current,interact(id){engine.context=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,`${id} has an available scene`);return root.runScene(scene);}};
}
test('the authored tithe route requires chest, Berrick, ledger and stone before their factories grant clues',()=>{
 const f=fixture();assert.equal(f.root.runScene('mol_tithe_hook'),false);assert.equal(f.root.sceneState.flags.tithe_quest_started,undefined);
 f.interact('mol_tithe_chest');f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.clue_sel,undefined);
 f.interact('npc:elder_berrick');assert.equal(f.root.sceneState.flags.clue_sel,true);
 f.scene().options[1].action();assert.equal(f.scene(),null);
 f.interact('mol_parish_ledger');f.scene().options[0].onSuccess();assert.equal(f.root.sceneState.flags.clue_tithe_pays_sayers,true);assert.equal(f.root.xp,120);
 f.scene().options[2].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.found_second_stone,undefined);
 f.interact('mol_second_stone');assert.equal(f.root.sceneState.flags.found_second_stone,true);assert.equal(f.root.xp,300);
 f.scene().options[1].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.knows_sayer_two_dead,undefined);
 f.interact('npc:elder_berrick');assert.equal(f.root.sceneState.flags.knows_sayer_two_dead,true);
});
test('collector-to-ledger follow-up waits for the ledger and revisiting cannot duplicate its evidence',()=>{
 const f=fixture();f.root.sceneState.flags.tithe_quest_started=true;f.interact('npc:mol_tithe_collector');
 f.scene().options[0].onFail();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.clue_tithe_pays_sayers,undefined);
 f.interact('mol_parish_ledger');assert.equal(f.root.gameState.character.inventory.length,1);
 f.root.runScene('mol_tithe_founding_page');assert.equal(f.root.gameState.character.inventory.length,1);assert.equal(f.root.xp,120);
});
