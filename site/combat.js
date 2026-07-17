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
const CLASS_SPELLS = {
  cleric: [
    { id:'cure_wounds',    level:1,  name:'Cure Wounds',      icon:'💚', ap:2, mp:20, damage:null,        heal:'2d8+WIS', type:'heal',    desc:'Restore 2d8+WIS HP to one ally.' },
    { id:'spirit_weapon',  level:3,  name:'Spiritual Weapon', icon:'👻', ap:2, mp:35, damage:'2d8+WIS',   heal:null,      type:'holy',    desc:'Summon a floating spectral blade. Attacks each round.' },
    { id:'mass_heal',      level:5,  name:'Mass Heal',        icon:'💫', ap:2, mp:60, damage:null,        heal:'2d6+WIS', type:'heal',    holy_cost:8,  desc:'Heal ALL allies for 2d6+WIS. Costs 8 Holy Points.' },
    { id:'divine_strike',  level:7,  name:'Divine Strike',    icon:'⚡', ap:2, mp:45, damage:'4d8+WIS',   heal:null,      type:'holy',    desc:'Channel divinity into a strike. Deals holy damage.' },
    { id:'revivify',       level:10, name:'Revivify',         icon:'❤', ap:2, mp:80, damage:null,        heal:'1',       type:'revive',  desc:'Restore a fallen ally to 1 HP. Must use within 3 turns.' },
  ],
  paladin: [
    { id:'holy_smite',    level:1,  name:'Holy Smite',    icon:'✝', ap:2, mp:30, damage:'3d6+WIS', heal:'1d4', type:'holy',  desc:'Radiant damage + heal yourself 1d4. Costs 5 Holy.' },
    { id:'lay_on_hands',  level:3,  name:'Lay on Hands',  icon:'🙏', ap:2, mp:25, damage:null,      heal:'3d8', type:'heal',  desc:'Touch an ally to heal 3d8+WIS. Not self.' },
    { id:'divine_shield', level:5,  name:'Divine Shield', icon:'🔆', ap:2, mp:50, damage:null,      heal:null,  type:'buff',  holy_cost:10, desc:'Absorb up to 30 damage for self or ally. 10 Holy.' },
    { id:'judgment',      level:7,  name:'Judgment',      icon:'⚖', ap:2, mp:60, damage:'5d10+WIS',heal:null,  type:'holy',  holy_cost:15, desc:'Devastating holy strike. Costs 15 Holy Points.' },
    { id:'wrath_divine',  level:10, name:'Wrath of God',  icon:'☀', ap:3, mp:90, damage:'8d10+WIS',heal:null,  type:'holy',  holy_cost:25, desc:'Annihilate one target with divine fury. 25 Holy.' },
  ],
  mage: [
    { id:'magic_missile', level:1,  name:'Magic Missile', icon:'✨', ap:2, mp:20, damage:'3d4+INT', heal:null, type:'arcane', desc:'Auto-hit magic bolts. Never misses.' },
    { id:'fireball',      level:3,  name:'Fireball',      icon:'🔥', ap:2, mp:40, damage:'6d6',     heal:null, type:'fire',   desc:'AOE explosion. Hits ALL in range — allies too!', aoe:true },
    { id:'mirror_image',  level:5,  name:'Mirror Image',  icon:'👁', ap:2, mp:30, damage:null,      heal:null, type:'buff',   desc:'3 illusions absorb hits before you.' },
    { id:'chain_lightning',level:7, name:'Chain Lightning',icon:'⚡',ap:2, mp:45, damage:'4d10',    heal:null, type:'lightning',desc:'Chains between targets. 50% ally splash.', aoe:true },
    { id:'disintegrate',  level:10, name:'Disintegrate',  icon:'💀', ap:3, mp:80, damage:'10d6+INT',heal:null, type:'arcane', desc:'CON save or disintegrated. 20% ally splash.' },
  ],
  warrior: [
    { id:'war_cry',       level:1,  name:'War Cry',         icon:'😤', ap:1, mp:20, damage:null,      heal:null, type:'buff',     desc:'+2 ATK for all allies for 3 turns.' },
    { id:'whirlwind',     level:3,  name:'Whirlwind Strike',icon:'🌀', ap:2, mp:35, damage:'3d8',     heal:null, type:'physical', desc:'Hit ALL nearby — including allies!', aoe:true },
    { id:'last_stand',    level:5,  name:'Last Stand',      icon:'🛡', ap:1, mp:40, damage:null,      heal:null, type:'buff',     desc:'Below 20 HP: +50% damage, immune to knockback.' },
    { id:'execute',       level:7,  name:'Execute',         icon:'⚔', ap:2, mp:50, damage:'5d10+STR',heal:null, type:'physical', desc:'Massive strike vs targets below 25% HP.' },
    { id:'avatar_war',    level:10, name:'Avatar of War',   icon:'🔥', ap:3, mp:80, damage:'6d12+STR',heal:null, type:'physical', desc:'Become unstoppable for 3 turns. +100% damage.' },
  ],
  rogue: [
    { id:'sneak_attack',  level:1,  name:'Sneak Attack',  icon:'🗡', ap:1, mp:15, damage:'3d6+DEX', heal:null, type:'physical', desc:'Bonus damage from stealth or flanking.' },
    { id:'smoke_bomb',    level:3,  name:'Smoke Bomb',    icon:'💨', ap:1, mp:20, damage:null,      heal:null, type:'debuff',   desc:'All in area get -4 to attacks. Allies too.' },
    { id:'shadow_step',   level:5,  name:'Shadow Step',   icon:'🌑', ap:1, mp:25, damage:null,      heal:null, type:'movement', desc:'Teleport to any shadow within 60ft.' },
    { id:'garrote',       level:7,  name:'Garrote',       icon:'🩸', ap:2, mp:30, damage:'4d6+DEX', heal:null, type:'physical', desc:'Silence target (no spells) for 3 turns.' },
    { id:'phantom_kill',  level:10, name:'Phantom Kill',  icon:'👤', ap:3, mp:60, damage:'8d8+DEX', heal:null, type:'physical', desc:'Assassinate from darkness. Instant kill if target <30% HP.' },
  ],
  ranger: [
    { id:'hunters_mark',  level:1,  name:"Hunter's Mark", icon:'🎯', ap:1, mp:20, damage:'+2d6 bonus',heal:null,type:'buff',     desc:'Mark one target. All attacks vs them deal extra damage.' },
    { id:'multi_shot',    level:3,  name:'Multi-Shot',    icon:'🏹', ap:2, mp:35, damage:'2d8 x3',  heal:null, type:'physical', desc:'3 arrows at different targets. Can hit allies.' },
    { id:'vine_trap',     level:5,  name:'Vine Trap',     icon:'🌿', ap:2, mp:30, damage:null,      heal:null, type:'debuff',   desc:'Root target for 2 turns. Cannot move or dash.' },
    { id:'volley',        level:7,  name:'Volley',        icon:'☄', ap:2, mp:50, damage:'3d10',    heal:null, type:'physical', desc:'Rain arrows on an area. No exceptions.', aoe:true },
    { id:'apex_predator', level:10, name:'Apex Predator', icon:'🐺', ap:3, mp:70, damage:'6d10+DEX',heal:null,type:'physical', desc:'Summon a spirit beast. Attacks with you each turn.' },
  ],
};

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
    mp: char.mp || 100, maxMp: char.maxMp || 100,
    ac: 10 + dexMod + armorAc + classAcBonus,
    atk: attackMod + weaponAtk + proficiency,
    attackAbility,
    attackBonus:attackMod + weaponAtk + proficiency,
    damageMod:attackMod + weaponAtk,
    type: 'player', ap: MAX_AP, icon: '⚔',
    isPlayer: true, boss: false,
    initiative: COMBAT_RULES.rollInitiative({ bonus:dexMod }).total,
    spells: char.spells || [],
    tacticalRole:/ranger/i.test(char.class||'')?'ranged':/mage|cleric/i.test(char.class||'')?'caster':/rogue/i.test(char.class||'')?'skirmisher':'frontline',
    position:{x:0,z:0},
    statMods: { str:strMod, dex:dexMod, wis:wisMod, int:Math.floor(((char.stats?.int||10)-10)/2) },
  };

  enemies.forEach((e, i) => {
    const id = e.id || ('enemy_' + i);
    combatState.combatants[id] = {
      id, name: String(e.name || '').trim() || 'Hostile Creature',
      hp: e.hp, maxHp: e.hp || e.maxHp || 50,
      ac: e.ac || 12, atk: e.atk || 3,
      attackBonus:e.attackBonus ?? e.atk ?? 3,
      damageMod:e.damageMod ?? e.atk ?? 3,
      mp: e.mp || 50, maxMp: e.mp || 50,
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
      // Portrait: use NPC_PORTRAITS if available, else icon
      const npcPortraitPath = window.NPC_PORTRAITS?.[c.id]?.path;
      const portraitHTML = npcPortraitPath
        ? `<div class="ce-portrait"><img src="${npcPortraitPath}" alt="${c.name}"></div>`
        : `<div class="ce-portrait ce-portrait-icon">${c.icon}</div>`;
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
        : (window.NPC_PORTRAITS?.[c.id]?.path
            ? `<img src="${window.NPC_PORTRAITS[c.id].path}" class="to-thumb" alt="${c.name}">`
            : `<span class="to-thumb-icon">${c.icon}</span>`);
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
    const npcPath = window.NPC_PORTRAITS?.[activeCombatant.id]?.path;
    return npcPath
      ? `<img src="${npcPath}" class="active-turn-portrait enemy-portrait" alt="${activeCombatant.name}">`
      : `<span class="active-turn-icon">${activeCombatant.icon}</span>`;
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
  if (combatState.apRemaining < 1) { addLog(`No AP remaining. Click "End Turn" or wait.`, 'system'); return; }
  const target = getTarget();
  if (!target) { addLog('Select a target first!', 'system'); return; }
  const player = combatState.combatants['player'];
  if (!player) return;
  const atkBonus = (player.attackBonus ?? player.atk ?? 0) + getAtkMod('player');
  // #17: Shadow Step's nextHitAutoHit guarantees this strike lands, then is consumed
  const ss = getStatusData('player', 'shadow_step');
  const autoHit = !!(ss && ss.nextHitAutoHit);
  const attack = COMBAT_RULES.resolveAttack({
    attackBonus:atkBonus, targetAC:target.ac, autoHit,
    attackerConditions:(combatState.statusEffects.player || []).map(status => status.id),
    targetConditions:(combatState.statusEffects[target.id] || []).map(status => status.id),
  });
  const { roll, hit } = attack;
  if (autoHit && ss) ss.nextHitAutoHit = false;

  if (hit) {
    const isCrit = attack.crit;
    // Critical hits double weapon dice, not the flat ability/gear modifier.
    let baseDmg = COMBAT_RULES.rollFormula('1d8', { modifier:player.damageMod ?? player.atk ?? 0, critical:isCrit }).total;
    if (isCrit) {
      addLog(`💥 CRITICAL HIT! Natural 20 — weapon dice doubled!`, 'hell');
    }
    // #22: Ranger focus powers up the shot (spends focus first so it isn't double-counted below)
    if (window.getRangerFocusBonus && gameState.character?.class === 'ranger') {
      const rf = getRangerFocusBonus(baseDmg);
      baseDmg = rf.dmg;
    }
    // Class damage multipliers
    const classMult = window.getClassDmgMult ? getClassDmgMult() : 1;
    const firstStrikeMult = window.getRogueFirstStrikeBonus ? getRogueFirstStrikeBonus() : 1;
    const effectiveMult = Math.max(classMult, firstStrikeMult);
    if (effectiveMult > 1) baseDmg = Math.floor(baseDmg * effectiveMult);

    // Hunter's Mark bonus
    const mark = getStatusData('player', 'hunters_mark');
    if (mark && mark.targetId === target.id) {
      const bonus = rollDice('2d6', 0);
      baseDmg += bonus;
      addLog(`🎯 Hunter's Mark triggers! +${bonus} bonus damage!`, 'holy');
    }

    // #20: status damage multipliers (Avatar of War dmgMult:2, etc.)
    const statusMult = getDmgMult('player');
    if (statusMult > 1) baseDmg = Math.floor(baseDmg * statusMult);

    // Last Stand: +50% damage when below 20 HP
    if (hasStatus('player', 'last_stand') && player.hp < 20) baseDmg = Math.floor(baseDmg * 1.5);

    const finalDmg = applyDamage(target.id, baseDmg);
    // applyDamage returns net damage after shields — apply it to target HP here (only once)
    if (finalDmg > 0) target.hp = Math.max(0, target.hp - finalDmg);
    addLog(`⚔ ${player.name} attacks ${target.name}! [${roll}+${atkBonus}] HIT — ${finalDmg} damage! (${target.hp}/${target.maxHp} HP)`, 'combat');

    // #20: poisoned weapon — extra poison damage on hit, decrement the counter
    if (combatState.poisonedWeapon > 0 && target.hp > 0) {
      const poisonDmg = applyDamage(target.id, 5);
      target.hp = Math.max(0, target.hp - poisonDmg);
      combatState.poisonedWeapon--;
      addStatus(target.id, { id:'poison', name:'Poisoned', icon:'☠', turnsLeft:3, dmgPerTurn:5 });
      addLog(`☠ Nightshade bites deep! +${poisonDmg} poison damage. (${combatState.poisonedWeapon} coatings left)`, 'hell');
    }

    if (window.classOnHitDealt) classOnHitDealt(finalDmg, isCrit);
    if (gameState.character) { gameState.character.hp = player.hp; }
  } else {
    addLog(`⚔ ${player.name} attacks ${target.name}! [${roll}+${atkBonus}] MISS (AC ${target.ac})`, 'system');
  }

  combatState.apRemaining--;
  checkCombatEnd();
  if (!combatState.active) return; // combat ended (enemy died)

  syncPlayerHP();
  updateCombatUI();

  // Auto-end turn when all AP spent — clear and unambiguous
  if (combatState.apRemaining <= 0) {
    addLog(`⏸ All AP spent — ending your turn.`, 'system');
    combatState.pendingEndTurnTimer = setTimeout(endPlayerTurn, 600);
  }
}

function castSelectedSpell() {
  const spell = combatState.selectedSpell;
  if (!spell) return;
  if (combatState.apRemaining < spell.ap) { addLog('Not enough AP!', 'system'); return; }

  const player = combatState.combatants['player'];
  if (player.mp < spell.mp) { addLog(`Not enough MP! (need ${spell.mp})`, 'system'); return; }

  if (spell.holy_cost && (gameState.character?.holyPoints || 0) < spell.holy_cost) {
    addLog(`Need ${spell.holy_cost} Holy Points for ${spell.name}!`, 'system'); return;
  }

  const target = getTarget();
  const statKey = ['holy','heal','revive'].includes(spell.type) ? 'wis'
    : spell.type === 'arcane' ? 'int'
    : ['physical','fire','lightning'].includes(spell.type) ? 'str'
    : 'wis';
  const statMod = player.statMods?.[statKey] || 0;

  player.mp -= spell.mp;
  combatState.apRemaining -= spell.ap;
  if (gameState.character) gameState.character.mp = player.mp;
  const _spellEmpowered = window.classOnSpellCast ? classOnSpellCast(spell.id) : false;
  if (spell.holy_cost) grantHolyPoints(-spell.holy_cost);

  // ── CLERIC ──────────────────────────────────
  if (spell.id === 'cure_wounds') {
    let amt = rollDice(spell.heal, statMod);
    if (window.getClericHealBonus) amt = getClericHealBonus(amt); // #22
    player.hp = Math.min(player.maxHp, player.hp + amt);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`💚 Cure Wounds: healed for ${amt} HP!`, 'holy');
  }
  else if (spell.id === 'spirit_weapon') {
    addStatus('player', { id:'spirit_weapon', name:'Spirit Weapon', icon:'👻', turnsLeft:3, bonusAtk: rollDice('2d8', statMod) });
    addLog(`👻 Spiritual Weapon summoned! It will strike with you for 3 turns.`, 'holy');
    // Spirit weapon attacks immediately
    if (target) {
      const dmg = applyDamage(target.id, rollDice('2d8', statMod));
      target.hp = Math.max(0, target.hp - dmg);
      addLog(`👻 Spiritual Weapon strikes ${target.name} for ${dmg}!`, 'holy');
    }
  }
  else if (spell.id === 'mass_heal') {
    let amt = rollDice(spell.heal, statMod);
    if (window.getClericHealBonus) amt = getClericHealBonus(amt); // #22
    player.hp = Math.min(player.maxHp, player.hp + amt);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`💫 Mass Heal: all allies restored ${amt} HP!`, 'holy');
  }
  else if (spell.id === 'divine_strike') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`⚡ Divine Strike → ${target.name}: ${dmg} holy damage!`, 'holy');
  }
  else if (spell.id === 'revivify') {
    // Solo: heal self; MP already paid
    player.hp = Math.min(player.maxHp, player.hp + 1);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`❤ Revivify: fighting through! Restored to 1 HP above current.`, 'holy');
  }

  // ── PALADIN ─────────────────────────────────
  else if (spell.id === 'holy_smite') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    const healAmt = rollDice('1d4', 0);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`✝ Holy Smite → ${target.name}: ${dmg} radiant damage! Self-healed ${healAmt}.`, 'holy');
  }
  else if (spell.id === 'lay_on_hands') {
    const amt = rollDice(spell.heal, statMod);
    player.hp = Math.min(player.maxHp, player.hp + amt);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`🙏 Lay on Hands: restored ${amt} HP!`, 'holy');
  }
  else if (spell.id === 'divine_shield') {
    addStatus('player', { id:'divine_shield', name:'Divine Shield', icon:'🔆', turnsLeft:4, shieldHp:30 });
    addLog(`🔆 Divine Shield active! Absorbs up to 30 damage.`, 'holy');
  }
  else if (spell.id === 'judgment') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`⚖ Judgment → ${target.name}: ${dmg} devastating holy damage!`, 'holy');
  }
  else if (spell.id === 'wrath_divine') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`☀ Wrath of God → ${target.name}: ${dmg} divine annihilation!`, 'holy');
  }

  // ── MAGE ────────────────────────────────────
  else if (spell.id === 'magic_missile') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    // Auto-hit — no AC check
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`✨ Magic Missile → ${target.name}: ${dmg} auto-hit arcane damage!`, 'combat');
  }
  else if (spell.id === 'fireball') {
    const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0);
    const dmg = rollDice(spell.damage, 0);
    enemies.forEach(c => {
      const d = applyDamage(c.id, dmg);
      c.hp = Math.max(0, c.hp - d);
      addLog(`🔥 Fireball → ${c.name}: ${d} fire damage!`, 'combat');
    });
  }
  else if (spell.id === 'mirror_image') {
    addStatus('player', { id:'mirror_image', name:'Mirror Image', icon:'👁', turnsLeft:5, charges:3 });
    addLog(`👁 Mirror Image: 3 illusory duplicates surround you! Next 3 hits absorbed.`, 'holy');
  }
  else if (spell.id === 'chain_lightning') {
    const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0);
    enemies.forEach((c, i) => {
      const dmg = applyDamage(c.id, rollDice(spell.damage, 0));
      c.hp = Math.max(0, c.hp - dmg);
      addLog(`⚡ Chain Lightning → ${c.name}: ${dmg} lightning damage!`, 'combat');
    });
  }
  else if (spell.id === 'disintegrate') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    // CON save DC 15 — fail = disintegrated (set to 1 HP threshold to simulate)
    const conSave = COMBAT_RULES.resolveSavingThrow({
      ability:'con', dc:15, abilityMod:Math.floor((target.level || 1) * 0.5),
      conditions:(combatState.statusEffects[target.id] || []).map(status => status.id),
    });
    if (!conSave.success) {
      const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
      target.hp = Math.max(0, target.hp - dmg);
      if (target.hp <= 0) addLog(`💀 Disintegrate → ${target.name}: DISINTEGRATED! [CON ${conSave.total} vs DC ${conSave.dc}]`, 'combat');
      else addLog(`💀 Disintegrate → ${target.name}: ${dmg} damage! [CON ${conSave.total} vs DC ${conSave.dc}]`, 'combat');
    } else {
      const dmg = applyDamage(target.id, Math.floor(rollDice(spell.damage, statMod) / 2));
      target.hp = Math.max(0, target.hp - dmg);
      addLog(`💀 Disintegrate → ${target.name}: ${dmg} damage (CON save ${conSave.total} vs DC ${conSave.dc})`, 'combat');
    }
  }

  // ── WARRIOR ─────────────────────────────────
  else if (spell.id === 'war_cry') {
    addStatus('player', { id:'war_cry', name:'War Cry', icon:'😤', turnsLeft:3, atkMod:2 });
    addLog(`😤 War Cry! +2 ATK bonus for 3 turns!`, 'holy');
  }
  else if (spell.id === 'whirlwind') {
    const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0);
    enemies.forEach(c => {
      const dmg = applyDamage(c.id, rollDice(spell.damage, statMod));
      c.hp = Math.max(0, c.hp - dmg);
      addLog(`🌀 Whirlwind → ${c.name}: ${dmg} damage!`, 'combat');
    });
  }
  else if (spell.id === 'last_stand') {
    addStatus('player', { id:'last_stand', name:'Last Stand', icon:'🛡', turnsLeft:4 });
    addLog(`🛡 Last Stand active! Below 20 HP: +50% damage for 4 turns.`, 'holy');
  }
  else if (spell.id === 'execute') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    if (target.hp > target.maxHp * 0.25) {
      addLog(`⚔ Execute: ${target.name} must be below 25% HP! (${target.hp}/${target.maxHp})`, 'system');
      player.mp += spell.mp; combatState.apRemaining += spell.ap; return;
    }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`⚔ EXECUTE → ${target.name}: ${dmg} massive damage! [target was at ${Math.floor(target.hp/target.maxHp*100)}% HP]`, 'combat');
  }
  else if (spell.id === 'avatar_war') {
    addStatus('player', { id:'avatar_war', name:'Avatar of War', icon:'🔥', turnsLeft:3, dmgMult:2 });
    addLog(`🔥 Avatar of War! +100% damage for 3 turns. Nothing can stop you.`, 'holy');
  }

  // ── ROGUE ────────────────────────────────────
  else if (spell.id === 'sneak_attack') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`🗡 Sneak Attack → ${target.name}: ${dmg} damage from the shadows!`, 'combat');
  }
  else if (spell.id === 'smoke_bomb') {
    // Apply -4 ATK debuff to all enemies
    Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0).forEach(c => {
      addStatus(c.id, { id:'smoke_bomb_debuff', name:'Blinded (Smoke)', icon:'💨', turnsLeft:2, atkMod:-4 });
    });
    addLog(`💨 Smoke Bomb! All enemies suffer -4 ATK for 2 turns!`, 'holy');
  }
  else if (spell.id === 'shadow_step') {
    // Grant +4 AC (reverted on expiry via acDelta) and make the next attack auto-hit
    const acDelta = 4;
    addStatus('player', { id:'shadow_step', name:'Shadow Step', icon:'🌑', turnsLeft:1, acDelta, nextHitAutoHit:true });
    player.ac = (player.ac || 12) + acDelta;
    addLog(`🌑 Shadow Step! Vanished into shadows. +4 AC, next attack auto-hits!`, 'holy');
  }
  else if (spell.id === 'garrote') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
    target.hp = Math.max(0, target.hp - dmg);
    addStatus(target.id, { id:'garrote_silence', name:'Silenced', icon:'🔇', turnsLeft:3 });
    addLog(`🩸 Garrote → ${target.name}: ${dmg} damage + SILENCED for 3 turns (no spells)!`, 'combat');
  }
  else if (spell.id === 'phantom_kill') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    if (target.hp <= target.maxHp * 0.3) {
      // Instant kill
      const oldHp = target.hp;
      target.hp = 0;
      addLog(`👤 PHANTOM KILL → ${target.name}: INSTANT KILL from darkness! [was at ${Math.floor(oldHp/target.maxHp*100)}% HP]`, 'combat');
    } else {
      const dmg = applyDamage(target.id, rollDice(spell.damage, statMod));
      target.hp = Math.max(0, target.hp - dmg);
      addLog(`👤 Phantom Kill → ${target.name}: ${dmg} damage. (Instant kill requires <30% HP)`, 'combat');
    }
  }

  // ── RANGER ───────────────────────────────────
  else if (spell.id === 'hunters_mark') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    addStatus('player', { id:'hunters_mark', name:"Hunter's Mark", icon:'🎯', turnsLeft:6, targetId: target.id });
    addLog(`🎯 Hunter's Mark on ${target.name}! All attacks vs them deal +2d6 bonus damage.`, 'holy');
  }
  else if (spell.id === 'multi_shot') {
    const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0).slice(0, 3);
    if (enemies.length === 0) { addLog('No targets!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    enemies.forEach(c => {
      const dmg = applyDamage(c.id, rollDice('2d8', statMod));
      c.hp = Math.max(0, c.hp - dmg);
      addLog(`🏹 Multi-Shot → ${c.name}: ${dmg} damage!`, 'combat');
    });
  }
  else if (spell.id === 'vine_trap') {
    if (!target) { addLog('Select a target!', 'system'); player.mp += spell.mp; combatState.apRemaining += spell.ap; return; }
    addStatus(target.id, { id:'vine_trap', name:'Rooted', icon:'🌿', turnsLeft:2 });
    addLog(`🌿 Vine Trap → ${target.name}: ROOTED for 2 turns! Cannot act.`, 'holy');
  }
  else if (spell.id === 'volley') {
    const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0);
    const dmg = rollDice(spell.damage, 0);
    enemies.forEach(c => {
      const d = applyDamage(c.id, dmg);
      c.hp = Math.max(0, c.hp - d);
      addLog(`☄ Volley → ${c.name}: ${d} arrow damage!`, 'combat');
    });
  }
  else if (spell.id === 'apex_predator') {
    addStatus('player', { id:'apex_predator', name:'Spirit Beast', icon:'🐺', turnsLeft:5 });
    addLog(`🐺 Apex Predator! A spirit beast answers your call — it attacks alongside you for 5 turns!`, 'holy');
  }

  combatState.selectedSpell = null;
  checkCombatEnd();
  if (!combatState.active) return;
  syncPlayerHP();
  updateCombatUI();

  // Auto-end turn when AP spent
  if (combatState.apRemaining <= 0) {
    addLog(`⏸ All AP spent — ending your turn.`, 'system');
    combatState.pendingEndTurnTimer = setTimeout(endPlayerTurn, 600);
  }
}

