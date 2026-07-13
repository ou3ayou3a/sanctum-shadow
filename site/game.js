// ============================================
//   SANCTUM & SHADOW — GAME ENGINE
// ============================================

// ─── GLOBAL STATE ─────────────────────────
let gameState = {
  sessionCode: null,
  sessionName: null,
  isHost: false,
  players: {},
  currentPlayer: null,
  character: null,
  activeScreen: 'splash',
  currentStep: 1,
  statsRolled: false,
  rerollUsed: false,
  revealChoice: null,
  chapter: 1,
  questIndex: 1,
  activeQuests: [],
  completedQuests: [],
  questProgress: {},
  world3dPositions: {},
  enemies: [],
  combat: false,
  log: [],
  rollInterval: null,
};

let pendingContestData = { p1Roll: null, p2Roll: null };

// ─── SCREEN MANAGEMENT ────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(name + '-screen');
  if (screen) {
    screen.classList.add('active');
    gameState.activeScreen = name;
  }
  // Always clean up floating game overlays when navigating away from game.
  // NOTE: the #dm-strip is STATIC HTML — hide it instead of removing it, so it
  // isn't permanently destroyed on the first menu click (#71).
  if (name !== 'game') {
    document.getElementById('conv-panel')?.remove();
    document.getElementById('combat-panel')?.remove();
    document.getElementById('scene-panel')?.remove();
    const dmStrip = document.getElementById('dm-strip');
    if (dmStrip) dmStrip.style.display = 'none';
    if (window.npcConvState) { window.npcConvState.active = false; window.npcConvState.npc = null; }
    if (window.combatState) window.combatState.active = false;
  } else {
    // Entering the game screen — make sure the DM strip exists; rebuild if missing.
    ensureDMStrip();
  }
}

// Recreate the static #dm-strip if a prior bug removed it from the DOM (#71)
function ensureDMStrip() {
  if (document.getElementById('dm-strip')) return;
  const log = document.getElementById('game-log');
  if (!log || !log.parentNode) return;
  const strip = document.createElement('div');
  strip.id = 'dm-strip';
  strip.className = 'dm-strip';
  strip.style.display = 'none';
  strip.innerHTML = `
    <div class="dm-strip-icon">📖 DM</div>
    <div id="dm-strip-text" class="dm-strip-text"></div>
    <button onclick="document.getElementById('dm-strip').style.display='none'" class="dm-strip-close">✕</button>`;
  // Insert just before the game-log (its original position)
  log.parentNode.insertBefore(strip, log);
}
window.ensureDMStrip = ensureDMStrip;

function startSoloMode() {
  // Skip lobby/session entirely — go straight to character creation
  // A fresh chronicle clears any prior death state (Part 3 / HARDCORE).
  try { localStorage.removeItem('ss_run_dead'); } catch (e) {}
  gameState.dead = false;
  // Fresh solo chronicle — wipe any prior run's world singletons so a new character
  // doesn't inherit the previous run's clock/reputation/romance/map/drunk state (#5).
  // finalizeCharacter() resets again once stats are locked; this clears it up front too.
  if (typeof resetWorldState === 'function') resetWorldState();
  gameState.soloMode = true;
  gameState.sessionCode = null;
  if (window.mp) { window.mp.sessionCode = null; window.mp.isHost = false; }
  buildRaceGrid();
  buildClassGrid();
  showScreen('char-creation');
}

// ─── SESSION MANAGEMENT ───────────────────
function generateCode() {
  const words = ['DOOM','FIRE','BONE','DARK','HOLY','VOID','IRON','RUIN','SOUL','FELL','GRIM','VEIL'];
  return words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(1000 + Math.random() * 9000);
}

function createSession() {
  const name = document.getElementById('session-name').value.trim() || 'The Chronicle';
  const hostName = document.getElementById('host-name').value.trim() || 'Unnamed Host';
  if (!hostName) { toast('Enter your name, stranger.', 'error'); return; }

  gameState.sessionCode = generateCode();
  gameState.sessionName = name;
  gameState.isHost = true;
  gameState.currentPlayer = 'host';

  // Store in localStorage for others to "join"
  const sessionData = {
    code: gameState.sessionCode,
    name,
    host: hostName,
    maxPlayers: parseInt(document.getElementById('max-players').value),
    players: { host: { name: hostName, ready: false, character: null } },
    log: [],
    state: 'waiting',
    chapter: 1,
    questIndex: 1
  };
  localStorage.setItem('ss_session_' + gameState.sessionCode, JSON.stringify(sessionData));
  localStorage.setItem('ss_my_session', gameState.sessionCode);
  localStorage.setItem('ss_my_role', 'host');

  showSessionWaiting();
}

function joinSession() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const playerName = document.getElementById('join-name').value.trim();

  if (!code) { toast('Enter a session code!', 'error'); return; }
  if (!playerName) { toast('Enter your name!', 'error'); return; }

  const stored = localStorage.getItem('ss_session_' + code);
  if (!stored) {
    toast('Session not found! Check the code.', 'error');
    return;
  }

  const sessionData = JSON.parse(stored);
  const playerId = 'player_' + Date.now();
  sessionData.players[playerId] = { name: playerName, ready: false, character: null };
  localStorage.setItem('ss_session_' + code, JSON.stringify(sessionData));
  localStorage.setItem('ss_my_session', code);
  localStorage.setItem('ss_my_id', playerId);
  localStorage.setItem('ss_my_role', 'player');

  gameState.sessionCode = code;
  gameState.sessionName = sessionData.name;
  gameState.isHost = false;
  gameState.currentPlayer = playerId;

  showSessionWaiting();
}

function showSessionWaiting() {
  const codeDisplay = gameState.sessionCode;
  const screenHTML = `
    <div class="screen-inner scroll-content">
      <h2 class="screen-title">⚔ The War Council Gathers</h2>
      <div class="session-banner">
        <span class="session-code-label">SESSION CODE — SHARE WITH YOUR COMPANIONS</span>
        <div class="session-code">${codeDisplay}</div>
        <div style="font-family:'Crimson Text',serif;color:var(--text-dim);font-size:0.85rem;margin-top:6px;">${gameState.sessionName}</div>
      </div>
      <div id="waiting-players" class="player-slots">
        <div class="player-slot filled"><span class="ps-icon">⚔</span><span class="ps-name">Loading...</span></div>
      </div>
      <p class="step-hint">Share the session code with your companions. Once everyone is ready, forge your characters!</p>
      <button class="btn-primary" onclick="proceedToCharCreation()" style="margin-top:20px;">⚔ Forge My Character</button>
      <button class="btn-ghost" onclick="copyCode()" style="margin-top:8px;">📋 Copy Session Code</button>
    </div>
  `;

  const waitScreen = document.createElement('div');
  waitScreen.id = 'wait-screen';
  waitScreen.className = 'screen active';
  waitScreen.innerHTML = screenHTML;
  document.getElementById('app').appendChild(waitScreen);

  document.querySelectorAll('.screen:not(#wait-screen)').forEach(s => s.classList.remove('active'));
  updateWaitingPlayers();
  // Store the legacy lobby poll handle and clear any prior one to avoid leaks (#78)
  if (window._lobbyPollInterval) clearInterval(window._lobbyPollInterval);
  window._lobbyPollInterval = setInterval(updateWaitingPlayers, 2000);
}

function updateWaitingPlayers() {
  const code = localStorage.getItem('ss_my_session');
  if (!code) return;
  const stored = localStorage.getItem('ss_session_' + code);
  if (!stored) return;
  const sessionData = JSON.parse(stored);
  const container = document.getElementById('waiting-players'); if (!container) return;
  if (!container) return;

  container.innerHTML = '';
  Object.entries(sessionData.players).forEach(([id, p]) => {
    const slot = document.createElement('div');
    slot.className = 'player-slot filled';
    slot.innerHTML = `<span class="ps-icon">${p.character ? '⚔' : '👤'}</span>
      <span class="ps-name">${p.name}</span>
      <span class="ps-status">${p.character ? '✓ Ready' : 'Waiting...'}</span>`;
    container.appendChild(slot);
  });
}

function copyCode() {
  navigator.clipboard.writeText(gameState.sessionCode || '').then(() => toast('Session code copied!'));
}

function proceedToCharCreation() {
  buildRaceGrid();
  buildClassGrid();
  showScreen('char-creation');
}

// ─── CHARACTER CREATION ───────────────────
function buildRaceGrid() {
  const grid = document.getElementById('race-grid');
  grid.innerHTML = '';
  RACES.forEach(r => {
    const card = document.createElement('div');
    card.className = 'race-card';
    card.dataset.raceId = r.id;
    card.innerHTML = `<span class="race-icon">${r.icon}</span><span class="race-name">${r.name}</span><span class="race-bonus">${r.bonus}</span>`;
    card.onclick = () => {
      const changed = gameState.selectedRace && gameState.selectedRace !== r.id;
      document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      gameState.selectedRace = r.id;
      // If the race changed AFTER stats were rolled, the old race bonuses are baked
      // into rolledStats. Force a clean re-roll so the new race's bonuses apply (#79).
      if (changed && gameState.statsRolled) {
        gameState.statsRolled = false;
        gameState.rolledStats = null;
        const rollBtn = document.getElementById('roll-btn');
        if (rollBtn) { rollBtn.style.display = 'inline-block'; rollBtn.disabled = false; rollBtn.style.opacity = '1'; }
        const next6 = document.getElementById('to-step-6-btn');
        if (next6) next6.style.display = 'none';
        toast('Race changed — roll your stats again.', 'info');
      }
    };
    grid.appendChild(card);
  });
}

function buildClassGrid() {
  const grid = document.getElementById('class-grid');
  grid.innerHTML = '';
  CLASSES.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.dataset.classId = cls.id;
    card.innerHTML = `
      <span class="class-icon">${cls.icon}</span>
      <span class="class-name">${cls.name}</span>
      <span class="class-desc">${cls.desc}</span>
      <span class="class-role">— ${cls.role} —</span>
    `;
    card.onclick = () => {
      document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      gameState.selectedClass = cls.id;
      buildSkillTrees(cls.id);
    };
    grid.appendChild(card);
  });
}

