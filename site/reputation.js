// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — REPUTATION SYSTEM
//  A score per faction (-100 to +100) that shapes how NPCs
//  greet you, what options exist, and what the world allows.
// ═══════════════════════════════════════════════════════════

// ─── FACTION DEFINITIONS ─────────────────────────────────
const FACTIONS = {
  city_watch: {
    id: 'city_watch',
    name: 'City Watch',
    icon: '🛡',
    desc: 'The armed authority of Vaelthar. They keep order, report to the Crown, and tolerate no one who disrupts either.',
    color: '#6090c0',
  },
  church: {
    id: 'church',
    name: 'Church of the Eternal Flame',
    icon: '✝',
    desc: 'The spiritual authority of the realm. Ancient, wealthy, and terrified of losing either.',
    color: '#c0a040',
  },
  covenant: {
    id: 'covenant',
    name: 'The Covenant',
    icon: '⚡',
    desc: 'The shattered alliance between Crown and Church. Its remnants still operate in the shadows.',
    color: '#9060c0',
  },
  underworld: {
    id: 'underworld',
    name: 'Vaelthar Underworld',
    icon: '🌑',
    desc: 'Fences, thieves, assassins, and information brokers. They remember every favor and every insult.',
    color: '#806080',
  },
  citizens: {
    id: 'citizens',
    name: 'Citizens of Vaelthar',
    icon: '👥',
    desc: 'The common people. They talk. Their opinion spreads through taverns faster than plague.',
    color: '#80a060',
  },
  party: {
    id: 'party',
    name: 'Your Companions',
    icon: '⚔',
    desc: 'The people who travel with you. Their trust is everything.',
    color: '#c06040',
  },
};

// ─── REPUTATION STATE ─────────────────────────────────────
// Scores: -100 (Kill on sight) to +100 (Revered)
window.reputation = window.reputation || {
  city_watch:  0,
  church:      0,
  covenant:    0,
  underworld:  0,
  citizens:    0,
  party:       20, // start with some party trust
};

// ─── REPUTATION TIERS ────────────────────────────────────
const REP_TIERS = [
  { min:  80, max: 100, id: 'revered',    label: 'Revered',    icon: '⭐', color: '#e0c040' },
  { min:  40, max:  79, id: 'honored',    label: 'Honored',    icon: '🟢', color: '#40c080' },
  { min:  10, max:  39, id: 'friendly',   label: 'Friendly',   icon: '💚', color: '#60b060' },
  { min:  -9, max:   9, id: 'neutral',    label: 'Neutral',    icon: '⬜', color: '#808080' },
  { min: -39, max: -10, id: 'suspicious', label: 'Suspicious', icon: '🟡', color: '#c0a020' },
  { min: -79, max: -40, id: 'hostile',    label: 'Hostile',    icon: '🔴', color: '#c04040' },
  { min:-100, max: -80, id: 'kos',        label: 'Kill on Sight', icon: '💀', color: '#800000' },
];

function getRepTier(faction) {
  const score = window.reputation[faction] ?? 0;
  return REP_TIERS.find(t => score >= t.min && score <= t.max) || REP_TIERS[3];
}

function getRepScore(faction) {
  return window.reputation[faction] ?? 0;
}

// ─── CHANGE REPUTATION ───────────────────────────────────
function changeRep(faction, delta, reason) {
  if (!window.reputation.hasOwnProperty(faction)) return;
  const before = window.reputation[faction];
  window.reputation[faction] = Math.max(-100, Math.min(100, before + delta));
  const after  = window.reputation[faction];

  const tierBefore = REP_TIERS.find(t => before >= t.min && before <= t.max);
  const tierAfter  = REP_TIERS.find(t => after  >= t.min && after  <= t.max);

  const fac = FACTIONS[faction];
  const sign = delta > 0 ? '+' : '';
  addLog(`${fac?.icon || '◆'} ${fac?.name || faction}: ${sign}${delta} rep${reason ? ` — ${reason}` : ''} (${after})`, delta > 0 ? 'holy' : 'hell');

  // Tier change notification
  if (tierBefore && tierAfter && tierBefore.id !== tierAfter.id) {
    addLog(`━━ ${fac?.icon} Your standing with ${fac?.name} is now: ${tierAfter.icon} ${tierAfter.label} ━━`, 'system');
    _checkRepConsequences(faction, tierAfter.id, before, after);
  }

  // Update HUD
  _updateRepHUD();
  if (window.autoSave) autoSave();
}

