// ============================================
//   SANCTUM & SHADOW — TURN-BASED COMBAT
//   Action Points system
// ============================================

// ─── ACTION POINT COSTS ──────────────────────
const AP_COSTS = {
  move:        1,  // moving to a new position
  attack:      1,  // basic weapon attack
  spell:       2,  // any spell cast
  pray:        1,  // holy/dark prayer
  item:        1,  // use item from inventory
  dash:        2,  // move twice in one turn
  free:        0,  // talking, looking, anything outside combat
};

const MAX_AP = 3; // action points per turn

// ─── COMBAT STATE ────────────────────────────
const combatState = {
  active: false,
  round: 0,
  turnOrder: [],       // array of combatant ids
  currentTurnIndex: 0,
  combatants: {},      // id → { name, hp, maxHp, ac, atk, type, ap, icon, isPlayer }
  apRemaining: MAX_AP,
  log: [],
};

// ─── ENTER COMBAT ─────────────────────────────
function startCombat(enemies) {
  const char = gameState.character;
  if (!char) return;

  combatState.active = true;
  combatState.round = 1;
  combatState.combatants = {};
  combatState.turnOrder = [];

  // Add player
  combatState.combatants['player'] = {
    id: 'player',
    name: char.name,
    hp: char.hp,
    maxHp: char.maxHp,
    ac: 10 + Math.floor((char.stats?.dex - 10) / 2),
    atk: Math.floor((char.stats?.str - 10) / 2),
    type: 'player',
    ap: MAX_AP,
    icon: '⚔',
    isPlayer: true,
    initiative: Math.floor(Math.random() * 20) + 1 + Math.floor((char.stats?.dex - 10) / 2),
  };

  // Add enemies
  enemies.forEach((e, i) => {
    const id = 'enemy_' + i;
    combatState.combatants[id] = {
      id,
      name: e.name,
      hp: e.hp,
      maxHp: e.hp,
      ac: e.ac || 12,
      atk: e.atk || 3,
      type: 'enemy',
      ap: MAX_AP,
      icon: e.icon || '👹',
      isPlayer: false,
      initiative: Math.floor(Math.random() * 20) + 1 + (e.dex || 0),
    };
  });

  // Sort by initiative (highest first)
  combatState.turnOrder = Object.keys(combatState.combatants)
    .sort((a, b) => combatState.combatants[b].initiative - combatState.combatants[a].initiative);

  combatState.currentTurnIndex = 0;
  combatState.apRemaining = MAX_AP;

  // Switch music
  if (window.AudioEngine) AudioEngine.transition('combat', 1500);

  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
  addLog(`⚔ COMBAT BEGINS — Round ${combatState.round}`, 'combat');
  combatState.turnOrder.forEach(id => {
    const c = combatState.combatants[id];
    addLog(`  ${c.icon} ${c.name} — Initiative: ${c.initiative}`, 'system');
  });

  renderCombatUI();
  beginTurn();
}

// ─── TURN MANAGEMENT ──────────────────────────
function beginTurn() {
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  const current = combatState.combatants[currentId];
  if (!current || current.hp <= 0) { nextTurn(); return; }

  current.ap = MAX_AP;

  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
  addLog(`🎯 ${current.name}'s turn — ${MAX_AP} Action Points`, current.isPlayer ? 'action' : 'combat');

  if (current.isPlayer) {
    combatState.apRemaining = MAX_AP;
    renderCombatUI();
    toast(`Your turn! ${MAX_AP} AP available.`, 'holy');
  } else {
    // Enemy AI turn
    setTimeout(() => enemyTurn(current), 1000);
  }
}

function spendAP(cost, actionName) {
  if (!combatState.active) return true; // outside combat = always free
  if (combatState.apRemaining < cost) {
    toast(`Not enough AP! Need ${cost}, have ${combatState.apRemaining}.`, 'error');
    addLog(`❌ Can't ${actionName} — not enough Action Points (need ${cost}, have ${combatState.apRemaining}).`, 'system');
    return false;
  }
  combatState.apRemaining -= cost;
  addLog(`⚡ ${actionName} — costs ${cost} AP. ${combatState.apRemaining} AP remaining.`, 'system');
  renderCombatUI();

  if (combatState.apRemaining <= 0) {
    addLog(`⏳ All Action Points spent. Use End Turn or wait.`, 'system');
  }
  return true;
}

