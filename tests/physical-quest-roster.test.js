const test=require('node:test'),assert=require('node:assert/strict');
const Flow=require('../site/physical-quest-flow.js');
const {NavigationGrid}=require('../site/navigation-core.js'),catalog=require('../site/collision-catalog.js');

test('Rane stages at one location during refusal and returns after resolution',()=>{
  const state={flags:{ambassador_quest_started:true}};
  assert.equal(Flow.npcStage('undersecretary_rane','ostrene_legation',state).active,true);
  assert.equal(Flow.npcStage('undersecretary_rane','vaelthar_city',state).active,false);
  state.flags.rane_refused_once=true;
  assert.equal(Flow.npcStage('undersecretary_rane','ostrene_legation',state).active,false);
  assert.equal(Flow.npcStage('undersecretary_rane','vaelthar_city',state).active,true);
  state.flags.chancery_took_exemplar=true;
  assert.equal(Flow.npcStage('undersecretary_rane','vaelthar_city',state).active,false);
  assert.equal(Flow.npcStage('undersecretary_rane','ostrene_legation',state).active,true);
  state.flags.npc_dead_undersecretary_rane=true;
  assert.equal(Flow.npcStage('undersecretary_rane','ostrene_legation',state).active,false);
});
test('Brask escorts stage only with the correct encounter and respect individual fates',()=>{
  for(const wool of [false,true])for(const id of ['flame_agent_legation_1','flame_agent_legation_2']){
    const state={flags:{ambassador_seizure_pending:true,ambassador_seizure_at_wool:wool}},location=wool?'vaelthar_city':'ostrene_legation';
    assert.equal(Flow.npcStage(id,location,state).active,true);
    assert.equal(Flow.npcStage(id,wool?'ostrene_legation':'vaelthar_city',state).active,false);
    for(const flag of ['has_ostrene_exemplar','chancery_took_exemplar','npc_dead_chancery_brask','npc_dead_'+id]){state.flags[flag]=true;assert.equal(Flow.npcStage(id,location,state).active,false);delete state.flags[flag];}
    for(const fate of ['dead','arrested','fled']){state.flags['npc_fate_'+id]=fate;assert.equal(Flow.npcStage(id,location,state).active,false);}
  }
});
test('ambassador support actors are present once and stand on reachable ground',async()=>{
  const THREE=await import('three'),{preparePhysicalQuestTargets}=await import('../site/world3d/physical-quest-targets.mjs');const previous=global.window;
  try{global.window={PhysicalQuestFlow:Flow};for(const id of ['vaelthar_city','ostrene_legation']){
    const zone={id,root:new THREE.Group(),interactables:[],npcs:id==='ostrene_legation'?[{id:'undersecretary_rane',position:[3,0,-2]}]:[]};preparePhysicalQuestTargets(zone);
    const collision=catalog[id],nav=new NavigationGrid({...collision.bounds,obstacles:collision.obstacles,cellSize:.65,padding:.62});
    for(const npcId of ['undersecretary_rane','flame_agent_legation_1','flame_agent_legation_2']){const matches=zone.npcs.filter(n=>n.id===npcId);assert.equal(matches.length,1);const position={x:matches[0].position[0],z:matches[0].position[2]};assert.equal(nav.isPointBlocked(position),false,id+':'+npcId);assert.ok(nav.findPath({x:0,z:id==='vaelthar_city'?17:-6.35},position).length);}
  }}finally{global.window=previous;}
});

test('Vaelthar quest staging accepts its real frozen roster without changing it',async()=>{
  const THREE=await import('three');
  const {VAELTHAR_NPCS}=await import('../site/world3d/vaelthar-npcs.mjs');
  const {preparePhysicalQuestTargets}=await import('../site/world3d/physical-quest-targets.mjs');
  const before=JSON.stringify(VAELTHAR_NPCS),previous=global.window;
  try{
    global.window={PhysicalQuestFlow:Flow};
    const makeZone=()=>({id:'vaelthar_city',root:new THREE.Group(),interactables:[],npcs:VAELTHAR_NPCS});
    const first=makeZone();preparePhysicalQuestTargets(first);
    assert.notEqual(first.npcs,VAELTHAR_NPCS);
    assert.equal(first.npcs.filter(npc=>npc.id==='wool_gate_brask').length,1);
    assert.equal(first.npcs.filter(npc=>npc.id==='captain_rhael').length,1);
    first.npcs[0].position[0]+=100;
    const second=makeZone();preparePhysicalQuestTargets(second);
    assert.equal(second.npcs.filter(npc=>npc.id==='wool_gate_brask').length,1);
    assert.notDeepEqual(first.npcs[0].position,second.npcs[0].position);
    assert.equal(JSON.stringify(VAELTHAR_NPCS),before);
  }finally{global.window=previous;}
});

test('quest staging creates a local NPC roster when a zone has none',async()=>{
  const THREE=await import('three');const {preparePhysicalQuestTargets}=await import('../site/world3d/physical-quest-targets.mjs');const previous=global.window;
  try{global.window={PhysicalQuestFlow:Flow};const zone={id:'ostrene_legation',root:new THREE.Group(),interactables:[]};preparePhysicalQuestTargets(zone);assert.ok(zone.npcs.some(npc=>npc.id==='chancery_brask'));assert.ok(zone.npcs.some(npc=>npc.id==='oret_halven'));}finally{global.window=previous;}
});
