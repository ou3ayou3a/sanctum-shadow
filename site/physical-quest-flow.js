(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PhysicalQuestFlow=api;})(globalThis,function(){
  'use strict';
  // Only entry/conversation boundaries belong here. A reward scene must never
  // become an independently selectable interaction.
  const TARGETS=Object.freeze({
    mol_well:{location:'mol_village',label:'Inspect the old well',position:[0,0,1],scene:'well_that_screams_arrival',quest:'c1q7'},
    mol_well_vigil:{location:'mol_village',label:'Sit the night vigil beside the well',position:[0,0,4],scene:'well_vigil_night',quest:'c1q7',requires:'well_quest_started',singleUseContext:true},
    mol_well_stone:{location:'mol_well_shaft',label:'Examine the ancient sealing stone',position:[0,0,2.7],scene:'well_dry_shaft',quest:'c1q7',requires:'well_stone_seen',entrance:'mol_well'},
    mol_well_deep_vigil:{location:'mol_well_shaft',label:'Sit the vigil at the sealing stone',position:[2,0,1],scene:'well_vigil_night',quest:'c1q7',requires:'well_stone_seen',singleUseContext:true,entrance:'mol_well'},
    'npc:well_digger_cabb':{location:'mol_village',label:'Speak with Cabb the well-digger',position:[2,0,-2],scene:'well_cabb_offer',quest:'c1q7',requires:'well_quest_started',npc:{id:'well_digger_cabb',name:'Cabb',title:'Well-Digger · Lime and Rubble',race:'human',classId:'warrior',action:'quest'}},
    'npc:well_warden_hesk':{location:'mol_village',label:'Speak with Warden Hesk',position:[-3,0,1],scene:'well_warden_tally',quest:'c1q7',requires:'well_quest_started',npc:{id:'well_warden_hesk',name:'Warden Hesk',title:'Keeper of the Well',race:'human',classId:'ranger',action:'quest'}},
    'npc:mol_well_witness':{location:'mol_village',label:'Speak with the well witness',position:[3.5,0,2],scene:'well_villagers_dismiss',quest:'c1q7',requires:'well_quest_started',npc:{id:'mol_well_witness',name:'Well Witness',title:'Remembers the Missing Collector',race:'human',classId:'ranger',action:'quest'}},
    'npc:preacher_aldran':{location:'mol_village',label:'Speak with Preacher Aldran',position:[0,0,-6],scene:'aldran_meeting',quest:'c1q5',requires:'arrived_mol',npc:{id:'preacher_aldran',name:'Preacher Aldran',title:'The Heretic’s Pulpit',race:'human',classId:'cleric',action:'quest'}},
    mol_tithe_chest:{location:'mol_village',label:'Inspect the collection chest',position:[-3,0,7],scene:'mol_tithe_hook',quest:'c1q12',kind:'chest'},
    'npc:elder_berrick':{location:'mol_village',label:'Speak with Elder Berrick',position:[-4,0,3.5],scene:'berrick_forgotten_name',quest:'c1q12',requires:'tithe_quest_started',npc:{id:'elder_berrick',name:'Elder Berrick',title:'Keeper of the Parish Accounts',race:'human',classId:'cleric',action:'quest'}},
    mol_parish_ledger:{location:'mol_village',label:'Read the parish ledger',position:[-5.2,0,3.5],scene:'mol_tithe_ledger',quest:'c1q12',requires:'tithe_quest_started',kind:'records'},
    'npc:mol_tithe_collector':{location:'mol_village',label:'Speak with the tithe collector',position:[3,0,7],scene:'mol_tithe_collector',quest:'c1q12',requires:'tithe_quest_started',npc:{id:'mol_tithe_collector',name:'Parish Collector',title:'Clerk of the Mol Levy',race:'human',classId:'rogue',action:'quest'}},
    mol_second_stone:{location:'mol_village',label:'Examine the Second Stone',position:[0,0,-9],scene:'mol_tithe_stone',quest:'c1q12',requires:'found_second_stone',kind:'stone'},
  });
  const SCENES=Object.freeze({
    well_that_screams_arrival:'mol_well',well_rope_descent:'mol_well',well_warden_tally:'npc:well_warden_hesk',well_villagers_dismiss:'npc:mol_well_witness',
    well_vigil_night:'mol_well_vigil',
    well_dry_shaft:'mol_well_stone',
    well_cabb_offer:'npc:well_digger_cabb',well_that_screams_capped:'npc:well_digger_cabb',well_hesk_tally_gift:'npc:well_warden_hesk',
    aldran_meeting:'npc:preacher_aldran',aldran_warning_unconfirmed:'npc:preacher_aldran',aldran_shares_intel:'npc:preacher_aldran',aldran_church_soldiers:'npc:preacher_aldran',
    mol_tithe_hook:'mol_tithe_chest',berrick_forgotten_name:'npc:elder_berrick',mol_tithe_last_sayer:'npc:elder_berrick',
    mol_tithe_ledger:'mol_parish_ledger',mol_tithe_ledger_wrong_page:'mol_parish_ledger',mol_tithe_founding_page:'mol_parish_ledger',
    mol_tithe_collector:'npc:mol_tithe_collector',mol_tithe_stone:'mol_second_stone',
  });
  function sceneTarget(sceneId,locationId){if(sceneId==='well_vigil_night'&&locationId==='mol_well_shaft')return'mol_well_deep_vigil';return Object.hasOwn(SCENES,sceneId)?SCENES[sceneId]:null;}
  function restoreRequests(value){const result={};if(!value||typeof value!=='object')return result;for(const [id,scene]of Object.entries(value))if(Object.hasOwn(TARGETS,id)&&sceneTarget(scene,TARGETS[id].location)===id)result[id]=scene;return result;}
  function available(target,game,flags){return !!target&&!target.pendingOnly&&(game?.activeQuests||[]).some(q=>(typeof q==='string'?q:q.id)===target.quest)&&(!target.requires||!!flags?.[target.requires])&&(target.scene!=='well_cabb_offer'||((Number(flags?.well_nights_failed)>=2||Number(flags?.well_nights_transcribed)>=2)&&!flags?.well_capped));}
  function nextScene(id,state,game){const target=Object.hasOwn(TARGETS,id)?TARGETS[id]:null;if(!target||(['mol_well_vigil','mol_well_deep_vigil','mol_well_stone'].includes(id)&&state?.flags?.well_capped))return null;const pending=restoreRequests(state?.physicalSceneRequests)[id];if(pending)return pending;return available(target,game,state?.flags)?target.scene:null;}
  function canTravel(root,location){
    if(!root.document?.body?.classList.contains('vt-3d-active'))return true;
    const engine=root.__world3d;if(!engine)return location?.id!=='mol_well_shaft';
    let targetId;
    if(location?.id==='mol_well_shaft'){
      if(root.sceneState?.flags?.well_capped)return false;
      if(!restoreRequests(root.sceneState?.physicalSceneRequests).mol_well_stone&&!root.sceneState?.flags?.well_stone_seen)return false;
      if(engine.zone.id!=='mol_village')return false;targetId='mol_well';
    }else if(engine.zone.id==='mol_well_shaft'){
      if(location?.id!=='mol_village')return false;targetId='well_rope_exit';
    }else return true;
    const record=engine.zone.interactables.find(item=>item.id===targetId);
    return !!record&&engine.hasPhysicalInteraction?.(targetId)&&engine.physicalReach?.(record);
  }
  function requireScene(root,sceneId){
    if(['well_vigil_night','well_dry_shaft','well_rope_descent'].includes(sceneId)&&root.sceneState?.flags?.well_capped){
      if(root.sceneState.physicalSceneRequests)for(const id of ['mol_well_vigil','mol_well_deep_vigil','mol_well_stone'])delete root.sceneState.physicalSceneRequests[id];
      root.__world3d?.toast?.('The well is capped. The shaft and vigil are no longer accessible.');return false;
    }
    const id=sceneTarget(sceneId,root.__world3d?.zone?.id);if(!id||!root.document?.body?.classList.contains('vt-3d-active'))return true;
    const target=TARGETS[id],engine=root.__world3d,record=engine?.zone?.interactables.find(item=>item.id===id);
    if(engine?.zone?.id===target.location&&record&&engine.hasPhysicalInteraction?.(id)&&engine.physicalReach?.(record)){
      if(target.singleUseContext){
        root.sceneState.flags.well_vigil_in_shaft=target.location==='mol_well_shaft';
        // A second night is a new world interaction, never an automatic replay
        // of the scene after resolving the previous night's check.
        engine.physicalContext=null;
        const hour=Number(root.worldClock?.hour);
        if(Number.isFinite(hour)&&hour>=5&&hour<20)root.advanceTime?.(20-hour);
      }
      if(root.sceneState?.physicalSceneRequests)delete root.sceneState.physicalSceneRequests[id];return true;
    }
    if(!root.sceneState)root.sceneState={flags:{}};
    const requests=restoreRequests(root.sceneState.physicalSceneRequests);delete requests[id];
    root.sceneState.physicalSceneRequests={...requests,[id]:sceneId};
    engine?.chronicleAdapter?.refresh?.();
    root.mpBroadcastCampaignState?.('physical_quest_request');
    const place=root.WORLD_LOCATIONS?.[target.location]?.name||target.location.replaceAll('_',' ');
    engine?.toast?.(`${target.location!==engine?.zone?.id?'Travel to '+place+' and find ': 'Find '}${target.label.replace(/^(Speak with|Inspect|Examine) /,'')}, then interact to continue.`,4800);
    return false;
  }
  return Object.freeze({TARGETS,SCENES,restoreRequests,available,nextScene,requireScene,sceneTarget,canTravel});
});
