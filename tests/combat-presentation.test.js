'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CombatPresentation=require('../site/combat-presentation.js');

test('every class has deterministic weapon-specific animation and impact timing',()=>{
  const expected={warrior:'attack_heavy',paladin:'attack_smite',cleric:'staff_strike',mage:'cast',rogue:'attack_dual',ranger:'bow_shot'};
  for(const[classId,clip]of Object.entries(expected)){
    const profile=CombatPresentation.profileFor({combatant:{characterClass:classId}});
    assert.equal(profile.classId,classId);
    assert.equal(profile.clip,clip);
    assert.ok(profile.impactDelay>0&&profile.impactDelay<profile.recoveryDelay);
  }
});

test('spell presentations sanitize data and select effects without accepting arbitrary types',()=>{
  const lightning=CombatPresentation.event({seq:4,actor:{id:'mage',characterClass:'mage'},target:{id:'orc'},action:'spell',spell:{id:'chain_lightning',name:'Chain Lightning',type:'lightning'},hit:true,damage:18});
  assert.equal(lightning.id,'combat-4');
  assert.equal(lightning.effect,'lightning');
  assert.equal(lightning.damageType,'lightning');
  assert.equal(lightning.damage,18);
  const unsafe=CombatPresentation.profileFor({combatant:{characterClass:'mage'},action:'spell',spell:{id:'<script>',type:'prototype_pollution'}});
  assert.equal(unsafe.damageType,'arcane');
  assert.equal(unsafe.spell.id,'script');
});

test('enemy classes and miss reactions are inferred deterministically',()=>{
  assert.equal(CombatPresentation.inferClass({name:'Ashen Archer'}),'ranger');
  assert.equal(CombatPresentation.inferClass({name:'Royal Guard'}),'paladin');
  assert.equal(CombatPresentation.missReaction({id:'guard',name:'Royal Guard'},'combat-3'),'block');
  assert.equal(CombatPresentation.missReaction({id:'shade',name:'Rogue Assassin'},'combat-3'),CombatPresentation.missReaction({id:'shade',name:'Rogue Assassin'},'combat-3'));
});

test('3D and multiplayer combat consume authoritative timed presentations',()=>{
  const project=path.join(__dirname,'..');
  const controller=fs.readFileSync(path.join(project,'site/world3d/combat-controller.js'),'utf8');
  const multiplayer=fs.readFileSync(path.join(project,'site/multiplayer.js'),'utf8');
  const server=fs.readFileSync(path.join(project,'server.js'),'utf8');
  assert.match(controller,/playCombatAction/);
  assert.match(controller,/presentAuthoritativeUpdate/);
  assert.match(controller,/abilityEffects\?\.present/);
  assert.match(controller,/missReaction/);
  assert.doesNotMatch(controller,/combatAttack\?\.\(\),420/);
  assert.match(multiplayer,/presentation,apply/);
  assert.match(server,/CombatPresentation\.event/);
  assert.match(server,/presentation, log/);
});
