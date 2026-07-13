export const CLASS_PROFILES=Object.freeze({
  warrior:Object.freeze({id:'warrior',name:'Warrior',role:'Tank · Melee',accent:0xc15b49,metal:0x8d9392,weapon:'greatsword',action:'Heavy Strike',pose:'slash'}),
  paladin:Object.freeze({id:'paladin',name:'Paladin',role:'Tank · Holy Support',accent:0xe3c75d,metal:0xd5d0b5,weapon:'mace_shield',action:'Holy Smite',pose:'smite'}),
  cleric:Object.freeze({id:'cleric',name:'Cleric',role:'Healing · Divine Magic',accent:0x8fd5b0,metal:0xb8c1b5,weapon:'holy_staff',action:'Sacred Light',pose:'channel'}),
  mage:Object.freeze({id:'mage',name:'Mage',role:'Arcane Damage · Control',accent:0x728fe8,metal:0x756b9d,weapon:'arcane_staff',action:'Arcane Bolt',pose:'cast'}),
  rogue:Object.freeze({id:'rogue',name:'Rogue',role:'Stealth · Melee Damage',accent:0x9e74c9,metal:0x555866,weapon:'twin_daggers',action:'Twin Strike',pose:'dual_slash'}),
  ranger:Object.freeze({id:'ranger',name:'Ranger',role:'Ranged Damage · Scout',accent:0x69b783,metal:0x72553a,weapon:'bow_quiver',action:'Piercing Shot',pose:'draw'}),
});

export const CLASS_IDS=Object.freeze(Object.keys(CLASS_PROFILES));
export function normalizeClassId(value){const id=String(value||'warrior').toLowerCase().replaceAll('-','_');return CLASS_PROFILES[id]?id:'warrior';}
export function getClassProfile(value){return CLASS_PROFILES[normalizeClassId(value)];}
