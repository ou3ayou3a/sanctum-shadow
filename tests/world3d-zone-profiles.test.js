'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

test('every Chapter I destination has a concrete 3D environment profile',async()=>{const{CHAPTER_ONE_ZONE_IDS,getZoneProfile}=await import('../site/world3d/zones/zone-profiles.mjs');assert.equal(CHAPTER_ONE_ZONE_IDS.length,24);for(const id of CHAPTER_ONE_ZONE_IDS){const profile=getZoneProfile({id,type:'wilderness'});assert.ok(profile.kit);assert.ok(profile.interactionLabel);}});
test('major campaign destinations use distinct environment kits and canonical scenes',async()=>{const{getZoneProfile}=await import('../site/world3d/zones/zone-profiles.mjs');assert.equal(getZoneProfile({id:'thornwood_passage'}).kit,'forest');assert.equal(getZoneProfile({id:'monastery_aldric'}).kit,'monastery');assert.equal(getZoneProfile({id:'tower_ash'}).kit,'tower');assert.equal(getZoneProfile({id:'merchant_road'}).arrivalScene,'merchant_road_investigation');});
