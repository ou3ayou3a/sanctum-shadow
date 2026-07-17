const emptyEffects=()=>({flags:{},facts:{},reputation:[],resources:{hp:0,holy:0,hell:0,xp:0},items:{add:[],remove:[]},questEvents:[]});

const INTERIORS=Object.freeze({
  tarnished_cup:{asset:'tavern_interior',size:[18,6.1,14],returnTo:'vaelthar_city',entrance:[-16,18],variant:'city_tavern'},
  temple_quarter:{asset:'temple_interior',size:[13.5,6.2,13],returnTo:'vaelthar_city',entrance:[22,-7],variant:'flame_temple',accent:0xd8bd68,
    npcs:[{id:'sister_mourne',name:'Sister Mourne',title:'The Candle · Inquisitor',position:[0,0,2.5],facing:Math.PI,race:'human',classId:'cleric',action:'dialogue'},{id:'temple_sacristan',name:'Brother Pell',title:'Sacristan · Keeper of Ashes',position:[-3.6,0,-1.2],action:'ambient',ambientLine:'“The oldest stones beneath the altar bear no flame.”',race:'human',classId:'cleric'}]},
  temple_wine_house:{asset:'tavern_interior',size:[13.5,5.2,10.5],returnTo:'temple_quarter',entrance:[-4.5,-3.7],variant:'wine_house',accent:0xd0a65b,
    npcs:[{id:'vesna_winekeeper',name:'Vesna',title:'Keeper of the Penitent’s Cup',position:[0,0,2.25],facing:Math.PI,action:'ambient',ambientLine:'“Priests confess more honestly to a cup than to an altar.”',race:'human',classId:'rogue'},{id:'doubting_deacon',name:'Deacon Oren',title:'Doubting Cleric',position:[-5,0,-2],action:'ambient',ambientLine:'“If faith were certainty, it would not require courage.”',race:'human',classId:'cleric'}]},
  gatehouse_ale:{asset:'tavern_interior',size:[14,5.2,10.5],returnTo:'thornwood_gate',entrance:[7,-6],variant:'guard_tavern',accent:0xc27a45,
    npcs:[{id:'donal_barkeep',name:'Donal',title:'Keeper of the Last Post',position:[0,0,2.25],facing:Math.PI,action:'ambient',ambientLine:'“Drink once before the wood. Drink twice if it lets you return.”',race:'dwarf',classId:'warrior'},{id:'gate_scout',name:'Scout Bren',title:'Thornwood Patrol',position:[5,0,-2],action:'ambient',ambientLine:'“The path moved again last night.”',race:'human',classId:'ranger'}]},
  mol_hearthfire:{asset:'tavern_interior',size:[14,5.4,11],returnTo:'mol_village',entrance:[-7,-4],variant:'village_hearth',accent:0xd06b3f,
    npcs:[{id:'breta_host',name:'Breta',title:'Keeper of the Hearthfire',position:[0,0,2.35],facing:Math.PI,action:'ambient',ambientLine:'“Around this fire, questions are safer than answers.”',race:'human',classId:'ranger'},{id:'mol_listener',name:'Mara Fen',title:'Mol Villager',position:[-5,0,-2],action:'ambient',ambientLine:'“Aldran says aloud what the rest of us only dared think.”',race:'human',classId:'cleric'}]},
  monastery_cellar:{asset:'dungeon_interior',size:[14,5.5,16],returnTo:'monastery_aldric',entrance:[0,-8],variant:'wine_cellar',accent:0x8d72bc,
    npcs:[{id:'cellar_survivor',name:'Brother Cal',title:'The Last Cellarer',position:[2.8,0,1],action:'ambient',ambientLine:'“Do not open a bottle that whispers first.”',race:'human',classId:'cleric'}]},
  roadside_inn:{asset:'tavern_interior',size:[14.5,5.3,11],returnTo:'merchant_road',entrance:[-7,-4],variant:'road_inn',accent:0xbe7847,
    npcs:[{id:'tomas_innkeeper',name:'Tomas',title:'Keeper of the Broke Wheel',position:[0,0,2.35],facing:Math.PI,action:'ambient',ambientLine:'“Eat quickly. If the road goes quiet, get below the windows.”',race:'human',classId:'ranger'},{id:'caravan_survivor',name:'Ilyan',title:'Caravan Survivor',position:[5,0,-2],action:'ambient',ambientLine:'“They came from beneath the road. I heard the stones move.”',race:'elf',classId:'rogue'}]},
  harren_hall:{asset:'castle_interior',size:[15,6.5,14],returnTo:'fortress_harren',entrance:[7,-5],variant:'oath_hall',accent:0xb08a55,
    npcs:[{id:'harren_veteran',name:'Roth Vale',title:'Forsaken Veteran',position:[-3,0,-1],action:'ambient',ambientLine:'“Orders change. Oaths do not. That is the trouble.”',race:'human',classId:'warrior'},{id:'grisel_barkeep',name:'Grisel',title:'Veteran · Hall Keeper',position:[0,0,3.6],facing:Math.PI,action:'ambient',ambientLine:'“Leave rank at the door. Everyone in here has buried one.”',race:'dwarf',classId:'warrior'}]},
  tower_antechamber:{asset:'dungeon_interior',size:[14,5.8,16],returnTo:'tower_ash',entrance:[0,-7],variant:'tower_crypt',accent:0x9f4f7d,npcs:[]},
  thornwood_hut:{asset:'house_interior',size:[8,4.4,7],returnTo:'thornwood_passage',entrance:[-5,-6],variant:'forest_hut',accent:0x66885c,npcs:[]},
  cartographer_flask:{asset:'house_interior',size:[9,4.5,8],returnTo:'lost_cartographer',entrance:[-5,-7],variant:'map_room',accent:0xb99a54,
    npcs:[{id:'changed_cartographer',name:'Edden',title:'The Changed Cartographer',position:[1.8,0,1.3],action:'ambient',ambientLine:'“Tell me this street is not real. Please.”',race:'human',classId:'mage'}]},
  church_archive:{asset:'shop_interior',size:[12,5,10],returnTo:'temple_quarter',entrance:[4.5,-3.7],variant:'sealed_archive',accent:0xbe8e58,
    npcs:[{id:'archive_copyist',name:'Neral',title:'Archive Copyist',position:[0,0,1.2],race:'elf',classId:'mage',action:'dialogue'}]},
  archive_scriptorium:{asset:'shop_interior',size:[11,4.8,9],returnTo:'church_archive',entrance:[0,2.7],variant:'hidden_scriptorium',accent:0xc29b63,
    npcs:[{id:'mira_archivist',name:'Mira',title:'Fugitive Archivist',position:[2.2,0,1],action:'ambient',ambientLine:'“The catalogue lies. The gaps tell the truth.”',race:'high_elf',classId:'mage'}]},
});

