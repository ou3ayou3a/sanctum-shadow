// ============================================
//   SANCTUM & SHADOW — COMBAT ENGINE v2
//   Full spell UI, XP/leveling, area levels,
//   HP bars for normals, hidden for bosses,
//   auto-combat triggers, flee mechanics
// ============================================

// ─── CONSTANTS ───────────────────────────────
const AP_COSTS = { move:1, attack:1, spell:2, pray:1, item:1, dash:2, free:0 };
const MAX_AP = 3;
const COMBAT_RULES = window.SanctumRules;
if (!COMBAT_RULES) throw new Error('SanctumRules must load before combat.js');

// XP needed per level (level 1→2 needs 100 XP, etc.)
// #24: extended to level 20. Indices 0-10 unchanged; 11-20 continue the curve
// with increasing thresholds so levels 12-20 are actually reachable.
const XP_TABLE = [0,100,250,450,700,1000,1400,1900,2500,3200,4000,
                  4900,5900,7000,8200,9500,10900,12400,14000,15700,17500];
window.XP_TABLE = XP_TABLE;

// Spells learned at each level (max 5 spells, last at level 10)
const SPELL_LEARN_LEVELS = [1, 3, 5, 7, 10];

// Area danger levels — keyed to REAL location ids in map.js WORLD_LOCATIONS
const AREA_LEVELS = {
  vaelthar_city: 1, tarnished_cup: 1,
  temple_quarter: 2, merchant_road: 2,
  thornwood_gate: 2, thornwood_passage: 3,
  mol_village: 3, monastery_aldric: 3,
  fortress_harren: 4, lost_cartographer: 3,
  church_archive: 4, ashen_fields: 5,
  tower_ash: 8,
};

// ─── COMBAT STATE ─────────────────────────────
const combatState = {
  active: false,
  round: 0,
  turnOrder: [],
  currentTurnIndex: 0,
  combatants: {},
  apRemaining: MAX_AP,
  log: [],
  selectedSpell: null,
  selectedTarget: null,
  // Status effects: { [combatantId]: [{ id, name, icon, turnsLeft, ...data }] }
  statusEffects: {},
  // Turn-guard tracking (#14): whose turn it is + pending auto-end timer
  whoseTurn: null,
  pendingEndTurnTimer: null,
  endedThisTurn: false,
};
window.combatState = combatState;

function getLocalCombatantId() {
  return window.mp?.sessionCode && window.mp?.playerId ? window.mp.playerId : 'player';
}

function getLocalCombatant() {
  return combatState.combatants[getLocalCombatantId()] || combatState.combatants.player || null;
}

// ─── STATUS EFFECT ENGINE ─────────────────────
function addStatus(targetId, effect) {
  if (!combatState.statusEffects[targetId]) combatState.statusEffects[targetId] = [];
  // Remove existing stack of same type
  combatState.statusEffects[targetId] = combatState.statusEffects[targetId].filter(e => e.id !== effect.id);
  combatState.statusEffects[targetId].push({ ...effect });
  addLog(`${effect.icon} ${combatState.combatants[targetId]?.name} is now ${effect.name}!`, 'system');
}

function hasStatus(targetId, statusId) {
  return (combatState.statusEffects[targetId] || []).some(e => e.id === statusId);
}

function getStatusData(targetId, statusId) {
  return (combatState.statusEffects[targetId] || []).find(e => e.id === statusId);
}

function removeStatus(targetId, statusId) {
  if (!combatState.statusEffects[targetId]) return;
  const e = combatState.statusEffects[targetId].find(s => s.id === statusId);
  if (e) {
    // #17: revert any stat deltas applied at cast (e.g. Shadow Step's ±AC)
    if (e.acDelta) {
      const c = combatState.combatants[targetId];
      if (c) c.ac = (c.ac || 0) - e.acDelta;
    }
    addLog(`${e.icon} ${combatState.combatants[targetId]?.name}: ${e.name} expired.`, 'system');
  }
  combatState.statusEffects[targetId] = combatState.statusEffects[targetId].filter(e => e.id !== statusId);
}

// Called at start of each combatant's turn — tick down durations
function tickStatuses(combatantId) {
  const statuses = combatState.statusEffects[combatantId] || [];
  const toRemove = [];
  statuses.forEach(s => {
    s.turnsLeft--;
    if (s.turnsLeft <= 0) toRemove.push(s.id);
  });
  toRemove.forEach(id => removeStatus(combatantId, id));
}

// Get total attack bonus modifier from statuses
function getAtkMod(combatantId) {
  let mod = 0;
  (combatState.statusEffects[combatantId] || []).forEach(s => {
    if (s.atkMod) mod += s.atkMod;
    // #20: consumable buffs store their flat bonus as bonusAtk/bonusDex
    if (s.bonusAtk) mod += s.bonusAtk;
    if (s.bonusDex) mod += s.bonusDex;
  });
  // smoke_bomb affects this combatant
  if (hasStatus(combatantId, 'smoke_bomb_debuff')) mod -= 4;
  return mod;
}

// Get damage multiplier from statuses (#20: Avatar of War dmgMult, etc.)
function getDmgMult(combatantId) {
  let mult = 1;
  (combatState.statusEffects[combatantId] || []).forEach(s => { if (s.dmgMult) mult *= s.dmgMult; });
  return mult;
}

// Check if combatant is rooted (can't move/act)
function isRooted(combatantId) { return hasStatus(combatantId, 'vine_trap'); }

// Check if combatant is silenced (can't cast spells)
function isSilenced(combatantId) { return hasStatus(combatantId, 'garrote_silence'); }

// Get damage shield amount
function getDmgShield(combatantId) {
  const s = getStatusData(combatantId, 'divine_shield');
  return s ? (s.shieldHp || 0) : 0;
}

// Apply damage through shield first
function applyDamage(targetId, rawDmg) {
  const target = combatState.combatants[targetId];
  if (!target) return rawDmg;

  // #22: Mage glass-cannon vulnerability applies to damage the PLAYER takes
  if (targetId === 'player' && window.getMageVulnerability) {
    rawDmg = getMageVulnerability(rawDmg);
  }

  // Mirror Image: each image absorbs one hit
  if (hasStatus(targetId, 'mirror_image')) {
    const s = getStatusData(targetId, 'mirror_image');
    s.charges--;
    addLog(`👁 Mirror Image absorbs the hit! (${s.charges} images left)`, 'system');
    if (s.charges <= 0) removeStatus(targetId, 'mirror_image');
    return 0; // no damage
  }

  // Divine Shield: absorbs up to shieldHp
  const shield = getDmgShield(targetId);
  if (shield > 0) {
    const s = getStatusData(targetId, 'divine_shield');
    const absorbed = Math.min(shield, rawDmg);
    s.shieldHp -= absorbed;
    const remaining = rawDmg - absorbed;
    addLog(`🔆 Divine Shield absorbs ${absorbed} damage! (${s.shieldHp} left)`, 'holy');
    if (s.shieldHp <= 0) removeStatus(targetId, 'divine_shield');
    return remaining;
  }

  return rawDmg;
}

// ─── SPELL DATABASE (per class, levels 1-10) ─
const CLASS_SPELLS = window.GameplayCatalog.CLASS_SPELLS;

// ─── ENEMY TEMPLATES ─────────────────────────
// Level-scaled enemies per area
function generateEnemy(type, areaLevel) {
  const scale = areaLevel || 1;
  const templates = {
    city_guard:    { name:'City Guard',       icon:'🛡', baseHp:35, baseAc:13, baseAtk:4, xp:60,  spells:[], flee:false, boss:false },
    church_agent:  { name:'Church Agent',     icon:'🗡', baseHp:40, baseAc:13, baseAtk:5, xp:80,  spells:['shadow_step'], flee:false, boss:false },
    bandit:        { name:'Road Bandit',      icon:'💀', baseHp:28, baseAc:10, baseAtk:3, xp:50,  spells:[], flee:false, boss:false },
    cultist:       { name:'Covenant Cultist', icon:'😈', baseHp:30, baseAc:11, baseAtk:4, xp:70,  spells:['hellfire_bolt'], flee:false, boss:false },
    skeleton:      { name:'Risen Skeleton',   icon:'💀', baseHp:20, baseAc:9,  baseAtk:3, xp:40,  spells:[], flee:false, boss:false },
    wolf:          { name:'Dire Wolf',        icon:'🐺', baseHp:35, baseAc:12, baseAtk:5, xp:70,  spells:['savage_bite'], flee:false, boss:false },
    shadow_wraith: { name:'Shadow Wraith',    icon:'🌑', baseHp:40, baseAc:14, baseAtk:4, xp:90,  spells:['shadow_drain'], flee:false, boss:false },
    // ── Strong NPCs — very dangerous but NOT bosses. Visible HP. Only fought if player chooses violence.
    captain_rhael: { name:'Captain Rhael',    icon:'🪖', baseHp:80, baseAc:16, baseAtk:7, xp:300, spells:['war_cry','execute'], flee:false, boss:false },
    sister_mourne: { name:'Sister Mourne',    icon:'🕯', baseHp:65, baseAc:14, baseAtk:5, xp:250, spells:['shadow_curse','soul_drain'], flee:false, boss:false },
    // ── True Bosses — hidden HP bar (??? displayed), cannot be persuaded out, must be defeated
    elder_varek:      { name:'Elder Varek',        icon:'🔥', baseHp:120,baseAc:17, baseAtk:8, xp:600,  spells:['hellfire','divine_wrath','summon_flame'], flee:false, boss:true },
    the_voice_below:  { name:'The Voice Below',    icon:'🕳', baseHp:180,baseAc:18, baseAtk:10,xp:900,  spells:['void_scream','soul_rend','dark_surge'],    flee:false, boss:true },
    shattered_god:    { name:'The Shattered God',  icon:'⚡', baseHp:250,baseAc:20, baseAtk:12,xp:1500, spells:['divine_wrath','hellfire','soul_rend','void_scream'], flee:false, boss:true },
    harren_fallen:    { name:'Sir Harren (Fallen)', icon:'🩸', baseHp:140,baseAc:18, baseAtk:9, xp:750,  spells:['execute','holy_smite_corrupted','war_cry'], flee:false, boss:true },
  };
  const t = templates[type] || templates['bandit'];
  return {
    ...t,
    id: type + '_' + Date.now(),
    hp: Math.floor(t.baseHp * (1 + (scale-1) * 0.4)),
    maxHp: Math.floor(t.baseHp * (1 + (scale-1) * 0.4)),
    ac: t.baseAc + Math.floor(scale * 0.5),
    atk: t.baseAtk + Math.floor(scale * 0.5),
    xp: Math.floor(t.xp * (1 + (scale-1) * 0.3)),
    level: scale + (t.boss ? 2 : 0),
  };
}

