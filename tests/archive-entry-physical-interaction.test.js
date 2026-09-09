const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
 const root={SCENES:{},sceneState:{flags:{}},gameState:{activeQuests:[{id:'c1q17'}],character:{inventory:[]}},document:{body:{classList:{contains:()=>true}}},PhysicalQuestFlow:Flow,holy:0,addLog(){}};root.window=root;
 root.setFlag=(id,value=true)=>root.sceneState.flags[id]=value;root.getFlag=id=>root.sceneState.flags[id];root.grantHolyPoints=n=>root.holy+=n;root.startCombat=(enemies,options)=>root.encounter={enemies,options};
 const engine=root.__world3d={zone:{id:'church_archive',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 let current=null;root.runScene=id=>{current=null;if(!Flow.requireScene(root,id))return false;root.sceneState.currentScene=id;current=root.SCENES[id]();return true;};
 vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-sermon.js'),'utf8'),root);
 return{root,engine,scene:()=>current,interact(id){engine.physicalContext=id;const scene=Flow.nextScene(id,root.sceneState,root.gameState);assert.ok(scene,id);return root.runScene(scene);}};
}
test('archive admission and Theones require separate physical interactions',()=>{
 const f=fixture();assert.equal(f.root.runScene('church_archive_breakin'),false);assert.equal(f.root.sceneState.flags.archive_breakin_started,undefined);assert.equal(Flow.npcStage('head_archivist_theones','church_archive',f.root.sceneState,f.root.gameState).active,false);
 f.interact('npc:archive_admissions_deacon');f.scene().options[2].action();assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.met_theones,undefined);
 f.engine.physicalReach=()=>false;assert.equal(f.interact('npc:head_archivist_theones'),false);f.engine.physicalReach=()=>true;f.interact('npc:head_archivist_theones');assert.equal(f.root.sceneState.flags.met_theones,true);
});
test('the wine route moves its DEX check into the scriptorium and returns to Theones',()=>{
 const f=fixture();f.interact('npc:archive_admissions_deacon');assert.equal(f.scene().options[0].roll,undefined);f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.interact('archive_wine_hollow'),false);
 f.engine.zone.id='archive_scriptorium';f.interact('archive_wine_hollow');assert.equal(f.scene().options[0].roll.dc,13);f.scene().options[0].onSuccess();assert.equal(f.root.sceneState.flags.archive_entered_quietly,true);assert.equal(f.scene(),null);assert.equal(f.interact('npc:head_archivist_theones'),false);
 f.engine.zone.id='church_archive';f.interact('npc:head_archivist_theones');assert.equal(f.root.sceneState.flags.met_theones,true);
});
test('failed entry and forced entry combat unlock access without remotely meeting Theones',()=>{
 for(const route of ['wine','forgery','force']){const f=fixture();f.interact('npc:archive_admissions_deacon');
 if(route==='wine'){f.scene().options[0].action();f.engine.zone.id='archive_scriptorium';f.interact('archive_wine_hollow');f.scene().options[0].onFail();}else if(route==='forgery')f.scene().options[1].onFail();else f.scene().options[3].action();
 assert.equal(f.root.encounter.enemies.length,route==='force'?3:2);assert.equal(f.root.encounter.options.victoryScene,'archive_reception_cleared');assert.equal(Flow.archiveAdmitted(f.root.sceneState),false);
 f.root.runScene(f.root.encounter.options.victoryScene);assert.equal(Flow.archiveAdmitted(f.root.sceneState),true);assert.equal(f.root.sceneState.flags.met_theones,undefined);f.scene().options[0].action();assert.equal(f.scene(),null);
 f.engine.zone.id='church_archive';f.interact('npc:head_archivist_theones');assert.equal(f.root.sceneState.flags.met_theones,true);
 }
});
test('Mourne codes and forged writs preserve access without starting a remote conversation',()=>{
 for(const method of ['code','forgery']){const f=fixture();if(method==='code')f.root.sceneState.flags.mourne_allied=true;f.interact('npc:archive_admissions_deacon');if(method==='code')f.scene().options[0].action();else f.scene().options[1].onSuccess();assert.equal(Flow.archiveAdmitted(f.root.sceneState),true);assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.met_theones,undefined);
 f.interact('npc:archive_admissions_deacon');assert.equal(f.scene().options.length,1);assert.equal(f.root.encounter,undefined);
 }
});
test('Theones early-solver reward and document cannot be farmed',()=>{
 const f=fixture();Object.assign(f.root.sceneState.flags,{met_theones:true,knows_the_name_early:true});f.interact('npc:head_archivist_theones');const action=f.scene().options[0].action;f.engine.physicalContext=null;action();assert.equal(f.root.holy,0);f.engine.physicalContext='npc:head_archivist_theones';action();action();assert.equal(f.root.holy,15);assert.equal(f.root.gameState.character.inventory.filter(x=>x==="The Founders' Minutes (unredacted)").length,1);
});
test('older access saves and pending handoffs recover without replaying entry combat',()=>{
 for(const flag of ['archive_entered_quietly','archive_entered_by_forgery','met_theones','reached_archive_level_four','archive_breakin_done']){const f=fixture();f.root.sceneState.flags[flag]=true;assert.equal(Flow.nextScene('npc:head_archivist_theones',f.root.sceneState,f.root.gameState),'archive_theones_desk');}
 assert.deepEqual(Flow.restoreRequests({archive_wine_hollow:'archive_wine_passage','npc:head_archivist_theones':'archive_theones_desk','npc:archive_admissions_deacon':'archive_reception_cleared'}),{archive_wine_hollow:'archive_wine_passage','npc:head_archivist_theones':'archive_theones_desk'});
});
test('stale entry callbacks cannot restart combat after access is won',()=>{
 const f=fixture();f.interact('npc:archive_admissions_deacon');const force=f.scene().options[3].action;force();f.root.runScene(f.root.encounter.options.victoryScene);f.root.encounter=null;force();assert.equal(f.root.encounter,null);
 assert.equal(Flow.nextScene('archive_wine_hollow',f.root.sceneState,f.root.gameState),null);assert.equal(f.root.runScene('archive_wine_passage'),false);
});
