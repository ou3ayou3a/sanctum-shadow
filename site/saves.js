// ============================================
//   SANCTUM & SHADOW — SAVE / LOAD SYSTEM
// ============================================

const SS_SAVES_KEY = 'ss_saves_v1';
const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let _autosaveTimer = null;
let _lastSaveTime = null;

// ─── SAVE STRUCTURE ───────────────────────
// localStorage key: ss_saves_v1
// Value: { slots: [ SaveSlot, ... ] }
// SaveSlot: {
//   id, name, type ('solo'|'multiplayer'),
//   character: { name, class, race, level, hp, maxHp, holyPoints, hellPoints, ... },
//   gameState: { chapter, activeQuests, completedQuests, log (last 60 lines) },
//   sceneFlags: {},
//   mapState: { currentLocation },
//   sessionCode (if MP),
//   timestamp, playTime (ms), chapter, location
// }

function getAllSaves() {
  try {
    const raw = localStorage.getItem(SS_SAVES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data.slots) ? data.slots : [];
  } catch { return []; }
}

function writeSaves(slots) {
  localStorage.setItem(SS_SAVES_KEY, JSON.stringify({ slots }));
}

function buildSaveSlot(slotName, type) {
  const char = gameState.character;
  if (!char) return null;

  const existing = getAllSaves();
  const prev = existing.find(s => s.id && s.character?.name === char.name && s.type === type);
  const prevPlayTime = prev?.playTime || 0;
  const sessionStart = window._sessionStart || Date.now();
  const sessionDuration = Date.now() - sessionStart;

  // Persist MP session info separately so rejoin works after refresh
  const mpCode = window.mp?.sessionCode || gameState?.sessionCode || null;
  const mpName = window.mp?._playerName || char.name;
  if (mpCode) {
    localStorage.setItem('ss_mp_session', JSON.stringify({
      code: mpCode,
      playerName: mpName,
      timestamp: Date.now(),
    }));
  }

  return {
    id: prev?.id || `save_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    name: slotName || `${char.name} — Chapter ${gameState.chapter || 1}`,
    type: type || (window.mp?.sessionCode ? 'multiplayer' : 'solo'),
    character: {
      name: char.name,
      class: char.class,
      race: char.race,
      level: char.level || 1,
      xp: char.xp || 0,
      hp: char.hp,
      maxHp: char.maxHp,
      mp: char.mp,
      maxMp: char.maxMp,
      holyPoints: char.holyPoints || 0,
      hellPoints: char.hellPoints || 0,
      gold: char.gold || 0,
      statPoints: char.statPoints || 0,
      stats: char.stats || {},
      skills: char.skills || {},
      inventory: char.inventory || [],
      spells: char.spells || [],
      personalQuests: char.personalQuests || [],
      backstory: char.backstory || '',
      origin: char.origin || '',
      revealChoice: char.revealChoice || '',
      tree: char.tree || '',
    },
    gameState: {
      chapter: gameState.chapter || 1,
      activeQuests: gameState.activeQuests || [],
      completedQuests: gameState.completedQuests || [],
      log: (gameState.log || []).slice(-80),
    },
    sceneFlags: window.sceneState?.flags || {},
    sceneHistory: window.sceneState?.history || [],
    mapState: { currentLocation: window.mapState?.currentLocation || 'vaelthar_city' },
    worldClock: window.worldClock || { hour: 8, day: 1 },
    reputation: window.reputation || {},
    sessionCode: window.mp?.sessionCode || null,
    romanceState: window.romanceState || null,
    drunkState: window.drunkState ? { cups: window.drunkState.cups } : null,
    chapter: gameState.chapter || 1,
    location: WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.name || 'Vaelthar',
    timestamp: Date.now(),
    playTime: prevPlayTime + sessionDuration,
  };
}

function saveGame(slotName, type, silent = false) {
  const slot = buildSaveSlot(slotName, type);
  if (!slot) { if (!silent) toast('Nothing to save — start a game first.', 'error'); return null; }

  const slots = getAllSaves();
  const existingIdx = slots.findIndex(s => s.id === slot.id);
  if (existingIdx >= 0) slots[existingIdx] = slot;
  else slots.unshift(slot); // newest first

  // Keep max 20 saves total
  writeSaves(slots.slice(0, 20));
  _lastSaveTime = Date.now();

  if (!silent) {
    toast(`✅ Saved: ${slot.name}`, 'success');
    addLog(`💾 Game saved: ${slot.name}`, 'system');
  }
  return slot;
}

function autosave() {
  if (gameState.activeScreen !== 'game' || !gameState.character) return;
  saveGame(null, null, true); // silent autosave — no log, no scroll
  showAutosaveFlash();        // just the corner flash
}

function showAutosaveFlash() {
  let flash = document.getElementById('autosave-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'autosave-flash';
    flash.style.cssText = `
      position:fixed; bottom:70px; right:16px; z-index:3000;
      background:rgba(10,6,2,0.95); border:1px solid rgba(201,168,76,0.4);
      border-left:3px solid var(--gold);
      color:var(--gold); font-family:'Cinzel',serif; font-size:0.65rem;
      padding:6px 12px; letter-spacing:0.08em;
      opacity:0; transition:opacity 0.3s;
      pointer-events:none;
    `;
    document.body.appendChild(flash);
  }
  flash.textContent = '💾 AUTOSAVED';
  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; }, 2500);
}

function startAutosave() {
  window._sessionStart = window._sessionStart || Date.now();
  if (_autosaveTimer) clearInterval(_autosaveTimer);
  _autosaveTimer = setInterval(autosave, AUTOSAVE_INTERVAL_MS);
  console.log('💾 Autosave started — every 15 minutes');
}

function stopAutosave() {
  if (_autosaveTimer) clearInterval(_autosaveTimer);
  _autosaveTimer = null;
}

// ─── LOAD GAME ────────────────────────────
function loadSaveSlot(slotId) {
  const slots = getAllSaves();
  const slot = slots.find(s => s.id === slotId);
  if (!slot) { toast('Save not found.', 'error'); return; }

  // Signal story engine to skip opening scene
  window._loadingSave = true;

  // Restore full character with all progression
  gameState.character = {
    ...slot.character,
    // Ensure all fields exist with fallbacks
    xp: slot.character.xp || 0,
    gold: slot.character.gold || 0,
    statPoints: slot.character.statPoints || 0,
    skills: slot.character.skills || {},
    spells: slot.character.spells || [],
  };

  // Restore game state
  gameState.chapter = slot.gameState.chapter || 1;
  gameState.activeQuests = slot.gameState.activeQuests || [];
  gameState.completedQuests = slot.gameState.completedQuests || [];
  gameState.log = slot.gameState.log || [];

  // Restore scene flags — this is what determines story progress
  if (window.sceneState) {
    window.sceneState.flags = slot.sceneFlags || {};
    window.sceneState.history = slot.sceneHistory || [];
  } else {
    // sceneState not yet initialized — will be set when story.js loads
    window._pendingSceneFlags = slot.sceneFlags || {};
    window._pendingSceneHistory = slot.sceneHistory || [];
  }

  // Restore map position
  if (window.mapState && slot.mapState?.currentLocation) {
    window.mapState.currentLocation = slot.mapState.currentLocation;
  }

  // Restore world clock
  if (slot.worldClock) {
    window.worldClock = slot.worldClock;
  }

  // Restore reputation
  if (slot.reputation) {
    window.reputation = slot.reputation;
  }

  // Restore romance state
  if (slot.romanceState && window.romanceState !== undefined) {
    window.romanceState = slot.romanceState;
  }

  window._sessionStart = Date.now();

  // Launch game screen
  closeSaveLoadScreen();
  initGameScreen();
  showScreen('game');

  setTimeout(() => {
    // Apply any pending scene state if sceneState wasn't ready before
    if (window._pendingSceneFlags && window.sceneState) {
      window.sceneState.flags = window._pendingSceneFlags;
      window.sceneState.history = window._pendingSceneHistory || [];
      delete window._pendingSceneFlags;
      delete window._pendingSceneHistory;
    }

    // Restore map visuals
    const locData = WORLD_LOCATIONS?.[slot.mapState?.currentLocation];
    if (locData && window.mapState) {
      window.mapState.currentLocation = locData.id;
      if (window.renderMap) window.renderMap();
      if (window.updateLocationDisplay) window.updateLocationDisplay(locData);
      if (window.AudioEngine) AudioEngine.transition(locData.music || 'city_dread', 1000);
    }

    // Replay saved log to game-log element so players see their history
    const gameLog = document.getElementById('game-log');
    if (gameLog && slot.gameState.log?.length) {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
      addLog(`💾 Chronicle resumed — ${slot.name}`, 'system');
      addLog(`📍 ${slot.location} — Chapter ${slot.chapter} — Lv.${slot.character.level}`, 'system');

      // Replay last 20 log lines as history
      const replayLines = (slot.gameState.log || []).slice(-20);
      if (replayLines.length > 0) {
        addLog('── Recent history ─────────────────────', 'system');
        replayLines.forEach(entry => {
          if (typeof entry === 'string') {
            addLog(entry, 'narrator');
          } else if (entry?.text) {
            addLog(entry.text, entry.type || 'narrator');
          }
        });
        addLog('── End of history — story continues ───', 'system');
      }
    }

    // Update all UI panels with restored data
    if (window.renderPlayerCard) renderPlayerCard();
    if (window.renderInventory) renderInventory();
    if (window.renderQuestList) renderQuestList();
    if (window.renderStatsMini) renderStatsMini();
    if (window.updateXPBar) updateXPBar();

    // ── Multiplayer rejoin after refresh ──
    // If there's a saved MP session and socket is ready, attempt to rejoin
    _attemptMPRejoin();

  }, 800);

  startAutosave();
  toast(`✅ Loaded: ${slot.name}`);
}

function deleteSaveSlot(slotId) {
  const slots = getAllSaves().filter(s => s.id !== slotId);
  writeSaves(slots);
  renderSaveLoadScreen();
  toast('Save deleted.');
}

// ─── MULTIPLAYER REJOIN AFTER REFRESH ────────
function _attemptMPRejoin() {
  const raw = localStorage.getItem('ss_mp_session');
  if (!raw) return;

  let mpData;
  try { mpData = JSON.parse(raw); } catch { localStorage.removeItem('ss_mp_session'); return; }

  // Only attempt rejoin if saved within the last 30 minutes
  if (!mpData?.code || Date.now() - mpData.timestamp > 30 * 60 * 1000) {
    localStorage.removeItem('ss_mp_session');
    return;
  }

  const code = mpData.code;
  const playerName = mpData.playerName;
  const char = gameState.character;

  addLog(`🔄 Detected multiplayer session ${code} — attempting to rejoin...`, 'system');

  // If socket is already connected, rejoin immediately
  const tryRejoin = () => {
    const socket = window.mp?.socket;
    if (!socket) { addLog('⚠ MP socket not ready — playing solo.', 'system'); return; }

    if (socket.connected) {
      window.mp.sessionCode = code;
      window.mp._playerName = playerName;
      gameState.sessionCode = code;
      socket.emit('rejoin_session', { code, playerName, character: char || null });
      addLog(`📡 Rejoining session ${code} as ${playerName}...`, 'system');
    } else {
      // Socket not connected yet — wait for connect event then rejoin
      // The existing socket.on('connect') handler in multiplayer.js already does this
      // via window.mp.sessionCode check — just set the values
      window.mp.sessionCode = code;
      window.mp._playerName = playerName;
      gameState.sessionCode = code;
      addLog(`📡 Waiting for server connection to rejoin session ${code}...`, 'system');
    }
  };

  // Small delay to let multiplayer.js initialize fully
  setTimeout(tryRejoin, 600);
}

function clearMPSession() {
  localStorage.removeItem('ss_mp_session');
  if (window.mp) { window.mp.sessionCode = null; window.mp._playerName = null; }
  if (gameState) gameState.sessionCode = null;
}
window.clearMPSession = clearMPSession;

// ─── SAVE/LOAD UI ─────────────────────────
function openSaveScreen() {
  renderSaveLoadScreen('save');
}

function openLoadScreen() {
  renderSaveLoadScreen('load');
}

function closeSaveLoadScreen() {
  document.getElementById('save-load-screen')?.remove();
}

function renderSaveLoadScreen(mode = 'load') {
  document.getElementById('save-load-screen')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'save-load-screen';
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:5000;
    background:rgba(4,2,1,0.96); backdrop-filter:blur(4px);
    display:flex; align-items:center; justify-content:center;
    padding:20px; animation:sceneFadeIn 0.2s ease;
  `;

  const slots = getAllSaves();
  const inGame = gameState.activeScreen === 'game' && gameState.character;

  const slotsHTML = slots.length === 0
    ? `<div style="text-align:center;padding:40px;color:var(--text-dim);font-family:'IM Fell English',serif;font-size:0.9rem;">
        No saved runs found.<br><span style="font-size:0.75rem;opacity:0.6">Complete character creation to start a run.</span>
       </div>`
    : slots.map(s => {
        const date = new Date(s.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        const playMins = Math.floor((s.playTime || 0) / 60000);
        const playStr = playMins >= 60
          ? `${Math.floor(playMins/60)}h ${playMins%60}m`
          : `${playMins}m`;
        const cls = CLASSES?.find(c => c.id === s.character?.class);
        const race = RACES?.find(r => r.id === s.character?.race);
        const typeIcon = s.type === 'multiplayer' ? '👥' : '⚔';
        const typeLabel = s.type === 'multiplayer' ? 'Multiplayer' : 'Solo';
        const hpPct = Math.round((s.character.hp / s.character.maxHp) * 100);
        const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 30 ? '#ff9800' : '#f44336';

        return `
        <div class="save-slot" style="
          background:rgba(10,6,2,0.9); border:1px solid rgba(201,168,76,0.15);
          border-left:3px solid rgba(201,168,76,0.4); margin-bottom:8px;
          padding:12px 16px; display:flex; gap:14px; align-items:center;
          transition:border-color 0.15s;
        " onmouseover="this.style.borderLeftColor='var(--gold)'" onmouseout="this.style.borderLeftColor='rgba(201,168,76,0.4)'">
          <div style="font-size:1.8rem;flex-shrink:0">
            ${s.character.race === 'elf' ? '🧝' : s.character.race === 'dwarf' ? '⛏' : s.character.race === 'orc' ? '🗡' : s.character.race === 'undead' ? '💀' : s.character.race === 'demon' ? '😈' : '⚔'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--gold)">${s.character.name}</span>
              <span style="font-size:0.6rem;color:var(--text-dim);background:rgba(201,168,76,0.08);padding:2px 6px;border:1px solid rgba(201,168,76,0.15)">${typeIcon} ${typeLabel}</span>
              ${s.sessionCode ? `<span style="font-size:0.6rem;color:var(--text-dim)">${s.sessionCode}</span>` : ''}
            </div>
            <div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:4px">
              ${race?.name || ''} ${cls?.name || ''} · Lv ${s.character.level} · Chapter ${s.chapter} · ${s.location}
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;max-width:100px">
                <div style="height:100%;width:${hpPct}%;background:${hpColor};border-radius:2px;transition:width 0.3s"></div>
              </div>
              <span style="font-size:0.62rem;color:${hpColor}">${s.character.hp}/${s.character.maxHp} HP</span>
              <span style="font-size:0.62rem;color:var(--holy)">☩${s.character.holyPoints}</span>
              <span style="font-size:0.62rem;color:var(--hell)">⛧${s.character.hellPoints}</span>
            </div>
            <div style="font-size:0.62rem;color:var(--text-dim)">
              Saved ${dateStr} · ${playStr} played
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
            ${mode === 'save' ? `
              <button onclick="overwriteSave('${s.id}')" style="
                background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);
                color:var(--gold);font-family:'Cinzel',serif;font-size:0.62rem;
                padding:5px 10px;cursor:pointer;letter-spacing:0.05em;
              ">💾 OVERWRITE</button>
            ` : `
              <button onclick="loadSaveSlot('${s.id}')" style="
                background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);
                color:var(--gold);font-family:'Cinzel',serif;font-size:0.62rem;
                padding:5px 10px;cursor:pointer;letter-spacing:0.05em;
              ">▶ LOAD</button>
            `}
            <button onclick="deleteSaveSlot('${s.id}')" style="
              background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.25);
              color:rgba(192,57,43,0.7);font-family:'Cinzel',serif;font-size:0.6rem;
              padding:4px 10px;cursor:pointer;
            " onclick="if(!confirm('Delete this save?'))event.stopPropagation()">✕ DELETE</button>
          </div>
        </div>`;
      }).join('');

  const newSaveSection = mode === 'save' && inGame ? `
    <div style="margin-bottom:16px;padding:12px 16px;background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-left:3px solid var(--gold)">
      <div style="font-family:'Cinzel',serif;font-size:0.72rem;color:var(--gold);margin-bottom:8px">CREATE NEW SAVE</div>
      <div style="display:flex;gap:8px">
        <input id="new-save-name" type="text" placeholder="Name this run... (optional)"
          value="${gameState.character?.name} — Chapter ${gameState.chapter || 1}"
          style="flex:1;background:rgba(10,5,2,0.9);border:1px solid rgba(201,168,76,0.3);
          color:var(--text-primary);font-family:'Crimson Text',serif;font-size:0.85rem;padding:6px 10px">
        <button onclick="saveNewSlot()" style="
          background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);
          color:var(--gold);font-family:'Cinzel',serif;font-size:0.7rem;
          padding:6px 14px;cursor:pointer;letter-spacing:0.06em;white-space:nowrap
        ">💾 SAVE NEW</button>
      </div>
    </div>` : '';

  overlay.innerHTML = `
    <div style="width:100%;max-width:600px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="font-family:'Cinzel Decorative',serif;font-size:1.1rem;color:var(--gold);margin:0">
          ${mode === 'save' ? '💾 Save Chronicle' : '📖 Load Chronicle'}
        </h2>
        <button onclick="closeSaveLoadScreen()" style="
          background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);
          color:rgba(192,57,43,0.8);font-family:'Cinzel',serif;font-size:0.65rem;
          padding:5px 12px;cursor:pointer
        ">✕ CLOSE</button>
      </div>
      ${newSaveSection}
      <div style="font-family:'Cinzel',serif;font-size:0.65rem;color:var(--text-dim);margin-bottom:10px;letter-spacing:0.08em">
        ${slots.length} saved ${slots.length === 1 ? 'run' : 'runs'} — ${mode === 'save' ? 'overwrite an existing run or create a new save' : 'choose a run to resume'}
      </div>
      ${slotsHTML}
    </div>
  `;

  document.body.appendChild(overlay);
  // Close on backdrop click
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSaveLoadScreen(); });
}

