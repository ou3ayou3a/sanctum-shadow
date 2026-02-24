// ============================================
//   SANCTUM & SHADOW — COMBAT ENGINE v2
//   Full spell UI, XP/leveling, area levels,
//   HP bars for normals, hidden for bosses,
//   auto-combat triggers, flee mechanics
// ============================================

// ─── CONSTANTS ───────────────────────────────
const AP_COSTS = { move:1, attack:1, spell:2, pray:1, item:1, dash:2, free:0 };
const MAX_AP = 3;

// XP needed per level (level 1→2 needs 100 XP, etc.)
const XP_TABLE = [0,100,250,450,700,1000,1400,1900,2500,3200,4000];

// Spells learned at each level (max 5 spells, last at level 10)
const SPELL_LEARN_LEVELS = [1, 3, 5, 7, 10];

// Area danger levels — maps to WORLD_LOCATIONS
const AREA_LEVELS = {
  vaelthar_city: 1, vaelthar_slums: 1, vaelthar_docks: 1,
  temple_quarter: 2, covenant_hall: 2,
  thornwood_gate: 2, thornwood_forest: 3,
  monastery_aldric: 4, catacombs: 4,
  shadow_reaches: 6, void_citadel: 8,
  shattered_realm: 10,
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
};

// ─── SPELL DATABASE (per class, levels 1-10) ─
const CLASS_SPELLS = {
  cleric: [
    { id:'cure_wounds',    level:1,  name:'Cure Wounds',      icon:'💚', ap:2, mp:20, damage:null,        heal:'2d8+WIS', type:'heal',    desc:'Restore 2d8+WIS HP to one ally.' },
    { id:'spirit_weapon',  level:3,  name:'Spiritual Weapon', icon:'👻', ap:2, mp:35, damage:'2d8+WIS',   heal:null,      type:'holy',    desc:'Summon a floating spectral blade. Attacks each round.' },
    { id:'mass_heal',      level:5,  name:'Mass Heal',        icon:'💫', ap:2, mp:60, damage:null,        heal:'2d6+WIS', type:'heal',    desc:'Heal ALL allies for 2d6+WIS. Costs 8 Holy Points.' },
    { id:'divine_strike',  level:7,  name:'Divine Strike',    icon:'⚡', ap:2, mp:45, damage:'4d8+WIS',   heal:null,      type:'holy',    desc:'Channel divinity into a strike. Deals holy damage.' },
    { id:'revivify',       level:10, name:'Revivify',         icon:'❤', ap:2, mp:80, damage:null,        heal:'1',       type:'revive',  desc:'Restore a fallen ally to 1 HP. Must use within 3 turns.' },
  ],
  paladin: [
    { id:'holy_smite',    level:1,  name:'Holy Smite',    icon:'✝', ap:2, mp:30, damage:'3d6+WIS', heal:'1d4', type:'holy',  desc:'Radiant damage + heal yourself 1d4. Costs 5 Holy.' },
    { id:'lay_on_hands',  level:3,  name:'Lay on Hands',  icon:'🙏', ap:2, mp:25, damage:null,      heal:'3d8', type:'heal',  desc:'Touch an ally to heal 3d8+WIS. Not self.' },
    { id:'divine_shield', level:5,  name:'Divine Shield', icon:'🔆', ap:2, mp:50, damage:null,      heal:null,  type:'buff',  desc:'Absorb up to 30 damage for self or ally. 10 Holy.' },
    { id:'judgment',      level:7,  name:'Judgment',      icon:'⚖', ap:2, mp:60, damage:'5d10+WIS',heal:null,  type:'holy',  desc:'Devastating holy strike. Costs 15 Holy Points.' },
    { id:'wrath_divine',  level:10, name:'Wrath of God',  icon:'☀', ap:3, mp:90, damage:'8d10+WIS',heal:null,  type:'holy',  desc:'Annihilate one target with divine fury. 25 Holy.' },
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
    // Bosses — hidden HP, unknown spells
    captain_rhael: { name:'Captain Rhael',    icon:'🪖', baseHp:80, baseAc:16, baseAtk:7, xp:300, spells:['war_cry','execute'], flee:false, boss:true },
    sister_mourne: { name:'Sister Mourne',    icon:'🕯', baseHp:65, baseAc:14, baseAtk:5, xp:250, spells:['shadow_curse','soul_drain'], flee:false, boss:true },
    elder_varek:   { name:'Elder Varek',      icon:'🔥', baseHp:120,baseAc:17, baseAtk:8, xp:600, spells:['hellfire','divine_wrath','summon_flame'], flee:false, boss:true },
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
  const player = combatState.combatants['player'];
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
  addLog(`✨ +${amount} XP (Total: ${char.xp})`, 'system');

  // Check for level up
  const nextLevel = (char.level || 1) + 1;
  const needed = XP_TABLE[nextLevel] || 99999;
  if (char.xp >= needed && nextLevel <= 20) {
    levelUp(char);
  }
}

function levelUp(char) {
  char.level = (char.level || 1) + 1;
  const cls = CLASSES.find(c => c.id === char.class);

  // HP/MP increase
  char.maxHp += 8;
  char.hp = Math.min(char.hp + 8, char.maxHp);
  char.maxMp = (char.maxMp || 100) + 10;
  char.mp = Math.min((char.mp || 100) + 10, char.maxMp);

  addLog(`🎉 LEVEL UP! ${char.name} is now Level ${char.level}!`, 'holy');
  addLog(`   +8 Max HP, +10 Max MP`, 'system');

  // Learn new spell?
  if (SPELL_LEARN_LEVELS.includes(char.level)) {
    learnNewSpell(char);
  }

  // Above level 10 — upgrade points
  if (char.level > 10) {
    char.upgradePoints = (char.upgradePoints || 0) + 1;
    addLog(`⬆ +1 Spell Upgrade Point (Total: ${char.upgradePoints})`, 'holy');
  }

  showLevelUpPanel(char);
  if (window.updateCharacterPanel) updateCharacterPanel();
}

function learnNewSpell(char) {
  const classSpells = CLASS_SPELLS[char.class] || [];
  const learnedIds = (char.spells || []).map(s => s.id);
  const available = classSpells.filter(s => s.level <= char.level && !learnedIds.includes(s.id));
  if (available.length === 0) return;

  const newSpell = available[0];
  if (!char.spells) char.spells = [];
  if (char.spells.length < 5) {
    char.spells.push({ ...newSpell, upgraded: false });
    addLog(`📖 NEW SPELL LEARNED: ${newSpell.icon} ${newSpell.name}!`, 'holy');
  }
}

function showLevelUpPanel(char) {
  const old = document.getElementById('levelup-panel');
  if (old) old.remove();

  const panel = document.createElement('div');
  panel.id = 'levelup-panel';
  panel.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    z-index:3000;background:linear-gradient(135deg,rgba(5,3,1,0.99),rgba(12,8,3,0.99));
    border:2px solid var(--gold);padding:30px 40px;text-align:center;
    font-family:'Cinzel',serif;color:var(--gold);min-width:320px;
    box-shadow:0 0 60px rgba(201,168,76,0.3);
    animation:levelUpPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
  `;

  const spellMsg = SPELL_LEARN_LEVELS.includes(char.level)
    ? `<div style="color:#aaa;font-size:0.8rem;margin-top:8px">📖 New spell unlocked!</div>`
    : char.level > 10
    ? `<div style="color:#aaa;font-size:0.8rem;margin-top:8px">⬆ +1 Upgrade Point earned</div>`
    : '';

  panel.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:8px">⭐</div>
    <div style="font-size:1.4rem;letter-spacing:0.15em;margin-bottom:4px">LEVEL UP</div>
    <div style="font-size:2rem;margin:8px 0">${char.name}</div>
    <div style="font-size:1rem;color:#aaa">is now Level <span style="color:var(--gold);font-size:1.3rem">${char.level}</span></div>
    <div style="font-size:0.78rem;color:#888;margin-top:8px">+8 HP • +10 MP</div>
    ${spellMsg}
    <button onclick="document.getElementById('levelup-panel').remove()"
      style="margin-top:20px;background:rgba(201,168,76,0.15);border:1px solid var(--gold);
      color:var(--gold);font-family:'Cinzel',serif;font-size:0.8rem;padding:8px 24px;cursor:pointer;
      letter-spacing:0.1em;">CONTINUE</button>
  `;
  document.body.appendChild(panel);
}

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
function startCombat(enemies) {
  const char = gameState.character;
  if (!char) return;

  initPlayerSpells(char);

  combatState.active = true;
  combatState.round = 1;
  combatState.combatants = {};
  combatState.turnOrder = [];
  combatState.selectedSpell = null;

  const wisMod = Math.floor(((char.stats?.wis || 10) - 10) / 2);
  const strMod = Math.floor(((char.stats?.str || 10) - 10) / 2);
  const dexMod = Math.floor(((char.stats?.dex || 10) - 10) / 2);

  combatState.combatants['player'] = {
    id: 'player', name: char.name,
    hp: char.hp, maxHp: char.maxHp,
    mp: char.mp || 100, maxMp: char.maxMp || 100,
    ac: 10 + dexMod,
    atk: strMod,
    type: 'player', ap: MAX_AP, icon: '⚔',
    isPlayer: true, boss: false,
    initiative: Math.floor(Math.random()*20)+1+dexMod,
    spells: char.spells || [],
    statMods: { str:strMod, dex:dexMod, wis:wisMod, int:Math.floor(((char.stats?.int||10)-10)/2) },
  };

  enemies.forEach((e, i) => {
    const id = e.id || ('enemy_' + i);
    combatState.combatants[id] = {
      id, name: e.name,
      hp: e.hp, maxHp: e.hp || e.maxHp || 50,
      ac: e.ac || 12, atk: e.atk || 3,
      mp: e.mp || 50, maxMp: e.mp || 50,
      type: 'enemy', ap: MAX_AP,
      icon: e.icon || '👹',
      isPlayer: false,
      boss: e.boss || false,
      flee: e.flee || false,
      spells: e.spells || [],
      level: e.level || 1,
      xp: e.xp || 50,
      initiative: Math.floor(Math.random()*20)+1+(e.dex||0),
    };
  });

  combatState.turnOrder = Object.keys(combatState.combatants)
    .sort((a,b) => combatState.combatants[b].initiative - combatState.combatants[a].initiative);
  combatState.currentTurnIndex = 0;
  combatState.apRemaining = MAX_AP;

  if (window.AudioEngine) AudioEngine.transition('combat', 800);
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
  addLog('⚔ COMBAT BEGINS — Roll for Initiative!', 'combat');
  combatState.turnOrder.forEach(id => {
    const c = combatState.combatants[id];
    addLog(`  ${c.icon} ${c.name}: Initiative ${c.initiative}`, 'system');
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
  const isPlayerTurn = current?.isPlayer;
  const char = gameState.character;
  const player = combatState.combatants['player'];

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
      return `<div class="combat-enemy ${isTarget ? 'targeted' : ''} ${c.boss ? 'boss' : ''}"
        onclick="selectTarget('${c.id}')">
        <span class="ce-icon">${c.icon}</span>
        <div class="ce-info">
          <span class="ce-name">${c.name}${c.boss ? ' 👑' : ''} <span class="ce-lvl">Lv${c.level||1}</span></span>
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
      onclick="${canCast ? `selectSpell('${s.id}')` : ''}" title="${s.desc}">
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

  // Turn order badges
  const turnOrderHTML = combatState.turnOrder
    .filter(id => combatState.combatants[id]?.hp > 0)
    .map((id, i) => {
      const c = combatState.combatants[id];
      const isCurrent = id === currentId;
      return `<span class="to-badge ${isCurrent ? 'current' : ''} ${c.isPlayer ? 'player' : 'enemy'}">
        ${c.icon} ${c.name.split(' ')[0]}
      </span>`;
    }).join('<span class="to-arrow">→</span>');

  panel.innerHTML = `
    <div class="cp-combat-header">
      <span class="cp-round">Round ${combatState.round}</span>
      <div class="cp-turn-order">${turnOrderHTML}</div>
      <span class="cp-whose-turn ${isPlayerTurn ? 'your-turn' : 'enemy-turn'}">
        ${isPlayerTurn ? '⚔ YOUR TURN' : `${current?.icon} ${current?.name}'s turn`}
      </span>
    </div>

    <div class="cp-enemies">${enemyHTML}</div>

    ${isPlayerTurn ? `
    <div class="cp-player-actions">
      <div class="cp-ap-row">
        <span class="cp-ap-label">ACTION POINTS</span>
        <div class="cp-ap-pips">${apPips}</div>
        <span class="cp-ap-num">${combatState.apRemaining}/${MAX_AP} AP</span>
      </div>

      <div class="cp-action-buttons">
        <button class="ca-btn attack ${combatState.apRemaining < 1 ? 'disabled' : ''}"
          onclick="combatAttack()" title="1 AP — Basic weapon attack">
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
        <button class="ca-btn end-turn" onclick="endPlayerTurn()">
          ⏭ <span>END TURN</span>
        </button>
      </div>

      ${spells.length > 0 ? `
      <div class="cp-spells-label">SPELLS ${combatState.selectedSpell ? `<span class="spell-selected-name">— ${combatState.selectedSpell.icon} ${combatState.selectedSpell.name} selected, click target</span>` : ''}</div>
      <div class="cp-spells">${spellHTML}</div>
      ` : '<div class="cp-no-spells">No spells learned yet. Level up to learn spells.</div>'}

      <div class="cp-cast-row" ${combatState.selectedSpell ? '' : 'style="display:none"'} id="cast-row">
        <button class="ca-btn cast" onclick="castSelectedSpell()">
          ${combatState.selectedSpell?.icon || '✨'} CAST ${combatState.selectedSpell?.name || ''} ON TARGET
        </button>
        <button class="ca-btn cancel" onclick="cancelSpell()">✕ Cancel</button>
      </div>
    </div>
    ` : `<div class="cp-enemy-thinking">${current?.icon} ${current?.name} is acting...</div>`}
  `;
}

// ─── PLAYER ACTIONS ───────────────────────────
function selectTarget(enemyId) {
  combatState.selectedTarget = enemyId;
  updateCombatUI();
}

function selectSpell(spellId) {
  const player = combatState.combatants['player'];
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
  if (combatState.apRemaining < 1) return;
  const target = getTarget();
  if (!target) { addLog('Select a target first!', 'system'); return; }
  const player = combatState.combatants['player'];
  const roll = Math.floor(Math.random()*20)+1;
  const atkBonus = player.atk || 0;
  const hit = roll + atkBonus >= target.ac || roll === 20;

  if (hit) {
    const dmg = Math.floor(Math.random()*8)+1 + (player.atk||0);
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`⚔ ${player.name} attacks ${target.name}! [${roll}+${atkBonus}] HIT — ${dmg} damage!`, 'combat');
    if (gameState.character) { gameState.character.hp = player.hp; }
  } else {
    addLog(`⚔ ${player.name} attacks ${target.name}! [${roll}+${atkBonus}] MISS (AC ${target.ac})`, 'system');
  }
  combatState.apRemaining--;
  checkCombatEnd();
  syncPlayerHP();
  updateCombatUI();
}

function castSelectedSpell() {
  const spell = combatState.selectedSpell;
  if (!spell) return;
  if (combatState.apRemaining < spell.ap) { addLog('Not enough AP!', 'system'); return; }

  const player = combatState.combatants['player'];
  if (player.mp < spell.mp) { addLog('Not enough MP!', 'system'); return; }

  // Holy point check
  if (spell.holy_cost && gameState.character.holyPoints < spell.holy_cost) {
    addLog(`Need ${spell.holy_cost} Holy Points for ${spell.name}!`, 'system'); return;
  }

  player.mp -= spell.mp;
  combatState.apRemaining -= spell.ap;
  if (gameState.character) gameState.character.mp = player.mp;

  const statKey = spell.type === 'holy' || spell.type === 'heal' ? 'wis' : spell.type === 'arcane' ? 'int' : spell.type === 'physical' ? 'str' : 'wis';
  const statMod = player.statMods?.[statKey] || 0;

  if (spell.type === 'heal' || spell.type === 'revive') {
    const healAmt = spell.type === 'revive' ? 1 : rollDice(spell.heal, statMod);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`${spell.icon} ${spell.name}: Healed for ${healAmt} HP!`, 'holy');
  } else if (spell.damage) {
    const target = getTarget();
    if (!target && !spell.aoe) { addLog('Select a target first!', 'system'); return; }
    const dmg = rollDice(spell.damage, statMod);
    if (spell.aoe) {
      Object.values(combatState.combatants).filter(c => !c.isPlayer && c.hp > 0).forEach(c => {
        c.hp = Math.max(0, c.hp - dmg);
        addLog(`${spell.icon} ${spell.name} hits ${c.name} for ${dmg}!`, 'combat');
      });
    } else {
      target.hp = Math.max(0, target.hp - dmg);
      addLog(`${spell.icon} ${spell.name} → ${target.name}: ${dmg} damage! [${spell.type}]`, 'combat');
    }
    if (spell.holy_cost) grantHolyPoints(-spell.holy_cost);
  } else if (spell.type === 'buff') {
    addLog(`${spell.icon} ${spell.name} activated! ${spell.desc}`, 'holy');
  }

  combatState.selectedSpell = null;
  checkCombatEnd();
  syncPlayerHP();
  updateCombatUI();
}

function rollDice(formula, statMod) {
  if (!formula || formula === '1') return 1 + (statMod||0);
  const parts = formula.split('+');
  let total = 0;
  parts.forEach(p => {
    p = p.trim();
    if (p.match(/^\d+d\d+$/i)) {
      const [num, sides] = p.split('d').map(Number);
      for (let i = 0; i < num; i++) total += Math.floor(Math.random()*sides)+1;
    } else if (p.match(/^[A-Z]+$/i)) {
      total += statMod || 0;
    } else {
      total += parseInt(p) || 0;
    }
  });
  return Math.max(1, total);
}

function combatMove() {
  if (combatState.apRemaining < 1) return;
  combatState.apRemaining--;
  addLog('🏃 You reposition on the battlefield.', 'system');
  updateCombatUI();
}

function combatItem() {
  if (combatState.apRemaining < 1) return;
  const char = gameState.character;
  const potions = (char?.inventory || []).filter(i => i.toLowerCase().includes('potion'));
  if (potions.length === 0) { addLog('No items to use!', 'system'); return; }
  const player = combatState.combatants['player'];
  player.hp = Math.min(player.maxHp, player.hp + 30);
  char.hp = player.hp;
  char.inventory = char.inventory.filter(i => i !== potions[0]);
  combatState.apRemaining--;
  addLog(`🎒 Used ${potions[0]}! Restored 30 HP.`, 'holy');
  updateCombatUI();
}

function endPlayerTurn() {
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
  do {
    combatState.currentTurnIndex = (combatState.currentTurnIndex + 1) % combatState.turnOrder.length;
    if (combatState.currentTurnIndex === 0) combatState.round++;
  } while (combatState.combatants[combatState.turnOrder[combatState.currentTurnIndex]]?.hp <= 0);

  combatState.apRemaining = MAX_AP;
  processTurn();
}

function processTurn() {
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  const current = combatState.combatants[currentId];
  if (!current || current.hp <= 0) { advanceTurn(); return; }

  updateCombatUI();

  if (!current.isPlayer) {
    setTimeout(() => enemyAI(currentId), 1000);
  }
}

// ─── ENEMY AI ─────────────────────────────────
function enemyAI(enemyId) {
  const enemy = combatState.combatants[enemyId];
  if (!enemy || enemy.hp <= 0) { advanceTurn(); return; }

  const player = combatState.combatants['player'];
  let ap = MAX_AP;

  // Flee check for cowardly NPCs
  if (enemy.flee && enemy.hp < enemy.maxHp * 0.4) {
    const roll = Math.floor(Math.random()*20)+1;
    const playerRoll = Math.floor(Math.random()*20)+1;
    if (roll > playerRoll) {
      addLog(`${enemy.icon} ${enemy.name} flees in terror!`, 'system');
      delete combatState.combatants[enemyId];
      combatState.turnOrder = combatState.turnOrder.filter(id => id !== enemyId);
      checkCombatEnd();
      updateCombatUI();
      setTimeout(advanceTurn, 800);
      return;
    }
  }

  // Try to cast a spell (20% chance if has spells and mp)
  if (enemy.spells?.length > 0 && enemy.mp > 20 && Math.random() < 0.3 && ap >= 2) {
    const spell = enemy.spells[Math.floor(Math.random()*enemy.spells.length)];
    enemy.mp -= 20;
    const dmg = Math.floor(Math.random()*10)+5 + Math.floor(enemy.level/2);
    player.hp = Math.max(0, player.hp - dmg);
    if (gameState.character) gameState.character.hp = player.hp;
    addLog(`${enemy.icon} ${enemy.name} uses ${spell}! ${dmg} damage!`, 'combat');
    ap -= 2;
  } else {
    // Basic attack
    const roll = Math.floor(Math.random()*20)+1;
    const playerAC = player.ac || 12;
    if (roll + (enemy.atk||0) >= playerAC || roll === 20) {
      const dmg = Math.floor(Math.random()*8)+1 + (enemy.atk||0);
      player.hp = Math.max(0, player.hp - dmg);
      if (gameState.character) gameState.character.hp = player.hp;
      addLog(`${enemy.icon} ${enemy.name} attacks! [${roll}] — ${dmg} damage to ${player.name}!`, 'combat');
    } else {
      addLog(`${enemy.icon} ${enemy.name} attacks but misses! [${roll}]`, 'system');
    }
    ap--;
  }

  updateCombatUI();
  checkCombatEnd();
  syncPlayerHP();
  setTimeout(advanceTurn, 1200);
}

// ─── CHECK WIN/LOSE ───────────────────────────
function checkCombatEnd() {
  const player = combatState.combatants['player'];
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

function endCombat(victory) {
  combatState.active = false;

  if (victory) {
    let totalXP = 0;
    Object.values(combatState.combatants).filter(c => !c.isPlayer).forEach(c => {
      totalXP += c.xp || 50;
      grantHolyPoints(2);
    });
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`⚔ VICTORY! All enemies defeated!`, 'holy');
    grantXP(totalXP);
    if (window.AudioEngine) AudioEngine.transition(window.mapState?.currentLocation || 'vaelthar_city', 1500);
  } else {
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`💀 DEFEATED! You wake up, wounded but alive...`, 'combat');
    grantHellPoints(3);
    if (gameState.character) {
      gameState.character.hp = Math.floor(gameState.character.maxHp * 0.2);
    }
    if (window.AudioEngine) AudioEngine.transition(window.mapState?.currentLocation || 'vaelthar_city', 1500);
  }

  // Sync player HP back
  if (gameState.character && combatState.combatants['player']) {
    gameState.character.hp = Math.max(1, combatState.combatants['player'].hp);
  }

  setTimeout(() => {
    const panel = document.getElementById('combat-panel');
    if (panel) panel.remove();
    if (window.updateCharacterPanel) updateCharacterPanel();
  }, 2000);
}

// ─── AUTO-COMBAT TRIGGER ─────────────────────
// Intercepts "attack X" typed actions
function checkAutoAttack(text) {
  const lower = text.toLowerCase();
  const attackWords = ['attack', 'stab', 'strike', 'punch', 'hit', 'fight', 'kill', 'shoot', 'slash'];
  if (!attackWords.some(w => lower.startsWith(w) || lower.includes(' ' + w + ' '))) return false;
  if (combatState.active) return false;

  // Extract target name
  let targetName = lower;
  attackWords.forEach(w => { targetName = targetName.replace(w, '').trim(); });
  targetName = targetName.replace(/^(the|a|an)\s+/, '').trim();

  // Check if target is a "fearful" NPC who might flee
  const fearfulNPCs = ['scribe', 'aldis', 'merchant', 'peasant', 'child', 'farmer'];
  const isFearful = fearfulNPCs.some(n => targetName.includes(n));

  if (isFearful) {
    const playerRoll = Math.floor(Math.random()*20)+1;
    const npcRoll = Math.floor(Math.random()*20)+1;
    addLog(`🎲 ${text}: Your roll [${playerRoll}] vs NPC flee [${npcRoll}]`, 'dice');
    if (npcRoll > playerRoll) {
      addLog(`💨 ${targetName} bolts in terror before you can reach them!`, 'narrator');
      grantHellPoints(2);
      return true;
    }
  }

  // Look up NPC in registry or generate appropriate enemy
  const npcMap = {
    'captain rhael': () => generateEnemy('captain_rhael', 1),
    'rhael': () => generateEnemy('captain_rhael', 1),
    'guard': () => generateEnemy('city_guard', 1),
    'city guard': () => generateEnemy('city_guard', 1),
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

  addLog(`⚔ ${text} — COMBAT STARTS!`, 'combat');
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
`;
const cStyle = document.createElement('style');
cStyle.textContent = combatCSS;
document.head.appendChild(cStyle);

console.log('⚔ Combat system initialized. AP costs: Move=1, Attack=1, Spell=2, Pray=1, Free actions=0');
