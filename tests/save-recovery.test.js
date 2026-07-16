'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('manual Load Chronicle can restore a healthy checkpoint after a death',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','site','saves.js'),'utf8');
  assert.match(source,/function loadSaveSlot\(slotId, options = \{\}\)/);
  assert.match(source,/runDead && isDeadRunSlot && !manualLoad/);
  assert.match(source,/loadSaveSlot\('\$\{s\.id\}', \{ manual:true \}\)/);
});
