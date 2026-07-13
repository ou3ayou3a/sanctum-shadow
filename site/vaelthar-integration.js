/* Canonical campaign bridge: menus are HTML; active gameplay is always 3D. */
(function(){
  'use strict';
  if(window.__worldIntegrationLoaded)return;window.__worldIntegrationLoaded=true;
  window.vt3dActive=false;
  let entering=false,activeLocation=null,retryAfter=0;

  function bridgeState(){try{if(typeof gameState!=='undefined'&&gameState)window.gameState=gameState;}catch{}}
  function state(){if(window.gameState)return window.gameState;try{if(typeof gameState!=='undefined')return gameState;}catch{}return null;}
  function locationId(){return window.mapState?.currentLocation||'vaelthar_city';}
  function shouldRun(){const gs=state();return !!(gs&&gs.activeScreen==='game'&&gs.character&&window.mapState?.currentLocation);}

  async function enterWorld3D(){
    if(window.vt3dActive||entering||!shouldRun()||!window.isWorld3DReady||Date.now()<retryAfter)return;
    entering=true;bridgeState();document.body.classList.add('vt-3d-active','world3d-canonical');
    const layer=document.getElementById('divinity-layer');if(layer){layer.dataset.worldPrevDisplay=layer.style.display||'';layer.style.display='none';}
    try{
      await window.loadWorld3D();window.vt3dActive=true;activeLocation=locationId();window.dispatchEvent(new CustomEvent('world3d:entered',{detail:{location:activeLocation}}));
    }catch(error){
      console.error('[world3d] failed to enter',error);document.body.classList.remove('vt-3d-active','world3d-canonical');if(layer){layer.style.display=layer.dataset.worldPrevDisplay||'';delete layer.dataset.worldPrevDisplay;}
      retryAfter=Date.now()+5000;if(typeof window.toast==='function')window.toast('The 3D world could not be loaded. Retrying shortly.','error');
    }finally{entering=false;}
  }

  function exitWorld3D(){
    if(!window.vt3dActive&&!entering)return;try{window.unloadWorld3D?.();}catch(error){console.warn('[world3d] cleanup failed',error);}
    document.body.classList.remove('vt-3d-active','world3d-canonical');const layer=document.getElementById('divinity-layer');if(layer){layer.style.display=layer.dataset.worldPrevDisplay||'';delete layer.dataset.worldPrevDisplay;}
    window.vt3dActive=false;entering=false;activeLocation=null;window.dispatchEvent(new CustomEvent('world3d:exited'));
  }

  function reconcile(){
    bridgeState();
    if(!shouldRun()){if(window.vt3dActive||entering)exitWorld3D();return;}
    if(window.vt3dActive&&activeLocation!==locationId())exitWorld3D();
    if(!window.vt3dActive&&!entering)enterWorld3D();
  }
  function wrapTravel(){
    if(window.__worldTravelWrapped||typeof window.travelToLocation!=='function')return;
    const original=window.travelToLocation;
    window.travelToLocation=function(){if(window.vt3dActive||entering)exitWorld3D();const result=original.apply(this,arguments);setTimeout(reconcile,25);return result;};
    window.__worldTravelWrapped=true;
  }
  function boot(){document.getElementById('vt-toggle')?.remove();wrapTravel();reconcile();setInterval(()=>{wrapTravel();reconcile();},300);}

  window.enterWorld3D=enterWorld3D;window.exitWorld3D=exitWorld3D;
  window.enterVaelthar3D=enterWorld3D;window.exitVaelthar3D=exitWorld3D;
  window.addEventListener('world3d:module-ready',reconcile);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
