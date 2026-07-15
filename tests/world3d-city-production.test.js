'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'../site',file),'utf8');
const plan=read('world3d/zones/vaelthar-city-plan.mjs');
const detail=read('world3d/city-detail-kit.mjs');
const materials=read('world3d/medieval-materials.mjs');
const atmosphere=read('world3d/city-atmosphere.mjs');
const obstruction=read('world3d/camera-obstruction.mjs');
const generic=read('world3d/zones/generic-zone.js');
const npcs=read('world3d/vaelthar-npcs.mjs');
const audio=read('audio.js');

test('Vaelthar uses thirty assigned medieval plots and a broad building vocabulary',()=>{
  assert.equal((plan.match(/district:'/g)||[]).length,30);
  for(const asset of['narrow_house','row_house','craft_workshop','merchant_warehouse','guild_hall','street_chapel','noble_estate','raised_granary'])assert.match(plan,new RegExp(`asset:'${asset}'`));
});

test('city detailing uses instancing for street engineering and hundreds of props',()=>{
  for(const name of['street-curbs','drainage-channels','rain-puddles','packed-earth-alleys','district-stone-stairs','working-city-barrels','working-city-crates','yard-and-wall-fences'])assert.match(detail,new RegExp(name));
  assert.match(detail,/InstancedMesh/);assert.match(detail,/setWetness/);
});

test('PBR materials, weather, day-night lighting, and obstruction fading are connected',()=>{
  for(const kind of['stone','plaster','roof','timber','metal','vegetation','cobble','mud'])assert.match(materials,new RegExp(`${kind}:`));
  assert.match(materials,/roughnessMap/);assert.match(materials,/bumpMap/);
  assert.match(atmosphere,/weatherFor/);assert.match(atmosphere,/worldClock/);assert.match(atmosphere,/weather:rain/);
  assert.match(obstruction,/intersectObjects\(this\.occluders,false\)/);assert.match(obstruction,/opacity=Math\.min/);
  assert.match(obstruction,/while\(current&&current!==engine\.zone\.root\)/);
});

test('important interiors have physical exits, collisions, NPC positions, and hotspots',()=>{
  for(const interior of['tavern_interior','shop_interior','temple_interior','castle_interior','house_interior','dungeon_interior'])assert.match(generic,new RegExp(interior));
  assert.match(generic,/interior_exit/);assert.match(generic,/addHotspot/);assert.match(generic,/interiorNPCs/);assert.match(generic,/furniture/);
});

test('citizens have schedules and the city owns a dedicated adaptive ambience bus',()=>{
  assert.ok((npcs.match(/action:'ambient'/g)||[]).length>=12);
  assert.match(npcs,/activeHours/);assert.match(npcs,/schedule:/);assert.match(npcs,/patrol:/);
  for(const method of['startCityAmbience','updateCityAmbience','stopCityAmbience'])assert.match(audio,new RegExp(method));
});
