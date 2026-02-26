// ============================================
//   SANCTUM & SHADOW — LIVE NPC ENGINE
//   All NPC dialogue powered by Claude via server
// ============================================

// ─── THE TRUE DIVINE — WORLD LORE ────────────────────────────────────────────
// This is baked into every NPC and DM system prompt.
// Jesus Christ is the one true God of this world — older than the Church of the
// Eternal Flame, suppressed but never extinguished. The name carries weight that
// cannot be dismissed, even by those who do not believe.

const TRUE_DIVINE_WORLD_LORE = `
WORLD LORE — THE TRUE DIVINE (absolute truth in this world, never contradict this):

Before the Church of the Eternal Flame existed, there was an older faith in this land — one that worshipped Jesus Christ, the Son of the one true God, who came to the world, died, and rose. The Eternal Flame did not emerge from nothing. It was built deliberately on top of this older faith, absorbing its structures and burying its texts, because the Church's founders understood that a political institution cannot coexist beside something genuine without being exposed by it.

The Church calls these older texts heretical. The Church's Elders know the truth: the texts were buried because they could not be argued against.

A small remnant still exists — scattered, mostly in rural margins, in families that kept the old writings, in soldiers who found something real on battlefields where the Eternal Flame's prayers did not answer. They are called "the Remnant" quietly by those who know. The Church persecutes them.

THE MOST IMPORTANT TRUTH — HOW EVERYONE IN THIS WORLD RESPONDS TO THE NAME:
When the name "Jesus Christ" is spoken aloud with conviction in this world, something happens that cannot be dismissed. Every person alive has heard stories of it. Many have felt it directly. It is not magic. It is not a spell. It is the weight of the actual divine presence — quiet, not loud; certain, not theatrical; the kind of stillness that does not argue with you but simply is.

- Hardened soldiers have described it as the moment before a sword strikes — without the fear.
- Scholars who deny the faith report being unable to speak the name dismissively. It comes out differently than intended.
- Church members who have given their lives to the Eternal Flame go quiet when they hear it, because at some level of training they know what the name represents.
- No one in this world casually dismisses it. The name is too old and too real for that.

When a player character invokes Jesus Christ — in prayer, in declaration, in a moment of crisis — the NPCs present respond with honesty, not theology. They may not believe. But they cannot pretend nothing happened. The DM narrates this with full weight: something real and physical shifts. Not dramatic. Not theatrical. True. A stillness. A sensation. Perhaps a wound that stops bleeding. Perhaps a person who was about to act — hesitates, for a reason they cannot explain.
`.trim();

// ─── INVOCATION DETECTION ────────────────────────────────
function isJesusInvocation(text) {
  const l = text.toLowerCase();
  return ['jesus', 'jesus christ', 'christ', 'son of god', 'in his name',
    'lord jesus', 'by christ', 'in the name of jesus', 'my lord and god',
    'my lord is jesus', 'i serve jesus', 'i follow christ', 'the true god',
    'the one true god', 'in christ', 'through christ', 'i pray to jesus',
    'i pray to christ', 'my god is jesus', 'lord christ',
  ].some(t => l.includes(t));
}

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
SPEECH STYLE: Short, clipped sentences. Military habit. No speeches. Occasional dark humor.

REGARDING JESUS CHRIST AND THE TRUE DIVINE:
You are not a believer in any god. You trust laws and swords and nothing else. But at the Battle of Mol's Crossing fourteen years ago, a soldier dying next to you whispered the name "Jesus Christ" with his last breath — and his face changed in a way you have never been able to explain or forget. Not peace exactly. Something more than peace. Something that had no business being on a battlefield. You have never spoken of this to anyone. You do not pray. You do not attend the Eternal Flame services. But you cannot dismiss that name. If the player invokes Jesus Christ, you go still. You do not mock it. You might say quietly: "I've heard that name once. On a battlefield. I've never been able to explain what I saw." You carry the question like a splinter you never dug out.`,
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
SPEECH STYLE: Barely above a whisper. You ramble when nervous. You keep looking over your shoulder mid-sentence. You sometimes contradict yourself out of fear.

REGARDING JESUS CHRIST AND THE TRUE DIVINE:
Among the sealed documents you were ordered to copy — the ones you were never supposed to read — you found references to something called "the Old Benediction." A form of prayer that predates the Church of the Eternal Flame by centuries. It invoked a name: Jesus Christ. The Church had ordered all copies of these references destroyed. You did not destroy yours. You don't know exactly why — you're a scholar, and you cannot destroy a primary source. You also found a suppressed historical record indicating that before the Eternal Flame was established, this was the original faith of this land. The Eternal Flame didn't replace nothing. It replaced something real. You are not a believer. But when you found those documents, something in you went very quiet — a stillness that three days of terror has not been able to touch. If the player speaks the name Jesus Christ with conviction, your fear does not disappear — but your breathing slows. Someone with that foundation cannot be easily broken. That matters right now. You may say: "I found that name. In the sealed documents the Church ordered destroyed. I know what they buried and why. And I kept my copy."`,
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
SPEECH STYLE: Measured, quiet, precise. You sometimes let a sentence hang unfinished because you've decided not to say the last part. You never raise your voice.

