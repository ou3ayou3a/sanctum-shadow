import * as THREE from 'three';

// Reuse the existing well and character assets. No new scenery style or models.
export function preparePhysicalQuestTargets(zone){
  // Authored rosters may be frozen/shared across visits. Quest staging belongs
  // to this zone instance, never to the imported source roster.
  zone.npcs=(zone.npcs||[]).map(npc=>({...npc,position:Array.isArray(npc.position)?[...npc.position]:npc.position}));
  if(['vaelthar_city','ostrene_legation'].includes(zone.id)){
    const wool=zone.id==='vaelthar_city';
    const extras=[{id:'undersecretary_rane',name:'Undersecretary Rane',title:'Ostrene Chancery',race:'human',classId:'mage',position:[-6.5,0,33],action:'ambient',ambientLine:'The case is exhibited here. Read the first page; I can help you compare it.'},
      ...[1,2].map((number,index)=>({id:'flame_agent_legation_'+number,name:'Flame Agent',title:'Church Chancery Escort',race:'human',classId:'warrior',position:wool?[index? .5:-2.5,0,31.5]:[index?1.8:-1.8,0,-4.7],action:'ambient',ambientLine:'The agent waits for Under-Officer Brask. Speak to him about the warrant.'}))];
    for(const npc of extras){if(npc.id==='undersecretary_rane'&&!wool)continue;if(!zone.npcs.some(record=>record.id===npc.id))zone.npcs.push(npc);}
  }
  if(zone.id==='vaelthar_city'){const door=zone.interactables.find(record=>record.id==='ostrene_legation');if(door)door.actions=[{id:'enter_legation',label:'Enter the Ostrene Legation',direct:true,onSelect:()=>window.__world3d?.transitionToWorldLocation('ostrene_legation','The Ostrene Legation')},...(door.actions||[])];}
  if(zone.id==='merchant_road'){zone.npcs=zone.npcs||[];for(const [id,position]of [['merchant_cultist_left',[1,0,-3]],['merchant_cultist_right',[3,0,-5]]])if(!zone.npcs.some(npc=>npc.id===id))zone.npcs.push({id,name:'Covenant Cultist',title:'Awaiting the Elder’s Orders',race:'human',classId:'cleric',position,action:'ambient',ambientLine:'The cultist watches his leader. Speak to the leader to confront them.'});}
  if(['thornwood_gate','thornwood_passage'].includes(zone.id)){
    const entering=zone.id==='thornwood_gate',id=entering?'thornwood_forest_path':'thornwood_gate_path',destination=entering?'thornwood_passage':'thornwood_gate',label=entering?'Take the path into the Thornwood':'Return along the path to Thornwood Gate';
    const object=new THREE.Mesh(new THREE.BoxGeometry(.3,1.6,.3),new THREE.MeshStandardMaterial({color:0x55412d,roughness:1}));object.position.set(0,.8,entering?-12:12);object.userData.interactionId=id;zone.root.add(object);
    zone.interactables.push({id,label,position:new THREE.Vector3(0,0,object.position.z),range:2.3,object,actions:[{id:'follow_path',label,direct:true,onSelect:()=>window.__world3d?.transitionToWorldLocation(destination,entering?'The Thornwood':'Thornwood Gate')}]});
  }
  if(zone.id==='thornwood_gate'){zone.npcs=zone.npcs||[];if(!zone.npcs.some(npc=>npc.id==='edden_reunited'))zone.npcs.push({id:'edden_reunited',name:'Edden',title:'Home at Last',race:'human',classId:'ranger',position:[-1,0,3],action:'ambient',ambientLine:'Mira has me from here. Thank you for bringing me home.'});}
  const definitions=window.PhysicalQuestFlow?.TARGETS||{};
  for(const [id,target]of Object.entries(definitions)){
    if(target.location!==zone.id)continue;
    if(target.npc){zone.npcs=zone.npcs||[];if(!zone.npcs.some(npc=>npc.id===target.npc.id))zone.npcs.push({...target.npc,position:[...target.position]});continue;}
    const object=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,1.5,12),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
    object.position.set(target.position[0],.75,target.position[2]);object.userData.interactionId=id;zone.root.add(object);
    if(target.singleUseContext){
      const seat=new THREE.Mesh(new THREE.CylinderGeometry(.42,.48,.45,10),new THREE.MeshStandardMaterial({color:0x58412d,roughness:1}));
      seat.name='well-vigil-seat';seat.position.set(target.position[0],.225,target.position[2]);zone.root.add(seat);
    }
    if(target.kind){
      const stone=target.kind==='stone',model=new THREE.Mesh(stone?new THREE.BoxGeometry(.9,.9,.65):target.kind==='bier'?new THREE.BoxGeometry(1,.6,2):new THREE.BoxGeometry(1.1,.6,.75),new THREE.MeshStandardMaterial({color:stone?0x716c58:0x4c3422,roughness:1}));
      model.name=id;model.position.set(target.position[0],stone?.45:.3,target.position[2]);model.castShadow=model.receiveShadow=true;model.userData.interactionId=id;zone.root.add(model);
      if(target.kind==='records'){const page=new THREE.Mesh(new THREE.BoxGeometry(.65,.035,.4),new THREE.MeshStandardMaterial({color:0xc7b785,roughness:1}));page.position.set(target.position[0],.63,target.position[2]);page.userData.interactionId=id;zone.root.add(page);}
      if(target.kind==='bier'){const shroud=new THREE.Mesh(new THREE.BoxGeometry(.7,.25,1.7),new THREE.MeshStandardMaterial({color:0x9a9280,roughness:1}));shroud.name='aldran-funeral-shroud';shroud.position.set(target.position[0],.72,target.position[2]);shroud.userData.interactionId=id;zone.root.add(shroud);}
    }
    zone.interactables.push({id,label:target.label,position:new THREE.Vector3(...target.position),range:2.3,object});
  }
  const origins=window.PartyOriginQuests;
  for(const [origin,site]of Object.entries(origins?.INVESTIGATION_SITES||{})){
    if(origins.ORIGIN_LINES[origin].targetLocation!==zone.id)continue;
    const id=origins.investigationEntityId(origin),stone=site.kind==='stone';
    const object=new THREE.Mesh(stone?new THREE.DodecahedronGeometry(.5,0):new THREE.BoxGeometry(.9,.45,.7),new THREE.MeshStandardMaterial({color:stone?0x716c58:0x4c3422,roughness:1}));
    object.name=id;object.position.set(site.position[0],stone?.3:.225,site.position[2]);object.userData.interactionId=id;object.castShadow=object.receiveShadow=true;zone.root.add(object);
    zone.interactables.push({id,label:site.label,position:new THREE.Vector3(...site.position),range:1.8,object,actions:[],onInteract:()=>window.__world3d?.toast('There is no unresolved personal lead here yet.')});
  }
}

