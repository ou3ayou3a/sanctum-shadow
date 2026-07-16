'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Tactical=require('../site/tactical-combat.js');

test('attack ranges are deterministic by tactical role',()=>{
  assert.equal(Tactical.attackRange({tacticalRole:'frontline'}),2.75);
  assert.equal(Tactical.attackRange({name:'Church Crossbowman'}),10);
  assert.equal(Tactical.validateAttack({tacticalRole:'frontline',position:{x:0,z:0}},{hp:10,position:{x:2.4,z:0}}).ok,true);
  assert.equal(Tactical.validateAttack({tacticalRole:'frontline',position:{x:0,z:0}},{hp:10,position:{x:3,z:0}}).reason,'out_of_range');
});

test('cover applies only when it lies between attacker and target',()=>{
  const attacker={position:{x:0,z:0}},target={hp:10,position:{x:0,z:6}};
  assert.equal(Tactical.coverBonus(attacker,target,[{x:0,z:5,radius:.7,type:'half'}]),2);
  assert.equal(Tactical.coverBonus(attacker,target,[{x:2,z:5,radius:.7,type:'half'}]),0);
});

test('movement rejects teleports and battlefield escapes',()=>{
  assert.equal(Tactical.validateMove({x:0,z:0},{x:4,z:0}).ok,true);
  assert.equal(Tactical.validateMove({x:0,z:0},{x:8,z:0}).reason,'out_of_range');
  assert.equal(Tactical.validateMove({x:10,z:0},{x:13,z:0}).reason,'outside_battlefield');
});
