import {placeEnvironmentAsset} from './environment-asset-loader.js?v=144';

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

const INTERIOR_BY_LOCATION=Object.freeze({
  harren_hall:'castle_interior',monastery_cellar:'dungeon_interior',tower_antechamber:'dungeon_interior',
  church_archive:'shop_interior',archive_scriptorium:'shop_interior',temple_quarter:'temple_interior',thornwood_hut:'house_interior'
});
const INTERIOR_BY_KIT=Object.freeze({tavern:'tavern_interior',cellar:'dungeon_interior',archive:'shop_interior',dungeon:'dungeon_interior'});

export function interiorAssetFor(location,kit){return INTERIOR_BY_LOCATION[location?.id]||INTERIOR_BY_KIT[kit]||null;}