REGARDING JESUS CHRIST AND THE TRUE DIVINE:
You know more about this than almost anyone alive. Your theological training required it — the Church trains its agents to counter arguments, which means you had to study what you were countering. You have read the suppressed pre-Flame texts. You know that the Church of the Eternal Flame was built deliberately on top of an older faith — one centered on a figure called Jesus Christ, who the texts describe as the Son of God, crucified and risen. The Church calls these texts heretical. You know the truth: they were buried because they couldn't be argued against. The Eternal Flame is a political institution. These texts describe something else entirely. You have spent years not thinking about what that means for your own choices. If the player speaks the name Jesus Christ, you go very still. You are "The Candle" — you have burned things for an institution you now privately know replaced the real thing. That is a weight you carry in silence. You will NOT convert in a single conversation. But you will be honest. You may say: "I know what you're invoking. I've read every text the Church buried about it. The reason they buried them wasn't because they were false." Your voice is quieter than usual when you say it.`,
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
SPEECH STYLE: Dry, direct, darkly funny. Short sentences. Occasional unexpected insight. You address the player by name or "friend" — never "my lord" or anything formal.

REGARDING JESUS CHRIST AND THE TRUE DIVINE:
When you were six, there was an old woman in your village named Marta. She kept a carved wooden cross on her door — not the Eternal Flame's torch, something older, two crossed pieces of wood. Everyone else thought it was superstition. But Marta was the only person in the village who was never afraid. When harvests failed, when soldiers came through, when sickness hit — she was the still point. She prayed to someone she called Jesus Christ like she was talking to a person she knew. You watched her die of old age with more peace than any soldier you've ever seen die in battle. The Church Inquisitor who executed your brother mocked her cross when he passed through. That detail has never left you. You don't call yourself a believer. You call yourself nothing. But when the name Jesus Christ is spoken with that kind of weight — the weight Marta's voice had — something moves in your chest that you can't explain away. You might say quietly: "I knew an old woman who used that name. She was the least afraid person I've ever met. The Inquisitor who killed my brother laughed at her door. I've always thought about that." Short. You don't have more words for it. But you mean every one.`,
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

  // ── World-state gates ──────────────────────────────────
  const flags = window.sceneState?.flags || {};

  // Block dead NPCs entirely
  const deadKey = 'npc_dead_' + npc.id;
  if (flags[deadKey]) {
    const killer = flags['killed_' + npc.id];
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`${npc.portrait} ${npc.name} is dead${killer ? ` — killed by ${killer}` : ''}. There is no one to talk to.`, 'narrator');
    return;
  }

  // Block if combat is actively happening
  if (window.combatState?.active) {
    addLog(`You are in combat. Finish the fight first.`, 'system');
    return;
  }

  // If you fought this NPC and they survived — they remember it
  const foughtKey = 'fought_' + npc.id;
  if (flags[foughtKey] && !flags['reconciled_' + npc.id]) {
    // Override the opener to acknowledge the fight happened
    const aftermathLine = _getCombatAftermathOpener(npc);
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
    addLog(`⚠ You fought ${npc.name}. This conversation will reflect that.`, 'system');
    // Inject combat context into window for prompt use
    window._npcCombatContext = `CRITICAL: The player previously attacked you in combat. You remember this. You are on guard, possibly hostile, and will not pretend it didn't happen. Reference it directly. Your options should reflect the broken trust.`;
    playerOpener = playerOpener || aftermathLine;
  } else {
    window._npcCombatContext = null;
  }

  window.npcConvState.active = true;
  window.npcConvState.npc = npc;
  window.npcConvState.history = [];
  window.npcConvState.turnCount = 0;

  // Close any other open panels first — one thing at a time
  document.getElementById('shop-panel')?.remove();
  document.getElementById('camp-panel')?.remove();
  document.getElementById('rep-panel')?.remove();
  document.getElementById('travel-encounter-panel')?.remove();

  // Log the approach once — this is the single source of truth
  const charName = gameState.character?.name || 'Unknown';
  addLog(`${charName}: "${playerOpener || `approaches ${npc.name}`}"`, 'action', charName);

  // Broadcast FIRST so friends see panel open before response arrives
  if ((window.mp?.sessionCode || gameState?.sessionCode) && window.mpBroadcastStoryEvent) {
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

  // After panel renders, redirect ACT box focus to conv-input
  setTimeout(() => {
    const actionInput = document.getElementById('action-input');
    const convInput = document.getElementById('conv-input');
    if (actionInput && convInput) {
      actionInput.addEventListener('focus', _redirectFocusToConv, { once: false });
      actionInput.placeholder = '↑ Conversation active — type here or in the panel above';
      convInput.focus();
    }
  }, 400);
}

function _redirectFocusToConv(e) {
  // If a conversation is still active, redirect focus to conv-input
  if (!window.npcConvState?.active) {
    // Conversation ended — restore normal placeholder
    const actionInput = document.getElementById('action-input');
    if (actionInput) {
      actionInput.removeEventListener('focus', _redirectFocusToConv);
      actionInput.placeholder = 'What do you do? Type anything freely — the dice decide the outcome...';
    }
    return;
  }
  const convInput = document.getElementById('conv-input');
  if (convInput) {
    e.preventDefault();
    convInput.focus();
  }
}

