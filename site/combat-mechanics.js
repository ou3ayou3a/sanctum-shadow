// Shared combat effects. Resolution operates on a copy; UI/transport commit it.
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./rules.js'):root.SanctumRules,node?require('./tactical-combat.js'):root.TacticalCombat);if(node)module.exports=api;if(root)root.CombatMechanics=api;})(globalThis,function(Rules,Tactical){
  'use strict';
  const policies={
    cure_wounds:['ally',12],spirit_weapon:['enemy',12],mass_heal:['self',0],divine_strike:['enemy',12],revivify:['downed',3],
    holy_smite:['enemy',3],lay_on_hands:['other',3],divine_shield:['ally',12],judgment:['enemy',12],wrath_divine:['enemy',12],
    magic_missile:['enemy',12],fireball:['enemy',12,4],mirror_image:['self',0],chain_lightning:['enemy',12,5],disintegrate:['enemy',12],
    war_cry:['self',0],whirlwind:['self',0,3],last_stand:['self',0],execute:['enemy',3],avatar_war:['self',0],
    sneak_attack:['enemy',3],smoke_bomb:['self',0,4],shadow_step:['self',0],garrote:['enemy',3],phantom_kill:['enemy',3],
    hunters_mark:['enemy',12],multi_shot:['enemy',12],vine_trap:['enemy',12],volley:['enemy',12,4],apex_predator:['enemy',12],
  };
  const enemyIds=['hellfire_bolt','shadow_step','savage_bite','shadow_drain','war_cry','execute','shadow_curse','soul_drain','hellfire','divine_wrath','summon_flame','void_scream','soul_rend','dark_surge','holy_smite_corrupted'];
  function list(state,id){return state.statusEffects?.[id]||[];}
  function has(state,id,status){return list(state,id).some(s=>s.id===status);}
  function targetFor(state,actor,id,targetId){const policy=policies[id];return policy?.[0]==='self'?actor:state.combatants[targetId];}
  function validate(state,actor,spell,targetId){
    const p=policies[spell.id];if(!p)return 'unknown_ability';
    if(has(state,actor.id,'garrote_silence')||has(state,actor.id,'stunned'))return 'cannot_cast';
    const target=targetFor(state,actor,spell.id,targetId);if(!target)return 'invalid_target';
    const ally=target.isPlayer===actor.isPlayer;
    if(p[0]==='enemy'&&(ally||target.hp<=0))return 'invalid_enemy_target';
    if(['ally','other'].includes(p[0])&&(!ally||target.hp<=0||(p[0]==='other'&&actor.id===target.id)))return 'invalid_ally_target';
    if(p[0]==='downed'&&(!ally||target.id===actor.id||target.hp>0||target.downedRound==null||state.round-target.downedRound>3))return 'invalid_revival_target';
    const d=Tactical.distance(actor.position,target.position);if(d!==null&&d>p[1]+.001)return 'out_of_range';
    if(spell.id==='execute'&&target.hp>target.maxHp*.25)return 'target_not_weakened';
    if(spell.id==='sneak_attack'&&actor.firstStrikeDone&&!has(state,actor.id,'shadow_step')&&!Object.values(state.combatants).some(c=>c.id!==actor.id&&c.isPlayer===actor.isPlayer&&c.hp>0&&(Tactical.distance(c.position,target.position)??Infinity)<=3))return 'requires_stealth_or_flanking';
    return null;
  }
  function resolve(input,actorId,spell,options={}){
    const state=JSON.parse(JSON.stringify({combatants:input.combatants,statusEffects:input.statusEffects||{},round:input.round})),actor=state.combatants[actorId],events=[];
    const rng=options.rng|| (options.seed!==undefined?Rules.createRng(options.seed):Math.random);
    const roll=f=>Rules.rollFormula(f,{statMods:actor.statMods||{},rng}).total;
    const status=(id,value)=>{state.statusEffects[id]=list(state,id).filter(s=>s.id!==value.id).concat({...value});events.push({type:'status',actorId,targetId:id,status:value.id,text:value.name});};
    const heal=(target,amount)=>{if(!target||target.hp<=0)return;const n=Math.max(0,Math.min(target.maxHp-target.hp,amount));target.hp+=n;events.push({type:'heal',actorId,targetId:target.id,healing:n});};
    const damage=(target,amount,type='physical')=>{const result=applyDamage(state,target.id,amount,type);events.push({type:'damage',actorId,targetId:target.id,damage:result.damage,absorbed:result.absorbed});return result.damage;};
    const buff=(id,name,turns,extra={})=>status(actorId,{id,name,icon:spell.icon||'✨',turnsLeft:turns,...extra});
    const target=options.enemy?state.combatants[options.targetId]:targetFor(state,actor,spell.id,options.targetId);
    const allies=Object.values(state.combatants).filter(c=>c.isPlayer===actor.isPlayer&&c.hp>0);
    const area=(center,radius)=>Object.values(state.combatants).filter(c=>c.hp>0&&(Tactical.distance(c.position,center.position)??Infinity)<=radius&&Tactical.lineOfSight(center,c,input.tactical||{}));
    if(options.enemy){
      if(!enemyIds.includes(spell.id)||!target||target.hp<=0||target.isPlayer===actor.isPlayer)throw new Error('Invalid enemy ability or target');
      const level=Math.max(1,Math.min(20,actor.level||1));
      const formulas={hellfire_bolt:`${level}d6`,savage_bite:`${level}d8`,shadow_drain:`${level}d6`,hellfire:`${level+1}d8`,divine_wrath:`${level}d10`,void_scream:`${level}d8`,soul_rend:`${level+1}d10`,dark_surge:`${level+2}d8`,holy_smite_corrupted:`${level}d8`,execute:`${target.hp<=target.maxHp*.25?level+2:level}d8`};
      if(formulas[spell.id]){const dealt=damage(target,roll(formulas[spell.id]),['savage_bite','execute'].includes(spell.id)?'physical':'necrotic');if(spell.id==='shadow_drain')heal(actor,Math.floor(dealt/2));}
      if(spell.id==='savage_bite'&&rng()<.5)status(target.id,{id:'bleed',name:'Bleeding',turnsLeft:2,dmgPerTurn:3});
      if(spell.id==='void_scream')status(target.id,{id:'stunned',name:'Stunned',turnsLeft:1});
      if(spell.id==='summon_flame')status(target.id,{id:'burning',name:'Burning',turnsLeft:3,dmgPerTurn:8,damageType:'fire'});
      if(spell.id==='shadow_curse')status(target.id,{id:'shadow_curse',name:'Shadow Cursed',turnsLeft:3,atkMod:-2});
      if(spell.id==='war_cry')buff('war_cry','War Cry',3,{atkMod:2});
      if(spell.id==='shadow_step')buff('shadow_step','Shadow Step',1,{acBonus:3});
      if(spell.id==='soul_drain'){const n=Math.min(target.mp||0,20+level*5);target.mp-=n;actor.mp=Math.min(actor.maxMp||100,(actor.mp||0)+n);}
      if(spell.id==='soul_rend'){target.maxHp=Math.max(1,target.maxHp-5);target.hp=Math.min(target.hp,target.maxHp);}
    }else{
      let multiplier=1;actor.resource=actor.resource??(actor.characterClass==='cleric'?3:0);
      if(actor.characterClass==='mage'){if(actor.resource>=5){multiplier=2;actor.resource=0;}else actor.resource++;}
      if(actor.characterClass==='rogue'&&spell.damage){multiplier=actor.resource>=5?2.5:actor.resource>=3?1.5:1;if(actor.resource>=5)actor.resource=0;if(spell.id==='sneak_attack'){if(!actor.firstStrikeDone)multiplier=Math.max(2,multiplier);actor.firstStrikeDone=true;}}
      const healing=f=>{let n=roll(f);if(actor.characterClass==='cleric'){n=Math.floor(n*(actor.resource>0?1.5:1))+(actor.statMods?.wis||0)*3;if(actor.resource>0)actor.resource--;}return Math.max(0,n);};
      switch(spell.id){
        case 'cure_wounds':case 'lay_on_hands':heal(target,healing(spell.heal));break;
        case 'mass_heal':{const n=healing(spell.heal);allies.forEach(c=>heal(c,n));break;}
        case 'revivify':target.hp=1;delete target.downedRound;state.statusEffects[target.id]=[];events.push({type:'revive',actorId,targetId:target.id,healing:1});break;
        case 'divine_shield':status(target.id,{id:'divine_shield',name:'Divine Shield',icon:'🔆',turnsLeft:4,shieldHp:30});break;
        case 'war_cry':allies.forEach(c=>status(c.id,{id:'war_cry',name:'War Cry',turnsLeft:3,atkMod:2}));break;
        case 'last_stand':buff('last_stand','Last Stand',4);break;
        case 'avatar_war':buff('avatar_war','Avatar of War',3,{dmgMult:2});break;
        case 'mirror_image':buff('mirror_image','Mirror Image',5,{charges:3});break;
        case 'shadow_step':buff('shadow_step','Shadow Step',2,{acBonus:4,nextHitAutoHit:true});break;
        case 'hunters_mark':buff('hunters_mark',"Hunter's Mark",6,{targetId:target.id});break;
        case 'vine_trap':status(target.id,{id:'vine_trap',name:'Rooted',turnsLeft:2});break;
        case 'smoke_bomb':area(actor,4).forEach(c=>status(c.id,{id:'smoke_bomb_debuff',name:'Smoke',turnsLeft:2,atkMod:-4}));break;
        case 'spirit_weapon':case 'apex_predator':buff(spell.id,spell.name,spell.id==='spirit_weapon'?3:5,{companionDamage:'2d8'});damage(target,roll('2d8'),'holy');break;
        case 'fireball':case 'volley':case 'whirlwind':{const n=roll(spell.damage)*multiplier;area(spell.id==='whirlwind'?actor:target,policies[spell.id][2]).filter(c=>spell.id!=='whirlwind'||c.id!==actorId).forEach(c=>damage(c,n,spell.type));break;}
        case 'chain_lightning':area(target,5).concat(target).filter((c,i,a)=>a.findIndex(t=>t.id===c.id)===i).filter(c=>c.isPlayer!==actor.isPlayer||rng()<.5).forEach(c=>damage(c,roll(spell.damage)*multiplier,'lightning'));break;
        case 'multi_shot':Object.values(state.combatants).filter(c=>c.isPlayer!==actor.isPlayer&&c.hp>0&&(Tactical.distance(c.position,actor.position)??Infinity)<=12).sort((a,b)=>a.id===target.id?-1:b.id===target.id?1:a.id.localeCompare(b.id)).slice(0,3).forEach(c=>damage(c,roll('2d8')+(actor.statMods?.dex||0)));break;
        default:{let n=roll(spell.damage)*multiplier;if(spell.id==='disintegrate'){const save=Rules.resolveSavingThrow({ability:'con',dc:15,abilityMod:target.statMods?.con||0,rng});if(save.success)n=Math.floor(n/2);events.push({type:'save',actorId,targetId:target.id,...save});}
          if(spell.id==='phantom_kill'&&target.hp<=target.maxHp*.3)n=target.hp+(list(state,target.id).find(s=>s.id==='divine_shield')?.shieldHp||0);
          damage(target,n,spell.type);if(spell.id==='holy_smite')heal(actor,roll('1d4'));if(spell.id==='garrote')status(target.id,{id:'garrote_silence',name:'Silenced',turnsLeft:3});break;}
      }
    }
    return {combatants:state.combatants,statusEffects:state.statusEffects,events};
  }
  function applyDamage(state,id,raw,type='physical'){
    const target=state.combatants[id];let amount=Math.max(0,Math.floor(raw)),absorbed=0;
    if(target.immunities?.includes(type))amount=0;else if(target.resistances?.includes(type))amount=Math.floor(amount/2);else if(target.vulnerabilities?.includes(type))amount*=2;
    if(target.characterClass==='mage'&&target.hp<target.maxHp*.3)amount=Math.floor(amount*1.25);
    if(target.characterClass==='paladin')amount=Math.max(0,amount-Math.max(0,2+(target.statMods?.wis||0)));
    const statuses=list(state,id),image=statuses.find(s=>s.id==='mirror_image'&&s.charges>0),shield=statuses.find(s=>s.id==='divine_shield');
    if(image&&amount>0){image.charges--;absorbed=amount;amount=0;}
    if(shield){const n=Math.min(amount,Math.max(0,shield.shieldHp||0));shield.shieldHp-=n;amount-=n;absorbed+=n;}
    state.statusEffects=state.statusEffects||{};state.statusEffects[id]=statuses.filter(s=>(s.id!=='mirror_image'||s.charges>0)&&(s.id!=='divine_shield'||s.shieldHp>0));
    const damage=Math.min(target.hp,amount);target.hp=Math.max(0,target.hp-amount);if(target.hp===0&&target.downedRound==null)target.downedRound=state.round||1;
    if(target.characterClass==='warrior')target.resource=Math.min(100,(target.resource||0)+Math.min(20,Math.floor(damage*.6)));
    return {damage,absorbed};
  }
  function startTurn(state,id){
    const actor=state.combatants[id];if(!actor)return [];
    state.statusEffects=state.statusEffects||{};
    const key=`${state.round}:${state.currentTurnIndex}:${id}`;if(state.lastStatusTurn===key)return [];state.lastStatusTurn=key;
    const statuses=list(state,id),events=[];state.turnBlocked=statuses.some(s=>s.id==='stunned');
    for(const s of statuses){if(s.dmgPerTurn&&actor.hp>0){const hit=applyDamage(state,id,s.dmgPerTurn,s.damageType||'physical');events.push({type:'damage',targetId:id,...hit});}if(s.companionDamage&&actor.hp>0){const t=Object.values(state.combatants).find(c=>c.isPlayer!==actor.isPlayer&&c.hp>0);if(t){const hit=applyDamage(state,t.id,Rules.rollFormula(s.companionDamage).total);events.push({type:'damage',targetId:t.id,...hit});}}s.turnsLeft--;}
    state.statusEffects[id]=list(state,id).filter(s=>s.turnsLeft>0);
    if(actor.characterClass==='cleric')actor.resource=3;
    if(actor.characterClass==='ranger')actor.resource=Math.min(3,(actor.resource||0)+1);
    if(actor.characterClass==='warrior')actor.resource=Math.max(0,(actor.resource||0)-10);
    return events;
  }
  function attack(input,actorId,targetId,options={}){
    const state=JSON.parse(JSON.stringify({combatants:input.combatants,statusEffects:input.statusEffects||{},round:input.round})),actor=state.combatants[actorId],target=state.combatants[targetId];
    const rng=options.seed!==undefined?Rules.createRng(options.seed):Math.random,statuses=list(state,actorId),shadow=statuses.find(s=>s.nextHitAutoHit);
    const attack=Rules.resolveAttack({attackBonus:(actor.attackBonus??actor.atk??0)+statuses.reduce((n,s)=>n+(s.atkMod||0),0),targetAC:(target.ac||10)+list(state,targetId).reduce((n,s)=>n+(s.acBonus||0),0)+(options.coverBonus||0),attackerConditions:statuses.map(s=>s.id),targetConditions:list(state,targetId).map(s=>s.id),autoHit:!!shadow,rng});
    if(shadow)shadow.nextHitAutoHit=false;
    let damage=0,absorbed=0;
    if(attack.hit){let raw=Rules.rollFormula('1d8',{modifier:actor.damageMod??actor.atk??0,critical:attack.crit,rng}).total;
      let mult=1;const r=actor.resource||0,cls=actor.characterClass;
      if(cls==='warrior')mult=r>=100?2:r>=50?1.35:1;
      if(cls==='rogue'){mult=r>=5?2.5:r>=3?1.5:1;if(!actor.firstStrikeDone){mult=Math.max(mult,2);actor.firstStrikeDone=true;}actor.resource=r>=5?0:r;}
      if(cls==='ranger'&&r>=2){mult=1.6;actor.resource=r-2;}
      for(const status of statuses){if(status.dmgMult)mult=Math.max(mult,status.dmgMult);if(status.id==='last_stand'&&actor.hp<20)mult*=1.5;}
      raw=Math.floor(raw*mult);if(statuses.some(s=>s.id==='hunters_mark'&&s.targetId===targetId))raw+=Rules.rollFormula('2d6',{rng}).total;
      const result=applyDamage(state,targetId,raw);damage=result.damage;absorbed=result.absorbed;
      if(cls==='warrior')actor.resource=Math.min(100,(actor.resource||0)+10);
      if(cls==='rogue')actor.resource=Math.min(5,(actor.resource||0)+(attack.crit?2:1));
    }
    return {combatants:state.combatants,statusEffects:state.statusEffects,events:[{type:'attack',actorId,targetId,...attack,damage,absorbed}]};
  }
  return {policies,enemyIds,validate,resolve,applyDamage,startTurn,has,targetFor,attack};
});
