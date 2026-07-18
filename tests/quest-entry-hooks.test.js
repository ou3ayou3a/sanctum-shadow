'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const QuestEntries=require('../site/quest-entry-hooks.js');

function state(active,progress={},completed=[]){
  return{
    activeQuests:active.map(id=>({id})),
    completedQuests:completed.map(id=>({id})),
    questProgress:progress,
  };
}

test('every added Chapter I quest has one physical entry definition',()=>{
  assert.deepEqual(Object.keys(QuestEntries.ENTRY),Array.from({length:14},(_,index)=>`c1q${index+7}`));
  for(const entry of Object.values(QuestEntries.ENTRY)){
    assert.ok(entry.scene);
    assert.ok(entry.location);
    assert.ok(entry.objective);
    assert.ok(entry.destination);
  }
});

test('quest entry eligibility is reconstructed from saved objective progress',()=>{
  const fresh=state(['c1q7']);
  assert.equal(QuestEntries.isEntryEligible(fresh,'c1q7'),true);

  const resumed=state(['c1q7'],{c1q7:{objectives:{reach_well:{completedAt:1}}}});
  assert.equal(QuestEntries.isEntryEligible(resumed,'c1q7'),false);
  assert.equal(QuestEntries.isEntryEligible(state([],{},['c1q7']),'c1q7'),false);
});

test('regional entries trigger only at their real location',()=>{
  const game=state(['c1q7','c1q13','c1q20']);
  assert.deepEqual(QuestEntries.entriesForLocation(game,'mol_village'),['c1q7']);
  assert.deepEqual(QuestEntries.entriesForLocation(game,'ashen_fields'),['c1q13']);
  assert.deepEqual(QuestEntries.entriesForLocation(game,'tower_ash'),['c1q20']);
  assert.deepEqual(QuestEntries.entriesForLocation(game,'vaelthar_city'),[]);
});

test('Vaelthar investigations require their dedicated landmark',()=>{
  const game=state(['c1q8','c1q9','c1q10','c1q11']);
  assert.deepEqual(QuestEntries.entriesForLocation(game,'vaelthar_city'),[]);
  assert.deepEqual(
    QuestEntries.entriesForLocation(game,'vaelthar_city',{includeLandmarks:true}),
    ['c1q8','c1q9','c1q10','c1q11'],
  );
  assert.deepEqual(
    ['c1q8','c1q9','c1q10','c1q11'].map(id=>QuestEntries.ENTRY[id].landmark),
    ['ostrene_legation','royal_treasury','wool_almshouse','gallows_yard'],
  );
});

function fakeBrowser(gameState,location){
  const scheduled=[];
  const opened=[];
  const window={
    document:{getElementById:()=>null},gameState,mapState:{currentLocation:location},
    SCENES:Object.fromEntries(Object.values(QuestEntries.ENTRY).map(entry=>[entry.scene,{}])),
    runScene:scene=>opened.push(scene),activateQuest:()=>false,addLog:()=>{},
    setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},
    setInterval:()=>1,clearInterval:()=>{},combatState:{active:false},npcConvState:{active:false},
  };
  const flush=()=>{while(scheduled.length)scheduled.shift()();};
  return{window,opened,flush};
}

test('the correct physical landmark opens a Vaelthar quest exactly once',()=>{
  const browser=fakeBrowser(state(['c1q9']),'vaelthar_city');
  QuestEntries.install(browser.window);
  assert.equal(browser.window.tryQuestEntryAtLandmark('ostrene_legation','c1q9'),false);
  assert.equal(browser.window.tryQuestEntryAtLandmark('royal_treasury','c1q9'),true);
  browser.flush();
  assert.deepEqual(browser.opened,['treasury_rats_arrival']);
});

test('load recovery reopens only an unfinished regional introduction',()=>{
  const unfinished=fakeBrowser(state(['c1q7']),'mol_village');
  QuestEntries.install(unfinished.window);
  assert.equal(unfinished.window.resumeQuestEntries(),true);
  unfinished.flush();
  assert.deepEqual(unfinished.opened,['well_that_screams_arrival']);

  const completedObjective={c1q7:{objectives:{reach_well:{completedAt:1}}}};
  const resumed=fakeBrowser(state(['c1q7'],completedObjective),'mol_village');
  QuestEntries.install(resumed.window);
  assert.equal(resumed.window.resumeQuestEntries(),false);
  resumed.flush();
  assert.deepEqual(resumed.opened,[]);
});
