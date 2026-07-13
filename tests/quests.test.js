'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Quests = require('../site/quests.js');

test('quest events only advance active, incomplete quests', () => {
  const inactive = Quests.reduceQuestEvent({ activeQuestIds:[], completedQuestIds:[], progress:{} }, 'scene:arrival_vaelthar');
  assert.deepEqual(inactive, { updates:[], completions:[] });

  const active = Quests.reduceQuestEvent({ activeQuestIds:['c1q1'], completedQuestIds:[], progress:{} }, 'scene:arrival_vaelthar');
  assert.equal(active.updates[0].objectiveId, 'arrive');
  assert.deepEqual(active.completions, []);

  const completed = Quests.reduceQuestEvent({ activeQuestIds:['c1q1'], completedQuestIds:['c1q1'], progress:{} }, 'scene:arrival_vaelthar');
  assert.deepEqual(completed.updates, []);
});

test('alternate story paths satisfy the same objective exactly once', () => {
  const state = { activeQuestIds:['c1q1'], completedQuestIds:[], progress:{} };
  const hall = Quests.reduceQuestEvent(state, 'scene:covenant_hall_scene');
  assert.equal(hall.updates[0].objectiveId, 'evidence');

  state.progress.c1q1 = { objectives:{ evidence:{ completedAt:1 } } };
  const document = Quests.reduceQuestEvent(state, 'scene:scribe_gives_document');
  assert.deepEqual(document.updates, []);
});

test('completion events return both the final objective and one completion', () => {
  const result = Quests.reduceQuestEvent({ activeQuestIds:['c1q4'], completedQuestIds:[], progress:{} }, 'combat:victory:merchant_road_ambush');
  assert.equal(result.updates[0].objectiveId, 'secure_road');
  assert.deepEqual(result.completions, ['c1q4']);
});

test('the first six campaign quests expose readable objective checklists', () => {
  for (let order = 1; order <= 6; order++) {
    const objectives = Quests.getObjectives(`c1q${order}`);
    assert.ok(objectives.length >= 3);
    assert.ok(objectives.some(objective => objective.completes));
    assert.ok(objectives.every(objective => objective.id && objective.label && objective.events.length));
  }
});
