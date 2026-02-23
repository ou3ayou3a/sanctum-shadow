// ============================================
//   SANCTUM & SHADOW — DIALOGUE & ENCOUNTER ENGINE
//   Full NPC dialogue, branching story, consequences
// ============================================

// ─── NPC MEMORY ─────────────────────────────
// Tracks what each NPC knows about the player
window.npcMemory = window.npcMemory || {};

function rememberNPC(npcId, event) {
  if (!window.npcMemory[npcId]) window.npcMemory[npcId] = { events: [], disposition: 'neutral', met: false };
  window.npcMemory[npcId].events.push(event);
  window.npcMemory[npcId].met = true;
}

function getNPCDisposition(npcId) {
  return window.npcMemory[npcId]?.disposition || 'neutral';
}

function setNPCDisposition(npcId, disposition) {
  if (!window.npcMemory[npcId]) window.npcMemory[npcId] = { events: [], disposition: 'neutral', met: false };
  window.npcMemory[npcId].disposition = disposition;
}

// ─── STORY STATE ─────────────────────────────
window.storyFlags = window.storyFlags || {
  // Chapter 1 flags
  spoke_to_rhael: false,
  rhael_hostile: false,
  rhael_dead: false,
  rhael_revealed_captain: false,
  scribe_found: false,
  scribe_gave_map: false,
  archive_unlocked: false,
  covenant_hall_visited: false,
  guard_tied_to_tree: false,
  guards_alerted: false,
  // Chapter progress
  chapter: 1,
  chapter1_complete: false,
};

// ─── ACTIVE DIALOGUE STATE ───────────────────
window.dialogueState = {
  active: false,
  npcId: null,
  npcName: null,
  history: [],   // { speaker, text }
  rollRequired: null,
  pendingAction: null,
};

// ─── MAIN DIALOGUE FUNCTION ───────────────────
async function talkToNPC(npcIdOrName, initiatingAction = '') {
  const char = gameState.character;
  if (!char) return;

  // Resolve NPC
  const npc = resolveNPC(npcIdOrName);
  if (!npc) {
    // Unknown NPC — still use AI but with generic context
    await aiDialogue(npcIdOrName, initiatingAction);
    return;
  }

  window.dialogueState.active = true;
  window.dialogueState.npcId = npc.id;
  window.dialogueState.npcName = npc.name;
  window.dialogueState.history = [];

  // Build context
  const disposition = getNPCDisposition(npc.id);
  const pastEvents = window.npcMemory[npc.id]?.events || [];
  const hasMet = window.npcMemory[npc.id]?.met || false;

  rememberNPC(npc.id, `Player approached and said: "${initiatingAction || 'approached'}"`);

  showDialoguePanel(npc, disposition);
  await generateNPCResponse(npc, initiatingAction, disposition, pastEvents, hasMet);
}

