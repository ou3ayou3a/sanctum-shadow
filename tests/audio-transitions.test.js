const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('music transitions overlap independent track buses without fading the master bus',()=>{
  const audio=read('site/audio.js');
  assert.match(audio,/function createTrackInstance\(trackId, initialGain = 1\)/);
  assert.match(audio,/bus\.connect\(masterGain\)/);
  assert.match(audio,/const incoming = createTrackInstance\(trackId, 0\)/);
  assert.match(audio,/outgoing\.bus\.gain\.linearRampToValueAtTime\(0/);
  assert.match(audio,/incoming\.bus\.gain\.linearRampToValueAtTime\(1/);
  assert.match(audio,/fadingTrackInstances\.add\(outgoing\)/);
  const transitionBody=audio.slice(audio.indexOf('function transition(trackId'),audio.indexOf('function transitionForContext'));
  assert.doesNotMatch(transitionBody,/masterGain\.gain\.linearRampToValueAtTime/);
});

test('scheduled medieval voices remain attached to the track instance that created them',()=>{
  const audio=read('site/audio.js');
  assert.match(audio,/const output = musicOutput\(\);/);
  assert.match(audio,/createBell\(note, ctx\.currentTime, gainVal, output\)/);
  assert.match(audio,/createLutePluck\([^\n]+, output\)/);
  assert.match(audio,/createWoodenFlute\([^\n]+, output\)/);
  assert.match(audio,/createFrameDrum\([^\n]+, output\)/);
});

test('travel, interiors, combat and save restoration use named transition profiles',()=>{
  const audio=read('site/audio.js');
  for(const profile of ['district','interior','exploration','combat_enter','combat_exit','restore'])assert.match(audio,new RegExp(`${profile}: \\d+`));
  assert.match(audio,/function contextForLocation/);
  assert.match(read('site/combat.js'),/transitionForContext\('combat', 'combat_enter'\)/);
  assert.equal((read('site/combat.js').match(/'combat_exit'/g)||[]).length,4);
  assert.match(read('site/map.js'),/contextForLocation\?\.\(loc\)/);
  assert.match(read('site/additions.js'),/contextForLocation\?\.\(loc\)/);
  assert.match(read('site/additions.js'),/!options\.suppressAudio/);
  assert.match(read('site/saves.js'),/updateLocationDisplay\(locData, \{ suppressAudio:true \}\)/);
  assert.match(read('site/saves.js'),/transitionForContext\(track,'restore'\)/);
});

test('city ambience fades across doors and district beds blend gradually',()=>{
  const audio=read('site/audio.js');
  assert.match(audio,/function stopCityAmbience\(\{fadeMs=1200,immediate=false\}=\{\}\)/);
  assert.match(audio,/ambience\.gain\.gain\.linearRampToValueAtTime\(0/);
  assert.match(audio,/CITY_DISTRICT_MIXES/);
  assert.match(audio,/cityAmbience\.crowd\.gain\.setTargetAtTime\(mix\.crowd/);
  assert.match(audio,/cityAmbience\.wind\.gain\.setTargetAtTime/);
  assert.match(audio,/districtId:pendingAmbience\?\.districtId/);
});
