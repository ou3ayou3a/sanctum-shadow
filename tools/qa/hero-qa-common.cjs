'use strict';
// Shared helpers for the Fallen Paladin hero browser QA harnesses (tools/qa/hero-*.cjs).
// Local QA only: never loaded by the game or the production server.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const PLAYWRIGHT=process.env.PLAYWRIGHT_PATH||'/Users/michelzakhia/Downloads/integrity-ledger/node_modules/playwright';
const CHROMIUM_ARGS=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const HERO_URL_PART='characters/heroes/fallen_paladin.glb';
// Console text that must never appear while a hero is in play.
const FORBIDDEN_CONSOLE=[/Character model failed/,/Hero model \S+ failed/,/Production equipment failed/,/PropertyBinding: No target node/,/FP_Sword node missing/];

function parseArgs(argv,defaults){
  const options={...defaults};
  for(let index=0;index<argv.length;index++){
    const arg=argv[index];if(!arg.startsWith('--'))continue;
    const [key,inline]=arg.slice(2).split('=');const name=key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    if(inline!==undefined)options[name]=inline;
    else if(argv[index+1]&&!argv[index+1].startsWith('--'))options[name]=argv[++index];
    else options[name]=true;
  }
  return options;
}

function ping(port){return new Promise(resolve=>{const request=http.get({host:'127.0.0.1',port,path:'/',timeout:1500},response=>{response.resume();resolve(response.statusCode<500);});request.on('error',()=>resolve(false));request.on('timeout',()=>{request.destroy();resolve(false);});});}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Uses a server already listening on --port, otherwise starts `node server.js` from this checkout
// on that port (no Claude key, sessions written to a temp file) and stops it when the run ends.
async function ensureServer(port,{log=()=>{},allowStart=true}={}){
  if(await ping(port)){log(`using the server already on port ${port}`);return{child:null,stop:async()=>{}};}
  if(!allowStart)throw new Error(`No server on port ${port} and --no-start was given.`);
  const sessionsFile=path.join(os.tmpdir(),`sanctum-hero-qa-sessions-${port}-${process.pid}.json`);
  const env={...process.env,PORT:String(port),SESSIONS_FILE:sessionsFile};
  for(const key of Object.keys(env))if(/ANTHROPIC|CLAUDE_API|OPENAI/i.test(key))delete env[key];
  const child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
  const output=[];child.stdout.on('data',chunk=>output.push(String(chunk)));child.stderr.on('data',chunk=>output.push(String(chunk)));
  const started=Date.now();
  while(!(await ping(port))){if(child.exitCode!==null)throw new Error(`server.js exited early:\n${output.join('')}`);if(Date.now()-started>20000){child.kill('SIGTERM');throw new Error(`server.js did not answer on port ${port}:\n${output.join('')}`);}await sleep(250);}
  log(`started server.js on port ${port} (pid ${child.pid})`);
  const stop=async({logFile=null}={})=>{if(logFile){try{fs.mkdirSync(path.dirname(logFile),{recursive:true});fs.writeFileSync(logFile,output.join(''));}catch{}}if(child.exitCode===null){child.kill('SIGTERM');for(let i=0;i<20&&child.exitCode===null;i++)await sleep(100);if(child.exitCode===null)child.kill('SIGKILL');}for(const file of[sessionsFile,`${sessionsFile}.tmp`])try{fs.unlinkSync(file);}catch{}};
  const onExit=()=>{try{child.kill('SIGKILL');}catch{}};process.once('exit',onExit);
  return{child,stop,output};
}

async function launchBrowser({headed=false}={}){
  const {chromium}=require(PLAYWRIGHT);
  return chromium.launch({headless:!headed,args:CHROMIUM_ARGS});
}

