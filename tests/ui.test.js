'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../site/ui.js');

test('UI preferences normalize to a stable, versionable shape', () => {
  assert.deepEqual(UI.normalizePreferences({ largeText:1, highContrast:0, reduceMotion:true, ignored:'value' }), {
    reduceMotion:true, largeText:true, highContrast:false,
  });
});

test('empty UI preferences use safe boolean defaults', () => {
  const first = UI.normalizePreferences();
  const second = UI.normalizePreferences();
  assert.deepEqual(first, { reduceMotion:false, largeText:false, highContrast:false });
  assert.notEqual(first, second);
});
