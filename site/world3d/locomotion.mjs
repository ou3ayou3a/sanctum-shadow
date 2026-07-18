export const WALK_SPEED=3.35;
export const RUN_SPEED=6.15;
export const MAX_NETWORK_SPEED=7;
export const PRESENCE_STATES=Object.freeze(['idle','walk_start','walk','run','walk_stop','turn_left','turn_right']);

export function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
export function angleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
export function advanceSpeed(current,target,dt,{acceleration=8.5,deceleration=11.5}={}){
  const safeCurrent=Number.isFinite(current)?Math.max(0,current):0,safeTarget=Number.isFinite(target)?Math.max(0,target):0,safeDt=clamp(Number(dt)||0,0,.1);
  const step=(safeTarget>safeCurrent?acceleration:deceleration)*safeDt;
  return Math.abs(safeTarget-safeCurrent)<=step?safeTarget:safeCurrent+Math.sign(safeTarget-safeCurrent)*step;
}
export function locomotionBlend(speed){
  const value=clamp(Number(speed)||0,0,RUN_SPEED),moving=clamp(value/.25,0,1),run=clamp((value-WALK_SPEED*.82)/(RUN_SPEED-WALK_SPEED*.82),0,1);
  return{moving,walk:moving*(1-run),run:moving*run,state:value<.08?'idle':run>.52?'run':'walk'};
}
export function turnState(delta,threshold=.16){if(delta>threshold)return'turn_left';if(delta<-threshold)return'turn_right';return'idle';}
export function normalizePresenceState(value){return PRESENCE_STATES.includes(value)?value:'idle';}
export function normalizeNetworkSpeed(value){return clamp(Number(value)||0,0,MAX_NETWORK_SPEED);}
