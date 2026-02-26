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
  // Always clean up floating game overlays when navigating away from game
  if (name !== 'game') {
    document.getElementById('conv-panel')?.remove();
    document.getElementById('combat-panel')?.remove();
    document.getElementById('scene-panel')?.remove();
    document.getElementById('dm-strip')?.remove();
    if (window.npcConvState) { window.npcConvState.active = false; window.npcConvState.npc = null; }
    if (window.combatState) window.combatState.active = false;
  }
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
  setInterval(updateWaitingPlayers, 2000);
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
      document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      gameState.selectedRace = r.id;
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

      document.getElementById('finalize-btn').style.display = 'inline-block';
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
    personalQuests: originData ? originData.quests.map((q, i) => ({ ...q, id: 'pq_' + i, status: 'active', chapter: 1 })) : [],
    revealChoice: null,
  };

  gameState.character = character;

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
          : `<p class="step-hint">Waiting for the host to start the chronicle...</p>`
        }
      </div>
    </div>`;
  document.getElementById('app').appendChild(room);
  updateReadyRoom();
}

function updateReadyRoom() {
  const list = document.getElementById('ready-player-list');
  if (!list || !window.mp?.session) return;

  const players = Object.values(window.mp.session.players);
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
          ${p.name}${p.id === window.mp.playerId ? ' (You)' : ''}
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
  const players = Object.values(window.mp.session?.players || {});
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

  // Start game log
  addLog(`☩ The Chronicle begins. Welcome, ${char.name}.`, 'system');
  addLog(`You are a ${RACES.find(r=>r.id===char.race)?.name || 'Unknown'} ${CLASSES.find(c=>c.id===char.class)?.name || 'Unknown'}, bearer of ${char.holyPoints} holy points and ${char.hellPoints} hell points.`, 'system');
  addLog(`Chapter I begins: "The Shattered Covenant." A treaty is broken. The world holds its breath.`, 'narrator');

  setTimeout(() => {
    showQuestIntro();
  }, 1200);

  // Poll for party updates
  setInterval(pollPartyUpdates, 3000);
}

function setupQuests() {
  gameState.activeQuests = [
    CHAPTER_1_QUESTS[0],
    CHAPTER_1_QUESTS[1],
    ...gameState.character.personalQuests.slice(0, 2)
  ];
}

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

  document.getElementById('player-card').innerHTML = `
    <div class="pcm-name">${char.name}</div>
    <div class="pcm-class">${race?.name || ''} ${cls?.name || ''} — Lv.${char.level}</div>
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
        <span id="xp-bar-label">${char.xp} / ${(window.XP_TABLE||[])[( char.level||1)+1] || '∞'}</span>
      </div>
      <div class="bar-track">
        <div id="xp-bar-fill" class="bar-fill xp" style="width:${(()=>{
          const tbl=window.XP_TABLE||[0,100,250,450,700,1000,1400,1900,2500,3200,4000];
          const lvl=char.level||1, cur=char.xp||0;
          const prev=tbl[lvl]||0, next=tbl[lvl+1]||prev+1000;
          return Math.min(100,Math.round((cur-prev)/(next-prev)*100));
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
  const icons = { 'Sword': '⚔', 'Mace': '🔨', 'Staff': '🔮', 'Bow': '🏹', 'Daggers': '🗡', 'Armor': '🛡', 'Robe': '🧥', 'Cloak': '🧥', 'Potion': '🧪', 'Water': '💧', 'Book': '📜', 'Scripture': '📖', 'Kit': '💊', 'Candle': '🕯', 'Crystal': '💎', 'Quiver': '🏹', 'Lockpick': '🔑' };
  container.innerHTML = char.inventory.map(item => {
    const icon = Object.entries(icons).find(([k]) => item.toLowerCase().includes(k.toLowerCase()))?.[1] || '📦';
    return `<div class="inv-item"><span class="inv-icon">${icon}</span><span class="inv-name">${item}</span></div>`;
  }).join('');
}