function rollDice(formula, statMod) {
  if (!formula) return 0;
  return COMBAT_RULES.rollFormula(formula, {
    statMods:{ str:statMod||0, dex:statMod||0, con:statMod||0, int:statMod||0, wis:statMod||0, cha:statMod||0 },
  }).total;
}

function combatMove(position) {
  if (combatState.apRemaining < 1) return;
  const player=combatState.combatants.player;
  if(position&&player?.position&&window.TacticalCombat){const movement=window.TacticalCombat.validateMove(player.position,position,{maxDistance:combatState.tactical?.moveRange||4.5,bounds:combatState.tactical?.bounds||12});if(!movement.ok){addLog('That movement is not valid on this battlefield.','system');return;}player.position=movement.position;}
  combatState.apRemaining--;
  if (window.classOnMove) classOnMove();
  addLog('🏃 You reposition on the battlefield.', 'system');
  updateCombatUI();
}

function combatItem() {
  if (combatState.apRemaining < 1) return;
  const char = gameState.character;
  const player = combatState.combatants['player'];
  if (!player) return;

  // #25: recognise any healing consumable — by SHOP_ITEMS metadata (effect heal_N)
  // or by name keywords — instead of only matching "potion".
  const nameKeywords = ['potion','mending','bandage','draught','vial','salve','tonic','elixir','rations','bread'];
  const items = window.SHOP_ITEMS || {};
  const findCatalog = (name) => Object.values(items).find(i => i.name === name);
  const isHealItem = (name) => {
    const ci = findCatalog(name);
    if (ci && typeof ci.effect === 'string' && ci.effect.startsWith('heal_')) return true;
    const lower = name.toLowerCase();
    return nameKeywords.some(k => lower.includes(k));
  };
  // #31: MP-restore consumables (Essence of Focus / "MP Tonic" etc.) were unusable in
  // combat. Recognise effect mp_N items too and restore MP (bounded by maxMp).
  const isMpItem = (name) => {
    const ci = findCatalog(name);
    return !!(ci && typeof ci.effect === 'string' && ci.effect.startsWith('mp_'));
  };

  const healName = (char?.inventory || []).find(isHealItem);

  // If no heal item but an MP item exists, use that instead.
  if (!healName) {
    const mpName = (char?.inventory || []).find(isMpItem);
    if (!mpName) { addLog('No healing or restorative items to use!', 'system'); return; }
    const mci = findCatalog(mpName);
    let mpAmt = 40; // fallback
    if (mci && typeof mci.effect === 'string' && mci.effect.startsWith('mp_')) {
      mpAmt = parseInt(mci.effect.split('_')[1]) || 40;
    }
    const beforeMp = player.mp;
    player.mp = Math.min(player.maxMp, player.mp + mpAmt);
    char.mp = player.mp;
    const mridx = char.inventory.indexOf(mpName);
    if (mridx !== -1) char.inventory.splice(mridx, 1);
    combatState.apRemaining--;
    addLog(`💧 Used ${mpName}! Restored ${player.mp - beforeMp} MP. (${player.mp}/${player.maxMp})`, 'holy');
    syncPlayerHP();
    updateCombatUI();
    if (combatState.apRemaining <= 0) {
      addLog(`⏸ All AP spent — ending your turn.`, 'system');
      combatState.pendingEndTurnTimer = setTimeout(endPlayerTurn, 600);
    }
    return;
  }

  // Determine the item's real heal amount where the catalogue knows it.
  const ci = findCatalog(healName);
  let healAmt = 30; // fallback for loot with no metadata
  if (ci && typeof ci.effect === 'string' && ci.effect.startsWith('heal_')) {
    healAmt = parseInt(ci.effect.split('_')[1]) || 30;
  }

  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + healAmt);
  char.hp = player.hp;
  const ridx = char.inventory.indexOf(healName);
  if (ridx !== -1) char.inventory.splice(ridx, 1);
  combatState.apRemaining--;
  addLog(`🎒 Used ${healName}! Restored ${player.hp - before} HP. (${player.hp}/${player.maxHp})`, 'holy');
  syncPlayerHP();
  updateCombatUI();

  if (combatState.apRemaining <= 0) {
    addLog(`⏸ All AP spent — ending your turn.`, 'system');
    combatState.pendingEndTurnTimer = setTimeout(endPlayerTurn, 600);
  }
}

