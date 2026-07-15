const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','site');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('the Tarnished Cup is a dedicated production zone rather than a generic tavern shell',()=>{
  const registry=read('world3d/zone-registry.js'),zone=read('world3d/zones/tarnished-cup.js');
  assert.match(registry,/tarnished_cup:buildTarnishedCup/);
  assert.match(zone,/placeProductionAsset\(root,'tavern_interior'/);
  for(const feature of['tarnished-cup-bar','cloaked-booth','musicians-stage','tavern-hearth','cellar-hatch','missing-board'])assert.match(zone,new RegExp(feature));
  assert.match(zone,/burned-ledger-page/);assert.match(zone,/exposure:1\.48/);
});

test('the exploration camera translates with its focus instead of being left behind',()=>{
  const engine=read('world3d/world-engine.js');
  assert.match(engine,/cameraFollowDelta\.copy\(this\.controls\.target\)\.sub\(this\.cameraTargetBefore\)/);
  assert.match(engine,/this\.camera\.position\.add\(this\.cameraFollowDelta\)/);
});

test('the world map tolerates non-location region metadata while drawing routes',()=>{
  const map=read('map.js');
  assert.match(map,/for \(const connId of loc\?\.connections \|\| \[\]\)/);
});

test('the tavern contains story hotspots, a physical exit, commerce, and a populated NPC roster',()=>{
  const zone=read('world3d/zones/tarnished-cup.js');
  for(const hotspot of['tarnished_bar_ledger','tarnished_cloaked_booth','tarnished_cellar_hatch','tarnished_missing_board','tarnished_hearth_cross','tarnished_black_shelf','interior_exit'])assert.match(zone,new RegExp(hotspot));
  for(const npc of['lyra_innkeeper','drunk_cartographer','nervous_merchant','cloaked_figure_1','cloaked_figure_2','cup_server','off_duty_watch'])assert.match(zone,new RegExp(npc));
  assert.match(zone,/transitionToWorldLocation/);assert.match(zone,/window\.openShop/);assert.match(zone,/patrol:/);
});

test('Tarnished Cup discoveries use bounded D&D checks and explicit authoritative effects',async()=>{
  const {TARNISHED_CUP_ACTIONS}=await import('../site/world3d/tarnished-cup-actions.mjs');
  assert.deepEqual(Object.keys(TARNISHED_CUP_ACTIONS).sort(),['burnedLedger','cellarHatch','cloakedBooth','missingBoard','oldCross'].sort());
  const actions=Object.values(TARNISHED_CUP_ACTIONS).flat();assert.ok(actions.length>=8);
  for(const action of actions){
    assert.match(action.id,/^[a-z0-9_]+$/);assert.ok(Number.isInteger(action.check.dc));assert.ok(action.check.dc>=10&&action.check.dc<=14);
    for(const effectSet of[action.effects,action.failureEffects]){assert.deepEqual(Object.keys(effectSet).sort(),['facts','flags','items','questEvents','reputation','resources'].sort());}
  }
  const ledger=TARNISHED_CUP_ACTIONS.burnedLedger.find(action=>action.id==='reconstruct_burned_ledger');
  assert.equal(ledger.effects.flags.cupside_orders_found,true);assert.ok(ledger.effects.questEvents.includes('scene:cupside_evidence_found'));
});
