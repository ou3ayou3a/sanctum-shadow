// ============================================
//   SANCTUM & SHADOW — MULTIPLAYER CLIENT v2
//   Fixed: session not found, event timing,
//   story sync, story broadcast
// ============================================

// Guard against double-loading
if (window._mpLoaded) { console.warn('multiplayer.js already loaded, skipping'); }
else {
window._mpLoaded = true;

window.mp = {
  socket: null,
  connected: false,
  sessionCode: null,
  playerId: null,
  isHost: false,
  session: null,
  combatState: null,
  _receiving: false,
};

// ─── LOAD SOCKET.IO THEN INIT ─────────────────
(function loadSocketIO() {
  if (window.io) { initMultiplayer(); return; }

  // Try local first (served by socket.io server)
  const s = document.createElement('script');
  s.src = '/socket.io/socket.io.js';
  s.onload = () => { console.log('✅ Socket.io loaded locally'); initMultiplayer(); };
  s.onerror = () => {
    console.warn('⚠ Local socket.io failed, trying CDN...');
    // Fallback to CDN
    const cdn = document.createElement('script');
    cdn.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
    cdn.onload = () => { console.log('✅ Socket.io loaded from CDN'); initMultiplayer(); };
    cdn.onerror = () => {
      console.error('❌ Socket.io completely unavailable');
      // Show visible error in UI
      const el = document.getElementById('mp-status');
      if (el) el.innerHTML = '❌ Multiplayer unavailable';
    };
    document.head.appendChild(cdn);
  };
  document.head.appendChild(s);
})();

// ─── INIT ─────────────────────────────────────
function initMultiplayer() {
  if (!window.io) return;

  const socket = window.io({ reconnection: true, reconnectionDelay: 1000 });
  window.mp.socket = socket;

  // ── Core connection ──
  socket.on('connect', () => {
    window.mp.connected = true;
    window.mp.playerId = socket.id;
    console.log('🔗 MP connected:', socket.id);
    const el = document.getElementById('mp-status');
    if (el) el.innerHTML = '🟢 Server connected — ready to play';
    if (el) el.style.color = '#4a9a6a';
    // Rejoin if we had a session
    if (window.mp.sessionCode && window.mp._playerName) {
      socket.emit('rejoin_session', {
        code: window.mp.sessionCode,
        playerName: window.mp._playerName,
        character: gameState.character || null,
      });
    }
  });

  socket.on('disconnect', () => {
    window.mp.connected = false;
    console.warn('MP disconnected');
    const el = document.getElementById('mp-status');
    if (el) { el.innerHTML = '🔴 Disconnected — reconnecting...'; el.style.color = '#c0392b'; }
  });

  // ── Session created (host) ──
  socket.on('session_created', ({ code, playerId }) => {
    window.mp.sessionCode = code;
    window.mp.playerId = playerId;
    window.mp.isHost = true;
    gameState.sessionCode = code;
    gameState.isHost = true;
    // Update any visible code displays
    document.querySelectorAll('.session-code-display').forEach(el => el.textContent = code);
    const big = document.getElementById('session-code-big');
    if (big) big.textContent = code;
    const nameEl = document.getElementById('wait-session-name');
    if (nameEl) nameEl.textContent = 'Session active — share this code!';
    toast('Session created: ' + code, 'holy');
  });

  // ── Session joined (joiner) ──
  socket.on('session_joined', ({ code, playerId, session }) => {
    window.mp.sessionCode = code;
    window.mp.playerId = playerId;
    window.mp.isHost = false;
    window.mp.session = session;
    gameState.sessionCode = code;
    gameState.isHost = false;
    document.querySelectorAll('.session-code-display').forEach(el => el.textContent = code);
    const big = document.getElementById('session-code-big');
    if (big) big.textContent = code;
    const nameEl = document.getElementById('wait-session-name');
    if (nameEl) nameEl.textContent = 'Joined session ' + code;
    toast('Joined session ' + code, 'holy');
  });

  // ── Error ──
  socket.on('join_error', ({ msg }) => {
    toast(msg, 'error');
    showScreen('join-session');
  });

  // ── Session state updates ──
  socket.on('session_update', (session) => {
    window.mp.session = session;
    updateSessionUI();
    updatePartyPanel();
    const chatSection = document.getElementById('mp-chat-section');
    if (chatSection) chatSection.style.display = 'block';
  });

  // ── Chat ──
  socket.on('chat_message', renderChatMessage);

  // ── Game log from other players ──
  socket.on('game_log', (entry) => {
    if (window.mp._receiving) return;
    window.mp._receiving = true;
    const orig = window.addLog._orig || window.addLog;
    orig(entry.text, entry.type, entry.playerName);
    window.mp._receiving = false;
  });

  // ── Story event from other players ──
  socket.on('story_event', ({ eventType, payload }) => {
    if (eventType === 'player_vote') {
      if (window.receiveVote) {
        window.receiveVote(payload.playerId, payload.playerName, payload.index, payload.roll);
      }
    }
    if (eventType === 'show_scene') {
      // Another player triggered a scene — show it on our screen too
      if (window.showScene && payload.sceneData && !document.getElementById('scene-panel')) {
        setTimeout(() => window.showScene(payload.sceneData), 200);
      }
    }
    if (eventType === 'scene_resolved') {
      // Vote resolved on another client — execute winning option here too
      if (window.executeSceneOption) {
        addLog(`🗳 The party chose: "${payload.label}"`, 'system');
        setTimeout(() => window.executeSceneOption(payload.index), 600);
      }
    }
    if (eventType === 'scene_choice') {
      // Legacy single-player choice broadcast
      const option = window.sceneState?._currentOptions?.[payload.index];
      if (option) {
        setTimeout(() => {
          if (option.action) option.action();
          else if (option.next && window.runScene) window.runScene(option.next);
        }, 400);
        setTimeout(() => {
          const panel = document.getElementById('scene-panel');
          if (panel) { panel.style.opacity = '0'; setTimeout(() => panel?.remove(), 400); }
        }, 300);
      }
    }
    if (eventType === 'location_change') {
      if (window.mp._receiving) return;
      window.mp._receiving = true;
      if (window.travelToLocation && WORLD_LOCATIONS?.[payload.locId]) {
        window.travelToLocation(WORLD_LOCATIONS[payload.locId]);
      }
      window.mp._receiving = false;
    }
  });

  // ── Combat ──
  socket.on('combat_started', (cs) => {
    window.mp.combatState = cs;
    addLog('⚔ COMBAT BEGINS!', 'combat');
    startCombatFromServer(cs);
  });

  socket.on('combat_update', ({ combatState, log }) => {
    window.mp.combatState = combatState;
    if (log) { const o = window.addLog._orig || window.addLog; o(log.text, log.type); }
    updateCombatFromServer(combatState);
    syncMyHP(combatState);
  });

  socket.on('combat_ended', ({ victory, xp, combatState }) => {
    window.mp.combatState = null;
    if (victory) {
      addLog(`⚔ VICTORY! +${xp} XP`, 'holy');
      if (xp && window.grantXP) grantXP(Math.floor(xp / Math.max(1, Object.keys(window.mp.session?.players || {}).length)));
    } else {
      addLog('💀 The party falls...', 'combat');
    }
    setTimeout(() => document.getElementById('combat-panel')?.remove(), 2000);
  });

  socket.on('player_turn_start', ({ playerId, playerName }) => {
    const mine = playerId === window.mp.playerId;
    addLog(mine ? '⚔ YOUR TURN' : `⏳ ${playerName}'s turn`, 'system');
    if (window.mp.combatState) {
      window.mp.combatState.currentTurnIndex = window.mp.combatState.turnOrder.indexOf(playerId);
      updateCombatFromServer(window.mp.combatState);
    }
  });

  socket.on('enemy_turn_start', ({ enemy }) => {
    addLog(`${enemy.icon} ${enemy.name} acts...`, 'system');
    setTimeout(() => socket.emit('enemy_turn', { code: window.mp.sessionCode }), 800 + Math.random() * 400);
  });
}

// ─── SESSION ACTIONS ──────────────────────────
function mpCreateSession(sessionName, playerName, maxPlayers) {
  if (!window.mp.socket?.connected) { toast('Not connected to server', 'error'); return; }
  window.mp._playerName = playerName;
  window.mp.socket.emit('create_session', { sessionName, playerName, maxPlayers });
}

function mpJoinSession(code, playerName) {
  if (!window.mp.socket?.connected) { toast('Not connected to server', 'error'); return; }
  window.mp._playerName = playerName;
  window.mp.socket.emit('join_session', { code: code.toUpperCase().trim(), playerName });
}

function mpStartCombat(enemies) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  const initiatorName = gameState.character?.name || 'Unknown';
  addLog(`⚔ ${initiatorName} initiates combat!`, 'combat');
  window.mp.socket.emit('start_combat', { code: window.mp.sessionCode, enemies, initiatorId: window.mp.playerId });
}

