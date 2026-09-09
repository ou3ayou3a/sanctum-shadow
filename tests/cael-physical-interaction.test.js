const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
function fixture(flags={clue_aldric_exception:true,archive_breakin_done:true}){
 const root={SCENES:{},sceneState:{flags},gameState:{activeQuests:[],completedQuests:[{id:'c1q17'}],character:{inventory:[]}},document:{body:{classList:{contains:()=>true}}},PhysicalQuestFlow:Flow,holy:0,addLog(){}};root.window=root;
 root.setFlag=(id,value=true)=>flags[id]=value;root.getFlag=id=>flags[id];root.grantHolyPoints=n=>root.holy+=n;root.travelTo=()=>{throw Error('Unexpected teleport');};
 const engine=root.__world3d={zone:{id:'monastery_aldric',interactables:[{id:'npc:brother_cael'}]},physicalContext:'npc:brother_cael',hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
 let scene;root.runScene=id=>{scene=null;if(!Flow.requireScene(root,id))return false;scene=root.SCENES[id]();return true;};vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-sermon.js'),'utf8'),root);
 return {root,engine,flags,scene:()=>scene,open:()=>root.runScene('cael_the_last_sayer')};
}
test('Cael requires courtyard, explicit interaction, reach and a revealed identity',()=>{
 const f=fixture();f.engine.zone.id='church_archive';assert.equal(f.open(),false);assert.equal(f.flags.met_cael_sayer,undefined);f.engine.zone.id='monastery_aldric';f.engine.physicalContext=null;assert.equal(f.open(),false);f.engine.physicalContext='npc:brother_cael';f.engine.physicalReach=()=>false;assert.equal(f.open(),false);assert.equal(fixture({}).open(),false);
});
test('completed archive saves can discover and revisit Cael without replaying the quest',()=>{
 const f=fixture();assert.equal(Flow.nextScene('npc:brother_cael',f.root.sceneState,f.root.gameState),'cael_the_last_sayer');assert.equal(f.open(),true);assert.equal(f.flags.met_cael_sayer,true);assert.equal(f.root.gameState.activeQuests.length,0);
});
test('telling Cael grants Holy once and removes contradictory choices',()=>{
 const f=fixture();f.open();const tell=f.scene().options[0].action,withhold=f.scene().options[1].action;tell();tell();withhold();assert.equal(f.root.holy,10);assert.equal(f.flags.cael_told,true);assert.equal(f.flags.cael_untold,false);assert.equal(f.scene().options.length,2);
});
test('withholding then telling changes the decision but cannot farm another reward',()=>{
 const f=fixture();f.open();const withhold=f.scene().options[1].action;withhold();withhold();assert.equal(f.root.holy,5);f.scene().options[0].action();assert.equal(f.root.holy,5);assert.equal(f.flags.cael_told,true);assert.equal(f.flags.cael_untold,false);
});
test('stale callbacks revalidate physical reach before changing flags or rewards',()=>{
 const f=fixture();f.open();const options=f.scene().options;f.engine.physicalReach=()=>false;for(const option of options.slice(0,3))option.action();assert.equal(f.root.holy,0);assert.equal(f.flags.cael_told,undefined);assert.equal(f.flags.cael_untold,undefined);assert.equal(f.flags.cael_recited_order,undefined);
});
test('legacy decisions cannot claim another reward; prayer and departure do not teleport',()=>{
 for(const decision of ['cael_told','cael_untold']){const f=fixture({met_cael_sayer:true,[decision]:true});f.open();if(decision==='cael_untold')f.scene().options[0].action();f.scene().options[0].action();assert.equal(f.flags.cael_recited_order,true);f.scene().options.at(-1).action();assert.equal(f.root.holy,0);assert.equal(f.engine.zone.id,'monastery_aldric');}
});
test('Cael pending requests survive allowlisted restoration',()=>{
 assert.deepEqual(Flow.restoreRequests({'npc:brother_cael':'cael_the_last_sayer',archive_floor_stone:'cael_the_last_sayer'}),{'npc:brother_cael':'cael_the_last_sayer'});
});
test('Cael tracker follow-up coexists with the escort and does not reopen core quests',()=>{
 const source=fs.readFileSync(require.resolve('../site/world3d/chronicle-adapter.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace('export class Chronicle3DAdapter','class Chronicle3DAdapter');const window={gameState:{activeQuests:[],completedQuests:[{id:'c1q17'}]},sceneState:{flags:{archive_breakin_done:true,clue_aldric_exception:true,cartographer_escort_pending:true}}};const api=vm.runInNewContext(source+'\n({activeQuests,currentObjective})',{window});
 const quests=api.activeQuests();assert.equal(quests.length,2);assert.equal(api.currentObjective(quests[1]).events[0],'scene:cael_the_last_sayer');assert.equal(window.gameState.activeQuests.length,0);window.sceneState.flags.met_cael_sayer=true;assert.equal(api.activeQuests().length,1);
});
