(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TacticalCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DEFAULT_MOVE_RANGE=4.5;
  const ROLE_RANGES=Object.freeze({frontline:2.25,skirmisher:3.25,ranged:10,caster:9});
  function finite(value){return Number.isFinite(Number(value));}
  function point(value){return value&&finite(value.x)&&finite(value.z)?{x:Number(value.x),z:Number(value.z)}:null;}
  function distance(a,b){const pa=point(a),pb=point(b);return pa&&pb?Math.hypot(pb.x-pa.x,pb.z-pa.z):null;}
  function inferRole(combatant={}){if(ROLE_RANGES[combatant.tacticalRole])return combatant.tacticalRole;const text=`${combatant.name||''} ${combatant.class||''} ${combatant.classId||''}`.toLowerCase();if(/crossbow|archer|bow|ranger|hunter/.test(text))return'ranged';if(/mage|wizard|witch|cleric|priest|warlock|caster/.test(text))return'caster';if(/rogue|assassin|skirmisher/.test(text))return'skirmisher';return'frontline';}
  function attackRange(combatant={}){const explicit=Number(combatant.attackRange);return Number.isFinite(explicit)&&explicit>0?Math.min(30,explicit):ROLE_RANGES[inferRole(combatant)];}
  function distanceToSegment(pointValue,startValue,endValue){const p=point(pointValue),a=point(startValue),b=point(endValue);if(!p||!a||!b)return Infinity;const dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;if(lengthSq<1e-8)return Math.hypot(p.x-a.x,p.z-a.z);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/lengthSq)),x=a.x+t*dx,z=a.z+t*dz;return Math.hypot(p.x-x,p.z-z);}
  function coverBonus(attacker,target,cover=[]){const a=point(attacker?.position||attacker),t=point(target?.position||target);if(!a||!t)return 0;let bonus=0;for(const obstacle of cover||[]){const radius=Math.max(.2,Math.min(3,Number(obstacle?.radius)||.65));if(distanceToSegment(obstacle,a,t)>radius)continue;const toTarget=distance(obstacle,t),toAttacker=distance(obstacle,a);if(toTarget===null||toAttacker===null||toTarget>=toAttacker)continue;bonus=Math.max(bonus,obstacle.type==='full'?5:2);}return bonus;}
  function validateAttack(attacker,target,{cover=[]}={}){if(!attacker||!target||Number(target.hp)<=0)return{ok:false,reason:'invalid_target',distance:null,range:attackRange(attacker),coverBonus:0};const measured=distance(attacker.position,target.position),range=attackRange(attacker),bonus=coverBonus(attacker,target,cover);if(measured!==null&&measured>range+.001)return{ok:false,reason:'out_of_range',distance:measured,range,coverBonus:bonus};return{ok:true,reason:'ok',distance:measured,range,coverBonus:bonus};}
  function validateMove(current,next,{maxDistance=DEFAULT_MOVE_RANGE,bounds=12}={}){const from=point(current),to=point(next);if(!from||!to)return{ok:false,reason:'invalid_position',distance:null};const measured=distance(from,to);if(measured>maxDistance+.001)return{ok:false,reason:'out_of_range',distance:measured};if(Math.abs(to.x)>bounds||Math.abs(to.z)>bounds)return{ok:false,reason:'outside_battlefield',distance:measured};return{ok:true,reason:'ok',distance:measured,position:to};}
  function moveToward(current,target,distanceLimit=DEFAULT_MOVE_RANGE){const from=point(current),to=point(target);if(!from||!to)return from;const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);if(length<1e-8)return from;const amount=Math.min(Math.max(0,distanceLimit),length);return{x:from.x+dx/length*amount,z:from.z+dz/length*amount};}

  return Object.freeze({DEFAULT_MOVE_RANGE,ROLE_RANGES,point,distance,inferRole,attackRange,distanceToSegment,coverBonus,validateAttack,validateMove,moveToward});
});
