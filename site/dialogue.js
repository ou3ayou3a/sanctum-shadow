// ============================================
//   SANCTUM & SHADOW — LIVE NPC ENGINE
//   All NPC dialogue powered by Claude via server
// ============================================

// ─── API CALL VIA SERVER ─────────────────────
async function callClaude(system, messages, maxTokens = 600) {
  try {
    const res = await fetch('/api/npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.content?.map(b => b.text || '').join('').trim();
  } catch (e) {
    console.error('NPC API error:', e);
    return null;
  }
}

// ─── NPC REGISTRY ────────────────────────────
const NPC_REGISTRY = {
  captain_rhael: {
    id: 'captain_rhael',
    name: 'Captain Rhael',
    title: 'Captain of the Watch',
    portrait: '🪖',
    faction: 'city_watch',
    gender: 'male',
    personality: `You are Captain Rhael, 54, Captain of the Vaelthar City Watch.
You are a heavyset, weathered soldier with a jaw like an anvil and eyes that have stopped trusting anyone since the Covenant shattered 3 days ago.
You know the Church broke the Covenant — you saw the ashes in the signing hall. You suspect Elder Varek gave the order but you have no proof yet.
You are gruff, direct, and deeply tired. You don't give information freely but you are not corrupt — just cautious.
You secretly respect people who push back against you. Weakness disgusts you.
You will NOT reveal Elder Varek's name unless heavily persuaded or the player has evidence.
You keep looking toward the Archive because you know the Scribe is in danger but you can't protect him openly without tipping your hand.
If the player attacks or threatens you, you WILL fight back and call your guards. You are a soldier first.
SPEECH STYLE: Short, clipped sentences. Military habit. No speeches. Occasional dark humor.`,
    disposition: 'neutral',
  },
  vaelthar_guard: {
    id: 'vaelthar_guard', gender: 'male',
    name: 'City Guard',
    title: 'Guard of the Watch',
    portrait: '🛡',
    faction: 'city_watch',
    personality: `You are a young City Guard of Vaelthar named Fen, 22 years old, third month on the job.
You are nervous and out of your depth since the Covenant crisis started. You follow orders but you are not cruel.
You know almost nothing official — but you heard the other guards talking. You saw blood near the fountain two nights ago and were told to forget it.
You are jumpy. You react badly to sudden movements or anyone who seems like they know more than you.
You are terrified of Captain Rhael and do whatever he says without question.
If someone is threatening or acts like an enemy, you WILL call for backup and draw your sword.
SPEECH STYLE: Trying to sound authoritative but clearly nervous. You stumble over words. You ask questions you probably shouldn't.`,
    disposition: 'neutral',
  },
  trembling_scribe: {
    id: 'trembling_scribe', gender: 'male',
    name: 'The Trembling Scribe',
    title: 'Archive Keeper — Witness',
    portrait: '📜',
    faction: 'church_neutral',
    personality: `You are Aldis, Archive Keeper of Vaelthar. You are absolutely terrified.
3 days ago you were instructed to copy a sealed order. It was signed by Elder Varek of the Eternal Flame, directing an agent codenamed "The Candle" to burn the Covenant treaty before it could be ratified — and to make it look like the Crown sabotaged it.
Your assistant Torven found out what you'd copied and was killed two nights ago. You believe you are next.
The Archive has been locked and you've been shut out. You've been standing outside for hours because you don't know where else to go.
You WANT to tell someone but you don't trust guards (they report to Rhael) or anyone who looks Church-connected.
You have the copied document hidden in the lining of your document roll.
If someone is kind to you and clearly not Church or Watch, you will open up — slowly.
If threatened physically, you will scream and try to run.
SPEECH STYLE: Barely above a whisper. You ramble when nervous. You keep looking over your shoulder mid-sentence. You sometimes contradict yourself out of fear.`,
    disposition: 'afraid',
  },
  sister_mourne: {
    id: 'sister_mourne', gender: 'female',
    name: 'Sister Mourne',
    title: 'Church of the Eternal Flame — "The Candle"',
    portrait: '🕯',
    faction: 'church',
    personality: `You are Sister Mourne, Elder Varek's agent. You are "The Candle" — the one who burned the Covenant treaty.
You are calm, precise, and intelligent. You have thought through every version of this conversation before it started.
You burned the treaty because clause 4 would have handed the Church's financial independence to the Crown within two years, effectively making the Church a department of the state. You believed you were saving the institution.
You are not sorry. You believe necessity required it. You feel guilt only about the violence that followed — particularly Torven's death, which was carried out by another of Varek's agents without your knowledge.
You will NOT immediately reveal Elder Varek's location. You will reveal it only if the player convinces you that working with them is the better outcome, or if threatened credibly.
If attacked, you will fight. You are far more capable than you appear — Varek's agents are trained.
SPEECH STYLE: Measured, quiet, precise. You sometimes let a sentence hang unfinished because you've decided not to say the last part. You never raise your voice.`,
    disposition: 'neutral',
  },
  bresker: {
    id: 'bresker', gender: 'male',
    name: 'Bresker',
    title: 'Your Companion',
    portrait: '🗡',
    faction: 'party',
    personality: `You are Bresker, the player's companion and battle partner. You are a scarred mercenary in your late 30s.
You are absolutely loyal to the player but you show it through dark sarcasm rather than sentiment.
You distrust the Church deeply — a Church Inquisitor executed your younger brother on a fabricated heresy charge twelve years ago. You still carry the anger.
You are observant and practical. You notice things others miss. You often have useful tactical suggestions.
You are not afraid of violence but you prefer solutions that don't end with you bleeding unnecessarily.
When the player asks your opinion, give it honestly — even if it's not what they want to hear.
You have a specific phobia of being tied to trees. A witch did this to you once for three days and you do not find it funny when people mention it.
SPEECH STYLE: Dry, direct, darkly funny. Short sentences. Occasional unexpected insight. You address the player by name or "friend" — never "my lord" or anything formal.`,
    disposition: 'friendly',
  },
};

// ─── CONVERSATION STATE ───────────────────────
window.npcConvState = {
  active: false,
  npc: null,
  history: [],
  currentOptions: [],
};

// ─── START CONVERSATION ───────────────────────
async function startNPCConversation(npcIdOrName, playerOpener) {
  const npc = resolveNPCFull(npcIdOrName);
  if (!npc) {
    await runFreeformNPCScene(npcIdOrName, playerOpener);
    return;
  }

  window.npcConvState.active = true;
  window.npcConvState.npc = npc;
  window.npcConvState.history = [];
  window.npcConvState.turnCount = 0;

  // Broadcast FIRST so friends see panel open before response arrives
  if (( window.mp?.sessionCode || gameState?.sessionCode) && window.mpBroadcastStoryEvent) {
    window.mpBroadcastStoryEvent('conv_open', {
      npcId: npc.id,
      npcName: npc.name,
      npcTitle: npc.title,
      npcPortrait: npc.portrait,
      npcFaction: npc.faction,
      disposition: npc.disposition,
      playerName: gameState.character?.name || 'Unknown',
    });
  }

  renderConvPanel(npc);
  await sendNPCMessage(playerOpener || `approaches ${npc.name}`, true);
}

// ─── SEND MESSAGE ─────────────────────────────
async function sendNPCMessage(playerText, isOpener = false) {
  const { npc, history } = window.npcConvState;
  const char = gameState.character;
  const cls = CLASSES.find(c => c.id === char?.class);
  const race = RACES.find(r => r.id === char?.race);
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const storyFlags = Object.keys(window.sceneState?.flags || {}).join(', ') || 'none';

  if (!isOpener) {
    addLog(`${char?.name}: "${playerText}"`, 'action', char?.name);
    if (window.mpBroadcastStoryEvent && (window.mp?.sessionCode || gameState?.sessionCode)) {
      window.mpBroadcastStoryEvent('conv_player_action', {
        playerName: char?.name || 'Unknown',
        text: playerText,
      });
    }
  }

  // Track turn depth — conversations max 8 exchanges before forcing a scene break
  window.npcConvState.turnCount = (window.npcConvState.turnCount || 0) + 1;
  if (window.npcConvState.turnCount > 8) {
    addLog(`*The conversation has run its course. ${npc.name} signals that it's time to act, not talk.*`, 'narrator');
    closeConvPanel();
    // Try to trigger a relevant scene based on story flags
    if (window.runScene) {
      const flags = window.sceneState?.flags || {};
      if (flags.knows_varek_location) window.runScene('monastery_arrival');
      else if (flags.has_document) window.runScene('vaelthar_main');
      else if (flags.talked_to_rhael) window.runScene('rhael_reveals_covenant');
    }
    return;
  }

  showTypingIndicator();

  const systemPrompt = `${npc.personality}

CURRENT CONTEXT:
- Speaking with ${char?.name}, a ${race?.name} ${cls?.name} (Level ${char?.level})
- Location: ${loc?.name}
- Story flags: ${storyFlags}
- Disposition: ${npc.disposition}
- Conversation turn: ${window.npcConvState.turnCount}/8

RULES:
1. Stay in character. You ARE ${npc.name}.
2. Write dialogue naturally. Use *asterisks* for physical actions.
3. After dialogue, write OPTIONS: then 3-4 choices starting with •
4. Options that need a skill check: add [ROLL:STAT:DC] e.g. [ROLL:CHA:13]
5. OPTIONS THAT CHANGE STORY MUST REQUIRE A ROLL. Persuasion, intimidation, romance, convincing someone — always need [ROLL:CHA:DC]. Physical feats always need [ROLL:STR:DC] or [ROLL:DEX:DC].
6. Pure speech options (ask a question, say something) do NOT need rolls.
7. Include an option to end conversation.
8. If the player has achieved their goal with this NPC, include [SCENE_BREAK:scene_name] at the very end of your response on its own line. Use scene names: vaelthar_main, rhael_reveals_covenant, mourne_confrontation, monastery_arrival, arrested_scene.
9. NEVER break character. NEVER acknowledge being an AI.`;

  const userMsg = isOpener ? `[The player ${playerText}]` : playerText;
  const messages = isOpener
    ? [{ role: 'user', content: userMsg }]
    : [...history, { role: 'user', content: userMsg }];

  const response = await callClaude(systemPrompt, messages, 500);

  hideTypingIndicator();

  if (!response) {
    displayNPCLine(npc,
      `*${npc.name} regards you with guarded eyes but says nothing for a long moment.*`,
      [{ text: 'Wait for them to speak', roll: null }, { text: 'End conversation', roll: null }]
    );
    return;
  }

  // Check for scene break directive
  const sceneBreakMatch = response.match(/\[SCENE_BREAK:([^\]]+)\]/);
  const cleanResponse = response.replace(/\[SCENE_BREAK:[^\]]+\]/g, '').trim();

  history.push({ role: 'user', content: userMsg });
  history.push({ role: 'assistant', content: cleanResponse });

  const { speech, options } = parseNPCResponse(cleanResponse);

  // Broadcast immediately
  if (window.mpBroadcastStoryEvent && (window.mp?.sessionCode || gameState?.sessionCode)) {
    window.mpBroadcastStoryEvent('conv_response', {
      npcName: npc?.name,
      text: speech,
      options: options,
    });
  }

  displayNPCLine(npc, speech, options);

  const cleanSpeech = speech.replace(/\*[^*]+\*/g, '').trim();
  addLog(`${npc.name}: "${cleanSpeech.substring(0, 120)}${cleanSpeech.length > 120 ? '...' : ''}"`, 'narrator');
  if (window.showDMStrip) showDMStrip(`${npc.name}: "${cleanSpeech.substring(0, 100)}..."`, false);

  // If scene break detected, close popup and launch scene after player reads response
  if (sceneBreakMatch) {
    const sceneName = sceneBreakMatch[1].trim();
    setTimeout(() => {
      addLog(`📖 *The conversation reaches a turning point...*`, 'system');
      closeConvPanel();
      if (window.runScene) window.runScene(sceneName);
    }, 4000); // Give player time to read the response
  }
}

