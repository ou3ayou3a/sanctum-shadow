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
      { id:'hear_confession', label:'Learn why Harren abandoned his vows.', events:['scene:harren_confession'] },
      { id:'resolve_harren', label:'Resolve the standoff with Sir Harren.', events:['scene:harren_joins'], completes:true },
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
