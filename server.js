// Load .env for local dev (ANTHROPIC_API_KEY, NANOBANANA_API_KEY, DEBUG_KEY).
// In production Railway injects real env vars; dotenv never overrides those.
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

console.log('Starting Sanctum & Shadow server...');
const express = require('express');
console.log('express loaded');
const path = require('path');
const https = require('https');
const http = require('http');
const Rules = require('./site/rules.js');
const TacticalCombat = require('./site/tactical-combat.js');
const CombatPresentation = require('./site/combat-presentation.js');
const PartyRules = require('./lib/party-rules.js');
const SessionSecurity = require('./lib/session-security.js');
const SessionStore = require('./lib/session-store.js');
const WorldPresence = require('./lib/world-presence.js');
const ConversationSync = require('./lib/conversation-sync.js');
const ClaudeContract = require('./site/claude-contract.js');
const PACKAGE_VERSION = require('./package.json').version;
console.log('Loading socket.io...');
const { Server } = require('socket.io');
console.log('socket.io loaded');

const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
// Keep the public multiplayer deployment usable without weakening the origin
// policy for arbitrary websites. Railway supplies RAILWAY_PUBLIC_DOMAIN at
// runtime; the canonical production address is included for existing services.
configuredOrigins.push('https://sanctum-shadow-production.up.railway.app');
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  configuredOrigins.push(`https://${String(process.env.RAILWAY_PUBLIC_DOMAIN).trim()}`);
}
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      callback(null, SessionSecurity.isAllowedOrigin(origin, configuredOrigins));
    },
    methods: ['GET','POST'],
  }
});

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  // A historical duplicate server implementation remains in site/ for audit
  // provenance, but must never be downloadable as a static browser asset.
  if (req.path === '/server.js') { res.status(404).end(); return; }
  next();
});
// Keep the 3D runtime self-contained. The browser must not depend on a public
// CDN being reachable before the world can initialize.
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three')));
app.use(express.static(path.join(__dirname, 'site')));