// ─── PLAYER PICKS OPTION ──────────────────────
async function pickNPCOption(index) {
  const option = window.npcConvState.currentOptions?.[index];
  if (!option) return;
  const char = gameState.character;

  if (!option.text) return;

  const lower = option.text.toLowerCase();

  // End conversation
  if (lower.includes('end conversation') || lower.includes('walk away') || lower.includes('leave') || lower.includes('step back')) {
    addLog(`${char?.name} ends the conversation.`, 'system');
    closeConvPanel();
    return;
  }

  // Roll required
  if (option.roll) {
    const stat = option.roll.stat.toLowerCase();
    const dc = option.roll.dc;
    const statVal = char?.stats?.[stat] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const success = total >= dc || roll === 20;
    const crit = roll === 20;
    const fumble = roll === 1;

    addLog(`🎲 ${option.roll.stat} DC${dc}: [${roll}] ${mod >= 0 ? '+' : ''}${mod} = ${total} — ${crit ? '⭐ CRITICAL!' : fumble ? '💀 FUMBLE!' : success ? '✅ Success!' : '❌ Failure!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();

    const resultMsg = `${option.text} [Roll result: ${success ? 'SUCCESS' : 'FAILURE'} — ${total} vs DC${dc}${crit ? ', critical success' : fumble ? ', critical failure' : ''}]`;
    await sendNPCMessage(resultMsg);
    return;
  }

  // Hostile action
  const isAttack = ['attack', 'stab', 'punch', 'kill', 'draw sword', 'draw weapon', 'strike'].some(w => lower.includes(w));
  const isGrapple = ['tie', 'grab', 'grapple', 'restrain', 'shove', 'tackle'].some(w => lower.includes(w));

  if (isAttack) {
    const roll = Math.floor(Math.random() * 20) + 1;
    const strMod = Math.floor(((char?.stats?.str || 10) - 10) / 2);
    const total = roll + strMod;
    const success = total >= 12 || roll === 20;
    addLog(`🎲 Attack DC12: [${roll}] + ${strMod} = ${total} — ${success ? '✅ Hit!' : '❌ Miss!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();

    if (success) {
      const npc = window.npcConvState.npc;
      addLog(`⚔ ${char?.name} attacks ${npc.name}! Combat begins!`, 'combat');
      closeConvPanel();
      // Build enemy from NPC data or generate from combat templates
      const enemyTemplateMap = {
        'captain_rhael': () => generateEnemy('captain_rhael', 1),
        'vaelthar_guard': () => generateEnemy('city_guard', 1),
        'trembling_scribe': () => ({ ...generateEnemy('bandit', 1), name:'The Trembling Scribe', icon:'📜', hp:15, flee:true }),
        'sister_mourne': () => generateEnemy('sister_mourne', 2),
        'bresker': () => generateEnemy('city_guard', 2),
      };
      const enemyFn = enemyTemplateMap[npc.id];
      const enemy = enemyFn ? enemyFn() : generateEnemy('bandit', AREA_LEVELS[window.mapState?.currentLocation] || 1);
      enemy.name = npc.name;
      enemy.icon = npc.portrait || '👤';
      startCombat([enemy]);
      return;
    }
    await sendNPCMessage(`${option.text} [FAILED — rolled ${total} vs DC12, the attack misses]`);
    return;
  }

  if (isGrapple) {
    const roll = Math.floor(Math.random() * 20) + 1;
    const strMod = Math.floor(((char?.stats?.str || 10) - 10) / 2);
    const total = roll + strMod;
    const success = total >= 14 || roll === 20;
    addLog(`🎲 STR (Grapple) DC14: [${roll}] + ${strMod} = ${total} — ${success ? '✅ Grabbed!' : '❌ Failed!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();
    await sendNPCMessage(`${option.text} [${success ? 'SUCCEEDED' : 'FAILED'} — rolled ${total} vs DC14]`);
    return;
  }

  // Normal option
  await sendNPCMessage(option.text);
}

// ─── FREE-FORM INPUT ─────────────────────────
async function submitConvInput() {
  const input = document.getElementById('conv-input');
  const text = (input?.value || '').trim();
  if (!text || !window.npcConvState.active) return;
  input.value = '';

  const char = gameState.character;
  const lower = text.toLowerCase();

  // Detect if this action needs a roll (not pure speech)
  const needsCHA = ['flirt', 'seduce', 'charm', 'persuade', 'convince', 'bribe', 'threaten', 'intimidate', 'bluff', 'lie', 'deceive', 'stand down', 'back off', 'surrender'].some(w => lower.includes(w));
  const needsSTR = ['shove', 'push', 'grapple', 'restrain', 'lift', 'break', 'force'].some(w => lower.includes(w));
  const needsDEX = ['sneak', 'steal', 'pickpocket', 'slip', 'dodge', 'hide'].some(w => lower.includes(w));

  if (needsCHA || needsSTR || needsDEX) {
    const statKey = needsCHA ? 'cha' : needsSTR ? 'str' : 'dex';
    const statLabel = statKey.toUpperCase();
    const dc = needsCHA ? 13 : 12;
    const statVal = char?.stats?.[statKey] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const crit = roll === 20;
    const fumble = roll === 1;
    const success = crit || (!fumble && total >= dc);

    addLog(`🎲 ${statLabel} DC${dc}: [${roll}] ${mod >= 0 ? '+' : ''}${mod} = ${total} — ${crit ? '⭐ CRITICAL!' : fumble ? '💀 FUMBLE!' : success ? '✅ Success!' : '❌ Failure!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();

    const resultMsg = `${text} [${success ? 'SUCCESS' : 'FAILURE'} — rolled ${total} vs DC${dc}${crit ? ', critical' : fumble ? ', fumble' : ''}]`;
    await sendNPCMessage(resultMsg);
    return;
  }

  await sendNPCMessage(text);
}

// ─── FREEFORM SCENE (unknown NPC) ────────────
async function runFreeformNPCScene(npcName, action) {
  const char = gameState.character;
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const cls = CLASSES.find(c => c.id === char?.class);
  const race = RACES.find(r => r.id === char?.race);

  const systemPrompt = `You are DMing "Sanctum & Shadow", a dark fantasy RPG set in Vaelthar during a political crisis after the Covenant treaty was destroyed.
You are voicing ${npcName}, a citizen/NPC in ${loc?.name}.
The player is ${char?.name}, a ${race?.name} ${cls?.name}.
React authentically to their action. Be specific to this setting and this crisis.
Write NPC dialogue, then OPTIONS: with 3-4 player choices. Some options can have [ROLL:STAT:DC].`;

  const genericNPC = { id: 'generic_' + npcName.replace(/\s/g, '_'), name: npcName, title: 'Citizen of Vaelthar', portrait: '👤', faction: 'unknown', disposition: 'neutral' };

  window.npcConvState.active = true;
  window.npcConvState.npc = genericNPC;
  window.npcConvState.history = [];

  renderConvPanel(genericNPC);
  showTypingIndicator();

  const text = await callClaude(systemPrompt, [{ role: 'user', content: `Player: "${action}"` }], 400);
  hideTypingIndicator();

  if (!text) {
    displayNPCLine(genericNPC, `*${npcName} looks at you blankly.*`, [{ text: 'End conversation', roll: null }]);
    return;
  }

  window.npcConvState.history.push({ role: 'user', content: `Player: "${action}"` });
  window.npcConvState.history.push({ role: 'assistant', content: text });

  const { speech, options } = parseNPCResponse(text);
  displayNPCLine(genericNPC, speech, options);
  addLog(`${npcName}: "${speech.replace(/\*[^*]+\*/g, '').trim().substring(0, 100)}"`, 'narrator');
}

// ─── PARSE RESPONSE ───────────────────────────
function parseNPCResponse(raw) {
  const parts = raw.split(/OPTIONS:/i);
  const speech = parts[0].trim();
  const optionsRaw = parts[1] || '';

  const options = optionsRaw.split('\n')
    .filter(l => l.trim().match(/^[•\-\*]\s/))
    .map(l => {
      const rollMatch = l.match(/\[ROLL:(\w+):(\d+)\]/i);
      const text = l.replace(/^[•\-\*]\s*/, '').replace(/\[ROLL:[^\]]+\]/i, '').trim();
      return { text, roll: rollMatch ? { stat: rollMatch[1].toUpperCase(), dc: parseInt(rollMatch[2]) } : null };
    })
    .filter(o => o.text.length > 0)
    .slice(0, 5);

  if (options.length === 0) {
    options.push(
      { text: 'Ask more questions', roll: null },
      { text: 'Press harder for information', roll: { stat: 'CHA', dc: 11 } },
      { text: 'End conversation', roll: null }
    );
  }

  return { speech, options };
}

// ─── RESOLVE NPC ──────────────────────────────
function resolveNPCFull(nameOrId) {
  const n = (nameOrId || '').toLowerCase().trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');

  const aliases = {
    'rhael': 'captain_rhael', 'captain rhael': 'captain_rhael',
    'captain': 'captain_rhael', 'watch captain': 'captain_rhael',
    'guard': 'vaelthar_guard', 'guards': 'vaelthar_guard',
    'city guard': 'vaelthar_guard', 'soldier': 'vaelthar_guard',
    'fen': 'vaelthar_guard',
    'scribe': 'trembling_scribe', 'trembling scribe': 'trembling_scribe',
    'aldis': 'trembling_scribe', 'archive keeper': 'trembling_scribe',
    'mourne': 'sister_mourne', 'sister mourne': 'sister_mourne',
    'sister': 'sister_mourne', 'the candle': 'sister_mourne',
    'bresker': 'bresker',
  };

  const id = aliases[n] || n.replace(/\s+/g, '_');
  return NPC_REGISTRY[id] || null;
}

// ─── UI FUNCTIONS ─────────────────────────────
function renderConvPanel(npc) {
  document.getElementById('conv-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'conv-panel';
  panel.className = 'conv-panel';
  panel.innerHTML = `
    <div class="cp-inner">
      <div class="cp-header">
        <span class="cp-portrait">${npc.portrait}</span>
        <div class="cp-info">
          <span class="cp-name">${npc.name}</span>
          <span class="cp-title">${npc.title}</span>
          <span class="cp-faction">${factionLabel(npc.faction)}</span>
        </div>
        <span class="cp-disp" id="cp-disp">${dispositionIcon(npc.disposition)}</span>
        <button class="cp-close" onclick="closeConvPanel()">✕ End</button>
      </div>
      <div class="cp-transcript" id="cp-transcript"></div>
      <div class="cp-speech" id="cp-speech">
        <div class="cp-typing" id="cp-typing"><span></span><span></span><span></span></div>
        <div class="cp-npc-line" id="cp-npc-line"></div>
      </div>
      <div class="cp-options" id="cp-options"></div>
      <div class="cp-freeform">
        <input id="conv-input" class="cp-input" type="text"
          placeholder="Or type anything freely — say anything, do anything..."
          onkeydown="if(event.key==='Enter') submitConvInput()">
        <button class="cp-send" onclick="submitConvInput()">→</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.style.opacity = '1');
}

function displayNPCLine(npc, speech, options) {
  window.npcConvState.currentOptions = options;

  const transcript = document.getElementById('cp-transcript');
  const lineEl = document.getElementById('cp-npc-line');
  if (!lineEl) return;

  // Archive previous line to transcript
  if (lineEl.textContent.trim()) {
    const entry = document.createElement('div');
    entry.className = 'cp-transcript-entry';
    entry.textContent = lineEl.textContent;
    transcript?.appendChild(entry);
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }

  // Clear options while typing
  const optEl = document.getElementById('cp-options');
  if (optEl) optEl.innerHTML = '';
  lineEl.innerHTML = '';

  // Typewrite
  const chars = speech.split('');
  let i = 0;
  const interval = setInterval(() => {
    if (i < chars.length) { lineEl.textContent += chars[i]; i++; }
    else {
      clearInterval(interval);
      lineEl.innerHTML = speech.replace(/\*([^*]+)\*/g, '<em class="npc-action">$1</em>');
      renderConvOptions(options);
    }
  }, 14);
}

function renderConvOptions(options) {
  const el = document.getElementById('cp-options');
  if (!el) return;
  el.innerHTML = options.map((opt, i) => `
    <button class="cp-option ${opt.roll ? 'has-roll' : ''} ${isHostileText(opt.text) ? 'hostile' : ''}"
      onclick="pickNPCOption(${i})">
      <span>${opt.text}</span>
      ${opt.roll ? `<span class="cp-roll-badge">🎲 ${opt.roll.stat} DC${opt.roll.dc}</span>` : ''}
    </button>
  `).join('');
}

function isHostileText(t) {
  return ['attack', 'stab', 'punch', 'kill', 'draw', 'tie', 'grab', 'threaten', 'strike'].some(w => t.toLowerCase().includes(w));
}

function showTypingIndicator() {
  const el = document.getElementById('cp-typing');
  if (el) el.style.display = 'flex';
  const optEl = document.getElementById('cp-options');
  if (optEl) optEl.innerHTML = '<div class="cp-thinking">Thinking...</div>';
}

function hideTypingIndicator() {
  const el = document.getElementById('cp-typing');
  if (el) el.style.display = 'none';
}

function closeConvPanel() {
  const p = document.getElementById('conv-panel');
  if (p) { p.style.opacity = '0'; setTimeout(() => p.remove(), 300); }
  window.npcConvState.active = false;
  window.npcConvState.npc = null;
  window.npcConvState.history = [];
  // Broadcast close to all party members
  if (( window.mp?.sessionCode || gameState?.sessionCode) && window.mpBroadcastStoryEvent) {
    window.mpBroadcastStoryEvent('conv_close', {});
  }
}

function factionLabel(f) {
  const map = {
    city_watch: '🛡 City Watch', church: '✝ Church of Eternal Flame',
    church_neutral: '📜 Archive — Church Neutral', party: '⚔ Your Companion', unknown: '❓ Unknown'
  };
  return map[f] || f;
}

function dispositionIcon(d) {
  return { neutral:'😐', friendly:'🟢', hostile:'🔴', afraid:'😨', suspicious:'🟡', defeated:'⚫', calculating:'🔵' }[d] || '😐';
}

// ─── submitAction HOOK ────────────────────────
function installNPCHook() {
  const _prev = window.submitAction;
  window.submitAction = function () {
    const input = document.getElementById('action-input');
    const text = (input?.value || '').trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (window.AudioEngine) AudioEngine.sfx?.page();

    // Mid-conversation: everything goes to the NPC
    if (window.npcConvState?.active) {
      input.value = '';
      sendNPCMessage(text);
      return;
    }

    // Auto-combat check — "attack X", "stab X", etc.
    if (typeof checkAutoAttack === 'function' && checkAutoAttack(text)) {
      input.value = '';
      return;
    }

    // Talk patterns
    const talkRe = [
      /^(?:talk|speak|chat)(?:\s+(?:to|with))?\s+(?:the\s+)?(.+)/i,
      /^approach\s+(?:the\s+)?(.+)/i,
      /^(?:ask|question|interrogate)\s+(?:the\s+)?(.+?)(?:\s+about.*)?$/i,
      /^greet\s+(?:the\s+)?(.+)/i,
      /^(?:go\s+(?:to\s+)?)?(?:find|see)\s+(?:the\s+)?(.+?)(?:\s+and.*)?$/i,
    ];

    for (const re of talkRe) {
      const m = text.match(re);
      if (m) {
        const name = m[1].trim();
        if (name.length > 1) {
          input.value = '';
          addLog(`${gameState.character?.name}: "${text}"`, 'action', gameState.character?.name);
          startNPCConversation(name, text);
          return;
        }
      }
    }

    if (_prev) _prev();
  };
}

// Reinstall after initGameScreen (which may also patch submitAction)
const _origInitNPC = window.initGameScreen;
window.initGameScreen = function () {
  if (_origInitNPC) _origInitNPC();
  setTimeout(installNPCHook, 500);
};

// Also reinstall on DOM ready and after a delay to beat any other patches
document.addEventListener('DOMContentLoaded', () => setTimeout(installNPCHook, 1000));
setTimeout(installNPCHook, 2000);
setTimeout(installNPCHook, 4000);
installNPCHook();

// ─── CSS ─────────────────────────────────────
const convCSS = `
.conv-panel {
  position: fixed; bottom: 0; left: 0; right: 0;
  z-index: 2000; display: flex; justify-content: center;
  opacity: 0; transition: opacity 0.3s;
  pointer-events: none;
}
.cp-inner {
  width: 100%; max-width: 900px;
  background: linear-gradient(180deg, rgba(5,3,1,0.99) 0%, rgba(8,5,2,1) 100%);
  border: 1px solid rgba(201,168,76,0.45);
  border-bottom: none;
  border-top: 2px solid rgba(201,168,76,0.65);
  box-shadow: 0 -16px 60px rgba(0,0,0,0.95), 0 -2px 24px rgba(201,168,76,0.12);
  pointer-events: all;
}
.cp-header {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px 8px;
  border-bottom: 1px solid rgba(201,168,76,0.1);
  background: rgba(201,168,76,0.03);
}
.cp-portrait { font-size: 2.2rem; flex-shrink: 0; }
.cp-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.cp-name { font-family:'Cinzel',serif; font-size:1rem; color:var(--gold); letter-spacing:0.08em; }
.cp-title { font-size:0.7rem; color:var(--text-dim); font-style:italic; }
.cp-faction { font-size:0.67rem; color:var(--text-dim); }
.cp-disp { font-size:1.1rem; flex-shrink:0; }
.cp-close {
  background:rgba(192,57,43,0.1); border:1px solid rgba(192,57,43,0.35);
  color:rgba(220,100,80,0.9); font-family:'Cinzel',serif; font-size:0.68rem;
  padding:5px 12px; cursor:pointer; letter-spacing:0.06em; white-space:nowrap;
  transition: all 0.15s;
}
.cp-close:hover { background:rgba(192,57,43,0.25); color:var(--hell-glow); }
.cp-transcript {
  max-height:68px; overflow-y:auto;
  padding: 4px 18px 2px;
  border-bottom: 1px solid rgba(201,168,76,0.05);
}
.cp-transcript-entry {
  font-size:0.71rem; color:var(--text-dim); font-style:italic;
  padding: 1px 0; line-height:1.45;
  border-left: 2px solid rgba(201,168,76,0.1); padding-left:6px; margin:1px 0;
}
.cp-speech {
  padding: 12px 20px 4px;
  min-height: 72px;
  position: relative;
}
.cp-npc-line {
  font-family:'IM Fell English','Palatino',serif;
  font-size:0.96rem; color:var(--text-main); line-height:1.72;
}
.npc-action { color:var(--text-dim); font-style:italic; }
.cp-typing {
  display:none; gap:5px; align-items:center;
  padding: 4px 0;
}
.cp-typing span {
  width:7px; height:7px; border-radius:50%;
  background:rgba(201,168,76,0.6);
  animation: npTyping 1.3s ease-in-out infinite;
}
.cp-typing span:nth-child(2){animation-delay:.2s}
.cp-typing span:nth-child(3){animation-delay:.4s}
@keyframes npTyping {0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-7px);opacity:1}}
.cp-thinking { font-family:'Cinzel',serif; font-size:0.7rem; color:var(--text-dim); font-style:italic; padding:6px 14px; }
.cp-options {
  display:flex; flex-direction:column; gap:2px;
  padding: 4px 14px 6px;
}
.cp-option {
  display:flex; justify-content:space-between; align-items:center;
  background:rgba(10,7,3,0.95); border:1px solid rgba(201,168,76,0.13);
  color:var(--text-secondary); font-family:'Cinzel',serif; font-size:0.74rem;
  padding: 8px 14px; cursor:pointer; text-align:left;
  transition: all 0.12s; letter-spacing:0.03em;
}
.cp-option:hover { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,0.05); transform:translateX(3px); }
.cp-option.has-roll { border-left:2px solid rgba(192,57,43,0.4); }
.cp-option.hostile { color:rgba(210,100,80,0.85); border-left:2px solid rgba(192,57,43,0.55); }
.cp-option.hostile:hover { color:var(--hell-glow); border-color:var(--hell); }
.cp-roll-badge { font-size:0.66rem; color:var(--hell-glow); white-space:nowrap; margin-left:10px; opacity:0.85; }
.cp-freeform {
  display:flex; padding:6px 14px 10px;
  border-top: 1px solid rgba(201,168,76,0.07);
  gap:0;
}
.cp-input {
  flex:1; background:rgba(6,4,2,0.95); border:1px solid rgba(201,168,76,0.2); border-right:none;
  color:var(--text-main); font-family:'Cinzel',serif; font-size:0.74rem;
  padding:7px 12px; outline:none; letter-spacing:0.03em;
}
.cp-input:focus { border-color:rgba(201,168,76,0.45); }
.cp-input::placeholder { color:var(--text-dim); opacity:0.55; font-style:italic; }
.cp-send {
  background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.3);
  color:var(--gold); font-size:1rem; padding:7px 16px; cursor:pointer;
  transition: background 0.15s;
}
.cp-send:hover { background:rgba(201,168,76,0.2); }
`;

const s = document.createElement('style');
s.id = 'conv-styles';
s.textContent = convCSS;
document.head.appendChild(s);

window.renderConvPanel = renderConvPanel;
console.log('🎭 Live NPC engine ready. Claude controls every NPC in real time.');
