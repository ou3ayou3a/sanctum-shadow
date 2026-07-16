export const CHAPTER_ONE_ZONE_IDS=Object.freeze([
  'vaelthar_city','tarnished_cup','temple_quarter','thornwood_gate','mol_village','monastery_aldric','merchant_road','fortress_harren','ashen_fields','tower_ash','thornwood_passage','lost_cartographer','church_archive','temple_wine_house','gatehouse_ale','mol_hearthfire','monastery_cellar','roadside_inn','harren_hall','ashen_camp','tower_antechamber','thornwood_hut','cartographer_flask','archive_scriptorium',
]);

const ID_KITS=Object.freeze({
  tarnished_cup:'tavern',temple_wine_house:'tavern',gatehouse_ale:'tavern',mol_hearthfire:'tavern',monastery_cellar:'cellar',roadside_inn:'tavern',harren_hall:'tavern',cartographer_flask:'tavern',
  thornwood_passage:'forest',thornwood_hut:'forest',lost_cartographer:'cartographer',mol_village:'village',thornwood_gate:'outpost',merchant_road:'road',fortress_harren:'fortress',monastery_aldric:'monastery',church_archive:'archive',archive_scriptorium:'archive',ashen_fields:'ashen',ashen_camp:'ashen',tower_ash:'tower',tower_antechamber:'tower',temple_quarter:'temple',
});
const TYPE_KITS=Object.freeze({tavern:'tavern',district:'temple',village:'village',outpost:'outpost',road:'road',fortress:'fortress',dungeon:'dungeon',wilderness:'forest',point_of_interest:'cartographer'});
const SCENES=Object.freeze({tarnished_cup:'tarnished_cup_arrival',temple_quarter:'temple_quarter_arrival',thornwood_gate:'cartographer_missing',mol_village:'mol_village_arrival',monastery_aldric:'monastery_arrival',monastery_cellar:'monastery_dungeon_entry',merchant_road:'merchant_road_investigation',fortress_harren:'fortress_harren_arrival'});
const LABELS=Object.freeze({tavern:'Enter the common room',cellar:'Descend into the cellar',forest:'Follow the living path',cartographer:'Inspect the abandoned map camp',village:'Approach the village gathering',outpost:'Inspect the guarded passage',road:'Investigate the ruined caravan',fortress:'Approach the sealed fortress gate',monastery:'Enter Saint Aldric',archive:'Open the sealed archive',ashen:'Examine the blue fire',tower:'Approach the impossible tower',temple:'Enter the sacred precinct',dungeon:'Descend into the ruins'});

export function getZoneProfile(location={}){const kit=ID_KITS[location.id]||TYPE_KITS[location.type]||'forest';return Object.freeze({id:location.id||'unknown',kit,arrivalScene:SCENES[location.id]||null,interactionLabel:LABELS[kit]||`Inspect ${location.name||'the area'}`,danger:Math.max(1,Math.min(5,Number(location.danger)||1))});}
