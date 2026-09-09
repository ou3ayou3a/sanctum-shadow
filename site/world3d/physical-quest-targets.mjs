import * as THREE from 'three';

// Reuse the existing well and character assets. No new scenery style or models.
export function preparePhysicalQuestTargets(zone){
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
      const stone=target.kind==='stone',model=new THREE.Mesh(stone?new THREE.BoxGeometry(.9,.9,.65):new THREE.BoxGeometry(1.1,.6,.75),new THREE.MeshStandardMaterial({color:stone?0x716c58:0x4c3422,roughness:1}));
      model.name=id;model.position.set(target.position[0],stone?.45:.3,target.position[2]);model.castShadow=model.receiveShadow=true;model.userData.interactionId=id;zone.root.add(model);
      if(target.kind==='records'){const page=new THREE.Mesh(new THREE.BoxGeometry(.65,.035,.4),new THREE.MeshStandardMaterial({color:0xc7b785,roughness:1}));page.position.set(target.position[0],.63,target.position[2]);page.userData.interactionId=id;zone.root.add(page);}
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
  for(const record of engine.zone.interactables){
    const target=flow.TARGETS[record.id];if(!target)continue;
    const scene=flow.nextScene(record.id,window.sceneState,window.gameState);
    record.actions=[{id:'quest_conversation',direct:true,label:scene?target.label:'Ask about local troubles',onSelect:()=>{
      // Resolve at click time: a stale menu cannot replay a superseded request.
      const next=flow.nextScene(record.id,window.sceneState,window.gameState);
      if(next)window.runScene?.(next);else engine.toast('There is no new lead here yet.');
    }}];
    if(record.id==='mol_well'&&!window.sceneState?.flags?.well_capped&&(window.sceneState?.physicalSceneRequests?.mol_well_stone||window.sceneState?.flags?.well_stone_seen))record.actions.push({id:'descend_well',direct:true,label:'Use the rope and descend into the well',onSelect:()=>engine.transitionToWorldLocation('mol_well_shaft','The Dry Well')});
  }
}
