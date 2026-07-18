'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');

function worldLocations(){
  const window={mapDiscovered:{}},element=()=>({classList:{add(){},remove(){}},appendChild(){},setAttribute(){},addEventListener(){},style:{}});
  const document={getElementById(){return null;},createElement:element,createElementNS:element,head:{appendChild(){}}};
  const sandbox={window,document,console,setTimeout(){return 0;},clearTimeout(){},Math,Date};window.window=window;
  vm.runInNewContext(read('site/map.js'),sandbox,{filename:'map.js'});
  return window.WORLD_LOCATIONS;
}

test('the Chapter I world graph is complete, connected, and uses valid reciprocal routes',async()=>{
  const[{CHAPTER_ONE_ZONE_IDS},locations]=await Promise.all([import('../site/world3d/zones/zone-profiles.mjs'),Promise.resolve(worldLocations())]);
  assert.equal(CHAPTER_ONE_ZONE_IDS.length,24);
  for(const id of CHAPTER_ONE_ZONE_IDS){
    const location=locations[id];assert.ok(location,`${id} is missing from the world map`);
    assert.ok(Array.isArray(location.connections)&&location.connections.length,`${id} has no travel route`);
    for(const target of location.connections){assert.ok(locations[target]?.id,`${id} connects to invalid ${target}`);assert.ok(locations[target].connections.includes(id),`${id} -> ${target} is not reciprocal`);}
  }
  const reached=new Set(['vaelthar_city']),queue=['vaelthar_city'];
  while(queue.length){for(const target of locations[queue.shift()].connections)if(!reached.has(target)){reached.add(target);queue.push(target);}}
  for(const id of CHAPTER_ONE_ZONE_IDS)assert.ok(reached.has(id),`${id} is unreachable from Vaelthar`);
});

test('all authored production assets exist and every placement stays inside its playable zone',async()=>{
  const[{CHAPTER_ONE_LOCATION_PLANS},{PRODUCTION_ASSETS},{interiorDefinitionFor}]=await Promise.all([
    import('../site/world3d/chapter-one-location-plans.mjs'),import('../site/world3d/production-assets.mjs'),import('../site/world3d/interior-registry.mjs'),
  ]);
  for(const[id,plan]of Object.entries(CHAPTER_ONE_LOCATION_PLANS)){
    const interior=interiorDefinitionFor(id),limitX=interior?interior.size[0]/2-.35:21,limitZ=interior?interior.size[2]/2-.35:21;
    for(const prop of plan.props){assert.ok(Math.abs(prop.x)<=limitX,`${id}:${prop.kind} leaves X bounds`);assert.ok(Math.abs(prop.z)<=limitZ,`${id}:${prop.kind} leaves Z bounds`);}
    for(const placement of plan.assets||[]){
      const relative=PRODUCTION_ASSETS[placement.id];assert.ok(relative,`${id} references unknown ${placement.id}`);
      const file=path.join(project,'site',relative);assert.ok(fs.existsSync(file),`${id}:${placement.id} is missing`);
      const header=fs.readFileSync(file).subarray(0,4).toString('ascii');assert.equal(header,'glTF',`${id}:${placement.id} is not a valid GLB`);
      assert.ok(Math.abs(placement.x)<=21,`${id}:${placement.id} has an unreachable X anchor`);
      assert.ok(Math.abs(placement.z)<=21,`${id}:${placement.id} has an unreachable Z anchor`);
    }
  }
});

test('every interior has a reachable parent route, physical exit, hotspots, and a checkpoint-safe return',async()=>{
  const[{INTERIOR_LOCATION_IDS,interiorDefinitionFor},locations]=await Promise.all([import('../site/world3d/interior-registry.mjs'),Promise.resolve(worldLocations())]);
  assert.equal(INTERIOR_LOCATION_IDS.length,13);
  for(const id of INTERIOR_LOCATION_IDS){const definition=interiorDefinitionFor(id),location=locations[id];assert.ok(location.connections.includes(definition.returnTo),`${id} cannot return to ${definition.returnTo}`);assert.ok(locations[definition.returnTo].connections.includes(id),`${definition.returnTo} cannot enter ${id}`);assert.equal(definition.hotspots.length,3,`${id} lacks interaction hotspots`);}
  const generic=read('site/world3d/zones/generic-zone.js');assert.match(generic,/id:'interior_exit'/);assert.match(generic,/transitionToWorldLocation\(destination/);
});

test('Aldran gives explicit feedback instead of silently re-rendering an identical scene',()=>{
  const story=read('site/story.js');
  assert.match(story,/else runScene\('aldran_warning_unconfirmed'\)/);
  assert.match(story,/aldran_warning_unconfirmed:/);
  assert.match(story,/Identify the agents, establish trust another way, or commit to protecting Aldran/);
  assert.match(story,/skill:'perception'/);
  assert.match(story,/skill:'persuasion'/);
});

test('the manual playthrough checklist defines clean start and reproducible checkpoints',()=>{
  const checklist=read('docs/CHAPTER_ONE_PLAYTHROUGH.md');
  for(const checkpoint of['C0 — Fresh Arrival','C1 — Vaelthar Evidence','C2 — Regional Leads','C3 — Before Saint Aldric','C4 — Before Varek','C5 — Chapter I Complete'])assert.match(checklist,new RegExp(checkpoint.replace(/[—]/g,'—')));
  for(const location of['Vaelthar','Thornwood Gate','Mol Village','Monastery of Saint Aldric','Merchant Road','Fortress Harren','Ashen Fields','Ashen Tower','Church Archive'])assert.match(checklist,new RegExp(location));
  assert.match(checklist,/offline narration/i);assert.match(checklist,/Claude custom choice/i);assert.match(checklist,/2–4 player/i);
});
