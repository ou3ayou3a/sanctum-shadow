const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const site=path.join(__dirname,'../site');
const world3d=path.join(site,'world3d');
const read=file=>fs.readFileSync(path.join(world3d,file),'utf8');
const HERO_PATH='world3d/assets/production/characters/heroes/fallen_paladin.glb';
const HERO_FILE=path.join(site,HERO_PATH);
const MAX_HERO_BYTES=4*1024*1024;
const JOINT_NAMES_SHA1='0517163dd961e4e448aba9882c1bed4dff22831e';
const CLIP_NAMES_SHA1='24c68fde57a288083fdcaa8e1bb49e3d7acbb34c';

function runtimeSources(directory=site){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())return['prototype','vendor','assets','art','node_modules'].includes(entry.name)?[]:runtimeSources(file);
    return /\.(?:js|mjs|html)$/.test(entry.name)?[file]:[];
  });
}
function glbJson(file){
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.toString('utf8',0,4),'glTF','GLB magic');
  assert.equal(bytes.readUInt32LE(4),2,'glTF 2.0 container');
  const length=bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16),0x4E4F534A,'first chunk is JSON');
  return{json:JSON.parse(bytes.toString('utf8',20,20+length)),bytes:bytes.length};
}
const sha1=value=>crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');

test('the hero model is a fixed asset path outside the 45-asset manifest',async()=>{
  const assets=await import('../site/world3d/production-assets.mjs');
  assert.equal(assets.HERO_MODEL_PATH,HERO_PATH);
  const hero=assets.heroModel('fallen_paladin');
  assert.ok(hero,'fallen_paladin hero is registered');
  assert.match(hero.url,/^world3d\/assets\/production\/characters\/heroes\/fallen_paladin\.glb\?v=\d+$/);
  assert.equal(hero.weapon,'fallen_longsword');
  assert.equal(hero.tint,false);
  assert.ok(hero.height>1.5&&hero.height<2.5,'hero standing height is recorded in metres');
  assert.ok(Object.isFrozen(assets.HERO_MODELS)&&Object.isFrozen(hero));
  for(const id of['constructor','toString','__proto__','',null,undefined,'paladin'])assert.equal(assets.heroModel(id),null,`heroModel(${String(id)})`);
  const manifest=require('../site/world3d/assets/production/manifest.json');
  assert.ok(Object.values(manifest.assets).every(asset=>!String(asset.url).includes('/heroes/')),'hero stays out of manifest.json');
  assert.ok(Object.values(assets.RACE_MODEL_URLS).every(url=>!url.includes('/heroes/')),'race models never point at the hero');
});

test('only player paladins map to the Fallen Paladin hero',async()=>{
  const {heroIdForCharacter}=await import('../site/world3d/production-assets.mjs');
  assert.equal(heroIdForCharacter({class:'paladin'}),'fallen_paladin');
  assert.equal(heroIdForCharacter({class:'Paladin',race:'dwarf'}),'fallen_paladin');
  for(const characterClass of['warrior','cleric','mage','rogue','ranger'])assert.equal(heroIdForCharacter({class:characterClass}),null,characterClass);
  for(const malformed of[null,undefined,'paladin',42,[],{},{class:42},{class:{toString:()=>'paladin'}},{class:'paladin knight'},{class:'<paladin>'},{race:'human'}])assert.equal(heroIdForCharacter(malformed),null,JSON.stringify(malformed));
});

