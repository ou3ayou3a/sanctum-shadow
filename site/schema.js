// Sanctum & Shadow — versioned save and shared-campaign schemas.
(function (root, factory) {
  const api = factory(root?.SanctumRules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SanctumSchema = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (browserRules) {
  'use strict';
  const rules = browserRules || (typeof require === 'function' ? require('./rules.js') : null);
  const SAVE_SCHEMA_VERSION = 5;
  const CAMPAIGN_SCHEMA_VERSION = 1;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = value => Array.isArray(value) ? value : [];

  function migrateSaveSlot(input) {
    const slot = object(clone(input));
    const character = object(slot.character);
    const gameState = object(slot.gameState);
    slot.character = {
      ...character,
      level:Math.max(1, Number(character.level) || 1),
      stats:object(character.stats), skills:object(character.skills),
      equipped:{ weapon:null, armor:null, accessory:null, ...object(character.equipped) },
      inventory:array(character.inventory), spells:array(character.spells),
      personalQuests:array(character.personalQuests), conditions:array(character.conditions),
      proficiencies:Array.isArray(character.proficiencies)
        ? character.proficiencies : (rules?.getClassProficiencies(character.class) || ['perception']),
      savingThrowProficiencies:Array.isArray(character.savingThrowProficiencies)
        ? character.savingThrowProficiencies : (rules?.getClassSavingThrows(character.class) || []),
      questRewardsClaimed:array(character.questRewardsClaimed),
    };
    slot.gameState = {
      ...gameState,
      chapter:Math.max(1, Number(gameState.chapter || slot.chapter) || 1),
      activeQuests:array(gameState.activeQuests), completedQuests:array(gameState.completedQuests),
      questProgress:object(gameState.questProgress), world3dPositions:object(gameState.world3dPositions), log:array(gameState.log),
    };
    slot.sceneFlags = object(slot.sceneFlags);
    slot.sceneHistory = array(slot.sceneHistory);
    slot.knownFacts = object(slot.knownFacts);
    slot.npcStates = object(slot.npcStates);
    slot.currentScene = slot.currentScene || 'arrival_vaelthar';
    slot.mapState = { currentLocation:'vaelthar_city', ...object(slot.mapState) };
    slot.worldClock = { hour:8, day:1, ...object(slot.worldClock) };
    slot.reputation = object(slot.reputation);
    slot.schemaVersion = SAVE_SCHEMA_VERSION;
    return slot;
  }

  function migrateSaveEnvelope(input) {
    const envelope = object(clone(input));
    return {
      ...envelope,
      schemaVersion:SAVE_SCHEMA_VERSION,
      slots:array(envelope.slots).map(migrateSaveSlot),
    };
  }

  function migrateCampaignState(input) {
    const state = object(clone(input));
    const scene = object(state.scene);
    const map = object(state.map);
    return {
      ...state,
      schemaVersion:CAMPAIGN_SCHEMA_VERSION,
      version:Number(state.version) || 0,
      chapter:Math.max(1, Number(state.chapter) || 1),
      activeQuests:array(state.activeQuests), completedQuests:array(state.completedQuests),
      questProgress:object(state.questProgress), reputation:object(state.reputation),
      worldClock:{ hour:8, day:1, ...object(state.worldClock) },
      scene:{
        ...scene, currentScene:scene.currentScene || 'arrival_vaelthar',
        flags:object(scene.flags), knownFacts:object(scene.knownFacts),
        npcStates:object(scene.npcStates), history:array(scene.history),
      },
      map:{ ...map, currentLocation:map.currentLocation || 'vaelthar_city', discovered:array(map.discovered) },
    };
  }

  return Object.freeze({ SAVE_SCHEMA_VERSION, CAMPAIGN_SCHEMA_VERSION, migrateSaveSlot, migrateSaveEnvelope, migrateCampaignState });
});
