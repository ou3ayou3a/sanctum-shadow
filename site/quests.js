// Sanctum & Shadow — declarative campaign objective engine.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SanctumQuests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QUEST_ENGINE_VERSION = 1;
  const QUEST_ARCS = Object.freeze({
    c1q1:{ objectives:[
      { id:'arrive', label:'Enter Vaelthar and identify the first leads.', events:['scene:arrival_vaelthar'] },
      { id:'evidence', label:'Find evidence that the Covenant burning was deliberate.', events:['scene:covenant_hall_scene','scene:scribe_gives_document','scene:rhael_reveals_covenant','scene:cupside_evidence_found','combat:victory:cupside_checkpoint'] },
      { id:'locate_varek', label:'Discover that Elder Varek is at Saint Aldric.', events:['scene:scribe_names_varek_location','scene:mourne_reveals_varek'] },
      { id:'confront_varek', label:'Reach the monastery and confront Elder Varek.', events:['scene:monastery_arrival'] },
      { id:'resolve', label:'Decide Elder Varek’s fate.', events:['scene:chapter1_end_arrest','scene:chapter1_end_surrender','scene:chapter1_end_rhael_leads'], completes:true },
    ] },
    c1q2:{ objectives:[
      { id:'enter_depths', label:'Enter the hidden dungeon beneath Saint Aldric.', events:['scene:monastery_dungeon_entry'] },
      { id:'find_voice', label:'Reach the source of the breathing beneath the stones.', events:['scene:monastery_deep_chamber'] },
      { id:'silence_voice', label:'Bind or defeat the Voice Below.', events:['scene:monastery_dungeon_cleared'], completes:true },
    ] },
    c1q3:{ objectives:[
      { id:'accept_search', label:'Learn where Edden vanished in the Thornwood.', events:['scene:cartographer_missing'] },
      { id:'follow_route', label:'Follow Edden’s trail through the Thornwood.', events:['scene:thornwood_search'] },
      { id:'recover_edden', label:'Find Edden and secure his completed map.', events:['scene:cartographer_found'], completes:true },
    ] },
    c1q4:{ objectives:[
      { id:'inspect_caravans', label:'Investigate the ritualized caravan attacks.', events:['scene:merchant_road_investigation'] },
      { id:'face_cultists', label:'Survive the cultist ambush and identify its purpose.', events:['scene:merchant_road_ambush'] },
      { id:'secure_road', label:'Defeat the cultists operating on the Merchant Road.', events:['combat:victory:merchant_road_ambush'], completes:true },
    ] },
    c1q5:{ objectives:[
      { id:'find_aldran', label:'Find the heretic preacher in Mol.', events:['scene:mol_village_arrival','scene:aldran_meeting'] },
      { id:'hear_truth', label:'Learn what Aldran knows about the Covenant.', events:['scene:aldran_shares_intel'] },
      { id:'decide_fate', label:'Protect Aldran or help him escape the Church.', events:['outcome:aldran_protected','outcome:aldran_escaped','combat:victory:aldran_church_soldiers'], completes:true },
    ] },
    c1q6:{ objectives:[
      { id:'reach_fortress', label:'Reach Sir Harren’s fortress.', events:['scene:fortress_harren_arrival'] },
      { id:'hear_confession', label:'Learn why Harren abandoned his vows.', events:['scene:harren_confession','scene:harren_fallen'] },
      { id:'resolve_harren', label:'Resolve the standoff with Sir Harren.', events:['scene:harren_joins','scene:harren_fallen'], completes:true },
    ] },
    c1q7:{ objectives:[
      { id:"reach_well", label:"Reach the well at Mol and find out what it does after dark.", events:["scene:well_that_screams_arrival"] },
      { id:"count_it", label:"Learn what the Well Warden has been counting — and what is at the bottom of the shaft.", events:["scene:well_warden_tally","scene:well_dry_shaft"] },
      { id:"sit_vigil", label:"Sit the vigil and hear the well for yourself.", events:["scene:well_vigil_night"] },
      { id:"resolve_well", label:"Resolve the screaming: transcribe it across three nights, or let Mol cap the well.", events:["scene:well_syllable_resolved","scene:well_that_screams_capped"], completes:true },
    ] },
    c1q8:{ objectives:[
      { id:"meet", label:"Answer the Ostrene legation's summons on Fennow Row.", events:["scene:ambassador_summons"] },
      { id:"confession", label:"Hear Ambassador Halven's confession before he dies.", events:["scene:ambassador_bedside"] },
      { id:"exemplar", label:"Get Ostrene's counterpart exemplar out of the chancery case.", events:["scene:ambassador_strongbox"] },
      { id:"count", label:"Read page one of the Eighth Covenant and count the clauses.", events:["scene:ambassador_seven_clauses"] },
      { id:"resolve", label:"Decide who ends the night holding the only unredacted Covenant in Vaelthar.", events:["scene:ambassador_exemplar_kept","scene:ambassador_exemplar_surrendered"], completes:true },
    ] },
    c1q9:{ objectives:[
      { id:"open_case", label:"Examine the Treasury vault that was never opened.", events:["scene:treasury_rats_arrival"] },
      { id:"count_candles", label:"Count what is standing in the dust at the back of the vault.", events:["scene:treasury_fortynine_counted"] },
      { id:"second_key", label:"Find out who holds the Second Key.", events:["scene:treasury_warrant_read","scene:treasury_second_key"] },
      { id:"close_case", label:"Confront the keyholder and close the case.", events:["scene:treasury_rats_resolved"], completes:true },
    ] },
    c1q10:{ objectives:[
      { id:"find", label:"See the fourteen nameless children at the wool almshouse.", events:["scene:children_almshouse"] },
      { id:"hymn", label:"Hear what the children recite at dusk — and write down every line.", events:["scene:children_hymn","scene:children_hymn_second_night"] },
      { id:"mark", label:"Work out what the mark on their palms actually is.", events:["scene:children_palms","scene:children_palms_inconclusive"] },
      { id:"origins", label:"Trace where the fourteen were found.", events:["scene:children_ledger"] },
      { id:"resolve", label:"Settle the Church's custody claim on the children.", events:["scene:children_kept","scene:children_surrendered"], completes:true },
    ] },
    c1q11:{ objectives:[
      { id:"gallows", label:"Investigate Wat Kerrin's execution at the gallows yard.", events:["scene:condemned_last_words_arrival"] },
      { id:"account", label:"Learn what Kerrin said before they dropped him — and who signed his warrant.", events:["scene:condemned_hangman_account","scene:condemned_warrant_read"] },
      { id:"find_ossen", label:"Find Father Ossen before the Archive does.", events:["scene:ossen_found"] },
      { id:"read_slate", label:"Read what Ossen was required to write down.", events:["scene:ossen_slate_read"], completes:true },
    ] },
    c1q12:{ objectives:[
      { id:"arrive", label:"Learn what Mol has been paying for, and to whom.", events:["scene:mol_tithe_hook"] },
      { id:"investigate", label:"Press the elder, the ledger, or the collector for the truth of the levy.", events:["scene:berrick_forgotten_name","scene:mol_tithe_ledger","scene:mol_tithe_collector"] },
      { id:"mechanism", label:"Read the founding page. Discover what the money actually buys.", events:["scene:mol_tithe_founding_page"] },
      { id:"stone", label:"Stand at the Second Stone and understand what has not been said this year.", events:["scene:mol_tithe_stone"], completes:true },
    ] },
    c1q13:{ objectives:[
      { id:"dreamers", label:"Find the people dreaming the same dream in the Ashen Fields.", events:["scene:ashen_fields_dreamers"] },
      { id:"corroborate", label:"Corroborate the dream — three accounts, or the king's map against the seven markers.", events:["scene:tower_dream_transcript","scene:tower_map_overlay"] },
      { id:"dream", label:"Sleep in the Fields and meet the man on the thirty-seventh step.", events:["scene:tower_dream_walk"] },
      { id:"find", label:"Find the Tower that isn't there.", events:["scene:tower_of_ash_found"], completes:true },
    ] },
    c1q14:{ objectives:[
      { id:"find_forge", label:"Find the forge in the bend of the Merchant Road, and the smith who keeps it.", events:["scene:forge_of_judgment_arrival"] },
      { id:"hear_price", label:"Hear the price: three impossible ingredients, written on a slate that has been clean for forty years.", events:["scene:forge_hessa_offer"] },
      { id:"see_the_trick", label:"Watch Hessa reforge Church brass, and look at what comes out of the fire.", events:["scene:forge_the_trick"] },
      { id:"gather", label:"Recover the seal matrix and the ash from the Covenant signing hall ruins.", events:["scene:forge_ingredient_hunt"] },
      { id:"quench", label:"Stand at the quench and decide what the third ingredient is worth.", events:["scene:forge_the_quench"] },
      { id:"resolve", label:"Take the blade — or leave it in the water.", events:["scene:forge_blade_made","scene:forge_walk_away"], completes:true },
    ] },
    c1q15:{ objectives:[
      { id:"return_mol", label:"Return to Mol. Aldran is dead; his congregation is not.", events:["scene:mol_true_sermon_arrival"] },
      { id:"hear_sermon", label:"Hear the sermon the Church sent Brother Lect to preach over the body.", events:["scene:lect_preaches_over_body"] },
      { id:"find_hymnal", label:"Get Lect's hymnal open — read the seven illuminated capitals and the Church's own printed gloss on them.", events:["scene:lect_hymnal"] },
      { id:"true_sermon", label:"Hear Brother Lect's real sermon — the one he will not preach aloud.", events:["scene:mol_sermon_aftermath"], completes:true },
    ] },
    c1q16:{ objectives:[
      { id:"notice", label:"Read Vell's note and confirm the company shadowing you is real.", events:["scene:rival_company_shadow"] },
      { id:"midnight", label:"Keep Captain Serai Vell's midnight meeting at the old milestone.", events:["scene:rival_midnight_meeting"] },
      { id:"resolve", label:"Answer her question — or don't. Decide what Vell's company is to you.", events:["scene:rival_company_allies","scene:rival_company_enemies"], completes:true },
    ] },
    c1q17:{ objectives:[
      { id:"break_in", label:"Get inside the Church Archive.", events:["scene:church_archive_breakin"] },
      { id:"reach_theones", label:"Get past Head Archivist Theones — or get him to open the door himself.", events:["scene:archive_theones_desk"] },
      { id:"level_four", label:"Reach Level Four, the room nobody is assigned to.", events:["scene:archive_level_four"] },
      { id:"minutes", label:"Find the founders' minutes at the beginning of the series.", events:["scene:archive_founders_minutes"] },
      { id:"leave", label:"Get out of the Archive with what you found.", events:["scene:archive_c1q17_end"], completes:true },
    ] },
    c1q18:{ objectives:[
      { id:"descend", label:"Find the stair below the bottom of the Church Archive.", events:["scene:archive_lowest_level"] },
      { id:"hear_it", label:"Let the thing beneath the Archive speak.", events:["scene:archive_voice_names"] },
      { id:"learn_what_it_is", label:"Work out what has every name but one.", events:["scene:archive_voice_asks_name","scene:archive_voice_the_name","scene:archive_voice_told_name"] },
      { id:"leave", label:"Climb back out of the Archive with what it gave you.", events:["scene:archive_voice_ascent"], completes:true },
    ] },
    c1q19:{ objectives:[
      { id:"reach_chancery", label:"Reach the Chancery Room, where the Ninth is being re-engrossed.", events:["scene:chancery_records_room"] },
      { id:"read_signature", label:"Read the signature block of the First Covenant, Flame Year 12.", events:["scene:covenant_signature_block"] },
      { id:"hear_rubric", label:"Hear the presiding officer say clause the seventh aloud.", events:["scene:chancery_rubric_rehearsal"] },
      { id:"name_author", label:"Name the Covenant's author — and what page one actually is.", events:["scene:covenant_author_closed"], completes:true },
    ] },
    c1q20:{ objectives:[
      { id:"reach_tower", label:"Reach the Tower of Ash — Stone VII.", events:["scene:tower_ash_approach"] },
      { id:"climb", label:"Face what is on the thirty-seventh step.", events:["scene:tower_thirty_seventh_step"] },
      { id:"end_it", label:"Choose the fate of the Shattered God — and end Chapter I.", events:["scene:tower_ending_sword","scene:tower_ending_charter","scene:tower_ending_third_day","scene:tower_ending_uprising","scene:tower_ending_restoration","scene:tower_ending_devour","combat:victory:tower_thirty_seventh_step"], completes:true },
    ] },
  });

  function reduceQuestEvent(state = {}, eventKey) {
    const active = new Set(state.activeQuestIds || []);
    const completed = new Set(state.completedQuestIds || []);
    const progress = state.progress || {};
    const updates = [];
    const completions = [];
    for (const questId of active) {
      if (completed.has(questId)) continue;
      const arc = QUEST_ARCS[questId];
      if (!arc) continue;
      const completedObjectives = new Set(Object.keys(progress[questId]?.objectives || {}));
      for (const objective of arc.objectives) {
        if (completedObjectives.has(objective.id) || !objective.events.includes(eventKey)) continue;
        updates.push({ questId, objectiveId:objective.id, label:objective.label, eventKey });
        if (objective.completes) completions.push(questId);
      }
    }
    return { updates, completions:[...new Set(completions)] };
  }

  function getObjectives(questId) { return (QUEST_ARCS[questId]?.objectives || []).map(objective => ({ ...objective, events:[...objective.events] })); }

  function claimReward(character,questId,xp,grantXP){
    if(!character||!questId)return false;
    character.questRewardsClaimed=Array.isArray(character.questRewardsClaimed)?character.questRewardsClaimed:[];
    if(character.questRewardsClaimed.includes(questId))return false;
    character.questRewardsClaimed.push(questId);
    const amount=Math.max(0,Number(xp)||0);
    if(amount&&typeof grantXP==='function')grantXP(amount);
    else character.xp=(Number(character.xp)||0)+amount;
    return true;
  }

  return Object.freeze({ QUEST_ENGINE_VERSION, QUEST_ARCS, reduceQuestEvent, getObjectives, claimReward });
});
