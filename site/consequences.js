// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — CONSEQUENCE LAYER
//  Makes the story branch on what the player actually did:
//   · Persistent NPC fates  (kill Rhael → Rhael is gone, for good)
//   · Alignment             (Holy vs Dark points steer the ending)
//   · Reputation            (which factions stand with you)
//   · availableEndings()    (the finale offers only earned endings)
//
//  Self-contained: every function reads state at call time via window.*,
//  so load order does not matter as long as this loads before the finale.
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  function flags() {
    if (!window.sceneState) window.sceneState = { flags: {} };
    if (!window.sceneState.flags) window.sceneState.flags = {};
    return window.sceneState.flags;
  }
  function norm(id) {
    return window.normalizeNpcId ? window.normalizeNpcId(id) : id;
  }

  // ─── NPC FATE ─────────────────────────────────────────────
  // Canonical fates. dead/arrested/fled = the NPC is off the board for good;
  // ally/spared = they return, changed; alive = default/unmet.
  const ABSENT_FATES = ['dead', 'arrested', 'fled'];

  function setNPCFate(id, fate) {
    const n = norm(id);
    flags()['npc_fate_' + n] = fate;
    // Keep every existing npc_dead_ reader (dialogue.js, finale gates) working.
    if (fate === 'dead') flags()['npc_dead_' + n] = true;
  }

  function getNPCFate(id) {
    const n = norm(id);
    const f = flags()['npc_fate_' + n];
    if (f) return f;
    // Legacy fall-through: combat.js already writes npc_dead_<n> on a kill,
    // so a killed NPC reads as 'dead' even without an explicit fate write.
    if (flags()['npc_dead_' + n]) return 'dead';
    return 'alive';
  }

  function npcAbsent(id) {
    return ABSENT_FATES.indexOf(getNPCFate(id)) !== -1;
  }

  // ─── ALIGNMENT (Holy vs Dark) ─────────────────────────────
  function getAlignment() {
    const c = (window.gameState && window.gameState.character) || {};
    return (c.holyPoints || 0) - (c.hellPoints || 0);
  }
  function getAlignmentTier() {
    const n = getAlignment();
    if (n >= 40) return 'saint';
    if (n >= 15) return 'devout';
    if (n <= -40) return 'damned';
    if (n <= -15) return 'fallen';
    return 'neutral';
  }

  // ─── REPUTATION READ-THROUGH ──────────────────────────────
  function repScore(f) { return window.getRepScore ? window.getRepScore(f) : 0; }
  function repTier(f) { return window.getRepTier ? window.getRepTier(f).id : 'neutral'; }

  // Who literally shows up at your side in the finale.
  function getFinaleBackers() {
    const b = [];
    if (repScore('city_watch') >= 40) b.push('watch');
    if (repScore('church') >= 40) b.push('church');
    if (repScore('citizens') >= 40) b.push('citizens');
    if (repScore('underworld') >= 40) b.push('underworld');
    return b;
  }

  // ─── ENDING AVAILABILITY ──────────────────────────────────
  // Pure function of current state → which endings the tower offers.
  // The Sword is always available (fallback). Charter/Third-Day keep their
  // puzzle gates in the finale itself; this adds the consequence-driven three.
  function availableEndings() {
    const tier = getAlignmentTier();
    const align = getAlignment();
    const mourne = getNPCFate('sister_mourne');
    const rhael = getNPCFate('captain_rhael');
    const cits = repScore('citizens');
    const churchTier = repTier('church');
    const spared = function (f) { return f === 'ally' || f === 'spared'; };

    return {
      sword: true,
      // The city rises with you — needs the common folk behind you and at
      // least one major NPC you did NOT kill, on a non-dark run.
      uprising: cits >= 40 && (spared(mourne) || spared(rhael)) && align >= 0,
      // The faith is rebuilt around the true name — needs the Church's favour,
      // a holy run, and Mourne alive to carry the flame.
      restoration: (churchTier === 'honored' || churchTier === 'revered')
        && (tier === 'devout' || tier === 'saint')
        && mourne !== 'dead',
      // You take his faces for yourself — a damned run that spilled real blood
      // and turned the city against you.
      devour: tier === 'damned' && (mourne === 'dead' || rhael === 'dead') && cits < 0,
    };
  }

  window.setNPCFate = setNPCFate;
  window.getNPCFate = getNPCFate;
  window.npcAbsent = npcAbsent;
  window.getAlignment = getAlignment;
  window.getAlignmentTier = getAlignmentTier;
  window.getFinaleBackers = getFinaleBackers;
  window.availableEndings = availableEndings;

  // ─── REPUTATION BEATS ─────────────────────────────────────
  // The rep economy had no scripted grants in story scenes, so the rep-gated
  // endings (Uprising: citizens≥40, Restoration: church honored) were
  // unreachable. Each quest's payoff scene now grants faction rep — and the
  // branching payoffs diverge (keep the children → citizens; surrender them
  // to the Church → church), so runs genuinely fork.
  const REP_BEATS = {
    well_syllable_resolved: [['citizens', 8, 'quieted the well at Mol']],
    well_that_screams_capped: [['citizens', 5, 'capped the screaming well']],
    treasury_rats_resolved: [['city_watch', 6, 'settled the Treasury matter']],
    ambassador_exemplar_surrendered: [['church', 8, 'surrendered the Ostrene exemplar']],
    children_kept: [['citizens', 10, 'protected the nameless children']],
    children_surrendered: [['church', 8, 'entrusted the children to the Church']],
    ossen_slate_read: [['citizens', 6, "honored a condemned man's last words"]],
    mol_tithe_stone: [['citizens', 8, 'exposed what Mol was paying for']],
    ashen_fields_dreamers: [['citizens', 4, 'listened to the dreamers of the Ashen Fields']],
    forge_blade_made: [['underworld', 5, 'commissioned a forbidden weapon']],
    forge_walk_away: [['church', 8, 'refused the god-killing blade']],
    mol_sermon_aftermath: [['citizens', 8, "stood with Aldran's congregation"]],
    rival_company_allies: [['underworld', 8, 'made allies in the shadows']],
    rival_company_enemies: [['city_watch', 5, 'refused to deal with the rival company']],
    archive_c1q17_end: [['church', 8, 'walked the Church Archive and left it standing']],
    covenant_author_closed: [['church', 8, 'handled the founding truth with care']],
  };

  function grantSceneRep(sceneId) {
    const beats = REP_BEATS[sceneId];
    if (!beats || flags()['rep_granted_' + sceneId]) return;
    flags()['rep_granted_' + sceneId] = true;
    beats.forEach(function (b) {
      if (window.changeRep) window.changeRep(b[0], b[1], b[2]);
    });
  }
  window.grantSceneRep = grantSceneRep;

  // Wrap runScene once it exists (story.js loads after this file). A top-level
  // function declaration is a global-object binding, so rebinding
  // window.runScene also reroutes bare runScene() calls inside story files.
  function hookRunScene() {
    if (window.__repBeatsHooked) return true;
    if (typeof window.runScene !== 'function') return false;
    const orig = window.runScene;
    window.runScene = function (sceneId) {
      try { grantSceneRep(sceneId); } catch (e) { /* rep must never break a scene */ }
      return orig.apply(this, arguments);
    };
    window.__repBeatsHooked = true;
    return true;
  }
  if (!hookRunScene()) {
    const t = setInterval(function () { if (hookRunScene()) clearInterval(t); }, 400);
    setTimeout(function () { clearInterval(t); }, 20000);
  }

  console.log('⚖ Consequence layer loaded — NPC fates, alignment, reputation → endings.');
})();
