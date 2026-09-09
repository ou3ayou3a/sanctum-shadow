(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./tactical-combat.js'):root.TacticalCombat);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PhysicalActions=api;})(globalThis,function(Tactical){
 'use strict';
 function assess({actor,entity,locationId,obstacles=[]}){
  if(!entity?.id||!Tactical.point(entity.position)||!Tactical.point(actor))return{ok:false,reason:'missing_entity'};
  if(entity.zoneId&&entity.zoneId!==locationId)return{ok:false,reason:'wrong_location'};
  if(entity.active===false)return{ok:false,reason:'unavailable_entity'};
  if(Tactical.distance(actor,entity.position)>(entity.range||2.3)+.35)return{ok:false,reason:'out_of_reach'};
  if(!Tactical.lineOfSight(actor,entity.position,{obstacles}))return{ok:false,reason:'blocked_interaction'};
  return{ok:true};
 }
 function matches(context,entityId,locationId){return !!context&&context.entityId===entityId&&context.locationId===locationId;}
 return{assess,matches};
});