// Console, page-error and failed-request capture for one page.
function watchPage(page,label){
  const log={label,console:[],pageErrors:[],failedRequests:[],badResponses:[],glbRequests:[]};
  page.on('console',message=>log.console.push({type:message.type(),text:message.text().slice(0,600),at:Date.now()}));
  page.on('pageerror',error=>log.pageErrors.push(String(error?.stack||error).slice(0,1200)));
  page.on('requestfailed',request=>log.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{const url=response.url();if(/\.glb(\?|$)/.test(url))log.glbRequests.push({url:url.replace(/^https?:\/\/[^/]+\//,''),status:response.status()});if(response.status()>=400)log.badResponses.push({url,status:response.status()});});
  return log;
}
function forbiddenConsole(log){return log.console.filter(entry=>FORBIDDEN_CONSOLE.some(pattern=>pattern.test(entry.text)));}

// In-page helpers (installed before any page script runs). They only read state from window.__world3d.
function installInspector(){
  window.__heroQA={
    actorInfo(actor){
      if(!actor)return null;
      const names=[],skinned=[],materials=[];let mace=false,shield=false,visor=false;
      actor.traverse?.(object=>{if(object.name)names.push(object.name);if(/production-equipment:(mace|shield)/.test(object.name||'')){if(object.name.includes('mace'))mace=true;else shield=true;}if(object.name==='vanguard_visor')visor=true;});
      const model=actor.model;let box=null;
      if(model&&!model.userData?.actorFallback){
        model.updateMatrixWorld(true);
        model.traverse(object=>{if(!object.isSkinnedMesh)return;skinned.push(object.name);for(const material of[].concat(object.material||[]))if(material?.color)materials.push({mesh:object.name,material:material.name,rgb:material.color.toArray().map(value=>+value.toFixed(4))});object.computeBoundingBox();const b=object.boundingBox.clone().applyMatrix4(object.matrixWorld);box=box?box.union(b):b;});
      }
      const bone=name=>model?.getObjectByName(name)||model?.getObjectByName(String(name).replace(':',''));
      const boneWorld=name=>{const b=bone(name);if(!b)return null;const v=b.position.clone();b.getWorldPosition(v);return v.toArray().map(value=>+value.toFixed(4));};
      return{
        modelUrl:actor.modelUrl,hero:actor.hero?.id||null,heroScale:actor.heroScale??null,race:actor.race,characterClass:actor.characterClass,state:actor.state,
        loadError:actor.loadError?String(actor.loadError.message||actor.loadError):null,heroLoadError:actor.heroLoadError?String(actor.heroLoadError.message||actor.heroLoadError):null,
        fallbackCapsule:!!model?.userData?.actorFallback,mixer:!!actor.mixer,actions:Object.keys(actor.actions||{}).sort(),
        held:(actor.heldEquipment||[]).map(object=>({name:object.name,visible:object.visible,bone:object.userData?.equipmentBone,parent:object.parent?.name||null})),
        stowed:(actor.stowedEquipment||[]).map(object=>({name:object.name,visible:object.visible,bone:object.userData?.equipmentBone,parent:object.parent?.name||null})),
        equipmentDrawn:!!actor.equipmentDrawn,mace,shield,visor,skinned,materials,
        modelScale:model?model.scale.toArray().map(value=>+value.toFixed(4)):null,
        position:actor.position.toArray().map(value=>+value.toFixed(3)),
        bbox:box?{min:box.min.toArray().map(value=>+value.toFixed(3)),max:box.max.toArray().map(value=>+value.toFixed(3)),height:+(box.max.y-box.min.y).toFixed(3)}:null,
        bones:{hips:boneWorld('mixamorig:Hips'),head:boneWorld('mixamorig:Head'),rightHand:boneWorld('mixamorig:RightHand'),leftHand:boneWorld('mixamorig:LeftHand'),leftFoot:boneWorld('mixamorig:LeftFoot')},
        activeClip:actor.activeAction?.getClip?.().name||null,activeWeight:actor.activeAction?+actor.activeAction.getEffectiveWeight().toFixed(3):null,
      };
    },
    sceneActors(engine=window.__world3d){
      const actors=[];engine?.scene?.traverse(object=>{if(object.modelUrl!==undefined&&typeof object.load==='function')actors.push(object);});
      return actors.map(actor=>({kind:actor===engine.actor?'player':actor.userData?.npcId?'npc':actor.userData?.partyPlayerId?'party':actor.userData?.combatantId?'combat':'other',id:actor.userData?.npcId||actor.userData?.partyPlayerId||actor.userData?.combatantId||null,modelUrl:actor.modelUrl,hero:actor.hero?.id||null,race:actor.race,characterClass:actor.characterClass}));
    },
    npcInfo(engine=window.__world3d){
      return(engine?.npcManager?.records||[]).map(record=>({id:record.config.id,classId:record.config.classId||null,race:record.config.race||null,loaded:!!record.actor,modelUrl:record.actor?.modelUrl||null,hero:record.actor?.hero?.id||null}));
    },
    // Screen position of a world point for a real mouse click.
    project(x,y,z,engine=window.__world3d){
      const v=engine.actor.position.clone().set(x,y,z).project(engine.camera),rect=engine.canvas.getBoundingClientRect();
      return{x:rect.left+(v.x*.5+.5)*rect.width,y:rect.top+(-v.y*.5+.5)*rect.height,ndc:{x:v.x,y:v.y},onScreen:Math.abs(v.x)<.85&&Math.abs(v.y)<.85&&v.z<1};
    },
    // True when a click at ndc would reach the ground near point (not an NPC, landmark or door collider).
    groundOnly(ndc,point,engine=window.__world3d){
      engine.raycaster.setFromCamera(ndc,engine.camera);
      if(engine.raycaster.intersectObjects(engine.interactionObjects,true).length)return false;
      const hit=engine.raycaster.intersectObject(engine.zone.ground,true)[0];
      return!!hit&&Math.hypot(hit.point.x-point.x,hit.point.z-point.z)<.6;
    },
  };
}

async function waitForWorld(page,{zone=null,previous=false,timeout=180000}={}){
  await page.waitForFunction(({zone,previous})=>{const engine=window.__world3d;if(!engine||!engine.actor||engine.actor.state==='loading')return false;if(!engine.actor.mixer&&!engine.actor.loadError)return false;if(previous&&engine===window.__heroQAPrevEngine)return false;if(zone&&engine.zone?.id!==zone)return false;return true;},{zone,previous},{timeout,polling:250});
  return page.evaluate(()=>({zone:window.__world3d.zone.id,location:window.mapState?.currentLocation}));
}

// Real character creation: name, race card, class card, tree card, origin, dice roll, portrait, Seal My Fate, reveal choice, Enter the Chronicle.
async function createCharacterThroughUi(page,{name,race,characterClass,origin='divine_chosen',reveal='truth'}){
  await page.waitForSelector('#char-creation-screen.active',{timeout:20000});
  await page.fill('#char-name',name);
  await page.click(`.race-card[data-race-id="${race}"]`);
  await page.click('#step-1 > .btn-primary');
  await page.click(`.class-card[data-class-id="${characterClass}"]`);
  await page.click('#step-2 .step-nav .btn-primary');
  await page.click('#skill-trees .tree-card >> nth=0');
  await page.click('#step-3 .step-nav .btn-primary');
  await page.selectOption('#char-origin',origin);
  await page.click('#step-4 .step-nav .btn-primary');
  await page.click('#roll-btn');
  await page.waitForFunction(()=>typeof gameState!=='undefined'&&gameState.statsRolled===true,null,{timeout:10000});
  await page.click('#to-step-6-btn');
  await page.waitForSelector('#finalize-btn',{state:'visible',timeout:10000});
  await page.click('#finalize-btn');
  await page.waitForSelector('#backstory-reveal-screen.active',{timeout:10000});
  await page.click(`.btn-reveal.${reveal}`);
  await page.waitForSelector('#enter-game-btn',{state:'visible',timeout:5000});
  const character=await page.evaluate(()=>({name:gameState.character?.name,race:gameState.character?.race,class:gameState.character?.class,tree:gameState.character?.tree}));
  await page.click('#enter-game-btn');
  return character;
}

// Moves the gameplay camera to a fixed distance behind the actor (same orbit direction) and waits a few frames.
// reset=true restores the zone's default follow direction (zone.cameraOffset or (0, 7.5, 8)).
async function frameCamera(page,distance=null,{reset=false}={}){
  await page.evaluate(({distance,reset})=>{const engine=window.__world3d;if(!engine)return;const target=engine.actor.position.clone();target.y+=1.25;engine.controls.target.copy(target);engine.cameraPanOffset?.set(0,0,0);let offset=engine.camera.position.clone().sub(target);if(reset){const preset=engine.zone.cameraOffset;offset=preset?preset.clone():offset.set(0,7.5,8);offset.y-=1.25;}if(distance){offset.setLength(distance);}engine.camera.position.copy(target).add(offset);engine.controls.update();},{distance,reset});
  await page.waitForTimeout(350);
}

// Centres the gameplay camera on a world point through the engine's own camera pan offset (the arrow-key pan),
// keeping the current orbit direction at the given distance. frameCamera() clears the pan again.
async function focusCamera(page,point,distance=7){
  await page.evaluate(({point,distance})=>{const engine=window.__world3d,actor=engine.actor;engine.cameraPanOffset.set(point.x-actor.position.x,0,point.z-actor.position.z);const target=actor.position.clone().add(engine.cameraPanOffset);target.y+=1.25;const offset=engine.camera.position.clone().sub(engine.controls.target).setLength(distance);engine.controls.target.copy(target);engine.camera.position.copy(target).add(offset);engine.controls.update();},{point,distance});
  await page.waitForTimeout(500);
}

// baseColorFactor of every material in the hero GLB, so a test can tell "untinted" from "multiplied by the race tint".
function heroMaterialFactors(file=path.join(ROOT,'site/world3d/assets/production/characters/heroes/fallen_paladin.glb')){
  const bytes=fs.readFileSync(file),json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  return Object.fromEntries((json.materials||[]).map(material=>[material.name||'',(material.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]).slice(0,3)]));
}
function untinted(materials,factors){return materials.length>0&&materials.every(material=>(factors[material.material]||[1,1,1]).every((value,index)=>Math.abs(material.rgb[index]-value)<2e-3));}

// Random road/stranger encounters (travel.js) can pop a modal after a location change. Answer it like a player
// would, preferring a non-combat "leave" style option, so screenshots and later steps are not blocked.
async function dismissTravelEncounter(page,{wait=3000}={}){
  await page.waitForTimeout(wait);
  const choice=await page.evaluate(()=>{
    const panel=document.getElementById('travel-encounter-panel');if(!panel)return null;
    const enc=window._currentTravelEncounter?.enc,buttons=[...panel.querySelectorAll('button.tep-option:not([disabled])')];
    const weights={escape:6,reward:4,item:2,delay:1,roll:-1,spend_gold:-1,lose_gold:-2,use_consumable:-2,use_item:-2,steal:-3,escort:-4,damage:-4,combat_chance:-5,combat:-6};
    const score=button=>{const option=enc?.options?.[Number(button.dataset.optIndex)]||{};let value=weights[option.action]??0;if(/leave|ignore|decline|refuse|walk on|continue|pass/i.test(button.textContent))value+=2;return value;};
    const best=buttons.sort((a,b)=>score(b)-score(a))[0];if(!best)return{title:enc?.title||null,clicked:null};
    return{title:enc?.title||null,type:enc?.type||null,index:Number(best.dataset.optIndex),text:best.textContent.replace(/\s+/g,' ').trim()};
  });
  if(choice?.index!==undefined&&choice.index!==null&&!Number.isNaN(choice.index)){await page.click(`#travel-encounter-panel button.tep-option[data-opt-index="${choice.index}"]`).catch(()=>{});await page.waitForTimeout(600);}
  return choice;
}

function writeReport(out,report){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}

function checker(){
  const checks=[];
  const check=(name,pass,detail={},{soft=false}={})=>{checks.push({name,pass:!!pass,soft,detail});const tag=pass?'PASS':soft?'WARN':'FAIL';console.log(`${tag}  ${name}${detail&&Object.keys(detail).length?`  ${JSON.stringify(detail).slice(0,400)}`:''}`);return!!pass;};
  return{checks,check,failed:()=>checks.filter(item=>!item.pass&&!item.soft)};
}

module.exports={focusCamera,dismissTravelEncounter,heroMaterialFactors,untinted,ROOT,HERO_URL_PART,FORBIDDEN_CONSOLE,parseArgs,ensureServer,launchBrowser,watchPage,forbiddenConsole,installInspector,waitForWorld,createCharacterThroughUi,frameCamera,writeReport,checker,sleep};
