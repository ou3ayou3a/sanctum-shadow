// ============================================
//   SANCTUM & SHADOW — ADDITIONS
//   Music controls, Map wiring, DM narration
// ============================================

// ─── MUSIC CONTROL ───────────────────────────
let musicEnabled = true;
let musicStarted = false;

function toggleMusic() {
  const bars = document.getElementById('music-bars');
  const btn = document.getElementById('music-toggle');
  if (!musicStarted) return;

  musicEnabled = AudioEngine.toggle();
  if (musicEnabled) {
    btn.textContent = '⏸';
    bars?.classList.remove('paused');
    toast('🎵 Music resumed', 'holy');
  } else {
    btn.textContent = '▶';
    bars?.classList.add('paused');
    toast('🔇 Music paused');
  }
}

function setMusicVolume(val) {
  const v = parseInt(val) / 100;
  AudioEngine.setVolume(v);
  const label = document.getElementById('vol-label');
  if (label) label.textContent = val + '%';
}

function startGameMusic(trackId = 'city_tense', trackName = 'Vaelthar — Uneasy Peace') {
  if (!musicStarted) {
    AudioEngine.init();
    musicStarted = true;
  }
  AudioEngine.play(trackId);
  const el = document.getElementById('music-track-name');
  if (el) el.textContent = trackName;
  const bars = document.getElementById('music-bars');
  if (bars) bars.classList.remove('paused');
}

const TRACK_NAMES = {
  city_tense: 'Vaelthar — Uneasy Peace',
  holy_ominous: 'Temple Quarter — Where Faith Bleeds',
  forest_dread: 'The Thornwood — Something Watches',
  dungeon_horror: 'Depths Unknown — It Breathes Below',
  combat: 'Blood & Iron — Combat Theme',
  boss_ancient: 'The Shattered God — Final Hour',
  village_uneasy: 'Mol — The Heretic\'s Sermon',
  road_danger: 'The Merchant Road — Blood on Stone',
  fortress_somber: 'Fortress Harren — The Kneeling Knight',
  wastes_eerie: 'The Ashen Fields — Blue Fire',
};

// ─── DM NARRATION STRIP ──────────────────────
function showDMStrip(text, persist = false) {
  const strip = document.getElementById('dm-strip');
  const stripText = document.getElementById('dm-strip-text');
  if (!strip || !stripText) return;

  strip.style.display = 'flex';
  stripText.textContent = '';

  // Typewriter
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      stripText.textContent += text[i];
      i++;
    } else {
      clearInterval(interval);
      if (!persist) {
        setTimeout(() => { strip.style.display = 'none'; }, 12000);
      }
    }
  }, 18);

  AudioEngine.sfx?.page();
}

// ─── LOCATION UPDATE ─────────────────────────
function updateLocationPanel(locId) {
  const loc = WORLD_LOCATIONS[locId];
  if (!loc) return;

  // Update right panel mini
  const icon = document.getElementById('lm-icon');
  const name = document.getElementById('lm-name');
  const sub = document.getElementById('lm-sub');
  const danger = document.getElementById('lm-danger');

  if (icon) icon.textContent = loc.icon;
  if (name) name.textContent = loc.name;
  if (sub) sub.textContent = loc.subtitle;
  if (danger) {
    const dangerColors = ['', '#4a9a6a', '#c9a84c', '#c9a84c', '#c0392b', '#8b0000'];
    const dangerSymbols = ['', '✦', '✦✦', '✦✦✦', '☠✦✦✦', '☠☠☠☠☠'];
    danger.textContent = (dangerSymbols[loc.danger] || '') + ' Danger ' + loc.danger + '/5';
    danger.style.color = dangerColors[loc.danger] || 'var(--gold)';
  }

  // Update chapter banner
  const locDisplay = document.getElementById('current-location-display');
  if (locDisplay) locDisplay.textContent = loc.name + ' — ' + loc.subtitle;

  // Update map footer
  const mapDisplay = document.getElementById('map-current-display');
  if (mapDisplay) mapDisplay.innerHTML = '📍 Currently at: <strong>' + loc.name + '</strong>';

  // Switch music
  const trackId = loc.music || 'city_tense';
  const trackName = TRACK_NAMES[trackId] || loc.name;
  const trackNameEl = document.getElementById('music-track-name');
  if (trackNameEl) trackNameEl.textContent = trackName;
  if (musicStarted) AudioEngine.transition(trackId, 2500);

  AudioEngine.sfx?.travel();
}

