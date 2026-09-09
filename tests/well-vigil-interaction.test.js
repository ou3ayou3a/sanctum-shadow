const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
function fixture(){
  const root={SCENES:{},sceneState:{flags:{}},worldClock:{hour:8,day:1},gameState:{character:{hp:30,inventory:[]}},
    document:{body:{classList:{contains:()=>true}}},addLog(){},grantXP(){},grantHolyPoints(){}};
  root.window=root;
  root.setFlag=(key,value=true)=>{root.sceneState.flags[key]=value;};
  root.advanceTime=hours=>{root.worldClock.hour+=hours;while(root.worldClock.hour>=24){root.worldClock.hour-=24;root.worldClock.day++;}};
  const engine=root.__world3d={zone:{id:'mol_village',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:null,
    hasPhysicalInteraction(id){return this.physicalContext?.entityId===id;},physicalReach:()=>true,toast(){}};
  let scene=null,lastId=null;
  root.runScene=id=>{scene=null;lastId=null;if(!Flow.requireScene(root,id))return false;scene=root.SCENES[id]();lastId=id;return true;};
  vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-wells.js'),'utf8'),root);
  return{root,engine,scene:()=>scene,id:()=>lastId,interact:()=>{engine.physicalContext={entityId:'mol_well_vigil'};root.runScene('well_vigil_night');}};
}
test('three transcriptions require three explicit night interactions and preserve the authored reward',()=>{
  const f=fixture();
  assert.equal(f.root.runScene('well_vigil_night'),false);
  assert.equal(f.root.worldClock.hour,8,'remote attempts cannot change time');
  for(let night=1;night<=3;night++){
    f.interact();assert.equal(f.root.worldClock.hour,20);assert.equal(f.id(),'well_vigil_night');
    assert.equal(f.scene().options[0].roll.dc,13);
    assert.equal(f.engine.physicalContext,null,'the next night must not reuse this interaction');
    f.scene().options[0].onSuccess();assert.equal(f.root.worldClock.hour,6);
    assert.equal(f.root.sceneState.flags.well_nights_transcribed,night);
    if(night<3){assert.equal(f.scene(),null);assert.equal(f.root.sceneState.physicalSceneRequests.mol_well_vigil,'well_vigil_night');}
  }
  assert.equal(f.id(),'well_syllable_resolved');assert.equal(f.root.worldClock.day,4);
  assert.equal(f.root.sceneState.flags.clue_well_syllable,true);
  assert.equal(f.root.gameState.character.inventory.filter(x=>x==='Well-Scream Transcription (three nights)').length,1);
});
test('a failed night advances to dawn and retains the lower retry DC without free success',()=>{
  const f=fixture();f.interact();f.scene().options[0].onFail();
  assert.equal(f.id(),'well_night_failed');assert.equal(f.root.worldClock.hour,6);
  assert.equal(f.root.sceneState.flags.well_nights_failed,1);
  assert.equal(f.root.sceneState.flags.well_nights_transcribed,undefined);
  f.scene().options[0].action();assert.equal(f.scene(),null);
  f.interact();assert.equal(f.scene().options[0].roll.dc,12);assert.equal(f.root.worldClock.hour,20);
});
test('night-time interactions do not skip forward an extra day',()=>{
  const f=fixture();f.root.worldClock.hour=22;f.interact();
  assert.equal(f.root.worldClock.hour,22);assert.equal(f.root.worldClock.day,1);
});

test('Hesk directs the player to the rope before a descent check can resolve',()=>{
  const f=fixture();f.engine.physicalContext={entityId:'npc:well_warden_hesk'};
  f.root.runScene('well_warden_tally');f.scene().options[2].action();
  assert.equal(f.scene(),null);assert.equal(f.root.gameState.character.hp,30);
  assert.equal(f.root.sceneState.physicalSceneRequests.mol_well,'well_rope_descent');
  f.engine.physicalContext={entityId:'mol_well'};f.root.runScene('well_rope_descent');
  assert.equal(f.scene().options[0].roll.dc,12);
  f.scene().options[0].onFail();assert.equal(f.root.gameState.character.hp,26);
  assert.equal(f.scene(),null);assert.equal(f.root.sceneState.flags.well_stone_seen,undefined);
  assert.equal(f.root.sceneState.physicalSceneRequests.mol_well_stone,'well_dry_shaft');
});

test('the shaft requires the resolved rope approach and its return requires the physical exit',()=>{
  const f=fixture(),shaft={id:'mol_well_shaft'},outside={id:'mol_village'};
  assert.equal(Flow.canTravel(f.root,shaft),false);
  f.root.sceneState.physicalSceneRequests={mol_well_stone:'well_dry_shaft'};
  assert.equal(Flow.canTravel(f.root,shaft),false);
  f.engine.physicalContext={entityId:'mol_well'};assert.equal(Flow.canTravel(f.root,shaft),true);
  f.engine.zone.id='mol_well_shaft';f.engine.physicalContext=null;
  f.engine.zone.interactables.push({id:'well_rope_exit'});
  assert.equal(Flow.canTravel(f.root,outside),false);
  assert.equal(f.root.runScene('well_dry_shaft'),false);
  f.engine.physicalContext={entityId:'mol_well_stone'};
  assert.equal(f.root.runScene('well_dry_shaft'),true);
  assert.equal(f.root.sceneState.flags.well_stone_seen,true);
  f.engine.physicalContext={entityId:'well_rope_exit'};
  assert.equal(Flow.canTravel(f.root,outside),true);
  assert.equal(Flow.canTravel(f.root,{id:'vaelthar_city'}),false);
});

test('the deep vigil bonus depends on the actual zone, not a stale saved flag',()=>{
  const f=fixture();f.engine.zone.id='mol_well_shaft';
  f.engine.physicalContext={entityId:'mol_well_deep_vigil'};
  f.root.runScene('well_vigil_night');assert.equal(f.scene().options[0].roll.dc,11);
  assert.equal(f.root.sceneState.flags.well_vigil_in_shaft,true);
  f.scene().options[0].onFail();f.scene().options[0].action();
  assert.equal(f.root.sceneState.physicalSceneRequests.mol_well_deep_vigil,'well_vigil_night');
  assert.deepEqual(Flow.restoreRequests(f.root.sceneState.physicalSceneRequests),{mol_well_deep_vigil:'well_vigil_night'});
  f.engine.zone.id='mol_village';f.interact();
  assert.equal(f.root.sceneState.flags.well_vigil_in_shaft,false);
  assert.equal(f.scene().options[0].roll.dc,12);
});

test('inherited object properties are not treated as quest targets or scene routes',()=>{
  const f=fixture();
  for(const id of ['__proto__','constructor','toString']){
    assert.equal(Flow.nextScene(id,f.root.sceneState,{}),null);
    assert.equal(Flow.requireScene(f.root,id),true);
  }
});

test('capping requires reaching Cabb and the final tally-stick requires returning to Hesk',()=>{
  const f=fixture();f.root.gameState.activeQuests=[{id:'c1q7'}];f.root.sceneState.flags.well_quest_started=true;
  assert.equal(Flow.nextScene('npc:well_digger_cabb',f.root.sceneState,f.root.gameState),null);
  f.root.sceneState.flags.well_nights_failed=2;
  assert.equal(Flow.nextScene('npc:well_digger_cabb',f.root.sceneState,f.root.gameState),'well_cabb_offer');
  assert.equal(f.root.runScene('well_that_screams_capped'),false);
  assert.equal(f.root.sceneState.flags.well_capped,undefined);
  f.engine.physicalContext={entityId:'npc:well_digger_cabb'};
  f.root.runScene('well_that_screams_capped');assert.equal(f.root.sceneState.flags.well_capped,true);
  f.scene().options[0].action();assert.equal(f.scene(),null);
  assert.equal(f.root.gameState.character.inventory.length,0);
  f.engine.physicalContext={entityId:'npc:well_warden_hesk'};f.root.runScene('well_hesk_tally_gift');
  assert.equal(f.root.gameState.character.inventory.length,1);
  f.root.runScene('well_hesk_tally_gift');assert.equal(f.root.gameState.character.inventory.length,1);
});

test('Hesk cannot give the post-capping tally reward before the well is capped',()=>{
  const f=fixture();f.engine.physicalContext={entityId:'npc:well_warden_hesk'};
  f.root.runScene('well_hesk_tally_gift');assert.equal(f.scene(),null);
  assert.equal(f.root.gameState.character.inventory.length,0);
  assert.equal(f.root.sceneState.flags.well_stick_taken,undefined);
});

test('capping cannot skip its prerequisites or resume a stale vigil afterward',()=>{
  const f=fixture();f.engine.physicalContext={entityId:'npc:well_digger_cabb'};
  f.root.runScene('well_that_screams_capped');assert.equal(f.scene(),null);
  assert.equal(f.root.sceneState.flags.well_capped,undefined);
  f.root.sceneState.flags.well_nights_failed=2;
  f.root.sceneState.physicalSceneRequests={mol_well_vigil:'well_vigil_night',mol_well_deep_vigil:'well_vigil_night',mol_well_stone:'well_dry_shaft',mol_well:'well_rope_descent'};
  f.root.runScene('well_that_screams_capped');assert.equal(f.root.sceneState.physicalSceneRequests.mol_well_vigil,undefined);
  assert.deepEqual(f.root.sceneState.physicalSceneRequests,{});
  assert.equal(f.root.runScene('well_rope_descent'),false);
  f.root.sceneState.physicalSceneRequests={mol_well_vigil:'well_vigil_night'};
  assert.equal(Flow.nextScene('mol_well_vigil',f.root.sceneState,f.root.gameState),null);
  const hour=f.root.worldClock.hour;
  f.interact();assert.equal(f.scene(),null);assert.equal(f.root.worldClock.hour,hour);
});
