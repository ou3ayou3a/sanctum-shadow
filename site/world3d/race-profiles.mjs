export const RACE_PROFILES=Object.freeze({
  human:Object.freeze({id:'human',name:'Human',presentation:'fixed_male',proportions:[1,1,1],materialTint:0xffffff,skinColor:0xe1b594,accent:0xd8bc72,features:[]}),
  dwarf:Object.freeze({id:'dwarf',name:'Dwarf',presentation:'fixed_male',proportions:[1.18,.78,1.12],materialTint:0xe5d7c5,skinColor:0xd4a17d,accent:0xc68a4c,features:['beard']}),
  elf:Object.freeze({id:'elf',name:'Elf',presentation:'fixed_male',proportions:[.9,1.06,.9],materialTint:0xdceee2,skinColor:0xe6c3aa,accent:0x69c99b,features:['pointed_ears']}),
  high_elf:Object.freeze({id:'high_elf',name:'High Elf',presentation:'fixed_male',proportions:[.87,1.1,.88],materialTint:0xf1e6c9,skinColor:0xf0d6bf,accent:0xe8cf7a,features:['pointed_ears','circlet']}),
  dark_elf:Object.freeze({id:'dark_elf',name:'Dark Elf',presentation:'fixed_male',proportions:[.9,1.05,.9],materialTint:0xb2a4c7,skinColor:0x75657f,accent:0xa77bd8,features:['pointed_ears','silver_circlet']}),
  orc:Object.freeze({id:'orc',name:'Orc',presentation:'fixed_male',proportions:[1.25,1.14,1.18],materialTint:0x9eaa89,skinColor:0x718f55,accent:0xa3c665,features:['tusks','heavy_shoulders']}),
  goblin:Object.freeze({id:'goblin',name:'Goblin',presentation:'fixed_male',proportions:[.72,.64,.74],materialTint:0xa4ad88,skinColor:0x82945d,accent:0xb6c66f,features:['large_ears','brow']}),
});

export const RACE_IDS=Object.freeze(Object.keys(RACE_PROFILES));

export function normalizeRaceId(value){
  const id=String(value||'human').toLowerCase().replaceAll('-','_');
  if(id==='highelf')return'high_elf';if(id==='darkelf')return'dark_elf';
  return RACE_PROFILES[id]?id:'human';
}

export function getRaceProfile(value){return RACE_PROFILES[normalizeRaceId(value)];}
