// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — CAMP & REST SYSTEM
//  Short rest: partial HP. Long rest: full HP + time advance
//  + world events that fire while you sleep
// ═══════════════════════════════════════════════════════════

// ─── WORLD CLOCK ─────────────────────────────────────────
// Hours 0-23. Starts at 08:00 on day 1.
window.worldClock = window.worldClock || {
  hour: 8,
  day:  1,
};

function advanceTime(hours) {
  window.worldClock.hour += hours;
  while (window.worldClock.hour >= 24) {
    window.worldClock.hour -= 24;
    window.worldClock.day += 1;
  }
  _updateClockUI();
}

function getTimeOfDay() {
  const h = window.worldClock.hour;
  if (h >= 5  && h < 8)  return { name: 'Dawn',       icon: '🌅', dark: false };
  if (h >= 8  && h < 12) return { name: 'Morning',    icon: '☀',  dark: false };
  if (h >= 12 && h < 17) return { name: 'Afternoon',  icon: '🌤', dark: false };
  if (h >= 17 && h < 20) return { name: 'Dusk',       icon: '🌆', dark: false };
  if (h >= 20 && h < 24) return { name: 'Night',      icon: '🌙', dark: true  };
  return                         { name: 'Deep Night', icon: '🌑', dark: true  };
}

function _updateClockUI() {
  const el = document.getElementById('world-clock');
  if (!el) return;
  const t = getTimeOfDay();
  const h = String(window.worldClock.hour).padStart(2, '0');
  el.innerHTML = `${t.icon} ${t.name} &nbsp;·&nbsp; Day ${window.worldClock.day} &nbsp;·&nbsp; ${h}:00`;
}

// ─── LOCATION CAMP CONFIG ────────────────────────────────
// What kind of rest is available where, and the flavour
const CAMP_CONFIGS = {
  tavern:           { canRest: true,  bedCost: 10, restType: 'inn',       icon: '🍺', label: 'Rent a Room',       shortLabel: 'Rest at the bar' },
  city:             { canRest: true,  bedCost: 0,  restType: 'urban',     icon: '🏰', label: 'Find shelter',      shortLabel: 'Rest in an alley' },
  district:         { canRest: true,  bedCost: 0,  restType: 'urban',     icon: '🏛', label: 'Find shelter',      shortLabel: 'Rest in a doorway' },
  village:          { canRest: true,  bedCost: 5,  restType: 'inn',       icon: '🏡', label: 'Stay with locals',  shortLabel: 'Sleep in the stable' },
  outpost:          { canRest: true,  bedCost: 0,  restType: 'camp',      icon: '⛺', label: 'Make camp',         shortLabel: 'Rest by the fire' },
  road:             { canRest: true,  bedCost: 0,  restType: 'exposed',   icon: '🛤', label: 'Camp roadside',     shortLabel: 'Sleep in the open' },
  wilderness:       { canRest: true,  bedCost: 0,  restType: 'exposed',   icon: '🌲', label: 'Make camp',         shortLabel: 'Sleep under the trees' },
  dungeon:          { canRest: true,  bedCost: 0,  restType: 'dangerous', icon: '💀', label: 'Rest in the dark',  shortLabel: 'Sleep with one eye open' },
  fortress:         { canRest: true,  bedCost: 0,  restType: 'dangerous', icon: '🏯', label: 'Find a safe corner',shortLabel: 'Uneasy rest in the walls' },
  point_of_interest:{ canRest: true,  bedCost: 0,  restType: 'camp',      icon: '⛺', label: 'Make camp nearby',  shortLabel: 'Rest in the shadow of it' },
};

// HP/MP recovery multipliers per rest type
const REST_RECOVERY = {
  inn:       { shortHp: 0.40, shortMp: 0.50, longHp: 1.00, longMp: 1.00, longCost: true  },
  urban:     { shortHp: 0.25, shortMp: 0.30, longHp: 0.80, longMp: 0.80, longCost: false },
  camp:      { shortHp: 0.30, shortMp: 0.35, longHp: 0.90, longMp: 0.90, longCost: false },
  exposed:   { shortHp: 0.20, shortMp: 0.25, longHp: 0.70, longMp: 0.70, longCost: false },
  dangerous: { shortHp: 0.15, shortMp: 0.20, longHp: 0.50, longMp: 0.60, longCost: false },
};

