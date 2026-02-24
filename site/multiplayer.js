// ============================================
//   SANCTUM & SHADOW — MULTIPLAYER CLIENT
//   Socket.io real-time sync
// ============================================

// Load Socket.io from CDN if not already loaded
(function loadSocketIO() {
  if (window.io) return initMultiplayer();
  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = initMultiplayer;
  script.onerror = () => console.warn('Socket.io failed to load — multiplayer unavailable');
  document.head.appendChild(script);
})();

// ─── MULTIPLAYER STATE ────────────────────────
window.mp = {
  socket: null,
  connected: false,
  sessionCode: null,
  playerId: null,
  isHost: false,
  session: null,
  combatState: null,
};

function initMultiplayer() {
  if (!window.io) return;

  const socket = window.io();
  window.mp.socket = socket;

  socket.on('connect', () => {
    window.mp.connected = true;
    window.mp.playerId = socket.id;
    console.log('🔗 Multiplayer connected:', socket.id);
    patchSocketForWaiting(socket);
    setupStorySync(socket);
  });

  socket.on('disconnect', () => {
    window.mp.connected = false;
    addLog('⚠ Disconnected from server. Attempting reconnect...', 'system');
  });

  socket.on('error', ({ msg }) => {
    toast(msg, 'error');
  });


  // ── Session update ──
  socket.on('session_update', (session) => {
    window.mp.session = session;
    updateSessionUI();
    updatePartyPanel();
    const chatSection = document.getElementById('mp-chat-section');
    if (chatSection) chatSection.style.display = 'block';
  });

  // ── Chat ──
  socket.on('chat_message', (msg) => {
    renderChatMessage(msg);
  });

  // ── Game log and story sync handled by setupStorySync() ──

  // ── Combat events ──
  socket.on('combat_started', (combatState) => {
    window.mp.combatState = combatState;
    addLog('⚔ COMBAT BEGINS — all players engaged!', 'combat');
    // Start combat UI using server state
    startCombatFromServer(combatState);
  });

  socket.on('combat_update', ({ combatState, log }) => {
    window.mp.combatState = combatState;
    if (log) addLog(log.text, log.type);
    updateCombatFromServer(combatState);
    // Sync own HP
    syncMyHP(combatState);
  });

  socket.on('combat_ended', ({ victory, xp, combatState }) => {
    window.mp.combatState = null;
    if (victory) {
      addLog(`⚔ VICTORY! Party earns ${xp} XP!`, 'holy');
      if (xp && window.grantXP) grantXP(Math.floor(xp / Math.max(1, Object.keys(window.mp.session?.players||{}).length)));
    } else {
      addLog('💀 The party falls...', 'combat');
    }
    setTimeout(() => document.getElementById('combat-panel')?.remove(), 2000);
  });

  socket.on('player_turn_start', ({ playerId, playerName }) => {
    const isMyTurn = playerId === window.mp.playerId;
    addLog(`${isMyTurn ? '⚔ YOUR TURN' : `⏳ ${playerName}'s turn`}`, 'system');
    if (window.mp.combatState) {
      window.mp.combatState.currentTurnIndex = window.mp.combatState.turnOrder.indexOf(playerId);
      updateCombatFromServer(window.mp.combatState);
    }
  });

  socket.on('enemy_turn_start', ({ enemyId, enemy }) => {
    addLog(`${enemy.icon} ${enemy.name} is acting...`, 'system');
    // Any connected player can trigger enemy AI — first one wins (server deduplicates)
    setTimeout(() => {
      socket.emit('enemy_turn', { code: window.mp.sessionCode });
    }, 800 + Math.random() * 400); // slight random delay to avoid double-fire
  });
}

// ─── SESSION ACTIONS ──────────────────────────
function mpCreateSession(sessionName, playerName, maxPlayers) {
  if (!window.mp.socket) { toast('Multiplayer not connected', 'error'); return; }
  window.mp.socket.emit('create_session', { sessionName, playerName, maxPlayers });
}

function mpJoinSession(code, playerName) {
  if (!window.mp.socket) { toast('Multiplayer not connected', 'error'); return; }
  window.mp.socket.emit('join_session', { code: code.toUpperCase(), playerName });
}

function mpCharacterReady(character) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('character_ready', { code: window.mp.sessionCode, character });
}