function buildSkillTrees(classId) {
  const cls = CLASSES.find(c => c.id === classId);
  if (!cls) return;
  const container = document.getElementById('skill-trees'); if (!container) return;
  container.innerHTML = '';
  cls.trees.forEach(tree => {
    const card = document.createElement('div');
    card.className = 'tree-card';
    card.innerHTML = `
      <span class="tree-name">${tree.icon} ${tree.name}</span>
      <ul class="tree-skills">
        ${tree.skills.map(s => `<li>${s}</li>`).join('')}
      </ul>
    `;
    card.onclick = () => {
      document.querySelectorAll('.tree-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      gameState.selectedTree = tree.id;
    };
    container.appendChild(card);
  });
}

function nextStep(num) {
  // Validation
  if (num === 2 && !document.getElementById('char-name').value.trim()) {
    toast('Your character needs a name!', 'error'); return;
  }
  if (num === 2 && !gameState.selectedRace) {
    toast('Choose your race!', 'error'); return;
  }
  if (num === 3 && !gameState.selectedClass) {
    toast('Choose your class!', 'error'); return;
  }
  if (num === 4 && !gameState.selectedTree) {
    toast('Choose a skill tree!', 'error'); return;
  }
  if (num === 5 && !document.getElementById('char-origin').value) {
    toast('Choose your origin!', 'error'); return;
  }

  document.querySelectorAll('.creation-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById('step-' + num);
  if (step) step.classList.add('active');
  gameState.currentStep = num;

  // When arriving at step 6, silently pre-generate a portrait in background
  if (num === 6 && !gameState.pendingPortrait && !gameState._portraitGenerating) {
    gameState._portraitGenerating = true;
    _autoGeneratePortrait().finally(() => { gameState._portraitGenerating = false; });
  }
}

function updateBackstoryHints() {
  const origin = document.getElementById('char-origin').value;
  const hint = document.getElementById('backstory-hint');
  if (!origin) { hint.classList.remove('visible'); return; }
  const data = BACKSTORY_ORIGINS[origin];
  if (!data) return;
  hint.textContent = `This origin will generate 5 personal quests: ${data.quests.map(q => q.title).join(', ')}.`;
  hint.classList.add('visible');
}

function rollStats(isReroll = false) {
  if (isReroll) {
    if (gameState.rerollUsed) { toast('You have no rerolls left!', 'error'); return; }
    gameState.rerollUsed = true;
    document.getElementById('reroll-btn').style.display = 'none';
  }

  // Disable roll button during animation and after first roll
  const rollBtn = document.getElementById('roll-btn');
  if (rollBtn) { rollBtn.disabled = true; rollBtn.style.opacity = '0.4'; }

  const stats = ['str','dex','con','int','wis','cha'];
  let rollCount = 0;

  const rollInterval = setInterval(() => {
    stats.forEach(s => {
      const el = document.getElementById('stat-' + s).querySelector('.stat-val');
      el.textContent = Math.floor(Math.random() * 18) + 1;
      el.parentElement.classList.add('rolling');
    });
    rollCount++;
    if (rollCount > 12) {
      clearInterval(rollInterval);
      // Final roll: 4d6 drop lowest, scaled
      const finalStats = {};
      stats.forEach(s => {
        const rolls = Array.from({length: 4}, () => Math.floor(Math.random() * 6) + 1);
        rolls.sort((a,b) => b - a);
        finalStats[s] = rolls.slice(0, 3).reduce((sum, v) => sum + v, 0);
        const el = document.getElementById('stat-' + s).querySelector('.stat-val');
        el.textContent = finalStats[s];
        el.parentElement.classList.remove('rolling');
      });
      gameState.rolledStats = finalStats;
      gameState.statsRolled = true;

      // Apply race bonuses
      const race = RACES.find(r => r.id === gameState.selectedRace);
      if (race && race.bonusData) {
        Object.entries(race.bonusData).forEach(([stat, bonus]) => {
          gameState.rolledStats[stat] = (gameState.rolledStats[stat] || 0) + bonus;
          const el = document.getElementById('stat-' + stat.toLowerCase())?.querySelector('.stat-val');
          if (el) el.textContent = gameState.rolledStats[stat];
        });
      }

      document.getElementById('to-step-6-btn').style.display = 'inline-block';
      if (!isReroll && !gameState.rerollUsed) {
        // Show reroll button, keep roll button disabled
        document.getElementById('reroll-btn').style.display = 'inline-block';
      }
      // Roll button stays disabled — use reroll button for second chance
      if (rollBtn) rollBtn.style.display = 'none';
      toast('Fate has spoken!');
    }
  }, 80);
}

// ─── PORTRAIT GENERATION ─────────────────────
function buildPortraitPrompt(description) {
  const race  = RACES.find(r => r.id === gameState.selectedRace);
  const cls   = CLASSES.find(c => c.id === gameState.selectedClass);
  const origin = document.getElementById('char-origin')?.value || '';
  const originLabels = {
    fallen_noble:'fallen noble with a haunted dignity', orphan_war:'war orphan hardened by loss',
    cursed_bloodline:'bearer of a dark cursed bloodline', divine_chosen:'divinely chosen with a holy mark',
    exile:'exiled wanderer with a hunted look', monster_hunter:'seasoned monster hunter, scarred and alert',
    corrupted_saint:'corrupted saint, once holy now tainted', blood_debt:'indebted soul carrying a heavy burden'
  };
  const originDesc = originLabels[origin] || 'mysterious traveler';
  const base = description?.trim()
    ? description.trim()
    : `${race?.name || 'human'} ${cls?.name || 'warrior'}, ${originDesc}`;

  return `Dark fantasy RPG character portrait, ${base}, painterly oil painting style, dramatic rim lighting, dark background, Divinity Original Sin 2 art style, highly detailed face, professional game art, no text, no watermark, 3:4 portrait`;
}

async function generateCharacterPortrait() {
  const previewArea = document.getElementById('portrait-preview-area');
  const loading = document.getElementById('portrait-loading');
  const result = document.getElementById('portrait-result');
  const stepNav = document.getElementById('portrait-step-nav');
  const acceptNav = document.getElementById('portrait-accept-nav');

  const description = document.getElementById('char-appearance')?.value || '';
  const prompt = buildPortraitPrompt(description);

  previewArea.style.display = 'block';
  loading.style.display = 'flex';
  result.style.display = 'none';
  stepNav.style.display = 'none';

  try {
    // Step 1: Submit generation job
    const genRes = await fetch('/api/portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspect_ratio: '3:4', size: '1K', format: 'jpg' })
    });
    const genData = await genRes.json();

    if (!genData.task_id) throw new Error(genData.message || 'Generation failed');

    // Gemini returns synchronously — image_url comes with the task_id
    let imgUrl;
    if (genData.task_id === 'done' && genData.image_url) {
      imgUrl = genData.image_url;
    } else {
      imgUrl = await pollPortraitResult(genData.task_id);
    }
    gameState.pendingPortrait = imgUrl;

    const img = document.getElementById('portrait-img');
    img.src = imgUrl;
    img.onload = () => {
      loading.style.display = 'none';
      result.style.display = 'block';
      acceptNav.style.display = 'flex';
    };
  } catch (err) {
    loading.style.display = 'none';
    stepNav.style.display = 'flex';
    toast('Portrait generation failed — auto-generating from your class...', 'error');
    console.error('Portrait error:', err);
    _autoGeneratePortrait();
  }
}

async function pollPortraitResult(taskId, attempts = 0) {
  if (attempts > 30) throw new Error('Timed out waiting for portrait');
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('/api/portrait/status/' + taskId);
  const data = await res.json();
  if (data.status === 'completed' && data.image_url) return data.image_url;
  if (data.status === 'failed') throw new Error('Generation failed');
  return pollPortraitResult(taskId, attempts + 1);
}

function regeneratePortrait() {
  document.getElementById('portrait-result').style.display = 'none';
  document.getElementById('portrait-accept-nav').style.display = 'none';
  document.getElementById('portrait-step-nav').style.display = 'flex';
  gameState.pendingPortrait = null;
}

function acceptPortrait() {
  document.getElementById('portrait-step-nav').style.display = 'none';
  document.getElementById('portrait-accept-nav').style.display = 'flex';
}

function skipPortrait() {
  // Auto-generate silently in background based on class/race/origin
  // Show finalize immediately, portrait will be ready by the time game starts
  document.getElementById('portrait-step-nav').style.display = 'none';
  document.getElementById('portrait-accept-nav').style.display = 'flex';
  toast('Generating your portrait in the background...', 'info');
  _autoGeneratePortrait();
}

async function _autoGeneratePortrait() {
  try {
    const prompt = buildPortraitPrompt(''); // empty = auto from race/class/origin
    const res = await fetch('/api/portrait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    let imgUrl = null;
    if (data.task_id === 'done' && data.image_url) {
      imgUrl = data.image_url;
    } else if (data.task_id) {
      imgUrl = await pollPortraitResult(data.task_id);
    }
    if (imgUrl) {
      gameState.pendingPortrait = imgUrl;
      toast('Portrait ready!', 'success');
    }
  } catch (e) {
    console.warn('Auto portrait generation failed silently:', e);
  }
}

// ─── FRESH-RUN WORLD RESET (#5) ───────────────
// worldClock / reputation / romanceState / mapDiscovered / drunkState are module
// singletons (window.X = window.X || {...}) created once at load. A second character
// in the same browser session inherits the first run's values unless we reset them.
// Call ONLY when a brand-new chronicle begins — NEVER on save-load (loads restore
// their own persisted world state). Exposed on window so combat.js's death-screen
// "New Chronicle" can wipe the dead run's world before a fresh start.
function resetWorldState() {
  gameState.world3dPositions = {};
  // World clock → 08:00, day 1 (canonical initial shape from camp.js)
  window.worldClock = { hour: 8, day: 1 };

  // Reputation → fresh faction defaults (from reputation.js)
  window.reputation = {
    city_watch:  0,
    church:      0,
    covenant:    0,
    underworld:  0,
    citizens:    0,
    party:       20, // start with some party trust
  };

  // Romance → empty fresh state (from romance.js)
  window.romanceState = {
    relationships: {},
    marriedTo: null,
    marriedToName: null,
    cheated: false,
    family: { children: 0, homeEstablished: false },
  };

  // Map discovery → only the starting location is known (from map.js: vaelthar_city).
  // Also reset each WORLD_LOCATIONS.discovered to its canonical start (only the
  // starting city begins discovered) so fog-of-war is fresh.
  window.mapDiscovered = { vaelthar_city: true };
  if (window.WORLD_LOCATIONS) {
    Object.values(window.WORLD_LOCATIONS).forEach(loc => {
      if (loc && loc.id) loc.discovered = (loc.id === 'vaelthar_city');
    });
  }
  if (window.mapState) window.mapState.currentLocation = 'vaelthar_city';

  // Drunk state → sober (from senses.js)
  window.drunkState = {
    cups: 0,
    isDrunk: false,
    severity: 0,
    soberAt: null,
    tempChaBonus: 0,
    tempDexPenalty: 0,
    tempPerPenalty: 0,
    vomited: false,
  };

  // AI story history (additions.js) → empty for a fresh narrative
  window.storyHistory = [];

  // Scene state (flags/knownFacts/history/personal-quest) — already handled by story.js
  if (typeof window.resetSceneState === 'function') window.resetSceneState();
}
window.resetWorldState = resetWorldState;

function finalizeCharacter() {
  if (!gameState.statsRolled) { toast('Roll your stats first!', 'error'); return; }

  const name = document.getElementById('char-name').value.trim();
  const origin = document.getElementById('char-origin').value;
  const secret = document.getElementById('char-secret').value.trim();
  const cls = CLASSES.find(c => c.id === gameState.selectedClass);
  const race = RACES.find(r => r.id === gameState.selectedRace);
  const originData = BACKSTORY_ORIGINS[origin];

  const character = {
    name,
    race: gameState.selectedRace,
    class: gameState.selectedClass,
    tree: gameState.selectedTree,
    origin,
    secret,
    appearance: document.getElementById('char-appearance')?.value?.trim() || '',
    portrait: gameState.pendingPortrait || null,
    stats: { ...gameState.rolledStats },
    level: 1,
    xp: 0,
    hp: cls.startingHP,
    maxHp: cls.startingHP,
    mp: cls.startingMP,
    maxMp: cls.startingMP,
    holyPoints: 0,
    hellPoints: 0,
    inventory: [...cls.inventory],
    skills: { ...cls.skills },
    proficiencies: getClassProficiencies(gameState.selectedClass),
    savingThrowProficiencies: DND_RULES.getClassSavingThrows(gameState.selectedClass),
    questRewardsClaimed: [],
    personalQuests: originData ? originData.quests.map((q, i) => ({ ...q, id: 'pq_' + i, status: 'active', chapter: 1 })) : [],
    revealChoice: null,
    skillPoints: 1,
    skillPointsTotal: 1,
    unlockedSkills: [],
    equipped: { weapon: null, armor: null, accessory: null },
  };

  gameState.character = character;

  // Fresh run: wipe ALL inherited world singletons — clock, reputation, romance, map
  // fog, drunk state, story history, AND scene flags/knownFacts/personal-quest (#5).
  resetWorldState();

  // Show backstory reveal
  buildBackstoryScroll(character, originData, race, cls);
  showScreen('backstory-reveal');
}

function buildBackstoryScroll(char, originData, race, cls) {
  const scroll = document.getElementById('backstory-scroll');
  const narrative = originData ? originData.narrative(char.name, race?.name, cls?.name) : 'A mysterious figure whose past is shrouded in shadow...';

  scroll.innerHTML = `
    <div class="backstory-name">${char.name}</div>
    <div class="backstory-subtitle">${race?.name || ''} ${cls?.name || ''} — Level 1</div>
    <div style="height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:16px 0;"></div>
    <div class="backstory-text">${narrative}</div>
    ${char.secret ? `<div class="backstory-text" style="color:var(--hell-glow);font-style:italic;border-left:2px solid var(--hell);padding-left:12px;margin-top:12px;">Dark Secret: "${char.secret}"</div>` : ''}
    <div class="personal-quests">
      <h4>☩ YOUR FIVE PURPOSES IN THIS WORLD</h4>
      ${(originData?.quests || []).map((q, i) => `
        <div class="pq-item">
          <span class="pq-num">${i + 1}.</span>
          <div>
            <div class="pq-title">${q.title}</div>
            <div class="pq-desc">${q.desc}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function setRevealChoice(choice) {
  document.querySelectorAll('.btn-reveal').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  gameState.character.revealChoice = choice;
  document.getElementById('enter-game-btn').style.display = 'block';

  const msgs = {
    truth: '✝ You choose to speak truly. Your companions will know your purpose — and respect it.',
    lie: '🐍 You weave your lie. It comes easy. Too easy. The demon at your shoulder smiles.',
    silence: '🌑 You keep your silence. Some truths are not for sharing. Yet.'
  };
  toast(msgs[choice] || '', choice === 'truth' ? 'holy' : '');

  if (choice === 'lie') {
    gameState.character.hellPoints = (gameState.character.hellPoints || 0) + 5;
  }
  if (choice === 'truth') {
    gameState.character.holyPoints = (gameState.character.holyPoints || 0) + 3;
  }
}

function enterGame() {
  if (!gameState.character.revealChoice) { toast('Choose how to present yourself to your companions!', 'error'); return; }

  // In multiplayer — go to ready room
  const inMP = !!(window.mp?.sessionCode || gameState.sessionCode);
  if (inMP) {
    const code = window.mp?.sessionCode || gameState.sessionCode;
    // Broadcast character ready to server
    if (window.mp?.socket) {
      window.mp.socket.emit('character_ready', {
        code,
        character: gameState.character,
      });
    }
    showReadyRoom();
    return;
  }

  // Solo — go straight to game
  initGameScreen();
  showScreen('game');
}

// ─── READY ROOM ───────────────────────────────
function showReadyRoom() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('ready-room')?.remove();

  const room = document.createElement('div');
  room.id = 'ready-room';
  room.className = 'screen active';
  room.innerHTML = `
    <div class="screen-inner scroll-content">
      <h2 class="screen-title">⚔ The Chronicle Awaits</h2>
      <p class="screen-subtitle" style="text-align:center">
        Your character is ready. Wait for your companions.
      </p>
      <div id="ready-player-list" style="margin:20px auto;max-width:400px"></div>
      <div style="text-align:center;margin-top:16px" id="ready-actions">
        ${window.mp?.isHost
          ? `<button class="btn-primary" id="start-chronicle-btn" onclick="hostStartChronicle()" disabled
              style="opacity:0.5;cursor:not-allowed">
              ⚔ Start the Chronicle
              <span id="ready-count" style="font-size:0.7rem;margin-left:8px">(0/? ready)</span>
            </button>
            <p class="step-hint" style="margin-top:8px">Wait for all players to be ready, then start.</p>`
          : `<p class="step-hint">Waiting for the host to start the chronicle...</p>
             <button class="btn-ghost" id="leave-ready-room-btn" onclick="leaveReadyRoom()" style="margin-top:12px">✕ Leave Session</button>`
        }
      </div>
    </div>`;
  document.getElementById('app').appendChild(room);
  updateReadyRoom();
}

// Non-host exit from the MP ready room — disconnects and clears the session (#75)
function leaveReadyRoom() {
  document.getElementById('ready-room')?.remove();
  if (typeof clearMPSession === 'function') clearMPSession();
  // Use the existing disconnect path from multiplayer.js
  if (window.mp?.socket && typeof window.mp.socket.disconnect === 'function') {
    try { window.mp.socket.disconnect(); } catch (e) {}
  }
  showScreen('splash');
}
window.leaveReadyRoom = leaveReadyRoom;

function updateReadyRoom() {
  const list = document.getElementById('ready-player-list');
  if (!list || !window.mp?.session) return;

  const players = Object.values(window.mp.session.players).filter(p => p && p.connected !== false);
  const readyCount = players.filter(p => p.ready).length;
  const total = players.length;
  const allReady = readyCount === total && total > 0;

  list.innerHTML = players.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;margin-bottom:6px;
      background:rgba(10,6,2,0.8);border:1px solid rgba(201,168,76,${p.ready ? '0.3' : '0.1'});
      border-left:3px solid ${p.ready ? '#4a9a6a' : 'rgba(201,168,76,0.2)'}">
      <span style="font-size:1.2rem">${p.ready ? '✅' : '⏳'}</span>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.8rem;color:${p.ready ? '#c9a84c' : 'var(--text-dim)'}">
          ${(window.escapeHtml || (value => String(value)))(p.name)}${p.id === window.mp.playerId ? ' (You)' : ''}
        </div>
        ${p.character ? `<div style="font-size:0.7rem;color:var(--text-dim)">
          ${p.character.race ? (window.RACES?.find(r=>r.id===p.character.race)?.name || '') : ''} 
          ${p.character.class ? (window.CLASSES?.find(c=>c.id===p.character.class)?.name || '') : ''}
        </div>` : '<div style="font-size:0.7rem;color:var(--text-dim)">Creating character...</div>'}
      </div>
      <span style="font-family:\'Cinzel\',serif;font-size:0.65rem;color:${p.ready ? '#4a9a6a' : 'var(--text-dim)'}">
        ${p.ready ? 'READY' : 'NOT READY'}
      </span>
    </div>`).join('');

  // Update start button
  const btn = document.getElementById('start-chronicle-btn');
  const countEl = document.getElementById('ready-count');
  if (btn) {
    btn.disabled = !allReady;
    btn.style.opacity = allReady ? '1' : '0.5';
    btn.style.cursor = allReady ? 'pointer' : 'not-allowed';
  }
  if (countEl) countEl.textContent = `(${readyCount}/${total} ready)`;
}

function hostStartChronicle() {
  if (!window.mp?.isHost) return;
  const players = Object.values(window.mp.session?.players || {}).filter(p => p && p.connected !== false);
  if (!players.every(p => p.ready)) { toast('Not all players are ready!', 'error'); return; }
  // Tell server to start the game for everyone
  window.mp.socket.emit('start_game', { code: window.mp.sessionCode });
}

function launchGame() {
  // Called when server says go — on all clients
  document.getElementById('ready-room')?.remove();
  initGameScreen();
  showScreen('game');
}

// ─── GAME SCREEN INIT ─────────────────────
function initGameScreen() {
  const char = gameState.character;
  if (!char) return;

  renderPlayerCard();
  renderStatsMini();
  renderSkillsMini();
  renderInventory();
  renderPartyList();
  setupQuests();
  renderQuestList();

  // When restoring a save, skip the fresh-game intro logs / quest popup (#6)
  if (!gameState._restoring) {
    // Start game log
    addLog(`☩ The Chronicle begins. Welcome, ${char.name}.`, 'system');
    addLog(`You are a ${RACES.find(r=>r.id===char.race)?.name || 'Unknown'} ${CLASSES.find(c=>c.id===char.class)?.name || 'Unknown'}, bearer of ${char.holyPoints} holy points and ${char.hellPoints} hell points.`, 'system');
    addLog(`Chapter I begins: "The Shattered Covenant." A treaty is broken. The world holds its breath.`, 'narrator');

    setTimeout(() => {
      showQuestIntro();
    }, 1200);
  }

  // Poll for party updates — clear any prior interval first to avoid leaks (#78)
  if (window._partyPollInterval) clearInterval(window._partyPollInterval);
  window._partyPollInterval = setInterval(pollPartyUpdates, 3000);
}

function setupQuests() {
  // Don't reset quests when restoring a save — keep the loaded progress (#6)
  if (gameState._restoring) return;
  gameState.activeQuests = [
    CHAPTER_1_QUESTS[0],
    ...gameState.character.personalQuests.slice(0, 2)
  ];
  gameState.questProgress = gameState.questProgress || {};
}

function getQuestById(questId) {
  return CHAPTER_1_QUESTS.find(q => q.id === questId)
    || gameState.character?.personalQuests?.find(q => q.id === questId)
    || gameState.activeQuests?.find(q => q.id === questId);
}

function activateQuest(questId, announce = true) {
  const quest = getQuestById(questId);
  if (!quest) return false;
  if (gameState.completedQuests.some(q => q.id === questId) || gameState.activeQuests.some(q => q.id === questId)) return false;
  gameState.activeQuests.push({ ...quest, status:'active' });
  if (announce) addLog(`📜 QUEST ADDED: "${quest.title}" — ${quest.desc}`, 'system');
  renderQuestList();
  return true;
}

function advanceQuest(questId, milestone, data = {}) {
  const quest = getQuestById(questId);
  if (!quest || gameState.completedQuests.some(q => q.id === questId)) return false;
  activateQuest(questId, false);
  gameState.questProgress = gameState.questProgress || {};
  const progress = gameState.questProgress[questId] || { stages:[], facts:{}, objectives:{} };
  progress.stages = progress.stages || [];
  progress.facts = progress.facts || {};
  progress.objectives = progress.objectives || {};
  const objectiveId = data.objectiveId || null;
  if ((objectiveId && progress.objectives[objectiveId]) || (!objectiveId && progress.stages.includes(milestone))) return false;
  progress.stages.push(milestone);
  if (objectiveId) {
    progress.objectives[objectiveId] = { label:milestone, eventKey:data.eventKey || '', completedAt:Date.now() };
  }
  Object.assign(progress.facts, Object.fromEntries(Object.entries(data).filter(([key]) => !['objectiveId','eventKey'].includes(key))));
  progress.updatedAt = Date.now();
  gameState.questProgress[questId] = progress;
  addLog(`📜 QUEST UPDATED: "${quest.title}" — ${milestone}`, 'system');
  renderQuestList();
  return true;
}

function completeQuest(questId, options = {}) {
  const quest = getQuestById(questId);
  if (!quest || gameState.completedQuests.some(q => q.id === questId)) return false;
  gameState.activeQuests = gameState.activeQuests.filter(q => q.id !== questId);
  gameState.completedQuests.push({ ...quest, status:'completed', completedAt:Date.now() });
  gameState.questProgress = gameState.questProgress || {};
  gameState.questProgress[questId] = { ...(gameState.questProgress[questId] || {}), completed:true, completedAt:Date.now(), rewardGranted:options.reward !== false };
  addLog(`✅ QUEST COMPLETE: "${quest.title}"`, 'holy');
  if (options.reward !== false && quest.xp) {
    grantQuestReward(questId, quest.xp);
  }
  if (options.activateNext !== false && quest.chapter === 1) {
    const next = CHAPTER_1_QUESTS.find(q => q.order === quest.order + 1);
    if (next) activateQuest(next.id, true);
  }
  renderQuestList();
  if (window.mp?.isHost) window.mpBroadcastStoryEvent?.('quest_completed', { questId, xp:quest.xp || 0 });
  return true;
}

function grantQuestReward(questId, xp) {
  const character = gameState.character;
  if (!character || !questId) return false;
  character.questRewardsClaimed = Array.isArray(character.questRewardsClaimed) ? character.questRewardsClaimed : [];
  if (character.questRewardsClaimed.includes(questId)) return false;
  character.questRewardsClaimed.push(questId);
  const amount = Math.max(0, Number(xp) || 0);
  if (amount && typeof window.grantXP === 'function') window.grantXP(amount);
  else character.xp = (character.xp || 0) + amount;
  return true;
}

window.activateQuest = activateQuest;
window.advanceQuest = advanceQuest;
window.completeQuest = completeQuest;

function recordQuestEvent(eventKey, payload = {}) {
  const engine = window.SanctumQuests;
  if (!engine || !eventKey) return { updates:[], completions:[] };
  const result = engine.reduceQuestEvent({
    activeQuestIds:(gameState.activeQuests || []).map(quest => quest.id),
    completedQuestIds:(gameState.completedQuests || []).map(quest => quest.id),
    progress:gameState.questProgress || {},
  }, eventKey);
  result.updates.forEach(update => advanceQuest(update.questId, update.label, {
    objectiveId:update.objectiveId, eventKey:update.eventKey, ...payload,
  }));
  result.completions.forEach(questId => completeQuest(questId));
  if ((result.updates.length || result.completions.length) && window.mp?.isHost) {
    window.mpBroadcastCampaignState?.(`quest:${eventKey}`);
  }
  return result;
}

window.recordQuestEvent = recordQuestEvent;
window.grantQuestReward = grantQuestReward;

function showQuestIntro() {
  const q = CHAPTER_1_QUESTS[0];
  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`📜 QUEST BEGINS: "${q.title}"`, 'system');
  addLog(q.desc, 'system');
  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
}

function renderPlayerCard() {
  const char = gameState.character;
  const cls = CLASSES.find(c => c.id === char.class);
  const race = RACES.find(r => r.id === char.race);
  const hpPct = (char.hp / char.maxHp * 100).toFixed(0);
  const mpPct = (char.mp / char.maxMp * 100).toFixed(0);
  const holyPct = Math.min(100, char.holyPoints);
  const hellPct = Math.min(100, char.hellPoints);
  const conditionLabels = {
    inspired:'Inspired — advantage on your next check', poisoned:'Poisoned — disadvantage on checks and attacks',
    frightened:'Frightened — social checks may suffer disadvantage', exhausted:'Exhausted — disadvantage on checks',
  };
  const conditionHTML = (char.conditions || []).length
    ? `<div class="character-conditions" aria-label="Active conditions">${char.conditions.map(condition =>
        `<span class="condition-chip" title="${conditionLabels[condition] || condition}">${condition.replaceAll('_',' ')}</span>`
      ).join('')}</div>` : '';

  document.getElementById('player-card').innerHTML = `
    <div class="pcm-name">${char.name}</div>
    <div class="pcm-class">${race?.name || ''} ${cls?.name || ''} — Lv.${char.level}</div>
    ${conditionHTML}
    <div class="health-bar-wrap">
      <div class="bar-label"><span>HP</span><span>${char.hp}/${char.maxHp}</span></div>
      <div class="bar-track"><div class="bar-fill hp" style="width:${hpPct}%"></div></div>
    </div>
    <div class="health-bar-wrap">
      <div class="bar-label"><span>MP</span><span>${char.mp}/${char.maxMp}</span></div>
      <div class="bar-track"><div class="bar-fill mp" style="width:${mpPct}%"></div></div>
    </div>
    <div class="health-bar-wrap">
      <div class="bar-label"><span>✝ HOLY</span><span>${char.holyPoints}</span></div>
      <div class="bar-track"><div class="bar-fill holy" style="width:${holyPct}%"></div></div>
    </div>
    <div class="health-bar-wrap">
      <div class="bar-label"><span>⛧ HELL</span><span>${char.hellPoints}</span></div>
      <div class="bar-track"><div class="bar-fill hell" style="width:${hellPct}%"></div></div>
    </div>
    <div class="health-bar-wrap">
      <div class="bar-label">
        <span>⭐ XP  Lv.${char.level}</span>
        <span id="xp-bar-label">${char.xp} / ${(window.XP_TABLE||[])[(char.level||1)] || '∞'}</span>
      </div>
      <div class="bar-track">
        <div id="xp-bar-fill" class="bar-fill xp" style="width:${(()=>{
          // Level-up at XP_TABLE[L]; bar at level L = (xp-XP_TABLE[L-1])/(XP_TABLE[L]-XP_TABLE[L-1]) (#12)
          const tbl=window.XP_TABLE||[0,100,250,450,700,1000,1400,1900,2500,3200,4000];
          const lvl=char.level||1, cur=char.xp||0;
          const prev=tbl[lvl-1]||0, next=tbl[lvl]||(prev+1000);
          const span=Math.max(1,next-prev);
          return Math.max(0,Math.min(100,Math.round((cur-prev)/span*100)));
        })()}%"></div>
      </div>
    </div>
    <div class="morality-display">
      <span class="holy-pts">✝ ${char.holyPoints}</span>
      ${char.statPoints > 0 ? `<span style="color:#8bc87a;animation:pulse 1s infinite">🎯 ${char.statPoints} pt${char.statPoints>1?'s':''}</span>` : `<span style="color:var(--text-dim);font-size:0.65rem">${char.xp} xp</span>`}
      <span class="hell-pts">⛧ ${char.hellPoints}</span>
    </div>
    <div class="morality-display" style="margin-top:4px">
      <span style="color:#c9a84c;font-family:'Cinzel',serif;font-size:0.7rem">🪙 ${char.gold || 0} gold</span>
    </div>
  `;
}
// Alias — many modules call updateCharacterPanel() (real fn is renderPlayerCard) (#76)
window.updateCharacterPanel = renderPlayerCard;
window.renderPlayerCard = renderPlayerCard;

function renderStatsMini() {
  const stats = gameState.character?.stats;
  if (!stats) return;
  const statNames = ['STR','DEX','CON','INT','WIS','CHA'];
  const statKeys = ['str','dex','con','int','wis','cha'];
  const container = document.getElementById('char-stats-panel'); if (!container) return;
  container.innerHTML = statKeys.map((key, i) => {
    const val = stats[key] || 10;
    const mod = Math.floor((val - 10) / 2);
    return `<div class="stat-mini"><span class="sm-name">${statNames[i]}</span><span class="sm-val">${val}</span><span class="sm-mod">${mod >= 0 ? '+' : ''}${mod}</span></div>`;
  }).join('');
}

function renderSkillsMini() {
  const char = gameState.character;
  if (!char) return;
  const cls = CLASSES.find(c => c.id === char.class);
  if (!cls) return;
  const container = document.getElementById('skills-panel'); if (!container) return;
  if (!container) return;
  const skills = cls.skills;
  container.innerHTML = Object.entries(skills).map(([name, val]) =>
    `<div class="skill-entry"><span class="se-name">${name.charAt(0).toUpperCase() + name.slice(1)}</span><span class="se-val">${val}</span></div>`
  ).join('');
}

function renderInventory() {
  const char = gameState.character;
  if (!char) return;
  const container = document.getElementById('inventory-panel'); if (!container) return;
  const icons = { 'Sword': '⚔', 'Mace': '🔨', 'Staff': '🔮', 'Bow': '🏹', 'Daggers': '🗡', 'Armor': '🛡', 'Robe': '🧥', 'Cloak': '🧥', 'Potion': '🧪', 'Water': '💧', 'Book': '📜', 'Scripture': '📖', 'Kit': '💊', 'Candle': '🕯', 'Crystal': '💎', 'Quiver': '🏹', 'Lockpick': '🔑', 'Salve': '🧪', 'Bandage': '🩹', 'Ration': '🥩', 'Draught': '⚗️', 'Essence': '💧', 'Antidote': '🌿', 'Smoke': '💨', 'Draft': '🍺', 'Oil': '🌑' };
  const consumableKeywords = ['potion', 'salve', 'bandage', 'ration', 'draught', 'essence', 'antidote', 'smoke bomb', 'draft', 'oil', 'holy water', 'healing kit', 'vial', 'mending', 'focus', 'might', 'shadow'];
  container.innerHTML = char.inventory.map(item => {
    const icon = Object.entries(icons).find(([k]) => item.toLowerCase().includes(k.toLowerCase()))?.[1] || '📦';
    const isConsumable = consumableKeywords.some(k => item.toLowerCase().includes(k));
    const useBtn = isConsumable ? `<button class="inv-use-btn" onclick="useConsumable('${item.replace(/'/g,"\\'")}')">USE</button>` : '';
    return `<div class="inv-item">${useBtn}<span class="inv-icon">${icon}</span><span class="inv-name">${item}</span></div>`;
  }).join('') || '<div style="color:var(--text-dim);font-size:0.85rem;padding:8px">Nothing in your pack.</div>';
}
window.renderInventory = renderInventory;

