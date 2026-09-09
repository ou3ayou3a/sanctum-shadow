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

test('full cover blocks shots from either end of a segment',()=>{
 const a={position:{x:0,z:0},tacticalRole:'ranged'},b={hp:10,position:{x:0,z:6}};
 for(const z of [1,5])assert.equal(Tactical.validateAttack(a,b,{cover:[{x:0,z,radius:.5,type:'full'}]}).reason,'blocked_line_of_sight');
 assert.equal(Tactical.validateAttack(a,b,{cover:[{x:0,z:3,radius:.5,type:'half'}]}).ok,true);
 assert.equal(Tactical.lineOfSight(a,b,{obstacles:[{x:0,z:3,hw:2,hd:.2}]}),false);
});

test('movement uses traversable distance and never projects an occupied destination',()=>{
 const from={x:-2,z:0},to={x:2,z:0},obstacles=[{x:0,z:0,hw:.4,hd:1}];
 const short=Tactical.validateMove(from,to,{obstacles,maxDistance:4.5});assert.equal(short.reason,'path_out_of_range');
 const long=Tactical.validateMove(from,to,{obstacles,maxDistance:8});assert.equal(long.ok,true);assert.ok(long.distance>4.5);
 const grid=Tactical.navigation({obstacles});for(let i=1;i<long.path.length;i++)assert.equal(grid.hasLineOfSight(long.path[i-1],long.path[i]),true);
 assert.equal(Tactical.validateMove(from,to,{occupied:[{...to,radius:.5}]}).reason,'occupied_or_blocked');
});

test('world collision snapshots are bounded and copied',()=>{
 const source={locationId:'tarnished_cup',origin:{x:0,z:0},obstacles:[]};
 const snapshot=Tactical.sanitizeSnapshot(source);assert.ok(snapshot.obstacles.length>4);source.origin.x=9;assert.equal(snapshot.origin.x,0);
 assert.equal(Tactical.sanitizeSnapshot({locationId:'forged',origin:{x:0,z:0}}),null);
 assert.equal(Tactical.sanitizeSnapshot({locationId:'tarnished_cup',origin:{x:500,z:0}}),null);
});
