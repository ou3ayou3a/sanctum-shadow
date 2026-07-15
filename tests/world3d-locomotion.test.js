const test=require('node:test');
const assert=require('node:assert/strict');

test('exploration speed accelerates and decelerates without overshoot',async()=>{
  const locomotion=await import('../site/world3d/locomotion.mjs');
  assert.ok(Math.abs(locomotion.advanceSpeed(0,locomotion.WALK_SPEED,.1)-.85)<1e-9);
  assert.equal(locomotion.advanceSpeed(2.4,locomotion.WALK_SPEED,.1),locomotion.WALK_SPEED);
  assert.equal(locomotion.advanceSpeed(1,0,.1),0);
  assert.ok(Math.abs(locomotion.advanceSpeed(NaN,locomotion.RUN_SPEED,.1)-.85)<1e-9);
});

test('walk and run weights form a continuous locomotion blend',async()=>{
  const{locomotionBlend,WALK_SPEED,RUN_SPEED}=await import('../site/world3d/locomotion.mjs');
  assert.deepEqual(locomotionBlend(0),{moving:0,walk:0,run:0,state:'idle'});
  const walk=locomotionBlend(WALK_SPEED);assert.equal(walk.state,'walk');assert.ok(walk.walk>walk.run);
  const middle=locomotionBlend((WALK_SPEED+RUN_SPEED)/2);assert.ok(middle.walk>0&&middle.run>0);
  const run=locomotionBlend(RUN_SPEED);assert.equal(run.state,'run');assert.equal(run.run,1);
});

test('turn and presence states are deterministic and bounded',async()=>{
  const locomotion=await import('../site/world3d/locomotion.mjs');
  assert.equal(locomotion.turnState(.7),'turn_left');
  assert.equal(locomotion.turnState(-.7),'turn_right');
  assert.equal(locomotion.normalizePresenceState('walk_stop'),'walk_stop');
  assert.equal(locomotion.normalizePresenceState('teleport'),'idle');
  assert.equal(locomotion.normalizeNetworkSpeed(999),6);
});
