const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../site');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('cinematic policy defines bounded shots for every supported gameplay moment',async()=>{
  const{CINEMATIC_KINDS,cinematicShotFor,cinematicDurationFor}=await import('../site/world3d/cinematic-policy.mjs');
  assert.deepEqual(CINEMATIC_KINDS,['environment','combat_intro','attack','spell','finisher','victory']);
  for(const kind of CINEMATIC_KINDS){assert.ok(cinematicShotFor(kind));assert.ok(cinematicDurationFor(kind)>=.7);assert.ok(cinematicDurationFor(kind,true)<=.28);}
});

test('director supports dialogue coverage, transient moments, impact, and smooth restoration',()=>{
  const director=read('world3d/cinematic-director.js');
  for(const shot of['wide','two','player','npc','combat_wide','attack','spell','finisher','victory'])assert.match(director,new RegExp(`['"]${shot}['"]`));
  assert.match(director,/playMoment\(/);assert.match(director,/addImpact\(/);assert.match(director,/phase='restoring'/);assert.match(director,/camera\.position\.lerp\(this\.saved\.camera/);assert.match(director,/controls\.enabled=saved\.controlsEnabled/);
});

test('environment, quest, and combat systems trigger cinematic moments',()=>{
  const world=read('world3d/world-engine.js'),chronicle=read('world3d/chronicle-adapter.js'),combat=read('world3d/combat-controller.js');
  assert.match(world,/playMoment\('environment'/);assert.match(chronicle,/playMoment\('victory'/);
  for(const kind of['combat_intro','finisher','victory'])assert.match(combat,new RegExp(`playMoment\\('${kind}'`));
  assert.match(combat,/action==='spell'\?'spell':'attack'/);
  assert.match(combat,/addImpact\(dead \? \.15 : \.075\)/);assert.match(combat,/ROLL FOR INITIATIVE/);
});

test('quest markers fall back to each generic zone interaction point',()=>{
  const chronicle=read('world3d/chronicle-adapter.js');
  assert.match(chronicle,/entry\.id==='location_focus'/);
  assert.match(chronicle,/return fallback\?\{position:fallback\.position,interaction:fallback\}:null/);
});

test('Mol objective interaction resumes the first incomplete authored scene',()=>{
  const zone=read('world3d/zones/generic-zone.js');
  assert.match(zone,/activeQuestIncomplete\('c1q5','find_aldran'\).*mol_village_arrival/);
  assert.match(zone,/activeQuestIncomplete\('c1q5','hear_truth'\).*aldran_meeting/);
  assert.match(zone,/activeQuestIncomplete\('c1q5','decide_fate'\).*aldran_church_soldiers/);
  assert.match(zone,/interactionSceneFor\(location,profile\)/);
});

test('cinematic presentation adds letterboxing, captions, and reduced-motion behavior',()=>{
  const css=read('world3d.css');assert.match(css,/world3d-moment-active/);assert.match(css,/world3d-cinematic-caption/);assert.match(css,/ui-reduce-motion \.world3d-cinematic-caption/);
});

test('3D exploration keeps vitality and recovery visible before combat',()=>{
  const world=read('world3d/world-engine.js'),css=read('world3d.css');
  assert.match(world,/className='world3d-vitals'/);assert.match(world,/updateVitals\(force=false\)/);assert.match(world,/Rest at Camp/);assert.match(world,/hpPercent<=50/);assert.match(world,/this\.updateVitals\(\)/);
  assert.match(css,/\.world3d-vitals/);assert.match(css,/\.world3d-vitals\.critical/);assert.match(css,/body\.ui-reduce-motion \.world3d-vitals\.critical/);
});
