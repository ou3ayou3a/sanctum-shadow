(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./navigation-core.js'):root.SanctumNavigation,node?require('./collision-catalog.js'):root.SanctumCollisionCatalog);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TacticalCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Navigation,CollisionCatalog){
  'use strict';

  const DEFAULT_MOVE_RANGE=4.5;
  // Character collision rings keep two adjacent humanoids roughly 2.3–2.5m
  // apart in the rendered world. Give frontline weapons enough reach to cover
  // that visual contact, otherwise actors can visibly touch while the rules
  // still reject every melee attack as out of range.
  const ROLE_RANGES=Object.freeze({frontline:2.75,skirmisher:3.25,ranged:10,caster:9});
  function finite(value){return Number.isFinite(Number(value));}
  function point(value){return value&&finite(value.x)&&finite(value.z)?{x:Number(value.x),z:Number(value.z)}:null;}
  function distance(a,b){const pa=point(a),pb=point(b);return pa&&pb?Math.hypot(pb.x-pa.x,pb.z-pa.z):null;}
  function inferRole(combatant={}){if(ROLE_RANGES[combatant.tacticalRole])return combatant.tacticalRole;const text=`${combatant.name||''} ${combatant.class||''} ${combatant.classId||''}`.toLowerCase();if(/crossbow|archer|bow|ranger|hunter/.test(text))return'ranged';if(/mage|wizard|witch|cleric|priest|warlock|caster/.test(text))return'caster';if(/rogue|assassin|skirmisher/.test(text))return'skirmisher';return'frontline';}
  function attackRange(combatant={}){const explicit=Number(combatant.attackRange);return Number.isFinite(explicit)&&explicit>0?Math.min(30,explicit):ROLE_RANGES[inferRole(combatant)];}
  function distanceToSegment(pointValue,startValue,endValue){const p=point(pointValue),a=point(startValue),b=point(endValue);if(!p||!a||!b)return Infinity;const dx=b.x-a.x,dz=b.z-a.z,lengthSq=dx*dx+dz*dz;if(lengthSq<1e-8)return Math.hypot(p.x-a.x,p.z-a.z);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/lengthSq)),x=a.x+t*dx,z=a.z+t*dz;return Math.hypot(p.x-x,p.z-z);}
  function coverBonus(attacker,target,cover=[]){const a=point(attacker?.position||attacker),t=point(target?.position||target);if(!a||!t)return 0;let bonus=0;for(const obstacle of cover||[]){const radius=Math.max(.2,Math.min(3,Number(obstacle?.radius)||.65));if(distanceToSegment(obstacle,a,t)>radius)continue;const toTarget=distance(obstacle,t),toAttacker=distance(obstacle,a);if(toTarget===null||toAttacker===null||toTarget>=toAttacker)continue;bonus=Math.max(bonus,obstacle.type==='full'?5:2);}return bonus;}
  function rectangles(obstacles=[]){return obstacles.map(o=>({x:Number(o.x)||0,z:Number(o.z)||0,hw:Math.max(.05,Number(o.hw??o.radius)||.65),hd:Math.max(.05,Number(o.hd??o.radius)||.65)}));}
  function navigation({bounds=12,obstacles=[],cover=[],occupied=[]}={}){return new Navigation.NavigationGrid({minX:-bounds,maxX:bounds,minZ:-bounds,maxZ:bounds,cellSize:.25,padding:.35,obstacles:rectangles([...obstacles,...cover,...occupied])});}
  function worldSnapshot(engine){
    const origin=point(engine?.actor?.position);if(!origin)return null;
    return sanitizeSnapshot({origin,locationId:engine.zone.id});
  }
  function sanitizeSnapshot(value){
    const origin=point(value?.origin);if(!origin||Math.abs(origin.x)>10000||Math.abs(origin.z)>10000)return null;
    const zone=CollisionCatalog?.[value.locationId];if(!zone)return null;
    const b=zone.bounds;if(origin.x<b.minX||origin.x>b.maxX||origin.z<b.minZ||origin.z>b.maxZ)return null;
    const obstacles=zone.obstacles.filter(o=>Math.abs(o.x-origin.x)<16+o.hw&&Math.abs(o.z-origin.z)<16+o.hd).map(o=>({x:o.x-origin.x,z:o.z-origin.z,hw:o.hw,hd:o.hd}));
    // Solid boundary strips prevent tactical moves outside the physical zone.
    obstacles.push({x:b.minX-origin.x-50,z:0,hw:50,hd:200},{x:b.maxX-origin.x+50,z:0,hw:50,hd:200},{x:0,z:b.minZ-origin.z-50,hw:200,hd:50},{x:0,z:b.maxZ-origin.z+50,hw:200,hd:50});
    return {origin:{...origin},locationId:value.locationId,obstacles};
  }
  function placeCombatants(state){
    const placed=[];for(const actor of Object.values(state.combatants)){
      const grid=navigation({...state.tactical,occupied:placed}),position=grid.projectOpen(actor.position);if(!position)continue;
      actor.position={x:position.x,z:position.z};placed.push({...actor.position,radius:.45});
    }
  }
  function advanceEnemy(state,actor,target){
    const options={...state.tactical,occupied:Object.values(state.combatants).filter(c=>c.id!==actor.id&&c.id!==target.id&&c.hp>0&&c.position).map(c=>({...c.position,radius:.45}))},grid=navigation(options),route=grid.findPath(actor.position,target.position);
    if(!route.length)return;let budget=state.tactical?.moveRange||DEFAULT_MOVE_RANGE,previous=actor.position,path=[previous];
    for(const next of route){const length=distance(previous,next);if(!length)continue;const travel=Math.min(length,budget),candidate=moveToward(previous,next,travel);if(distance(candidate,target.position)<1.15)break;path.push(candidate);previous=candidate;budget-=travel;if(budget<=.001)break;}
    if(path.length>1){actor.position=point(path.at(-1));actor.movementPath=path;}
  }
  function lineOfSight(a,b,{obstacles=[],cover=[]}={}){
    const from=point(a?.position||a),to=point(b?.position||b);if(!from||!to)return true;
    const blockers=rectangles([...obstacles,...cover.filter(o=>o.type==='full')]);
    // Exact segment/AABB intersection, including obstacles close to the attacker.
    return !blockers.some(o=>{let low=0,high=1;for(const [axis,half] of [['x',o.hw],['z',o.hd]]){const delta=to[axis]-from[axis],min=o[axis]-half,max=o[axis]+half;if(Math.abs(delta)<1e-9){if(from[axis]<min||from[axis]>max)return false;}else{const a=(min-from[axis])/delta,b=(max-from[axis])/delta;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return false;}}return true;});
  }
  function validateAttack(attacker,target,options={}){if(!attacker||!target||Number(target.hp)<=0)return{ok:false,reason:'invalid_target',distance:null,range:attackRange(attacker),coverBonus:0};const measured=distance(attacker.position,target.position),range=attackRange(attacker),bonus=coverBonus(attacker,target,options.cover||[]);if(measured!==null&&measured>range+.001)return{ok:false,reason:'out_of_range',distance:measured,range,coverBonus:bonus};if(!lineOfSight(attacker,target,options))return{ok:false,reason:'blocked_line_of_sight',distance:measured,range,coverBonus:bonus};return{ok:true,reason:'ok',distance:measured,range,coverBonus:bonus};}
  function validateMove(current,next,options={}){
    const {maxDistance=DEFAULT_MOVE_RANGE,bounds=12}=options,from=point(current),to=point(next);if(!from||!to)return{ok:false,reason:'invalid_position',distance:null};
    const measured=distance(from,to);if(measured>maxDistance+.001)return{ok:false,reason:'out_of_range',distance:measured};if(Math.abs(to.x)>bounds||Math.abs(to.z)>bounds)return{ok:false,reason:'outside_battlefield',distance:measured};
    const grid=navigation(options);if(grid.isPointBlocked(to))return{ok:false,reason:'occupied_or_blocked',distance:measured};
    let path=grid.hasLineOfSight(from,to)?[from,to]:grid.findPath(from,to);if(!path.length)return{ok:false,reason:'no_path',distance:measured};
    if(!grid.hasLineOfSight(from,path[0]))return{ok:false,reason:'blocked_start',distance:measured};path=[from,...path.filter(p=>distance(p,from)>.001)];
    const length=path.reduce((n,p,i)=>n+(i?distance(path[i-1],p):0),0);if(length>maxDistance+.001)return{ok:false,reason:'path_out_of_range',distance:length};
    return{ok:true,reason:'ok',distance:length,position:to,path};
  }
  function moveToward(current,target,distanceLimit=DEFAULT_MOVE_RANGE){const from=point(current),to=point(target);if(!from||!to)return from;const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);if(length<1e-8)return from;const amount=Math.min(Math.max(0,distanceLimit),length);return{x:from.x+dx/length*amount,z:from.z+dz/length*amount};}

  return Object.freeze({DEFAULT_MOVE_RANGE,ROLE_RANGES,point,distance,inferRole,attackRange,distanceToSegment,coverBonus,lineOfSight,navigation,worldSnapshot,sanitizeSnapshot,placeCombatants,advanceEnemy,validateAttack,validateMove,moveToward});
});