// ─── WORLD EVENTS WHILE SLEEPING ─────────────────────────
// Each has weight, a condition function, and what it does
const SLEEP_EVENTS = [
  {
    id: 'gates_locked',
    weight: 12,
    condition: (loc) => ['city','district'].includes(loc?.type),
    title: 'The Gates Are Locked',
    text: 'You wake to commotion outside. City heralds announce that the Eastern Gates have been sealed by order of the Watch — effective immediately. Reason given: none.',
    effect: (char) => {
      setFlag('eastern_gates_locked', true);
      addLog('📢 New world event: Eastern Gates sealed by the Watch.', 'system');
    },
  },
  {
    id: 'thief_in_night',
    weight: 10,
    condition: (loc, config) => ['tavern','urban','city'].includes(loc?.type) || config?.restType === 'urban',
    title: 'A Thief in the Night',
    text: 'You wake and something is wrong. Your pack has been moved. A careful count reveals gold is missing — someone knew what they were doing.',
    effect: (char) => {
      const stolen = Math.floor(Math.random() * 20) + 8;
      char.gold = Math.max(0, (char.gold || 0) - stolen);
      addLog(`💸 Stolen while you slept: ${stolen} gold. Someone knew you were here.`, 'hell');
    },
  },
  {
    id: 'nightmare',
    weight: 15,
    condition: (loc) => (loc?.danger || 0) >= 3 || getFlag('touched_by_the_void'),
    title: 'The Nightmare',
    text: 'You do not dream so much as remember. A vast darkness. A voice speaking your name in a language you\'ve never heard. You wake drenched, shaking — and somehow more certain about something you can\'t name.',
    effect: (char) => {
      char.hp = Math.max(1, (char.hp || 1) - 8);
      char.hellPoints = (char.hellPoints || 0) + 2;
      setFlag('had_the_nightmare', true);
      addLog('💀 The nightmare costs you 8 HP and 2 Hell Points. But you feel... sharper.', 'hell');
    },
  },
  {
    id: 'messenger_arrives',
    weight: 8,
    condition: (loc) => getFlag('talked_to_captain_rhael') || getFlag('talked_to_elder_varek'),
    title: 'A Messenger Came While You Slept',
    text: 'Slipped under your door (or left by your pack if you camped outside): a sealed note. No name. The seal is the Covenant\'s — broken, inverted. Inside: a single line. *"They know where you are. Move tonight."*',
    effect: (char) => {
      char.inventory = char.inventory || [];
      char.inventory.push('Unsigned Warning Note');
      setFlag('received_covenant_warning', true);
      addLog('📜 Item added: Unsigned Warning Note', 'system');
    },
  },
  {
    id: 'fire_in_the_city',
    weight: 7,
    condition: (loc) => ['city','district','tavern'].includes(loc?.type),
    title: 'Fire in the Night',
    text: 'You wake to orange light and distant shouting. Something is burning near the market quarter. By morning, ash drifts through the streets. No one will say how it started.',
    effect: (char) => {
      setFlag('market_fire', true);
      addLog('🔥 The market quarter burned during the night. Something is different in the city now.', 'system');
    },
  },
  {
    id: 'good_dreams',
    weight: 18,
    condition: (loc) => (gameState.character?.holyPoints || 0) >= 5,
    title: 'Restful Sleep',
    text: 'You dream of nothing in particular. Light. Warmth. Something like peace. You wake feeling genuinely rested — a rare thing in this city.',
    effect: (char) => {
      char.hp = Math.min(char.maxHp, (char.hp || 1) + 10);
      addLog('✝ Restful dreams. Bonus +10 HP on waking.', 'holy');
    },
  },
  {
    id: 'ambush_at_camp',
    weight: 10,
    condition: (loc, config) => ['dangerous','exposed'].includes(config?.restType) && (loc?.danger || 0) >= 3,
    title: 'Attacked in Your Sleep',
    text: 'You wake to cold steel near your throat and figures moving in the dark. You weren\'t careful enough about who saw you make camp.',
    effect: (char) => {
      addLog('⚔ You were attacked in your sleep! Initiative goes to them.', 'combat');
      setFlag('ambushed_while_sleeping', true);
      // Trigger combat after a moment
      setTimeout(() => {
        if (window.generateEnemy && window.startCombat) {
          const enemies = [window.generateEnemy('bandit', 1), window.generateEnemy('bandit', 1)];
          window.startCombat(enemies);
        }
      }, 2000);
    },
  },
  {
    id: 'covenant_patrol',
    weight: 9,
    condition: () => getFlag('talked_to_captain_rhael') && !getFlag('npc_dead_captain_rhael'),
    title: 'A Patrol Passed',
    text: 'You wake to voices outside — disciplined, quiet. Covenant insignia. They were checking faces. By the time you peered out they were gone. They\'ll be back.',
    effect: (char) => {
      setFlag('covenant_patrol_seen', true);
      addLog('🛡 Covenant patrol in the area. They are looking for someone.', 'system');
    },
  },
  {
    id: 'found_something',
    weight: 12,
    condition: (loc) => ['wilderness','road','dungeon'].includes(loc?.type),
    title: 'You Found Something at Dawn',
    text: 'Early light reveals something you missed when you made camp. Pressed into the earth nearby — a cache, left by someone who isn\'t coming back for it.',
    effect: (char) => {
      const gold = Math.floor(Math.random() * 25) + 10;
      char.gold = (char.gold || 0) + gold;
      addLog(`🪙 Found a hidden cache at dawn: ${gold} gold.`, 'holy');
    },
  },
  {
    id: 'npc_killed_overnight',
    weight: 6,
    condition: () => !getFlag('npc_dead_elder_varek') && getFlag('knows_varek_location'),
    title: 'News at First Light',
    text: 'A commotion in the street at dawn. People speaking in hushed tones. Someone important was found dead in the night — the rumor spreads fast. A scholar. An old man. Found in the Old Quarter.',
    effect: (char) => {
      setFlag('varek_found_dead_rumor', true);
      addLog('📢 Rumor: an old scholar found dead overnight in the Old Quarter.', 'system');
    },
  },
];

