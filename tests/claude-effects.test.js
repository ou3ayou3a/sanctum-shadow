const test=require('node:test');
const assert=require('node:assert/strict');
const Contract=require('../site/claude-contract.js');
const Effects=require('../site/claude-effects.js');

function effectScene(effects,failureEffects={}){
  return {
    schemaVersion:1,kind:'scene',narration:'The guard weighs your words.',sub:'His hand moves away from the alarm bell.',location:'Vaelthar',locationIcon:'🏰',facts:{},threat:null,
    options:[{icon:'💬',label:'Show him the sealed order',type:'talk',check:{skill:'persuasion',ability:'cha',dc:13},effects,failureEffects}],
  };
}

test('structured choice effects are bounded and normalized by the contract',()=>{
  const response=Contract.validate('scene.v1',effectScene({
    flags:{ai_guard_convinced:true},
    facts:{ai_courier_name:'Kael'},
    reputation:[{faction:'city_watch',delta:2}],
    resources:{hp:4,holy:1,hell:0,xp:75},
    items:{add:['Sealed Order'],remove:['False Pass']},
    questEvents:['scene:rhael_reveals_covenant'],
  }));
  assert.equal(response.ok,true);
  const effects=response.value.options[0].effects;
  assert.equal(effects.flags.ai_guard_convinced,true);
  assert.equal(effects.resources.xp,75);
  assert.deepEqual(effects.items.add,['Sealed Order']);

  const excessive=Contract.validate('scene.v1',effectScene({resources:{xp:500,hp:0,holy:0,hell:0}}));
  assert.equal(excessive.ok,false);
  assert.match(excessive.errors.join('\n'),/resources\.xp/);
  const protectedFlag=Contract.validate('scene.v1',effectScene({flags:{npc_dead_captain_rhael:true}}));
  assert.equal(protectedFlag.ok,false);
  assert.match(protectedFlag.errors.join('\n'),/expected ai_\*/);
});

test('effect executor applies explicit state changes through game adapters',()=>{
  const validated=Contract.validate('scene.v1',effectScene({
    flags:{ai_guard_convinced:true},facts:{ai_courier_name:'Kael'},
    reputation:[{faction:'city_watch',delta:2}],resources:{hp:-4,holy:2,hell:1,xp:50},
    items:{add:['Sealed Order'],remove:['False Pass']},questEvents:['scene:rhael_reveals_covenant'],
  }));
  assert.equal(validated.ok,true);
  const effects=validated.value.options[0].effects;
  const character={hp:12,maxHp:20,holyPoints:0,hellPoints:0,xp:0,inventory:['False Pass']};
  const sceneState={flags:{},knownFacts:{}},reputation={city_watch:0};
  const events=[];
  const outcome=Effects.apply(effects,{
    authoritative:true,character,sceneState,reputation,
    changeRep:(faction,delta)=>{reputation[faction]+=delta;},
    grantHoly:delta=>{character.holyPoints+=delta;},grantHell:delta=>{character.hellPoints+=delta;},grantXP:delta=>{character.xp+=delta;},
    recordQuestEvent:event=>{events.push(event);return {updates:[event],completions:[]};},
  });
  assert.equal(outcome.applied,true);
  assert.equal(character.hp,8);
  assert.equal(character.holyPoints,2);
  assert.equal(character.hellPoints,1);
  assert.equal(character.xp,50);
  assert.deepEqual(character.inventory,['Sealed Order']);
  assert.equal(sceneState.flags.ai_guard_convinced,true);
  assert.equal(sceneState.knownFacts.ai_courier_name,'Kael');
  assert.equal(reputation.city_watch,2);
  assert.deepEqual(events,['scene:rhael_reveals_covenant']);
});

test('non-authoritative multiplayer clients cannot apply Claude effects',()=>{
  const character={hp:10,maxHp:10,inventory:[]},sceneState={flags:{},knownFacts:{}};
  const outcome=Effects.apply({flags:{ai_changed:true},resources:{hp:-5}}, {authoritative:false,character,sceneState});
  assert.equal(outcome.applied,false);
  assert.equal(outcome.reason,'not_authoritative');
  assert.equal(character.hp,10);
  assert.equal(sceneState.flags.ai_changed,undefined);
});
