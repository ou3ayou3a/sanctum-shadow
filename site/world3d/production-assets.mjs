import {placeEnvironmentAsset} from './environment-asset-loader.js?v=144';
import {interiorDefinitionFor} from './interior-registry.mjs';
import {normalizeClassId} from './class-profiles.mjs';
import {normalizeRaceId} from './race-profiles.mjs';

const ROOT='world3d/assets/production';

export const PRODUCTION_ASSETS=Object.freeze({
  house_a:`${ROOT}/environment/house_a.glb`,house_b:`${ROOT}/environment/house_b.glb`,house_c:`${ROOT}/environment/house_c.glb`,
  merchant_shop:`${ROOT}/environment/merchant_shop.glb`,tavern:`${ROOT}/environment/tavern.glb`,temple:`${ROOT}/environment/temple.glb`,
  narrow_house:`${ROOT}/environment/narrow_house.glb`,row_house:`${ROOT}/environment/row_house.glb`,craft_workshop:`${ROOT}/environment/craft_workshop.glb`,
  merchant_warehouse:`${ROOT}/environment/merchant_warehouse.glb`,guild_hall:`${ROOT}/environment/guild_hall.glb`,street_chapel:`${ROOT}/environment/street_chapel.glb`,
  noble_estate:`${ROOT}/environment/noble_estate.glb`,raised_granary:`${ROOT}/environment/raised_granary.glb`,
  castle_tower:`${ROOT}/environment/castle_tower.glb`,city_gatehouse:`${ROOT}/environment/city_gatehouse.glb`,castle_wall:`${ROOT}/environment/castle_wall.glb`,castle_keep:`${ROOT}/environment/castle_keep.glb`,
  stone_bridge:`${ROOT}/environment/stone_bridge.glb`,crypt:`${ROOT}/environment/crypt.glb`,ancient_ruin:`${ROOT}/environment/ancient_ruin.glb`,cave_entrance:`${ROOT}/environment/cave_entrance.glb`,
  oak_tree:`${ROOT}/environment/oak_tree.glb`,forest_tree:`${ROOT}/environment/forest_tree.glb`,dead_tree:`${ROOT}/environment/dead_tree.glb`,
  tavern_interior:`${ROOT}/interiors/tavern_interior.glb`,shop_interior:`${ROOT}/interiors/shop_interior.glb`,temple_interior:`${ROOT}/interiors/temple_interior.glb`,
  castle_interior:`${ROOT}/interiors/castle_interior.glb`,house_interior:`${ROOT}/interiors/house_interior.glb`,dungeon_interior:`${ROOT}/interiors/dungeon_interior.glb`
});

export function productionAssetSpec(id){
  const url=PRODUCTION_ASSETS[id];
  if(!url)throw new Error(`Unknown production asset: ${id}`);
  return{type:'gltf',url};
}

export function placeProductionAsset(root,id,placement={}){
  return placeEnvironmentAsset(root,productionAssetSpec(id),{name:`production:${id}`,...placement});
}

export const RACE_MODEL_URLS=Object.freeze({
  human:`${ROOT}/characters/human.glb?v=2`,dwarf:`${ROOT}/characters/dwarf.glb?v=2`,elf:`${ROOT}/characters/elf.glb?v=2`,high_elf:`${ROOT}/characters/high_elf.glb?v=2`,
  dark_elf:`${ROOT}/characters/dark_elf.glb?v=2`,orc:`${ROOT}/characters/orc.glb?v=2`,goblin:`${ROOT}/characters/goblin.glb?v=2`
});

export function productionRaceModel(race,fallback='prototype/assets/elf-ranger.glb'){
  return RACE_MODEL_URLS[race]||fallback;
}

// Standing height (metres, rest pose) of each race's production model. A hero model is
// uniformly scaled by raceHeight/hero.height, so its standing height matches the race's
// own model and a dwarf or goblin paladin is not a 2 m knight. hero.height is the
// authored standing height of the hero GLB (helmet included).
export const RACE_MODEL_HEIGHTS=Object.freeze({human:1.8322,dwarf:1.5021,elf:1.9421,high_elf:1.9971,dark_elf:1.9238,orc:2.0517,goblin:1.2273});

// Player-character hero models. Only player-controlled characters (the local player,
// remote party members and their combat stand-ins) may use these; NPCs and enemies never do.
export const HERO_MODEL_PATH=`${ROOT}/characters/heroes/fallen_paladin.glb`;
export const HERO_MODELS=Object.freeze({
  fallen_paladin:Object.freeze({id:'fallen_paladin',name:'Fallen Paladin',url:`${HERO_MODEL_PATH}?v=1`,weapon:'fallen_longsword',tint:false,height:2.05})
});
const CLASS_HEROES=Object.freeze({paladin:'fallen_paladin'});
export function heroModel(id){return Object.hasOwn(HERO_MODELS,String(id))?HERO_MODELS[id]:null;}
export function heroIdForCharacter(character){
  if(!character||typeof character!=='object'||typeof character.class!=='string')return null;
  const id=normalizeClassId(character.class);
  return Object.hasOwn(CLASS_HEROES,id)?CLASS_HEROES[id]:null;
}
export function heroScaleForRace(hero,race){
  const model=typeof hero==='string'?heroModel(hero):hero,height=RACE_MODEL_HEIGHTS[normalizeRaceId(race)];
  return model?.height>0&&height>0?height/model.height:1;
}

export function interiorAssetFor(location){return interiorDefinitionFor(location)?.asset||null;}