test('the hero is normalised to each race model height with one uniform scale',async()=>{
  const {heroModel,heroScaleForRace,RACE_MODEL_HEIGHTS}=await import('../site/world3d/production-assets.mjs');
  const {RACE_IDS}=await import('../site/world3d/race-profiles.mjs');
  const hero=heroModel('fallen_paladin');
  assert.deepEqual(Object.keys(RACE_MODEL_HEIGHTS).sort(),[...RACE_IDS].sort());
  for(const race of RACE_IDS){
    const scale=heroScaleForRace('fallen_paladin',race);
    assert.ok(Math.abs(scale*hero.height-RACE_MODEL_HEIGHTS[race])<1e-9,race);
    assert.equal(heroScaleForRace(hero,race),scale,`${race} accepts the hero object`);
  }
  assert.ok(heroScaleForRace('fallen_paladin','goblin')<heroScaleForRace('fallen_paladin','dwarf'));
  assert.ok(heroScaleForRace('fallen_paladin','dwarf')<heroScaleForRace('fallen_paladin','human'));
  assert.equal(heroScaleForRace('fallen_paladin','not-a-race'),heroScaleForRace('fallen_paladin','human'));
  assert.equal(heroScaleForRace(null,'dwarf'),1);
});

test('hero ids reach CharacterActor only from the player, party members and combat allies',()=>{
  const sources=runtimeSources();
  const callers=sources.filter(file=>/heroIdForCharacter\s*\(/.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(site,file)).sort();
  assert.deepEqual(callers,['world3d/bootstrap.js','world3d/combat-controller.js','world3d/party-manager.js','world3d/production-assets.mjs']);
  const heroUsers=runtimeSources(world3d).filter(file=>/\bhero\b/i.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(site,file)).sort();
  assert.deepEqual(heroUsers,['world3d/bootstrap.js','world3d/character-actor.js','world3d/class-equipment.js','world3d/combat-controller.js','world3d/party-manager.js','world3d/production-assets.mjs'],'no other 3D module knows about heroes');

  const npc=read('npc-manager.js');
  assert.doesNotMatch(npc,/hero/i,'NPCs never receive a hero model');
  assert.match(npc,/new CharacterActor\(\{modelUrl:this\.modelUrl,race:config\.race\|\|'human',characterClass:config\.classId\|\|'warrior',scale:\.94\}\)/);

  const bootstrap=read('bootstrap.js');
  assert.match(bootstrap,/const hero=heroIdForCharacter\(window\.gameState\?\.character\);/);
  assert.match(bootstrap,/character:\{modelUrl:characterModel,race,characterClass,hero\}/);
  assert.match(bootstrap,/const characterModel='prototype\/assets\/elf-ranger\.glb';/,'the shared characterConfig.modelUrl never becomes the hero URL');
  assert.doesNotMatch(bootstrap,/heroes\//);

  const party=read('party-manager.js');
  assert.match(party,/new CharacterActor\(\{modelUrl:this\.modelUrl,race:character\.race\|\|'human',characterClass:character\.class\|\|'warrior',hero:heroIdForCharacter\(character\),scale:\.98\}\)/);

  const combat=read('combat-controller.js');
  assert.match(combat,/hero:partyCharacter\?heroIdForCharacter\(partyCharacter\):null/,'combat passes a hero only for a real party character');
  assert.equal((combat.match(/heroIdForCharacter\(/g)||[]).length,1);
  assert.match(combat,/function inferClass\(combatant\)/,'enemies still use name-inferred classes without a hero');

  const engine=read('world-engine.js');
  assert.match(engine,/this\.actor=new CharacterActor\(this\.characterConfig\)/);
  assert.equal((engine.match(/new CharacterActor\(/g)||[]).length,1,'world-engine only builds the local player actor');
  for(const file of['class-roster-preview.js','race-roster-preview.js'])assert.doesNotMatch(read(file),/hero/i,`${file} previews stay on race models`);
});

test('CharacterActor opts into the hero, skips race tint and add-ons, and falls back to the race model',()=>{
  const actor=read('character-actor.js');
  assert.match(actor,/hero = null \} = \{\}\)/);
  assert.match(actor,/this\.hero=heroModel\(hero\)/);
  assert.match(actor,/this\.heroScale=this\.hero\?heroScaleForRace\(this\.hero,this\.race\):1/);
  assert.match(actor,/this\.modelUrl=this\.hero\?\.url\|\|productionRaceModel\(this\.race,modelUrl\)/);
  assert.match(actor,/this\.productionModel=!!this\.hero\|\|/,'heroes skip applyRaceDetails');
  assert.match(actor,/this\.hero\?\[this\.heroScale,this\.heroScale,this\.heroScale\]/,'uniform race-height scale');
  assert.match(actor,/this\.hero&&this\.hero\.tint===false\?0xffffff:this\.profile\.materialTint/);
  assert.match(actor,/equipClass\(this,this\.hero\?\{\.\.\.this\.classProfile,weapon:this\.hero\.weapon\}:this\.classProfile\)/);
  assert.match(actor,/if\(this\.hero&&!this\.heroFallbackTried\)/);
  assert.match(actor,/this\.modelUrl=productionRaceModel\(this\.race\);this\.productionModel=true;\s*return this\.load\(\);/,'a failed hero retries with the race production model before any capsule');
  assert.ok(actor.indexOf('heroFallbackTried=true')<actor.indexOf('using the lightweight fallback'),'race fallback runs before the capsule fallback');
  assert.match(actor,/using the lightweight fallback/);
});

test('class equipment has a fallen_longsword branch that uses the GLB FP_Sword node',()=>{
  const equipment=read('class-equipment.js');
  assert.match(equipment,/if\(profile\.weapon==='fallen_longsword'\)\{/);
  assert.match(equipment,/actor\.model\.getObjectByName\('FP_Sword'\)/);
  assert.match(equipment,/attach\(actor\.model,'mixamorig:RightHand',blade,/,'held in the right hand');
  assert.match(equipment,/stowed:Object\.freeze\(\{position:\[[^\]]+\],rotation:\[[^\]]+\],scale:\.01,bone:'mixamorig:Hips'\}\)/,'stowed socket is on the hip');
  assert.match(equipment,/stow\(gear,sheathed,stowed\.position\.map\(v=>v\*k\),stowed\.rotation,stowed\.scale\*k,stowed\.bone\)/,'stowed sword scales with the hero model');
  assert.match(equipment,/attach\(actor\.model,'mixamorig:RightHand',blade,held\)/,'held socket comes from FALLEN_LONGSWORD_SOCKETS');
  assert.match(equipment,/if\(profile\.weapon==='fallen_longsword'\)attach\(actor\.model,'mixamorig:RightHand',sword\(profile,95\)/,'procedural fallback keeps a sword in hand');
  assert.match(equipment,/if\(profile\.weapon==='mace_shield'\)/,'non-hero paladins keep mace and shield');
});

test('every importer of a changed module loads the same versioned copy',()=>{
  const versions=(pattern)=>new Set(runtimeSources().flatMap(file=>[...fs.readFileSync(file,'utf8').matchAll(pattern)].map(match=>match[1])));
  assert.deepEqual([...versions(/character-actor\.js\?v=(\d+)/g)],['181']);
  assert.deepEqual([...versions(/class-equipment\.js\?v=(\d+)/g)],['165']);
  assert.deepEqual([...versions(/party-manager\.js\?v=(\d+)/g)],['181']);
  assert.deepEqual([...versions(/combat-controller\.js\?v=(\d+)/g)],['228']);
  assert.deepEqual([...versions(/npc-manager\.js\?v=(\d+)/g)],['234']);
  assert.deepEqual([...versions(/world-engine\.js\?v=(\d+)/g)],['262']);
  assert.deepEqual([...versions(/bootstrap\.js\?v=(\d+)/g)],['262']);
  assert.deepEqual([...versions(/class-roster-preview\.js\?v=(\d+)/g)],['166']);
  assert.deepEqual([...versions(/race-roster-preview\.js\?v=(\d+)/g)],['169']);
  for(const file of['character-actor.js','bootstrap.js','party-manager.js','combat-controller.js'])assert.match(read(file),/production-assets\.mjs\?v=165'/,file);
});

test('the splash screen credits the CC BY 4.0 hero model',()=>{
  const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
  const splash=html.slice(html.indexOf('id="splash-screen"'),html.indexOf('<!-- MODE SELECT -->'));
  assert.match(splash,/Fallen Paladin in Corrupted Black Plate Armor/);
  assert.match(splash,/https:\/\/sketchfab\.com\/3d-models\/fallen-paladin-in-corrupted-black-plate-armor-df3056caff7e4f079bd4eec0fa9bcd54/);
  assert.match(splash,/Pigcraft/);
  assert.match(splash,/https:\/\/sketchfab\.com\/s8819296/);
  assert.match(splash,/https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  assert.match(splash,/CC BY 4\.0/);
  assert.match(splash,/rigged and optimised for this game/);
});

test('the hero GLB keeps the game rig, clips, separate sword and loader-safe extensions',()=>{
  const {json,bytes}=glbJson(HERO_FILE);
  assert.ok(bytes<=MAX_HERO_BYTES,`hero GLB is ${(bytes/1024/1024).toFixed(2)} MiB (limit 4 MiB)`);
  for(const extension of json.extensionsRequired||[])assert.ok(['KHR_mesh_quantization','EXT_texture_webp'].includes(extension),`required extension ${extension}`);
  for(const extension of json.extensionsUsed||[])assert.doesNotMatch(extension,/draco|meshopt|basisu|ktx/i,`no decoder-dependent extension (${extension})`);
  assert.equal(json.skins?.length,1,'one skin');
  const joints=json.skins[0].joints.map(index=>json.nodes[index].name);
  assert.equal(joints.length,49);assert.equal(sha1(joints),JOINT_NAMES_SHA1,'joint names and order match human.glb');
  const clips=(json.animations||[]).map(animation=>animation.name);
  assert.equal(clips.length,26);assert.equal(sha1(clips),CLIP_NAMES_SHA1,'clip names and order match human.glb');
  assert.equal(json.animations.reduce((total,animation)=>total+animation.channels.length,0),3849);
  const character=json.nodes.find(node=>node.name==='Character');
  assert.ok(character,'Character root');
  [-0.70711,0,0,0.70711].forEach((value,index)=>assert.ok(Math.abs((character.rotation||[0,0,0,1])[index]-value)<1e-4,'Character rotation'));
  (character.scale||[1,1,1]).forEach(value=>assert.ok(Math.abs(value-.01)<1e-6,'Character scale'));
  const swordIndex=json.nodes.findIndex(node=>node.name==='FP_Sword');
  assert.ok(swordIndex>=0,'FP_Sword node');
  const scene=json.scenes[json.scene||0];
  assert.ok(scene.nodes.includes(swordIndex),'FP_Sword is a root-level node');
  const swordTree=[];const walk=index=>{swordTree.push(json.nodes[index]);for(const child of json.nodes[index].children||[])walk(child);};walk(swordIndex);
  assert.ok(swordTree.some(node=>node.mesh!==undefined),'FP_Sword has geometry');
  assert.ok(swordTree.every(node=>node.skin===undefined),'FP_Sword is not skinned');
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)for(const attribute of Object.keys(primitive.attributes))assert.doesNotMatch(attribute,/^TEXCOORD_[1-9]/,`${mesh.name} only uses TEXCOORD_0`);
});

test('the hero GLB carries its CC BY 4.0 copyright',t=>{
  const {json}=glbJson(HERO_FILE);
  if(json.asset?.extras?.sanctumHeroPlaceholder){t.skip('development placeholder hero GLB; replace it with the final Fallen Paladin build');return;}
  assert.match(json.asset.copyright||'',/Pigcraft/);
  assert.match(json.asset.copyright||'',/CC BY 4\.0/);
});

test('manifest GLBs plus the hero stay below the 30 MiB browser payload',()=>{
  const manifest=require('../site/world3d/assets/production/manifest.json');
  const total=Object.values(manifest.assets).reduce((bytes,asset)=>bytes+fs.statSync(path.join(site,asset.url)).size,0)+fs.statSync(HERO_FILE).size;
  assert.ok(total<30*1024*1024,`production GLBs plus hero are ${(total/1024/1024).toFixed(1)} MiB`);
});

test('the hero cape drape morph is in the GLB and is driven only by the Death clip',async t=>{
  const {json}=glbJson(HERO_FILE);
  if(json.asset?.extras?.sanctumHeroPlaceholder){t.skip('development placeholder hero GLB');return;}
  const skinned=json.nodes.filter(node=>node.skin!==undefined&&node.mesh!==undefined);
  assert.equal(skinned.length,1,'one skinned body node');
  const mesh=json.meshes[skinned[0].mesh];
  assert.equal(mesh.primitives.length,1,'one body primitive');
  assert.deepEqual(mesh.extras?.targetNames,['FP_CapeDrape'],'single named corrective morph');
  assert.deepEqual(mesh.weights,[0],'morph rests at 0');
  assert.deepEqual(mesh.primitives[0].targets.map(target=>Object.keys(target)),[['POSITION']],'position-only morph');
  for(const node of json.nodes)if(node.mesh!==undefined&&node!==skinned[0])assert.ok(!json.meshes[node.mesh].primitives.some(p=>p.targets),'only the body has morphs');

  const actor=await import('../site/world3d/character-actor.js');
  assert.equal(actor.CAPE_DRAPE_TARGET,'FP_CapeDrape');
  assert.deepEqual([...actor.CAPE_DRAPE_RAMP],[.15,.65]);
  const death={time:0,getClip:()=>({duration:1.583})};
  const at=progress=>{death.time=progress*1.583;return actor.capeDrapeInfluence('death',death);};
  assert.equal(at(0),0);assert.equal(at(.15),0);assert.ok(at(.4)>0&&at(.4)<1);assert.equal(at(.65),1);assert.equal(at(1),1);
  for(const state of['idle','walk','run','hit','attack_heavy','attack_smite','combat_idle','block'])assert.equal(actor.capeDrapeInfluence(state,{time:1.583,getClip:()=>({duration:1.583})}),0,state);
  assert.equal(actor.capeDrapeInfluence('death',null),0);
  const source=read('character-actor.js');
  assert.match(source,/this\.capeDrape=this\.hero\?findCapeDrape\(this\.model\):null/,'only hero models look for the morph');
  assert.match(source,/if \(this\.mixer\) this\.mixer\.update\(dt\);\n\s*if\(this\.capeDrape\)this\.updateCapeDrape\(\);/,'driven every frame right after the mixer');

  const tools=path.join(__dirname,'../tools/hero');
  const drape=fs.readFileSync(path.join(tools,'cape-drape.mjs'),'utf8'),verify=fs.readFileSync(path.join(tools,'verify-hero.cjs'),'utf8');
  assert.match(drape,/DRAPE_TARGET = 'FP_CapeDrape'/);assert.match(drape,/DRAPE_RAMP = \[0\.15, 0\.65\]/);
  assert.match(verify,/DRAPE_TARGET = 'FP_CapeDrape'/);assert.match(verify,/DRAPE_RAMP = \[0\.15, 0\.65\]/,'verify-hero measures Death with the same ramp');
});

test('the held and stowed sword sockets, scabbard and swap timing match the sword-sockets.py design',()=>{
  const equipment=read('class-equipment.js');
  const sockets=fs.readFileSync(path.join(__dirname,'../tools/hero/sword-sockets.py'),'utf8');
  assert.match(sockets,/HELD_CHANNEL_CENTRE = \(-4\.5, 9\.75, 0\.0\)/);
  assert.match(sockets,/HELD_S_GUARD = 14\.5/);
  assert.match(sockets,/STOW_GUARD = \(-0\.33, 0\.20, 1\.12\)/,'tight left-hip carry: crossguard on the locket just in front of the hip plate');
  assert.match(sockets,/STOW_THETA, STOW_PHI, STOW_ROLL = 50\.0, 9\.0, 90\.0/,'blade 50 deg back, 9 deg out, flat to the thigh');
  assert.match(equipment,/held:Object\.freeze\(\{position:\[2\.971,12\.156,12\.238\],rotation:\[3\.1416,1\.0123,-1\.8093\]\}\)/,'held socket = sword-sockets.py held_socket()');
  assert.match(equipment,/stowed:Object\.freeze\(\{position:\[0\.33,1\.12,0\.2\],rotation:\[-0\.7042,1\.4507,-1\.5708\],scale:\.01,bone:'mixamorig:Hips'\}\)/,'stowed socket = sword-sockets.py stow_socket()');
  // Scabbard stations: the literal arrays in both files are the same numbers.
  const py=name=>JSON.parse(sockets.match(new RegExp(`^${name} = (\\[[\\s\\S]*?\\]\\]\\]?)$`,'m'))[1].replace(/\s+/g,''));
  const js=name=>JSON.parse(equipment.match(new RegExp(`^  ${name}:(\\[.*\\]),$`,'m'))[1]);
  assert.deepEqual(js('leather'),py('SCABBARD_LEATHER'),'leather stations');
  assert.deepEqual(js('steel'),py('SCABBARD_STEEL'),'steel stations');
  assert.match(equipment,/axis:\[1\.05,0\.1\],\n  hilt:4\.6,/);assert.match(sockets,/SCABBARD_AXIS = \(1\.05, 0\.1\)/);assert.match(sockets,/SCABBARD_HILT = 4\.6/);
  assert.match(equipment,/SCABBARD_SECTION=1\.1;/);assert.match(sockets,/SCABBARD_SECTION = 1\.1 /);
  // Hero-only equipment swap: the right hand never reaches the left hip in the shared Weapon_Draw / Weapon_Sheathe clips,
  // so the swap happens where it is nearest (clip start / end) instead of mid-flourish.
  assert.match(equipment,/swap:Object\.freeze\(\{weapon_draw:\.08,weapon_sheathe:\.92\}\)/);
  assert.match(sockets,/SWAP = \{'Weapon_Draw': 0\.08, 'Weapon_Sheathe': 0\.92\}/);
  assert.match(equipment,/actor\.equipmentSwap=null;/,'every equipClass resets the override (a failed hero falls back to the race model)');
  assert.match(equipment,/actor\.equipmentSwap=FALLEN_LONGSWORD_SOCKETS\.swap;/);
  assert.equal((equipment.match(/actor\.equipmentSwap=/g)||[]).length,2,'only the fallen_longsword branch sets an override');
  assert.match(read('character-actor.js'),/duration\*\(this\.equipmentSwap\?\.\[transition\]\?\?equipmentSwapFraction\(transition\)\)\*1000/);
});

test('the hero scabbard is a worn slot on the hips: it stays on while only the sword toggles',async()=>{
  const THREE=await import('three');
  const {equipClass,FALLEN_SCABBARD,FALLEN_LONGSWORD_SOCKETS}=await import('../site/world3d/class-equipment.js');
  const {CharacterActor}=await import('../site/world3d/character-actor.js');
  // Minimal hero rig: Hips + RightHand bones and an FP_Sword node whose mesh spans the real sword (pommel -33 cm, tip 95 cm).
  const actor=new THREE.Group(),model=new THREE.Group();actor.model=model;model.scale.setScalar(.894);model.rotation.y=Math.PI;actor.add(model);
  const hips=new THREE.Bone();hips.name='mixamorigHips';hips.position.set(0,106,1);hips.scale.setScalar(.01);model.add(hips);
  const hand=new THREE.Bone();hand.name='mixamorigRightHand';hand.position.set(-40,-20,5);hips.add(hand);
  const sword=new THREE.Group();sword.name='FP_Sword';const blade=new THREE.Mesh(new THREE.BoxGeometry(4,128,3,1,64,1).translate(1,31,0),new THREE.MeshStandardMaterial());sword.add(blade);model.add(sword);
  actor.setEquipmentDrawn=CharacterActor.prototype.setEquipmentDrawn;
  await equipClass(actor,{id:'paladin',weapon:'fallen_longsword',metal:0x777777,accent:0xbbbbbb});
  assert.equal(actor.wornEquipment.length,1,'one worn object');
  const scabbard=actor.wornEquipment[0];
  assert.equal(scabbard.name,'FP_Scabbard');assert.equal(scabbard.parent,hips,'scabbard rides on the Hips bone');assert.equal(scabbard.userData.equipmentSlot,'worn');
  assert.deepEqual(actor.stowedEquipment.map(object=>object.name),['FP_Sword_stowed'],'only the sword hilt is in the stowed (toggled) list');
  const stowed=actor.stowedEquipment[0];assert.equal(stowed.parent,hips);
  assert.deepEqual(actor.heldEquipment.map(object=>object.name),['FP_Sword']);
  actor.updateMatrixWorld(true);
  const a=new THREE.Vector3(),b=new THREE.Vector3();scabbard.getWorldPosition(a);stowed.getWorldPosition(b);
  assert.ok(a.distanceTo(b)<1e-6,'scabbard and hilt share the stowed socket');
  assert.ok(Math.abs(scabbard.getWorldScale(new THREE.Vector3()).x-FALLEN_LONGSWORD_SOCKETS.stowed.scale*.894)<1e-6,'scabbard scales with the hero');
  for(const drawn of[false,true,false]){
    actor.setEquipmentDrawn(drawn);
    assert.equal(actor.heldEquipment[0].visible,drawn);assert.equal(stowed.visible,!drawn);assert.equal(scabbard.visible,true,`scabbard visible with drawn=${drawn}`);
  }
  // FP_Sword_stowed keeps only the hilt: no kept triangle reaches the blade.
  let kept=0,top=-Infinity;stowed.traverse(object=>{if(!object.isMesh)return;const index=object.geometry.index.array,p=object.geometry.attributes.position,v=new THREE.Vector3();kept+=index.length/3;for(const i of index){v.fromBufferAttribute(p,i).applyMatrix4(object.matrix);top=Math.max(top,v.y);}});
  assert.ok(kept>0&&top<FALLEN_SCABBARD.hilt,`stowed hilt tops out at ${top} cm`);
  // A real scabbard, not a placeholder: leather body, steel fittings, two hangers; within the triangle budget.
  let triangles=0;const materials={};scabbard.traverse(object=>{if(!object.isMesh)return;triangles+=object.geometry.index.count/3;materials[object.name]=object.material;});
  assert.deepEqual(Object.keys(materials).sort(),['FP_Scabbard_hangers','FP_Scabbard_leather','FP_Scabbard_steel']);
  assert.ok(triangles>=200&&triangles<=1500,`${triangles} scabbard triangles`);
  assert.ok(materials.FP_Scabbard_leather.roughness>=.7&&materials.FP_Scabbard_leather.metalness<.1,'leather is rough and non-metallic');
  assert.ok(materials.FP_Scabbard_steel.metalness>=.75&&materials.FP_Scabbard_steel.roughness<=.5,'fittings are metal');
  assert.equal(FALLEN_SCABBARD.hangers.length,2,'two hangers to the sword belt');
  const source=read('class-equipment.js'),actorSource=read('character-actor.js');
  assert.match(actorSource,/setEquipmentDrawn\(drawn\)\{this\.equipmentDrawn=!!drawn;for\(const object of this\.heldEquipment\|\|\[\]\)object\.visible=this\.equipmentDrawn;for\(const object of this\.stowedEquipment\|\|\[\]\)object\.visible=!this\.equipmentDrawn;\}/,'setEquipmentDrawn never touches the worn slot');
  assert.match(source,/return objects\.filter\(object=>object\.userData\.equipmentSlot==='stowed'\)/,'bindStowedSockets binds worn objects but returns only the stowed ones');
  assert.equal((source.match(/,'worn'\)/g)||[]).length,1,'only the Fallen Paladin branch creates a worn object');
});
