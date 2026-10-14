#!/usr/bin/env node
'use strict';
// Browser QA (BUILD-SPEC §6.3): host and guest in two isolated browser contexts on the real server.
// The host plays a human warrior, the guest a paladin. Each client must see the other's party actor with
// the right model: the guest's paladin as the Fallen Paladin hero (scaled to the guest's race), the host as
// the human race model. Also checks remote locomotion, and (soft) that a combat ally built from a party
// character keeps the hero while enemies never get it.
//
// usage: node tools/qa/hero-multiplayer.cjs [--port 3311] [--out <dir>] [--guest-race human] [--host-race human]
//          [--width 1280 --height 800] [--headed] [--no-start] [--no-combat]
// Uses the server already on --port, or starts `node server.js` from this checkout on that port for the run.
const path=require('node:path');
const os=require('node:os');
const {heroSwapFractions,SCABBARD_MESHES,focusCamera,heroMaterialFactors,untinted,HERO_URL_PART,parseArgs,ensureServer,launchBrowser,watchPage,forbiddenConsole,installInspector,waitForWorld,createCharacterThroughUi,frameCamera,writeReport,checker}=require('./hero-qa-common.cjs');

const options=parseArgs(process.argv.slice(2),{port:'3311',out:path.join(os.tmpdir(),'sanctum-hero-qa','multiplayer'),guestRace:'human',hostRace:'human',width:'1280',height:'800'});
const port=Number(options.port),out=path.resolve(options.out),guestRace=String(options.guestRace),hostRace=String(options.hostRace);
const {checks,check,failed}=checker();
const shots=[];

async function openClient(browser,label){
  const context=await browser.newContext({viewport:{width:Number(options.width),height:Number(options.height)}});
  const page=await context.newPage();const log=watchPage(page,label);await page.addInitScript(installInspector);
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.mp?.socket?.connected===true&&typeof mpCreateSession==='function',null,{timeout:30000});
  await page.click('#splash-screen .splash-buttons .btn-primary');
  await page.click('.mode-card.multi-card');
  await page.waitForSelector('#lobby-screen.active',{timeout:10000});
  return{page,log,label};
}
// The party record for a remote player (by socket id; falls back to the only record of that class and says so).
const partyRecord=(page,id,characterClass)=>page.evaluate(({id,characterClass})=>{
  const records=window.__world3d?.partyManager?.records;let record=records?.get(id),matchedBy='id';
  if(!record&&records){const byClass=[...records.values()].filter(item=>item.player?.character?.class===characterClass);if(byClass.length===1){record=byClass[0];matchedBy='class';}}
  const summary=[...(records?.entries()||[])].map(([key,item])=>({key,playerId:item.player?.id,class:item.player?.character?.class,connected:item.player?.connected}));
  return record?{id:record.id,matchedBy,expectedId:id,playerClass:record.player?.character?.class||null,playerRace:record.player?.character?.race||null,state:record.state,visible:record.actor.visible,actor:window.__heroQA.actorInfo(record.actor),records:summary,sessionPlayers:Object.keys(window.mp?.session?.players||{}),localId:window.mp?.playerId}:{missing:true,expectedId:id,records:summary,sessionPlayers:Object.keys(window.mp?.session?.players||{}),localId:window.mp?.playerId};
},{id,characterClass});

