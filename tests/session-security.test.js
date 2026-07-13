'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Security = require('../lib/session-security.js');

const session = {
  code:'FIRE-1234', host:'host',
  players:{ host:{ id:'host', connected:true }, member:{ id:'member', connected:true }, gone:{ id:'gone', connected:false } },
};

test('session codes are normalized before authorization', () => {
  assert.equal(Security.normalizeSessionCode(' fire-1234 '), 'FIRE-1234');
  assert.equal(Security.normalizeSessionCode(null), '');
});

test('session authorization rejects outsiders, mismatches, and non-host escalation', () => {
  assert.equal(Security.authorizeSession(session, { code:'FIRE-1234', socketId:'member', socketSessionCode:'FIRE-1234' }).ok, true);
  assert.equal(Security.authorizeSession(session, { code:'FIRE-1234', socketId:'outsider', socketSessionCode:'FIRE-1234' }).ok, false);
  assert.equal(Security.authorizeSession(session, { code:'FIRE-1234', socketId:'gone', socketSessionCode:'FIRE-1234' }).ok, false);
  assert.equal(Security.authorizeSession(session, { code:'FIRE-1234', socketId:'member', socketSessionCode:'OTHER-9999' }).ok, false);
  assert.equal(Security.authorizeSession(session, { code:'FIRE-1234', socketId:'member', socketSessionCode:'FIRE-1234', requireHost:true }).ok, false);
  assert.equal(Security.authorizeSession(session, { code:'FIRE-1234', socketId:'host', socketSessionCode:'FIRE-1234', requireHost:true }).ok, true);
});

test('event rate limits recover after their time window', () => {
  const events = new Map();
  assert.equal(Security.allowRateEvent(events, 'chat', 1000, 2, 1000), true);
  assert.equal(Security.allowRateEvent(events, 'chat', 1100, 2, 1000), true);
  assert.equal(Security.allowRateEvent(events, 'chat', 1200, 2, 1000), false);
  assert.equal(Security.allowRateEvent(events, 'chat', 2101, 2, 1000), true);
});

test('origin policy permits local/LAN play and rejects unrelated public sites', () => {
  assert.equal(Security.isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(Security.isAllowedOrigin('http://192.168.1.40:3000'), true);
  assert.equal(Security.isAllowedOrigin('http://172.20.0.5:3000'), true);
  assert.equal(Security.isAllowedOrigin('https://evil.example'), false);
  assert.equal(Security.isAllowedOrigin('https://game.example', ['https://game.example']), true);
});
