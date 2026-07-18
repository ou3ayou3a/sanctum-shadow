'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');

test('character appearances are deterministic, identity-specific, and browser-safe',async()=>{
  const {createCharacterAppearance,appearanceHash,CHARACTER_APPEARANCE_VERSION}=await import('../site/world3d/character-appearance.mjs');
  assert.equal(CHARACTER_APPEARANCE_VERSION,1);
  assert.equal(appearanceHash('Captain Rhael'),appearanceHash('Captain Rhael'));
  const first=createCharacterAppearance({identity:'market_porter',race:'dwarf',classId:'warrior',title:'Market Porter'});
  const repeated=createCharacterAppearance({identity:'market_porter',race:'dwarf',classId:'warrior',title:'Market Porter'});
  const second=createCharacterAppearance({identity:'street_mason',race:'orc',classId:'warrior',title:'Wall Mason'});
  assert.deepEqual(first,repeated);
  assert.notEqual(first.seed,second.seed);
  assert.ok(['full','braided','short','stubble'].includes(first.beard));
  assert.equal(second.role,'worker');
  assert.ok(Object.isFrozen(first));
});

test('professions produce suitable silhouettes and equipment policies',async()=>{
  const {createCharacterAppearance,inferAppearanceRole}=await import('../site/world3d/character-appearance.mjs');
  assert.equal(inferAppearanceRole({title:'Royal Guard'}),'guard');
  assert.equal(inferAppearanceRole({title:'Archive Copyist'}),'scholar');
  assert.equal(inferAppearanceRole({title:'Blacksmith'}),'worker');
  assert.equal(inferAppearanceRole({title:'Temple Acolyte'}),'cleric');
  const guard=createCharacterAppearance({identity:'guard',title:'Royal Guard'});
  const baker=createCharacterAppearance({identity:'baker',title:'Baker'});
  const player=createCharacterAppearance({identity:'hero',isPlayer:true});
  assert.equal(guard.armor,true);assert.equal(guard.showClassEquipment,true);
  assert.equal(baker.armor,false);assert.equal(baker.showClassEquipment,false);
  assert.equal(player.role,'adventurer');assert.equal(player.showClassEquipment,true);
});

test('named NPCs retain authored identities while races retain distinct skin families',async()=>{
  const {createCharacterAppearance}=await import('../site/world3d/character-appearance.mjs');
  const rhael=createCharacterAppearance({identity:'captain_rhael',race:'human',title:'Captain of the Watch'});
  const mourne=createCharacterAppearance({identity:'sister_mourne',race:'human',title:'Inquisitor'});
  const drow=createCharacterAppearance({identity:'cloaked_figure_1',race:'dark_elf'});
  assert.equal(rhael.build,'broad');assert.equal(rhael.role,'guard');
  assert.equal(mourne.hair,'tonsure');assert.equal(mourne.role,'cleric');
  assert.ok(drow.skinColor<0x999999);
});

test('all actor sources pass stable appearance identities into the shared customization pipeline',()=>{
  const actor=read('site/world3d/character-actor.js'),customization=read('site/world3d/character-customization.js'),assets=read('site/world3d/production-assets.mjs');
  const npc=read('site/world3d/npc-manager.js'),party=read('site/world3d/party-manager.js'),combat=read('site/world3d/combat-controller.js'),bootstrap=read('site/world3d/bootstrap.js');
  assert.match(actor,/createCharacterAppearance/);assert.match(actor,/applyCharacterCustomization/);
  for(const marker of['appearance:face','appearance:hair','appearance:outfit','addFace','addHair','addOutfit','pauldron','cloak'])assert.match(customization,new RegExp(marker));
  assert.match(npc,/identity:config\.appearanceId\|\|config\.id/);
  assert.match(party,/identity:character\.name\|\|player\.name\|\|player\.id/);
  assert.match(combat,/identity:partyCharacter\?\.name\|\|combatant\.id\|\|combatant\.name/);
  assert.match(bootstrap,/isPlayer:true/);
  for(const archetype of['Warrior','Cleric','Wizard','Rogue','Ranger'])assert.match(assets,new RegExp(`${archetype}\\.glb`));
  assert.match(actor,/bindNativeEquipment/);assert.match(actor,/sword_attack2/);assert.match(actor,/dagger_attack2/);assert.match(actor,/staff_attack/);
});

test('the medieval skinned roster ships every runtime archetype within a browser-safe budget',()=>{
  const directory=path.join(project,'site/world3d/assets/characters/rpg'),files=['Warrior.glb','Monk.glb','Cleric.glb','Wizard.glb','Rogue.glb','Ranger.glb'];
  let bytes=0;for(const file of files){const target=path.join(directory,file);assert.ok(fs.existsSync(target),`${file} is missing`);bytes+=fs.statSync(target).size;}
  assert.ok(bytes<20*1024*1024,`character payload is ${(bytes/1024/1024).toFixed(1)} MiB`);
  const sources=read('site/world3d/assets/characters/ASSET_SOURCES.md');assert.match(sources,/CC0 1\.0 Universal/);assert.match(sources,/RPG Character Pack/);
});
