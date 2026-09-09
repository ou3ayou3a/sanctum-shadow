const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Flow=require('../site/physical-quest-flow.js');
const {NavigationGrid}=require('../site/navigation-core.js');
const catalog=require('../site/collision-catalog.js');

function harness(){
  let here=null;
  const root={document:{body:{classList:{contains:()=>true}}},sceneState:{flags:{}},
    __world3d:{zone:{id:'mol_village',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},hasPhysicalInteraction:id=>id===here,physicalReach:()=>true,toast(){}}};
  return{root,interact:id=>{here=id;}};
}
test('cross-entity scene transitions wait for the specific NPC and consume their request once reached',()=>{
  const {root,interact}=harness();interact('mol_well');
  assert.equal(Flow.requireScene(root,'well_warden_tally'),false);
  assert.equal(root.sceneState.physicalSceneRequests['npc:well_warden_hesk'],'well_warden_tally');
  interact('npc:mol_well_witness');assert.equal(Flow.requireScene(root,'well_warden_tally'),false);
  interact('npc:well_warden_hesk');assert.equal(Flow.requireScene(root,'well_warden_tally'),true);
  assert.deepEqual(root.sceneState.physicalSceneRequests,{});
});
test('physical conversation requests cannot execute from another zone or through an obstruction',()=>{
  const {root,interact}=harness();interact('npc:preacher_aldran');
  root.__world3d.zone.id='vaelthar_city';assert.equal(Flow.requireScene(root,'aldran_meeting'),false);
  root.__world3d.zone.id='mol_village';root.__world3d.physicalReach=()=>false;
  assert.equal(Flow.requireScene(root,'aldran_meeting'),false);
});
test('new targets expose authored entry scenes, never arbitrary rewards or unchecked success branches',()=>{
  const game={activeQuests:[{id:'c1q5'},{id:'c1q7'}]};
  assert.equal(Flow.nextScene('npc:well_warden_hesk',{flags:{}},game),null);
  assert.equal(Flow.nextScene('npc:well_warden_hesk',{flags:{well_quest_started:true}},game),'well_warden_tally');
  assert.equal(Flow.nextScene('npc:preacher_aldran',{flags:{arrived_mol:true}},game),'aldran_meeting');
  for(const target of Object.values(Flow.TARGETS))assert.doesNotMatch(target.scene,/resolved|protected|shares_intel|reward/);
});
test('save restoration retains only catalogued entity-to-scene pairs',()=>{
  const state=Flow.restoreRequests(JSON.parse('{"npc:well_warden_hesk":"well_warden_tally","mol_well":"well_syllable_resolved","__proto__":"polluted","missing":"aldran_meeting"}'));
  assert.deepEqual(state,{'npc:well_warden_hesk':'well_warden_tally'});
  assert.equal({}.polluted,undefined);
});
test('every physical quest target has a reachable approach using the actual zone collision catalog',()=>{
  for(const [id,target]of Object.entries(Flow.TARGETS)){
    const zone=catalog[target.location],nav=new NavigationGrid({...zone.bounds,obstacles:zone.obstacles,cellSize:.65,padding:.62});
    const start=target.location==='mol_well_shaft'?{x:-2,z:-1.4}:{x:0,z:17};
    const position={x:target.position[0],z:target.position[2]};let reachable=false;
    for(let i=0;i<16;i++){
      const angle=i*Math.PI/8,stop={x:position.x+Math.sin(angle)*1.65,z:position.z+Math.cos(angle)*1.65};
      if(!nav.isPointBlocked(stop)&&nav.findPath(start,stop).length){reachable=true;break;}
    }
    assert.equal(reachable,true,id);
    if(target.npc)assert.equal(nav.isPointBlocked(position),false,`${id} must not stand in scenery`);
  }
});
test('runtime gates scene factories before they can award clues and saves pending physical requests',()=>{
  const story=fs.readFileSync(require.resolve('../site/story.js'),'utf8');
  assert.ok(story.indexOf('PhysicalQuestFlow?.requireScene(window, sceneId)')<story.indexOf('const scene = SCENES[sceneId]'));
  const saves=fs.readFileSync(require.resolve('../site/saves.js'),'utf8');
  assert.match(saves,/physicalSceneRequests: window.PhysicalQuestFlow\?\.restoreRequests/);
  assert.match(saves,/physicalSceneRequests = window.PhysicalQuestFlow\?\.restoreRequests\(slot.physicalSceneRequests\)/);
});

test('quest markers prioritize a pending conversation over a later objective at another location',()=>{
  const source=fs.readFileSync(require.resolve('../site/world3d/chronicle-adapter.js'),'utf8').replace(/^import .*;\s*$/gm,'').replace('export class Chronicle3DAdapter','class Chronicle3DAdapter');
  const record={id:'npc:mol_well_witness',position:{x:3.5,z:2}};
  const prototype=require('node:vm').runInNewContext(source+'\nChronicle3DAdapter.prototype;',{
    window:{PhysicalQuestFlow:Flow,sceneState:{physicalSceneRequests:{'npc:mol_well_witness':'well_villagers_dismiss'}}}
  });
  const adapter=Object.create(prototype);adapter.engine={zone:{interactables:[record]}};
  assert.equal(adapter.targetFor({events:['scene:well_vigil_night']},{id:'c1q7'}).interaction,record);
});
