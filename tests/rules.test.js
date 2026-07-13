'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('../site/rules.js');

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('ability modifiers and proficiency bonus follow 5e progression', () => {
  assert.equal(Rules.abilityModifier(8), -1);
  assert.equal(Rules.abilityModifier(10), 0);
  assert.equal(Rules.abilityModifier(18), 4);
  assert.equal(Rules.proficiencyBonus(1), 2);
  assert.equal(Rules.proficiencyBonus(5), 3);
  assert.equal(Rules.proficiencyBonus(9), 4);
  assert.equal(Rules.proficiencyBonus(17), 6);
  assert.deepEqual(Rules.getClassSavingThrows('rogue'), ['dex','int']);
  assert.equal(Rules.getAttackAbility('ranger'), 'dex');
  assert.equal(Rules.getAttackAbility('warrior'), 'str');
});

test('skill and DC inference are stable', () => {
  assert.equal(Rules.inferSkill('I sneak silently past the watch'), 'stealth');
  assert.equal(Rules.inferSkill('Search the wreckage for a clue'), 'investigation');
  assert.equal(Rules.inferDC('Open the impossible ancient seal', 'arcana'), 18);
  assert.equal(Rules.inferDC('Sneak past the sentry', 'stealth'), 13);
});

test('a seeded check is reproducible', () => {
  const options = {
    text:'Search the altar', seed:'campaign-42:turn-3', dc:14,
    character:{ class:'mage', level:5, stats:{ int:16 }, proficiencies:['investigation'] },
  };
  assert.deepEqual(Rules.rollCheck(options), Rules.rollCheck(options));
});

test('advantage and disadvantage select the correct die and cancel each other', () => {
  const character = { stats:{ dex:10 }, proficiencies:[] };
  const advantage = Rules.rollCheck({ text:'Sneak', skill:'stealth', dc:10, character, advantage:true, rng:sequence(0.1, 0.9) });
  assert.deepEqual(advantage.rolls, [3, 19]);
  assert.equal(advantage.roll, 19);
  assert.equal(advantage.mode, 'advantage');

  const disadvantage = Rules.rollCheck({ text:'Sneak', skill:'stealth', dc:10, character, disadvantage:true, rng:sequence(0.1, 0.9) });
  assert.equal(disadvantage.roll, 3);
  assert.equal(disadvantage.mode, 'disadvantage');

  const cancelled = Rules.rollCheck({ text:'Sneak', skill:'stealth', dc:10, character, advantage:true, disadvantage:true, rng:sequence(0.5) });
  assert.deepEqual(cancelled.rolls, [11]);
  assert.equal(cancelled.mode, 'normal');
});

test('checks combine ability, proficiency, DC, and natural die rules', () => {
  const character = { class:'rogue', level:5, stats:{ dex:16 }, proficiencies:['stealth'] };
  const normal = Rules.rollCheck({ text:'Sneak', skill:'stealth', dc:17, character, rng:sequence(0.5) });
  assert.equal(normal.roll, 11);
  assert.equal(normal.abilityMod, 3);
  assert.equal(normal.proficiency, 3);
  assert.equal(normal.total, 17);
  assert.equal(normal.success, true);

  const naturalOne = Rules.rollCheck({ text:'Sneak', skill:'stealth', dc:2, character, rng:sequence(0) });
  assert.equal(naturalOne.fumble, true);
  assert.equal(naturalOne.success, false);

  const naturalTwenty = Rules.rollCheck({ text:'Sneak', skill:'stealth', dc:99, character, rng:sequence(0.999) });
  assert.equal(naturalTwenty.crit, true);
  assert.equal(naturalTwenty.success, true);
});

test('conditions deterministically affect roll mode without mutating the character', () => {
  const inspired = { stats:{ wis:10 }, proficiencies:[], conditions:['inspired'] };
  const check = Rules.rollCheck({ text:'Look around', skill:'perception', dc:10, character:inspired, rng:sequence(0.2, 0.8) });
  assert.equal(check.mode, 'advantage');
  assert.equal(check.consumeCondition, 'inspired');
  assert.deepEqual(inspired.conditions, ['inspired']);

  const poisoned = Rules.rollCheck({ text:'Look around', skill:'perception', dc:10, character:{ ...inspired, conditions:['poisoned'] }, rng:sequence(0.2, 0.8) });
  assert.equal(poisoned.mode, 'disadvantage');
});

test('dice formulas support stat modifiers and double only dice on a critical', () => {
  const normal = Rules.rollFormula('1d8+STR', { statMods:{ str:3 }, rng:sequence(0.5) });
  assert.deepEqual(normal.dice, [5]);
  assert.equal(normal.total, 8);

  const critical = Rules.rollFormula('1d8+STR', { statMods:{ str:3 }, critical:true, rng:sequence(0, 0.999) });
  assert.deepEqual(critical.dice, [1, 8]);
  assert.equal(critical.total, 12, 'ability modifier is added once');
  assert.throws(() => Rules.rollFormula('2d6 times two'), /Invalid dice formula/);
});

test('attack resolution enforces armor class, natural 1, natural 20, and combat conditions', () => {
  const hit = Rules.resolveAttack({ attackBonus:5, targetAC:15, rng:sequence(0.5) });
  assert.equal(hit.total, 16);
  assert.equal(hit.hit, true);

  const fumble = Rules.resolveAttack({ attackBonus:99, targetAC:5, rng:sequence(0) });
  assert.equal(fumble.fumble, true);
  assert.equal(fumble.hit, false);

  const crit = Rules.resolveAttack({ attackBonus:-5, targetAC:99, rng:sequence(0.999) });
  assert.equal(crit.crit, true);
  assert.equal(crit.hit, true);

  const poisoned = Rules.resolveAttack({
    attackBonus:5, targetAC:15, attackerConditions:['poisoned'], rng:sequence(0.9, 0.1),
  });
  assert.equal(poisoned.mode, 'disadvantage');
  assert.equal(poisoned.roll, 3);
});

test('initiative and saving throws use the same deterministic d20 mechanics', () => {
  const initiative = Rules.rollInitiative({ bonus:3, seed:'round-one' });
  assert.deepEqual(initiative, Rules.rollInitiative({ bonus:3, seed:'round-one' }));

  const save = Rules.resolveSavingThrow({
    ability:'con', dc:15, seed:'save-one',
    character:{ level:5, stats:{ con:16 }, savingThrowProficiencies:['con'] },
  });
  assert.equal(save.abilityMod, 3);
  assert.equal(save.proficiency, 3);
  assert.equal(save.success, save.roll + 6 >= 15);
});