const ARCHETYPES=Object.freeze({
  tavern:[
    {id:'room',label:'Read the room',position:[0,-1.5],skill:'insight',ability:'wis',dc:11,icon:'👁'},
    {id:'ledger',label:'Inspect the house ledger',position:[2.8,1.7],skill:'investigation',ability:'int',dc:12,icon:'▤'},
    {id:'stores',label:'Search the secured stores',position:[-3.2,2.1],skill:'sleight_of_hand',ability:'dex',dc:13,icon:'🗝',item:'Keeper’s Brass Token'},
  ],
  dungeon:[
    {id:'passage',label:'Listen beyond the stone passage',position:[0,2.5],skill:'perception',ability:'wis',dc:12,icon:'👂'},
    {id:'marks',label:'Interpret the wall markings',position:[-4,0],skill:'arcana',ability:'int',dc:13,icon:'✦'},
    {id:'cache',label:'Open the concealed cache',position:[4,1.5],skill:'investigation',ability:'int',dc:14,icon:'◈',item:'Black-Iron Cache Key'},
  ],
  castle:[
    {id:'command_map',label:'Study the command map',position:[0,2.6],skill:'investigation',ability:'int',dc:12,icon:'🗺'},
    {id:'oath_wall',label:'Read the erased oaths',position:[-4,0],skill:'history',ability:'int',dc:13,icon:'📜'},
    {id:'armory',label:'Inspect the sealed armory',position:[4,0],skill:'athletics',ability:'str',dc:14,icon:'⚔',item:'Harren Armory Seal'},
  ],
  house:[
    {id:'hearth',label:'Inspect the cold hearth',position:[0,1.8],skill:'investigation',ability:'int',dc:11,icon:'♨'},
    {id:'floorboard',label:'Test the loose floorboards',position:[-2,0],skill:'perception',ability:'wis',dc:12,icon:'◈',item:'Weathered Field Note'},
    {id:'window',label:'Watch the world through the shutters',position:[2,0],skill:'survival',ability:'wis',dc:11,icon:'⌁'},
  ],
  archive:[
    {id:'catalogue',label:'Trace the altered catalogue',position:[-3,0],skill:'investigation',ability:'int',dc:13,icon:'▤'},
    {id:'cipher',label:'Decode the marginal cipher',position:[2.8,0],skill:'history',ability:'int',dc:14,icon:'📜'},
    {id:'cabinet',label:'Open the restricted cabinet',position:[0,2.4],skill:'sleight_of_hand',ability:'dex',dc:15,icon:'🗝',item:'Restricted Archive Folio'},
  ],
  temple:[
    {id:'altar',label:'Examine the layered altar',position:[0,3],skill:'religion',ability:'wis',dc:12,icon:'☩'},
    {id:'mosaic',label:'Read the damaged floor mosaic',position:[-3.5,0],skill:'history',ability:'int',dc:13,icon:'◇'},
    {id:'reliquary',label:'Open the sealed reliquary',position:[3.5,0],skill:'sleight_of_hand',ability:'dex',dc:15,icon:'🗝',item:'Old-Faith Reliquary Shard'},
  ],
});

