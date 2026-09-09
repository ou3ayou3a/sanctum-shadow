const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Flow=require('../site/physical-quest-flow.js');
test('interaction confirmation stacks above world quest markers',()=>{
 assert.match(fs.readFileSync(require.resolve('../site/world3d.css'),'utf8'),/\.world3d-prompt\{[^}]*z-index:40/);
});
test('archive admission flags unlock reception for returning saves without opening it to strangers',()=>{
 const source=fs.readFileSync(require.resolve('../site/map.js'),'utf8'),start=source.indexOf('const PROGRESS_UNLOCKS ='),end=source.indexOf('window.unlockLocationsByProgress = unlockLocationsByProgress;')+'window.unlockLocationsByProgress = unlockLocationsByProgress;'.length;
 for(const admitted of [false,true]){const locations={church_archive:{locked:true}},window={PhysicalQuestFlow:Flow,sceneState:{flags:admitted?{met_theones:true}:{}}};vm.runInNewContext(source.slice(start,end),{window,WORLD_LOCATIONS:locations});window.unlockLocationsByProgress();assert.equal(locations.church_archive.locked,!admitted);}
 assert.match(source,/window\.travelToWorldLocation = function\(id\)[\s\S]*?unlockLocationsByProgress\(\);[\s\S]*?if\(location.locked\)/);
});
test('base travel does not schedule random ambushes through interior doors',()=>{
 const source=fs.readFileSync(require.resolve('../site/map.js'),'utf8'),body=source.slice(source.indexOf('function travelToLocation(loc) {'),source.indexOf('function queueArrivalScene(sceneId) {'));
 for(const local of [true,false]){const timers=[],from={id:'from',...(local?{parentLocation:'church_archive',physicalEntrance:'entrance_from'}:{})},to={id:'church_archive',name:'Archive',type:'dungeon',danger:4,encounters:['cultist']},context={WORLD_LOCATIONS:{from,church_archive:to},mapState:{currentLocation:'from'},document:{getElementById:()=>null},closeOverlay(){},unlockLocationsByProgress(){},addLog(){},LOCATION_DESCRIPTIONS_TRAVEL:{},setTimeout:(fn,ms)=>timers.push(ms),Math:Object.assign(Object.create(Math),{random:()=>0})};context.window=context;const travel=vm.runInNewContext(body+'\ntravelToLocation',context);travel(to);assert.equal(timers.includes(2200),!local);}
});
function fixture(){
 const root={SCENES:{},sceneState:{flags:{met_theones:true}},gameState:{activeQuests:[{id:'c1q19'}]},document:{body:{classList:{contains:()=>true}}},PhysicalQuestFlow:Flow,xp:0,holy:0,addLog(){},npcAbsent:()=>false};root.window=root;root.getFlag=k=>root.sceneState.flags[k];root.setFlag=(k,v=true)=>root.sceneState.flags[k]=v;root.grantXP=n=>root.xp+=n;root.grantHolyPoints=n=>root.holy+=n;
 const engine=root.__world3d={zone:{id:'archive_scriptorium',interactables:Object.keys(Flow.TARGETS).map(id=>({id}))},physicalContext:'archive_chancery_register',hasPhysicalInteraction:id=>engine.physicalContext===id,physicalReach:()=>true,toast(){}};let scene;
 root.runScene=id=>{scene=null;if(!Flow.requireScene(root,id))return false;scene=root.SCENES[id]();return !!scene;};vm.runInNewContext(fs.readFileSync(require.resolve('../site/story-extra-finale.js'),'utf8'),root);
 return{root,engine,flags:root.sceneState.flags,scene:()=>scene,open:id=>root.runScene(id),at(id,scene){engine.zone.id=Flow.TARGETS[id].location;engine.physicalContext=id;return root.runScene(scene||Flow.nextScene(id,root.sceneState,root.gameState));},rubric(){engine.zone.id='church_archive';engine.physicalContext='npc:head_archivist_theones';return root.runScene('chancery_rubric_rehearsal');}};
}
test('Chancery index routes to distinct document and copy desks without remote checks',()=>{
 const f=fixture();f.open('chancery_records_room');assert.equal(f.scene().options.some(o=>o.roll),false);f.scene().options[0].action();assert.equal(f.scene(),null);assert.equal(f.flags.clue_author_signed_with_cross,undefined);f.at('chancery_first_covenant');assert.equal(f.scene().options[0].roll.dc,13);f.scene().options[0].onSuccess();assert.equal(f.flags.clue_author_signed_with_cross,true);
});
test('failed catalogue check still retrieves the original at its physical case',()=>{
 const f=fixture();f.at('chancery_first_covenant');f.scene().options[0].onFail();assert.equal(f.flags.clue_author_signed_with_cross,true);assert.equal(f.root.xp,250);
});
test('copy inspection awards once and requires the separate original document',()=>{
 const f=fixture();f.at('chancery_copying_desk');const success=f.scene().options[0].onSuccess;success();success();assert.equal(f.root.xp,90);assert.equal(f.flags.clue_author_signed_with_cross,undefined);assert.equal(f.root.sceneState.physicalSceneRequests.chancery_first_covenant,'covenant_signature_block');f.at('chancery_first_covenant');assert.equal(f.flags.clue_author_signed_with_cross,true);
});
test('document comparison uses existing DCs and waits for Theones in reception',()=>{
 const f=fixture();f.at('chancery_first_covenant');f.scene().options[0].onSuccess();assert.equal(f.scene().options[0].roll.dc,15);const compare=f.scene().options[0].onSuccess;compare();assert.equal(f.flags.clue_rubric_seventh_clause_spoken,undefined);const xp=f.root.xp;compare();assert.equal(f.root.xp,xp);f.rubric();assert.equal(f.flags.clue_rubric_seventh_clause_spoken,true);
});
test('hearing the rubric first cannot bypass reading the signature',()=>{
 const f=fixture();f.rubric();assert.equal(f.open('covenant_author_closed'),false);f.rubric();f.scene().options.at(-1).action();assert.equal(f.flags.covenant_author_known,undefined);assert.equal(f.root.sceneState.physicalSceneRequests.chancery_first_covenant,'chancery_vault_request');
});
test('main Chancery rewards and testimony cannot be repeated',()=>{
 const f=fixture();f.at('chancery_first_covenant');f.scene().options[0].onSuccess();const read=f.scene().options[1].onSuccess;read();let xp=f.root.xp;read();assert.equal(f.root.xp,xp);f.rubric();for(const i of [0,1]){const action=f.scene().options[i].action;action();xp=f.root.xp;action();assert.equal(f.root.xp,xp);}f.scene().options.at(-1).action();assert.equal(f.flags.covenant_author_known,true);const testimony=f.scene().options[2].action;testimony();xp=f.root.xp;testimony();assert.equal(f.root.xp,xp);f.scene().options[0].action();assert.equal(f.engine.zone.id,'church_archive');assert.equal(f.flags.tower_opened,true);
});
test('stale document and NPC callbacks revalidate reach before granting rewards',()=>{
 const f=fixture();f.at('chancery_copying_desk');const read=f.scene().options[0].onSuccess;f.engine.physicalReach=()=>false;read();assert.equal(f.root.xp,0);f.engine.physicalReach=()=>true;f.rubric();const talk=f.scene().options[0].action;f.engine.zone.id='archive_scriptorium';talk();assert.equal(f.flags.theones_told,undefined);
});
test('Mourne page-one visit waits for her actual temple NPC and returns to Theones',()=>{
 const f=fixture();f.flags.clue_author_signed_with_cross=true;f.rubric();f.scene().options.find(o=>o.label.includes('Sister Mourne')).action();assert.equal(f.flags.mourne_read_page_one,undefined);f.at('npc:sister_mourne');assert.equal(f.flags.mourne_read_page_one,true);const talk=f.scene().options[0].action;talk();const xp=f.root.xp;talk();assert.equal(f.root.xp,xp);f.scene().options.at(-1).action();assert.equal(f.flags.covenant_author_known,undefined);f.at('npc:head_archivist_theones');assert.equal(f.flags.covenant_author_known,true);
});
test('absent Mourne queues her empty rooms and never requires a living NPC',()=>{
 const f=fixture();f.flags.clue_rubric_seventh_clause_spoken=true;f.flags.clue_author_signed_with_cross=true;f.root.npcAbsent=()=>true;assert.equal(f.open('mourne_page_one'),false);assert.equal(f.flags.mourne_read_page_one,undefined);assert.equal(f.root.sceneState.physicalSceneRequests.mourne_empty_rooms,'mourne_page_one_absent');f.at('mourne_empty_rooms');const action=f.scene().options[0].action;action();const xp=f.root.xp;action();assert.equal(f.root.xp,xp);assert.match(fs.readFileSync(require.resolve('../site/story.js'),'utf8'),/sceneId==='mourne_page_one_absent'/);
});
test('Varek only appears when reachable and his optional rewards cannot be farmed',()=>{
 const f=fixture();f.flags.clue_rubric_seventh_clause_spoken=true;f.flags.clue_author_signed_with_cross=true;assert.equal(f.open('varek_first_page'),false);f.flags.chapter1_finale=true;f.at('npc:elder_varek','varek_first_page');for(const index of [0,1,2]){const option=f.scene().options[index],fn=option.action||option.onSuccess;fn();const xp=f.root.xp,holy=f.root.holy;fn();assert.equal(f.root.xp,xp);assert.equal(f.root.holy,holy);}f.flags.npc_dead_elder_varek=true;assert.equal(f.open('varek_first_page'),false);assert.equal(Flow.npcStage('elder_varek','monastery_aldric',f.root.sceneState).active,false);
});
test('absent NPC fates remove Mourne and Varek from their physical staging',()=>{
 for(const fate of ['dead','arrested','fled']){assert.equal(Flow.npcStage('sister_mourne','temple_quarter',{flags:{npc_fate_sister_mourne:fate}}).active,false);assert.equal(Flow.npcStage('elder_varek','monastery_aldric',{flags:{chapter1_finale:true,npc_fate_elder_varek:fate}}).active,false);}
});
