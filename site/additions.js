// ============================================
//   SANCTUM & SHADOW — ADDITIONS v2
//   1. AI Story Narration on every action
//   2. Save / Load / Autosave system
// ============================================

// ─── MUSIC ───────────────────────────────────
let musicEnabled = true;
let musicStarted = false;

function toggleMusic() {
  const bars = document.getElementById('music-bars');
  const btn = document.getElementById('music-toggle');
  if (!musicStarted) return;
  musicEnabled = AudioEngine.toggle();
  if (musicEnabled) { btn.textContent = '⏸'; bars?.classList.remove('paused'); }
  else { btn.textContent = '▶'; bars?.classList.add('paused'); }
}

function setMusicVolume(val) {
  AudioEngine.setVolume(parseInt(val) / 100);
  const label = document.getElementById('vol-label');
  if (label) label.textContent = val + '%';
}

function startGameMusic(trackId = 'city_tense', trackName = 'Vaelthar — Uneasy Peace') {
  if (!musicStarted) { AudioEngine.init(); musicStarted = true; }
  AudioEngine.play(trackId);
  const el = document.getElementById('music-track-name');
  if (el) el.textContent = trackName;
  document.getElementById('music-bars')?.classList.remove('paused');
}

const TRACK_NAMES = {
  city_tense: 'Vaelthar — Uneasy Peace', holy_ominous: 'Temple Quarter — Where Faith Bleeds',
  forest_dread: 'The Thornwood — Something Watches', dungeon_horror: 'Depths Unknown — It Breathes Below',
  combat: 'Blood & Iron — Combat', boss_ancient: 'The Shattered God — Final Hour',
  village_uneasy: 'Mol — The Heretic\'s Sermon', road_danger: 'Merchant Road — Blood on Stone',
  fortress_somber: 'Fortress Harren — The Kneeling Knight', wastes_eerie: 'Ashen Fields — Blue Fire',
};

// ─── SAVE / LOAD SYSTEM ──────────────────────
const SAVE_KEY = 'ss_save_v1';

function saveGame(silent = false) {
  if (!gameState.character) return;
  const save = {
    character: gameState.character,
    activeQuests: gameState.activeQuests,
    completedQuests: gameState.completedQuests,
    chapter: gameState.chapter,
    questIndex: gameState.questIndex,
    log: gameState.log?.slice(-40) || [], // save last 40 log entries
    currentLocation: mapState?.currentLocation || 'vaelthar_city',
    storyHistory: window.storyHistory || [],
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  if (!silent) {
    toast('⚔ Chronicle saved.', 'holy');
    addLog('📜 Chronicle saved to memory.', 'system');
  }
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const save = JSON.parse(raw);
    if (!save.character) return false;

    // Restore gameState
    gameState.character = save.character;
    gameState.activeQuests = save.activeQuests || [];
    gameState.completedQuests = save.completedQuests || [];
    gameState.chapter = save.chapter || 1;
    gameState.questIndex = save.questIndex || 1;
    gameState.log = save.log || [];
    window.storyHistory = save.storyHistory || [];

    // Restore map location
    if (save.currentLocation && window.mapState) {
      mapState.currentLocation = save.currentLocation;
      if (WORLD_LOCATIONS[save.currentLocation]) {
        WORLD_LOCATIONS[save.currentLocation].discovered = true;
        WORLD_LOCATIONS[save.currentLocation].current = true;
      }
    }

    return true;
  } catch(e) {
    console.warn('Failed to load save:', e);
    return false;
  }
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
  toast('Save deleted.', 'error');
}

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function getSaveInfo() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s;
  } catch(e) { return null; }
}

// Autosave every 60 seconds while in game
let autosaveInterval = null;
function startAutosave() {
  if (autosaveInterval) clearInterval(autosaveInterval);
  autosaveInterval = setInterval(() => {
    if (gameState.character && gameState.activeScreen === 'game') {
      saveGame(true); // silent autosave
    }
  }, 60000);
}

// ─── STORY HISTORY (context for AI) ──────────
window.storyHistory = [];
const MAX_STORY_HISTORY = 8; // keep last 8 exchanges for AI context

function addToStoryHistory(action, result, roll) {
  window.storyHistory.push({ action, result, roll });
  if (window.storyHistory.length > MAX_STORY_HISTORY) {
    window.storyHistory.shift();
  }
}

