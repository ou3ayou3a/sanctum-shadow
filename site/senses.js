// ============================================
//   SANCTUM & SHADOW — SENSES & SUBSTANCES
//   Drinking / Drunk mechanics
//   Perception / Sight checks
//   Tavern interactions
// ============================================

// ─── DRUNK STATE ──────────────────────────────
window.drunkState = {
  cups: 0,               // ales consumed this session
  isDrunk: false,
  severity: 0,           // 0=sober 1=tipsy 2=drunk 3=wasted
  soberAt: null,         // timestamp when effects wear off
  tempChaBonus: 0,
  tempDexPenalty: 0,
  tempPerPenalty: 0,
  vomited: false,
};

const DRUNK_THRESHOLDS = [
  { cups: 1, severity: 0, label: 'Sober',  chaBonus: 0,  dexPen: 0,  perPen: 0 },
  { cups: 2, severity: 0, label: 'Sober',  chaBonus: 0,  dexPen: 0,  perPen: 0 },
  { cups: 3, severity: 1, label: 'Tipsy',  chaBonus: 2,  dexPen: 1,  perPen: 0 },
  { cups: 4, severity: 2, label: 'Drunk',  chaBonus: 4,  dexPen: 3,  perPen: 2 },
  { cups: 5, severity: 2, label: 'Drunk',  chaBonus: 4,  dexPen: 3,  perPen: 2 },
  { cups: 6, severity: 3, label: 'Wasted', chaBonus: 2,  dexPen: 6,  perPen: 4 },
];