function endTurn() {
  if (!combatState.active) return;
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  const current = combatState.combatants[currentId];
  addLog(`✅ ${current?.name || 'Player'} ends their turn.`, 'system');
  nextTurn();
}

function nextTurn() {
  combatState.currentTurnIndex++;
  if (combatState.currentTurnIndex >= combatState.turnOrder.length) {
    combatState.currentTurnIndex = 0;
    combatState.round++;
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`🔄 ROUND ${combatState.round} BEGINS`, 'combat');
  }

  // Skip dead combatants
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  if (combatState.combatants[currentId]?.hp <= 0) { nextTurn(); return; }

  // Check if combat is over
  const allEnemiesDead = combatState.turnOrder
    .filter(id => !combatState.combatants[id].isPlayer)
    .every(id => combatState.combatants[id].hp <= 0);
  if (allEnemiesDead) { endCombat(true); return; }

  const playerDead = combatState.combatants['player']?.hp <= 0;
  if (playerDead) { endCombat(false); return; }

  renderCombatUI();
  setTimeout(() => beginTurn(), 600);
}

// ─── ENEMY AI ────────────────────────────────
function enemyTurn(enemy) {
  const player = combatState.combatants['player'];
  if (!player || player.hp <= 0) { nextTurn(); return; }

  let ap = MAX_AP;

  // Move (1 AP) then Attack (1 AP)
  addLog(`${enemy.icon} ${enemy.name} moves toward you. (1 AP)`, 'combat');
  ap--;

  setTimeout(() => {
    if (ap > 0) {
      const roll = Math.floor(Math.random() * 20) + 1;
      addLog(`🎲 ${enemy.name} attacks! Roll: [${roll}] vs your AC ${player.ac}`, 'dice');
      if (roll >= player.ac) {
        const dmg = Math.floor(Math.random() * 6) + 1 + (enemy.atk || 0);
        player.hp = Math.max(0, player.hp - dmg);
        gameState.character.hp = player.hp;
        addLog(`💥 HIT! ${enemy.name} deals ${dmg} damage! Your HP: ${player.hp}/${player.maxHp}`, 'combat');
        if (window.AudioEngine) AudioEngine.sfx?.sword();
        renderPlayerCard();
      } else {
        addLog(`🛡 Miss! ${enemy.name}'s attack glances off.`, 'system');
      }
    }
    setTimeout(() => nextTurn(), 800);
  }, 1000);
}

// ─── COMBAT ACTIONS ───────────────────────────
function combatAttack(targetId) {
  if (!combatState.active) return;
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  if (currentId !== 'player') { toast("It's not your turn!", 'error'); return; }
  if (!spendAP(AP_COSTS.attack, 'Attack')) return;

  const char = gameState.character;
  const target = combatState.combatants[targetId];
  if (!target || target.hp <= 0) { toast('Invalid target!', 'error'); return; }

  const roll = Math.floor(Math.random() * 20) + 1;
  const strMod = Math.floor((char.stats?.str - 10) / 2) || 0;
  addLog(`⚔ ${char.name} attacks ${target.name}! Roll: [${roll}] vs AC ${target.ac}`, 'dice');
  if (window.AudioEngine) AudioEngine.sfx?.dice();

  if (roll >= target.ac || roll === 20) {
    const dmg = Math.floor(Math.random() * 8) + 1 + strMod + (roll === 20 ? 8 : 0);
    target.hp = Math.max(0, target.hp - dmg);
    addLog(`💥 HIT! ${dmg} damage${roll === 20 ? ' (CRITICAL!)' : ''}! ${target.name} HP: ${target.hp}/${target.maxHp}`, 'combat');
    if (window.AudioEngine) AudioEngine.sfx?.sword();
    if (target.hp <= 0) {
      addLog(`💀 ${target.name} is defeated!`, 'holy');
      grantHolyPoints(3);
    }
  } else {
    addLog(`🛡 Miss! Your attack glances off ${target.name}.`, 'system');
  }

  // Friendly fire warning
  if (target.type === 'ally') {
    grantHellPoints(8);
    addLog(`⚠ You attacked an ally! +8 Hell Points.`, 'dark');
  }

  renderCombatUI();
}