function mpCombatAction(action, targetId, spellId) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('combat_action', { code: window.mp.sessionCode, action, targetId, spellId });
}

function mpChat(text) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('chat', { code: window.mp.sessionCode, text });
}

function mpBroadcastStoryEvent(eventType, payload) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('story_event', { code: window.mp.sessionCode, eventType, payload });
}

// ─── PATCH addLog ─────────────────────────────
const _mpOrigAddLog = window.addLog;
window.addLog = function(text, type = 'system', playerName = null) {
  if (_mpOrigAddLog) _mpOrigAddLog(text, type, playerName);
  if (window.mp.sessionCode && window.mp.socket && !window.mp._receiving) {
    window.mp.socket.emit('game_log', {
      code: window.mp.sessionCode,
      entry: { text, type, playerName }
    });
  }
};
window.addLog._orig = _mpOrigAddLog;

// ─── PATCH chooseSceneOption ──────────────────
const _origChooseScene = window.chooseSceneOption;
window.chooseSceneOption = function(index) {
  if (_origChooseScene) _origChooseScene(index);
  if (window.mp.sessionCode && window.mp.socket && !window.mp._receiving) {
    const option = window.sceneState?._currentOptions?.[index];
    mpBroadcastStoryEvent('scene_choice', {
      index,
      label: option?.label || '',
      playerName: gameState.character?.name || 'Unknown',
    });
  }
};

