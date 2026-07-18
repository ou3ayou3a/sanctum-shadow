console.log('Starting Sanctum & Shadow server...');
const express = require('express');
console.log('express loaded');
const path = require('path');
const https = require('https');
const http = require('http');
console.log('Loading socket.io...');
const { Server } = require('socket.io');
console.log('socket.io loaded');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'site')));

// ─── DEBUG ENDPOINT ───────────────────────────
// Gated: only responds if DEBUG_KEY env var is set AND matches ?key= query param.
app.get('/debug', (req, res) => {
  const debugKey = process.env.DEBUG_KEY;
  if (!debugKey || req.query.key !== debugKey) { res.status(404).end(); return; }
  res.json({
    status: 'online',
    socketio: 'loaded',
    sessions: Object.keys(sessions).map(code => ({
      code,
      players: Object.values(sessions[code].players).map(p => ({ name: p.name, connected: p.connected })),
      state: sessions[code].state,
    })),
    uptime: Math.floor(process.uptime()) + 's',
    time: new Date().toISOString(),
  });
});

// ─── ANTHROPIC PROXY ─────────────────────────
// NOTE: This is a local-game proxy. Full auth (per-user tokens) is out of scope;
// hardening below limits abuse: model allowlist, capped tokens/messages,
// upstream status forwarding, and a request timeout.
const ALLOWED_MODELS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022',
  'claude-sonnet-4-5-20250929',
]);
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_CAP = 1024;
const MAX_MESSAGES = 40;
const NPC_TIMEOUT_MS = 60000;

app.post('/api/npc', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

  const reqBody = (req.body && typeof req.body === 'object') ? req.body : {};
  const model = ALLOWED_MODELS.has(reqBody.model) ? reqBody.model : DEFAULT_MODEL;
  let maxTokens = parseInt(reqBody.max_tokens, 10);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = 600;
  maxTokens = Math.min(maxTokens, MAX_TOKENS_CAP);
  let messages = Array.isArray(reqBody.messages) ? reqBody.messages : [];
  if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
  const system = typeof reqBody.system === 'string' ? reqBody.system : '';

  const body = JSON.stringify({ model, max_tokens: maxTokens, system, messages });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  let settled = false;
  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      if (settled) return;
      settled = true;
      // Forward the upstream HTTP status code instead of always 200.
      const status = response.statusCode || 502;
      try { res.status(status).json(JSON.parse(data)); }
      catch (e) { res.status(502).json({ error: 'Invalid response from Anthropic' }); }
    });
  });
  request.setTimeout(NPC_TIMEOUT_MS, () => {
    if (settled) return;
    settled = true;
    request.destroy();
    res.status(504).json({ error: 'Upstream request timed out' });
  });
  request.on('error', err => {
    if (settled) return;
    settled = true;
    res.status(502).json({ error: err.message });
  });
  request.write(body);
  request.end();
});

// ─── SESSION STORE (in-memory) ───────────────
// sessions[code] = { code, name, host, players:{id:{name,character,hp,ready}}, combatState, log:[], chatLog:[] }
const sessions = {};

function getSession(code) { return sessions[code] || null; }

function broadcastSession(code) {
  const s = getSession(code);
  if (s) io.to(code).emit('session_update', s);
}

// ─── HARDENING HELPERS ───────────────────────
const LOG_CAP = 200;

// server.js runs in Node — no window/escapeHtml here. Sanitize names on entry:
// strip angle brackets and cap length.
function sanitizeName(name) {
  if (typeof name !== 'string') return 'Unknown';
  const clean = name.replace(/[<>]/g, '').trim().slice(0, 40);
  return clean || 'Unknown';
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>]/g, '').slice(0, 2000);
}

// Cap an array to its last N entries in place.
function capLog(arr, cap = LOG_CAP) {
  if (Array.isArray(arr) && arr.length > cap) arr.splice(0, arr.length - cap);
}

