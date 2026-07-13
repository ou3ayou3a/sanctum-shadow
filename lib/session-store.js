'use strict';

const SESSION_SCHEMA_VERSION = 1;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function serializeSessions(sessions) {
  return { schemaVersion:SESSION_SCHEMA_VERSION, savedAt:Date.now(), sessions };
}

function deserializeSessions(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input.sessions && typeof input.sessions === 'object' && !Array.isArray(input.sessions)
    ? input.sessions : input;
  return Object.fromEntries(Object.entries(source).filter(([code, session]) =>
    typeof code === 'string' && session && typeof session === 'object' && !Array.isArray(session)
  ));
}

function pruneExpiredSessions(sessions, now = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  const kept = {};
  const removed = [];
  for (const [code, session] of Object.entries(sessions || {})) {
    const timestamp = Number(session.updatedAt || session.createdAt) || 0;
    if (!timestamp || now - timestamp > ttlMs) removed.push(code);
    else kept[code] = session;
  }
  return { sessions:kept, removed };
}

module.exports = { SESSION_SCHEMA_VERSION, DEFAULT_TTL_MS, serializeSessions, deserializeSessions, pruneExpiredSessions };
