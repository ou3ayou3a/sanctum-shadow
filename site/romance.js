// ============================================
//   SANCTUM & SHADOW — UNIVERSAL ROMANCE ENGINE
//   Every NPC is romanceable. Gender assigned
//   by Claude on first conversation. Moral
//   consequences tied to the soul system.
// ============================================

// ─── ROMANCE STATE ────────────────────────────
window.romanceState = {
  relationships: {},   // npcId → { affection, gender, flirtedSuccessfully, intimate, inLove, married }
  marriedTo: null,     // npcId
  marriedToName: null,
  cheated: false,
  family: { children: 0, homeEstablished: false },
};

// ─── AFFECTION STAGES ─────────────────────────
const AFFECTION_STAGES = [
  { min:0,  max:19,  label:'Stranger',   color:'#666' },
  { min:20, max:39,  label:'Acquainted', color:'#9a8a6a' },
  { min:40, max:59,  label:'Warm',       color:'#c9a84c' },
  { min:60, max:74,  label:'Smitten',    color:'#e8904a' },
  { min:75, max:89,  label:'Devoted',    color:'#e87a8a' },
  { min:90, max:100, label:'In Love',    color:'#ff6b8a' },
];

function getStage(npcId) {
  const rel = window.romanceState.relationships[npcId];
  if (!rel) return AFFECTION_STAGES[0];
  return AFFECTION_STAGES.find(s => rel.affection >= s.min && rel.affection <= s.max) || AFFECTION_STAGES[0];
}

function getRelationship(npcId) {
  if (!window.romanceState.relationships[npcId]) {
    window.romanceState.relationships[npcId] = {
      affection: 0, gender: null,
      flirtedSuccessfully: false, intimate: false,
      inLove: false, married: false,
    };
  }
  return window.romanceState.relationships[npcId];
}

