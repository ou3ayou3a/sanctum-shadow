'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,'site',file),'utf8');

test('3D combat keeps enemy formations above the bottom action HUD',()=>{
  const combat=read('combat.js');
  assert.match(combat,/position:\{x:\(i-\(enemies\.length-1\)\/2\)\*2\.05,z:-5\.5-\(i%2\)\*\.7\}/);
  assert.match(combat,/cupside_barricade',x:0,z:-3\.1/);
});

test('3D combat HUD is compact and permits ground clicks through unused panel space',()=>{
  const css=read('world3d.css');
  assert.match(css,/world3d-combat-hud\{[^}]*right:18px[^}]*width:min\(520px[^}]*pointer-events:none/);
  assert.match(css,/world3d-combat-hud button\{[^}]*pointer-events:auto/);
});

test('3D healing and protective spells can target the player or an ally',()=>{
  const controller=read('world3d/combat-controller.js');
  assert.match(controller,/\['heal','revive','buff'\]\.includes\(spell\?\.type\)/);
  assert.match(controller,/target\.isPlayer&&!allySpell/);
});

test('3D combat disables AP actions when no action points remain',()=>{
  const controller=read('world3d/combat-controller.js');
  assert.match(controller,/costsAp=button\.dataset\.action==='attack'\|\|button\.dataset\.action==='item'/);
  assert.match(controller,/costsAp&&\(state\.apRemaining\|\|0\)<1/);
});

test('the monastery grants one bounded respite before its consecutive boss encounter',()=>{
  const story=read('story.js');
  assert.match(story,/!getFlag\('monastery_deep_respite'\)/);
  assert.match(story,/Math\.ceil\(maxHp \* \.3\)/);
  assert.match(story,/Math\.ceil\(maxMp \* \.4\)/);
  assert.match(story,/SHORT REST:/);
});

test('authored arrival scenes wait for random travel encounters and resume afterward',()=>{
  const map=read('map.js');
  const travel=read('travel.js');
  const combat=read('combat.js');
  assert.match(map,/function queueArrivalScene\(sceneId\)/);
  assert.match(map,/window\._travelEncounterScheduled/);
  assert.match(map,/queueArrivalScene\('cartographer_missing'\)/);
  assert.match(map,/function resumePendingArrivalScene\(\)/);
  assert.match(travel,/resumePendingArrivalScene\?\.\(\)/);
  assert.match(combat,/resumePendingArrivalScene\?\.\(\)/);
});

test('Mol arrival recovers when the village was visited before its quest activated',()=>{
  const map=read('map.js');
  assert.match(map,/const molQuestActive = .*activeQuests/);
  assert.match(map,/const molArrivalIncomplete = .*find_aldran/);
  assert.match(map,/!flags\.arrived_mol \|\| \(molQuestActive && molArrivalIncomplete\)/);
  assert.match(map,/queueArrivalScene\('mol_village_arrival'\)/);
});

test('travel encounters render above the 3D world instead of inside the hidden chronicle log',()=>{
  const travel=read('travel.js');
  assert.match(travel,/const inWorld3D = .*vt3dActive/);
  assert.match(travel,/panel\.classList\.add\('world3d-travel-encounter'\)/);
  assert.match(travel,/gameLog && !inWorld3D/);
  assert.match(travel,/\.travel-enc-panel\.world3d-travel-encounter/);
  assert.match(travel,/z-index: 1800/);
});

test('Aldran combat victory applies its authored state and multiplayer host authority',()=>{
  const combat=read('combat.js');
  const multiplayer=read('multiplayer.js');
  assert.match(combat,/function recordAuthoredCombatVictory\(questScene, defeatedIds/);
  assert.match(combat,/questScene === 'aldran_church_soldiers'/);
  assert.match(combat,/flags\.heretic_protected = true/);
  assert.match(combat,/combat:victory:\$\{questScene\}/);
  assert.match(multiplayer,/window\.mp\.isHost && questScene/);
  assert.match(multiplayer,/recordAuthoredCombatVictory/);
});

test('travelling to the current location is a no-op and cannot roll a duplicate encounter',()=>{
  const map=read('map.js');
  const travel=read('travel.js');
  assert.match(map,/loc\.id === mapState\.currentLocation/);
  assert.match(map,/Already at \$\{loc\.name\}/);
  assert.match(map,/return false;/);
  assert.match(travel,/loc\.id === window\.mapState\?\.currentLocation/);
  assert.match(travel,/return _orig\(loc\);/);
});

test('the 3D recovery controls can open the camp system',()=>{
  const camp=read('camp.js');
  const world=read('world3d/world-engine.js');
  assert.match(camp,/window\.openCampPanel = openCampPanel/);
  assert.match(camp,/gameLog && !inWorld3D/);
  assert.match(camp,/body\.vt-3d-active > \.camp-panel/);
  assert.match(camp,/addEventListener\('sanctum:open-camp', openCampPanel\)/);
  assert.match(world,/camp:\(\)=>window\.dispatchEvent\(new CustomEvent\('sanctum:open-camp'\)\)/);
  assert.match(world,/vitalsCampButton\.addEventListener\('click',\(\)=>this\.openUtility\('camp'\)\)/);
});
