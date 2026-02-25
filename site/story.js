// ============================================
//   SANCTUM & SHADOW — STORY ENGINE v3
//   Proactive narration, scene-driven options,
//   full consequence chains
// ============================================

// ─── SCENE STATE ─────────────────────────────
window.sceneState = {
  currentScene: 'arrival_vaelthar',
  flags: {},
  npcStates: {},
  history: [],
};

function setFlag(key, val = true) { window.sceneState.flags[key] = val; }
function getFlag(key) { return !!window.sceneState.flags[key]; }
function setNPCState(npc, state) { window.sceneState.npcStates[npc] = state; }
function getNPCState(npc) { return window.sceneState.npcStates[npc] || 'neutral'; }

// ─── SCENE PANEL UI ───────────────────────────
function showScene(sceneData) {
  const old = document.getElementById('scene-panel');
  if (old) old.remove();

  const panel = document.createElement('div');
  panel.id = 'scene-panel';
  panel.className = 'scene-panel';

  const isMP = !!(window.mp?.sessionCode);
  const playerCount = isMP ? Object.keys(window.mp?.session?.players || {}).length : 1;

  const optionsHTML = (sceneData.options || []).map((opt, i) => `
    <button class="scene-option ${opt.type || ''}" id="scene-opt-${i}" onclick="castVote(${i})">
      <span class="so-icon">${opt.icon || '▸'}</span>
      <span class="so-text">${opt.label}</span>
      ${opt.roll ? `<span class="so-roll">🎲 ${opt.roll.stat} DC${opt.roll.dc}</span>` : ''}
      <span class="so-votes" id="votes-${i}" style="display:none"></span>
    </button>
  `).join('');

  panel.innerHTML = `
    <div class="sp-inner">
      <div class="sp-location-bar">
        <span class="sp-loc-icon">${sceneData.locationIcon || '🏰'}</span>
        <span class="sp-loc-name">${sceneData.location || 'Vaelthar'}</span>
        ${sceneData.threat ? `<span class="sp-threat">${sceneData.threat}</span>` : ''}
        ${isMP ? `<span class="sp-vote-status" id="vote-status">⏳ 0/${playerCount} voted</span>` : ''}
      </div>
      <div class="sp-narration" id="sp-narration"></div>
      <div class="sp-options" id="sp-options">${optionsHTML}</div>
      <div class="sp-free-action">
        <span class="sp-free-hint">${isMP
          ? '🗳 All players vote — majority wins, ties broken by dice'
          : 'Or type any action freely below ↓'
        }</span>
      </div>
    </div>
  `;

  // Insert INSIDE the game log so it scrolls with the chat and never covers it
  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    gameLog.appendChild(panel);
    // Auto-scroll so the new scene is visible
    requestAnimationFrame(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else {
    document.body.appendChild(panel);
  }

  window.sceneState._currentOptions = sceneData.options || [];
  window.sceneState._currentScene = sceneData;
  window.sceneState._votes = {};
  window.sceneState._myVote = null;
  window.sceneState._playerCount = playerCount;

  const sceneStartedAt = Date.now();
  typewriteScene(sceneData.narration, sceneData.sub, window._sceneStartAt || 0);
  addLog(`📖 ${sceneData.location || 'Scene'}: ${sceneData.narration?.substring(0, 80)}...`, 'narrator');

  // Broadcast scene to all other players in MP
  if ((window.mp?.sessionCode || gameState?.sessionCode) && window.mpBroadcastStoryEvent) {
    const safeScene = {
      location: sceneData.location,
      locationIcon: sceneData.locationIcon,
      threat: sceneData.threat,
      narration: sceneData.narration,
      sub: sceneData.sub,
      options: (sceneData.options || []).map(o => ({
        label: o.label, icon: o.icon, type: o.type,
        roll: o.roll, cost: o.cost, next: o.next, nextFail: o.nextFail,
      })),
    };
    window.mpBroadcastStoryEvent('show_scene', { sceneData: safeScene, startedAt: sceneStartedAt });
  }
}

// ─── VOTE SYSTEM ─────────────────────────────
function castVote(index) {
  const isMP = !!(window.mp?.sessionCode);

  if (!isMP) {
    // Solo — just choose immediately
    chooseSceneOption(index);
    return;
  }

  const char = gameState.character;
  const playerId = window.mp.playerId;

  if (window.sceneState._myVote !== null) {
    addLog(`You already voted. Wait for others.`, 'system');
    return;
  }

  window.sceneState._myVote = index;
  window.sceneState._votes[playerId] = {
    index,
    playerName: char?.name || 'Unknown',
    roll: Math.floor(Math.random() * 20) + 1,
  };

  // Highlight my choice
  document.querySelectorAll('.scene-option').forEach(b => b.classList.remove('my-vote'));
  document.getElementById(`scene-opt-${index}`)?.classList.add('my-vote');
  addLog(`🗳 ${char?.name} votes: "${window.sceneState._currentOptions[index]?.label}"`, 'action');

  // Update vote display
  updateVoteDisplay();

  // Broadcast vote to party
  if (window.mpBroadcastStoryEvent) {
    window.mpBroadcastStoryEvent('player_vote', {
      playerId,
      playerName: char?.name || 'Unknown',
      index,
      roll: window.sceneState._votes[playerId].roll,
    });
  }

  // Check if all votes are in
  checkVoteResolution();
}

function receiveVote(playerId, playerName, index, roll) {
  window.sceneState._votes[playerId] = { index, playerName, roll };
  addLog(`🗳 ${playerName} votes: "${window.sceneState._currentOptions[index]?.label}"`, 'action');
  updateVoteDisplay();
  checkVoteResolution();
}

function updateVoteDisplay() {
  const votes = window.sceneState._votes;
  const options = window.sceneState._currentOptions;
  if (!options) return;

  const counts = {};
  Object.values(votes).forEach(v => {
    if (!counts[v.index]) counts[v.index] = [];
    counts[v.index].push(v.playerName);
  });

  const maxCount = Math.max(0, ...Object.values(counts).map(v => v.length));

  options.forEach((_, i) => {
    const el = document.getElementById(`votes-${i}`);
    const btn = document.getElementById(`scene-opt-${i}`);
    if (!el) return;
    const voters = counts[i] || [];
    if (voters.length > 0) {
      el.innerHTML = `<span class="vote-pip">${voters.map(n => '👤').join('')}</span><span class="vote-count">${voters.length}</span>`;
      el.style.display = 'flex';
    } else {
      el.innerHTML = '';
      el.style.display = 'none';
    }
    // Highlight leading option
    if (btn) btn.classList.toggle('winning', voters.length === maxCount && voters.length > 0);
  });

  const total = Object.keys(votes).length;
  const needed = window.sceneState._playerCount;
  const statusEl = document.getElementById('vote-status');
  if (statusEl) {
    statusEl.textContent = `⏳ ${total}/${needed} voted`;
    if (total >= needed) { statusEl.textContent = '✅ All voted!'; statusEl.style.color = '#4a9a6a'; }
  }
}

function checkVoteResolution() {
  const votes = window.sceneState._votes;
  const needed = window.sceneState._playerCount;
  const total = Object.keys(votes).length;

  if (total < needed) return; // not everyone voted yet

  // Count votes per option
  const counts = {};
  Object.values(votes).forEach(v => {
    counts[v.index] = (counts[v.index] || 0) + 1;
  });

  const maxVotes = Math.max(...Object.values(counts));
  const winners = Object.keys(counts).filter(i => counts[i] === maxVotes).map(Number);

  let chosenIndex;
  if (winners.length === 1) {
    // Clear majority
    chosenIndex = winners[0];
    addLog(`🗳 Party votes resolved: "${window.sceneState._currentOptions[chosenIndex]?.label}" wins (${maxVotes} vote${maxVotes>1?'s':''})`, 'system');
  } else {
    // Tie — highest dice roll among tied voters wins
    let bestRoll = -1;
    let bestIndex = winners[0];
    winners.forEach(optIdx => {
      Object.values(votes).forEach(v => {
        if (v.index === optIdx && v.roll > bestRoll) {
          bestRoll = v.roll;
          bestIndex = optIdx;
          addLog(`🎲 Tiebreak — ${v.playerName} rolled [${v.roll}] for "${window.sceneState._currentOptions[optIdx]?.label}"`, 'dice');
        }
      });
    });
    chosenIndex = bestIndex;
    addLog(`🗳 Tie broken by dice! "${window.sceneState._currentOptions[chosenIndex]?.label}" wins`, 'system');
  }

  // Update status
  const statusEl = document.getElementById('vote-status');
  if (statusEl) { statusEl.textContent = `✅ Decided!`; statusEl.style.color = '#4a9a6a'; }

  // Broadcast resolution to all other players
  if ((window.mp?.sessionCode || gameState?.sessionCode) && window.mpBroadcastStoryEvent) {
    window.mpBroadcastStoryEvent('scene_resolved', {
      index: chosenIndex,
      label: window.sceneState._currentOptions[chosenIndex]?.label || '',
    });
  }

  // Execute the winning choice after a short delay
  setTimeout(() => executeSceneOption(chosenIndex), 800);
}

function executeSceneOption(index) {
  const option = window.sceneState._currentOptions[index];
  if (!option) return;
  const char = gameState.character;

  if (option.roll) {
    const stat = option.roll.stat.toLowerCase();
    const statVal = char?.stats?.[stat] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const success = total >= option.roll.dc || roll === 20;
    const crit = roll === 20;
    const fumble = roll === 1;
    addLog(`🎲 ${option.roll.stat} check DC${option.roll.dc}: [${roll}] + ${mod>=0?'+':''}${mod} = ${total} — ${crit?'CRITICAL!':fumble?'FUMBLE!':success?'Success!':'Failure!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();
    if (option.onSuccess && success) option.onSuccess(roll, total);
    else if (option.onFail && !success) option.onFail(roll, total);
    else if (success && option.next) setTimeout(() => runScene(option.next), 600);
    else if (!success) {
      if (option.nextFail) setTimeout(() => runScene(option.nextFail), 600);
      else if (option.next) setTimeout(() => runScene(option.next + '_fail'), 600);
    }
  } else {
    if (option.action) option.action();
    else if (option.next) setTimeout(() => runScene(option.next), 400);
  }

  // Close modal
  setTimeout(() => {
    const panel = document.getElementById('scene-panel');
    if (panel) { panel.style.opacity = '0'; setTimeout(() => panel?.remove(), 400); }
  }, 300);
}



function typewriteScene(text, sub, startAt = 0) {
  const el = document.getElementById('sp-narration');
  if (!el) return;
  el.innerHTML = '';
  let i = startAt;
  if (startAt > 0) el.textContent = text.substring(0, startAt); // catch up instantly
  const interval = setInterval(() => {
    if (i < text.length) { el.textContent += text[i]; i++; }
    else {
      clearInterval(interval);
      if (sub) {
        const subEl = document.createElement('div');
        subEl.className = 'sp-sub';
        subEl.textContent = sub;
        el.appendChild(subEl);
      }
    }
  }, 14);
}

function chooseSceneOption(index) {
  // In multiplayer, castVote handles this. In solo, execute directly.
  const isMP = !!(window.mp?.sessionCode);
  if (isMP) {
    castVote(index);
  } else {
    const option = window.sceneState._currentOptions[index];
    if (!option) return;
    const char = gameState.character;
    addLog(`${char?.name}: ${option.label}`, 'action', char?.name);
    executeSceneOption(index);
  }
}

// ─── SCENE RUNNER ────────────────────────────
function runScene(sceneId) {
  const scene = SCENES[sceneId];
  if (!scene) {
    // AI-generate the scene
    generateAIScene(sceneId);
    return;
  }
  if (typeof scene === 'function') {
    const built = scene();
    if (built) showScene(built);
  } else {
    showScene(scene);
  }
}

// ─── AI SCENE GENERATOR ──────────────────────
async function generateAIScene(context) {
  const char = gameState.character;
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const cls = CLASSES.find(c => c.id === char?.class);
  const race = RACES.find(r => r.id === char?.race);
  const flags = Object.keys(window.sceneState.flags).join(', ') || 'none';
  const history = window.sceneState.history.slice(-5).join(' → ') || 'just arrived';

  const prompt = `You are the DM of "Sanctum & Shadow", a dark fantasy RPG. Generate a scene response.

Player: ${char?.name}, ${race?.name} ${cls?.name}, Level ${char?.level}
Location: ${loc?.name} — ${loc?.subtitle}
Story flags: ${flags}
Recent path: ${history}
Current situation: ${context}

Respond with a JSON object (no markdown, just raw JSON):
{
  "narration": "2-3 sentence atmospheric description of what the player sees/experiences right now. Be specific and vivid.",
  "sub": "1 sentence hint of what seems most important to investigate",
  "location": "${loc?.name}",
  "locationIcon": "${loc?.icon || '🏰'}",
  "options": [
    {"icon": "💬", "label": "Talk to [specific NPC name]", "type": "talk", "next": "scene_id"},
    {"icon": "⚔", "label": "Attack [specific target]", "type": "combat", "roll": {"stat": "STR", "dc": 12}, "next": "scene_id"},
    {"icon": "🔍", "label": "Investigate [specific thing]", "type": "explore", "next": "scene_id"},
    {"icon": "🏃", "label": "Leave / Move to [location]", "type": "move", "next": "scene_id"}
  ]
}

Make options SPECIFIC to the current context. Reference actual NPC names (Captain Rhael, The Trembling Scribe, Sister Mourne). Make the investigation option reveal something plot-relevant. Always give a move option.`;

  try {
    const response = await fetch("/api/npc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const raw = data.content?.map(i => i.text || '').join('').trim();
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Wire up options with AI continuation
    parsed.options = parsed.options.map(opt => ({
      ...opt,
      action: () => {
        window.sceneState.history.push(opt.label);
        generateAIScene(`Player chose: "${opt.label}" in context: ${context}`);
      }
    }));

    showScene(parsed);
  } catch(e) {
    // Fallback scene
    runScene('vaelthar_main');
  }
}

// ─── ALL MISSING SCENES — appended to SCENES object ───────────────────────
// These replace every runScene() call that previously fell through to AI improv

const MISSING_SCENES = {

  // ══════════════════════════════════════════
  //  VAELTHAR MAIN PATH — missing transitions
  // ══════════════════════════════════════════

  vaelthar_main: () => ({
    location: 'Vaelthar — The Fractured Capital',
    locationIcon: '🏰',
    threat: '⚠ Political Crisis',
    narration: `You're in the heart of Vaelthar and the city is holding its breath. The Covenant shattered three days ago. Church soldiers stand on corners they don't usually stand on. Merchants packed up early. Something bad is coming, and everyone can feel it except the people in charge of stopping it.`,
    sub: `Find the truth before the city tears itself apart.`,
    options: [
      { icon: '💬', label: 'Find Captain Rhael at the city gate', type: 'talk', action: () => runScene('rhael_first_meeting') },
      { icon: '👁', label: 'Look for the Trembling Scribe near the Archive', type: 'explore', action: () => runScene('scribe_observation') },
      { icon: '🗺', label: 'Scout the square — read the situation', type: 'move', action: () => runScene('vaelthar_scout') },
      { icon: '🗺', label: 'Travel to the Temple Quarter', type: 'move', action: () => runScene('temple_quarter_arrival') },
    ]
  }),

  vaelthar_fugitive: () => {
    setFlag('wanted');
    grantHellPoints(3);
    return {
      location: 'Vaelthar Back Streets',
      locationIcon: '🏚',
      threat: '⚠ WANTED',
      narration: `You disappear into the warren of back alleys behind the market district, guards' boots loud on the cobblestones behind you. Two turns, three more, then silence. You press against a wet wall and listen. Nothing. You've lost them — for now. But your face has been seen. Every Watch soldier in Vaelthar will have your description by nightfall. You need allies, and you need them fast.`,
      sub: `You're wanted. Move carefully. The Scribe or Mourne might still help you.`,
      options: [
        { icon: '🕵', label: 'Disguise yourself — find a cloak and stay low', type: 'explore',
          roll: { stat: 'DEX', dc: 11 },
          onSuccess: () => { setFlag('disguised'); addLog('📜 You found a merchant\'s cloak. Guards won\'t recognise you on sight.', 'system'); runScene('vaelthar_main'); },
          onFail: () => { addLog('A guard spots your face through a gap. You run again.', 'combat'); runScene('vaelthar_fugitive'); } },
        { icon: '🗺', label: 'Head to the Temple Quarter — find Sister Mourne', type: 'move',
          action: () => runScene('temple_quarter_arrival') },
        { icon: '💬', label: 'Find the Scribe — he\'s the only one who can clear this', type: 'talk',
          action: () => runScene('scribe_urgent') },
      ]
    };
  },

  rhael_warns_about_scribe: () => {
    setFlag('rhael_mentioned_scribe');
    return {
      location: 'Vaelthar Gate — Rhael',
      locationIcon: '🪖',
      narration: `Rhael leans closer, voice dropping. "The man near the Archive. His name is Aldis — senior scribe, loyal to the original Covenant charter. He was the official witness at the signing." A pause. "He copied something he shouldn't have. I don't know what. But the Church sent two agents to find him this morning, and they didn't go to ask politely." He straightens. "Whatever he has — you want it before they get to him."`,
      sub: `Get to the Scribe before the Church agents do.`,
      options: [
        { icon: '🏃', label: 'Go to the Scribe right now', type: 'move', action: () => runScene('scribe_urgent') },
        { icon: '💬', label: '"What do you know about Elder Varek?"', type: 'talk',
          roll: { stat: 'CHA', dc: 13 },
          onSuccess: () => runScene('rhael_reveals_covenant'),
          onFail: () => runScene('rhael_stonewalls') },
      ]
    };
  },

  rhael_deflects: () => ({
    location: 'Vaelthar Gate',
    locationIcon: '🪖',
    narration: `Rhael's eyes slide away from yours. "I look at a lot of things. Doesn't mean anything." He shifts his weight and looks at a point past your shoulder. "My job is the gate. Not the Archive." He's lying. Not well, but with enough conviction that pushing further right now would only close him off completely.`,
    sub: `He's not ready to trust you yet. Come back with evidence, or find another angle.`,
    options: [
      { icon: '👁', label: 'Go find the Scribe — get evidence first', type: 'move', action: () => runScene('scribe_approach') },
      { icon: '🔍', label: 'Push harder — you saw what you saw', type: 'talk',
        roll: { stat: 'CHA', dc: 14 },
        onSuccess: () => runScene('rhael_warns_about_scribe'),
        onFail: () => runScene('rhael_stonewalls') },
    ]
  }),

  rhael_names_higherpower: () => {
    setFlag('knows_elder_name');
    addLog('📜 REVELATION: Elder Varek of the Eternal Flame gave the order to burn the Covenant.', 'holy');
    return {
      location: 'Vaelthar Gate — Rhael',
      locationIcon: '🪖',
      narration: `Rhael says the name like he's dropping something heavy. "Elder Varek. Head of the Eternal Flame order. He gave the order directly — I don't have proof, but I heard it from someone who was in that room." His jaw is tight. "He's at the Monastery of Saint Aldric right now, waiting for the dust to settle. But if he realises the Scribe survived with evidence — he'll send the Candle to clean it up."`,
      sub: `Elder Varek is at the Monastery. Move before he disappears.`,
      options: [
        { icon: '🗺', label: 'Go directly to the Monastery', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
        { icon: '💬', label: '"Come with me — I need a Watch captain at my back"', type: 'talk',
          roll: { stat: 'CHA', dc: 15 },
          onSuccess: () => { setFlag('rhael_comes_along'); addLog('📜 Captain Rhael will meet you at the Monastery gates.', 'holy'); runScene('monastery_arrival'); },
          onFail: () => runScene('rhael_clams_up') },
      ]
    };
  },

  rhael_clams_up: () => ({
    location: 'Vaelthar Gate',
    locationIcon: '🪖',
    narration: `Something flickers across Rhael's face — fear, maybe, or the memory of fear. "I've said enough. More than enough." He steps back. "Whatever you're planning to do with this — leave my name out of it." He turns to face the gate and doesn't look back.`,
    sub: `He's done talking. You have what you need. Move without him.`,
    options: [
      { icon: '🗺', label: 'Head to the Monastery alone', type: 'move',
        action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      { icon: '🗺', label: 'Find Sister Mourne first', type: 'move', action: () => runScene('temple_quarter_arrival') },
    ]
  }),

  rhael_too_afraid: () => ({
    location: 'Vaelthar Gate',
    locationIcon: '🪖',
    narration: `Rhael shakes his head once. His eyes have gone flat, the way eyes go when a man has decided he values his life over his conscience — for now, at least. "I have a family," he says, and that's all. He walks away. You won't get the name from him today.`,
    sub: `He's too afraid. Find the Scribe — he has written proof.`,
    options: [
      { icon: '🏃', label: 'Go find the Scribe instead', type: 'move', action: () => runScene('scribe_urgent') },
    ]
  }),

  rhael_with_evidence: () => {
    setFlag('rhael_has_evidence_copy');
    addLog('📜 Captain Rhael has seen the document. He\'s with you now.', 'holy');
    grantHolyPoints(5);
    return {
      location: 'Vaelthar Gate — Rhael',
      locationIcon: '🪖',
      narration: `Rhael reads the document twice. Then a third time. When he looks up his face has changed — not shocked, exactly, but the kind of settled that comes from having a suspicion confirmed after too long. "Elder Varek." He folds the document carefully and hands it back. "Right. Here's what happens now. I mobilise two squads and we go to the Monastery. You're a civilian witness. You don't touch Varek — I do." He's already moving. "Try to keep up."`,
      sub: `Rhael is taking charge. Head to the Monastery together.`,
      options: [
        { icon: '🗺', label: 'Head to the Monastery with Rhael', type: 'move',
          action: () => { setFlag('rhael_comes_along'); if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
        { icon: '💬', label: '"Let me confront Varek my way first"', type: 'talk',
          action: () => runScene('monastery_arrival') },
      ]
    };
  },

  covenant_hall_scene: () => {
    addLog('📜 CLUE: The Covenant signing hall was burned deliberately. Church-side accelerant.', 'holy');
    return {
      location: 'Covenant Signing Hall — Ruins',
      locationIcon: '🏛',
      threat: '⚠ Evidence Site',
      narration: `The signing hall is a shell now — scorched beams, shattered ceremonial table, ash where the treaty documents should be. But you were trained to look. The burn pattern starts from the Church delegation's side of the table. The fire moved outward — not inward from an accident. And wedged under a piece of collapsed ceiling: a half-burned wax seal. You recognise it from the Scribe's document. Elder Varek's seal.`,
      sub: `Physical proof the fire was set from the Church side. Varek's seal confirms it.`,
      options: [
        { icon: '📜', label: 'Take the wax seal as evidence', type: 'explore',
          action: () => { addLog('📜 ITEM GAINED: Varek\'s Wax Seal — physical evidence from the burning.', 'holy'); gameState.character?.inventory?.push("Varek's Wax Seal"); runScene('rhael_first_meeting'); } },
        { icon: '🔍', label: 'Look for more evidence in the ruins', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { addLog('📜 CLUE: A scorch pattern in the corner suggests someone hid and watched the burning.', 'holy'); runScene('scribe_approach'); },
          onFail: () => runScene('rhael_first_meeting') },
      ]
    };
  },

  // ── SCRIBE MISSING SCENES ─────────────────

  scribe_document_glimpse: () => {
    addLog('📜 CLUE: The document roll bears Elder Varek\'s seal — you saw it from a distance.', 'holy');
    return {
      location: 'Archive Steps',
      locationIcon: '📜',
      narration: `At the angle you're watching from, the document roll tips just enough. Wax seal, deep red. You know that crest — it's the mark of an Elder of the Eternal Flame. This isn't a scribe's working copy. This is an original order. The man is carrying something that could get him killed, and he knows it.`,
      sub: `That's an Elder's sealed order. Approach him — carefully.`,
      options: [
        { icon: '💬', label: 'Approach him now — you know what he has', type: 'talk', action: () => runScene('scribe_approach') },
      ]
    };
  },

  scribe_hesitates: () => ({
    location: 'Archive Steps',
    locationIcon: '📜',
    narration: `The Scribe pulls the document back. "I don't know you. I don't know who sent you, whose side you're on." His eyes are wet but his grip is iron. "Torven is dead. I give this to the wrong person and I'm next. How do I know you're not one of Varek's people?"`,
    sub: `He needs a reason to trust you. Give him one.`,
    options: [
      { icon: '💬', label: '"I\'m not Watch, not Church. I work alone."', type: 'talk',
        roll: { stat: 'CHA', dc: 11 },
        onSuccess: () => { setFlag('has_document'); runScene('scribe_gives_document'); },
        onFail: () => runScene('scribe_approach') },
      { icon: '🔍', label: 'Show him the fountain button — proof you found the murder scene', type: 'talk',
        action: () => {
          if (getFlag('found_blood_evidence')) { setFlag('has_document'); addLog('📜 The fountain button convinces him. He hands over the document.', 'holy'); runScene('scribe_gives_document'); }
          else runScene('scribe_approach');
        }},
    ]
  }),

  scribe_names_varek_location: () => {
    setFlag('knows_varek_location');
    return {
      location: 'Archive Steps',
      locationIcon: '📜',
      narration: `"The Monastery of Saint Aldric," the Scribe says without hesitation. "Elder Varek retreated there the morning after the Covenant burned. He has four Church soldiers with him. He thinks he's safe — the Church owns the monastery and the Abbot owes him a favour." He grips your arm. "But he doesn't know I survived. He thinks his order burned with everything else."`,
      sub: `Varek is at the Monastery. He doesn't know the evidence survived.`,
      options: [
        { icon: '🔐', label: '"Give me the document. I\'ll end this."', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => { setFlag('has_document'); runScene('scribe_gives_document'); },
          onFail: () => runScene('scribe_hesitates') },
        { icon: '🗺', label: 'Go to the Monastery immediately — you already have enough', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      ]
    };
  },

  scribe_names_candle: () => {
    addLog('📜 CLUE: "The Candle" is Sister Mourne — Elder Varek\'s enforcer in Vaelthar.', 'holy');
    return {
      location: 'Archive Steps',
      locationIcon: '📜',
      narration: `The Scribe's voice drops to almost nothing. "The Candle — that's what they call her. An agent of the Elder, embedded in the Temple Quarter for years. Her job is to burn things. Evidence. Reputations." He pauses. "People." He looks at you. "I think it's Sister Mourne. The inquisitor. She was at the signing hall that morning — I saw her leave just before the fire started."`,
      sub: `Sister Mourne is "The Candle." She may be at the Temple Quarter now.`,
      options: [
        { icon: '🗺', label: 'Go to the Temple Quarter — confront Mourne', type: 'move',
          action: () => { setFlag('heading_to_temple'); runScene('temple_quarter_arrival'); } },
        { icon: '🗺', label: 'Go straight to the Monastery — skip Mourne', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      ]
    };
  },

  scribe_joins_party: () => {
    setFlag('scribe_in_party');
    addLog('📜 The Trembling Scribe (Aldis) is travelling with you.', 'holy');
    grantHolyPoints(3);
    return {
      location: 'Vaelthar — Moving',
      locationIcon: '📜',
      narration: `Aldis falls into step beside you, clutching his document roll like a holy relic. "Where are we going?" he asks. "Somewhere the Church can't reach us," you say. He almost laughs. "In Vaelthar? That's a short list." You move quickly through the back streets. He's useful — he knows the city's layout, which doors the Church watches, and the names of three people who might be willing to help.`,
      sub: `Aldis is with you. He knows things. Use them.`,
      options: [
        { icon: '💬', label: '"Tell me everything about Elder Varek"', type: 'talk', action: () => runScene('scribe_names_varek_location') },
        { icon: '🗺', label: 'Head to the Temple Quarter — find Sister Mourne', type: 'move', action: () => runScene('temple_quarter_arrival') },
        { icon: '🗺', label: 'Go straight to the Monastery', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      ]
    };
  },

  scribe_refuses_to_move: () => ({
    location: 'Archive Steps',
    locationIcon: '📜',
    narration: `"I can't," Aldis says. "If I leave the Archive steps they'll know I ran. They'll know I have something." He's shaking. "If I stay and look normal, maybe — maybe they leave me alone." He believes this. He shouldn't. You can see one of the Church agents at the end of the street, pretending to read a notice board.`,
    sub: `He won't move. You need to change his mind fast or drag him out.`,
    options: [
      { icon: '💬', label: '"They\'ve already decided. That man at the end of the street — look."', type: 'talk',
        action: () => runScene('scribe_urgent') },
      { icon: '😠', label: 'Grab him and move — no time for arguments', type: 'combat',
        roll: { stat: 'STR', dc: 8 },
        onSuccess: () => { setFlag('scribe_captured'); runScene('scribe_forced_along'); },
        onFail: () => runScene('scribe_screams') },
    ]
  }),

  scribe_forced_along: () => ({
    location: 'Vaelthar Streets',
    locationIcon: '📜',
    narration: `He comes along because he has no choice. He's not happy about it — curses you under his breath for the first three streets, then falls silent and focuses on keeping up. By the time you reach a safe alley he's stopped resisting. "Fine," he says, out of breath. "Fine. You're right. They were going to kill me." He reaches into his robe. "Take it. Take the document. If I have it when they catch me, I'm dead. If you have it — maybe it does some good."`,
    sub: `He's given you the document. Now protect him.`,
    options: [
      { icon: '📜', label: 'Take the document and find somewhere safe for him', type: 'talk',
        action: () => { setFlag('has_document'); addLog('📜 ITEM GAINED: Elder Varek\'s Sealed Order.', 'holy'); gameState.character?.inventory?.push("Elder Varek's Sealed Order"); runScene('scribe_rescued_scene'); } },
    ]
  }),

  scribe_screams: () => {
    setFlag('guards_alerted');
    grantHellPoints(5);
    return {
      location: 'Archive Steps — CHAOS',
      locationIcon: '📜',
      threat: '☠ EXPOSED',
      narration: `He shouts. Not words — just a raw, terrified sound that echoes off the stone buildings and brings every head on the street around. The Church agents at the end of the road are already moving. Guards from the gate come at a run. The Scribe scrambles back against the Archive door, wide-eyed, the document clutched to his chest. You have three seconds before this gets very bad.`,
      sub: `Run or fight — you can't stay here.`,
      options: [
        { icon: '🏃', label: 'Run — get out of the square', type: 'move',
          roll: { stat: 'DEX', dc: 13 },
          onSuccess: () => runScene('vaelthar_fugitive'),
          onFail: () => runScene('arrested_scene') },
        { icon: '⚔', label: 'Fight the agents — protect the Scribe', type: 'combat',
          action: () => startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]) },
      ]
    };
  },

  scribe_tells_all_now: () => {
    setFlag('scribe_told_all');
    addLog('📜 REVELATION: The Covenant had a hidden clause stripping Church independence. Varek knew.', 'holy');
    return {
      location: 'Vaelthar Alley',
      locationIcon: '🏚',
      narration: `Aldis leans against the alley wall and talks for four straight minutes without stopping — the signed order, the hidden treasury clause on page four of the original Covenant, Elder Varek's meetings with "The Candle" the week before the signing, the fact that Torven photographically memorised the document before he was killed. When he finishes, he looks hollowed out. "That's everything. Every last thing I know. Now please — what do we do?"`,
      sub: `You have the full picture. Elder Varek at the Monastery. End this.`,
      options: [
        { icon: '🗺', label: 'Head to the Monastery — you have everything you need', type: 'move',
          action: () => { setFlag('has_document'); gameState.character?.inventory?.push("Elder Varek's Sealed Order"); if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
        { icon: '💬', label: 'Get Rhael first — you need muscle', type: 'talk',
          action: () => runScene('rhael_with_evidence') },
      ]
    };
  },

  thornwood_gate_inn: () => {
    setFlag('at_thornwood_inn');
    return {
      location: 'The Last Post — Thornwood Gate Inn',
      locationIcon: '🍺',
      threat: '⚠ Curfew Near',
      narration: `The Last Post is half-empty, which suits your purposes. Aldis is already in the back corner, a tankard he hasn't touched in front of him. He's calmer than when you last saw him — the kind of calm that comes after a decision. "I've been thinking," he says before you sit. "About what happens after Varek is arrested. Someone ordered the hidden clause written into the Covenant. Varek followed that order. The question is: who gave it?" He slides a folded paper across the table. "I found this in the Archive. Before they changed the locks."`,
      sub: `There's a layer above Varek. Someone gave him the order.`,
      options: [
        { icon: '📜', label: 'Read the paper', type: 'explore',
          action: () => { setFlag('knows_higherpower'); addLog('📜 REVELATION: The hidden clause was inserted by a royal clerk — someone inside the Crown, not just the Church.', 'holy'); runScene('scribe_tells_all_now'); } },
        { icon: '💬', label: '"We deal with Varek first. One thing at a time."', type: 'talk',
          action: () => { setFlag('has_document'); gameState.character?.inventory?.push("Elder Varek's Sealed Order"); runScene('monastery_arrival'); } },
      ]
    };
  },

  // ── MOURNE MISSING SCENES ─────────────────

  mourne_observed: () => ({
    location: 'Temple Quarter — Watching Mourne',
    locationIcon: '🕯',
    narration: `You stay in the shadow of a column and watch her. She's been kneeling for a long time — but not in prayer. Her lips aren't moving. She's thinking. Every few minutes she glances at the side door to the left of the altar. Checking it. Waiting. She's expecting someone — and she's prepared for them not to be friendly.`,
    sub: `She's waiting for you specifically. She knows you're coming. Go to her.`,
    options: [
      { icon: '💬', label: 'Approach her — she knows you\'re there', type: 'talk',
        action: () => runScene('mourne_confrontation') },
      { icon: '🔍', label: 'Check the side door she keeps watching', type: 'explore',
        roll: { stat: 'WIS', dc: 11 },
        onSuccess: () => { setFlag('saw_agents'); addLog('📜 CLUE: Two Church agents are waiting outside the side door. She has backup.', 'holy'); runScene('mourne_agents_spotted'); },
        onFail: () => runScene('mourne_confrontation') },
    ]
  }),

  mourne_agents_spotted: () => {
    addLog('📜 CLUE: Two Church agents are positioned near Sister Mourne. She has protection — or supervision.', 'holy');
    return {
      location: 'Temple Quarter — Flanked',
      locationIcon: '🕯',
      threat: '⚠ Agents Present',
      narration: `You move to the side colonnade and there they are — two men in grey coats, faces neutral, hands free. Not Mourne's guards. Their eyes are on her as much as on the entrance. They're watching her. That's interesting. Maybe Elder Varek doesn't fully trust his own agent either. The moment you confront Mourne, they'll move. You need to decide how to play this.`,
      sub: `The agents are watching Mourne, not just guarding her. She may not be fully loyal to Varek.`,
      options: [
        { icon: '💬', label: 'Confront Mourne openly — let the agents see it', type: 'talk',
          action: () => runScene('mourne_confrontation') },
        { icon: '😠', label: 'Deal with the agents first — neutralise them quietly', type: 'combat',
          roll: { stat: 'DEX', dc: 13 },
          onSuccess: () => { addLog('The agents are dealt with. Mourne saw it. Her expression changed.', 'system'); setFlag('agents_neutralised'); runScene('mourne_confrontation'); },
          onFail: () => startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]) },
        { icon: '💬', label: 'Signal to Mourne — let her know you\'re alone and talking', type: 'talk',
          action: () => runScene('mourne_confrontation') },
      ]
    };
  },

  mourne_surrenders: () => {
    setFlag('mourne_in_custody');
    grantHolyPoints(8);
    grantXP(300);
    addLog('📜 Sister Mourne surrenders peacefully. She will testify against Elder Varek.', 'holy');
    return {
      location: 'Temple Quarter',
      locationIcon: '🕯',
      narration: `Mourne holds your gaze for a long moment. Then she nods, once. "Alright." She removes a small knife from her sleeve — you tense — but she sets it on the altar rail. "I won't run. I won't resist." She turns to face the nave. "I want it on record that I acted on Elder Varek's direct order. I want that part clear." She walks toward the door. "Shall we go?"`,
      sub: `Mourne is in custody. She'll testify. Now find Varek.`,
      options: [
        { icon: '🗺', label: 'Take Mourne to Captain Rhael, then head for the Monastery', type: 'move',
          action: () => { setFlag('rhael_has_mourne'); addLog('📜 Mourne is with Rhael. He\'s holding her as a witness.', 'holy'); runScene('rhael_with_evidence'); } },
        { icon: '🗺', label: 'Go directly to the Monastery — Varek is the priority', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      ]
    };
  },

  mourne_refuses_arrest: () => {
    setNPCState('mourne', 'hostile');
    return {
      location: 'Temple Quarter',
      locationIcon: '🕯',
      threat: '⚠ Turning Hostile',
      narration: `Something closes in Mourne's expression. "No." The word is flat. "I acted to protect the Church's independence. I will not be handed to a Watch captain to stand trial for that." She steps back toward the altar. "You can arrest me when you have a court that understands the difference between law and justice. Until then—" Her hand moves to something under her robe.`,
      sub: `She's going to fight or run. Last chance to change her mind.`,
      options: [
        { icon: '💬', label: '"The Covenant had a clause that would have destroyed the Church. I know."', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => runScene('mourne_becomes_ally'),
          onFail: () => startCombat([{ name: 'Sister Mourne', hp: 65, ac: 14, atk: 6, icon: '🕯', id: 'mourne' }]) },
        { icon: '⚔', label: 'Don\'t let her draw — attack now', type: 'combat',
          action: () => startCombat([{ name: 'Sister Mourne', hp: 65, ac: 14, atk: 6, icon: '🕯', id: 'mourne' }]) },
      ]
    };
  },

  mourne_sees_through_deal: () => ({
    location: 'Temple Quarter',
    locationIcon: '🕯',
    narration: `Mourne looks at you for a long moment, then almost smiles. "You don't have the authority to make that deal. And even if you did — I don't trust it." She shakes her head. "You're offering something you can't guarantee, to someone who's already made peace with the consequences." She folds her hands. "Try something honest. It might work better."`,
    sub: `She saw through it. Try a different angle.`,
    options: [
      { icon: '💬', label: '"Then help me because it\'s the right thing — not for a deal"', type: 'talk',
        roll: { stat: 'CHA', dc: 13 },
        onSuccess: () => runScene('mourne_becomes_ally'),
        onFail: () => runScene('mourne_refuses_arrest') },
      { icon: '⚖', label: '"Then you\'re under arrest. Final offer."', type: 'talk',
        roll: { stat: 'CHA', dc: 14 },
        onSuccess: () => runScene('mourne_surrenders'),
        onFail: () => runScene('mourne_refuses_arrest') },
    ]
  }),

  mourne_reveals_varek: () => {
    setFlag('knows_varek_location');
    return {
      location: 'Temple Quarter',
      locationIcon: '🕯',
      narration: `"The Monastery of Saint Aldric," Mourne says. "He's been there since the morning of the burning. Four soldiers, the Abbot's hospitality, and the certainty that no one can touch a Church Elder in a Church building." She pauses. "He's wrong about that last part. The Abbot is terrified of him, not loyal. And the soldiers — they're guards, not martyrs." She looks at the document in your hands. "That seal is enough. Show it to him. He'll know the Scribe survived."`,
      sub: `Varek is at the Monastery. The evidence will force his hand.`,
      options: [
        { icon: '🗺', label: 'Go to the Monastery — end this', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
        { icon: '🤝', label: '"Come with me. I need you there."', type: 'talk',
          action: () => { setFlag('mourne_allied'); runScene('mourne_becomes_ally'); } },
      ]
    };
  },

  mourne_briefs_on_varek: () => {
    addLog('📜 INTEL: Elder Varek has four soldiers, believes evidence is destroyed, expects no confrontation.', 'holy');
    return {
      location: 'Temple Quarter — Moving',
      locationIcon: '🕯',
      narration: `As you walk, Mourne talks. "Varek is sixty-three. He's never personally fought anyone — he gives orders. His four soldiers are Church-trained, not Watch-trained. Loyal to the institution, but not fanatically to him." She glances sideways. "He has one habit that may matter: when he's cornered, he offers money. A great deal of money. Don't let that slow you down." She pulls her hood up. "He'll recognise me on sight. That may help or hurt depending on how he reads the situation."`,
      sub: `Four soldiers. Varek won't fight himself. Show him the evidence immediately.`,
      options: [
        { icon: '🗺', label: 'Head to the Monastery', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      ]
    };
  },

  // ── GAOL / ARREST MISSING SCENES ──────────

  escaped_cell: () => {
    setFlag('escaped_gaol');
    grantHolyPoints(3);
    return {
      location: 'Vaelthar — Escaped',
      locationIcon: '🏚',
      narration: `The lock gives with a sound like a sigh. The corridor is empty — guard change was two minutes ago, you counted. You're out of the cell, through the watch-house back room, and into an alley before anyone notices the door is open. You pause in the dark, breathing. You have no weapons. You're marked as a fugitive. And you have maybe an hour before the manhunt starts properly.`,
      sub: `Free, unarmed, wanted. Use it while you have the lead.`,
      options: [
        { icon: '🔍', label: 'Recover your weapons — you saw where they stored them', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { addLog('📜 Weapons recovered from the evidence room.', 'holy'); setFlag('weapons_recovered'); runScene('vaelthar_fugitive'); },
          onFail: () => { addLog('A guard sees you in the corridor. You run without your weapons.', 'combat'); runScene('vaelthar_fugitive'); } },
        { icon: '🗺', label: 'Leave now — get to the Scribe before they find you', type: 'move',
          action: () => runScene('vaelthar_fugitive') },
      ]
    };
  },

  failed_escape: () => ({
    location: 'Vaelthar Gaol',
    locationIcon: '⛓',
    narration: `The nail bends wrong and the lock holds. A guard passes and you get back on the straw just in time. He doesn't look in. When he's gone you try again — nothing. The lock is better than it looks. You're going to need a different approach.`,
    sub: `The lock won't give. Try talking your way out instead.`,
    options: [
      { icon: '💬', label: 'Call the guard — use words instead of picks', type: 'talk',
        roll: { stat: 'CHA', dc: 12 },
        onSuccess: () => runScene('released_by_rhael'),
        onFail: () => runScene('guard_ignores_you') },
      { icon: '😠', label: 'Wait for Rhael. He\'ll come.', type: 'explore',
        action: () => runScene('rhael_visits_cell') },
    ]
  }),

  released_by_rhael: () => {
    setFlag('released_by_rhael');
    grantHolyPoints(4);
    return {
      location: 'Vaelthar Watch-House',
      locationIcon: '🪖',
      narration: `Rhael comes himself. He waves off the guard, stands at the cell door with his arms folded, and looks at you for a long, evaluating moment. "The guard says you asked to speak with me specifically." He unlocks the door. "Smart. If you'd said 'I have information' to anyone else they'd have taken it and left you to rot." He opens the door and steps back. "I'm listening. You have until we reach the front gate."`,
      sub: `Rhael released you. Now convince him — fast.`,
      options: [
        { icon: '💬', label: 'Tell him about Varek, the Scribe, the burning — everything', type: 'talk',
          action: () => runScene('rhael_with_evidence') },
        { icon: '📜', label: 'Show him the document right now', type: 'talk',
          action: () => {
            if (getFlag('has_document')) runScene('rhael_with_evidence');
            else runScene('rhael_reveals_covenant');
          }},
      ]
    };
  },

  guard_ignores_you: () => ({
    location: 'Vaelthar Gaol',
    locationIcon: '⛓',
    narration: `The guard doesn't even break stride. "Captain Rhael doesn't take messages from people in cells." You hear him laugh to himself at the end of the corridor. You're going to have to manage this differently.`,
    sub: `The guard isn't listening. Try the lock again, or wait for Rhael.`,
    options: [
      { icon: '🔓', label: 'Try the lock again — that nail, one more time', type: 'explore',
        roll: { stat: 'DEX', dc: 13 },
        onSuccess: () => runScene('escaped_cell'),
        onFail: () => runScene('failed_escape') },
      { icon: '😠', label: 'Wait. Rhael will eventually check on a new prisoner.', type: 'explore',
        action: () => runScene('rhael_visits_cell') },
    ]
  }),

  rhael_visits_cell: () => {
    setFlag('rhael_visited_cell');
    return {
      location: 'Vaelthar Gaol — Rhael',
      locationIcon: '🪖',
      narration: `Four hours later, Rhael comes. He sits on a stool outside the bars, says nothing for a minute, then: "You're not a Church agent. They don't get arrested — they do the arresting." He studies you. "And you're not Crown intelligence — they would have produced credentials immediately." A pause. "So who sent you, and what do you want with the Scribe?"`,
      sub: `Rhael is finally talking. Be straight with him.`,
      options: [
        { icon: '💬', label: '"Nobody sent me. The city is about to burn and somebody needs to care."', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => runScene('released_by_rhael'),
          onFail: () => runScene('guard_ignores_you') },
        { icon: '📜', label: '"I know about Elder Varek. The order. The burning."', type: 'talk',
          action: () => runScene('released_by_rhael') },
      ]
    };
  },

  // ── VAELTHAR SCOUT MISSING SCENES ─────────

  church_agents_tracked: () => {
    setFlag('followed_agents');
    addLog('📜 CLUE: Church agents are delivering messages to a safehouse near the Archive. Elder Varek\'s orders are still being carried out in the city.', 'holy');
    return {
      location: 'Vaelthar Back Streets',
      locationIcon: '🏚',
      narration: `You tail them for three blocks, staying a doorway back. They stop at what looks like an ordinary house — but the shutters are wrong, too thick, and there's a fresh chalk mark on the door frame. A dead drop sign. One of the agents knocks four times, waits, and slides a folded note under the door. When they leave you move to the door. You can break it open or note the address for later.`,
      sub: `Church agents are operating a safehouse. Varek's network is still active.`,
      options: [
        { icon: '🔍', label: 'Break in and find the note', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { addLog('📜 ITEM GAINED: Church Agent\'s Instruction — confirms Varek ordered the Scribe killed.', 'holy'); gameState.character?.inventory?.push("Church Agent's Instruction"); runScene('scribe_urgent'); },
          onFail: () => runScene('agents_spot_you') },
        { icon: '💬', label: 'Note the address and find Captain Rhael', type: 'talk',
          action: () => runScene('rhael_with_evidence') },
      ]
    };
  },

  agents_spot_you: () => {
    grantHellPoints(2);
    return {
      location: 'Vaelthar Square',
      locationIcon: '🏰',
      threat: '⚠ SPOTTED',
      narration: `One of the agents turns at exactly the wrong moment. Your eyes meet. He says something to his partner and they both start moving toward you — not running, but with the purposeful calm of people used to getting what they want. They haven't drawn weapons yet. They might just want to ask you some questions. They won't like the answers.`,
      sub: `They've seen you. Fight, run, or bluff.`,
      options: [
        { icon: '💬', label: '"Gentlemen. Lovely morning."', type: 'talk',
          roll: { stat: 'CHA', dc: 14 },
          onSuccess: () => { addLog('They buy it — barely. They let you pass.', 'system'); runScene('vaelthar_main'); },
          onFail: () => startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]) },
        { icon: '🏃', label: 'Run — get to the back streets', type: 'move',
          roll: { stat: 'DEX', dc: 11 },
          onSuccess: () => runScene('vaelthar_fugitive'),
          onFail: () => runScene('arrested_scene') },
        { icon: '⚔', label: 'Don\'t let them reach you — strike first', type: 'combat',
          action: () => startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]) },
      ]
    };
  },

  agents_intercept: () => {
    return {
      location: 'Vaelthar Street',
      locationIcon: '🏰',
      threat: '⚔ INTERCEPTED',
      narration: `You're not fast enough. One agent cuts left, the other right, and suddenly the Scribe is being pulled away from you by the arm. He looks back at you with wide eyes as they drag him into an alley. You have seconds before they disappear.`,
      sub: `They have the Scribe. Get him back.`,
      options: [
        { icon: '⚔', label: 'Fight them right now — get the Scribe free', type: 'combat',
          action: () => { setFlag('scribe_captured_by_church'); startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]); } },
        { icon: '😠', label: '"LET HIM GO." — command presence, loud and absolute', type: 'talk',
          roll: { stat: 'CHA', dc: 16 },
          onSuccess: () => { addLog('They freeze. Something about your certainty stops them cold.', 'system'); runScene('agents_back_down'); },
          onFail: () => startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]) },
      ]
    };
  },

  agents_back_down: () => {
    setFlag('agents_backed_down');
    grantHolyPoints(5);
    return {
      location: 'Vaelthar Street',
      locationIcon: '🏰',
      narration: `They stop. Look at each other. Then, slowly, they release the Scribe's arms. One of them — the older one — says: "This isn't finished." They leave. Aldis straightens his robes with shaking hands. "That was..." he starts. "Yes," you say. He looks at you differently now. Like maybe you can actually do this.`,
      sub: `The agents backed down. The Scribe is safe — for now.`,
      options: [
        { icon: '🏃', label: 'Get off the street immediately', type: 'move',
          action: () => runScene('scribe_rescued_scene') },
      ]
    };
  },

  fountain_nothing: () => ({
    location: 'Vaelthar Square',
    locationIcon: '⛲',
    narration: `The fountain looks freshly scrubbed but you can't find anything definitive. Maybe it was just mud. Maybe a dog. The square offers no more secrets right now.`,
    sub: `Nothing here. Try something else.`,
    options: [
      { icon: '💬', label: 'Approach Captain Rhael', type: 'talk', action: () => runScene('rhael_first_meeting') },
      { icon: '📜', label: 'Go find the Trembling Scribe', type: 'talk', action: () => runScene('scribe_approach') },
    ]
  }),

  // ══════════════════════════════════════════
  //  QUEST 2: MONASTERY DUNGEON (c1q2)
  //  Whispers in the Monastery
  // ══════════════════════════════════════════

  monastery_dungeon_entry: () => {
    setFlag('entered_monastery_dungeon');
    return {
      location: 'Monastery of Saint Aldric — Lower Depths',
      locationIcon: '⛩',
      threat: '☠ DUNGEON',
      narration: `Below the monastery, past the wine cellar and through a door that shouldn't be here, the air changes. Colder. Wetter. The phrase written on every wall above — "It breathes below" — makes sense now. There are torches down here, recently lit. The monks were here recently. The walls narrow into what looks like a natural cave system beneath the stone foundations, and from somewhere deep and far below, you hear something that might be breathing, or might be the earth settling. It isn't.`,
      sub: `This isn't a cellar. Something lives down here. Be ready.`,
      options: [
        { icon: '🕯', label: 'Advance carefully, torch lit', type: 'explore',
          action: () => runScene('monastery_first_chamber') },
        { icon: '🔍', label: 'Examine the walls — the monk\'s writing is recent', type: 'explore',
          roll: { stat: 'INT', dc: 11 },
          onSuccess: () => { addLog('📜 CLUE: The monks wrote in sequence — the phrase appears 847 times, each one more hurried than the last. The last one was written in blood.', 'holy'); runScene('monastery_first_chamber'); },
          onFail: () => runScene('monastery_first_chamber') },
        { icon: '🏃', label: 'This is madness. Leave.', type: 'move',
          action: () => { addLog('📜 QUEST FAILED: You left the dungeon. The Voice remains.', 'system'); travelToLocation && travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
      ]
    };
  },

  monastery_first_chamber: () => {
    return {
      location: 'Monastery Dungeon — First Chamber',
      locationIcon: '🕳',
      threat: '☠ UNDEAD',
      narration: `The first chamber opens wide. Stone altar at the centre, cracked in half. Three skeletons rise from the floor as you enter — not sudden, but slow, deliberate, as if they've been waiting and are not yet fully sure you're worth the effort. On the altar: a journal, leather-bound. The last entry reads: "It told us its name. We shouldn't have asked."`,
      sub: `Three skeletons. The altar journal. Something named itself.`,
      options: [
        { icon: '⚔', label: 'Fight through the skeletons', type: 'combat',
          action: () => startCombat([
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_1', xp: 40 },
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_2', xp: 40 },
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_3', xp: 40 },
          ]) },
        { icon: '📜', label: 'Grab the journal while watching the skeletons', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { setFlag('has_monk_journal'); addLog('📜 ITEM GAINED: The Last Monk\'s Journal. "It said: I am what remains when a god refuses to die."', 'holy'); gameState.character?.inventory?.push("Last Monk's Journal"); startCombat([
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_1', xp: 40 },
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_2', xp: 40 },
          ]); },
          onFail: () => startCombat([
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_1', xp: 40 },
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_2', xp: 40 },
            { name: 'Risen Skeleton', hp: 20, ac: 9, atk: 3, icon: '💀', id: 'skel_3', xp: 40 },
          ]) },
      ]
    };
  },

  monastery_deep_chamber: () => {
    return {
      location: 'Monastery Dungeon — Deep Chamber',
      locationIcon: '🕳',
      threat: '☠ SHADOW',
      narration: `The passage narrows then opens into a chamber that shouldn't fit inside the hill the monastery sits on. The ceiling is lost in darkness. At the centre: a shadow that doesn't match anything in the room. It turns, slowly, and you understand why the monks wrote those words. It doesn't breathe exactly — but the air moves when it wants it to, in a rhythm that approximates breathing. It knows you're here. It knew before you arrived.`,
      sub: `The Voice Below. It's been waiting. Not just for you.`,
      options: [
        { icon: '⚔', label: 'Fight it — this is what you came for', type: 'combat',
          action: () => startCombat([generateEnemy('the_voice_below', 4)]) },
        { icon: '💬', label: '"What are you? What do you want?"', type: 'talk',
          roll: { stat: 'WIS', dc: 14 },
          onSuccess: () => runScene('voice_below_speaks'),
          onFail: () => { addLog('It speaks anyway. "I want what every broken thing wants. To be whole, or to end."', 'narrator'); startCombat([generateEnemy('the_voice_below', 4)]); } },
        { icon: '🔍', label: 'Look for something that binds it — the monks must have had a way', type: 'explore',
          roll: { stat: 'INT', dc: 15 },
          onSuccess: () => runScene('voice_weakness_found'),
          onFail: () => startCombat([generateEnemy('the_voice_below', 4)]) },
      ]
    };
  },

  voice_below_speaks: () => {
    setFlag('spoke_with_voice');
    addLog('📜 REVELATION: The Voice Below is a fragment of a god — shattered when the original Covenant was written. The Covenant was not a peace treaty. It was a seal.', 'holy');
    return {
      location: 'Monastery Dungeon — The Voice',
      locationIcon: '🕳',
      narration: `"The Covenant," it says, and its voice is wind in a tunnel, "was written to contain me. A god does not die easily. A god breaks into pieces and the pieces go looking for each other." It turns its no-face toward you. "The Elder burned the seal. The pieces are moving again." A pause. "I am the smallest piece. The others are worse." It waits. "You may fight me. Or you may understand that I am a symptom, not the disease."`,
      sub: `The Covenant was a prison seal for a shattered god. Varek broke it without knowing what he released.`,
      options: [
        { icon: '⚔', label: 'Fight it — seal or not, this thing is dangerous', type: 'combat',
          action: () => startCombat([generateEnemy('the_voice_below', 4)]) },
        { icon: '💬', label: '"Can you be rebound? Contained again?"', type: 'talk',
          roll: { stat: 'CHA', dc: 15 },
          onSuccess: () => runScene('voice_binding_option'),
          onFail: () => startCombat([generateEnemy('the_voice_below', 4)]) },
      ]
    };
  },

  voice_weakness_found: () => {
    setFlag('knows_voice_weakness');
    addLog('📜 CLUE: The runes on the floor form a binding circle. If completed, they will re-contain the Voice. Requires holy power.', 'holy');
    return {
      location: 'Monastery Dungeon',
      locationIcon: '🕳',
      narration: `The floor. The monks laid runes — you can see them now, centuries old, partially ground away by the thing moving through this chamber. If the circle were complete it would bind the Voice again. Three runes are broken. You could restore them — if you have sufficient holy power, and if the Voice doesn't stop you.`,
      sub: `Complete the binding circle. Requires Holy Points. The Voice will try to stop you.`,
      options: [
        { icon: '✝', label: 'Complete the runes — spend Holy Points to bind it (costs 15)', type: 'explore',
          action: () => {
            const char = gameState.character;
            if ((char?.holyPoints || 0) >= 15) {
              char.holyPoints -= 15;
              setFlag('voice_bound');
              grantXP(500);
              addLog('🌟 You complete the runes. The Voice screams once — not in pain, but in the sound of something finally being allowed to rest. The chamber goes silent.', 'holy');
              addLog('📜 QUEST COMPLETE: "Whispers in the Monastery." The Voice Below is bound.', 'holy');
              runScene('monastery_dungeon_cleared');
            } else {
              addLog('Not enough Holy Points. You need 15. The runes remain incomplete.', 'system');
              startCombat([generateEnemy('the_voice_below', 4)]);
            }
          }},
        { icon: '⚔', label: 'No time for runes — fight it now', type: 'combat',
          action: () => startCombat([generateEnemy('the_voice_below', 4)]) },
      ]
    };
  },

  voice_binding_option: () => {
    setFlag('voice_agreed_binding');
    return {
      location: 'Monastery Dungeon',
      locationIcon: '🕳',
      narration: `A long silence. Then: "The circle. The monks built it. It requires a willing hand and sufficient — conviction." It might be mocking the word "holy." It might not be. "If you complete the runes, I return to the state I was in before the seal broke. Aware. Contained. Not free. Not dead." Another pause. "It is better than this."`,
      sub: `It's willing to be rebound. Complete the runes if you have Holy Points.`,
      options: [
        { icon: '✝', label: 'Complete the binding (costs 15 Holy Points)', type: 'explore',
          action: () => {
            const char = gameState.character;
            if ((char?.holyPoints || 0) >= 15) {
              char.holyPoints -= 15;
              setFlag('voice_bound');
              grantXP(600);
              grantHolyPoints(10);
              addLog('🌟 The Voice descends into the runes willingly. The silence afterward is profound. You gained 10 Holy Points — and something else, harder to name.', 'holy');
              addLog('📜 QUEST COMPLETE: "Whispers in the Monastery." The Voice Below is at peace.', 'holy');
              runScene('monastery_dungeon_cleared');
            } else {
              addLog('Not enough Holy Points. You need 15.', 'system');
              startCombat([generateEnemy('the_voice_below', 4)]);
            }
          }},
        { icon: '⚔', label: 'I don\'t trust it. Fight.', type: 'combat',
          action: () => startCombat([generateEnemy('the_voice_below', 4)]) },
      ]
    };
  },

  monastery_dungeon_cleared: () => ({
    location: 'Monastery Dungeon — Cleared',
    locationIcon: '⛩',
    narration: `The dungeon is quiet now in a way it hasn't been in years. The skeletons don't rise. The air is still. As you climb back to the monastery proper, the last monk — the one they called catatonic — is sitting up in the courtyard. He blinks. Looks at his hands. Looks at you. "Is it quiet?" he asks. "Yes," you say. He closes his eyes. "I've been waiting a very long time to hear that."`,
    sub: `The monastery is clear. The deeper mystery — the shattered god — remains.`,
    options: [
      { icon: '🗺', label: 'Return to Vaelthar with what you\'ve learned', type: 'move',
        action: () => { if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
      { icon: '💬', label: 'Talk to the monk — he knows more', type: 'talk',
        action: () => { addLog('The monk tells you: "The Voice was the first seal. There are six others. The Elder broke the first without knowing. God help us all."', 'narrator'); grantHolyPoints(5); runScene('monastery_dungeon_cleared'); } },
    ]
  }),

  // ══════════════════════════════════════════
  //  QUEST 3: THE MISSING CARTOGRAPHER (c1q3)
  // ══════════════════════════════════════════

  cartographer_missing: () => {
    setFlag('cartographer_quest_started');
    return {
      location: 'Thornwood Gate — Lost Cartographer',
      locationIcon: '🌲',
      threat: '⚠ Missing Person',
      narration: `At the Thornwood Gate, a woman paces near the guardhouse. Mira — wife of Edden, the only man who has successfully mapped the Thornwood passages. He went in three days ago to update his charts. He hasn't come back. "The soldiers won't go in," she says. "They say it's not their jurisdiction. It's a forest." She pushes a folded map into your hands. "He had the newer version. This is the last one he gave me. Please."`,
      sub: `Edden the cartographer is lost in the Thornwood. His maps are essential.`,
      options: [
        { icon: '🌲', label: 'Enter the Thornwood to find him', type: 'move',
          action: () => runScene('thornwood_search') },
        { icon: '🔍', label: 'Study the old map before going in', type: 'explore',
          roll: { stat: 'INT', dc: 10 },
          onSuccess: () => { addLog('📜 CLUE: The old map shows a safe path to a marked shelter. You know which way to go.', 'holy'); setFlag('knows_thornwood_path'); runScene('thornwood_search'); },
          onFail: () => runScene('thornwood_search') },
      ]
    };
  },

  thornwood_search: () => ({
    location: 'The Thornwood — Searching',
    locationIcon: '🌲',
    threat: '⚠ Dangerous Terrain',
    narration: `The Thornwood is immediately wrong. Sound dampens. The light goes brown-green. You find Edden's marks on trees where he indicated his route — but the marks stop abruptly at a place where the ground is disturbed. A struggle. His satchel is on the ground, maps spilled out. He was here. Something found him.`,
    sub: `Edden was taken from this spot. Follow the trail.`,
    options: [
      { icon: '🔍', label: 'Track the disturbance — find where he was taken', type: 'explore',
        roll: { stat: 'WIS', dc: 12 },
        onSuccess: () => runScene('cartographer_found'),
        onFail: () => { addLog('You lose the trail in the undergrowth. Dire wolves pick up your scent instead.', 'combat');
          startCombat([
            { name: 'Dire Wolf', hp: 35, ac: 12, atk: 5, icon: '🐺', id: 'wolf_1', xp: 70 },
            { name: 'Dire Wolf', hp: 35, ac: 12, atk: 5, icon: '🐺', id: 'wolf_2', xp: 70 },
          ]); }},
      { icon: '📜', label: 'Collect his fallen maps — they\'re the whole point', type: 'explore',
        action: () => { addLog('📜 ITEM GAINED: Edden\'s Partial Maps — the Thornwood passage routes, incomplete.', 'holy'); gameState.character?.inventory?.push("Edden's Partial Maps"); runScene('cartographer_found'); } },
    ]
  }),

  cartographer_found: () => {
    setFlag('cartographer_found');
    grantHolyPoints(10);
    grantXP(175);
    addLog('📜 QUEST COMPLETE: "The Missing Cartographer." Edden found alive. Maps secured.', 'holy');
    return {
      location: 'Thornwood — Edden\'s Shelter',
      locationIcon: '🌲',
      narration: `You find him in a hollow beneath a fallen tree — a middle-aged man, dirt-covered, with a broken ankle and the expression of someone who has had a great deal of time to regret a series of decisions. "The wolves," he says when he sees you. "They weren't hunting. They were herding. They pushed me away from the main path deliberately." He holds up a finished map. "But I finished it. The whole passage. I wasn't going to die with an incomplete chart."`,
      sub: `Edden is alive. The Thornwood passage is mapped. The wolves behaved strangely.`,
      options: [
        { icon: '🏃', label: 'Get him out of the forest — back to the gate', type: 'move',
          action: () => { addLog('📜 Edden returned safely to Mira. The Thornwood passage map is complete.', 'holy'); grantXP(150); if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['thornwood_gate']); } },
        { icon: '💬', label: '"The wolves were herding you? Tell me more."', type: 'talk',
          action: () => { addLog('📜 CLUE: The Thornwood wolves have become organized recently — possibly influenced by the same force disturbing the monastery.', 'holy'); runScene('cartographer_found'); } },
      ]
    };
  },

  // ══════════════════════════════════════════
  //  QUEST 4: BLOOD ON THE MERCHANT ROAD (c1q4)
  // ══════════════════════════════════════════

  merchant_road_investigation: () => {
    setFlag('merchant_road_quest_started');
    return {
      location: 'The Merchant Road — Crime Scene',
      locationIcon: '🛤',
      threat: '☠ DANGEROUS',
      narration: `The third caravan site. Three wagons, all intact — nothing was stolen. The bodies are arranged. Not fallen where they died, but placed: in a circle, hands folded, facing inward. Like a ritual. The lone survivor sits against a wheel, eyes fixed on nothing. When you crouch beside him he says, without looking at you: "They came from the ground. Not from the trees. The ground opened and they came out and they knew exactly who to kill first."`,
      sub: `A ritual massacre. Coordinated. Underground origin. This isn't banditry.`,
      options: [
        { icon: '🔍', label: 'Examine the bodies — look for marks or symbols', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { addLog('📜 CLUE: Each body has the same symbol burned on the left palm — identical to the children in Vaelthar. This is connected.', 'holy'); setFlag('merchant_road_symbol_found'); runScene('merchant_road_ambush'); },
          onFail: () => runScene('merchant_road_ambush') },
        { icon: '💬', label: 'Talk to the survivor — get every detail', type: 'talk',
          roll: { stat: 'WIS', dc: 10 },
          onSuccess: () => { addLog('📜 CLUE: The attackers spoke in a language the survivor didn\'t recognise. They weren\'t bandits — they were cultists.', 'holy'); runScene('merchant_road_ambush'); },
          onFail: () => runScene('merchant_road_ambush') },
      ]
    };
  },

  merchant_road_ambush: () => ({
    location: 'The Merchant Road',
    locationIcon: '🛤',
    threat: '⚔ AMBUSH',
    narration: `As you finish examining the site, you hear movement from both sides of the road simultaneously. Four cultists in grey robes emerge — not from the trees, but from shallow pits they were lying in. Concealed, waiting. The leader holds up one hand. "You carry the smell of the Archive," he says. "The Elder wants to know what you found there."`,
    sub: `They were waiting for you specifically. Someone sent them.`,
    options: [
      { icon: '⚔', label: 'Fight — they\'re not getting anything from you', type: 'combat',
        action: () => startCombat([
          { name: 'Covenant Cultist', hp: 30, ac: 11, atk: 4, icon: '😈', id: 'cult_1', xp: 70 },
          { name: 'Covenant Cultist', hp: 30, ac: 11, atk: 4, icon: '😈', id: 'cult_2', xp: 70 },
          { name: 'Cultist Leader', hp: 50, ac: 13, atk: 6, icon: '😈', id: 'cult_leader', xp: 120 },
        ]) },
      { icon: '💬', label: '"Which Elder? Varek sent you?"', type: 'talk',
        roll: { stat: 'CHA', dc: 15 },
        onSuccess: () => { addLog('📜 REVELATION: These cultists work for Elder Varek. The caravan killings were eliminating witnesses to the Covenant burning.', 'holy'); setFlag('merchant_road_varek_connected'); startCombat([
          { name: 'Covenant Cultist', hp: 30, ac: 11, atk: 4, icon: '😈', id: 'cult_1', xp: 70 },
          { name: 'Cultist Leader', hp: 50, ac: 13, atk: 6, icon: '😈', id: 'cult_leader', xp: 120 },
        ]); },
        onFail: () => startCombat([
          { name: 'Covenant Cultist', hp: 30, ac: 11, atk: 4, icon: '😈', id: 'cult_1', xp: 70 },
          { name: 'Covenant Cultist', hp: 30, ac: 11, atk: 4, icon: '😈', id: 'cult_2', xp: 70 },
          { name: 'Cultist Leader', hp: 50, ac: 13, atk: 6, icon: '😈', id: 'cult_leader', xp: 120 },
        ]) },
    ]
  }),

  // ══════════════════════════════════════════
  //  QUEST 5: THE HERETIC'S TORCH (c1q5)
  // ══════════════════════════════════════════

  mol_village_arrival: () => {
    setFlag('arrived_mol');
    return {
      location: 'Mol Village — The Heretic\'s Pulpit',
      locationIcon: '🏘',
      threat: '⚠ Religious Tension',
      narration: `The village green is packed. Two hundred people, maybe more, listening to a man standing on an overturned cart. He's not young and not old, and he's not performing — he's reporting. "The Church of the Eternal Flame collected your tithe. Then they burned the Covenant that would have protected your land rights. Then they sent soldiers to this village to silence me. That is not a church. That is a protection racket with candles." Nobody speaks. Nobody leaves.`,
      sub: `Preacher Aldran tells the truth. The Church wants him gone — permanently.`,
      options: [
        { icon: '💬', label: 'Talk to Preacher Aldran after his sermon', type: 'talk',
          action: () => runScene('aldran_meeting') },
        { icon: '🔍', label: 'Look for Church soldiers in the crowd', type: 'explore',
          roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => { addLog('📜 CLUE: Two Church agents in the crowd — they\'re recording names of everyone listening.', 'holy'); setFlag('agents_in_crowd'); runScene('aldran_meeting'); },
          onFail: () => runScene('aldran_meeting') },
      ]
    };
  },

  aldran_meeting: () => {
    setFlag('met_aldran');
    return {
      location: 'Mol Village — Aldran',
      locationIcon: '🏘',
      narration: `Aldran climbs down from the cart and meets you without surprise. "You're not from Mol," he says. "You came from Vaelthar." Not an accusation. "The Church has sent people before. They were less well-armed." He studies your face. "But you didn't come to silence me." He sits on the cart's wheel. "So: investigator, opportunist, or someone who actually wants the truth?"`,
      sub: `Aldran is sharp. He'll help you if you're straight with him.`,
      options: [
        { icon: '💬', label: '"I\'m investigating the Covenant. You know things. So do I. Trade?"', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => runScene('aldran_shares_intel'),
          onFail: () => { addLog('He weighs you up and decides to wait.', 'system'); runScene('aldran_meeting'); } },
        { icon: '⚠', label: '"There are Church agents in your crowd. You need to know."', type: 'talk',
          action: () => {
            if (getFlag('agents_in_crowd')) { setFlag('aldran_warned'); addLog('📜 Aldran\'s expression hardens. "Show me." You do. +5 Holy Points.', 'holy'); grantHolyPoints(5); runScene('aldran_shares_intel'); }
            else runScene('aldran_meeting');
          }},
        { icon: '🛡', label: '"The Church is sending soldiers to silence you. Let me help."', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => runScene('aldran_protected'),
          onFail: () => runScene('aldran_meeting') },
      ]
    };
  },

  aldran_shares_intel: () => {
    setFlag('aldran_intel');
    addLog('📜 CLUE: Aldran has a copy of the original Covenant — including page four, the hidden treasury clause.', 'holy');
    return {
      location: 'Mol Village',
      locationIcon: '🏘',
      narration: `Aldran goes into his house and returns with a bundle of papers that he clearly has memorised. "I have a copy of the original Covenant. Not the version the Church distributed — the actual text, obtained by a clerk who feared what would happen if it was destroyed." He finds page four and lays it flat. "Read this clause." You do. Then read it again. The Crown would have controlled the Church's finances within eighteen months of signing. The Church would effectively cease to exist as an independent body within three years.`,
      sub: `You now have proof the Covenant was a trap. Varek's motive is confirmed.`,
      options: [
        { icon: '📜', label: 'Take a copy — this is crucial evidence', type: 'explore',
          action: () => { addLog('📜 ITEM GAINED: Original Covenant Text — page four proves the hidden power clause.', 'holy'); gameState.character?.inventory?.push("Original Covenant (Full Text)"); grantHolyPoints(5); runScene('aldran_church_soldiers'); } },
        { icon: '💬', label: '"Who gave you this? How did you get it?"', type: 'talk',
          action: () => { addLog('"The clerk\'s name was Torven. He said give it to someone trustworthy if he ever disappeared." Aldran pauses. "He disappeared."', 'narrator'); grantHolyPoints(3); runScene('aldran_church_soldiers'); } },
      ]
    };
  },

  aldran_church_soldiers: () => ({
    location: 'Mol Village — Church Arrives',
    locationIcon: '🏘',
    threat: '⚔ SOLDIERS INCOMING',
    narration: `A rider arrives at the village edge — Church livery, sword drawn. Behind him, six soldiers on foot. The crowd scatters. Aldran doesn't move. "Right on time," he says quietly. The lead soldier points at him. "Aldran of Mol, you are under arrest for heresy and sedition against the Church of the Eternal Flame." He looks at you. "And whoever you are — step away from him."`,
    sub: `Six soldiers. Aldran won't run. What do you do?`,
    options: [
      { icon: '🛡', label: 'Stand between Aldran and the soldiers', type: 'combat',
        action: () => {
          grantHolyPoints(5);
          startCombat([
            { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs1', xp: 80 },
            { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs2', xp: 80 },
            { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs3', xp: 80 },
          ]);
        }},
      { icon: '📜', label: 'Show the evidence — "This man speaks the truth. Here is proof."', type: 'talk',
        roll: { stat: 'CHA', dc: 16 },
        onSuccess: () => { setFlag('heretic_protected'); grantHolyPoints(15); addLog('📜 QUEST COMPLETE: "The Heretic\'s Torch." Aldran is free. The soldiers stand down.', 'holy'); grantXP(225); if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); },
        onFail: () => startCombat([
          { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs1', xp: 80 },
          { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs2', xp: 80 },
        ]) },
      { icon: '🏃', label: 'Get Aldran out — run for the Thornwood passage', type: 'move',
        roll: { stat: 'DEX', dc: 13 },
        onSuccess: () => { setFlag('aldran_escaped'); grantHolyPoints(8); addLog('📜 Aldran escaped into the Thornwood. His sermons will spread regardless.', 'holy'); grantXP(150); if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); },
        onFail: () => startCombat([
          { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs1', xp: 80 },
          { name: 'Church Soldier', hp: 45, ac: 14, atk: 5, icon: '⚔', id: 'cs2', xp: 80 },
        ]) },
    ]
  }),

  aldran_protected: () => ({
    location: 'Mol Village',
    locationIcon: '🏘',
    narration: `Aldran looks at you for a long moment. "You'd do that. For a stranger you just met." He tucks the papers away. "All right. Then there are things I should show you." He leads you inside. The house is full of documents, testimonies, a map of every Church holding in the region. He's been building a case for years. "When the soldiers come — and they will come — it'll be good to have someone who knows how to hold a sword on the right side."`,
    sub: `Aldran trusts you. He has evidence and needs protection.`,
    options: [
      { icon: '💬', label: '"Show me what you have"', type: 'talk', action: () => runScene('aldran_shares_intel') },
    ]
  }),

  // ══════════════════════════════════════════
  //  QUEST 6: THE KNIGHT WHO KNEELS (c1q6)
  // ══════════════════════════════════════════

  fortress_harren_arrival: () => {
    setFlag('arrived_fortress');
    return {
      location: 'Fortress Harren — The Gates',
      locationIcon: '🏯',
      threat: '⚠ BARRICADED',
      narration: `The gates of Fortress Harren are sealed from within — massive beams, from the sound when you knock. No guards on the walls. A single window is lit in the east tower. A note is nailed to the gate. In precise handwriting: "I will speak with one person. Unarmed. If they have come to bring me back to the Order, I will know before they finish their first sentence. If they have come for a different reason, knock three times, pause, twice."`,
      sub: `Harren is in there. He's choosing who to speak to. How do you knock?`,
      options: [
        { icon: '🚪', label: 'Knock: three, pause, two — signal you\'re not Order', type: 'explore',
          action: () => runScene('harren_opens_door') },
        { icon: '🚪', label: 'Knock normally — you represent the Order', type: 'explore',
          action: () => runScene('harren_refuses_order') },
        { icon: '💪', label: 'Force the gate — you don\'t have time for this', type: 'combat',
          roll: { stat: 'STR', dc: 18 },
          onSuccess: () => { setFlag('harren_hostile'); runScene('harren_forced_entry'); },
          onFail: () => { addLog('The gate doesn\'t give. A voice from above: "The gate was built to hold. Please stop embarrassing yourself."', 'narrator'); runScene('fortress_harren_arrival'); } },
      ]
    };
  },

  harren_opens_door: () => {
    setFlag('harren_opened_door');
    return {
      location: 'Fortress Harren — Interior',
      locationIcon: '🏯',
      narration: `A long silence. Then the sound of beams being moved. The gate opens enough for one person to pass. Sir Aldric Harren — once the most celebrated paladin of the age — looks like a man who has been awake for three days and has found the experience clarifying. He's in plain clothes, no armour, and he looks at you with the directness of someone who has stopped performing composure. "You're not Order." Not a question. "Good. Come in. There's something I need to tell someone before I decide whether to live or die."`,
      sub: `He's in crisis. Listen first — the reason he renounced his vows may be crucial.`,
      options: [
        { icon: '💬', label: '"Tell me. I\'m listening."', type: 'talk',
          action: () => runScene('harren_confession') },
        { icon: '💬', label: '"Before you do — what did the Order do?"', type: 'talk',
          action: () => runScene('harren_confession') },
      ]
    };
  },

  harren_confession: () => {
    setFlag('harren_told_truth');
    addLog('📜 REVELATION: The Paladin Order knew about the hidden Covenant clause. They were going to enforce it — by sword if necessary. Harren renounced his vows when ordered to march on the Church.', 'holy');
    return {
      location: 'Fortress Harren',
      locationIcon: '🏯',
      narration: `"The Grand Master gave me the order six days ago," Harren says. "When the Covenant was signed, we were to enforce the treasury transfer by military force if the Church resisted. I asked: what if they resist peacefully? He said that doesn't change the order." He looks at his hands. "I've killed for this Order. I've died for it, almost. But I will not march soldiers into churches to seize candlesticks." He looks up. "The Covenant burning saved lives. I don't know if I should hate Varek for breaking it or thank him."`,
      sub: `The Order planned to enforce the Covenant at swordpoint. Harren chose conscience over obedience.`,
      options: [
        { icon: '💬', label: '"You made the right call. Help me bring Varek in cleanly — no more bloodshed."', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => { setFlag('harren_ally'); grantHolyPoints(10); addLog('📜 ALLY GAINED: Sir Harren will stand witness to the Order\'s intentions.', 'holy'); runScene('harren_joins'); },
          onFail: () => runScene('harren_hesitates') },
        { icon: '💬', label: '"The Grand Master needs to answer for this order."', type: 'talk',
          action: () => runScene('harren_joins') },
        { icon: '🛡', label: '"The Order is coming for you. Let me help you prepare."', type: 'talk',
          action: () => runScene('harren_order_arrives') },
      ]
    };
  },

  harren_joins: () => {
    setFlag('harren_ally');
    grantHolyPoints(10);
    grantXP(180);
    addLog('📜 QUEST COMPLETE: "The Knight Who Kneels to Nothing." Sir Harren will testify. +10 Holy Points.', 'holy');
    return {
      location: 'Fortress Harren',
      locationIcon: '🏯',
      narration: `Harren stands. Reaches for his sword — then stops, and hangs it back on the wall. Takes a plain dagger instead. "I'll come. As a witness, not a soldier." He looks at the empty fortress. "I have been kneeling to nothing here. You're right about that." He opens the gate properly. Outside, the Order's scouts haven't arrived yet. You have time.`,
      sub: `Harren will testify. Head back — the pieces are coming together.`,
      options: [
        { icon: '🗺', label: 'Return to Vaelthar with Harren', type: 'move',
          action: () => { if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
      ]
    };
  },

  harren_hesitates: () => ({
    location: 'Fortress Harren',
    locationIcon: '🏯',
    narration: `He's quiet for a long time. "It's not that simple," he says finally. "Nothing that looked right to everyone ever needed a fortress to think it over in." He picks up a cup, sets it down. "Give me a reason that isn't about what's clever. Give me one that's about what's right."`,
    sub: `Appeal to his conscience, not his strategy.`,
    options: [
      { icon: '💬', label: '"Because people are going to die if the truth doesn\'t come out. And you have the truth."', type: 'talk',
        roll: { stat: 'CHA', dc: 13 },
        onSuccess: () => runScene('harren_joins'),
        onFail: () => runScene('harren_confession') },
    ]
  }),

  harren_refuses_order: () => ({
    location: 'Fortress Harren — Gate',
    locationIcon: '🏯',
    narration: `No answer. Then, from somewhere above: "I know the Order's knock. I know what they want. Tell Commander Vael I said no. Tell him again. Tell him a third time if he likes — the answer will not change." Silence. The window goes dark.`,
    sub: `Wrong approach. Try the signal knock.`,
    options: [
      { icon: '🚪', label: 'Try the signal knock — three, pause, two', type: 'explore',
        action: () => runScene('harren_opens_door') },
    ]
  }),

  harren_forced_entry: () => {
    setFlag('harren_hostile');
    grantHellPoints(5);
    return {
      location: 'Fortress Harren — Interior',
      locationIcon: '🏯',
      threat: '⚔ HOSTILE',
      narration: `The gate splinters. Harren is waiting in the courtyard with a sword drawn and an expression of profound disappointment. "So you're with the Order after all." He's in full armour now — he had time to prepare. "I had hoped otherwise." He settles into a fighting stance. "I'm not going back. And I'm not going quietly."`,
      sub: `He's going to fight. This was avoidable.`,
      options: [
        { icon: '⚔', label: 'Fight Sir Harren', type: 'combat',
          action: () => startCombat([{ name: 'Sir Harren', hp: 100, ac: 17, atk: 8, icon: '🛡', id: 'harren', xp: 400, boss: false }]) },
        { icon: '✋', label: '"STOP. I\'m not Order. I forced the gate — that was wrong."', type: 'talk',
          roll: { stat: 'CHA', dc: 16 },
          onSuccess: () => { addLog('He stops. Reassesses. "Explain yourself. Quickly."', 'system'); runScene('harren_opens_door'); },
          onFail: () => startCombat([{ name: 'Sir Harren', hp: 100, ac: 17, atk: 8, icon: '🛡', id: 'harren', xp: 400, boss: false }]) },
      ]
    };
  },

  harren_order_arrives: () => ({
    location: 'Fortress Harren — Under Siege',
    locationIcon: '🏯',
    threat: '⚔ ORDER ATTACK',
    narration: `You're barely inside when you hear them — hooves on the road, a lot of them. Commander Vael has apparently decided that waiting is over. Through the arrow-slit you count twelve riders in Order livery, Vael at the front. He calls to the gate: "Sir Harren. This is your final opportunity to come out honourably. After this, we come in." He pauses. "We have siege equipment."`,
    sub: `Twelve Order soldiers. You're inside with Harren. Defend, negotiate, or escape.`,
    options: [
      { icon: '🛡', label: 'Help Harren defend the fortress', type: 'combat',
        action: () => {
          grantHellPoints(5);
          startCombat([
            { name: 'Order Knight', hp: 55, ac: 15, atk: 6, icon: '⚔', id: 'ok1', xp: 100 },
            { name: 'Order Knight', hp: 55, ac: 15, atk: 6, icon: '⚔', id: 'ok2', xp: 100 },
            { name: 'Order Knight', hp: 55, ac: 15, atk: 6, icon: '⚔', id: 'ok3', xp: 100 },
          ]);
        }},
      { icon: '💬', label: 'Negotiate with Vael — you have evidence about the Order\'s illegal orders', type: 'talk',
        roll: { stat: 'CHA', dc: 15 },
        onSuccess: () => { setFlag('order_stood_down'); addLog('📜 Vael stands down. Temporarily. He\'ll want to verify the evidence.', 'holy'); runScene('harren_joins'); },
        onFail: () => startCombat([
          { name: 'Order Knight', hp: 55, ac: 15, atk: 6, icon: '⚔', id: 'ok1', xp: 100 },
          { name: 'Commander Vael', hp: 75, ac: 16, atk: 7, icon: '⚔', id: 'vael', xp: 200, boss: false },
        ]) },
    ]
  }),

};


// ─── HAND-CRAFTED SCENES ─────────────────────
const SCENES = {

  // ── OPENING SCENE ────────────────────────
  arrival_vaelthar: () => {
    const char = gameState.character;
    return {
      location: 'Vaelthar — The Fractured Capital',
      locationIcon: '🏰',
      threat: '⚠ Political Crisis',
      narration: `You step into Vaelthar's main square as grey morning light cuts through the smoke. Three days ago the Covenant — the treaty between the Crown and the Church — shattered. No one admits why. Church banners hang torn from the gate posts. A captain in worn armor stands rigid near the gate, jaw locked, scanning every face that passes. To your left, a thin man in scribe's robes hovers near the Archive doors, clutching a document roll he clearly doesn't want to be seen with.`,
      sub: `Captain Rhael looks like a man who knows more than he's saying. The scribe looks terrified.`,
      options: [
        {
          icon: '💬', label: 'Approach Captain Rhael — he commands the Watch', type: 'talk',
          action: () => { window.sceneState.history.push('talked_to_rhael'); runScene('rhael_first_meeting'); }
        },
        {
          icon: '👁', label: 'Watch the Trembling Scribe — he\'s hiding something', type: 'explore',
          action: () => { window.sceneState.history.push('watched_scribe'); runScene('scribe_observation'); }
        },
        {
          icon: '🔍', label: 'Examine the torn Church banners for clues', type: 'explore',
          action: () => { window.sceneState.history.push('examined_banners'); runScene('banners_clue'); }
        },
        {
          icon: '🗺', label: 'Scout the square — get the lay of the land', type: 'move',
          action: () => { window.sceneState.history.push('scouted'); runScene('vaelthar_scout'); }
        },
      ]
    };
  },

  // ── CAPTAIN RHAEL ────────────────────────
  rhael_first_meeting: () => {
    setFlag('met_rhael');
    setNPCState('rhael', 'wary');
    return {
      location: 'Vaelthar Gate — Captain Rhael',
      locationIcon: '🪖',
      narration: `Captain Rhael turns slowly when you approach, one hand resting on his sword hilt — not aggressive, but ready. He's a big man, fifties, with a face that's absorbed too much bad news. "Stranger," he says flatly. "If you're here to ask about the Covenant, join the queue. If you're here to cause trouble—" he glances pointedly at your weapon "—don't." His eyes are doing something interesting though: they keep flicking to the Archive, where the Scribe stands. He knows something about that man.`,
      sub: `He keeps looking at the Archive. Push him on it.`,
      options: [
        {
          icon: '💬', label: '"What happened to the Covenant? You were there."',
          type: 'talk', roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => { setFlag('rhael_revealed_covenant'); runScene('rhael_reveals_covenant'); },
          onFail: () => runScene('rhael_stonewalls'),
        },
        {
          icon: '👁', label: '"You keep looking at the Archive. What do you know about the Scribe?"',
          type: 'talk', roll: { stat: 'WIS', dc: 10 },
          onSuccess: () => { setFlag('rhael_mentioned_scribe'); runScene('rhael_warns_about_scribe'); },
          onFail: () => runScene('rhael_deflects'),
        },
        {
          icon: '😠', label: 'Intimidate him — grab his collar, demand answers',
          type: 'combat', roll: { stat: 'STR', dc: 15 },
          onSuccess: () => { setFlag('rhael_intimidated'); runScene('rhael_intimidated_scene'); },
          onFail: () => { setFlag('guards_alerted'); runScene('rhael_fights_back'); },
        },
        {
          icon: '🏃', label: 'Leave him — go to the Scribe instead',
          type: 'move', action: () => runScene('scribe_approach'),
        },
      ]
    };
  },

  rhael_reveals_covenant: () => {
    setFlag('knows_covenant_broken_by_church');
    addLog('📜 CLUE: Captain Rhael believes the Church broke the Covenant first.', 'holy');
    grantXP(100);
    return {
      location: 'Vaelthar Gate — Captain Rhael',
      locationIcon: '🪖',
      narration: `Rhael glances around, then lowers his voice. "The signing hall — it wasn't a negotiation breakdown. Someone burned the documents before the ink dried. Church-side. I saw the ashes." He straightens. "I don't know who gave the order. But Sister Mourne at the Temple Quarter was there that morning. She left before the fire." His jaw tightens. "That's all I'm saying in public."`,
      sub: `Sister Mourne was at the signing hall. Find her at the Temple Quarter.`,
      options: [
        {
          icon: '💬', label: '"Who gave Sister Mourne her orders?"',
          type: 'talk', roll: { stat: 'CHA', dc: 14 },
          onSuccess: () => { setFlag('knows_mourne_orders'); runScene('rhael_names_higherpower'); },
          onFail: () => runScene('rhael_clams_up'),
        },
        {
          icon: '🗺', label: 'Go to the Temple Quarter — find Sister Mourne',
          type: 'move', action: () => { setFlag('heading_to_temple'); runScene('temple_quarter_arrival'); }
        },
        {
          icon: '🔍', label: '"Take me to the signing hall ruins"',
          type: 'explore', action: () => runScene('covenant_hall_scene'),
        },
        {
          icon: '💬', label: '"Tell me about the Trembling Scribe"',
          type: 'talk', action: () => { setFlag('rhael_mentioned_scribe'); runScene('rhael_warns_about_scribe'); }
        },
      ]
    };
  },

  rhael_stonewalls: () => ({
    location: 'Vaelthar Gate',
    locationIcon: '🪖',
    narration: `Rhael's face closes like a door. "I don't know you. I don't trust you. And I've had three days of people asking questions I can't answer in public." He turns away. "Come back with a reason I should talk to you — or don't come back."`,
    sub: `He's not hostile, just closed. The Scribe might be easier.`,
    options: [
      { icon: '💬', label: 'Show him something — your guild mark, a coin, credentials', type: 'talk',
        roll: { stat: 'CHA', dc: 11 }, onSuccess: () => runScene('rhael_reveals_covenant'), onFail: () => runScene('rhael_first_meeting') },
      { icon: '👁', label: 'Go find the Trembling Scribe instead', type: 'move', action: () => runScene('scribe_approach') },
      { icon: '🔍', label: 'Investigate the square yourself', type: 'explore', action: () => runScene('vaelthar_scout') },
    ]
  }),

  rhael_fights_back: () => {
    setFlag('guards_hostile');
    setNPCState('rhael', 'hostile');
    return {
      location: 'Vaelthar Gate — COMBAT',
      locationIcon: '⚔',
      threat: '☠ HOSTILE',
      narration: `Rhael moves faster than a man his size should. He grabs your wrist before you reach him, twists hard, and shoves you back. "GUARDS!" Two soldiers round the corner immediately — they were watching. "You just made a very bad decision, stranger," Rhael says, drawing his sword. The square empties fast. People here know what a public arrest looks like.`,
      sub: `Fight, flee, or surrender — your choice changes everything.`,
      options: [
        { icon: '⚔', label: 'Fight — take them all on (3 vs 1)', type: 'combat',
          action: () => { startCombat([
            { name: 'Captain Rhael', hp: 80, ac: 16, atk: 7, icon: '🪖', id: 'rhael' },
            { name: 'City Guard', hp: 35, ac: 13, atk: 4, icon: '🛡', id: 'guard_1' },
            { name: 'City Guard', hp: 35, ac: 13, atk: 4, icon: '🛡', id: 'guard_2' },
          ]); }
        },
        { icon: '🏃', label: 'Flee into the city streets', type: 'move',
          roll: { stat: 'DEX', dc: 13 }, onSuccess: () => { setFlag('wanted'); runScene('vaelthar_fugitive'); }, onFail: () => runScene('arrested_scene') },
        { icon: '✋', label: 'Surrender — hands up, no more trouble', type: 'talk',
          action: () => { setFlag('arrested'); runScene('arrested_scene'); } },
      ]
    };
  },

  rhael_intimidated_scene: () => {
    setNPCState('rhael', 'afraid');
    addLog('📜 CLUE: Rhael is hiding orders from someone above him in the Church hierarchy.', 'holy');
    return {
      location: 'Vaelthar Gate',
      locationIcon: '🪖',
      narration: `Something breaks in Rhael's composure. He lowers his voice to almost nothing. "The Covenant wasn't broken — it was murdered. There's a name. A Church elder. I have it written down, somewhere safe, because I know what happens to people who say it out loud." He pulls back. "The Scribe — he was the witness. He copied the order. Find him before they do."`,
      sub: `Find the Trembling Scribe NOW — he has the written proof.`,
      options: [
        { icon: '🏃', label: 'Run to the Archive — find the Scribe immediately', type: 'move',
          action: () => runScene('scribe_urgent') },
        { icon: '💬', label: '"Who is the Church elder? Tell me the name."', type: 'talk',
          roll: { stat: 'CHA', dc: 16 },
          onSuccess: () => { setFlag('knows_elder_name'); runScene('rhael_names_higherpower'); },
          onFail: () => runScene('rhael_too_afraid') },
      ]
    };
  },

  // ── THE SCRIBE ──────────────────────────
  scribe_observation: () => ({
    location: 'Archive Steps — Watching',
    locationIcon: '📜',
    narration: `You hang back and watch. The Scribe is sweating despite the cold morning air. He keeps trying to enter the Archive but the door won't open — the lock has been changed. Someone locked him out of his own workplace. He looks over his shoulder every thirty seconds. When he sees you watching, he nearly drops his document roll. He considers running, then doesn't. He wants to talk to someone. He's just terrified to.`,
    sub: `He wants to be approached — he's waiting for someone safe.`,
    options: [
      { icon: '💬', label: 'Approach him calmly — "I\'m not with the Church"', type: 'talk',
        action: () => runScene('scribe_approach') },
      { icon: '🔍', label: 'Look at what he\'s carrying — the document roll', type: 'explore',
        roll: { stat: 'DEX', dc: 11 },
        onSuccess: () => { setFlag('saw_document_label'); runScene('scribe_document_glimpse'); },
        onFail: () => runScene('scribe_approach') },
    ]
  }),

  scribe_approach: () => {
    setFlag('met_scribe');
    setNPCState('scribe', 'terrified');
    return {
      location: 'Archive Steps — The Trembling Scribe',
      locationIcon: '📜',
      narration: `The Scribe flinches when you get close, then steadies himself. "You're not Watch. Not Church." It's not a question. His voice is barely above a whisper. "I copied a document three days ago. Orders. Signed at the top by Elder Varek of the Eternal Flame — instructing one of his agents to burn the Covenant treaty before ratification." He swallows. "I shouldn't be alive right now. The Archive's been locked. My assistant hasn't shown up in two days."`,
      sub: `He has evidence. Elder Varek ordered the Covenant destroyed.`,
      options: [
        { icon: '🔐', label: '"Give me the document. I\'ll protect you."', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => { setFlag('has_document'); runScene('scribe_gives_document'); },
          onFail: () => runScene('scribe_hesitates') },
        { icon: '💬', label: '"Where is Elder Varek now?"', type: 'talk',
          action: () => { setFlag('knows_varek_location'); runScene('scribe_names_varek_location'); } },
        { icon: '🏃', label: '"Come with me — you\'re not safe here"', type: 'talk',
          roll: { stat: 'CHA', dc: 10 },
          onSuccess: () => { setFlag('scribe_in_party'); runScene('scribe_joins_party'); },
          onFail: () => runScene('scribe_refuses_to_move') },
        { icon: '😠', label: 'Grab him — "You\'re coming with me whether you like it or not"', type: 'combat',
          roll: { stat: 'STR', dc: 8 },
          onSuccess: () => { setFlag('scribe_captured'); runScene('scribe_forced_along'); },
          onFail: () => runScene('scribe_screams') },
      ]
    };
  },

  scribe_gives_document: () => {
    addLog('📜 ITEM GAINED: Elder Varek\'s Sealed Order — proof the Covenant was sabotaged.', 'holy');
    gameState.character.inventory.push("Elder Varek's Sealed Order");
    grantXP(200);
    grantHolyPoints(5);
    return {
      location: 'Archive Steps',
      locationIcon: '📜',
      narration: `The Scribe's hands shake as he passes you the document roll. The seal on it bears Elder Varek's mark — broken, because the Scribe opened it. Inside: a single page order, signed and dated the morning of the Covenant signing, instructing an agent called "The Candle" to burn the treaty before ratification and make it look like the Crown's fault. The Scribe whispers: "There's an agent still in the city. Elder Varek's fixer. I think — I think it might be Sister Mourne."`,
      sub: `You have proof. Sister Mourne may be "The Candle." Find her at the Temple Quarter.`,
      options: [
        { icon: '🗺', label: 'Go to the Temple Quarter — confront Sister Mourne', type: 'move',
          action: () => { setFlag('heading_to_temple'); runScene('temple_quarter_arrival'); } },
        { icon: '💬', label: '"I need to show this to Captain Rhael"', type: 'talk',
          action: () => runScene('rhael_with_evidence') },
        { icon: '🔍', label: '"Tell me everything you know about the Candle"', type: 'talk',
          action: () => runScene('scribe_names_candle') },
      ]
    };
  },

  // ── TEMPLE QUARTER ────────────────────────
  temple_quarter_arrival: () => ({
    location: 'Temple Quarter — Church of the Eternal Flame',
    locationIcon: '🕯',
    threat: '⚠ Church Territory',
    narration: `The Temple Quarter is too quiet for a district that usually echoes with prayer bells. The great doors of the Church of the Eternal Flame stand open — unusual. Inside the dim nave, candles burn in rows but no clergy move between them. At the far end, kneeling before the altar, is a woman in grey robes. Sister Mourne. She doesn't look up when you enter, but her shoulders tighten. She knew you were coming.`,
    sub: `She's waiting for you. She's already decided something.`,
    options: [
      { icon: '💬', label: '"Sister Mourne. I know about Elder Varek\'s order."', type: 'talk',
        action: () => runScene('mourne_confrontation') },
      { icon: '🔍', label: 'Check the nave for Church agents watching', type: 'explore',
        roll: { stat: 'WIS', dc: 12 },
        onSuccess: () => { setFlag('saw_agents'); runScene('mourne_agents_spotted'); },
        onFail: () => runScene('mourne_confrontation') },
      { icon: '👁', label: 'Watch her — don\'t reveal what you know yet', type: 'explore',
        action: () => runScene('mourne_observed') },
    ]
  }),

  mourne_confrontation: () => {
    setNPCState('mourne', 'calculating');
    return {
      location: 'Temple Quarter — Sister Mourne',
      locationIcon: '🕯',
      narration: `Mourne rises from the kneeler without hurry. She turns, and her face is completely calm — the calm of someone who has thought through every possible version of this conversation. "I wondered how long it would take," she says. "A day? Two?" She folds her hands. "You have a document. Or you've spoken to the Scribe. Either way, you know Elder Varek gave an order." A long pause. "What you don't know is why I followed it."`,
      sub: `She's not denying it. She wants to explain. This could go many directions.`,
      options: [
        { icon: '💬', label: '"Why? Why burn the Covenant?"', type: 'talk',
          action: () => runScene('mourne_explains_motive') },
        { icon: '⚖', label: '"You\'re under arrest. Come with me to Rhael."', type: 'talk',
          roll: { stat: 'CHA', dc: 13 },
          onSuccess: () => { setFlag('mourne_arrested'); runScene('mourne_surrenders'); },
          onFail: () => runScene('mourne_refuses_arrest') },
        { icon: '⚔', label: 'Attack — she\'s a traitor, no more talking', type: 'combat',
          action: () => {
            if (window.AudioEngine) AudioEngine.transition('combat', 1000);
            startCombat([{ name: 'Sister Mourne', hp: 65, ac: 14, atk: 6, icon: '🕯', id: 'mourne' }]);
          }
        },
        { icon: '💰', label: '"Tell me everything and I\'ll make sure Varek takes the fall alone."', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => { setFlag('mourne_allied'); runScene('mourne_becomes_ally'); },
          onFail: () => runScene('mourne_sees_through_deal') },
      ]
    };
  },

  mourne_explains_motive: () => {
    setFlag('knows_true_motive');
    addLog('📜 REVELATION: The Covenant was a trap — it would have given the Crown control of the Church\'s treasury.', 'holy');
    return {
      location: 'Temple Quarter',
      locationIcon: '🕯',
      narration: `"The Covenant wasn't peace," Mourne says quietly. "Read the clause on page four. The Crown gains oversight of Church finances within a year of signing. Within two years, the Church becomes a department of the crown. We would have ceased to exist as an independent institution." She meets your eyes. "Elder Varek saw it. I saw it. We made a decision." She pauses. "A wrong one, perhaps. But the alternative was institutional death."`,
      sub: `The Covenant was a power grab. Both sides had reasons. What do you do with this?`,
      options: [
        { icon: '💬', label: '"Where is Elder Varek now? This still needs to end properly."', type: 'talk',
          action: () => { setFlag('knows_varek_location'); runScene('mourne_reveals_varek'); } },
        { icon: '⚖', label: '"You still broke the law. I\'m bringing you in."', type: 'talk',
          roll: { stat: 'CHA', dc: 14 },
          onSuccess: () => runScene('mourne_surrenders'),
          onFail: () => runScene('mourne_refuses_arrest') },
        { icon: '🤝', label: '"Help me find Varek. Together we end this without more bloodshed."', type: 'talk',
          action: () => { setFlag('mourne_allied'); runScene('mourne_becomes_ally'); } },
        { icon: '🏃', label: 'Leave — report to Rhael, let the Crown decide', type: 'move',
          action: () => runScene('rhael_with_evidence') },
      ]
    };
  },

  mourne_becomes_ally: () => {
    setFlag('mourne_ally');
    addLog('📜 ALLY GAINED: Sister Mourne will lead you to Elder Varek.', 'holy');
    grantHolyPoints(5);
    grantXP(250);
    return {
      location: 'Temple Quarter',
      locationIcon: '🕯',
      narration: `Something shifts in Mourne's expression — not relief exactly, but the easing of a weight she's carried alone for three days. "Elder Varek is at the Monastery of Saint Aldric. He went there to wait out the fallout." She looks at the document in your hands. "He doesn't know about the Scribe. He thinks the evidence is destroyed." She pulls a grey hood over her head. "I'll take you there. But understand — he is not going to come quietly."`,
      sub: `Head to the Monastery of Saint Aldric. The final confrontation awaits.`,
      options: [
        { icon: '🗺', label: 'Travel to the Monastery of Saint Aldric with Mourne', type: 'move',
          action: () => { if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
        { icon: '💬', label: '"Tell me everything about Varek before we go"', type: 'talk',
          action: () => runScene('mourne_briefs_on_varek') },
      ]
    };
  },

  // ── ARRESTED ──────────────────────────────
  arrested_scene: () => {
    setFlag('arrested');
    grantHellPoints(5);
    return {
      location: 'Vaelthar Gaol — Cell Block',
      locationIcon: '⛓',
      threat: '⛓ IMPRISONED',
      narration: `The cell is cold stone and old straw. They took your weapons but not your wits. Through the bars you can hear the guards talking — something about the Archive, something about a name being found. You have maybe two hours before whoever locked the Archive comes looking for the Scribe. You need out. Now.`,
      sub: `Escape, persuade a guard, or wait — each path changes how Vaelthar sees you.`,
      options: [
        { icon: '🔓', label: 'Pick the lock — you noticed a bent nail in the straw', type: 'explore',
          roll: { stat: 'DEX', dc: 13 },
          onSuccess: () => { setFlag('escaped_gaol'); runScene('escaped_cell'); },
          onFail: () => runScene('failed_escape') },
        { icon: '💬', label: 'Convince the guard you have information Rhael needs', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => runScene('released_by_rhael'),
          onFail: () => runScene('guard_ignores_you') },
        { icon: '😠', label: 'Wait. Rhael will come. He needs you more than you need him.', type: 'explore',
          action: () => runScene('rhael_visits_cell') },
      ]
    };
  },

  // ── VAELTHAR SCOUT ───────────────────────
  vaelthar_scout: () => ({
    location: 'Vaelthar Main Square',
    locationIcon: '🏰',
    narration: `The square tells a story if you know how to read it. The merchants have packed up early — a sign of expected violence. Three Church soldiers in plain clothes linger near the Archive; they're not subtle. The fountain in the center has been recently scrubbed — someone cleaned up blood. And Captain Rhael hasn't moved from his post in what looks like hours. He's guarding something, or waiting for something.`,
    sub: `Church soldiers watching the Archive. Rhael standing guard. Someone cleaned up blood.`,
    options: [
      { icon: '💬', label: 'Approach Captain Rhael', type: 'talk', action: () => runScene('rhael_first_meeting') },
      { icon: '🔍', label: 'Examine the scrubbed fountain — whose blood?', type: 'explore',
        roll: { stat: 'WIS', dc: 11 },
        onSuccess: () => { setFlag('found_blood_evidence'); runScene('fountain_clue'); },
        onFail: () => runScene('fountain_nothing') },
      { icon: '👁', label: 'Shadow the Church soldiers — where do they go?', type: 'explore',
        roll: { stat: 'DEX', dc: 12 },
        onSuccess: () => { setFlag('followed_agents'); runScene('church_agents_tracked'); },
        onFail: () => runScene('agents_spot_you') },
      { icon: '📜', label: 'Find the Trembling Scribe near the Archive', type: 'talk',
        action: () => runScene('scribe_approach') },
    ]
  }),

  // ── MISC SCENES ──────────────────────────
  banners_clue: () => {
    addLog('📜 CLUE: The banners were torn from the inside — someone inside the Church did this deliberately.', 'holy');
    return {
      location: 'Vaelthar Gate',
      locationIcon: '🏰',
      narration: `You pull back a section of the torn banner and freeze. The tear is from the inside — someone grabbed it from behind the gate and pulled. Church-side. Whoever tore these banners was making a statement, or staging a scene. And there's a small ink mark on the fabric — an Elder's seal. Not the Crown's. The Church tore its own banners.`,
      sub: `The Church destroyed its own symbols to frame the Crown. This was staged.`,
      options: [
        { icon: '💬', label: 'Bring this to Captain Rhael', type: 'talk', action: () => runScene('rhael_first_meeting') },
        { icon: '📜', label: 'Find the Scribe — he might recognize the seal', type: 'talk', action: () => runScene('scribe_approach') },
      ]
    };
  },

  fountain_clue: () => {
    addLog('📜 CLUE: Someone was killed at the fountain recently. The Church scrubbed it.', 'holy');
    return {
      location: 'Vaelthar Square — The Fountain',
      locationIcon: '⛲',
      narration: `Between the cobblestones, where water runs slow, you find it — a smear of dark red that soap and water didn't quite erase. And caught in the drain grate: a button. Not a soldier's button. A scribe's button — pale bone, carved with a small quill mark. The Scribe's assistant didn't "not show up." The Scribe's assistant was killed here.`,
      sub: `The Scribe's assistant was murdered. The Scribe is next if you don't move.`,
      options: [
        { icon: '🏃', label: 'Rush to the Scribe immediately — he\'s in danger', type: 'move',
          action: () => runScene('scribe_urgent') },
        { icon: '💬', label: 'Show Rhael the button — he needs to know', type: 'talk',
          action: () => runScene('rhael_first_meeting') },
      ]
    };
  },

  scribe_urgent: () => {
    setFlag('met_scribe');
    return {
      location: 'Archive Steps — URGENT',
      locationIcon: '📜',
      threat: '⚠ In Danger',
      narration: `You find the Scribe still at the Archive steps — but now two men in plain clothes have positioned themselves at either end of the street. They haven't moved yet, but their eyes are on him. The Scribe sees you coming and his expression shifts from terror to desperate hope. You have maybe sixty seconds before those men decide to act.`,
      sub: `Get him out NOW. The Church agents are about to move.`,
      options: [
        { icon: '🏃', label: 'Grab the Scribe and run — get him off the street', type: 'combat',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { setFlag('scribe_rescued'); runScene('scribe_rescued_scene'); },
          onFail: () => runScene('agents_intercept') },
        { icon: '😠', label: 'Confront the agents — "Back off. He\'s under my protection."', type: 'combat',
          roll: { stat: 'CHA', dc: 14 },
          onSuccess: () => runScene('agents_back_down'),
          onFail: () => { startCombat([
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_1' },
            { name: 'Church Agent', hp: 40, ac: 13, atk: 5, icon: '🗡', id: 'agent_2' },
          ]); }
        },
      ]
    };
  },

  scribe_rescued_scene: () => {
    addLog('📜 QUEST UPDATE: The Trembling Scribe is safe. He\'ll meet you at the Thornwood Gate inn.', 'holy');
    grantHolyPoints(8);
    grantXP(120);
    return {
      location: 'Vaelthar Back Alley',
      locationIcon: '🏚',
      narration: `You pull the Scribe into a narrow alley as the Church agents break into a run behind you. Two turns, a locked gate — you vault it, he barely makes it. When you finally stop, he's panting, hands on his knees. "They killed Torven," he gasps. "My assistant. He saw the document." He looks up. "I need to show you something. Something I didn't tell anyone. Meet me at the inn by the Thornwood Gate tonight. Come alone."`,
      sub: `The Scribe has more information. Meet him at the Thornwood Gate inn.`,
      options: [
        { icon: '🗺', label: 'Head to the Thornwood Gate inn now', type: 'move',
          action: () => runScene('thornwood_gate_inn') },
        { icon: '💬', label: '"Tell me now — we may not have time"', type: 'talk',
          action: () => runScene('scribe_tells_all_now') },
      ]
    };
  },

  // ── CHAPTER 1 FINALE ─────────────────────
  monastery_arrival: () => {
    setFlag('chapter1_finale');
    return {
      location: 'Monastery of Saint Aldric',
      locationIcon: '⛪',
      threat: '⚔ HIGH DANGER',
      narration: `The monastery sits on a ridge above Vaelthar — walls of grey stone, torches burning despite the daylight. As you approach, you spot Elder Varek through the courtyard gate: a heavyset man in white robes, surrounded by four armed Church soldiers. He hasn't seen you yet. This is the moment. The evidence is in your hands. Varek ordered the Covenant burned, triggered a crisis that's already cost lives. How this ends is up to you.`,
      sub: `Elder Varek is here. You have the evidence. The chapter ends here — one way or another.`,
      options: [
        { icon: '⚔', label: 'Storm in and arrest Varek — take the soldiers if they resist', type: 'combat',
          roll: { stat: 'STR', dc: 14 },
          onSuccess: () => {
            addLog(`Your charge scatters the soldiers — but Varek draws a blade. "I won't be chained." The real fight begins.`, 'combat');
            startCombat([
              { name: 'Elder Varek', hp:120, ac:17, atk:8, icon:'🔥', id:'elder_varek', boss:true,
                spells:['hellfire','divine_wrath','summon_flame'], level:6, xp:600 },
            ]);
          },
          onFail: () => {
            addLog(`The soldiers hold the line. Varek watches coldly from behind them.`, 'combat');
            startCombat([
              { name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs1' },
              { name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs2' },
              { name: 'Elder Varek', hp:120, ac:17, atk:8, icon:'🔥', id:'elder_varek', boss:true,
                spells:['hellfire','divine_wrath','summon_flame'], level:6, xp:600 },
            ]);
          }
        },
        { icon: '🗣', label: 'Confront Varek openly — show the document and demand surrender', type: 'talk',
          roll: { stat: 'CHA', dc: 15 },
          onSuccess: () => {
            addLog(`⚔ Varek's soldiers lower their weapons — but Varek himself draws a blade. "I will not be taken alive." The fight is unavoidable.`, 'combat');
            startCombat([
              { name: 'Elder Varek', hp:120, ac:17, atk:8, icon:'🔥', id:'elder_varek', boss:true,
                spells:['hellfire','divine_wrath','summon_flame'], level:6, xp:600 },
            ]);
          },
          onFail: () => {
            addLog(`Varek signals his soldiers. "Kill them." They draw weapons.`, 'combat');
            startCombat([
              { name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs1' },
              { name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs2' },
              { name: 'Elder Varek', hp:120, ac:17, atk:8, icon:'🔥', id:'elder_varek', boss:true,
                spells:['hellfire','divine_wrath','summon_flame'], level:6, xp:600 },
            ]);
          }
        },
        { icon: '🕵', label: 'Slip in and steal Varek\'s communications before confronting him', type: 'explore',
          roll: { stat: 'DEX', dc: 14 },
          onSuccess: () => { setFlag('varek_evidence_doubled'); addLog('📜 ITEM GAINED: Varek\'s private correspondence — more evidence.', 'holy'); runScene('chapter1_end_surrender'); },
          onFail: () => runScene('monastery_caught_sneaking') },
        { icon: '🏃', label: 'This is bigger than you. Go back — alert Captain Rhael first', type: 'move',
          action: () => { setFlag('called_rhael_help'); runScene('chapter1_end_rhael_leads'); } },
      ]
    };
  },

  chapter1_end_arrest: () => {
    setFlag('chapter1_complete');
    grantHolyPoints(15);
    grantXP(600);
    grantXP(800);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    addLog('📖 CHAPTER I COMPLETE — "The Shattered Covenant"', 'holy');
    addLog('Elder Varek is in chains. The truth about the Covenant is out. Vaelthar will never be the same.', 'narrator');
    return {
      location: 'Monastery Courtyard — After the Storm',
      locationIcon: '⛪',
      narration: `The soldiers yielded when Varek fell. He's on his knees in the monastery courtyard, wrists bound, his white robes dusty and torn. He looks older suddenly — not an elder of the Church, just a frightened man who made a catastrophic decision and got caught. Captain Rhael arrives within the hour, takes Varek into Watch custody, and looks at you for a long moment. "The city owes you something," he says. "It won't say so publicly. But it does." Chapter I is over. The road ahead leads deeper into the shadow of what the Covenant's death has already set in motion.`,
      sub: `Chapter I complete. Chapter II begins: "What the Covenant Left Behind."`,
      options: [
        { icon: '📖', label: 'Begin Chapter II — the aftermath', type: 'move',
          action: () => { addLog('⚔ Chapter II begins. The world has changed.', 'system'); } },
      ]
    };
  },

  chapter1_end_surrender: () => {
    setFlag('chapter1_complete');
    grantHolyPoints(12);
    grantXP(500);
    grantXP(700);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    addLog('📖 CHAPTER I COMPLETE — "The Shattered Covenant"', 'holy');
    return {
      location: 'Monastery — Varek Yields',
      locationIcon: '⛪',
      narration: `The document does what a sword could not. Varek reads it once — his own seal, his own order — and something goes out of him. He dismisses his soldiers with a gesture, and when they hesitate he repeats it. He surrenders quietly, without theatrics. "I acted to protect the Church," he says. "Whether that justifies it — that's for the magistrates now." You escort him back to Vaelthar. The streets are quiet. Word travels faster than you do. By evening, the crisis has a name, a face, and a verdict pending. Chapter I is over.`,
      sub: `Chapter I complete. Chapter II begins.`,
      options: [
        { icon: '📖', label: 'Begin Chapter II', type: 'move',
          action: () => { addLog('⚔ Chapter II begins. The world has changed.', 'system'); } },
      ]
    };
  },

  chapter1_end_rhael_leads: () => {
    setFlag('chapter1_complete');
    grantHolyPoints(10);
    grantXP(400);
    grantXP(600);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    addLog('📖 CHAPTER I COMPLETE — "The Shattered Covenant"', 'holy');
    return {
      location: 'Vaelthar — Rhael Mobilizes',
      locationIcon: '🏰',
      narration: `Rhael doesn't hesitate. Within an hour the Watch is moving in force toward the monastery. Varek's soldiers yield at the gate — they're soldiers, not martyrs, and they know what the document means. Varek is taken alive. At the debriefing afterward, Rhael gives you a look across the table. "You could have done this alone," he says. "You chose not to. That's either wisdom or doubt. I haven't decided which." Either way, it's over — for now. Chapter I ends not with thunder, but with paperwork and the sound of chains.`,
      sub: `Chapter I complete. You chose caution over glory.`,
      options: [
        { icon: '📖', label: 'Begin Chapter II', type: 'move',
          action: () => { addLog('⚔ Chapter II begins.', 'system'); } },
      ]
    };
  },

  monastery_caught_sneaking: () => ({
    location: 'Monastery Corridor',
    locationIcon: '⛪',
    threat: '⚠ CAUGHT',
    narration: `A soldier rounds a corner and you're face to face. He shouts. The alarm spreads through the monastery in seconds — boots on stone, doors slamming. You have seconds to decide.`,
    sub: `Caught inside the monastery. Fight or flee.`,
    options: [
      { icon: '⚔', label: 'Fight your way to Varek', type: 'combat',
        action: () => startCombat([
          { name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs1' },
          { name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs2' },
        ]) },
      { icon: '🏃', label: 'Flee — regroup and try again', type: 'move',
        roll: { stat: 'DEX', dc: 12 },
        onSuccess: () => runScene('monastery_arrival'),
        onFail: () => { addLog('You\'re surrounded. There\'s no escape.', 'combat');
          startCombat([{ name: 'Church Soldier', hp:45, ac:14, atk:5, icon:'⚔', id:'cs1' }]); } },
    ]
  }),

  // ── ALL MISSING SCENES INJECTED ──────────
  ...MISSING_SCENES,
};

// ══════════════════════════════════════════════════════════════
//  PERSONAL QUEST SCENES — One hook + one payoff per origin
//  Triggered by startPersonalQuestHook() after game starts
// ══════════════════════════════════════════════════════════════

const PERSONAL_QUEST_SCENES = {

  // ── FALLEN NOBLE ─────────────────────────────────────────
  pq_fallen_noble_hook: () => {
    const char = gameState.character;
    setFlag('pq_noble_hook_seen');
    return {
      location: 'Vaelthar — A Familiar Coat of Arms',
      locationIcon: '🏰',
      narration: `You stop in your tracks. On the wall of a merchant's building — half-obscured by a new coat of paint — is your family's coat of arms. Not a copy. The real seal, carved in the original stone. This building was your family's Vaelthar trading post, sold off during the collapse. The merchant inside notices you staring. He looks nervous. He knows something about who bought the debt.`,
      sub: `Your family's old trading post. The merchant knows something.`,
      options: [
        { icon: '💬', label: 'Go in and ask the merchant directly', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => { setFlag('pq_noble_merchant_talked'); addLog(`📜 PERSONAL QUEST: The merchant confirms — a Church elder bought your family's debts the week before the estate fire. Not after. Before.`, 'hell'); runScene('pq_fallen_noble_payoff'); },
          onFail: () => { addLog('He shuts up the moment he senses you pressing. Too afraid to talk.', 'system'); runScene('pq_fallen_noble_payoff'); } },
        { icon: '🔍', label: 'Search the building exterior for evidence first', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { setFlag('pq_noble_evidence'); addLog('📜 CLUE: Carved into the foundation stone — a date, and a Church notary seal. The estate was marked for acquisition before the fire.', 'holy'); runScene('pq_fallen_noble_payoff'); },
          onFail: () => runScene('pq_fallen_noble_payoff') },
        { icon: '⏭', label: 'Note the location and come back later', type: 'move',
          action: () => { addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — found the old trading post. The merchant knows something.`, 'hell'); setFlag('pq_noble_hook_seen'); } },
      ]
    };
  },

  pq_fallen_noble_payoff: () => {
    const char = gameState.character;
    setFlag('pq_noble_payoff_seen');
    grantXP(200);
    return {
      location: 'Vaelthar — The Merchant\'s Back Room',
      locationIcon: '🏰',
      narration: `The merchant, once he's sure the door is locked and no one is watching, pulls out a ledger. His hands shake. "The debt purchase was arranged by a notary working for the Church of the Eternal Flame. I bought the building from the Church, not from your family. I always assumed—" He stops. "I assumed your family sold willingly. I think now they didn't have a choice." He looks at you. "The notary's name was Aldis. He worked at the Archive."`,
      sub: `The Church engineered your family's ruin. The Archive scribe may know more.`,
      options: [
        { icon: '💬', label: 'Find Aldis the Scribe — he\'s connected to everything', type: 'talk',
          action: () => { setFlag('pq_noble_scribe_link'); addLog('📜 PERSONAL QUEST: Your family\'s fall and the Covenant plot share a name — Aldis, the Archive scribe. This goes deeper than you thought.', 'holy'); runScene('scribe_approach'); } },
        { icon: '😠', label: '"The Church destroyed my family. I want Elder Varek."', type: 'talk',
          action: () => { setFlag('pq_noble_varek_target'); grantHellPoints(3); addLog('📜 PERSONAL QUEST: The Church took everything from you. Varek\'s arrest is now personal.', 'hell'); } },
      ]
    };
  },

  // ── WAR ORPHAN ─────────────────────────────────────────
  pq_war_orphan_hook: () => {
    const char = gameState.character;
    setFlag('pq_orphan_hook_seen');
    return {
      location: 'Vaelthar — A Soldier\'s Face',
      locationIcon: '🏰',
      narration: `In the square, among the Watch soldiers standing guard, you see a face. Old now, heavier, a scar you don't remember — but the jaw, the eyes, the particular way he stands with his weight on his left foot. You were seven when you last saw that face. He was giving orders. You were hiding in a root cellar, listening to your village burn above you. He's a Watch sergeant now. He hasn't seen you yet.`,
      sub: `One of the men who ordered the raid on your village. Right here. Right now.`,
      options: [
        { icon: '👁', label: 'Watch him — don\'t act yet. Confirm it\'s him.', type: 'explore',
          roll: { stat: 'WIS', dc: 10 },
          onSuccess: () => { setFlag('pq_orphan_confirmed'); addLog('📜 CONFIRMED: It\'s him. Sergeant Mael. You\'d know him anywhere. He works directly under Captain Rhael.', 'hell'); runScene('pq_war_orphan_payoff'); },
          onFail: () => { addLog('You can\'t be certain from this distance. He moves off before you can get closer.', 'system'); runScene('pq_war_orphan_payoff'); } },
        { icon: '😠', label: 'Confront him now — you\'ve waited long enough', type: 'combat',
          roll: { stat: 'CHA', dc: 16 },
          onSuccess: () => { setFlag('pq_orphan_confronted'); addLog('📜 He goes pale. He remembers you — or the raid. Same thing.', 'hell'); runScene('pq_war_orphan_payoff'); },
          onFail: () => { grantHellPoints(3); setFlag('guards_alerted'); addLog('He shouts for the Watch. Your face is now known. +3 Hell Points.', 'hell'); runScene('arrested_scene'); } },
        { icon: '⏭', label: 'Let him go. Not today. But you\'ll find him again.', type: 'move',
          action: () => { setFlag('pq_orphan_hook_seen'); addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — Sergeant Mael of the Vaelthar Watch. You\'ll be back.`, 'hell'); } },
      ]
    };
  },

  pq_war_orphan_payoff: () => {
    setFlag('pq_orphan_payoff_seen');
    grantXP(200);
    return {
      location: 'Vaelthar — The Truth About the Raid',
      locationIcon: '🏰',
      narration: `You find what you can from the Watch records — a clerk who owes you a favour, a ledger left open too long. The raid on your village is listed as "pacification action, commissioned by the Church of the Eternal Flame, year 14 of the current covenant period." It was paid for. Your village was targeted because it sat on land the Church wanted for a reliquary road. The commander's name is listed. General Vane. He's alive. He's in the capital.`,
      sub: `The raid was commissioned by the Church. General Vane ordered it. He's alive.`,
      options: [
        { icon: '📜', label: 'Copy the record — you\'ll need proof', type: 'explore',
          action: () => { addLog('📜 ITEM GAINED: Watch Pacification Ledger (copy) — proof the raid was Church-commissioned.', 'holy'); gameState.character?.inventory?.push('Pacification Ledger (copy)'); grantHolyPoints(3); addLog('📜 PERSONAL QUEST: You have a name. General Vane. A face. Sergeant Mael. And proof.', 'holy'); } },
        { icon: '😠', label: 'Burn the record — let Vane think it\'s gone', type: 'explore',
          action: () => { grantHellPoints(5); addLog('📜 You burn the record. Vane won\'t know you have a copy. Or won\'t know there isn\'t one. +5 Hell Points.', 'hell'); } },
      ]
    };
  },

  // ── CURSED BLOODLINE ───────────────────────────────────
  pq_cursed_blood_hook: () => {
    const char = gameState.character;
    setFlag('pq_curse_hook_seen');
    return {
      location: 'Vaelthar — The Voice, Louder',
      locationIcon: '🏰',
      threat: '⚠ Bloodline Stirs',
      narration: `It hasn't spoken since you arrived in Vaelthar — and then, in the quiet of the evening, standing near the Archive, it does. Clearer than usual. A single sentence, in a language you didn't know you knew: "The seal is broken. I am waking." And then, very quietly: "I have been waiting for you specifically." Your palm burns where the scar sits. Across the square, a woman in grey robes turns and looks directly at you. She couldn't have heard. But she smiles as if she did.`,
      sub: `The Voice in your blood is awake. The woman in grey knows something.`,
      options: [
        { icon: '💬', label: 'Follow the woman in grey — she recognised something', type: 'talk',
          roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => { setFlag('pq_curse_woman_found'); addLog('📜 She stops and waits for you. "You carry a shard," she says. "So do I. There are six of us."', 'hell'); runScene('pq_cursed_blood_payoff'); },
          onFail: () => { addLog('She\'s gone by the time you reach the corner. But she left something — a mark on the wall, like your scar.', 'system'); runScene('pq_cursed_blood_payoff'); } },
        { icon: '🔍', label: 'Examine your scar — it\'s changed since arriving here', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { setFlag('pq_curse_scar_read'); addLog('📜 CLUE: The scar has new lines. A symbol you recognise from the monastery walls: "It breathes below." Your bloodline curse and the monastery Voice are the same thing.', 'holy'); runScene('pq_cursed_blood_payoff'); },
          onFail: () => runScene('pq_cursed_blood_payoff') },
        { icon: '⏭', label: 'Ignore it. You can\'t afford distractions right now.', type: 'move',
          action: () => { grantHellPoints(2); addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — the Voice is awake. Ignoring it costs something. +2 Hell Points.`, 'hell'); } },
      ]
    };
  },

  pq_cursed_blood_payoff: () => {
    setFlag('pq_curse_payoff_seen');
    grantXP(200);
    return {
      location: 'Vaelthar — The Shard Bearers',
      locationIcon: '🏰',
      narration: `The woman finds you instead, eventually. Her name is Ysel. She carries the same mark on her wrist, different shape. "When the old god shattered," she says, "its essence split into pieces. Some pieces went into bloodlines. Your grandmother didn't make a deal with a demon. She was chosen as a vessel — involuntarily, I think — for one of the fragments." She holds out her wrist. "The Covenant was the seal that kept the fragments dormant. It's broken now. We're all waking up." She pauses. "There are six of us I know of. The seventh fragment went somewhere worse."`,
      sub: `Your curse is a god-fragment. Six carriers exist. The seventh fragment is the Voice Below.`,
      options: [
        { icon: '💬', label: '"Is this curable? Can the fragment be removed?"', type: 'talk',
          action: () => { addLog('Ysel: "Removed? No. Controlled? Yes — if you understand it. Mastered? One person has managed that. They\'re not available anymore."', 'narrator'); grantXP(50); setFlag('pq_curse_understands'); } },
        { icon: '🤝', label: '"Tell me the other bearers\' names. We should find each other."', type: 'talk',
          action: () => { setFlag('pq_curse_network'); addLog('📜 PERSONAL QUEST: Ysel gives you two names. The bloodline curse network has begun. This connects to Chapter 2.', 'holy'); grantXP(75); } },
      ]
    };
  },

  // ── DIVINELY CHOSEN ───────────────────────────────────
  pq_divine_chosen_hook: () => {
    const char = gameState.character;
    setFlag('pq_divine_hook_seen');
    return {
      location: 'Church of the Eternal Flame — Vaelthar',
      locationIcon: '🕯',
      narration: `You step into the church for reasons you can't fully explain — the light was wrong, or the door was open, or something pulled. Inside, past the rows of candles, you see it. On the back wall behind the main altar, carved into stone that predates the current building by centuries: a phrase in old script. You can read it, somehow, despite not knowing the language. It says: "The Chosen comes after the breaking. The Chosen does not know the task. The Chosen will not be given a choice." Below it, crudely scratched in fresher marks: your description. Physical. Exact.`,
      sub: `Someone carved your description into a church wall centuries ago. Before you were born.`,
      options: [
        { icon: '🔍', label: 'Study the carving — when was it made?', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { setFlag('pq_divine_carving_dated'); addLog('📜 CLUE: Stone analysis — the carving is 400 years old at minimum. Someone prophesied you centuries before your birth.', 'holy'); runScene('pq_divine_chosen_payoff'); },
          onFail: () => runScene('pq_divine_chosen_payoff') },
        { icon: '🙏', label: 'Pray — ask for clarity. You were told you\'d be guided.', type: 'explore',
          roll: { stat: 'WIS', dc: 13 },
          onSuccess: () => { setFlag('pq_divine_prayer_answered'); grantHolyPoints(8); addLog('📜 The certainty comes: not words, just direction. Something is wrong in this city, and you are specifically needed to fix it. +8 Holy Points.', 'holy'); runScene('pq_divine_chosen_payoff'); },
          onFail: () => { addLog('Silence. As usual.', 'system'); runScene('pq_divine_chosen_payoff'); } },
        { icon: '⏭', label: 'Leave. You don\'t want to know what "no choice" means yet.', type: 'move',
          action: () => { addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — a carving in the old church describes you exactly. Dated centuries ago.`, 'hell'); } },
      ]
    };
  },

  pq_divine_chosen_payoff: () => {
    setFlag('pq_divine_payoff_seen');
    grantXP(200);
    return {
      location: 'Church Archive — Lower Level',
      locationIcon: '🕯',
      narration: `A priest finds you still staring at the wall. He's old enough to have heard of the carving before. "We call it the Anticipatory Saint," he says. "Every generation, someone matches the description. They always arrive near a breaking point." He leads you to a locked cabinet. Inside: a scroll listing every previous Chosen, what they did, and what it cost them. The list is long. None of them survived past the age you are now. The last entry has no name. Just a date. Six months from today.`,
      sub: `Every Chosen has died young. The scroll ends six months from now. Your name isn't on it yet.`,
      options: [
        { icon: '📜', label: 'Take the scroll — you need to read every entry', type: 'explore',
          action: () => { addLog('📜 ITEM GAINED: The Anticipatory Saint Scroll — records of every Chosen, their deeds, their deaths.', 'holy'); gameState.character?.inventory?.push('The Anticipatory Saint Scroll'); grantHolyPoints(5); addLog('📜 PERSONAL QUEST: You have six months by the scroll\'s reckoning. What happens then is unclear.', 'holy'); } },
        { icon: '💬', label: '"Why do they all die? What kills them?"', type: 'talk',
          action: () => { addLog('The priest: "The task. Whatever they were chosen for. It always costs more than a person has. That\'s why it takes a Chosen — ordinary people don\'t have enough to spend."', 'narrator'); grantHolyPoints(3); } },
      ]
    };
  },

  // ── EXILE ─────────────────────────────────────────────
  pq_exile_hook: () => {
    const char = gameState.character;
    setFlag('pq_exile_hook_seen');
    return {
      location: 'Vaelthar — The Brand Is Recognised',
      locationIcon: '🏰',
      threat: '⚠ Exposed',
      narration: `Your collar slips in the crowd. Just for a moment. But a man with a sharp face and sharper eyes catches the edge of the brand on your neck, and his expression shifts — not hostile, something more considered. He falls into step beside you. "The exile brand of the city of Hareth," he says quietly. "I know that brand. I know the case it came from. I also know the man who gave the false testimony that put it there." He doesn't slow. "His name is worth something to you, I think."`,
      sub: `Someone knows your case. And they know who lied.`,
      options: [
        { icon: '💬', label: '"Who are you and what do you want for the name?"', type: 'talk',
          roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => { setFlag('pq_exile_contact_trusted'); addLog('📜 His name is Cael. Former court recorder. He has the original testimony documents — the unedited version. He wants protection.', 'holy'); runScene('pq_exile_payoff'); },
          onFail: () => { addLog('He doesn\'t give you his name. But he gives you a location: the archive basement, third shelf, green ledger.', 'system'); runScene('pq_exile_payoff'); } },
        { icon: '🔍', label: 'Follow him — see where he goes before trusting him', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { setFlag('pq_exile_followed'); addLog('📜 He goes to the Church Archive. He works there. He has access to sealed documents. He could be useful or dangerous.', 'holy'); runScene('pq_exile_payoff'); },
          onFail: () => { addLog('You lose him in the crowd. He didn\'t look back.', 'system'); runScene('pq_exile_payoff'); } },
        { icon: '⏭', label: 'Ignore him. It could be a trap.', type: 'move',
          action: () => { addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — someone recognised your brand and says they know who lied. Possible trap. Possible truth.`, 'hell'); } },
      ]
    };
  },

  pq_exile_payoff: () => {
    setFlag('pq_exile_payoff_seen');
    grantXP(200);
    return {
      location: 'Church Archive — Basement',
      locationIcon: '📜',
      narration: `Green ledger, third shelf. It's there. Court testimony transcripts — including a case from Hareth, including your name, including the witness statement that exiled you. And next to it, in the same handwriting but a different ink, the original version. Before it was edited. The difference is one sentence. One sentence that completely inverts the testimony. The editor's initials are stamped on the revision: E.V. Elder Varek's initials. The man you're already hunting arranged your exile.`,
      sub: `Elder Varek arranged your false exile. This just became very personal.`,
      options: [
        { icon: '📜', label: 'Take both documents — the original and the edited version', type: 'explore',
          action: () => { addLog('📜 ITEM GAINED: Exile Testimony (original + edited) — proof of falsification, initialled by Elder Varek.', 'holy'); gameState.character?.inventory?.push("Exile Testimony Documents"); grantHolyPoints(5); addLog('📜 PERSONAL QUEST: Varek exiled you. The Covenant investigation and your personal quest are now the same quest.', 'holy'); setFlag('pq_exile_varek_connected'); } },
        { icon: '😠', label: 'Varek is already going down. Now it\'s more than duty.', type: 'explore',
          action: () => { grantHellPoints(3); setFlag('pq_exile_rage'); addLog('📜 The cold fury that carries you from here is something different from justice. +3 Hell Points.', 'hell'); } },
      ]
    };
  },

  // ── MONSTER HUNTER ────────────────────────────────────
  pq_hunter_hook: () => {
    const char = gameState.character;
    setFlag('pq_hunter_hook_seen');
    return {
      location: 'Vaelthar — A Familiar Kill Pattern',
      locationIcon: '🏰',
      narration: `The Watch sergeant is briefing his men near the fountain. You catch fragments: bodies arranged in a circle, no signs of struggle, markings on the palms. You've seen this before. Not here — three years ago, in a village two hundred miles east, at the start of a case you never closed. The same pattern. The same markings. Which means whatever did this then has been following the same path as you for three years, and you've only just noticed.`,
      sub: `The Vaelthar murders match a case you couldn't close three years ago. It followed you here.`,
      options: [
        { icon: '💬', label: 'Talk to the Watch sergeant — get the full details', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => { setFlag('pq_hunter_watch_briefed'); addLog('📜 The sergeant gives you access. The details are worse than you expected — the circle has a specific diameter. The same every time. It\'s measuring something.', 'holy'); runScene('pq_hunter_payoff'); },
          onFail: () => { addLog('He shoos you off. But you saw enough.', 'system'); runScene('pq_hunter_payoff'); } },
        { icon: '🔍', label: 'Examine the scene yourself — don\'t wait for permission', type: 'explore',
          roll: { stat: 'INT', dc: 13 },
          onSuccess: () => { setFlag('pq_hunter_scene_read'); addLog('📜 CLUE: The palm symbol isn\'t decorative — it\'s a seal mark. The creature is tagging people it intends to return for. The children with blank memories bear the same mark.', 'holy'); runScene('pq_hunter_payoff'); },
          onFail: () => runScene('pq_hunter_payoff') },
        { icon: '⏭', label: 'File it away. Focus on the Covenant first.', type: 'move',
          action: () => { addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — the thing you hunted three years ago is here. It followed you.`, 'hell'); } },
      ]
    };
  },

  pq_hunter_payoff: () => {
    setFlag('pq_hunter_payoff_seen');
    grantXP(200);
    return {
      location: 'Vaelthar — The Creature\'s Trail',
      locationIcon: '🏰',
      narration: `Your old case notes. You kept them, of course — hunters keep notes. The first incident: eleven people, circle, palm marks. Second: nine. Third: fourteen. The numbers aren't random. They're primes. The circles have been getting larger. The palm marks have been getting clearer. It's not hunting randomly — it's getting ready for something. The children with blank memories are the most recent marks. They're being prepared for something specific. The pattern ends at a number you recognise: forty-nine.`,
      sub: `49 marked victims and then — the ritual completes. Currently at 37. You have time. Not much.`,
      options: [
        { icon: '📜', label: 'Document the full pattern — you\'ll need this to stop it', type: 'explore',
          action: () => { addLog('📜 ITEM GAINED: Hunter\'s Case File — full pattern documentation. 37 of 49 marked. 12 remain.', 'holy'); gameState.character?.inventory?.push("Hunter's Case File (Ritual Pattern)"); addLog('📜 PERSONAL QUEST: 12 more victims before the ritual completes. Whatever it\'s building toward connects to the shattered god.', 'holy'); setFlag('pq_hunter_ritual_known'); } },
        { icon: '💬', label: 'Find the children — they\'re the key to understanding this', type: 'talk',
          action: () => { addLog('📜 QUEST LINK: The children with blank memories (c1q10) are directly connected to your personal hunt. Investigating one advances both.', 'system'); setFlag('pq_hunter_children_link'); } },
      ]
    };
  },

  // ── CORRUPTED SAINT ───────────────────────────────────
  pq_saint_hook: () => {
    const char = gameState.character;
    setFlag('pq_saint_hook_seen');
    return {
      location: 'Church of the Eternal Flame — Confession',
      locationIcon: '🕯',
      threat: '⚠ The Debt Stirs',
      narration: `The confessional smells of old wood and other people's sins. You're not here to confess — you're here because you followed a rumour about a priest who hears more than he should. But the moment you step inside the booth, the darkness changes. Not the demon you made your deal with — something else. A collector. "Your invoice is overdue," it says, pleasantly. "The original entity assigned to you has been — retired. I'm handling the outstanding accounts now." A pause. "The first payment is simple. Let the man across the street leave the city tonight. That's all."`,
      sub: `Someone is collecting on your deal. They want you to let a man escape tonight.`,
      options: [
        { icon: '💬', label: '"Who is the man? What does it matter if he leaves?"', type: 'talk',
          roll: { stat: 'WIS', dc: 12 },
          onSuccess: () => { setFlag('pq_saint_learned_target'); addLog('📜 The man is a Church witness scheduled to testify about the Covenant burning. If he leaves, Varek\'s case weakens significantly.', 'hell'); runScene('pq_saint_payoff'); },
          onFail: () => { addLog('"You don\'t need to know. You need to comply."', 'narrator'); runScene('pq_saint_payoff'); } },
        { icon: '😠', label: '"No. I\'m not doing anything for you."', type: 'talk',
          action: () => { grantHellPoints(5); setFlag('pq_saint_refused'); addLog('📜 The voice goes cold. "Then the Church learns your secret before sunrise." +5 Hell Points.', 'hell'); runScene('pq_saint_payoff'); } },
        { icon: '⏭', label: 'Leave without answering', type: 'move',
          action: () => { addLog(`📜 PERSONAL QUEST UPDATE: "${char.name}" — someone is collecting on your old deal. First payment: let a man flee the city.`, 'hell'); } },
      ]
    };
  },

  pq_saint_payoff: () => {
    setFlag('pq_saint_payoff_seen');
    grantXP(200);
    return {
      location: 'Vaelthar — The Choice',
      locationIcon: '🕯',
      narration: `The man across the street is exactly where the voice said he'd be. Middle-aged, merchant-looking, nervous. You watch him for ten minutes. He's about to board a coach. If you do nothing, he leaves. The Covenant case loses a witness. Varek's prosecution becomes harder. If you stop him — report him to Rhael, hold him here — you've defied the collector. The Church probably won't learn your secret immediately. But the collector will find another way to call in the debt.`,
      sub: `Let him go and serve darkness, or stop him and pay later. Both have a cost.`,
      options: [
        { icon: '✋', label: 'Stop him — report him to Rhael. Defy the collector.', type: 'talk',
          action: () => { grantHolyPoints(10); setFlag('pq_saint_defied'); addLog('📜 You stop him. The Covenant case holds. The collector will remember. +10 Holy Points.', 'holy'); addLog('📜 PERSONAL QUEST: You chose conscience over the debt. The consequences are coming — but they\'re not here yet.', 'holy'); } },
        { icon: '👁', label: 'Do nothing. Let him board the coach.', type: 'explore',
          action: () => { grantHellPoints(8); setFlag('pq_saint_complied'); addLog('📜 He goes. The collector will leave you alone — for now. +8 Hell Points.', 'hell'); addLog('📜 PERSONAL QUEST: You served the darkness once more. The debt shrinks. So does something else.', 'hell'); } },
      ]
    };
  },

  // ── BLOOD DEBT ────────────────────────────────────────
  pq_blood_debt_hook: () => {
    const char = gameState.character;
    setFlag('pq_debt_hook_seen');
    return {
      location: 'Vaelthar — A Letter, Hand-Delivered',
      locationIcon: '🏰',
      narration: `A child hands you a folded letter and runs before you can ask questions. The handwriting is familiar — you've been trying to find it for years. It belongs to Senna, the person who saved your life at a cost you've never been able to repay. The letter is short: "I know you've been looking. Please stop. What I gave was given freely and I don't want it returned. I'm fine. Don't come here." The seal on the letter is a church seal. Of the Eternal Flame.`,
      sub: `Senna is alive. She's connected to the Church of the Eternal Flame. She wants you to leave her alone.`,
      options: [
        { icon: '🔍', label: 'Investigate the church seal — which parish sent this?', type: 'explore',
          roll: { stat: 'INT', dc: 11 },
          onSuccess: () => { setFlag('pq_debt_seal_traced'); addLog('📜 CLUE: The seal is from the monastery at Saint Aldric. Senna is at the monastery. That\'s where Elder Varek is hiding.', 'holy'); runScene('pq_blood_debt_payoff'); },
          onFail: () => runScene('pq_blood_debt_payoff') },
        { icon: '💬', label: 'Try to find the child who delivered it', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => { setFlag('pq_debt_child_found'); addLog('A woman gave him a coin to deliver it. Grey robes. He thinks she came from the direction of the Archive.', 'system'); runScene('pq_blood_debt_payoff'); },
          onFail: () => { addLog('The child is long gone.', 'system'); runScene('pq_blood_debt_payoff'); } },
        { icon: '⏭', label: 'Respect her wishes. Leave it alone.', type: 'move',
          action: () => { grantHolyPoints(5); addLog(`📜 PERSONAL QUEST: "${char.name}" chose to respect Senna\'s wishes. +5 Holy Points. But this won\'t stay quiet.`, 'holy'); } },
      ]
    };
  },

  pq_blood_debt_payoff: () => {
    setFlag('pq_debt_payoff_seen');
    grantXP(200);
    return {
      location: 'Following the Trail — Senna',
      locationIcon: '🏰',
      narration: `The trail leads, inevitably, toward the monastery. A monk you speak to on the road remembers her: "Sister Senna. She came to us three years ago. Gave a great deal to the Order." He pauses. "Elder Varek gave her a position. She serves him directly." He looks away. "She doesn't seem… free to leave." The word he chose carefully was "doesn't seem." What he meant was: she isn't.`,
      sub: `Senna is at the monastery, serving Elder Varek under duress. She's not free.`,
      options: [
        { icon: '😠', label: 'Varek has Senna. This is no longer just duty.', type: 'talk',
          action: () => { grantHellPoints(3); setFlag('pq_debt_varek_target'); addLog('📜 PERSONAL QUEST: Varek took Senna. Arresting him means freeing her. The debt and the mission are the same thing now.', 'hell'); } },
        { icon: '🏃', label: 'Head to the monastery — find her before you confront Varek', type: 'move',
          action: () => { setFlag('pq_debt_rescue_intent'); addLog('📜 PERSONAL QUEST: Find Senna inside the monastery. She may be leverage — or she may be the reason Varek thinks he\'s safe.', 'holy');
            if (window.travelToLocation && WORLD_LOCATIONS['monastery_aldric']) travelToLocation(WORLD_LOCATIONS['monastery_aldric']); else runScene('monastery_arrival'); } },
      ]
    };
  },

};


// ─── HOOK INTO GAME INIT ─────────────────────
function startPersonalQuestHook() {
  const char = gameState.character;
  if (!char?.origin) return;

  const sceneMap = {
    fallen_noble:     'pq_fallen_noble_hook',
    orphan_war:       'pq_war_orphan_hook',
    cursed_bloodline: 'pq_cursed_blood_hook',
    divine_chosen:    'pq_divine_chosen_hook',
    exile:            'pq_exile_hook',
    monster_hunter:   'pq_hunter_hook',
    corrupted_saint:  'pq_saint_hook',
    blood_debt:       'pq_blood_debt_hook',
  };

  const sceneId = sceneMap[char.origin];
  if (!sceneId) return;
  if (getFlag(sceneId + '_seen')) return;

  setTimeout(() => {
    if (document.getElementById('scene-panel')) {
      setTimeout(() => runScene(sceneId), 30000);
    } else {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
      addLog(`🔖 A memory surfaces — something from ${char.name}'s past is here in Vaelthar.`, 'hell');
      runScene(sceneId);
    }
  }, 90000);
}

// Mark personal quests as completed when payoff flags are set
function checkPersonalQuestCompletion() {
  const char = gameState.character;
  if (!char?.personalQuests) return;
  const payoffFlags = {
    fallen_noble:     'pq_noble_payoff_seen',
    orphan_war:       'pq_orphan_payoff_seen',
    cursed_bloodline: 'pq_curse_payoff_seen',
    divine_chosen:    'pq_divine_payoff_seen',
    exile:            'pq_exile_payoff_seen',
    monster_hunter:   'pq_hunter_payoff_seen',
    corrupted_saint:  'pq_saint_payoff_seen',
    blood_debt:       'pq_debt_payoff_seen',
  };
  const flag = payoffFlags[char.origin];
  if (flag && getFlag(flag) && char.personalQuests[0]?.status === 'active') {
    char.personalQuests[0].status = 'completed';
    addLog(`📜 PERSONAL QUEST COMPLETE: "${char.personalQuests[0].title}"`, 'holy');
    grantHolyPoints(5);
  }
}
// Run completion check whenever a scene closes
const _origExecuteForPQ = window.executeSceneOption;
window.executeSceneOption = function(index) {
  if (_origExecuteForPQ) _origExecuteForPQ(index);
  setTimeout(checkPersonalQuestCompletion, 500);
};

function startStoryEngine() {
  setTimeout(() => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    runScene('arrival_vaelthar');
  }, 2000);
  // Trigger personal quest hook after opening scene
  startPersonalQuestHook();
}

// Patch initGameScreen to start the story engine — but only for solo
// In multiplayer, story starts when host fires start_game
const _origInitForStory = window.initGameScreen;
window.initGameScreen = function() {
  if (_origInitForStory) _origInitForStory();
  // Solo: start immediately. MP: wait for host's start_game signal
  if (!window.mp?.sessionCode) {
    startStoryEngine();
  }
  // MP story start is triggered by launchGame → server start_game event
};

// ─── SCENE CSS ───────────────────────────────
const sceneCSS = `
.scene-panel {
  margin: 4px 0 8px 0;
  animation: sceneFadeIn 0.3s ease;
  width: 100%;
}
@keyframes sceneFadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
.sp-inner {
  background: linear-gradient(160deg, rgba(14,9,4,0.98) 0%, rgba(8,5,2,1) 100%);
  border: 1px solid rgba(201,168,76,0.25);
  border-left: 3px solid var(--gold);
}
.sp-location-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 14px;
  background: rgba(201,168,76,0.06);
  border-bottom: 1px solid rgba(201,168,76,0.12);
  flex-wrap: wrap;
}
.sp-loc-icon { font-size:0.9rem; }
.sp-loc-name { font-family:'Cinzel',serif; font-size:0.72rem; color:var(--gold); letter-spacing:0.1em; flex:1; }
.sp-threat { font-family:'Cinzel',serif; font-size:0.62rem; color:var(--hell); letter-spacing:0.08em; }
.sp-vote-status { font-family:'Cinzel',serif; font-size:0.62rem; color:var(--text-dim); margin-left:auto; }
.sp-narration {
  padding: 12px 16px 6px 16px;
  font-family:'IM Fell English','Palatino',serif;
  font-size:0.87rem; line-height:1.6; color:var(--text-primary);
}
.sp-sub {
  display: block; margin-top: 8px;
  font-size:0.78rem; color:var(--gold); font-style:italic; opacity:0.85;
}
.sp-options {
  display: flex; flex-direction: column; gap: 3px;
  padding: 6px 12px 8px 12px;
}
.scene-option {
  display: flex; align-items: center; gap: 8px;
  background: rgba(15,10,5,0.9);
  border: 1px solid rgba(201,168,76,0.1);
  color: var(--text-secondary);
  font-family:'Cinzel',serif; font-size:0.7rem;
  padding: 8px 12px; cursor: pointer;
  letter-spacing:0.03em; text-align:left;
  transition: all 0.15s; width: 100%;
}
.scene-option:hover { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,0.05); transform:translateX(2px); }
.scene-option.my-vote { border-color:var(--gold); background:rgba(201,168,76,0.12); color:var(--gold); }
.scene-option.winning { border-color:#4a9a6a; background:rgba(74,154,100,0.08); color:#8bc87a; }
.scene-option.combat { border-color:rgba(192,57,43,0.2); }
.scene-option.combat:hover { border-color:var(--hell); color:var(--hell-glow); }
.scene-option.move { border-color:rgba(74,120,154,0.2); }
.so-icon { font-size:0.85rem; flex-shrink:0; }
.so-text { flex:1; }
.so-roll { font-size:0.65rem; color:var(--hell-glow); white-space:nowrap; opacity:0.8; }
.so-cost { font-size:0.65rem; color:var(--text-dim); white-space:nowrap; }
.so-votes { display:flex; gap:2px; align-items:center; flex-shrink:0; font-size:0.68rem; }
.vote-pip { opacity:0.85; }
.vote-count { font-size:0.62rem; color:var(--gold); font-family:'Cinzel',serif; margin-left:2px; }
.sp-free-action { padding:3px 14px 8px; }
.sp-free-hint { font-size:0.65rem; color:var(--text-dim); font-style:italic; }

/* Fullscreen button */
#fullscreen-btn {
  position: fixed; bottom: 14px; right: 14px; z-index: 9000;
  background: rgba(8,5,2,0.92); border: 1px solid rgba(201,168,76,0.3);
  color: var(--gold); font-size: 0.7rem; font-family:'Cinzel',serif;
  padding: 6px 10px; cursor: pointer; letter-spacing:0.08em;
  transition: all 0.15s;
}
#fullscreen-btn:hover { background: rgba(201,168,76,0.12); border-color:var(--gold); }
`;
const sceneStyle = document.createElement('style');
sceneStyle.id = 'scene-styles';
sceneStyle.textContent = sceneCSS;
document.head.appendChild(sceneStyle);

// ─── FULLSCREEN BUTTON ────────────────────────
(function addFullscreenButton() {
  const btn = document.createElement('button');
  btn.id = 'fullscreen-btn';
  btn.title = 'Toggle Fullscreen';
  btn.textContent = '⛶ FULLSCREEN';
  btn.onclick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      btn.textContent = '✕ EXIT FULL';
    } else {
      document.exitFullscreen();
      btn.textContent = '⛶ FULLSCREEN';
    }
  };
  document.addEventListener('fullscreenchange', () => {
    btn.textContent = document.fullscreenElement ? '✕ EXIT FULL' : '⛶ FULLSCREEN';
  });
  // Add after game screen is ready
  setTimeout(() => document.body.appendChild(btn), 500);
})();

console.log('🎭 Story engine loaded. Scenes will guide the player through Vaelthar.');
window.receiveVote = receiveVote;