// ─── GENDER DETECTION ─────────────────────────
// If NPC has no gender set, ask Claude to assign one based on name/personality
async function ensureNPCGender(npc) {
  const rel = getRelationship(npc.id);
  if (rel.gender) return rel.gender;

  // Check NPC registry first
  if (npc.gender) { rel.gender = npc.gender; return rel.gender; }

  // Ask Claude to determine gender from name and personality snippet
  const prompt = `NPC name: "${npc.name}", Title: "${npc.title || ''}", Personality snippet: "${(npc.personality || '').substring(0, 200)}"
Respond with exactly one word: "male" or "female". Base it on name, title, and any pronouns in the personality.`;

  try {
    const res = await fetch('/api/npc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const answer = data.content?.map(b => b.text || '').join('').trim().toLowerCase();
    rel.gender = answer.includes('female') ? 'female' : 'male';
  } catch {
    rel.gender = 'male'; // safe default
  }
  return rel.gender;
}

// ─── ROMANCE INTENT DETECTION ─────────────────
const FLIRT_PATTERNS = [
  /\bflirt\b/i, /\bcompliment\b/i, /\bcharm\b/i, /\bwink\b/i,
  /smile at\b/i, /\bbat (my )?eyes\b/i, /\bbuy (her|him) a drink\b/i,
  /tell (her|him) (she'?s?|he'?s?|how)/i,
  /\bseduce\b/i, /\bromance\b/i, /\bcourt\b/i, /\bask (her|him) out\b/i,
  /you'?re? (beautiful|handsome|lovely|stunning|gorgeous)/i,
  /\bflatter\b/i, /lean (closer|in)\b/i, /\bgive (her|him) a look\b/i,
];
const LOVE_PATTERNS = [
  /i love you/i, /i have feelings/i, /i care (deeply|about you)/i,
  /you mean (everything|so much)/i, /fallen? for you/i, /my heart\b/i,
  /i('?m| am) in love/i,
];
const INTIMATE_PATTERNS = [
  /come to my room/i, /your room/i, /show (you|me) what/i,
  /tell (you|her|him) something in (your|my) ear/i,
  /whisper (something )?(in|into) (your|my) ear/i,
  /\blet'?s? go somewhere (private|alone|quiet)\b/i,
  /\blet'?s? be alone\b/i,
  /\bkiss (you|her|him)\b/i, /\btouch (you|her|him)\b/i,
];
const PROPOSE_PATTERNS = [
  /marry me/i, /will you marry/i, /want to marry/i,
  /spend my life (with you)/i, /be my (wife|husband)/i, /\bpropose\b/i,
  /\bget married\b/i,
];
const FAMILY_PATTERNS = [
  /start a family/i, /have (a )?child(ren)?/i, /start our family/i,
  /have (a )?baby/i, /have (a )?kid/i,
];

function detectRomanceIntent(text) {
  if (PROPOSE_PATTERNS.some(p => p.test(text))) return 'propose';
  if (INTIMATE_PATTERNS.some(p => p.test(text))) return 'intimate';
  if (LOVE_PATTERNS.some(p => p.test(text))) return 'declare_love';
  if (FLIRT_PATTERNS.some(p => p.test(text))) return 'flirt';
  if (FAMILY_PATTERNS.some(p => p.test(text))) return 'family';
  return null;
}

// ─── ROMANCE SYSTEM PROMPT ADDON ─────────────
function buildRomancePrompt(npc, rel, intent, npcGender) {
  const stage = getStage(npc.id);
  const playerGender = gameState.character?.gender || 'male';
  const sameSex = playerGender === npcGender;
  const isMarried = window.romanceState.marriedTo === npc.id;
  const partnerName = window.romanceState.marriedToName;

  return `

ROMANCE & ATTRACTION CONTEXT:
- NPC gender: ${npcGender}
- Affection level: ${rel.affection}/100 — Stage: ${stage.label}
- Player has successfully flirted before: ${rel.flirtedSuccessfully}
- Intimacy has occurred: ${rel.intimate}
- Currently in love: ${rel.inLove}
- Married to player: ${isMarried}
${partnerName && !isMarried ? `- Player is married to ${partnerName} — this is an affair` : ''}

RESPOND TO INTENT: "${intent}"

${intent === 'flirt' ? `
The player is flirting. Respond based on affection stage:
- Stranger (0-19): Dismissive or mildly amused. Not interested.
- Acquainted (20-39): Notice it. Small smile or deflection. Maybe a hint of interest.
- Warm (40-59): Warm response. Flirt back subtly.
- Smitten (60+): Flirt back openly. Make interest clear.
Personality should shape HOW you flirt/reject — stay in character always.
${sameSex ? 'This is a same-sex advance. React based on your personality — could be flattered, confused, or quietly reciprocal.' : ''}
End your response with: [AFFECTION:+N] where N = 2-10 based on success, or [AFFECTION:-2] if failed.` : ''}

${intent === 'intimate' ? `
The player is suggesting intimacy or something private.
${rel.affection < 60 || !rel.flirtedSuccessfully
  ? 'Not enough affection or history. Decline gracefully but in character. [AFFECTION:+0]'
  : `Accept suggestively but NEVER explicitly. Imply, tease, suggest — fade to black.
Use format: *[npc name] [suggestive action — physical but tasteful, no explicit detail]*
Then a short "morning after" line about how the mood/dynamic shifted between you.
${sameSex ? 'This is a same-sex encounter — handle with the same tasteful implication.' : ''}
End with: [AFFECTION:+15] [INTIMATE:true]`}` : ''}

${intent === 'declare_love' ? `
The player is confessing feelings.
${rel.affection >= 75
  ? 'You feel the same. Say so in your own voice — not generic romance, but true to who you are.'
  : 'You are moved but not ready. Be kind and honest.'}
End with: [AFFECTION:+${rel.affection >= 75 ? '10' : '3'}]` : ''}

${intent === 'propose' ? `
The player is proposing marriage.
${rel.affection >= 90
  ? 'Say YES in your own voice. This is the most important moment of your life in this story. Make it real. End with: [MARRIED:true] [AFFECTION:+10]'
  : 'Decline gently. You care but aren\'t ready. End with: [AFFECTION:+2]'}` : ''}

After your dialogue and OPTIONS, always include the appropriate tag(s) on a final line.`;
}

// ─── RE-RENDER OPTIONS AFTER A FAILED ROMANCE BEAT ─────────
// Romance prereq/fumble/hard-fail beats end with appendConvLine + addLog and
// then return without sending to Claude. That left the PRIOR turn's option
// buttons on screen. Re-render the current options so the player has fresh,
// correct choices to continue with. (#33)
function _reRenderRomanceOptions() {
  const opts = window.npcConvState?.currentOptions;
  if (opts && opts.length && typeof renderConvOptions === 'function') {
    renderConvOptions(opts);
  }
}

// ─── ROMANCE SYSTEM-PROMPT INJECTION HOOK ──────────────────
// Base sendNPCMessage (dialogue.js) injects this alongside the reputation and
// schedule blocks. We stash the per-turn romance context when a romance intent
// is detected, then the base prompt builder pulls it in here. Consumed once.
window.getNPCRomanceContext = function(npc) {
  const ctx = window._currentRomanceContext;
  if (!ctx || !npc || ctx.npc?.id !== npc.id) return '';
  return ctx.promptBlock || '';
};

// ─── ROMANCE RESPONSE POST-PROCESSOR ───────────────────────
// Base sendNPCMessage calls this after callClaude. We consume the affection /
// intimate / married tags and apply their side-effects, then return the
// cleaned response so the base lifecycle (display-sanitize, history, world
// writeback, talked_to/reputation flags, autosave) runs on clean text. (#17)
window._postProcessNPCResponse = function(npc, raw) {
  const ctx = window._currentRomanceContext;
  // Only act on the turn we set up; clear it so normal turns are untouched.
  if (!ctx || !npc || ctx.npc?.id !== npc.id) return raw;
  window._currentRomanceContext = null;

  const rel = getRelationship(npc.id);

  const affMatch = raw.match(/\[AFFECTION:([+-]\d+)\]/);
  if (affMatch) changeAffection(npc.id, parseInt(affMatch[1]));

  if (/\[INTIMATE:true\]/i.test(raw)) rel.intimate = true;
  if (/\[MARRIED:true\]/i.test(raw)) handleMarriage(npc.id, npc.name);

  if (ctx.intent === 'declare_love' && rel.affection >= 75) rel.inLove = true;

  // Refresh the affection bar once the base path has rendered the line.
  setTimeout(() => renderAffectionBar(npc.id, npc.name), 0);

  // Strip romance tags so they never reach the transcript.
  return raw.replace(/\[(AFFECTION:[+-]\d+|INTIMATE:true|MARRIED:true)\]/gi, '').trim();
};

// ─── MAIN HOOK — intercept sendNPCMessage ─────
const _origSendNPCMessage = window.sendNPCMessage;
window.sendNPCMessage = async function(...args) {
  const playerText = args[0];
  const isOpener = args[1] === true;
  const npc = window.npcConvState?.npc;

  // Clear any stale one-shot romance context from a prior turn that didn't
  // reach the post-processor (e.g. base bailed on turn-limit/navigation), so
  // it can never inject the romance prompt into an unrelated later turn.
  window._currentRomanceContext = null;

  // Only intercept inside an active one-on-one conversation with an NPC.
  // Never intercept openers (they'd burn the romance flow and double-log) and
  // never intercept when there's no live conversation — let plot lines through.
  if (!npc || isOpener || !window.npcConvState?.active) {
    if (_origSendNPCMessage) return _origSendNPCMessage(...args);
    return;
  }

  const intent = detectRomanceIntent(playerText);

  // No romance intent — pass through normally but still track
  if (!intent) {
    if (_origSendNPCMessage) return _origSendNPCMessage(...args);
    return;
  }

  // Handle family action directly
  if (intent === 'family') {
    startFamily();
    if (_origSendNPCMessage) return _origSendNPCMessage(...args);
    return;
  }

  const char = gameState.character;
  const rel = getRelationship(npc.id);

  // Get NPC gender (async, cached after first call)
  const npcGender = await ensureNPCGender(npc);
  rel.gender = npcGender;

  const playerGender = char?.gender || 'male';
  const sameSex = playerGender === npcGender;

  // ── Prerequisite checks with early exits ──
  if (intent === 'intimate') {
    if (rel.affection < 60 || !rel.flirtedSuccessfully) {
      const lines = rel.affection < 20
        ? [`${npc.name} steps back. "I don't even know you. No."`,
           `${npc.name} looks offended. "That's a bit forward for a stranger, don't you think?"`]
        : rel.affection < 40
        ? [`${npc.name} shakes their head. "You're getting ahead of yourself."`,
           `${npc.name} smiles faintly. "Slow down. We've barely spoken."`]
        : [`${npc.name} raises an eyebrow. "You haven't even properly flirted with me. Try that first."`,
           `${npc.name} tilts their head. "Not yet. Ask me again when the time is right."`];
      const line = lines[Math.floor(Math.random() * lines.length)];
      addLog(`${npc.portrait || '👤'} ${line}`, 'narrator');
      appendConvLine(npc.name, line);
      _reRenderRomanceOptions();
      return;
    }

    // Roll for performance
    const roll = Math.floor(Math.random() * 20) + 1;
    const chaMod = Math.floor(((char?.stats?.cha || 10) - 10) / 2);
    const total = roll + chaMod;
    addLog(`🎲 CHA Roll: [${roll}] + ${chaMod} = ${total}`, 'dice');

    if (total <= 5) {
      // Fumble — comic failure
      const fumbles = [
        `*${npc.name} stifles a laugh, then lets it go* "I've seen better from a nervous apprentice. Bless your heart."`,
        `*${npc.name} pats your arm with exaggerated sympathy* "That was... an attempt. We'll call it practice."`,
        `*${npc.name} covers their mouth* "Oh. Oh no. You really tried, didn't you? That's almost endearing."`,
        `*${npc.name} leans back with a slow blink* "I've heard tavern songs less awkward than that. Sit down."`,
      ];
      const line = fumbles[Math.floor(Math.random() * fumbles.length)];
      addLog(`${npc.portrait || '👤'} ${line}`, 'narrator');
      appendConvLine(npc.name, line);
      _reRenderRomanceOptions();
      return;
    }
    // Good roll — fall through to Claude with intimate context
  }

  if (intent === 'flirt') {
    const roll = Math.floor(Math.random() * 20) + 1;
    const chaMod = Math.floor(((char?.stats?.cha || 10) - 10) / 2);
    const total = roll + chaMod;
    addLog(`🎲 CHA (Charm): [${roll}] + ${chaMod} = ${total}`, 'dice');

    // Hard fail on low roll + low affection
    if (total < 8 && rel.affection < 30) {
      const fails = [
        `${npc.name} looks at you flatly. "Was that supposed to work?"`,
        `${npc.name} gives a short laugh. "Keep practicing."`,
        `${npc.name} stares a moment, then goes back to what they were doing.`,
        `${npc.name} blinks. "I'm going to pretend I didn't hear that."`,
      ];
      const line = fails[Math.floor(Math.random() * fails.length)];
      addLog(`${npc.portrait || '👤'} ${line}`, 'narrator');
      appendConvLine(npc.name, line);
      changeAffection(npc.id, -1);
      _reRenderRomanceOptions();
      return;
    }
    if (total >= 10) rel.flirtedSuccessfully = true;

    // Cheating check
    if (window.romanceState.marriedTo && window.romanceState.marriedTo !== npc.id) {
      grantHellPoints(3);
      addLog(`⛧ You flirt while married to ${window.romanceState.marriedToName}. +3 Hell Points.`, 'hell');
    }
  }

  if (intent === 'propose') {
    if (rel.affection < 90) {
      const lines = [
        `${npc.name} is touched — you can see it — but shakes their head softly. "Ask me again when you know me better."`,
        `${npc.name} takes your hand gently. "I care for you. But I'm not ready for that. Not yet."`,
      ];
      const line = lines[Math.floor(Math.random() * lines.length)];
      addLog(`${npc.portrait || '👤'} ${line}`, 'narrator');
      appendConvLine(npc.name, line);
      _reRenderRomanceOptions();
      return;
    }
    // Cheating marriage check
    if (window.romanceState.marriedTo && window.romanceState.marriedTo !== npc.id) {
      addLog(`⚠ You are already married to ${window.romanceState.marriedToName}! This is a grave sin.`, 'hell');
      gameState.character.holyPoints = 0;
      grantHellPoints(40);
      _reRenderRomanceOptions();
      return;
    }
  }

  // Same-sex moral consequence (happens but doesn't block)
  if (sameSex && (intent === 'intimate' || intent === 'declare_love')) {
    grantHellPoints(10);
    addLog(`⛧ The Church would condemn this. +10 Hell Points.`, 'hell');
  }

  // Affair consequence for intimacy
  if (intent === 'intimate' && window.romanceState.marriedTo && window.romanceState.marriedTo !== npc.id) {
    window.romanceState.cheated = true;
    const lost = gameState.character?.holyPoints || 0;
    if (gameState.character) gameState.character.holyPoints = 0;
    grantHellPoints(25);
    addLog(`💔 You have betrayed your vows to ${window.romanceState.marriedToName}. All Holy Points lost. +25 Hell Points.`, 'hell');
  }

  // ── Route the actual send through the BASE lifecycle (#17) ──
  // Rather than re-implementing a partial send (which skipped display-sanitize,
  // _updateWorldFromConversation, talked_to_/reputation flags and autosave),
  // we stash the romance system-prompt addition + intent so the base
  // sendNPCMessage injects it (via getNPCRomanceContext) and consumes the
  // affection/intimate/married tags afterward (via _postProcessNPCResponse).
  // The base path then performs the full world writeback for free, and the
  // affection/flirt mechanics above remain intact.
  window._currentRomanceContext = {
    npc,
    rel,
    intent,
    npcGender,
    promptBlock: buildRomancePrompt(npc, rel, intent, npcGender),
  };

  if (_origSendNPCMessage) {
    return _origSendNPCMessage(...args);
  }
  // No base send available — clear the one-shot context so it can't leak.
  window._currentRomanceContext = null;
};

// ─── AFFECTION MANAGEMENT ─────────────────────
function changeAffection(npcId, delta) {
  const rel = getRelationship(npcId);
  const prevLabel = getStage(npcId).label;
  rel.affection = Math.max(0, Math.min(100, rel.affection + delta));
  const newStage = getStage(npcId);

  if (prevLabel !== newStage.label) {
    const npcName = NPC_REGISTRY[npcId]?.name || npcId;
    addLog(`💕 ${npcName} — ${newStage.label}`, 'holy');
  }

  if (rel.affection >= 90 && !rel.inLove) {
    rel.inLove = true;
    grantHolyPoints(5);
    addLog(`❤ Falling in love. +5 Holy Points.`, 'holy');
  }
}

// ─── MARRIAGE ─────────────────────────────────
function handleMarriage(npcId, npcName) {
  window.romanceState.marriedTo = npcId;
  window.romanceState.marriedToName = npcName;
  window.romanceState.relationships[npcId].married = true;
  grantHolyPoints(30);
  addLog(`💍 Married to ${npcName}! +30 Holy Points.`, 'holy');

  const banner = document.createElement('div');
  banner.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    z-index:3000;background:linear-gradient(135deg,rgba(5,3,1,0.99),rgba(12,8,3,0.99));
    border:2px solid var(--gold);padding:30px 40px;text-align:center;
    font-family:'Cinzel',serif;color:var(--gold);min-width:300px;
    box-shadow:0 0 60px rgba(201,168,76,0.4);`;
  banner.innerHTML = `
    <div style="font-size:2rem;margin-bottom:8px">💍</div>
    <div style="font-size:1.1rem;letter-spacing:0.15em">MARRIED</div>
    <div style="font-size:0.9rem;color:#aaa;margin:8px 0">${gameState.character?.name || 'You'} & ${npcName}</div>
    <div style="font-size:0.75rem;color:var(--gold);margin:4px 0">+30 Holy Points</div>
    <button onclick="this.parentElement.remove()" style="margin-top:16px;background:rgba(201,168,76,0.15);
      border:1px solid var(--gold);color:var(--gold);font-family:'Cinzel',serif;
      font-size:0.75rem;padding:7px 20px;cursor:pointer;">✝ Till Death Do Us Part</button>
  `;
  document.body.appendChild(banner);
}

// ─── FAMILY ───────────────────────────────────
function startFamily() {
  if (!window.romanceState.marriedTo) {
    addLog('You must be married first.', 'system'); return;
  }
  window.romanceState.family.children++;
  window.romanceState.family.homeEstablished = true;
  grantHolyPoints(15);
  addLog(`👶 A child is born. Your family grows. +15 Holy Points.`, 'holy');
}

// ─── AFFECTION BAR UI ─────────────────────────
function renderAffectionBar(npcId, npcName) {
  const rel = getRelationship(npcId);
  const stage = getStage(npcId);
  document.getElementById('affection-bar')?.remove();
  const panel = document.getElementById('conv-panel');
  if (!panel) return;

  const bar = document.createElement('div');
  bar.id = 'affection-bar';
  bar.style.cssText = `padding:5px 16px 3px;border-top:1px solid rgba(255,150,150,0.1);
    display:flex;align-items:center;gap:10px;`;
  bar.innerHTML = `
    <span style="font-family:'Cinzel',serif;font-size:0.58rem;color:#ff9aaa;white-space:nowrap">💕 ${npcName}</span>
    <div style="flex:1;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden">
      <div style="height:100%;width:${rel.affection}%;background:${stage.color};border-radius:2px;transition:width 0.5s"></div>
    </div>
    <span style="font-size:0.58rem;color:${stage.color};white-space:nowrap">${stage.label}</span>
  `;
  const inner = panel.querySelector('.cp-inner');
  if (inner) inner.appendChild(bar);
}

// ─── HELPER ───────────────────────────────────
function appendConvLine(name, text) {
  const t = document.getElementById('cp-transcript');
  if (!t) return;
  const esc = window.escapeHtml || (s => s);
  const d = document.createElement('div');
  d.className = 'ct-entry npc';
  d.innerHTML = `<span class="ct-speaker">${esc(name)}</span><span class="ct-text">${esc(text)}</span>`;
  t.appendChild(d);
  t.scrollTop = t.scrollHeight;
}

// ─── FAMILY TRIGGER IN ACTION HOOK ────────────
const _origCheckAutoAttack = window.checkAutoAttack;
window.checkAutoAttack = function(text) {
  if (FAMILY_PATTERNS.some(p => p.test(text))) { startFamily(); return true; }
  if (_origCheckAutoAttack) return _origCheckAutoAttack(text);
  return false;
};

// ─── MINIMAL TRANSCRIPT STYLING ───────────────
// romance.js owns this style block; the shared stylesheets are owned by other files.
(function injectRomanceCSS() {
  if (document.getElementById('romance-ct-style')) return;
  const style = document.createElement('style');
  style.id = 'romance-ct-style';
  style.textContent = `
    .ct-entry { display:flex; flex-direction:column; gap:1px; margin:3px 0; padding:3px 6px;
      border-left:2px solid rgba(255,150,150,0.25); }
    .ct-entry.npc { border-left-color:rgba(255,150,150,0.4); }
    .ct-speaker { font-family:'Cinzel',serif; font-size:0.6rem; color:#ff9aaa; letter-spacing:0.04em; }
    .ct-text { font-size:0.72rem; color:#cfc6b8; line-height:1.35; }
  `;
  document.head.appendChild(style);
})();

console.log('💕 Universal romance engine loaded — every NPC can be romanced.');
