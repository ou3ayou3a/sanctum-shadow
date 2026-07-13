'use strict';

function normalizeSessionCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase().slice(0, 20) : '';
}

function authorizeSession(session, request = {}) {
  const code = normalizeSessionCode(request.code);
  if (!session || !code || session.code !== code) return { ok:false, reason:'Session not found.' };
  const player = session.players?.[request.socketId];
  if (!player || player.connected === false) return { ok:false, reason:'You are not an active member of this session.' };
  if (normalizeSessionCode(request.socketSessionCode) !== code) return { ok:false, reason:'Socket session mismatch.' };
  if (request.requireHost && session.host !== request.socketId) return { ok:false, reason:'Only the host can do that.' };
  return { ok:true, code, player };
}

function allowRateEvent(store, key, now, limit, windowMs) {
  const cutoff = now - windowMs;
  const recent = (store.get(key) || []).filter(timestamp => timestamp > cutoff);
  if (recent.length >= limit) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}

function isAllowedOrigin(origin, configuredOrigins = []) {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname === '127.0.0.1') return true;
    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
    const match = hostname.match(/^172\.(\d{1,2})\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  } catch {}
  return false;
}

module.exports = { normalizeSessionCode, authorizeSession, allowRateEvent, isAllowedOrigin };
