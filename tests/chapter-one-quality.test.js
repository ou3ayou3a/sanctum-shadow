'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('every Chapter I destination owns an authored presentation identity',async()=>{
  const profiles=await import('../site/world3d/zones/zone-profiles.mjs');
  const quality=await import('../site/world3d/chapter-one-quality.mjs');
  assert.deepEqual(Object.keys(quality.CHAPTER_ONE_IDENTITIES).sort(),[...profiles.CHAPTER_ONE_ZONE_IDS].sort());
  for(const id of profiles.CHAPTER_ONE_ZONE_IDS){assert.ok(quality.CHAPTER_ONE_IDENTITIES[id].name);assert.ok(quality.CHAPTER_ONE_IDENTITIES[id].mark);}
});

test('generic Chapter I zones use textured terrain and authored identity dressing',()=>{
  const generic=read('site/world3d/zones/generic-zone.js'),quality=read('site/world3d/chapter-one-quality.mjs');
  assert.match(generic,/createChapterOneQuality/);
  assert.match(generic,/new THREE\.PlaneGeometry\(52,52,32,32\)/);
  assert.doesNotMatch(generic,/new THREE\.CircleGeometry\(26,64\)/);
  for(const feature of['arrival-marker','authored-road-edge-markers','authored-road-wear-and-debris','zone-atmosphere','materials.material'])assert.match(quality,new RegExp(feature.replace('.','\\.')));
});

test('game-wide dialogue, combat, camera, and interaction systems remain engine-owned',()=>{
  const engine=read('site/world3d/world-engine.js');
  for(const system of['NPCManager','Combat3DController','CameraObstruction','Chronicle3DAdapter','resolveEnvironmentalAction'])assert.match(engine,new RegExp(system));
});
