// ============================================
//   SANCTUM & SHADOW — DIVINITY GRAPHICS LAYER
//   Self-contained CSS/SVG effects layer. Hooks
//   existing globals (renderPlayerCard, castSelectedSpell,
//   showScene) by wrapping them — no other file is modified
//   except a single invocation hook in dialogue.js.
//
//   Public API (window.Divinity):
//     .burst('holy'|'hell', n)   — point-gain burst + motes
//     .spell(spellIdOrObj)       — ability visual
//     .invokeName()              — the divine stillness (the Name)
//     .updateAura()              — refresh holy/hell vignette
//     .backdrop(on, sceneData)   — sacred scene ambiance
// ============================================

(function () {
  if (window.Divinity) return; // guard double-load

  // ─── BUILD THE LAYER DOM ──────────────────────────────────
  function el(tag, props, html) {
    const n = document.createElement(tag);
    if (props) Object.assign(n, props);
    if (html != null) n.innerHTML = html;
    return n;
  }

  let layer, moments, aura, backdrop;
  function ensureLayer() {
    if (layer && document.body.contains(layer)) return;
    layer = document.getElementById('divinity-layer') || el('div', { id: 'divinity-layer' });
    aura = el('div', { id: 'divinity-aura' },
      '<div class="aura-holy"></div><div class="aura-hell"></div>');
    backdrop = el('div', { id: 'divinity-backdrop' },
      '<div class="shaft"></div><div class="shaft"></div><div class="shaft"></div>');
    layer.appendChild(aura);
    layer.appendChild(backdrop);
    moments = document.getElementById('divinity-moments') || el('div', { id: 'divinity-moments' });
    if (!document.body.contains(layer)) document.body.appendChild(layer);
    if (!document.body.contains(moments)) document.body.appendChild(moments);
  }

  // Auto-remove a transient node after its animation
  function flash(node, life, host) {
    ensureLayer();
    (host || moments).appendChild(node);
    setTimeout(() => node.remove(), life);
  }

  // gameState is a top-level `let` in game.js — NOT a window property — so it
  // must be reached via the shared global lexical scope, not window.gameState.
  function GS() {
    try { return (typeof gameState !== 'undefined') ? gameState : (window.gameState || null); }
    catch (e) { return window.gameState || null; }
  }

  function onGameScreen() {
    return (GS()?.activeScreen === 'game');
  }

  // ─── HOLY / HELL AURA METER ───────────────────────────────
  let lastHoly = 0, lastHell = 0, auraInit = false;
  // Pure render — set the vignette intensity from current points. No side effects.
  function applyAura() {
    ensureLayer();
    const char = GS()?.character;
    if (!char || !onGameScreen()) { aura.classList.remove('active'); return; }
    const holy = Math.max(0, Math.min(1, (char.holyPoints || 0) / 40));
    const hell = Math.max(0, Math.min(1, (char.hellPoints || 0) / 40));
    aura.style.setProperty('--holy', holy.toFixed(3));
    aura.style.setProperty('--hell', hell.toFixed(3));
    aura.classList.toggle('active', holy > 0.02 || hell > 0.02);
  }
  // Delta-aware update — fires bursts on a gain, then renders. Baseline is
  // advanced BEFORE bursting so burst()'s own applyAura() can never re-trigger.
  function updateAura() {
    const char = GS()?.character;
    if (!char || !onGameScreen()) { applyAura(); return; }
    const curHoly = char.holyPoints || 0, curHell = char.hellPoints || 0;
    const dHoly = curHoly - lastHoly, dHell = curHell - lastHell;
    lastHoly = curHoly; lastHell = curHell;   // advance baseline first (no recursion)
    applyAura();
    if (auraInit) {
      if (dHoly > 0) burst('holy', dHoly);
      if (dHell > 0) burst('hell', dHell);
    }
    auraInit = true;
  }
  // If holy/hell are reset (load/new game) re-baseline without a burst
  function rebaseline() {
    const char = GS()?.character;
    lastHoly = char?.holyPoints || 0;
    lastHell = char?.hellPoints || 0;
    auraInit = true;
    updateAura();
  }

  // ─── DIVINE BURST (point gains) ───────────────────────────
  function burst(kind, magnitude) {
    if (!onGameScreen()) return;
    ensureLayer();
    const ring = el('div', { className: 'div-burst ' + (kind === 'hell' ? 'hell' : 'holy') });
    flash(ring, 1500);
    if (kind === 'holy') {
      const count = Math.min(10, 3 + (magnitude || 1));
      for (let i = 0; i < count; i++) {
        const m = el('div', { className: 'div-mote' });
        const x = 38 + Math.random() * 24;        // % across the centre band
        m.style.setProperty('--x', x + '%');
        m.style.setProperty('--start', (38 + Math.random() * 10) + '%');
        m.style.setProperty('--s', (4 + Math.random() * 6).toFixed(0) + 'px');
        m.style.setProperty('--drift', ((Math.random() - 0.5) * 80).toFixed(0) + 'px');
        m.style.setProperty('--dur', (2 + Math.random() * 1.4).toFixed(2) + 's');
        m.style.setProperty('--delay', (Math.random() * 0.5).toFixed(2) + 's');
        flash(m, 3600);
      }
    }
    applyAura();   // refresh intensity only — never updateAura() (would recurse)
  }

  // ─── SPELL / ABILITY VISUALS ──────────────────────────────
  const SVG_RAYS = (() => {
    // 24 radiating cones for the Wrath flash
    let cones = '';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 360;
      cones += `<polygon points="450,450 ${450 + 14 * Math.cos((a - 1.4) * Math.PI / 180) - 14} ` +
               `0 0" transform="rotate(${a} 450 450)" fill="url(#divRayGrad)" opacity="0.5"/>`;
    }
    return `<svg viewBox="0 0 900 900" width="900" height="900" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="divRayGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#fff7d6" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#ffd97a" stop-opacity="0"/>
      </linearGradient></defs>
      <g>${Array.from({ length: 24 }, (_, i) =>
        `<polygon points="450,450 438,30 462,30" transform="rotate(${(i / 24) * 360} 450 450)"
         fill="url(#divRayGrad)" opacity="0.55"/>`).join('')}
      </g></svg>`;
  })();

  function spell(spellOrId) {
    if (!onGameScreen()) return;
    ensureLayer();
    const id = typeof spellOrId === 'string' ? spellOrId : (spellOrId && spellOrId.id);
    const type = typeof spellOrId === 'object' ? spellOrId?.type : null;
    switch (id) {
      case 'judgment':
        flash(el('div', { className: 'div-pillar' }), 1300); break;
      case 'divine_shield':
        flash(el('div', { className: 'div-halo' }), 1800); break;
      case 'mass_heal':
        flash(el('div', { className: 'div-radiance' }), 2000); break;
      case 'wrath_divine': {
        const f = el('div', { className: 'div-flash' }, '<div class="div-rays">' + SVG_RAYS + '</div>');
        flash(f, 1700); break;
      }
      case 'spirit_weapon':
        flash(el('div', { className: 'div-spirit' }), 1800); break;
      case 'shadow_step':
        flash(el('div', { className: 'div-wisp' }), 1300); break;
      default:
        // Any other holy/heal-typed spell → a gentle radiant burst
        if (type === 'holy' || type === 'heal') burst('holy', 1);
    }
  }

  // ─── THE NAME — DIVINE STILLNESS ──────────────────────────
  let stillnessActive = false;
  function invokeName() {
    if (stillnessActive) return;
    stillnessActive = true;
    ensureLayer();
    const s = el('div', { className: 'div-stillness' }, '<div class="div-still-ring"></div>');
    flash(s, 5600);
    setTimeout(() => { stillnessActive = false; }, 5600);
  }

  // ─── SACRED SCENE BACKDROP ────────────────────────────────
  const SACRED = /temple|monaster|church|cathedral|archive|shrine|altar|sanctum|covenant|chapel|holy|abbey|reliquar/i;
  function isSacred(sceneData) {
    if (!sceneData) return false;
    if (sceneData.sacred) return true;
    const hay = [sceneData.location, sceneData.id, sceneData._renderId,
                 window.mapState?.currentLocation].filter(Boolean).join(' ');
    return SACRED.test(hay);
  }
  function setBackdrop(on, sceneData) {
    ensureLayer();
    if (on && onGameScreen()) {
      // seed drifting motes once per activation
      backdrop.querySelectorAll('.b-mote').forEach(n => n.remove());
      for (let i = 0; i < 14; i++) {
        const m = el('div', { className: 'b-mote' });
        m.style.left = (8 + Math.random() * 84) + '%';
        m.style.top = (30 + Math.random() * 60) + '%';
        m.style.setProperty('--dur', (8 + Math.random() * 7).toFixed(1) + 's');
        m.style.setProperty('--delay', (Math.random() * 6).toFixed(1) + 's');
        m.style.setProperty('--drift', ((Math.random() - 0.5) * 40).toFixed(0) + 'px');
        backdrop.appendChild(m);
      }
      backdrop.classList.add('active');
    } else {
      backdrop.classList.remove('active');
    }
  }

  // ─── WRAP EXISTING GLOBALS ────────────────────────────────
  function installHooks() {
    // Aura + point bursts: renderPlayerCard runs after holy/hell changes
    if (window.renderPlayerCard && !window.renderPlayerCard._divWrapped) {
      const orig = window.renderPlayerCard;
      window.renderPlayerCard = function (...a) {
        const r = orig.apply(this, a);
        try { updateAura(); } catch (e) {}
        return r;
      };
      window.renderPlayerCard._divWrapped = true;
    }

    // Spell visuals: read the selected spell BEFORE the cast clears it
    if (window.castSelectedSpell && !window.castSelectedSpell._divWrapped) {
      const orig = window.castSelectedSpell;
      window.castSelectedSpell = function (...a) {
        const sel = window.combatState?.selectedSpell;
        const r = orig.apply(this, a);
        try { if (sel) spell(sel); } catch (e) {}
        return r;
      };
      window.castSelectedSpell._divWrapped = true;
    }

    // Sacred backdrop: toggle on every scene render
    if (window.showScene && !window.showScene._divWrapped) {
      const orig = window.showScene;
      window.showScene = function (sceneData, ...a) {
        const r = orig.call(this, sceneData, ...a);
        try { setBackdrop(isSacred(sceneData), sceneData); } catch (e) {}
        return r;
      };
      window.showScene._divWrapped = true;
    }
  }

  // Some globals are (re)assigned after load by other wrappers; re-install a few times.
  function pollInstall(n) {
    installHooks();
    if (n > 0) setTimeout(() => pollInstall(n - 1), 400);
  }

  // ─── PUBLIC API ───────────────────────────────────────────
  window.Divinity = {
    burst, spell, invokeName, updateAura, rebaseline,
    backdrop: setBackdrop,
    onHoly: (n) => burst('holy', n || 1),
    onHell: (n) => burst('hell', n || 1),
    // Per-frame hook called by the 3D Vaelthar map. Safe no-op for now;
    // real in-scene divine FX is future work.
    update: function (dt, t) {},
  };

  // ─── BOOT ─────────────────────────────────────────────────
  function boot() {
    ensureLayer();
    pollInstall(6);          // catch late re-wraps of renderPlayerCard/showScene
    rebaseline();
    // Keep the aura honest even if a code path changes points without re-rendering
    setInterval(() => { try { updateAura(); } catch (e) {} }, 2500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
