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

// #60: escape ALL peer-supplied text rendered via innerHTML. Uses the shared
// escapeHtml from data.js; falls back to a minimal inline escaper if unavailable.
function esc(str) {
  if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
    if (el) { el.innerHTML = '🟢 Server connected — ready to play'; el.style.color = '#4a9a6a'; }

    // If we previously lost the connection in-session, log the recovery (#67).
    if (window.mp._connLostShown) {
      window.mp._connLostShown = false;
      if (window.mp.sessionCode) {
        window.mp._receiving = true;
        window.addLog?.('✅ Reconnected to the server.', 'system');
        window.mp._receiving = false;
      }
    }

    // #68: flush events queued before the socket connected.
    if (typeof flushQueuedStoryEvents === 'function') flushQueuedStoryEvents();

    // Rejoin if we had a session — retry with backoff in case server just restarted from disk
    const code = window.mp.sessionCode || gameState?.sessionCode;
    const char = gameState?.character;
    const name = window.mp._playerName || char?.name;
    if (code && name) {
      let attempt = 0;
      window.mp._rejoinAcked = false; // reset for this reconnect cycle (#62)
      const tryRejoin = () => {
        // Stop once a successful rejoin ack/session_joined arrived (#62).
        if (window.mp._rejoinAcked) return;
        attempt++;
        console.log(`Rejoin attempt ${attempt} for session ${code}`);
        socket.emit('rejoin_session', { code, playerName: name, character: char || null });
        if (attempt < 3) {
          setTimeout(() => {
            if (window.mp._rejoinAcked) return; // succeeded — stop retrying
            if (!window.mp.sessionCode) return; // gave up (join_error cleared it)
            tryRejoin();
          }, 2000 * attempt);
        }
      };
      setTimeout(tryRejoin, 400);
    }
  });

  socket.on('disconnect', () => {
    window.mp.connected = false;
    console.warn('MP disconnected');
    const el = document.getElementById('mp-status');
    if (el) { el.innerHTML = '🔴 Disconnected — reconnecting...'; el.style.color = '#c0392b'; }
    // Surface the disconnect in-game (#67). Guard so it doesn't broadcast.
    if (window.mp.sessionCode && !window.mp._connLostShown) {
      window.mp._connLostShown = true;
      window.mp._receiving = true;
      window.addLog?.('⚠ Connection lost — attempting to reconnect...', 'system');
      window.mp._receiving = false;
    }
    // Never boot to lobby on disconnect — socket.io will auto-reconnect
  });

  socket.on('connect_error', (err) => {
    console.warn('MP connect error:', err.message);
    const el = document.getElementById('mp-status');
    if (el) { el.innerHTML = '🟡 Reconnecting...'; el.style.color = '#f39c12'; }
    // Surface the connection trouble in-game once (#67), guarded from broadcast.
    if (window.mp.sessionCode && !window.mp._connLostShown) {
      window.mp._connLostShown = true;
      window.mp._receiving = true;
      window.addLog?.('⚠ Connection lost — attempting to reconnect...', 'system');
      window.mp._receiving = false;
    }
    // Don't kick to lobby — just wait for reconnect
  });

  socket.on('server_shutdown', ({ message } = {}) => {
    const text = message || 'Server is restarting. Your campaign has been saved.';
    toast(`⚠ ${text}`, 'info');
    const originalLog = window.addLog?._orig || window.addLog;
    originalLog?.(`⚠ ${text}`, 'system');
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

  // ── Session joined (joiner or rejoin) ──
  socket.on('session_joined', ({ code, playerId, session, isHost }) => {
    // Stop the rejoin retry loop — a successful ack arrived (#62).
    window.mp._rejoinAcked = true;
    window.mp.sessionCode = code;
    window.mp.playerId = playerId;
    // Trust the server's host answer (#58) instead of forcing false — a
    // rejoining host is migrated server-side and told it's host here.
    window.mp.isHost = !!isHost;
    window.mp.session = session;
    gameState.sessionCode = code;
    gameState.isHost = !!isHost;
    window.dispatchEvent(new CustomEvent('multiplayer:session-update', { detail:session }));
    if (session?.campaignState) applyCampaignState(session.campaignState);
    document.querySelectorAll('.session-code-display').forEach(el => el.textContent = code);
    const big = document.getElementById('session-code-big');
    if (big) big.textContent = code;
    const nameEl = document.getElementById('wait-session-name');
    if (nameEl) nameEl.textContent = 'Joined session ' + code;

    // If already in the game screen (reconnecting after refresh), stay there
    if (gameState.activeScreen === 'game' && gameState.character) {
      toast(`🔄 Reconnected to session ${code}`, 'holy');
      // Guard so the reconnect line isn't re-broadcast to the party (#67).
      window.mp._receiving = true;
      addLog(`🔗 Reconnected to multiplayer session ${code}. Your party is here.`, 'system');
      window.mp._receiving = false;
      // Re-send our character state to the server so party panel updates
      setTimeout(() => {
        if (gameState.character) {
          socket.emit('character_ready', {
            code,
            character: gameState.character
          });
        }
        updatePartyPanel();
      }, 300);
    } else {
      toast('Joined session ' + code, 'holy');
    }
  });

  // ── Host migrated to us (previous host dropped) ──
  socket.on('host_migrated', ({ isHost }) => {
    if (isHost) {
      window.mp.isHost = true;
      gameState.isHost = true;
      window.mp._receiving = true;
      addLog('👑 You are now the host of this session.', 'system');
      window.mp._receiving = false;
      toast('👑 You are now the host', 'holy');
      setTimeout(() => mpBroadcastCampaignState('host_migrated'), 100);
    }
  });

  // ── Authoritative player-state sync (inventory/gold after item use, #63) ──
  socket.on('player_state', ({ playerId, inventory, gold, hp }) => {
    if (playerId !== window.mp.playerId || !gameState.character) return;
    if (Array.isArray(inventory)) gameState.character.inventory = inventory;
    if (typeof gold === 'number') gameState.character.gold = gold;
    if (typeof hp === 'number') gameState.character.hp = Math.max(0, hp);
    if (typeof renderPlayerCard === 'function') renderPlayerCard();
    if (typeof updateCombatUI === 'function') updateCombatUI();
  });

  socket.on('campaign_state', (state) => {
    applyCampaignState(state);
    if (window.mp.session) window.mp.session.campaignState = state;
  });

  function deliverConversationState(state) {
    window.mp._conversationState = state || null;
    if (gameState?.activeScreen === 'game' && typeof window.applyRemoteConversationState === 'function') {
      window.applyRemoteConversationState(state);
    }
  }

  socket.on('conversation_state', deliverConversationState);
  socket.on('conversation_update', (event = {}) => {
    const {type,payload = {},conversation = null} = event;
    if (typeof type !== 'string') return;
    window.mp._conversationState = conversation;

    // Only the host may commit shared state or another player's character effects.
    if (window.mp.isHost && type === 'effects' && payload.effects) {
      const actorRecord=window.mp.session?.players?.[payload.actorId];
      const character=payload.actorId===window.mp.playerId ? gameState.character : actorRecord?.character;
      if (character) {
        window.applyClaudeEffects?.(payload.effects,{character,reason:payload.reason||'Multiplayer dialogue'});
        window.mpSyncHostCharacter?.(character,payload.actorId);
        mpBroadcastStoryEvent('action_state',{actorId:payload.actorId,character:{hp:character.hp,mp:character.mp,holyPoints:character.holyPoints,hellPoints:character.hellPoints,conditions:character.conditions||[],gold:character.gold||0,inventory:character.inventory||[]}});
        window.mpBroadcastCampaignState?.(`dialogue_effects:${payload.npcId||'npc'}`);
      }
      return;
    }
    if (window.mp.isHost && type === 'outcome') {
      if(!window.applyRemoteNPCOutcome?.(payload)){
        window.sceneState=window.sceneState||{flags:{},knownFacts:{}};window.sceneState.flags=window.sceneState.flags||{};window.sceneState.knownFacts=window.sceneState.knownFacts||{};
        window.sceneState.flags[`talked_to_${payload.npcId}`]=true;window.sceneState.knownFacts[`npc_${payload.npcId}`]=String(payload.fact||'').slice(0,1200);
      }
      if(['captain_rhael','trembling_scribe'].includes(payload.npcId))window.advanceQuest?.('c1q1',`Questioned ${payload.npcName||'a witness'} about the broken Covenant.`);
      window.mpBroadcastCampaignState?.(`npc:${payload.npcId}`);
      return;
    }
    if(window.mp.isHost&&type==='scene_break'){
      window._mpPendingConversationScene=String(payload.sceneName||'').slice(0,80);
      return;
    }
    if (window.mp.isHost && type === 'check') {
      window.sceneState=window.sceneState||{flags:{},knownFacts:{}};window.sceneState.flags=window.sceneState.flags||{};
      const key=`dialogue_${payload.skill||payload.ability||'check'}_${payload.npcId||'npc'}_${payload.success?'success':'failure'}`;
      window.sceneState.flags[key]=true;
      const actorRecord=window.mp.session?.players?.[payload.actorId];
      const character=payload.actorId===window.mp.playerId?gameState.character:actorRecord?.character;
      if(payload.crit&&character)character.conditions=Array.from(new Set([...(character.conditions||[]),'inspired']));
      if(character)window.mpSyncHostCharacter?.(character,payload.actorId);
      window.mpBroadcastCampaignState?.(`dialogue_check:${payload.npcId||'npc'}`);
    }

    if (typeof window.applyRemoteConversationUpdate === 'function') window.applyRemoteConversationUpdate(event);
  });

  // ── Error ──
  socket.on('join_error', ({ msg }) => {
    // If already in-game, don't boot to lobby — just show a warning toast
    if (gameState.activeScreen === 'game' && gameState.character) {
      toast('⚠ ' + msg + ' — continuing solo.', 'error');
      addLog(`⚠ Session error: ${msg} — playing solo.`, 'system');
      // Clear session code so further actions work solo
      window.mp.sessionCode = null;
      gameState.sessionCode = null;
      localStorage.removeItem('ss_mp_session'); // session is gone — don't retry
    } else {
      toast(msg, 'error');
      localStorage.removeItem('ss_mp_session');
      showScreen('join-session');
    }
  });

  socket.on('session_error', ({ msg } = {}) => {
    toast(msg || 'The session could not complete that request.', 'error');
    const previousReceiving = window.mp._receiving;
    window.mp._receiving = true;
    addLog(`⚠ ${msg || 'Session request rejected.'}`, 'system');
    window.mp._receiving = previousReceiving;
  });

  // ── Session state updates ──
  socket.on('session_update', (session) => {
    window.mp.session = session;
    window.dispatchEvent(new CustomEvent('multiplayer:session-update', { detail:session }));
    const nowHost = session?.host === window.mp.playerId;
    if (window.mp.isHost !== nowHost) {
      window.mp.isHost = nowHost;
      gameState.isHost = nowHost;
    }
    if (session?.campaignState) applyCampaignState(session.campaignState);
    if (document.getElementById('scene-panel') && window.sceneState?._votes) {
      const connectedIds = new Set(Object.values(session.players || {}).filter(p => p?.connected !== false).map(p => p.id));
      Object.keys(window.sceneState._votes).forEach(id => { if (!connectedIds.has(id)) delete window.sceneState._votes[id]; });
      window.sceneState._playerCount = Math.max(1, connectedIds.size);
      window.updateVoteDisplay?.();
      if (window.mp.isHost) window.checkVoteResolution?.();
    }
    updateSessionUI();
    updatePartyPanel();
    // If ready room is showing, update it
    if (document.getElementById('ready-room') && window.updateReadyRoom) {
      window.updateReadyRoom();
    }
    const chatSection = document.getElementById('mp-chat-section');
    if (chatSection) chatSection.style.display = 'block';
  });

  socket.on('world_position', (presence) => {
    if (!presence || presence.playerId === window.mp.playerId) return;
    window.dispatchEvent(new CustomEvent('multiplayer:world-position', { detail:presence }));
  });

  // ── Game started — everyone launches ──
  socket.on('game_started', ({ lateJoin = false } = {}) => {
    if (window.launchGame) {
      window.launchGame();
      // Exactly one story engine: the host. Other clients receive show_scene and
      // campaign_state. Late joiners only hydrate the stored campaign snapshot.
      if (window.mp.isHost && !lateJoin) {
        setTimeout(() => {
          if (window.startStoryEngine) window.startStoryEngine();
        }, 1500);
      }
      setTimeout(()=>{
        if(window.mp._conversationState&&typeof window.applyRemoteConversationState==='function')window.applyRemoteConversationState(window.mp._conversationState);
      },500);
    }
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
  // #61: the WHOLE handler runs under the _receiving guard so anything it logs
  // (addLog, showScene, etc.) is NOT re-broadcast back to the party.
  socket.on('story_event', (msg = {}) => {
    const { eventType, payload = {}, fromPlayer } = msg;
    if (typeof eventType !== 'string') return;
    const _prevReceiving = window.mp._receiving;
    window.mp._receiving = true;
    try {
    if (eventType === 'origin_quest_request' && window.mp.isHost) {
      window.PartyOriginQuests?.beginNpcQuest?.(String(payload.npcId || '').toLowerCase(), { remote:true });
      return;
    }
    if (eventType === 'npc_fate_request' && window.mp.isHost) {
      const allowed = new Set(['sister_mourne', 'captain_rhael', 'sir_harren']);
      const npcId = String(payload.npcId || '').toLowerCase();
      if (payload.reason === 'prayer_resurrection' && allowed.has(npcId)
          && window.getNPCFate?.(npcId) === 'dead') {
        window.setNPCFate?.(npcId, 'spared');
        const name = npcId.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
        addLog(`☙ ${name} draws breath again. ${fromPlayer || 'A companion'}'s prayer has changed the Chronicle.`, 'holy');
        window.mpBroadcastCampaignState?.(`prayer_resurrection:${npcId}`);
      }
      return;
    }
    if (eventType === 'player_vote') {
      if (window.receiveVote) {
        window.receiveVote(payload.playerId, payload.playerName, payload.index, payload.roll);
      }
    }
    if (eventType === 'show_scene') {
      if (window.showScene && payload.sceneData && !document.getElementById('scene-panel')) {
        // Calculate chars already typed based on elapsed time (14ms per char)
        const elapsed = payload.startedAt ? (Date.now() - payload.startedAt) : 0;
        const startAt = Math.min(Math.floor(elapsed / 14), (payload.sceneData.narration || '').length);
        // Temporarily override typewriteScene to start at the right position
        window._sceneStartAt = startAt;
        window.showScene(payload.sceneData);
        window._sceneStartAt = 0;
        if (payload.sceneData.id) window.recordQuestEvent?.(`scene:${payload.sceneData.id}`, { sceneId:payload.sceneData.id });
      }
    }
    if (eventType === 'scene_resolved') {
      // The host is the only client that executes the option and rolls its check.
      // Everyone else closes exactly their current panel and waits for the host's
      // show_scene/campaign_state broadcasts. This works identically for 2..N players.
      const resKey = payload.resolutionKey
        || payload.resKey
        || (payload.sceneId != null ? payload.sceneId + ':' + payload.index : null)
        || ((window.sceneState?._currentScene?.id || window.sceneState?.currentScene) + ':' + payload.index);
      if (window.mp.isHost) {
        window._lastResolvedKey = resKey;
      } else if (window._lastResolvedKey === resKey) {
        // Duplicate broadcast — ignore.
      } else {
        window._lastResolvedKey = resKey;
        addLog(`🗳 The party chose: "${payload.label}"`, 'system');
        const ownedPanel = document.getElementById('scene-panel');
        if (ownedPanel) ownedPanel.remove();
      }
    }
    if (eventType === 'scene_choice') {
      // Legacy notification only. Never execute it: scene_resolved is canonical.
    }
    if (eventType === 'action_request' && window.mp.isHost) {
      const actor = window.mp.session?.players?.[payload.actorId];
      if (actor?.character && typeof window.resolveActionRequest === 'function') {
        setTimeout(async () => {
          const safeOptions = payload.options && typeof payload.options === 'object' ? payload.options : {};
          await window.resolveActionRequest(String(payload.text || '').slice(0, 1000), {
            ...safeOptions, character:actor.character, actorId:payload.actorId, authoritative:true,
          });
          mpBroadcastStoryEvent('action_state', {
            actorId:payload.actorId,
            character:{
              hp:actor.character.hp, mp:actor.character.mp,
              holyPoints:actor.character.holyPoints, hellPoints:actor.character.hellPoints,
              conditions:actor.character.conditions || [], gold:actor.character.gold || 0,
              inventory:actor.character.inventory || [],
            },
          });
          mpBroadcastCampaignState('remote_action');
        }, 0);
      }
    }
    if (eventType === 'action_state') {
      const cached = window.mp.session?.players?.[payload.actorId]?.character;
      if (cached && payload.character) Object.assign(cached, payload.character);
      if (payload.actorId === window.mp.playerId && gameState.character && payload.character) {
        Object.assign(gameState.character, payload.character);
        window.renderPlayerCard?.();
        window.renderInventory?.();
      }
      updatePartyPanel();
    }
    if(eventType==='environment_action_request'&&window.mp.isHost){
      const actor=window.mp.session?.players?.[payload.actorId],action=window.getAuthoredEnvironmentAction?.(payload.zoneId,payload.targetId,payload.actionId);
      const allowed=!!action&&(!action.requiresFlag||!!window.sceneState?.flags?.[action.requiresFlag]);
      if(actor?.character&&action&&allowed&&typeof window.resolveEnvironmentalAction==='function')setTimeout(async()=>{
        const result=await window.resolveEnvironmentalAction({zoneId:payload.zoneId,targetId:payload.targetId,targetLabel:payload.targetLabel,action,character:actor.character,authoritative:true});
        action.onResolved?.(result,window.__world3d,window.__world3d?.zone?.interactables?.find(record=>record.id===payload.targetId));
        window.mpSyncHostCharacter?.(actor.character,payload.actorId);
        mpBroadcastStoryEvent('environment_action_result',{actorId:payload.actorId,targetId:payload.targetId,actionId:payload.actionId,success:result?.success!==false,message:String(result?.message||'').slice(0,600)});
        mpBroadcastStoryEvent('action_state',{actorId:payload.actorId,character:{hp:actor.character.hp,mp:actor.character.mp,holyPoints:actor.character.holyPoints,hellPoints:actor.character.hellPoints,conditions:actor.character.conditions||[],gold:actor.character.gold||0,inventory:actor.character.inventory||[]}});
        mpBroadcastCampaignState('environment_action');
      },0);
    }
    if(eventType==='environment_action_result'&&payload.actorId===window.mp.playerId){
      window.__world3d?.toast?.(payload.message||'The environment responds to the party.',4800);
    }
    if (eventType === 'quest_completed') {
      window.grantQuestReward?.(String(payload.questId || ''), Number(payload.xp) || 0);
      window.renderPlayerCard?.();
    }
    // ── Inter-party contested rolls ──
    if (eventType === 'contest_challenge') {
      // Someone is challenging ME to a contested roll
      if (payload.targetPlayerId === window.mp?.playerId) {
        addLog(`⚔ ${payload.challenger} challenges you to a contested roll: "${payload.actionText}"`, 'system');
        // Show contest overlay on target's screen — they roll Player 2
        document.getElementById('contest-title').textContent = '⚔ You\'ve Been Challenged!';
        document.getElementById('c1-name').textContent = payload.challenger;
        document.getElementById('c2-name').textContent = gameState.character?.name || 'You';
        document.getElementById('c1-die').textContent = '⏳';
        document.getElementById('c2-die').textContent = '?';
        document.getElementById('c1-die').classList.remove('rolled');
        document.getElementById('c2-die').classList.remove('rolled');
        document.getElementById('contest-result').classList.add('hidden');
        document.getElementById('c1-roll-btn').disabled = true;  // challenger rolls on their screen
        document.getElementById('c2-roll-btn').disabled = false; // we roll here
        // Wire c2-roll-btn to broadcast our roll
        document.getElementById('c2-roll-btn').onclick = () => rollContestTarget();
        if (typeof openOverlay === 'function') openOverlay('dice-overlay');
      }
    }

    if (eventType === 'contest_roll') {
      if (payload.isTargetReply) {
        // Target replied with their roll — only the CHALLENGER should receive this
        if (payload.fromPlayerId !== window.mp?.playerId && typeof receiveContestRoll === 'function') {
          // I am the challenger. Store the target's roll as p2Roll and animate die2.
          receiveContestRoll(payload.playerName, payload.roll);
        }
      } else {
        // Challenger sent their roll — only the TARGET should receive this
        if (payload.targetPlayerId === window.mp?.playerId && typeof receiveContestRoll === 'function') {
          // I am the target. Store challenger's roll as p1Roll (not p2Roll).
          pendingContestData = pendingContestData || {};
          pendingContestData.p1Roll = payload.roll;
          pendingContestData.p1Name = payload.playerName;
          // Animate die1 (challenger's die on target's screen)
          const die1 = document.getElementById('c1-die');
          if (die1) {
            let count = 0;
            const anim = setInterval(() => {
              die1.textContent = Math.floor(Math.random() * 20) + 1;
              if (++count >= 8) {
                clearInterval(anim);
                die1.textContent = payload.roll;
                die1.classList.add('rolled');
                addLog(`🎲 ${payload.playerName} rolls: [${payload.roll}]${payload.roll===20?' — CRITICAL!!':payload.roll===1?' — FUMBLE!':''}`, 'dice');
                // If I already rolled (p2Roll set), resolve now
                if (pendingContestData.p2Roll !== null) setTimeout(resolveContest, 600);
              }
            }, 60);
          }
        }
      }
    }

    if (eventType === 'location_change') {
      // Outer guard already has _receiving=true so travelToLocation won't re-broadcast.
      if (window.travelToLocation && WORLD_LOCATIONS?.[payload.locId]) {
        window.travelToLocation(WORLD_LOCATIONS[payload.locId]);
      }
    }
    } finally {
      window.mp._receiving = _prevReceiving;
    }
  });

  // ── Combat ──
  socket.on('combat_started', (cs) => {
    window.mp.combatState = cs;
    window.mp.combatSpectator = !cs?.combatants?.[window.mp.playerId];
    (window.addLog._orig || window.addLog)('⚔ COMBAT BEGINS!', 'combat');
    startCombatFromServer(cs);
  });

  socket.on('combat_update', ({ combatState, log, presentation }) => {
    const apply=()=>{
      window.mp.combatState = combatState;
      if (log) { const o = window.addLog._orig || window.addLog; o(log.text, log.type); }
      updateCombatFromServer(combatState);
      syncMyHP(combatState);
    };
    const controller=window.__world3d?.combatController;
    if(!controller?.presentAuthoritativeUpdate(combatState,presentation,apply))apply();
  });

  socket.on('combat_ended', ({ victory, xp, xpEach, combatState:endedCombatState, presentation, log }) => {
    const finish=()=>{
    window.mp.combatState = null;
    window.mp.combatSpectator = false;
    if (endedCombatState) Object.assign(window.combatState, endedCombatState);
    window.combatState.active = false;
    if(log){const o=window.addLog._orig||window.addLog;o(log.text,log.type);}
    if (victory) {
      // #16: the server computes the authoritative per-player share (xpEach) over
      // connected players who actually have a character. Use it directly so every
      // client awards the SAME amount. Only fall back to the local computation if
      // the server didn't send xpEach (older server / missing field).
      let award;
      if (xpEach !== undefined && xpEach !== null) {
        award = xpEach;
      } else {
        // #68: split XP only among connected players who actually have a character —
        // not lobby stragglers or disconnected players.
        const players = Object.values(window.mp.session?.players || {});
        const share = players.filter(p => p && p.connected && p.character).length || 1;
        award = Math.floor(xp / share);
      }
      (window.addLog._orig || window.addLog)(`⚔ VICTORY! +${award || 0} XP each (${xp || 0} party XP)`, 'holy');
      if (award && window.grantXP) grantXP(award);
      const questScene = window.sceneState?.currentScene || window.sceneState?._currentScene?.id || '';
      const enemies = Object.values(endedCombatState?.combatants || {}).filter(combatant => !combatant.isPlayer);
      if (window.mp.isHost && questScene) {
        window.recordAuthoredCombatVictory?.(questScene, enemies.map(enemy => enemy.id));
      }
      if (window.mp.isHost) {
        // Mirror single-player's persistent consequence writes. The host owns
        // campaign state; every client receives these fates in the next snapshot.
        window.sceneState = window.sceneState || { flags:{}, knownFacts:{} };
        window.sceneState.flags = window.sceneState.flags || {};
        for (const enemy of enemies) {
          const normId = window.normalizeNpcId?.(enemy.sourceId || enemy.id, enemy.name)
            || String(enemy.sourceId || enemy.id || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
          if (!normId) continue;
          window.sceneState.flags[`npc_dead_${normId}`] = true;
          window.sceneState.flags[`killed_${normId}`] = gameState.character?.name || 'party';
          window.sceneState.flags[`fought_${normId}`] = true;
          window.setNPCFate?.(normId, 'dead');
        }
        if (enemies.some(enemy => String(enemy.sourceId || enemy.id || '').startsWith('cupside_sergeant'))) {
          window.sceneState = window.sceneState || { flags:{}, knownFacts:{} };
          window.sceneState.flags = window.sceneState.flags || {};
          window.sceneState.flags.cupside_checkpoint_defeated = true;
          window.sceneState.flags.cupside_checkpoint_cleared = true;
          window.recordQuestEvent?.('combat:victory:cupside_checkpoint', { defeatedIds:enemies.map(enemy => enemy.id) });
          window.mpBroadcastCampaignState?.('cupside_checkpoint_victory');
        }
        if (enemies.some(enemy => /voice below/i.test(enemy.name || ''))) {
          setTimeout(() => window.runScene?.('monastery_dungeon_cleared'), 800);
        }
        window.mpBroadcastCampaignState?.('combat_npc_fates');
      }
    } else {
      (window.addLog._orig || window.addLog)('💀 The party falls...', 'combat');
    }
    setTimeout(() => document.getElementById('combat-panel')?.remove(), 2000);
    };
    const controller=window.__world3d?.combatController;
    if(!controller?.presentAuthoritativeUpdate(endedCombatState,presentation,finish))finish();
  });

  socket.on('player_turn_start', ({ playerId, playerName }) => {
    const mine = playerId === window.mp.playerId;
    (window.addLog._orig || window.addLog)(mine ? '⚔ YOUR TURN' : `⏳ ${playerName}'s turn`, 'system');
    if (window.mp.combatState) {
      window.mp.combatState.currentTurnIndex = window.mp.combatState.turnOrder.indexOf(playerId);
      updateCombatFromServer(window.mp.combatState);
    }
  });

  socket.on('enemy_turn_start', ({ enemy, seq }) => {
    // #35: log the enemy-turn narration via the non-broadcasting path. 'system' is a
    // MP_BROADCAST_TYPE, so a plain addLog here would make every client re-emit this
    // line as game_log → K× duplicates per enemy turn with K players. The server
    // already broadcasts enemy_turn_start to everyone, so each client just shows it
    // locally once.
    const _origLog = window.addLog._orig || window.addLog;
    _origLog(`${enemy.icon} ${enemy.name} acts...`, 'system');
    // #11: echo the seq back so the server resolves THIS enemy turn exactly once.
    // The host drives it; the server has its own timeout fallback if the host is gone.
    if (window.mp.isHost) {
      setTimeout(() => socket.emit('enemy_turn', { code: window.mp.sessionCode, seq }), 800 + Math.random() * 400);
    }
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

function mpStartCombat(enemies, encounter = {}) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  const initiatorName = gameState.character?.name || 'Unknown';
  addLog(`⚔ ${initiatorName} initiates combat!`, 'combat');
  window.mp.socket.emit('start_combat', { code: window.mp.sessionCode, enemies, encounter:{id:encounter?.id||'standard'}, initiatorId: window.mp.playerId });
}

function mpCombatAction(action, targetId, spellId, position) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('combat_action', { code: window.mp.sessionCode, action, targetId, spellId, position });
}

function mpChat(text) {
  if (!window.mp.socket || !window.mp.sessionCode) return;
  window.mp.socket.emit('chat', { code: window.mp.sessionCode, text });
}

function buildCampaignState(reason = 'sync') {
  const isSharedQuest = q => q && !String(q.id || '').startsWith('pq_');
  const sharedQuestProgress = Object.fromEntries(Object.entries(gameState.questProgress || {}).filter(([id]) => !id.startsWith('pq_')));
  const sharedFlags = Object.fromEntries(Object.entries(window.sceneState?.flags || {}).filter(([key]) => !key.startsWith('pq_')));
  const sharedFacts = Object.fromEntries(Object.entries(window.sceneState?.knownFacts || {}).filter(([key]) => !key.startsWith('pq_')));
  const discovered = window.WORLD_LOCATIONS
    ? Object.values(window.WORLD_LOCATIONS).filter(l => l?.discovered).map(l => l.id)
    : Object.keys(window.mapDiscovered || {}).filter(id => window.mapDiscovered[id]);
  const current = window.sceneState?._currentScene;
  const currentData = current && !current.personal ? {
    id:current.id, location:current.location, locationIcon:current.locationIcon,
    threat:current.threat, narration:current.narration, sub:current.sub,
    personal:!!current.personal,
    options:(current.options || []).map(o => ({
      label:o.label, icon:o.icon, type:o.type,
      roll:o.roll ? {stat:o.roll.stat,skill:o.roll.skill,dc:o.roll.dc,advantage:!!o.roll.advantage,disadvantage:!!o.roll.disadvantage} : null,
      cost:o.cost, next:o.next, nextFail:o.nextFail,
    })),
  } : null;
  return {
    schemaVersion: window.SanctumSchema?.CAMPAIGN_SCHEMA_VERSION || 1,
    version: Date.now(), reason,
    chapter: gameState.chapter || 1,
    partyOrigins: window.PartyOriginQuests?.serialize?.() || null,
    activeQuests: (gameState.activeQuests || []).filter(isSharedQuest),
    completedQuests: (gameState.completedQuests || []).filter(isSharedQuest),
    questProgress: sharedQuestProgress,
    scene: {
      currentScene: window.sceneState?.currentScene || 'arrival_vaelthar',
      flags: sharedFlags,
      knownFacts: sharedFacts,
      npcStates: window.sceneState?.npcStates || {},
      history: window.sceneState?.history || [],
      lastNarration: window.sceneState?._lastNarration || '',
      currentThreat: window.sceneState?.currentThreat || null,
      currentData,
    },
    reputation: window.reputation || {},
    worldClock: window.worldClock || { hour:8, day:1 },
    map: { currentLocation: window.mapState?.currentLocation || 'vaelthar_city', discovered },
  };
}

function applyCampaignState(state) {
  if (!state || typeof state !== 'object') return;
  state = window.SanctumSchema?.migrateCampaignState(state) || state;
  if (window.mp._campaignVersion && (state.version || 0) <= window.mp._campaignVersion) return;
  window.mp._campaignVersion = state.version || Date.now();
  gameState.chapter = state.chapter || 1;
  if (state.partyOrigins) window.PartyOriginQuests?.hydrate?.(state.partyOrigins);
  const localActive = (gameState.activeQuests || []).filter(q => String(q?.id || '').startsWith('pq_'));
  const localCompleted = (gameState.completedQuests || []).filter(q => String(q?.id || '').startsWith('pq_'));
  const localProgress = Object.fromEntries(Object.entries(gameState.questProgress || {}).filter(([id]) => id.startsWith('pq_')));
  gameState.activeQuests = [...(Array.isArray(state.activeQuests) ? state.activeQuests : []), ...localActive];
  gameState.completedQuests = [...(Array.isArray(state.completedQuests) ? state.completedQuests : []), ...localCompleted];
  gameState.questProgress = { ...(state.questProgress && typeof state.questProgress === 'object' ? state.questProgress : {}), ...localProgress };
  if (window.sceneState && state.scene) {
    const localFlags = Object.fromEntries(Object.entries(window.sceneState.flags || {}).filter(([key]) => key.startsWith('pq_')));
    const localFacts = Object.fromEntries(Object.entries(window.sceneState.knownFacts || {}).filter(([key]) => key.startsWith('pq_')));
    window.sceneState.currentScene = state.scene.currentScene || window.sceneState.currentScene;
    window.sceneState.flags = { ...(state.scene.flags || {}), ...localFlags };
    window.sceneState.knownFacts = { ...(state.scene.knownFacts || {}), ...localFacts };
    window.sceneState.npcStates = state.scene.npcStates || {};
    window.sceneState.history = state.scene.history || [];
    window.sceneState._lastNarration = state.scene.lastNarration || '';
    window.sceneState.currentThreat = state.scene.currentThreat || null;
    if (state.scene.currentData && gameState.activeScreen === 'game'
        && !document.getElementById('scene-panel')
        && !window.combatState?.active && !window.npcConvState?.active) {
      const prevReceiving = window.mp._receiving;
      window.mp._receiving = true;
      try { window.showScene?.(state.scene.currentData); }
      finally { window.mp._receiving = prevReceiving; }
    }
  }
  if (state.reputation) window.reputation = { ...state.reputation };
  if (state.worldClock) window.worldClock = { ...state.worldClock };
  if (state.map) {
    window.mapDiscovered = {};
    (state.map.discovered || []).forEach(id => { window.mapDiscovered[id] = true; });
    if (window.WORLD_LOCATIONS) {
      Object.values(window.WORLD_LOCATIONS).forEach(loc => { if (loc?.id) loc.discovered = !!window.mapDiscovered[loc.id]; });
    }
    window.applyDiscoveredLocations?.(window.mapDiscovered);
    if (window.mapState && state.map.currentLocation) window.mapState.currentLocation = state.map.currentLocation;
    window.updateLocationPanel?.();
  }
  window.renderQuestList?.();
  window.updateQuestCounter?.();
  window.updateWorldClockUI?.();
  window.PartyOriginQuests?.syncLocalCharacter?.();
}

function mpBroadcastCampaignState(reason = 'sync') {
  if (!window.mp?.isHost || !window.mp?.socket || !window.mp.sessionCode) return;
  clearTimeout(window.mp._campaignSyncTimer);
  window.mp._campaignSyncTimer = setTimeout(() => {
    const state = buildCampaignState(reason);
    window.mp._campaignVersion = state.version;
    window.mp.socket.emit('campaign_state', { code:window.mp.sessionCode, state });
  }, 40);
}

function mpRequestAction(text, options = {}) {
  if (!window.mp?.socket || !window.mp.sessionCode) return { pending:false };
  window.mp.socket.emit('story_event', {
    code:window.mp.sessionCode,
    eventType:'action_request',
    payload:{
      actorId:window.mp.playerId,
      actorName:gameState.character?.name || 'Unknown',
      text:String(text || '').slice(0, 1000),
      options:{
        skill:options.skill, ability:options.ability, dc:options.dc,
        advantage:!!options.advantage, disadvantage:!!options.disadvantage,
      },
    },
  });
  return { pending:true, authoritative:false };
}

function mpRequestEnvironmentAction({zoneId,targetId,targetLabel,actionId}={}){
  if(!window.mp?.socket||!window.mp.sessionCode)return{pending:false,success:false};
  window.mp.socket.emit('story_event',{code:window.mp.sessionCode,eventType:'environment_action_request',payload:{actorId:window.mp.playerId,zoneId:String(zoneId||'').slice(0,64),targetId:String(targetId||'').slice(0,64),targetLabel:String(targetLabel||'').slice(0,100),actionId:String(actionId||'').slice(0,64)}});
  return{pending:true,authoritative:false,message:'Waiting for the Session Master.'};
}

function mpBeginConversation(payload = {}) {
  if(!window.mp?.socket||!window.mp.sessionCode)return Promise.resolve({ok:true,conversation:null});
  return new Promise(resolve=>{
    let settled=false;
    const timer=setTimeout(()=>{if(!settled){settled=true;resolve({ok:false,error:'The conversation server did not respond.'});}},5000);
    window.mp.socket.emit('conversation_open',{code:window.mp.sessionCode,payload},response=>{
      if(settled)return;settled=true;clearTimeout(timer);resolve(response&&typeof response==='object'?response:{ok:false,error:'Conversation request failed.'});
    });
  });
}

function mpSendConversationUpdate(type,payload={}){
  if(!window.mp?.socket||!window.mp.sessionCode)return false;
  const conversationId=payload.conversationId||window.npcConvState?.conversationId||window.mp._conversationState?.id;
  if(!conversationId)return false;
  window.mp.socket.emit('conversation_update',{code:window.mp.sessionCode,type,payload:{...payload,conversationId}},response=>{
    if(response?.ok===false)console.warn('Conversation update rejected:',response.error);
  });
  return true;
}

function mpNotifyNPCOutcome(npc, speech) {
  if (!window.mp?.sessionCode || !npc) return;
  if (window.mp.isHost) {
    mpBroadcastCampaignState(`npc:${npc.id}`);
    return;
  }
  mpSendConversationUpdate('outcome', {
    npcId:npc.id, npcName:npc.name,
    fact:String(speech || '').slice(0, 1200),
    playerId:window.mp.playerId,
  });
}

function mpSyncHostCharacter(character = gameState.character, playerId = window.mp?.playerId) {
  if (!window.mp?.isHost || !window.mp?.socket || !window.mp.sessionCode || !character || !playerId) return;
  window.mp.socket.emit('host_player_state', {
    code:window.mp.sessionCode, playerId,
    patch:{
      hp:character.hp, mp:character.mp,
      holyPoints:character.holyPoints, hellPoints:character.hellPoints,
      conditions:character.conditions || [], gold:character.gold || 0,
      inventory:character.inventory || [],
    },
  });
}

window.buildCampaignState = buildCampaignState;
window.applyCampaignState = applyCampaignState;
window.mpBroadcastCampaignState = mpBroadcastCampaignState;
window.mpRequestAction = mpRequestAction;
window.mpRequestEnvironmentAction = mpRequestEnvironmentAction;
window.mpBeginConversation = mpBeginConversation;
window.mpSendConversationUpdate = mpSendConversationUpdate;
window.mpNotifyNPCOutcome = mpNotifyNPCOutcome;
window.mpSyncHostCharacter = mpSyncHostCharacter;

function mpBroadcastStoryEvent(eventType, payload) {
  const code = window.mp?.sessionCode || gameState?.sessionCode;
  if (!window.mp?.socket || !code) {
    console.warn('mpBroadcast skipped — no socket or code', eventType, window.mp?.sessionCode, gameState?.sessionCode);
    return;
  }
  console.log('📡 Broadcasting:', eventType, payload);
  window.mp.socket.emit('story_event', { code, eventType, payload });
}
// Expose globally so dialogue.js, story.js etc. can call it
// This replaces the early stub set in index.html <head>
window.mpBroadcastStoryEvent = mpBroadcastStoryEvent;

// #68: flush any events queued before the socket existed. This MUST run after
// the socket connects (it's invoked from the 'connect' handler), not at script
// load — otherwise mpBroadcastStoryEvent bails (no connected socket) and drops them.
function flushQueuedStoryEvents() {
  if (window._mpEventQueue?.length) {
    console.log('📡 Flushing', window._mpEventQueue.length, 'queued story events');
    window._mpEventQueue.forEach(e => mpBroadcastStoryEvent(e.eventType, e.payload));
    window._mpEventQueue = [];
  }
}

// ─── PATCH addLog ─────────────────────────────
const _mpOrigAddLog = window.addLog;
// Types that should broadcast to all players
const MP_BROADCAST_TYPES = new Set(['action','narrator','combat','holy','dice','system']);
// Noise that's only relevant locally (turn indicators, AP updates, etc.)
const MP_LOCAL_ONLY = new Set(['local']);
window.addLog = function(text, type = 'system', playerName = null) {
  if (_mpOrigAddLog) _mpOrigAddLog(text, type, playerName);
  if (window.mp.sessionCode && window.mp.socket && !window.mp._receiving) {
    if (MP_BROADCAST_TYPES.has(type) && !MP_LOCAL_ONLY.has(type)) {
      window.mp.socket.emit('game_log', {
        code: window.mp.sessionCode,
        entry: { text, type, playerName }
      });
    }
  }
};
window.addLog._orig = _mpOrigAddLog;

// Scene choices are synchronized by the host-only vote resolution protocol.
// The old scene_choice echo was removed because it executed callbacks a second
// time on every client and scaled the bug with party size.

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
window.startCombat = function(enemies, encounter = {}) {
  if (window.mp.sessionCode) {
    if (window.mp.combatState?.active) { addLog('⚔ Combat already in progress!', 'system'); return; }
    mpStartCombat(enemies, encounter);
  } else {
    if (_origStartCombat) _origStartCombat(enemies, encounter);
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

// ─── PATCH combatMove ─────────────────────────
// #63: route MOVE through the server like attack/spell/end-turn so AP stays
// authoritative and the whole party sees it.
const _origCombatMove = window.combatMove;
window.combatMove = function(position) {
  if (window.mp.sessionCode && window.mp.combatState) {
    if (!isMyTurnMP()) { addLog('Not your turn!', 'system'); return; }
    mpCombatAction('move', null, null, position);
  } else {
    if (_origCombatMove) _origCombatMove(position);
  }
};

// ─── PATCH combatItem ─────────────────────────
// #63: route ITEM through the server. The server applies the AP cost + heal
// authoritatively and broadcasts a player_state sync (inventory/gold/hp).
const _origCombatItem = window.combatItem;
window.combatItem = function() {
  if (window.mp.sessionCode && window.mp.combatState) {
    if (!isMyTurnMP()) { addLog('Not your turn!', 'system'); return; }
    // Pick the item locally so we can pass its name to the server (targetId slot).
    const inv = gameState.character?.inventory || [];
    const itemName = inv.find(i => typeof i === 'string' && i.toLowerCase().includes('potion'));
    if (!itemName) { addLog('No items to use!', 'system'); return; }
    mpCombatAction('item', itemName, null);
  } else {
    if (_origCombatItem) _origCombatItem();
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
  const combatants = combatState?.combatants;
  if (!combatants) return null;
  // Use selectedTarget (set by selectTarget() in combat.js)
  if (combatState.selectedTarget) {
    const t = combatants[combatState.selectedTarget];
    if (t && t.hp > 0) return t;
  }
  // Fall back to first living enemy
  return Object.values(combatants).find(c => !c.isPlayer && c.hp > 0) || null;
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
  if (window.mp.combatSpectator) {
    renderSpectatorCombat(cs);
    (window.addLog._orig || window.addLog)('👁 This encounter was already underway. You will join the next fight.', 'system');
    return;
  }
  // Auto-select first living enemy so Attack works immediately
  if (!combatState.selectedTarget) {
    const firstEnemy = Object.values(combatState.combatants).find(c => !c.isPlayer && c.hp > 0);
    if (firstEnemy) combatState.selectedTarget = firstEnemy.id;
  }
  if (typeof renderCombatUI === 'function') renderCombatUI();
}

function updateCombatFromServer(cs) {
  Object.assign(combatState, cs);
  if (window.mp.combatSpectator) renderSpectatorCombat(cs);
  else if (typeof updateCombatUI === 'function') updateCombatUI();
}

function renderSpectatorCombat(cs) {
  let panel = document.getElementById('combat-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'combat-panel';
    panel.className = 'combat-panel';
    document.body.appendChild(panel);
  }
  const currentId = cs.turnOrder?.[cs.currentTurnIndex];
  const current = cs.combatants?.[currentId];
  const living = Object.values(cs.combatants || {}).filter(combatant => combatant.hp > 0);
  panel.innerHTML = `
    <div class="cp-combat-header">
      <span class="cp-round">Round ${Number(cs.round) || 1}</span>
      <div class="cp-whose-turn"><span>👁 SPECTATING — ${esc(current?.name || 'Combat')}</span></div>
    </div>
    <div class="cp-enemies">${living.map(combatant => {
      const hp = combatant.boss ? '??? HP' : `${Math.max(0, combatant.hp)}/${combatant.maxHp}`;
      return `<div class="combat-enemy ${combatant.isPlayer ? 'player' : ''}">
        <div class="ce-portrait ce-portrait-icon">${esc(combatant.icon || (combatant.isPlayer ? '⚔' : '👹'))}</div>
        <div class="ce-info"><span class="ce-name">${esc(combatant.name)}</span><span class="ce-hp-num">${hp}</span></div>
      </div>`;
    }).join('')}</div>
    <div class="cp-enemy-thinking">You joined during this encounter and will enter combat next time.</div>`;
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
          <span class="ps-name">${esc(playerName)}</span>
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
        <span class="ps-name">${esc(p.name)}</span>
        <span class="ps-status" style="color:${p.ready ? '#4a9a6a' : 'var(--text-dim)'}">
          ${p.ready ? 'Ready' : 'Waiting...'}
        </span>
      </div>`).join('');
  }
}

function updatePartyPanel() {
  const panel = document.getElementById('party-members');
  if (!panel || !window.mp.session) return;
  panel.innerHTML = Object.values(window.mp.session.players || {}).map(p => {
    const pct = p.maxHp ? Math.max(0, Math.floor(p.hp / p.maxHp * 100)) : 100;
    const col = pct > 60 ? '#4a9a6a' : pct > 30 ? '#c9a84c' : '#c0392b';
    const cls = p.character ? CLASSES?.find(c => c.id === p.character.class) : null;
    const isMe = p.id === window.mp.playerId;
    return `<div class="pm-slot ${isMe ? 'me' : ''} ${!p.connected ? 'disconnected' : ''}">
      <div class="pm-name">
        <span>${cls?.icon || '👤'} ${esc(p.name)}${isMe ? ' (You)' : ''}</span>
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
    ? `<span style="color:var(--text-dim);font-style:italic">${esc(msg.text)}</span>`
    : `<span class="chat-from">${esc(msg.from)}:</span> <span class="chat-text">${esc(msg.text)}</span>`;
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
window.updateReadyRoom = updateReadyRoom;
window.mpBroadcastStoryEvent = mpBroadcastStoryEvent;
window.submitChat = submitChat;
window.copySessionCode = copySessionCode;
window.updatePartyPanel = updatePartyPanel;

} // end double-load guard
