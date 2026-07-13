'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PartyRules = require('../lib/party-rules.js');

function player(id, overrides = {}) {
  return { id, name:id, connected:true, ready:true, character:{ name:id }, ...overrides };
}

test('multiplayer capacity is constrained to supported 2–8 player parties', () => {
  assert.equal(PartyRules.normalizeMaxPlayers(undefined), 4);
  assert.equal(PartyRules.normalizeMaxPlayers(1), 2);
  assert.equal(PartyRules.normalizeMaxPlayers(6), 6);
  assert.equal(PartyRules.normalizeMaxPlayers(99), 8);
});

test('campaign readiness considers connected players and ignores disconnected ghosts', () => {
  const session = { players:{
    a:player('a'), b:player('b'),
    ghost:player('ghost', { connected:false, ready:false, character:null }),
  } };
  assert.equal(PartyRules.connectedPlayers(session).length, 2);
  assert.equal(PartyRules.canStartCampaign(session), true);
  session.players.b.ready = false;
  assert.equal(PartyRules.canStartCampaign(session), false);
});

test('encounters scale predictably for 3–8 players without mutating source enemies', () => {
  const source = [{ name:'Cultist', hp:30, maxHp:30, ac:12, atk:4, xp:70 }];
  const trio = PartyRules.scaleEncounter(source, 3)[0];
  const fullParty = PartyRules.scaleEncounter(source, 8)[0];
  assert.equal(source[0].hp, 30);
  assert.ok(trio.hp > source[0].hp);
  assert.ok(fullParty.hp > trio.hp);
  assert.ok(fullParty.partyScale <= 4);
  assert.ok(fullParty.ac <= source[0].ac + 2);
  assert.ok(fullParty.atk <= source[0].atk + 2);
});

test('reconnecting players are atomically re-keyed in combat and turn order', () => {
  const state = {
    combatants:{ old:{ id:'old', playerId:'old', isPlayer:true, hp:20 }, enemy:{ id:'enemy', isPlayer:false, hp:10 } },
    turnOrder:['enemy','old'], currentTurnIndex:1,
  };
  assert.equal(PartyRules.rekeyCombatant(state, 'old', 'new'), true);
  assert.equal(state.combatants.old, undefined);
  assert.equal(state.combatants.new.id, 'new');
  assert.equal(state.combatants.new.playerId, 'new');
  assert.deepEqual(state.turnOrder, ['enemy','new']);
  assert.equal(state.turnOrder[state.currentTurnIndex], 'new');
});
