// Sanctum & Shadow — location-aware Chapter I quest entry points.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // Quest introductions are derived from active quest progress. Nothing here is
  // save-only state: reloading can reconstruct which entrance is still waiting.
  const ENTRY = Object.freeze({
    c1q2:  Object.freeze({ scene:'monastery_dungeon_entry', location:'monastery_cellar', objective:'enter_depths', destination:'the hidden dungeon beneath Saint Aldric' }),
    c1q3:  Object.freeze({ scene:'cartographer_missing', location:'thornwood_gate', objective:'accept_search', destination:'Thornwood Gate and Edden’s last known route' }),
    c1q4:  Object.freeze({ scene:'merchant_road_investigation', location:'merchant_road', objective:'inspect_caravans', destination:'the ruined caravans on the Merchant Road' }),
    c1q5:  Object.freeze({ scene:'mol_village_arrival', location:'mol_village', objective:'find_aldran', destination:'Mol and the heretic preacher Aldran' }),
    c1q6:  Object.freeze({ scene:'fortress_harren_arrival', location:'fortress_harren', objective:'reach_fortress', destination:'Sir Harren’s sealed fortress' }),
    c1q7:  Object.freeze({ scene:'well_that_screams_arrival', location:'mol_village', objective:'reach_well', destination:'the old well in Mol' }),
    c1q8:  Object.freeze({ scene:'ambassador_summons', location:'vaelthar_city', landmark:'ostrene_legation', objective:'meet', destination:'the Ostrene Legation on Fennow Row' }),
    c1q9:  Object.freeze({ scene:'treasury_rats_arrival', location:'vaelthar_city', landmark:'royal_treasury', objective:'open_case', destination:'the Royal Treasury beneath the Crown Ward' }),
    c1q10: Object.freeze({ scene:'children_almshouse', location:'vaelthar_city', landmark:'wool_almshouse', objective:'find', destination:'the Wool Almshouse on Cantle Street' }),
    c1q11: Object.freeze({ scene:'condemned_last_words_arrival', location:'vaelthar_city', landmark:'gallows_yard', objective:'gallows', destination:'the Gallows Yard in Southward' }),
    c1q12: Object.freeze({ scene:'mol_tithe_hook', location:'mol_village', objective:'arrive', destination:'Mol on collection day' }),
    c1q13: Object.freeze({ scene:'ashen_fields_dreamers', location:'ashen_fields', objective:'dreamers', destination:"the Wanderer's Fire in the Ashen Fields" }),
    c1q14: Object.freeze({ scene:'forge_of_judgment_arrival', location:'merchant_road', objective:'find_forge', destination:'the bend forge on the Merchant Road' }),
    c1q15: Object.freeze({ scene:'mol_true_sermon_arrival', location:'mol_village', objective:'return_mol', destination:'the village green in Mol' }),
    c1q16: Object.freeze({ scene:'rival_company_shadow', location:'tarnished_cup', objective:'notice', destination:'the Tarnished Cup in Vaelthar' }),
    c1q17: Object.freeze({ scene:'church_archive_breakin', location:'church_archive', objective:'break_in', destination:'the sealed Church Archive' }),
    c1q18: Object.freeze({ scene:'archive_lowest_level', location:'church_archive', objective:'descend', destination:'the lowest level of the Church Archive' }),
    c1q19: Object.freeze({ scene:'chancery_records_room', location:'archive_scriptorium', objective:'reach_chancery', destination:'the Archive Scriptorium and Chancery Room' }),
    c1q20: Object.freeze({ scene:'tower_ash_approach', location:'tower_ash', objective:'reach_tower', destination:'the Tower of Ash' }),
  });

  function ids(list) {
    return (Array.isArray(list) ? list : []).map(item => typeof item === 'string' ? item : item && item.id).filter(Boolean);
  }

  function isEntryEligible(gameState, questId) {
    const entry = ENTRY[questId];
    if (!entry || !gameState) return false;
    if (!ids(gameState.activeQuests).includes(questId)) return false;
    if (ids(gameState.completedQuests).includes(questId)) return false;
    return !gameState.questProgress?.[questId]?.objectives?.[entry.objective];
  }

  function entriesForLocation(gameState, locationId, options = {}) {
    return Object.keys(ENTRY).filter(questId => {
      const entry = ENTRY[questId];
      return entry.location === locationId
        && (options.includeLandmarks || !entry.landmark)
        && isEntryEligible(gameState, questId);
    });
  }

  function install(window) {
    if (window.__questEntrySystemInstalled) return;
    window.__questEntrySystemInstalled = true;
    const pending = new Set();

    function authoritative() {
      return !window.mp?.sessionCode || !!window.mp?.isHost;
    }

    function game() {
      try {
        if (typeof gameState !== 'undefined' && gameState) return gameState;
      } catch (error) { /* global lexical binding may not exist in isolated QA */ }
      return window.gameState || null;
    }

    function busy() {
      return !!window.combatState?.active
        || !!window.npcConvState?.active
        || !!window.document.getElementById('scene-panel')
        || !!window.document.getElementById('ambush-panel')
        || !!window.document.getElementById('travel-encounter-panel');
    }

    function currentLocation() {
      return window.mapState?.currentLocation || window.__world3d?.location?.id || '';
    }

    function openEntry(questId, options = {}) {
      const entry = ENTRY[questId];
      if (!entry || pending.has(questId) || !authoritative()) return false;
      if (!options.force && !isEntryEligible(game(), questId)) return false;
      if (!options.force && currentLocation() !== entry.location) return false;
      if (!options.force && entry.landmark && options.landmark !== entry.landmark) return false;
      if (!window.SCENES?.[entry.scene] || typeof window.runScene !== 'function') return false;

      pending.add(questId);
      let waited = 0;
      const go = function () {
        if (!options.force && !isEntryEligible(game(), questId)) {
          pending.delete(questId);
          return;
        }
        if (busy()) {
          waited += 500;
          if (waited <= 120000) window.setTimeout(go, 500);
          else pending.delete(questId);
          return;
        }
        pending.delete(questId);
        window.runScene(entry.scene);
      };
      window.setTimeout(go, options.immediate ? 0 : 450);
      return true;
    }

    function triggerQuestEntriesForLocation(locationId) {
      if (!authoritative()) return false;
      const questId = entriesForLocation(game(), locationId)[0];
      return questId ? openEntry(questId) : false;
    }

    function tryQuestEntryAtLandmark(landmarkId, expectedQuestId) {
      if (!authoritative()) return false;
      const questId = Object.keys(ENTRY).find(id => {
        const entry = ENTRY[id];
        return (!expectedQuestId || id === expectedQuestId)
          && entry.location === currentLocation()
          && entry.landmark === landmarkId
          && isEntryEligible(game(), id);
      });
      return questId ? openEntry(questId, { landmark:landmarkId, immediate:true }) : false;
    }

    function resumeQuestEntries() {
      pending.clear();
      return triggerQuestEntriesForLocation(currentLocation());
    }

    window.openQuestEntry = openEntry;
    window.triggerQuestEntriesForLocation = triggerQuestEntriesForLocation;
    window.tryQuestEntryAtLandmark = tryQuestEntryAtLandmark;
    window.resumeQuestEntries = resumeQuestEntries;
    window.QUEST_ENTRY_POINTS = ENTRY;

    function hookActivation() {
      if (window.__questEntryActivationHooked) return true;
      if (typeof window.activateQuest !== 'function') return false;
      const original = window.activateQuest;
      window.activateQuest = function (questId) {
        const result = original.apply(this, arguments);
        const entry = ENTRY[questId];
        if (result && entry) {
          window.addLog?.(`📍 Quest destination: ${entry.destination}.`, 'system');
          // If a quest continues deeper inside the place the party already
          // reached, wait for the current scene to close and then continue.
          if (!entry.landmark && currentLocation() === entry.location) openEntry(questId);
        }
        return result;
      };
      window.__questEntryActivationHooked = true;
      return true;
    }

    function hookArrivals() {
      if (window.__questEntryArrivalHooked) return true;
      if (typeof window.narrateLocation !== 'function') return false;
      const original = window.narrateLocation;
      window.narrateLocation = function (location) {
        const result = original.apply(this, arguments);
        window.setTimeout(() => triggerQuestEntriesForLocation(location?.id), 2100);
        return result;
      };
      window.__questEntryArrivalHooked = true;
      return true;
    }

    if (!hookActivation() || !hookArrivals()) {
      const timer = window.setInterval(function () {
        if (hookActivation() && hookArrivals()) window.clearInterval(timer);
      }, 300);
      window.setTimeout(() => window.clearInterval(timer), 20000);
    }

    window.debugStartQuest = function (questId) {
      if (!game()?.activeQuests?.some(quest => quest.id === questId)) window.activateQuest?.(questId, true);
      return openEntry(questId, { force:true, immediate:true });
    };

    console.log('📜 Location-aware quest entries loaded — c1q2..c1q20.');
  }

  return Object.freeze({ ENTRY, isEntryEligible, entriesForLocation, install });
});