// ─── PATCH travelToLocation ───────────────────
const _origTravel_mp = window.travelToLocation;
window.travelToLocation = function(loc) {
  if (_origTravel_mp) _origTravel_mp(loc);
  if (window.mp.sessionCode && window.mp.socket && !window.mp._receiving) {
    mpBroadcastStoryEvent('location_change', { locId: loc.id });
  }
};

// ─── PATCH startCombat ────────────────────────
const _origStartCombat = window.startCombat;
window.startCombat = function(enemies) {
  if (window.mp.sessionCode) {
    if (window.mp.combatState?.active) { addLog('⚔ Combat already in progress!', 'system'); return; }
    mpStartCombat(enemies);
  } else {
    if (_origStartCombat) _origStartCombat(enemies);
  }
};

// ─── PATCH combatAttack ───────────────────────
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

// ─── PATCH endPlayerTurn ─────────────────────
const _origEndTurn = window.endPlayerTurn;
window.endPlayerTurn = function() {
  if (window.mp.sessionCode && window.mp.combatState) {
    if (!isMyTurnMP()) return;
    mpCombatAction('end_turn', null, null);
  } else {
    if (_origEndTurn) _origEndTurn();
  }
};

// ─── PATCH castSelectedSpell ─────────────────
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

// ─── PATCH finalizeCharacter ─────────────────
const _origFinalizeChar = window.finalizeCharacter;
window.finalizeCharacter = function() {
  if (_origFinalizeChar) _origFinalizeChar();
  setTimeout(() => {
    if (gameState.character && window.mp.sessionCode) {
      window.mp.socket?.emit('character_ready', {
        code: window.mp.sessionCode,
        character: gameState.character
      });
    }
  }, 500);
};

