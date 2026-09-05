const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');

test('atmosphere updates texture, Color, and absent backgrounds without replacing sky ownership', async () => {
  const {CityAtmosphere} = await import('../site/world3d/city-atmosphere.mjs');
  global.window = {worldClock:{hour:10,day:1}};
  for(const background of [new THREE.Texture(),new THREE.Color(0),null]) {
    const scene = new THREE.Scene();scene.background=background;scene.fog=new THREE.Fog(0,1,10);
    const engine={scene,zone:{id:'test',profile:{kit:'road'}},actor:{position:new THREE.Vector3()},
      canvas:{dataset:{}},camera:new THREE.PerspectiveCamera(),renderer:{toneMappingExposure:1}};
    const atmosphere=new CityAtmosphere(engine).initialize();
    const oldFog=scene.fog.color.clone();
    for(let i=0;i<4;i++)atmosphere.update(.1,i*.1);
    assert.equal(scene.background,background);
    assert.equal(scene.fog.color.equals(oldFog),false);
    atmosphere.dispose();
  }
  delete global.window;
});

async function runtimeFixture(){
  const {WorldEngine}=await import('../site/world3d/world-engine.js');
  const engine=new WorldEngine({canvas:{dataset:{}},overlay:{},zoneFactory:()=>{},character:{}});
  const events=[],scheduled=[],errors=[];
  global.document={hidden:false};global.requestAnimationFrame=fn=>{scheduled.push(fn);return scheduled.length;};global.cancelAnimationFrame=()=>{};
  engine.running=true;engine.clock={getDelta:()=>.05,elapsedTime:1};
  engine.actor={position:new THREE.Vector3(),classProfile:{action:'Attack'},update:()=>events.push('movement')};
  engine.npcManager={update:()=>events.push('interaction')};
  engine.combatController={active:false,update:()=>events.push('combat')};
  engine.chronicleAdapter={update:()=>events.push('dialogue')};
  engine.controls={target:new THREE.Vector3(),update:()=>events.push('camera')};
  engine.camera=new THREE.PerspectiveCamera();engine.renderer={render:()=>events.push('render')};engine.scene=new THREE.Scene();
  engine.updateCameraPan=()=>{};engine.updateVitals=()=>{};engine.updateWorldLabels=()=>{};
  engine.health.report=entry=>{errors.push(entry);if(entry.fatal)engine.stop();};
  return{engine,events,scheduled,errors};
}

test('real world frame keeps movement, interaction, dialogue, combat, camera and rendering alive after optional failure', async()=>{
  const {engine,events,scheduled,errors}=await runtimeFixture();
  let attempts=0;engine.cityAtmosphere={update:()=>{attempts++;throw Error('Injected atmosphere failure');}};
  engine.frame();engine.frame();engine.combatController.active=true;engine.frame();
  assert.equal(attempts,1);assert.equal(errors.length,1);assert.equal(errors[0].fatal,false);
  for(const name of ['movement','dialogue','combat','camera','render'])assert.equal(events.filter(e=>e===name).length,3);
  assert.equal(events.filter(e=>e==='interaction').length,2);assert.equal(scheduled.length,3);
});

test('failed post-processing falls back to the direct renderer on this and subsequent frames',async()=>{
  const {engine,events,errors}=await runtimeFixture();
  engine.postProcessing={render:()=>{throw Error('Injected compositor failure');}};
  engine.frame();engine.frame();
  assert.equal(events.filter(e=>e==='render').length,2);assert.equal(errors.length,1);
  assert.equal(engine.health.disabled.has('post-processing'),true);
});

test('core failure is reported once and is not retried or silently bypassed',async()=>{
  const {engine,events,scheduled,errors}=await runtimeFixture();
  engine.combatController.update=()=>{throw Error('Injected combat mutation failure');};
  engine.frame();engine.frame();
  assert.equal(engine.health.fatal,true);assert.equal(errors.length,1);assert.equal(scheduled.length,0);
  assert.equal(events.includes('render'),false);
});

test('hidden tabs schedule another frame without advancing gameplay',async()=>{
  const {engine,events,scheduled}=await runtimeFixture();document.hidden=true;
  engine.frame();assert.equal(events.length,0);assert.equal(scheduled.length,1);
});

test('runtime failure prevents manual and automatic saves from overwriting checkpoints',()=>{
  const source=fs.readFileSync(require.resolve('../site/saves.js'),'utf8');
  const start=source.indexOf('function saveGame('),end=source.indexOf('\nfunction ',start+1);
  let touched=false;
  const sandbox={window:{__worldRuntimeFailure:{fatal:true}},toast:()=>{},buildSaveSlot:()=>{touched=true;throw Error('Must not snapshot failed state');}};
  vm.runInNewContext(source.slice(start,end),sandbox);
  for(const type of ['solo','autosave','session_resume'])assert.equal(sandbox.saveGame('test',type,true),null);
  assert.equal(touched,false);
});