function renderPartyList() {
  const container = document.getElementById('party-list'); if (!container) return;

  // Multiplayer: show all connected session players
  // Solo: show only the player themselves
  const mpPlayers = window.mp?.session?.players ? Object.values(window.mp.session.players) : [];
  const isMP = mpPlayers.length > 1;

  let members = [];
  if (isMP) {
    members = mpPlayers.map(p => ({
      name: p.name,
      class: p.character?.class || 'warrior',
      hp: p.hp ?? p.character?.hp ?? 100,
      maxHp: p.maxHp ?? p.character?.maxHp ?? 100,
      self: p.id === window.mp?.playerId,
      connected: p.connected !== false,
    }));
  } else {
    const char = gameState.character;
    if (char) members = [{ name: char.name, class: char.class, hp: char.hp, maxHp: char.maxHp, self: true, connected: true }];
  }

  container.innerHTML = members.map(p => {
    const pct = Math.max(0, (p.hp / p.maxHp * 100)).toFixed(0);
    const cls = CLASSES.find(c => c.id === p.class);
    const hpColor = pct > 60 ? '#4a9a6a' : pct > 30 ? '#c9a84c' : '#c0392b';
    return `<div class="party-member ${!p.connected ? 'pm-disconnected' : ''}">
      <div class="pm-name">
        <span>${cls?.icon || '⚔'} ${p.name}${p.self ? ' (You)' : ''}</span>
        <span style="color:var(--text-dim);font-size:0.7rem">${p.hp}/${p.maxHp}</span>
      </div>
      <div class="pm-hp-bar"><div class="pm-hp-fill" style="width:${pct}%;background:${hpColor}"></div></div>
    </div>`;
  }).join('');
}

