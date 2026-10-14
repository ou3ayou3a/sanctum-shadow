#!/usr/bin/env node
'use strict';
// Browser QA (BUILD-SPEC §6.2): a paladin created through the real solo creation flow must play as the
// Fallen Paladin hero, sample its clips through the CharacterActor API, enter and leave the Tarnished Cup,
// and never leak the hero onto NPCs.
//
// usage: node tools/qa/hero-singleplayer.cjs [--port 3311] [--out <dir>] [--race human] [--class paladin]
//          [--width 1440 --height 900] [--headed] [--no-start] [--simulate-hero-failure]
// --simulate-hero-failure answers the hero GLB with HTTP 404 and only checks that the player falls back to its
// race production model (never the capsule), then stops.
// Uses the server already on --port, or starts `node server.js` from this checkout on that port for the run.
// Writes <out>/report.json and PNG screenshots. Exit code 1 when a hard check fails.
const path=require('node:path');
const os=require('node:os');
const {heroSwapFractions,SCABBARD_MESHES,SCABBARD_TRIANGLES,dismissTravelEncounter,heroMaterialFactors,untinted,HERO_URL_PART,parseArgs,ensureServer,launchBrowser,watchPage,forbiddenConsole,installInspector,waitForWorld,createCharacterThroughUi,frameCamera,writeReport,checker}=require('./hero-qa-common.cjs');

const options=parseArgs(process.argv.slice(2),{port:'3311',out:path.join(os.tmpdir(),'sanctum-hero-qa','singleplayer'),race:'human',class:'paladin',width:'1440',height:'900'});
const port=Number(options.port),out=path.resolve(options.out),race=String(options.race),characterClass=String(options.class);
const expectHero=characterClass==='paladin';
const {checks,check,failed}=checker();
const shots=[];

