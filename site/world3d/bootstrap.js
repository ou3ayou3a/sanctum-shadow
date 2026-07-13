import { WorldEngine } from './world-engine.js';
import { buildZone } from './zone-registry.js';

let engine=null;let loading=null;
const characterModel='prototype/assets/elf-ranger.glb';

window.loadWorld3D=async function loadWorld3D(){
  if(engine){engine.start();return engine;}if(loading)return loading;
  const canvas=document.getElementById('vaelthar-scene'),overlay=document.getElementById('vaelthar-overlay');
  if(!canvas||!overlay)throw new Error('World 3D mounts are missing.');
  const locationId=window.mapState?.currentLocation||'vaelthar_city';
  const race=window.gameState?.character?.race||'human';
  const characterClass=window.gameState?.character?.class||'warrior';
  loading=(async()=>{const instance=new WorldEngine({canvas,overlay,zoneFactory:()=>buildZone(locationId),character:{modelUrl:characterModel,race,characterClass}});await instance.initialize();engine=instance;window.__world3d=engine;engine.start();return engine;})();
  try{return await loading;}finally{loading=null;}
};
window.unloadWorld3D=function unloadWorld3D(){if(!engine)return;engine.dispose();engine=null;window.__world3d=null;};
window.isWorld3DReady=true;
window.dispatchEvent(new CustomEvent('world3d:module-ready'));

// Compatibility for older hooks while the rest of the campaign migrates.
window.loadVaeltharMap=window.loadWorld3D;
window.unloadVaeltharMap=window.unloadWorld3D;
