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
