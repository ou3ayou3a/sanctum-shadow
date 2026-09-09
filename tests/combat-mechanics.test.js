const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Mechanics=require('../site/combat-mechanics.js'),Pipeline=require('../site/action-pipeline.js'),Catalog=require('../site/gameplay-catalog.js');
test('first turn initializes missing status storage without throwing',()=>{
 const state={round:1,currentTurnIndex:0,combatants:{p:{id:'p',hp:10,characterClass:'ranger'}}};
 Mechanics.startTurn(state,'p');assert.deepEqual(state.statusEffects,{p:[]});assert.equal(state.combatants.p.resource,1);
 Mechanics.startTurn(state,'p');assert.equal(state.combatants.p.resource,1);
});
function fixture(cls='mage'){
 const player={id:'p',name:'Hero',isPlayer:true,characterClass:cls,level:10,hp:80,maxHp:100,mp:300,maxMp:300,ac:14,attackBonus:8,damageMod:3,position:{x:0,z:0},statMods:{str:3,dex:3,con:3,wis:3,int:3,cha:3}};
 const state={active:true,round:2,currentTurnIndex:0,turnOrder:['p','e','a'],apRemaining:3,combatants:{p:player,e:{id:'e',name:'Enemy',isPlayer:false,hp:20,maxHp:100,mp:100,maxMp:100,level:3,ac:12,atk:5,position:{x:2,z:0},statMods:{con:2}},a:{...player,id:'a',name:'Ally',position:{x:1,z:0},hp:20}},statusEffects:{},tactical:{cover:[],bounds:12}};
 Pipeline.begin(state,'battle');return{state,context:{principalId:'p',canEndEncounter:true,seed:'spell-test',character:{class:cls,level:10,holyPoints:100,inventory:[]}}};
}
test('Shadow Step validates a destination before costs and commits a teleport once',()=>{
 const {state,context}=fixture('rogue');
 const cmd={id:'teleport',encounterId:'battle',revision:0,actorId:'p',type:'spell',spellId:'shadow_step',targetId:'p'};
 assert.equal(Pipeline.resolve(state,cmd,context).reason,'choose_destination');
 assert.equal(Pipeline.resolve(state,{...cmd,position:{x:1,z:0}},context).reason,'occupied_or_blocked');
 state.tactical.obstacles=[{x:-1.5,z:0,hw:.2,hd:2}];
 assert.equal(Pipeline.resolve(state,{...cmd,position:{x:-3,z:0}},context).reason,'blocked_line_of_sight');
 state.tactical.obstacles=[];
 const result=Pipeline.resolve(state,{...cmd,position:{x:-3,z:0}},context);assert.equal(result.ok,true);
 assert.equal(Pipeline.commit(state,result,context),true);assert.deepEqual(state.combatants.p.position,{x:-3,z:0});assert.equal(state.apRemaining,2);assert.equal(state.combatants.p.mp,275);
 assert.equal(Pipeline.commit(state,result,context),false);
});
const browser={};vm.createContext(browser);for(const file of ['rules','navigation-core','collision-catalog','tactical-combat','gameplay-catalog','combat-mechanics','action-pipeline'])vm.runInContext(fs.readFileSync(require.resolve('../site/'+file+'.js'),'utf8'),browser);
for(const [cls,spells] of Object.entries(Catalog.CLASS_SPELLS))for(const spell of spells){
 test(`${cls}/${spell.id}: identical seeded solo/server effects, one cost, rejection before mutation`,()=>{
  const {state,context}=fixture(cls),policy=Mechanics.policies[spell.id][0];
  let targetId=policy==='self'?'p':['ally','other','downed'].includes(policy)?'a':'e';
  if(policy==='downed'){state.combatants.a.hp=0;state.combatants.a.downedRound=1;}
  const cmd={id:'cast',encounterId:'battle',revision:0,actorId:'p',type:'spell',spellId:spell.id,targetId,...(spell.id==='shadow_step'?{position:{x:-3,z:0}}:{})};
  const before=JSON.stringify(state),result=Pipeline.resolve(state,cmd,context),solo=browser.ActionPipeline.resolve(state,cmd,context);
  assert.equal(result.ok,true,result.reason);assert.equal(JSON.stringify(result),JSON.stringify(solo));assert.equal(JSON.stringify(state),before);
  assert.equal(Pipeline.commit(state,result,context),true);assert.equal(state.apRemaining,3-spell.ap);assert.equal(state.combatants.p.mp,300-spell.mp);assert.equal(Pipeline.commit(state,result,context),false);
  const f=fixture(cls);f.state.combatants.p.mp=0;const failedBefore=JSON.stringify(f);
  assert.equal(Pipeline.resolve(f.state,cmd,f.context).ok,false);assert.equal(JSON.stringify(f),failedBefore);
  if(policy!=='self'){
   const invalid=fixture(cls);const bad={...cmd,targetId:policy==='enemy'?'a':'e'};
   assert.equal(Pipeline.resolve(invalid.state,bad,invalid.context).ok,false);
  }
 });
}
for(const id of Mechanics.enemyIds)test(`enemy/${id}: deterministic authored effects`,()=>{
 const {state}=fixture();const before=JSON.stringify(state),spell={id};
 const node=Mechanics.resolve(state,'e',spell,{enemy:true,targetId:'p',seed:'enemy'}),web=browser.CombatMechanics.resolve(state,'e',spell,{enemy:true,targetId:'p',seed:'enemy'});
 assert.equal(JSON.stringify(node),JSON.stringify(web));assert.equal(JSON.stringify(state),before);assert.notEqual(JSON.stringify(node.combatants)+JSON.stringify(node.statusEffects),JSON.stringify(state.combatants)+JSON.stringify(state.statusEffects));
});
test('DOT ticks exactly once per turn, through resistance and shield, and expires after its last tick',()=>{
 const {state}=fixture();state.combatants.p.characterClass='warrior';state.combatants.p.resistances=['fire'];state.statusEffects.p=[{id:'burning',turnsLeft:2,dmgPerTurn:10,damageType:'fire'},{id:'divine_shield',turnsLeft:4,shieldHp:3}];
 Mechanics.startTurn(state,'p');assert.equal(state.combatants.p.hp,78);Mechanics.startTurn(state,'p');assert.equal(state.combatants.p.hp,78);
 state.round++;Mechanics.startTurn(state,'p');assert.equal(state.combatants.p.hp,73);assert.equal(Mechanics.has(state,'p','burning'),false);
});
test('stun expires after skipping one turn; root blocks movement but not attacks',()=>{
 const {state,context}=fixture('warrior');state.statusEffects.p=[{id:'stunned',turnsLeft:1}];Mechanics.startTurn(state,'p');assert.equal(state.turnBlocked,true);assert.equal(Mechanics.has(state,'p','stunned'),false);
 state.round++;Mechanics.startTurn(state,'p');assert.equal(state.turnBlocked,false);state.statusEffects.p=[{id:'vine_trap',turnsLeft:2}];
 const c={id:'x',encounterId:'battle',revision:0,actorId:'p',type:'move',position:{x:1,z:0}};assert.equal(Pipeline.prepare(state,c,context).reason,'rooted');c.type='attack';c.targetId='e';assert.equal(Pipeline.prepare(state,c,context).ok,true);
});
test('revival rejects stale deaths and restores one HP without reviving living allies',()=>{
 const {state,context}=fixture('cleric'),c={id:'revive',encounterId:'battle',revision:0,actorId:'p',type:'spell',spellId:'revivify',targetId:'a'};
 state.combatants.a.hp=0;state.combatants.a.downedRound=1;state.round=5;assert.equal(Pipeline.prepare(state,c,context).reason,'invalid_revival_target');
 state.round=4;const result=Pipeline.resolve(state,c,context);assert.equal(result.ok,true);Pipeline.commit(state,result,context);assert.equal(state.combatants.a.hp,1);assert.equal(state.combatants.a.downedRound,undefined);
});
test('area damage hits nearby allies, while allies outside the radius are safe',()=>{
 const {state}=fixture();state.combatants.a.position={x:2,z:1};state.combatants.far={...state.combatants.a,id:'far',position:{x:20,z:20}};
 const result=Mechanics.resolve(state,'p',Catalog.spellsFor('mage',10).find(s=>s.id==='fireball'),{targetId:'e',seed:'aoe'});
 assert.ok(result.combatants.a.hp<state.combatants.a.hp);assert.equal(result.combatants.far.hp,state.combatants.far.hp);
});
test('retreat and authored surrender close once and never create victory rewards',()=>{
 for(const type of ['retreat','surrender']){const {state,context}=fixture();state.surrenderScene='captured';const c={id:'leave',encounterId:'battle',revision:0,actorId:'p',type};
  assert.equal(Pipeline.resolve(state,c,{...context,canEndEncounter:false}).reason,'party_leader_required');
  const result=Pipeline.resolve(state,c,context);assert.equal(Pipeline.commit(state,result,context),true);assert.equal(state.outcome,type);assert.equal(Pipeline.finish(state,true).ok,false);
 }
});