// ─── COMBAT HELPERS ───────────────────────────
function isMyTurnMP() {
  if (!window.mp.combatState) return false;
  return window.mp.combatState.turnOrder[window.mp.combatState.currentTurnIndex] === window.mp.playerId;
}

function getTarget() {
  if (!combatState?.combatants) return null;
  return Object.values(combatState.combatants).find(c => c.isSelected);
}

function syncMyHP(cs) {
  const me = cs.combatants?.[window.mp.playerId];
  if (!me || !gameState.character) return;
  gameState.character.hp = Math.max(0, me.hp);
  gameState.character.mp = Math.max(0, me.mp);
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
}

function startCombatFromServer(cs) {
  Object.assign(combatState, cs);
  combatState.active = true;
  if (typeof renderCombatUI === 'function') renderCombatUI();
}

function updateCombatFromServer(cs) {
  Object.assign(combatState, cs);
  if (typeof updateCombatUI === 'function') updateCombatUI();
}

// ─── SESSION UI ───────────────────────────────
window.createSession = function() {
  const sessionName = document.getElementById('session-name')?.value.trim() || 'The Chronicle';
  const hostName = document.getElementById('host-name')?.value.trim();
  const maxPlayers = parseInt(document.getElementById('max-players')?.value || 4);
  if (!hostName) { toast('Enter your name!', 'error'); return; }
  mpCreateSession(sessionName, hostName, maxPlayers);
  showMPWaitingScreen(hostName);
};

window.joinSession = function() {
  const code = document.getElementById('join-code')?.value.trim().toUpperCase();
  const playerName = document.getElementById('join-name')?.value.trim();
  if (!code) { toast('Enter a session code!', 'error'); return; }
  if (!playerName) { toast('Enter your name!', 'error'); return; }
  mpJoinSession(code, playerName);
  showMPWaitingScreen(playerName);
};

function showMPWaitingScreen(playerName) {
  document.getElementById('wait-screen')?.remove();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const ws = document.createElement('div');
  ws.id = 'wait-screen';
  ws.className = 'screen active';
  ws.innerHTML = `
    <div class="screen-inner scroll-content">
      <h2 class="screen-title">⚔ The War Council Gathers</h2>
      <div class="session-banner">
        <span class="session-code-label">SESSION CODE — SHARE WITH YOUR COMPANIONS</span>
        <div class="session-code session-code-display" id="session-code-big"
          style="font-size:2.2rem;letter-spacing:0.2em;color:var(--gold);margin:10px 0;min-height:2.5rem">
          ${window.mp.sessionCode || '...'}
        </div>
        <div id="wait-session-name" style="font-family:'Crimson Text',serif;color:var(--text-dim);font-size:0.85rem">
          ${window.mp.sessionCode ? 'Session active' : 'Creating session...'}
        </div>
      </div>
      <div id="waiting-players" class="player-slots" style="margin:16px 0">
        <div class="player-slot filled">
          <span class="ps-icon">👤</span>
          <span class="ps-name">${playerName}</span>
          <span class="ps-status">Waiting...</span>
        </div>
      </div>
      <p class="step-hint" style="text-align:center">
        Share the session code with your companions. Once everyone joins, create your characters!
      </p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
        <button class="btn-primary" onclick="copySessionCode()">📋 Copy Code</button>
        <button class="btn-primary" onclick="proceedToCharCreation()">⚔ Create My Character</button>
        <button class="btn-ghost" onclick="showScreen('lobby')">↩ Cancel</button>
      </div>
    </div>`;
  document.getElementById('app').appendChild(ws);
}

function copySessionCode() {
  const code = window.mp.sessionCode;
  if (!code) { toast('No session code yet — wait a moment', 'error'); return; }
  navigator.clipboard.writeText(code).then(() => toast('Copied: ' + code, 'holy'));
}