function renderPartyList() {
  const container = document.getElementById('party-list'); if (!container) return;
  // In single-player demo, show self + simulated party members
  const parties = [
    { name: gameState.character?.name || 'You', class: gameState.character?.class || 'warrior', hp: gameState.character?.hp || 100, maxHp: gameState.character?.maxHp || 100, self: true },
    { name: 'Bresker', class: 'warrior', hp: 85, maxHp: 120, self: false },
  ];
  container.innerHTML = parties.map(p => {
    const pct = (p.hp / p.maxHp * 100).toFixed(0);
    const cls = CLASSES.find(c => c.id === p.class);
    return `<div class="party-member">
      <div class="pm-name"><span>${cls?.icon || '⚔'} ${p.name}${p.self ? ' (You)' : ''}</span><span style="color:var(--text-dim);font-size:0.7rem">${p.hp}/${p.maxHp}</span></div>
      <div class="pm-hp-bar"><div class="pm-hp-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderQuestList() {
  const container = document.getElementById('quest-list'); if (!container) return;
  const quests = [...(gameState.activeQuests || [])].slice(0, 4);
  container.innerHTML = quests.map(q => `
    <div class="quest-item ${q.id?.startsWith('pq') ? 'personal' : ''}">
      <span class="qi-title">${q.title}</span>
      <span class="qi-desc">${q.desc?.substring(0, 60)}...</span>
    </div>
  `).join('') || '<div style="color:var(--text-dim);font-size:0.85rem;font-style:italic">No active quests.</div>';
}

// ─── GAME LOG ─────────────────────────────
function addLog(text, type = 'system', playerName = null) {
  const log = document.getElementById('game-log');
  if (!log) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  if (playerName) {
    entry.innerHTML = `<span class="log-player">${playerName}</span>${text}`;
  } else {
    entry.textContent = text;
  }

  // Always append at the very end of the log (after any scene panel)
  log.appendChild(entry);

  // Force scroll to bottom
  requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
  });

  gameState.log.push({ text, type, playerName, time: Date.now() });
}

// ─── ACTION SUBMISSION ────────────────────
// ─── ACTION CLASSIFICATION ────────────────────
function classifyAction(text) {
  const t = text.toLowerCase();

  // Pure speech — no roll needed
  const speechPhrases = ['say ', 'tell ', 'ask ', 'talk to ', 'speak to ', 'shout ', 'whisper ', 'yell ', 'call out', 'greet ', 'introduce ', 'announce ', '"', "'"];
  if (speechPhrases.some(p => t.startsWith(p) || t.includes(p))) return 'speech';

  // Combat — handled by checkAutoAttack
  const combatWords = ['attack', 'stab', 'strike', 'punch', 'hit', 'fight', 'kill', 'shoot', 'slash', 'draw sword', 'draw weapon'];
  if (combatWords.some(w => t.includes(w))) return 'combat';

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

async function submitAction() {
  const input = document.getElementById('action-input');
  const text = input.value.trim();
  if (!text) return;

  const charName = gameState.character?.name || 'Unknown';
  addLog(`${charName}: "${text}"`, 'action', charName);
  input.value = '';

  // ── Combat check FIRST ──
  if (!combatState.active && typeof checkAutoAttack === 'function') {
    if (checkAutoAttack(text)) return;
  }

  analyzeActionMorality(text.toLowerCase());

  const actionType = classifyAction(text);

  // Speech — pass to NPC dialogue if target mentioned, else narrate freely
  if (actionType === 'speech') {
    // Try to extract NPC name
    const talkMatch = text.match(/(?:say to|tell|ask|talk to|speak to|shout at|whisper to|call out to)\s+(.+?)(?:\s+that|\s+to|\s*"|\s*$)/i);
    const npcName = talkMatch?.[1]?.trim();
    if (npcName && typeof startNPCConversation === 'function') {
      startNPCConversation(npcName, text);
    } else {
      addLog(`*${text}*`, 'narrator');
    }
    return;
  }

  // Free narrative actions (movement, looking, basic interaction)
  if (actionType === 'free') {
    const roll = Math.floor(Math.random() * 20) + 1;
    resolveAction(text, roll, 'free', 10);
    return;
  }

  // All other action types — require a stat roll with real consequences
  const statMap = { charisma: 'cha', strength: 'str', dexterity: 'dex', intelligence: 'int', wisdom: 'wis' };
  const statKey = statMap[actionType];
  const dcMap = { charisma: 13, strength: 12, dexterity: 13, intelligence: 12, wisdom: 11 };
  const dc = dcMap[actionType] || 12;

  const statVal = gameState.character?.stats?.[statKey] || 10;
  const mod = Math.floor((statVal - 10) / 2);
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + mod;
  const crit = roll === 20;
  const fumble = roll === 1;
  const success = crit || (!fumble && total >= dc);

  const statLabel = statKey.toUpperCase();
  addLog(`🎲 ${statLabel} check DC${dc}: [${roll}] + ${mod >= 0 ? '+' : ''}${mod} = ${total} — ${crit ? '✨ CRITICAL!' : fumble ? '💀 FUMBLE!' : success ? '✅ Success!' : '❌ Failure!'}`, 'dice');
  if (window.AudioEngine) AudioEngine.sfx?.dice();

  resolveAction(text, roll, actionType, dc, total, success);
}

function detectMajorMoment(text) {
  const keywords = ['boss', 'final', 'demon', 'god', 'angel', 'ritual', 'covenant', 'destroy', 'sacrifice', 'ancient', 'shattered', 'apocalypse', 'death', 'kill the', 'slay the'];
  return keywords.some(k => text.toLowerCase().includes(k));
}

function detectContested(text) {
  const names = ['bresker', 'party', 'companion', 'ally', 'enemy', 'bandit', 'guard', 'them', 'him', 'her'];
  const contestVerbs = ['grab', 'push', 'shove', 'wrestle', 'tie', 'wrap', 'piss', 'seduce', 'deceive', 'sneak past', 'tackle', 'disarm'];
  const lower = text.toLowerCase();
  return contestVerbs.some(v => lower.includes(v)) && names.some(n => lower.includes(n));
}

function showContestedRoll(actionText) {
  pendingContestData = { actionText, p1Roll: null, p2Roll: null };
  document.getElementById('contest-title').textContent = '⚔ Contested Roll!';
  document.getElementById('c1-name').textContent = gameState.character?.name || 'You';
  document.getElementById('c2-name').textContent = 'Bresker'; // simulated
  document.getElementById('c1-die').textContent = '?';
  document.getElementById('c2-die').textContent = '?';
  document.getElementById('c1-die').classList.remove('rolled');
  document.getElementById('c2-die').classList.remove('rolled');
  document.getElementById('contest-result').classList.add('hidden');
  document.getElementById('contest-result').textContent = '';
  document.getElementById('c1-roll-btn').disabled = false;
  document.getElementById('c2-roll-btn').disabled = false;

  addLog(`⚔ CONTESTED: "${actionText}" — Both parties must roll!`, 'system');
  openOverlay('dice-overlay');
}

function rollContest(player) {
  const roll = Math.floor(Math.random() * 20) + 1;
  const die = document.getElementById('c' + player + '-die');
  const btn = document.getElementById('c' + player + '-roll-btn');

  // Animate
  let count = 0;
  const interval = setInterval(() => {
    die.textContent = Math.floor(Math.random() * 20) + 1;
    count++;
    if (count >= 15) {
      clearInterval(interval);
      die.textContent = roll;
      die.classList.add('rolled');
      btn.disabled = true;

      if (player === 1) pendingContestData.p1Roll = roll;
      else pendingContestData.p2Roll = roll;

      const isCrit = roll === 20;
      const isFumble = roll === 1;
      if (isCrit) die.style.color = 'var(--holy)';
      if (isFumble) die.style.color = 'var(--hell)';

      addLog(`🎲 ${document.getElementById('c'+player+'-name').textContent} rolls: [${roll}]${isCrit ? ' — CRITICAL!!' : isFumble ? ' — FUMBLE!' : ''}`, 'dice');

      // If both rolled, resolve
      if (pendingContestData.p1Roll !== null && pendingContestData.p2Roll !== null) {
        setTimeout(() => resolveContest(), 800);
      }
    }
  }, 60);
}

function resolveContest() {
  const { p1Roll, p2Roll, actionText } = pendingContestData;
  const resultEl = document.getElementById('contest-result');
  resultEl.classList.remove('hidden');

  const p1Name = gameState.character?.name || 'You';
  const p2Name = 'Bresker';

  let resultText = '';
  let winner = null;

  if (p1Roll > p2Roll) {
    winner = 1;
    resultEl.className = 'contest-result winner-1';
    resultText = `✝ ${p1Name} WINS! [${p1Roll} vs ${p2Roll}]`;
  } else if (p2Roll > p1Roll) {
    winner = 2;
    resultEl.className = 'contest-result winner-2';
    resultText = `⛧ ${p2Name} WINS! [${p2Roll} vs ${p1Roll}]`;
  } else {
    resultEl.className = 'contest-result';
    resultText = `DEAD TIE! [${p1Roll} = ${p2Roll}] — Reroll required!`;
  }

  resultEl.textContent = resultText;
  addLog(resultText, winner === 1 ? 'holy' : 'combat');

  // Narrate outcome
  setTimeout(() => {
    if (winner === 1) {
      narrate_contest_outcome(true, actionText, p1Name, p2Name, p1Roll, p2Roll);
    } else if (winner === 2) {
      narrate_contest_outcome(false, actionText, p1Name, p2Name, p1Roll, p2Roll);
    }
  }, 500);
}

function narrate_contest_outcome(playerWon, action, p1, p2, r1, r2) {
  const outcomes_win = [
    `With a roll of ${r1} against ${r2}, ${p1} succeeds spectacularly. ${p2} is left utterly defeated and considerably humiliated.`,
    `The dice have spoken: ${p1} (${r1}) overcomes ${p2} (${r2}). The action is carried out with remarkable determination.`,
    `A clear victory for ${p1}! Rolling ${r1} against ${p2}'s ${r2} — there was never any doubt who would prevail.`,
  ];
  const outcomes_lose = [
    `${p2} rolled ${r2} against ${p1}'s ${r1} — and retaliates viciously. This will not be forgotten.`,
    `${p1}'s plan crumbles (${r1} vs ${r2}). ${p2} turns the tables with extreme prejudice.`,
    `The dice are merciless. ${p2} (${r2}) crushes ${p1}'s attempt (${r1}). The consequences are immediate and painful.`,
  ];

  const text = playerWon
    ? outcomes_win[Math.floor(Math.random() * outcomes_win.length)]
    : outcomes_lose[Math.floor(Math.random() * outcomes_lose.length)];

  addLog(text, 'narrator');
}

async function resolveAction(text, roll, actionType, dc, total, success) {
  const char = gameState.character;
  const isCrit = roll === 20;
  const isFumble = roll === 1;

  // For free actions just narrate via Claude
  if (actionType === 'free') {
    const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
    const sysPrompt = `You are the DM of "Sanctum & Shadow". Narrate what happens in 1-2 sentences. Be atmospheric, specific to ${loc?.name}. No dice mention.`;
    const narration = await callClaude(sysPrompt, [{ role: 'user', content: `Player action: "${text}"` }], 100);
    if (narration) addLog(narration, 'narrator');
    return;
  }

  const resultLabel = isCrit ? 'CRITICAL SUCCESS' : isFumble ? 'CRITICAL FAILURE' : success ? 'SUCCESS' : 'FAILURE';

  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const cls = CLASSES?.find(c => c.id === char?.class);
  const race = RACES?.find(r => r.id === char?.race);
  const flags = Object.keys(window.sceneState?.flags || {}).join(', ') || 'none';

  const systemPrompt = `You are the DM of "Sanctum & Shadow", a dark fantasy RPG. Narrate action outcomes in 2-3 sentences. Be specific to the setting. Never mention dice or rolls. Stay in narrative voice.`;

  const userMsg = `Player: ${char?.name}, ${race?.name} ${cls?.name}
Location: ${loc?.name}
Story flags: ${flags}
Action: "${text}"
Result: ${resultLabel} (rolled ${total} vs DC${dc})

${isCrit ? 'CRITICAL SUCCESS — narrate something unexpectedly great happening.' : ''}
${isFumble ? 'CRITICAL FAILURE — narrate something going badly and immediately wrong.' : ''}
${success && !isCrit ? 'SUCCESS — it works but with a complication or cost.' : ''}
${!success && !isFumble ? 'FAILURE — it fails and there is a real negative consequence. NPC reacts badly, opportunity lost, or situation worsens.' : ''}`;

  const narration = await callClaude(systemPrompt, [{ role: 'user', content: userMsg }], 150);

  if (narration) {
    addLog(narration, success ? 'narrator' : 'combat');
  } else {
    // Fallback
    if (isCrit) addLog(`A critical success — everything goes better than hoped.`, 'holy');
    else if (isFumble) addLog(`A catastrophic failure — things have gotten significantly worse.`, 'dark');
    else if (success) addLog(`The action succeeds, though not without complication.`, 'narrator');
    else addLog(`The action fails. The consequences are immediate.`, 'combat');
  }

  // Apply consequences
  if (isCrit) grantHolyPoints(1);
  if (isFumble) { grantHellPoints(1); if (char) { char.hp = Math.max(1, char.hp - 3); renderPlayerCard(); } }
  if (!success && !isFumble && actionType === 'charisma') grantHellPoints(1);
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
    addLog(`✝ ${char.name} kneels and prays to the Lord of Hosts...`, 'holy');
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 20) + 1;
      addLog(`🎲 Faith roll: [${roll}]`, 'dice');
      if (roll >= 10) {
        addLog(`Your prayer is heard. Divine grace flows through you. Gain +15 HP and the next attack deals holy damage.`, 'holy');
        char.hp = Math.min(char.maxHp, char.hp + 15);
        char.holyPoints -= 5;
        renderPlayerCard();
        // Flash effect
        document.body.style.boxShadow = 'inset 0 0 100px rgba(232,200,74,0.2)';
        setTimeout(() => document.body.style.boxShadow = '', 1000);
      } else {
        addLog(`Your prayer goes unanswered. Perhaps your faith wavers, or your sins are too fresh.`, 'system');
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

// ─── DICE ─────────────────────────────────
function rollDice() {
  showContestedRoll('Custom Contest');
}

function rollSpecific(sides) {
  const resultEl = document.getElementById('dice-result');
  let count = 0;
  const interval = setInterval(() => {
    resultEl.textContent = `d${sides}: ${Math.floor(Math.random() * sides) + 1}`;
    count++;
    if (count >= 12) {
      clearInterval(interval);
      const final = Math.floor(Math.random() * sides) + 1;
      resultEl.textContent = `d${sides}: ${final}`;
      resultEl.style.color = final === sides ? 'var(--holy)' : final === 1 ? 'var(--hell)' : 'var(--gold-light)';
      addLog(`🎲 ${gameState.character?.name || 'You'} rolls d${sides}: [${final}]${final === sides ? ' — MAX ROLL!' : final === 1 ? ' — MINIMUM!' : ''}`, 'dice');
    }
  }, 60);
}

// ─── ATTACK MENU ──────────────────────────
function showAttackMenu() {
  const list = document.getElementById('target-list');
  const enemies = [
    { name: 'Covenant Cultist', hp: 25, maxHp: 25, type: 'enemy' },
    { name: 'Road Bandit', hp: 18, maxHp: 30, type: 'enemy' },
    { name: 'Bresker (Ally)', hp: 85, maxHp: 120, type: 'ally' },
  ];

  list.innerHTML = enemies.map(e => `
    <div class="target-card ${e.type}" onclick="attackTarget('${e.name}', '${e.type}')">
      <span class="tc-name">${e.name}</span>
      <span class="tc-hp">${e.hp}/${e.maxHp} HP</span>
    </div>
  `).join('');

  openOverlay('attack-overlay');
}

function attackTarget(targetName, type) {
  closeOverlay('attack-overlay');
  const char = gameState.character;
  const attackRoll = Math.floor(Math.random() * 20) + 1;
  const damageRoll = Math.floor(Math.random() * 8) + 1 + Math.floor((char?.stats?.str - 10) / 2) || 0;

  addLog(`⚔ ${char?.name} attacks ${targetName}!`, 'action', char?.name);
  addLog(`🎲 Attack roll: [${attackRoll}] vs AC`, 'dice');

  setTimeout(() => {
    if (attackRoll >= 10) {
      addLog(`💥 HIT! ${damageRoll} damage dealt to ${targetName}!`, 'combat');
      if (attackRoll === 20) addLog(`CRITICAL HIT! Double damage dealt!`, 'holy');

      // Friendly fire check
      if (type === 'ally') {
        addLog(`⚠ WARNING: You attacked an ally! This will have consequences.`, 'dark');
        grantHellPoints(8);
      }
    } else {
      addLog(`Miss! Your attack glances off harmlessly.`, 'system');
    }
  }, 400);
}

// ─── SPELL MENU ───────────────────────────
function showSpellMenu() {
  const char = gameState.character;
  if (!char) return;
  const classId = char.class;
  const classSpells = SPELLS[classId] || [];
  const holySpells = char.holyPoints >= 10 ? SPELLS.holy : [];
  const darkSpells = char.hellPoints >= 10 ? SPELLS.dark : [];
  const allSpells = [...classSpells, ...holySpells, ...darkSpells];

  const list = document.getElementById('spell-list');
  list.innerHTML = allSpells.map(spell => `
    <div class="spell-card ${spell.type === 'holy' ? 'holy-spell' : spell.type === 'dark' ? 'dark-spell' : ''}"
         onclick="castSpell('${spell.id}')">
      <span class="sc-name">${spell.icon} ${spell.name}</span>
      <span class="sc-cost">MP: ${spell.mp} ${spell.holy_cost ? `| ✝ ${spell.holy_cost}HP` : ''} ${spell.hell_gain ? `| ⛧ +${spell.hell_gain}HP` : ''}</span>
      <span class="sc-desc">${spell.desc}${spell.friendly_fire ? ' ⚠ FRIENDLY FIRE' : ''}</span>
    </div>
  `).join('') || '<p style="color:var(--text-dim)">No spells available. Gain Holy or Hell points to unlock divine/dark powers.</p>';

  openOverlay('spell-overlay');
}

function castSpell(spellId) {
  const char = gameState.character;
  // Find spell across all spell lists
  let spell = null;
  for (const key of Object.keys(SPELLS)) {
    spell = SPELLS[key].find(s => s.id === spellId);
    if (spell) break;
  }
  if (!spell) return;

  closeOverlay('spell-overlay');

  if (char.mp < spell.mp) {
    toast('Not enough MP!', 'error');
    return;
  }
  if (spell.holy_cost && char.holyPoints < spell.holy_cost) {
    toast(`Need ${spell.holy_cost} Holy Points!`, 'error');
    return;
  }

  char.mp -= spell.mp;
  if (spell.holy_cost) char.holyPoints -= spell.holy_cost;
  if (spell.hell_gain) grantHellPoints(spell.hell_gain);

  addLog(`✨ ${char.name} casts ${spell.name}!`, 'action', char.name);

  setTimeout(() => {
    if (spell.damage) {
      const dmgRoll = rollDamageString(spell.damage, char.stats);
      addLog(`💥 ${spell.name} deals ${dmgRoll} ${spell.type} damage!`, spell.type === 'holy' ? 'holy' : spell.type === 'dark' ? 'dark' : 'combat');
    }

    if (spell.friendly_fire && Math.random() < 0.35) {
      const splash = Math.floor(Math.random() * 6) + 1;
      addLog(`⚠ FRIENDLY FIRE! The ${spell.name} splashes ${splash} damage onto Bresker!`, 'combat');
    }

    if (spell.type === 'heal') {
      const healRoll = rollDamageString(spell.damage || '2d8', char.stats);
      char.hp = Math.min(char.maxHp, char.hp + healRoll);
      addLog(`💚 Healed for ${healRoll} HP.`, 'holy');
    }

    renderPlayerCard();
  }, 400);
}

function rollDamageString(dmgStr, stats) {
  // Parse strings like "3d8+WIS", "2d6+4"
  const match = dmgStr.match(/(\d+)d(\d+)(\+(\w+))?/);
  if (!match) return parseInt(dmgStr) || 1;
  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  let total = Array.from({length: numDice}, () => Math.floor(Math.random() * dieSize) + 1).reduce((a,b) => a+b, 0);
  if (match[4]) {
    const statName = match[4].toLowerCase();
    if (stats && stats[statName]) {
      total += Math.floor((stats[statName] - 10) / 2);
    } else if (!isNaN(parseInt(match[4]))) {
      total += parseInt(match[4]);
    }
  }
  return Math.max(1, total);
}

// ─── QUEST LOG ────────────────────────────
function showQuestLog() {
  const content = document.getElementById('quest-overlay-content');
  const mainQuests = CHAPTER_1_QUESTS.filter(q => q.type === 'main').slice(0, 5);
  const sideQuests = CHAPTER_1_QUESTS.filter(q => q.type === 'side').slice(0, 3);
  const personalQuests = gameState.character?.personalQuests || [];

  content.innerHTML = `
    <div class="quest-section">
      <h4>☩ MAIN QUESTS — CHAPTER I</h4>
      ${mainQuests.map(q => `<div class="quest-full-item">
        <div class="qfi-title">${q.boss ? '💀 ' : ''}${q.title}</div>
        <div class="qfi-desc">${q.desc}</div>
        <div class="qfi-status active">● ACTIVE — ${q.xp} XP reward</div>
      </div>`).join('')}
    </div>
    <div class="quest-section">
      <h4>⚔ SIDE QUESTS</h4>
      ${sideQuests.map(q => `<div class="quest-full-item">
        <div class="qfi-title">${q.title}</div>
        <div class="qfi-desc">${q.desc}</div>
        <div class="qfi-status active">● AVAILABLE — ${q.xp} XP</div>
      </div>`).join('')}
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

// ─── AI NARRATOR ──────────────────────────
async function narrateMajorMoment(actionText) {
  openOverlay('narrator-overlay');
  document.getElementById('narrator-text').textContent = '';
  document.getElementById('narrator-typing').classList.remove('hidden');
  document.getElementById('narrator-close').style.display = 'none';

  const char = gameState.character;
  const cls = CLASSES.find(c => c.id === char?.class);
  const race = RACES.find(r => r.id === char?.race);
  const questTitle = gameState.activeQuests?.[0]?.title || 'The Shattered Covenant';

  const prompt = `You are the narrator of a dark fantasy RPG called "Sanctum & Shadow" — the tone is Game of Thrones meets Baldur's Gate 3, holy and profane, epic and gritty.

The current player character is: ${char?.name || 'Unknown'}, a ${race?.name || ''} ${cls?.name || ''} with ${char?.holyPoints || 0} Holy Points and ${char?.hellPoints || 0} Hell Points. The current quest is: "${questTitle}". Chapter 1: The Shattered Covenant.

The player just declared: "${actionText}"

Write a dramatic 2-3 paragraph narrative resolution of this moment. Make it cinematic, dark, and memorable. Reference the holy/hell balance if relevant. Keep it between 100-200 words. No preamble, just the narration.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('') || 'The fates are silent. The dice have spoken in ways beyond mortal comprehension.';

    document.getElementById('narrator-typing').classList.add('hidden');
    typewriterEffect('narrator-text', text, 25, () => {
      document.getElementById('narrator-close').style.display = 'block';
      addLog('📖 ' + text, 'narrator');
    });
  } catch (err) {
    document.getElementById('narrator-typing').classList.add('hidden');
    const fallback = `The moment hangs in the air, heavy with fate. ${char?.name} stands at the precipice of something that will be remembered long after bones have turned to dust. The chronicle records this deed. The angels and demons both take note.`;
    typewriterEffect('narrator-text', fallback, 25, () => {
      document.getElementById('narrator-close').style.display = 'block';
    });
  }
}

function typewriterEffect(elementId, text, speed, callback) {
  const el = document.getElementById(elementId);
  el.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      el.textContent += text[i];
      i++;
    } else {
      clearInterval(interval);
      if (callback) callback();
    }
  }, speed);
}

// ─── OVERLAY MANAGEMENT ───────────────────
function openOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeOverlay(id) {
  document.getElementById(id).classList.add('hidden');
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
  document.body.appendChild(c);
  return c;
}

// ─── KEYBOARD SHORTCUTS ───────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    if (gameState.activeScreen === 'game') submitAction();
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay:not(.hidden)').forEach(o => o.classList.add('hidden'));
  }
});

// ─── INIT ─────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
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