// ─── REPUTATION CONSEQUENCES ────────────────────────────
function _checkRepConsequences(faction, newTier, before, after) {
  if (faction === 'city_watch' && newTier === 'kos') {
    addLog(`🛡 WARRANT ISSUED — The City Watch has declared you an enemy of Vaelthar. Guards will attack on sight.`, 'hell');
    if (window.sceneState) sceneState.flags.watch_warrant = true;
  }
  if (faction === 'city_watch' && newTier === 'revered') {
    addLog(`🛡 COMMENDATION — Captain Rhael has put your name on the Watch's protected list. Guards will assist you.`, 'holy');
    if (window.sceneState) sceneState.flags.watch_commendation = true;
  }
  if (faction === 'church' && newTier === 'kos') {
    addLog(`✝ EXCOMMUNICATION — The Church of the Eternal Flame has declared you anathema. Their doors are closed.`, 'hell');
    if (window.sceneState) sceneState.flags.church_excommunicated = true;
  }
  if (faction === 'underworld' && newTier === 'honored') {
    addLog(`🌑 VOUCHED — The underworld considers you reliable. Certain doors will now open.`, 'system');
    if (window.sceneState) sceneState.flags.underworld_vouched = true;
  }
  if (faction === 'citizens' && newTier === 'revered') {
    addLog(`👥 FOLK HERO — The people of Vaelthar speak of you with admiration. Merchants offer better prices.`, 'holy');
    if (window.sceneState) sceneState.flags.folk_hero = true;
  }
  if (faction === 'citizens' && newTier === 'kos') {
    addLog(`👥 FEARED — The people avoid you. Merchants raise prices. Children cross the street.`, 'hell');
    if (window.sceneState) sceneState.flags.feared_by_citizens = true;
  }
}

// ─── NPC GREETING BASED ON REP ───────────────────────────
// Called before building the system prompt — returns the
// opening stance the NPC should take based on faction rep
function getRepGreeting(npc) {
  const faction = npc.faction;
  if (!faction || !window.reputation.hasOwnProperty(faction)) return '';

  const tier = getRepTier(faction);
  const fac  = FACTIONS[faction];
  const score = getRepScore(faction);

  const greetings = {
    revered: [
      `You recognize ${npc.name} visibly relaxing as you approach — they know who you are and they are genuinely glad to see you.`,
      `${npc.name} treats you with open respect. Your reputation precedes you here.`,
    ],
    honored: [
      `${npc.name} greets you with more warmth than a stranger would normally receive.`,
      `You sense that ${npc.name} has heard good things about you.`,
    ],
    friendly: [
      `${npc.name} is professionally courteous — nothing special, but not cold either.`,
    ],
    neutral: [
      `${npc.name} regards you as a stranger — unknown quantity, no preconception.`,
    ],
    suspicious: [
      `${npc.name} watches you carefully. Something about your reputation has reached them and they are not pleased.`,
      `${npc.name} keeps their distance and their tone is flat. They've heard something about you.`,
    ],
    hostile: [
      `${npc.name} is visibly tense and unwilling. Every word is clipped. Your reputation with the ${fac?.name} makes this conversation dangerous.`,
      `${npc.name} barely controls their reaction to you. You are not welcome here.`,
    ],
    kos: [
      `${npc.name} reaches for their weapon the moment they see you. There is no diplomacy left between you and the ${fac?.name}.`,
    ],
  };

  const options = greetings[tier.id] || greetings.neutral;
  return options[Math.floor(Math.random() * options.length)];
}

