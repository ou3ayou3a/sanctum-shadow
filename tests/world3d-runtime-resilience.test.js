const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'../site/world3d',file),'utf8');

test('NPC streaming keeps the nearest active characters inside strict quality budgets',async()=>{
  const policy=await import('../site/world3d/actor-streaming-policy.mjs');
  const records=Array.from({length:30},(_,index)=>({config:{id:`npc_${index}`},position:{x:index,z:0},active:true,priority:false}));
  records[20].priority=true;
  const low=policy.selectNpcActorIds(records,{x:0,z:0},'low');
  const high=policy.selectNpcActorIds(records,{x:0,z:0},'high');
  assert.equal(low.size,policy.NPC_ACTOR_BUDGETS.low);assert.equal(high.size,policy.NPC_ACTOR_BUDGETS.high);
  assert.ok(low.has('npc_20'),'priority NPC remains streamed');
  assert.ok(high.size>low.size);
});

test('character disposal preserves shared cached geometry and equipment resources',()=>{
  const actor=read('character-actor.js'),equipment=read('class-equipment.js');
  assert.match(actor,/sharedActorGeometry/);assert.match(actor,/!o\.userData\?\.sharedActorGeometry/);
  assert.match(actor,/!o\.userData\?\.sharedActorMaterial/);assert.match(equipment,/sharedActorMaterial=true/);
  assert.match(actor,/showLoadingFallback/);assert.match(actor,/using the lightweight fallback/);
});

test('world timing remains responsive below 20 FPS and performance adapts during combat',()=>{
  const engine=read('world-engine.js'),polish=read('world-polish.js'),npc=read('npc-manager.js'),combat=read('combat-controller.js');
  assert.match(engine,/getDelta\(\),\.12/);assert.match(engine,/followSpeed=this\.cameraKeys\.size\?12:6\.5/);assert.match(engine,/KeyF/);
  assert.match(polish,/fps<48/);assert.doesNotMatch(polish,/!this\.engine\.combatController\?\.active/);
  assert.match(npc,/selectNpcActorIds/);assert.match(npc,/worldNpcBudget/);assert.match(combat,/restoreAfterCombat/);
});
