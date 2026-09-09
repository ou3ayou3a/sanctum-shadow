const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const catalog=require('../site/collision-catalog.js');
test('server collision catalog matches all current zone constructors',()=>{
 const built=JSON.parse(execFileSync(process.execPath,['tools/export-collision-catalog.mjs'],{cwd:require('node:path').join(__dirname,'..'),encoding:'utf8',maxBuffer:2e6}));
 assert.deepEqual(built,catalog);assert.equal(Object.keys(catalog).length,28);
 for(const zone of Object.values(catalog))for(const o of zone.obstacles)for(const key of ['x','z','hw','hd'])assert.ok(Number.isFinite(o[key]));
});
