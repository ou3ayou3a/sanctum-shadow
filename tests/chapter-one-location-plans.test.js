'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','site');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('every non-dedicated Chapter I destination owns a unique authored scene plan',async()=>{
  const[{CHAPTER_ONE_ZONE_IDS},{CHAPTER_ONE_LOCATION_PLANS,AUTHORED_CHAPTER_ONE_LOCATION_IDS}]=await Promise.all([
    import('../site/world3d/zones/zone-profiles.mjs'),
    import('../site/world3d/chapter-one-location-plans.mjs'),
  ]);
  const expected=CHAPTER_ONE_ZONE_IDS.filter(id=>!['vaelthar_city','tarnished_cup'].includes(id)).sort();
  assert.deepEqual([...AUTHORED_CHAPTER_ONE_LOCATION_IDS].sort(),expected);
  const signatures=new Set();
  for(const id of expected){
    const plan=CHAPTER_ONE_LOCATION_PLANS[id];
    assert.ok(plan,`${id} has no authored scene plan`);
    assert.ok(plan.signature.length>=8,`${id} has no readable signature`);
    assert.ok(!signatures.has(plan.signature),`${id} reuses ${plan.signature}`);signatures.add(plan.signature);
    assert.ok(plan.props.length>=6,`${id} lacks authored environmental detail`);
    if(!plan.interior)assert.ok(plan.assets.length>=2,`${id} lacks a production landmark composition`);
  }
});

test('authored plans only reference production assets shipped by the game',async()=>{
  const[{CHAPTER_ONE_LOCATION_PLANS},{PRODUCTION_ASSETS}]=await Promise.all([
    import('../site/world3d/chapter-one-location-plans.mjs'),
    import('../site/world3d/production-assets.mjs'),
  ]);
  for(const[id,plan]of Object.entries(CHAPTER_ONE_LOCATION_PLANS))for(const placement of plan.assets||[]){
    assert.ok(PRODUCTION_ASSETS[placement.id],`${id} references missing production asset ${placement.id}`);
    assert.equal(placement.size.length,3,`${id}:${placement.id} has an invalid size`);
  }
});

test('the generic zone applies and animates location-authored dressing without changing authority',()=>{
  const generic=read('world3d/zones/generic-zone.js'),dressing=read('world3d/chapter-one-location-dressing.mjs');
  assert.match(generic,/createChapterOneLocationDressing/);
  assert.match(generic,/locationDressing\?\.update/);
  assert.match(generic,/locationDressing\?\.dispose/);
  assert.match(dressing,/authored-location:/);
  assert.match(dressing,/locationSignature/);
  assert.match(dressing,/authoredDetailCount/);
  assert.doesNotMatch(dressing,/socket\.emit|gameState|questProgress|resolveEnvironmentalAction/);
});
