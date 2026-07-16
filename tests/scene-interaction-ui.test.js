'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const story=fs.readFileSync(path.join(__dirname,'..','site','story.js'),'utf8');

test('NPC story scenes own their open-ended input instead of referencing a hidden global bar',()=>{
  assert.match(story,/const hasDialogue = .*type === 'talk'/);
  assert.match(story,/aria-label="Say something else"/);
  assert.doesNotMatch(story,/type your own action in the bar below/i);
});

test('scene freeform dialogue routes to the NPC engine and keeps a general action fallback',()=>{
  assert.match(story,/await startNPCConversation\(npc\.id,/);
  assert.match(story,/await window\.submitAction\(\)/);
  assert.match(story,/sourcePanel\?\.remove\(\)/);
});