// ─── OPEN CAMP PANEL ─────────────────────────────────────
function openCampPanel() {
  // #16: no camping during combat
  if (window.combatState?.active) {
    if (window.toast) toast('⚔ Not during combat!', 'error');
    else if (window.addLog) addLog('⚔ Not during combat!', 'system');
    return;
  }
  const locId  = window.mapState?.currentLocation || 'vaelthar_city';
  const loc    = window.WORLD_LOCATIONS?.[locId] || {};
  const config = CAMP_CONFIGS[loc.type] || CAMP_CONFIGS.road;
  const recovery = REST_RECOVERY[config.restType] || REST_RECOVERY.camp;
  const char   = gameState.character;
  const time   = getTimeOfDay();

  if (!char) { toast('No character found.', 'error'); return; }

  document.getElementById('camp-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'camp-panel';
  panel.className = 'camp-panel';

  const hpShort = Math.floor((char.maxHp - char.hp) * recovery.shortHp);
  const mpShort = Math.floor((char.maxMp - char.mp) * recovery.shortMp);
  const hpLong  = char.maxHp - char.hp;
  const mpLong  = char.maxMp - char.mp;
  const isFullHp = char.hp >= char.maxHp;
  const isFullMp = char.mp >= char.maxMp;

  // #32: compute the ACTUAL long-rest HP recovery the same way doLongRest does — base
  // recovery PLUS the +15 ration bonus when a ration is carried and it would help —
  // so the displayed number matches what the player really gets.
  const baseLongHp   = Math.floor(hpLong * recovery.longHp);
  const carriesRation = (char.inventory || []).some(i => i.toLowerCase().includes('ration'));
  const longRationBonus = (carriesRation && Math.min(hpLong, baseLongHp + 15) > Math.min(hpLong, baseLongHp)) ? 15 : 0;
  const hpLongActual = Math.min(hpLong, baseLongHp + longRationBonus);

  const bedCost = config.bedCost;
  const canAffordBed = (char.gold || 0) >= bedCost;

  const dangerWarning = ['dangerous','exposed'].includes(config.restType)
    ? `<div class="camp-warning">⚠ Resting here is dangerous — you may be interrupted or attacked.</div>`
    : '';

  panel.innerHTML = `
    <div class="camp-inner">
      <div class="camp-header">
        <span class="camp-loc-icon">${config.icon}</span>
        <div class="camp-header-text">
          <div class="camp-title">Make Camp</div>
          <div class="camp-subtitle">${loc.name || 'Unknown location'} &nbsp;·&nbsp; ${time.icon} ${time.name} · Day ${window.worldClock.day}</div>
        </div>
        <button class="camp-close" onclick="closeCampPanel()">✕</button>
      </div>

      <div class="camp-status">
        <div class="camp-stat">
          <span class="camp-stat-label">HP</span>
          <div class="camp-bar-wrap"><div class="camp-bar hp-bar" style="width:${(char.hp/char.maxHp*100).toFixed(0)}%"></div></div>
          <span class="camp-stat-val">${char.hp} / ${char.maxHp}</span>
        </div>
        <div class="camp-stat">
          <span class="camp-stat-label">MP</span>
          <div class="camp-bar-wrap"><div class="camp-bar mp-bar" style="width:${(char.mp/char.maxMp*100).toFixed(0)}%"></div></div>
          <span class="camp-stat-val">${char.mp} / ${char.maxMp}</span>
        </div>
      </div>

      ${dangerWarning}

      <div class="camp-options">

        <div class="camp-option short-rest ${isFullHp && isFullMp ? 'maxed' : ''}">
          <div class="camp-opt-header">
            <span class="camp-opt-icon">🔥</span>
            <div class="camp-opt-info">
              <span class="camp-opt-title">Short Rest</span>
              <span class="camp-opt-desc">1 hour. Bind wounds, catch breath. No time lost to the world.</span>
            </div>
          </div>
          <div class="camp-opt-gains">
            ${hpShort > 0 ? `<span class="camp-gain hp">+${hpShort} HP</span>` : ''}
            ${mpShort > 0 ? `<span class="camp-gain mp">+${mpShort} MP</span>` : ''}
            ${isFullHp && isFullMp ? `<span class="camp-gain full">Already at full strength</span>` : ''}
          </div>
          <div class="camp-opt-cost"><span class="camp-time-cost">⏱ 1 hour passes</span></div>
          <button class="camp-btn short-btn" onclick="doShortRest()" ${isFullHp && isFullMp ? 'disabled' : ''}>
            🔥 Short Rest
          </button>
        </div>

        <div class="camp-option long-rest">
          <div class="camp-opt-header">
            <span class="camp-opt-icon">🌙</span>
            <div class="camp-opt-info">
              <span class="camp-opt-title">${config.label}</span>
              <span class="camp-opt-desc">${_getLongRestDesc(config)}. The world moves on while you sleep.</span>
            </div>
          </div>
          <div class="camp-opt-gains">
            ${hpLong > 0 ? `<span class="camp-gain hp">+${hpLongActual} HP${longRationBonus ? ' <span class="camp-ration-tag">(incl. 🥩 +15)</span>' : ''}</span>` : '<span class="camp-gain full">HP full</span>'}
            ${mpLong > 0 ? `<span class="camp-gain mp">+${mpLong > 0 ? Math.floor(mpLong * recovery.longMp) : 0} MP</span>` : '<span class="camp-gain full">MP full</span>'}
          </div>
          <div class="camp-opt-cost">
            <span class="camp-time-cost">⏱ 8 hours pass</span>
            ${bedCost > 0 ? `<span class="camp-gold-cost ${canAffordBed ? '' : 'cant-afford'}">🪙 ${bedCost} gold${canAffordBed ? '' : ' (not enough)'}</span>` : ''}
          </div>
          <button class="camp-btn long-btn" onclick="doLongRest()" ${bedCost > 0 && !canAffordBed ? 'disabled' : ''}>
            🌙 Long Rest ${bedCost > 0 ? `(${bedCost}g)` : ''}
          </button>
        </div>

      </div>

      <div class="camp-rations-row" id="camp-rations-row">
        ${_buildRationsRow(char)}
      </div>
    </div>
  `;

  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    gameLog.appendChild(panel);
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  } else {
    document.body.appendChild(panel);
  }
  requestAnimationFrame(() => panel.style.opacity = '1');
}

