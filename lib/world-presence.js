'use strict';

const WORLD_LIMIT=100;
const STATES=new Set(['idle','walk_start','walk','run','walk_stop','turn_left','turn_right']);
const GESTURES=new Set(['interact','talk','work','drink','weapon_draw','weapon_sheathe','attack_heavy','attack_slash','attack_dual','attack_smite','staff_strike','cast','bow_shot']);

function finite(value){const number=Number(value);return Number.isFinite(number)?number:null;}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function normalizeRotation(value){const number=finite(value);if(number===null)return 0;return Math.atan2(Math.sin(number),Math.cos(number));}

function normalizeWorldPosition(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return null;
  const x=finite(payload.x),z=finite(payload.z);if(x===null||z===null)return null;
  const locationId=typeof payload.locationId==='string'?payload.locationId.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60):'';
  if(!locationId)return null;
  const state=STATES.has(payload.state)?payload.state:'idle';
  const gesture=GESTURES.has(payload.gesture)?payload.gesture:null,gestureSeq=clamp(Math.floor(finite(payload.gestureSeq)??0),0,2147483647);
  return{x:clamp(x,-WORLD_LIMIT,WORLD_LIMIT),z:clamp(z,-WORLD_LIMIT,WORLD_LIMIT),rotation:normalizeRotation(payload.rotation),state,speed:clamp(finite(payload.speed)??0,0,6),locationId,gesture,gestureSeq};
}

module.exports={WORLD_LIMIT,GESTURES,normalizeWorldPosition};