function updateQuestCounter() {
  // Keep the "Quest N/20" header in sync with gameState (#81)
  const el = document.getElementById('quest-counter');
  if (!el) return;
  const done = (gameState.completedQuests || []).length;
  const total = (typeof CHAPTER_1_QUESTS !== 'undefined' ? CHAPTER_1_QUESTS.length : 20) || 20;
  const current = Math.min(total, done + 1);
  el.textContent = `Quest ${current}/${total}`;
}
window.updateQuestCounter = updateQuestCounter;

function renderQuestList() {
  updateQuestCounter();
  const container = document.getElementById('quest-list'); if (!container) return;
  const quests = [...(gameState.activeQuests || [])].slice(0, 4);
  container.innerHTML = quests.map(q => {
    const stages = gameState.questProgress?.[q.id]?.stages || [];
    const current = stages[stages.length - 1];
    return `
    <div class="quest-item ${q.id?.startsWith('pq') ? 'personal' : ''}">
      <span class="qi-title">${q.title}</span>
      <span class="qi-desc">${(current || q.desc || '').substring(0, 72)}${(current || q.desc || '').length > 72 ? '...' : ''}</span>
    </div>
  `; }).join('') || '<div style="color:var(--text-dim);font-size:0.85rem;font-style:italic">No active quests.</div>';
}
window.renderQuestList = renderQuestList;

// ─── GAME LOG ─────────────────────────────
function addLog(text, type = 'system', playerName = null) {
  const log = document.getElementById('game-log');
  if (!log) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  if (playerName) {
    // Escape user-controlled player name AND text before innerHTML (#60)
    const esc = window.escapeHtml || (s => s);
    entry.innerHTML = `<span class="log-player">${esc(String(playerName))}</span>${esc(String(text))}`;
  } else {
    entry.textContent = text;
  }

  // Always append at the very end of the log (after any scene panel)
  log.appendChild(entry);

  // Only auto-scroll if the player isn't actively typing
  requestAnimationFrame(() => {
    const input = document.getElementById('action-input');
    const convInput = document.getElementById('conv-input');
    const userIsTyping = (document.activeElement === input) || (document.activeElement === convInput);
    if (!userIsTyping) {
      log.scrollTop = log.scrollHeight;
    }
  });

  gameState.log.push({ text, type, playerName, time: Date.now() });

  // Feed dice rolls to the live history panel
  if (type === 'dice') addRollToHistory(text);
}

// ─── ACTION SUBMISSION ────────────────────
// ─── ACTION CLASSIFICATION ────────────────────
const DND_RULES = window.SanctumRules;
if (!DND_RULES) throw new Error('SanctumRules must load before game.js');
const DND_SKILLS = DND_RULES.SKILLS;
const CLASS_PROFICIENCIES = DND_RULES.CLASS_PROFICIENCIES;
window.CLASS_PROFICIENCIES = CLASS_PROFICIENCIES;

function getClassProficiencies(classId) {
  return DND_RULES.getClassProficiencies(classId);
}

function inferActionSkill(text) {
  return DND_RULES.inferSkill(text);
}

function inferActionDC(text, skill) {
  return DND_RULES.inferDC(text, skill);
}

function rollActionCheck(text, options = {}) {
  const char = options.character || gameState.character;
  const check = DND_RULES.rollCheck({
    ...options, text, character:char, drunk:window.drunkState?.isDrunk,
  });
  if (check.consumeCondition && Array.isArray(char?.conditions)) {
    char.conditions = char.conditions.filter(condition => condition !== check.consumeCondition);
  }
  return check;
}

function logActionCheck(check, dc = check.dc) {
  const skillLabel = (check.skill || check.ability).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const rolled = check.rolls.length > 1 ? `[${check.rolls.join(', ')} → ${check.roll}]` : `[${check.roll}]`;
  const abilityPart = `${check.abilityMod >= 0 ? '+' : '-'} ${Math.abs(check.abilityMod)}`;
  const prof = check.proficiency ? ` + ${check.proficiency} proficiency` : '';
  const mode = check.mode === 'normal' ? '' : ` (${check.mode})`;
  addLog(`🎲 ${skillLabel} (${check.ability.toUpperCase()})${mode} DC${dc}: ${rolled} ${abilityPart}${prof} = ${check.total} — ${check.crit ? '✨ CRITICAL!' : check.fumble ? '💀 FUMBLE!' : check.success ? '✅ Success!' : '❌ Failure!'}`, 'dice');
  if (window.AudioEngine) AudioEngine.sfx?.dice();
}

const OFFLINE_CLUES = {
  vaelthar_city: 'Ash has been swept away from one section of the signing hall. Beneath it, boot marks lead toward the Temple Quarter.',
  temple_quarter: 'A candle bears Elder Varek\'s private seal, pressed into the wax before it cooled.',
  thornwood_gate: 'The tracks avoid every Watch patrol and converge on the old forest passage.',
  thornwood_passage: 'The broken branches were bent from the far side: something was herding travelers toward Vaelthar.',
  monastery_aldric: 'Fresh mortar hides a seam in the floor. Air moves beneath the stones.',
  merchant_road: 'The wreckage was searched for documents, not coin; a black wax flake remains under a wheel.',
  fortress_harren: 'The heraldry has been deliberately scored away, but the old oath-mark is still visible beneath it.',
  church_archive: 'A catalogue number has been cut from the ledger, leaving the indentation of the missing entry.',
};

function rememberActionFact(key, value) {
  window.sceneState = window.sceneState || { flags:{}, knownFacts:{} };
  window.sceneState.flags = window.sceneState.flags || {};
  window.sceneState.knownFacts = window.sceneState.knownFacts || {};
  window.sceneState.flags[key] = true;
  window.sceneState.knownFacts[key] = value;
}

