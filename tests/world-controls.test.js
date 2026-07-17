const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('camera controls use the requested mirrored WASD directions',async()=>{
  const input=await import('../site/world3d/camera-input.mjs');
  assert.deepEqual(input.cameraPanAxes(['KeyW']),{forward:1,right:0});
  assert.deepEqual(input.cameraPanAxes(['KeyS']),{forward:-1,right:0});
  assert.deepEqual(input.cameraPanAxes(['KeyA']),{forward:0,right:1});
  assert.deepEqual(input.cameraPanAxes(['KeyD']),{forward:0,right:-1});
  const diagonal=input.cameraPanAxes(['KeyW','KeyA']);
  assert.ok(Math.abs(Math.hypot(diagonal.forward,diagonal.right)-1)<1e-12);
  assert.deepEqual(input.cameraPanStep(['KeyW'],.5,8),{forward:4,right:0});
  const clamped=input.clampCameraPan(30,40,10);
  assert.deepEqual(clamped,{x:6,z:8});
});

test('world camera input is focus-safe and integrated into actor follow',()=>{
  const source=read('site/world3d/world-engine.js');
  for(const feature of['cameraInputAllowed','CAMERA_KEY_DIRECTIONS','cameraPanOffset','add(this.cameraPanOffset)','keyup','esc-menu'])assert.ok(source.includes(feature),`missing ${feature}`);
  assert.match(source,/W\/S camera forward\/back/);
  assert.match(source,/A\/D camera right\/left/);
});

test('fullscreen starts from game entry and remains available from Escape',()=>{
  const source=read('site/game.js');
  for(const feature of['requestWorldFullscreen','autoEnterWorldFullscreen','requestFullscreen','fullscreenchange','toggleWorldFullscreen','Full Screen'])assert.match(source,new RegExp(feature));
  assert.match(source,/function enterGame\([\s\S]*autoEnterWorldFullscreen\(\)/);
  assert.match(source,/function toggleEscMenu\([\s\S]*esc-btn fullscreen/);
  assert.match(source,/function toggleEscMenu\([\s\S]*esc-music-toggle/);
  assert.doesNotMatch(read('site/story.js'),/fullscreen-btn/);
});

test('every world score has a deterministic medieval acoustic layer',()=>{
  const source=read('site/audio.js');
  for(const feature of['MEDIEVAL_SCORES','createLutePluck','createWoodenFlute','createFrameDrum','createMedievalEnsemble'])assert.match(source,new RegExp(feature));
  for(const score of['city','chapel','tavern','forest','dungeon','battle','boss','village','road','fortress','wastes'])assert.match(source,new RegExp(`addMedievalScore\\(nodes, '${score}'\\)`));
  assert.match(source,/nodes\.medieval\.stop\(\)/);
  assert.match(source,/stopNodeCollection\(instance\.nodes\)/);
  assert.match(source,/!AudioEngine\.getTrackId\(\)[\s\S]*WORLD_LOCATIONS[\s\S]*startGameMusic/);
});
