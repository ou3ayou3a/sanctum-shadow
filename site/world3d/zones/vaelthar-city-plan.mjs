const freezeEntries=entries=>Object.freeze(entries.map(entry=>Object.freeze(entry)));

export const VAELTHAR_CITY_SIZE=Object.freeze({width:88,depth:88,wall:39});

export const VAELTHAR_DISTRICT_PLAN=freezeEntries([
  {id:'main_square',name:'Covenant Square',center:[0,1],radius:10,accent:0xc5a554},
  {id:'watch_ward',name:'Watch Ward',center:[3,-9],radius:7,accent:0x8c3a34},
  {id:'signing_hall',name:'The Cinder Court',center:[-14,-15],radius:8,accent:0x7e463a},
  {id:'temple_quarter',name:'Temple Quarter',center:[18,-16],radius:9,accent:0xd4c06d},
  {id:'archive_lane',name:'Archive Lane',center:[-24,-3],radius:8,accent:0x9b8d6b},
  {id:'market',name:'Ash Market',center:[17,14],radius:9,accent:0xb2774d},
  {id:'tarnished_cup',name:'Cupside',center:[-18,15],radius:8,accent:0xa06446},
  {id:'southward',name:'Southward',center:[0,28],radius:9,accent:0x6f8b78},
  {id:'crown_ward',name:'Crown Ward',center:[0,-30],radius:8,accent:0xb8a260},
]);

export const VAELTHAR_STREETS=freezeEntries([
  {id:'crown_road',width:7.2,points:[[0,39],[1,29],[0,19],[-1,10],[0,1],[2,-10],[1,-21],[0,-39]]},
  {id:'ash_market_way',width:5.2,points:[[-1,4],[7,7],[14,12],[23,14],[32,13],[39,11]]},
  {id:'archive_lane',width:4.8,points:[[0,-2],[-8,-4],[-17,-3],[-25,0],[-33,1],[-39,-1]]},
  {id:'cupside_lane',width:4.6,points:[[0,7],[-8,10],[-16,15],[-25,18],[-34,17],[-39,14]]},
  {id:'pilgrim_way',width:5,points:[[1,-5],[8,-8],[15,-14],[24,-18],[32,-17],[39,-14]]},
  {id:'cinder_alley',width:3.8,points:[[-3,-6],[-9,-10],[-14,-15],[-18,-23],[-15,-31]]},
]);

