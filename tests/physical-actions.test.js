const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Physical=require('../site/physical-actions.js');

const entity={id:'npc:rhael',position:{x:2,z:0},range:2.3,zoneId:'city'};
test('physical actions reject distance, wrong zones, unavailable entities and walls',()=>{
  const input={actor:{x:0,z:0},entity,locationId:'city'};
  assert.equal(Physical.assess(input).ok,true);
  assert.equal(Physical.assess({...input,actor:{x:10,z:0}}).reason,'out_of_reach');
  assert.equal(Physical.assess({...input,locationId:'tavern'}).reason,'wrong_location');
  assert.equal(Physical.assess({...input,entity:{...entity,active:false}}).reason,'unavailable_entity');
  assert.equal(Physical.assess({...input,obstacles:[{x:1,z:0,w:.5,d:3}]}).reason,'blocked_interaction');
  assert.equal(Physical.matches({entityId:entity.id,locationId:'city'},entity.id,'city'),true);
  assert.equal(Physical.matches({entityId:entity.id,locationId:'city'},'npc:other','city'),false);
});

function engineHarness(){
  const source=fs.readFileSync(require.resolve('../site/world3d/world-engine.js'),'utf8')
    .replace(/^import .*;\s*$/gm,'').replace('export class WorldEngine','class WorldEngine');
  let resolved=0;
  const prototype=vm.runInNewContext(source+'\nWorldEngine.prototype;',{
    EventTarget,window:{PhysicalActions:Physical,resolveEnvironmentalAction:()=>{resolved++;return{};}}
  });
  const engine=Object.create(prototype);
  Object.assign(engine,{zone:{id:'city'},actor:{position:{x:0,z:0}},toast(){},hidePrompt(){},presentInteraction(){},
    interactionMenu:{hidden:false},customActionInput:{value:'Search the desk',disabled:false}});
  return{engine,resolved:()=>resolved};
}

test('confirmation records explicit interaction; a stale prompt cannot execute remotely',()=>{
  const {engine}=engineHarness();let count=0;
  engine.pendingInteraction={...entity,id:'desk',onInteract:()=>count++};
  engine.confirmInteraction();assert.equal(count,1);assert.equal(engine.physicalContext.entityId,'desk');
  engine.pendingInteraction={...entity,id:'desk',onInteract:()=>count++};
  engine.actor.position.x=20;engine.confirmInteraction();assert.equal(count,1);
  assert.equal(engine.physicalContext,null);
});

test('stale menu and custom actions do not resolve after moving away',async()=>{
  const {engine,resolved}=engineHarness();
  const record={...entity,id:'desk',actions:[{id:'search'}]};
  engine.beginPhysicalInteraction(record);engine.activeInteraction=record;engine.actor.position.x=20;
  await engine.selectInteractionAction(0);assert.equal(resolved(),0);assert.equal(engine.interactionMenu.hidden,true);
  engine.actor.position.x=0;engine.beginPhysicalInteraction(record);engine.activeInteraction=record;engine.actor.position.x=20;
  await engine.submitCustomEnvironmentAction();assert.equal(resolved(),0);
});
