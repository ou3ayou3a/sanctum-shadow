'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Quests = require('../site/quests.js');

test('quest events only advance active, incomplete quests', () => {
  const inactive = Quests.reduceQuestEvent({ activeQuestIds:[], completedQuestIds:[], progress:{} }, 'scene:arrival_vaelthar');
  assert.deepEqual(inactive, { updates:[], completions:[] });

  const active = Quests.reduceQuestEvent({ activeQuestIds:['c1q1'], completedQuestIds:[], progress:{} }, 'scene:arrival_vaelthar');
  assert.equal(active.updates[0].objectiveId, 'arrive');
  assert.deepEqual(active.completions, []);

  const completed = Quests.reduceQuestEvent({ activeQuestIds:['c1q1'], completedQuestIds:['c1q1'], progress:{} }, 'scene:arrival_vaelthar');
  assert.deepEqual(completed.updates, []);
});

test('alternate story paths satisfy the same objective exactly once', () => {
  const state = { activeQuestIds:['c1q1'], completedQuestIds:[], progress:{} };
  const hall = Quests.reduceQuestEvent(state, 'scene:covenant_hall_scene');
  assert.equal(hall.updates[0].objectiveId, 'evidence');

  state.progress.c1q1 = { objectives:{ evidence:{ completedAt:1 } } };
  const document = Quests.reduceQuestEvent(state, 'scene:scribe_gives_document');
  assert.deepEqual(document.updates, []);
});

test('Cupside evidence and checkpoint combat satisfy the main evidence objective', () => {
  const state = { activeQuestIds:['c1q1'], completedQuestIds:[], progress:{} };
  const investigation = Quests.reduceQuestEvent(state, 'scene:cupside_evidence_found');
  assert.equal(investigation.updates[0].objectiveId, 'evidence');

  const combat = Quests.reduceQuestEvent(state, 'combat:victory:cupside_checkpoint');
  assert.equal(combat.updates[0].objectiveId, 'evidence');
});

test('completion events return both the final objective and one completion', () => {
  const result = Quests.reduceQuestEvent({ activeQuestIds:['c1q4'], completedQuestIds:[], progress:{} }, 'combat:victory:merchant_road_ambush');
  assert.equal(result.updates[0].objectiveId, 'secure_road');
  assert.deepEqual(result.completions, ['c1q4']);
});

test('defeating the Church soldiers completes Aldran\'s final objective',()=>{
  const result=Quests.reduceQuestEvent({activeQuestIds:['c1q5'],completedQuestIds:[],progress:{c1q5:{objectives:{find_aldran:{},hear_truth:{}}}}},'combat:victory:aldran_church_soldiers');
  assert.equal(result.updates[0].objectiveId,'decide_fate');
  assert.deepEqual(result.completions,['c1q5']);
});

test('the first six campaign quests expose readable objective checklists', () => {
  for (let order = 1; order <= 6; order++) {
    const objectives = Quests.getObjectives(`c1q${order}`);
    assert.ok(objectives.length >= 3);
    assert.ok(objectives.some(objective => objective.completes));
    assert.ok(objectives.every(objective => objective.id && objective.label && objective.events.length));
  }
});

test('all six campaign arcs complete through a canonical event walkthrough', () => {
  const canonicalEvents={
    c1q1:['scene:arrival_vaelthar','scene:covenant_hall_scene','scene:scribe_names_varek_location','scene:monastery_arrival','scene:chapter1_end_arrest'],
    c1q2:['scene:monastery_dungeon_entry','scene:monastery_deep_chamber','scene:monastery_dungeon_cleared'],
    c1q3:['scene:cartographer_missing','scene:thornwood_search','scene:cartographer_found'],
    c1q4:['scene:merchant_road_investigation','scene:merchant_road_ambush','combat:victory:merchant_road_ambush'],
    c1q5:['scene:aldran_meeting','scene:aldran_shares_intel','outcome:aldran_protected'],
    c1q6:['scene:fortress_harren_arrival','scene:harren_confession','scene:harren_joins'],
  };
  for(const [questId,events] of Object.entries(canonicalEvents)){
    const state={activeQuestIds:[questId],completedQuestIds:[],progress:{}};
    let completions=[];
    for(const eventKey of events){
      const result=Quests.reduceQuestEvent(state,eventKey);
      for(const update of result.updates){
        state.progress[questId]=state.progress[questId]||{objectives:{}};
        state.progress[questId].objectives[update.objectiveId]={eventKey};
      }
      completions.push(...result.completions);
    }
    assert.deepEqual(Object.keys(state.progress[questId].objectives),Quests.getObjectives(questId).map(objective=>objective.id));
    assert.deepEqual(completions,[questId]);
    const repeated=Quests.reduceQuestEvent(state,events.at(-1));
    assert.deepEqual(repeated,{updates:[],completions:[]});
  }
});

test('campaign rewards are claimed exactly once across completion replays',()=>{
  const character={xp:0,questRewardsClaimed:[]};
  const rewards={c1q1:200,c1q2:200,c1q3:150,c1q4:175,c1q5:225,c1q6:180};
  for(const [questId,xp] of Object.entries(rewards)){
    assert.equal(Quests.claimReward(character,questId,xp),true);
    assert.equal(Quests.claimReward(character,questId,xp),false);
  }
  assert.deepEqual(character.questRewardsClaimed,Object.keys(rewards));
  assert.equal(character.xp,Object.values(rewards).reduce((total,xp)=>total+xp,0));

  let delegatedXP=0;
  const delegated={xp:0,questRewardsClaimed:[]};
  assert.equal(Quests.claimReward(delegated,'c1q1',200,amount=>{delegatedXP+=amount;}),true);
  assert.equal(Quests.claimReward(delegated,'c1q1',200,amount=>{delegatedXP+=amount;}),false);
  assert.equal(delegatedXP,200);
  assert.equal(delegated.xp,0);
});
