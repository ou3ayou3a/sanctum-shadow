// Build collision data from the real zone constructors without rendering or fetching assets.
import fs from 'node:fs';
import vm from 'node:vm';
const noop=()=>{};
const context=new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8ClampedArray(1024*1024*4)})},{get:(o,k)=>k in o?o[k]:noop});
globalThis.document={createElement:()=>({width:512,height:512,getContext:()=>context,addEventListener:noop,removeEventListener:noop}),createElementNS:()=>({addEventListener:noop,removeEventListener:noop,setAttribute:noop})};
globalThis.window={gameState:{},location:{href:'http://localhost/'}};
globalThis.location=window.location;
// Asset downloads do not define collision; footprints are registered synchronously.
globalThis.fetch=()=>new Promise(()=>{});
const sandbox={window,console:{log:noop},document};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../site/map.js',import.meta.url),'utf8')+'\nwindow.WORLD_LOCATIONS=WORLD_LOCATIONS;',sandbox);
const {buildZone}=await import('../site/world3d/zone-registry.js');
const catalog={};
for(const [id,location] of Object.entries(window.WORLD_LOCATIONS)){
 if(!location||!location.type)continue;
 const zone=buildZone(id);catalog[id]={bounds:zone.bounds,obstacles:zone.obstacles.map(({x,z,hw,hd})=>({x,z,hw,hd}))};
}
process.stdout.write(JSON.stringify(catalog));
process.exit(0);