function combatMove() {
  if (!combatState.active) return;
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  if (currentId !== 'player') { toast("It's not your turn!", 'error'); return; }
  if (!spendAP(AP_COSTS.move, 'Move')) return;

  const char = gameState.character;
  addLog(`🏃 ${char.name} repositions on the battlefield.`, 'action', char.name);
  renderCombatUI();
}

function combatDash() {
  if (!combatState.active) return;
  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  if (currentId !== 'player') { toast("It's not your turn!", 'error'); return; }
  if (!spendAP(AP_COSTS.dash, 'Dash')) return;

  const char = gameState.character;
  addLog(`💨 ${char.name} dashes across the battlefield — double movement!`, 'action', char.name);
  renderCombatUI();
}

// ─── PATCH EXISTING ACTIONS FOR AP ────────────
// Wrap pray() to cost AP in combat
const _origPray = window.pray;
window.pray = function(type) {
  if (combatState.active) {
    const currentId = combatState.turnOrder[combatState.currentTurnIndex];
    if (currentId !== 'player') { toast("It's not your turn!", 'error'); return; }
    if (!spendAP(AP_COSTS.pray, 'Pray')) return;
  }
  if (_origPray) _origPray(type);
};

// Wrap castSpell() to cost 2 AP in combat
const _origCastSpell = window.castSpell;
window.castSpell = function(spellId) {
  if (combatState.active) {
    const currentId = combatState.turnOrder[combatState.currentTurnIndex];
    if (currentId !== 'player') { toast("It's not your turn!", 'error'); return; }
    if (!spendAP(AP_COSTS.spell, 'Cast Spell')) return;
  }
  if (_origCastSpell) _origCastSpell(spellId);
};

// Wrap submitAction() — free outside combat, 1 AP inside
const _origSubmitForCombat = window.submitAction;
window.submitAction = function() {
  if (combatState.active) {
    const currentId = combatState.turnOrder[combatState.currentTurnIndex];
    if (currentId !== 'player') {
      toast("It's not your turn! Wait for the enemy to finish.", 'error');
      return;
    }
    // Detect if it's a move vs free action
    const input = document.getElementById('action-input');
    const text = (input?.value || '').toLowerCase();
    const isMoveAction = ['move','walk','run','go to','travel to','step','approach','retreat','flee','charge'].some(w => text.includes(w));
    const cost = isMoveAction ? AP_COSTS.move : 0; // narrative actions in combat are free unless moving
    if (cost > 0 && !spendAP(cost, 'Move')) return;
  }
  if (_origSubmitForCombat) _origSubmitForCombat();
};

// ─── END COMBAT ───────────────────────────────
function endCombat(playerWon) {
  combatState.active = false;
  if (playerWon) {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    addLog('⚔ VICTORY! All enemies defeated.', 'holy');
    addLog(`🎯 Survived ${combatState.round} rounds of combat.`, 'system');
    grantHolyPoints(5);
    if (window.AudioEngine) AudioEngine.transition(
      WORLD_LOCATIONS[mapState?.currentLocation]?.music || 'city_tense', 2000
    );
  } else {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    addLog('💀 DEFEATED. The Chronicle records your fall.', 'dark');
    addLog('You survive — barely — but at great cost. Lose 20% of your gold and wake wounded.', 'combat');
    gameState.character.hp = Math.floor(gameState.character.maxHp * 0.2);
    grantHellPoints(3);
    renderPlayerCard();
  }
  hideCombatUI();
  if (window.saveGame) saveGame(true);
}

