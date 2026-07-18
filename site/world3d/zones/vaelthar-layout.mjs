import {VAELTHAR_CITY_SIZE,VAELTHAR_DISTRICT_PLAN} from './vaelthar-city-plan.mjs';

export const VAELTHAR_BOUNDS=Object.freeze({minX:-VAELTHAR_CITY_SIZE.width/2+2,maxX:VAELTHAR_CITY_SIZE.width/2-2,minZ:-VAELTHAR_CITY_SIZE.depth/2+2,maxZ:66});
export const VAELTHAR_SPAWN=Object.freeze({x:0,y:0,z:59});
export const VAELTHAR_DISTRICTS=VAELTHAR_DISTRICT_PLAN;
export const VAELTHAR_LANDMARKS=Object.freeze([
  Object.freeze({id:'north_gate',label:'Inspect the Crown Gate',position:[0,0,-37],range:3.2,action:'map'}),
  Object.freeze({id:'signing_hall',label:'Investigate the ruined signing hall',position:[-13,0,-10],range:2.5,action:'scene:covenant_hall_scene'}),
  Object.freeze({id:'church_archive',label:'Inspect the sealed Church Archive',position:[-19,0,-1],range:2.4,action:'inspect'}),
  Object.freeze({id:'temple_quarter',label:'Enter the Temple Quarter',position:[14,0,-9],range:2.6,action:'scene:temple_quarter_arrival'}),
  Object.freeze({id:'watch_post',label:'Inspect the Watch command post',position:[3,0,-7],range:2.2,action:'inspect'}),
  Object.freeze({id:'covenant_fountain',label:'Examine the Covenant fountain',position:[0,0,2],range:2.1,action:'inspect'}),
  Object.freeze({id:'ash_market',label:'Browse the Ash Market',position:[13,0,10],range:2.4,action:'shop'}),
  Object.freeze({id:'tarnished_cup',label:'Enter the Tarnished Cup',position:[-16,0,18],range:2.4,action:'scene:tarnished_cup_arrival'}),
  Object.freeze({id:'crown_citadel',label:'Survey the Crown Citadel',position:[0,0,-33],range:3,action:'inspect'}),
  Object.freeze({id:'ostrene_legation',label:'Answer the summons at the Ostrene Legation',position:[-27,0,-17],range:2.2,action:'quest:c1q8'}),
  Object.freeze({id:'royal_treasury',label:'Enter the Royal Treasury',position:[8,0,-29],range:2.2,action:'quest:c1q9'}),
  Object.freeze({id:'wool_almshouse',label:'Enter the Wool Almshouse',position:[27,0,26],range:2.2,action:'quest:c1q10'}),
  Object.freeze({id:'gallows_yard',label:'Investigate the Gallows Yard',position:[8,0,31],range:2.2,action:'quest:c1q11'}),
  Object.freeze({id:'southward_square',label:'Inspect Southward Square',position:[0,0,29],range:2.6,action:'inspect'}),
  Object.freeze({id:'south_gate',label:'Inspect the southern road gate',position:[0,0,37],range:2.8,action:'map'}),
  Object.freeze({id:'thornwood_cave',label:'Inspect the cave entrance',position:[-25,0,51],range:3,action:'inspect'}),
]);
