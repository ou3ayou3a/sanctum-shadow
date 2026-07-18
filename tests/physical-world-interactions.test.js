const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('a new chronicle starts in free 3D exploration without an opening choice panel',()=>{
  const story=read('site/story.js');
  const additions=read('site/additions.js');
  const start=story.indexOf('function startStoryEngine()');
  const end=story.indexOf('// Patch initGameScreen',start);
  const source=story.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(source,/runScene\(['"]arrival_vaelthar['"]\)/);
  assert.match(source,/processSceneQuestMilestone\(['"]arrival_vaelthar['"]\)/);
  assert.match(source,/sanctum:exploration-started/);
  assert.match(source,/Walk to a person or landmark/);
  assert.doesNotMatch(additions,/showDMStrip\(opening,\s*true\)/);
});

test('3D conversations require the player to approach the physical NPC',()=>{
  const dialogue=read('site/dialogue.js');
  const engine=read('site/world3d/world-engine.js');
  assert.match(dialogue,/classList\.contains\(['"]vt-3d-active['"]\)/);
  assert.match(dialogue,/ensureNearbyNpcInteraction\?\.\(physicalNpcId\)/);
  assert.match(engine,/ensureNearbyNpcInteraction\(npcId,pendingSceneId=null\)/);
  assert.match(engine,/distance<=reach/);
  assert.match(engine,/this\.goToInteraction\(record\.interaction\)/);
  assert.match(engine,/interact to begin the conversation/);
});

test('legacy city dialogue scenes queue on their physical NPC instead of opening remotely',()=>{
  const story=read('site/story.js');
  const engine=read('site/world3d/world-engine.js');
  const manager=read('site/world3d/npc-manager.js');
  const tavern=read('site/world3d/zones/tarnished-cup.js');
  for(const id of['captain_rhael','trembling_scribe','sister_mourne','lyra_innkeeper','drunk_cartographer'])assert.match(story,new RegExp(`npcId:'${id}'`));
  assert.match(story,/requirePhysicalNpcForScene\(sceneId\)/);
  assert.match(story,/_pendingPhysicalNpcScenes/);
  assert.match(story,/Find \$\{rule\.hint\} and interact to continue/);
  assert.match(engine,/record\.pendingSceneId=String\(pendingSceneId\)/);
  assert.match(manager,/sceneId=record\.pendingSceneId\|\|pending\[config\.id\]/);
  assert.match(manager,/pending\[config\.dialogueId\]/);
  assert.match(manager,/window\.runScene\?\.\(sceneId\)/);
  assert.match(tavern,/id:'trembling_scribe'/);
});

test('NPC labels and world clicks route through approach movement before interaction',()=>{
  const manager=read('site/world3d/npc-manager.js');
  assert.match(manager,/label\.addEventListener\(['"]click['"],[\s\S]*?this\.engine\.goToInteraction\(interaction\)/);
  assert.match(manager,/interaction\.onInteract=\(\)=>this\.interact\(record\)/);
  assert.match(manager,/window\.startNPCConversation\?\.\(config\.dialogueId\|\|config\.id\)/);
});
