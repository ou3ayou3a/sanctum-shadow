const test=require('node:test');
const assert=require('node:assert/strict');
async function fixture(aspect=1.2){
  const THREE=await import('three'),{CombatCamera,combatCameraFrame}=await import('../site/world3d/combat-camera.mjs');
  const records=[0,-5.5].map(z=>{const actor=new THREE.Group();actor.position.set(0,0,z);actor.updateMatrixWorld();return{actor,combatant:{hp:20}};});
  const camera=new THREE.PerspectiveCamera(45,aspect,.1,100);camera.position.set(0,7,8);
  const engine={camera,controls:{target:new THREE.Vector3(0,1.25,0),maxDistance:18},cameraPanOffset:new THREE.Vector3(2,0,3),combatController:{active:true,records:new Map(records.map((r,i)=>[i,r]))}};
  return{THREE,records,engine,system:new CombatCamera(engine),combatCameraFrame};
}
for(const aspect of [.6,1.2,2])test(`combat framing contains feet and heads at aspect ${aspect}`,async()=>{
  const {THREE,engine,records,system}=await fixture(aspect);const focus=system.update(),delta=focus.clone().sub(engine.controls.target);
  engine.camera.position.add(delta);engine.controls.target.copy(focus);engine.camera.lookAt(focus);engine.camera.updateMatrixWorld();
  for(const record of records)for(const y of [0,2.6]){
    const p=record.actor.position.clone().add(new THREE.Vector3(0,y,0)).project(engine.camera);
    assert.ok(Math.abs(p.x)<.62&&Math.abs(p.y)<.62,JSON.stringify(p));
  }
});
test('combat framing preserves manual zoom/pan after entry and restores exploration settings',async()=>{
  const {engine,system}=await fixture();const originalDistance=engine.camera.position.distanceTo(engine.controls.target);system.update();
  engine.camera.position.multiplyScalar(1.1);engine.cameraPanOffset.set(4,0,2);const position=engine.camera.position.clone();system.update();
  assert.deepEqual(engine.camera.position,position);assert.equal(engine.cameraPanOffset.x,4);
  engine.combatController.active=false;assert.equal(system.update(),null);
  assert.equal(engine.controls.maxDistance,18);assert.ok(Math.abs(engine.camera.position.distanceTo(engine.controls.target)-originalDistance)<1e-8);
  assert.equal(engine.cameraPanOffset.x,2);assert.equal(engine.cameraPanOffset.z,3);
});
test('empty, dead and hidden actors do not become camera targets',async()=>{
  const {records,engine,combatCameraFrame}=await fixture();records[0].combatant.hp=0;records[1].actor.visible=false;
  assert.equal(combatCameraFrame(records,engine.camera),null);
});
