const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'../site/world3d',file),'utf8');

test('distance detail profiles preserve landmarks while culling micro detail early',async()=>{
  const{performanceProfileFor}=await import('../site/world3d/performance-policy.mjs');
  const landmark=performanceProfileFor('Crown Citadel tower',{radius:5}),grass=performanceProfileFor('street grass tuft',{radius:.1}),prop=performanceProfileFor('market barrel',{radius:.7});
  assert.equal(landmark.tier,'landmark');assert.equal(grass.tier,'micro');assert.equal(prop.tier,'prop');
  assert.ok(landmark.cullDistance>prop.cullDistance);assert.ok(prop.cullDistance>grass.cullDistance);assert.ok(grass.shadowDistance<prop.shadowDistance);
});

test('environment loading is concurrency-bounded and shares one versioned cache',()=>{
  const loader=read('environment-asset-loader.js'),production=read('production-assets.mjs'),slice=read('vaelthar-asset-slice.mjs');
  assert.match(loader,/MAX_CONCURRENT_LOADS=4/);assert.match(loader,/scheduleLoad/);assert.match(loader,/environmentAssetLoadStats/);
  assert.match(loader,/new THREE\.InstancedMesh/);assert.match(slice,/placeEnvironmentAssetBatch/);assert.match(slice,/instanced-curtain-walls/);
  assert.match(production,/environment-asset-loader\.js\?v=144/);assert.match(slice,/environment-asset-loader\.js\?v=144/);
});

test('world runtime connects cached navigation, progressive obstruction fading, and distance budgets',()=>{
  const engine=read('world-engine.js'),obstruction=read('camera-obstruction.mjs'),performance=read('world-performance.mjs');
  assert.match(engine,/cellSize:\.65,padding:\.62/);assert.match(engine,/WorldPerformanceManager/);assert.match(engine,/performanceManager\?\.update/);
  assert.match(obstruction,/updateFades/);assert.match(obstruction,/intersectObjects\(candidates,false\)/);assert.match(obstruction,/occluderRecords/);assert.match(obstruction,/this\.related\.get/);
  assert.match(performance,/frustumCulled=true/);assert.match(performance,/shadowDistance/);assert.match(performance,/cullDistance/);
});

test('Vaelthar batches repeated production trees instead of creating one draw hierarchy per tree',()=>{
  const slice=read('vaelthar-asset-slice.mjs');
  assert.match(slice,/treeBatches/);assert.match(slice,/production:instanced-\$\{asset\}-forest/);assert.doesNotMatch(slice,/place\(productionAssetSpec\(treeNames\[/);
});

test('Vaelthar instances repeated buildings and citadel sections',()=>{
  const slice=read('vaelthar-asset-slice.mjs');
  assert.match(slice,/buildingBatches/);assert.match(slice,/production:instanced-city-\$\{asset\}/);
  assert.match(slice,/production:instanced-citadel-towers/);assert.match(slice,/production:instanced-citadel-walls/);
});
