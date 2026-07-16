'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Offline=require('../site/offline-narration.js');

test('offline NPC narration is deterministic and carries explicit consequences',()=>{
  const npc={id:'captain_rhael',name:'Captain Rhael',faction:'city_watch'};
  const first=Offline.npcReply(npc,'What happened at the hall?');
  const second=Offline.npcReply(npc,'What happened at the hall?');
  assert.deepEqual(first,second);
  assert.match(first.speech,/burned from the inside/i);
  assert.deepEqual(first.effects.questEvents,['scene:rhael_reveals_covenant']);
  assert.equal(first.effects.flags.ai_offline_spoke_captain_rhael,true);
  assert.ok(first.options.some(option=>option.roll?.skill==='persuasion'));
  assert.ok(first.options.every(option=>option.effects));
});

test('offline authored dialogue advances the same quest milestones as online scenes',()=>{
  const scribe=Offline.npcReply({id:'trembling_scribe',name:'The Trembling Scribe'},'Show me the order.');
  const location=Offline.npcReply({id:'trembling_scribe',name:'The Trembling Scribe'},'Where did Elder Varek go?');
  const mourne=Offline.npcReply({id:'sister_mourne',name:'Sister Mourne'},'Why did it burn?');
  assert.deepEqual(scribe.effects.questEvents,['scene:scribe_gives_document']);
  assert.deepEqual(location.effects.questEvents,['scene:scribe_gives_document','scene:scribe_names_varek_location']);
  assert.match(location.speech,/Monastery of Saint Aldric/i);
  assert.ok(scribe.options.some(option=>option.effects.questEvents?.includes('scene:scribe_names_varek_location')));
  assert.deepEqual(mourne.effects.questEvents,['scene:mourne_reveals_varek']);
});

test('unknown NPC and scene fallbacks remain useful instead of dead-ending',()=>{
  const npc={id:'dock_worker',name:'Dock Worker',faction:'unknown'};
  const first=Offline.npcReply(npc,'Did you see a sealed cart?');
  const second=Offline.npcReply(npc,'Did you see a sealed cart?');
  assert.equal(first.speech,second.speech);
  assert.equal(first.options.length,3);

  const scene=Offline.scene('follow the missing courier','Ash Market');
  assert.equal(scene.options.length,3);
  assert.ok(scene.options.some(option=>option.roll?.skill==='investigation'));
  assert.ok(scene.options.every(option=>option.effects));
  assert.ok(scene.options.filter(option=>option.roll).every(option=>option.failureEffects));
});
