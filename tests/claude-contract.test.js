const test=require('node:test');
const assert=require('node:assert/strict');
const Contract=require('../site/claude-contract.js');

function peacefulScene(overrides={}){
  return {
    schemaVersion:1,
    kind:'scene',
    narration:'Rain runs between the old stones as the watch closes the gate.',
    sub:'The archive door remains unguarded for only a moment.',
    location:'Vaelthar',
    locationIcon:'🏰',
    facts:{archive_guard_shifted:true},
    threat:null,
    options:[
      {icon:'🔍',label:'Examine the archive door',type:'explore',check:{skill:'investigation',ability:'int',dc:12}},
      {icon:'💬',label:'Question the gate watch',type:'talk',check:null},
    ],
    ...overrides,
  };
}

test('scene.v1 accepts and normalizes a valid peaceful scene',()=>{
  const response=Contract.validate('scene.v1',peacefulScene());
  assert.equal(response.ok,true);
  assert.equal(response.value.options[0].check.ability,'int');
  assert.equal(Object.getPrototypeOf(response.value.facts),null);
});

test('scene.v1 requires hostile scenes and combat choices to agree',()=>{
  const hostileWithoutCombat=peacefulScene({
    threat:{hostiles:[{type:'city_guard',count:2,level:1}],imminent:true},
  });
  const peacefulWithCombat=peacefulScene({
    options:[{icon:'⚔',label:'Attack',type:'combat',check:null,enemies:[{type:'bandit',count:1,level:1}]}],
  });
  assert.equal(Contract.validate('scene.v1',hostileWithoutCombat).ok,false);
  assert.equal(Contract.validate('scene.v1',peacefulWithCombat).ok,false);
});

test('scene.v1 rejects unknown fields, invalid checks, and unsafe fact keys',()=>{
  const scene=peacefulScene({
    injected:'do not trust this',
    facts:JSON.parse('{"__proto__":"polluted"}'),
    options:[{icon:'🔍',label:'Search',type:'explore',check:{skill:'investigation',ability:'luck',dc:99}}],
  });
  const response=Contract.validate('scene.v1',scene);
  assert.equal(response.ok,false);
  assert.match(response.errors.join('\n'),/not allowed/);
  assert.match(response.errors.join('\n'),/facts key __proto__ is invalid/);
  assert.match(response.errors.join('\n'),/ability is invalid/);
});

test('npc_dialogue.v1 bounds choices, checks, scene breaks, and romance effects',()=>{
  const npc={
    schemaVersion:1,
    kind:'npc_dialogue',
    speech:'Rhael lowers his voice. "The seal came from the monastery."',
    options:[
      {label:'Ask who carried it',type:'talk',check:null},
      {label:'Pressure him for a name',type:'talk',check:{skill:'intimidation',ability:'cha',dc:13}},
      {label:'End conversation',type:'end',check:null},
    ],
    sceneBreak:null,
    effects:{affection:2,intimate:false,married:false},
  };
  const response=Contract.parseAndValidate('npc_dialogue.v1',`\`\`\`json\n${JSON.stringify(npc)}\n\`\`\``);
  assert.equal(response.ok,true);
  assert.equal(response.value.effects.affection,2);
  assert.equal(response.value.options[1].check.dc,13);

  npc.effects.affection=100;
  assert.equal(Contract.validate('npc_dialogue.v1',npc).ok,false);
});

test('intent.v1 only accepts known NPC ids supplied by the game',()=>{
  const intent={schemaVersion:1,kind:'intent',intent:'talk',npcId:'captain_rhael',target:null};
  assert.equal(Contract.validate('intent.v1',intent,{allowedNpcIds:['captain_rhael']}).ok,true);
  assert.equal(Contract.validate('intent.v1',intent,{allowedNpcIds:['sister_mourne']}).ok,false);
});

test('malformed or non-object Claude output is rejected without throwing',()=>{
  assert.equal(Contract.parseAndValidate('scene.v1','not json').ok,false);
  assert.equal(Contract.parseAndValidate('scene.v1','[]').ok,false);
  assert.equal(Contract.parseAndValidate('unknown.v1','{}').ok,false);
});

test('structured display text cannot inject markup into scene options',()=>{
  const scene=peacefulScene({options:[{icon:'🔍',label:'Search <img src=x>',type:'explore',check:null}]});
  const response=Contract.validate('scene.v1',scene);
  assert.equal(response.ok,true);
  assert.equal(response.value.options[0].label,'Search img src=x');
});
