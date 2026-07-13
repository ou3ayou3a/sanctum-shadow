import { buildVaeltharCourtyard } from './zones/vaelthar-courtyard.js';
import { buildGenericZone } from './zones/generic-zone.js';

const productionZones={vaelthar_city:buildVaeltharCourtyard};

export function buildZone(locationId){
  const location=window.WORLD_LOCATIONS?.[locationId]||{id:locationId,name:String(locationId||'Unknown').replaceAll('_',' '),subtitle:'Uncharted Ground',type:'wilderness'};
  const factory=productionZones[locationId];
  return factory?factory():buildGenericZone(location);
}

export function hasProductionZone(locationId){return !!productionZones[locationId]||(typeof window!=='undefined'&&!!window.WORLD_LOCATIONS?.[locationId]);}