// ─── SYNC HP TO UI ───────────────────────────
function syncPlayerHP() {
  const player = getLocalCombatant();
  if (!player || !gameState.character) return;
  // Write back to character
  gameState.character.hp = Math.max(0, player.hp);
  gameState.character.mp = Math.max(0, player.mp);
  gameState.character.maxHp=player.maxHp;
  if(window.classResource){window.classResource.current=player.characterClass==='paladin'?(gameState.character.holyPoints||0):(player.resource||0);window.updateResourceBar?.();}
  // Re-render the left panel stat bars
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
  if (typeof renderStatsMini === 'function') renderStatsMini();
}

// ─── XP & LEVELING ────────────────────────────
function grantXP(amount) {
  const char = gameState.character;
  if (!char) return;
  char.xp = (char.xp || 0) + amount;
  // Player at level L advances to L+1 when total XP >= XP_TABLE[L].
  const nextNeeded = XP_TABLE[(char.level || 1)] || 99999;
  addLog(`✨ +${amount} XP  (${char.xp} / ${nextNeeded} to next level)`, 'system');

  // Loop — handles gaining multiple levels in one shot
  let levelled = false;
  while (true) {
    const lvl = char.level || 1;
    if (lvl + 1 > 20) break;
    const needed = XP_TABLE[lvl]; // XP required to leave level `lvl`
    if (!needed || char.xp < needed) break;
    levelUp(char);
    levelled = true;
  }

  // Always refresh character panel and XP bar
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
  else if (window.updateCharacterPanel) updateCharacterPanel();
  updateXPBar();
}

function updateXPBar() {
  const char = gameState.character;
  if (!char) return;
  const bar = document.getElementById('xp-bar-fill');
  const label = document.getElementById('xp-bar-label');
  if (!bar || !label) return;
  const lvl = char.level || 1;
  const cur = char.xp || 0;
  // Progress within level L: (xp - XP_TABLE[L-1]) / (XP_TABLE[L] - XP_TABLE[L-1])
  const prev = XP_TABLE[lvl - 1] || 0;
  const next = XP_TABLE[lvl] || prev + 1000;
  const pct = Math.max(0, Math.min(100, Math.round(((cur - prev) / (next - prev)) * 100)));
  bar.style.width = pct + '%';
  label.textContent = `${cur} / ${next} XP`;
}

function levelUp(char) {
  char.level = (char.level || 1) + 1;

  // ── HP / MP ──
  const conMod = Math.floor(((char.stats?.con || 10) - 10) / 2);
  // #22: class-specific HP per level (already includes CON mod)
  const hpGain = window.getClassHpBonus ? getClassHpBonus() : (8 + conMod);
  char.maxHp += hpGain;
  char.hp = Math.min(char.hp + hpGain, char.maxHp);
  if (window.grantSkillPoint) grantSkillPoint(char);
  char.maxMp = (char.maxMp || 100) + 10;
  char.mp = Math.min((char.mp || 100) + 10, char.maxMp);

  // ── STAT POINT every 2 levels (even levels) ──
  char.statPoints = (char.statPoints || 0);
  if (char.level % 2 === 0) {
    char.statPoints += 1;
  }

  addLog(`🎉 LEVEL UP! ${char.name} is now Level ${char.level}!`, 'holy');
  addLog(`   +${hpGain} Max HP  +10 Max MP${char.level % 2 === 0 ? '  +1 Stat Point' : ''}`, 'system');

  // ── NEW SPELL ──
  let newSpell = null;
  if (SPELL_LEARN_LEVELS.includes(char.level)) {
    newSpell = learnNewSpell(char);
  }

  // ── UPGRADE POINTS above level 10 ──
  // #21: upgradePoints had no way to be spent. Grant a usable stat point alongside
  // the (still-persisted) upgradePoints counter so the level-11+ reward is actually
  // spendable through the existing stat-assignment UI.
  if (char.level > 10) {
    char.upgradePoints = (char.upgradePoints || 0) + 1;
    char.statPoints = (char.statPoints || 0) + 1;
    addLog(`⬆ +1 Upgrade Point — converted to a usable Stat Point (Total upgrades: ${char.upgradePoints})`, 'holy');
  }

  if (window.AudioEngine) AudioEngine.sfx?.levelup();
  showLevelUpPanel(char, newSpell);
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
  else if (window.updateCharacterPanel) updateCharacterPanel();
  if (typeof renderStatsMini === 'function') renderStatsMini();
  updateXPBar();
}

function learnNewSpell(char) {
  const classSpells = CLASS_SPELLS[char.class] || [];
  const learnedIds = (char.spells || []).map(s => s.id);
  const available = classSpells.filter(s => s.level <= char.level && !learnedIds.includes(s.id));
  if (available.length === 0) return null;
  const newSpell = available[0];
  if (!char.spells) char.spells = [];
  char.spells.push({ ...newSpell, upgraded: false });
  addLog(`📖 NEW SPELL LEARNED: ${newSpell.icon} ${newSpell.name}!`, 'holy');
  return newSpell;
}

