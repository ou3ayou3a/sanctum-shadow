const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Pipeline=require('../site/action-pipeline.js');
function fixture(){
  const state={active:true,combatants:{p:{id:'p',isPlayer:true,hp:10,maxHp:60,mp:10,maxMp:100,attackBonus:6,damageMod:3,ac:14,position:{x:0,z:0},characterClass:'paladin',level:5},e:{id:'e',isPlayer:false,hp:50,maxHp:50,ac:12,position:{x:0,z:2}}},turnOrder:['p','e'],currentTurnIndex:0,apRemaining:3,tactical:{cover:[],bounds:12,moveRange:4.5}};
  Pipeline.begin(state,'encounter-test');
  return {state,context:{principalId:'p',seed:'same-command',character:{class:'paladin',level:5,holyPoints:20,inventory:['Health Potion','Health Potion','City Watch Pass','Essence of Focus']}}};
}
function cmd(state,type='attack',data={}){return{id:'command-1',actorId:'p',type,encounterId:state.encounterId,revision:state.commandRevision,targetId:'e',...data};}
test('browser and server reducers yield identical seeded effects without mutating input',()=>{
  const browser={};vm.createContext(browser);
  for(const file of ['rules.js','tactical-combat.js','gameplay-catalog.js','action-pipeline.js'])vm.runInContext(fs.readFileSync(require.resolve('../site/'+file),'utf8'),browser);
  for(const type of ['attack','move','item','end_turn']){
    const {state,context}=fixture(),command=cmd(state,type,{position:{x:1,z:1},targetId:type==='item'?'Health Potion':'e'}),before=JSON.stringify(state);
    const server=Pipeline.resolve(state,command,context),solo=browser.ActionPipeline.resolve(state,command,context);
    assert.equal(server.ok,true);assert.equal(JSON.stringify(solo),JSON.stringify(server));assert.equal(JSON.stringify(state),before);
  }
});
test('rejected commands cannot change HP, AP, inventory, revision or receipts',()=>{
  const cases=[
    ['inactive_encounter',f=>f.state.active=false,()=>{}],
    ['unauthorized_actor',f=>f.context.principalId='other',()=>{}],
    ['not_your_turn',f=>f.state.currentTurnIndex=1,()=>{}],
    ['invalid_actor',f=>f.state.combatants.p.hp=0,()=>{}],
    ['insufficient_ap',f=>f.state.apRemaining=0,()=>{}],
    ['stale_revision',()=>{},c=>c.revision=9],
    ['wrong_encounter',()=>{},c=>c.encounterId='old'],
    ['invalid_target',()=>{},c=>c.targetId='p'],
    ['out_of_range',f=>f.state.combatants.e.position.z=20,()=>{}],
    ['unknown_command',()=>{},c=>c.type='award_xp'],
    ['invalid_command_id',()=>{},c=>delete c.id],
  ];
  for(const [reason,change,changeCmd] of cases){const f=fixture();change(f);const c=cmd(f.state);changeCmd(c);const before=JSON.stringify(f);assert.equal(Pipeline.resolve(f.state,c,f.context).reason,reason);assert.equal(JSON.stringify(f),before);}
});
test('commands commit at most once and stale prepared effects cannot overwrite new state',()=>{
  const {state,context}=fixture(),c=cmd(state),result=Pipeline.resolve(state,c,context);
  assert.equal(Pipeline.commit(state,result,context),true);
  const after=JSON.stringify(state);assert.equal(Pipeline.commit(state,result,context),false);assert.equal(JSON.stringify(state),after);
  assert.equal(Pipeline.resolve(state,c,context).reason,'duplicate_command');
  assert.equal(state.apRemaining,2);assert.equal(state.commandRevision,1);
});
test('only a catalog consumable restores health and exactly one copy is consumed',()=>{
  const {state,context}=fixture();
  assert.equal(Pipeline.resolve(state,cmd(state,'item',{targetId:'City Watch Pass'}),context).reason,'invalid_item');
  const result=Pipeline.resolve(state,cmd(state,'item',{targetId:'Health Potion'}),context);
  assert.equal(Pipeline.commit(state,result,context),true);assert.equal(state.combatants.p.hp,40);
  assert.equal(context.character.inventory.filter(x=>x==='Health Potion').length,1);
});
test('restoratives restore MP rather than healing HP',()=>{
  const {state,context}=fixture();const result=Pipeline.resolve(state,cmd(state,'item',{targetId:'Essence of Focus'}),context);
  assert.equal(result.ok,true);Pipeline.commit(state,result,context);assert.ok(state.combatants.p.mp>10);assert.equal(state.combatants.p.hp,10);
});
test('spell ownership and costs come from catalog, never supplied spell definitions',()=>{
  const {state,context}=fixture();state.combatants.p.spells=[{id:'fireball',mp:0,ap:0,damage:'999d99'}];
  assert.equal(Pipeline.prepare(state,cmd(state,'spell',{spellId:'fireball'}),context).reason,'unknown_ability');
  assert.equal(Pipeline.prepare(state,cmd(state,'spell',{spellId:'divine_shield'}),context).reason,'insufficient_mp');
  state.combatants.p.mp=100;const p=Pipeline.prepare(state,cmd(state,'spell',{spellId:'divine_shield'}),context);
  assert.equal(p.ok,true);assert.equal(p.cost,2);assert.equal(p.mp,50);
});
test('encounter completion and reward claim cannot repeat or finish a live battle',()=>{
  const {state}=fixture();assert.equal(Pipeline.finish(state,true).ok,false);
  state.combatants.e.hp=0;const result=Pipeline.finish(state,true);
  assert.equal(result.ok,true);assert.equal(result.claimId,'encounter:encounter-test');
  const after=JSON.stringify(state);assert.equal(Pipeline.finish(state,true).ok,false);assert.equal(JSON.stringify(state),after);
  assert.equal(Pipeline.resolve(state,cmd(state),{principalId:'p'}).reason,'inactive_encounter');
});
test('actual solo combat adapter uses the shared item and movement reducer and rejects out-of-turn actions',()=>{
  const c={console:{log(){}},document:{createElement:()=>({}),head:{appendChild(){}}},setTimeout(){},clearTimeout(){},addLog(){}};
  c.window=c;vm.createContext(c);
  for(const file of ['rules.js','tactical-combat.js','gameplay-catalog.js','action-pipeline.js','combat.js'])vm.runInContext(fs.readFileSync(require.resolve('../site/'+file),'utf8'),c);
  const f=fixture();f.state.combatants.player={...f.state.combatants.p,id:'player'};delete f.state.combatants.p;f.state.turnOrder=['player','e'];
  Object.assign(c.combatState,f.state);c.gameState={character:f.context.character};
  vm.runInContext('updateCombatUI=()=>{};syncPlayerHP=()=>{};',c);
  c.combatItem();assert.equal(c.combatState.combatants.player.hp,40);assert.equal(c.combatState.apRemaining,2);
  c.combatMove({x:1,z:0});assert.equal(c.combatState.combatants.player.position.x,1);assert.equal(c.combatState.apRemaining,1);
  c.combatState.currentTurnIndex=1;const before=JSON.stringify(c.combatState);c.combatItem();c.combatAttack();assert.equal(JSON.stringify(c.combatState),before);
});
