const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const source=fs.readFileSync(require.resolve('../site/story.js'),'utf8'),start=source.indexOf('  fortress_harren_arrival: () =>'),end=source.indexOf('\n};',start);
 const root={sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q6'}],completedQuests:[]},document:{body:{classList:{contains:()=>true}}},holy:0,hell:0,addLog(){},PhysicalQuestFlow:Flow};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantHolyPoints=n=>root.holy+=n;root.grantHellPoints=n=>root.hell+=n;root.startCombat=(enemies,options)=>root.encounter={enemies,options};
 const engine=root.__world3d={zone:{id:'fortress_harren',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:null,hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 const scenes=vm.runInNewContext('({'+source.slice(start,end)+'\n})',root);let current=null;
 root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;root.sceneState.currentScene=id;current=scenes[id]();return true;};
 return{root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);}};
}
function open(f){f.interact('harren_gate_notice');f.scene().options[0].action();f.scene().options[0].action();}
test('fortress arrival and confession require separate explicit physical interactions',()=>{
 const f=fixture();assert.equal(f.root.runScene('fortress_harren_arrival'),false);assert.equal(f.root.sceneState.flags.arrived_fortress,undefined);
 assert.equal(Flow.npcStage('sir_harren','fortress_harren',f.root.sceneState,f.root.gameState).active,false);
 open(f);assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.harren_told_truth,undefined);assert.equal(Flow.npcStage('sir_harren','fortress_harren',f.root.sceneState,f.root.gameState).active,true);
 f.engine.zone.id='harren_hall';assert.equal(f.interact('npc:sir_harren'),false);f.engine.zone.id='fortress_harren';f.engine.physicalReach=()=>false;assert.equal(f.interact('npc:sir_harren'),false);
 f.engine.physicalReach=()=>true;f.interact('npc:sir_harren');assert.equal(f.root.sceneState.flags.harren_told_truth,true);
});
test('persuading Harren grants one alliance reward, including repeated success callbacks',()=>{
 const f=fixture();open(f);f.interact('npc:sir_harren');const success=f.scene().options[0].onSuccess;success();success();assert.equal(f.root.holy,10);assert.equal(f.root.sceneState.flags.harren_ally,true);
 assert.equal(f.root.runScene('harren_confession'),false);assert.equal(f.root.runScene('fortress_harren_arrival'),false);
});
test('Vael appears only when summoned and negotiation waits for his physical target',()=>{
 const f=fixture();assert.equal(Flow.npcStage('commander_vael','fortress_harren',f.root.sceneState,f.root.gameState).active,false);open(f);f.interact('npc:sir_harren');f.scene().options[2].action();assert.equal(f.scene(),null);
 assert.equal(Flow.npcStage('commander_vael','fortress_harren',f.root.sceneState,f.root.gameState).active,true);f.interact('npc:commander_vael');assert.equal(f.scene().options[1].roll.dc,15);
 f.scene().options[1].onSuccess();assert.equal(f.scene(),null);assert.equal(f.root.holy,0);assert.equal(f.root.sceneState.flags.order_stood_down,true);
 f.interact('npc:sir_harren');assert.equal(f.root.holy,10);assert.equal(Flow.npcStage('commander_vael','fortress_harren',f.root.sceneState,f.root.gameState).active,false);
});
test('forced entry preserves the gate check, physical confrontation, and peaceful recovery',()=>{
 const f=fixture();f.interact('harren_gate_notice');const force=f.scene().options[2];assert.equal(force.roll.dc,18);force.onSuccess();assert.equal(f.scene(),null);assert.equal(f.root.hell,0);
 f.interact('npc:sir_harren');assert.equal(f.root.hell,5);f.root.runScene('harren_forced_entry');assert.equal(f.root.hell,5);
 f.scene().options[1].onSuccess();assert.equal(f.root.sceneState.flags.harren_hostile,false);assert.equal(f.root.sceneState.flags.harren_told_truth,true);assert.ok(f.scene());
});
test('both Order combat branches return to Harren for the alliance rather than rewarding remotely',()=>{
 for(const option of [0,1]){const f=fixture();open(f);f.interact('npc:sir_harren');f.scene().options[2].action();f.interact('npc:commander_vael');if(option===0){const defend=f.scene().options[0].action;defend();defend();assert.equal(f.root.hell,5);}else f.scene().options[1].onFail();
 assert.equal(f.root.encounter.options.victoryScene,'harren_joins');assert.equal(f.root.encounter.enemies.length,option===0?3:2);f.root.runScene('harren_joins');assert.equal(f.scene(),null);assert.equal(f.root.holy,0);f.interact('npc:sir_harren');assert.equal(f.root.holy,10);
 }
});
test('duel outcome is retained and a dead Harren cannot be revived through pending dialogue',()=>{
 const f=fixture();f.interact('harren_gate_notice');f.scene().options[2].onSuccess();f.interact('npc:sir_harren');f.scene().options[0].action();assert.equal(f.root.encounter.options.victoryScene,'harren_fallen');
 f.root.runScene('harren_fallen');f.root.runScene('harren_fallen');assert.equal(f.root.hell,11);assert.equal(Flow.npcStage('sir_harren','fortress_harren',f.root.sceneState,f.root.gameState).active,false);assert.equal(f.root.runScene('harren_joins'),false);
});
test('Harren’s evidence requires entering the hall and searching, including older completed saves',()=>{
 const f=fixture();f.root.gameState.character={inventory:[]};f.root.runScene('harren_fallen');f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.harren_field_order_found,undefined);
 f.root.gameState.completedQuests=['c1q6'];f.root.gameState.activeQuests=[];assert.equal(f.interact('harren_field_order'),false);
 f.engine.zone.id='harren_hall';f.interact('harren_field_order');f.interact('harren_field_order');assert.equal(f.root.gameState.character.inventory.length,1);assert.equal(f.root.sceneState.flags.harren_told_truth,true);
});
test('failed persuasion and saved hostile interactions remain playable without reopening the gate',()=>{
 const f=fixture();open(f);f.interact('npc:sir_harren');f.scene().options[0].onFail();assert.equal(f.scene().options[0].roll.dc,13);f.scene().options[0].onFail();assert.equal(f.root.sceneState.currentScene,'harren_confession');
 f.root.sceneState={flags:{harren_hostile:true}};assert.equal(Flow.nextScene('npc:sir_harren',f.root.sceneState,f.root.gameState),'harren_forced_entry');
 f.engine.physicalContext='harren_gate_notice';f.root.runScene('harren_opens_door');assert.equal(f.root.sceneState.flags.harren_opened_door,undefined);f.scene().options[0].action();assert.equal(f.scene(),null);
 assert.equal(Flow.nextScene('npc:sir_harren',{flags:{harren_told_truth:true}},f.root.gameState),'harren_confession');
 assert.deepEqual(Flow.restoreRequests({'npc:commander_vael':'harren_order_arrives',harren_field_order:'harren_field_order','npc:sir_harren':'harren_fallen'}),{'npc:commander_vael':'harren_order_arrives',harren_field_order:'harren_field_order'});
});
test('the lethal quest branch completes at the searched field order, not at the remote duel outcome',()=>{
 const Quests=require('../site/quests.js'),state={activeQuestIds:['c1q6'],completedQuestIds:[],progress:{c1q6:{objectives:{reach_fortress:{eventKey:'scene:fortress_harren_arrival'}}}}};
 assert.deepEqual(Quests.reduceQuestEvent(state,'scene:harren_fallen').completions,[]);
 const result=Quests.reduceQuestEvent(state,'scene:harren_field_order');assert.ok(result.completions.includes('c1q6'));assert.equal(result.updates.length,2);
});
