const BUILDS=Object.freeze([
  Object.freeze({id:'lean',scale:[.94,1.025,.94]}),
  Object.freeze({id:'balanced',scale:[1,1,1]}),
  Object.freeze({id:'broad',scale:[1.065,.985,1.055]}),
  Object.freeze({id:'stout',scale:[1.09,.955,1.075]}),
]);

const HAIR_STYLES=Object.freeze(['cropped','swept','shoulder','shaved','topknot','tonsure']);
const BEARD_STYLES=Object.freeze(['none','stubble','short','full','braided']);
const HAIR_COLORS=Object.freeze([0x24170f,0x4a2b18,0x70472a,0x9a7a54,0x3a342f,0xb3a07d]);
const HUMAN_SKIN=Object.freeze([0xe6bea2,0xdcae8e,0xcf9877,0xefcdb2]);
const ROLE_PALETTES=Object.freeze({
  guard:[[0x263946,0xa78745,0x72787b],[0x403b36,0x9a7839,0x77716a],[0x343c31,0x947c4d,0x666f68]],
  cleric:[[0xddd4bd,0xa68a47,0x51473c],[0xbfc3b5,0x7d6840,0x3e4841],[0xd3c7ac,0x8d7347,0x5a4a40]],
  scholar:[[0x34435c,0xa68a5c,0x5b493b],[0x493758,0xb09969,0x403a43],[0x314b49,0x9b8058,0x514236]],
  merchant:[[0x6f3e34,0xc09a58,0x4a382d],[0x355a54,0xb88b4e,0x584132],[0x5a4669,0xc1a46b,0x3d3431]],
  worker:[[0x62513d,0x8c6d43,0x392e26],[0x4d5142,0x80663f,0x342d28],[0x5d4435,0x98744b,0x40342b]],
  ranger:[[0x344b35,0x795d36,0x302a22],[0x43523b,0x8b7044,0x383027],[0x2f4840,0x705638,0x342c25]],
  rogue:[[0x292d32,0x655047,0x17191c],[0x32313b,0x6c5541,0x202126],[0x263534,0x5d493d,0x1a2020]],
  noble:[[0x56344d,0xc2a15b,0x302938],[0x33496b,0xc7aa6a,0x2c3140],[0x65422e,0xb99a5d,0x3d3028]],
  hostile:[[0x49302c,0x7b4b35,0x242326],[0x343833,0x72513b,0x202522],[0x3d3038,0x684442,0x211d22]],
  civilian:[[0x4d5861,0x8f7650,0x39322c],[0x55604a,0x907147,0x38322b],[0x654b3f,0x9e8058,0x40332c]],
  adventurer:[[0x394858,0xa17d45,0x55504b],[0x3d503d,0x967442,0x4a4138],[0x553a3a,0x9d7d49,0x4b4641]],
});

const CLASS_PALETTES=Object.freeze({
  warrior:Object.freeze([0x542f2d,0x9a7746,0x292b2e]),paladin:Object.freeze([0xd8cfad,0xc2a454,0x4b4a43]),cleric:Object.freeze([0xc7c6b5,0x8daa8c,0x4d514a]),
  mage:Object.freeze([0x344f83,0x8e78bd,0x292c4b]),rogue:Object.freeze([0x332b38,0x76506a,0x1c1d22]),ranger:Object.freeze([0x36533e,0x8b7045,0x302b24]),
});

const NAMED_OVERRIDES=Object.freeze({
  captain_rhael:Object.freeze({build:'broad',hair:'cropped',beard:'short',age:'veteran',role:'guard',palette:0}),
  sister_mourne:Object.freeze({build:'lean',hair:'tonsure',beard:'none',age:'veteran',role:'cleric',palette:1}),
  old_brennan:Object.freeze({build:'stout',hair:'shoulder',beard:'full',age:'elder',role:'merchant',palette:2}),
  lyra_innkeeper:Object.freeze({build:'balanced',hair:'swept',beard:'none',age:'adult',role:'merchant',palette:1}),
  screaming_preacher:Object.freeze({build:'lean',hair:'shaved',beard:'stubble',age:'veteran',role:'cleric',palette:2}),
});