function _getLongRestDesc(config) {
  const map = {
    inn:       'A proper bed, a fire, a meal',
    urban:     'Curled in a doorway, one hand on your blade',
    camp:      'Wrapped in your bedroll, fire burning low',
    exposed:   'Under open sky, whatever comes may come',
    dangerous: 'Against the wall, weapon drawn across your knees',
  };
  return map[config.restType] || 'Rest as best you can';
}

function _buildRationsRow(char) {
  const rations = (char.inventory || []).filter(i => i.toLowerCase().includes('ration'));
  if (!rations.length) return `<div class="camp-rations-note">No rations. Resting without food restores 10% less HP.</div>`;
  return `<div class="camp-rations-note">🥩 ${rations.length} Iron Rations — eating one during rest adds +10 HP recovery.</div>`;
}

// ─── SHORT REST ───────────────────────────────────────────
function doShortRest() {
  const locId    = window.mapState?.currentLocation || 'vaelthar_city';
  const loc      = window.WORLD_LOCATIONS?.[locId] || {};
  const config   = CAMP_CONFIGS[loc.type] || CAMP_CONFIGS.road;
  const recovery = REST_RECOVERY[config.restType] || REST_RECOVERY.camp;
  const char     = gameState.character;
  if (!char) return;

  const hpGain = Math.floor((char.maxHp - char.hp) * recovery.shortHp);
  const mpGain = Math.floor((char.maxMp - char.mp) * recovery.shortMp);

  // #32: only eat a ration if it will actually restore HP. At (or effectively at) full
  // HP the ration bonus heals 0, so don't waste the food.
  const missingHp = char.maxHp - char.hp;
  const rationIdx = (char.inventory || []).findIndex(i => i.toLowerCase().includes('ration'));
  const wouldHeal = Math.min(missingHp, hpGain + 10) - Math.min(missingHp, hpGain); // marginal HP from the ration
  const hasRation = rationIdx !== -1 && wouldHeal > 0;
  const rationBonus = hasRation ? 10 : 0;
  if (hasRation) char.inventory.splice(rationIdx, 1);

  char.hp = Math.min(char.maxHp, char.hp + hpGain + rationBonus);
  char.mp = Math.min(char.maxMp, char.mp + mpGain);

  advanceTime(1);
  closeCampPanel();

  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`🔥 SHORT REST — 1 hour passes.`, 'system');
  addLog(`${_shortRestFlavour(config.restType)}`, 'narrator');
  if (hpGain + rationBonus > 0) addLog(`💚 Recovered ${hpGain + rationBonus} HP. (${char.hp}/${char.maxHp})`, 'holy');
  if (mpGain > 0) addLog(`💧 Recovered ${mpGain} MP. (${char.mp}/${char.maxMp})`, 'holy');
  if (hasRation) addLog(`🥩 Ate Iron Rations during rest. +10 HP bonus.`, 'holy');
  addLog(`${getTimeOfDay().icon} It is now ${getTimeOfDay().name} of Day ${window.worldClock.day}.`, 'system');

  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.autoSave) autoSave();
}

