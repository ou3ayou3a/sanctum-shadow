'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Schema = require('../site/schema.js');

test('legacy saves migrate without losing character or story data', () => {
  const legacy = {
    id:'old-save', character:{ name:'Nyra', class:'rogue', level:3, stats:{ dex:16 } },
    gameState:{ chapter:2, activeQuests:[{ id:'c1q1' }], log:['kept'] },
    sceneFlags:{ met_varek:true }, customModField:{ keep:true },
  };
  const migrated = Schema.migrateSaveSlot(legacy);
  assert.equal(migrated.schemaVersion, Schema.SAVE_SCHEMA_VERSION);
  assert.equal(migrated.character.name, 'Nyra');
  assert.ok(migrated.character.proficiencies.includes('stealth'));
  assert.deepEqual(migrated.character.savingThrowProficiencies, ['dex','int']);
  assert.deepEqual(migrated.character.questRewardsClaimed, []);
  assert.deepEqual(migrated.character.conditions, []);
  assert.deepEqual(migrated.gameState.questProgress, {});
  assert.deepEqual(migrated.gameState.world3dPositions, {});
  assert.equal(migrated.sceneFlags.met_varek, true);
  assert.deepEqual(migrated.customModField, { keep:true });
  assert.equal(legacy.schemaVersion, undefined, 'migration must not mutate stored input');
});

test('save envelope migration is idempotent and versions every slot', () => {
  const once = Schema.migrateSaveEnvelope({ slots:[{ character:{ class:'mage' }, gameState:{} }] });
  const twice = Schema.migrateSaveEnvelope(once);
  assert.deepEqual(twice, once);
  assert.equal(once.schemaVersion, Schema.SAVE_SCHEMA_VERSION);
  assert.equal(once.slots[0].schemaVersion, Schema.SAVE_SCHEMA_VERSION);
});

test('campaign migration supplies authoritative shared-state defaults', () => {
  const input = { version:42, chapter:3, scene:{ flags:{ gate_open:true } }, map:{ discovered:['temple_quarter'] }, extension:'kept' };
  const state = Schema.migrateCampaignState(input);
  assert.equal(state.schemaVersion, Schema.CAMPAIGN_SCHEMA_VERSION);
  assert.equal(state.version, 42);
  assert.equal(state.chapter, 3);
  assert.equal(state.scene.flags.gate_open, true);
  assert.deepEqual(state.scene.knownFacts, {});
  assert.deepEqual(state.activeQuests, []);
  assert.deepEqual(state.map.discovered, ['temple_quarter']);
  assert.equal(state.extension, 'kept');
});