export function refreshPhysicalQuestTargets(engine){
  const flow=window.PhysicalQuestFlow;if(!flow)return;
  if(engine.zone.id==='mol_village')engine.zone.root.traverse(object=>{if(object.userData.interactionId==='mol_funeral_cart')object.visible=flow.funeralActive(window.sceneState,window.gameState)&&(object.name!=='aldran-funeral-shroud'||!window.sceneState?.flags?.mol_true_sermon_done);});
  for(const record of engine.zone.interactables){
    const target=flow.TARGETS[record.id];if(!target)continue;
    const scene=flow.nextScene(record.id,window.sceneState,window.gameState);
    if(record.id==='npc:captain_rhael'&&!scene){record.actions=[];continue;}
    record.actions=[{id:'quest_conversation',direct:true,label:scene?target.label:'Ask about local troubles',onSelect:()=>{
      // Resolve at click time: a stale menu cannot replay a superseded request.
      const next=flow.nextScene(record.id,window.sceneState,window.gameState);
      if(next)window.runScene?.(next);else engine.toast('There is no new lead here yet.');
    }}];
    if(record.id==='mol_well'&&!window.sceneState?.flags?.well_capped&&(window.sceneState?.physicalSceneRequests?.mol_well_stone||window.sceneState?.flags?.well_stone_seen))record.actions.push({id:'descend_well',direct:true,label:'Use the rope and descend into the well',onSelect:()=>engine.transitionToWorldLocation('mol_well_shaft','The Dry Well')});
  }
}
