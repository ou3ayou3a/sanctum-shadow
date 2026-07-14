const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Contract=require('../site/claude-contract.js');

const actionsModule=import('../site/world3d/environment-actions.mjs');
const profilesModule=import('../site/world3d/zones/zone-profiles.mjs');

function validateEffects(action,effects){
  return Contract.validate('scene.v1',{
    schemaVersion:1,kind:'scene',narration:'You examine the environment.',sub:'The world may change.',location:'Test zone',locationIcon:'◇',facts:{},threat:null,
    options:[{icon:action.icon,label:action.label,type:'explore',check:action.check,effects,failureEffects:{}}],
  });
}

test('every authored city landmark exposes contextual environmental actions',async()=>{
  const {ENVIRONMENT_LANDMARK_IDS,getLandmarkActions}=await actionsModule;
  assert.deepEqual([...ENVIRONMENT_LANDMARK_IDS].sort(),[
    'ash_market','church_archive','covenant_fountain','north_gate','signing_hall','south_gate','tarnished_cup','temple_quarter','watch_post',
  ]);
  for(const id of ENVIRONMENT_LANDMARK_IDS){
    const actions=getLandmarkActions(id);
    assert.ok(actions.length>0,`${id} has no environmental actions`);
    assert.equal(new Set(actions.map(action=>action.id)).size,actions.length,`${id} has duplicate action IDs`);
  }
});

test('all Chapter One 3D zone kits have at least one environmental action',async()=>{
  const {ENVIRONMENT_ACTION_KITS,getKitActions}=await actionsModule;
  const {CHAPTER_ONE_ZONE_IDS,getZoneProfile}=await profilesModule;
  assert.ok(ENVIRONMENT_ACTION_KITS.length>=15);
  for(const id of CHAPTER_ONE_ZONE_IDS.filter(id=>id!=='vaelthar_city')){
    const profile=getZoneProfile({id,name:id});
    assert.ok(ENVIRONMENT_ACTION_KITS.includes(profile.kit),`${id} uses an unhandled kit: ${profile.kit}`);
    assert.ok(getKitActions(profile.kit).length>0,`${profile.kit} has no environmental actions`);
  }
});

test('environmental checks and state effects satisfy the structured action contract',async()=>{
  const {ENVIRONMENT_ACTION_KITS,ENVIRONMENT_LANDMARK_IDS,getKitActions,getLandmarkActions}=await actionsModule;
  const groups=[...ENVIRONMENT_ACTION_KITS.map(getKitActions),...ENVIRONMENT_LANDMARK_IDS.map(getLandmarkActions)];
  for(const action of groups.flat()){
    assert.match(action.id,/^[a-z0-9_]+$/);
    assert.ok(action.label.length>3);
    assert.ok(action.successText.length>10);
    assert.ok(action.failureText.length>10);
    assert.ok(action.check,`${action.id} must use the authoritative D&D check pipeline`);
    assert.ok(['str','dex','con','int','wis','cha'].includes(action.check.ability));
    assert.ok(action.check.dc>=5&&action.check.dc<=30);
    for(const effects of [action.effects,action.failureEffects]){
      for(const key of Object.keys(effects.flags||{}))assert.match(key,/^ai_/);
      for(const [key,value] of Object.entries(effects.facts||{})){assert.match(key,/^ai_/);assert.equal(typeof value,'string');}
      const result=validateEffects(action,effects);
      assert.equal(result.ok,true,`${action.id}: ${result.errors?.join('; ')}`);
    }
  }
});

test('the 3D world routes contextual and open-ended environmental actions to the resolver',()=>{
  const root=path.join(__dirname,'..','site','world3d');
  const engine=fs.readFileSync(path.join(root,'world-engine.js'),'utf8');
  const game=fs.readFileSync(path.join(root,'..','game.js'),'utf8');
  const courtyard=fs.readFileSync(path.join(root,'zones','vaelthar-courtyard.js'),'utf8');
  const generic=fs.readFileSync(path.join(root,'zones','generic-zone.js'),'utf8');
  assert.match(engine,/Try something else/);
  assert.match(engine,/resolveEnvironmentalAction/);
  assert.match(game,/window\.generateAIScene/);
  assert.match(courtyard,/getLandmarkActions/);
  assert.match(generic,/getKitActions/);
});