function mpStartCombat(enemies) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  const initiatorName = gameState.character?.name || window.mp.socket.id;
  addLog(`⚔ ${initiatorName} initiates combat!`, 'combat');
  window.mp.socket.emit('start_combat', { 
    code: window.mp.sessionCode, 
    enemies,
    initiatorId: window.mp.playerId 
  });
}

function mpCombatAction(action, targetId, spellId) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('combat_action', { code: window.mp.sessionCode, action, targetId, spellId });
}

function mpChat(text) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('chat', { code: window.mp.sessionCode, text });
}

function mpBroadcastLog(entry) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('game_log', { code: window.mp.sessionCode, entry });
}

function mpBroadcastStoryEvent(eventType, payload) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('story_event', { code: window.mp.sessionCode, eventType, payload });
}

// ─── PATCH addLog TO BROADCAST ────────────────
// Every log entry made by any player syncs to everyone else
const _origAddLog = window.addLog;
window.addLog = function(text, type = 'system', playerName = null) {
  // Always render locally
  if (_origAddLog) _origAddLog(text, type, playerName);
  // Broadcast to party if in multiplayer session, but only for meaningful events
  // (skip types that each client should generate independently)
  if (window.mp.sessionCode && window.mp.socket && !window.mp._receiving) {
    const skipTypes = []; // broadcast everything
    mpBroadcastLog({ text, type, playerName });
  }
};

// ─── PATCH chooseSceneOption TO BROADCAST ─────
// When any player makes a story choice, all players see it and the scene advances
const _origChooseScene = window.chooseSceneOption;
window.chooseSceneOption = function(index) {
  // Run locally
  if (_origChooseScene) _origChooseScene(index);
  // Broadcast scene choice to all other players
  if (window.mp.sessionCode && window.mp.socket) {
    mpBroadcastStoryEvent('scene_choice', {
      index,
      playerName: gameState.character?.name || 'Unknown',
    });
  }
};

// ─── PATCH submitAction TO BROADCAST ──────────
// When a player takes a free-text action, others see it and its result
const _origSubmitAction_mp = window.submitAction;
window.submitAction = function() {
  // senses.js may have already patched this; call through the chain
  if (_origSubmitAction_mp) _origSubmitAction_mp();
  // The log broadcast happens automatically via the patched addLog above
};

// ─── RECEIVE STORY EVENTS FROM OTHERS ─────────
function setupStorySync(socket) {
  // Receive log entries from other players
  socket.on('game_log', (entry) => {
    // Guard against re-broadcasting what we sent
    if (window.mp._receiving) return;
    window.mp._receiving = true;
    if (window.addLog) {
      // Use original to avoid re-broadcasting
      if (_origAddLog) _origAddLog(entry.text, entry.type, entry.playerName);
    }
    window.mp._receiving = false;
  });

  // Receive scene choices from other players
  socket.on('story_event', ({ eventType, payload, fromPlayer }) => {
    if (eventType === 'scene_choice') {
      // Show who made the choice
      if (_origAddLog) _origAddLog(
        `${payload.playerName} makes a choice...`,
        'system'
      );
      // Advance the scene on all clients
      window.mp._receiving = true;
      if (window.chooseSceneOption && window.sceneState?._currentOptions?.[payload.index]) {
        // Only run scene progression, not the log (already received)
        const option = window.sceneState._currentOptions[payload.index];
        if (option?.next) {
          setTimeout(() => {
            if (window.runScene) window.runScene(option.next);
          }, 400);
        } else if (option?.action) {
          option.action();
        }
        // Remove scene panel on all clients
        setTimeout(() => {
          const panel = document.getElementById('scene-panel');
          if (panel) { panel.style.opacity = '0'; setTimeout(() => panel?.remove(), 400); }
        }, 300);
      }
      window.mp._receiving = false;
    }
  });
}


// ─── COMBAT SYNC ─────────────────────────────
function startCombatFromServer(cs) {
  // Replace local combatState with server state
  Object.assign(combatState, cs);
  combatState.active = true;
  renderCombatUI();
  processTurnFromServer(cs);
}

