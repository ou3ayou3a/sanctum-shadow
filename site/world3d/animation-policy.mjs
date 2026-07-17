export const LOOPING_ANIMATIONS=Object.freeze(['idle','walk','run','combat_idle']);
export const ONE_SHOT_ANIMATIONS=Object.freeze(['walk_start','walk_stop','turn_left','turn_right','interact','talk','work','drink','weapon_draw','weapon_sheathe','attack_heavy','attack_slash','attack_dual','attack_smite','staff_strike','cast','bow_shot','block','dodge','hit','death']);
export const NETWORK_GESTURES=Object.freeze(['interact','talk','work','drink','weapon_draw','weapon_sheathe','attack_heavy','attack_slash','attack_dual','attack_smite','staff_strike','cast','bow_shot']);

const NETWORK_SET=new Set(NETWORK_GESTURES);
const EQUIPMENT_SWAP=Object.freeze({weapon_draw:.46,weapon_sheathe:.62});
const AMBIENT_BY_ROLE=Object.freeze({
  tavern:['talk','drink','interact'],worker:['work','interact'],guard:['turn_left','turn_right','interact'],merchant:['talk','interact'],cleric:['talk','interact'],civilian:['interact','talk'],
});

export function normalizeGesture(value){return NETWORK_SET.has(value)?value:null;}
export function equipmentSwapFraction(animation){return EQUIPMENT_SWAP[animation]??.5;}
export function isCombatGesture(value){return /^(attack_|staff_strike|cast|bow_shot)/.test(String(value||''));}
export function blendDuration(from,to){if(!from)return 0;if(to==='death')return .04;if(/^(hit|block|dodge)$/.test(to))return .06;if(from==='run'&&to==='walk_stop')return .1;if(LOOPING_ANIMATIONS.includes(from)&&LOOPING_ANIMATIONS.includes(to))return .16;return .1;}
export function ambientRole(config={}){
  const text=`${config.id||''} ${config.title||''} ${config.action||''}`.toLowerCase();
  if(/tavern|inn|cup|server|patron|ale|baker/.test(text))return'tavern';
  if(/smith|worker|porter|stable|washer|carrier|apprentice|craft/.test(text))return'worker';
  if(/guard|watch|patrol|soldier|veteran/.test(text))return'guard';
  if(/merchant|shop|factor|clerk|keeper/.test(text))return'merchant';
  if(/temple|cleric|priest|acolyte|sister|brother|monk/.test(text))return'cleric';
  return'civilian';
}
export function ambientGesture(config={},cycle=0){const choices=AMBIENT_BY_ROLE[ambientRole(config)]||AMBIENT_BY_ROLE.civilian;return choices[Math.abs(Number(cycle)||0)%choices.length];}
export function ambientDelay(config={},cycle=0){const seed=String(config.id||config.title||'npc').split('').reduce((sum,char)=>sum+char.charCodeAt(0),0);return 6+((seed+Math.max(0,Number(cycle)||0)*7)%9);}
