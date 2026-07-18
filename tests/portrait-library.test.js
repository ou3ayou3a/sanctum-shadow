const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const portraits = require('../site/portrait-library.js');

test('all playable races have bundled offline portraits', () => {
  const races = ['human', 'dwarf', 'elf', 'high_elf', 'dark_elf', 'orc', 'goblin'];
  for (const race of races) {
    const portrait = portraits.getPlayerPortrait(race);
    assert.equal(portrait, `art/portraits/races/${race}.jpg`);
    assert.ok(fs.statSync(path.join(ROOT, 'site', portrait)).size > 50_000, `${race} portrait is missing or empty`);
  }
});

test('portrait generation API and Google image dependency are removed', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const game = fs.readFileSync(path.join(ROOT, 'site/game.js'), 'utf8');
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const combined = `${server}\n${game}\n${env}`;
  assert.doesNotMatch(combined, /\/api\/portrait|NANOBANANA|generativelanguage\.googleapis\.com/);
  assert.match(game, /PortraitLibrary\?\.getPlayerPortrait\(gameState\.selectedRace\)/);
});

test('every identity receives a stable portrait and different identities remain distinct', () => {
  const first = portraits.getPortraitPath('market_fishmonger', 'Marek', { role: 'merchant' });
  const repeated = portraits.getPortraitPath('market_fishmonger', 'Marek', { role: 'merchant' });
  const second = portraits.getPortraitPath('market_porter', 'Tovin', { role: 'merchant' });
  assert.equal(first, repeated);
  assert.match(first, /^data:image\/svg\+xml/);
  assert.notEqual(first, second);
  assert.ok(!first.startsWith('http'));
});

test('story NPCs, origin NPCs, merchants and bosses all resolve locally', () => {
  const ids = [
    'captain_rhael', 'trembling_scribe', 'sister_mourne', 'bresker', 'lyra_innkeeper',
    'drunk_cartographer', 'nervous_merchant', 'deacon_voss', 'elder_mosswick', 'sir_harren',
    'merchant_widow_sera', 'head_archivist_theones', 'donal_barkeep', 'royal_investigator',
    'grisel_barkeep', 'wandering_scholar', 'mira_archivist', 'elder_varek',
    'origin_steward_elira', 'origin_sergeant_dain', 'origin_bloodkeeper_ysra',
    'origin_pilgrim_oren', 'origin_recorder_cael', 'origin_hunter_veyra',
    'origin_confessor_ilyan', 'origin_senna_vale',
    'merchant_old_brennan', 'merchant_sylva', 'merchant_brother_edric', 'merchant_mira',
    'merchant_big_kes', 'merchant_osric', 'merchant_novice_tael', 'merchant_traveling',
    'the_voice_below', 'shattered_god', 'harren_fallen',
  ];
  for (const id of ids) {
    const value = portraits.getPortraitPath(id, id.replaceAll('_', ' '));
    assert.ok(value.startsWith('art/portraits/') || value.startsWith('data:image/svg+xml'), `${id} did not resolve locally`);
  }
});

test('all portrait UI surfaces use the authoritative resolver', () => {
  const combat = fs.readFileSync(path.join(ROOT, 'site/combat.js'), 'utf8');
  const dialogue = fs.readFileSync(path.join(ROOT, 'site/dialogue.js'), 'utf8');
  const multiplayer = fs.readFileSync(path.join(ROOT, 'site/multiplayer.js'), 'utf8');
  const shop = fs.readFileSync(path.join(ROOT, 'site/shop.js'), 'utf8');
  const visuals = fs.readFileSync(path.join(ROOT, 'site/visuals.js'), 'utf8');
  assert.match(combat, /getPortraitPath/);
  assert.match(dialogue, /getPlayerPortrait/);
  assert.match(multiplayer, /getPortraitPath/);
  assert.match(shop, /shop-keeper-icon[^`]+getPortraitPath/s);
  assert.match(visuals, /function getPortraitHTML[\s\S]+getPortraitPath/);
});