function updateCombatFromServer(cs) {
  Object.assign(combatState, cs);
  updateCombatUI();
}

function processTurnFromServer(cs) {
  const currentId = cs.turnOrder[cs.currentTurnIndex];
  const current = cs.combatants[currentId];
  if (!current) return;
  // If it's my turn, enable UI. If enemy, host handles it via socket.
  updateCombatUI();
}

function isMyTurnMP() {
  if (!window.mp.session || !window.mp.combatState) return false;
  const currentId = window.mp.combatState.turnOrder[window.mp.combatState.currentTurnIndex];
  return currentId === window.mp.playerId;
}

function syncMyHP(cs) {
  const me = cs.combatants[window.mp.playerId];
  if (!me || !gameState.character) return;
  gameState.character.hp = Math.max(0, me.hp);
  gameState.character.mp = Math.max(0, me.mp);
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
}

// ─── OVERRIDE COMBAT ACTIONS FOR MP ──────────
// Wrap attack/spell/endturn to use socket if in MP session
const _origCombatAttack = window.combatAttack;
window.combatAttack = function() {
  if (window.mp.sessionCode && window.mp.combatState) {
    if (!isMyTurnMP()) { addLog('Not your turn!', 'system'); return; }
    const target = getTarget();
    if (!target) { addLog('Select a target first!', 'system'); return; }
    mpCombatAction('attack', target.id, null);
  } else {
    if (_origCombatAttack) _origCombatAttack();
  }
};

const _origEndTurn = window.endPlayerTurn;
window.endPlayerTurn = function() {
  if (window.mp.sessionCode && window.mp.combatState) {
    if (!isMyTurnMP()) return;
    mpCombatAction('end_turn', null, null);
  } else {
    if (_origEndTurn) _origEndTurn();
  }
};

const _origCastSpell = window.castSelectedSpell;
window.castSelectedSpell = function() {
  if (window.mp.sessionCode && window.mp.combatState) {
    if (!isMyTurnMP()) { addLog('Not your turn!', 'system'); return; }
    const spell = combatState.selectedSpell;
    const target = getTarget();
    if (!spell) return;
    mpCombatAction('spell', target?.id, spell.id);
    combatState.selectedSpell = null;
  } else {
    if (_origCastSpell) _origCastSpell();
  }
};

// Override startCombat — ANY player can trigger it in MP
const _origStartCombat = window.startCombat;
window.startCombat = function(enemies) {
  if (window.mp.sessionCode) {
    // If combat already active, don't restart
    if (window.mp.combatState?.active) {
      addLog('⚔ Combat is already in progress!', 'system'); return;
    }
    mpStartCombat(enemies);
  } else {
    if (_origStartCombat) _origStartCombat(enemies);
  }
};

// ─── PARTY PANEL ──────────────────────────────
function updatePartyPanel() {
  const panel = document.getElementById('party-members');
  if (!panel || !window.mp.session) return;

  const players = Object.values(window.mp.session.players);
  panel.innerHTML = players.map(p => {
    const pct = p.maxHp ? Math.max(0, Math.floor((p.hp / p.maxHp) * 100)) : 100;
    const hpColor = pct > 60 ? '#4a9a6a' : pct > 30 ? '#c9a84c' : '#c0392b';
    const cls = p.character ? CLASSES.find(c => c.id === p.character.class) : null;
    const isMe = p.id === window.mp.playerId;
    return `<div class="pm-slot ${isMe ? 'me' : ''} ${!p.connected ? 'disconnected' : ''}">
      <div class="pm-name">
        <span>${cls?.icon || '👤'} ${p.name}${isMe ? ' (You)' : ''}</span>
        <span style="color:var(--text-dim);font-size:0.7rem">${p.hp || '?'}/${p.maxHp || '?'}</span>
      </div>
      ${p.maxHp ? `<div class="pm-hp-bar"><div class="pm-hp-fill" style="width:${pct}%;background:${hpColor}"></div></div>` : ''}
      ${!p.connected ? '<span style="color:var(--hell-glow);font-size:0.65rem">disconnected</span>' : ''}
    </div>`;
  }).join('');
}

