'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.join(__dirname,'..');
const site=path.join(project,'site');
const manifest=require('../site/world3d/assets/production/manifest.json');
const actorSource=fs.readFileSync(path.join(site,'world3d/character-actor.js'),'utf8');
const equipmentSource=fs.readFileSync(path.join(site,'world3d/class-equipment.js'),'utf8');

test('the reproducible Blender source pipeline and editable library are present',()=>{
  for(const file of['tools/blender/build_visual_library.py','tools/blender/README.md','tools/blender/sanctum-visual-library.blend']){
    assert.ok(fs.statSync(path.join(project,file)).size>0,file);
  }
});

test('the production manifest covers world architecture, interiors, equipment, and all launch races',()=>{
  assert.equal(manifest.version,1);
  assert.equal(Object.keys(manifest.assets).length,45);
  const byCategory=Object.values(manifest.assets).reduce((result,asset)=>{
    result[asset.category]=(result[asset.category]||0)+1;
    return result;
  },{});
  assert.deepEqual(byCategory,{environment:25,interiors:6,equipment:7,characters:7});
  for(const building of['narrow_house','row_house','craft_workshop','merchant_warehouse','guild_hall','street_chapel','noble_estate','raised_granary'])assert.equal(manifest.assets[building].category,'environment');
  for(const race of['human','dwarf','elf','high_elf','dark_elf','orc','goblin']){
    const asset=manifest.assets[`character_${race}`];
    assert.equal(asset.race,race);
    for(const clip of['Idle','Walk','Run','Walk_Start','Walk_Stop','Turn_Left','Turn_Right','Interact','Weapon_Draw','Weapon_Sheathe','Combat_Idle','Attack_Slash','Attack_Smite','Cast','Bow_Shot','Block','Dodge','Hit','Death'])assert.ok(asset.animations.includes(clip),`${race}: ${clip}`);
  }
});

test('every production GLB exists and the complete browser payload stays below 30 MiB',()=>{
  let bytes=0;
  for(const [name,asset] of Object.entries(manifest.assets)){
    const file=path.join(site,asset.url);
    const size=fs.statSync(file).size;
    assert.ok(size>0,name);
    assert.equal(size,asset.bytes,`${name} manifest size`);
    bytes+=size;
  }
  assert.ok(bytes<30*1024*1024,`production GLBs are ${(bytes/1024/1024).toFixed(1)} MiB`);
});

test('characters and class equipment use the Blender library with procedural fallbacks',()=>{
  assert.match(actorSource,/productionRaceModel/);
  assert.match(actorSource,/playOneShot/);
  for(const clip of['walk_start','walk_stop','turn_left','turn_right','interact','weapon_draw','weapon_sheathe','attack_slash','attack_smite','bow_shot','cast','block','dodge','hit','death'])assert.match(actorSource,new RegExp(clip));
  assert.match(actorSource,/updateLocomotionBlend/);
  assert.match(actorSource,/setEquipmentDrawn/);
  assert.match(equipmentSource,/GLTFLoader/);
  assert.match(equipmentSource,/world3d\/assets\/production\/equipment/);
  assert.match(equipmentSource,/equipmentSlot='held'/);
  assert.match(equipmentSource,/equipmentSlot='stowed'/);
  assert.match(equipmentSource,/bindStowedSockets/);
  assert.match(equipmentSource,/bone\.attach\(object\)/);
  assert.match(equipmentSource,/equipmentBone=boneName/);
  assert.match(equipmentSource,/replace\(':',''\)/);
  assert.match(equipmentSource,/Math\.PI\/2/);
  assert.match(equipmentSource,/procedural fallback/);
});