async function main(){
  const assets=await import('../../site/world3d/production-assets.mjs');
  const policy=await import('../../site/world3d/animation-policy.mjs');
  const factors=heroMaterialFactors();
  // Draw/sheathe swap fractions: the hero's own override, everyone else the shared animation-policy values.
  const heroSwap=heroSwapFractions();
  const expectedSwap=expectHero?heroSwap:{weapon_draw:policy.equipmentSwapFraction('weapon_draw'),weapon_sheathe:policy.equipmentSwapFraction('weapon_sheathe')};
  const expectedScale=expectHero?assets.heroScaleForRace('fallen_paladin',race):1,expectedHeight=assets.RACE_MODEL_HEIGHTS[race];
  const server=await ensureServer(port,{log:message=>console.log(`[qa] ${message}`),allowStart:!options.noStart});
  const browser=await launchBrowser({headed:!!options.headed});
  const report={script:'hero-singleplayer',startedAt:new Date().toISOString(),port,race,characterClass,expectedScale,expectedHeight,checks,screenshots:shots};
  let log=null;
  try{
    const context=await browser.newContext({viewport:{width:Number(options.width),height:Number(options.height)}});
    const page=await context.newPage();log=watchPage(page,'solo');await page.addInitScript(installInspector);
    if(options.simulateHeroFailure){report.simulateHeroFailure=true;await page.route(`**/${HERO_URL_PART}*`,route=>route.fulfill({status:404,contentType:'text/plain',body:'simulated missing hero'}));}
    const shot=async(name,{distance=null}={})=>{if(distance!==null)await frameCamera(page,distance);const file=path.join(out,`${name}.png`);await page.screenshot({path:file});shots.push(file);return file;};
    const info=()=>page.evaluate(()=>window.__heroQA.actorInfo(window.__world3d.actor));

    // 1. Splash and CC BY credit.
    await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
    await page.waitForFunction(()=>typeof startSoloMode==='function'&&typeof finalizeCharacter==='function',null,{timeout:30000});
    const credit=await page.evaluate(()=>document.querySelector('#splash-screen .asset-credit')?.textContent.replace(/\s+/g,' ').trim()||'');
    check('splash shows the CC BY 4.0 hero credit',/Pigcraft/.test(credit)&&/CC BY 4\.0/.test(credit)&&/Fallen Paladin in Corrupted Black Plate Armor/.test(credit)&&/rigged and optimised/.test(credit),{credit});
    await shot('00-splash-credit');

    // 2. Real solo creation flow.
    await page.click('#splash-screen .splash-buttons .btn-primary');
    await page.click('.mode-card.solo-card');
    const created=await createCharacterThroughUi(page,{name:'Hero QA',race,characterClass});
    check('character created through the real creation screens',created.race===race&&created.class===characterClass,created);
    const started=Date.now();
    const world=await waitForWorld(page,{zone:'vaelthar_city'});
    report.worldLoadMs=Date.now()-started;
    await page.waitForTimeout(1500);
    await page.evaluate(()=>{window.__heroQAStates=[];window.__heroQAStart=window.__world3d.actor.position.clone();window.__world3d.actor.addEventListener('statechange',event=>window.__heroQAStates.push({state:event.state,t:performance.now()}));});
    const faceCamera=()=>page.evaluate(()=>{const engine=window.__world3d,actor=engine.actor;actor.desiredFacing=null;actor.rotation.y=Math.atan2(engine.camera.position.x-actor.position.x,engine.camera.position.z-actor.position.z);});

    // 3. Player actor uses the hero, not the race model.
    const player=await info();report.player=player;
    const raceModel=`/characters/${race}.glb`;
    if(options.simulateHeroFailure){
      check('failed hero falls back to the race production model',!player.hero&&player.modelUrl.includes(raceModel)&&!!player.heroLoadError,{modelUrl:player.modelUrl,heroLoadError:player.heroLoadError});
      check('fallback is a real model with clips, not the capsule',!player.fallbackCapsule&&!player.loadError&&player.mixer&&player.actions.length>=25,{capsule:player.fallbackCapsule,loadError:player.loadError,actions:player.actions.length});
      check('fallback paladin gets its class equipment back (mace and shield)',player.mace&&player.shield,{held:player.held,stowed:player.stowed});
      check('fallback warning names the hero',log.console.some(entry=>/Hero model fallen_paladin failed; using the \w+ production model/.test(entry.text)),{});
      check('no capsule fallback warning',!log.console.some(entry=>/Character model failed/.test(entry.text)),{});
      check('no uncaught page errors',log.pageErrors.length===0,{pageErrors:log.pageErrors.slice(0,5)});
      await shot('fallback-race-model',{distance:5.5});
      return;
    }
    if(expectHero){
      check('player actor resolved the Fallen Paladin hero',player.hero==='fallen_paladin',{hero:player.hero});
      check('player model URL is the hero GLB',player.modelUrl.includes(HERO_URL_PART),{modelUrl:player.modelUrl});
      check('player model URL is not the race model',!player.modelUrl.includes(raceModel),{modelUrl:player.modelUrl,raceModel});
      check('hero GLB was fetched with HTTP 200',log.glbRequests.some(request=>request.url.includes(HERO_URL_PART)&&request.status===200),{glbRequests:log.glbRequests.filter(request=>request.url.includes('characters/'))});
      check('no hero load error and no race/capsule fallback',!player.loadError&&!player.heroLoadError&&!player.fallbackCapsule,{loadError:player.loadError,heroLoadError:player.heroLoadError,capsule:player.fallbackCapsule});
      check('hero model has no race-model meshes (no vanguard_visor)',!player.visor,{skinned:player.skinned});
      check('held equipment is the GLB FP_Sword in the right hand',player.held.length===1&&player.held[0].name==='FP_Sword'&&/RightHand/.test(player.held[0].bone),{held:player.held});
      check('exactly one stowed sword on the hips',player.stowed.length===1&&/Hips/.test(player.stowed[0].bone),{stowed:player.stowed});
      check('sword stowed while exploring (held hidden, stowed visible)',player.held.every(item=>!item.visible)&&player.stowed.every(item=>item.visible)&&!player.equipmentDrawn,{held:player.held,stowed:player.stowed});
      // Worn scabbard: its own always-visible slot on the Hips bone; only the sword clone toggles.
      const scabbard=player.worn[0];
      check('one worn scabbard (FP_Scabbard) rides on the Hips bone',player.worn.length===1&&scabbard.name==='FP_Scabbard'&&/Hips/.test(scabbard.bone)&&/Hips/.test(scabbard.parent||'')&&player.scabbards===1,{worn:player.worn,scabbards:player.scabbards});
      check('scabbard is the built leather/steel/hanger mesh within the triangle budget',!!scabbard&&SCABBARD_MESHES.every(name=>scabbard.meshes.includes(name))&&scabbard.triangles>=SCABBARD_TRIANGLES[0]&&scabbard.triangles<=SCABBARD_TRIANGLES[1],{meshes:scabbard?.meshes,triangles:scabbard?.triangles});
      check('scabbard and sheathed hilt are shown while exploring',player.worn.every(item=>item.shown)&&player.stowed.every(item=>item.shown),{worn:player.worn,stowed:player.stowed});
      check('the sheathed copy is the hilt only (FP_Sword_stowed, fewer triangles than the held sword)',player.stowed[0]?.name==='FP_Sword_stowed'&&player.stowed[0].triangles>0&&player.stowed[0].triangles<player.held[0]?.triangles,{stowed:player.stowed.map(item=>({name:item.name,triangles:item.triangles})),held:player.held.map(item=>({name:item.name,triangles:item.triangles}))});
      check('hero-only draw/sheathe swap override is set from FALLEN_LONGSWORD_SOCKETS.swap',!!heroSwap&&player.swap&&player.swap.weapon_draw===heroSwap.weapon_draw&&player.swap.weapon_sheathe===heroSwap.weapon_sheathe,{swap:player.swap,expected:heroSwap});
      check('no mace or shield on the hero',!player.mace&&!player.shield,{mace:player.mace,shield:player.shield});
      check('no race tint on the hero body materials (colour equals the GLB baseColorFactor)',untinted(player.materials,factors),{materials:player.materials,factors});
      const uniform=player.modelScale&&player.modelScale.every(value=>Math.abs(value-player.modelScale[0])<1e-4);
      check('hero uses one uniform race-height scale',uniform&&Math.abs(player.modelScale[0]-expectedScale)<1e-3,{modelScale:player.modelScale,expectedScale});
      check('hero standing height is close to the race model height',player.bbox&&Math.abs(player.bbox.height-expectedHeight)/expectedHeight<.08,{measured:player.bbox?.height,expectedHeight},{soft:true});
      check('hero feet are on the ground in Idle',player.bbox&&Math.abs(player.bbox.min[1]-player.position[1])<.06,{minY:player.bbox?.min[1],actorY:player.position[1]},{soft:true});
    }else{
      check('non-paladin player keeps the race model',!player.hero&&player.modelUrl.includes(raceModel),{modelUrl:player.modelUrl});
      check('non-paladin player has no worn scabbard and no swap override',player.worn.length===0&&player.scabbards===0&&player.swap===null,{worn:player.worn,scabbards:player.scabbards,swap:player.swap});
    }
    check('player has a mixer and the full clip set',player.mixer&&player.actions.length>=25,{actions:player.actions});
    await shot('01-idle-gameplay-camera');
    await shot('02-idle-close',{distance:5.5});

    // 4. Locomotion through real clicks on the ground (shift+click runs).
    const clickMove=async(distance,run)=>{
      const target=await page.evaluate(distance=>{const engine=window.__world3d,actor=engine.actor;for(let step=0;step<16;step++){const angle=actor.rotation.y+step*Math.PI/8,point={x:actor.position.x+Math.sin(angle)*distance,y:0,z:actor.position.z+Math.cos(angle)*distance};if(engine.navigation.isPointBlocked(point))continue;if(!engine.navigation.findPath(actor.position,point).length)continue;const screen=window.__heroQA.project(point.x,0,point.z);if(!screen.onScreen||!window.__heroQA.groundOnly(screen.ndc,point))continue;return{...point,screen};}return null;},distance);
      if(!target)return{method:'none'};
      await page.evaluate(()=>{window.__heroQAStates.length=0;});
      if(run)await page.keyboard.down('Shift');
      await page.mouse.click(target.screen.x,target.screen.y);
      if(run)await page.keyboard.up('Shift');
      let moved=await page.waitForFunction(()=>window.__world3d.actor.path.length>0||window.__heroQAStates.some(entry=>['walk_start','walk','run'].includes(entry.state)),null,{timeout:4000}).then(()=>true).catch(()=>false);
      let method='click';
      if(!moved){method='engine.moveActor';await page.evaluate(({x,z,run})=>window.__world3d.moveActor({x,y:0,z},run),{x:target.x,z:target.z,run});}
      return{method,target};
    };
    const walk=await clickMove(4,false);
    report.walk={method:walk.method};
    const walkSeen=await page.waitForFunction(()=>{const actor=window.__world3d.actor;return actor.state==='walk'&&actor.currentSpeed>.6;},null,{timeout:30000}).then(()=>true).catch(()=>false);
    const walking=await info();report.walk.sample=walking;
    check('walk state reached by clicking the ground',walkSeen,{method:walk.method,state:walking.state,activeClip:walking.activeClip});
    check('walk clip has weight while walking',walking.activeClip==='Walk'&&walking.activeWeight>0,{activeClip:walking.activeClip,weight:walking.activeWeight});
    check('sword stays stowed while walking',!walking.equipmentDrawn&&walking.held.every(item=>!item.visible),{equipmentDrawn:walking.equipmentDrawn});
    if(expectHero)check('scabbard and sheathed hilt stay shown while walking',walking.worn.length===1&&walking.worn.every(item=>item.shown)&&walking.stowed.every(item=>item.shown),{worn:walking.worn,stowed:walking.stowed});
    await shot('03-walk');
    await page.waitForFunction(()=>window.__world3d.actor.state==='idle'&&!window.__world3d.actor.path.length,null,{timeout:60000}).catch(()=>{});
    const walkStates=await page.evaluate(()=>window.__heroQAStates.map(entry=>entry.state));
    report.walk.states=walkStates;
    check('walk passes walk_start, walk, walk_stop and returns to idle',['walk_start','walk','walk_stop','idle'].every(state=>walkStates.includes(state)),{states:walkStates},{soft:true});
    const run=await clickMove(6,true);
    report.run={method:run.method};
    const runSeen=await page.waitForFunction(()=>window.__world3d.actor.state==='run',null,{timeout:30000}).then(()=>true).catch(()=>false);
    const running=await info();report.run.sample=running;
    check('run state reached with shift+click',runSeen,{method:run.method,state:running.state,activeClip:running.activeClip});
    if(expectHero)check('scabbard and sheathed hilt stay shown while running',running.worn.length===1&&running.worn.every(item=>item.shown)&&running.stowed.every(item=>item.shown)&&running.held.every(item=>!item.visible),{worn:running.worn,stowed:running.stowed,held:running.held});
    await shot('04-run');
    await page.waitForFunction(()=>window.__world3d.actor.state==='idle'&&!window.__world3d.actor.path.length,null,{timeout:60000}).catch(()=>{});

    // 5. Clip sampling through the CharacterActor API (back at the open start point, facing the gameplay camera).
    await page.evaluate(()=>{const actor=window.__world3d.actor;actor.stop();actor.position.copy(window.__heroQAStart);});
    await frameCamera(page,6.5,{reset:true});await faceCamera();await page.waitForTimeout(400);
    const idle=await info();
    const sample=async(name,trigger,{fraction=.45,shotName}={})=>{
      await faceCamera();
      const result=await page.evaluate(({name,trigger})=>{const actor=window.__world3d.actor;actor.stop();let ok=false;if(trigger==='combat')ok=!!actor.playCombatAction({action:'attack',force:true});else ok=actor.playOneShot(name,{returnToIdle:false,record:false});return{ok,duration:actor.activeAction?.getClip().duration||0,clip:actor.activeAction?.getClip().name||null};},{name,trigger});
      await page.waitForFunction(({fraction,duration})=>{const action=window.__world3d.actor.activeAction;return!action||action.time>=duration*fraction;},{fraction,duration:result.duration},{timeout:30000}).catch(()=>{});
      const state=await info();
      const delta=(a,b)=>a&&b?+(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])*100).toFixed(1):null;
      const entry={name,...result,state:state.state,activeClip:state.activeClip,weight:state.activeWeight,heldVisible:state.held.map(item=>item.visible),rightHandMovedCm:delta(state.bones.rightHand,idle.bones.rightHand),headMovedCm:delta(state.bones.head,idle.bones.head),hipsY:state.bones.hips?.[1]??null,bboxMinY:state.bbox?.min[1]??null};
      if(shotName)entry.screenshot=await shot(shotName);
      return entry;
    };
    const clips={};
    clips.idle={state:idle.state,activeClip:idle.activeClip,weight:idle.activeWeight,hipsY:idle.bones.hips?.[1]};
    clips.walk={state:walking.state,activeClip:walking.activeClip,weight:walking.activeWeight};
    clips.run={state:running.state,activeClip:running.activeClip,weight:running.activeWeight};
    clips.idle.screenshot=await shot('05-idle-front');
    clips.attack=await sample('attack_smite','combat',{shotName:'06-attack'});
    await page.waitForFunction(()=>window.__world3d.actor.actionTime===0,null,{timeout:30000}).catch(()=>{});
    clips.block=await sample('block','oneShot',{shotName:'07-block'});
    clips.cast=await sample('cast','oneShot',{shotName:'08-cast'});
    clips.hit=await sample('hit','oneShot',{shotName:'09-hit'});
    clips.death=await sample('death','oneShot',{fraction:1,shotName:'10-death-end'});
    await page.waitForTimeout(400);
    const deathClamp=await page.evaluate(()=>{const actor=window.__world3d.actor,action=actor.actions.death;return{state:actor.state,time:+action.time.toFixed(3),duration:+action.getClip().duration.toFixed(3),clamp:action.clampWhenFinished,running:action.isRunning()};});
    clips.death.clamp=deathClamp;
    report.clips=clips;
    check('attack plays an authored clip with the sword drawn',clips.attack.ok&&/Attack/.test(clips.attack.clip||'')&&clips.attack.heldVisible.every(Boolean),{clip:clips.attack.clip,heldVisible:clips.attack.heldVisible});
    for(const name of['block','cast','hit','death'])check(`${name} clip plays on the hero rig`,clips[name].ok&&clips[name].state===name&&clips[name].activeClip,{clip:clips[name].clip,state:clips[name].state});
    check('sampled clips move the hero skeleton (bones respond)',['attack','block','cast','hit','death'].some(name=>(clips[name].rightHandMovedCm||0)>5),Object.fromEntries(['attack','block','cast','hit','death'].map(name=>[name,clips[name].rightHandMovedCm])));
    check('death clamps on its last frame',deathClamp.clamp&&deathClamp.time>=deathClamp.duration-.05,deathClamp);
    // Cape drape corrective (FP_CapeDrape): fully on at the end of Death, back to 0 once the actor leaves the death state.
    const drapeAt=()=>page.evaluate(()=>{const actor=window.__world3d.actor,drape=actor.capeDrape;return drape?{state:actor.state,target:Object.keys(drape.mesh.morphTargetDictionary||{}),influence:+drape.mesh.morphTargetInfluences[drape.index].toFixed(3)}:null;});
    const drapeDead=await drapeAt();
    // FP_CapeDrape exists only in the hero GLB: other classes (race models) must have no drape corrective at all.
    if(expectHero)check('cape drape morph is fully on at the end of Death',!!drapeDead&&drapeDead.target.includes('FP_CapeDrape')&&drapeDead.influence>=.99,drapeDead);
    else check('non-hero player has no cape drape corrective',drapeDead===null,{drape:drapeDead});
    await page.evaluate(()=>{const actor=window.__world3d.actor;actor.setEquipmentDrawn(false);actor.setState('idle',true);});
    const idleStart=await page.evaluate(()=>window.__world3d.actor.actions.idle?.time??null);
    await page.waitForFunction(()=>{const d=window.__world3d.actor.capeDrape;return!d||d.mesh.morphTargetInfluences[d.index]===0;},null,{timeout:3000}).catch(()=>{});
    const drapeAlive={...(await drapeAt()),idleAdvancedS:await page.evaluate(start=>{const t=window.__world3d.actor.actions.idle?.time;return t==null||start==null?null:+(t-start).toFixed(3);},idleStart)};
    if(expectHero)check('cape drape morph returns to 0 outside Death',!!drapeAlive&&drapeAlive.influence===0,drapeAlive);

    // Combat stance draws the GLB sword (Weapon_Draw swaps visibility at the authored fraction; the hero uses its own
    // FALLEN_LONGSWORD_SOCKETS.swap). Every setEquipmentDrawn call during the transition is logged (time, held/stowed/
    // worn visibility after the call) and visibility is also polled every 5 ms: the sword must change hands exactly once,
    // never before the expected moment (timers only fire late, so up to 250 ms after it is accepted), held and stowed
    // must never show together, and worn gear must never hide.
    const stanceTransition=(active)=>page.evaluate(active=>new Promise(resolve=>{
      const actor=window.__world3d.actor,clip=active?'weapon_draw':'weapon_sheathe',action=actor.actions[clip];
      const duration=action?Math.max(.25,action.getClip().duration):0,goal=active?'combat_idle':'idle';
      const visible=list=>(list||[]).every(object=>object.visible),stowedCount=(actor.stowedEquipment||[]).length,start=performance.now();
      const result={clip,duration:+duration.toFixed(3),swapMs:null,swaps:0,bothShown:0,noneShown:0,wornHidden:0,samples:0,calls:[],state:null};
      const inspect=()=>{const held=visible(actor.heldEquipment),stowed=visible(actor.stowedEquipment),worn=visible(actor.wornEquipment);if(held&&stowed&&stowedCount)result.bothShown++;if(!held&&!stowed)result.noneShown++;if(!worn)result.wornHidden++;return{held,stowed,worn};};
      let last=null;
      actor.setEquipmentDrawn=function(drawn){Object.getPrototypeOf(this).setEquipmentDrawn.call(this,drawn);const t=+(performance.now()-start).toFixed(1),state=inspect();result.calls.push({t,drawn:!!drawn,...state});if(last!==null&&state.held!==last){result.swaps++;if(result.swapMs===null)result.swapMs=t;}last=state.held;};
      actor.setCombatStance(active);
      result.initialHeld=result.calls[0]?.held??null;result.initialStowed=result.calls[0]?.stowed??null;
      const timer=setInterval(()=>{result.samples++;inspect();const elapsed=performance.now()-start;
        if(actor.state===goal||elapsed>15000){clearInterval(timer);delete actor.setEquipmentDrawn;result.state=actor.state;result.swapFraction=result.swapMs!==null&&duration?+(result.swapMs/1000/duration).toFixed(3):null;resolve(result);}
      },5);
    }),active);
    // Swap timing: not earlier than the expected fraction of the clip, at most 250 ms later (main-thread delay).
    const onTime=(transition,fraction)=>transition.swapMs!==null&&transition.swapMs>=fraction*transition.duration*1000-15&&transition.swapMs<=fraction*transition.duration*1000+250;
    await faceCamera();
    const draw=await stanceTransition(true);report.drawTransition=draw;
    await page.waitForTimeout(300);
    const stance=await info();report.combatStance=stance;
    check('combat stance shows the held FP_Sword and hides the stowed one',stance.state==='combat_idle'&&stance.held.every(item=>item.visible)&&stance.stowed.every(item=>!item.visible),{state:stance.state,held:stance.held,stowed:stance.stowed});
    check('draw: the sword changes hands once, at the expected swap fraction',draw.state==='combat_idle'&&draw.initialHeld===false&&draw.initialStowed===true&&draw.swaps===1&&onTime(draw,expectedSwap.weapon_draw)&&draw.bothShown===0&&draw.noneShown===0,{...draw,expected:expectedSwap.weapon_draw});
    if(expectHero){
      check('draw: the scabbard never hides during Weapon_Draw',draw.wornHidden===0&&draw.samples>10&&draw.calls.every(call=>call.worn),{wornHidden:draw.wornHidden,samples:draw.samples});
      check('combat stance keeps the empty scabbard shown on the hips',stance.worn.length===1&&stance.worn.every(item=>item.shown)&&/Hips/.test(stance.worn[0].parent||''),{worn:stance.worn});
    }else check('combat stance: non-paladin still has no worn gear',stance.worn.length===0&&stance.scabbards===0,{worn:stance.worn});
    await shot('11-combat-idle-sword',{distance:5.5});
    const sheathe=await stanceTransition(false);report.sheatheTransition=sheathe;
    await page.waitForTimeout(300);
    const sheathed=await info();report.sheathed=sheathed;
    check('sheathe: the sword changes hands once, at the expected swap fraction',sheathe.state==='idle'&&sheathe.initialHeld===true&&sheathe.initialStowed===false&&sheathe.swaps===1&&onTime(sheathe,expectedSwap.weapon_sheathe)&&sheathe.bothShown===0&&sheathe.noneShown===0,{...sheathe,expected:expectedSwap.weapon_sheathe});
    check('after sheathing: held hidden, stowed shown again',!sheathed.equipmentDrawn&&sheathed.held.every(item=>!item.visible)&&sheathed.stowed.every(item=>item.shown),{held:sheathed.held,stowed:sheathed.stowed});
    if(expectHero){
      check('sheathe: the scabbard never hides during Weapon_Sheathe',sheathe.wornHidden===0&&sheathe.samples>10&&sheathe.calls.every(call=>call.worn),{wornHidden:sheathe.wornHidden,samples:sheathe.samples});
      check('after sheathing: scabbard still shown on the hips',sheathed.worn.length===1&&sheathed.worn.every(item=>item.shown),{worn:sheathed.worn});
    }
    await shot('11b-sheathed',{distance:5.5});
    await frameCamera(page,null);

    // 6. NPCs in the city never load the hero.
    const npcCheck=async(label)=>{
      await page.waitForTimeout(800);
      // Paladin-class NPCs (the orc guards) are usually outside the streaming radius: load them through NPCManager.ensureActor.
      const forced=await page.evaluate(async()=>{const manager=window.__world3d.npcManager;if(!manager)return[];const targets=manager.records.filter(record=>record.config.classId==='paladin'&&!record.actor);await Promise.all(targets.map(record=>manager.ensureActor(record)));return targets.map(record=>record.config.id);});
      const data=await page.evaluate(()=>({npcs:window.__heroQA.npcInfo(),actors:window.__heroQA.sceneActors()}));
      const loaded=data.npcs.filter(npc=>npc.loaded),paladins=loaded.filter(npc=>npc.classId==='paladin');
      check(`${label}: no NPC actor carries the hero scabbard or worn gear`,loaded.every(npc=>!npc.scabbard&&npc.worn===0),{withScabbard:loaded.filter(npc=>npc.scabbard||npc.worn).map(npc=>npc.id)});
      check(`${label}: no NPC actor uses the hero`,loaded.every(npc=>!npc.hero&&!String(npc.modelUrl).includes(HERO_URL_PART)),{loaded:loaded.length,total:data.npcs.length,forcedPaladinNpcs:forced,paladinNpcs:paladins.map(npc=>({id:npc.id,race:npc.race,modelUrl:npc.modelUrl}))});
      if(paladins.length)check(`${label}: paladin-class NPCs stay on their race model`,paladins.every(npc=>String(npc.modelUrl).includes(`/characters/${npc.race||'human'}.glb`)),{paladins:paladins.map(npc=>({id:npc.id,modelUrl:npc.modelUrl}))});
      const heroActors=data.actors.filter(actor=>actor.hero||String(actor.modelUrl).includes(HERO_URL_PART));
      check(`${label}: only the player actor carries the hero`,heroActors.every(actor=>actor.kind==='player')&&heroActors.length===(expectHero?1:0),{heroActors});
      const wornActors=data.actors.filter(actor=>actor.worn||actor.scabbard);
      check(`${label}: only the player actor wears the scabbard`,wornActors.every(actor=>actor.kind==='player')&&wornActors.length===(expectHero?1:0),{wornActors});
      return{npcs:data.npcs,actors:data.actors};
    };
    report.cityNpcs=await npcCheck('city');

    // 7. Enter the Tarnished Cup through its landmark, then walk back out.
    const travel=async(interactionId,destination,label)=>{
      await page.evaluate(()=>{window.__heroQAPrevEngine=window.__world3d;});
      const approach=await page.evaluate(id=>{const engine=window.__world3d,record=engine.zone.interactables.find(item=>item.id===id);if(!record)return{found:false};engine.goToInteraction(record,true);return{found:true,label:record.label};},interactionId);
      if(!approach.found)return{ok:false,reason:`interaction ${interactionId} missing`};
      let method='walk + confirmInteraction';
      const reached=await page.waitForFunction(id=>window.__world3d.pendingInteraction?.id===id,interactionId,{timeout:120000}).then(()=>true).catch(()=>false);
      if(reached){
        await page.evaluate(()=>window.__world3d.confirmInteraction());
        // Landmarks with several approaches open the interaction menu; pick the primary (door) action like a player would.
        const menu=await page.evaluate(id=>{const engine=window.__world3d;return engine.activeInteraction?.id===id&&!engine.interactionMenu.hidden;},interactionId);
        if(menu){method+=' + menu choice 0';await page.click('.world3d-interaction-choices [data-env-action="0"]');}
      }
      else{method='direct onInteract (walk did not reach)';await page.evaluate(id=>{const engine=window.__world3d,record=engine.zone.interactables.find(item=>item.id===id);const action=record.actions?.[0];if(action?.onSelect)action.onSelect(engine,record);else record.onInteract?.(engine,action);},interactionId);}
      const begun=Date.now();
      const zone=await waitForWorld(page,{zone:destination,previous:true,timeout:180000}).catch(error=>({error:String(error.message||error)}));
      const encounter=await dismissTravelEncounter(page);if(encounter)(report.travelEncounters||=[]).push({destination,...encounter});
      const actor=await info();
      return{ok:!zone.error&&zone.zone===destination,method,label:approach.label,zone,loadMs:Date.now()-begun,actor};
    };
    const tavern=await travel('tarnished_cup','tarnished_cup');
    report.tavernEnter={...tavern,actor:undefined,player:tavern.actor};
    check('entered the Tarnished Cup through the city landmark',tavern.ok,{method:tavern.method,zone:tavern.zone,loadMs:tavern.loadMs});
    if(tavern.ok){
      check('tavern: new engine keeps the hero model with a mixer',(!expectHero||tavern.actor.modelUrl.includes(HERO_URL_PART))&&tavern.actor.mixer&&!tavern.actor.loadError,{modelUrl:tavern.actor.modelUrl,mixer:tavern.actor.mixer});
      check('tavern: sword equipment rebuilt',!expectHero||(tavern.actor.held.length===1&&tavern.actor.held[0].name==='FP_Sword'&&tavern.actor.stowed.length===1),{held:tavern.actor.held,stowed:tavern.actor.stowed});
      check('tavern: scabbard rebuilt on the hips (none for other classes)',expectHero?(tavern.actor.worn.length===1&&tavern.actor.worn[0].name==='FP_Scabbard'&&tavern.actor.worn.every(item=>item.shown)&&tavern.actor.scabbards===1):(tavern.actor.worn.length===0&&tavern.actor.scabbards===0),{worn:tavern.actor.worn,scabbards:tavern.actor.scabbards});
      await shot('12-tavern-interior');
      await shot('13-tavern-close',{distance:5.5});
      report.tavernNpcs=await npcCheck('tavern');
      const back=await travel('interior_exit','vaelthar_city');
      report.tavernExit={...back,actor:undefined,player:back.actor};
      check('left the tavern back to the city',back.ok,{method:back.method,zone:back.zone,loadMs:back.loadMs});
      if(back.ok){
        check('city after tavern: hero model reloaded from cache with a mixer',(!expectHero||back.actor.modelUrl.includes(HERO_URL_PART))&&back.actor.mixer&&!back.actor.loadError,{modelUrl:back.actor.modelUrl});
        await shot('14-city-after-tavern');
        report.cityNpcsAfterTavern=await npcCheck('city after tavern');
      }
    }

    // 8. Console and page errors.
    const forbidden=forbiddenConsole(log);
    check('no forbidden console messages (model/equipment/binding failures)',forbidden.length===0,{forbidden:forbidden.slice(0,10)});
    check('no uncaught page errors',log.pageErrors.length===0,{pageErrors:log.pageErrors.slice(0,5)});
    const characterFailures=log.badResponses.filter(response=>/\.glb/.test(response.url));
    check('no failed GLB responses',characterFailures.length===0,{characterFailures});
  }catch(error){
    check('harness ran to completion',false,{error:String(error?.stack||error).slice(0,1500)});
  }finally{
    if(log){report.console={errors:log.console.filter(entry=>entry.type==='error'),warnings:log.console.filter(entry=>entry.type==='warning').slice(0,60),warningCount:log.console.filter(entry=>entry.type==='warning').length},report.pageErrors=log.pageErrors;report.failedRequests=log.failedRequests;report.badResponses=log.badResponses;report.glbRequests=log.glbRequests;}
    report.finishedAt=new Date().toISOString();report.failed=failed().map(item=>item.name);
    writeReport(out,report);
    await browser.close().catch(()=>{});
    await server.stop();
    console.log(`\n${checks.filter(item=>item.pass).length}/${checks.length} checks passed (${failed().length} hard failures). Report: ${path.join(out,'report.json')}`);
    process.exitCode=failed().length?1:0;
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