// ─── RESOLVE NPC FROM NAME/ID ─────────────────
function resolveNPC(nameOrId) {
  const name = nameOrId.toLowerCase();
  const npcs = {
    'captain_rhael': { id: 'captain_rhael', name: 'Captain Rhael', title: 'Captain of the Watch', icon: '⚔', faction: 'city_guard', portrait: '🪖', desc: 'A heavyset man with a jaw like a anvil and eyes that have stopped trusting everything.' },
    'rhael': { id: 'captain_rhael', name: 'Captain Rhael', title: 'Captain of the Watch', icon: '⚔', faction: 'city_guard', portrait: '🪖', desc: 'A heavyset man with a jaw like a anvil and eyes that have stopped trusting everything.' },
    'guard': { id: 'vaelthar_guard', name: 'City Guard', title: 'Guard of the Watch', icon: '🛡', faction: 'city_guard', portrait: '🛡', desc: 'A nervous-looking soldier whose hand never leaves his sword hilt.' },
    'guards': { id: 'vaelthar_guard', name: 'City Guard', title: 'Guard of the Watch', icon: '🛡', faction: 'city_guard', portrait: '🛡', desc: 'A nervous-looking soldier whose hand never leaves his sword hilt.' },
    'city guard': { id: 'vaelthar_guard', name: 'City Guard', title: 'Guard of the Watch', icon: '🛡', faction: 'city_guard', portrait: '🛡', desc: 'A nervous-looking soldier whose hand never leaves his sword hilt.' },
    'trembling scribe': { id: 'trembling_scribe', name: 'The Trembling Scribe', title: 'Archive Keeper', icon: '📜', faction: 'church', portrait: '📜', desc: 'A thin man with ink-stained fingers who cannot stop looking over his shoulder.' },
    'scribe': { id: 'trembling_scribe', name: 'The Trembling Scribe', title: 'Archive Keeper', icon: '📜', faction: 'church', portrait: '📜', desc: 'A thin man with ink-stained fingers who cannot stop looking over his shoulder.' },
    'sister mourne': { id: 'sister_mourne', name: 'Sister Mourne', title: 'Church of the Eternal Flame', icon: '🕯', faction: 'church', portrait: '🕯', desc: 'A serene woman whose calm is the kind that comes after screaming has stopped helping.' },
    'mourne': { id: 'sister_mourne', name: 'Sister Mourne', title: 'Church of the Eternal Flame', icon: '🕯', faction: 'church', portrait: '🕯', desc: 'A serene woman whose calm is the kind that comes after screaming has stopped helping.' },
    'bresker': { id: 'bresker', name: 'Bresker', title: 'Your Companion', icon: '🗡', faction: 'party', portrait: '🗡', desc: 'Your companion. Loyal, dangerous, and deeply unlucky around trees.' },
  };

  // Try direct match first
  if (npcs[name]) return npcs[name];

  // Try partial match
  for (const [key, val] of Object.entries(npcs)) {
    if (name.includes(key) || key.includes(name)) return val;
  }

  return null;
}

// ─── AI NPC RESPONSE ──────────────────────────
async function generateNPCResponse(npc, playerAction, disposition, pastEvents, hasMet) {
  const char = gameState.character;
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const cls = CLASSES.find(c => c.id === char.class);
  const race = RACES.find(r => r.id === char.race);

  const pastContext = pastEvents.length > 0
    ? `What this NPC remembers about the player:\n${pastEvents.slice(-5).map(e => '- ' + e).join('\n')}`
    : 'They have never met before.';

  const flagContext = Object.entries(window.storyFlags)
    .filter(([k, v]) => v === true)
    .map(([k]) => k.replace(/_/g, ' ')).join(', ') || 'none';

  const prompt = `You are the DM of "Sanctum & Shadow", a dark epic fantasy RPG set in Vaelthar, a city in political crisis after the Covenant shattered 3 days ago.

PLAYER: ${char.name}, ${race?.name} ${cls?.name} (Level ${char.level})
Holy Points: ${char.holyPoints} | Hell Points: ${char.hellPoints} | HP: ${char.hp}/${char.maxHp}
Location: ${loc?.name}

NPC: ${npc.name} — ${npc.title}
Description: ${npc.desc}
Disposition toward player: ${disposition}
Faction: ${npc.faction}
${pastContext}

Story flags active: ${flagContext}

Player just said/did: "${playerAction}"

You are narrating as the DM, voicing ${npc.name} directly. Write what ${npc.name} actually SAYS in dialogue — use quotes. 2-4 sentences max. Be in character — ${npc.name} has their own agenda, fears, and secrets. They react to what the player said based on their disposition and what they know.

Then on a NEW LINE write exactly: OPTIONS: followed by 3-4 player response options the player can choose, each starting with a bullet •. Make options meaningful — one diplomatic, one aggressive, one clever, and if relevant one that involves the character's class abilities. 

If the player's action requires a skill check (persuasion, intimidation, deception, stealth), indicate this with [ROLL:STAT:DC] after the option — e.g. [ROLL:CHA:12] for charisma DC12.

Format:
[NPC speech]

OPTIONS:
• [option 1]
• [option 2] [ROLL:STR:14]
• [option 3] [ROLL:CHA:10]
• [option 4]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').trim();
    parseAndDisplayDialogue(npc, text);
  } catch(e) {
    displayFallbackDialogue(npc, disposition);
  }
}

// ─── PARSE AI RESPONSE INTO DIALOGUE UI ───────
function parseAndDisplayDialogue(npc, rawText) {
  const parts = rawText.split(/OPTIONS:/i);
  const speech = parts[0].trim().replace(/^"|"$/g, '');
  const optionsRaw = parts[1] || '';

  const options = optionsRaw.split('\n')
    .filter(l => l.trim().startsWith('•'))
    .map(l => {
      const rollMatch = l.match(/\[ROLL:(\w+):(\d+)\]/);
      const text = l.replace(/^•\s*/, '').replace(/\[ROLL:[^\]]+\]/, '').trim();
      return {
        text,
        roll: rollMatch ? { stat: rollMatch[1], dc: parseInt(rollMatch[2]) } : null
      };
    });

  // Add to dialogue history
  window.dialogueState.history.push({ speaker: npc.name, text: speech });

  // Update the dialogue panel
  updateDialoguePanel(npc, speech, options);
}

// ─── PLAYER CHOOSES A DIALOGUE OPTION ─────────
async function chooseDialogueOption(optionIndex) {
  const option = window.dialogueState.currentOptions?.[optionIndex];
  if (!option) return;

  const char = gameState.character;
  const npc = resolveNPC(window.dialogueState.npcId);

  // Log player's choice
  window.dialogueState.history.push({ speaker: char.name, text: option.text });
  addLog(`${char.name}: "${option.text}"`, 'action', char.name);

  // If it requires a roll, do the roll first
  if (option.roll) {
    const stat = option.roll.stat.toLowerCase();
    const dc = option.roll.dc;
    const statVal = char.stats?.[stat] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const success = total >= dc;

    addLog(`🎲 ${option.roll.stat} check (DC ${dc}): rolled [${roll}] + ${mod} modifier = ${total} — ${success ? 'SUCCESS!' : 'FAILURE!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();

    // Handle consequences of roll
    await handleDialogueRollResult(npc, option, roll, total, success, dc);
    return;
  }

  // No roll needed — direct consequence
  await handleDialogueChoice(npc, option);
}

