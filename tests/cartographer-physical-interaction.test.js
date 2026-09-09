const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const source=fs.readFileSync(require.resolve('../site/story.js'),'utf8'),start=source.indexOf('  cartographer_missing: () =>'),end=source.indexOf('  merchant_road_investigation: () =>',start);
 const root={sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q3'}],character:{inventory:[]}},document:{body:{classList:{contains:()=>true}}},xp:0,holy:0,addLog(){}};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantXP=n=>root.xp+=n;root.grantHolyPoints=n=>root.holy+=n;
 root.startCombat=(enemies,options)=>{root.encounter={enemies,options};};
 const engine=root.__world3d={zone:{id:'thornwood_gate',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:null,hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 const scenes=vm.runInNewContext('({'+source.slice(start,end)+'\n})',root);let current=null;
 root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;current=scenes[id]();if(id==='cartographer_found')root.gameState.activeQuests=[];return true;};
 return {root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);}};
}
test('Mira, forest evidence and Edden cannot be resolved while standing at the gate',()=>{
 const f=fixture();assert.equal(f.root.runScene('cartographer_missing'),false);assert.equal(f.root.sceneState.flags.cartographer_quest_started,undefined);
 f.interact('npc:mira_cartographer');f.scene().options[0].action();assert.equal(f.scene(),null);
 assert.equal(f.interact('thornwood_satchel'),false);assert.equal(f.root.sceneState.flags.cartographer_found,undefined);
 f.engine.zone.id='thornwood_passage';f.interact('thornwood_satchel');f.scene().options[0].onSuccess();assert.equal(f.scene(),null);assert.equal(f.root.holy,0);
 f.interact('npc:edden_cartographer');assert.equal(f.root.sceneState.flags.cartographer_found,true);assert.equal(f.root.holy,10);
});
test('return XP waits for the gate and Mira, including after the core quest has completed',()=>{
 const f=fixture();f.root.sceneState.flags.cartographer_quest_started=true;f.engine.zone.id='thornwood_passage';f.interact('npc:edden_cartographer');f.scene().options[0].action();
 assert.equal(f.root.xp,0);assert.equal(f.root.sceneState.flags.cartographer_escorted,undefined);assert.equal(f.interact('npc:mira_cartographer'),false);
 f.engine.zone.id='thornwood_gate';f.engine.physicalContext=null;assert.equal(f.root.runScene('cartographer_returned'),false);assert.equal(f.root.xp,0);
 f.interact('npc:mira_cartographer');assert.equal(f.root.xp,150);assert.equal(f.root.sceneState.flags.cartographer_escorted,true);
 f.root.runScene('cartographer_returned');assert.equal(f.root.xp,150);
});
test('failed tracking combat queues Edden on victory rather than stranding the route',()=>{
 const f=fixture();f.root.sceneState.flags.cartographer_quest_started=true;f.engine.zone.id='thornwood_passage';f.interact('thornwood_satchel');f.scene().options[0].onFail();
 assert.equal(f.root.encounter.enemies.length,2);assert.equal(f.root.encounter.options.victoryScene,'cartographer_found');
 f.root.runScene(f.root.encounter.options.victoryScene);assert.equal(f.root.sceneState.flags.cartographer_found,undefined);f.interact('npc:edden_cartographer');assert.equal(f.root.holy,10);
});
test('fallen maps and Edden’s discovery reward remain one-time',()=>{
 const f=fixture();f.root.sceneState.flags.cartographer_quest_started=true;f.engine.zone.id='thornwood_passage';f.interact('thornwood_satchel');const take=f.scene().options[1];take.action();take.action();assert.equal(f.root.gameState.character.inventory.length,1);
 f.interact('npc:edden_cartographer');f.root.runScene('cartographer_found');assert.equal(f.root.holy,10);
});
test('saved return handoffs survive allowlisting and premature returns grant nothing',()=>{
 const f=fixture();f.engine.physicalContext='npc:mira_cartographer';f.root.runScene('cartographer_returned');assert.equal(f.root.xp,0);
 assert.deepEqual(Flow.restoreRequests({'npc:mira_cartographer':'cartographer_returned'}),{'npc:mira_cartographer':'cartographer_returned'});
});
test('Edden can be revisited after quest completion, then stages at the gate for his return',()=>{
 const f=fixture();f.root.sceneState.flags.cartographer_quest_started=true;f.engine.zone.id='thornwood_passage';f.interact('npc:edden_cartographer');assert.equal(Flow.nextScene('npc:edden_cartographer',f.root.sceneState,f.root.gameState),'cartographer_found');
 f.scene().options[0].action();assert.equal(Flow.npcStage('edden_cartographer','thornwood_passage',f.root.sceneState,f.root.gameState).active,false);assert.equal(Flow.npcStage('edden_reunited','thornwood_gate',f.root.sceneState,f.root.gameState).active,true);
});
test('the optional reunion retains a world tracker objective after the core quest completes',()=>{
 const source=fs.readFileSync(require.resolve('../site/world3d/chronicle-adapter.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace('export class Chronicle3DAdapter','class Chronicle3DAdapter');
 const root={gameState:{activeQuests:[]},sceneState:{flags:{cartographer_escort_pending:true}}},api=vm.runInNewContext(source+'\n({activeQuests,currentObjective});',{window:root});
 const quest=api.activeQuests()[0];assert.equal(quest.id,'c1q3');assert.equal(api.currentObjective(quest).events[0],'scene:cartographer_returned');root.sceneState.flags.cartographer_escorted=true;assert.equal(api.activeQuests().length,0);
});
test('both physical forest paths are reachable in the authored navigation geometry',()=>{
 const {NavigationGrid}=require('../site/navigation-core.js'),catalog=require('../site/collision-catalog.js');
 for(const [location,z]of [['thornwood_gate',-12],['thornwood_passage',12]]){const zone=catalog[location],nav=new NavigationGrid({...zone.bounds,obstacles:zone.obstacles,cellSize:.65,padding:.62});assert.equal(nav.isPointBlocked({x:0,z}),false);assert.ok(nav.findPath({x:0,z:17},{x:0,z}).length);}
});