// Generate a session code that is not already in use.
function genSessionCode() {
  const words = ['DOOM','FIRE','BONE','DARK','HOLY','VOID','IRON','RUIN','SOUL','FELL','GRIM','VEIL'];
  let code;
  do {
    code = words[Math.floor(Math.random()*words.length)] + '-' + Math.floor(1000+Math.random()*9000);
  } while (sessions[code]);
  return code;
}

// Count only live (connected) player keys.
function livePlayerCount(s) {
  return Object.values(s.players).filter(p => p && p.connected).length;
}

// Remove this socket from any previous session room/membership before (re)joining.
function leavePreviousSession(socket, exceptCode) {
  const prev = socket.sessionCode;
  if (!prev || prev === exceptCode) return;
  const ps = getSession(prev);
  if (ps && ps.players[socket.id]) {
    delete ps.players[socket.id];
    if (ps.host === socket.id) ps.host = null;
    broadcastSession(prev);
  }
  socket.leave(prev);
}

// Wrap a socket handler so ANY malformed payload (or thrown error) is logged
// instead of crashing the Node process. Also default-destructures the payload.
function safeHandler(name, fn) {
  return (payload) => {
    try {
      fn(payload && typeof payload === 'object' ? payload : {});
    } catch (err) {
      console.error(`[socket:${name}] handler error:`, err && err.message);
    }
  };
}

