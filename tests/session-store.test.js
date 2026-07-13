'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../lib/session-store.js');

test('session store reads legacy maps and versioned envelopes', () => {
  const legacy = { 'FIRE-1':{ code:'FIRE-1', createdAt:100 } };
  assert.deepEqual(Store.deserializeSessions(legacy), legacy);
  const envelope = Store.serializeSessions(legacy);
  assert.equal(envelope.schemaVersion, Store.SESSION_SCHEMA_VERSION);
  assert.deepEqual(Store.deserializeSessions(envelope), legacy);
});

test('expired sessions are pruned using updated activity time', () => {
  const now = 10_000;
  const result = Store.pruneExpiredSessions({
    active:{ code:'active', createdAt:1, updatedAt:9_500 },
    expired:{ code:'expired', createdAt:1, updatedAt:2_000 },
  }, now, 2_000);
  assert.deepEqual(Object.keys(result.sessions), ['active']);
  assert.deepEqual(result.removed, ['expired']);
});

test('invalid session-store data produces an empty safe state', () => {
  assert.deepEqual(Store.deserializeSessions(null), {});
  assert.deepEqual(Store.deserializeSessions([]), {});
});