const httpRateEvents = new Map();
function apiRateLimit(limit, windowMs) {
  return (req, res, next) => {
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${req.path}`;
    if (!SessionSecurity.allowRateEvent(httpRateEvents, key, Date.now(), limit, windowMs)) {
      res.status(429).json({ error:'Too many requests. Try again shortly.' });
      return;
    }
    next();
  };
}

app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status:'ok', version:PACKAGE_VERSION,
    uptimeSeconds:Math.floor(process.uptime()),
    activeSessions:Object.keys(sessions).length,
    timestamp:new Date().toISOString(),
  });
});

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

app.post('/api/npc', apiRateLimit(30, 60_000), (req, res) => {
  const reqBody = (req.body && typeof req.body === 'object') ? req.body : {};
  const model = ALLOWED_MODELS.has(reqBody.model) ? reqBody.model : DEFAULT_MODEL;
  let maxTokens = parseInt(reqBody.max_tokens, 10);
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = 600;
  maxTokens = Math.min(maxTokens, MAX_TOKENS_CAP);
  let messages = Array.isArray(reqBody.messages) ? reqBody.messages : [];
  if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
  const system = typeof reqBody.system === 'string' ? reqBody.system : '';
  const responseContract = typeof reqBody.response_contract === 'string' ? reqBody.response_contract : null;
  if (responseContract && !ClaudeContract.isKnownContract(responseContract)) {
    res.status(400).json({ error:'Unknown Claude response contract.', code:'UNKNOWN_AI_CONTRACT' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

  // Structured replies: prefill the assistant turn with "{" so the model MUST continue
  // a JSON object. Instructions alone were unreliable — the roleplay prompt kept winning
  // and it narrated prose (or prose + a fenced block), failing contract validation.
  // The prefilled "{" is not echoed back by the API, so we re-attach it below.
  const outboundMessages = responseContract
    ? [...messages, { role: 'assistant', content: '{' }]
    : messages;
  const body = JSON.stringify({ model, max_tokens: maxTokens, system, messages: outboundMessages });

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
      try {
        const payload = JSON.parse(data);
        if (status >= 200 && status < 300 && responseContract) {
          // Re-attach the prefilled "{" so the payload is a complete JSON object for
          // BOTH our validation and the client, which parses payload.content itself.
          const firstText = Array.isArray(payload.content)
            ? payload.content.find(block => typeof block?.text === 'string')
            : null;
          if (firstText && !firstText.text.trimStart().startsWith('{')) {
            firstText.text = '{' + firstText.text;
          }
          const raw = Array.isArray(payload.content) ? payload.content.map(block => block?.text || '').join('').trim() : '';
          const validation = ClaudeContract.parseAndValidate(responseContract, raw);
          if (!validation.ok) {
            res.status(502).json({
              error:'Claude returned an invalid structured response.',
              code:'INVALID_AI_RESPONSE',
              contract:responseContract,
              details:validation.errors.slice(0, 8),
            });
            return;
          }
        }
        res.status(status).json(payload);
      }
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

// ─── PORTRAIT PROXY (Google Gemini image generation) ───
app.post('/api/portrait', apiRateLimit(10, 60_000), (req, res) => {
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

  // Mirror the /api/npc hardening: settled-guard so we respond exactly once, a
  // request timeout that destroys the socket and returns 504, and forwarding of
  // the real upstream status code instead of hard-coding 200/500.
  let settled = false;
  const request = https.request(geminiOptions, (response) => {
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => {
      if (settled) return;
      settled = true;
      // Forward the upstream HTTP status code instead of always 200/500.
      const status = response.statusCode || 502;
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
          // Use the upstream status when it signalled an error, else 500 (no image).
          res.status(status >= 400 ? status : 500).json({ error: 'No image in response', detail: JSON.stringify(parsed).substring(0, 300) });
        }
      } catch (e) {
        res.status(status >= 400 ? status : 500).json({ error: 'Parse error: ' + e.message });
      }
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
  request.write(geminiBody);
  request.end();
});

app.get('/api/portrait/status/:taskId', (req, res) => {
  res.json({ status: 'failed' });
});

// ─── SESSION STORE (in-memory + disk persistence) ───────────────
// sessions[code] = { code, name, host, players:{id:{name,character,hp,ready}}, combatState, log:[], chatLog:[] }
const fs = require('fs');
const SESSIONS_FILE = process.env.SESSIONS_FILE || path.join(__dirname, 'sessions.json');
const SESSIONS_TMP_FILE = `${SESSIONS_FILE}.tmp`;

let sessions = {};

function loadSessionsFromDisk() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const restored = SessionStore.deserializeSessions(JSON.parse(raw));
      const pruned = SessionStore.pruneExpiredSessions(restored);
      Object.entries(pruned.sessions).forEach(([code, s]) => {
        // Mark all players as disconnected — they'll rejoin.
        Object.values(s.players || {}).forEach(p => { p.connected = false; });
        sessions[code] = s;
      });
      console.log(`Restored ${Object.keys(sessions).length} sessions from disk.`);
    }
  } catch (e) {
    console.warn('Could not load sessions from disk:', e.message);
  }
}

function saveSessionsToDisk() {
  try {
    const snapshot = JSON.stringify(SessionStore.serializeSessions(sessions), null, 2);
    fs.writeFileSync(SESSIONS_TMP_FILE, snapshot, { encoding:'utf8', mode:0o600 });
    fs.renameSync(SESSIONS_TMP_FILE, SESSIONS_FILE);
  } catch (e) {
    console.warn('Could not save sessions to disk:', e.message);
    try { if (fs.existsSync(SESSIONS_TMP_FILE)) fs.unlinkSync(SESSIONS_TMP_FILE); } catch {}
  }
}

// Save every 30 seconds
const persistenceTimer = setInterval(saveSessionsToDisk, 30000);
persistenceTimer.unref?.();

// Load on startup
loadSessionsFromDisk();

function getSession(code) { return sessions[SessionSecurity.normalizeSessionCode(code)] || null; }

function touchSession(session) {
  if (session) session.updatedAt = Date.now();
  return session;
}

function broadcastSession(code) {
  const s = getSession(code);
  if (s) {
    touchSession(s);
    io.to(s.code).emit('session_update', s);
  }
}

function authorizedSession(socket, code, options = {}) {
  const normalized = SessionSecurity.normalizeSessionCode(code);
  const session = getSession(normalized);
  const decision = SessionSecurity.authorizeSession(session, {
    code:normalized, socketId:socket.id, socketSessionCode:socket.sessionCode,
    requireHost:!!options.requireHost,
  });
  if (!decision.ok) {
    socket.emit('session_error', { msg:decision.reason });
    return null;
  }
  touchSession(session);
  return session;
}

function allowSocketEvent(socket, eventName, limit = 30, windowMs = 5000) {
  socket.data.rateEvents = socket.data.rateEvents || new Map();
  const allowed = SessionSecurity.allowRateEvent(socket.data.rateEvents, eventName, Date.now(), limit, windowMs);
  if (!allowed) socket.emit('session_error', { msg:'Too many requests. Slow down for a moment.' });
  return allowed;
}

function pruneSessions() {
  const result = SessionStore.pruneExpiredSessions(sessions);
  sessions = result.sessions;
  if (result.removed.length) {
    console.log(`Pruned ${result.removed.length} expired session(s).`);
    saveSessionsToDisk();
  }
}

const cleanupTimer = setInterval(pruneSessions, 15 * 60 * 1000);
cleanupTimer.unref?.();

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

function validateConversationEffects(effects) {
  const validation = ClaudeContract.validate('npc_dialogue.v1', {
    schemaVersion:1, kind:'npc_dialogue', speech:'The conversation changes the world.', sceneBreak:null,
    options:[{ label:'Continue', type:'talk', check:null, effects }], effects:{},
  });
  return validation.ok ? validation.value.options[0].effects : null;
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

// Disconnected players retain their seat during the reconnect grace period.
// Counting only live sockets lets a full party accept a replacement and then
// exceed its advertised capacity when the original member reconnects.
function reservedPlayerCount(s) {
  return Object.values(s.players).filter(Boolean).length;
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

// Prayer blessings last N combats (prayer.js). Tick them down when a combat
// concludes so the server-side character copies stay authoritative.
function tickPrayerBlessings(s) {
  for (const p of Object.values(s.players || {})) {
    const b = p && p.character && p.character.prayerBlessing;
    if (b && Number(b.combats) > 0 && --b.combats <= 0) p.character.prayerBlessing = null;
  }
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // ── Create session ──
  socket.on('create_session', safeHandler('create_session', ({ sessionName, playerName, maxPlayers }) => {
    const name = sanitizeName(playerName);
    const code = genSessionCode(); // collision-free
    const cap = PartyRules.normalizeMaxPlayers(maxPlayers);

    // Leave any previous session before creating a new one.
    leavePreviousSession(socket, code);

    sessions[code] = {
      code, name: sanitizeName(sessionName) || 'The Chronicle',
      host: socket.id, hostPlayerId: name, maxPlayers: cap,
      players: {
        [socket.id]: { id: socket.id, name, character: null, hp: null, maxHp: null, ready: false, connected: true }
      },
      combatState: null, campaignState: null, conversation:null, log: [], chatLog: [], state: 'waiting',
      createdAt: Date.now(), updatedAt:Date.now(),
    };

    socket.join(code);
    socket.sessionCode = code;
    socket.playerName = name;
    socket.emit('session_created', { code, playerId: socket.id });
    broadcastSession(code);
    saveSessionsToDisk();
    console.log(`Session created: ${code} by ${name}`);
  }));

  // ── Join session ──
  socket.on('join_session', safeHandler('join_session', ({ code, playerName }) => {
    code = SessionSecurity.normalizeSessionCode(code);
    if (!code) { socket.emit('join_error', { msg: 'Invalid session code.' }); return; }
    const s = getSession(code);
    if (!s) { socket.emit('join_error', { msg: `Session "${code}" not found. Check the code or ask the host to recreate it.` }); return; }
    if (reservedPlayerCount(s) >= s.maxPlayers) { socket.emit('join_error', { msg: 'Session is full.' }); return; }
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
    code = SessionSecurity.normalizeSessionCode(code);
    if (!code) { socket.emit('join_error', { msg: 'Invalid session code.' }); return; }
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
      // Active combat uses socket ids as turn-order ids. Re-key it atomically so
      // a reconnect never leaves an unplayable ghost turn behind.
      PartyRules.rekeyCombatant(s.combatState, oldId, socket.id);
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
    if (s.combatState?.active) socket.emit('combat_started', s.combatState);
    if (s.conversation?.active) socket.emit('conversation_state', ConversationSync.publicState(s.conversation));
    broadcastSession(code);
    io.to(code).emit('chat_message', { system: true, text: `${name} reconnected.` });
  }));

  // ── Character ready ──
  socket.on('character_ready', safeHandler('character_ready', ({ code, character }) => {
    const s = authorizedSession(socket, code);
    if (!s || !allowSocketEvent(socket, 'character_ready', 5, 5000)) return;
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

    const wasReady = !!s.players[socket.id].ready;
    s.players[socket.id].character = character;
    s.players[socket.id].hp = character.hp;
    s.players[socket.id].maxHp = character.maxHp;
    s.players[socket.id].ready = true;
    broadcastSession(code);
    // Mid-session re-syncs (e.g. prayer.js blessing updates) shouldn't re-announce.
    if (!wasReady) io.to(code).emit('chat_message', { system: true, text: `${s.players[socket.id].name} is ready as ${character.name} the ${character.class}!` });
    // A late joiner may finish character creation after the campaign has already
    // started. Launch only that socket and immediately give it the canonical state.
    if (s.state === 'playing' || s.state === 'combat') {
      socket.emit('game_started', { code, lateJoin:true });
      if (s.campaignState) socket.emit('campaign_state', s.campaignState);
      if (s.conversation?.active) socket.emit('conversation_state', ConversationSync.publicState(s.conversation));
      // Players joining mid-fight spectate the current round and are included
      // normally when the next encounter starts.
      if (s.combatState?.active) socket.emit('combat_started', s.combatState);
    }
  }));

  // ── Start combat (any player can trigger) ──
  socket.on('start_combat', safeHandler('start_combat', ({ code, enemies, initiatorId, encounter }) => {
    const s = authorizedSession(socket, code);
    if (!s || !allowSocketEvent(socket, 'start_combat', 4, 5000)) return;
    if (s.state !== 'playing') return;
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
      e.name = sanitizeName(e.name) || 'Hostile Creature';
    });

    const combatParty = PartyRules.connectedPlayers(s, { readyOnly:true });
    if (combatParty.length === 0) return;
    enemies = PartyRules.scaleEncounter(enemies, combatParty.length);
    const encounterId = encounter?.id === 'cupside_checkpoint' ? 'cupside_checkpoint' : 'standard';
    const tacticalCover = encounterId === 'cupside_checkpoint'
      ? [{id:'cupside_barricade',x:0,z:3.1,radius:.82,type:'half'}]
      : [];

    if (s.conversation?.active) {
      const conversationId=s.conversation.id,controllerName=s.conversation.controllerName;
      s.conversation=null;
      io.to(s.code).emit('conversation_update',{type:'close',payload:{conversationId,graceful:false,controllerName},conversation:null});
    }

    // Build full combatant list: all players + enemies
    const combatants = {};
    const turnOrder = [];
    let playerPlacement = 0;

    Object.entries(s.players).forEach(([pid, p]) => {
      if (!p.character || !p.connected) return;
      const char = p.character;
      const dexMod = Rules.abilityModifier(char.stats?.dex || 10);
      const strMod = Rules.abilityModifier(char.stats?.str || 10);
      const attackAbility = Rules.getAttackAbility(char.class);
      const attackMod = Rules.abilityModifier(char.stats?.[attackAbility] || 10);
      const proficiency = Rules.proficiencyBonus(char.level || 1);
      const weaponAtk = Number(char.atkBonus) || 0;
      const armorAc = Number(char.ac) ? Number(char.ac) - 10 : 0;
      const initiative = Rules.rollInitiative({ bonus:dexMod }).total;
      // Prayer blessings/curses (prayer.js) — clamp client-supplied values (#66 spirit).
      const clampMod = v => Math.max(-4, Math.min(4, Number(v) || 0));
      const bless = (char.prayerBlessing && Number(char.prayerBlessing.combats) > 0) ? char.prayerBlessing : null;
      const curse = char.prayerCurse || null;
      const prayerAtk = (bless ? clampMod(bless.atk) : 0) + (curse ? clampMod(curse.atk) : 0);
      const prayerAc  = (bless ? clampMod(bless.ac)  : 0) + (curse ? clampMod(curse.ac)  : 0);
      combatants[pid] = {
        id: pid, name: char.name, playerId: pid,
        hp: p.hp || char.hp, maxHp: char.maxHp,
        mp: char.mp || 100, maxMp: char.maxMp || 100,
        ac:10 + dexMod + armorAc + prayerAc,
        atk:attackMod + weaponAtk + proficiency + prayerAtk,
        attackAbility,
        attackBonus:attackMod + weaponAtk + proficiency + prayerAtk,
        damageMod:attackMod + weaponAtk + prayerAtk,
        characterClass:String(char.class||'warrior').toLowerCase().replace(/[^a-z_-]/g,'').slice(0,24)||'warrior',
        type: 'player', isPlayer: true, boss: false,
        spells: char.spells || [], level: char.level || 1,
        icon: '⚔', initiative,
        tacticalRole:/ranger/i.test(char.class||'')?'ranged':/mage|cleric/i.test(char.class||'')?'caster':/rogue/i.test(char.class||'')?'skirmisher':'frontline',
        position:{x:(playerPlacement-(combatParty.length-1)/2)*1.55,z:0},
        statMods: {
          str: strMod,
          dex: dexMod,
          con: Rules.abilityModifier(char.stats?.con || 10),
          wis: Rules.abilityModifier(char.stats?.wis || 10),
          int: Rules.abilityModifier(char.stats?.int || 10),
          cha: Rules.abilityModifier(char.stats?.cha || 10),
        }
      };
      playerPlacement++;
      turnOrder.push({ id: pid, initiative });
    });

    enemies.forEach((e, i) => {
      const eid = 'enemy_' + i + '_' + Date.now();
      const initiative = Rules.rollInitiative({ bonus:e.dex || 0 }).total;
      combatants[eid] = {
        ...e, id:eid, sourceId:String(e.id||'').replace(/[^a-z0-9_-]/gi,'').slice(0,64), type:'enemy', isPlayer:false, ap:3, initiative,
        tacticalRole:['frontline','skirmisher','ranged','caster'].includes(e.tacticalRole)?e.tacticalRole:TacticalCombat.inferRole(e),
        position:{x:(i-(enemies.length-1)/2)*2.05,z:5.5+(i%2)*.7},
        attackBonus:e.attackBonus ?? e.atk ?? 3,
        damageMod:e.damageMod ?? e.atk ?? 3,
      };
      turnOrder.push({ id: eid, initiative });
    });

    turnOrder.sort((a,b) => b.initiative - a.initiative);

    s.combatState = {
      active: true, round: 1,
      combatants,
      tactical:{encounterId,cover:tacticalCover,bounds:12,moveRange:TacticalCombat.DEFAULT_MOVE_RANGE},
      turnOrder: turnOrder.map(t => t.id),
      currentTurnIndex: 0,
      apRemaining: 3,
      _enemyTurnSeq: 0,        // increments per enemy turn (keyed dedupe)
      _enemyTurnProcessed: -1, // last seq the server has resolved
      _presentationSeq: 0,
    };
    s.state = 'combat';

    io.to(code).emit('combat_started', s.combatState);
    broadcastSession(code);
  }));

  // ── Combat action ──
  socket.on('combat_action', safeHandler('combat_action', ({ code, action, targetId, spellId, position }) => {
    const s = authorizedSession(socket, code);
    if (!s || !s.combatState || !allowSocketEvent(socket, 'combat_action', 20, 5000)) return;

    const cs = s.combatState;
    const currentId = cs.turnOrder[cs.currentTurnIndex];

    // Must be this player's turn
    if (currentId !== socket.id) {
      socket.emit('error', { msg: 'Not your turn!' }); return;
    }

    const actor = cs.combatants[currentId];
    if (!actor) return;
    let logEntry = null;
    let presentation = null;
    let stateSync = null; // {playerId, inventory, gold} broadcast for item use

    if (action === 'attack') {
      const target = cs.combatants[targetId];
      if (!target || typeof target.hp !== 'number' || target.hp <= 0) return;
      const tactical=TacticalCombat.validateAttack(actor,target,{cover:cs.tactical?.cover||[]});
      if(!tactical.ok){socket.emit('error',{msg:tactical.reason==='out_of_range'?`Target is out of range (${tactical.distance?.toFixed(1)}m / ${tactical.range}m).`:'That target cannot be attacked.'});return;}
      const attack = Rules.resolveAttack({ attackBonus:actor.attackBonus ?? actor.atk ?? 0, targetAC:(target.ac || 10)+tactical.coverBonus });
      const { roll, crit } = attack;
      let damage=0;
      if (attack.hit) {
        const dmg = Rules.rollFormula('1d8', { modifier:actor.damageMod ?? actor.atk ?? 0, critical:crit }).total;
        damage=dmg;
        target.hp = Math.max(0, target.hp - dmg);
        logEntry = { type: 'combat', text: `⚔ ${crit ? 'CRITICAL HIT' : 'HIT'} — ${actor.name} attacks ${target.name}${tactical.coverBonus?' through cover':''}! [${roll}] — ${dmg} damage!` };
        // Sync HP back if target is a player
        if (target.isPlayer && s.players[target.playerId]) {
          s.players[target.playerId].hp = target.hp;
        }
      } else {
        logEntry = { type: 'system', text: `⚔ MISS — ${actor.name} misses ${target.name}! [${roll}]` };
      }
      presentation=CombatPresentation.event({seq:++cs._presentationSeq,actor,target,action:'attack',hit:attack.hit,crit,damage});
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
        presentation=CombatPresentation.event({seq:++cs._presentationSeq,actor,target:actor,action:'spell',spell,hit:true,healing:healAmt});
      } else {
        target.hp = Math.max(0, target.hp - dmg);
        if (target.isPlayer && s.players[target.playerId]) s.players[target.playerId].hp = target.hp;
        logEntry = { type: 'combat', text: `${spell.icon} ${actor.name} casts ${spell.name} on ${target.name} — HIT — ${dmg} damage!` };
        presentation=CombatPresentation.event({seq:++cs._presentationSeq,actor,target,action:'spell',spell,hit:true,damage:dmg});
      }

    } else if (action === 'move') {
      if (cs.apRemaining < 1) return;
      const movement=TacticalCombat.validateMove(actor.position,position,{maxDistance:cs.tactical?.moveRange||TacticalCombat.DEFAULT_MOVE_RANGE,bounds:cs.tactical?.bounds||12});
      if(!movement.ok){socket.emit('error',{msg:movement.reason==='out_of_range'?'That move is too far.':'That position is outside the battlefield.'});return;}
      actor.position=movement.position;
      cs.apRemaining--;
      logEntry = { type: 'system', text: `🏃 ${actor.name} moves ${movement.distance.toFixed(1)}m.` };

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
      cs.active = false; s.state = 'playing';
      tickPrayerBlessings(s); io.to(code).emit('combat_ended', { victory: false, combatState: cs, presentation, log:logEntry });
      broadcastSession(code);
      return;
    }
    if (enemies.length === 0) {
      cs.active = false; s.state = 'playing';
      // Calculate XP — split only among connected players who have a character (#68).
      const xp = Object.values(cs.combatants).filter(c=>!c.isPlayer).reduce((a,c)=>a+(c.xp||50),0);
      const sharers = Object.values(s.players).filter(p => p && p.connected && p.character).length || 1;
      const xpEach = Math.floor(xp / sharers);
      tickPrayerBlessings(s); io.to(code).emit('combat_ended', { victory: true, xp, xpEach, combatState: cs, presentation, log:logEntry });
      broadcastSession(code);
      return;
    }

    // Advance turn if AP is 0 or end_turn
    if (cs.apRemaining <= 0 || action === 'end_turn') {
      advanceTurnServer(s);
    }

    io.to(code).emit('combat_update', { combatState: cs, log: logEntry, presentation });
  }));

  // ── Enemy AI turn (any connected player may signal; server resolves once) ──
  socket.on('enemy_turn', safeHandler('enemy_turn', ({ code, seq }) => {
    const s = authorizedSession(socket, code);
    if (!s || !s.combatState || !allowSocketEvent(socket, 'enemy_turn', 8, 5000)) return;
    processEnemyTurn(s, typeof seq === 'number' ? seq : s.combatState._enemyTurnSeq);
  }));

  // ── Start game (host only) ──
  socket.on('start_game', safeHandler('start_game', ({ code }) => {
    const s = authorizedSession(socket, code, { requireHost:true });
    if (!s || !allowSocketEvent(socket, 'start_game', 3, 5000)) return;
    if (!PartyRules.canStartCampaign(s)) {
      socket.emit('session_error', { msg:'Every connected player must finish their character before the Chronicle starts.' });
      return;
    }
    s.state = 'playing';
    io.to(code).emit('game_started', { code });
    console.log(`Game started for session ${code}`);
  }));

  // ── Canonical campaign state (host authoritative) ──
  // Stored on the session so parties of any supported size, late joiners, and
  // reconnecting players all receive the same quests, flags, facts, clock and map.
  socket.on('campaign_state', safeHandler('campaign_state', ({ code, state }) => {
    const s = authorizedSession(socket, code, { requireHost:true });
    if (!s || !allowSocketEvent(socket, 'campaign_state', 15, 5000)) return;
    if (!state || typeof state !== 'object' || Array.isArray(state)) return;
    let encoded;
    try { encoded = JSON.stringify(state); } catch { return; }
    if (encoded.length > 200000) return;
    s.campaignState = state;
    io.to(code).emit('campaign_state', state);
    saveSessionsToDisk();
  }));

  socket.on('host_player_state', safeHandler('host_player_state', ({ code, playerId, patch }) => {
    const s = authorizedSession(socket, code, { requireHost:true });
    if (!s || !allowSocketEvent(socket, 'host_player_state', 30, 5000) || !s.players[playerId] || !patch || typeof patch !== 'object') return;
    const p = s.players[playerId];
    if (!p.character) return;
    const clamp = (v, lo, hi, fallback) => {
      const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
    };
    if (patch.hp != null) p.character.hp = clamp(patch.hp, 0, p.character.maxHp || 500, p.character.hp || 0);
    if (patch.mp != null) p.character.mp = clamp(patch.mp, 0, p.character.maxMp || 500, p.character.mp || 0);
    if (patch.holyPoints != null) p.character.holyPoints = clamp(patch.holyPoints, 0, 9999, p.character.holyPoints || 0);
    if (patch.hellPoints != null) p.character.hellPoints = clamp(patch.hellPoints, 0, 9999, p.character.hellPoints || 0);
    if (patch.gold != null) p.character.gold = clamp(patch.gold, 0, 999999, p.character.gold || 0);
    if (Array.isArray(patch.conditions)) p.character.conditions = patch.conditions.filter(v => typeof v === 'string').slice(0, 20);
    if (Array.isArray(patch.inventory)) p.character.inventory = patch.inventory.filter(v => typeof v === 'string').slice(0, 100);
    p.hp = p.character.hp;
    p.maxHp = p.character.maxHp;
    broadcastSession(code);
    saveSessionsToDisk();
  }));

  // ── 3D exploration presence ──
  // Presentation-only and relayed to peers. It cannot mutate campaign or combat state.
  socket.on('world_position', safeHandler('world_position', ({ code, position }) => {
    const s = authorizedSession(socket, code);
    if (!s || !allowSocketEvent(socket, 'world_position', 60, 5000)) return;
    const normalized = WorldPresence.normalizeWorldPosition(position);
    if (!normalized) return;
    const player = s.players[socket.id];
    if (!player?.connected || !player.character) return;
    socket.to(s.code).emit('world_position', {
      playerId:socket.id, playerName:player.character.name || player.name,
      position:normalized,
    });
  }));

  // ── Server-owned NPC conversation session ──
  // One player is the designated speaker; everyone else receives the same
  // ordered transcript and choices. The server rejects stale or forged updates.
  socket.on('conversation_open', (request = {}, ack) => {
    const reply = value => { if (typeof ack === 'function') ack(value); };
    try {
      const s = authorizedSession(socket, request.code);
      if (!s || !allowSocketEvent(socket, 'conversation_open', 5, 5000)) { reply({ok:false,error:'Conversation request rejected.'}); return; }
      const result = ConversationSync.begin(s, socket.id, request.payload || {});
      if (!result.ok) { socket.emit('session_error',{msg:result.error}); reply(result); return; }
      socket.to(s.code).emit('conversation_state', ConversationSync.publicState(result.state));
      reply({ok:true,conversation:ConversationSync.publicState(result.state)});
      saveSessionsToDisk();
    } catch (error) {
      console.error('[socket:conversation_open] handler error:', error?.message);
      reply({ok:false,error:'Conversation could not be started.'});
    }
  });

  socket.on('conversation_update', (request = {}, ack) => {
    const reply = value => { if (typeof ack === 'function') ack(value); };
    try {
      const s = authorizedSession(socket, request.code);
      if (!s || !allowSocketEvent(socket, 'conversation_update', 30, 5000)) { reply({ok:false,error:'Conversation update rejected.'}); return; }
      const type = typeof request.type === 'string' ? request.type : '';
      const payload = request.payload && typeof request.payload === 'object' ? {...request.payload} : {};
      if (type === 'effects') {
        const effects = validateConversationEffects(payload.effects);
        if (!effects) { reply({ok:false,error:'Conversation effects were invalid.'}); return; }
        payload.effects = effects;
      }
      const result = ConversationSync.update(s, socket.id, type, payload);
      if (!result.ok) { socket.emit('session_error',{msg:result.error}); reply(result); return; }
      const event = {type:result.type,payload:result.relay,conversation:ConversationSync.publicState(result.state)};
      if (type === 'effects' || type === 'outcome' || type === 'scene_break') {
        if (s.host && s.host !== socket.id) io.to(s.host).emit('conversation_update', event);
      } else {
        socket.to(s.code).emit('conversation_update', event);
      }
      reply({ok:true,revision:result.state?.revision || 0});
      if (type === 'close') saveSessionsToDisk();
    } catch (error) {
      console.error('[socket:conversation_update] handler error:', error?.message);
      reply({ok:false,error:'Conversation update failed.'});
    }
  });

  // ── Story event broadcast ──
  socket.on('story_event', safeHandler('story_event', ({ code, eventType, payload }) => {
    const s = authorizedSession(socket, code);
    if (!s || !allowSocketEvent(socket, 'story_event', 30, 5000)) return;
    if (typeof eventType !== 'string') return;
    if (eventType.length > 60) return;
    if (eventType.startsWith('conv_') || eventType === 'npc_outcome') {
      socket.emit('session_error',{msg:'Legacy conversation events are no longer accepted.'});
      return;
    }
    try { if (JSON.stringify(payload || {}).length > 50000) return; } catch { return; }
    const player = s.players[socket.id];
    socket.to(code).emit('story_event', { eventType, payload, fromPlayer: player?.name || 'Unknown' });
  }));

  // ── Chat ──
  socket.on('chat', safeHandler('chat', ({ code, text }) => {
    const s = authorizedSession(socket, code);
    if (!s || !allowSocketEvent(socket, 'chat', 12, 5000)) return;
    const player = s.players[socket.id];
    const msg = { from: player?.name || 'Unknown', text: sanitizeText(text), ts: Date.now() };
    s.chatLog.push(msg);
    capLog(s.chatLog);
    io.to(code).emit('chat_message', msg);
  }));

  // ── Game log broadcast ──
  socket.on('game_log', safeHandler('game_log', ({ code, entry }) => {
    const s = authorizedSession(socket, code);
    if (!s || !allowSocketEvent(socket, 'game_log', 40, 5000)) return;
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
      if (s.conversation?.active && s.conversation.controllerId === socket.id) {
        const conversationId=s.conversation.id,controllerName=s.conversation.controllerName;
        s.conversation=null;
        socket.to(code).emit('conversation_update',{type:'close',payload:{conversationId,graceful:false,controllerName},conversation:null});
      }
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
  const target = playerTargets.reduce((closest,candidate)=>{
    if(!closest)return candidate;
    return (TacticalCombat.distance(enemy.position,candidate.position)??Infinity)<(TacticalCombat.distance(enemy.position,closest.position)??Infinity)?candidate:closest;
  },null);

  let tactical=TacticalCombat.validateAttack(enemy,target,{cover:cs.tactical?.cover||[]});
  if(!tactical.ok&&tactical.reason==='out_of_range'&&enemy.position&&target.position){
    const desired=Math.max(0,(tactical.distance||0)-tactical.range+.15);
    enemy.position=TacticalCombat.moveToward(enemy.position,target.position,Math.min(cs.tactical?.moveRange||TacticalCombat.DEFAULT_MOVE_RANGE,desired));
    tactical=TacticalCombat.validateAttack(enemy,target,{cover:cs.tactical?.cover||[]});
  }
  if(!tactical.ok){
    const logEntry={type:'system',text:`${enemy.icon} ${enemy.name} advances but cannot reach ${target.name}.`};
    s.log.push(logEntry);capLog(s.log);advanceTurnServer(s);io.to(s.code).emit('combat_update',{combatState:cs,log:logEntry});return;
  }

  const attack = Rules.resolveAttack({ attackBonus:enemy.attackBonus ?? enemy.atk ?? 0, targetAC:(target.ac || 12)+tactical.coverBonus });
  const { roll, crit } = attack;
  let logEntry,damage=0;
  if (attack.hit) {
    const dmg = Rules.rollFormula('1d8', { modifier:enemy.damageMod ?? enemy.atk ?? 0, critical:crit }).total;
    damage=dmg;
    target.hp = Math.max(0, target.hp - dmg);
    if (s.players[target.playerId]) s.players[target.playerId].hp = target.hp;
    logEntry = { type: 'combat', text: `${enemy.icon} ${crit ? 'CRITICAL HIT' : 'HIT'} — ${enemy.name} attacks ${target.name}! [${roll}] — ${dmg} damage!` };
  } else {
    logEntry = { type: 'system', text: `${enemy.icon} MISS — ${enemy.name} misses ${target.name}! [${roll}]` };
  }
  const presentation=CombatPresentation.event({seq:++cs._presentationSeq,actor:enemy,target,action:'attack',hit:attack.hit,crit,damage});
  s.log.push(logEntry);
  capLog(s.log);

  const players = Object.values(cs.combatants).filter(c => c.isPlayer && c.hp > 0);
  if (players.length === 0) {
    cs.active = false; s.state = 'playing';
    tickPrayerBlessings(s); io.to(s.code).emit('combat_ended', { victory: false, combatState: cs, presentation, log:logEntry });
    broadcastSession(s.code); return;
  }

  advanceTurnServer(s);
  io.to(s.code).emit('combat_update', { combatState: cs, log: logEntry, presentation });
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
  return Rules.rollFormula(formula, { statMods }).total;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sanctum & Shadow running on port ${PORT}`);
});

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — saving campaigns and shutting down.`);
  saveSessionsToDisk();
  io.emit('server_shutdown', { message:'Server is restarting. Your campaign has been saved.' });
  server.close(() => process.exit(0));
  const forceTimer = setTimeout(() => process.exit(1), 5000);
  forceTimer.unref?.();
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', reason => console.error('Unhandled rejection:', reason));
