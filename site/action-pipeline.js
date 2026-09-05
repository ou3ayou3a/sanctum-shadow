// Plain-data command boundary. No DOM, sockets, timers, or client-supplied effects.
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./rules.js'):root.SanctumRules,node?require('./tactical-combat.js'):root.TacticalCombat,node?require('./gameplay-catalog.js'):root.GameplayCatalog);
  if(node)module.exports=api;if(root)root.ActionPipeline=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules,Tactical,Catalog){
  'use strict';
  const TYPES=new Set(['attack','spell','move','item','end_turn']);
  function begin(state,id){state.encounterId=id;state.commandRevision=0;state.commandReceipts=[];state.rewardClaimed=false;}
  function command(state,actorId,type,data={}){
    return {...data,id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,encounterId:state.encounterId,revision:state.commandRevision,actorId,type};
  }
  function reject(reason){return {ok:false,reason,effects:[],events:[]};}
  function prepare(state,cmd,context={}){
    if(!state?.active)return reject('inactive_encounter');
    if(!cmd||!TYPES.has(cmd.type))return reject('unknown_command');
    if(typeof cmd.id!=='string'||!cmd.id.length||cmd.id.length>100)return reject('invalid_command_id');
    if(cmd.encounterId!==state.encounterId)return reject('wrong_encounter');
    if(state.commandReceipts?.includes(cmd.id))return reject('duplicate_command');
    if(!Number.isSafeInteger(cmd.revision)||cmd.revision!==state.commandRevision)return reject('stale_revision');
    if(cmd.actorId!==context.principalId)return reject('unauthorized_actor');
    const actor=state.combatants?.[cmd.actorId];
    if(!actor||!actor.isPlayer||!(actor.hp>0))return reject('invalid_actor');
    if(state.turnOrder?.[state.currentTurnIndex]!==cmd.actorId)return reject('not_your_turn');
    let cost=cmd.type==='end_turn'?0:1,mp=0,target=state.combatants[cmd.targetId],spell=null,item=null,tactical=null;
    if(cmd.type==='attack'){
      if(!target||target.isPlayer===actor.isPlayer||!(target.hp>0))return reject('invalid_target');
      tactical=Tactical.validateAttack(actor,target,{cover:state.tactical?.cover||[]});
      if(!tactical.ok)return reject(tactical.reason);
    }
    if(cmd.type==='spell'){
      spell=Catalog.spellsFor(actor.characterClass||context.character?.class,actor.level||context.character?.level||1).find(s=>s.id===cmd.spellId);
      if(!spell)return reject('unknown_ability');
      cost=spell.ap;mp=spell.mp;
      if(!(actor.mp>=mp))return reject('insufficient_mp');
      if((spell.holy_cost||0)>(context.character?.holyPoints||0))return reject('insufficient_holy_points');
      // Detailed per-ability targeting/status semantics are the Step 3 migration.
      if(spell.damage&&spell.type!=='buff'&&spell.type!=='heal'&&(!target||!(target.hp>0)))return reject('invalid_target');
    }
    if(cmd.type==='move'){
      tactical=Tactical.validateMove(actor.position,cmd.position,{maxDistance:state.tactical?.moveRange||Tactical.DEFAULT_MOVE_RANGE,bounds:state.tactical?.bounds||12});
      if(!tactical.ok)return reject(tactical.reason);
    }
    if(cmd.type==='item'){
      const inventory=context.character?.inventory||[];
      item=Catalog.consumable(cmd.targetId);
      if(!item||!inventory.includes(item.name))return reject('invalid_item');
    }
    if(!Number.isFinite(cost)||cost<0||!(state.apRemaining>=cost))return reject('insufficient_ap');
    return {ok:true,actor,target,spell,item,tactical,cost,mp,command:cmd};
  }
  function accept(state,prepared){
    const cmd=prepared.command;
    if(!prepared.ok||cmd.revision!==state.commandRevision||state.commandReceipts.includes(cmd.id))return false;
    state.commandReceipts.push(cmd.id);if(state.commandReceipts.length>256)state.commandReceipts.shift();
    state.commandRevision++;return true;
  }
  function attackRoll(actor,target,options={}){
    const rng=options.rng|| (options.seed!==undefined?Rules.createRng(options.seed):Math.random);
    const attack=Rules.resolveAttack({...options,attackBonus:options.attackBonus??actor.attackBonus??actor.atk??0,targetAC:options.targetAC??target.ac??10,rng});
    const damage=attack.hit?Rules.rollFormula('1d8',{modifier:actor.damageMod??actor.atk??0,critical:attack.crit,rng}).total:0;
    return {...attack,damage};
  }
  // Pure reducer for migrated primitives. Callers commit once, then present events.
  function resolve(state,cmd,context={}){
    const prepared=prepare(state,cmd,context);if(!prepared.ok)return prepared;
    if(cmd.type==='spell')return reject('ability_requires_authored_handler');
    const effects=[],events=[];const actor=prepared.actor;
    if(cmd.type==='attack'){
      const roll=attackRoll(actor,prepared.target,{seed:context.seed,targetAC:(prepared.target.ac||10)+prepared.tactical.coverBonus});
      effects.push({type:'hp',actorId:cmd.targetId,value:Math.max(0,prepared.target.hp-roll.damage)});
      events.push({type:'attack',actorId:cmd.actorId,targetId:cmd.targetId,...roll});
    }else if(cmd.type==='move'){
      effects.push({type:'position',actorId:cmd.actorId,value:prepared.tactical.position});
      events.push({type:'move',actorId:cmd.actorId,distance:prepared.tactical.distance});
    }else if(cmd.type==='item'){
      const [kind,amount]=prepared.item.effect.split('_'),field=kind==='heal'?'hp':'mp',max=field==='hp'?actor.maxHp:actor.maxMp;
      const value=Math.min(max,(actor[field]||0)+Number(amount));
      effects.push({type:field,actorId:cmd.actorId,value},{type:'consume',name:prepared.item.name});
      events.push({type:'item',actorId:cmd.actorId,name:prepared.item.name,field,amount:value-(actor[field]||0)});
    }
    effects.push({type:'ap',value:cmd.type==='end_turn'?0:state.apRemaining-prepared.cost});
    return {ok:true,prepared,effects,events};
  }
  function commit(state,result,context={}){
    if(!result.ok||!accept(state,result.prepared))return false;
    for(const effect of result.effects){
      if(effect.type==='ap')state.apRemaining=effect.value;
      else if(effect.type==='consume'){const inv=context.character.inventory;inv.splice(inv.indexOf(effect.name),1);}
      else state.combatants[effect.actorId][effect.type]=effect.value;
    }
    return true;
  }
  function finish(state,victory){
    if(!state.active||state.rewardClaimed)return reject('encounter_already_finished');
    const alive=Object.values(state.combatants).filter(c=>c.hp>0);
    if(alive.some(c=>victory?!c.isPlayer:c.isPlayer))return reject('encounter_not_finished');
    state.active=false;state.rewardClaimed=true;state.commandRevision++;
    return {ok:true,claimId:`encounter:${state.encounterId}`,victory};
  }
  return Object.freeze({begin,command,prepare,accept,attackRoll,resolve,commit,finish});
});