// Proper English ordinal — 'first', 'second', 'third', then '4th', '5th', '21st'...
function ordinal(n) {
  const words = ['zeroth','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
  if (n >= 0 && n < words.length) return words[n];
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const DRUNK_VISUALS = {
  0: { filter: 'none',                               msg: '' },
  1: { filter: 'blur(0.3px) brightness(1.05)',       msg: '🍺 You feel warm. The world has a pleasant glow to it.' },
  2: { filter: 'blur(0.8px) brightness(1.1) hue-rotate(5deg)',   msg: '🍺🍺 The room is spinning a little. Your tongue is loose and your laugh comes easy.' },
  3: { filter: 'blur(2px) brightness(1.15) hue-rotate(15deg) saturate(1.3)', msg: '🍺🍺🍺 The world has gone beautifully sideways. You feel invincible. You are not.' },
};

function drinkAle(quantity = 1, drinkName = 'ale') {
  const char = gameState.character;
  if (!char) return;

  window.drunkState.cups += quantity;
  const cups = window.drunkState.cups;
  const level = DRUNK_THRESHOLDS[Math.min(cups - 1, DRUNK_THRESHOLDS.length - 1)];

  const prevSeverity = window.drunkState.severity;
  window.drunkState.severity = level.severity;
  window.drunkState.isDrunk = level.severity > 0;
  window.drunkState.tempChaBonus = level.chaBonus;
  window.drunkState.tempDexPenalty = level.dexPen;
  window.drunkState.tempPerPenalty = level.perPen;

  // Set sober time (1 real minute per cup, for gameplay)
  const soberMs = cups * 60 * 1000;
  window.drunkState.soberAt = Date.now() + soberMs;

  // Apply visual effect
  applyDrunkVisual(level.severity);

  // Log message
  const cupWord = `${ordinal(cups)} cup`;
  addLog(`🍺 You drink your ${cupWord} of ${drinkName}.`, 'system');

  if (level.severity > prevSeverity) {
    addLog(DRUNK_VISUALS[level.severity].msg, 'narrator');
    if (level.severity === 1) {
      addLog(`✨ TIPSY: +${level.chaBonus} CHA (temp), -${level.dexPen} DEX (temp)`, 'holy');
    } else if (level.severity === 2) {
      addLog(`🌀 DRUNK: +${level.chaBonus} CHA (temp), -${level.dexPen} DEX (temp), -${level.perPen} PER (temp)`, 'system');
    } else if (level.severity === 3) {
      addLog(`💀 WASTED: You can barely stand. +${level.chaBonus} CHA (temp), -${level.dexPen} DEX, -${level.perPen} PER. Roll DEX to avoid falling.`, 'hell');
      // Roll to stay upright
      const roll = Math.floor(Math.random() * 20) + 1;
      const dexMod = Math.floor(((char.stats?.dex || 10) - 10) / 2) - level.dexPen;
      addLog(`🎲 DEX check to stay upright: [${roll}] + ${dexMod} = ${roll + dexMod}`, 'dice');
      if (roll + dexMod < 8) {
        addLog(`*${char.name} stumbles and crashes into a table. The whole tavern watches.*`, 'narrator');
        grantHellPoints(1);
      }
    }
    showDrunkStatus(level);
    if (typeof renderPlayerCard === 'function') renderPlayerCard();
  } else {
    // Same level, just more drunk
    addLog(`You feel it building.`, 'system');
  }

  // Start sobering timer
  startSoberTimer();
}

function applyDrunkVisual(severity) {
  const visual = DRUNK_VISUALS[severity];
  const gameLog = document.getElementById('game-log');
  const centerPanel = document.querySelector('.center-panel');
  if (centerPanel) {
    centerPanel.style.transition = 'filter 1.5s ease';
    centerPanel.style.filter = visual.filter;
  }
  // Wobble text on log
  if (severity >= 2 && gameLog) {
    gameLog.style.transition = 'transform 0.5s ease';
    gameLog.style.transform = `rotate(${(Math.random() - 0.5) * severity * 0.8}deg)`;
  } else if (gameLog) {
    gameLog.style.transform = 'none';
  }
}

function showDrunkStatus(level) {
  const old = document.getElementById('drunk-status');
  if (old) old.remove();
  if (level.severity === 0) return;

  const icons = ['','🍺','🍺🍺','🍺🍺🍺'];
  const bar = document.createElement('div');
  bar.id = 'drunk-status';
  bar.style.cssText = `
    position:fixed; bottom:80px; right:16px; z-index:800;
    background:rgba(8,5,2,0.95); border:1px solid rgba(180,130,40,0.4);
    padding:8px 14px; font-family:'Cinzel',serif; font-size:0.68rem;
    color:var(--gold); min-width:160px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.8);
  `;
  bar.innerHTML = `
    <div style="font-size:0.9rem;margin-bottom:4px">${icons[level.severity]} ${level.label}</div>
    <div style="color:#8bc87a;font-size:0.62rem">+${level.chaBonus} CHA</div>
    <div style="color:var(--hell-glow);font-size:0.62rem">-${level.dexPen} DEX  -${level.perPen} PER</div>
    <div style="margin-top:6px">
      ${Array(window.drunkState.cups).fill('🍺').join('')}
    </div>
    <button onclick="document.getElementById('drunk-status').remove()"
      style="margin-top:6px;font-size:0.55rem;background:none;border:none;color:var(--text-dim);cursor:pointer">✕</button>
  `;
  document.body.appendChild(bar);
}

function startSoberTimer() {
  if (window._soberTimer) clearInterval(window._soberTimer);
  window._soberTimer = setInterval(() => {
    if (!window.drunkState.soberAt) return;
    if (Date.now() >= window.drunkState.soberAt) {
      soberUp();
      clearInterval(window._soberTimer);
    }
  }, 5000);
}

function soberUp() {
  const wasDrunk = window.drunkState.severity > 0;
  window.drunkState = {
    cups: 0, isDrunk: false, severity: 0,
    soberAt: null, tempChaBonus: 0,
    tempDexPenalty: 0, tempPerPenalty: 0, vomited: false,
  };
  applyDrunkVisual(0);
  document.getElementById('drunk-status')?.remove();
  if (wasDrunk) {
    addLog(`😓 The drink wears off. Your head pounds. The world is disappointingly level again.`, 'system');
    if (typeof renderPlayerCard === 'function') renderPlayerCard();
  }
}

// ─── EFFECTIVE STATS (with drunk modifiers) ───
// Patches stat lookups to apply drunk effects
function getEffectiveStat(statKey) {
  const char = gameState.character;
  if (!char) return 10;
  const base = char.stats?.[statKey] || 10;
  if (!window.drunkState.isDrunk) return base;
  let mod = 0;
  if (statKey === 'cha') mod += window.drunkState.tempChaBonus;
  if (statKey === 'dex') mod -= window.drunkState.tempDexPenalty;
  if (statKey === 'per') mod -= window.drunkState.tempPerPenalty;
  if (statKey === 'wis') mod -= Math.floor(window.drunkState.tempPerPenalty / 2);
  return base + mod;
}

// ─── PERCEPTION / SIGHT CHECKS ────────────────
const PERCEPTION_KEYWORDS = [
  /\b(look|search|examine|inspect|investigate|check|scan|observe|study|survey)\b/i,
  /\b(look around|look carefully|search the room|check the room)\b/i,
  /\b(sight check|perception check|notice|spot|detect)\b/i,
  /\b(is there anything|anything hidden|any clues?|any secrets?)\b/i,
  /\b(search for|look for|find something|see anything)\b/i,
  /\bright sight\b|\bkeep watch\b|\bscan the area\b/i,
];

const LIGHT_LEVELS = {
  vaelthar_city: 'dim', temple_quarter: 'dim',
  thornwood_gate: 'dark', thornwood_passage: 'dark',
  mol_village: 'dim', monastery_aldric: 'dark',
  catacombs: 'pitch_dark', shadow_reaches: 'pitch_dark',
  void_citadel: 'dark', shattered_realm: 'pitch_dark',
  vaelthar_slums: 'dark', vaelthar_docks: 'dim',
  merchant_road: 'bright', church_archive: 'dim',
  fortress_harren: 'dim', ashen_fields: 'dark',
  tower_ash: 'pitch_dark', lost_cartographer: 'dark',
  // Taverns — use their own lightLevel or default to dim
  tarnished_cup: 'dim', temple_wine_house: 'dim',
  gatehouse_ale: 'dim', mol_hearthfire: 'dim',
  monastery_cellar: 'dark', roadside_inn: 'dim',
  harren_hall: 'dim', ashen_camp: 'dark',
  tower_antechamber: 'pitch_dark', thornwood_hut: 'dark',
  cartographer_flask: 'dark', archive_scriptorium: 'dark',
};

const LIGHT_DC = { bright: 5, dim: 10, dark: 15, pitch_dark: 20 };
const LIGHT_LABEL = {
  bright:     '☀ Bright',
  dim:        '🕯 Dim light',
  dark:       '🌑 Darkness',
  pitch_dark: '⬛ Pitch black',
};

async function rollPerception(locationOverride) {
  const char = gameState.character;
  if (!char) return;

  const locId = locationOverride || window.mapState?.currentLocation || 'vaelthar_city';
  const lightLevel = LIGHT_LEVELS[locId] || 'dim';
  const dc = LIGHT_DC[lightLevel];
  const lightLabel = LIGHT_LABEL[lightLevel];
  addLog(`👁 PERCEPTION CHECK — ${lightLabel} (DC ${dc})`, 'system');
  if (typeof window.resolveActionRequest === 'function') {
    return window.resolveActionRequest(`Search ${locId} carefully for hidden details`, {
      skill:'perception', ability:'wis', dc,
      disadvantage: !!window.drunkState?.isDrunk,
    });
  }
}

// ─── DRINKING TRIGGER DETECTION ───────────────
const DRINK_PATTERNS = [
  { re: /\bdrink (an? )?(ale|beer|mead|drink|cup|pint|tankard)\b/i, qty: 1 },
  { re: /\border (an? )?(ale|beer|mead|drink|cup|pint|tankard)\b/i, qty: 1 },
  { re: /\bbuy (an? )?(ale|beer|mead|drink|cup|pint|tankard)\b/i, qty: 1 },
  { re: /\bhave (an? )?(ale|beer|mead|drink|cup|pint|tankard)\b/i, qty: 1 },
  { re: /\bdrink (two|2) (ales?|beers?|meads?|cups?|pints?)\b/i, qty: 2 },
  { re: /\banother (ale|beer|mead|drink|round)\b/i, qty: 1 },
  { re: /\bkeep (them|the drinks?) coming\b/i, qty: 2 },
  { re: /\bdrink (all night|until|myself)\b/i, qty: 3 },
  { re: /\bchug\b/i, qty: 2 },
];

const PERCEPTION_TRIGGERS = [
  /\blook around\b/i, /\bsearch the room\b/i, /\bperception check\b/i,
  /\bsight check\b/i, /\bcheck for clues\b/i, /\binvestigate the room\b/i,
  /\bnotice anything\b/i, /\bsearch for (clues|secrets|hidden|anything)\b/i,
  /\bexamine (the room|my surroundings|everything|carefully)\b/i,
  /\blook carefully\b/i, /\bscan the area\b/i, /\bspot (anything|something)\b/i,
];

// ─── HOOK INTO ACTION SUBMISSION ──────────────
const _origSubmitAction_senses = window.submitAction;
window.submitAction = function() {
  const input = document.getElementById('action-input');
  const text = (input?.value || '').trim();
  if (!text) return;

  // Perception check
  if (PERCEPTION_TRIGGERS.some(p => p.test(text))) {
    input.value = '';
    addLog(`👁 ${gameState.character?.name}: "${text}"`, 'player');
    rollPerception();
    return;
  }

  // Drinking
  for (const pattern of DRINK_PATTERNS) {
    if (pattern.re.test(text)) {
      const loc = window.mapState?.currentLocation;
      // Can drink anywhere but tavern is the main spot
      const drinkName = text.match(/ale|beer|mead|wine|whiskey|spirit/i)?.[0]?.toLowerCase() || 'ale';
      input.value = '';
      addLog(`🍺 ${gameState.character?.name}: "${text}"`, 'player');
      drinkAle(pattern.qty, drinkName);
      // If at tavern, Lyra serves you
      const locData = WORLD_LOCATIONS[loc];
      if (locData?.type === 'tavern') {
        const tavernLines = {
          tarnished_cup: [
            `*Lyra slides the tankard across with a practiced flick.*`,
            `*Lyra refills without being asked, watching you with mild concern.*`,
            `*Lyra sets another down. "Last one," she says — for the third time.*`,
            `*Lyra leans on the bar. "Double charge for people who can't stand up."*`,
          ],
          temple_wine_house: [
            `*Vesna places the wine glass down without a word or a smile.*`,
            `*Vesna refills your glass, her expression suggesting she disapproves but won't say so.*`,
            `*Vesna eyes you. "The bitter one next. You look like you need it."*`,
          ],
          gatehouse_ale: [
            `*Donal slides the cup over and makes a small mark on his board.*`,
            `*Donal refills your cup without ceremony. He glances at the door after.*`,
            `*Donal watches you drink. "You going into the wood?" he asks.*`,
          ],
          mol_hearthfire: [
            `*Breta pours without measuring. The spirit is strong.*`,
            `*Breta fills your cup to the brim. "The preacher was right. Drink."*`,
          ],
          monastery_cellar: [
            `*You pour your own. The wine is 80 years old and tastes like it.*`,
            `*Another bottle. The label says something in a dead language.*`,
          ],
          roadside_inn: [
            `*Tomas slides the ale over, keeping one eye on the boarded window.*`,
            `*Tomas refills it. He doesn't comment on how many that is.*`,
          ],
          harren_hall: [
            `*Grisel pours without asking, the way soldiers do.*`,
            `*Grisel refills in silence. The squire hasn't moved.*`,
          ],
          ashen_camp: [
            `*You take a bottle from the crate. No one charges you.*`,
            `*The fire crackles blue as you open another bottle.*`,
          ],
          tower_antechamber: [
            `*You open one of the black bottles. Your hands stop shaking.*`,
          ],
          thornwood_hut: [
            `*The barrel is full again. You're fairly sure it wasn't before.*`,
          ],
          cartographer_flask: [
            `*You take a flask. The cartographer nods without looking up from his map.*`,
          ],
          archive_scriptorium: [
            `*You pull a bottle from between two ancient texts. It's exceptional.*`,
          ],
        };
        const lines = tavernLines[loc] || [`*The barkeep slides a cup toward you.*`];
        const line = lines[Math.min(Math.floor(window.drunkState.cups / 2), lines.length - 1)];
        addLog(line, 'narrator');
      }
      return;
    }
  }

  // Pass through to original
  if (_origSubmitAction_senses) _origSubmitAction_senses();
};

// ─── QUICK ACTION BUTTONS ─────────────────────
// Add Perceive and Drink buttons to quick action bar
function addSensesButtons() {
  const qa = document.querySelector('.quick-actions');
  if (!qa || document.getElementById('perceive-btn')) return;

  const perceiveBtn = document.createElement('button');
  perceiveBtn.id = 'perceive-btn';
  perceiveBtn.className = 'qa-btn';
  perceiveBtn.style.cssText = 'border-color:rgba(74,180,200,0.4);color:#7abcd4';
  perceiveBtn.textContent = '👁 Perceive';
  perceiveBtn.onclick = () => rollPerception();
  qa.appendChild(perceiveBtn);

  const drinkBtn = document.createElement('button');
  drinkBtn.id = 'drink-btn';
  drinkBtn.className = 'qa-btn';
  drinkBtn.style.cssText = 'border-color:rgba(180,130,40,0.4);color:#c9a84c';
  drinkBtn.textContent = '🍺 Drink';
  drinkBtn.onclick = () => {
    const loc = window.mapState?.currentLocation;
    const locData = WORLD_LOCATIONS[loc];
    if (locData?.type !== 'tavern') {
      addLog(`There's nowhere to drink here. Find a tavern first.`, 'system'); return;
    }
    drinkAle(1);
  };
  qa.appendChild(drinkBtn);
}

// Also expose rollPerception globally so it can be called from story/dialogue
window.rollPerception = rollPerception;
window.drinkAle = drinkAle;
window.getEffectiveStat = getEffectiveStat;

// ─── PATCH initGameScreen to add buttons ──────
const _origInit_senses = window.initGameScreen;
window.initGameScreen = function() {
  if (_origInit_senses) _origInit_senses();
  setTimeout(addSensesButtons, 700);
};

// ─── DRUNK MODIFIER ON COMBAT ROLLS ───────────
// Apply the drunk AC penalty ONCE per drunk state, not per attack click.
// We track how much we've currently subtracted (combatState._drunkAcApplied)
// and only adjust by the delta when the drunk state changes.
function syncDrunkAcPenalty() {
  const cs = window.combatState;
  if (!cs) return;
  const player = cs.combatants?.['player'];
  if (!player) return;
  const desired = window.drunkState.isDrunk ? (window.drunkState.tempDexPenalty || 0) : 0;
  const applied = cs._drunkAcApplied || 0;
  if (desired === applied) return;
  // Restore previously applied penalty, then apply the new one
  player.ac = (player.ac || 0) + applied - desired;
  cs._drunkAcApplied = desired;
  if (desired > applied && window.drunkState.severity >= 2) {
    addLog(`🌀 Drunk penalty: -${desired} AC — the drink affects your coordination.`, 'system');
  }
}
window.syncDrunkAcPenalty = syncDrunkAcPenalty;

const _origCombatAttack_senses = window.combatAttack;
window.combatAttack = function() {
  syncDrunkAcPenalty();
  if (_origCombatAttack_senses) _origCombatAttack_senses();
};

// Restore the AC penalty when combat ends so it never lingers between fights.
function _wrapEndCombatForDrunk() {
  if (!window.endCombat || window.endCombat._drunkWrapped) {
    if (!window.endCombat) { setTimeout(_wrapEndCombatForDrunk, 400); }
    return;
  }
  const _origEndCombat_senses = window.endCombat;
  window.endCombat = function(...args) {
    const cs = window.combatState;
    if (cs && cs._drunkAcApplied) {
      const player = cs.combatants?.['player'];
      if (player) player.ac = (player.ac || 0) + cs._drunkAcApplied;
      cs._drunkAcApplied = 0;
    }
    return _origEndCombat_senses(...args);
  };
  window.endCombat._drunkWrapped = true;
}
_wrapEndCombatForDrunk();

// ─── CSS ──────────────────────────────────────
const sensesCSS = `
#drunk-status {
  animation: drunkPulse 3s ease-in-out infinite;
}
@keyframes drunkPulse {
  0%,100% { opacity:1; transform:none; }
  50% { opacity:0.85; transform:rotate(-0.5deg) translateX(1px); }
}
.qa-btn#perceive-btn:hover { background:rgba(74,180,200,0.1); }
.qa-btn#drink-btn:hover { background:rgba(180,130,40,0.1); }
`;
const sStyle = document.createElement('style');
sStyle.textContent = sensesCSS;
document.head.appendChild(sStyle);

console.log('👁 Senses & Substances loaded. 🍺 Drink wisely. 👁 See clearly.');
