const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../site/travel.js'),'utf8');
test('entering and leaving a local physical shaft never rolls a road discovery or ambush',()=>{
 let rolls=0,travels=0;
 const locations={mol_village:{id:'mol_village'},mol_well_shaft:{id:'mol_well_shaft',parentLocation:'mol_village',physicalEntrance:'mol_well'},merchant_road:{id:'merchant_road'}};
 const root={WORLD_LOCATIONS:locations,mapState:{currentLocation:'mol_village'},travelToLocation:loc=>{travels++;root.mapState.currentLocation=loc.id;return true;}};
 vm.runInNewContext(source.slice(source.indexOf('(function hookTravel()')), {window:root,document:{getElementById:()=>null},console:{log(){}},rollTravelEncounter:()=>{rolls++;return null;},setTimeout(){throw Error('Unexpected encounter scheduled');}});
 root.travelToLocation(locations.mol_well_shaft);root.travelToLocation(locations.mol_village);
 assert.equal(travels,2);assert.equal(rolls,0);
 root.travelToLocation(locations.merchant_road);assert.equal(rolls,1);
});
test('the lower monastery doorway is a local passage in both directions',()=>{
 let rolls=0;
 const locations={monastery_cellar:{id:'monastery_cellar'},monastery_depths:{id:'monastery_depths',parentLocation:'monastery_cellar',physicalEntrance:'entrance_monastery_depths'}};
 const root={WORLD_LOCATIONS:locations,mapState:{currentLocation:'monastery_cellar'},travelToLocation:loc=>{root.mapState.currentLocation=loc.id;return true;}};
 vm.runInNewContext(source.slice(source.indexOf('(function hookTravel()')),{window:root,document:{getElementById:()=>null},console:{log(){}},rollTravelEncounter:()=>{rolls++;return null;},setTimeout(){throw Error('Unexpected road encounter');}});
 root.travelToLocation(locations.monastery_depths);root.travelToLocation(locations.monastery_cellar);assert.equal(rolls,0);
});
