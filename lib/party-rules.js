'use strict';

const MIN_PARTY_SIZE = 2;
const MAX_PARTY_SIZE = 8;

function normalizeMaxPlayers(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 4;
  return Math.max(MIN_PARTY_SIZE, Math.min(MAX_PARTY_SIZE, parsed));
}

function connectedPlayers(session, options = {}) {
  const players = Object.values(session?.players || {}).filter(player => player && player.connected !== false);
  return options.readyOnly ? players.filter(player => player.ready && player.character) : players;
}

function canStartCampaign(session) {
  const connected = connectedPlayers(session);
  return connected.length > 0 && connected.every(player => player.ready && player.character);
}

function encounterScale(partySize, boss = false) {
  const size = Math.max(1, Math.min(MAX_PARTY_SIZE, Number(partySize) || 1));
  return Math.min(4, 1 + (size - 1) * (boss ? 0.45 : 0.35));
}

function scaleEncounter(enemies, partySize) {
  return (Array.isArray(enemies) ? enemies : []).map(enemy => {
    const copy = { ...enemy };
    const scale = encounterScale(partySize, !!copy.boss);
    const hp = Math.max(1, Number(copy.hp) || Number(copy.maxHp) || 10);
    const maxHp = Math.max(hp, Number(copy.maxHp) || hp);
    copy.hp = Math.round(hp * scale);
    copy.maxHp = Math.round(maxHp * scale);
    copy.ac = Math.max(1, (Number(copy.ac) || 10) + Math.min(2, Math.floor((Math.max(1, partySize) - 1) / 4)));
    copy.atk = (Number(copy.atk) || 0) + Math.min(2, Math.floor((Math.max(1, partySize) - 1) / 3));
    copy.attackBonus = copy.atk;
    copy.damageMod = Number(copy.damageMod) || copy.atk;
    copy.xp = Math.max(1, Math.round((Number(copy.xp) || 50) * scale));
    copy.partyScale = scale;
    return copy;
  });
}

function rekeyCombatant(combatState, oldId, newId) {
  if (!combatState || !oldId || !newId || oldId === newId) return false;
  const combatant = combatState.combatants?.[oldId];
  if (!combatant) return false;
  combatant.id = newId;
  if (combatant.isPlayer) combatant.playerId = newId;
  combatState.combatants[newId] = combatant;
  delete combatState.combatants[oldId];
  if (Array.isArray(combatState.turnOrder)) {
    combatState.turnOrder = combatState.turnOrder.map(id => id === oldId ? newId : id);
  }
  return true;
}

module.exports = {
  MIN_PARTY_SIZE, MAX_PARTY_SIZE, normalizeMaxPlayers, connectedPlayers,
  canStartCampaign, encounterScale, scaleEncounter, rekeyCombatant,
};
