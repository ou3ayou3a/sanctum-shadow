const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Cupside vertical slice has a distinct authored atmosphere',()=>{
  const source=read('site/world3d/vaelthar-vertical-slice.mjs');
  for(const feature of['CUPSIDE LANE','cupside-lantern-post','cupside-evening-drizzle','cupside-hand-laid-cobble','cupside_checkpoint'])assert.match(source,new RegExp(feature));
});

test('3D dialogue keeps numbered choices and the unrestricted open choice',()=>{
  const source=read('site/dialogue.js');
  assert.match(source,/cp-option-index/);
  assert.match(source,/cp-option-text/);
  assert.match(source,/Say something else…/);
  assert.match(source,/toggleConvFreeform/);
  assert.match(source,/getPortraitHTML\(npc\.id, npc\.name, npc\.portrait\)/);
  assert.doesNotMatch(read('site/visuals.js'),/npc-portrait-emoji">\$\{npcIdOrPortrait/);
});

test('3D combat presentation exposes target health, initiative, AP, and hotkeys',()=>{
  const source=read('site/world3d/combat-controller.js');
  for(const feature of['w3c-initiative','w3c-target-health','w3c-action-deck','Digit1','Digit2','Space'])assert.match(source,new RegExp(feature));
  const css=read('site/world3d.css');
  for(const selector of['.w3c-initiative-chip','.w3c-target-health','.w3c-action-deck','.cp-option-index'])assert.match(css,new RegExp(selector.replaceAll('.','\\.')));
});

test('city readability preserves daylight and fades full obstructing structures',()=>{
  const atmosphere=read('site/world3d/city-atmosphere.mjs');
  assert.match(atmosphere,/toneMappingExposure=INTERIOR_KITS\.has\(this\.kit\)\?1\.08:\.9\+daylight\*\.5/);
  const obstruction=read('site/world3d/camera-obstruction.mjs');
  assert.match(obstruction,/relatedMeshes\(mesh\)/);
  assert.match(obstruction,/this\.fade\(mesh\)\.target=\.045/);
});
