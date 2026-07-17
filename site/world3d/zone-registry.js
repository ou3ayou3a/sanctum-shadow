import { buildVaeltharCourtyard } from './zones/vaelthar-courtyard.js?v=165';
import { buildTarnishedCup } from './zones/tarnished-cup.js?v=140';
import { buildGenericZone } from './zones/generic-zone.js?v=171';

const productionZones={vaelthar_city:buildVaeltharCourtyard,tarnished_cup:buildTarnishedCup};

export function buildZone(locationId){
  const location=window.WORLD_LOCATIONS?.[locationId]||{id:locationId,name:String(locationId||'Unknown').replaceAll('_',' '),subtitle:'Uncharted Ground',type:'wilderness'};
  const factory=productionZones[locationId];
  return factory?factory():buildGenericZone(location);
}

export function hasProductionZone(locationId){return !!productionZones[locationId]||(typeof window!=='undefined'&&!!window.WORLD_LOCATIONS?.[locationId]);}
