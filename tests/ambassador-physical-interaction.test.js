const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Flow=require('../site/physical-quest-flow.js');
function fixture(){
  const flags={},root={SCENES:{},sceneState:{flags},gameState:{character:{inventory:[]}},PhysicalQuestFlow:Flow,document:{body:{classList:{contains:()=>true}}},addLog(){},grantXP(){},grantHolyPoints(){},grantHellPoints(){}};root.window=root;root.getFlag=k=>flags[k];root.setFlag=(k,v=true)=>flags[k]=v;
  const engine=root.__world3d={zone:{id:'vaelthar_city',interactables:[{id:'npc:captain_rhael'}]},physicalContext:null,hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-children.js'),'utf8'),root);
  root.runScene=id=>{if(!Flow.requireScene(root,id))return false;return root.SCENES[id]();};
  return{root,flags,engine};
}
test('the exemplar handoff queues Rhael instead of narrating a remote conversation',()=>{
  const {root,flags,engine}=fixture();const scene=root.SCENES.ambassador_exemplar_kept();scene.options[0].action();
  assert.equal(flags.rhael_shown_exemplar,undefined);assert.equal(root.sceneState.physicalSceneRequests['npc:captain_rhael'],'ambassador_rhael_report');
  assert.equal(Flow.nextScene('npc:captain_rhael',root.sceneState,{activeQuests:[]}), 'ambassador_rhael_report');
  engine.physicalContext='npc:captain_rhael';const report=root.runScene('ambassador_rhael_report');assert.match(report.narration,/printing decision/);assert.equal(flags.rhael_shown_exemplar,true);
  assert.equal(root.sceneState.physicalSceneRequests['npc:captain_rhael'],undefined);
});
test('Rhael report rejects missing evidence, surrender, absence and lost reach',()=>{
  for(const condition of ['missing','surrendered','absent','remote']){const {root,flags,engine}=fixture();flags.has_ostrene_exemplar=condition!=='missing';flags.chancery_took_exemplar=condition==='surrendered';engine.physicalContext='npc:captain_rhael';if(condition==='remote')engine.physicalReach=()=>false;if(condition==='absent')engine.zone.interactables=[];assert.equal(root.SCENES.ambassador_rhael_report(),null);assert.equal(flags.rhael_shown_exemplar,undefined);}
});
test('pending Rhael handoff survives strict saved-request restoration',()=>{const pending={'npc:captain_rhael':'ambassador_rhael_report'};assert.deepEqual(Flow.restoreRequests(JSON.parse(JSON.stringify(pending))),pending);});
test('Rhael retains his normal conversation when no report is pending',async()=>{const {refreshPhysicalQuestTargets}=await import('../site/world3d/physical-quest-targets.mjs');const original=global.window;try{const record={id:'npc:captain_rhael',actions:[],onInteract:()=>{}};global.window={PhysicalQuestFlow:Flow,sceneState:{flags:{},physicalSceneRequests:{'npc:captain_rhael':'ambassador_rhael_report'}},gameState:{}};const engine={zone:{id:'vaelthar_city',interactables:[record]}};refreshPhysicalQuestTargets(engine);assert.equal(record.actions.length,1);global.window.sceneState.physicalSceneRequests={};refreshPhysicalQuestTargets(engine);assert.equal(record.actions.length,0);assert.equal(typeof record.onInteract,'function');}finally{global.window=original;}});
