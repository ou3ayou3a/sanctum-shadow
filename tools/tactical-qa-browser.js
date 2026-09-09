// Test fixtures and diagnostics only; served by tools/tactical-qa-server.cjs.
window.addEventListener('load',()=>{
 const panel=document.createElement('div');panel.style.cssText='position:fixed;top:90px;left:320px;z-index:999999;background:#fff;color:#000;padding:8px';
 panel.innerHTML='<label>QA location <select><option value="vaelthar_city">City</option><option value="tarnished_cup">Tavern</option><option value="thornwood_gate">Wilderness</option><option value="mol_village">Mol quest interactions</option></select></label> <button>Load QA world</button> <button>Start QA combat</button><pre>Local fixture — not a campaign playthrough</pre>';
 document.body.append(panel);panel.style.width='370px';const [load,fight]=panel.querySelectorAll('button'),status=panel.querySelector('pre');status.style.cssText='max-height:120px;overflow:auto;white-space:pre-wrap;font-size:11px';
 const toggle=document.createElement('button');toggle.textContent='Hide QA controls';toggle.style.cssText='position:fixed;top:65px;left:320px;z-index:999999';document.body.append(toggle);toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.textContent=panel.hidden?'Show QA controls':'Hide QA controls';};
 const sermonOption=document.createElement('option');sermonOption.value='mol_sermon';sermonOption.textContent='Mol funeral and sermon';panel.querySelector('select').append(sermonOption);
 const roadOption=document.createElement('option');roadOption.value='merchant_road';roadOption.textContent='Merchant road investigation';panel.querySelector('select').append(roadOption);
 const cellarOption=document.createElement('option');cellarOption.value='monastery_cellar';cellarOption.textContent='Monastery cellar interactions';panel.querySelector('select').append(cellarOption);
 const depthsOption=document.createElement('option');depthsOption.value='monastery_depths';depthsOption.textContent='Monastery depths (post-skeleton fixture)';panel.querySelector('select').append(depthsOption);
 const harrenOption=document.createElement('option');harrenOption.value='fortress_harren';harrenOption.textContent='Harren fortress interactions';panel.querySelector('select').append(harrenOption);
 const archiveOption=document.createElement('option');archiveOption.value='church_archive';archiveOption.textContent='Archive reception interactions';panel.querySelector('select').append(archiveOption);
 const fourOption=document.createElement('option');fourOption.value='archive_level_four';fourOption.textContent='Archive Level Four (admitted fixture)';panel.querySelector('select').append(fourOption);
 const caelOption=document.createElement('option');caelOption.value='monastery_cael';caelOption.textContent='Brother Cael (completed archive fixture)';panel.querySelector('select').append(caelOption);
 const voiceOption=document.createElement('option');voiceOption.value='archive_voice_hatch';voiceOption.textContent='Archive Voice (hatch fixture)';panel.querySelector('select').append(voiceOption);
 const chanceryOption=document.createElement('option');chanceryOption.value='archive_scriptorium';chanceryOption.textContent='Chancery records (admitted fixture)';panel.querySelector('select').append(chanceryOption);
 const towerOption=document.createElement('option');towerOption.value='tower_antechamber';towerOption.textContent='Tower officers (recruited fixture)';panel.querySelector('select').append(towerOption);
 const towerFight=document.createElement('button');towerFight.textContent='Start Tower final-blow fixture (1 HP)';panel.insertBefore(towerFight,status);
 towerFight.onclick=()=>{try{if(window.__world3d?.zone?.id!=='tower_antechamber'){status.textContent='Load the Tower fixture first.';return;}window.sceneState.currentScene='tower_thirty_seventh_step';window.sceneState.flags.faced_the_shattered_god=true;startCombat([{...generateEnemy('shattered_god',10),id:'shattered_god',name:'Shattered God — final-blow QA',hp:1,maxHp:500,ac:1,dex:-20,boss:true,xp:2000,spells:[]}],{victoryScene:'tower_ending_sword'});report();}catch(e){status.textContent=e.stack;}};
 const targetSelect=document.createElement('select'),approach=document.createElement('button');targetSelect.setAttribute('aria-label','QA physical target');approach.textContent='Approach QA target';panel.insertBefore(targetSelect,status);panel.insertBefore(approach,status);
 let targetZone=null;const refreshTargets=()=>{const zone=window.__world3d?.zone;if(!zone||zone===targetZone)return;targetZone=zone;targetSelect.replaceChildren();for(const record of zone.interactables){const option=document.createElement('option');option.value=record.id;option.textContent=record.label||record.id;targetSelect.append(option);}};
 approach.onclick=()=>{const engine=window.__world3d,record=engine?.zone?.interactables.find(item=>item.id===targetSelect.value);if(record)engine.goToInteraction(record);};
 const report=()=>{if(status.dataset.error)return;const s=window.combatState,p=s?.combatants?.player;status.textContent=JSON.stringify({location:window.mapState?.currentLocation,active:s?.active,turn:s?.turnOrder?.[s.currentTurnIndex],ap:s?.apRemaining,mp:p?.mp,position:p?.position,rendered:window.__world3d?.actor?.position,spell:s?.selectedSpell?.id,locked:window.__world3d?.combatController?.actionLocked,lastPointer:panel.dataset.pointer},null,1);};
 document.addEventListener('pointerup',e=>{const engine=window.__world3d;let hit=null;if(engine&&e.target.id==='vaelthar-scene'){engine.raycaster.setFromCamera(engine.ndc(e),engine.camera);hit=engine.raycaster.intersectObject(engine.zone.ground,true)[0]?.point;}panel.dataset.pointer=JSON.stringify({x:e.clientX,y:e.clientY,target:e.target.id,hit,scene:!!document.getElementById('scene-panel'),conversation:window.npcConvState?.active,fatal:engine?.health.fatal});});
 load.onclick=async()=>{try{
  if(window.combatState)window.combatState.active=false;window.unloadWorld3D?.();
  Object.assign(window.gameState,{character:{name:'Tactical QA',race:'human',class:'rogue',level:10,hp:300,maxHp:300,mp:300,maxMp:300,holyPoints:100,hellPoints:0,gold:100,xp:0,inventory:['Health Potion'],stats:{str:16,dex:30,con:16,int:16,wis:16,cha:16},skillTrees:['shadowblade'],origin:'war_orphan',revealChoice:'truth'},world3dPositions:{},activeQuests:[],completedQuests:[],questProgress:{}});
  const selection=panel.querySelector('select').value,sermon=selection==='mol_sermon';window.mapState.currentLocation=sermon?'mol_village':selection==='monastery_cael'?'monastery_aldric':selection==='archive_voice_hatch'?'archive_level_four':selection;
  initGameScreen();
  if(selection==='tower_antechamber'){window.resetSceneState();window.activateQuest('c1q20',true);Object.assign(window.sceneState.flags,{tower_door_answered:true,faced_the_shattered_god:true,met_cael_sayer:true,met_theones:true,theones_broke:true,tower_cael_invited:true,tower_theones_invited:true,clue_old_benediction_six_lines:true,clue_eron_inscription:true});}
  if(selection==='monastery_cael'){window.resetSceneState();window.sceneState.flags.clue_aldric_exception=true;window.sceneState.flags.archive_breakin_done=true;window.gameState.completedQuests=[{id:'c1q17'}];}
  if(window.mapState.currentLocation==='thornwood_gate'){window.resetSceneState();window.activateQuest('c1q3',true);}
  if(window.mapState.currentLocation==='merchant_road'){window.resetSceneState();window.activateQuest('c1q4',true);}
  if(window.mapState.currentLocation==='fortress_harren'){window.resetSceneState();window.activateQuest('c1q6',true);}
  if(window.mapState.currentLocation==='church_archive'){window.resetSceneState();window.activateQuest('c1q17',true);}
  if(window.mapState.currentLocation==='archive_scriptorium'){window.resetSceneState();window.activateQuest('c1q19',true);window.sceneState.flags.met_theones=true;}
  if(window.mapState.currentLocation==='archive_level_four'){window.resetSceneState();window.activateQuest(selection==='archive_voice_hatch'?'c1q18':'c1q17',true);window.sceneState.flags.met_theones=true;window.sceneState.flags.archive_breakin_started=true;}
  if(window.mapState.currentLocation==='monastery_cellar'){window.resetSceneState();window.activateQuest('c1q2',true);}
  if(window.mapState.currentLocation==='monastery_depths'){window.resetSceneState();window.activateQuest('c1q2',true);window.sceneState.flags.monastery_first_chamber_cleared=true;window.sceneState.flags.entered_monastery_dungeon=true;}
  if(window.mapState.currentLocation==='mol_village'){
    window.resetSceneState();window.activateQuest('c1q5',true);window.activateQuest('c1q7',true);window.activateQuest('c1q12',true);
    if(sermon)window.activateQuest('c1q15',true);
  }
  showScreen('game');await window.loadWorld3D();report();
 }catch(e){status.dataset.error='true';status.textContent=e.stack;console.error(e);}};
 fight.onclick=()=>{try{startCombat([{id:'qa_guard',name:'QA Guard',hp:500,maxHp:500,ac:12,atk:1,dex:-20,xp:0,spells:[]}],{id:'qa_tactical'});report();}catch(e){status.textContent=e.stack;}};
 setInterval(()=>{report();refreshTargets();},500);
});
