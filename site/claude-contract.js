(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ClaudeContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION=1;
  const CONTRACTS=Object.freeze({
    SCENE:'scene.v1',
    NPC_DIALOGUE:'npc_dialogue.v1',
    INTENT:'intent.v1',
  });
  const ABILITIES=new Set(['str','dex','con','int','wis','cha']);
  const OPTION_TYPES=new Set(['talk','explore','action','move','combat','end']);
  const ENEMY_TYPES=new Set(['city_guard','bandit','cultist','church_agent','shadow_wraith','skeleton','wolf','captain']);
  const INTENTS=new Set(['talk','combat','action']);
  const FACTIONS=new Set(['city_watch','church','covenant','underworld','citizens','party']);
  const BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);

  function result(value,errors){return {ok:errors.length===0,value:errors.length?null:value,errors};}
  function isRecord(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function cleanText(value,max=1000){
    if(typeof value!=='string')return '';
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
  }
  function cleanMultiline(value,max=2400){
    if(typeof value!=='string')return '';
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g,' ').trim().slice(0,max);
  }
  function rejectUnknown(input,allowed,path,errors){
    for(const key of Object.keys(input))if(!allowed.has(key))errors.push(`${path}.${key} is not allowed`);
  }
  function parseRaw(raw){
    const errors=[];
    if(typeof raw!=='string'||!raw.trim())return result(null,['response must be a non-empty JSON string']);
    let source=raw.trim();
    const fenced=source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if(fenced)source=fenced[1].trim();
    let value;
    try{value=JSON.parse(source);}catch{return result(null,['response is not valid JSON']);}
    if(!isRecord(value))errors.push('response root must be an object');
    return result(value,errors);
  }
  function validateEnvelope(input,kind,errors){
    if(input.schemaVersion!==VERSION)errors.push(`schemaVersion must equal ${VERSION}`);
    if(input.kind!==kind)errors.push(`kind must equal ${kind}`);
  }
  function validateCheck(input,path,errors){
    if(input==null)return null;
    if(!isRecord(input)){errors.push(`${path} must be null or an object`);return null;}
    rejectUnknown(input,new Set(['ability','skill','dc']),path,errors);
    const ability=cleanText(input.ability,3).toLowerCase();
    const skill=cleanText(input.skill,40).toLowerCase().replace(/\s+/g,'_');
    const dc=Number(input.dc);
    if(!ABILITIES.has(ability))errors.push(`${path}.ability is invalid`);
    if(skill&&!/^[a-z][a-z0-9_]{1,39}$/.test(skill))errors.push(`${path}.skill is invalid`);
    if(!Number.isInteger(dc)||dc<5||dc>30)errors.push(`${path}.dc must be an integer from 5 to 30`);
    return {ability,skill:skill||null,dc:Number.isInteger(dc)?dc:10};
  }
  function validateEnemyGroups(input,path,errors){
    if(!Array.isArray(input)){errors.push(`${path} must be an array`);return [];}
    const groups=[];
    input.slice(0,6).forEach((group,index)=>{
      if(!isRecord(group)){errors.push(`${path}[${index}] must be an object`);return;}
      rejectUnknown(group,new Set(['type','count','level']),`${path}[${index}]`,errors);
      const type=cleanText(group.type,30).toLowerCase();
      const count=Number(group.count),level=Number(group.level);
      if(!ENEMY_TYPES.has(type))errors.push(`${path}[${index}].type is invalid`);
      if(!Number.isInteger(count)||count<1||count>6)errors.push(`${path}[${index}].count must be 1-6`);
      if(!Number.isInteger(level)||level<1||level>10)errors.push(`${path}[${index}].level must be 1-10`);
      groups.push({type,count:Number.isInteger(count)?count:1,level:Number.isInteger(level)?level:1});
    });
    if(input.length>6)errors.push(`${path} may contain at most 6 groups`);
    return groups;
  }
  function validateEffects(input,path,errors){
    if(input==null)return {affection:0,intimate:false,married:false};
    if(!isRecord(input)){errors.push(`${path} must be an object`);return {affection:0,intimate:false,married:false};}
    rejectUnknown(input,new Set(['affection','intimate','married']),path,errors);
    const affection=Number(input.affection??0);
    if(!Number.isInteger(affection)||affection<-20||affection>20)errors.push(`${path}.affection must be an integer from -20 to 20`);
    if(typeof (input.intimate??false)!=='boolean')errors.push(`${path}.intimate must be boolean`);
    if(typeof (input.married??false)!=='boolean')errors.push(`${path}.married must be boolean`);
    return {affection:Number.isInteger(affection)?affection:0,intimate:input.intimate===true,married:input.married===true};
  }
  function validateStateValues(input,path,errors,maxEntries=16,requiredPrefix=''){
    if(input==null)return Object.create(null);
    if(!isRecord(input)){errors.push(`${path} must be an object`);return Object.create(null);}
    const output=Object.create(null),entries=Object.entries(input);
    if(entries.length>maxEntries)errors.push(`${path} may contain at most ${maxEntries} entries`);
    for(const [rawKey,rawValue] of entries.slice(0,maxEntries)){
      const key=cleanText(rawKey,64);
      if(BLOCKED_KEYS.has(key)||!/^[a-z][a-z0-9_]{1,63}$/i.test(key)||requiredPrefix&&!key.startsWith(requiredPrefix)){errors.push(`${path} key ${rawKey} is invalid${requiredPrefix?`; expected ${requiredPrefix}*`:''}`);continue;}
      if(typeof rawValue==='string')output[key]=cleanText(rawValue,400);
      else if(typeof rawValue==='boolean'||typeof rawValue==='number'&&Number.isFinite(rawValue))output[key]=rawValue;
      else errors.push(`${path}.${key} must be a string, number, or boolean`);
    }
    return output;
  }
  function validateGameEffects(input,path,errors){
    const empty=()=>({flags:Object.create(null),facts:Object.create(null),reputation:[],resources:{hp:0,holy:0,hell:0,xp:0},items:{add:[],remove:[]},questEvents:[]});
    if(input==null)return empty();
    if(!isRecord(input)){errors.push(`${path} must be an object`);return empty();}
    rejectUnknown(input,new Set(['flags','facts','reputation','resources','items','questEvents']),path,errors);
    const output=empty();
    output.flags=validateStateValues(input.flags,`${path}.flags`,errors,16,'ai_');
    output.facts=validateStateValues(input.facts,`${path}.facts`,errors,16,'ai_');
    if(input.reputation!=null){
      if(!Array.isArray(input.reputation))errors.push(`${path}.reputation must be an array`);
      else{
        if(input.reputation.length>6)errors.push(`${path}.reputation may contain at most 6 entries`);
        output.reputation=input.reputation.slice(0,6).map((entry,index)=>{
          if(!isRecord(entry)){errors.push(`${path}.reputation[${index}] must be an object`);return null;}
          rejectUnknown(entry,new Set(['faction','delta']),`${path}.reputation[${index}]`,errors);
          const faction=cleanText(entry.faction,30).toLowerCase(),delta=Number(entry.delta);
          if(!FACTIONS.has(faction))errors.push(`${path}.reputation[${index}].faction is invalid`);
          if(!Number.isInteger(delta)||delta<-10||delta>10)errors.push(`${path}.reputation[${index}].delta must be an integer from -10 to 10`);
          return {faction,delta:Number.isInteger(delta)?delta:0};
        }).filter(Boolean);
      }
    }
    if(input.resources!=null){
      if(!isRecord(input.resources))errors.push(`${path}.resources must be an object`);
      else{
        rejectUnknown(input.resources,new Set(['hp','holy','hell','xp']),`${path}.resources`,errors);
        const ranges={hp:[-30,30],holy:[-10,10],hell:[-10,10],xp:[0,250]};
        for(const [key,[min,max]] of Object.entries(ranges)){
          const value=Number(input.resources[key]??0);
          if(!Number.isInteger(value)||value<min||value>max)errors.push(`${path}.resources.${key} must be an integer from ${min} to ${max}`);
          output.resources[key]=Number.isInteger(value)?value:0;
        }
      }
    }
    if(input.items!=null){
      if(!isRecord(input.items))errors.push(`${path}.items must be an object`);
      else{
        rejectUnknown(input.items,new Set(['add','remove']),`${path}.items`,errors);
        for(const mode of ['add','remove']){
          const list=input.items[mode]??[];
          if(!Array.isArray(list))errors.push(`${path}.items.${mode} must be an array`);
          else{
            if(list.length>3)errors.push(`${path}.items.${mode} may contain at most 3 entries`);
            output.items[mode]=list.slice(0,3).map((item,index)=>{
              const value=cleanText(item,100);
              if(!value)errors.push(`${path}.items.${mode}[${index}] is invalid`);
              return value;
            }).filter(Boolean);
          }
        }
      }
    }
    if(input.questEvents!=null){
      if(!Array.isArray(input.questEvents))errors.push(`${path}.questEvents must be an array`);
      else{
        if(input.questEvents.length>4)errors.push(`${path}.questEvents may contain at most 4 entries`);
        output.questEvents=input.questEvents.slice(0,4).map((event,index)=>{
          const value=cleanText(event,100).toLowerCase();
          if(!/^(scene|outcome|combat:victory):[a-z0-9_-]{2,80}$/.test(value))errors.push(`${path}.questEvents[${index}] is invalid`);
          return value;
        }).filter(Boolean);
      }
    }
    return output;
  }
  function validateNpc(input){
    const errors=[];
    if(!isRecord(input))return result(null,['response root must be an object']);
    rejectUnknown(input,new Set(['schemaVersion','kind','speech','options','sceneBreak','effects']),'response',errors);
    validateEnvelope(input,'npc_dialogue',errors);
    const speech=cleanMultiline(input.speech,2200);
    if(!speech)errors.push('speech is required');
    const sourceOptions=Array.isArray(input.options)?input.options:[];
    if(sourceOptions.length<1||sourceOptions.length>5)errors.push('options must contain 1-5 entries');
    const options=sourceOptions.slice(0,5).map((option,index)=>{
      if(!isRecord(option)){errors.push(`options[${index}] must be an object`);return null;}
      rejectUnknown(option,new Set(['label','type','check','effects','failureEffects']),`options[${index}]`,errors);
      const label=cleanText(option.label,180);
      const type=cleanText(option.type,20).toLowerCase();
      if(!label)errors.push(`options[${index}].label is required`);
      if(!OPTION_TYPES.has(type)||type==='combat')errors.push(`options[${index}].type is invalid for dialogue`);
      const check=validateCheck(option.check,`options[${index}].check`,errors);
      if(!check&&option.failureEffects!=null)errors.push(`options[${index}].failureEffects requires a check`);
      return {label,type,check,effects:validateGameEffects(option.effects,`options[${index}].effects`,errors),failureEffects:validateGameEffects(option.failureEffects,`options[${index}].failureEffects`,errors)};
    }).filter(Boolean);
    const sceneBreak=input.sceneBreak==null?null:cleanText(input.sceneBreak,80).toLowerCase().replace(/[^a-z0-9_-]/g,'');
    if(input.sceneBreak!=null&&!sceneBreak)errors.push('sceneBreak is invalid');
    return result({schemaVersion:VERSION,kind:'npc_dialogue',speech,options,sceneBreak,effects:validateEffects(input.effects,'effects',errors)},errors);
  }
  function validateFacts(input,errors){
    if(input==null)return {};
    if(!isRecord(input)){errors.push('facts must be an object');return {};}
    const facts=Object.create(null),entries=Object.entries(input);
    if(entries.length>24)errors.push('facts may contain at most 24 entries');
    for(const [rawKey,rawValue] of entries.slice(0,24)){
      const key=cleanText(rawKey,64);
      if(BLOCKED_KEYS.has(key)||!/^[a-z][a-z0-9_]{1,63}$/i.test(key)){errors.push(`facts key ${rawKey} is invalid`);continue;}
      if(typeof rawValue==='string')facts[key]=cleanText(rawValue,400);
      else if(typeof rawValue==='boolean'||typeof rawValue==='number'&&Number.isFinite(rawValue))facts[key]=rawValue;
      else errors.push(`facts.${key} must be a string, number, or boolean`);
    }
    return facts;
  }
  function validateScene(input){
    const errors=[];
    if(!isRecord(input))return result(null,['response root must be an object']);
    rejectUnknown(input,new Set(['schemaVersion','kind','narration','sub','location','locationIcon','facts','threat','options']),'response',errors);
    validateEnvelope(input,'scene',errors);
    const narration=cleanMultiline(input.narration,2600),sub=cleanText(input.sub,500),location=cleanText(input.location,160),locationIcon=cleanText(input.locationIcon,12)||'🏰';
    if(!narration)errors.push('narration is required');
    if(!sub)errors.push('sub is required');
    if(!location)errors.push('location is required');
    let threat=null;
    if(input.threat!=null){
      if(!isRecord(input.threat))errors.push('threat must be null or an object');
      else{
        rejectUnknown(input.threat,new Set(['hostiles','imminent']),'threat',errors);
        const hostiles=validateEnemyGroups(input.threat.hostiles,'threat.hostiles',errors);
        if(hostiles.length===0)errors.push('threat.hostiles must not be empty');
        if(typeof input.threat.imminent!=='boolean')errors.push('threat.imminent must be boolean');
        threat={hostiles,imminent:input.threat.imminent===true};
      }
    }
    const sourceOptions=Array.isArray(input.options)?input.options:[];
    if(sourceOptions.length<1||sourceOptions.length>5)errors.push('options must contain 1-5 entries');
    const options=sourceOptions.slice(0,5).map((option,index)=>{
      if(!isRecord(option)){errors.push(`options[${index}] must be an object`);return null;}
      rejectUnknown(option,new Set(['icon','label','type','check','failCombat','enemies','effects','failureEffects']),`options[${index}]`,errors);
      const label=cleanText(option.label,180),icon=cleanText(option.icon,12)||'◆',type=cleanText(option.type,20).toLowerCase();
      if(!label)errors.push(`options[${index}].label is required`);
      if(!OPTION_TYPES.has(type))errors.push(`options[${index}].type is invalid`);
      const enemies=option.enemies==null?null:validateEnemyGroups(option.enemies,`options[${index}].enemies`,errors);
      if(type==='combat'&&(!enemies||enemies.length===0))errors.push(`options[${index}] combat requires enemies`);
      if(type!=='combat'&&enemies)errors.push(`options[${index}] enemies require combat type`);
      if(option.failCombat!=null&&typeof option.failCombat!=='boolean')errors.push(`options[${index}].failCombat must be boolean`);
      if(option.failCombat===true&&!threat)errors.push(`options[${index}].failCombat requires a threat`);
      const check=validateCheck(option.check,`options[${index}].check`,errors);
      if(!check&&option.failureEffects!=null)errors.push(`options[${index}].failureEffects requires a check`);
      return {icon,label,type,check,failCombat:option.failCombat===true,enemies,effects:validateGameEffects(option.effects,`options[${index}].effects`,errors),failureEffects:validateGameEffects(option.failureEffects,`options[${index}].failureEffects`,errors)};
    }).filter(Boolean);
    const hasCombat=options.some(option=>option.type==='combat');
    if(threat&&!hasCombat)errors.push('a hostile scene must include a combat option');
    if(!threat&&hasCombat)errors.push('a peaceful scene cannot include a combat option');
    return result({schemaVersion:VERSION,kind:'scene',narration,sub,location,locationIcon,facts:validateFacts(input.facts,errors),threat,options},errors);
  }
  function validateIntent(input,context={}){
    const errors=[];
    if(!isRecord(input))return result(null,['response root must be an object']);
    rejectUnknown(input,new Set(['schemaVersion','kind','intent','npcId','target']),'response',errors);
    validateEnvelope(input,'intent',errors);
    const intent=cleanText(input.intent,20).toLowerCase();
    if(!INTENTS.has(intent))errors.push('intent is invalid');
    const npcId=input.npcId==null?null:cleanText(input.npcId,80).toLowerCase();
    const target=input.target==null?null:cleanText(input.target,160);
    if(intent==='talk'&&!npcId)errors.push('talk intent requires npcId');
    if(intent==='combat'&&!target)errors.push('combat intent requires target');
    if(Array.isArray(context.allowedNpcIds)&&npcId&&!context.allowedNpcIds.includes(npcId))errors.push('npcId is not in the allowed NPC list');
    return result({schemaVersion:VERSION,kind:'intent',intent,npcId,target},errors);
  }
  function validate(contract,input,context={}){
    if(contract===CONTRACTS.SCENE)return validateScene(input);
    if(contract===CONTRACTS.NPC_DIALOGUE)return validateNpc(input);
    if(contract===CONTRACTS.INTENT)return validateIntent(input,context);
    return result(null,['unknown response contract']);
  }
  function parseAndValidate(contract,raw,context={}){
    const parsed=parseRaw(raw);
    return parsed.ok?validate(contract,parsed.value,context):parsed;
  }
  function isKnownContract(value){return Object.values(CONTRACTS).includes(value);}

  return Object.freeze({VERSION,CONTRACTS,parseRaw,validate,parseAndValidate,isKnownContract});
});