// ─── REP-GATED OPTIONS ───────────────────────────────────
// Returns text to inject into system prompt about which
// options should/shouldn't be available based on rep
function getRepOptionContext(npc) {
  const faction = npc.faction;
  if (!faction || !window.reputation.hasOwnProperty(faction)) return '';

  const score = getRepScore(faction);
  const tier  = getRepTier(faction);
  const lines = [];

  if (score >= 40) {
    lines.push(`The player has HONORED standing with ${FACTIONS[faction]?.name}. You may offer them additional options or information that you would withhold from strangers. You can reference their good standing.`);
  }
  if (score >= 80) {
    lines.push(`The player is REVERED by ${FACTIONS[faction]?.name}. You are genuinely on their side. Offer them your best information and most favorable options without them needing to persuade you.`);
  }
  if (score <= -10) {
    lines.push(`The player has SUSPICIOUS standing with ${FACTIONS[faction]?.name}. Be more guarded. Require better rolls for persuasion. Do not volunteer information.`);
  }
  if (score <= -40) {
    lines.push(`The player is HOSTILE to ${FACTIONS[faction]?.name}. You distrust them deeply. Your DC on all persuasion checks is +4 harder. You may refuse to help entirely.`);
  }
  if (score <= -80) {
    lines.push(`The player is KILL ON SIGHT for ${FACTIONS[faction]?.name}. You will not cooperate. Call for guards or attack if you can. This conversation should be very short.`);
  }

  // Specific faction rules
  if (faction === 'city_watch' && sceneState?.flags?.watch_warrant) {
    lines.push(`A WARRANT is out for this player. You know it. You must decide: enforce it now, or look the other way.`);
  }
  if (faction === 'church' && sceneState?.flags?.church_excommunicated) {
    lines.push(`This player is EXCOMMUNICATED by the Church. You are forbidden from aiding them and must treat them as an enemy of the faith.`);
  }

  return lines.join(' ');
}

// ─── HOOK INTO SYSTEM PROMPT ─────────────────────────────
// Called from dialogue.js buildNPCPrompt — appends rep context
function getReputationPromptBlock(npc) {
  const greeting = getRepGreeting(npc);
  const optCtx   = getRepOptionContext(npc);
  const score    = getRepScore(npc.faction);
  const tier     = getRepTier(npc.faction);
  const fac      = FACTIONS[npc.faction];

  if (!fac) return '';

  return `
REPUTATION WITH ${fac.name.toUpperCase()}: ${score} (${tier.label} — ${tier.icon})
${greeting}
${optCtx}`.trim();
}

// ─── REP EVENTS — things that shift faction standing ─────
// Called from combat, dialogue writeback, travel events etc.

// Player kills a Watch member → Watch hates you, underworld likes you
function onKillCityGuard() {
  changeRep('city_watch',  -25, 'killed a City Guard');
  changeRep('underworld',  +8,  'proved willing to act against the Watch');
  changeRep('citizens',    -5,  'killed in the streets');
}

// Player kills a Church member
function onKillChurchMember() {
  changeRep('church',      -30, 'killed a Church servant');
  changeRep('citizens',    -8,  'sacrilege witnessed');
  changeRep('underworld',  +5,  'enemy of the Church is a friend of the shadows');
}

// Player helps a citizen in distress
function onHelpCitizen() {
  changeRep('citizens',    +12, 'helped someone who needed it');
  changeRep('city_watch',  +5,  'acted in the city\'s interest');
}

// Player robs or harms a citizen
function onHarmCitizen() {
  changeRep('citizens',    -15, 'preyed on the innocent');
  changeRep('city_watch',  -10, 'criminal act in Vaelthar');
}

// Player completes a Watch quest or helps Rhael
function onHelpWatch() {
  changeRep('city_watch',  +15, 'aided the Watch');
  changeRep('church',      -5,  'the Church notes your alignment');
}

// Player completes a Church quest or helps Mourne
function onHelpChurch() {
  changeRep('church',      +15, 'aided the Church of the Eternal Flame');
  changeRep('city_watch',  -5,  'the Watch notes your Church ties');
}

// Player exposes Varek / the Church conspiracy
function onExposeChurch() {
  changeRep('church',      -40, 'exposed the Church\'s crime');
  changeRep('city_watch',  +20, 'gave the Watch what they needed');
  changeRep('citizens',    +20, 'told the truth to the city');
}

// Player buys/sells with underworld merchants
function onUnderworldTransaction() {
  changeRep('underworld',  +5, 'did business in the shadows');
}

// Player turns someone in to the Watch
function onInformToWatch() {
  changeRep('city_watch',  +10, 'provided actionable intelligence');
  changeRep('underworld',  -15, 'known informant');
  changeRep('citizens',    -5,  'word spreads');
}