// ─── COMBAT UI ────────────────────────────────
function renderCombatUI() {
  let panel = document.getElementById('combat-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'combat-panel';
    panel.className = 'combat-panel';
    // Insert above the action area
    const actionArea = document.querySelector('.action-area');
    if (actionArea) actionArea.parentNode.insertBefore(panel, actionArea);
  }

  if (!combatState.active) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const currentId = combatState.turnOrder[combatState.currentTurnIndex];
  const isMyTurn = currentId === 'player';
  const enemies = combatState.turnOrder
    .filter(id => !combatState.combatants[id].isPlayer && combatState.combatants[id].hp > 0)
    .map(id => combatState.combatants[id]);
  const player = combatState.combatants['player'];

  panel.innerHTML = `
    <div class="combat-header">
      <span class="combat-round">⚔ ROUND ${combatState.round}</span>
      <span class="combat-turn ${isMyTurn ? 'your-turn' : 'enemy-turn'}">${isMyTurn ? '🟢 YOUR TURN' : '🔴 ENEMY TURN'}</span>
      <span class="combat-ap">⚡ AP: ${combatState.apRemaining}/${MAX_AP}</span>
    </div>

    <!-- AP Bar -->
    <div class="ap-bar">
      ${Array.from({length: MAX_AP}).map((_, i) => `
        <div class="ap-pip ${i < combatState.apRemaining ? 'full' : 'empty'}"></div>
      `).join('')}
      <span class="ap-costs-hint">Move=1AP · Attack=1AP · Spell=2AP · Pray=1AP · Talk=Free</span>
    </div>

    <!-- Enemies -->
    <div class="combat-enemies">
      ${enemies.map(e => `
        <div class="combat-enemy-card">
          <div class="cec-header">
            <span>${e.icon} ${e.name}</span>
            <span class="cec-hp">${e.hp}/${e.maxHp} HP</span>
          </div>
          <div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:${(e.hp/e.maxHp)*100}%;background:var(--hell)"></div></div>
          <div class="cec-stats">AC ${e.ac}</div>
          ${isMyTurn ? `<button class="btn-attack-target" onclick="combatAttack('${e.id}')">⚔ Attack (1 AP)</button>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Combat Actions -->
    ${isMyTurn ? `
    <div class="combat-actions">
      <button class="ca-btn move" onclick="combatMove()">🏃 Move (1 AP)</button>
      <button class="ca-btn dash" onclick="combatDash()">💨 Dash (2 AP)</button>
      <button class="ca-btn spell" onclick="showSpellMenu()">✨ Spell (2 AP)</button>
      <button class="ca-btn pray" onclick="pray('holy')">✝ Holy (1 AP)</button>
      <button class="ca-btn end" onclick="endTurn()">⏭ End Turn</button>
    </div>
    ` : `<div class="combat-waiting">⏳ Waiting for ${combatState.combatants[currentId]?.name || 'enemy'}...</div>`}

    <!-- Turn Order -->
    <div class="turn-order">
      ${combatState.turnOrder.map((id, i) => {
        const c = combatState.combatants[id];
        return `<span class="to-badge ${c.hp <= 0 ? 'dead' : ''} ${i === combatState.currentTurnIndex ? 'active' : ''}">${c.icon} ${c.name.split(' ')[0]}</span>`;
      }).join('')}
    </div>
  `;
}

function hideCombatUI() {
  const panel = document.getElementById('combat-panel');
  if (panel) panel.style.display = 'none';
}

// ─── PATCH showAttackMenu to use combat system ──
window.showAttackMenu = function() {
  if (combatState.active) {
    // In combat — show combat targets directly
    renderCombatUI();
    toast('Select a target from the combat panel below.', '');
    return;
  }
  // Out of combat — start combat with a default encounter
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const enemyPool = loc?.encounters || ['cultist'];
  const enemyId = enemyPool[Math.floor(Math.random() * enemyPool.length)];
  const enemy = STARTING_ENEMIES?.find(e => e.id === enemyId) || {
    name: 'Covenant Cultist', hp: 25, ac: 12, atk: 3, icon: '🗡', id: 'cultist'
  };
  addLog(`⚔ You initiate combat with ${enemy.name}!`, 'combat');
  startCombat([enemy]);
};

// ─── CSS INJECTION ────────────────────────────
const combatCSS = `
.combat-panel {
  background: rgba(8,5,2,0.95);
  border: 1px solid rgba(192,57,43,0.4);
  border-left: 3px solid var(--hell);
  padding: 12px 16px;
  margin: 0 0 6px 0;
  flex-shrink: 0;
}
.combat-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.combat-round { font-family:'Cinzel',serif; color:var(--hell); font-size:0.85rem; letter-spacing:0.1em; }
.combat-turn { font-family:'Cinzel',serif; font-size:0.78rem; letter-spacing:0.08em; }
.combat-turn.your-turn { color:#4a9a6a; }
.combat-turn.enemy-turn { color:var(--hell); }
.combat-ap { font-family:'Cinzel',serif; color:var(--gold); font-size:0.82rem; }

.ap-bar { display:flex; align-items:center; gap:6px; margin-bottom:12px; flex-wrap:wrap; }
.ap-pip {
  width:28px; height:10px; border-radius:2px; border:1px solid rgba(201,168,76,0.3);
  transition: background 0.3s;
}
.ap-pip.full { background: rgba(201,168,76,0.7); box-shadow:0 0 6px rgba(201,168,76,0.3); }
.ap-pip.empty { background: rgba(201,168,76,0.07); }
.ap-costs-hint { font-size:0.65rem; color:var(--text-dim); font-family:'Cinzel',serif; letter-spacing:0.04em; margin-left:4px; }

.combat-enemies { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
.combat-enemy-card {
  background:rgba(192,57,43,0.06); border:1px solid rgba(192,57,43,0.25);
  padding:10px 12px; min-width:140px; flex:1;
}
.cec-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.cec-header span:first-child { font-family:'Cinzel',serif; color:var(--text-main); font-size:0.82rem; }
.cec-hp { color:var(--hell); font-size:0.78rem; font-family:'Cinzel',serif; }
.hp-bar-wrap { background:rgba(192,57,43,0.1); height:5px; margin-bottom:6px; }
.hp-bar-fill { height:100%; transition:width 0.4s; }
.cec-stats { font-size:0.7rem; color:var(--text-dim); margin-bottom:8px; }
.btn-attack-target {
  width:100%; background:rgba(192,57,43,0.15); border:1px solid rgba(192,57,43,0.4);
  color:var(--hell-glow); font-family:'Cinzel',serif; font-size:0.72rem; padding:5px;
  cursor:pointer; letter-spacing:0.08em;
}
.btn-attack-target:hover { background:rgba(192,57,43,0.3); }

.combat-actions { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
.ca-btn {
  background:rgba(20,15,8,0.9); border:1px solid rgba(201,168,76,0.2);
  color:var(--text-secondary); font-family:'Cinzel',serif; font-size:0.7rem;
  padding:6px 10px; cursor:pointer; letter-spacing:0.06em; flex:1; min-width:80px;
  transition: all 0.2s;
}
.ca-btn:hover { border-color:var(--gold); color:var(--gold); }
.ca-btn.move { border-color:rgba(74,154,100,0.3); }
.ca-btn.dash { border-color:rgba(74,100,154,0.3); }
.ca-btn.spell { border-color:rgba(120,80,180,0.3); }
.ca-btn.pray { border-color:rgba(232,200,74,0.3); }
.ca-btn.end { border-color:rgba(192,57,43,0.4); color:var(--hell-glow); }
.ca-btn.end:hover { background:rgba(192,57,43,0.2); }

.combat-waiting { color:var(--text-dim); font-style:italic; font-size:0.82rem; padding:8px 0; }

.turn-order { display:flex; gap:6px; flex-wrap:wrap; padding-top:8px; border-top:1px solid rgba(201,168,76,0.08); }
.to-badge {
  font-family:'Cinzel',serif; font-size:0.65rem; padding:3px 8px;
  background:rgba(20,15,8,0.9); border:1px solid rgba(201,168,76,0.15);
  color:var(--text-dim); letter-spacing:0.05em;
}
.to-badge.active { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,0.1); }
.to-badge.dead { opacity:0.3; text-decoration:line-through; }
`;

const styleEl = document.createElement('style');
styleEl.id = 'combat-styles';
styleEl.textContent = combatCSS;
document.head.appendChild(styleEl);

console.log('⚔ Combat system initialized. AP costs: Move=1, Attack=1, Spell=2, Pray=1, Free actions=0');