export function appearanceHash(value){
  let hash=2166136261;for(const character of String(value||'anonymous')){hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;
}

const choose=(items,seed,offset=0)=>items[(seed+Math.imul(offset+1,2654435761))%items.length];
const normalized=text=>String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

export function inferAppearanceRole({id,title,action,classId,isPlayer=false,isHostile=false}={}){
  if(isPlayer)return'adventurer';if(isHostile)return'hostile';
  const text=`${id||''} ${title||''} ${action||''} ${classId||''}`.toLowerCase();
  if(/captain|guard|watch|soldier|patrol|veteran|paladin|templar/.test(text))return'guard';
  if(/priest|cleric|sister|brother|acolyte|deacon|pilgrim|temple|preacher/.test(text))return'cleric';
  if(/scribe|mage|wizard|archive|copyist|cartographer|clerk|scholar/.test(text))return'scholar';
  if(/merchant|keeper|barkeep|innkeeper|factor|shop|trader/.test(text))return'merchant';
  if(/noble|royal|legate|lord|commander/.test(text))return'noble';
  if(/smith|mason|porter|baker|stable|washer|carrier|worker/.test(text))return'worker';
  if(/ranger|scout|hunter|herbalist|courier|runner/.test(text))return'ranger';
  if(/rogue|thief|beggar|cloaked|assassin|bandit/.test(text))return'rogue';
  return'civilian';
}

function raceSkin(race,seed){
  if(race==='dark_elf')return choose([0x75657f,0x665873,0x84728e],seed,7);
  if(race==='orc')return choose([0x718f55,0x627e4a,0x829960],seed,7);
  if(race==='goblin')return choose([0x82945d,0x71864f,0x91a26b],seed,7);
  return choose(HUMAN_SKIN,seed,7);
}

export function createCharacterAppearance({identity,race='human',classId='warrior',role,title,action,isPlayer=false,isHostile=false,appearance}={}){
  const key=normalized(identity)||`${race}_${classId}`,seed=appearanceHash(`${key}:${race}`),override=NAMED_OVERRIDES[key]||{},resolvedRole=override.role||role||inferAppearanceRole({id:key,title,action,classId,isPlayer,isHostile});
  const buildId=appearance?.build||override.build||choose(BUILDS,seed,1).id,build=BUILDS.find(item=>item.id===buildId)||BUILDS[1];
  let hair=appearance?.hair||override.hair||choose(HAIR_STYLES,seed,2),beard=appearance?.beard||override.beard||choose(BEARD_STYLES,seed,3);
  const age=appearance?.age||override.age||choose(['adult','adult','veteran','elder'],seed,4);
  if(age==='elder'&&hair==='cropped')hair='swept';if(race==='dwarf'&&beard==='none')beard=choose(['full','braided'],seed,5);if(race==='goblin')beard='none';
  const palettes=ROLE_PALETTES[resolvedRole]||ROLE_PALETTES.civilian,paletteIndex=Number.isInteger(appearance?.palette)?appearance.palette:Number.isInteger(override.palette)?override.palette:seed%palettes.length;
  const chosenPalette=(['guard','adventurer','hostile'].includes(resolvedRole)&&CLASS_PALETTES[classId])||palettes[paletteIndex%palettes.length];
  return Object.freeze({
    version:1,identity:key,seed,role:resolvedRole,build:build.id,bodyScale:Object.freeze([...build.scale]),age,
    face:Object.freeze({shape:seed%4,jaw:.88+(seed%9)*.025,nose:(seed>>>4)%4,brow:(seed>>>7)%3}),
    hair,beard,hairColor:choose(HAIR_COLORS,seed,6),skinColor:raceSkin(race,seed),palette:Object.freeze([...chosenPalette]),
    armor:['guard','adventurer','hostile'].includes(resolvedRole),showClassEquipment:['guard','adventurer','hostile','ranger','rogue'].includes(resolvedRole),
  });
}

export const CHARACTER_APPEARANCE_VERSION=1;