// ─── SOCKET.IO ───────────────────────────────
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // ── Create session ──
  socket.on('create_session', safeHandler('create_session', ({ sessionName, playerName, maxPlayers }) => {
    const name = sanitizeName(playerName);
    const code = genSessionCode(); // collision-free
    let cap = parseInt(maxPlayers, 10);
    if (!Number.isFinite(cap) || cap < 1) cap = 4;
    cap = Math.min(cap, 4);

    // Leave any previous session before creating a new one.
    leavePreviousSession(socket, code);

    sessions[code] = {
      code, name: sanitizeName(sessionName) || 'The Chronicle',
      host: socket.id, hostPlayerId: name, maxPlayers: cap,
      players: {
        [socket.id]: { id: socket.id, name, character: null, hp: null, maxHp: null, ready: false, connected: true }
      },
      combatState: null, log: [], chatLog: [], state: 'waiting'
    };

    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = name;
    socket.emit('session_created', { code, playerId: socket.id });
    broadcastSession(code);
    console.log(`Session created: ${code} by ${name}`);
  }));

  // ── Join session ──
  socket.on('join_session', safeHandler('join_session', ({ code, playerName }) => {
    if (typeof code !== 'string') { socket.emit('join_error', { msg: 'Invalid session code.' }); return; }
    const s = getSession(code);
    if (!s) { socket.emit('join_error', { msg: `Session "${code}" not found. Check the code or ask the host to recreate it.` }); return; }
    if (livePlayerCount(s) >= s.maxPlayers) { socket.emit('join_error', { msg: 'Session is full.' }); return; }
    const name = sanitizeName(playerName);

    // Leave any previous session room/membership before joining this one.
    leavePreviousSession(socket, code);

    s.players[socket.id] = { id: socket.id, name, character: null, hp: null, maxHp: null, ready: false, connected: true };
    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = name;

    socket.emit('session_joined', { code, playerId: socket.id, session: s, isHost: s.host === socket.id });
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${name} joined the party.` });
    console.log(`${name} joined ${code}`);
  }));

  // ── Rejoin after disconnect ──
  socket.on('rejoin_session', safeHandler('rejoin_session', ({ code, playerName, character }) => {
    if (typeof code !== 'string') { socket.emit('join_error', { msg: 'Invalid session code.' }); return; }
    const s = getSession(code);
    if (!s) { socket.emit('join_error', { msg: `Session "${code}" expired. Ask host to start a new one.` }); return; }
    const name = sanitizeName(playerName);

    // Leave any stale previous session room/membership first.
    leavePreviousSession(socket, code);

    // Find the existing entry (keyed by the OLD socket id) for this player name.
    const oldId = Object.keys(s.players).find(id => s.players[id] && s.players[id].name === name);
    if (oldId) {
      const existing = s.players[oldId];
      // Re-key the player to the new socket id, then DELETE the old key (no ghosts).
      existing.id = socket.id;
      existing.connected = true;
      s.players[socket.id] = existing;
      if (oldId !== socket.id) delete s.players[oldId];
    } else {
      const c = (character && typeof character === 'object') ? character : null;
      s.players[socket.id] = { id: socket.id, name, character: c, hp: c?.hp ?? null, maxHp: c?.maxHp ?? null, ready: !!c, connected: true };
    }

    // ── Host migration (#58) ── track host by stable name token, not socket id.
    if (s.hostPlayerId === name || s.host === oldId || s.host == null) {
      s.host = socket.id;
      if (!s.hostPlayerId) s.hostPlayerId = name;
    }

    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = name;
    socket.emit('session_joined', { code, playerId: socket.id, session: s, isHost: s.host === socket.id });
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${name} reconnected.` });
  }));

  // ── Character ready ──
  socket.on('character_ready', safeHandler('character_ready', ({ code, character }) => {
    const s = getSession(code);
    if (!s || !s.players[socket.id]) return;
    if (!character || typeof character !== 'object') return;

    // Clamp client-supplied data to sane ranges (#66).
    const clamp = (v, lo, hi, def) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
    };
    if (character.stats && typeof character.stats === 'object') {
      for (const k of Object.keys(character.stats)) {
        character.stats[k] = clamp(character.stats[k], 1, 30, 10);
      }
    }
    character.maxHp = clamp(character.maxHp, 1, 500, 100);
    character.hp = clamp(character.hp, 1, character.maxHp, character.maxHp);
    character.maxMp = clamp(character.maxMp, 1, 500, 100);
    character.mp = clamp(character.mp, 0, character.maxMp, character.maxMp);
    character.name = sanitizeName(character.name);
    character.class = typeof character.class === 'string' ? character.class.replace(/[<>]/g, '').slice(0, 40) : '';

    s.players[socket.id].character = character;
    s.players[socket.id].hp = character.hp;
    s.players[socket.id].maxHp = character.maxHp;
    s.players[socket.id].ready = true;
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${s.players[socket.id].name} is ready as ${character.name} the ${character.class}!` });
  }));

  // ── Start combat (any player can trigger) ──
  socket.on('start_combat', safeHandler('start_combat', ({ code, enemies, initiatorId }) => {
    const s = getSession(code);
    if (!s) return;
    // Don't restart if already in combat
    if (s.combatState?.active) return;

    // Validate/clamp the enemies array shape (#66).
    if (!Array.isArray(enemies) || enemies.length === 0) return;
    enemies = enemies.filter(e => e && typeof e === 'object').slice(0, 8);
    if (enemies.length === 0) return;
    enemies.forEach(e => {
      const hp = Number(e.hp);
      e.hp = Number.isFinite(hp) ? Math.max(1, Math.min(1000, hp)) : 10;
      const maxHp = Number(e.maxHp);
      e.maxHp = Number.isFinite(maxHp) ? Math.max(e.hp, Math.min(1000, maxHp)) : e.hp;
      e.name = sanitizeName(e.name);
    });

    // Build full combatant list: all players + enemies
    const combatants = {};
    const turnOrder = [];

    Object.entries(s.players).forEach(([pid, p]) => {
      if (!p.character || !p.connected) return;
      const char = p.character;
      const dexMod = Math.floor(((char.stats?.dex||10)-10)/2);
      const initiative = Math.floor(Math.random()*20)+1+dexMod;
      combatants[pid] = {
        id: pid, name: char.name, playerId: pid,
        hp: p.hp || char.hp, maxHp: char.maxHp,
        mp: char.mp || 100, maxMp: char.maxMp || 100,
        ac: 10+dexMod, atk: Math.floor(((char.stats?.str||10)-10)/2),
        type: 'player', isPlayer: true, boss: false,
        spells: char.spells || [], level: char.level || 1,
        icon: '⚔', initiative,
        statMods: {
          str: Math.floor(((char.stats?.str||10)-10)/2),
          dex: dexMod,
          wis: Math.floor(((char.stats?.wis||10)-10)/2),
          int: Math.floor(((char.stats?.int||10)-10)/2),
        }
      };
      turnOrder.push({ id: pid, initiative });
    });

    enemies.forEach((e, i) => {
      const eid = 'enemy_' + i + '_' + Date.now();
      const initiative = Math.floor(Math.random()*20)+1+(e.dex||0);
      combatants[eid] = { ...e, id: eid, type: 'enemy', isPlayer: false, ap: 3, initiative };
      turnOrder.push({ id: eid, initiative });
    });

    turnOrder.sort((a,b) => b.initiative - a.initiative);

    s.combatState = {
      active: true, round: 1,
      combatants,
      turnOrder: turnOrder.map(t => t.id),
      currentTurnIndex: 0,
      apRemaining: 3,
      _enemyTurnSeq: 0,        // increments per enemy turn (keyed dedupe)
      _enemyTurnProcessed: -1, // last seq the server has resolved
    };
    s.state = 'combat';

    io.to(code).emit('combat_started', s.combatState);
    broadcastSession(code);
  }));

  // ── Combat action ──
  socket.on('combat_action', safeHandler('combat_action', ({ code, action, targetId, spellId }) => {
    const s = getSession(code);
    if (!s || !s.combatState) return;

    const cs = s.combatState;
    const currentId = cs.turnOrder[cs.currentTurnIndex];

    // Must be this player's turn
    if (currentId !== socket.id) {
      socket.emit('error', { msg: 'Not your turn!' }); return;
    }

    const actor = cs.combatants[currentId];
    if (!actor) return;
    let logEntry = null;
    let stateSync = null; // {playerId, inventory, gold} broadcast for item use

    if (action === 'attack') {
      const target = cs.combatants[targetId];
      if (!target || typeof target.hp !== 'number' || target.hp <= 0) return;
      const roll = Math.floor(Math.random()*20)+1;
      const crit = roll === 20;
      const hit = roll + (actor.atk||0) >= (target.ac||10) || crit;
      if (hit) {
        let dmg = Math.floor(Math.random()*8)+1+(actor.atk||0);
        if (crit) dmg *= 2;
        target.hp = Math.max(0, target.hp - dmg);
        logEntry = { type: 'combat', text: `⚔ ${crit ? 'CRITICAL HIT' : 'HIT'} — ${actor.name} attacks ${target.name}! [${roll}] — ${dmg} damage!` };
        // Sync HP back if target is a player
        if (target.isPlayer && s.players[target.playerId]) {
          s.players[target.playerId].hp = target.hp;
        }
      } else {
        logEntry = { type: 'system', text: `⚔ MISS — ${actor.name} misses ${target.name}! [${roll}]` };
      }
      cs.apRemaining--;

    } else if (action === 'spell') {
      const spell = actor.spells?.find(sp => sp && sp.id === spellId);
      const target = cs.combatants[targetId];
      if (!spell || !target) return;
      const spMp = Number(spell.mp) || 0, spAp = Number(spell.ap) || 1;
      if ((actor.mp||0) < spMp || cs.apRemaining < spAp) return;
      actor.mp = (actor.mp||0) - spMp;
      cs.apRemaining -= spAp;
      // Validate dice formulas before rolling (#66).
      const dmg = isValidFormula(spell.damage) ? rollDiceServer(spell.damage, actor.statMods) : 0;
      if (spell.type === 'heal') {
        const healAmt = isValidFormula(spell.heal) ? rollDiceServer(spell.heal, actor.statMods) : 0;
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        if (actor.isPlayer && s.players[actor.playerId]) s.players[actor.playerId].hp = actor.hp;
        logEntry = { type: 'holy', text: `${spell.icon} ${actor.name} casts ${spell.name} — healed ${healAmt} HP!` };
      } else {
        target.hp = Math.max(0, target.hp - dmg);
        if (target.isPlayer && s.players[target.playerId]) s.players[target.playerId].hp = target.hp;
        logEntry = { type: 'combat', text: `${spell.icon} ${actor.name} casts ${spell.name} on ${target.name} — HIT — ${dmg} damage!` };
      }

    } else if (action === 'move') {
      // Reposition — costs 1 AP, no other effect (#63: route MOVE through server).
      if (cs.apRemaining < 1) return;
      cs.apRemaining--;
      logEntry = { type: 'system', text: `🏃 ${actor.name} repositions on the battlefield.` };

    } else if (action === 'item') {
      // Use a consumable — server applies AP cost + effect authoritatively (#63).
      if (cs.apRemaining < 1) return;
      const p = s.players[actor.playerId];
      const char = p && p.character;
      const inv = (char && Array.isArray(char.inventory)) ? char.inventory : [];
      // Pick the named item or the first potion-like item.
      let itemName = (typeof targetId === 'string' && inv.includes(targetId)) ? targetId
        : inv.find(i => typeof i === 'string' && i.toLowerCase().includes('potion'));
      if (!itemName) { socket.emit('error', { msg: 'No usable item!' }); return; }
      const healAmt = 30;
      actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
      char.hp = actor.hp;
      char.inventory = inv.filter(i => i !== itemName);
      if (p) p.hp = actor.hp;
      cs.apRemaining--;
      logEntry = { type: 'holy', text: `🎒 ${actor.name} uses ${itemName} — restored ${healAmt} HP!` };
      stateSync = { playerId: actor.playerId, inventory: char.inventory, gold: char.gold, hp: char.hp };

    } else if (action === 'end_turn') {
      cs.apRemaining = 0;
    }

    if (logEntry) { s.log.push(logEntry); capLog(s.log); }
    if (stateSync) io.to(code).emit('player_state', stateSync);

    // Check combat end
    const players = Object.values(cs.combatants).filter(c => c.isPlayer && c.hp > 0);
    const enemies = Object.values(cs.combatants).filter(c => !c.isPlayer && c.hp > 0);

    if (players.length === 0) {
      cs.active = false; s.state = 'waiting';
      io.to(code).emit('combat_ended', { victory: false, combatState: cs });
      broadcastSession(code);
      return;
    }
    if (enemies.length === 0) {
      cs.active = false; s.state = 'waiting';
      // Calculate XP
      const xp = Object.values(cs.combatants).filter(c=>!c.isPlayer).reduce((a,c)=>a+(c.xp||50),0);
      io.to(code).emit('combat_ended', { victory: true, xp, combatState: cs });
      broadcastSession(code);
      return;
    }

    // Advance turn if AP is 0 or end_turn
    if (cs.apRemaining <= 0 || action === 'end_turn') {
      advanceTurnServer(s);
    }

    io.to(code).emit('combat_update', { combatState: cs, log: logEntry });
  }));

  // ── Enemy AI turn (any connected player may signal; server resolves once) ──
  socket.on('enemy_turn', safeHandler('enemy_turn', ({ code, seq }) => {
    const s = getSession(code);
    if (!s || !s.combatState) return;
    processEnemyTurn(s, typeof seq === 'number' ? seq : s.combatState._enemyTurnSeq);
  }));

  // ── Start game (host only) ──
  socket.on('start_game', safeHandler('start_game', ({ code }) => {
    const s = getSession(code);
    if (!s) return;
    if (s.host !== socket.id) { socket.emit('join_error', { msg: 'Only the host can start the game.' }); return; }
    s.state = 'playing';
    io.to(code).emit('game_started', { code });
    console.log(`Game started for session ${code}`);
  }));

  // ── Story event broadcast ──
  socket.on('story_event', safeHandler('story_event', ({ code, eventType, payload }) => {
    const s = getSession(code);
    if (!s) return;
    if (typeof eventType !== 'string') return;
    const player = s.players[socket.id];
    socket.to(code).emit('story_event', { eventType, payload, fromPlayer: player?.name || 'Unknown' });
  }));

  // ── Chat ──
  socket.on('chat', safeHandler('chat', ({ code, text }) => {
    const s = getSession(code);
    if (!s) return;
    const player = s.players[socket.id];
    const msg = { from: player?.name || 'Unknown', text: sanitizeText(text), ts: Date.now() };
    s.chatLog.push(msg);
    capLog(s.chatLog);
    io.to(code).emit('chat_message', msg);
  }));

  // ── Game log broadcast ──
  socket.on('game_log', safeHandler('game_log', ({ code, entry }) => {
    const s = getSession(code);
    if (!s) return;
    if (!entry || typeof entry !== 'object') return;
    if (typeof entry.text === 'string') entry.text = sanitizeText(entry.text);
    s.log.push(entry);
    capLog(s.log);
    socket.to(code).emit('game_log', entry); // broadcast to OTHERS only
  }));

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const code = socket.sessionCode;
    if (!code) return;
    const s = getSession(code);
    if (!s) return;
    if (s.players[socket.id]) {
      s.players[socket.id].connected = false;
      io.to(code).emit('chat_message', { system: true, text: `${s.players[socket.id].name} disconnected. Waiting for reconnect...` });
      // If the host dropped, migrate host to a still-connected player so the
      // session isn't bricked (rejoin re-claims it via hostPlayerId).
      if (s.host === socket.id) {
        const heir = Object.values(s.players).find(p => p && p.connected);
        if (heir) {
          s.host = heir.id;
          io.to(heir.id).emit('host_migrated', { isHost: true });
        }
      }
      broadcastSession(code);
    }
    // Give players 5 minutes to reconnect before cleaning up the session
    setTimeout(() => {
      const sess = getSession(code);
      if (!sess) return;
      const connected = Object.values(sess.players).filter(p => p.connected);
      if (connected.length === 0) {
        delete sessions[code];
        console.log(`Session ${code} cleaned up after grace period.`);
      }
    }, 5 * 60 * 1000); // 5 minute grace period
  });
});

// ─── SERVER HELPERS ──────────────────────────
const ENEMY_TURN_FALLBACK_MS = 4000;

function advanceTurnServer(s) {
  const cs = s.combatState;
  if (!cs || !Array.isArray(cs.turnOrder) || cs.turnOrder.length === 0) return;
  let attempts = 0;
  do {
    cs.currentTurnIndex = (cs.currentTurnIndex + 1) % cs.turnOrder.length;
    if (cs.currentTurnIndex === 0) cs.round++;
    attempts++;
  } while (cs.combatants[cs.turnOrder[cs.currentTurnIndex]]?.hp <= 0 && attempts < cs.turnOrder.length);
  cs.apRemaining = 3;

  const next = cs.combatants[cs.turnOrder[cs.currentTurnIndex]];
  if (next && !next.isPlayer) {
    // New enemy turn → bump the sequence so each enemy turn is tracked
    // independently (#11: no more timing-based dropped turns).
    cs._enemyTurnSeq = (cs._enemyTurnSeq || 0) + 1;
    const thisSeq = cs._enemyTurnSeq;
    // Signal clients to trigger enemy AI for THIS specific seq.
    io.to(s.code).emit('enemy_turn_start', { enemyId: next.id, enemy: next, seq: thisSeq });
    // Fallback: if no client resolves this enemy turn in time, the server
    // resolves it itself so combat never deadlocks.
    setTimeout(() => {
      const sess = getSession(s.code);
      if (!sess || !sess.combatState || !sess.combatState.active) return;
      if (sess.combatState._enemyTurnProcessed < thisSeq && sess.combatState._enemyTurnSeq === thisSeq) {
        processEnemyTurn(sess, thisSeq);
      }
    }, ENEMY_TURN_FALLBACK_MS);
  } else if (next) {
    io.to(s.code).emit('player_turn_start', { playerId: next.id, playerName: next.name });
  }
}

// Resolve a single enemy turn exactly once, keyed by sequence number.
function processEnemyTurn(s, seq) {
  const cs = s.combatState;
  if (!cs || !cs.active) return;
  // Dedupe by sequence: skip if this enemy turn was already processed, or if
  // the request is for a stale/future seq.
  if (typeof seq === 'number' && seq !== cs._enemyTurnSeq) return;
  if (cs._enemyTurnProcessed >= cs._enemyTurnSeq) return;
  cs._enemyTurnProcessed = cs._enemyTurnSeq;

  const currentId = cs.turnOrder[cs.currentTurnIndex];
  const enemy = cs.combatants[currentId];
  if (!enemy || enemy.isPlayer) return;

  const playerTargets = Object.values(cs.combatants).filter(c => c.isPlayer && c.hp > 0);
  if (playerTargets.length === 0) return;
  const target = playerTargets[Math.floor(Math.random()*playerTargets.length)];

  const roll = Math.floor(Math.random()*20)+1;
  const crit = roll === 20;
  let logEntry;
  if (roll + (enemy.atk||0) >= (target.ac||12) || crit) {
    let dmg = Math.floor(Math.random()*8)+1+(enemy.atk||0);
    if (crit) dmg *= 2;
    target.hp = Math.max(0, target.hp - dmg);
    if (s.players[target.playerId]) s.players[target.playerId].hp = target.hp;
    logEntry = { type: 'combat', text: `${enemy.icon} ${crit ? 'CRITICAL HIT' : 'HIT'} — ${enemy.name} attacks ${target.name}! [${roll}] — ${dmg} damage!` };
  } else {
    logEntry = { type: 'system', text: `${enemy.icon} MISS — ${enemy.name} misses ${target.name}! [${roll}]` };
  }
  s.log.push(logEntry);
  capLog(s.log);

  const players = Object.values(cs.combatants).filter(c => c.isPlayer && c.hp > 0);
  if (players.length === 0) {
    cs.active = false; s.state = 'waiting';
    io.to(s.code).emit('combat_ended', { victory: false, combatState: cs });
    broadcastSession(s.code); return;
  }

  advanceTurnServer(s);
  io.to(s.code).emit('combat_update', { combatState: cs, log: logEntry });
}

// Validate a dice formula before evaluating it server-side (#66).
// Base shape per audit: NdM with an optional +/-K modifier. We additionally
// permit a single +STAT suffix (e.g. "2d6+WIS") since rollDiceServer supports
// stat tokens and legitimate spell formulas rely on it; anything else (free
// text, multipliers, multiple dice groups) is rejected.
function isValidFormula(formula) {
  if (typeof formula !== 'string') return false;
  const f = formula.trim();
  if (/^\d{1,2}d\d{1,3}([+-]\d{1,3})?$/.test(f)) return true;       // 2d8, 2d8+3
  if (/^\d{1,2}d\d{1,3}\+(STR|DEX|CON|INT|WIS|CHA)$/i.test(f)) return true; // 2d8+WIS
  if (/^\d{1,3}$/.test(f)) return true;                              // flat number, e.g. '1'
  return false;
}

function rollDiceServer(formula, statMods) {
  if (!formula) return 0;
  const parts = (formula + '').split('+');
  let total = 0;
  parts.forEach(p => {
    p = p.trim();
    if (p.match(/^\d+d\d+$/i)) {
      const [n, sides] = p.split('d').map(Number);
      for (let i = 0; i < n; i++) total += Math.floor(Math.random()*sides)+1;
    } else if (p.match(/^[A-Z]+$/i)) {
      const key = p.toLowerCase();
      total += statMods?.[key] || 0;
    } else { total += parseInt(p) || 0; }
  });
  return Math.max(1, total);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sanctum & Shadow running on port ${PORT}`);
});