// ─── AI STORY NARRATION ───────────────────────
async function narrateActionResult(actionText, roll, succeeded) {
  const char = gameState.character;
  if (!char) return;

  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const cls = CLASSES.find(c => c.id === char.class);
  const race = RACES.find(r => r.id === char.race);

  const historyText = window.storyHistory.length > 0
    ? 'Recent story context:\n' + window.storyHistory.map(h =>
        `- Player tried: "${h.action}" → rolled ${h.roll} → ${h.result}`
      ).join('\n')
    : '';

  const activeQuestTitles = (gameState.activeQuests || []).slice(0,3).map(q => q.title).join(', ');

  const prompt = `You are the Dungeon Master of "Sanctum & Shadow", a dark epic fantasy RPG. The world is grim, political, morally complex — like Game of Thrones meets D&D.

Character: ${char.name}, ${race?.name} ${cls?.name}, Level ${char.level}
Holy Points: ${char.holyPoints} | Hell Points: ${char.hellPoints} | HP: ${char.hp}/${char.maxHp}
Current location: ${loc?.name} — ${loc?.subtitle}
Active quests: ${activeQuestTitles || 'None yet'}
NPCs nearby: ${loc?.npcs?.join(', ') || 'Unknown'}

${historyText}

The player just did: "${actionText}"
They rolled a d20 and got: ${roll}/20
Result: ${succeeded ? 'SUCCESS' : roll === 20 ? 'CRITICAL SUCCESS' : roll === 1 ? 'CRITICAL FAILURE' : 'FAILURE'}

Write 2-4 sentences of vivid DM narration describing EXACTLY what happens as a result of this action. Be specific — name the NPCs, describe their reaction, move the scene forward. If they succeeded talking to a guard, tell them what the guard said or revealed. If they failed, describe the consequence. Always end with something that hints at what happens next or what choice they face. Do NOT be generic. Make the story actually progress.`;

  try {
    const response = await fetch("/api/npc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    if (data.error || !data.content) throw new Error(data.error?.message || 'No content');
    const narration = data.content.map(i => i.text || '').join('').trim()
      || getFallbackNarration(actionText, roll, succeeded);

    addLog('📖 ' + narration, 'narrator');
    showDMStrip(narration, true);
    addToStoryHistory(actionText, succeeded ? 'succeeded' : 'failed', roll);
    saveGame(true); // autosave after each action

  } catch(e) {
    const fallback = getFallbackNarration(actionText, roll, succeeded);
    addLog('📖 ' + fallback, 'narrator');
    addToStoryHistory(actionText, succeeded ? 'succeeded' : 'failed', roll);
  }
}

function getFallbackNarration(action, roll, succeeded) {
  if (roll === 20) return `A critical success. Everything about "${action}" goes better than you could have hoped — the kind of moment bards write songs about. The path forward opens clearly.`;
  if (roll === 1) return `A critical failure. "${action}" goes catastrophically wrong. You've made enemies, wasted time, or attracted attention you didn't want. The situation has gotten worse.`;
  if (succeeded) return `You succeed. "${action}" works — not perfectly, but well enough. The situation shifts in your favor, though complications linger at the edges.`;
  return `You fail. "${action}" doesn't go as planned. The world pushes back. You're not in immediate danger, but you've lost something — time, trust, or opportunity.`;
}

// ─── PATCH resolveAction to use AI narration ──
const _origResolveAction = window.resolveAction;
window.resolveAction = function(text, roll) {
  const isCrit = roll === 20;
  const isFumble = roll === 1;
  const isSuccess = roll >= 10;

  addLog(`🎲 You roll: [${roll}]${isCrit ? ' — CRITICAL SUCCESS!!' : isFumble ? ' — CRITICAL FAILURE!' : isSuccess ? ' — Success!' : ' — Failure!'}`, 'dice');
  AudioEngine.sfx?.dice();

  if (isCrit) grantHolyPoints(2);
  if (isFumble) grantHellPoints(2);

  // Trigger AI narration
  setTimeout(() => narrateActionResult(text, roll, isSuccess || isCrit), 400);
};

// ─── DM STRIP ─────────────────────────────────
function showDMStrip(text, persist = false) {
  const strip = document.getElementById('dm-strip');
  const stripText = document.getElementById('dm-strip-text');
  if (!strip || !stripText) return;
  strip.style.display = 'flex';
  stripText.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) { stripText.textContent += text[i]; i++; }
    else {
      clearInterval(interval);
      if (!persist) setTimeout(() => { strip.style.display = 'none'; }, 14000);
    }
  }, 16);
}

