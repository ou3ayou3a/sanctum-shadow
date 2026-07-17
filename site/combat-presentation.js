(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CombatPresentation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CLASS_PROFILES=Object.freeze({
    warrior:Object.freeze({clip:'attack_heavy',duration:0.98,impactFraction:0.57,effect:'melee',damageType:'physical',reaction:'block'}),
    paladin:Object.freeze({clip:'attack_smite',duration:0.92,impactFraction:0.57,effect:'melee',damageType:'holy',reaction:'block'}),
    cleric:Object.freeze({clip:'staff_strike',duration:0.86,impactFraction:0.51,effect:'melee',damageType:'holy',reaction:'block'}),
    mage:Object.freeze({clip:'cast',duration:1.12,releaseFraction:0.42,effect:'projectile',damageType:'arcane',reaction:'dodge'}),
    rogue:Object.freeze({clip:'attack_dual',duration:0.78,impactFraction:0.46,effect:'melee',damageType:'shadow',reaction:'dodge',count:2}),
    ranger:Object.freeze({clip:'bow_shot',duration:0.96,releaseFraction:0.48,effect:'projectile',damageType:'physical',reaction:'dodge'}),
  });
  const SPELL_TYPES=new Set(['physical','arcane','fire','holy','heal','lightning','shadow','debuff','buff','movement','nature','revive']);

  function normalizeClass(value){
    const id=String(value||'warrior').toLowerCase().replaceAll('-','_');
    return CLASS_PROFILES[id]?id:'warrior';
  }
  function inferClass(combatant={}){
    if(combatant.characterClass)return normalizeClass(combatant.characterClass);
    const text=`${combatant.id||''} ${combatant.sourceId||''} ${combatant.name||''} ${combatant.tacticalRole||''}`.toLowerCase();
    if(/archer|ranger|hunter|ranged/.test(text))return'ranger';
    if(/mage|wizard|witch|cultist|warlock|voice|caster/.test(text))return'mage';
    if(/cleric|priest|sister|brother/.test(text))return'cleric';
    if(/rogue|thief|assassin|bandit|skirmisher/.test(text))return'rogue';
    if(/paladin|templar|guard/.test(text))return'paladin';
    return'warrior';
  }
  function safeSpell(spell={}){
    const type=SPELL_TYPES.has(spell.type)?spell.type:'arcane';
    return{id:String(spell.id||'spell').replace(/[^a-z0-9_-]/gi,'').slice(0,64)||'spell',name:String(spell.name||'Spell').slice(0,80),type};
  }
  function profileFor({combatant={},action='attack',spell=null}={}){
    const classId=inferClass(combatant),base=CLASS_PROFILES[classId];
    if(action!=='spell'){
      const releaseDelay=base.duration*(base.releaseFraction??base.impactFraction),travelDuration=base.effect==='projectile'?.42:0,impactDelay=releaseDelay+travelDuration;
      return{...base,classId,action:'attack',releaseDelay:Number(releaseDelay.toFixed(3)),travelDuration,impactDelay:Number(impactDelay.toFixed(3)),recoveryDelay:Math.max(base.duration,impactDelay+.12)};
    }
    const clean=safeSpell(spell),selfTarget=/heal|buff|revive/.test(clean.type);
    const effect=/lightning/.test(clean.type)?'lightning':/heal|revive/.test(clean.type)?'heal':/buff|debuff/.test(clean.type)?'aura':/movement/.test(clean.type)?'movement':'projectile';
    const duration=Math.max(1.02,base.duration),releaseFraction=effect==='projectile'?0.42:0.55,releaseDelay=duration*releaseFraction,travelDuration=effect==='projectile'?.42:0,impactDelay=releaseDelay+travelDuration;
    return{...base,classId,action:'spell',clip:'cast',duration,releaseFraction,effect,damageType:clean.type,spell:clean,selfTarget,releaseDelay:Number(releaseDelay.toFixed(3)),travelDuration,impactDelay:Number(impactDelay.toFixed(3)),recoveryDelay:Math.max(duration,impactDelay+.12),count:clean.id==='magic_missile'?3:1};
  }
  function event({seq=0,actor={},target=null,action='attack',spell=null,hit=false,crit=false,damage=0,healing=0,moved=false}={}){
    const profile=profileFor({combatant:actor,action,spell});
    return{
      id:`combat-${Math.max(0,Number(seq)||0)}`,
      actorId:String(actor.id||''),targetId:String(target?.id||actor.id||''),
      action:profile.action,classId:profile.classId,clip:profile.clip,effect:profile.effect,damageType:profile.damageType,
      spell:profile.spell||null,hit:!!hit,crit:!!crit,damage:Math.max(0,Number(damage)||0),healing:Math.max(0,Number(healing)||0),moved:!!moved,
      releaseDelay:profile.releaseDelay,travelDuration:profile.travelDuration||0,impactDelay:profile.impactDelay,recoveryDelay:profile.recoveryDelay,count:profile.count||1,selfTarget:!!profile.selfTarget,
    };
  }
  function missReaction(target={},eventId=''){
    const preferred=CLASS_PROFILES[inferClass(target)].reaction;
    if(preferred==='block')return'block';
    const checksum=String(`${target.id||''}:${eventId}`).split('').reduce((sum,char)=>sum+char.charCodeAt(0),0);
    return checksum%4===0?'block':'dodge';
  }

  return Object.freeze({CLASS_PROFILES,normalizeClass,inferClass,profileFor,event,missReaction});
});
