// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — PRAYER & DIVINE INTERVENTION
//  Pray to GOD or petition the Dark Powers. Type your ask, roll a d20.
//    · Ask GOD something holy and roll 16+  → the wish is granted.
//    · Ask GOD something wicked and roll high → punished: 16-19 a curse,
//      a natural 20 is death. God is not mocked.
//    · The Dark Powers mirror it: the ask must be dark, or the petitioner
//      is the one who pays — same curse, same death on a 20.
//  Boons: healing, blessing (+atk/+AC), attack power, or the resurrection
//  of a fallen ally (restores a dead companion NPC via the fate layer).
//  Curses persist across combats until a granted holy healing lifts them.
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  const COOLDOWN_MS = 90 * 1000;
  let _lastPrayer = 0;

  function GS() {
    try { return (typeof gameState !== 'undefined') ? gameState : (window.gameState || null); }
    catch (e) { return window.gameState || null; }
  }
  function char() { const g = GS(); return g && g.character ? g.character : null; }
  function log(msg, cls) { if (window.addLog) window.addLog(msg, cls || 'system'); }
  function d20() {
    try {
      if (window.COMBAT_RULES && COMBAT_RULES.rollFormula) return COMBAT_RULES.rollFormula('1d20', {}).total;
    } catch (e) { /* fall through */ }
    return Math.floor(Math.random() * 20) + 1;
  }

  // ─── ASK CLASSIFICATION ───────────────────────────────────
  // holy: benevolent asks.  dark: wicked asks.  power: raw might — acceptable
  // to BOTH patrons (God grants righteous strength; the dark grants savage).
  const HOLY_WORDS = ['heal', 'cure', 'restore', 'protect', 'save', 'bless', 'mercy', 'forgive',
    'resurrect', 'revive', 'raise', 'light', 'courage', 'shield', 'guard', 'deliver', 'cleanse',
    'peace', 'hope', 'guide', 'watch over', 'health', 'life'];
  const DARK_WORDS = ['steal', 'rob', 'murder', 'kill', 'slay', 'betray', 'deceive', 'lie',
    'curse', 'hex', 'torture', 'poison', 'corrupt', 'enslave', 'desecrate', 'burn them',
    'revenge', 'vengeance', 'destroy', 'suffer', 'pain', 'fear', 'blood', 'sacrifice', 'harm'];
  const POWER_WORDS = ['power', 'strength', 'strong', 'might', 'attack', 'victory', 'win',
    'fight', 'battle', 'warrior', 'force'];

  function classifyAsk(text) {
    const t = ' ' + (text || '').toLowerCase() + ' ';
    const hit = words => words.some(w => t.includes(w));
    if (hit(DARK_WORDS)) return 'dark';
    if (hit(HOLY_WORDS)) return 'holy';
    if (hit(POWER_WORDS)) return 'power';
    return 'none';
  }

  // ─── BOON & PUNISHMENT EFFECTS ────────────────────────────
  function applyHolyBoon(ask) {
    const c = char(); if (!c) return;
    const t = ask.toLowerCase();
    if (window.grantHolyPoints) grantHolyPoints(2);
    if (window.Divinity) Divinity.burst('holy', 10);

    // Resurrection: a fallen ally restored through the fate layer.
    if (/resurrect|revive|raise|bring back/.test(t)) {
      const fallen = ['sister_mourne', 'captain_rhael', 'sir_harren']
        .filter(id => window.getNPCFate && window.getNPCFate(id) === 'dead');
      if (fallen.length) {
        const id = fallen[0];
        synchronizeResurrection(id);
        const name = id.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
        log('☩ GRANTED. The prayer is answered with the rarest coin heaven spends: ' + name +
          ' draws breath again. Death has been told no — once, for you. Do not spend it cheaply.', 'holy');
        return;
      }
      // Nobody to raise — the grace lands as healing instead.
    }
    {
      // Healing is the default holy grant (resurrection returned early above):
      // full restoration + any curse lifted, plus a blessing if strength was asked.
      const wasCursed = !!c.prayerCurse;
      c.hp = c.maxHp || c.hp;
      c.prayerCurse = null;
      if (window.renderPlayerCard) renderPlayerCard();
      if (/bless|protect|shield|guard|strength|power|might|attack|victory|battle|fight/.test(t)) {
        c.prayerBlessing = { atk: 2, ac: 2, combats: 2, source: 'holy' };
        log('☩ GRANTED. Warmth moves through you like sunrise through a cold room. Wounds close. ' +
          (wasCursed ? 'The curse on you burns away like fog. ' : '') +
          'A blessing settles on your arms — +2 attack, +2 armor for your next two battles. +2 Holy Points.', 'holy');
      } else {
        log('☩ GRANTED. Warmth moves through you like sunrise through a cold room. Every wound closes. ' +
          (wasCursed ? 'The curse on you burns away like fog. ' : '') + 'You are whole. +2 Holy Points.', 'holy');
      }
    }
  }

  function synchronizeResurrection(id) {
    const inMultiplayer = !!(window.mp && window.mp.sessionCode && window.mp.socket);
    if (!inMultiplayer) {
      window.setNPCFate?.(id, 'spared');
      return;
    }
    if (window.mp.isHost) {
      window.setNPCFate?.(id, 'spared');
      window.mpBroadcastCampaignState?.('prayer_resurrection:' + id);
      return;
    }
    // Guests request the shared change; the Session Master verifies that the
    // NPC is currently dead, commits it, and broadcasts canonical campaign state.
    window.mpBroadcastStoryEvent?.('npc_fate_request', {
      npcId:id, fate:'spared', reason:'prayer_resurrection', actorId:window.mp.playerId,
    });
  }

  function applyDarkBoon(ask) {
    const c = char(); if (!c) return;
    if (window.grantHellPoints) grantHellPoints(3);
    if (window.Divinity) Divinity.burst('hell', 10);
    // The dark pays better and charges more: a savage edge, thin armor.
    c.prayerBlessing = { atk: 4, ac: -1, combats: 2, source: 'dark' };
    const drained = Math.floor((c.maxHp || 40) * 0.3);
    c.hp = Math.min(c.maxHp || c.hp, (c.hp || 1) + drained);
    if (window.renderPlayerCard) renderPlayerCard();
    log('⛧ GRANTED. Something old and patient says yes. Stolen vitality knits your flesh (+' + drained +
      ' HP) and your hands remember cruelties they have never practiced — +4 attack, −1 armor for your ' +
      'next two battles. +3 Hell Points. Nothing in the dark is a gift; this was a purchase.', 'dark');
  }

  function applyCurse(patron) {
    const c = char(); if (!c) return;
    c.prayerCurse = { atk: -2, ac: -2, source: patron };
    c.hp = Math.max(1, (c.hp || 10) - 10);
    if (window.renderPlayerCard) renderPlayerCard();
    if (window.Divinity) Divinity.burst('hell', 15);
    if (patron === 'god') {
      if (window.grantHellPoints) grantHellPoints(5);
      log('⚡ PUNISHED. You asked Heaven to be your accomplice, and Heaven heard every word. The light ' +
        'does not strike you down — it withdraws, which is worse. A mark settles on you: −2 attack, −2 armor, ' +
        'and 10 HP taken as a lesson. The curse holds until a true prayer for healing is granted. +5 Hell Points.', 'dark');
    } else {
      log('⛧ PUNISHED. The Dark Powers examined your petition and found it insultingly clean. They do not ' +
        'traffic in mercy, and the fee for wasting their attention is you: −2 attack, −2 armor, 10 HP taken. ' +
        'The mark holds until a granted holy healing burns it off.', 'dark');
    }
  }

  function applyDeath(patron) {
    const c = char();
    const name = (c && c.name) || 'The Petitioner';
    if (window.Divinity) Divinity.burst('hell', 40);
    if (patron === 'god') {
      log('☠ A NATURAL 20. You asked GOD for wickedness with your whole heart — and were answered with ' +
        'the whole answer. Judgment does not negotiate.', 'dark');
    } else {
      log('☠ A NATURAL 20. You knelt in the dark and offered it something it did not want, perfectly. ' +
        'The Dark Powers accept you instead. Payment in full.', 'dark');
    }
    if (c) c.hp = 0;
    setTimeout(function () {
      if (window.showDeathScreen) showDeathScreen(name, 'struck down mid-prayer');
    }, 1600);
  }

  // ─── THE ROLL ─────────────────────────────────────────────
  // Map the game's legacy patron strings to ours.
  function normalizePatron(p) { return (p === 'holy' || p === 'god') ? 'god' : 'dark'; }

  function pray(patron, ask) {
    // The game's original quick-action buttons call pray('holy') / pray('dark')
    // with NO ask argument. Route those into the panel (patron preselected)
    // instead of colliding — this is what supersedes the old pray(type).
    if (ask === undefined) { openPrayerPanel(normalizePatron(patron)); return null; }
    patron = normalizePatron(patron);
    const c = char();
    if (!c) { log('You need a living character to pray.', 'system'); return null; }
    if ((window.combatState && combatState.active) || (window.mp && window.mp.combatState && window.mp.combatState.active)) {
      log('🙏 Not in the din of battle. Pray before you draw, or after you sheathe.', 'system');
      return null;
    }
    const now = Date.now();
    if (now - _lastPrayer < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - _lastPrayer)) / 1000);
      log('🙏 The air is still heavy with your last petition. Wait ' + wait + 's. Heaven and Hell both despise pestering.', 'system');
      return null;
    }
    if (!ask || ask.trim().length < 3) {
      log('🙏 Words first. You must actually ask for something.', 'system');
      return null;
    }
    _lastPrayer = now;

    const kind = classifyAsk(ask);
    const roll = d20();
    const patronName = patron === 'god' ? '✝ GOD' : '⛧ the Dark Powers';
    log('🙏 You petition ' + patronName + ': "' + ask.trim() + '" — the die falls… 🎲 ' + roll, 'system');

    // Does the ask suit the patron, offend it, or fall between?
    //   god  → holy/power = fitting · dark = offense · neutral = scatters
    //   dark → dark/power = fitting · holy = offense · neutral = scatters
    let stance;
    if (patron === 'god') stance = (kind === 'holy' || kind === 'power') ? 'fits' : (kind === 'dark') ? 'offends' : 'scatter';
    else stance = (kind === 'dark' || kind === 'power') ? 'fits' : (kind === 'holy') ? 'offends' : 'scatter';

    if (stance === 'fits') {
      if (roll >= 16) { patron === 'god' ? applyHolyBoon(ask) : applyDarkBoon(ask); }
      else {
        log(patron === 'god'
          ? '☩ Silence. Not refusal — timing. Heaven heard you, and heaven is not a vending machine. (Needed 16+.)'
          : '⛧ The dark heard you and said nothing. It likes you better hungry. (Needed 16+.)', 'system');
      }
    } else if (stance === 'offends') {
      // The wrong ask, pressed hard enough to be heard, is answered as an offense.
      if (roll === 20) applyDeath(patron);
      else if (roll >= 16) applyCurse(patron);
      else {
        log(patron === 'god'
          ? '☩ Your words rose, wilted, and fell back unheard. Be glad they did. Do not ask Heaven for that again.'
          : '⛧ The dark ignored your clean little request. Ask it for something it eats, or not at all.', 'system');
      }
    } else {
      log('🙏 The words scatter before they land anywhere. Ask plainly — for help, or for harm.', 'system');
    }
    syncMPCharacter();
    return { roll: roll, kind: kind, stance: stance };
  }
  window.pray = pray;

  // ─── MULTIPLAYER SYNC ─────────────────────────────────────
  // MP combat is server-authoritative: the server builds combatants from its
  // copy of each character, so blessings/curses must be pushed up after a
  // prayer resolves, and ticked down locally when the server ends a combat.
  function syncMPCharacter() {
    const c = char();
    if (c && window.mp && window.mp.sessionCode && window.mp.socket) {
      window.mp.socket.emit('character_ready', { code: window.mp.sessionCode, character: c });
    }
  }

  function hookMPCombatEnd() {
    if (window.__prayerMPHooked) return true;
    const sock = window.mp && window.mp.socket;
    if (!sock) return false;
    sock.on('combat_ended', function () {
      try {
        const c = char();
        if (c && c.prayerBlessing && --c.prayerBlessing.combats <= 0) {
          c.prayerBlessing = null;
          log('The blessing lifts, quietly, its work done.', 'system');
        }
      } catch (e) { /* never break the combat-end flow */ }
    });
    window.__prayerMPHooked = true;
    return true;
  }

  // ─── COMBAT INTEGRATION ───────────────────────────────────
  // Wrap startCombat so blessings and curses shape the freshly built player
  // combatant, then tick blessing duration down when combat ends.
  function hookCombat() {
    if (window.__prayerCombatHooked || typeof window.startCombat !== 'function') return !!window.__prayerCombatHooked;
    const origStart = window.startCombat;
    window.startCombat = function () {
      const r = origStart.apply(this, arguments);
      try {
        const c = char();
        const p = window.combatState && combatState.combatants && combatState.combatants['player'];
        if (c && p) {
          if (c.prayerBlessing && c.prayerBlessing.combats > 0) {
            p.atk += c.prayerBlessing.atk; p.attackBonus += c.prayerBlessing.atk;
            p.damageMod += c.prayerBlessing.atk; p.ac += c.prayerBlessing.ac;
            log((c.prayerBlessing.source === 'holy' ? '☩' : '⛧') + ' Your blessing is on you: ' +
              (c.prayerBlessing.atk >= 0 ? '+' : '') + c.prayerBlessing.atk + ' attack, ' +
              (c.prayerBlessing.ac >= 0 ? '+' : '') + c.prayerBlessing.ac + ' armor.', c.prayerBlessing.source === 'holy' ? 'holy' : 'dark');
          }
          if (c.prayerCurse) {
            p.atk += c.prayerCurse.atk; p.attackBonus += c.prayerCurse.atk;
            p.damageMod += c.prayerCurse.atk; p.ac += c.prayerCurse.ac;
            log('⚡ The curse drags at your arms: ' + c.prayerCurse.atk + ' attack, ' + c.prayerCurse.ac + ' armor.', 'dark');
          }
        }
      } catch (e) { /* never break combat */ }
      return r;
    };
    const origEnd = window.endCombat;
    if (typeof origEnd === 'function') {
      window.endCombat = function (victory) {
        const r = origEnd.apply(this, arguments);
        try {
          const c = char();
          if (c && c.prayerBlessing && --c.prayerBlessing.combats <= 0) {
            c.prayerBlessing = null;
            log('The blessing lifts, quietly, its work done.', 'system');
          }
        } catch (e) { /* ignore */ }
        return r;
      };
    }
    window.__prayerCombatHooked = true;
    return true;
  }

  // ─── UI ───────────────────────────────────────────────────
  function openPrayerPanel(preselect) {
    if (document.getElementById('prayer-panel')) return;
    const wrap = document.createElement('div');
    wrap.id = 'prayer-panel';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2400;display:flex;align-items:center;justify-content:center;background:rgba(4,2,8,0.82)';
    wrap.innerHTML =
      '<div style="width:min(480px,92vw);background:linear-gradient(180deg,#171224,#0b0812);border:1px solid #5a4a7a;border-radius:12px;padding:22px;font-family:inherit;color:#d8d0e8;box-shadow:0 0 60px rgba(90,60,160,0.35)">' +
      '<div style="font-size:19px;letter-spacing:2px;text-align:center;margin-bottom:4px">🙏 PRAYER</div>' +
      '<div style="font-size:12px;opacity:0.75;text-align:center;margin-bottom:14px">Choose whom you petition. Speak your ask. The die decides.<br>16+ grants a fitting ask — and punishes an unfitting one. A 20 on the wrong prayer is fatal.</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:12px">' +
      '<button id="pp-god" style="flex:1;padding:10px;border-radius:8px;border:1px solid #b89040;background:rgba(184,144,64,0.12);color:#e8cf90;cursor:pointer;font-size:15px">✝ Pray to GOD</button>' +
      '<button id="pp-dark" style="flex:1;padding:10px;border-radius:8px;border:1px solid #7a4a8a;background:rgba(122,74,138,0.12);color:#c9a0d8;cursor:pointer;font-size:15px">⛧ Petition the Dark</button></div>' +
      '<textarea id="pp-ask" rows="2" placeholder="What do you ask for?" style="width:100%;box-sizing:border-box;background:#0e0a18;border:1px solid #3a3050;border-radius:8px;color:#e8e0f4;padding:10px;font-size:14px;resize:none"></textarea>' +
      '<div id="pp-hint" style="font-size:11px;opacity:0.6;margin:8px 0 12px">e.g. “heal my wounds” · “grant me strength for the battle ahead” · “resurrect my fallen ally”</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
      '<button id="pp-close" style="padding:8px 14px;border-radius:8px;border:1px solid #444;background:transparent;color:#aaa;cursor:pointer">Close</button>' +
      '<button id="pp-roll" disabled style="padding:8px 18px;border-radius:8px;border:1px solid #6a5a9a;background:rgba(106,90,154,0.25);color:#cfc0f0;cursor:pointer;font-size:15px">🎲 Roll the d20</button></div></div>';
    document.body.appendChild(wrap);

    let patron = null;
    const godBtn = wrap.querySelector('#pp-god'), darkBtn = wrap.querySelector('#pp-dark');
    const rollBtn = wrap.querySelector('#pp-roll');
    function pick(p) {
      patron = p;
      godBtn.style.boxShadow = p === 'god' ? '0 0 14px rgba(232,207,144,0.6)' : 'none';
      darkBtn.style.boxShadow = p === 'dark' ? '0 0 14px rgba(201,160,216,0.6)' : 'none';
      rollBtn.disabled = false;
    }
    godBtn.onclick = () => pick('god');
    darkBtn.onclick = () => pick('dark');
    if (preselect === 'god' || preselect === 'dark') pick(preselect);
    wrap.querySelector('#pp-close').onclick = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    rollBtn.onclick = () => {
      if (!patron) return;
      const ask = wrap.querySelector('#pp-ask').value;
      const result = pray(patron, ask);
      if (result !== null) wrap.remove();
    };
  }
  window.openPrayerPanel = openPrayerPanel;

  function injectButton() {
    const qa = document.querySelector('.quick-actions');
    // No-op: the game's native "✝ Holy Prayer" / "⛧ Dark Prayer" quick-action
    // buttons (index.html) now open this panel via pray('holy'|'dark'), so a
    // separate injected button would be redundant.
    return;
  }

  // ─── BOOT ─────────────────────────────────────────────────
  // Install the solo combat hook + the MP combat-end listener; the prayer
  // entry points are the native quick-action buttons.
  const t = setInterval(function () { if (hookCombat() && hookMPCombatEnd()) clearInterval(t); }, 800);
  setTimeout(function () { clearInterval(t); }, 30000);

  console.log('🙏 Prayer & divine intervention loaded — d20 petitions to GOD or the Dark.');
})();