// ─── LOCATION UPDATE ──────────────────────────
function updateLocationPanel(locId) {
  const loc = WORLD_LOCATIONS[locId];
  if (!loc) return;
  const icon = document.getElementById('lm-icon');
  const name = document.getElementById('lm-name');
  const sub = document.getElementById('lm-sub');
  const danger = document.getElementById('lm-danger');
  if (icon) icon.textContent = loc.icon;
  if (name) name.textContent = loc.name;
  if (sub) sub.textContent = loc.subtitle;
  if (danger) {
    const dc = ['','#4a9a6a','#c9a84c','#c9a84c','#c0392b','#8b0000'];
    const ds = ['','✦','✦✦','✦✦✦','☠✦✦✦','☠☠☠☠☠'];
    danger.textContent = (ds[loc.danger]||'') + ' Danger ' + loc.danger + '/5';
    danger.style.color = dc[loc.danger] || 'var(--gold)';
  }
  const locDisplay = document.getElementById('current-location-display');
  if (locDisplay) locDisplay.textContent = loc.name + ' — ' + loc.subtitle;
  const mapDisplay = document.getElementById('map-current-display');
  if (mapDisplay) mapDisplay.innerHTML = '📍 Currently at: <strong>' + loc.name + '</strong>';
  const trackId = loc.music || 'city_tense';
  const tnEl = document.getElementById('music-track-name');
  if (tnEl) tnEl.textContent = TRACK_NAMES[trackId] || loc.name;
  if (musicStarted) AudioEngine.transition(trackId, 2500);
}

// ─── PATCH travelToLocation ───────────────────
const _origTravel = window.travelToLocation;
window.travelToLocation = function(loc) {
  if (_origTravel) _origTravel(loc);
  updateLocationPanel(loc.id);
  setTimeout(() => {
    const tDesc = LOCATION_DESCRIPTIONS_TRAVEL[loc.type]
      ? LOCATION_DESCRIPTIONS_TRAVEL[loc.type](loc) : `You arrive at ${loc.name}.`;
    showDMStrip(tDesc, true);
    // Narrate arrival with AI
    narrateArrival(loc);
  }, 800);
};

