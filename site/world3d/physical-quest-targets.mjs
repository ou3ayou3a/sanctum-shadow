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
    zone.interactables.push({id,label:target.label,position:new THREE.Vector3(...target.position),range:2.3,object});
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
  }
}
