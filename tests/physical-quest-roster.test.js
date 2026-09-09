const test=require('node:test'),assert=require('node:assert/strict');
const Flow=require('../site/physical-quest-flow.js');

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