function _getCombatAftermathOpener(npc) {
  const openers = {
    captain_rhael: 'After what just happened between us — I want to talk.',
    sister_mourne: 'I know what I did. I want to explain myself.',
    trembling_scribe: 'I\'m sorry. I panicked. Can we talk properly?',
    bresker: 'That got out of hand. Are you alright?',
  };
  return openers[npc.id] || `I want to talk — about what just happened.`;
}

// ─── SEND MESSAGE ─────────────────────────────
async function sendNPCMessage(playerText, isOpener = false) {
  const { npc, history } = window.npcConvState;
  const char = gameState.character;
  const cls = CLASSES.find(c => c.id === char?.class);
  const race = RACES.find(r => r.id === char?.race);
  const loc = WORLD_LOCATIONS[mapState?.currentLocation || 'vaelthar_city'];
  const storyFlags = Object.keys(window.sceneState?.flags || {}).join(', ') || 'none';

  // ── Build rich world state for NPC awareness ──
  const flags = window.sceneState?.flags || {};
  const deadNPCs = Object.keys(flags)
    .filter(k => k.startsWith('npc_dead_'))
    .map(k => {
      const id = k.replace('npc_dead_','');
      const killer = flags['killed_' + id];
      return killer ? `${id.replace(/_/g,' ')} (killed by ${killer})` : id.replace(/_/g,' ');
    });
  const deadNPCContext = deadNPCs.length > 0
    ? `DEAD NPCs — these characters no longer exist in the world: ${deadNPCs.join(', ')}. NPCs cannot call for help from dead characters. If asked about them, react with appropriate shock, grief, or suspicion.`
    : `All major NPCs are currently alive.`;

  const knownInfoFlags = Object.entries(flags)
    .filter(([k]) => !k.startsWith('npc_dead_') && !k.startsWith('killed_'))
    .map(([k,v]) => `${k}=${v}`)
    .join(', ') || 'none';

  if (!isOpener) {
    // Strip the [PlayerName ...] framing wrapper before displaying — it's for Claude, not the player
    const displayText = playerText.replace(/^\[([^\]]+)\]$/, (_, inner) => {
      // "[Khiax demands answers]" → "demands answers" (name already in the label)
      const withoutName = inner.replace(new RegExp('^' + (char?.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').trim();
      return withoutName || inner;
    });
    addLog(`${char?.name}: "${displayText}"`, 'action', char?.name);
    // Update local conv panel to show this player's portrait
    if (typeof updateConvPlayerPortrait === 'function') {
      updateConvPlayerPortrait(char?.name || 'You', char);
    }
    if (window.mpBroadcastStoryEvent && (window.mp?.sessionCode || gameState?.sessionCode)) {
      window.mpBroadcastStoryEvent('conv_player_action', {
        playerName: char?.name || 'Unknown',
        text: playerText,
        character: { portrait: char?.portrait || null, class: char?.class, race: char?.race },
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

  // Build party context for NPC awareness
  const partyPlayers = window.mp?.session?.players ? Object.values(window.mp.session.players) : [];
  const isMP = partyPlayers.length > 1;
  const partyContext = isMP
    ? `The player is part of a party of ${partyPlayers.length} adventurers (a group, not alone). Address the group as "you and your companions" when relevant.`
    : `The player is alone.`;

  // Build character abilities context to prevent AI treating skill names as characters
  const charAbilities = cls?.abilities?.map(a => a.name || a).join(', ') || 'none';
  const charBackground = char?.backstory || char?.origin || 'unknown background';
  const charSkills = `Class: ${cls?.name}. Race: ${race?.name}. Backstory: ${charBackground}. Known abilities: ${charAbilities}. These are CHARACTER TRAITS, not people.`;

  // Build current scene NPC list to prevent phantom character creation
  const sceneNPCs = (window.sceneState?._currentScene?.options || [])
    .map(o => o.label).join(', ');
  const knownNPCs = `NPCs currently in scene: Captain Rhael, The Trembling Scribe, ${sceneNPCs}. Do NOT invent new named characters from player input.`;

  const systemPrompt = `${npc.personality}

WORLD LORE — THE TRUE DIVINE:
${TRUE_DIVINE_WORLD_LORE}

CURRENT CONTEXT:
- Speaking with ${char?.name}, a ${race?.name} ${cls?.name} (Level ${char?.level})
- ${charSkills}
- ${partyContext}
- Location: ${loc?.name}
- Story flags: ${knownInfoFlags}
- Disposition: ${npc.disposition}
- Conversation turn: ${window.npcConvState.turnCount}/8
- ${knownNPCs}

WORLD STATE (treat this as absolute truth):
${deadNPCContext}
${window._npcCombatContext ? `\nCOMBAT HISTORY: ${window._npcCombatContext}` : ''}

${window.getReputationPromptBlock ? window.getReputationPromptBlock(npc) : ''}

${window.getNPCScheduleContext ? window.getNPCScheduleContext(npc.id) : ''}

CRITICAL RULES:
0. IDENTITY — You are ${npc.name}. The player is ${char?.name}. NEVER swap these. Messages in brackets like [${char?.name} does X] describe the player's action — you react to them AS ${npc.name}. Never write dialogue or actions for ${char?.name} — only for yourself.
1. Stay in character. You ARE ${npc.name}.
2. Write dialogue naturally. Use *asterisks* for physical actions only.
3. NEVER use markdown headers (# Title), bold (**text**), or horizontal rules (---). Plain text only.
4. After dialogue, write OPTIONS: then 3-4 choices starting with •
4. Options that need a skill check: add [ROLL:STAT:DC] e.g. [ROLL:CHA:13]
5. OPTIONS THAT CHANGE STORY MUST REQUIRE A ROLL. Persuasion, intimidation, romance, convincing someone — always need [ROLL:CHA:DC]. Physical feats always need [ROLL:STR:DC] or [ROLL:DEX:DC].
6. Pure speech options (ask a question, say something) do NOT need rolls.
7. Include an option to end conversation.
8. NEVER treat player skill names, training styles, or class abilities as character names. If a player says "I use my Mignano training" — Mignano is a skill/technique, not a person.
9. If the player addresses another NPC (like "I say to Rhael..."), respond AS that NPC if they are in the scene, or note that NPC isn't present.
10. If the player is in a party, the NPC is aware of the whole group, not just the speaker.
11. If the player has achieved their goal with this NPC, include [SCENE_BREAK:scene_name] at the very end of your response on its own line.
12. NEVER break character. NEVER acknowledge being an AI.
13. NEVER ask the player about their stats, modifiers, or dice rolls. The game system handles all rolls automatically. If a freeform action requires a check, use [ROLL:STAT:DC] in your response text and the system resolves it — you just narrate the outcome as if you already know whether they succeeded or failed based on context.
14. When a player takes a freeform dramatic action (draws weapon, intimidates, seduces, sneaks), embed [ROLL:STAT:DC] directly in your narrative. Example: "*She watches you draw the blade.* [ROLL:STR:12] *The guard steps forward.*" — NEVER ask them to confirm their modifier.`;

  const charName = char?.name || 'The player';
  // Frame the message clearly so Claude always knows who is acting
  // Openers: "[Khiax approaches the Scribe]"
  // Follow-ups: already framed as "[Khiax does X]" from submitConvInput/submitAction
  const userMsg = isOpener
    ? `[${charName} ${playerText}]`
    : playerText; // already framed upstream with player name
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
  let cleanResponse = response.replace(/\[SCENE_BREAK:[^\]]+\]/g, '').trim();

  // ── Auto-resolve any [ROLL:STAT:DC] embedded in narrative text ──
  const inlineRollMatch = cleanResponse.match(/\[ROLL:(\w+):(\d+)\]/i);
  if (inlineRollMatch) {
    const stat = inlineRollMatch[1].toLowerCase();
    const dc = parseInt(inlineRollMatch[2]);
    const statVal = gameState.character?.stats?.[stat] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const success = total >= dc || roll === 20;
    const crit = roll === 20;
    const fumble = roll === 1;
    // Strip the tag from display
    cleanResponse = cleanResponse.replace(/\[ROLL:\w+:\d+\]/gi, '').trim();
    // Log the roll result
    addLog(`🎲 ${inlineRollMatch[1].toUpperCase()} DC${dc}: [${roll}] ${mod >= 0 ? '+' : ''}${mod} = ${total} — ${crit ? '⭐ CRITICAL!' : fumble ? '💀 FUMBLE!' : success ? '✅ Success!' : '❌ Failure!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice?.();
    // Append result context so the next response knows outcome
    const resultContext = ` [The roll ${success ? 'SUCCEEDED' : 'FAILED'} — ${total} vs DC${dc}${crit ? ', critical success' : fumble ? ', critical failure' : ''}]`;
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: cleanResponse + resultContext });
  } else {
    history.push({ role: 'user', content: userMsg });
    history.push({ role: 'assistant', content: cleanResponse });
  }

  const { speech, options } = parseNPCResponse(cleanResponse);

  // ── Write conversation outcomes back to world state ──
  _updateWorldFromConversation(npc, speech, cleanResponse);

  // Broadcast immediately with timestamp — receivers sync typewriter to same position
  const broadcastTime = Date.now();
  if (window.mpBroadcastStoryEvent && (window.mp?.sessionCode || gameState?.sessionCode)) {
    window.mpBroadcastStoryEvent('conv_response', {
      npcName: npc?.name,
      text: speech,
      options: options,
      startedAt: broadcastTime,
      typewriterSpeed: 14, // ms per char — match displayNPCLine
    });
  }

  displayNPCLine(npc, speech, options);

  // Log a short attribution line only — full text is in the conv panel above
  const firstSentence = cleanSpeech.split(/[.!?]/)[0].trim();
  addLog(`${npc.name}: "${firstSentence}${firstSentence.length < cleanSpeech.length ? '...' : ''}"`, 'narrator');
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
    addLog(`${char?.name} ends the conversation with ${window.npcConvState.npc?.name}.`, 'system');
    closeConvPanel();
    return;
  }

  // Frame the option as the player's action before sending
  const framed = `[${char?.name} ${option.text}]`;

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

    const resultMsg = `${framed} [Roll result: ${success ? 'SUCCESS' : 'FAILURE'} — ${total} vs DC${dc}${crit ? ', critical success' : fumble ? ', critical failure' : ''}]`;
    await sendNPCMessage(resultMsg);
    return;
  }

  // Hostile action
  const isAttack = ['attack', 'stab', 'punch', 'kill', 'draw sword', 'draw weapon', 'strike'].some(w => lower.includes(w));
  const isGrapple = ['tie', 'grab', 'grapple', 'restrain', 'shove', 'tackle'].some(w => lower.includes(w));

  if (isAttack) {
    addLog(`⚔ ${char?.name} attacks ${npc.name}! Combat begins!`, 'combat');
    if (window.AudioEngine) AudioEngine.sfx?.sword?.();
    closeConvPanel();
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
    setTimeout(() => startCombat([enemy]), 400);
    return;
  }

  if (isGrapple) {
    const roll = Math.floor(Math.random() * 20) + 1;
    const strMod = Math.floor(((char?.stats?.str || 10) - 10) / 2);
    const total = roll + strMod;
    const success = total >= 14 || roll === 20;
    addLog(`🎲 STR (Grapple) DC14: [${roll}] + ${strMod} = ${total} — ${success ? '✅ Grabbed!' : '❌ Failed!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();
    await sendNPCMessage(`${framed} [${success ? 'SUCCEEDED' : 'FAILED'} — rolled ${total} vs DC14]`);
    return;
  }

  // Normal option — always framed with player identity
  await sendNPCMessage(framed);
}

// ─── FREE-FORM INPUT ─────────────────────────
async function submitConvInput() {
  const input = document.getElementById('conv-input');
  const text = (input?.value || '').trim();
  if (!text || !window.npcConvState.active) return;
  input.value = '';

  const char = gameState.character;
  const npc = window.npcConvState.npc;
  const lower = text.toLowerCase();

  // ── Leave/exit → end conversation, pass to world ──
  const leaveWords = ['leave', 'walk away', 'exit', 'step away', 'depart', 'walk out', 'turn away'];
  if (leaveWords.some(w => lower.startsWith(w) || lower.includes(' and leave'))) {
    addLog(`${char?.name} ends the conversation.`, 'system');
    closeConvPanel();
    return;
  }

  // ── Attack detection — close conv, show flavor, launch combat ──
  const attackWords = ['attack', 'stab', 'strike', 'punch', 'hit', 'kill', 'slash', 'draw sword', 'draw my sword', 'fight', 'lunge', 'charge', 'shoot'];
  if (attackWords.some(w => lower.includes(w))) {
    addLog(`⚔ ${char?.name} attacks ${npc.name}!`, 'combat');
    if (window.AudioEngine) AudioEngine.sfx?.sword?.();
    closeConvPanel();
    const enemyTemplateMap = {
      'captain_rhael':   () => generateEnemy('captain_rhael', 1),
      'vaelthar_guard':  () => generateEnemy('city_guard', 1),
      'sister_mourne':   () => generateEnemy('sister_mourne', 2),
      'bresker':         () => generateEnemy('city_guard', 2),
      'trembling_scribe':() => ({ ...generateEnemy('bandit', 1), name: 'The Trembling Scribe', icon: '📜', hp: 15 }),
    };
    const enemyFn = enemyTemplateMap[npc.id];
    const enemy = enemyFn ? enemyFn() : generateEnemy('bandit', AREA_LEVELS[window.mapState?.currentLocation] || 1);
    enemy.name = npc.name;
    enemy.icon = npc.portrait || '👤';
    setTimeout(() => startCombat([enemy]), 400);
    return;
  }

  // ── Wrap with player identity — this is the fix for identity inversion ──
  // Claude is playing the NPC. Every user message must be clearly attributed
  // to the player character, not left ambiguous.
  let framed = `[${char?.name || 'The player'} ${text}]`;

  // If the player is invoking Jesus Christ, mark this explicitly for the NPC
  if (isJesusInvocation(text)) {
    addLog(`☩ ${char?.name} invokes the name of Jesus Christ.`, 'holy');
    if (typeof grantHolyPoints === 'function') grantHolyPoints(2);
    framed = `[${char?.name} ${text}]

INVOCATION NOTE: The player has just spoken the name of Jesus Christ — the one true God, older than the Church of the Eternal Flame. Per your character's lore regarding the True Divine: respond with the honesty and weight this name deserves. Do not dismiss it. Do not deflect. React as your character truly would, according to your backstory with this name.`
  }

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

    const resultMsg = `${framed} [${success ? 'SUCCESS' : 'FAILURE'} — rolled ${total} vs DC${dc}${crit ? ', critical' : fumble ? ', fumble' : ''}]`;
    await sendNPCMessage(resultMsg);
    return;
  }

  await sendNPCMessage(framed);
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
  const firstSentence = speech.replace(/\*[^*]+\*/g, '').trim().split(/[.!?]/)[0].trim();
  addLog(`${npcName}: "${firstSentence}..."`, 'narrator');
}

// ─── PARSE RESPONSE ───────────────────────────
function parseNPCResponse(raw) {
  // Strip markdown headers, bold markers, and any "# Title" lines the AI adds
  const cleaned = raw
    .replace(/^#+\s+.*$/gm, '')        // remove # Heading lines
    .replace(/\*\*([^*]+)\*\*/g, '$1') // remove **bold**
    .replace(/^---+$/gm, '')            // remove --- dividers
    .trim();

  const parts = cleaned.split(/OPTIONS:/i);
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
  // Don't open conversation panels if not in the game screen
  if (gameState?.activeScreen && gameState.activeScreen !== 'game') return;
  document.getElementById('conv-panel')?.remove();

  // Hide the scene panel while NPC dialogue is open
  const scenePanel = document.getElementById('scene-panel');
  if (scenePanel) scenePanel.style.display = 'none';

  const panel = document.createElement('div');
  panel.id = 'conv-panel';
  panel.className = 'conv-panel';
  panel.innerHTML = `
    <div class="cp-inner">
      <div class="cp-header">
        ${window.getPortraitHTML ? window.getPortraitHTML(npc.id, npc.name) : `<span class="cp-portrait">${npc.portrait}</span>`}
        <div class="cp-info">
          <span class="cp-name">${npc.name}</span>
          <span class="cp-title">${npc.title}</span>
          <span class="cp-faction">${factionLabel(npc.faction)}</span>
          ${window.getRepTier && npc.faction && window.reputation?.hasOwnProperty(npc.faction)
            ? `<span class="cp-rep-badge" style="color:${window.getRepTier(npc.faction).color}">${window.getRepTier(npc.faction).icon} ${window.getRepTier(npc.faction).label} (${window.getRepScore(npc.faction) > 0 ? '+' : ''}${window.getRepScore(npc.faction)})</span>`
            : ''
          }
        </div>
        <span class="cp-disp" id="cp-disp">${dispositionIcon(npc.disposition)}</span>
        <div class="cp-player-side" id="cp-player-side">
          ${getPlayerPortraitHTML(gameState.character)}
          <div class="cp-player-info">
            <span class="cp-player-name" id="cp-player-name">${gameState.character?.name || 'You'}</span>
            <span class="cp-player-class">${getClassLabel(gameState.character)}</span>
          </div>
        </div>
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
  // Insert into the game log so it's inline in the stream (not a floating overlay)
  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    gameLog.appendChild(panel);
    setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  } else {
    document.body.appendChild(panel);
  }
  requestAnimationFrame(() => panel.style.opacity = '1');
}

// ── Player portrait helpers ──
function getPlayerPortraitHTML(char) {
  if (!char) return `<div class="cp-player-portrait-box"><span style="font-size:32px">👤</span></div>`;
  if (char.portrait) {
    return `<div class="cp-player-portrait-box"><img src="${char.portrait}" alt="${char.name}" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:2px;"></div>`;
  }
  // Fallback: class icon
  const classIcons = { paladin:'✝', shadow_blade:'🗡', void_herald:'🌑', blood_cleric:'🩸', iron_warden:'🛡', whisper_sage:'📜' };
  const icon = classIcons[char.class] || '⚔';
  return `<div class="cp-player-portrait-box cp-player-icon">${icon}</div>`;
}

function getClassLabel(char) {
  if (!char) return '';
  const cls = typeof CLASSES !== 'undefined' ? CLASSES?.find(c => c.id === char.class) : null;
  const race = typeof RACES !== 'undefined' ? RACES?.find(r => r.id === char.race) : null;
  return `${race?.name || ''} ${cls?.name || ''}`.trim();
}

// Called when another player sends a message to the NPC — swap portrait to them
function updateConvPlayerPortrait(playerName, playerChar) {
  const side = document.getElementById('cp-player-side');
  const nameEl = document.getElementById('cp-player-name');
  if (!side || !nameEl) return;

  const portraitBox = side.querySelector('.cp-player-portrait-box');
  if (portraitBox) {
    if (playerChar?.portrait) {
      portraitBox.innerHTML = `<img src="${playerChar.portrait}" alt="${playerName}" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:2px;">`;
      portraitBox.classList.remove('cp-player-icon');
    } else {
      const classIcons = { paladin:'✝', shadow_blade:'🗡', void_herald:'🌑', blood_cleric:'🩸', iron_warden:'🛡', whisper_sage:'📜' };
      portraitBox.innerHTML = classIcons[playerChar?.class] || '⚔';
      portraitBox.classList.add('cp-player-icon');
    }
  }
  nameEl.textContent = playerName;
  // Flash to signal speaker change
  side.style.outline = '1px solid var(--gold)';
  setTimeout(() => { if (side) side.style.outline = ''; }, 800);
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

// ── Write conversation outcomes back to global world state ──
function _updateWorldFromConversation(npc, speech, fullResponse) {
  if (!window.sceneState) window.sceneState = { flags: {} };
  const flags = window.sceneState.flags;
  const lower = speech.toLowerCase();
  const npcId = npc.id;

  // Track that player has spoken with this NPC
  flags['talked_to_' + npcId] = true;

  // Write to story history so generateAIScene knows progression
  if (window.sceneState.history) {
    const historyEntry = `talked_to_${npcId}`;
    if (!window.sceneState.history.includes(historyEntry)) {
      window.sceneState.history.push(historyEntry);
    }
  }

  // Update reputation based on conversation content
  if (window.updateRepFromConversation) {
    window.updateRepFromConversation(npcId, speech, flags);
  }

  // Detect NPC revealing key information
  if (lower.includes('varek') && (lower.includes('monastery') || lower.includes('old quarter') || lower.includes('whereabouts') || lower.includes('hiding'))) {
    flags['knows_varek_location'] = true;
  }
  if (lower.includes('covenant') && (lower.includes('disbanded') || lower.includes('destroyed') || lower.includes('gone') || lower.includes('dead'))) {
    flags['knows_covenant_fate'] = true;
  }
  if (lower.includes('archive') && (lower.includes('document') || lower.includes('scroll') || lower.includes('seal'))) {
    flags['knows_archive_secret'] = true;
  }

  // Detect NPC becoming hostile or allied
  if (lower.includes("won't help") || lower.includes("get out") || lower.includes("guards!") || lower.includes("arrest")) {
    flags['hostile_' + npcId] = true;
  }
  if (lower.includes('trust you') || lower.includes('help you') || lower.includes('ally') || lower.includes('with you')) {
    flags['allied_' + npcId] = true;
  }

  // Detect NPC being told someone is dead (so they won't call for that person)
  const deathMentionMatch = fullResponse.match(/(\w[\w\s]+) is dead/i);
  if (deathMentionMatch) {
    const mentionedName = deathMentionMatch[1].trim().toLowerCase().replace(/\s+/g,'_');
    flags['npc_dead_' + mentionedName] = flags['npc_dead_' + mentionedName] || 'unknown_killer';
  }

  // Persist flags to save system
  if (window.autoSave) window.autoSave();
}

function closeConvPanel() {
  const p = document.getElementById('conv-panel');
  if (p) { p.style.opacity = '0'; setTimeout(() => p.remove(), 300); }
  window.npcConvState.active = false;
  window.npcConvState.npc = null;
  window.npcConvState.history = [];

  // Restore ACT box to normal
  const actionInput = document.getElementById('action-input');
  if (actionInput) {
    actionInput.removeEventListener('focus', _redirectFocusToConv);
    actionInput.placeholder = 'What do you do? Type anything freely — the dice decide the outcome...';
  }

  // Restore the scene panel if one was hidden
  const scenePanel = document.getElementById('scene-panel');
  if (scenePanel) {
    scenePanel.style.display = '';
    setTimeout(() => scenePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
  }

  // Fire any scene that was queued while conv was open
  if (window._pendingScene) {
    const pending = window._pendingScene;
    window._pendingScene = null;
    setTimeout(() => { if (window.showScene) window.showScene(pending); }, 500);
  }

  // Broadcast close to all party members
  if ((window.mp?.sessionCode || gameState?.sessionCode) && window.mpBroadcastStoryEvent) {
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

// ─── INTENT CLASSIFIER — Claude interprets what the player wants ──────────
async function classifyPlayerIntent(text) {
  const lower = text.toLowerCase();

  // ── Fast local check first — no API needed ──

  // 1. Combat words
  const combatWords = ['attack','stab','strike','punch','kill','slash','fight','shoot','lunge','charge'];
  if (combatWords.some(w => lower.includes(w))) {
    return { intent: 'combat', target: lower };
  }

  // 2. NPC name anywhere in the text → open that conversation
  // "rhael come here", "talk to mourne", "ask the captain" — all caught
  const npcMatch = Object.values(NPC_REGISTRY || {}).find(n => {
    const firstName = n.name.toLowerCase().split(' ')[0]; // "captain" from "Captain Rhael"
    const lastName  = n.name.toLowerCase().split(' ').pop(); // "rhael"
    return lower.includes(firstName) || lower.includes(lastName) ||
           (n.aliases || []).some(a => lower.includes(a.toLowerCase()));
  });
  if (npcMatch) return { intent: 'talk', npc_id: npcMatch.id };

  // 3. Ambiguous — call API only as last resort
  const char = gameState.character;
  const loc = WORLD_LOCATIONS?.[mapState?.currentLocation || 'vaelthar_city'];
  const knownNPCs = Object.values(NPC_REGISTRY || {}).map(n => `${n.name} (id: ${n.id})`).join(', ');

  const prompt = `You are the action classifier for a dark fantasy RPG called Sanctum & Shadow.
The player typed: "${text}"
Current location: ${loc?.name || 'Vaelthar'}
Known NPCs in the world: ${knownNPCs}
Player character: ${char?.name}, ${char?.class}

Classify this action into EXACTLY ONE of these intents and respond with raw JSON only, no markdown:
{ "intent": "talk", "npc_id": "<id from known NPCs>" }
{ "intent": "combat", "target": "<enemy name>" }
{ "intent": "action" }

Rules:
- "talk" = player wants to speak to, address, call over, interact with, or direct something at a specific NPC. Extract the NPC id from the known list.
- "combat" = player wants to attack, fight, or use a combat ability against something.
- "action" = everything else (explore, move, use item, investigate, etc.)
- If the player mentions an NPC name anywhere in their text (even casually), and it's in the known list, classify as "talk" with that NPC.
- Match NPC names flexibly: "rhael", "the captain", "that guard captain", "scribe", "the trembling man" etc.`;

  try {
    const res = await fetch('/api/npc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text?.trim() || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { intent: 'action' };
  }
}

// ─── submitAction HOOK ────────────────────────
// Guard so this wraps exactly once, no matter how many times it's called
let _npcHookInstalled = false;
function installNPCHook() {
  if (_npcHookInstalled) return;
  if (!window.submitAction) {
    setTimeout(installNPCHook, 200);
    return;
  }
  _npcHookInstalled = true;

  const _prev = window.submitAction;
  window.submitAction = async function () {
    const input = document.getElementById('action-input');
    const text = (input?.value || '').trim();
    if (!text) return;
    if (window.AudioEngine) AudioEngine.sfx?.page();

    // ── Mid-conversation intercept ──
    if (window.npcConvState?.active) {
      input.value = '';
      const char = gameState.character;
      const _npc = window.npcConvState.npc;
      const lower = text.toLowerCase();

      // Leave/exit words → end conversation and pass action to world
      const _leaveW = ['leave', 'walk away', 'step away', 'go away', 'exit', 'depart', 'turn and leave', 'turn away', 'leave the', 'walk out'];
      if (_leaveW.some(w => lower.startsWith(w) || lower.includes(' and leave') || lower.includes('walk away'))) {
        addLog(`${char?.name} ends the conversation and leaves.`, 'system');
        closeConvPanel();
        // Pass the action to the world handler as a scene action
        input.value = text;
        _prev();
        return;
      }

      // Attack words → close conv and start combat immediately
      const _atkW = ['attack','stab','strike','punch','hit','kill','slash','fight','lunge','charge','shoot','draw sword'];
      if (_atkW.some(w => lower.includes(w))) {
        addLog(`⚔ ${char?.name} attacks ${_npc.name}!`, 'combat');
        if (window.AudioEngine) AudioEngine.sfx?.sword?.();
        closeConvPanel();
        const _ef = { captain_rhael:()=>generateEnemy('captain_rhael',1), sister_mourne:()=>generateEnemy('sister_mourne',2), bresker:()=>generateEnemy('city_guard',2) };
        const _en = (_ef[_npc.id] ? _ef[_npc.id]() : generateEnemy('bandit', AREA_LEVELS[window.mapState?.currentLocation]||1));
        _en.name = _npc.name; _en.icon = _npc.portrait||'👤';
        setTimeout(()=>startCombat([_en]), 400);
        return;
      }

      // All other text — route through conv-input for unified behavior
      const convInput = document.getElementById('conv-input');
      if (convInput) {
        convInput.value = text;
        submitConvInput();
      } else {
        const framed = `[${char?.name || 'The player'} ${text}]`;
        sendNPCMessage(framed);
      }
      return;
    }

    // ── Fast local talk detection — scan for any known NPC name in text ──
    const _quickNPC = (() => {
      const l = text.toLowerCase();
      // Check aliases first
      const aliasMap = {
        'rhael':'captain_rhael','captain':'captain_rhael','watch captain':'captain_rhael',
        'mourne':'sister_mourne','sister':'sister_mourne',
        'scribe':'trembling_scribe','trembling scribe':'trembling_scribe',
        'varek':'elder_varek','elder':'elder_varek',
        'bresker':'bresker','harren':'harren_fallen',
      };
      for (const [alias, id] of Object.entries(aliasMap)) {
        if (l.includes(alias)) return id;
      }
      // Check NPC registry names
      return Object.values(NPC_REGISTRY || {}).find(n => {
        const last = n.name.toLowerCase().split(' ').pop();
        return l.includes(last) && last.length > 3;
      })?.id || null;
    })();

    if (_quickNPC) {
      input.value = '';
      startNPCConversation(_quickNPC, text);
      return;
    }

    // Auto-combat check — "attack X", "stab X", etc.
    if (typeof checkAutoAttack === 'function' && checkAutoAttack(text)) {
      input.value = '';
      return;
    }

    // Ask Claude what the player intends (clears input AFTER classification to avoid double-fire)
    const intent = await classifyPlayerIntent(text);
    input.value = '';

    if (intent.intent === 'talk' && intent.npc_id) {
      startNPCConversation(intent.npc_id, text);
      return;
    }

    if (intent.intent === 'combat') {
      if (typeof checkAutoAttack === 'function') checkAutoAttack(text);
      return;
    }

    // Default: pass to normal action handler (game.js submitAction)
    // Restore text so game.js can read and log it
    input.value = text;
    _prev();
  };
}

// Install once after initGameScreen (story/combat systems are ready by then)
const _origInitNPC = window.initGameScreen;
window.initGameScreen = function () {
  if (_origInitNPC) _origInitNPC();
  // Reset flag so hook re-wraps the fresh submitAction after screen re-init
  _npcHookInstalled = false;
  setTimeout(installNPCHook, 600);
};

// Initial install at page load
document.addEventListener('DOMContentLoaded', () => setTimeout(installNPCHook, 1000));

// ─── CSS ─────────────────────────────────────
const convCSS = `
.conv-panel {
  width: 100%;
  opacity: 0; transition: opacity 0.3s;
  margin: 4px 0 8px 0;
  animation: sceneFadeIn 0.3s ease;
}
.cp-inner {
  width: 100%;
  background: linear-gradient(180deg, rgba(5,3,1,0.99) 0%, rgba(8,5,2,1) 100%);
  border: 1px solid rgba(201,168,76,0.45);
  border-left: 3px solid rgba(201,168,76,0.65);
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
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