function _shortRestFlavour(restType) {
  const lines = {
    inn:       'You find a corner bench, elevate your wounds, and let the fire do the rest.',
    urban:     'A doorway, a wall at your back. You close your eyes for an hour. No one bothers you.',
    camp:      'You sit by the embers and work on your wounds in silence.',
    exposed:   'No shelter here. You make do. The road teaches pragmatism.',
    dangerous: 'You do not fully sleep — ears open, hand on hilt — but the body recovers what it can.',
  };
  return lines[restType] || 'You rest for an hour.';
}

// ─── LONG REST ────────────────────────────────────────────
function doLongRest() {
  const locId    = window.mapState?.currentLocation || 'vaelthar_city';
  const loc      = window.WORLD_LOCATIONS?.[locId] || {};
  const config   = CAMP_CONFIGS[loc.type] || CAMP_CONFIGS.road;
  const recovery = REST_RECOVERY[config.restType] || REST_RECOVERY.camp;
  const char     = gameState.character;
  if (!char) return;

  // Pay for bed if required
  if (config.bedCost > 0) {
    if ((char.gold || 0) < config.bedCost) { toast('Not enough gold for a room!', 'error'); return; }
    char.gold -= config.bedCost;
    addLog(`🪙 Paid ${config.bedCost} gold for lodging.`, 'system');
  }

  // #32: only eat a ration if it will actually restore HP. The ration's +15 only counts
  // if the base recovery doesn't already top the player off, so a full-HP rest (or one
  // already capped by maxHp) won't waste the food.
  const missingHp = char.maxHp - char.hp;
  const baseLongHp = Math.floor(missingHp * recovery.longHp);
  const rationIdx = (char.inventory || []).findIndex(i => i.toLowerCase().includes('ration'));
  const wouldHeal = Math.min(missingHp, baseLongHp + 15) - Math.min(missingHp, baseLongHp); // marginal HP from the ration
  const hasRation = rationIdx !== -1 && wouldHeal > 0;
  const rationBonus = hasRation ? 15 : 0;
  if (hasRation) char.inventory.splice(rationIdx, 1);

  // Calculate recovery
  const hpGain = Math.min(missingHp, baseLongHp + rationBonus);
  const mpGain = Math.min(char.maxMp - char.mp, Math.floor((char.maxMp - char.mp) * recovery.longMp));

  char.hp = Math.min(char.maxHp, char.hp + hpGain);
  char.mp = Math.min(char.maxMp, char.mp + mpGain);

  advanceTime(8);
  closeCampPanel();

  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`🌙 LONG REST — 8 hours pass.`, 'system');
  addLog(`${_longRestFlavour(config.restType)}`, 'narrator');
  if (hpGain > 0) addLog(`💚 Recovered ${hpGain} HP. (${char.hp}/${char.maxHp})`, 'holy');
  if (mpGain > 0) addLog(`💧 Recovered ${mpGain} MP. (${char.mp}/${char.maxMp})`, 'holy');
  if (hasRation) addLog(`🥩 Ate Iron Rations during rest. +15 HP bonus.`, 'holy');

  // Roll for a world event while you slept
  setTimeout(() => _rollSleepEvent(loc, config), 1200);

  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.autoSave) autoSave();
}

