export const VAELTHAR_BOUNDS=Object.freeze({minX:-29,maxX:29,minZ:-29,maxZ:29});
export const VAELTHAR_SPAWN=Object.freeze({x:0,y:0,z:18});
export const VAELTHAR_DISTRICTS=Object.freeze([
  Object.freeze({id:'main_square',name:'Covenant Square',center:[0,0]}),
  Object.freeze({id:'signing_hall',name:'Ruined Signing Hall',center:[-13,-12]}),
  Object.freeze({id:'temple_quarter',name:'Temple Quarter',center:[15,-13]}),
  Object.freeze({id:'archive_lane',name:'Archive Lane',center:[-20,-2]}),
  Object.freeze({id:'market',name:'Ash Market',center:[13,11]}),
  Object.freeze({id:'tarnished_cup',name:'The Tarnished Cup',center:[-16,12]}),
]);
export const VAELTHAR_LANDMARKS=Object.freeze([
  Object.freeze({id:'north_gate',label:'Inspect the Crown Gate',position:[0,0,-25],range:3.2,action:'map'}),
  Object.freeze({id:'signing_hall',label:'Investigate the ruined signing hall',position:[-13,0,-10],range:2.5,action:'scene:covenant_hall_scene'}),
  Object.freeze({id:'church_archive',label:'Inspect the sealed Church Archive',position:[-19,0,-1],range:2.4,action:'inspect'}),
  Object.freeze({id:'temple_quarter',label:'Enter the Temple Quarter',position:[14,0,-9],range:2.6,action:'scene:temple_quarter_arrival'}),
  Object.freeze({id:'watch_post',label:'Inspect the Watch command post',position:[3,0,-7],range:2.2,action:'inspect'}),
  Object.freeze({id:'covenant_fountain',label:'Examine the Covenant fountain',position:[0,0,2],range:2.1,action:'inspect'}),
  Object.freeze({id:'ash_market',label:'Browse the Ash Market',position:[13,0,10],range:2.4,action:'shop'}),
  Object.freeze({id:'tarnished_cup',label:'Enter the Tarnished Cup',position:[-16,0,14],range:2.4,action:'scene:tarnished_cup_arrival'}),
  Object.freeze({id:'south_gate',label:'Inspect the southern road gate',position:[0,0,26],range:2.8,action:'map'}),
]);
