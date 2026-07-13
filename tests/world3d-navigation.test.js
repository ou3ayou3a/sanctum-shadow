const test = require('node:test');
const assert = require('node:assert/strict');

test('3D navigation routes around blocked map geometry', async () => {
  const { NavigationGrid } = await import('../site/world3d/navigation-grid.mjs');
  const grid = new NavigationGrid({minX:-5,maxX:5,minZ:-5,maxZ:5,cellSize:1,padding:0,obstacles:[{x:0,z:0,hw:1,hd:1}]});
  const path = grid.findPath({x:-4,z:0},{x:4,z:0});
  assert.ok(path.length >= 3);
  assert.equal(path.some(point => Math.abs(point.x) <= 1 && Math.abs(point.z) <= 1), false);
  assert.deepEqual(path.at(-1), {x:4,y:0,z:0});
});

test('3D navigation returns an empty path when a destination is sealed off', async () => {
  const { NavigationGrid } = await import('../site/world3d/navigation-grid.mjs');
  const obstacles=[];
  for(let z=-5;z<=5;z++)obstacles.push({x:0,z,hw:0,hd:0});
  const grid = new NavigationGrid({minX:-5,maxX:5,minZ:-5,maxZ:5,cellSize:1,padding:0,obstacles});
  assert.deepEqual(grid.findPath({x:-4,z:0},{x:4,z:0}),[]);
});

test('3D navigation never restores a requested endpoint inside an obstacle', async () => {
  const { NavigationGrid } = await import('../site/world3d/navigation-grid.mjs');
  const obstacle={x:0,z:0,hw:1.5,hd:1.5};
  const grid=new NavigationGrid({minX:-5,maxX:5,minZ:-5,maxZ:5,cellSize:.5,padding:.25,obstacles:[obstacle]});
  const path=grid.findPath({x:-4,z:0},{x:0,z:0});
  const end=path.at(-1);
  assert.ok(Math.abs(end.x)>obstacle.hw+.2||Math.abs(end.z)>obstacle.hd+.2);
});