function _longRestFlavour(restType) {
  const lines = {
    inn:       'The bed is hard and the pillow smells of strangers, but sleep comes. Deep, dreamless sleep.',
    urban:     'You wedge yourself into the doorway and pull your cloak tight. The city breathes around you all night.',
    camp:      'The fire burns down to coals. An owl somewhere. You sleep in shifts and let the dark hours pass.',
    exposed:   'The stars are wrong tonight. But morning comes regardless, cold and honest.',
    dangerous: 'You sleep badly. Your dreams are full of sounds that might be real. You wake having healed, somehow, against all probability.',
  };
  return lines[restType] || 'You sleep for eight hours.';
}

// ─── SLEEP EVENTS ─────────────────────────────────────────
function _rollSleepEvent(loc, config) {
  const char = gameState.character;
  if (!char) return;

  // 45% chance something happens while you sleep
  if (Math.random() > 0.45) {
    addLog(`${getTimeOfDay().icon} It is now ${getTimeOfDay().name} of Day ${window.worldClock.day}. Nothing disturbed your sleep.`, 'system');
    return;
  }

  // Filter eligible events
  const eligible = SLEEP_EVENTS.filter(ev => {
    if (getFlag('sleep_event_' + ev.id + '_done')) return false; // don't repeat
    try { return ev.condition(loc, config) !== false; }
    catch { return false; }
  });

  if (!eligible.length) {
    addLog(`${getTimeOfDay().icon} It is now ${getTimeOfDay().name} of Day ${window.worldClock.day}.`, 'system');
    return;
  }

  // Weighted pick
  const totalW = eligible.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalW;
  let chosen = eligible[eligible.length - 1];
  for (const ev of eligible) { r -= ev.weight; if (r <= 0) { chosen = ev; break; } }

  // Fire event
  setFlag('sleep_event_' + chosen.id + '_done', true);

  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`🌙 WHILE YOU SLEPT — ${chosen.title}`, 'system');
  addLog(chosen.text, 'narrator');
  chosen.effect(char);

  addLog(`${getTimeOfDay().icon} It is now ${getTimeOfDay().name} of Day ${window.worldClock.day}.`, 'system');

  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.autoSave) autoSave();
}