function updateSessionUI() {
  const s = window.mp.session;
  if (!s) return;
  document.querySelectorAll('.session-code-display, #session-code-big').forEach(el => el.textContent = window.mp.sessionCode || '');
  const waitEl = document.getElementById('waiting-players');
  if (waitEl && s.players) {
    waitEl.innerHTML = Object.values(s.players).map(p => `
      <div class="player-slot filled ${!p.connected ? 'dim' : ''}">
        <span class="ps-icon">${p.ready ? '✓' : '👤'}</span>
        <span class="ps-name">${p.name}</span>
        <span class="ps-status" style="color:${p.ready ? '#4a9a6a' : 'var(--text-dim)'}">
          ${p.ready ? 'Ready' : 'Waiting...'}
        </span>
      </div>`).join('');
  }
}

function updatePartyPanel() {
  const panel = document.getElementById('party-members');
  if (!panel || !window.mp.session) return;
  panel.innerHTML = Object.values(window.mp.session.players).map(p => {
    const pct = p.maxHp ? Math.max(0, Math.floor(p.hp / p.maxHp * 100)) : 100;
    const col = pct > 60 ? '#4a9a6a' : pct > 30 ? '#c9a84c' : '#c0392b';
    const cls = p.character ? CLASSES?.find(c => c.id === p.character.class) : null;
    const isMe = p.id === window.mp.playerId;
    return `<div class="pm-slot ${isMe ? 'me' : ''} ${!p.connected ? 'disconnected' : ''}">
      <div class="pm-name">
        <span>${cls?.icon || '👤'} ${p.name}${isMe ? ' (You)' : ''}</span>
        <span style="color:var(--text-dim);font-size:0.7rem">${p.hp ?? '?'}/${p.maxHp ?? '?'}</span>
      </div>
      ${p.maxHp ? `<div class="pm-hp-bar"><div class="pm-hp-fill" style="width:${pct}%;background:${col}"></div></div>` : ''}
    </div>`;
  }).join('');
}

function renderChatMessage(msg) {
  const log = document.getElementById('mp-chat-log');
  if (!log) return;
  const d = document.createElement('div');
  d.className = 'chat-msg' + (msg.system ? ' system' : '');
  d.innerHTML = msg.system
    ? `<span style="color:var(--text-dim);font-style:italic">${msg.text}</span>`
    : `<span class="chat-from">${msg.from}:</span> <span class="chat-text">${msg.text}</span>`;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

function submitChat() {
  const input = document.getElementById('mp-chat-input');
  const text = input?.value.trim();
  if (!text) return;
  mpChat(text);
  input.value = '';
}

// ─── CSS ──────────────────────────────────────
const mpCSS = `
.pm-slot{padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.06)}
.pm-slot.me{border-left:2px solid var(--gold);padding-left:6px}
.pm-slot.disconnected{opacity:0.4}
.pm-hp-bar{height:4px;background:rgba(255,255,255,0.08);border-radius:2px;margin-top:3px}
.pm-hp-fill{height:100%;border-radius:2px;transition:width 0.4s}
.mp-chat{display:flex;flex-direction:column;height:140px}
.chat-msg{font-size:0.72rem;padding:2px 0;color:var(--text-secondary);border-bottom:1px solid rgba(255,255,255,0.03)}
.chat-from{color:var(--gold);font-family:'Cinzel',serif;font-size:0.65rem}
#mp-chat-log{flex:1;overflow-y:auto;padding:4px 0}
.mp-chat-row{display:flex;gap:4px;margin-top:6px}
#mp-chat-input{flex:1;background:rgba(10,5,2,0.9);border:1px solid rgba(201,168,76,0.2);
  color:var(--text-primary);font-family:'Crimson Text',serif;font-size:0.8rem;padding:4px 8px}
.mp-send-btn{background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);
  color:var(--gold);font-family:'Cinzel',serif;font-size:0.65rem;padding:4px 10px;cursor:pointer}
`;
const mpStyle = document.createElement('style');
mpStyle.textContent = mpCSS;
document.head.appendChild(mpStyle);

console.log('🔗 Multiplayer v2 loaded.');

} // end double-load guard