async function narrateArrival(loc) {
  const char = gameState.character;
  if (!char) return;
  try {
    const prompt = `You are a DM in "Sanctum & Shadow". The player ${char.name} (${RACES.find(r=>r.id===char.race)?.name} ${CLASSES.find(c=>c.id===char.class)?.name}) just arrived at ${loc.name} — ${loc.subtitle}. 

Setting: ${loc.description}
NPCs here: ${loc.npcs?.join(', ') || 'None known'}

Write 2 sentences of atmospheric arrival narration, then 1 sentence suggesting what they should investigate first. Be specific to this location.`;
    const response = await fetch("/api/npc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').trim();
    if (text) { addLog('📖 ' + text, 'narrator'); showDMStrip(text, true); }
  } catch(e) {}
}

// ─── PATCH initGameScreen ─────────────────────
const _origInit = window.initGameScreen;
window.initGameScreen = function() {
  if (_origInit) _origInit();
  setTimeout(() => {
    startGameMusic('city_tense');
    startAutosave();
    addSaveButton();

    // Opening DM narration
    const opening = `You stand in Vaelthar, a city holding its breath. The Covenant shattered three days ago — no one admits how. Guards watch the Church's torn banners with nervous eyes. Captain Rhael of the Watch stands near the gate, jaw tight. The Trembling Scribe has been seen outside the Archive, which is unusual. Where do you begin?`;
    setTimeout(() => { showDMStrip(opening, true); addLog('📖 ' + opening, 'narrator'); }, 1500);
  }, 500);

};

// ─── ADD SAVE BUTTON TO UI ────────────────────
function addSaveButton() {
  const qa = document.querySelector('.quick-actions');
  if (!qa || document.getElementById('save-btn')) return;

  const saveBtn = document.createElement('button');
  saveBtn.id = 'save-btn';
  saveBtn.className = 'qa-btn';
  saveBtn.style.cssText = 'border-color:rgba(74,154,100,0.4);color:#4a9a6a';
  saveBtn.textContent = '💾 Save';
  saveBtn.onclick = () => saveGame(false);
  qa.appendChild(saveBtn);

  const dmBtn = document.createElement('button');
  dmBtn.id = 'dm-guide-btn';
  dmBtn.className = 'qa-btn';
  dmBtn.style.cssText = 'border-color:rgba(120,100,160,0.4);color:#9a90c0';
  dmBtn.textContent = '📖 DM';
  dmBtn.onclick = getDMGuidance;
  qa.appendChild(dmBtn);
}

// ─── DM GUIDANCE ──────────────────────────────
async function getDMGuidance() {
  const char = gameState.character;
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  if (!char || !loc) return;

  showDMStrip('📖 The Chronicle reflects on your journey...', false);

  const historyText = window.storyHistory.length > 0
    ? 'What has happened so far:\n' + window.storyHistory.map(h => `- "${h.action}" → ${h.result}`).join('\n')
    : 'The adventure has just begun.';

  const nearbyLocs = loc.connections.map(id => WORLD_LOCATIONS[id]).filter(Boolean)
    .map(l => `${l.name} (${l.subtitle})`).join(', ');

  try {
    const response = await fetch("/api/npc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: `You are a DM in "Sanctum & Shadow". Give the player guidance on what to do next.

${char.name} is a ${RACES.find(r=>r.id===char.race)?.name} ${CLASSES.find(c=>c.id===char.class)?.name}.
Currently at: ${loc.name}
NPCs here: ${loc.npcs?.join(', ')}
Active quests: ${(gameState.activeQuests||[]).map(q=>q.title).join(', ') || 'None'}
Nearby locations: ${nearbyLocs}
${historyText}

Write 2-3 sentences guiding them — be specific, name NPCs, suggest a next action or location. Speak directly to the player.` }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').trim() || loc.description;
    showDMStrip(text, true);
    addLog('📖 DM: ' + text, 'narrator');
  } catch(e) {
    showDMStrip(loc.description, true);
  }
}

// ─── SFX PATCHES ──────────────────────────────
const _origAddLog = window.addLog;
window.addLog = function(text, type, playerName) {
  if (_origAddLog) _origAddLog(text, type, playerName);
  if (type === 'holy') AudioEngine.sfx?.holy();
  else if (type === 'dark') AudioEngine.sfx?.dark();
  else if (type === 'combat') AudioEngine.sfx?.sword();
  else if (type === 'dice') AudioEngine.sfx?.dice();
};

const _origRollContest = window.rollContest;
window.rollContest = function(player) {
  AudioEngine.sfx?.dice();
  if (_origRollContest) _origRollContest(player);
};

// ─── LOAD ON STARTUP / RESUME PROMPT ──────────
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing save and show resume option on splash
  setTimeout(() => {
    if (hasSave()) {
      const save = getSaveInfo();
      if (save?.character) {
        addResumeButton(save);
      }
    }
  }, 300);

  // Watch for game screen activation
  const observer = new MutationObserver(() => {
    if (document.getElementById('game-screen')?.classList.contains('active')) {
      setTimeout(addSaveButton, 600);
    }
  });
  observer.observe(document.getElementById('app') || document.body, {
    subtree: true, attributes: true, attributeFilter: ['class']
  });
});

function addResumeButton(save) {
  const splashBtns = document.querySelector('.splash-buttons');
  if (!splashBtns || document.getElementById('resume-btn')) return;

  const savedDate = save.savedAt ? new Date(save.savedAt).toLocaleString() : 'Unknown';
  const resumeBtn = document.createElement('button');
  resumeBtn.id = 'resume-btn';
  resumeBtn.className = 'btn-primary';
  resumeBtn.style.cssText = 'background:linear-gradient(135deg,rgba(74,154,100,0.3),rgba(40,100,60,0.2));border-color:rgba(74,154,100,0.5);margin-top:8px';
  resumeBtn.innerHTML = `⚔ Resume Chronicle<br><small style="font-size:0.7rem;opacity:0.7">${save.character.name} · ${CLASSES.find(c=>c.id===save.character.class)?.name || ''} · Saved: ${savedDate}</small>`;
  resumeBtn.onclick = resumeGame;
  splashBtns.appendChild(resumeBtn);
}

function resumeGame() {
  const loaded = loadGame();
  if (!loaded) { toast('No save found.', 'error'); return; }

  // Jump straight to game screen
  showScreen('game');
  initGameScreen();

  // Restore log
  const logEl = document.getElementById('game-log');
  if (logEl && gameState.log?.length) {
    gameState.log.forEach(entry => {
      const div = document.createElement('div');
      div.className = `log-entry ${entry.type || ''}`;
      div.textContent = (entry.player ? `[${entry.player}] ` : '') + entry.text;
      logEl.appendChild(div);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  updateLocationPanel(mapState?.currentLocation || 'vaelthar_city');
  toast(`⚔ Chronicle resumed — welcome back, ${gameState.character.name}.`, 'holy');
  addLog(`📜 The Chronicle resumes. ${gameState.character.name} returns to the battlefield.`, 'narrator');
}
