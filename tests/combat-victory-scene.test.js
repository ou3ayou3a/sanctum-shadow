'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('authored non-boss combats can continue into an explicit victory scene',()=>{
  const combat=fs.readFileSync(path.join(__dirname,'..','site','combat.js'),'utf8');
  const story=fs.readFileSync(path.join(__dirname,'..','site','story.js'),'utf8');
  assert.match(combat,/combatState\.victoryScene = typeof encounter\?\.victoryScene/);
  assert.match(combat,/runScene\(combatState\.victoryScene\)/);
  assert.equal((story.match(/victoryScene:'monastery_deep_chamber'/g)||[]).length,3);
});
