(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ClaudeEffects=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function itemName(item){return String(typeof item==='string'?item:item?.name||item?.id||'').trim().toLowerCase();}

  function apply(effects,context={}){
    if(context.authoritative===false)return {applied:false,reason:'not_authoritative',changes:[]};
    if(!effects||typeof effects!=='object')return {applied:false,reason:'no_effects',changes:[]};
    const character=context.character;
    const sceneState=context.sceneState||{};
    sceneState.flags=sceneState.flags||{};
    sceneState.knownFacts=sceneState.knownFacts||{};
    const changes=[];

    for(const [key,value] of Object.entries(effects.flags||{})){sceneState.flags[key]=value;changes.push(`flag:${key}`);}
    for(const [key,value] of Object.entries(effects.facts||{})){sceneState.knownFacts[key]=value;changes.push(`fact:${key}`);}

    for(const entry of effects.reputation||[]){
      if(!entry||!entry.faction||!Number.isInteger(entry.delta)||entry.delta===0)continue;
      if(typeof context.changeRep==='function')context.changeRep(entry.faction,entry.delta,context.reason||'Conversation outcome');
      else if(context.reputation&&Object.prototype.hasOwnProperty.call(context.reputation,entry.faction))context.reputation[entry.faction]=clamp((context.reputation[entry.faction]||0)+entry.delta,-100,100);
      changes.push(`reputation:${entry.faction}:${entry.delta}`);
    }

    if(character){
      const resources=effects.resources||{};
      if(Number.isInteger(resources.hp)&&resources.hp!==0){
        const before=Number(character.hp)||0,maxHp=Math.max(1,Number(character.maxHp)||before||1);
        character.hp=clamp(before+resources.hp,0,maxHp);
        const actual=character.hp-before;
        if(actual!==0){context.addLog?.(`${actual>0?'💚':'💥'} ${Math.abs(actual)} HP ${actual>0?'restored':'lost'} (${character.hp}/${maxHp}).`,actual>0?'holy':'combat');changes.push(`hp:${actual}`);}
      }
      for(const [key,grant] of [['holy','grantHoly'],['hell','grantHell']]){
        const delta=effects.resources?.[key];
        if(!Number.isInteger(delta)||delta===0)continue;
        const prop=`${key}Points`;
        if(delta>0&&typeof context[grant]==='function')context[grant](delta);
        else character[prop]=Math.max(0,(Number(character[prop])||0)+delta);
        context.addLog?.(`${key==='holy'?'☩':'⛧'} ${delta>0?'+':''}${delta} ${key} points.`,key==='holy'?'holy':'dark');
        changes.push(`${key}:${delta}`);
      }
      const xp=effects.resources?.xp;
      if(Number.isInteger(xp)&&xp>0){
        if(typeof context.grantXP==='function')context.grantXP(xp);else character.xp=(Number(character.xp)||0)+xp;
        changes.push(`xp:${xp}`);
      }

      character.inventory=Array.isArray(character.inventory)?character.inventory:[];
      for(const name of effects.items?.remove||[]){
        const index=character.inventory.findIndex(item=>itemName(item)===String(name).trim().toLowerCase());
        if(index>=0){const removed=character.inventory.splice(index,1)[0];context.addLog?.(`🎒 ITEM REMOVED: ${typeof removed==='string'?removed:removed?.name||name}`,'system');changes.push(`item_removed:${name}`);}
      }
      for(const name of effects.items?.add||[]){
        if(character.inventory.some(item=>itemName(item)===String(name).trim().toLowerCase()))continue;
        character.inventory.push(name);context.addLog?.(`🎒 ITEM GAINED: ${name}`,'holy');changes.push(`item_added:${name}`);
      }
    }

    for(const eventKey of effects.questEvents||[]){
      const outcome=context.recordQuestEvent?.(eventKey,{source:'claude_effect'});
      if(outcome?.updates?.length||outcome?.completions?.length)changes.push(`quest:${eventKey}`);
    }

    if(changes.length){context.render?.();context.autoSave?.();context.broadcast?.();}
    return {applied:changes.length>0,reason:changes.length?'applied':'empty',changes};
  }

  return Object.freeze({apply});
});