function endPlayerTurn() {
  // #14: guard — only valid during the player's turn, and only once per turn
  if (!combatState.active) return;
  if (combatState.whoseTurn !== 'player') return;
  if (combatState.endedThisTurn) return;
  combatState.endedThisTurn = true;
  // Clear any pending auto-end timer so it can't fire a second time
  if (combatState.pendingEndTurnTimer) { clearTimeout(combatState.pendingEndTurnTimer); combatState.pendingEndTurnTimer = null; }

  // Apply DOT effects at end of player turn
  const player = combatState.combatants['player'];
  if (player) {
    (combatState.statusEffects['player'] || []).forEach(s => {
      if (s.dmgPerTurn) {
        const dmg = applyDamage('player', s.dmgPerTurn);
        player.hp = Math.max(0, player.hp - dmg);
        if (gameState.character) gameState.character.hp = player.hp;
        addLog(`${s.icon} ${s.name} deals ${dmg} damage!`, 'combat');
      }
    });
    checkCombatEnd();
    syncPlayerHP();
  }
  combatState.apRemaining = 0;
  advanceTurn();
}

function getTarget() {
  if (combatState.selectedTarget) {
    const t = combatState.combatants[combatState.selectedTarget];
    if (t && t.hp > 0) return t;
  }
  return Object.values(combatState.combatants).find(c => !c.isPlayer && c.hp > 0);
}