const VARIANT_COPY=Object.freeze({
  wine_house:'The clergy are frightened enough to speak honestly when they think nobody important is listening.',guard_tavern:'The missing names on the drinking board match gaps in recent patrol rosters.',village_hearth:'Aldran’s listeners use an old cross scratched beneath the newer flame symbols.',road_inn:'The inn’s ledger proves the attacked caravans all carried sealed Church cargo.',wine_cellar:'A cold draft rises from a mortared passage beneath the oldest wine rack.',oath_hall:'Harren’s original oath was amended after he signed it; the erased line forbade obedience to a corrupted church.',tower_crypt:'The room’s geometry is a key: each impossible angle points toward the same sealed door.',forest_hut:'The forester marked a safe path in cuts that only align when viewed from inside the hut.',map_room:'One impossible map matches the Thornwood path outside and marks Edden’s last safe route.',sealed_archive:'The missing catalogue entries all concern correspondence sent before the Covenant burned.',hidden_scriptorium:'The archivists hid a second index inside the wine inventory.',city_tavern:'The room’s silences reveal which patrons fear the Church most.',flame_temple:'The altar was built over an older sanctuary whose carved cross predates the Eternal Flame.'
});

function archetypeFor(definition){if(definition.asset==='temple_interior')return'temple';if(definition.asset==='castle_interior')return'castle';if(definition.asset==='house_interior')return'house';if(definition.asset==='shop_interior')return'archive';if(definition.asset==='dungeon_interior')return'dungeon';return'tavern';}
function actionFor(locationId,definition,spot){
  const fact=`${VARIANT_COPY[definition.variant]||'The room preserves a useful truth that somebody tried to hide'} ${spot.id==='stores'||spot.id==='cache'||spot.id==='cabinet'?'A concealed compartment has been disturbed recently.':''}`.trim();
  const effects=emptyEffects();effects.flags[`ai_interior_${locationId}_${spot.id}`]=true;effects.facts[`ai_${locationId}_${spot.id}`]=fact;if(spot.item)effects.items.add.push(spot.item);effects.resources.xp=spot.dc>=14?25:0;
  const failureEffects=emptyEffects();failureEffects.flags[`ai_interior_${locationId}_${spot.id}_disturbed`]=true;
  return Object.freeze({id:`inspect_${spot.id}`,icon:spot.icon,label:spot.label,once:true,check:{skill:spot.skill,ability:spot.ability,dc:spot.dc},successText:fact,failureText:`Your attempt disturbs ${spot.label.toLowerCase()}, but reveals nothing reliable. A different approach may be safer.`,effects,failureEffects});
}

export const INTERIOR_LOCATION_IDS=Object.freeze(Object.keys(INTERIORS));
export function interiorDefinitionFor(locationOrId){const id=typeof locationOrId==='string'?locationOrId:locationOrId?.id,base=INTERIORS[id];if(!base)return null;const kind=archetypeFor(base),hotspots=(ARCHETYPES[kind]||ARCHETYPES.tavern).map(spot=>Object.freeze({...spot,actions:[actionFor(id,base,spot)]}));return Object.freeze({id,kind,...base,hotspots,npcs:(base.npcs||[]).map(npc=>Object.freeze({...npc}))});}
export function interiorEntrancesFor(locationOrId){const id=typeof locationOrId==='string'?locationOrId:locationOrId?.id;return INTERIOR_LOCATION_IDS.map(interiorDefinitionFor).filter(definition=>definition.returnTo===id);}
export function isInteriorLocation(locationOrId){return !!interiorDefinitionFor(locationOrId);}
