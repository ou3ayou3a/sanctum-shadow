'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Contract=require('../site/claude-contract.js');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Chapter I interiors have authoritative assets, parents, entrances, gameplay hotspots, and occupants',async()=>{
  const {INTERIOR_LOCATION_IDS,interiorDefinitionFor,interiorEntrancesFor}=await import('../site/world3d/interior-registry.mjs');
  assert.equal(INTERIOR_LOCATION_IDS.length,13);
  for(const id of INTERIOR_LOCATION_IDS){
    const interior=interiorDefinitionFor(id);
    assert.match(interior.asset,/^(tavern|shop|temple|castle|house|dungeon)_interior$/);
    assert.ok(interior.returnTo);
    assert.equal(interior.entrance.length,2);
    assert.ok(interior.size[0]>=8&&interior.size[2]>=7);
    assert.equal(interior.hotspots.length,3);
    assert.equal(new Set(interior.hotspots.map(hotspot=>hotspot.id)).size,3);
    for(const hotspot of interior.hotspots){
      const action=hotspot.actions[0];
      assert.ok(action.check);
      assert.equal(action.once,true);
      const result=Contract.validate('scene.v1',{schemaVersion:1,kind:'scene',narration:'The interior responds.',sub:'A consequence follows.',location:id,locationIcon:'🚪',facts:{},threat:null,options:[{icon:action.icon,label:action.label,type:'explore',check:action.check,effects:action.effects,failureEffects:action.failureEffects}]});
      assert.equal(result.ok,true,`${id}:${hotspot.id}: ${result.errors?.join('; ')}`);
    }
    assert.ok(interiorEntrancesFor(interior.returnTo).some(entry=>entry.id===id));
  }
});

test('interior registry assigns every important room type deliberately',async()=>{
  const {isInteriorLocation,interiorDefinitionFor}=await import('../site/world3d/interior-registry.mjs');
  assert.equal(isInteriorLocation('temple_quarter'),true);
  assert.equal(interiorDefinitionFor('temple_quarter').asset,'temple_interior');
  assert.equal(interiorDefinitionFor('harren_hall').asset,'castle_interior');
  assert.equal(interiorDefinitionFor('monastery_cellar').asset,'dungeon_interior');
  assert.equal(interiorDefinitionFor('thornwood_hut').asset,'house_interior');
});

test('generic zones build physical entrances, animated exits, collision, and authoritative actions',()=>{
  const generic=read('site/world3d/zones/generic-zone.js'),kit=read('site/world3d/interior-kit.mjs'),engine=read('site/world3d/world-engine.js');
  for(const feature of['interiorDefinitionFor','interiorEntrancesFor','createInteriorEntrance','createInteriorKit','interiorDefinition.returnTo'])assert.match(generic,new RegExp(feature.replace('.','\\.')));
  for(const feature of['animated-interior-exit-door','collision:true','interior-dust','openDoor'])assert.match(kit,new RegExp(feature));
  assert.match(generic,/cameraOffset:isInterior/);
  assert.match(engine,/this\.zone\.cameraOffset/);
  assert.match(engine,/action&&!action\.direct/);
  assert.match(generic,/resolveEnvironmentalAction|actions:spot\.actions/);
});

test('interior travel and state effects reuse multiplayer-authoritative campaign systems',()=>{
  const map=read('site/map.js'),multiplayer=read('site/multiplayer.js'),game=read('site/game.js');
  assert.match(map,/world3dReturnLocation/);
  assert.match(multiplayer,/location_change/);
  assert.match(multiplayer,/environment_action_request/);
  assert.match(game,/mpRequestEnvironmentAction/);
  assert.match(game,/mpBroadcastCampaignState\?\.\('environment_action'\)/);
});