// ─── CLOSE PANEL ─────────────────────────────────────────
function closeCampPanel() {
  document.getElementById('camp-panel')?.remove();
}

// ─── INJECT CLOCK INTO HUD ───────────────────────────────
function injectClockHUD() {
  const locPanel = document.getElementById('location-mini-panel');
  if (!locPanel || document.getElementById('world-clock')) return;
  const clockEl = document.createElement('div');
  clockEl.id = 'world-clock';
  clockEl.className = 'world-clock';
  locPanel.insertAdjacentElement('afterend', clockEl);
  _updateClockUI();
}

// ─── CAMP BUTTON (added to quick actions by this script) ──
function _injectCampButton() {
  const qa = document.querySelector('.quick-actions');
  if (!qa || document.getElementById('camp-qa-btn')) return;
  // #81: also bail if a Camp button (labeled ⛺) already exists in the bar.
  if ([...qa.querySelectorAll('.qa-btn')].some(b => b.textContent.includes('⛺'))) return;
  const btn = document.createElement('button');
  btn.id = 'camp-qa-btn';
  btn.className = 'qa-btn';
  btn.style.cssText = 'border-color:rgba(100,160,220,0.4);color:#6aa0d4';
  btn.textContent = '⛺ Camp';
  btn.onclick = openCampPanel;
  // Insert before the World Map button
  const mapBtn = [...qa.querySelectorAll('.qa-btn')].find(b => b.textContent.includes('World Map'));
  if (mapBtn) qa.insertBefore(btn, mapBtn);
  else qa.appendChild(btn);
}

