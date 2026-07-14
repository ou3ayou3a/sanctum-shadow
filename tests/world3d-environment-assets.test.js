'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'../site/world3d');
const loader=fs.readFileSync(path.join(root,'environment-asset-loader.js'),'utf8');
const slice=fs.readFileSync(path.join(root,'vaelthar-asset-slice.mjs'),'utf8');

test('environment loader caches OBJ, glTF, and FBX templates and upgrades lighting materials',()=>{
  for(const loaderName of['GLTFLoader','OBJLoader','MTLLoader','FBXLoader'])assert.match(loader,new RegExp(loaderName));
  assert.match(loader,/TEMPLATE_CACHE/);
  assert.match(loader,/MeshStandardMaterial/);
  assert.match(loader,/castShadow=true/);
  assert.match(loader,/receiveShadow=true/);
});

test('the legacy source pack remains available as a documented fallback',()=>{
  const required=[
    'assets/environment/medieval-village/House_1.obj',
    'assets/environment/medieval-village/Inn.obj',
    'assets/environment/stylized-nature/BirchTree_1.gltf',
    'assets/environment/stylized-nature/BirchTree_Bark_Normal.png',
    'assets/environment/cave/Cave_Entrance_lowpoly/Cave_Entrance.fbx',
    'assets/environment/ASSET_SOURCES.md'
  ];
  for(const file of required)assert.ok(fs.statSync(path.join(root,file)).size>0,file);
  assert.match(slice,/productionAssetSpec/);
  assert.match(slice,/production:thornwood-cave/);
});

test('authored environment runtime subset stays below the initial 40 MB budget',()=>{
  const directory=path.join(root,'assets/environment');let bytes=0;
  const walk=folder=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else bytes+=fs.statSync(file).size;}};walk(directory);
  assert.ok(bytes<40*1024*1024,`environment assets are ${(bytes/1024/1024).toFixed(1)} MB`);
});
