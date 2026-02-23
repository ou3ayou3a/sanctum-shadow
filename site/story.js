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
  // Remove old scene panel
  const old = document.getElementById('scene-panel');
  if (old) old.remove();

  const panel = document.createElement('div');
  panel.id = 'scene-panel';
  panel.className = 'scene-panel';

  const optionsHTML = (sceneData.options || []).map((opt, i) => `
    <button class="scene-option ${opt.type || ''}" onclick="chooseSceneOption(${i})">
      <span class="so-icon">${opt.icon || '▸'}</span>
      <span class="so-text">${opt.label}</span>
      ${opt.roll ? `<span class="so-roll">🎲 ${opt.roll.stat} DC${opt.roll.dc}</span>` : ''}
      ${opt.cost ? `<span class="so-cost">${opt.cost}</span>` : ''}
    </button>
  `).join('');

  panel.innerHTML = `
    <div class="sp-inner">
      <div class="sp-location-bar">
        <span class="sp-loc-icon">${sceneData.locationIcon || '🏰'}</span>
        <span class="sp-loc-name">${sceneData.location || 'Vaelthar'}</span>
        ${sceneData.threat ? `<span class="sp-threat">${sceneData.threat}</span>` : ''}
      </div>
      <div class="sp-narration" id="sp-narration"></div>
      <div class="sp-options" id="sp-options">${optionsHTML}</div>
      <div class="sp-free-action">
        <span class="sp-free-hint">Or type any action freely below ↓</span>
      </div>
    </div>
  `;

  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    gameLog.parentNode.insertBefore(panel, gameLog.nextSibling);
  } else {
    document.body.appendChild(panel);
  }

  window.sceneState._currentOptions = sceneData.options || [];
  window.sceneState._currentScene = sceneData;

  // Typewrite the narration
  typewriteScene(sceneData.narration, sceneData.sub);
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
  addLog('📖 ' + sceneData.narration, 'narrator');
  if (window.showDMStrip) showDMStrip(sceneData.narration, true);
}

function typewriteScene(text, sub) {
  const el = document.getElementById('sp-narration');
  if (!el) return;
  el.innerHTML = '';
  let i = 0;
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
  const option = window.sceneState._currentOptions[index];
  if (!option) return;
  const char = gameState.character;

  addLog(`${char?.name}: ${option.label}`, 'action', char?.name);

  if (option.roll) {
    const stat = option.roll.stat.toLowerCase();
    const statVal = char?.stats?.[stat] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const success = total >= option.roll.dc || roll === 20;
    const crit = roll === 20;
    const fumble = roll === 1;

    addLog(`🎲 ${option.roll.stat} check DC${option.roll.dc}: [${roll}] + ${mod >= 0 ? '+' : ''}${mod} = ${total} — ${crit ? 'CRITICAL SUCCESS!' : fumble ? 'CRITICAL FAILURE!' : success ? 'Success!' : 'Failure!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice();

    if (option.onSuccess && success) option.onSuccess(roll, total);
    else if (option.onFail && !success) option.onFail(roll, total);
    else if (success) {
      if (option.next) setTimeout(() => runScene(option.next), 600);
    } else {
      if (option.nextFail) setTimeout(() => runScene(option.nextFail), 600);
      else if (option.next) setTimeout(() => runScene(option.next + '_fail'), 600);
    }
  } else {
    if (option.action) option.action();
    else if (option.next) setTimeout(() => runScene(option.next), 400);
  }

  // Remove scene panel after choice
  setTimeout(() => {
    const panel = document.getElementById('scene-panel');
    if (panel) panel.style.opacity = '0';
    setTimeout(() => panel?.remove(), 400);
  }, 300);
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
        model: "claude-sonnet-4-20250514",
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
};

// ─── HOOK INTO GAME INIT ─────────────────────
function startStoryEngine() {
  // Small delay to let everything initialize
  setTimeout(() => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'system');
    runScene('arrival_vaelthar');
  }, 2000);
}

// Patch initGameScreen to start the story engine
const _origInitForStory = window.initGameScreen;
window.initGameScreen = function() {
  if (_origInitForStory) _origInitForStory();
  startStoryEngine();
};

// ─── SCENE CSS ────────────────────────────────
const sceneCSS = `
.scene-panel {
  margin: 8px 0;
  border: 1px solid rgba(201,168,76,0.35);
  border-left: 3px solid var(--gold);
  background: linear-gradient(135deg, rgba(12,8,4,0.97) 0%, rgba(8,5,2,0.99) 100%);
  animation: sceneFadeIn 0.4s ease;
}
@keyframes sceneFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.sp-inner { padding: 0; }
.sp-location-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  background: rgba(201,168,76,0.06);
  border-bottom: 1px solid rgba(201,168,76,0.12);
}
.sp-loc-icon { font-size: 1rem; }
.sp-loc-name { font-family:'Cinzel',serif; font-size:0.78rem; color:var(--gold); letter-spacing:0.1em; flex:1; }
.sp-threat { font-family:'Cinzel',serif; font-size:0.68rem; color:var(--hell); letter-spacing:0.08em; }
.sp-narration {
  padding: 14px 18px 8px 18px;
  font-family:'IM Fell English','Palatino',serif;
  font-size:0.9rem; line-height:1.7; color:var(--text-main);
  border-left: 2px solid rgba(201,168,76,0.15);
  margin: 0 12px;
}
.sp-sub {
  display: block; margin-top: 8px;
  font-size:0.8rem; color:var(--gold); font-style:italic;
  opacity:0.85;
}
.sp-options {
  display: flex; flex-direction: column; gap: 3px;
  padding: 8px 12px 10px 12px;
}
.scene-option {
  display: flex; align-items: center; gap: 10px;
  background: rgba(15,10,5,0.9);
  border: 1px solid rgba(201,168,76,0.12);
  color: var(--text-secondary);
  font-family:'Cinzel',serif; font-size:0.75rem;
  padding: 8px 14px; cursor: pointer;
  letter-spacing:0.04em; text-align:left;
  transition: all 0.15s;
}
.scene-option:hover { border-color:var(--gold); color:var(--gold); background:rgba(201,168,76,0.05); transform:translateX(2px); }
.scene-option.combat { border-color:rgba(192,57,43,0.2); }
.scene-option.combat:hover { border-color:var(--hell); color:var(--hell-glow); }
.scene-option.move { border-color:rgba(74,120,154,0.2); }
.so-icon { font-size:0.9rem; flex-shrink:0; }
.so-text { flex:1; }
.so-roll { font-size:0.68rem; color:var(--hell-glow); white-space:nowrap; opacity:0.8; }
.so-cost { font-size:0.68rem; color:var(--text-dim); white-space:nowrap; }
.sp-free-action { padding:4px 16px 10px; }
.sp-free-hint { font-size:0.68rem; color:var(--text-dim); font-style:italic; }
`;
const sceneStyle = document.createElement('style');
sceneStyle.id = 'scene-styles';
sceneStyle.textContent = sceneCSS;
document.head.appendChild(sceneStyle);

console.log('🎭 Story engine loaded. Scenes will guide the player through Vaelthar.');