function applyActionConsequences(text, check, character = gameState.character) {
  const char = character;
  const locId = window.mapState?.currentLocation || 'vaelthar_city';
  const locName = window.WORLD_LOCATIONS?.[locId]?.name || 'this place';
  const skill = check.skill;
  const factKey = `action_${skill || 'free'}_${locId}`;
  let narration;

  if (check.success) {
    if (['investigation','perception'].includes(skill)) {
      const clue = OFFLINE_CLUES[locId] || `A small inconsistency in ${locName} reveals that someone passed through recently and tried to hide it.`;
      const repeated = !!window.sceneState?.flags?.[factKey];
      rememberActionFact(factKey, clue);
      narration = repeated ? `You search the same ground carefully. The evidence still supports your earlier conclusion: ${clue}` : `Your search pays off. ${clue}`;
      if (!repeated && typeof window.advanceQuest === 'function') window.advanceQuest('c1q1', `Clue found at ${locName}`);
    } else if (skill === 'stealth') {
      rememberActionFact(`hidden_${locId}`, `${char.name} established a concealed position in ${locName}.`);
      narration = `You find the blind spots in the patrols and disappear into them. Until you act openly, observers in ${locName} do not know exactly where you are.`;
    } else if (['athletics','acrobatics'].includes(skill)) {
      rememberActionFact(`position_${locId}`, `${char.name} overcame a physical obstacle in ${locName}.`);
      narration = `You clear the obstacle and secure a better position. The route behind you remains usable.`;
    } else if (['persuasion','deception','intimidation','performance'].includes(skill)) {
      rememberActionFact(`social_leverage_${locId}`, `${char.name} gained social leverage through ${skill}.`);
      if (window.reputation && skill === 'persuasion') window.reputation.citizens = (window.reputation.citizens || 0) + 1;
      narration = skill === 'deception' ? `The lie holds. For now, the listener acts on the version of events you gave them.` : `Your words change the balance of the conversation. You gain leverage that can be used in the next exchange.`;
    } else if (skill === 'sleight_of_hand') {
      rememberActionFact(`sleight_success_${locId}`, `${char.name} manipulated an object without being noticed.`);
      narration = `Your hand moves cleanly and returns before anyone notices. The object is now where you intended it to be.`;
    } else if (['arcana','religion','history','nature','survival','insight','medicine','animal_handling'].includes(skill)) {
      const fact = `Your ${skill.replaceAll('_',' ')} training reveals a useful truth about ${locName}.`;
      rememberActionFact(factKey, fact);
      narration = `${fact} The discovery is recorded and can affect later choices.`;
    } else {
      rememberActionFact(`last_action_${locId}`, text);
      narration = `You carry out the action without immediate resistance. The situation in ${locName} changes accordingly.`;
    }
  } else {
    if (['athletics','acrobatics'].includes(skill)) {
      const damage = check.fumble ? 6 : 3;
      char.hp = Math.max(1, char.hp - damage);
      narration = `You lose your footing and take ${damage} damage. The obstacle remains between you and your goal.`;
    } else if (['stealth','sleight_of_hand','deception'].includes(skill)) {
      rememberActionFact(`guards_alerted_${locId}`, `${char.name}'s failed ${skill.replaceAll('_',' ')} attempt attracted attention.`);
      narration = `Someone notices the attempt. The area is now alert, and repeating the same approach will be harder.`;
    } else if (['persuasion','intimidation','performance'].includes(skill)) {
      if (window.reputation) window.reputation.citizens = (window.reputation.citizens || 0) - 1;
      narration = `Your approach hardens the listener against you. You lose social ground and will need a different argument.`;
    } else if (['investigation','perception','insight'].includes(skill)) {
      rememberActionFact(`searched_${locId}`, `${char.name} searched but did not establish a reliable conclusion.`);
      narration = `You find several possibilities but no reliable conclusion. Acting on the wrong one would create a new risk.`;
    } else {
      narration = `The attempt fails and costs you time. The obstacle remains, and the people nearby have seen what you tried.`;
    }
  }

  if (check.crit) char.conditions = Array.from(new Set([...(char.conditions || []), 'inspired']));
  if (check.fumble && !['athletics','acrobatics'].includes(skill)) char.hellPoints = (char.hellPoints || 0) + 1;
  if (char === gameState.character && typeof renderPlayerCard === 'function') renderPlayerCard();
  return narration;
}

async function resolveActionRequest(text, options = {}) {
  const inMP = !!window.mp?.sessionCode;
  if (inMP && !options.authoritative) {
    if (!window.mp.isHost && typeof window.mpRequestAction === 'function') {
      return window.mpRequestAction(text, options);
    }
    options = { ...options, authoritative:true };
  }
  const actor = options.character || gameState.character;
  const skill = options.skill || inferActionSkill(text);
  if (!skill && !options.ability && !options.dc) {
    const locId = window.mapState?.currentLocation || 'vaelthar_city';
    const locName = window.WORLD_LOCATIONS?.[locId]?.name || 'the area';
    rememberActionFact(`last_free_action_${locId}`, text);
    const movement = /\b(go|walk|move|approach|enter|leave|cross|follow)\b/i.test(text);
    addLog(movement
      ? `You move through ${locName} with purpose. Your position changes, but reaching another named location still requires the World Map.`
      : `You do it. The action is now part of the scene, and nearby characters can react to it.`, 'narrator');
    const freeResult = { success:true, free:true, text };
    if (inMP && window.mp.isHost) window.mpBroadcastCampaignState?.('free_action');
    return freeResult;
  }
  const check = rollActionCheck(text, { ...options, skill, character:actor });
  logActionCheck(check, check.dc);
  const narration = applyActionConsequences(text, check, actor);
  addLog(narration, check.success ? 'narrator' : 'combat');
  if (inMP && window.mp.isHost) {
    window.mpSyncHostCharacter?.(actor, options.actorId || window.mp.playerId);
    window.mpBroadcastCampaignState?.('action_check');
  }
  return check;
}

window.DNDRules = { skills:DND_SKILLS, inferSkill:inferActionSkill, rollCheck:rollActionCheck, logCheck:logActionCheck };
window.resolveActionRequest = resolveActionRequest;

function classifyAction(text) {
  const t = text.toLowerCase();

  // Pure speech — no roll needed.
  // Require a real speech verb phrase, OR text actually wrapped in quotes —
  // never a bare apostrophe/quote (so "I don't open it, I smash it" isn't "speech") (#50)
  const speechPhrases = ['say ', 'tell ', 'ask ', 'talk to ', 'speak to ', 'shout ', 'whisper ', 'yell ', 'call out', 'greet ', 'introduce ', 'announce '];
  const isQuotedSpeech = /["“][^"”]+["”]/.test(text) || /\bi (say|tell|ask|shout|whisper|yell)\b/.test(t);
  if (isQuotedSpeech || speechPhrases.some(p => t.startsWith(p) || t.includes(' ' + p))) return 'speech';

  // Combat — handled by checkAutoAttack
  const combatWords = ['attack', 'stab', 'strike', 'punch', 'hit', 'fight', 'kill', 'shoot', 'slash', 'draw sword', 'draw weapon'];
  if (combatWords.some(w => new RegExp('\\b' + w.replace(/\s+/g,'\\s+') + '\\b', 'i').test(t))) return 'combat';

  // Charisma actions — CHA roll
  const chaActions = ['flirt', 'seduce', 'romance', 'charm', 'persuade', 'convince', 'beg', 'plead', 'negotiate', 'bribe', 'threaten to', 'intimidate', 'bluff', 'lie to', 'deceive'];
  if (chaActions.some(w => t.includes(w))) return 'charisma';

  // Strength actions — STR roll
  const strActions = ['lift', 'break', 'force', 'kick down', 'smash', 'shove', 'push', 'pull', 'grapple', 'restrain', 'carry', 'climb', 'jump over'];
  if (strActions.some(w => t.includes(w))) return 'strength';

  // Dexterity actions — DEX roll
  const dexActions = ['sneak', 'hide', 'steal', 'pickpocket', 'pick the lock', 'pick lock', 'dodge', 'escape', 'slip past', 'creep', 'tiptoe', 'vanish', 'disappear into', 'follow without'];
  if (dexActions.some(w => t.includes(w))) return 'dexterity';

  // Intelligence actions — INT roll
  const intActions = ['decipher', 'decode', 'analyze', 'examine the', 'study the', 'research', 'recall', 'identify the', 'read the', 'translate', 'figure out', 'solve'];
  if (intActions.some(w => t.includes(w))) return 'intelligence';

  // Wisdom actions — WIS roll
  const wisActions = ['sense', 'detect', 'notice', 'feel', 'intuit', 'meditate', 'pray', 'discern', 'read the room', 'judge', 'assess'];
  if (wisActions.some(w => t.includes(w))) return 'wisdom';

  // Default to no roll — narrative action
  return 'free';
}

// ─── DIVINE INVOCATION HANDLER ────────────────────────────
// Called whenever the player invokes the name of Jesus Christ,
// regardless of context (prayer, declaration, mid-combat, etc.)
async function handleDivineInvocation(text) {
  const char = gameState.character;
  if (!char) return;

  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const cls = CLASSES?.find(c => c.id === char.class);
  const race = RACES?.find(r => r.id === char.race);
  const inCombat = window.combatState?.active;

  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`☩ ${char.name} invokes the name of Jesus Christ.`, 'holy');

  // WIS roll — determines the degree of divine response
  const wisVal = char.stats?.wis || 10;
  const wisMod = Math.floor((wisVal - 10) / 2);
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + wisMod;
  const isCrit = roll === 20;
  const isFumble = roll === 1;
  const isHealing = /heal|health|restore|hp|wound|hurt|recover|strength/i.test(text);

  addLog(`🎲 WIS check DC11: [${roll}] + ${wisMod >= 0 ? '+' : ''}${wisMod} = ${total} — ${isCrit ? '✨ CRITICAL!' : isFumble ? '💀 FUMBLE!' : total >= 11 ? '✅ Success!' : '❌ Failure!'}`, 'dice');

  // ── Mechanical HP effect ──
  let healAmt = 0;
  if (isHealing || isCrit || total >= 11) {
    if (isCrit) {
      // Critical — full restore
      healAmt = char.maxHp - char.hp;
      char.hp = char.maxHp;
    } else if (total >= 11) {
      // Success — heal 30% of max
      healAmt = Math.floor(char.maxHp * 0.3);
      char.hp = Math.min(char.maxHp, char.hp + healAmt);
    }
    // If specifically asking to restore to full with a success or crit, do full
    if (/restore.*to.*110|restore.*full|to.*full.*health|to.*max/i.test(text) && total >= 11) {
      healAmt = char.maxHp - char.hp;
      char.hp = char.maxHp;
    }
  }

  // Sync to combat combatant if in combat
  if (inCombat && window.combatState?.combatants?.player) {
    window.combatState.combatants.player.hp = char.hp;
    window.combatState.combatants.player.maxHp = char.maxHp;
  }

  // ── Always update UI ──
  if (typeof renderPlayerCard === 'function') renderPlayerCard();
  if (typeof updateCharacterPanel === 'function') updateCharacterPanel();
  if (inCombat && typeof updateCombatUI === 'function') updateCombatUI();

  // ── DM narration ──
  const divSys = `You are the DM of "Sanctum & Shadow". ${typeof TRUE_DIVINE_WORLD_LORE !== 'undefined' ? TRUE_DIVINE_WORLD_LORE : ''}

${char.name} (${race?.name || ''} ${cls?.name || ''}) has just invoked the name of Jesus Christ in ${loc?.name || 'Vaelthar'}.
Roll result: ${isCrit ? 'CRITICAL — something extraordinary and undeniable happens' : total >= 11 ? 'SUCCESS — something real and physical shifts' : isFumble ? 'FUMBLE — the prayer is genuine but something dark interferes' : 'FAILURE — the prayer is heard but the answer is silence for now'}.
${healAmt > 0 ? `${char.name} has been healed ${healAmt} HP, now at ${char.hp}/${char.maxHp}. Narrate this restoration as a real physical event, not a spell.` : ''}
${inCombat ? 'This is mid-combat. The fighting pauses for one breath.' : ''}
${char.class === 'paladin' ? `${char.name} is a Paladin — this name is their entire life.` : ''}

Write 3-4 complete sentences. Quiet, real, not theatrical. NEVER use markdown.`;

  const narration = await callClaude(divSys, [{ role: 'user', content: `Player: "${text}"` }], 300);
  if (narration) {
    const clean = narration.replace(/^#+\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
    addLog(clean, 'holy');
  } else {
    const fallbacks = {
      crit: `The name of Jesus Christ falls on the room like a stone into still water. Every sound stops — not from fear, not from surprise, but from something that has no name in the language of this age. ${char.name}'s wounds close. The light in the space changes, briefly. Then the world resumes, and nothing is quite the same as it was before.`,
      success: `Something shifts when ${char.name} speaks that name. It is not loud. It does not announce itself. But everyone present feels it — a weight, a stillness, a sense of something paying attention. ${healAmt > 0 ? `${char.name} stands straighter. The pain is less than it was.` : 'The prayer was heard.'}`,
      failure: `The prayer is genuine. The silence that follows is not empty — it is the silence of being heard, not yet answered. Something will come from this. Not yet.`,
    };
    addLog(isCrit ? fallbacks.crit : total >= 11 ? fallbacks.success : fallbacks.failure, 'holy');
  }

  if (healAmt > 0) {
    addLog(`☩ ${healAmt} HP restored. ${char.hp}/${char.maxHp}. ${isCrit ? 'Full restoration.' : ''}`, 'holy');
  }

  grantHolyPoints(isCrit ? 5 : total >= 11 ? 3 : 1);
}

async function submitAction() {
  const input = document.getElementById('action-input');
  const text = input.value.trim();
  if (!text) return;

  const charName = gameState.character?.name || 'Unknown';
  addLog(`${charName}: "${text}"`, 'action', charName);
  input.value = '';

  // ── Rest / Camp intercept — before anything else ──
  const tLower = text.toLowerCase().trim();
  // Word-boundary match so "forest"/"arrest"/"restore" no longer trigger camp (#49)
  const isRestWord = /\b(rest|camp|sleep)\b/.test(tLower)
    || ['make camp', 'short rest', 'long rest', 'set up camp', 'take a rest'].some(w => tLower === w || tLower.startsWith(w + ' '));
  if (isRestWord) {
    if (typeof openCampPanel === 'function') {
      openCampPanel();
    } else {
      const char = gameState.character;
      if (!char) return;
      const roll = Math.floor(Math.random() * 20) + 1;
      addLog(`🎲 You roll: [${roll}] — ${roll >= 10 ? 'Success!' : 'Failure!'}`, 'dice');
      if (roll >= 10) {
        const heal = Math.floor(char.maxHp * 0.3);
        char.hp = Math.min(char.maxHp, char.hp + heal);
        addLog(`📖 You find a sheltered spot and rest. ${heal} HP recovered (now ${char.hp}/${char.maxHp}).`, 'narrator');
        if (typeof renderPlayerCard === 'function') renderPlayerCard();
        if (typeof updateCharacterPanel === 'function') updateCharacterPanel();
        if (typeof advanceTime === 'function') advanceTime(1);
      } else {
        addLog(`📖 You try to rest but the city's noise and your own tension keep pulling you back. No recovery.`, 'narrator');
      }
    }
    return;
  }

  // ── Use item intercept ──
  // "use healing salve", "drink potion", "eat rations", "use [item name]"
  const useMatch = tLower.match(/^(?:use|drink|eat|apply|consume)\s+(.+)$/);
  if (useMatch) {
    const itemQuery = useMatch[1].trim();
    const char = gameState.character;
    if (char?.inventory) {
      // Find matching item in inventory (fuzzy)
      const match = char.inventory.find(i => i.toLowerCase().includes(itemQuery) || itemQuery.includes(i.toLowerCase().split(' ')[0]));
      if (match) {
        if (typeof useConsumable === 'function') {
          useConsumable(match);
        } else {
          addLog(`You use ${match}.`, 'system');
        }
        return;
      } else {
        addLog(`You don't have "${itemQuery}" in your pack.`, 'system');
        return;
      }
    }
  }

  // ── Shop intercept ──
  // Word-boundary match so "bishop"/"counsellor" no longer open the shop (#49)
  const isShopWord = /\b(shop|buy|sell|merchant)\b/.test(tLower)
    || ['open shop', 'visit shop', 'browse wares'].some(w => tLower === w || tLower.startsWith(w));
  if (isShopWord) {
    if (typeof openShop === 'function') {
      openShop();
    } else {
      addLog(`There is no merchant nearby to trade with.`, 'system');
    }
    return;
  }

  // ── If conversation is active, ALL text goes to the conv panel — no classification ──
  // This prevents "talk to the scribe" inside a long message from being misread as
  // a new NPC lookup, and prevents any attack-word false positives from classifyAction
  if (window.npcConvState?.active) {
    const convInput = document.getElementById('conv-input');
    if (convInput) {
      convInput.value = text;
      if (typeof submitConvInput === 'function') submitConvInput();
    }
    return;
  }

  // ── Jesus Christ invocation — intercept before classification ──
  if (typeof isJesusInvocation === 'function' && isJesusInvocation(text)) {
    await handleDivineInvocation(text);
    return;
  }

  // ── Combat check FIRST ──
  if (!combatState.active && typeof checkAutoAttack === 'function') {
    if (checkAutoAttack(text)) return;
  }

  // Contested actions use the same visible d20 contest promised by the rules.
  if (detectContested(text)) {
    const target = text.match(/(?:against|at|past|from|to)\s+([\w'-]+(?:\s+[\w'-]+){0,2})/i)?.[1] || 'Opponent';
    showContestedRoll(text, target);
    return;
  }

  analyzeActionMorality(text.toLowerCase());

  const actionType = classifyAction(text);

  // Speech — pass to NPC dialogue if target mentioned, else narrate freely
  if (actionType === 'speech') {
    // Extract only the NPC name, stopping before conversational prepositions so
    // "talk to Captain Rhael about the Scribe" does not create an NPC literally
    // named "Captain Rhael about".
    const talkMatch = text.match(/(?:say to|tell|ask|talk to|speak to|shout at|whisper to|call out to)\s+([\w'-]+(?:\s+[\w'-]+){0,2}?)(?=\s+(?:about|regarding|concerning|for|on|because|and then|to ask)\b|[,.!?]|$)/i);
    const npcName = talkMatch?.[1]?.trim();
    if (npcName && typeof startNPCConversation === 'function') {
      startNPCConversation(npcName, text);
    } else {
      addLog(`*${text}*`, 'narrator');
    }
    return;
  }

  // Every non-conversation/non-combat action now flows through one rules engine.
  await resolveActionRequest(text);
}