// ─── CSS ─────────────────────────────────────────────────
(function injectCampCSS() {
  const s = document.createElement('style');
  s.textContent = `
  /* ── World Clock ── */
  .world-clock {
    font-family: 'Cinzel', serif;
    font-size: 0.68rem;
    color: rgba(201,168,76,0.55);
    letter-spacing: 0.04em;
    padding: 4px 0 2px;
    text-align: center;
  }

  /* ── Camp Panel ── */
  .camp-panel {
    background: linear-gradient(180deg, rgba(4,8,12,0.99) 0%, rgba(8,12,20,0.99) 100%);
    border: 1px solid rgba(100,160,220,0.25);
    border-top: 2px solid rgba(100,160,220,0.4);
    margin: 8px 0;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .camp-inner { padding: 20px 24px 18px; }

  .camp-header {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(100,160,220,0.12);
  }
  .camp-loc-icon { font-size: 36px; flex-shrink: 0; }
  .camp-header-text { flex: 1; }
  .camp-title { font-family:'Cinzel',serif; color:rgba(160,200,240,0.9); font-size:0.95rem; }
  .camp-subtitle { font-size:0.68rem; color:rgba(255,255,255,0.35); margin-top:2px; }
  .camp-close { background:none; border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.3); padding:4px 10px; cursor:pointer; font-size:0.75rem; }
  .camp-close:hover { color:rgba(255,255,255,0.6); border-color:rgba(255,255,255,0.3); }

  .camp-status { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .camp-stat { display:flex; align-items:center; gap:8px; }
  .camp-stat-label { font-family:'Cinzel',serif; font-size:0.65rem; color:rgba(255,255,255,0.4); width:22px; }
  .camp-bar-wrap { flex:1; height:6px; background:rgba(255,255,255,0.07); border-radius:3px; overflow:hidden; }
  .camp-bar { height:100%; border-radius:3px; transition:width 0.5s ease; }
  .hp-bar { background:linear-gradient(90deg,#c04040,#e06060); }
  .mp-bar { background:linear-gradient(90deg,#4060c0,#6080e0); }
  .camp-stat-val { font-size:0.65rem; color:rgba(255,255,255,0.4); width:60px; text-align:right; }

  .camp-warning {
    background:rgba(200,100,0,0.1); border:1px solid rgba(200,100,0,0.25);
    color:rgba(220,140,60,0.8); font-size:0.7rem; padding:6px 10px; margin-bottom:12px;
  }

  .camp-options { display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
  .camp-option {
    flex:1; min-width:220px;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(100,160,220,0.12);
    padding:14px 16px;
  }
  .camp-opt-header { display:flex; gap:10px; align-items:flex-start; margin-bottom:10px; }
  .camp-opt-icon { font-size:28px; flex-shrink:0; }
  .camp-opt-info { display:flex; flex-direction:column; gap:3px; }
  .camp-opt-title { font-family:'Cinzel',serif; color:rgba(200,220,255,0.85); font-size:0.82rem; }
  .camp-opt-desc { font-size:0.67rem; color:rgba(255,255,255,0.35); font-style:italic; line-height:1.5; }
  .camp-opt-gains { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
  .camp-gain { font-size:0.65rem; padding:2px 7px; border-radius:2px; }
  .camp-gain.hp  { background:rgba(180,60,60,0.15); color:#e08080; border:1px solid rgba(180,60,60,0.2); }
  .camp-gain.mp  { background:rgba(60,80,200,0.15); color:#8090e0; border:1px solid rgba(60,80,200,0.2); }
  .camp-gain.full{ background:rgba(80,200,80,0.1);  color:#80c080; font-style:italic; }
  .camp-opt-cost { display:flex; gap:8px; margin-bottom:10px; }
  .camp-time-cost { font-size:0.62rem; color:rgba(255,255,255,0.3); }
  .camp-gold-cost { font-size:0.62rem; color:var(--gold,#c9a84c); }
  .camp-gold-cost.cant-afford { color:#c06060; }

  .camp-btn {
    width:100%; padding:8px; cursor:pointer;
    font-family:'Cinzel',serif; font-size:0.72rem; letter-spacing:0.04em;
    transition:all .2s; border-radius:1px;
  }
  .short-btn {
    background:rgba(200,140,60,0.12); border:1px solid rgba(200,140,60,0.3); color:rgba(220,160,80,0.9);
  }
  .short-btn:hover:not(:disabled) { background:rgba(200,140,60,0.22); }
  .long-btn {
    background:rgba(60,100,180,0.12); border:1px solid rgba(60,100,180,0.35); color:rgba(100,150,220,0.9);
  }
  .long-btn:hover:not(:disabled) { background:rgba(60,100,180,0.22); }
  .camp-btn:disabled { opacity:0.35; cursor:default; }
  .camp-option.maxed { opacity:0.55; }

  .camp-rations-row {
    border-top:1px solid rgba(100,160,220,0.08);
    padding-top:8px;
    margin-top:4px;
  }
  .camp-rations-note { font-size:0.67rem; color:rgba(255,255,255,0.3); font-style:italic; }
  .camp-ration-tag { font-size:0.6rem; color:rgba(220,160,80,0.85); font-style:normal; }
  `;
  document.head.appendChild(s);
})();

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    injectClockHUD();
    _injectCampButton();
  }, 800);
});

// Re-inject when game screen becomes active
const _campOrigShowScreen = window.showScreen;
if (_campOrigShowScreen) {
  window.showScreen = function(name) {
    _campOrigShowScreen(name);
    if (name === 'game') {
      setTimeout(() => { injectClockHUD(); _injectCampButton(); }, 400);
    }
  };
}

console.log('⛺ Camp & rest system loaded.');
