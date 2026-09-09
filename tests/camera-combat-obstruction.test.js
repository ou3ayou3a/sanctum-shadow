const test=require('node:test');
const assert=require('node:assert/strict');

async function fixture(quality='medium'){
  const THREE=await import('three');
  const {CameraObstruction}=await import('../site/world3d/camera-obstruction.mjs');
  const root=new THREE.Group(),camera=new THREE.PerspectiveCamera();
  camera.position.set(0,2,10);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  // This wall blocks the enemy, but is nowhere near the focus ray.
  const wall=new THREE.Mesh(new THREE.BoxGeometry(1.6,3,.3),new THREE.MeshBasicMaterial());
  wall.name='stone-wall';wall.position.set(3,1.5,5);root.add(wall);
  const actor=new THREE.Group();actor.position.set(6,0,0);root.add(actor);root.updateMatrixWorld(true);
  const record={actor,combatant:{hp:20,isPlayer:false}};
  const engine={zone:{root},camera,controls:{target:new THREE.Vector3(0,1,0)},worldPolish:{quality},combatController:{active:true,state:()=>({selectedTarget:'boss'}),records:new Map([['boss',record]])}};
  return{engine,wall,record,obstruction:new CameraObstruction(engine)};
}

for(const quality of ['low','medium','high'])test(`combat obstruction protects an enemy outside camera focus on ${quality}`,async()=>{
  const {engine,wall,obstruction}=await fixture(quality);
  engine.combatController.active=false;obstruction.update(.2);assert.equal(obstruction.blocked.has(wall),false);
  engine.combatController.active=true;obstruction.update(.2);assert.equal(obstruction.blocked.get(wall)?.target,.045);
  obstruction.update(.2);assert.ok(wall.material.opacity<.2);obstruction.dispose();
});

test('combat-only wall fades restore when combat ends',async()=>{
  const {engine,wall,obstruction}=await fixture();const original=wall.material;
  obstruction.update(.2);obstruction.update(.2);engine.combatController.active=false;
  for(let i=0;i<10;i++)obstruction.update(.2);
  assert.equal(wall.material,original);assert.equal(obstruction.blocked.size,0);obstruction.dispose();
});

test('dead or hidden combatants do not reveal walls',async()=>{
  const {record,wall,obstruction}=await fixture();record.combatant.hp=0;obstruction.update(.2);
  assert.equal(obstruction.blocked.has(wall),false);record.combatant.hp=20;record.actor.visible=false;obstruction.update(.2);
  assert.equal(obstruction.blocked.has(wall),false);obstruction.dispose();
});