async function main(){
  const assets=await import('../../site/world3d/production-assets.mjs');
  const factors=heroMaterialFactors();
  const guestScale=assets.heroScaleForRace('fallen_paladin',guestRace);
  const server=await ensureServer(port,{log:message=>console.log(`[qa] ${message}`),allowStart:!options.noStart});
  const browser=await launchBrowser({headed:!!options.headed});
  const report={script:'hero-multiplayer',startedAt:new Date().toISOString(),port,hostRace,guestRace,expectedGuestHeroScale:guestScale,checks,screenshots:shots};
  const clients=[];
  try{
    const host=await openClient(browser,'host');clients.push(host);
    const guest=await openClient(browser,'guest');clients.push(guest);
    const shot=async(client,name,{distance=null}={})=>{if(distance!==null)await frameCamera(client.page,distance);const file=path.join(out,`${client.label}-${name}.png`);await client.page.screenshot({path:file});shots.push(file);return file;};

    // 1. Host creates the session through the lobby UI; guest joins with the code.
    await host.page.click('#lobby-screen .lobby-card >> nth=0');
    await host.page.fill('#session-name','Hero QA');await host.page.fill('#host-name','Observer');
    await host.page.click('#create-session-screen .btn-primary.full-width');
    const code=await host.page.waitForFunction(()=>window.mp.sessionCode,null,{timeout:15000}).then(handle=>handle.jsonValue());
    report.sessionCode=code;
    await guest.page.click('#lobby-screen .lobby-card >> nth=1');
    await guest.page.fill('#join-code',code);await guest.page.fill('#join-name','Paladin');
    await guest.page.click('#join-session-screen .btn-primary.full-width');
    await guest.page.waitForFunction(code=>window.mp.sessionCode===code,code,{timeout:15000});
    check('guest joined the host session',true,{code});

    // 2. Both create characters through the real creation screens, then the host starts the Chronicle.
    for(const [client,spec] of[[host,{name:'Observer QA',race:hostRace,characterClass:'warrior'}],[guest,{name:'Paladin QA',race:guestRace,characterClass:'paladin'}]]){
      await client.page.click('#wait-screen button:has-text("Create My Character")');
      const created=await createCharacterThroughUi(client.page,spec);
      check(`${client.label} created a ${spec.race} ${spec.characterClass}`,created.class===spec.characterClass&&created.race===spec.race,created);
      await client.page.waitForSelector('#ready-room',{timeout:15000});
    }
    await host.page.waitForFunction(()=>{const button=document.getElementById('start-chronicle-btn');return button&&!button.disabled;},null,{timeout:30000});
    await host.page.click('#start-chronicle-btn');
    await Promise.all([waitForWorld(host.page,{zone:'vaelthar_city'}),waitForWorld(guest.page,{zone:'vaelthar_city'})]);
    const ids=await Promise.all([host.page.evaluate(()=>window.mp.playerId),guest.page.evaluate(()=>window.mp.playerId)]);
    report.playerIds={host:ids[0],guest:ids[1]};

    // 3. Each client sees the other's party actor with the right model.
    const remoteLoaded=(page,characterClass)=>page.waitForFunction(characterClass=>[...(window.__world3d?.partyManager?.records?.values()||[])].some(record=>record.player?.character?.class===characterClass&&record.actor.mixer),characterClass,{timeout:120000}).catch(()=>{});
    await Promise.all([remoteLoaded(host.page,'paladin'),remoteLoaded(guest.page,'warrior')]);
    ids.splice(0,2,...await Promise.all([host.page.evaluate(()=>window.mp.playerId),guest.page.evaluate(()=>window.mp.playerId)]));report.playerIdsAfterLoad={host:ids[0],guest:ids[1]};
    const hostSelf=await host.page.evaluate(()=>window.__heroQA.actorInfo(window.__world3d.actor));
    const guestSelf=await guest.page.evaluate(()=>window.__heroQA.actorInfo(window.__world3d.actor));
    const guestOnHost=await partyRecord(host.page,ids[1],'paladin');
    const hostOnGuest=await partyRecord(guest.page,ids[0],'warrior');
    Object.assign(report,{hostSelf,guestSelf,guestOnHost,hostOnGuest});
    check('host own actor stays the human warrior race model',!hostSelf.hero&&hostSelf.modelUrl.includes(`/characters/${hostRace}.glb`)&&hostSelf.characterClass==='warrior',{modelUrl:hostSelf.modelUrl,hero:hostSelf.hero});
    check('guest own actor is the Fallen Paladin hero',guestSelf.hero==='fallen_paladin'&&guestSelf.modelUrl.includes(HERO_URL_PART)&&guestSelf.mixer&&!guestSelf.loadError,{modelUrl:guestSelf.modelUrl,held:guestSelf.held});
    // Worn scabbard: only the paladin hero wears it (always shown); the warrior host has none and no swap override.
    const heroSwap=heroSwapFractions();
    const wearsScabbard=actor=>actor.worn.length===1&&actor.worn[0].name==='FP_Scabbard'&&actor.worn[0].shown&&/Hips/.test(actor.worn[0].parent||'')&&SCABBARD_MESHES.every(name=>actor.worn[0].meshes.includes(name))&&actor.scabbards===1;
    check('guest own hero wears the scabbard on the hips with the hilt sheathed',wearsScabbard(guestSelf)&&guestSelf.stowed.length===1&&guestSelf.stowed[0].name==='FP_Sword_stowed'&&guestSelf.stowed[0].shown&&guestSelf.held.every(item=>!item.visible),{worn:guestSelf.worn,stowed:guestSelf.stowed,held:guestSelf.held});
    check('guest own hero has the hero-only swap override',!!heroSwap&&guestSelf.swap?.weapon_draw===heroSwap.weapon_draw&&guestSelf.swap?.weapon_sheathe===heroSwap.weapon_sheathe,{swap:guestSelf.swap,expected:heroSwap});
    check('host own warrior has no scabbard and no swap override',hostSelf.worn.length===0&&hostSelf.scabbards===0&&hostSelf.swap===null,{worn:hostSelf.worn,scabbards:hostSelf.scabbards,swap:hostSelf.swap});
    check('host sees the guest party record as a paladin',!guestOnHost.missing&&guestOnHost.playerClass==='paladin',{record:guestOnHost.missing?guestOnHost:{class:guestOnHost.playerClass,race:guestOnHost.playerRace}});
    if(!guestOnHost.missing){
      const actor=guestOnHost.actor;
      check('host: guest party actor loaded the hero model',actor.hero==='fallen_paladin'&&actor.modelUrl.includes(HERO_URL_PART)&&actor.mixer&&!actor.loadError&&!actor.heroLoadError,{modelUrl:actor.modelUrl,loadError:actor.loadError,heroLoadError:actor.heroLoadError});
      check('host: guest hero carries the GLB FP_Sword and no mace/shield',actor.held.length===1&&actor.held[0].name==='FP_Sword'&&actor.stowed.length===1&&!actor.mace&&!actor.shield,{held:actor.held,stowed:actor.stowed});
      check('host: guest hero wears the scabbard on the hips with the hilt sheathed',wearsScabbard(actor)&&actor.stowed[0]?.name==='FP_Sword_stowed'&&actor.stowed[0].shown&&actor.held.every(item=>!item.visible),{worn:actor.worn,stowed:actor.stowed,held:actor.held});
      check('host: guest hero has no race tint',untinted(actor.materials,factors),{materials:actor.materials,factors});
      check('host: guest hero scaled to its race height (x party .98)',actor.modelScale&&actor.modelScale.every(value=>Math.abs(value-guestScale*.98)<1e-3),{modelScale:actor.modelScale,expected:+(guestScale*.98).toFixed(4),guestRace});
    }
    if(!hostOnGuest.missing){
      const actor=hostOnGuest.actor;
      check('guest: host party actor is the human race model (no hero)',!actor.hero&&actor.modelUrl.includes(`/characters/${hostRace}.glb`)&&actor.mixer,{modelUrl:actor.modelUrl,hero:actor.hero});
      check('guest: host warrior party actor has no scabbard',actor.worn.length===0&&actor.scabbards===0&&actor.swap===null,{worn:actor.worn,scabbards:actor.scabbards,swap:actor.swap});
    }else check('guest: host party actor present',false,hostOnGuest);
    // Frame both characters: the camera pans to the midpoint between the local actor and the remote party actor.
    const framePair=async(client,characterClass,distance=7)=>{const point=await client.page.evaluate(characterClass=>{const engine=window.__world3d,record=[...engine.partyManager.records.values()].find(item=>item.player?.character?.class===characterClass);const a=engine.actor.position,b=record?.actor.position||a;return{x:(a.x+b.x)/2,z:(a.z+b.z)/2,apart:+Math.hypot(a.x-b.x,a.z-b.z).toFixed(2)};},characterClass);await focusCamera(client.page,point,distance);return point;};
    report.framing={host:await framePair(host,'paladin')};await shot(host,'01-sees-guest-paladin');
    report.framing.guest=await framePair(guest,'warrior');await shot(guest,'01-own-hero-and-host');

    // 4. Guest moves by clicking; the host's copy of the paladin plays walk/run.
    const target=await guest.page.evaluate(()=>{const engine=window.__world3d,actor=engine.actor;for(let step=0;step<16;step++){const angle=step*Math.PI/8,point={x:actor.position.x+Math.sin(angle)*5,y:0,z:actor.position.z+Math.cos(angle)*5};if(engine.navigation.isPointBlocked(point)||!engine.navigation.findPath(actor.position,point).length)continue;const screen=window.__heroQA.project(point.x,0,point.z);if(screen.onScreen&&window.__heroQA.groundOnly(screen.ndc,point))return{...point,screen};}return null;});
    let moveMethod='none';
    if(target){
      await guest.page.keyboard.down('Shift');await guest.page.mouse.click(target.screen.x,target.screen.y);await guest.page.keyboard.up('Shift');moveMethod='shift+click';
      const moving=await guest.page.waitForFunction(()=>window.__world3d.actor.path.length>0||['walk_start','walk','run'].includes(window.__world3d.actor.state),null,{timeout:4000}).then(()=>true).catch(()=>false);
      if(!moving){moveMethod='engine.moveActor';await guest.page.evaluate(({x,z})=>window.__world3d.moveActor({x,y:0,z},true),target);}
    }
    const guestIdNow=await guest.page.evaluate(()=>window.mp.playerId);
    const remoteStates=await host.page.evaluate(async id=>{const seen=new Set();const until=performance.now()+25000;while(performance.now()<until){const records=window.__world3d?.partyManager?.records;const record=records?.get(id)||[...(records?.values()||[])].find(item=>item.player?.character?.class==='paladin');if(record){seen.add(`record:${record.state}`);seen.add(`actor:${record.actor.state}`);if(['walk','run'].includes(record.actor.state)&&seen.size>2)break;}await new Promise(resolve=>setTimeout(resolve,100));}return[...seen];},guestIdNow);
    report.remoteLocomotion={moveMethod,states:remoteStates,guestIdNow};
    check('host sees the guest paladin walk or run',remoteStates.some(state=>/^actor:(walk|run)$/.test(state)),{moveMethod,states:remoteStates});
    await framePair(host,'paladin',8);await shot(host,'02-guest-paladin-moving');
    await guest.page.waitForFunction(()=>window.__world3d.actor.state==='idle'&&!window.__world3d.actor.path.length,null,{timeout:60000}).catch(()=>{});
    await host.page.waitForTimeout(1500);
    report.framing.arrived=await framePair(host,'paladin',7);await shot(host,'03-guest-paladin-arrived');
    const guestPoint=await host.page.evaluate(()=>{const record=[...window.__world3d.partyManager.records.values()].find(item=>item.player?.character?.class==='paladin');return record?{x:record.actor.position.x,z:record.actor.position.z}:null;});
    if(guestPoint){await focusCamera(host.page,guestPoint,5.5);await shot(host,'04-guest-paladin-close');}
    await framePair(guest,'warrior',7);await shot(guest,'03-own-hero-after-move');

    // 5. Combat: the host builds the guest's ally actor from the party character (hero) and enemies stay plain.
    if(!options.noCombat){
      await frameCamera(host.page,null);await frameCamera(guest.page,null);
      const allyId=await guest.page.evaluate(()=>window.mp.playerId);report.combatAllyId=allyId;
      await guest.page.evaluate(()=>window.mpStartCombat([{id:'qa_guard',name:'QA Guard',hp:500,maxHp:500,ac:12,atk:1,dex:-20,xp:0,spells:[]}],{id:'qa_tactical'}));
      const combat=await host.page.waitForFunction(id=>{const controller=window.__world3d?.combatController;if(!controller?.active||controller.starting)return false;const record=controller.records.get(id);return record&&(record.actor.mixer||record.actor.loadError);},allyId,{timeout:120000}).then(()=>true).catch(()=>false);
      if(combat){
        const combatData=await host.page.evaluate(id=>{const controller=window.__world3d.combatController;return[...controller.records.entries()].map(([key,record])=>({id:key,isPlayer:!!record.combatant.isPlayer,owned:record.owned,actor:window.__heroQA.actorInfo(record.actor)})).map(item=>({...item,ally:item.id===id}));},allyId);
        report.combatOnHost=combatData;
        const ally=combatData.find(item=>item.ally),enemies=combatData.filter(item=>!item.isPlayer);
        check('host combat: guest ally actor uses the hero',ally&&ally.actor.hero==='fallen_paladin'&&ally.actor.modelUrl.includes(HERO_URL_PART),{ally:ally&&{modelUrl:ally.actor.modelUrl,hero:ally.actor.hero}},{soft:true});
        check('host combat: enemies have no scabbard',enemies.length>0&&enemies.every(item=>item.actor.worn.length===0&&item.actor.scabbards===0),{enemies:enemies.map(item=>({id:item.id,worn:item.actor.worn.length,scabbards:item.actor.scabbards}))},{soft:true});
        check('host combat: enemies never use the hero',enemies.length>0&&enemies.every(item=>!item.actor.hero&&!item.actor.modelUrl.includes(HERO_URL_PART)),{enemies:enemies.map(item=>({id:item.id,modelUrl:item.actor.modelUrl}))},{soft:true});
        await host.page.waitForTimeout(2500);
        // The ally was just built and is still in Weapon_Draw above; read it again once the stance has settled.
        const allySettled=await host.page.evaluate(id=>{const record=window.__world3d.combatController.records.get(id);return record?window.__heroQA.actorInfo(record.actor):null;},allyId);
        report.combatAllySettled=allySettled;
        check('host combat: guest ally keeps the scabbard shown with the sword drawn',!!allySettled&&wearsScabbard(allySettled)&&allySettled.held.every(item=>item.visible)&&allySettled.stowed.every(item=>!item.visible),{ally:allySettled&&{state:allySettled.state,worn:allySettled.worn,held:allySettled.held,stowed:allySettled.stowed}},{soft:true});
        await shot(host,'05-combat-ally-hero');
        const guestCombat=await guest.page.evaluate(()=>({active:!!window.__world3d.combatController?.active,self:window.__heroQA.actorInfo(window.__world3d.actor)}));
        check('guest combat: own actor keeps the hero with the sword drawn',guestCombat.active&&guestCombat.self.hero==='fallen_paladin'&&guestCombat.self.held.every(item=>item.visible),{active:guestCombat.active,held:guestCombat.self.held,state:guestCombat.self.state},{soft:true});
        check('guest combat: the empty scabbard stays shown while the sword is drawn',guestCombat.active&&wearsScabbard(guestCombat.self)&&guestCombat.self.held.every(item=>item.visible)&&guestCombat.self.stowed.every(item=>!item.visible),{worn:guestCombat.self.worn,held:guestCombat.self.held,stowed:guestCombat.self.stowed},{soft:true});
        await shot(guest,'05-combat-own-hero');
      }else check('combat started on the host with the guest ally loaded',false,{},{soft:true});
    }

    // 6. Errors on both clients.
    for(const client of clients){
      const forbidden=forbiddenConsole(client.log);
      check(`${client.label}: no forbidden console messages`,forbidden.length===0,{forbidden:forbidden.slice(0,10)});
      check(`${client.label}: no uncaught page errors`,client.log.pageErrors.length===0,{pageErrors:client.log.pageErrors.slice(0,5)});
      check(`${client.label}: no failed GLB responses`,!client.log.badResponses.some(response=>/\.glb/.test(response.url)),{bad:client.log.badResponses.filter(response=>/\.glb/.test(response.url))});
    }
  }catch(error){
    check('harness ran to completion',false,{error:String(error?.stack||error).slice(0,1500)});
  }finally{
    report.clients=clients.map(client=>({label:client.label,socketDisconnects:client.log.console.filter(entry=>/MP disconnected/.test(entry.text)).length,socketConnects:client.log.console.filter(entry=>/MP connected/.test(entry.text)).length,errors:client.log.console.filter(entry=>entry.type==='error'),warningCount:client.log.console.filter(entry=>entry.type==='warning').length,warnings:client.log.console.filter(entry=>entry.type==='warning').slice(0,40),pageErrors:client.log.pageErrors,badResponses:client.log.badResponses,glbRequests:client.log.glbRequests.filter(request=>request.url.includes('characters/'))}));
    report.finishedAt=new Date().toISOString();report.failed=failed().map(item=>item.name);
    writeReport(out,report);
    await browser.close().catch(()=>{});
    await server.stop({logFile:path.join(out,'server.log')});
    console.log(`\n${checks.filter(item=>item.pass).length}/${checks.length} checks passed (${failed().length} hard failures). Report: ${path.join(out,'report.json')}`);
    process.exitCode=failed().length?1:0;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
