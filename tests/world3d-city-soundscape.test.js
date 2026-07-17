const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Vaelthar owns a complete positional city soundscape',async()=>{
  const soundscape=await import('../site/world3d/city-soundscape.mjs');
  const emitters=soundscape.citySoundscapeForZone('vaelthar_city');
  assert.equal(emitters.length,7);
  assert.deepEqual(new Set(emitters.map(item=>item.kind)),new Set(soundscape.CITY_SOUND_KINDS));
  assert.equal(new Set(emitters.map(item=>item.id)).size,emitters.length);
  for(const emitter of emitters){
    assert.equal(emitter.position.length,3);
    assert.ok(emitter.position.every(Number.isFinite));
    assert.ok(Math.abs(emitter.position[0])<=44&&Math.abs(emitter.position[2])<=44);
    assert.ok(emitter.refDistance>0&&emitter.maxDistance>emitter.refDistance);
    assert.ok(emitter.volume>0&&emitter.volume<=.5);
    assert.ok(emitter.interval>=3000);
  }
  assert.deepEqual(soundscape.citySoundscapeForZone('thornwood'),[]);
});

test('sound emitter schedules support daytime and overnight districts',async()=>{
  const {citySoundscapeForZone,soundEmitterActiveAtHour}=await import('../site/world3d/city-soundscape.mjs');
  const byKind=Object.fromEntries(citySoundscapeForZone('vaelthar_city').map(item=>[item.kind,item]));
  assert.equal(soundEmitterActiveAtHour(byKind.market,12),true);
  assert.equal(soundEmitterActiveAtHour(byKind.market,2),false);
  assert.equal(soundEmitterActiveAtHour(byKind.tavern,23),true);
  assert.equal(soundEmitterActiveAtHour(byKind.tavern,1),true);
  assert.equal(soundEmitterActiveAtHour(byKind.tavern,5),false);
  assert.equal(soundEmitterActiveAtHour(byKind.guards,3),true);
});

test('city district audio uses stable regions with boundary hysteresis',async()=>{
  const {VAELTHAR_AUDIO_DISTRICTS,cityDistrictForPosition}=await import('../site/world3d/city-soundscape.mjs');
  assert.equal(VAELTHAR_AUDIO_DISTRICTS.length,6);
  assert.equal(cityDistrictForPosition({x:17,z:14}),'ash_market');
  assert.equal(cityDistrictForPosition([-16,0,13]),'cupside_lane');
  assert.equal(cityDistrictForPosition([13,0,1],null),'outer_ward');
  assert.equal(cityDistrictForPosition([13,0,1],'covenant_square'),'covenant_square');
  assert.equal(cityDistrictForPosition([22,0,1],'covenant_square'),'outer_ward');
});

test('Web Audio uses HRTF panners and follows the 3D camera listener',()=>{
  const audio=read('site/audio.js');
  for(const feature of["createPanner()","panningModel='HRTF'","distanceModel='inverse'",'updateCityListener','listener.positionX','triggerCityEmitter','getCitySoundscapeState'])assert.ok(audio.includes(feature),`missing ${feature}`);
  for(const kind of['smithy','bells','market','tavern','animals','guards'])assert.match(audio,new RegExp(`case '${kind}'`));
  const atmosphere=read('site/world3d/city-atmosphere.mjs');
  assert.match(atmosphere,/citySoundscapeForZone/);
  assert.match(atmosphere,/startCityAmbience\?\.\(\{zoneId:this\.engine\.zone\.id,emitters:this\.soundEmitters,districtId:this\.audioDistrict\}\)/);
  assert.match(atmosphere,/camera\.getWorldDirection/);
  assert.match(atmosphere,/updateCityListener/);
  assert.match(atmosphere,/dataset\.citySoundEmitters/);
  assert.match(atmosphere,/dataset\.citySoundListener='tracking'/);
  assert.match(atmosphere,/dataset\.cityAudioDistrict/);
});