function showLevelUpPanel(char, newSpell) {
  document.getElementById('levelup-panel')?.remove();

  const lvl = char.level || 1;
  const prev = XP_TABLE[lvl - 1] || 0;
  const next = XP_TABLE[lvl] || prev + 1000;
  const xpPct = Math.max(0, Math.min(100, Math.round(((char.xp - prev) / (next - prev)) * 100)));

  const statPointMsg = (char.statPoints > 0)
    ? `<div style="color:#8bc87a;font-size:0.78rem;margin-top:6px">
        🎯 ${char.statPoints} Stat Point${char.statPoints>1?'s':''} available — assign below
       </div>`
    : '';

  const spellMsg = newSpell
    ? `<div style="color:#c090ff;font-size:0.78rem;margin-top:6px">📖 New spell: ${newSpell.icon} ${newSpell.name}</div>`
    : '';

  // Build stat assignment UI if points available
  const statKeys = ['str','dex','con','int','wis','cha'];
  const statNames = ['STR','DEX','CON','INT','WIS','CHA'];
  const statUI = char.statPoints > 0 ? `
    <div style="margin-top:14px;border-top:1px solid rgba(201,168,76,0.2);padding-top:12px">
      <div style="font-size:0.68rem;color:var(--text-dim);letter-spacing:0.08em;margin-bottom:8px">ASSIGN STAT POINT</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">
        ${statKeys.map((k,i) => `
          <button onclick="assignStatPoint('${k}')" style="
            background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);
            color:var(--text-secondary);font-family:'Cinzel',serif;font-size:0.65rem;
            padding:6px 4px;cursor:pointer;transition:background 0.15s;
          " onmouseover="this.style.background='rgba(201,168,76,0.18)'"
            onmouseout="this.style.background='rgba(201,168,76,0.08)'">
            ${statNames[i]}<br>
            <span style="color:var(--gold);font-size:0.8rem">${char.stats?.[k] || 10}</span>
          </button>`).join('')}
      </div>
    </div>` : '';

  const panel = document.createElement('div');
  panel.id = 'levelup-panel';
  panel.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    z-index:3000;background:linear-gradient(135deg,rgba(5,3,1,0.99),rgba(12,8,3,0.99));
    border:2px solid var(--gold);padding:28px 36px;text-align:center;
    font-family:'Cinzel',serif;color:var(--gold);min-width:340px;max-width:420px;
    box-shadow:0 0 60px rgba(201,168,76,0.3);
    animation:levelUpPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
  `;

  panel.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:6px">⭐</div>
    <div style="font-size:1.3rem;letter-spacing:0.18em;margin-bottom:4px">LEVEL UP</div>
    <div style="font-size:1.9rem;margin:6px 0">${char.name}</div>
    <div style="font-size:0.9rem;color:#aaa">Level <span style="color:var(--gold);font-size:1.2rem">${lvl}</span></div>
    <div style="font-size:0.72rem;color:#888;margin-top:6px">
      +${window.getClassHpBonus ? getClassHpBonus() : (8 + Math.floor(((char.stats?.con||10)-10)/2))} HP &nbsp;•&nbsp; +10 MP
    </div>
    ${spellMsg}${statPointMsg}
    <!-- XP progress bar -->
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-dim);margin-bottom:3px">
        <span>XP Progress</span><span>${char.xp} / ${next}</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px">
        <div style="height:100%;width:${xpPct}%;background:var(--gold);border-radius:3px;transition:width 0.5s"></div>
      </div>
    </div>
    ${statUI}
    ${char.statPoints === 0 ? `
    <button onclick="document.getElementById('levelup-panel').remove()"
      style="margin-top:18px;background:rgba(201,168,76,0.15);border:1px solid var(--gold);
      color:var(--gold);font-family:'Cinzel',serif;font-size:0.8rem;padding:8px 28px;cursor:pointer;
      letter-spacing:0.1em;">CONTINUE</button>` : `
    <button onclick="document.getElementById('levelup-panel').remove()"
      style="margin-top:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.3);
      color:var(--text-dim);font-family:'Cinzel',serif;font-size:0.72rem;padding:6px 22px;cursor:pointer;
      letter-spacing:0.1em;" title="Unspent points are banked on your character sheet">LATER</button>`}
  `;
  document.body.appendChild(panel);
}

function assignStatPoint(statKey) {
  const char = gameState.character;
  if (!char || !char.statPoints) return;
  char.stats[statKey] = (char.stats[statKey] || 10) + 1;
  char.statPoints -= 1;
  addLog(`📈 ${statKey.toUpperCase()} increased to ${char.stats[statKey]}!`, 'holy');
  // Refresh panel
  showLevelUpPanel(char, null);
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
  if (typeof renderStatsMini === 'function') renderStatsMini();
  updateXPBar();
}
window.assignStatPoint = assignStatPoint;
window.grantXP = grantXP;
window.levelUp = levelUp;
window.updateXPBar = updateXPBar;

// Expose all combat functions on window so multiplayer.js patches intercept correctly
window.combatAttack = combatAttack;
window.castSelectedSpell = castSelectedSpell;
window.endPlayerTurn = endPlayerTurn;
window.startCombat = startCombat;
window.selectTarget = selectTarget;
window.getTarget = getTarget;
window.selectSpell = selectSpell;
window.cancelSpell = cancelSpell;
// Exposed for shop.js / consumables (#15, #20, #25) and status helpers (#17)
window.combatItem = combatItem;
window.combatMove = combatMove;
window.addStatus = addStatus;
window.removeStatus = removeStatus;
window.hasStatus = hasStatus;
window.endCombat = endCombat;

// ─── INITIALIZE PLAYER SPELLS ─────────────────
function initPlayerSpells(char) {
  if (char.spells && char.spells.length > 0) return; // already has spells
  char.spells = [];
  const classSpells = CLASS_SPELLS[char.class] || [];
  // Give level 1 spell at start
  const startSpell = classSpells.find(s => s.level === 1);
  if (startSpell) char.spells.push({ ...startSpell, upgraded: false });
}

// ─── ENTER COMBAT ─────────────────────────────
function startCombat(enemies, encounter = {}) {
  const char = gameState.character;
  if (!char) return;

  // #16: re-entry guard — never wipe a live fight with a second encounter
  if (combatState.active) {
    console.warn('startCombat called while combat already active — ignoring re-entry.');
    return;
  }

  initPlayerSpells(char);
  if (window.initClassResource) initClassResource(char);
  window._rogueFirstStrikeDone = false;

  combatState.active = true;
  window.ActionPipeline.begin(combatState,window.ActionPipeline.command({},'player','begin').id);
  combatState.round = 1;
  combatState.combatants = {};
  combatState.turnOrder = [];
  combatState.selectedSpell = null;
  combatState.statusEffects = {}; // clear all statuses
  combatState.victoryScene = typeof encounter?.victoryScene === 'string'
    ? encounter.victoryScene.replace(/[^a-z0-9_]/gi, '').slice(0, 80)
    : null;
  const encounterId=encounter?.id==='cupside_checkpoint'?'cupside_checkpoint':'standard';
  combatState.tactical={encounterId,cover:encounterId==='cupside_checkpoint'?[{id:'cupside_barricade',x:0,z:-3.1,radius:.82,type:'half'}]:[],bounds:12,moveRange:window.TacticalCombat?.DEFAULT_MOVE_RANGE||4.5};
  Object.assign(combatState.tactical,window.TacticalCombat.worldSnapshot(window.__world3d)||{});

  const wisMod = COMBAT_RULES.abilityModifier(char.stats?.wis || 10);
  const strMod = COMBAT_RULES.abilityModifier(char.stats?.str || 10);
  const dexMod = COMBAT_RULES.abilityModifier(char.stats?.dex || 10);
  const attackAbility = COMBAT_RULES.getAttackAbility(char.class);
  const attackMod = COMBAT_RULES.abilityModifier(char.stats?.[attackAbility] || 10);

  // #13: fold in equipment — char.ac is stored as 10 + armor AC (shop.js/charsheet.js),
  // char.atkBonus is the summed weapon ATK bonus. #22: class passive AC bonus.
  const armorAc = char.ac ? (char.ac - 10) : 0;
  const classAcBonus = window.getClassAcBonus ? getClassAcBonus() : 0;
  const weaponAtk = char.atkBonus || 0;
  const proficiency = COMBAT_RULES.proficiencyBonus(char.level || 1);

  combatState.combatants['player'] = {
    id: 'player', name: char.name,
    hp: char.hp, maxHp: char.maxHp,
    mp: char.mp ?? 100, maxMp: char.maxMp ?? 100,
    ac: 10 + dexMod + armorAc + classAcBonus,
    atk: attackMod + weaponAtk + proficiency,
    attackAbility,
    attackBonus:attackMod + weaponAtk + proficiency,
    damageMod:attackMod + weaponAtk,
    type: 'player', ap: MAX_AP, icon: '⚔',
    isPlayer: true, boss: false,
    initiative: COMBAT_RULES.rollInitiative({ bonus:dexMod }).total,
    spells: window.GameplayCatalog.spellsFor(char.class,char.level||1),
    characterClass:char.class,level:char.level||1,resource:char.class==='cleric'?3:0,
    tacticalRole:/ranger/i.test(char.class||'')?'ranged':/mage|cleric/i.test(char.class||'')?'caster':/rogue/i.test(char.class||'')?'skirmisher':'frontline',
    position:{x:0,z:0},
    statMods: Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,COMBAT_RULES.abilityModifier(char.stats?.[key]||10)])),
  };

  enemies.forEach((e, i) => {
    const id = e.id || ('enemy_' + i);
    combatState.combatants[id] = {
      id, name: String(e.name || '').trim() || 'Hostile Creature',
      hp: e.hp, maxHp: e.hp || e.maxHp || 50,
      ac: e.ac || 12, atk: e.atk || 3,
      attackBonus:e.attackBonus ?? e.atk ?? 3,
      damageMod:e.damageMod ?? e.atk ?? 3,
      mp: e.mp ?? 50, maxMp: e.mp ?? 50,
      statMods:e.statMods||{},resistances:e.resistances||[],immunities:e.immunities||[],vulnerabilities:e.vulnerabilities||[],
      type: 'enemy', ap: MAX_AP,
      icon: e.icon || '👹',
      isPlayer: false,
      boss: e.boss || false,
      flee: e.flee || false,
      spells: e.spells || [],
      level: e.level || 1,
      xp: e.xp || 50,
      tacticalRole:['frontline','skirmisher','ranged','caster'].includes(e.tacticalRole)?e.tacticalRole:window.TacticalCombat?.inferRole?.(e)||'frontline',
      // Spawn hostiles on the camera-facing side of the battlefield. Positive Z
      // projects beneath the 3D combat controls in the default exploration camera.
      position:{x:(i-(enemies.length-1)/2)*2.05,z:-5.5-(i%2)*.7},
      initiative: COMBAT_RULES.rollInitiative({ bonus:e.dex || 0 }).total,
    };
  });

  combatState.turnOrder = Object.keys(combatState.combatants)
    .sort((a,b) => combatState.combatants[b].initiative - combatState.combatants[a].initiative);
  combatState.currentTurnIndex = 0;
  combatState.apRemaining = MAX_AP;

  if (window.AudioEngine) AudioEngine.transitionForContext ? AudioEngine.transitionForContext('combat', 'combat_enter') : AudioEngine.transition('combat', 800);

  // Close all other panels — combat is exclusive
  document.getElementById('conv-panel')?.remove();
  document.getElementById('shop-panel')?.remove();
  document.getElementById('camp-panel')?.remove();
  document.getElementById('rep-panel')?.remove();
  document.getElementById('travel-encounter-panel')?.remove();
  document.getElementById('scene-panel')?.remove();
  if (window.npcConvState) { window.npcConvState.active = false; window.npcConvState.npc = null; }

  addLog('━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
  addLog('⚔ COMBAT BEGINS — Roll for Initiative!', 'combat');
  combatState.turnOrder.forEach(id => {
    const c = combatState.combatants[id];
    addLog(`  ${c.icon} ${c.name}: Initiative ${c.initiative}`, 'system');
    // Record that combat started with this enemy
    if (!c.isPlayer) {
      if (!window.sceneState) window.sceneState = { flags: {} };
      window.sceneState.flags['fought_' + c.id] = true;
      window.sceneState.flags['combat_with_' + c.id + '_started'] = true;
    }
  });

  window.TacticalCombat.placeCombatants(combatState);
  renderCombatUI();
  processTurn();
}

// ─── COMBAT UI ────────────────────────────────
function renderCombatUI() {
  const old = document.getElementById('combat-panel');
  if (old) old.remove();

  const panel = document.createElement('div');
  panel.id = 'combat-panel';
  panel.className = 'combat-panel';
  document.body.appendChild(panel);
  updateCombatUI();
}

function updateCombatUI() {
  const panel = document.getElementById('combat-panel');
  if (!panel || !combatState.active) return;

  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  const current = combatState.combatants[currentId];
  const localCombatantId = getLocalCombatantId();
  const isMultiplayerCombat = !!window.mp?.sessionCode;
  const isPlayerTurn = isMultiplayerCombat ? currentId === localCombatantId : current?.isPlayer;
  const char = gameState.character;
  const player = getLocalCombatant();
  if (!player) return;

  // Build enemy list with HP bars (no HP bar for bosses)
  const enemyHTML = Object.values(combatState.combatants)
    .filter(c => !c.isPlayer && c.hp > 0)
    .map(c => {
      const hpPct = Math.max(0, Math.floor((c.hp / c.maxHp) * 100));
      const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 30 ? '#ff9800' : '#f44336';
      const hpBar = c.boss
        ? `<span class="ce-hp-hidden">??? HP</span>`
        : `<div class="ce-hp-bar-wrap"><div class="ce-hp-bar" style="width:${hpPct}%;background:${hpColor}"></div></div><span class="ce-hp-num">${c.hp}/${c.maxHp}</span>`;
      const isTarget = combatState.selectedTarget === c.id;
      const enemyStatuses = (combatState.statusEffects[c.id] || []).map(s =>
        `<span class="status-badge enemy-status" title="${s.name}">${s.icon}</span>`
      ).join('');
      const npcPortraitPath = window.getPortraitPath?.(c.id, c.name, { role: c.boss ? 'boss' : 'adventurer' });
      const portraitHTML = `<div class="ce-portrait"><img src="${npcPortraitPath}" alt="${c.name}"></div>`;
      return `<div class="combat-enemy ${isTarget ? 'targeted' : ''} ${c.boss ? 'boss' : ''}"
        onclick="window.selectTarget('${c.id}')">
        ${portraitHTML}
        <div class="ce-info">
          <span class="ce-name">${c.name}${c.boss ? ' 👑' : ''} <span class="ce-lvl">Lv${c.level||1}</span>${enemyStatuses}</span>
          <div class="ce-hp-row">${hpBar}</div>
        </div>
        ${isTarget ? '<span class="ce-target-arrow">◀ TARGET</span>' : ''}
      </div>`;
    }).join('');

  // Build spell buttons for player
  const spells = player?.spells || [];
  const spellHTML = spells.map(s => {
    const canCast = player?.mp >= s.mp && combatState.apRemaining >= s.ap && isPlayerTurn;
    const isSelected = combatState.selectedSpell?.id === s.id;
    return `<button class="spell-btn ${canCast ? '' : 'disabled'} ${isSelected ? 'selected' : ''}"
      onclick="${canCast ? `window.selectSpell('${s.id}')` : ''}" title="${s.desc}">
      <span class="sb-icon">${s.icon}</span>
      <span class="sb-name">${s.name}</span>
      <div class="sb-stats">
        <span class="sb-ap">${s.ap}AP</span>
        <span class="sb-mp">${s.mp}MP</span>
        ${s.damage ? `<span class="sb-dmg">${s.damage}</span>` : ''}
        ${s.heal ? `<span class="sb-heal">+${s.heal}</span>` : ''}
      </div>
    </button>`;
  }).join('');

  // AP pips
  const apPips = Array(MAX_AP).fill(0).map((_, i) =>
    `<span class="ap-pip ${i < combatState.apRemaining ? 'full' : 'empty'}"></span>`
  ).join('');

  // Turn order badges with portrait thumbnails
  const turnOrderHTML = combatState.turnOrder
    .filter(id => combatState.combatants[id]?.hp > 0)
    .map((id, i) => {
      const c = combatState.combatants[id];
      const isCurrent = id === currentId;
      const partyPortrait = c.isPlayer
        ? (window.mp?.session?.players?.[c.playerId || c.id]?.character?.portrait
          || (c.id === localCombatantId ? gameState.character?.portrait : null))
        : null;
      const thumb = c.isPlayer
        ? (partyPortrait
            ? `<img src="${partyPortrait}" class="to-thumb" alt="${c.name}">`
            : `<span class="to-thumb-icon">${c.icon}</span>`)
        : `<img src="${window.getPortraitPath?.(c.id, c.name, { role: c.boss ? 'boss' : 'adventurer' })}" class="to-thumb" alt="${c.name}">`;
      return `<span class="to-badge ${isCurrent ? 'current' : ''} ${c.isPlayer ? 'player' : 'enemy'}">
        ${thumb} ${c.name.split(' ')[0]}
      </span>`;
    }).join('<span class="to-arrow">→</span>');

  // Active turn portrait — large display
  const activeCombatant = combatState.combatants[currentId];
  const activeTurnPortrait = (() => {
    if (!activeCombatant) return '';
    if (activeCombatant.isPlayer) {
      const partyPortrait = window.mp?.session?.players?.[activeCombatant.playerId || activeCombatant.id]?.character?.portrait
        || (activeCombatant.id === localCombatantId ? gameState.character?.portrait : null);
      return partyPortrait
        ? `<img src="${partyPortrait}" class="active-turn-portrait player-portrait" alt="${activeCombatant.name}">`
        : `<span class="active-turn-icon">${activeCombatant.icon}</span>`;
    }
    const npcPath = window.getPortraitPath?.(activeCombatant.id, activeCombatant.name, { role: activeCombatant.boss ? 'boss' : 'adventurer' });
    return `<img src="${npcPath}" class="active-turn-portrait enemy-portrait" alt="${activeCombatant.name}">`;
  })();

  panel.innerHTML = `
    <div class="cp-combat-header">
      <span class="cp-round">Round ${combatState.round}</span>
      <div class="cp-turn-order">${turnOrderHTML}</div>
      <div class="cp-whose-turn ${isPlayerTurn ? 'your-turn' : 'enemy-turn'}">
        ${activeTurnPortrait}
        <span>${isPlayerTurn ? '⚔ YOUR TURN' : `${activeCombatant?.name}'s turn`}</span>
      </div>
    </div>

    ${(combatState.statusEffects[localCombatantId]?.length > 0) ? `
    <div class="cp-status-bar">
      ${(combatState.statusEffects[localCombatantId] || []).map(s =>
        `<span class="status-badge" title="${s.name} (${s.turnsLeft} turns)">${s.icon} ${s.name} <small>${s.turnsLeft}t</small></span>`
      ).join('')}
    </div>` : ''}

    <div class="cp-enemies">${enemyHTML}</div>

    ${isPlayerTurn ? `
    <div class="cp-player-actions">
      <div class="cp-ap-row">
        <span class="cp-ap-label">ACTION POINTS</span>
        <div class="cp-ap-pips">${apPips}</div>
        <span class="cp-ap-num">${combatState.apRemaining}/${MAX_AP} AP</span>
      </div>
      <!-- #23: class resource bar injected here by injectClassResourceBar() after render -->

      <div class="cp-action-buttons">
        <button class="ca-btn attack ${combatState.apRemaining < 1 ? 'disabled' : ''}"
          onclick="window.combatAttack()" title="1 AP — Basic weapon attack">
          ⚔ <span>ATTACK</span> <small>1AP</small>
        </button>
        <button class="ca-btn move ${combatState.apRemaining < 1 ? 'disabled' : ''}"
          onclick="combatMove()" title="1 AP — Reposition">
          🏃 <span>MOVE</span> <small>1AP</small>
        </button>
        <button class="ca-btn item ${combatState.apRemaining < 1 ? 'disabled' : ''}"
          onclick="combatItem()" title="1 AP — Use item">
          🎒 <span>ITEM</span> <small>1AP</small>
        </button>
        <button class="ca-btn end-turn" onclick="window.endPlayerTurn()">
          ⏭ <span>END TURN</span>
        </button>
      </div>

      ${spells.length > 0 ? `
      <div class="cp-spells-label">SPELLS ${combatState.selectedSpell ? `<span class="spell-selected-name">— ${combatState.selectedSpell.icon} ${combatState.selectedSpell.name} selected, click target</span>` : ''}</div>
      <div class="cp-spells">${spellHTML}</div>
      ` : '<div class="cp-no-spells">No spells learned yet. Level up to learn spells.</div>'}

      <div class="cp-cast-row" ${combatState.selectedSpell ? '' : 'style="display:none"'} id="cast-row">
        <button class="ca-btn cast" onclick="window.castSelectedSpell()">
          ${combatState.selectedSpell?.icon || '✨'} CAST ${combatState.selectedSpell?.name || ''} ON TARGET
        </button>
        <button class="ca-btn cancel" onclick="window.cancelSpell()">✕ Cancel</button>
      </div>
    </div>
    ` : `<div class="cp-enemy-thinking">${current?.icon} ${current?.name} is acting...</div>`}
  `;

  // #23: render the class resource bar (Rage/Combo/Focus/etc.) into the UI as the comment intends
  if (isPlayerTurn && window.injectClassResourceBar) injectClassResourceBar();
}

// ─── PLAYER ACTIONS ───────────────────────────
function selectTarget(enemyId) {
  combatState.selectedTarget = enemyId;
  updateCombatUI();
}

function selectSpell(spellId) {
  const player = getLocalCombatant();
  if (!player) return;
  const spell = player?.spells?.find(s => s.id === spellId);
  if (!spell) return;
  combatState.selectedSpell = spell;
  const policy=window.CombatMechanics.policies[spell.id]?.[0];
  if(policy==='self'||policy==='downed'){
    combatState.selectedTarget=policy==='self'?player.id:Object.values(combatState.combatants).find(c=>c.isPlayer&&c.hp<=0&&c.downedRound!=null&&combatState.round-c.downedRound<=3)?.id;
    updateCombatUI();return;
  }
  if(window.ActionPipeline.SUPPORT[spell.id]){
    const allies=Object.values(combatState.combatants).filter(c=>c.isPlayer&&c.hp>0);
    combatState.selectedTarget=(spell.id==='lay_on_hands'?allies.find(c=>c.id!==player.id):player)?.id||null;
    updateCombatUI();return;
  }
  // Auto-select first enemy if none selected
  if (!combatState.selectedTarget) {
    const firstEnemy = Object.values(combatState.combatants).find(c => !c.isPlayer && c.hp > 0);
    if (firstEnemy) combatState.selectedTarget = firstEnemy.id;
  }
  updateCombatUI();
}

function cancelSpell() {
  combatState.selectedSpell = null;
  updateCombatUI();
}

function combatAttack() {
  const target=getTarget();if(!target)return;
  const result=resolveSoloCommand('attack',{targetId:target.id});if(!result)return;
  const event=result.events[0];
  addLog(`⚔ ${event.hit?'HIT':'MISS'} — ${target.name}: ${event.damage} damage [${event.roll}].`,'combat');
  syncPlayerHP();checkCombatEnd();updateCombatUI();
  if(combatState.active&&combatState.apRemaining<=0)combatState.pendingEndTurnTimer=setTimeout(endPlayerTurn,600);
}

function castSelectedSpell(position) {
  const spell=combatState.selectedSpell;if(!spell)return;
  const result=resolveSoloCommand('spell',{spellId:spell.id,targetId:combatState.selectedTarget,position});
  if(!result)return;
  for(const event of result.events)addLog(`${spell.icon} ${spell.name}: ${combatState.combatants[event.targetId]?.name||''} ${event.damage!==undefined?event.damage+' damage':event.healing!==undefined?event.healing+' healing':event.text||event.type}`,'combat');
  combatState.selectedSpell=null;syncPlayerHP();checkCombatEnd();updateCombatUI();
  if(combatState.active&&combatState.apRemaining<=0)combatState.pendingEndTurnTimer=setTimeout(endPlayerTurn,600);
}

function rollDice(formula, statMod) {
  if (!formula) return 0;
  return COMBAT_RULES.rollFormula(formula, {
    statMods:{ str:statMod||0, dex:statMod||0, con:statMod||0, int:statMod||0, wis:statMod||0, cha:statMod||0 },
  }).total;
}

function reportCombatRejection(reason){
  const messages={out_of_range:'Out of range. Move closer before using this action.',blocked:'The path or line of sight is blocked.',not_your_turn:'Wait for your turn.',insufficient_ap:'Not enough action points.',insufficient_mp:'Not enough mana.'};
  const message=Object.hasOwn(messages,reason)?messages[reason]:'Action unavailable: '+String(reason||'invalid action').replace(/_/g,' ')+'.';
  addLog('Action rejected: '+reason,'system');
  window.__world3d?.toast?.(message,4200);
}
function acceptSoloCommand(type,data={}){
  const cmd=window.ActionPipeline.command(combatState,'player',type,data);
  const prepared=window.ActionPipeline.prepare(combatState,cmd,{principalId:'player',character:gameState.character});
  if(!prepared.ok){reportCombatRejection(prepared.reason);return false;}
  return window.ActionPipeline.accept(combatState,prepared);
}
function resolveSoloCommand(type,data={}){
  const context={principalId:'player',character:gameState.character,canEndEncounter:true};
  const cmd=window.ActionPipeline.command(combatState,'player',type,data);
  const result=window.ActionPipeline.resolve(combatState,cmd,context);
  if(!result.ok){reportCombatRejection(result.reason);return null;}
  return window.ActionPipeline.commit(combatState,result,context)?result:null;
}
function combatMove(position) {
  if(!position){addLog('Choose a destination on the battlefield.','system');return;}
  const result=resolveSoloCommand('move',{position});
  if(!result)return;
  syncPlayerHP();
  addLog('🏃 You reposition on the battlefield.','system');updateCombatUI();
}
function combatItem() {
  const inventory=gameState.character?.inventory||[];
  const itemName=inventory.find(name=>window.GameplayCatalog.consumable(name));
  if(!itemName){addLog('No healing or restorative items to use!','system');return;}
  const result=resolveSoloCommand('item',{targetId:itemName});
  if(!result)return;
  const event=result.events[0];
  gameState.character.mp=combatState.combatants.player.mp;
  syncPlayerHP();
  addLog(`🎒 Used ${event.name}! Restored ${event.amount} ${event.field.toUpperCase()}.`,'holy');
  updateCombatUI();
  if(combatState.apRemaining<=0)combatState.pendingEndTurnTimer=setTimeout(endPlayerTurn,600);
}

function endPlayerTurn() {
  if(!combatState.active||combatState.whoseTurn!=='player'||combatState.endedThisTurn)return;
  if(!acceptSoloCommand('end_turn'))return;
  combatState.endedThisTurn=true;
  if(combatState.pendingEndTurnTimer){clearTimeout(combatState.pendingEndTurnTimer);combatState.pendingEndTurnTimer=null;}
  combatState.apRemaining=0;advanceTurn();
}

function getTarget() {
  if (combatState.selectedTarget) {
    const t = combatState.combatants[combatState.selectedTarget];
    if (t && (t.hp>0||(combatState.selectedSpell?.id==='revivify'&&t.isPlayer))) return t;
  }
  return Object.values(combatState.combatants).find(c => !c.isPlayer && c.hp > 0);
}

// ─── ADVANCE TURN ─────────────────────────────
function advanceTurn() {
  if (!combatState.active) return; // combat ended — stop the turn loop
  combatState.commandRevision=(combatState.commandRevision||0)+1;
  do {
    combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % combatState.turnOrder.length;
    if (combatState.currentTurnIndex === 0) combatState.round++;
  } while (combatState.combatants[combatState.turnOrder[combatState.currentTurnIndex]]?.hp <= 0);

  combatState.apRemaining = MAX_AP;
  processTurn();
}

function processTurn() {
  if(!combatState.active)return;
  const id=combatState.turnOrder[combatState.currentTurnIndex],current=combatState.combatants[id];
  if(!current||current.hp<=0){checkCombatEnd();if(combatState.active)advanceTurn();return;}
  combatState.whoseTurn=id;combatState.endedThisTurn=false;
  if(combatState.pendingEndTurnTimer){clearTimeout(combatState.pendingEndTurnTimer);combatState.pendingEndTurnTimer=null;}
  for(const event of window.CombatMechanics.startTurn(combatState,id))addLog(`Status effect: ${combatState.combatants[event.targetId]?.name} takes ${event.damage} damage.`,'combat');
  checkCombatEnd();if(!combatState.active)return;syncPlayerHP();updateCombatUI();
  if(combatState.turnBlocked||current.hp<=0){combatState.apRemaining=0;setTimeout(advanceTurn,600);return;}
  if(!current.isPlayer)setTimeout(()=>enemyAI(id),800);
}
function enemyAI(id) {
  if(!combatState.active||combatState.turnOrder[combatState.currentTurnIndex]!==id)return;
  const enemy=combatState.combatants[id];if(!enemy||enemy.hp<=0){advanceTurn();return;}
  const target=Object.values(combatState.combatants).filter(c=>c.isPlayer&&c.hp>0).sort((a,b)=>(window.TacticalCombat.distance(enemy.position,a.position)||0)-(window.TacticalCombat.distance(enemy.position,b.position)||0))[0];
  if(!target){checkCombatEnd();return;}
  const spellId=(enemy.spells||[]).map(s=>typeof s==='string'?s:s.id).find(s=>window.CombatMechanics.enemyIds.includes(s));
  let resolution;
  if(spellId&&(enemy.mp||0)>=20&&!window.CombatMechanics.has(combatState,id,'garrote_silence')&&Math.random()<.3&&window.TacticalCombat.lineOfSight(enemy,target,combatState.tactical)&&window.TacticalCombat.distance(enemy.position,target.position)<=12){
    resolution=window.CombatMechanics.resolve(combatState,id,{id:spellId},{enemy:true,targetId:target.id});
    resolution.combatants[id].mp-=20;
  }else{
    let legal=window.TacticalCombat.validateAttack(enemy,target,combatState.tactical);
    if(!legal.ok&&!window.CombatMechanics.has(combatState,id,'vine_trap')){window.TacticalCombat.advanceEnemy(combatState,enemy,target);legal=window.TacticalCombat.validateAttack(enemy,target,combatState.tactical);}
    if(legal.ok)resolution=window.CombatMechanics.attack(combatState,id,target.id,{coverBonus:legal.coverBonus});
  }
  if(resolution){combatState.combatants=resolution.combatants;combatState.statusEffects=resolution.statusEffects;for(const e of resolution.events)addLog(`${enemy.name}: ${e.damage??e.healing??''} ${e.type} ${e.text||''}`,'combat');}
  syncPlayerHP();checkCombatEnd();updateCombatUI();if(combatState.active)setTimeout(advanceTurn,800);
}

// ─── CHECK WIN/LOSE ───────────────────────────
function checkCombatEnd() {
  const player = combatState.combatants['player'];
  if (!player) return;
  const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0);

  if (!Object.values(combatState.combatants).some(c=>c.isPlayer&&c.hp>0)) {
    endCombat(false);
    return;
  }
  if (enemies.length === 0) {
    endCombat(true);
    return;
  }
}

// #38: combat ids carry timestamp suffixes (captain_rhael_1718200000000) and some scenes
// use short ids ('rhael'). Normalize to the dialogue.js NPC registry ids so dead-NPC
// flags actually match the checks at dialogue.js:618.
const NPC_ID_ALIASES = {
  rhael: 'captain_rhael',
  mourne: 'sister_mourne',
  harren: 'sir_harren',
  harren_fallen: 'sir_harren',
  varek: 'elder_varek',
  scribe: 'trembling_scribe',
  aldran: 'heretic_preacher_aldran',
  cael: 'brother_cael',
  theones: 'head_archivist_theones',
};
function normalizeNpcId(id, name) {
  let base = (id || (name || '').toLowerCase().replace(/\s+/g, '_'));
  base = base.replace(/_\d{10,}$/, ''); // strip generated timestamp suffix
  return NPC_ID_ALIASES[base] || base;
}
// Exposed so the consequence layer (consequences.js) normalizes ids the same way.
window.normalizeNpcId = normalizeNpcId;
window.NPC_ID_ALIASES = NPC_ID_ALIASES;

function recordAuthoredCombatVictory(questScene, defeatedIds = []) {
  if (!questScene) return { updates:[], completions:[] };
  if (questScene === 'aldran_church_soldiers') {
    window.sceneState = window.sceneState || { flags:{} };
    window.sceneState.flags = window.sceneState.flags || {};
    window.sceneState.flags.heretic_protected = true;
    window.addLog?.('Aldran is safe. The Church soldiers cannot silence Mol today.', 'holy');
  }
  return window.recordQuestEvent?.(`combat:victory:${questScene}`, { defeatedIds })
    || { updates:[], completions:[] };
}
window.recordAuthoredCombatVictory = recordAuthoredCombatVictory;

function endCombat(victory) {
  // Guard against re-entry — the infinite loop happens when advanceTurn fires
  // via setTimeout after endCombat already ran
  if (!combatState.active) return;
  if(!window.ActionPipeline.finish(combatState,victory).ok)return;

  // Clear any pending auto-end timer so it can't fire after combat ends
  if (combatState.pendingEndTurnTimer) { clearTimeout(combatState.pendingEndTurnTimer); combatState.pendingEndTurnTimer = null; }

  // Identify who was just defeated (for story triggers and loot)
  const defeatedEnemies = Object.values(combatState.combatants).filter(c => !c.isPlayer);
  const defeatedIds = defeatedEnemies.map(c => c.id);

  if (victory) {
    let totalXP = 0;
    defeatedEnemies.forEach(c => {
      totalXP += c.xp || 50;
      grantHolyPoints(2);
      // ── Write death to world state so all NPCs know (normalized ids — #38) ──
      if (!window.sceneState) window.sceneState = { flags: {} };
      if (!window.sceneState.flags) window.sceneState.flags = {};
      const normId = normalizeNpcId(c.id, c.name);
      window.sceneState.flags['npc_dead_' + normId] = true;
      window.sceneState.flags['killed_' + normId] = gameState.character?.name || 'player';
      window.sceneState.flags['fought_' + normId] = true;
      window.setNPCFate?.(normId, 'dead'); // unified fate → scenes/endings gate on this
    });
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`⚔ VICTORY! All enemies defeated!`, 'holy');
    grantXP(totalXP);
    const questScene = window.sceneState?.currentScene || window.sceneState?._currentScene?.id || '';
    if (questScene) recordAuthoredCombatVictory(questScene, defeatedIds);
    if (defeatedIds.some(id => String(id).startsWith('cupside_sergeant'))) {
      window.sceneState.flags.cupside_checkpoint_defeated = true;
      window.sceneState.flags.cupside_checkpoint_cleared = true;
      window.recordQuestEvent?.('combat:victory:cupside_checkpoint', { defeatedIds });
      window.addLog?.('Cupside Lane is open. The illegal Church checkpoint will not be rebuilt tonight.', 'narrator');
    }
    {
      // #57: transition to the location's actual music track, not its id
      const track = window.WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.music;
      if (window.AudioEngine && track) AudioEngine.transitionForContext ? AudioEngine.transitionForContext(track, 'combat_exit') : AudioEngine.transition(track, 1500);
    }

    // Sync player HP (victory — whatever they ended with, minimum 1)
    if (gameState.character && combatState.combatants['player']) {
      gameState.character.hp = Math.max(1, combatState.combatants['player'].hp);
    }

    // Generate and show loot
    const loot = generateLoot(defeatedEnemies);
    if (loot.length > 0) {
      setTimeout(() => showLootPanel(loot, defeatedEnemies), 800);
    }

    // Capture the authored continuation before another encounter can replace it.
    const victoryScene=combatState.victoryScene;
    // Story triggers after boss defeats
    setTimeout(() => {
      if(victoryScene){
        window.runScene?.(victoryScene);
      } else if (defeatedIds.some(id => id === 'elder_varek' || id?.startsWith('elder_varek'))) {
        if (window.runScene) window.runScene('chapter1_end_arrest');
      } else if (defeatedEnemies.some(enemy => /voice below/i.test(enemy.name || '') || String(enemy.id || '').startsWith('the_voice_below'))) {
        if (window.runScene) window.runScene('monastery_dungeon_cleared');
      }
      setTimeout(() => window.resumePendingArrivalScene?.(), 0);
    }, 2500);

    // ── Resume the AI story after a won fight (Part 2) ──
    if (window._postCombatContinue) {
      const ctx = window._postCombatContinue;
      window._postCombatContinue = null;
      setTimeout(() => window.generateAIScene?.(ctx), 1500);
    }
  } else {
    // ── HARDCORE DEATH (Part 3) — defeat ends the run. No reprieve, no heal. ──
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`☠ You have fallen. Your Chronicle ends here.`, 'combat');
    grantHellPoints(3);

    if (gameState.character) gameState.character.hp = 0;
    gameState.dead = true;
    if (combatState.combatants['player']) combatState.combatants['player'].hp = 0;

    // Mark the run dead so Resume/autosave can't revive a corpse.
    try { localStorage.setItem('ss_run_dead', '1'); } catch (e) {}
    // Clear / mark the autosave slot dead so it can't be loaded back.
    try {
      const raw = localStorage.getItem('ss_saves_v1');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.slots)) {
          data.slots = data.slots.filter(s => s.id !== 'autosave_slot');
          localStorage.setItem('ss_saves_v1', JSON.stringify(data));
        }
      }
    } catch (e) {}

    // No more story continuation or queued scenes for a dead character.
    window._postCombatContinue = null;
    combatState.victoryScene = null;
    window._pendingScene = null;

    {
      // #57: transition to the location's actual music track, not its id
      const track = window.WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.music;
      if (window.AudioEngine && track) AudioEngine.transitionForContext ? AudioEngine.transitionForContext(track, 'combat_exit') : AudioEngine.transition(track, 1500);
    }

    // Tear down the combat panel, then raise the death screen.
    const deadName = gameState.character?.name || 'The fallen';
    const deadLoc = window.WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.name || 'Vaelthar';
    setTimeout(() => {
      document.getElementById('combat-panel')?.remove();
      if (window.showDeathScreen) window.showDeathScreen(deadName, deadLoc);
    }, 2200);

    // #41 scene drain is skipped on death — the run is over. Return early.
    return;
  }

  setTimeout(() => {
    const panel = document.getElementById('combat-panel');
    if (panel) panel.remove();
    if (window.updateCharacterPanel) updateCharacterPanel();
    if (window.renderPlayerCard) renderPlayerCard();
  }, 2000);

  // #41: drain a scene queued during combat once no conversation is active.
  if (window._pendingScene && !window.npcConvState?.active) {
    const scene = window._pendingScene;
    window._pendingScene = null;
    setTimeout(() => window.showScene?.(scene), 1200);
  }
}

// ─── DEATH SCREEN (Part 3) — full-screen, run-ending ──────────────────────────
window.showDeathScreen = function (name, locationName) {
  // Remove any lingering game overlays first.
  document.getElementById('combat-panel')?.remove();
  document.getElementById('conv-panel')?.remove();
  document.getElementById('scene-panel')?.remove();
  document.getElementById('ss-death-screen')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ss-death-screen';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:2600;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:radial-gradient(ellipse at center, rgba(20,4,4,0.97) 0%, rgba(2,1,1,0.99) 100%);
    font-family:'Cinzel',serif; color:#c9a84c; text-align:center; padding:24px;
    animation:ssDeathFade 1.4s ease;`;

  const safeName = (name || 'The fallen').replace(/</g, '&lt;');
  const safeLoc = (locationName || 'Vaelthar').replace(/</g, '&lt;');

  overlay.innerHTML = `
    <style>
      @keyframes ssDeathFade { from { opacity:0; } to { opacity:1; } }
      #ss-death-screen .ssd-skull { font-size:4.5rem; margin-bottom:8px; filter:drop-shadow(0 0 18px rgba(180,40,40,0.6)); }
      #ss-death-screen h1 { font-size:2.4rem; letter-spacing:0.18em; color:#b8862f; margin:0 0 18px; text-shadow:0 0 24px rgba(120,20,20,0.6); }
      #ss-death-screen .ssd-line { font-size:1.05rem; color:#cdb37a; opacity:0.85; max-width:540px; line-height:1.6; margin:0 0 34px; }
      #ss-death-screen .ssd-line .ssd-name { color:#e0c270; }
      #ss-death-screen .ssd-btns { display:flex; gap:16px; flex-wrap:wrap; justify-content:center; }
      #ss-death-screen button {
        font-family:'Cinzel',serif; font-size:1rem; letter-spacing:0.08em;
        padding:14px 26px; cursor:pointer; color:#1a0f04;
        background:linear-gradient(180deg,#d8b860 0%,#a8842f 100%);
        border:1px solid #e8cd7a; border-radius:3px; box-shadow:0 4px 18px rgba(0,0,0,0.6);
        transition:transform 0.15s, box-shadow 0.15s; }
      #ss-death-screen button.ssd-secondary {
        background:linear-gradient(180deg,#2a1d10 0%,#16100a 100%); color:#c9a84c; border:1px solid rgba(201,168,76,0.5); }
      #ss-death-screen button:hover { transform:translateY(-2px); box-shadow:0 6px 24px rgba(0,0,0,0.7); }
    </style>
    <div class="ssd-skull">☠</div>
    <h1>YOUR CHRONICLE ENDS</h1>
    <p class="ssd-line"><span class="ssd-name">${safeName}</span> fell in ${safeLoc}. Chapter I.</p>
    <div class="ssd-btns">
      <button id="ssd-new">⚔ New Chronicle</button>
      <button id="ssd-load" class="ssd-secondary">📖 Load Chronicle</button>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#ssd-new').onclick = function () {
    // A fresh run clears the death flag.
    try { localStorage.removeItem('ss_run_dead'); } catch (e) {}
    if (gameState) gameState.dead = false;
    // Wipe the dead run's world state so the new chronicle starts clean (#5).
    // COORDINATION: prefer window.resetWorldState (game.js) which resets the full world
    // AND sceneState; fall back to resetSceneState alone if it isn't defined.
    if (typeof window.resetWorldState === 'function') window.resetWorldState();
    else if (typeof window.resetSceneState === 'function') window.resetSceneState();
    overlay.remove();
    if (window.combatState) window.combatState.active = false;
    if (window.showScreen) showScreen('mode-select');
    else if (window.startSoloMode) startSoloMode();
  };
  overlay.querySelector('#ssd-load').onclick = function () {
    overlay.remove();
    if (window.openLoadScreen) openLoadScreen();
    else if (window.showScreen) showScreen('mode-select');
  };
};

// ─── FLEE COMBAT (#15) ────────────────────────
// A real, clean retreat: no defeat, no Hell Points, no HP change, no XP/loot.
window.fleeCombat = function() {
  if (!combatState.active) return;
  if(window.mp?.sessionCode){window.mpCombatAction?.('retreat');return;}
  if(!resolveSoloCommand('retreat'))return;

  // Clear any pending auto-end timer
  if (combatState.pendingEndTurnTimer) { clearTimeout(combatState.pendingEndTurnTimer); combatState.pendingEndTurnTimer = null; }

  addLog('━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
  addLog('💨 You break away and escape the fight.', 'system');

  // Preserve current player HP back to the character (no penalty, no heal)
  const player = combatState.combatants['player'];
  if (player && gameState.character) {
    gameState.character.hp = Math.max(1, player.hp);
    gameState.character.mp = Math.max(0, player.mp);
  }

  // Restore the location's own music
  const track = window.WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.music;
  if (window.AudioEngine && track) AudioEngine.transitionForContext ? AudioEngine.transitionForContext(track, 'combat_exit') : AudioEngine.transition(track, 1500);

  // Reset combat state cleanly
  combatState.combatants = {};
  combatState.turnOrder = [];
  combatState.currentTurnIndex = 0;
  combatState.statusEffects = {};
  combatState.selectedSpell = null;
  combatState.selectedTarget = null;
  combatState.whoseTurn = null;
  combatState.endedThisTurn = false;

  // Fleeing abandons the fight — clear any post-combat continuation so a later
  // unrelated victory doesn't resume this fled encounter (#8).
  window._postCombatContinue = null;
  window._pendingScene = null;

  // Remove the combat panel and refresh the HUD
  document.getElementById('combat-panel')?.remove();
  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.renderPlayerCard) renderPlayerCard();
};

// ─── LOOT TABLES ──────────────────────────────
const LOOT_TABLES = {
  // Common — low-tier enemies (bandits, skeletons, wolves, cultists)
  common: [
    { name: 'Gold Coins (5)',     icon: '🪙', type: 'gold',    value: 5,  weight: 40 },
    { name: 'Gold Coins (12)',    icon: '🪙', type: 'gold',    value: 12, weight: 25 },
    { name: 'Healing Salve',      icon: '🧪', type: 'consumable', effect: 'heal_15', weight: 30 },
    { name: 'Torn Cloth',         icon: '🧵', type: 'junk',    value: 1,  weight: 20 },
    { name: 'Crude Dagger',       icon: '🗡', type: 'weapon',  atk: 1,    weight: 15 },
    { name: 'Mouldy Bread',       icon: '🍞', type: 'consumable', effect: 'heal_5', weight: 20 },
    { name: 'Worn Leather Scrap', icon: '🧱', type: 'junk',    value: 2,  weight: 15 },
  ],
  // Uncommon — guards, church agents, strong NPCs
  uncommon: [
    { name: 'Gold Coins (25)',    icon: '🪙', type: 'gold',    value: 25, weight: 35 },
    { name: 'Gold Coins (40)',    icon: '🪙', type: 'gold',    value: 40, weight: 20 },
    { name: 'Health Potion',      icon: '🧪', type: 'consumable', effect: 'heal_30', weight: 30 },
    { name: 'Guard\'s Sigil',    icon: '🛡', type: 'key_item', weight: 20 },
    { name: 'Steel Shortsword',   icon: '⚔', type: 'weapon',  atk: 3,    weight: 15 },
    { name: 'Chain Coif',         icon: '🪖', type: 'armor',   ac: 1,     weight: 15 },
    { name: 'Church Document',    icon: '📜', type: 'key_item', weight: 20 },
    { name: 'MP Tonic',           icon: '💙', type: 'consumable', effect: 'mp_20',  weight: 20 },
    { name: 'Silver Ring',        icon: '💍', type: 'treasure', value: 30, weight: 15 },
  ],
  // Rare — named NPCs (Rhael, Mourne, Harren)
  rare: [
    { name: 'Gold Coins (80)',    icon: '🪙', type: 'gold',    value: 80,  weight: 25 },
    { name: 'Gold Coins (120)',   icon: '🪙', type: 'gold',    value: 120, weight: 15 },
    { name: 'Superior Health Potion', icon: '🧪', type: 'consumable', effect: 'heal_60', weight: 25 },
    { name: 'Rhael\'s Badge of Office', icon: '🛡', type: 'key_item', weight: 30 },
    { name: 'Mourne\'s Prayer Beads',   icon: '📿', type: 'key_item', weight: 30 },
    { name: 'Enchanted Blade',    icon: '⚔', type: 'weapon',  atk: 5,    weight: 15 },
    { name: 'Covenant Letter',    icon: '📜', type: 'key_item', weight: 25 },
    { name: 'Blessed Armor Shard',icon: '🛡', type: 'armor',   ac: 2,     weight: 15 },
    { name: 'Ancient Gold Coin',  icon: '🏅', type: 'treasure', value: 60, weight: 20 },
    { name: 'Full Mana Crystal',  icon: '💎', type: 'consumable', effect: 'mp_50', weight: 20 },
  ],
  // Legendary — bosses (Varek, Voice Below, Shattered God, Harren Fallen)
  legendary: [
    { name: 'Gold Coins (300)',       icon: '🪙', type: 'gold',    value: 300, weight: 20 },
    { name: 'Varek\'s Signet Ring',   icon: '💍', type: 'key_item', weight: 35 },
    { name: 'Shard of the Covenant',  icon: '⚡', type: 'key_item', weight: 30 },
    { name: 'Elixir of Power',        icon: '🧪', type: 'consumable', effect: 'full_heal', weight: 25 },
    { name: 'Elder\'s Black Staff',   icon: '🔮', type: 'weapon',  atk: 8,     weight: 20 },
    { name: 'Harren\'s Fallen Plate', icon: '🛡', type: 'armor',   ac: 5,      weight: 20 },
    { name: 'Voice Fragment',         icon: '🕳', type: 'key_item', weight: 25 },
    { name: 'Ancient Holy Relic',     icon: '✝', type: 'treasure', value: 200, weight: 15 },
    { name: 'Tome of Forbidden Rites',icon: '📖', type: 'key_item', weight: 20 },
    { name: 'Shattered God\'s Eye',   icon: '👁', type: 'key_item', weight: 15 },
  ],
};

// Named NPC → specific unique loot override
const NAMED_LOOT = {
  captain_rhael:   [{ name: "Rhael's Watch Seal",      icon: '🛡', type: 'key_item' }, { name: "Gold Coins (60)", icon: '🪙', type: 'gold', value: 60 }],
  sister_mourne:   [{ name: "Mourne's Heresy Notes",   icon: '📜', type: 'key_item' }, { name: "Blessed Candle",  icon: '🕯', type: 'consumable', effect: 'heal_20' }],
  elder_varek:     [{ name: "Varek's Signet Ring",      icon: '💍', type: 'key_item' }, { name: "Covenant Seal",   icon: '⚡', type: 'key_item' }, { name: "Gold Coins (200)", icon: '🪙', type: 'gold', value: 200 }],
  the_voice_below: [{ name: "Voice Fragment",           icon: '🕳', type: 'key_item' }, { name: "Void Shard",      icon: '🌑', type: 'key_item' }],
  shattered_god:   [{ name: "Shattered God's Eye",      icon: '👁', type: 'key_item' }, { name: "Divine Remnant",  icon: '⚡', type: 'key_item' }],
  harren_fallen:   [{ name: "Harren's Fallen Plate",    icon: '🛡', type: 'armor', ac: 5 }, { name: "Knight's Honor Oath", icon: '📜', type: 'key_item' }],
};

function getEnemyTier(enemy) {
  if (enemy.boss) return 'legendary';
  const xp = enemy.xp || 50;
  if (xp >= 200) return 'rare';       // Named NPCs: Rhael, Mourne
  if (xp >= 70)  return 'uncommon';   // Guards, agents, cultists
  return 'common';                     // Bandits, skeletons, wolves
}

function weightedPick(table) {
  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const item of table) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return table[0];
}

function generateLoot(enemies) {
  const allLoot = [];
  enemies.forEach(enemy => {
    const baseId = enemy.id?.replace(/_\d+$/, ''); // strip numeric suffix
    // Named NPC gets guaranteed unique loot
    if (NAMED_LOOT[baseId]) {
      NAMED_LOOT[baseId].forEach(item => allLoot.push({ ...item, from: enemy.name }));
      return;
    }
    const tier = getEnemyTier(enemy);
    const table = LOOT_TABLES[tier];
    // Number of items scales with tier
    const count = { common: 1, uncommon: 2, rare: 3, legendary: 4 }[tier];
    const picked = new Set();
    for (let i = 0; i < count; i++) {
      let item;
      let attempts = 0;
      do { item = weightedPick(table); attempts++; }
      while (picked.has(item.name) && attempts < 10);
      picked.add(item.name);
      allLoot.push({ ...item, from: enemy.name });
    }
  });
  return allLoot;
}

function addToInventory(item) {
  const char = gameState.character;
  if (!char) return;
  // Gold goes to a gold counter, not inventory
  if (item.type === 'gold') {
    char.gold = (char.gold || 0) + (item.value || 0);
    addLog(`🪙 +${item.value} gold (total: ${char.gold})`, 'holy');
    return;
  }
  // Consumables get added as named strings
  char.inventory = char.inventory || [];
  char.inventory.push(item.name);
  if (typeof renderInventory === 'function') renderInventory();
}

function showLootPanel(loot, enemies) {
  // Remove old loot panel
  document.getElementById('loot-panel')?.remove();

  const enemyNames = [...new Set(enemies.map(e => e.name))].join(', ');
  const itemsHTML = loot.map((item, i) => `
    <div class="loot-item" id="loot-item-${i}">
      <span class="loot-icon">${item.icon}</span>
      <div class="loot-info">
        <span class="loot-name">${item.name}</span>
        <span class="loot-from">from ${item.from}</span>
      </div>
      <button class="loot-take" onclick="takeLootItem(${i})">TAKE</button>
    </div>
  `).join('');

  const panel = document.createElement('div');
  panel.id = 'loot-panel';
  panel.innerHTML = `
    <div class="loot-inner">
      <div class="loot-header">
        <span class="loot-title">⚔ SPOILS OF BATTLE</span>
        <span class="loot-subtitle">${enemyNames} defeated</span>
      </div>
      <div class="loot-items" id="loot-items">${itemsHTML}</div>
      <div class="loot-footer">
        <button class="loot-take-all" onclick="takeAllLoot()">⚔ TAKE ALL</button>
        <button class="loot-leave" onclick="document.getElementById('loot-panel')?.remove()">Leave</button>
      </div>
    </div>
  `;

  // Store loot for take functions
  window._currentLoot = loot;

  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    gameLog.appendChild(panel);
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  } else {
    document.body.appendChild(panel);
  }
}

window.takeLootItem = function(index) {
  const loot = window._currentLoot;
  if (!loot || !loot[index]) return;
  const item = loot[index];
  addToInventory(item);
  addLog(`${item.icon} Picked up: ${item.name}`, 'holy');
  loot[index] = null; // mark taken
  const el = document.getElementById(`loot-item-${index}`);
  if (el) { el.style.opacity = '0.3'; el.querySelector('.loot-take').disabled = true; el.querySelector('.loot-take').textContent = '✓'; }
};

window.takeAllLoot = function() {
  const loot = window._currentLoot;
  if (!loot) return;
  loot.forEach((item, i) => { if (item) window.takeLootItem(i); });
  setTimeout(() => document.getElementById('loot-panel')?.remove(), 600);
};

// ─── AUTO-COMBAT TRIGGER ─────────────────────
// Intercepts "attack X" typed actions
function checkAutoAttack(text) {
  const lower = text.toLowerCase();
  const attackWords = ['attack', 'stab', 'strike', 'punch', 'hit', 'fight', 'kill', 'shoot', 'slash'];
  if (!attackWords.some(w => new RegExp('\\b' + w + '\\b', 'i').test(lower))) return false;
  if (combatState.active) return false;

  // Extract target name — strip attack words on word boundaries so "hitman" isn't mangled
  let targetName = lower;
  attackWords.forEach(w => { targetName = targetName.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' '); });
  targetName = targetName.replace(/\s+/g, ' ').trim();
  targetName = targetName.replace(/^(the|a|an)\s+/, '').trim();

  // Fearful NPCs might flee — auto-roll, no manual dice
  const fearfulNPCs = ['scribe', 'aldis', 'merchant', 'peasant', 'child', 'farmer'];
  const isFearful = fearfulNPCs.some(n => targetName.includes(n));
  if (isFearful) {
    const playerRoll = COMBAT_RULES.rollInitiative({ bonus:COMBAT_RULES.abilityModifier(gameState.character?.stats?.dex || 10) }).total;
    const npcRoll = COMBAT_RULES.rollInitiative().total;
    addLog(`🎲 ${gameState.character?.name} [${playerRoll}] vs ${targetName} flee roll [${npcRoll}]`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();
    if (npcRoll > playerRoll) {
      addLog(`💨 ${targetName} bolts in terror before you can reach them!`, 'narrator');
      grantHellPoints(2);
      return true;
    }
    // Didn't flee — fall through to combat below
  }

  // Look up NPC or generate enemy
  const npcMap = {
    'captain rhael': () => generateEnemy('captain_rhael', 1),
    'rhael': () => generateEnemy('captain_rhael', 1),
    'guard': () => generateEnemy('city_guard', 1),
    'guards': () => generateEnemy('city_guard', 1),
    'city guard': () => generateEnemy('city_guard', 1),
    'soldier': () => generateEnemy('city_guard', 1),
    'sister mourne': () => generateEnemy('sister_mourne', 2),
    'mourne': () => generateEnemy('sister_mourne', 2),
    'church agent': () => generateEnemy('church_agent', 2),
    'bandit': () => generateEnemy('bandit', 1),
    'cultist': () => generateEnemy('cultist', 2),
    'scribe': () => ({ ...generateEnemy('bandit', 1), name:'The Trembling Scribe', icon:'📜', hp:15, flee:true }),
  };

  const enemyFn = npcMap[targetName];
  const enemy = enemyFn ? enemyFn() : generateEnemy('bandit', AREA_LEVELS[window.mapState?.currentLocation] || 1);
  if (!enemyFn) enemy.name = targetName.charAt(0).toUpperCase() + targetName.slice(1);

  addLog(`⚔ ${gameState.character?.name} attacks ${enemy.name}! Combat begins!`, 'combat');
  startCombat([enemy]);
  return true;
}

// ─── CSS ─────────────────────────────────────
const combatCSS = `
@keyframes levelUpPop { from{transform:translate(-50%,-50%) scale(0.5);opacity:0} to{transform:translate(-50%,-50%) scale(1);opacity:1} }