// ─── ADVANCE TURN ─────────────────────────────
function advanceTurn() {
  if (!combatState.active) return; // combat ended — stop the turn loop
  do {
    combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % combatState.turnOrder.length;
    if (combatState.currentTurnIndex === 0) { combatState.round++; if(window.classOnRoundEnd) classOnRoundEnd(); }
  } while (combatState.combatants[combatState.turnOrder[combatState.currentTurnIndex]]?.hp <= 0);

  combatState.apRemaining = MAX_AP;
  processTurn();
}

function processTurn() {
  if (!combatState.active) return; // combat ended — stop
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  const current = combatState.combatants[currentId];
  if (!current || current.hp <= 0) { advanceTurn(); return; }

  // #14: mark whose turn it is and reset the per-turn end guard
  combatState.whoseTurn = currentId;
  combatState.endedThisTurn = false;
  if (combatState.pendingEndTurnTimer) { clearTimeout(combatState.pendingEndTurnTimer); combatState.pendingEndTurnTimer = null; }

  // #18: stunned combatants skip their action entirely. Check BEFORE ticking so a
  // 1-turn stun ("stunned next turn") is honored, then tick it away.
  if (hasStatus(currentId, 'stunned')) {
    addLog(`💫 ${current.name} is STUNNED and loses their turn!`, 'system');
    tickStatuses(currentId);
    // #11: for the player, zero out AP and mark the turn ended BEFORE rendering the UI,
    // so updateCombatUI() draws a spent, non-actionable turn (no live action buttons).
    if (current.isPlayer) {
      combatState.apRemaining = 0;
      combatState.endedThisTurn = true;
    }
    updateCombatUI();
    setTimeout(advanceTurn, 900);
    return;
  }

  // Tick status effects at start of this combatant's turn
  tickStatuses(currentId);

  // Apex Predator spirit beast attacks with player
  if (currentId === 'player' && hasStatus('player', 'apex_predator')) {
    const enemy = Object.values(combatState.combatants).find(c => !c.isPlayer && c.hp > 0);
    if (enemy) {
      const beastDmg = rollDice('2d8', 0);
      const finalDmg = applyDamage(enemy.id, beastDmg);
      enemy.hp = Math.max(0, enemy.hp - finalDmg);
      addLog(`🐺 Spirit Beast attacks ${enemy.name} for ${finalDmg}!`, 'combat');
      checkCombatEnd();
    }
  }

  // #20: Spirit Weapon strikes each of the player's rounds for its stored bonusAtk
  if (currentId === 'player' && hasStatus('player', 'spirit_weapon')) {
    const sw = getStatusData('player', 'spirit_weapon');
    const enemy = getTarget() || Object.values(combatState.combatants).find(c => !c.isPlayer && c.hp > 0);
    if (enemy && sw) {
      const swDmg = applyDamage(enemy.id, sw.bonusAtk || rollDice('2d8', 0));
      enemy.hp = Math.max(0, enemy.hp - swDmg);
      addLog(`👻 Spiritual Weapon strikes ${enemy.name} for ${swDmg}!`, 'holy');
      checkCombatEnd();
    }
  }

  // If an auto-attack (spirit beast / spirit weapon) just ended combat, stop here.
  if (!combatState.active) return;

  // Hunter's Mark: track marked target for bonus damage
  if (currentId === 'player' && hasStatus('player', 'hunters_mark')) {
    // bonus applied in combatAttack
  }

  if (current.isPlayer && window.classOnTurnStart) classOnTurnStart();
  updateCombatUI();

  if (!current.isPlayer) {
    setTimeout(() => enemyAI(currentId), 1000);
  }
}

