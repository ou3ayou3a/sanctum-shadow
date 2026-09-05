'use strict';

// Read-only diagnostic probes. These deliberately report current behavior,
// not passing acceptance tests. No live session, network, or saves are touched.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const Rules = require('../site/rules.js');
const Quests = require('../site/quests.js');
const Contract = require('../site/claude-contract.js');
const TacticalCombat = require('../site/tactical-combat.js');
const CombatPresentation = require('../site/combat-presentation.js');
const findings = {};

const response = Contract.validate('scene.v1', {
  schemaVersion: 1, kind: 'scene', narration: 'The final battle is over.',
  sub: 'Continue.', location: 'Vaelthar', locationIcon: 'X', facts: {}, threat: null,
  options: [{icon:'X', label:'Continue the story', type:'talk', check:null,
    effects:{questEvents:['scene:tower_ending_sword']}}],
});
findings.aiCanSubmitAuthoredFinaleEvent = response.ok;
findings.finaleCompletesWithoutPriorObjectives = Quests.reduceQuestEvent({
  activeQuestIds:['c1q20'], progress:{},
}, 'scene:tower_ending_sword').completions;

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const start = server.indexOf("  socket.on('combat_action',");
const end = server.indexOf('  // ── Enemy AI turn', start);
if (start < 0 || end < 0) throw new Error('Combat handler moved; update probe boundaries.');

function probe(action, extra = {}) {
  const emissions = [];
  let handler;
  const actor = {id:'hero', playerId:'hero', name:'Hero', hp:30, maxHp:50,
    mp:30, maxMp:30, isPlayer:true, ac:12, position:{x:0,z:0},
    spells:[{id:'divine_shield',name:'Divine Shield',type:'buff',mp:10,ap:1,damage:null}],
  };
  const enemy = {id:'enemy', name:'Enemy', hp:10, maxHp:10, ac:10, isPlayer:false,
    xp:50, position:{x:1,z:0}};
  const session = {code:'AUDIT', state:'combat', log:[], players:{hero:{connected:true,
    character:{hp:30,inventory:['Health Potion','Health Potion','Quest Document']}}},
    combatState:{active:true,combatants:{hero:actor,enemy},turnOrder:['hero','enemy'],
      currentTurnIndex:0,apRemaining:3,_presentationSeq:0,tactical:{cover:[]}}};
  extra.prepare?.(session, actor, enemy);
  const emit = (type, payload) => emissions.push({type,payload});
  const context = {socket:{id:'hero',on:(name,fn)=>{handler=fn;},emit},
    safeHandler:(name,fn)=>fn,authorizedSession:()=>session,allowSocketEvent:()=>true,
    Rules,TacticalCombat,CombatPresentation,
    io:{to:()=>({emit})},capLog:()=>{},tickPrayerBlessings:()=>{},
    broadcastSession:()=>{},advanceTurnServer:()=>{},
    isValidFormula:formula=>typeof formula==='string'&&/^\d+d\d+$/.test(formula),
    rollDiceServer:formula=>Rules.rollFormula(formula).total,
  };
  vm.runInNewContext(server.slice(start,end), context);
  for(let i=0;i<(extra.repeat||1);i++)handler({code:'AUDIT',action,targetId:extra.targetId||'enemy',spellId:'divine_shield'});
  return {session,emissions,actor,enemy};
}

const ended = probe('end_turn',{repeat:2,prepare:s=>{s.combatState.active=false;s.combatState.combatants.enemy.hp=0;}});
findings.repeatedVictoryEventsAfterCombatEnded = ended.emissions.filter(e=>e.type==='combat_ended').length;
const buff=probe('spell');
findings.multiplayerShield = {manaSpent:30-buff.actor.mp,statusEffects:buff.session.combatState.statusEffects||null,
  log:buff.session.log.at(-1)?.text};
const potion=probe('item',{targetId:'Health Potion'});
findings.duplicatePotionsRemainingAfterOneUse = potion.session.players.hero.character.inventory.filter(i=>i==='Health Potion').length;
const document=probe('item',{targetId:'Quest Document'});
findings.questDocumentConsumedAsHealing = !document.session.players.hero.character.inventory.includes('Quest Document');

findings.fullCoverStillAllowsAttack = TacticalCombat.validateAttack(
  {position:{x:0,z:0},attackRange:10},
  {hp:10,position:{x:5,z:0}},
  {cover:[{x:4,z:0,radius:.8,type:'full'}]},
);
console.log(JSON.stringify(findings,null,2));
