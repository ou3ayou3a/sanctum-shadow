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

test('navigation caches clearance and smooths only collision-free route segments',async()=>{
  const{NavigationGrid}=await import('../site/world3d/navigation-grid.mjs');
  const obstacles=[{x:0,z:0,hw:2,hd:2},{x:5,z:3,hw:1.2,hd:3}],grid=new NavigationGrid({minX:-10,maxX:10,minZ:-10,maxZ:10,cellSize:.5,padding:.6,obstacles}),path=grid.findPath({x:-9,z:-7},{x:9,z:7});
  assert.ok(grid.blocked instanceof Uint8Array);assert.ok(path.length>=3);
  for(let index=1;index<path.length;index++)assert.equal(grid.hasLineOfSight(path[index-1],path[index]),true);
  for(const point of path)assert.equal(grid.isPointBlocked(point),false);
});

test('navigation projects blocked interaction points to a reachable clearance cell',async()=>{
  const{NavigationGrid}=await import('../site/world3d/navigation-grid.mjs'),grid=new NavigationGrid({minX:-5,maxX:5,minZ:-5,maxZ:5,cellSize:.5,padding:.65,obstacles:[{x:0,z:0,hw:1.5,hd:1.5}]}),projected=grid.projectOpen({x:0,z:0});
  assert.ok(projected);assert.equal(grid.isPointBlocked(projected),false);assert.ok(grid.findPath({x:-4,z:-4},projected).length>0);
});