// ─── ENEMY AI ─────────────────────────────────
function enemyAI(enemyId) {
  if (!combatState.active) return; // combat ended — stop
  const enemy = combatState.combatants[enemyId];
  if (!enemy || enemy.hp <= 0) { advanceTurn(); return; }

  const player = combatState.combatants['player'];
  if (!player) return;
  let ap = MAX_AP;

  // #12: tick damage-over-time statuses (poison / bleed / Nightshade) on the enemy at
  // the start of its turn, mirroring the player DOT loop in endPlayerTurn. The status
  // duration was already decremented by tickStatuses() in processTurn, so applying the
  // damage here can't double-tick. A DOT that kills the enemy ends its turn cleanly.
  const enemyDots = (combatState.statusEffects[enemyId] || []).filter(s => s.dmgPerTurn);
  if (enemyDots.length) {
    enemyDots.forEach(s => {
      if (enemy.hp <= 0) return;
      const dmg = applyDamage(enemyId, s.dmgPerTurn);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      addLog(`${s.icon} ${enemy.name} suffers ${dmg} ${s.name} damage! (${enemy.hp}/${enemy.maxHp} HP)`, 'combat');
    });
    updateCombatUI();
    checkCombatEnd();
    if (!combatState.active) return; // a DOT ended combat
    if (enemy.hp <= 0) { advanceTurn(); return; } // DOT killed this enemy — end its turn
  }

  // Rooted: skip turn
  if (isRooted(enemyId)) {
    addLog(`🌿 ${enemy.name} is ROOTED — cannot act!`, 'system');
    updateCombatUI(); checkCombatEnd();
    setTimeout(advanceTurn, 800); return;
  }

  // Flee check
  if (enemy.flee && enemy.hp < enemy.maxHp * 0.4) {
    const escape = COMBAT_RULES.rollInitiative({ bonus:enemy.dex || 0 });
    const pursuit = COMBAT_RULES.rollInitiative({ bonus:player.statMods?.dex || 0 });
    if (escape.total > pursuit.total) {
      addLog(`${enemy.icon} ${enemy.name} flees in terror!`, 'system');

      // #21: was this the last living enemy? Capture BEFORE pruning so a last-enemy
      // flee ends combat as a clean retreat — NOT a hollow "VICTORY!" with 0 XP.
      const otherLiving = Object.values(combatState.combatants)
        .filter(c => !c.isPlayer && c.hp > 0 && c.id !== enemyId);

      // #21: adjust currentTurnIndex when removing an entry at/below the cursor
      const removedIndex = combatState.turnOrder.indexOf(enemyId);
      delete combatState.combatants[enemyId];
      combatState.turnOrder = combatState.turnOrder.filter(id => id !== enemyId);
      if (removedIndex !== -1 && removedIndex < combatState.currentTurnIndex) {
        combatState.currentTurnIndex--;
      }

      if (otherLiving.length === 0) {
        // No enemies remain — end combat as a genuine end (fleeing enemy grants nothing)
        combatState.active = false;
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
        addLog('🏳 The last enemy fled. The fight is over.', 'system');
        if (gameState.character && combatState.combatants['player']) {
          gameState.character.hp = Math.max(1, combatState.combatants['player'].hp);
        }
        const track = window.WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.music;
        if (window.AudioEngine && track) AudioEngine.transitionForContext ? AudioEngine.transitionForContext(track, 'combat_exit') : AudioEngine.transition(track, 1500);
        updateCombatUI();
        setTimeout(() => {
          document.getElementById('combat-panel')?.remove();
          if (window.updateCharacterPanel) updateCharacterPanel();
          if (window.renderPlayerCard) renderPlayerCard();
        }, 1500);
        return;
      }

      updateCombatUI();
      setTimeout(advanceTurn, 800); return;
    }
  }

  // Try to cast a spell (30% chance if has spells, enough mp, and not silenced)
  if (enemy.spells?.length > 0 && enemy.mp > 15 && Math.random() < 0.3 && ap >= 2 && !isSilenced(enemyId)) {
    const spellId = enemy.spells[Math.floor(Math.random()*enemy.spells.length)];
    enemy.mp -= 20;
    ap -= 2;
    castEnemySpell(enemy, spellId, player);
  } else {
    // Basic attack — check smoke_bomb debuff
    const atkMod = getAtkMod(enemyId);
    const playerAC = player.ac || 12;
    const attack = COMBAT_RULES.resolveAttack({
      attackBonus:(enemy.attackBonus ?? enemy.atk ?? 0) + atkMod, targetAC:playerAC,
      attackerConditions:(combatState.statusEffects[enemyId] || []).map(status => status.id),
      targetConditions:(combatState.statusEffects.player || []).map(status => status.id),
    });
    const { roll } = attack;
    if (attack.hit) {
      const dmg = COMBAT_RULES.rollFormula('1d8', { modifier:enemy.damageMod ?? enemy.atk ?? 0, critical:attack.crit }).total;
      const finalDmg = applyDamage('player', dmg);
      player.hp = Math.max(0, player.hp - finalDmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`${enemy.icon} ${enemy.name} attacks! [${roll}${atkMod?`${atkMod>=0?'+':''}${atkMod}`:''}] — ${finalDmg} damage to ${player.name}!`, 'combat');
      if (window.classOnHitTaken) classOnHitTaken(finalDmg);
      // Paladin aura damage reduction
      const paladinRed = window.getPaladinAuraReduction ? getPaladinAuraReduction() : 0;
      if (paladinRed > 0 && finalDmg > 0) { player.hp = Math.min(player.maxHp, player.hp + paladinRed); if(gameState.character) gameState.character.hp = player.hp; }
    } else {
      addLog(`${enemy.icon} ${enemy.name} attacks but misses! [${roll}]`, 'system');
    }
    ap--;
  }

  updateCombatUI(); checkCombatEnd(); syncPlayerHP();
  setTimeout(advanceTurn, 1200);
}