// Player bribes a guard
function onBribeGuard() {
  changeRep('city_watch',  -8, 'corrupting a Watch officer');
  changeRep('underworld',  +3, 'knows how things work');
}

// ─── AUTO-DETECT REP EVENTS FROM COMBAT ─────────────────
// Hook into endCombat to auto-fire rep changes based on who died
function _hookCombatForRep() {
  const _origEnd = window.endCombat;
  if (!_origEnd) { setTimeout(_hookCombatForRep, 600); return; }

  window.endCombat = function(victory) {
    if (victory && window.combatState) {
      const defeated = Object.values(window.combatState.combatants || {})
        .filter(c => !c.isPlayer && (c.hp <= 0 || window.combatState.defeatedIds?.includes(c.id)));

      defeated.forEach(c => {
        const id = (c.id || '').toLowerCase();
        if (id.includes('guard') || id.includes('rhael') || id === 'captain') {
          onKillCityGuard();
        } else if (id.includes('mourne') || id.includes('church') || id.includes('cultist') || id.includes('priest')) {
          onKillChurchMember();
        } else if (id.includes('bandit') || id.includes('thief')) {
          changeRep('citizens', -3, 'violence in the city');
          changeRep('underworld', +3, 'demonstrated capability');
        }
      });
    }
    _origEnd(victory);
  };
}

// ─── AUTO-DETECT REP EVENTS FROM CONVERSATION ────────────
// Called from _updateWorldFromConversation
function updateRepFromConversation(npcId, speech, flags) {
  const lower = speech.toLowerCase();

  // Player persuaded Watch successfully
  if ((npcId === 'captain_rhael' || npcId === 'vaelthar_guard') && flags['talked_to_captain_rhael']) {
    if (!window._repGiven_watchConv) {
      changeRep('city_watch', +5, 'productive conversation with the Watch');
      window._repGiven_watchConv = true;
    }
  }
  // Player got the document from the Scribe
  if (npcId === 'trembling_scribe' && lower.includes('document')) {
    if (!window._repGiven_scribeDoc) {
      changeRep('church', -10, 'obtained the compromising document');
      changeRep('city_watch', +8, 'uncovering the truth');
      window._repGiven_scribeDoc = true;
    }
  }
  // Player was kind to Mourne (allied)
  if (npcId === 'sister_mourne' && flags['allied_sister_mourne']) {
    if (!window._repGiven_mourneAllied) {
      changeRep('church', +10, 'earned Sister Mourne\'s trust');
      window._repGiven_mourneAllied = true;
    }
  }
}

