(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PhysicalQuestFlow=api;})(globalThis,function(){
  'use strict';
  // Only entry/conversation boundaries belong here. A reward scene must never
  // become an independently selectable interaction.
  const TARGETS=Object.freeze({
    mol_well:{location:'mol_village',label:'Inspect the old well',position:[0,0,1],scene:'well_that_screams_arrival',quest:'c1q7'},
    'npc:well_warden_hesk':{location:'mol_village',label:'Speak with Warden Hesk',position:[-3,0,1],scene:'well_warden_tally',quest:'c1q7',requires:'well_quest_started',npc:{id:'well_warden_hesk',name:'Warden Hesk',title:'Keeper of the Well',race:'human',classId:'ranger',action:'quest'}},
    'npc:mol_well_witness':{location:'mol_village',label:'Speak with the well witness',position:[3.5,0,2],scene:'well_villagers_dismiss',quest:'c1q7',requires:'well_quest_started',npc:{id:'mol_well_witness',name:'Well Witness',title:'Remembers the Missing Collector',race:'human',classId:'ranger',action:'quest'}},
    'npc:preacher_aldran':{location:'mol_village',label:'Speak with Preacher Aldran',position:[0,0,-6],scene:'aldran_meeting',quest:'c1q5',requires:'arrived_mol',npc:{id:'preacher_aldran',name:'Preacher Aldran',title:'The Heretic’s Pulpit',race:'human',classId:'cleric',action:'quest'}},
  });
  const SCENES=Object.freeze({
    well_that_screams_arrival:'mol_well',well_warden_tally:'npc:well_warden_hesk',well_villagers_dismiss:'npc:mol_well_witness',
    aldran_meeting:'npc:preacher_aldran',aldran_warning_unconfirmed:'npc:preacher_aldran',aldran_shares_intel:'npc:preacher_aldran',aldran_church_soldiers:'npc:preacher_aldran',
  });
  function restoreRequests(value){const result={};if(!value||typeof value!=='object')return result;for(const [id,scene]of Object.entries(value))if(Object.hasOwn(TARGETS,id)&&SCENES[scene]===id)result[id]=scene;return result;}
  function available(target,game,flags){return !!target&&(game?.activeQuests||[]).some(q=>(typeof q==='string'?q:q.id)===target.quest)&&(!target.requires||!!flags?.[target.requires]);}
  function nextScene(id,state,game){const target=TARGETS[id];if(!target)return null;const pending=restoreRequests(state?.physicalSceneRequests)[id];if(pending)return pending;return available(target,game,state?.flags)?target.scene:null;}
  function requireScene(root,sceneId){
    const id=SCENES[sceneId];if(!id||!root.document?.body?.classList.contains('vt-3d-active'))return true;
    const target=TARGETS[id],engine=root.__world3d,record=engine?.zone?.interactables.find(item=>item.id===id);
    if(engine?.zone?.id===target.location&&record&&engine.hasPhysicalInteraction?.(id)&&engine.physicalReach?.(record)){
      if(root.sceneState?.physicalSceneRequests)delete root.sceneState.physicalSceneRequests[id];return true;
    }
    if(!root.sceneState)root.sceneState={flags:{}};
    root.sceneState.physicalSceneRequests={...restoreRequests(root.sceneState.physicalSceneRequests),[id]:sceneId};
    engine?.chronicleAdapter?.refresh?.();
    engine?.toast?.(`Find ${target.label.replace(/^(Speak with|Inspect) /,'')} in Mol, then interact to continue.`,4800);
    return false;
  }
  return Object.freeze({TARGETS,SCENES,restoreRequests,available,nextScene,requireScene});
});