function saveNewSlot() {
  const nameInput = document.getElementById('new-save-name');
  const name = nameInput?.value?.trim() || null;
  const type = window.mp?.sessionCode ? 'multiplayer' : 'solo';
  const slot = buildSaveSlot(name, type);
  if (!slot) return;
  // Force a new ID so it doesn't overwrite existing
  slot.id = `save_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const slots = getAllSaves();
  slots.unshift(slot);
  writeSaves(slots.slice(0, 20));
  toast(`✅ Saved: ${slot.name}`);
  addLog(`💾 Game saved: ${slot.name}`, 'system');
  closeSaveLoadScreen();
}

function overwriteSave(slotId) {
  const slots = getAllSaves();
  const idx = slots.findIndex(s => s.id === slotId);
  if (idx < 0) return;
  const newSlot = buildSaveSlot(slots[idx].name, slots[idx].type);
  if (!newSlot) return;
  newSlot.id = slotId; // Keep same ID
  slots[idx] = newSlot;
  writeSaves(slots);
  toast(`✅ Overwritten: ${newSlot.name}`);
  addLog(`💾 Save overwritten: ${newSlot.name}`, 'system');
  closeSaveLoadScreen();
}

// ─── HOOK INTO GAME ──────────────────────
// Start autosave when game screen loads
const _origInitForSave = window.initGameScreen;
window.initGameScreen = function() {
  if (_origInitForSave) _origInitForSave();
  window._sessionStart = Date.now();
  startAutosave();
};

// Stop autosave when leaving game
const _origShowScreenForSave = window.showScreen;
window.showScreen = function(name) {
  if (_origShowScreenForSave) _origShowScreenForSave(name);
  if (name !== 'game') stopAutosave();
  else startAutosave();
};

// Trigger save after scene option chosen
const _origExecForSave = window.executeSceneOption;
window.executeSceneOption = function(index) {
  if (_origExecForSave) _origExecForSave(index);
  setTimeout(() => { if (gameState.character) saveGame(null, null, true); }, 500);
};

// Trigger save after combat victory (endCombat is in combat.js — hook via window)
const _origEndCombatForSave = window.endCombat;
if (_origEndCombatForSave) {
  window.endCombat = function(victory) {
    _origEndCombatForSave(victory);
    if (victory) setTimeout(() => { if (gameState.character) saveGame(null, null, true); }, 3000);
  };
}

// Trigger save after NPC conversation closes
const _origCloseConvForSave = window.closeConvPanel;
if (_origCloseConvForSave) {
  window.closeConvPanel = function() {
    _origCloseConvForSave();
    setTimeout(() => { if (gameState.character) saveGame(null, null, true); }, 300);
  };
}

// Expose globally
window.saveGame = saveGame;
window.loadSaveSlot = loadSaveSlot;
window.deleteSaveSlot = deleteSaveSlot;
window.openSaveScreen = openSaveScreen;
window.openLoadScreen = openLoadScreen;
window.closeSaveLoadScreen = closeSaveLoadScreen;
window.renderSaveLoadScreen = renderSaveLoadScreen;
window.saveNewSlot = saveNewSlot;
window.overwriteSave = overwriteSave;
window.autosave = autosave;
window.autoSave = autosave; // alias used by other modules

console.log('💾 Save system loaded — autosave every 15 minutes');