// ─── REPUTATION HUD ─────────────────────────────────────
function openRepPanel() {
  document.getElementById('rep-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'rep-panel';
  panel.className = 'rep-panel';

  const rows = Object.entries(FACTIONS).map(([id, fac]) => {
    const score = getRepScore(id);
    const tier  = getRepTier(id);
    const pct   = ((score + 100) / 200 * 100).toFixed(1);
    const barColor = tier.color;
    return `
      <div class="rep-row">
        <div class="rep-row-header">
          <span class="rep-fac-icon">${fac.icon}</span>
          <span class="rep-fac-name">${fac.name}</span>
          <span class="rep-tier" style="color:${tier.color}">${tier.icon} ${tier.label}</span>
          <span class="rep-score" style="color:${score >= 0 ? '#80c080' : '#c08080'}">${score > 0 ? '+' : ''}${score}</span>
        </div>
        <div class="rep-bar-wrap">
          <div class="rep-bar" style="width:${pct}%;background:${barColor}"></div>
          <div class="rep-bar-zero"></div>
        </div>
        <div class="rep-fac-desc">${fac.desc}</div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="rep-inner">
      <div class="rep-header">
        <span class="rep-title">◆ Reputation</span>
        <button class="rep-close" onclick="document.getElementById('rep-panel').remove()">✕</button>
      </div>
      <div class="rep-rows">${rows}</div>
    </div>`;

  const gameLog = document.getElementById('game-log');
  if (gameLog) { gameLog.appendChild(panel); setTimeout(() => panel.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50); }
  else document.body.appendChild(panel);
  requestAnimationFrame(() => panel.style.opacity = '1');
}

function _updateRepHUD() {
  // Update the small rep badge in the sidebar if it exists
  const badge = document.getElementById('rep-hud-badge');
  if (!badge) return;
  const watchTier = getRepTier('city_watch');
  const churchTier = getRepTier('church');
  badge.innerHTML = `${watchTier.icon} ${churchTier.icon}`;
}

// ─── INJECT REP BUTTON INTO QUICK ACTIONS ───────────────
function _injectRepButton() {
  const qa = document.querySelector('.quick-actions');
  if (!qa || document.getElementById('rep-qa-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'rep-qa-btn';
  btn.className = 'qa-btn';
  btn.style.cssText = 'border-color:rgba(180,140,60,0.4);color:#b89040';
  btn.textContent = '◆ Rep';
  btn.onclick = openRepPanel;
  const campBtn = document.getElementById('camp-qa-btn');
  if (campBtn) campBtn.insertAdjacentElement('afterend', btn);
  else qa.appendChild(btn);
}

// ─── CSS ─────────────────────────────────────────────────
(function injectRepCSS() {
  const s = document.createElement('style');
  s.textContent = `
  .rep-panel {
    background: linear-gradient(180deg, rgba(6,4,2,0.99) 0%, rgba(10,8,4,0.99) 100%);
    border: 1px solid rgba(201,168,76,0.2);
    border-top: 2px solid rgba(201,168,76,0.4);
    margin: 8px 0;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .rep-inner { padding: 18px 22px 16px; }
  .rep-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding-bottom:10px; border-bottom:1px solid rgba(201,168,76,0.12); }
  .rep-title { font-family:'Cinzel',serif; color:var(--gold,#c9a84c); font-size:0.9rem; letter-spacing:.06em; }
  .rep-close { background:none; border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.3); padding:3px 10px; cursor:pointer; font-size:0.72rem; }
  .rep-close:hover { color:rgba(255,255,255,0.6); }

  .rep-rows { display:flex; flex-direction:column; gap:14px; }
  .rep-row { }
  .rep-row-header { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
  .rep-fac-icon { font-size:16px; width:22px; text-align:center; }
  .rep-fac-name { font-family:'Cinzel',serif; font-size:0.75rem; color:rgba(255,255,255,0.75); flex:1; }
  .rep-tier { font-size:0.67rem; }
  .rep-score { font-family:'Cinzel',serif; font-size:0.75rem; min-width:36px; text-align:right; }
  .rep-bar-wrap { position:relative; height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:visible; margin-bottom:4px; }
  .rep-bar { height:100%; border-radius:3px; transition:width 0.6s ease; min-width:2px; }
  .rep-bar-zero { position:absolute; left:50%; top:-2px; width:1px; height:9px; background:rgba(255,255,255,0.15); }
  .rep-fac-desc { font-size:0.62rem; color:rgba(255,255,255,0.25); font-style:italic; line-height:1.5; }
  `;
  s.textContent += `
  /* Rep inline in conv panel header */
  .cp-rep-badge {
    font-size: 0.62rem;
    padding: 2px 7px;
    border-radius: 2px;
    border: 1px solid currentColor;
    opacity: 0.7;
    margin-top: 2px;
    display: inline-block;
  }
  `;
  document.head.appendChild(s);
})();

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { _injectRepButton(); _hookCombatForRep(); }, 1000);
});

const _repOrigShowScreen = window.showScreen;
if (_repOrigShowScreen) {
  window.showScreen = function(name) {
    _repOrigShowScreen(name);
    if (name === 'game') setTimeout(() => { _injectRepButton(); _hookCombatForRep(); }, 600);
  };
}

// Expose globally
window.changeRep         = changeRep;
window.getRepScore       = getRepScore;
window.getRepTier        = getRepTier;
window.getReputationPromptBlock = getReputationPromptBlock;
window.updateRepFromConversation = updateRepFromConversation;
window.onHelpCitizen     = onHelpCitizen;
window.onHarmCitizen     = onHarmCitizen;
window.onHelpWatch       = onHelpWatch;
window.onHelpChurch      = onHelpChurch;
window.onExposeChurch    = onExposeChurch;
window.onBribeGuard      = onBribeGuard;
window.onInformToWatch   = onInformToWatch;
window.onUnderworldTransaction = onUnderworldTransaction;

console.log('◆ Reputation system loaded.');