.combat-panel {
  position:fixed; bottom:0; left:0; right:0;
  z-index:1500; background:linear-gradient(180deg,rgba(4,2,1,0.98),rgba(8,4,2,0.99));
  border-top:2px solid rgba(192,57,43,0.7);
  box-shadow:0 -12px 40px rgba(0,0,0,0.95);
  max-height:75vh; overflow-y:auto;
}
.cp-combat-header {
  display:flex; align-items:center; gap:12px;
  padding:8px 16px; background:rgba(192,57,43,0.08);
  border-bottom:1px solid rgba(192,57,43,0.2);
}
.cp-round { font-family:'Cinzel',serif; font-size:0.75rem; color:var(--hell-glow); white-space:nowrap; }
.cp-turn-order { flex:1; display:flex; align-items:center; gap:4px; overflow-x:auto; }
.to-badge { font-family:'Cinzel',serif; font-size:0.65rem; padding:3px 8px; white-space:nowrap;
  border:1px solid rgba(201,168,76,0.2); color:var(--text-dim); }
.to-badge.current { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,0.1); }
.to-badge.player { border-color:rgba(74,144,226,0.4); }
.to-arrow { color:var(--text-dim); font-size:0.7rem; }
.cp-whose-turn { font-family:'Cinzel',serif; font-size:0.75rem; white-space:nowrap; }
.your-turn { color:var(--gold); }
.enemy-turn { color:var(--hell-glow); }

