// Sanctum & Shadow — Chapter I quest entry points.
//
// WHY THIS EXISTS: quests chain sequentially (completeQuest activates order+1), but an
// activated quest was unreachable unless something actually ran its opening scene. The
// original c1q7..c1q20 were dead for exactly this reason: the arcs referenced scenes that
// nothing ever called. This wires each quest's activation to its opening scene.
(function () {
  'use strict';

  // questId -> opening scene (authored in story-extra-*.js)
  const ENTRY = Object.freeze({
    c1q7:  'well_that_screams_arrival',
    c1q8:  'ambassador_summons',
    c1q9:  'treasury_rats_arrival',
    c1q10: 'children_almshouse',
    c1q11: 'condemned_last_words_arrival',
    c1q12: 'mol_tithe_hook',
    c1q13: 'ashen_fields_dreamers',
    c1q14: 'forge_of_judgment_arrival',
    c1q15: 'mol_true_sermon_arrival',
    c1q16: 'rival_company_shadow',
    c1q17: 'church_archive_breakin',
    c1q18: 'archive_lowest_level',
    c1q19: 'chancery_records_room',
    c1q20: 'tower_ash_approach',
  });

  const fired = new Set();

  function busy() {
    return !!(window.combatState && window.combatState.active)
        || !!(window.npcConvState && window.npcConvState.active)
        || !!document.getElementById('scene-panel');
  }

  // Open a quest's first scene once the player is free — never stomp an open panel.
  function openEntry(questId) {
    const sceneId = ENTRY[questId];
    if (!sceneId || fired.has(questId)) return;
    const scenes = window.SCENES;
    if (!scenes || !scenes[sceneId]) return;      // scene file not loaded — bail quietly
    fired.add(questId);
    let waited = 0;
    const go = function () {
      if (busy() && waited < 120000) { waited += 3000; setTimeout(go, 3000); return; }
      if (typeof window.runScene === 'function') window.runScene(sceneId);
    };
    setTimeout(go, 1600);
  }
  window.openQuestEntry = openEntry;

  // Wrap activateQuest so every newly-activated quest opens its scene.
  function hook() {
    if (window.__questEntryHooked) return true;
    if (typeof window.activateQuest !== 'function') return false;
    const orig = window.activateQuest;
    window.activateQuest = function (questId, announce) {
      const result = orig.apply(this, arguments);
      if (result) {
        try { openEntry(questId); } catch (e) { console.warn('quest entry failed', questId, e); }
      }
      return result;
    };
    window.__questEntryHooked = true;
    return true;
  }

  if (!hook()) {
    const t = setInterval(function () { if (hook()) clearInterval(t); }, 400);
    setTimeout(function () { clearInterval(t); }, 20000);
  }

  // Debug/QA: jump straight to any quest's opening scene.
  window.debugStartQuest = function (questId) {
    fired.delete(questId);
    if (typeof window.activateQuest === 'function') window.activateQuest(questId, true);
    openEntry(questId);
  };

  console.log('📜 Quest entry hooks loaded — c1q7..c1q20 wired to their opening scenes.');
})();
