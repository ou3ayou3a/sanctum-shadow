'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');

test('the shared animation policy owns safe gestures, equipment timing, and ambient roles',async()=>{
  const policy=await import('../site/world3d/animation-policy.mjs');
  for(const gesture of['talk','work','drink','attack_heavy','attack_dual','staff_strike'])assert.equal(policy.normalizeGesture(gesture),gesture);
  assert.equal(policy.normalizeGesture('__proto__'),null);
  assert.ok(policy.equipmentSwapFraction('weapon_draw')<policy.equipmentSwapFraction('weapon_sheathe'));
  assert.equal(policy.ambientRole({title:'Blacksmith'}),'worker');
  assert.equal(policy.ambientRole({title:'Royal Guard'}),'guard');
  assert.equal(policy.ambientGesture({title:'Tavern Server'},1),'drink');
});

test('characters use full-body authored clips, timed equipment swaps, trails, and recoil',()=>{
  const actor=read('site/world3d/character-actor.js'),builder=read('tools/blender/build_visual_library.py'),equipment=read('site/world3d/class-equipment.js');
  for(const clip of['attack_heavy','attack_dual','staff_strike','talk','work','drink'])assert.match(actor,new RegExp(clip));
  assert.match(actor,/equipmentSwapFraction\(transition\)/);
  assert.match(actor,/combat:weapon-trail/);
  assert.match(actor,/applyImpactReaction/);
  assert.match(builder,/for bone in bones:/);
  assert.match(builder,/raised-arm\/T-pose artifacts/);
  assert.match(equipment,/classPoseBase/);
});

test('NPC ambience and multiplayer exploration gestures use the same actor state machine',()=>{
  const npc=read('site/world3d/npc-manager.js'),party=read('site/world3d/party-manager.js'),presence=read('lib/world-presence.js');
  assert.match(npc,/ambientGesture/);assert.match(npc,/ambientDelay/);
  assert.match(party,/playNetworkGesture/);assert.match(party,/gestureSeq/);
  assert.match(presence,/GESTURES/);assert.match(presence,/gestureSeq/);
});
