const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Pipeline=require('../site/action-pipeline.js');
test('legacy visual wrapper preserves ground-target arguments and return values',()=>{
 const source=fs.readFileSync(require.resolve('../site/visuals.js'),'utf8');
 const hook=source.slice(source.indexOf('const _origCastForVFX'),source.indexOf('// Hook into combatAttack'));
 const destination={x:2,z:3};let received;
 const context={window:{combatState:{selectedSpell:{id:'shadow_step'}},castSelectedSpell:p=>{received=p;return 'accepted';}},setTimeout:()=>{}};
 vm.createContext(context);vm.runInContext(hook,context);assert.equal(context.window.castSelectedSpell(destination),'accepted');assert.equal(received,destination);
});

test('solo animation commits immediately and never repeats a command on impact',()=>{
 const state={active:true,encounterId:'one',commandRevision:0,combatants:{enemy:{hp:10}}};
 const scheduled=[],context={window:{combatState:state},performance:{now:()=>1},setTimeout,clearTimeout,console};vm.createContext(context);
 const source=fs.readFileSync(require.resolve('../site/world3d/combat-controller.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export class Combat3DController','globalThis.Combat3DController = class Combat3DController');vm.runInContext(source,context);
 let calls=0,impacts=0;
 const engine={characterConfig:{},actor:{playCombatAction:()=>({impactDelay:.5,recoveryDelay:1,releaseDelay:.2})},abilityEffects:{present:(_p,_s,_t,{onImpact})=>{impacts++;onImpact();}}};
 const controller=new context.Combat3DController(engine);controller.active=true;controller.records.set('enemy',{actor:{}});controller.schedule=fn=>scheduled.push(fn);controller.lockAction=()=>{};controller.sync=()=>{};controller.missReaction=()=>{};
 controller.beginSoloAction({targetId:'enemy',resolve:()=>{calls++;state.commandRevision++;}});
 assert.equal(calls,1);assert.equal(impacts,0);scheduled.forEach(fn=>fn());assert.equal(impacts,1);assert.equal(calls,1);
 state.encounterId='replacement';scheduled.forEach(fn=>fn());assert.equal(calls,1);
});

test('a prepared command cannot commit into a different encounter or turn',()=>{
 const make=()=>({active:true,encounterId:'a',commandRevision:0,commandReceipts:[],turnOrder:['p','q'],currentTurnIndex:0});
 const prepared={ok:true,command:{id:'c',encounterId:'a',revision:0,actorId:'p'}};
 const state=make();state.encounterId='b';assert.equal(Pipeline.accept(state,prepared),false);
 const next=make();next.currentTurnIndex=1;assert.equal(Pipeline.accept(next,prepared),false);
 const ended=make();ended.active=false;assert.equal(Pipeline.accept(ended,prepared),false);
});