function detectContested(text) {
  // Check if action targets a named party member in multiplayer
  const lower = text.toLowerCase();
  const contestVerbs = ['grab', 'push', 'shove', 'wrestle', 'tie', 'wrap', 'piss', 'seduce', 'deceive', 'sneak past', 'tackle', 'disarm', 'steal from', 'trip', 'grapple'];

  if (!contestVerbs.some(v => lower.includes(v))) return false;

  // In multiplayer: check if target is a real party member name
  const mpPlayers = window.mp?.session?.players ? Object.values(window.mp.session.players) : [];
  if (mpPlayers.length > 1) {
    const otherPlayers = mpPlayers.filter(p => p.id !== window.mp?.playerId);
    return otherPlayers.some(p => lower.includes(p.name.toLowerCase()) || lower.includes(p.character?.name?.toLowerCase() || ''));
  }

  // In solo: generic targets
  const soloTargets = ['party', 'companion', 'ally', 'enemy', 'bandit', 'guard', 'them', 'him', 'her', 'bresker'];
  return soloTargets.some(n => lower.includes(n));
}

// ─── PARTY STRIFE TRACKING ────────────────
// Tracks inter-party contested actions — NPCs read this and react
window._partyStrife = window._partyStrife || {
  count: 0,       // total contested actions between players
  log: [],        // last 5 incidents: { actor, target, action, actorWon, roll1, roll2 }
};

function recordPartyStrife(actor, target, action, actorWon, roll1, roll2) {
  window._partyStrife.count++;
  window._partyStrife.log.unshift({ actor, target, action, actorWon, roll1, roll2, time: Date.now() });
  if (window._partyStrife.log.length > 5) window._partyStrife.log.length = 5;

  // Write to scene flags so it persists in saves and gets injected into NPC prompts
  if (window.setFlag) {
    window.setFlag('party_strife_count', window._partyStrife.count);
    window.setFlag('party_strife_last', `${actor} tried to ${action} ${target} — ${actorWon ? actor : target} won [${roll1} vs ${roll2}]`);
    if (window._partyStrife.count >= 3) window.setFlag('party_tension_high', true);
    if (window._partyStrife.count >= 6) window.setFlag('party_tension_severe', true);
  }
}

function getPartyStrifeContext() {
  const s = window._partyStrife;
  if (!s || s.count === 0) return '';
  const recent = s.log.slice(0, 3).map(e =>
    `- ${e.actor} attempted to ${e.action} ${e.target} — ${e.actorWon ? e.actor : e.target} won the roll [${e.roll1} vs ${e.roll2}]`
  ).join('\n');
  const tension = s.count >= 6 ? 'SEVERE' : s.count >= 3 ? 'HIGH' : 'PRESENT';
  return '\nPARTY STRIFE (' + tension + ' — ' + s.count + ' incidents):\n' + recent + '\nNPCs who know this party may reference the tension, distrust, or specific incidents. Sister Mourne and observant NPCs should notice and potentially exploit this.';
}
window.getPartyStrifeContext = getPartyStrifeContext;

function showContestedRoll(actionText, targetName) {
  const char = gameState.character;
  const p1Name = char?.name || 'You';

  // Detect real MP target
  const mpPlayers = window.mp?.session?.players ? Object.values(window.mp.session.players) : [];
  const isRealMP = mpPlayers.length > 1;
  let targetPlayer = null;
  if (isRealMP && targetName) {
    const lower = targetName.toLowerCase();
    targetPlayer = mpPlayers.find(p =>
      p.id !== window.mp?.playerId &&
      (p.name.toLowerCase().includes(lower) || (p.character?.name || '').toLowerCase().includes(lower))
    );
  }

  pendingContestData = {
    actionText,
    targetName: targetPlayer?.name || targetName || 'Opponent',
    targetPlayerId: targetPlayer?.id || null,
    p1Name,
    p1Roll: null,
    p2Roll: null,
    isRealMP: !!targetPlayer,
  };

  // Update overlay UI
  document.getElementById('contest-title').textContent = '⚔ Contested Roll!';
  document.getElementById('c1-name').textContent = p1Name;
  document.getElementById('c2-name').textContent = pendingContestData.targetName;
  document.getElementById('c1-die').textContent = '?';
  document.getElementById('c2-die').textContent = '?';
  document.getElementById('c1-die').classList.remove('rolled');
  document.getElementById('c2-die').classList.remove('rolled');
  document.getElementById('contest-result').classList.add('hidden');
  document.getElementById('contest-result').textContent = '';
  document.getElementById('c1-roll-btn').disabled = false;

  if (targetPlayer) {
    // Real MP contest — target player must roll on their screen
    document.getElementById('c2-roll-btn').disabled = true;
    document.getElementById('c2-die').textContent = '⏳';
    addLog(`⚔ CONTESTED: "${actionText}" — ${p1Name} vs ${pendingContestData.targetName}! Both players must roll!`, 'system');
    // Notify the target player via socket
    if (window.mpBroadcastStoryEvent) {
      window.mpBroadcastStoryEvent('contest_challenge', {
        actionText,
        challenger: p1Name,
        targetPlayerId: targetPlayer.id,
      });
    }
  } else {
    // Solo or NPC target — opponent auto-rolls after a dramatic pause
    document.getElementById('c2-roll-btn').disabled = true;
    addLog(`⚔ CONTESTED: "${actionText}" — both parties roll d20!`, 'system');
    setTimeout(() => {
      const npcRoll = Math.floor(Math.random() * 20) + 1;
      pendingContestData.p2Roll = npcRoll;
      const die2 = document.getElementById('c2-die');
      let count = 0;
      const anim = setInterval(() => {
        die2.textContent = Math.floor(Math.random() * 20) + 1;
        if (++count >= 10) {
          clearInterval(anim);
          die2.textContent = npcRoll;
          die2.classList.add('rolled');
          addLog(`🎲 ${pendingContestData.targetName} rolls: [${npcRoll}]${npcRoll===20?' — CRITICAL!':npcRoll===1?' — FUMBLE!':''}`, 'dice');
          if (pendingContestData.p1Roll !== null) setTimeout(resolveContest, 600);
        }
      }, 60);
    }, 1200);
  }

  openOverlay('dice-overlay');
}

function rollContest(player) {
  if (player !== 1) return; // Player 2 is always NPC/auto or remote
  const roll = Math.floor(Math.random() * 20) + 1;
  const die = document.getElementById('c1-die');
  const btn = document.getElementById('c1-roll-btn');

  let count = 0;
  const interval = setInterval(() => {
    die.textContent = Math.floor(Math.random() * 20) + 1;
    if (++count >= 15) {
      clearInterval(interval);
      die.textContent = roll;
      die.classList.add('rolled');
      btn.disabled = true;
      if (roll === 20) die.style.color = 'var(--holy)';
      if (roll === 1)  die.style.color = 'var(--hell)';

      pendingContestData.p1Roll = roll;
      addLog(`🎲 ${pendingContestData.p1Name} rolls: [${roll}]${roll===20?' — CRITICAL!!':roll===1?' — FUMBLE!':''}`, 'dice');

      // In real MP: broadcast our roll to the target
      if (pendingContestData.isRealMP && window.mpBroadcastStoryEvent) {
        window.mpBroadcastStoryEvent('contest_roll', {
          fromPlayerId: window.mp?.playerId,
          targetPlayerId: pendingContestData.targetPlayerId,
          roll,
          playerName: pendingContestData.p1Name,
        });
      }

      if (pendingContestData.p2Roll !== null) setTimeout(resolveContest, 600);
    }
  }, 60);
}