// ─── CHAT UI ──────────────────────────────────
function renderChatMessage(msg) {
  const chatLog = document.getElementById('mp-chat-log');
  if (!chatLog) return;
  const div = document.createElement('div');
  div.className = 'chat-msg ' + (msg.system ? 'system' : '');
  div.innerHTML = msg.system
    ? `<span style="color:var(--text-dim);font-style:italic">${msg.text}</span>`
    : `<span class="chat-from">${msg.from}:</span> <span class="chat-text">${msg.text}</span>`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function submitChat() {
  const input = document.getElementById('mp-chat-input');
  const text = input?.value.trim();
  if (!text) return;
  mpChat(text);
  input.value = '';
}

// ─── SESSION UI ───────────────────────────────
function updateSessionUI() {
  const s = window.mp.session;
  if (!s) return;

  // Update code display wherever it appears
  document.querySelectorAll('.session-code-display').forEach(el => el.textContent = window.mp.sessionCode);

  // Update waiting players list
  const waitEl = document.getElementById('waiting-players');
  if (waitEl && s.players) {
    waitEl.innerHTML = Object.values(s.players).map(p => `
      <div class="player-slot filled ${!p.connected ? 'dim' : ''}">
        <span class="ps-icon">${p.ready ? '✓' : '👤'}</span>
        <span class="ps-name">${p.name}</span>
        <span class="ps-status" style="color:${p.ready ? '#4a9a6a' : 'var(--text-dim)'}">${p.ready ? 'Ready' : 'Creating character...'}</span>
      </div>`).join('');
  }
}

// ─── OVERRIDE SESSION CREATION ────────────────
// Fully replace createSession/joinSession — bypass localStorage entirely
window.createSession = function() {
  const sessionName = document.getElementById('session-name')?.value.trim() || 'The Chronicle';
  const hostName = document.getElementById('host-name')?.value.trim();
  const maxPlayers = parseInt(document.getElementById('max-players')?.value || 4);
  if (!hostName) { toast('Enter your name, stranger.', 'error'); return; }
  if (!window.mp.socket) { toast('Connecting to server...', 'error'); return; }
  mpCreateSession(sessionName, hostName, maxPlayers);
  // Show waiting screen immediately (will populate when socket responds)
  showMPWaitingScreen('Creating session...', hostName);
};

window.joinSession = function() {
  const code = document.getElementById('join-code')?.value.trim().toUpperCase();
  const playerName = document.getElementById('join-name')?.value.trim();
  if (!code) { toast('Enter a session code!', 'error'); return; }
  if (!playerName) { toast('Enter your name!', 'error'); return; }
  if (!window.mp.socket) { toast('Connecting to server...', 'error'); return; }
  mpJoinSession(code, playerName);
  // Show waiting screen — will update when socket confirms join
  showMPWaitingScreen('Joining ' + code + '...', playerName);
};

// ─── MP WAITING SCREEN ────────────────────────
function showMPWaitingScreen(title, playerName) {
  // Remove old wait screens
  document.getElementById('wait-screen')?.remove();

  const waitScreen = document.createElement('div');
  waitScreen.id = 'wait-screen';
  waitScreen.className = 'screen active';
  waitScreen.innerHTML = `
    <div class="screen-inner scroll-content">
      <h2 class="screen-title">⚔ The War Council Gathers</h2>
      <div class="session-banner">
        <span class="session-code-label">SESSION CODE — SHARE WITH YOUR COMPANIONS</span>
        <div class="session-code session-code-display" id="session-code-big" style="font-size:2.2rem;letter-spacing:0.2em;color:var(--gold);margin:10px 0">
          ${window.mp.sessionCode || '...'}
        </div>
        <div style="font-family:'Crimson Text',serif;color:var(--text-dim);font-size:0.85rem" id="wait-session-name">${title}</div>
      </div>
      <div id="waiting-players" class="player-slots" style="margin:16px 0">
        <div class="player-slot filled"><span class="ps-icon">👤</span><span class="ps-name">${playerName}</span><span class="ps-status">Waiting...</span></div>
      </div>
      <p class="step-hint" style="text-align:center">Share the session code with your companions. Once everyone joins, forge your characters!</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
        <button class="btn-primary" onclick="copySessionCode()">📋 Copy Code</button>
        <button class="btn-primary" onclick="proceedToCharCreation()">⚔ Create My Character</button>
        <button class="btn-ghost" onclick="showScreen('lobby')">↩ Cancel</button>
      </div>
    </div>
  `;

  // Deactivate other screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('app').appendChild(waitScreen);
}

function copySessionCode() {
  const code = window.mp.sessionCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => toast('Code copied: ' + code, 'holy'));
}