export const VAELTHAR_BUILDING_PLOTS=freezeEntries([
  {id:'south_house_1',asset:'narrow_house',district:'southward',x:-8,z:29,width:4.6,depth:5.8,height:8.3,rotation:.05},
  {id:'south_house_2',asset:'row_house',district:'southward',x:10,z:29,width:8.8,depth:5,height:7.1,rotation:-.04},
  {id:'south_workshop',asset:'craft_workshop',district:'southward',x:-19,z:29,width:8.4,depth:7.4,height:6.2,rotation:.12},
  {id:'south_granary',asset:'raised_granary',district:'southward',x:21,z:30,width:9.2,depth:7,height:7.7,rotation:-.09},
  {id:'south_row_west',asset:'row_house',district:'southward',x:-31.5,z:31,width:9,depth:5,height:7.2,rotation:.06},
  {id:'south_narrow_east',asset:'narrow_house',district:'southward',x:32.5,z:30,width:4.6,depth:5.8,height:8.7,rotation:-.04},
  {id:'cup_row_1',asset:'row_house',district:'tarnished_cup',x:-30,z:13,width:9,depth:5,height:7.1,rotation:.08},
  {id:'cup_house_2',asset:'house_b',district:'tarnished_cup',x:-29,z:23,width:7.7,depth:6,height:7.5,rotation:-.08},
  {id:'cup_narrow',asset:'narrow_house',district:'tarnished_cup',x:-18,z:26,width:4.5,depth:5.7,height:8.5,rotation:.04},
  {id:'cup_guild',asset:'guild_hall',district:'tarnished_cup',x:-33,z:2,width:10.4,depth:8.2,height:8.6,rotation:1.46},
  {id:'market_warehouse',asset:'merchant_warehouse',district:'market',x:29,z:6,width:10.5,depth:7.5,height:9.2,rotation:-.08},
  {id:'market_row',asset:'row_house',district:'market',x:32,z:20,width:8.8,depth:5,height:7.4,rotation:.1},
  {id:'market_house_3',asset:'house_c',district:'market',x:22,z:27,width:6.2,depth:5.2,height:6.5,rotation:-.06},
  {id:'market_workshop',asset:'craft_workshop',district:'market',x:33,z:31,width:8.2,depth:7.4,height:6.4,rotation:-.08},
  {id:'archive_narrow',asset:'narrow_house',district:'archive_lane',x:-34,z:-10,width:4.6,depth:5.8,height:8.8,rotation:-.08},
  {id:'archive_guild',asset:'guild_hall',district:'archive_lane',x:-31,z:7,width:10.4,depth:8.2,height:8.8,rotation:.08},
  {id:'archive_row',asset:'row_house',district:'archive_lane',x:-20,z:8,width:8.8,depth:5,height:7.1,rotation:-.06},
  {id:'archive_chapel',asset:'street_chapel',district:'archive_lane',x:-33,z:-24,width:7.4,depth:7,height:9.4,rotation:-.04},
  {id:'cinder_warehouse',asset:'merchant_warehouse',district:'signing_hall',x:-27,z:-18,width:10.5,depth:7.5,height:9.0,rotation:.12},
  {id:'cinder_row',asset:'row_house',district:'signing_hall',x:-23,z:-30,width:8.8,depth:5,height:7.1,rotation:-.08},
  {id:'cinder_narrow',asset:'narrow_house',district:'signing_hall',x:-10,z:-29,width:4.6,depth:5.8,height:8.5,rotation:.05},
  {id:'cinder_workshop',asset:'craft_workshop',district:'signing_hall',x:-34,z:-34,width:8.2,depth:7.4,height:6.3,rotation:.04},
  {id:'temple_chapel',asset:'street_chapel',district:'temple_quarter',x:30,z:-7,width:7.4,depth:7,height:9.2,rotation:.08},
  {id:'temple_noble',asset:'noble_estate',district:'temple_quarter',x:31,z:-25,width:11.2,depth:9,height:11.4,rotation:-.08},
  {id:'temple_row',asset:'row_house',district:'temple_quarter',x:19,z:-30,width:8.8,depth:5,height:7.3,rotation:.05},
  {id:'temple_narrow',asset:'narrow_house',district:'temple_quarter',x:33,z:-36,width:4.6,depth:5.8,height:8.7,rotation:-.03},
  {id:'crown_noble_west',asset:'noble_estate',district:'crown_ward',x:-11,z:-32,width:11.2,depth:9,height:11.2,rotation:.03},
  {id:'crown_noble_east',asset:'noble_estate',district:'crown_ward',x:11,z:-32,width:11.2,depth:9,height:11.6,rotation:-.03},
  {id:'crown_guild_west',asset:'guild_hall',district:'crown_ward',x:-25,z:-34.5,width:10.4,depth:8.2,height:8.8,rotation:.03},
  {id:'crown_guild_east',asset:'guild_hall',district:'crown_ward',x:25,z:-34.5,width:10.4,depth:8.2,height:9.0,rotation:-.03},
]);

export const VAELTHAR_MARKET_STALLS=freezeEntries([
  {x:10,z:10,rotation:.04,color:0x733f35},{x:15,z:9,rotation:-.05,color:0x62533a},{x:20,z:10,rotation:.04,color:0x405d50},{x:11,z:16,rotation:-.04,color:0x5e445f},{x:16,z:17,rotation:.05,color:0x7a5035},{x:21,z:16,rotation:-.03,color:0x485f4d},{x:14,z:22,rotation:.04,color:0x6a3d42},{x:20,z:22,rotation:-.04,color:0x6d5b3e},
]);

export const VAELTHAR_TERRACES=freezeEntries([
  {id:'citadel-rise',x:0,z:-45,width:34,depth:18,height:4,color:0x303834},
  {id:'temple-rise',x:22,z:-23,width:24,depth:16,height:.55,color:0x555b54},
  {id:'archive-rise',x:-30,z:-4,width:15,depth:22,height:.35,color:0x444943},
]);