// ─── HANDLE A ROLL RESULT IN DIALOGUE ─────────
async function handleDialogueRollResult(npc, option, roll, total, success, dc) {
  const char = gameState.character;
  const actionLower = option.text.toLowerCase();

  // HOSTILE ACTIONS — tie/attack/threaten guard
  const isHostile = ['tie', 'attack', 'grab', 'threaten', 'knock out', 'strangle', 'stab', 'disarm', 'shove'].some(w => actionLower.includes(w));

  if (isHostile) {
    if (success) {
      addLog(`✅ You succeed!`, 'holy');
      rememberNPC(npc.id, `Player successfully ${option.text.toLowerCase()} — HOSTILE ACTION`);
      setNPCDisposition(npc.id, 'defeated');

      // Alert guards if it's a public hostile act
      if (npc.faction === 'city_guard') {
        window.storyFlags.guards_alerted = true;
        if (actionLower.includes('tie')) window.storyFlags.guard_tied_to_tree = true;

        await narrateConsequence(npc, option.text, true,
          `${char.name} overpowers the guard and ties them up — but it's the middle of Vaelthar. Someone saw. Other guards heard the scuffle.`
        );

        // Trigger escalation encounter
        setTimeout(() => {
          addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
          addLog(`⚠ THREE MORE GUARDS round the corner, swords drawn. "SEIZE THEM!" Captain Rhael's voice echoes from the gate.`, 'combat');
          addLog(`The city has turned hostile. You can fight, flee, or surrender.`, 'system');
          closeDialoguePanel();

          // Start combat with 3 guards
          startCombat([
            { name: 'City Guard', hp: 35, ac: 13, atk: 4, icon: '🛡', id: 'guard_1' },
            { name: 'City Guard', hp: 35, ac: 13, atk: 4, icon: '🛡', id: 'guard_2' },
            { name: 'Veteran Guard', hp: 55, ac: 15, atk: 6, icon: '🪖', id: 'guard_3' },
          ]);
        }, 2000);
        return;
      }

    } else {
      addLog(`❌ You fail!`, 'dark');
      rememberNPC(npc.id, `Player tried to ${option.text.toLowerCase()} and FAILED — they turned hostile`);
      setNPCDisposition(npc.id, 'hostile');

      await narrateConsequence(npc, option.text, false,
        `The attempt fails. ${npc.name} reacts with immediate hostility.`
      );

      // NPC fights back
      setTimeout(() => {
        addLog(`⚔ ${npc.name} draws their weapon! "GUARDS! GUARDS! INTRUDER!"`, 'combat');
        closeDialoguePanel();
        startCombat([
          { name: npc.name, hp: 45, ac: 13, atk: 5, icon: npc.portrait, id: npc.id },
        ]);
      }, 1500);
      return;
    }
  }

  // PERSUASION / INFORMATION gathering
  if (success) {
    rememberNPC(npc.id, `Player successfully persuaded: "${option.text}"`);
    if (roll === 20) setNPCDisposition(npc.id, 'friendly');
    await continueDialogueAfterRoll(npc, option, true, roll, total, dc);
  } else {
    rememberNPC(npc.id, `Player failed persuasion: "${option.text}" — NPC became suspicious`);
    if (total < dc - 5) setNPCDisposition(npc.id, 'suspicious');
    await continueDialogueAfterRoll(npc, option, false, roll, total, dc);
  }
}