// ─── UPDATE WAITING SCREEN WHEN SESSION CREATED/JOINED ──
// Override session_created handler to update the waiting screen code display
const _origSocketInit = initMultiplayer;

// Patch socket events after init to update waiting screen properly
function patchSocketForWaiting(socket) {
  socket.on('session_created', ({ code, playerId }) => {
    window.mp.sessionCode = code;
    window.mp.playerId = playerId;
    window.mp.isHost = true;
    gameState.sessionCode = code;
    gameState.isHost = true;
    // Update the displayed code
    document.querySelectorAll('.session-code-display, #session-code-big').forEach(el => el.textContent = code);
    document.getElementById('wait-session-name') && (document.getElementById('wait-session-name').textContent = 'Session: ' + code);
  });

  socket.on('session_joined', ({ code, playerId, session }) => {
    window.mp.sessionCode = code;
    window.mp.playerId = playerId;
    window.mp.isHost = false;
    window.mp.session = session;
    gameState.sessionCode = code;
    gameState.isHost = false;
    document.querySelectorAll('.session-code-display, #session-code-big').forEach(el => el.textContent = code);
    document.getElementById('wait-session-name') && (document.getElementById('wait-session-name').textContent = 'Joined: ' + code);
  });

  socket.on('error', ({ msg }) => {
    toast(msg, 'error');
    // If join failed, go back to lobby
    if (msg.includes('not found') || msg.includes('full')) {
      showScreen('join-session');
    }
  });
}

// Patch finalizeCharacter to broadcast to server
const _origFinalizeChar = window.finalizeCharacter;
window.finalizeCharacter = function() {
  if (_origFinalizeChar) _origFinalizeChar();
  setTimeout(() => {
    if (gameState.character && window.mp.sessionCode) {
      mpCharacterReady(gameState.character);
    }
  }, 500);
};

// ─── CSS ─────────────────────────────────────
const mpCSS = `
.pm-slot { padding:6px 0; border-bottom:1px solid rgba(201,168,76,0.06); }
.pm-slot.me { border-left:2px solid var(--gold); padding-left:6px; }
.pm-slot.disconnected { opacity:0.4; }
.pm-hp-bar { height:4px; background:rgba(255,255,255,0.08); border-radius:2px; margin-top:3px; }
.pm-hp-fill { height:100%; border-radius:2px; transition:width 0.4s; }
.mp-chat { display:flex; flex-direction:column; height:140px; }
.chat-msg { font-size:0.72rem; padding:2px 0; color:var(--text-secondary); border-bottom:1px solid rgba(255,255,255,0.03); }
.chat-from { color:var(--gold); font-family:'Cinzel',serif; font-size:0.65rem; }
#mp-chat-log { flex:1; overflow-y:auto; padding:4px 0; }
.mp-chat-row { display:flex; gap:4px; margin-top:6px; }
#mp-chat-input { flex:1; background:rgba(10,5,2,0.9); border:1px solid rgba(201,168,76,0.2);
  color:var(--text-primary); font-family:'Crimson Text',serif; font-size:0.8rem; padding:4px 8px; }
.mp-send-btn { background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.3);
  color:var(--gold); font-family:'Cinzel',serif; font-size:0.65rem; padding:4px 10px; cursor:pointer; }
`;
const mpStyle = document.createElement('style');
mpStyle.textContent = mpCSS;
document.head.appendChild(mpStyle);

console.log('🔗 Multiplayer engine loaded.');
