import {placeEnvironmentAsset} from './environment-asset-loader.js?v=144';
import {interiorDefinitionFor} from './interior-registry.mjs';

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

const FANTASY_CHARACTER_ROOT='world3d/assets/characters/rpg';
export const CLASS_MODEL_URLS=Object.freeze({
  warrior:`${FANTASY_CHARACTER_ROOT}/Warrior.glb?v=1`,paladin:`${FANTASY_CHARACTER_ROOT}/Warrior.glb?v=1`,cleric:`${FANTASY_CHARACTER_ROOT}/Cleric.glb?v=1`,
  mage:`${FANTASY_CHARACTER_ROOT}/Wizard.glb?v=1`,rogue:`${FANTASY_CHARACTER_ROOT}/Rogue.glb?v=1`,ranger:`${FANTASY_CHARACTER_ROOT}/Ranger.glb?v=1`,
});

export function productionClassModel(characterClass,fallback){return CLASS_MODEL_URLS[characterClass]||fallback;}
const ROLE_MODEL_URLS=Object.freeze({worker:`${FANTASY_CHARACTER_ROOT}/Monk.glb?v=1`,civilian:`${FANTASY_CHARACTER_ROOT}/Monk.glb?v=1`,merchant:`${FANTASY_CHARACTER_ROOT}/Monk.glb?v=1`,scholar:`${FANTASY_CHARACTER_ROOT}/Wizard.glb?v=1`,cleric:`${FANTASY_CHARACTER_ROOT}/Cleric.glb?v=1`});
export function productionCharacterModel({characterClass,role}={},fallback){return ROLE_MODEL_URLS[role]||productionClassModel(characterClass,fallback);}

export function interiorAssetFor(location){return interiorDefinitionFor(location)?.asset||null;}
