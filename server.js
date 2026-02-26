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
app.get('/debug', (req, res) => {
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
app.post('/api/npc', (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

  const body = JSON.stringify({
    model: req.body.model || 'claude-haiku-4-5-20251001',
    max_tokens: req.body.max_tokens || 600,
    system: req.body.system || '',
    messages: req.body.messages || [],
  });

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

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch (e) { res.status(500).json({ error: 'Invalid response from Anthropic' }); }
    });
  });
  request.on('error', err => res.status(500).json({ error: err.message }));
  request.write(body);
  request.end();
});

// ─── PORTRAIT PROXY (Google Gemini image generation) ───
app.post('/api/portrait', (req, res) => {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Portrait API key not configured.' });

  const prompt = req.body.prompt || 'dark fantasy RPG character portrait';

  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
  });

  const geminiOptions = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(geminiBody),
    },
  };

  const request = https.request(geminiOptions, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const parts = parsed.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find(p => p.inlineData);
        if (imgPart?.inlineData?.data) {
          const mimeType = imgPart.inlineData.mimeType || 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${imgPart.inlineData.data}`;
          res.json({ task_id: 'done', image_url: dataUrl });
        } else {
          console.error('Gemini portrait no image. Response:', JSON.stringify(parsed).substring(0, 400));
          res.status(500).json({ error: 'No image in response', detail: JSON.stringify(parsed).substring(0, 300) });
        }
      } catch (e) {
        res.status(500).json({ error: 'Parse error: ' + e.message });
      }
    });
  });
  request.on('error', err => res.status(500).json({ error: err.message }));
  request.write(geminiBody);
  request.end();
});

app.get('/api/portrait/status/:taskId', (req, res) => {
  res.json({ status: 'failed' });
});


// sessions[code] = { code, name, host, players:{id:{name,character,hp,ready}}, combatState, log:[], chatLog:[] }
const fs = require('fs');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

let sessions = {};

function loadSessionsFromDisk() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const data = JSON.parse(raw);
      // Only restore sessions created in the last 24 hours
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      Object.entries(data).forEach(([code, s]) => {
        if (s.createdAt && s.createdAt > cutoff) {
          // Mark all players as disconnected — they'll rejoin
          Object.values(s.players).forEach(p => { p.connected = false; });
          sessions[code] = s;
        }
      });
      console.log(`Restored ${Object.keys(sessions).length} sessions from disk.`);
    }
  } catch (e) {
    console.warn('Could not load sessions from disk:', e.message);
  }
}

function saveSessionsToDisk() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) {
    console.warn('Could not save sessions to disk:', e.message);
  }
}

// Save every 30 seconds
setInterval(saveSessionsToDisk, 30000);

// Load on startup
loadSessionsFromDisk();

function getSession(code) { return sessions[code] || null; }

function broadcastSession(code) {
  const s = getSession(code);
  if (s) io.to(code).emit('session_update', s);
}

// ─── SOCKET.IO ───────────────────────────────
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // ── Create session ──
  socket.on('create_session', ({ sessionName, playerName, maxPlayers }) => {
    const words = ['DOOM','FIRE','BONE','DARK','HOLY','VOID','IRON','RUIN','SOUL','FELL','GRIM','VEIL'];
    const code = words[Math.floor(Math.random()*words.length)] + '-' + Math.floor(1000+Math.random()*9000);

    sessions[code] = {
      code, name: sessionName || 'The Chronicle',
      host: socket.id, maxPlayers: maxPlayers || 4,
      players: {
        [socket.id]: { id: socket.id, name: playerName, character: null, hp: null, maxHp: null, ready: false, connected: true }
      },
      combatState: null, log: [], chatLog: [], state: 'waiting',
      createdAt: Date.now(),
    };

    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = playerName;
    socket.emit('session_created', { code, playerId: socket.id });
    broadcastSession(code);
    saveSessionsToDisk();
    console.log(`Session created: ${code} by ${playerName}`);
  });

  // ── Join session ──
  socket.on('join_session', ({ code, playerName }) => {
    const s = getSession(code);
    if (!s) { socket.emit('join_error', { msg: `Session "${code}" not found. Check the code or ask the host to recreate it.` }); return; }
    if (Object.keys(s.players).length >= s.maxPlayers) { socket.emit('join_error', { msg: 'Session is full.' }); return; }

    s.players[socket.id] = { id: socket.id, name: playerName, character: null, hp: null, maxHp: null, ready: false, connected: true };
    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = playerName;

    socket.emit('session_joined', { code, playerId: socket.id, session: s });
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${playerName} joined the party.` });
    console.log(`${playerName} joined ${code}`);
  });

  // ── Rejoin after disconnect ──
  socket.on('rejoin_session', ({ code, playerName, character }) => {
    const s = getSession(code);
    if (!s) { socket.emit('join_error', { msg: `Session "${code}" expired. Ask host to start a new one.` }); return; }
    // Update existing player entry or add new
    const existing = Object.values(s.players).find(p => p.name === playerName);
    if (existing) {
      existing.id = socket.id;
      existing.connected = true;
      s.players[socket.id] = existing;
    } else {
      s.players[socket.id] = { id: socket.id, name: playerName, character, hp: character?.hp, maxHp: character?.maxHp, ready: !!character, connected: true };
    }
    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = playerName;
    socket.emit('session_joined', { code, playerId: socket.id, session: s });
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${playerName} reconnected.` });
  });

  // ── Character ready ──
  socket.on('character_ready', ({ code, character }) => {
    const s = getSession(code);
    if (!s || !s.players[socket.id]) return;
    s.players[socket.id].character = character;
    s.players[socket.id].hp = character.hp;
    s.players[socket.id].maxHp = character.maxHp;
    s.players[socket.id].ready = true;
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${s.players[socket.id].name} is ready as ${character.name} the ${character.class}!` });
  });

  // ── Start combat (any player can trigger) ──
  socket.on('start_combat', ({ code, enemies, initiatorId }) => {
    const s = getSession(code);
    if (!s) return;
    // Don't restart if already in combat
    if (s.combatState?.active) return;

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
    };
    s.state = 'combat';

    io.to(code).emit('combat_started', s.combatState);
    broadcastSession(code);
  });

  // ── Combat action ──
  socket.on('combat_action', ({ code, action, targetId, spellId }) => {
    const s = getSession(code);
    if (!s || !s.combatState) return;

    const cs = s.combatState;
    const currentId = cs.turnOrder[cs.currentTurnIndex];

    // Must be this player's turn
    if (currentId !== socket.id) {
      socket.emit('error', { msg: 'Not your turn!' }); return;
    }

    const actor = cs.combatants[currentId];
    let logEntry = null;

    if (action === 'attack') {
      const target = cs.combatants[targetId];
      if (!target || target.hp <= 0) return;
      const roll = Math.floor(Math.random()*20)+1;
      const hit = roll + (actor.atk||0) >= target.ac || roll === 20;
      if (hit) {
        const dmg = Math.floor(Math.random()*8)+1+(actor.atk||0);
        target.hp = Math.max(0, target.hp - dmg);
        logEntry = { type: 'combat', text: `⚔ ${actor.name} attacks ${target.name}! [${roll}] — ${dmg} damage!` };
        // Sync HP back if target is a player
        if (target.isPlayer && s.players[target.playerId]) {
          s.players[target.playerId].hp = target.hp;
        }
      } else {
        logEntry = { type: 'system', text: `⚔ ${actor.name} misses ${target.name}! [${roll}]` };
      }
      cs.apRemaining--;

    } else if (action === 'spell') {
      const spell = actor.spells?.find(sp => sp.id === spellId);
      const target = cs.combatants[targetId];
      if (!spell || !target) return;
      if (actor.mp < spell.mp || cs.apRemaining < spell.ap) return;
      actor.mp -= spell.mp;
      cs.apRemaining -= spell.ap;
      const dmg = rollDiceServer(spell.damage, actor.statMods);
      if (spell.type === 'heal') {
        const healAmt = rollDiceServer(spell.heal, actor.statMods);
        actor.hp = Math.min(actor.maxHp, actor.hp + healAmt);
        if (actor.isPlayer && s.players[actor.playerId]) s.players[actor.playerId].hp = actor.hp;
        logEntry = { type: 'holy', text: `${spell.icon} ${actor.name} casts ${spell.name} — healed ${healAmt} HP!` };
      } else {
        target.hp = Math.max(0, target.hp - dmg);
        if (target.isPlayer && s.players[target.playerId]) s.players[target.playerId].hp = target.hp;
        logEntry = { type: 'combat', text: `${spell.icon} ${actor.name} casts ${spell.name} on ${target.name} — ${dmg} damage!` };
      }

    } else if (action === 'end_turn') {
      cs.apRemaining = 0;
    }

    if (logEntry) s.log.push(logEntry);

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
  });

  // ── Enemy AI turn (first connected player handles it) ──
  socket.on('enemy_turn', ({ code }) => {
    const s = getSession(code);
    if (!s || !s.combatState) return;
    // Dedup: only process once per round/turn using a flag
    if (s.combatState._processingEnemyTurn) return;
    s.combatState._processingEnemyTurn = true;
    setTimeout(() => { if (s.combatState) s.combatState._processingEnemyTurn = false; }, 2000);
    // Accept from any connected player (first one to respond wins)
    const cs = s.combatState;
    const currentId = cs.turnOrder[cs.currentTurnIndex];
    const enemy = cs.combatants[currentId];
    if (!enemy || enemy.isPlayer) return;

    const playerTargets = Object.values(cs.combatants).filter(c => c.isPlayer && c.hp > 0);
    if (playerTargets.length === 0) return;
    const target = playerTargets[Math.floor(Math.random()*playerTargets.length)];

    const roll = Math.floor(Math.random()*20)+1;
    let logEntry;
    if (roll + (enemy.atk||0) >= (target.ac||12) || roll === 20) {
      const dmg = Math.floor(Math.random()*8)+1+(enemy.atk||0);
      target.hp = Math.max(0, target.hp - dmg);
      if (s.players[target.playerId]) s.players[target.playerId].hp = target.hp;
      logEntry = { type: 'combat', text: `${enemy.icon} ${enemy.name} attacks ${target.name}! [${roll}] — ${dmg} damage!` };
    } else {
      logEntry = { type: 'system', text: `${enemy.icon} ${enemy.name} misses ${target.name}! [${roll}]` };
    }
    s.log.push(logEntry);

    const players = Object.values(cs.combatants).filter(c => c.isPlayer && c.hp > 0);
    const enemies = Object.values(cs.combatants).filter(c => !c.isPlayer && c.hp > 0);

    if (players.length === 0) {
      cs.active = false; s.state = 'waiting';
      io.to(code).emit('combat_ended', { victory: false, combatState: cs });
      broadcastSession(code); return;
    }

    advanceTurnServer(s);
    io.to(code).emit('combat_update', { combatState: cs, log: logEntry });
  });

  // ── Start game (host only) ──
  socket.on('start_game', ({ code }) => {
    const s = getSession(code);
    if (!s) return;
    if (s.host !== socket.id) { socket.emit('join_error', { msg: 'Only the host can start the game.' }); return; }
    s.state = 'playing';
    io.to(code).emit('game_started', { code });
    console.log(`Game started for session ${code}`);
  });

  // ── Story event broadcast ──
  socket.on('story_event', ({ code, eventType, payload }) => {
    const s = getSession(code);
    if (!s) return;
    const player = s.players[socket.id];
    socket.to(code).emit('story_event', { eventType, payload, fromPlayer: player?.name || 'Unknown' });
  });

  // ── Chat ──
  socket.on('chat', ({ code, text }) => {
    const s = getSession(code);
    if (!s) return;
    const player = s.players[socket.id];
    const msg = { from: player?.name || 'Unknown', text, ts: Date.now() };
    s.chatLog.push(msg);
    io.to(code).emit('chat_message', msg);
  });

  // ── Game log broadcast ──
  socket.on('game_log', ({ code, entry }) => {
    const s = getSession(code);
    if (!s) return;
    s.log.push(entry);
    socket.to(code).emit('game_log', entry); // broadcast to OTHERS only
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const code = socket.sessionCode;
    if (!code) return;
    const s = getSession(code);
    if (!s) return;
    if (s.players[socket.id]) {
      s.players[socket.id].connected = false;
      io.to(code).emit('chat_message', { system: true, text: `${s.players[socket.id].name} disconnected. Waiting for reconnect...` });
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
function advanceTurnServer(s) {
  const cs = s.combatState;
  let attempts = 0;
  do {
    cs.currentTurnIndex = (cs.currentTurnIndex + 1) % cs.turnOrder.length;
    if (cs.currentTurnIndex === 0) cs.round++;
    attempts++;
  } while (cs.combatants[cs.turnOrder[cs.currentTurnIndex]]?.hp <= 0 && attempts < cs.turnOrder.length);
  cs.apRemaining = 3;

  const next = cs.combatants[cs.turnOrder[cs.currentTurnIndex]];
  if (next && !next.isPlayer) {
    // Signal host to trigger enemy AI
    io.to(s.code).emit('enemy_turn_start', { enemyId: next.id, enemy: next });
  } else if (next) {
    io.to(s.code).emit('player_turn_start', { playerId: next.id, playerName: next.name });
  }
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