.cp-enemies { display:flex; flex-wrap:wrap; gap:8px; padding:10px 14px; }
.combat-enemy {
  display:flex; align-items:center; gap:10px;
  background:rgba(10,5,2,0.9); border:1px solid rgba(201,168,76,0.12);
  padding:8px 14px; cursor:pointer; transition:all 0.15s; flex:1; min-width:200px;
}
.combat-enemy:hover { border-color:rgba(192,57,43,0.5); }
.combat-enemy.targeted { border-color:var(--hell); background:rgba(192,57,43,0.1); }
.combat-enemy.boss { border-color:rgba(180,50,180,0.4); }
.ce-icon { font-size:1.6rem; flex-shrink:0; }
.ce-info { flex:1; }
.ce-name { font-family:'Cinzel',serif; font-size:0.78rem; color:var(--gold); display:flex; align-items:center; gap:6px; }
.ce-lvl { font-size:0.62rem; color:var(--text-dim); }
.ce-hp-row { display:flex; align-items:center; gap:6px; margin-top:3px; }
.ce-hp-bar-wrap { flex:1; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden; max-width:120px; }
.ce-hp-bar { height:100%; border-radius:3px; transition:width 0.3s; }
.ce-hp-num { font-size:0.65rem; color:var(--text-dim); white-space:nowrap; }
.ce-hp-hidden { font-size:0.65rem; color:rgba(180,50,180,0.7); font-style:italic; }
.ce-target-arrow { font-family:'Cinzel',serif; font-size:0.65rem; color:var(--hell-glow); white-space:nowrap; }

