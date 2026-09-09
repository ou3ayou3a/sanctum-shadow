// Plain-data command boundary. No DOM, sockets, timers, or client-supplied effects.
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./rules.js'):root.SanctumRules,node?require('./tactical-combat.js'):root.TacticalCombat,node?require('./gameplay-catalog.js'):root.GameplayCatalog,node?require('./combat-mechanics.js'):root.CombatMechanics);
  if(node)module.exports=api;if(root)root.ActionPipeline=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules,Tactical,Catalog,Mechanics){
  'use strict';
  const TYPES=new Set(['attack','spell','move','item','end_turn','retreat','surrender']);
  const SUPPORT=Object.freeze({cure_wounds:{range:12},lay_on_hands:{range:2.75,other:true},mass_heal:{range:12,party:true},divine_shield:{range:12}});
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
    if(state.turnBlocked&&cmd.type!=='end_turn')return reject('stunned');
    let cost=['end_turn','retreat','surrender'].includes(cmd.type)?0:1,mp=0,target=state.combatants[cmd.targetId],spell=null,item=null,tactical=null;
    if(['retreat','surrender'].includes(cmd.type)){
      if(!context.canEndEncounter)return reject('party_leader_required');
      if(cmd.type==='surrender'&&!state.surrenderScene)return reject('surrender_unavailable');
    }
    if(cmd.type==='attack'){
      if(!target||target.isPlayer===actor.isPlayer||!(target.hp>0))return reject('invalid_target');
      tactical=Tactical.validateAttack(actor,target,state.tactical||{});
      if(!tactical.ok)return reject(tactical.reason);
    }
    if(cmd.type==='spell'){
      spell=Catalog.spellsFor(actor.characterClass||context.character?.class,actor.level||context.character?.level||1).find(s=>s.id===cmd.spellId);
      if(!spell)return reject('unknown_ability');
      const invalid=Mechanics.validate(state,actor,spell,cmd.targetId);if(invalid)return reject(invalid);
      target=Mechanics.targetFor(state,actor,spell.id,cmd.targetId);
      if(spell.id==='shadow_step'){
        const destination=Tactical.point(cmd.position);
        if(!destination)return reject('choose_destination');
        const options={...state.tactical,occupied:Object.values(state.combatants).filter(c=>c.id!==actor.id&&c.hp>0&&c.position).map(c=>({...c.position,radius:.45}))};
        if((Tactical.distance(actor.position,destination)??Infinity)>18.288)return reject('out_of_range');
        if(Tactical.navigation(options).isPointBlocked(destination))return reject('occupied_or_blocked');
        if(!Tactical.lineOfSight(actor.position,destination,state.tactical||{}))return reject('blocked_line_of_sight');
        tactical={position:destination};
      }
      if(target.id!==actor.id&&!Tactical.lineOfSight(actor,target,state.tactical||{}))return reject('blocked_line_of_sight');
      cost=spell.ap;mp=spell.mp;
      if(!(actor.mp>=mp))return reject('insufficient_mp');
      if((spell.holy_cost||0)>(context.character?.holyPoints||0))return reject('insufficient_holy_points');
      if(SUPPORT[spell.id]){
        const policy=SUPPORT[spell.id];
        target=policy.party?actor:(target||actor);
        if(!target.isPlayer||!(target.hp>0)||(policy.other&&target.id===actor.id))return reject('invalid_ally_target');
        const distance=Tactical.distance(actor.position,target.position);
        if(distance!==null&&distance>policy.range)return reject('out_of_range');
      }
      // Detailed per-ability targeting/status semantics are the Step 3 migration.
      if(spell.damage&&spell.type!=='buff'&&spell.type!=='heal'&&(!target||!(target.hp>0)))return reject('invalid_target');
    }
    if(cmd.type==='move'){
      if(Mechanics.has(state,actor.id,'vine_trap'))return reject('rooted');
      tactical=Tactical.validateMove(actor.position,cmd.position,{...state.tactical,maxDistance:state.tactical?.moveRange||Tactical.DEFAULT_MOVE_RANGE,occupied:Object.values(state.combatants).filter(c=>c.id!==actor.id&&c.hp>0&&c.position).map(c=>({...c.position,radius:.45}))});
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
    if(!state.active||!prepared.ok||cmd.encounterId!==state.encounterId||cmd.revision!==state.commandRevision||state.turnOrder[state.currentTurnIndex]!==cmd.actorId||state.commandReceipts.includes(cmd.id))return false;
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
    const effects=[],events=[];const actor=prepared.actor;
    if(cmd.type==='spell'){
      const resolution=Mechanics.resolve(state,actor.id,prepared.spell,{targetId:prepared.target.id,seed:context.seed});
      resolution.combatants[actor.id].mp=actor.mp-prepared.mp;
      if(prepared.spell.id==='shadow_step'){
        resolution.combatants[actor.id].position=prepared.tactical.position;
        resolution.combatants[actor.id].movementPath=[];
        resolution.combatants[actor.id].teleportRevision=state.commandRevision+1;
        resolution.events.push({type:'teleport',actorId:actor.id,position:prepared.tactical.position});
      }
      effects.push({type:'combat',value:resolution},{type:'holyPoints',value:(context.character.holyPoints||0)-(prepared.spell.holy_cost||0)});
      events.push(...resolution.events);
    }else if(cmd.type==='attack'){
      const resolution=Mechanics.attack(state,actor.id,prepared.target.id,{seed:context.seed,coverBonus:prepared.tactical.coverBonus});
      effects.push({type:'combat',value:resolution});events.push(...resolution.events);
      if(actor.characterClass==='paladin'&&resolution.events[0].hit)effects.push({type:'holyPoints',value:Math.min(100,(context.character?.holyPoints||0)+5)});
    }else if(cmd.type==='move'){
      effects.push({type:'position',actorId:cmd.actorId,value:prepared.tactical.position});
      effects.push({type:'movementPath',actorId:cmd.actorId,value:prepared.tactical.path});
      if(actor.characterClass==='ranger')effects.push({type:'resource',actorId:actor.id,value:Math.min(3,(actor.resource||0)+1)});
      events.push({type:'move',actorId:cmd.actorId,distance:prepared.tactical.distance});
    }else if(cmd.type==='item'){
      const [kind,amount]=prepared.item.effect.split('_'),field=kind==='heal'?'hp':'mp',max=field==='hp'?actor.maxHp:actor.maxMp;
      const value=Math.min(max,(actor[field]||0)+Number(amount));
      effects.push({type:field,actorId:cmd.actorId,value},{type:'consume',name:prepared.item.name});
      events.push({type:'item',actorId:cmd.actorId,name:prepared.item.name,field,amount:value-(actor[field]||0)});
    }
    if(['retreat','surrender'].includes(cmd.type)){effects.push({type:'outcome',value:cmd.type});events.push({type:cmd.type,actorId:actor.id});}
    effects.push({type:'ap',value:cmd.type==='end_turn'?0:state.apRemaining-prepared.cost});
    return {ok:true,prepared,effects,events};
  }
  function commit(state,result,context={}){
    if(!result.ok||!accept(state,result.prepared))return false;
    for(const effect of result.effects){
      if(effect.type==='ap')state.apRemaining=effect.value;
      else if(effect.type==='combat'){state.combatants=effect.value.combatants;state.statusEffects=effect.value.statusEffects;}
      else if(effect.type==='outcome'){state.active=false;state.outcome=effect.value;state.rewardClaimed=true;}
      else if(effect.type==='holyPoints')context.character.holyPoints=effect.value;
      else if(effect.type==='statuses'){state.statusEffects=state.statusEffects||{};state.statusEffects[effect.actorId]=effect.value;}
      else if(effect.type==='consume'){const inv=context.character.inventory;inv.splice(inv.indexOf(effect.name),1);}
      else state.combatants[effect.actorId][effect.type]=effect.value;
    }
    return true;
  }
  function finish(state,victory){
    if(!state.active||state.rewardClaimed)return reject('encounter_already_finished');
    const alive=Object.values(state.combatants).filter(c=>c.hp>0);
    if(alive.some(c=>victory?!c.isPlayer:c.isPlayer))return reject('encounter_not_finished');
    state.active=false;state.rewardClaimed=true;state.commandRevision++;state.outcome=victory?'victory':'defeat';
    return {ok:true,claimId:`encounter:${state.encounterId}`,victory};
  }
  function absorbDamage(state,targetId,raw){
    const statuses=(state.statusEffects?.[targetId]||[]).map(s=>({...s}));
    const shield=statuses.find(s=>s.id==='divine_shield');
    const absorbed=Math.min(Math.max(0,raw),Math.max(0,shield?.shieldHp||0));
    if(shield)shield.shieldHp-=absorbed;
    return {damage:Math.max(0,raw)-absorbed,absorbed,statuses:statuses.filter(s=>s.id!=='divine_shield'||s.shieldHp>0)};
  }
  return Object.freeze({begin,command,prepare,accept,attackRoll,resolve,commit,finish,absorbDamage,SUPPORT});
});
