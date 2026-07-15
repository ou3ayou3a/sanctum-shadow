'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Presence=require('../lib/world-presence.js');

test('3D party positions are finite, bounded, and presentation-only',()=>{
  assert.equal(Presence.normalizeWorldPosition(null),null);
  assert.equal(Presence.normalizeWorldPosition({x:NaN,z:2,locationId:'vaelthar_city'}),null);
  const normalized=Presence.normalizeWorldPosition({x:999,z:-999,rotation:Math.PI*5,state:'run',speed:99,locationId:'vaelthar_city<script>'});
  assert.equal(normalized.x,100);assert.equal(normalized.z,-100);assert.equal(normalized.state,'run');assert.equal(normalized.speed,6);assert.equal(normalized.locationId,'vaelthar_cityscript');assert.ok(Math.abs(normalized.rotation-Math.PI)<1e-12);
});

test('unknown animation states fall back to idle and invalid locations are rejected',()=>{
  assert.equal(Presence.normalizeWorldPosition({x:1,z:2,state:'fly',locationId:'!!!'}),null);
  assert.equal(Presence.normalizeWorldPosition({x:1,z:2,state:'fly',locationId:'thornwood_passage'}).state,'idle');
  assert.equal(Presence.normalizeWorldPosition({x:1,z:2,state:'turn_left',speed:0,locationId:'thornwood_passage'}).state,'turn_left');
});
