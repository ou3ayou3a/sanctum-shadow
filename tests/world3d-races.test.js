const test=require('node:test');
const assert=require('node:assert/strict');

test('the fixed 3D roster defines every campaign race',async()=>{
  const {RACE_IDS,RACE_PROFILES}=await import('../site/world3d/race-profiles.mjs');
  assert.deepEqual(RACE_IDS,['human','dwarf','elf','high_elf','dark_elf','orc','goblin']);
  for(const id of RACE_IDS){const profile=RACE_PROFILES[id];assert.equal(profile.presentation,'fixed_male');assert.equal(profile.proportions.length,3);assert.ok(profile.proportions.every(value=>value>0));}
});

test('race aliases and invalid saves normalize deterministically',async()=>{
  const {normalizeRaceId,getRaceProfile}=await import('../site/world3d/race-profiles.mjs');
  assert.equal(normalizeRaceId('highelf'),'high_elf');assert.equal(normalizeRaceId('dark-elf'),'dark_elf');assert.equal(normalizeRaceId('unknown'),'human');assert.equal(getRaceProfile('orc').name,'Orc');
});