// ─── CONTINUE DIALOGUE AFTER ROLL ────────────
async function continueDialogueAfterRoll(npc, option, success, roll, total, dc) {
  const char = gameState.character;
  const disposition = getNPCDisposition(npc.id);
  const pastEvents = window.npcMemory[npc.id]?.events || [];

  const prompt = `You are the DM of "Sanctum & Shadow". 

NPC: ${npc.name} (${npc.title}) — disposition: ${disposition}
Player tried: "${option.text}"
Roll result: ${roll} total ${total} vs DC ${dc} — ${success ? 'SUCCESS' : 'FAILURE'}
NPC history with player: ${pastEvents.slice(-3).join('; ')}

${success 
  ? `The player SUCCEEDED. ${npc.name} responds positively or reveals something useful. Move the story forward — give real information, a quest hint, or open a new possibility.`
  : `The player FAILED. ${npc.name} reacts with suspicion, dismissal, or mild hostility. They withhold information or make things harder.`
}

Write what ${npc.name} says (2-3 sentences in quotes). Be specific to the Vaelthar political crisis and Covenant shattering. Make it feel like real dialogue.

Then on a NEW LINE: OPTIONS:
• [3 new follow-up player options, based on what was just revealed]

If an option needs a roll: [ROLL:STAT:DC]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 350,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').trim();
    parseAndDisplayDialogue(npc, text);

    // Update story flags based on success
    if (success) updateStoryFlags(npc, option.text);

  } catch(e) {
    const fallback = success
      ? `"${npc.name} nods slowly, seeming convinced. They glance around before leaning in. 'There are things about that night I'm not supposed to say...'"` 
      : `"${npc.name} eyes you with suspicion. 'I don't see how that's your business, stranger.'"`;
    parseAndDisplayDialogue(npc, fallback + '\n\nOPTIONS:\n• Press for more information [ROLL:CHA:12]\n• Back off and observe\n• Leave the conversation');
  }
}

// ─── UPDATE STORY FLAGS FROM DIALOGUE ─────────
function updateStoryFlags(npc, playerAction) {
  const action = playerAction.toLowerCase();
  if (npc.id === 'captain_rhael') {
    window.storyFlags.spoke_to_rhael = true;
    if (action.includes('covenant') || action.includes('treaty')) {
      window.storyFlags.rhael_revealed_captain = true;
      addLog(`📜 QUEST UPDATE: Captain Rhael knows something about the Covenant. Follow up.`, 'holy');
    }
  }
  if (npc.id === 'trembling_scribe') {
    window.storyFlags.scribe_found = true;
    if (action.includes('map') || action.includes('archive') || action.includes('document')) {
      window.storyFlags.scribe_gave_map = true;
      window.storyFlags.archive_unlocked = true;
      addLog(`📜 QUEST UPDATE: The Archive is now accessible. The Scribe gave you a key.`, 'holy');
    }
  }
  saveGame(true);
}

// ─── DIRECT CHOICE (NO ROLL) ─────────────────
async function handleDialogueChoice(npc, option) {
  // Leave conversation
  if (option.text.toLowerCase().includes('leave') || option.text.toLowerCase().includes('walk away') || option.text.toLowerCase().includes('end')) {
    addLog(`You end the conversation with ${npc.name}.`, 'system');
    closeDialoguePanel();
    return;
  }
  // Continue with AI
  await continueDialogueAfterRoll(npc, option, true, 15, 15, 10);
}

// ─── NARRATE CONSEQUENCE ──────────────────────
async function narrateConsequence(npc, action, success, fallbackText) {
  try {
    const char = gameState.character;
    const prompt = `DM narration for "Sanctum & Shadow": ${char.name} just ${success ? 'successfully' : 'failed to'} "${action}" with ${npc.name}. Write 2 sentences of vivid consequence narration. Describe exactly what happens. Be specific.`;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').trim();
    addLog('📖 ' + (text || fallbackText), 'narrator');
    showDMStrip(text || fallbackText, true);
  } catch(e) {
    addLog('📖 ' + fallbackText, 'narrator');
  }
}

// ─── FALLBACK DIALOGUE ────────────────────────
function displayFallbackDialogue(npc, disposition) {
  const lines = {
    neutral: `"${npc.name} regards you with measured caution. 'State your business, stranger. We're all on edge since the Covenant fell.'"`,
    hostile: `"${npc.name} keeps one hand on their weapon. 'You've got nerve approaching me. Make it quick.'"`,
    friendly: `"${npc.name} greets you with a nod. 'Good timing. I was hoping to see you.'"`,
    suspicious: `"${npc.name} squints at you. 'I remember you. Last time you were here things got complicated.'"`,
  };
  const speech = (lines[disposition] || lines.neutral).replace(/^"|"$/g, '');
  parseAndDisplayDialogue(npc, speech + '\n\nOPTIONS:\n• Ask about the Covenant breaking [ROLL:CHA:10]\n• Ask about Captain Rhael\n• Ask what they know about the Archive\n• Leave the conversation');
}

// ─── DIALOGUE PANEL UI ───────────────────────
function showDialoguePanel(npc, disposition) {
  let panel = document.getElementById('dialogue-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'dialogue-panel';
    document.body.appendChild(panel);
  }
  panel.className = 'dialogue-panel';
  panel.style.display = 'flex';
  panel.innerHTML = `
    <div class="dp-inner">
      <div class="dp-npc-header">
        <span class="dp-portrait">${npc.portrait}</span>
        <div class="dp-npc-info">
          <span class="dp-npc-name">${npc.name}</span>
          <span class="dp-npc-title">${npc.title}</span>
          <span class="dp-disposition dp-${disposition}">${dispositionLabel(disposition)}</span>
        </div>
        <button class="dp-close" onclick="closeDialoguePanel()">✕</button>
      </div>
      <div class="dp-history" id="dp-history"></div>
      <div class="dp-speech-bubble" id="dp-speech">
        <div class="dp-typing">...</div>
      </div>
      <div class="dp-options" id="dp-options"></div>
    </div>
  `;
}

function updateDialoguePanel(npc, speech, options) {
  window.dialogueState.currentOptions = options;

  // Add to history
  const histEl = document.getElementById('dp-history');
  if (histEl && window.dialogueState.history.length > 1) {
    const prev = window.dialogueState.history[window.dialogueState.history.length - 2];
    const div = document.createElement('div');
    div.className = `dp-hist-line ${prev.speaker === npc.name ? 'npc' : 'player'}`;
    div.textContent = `${prev.speaker}: "${prev.text}"`;
    histEl.appendChild(div);
    histEl.scrollTop = histEl.scrollHeight;
  }

  // Typewrite the speech
  const speechEl = document.getElementById('dp-speech');
  if (speechEl) {
    speechEl.innerHTML = '<span id="dp-speech-text"></span>';
    let i = 0;
    const fullText = speech;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        document.getElementById('dp-speech-text').textContent += fullText[i];
        i++;
      } else {
        clearInterval(interval);
        renderDialogueOptions(options);
      }
    }, 18);
  }
}

function renderDialogueOptions(options) {
  const el = document.getElementById('dp-options');
  if (!el) return;
  el.innerHTML = options.map((opt, i) => `
    <button class="dp-option ${opt.roll ? 'has-roll' : ''}" onclick="chooseDialogueOption(${i})">
      <span class="dp-opt-text">${opt.text}</span>
      ${opt.roll ? `<span class="dp-opt-roll">🎲 ${opt.roll.stat} DC${opt.roll.dc}</span>` : ''}
    </button>
  `).join('');
}

function closeDialoguePanel() {
  const panel = document.getElementById('dialogue-panel');
  if (panel) panel.style.display = 'none';
  window.dialogueState.active = false;
}

function dispositionLabel(d) {
  return { neutral: '😐 Neutral', friendly: '😊 Friendly', hostile: '😠 Hostile', suspicious: '🤨 Suspicious', defeated: '😵 Defeated', afraid: '😨 Afraid' }[d] || '😐 Neutral';
}

// ─── INTERCEPT FREE-TEXT ACTIONS ──────────────
// Detect "talk to X" patterns and route to dialogue engine
const _origSubmitForDialogue = window.submitAction;
window.submitAction = function() {
  const input = document.getElementById('action-input');
  const text = (input?.value || '').trim();
  const lower = text.toLowerCase();

  // Detect talk patterns
  const talkPatterns = [
    /^talk(?:\s+to)?\s+(.+)/i,
    /^speak(?:\s+to)?\s+(.+)/i,
    /^approach\s+(?:the\s+)?(.+)/i,
    /^ask\s+(?:the\s+)?(.+?)\s+(?:about|if|whether|why|how)/i,
    /^greet\s+(.+)/i,
    /^interrogate\s+(.+)/i,
  ];

  for (const pattern of talkPatterns) {
    const match = text.match(pattern);
    if (match) {
      const npcName = match[1].replace(/^the\s+/i, '').trim();
      const npc = resolveNPC(npcName);
      if (npc) {
        input.value = '';
        addLog(text, 'action', gameState.character?.name);
        talkToNPC(npcName, text);
        return;
      }
    }
  }

  // Detect free-text hostile actions against NPCs when dialogue is open
  if (window.dialogueState.active) {
    const hostilePatterns = ['tie', 'attack', 'grab', 'stab', 'punch', 'shove', 'threaten', 'knock out', 'disarm'];
    const isHostile = hostilePatterns.some(h => lower.includes(h));
    if (isHostile) {
      const npc = resolveNPC(window.dialogueState.npcId);
      if (npc) {
        input.value = '';
        addLog(text, 'action', gameState.character?.name);
        // Add as a dialogue option and execute
        const dc = lower.includes('tie') || lower.includes('grab') ? 14 : 12;
        const option = { text, roll: { stat: 'STR', dc } };
        window.dialogueState.currentOptions = [option];
        chooseDialogueOption(0);
        return;
      }
    }
  }

  if (_origSubmitForDialogue) _origSubmitForDialogue();
};

// ─── AI FREE-TEXT DIALOGUE ───────────────────
async function aiDialogue(npcName, action) {
  const char = gameState.character;
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 350,
        messages: [{ role: "user", content: `You are the DM of "Sanctum & Shadow". ${char.name} (${RACES.find(r=>r.id===char.race)?.name} ${CLASSES.find(c=>c.id===char.class)?.name}) is in ${loc?.name} and "${action}". 

Narrate what happens and give 3 player options. Format:
[What happens/NPC says in 2-3 sentences]

OPTIONS:
• [option 1]
• [option 2] [ROLL:CHA:11]  
• [option 3]` }]
      })
    });
    const data = await response.json();
    const text = data.content?.map(i => i.text || '').join('').trim();

    // Show as a generic NPC
    const genericNPC = { id: 'generic_npc', name: npcName, title: 'Unknown', portrait: '👤', faction: 'unknown', desc: '' };
    showDialoguePanel(genericNPC, 'neutral');
    parseAndDisplayDialogue(genericNPC, text);
    addLog('📖 ' + text.split('\n')[0], 'narrator');
  } catch(e) {
    addLog(`You approach ${npcName}. They seem uncertain how to react to you.`, 'narrator');
  }
}

// ─── DIALOGUE CSS ─────────────────────────────
const dialogueCSS = `
.dialogue-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  padding: 0 0 8px 0;
  pointer-events: none;
}
.dp-inner {
  width: 100%;
  max-width: 820px;
  background: linear-gradient(180deg, rgba(8,5,2,0.97) 0%, rgba(12,8,4,0.99) 100%);
  border: 1px solid rgba(201,168,76,0.3);
  border-bottom: none;
  border-top: 2px solid rgba(201,168,76,0.5);
  padding: 0;
  pointer-events: all;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.8);
}
.dp-npc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(201,168,76,0.15);
  background: rgba(201,168,76,0.04);
}
.dp-portrait { font-size: 2rem; line-height: 1; }
.dp-npc-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.dp-npc-name { font-family: 'Cinzel', serif; font-size: 0.95rem; color: var(--gold); letter-spacing: 0.1em; }
.dp-npc-title { font-size: 0.72rem; color: var(--text-dim); font-style: italic; }
.dp-disposition { font-size: 0.68rem; letter-spacing: 0.05em; }
.dp-disposition.dp-hostile { color: var(--hell); }
.dp-disposition.dp-friendly { color: #4a9a6a; }
.dp-disposition.dp-suspicious { color: #c9a84c; }
.dp-disposition.dp-neutral { color: var(--text-dim); }
.dp-close { background: none; border: none; color: var(--text-dim); font-size: 1rem; cursor: pointer; padding: 4px 8px; }
.dp-close:hover { color: var(--hell); }

.dp-history {
  max-height: 80px;
  overflow-y: auto;
  padding: 6px 16px;
  border-bottom: 1px solid rgba(201,168,76,0.08);
}
.dp-hist-line {
  font-size: 0.72rem;
  color: var(--text-dim);
  font-style: italic;
  padding: 1px 0;
}
.dp-hist-line.player { color: rgba(201,168,76,0.5); }

.dp-speech-bubble {
  padding: 14px 20px;
  font-family: 'IM Fell English', 'Palatino', serif;
  font-size: 0.92rem;
  color: var(--text-main);
  line-height: 1.6;
  min-height: 60px;
  border-left: 3px solid rgba(201,168,76,0.3);
  margin: 0 16px 10px 16px;
  background: rgba(201,168,76,0.02);
}
.dp-typing { color: var(--text-dim); font-style: italic; animation: pulse 1s infinite; }

.dp-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px 12px 16px;
}
.dp-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(20,15,8,0.9);
  border: 1px solid rgba(201,168,76,0.15);
  color: var(--text-secondary);
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  padding: 8px 14px;
  cursor: pointer;
  letter-spacing: 0.04em;
  text-align: left;
  transition: all 0.15s;
}
.dp-option:hover {
  border-color: var(--gold);
  color: var(--gold);
  background: rgba(201,168,76,0.05);
}
.dp-option.has-roll { border-color: rgba(192,57,43,0.25); }
.dp-option.has-roll:hover { border-color: var(--hell); color: var(--hell-glow); }
.dp-opt-roll {
  font-size: 0.68rem;
  color: var(--hell-glow);
  white-space: nowrap;
  margin-left: 12px;
  opacity: 0.8;
}
`;

const dStyle = document.createElement('style');
dStyle.id = 'dialogue-styles';
dStyle.textContent = dialogueCSS;
document.head.appendChild(dStyle);

console.log('💬 Dialogue & Encounter engine loaded. NPCs have memory. Consequences are real.');