.cp-player-actions { padding:8px 14px 12px; }
.cp-ap-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.cp-ap-label { font-family:'Cinzel',serif; font-size:0.65rem; color:var(--text-dim); letter-spacing:0.08em; }
.cp-ap-pips { display:flex; gap:4px; }
.ap-pip { width:16px; height:16px; border-radius:50%; transition:all 0.2s; }
.ap-pip.full { background:var(--gold); box-shadow:0 0 6px rgba(201,168,76,0.5); }
.ap-pip.empty { background:rgba(255,255,255,0.1); border:1px solid rgba(201,168,76,0.2); }
.cp-ap-num { font-family:'Cinzel',serif; font-size:0.7rem; color:var(--gold); }

.cp-action-buttons { display:flex; gap:4px; margin-bottom:10px; flex-wrap:wrap; }
.ca-btn {
  font-family:'Cinzel',serif; font-size:0.72rem; letter-spacing:0.06em;
  padding:7px 14px; cursor:pointer; border:1px solid; transition:all 0.12s;
  display:flex; align-items:center; gap:6px;
}
.ca-btn small { font-size:0.6rem; opacity:0.7; }
.ca-btn.attack { background:rgba(192,57,43,0.15); border-color:rgba(192,57,43,0.5); color:var(--hell-glow); }
.ca-btn.attack:hover { background:rgba(192,57,43,0.3); }
.ca-btn.move { background:rgba(74,120,154,0.15); border-color:rgba(74,120,154,0.4); color:#7ab3d4; }
.ca-btn.item { background:rgba(100,160,80,0.15); border-color:rgba(100,160,80,0.4); color:#8bc87a; }
.ca-btn.end-turn { background:rgba(201,168,76,0.1); border-color:rgba(201,168,76,0.3); color:var(--gold); margin-left:auto; }
.ca-btn.cast { background:rgba(120,60,200,0.2); border-color:rgba(120,60,200,0.5); color:#c090ff; flex:1; }
.ca-btn.cancel { background:rgba(192,57,43,0.1); border-color:rgba(192,57,43,0.3); color:var(--hell-glow); }
.ca-btn.disabled { opacity:0.35; cursor:not-allowed; }
.ca-btn:hover:not(.disabled) { transform:translateY(-1px); }

.cp-spells-label { font-family:'Cinzel',serif; font-size:0.65rem; color:var(--text-dim); letter-spacing:0.1em; margin-bottom:6px; }
.spell-selected-name { color:rgba(180,130,255,0.9); font-size:0.68rem; }
.cp-spells { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
.cp-no-spells { font-size:0.72rem; color:var(--text-dim); font-style:italic; padding:6px 0; margin-bottom:8px; }
.spell-btn {
  display:flex; flex-direction:column; align-items:flex-start;
  background:rgba(10,5,3,0.95); border:1px solid rgba(120,80,200,0.25);
  padding:7px 12px; cursor:pointer; transition:all 0.12s; min-width:120px;
  font-family:'Cinzel',serif; color:var(--text-secondary);
}
.spell-btn:hover:not(.disabled) { border-color:rgba(180,130,255,0.5); background:rgba(120,80,200,0.1); }
.spell-btn.selected { border-color:rgba(180,130,255,0.8); background:rgba(120,80,200,0.2); color:#d0b0ff; }
.spell-btn.disabled { opacity:0.4; cursor:not-allowed; }
.sb-icon { font-size:1.1rem; margin-bottom:2px; }
.sb-name { font-size:0.72rem; letter-spacing:0.05em; margin-bottom:3px; }
.sb-stats { display:flex; gap:6px; }
.sb-ap { font-size:0.6rem; color:var(--gold); background:rgba(201,168,76,0.1); padding:1px 5px; }
.sb-mp { font-size:0.6rem; color:#7ab3d4; background:rgba(74,120,154,0.1); padding:1px 5px; }
.sb-dmg { font-size:0.6rem; color:var(--hell-glow); background:rgba(192,57,43,0.1); padding:1px 5px; }
.sb-heal { font-size:0.6rem; color:#8bc87a; background:rgba(100,160,80,0.1); padding:1px 5px; }
.cp-cast-row { display:flex; gap:6px; margin-top:4px; }
.cp-enemy-thinking { padding:16px; font-family:'Cinzel',serif; font-size:0.8rem; color:var(--hell-glow); text-align:center; font-style:italic; }
.cp-status-bar { display:flex; flex-wrap:wrap; gap:4px; padding:4px 12px 6px; background:rgba(201,168,76,0.04); border-bottom:1px solid rgba(201,168,76,0.1); }
.status-badge { font-size:0.62rem; padding:2px 7px; background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.25); color:var(--gold); font-family:'Cinzel',serif; letter-spacing:0.04em; }
.status-badge small { opacity:0.7; margin-left:2px; }
.enemy-status { font-size:0.7rem; padding:0 3px; background:rgba(192,57,43,0.15); border-color:rgba(192,57,43,0.3); color:#e74c3c; margin-left:4px; }
`;
const cStyle = document.createElement('style');
cStyle.textContent = combatCSS;
document.head.appendChild(cStyle);

// ─── LOOT CSS ─────────────────────────────────
const lootCSS = `
#loot-panel {
  width: 100%; margin: 8px 0;
  animation: sceneFadeIn 0.4s ease;
}
.loot-inner {
  background: linear-gradient(160deg, rgba(12,8,3,0.99) 0%, rgba(6,4,1,1) 100%);
  border: 1px solid rgba(201,168,76,0.4);
  border-left: 3px solid var(--gold);
}
.loot-header {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 16px 8px;
  background: rgba(201,168,76,0.06);
  border-bottom: 1px solid rgba(201,168,76,0.15);
}
.loot-title {
  font-family: 'Cinzel', serif; font-size: 0.78rem;
  color: var(--gold); letter-spacing: 0.15em;
}
.loot-subtitle {
  font-size: 0.68rem; color: var(--text-dim); font-style: italic;
}
.loot-items { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; }
.loot-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: rgba(15,10,4,0.9);
  border: 1px solid rgba(201,168,76,0.1);
  transition: opacity 0.3s;
}
.loot-icon { font-size: 1.2rem; flex-shrink: 0; }
.loot-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.loot-name { font-family: 'Cinzel', serif; font-size: 0.72rem; color: var(--text-primary); }
.loot-from { font-size: 0.62rem; color: var(--text-dim); font-style: italic; }
.loot-take {
  background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.35);
  color: var(--gold); font-family: 'Cinzel', serif; font-size: 0.62rem;
  padding: 4px 10px; cursor: pointer; letter-spacing: 0.08em;
  transition: all 0.15s; white-space: nowrap;
}
.loot-take:hover { background: rgba(201,168,76,0.25); }
.loot-take:disabled { opacity: 0.4; cursor: default; }
.loot-footer {
  display: flex; gap: 8px; padding: 8px 12px 10px;
  border-top: 1px solid rgba(201,168,76,0.08);
}
.loot-take-all {
  flex: 1; background: linear-gradient(135deg, var(--gold-light), var(--gold));
  border: none; color: var(--dark-bg); font-family: 'Cinzel', serif;
  font-size: 0.72rem; font-weight: 700; padding: 8px; cursor: pointer;
  letter-spacing: 0.1em; transition: opacity 0.15s;
}
.loot-take-all:hover { opacity: 0.85; }
.loot-leave {
  background: transparent; border: 1px solid rgba(201,168,76,0.2);
  color: var(--text-dim); font-family: 'Cinzel', serif; font-size: 0.68rem;
  padding: 8px 14px; cursor: pointer;
}
.loot-leave:hover { border-color: var(--gold); color: var(--gold); }
`;
const lStyle = document.createElement('style');
lStyle.textContent = lootCSS;
document.head.appendChild(lStyle);

console.log('⚔ Combat system initialized. AP costs: Move=1, Attack=1, Spell=2, Pray=1, Free actions=0');