// ─── ENEMY SPELL EFFECTS ─────────────────────
function castEnemySpell(enemy, spellId, player) {
  const lvl = enemy.level || 1;
  const icon = enemy.icon;

  switch(spellId) {
    case 'hellfire_bolt': {
      const dmg = rollDice(`${lvl}d6`, Math.floor(lvl/2));
      const finalDmg = applyDamage('player', dmg);
      player.hp = Math.max(0, player.hp - finalDmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`😈 ${enemy.name} hurls Hellfire Bolt! ${finalDmg} fire damage!`, 'combat'); break;
    }
    case 'shadow_step': {
      // Enemy teleports — gains evasion for 1 turn (acDelta reverted on expiry)
      const acDelta = 3;
      addStatus(enemy.id, { id:'shadow_step_enemy', name:'Evasive', icon:'🌑', turnsLeft:1, acDelta });
      enemy.ac += acDelta;
      addLog(`🌑 ${enemy.name} vanishes into shadow! +3 AC for 1 turn.`, 'system'); break;
    }
    case 'savage_bite': {
      const dmg = rollDice(`${lvl}d8`, Math.floor(lvl/2));
      const finalDmg = applyDamage('player', dmg);
      player.hp = Math.max(0, player.hp - finalDmg);
      if (gameState.character) gameState.character.hp = player.hp;
      // 50% bleed chance
      if (Math.random() < 0.5) addStatus('player', { id:'bleed', name:'Bleeding', icon:'🩸', turnsLeft:2, dmgPerTurn:3 });
      addLog(`🐺 ${enemy.name} savagely bites! ${finalDmg} damage${hasStatus('player','bleed')?' + BLEEDING!':''}`, 'combat'); break;
    }
    case 'shadow_drain': {
      const dmg = rollDice(`${lvl}d6`, 0);
      const finalDmg = applyDamage('player', dmg);
      player.hp = Math.max(0, player.hp - finalDmg);
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.floor(finalDmg/2));
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`🌑 ${enemy.name} drains your life! ${finalDmg} damage — healed ${Math.floor(finalDmg/2)}!`, 'combat'); break;
    }
    case 'war_cry': {
      addStatus(enemy.id, { id:'war_cry', name:'War Cry', icon:'😤', turnsLeft:3, atkMod:2 });
      addLog(`😤 ${enemy.name} roars a War Cry! +2 ATK for 3 turns.`, 'system'); break;
    }
    case 'execute': {
      if (player.hp <= player.maxHp * 0.25) {
        player.hp = Math.max(0, player.hp - rollDice(`${lvl+2}d10`, 0));
        if (gameState.character) gameState.character.hp = player.hp;
        addLog(`⚔ ${enemy.name} EXECUTES you while you're weakened!`, 'combat');
      } else {
        const dmg = applyDamage('player', rollDice(`${lvl}d8`, 0));
        player.hp = Math.max(0, player.hp - dmg);
        if (gameState.character) gameState.character.hp = player.hp;
        addLog(`⚔ ${enemy.name} uses Execute but you're too strong! ${dmg} damage.`, 'combat');
      } break;
    }
    case 'shadow_curse': {
      addStatus('player', { id:'shadow_curse', name:'Shadow Cursed', icon:'🕯', turnsLeft:3, atkMod:-2 });
      addLog(`🕯 ${enemy.name} places a Shadow Curse! Your attacks weakened for 3 turns.`, 'combat'); break;
    }
    case 'soul_drain': {
      const mpDrain = Math.min(player.mp, 20 + lvl * 5);
      player.mp = Math.max(0, player.mp - mpDrain);
      enemy.mp = Math.min(enemy.maxMp, enemy.mp + mpDrain);
      if (gameState.character) gameState.character.mp = player.mp;
      addLog(`🕯 ${enemy.name} drains ${mpDrain} MP from you!`, 'combat'); break;
    }
    case 'hellfire': {
      const dmg = applyDamage('player', rollDice(`${lvl+1}d8`, Math.floor(lvl/2)));
      player.hp = Math.max(0, player.hp - dmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`🔥 ${enemy.name} unleashes HELLFIRE! ${dmg} damage!`, 'combat'); break;
    }
    case 'divine_wrath': {
      const dmg = applyDamage('player', rollDice(`${lvl}d10`, Math.floor(lvl/3)));
      player.hp = Math.max(0, player.hp - dmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`⚡ ${enemy.name} calls down Divine Wrath! ${dmg} holy damage!`, 'combat'); break;
    }
    case 'summon_flame': {
      // Persists as a burn status
      addStatus('player', { id:'burning', name:'Burning', icon:'🔥', turnsLeft:3, dmgPerTurn:8 });
      addLog(`🔥 ${enemy.name} summons a Flame Elemental! You are BURNING for 3 turns!`, 'combat'); break;
    }
    case 'void_scream': {
      const dmg = applyDamage('player', rollDice(`${lvl}d8`, 0));
      player.hp = Math.max(0, player.hp - dmg);
      addStatus('player', { id:'stunned', name:'Stunned', icon:'💫', turnsLeft:1 });
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`🕳 ${enemy.name} VOID SCREAMS! ${dmg} psychic damage — STUNNED next turn!`, 'combat'); break;
    }
    case 'soul_rend': {
      const dmg = applyDamage('player', rollDice(`${lvl+1}d10`, Math.floor(lvl/2)));
      player.hp = Math.max(0, player.hp - dmg);
      player.maxHp = Math.max(1, player.maxHp - 5); // permanent max HP reduction
      if (gameState.character) { gameState.character.hp = player.hp; gameState.character.maxHp = player.maxHp; }
      addLog(`🕳 ${enemy.name} RENDS your soul! ${dmg} damage — Max HP reduced by 5 permanently!`, 'combat'); break;
    }
    case 'dark_surge': {
      const dmg = applyDamage('player', rollDice(`${lvl+2}d8`, Math.floor(lvl/2)));
      player.hp = Math.max(0, player.hp - dmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`🌑 ${enemy.name} Dark Surges! ${dmg} void damage!`, 'combat'); break;
    }
    case 'holy_smite_corrupted': {
      const dmg = applyDamage('player', rollDice(`${lvl}d8`, Math.floor(lvl/2)));
      player.hp = Math.max(0, player.hp - dmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`🩸 ${enemy.name} uses Corrupted Holy Smite! ${dmg} tainted holy damage!`, 'combat'); break;
    }
    default: {
      const dmg = applyDamage('player', Math.floor(Math.random()*10)+5 + Math.floor(lvl/2));
      player.hp = Math.max(0, player.hp - dmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`${icon} ${enemy.name} uses ${spellId}! ${dmg} damage!`, 'combat');
    }
  }
}

// ─── CHECK WIN/LOSE ───────────────────────────
function checkCombatEnd() {
  const player = combatState.combatants['player'];
  if (!player) return;
  const enemies = Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0);

  if (player.hp <= 0) {
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
  combatState.active = false;

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

    // Story triggers after boss defeats
    setTimeout(() => {
      if (defeatedIds.some(id => id === 'elder_varek' || id?.startsWith('elder_varek'))) {
        if (window.runScene) window.runScene('chapter1_end_arrest');
      } else if (defeatedEnemies.some(enemy => /voice below/i.test(enemy.name || '') || String(enemy.id || '').startsWith('the_voice_below'))) {
        if (window.runScene) window.runScene('monastery_dungeon_cleared');
      } else if (combatState.victoryScene) {
        if (window.runScene) window.runScene(combatState.victoryScene);
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
  combatState.active = false;

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
