const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(saved = {}) {
  const flags = { ...saved }, rewards = { xp: 0, holy: 0, hell: 0 };
  const root = {
    SCENES: {}, sceneState: { flags }, gameState: { character: { inventory: [] } },
    getFlag: key => flags[key], setFlag: (key, value = true) => flags[key] = value,
    addLog() {}, runScene() {},
    grantXP: n => rewards.xp += n,
    grantHolyPoints: n => rewards.holy += n,
    grantHellPoints: n => rewards.hell += n,
  };
  root.window = root;
  vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-wells.js'), 'utf8'), root);
  return { root, flags, rewards };
}

const choices = [
  ['treasury_caught_crossing', 1, 'onSuccess', { xp: 60 }],
  ['treasury_fortynine_counted', 0, 'action', { xp: 60 }],
  ['treasury_fortynine_counted', 1, 'onSuccess', { xp: 75, holy: 2 }, 'clue_covenant_expires_treasury_corroboration'],
  ['treasury_warrant_read', 1, 'onSuccess', { xp: 75 }],
  ['treasury_candle_arithmetic', 1, 'onSuccess', { xp: 100, holy: 5 }, 'temple_quarter_raid_stopped'],
  ['treasury_blame_the_candle', 2, 'action', { hell: 3 }],
  ['treasury_second_key', 1, 'onSuccess', { xp: 75 }],
  ['treasury_second_key', 2, 'onSuccess', { hell: 5 }, 'took_second_key_by_force'],
  ['treasury_rats_resolved', 0, 'onSuccess', { xp: 100 }],
  ['treasury_rats_resolved', 2, 'action', { xp: 100, holy: 3 }, 'watched_the_withdrawal'],
  ['treasury_rats_resolved', 3, 'action', { hell: 5 }, 'sallow_arrested'],
];

test('Treasury optional rewards cannot be farmed through reused or recreated choices or reloads', () => {
  for (const [id, index, kind, expected] of choices) {
    const { root, flags, rewards } = fixture();
    const callback = root.SCENES[id]().options[index][kind];
    const before = { ...rewards };
    callback();
    for (const stat of Object.keys(rewards)) assert.equal(rewards[stat] - before[stat], expected[stat] || 0, `${id}: ${stat}`);
    const after = { ...rewards };
    callback();
    root.SCENES[id]().options[index][kind]();
    assert.deepEqual(rewards, after);
    const loaded = fixture(JSON.parse(JSON.stringify(flags)));
    loaded.root.SCENES[id]().options[index][kind]();
    assert.deepEqual(loaded.rewards, { xp: 0, holy: 0, hell: 0 });
    assert.deepEqual(loaded.root.gameState.character.inventory, [], 'claims do not recreate removed items');
  }
});

test('Treasury legacy milestone flags suppress previously earned rewards', () => {
  for (const [id, index, kind, , legacy] of choices.filter(choice => choice[4])) {
    const { root, rewards } = fixture({ [legacy]: true });
    const callback = root.SCENES[id]().options[index][kind];
    const before = { ...rewards };
    callback();
    assert.deepEqual(rewards, before);
    assert.deepEqual(root.gameState.character.inventory, []);
  }
});

test('Treasury guests cannot run factories or captured host choices', () => {
  for (const [id, index, kind] of choices) {
    const { root, flags, rewards } = fixture();
    const callback = root.SCENES[id]().options[index][kind];
    const before = JSON.stringify({ flags, rewards });
    root.mp = { sessionCode: 'party', isHost: false };
    callback();
    for (const name of Object.keys(root.SCENES).filter(name => name.startsWith('treasury_'))) assert.equal(root.SCENES[name](), null);
    assert.equal(JSON.stringify({ flags, rewards }), before);
  }
});

test('failed Treasury checks do not consume the success claim', () => {
  for (const [id, index, kind, expected] of choices.filter(choice => choice[2] === 'onSuccess')) {
    const { root, rewards } = fixture();
    const option = root.SCENES[id]().options[index];
    option.onFail();
    const before = { ...rewards };
    option[kind]();
    for (const stat of Object.keys(rewards)) assert.equal(rewards[stat] - before[stat], expected[stat] || 0);
  }
});

test('Treasury existing evidence and resolution rewards still pay once independently', () => {
  const { root, rewards } = fixture();
  for (let pass = 0; pass < 2; pass++) {
    root.SCENES.treasury_shelf_candle().options[1].action();
    root.SCENES.treasury_fortynine_counted();
    root.SCENES.treasury_candle_arithmetic();
    root.SCENES.treasury_rats_resolved().options[1].action();
  }
  assert.deepEqual(rewards, { xp: 750, holy: 11, hell: 0 });
  assert.equal(root.gameState.character.inventory.length, 3);
});
