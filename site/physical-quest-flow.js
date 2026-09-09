(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PhysicalQuestFlow=api;})(globalThis,function(){
  'use strict';
  // Only entry/conversation boundaries belong here. A reward scene must never
  // become an independently selectable interaction.
  const TARGETS=Object.freeze({
    'npc:chancery_brask':{location:'ostrene_legation',label:'Confront Under-Officer Brask',position:[0,0,-4.7],scene:'ambassador_chancery_seizure',quest:'c1q8',pendingOnly:true,entrance:'ostrene_legation',npc:{id:'chancery_brask',name:'Under-Officer Brask',title:'Church Chancery',race:'human',classId:'warrior',action:'quest'}},
    'npc:wool_gate_brask':{location:'vaelthar_city',label:'Confront Brask at the wool gate',position:[-1,0,33],scene:'ambassador_chancery_seizure',quest:'c1q8',pendingOnly:true,npc:{id:'wool_gate_brask',dialogueId:'chancery_brask',name:'Under-Officer Brask',title:'Church Chancery',race:'human',classId:'warrior',action:'quest'}},
    ostrene_wool_exhibition:{location:'vaelthar_city',label:'Inspect the Ostrene case at the wool gate',position:[-5,0,34],scene:'ambassador_wool_exhibition',quest:'c1q8',requires:'rane_refused_once',kind:'records'},
    'npc:oret_halven':{location:'ostrene_legation',label:'Speak with Ambassador Halven',position:[-3,0,3.5],scene:'ambassador_bedside',quest:'c1q8',requires:'ambassador_quest_started',entrance:'ostrene_legation',npc:{id:'oret_halven',name:'Ambassador Oret Halven',title:'The Ostrene Legate',race:'human',classId:'mage',action:'quest'}},
    ostrene_chancery_case:{location:'ostrene_legation',label:'Examine Rane’s chancery case',position:[3,0,-3.5],scene:'ambassador_strongbox',quest:'c1q8',pendingOnly:true,kind:'records',entrance:'ostrene_legation'},
    'npc:captain_rhael':{location:'vaelthar_city',label:'Show the Ostrene exemplar to Captain Rhael',position:[3,0,-4.5],scene:'ambassador_rhael_report',quest:'c1q8',pendingOnly:true,npc:{id:'captain_rhael',name:'Captain Rhael',title:'Captain of the Watch',race:'human',classId:'warrior',action:'dialogue'}},
    'npc:tower_cael':{location:'tower_antechamber',label:'Speak with Brother Cael',position:[-2,0,1],scene:'tower_cael_warrant',quest:'c1q20',requires:'tower_cael_invited',entrance:'entrance_tower_antechamber',npc:{id:'tower_cael',dialogueId:'brother_cael',name:'Brother Cael',title:'The Last Sayer',race:'human',classId:'cleric',action:'quest'}},
    'npc:tower_theones':{location:'tower_antechamber',label:'Speak with Head Archivist Theones',position:[2,0,1],scene:'tower_theones_attempt',quest:'c1q20',requires:'tower_theones_invited',entrance:'entrance_tower_antechamber',npc:{id:'tower_theones',dialogueId:'head_archivist_theones',name:'Head Archivist Theones',title:'Presiding Officer',race:'human',classId:'mage',action:'quest'}},
    tower_sealed_door:{location:'tower_ash',label:'Inspect the Tower door',position:[0,0,-6],scene:'tower_ash_approach',quest:'c1q20',kind:'stone'},
    tower_last_step:{location:'tower_antechamber',label:'Approach the sealed stair',position:[0,0,3.5],scene:'tower_thirty_seventh_step',quest:'c1q20',kind:'stone',entrance:'entrance_tower_antechamber'},
    chancery_first_covenant:{location:'archive_scriptorium',label:'Retrieve the First Covenant',position:[-2.5,0,2],scene:'chancery_vault_request',quest:'c1q19',kind:'records',entrance:'entrance_archive_scriptorium'},
    chancery_copying_desk:{location:'archive_scriptorium',label:'Inspect the unfinished copies',position:[0,0,-.5],scene:'chancery_copying_desk',quest:'c1q19',kind:'records',entrance:'entrance_archive_scriptorium'},
    'npc:sister_mourne':{location:'temple_quarter',label:'Show page one to Sister Mourne',position:[0,0,2.5],scene:'mourne_page_one',quest:'c1q19',pendingOnly:true,entrance:'interior_exit',npc:{id:'sister_mourne',name:'Sister Mourne',title:'The Candle · Inquisitor',race:'human',classId:'cleric',action:'dialogue'}},
    mourne_empty_rooms:{location:'temple_quarter',label:'Look for Sister Mourne',position:[3,0,0],scene:'mourne_page_one_absent',quest:'c1q19',pendingOnly:true,kind:'records',entrance:'interior_exit'},
    'npc:elder_varek':{location:'monastery_aldric',label:'Show page one to Elder Varek',position:[-5,0,0],scene:'varek_first_page',quest:'c1q19',pendingOnly:true,npc:{id:'elder_varek',name:'Elder Varek',title:'Elder of the Eternal Flame',race:'human',classId:'cleric',action:'quest'}},
    archive_chancery_register:{location:'archive_scriptorium',label:'Inspect the Chancery records',position:[-2.5,0,-1],scene:'chancery_records_room',quest:'c1q19',kind:'records',entrance:'entrance_archive_scriptorium'},
    archive_hatch:{location:'archive_level_four',label:'Inspect the foundation hatch',position:[-3,0,-2],scene:'archive_lowest_level',quest:'c1q18',kind:'stone',entrance:'entrance_archive_level_four'},
    archive_sixth_stone:{location:'archive_foundation',label:'Listen at the Sixth Stone',position:[0,0,3],scene:'archive_voice_names',quest:'c1q18',kind:'stone',entrance:'entrance_archive_foundation'},
'npc:brother_cael':{location:'monastery_aldric',label:'Speak with Brother Cael',position:[3,0,3],scene:'cael_the_last_sayer',quest:'c1q17',quests:['c1q17','c1q20'],entrance:'interior_exit',pendingOnly:true,npc:{id:'brother_cael',name:'Brother Cael',title:'The Last Sayer',race:'human',classId:'cleric',action:'quest'}},
    archive_four_landing:{location:'archive_level_four',label:'Survey the Level Four reading room',position:[0,0,-4],scene:'archive_level_four',quest:'c1q17',kind:'records',entrance:'entrance_archive_level_four'},
    archive_standing_press:{location:'archive_level_four',label:'Inspect the standing-file press',position:[-3,0,2],scene:'archive_standing_press',quest:'c1q17',requires:'reached_archive_level_four',kind:'records',entrance:'entrance_archive_level_four'},
    archive_minutes_press:{location:'archive_level_four',label:'Read the founders’ minute book',position:[3,0,2],scene:'archive_founders_minutes',quest:'c1q17',requires:'reached_archive_level_four',kind:'records',entrance:'entrance_archive_level_four'},
    archive_floor_stone:{location:'archive_level_four',label:'Examine the stone beneath the archive',position:[0,0,4],scene:'archive_stone_listen',quest:'c1q17',requires:'reached_archive_level_four',kind:'stone',entrance:'entrance_archive_level_four'},
    'npc:archive_admissions_deacon':{location:'church_archive',label:'Speak with the archive admissions deacon',position:[-2.8,0,-2],scene:'church_archive_breakin',quest:'c1q17',npc:{id:'archive_admissions_deacon',name:'Archive Deacon',title:'Admissions and Access Writs',race:'human',classId:'cleric',action:'quest'}},
    'npc:head_archivist_theones':{location:'church_archive',label:'Speak with Head Archivist Theones',position:[2.8,0,-2],scene:'archive_theones_desk',quest:'c1q17',quests:['c1q17','c1q18','c1q19','c1q20'],entrance:'interior_exit',requires:'met_theones',npc:{id:'head_archivist_theones',name:'Head Archivist Theones',title:'Keeper of the Buried Texts',race:'human',classId:'mage',action:'quest'}},
    archive_wine_hollow:{location:'archive_scriptorium',label:'Inspect the hollow wine shelves',position:[0,0,-1.5],scene:'archive_wine_passage',quest:'c1q17',requires:'archive_breakin_started',kind:'records',entrance:'entrance_archive_scriptorium'},
    harren_field_order:{location:'harren_hall',label:'Search Harren’s field orders',position:[0,0,0],scene:'harren_field_order',quest:'c1q6',requires:'harren_dead',kind:'records',entrance:'entrance_harren_hall'},
    harren_gate_notice:{location:'fortress_harren',label:'Read Harren’s gate notice',position:[0,0,-3],scene:'fortress_harren_arrival',quest:'c1q6',kind:'records'},
    'npc:sir_harren':{location:'fortress_harren',label:'Speak with Sir Harren',position:[-3,0,2],scene:'harren_confession',quest:'c1q6',requires:'harren_opened_door',npc:{id:'sir_harren',name:'Sir Harren',title:'The Forsaken Paladin',race:'human',classId:'paladin',action:'quest'}},
    'npc:commander_vael':{location:'fortress_harren',label:'Confront Commander Vael',position:[3,0,9],scene:'harren_order_arrives',quest:'c1q6',pendingOnly:true,npc:{id:'commander_vael',name:'Commander Vael',title:'The Order’s Ultimatum',race:'human',classId:'paladin',action:'quest'}},
    monastery_voice:{location:'monastery_depths',label:'Approach the Voice Below',position:[0,0,2],scene:'monastery_deep_chamber',quest:'c1q2',kind:'stone',entrance:'entrance_monastery_depths'},
    monastery_binding_circle:{location:'monastery_depths',label:'Inspect the broken binding circle',position:[0,0,6],scene:'voice_runes_inspect',quest:'c1q2',kind:'records',entrance:'entrance_monastery_depths'},
    monastery_depths_entry:{location:'monastery_cellar',label:'Inspect the passage into the lower depths',position:[0,0,-4],scene:'monastery_dungeon_entry',quest:'c1q2',kind:'stone',entrance:'entrance_monastery_cellar'},
    monastery_first_altar:{location:'monastery_cellar',label:'Approach the cracked altar and journal',position:[0,0,4],scene:'monastery_first_chamber',quest:'c1q2',requires:'entered_monastery_dungeon',kind:'records',entrance:'entrance_monastery_cellar'},
    'npc:recovering_monastery_monk':{location:'monastery_aldric',label:'Speak with the recovering monk',position:[-3,0,3],scene:'monastery_recovered_monk',quest:'c1q2',pendingOnly:true,entrance:'interior_exit',npc:{id:'recovering_monastery_monk',name:'Recovering Monk',title:'The Silence Has Returned',race:'human',classId:'cleric',action:'quest'}},
    merchant_caravan:{location:'merchant_road',label:'Inspect the abandoned caravan',position:[3,0,-7],scene:'merchant_road_investigation',quest:'c1q4',kind:'chest'},
    merchant_ritual_bodies:{location:'merchant_road',label:'Examine the ritual remains',position:[0,0,1],scene:'merchant_road_bodies',quest:'c1q4',requires:'merchant_road_quest_started',kind:'stone'},
    'npc:merchant_road_survivor':{location:'merchant_road',label:'Speak with the caravan survivor',position:[-3,0,4],scene:'merchant_road_survivor',quest:'c1q4',requires:'merchant_road_quest_started',npc:{id:'merchant_road_survivor',name:'Caravan Survivor',title:'Witness to the Attack',race:'human',classId:'ranger',action:'quest'}},
    'npc:merchant_cultist_leader':{location:'merchant_road',label:'Confront the cultist leader',position:[3,0,-3],scene:'merchant_road_ambush',quest:'c1q4',pendingOnly:true,npc:{id:'merchant_cultist_leader',name:'Cultist Leader',title:'The Elder’s Ambush',race:'human',classId:'cleric',action:'quest'}},
    'npc:mira_cartographer':{location:'thornwood_gate',label:'Speak with Mira',position:[-3,0,3],scene:'cartographer_missing',quest:'c1q3',entrance:'thornwood_gate_path',npc:{id:'mira_cartographer',name:'Mira',title:'Searching for Edden',race:'human',classId:'ranger',action:'quest'}},
    thornwood_satchel:{location:'thornwood_passage',label:'Inspect Edden’s fallen maps',position:[3,0,3],scene:'thornwood_search',quest:'c1q3',requires:'cartographer_quest_started',kind:'records',entrance:'thornwood_forest_path'},
    'npc:edden_cartographer':{location:'thornwood_passage',label:'Speak with Edden at his shelter',position:[-3,0,-5],scene:'cartographer_found',quest:'c1q3',requires:'cartographer_quest_started',entrance:'thornwood_forest_path',npc:{id:'edden_cartographer',name:'Edden',title:'The Missing Cartographer',race:'human',classId:'ranger',action:'quest'}},
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
    mol_funeral_cart:{location:'mol_village',label:'Inspect Aldran’s funeral bier',position:[0,0,-4],scene:'mol_true_sermon_arrival',quest:'c1q15',kind:'bier'},
    'npc:elder_mosswick':{location:'mol_village',label:'Speak with Elder Mosswick and the congregation',position:[3,0,-3],scene:'mol_congregation_remains',quest:'c1q15',requires:'mol_true_sermon_started',npc:{id:'elder_mosswick',name:'Elder Mosswick',title:'The Bereaved Congregation',race:'human',classId:'ranger',action:'quest'}},
    'npc:screaming_preacher':{location:'mol_village',label:'Speak with Brother Lect',position:[0,0,-6],scene:'lect_preaches_over_body',quest:'c1q15',requires:'mol_true_sermon_started',npc:{id:'screaming_preacher',name:'Brother Lect',title:'The Second Sermon',race:'human',classId:'cleric',action:'quest'}},
  });
  const SCENES=Object.freeze({
    ambassador_chancery_seizure:'npc:chancery_brask',
    ambassador_wool_exhibition:'ostrene_wool_exhibition',ambassador_rane_refuses:'ostrene_chancery_case',
    ambassador_bedside:'npc:oret_halven',ambassador_poison_check:'npc:oret_halven',ambassador_last_words:'npc:oret_halven',ambassador_dies_silent:'npc:oret_halven',ambassador_strongbox:'ostrene_chancery_case',
    ambassador_rhael_report:'npc:captain_rhael',
    tower_invite_cael:'npc:brother_cael',tower_invite_theones:'npc:head_archivist_theones',tower_cael_warrant:'npc:tower_cael',tower_theones_attempt:'npc:tower_theones',tower_charter_seal:'tower_last_step',
    tower_ash_approach:'tower_sealed_door',tower_thirty_seventh_step:'tower_last_step',tower_speak_his_name:'tower_last_step',tower_name_without_name:'tower_last_step',tower_charter_officer:'tower_last_step',
    chancery_vault_request:'chancery_first_covenant',covenant_signature_block:'chancery_first_covenant',chancery_copying_desk:'chancery_copying_desk',chancery_rubric_rehearsal:'npc:head_archivist_theones',covenant_author_closed:'npc:head_archivist_theones',mourne_page_one:'npc:sister_mourne',mourne_page_one_absent:'mourne_empty_rooms',varek_first_page:'npc:elder_varek',
    chancery_records_room:'archive_chancery_register',
    archive_lowest_level:'archive_hatch',archive_voice_names:'archive_sixth_stone',archive_voice_asks_name:'archive_sixth_stone',archive_voice_the_name:'archive_sixth_stone',archive_voice_told_name:'archive_sixth_stone',archive_voice_ascent:'npc:head_archivist_theones',
    cael_the_last_sayer:'npc:brother_cael',
    archive_charter_search:'archive_minutes_press',
    archive_level_four:'archive_four_landing',archive_standing_press:'archive_standing_press',archive_aldric_exception:'archive_standing_press',archive_founders_minutes:'archive_minutes_press',archive_stone_listen:'archive_floor_stone',archive_stone_wake:'archive_floor_stone',archive_delivered_minutes:'npc:head_archivist_theones',archive_theones_aldric:'npc:head_archivist_theones',archive_theones_minutes:'npc:head_archivist_theones',archive_c1q17_end:'npc:head_archivist_theones',
    church_archive_breakin:'npc:archive_admissions_deacon',archive_theones_desk:'npc:head_archivist_theones',archive_wine_passage:'archive_wine_hollow',
    harren_field_order:'harren_field_order',
    fortress_harren_arrival:'harren_gate_notice',harren_opens_door:'harren_gate_notice',harren_refuses_order:'harren_gate_notice',harren_confession:'npc:sir_harren',harren_hesitates:'npc:sir_harren',harren_forced_entry:'npc:sir_harren',harren_joins:'npc:sir_harren',harren_order_arrives:'npc:commander_vael',
    monastery_deep_chamber:'monastery_voice',voice_below_speaks:'monastery_voice',voice_binding_option:'monastery_voice',voice_runes_inspect:'monastery_binding_circle',voice_weakness_found:'monastery_binding_circle',voice_willing_ritual:'monastery_binding_circle',
    monastery_dungeon_entry:'monastery_depths_entry',monastery_first_chamber:'monastery_first_altar',monastery_recovered_monk:'npc:recovering_monastery_monk',
    merchant_road_investigation:'merchant_caravan',merchant_road_bodies:'merchant_ritual_bodies',merchant_road_survivor:'npc:merchant_road_survivor',merchant_road_ambush:'npc:merchant_cultist_leader',
    cartographer_missing:'npc:mira_cartographer',thornwood_search:'thornwood_satchel',cartographer_found:'npc:edden_cartographer',cartographer_returned:'npc:mira_cartographer',
    well_that_screams_arrival:'mol_well',well_rope_descent:'mol_well',well_warden_tally:'npc:well_warden_hesk',well_villagers_dismiss:'npc:mol_well_witness',
    well_vigil_night:'mol_well_vigil',
    well_dry_shaft:'mol_well_stone',
    well_cabb_offer:'npc:well_digger_cabb',well_that_screams_capped:'npc:well_digger_cabb',well_hesk_tally_gift:'npc:well_warden_hesk',
    aldran_meeting:'npc:preacher_aldran',aldran_warning_unconfirmed:'npc:preacher_aldran',aldran_shares_intel:'npc:preacher_aldran',aldran_church_soldiers:'npc:preacher_aldran',
    mol_tithe_hook:'mol_tithe_chest',berrick_forgotten_name:'npc:elder_berrick',mol_tithe_last_sayer:'npc:elder_berrick',
    mol_tithe_ledger:'mol_parish_ledger',mol_tithe_ledger_wrong_page:'mol_parish_ledger',mol_tithe_founding_page:'mol_parish_ledger',
    mol_tithe_collector:'npc:mol_tithe_collector',mol_tithe_stone:'mol_second_stone',
    mol_true_sermon_arrival:'mol_funeral_cart',mol_congregation_remains:'npc:elder_mosswick',mol_compare_hymnal:'npc:elder_mosswick',mol_sermon_aftermath:'npc:elder_mosswick',
    lect_preaches_over_body:'npc:screaming_preacher',lect_confronted:'npc:screaming_preacher',lect_hymnal:'npc:screaming_preacher',lect_alley_confession:'npc:screaming_preacher',
  });
  const LECT_ALLEY=Object.freeze([-4,0,-10]);
  function funeralActive(state,game){return !!state?.flags?.mol_true_sermon_started||state?.physicalSceneRequests?.mol_funeral_cart==='mol_true_sermon_arrival'||(game?.activeQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q15')||!!state?.flags?.mol_true_sermon_done;}
  function npcStage(id,location,state,game){
    if(id==='undersecretary_rane'){
      const flags=state?.flags||{},wool=!!flags.rane_refused_once&&!flags.has_ostrene_exemplar&&!flags.chancery_took_exemplar;
      const active=!!flags.ambassador_quest_started&&location===(wool?'vaelthar_city':'ostrene_legation')&&!flags.npc_dead_undersecretary_rane&&!['dead','arrested','fled'].includes(flags.npc_fate_undersecretary_rane);
      return{active,key:'rane:'+wool+':'+active};
    }
    if(['flame_agent_legation_1','flame_agent_legation_2'].includes(id)){
      const flags=state?.flags||{},wool=!!flags.ambassador_seizure_at_wool;
      const leader=npcStage(wool?'wool_gate_brask':'chancery_brask',location,state,game);
      const active=leader.active&&!flags['npc_dead_'+id]&&!['dead','arrested','fled'].includes(flags['npc_fate_'+id]);
      return{active,key:id+':'+wool+':'+active};
    }
    if(id==='chancery_brask'||id==='wool_gate_brask'){
      const flags=state?.flags||{},wool=!!flags.ambassador_seizure_at_wool,active=!!flags.ambassador_seizure_pending&&!flags.has_ostrene_exemplar&&!flags.chancery_took_exemplar&&!flags.npc_dead_chancery_brask&&!['dead','arrested','fled'].includes(flags.npc_fate_chancery_brask)&&location===(wool?'vaelthar_city':'ostrene_legation')&&id===(wool?'wool_gate_brask':'chancery_brask');
      return{active,key:'brask:'+wool+':'+active};
    }
    if(id==='tower_cael'||id==='tower_theones'){
      const cael=id==='tower_cael',base=cael?'brother_cael':'head_archivist_theones',flags=state?.flags||{};
      const active=location==='tower_antechamber'&&!!flags[cael?'tower_cael_invited':'tower_theones_invited']&&!flags.chapter1_complete&&!flags['npc_dead_'+base]&&!flags[cael?'npc_dead_last_monk':'npc_dead_theones']&&!['dead','arrested','fled'].includes(flags['npc_fate_'+base]);
      return {active,key:id+':'+active};
    }
    if(id==='brother_cael'&&state?.flags?.tower_cael_invited&&!state?.flags?.chapter1_complete)return {active:false,key:'cael-at-tower'};
    if(id==='head_archivist_theones'&&state?.flags?.tower_theones_invited&&!state?.flags?.chapter1_complete)return {active:false,key:'theones-at-tower'};
    if(id==='sister_mourne'&&location==='temple_quarter'){const active=!state?.flags?.npc_dead_sister_mourne&&!['dead','arrested','fled'].includes(state?.flags?.npc_fate_sister_mourne);return {active,key:'mourne:'+active};}
    if(id==='elder_varek'&&location==='monastery_aldric'){const active=!!state?.flags?.chapter1_finale&&!state?.flags?.npc_dead_elder_varek&&!['dead','arrested','fled'].includes(state?.flags?.npc_fate_elder_varek);return {active,key:'varek:'+active};}
    if(id==='brother_cael'&&location==='monastery_aldric'){const active=!!state?.flags?.clue_aldric_exception||!!state?.flags?.met_cael_sayer;return {active,key:'cael:'+active};}
    if(id==='head_archivist_theones'&&location==='church_archive'){const active=archiveAdmitted(state);return {active,key:'theones:'+active};}
    if(id==='sir_harren'&&location==='fortress_harren'){const active=!state?.flags?.harren_dead&&(!!state?.flags?.harren_opened_door||!!state?.flags?.harren_hostile||!!state?.flags?.harren_told_truth||!!state?.flags?.harren_ally);return {active,key:'harren:'+active};}
    if(id==='commander_vael'&&location==='fortress_harren'){const active=!state?.flags?.harren_ally&&!state?.flags?.harren_dead&&!state?.flags?.order_stood_down&&(state?.physicalSceneRequests?.['npc:commander_vael']==='harren_order_arrives'||state?.currentScene==='harren_order_arrives');return {active,key:'vael:'+active};}
    if(id==='recovering_monastery_monk'&&location==='monastery_aldric'){const active=!!state?.flags?.monastery_voice_cleared||(game?.completedQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q2');return {active,key:'monk-recovered:'+active};}
    if(['merchant_cultist_leader','merchant_cultist_left','merchant_cultist_right'].includes(id)&&location==='merchant_road'){const done=(game?.completedQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q4'),active=!done&&(!!state?.flags?.merchant_road_ambush_revealed||state?.physicalSceneRequests?.['npc:merchant_cultist_leader']==='merchant_road_ambush'||state?.currentScene==='merchant_road_ambush');return {active,key:'merchant-ambush:'+active};}
    if(id==='edden_reunited'&&location==='thornwood_gate')return {active:!!state?.flags?.cartographer_escort_pending||!!state?.flags?.cartographer_escorted,key:'edden-returned:'+!!state?.flags?.cartographer_escort_pending+':'+!!state?.flags?.cartographer_escorted};
    if(id==='edden_cartographer'&&location==='thornwood_passage')return {active:!state?.flags?.cartographer_escort_pending&&!state?.flags?.cartographer_escorted,key:'edden:'+!!state?.flags?.cartographer_escort_pending+':'+!!state?.flags?.cartographer_escorted};
    const funeral=funeralActive(state,game);
    if(id==='preacher_aldran'&&location==='mol_village')return {active:!funeral,key:'aldran:'+funeral};
    if(id==='elder_mosswick'&&location==='mol_village')return {active:funeral,key:'mosswick:'+funeral};
    if(id!=='screaming_preacher')return null;
    if(location!=='mol_village')return {active:!funeral,key:'lect-away:'+funeral};
    const requests=restoreRequests(state?.physicalSceneRequests),alley=requests['npc:screaming_preacher']==='lect_alley_confession'||(state?.flags?.lect_private_meeting&&!state?.flags?.mol_true_sermon_done&&requests['npc:elder_mosswick']!=='mol_sermon_aftermath');
    return {active:funeral,key:'lect:'+funeral+':'+!!alley,position:alley?LECT_ALLEY:TARGETS['npc:screaming_preacher'].position};
  }
  function sceneTarget(sceneId,locationId){if(sceneId==='ambassador_chancery_seizure'&&locationId==='vaelthar_city')return'npc:wool_gate_brask';if(sceneId==='well_vigil_night'&&locationId==='mol_well_shaft')return'mol_well_deep_vigil';return Object.hasOwn(SCENES,sceneId)?SCENES[sceneId]:null;}
  function restoreRequests(value){const result={};if(!value||typeof value!=='object')return result;for(const [id,scene]of Object.entries(value))if(Object.hasOwn(TARGETS,id)&&sceneTarget(scene,TARGETS[id].location)===id)result[id]=scene;return result;}
  function available(target,game,flags){return !!target&&!target.pendingOnly&&(game?.activeQuests||[]).some(q=>(typeof q==='string'?q:q.id)===target.quest)&&(!target.requires||!!flags?.[target.requires])&&(target.scene!=='well_cabb_offer'||((Number(flags?.well_nights_failed)>=2||Number(flags?.well_nights_transcribed)>=2)&&!flags?.well_capped));}
function nextScene(id,state,game){const target=Object.hasOwn(TARGETS,id)?TARGETS[id]:null;if(!target||(['mol_well_vigil','mol_well_deep_vigil','mol_well_stone'].includes(id)&&state?.flags?.well_capped))return null;if(id==='tower_last_step'&&state?.flags?.chapter1_complete)return ['sword','charter','third_day','uprising','restoration','devour'].some(ending=>state.flags['chapter1_ending_'+ending])?'tower_thirty_seventh_step':null;if(['monastery_voice','monastery_binding_circle'].includes(id)&&monasteryCleared(state,game))return null;if(['harren_gate_notice','npc:sir_harren','npc:commander_vael'].includes(id)){const done=!!state?.flags?.harren_dead||!!state?.flags?.harren_ally||(game?.completedQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q6');if(done)return id==='npc:sir_harren'&&state?.flags?.harren_ally&&!state?.flags?.harren_dead?'harren_joins':null;}if(id==='archive_sixth_stone'&&state?.flags?.heard_the_archive_voice)return state.flags.told_the_voice?'archive_voice_told_name':state.flags.clue_voice_cannot_say_own_name?'archive_voice_asks_name':'archive_voice_names';if(id==='npc:head_archivist_theones'&&(state?.flags?.clue_voice_cannot_say_own_name||state?.flags?.clue_name_cannot_be_held)&&state?.flags?.heard_the_archive_voice&&!state?.flags?.archive_voice_quest_complete&&!state?.physicalSceneRequests?.[id])return 'archive_voice_ascent';if(id==='npc:brother_cael'&&restoreRequests(state?.physicalSceneRequests)[id]==='tower_invite_cael')return 'tower_invite_cael';if(id==='npc:brother_cael'&&npcStage('brother_cael','monastery_aldric',state,game)?.active)return 'cael_the_last_sayer';if(id==='archive_wine_hollow'&&archiveAdmitted(state))return null;const pending=restoreRequests(state?.physicalSceneRequests)[id];if(pending)return pending;if(id==='chancery_first_covenant'&&state?.flags?.clue_author_signed_with_cross)return 'covenant_signature_block';if(id==='npc:head_archivist_theones'&&state?.flags?.clue_author_signed_with_cross&&!state?.flags?.covenant_author_known)return state.flags.clue_rubric_seventh_clause_spoken?'covenant_author_closed':'chancery_rubric_rehearsal';if(id==='npc:head_archivist_theones'&&state?.flags?.archive_breakin_done&&state?.flags?.clue_founders_minutes)return 'archive_c1q17_end';if(id==='archive_floor_stone'&&state?.flags?.archive_breakin_done)return 'archive_stone_wake';if(id==='npc:head_archivist_theones'&&archiveAdmitted(state))return 'archive_theones_desk';if(id==='harren_field_order'&&state?.flags?.harren_dead)return 'harren_field_order';if(id==='npc:sir_harren'&&state?.flags?.harren_hostile)return 'harren_forced_entry';if(id==='npc:sir_harren'&&state?.flags?.harren_told_truth)return 'harren_confession';if(id==='npc:recovering_monastery_monk'&&npcStage('recovering_monastery_monk','monastery_aldric',state,game)?.active)return 'monastery_recovered_monk';if(id==='npc:edden_cartographer'&&state?.flags?.cartographer_found&&!state?.flags?.cartographer_escort_pending&&!state?.flags?.cartographer_escorted)return 'cartographer_found';return available(target,game,state?.flags)?target.scene:null;}
  function canTravel(root,location){
    if(!root.document?.body?.classList.contains('vt-3d-active'))return true;
    const engine=root.__world3d;if(!engine)return !['mol_well_shaft','monastery_depths','archive_level_four','archive_foundation'].includes(location?.id);
    let targetId;
    if(location?.id==='archive_foundation'){
      if(engine.zone.id!=='archive_level_four'||!(root.sceneState?.flags?.archive_hatch_unlocked||root.sceneState?.flags?.heard_the_archive_voice))return false;targetId='entrance_archive_foundation';
    }else if(engine.zone.id==='archive_foundation'){
      if(location?.id!=='archive_level_four')return false;targetId='interior_exit';
    }else if(location?.id==='archive_level_four'){
      if(engine.zone.id!=='archive_scriptorium'||!archiveAdmitted(root.sceneState))return false;targetId='entrance_archive_level_four';
    }else if(engine.zone.id==='archive_level_four'){
      if(location?.id!=='archive_scriptorium')return false;targetId='interior_exit';
    }else if(location?.id==='monastery_depths'){
      if(engine.zone.id!=='monastery_cellar'||!monasteryUnlocked(root.sceneState,root.gameState))return false;
      targetId='entrance_monastery_depths';
    }else if(engine.zone.id==='monastery_depths'){
      if(location?.id!=='monastery_cellar')return false;targetId='interior_exit';
    }else if(location?.id==='mol_well_shaft'){
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
    if(['tower_thirty_seventh_step','tower_speak_his_name','tower_name_without_name','tower_charter_officer'].includes(sceneId)&&root.document?.body?.classList.contains('vt-3d-active')&&!(root.sceneState?.flags?.tower_door_answered||root.sceneState?.flags?.faced_the_shattered_god)){root.runScene?.('tower_ash_approach');return false;}
    if(sceneId==='covenant_author_closed'&&!(root.sceneState?.flags?.clue_author_signed_with_cross&&root.sceneState?.flags?.clue_rubric_seventh_clause_spoken))return false;
    if(['mourne_page_one','mourne_page_one_absent','varek_first_page'].includes(sceneId)&&!(root.sceneState?.flags?.clue_rubric_seventh_clause_spoken&&root.sceneState?.flags?.clue_author_signed_with_cross))return false;
    if(sceneId==='varek_first_page'&&(!root.sceneState?.flags?.chapter1_finale||root.sceneState?.flags?.npc_dead_elder_varek))return false;
    if(sceneId==='mourne_page_one'&&root.npcAbsent?.('sister_mourne')){root.runScene?.('mourne_page_one_absent');return false;}
    if(sceneId==='mourne_page_one_absent'&&!root.npcAbsent?.('sister_mourne'))return false;
    if(sceneId==='archive_voice_ascent'&&(!root.sceneState?.flags?.heard_the_archive_voice||!(root.sceneState?.flags?.clue_voice_cannot_say_own_name||root.sceneState?.flags?.clue_name_cannot_be_held)))return false;
    if(sceneId==='archive_delivered_minutes'&&!root.sceneState?.flags?.archive_minutes_delivered)return false;
    if(['archive_c1q17_end','archive_theones_minutes'].includes(sceneId)&&!root.sceneState?.flags?.clue_founders_minutes)return false;
    if(sceneId==='archive_theones_aldric'&&!root.sceneState?.flags?.clue_aldric_exception)return false;
    if(sceneId==='archive_stone_wake'&&!root.sceneState?.flags?.archive_breakin_done)return false;
    if(sceneId==='archive_wine_passage'&&archiveAdmitted(root.sceneState))return false;
    if(sceneId==='harren_field_order'&&!root.sceneState?.flags?.harren_dead)return false;
    if(sceneId==='harren_joins'&&root.sceneState?.flags?.harren_dead)return false;
    if(['fortress_harren_arrival','harren_opens_door','harren_refuses_order','harren_confession','harren_hesitates','harren_forced_entry','harren_order_arrives'].includes(sceneId)&&(root.sceneState?.flags?.harren_dead||root.sceneState?.flags?.harren_ally||(root.gameState?.completedQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q6')))return false;
    if(['monastery_deep_chamber','voice_below_speaks','voice_binding_option','voice_runes_inspect','voice_weakness_found','voice_willing_ritual'].includes(sceneId)&&monasteryCleared(root.sceneState,root.gameState))return false;
    if(sceneId==='merchant_road_ambush'&&(root.gameState?.completedQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q4')){if(root.sceneState?.physicalSceneRequests)delete root.sceneState.physicalSceneRequests['npc:merchant_cultist_leader'];root.__world3d?.toast?.('The caravan cultists have already been defeated.');return false;}
    if(['well_vigil_night','well_dry_shaft','well_rope_descent'].includes(sceneId)&&root.sceneState?.flags?.well_capped){
      if(root.sceneState.physicalSceneRequests)for(const id of ['mol_well_vigil','mol_well_deep_vigil','mol_well_stone'])delete root.sceneState.physicalSceneRequests[id];
      root.__world3d?.toast?.('The well is capped. The shaft and vigil are no longer accessible.');return false;
    }
    const id=sceneTarget(sceneId,root.__world3d?.zone?.id);if(!id||!root.document?.body?.classList.contains('vt-3d-active'))return true;
    const target=TARGETS[id],engine=root.__world3d,record=engine?.zone?.interactables.find(item=>item.id===id);
    const stage=target.npc?npcStage(target.npc.id,engine?.zone?.id,root.sceneState,root.gameState):null;
    const requiredPosition=sceneId==='lect_alley_confession'?LECT_ALLEY:null;
    const staged=!requiredPosition||(record?.position&&Math.hypot(record.position.x-requiredPosition[0],record.position.z-requiredPosition[2])<.7);
    if(engine?.zone?.id===target.location&&(target.location!=='monastery_depths'||monasteryUnlocked(root.sceneState,root.gameState))&&stage?.active!==false&&staged&&record&&engine.hasPhysicalInteraction?.(id)&&engine.physicalReach?.(record)){
      if(sceneId==='lect_alley_confession')root.sceneState.flags.lect_private_meeting=true;
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
    if(sceneId==='lect_alley_confession')engine&&(engine.physicalContext=null);
    engine?.chronicleAdapter?.refresh?.();
    root.mpBroadcastCampaignState?.('physical_quest_request');
    const place=root.WORLD_LOCATIONS?.[target.location]?.name||target.location.replaceAll('_',' ');
    engine?.toast?.(`${target.location!==engine?.zone?.id?'Travel to '+place+' and find ': 'Find '}${target.label.replace(/^(Speak with|Inspect|Examine|Confront|Approach) /,'')}, then interact to continue.`,4800);
    return false;
  }
  function monasteryCleared(state,game){return !!state?.flags?.voice_bound||!!state?.flags?.monastery_voice_cleared||(game?.completedQuests||[]).some(q=>(typeof q==='string'?q:q.id)==='c1q2');}
  function monasteryUnlocked(state,game){return !!state?.flags?.monastery_first_chamber_cleared||!!state?.flags?.monastery_deep_respite||!!state?.flags?.spoke_with_voice||!!state?.flags?.knows_voice_weakness||!!state?.flags?.voice_agreed_binding||monasteryCleared(state,game);}
  function archiveAdmitted(state){return ['archive_access_granted','archive_entered_by_code','archive_entered_quietly','archive_entered_by_forgery','archive_asked_for_theones','met_theones','reached_archive_level_four','archive_breakin_done'].some(flag=>!!state?.flags?.[flag]);}
  return Object.freeze({TARGETS,SCENES,restoreRequests,available,nextScene,requireScene,sceneTarget,canTravel,npcStage,funeralActive,LECT_ALLEY,monasteryUnlocked,monasteryCleared,archiveAdmitted});
});
