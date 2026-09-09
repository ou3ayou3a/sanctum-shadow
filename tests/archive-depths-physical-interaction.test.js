const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js'),Quests=require('../site/quests.js');
function fixture(){
 const root={SCENES:{},sceneState:{flags:{met_theones:true}},gameState:{activeQuests:[{id:'c1q17'}],character:{inventory:[]}},document:{body:{classList:{contains:()=>true}}},PhysicalQuestFlow:Flow,holy:0,addLog(){}};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantHolyPoints=n=>root.holy+=n;root.startCombat=(enemies,options)=>root.encounter={enemies,options};
 const engine=root.__world3d={zone:{id:'church_archive',interactables:[...Object.keys(Flow.TARGETS),'entrance_archive_level_four','interior_exit'].map(id=>({id}))},hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 let current=null;root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;root.sceneState.currentScene=id;current=root.SCENES[id]();return true;};vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-sermon.js'),'utf8'),root);
 return{root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);}};
}
function landing(f){f.engine.zone.id='archive_level_four';f.interact('archive_four_landing');}
test('Level Four entry requires admission, the scriptorium doorway, and explicit reach',()=>{
 const f=fixture(),target={id:'archive_level_four'};assert.equal(Flow.canTravel(f.root,target),false);f.engine.zone.id='archive_scriptorium';assert.equal(Flow.canTravel(f.root,target),false);f.engine.physicalContext='entrance_archive_level_four';assert.equal(Flow.canTravel(f.root,target),true);
 f.engine.physicalReach=()=>false;assert.equal(Flow.canTravel(f.root,target),false);f.engine.physicalReach=()=>true;f.root.sceneState.flags={};assert.equal(Flow.canTravel(f.root,target),false);
 f.engine.zone.id='archive_level_four';f.engine.physicalContext='interior_exit';assert.equal(Flow.canTravel(f.root,{id:'archive_scriptorium'}),true);assert.equal(Flow.canTravel(f.root,{id:'church_archive'}),false);
});
test('the landing and both presses are separate boundaries; failed filing checks route to the other press',()=>{
 const f=fixture();assert.equal(f.root.runScene('archive_level_four'),false);assert.equal(f.root.sceneState.flags.reached_archive_level_four,undefined);landing(f);f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.clue_aldric_exception,undefined);
 f.interact('archive_standing_press');assert.equal(f.scene().options[0].roll.dc,13);f.scene().options[0].onFail();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.clue_founders_minutes,undefined);f.interact('archive_minutes_press');assert.equal(f.root.sceneState.flags.clue_founders_minutes,true);
});
test('standing-file success preserves the clue and provision check but cannot speak to Theones remotely',()=>{
 const f=fixture();landing(f);f.interact('archive_standing_press');f.scene().options[0].onSuccess();assert.equal(f.root.sceneState.flags.clue_aldric_exception,true);assert.equal(f.scene().options[0].roll.dc,12);f.scene().options[1].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.theones_aldric_line,undefined);
 f.engine.zone.id='church_archive';f.interact('npc:head_archivist_theones');assert.equal(f.root.sceneState.flags.theones_aldric_line,true);f.scene().options[0].action();assert.equal(f.scene(),null);f.engine.zone.id='archive_level_four';f.interact('archive_standing_press');assert.equal(f.root.gameState.character.inventory.filter(x=>x.includes('Aldric Exception')).length,1);
});
test('minutes and the quest ending require returning to reception without premature completion',()=>{
 const f=fixture();landing(f);f.interact('archive_minutes_press');const take=f.scene().options.at(-1).action;take();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.archive_breakin_done,undefined);
 f.engine.zone.id='archive_scriptorium';assert.equal(f.interact('npc:head_archivist_theones'),false);f.engine.zone.id='church_archive';f.interact('npc:head_archivist_theones');assert.equal(f.root.sceneState.flags.archive_breakin_done,true);assert.equal(f.root.sceneState.currentScene,'archive_c1q17_end');
});
test('Theones reads the minutes only at his desk, and the stone wakes only after returning to it',()=>{
 const f=fixture();landing(f);f.interact('archive_minutes_press');f.scene().options[2].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.theones_read_the_minutes,undefined);
 f.engine.zone.id='church_archive';f.interact('npc:head_archivist_theones');assert.equal(f.root.sceneState.flags.theones_read_the_minutes,true);f.scene().options[0].action();f.scene().options.find(o=>o.label.startsWith('Stay.')).action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.archive_lower_stair_open,undefined);
 f.engine.zone.id='archive_level_four';f.interact('archive_floor_stone');assert.equal(f.root.sceneState.flags.archive_lower_stair_open,true);
});
test('listening at the stone does not remotely award the founders’ records',()=>{
 const f=fixture();landing(f);f.scene().options[2].action();assert.equal(f.root.sceneState.flags.archive_floor_stone_seen,undefined);f.interact('archive_floor_stone');assert.equal(f.root.sceneState.flags.archive_floor_stone_seen,true);f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.clue_founders_minutes,undefined);
});
test('the early-solver delivery remains playable at Theones and satisfies both record milestones',()=>{
 const f=fixture();f.root.sceneState.flags.knows_the_name_early=true;f.interact('npc:head_archivist_theones');f.scene().options[0].action();assert.equal(f.root.sceneState.currentScene,'archive_delivered_minutes');assert.equal(f.root.sceneState.flags.clue_founders_minutes,true);assert.equal(f.engine.zone.id,'church_archive');
 const result=Quests.reduceQuestEvent({activeQuestIds:['c1q17'],completedQuestIds:[],progress:{}},'scene:archive_delivered_minutes');assert.deepEqual(result.updates.map(u=>u.objectiveId),['level_four','minutes']);
 f.scene().options.at(-1).action();assert.equal(f.root.sceneState.flags.archive_breakin_done,true);
});
test('searching for the missing charter cannot happen remotely on the early-solver route',()=>{
 const f=fixture();f.root.sceneState.flags.knows_the_name_early=true;f.interact('npc:head_archivist_theones');f.scene().options[0].action();f.scene().options[1].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.archive_searched_year_one,undefined);
 f.engine.zone.id='archive_level_four';f.interact('archive_minutes_press');assert.equal(f.root.sceneState.flags.archive_searched_year_one,true);
});
test('the scriptorium doorway has a reachable approach around its furniture',()=>{
 const {NavigationGrid}=require('../site/navigation-core.js'),zone=require('../site/collision-catalog.js').archive_scriptorium,nav=new NavigationGrid({...zone.bounds,obstacles:zone.obstacles,cellSize:.65,padding:.62});let reached=false;
 for(let i=0;i<16;i++){const angle=i*Math.PI/8,stop={x:Math.sin(angle)*1.65,z:2.7+Math.cos(angle)*1.65};if(!nav.isPointBlocked(stop)&&nav.findPath({x:0,z:-2.85},stop).length){reached=true;break;}}
 assert.equal(reached,true);
});
test('pending Level Four and return objectives point to the next doorway, not a remote scene',()=>{
 const source=fs.readFileSync(require.resolve('../site/world3d/chronicle-adapter.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace('export class Chronicle3DAdapter','class Chronicle3DAdapter');
 for(const [zoneId,requests,recordId]of [['church_archive',{archive_four_landing:'archive_level_four'},'entrance_archive_scriptorium'],['archive_level_four',{'npc:head_archivist_theones':'archive_c1q17_end'},'interior_exit'],['archive_scriptorium',{archive_four_landing:'archive_level_four'},'entrance_archive_level_four']]){
 const record={id:recordId,position:{x:0,z:0}},prototype=vm.runInNewContext(source+'\nChronicle3DAdapter.prototype;',{window:{PhysicalQuestFlow:Flow,sceneState:{physicalSceneRequests:requests}}});const adapter=Object.create(prototype);adapter.engine={zone:{id:zoneId,interactables:[record]}};assert.equal(adapter.targetFor(null,{id:'c1q17'}).interaction,record);
 }
});
