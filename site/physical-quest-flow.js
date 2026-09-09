(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PhysicalQuestFlow=api;})(globalThis,function(){
  'use strict';
  // Only entry/conversation boundaries belong here. A reward scene must never
  // become an independently selectable interaction.
  const TARGETS=Object.freeze({
    mol_well:{location:'mol_village',label:'Inspect the old well',position:[0,0,1],scene:'well_that_screams_arrival',quest:'c1q7'},
    mol_well_vigil:{location:'mol_village',label:'Sit the night vigil beside the well',position:[0,0,4],scene:'well_vigil_night',quest:'c1q7',requires:'well_quest_started',singleUseContext:true},
    'npc:well_digger_cabb':{location:'mol_village',label:'Speak with Cabb the well-digger',position:[2,0,-2],scene:'well_cabb_offer',quest:'c1q7',requires:'well_quest_started',npc:{id:'well_digger_cabb',name:'Cabb',title:'Well-Digger · Lime and Rubble',race:'human',classId:'warrior',action:'quest'}},
    'npc:well_warden_hesk':{location:'mol_village',label:'Speak with Warden Hesk',position:[-3,0,1],scene:'well_warden_tally',quest:'c1q7',requires:'well_quest_started',npc:{id:'well_warden_hesk',name:'Warden Hesk',title:'Keeper of the Well',race:'human',classId:'ranger',action:'quest'}},
    'npc:mol_well_witness':{location:'mol_village',label:'Speak with the well witness',position:[3.5,0,2],scene:'well_villagers_dismiss',quest:'c1q7',requires:'well_quest_started',npc:{id:'mol_well_witness',name:'Well Witness',title:'Remembers the Missing Collector',race:'human',classId:'ranger',action:'quest'}},
    'npc:preacher_aldran':{location:'mol_village',label:'Speak with Preacher Aldran',position:[0,0,-6],scene:'aldran_meeting',quest:'c1q5',requires:'arrived_mol',npc:{id:'preacher_aldran',name:'Preacher Aldran',title:'The Heretic’s Pulpit',race:'human',classId:'cleric',action:'quest'}},
  });
  const SCENES=Object.freeze({
    well_that_screams_arrival:'mol_well',well_warden_tally:'npc:well_warden_hesk',well_villagers_dismiss:'npc:mol_well_witness',
    well_vigil_night:'mol_well_vigil',
    well_cabb_offer:'npc:well_digger_cabb',well_that_screams_capped:'npc:well_digger_cabb',well_hesk_tally_gift:'npc:well_warden_hesk',
    aldran_meeting:'npc:preacher_aldran',aldran_warning_unconfirmed:'npc:preacher_aldran',aldran_shares_intel:'npc:preacher_aldran',aldran_church_soldiers:'npc:preacher_aldran',
  });
  function restoreRequests(value){const result={};if(!value||typeof value!=='object')return result;for(const [id,scene]of Object.entries(value))if(Object.hasOwn(TARGETS,id)&&SCENES[scene]===id)result[id]=scene;return result;}
  function available(target,game,flags){return !!target&&(game?.activeQuests||[]).some(q=>(typeof q==='string'?q:q.id)===target.quest)&&(!target.requires||!!flags?.[target.requires])&&(target.scene!=='well_cabb_offer'||((Number(flags?.well_nights_failed)>=2||Number(flags?.well_nights_transcribed)>=2)&&!flags?.well_capped));}
  function nextScene(id,state,game){const target=Object.hasOwn(TARGETS,id)?TARGETS[id]:null;if(!target||(id==='mol_well_vigil'&&state?.flags?.well_capped))return null;const pending=restoreRequests(state?.physicalSceneRequests)[id];if(pending)return pending;return available(target,game,state?.flags)?target.scene:null;}
  function requireScene(root,sceneId){
    if(sceneId==='well_vigil_night'&&root.sceneState?.flags?.well_capped){
      if(root.sceneState.physicalSceneRequests)delete root.sceneState.physicalSceneRequests.mol_well_vigil;
      root.__world3d?.toast?.('The well is capped. There is no vigil to sit.');return false;
    }
    const id=Object.hasOwn(SCENES,sceneId)?SCENES[sceneId]:null;if(!id||!root.document?.body?.classList.contains('vt-3d-active'))return true;
    const target=TARGETS[id],engine=root.__world3d,record=engine?.zone?.interactables.find(item=>item.id===id);
    if(engine?.zone?.id===target.location&&record&&engine.hasPhysicalInteraction?.(id)&&engine.physicalReach?.(record)){
      if(target.singleUseContext){
        // A second night is a new world interaction, never an automatic replay
        // of the scene after resolving the previous night's check.
        engine.physicalContext=null;
        const hour=Number(root.worldClock?.hour);
        if(Number.isFinite(hour)&&hour>=5&&hour<20)root.advanceTime?.(20-hour);
      }
      if(root.sceneState?.physicalSceneRequests)delete root.sceneState.physicalSceneRequests[id];return true;
    }
    if(!root.sceneState)root.sceneState={flags:{}};
    root.sceneState.physicalSceneRequests={...restoreRequests(root.sceneState.physicalSceneRequests),[id]:sceneId};
    engine?.chronicleAdapter?.refresh?.();
    engine?.toast?.(`Find ${target.singleUseContext?'the vigil seat beside the well':target.label.replace(/^(Speak with|Inspect) /,'')} in Mol, then interact to continue.`,4800);
    return false;
  }
  return Object.freeze({TARGETS,SCENES,restoreRequests,available,nextScene,requireScene});
});
