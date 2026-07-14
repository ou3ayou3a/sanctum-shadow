'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const natureSource=fs.readFileSync(path.join(__dirname,'../site/world3d/nature-kit.mjs'),'utf8');
const genericSource=fs.readFileSync(path.join(__dirname,'../site/world3d/zones/generic-zone.js'),'utf8');
const citySource=fs.readFileSync(path.join(__dirname,'../site/world3d/zones/vaelthar-courtyard.js'),'utf8');
const engineSource=fs.readFileSync(path.join(__dirname,'../site/world3d/world-engine.js'),'utf8');
const assetSliceSource=fs.readFileSync(path.join(__dirname,'../site/world3d/vaelthar-asset-slice.mjs'),'utf8');

test('the nature kit exposes every natural environment component',()=>{for(const name of['terrain','forest','tree','rockFormation','river','path','undergrowth','fogBank']){assert.match(natureSource,new RegExp(`function ${name}\\(`));assert.match(natureSource,new RegExp(`['\"]${name}['\"]`));}});
test('terrain keeps the playable center flat while shaping the distant skyline',()=>{assert.match(natureSource,/flatRadius/);assert.match(natureSource,/smoothstep\(flatRadius,maxRadius,radius\)/);assert.match(natureSource,/computeVertexNormals\(\)/);});
test('water, fog, trees, and ground cover receive environmental animation',()=>{for(const kind of['sway','water','fog'])assert.match(natureSource,new RegExp(`kind:['\"]${kind}['\"]`));assert.match(genericSource,/nature\.update\(time\)/);assert.match(citySource,/nature\.update\(time\)/);});
test('wilderness zones use paths, rivers, rocks, undergrowth, terrain, fog, and per-zone density',()=>{for(const call of['nature.terrain','nature.path','nature.river','nature.rockFormation','nature.undergrowth','nature.fogBank'])assert.match(genericSource,new RegExp(call.replace('.','\\.')));assert.match(genericSource,/fogDensity/);assert.match(engineSource,/zone\.scene\.fogDensity/);});
test('Vaelthar has natural terrain, authored wooded outskirts, a river corridor, and wall mist',()=>{assert.match(citySource,/vaelthar-hills/);assert.match(citySource,/vaelthar-river/);assert.match(citySource,/south-forest-road/);assert.match(citySource,/western-wall-mist/);assert.match(citySource,/river-mist/);assert.match(assetSliceSource,/BirchTree_1/);assert.match(assetSliceSource,/Bush_Large/);});
