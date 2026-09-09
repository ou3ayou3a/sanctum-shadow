import { buildVaeltharCourtyard } from './zones/vaelthar-courtyard.js?v=181';
import { buildTarnishedCup } from './zones/tarnished-cup.js?v=185';
import { buildGenericZone } from './zones/generic-zone.js?v=236';
import { buildMolWellShaft } from './zones/mol-well-shaft.js?v=231';

const productionZones={vaelthar_city:buildVaeltharCourtyard,tarnished_cup:buildTarnishedCup,mol_well_shaft:buildMolWellShaft};

export function buildZone(locationId){
  const location=window.WORLD_LOCATIONS?.[locationId]||{id:locationId,name:String(locationId||'Unknown').replaceAll('_',' '),subtitle:'Uncharted Ground',type:'wilderness'};
  const factory=productionZones[locationId];
  return factory?factory():buildGenericZone(location);
}

export function hasProductionZone(locationId){return !!productionZones[locationId]||(typeof window!=='undefined'&&!!window.WORLD_LOCATIONS?.[locationId]);}
