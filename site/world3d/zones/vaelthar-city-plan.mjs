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
  {id:'south_house_1',district:'southward',x:-9,z:29,width:6,depth:6,height:4.5,rotation:.08,tint:0x746d60},
  {id:'south_house_2',district:'southward',x:10,z:29,width:7,depth:6,height:5.2,rotation:-.08,tint:0x69645a},
  {id:'south_house_3',district:'southward',x:-19,z:29,width:8,depth:6,height:4.8,rotation:.18,tint:0x716758},
  {id:'south_house_4',district:'southward',x:20,z:30,width:8,depth:6,height:5.4,rotation:-.15,tint:0x756e60},
  {id:'cup_house_1',district:'tarnished_cup',x:-29,z:13,width:7,depth:6,height:5.1,rotation:.12,tint:0x665c52},
  {id:'cup_house_2',district:'tarnished_cup',x:-29,z:23,width:8,depth:6,height:4.5,rotation:-.1,tint:0x73685b},
  {id:'cup_house_3',district:'tarnished_cup',x:-18,z:25,width:7,depth:6,height:5.3,rotation:.06,tint:0x6c6257},
  {id:'market_house_1',district:'market',x:29,z:7,width:7,depth:6,height:5.2,rotation:-.12,tint:0x746a5d},
  {id:'market_house_2',district:'market',x:31,z:20,width:8,depth:6,height:5.6,rotation:.14,tint:0x6b6256},
  {id:'market_house_3',district:'market',x:21,z:26,width:7,depth:6,height:4.8,rotation:-.08,tint:0x746d60},
  {id:'archive_house_1',district:'archive_lane',x:-32,z:-9,width:7,depth:7,height:5.4,rotation:-.1,tint:0x66645d},
  {id:'archive_house_2',district:'archive_lane',x:-31,z:7,width:8,depth:6,height:4.9,rotation:.1,tint:0x777365},
  {id:'archive_house_3',district:'archive_lane',x:-21,z:7,width:7,depth:6,height:5.2,rotation:-.08,tint:0x6a675e},
  {id:'cinder_house_1',district:'signing_hall',x:-26,z:-19,width:7,depth:6,height:4.8,rotation:.18,tint:0x665b52},
  {id:'cinder_house_2',district:'signing_hall',x:-22,z:-29,width:8,depth:6,height:5.4,rotation:-.12,tint:0x70665b},
  {id:'cinder_house_3',district:'signing_hall',x:-10,z:-29,width:7,depth:6,height:4.6,rotation:.08,tint:0x6a6258},
  {id:'temple_house_1',district:'temple_quarter',x:29,z:-7,width:7,depth:6,height:5.5,rotation:.1,tint:0x7d776a},
  {id:'temple_house_2',district:'temple_quarter',x:31,z:-25,width:8,depth:7,height:5.8,rotation:-.12,tint:0x746f64},
  {id:'temple_house_3',district:'temple_quarter',x:20,z:-29,width:7,depth:6,height:5.1,rotation:.08,tint:0x817a6d},
  {id:'crown_house_1',district:'crown_ward',x:-9,z:-33,width:6,depth:5,height:5.5,rotation:.04,tint:0x736b60},
  {id:'crown_house_2',district:'crown_ward',x:9,z:-33,width:6,depth:5,height:5.8,rotation:-.04,tint:0x69645a},
]);

export const VAELTHAR_MARKET_STALLS=freezeEntries([
  {x:10,z:10,rotation:.04,color:0x733f35},{x:15,z:9,rotation:-.05,color:0x62533a},{x:20,z:10,rotation:.04,color:0x405d50},{x:11,z:16,rotation:-.04,color:0x5e445f},{x:16,z:17,rotation:.05,color:0x7a5035},{x:21,z:16,rotation:-.03,color:0x485f4d},{x:14,z:22,rotation:.04,color:0x6a3d42},{x:20,z:22,rotation:-.04,color:0x6d5b3e},
]);

export const VAELTHAR_TERRACES=freezeEntries([
  {id:'citadel-rise',x:0,z:-45,width:34,depth:18,height:4,color:0x303834},
  {id:'temple-rise',x:22,z:-23,width:24,depth:16,height:.55,color:0x555b54},
  {id:'archive-rise',x:-30,z:-4,width:15,depth:22,height:.35,color:0x444943},
]);