// ─── PATCH travelToLocation to update UI ─────
const _origTravel = window.travelToLocation;
window.travelToLocation = function(loc) {
  if (_origTravel) _origTravel(loc);
  updateLocationPanel(loc.id);
  // Show DM narration strip after a moment
  setTimeout(() => {
    const tDesc = LOCATION_DESCRIPTIONS_TRAVEL[loc.type]
      ? LOCATION_DESCRIPTIONS_TRAVEL[loc.type](loc)
      : `You arrive at ${loc.name}.`;
    showDMStrip(tDesc, true);
  }, 800);
};

// ─── PATCH initGameScreen to start music ─────
const _origInit = window.initGameScreen;
window.initGameScreen = function() {
  if (_origInit) _origInit();

  // Start music after brief delay (needs user interaction first)
  setTimeout(() => {
    startGameMusic('city_tense', 'Vaelthar — Uneasy Peace');

    // Show opening DM narration
    const openingText = `You stand at the gates of Vaelthar, the capital of a kingdom holding its breath. The Covenant that kept peace between Church and Crown shattered three days ago. Nobody admits to how. The streets are tense, the guards are nervous, and the Church's white banners have been torn from the palace gates. Somewhere in this city — or beyond it — lies the answer. Where do you begin?`;

    setTimeout(() => showDMStrip(openingText, true), 1500);
  }, 600);

  // Wire SFX to game actions
  const origSubmit = window.submitAction;
  window.submitAction = function() {
    AudioEngine.sfx?.page();
    if (origSubmit) origSubmit();
  };
};

// ─── PATCH addLog to trigger SFX ─────────────
const _origAddLog = window.addLog;
window.addLog = function(text, type, playerName) {
  if (_origAddLog) _origAddLog(text, type, playerName);
  if (type === 'holy') AudioEngine.sfx?.holy();
  if (type === 'dark') AudioEngine.sfx?.dark();
  if (type === 'combat') AudioEngine.sfx?.sword();
  if (type === 'dice') AudioEngine.sfx?.dice();
};

// ─── PATCH rollContest for sfx ────────────────
const _origRollContest = window.rollContest;
window.rollContest = function(player) {
  AudioEngine.sfx?.dice();
  if (_origRollContest) _origRollContest(player);
};

// ─── DM GUIDANCE: Suggest where to go ────────
async function getDMGuidance() {
  const char = gameState.character;
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  if (!char || !loc) return;

  const nearbyLocs = loc.connections
    .map(id => WORLD_LOCATIONS[id])
    .filter(Boolean)
    .map(l => `${l.name} (${l.subtitle}, Danger ${l.danger})`)
    .join(', ');

  const activeQuestTitles = (gameState.activeQuests || []).map(q => q.title).join(', ');

  const prompt = `You are the Dungeon Master of "Sanctum & Shadow," a dark epic fantasy RPG. Speak directly to the player in second person, like a DM at a table.

Current situation:
- Player: ${char.name}, ${RACES.find(r=>r.id===char.race)?.name} ${CLASSES.find(c=>c.id===char.class)?.name}, Level ${char.level}
- Current location: ${loc.name} — ${loc.subtitle}
- Holy Points: ${char.holyPoints} | Hell Points: ${char.hellPoints}
- Active quests: ${activeQuestTitles || 'None yet'}
- Nearby locations they can travel to: ${nearbyLocs}
- NPCs present here: ${loc.npcs?.join(', ') || 'Unknown'}

Write 2-3 sentences of DM narration guiding them on what they could do next. Be specific about NPCs, quest hooks, or threats. Mention 1-2 specific directions they could go. Keep it atmospheric and immersive. Don't be a list — speak like a storyteller.`;

  showDMStrip('📖 The Chronicle reflects...', false);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('') || 'The path forward lies in the shadows. Trust your instincts.';
    showDMStrip(text, true);
    addLog('📖 DM: ' + text, 'narrator');
  } catch (e) {
    showDMStrip(loc.description, true);
  }
}

// Add DM Guidance button to quick actions after game starts
function addDMGuideButton() {
  const qa = document.querySelector('.quick-actions');
  if (!qa || document.getElementById('dm-guide-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'dm-guide-btn';
  btn.className = 'qa-btn';
  btn.style.cssText = 'border-color:rgba(120,100,160,0.4);color:#9a90c0';
  btn.textContent = '📖 DM Guide';
  btn.onclick = getDMGuidance;
  qa.appendChild(btn);
}

// ─── INIT HOOK ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Observe when game screen becomes active
  const observer = new MutationObserver(() => {
    if (document.getElementById('game-screen')?.classList.contains('active')) {
      setTimeout(addDMGuideButton, 500);
    }
  });
  observer.observe(document.getElementById('app') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
});
