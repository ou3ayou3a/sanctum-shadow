'use strict';

const UPDATE_TYPES=new Set(['player_action','response','check','effects','outcome','scene_break','close']);
const OPTION_TYPES=new Set(['talk','explore','action','move','end']);
const ABILITIES=new Set(['str','dex','con','int','wis','cha']);

function cleanText(value,max=1000){
  if(typeof value!=='string')return '';
  return value.replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function cleanId(value,max=80){return cleanText(value,max).toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,max);}
function boundedInt(value,min,max,fallback=0){const number=Number(value);return Number.isInteger(number)?Math.max(min,Math.min(max,number)):fallback;}
function characterSummary(character){
  if(!character||typeof character!=='object')return null;
  return {name:cleanText(character.name,40),class:cleanId(character.class,40),race:cleanId(character.race,40),portrait:cleanText(character.portrait,500)};
}
function normalizeNpc(payload={}){
  const id=cleanId(payload.npcId,80),name=cleanText(payload.npcName,100);
  if(!id||!name)return null;
  return {id,name,title:cleanText(payload.npcTitle,120),portrait:cleanText(payload.npcPortrait,20)||'🧑',faction:cleanId(payload.npcFaction,40),disposition:cleanId(payload.disposition,30)||'neutral'};
}
function normalizeCheck(check){
  if(!check||typeof check!=='object')return null;
  const ability=cleanId(check.ability,3),skill=cleanId(check.skill,40),dc=boundedInt(check.dc,5,30,10);
  if(!ABILITIES.has(ability))return null;
  const rolls=Array.isArray(check.rolls)?check.rolls.slice(0,2).map(value=>boundedInt(value,1,20,1)):[];
  return {
    ability,skill:skill||null,dc,roll:boundedInt(check.roll,1,20,1),rolls,
    abilityMod:boundedInt(check.abilityMod,-20,20,0),proficiency:boundedInt(check.proficiency,0,12,0),
    total:boundedInt(check.total,-20,60,0),success:check.success===true,crit:check.crit===true,fumble:check.fumble===true,
    proficient:check.proficient===true,mode:['normal','advantage','disadvantage'].includes(check.mode)?check.mode:'normal',
    label:cleanText(check.label,80),npcId:cleanId(check.npcId,80),
  };
}
function normalizeOption(option){
  if(!option||typeof option!=='object')return null;
  const text=cleanText(option.text||option.label,180),type=cleanId(option.type,20)||'talk';
  if(!text||!OPTION_TYPES.has(type))return null;
  let roll=null;
  if(option.roll&&typeof option.roll==='object'){
    const stat=cleanId(option.roll.stat,3).toUpperCase(),skill=cleanId(option.roll.skill,40),dc=boundedInt(option.roll.dc,5,30,10);
    if(ABILITIES.has(stat.toLowerCase()))roll={stat,skill:skill||null,dc};
  }
  return {text,type,roll};
}
function normalizeOptions(options){return Array.isArray(options)?options.slice(0,5).map(normalizeOption).filter(Boolean):[];}

function begin(session,controllerId,payload={},now=Date.now()){
  if(!session||!session.players?.[controllerId])return {ok:false,error:'Player is not part of this session.'};
  if(session.state!=='playing')return {ok:false,error:'Conversations are only available during exploration.'};
  if(session.combatState?.active)return {ok:false,error:'Finish combat before starting a conversation.'};
  if(session.conversation?.active)return {ok:false,error:`${session.conversation.controllerName||'Another player'} is already speaking with an NPC.`};
  const npc=normalizeNpc(payload);if(!npc)return {ok:false,error:'That NPC could not be identified.'};
  const player=session.players[controllerId],id=`conv-${cleanId(controllerId,24)}-${Math.max(0,Number(now)||Date.now()).toString(36)}`;
  const state={
    id,active:true,npc,controllerId,controllerName:cleanText(player.character?.name||player.name,40)||'Unknown',
    controllerCharacter:characterSummary(player.character),opener:cleanText(payload.opener,600),phase:'thinking',revision:1,
    line:'',options:[],lastAction:null,lastCheck:null,startedAt:Math.max(0,Number(now)||Date.now()),updatedAt:Math.max(0,Number(now)||Date.now()),
  };
  session.conversation=state;
  return {ok:true,state};
}

function update(session,controllerId,type,payload={},now=Date.now()){
  const state=session?.conversation;
  if(!state?.active)return {ok:false,error:'There is no active conversation.'};
  if(state.controllerId!==controllerId)return {ok:false,error:`Only ${state.controllerName} can control this conversation.`};
  if(cleanText(payload.conversationId,120)!==state.id)return {ok:false,error:'That conversation is no longer active.'};
  if(!UPDATE_TYPES.has(type))return {ok:false,error:'Unknown conversation update.'};
  const at=Math.max(0,Number(now)||Date.now());
  let relay={conversationId:state.id};
  if(type==='player_action'){
    const text=cleanText(payload.text,600);if(!text)return {ok:false,error:'Conversation action is empty.'};
    state.phase='thinking';state.lastAction={text,playerName:state.controllerName,character:state.controllerCharacter};
    relay={...relay,...state.lastAction};
  }else if(type==='response'){
    const text=cleanText(payload.text,2200);if(!text)return {ok:false,error:'NPC response is empty.'};
    state.phase='ready';state.line=text;state.options=normalizeOptions(payload.options);state.startedAt=at;
    relay={...relay,npcName:state.npc.name,text,options:state.options,startedAt:at,typewriterSpeed:14};
  }else if(type==='check'){
    const check=normalizeCheck(payload);if(!check)return {ok:false,error:'Dialogue check is invalid.'};
    state.lastCheck=check;relay={...relay,...check,npcId:check.npcId||state.npc.id,actorId:state.controllerId};
  }else if(type==='effects'){
    relay={...relay,effects:payload.effects,reason:cleanText(payload.reason,180),actorId:state.controllerId,npcId:state.npc.id};
  }else if(type==='outcome'){
    relay={...relay,npcId:state.npc.id,npcName:state.npc.name,fact:cleanText(payload.fact,1200),actorId:state.controllerId};
  }else if(type==='scene_break'){
    const sceneName=cleanId(payload.sceneName,80);if(!sceneName)return {ok:false,error:'Conversation scene transition is invalid.'};
    relay={...relay,sceneName,actorId:state.controllerId};
  }else if(type==='close'){
    relay={...relay,graceful:payload.graceful!==false,controllerName:state.controllerName};
    session.conversation=null;
    return {ok:true,type,relay,state:null};
  }
  state.revision+=1;state.updatedAt=at;
  relay.revision=state.revision;
  return {ok:true,type,relay,state};
}

function publicState(state){
  if(!state?.active)return null;
  return JSON.parse(JSON.stringify(state));
}

module.exports={UPDATE_TYPES,begin,update,publicState,normalizeNpc,normalizeCheck,normalizeOptions,characterSummary};
