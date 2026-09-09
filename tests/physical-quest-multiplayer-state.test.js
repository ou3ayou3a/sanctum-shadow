const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
const source=fs.readFileSync(require.resolve('../site/multiplayer.js'),'utf8');
const functions=source.slice(source.indexOf('function buildCampaignState('),source.indexOf('function mpBroadcastCampaignState('));
function fixture(){
 let removed=0,refreshed=0;
 const root={mp:{},gameState:{activeQuests:[],completedQuests:[],questProgress:{}},sceneState:{flags:{},knownFacts:{}},PhysicalQuestFlow:Flow,__world3d:{chronicleAdapter:{refresh(){refreshed++;}}}};
 const context={window:root,gameState:root.gameState,document:{getElementById:()=>({remove(){removed++;}})}};
 vm.createContext(context);vm.runInContext(functions,context);
 return{root,context,removed:()=>removed,refreshed:()=>refreshed};
}
test('campaign snapshots include only allowlisted pending physical scene requests',()=>{
 const f=fixture();f.root.sceneState.physicalSceneRequests={mol_parish_ledger:'mol_tithe_founding_page',mol_well:'well_syllable_resolved',unknown:'well_dry_shaft'};
 const state=f.context.buildCampaignState('physical_quest_request');
 assert.deepEqual(state.scene.physicalSceneRequests,{mol_parish_ledger:'mol_tithe_founding_page'});
});
test('a shared physical handoff closes the old guest scene and refreshes its target markers',()=>{
 const f=fixture();f.root.sceneState._currentScene={id:'mol_tithe_collector'};
 f.context.applyCampaignState({version:1,scene:{physicalSceneRequests:{mol_parish_ledger:'mol_tithe_founding_page'},currentData:null}});
 assert.equal(f.removed(),1);assert.equal(f.root.sceneState._currentScene,null);assert.equal(f.refreshed(),1);
 assert.equal(f.root.sceneState.physicalSceneRequests.mol_parish_ledger,'mol_tithe_founding_page');
});
test('shared physical handoffs preserve private memory panels and reject invalid target pairs',()=>{
 const f=fixture();f.root.sceneState._currentScene={id:'pq_private_memory',personal:true};
 f.context.applyCampaignState({version:2,scene:{physicalSceneRequests:{mol_parish_ledger:'mol_tithe_founding_page',mol_well:'well_syllable_resolved'}}});
 assert.equal(f.removed(),0);assert.equal(f.root.sceneState._currentScene.id,'pq_private_memory');
 assert.equal(f.root.sceneState.physicalSceneRequests.mol_well,undefined);
});
test('a reconnect snapshot replaces stale ambassador dialogue without executing quest effects',()=>{
 const f=fixture();f.root.gameState.activeScreen='game';f.root.sceneState._currentScene={id:'ambassador_chancery_seizure',narration:'Brask demands the case.',options:[{label:'Fight',action:()=>assert.fail('old choice executed')}]};
 const shown=[];f.root.showScene=scene=>{assert.equal(f.root.mp._receiving,true);shown.push(scene);f.root.sceneState._currentScene=scene;};f.root.runScene=()=>assert.fail('quest factory executed');f.root.grantXP=()=>assert.fail('reward duplicated');
 const outcome={id:'ambassador_exemplar_kept',narration:'You hold the counterpart.',options:[{label:'Find Rhael',type:'move'}]};
 f.context.applyCampaignState({version:3,activeQuests:[{id:'c1q9'}],completedQuests:[{id:'c1q8'}],scene:{flags:{has_ostrene_exemplar:true,ambassador_reward_exemplar:true},currentData:outcome,physicalSceneRequests:{}}});
 assert.equal(shown.length,1);assert.equal(shown[0].id,'ambassador_exemplar_kept');assert.equal(f.root.sceneState.flags.ambassador_reward_exemplar,true);assert.equal(f.root.gameState.completedQuests[0].id,'c1q8');assert.equal(f.root.mp._receiving,undefined);
 f.context.applyCampaignState({version:4,scene:{flags:{has_ostrene_exemplar:true},currentData:JSON.parse(JSON.stringify(outcome))}});assert.equal(shown.length,1,'unchanged dialogue must not restart');
});
test('explicit host dialogue closure clears stale guest panels even without a pending target',()=>{
 const f=fixture();f.root.sceneState._currentScene={id:'ambassador_exemplar_surrendered'};f.root.sceneState._currentOptions=[{}];
 f.context.applyCampaignState({version:5,scene:{currentData:null,physicalSceneRequests:{}}});assert.equal(f.removed(),1);assert.equal(f.root.sceneState._currentScene,null);assert.equal(f.root.sceneState._currentOptions.length,0);
});
test('snapshot reconciliation preserves private dialogue and does not interrupt active combat',()=>{
 for(const privateScene of [false,true]){const f=fixture();f.root.gameState.activeScreen='game';f.root.sceneState._currentScene={id:privateScene?'pq_memory':'ambassador_chancery_seizure',personal:privateScene};f.root.combatState={active:!privateScene};f.root.showScene=()=>assert.fail('protected presentation interrupted');f.context.applyCampaignState({version:6,scene:{currentData:{id:'ambassador_exemplar_kept',narration:'Kept'}}});assert.equal(f.root.sceneState._currentScene.id,privateScene?'pq_memory':'ambassador_chancery_seizure');}
});
test('changed options refresh same-id scenes and older snapshots cannot restore stale choices',()=>{
 const f=fixture();f.root.gameState.activeScreen='game';f.root.sceneState._currentScene={id:'ambassador_seven_clauses',narration:'Page one',options:[{label:'Let Rane collate'}]};let shown=0;f.root.showScene=scene=>{shown++;f.root.sceneState._currentScene=scene;};
 f.context.applyCampaignState({version:8,scene:{currentData:{id:'ambassador_seven_clauses',narration:'Page one',options:[{label:'Compare it yourself'}]}}});assert.equal(shown,1);
 f.context.applyCampaignState({version:7,scene:{currentData:{id:'ambassador_seven_clauses',narration:'Page one',options:[{label:'Let Rane collate'}]}}});assert.equal(shown,1);
});