// Handle incoming contest roll from another MP player
function receiveContestRoll(fromName, roll) {
  // Called on CHALLENGER's screen when target replies — store as p2Roll, animate die2
  pendingContestData.p2Roll = roll;
  const die2 = document.getElementById('c2-die');
  if (die2) {
    let count = 0;
    const anim = setInterval(() => {
      die2.textContent = Math.floor(Math.random() * 20) + 1;
      if (++count >= 10) {
        clearInterval(anim);
        die2.textContent = roll;
        die2.classList.add('rolled');
        if (roll === 20) die2.style.color = 'var(--holy)';
        if (roll === 1)  die2.style.color = 'var(--hell)';
        addLog(`🎲 ${fromName} rolls: [${roll}]${roll===20?' — CRITICAL!!':roll===1?' — FUMBLE!':''}`, 'dice');
        // Resolve if challenger already rolled their own (p1Roll set)
        if (pendingContestData.p1Roll !== null) setTimeout(resolveContest, 600);
      }
    }, 60);
  }
}
window.receiveContestRoll = receiveContestRoll;

// The challenged player's roll in a real MP contest
function rollContestTarget() {
  const roll = Math.floor(Math.random() * 20) + 1;
  const die2 = document.getElementById('c2-die');
  const btn  = document.getElementById('c2-roll-btn');

  let count = 0;
  const interval = setInterval(() => {
    die2.textContent = Math.floor(Math.random() * 20) + 1;
    if (++count >= 15) {
      clearInterval(interval);
      die2.textContent = roll;
      die2.classList.add('rolled');
      btn.disabled = true;
      if (roll === 20) die2.style.color = 'var(--holy)';
      if (roll === 1)  die2.style.color = 'var(--hell)';

      const myName = gameState.character?.name || 'You';
      addLog(`🎲 ${myName} rolls: [${roll}]${roll===20?' — CRITICAL!!':roll===1?' — FUMBLE!':''}`, 'dice');

      // On target's screen: I am p2. Store my roll as p2Roll.
      pendingContestData.p2Roll = roll;
      pendingContestData.p2Name = myName;

      // Broadcast reply back to challenger — isTargetReply:true so challenger stores it as p2Roll
      if (window.mpBroadcastStoryEvent) {
        window.mpBroadcastStoryEvent('contest_roll', {
          fromPlayerId: window.mp?.playerId,
          targetPlayerId: pendingContestData.targetPlayerId,
          roll,
          playerName: myName,
          isTargetReply: true,
        });
      }

      // Resolve locally on target's screen if challenger already rolled (p1Roll set)
      if (pendingContestData.p1Roll !== null) setTimeout(resolveContest, 600);
    }
  }, 60);
}
window.rollContestTarget = rollContestTarget;

function resolveContest() {
  const { p1Roll, p2Roll, actionText, p1Name, targetName } = pendingContestData;
  const resultEl = document.getElementById('contest-result');
  resultEl.classList.remove('hidden');

  let winner = p1Roll > p2Roll ? 1 : p2Roll > p1Roll ? 2 : 0;

  if (winner === 0) {
    resultEl.className = 'contest-result';
    resultEl.textContent = `DEAD TIE! [${p1Roll} = ${p2Roll}] — Reroll!`;
    addLog(`🎲 TIE [${p1Roll} = ${p2Roll}] — reroll required!`, 'system');
    // Re-enable both rolls
    setTimeout(() => {
      pendingContestData.p1Roll = null;
      pendingContestData.p2Roll = null;
      document.getElementById('c1-die').textContent = '?';
      document.getElementById('c2-die').textContent = '?';
      document.getElementById('c1-die').classList.remove('rolled');
      document.getElementById('c2-die').classList.remove('rolled');
      document.getElementById('c1-roll-btn').disabled = false;
      if (!pendingContestData.isRealMP) {
        // Re-trigger NPC auto-roll
        setTimeout(() => {
          const npcRoll = Math.floor(Math.random() * 20) + 1;
          pendingContestData.p2Roll = npcRoll;
          const die2 = document.getElementById('c2-die');
          die2.textContent = npcRoll;
          die2.classList.add('rolled');
          addLog(`🎲 ${targetName} rolls again: [${npcRoll}]`, 'dice');
        }, 800);
      }
    }, 1500);
    return;
  }

  const p1Won = winner === 1;
  resultEl.className = `contest-result ${p1Won ? 'winner-1' : 'winner-2'}`;
  resultEl.textContent = p1Won
    ? `✝ ${p1Name} WINS! [${p1Roll} vs ${p2Roll}]`
    : `⛧ ${targetName} WINS! [${p2Roll} vs ${p1Roll}]`;

  addLog(resultEl.textContent, p1Won ? 'holy' : 'combat');

  // Record strife if this was a real inter-party contest
  if (pendingContestData.isRealMP || window._partyStrife) {
    recordPartyStrife(p1Name, targetName, actionText, p1Won, p1Roll, p2Roll);
  }

  // Narrate outcome via Claude
  setTimeout(() => narrate_contest_outcome(p1Won, actionText, p1Name, targetName, p1Roll, p2Roll), 500);
}

function narrate_contest_outcome(playerWon, action, p1, p2, r1, r2) {
  const strife = window._partyStrife?.count || 0;
  const tension = strife >= 6 ? 'The party is fracturing. ' : strife >= 3 ? 'Tension between them is unmistakable. ' : '';
  const outcomes_win = [
    `${tension}With a roll of ${r1} against ${r2}, ${p1} succeeds. ${p2} is left defeated and humiliated — this will be remembered.`,
    `${tension}The dice favor ${p1} [${r1} vs ${r2}]. The action is carried out. ${p2} has no choice but to yield.`,
    `${tension}${p1} wins [${r1} vs ${r2}]. There was never much doubt.`,
  ];
  const outcomes_lose = [
    `${tension}${p2} rolled ${r2} against ${p1}'s ${r1} — and retaliates. This will not be forgotten.`,
    `${tension}${p1}'s attempt crumbles [${r1} vs ${r2}]. ${p2} turns the tables decisively.`,
    `${tension}The dice are merciless. ${p2} [${r2}] crushes ${p1}'s attempt [${r1}].`,
  ];
  const text = playerWon
    ? outcomes_win[Math.floor(Math.random() * outcomes_win.length)]
    : outcomes_lose[Math.floor(Math.random() * outcomes_lose.length)];
  addLog(text, 'narrator');
}

async function resolveAction(text, roll, actionType, dc, total, success) {
  // Backwards-compatible entry point for older wrappers. All authoritative
  // resolution is delegated to the single D&D rules pipeline above.
  const abilityMap = { charisma:'cha', strength:'str', dexterity:'dex', intelligence:'int', wisdom:'wis' };
  return resolveActionRequest(text, { ability: abilityMap[actionType], dc });
}

function analyzeActionMorality(text) {
  // Good actions
  if (text.includes('help') || text.includes('heal') || text.includes('protect') || text.includes('save')) {
    setTimeout(() => { grantHolyPoints(3); addLog('✝ A good deed. The divine takes notice. +3 Holy Points.', 'holy'); }, 500);
  }
  // Evil actions
  if (text.includes('steal') || text.includes('betray') || text.includes('kill innocent') || text.includes('desecrate')) {
    setTimeout(() => { grantHellPoints(5); addLog('⛧ A dark deed. Something smiles in the abyss. +5 Hell Points.', 'dark'); }, 500);
  }
  // The Bresker incident
  if (text.includes('piss') || text.includes('urinate') || text.includes('tied') || text.includes('wrap')) {
    setTimeout(() => {
      grantHellPoints(12);
      addLog('⛧ The infamous Bresker Incident. Hell points awarded for creative depravity. +12 Hell Points. Bresker will remember this.', 'dark');
    }, 600);
  }
}

// ─── HOLY & HELL SYSTEM ───────────────────
function grantHolyPoints(pts) {
  if (!gameState.character) return;
  gameState.character.holyPoints += pts;
  renderPlayerCard();
  if (gameState.character.holyPoints >= 30 && gameState.character.holyPoints - pts < 30) {
    addLog('☩ You have attained 30 Holy Points! Divine powers are now available. Pray to unlock them.', 'holy');
  }
}

function grantHellPoints(pts) {
  if (!gameState.character) return;
  gameState.character.hellPoints += pts;
  renderPlayerCard();
  if (gameState.character.hellPoints >= 30 && gameState.character.hellPoints - pts < 30) {
    addLog('⛧ You have accumulated 30 Hell Points! Dark powers stir within you. Pray to the darkness.', 'dark');
  }
}

function pray(type) {
  const char = gameState.character;
  if (!char) return;

  if (type === 'holy') {
    if (char.holyPoints < 10) {
      addLog(`Your prayer rises... but you lack sufficient faith. You need at least 10 Holy Points. You have ${char.holyPoints}.`, 'system');
      toast('Need 10 Holy Points to pray', 'error');
      return;
    }
    addLog(`☩ ${char.name} kneels and prays in the name of Jesus Christ...`, 'holy');
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      addLog(`🎲 Faith roll: [${roll}]`, 'dice');
      if (roll >= 10) {
        addLog(`☩ The name carries weight in this world that nothing has erased. Something real and physical shifts in the room — a stillness that others present notice. Divine grace flows through you. +15 HP restored. Your next strike carries holy power.`, 'holy');
        char.hp = Math.min(char.maxHp, char.hp + 15);
        char.holyPoints -= 5;
        renderPlayerCard();
        document.body.style.boxShadow = 'inset 0 0 100px rgba(232,200,74,0.2)';
        setTimeout(() => document.body.style.boxShadow = '', 1200);
      } else {
        addLog(`The prayer is genuine. The silence after it is not empty — it is the silence of being heard. Something will come from this. Not yet.`, 'system');
      }
    }, 800);
  } else {
    if (char.hellPoints < 10) {
      addLog(`The darkness does not answer. You haven't sinned enough. You need at least 10 Hell Points. You have ${char.hellPoints}.`, 'system');
      toast('Need 10 Hell Points to pray to darkness', 'error');
      return;
    }
    addLog(`⛧ ${char.name} reaches into the abyss...`, 'dark');
    setTimeout(() => {
      addLog(`Something answers. Something that should not. Dark power floods through you — and something in the party stirs uncomfortably.`, 'dark');
      char.hellPoints -= 8;

      // Dark powers can harm party
      const splash = Math.random() < 0.4;
      if (splash) {
        addLog(`⚠ DARK POWER SPLASHES! Bresker takes 1d8 dark damage from the corruption bleeding off you!`, 'combat');
        addLog(`🎲 Dark splash damage: [${Math.floor(Math.random() * 8) + 1}] damage to Bresker`, 'dice');
      }
      renderPlayerCard();
      document.body.style.boxShadow = 'inset 0 0 100px rgba(192,57,43,0.2)';
      setTimeout(() => document.body.style.boxShadow = '', 1000);
    }, 800);
  }
}

// ─── (removed) dead zero-arg rollDice() (#26) ──
// It only wrapped showContestedRoll('Custom Contest') and had no call sites.
// The real damage-rolling rollDice(formula, statMod) lives in combat.js.

// ─── DICE HISTORY PANEL ───────────────────
// Automatically populated whenever any addLog(..., 'dice') is called
// Max 8 entries, newest at top
const _diceHistory = [];
const DICE_HISTORY_MAX = 8;

function addRollToHistory(text) {
  _diceHistory.unshift({ text, time: Date.now() });
  if (_diceHistory.length > DICE_HISTORY_MAX) _diceHistory.length = DICE_HISTORY_MAX;
  renderDiceHistory();
}

