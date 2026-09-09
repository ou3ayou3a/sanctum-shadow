const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
test('the quest-entry gate agrees with the hatch physical target location',()=>{
 const entry=require('../site/quest-entry-hooks.js').ENTRY.c1q18;assert.equal(entry.location,Flow.TARGETS[Flow.SCENES[entry.scene]].location);
});
function fixture(){
 const root={SCENES:{},sceneState:{flags:{met_theones:true}},gameState:{activeQuests:[{id:'c1q18'}],completedQuests:[]},document:{body:{classList:{contains:()=>true}}},PhysicalQuestFlow:Flow,xp:0,holy:0,addLog(){}};root.window=root;root.setFlag=(k,v=true)=>root.sceneState.flags[k]=v;root.getFlag=k=>root.sceneState.flags[k];root.grantXP=n=>root.xp+=n;root.grantHolyPoints=n=>root.holy+=n;
 const engine=root.__world3d={zone:{id:'archive_level_four',interactables:[...Object.keys(Flow.TARGETS),'entrance_archive_foundation','interior_exit'].map(id=>({id}))},physicalContext:'archive_hatch',hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 let scene;root.runScene=id=>{scene=null;if(!Flow.requireScene(root,id))return false;scene=root.SCENES[id]();return !!scene;};vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-finale.js'),'utf8'),root);
 return{root,engine,flags:root.sceneState.flags,scene:()=>scene,open:(id)=>root.runScene(id),stone(){engine.zone.id='archive_foundation';engine.physicalContext='archive_sixth_stone';return root.runScene('archive_voice_names');},desk(){engine.zone.id='church_archive';engine.physicalContext='npc:head_archivist_theones';return root.runScene('archive_voice_ascent');}};
}
test('hatch checks require the physical floor target and only unlock a separate descent',()=>{
 const f=fixture();f.engine.zone.id='church_archive';assert.equal(f.open('archive_lowest_level'),false);assert.equal(f.flags.archive_voice_quest_started,undefined);f.engine.zone.id='archive_level_four';f.open('archive_lowest_level');const success=f.scene().options[0].onSuccess;success();assert.equal(f.flags.archive_hatch_unlocked,true);assert.equal(f.flags.heard_the_archive_voice,undefined);assert.equal(f.scene(),null);success();assert.equal(f.root.xp,60);
});
test('failed checks and pulling the ring leave a usable descent without granting check rewards',()=>{
 for(const option of [0,1,2]){const f=fixture();f.open('archive_lowest_level');(f.scene().options[option].onFail||f.scene().options[option].action)();assert.equal(f.flags.archive_hatch_unlocked,true);assert.equal(f.root.xp,0);assert.equal(f.root.holy,0);assert.equal(f.flags.heard_the_archive_voice,undefined);}
});
test('prayer cannot be repeatedly rewarded, including previously visited legacy saves',()=>{
 const f=fixture();f.open('archive_lowest_level');const pray=f.scene().options[1].onSuccess;pray();pray();assert.equal(f.root.holy,5);const old=fixture();old.flags.heard_the_archive_voice=true;old.open('archive_lowest_level');old.scene().options[1].onSuccess();assert.equal(old.root.holy,0);
});
test('foundation travel validates unlock, doorway, reach and physical return exit',()=>{
 const f=fixture(),loc={id:'archive_foundation'};assert.equal(Flow.canTravel(f.root,loc),false);f.flags.archive_hatch_unlocked=true;assert.equal(Flow.canTravel(f.root,loc),false);f.engine.physicalContext='entrance_archive_foundation';assert.equal(Flow.canTravel(f.root,loc),true);f.engine.physicalReach=()=>false;assert.equal(Flow.canTravel(f.root,loc),false);f.engine.physicalReach=()=>true;f.engine.zone.id='archive_foundation';f.engine.physicalContext='interior_exit';assert.equal(Flow.canTravel(f.root,{id:'archive_level_four'}),true);assert.equal(Flow.canTravel(f.root,{id:'church_archive'}),false);
});
test('the Voice cannot grant its clues remotely or trap a player who withdraws immediately',()=>{
 const f=fixture();assert.equal(f.open('archive_voice_names'),false);assert.equal(f.flags.heard_the_archive_voice,undefined);f.stone();f.scene().options.at(-1).action();assert.equal(f.flags.clue_voice_cannot_say_own_name,undefined);assert.equal(f.desk(),false);assert.equal(f.flags.archive_voice_quest_complete,undefined);
});
test('listening and well deduction rewards remain one-time',()=>{
 const f=fixture();f.stone();const listen=f.scene().options[2].onSuccess;listen();const total=f.root.xp;listen();assert.equal(f.root.xp,total);f.flags.clue_well_syllable=true;f.open('archive_voice_asks_name');const deduce=f.scene().options[0].onSuccess;deduce();const after=f.root.xp;deduce();assert.equal(f.root.xp,after);assert.equal(f.flags.voice_matches_well,true);
});
test('repeated Voice conversation options cannot farm XP',()=>{
 const f=fixture();f.stone();f.open('archive_voice_asks_name');const theft=f.scene().options.find(o=>o.label.includes('Who took')).action;theft();let xp=f.root.xp;theft();assert.equal(f.root.xp,xp);f.open('archive_voice_the_name');for(const label of ['Are you the thing','You know what']){const option=f.scene().options.find(o=>o.label.includes(label));option.onSuccess();xp=f.root.xp;option.onSuccess();assert.equal(f.root.xp,xp);}
});
test('stale callbacks cannot apply success effects after leaving the stone',()=>{
 const f=fixture();f.stone();const success=f.scene().options[2].onSuccess;f.engine.physicalReach=()=>false;success();assert.equal(f.root.xp,0);assert.equal(f.flags.let_the_voice_finish,undefined);
});
test('name revelation requires knowledge and preserves one-time Tower unlock',()=>{
 const f=fixture();f.stone();f.open('archive_voice_told_name');assert.equal(f.flags.told_the_voice,undefined);f.flags.clue_well_syllable=true;f.open('archive_voice_told_name');assert.equal(f.flags.told_the_voice,true);assert.equal(f.flags.tower_opened,true);const consent=f.scene().options[0].action;consent();const xp=f.root.xp;consent();f.open('archive_voice_told_name');assert.equal(f.root.xp,xp);
});
test('completion waits for return to Theones; the report and departure do not teleport',()=>{
 const f=fixture();f.stone();f.open('archive_voice_asks_name');f.scene().options.at(-1).action();assert.equal(f.scene(),null);assert.equal(f.flags.archive_voice_quest_complete,undefined);assert.equal(f.root.sceneState.physicalSceneRequests['npc:head_archivist_theones'],'archive_voice_ascent');f.desk();assert.equal(f.flags.archive_voice_quest_complete,true);const report=f.scene().options[0].action;report();const xp=f.root.xp;report();assert.equal(f.root.xp,xp);f.scene().options.at(-1).action();assert.equal(f.engine.zone.id,'church_archive');f.scene().options[1].action();assert.equal(f.flags.covenant_author_quest_started,undefined);assert.equal(f.root.sceneState.physicalSceneRequests.archive_chancery_register,'chancery_records_room');
});
test('pending Foundation and report routes guide through connecting doors',()=>{
 const source=fs.readFileSync(require.resolve('../site/world3d/chronicle-adapter.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace('export class Chronicle3DAdapter','class Chronicle3DAdapter');
 for(const [zone,id,scene,door]of [['archive_level_four','archive_sixth_stone','archive_voice_names','entrance_archive_foundation'],['church_archive','archive_sixth_stone','archive_voice_names','entrance_archive_scriptorium'],['archive_foundation','npc:head_archivist_theones','archive_voice_ascent','interior_exit']]){const record={id:door,position:{x:0,z:0}},prototype=vm.runInNewContext(source+'\nChronicle3DAdapter.prototype',{window:{PhysicalQuestFlow:Flow,sceneState:{physicalSceneRequests:{[id]:scene}}}}),adapter=Object.create(prototype);adapter.engine={zone:{id:zone,interactables:[record]}};assert.equal(adapter.targetFor(null,{id:'c1q18'}).interaction,record);}
});
