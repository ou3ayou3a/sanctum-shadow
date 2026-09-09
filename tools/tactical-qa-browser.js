// Test fixtures and diagnostics only; served by tools/tactical-qa-server.cjs.
window.addEventListener('load',()=>{
 const panel=document.createElement('div');panel.style.cssText='position:fixed;top:90px;left:320px;z-index:999999;background:#fff;color:#000;padding:8px';
 panel.innerHTML='<label>QA location <select><option value="vaelthar_city">City</option><option value="tarnished_cup">Tavern</option><option value="thornwood_gate">Wilderness</option><option value="mol_village">Mol quest interactions</option></select></label> <button>Load QA world</button> <button>Start QA combat</button><pre>Local fixture — not a campaign playthrough</pre>';
 document.body.append(panel);panel.style.width='370px';const [load,fight]=panel.querySelectorAll('button'),status=panel.querySelector('pre');status.style.cssText='max-height:120px;overflow:auto;white-space:pre-wrap;font-size:11px';
 const sermonOption=document.createElement('option');sermonOption.value='mol_sermon';sermonOption.textContent='Mol funeral and sermon';panel.querySelector('select').append(sermonOption);
 const roadOption=document.createElement('option');roadOption.value='merchant_road';roadOption.textContent='Merchant road investigation';panel.querySelector('select').append(roadOption);
 const targetSelect=document.createElement('select'),approach=document.createElement('button');targetSelect.setAttribute('aria-label','QA physical target');approach.textContent='Approach QA target';panel.insertBefore(targetSelect,status);panel.insertBefore(approach,status);
 let targetZone=null;const refreshTargets=()=>{const zone=window.__world3d?.zone;if(!zone||zone===targetZone)return;targetZone=zone;targetSelect.replaceChildren();for(const record of zone.interactables){const option=document.createElement('option');option.value=record.id;option.textContent=record.label||record.id;targetSelect.append(option);}};
 approach.onclick=()=>{const engine=window.__world3d,record=engine?.zone?.interactables.find(item=>item.id===targetSelect.value);if(record)engine.goToInteraction(record);};
 const report=()=>{if(status.dataset.error)return;const s=window.combatState,p=s?.combatants?.player;status.textContent=JSON.stringify({location:window.mapState?.currentLocation,active:s?.active,turn:s?.turnOrder?.[s.currentTurnIndex],ap:s?.apRemaining,mp:p?.mp,position:p?.position,rendered:window.__world3d?.actor?.position,spell:s?.selectedSpell?.id,locked:window.__world3d?.combatController?.actionLocked,lastPointer:panel.dataset.pointer},null,1);};
 document.addEventListener('pointerup',e=>{const engine=window.__world3d;let hit=null;if(engine&&e.target.id==='vaelthar-scene'){engine.raycaster.setFromCamera(engine.ndc(e),engine.camera);hit=engine.raycaster.intersectObject(engine.zone.ground,true)[0]?.point;}panel.dataset.pointer=JSON.stringify({x:e.clientX,y:e.clientY,target:e.target.id,hit,scene:!!document.getElementById('scene-panel'),conversation:window.npcConvState?.active,fatal:engine?.health.fatal});});
 load.onclick=async()=>{try{
  if(window.combatState)window.combatState.active=false;window.unloadWorld3D?.();
  Object.assign(window.gameState,{character:{name:'Tactical QA',race:'human',class:'rogue',level:10,hp:300,maxHp:300,mp:300,maxMp:300,holyPoints:100,hellPoints:0,gold:100,xp:0,inventory:['Health Potion'],stats:{str:16,dex:30,con:16,int:16,wis:16,cha:16},skillTrees:['shadowblade'],origin:'war_orphan',revealChoice:'truth'},world3dPositions:{},activeQuests:[],completedQuests:[],questProgress:{}});
  const sermon=panel.querySelector('select').value==='mol_sermon';window.mapState.currentLocation=sermon?'mol_village':panel.querySelector('select').value;
  initGameScreen();
  if(window.mapState.currentLocation==='thornwood_gate'){window.resetSceneState();window.activateQuest('c1q3',true);}
  if(window.mapState.currentLocation==='merchant_road'){window.resetSceneState();window.activateQuest('c1q4',true);}
  if(window.mapState.currentLocation==='mol_village'){
    window.resetSceneState();window.activateQuest('c1q5',true);window.activateQuest('c1q7',true);window.activateQuest('c1q12',true);
    if(sermon)window.activateQuest('c1q15',true);
  }
  showScreen('game');await window.loadWorld3D();report();
 }catch(e){status.dataset.error='true';status.textContent=e.stack;console.error(e);}};
 fight.onclick=()=>{try{startCombat([{id:'qa_guard',name:'QA Guard',hp:500,maxHp:500,ac:12,atk:1,dex:-20,xp:0,spells:[]}],{id:'qa_tactical'});report();}catch(e){status.textContent=e.stack;}};
 setInterval(()=>{report();refreshTargets();},500);
});
