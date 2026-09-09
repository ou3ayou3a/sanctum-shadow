const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const root={SCENES:{},sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q15'}],character:{inventory:[]}},document:{body:{classList:{contains:()=>true}}},addLog(){},holy:0,setInterval(){throw Error('A rejected conversation must not schedule an ending');}};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantHolyPoints=n=>root.holy+=n;
 const engine=root.__world3d={zone:{id:'mol_village',interactables:Object.entries(Flow.TARGETS).map(([id,t])=>({id,position:{x:t.position[0],z:t.position[2]}}))},hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 let current=null;root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;current=root.SCENES[id]();return true;};
 vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-sermon.js'),'utf8'),root);
 return{root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);},arriveAlley(){const record=engine.zone.interactables.find(r=>r.id==='npc:screaming_preacher');record.position={x:Flow.LECT_ALLEY[0],z:Flow.LECT_ALLEY[2]};return this.interact(record.id);}};
}
test('funeral, congregation and Lect require separate confirmed physical interactions',()=>{
 const f=fixture();assert.equal(f.root.runScene('mol_true_sermon_arrival'),false);assert.equal(f.root.sceneState.flags.mol_true_sermon_started,undefined);
 f.interact('mol_funeral_cart');f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.mol_congregation_seen,undefined);
 f.interact('npc:elder_mosswick');f.scene().options[1].onSuccess();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.lect_in_mol,undefined);
 f.interact('npc:screaming_preacher');f.scene().options[0].onSuccess();assert.equal(f.root.sceneState.flags.clue_hymnal_gloss,true);
 f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.clue_lect_confession,undefined);
 assert.equal(f.interact('npc:screaming_preacher'),false,'talking at the cart cannot trigger the alley');
 f.arriveAlley();assert.equal(f.root.sceneState.flags.clue_lect_confession,true);
 f.scene().options.at(-1).action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.mol_true_sermon_done,undefined);
 f.interact('npc:elder_mosswick');assert.equal(f.root.sceneState.flags.mol_true_sermon_done,true);
});
test('failed sermon checks and the combat victory preserve the physical hymnal handoff',()=>{
 const f=fixture();f.root.sceneState.flags.mol_true_sermon_started=true;f.interact('npc:screaming_preacher');f.scene().options[0].onFail();f.scene().options[1].onFail();
 assert.equal(f.root.gameState.character.inventory.length,1);
 let victory;f.root.startCombat=(list,options)=>{victory=options.victoryScene;assert.equal(list.length,2);};
 f.root.runScene('lect_confronted');f.scene().options[3].action();f.engine.physicalContext=null;
 assert.equal(f.root.runScene(victory),false);f.interact('npc:screaming_preacher');assert.equal(f.root.gameState.character.inventory.length,1);
});
test('comparing the congregation’s hymnal cannot roll or grant evidence at Lect',()=>{
 const f=fixture();f.engine.physicalContext='npc:screaming_preacher';f.root.runScene('lect_hymnal');
 const option=f.scene().options.find(o=>o.label.startsWith('Check another'));assert.equal(option.roll,undefined);option.action();assert.equal(f.scene(),null);
 f.interact('npc:elder_mosswick');f.scene().options[0].onSuccess();assert.equal(f.root.sceneState.flags.clue_gloss_is_universal,true);assert.equal(f.root.sceneState.flags.clue_lect_confession,undefined);
});
test('funeral staging hides living Aldran and keeps only one Lect in the campaign',()=>{
 const state={flags:{}},game={activeQuests:[]};assert.equal(Flow.npcStage('preacher_aldran','mol_village',state,game).active,true);
 game.activeQuests=['c1q15'];assert.equal(Flow.npcStage('preacher_aldran','mol_village',state,game).active,false);assert.equal(Flow.npcStage('screaming_preacher','vaelthar_city',state,game).active,false);
 state.physicalSceneRequests={'npc:screaming_preacher':'lect_alley_confession'};assert.deepEqual(Flow.npcStage('screaming_preacher','mol_village',state,game).position,Flow.LECT_ALLEY);
 state.physicalSceneRequests={};state.flags.lect_private_meeting=true;assert.deepEqual(Flow.npcStage('screaming_preacher','mol_village',state,game).position,Flow.LECT_ALLEY);
 state.physicalSceneRequests={'npc:elder_mosswick':'mol_sermon_aftermath'};assert.deepEqual(Flow.npcStage('screaming_preacher','mol_village',state,game).position,[0,0,-6]);
});
test('the private meeting is reachable around the alehouse with actual navigation clearance',()=>{
 const {NavigationGrid}=require('../site/navigation-core.js'),zone=require('../site/collision-catalog.js').mol_village;
 const nav=new NavigationGrid({...zone.bounds,obstacles:zone.obstacles,cellSize:.65,padding:.62}),end={x:Flow.LECT_ALLEY[0],z:Flow.LECT_ALLEY[2]};
 assert.equal(nav.isPointBlocked(end),false);assert.ok(nav.findPath({x:0,z:-6},end).length);
});
test('ending rewards cannot be farmed through revisits or stale option callbacks',()=>{
 const f=fixture();f.root.sceneState.flags.knows_selvane=true;f.engine.physicalContext='npc:elder_mosswick';f.root.runScene('mol_sermon_aftermath');
 const option=f.scene().options[0];option.action();option.action();assert.equal(f.root.holy,5);assert.ok(!f.scene().options.some(o=>o.label.startsWith('Look at the seventh')));
});
test('a failed freeform conversation cannot advance the quest',async()=>{
 const f=fixture();f.root.startNPCConversation=async()=>false;f.engine.physicalContext='npc:screaming_preacher';f.root.runScene('lect_confronted');
 await f.scene().options[2].action();assert.equal(f.root.sceneState.flags.clue_hymnal_gloss,undefined);
});
test('NPC staging invalidates a cart conversation and sends Lect along a path to the private meeting',()=>{
 const source=fs.readFileSync(require.resolve('../site/world3d/npc-manager.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace('export class NPCManager','class NPCManager');
 const root={PhysicalQuestFlow:Flow,sceneState:{flags:{mol_true_sermon_started:true},physicalSceneRequests:{'npc:screaming_preacher':'lect_alley_confession'}},gameState:{activeQuests:['c1q15']}};
 const prototype=vm.runInNewContext(source+'\nNPCManager.prototype;',{window:root});let destination;
 const manager=Object.create(prototype);manager.engine={zone:{id:'mol_village'},physicalContext:'npc:screaming_preacher',hasPhysicalInteraction:()=>true,navigation:{findPath:(_start,end)=>{destination=end;return[end];}}};
 const record={config:{id:'screaming_preacher'},lastSchedule:'cart',interaction:{id:'npc:screaming_preacher'},actor:{position:{x:0,z:-6},moveAlong(path){assert.ok(path.length);}},collider:{},label:{style:{}}};
 manager.applySchedule(record);assert.equal(manager.engine.physicalContext,null);assert.equal(destination.x,Flow.LECT_ALLEY[0]);assert.equal(destination.z,Flow.LECT_ALLEY[2]);assert.equal(record.active,true);assert.equal(record.activePatrol.length,0);
 destination=null;record.actor.path=[];manager.applySchedule(record);assert.ok(destination,'interrupted relocation resumes even when its schedule key has not changed');
});