function renderDiceHistory() {
  const panel = document.getElementById('dice-history');
  if (!panel) return;

  if (_diceHistory.length === 0) {
    panel.innerHTML = '<div class="dice-history-empty">Dice rolls appear here automatically as the game calls for them.</div>';
    return;
  }

  panel.innerHTML = _diceHistory.map((entry, i) => {
    const txt = entry.text.replace(/^🎲\s*/, '');
    // Colour by outcome
    const isCrit   = txt.includes('CRITICAL') || txt.includes('MAX ROLL') || txt.includes('⭐');
    const isFumble = txt.includes('FUMBLE')   || txt.includes('MINIMUM')  || txt.includes('💀');
    const isSuccess = txt.includes('✅') || txt.includes('Success') || txt.includes('HIT');
    const isFail    = txt.includes('❌') || txt.includes('Failure') || txt.includes('MISS');
    const colour = isCrit ? 'var(--holy)' : isFumble ? 'var(--hell-glow)' : isSuccess ? '#8bc87a' : isFail ? '#c87060' : 'var(--gold-light)';
    const icon   = isCrit ? '⭐' : isFumble ? '💀' : isSuccess ? '✅' : isFail ? '❌' : '🎲';
    const opacity = i === 0 ? '1' : `${Math.max(0.35, 1 - i * 0.1)}`;
    return `<div class="dice-history-entry" style="opacity:${opacity};color:${colour}">${icon} ${txt}</div>`;
  }).join('');
}

// Legacy stub — free rolling removed. Rolls are automatic.
function rollSpecific(sides) {
  addLog(`🎲 The dice roll when the game demands it — no free rolls.`, 'system');
}

// ─── ATTACK QUICK-ACTION ──────────────────
// The old hardcoded Covenant Cultist/Road Bandit/Bresker stub with fake crits was
// removed (#26). The 🗡 Attack quick-action now routes into the REAL combat system
// in combat.js via checkAutoAttack → startCombat.
function showAttackMenu() {
  if (window.combatState?.active) {
    toast('You are already in combat.', 'error');
    return;
  }
  if (typeof checkAutoAttack === 'function') {
    // checkAutoAttack('attack') generates a location-appropriate enemy and calls
    // the real startCombat([...]) — no fake damage, no fake crits.
    checkAutoAttack('attack');
  } else {
    toast('Combat system unavailable.', 'error');
  }
}

// ─── QUEST LOG ────────────────────────────
function showQuestLog() {
  const content = document.getElementById('quest-overlay-content');
  const mainQuests = CHAPTER_1_QUESTS.filter(q => q.type === 'main');
  const sideQuests = CHAPTER_1_QUESTS.filter(q => q.type === 'side');
  const personalQuests = gameState.character?.personalQuests || [];
  const activeIds = new Set((gameState.activeQuests || []).map(quest => quest.id));
  const completedIds = new Set((gameState.completedQuests || []).map(quest => quest.id));
  const escText = window.escapeHtml || (value => String(value));
  const renderCampaignQuest = q => {
    const completed = completedIds.has(q.id);
    const active = activeIds.has(q.id);
    const status = completed ? '✓ COMPLETED' : active ? '● ACTIVE' : q.type === 'side' ? '○ AVAILABLE' : '🔒 LOCKED';
    const statusClass = completed ? 'completed' : active ? 'active' : '';
    const objectives = window.SanctumQuests?.getObjectives(q.id) || [];
    const objectiveState = gameState.questProgress?.[q.id]?.objectives || {};
    const objectiveHTML = (active || completed) && objectives.length ? `
      <div style="margin-top:8px;display:grid;gap:4px">
        ${objectives.map(objective => {
          const done = !!objectiveState[objective.id] || completed;
          return `<div style="font-size:0.72rem;color:${done ? '#7fbf83' : 'var(--text-dim)'}">${done ? '✓' : '○'} ${escText(objective.label)}</div>`;
        }).join('')}
      </div>` : '';
    return `<div class="quest-full-item ${completed ? 'completed' : ''}">
      <div class="qfi-title">${q.boss ? '💀 ' : ''}${escText(q.title)}</div>
      <div class="qfi-desc">${escText(q.desc)}</div>
      ${objectiveHTML}
      <div class="qfi-status ${statusClass}">${status} — ${q.xp} XP reward</div>
    </div>`;
  };

  content.innerHTML = `
    <div class="quest-section">
      <h4>☩ MAIN QUESTS — CHAPTER I</h4>
      ${mainQuests.map(renderCampaignQuest).join('')}
    </div>
    <div class="quest-section">
      <h4>⚔ SIDE QUESTS</h4>
      ${sideQuests.map(renderCampaignQuest).join('')}
    </div>
    <div class="quest-section">
      <h4>🔮 PERSONAL QUESTS <span style="color:var(--hell);font-style:italic;letter-spacing:0">(Secret)</span></h4>
      ${personalQuests.map(q => `<div class="quest-full-item" style="border-left-color:var(--hell)">
        <div class="qfi-title">${q.title}</div>
        <div class="qfi-desc">${q.desc}</div>
        <div class="qfi-status active" style="color:var(--hell)">⛧ PERSONAL — ${q.xp} XP</div>
      </div>`).join('')}
    </div>
  `;
  openOverlay('quest-overlay');
}

// ─── (removed) narrateMajorMoment / typewriterEffect (#26) ──
// narrateMajorMoment was dead code (no call sites) AND made a keyless direct
// fetch to api.anthropic.com — deleted. typewriterEffect was only used by it.

// ─── OVERLAY MANAGEMENT ───────────────────
function openOverlay(id) {
  if (window.SanctumUI?.openManagedOverlay(id)) return;
  document.getElementById(id)?.classList.remove('hidden');
}

function closeOverlay(id) {
  if (window.SanctumUI?.closeManagedOverlay(id)) return;
  document.getElementById(id)?.classList.add('hidden');
}

// ─── PARTY SYNC ───────────────────────────
function pollPartyUpdates() {
  const code = localStorage.getItem('ss_my_session');
  if (!code) return;
  const stored = localStorage.getItem('ss_session_' + code);
  if (!stored) return;
  // In a real app, this would poll a server. For demo, it reads localStorage.
  // Other players' actions would appear here.
}

// ─── TOAST ────────────────────────────────
function toast(message, type = '') {
  const container = document.querySelector('.toast-container') || createToastContainer();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.className = 'toast-container';
  c.setAttribute('role', 'status');
  c.setAttribute('aria-live', 'polite');
  c.setAttribute('aria-atomic', 'false');
  document.body.appendChild(c);
  return c;
}

// ─── KEYBOARD SHORTCUTS ───────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    if (gameState.activeScreen === 'game') submitAction();
  }
  if (e.key === 'Escape') {
    // If the PAUSE menu itself is open, close it
    const escMenu = document.getElementById('esc-menu');
    if (escMenu) { escMenu.remove(); return; }
    // If the character sheet is open, Esc closes IT (don't stack pause) (#75)
    const charSheet = document.getElementById('char-sheet-overlay') || document.getElementById('charsheet-overlay') || document.getElementById('char-sheet');
    if (charSheet) { charSheet.remove(); return; }
    // If the save/load screen is open, Esc closes IT (#75)
    if (document.getElementById('save-load-screen')) {
      if (typeof closeSaveLoadScreen === 'function') closeSaveLoadScreen();
      else document.getElementById('save-load-screen').remove();
      return;
    }
    // Close generic overlays
    const openOverlayElement = document.querySelector('.overlay:not(.hidden)');
    if (openOverlayElement) { closeOverlay(openOverlayElement.id); return; }
    // Close conv/combat/scene panels
    if (document.getElementById('conv-panel')) { if (typeof closeConvPanel === 'function') closeConvPanel(); return; }
    // Toggle ESC menu when in game
    if (gameState.activeScreen === 'game') toggleEscMenu();
  }
});

// ─── ESC MENU ─────────────────────────────
function toggleEscMenu() {
  const existing = document.getElementById('esc-menu');
  if (existing) { existing.remove(); return; }

  // Autosave right now before showing menu
  if (typeof autosave === 'function') autosave();

  const overlay = document.createElement('div');
  overlay.id = 'esc-menu';
  overlay.innerHTML = `
    <div class="esc-backdrop" onclick="document.getElementById('esc-menu')?.remove()"></div>
    <div class="esc-panel">
      <div class="esc-title">⏸ PAUSED</div>
      <div class="esc-char">${gameState.character?.name || ''} — ${gameState.character?.class || ''} Lv.${gameState.character?.level || 1}</div>

      <button class="esc-btn resume" onclick="document.getElementById('esc-menu').remove()">
        ▶ Resume
      </button>

      <button class="esc-btn save" onclick="showEscSaveForm()">
        💾 Save Game
      </button>

      <div id="esc-save-form" style="display:none">
        <input id="esc-save-name" class="esc-input" type="text"
          placeholder="Name this save…"
          value="${gameState.character?.name || 'Chronicle'} — Ch.${gameState.chapter || 1}"
          maxlength="40" />
        <button class="esc-btn save confirm" onclick="doEscSave()">✅ Confirm Save</button>
      </div>

      <div id="esc-save-feedback" class="esc-feedback"></div>

      <button class="esc-btn leave" onclick="escLeaveGame()">
        ✕ Leave Game
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Focus the name field when save form opens
  setTimeout(() => {
    document.getElementById('esc-save-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doEscSave();
      if (e.key === 'Escape') document.getElementById('esc-menu')?.remove();
    });
  }, 50);
}

function showEscSaveForm() {
  const form = document.getElementById('esc-save-form');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  if (form.style.display === 'flex') {
    setTimeout(() => document.getElementById('esc-save-name')?.focus(), 50);
  }
}

function doEscSave() {
  const nameInput = document.getElementById('esc-save-name');
  const name = (nameInput?.value || '').trim() || `${gameState.character?.name} — Ch.${gameState.chapter || 1}`;
  const feedback = document.getElementById('esc-save-feedback');

  if (typeof saveGame === 'function') {
    // Pass a stable type so buildSaveSlot dedupes (name + type) to ONE slot instead of
    // creating a new slot on every ESC save and evicting named saves (#26).
    const escType = window.mp?.sessionCode ? 'multiplayer' : 'solo';
    const slot = saveGame(name, escType, true); // silent (no addLog)
    if (slot) {
      if (feedback) { feedback.textContent = `✅ Saved: "${slot.name}"`; feedback.className = 'esc-feedback success'; }
      addLog(`💾 Game saved: "${slot.name}"`, 'system');
      // Hide form, show feedback
      document.getElementById('esc-save-form').style.display = 'none';
      setTimeout(() => { if (feedback) feedback.textContent = ''; }, 3000);
    } else {
      if (feedback) { feedback.textContent = '❌ Save failed — start a game first.'; feedback.className = 'esc-feedback error'; }
    }
  }
}

function escLeaveGame() {
  // Autosave before leaving
  if (typeof autosave === 'function') autosave();
  document.getElementById('esc-menu')?.remove();
  // Clear MP session — player is intentionally leaving, don't rejoin on next load
  if (typeof clearMPSession === 'function') clearMPSession();
  localStorage.removeItem('ss_resume_flag');
  // Clean up all game overlays
  document.getElementById('conv-panel')?.remove();
  document.getElementById('combat-panel')?.remove();
  document.getElementById('scene-panel')?.remove();
  document.getElementById('camp-panel')?.remove();
  document.getElementById('shop-panel')?.remove();
  document.getElementById('rep-panel')?.remove();
  if (window.npcConvState) { window.npcConvState.active = false; window.npcConvState.npc = null; }
  if (window.combatState) window.combatState.active = false;
  if (typeof stopAutosave === 'function') stopAutosave();
  showScreen('splash');
}

// ─── INIT ─────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {

  // ── Refresh resume: autosave before page unloads ──
  window.addEventListener('beforeunload', () => {
    if (gameState.activeScreen === 'game' && gameState.character) {
      if (typeof saveGame === 'function') {
        // Save with a special 'session' type so we can find it on reload
        saveGame('__session_resume__', 'session_resume', true);
        localStorage.setItem('ss_resume_flag', '1');
      }
    }
  });

  // ── On load: check if we should resume last session ──
  const shouldResume = localStorage.getItem('ss_resume_flag') === '1';
  if (shouldResume) {
    localStorage.removeItem('ss_resume_flag');
    // Find the session_resume slot
    const slots = typeof getAllSaves === 'function' ? getAllSaves() : [];
    const resumeSlot = slots.find(s => s.type === 'session_resume') ||
                       slots.find(s => s.name === '__session_resume__') ||
                       slots[0]; // fallback: most recent save
    if (resumeSlot && typeof loadSaveSlot === 'function') {
      showScreen('splash');
      // Small delay to let all scripts initialize
      setTimeout(() => {
        addLog('🔄 Resuming your last session...', 'system');
        loadSaveSlot(resumeSlot.id);
      }, 300);
      return; // skip normal splash show
    }
  }

  showScreen('splash');

  // Check if returning to a session
  const savedSession = localStorage.getItem('ss_my_session');
  if (savedSession) {
    const stored = localStorage.getItem('ss_session_' + savedSession);
    if (stored) {
      // Session exists
    }
  }

  // Handle Enter key in action input
  const actionInput = document.getElementById('action-input');
  if (actionInput) {
    actionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitAction();
      }
    });
  }

  console.log('⚔ SANCTUM & SHADOW initialized. Let the chronicle begin.');
});
