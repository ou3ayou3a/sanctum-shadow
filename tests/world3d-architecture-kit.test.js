'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const architectureSource=fs.readFileSync(path.join(__dirname,'../site/world3d/architecture-kit.mjs'),'utf8');
const genericSource=fs.readFileSync(path.join(__dirname,'../site/world3d/zones/generic-zone.js'),'utf8');
const vaeltharSource=fs.readFileSync(path.join(__dirname,'../site/world3d/zones/vaelthar-courtyard.js'),'utf8');
const assetSliceSource=fs.readFileSync(path.join(__dirname,'../site/world3d/vaelthar-asset-slice.mjs'),'utf8');
const productionSource=fs.readFileSync(path.join(__dirname,'../site/world3d/production-assets.mjs'),'utf8');
const worldCss=fs.readFileSync(path.join(__dirname,'../site/world3d.css'),'utf8');

test('the reusable world kit exposes every planned architectural category',()=>{
  for(const name of['house','wall','tower','gatehouse','bridge','castle','ruin','tavern','temple','crypt','tree','vegetation']){
    assert.match(architectureSource,new RegExp(`function ${name}\\(`));
    assert.match(architectureSource,new RegExp(`['\"]${name}['\"]`));
  }
});

test('solid architecture registers navigation obstacles and semantic scene names',()=>{
  assert.match(architectureSource,/architectureType=name/);
  assert.match(architectureSource,/obstacles\.push/);
  for(const builder of['house','wall','tower','castle','temple','crypt'])assert.match(architectureSource,new RegExp(`function ${builder}\\([\\s\\S]*?obstacle\\(`));
});

test('generic zones keep procedural fallbacks while hero structures use Blender production assets',()=>{
  assert.match(genericSource,/createArchitectureKit/);
  assert.match(vaeltharSource,/createArchitectureKit/);
  assert.match(vaeltharSource,/buildVaeltharAssetSlice/);
  assert.match(assetSliceSource,/production:curtain-wall/);
  assert.match(assetSliceSource,/production:corner-tower/);
  for(const model of['house_a','house_b','house_c','tavern','merchant_shop','temple','city_gatehouse','castle_keep','ancient_ruin','cave_entrance'])assert.match(assetSliceSource,new RegExp(model));
  for(const model of['tavern_interior','shop_interior','temple_interior','castle_interior','house_interior','dungeon_interior'])assert.match(productionSource,new RegExp(model));
  assert.match(genericSource,/placeProductionAsset/);
  for(const call of['nature.tree','nature.undergrowth','nature.rockFormation','nature.fogBank'])assert.match(genericSource,new RegExp(call.replace('.','\\.')));
});

test('the legacy text-scene artwork cannot cover the active 3D canvas',()=>{
  assert.match(worldCss,/body\.vt-3d-active #game-screen \.center-panel::before/);
  assert.match(worldCss,/content:none!important/);
  assert.match(worldCss,/background:none!important/);
});
