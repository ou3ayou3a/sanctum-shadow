#!/usr/bin/env node
'use strict';
// Identical-pose render harness for the Fallen Paladin hero (BUILD-SPEC §6.4).
//
// Loads each GLB in headless Chromium through the game's OWN code: CharacterActor (character-actor.js: clip→state
// mapping, rotationOffset π, hero race-height scale, untinted hero materials, envMapIntensity) and equipClass
// (class-equipment.js: 'fallen_longsword' holds FP_Sword in the right hand, stows a clone on the left hip), with
// the game's three r160 served at /vendor/three exactly like index.html's importmap. Every model is posed at the
// SAME clip times and photographed from the SAME cameras under game-like light (hemisphere + directional sun +
// ACES filmic tone mapping at the engine's default exposure, plus the sky IBL from sky-environment.mjs).
//
// usage:
//   node tools/qa/hero-pose-renders.cjs --out <dir> [--model <name>=<glb>]... [--race human] [--port 3312]
//        [--size 1024] [--gl metal|swiftshader] [--only idle,run25,...] [--bg neutral|sky] [--no-baseline]
//        [--no-fpsword-baseline] [--baseline <glb>] [--headed] [--extra <json>]
//
//   --model name=path   a hero candidate GLB, loaded as hero 'fallen_paladin' (repeatable; order = sheet row order).
//                       name=path@sockets.json renders that model with other FALLEN_LONGSWORD_SOCKETS values
//                       ({"held":{position,rotation},"stowed":{position,rotation,scale}}, same units as class-equipment.js),
//                       re-seated exactly like equipClass/bindStowedSockets do at load (socket tuning only).
//   --baseline path     the race model used as the live baseline (default: the worktree's characters/human.glb),
//                       loaded as a <race> paladin with the live class equipment (mace + shield).
//   --fpsword-baseline  (default on when a --model is given) also renders the baseline rig holding the first
//                       candidate's FP_Sword through the same 'fallen_longsword' socket, to separate socket problems
//                       from hand-mesh problems.
//   --race              the race whose standing height the hero is normalised to (RACE_MODEL_HEIGHTS), default human.
//   --extra file.json   extra poses and close-up groups, appended to the built-in ones:
//                       {"poses":[{"id","state","clip","at":{"seconds"|"fraction"},"drawn"}],  (state 'bind' = skin bind pose)
//                        "closeups":[{"group","note","poses":[ids],"cameras":[{"id","bone","offset":[x,y,z],"height","az","el","slab"}]}]}
//                       A camera with "bone" is aimed at that bone's world position (+offset, metres, scaled to the race
//                       height) and frames "height" metres (also scaled); az/el as for the gameplay cameras.
//
// Output: <out>/<name>/<pose>_<camera>.png for every model, <out>/sheets/<pose>[_<group>].png contact sheets
// (rows = models, columns = cameras), <out>/<name>/_overview.png, <out>/poses.json (clip times and how each
// "peak" was chosen) and <out>/report.json (load status, clip mapping, per-pose ground/facing/grip numbers).
// A static server is started on 127.0.0.1:<port> for the run only and closed at the end.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');

const ROOT=path.resolve(__dirname,'../..');
const SITE=path.join(ROOT,'site');
const THREE_DIR=path.join(ROOT,'node_modules','three');
const PLAYWRIGHT=process.env.PLAYWRIGHT_PATH||'/Users/michelzakhia/Downloads/integrity-ledger/node_modules/playwright';

function parseArgs(argv){
  const options={model:[]};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];if(!arg.startsWith('--'))continue;
    let [key,inline]=arg.slice(2).split(/=(.*)/s);const name=key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    let value=inline;if(value===undefined){if(argv[i+1]&&!argv[i+1].startsWith('--'))value=argv[++i];else value=true;}
    if(name.startsWith('no')&&value===true){options[name[2].toLowerCase()+name.slice(3)]=false;continue;}
    if(name==='model')options.model.push(value);else options[name]=value;
  }
  return options;
}

const options=parseArgs(process.argv.slice(2));
const PORT=Number(options.port||3312);
const SIZE=Number(options.size||1024);
const OUT=path.resolve(options.out||path.join(os.tmpdir(),'hero-pose-renders'));
const RACE=String(options.race||'human');
const GL=String(options.gl||'metal');
const BG=String(options.bg||'neutral');
const ONLY=options.only?String(options.only).split(',').map(s=>s.trim()).filter(Boolean):null;

// ---------------------------------------------------------------- models
const models=[];
const baselinePath=path.resolve(options.baseline&&options.baseline!==true?options.baseline:path.join(SITE,'world3d/assets/production/characters',`${RACE}.glb`));
const heroModels=options.model.map(spec=>{const at=String(spec).indexOf('=');if(at<1)throw new Error(`--model expects name=path, got ${spec}`);const [file,sock]=spec.slice(at+1).split('@');return{name:spec.slice(0,at),file:path.resolve(file),kind:'hero',sockets:sock?JSON.parse(fs.readFileSync(path.resolve(sock),'utf8')):null};});
for(const m of heroModels)if(!/^[a-z0-9_-]+$/i.test(m.name))throw new Error(`model name must be [a-z0-9_-]: ${m.name}`);
if(options.baseline!==false)models.push({name:RACE,file:baselinePath,kind:'race',label:`${RACE}.glb (live baseline, ${RACE} paladin: mace + shield)`});
if(options.baseline!==false&&options.fpswordBaseline!==false&&heroModels.length)models.push({name:`${RACE}_fpsword`,file:baselinePath,kind:'race_fpsword',swordFrom:heroModels[0].name,label:`${RACE}.glb + FP_Sword from '${heroModels[0].name}' in the fallen_longsword socket`});
for(const m of heroModels)models.push({...m,label:`${m.name} (hero, scaled to ${RACE} height)`});
if(!models.length)throw new Error('nothing to render');
for(const m of models)if(!fs.existsSync(m.file))throw new Error(`missing GLB for ${m.name}: ${m.file}`);
const modelFiles=Object.fromEntries(models.map(m=>[m.name,m.file]));
for(const m of heroModels)modelFiles[m.name]=m.file;

// ---------------------------------------------------------------- poses and cameras
// Times are absolute seconds on the shared clips (the hero clips are transplanted copies of the race clips, so
// durations match; report.json checks this). "peak" times are measured on the baseline rig (see poses.json).
const POSES=[
  {id:'idle',state:'idle',clip:'Idle',at:{seconds:.5},drawn:false},
  {id:'walk25',state:'walk',clip:'Walk',at:{fraction:.25},drawn:false},
  {id:'walk75',state:'walk',clip:'Walk',at:{fraction:.75},drawn:false},
  {id:'run25',state:'run',clip:'Run',at:{fraction:.25},drawn:false},
  {id:'run75',state:'run',clip:'Run',at:{fraction:.75},drawn:false},
  {id:'slash-peak',state:'attack_slash',clip:'Attack_Slash',at:{peak:'rightArmRaise'},drawn:true},
  {id:'heavy-peak',state:'attack_heavy',clip:'Attack_Heavy',at:{peak:'eitherArmRaise'},drawn:true},
  {id:'heavy-windup',state:'attack_heavy',clip:'Attack_Heavy',at:{peak:'rightArmRaise'},drawn:true,extra:'the sword arm\'s own highest point (the clip raises the right arm first, then the left arm higher)'},
  {id:'smite-impact',state:'attack_smite',clip:'Attack_Smite',at:{fraction:.57},drawn:true,extra:'the paladin\'s in-game attack (combat-presentation.js paladin impactFraction 0.57)'},
  {id:'cast-peak',state:'cast',clip:'Cast',at:{peak:'armsRaise'},drawn:true},
  {id:'block-mid',state:'block',clip:'Block',at:{fraction:.5},drawn:true},
  {id:'hit-mid',state:'hit',clip:'Hit',at:{fraction:.5},drawn:true},
  {id:'death-end',state:'death',clip:'Death',at:{fraction:1},drawn:true},
  {id:'combat-idle',state:'combat_idle',clip:'Combat_Idle',at:{seconds:.5},drawn:true},
];
// Gameplay cameras. The actor faces +Z; its right side is -X. az = camera azimuth around the actor (0 = in front).
const GAMEPLAY_CAMERAS=[
  {id:'front',az:0},{id:'side-right',az:-90},{id:'rear',az:180},{id:'34front-left',az:45},
];
const CLOSEUPS=[
  {group:'close-legs',poses:['run25','run75','walk25','walk75'],cameras:[{id:'close-legs-rear',az:180},{id:'close-legs-right',az:-90},{id:'close-legs-left',az:90}],note:'legs, cape and tabard; left view shows the stowed sword on the left hip'},
  {group:'close-shoulders',poses:['heavy-peak','heavy-windup','cast-peak','slash-peak'],cameras:[{id:'close-shoulders-front',az:0},{id:'close-shoulders-right',az:-90},{id:'close-shoulders-rear',az:180},{id:'close-shoulders-34front-left',az:45}],note:'shoulders, pauldrons and elbows'},
  {group:'close-hand',poses:['slash-peak','combat-idle','smite-impact'],cameras:[{id:'close-hand-back',hand:'back'},{id:'close-hand-palm',hand:'palm'},{id:'close-hand-thumb',hand:'thumb'},{id:'close-hand-front',az:0}],note:'right hand and sword grip; back/palm/thumb are taken along the RightHand bone axes'},
  {group:'close-stow',kind:'legs',poses:['idle','walk25','walk75'],cameras:[{id:'close-stow-left',az:90},{id:'close-stow-front',az:0},{id:'close-stow-34left',az:45},{id:'close-stow-34rear-left',az:135}],note:'stowed FP_Sword on the left hip while exploring (same framing as close-legs)'},
  {group:'close-sword',kind:'sword',poses:['combat-idle','idle'],cameras:[{id:'close-sword-right',az:-90},{id:'close-sword-front',az:0},{id:'close-sword-34front-right',az:-45},{id:'close-sword-34front-left',az:45}],note:'whole blade in frame around the right hand (held sword in Combat_Idle; in Idle it is sheathed, so the hand is empty)'},
  {group:'close-cape',kind:'cape',poses:['death-end'],cameras:[{id:'close-cape-rear',az:180},{id:'close-cape-right',az:-90},{id:'close-cape-left',az:90},{id:'close-cape-34rear-left',az:135}],note:'cape at the end of Death (FP_CapeDrape corrective at full influence)'},
];
if(options.extra&&options.extra!==true){
  const extra=JSON.parse(fs.readFileSync(path.resolve(String(options.extra)),'utf8'));
  for(const p of extra.poses||[]){if(POSES.some(q=>q.id===p.id))throw new Error(`--extra pose id ${p.id} already exists`);POSES.push({at:{seconds:0},drawn:true,...p,clip:p.clip||p.state});}
  for(const g of extra.closeups||[])CLOSEUPS.push({kind:'bone',...g});
}
const selectedPoses=ONLY?POSES.filter(p=>ONLY.includes(p.id)):POSES;
if(!selectedPoses.length)throw new Error(`--only matched no pose (known: ${POSES.map(p=>p.id).join(', ')})`);

// ---------------------------------------------------------------- page
const PAGE_HTML=`<!doctype html><html><head><meta charset="utf-8"><title>hero pose renders</title>
<script type="importmap">{ "imports": { "three": "/vendor/three/build/three.module.js", "three/addons/": "/vendor/three/examples/jsm/" } }</script>
<style>html,body{margin:0;background:#222}canvas{display:block}</style></head><body><canvas id="c"></canvas>
<script type="module" src="/__hero_pose.mjs"></script></body></html>`;

const PAGE_MODULE=String.raw`
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterActor} from '/world3d/character-actor.js?v=180';
import {equipClass} from '/world3d/class-equipment.js?v=164';
import {SkyEnvironment} from '/world3d/sky-environment.mjs?v=2';
import {heroScaleForRace,RACE_MODEL_HEIGHTS} from '/world3d/production-assets.mjs?v=165';

const warnings=[];const ow=console.warn.bind(console);console.warn=(...a)=>{warnings.push(a.map(String).join(' ').slice(0,400));ow(...a);};
const state={};
const CLOSEUP_FILL=.9;

function gridTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
  g.fillStyle='#8d877b';g.fillRect(0,0,512,512);g.strokeStyle='#6c665c';g.lineWidth=3;
  for(let i=0;i<=4;i++){const p=i*128;g.beginPath();g.moveTo(p,0);g.lineTo(p,512);g.stroke();g.beginPath();g.moveTo(0,p);g.lineTo(512,p);g.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(200,200);t.anisotropy=8;return t;
}

window.heroInit=async function({name,kind,url,race,size,bg,swordFromUrl,sockets}){
  const canvas=document.getElementById('c');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(size,size,false);
  // world-engine.js L37-38: PCF soft shadows, ACES filmic, exposure 1.12, sRGB output.
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  // world-engine.js L42-43: hemisphere 0xc4d4bd/0x30281f x2.35, sun 0xffefd2 x2.8 at (-9,18,10) relative to the camera side.
  const hemi=new THREE.HemisphereLight(0xc4d4bd,0x30281f,2.35);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffefd2,2.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-2.6,right:2.6,top:2.6,bottom:-2.6,near:1,far:60});sun.shadow.bias=-.0003;sun.shadow.normalBias=.012;
  scene.add(sun);scene.add(sun.target);
  // Close-ups only: a weak unshadowed headlight so palms, armpits and the inside of the cape are readable (not a game light).
  const fill=new THREE.DirectionalLight(0xffffff,0);scene.add(fill);scene.add(fill.target);
  // sky-environment.mjs: the game's sky-derived PMREM IBL for an outdoor zone (Vaelthar background 0x1b2422).
  const engineLike={renderer,scene,zone:{root:{userData:{}},scene:{background:0x1b2422}}};
  new SkyEnvironment(engineLike).install();
  if(bg!=='sky')scene.background=new THREE.Color(0x737b82); // neutral backdrop so the black armour reads; lighting unchanged
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({map:gridTexture(),roughness:.95,metalness:0}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

  const actor=new CharacterActor({race,characterClass:'paladin',hero:kind==='hero'?'fallen_paladin':null,scale:1});
  actor.modelUrl=url; // same loader path, the candidate file instead of the shipped one
  await actor.load();
  // Node rest TRS straight after loading (before any mixer update) = the GLB's bind pose, for the 'bind' pose.
  state.restTRS=[];actor.model.traverse(o=>{if(o.isBone)state.restTRS.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});
  const info={name,kind,modelUrl:actor.modelUrl,hero:actor.hero?.id||null,heroScale:actor.heroScale,expectedHeroScale:kind==='hero'?heroScaleForRace('fallen_paladin',race):1,raceHeight:RACE_MODEL_HEIGHTS[race],
    loadError:actor.loadError?String(actor.loadError?.message||actor.loadError):null,heroLoadError:actor.heroLoadError?String(actor.heroLoadError?.message||actor.heroLoadError):null,
    fallbackCapsule:!!actor.model?.userData?.actorFallback};
  if(info.loadError||info.heroLoadError||info.fallbackCapsule){return{ok:false,info,warnings};}
  if(kind==='race_fpsword'){
    // Borrow FP_Sword from a candidate and equip it through the real 'fallen_longsword' branch on the race rig.
    const gltf=await new GLTFLoader().loadAsync(swordFromUrl);const sword=gltf.scene.getObjectByName('FP_Sword');
    if(!sword)throw new Error('FP_Sword missing in '+swordFromUrl);
    for(const o of[...(actor.heldEquipment||[]),...(actor.stowedEquipment||[])])o.removeFromParent();
    actor.classGear?.removeFromParent();actor.model.add(sword.clone(true));
    await equipClass(actor,{...actor.classProfile,weapon:'fallen_longsword'});
  }
  if(sockets){
    // Socket tuning: re-seat FP_Sword / FP_Sword_stowed with candidate values, the same way equipClass does at load
    // (held: bone-local cm; stowed: actor space at model scale 1 x hero scale, attached to its bone in the bind pose).
    for(const [o,p,q,s] of state.restTRS){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}actor.updateWorldMatrix(true,true);
    const k=actor.model.scale.y||1;
    const held=(actor.heldEquipment||[]).find(o=>o.name==='FP_Sword'),stowed=(actor.stowedEquipment||[]).find(o=>o.name==='FP_Sword_stowed');
    if(sockets.held&&held){held.position.set(...sockets.held.position);held.rotation.set(...sockets.held.rotation);}
    if(sockets.stowed&&stowed){const bone=stowed.parent;const tmp=new THREE.Object3D();actor.add(tmp);tmp.position.set(...sockets.stowed.position.map(v=>v*k));tmp.rotation.set(...sockets.stowed.rotation);tmp.scale.setScalar(sockets.stowed.scale*k);tmp.updateWorldMatrix(true,false);
      const target=tmp.matrixWorld.clone();actor.remove(tmp);const local=bone.matrixWorld.clone().invert().multiply(target);local.decompose(stowed.position,stowed.quaternion,stowed.scale);}
    actor.updateWorldMatrix(true,true);
  }
  for(const o of[actor.selectionRing,actor.weaponTrail,actor.classAura])if(o)o.visible=false;
  scene.add(actor);actor.position.set(0,0,0);actor.rotation.set(0,0,0);
  const camera=new THREE.PerspectiveCamera(44,1,.03,80); // world-engine.js: fov 44
  const clips={};for(const [key,action] of Object.entries(actor.actions))clips[key]={clip:action.getClip().name,duration:+action.getClip().duration.toFixed(5)};
  const allClips=(actor.mixer?._actions||[]).length;
  Object.assign(state,{renderer,scene,camera,sun,fill,actor,size,name});
  const sk=[];actor.model.traverse(o=>{if(o.isSkinnedMesh)sk.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3});});
  const gl=renderer.getContext();const dbg=gl.getExtension('WEBGL_debug_renderer_info');
  info.glRenderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  info.held=(actor.heldEquipment||[]).map(o=>({name:o.name,bone:o.userData?.equipmentBone,position:o.position.toArray(),rotation:o.rotation.toArray().slice(0,3)}));
  info.stowed=(actor.stowedEquipment||[]).map(o=>({name:o.name,bone:o.userData?.equipmentBone}));
  info.modelScale=actor.model.scale.toArray();info.rotationOffset=actor.model.rotation.y;info.skinned=sk;info.clips=clips;
  info.materials=[];actor.model.traverse(o=>{if(o.isMesh&&o.material)for(const m of[].concat(o.material))info.materials.push({mesh:o.name,color:m.color?.toArray().map(v=>+v.toFixed(3)),envMapIntensity:m.envMapIntensity});});
  return{ok:true,info,warnings};
};

function applyPose(stateKey,time){
  const {actor}=state,mixer=actor.mixer;mixer.stopAllAction();
  if(stateKey==='bind'){for(const [o,p,q,s] of state.restTRS){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}actor.updateMatrixWorld(true);return{getClip:()=>({name:'bind'})};}
  const action=actor.actions[stateKey];if(!action)throw new Error('no action for state '+stateKey);
  action.reset();action.setLoop(THREE.LoopRepeat,Infinity);action.clampWhenFinished=false;action.enabled=true;
  action.setEffectiveTimeScale(1);action.setEffectiveWeight(1);action.play();action.time=time;mixer.update(0);
  // Same per-frame hook as CharacterActor.update(): the hero's Death cape-drape morph follows the Death clip progress.
  actor.state=stateKey;state.capeDrape=actor.updateCapeDrape?actor.updateCapeDrape():null;
  actor.updateMatrixWorld(true);
  return action;
}

const V=()=>new THREE.Vector3();
function bone(name){const m=state.actor.model;return m.getObjectByName(name)||m.getObjectByName(String(name).replace(':',''));}
function boneWorld(name){const b=bone(name);if(!b)return null;return b.getWorldPosition(V());}
function metrics(){
  const {actor}=state;let box=null;
  actor.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.computeBoundingBox();const b=o.boundingBox.clone().applyMatrix4(o.matrixWorld);box=box?box.union(b):b;});
  const toe=boneWorld('mixamorig:LeftToeBase'),foot=boneWorld('mixamorig:LeftFoot');
  const out={skinMinY:+box.min.y.toFixed(4),skinMaxY:+box.max.y.toFixed(4),facingZ:+(toe.z-foot.z).toFixed(4),capeDrape:state.capeDrape??null};
  const held=(actor.heldEquipment||[]).find(o=>o.name==='FP_Sword');
  if(held&&held.visible){
    const grip=held.localToWorld(V().set(0,-15.7,0)),hand=boneWorld('mixamorig:RightHand'),mid=boneWorld('mixamorig:RightHandMiddle1');
    const tip=held.localToWorld(V().set(0,112.8,0));
    out.grip={gripToWrist:+grip.distanceTo(hand).toFixed(4),gripToMiddle1:+grip.distanceTo(mid).toFixed(4),tipY:+tip.y.toFixed(3)};
  }
  return out;
}

function frame({target,az=0,el=12,height,dir=null,up=null,slab=0,fill=0}){
  const {camera}=state;const d=(height/2)/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  // slab>0: near plane at (distance - slab), so body parts between the camera and the target are cut away (section view).
  camera.near=slab>0?Math.max(.03,d-slab):.03;camera.updateProjectionMatrix();
  const t=new THREE.Vector3(...target);
  const v=dir?new THREE.Vector3(...dir).normalize():new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(az))*Math.cos(THREE.MathUtils.degToRad(el)),Math.sin(THREE.MathUtils.degToRad(el)),Math.cos(THREE.MathUtils.degToRad(az))*Math.cos(THREE.MathUtils.degToRad(el)));
  camera.position.copy(t).addScaledVector(v,d);camera.up.set(...(up||[0,1,0]));camera.lookAt(t);camera.updateMatrixWorld(true);
  // keep the game's sun-to-camera relation: camera offset (0,7.5,8) <-> sun (-9,18,10), rotated with the camera azimuth.
  const azCam=Math.atan2(v.x,v.z);const s=new THREE.Vector3(-9,18,10).applyAxisAngle(new THREE.Vector3(0,1,0),azCam);
  const base=new THREE.Vector3(t.x,0,t.z);state.sun.position.copy(base).add(s);state.sun.target.position.copy(base);state.sun.target.updateMatrixWorld(true);
  state.fill.intensity=fill;state.fill.position.copy(camera.position);state.fill.target.position.copy(t);state.fill.target.updateMatrixWorld(true);
  return d;
}

function capture(caption){
  const {renderer,scene,camera,size}=state;renderer.render(scene,camera);
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.drawImage(renderer.domElement,0,0);
  const fs=Math.round(size/48);g.font=fs+'px -apple-system,Helvetica,Arial,sans-serif';const w=g.measureText(caption).width;
  g.fillStyle='rgba(0,0,0,.55)';g.fillRect(0,size-fs*1.8,w+fs*1.2,fs*1.8);g.fillStyle='#fff';g.fillText(caption,fs*.6,size-fs*.55);
  return c.toDataURL('image/png');
}

// Clip analytics on this rig: upper-arm raise angle (0 = hanging straight down, 90 = horizontal, 180 = straight up).
window.heroAnalyse=function(clipState,samples=120){
  const action=state.actor.actions[clipState];const duration=action.getClip().duration;const rows=[];
  const raise=(a,b)=>{const p=boneWorld(a),q=boneWorld(b);const d=q.sub(p).normalize();return THREE.MathUtils.radToDeg(Math.acos(Math.max(-1,Math.min(1,-d.y))));};
  for(let i=0;i<=samples;i++){const t=duration*i/samples;applyPose(clipState,t);rows.push({t:+t.toFixed(4),right:+raise('mixamorig:RightArm','mixamorig:RightForeArm').toFixed(2),left:+raise('mixamorig:LeftArm','mixamorig:LeftForeArm').toFixed(2),rightHandY:+boneWorld('mixamorig:RightHand').y.toFixed(3)});}
  return{duration,rows};
};

window.heroRender=function({pose,time,drawn,shots,label}){
  const {actor}=state;const action=applyPose(pose.state,time);actor.setEquipmentDrawn(drawn);actor.updateMatrixWorld(true);
  const m=metrics();const out=[];
  for(const shot of shots){
    let spec;
    if(shot.kind==='gameplay')spec={target:[0,shot.refHeight*.5,0],az:shot.az,el:12,height:shot.refHeight/.4};
    else if(shot.kind==='legs'){const h=boneWorld('mixamorig:Hips');spec={target:[h.x,.62*shot.refScale,h.z],az:shot.az,el:8,height:1.45*shot.refScale};}
    else if(shot.kind==='sword'){const r=boneWorld('mixamorig:RightHand');spec={target:[r.x,Math.max(.45*shot.refScale,r.y-.2*shot.refScale),r.z],az:shot.az,el:10,height:1.5*shot.refScale};}
    else if(shot.kind==='cape'){const h=boneWorld('mixamorig:Hips');spec={target:[h.x,Math.max(.5*shot.refScale,h.y*.75),h.z],az:shot.az,el:14,height:2.0*shot.refScale};}
    else if(shot.kind==='shoulders'){const p=['mixamorig:LeftArm','mixamorig:RightArm','mixamorig:LeftForeArm','mixamorig:RightForeArm'].map(boneWorld);const c=p.reduce((a,b)=>a.add(b),V()).multiplyScalar(.25);spec={target:c.toArray(),az:shot.az,el:6,height:1.15*shot.refScale};}
    else if(shot.kind==='hand'){
      const hand=bone('mixamorig:RightHand');const hp=boneWorld('mixamorig:RightHand'),mid=boneWorld('mixamorig:RightHandMiddle1');const target=hp.clone().lerp(mid,.6);
      if(shot.az!==undefined)spec={target:target.toArray(),az:shot.az,el:10,height:.62*shot.refScale,slab:.2*shot.refScale};
      else{const q=hand.getWorldQuaternion(new THREE.Quaternion());const axis={back:[1,0,0],palm:[-1,0,0],thumb:[0,0,1]}[shot.hand];const dir=new THREE.Vector3(...axis).applyQuaternion(q).normalize();
        let up=[0,1,0];if(Math.abs(dir.y)>.92)up=new THREE.Vector3(0,1,0).applyQuaternion(q).toArray();spec={target:target.toArray(),dir:dir.toArray(),up,height:.62*shot.refScale,slab:.16*shot.refScale};}
    }
    else if(shot.kind==='bone'){const p=boneWorld(shot.bone);const o=(shot.offset||[0,0,0]).map(v=>v*shot.refScale);spec={target:[p.x+o[0],p.y+o[1],p.z+o[2]],az:shot.az||0,el:shot.el??10,height:(shot.height||.6)*shot.refScale,slab:shot.slab?shot.slab*shot.refScale:0};}
    if(shot.kind!=='gameplay')spec.fill=CLOSEUP_FILL;
    frame(spec);
    out.push({file:shot.file,png:capture(label+'  ·  '+shot.id+(spec.fill?'  ·  +headlight fill':'')+(spec.slab?'  ·  near-clipped section':''))});
  }
  return{metrics:m,clip:action.getClip().name,time,warningsSoFar:warnings.length,shots:out};
};

window.heroSheet=async function({title,rows,cols,cells,tile,labelW=170,headH=34,titleH=40}){
  const W=labelW+cols.length*tile,H=titleH+headH+rows.length*tile;
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.fillStyle='#1d1f22';g.fillRect(0,0,W,H);
  g.fillStyle='#fff';g.font='bold 22px -apple-system,Helvetica,Arial,sans-serif';g.fillText(title,12,28);
  g.font='16px -apple-system,Helvetica,Arial,sans-serif';
  cols.forEach((col,i)=>{g.fillStyle='#ddd';g.fillText(col,labelW+i*tile+8,titleH+22);});
  const load=src=>new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=src;});
  for(let r=0;r<rows.length;r++){
    g.fillStyle='#eee';g.font='bold 16px -apple-system,Helvetica,Arial,sans-serif';
    const words=rows[r].split(/(?<=[ _])/);let line='',y=titleH+headH+r*tile+28;for(const w of words){if(g.measureText(line+w).width>labelW-16){g.fillText(line,8,y);y+=20;line='';}line+=w;}g.fillText(line,8,y);
    for(let k=0;k<cols.length;k++){const src=cells[r][k];const x=labelW+k*tile,yy=titleH+headH+r*tile;
      if(!src){g.fillStyle='#400';g.fillRect(x+2,yy+2,tile-4,tile-4);continue;}
      const im=await load(src);if(im)g.drawImage(im,x+1,yy+1,tile-2,tile-2);else{g.fillStyle='#600';g.fillRect(x+2,yy+2,tile-4,tile-4);}}
  }
  return c.toDataURL('image/png');
};
window.__heroPoseReady=true;
`;

// ---------------------------------------------------------------- static server (run-scoped)
const TYPES={'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.html':'text/html','.css':'text/css','.ktx2':'image/ktx2'};
function inside(base,file){const rel=path.relative(base,file);return rel&&!rel.startsWith('..')&&!path.isAbsolute(rel);}
function startServer(){
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,`http://127.0.0.1:${PORT}`);const p=decodeURIComponent(url.pathname);
    const send=(code,type,body)=>{res.writeHead(code,{'content-type':type,'cache-control':'no-store'});res.end(body);};
    const file=f=>fs.readFile(f,(err,data)=>err?send(404,'text/plain','not found'):send(200,TYPES[path.extname(f).toLowerCase()]||'application/octet-stream',data));
    if(p==='/__hero_pose.html')return send(200,'text/html',PAGE_HTML);
    if(p==='/__hero_pose.mjs')return send(200,'text/javascript',PAGE_MODULE);
    let m=p.match(/^\/__models\/([A-Za-z0-9_-]+)\.glb$/);if(m){const f=modelFiles[m[1]];return f?file(f):send(404,'text/plain','unknown model');}
    if(p.startsWith('/__out/')){const f=path.join(OUT,p.slice(7));return inside(OUT,f)?file(f):send(403,'text/plain','no');}
    if(p.startsWith('/vendor/three/')){const f=path.join(THREE_DIR,p.slice(14));return inside(THREE_DIR,f)?file(f):send(403,'text/plain','no');}
    const f=path.join(SITE,p);return inside(SITE,f)?file(f):send(403,'text/plain','no');
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,'127.0.0.1',()=>resolve(server));});
}

function writePng(file,dataUrl){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(dataUrl.slice(dataUrl.indexOf(',')+1),'base64'));}
function argmax(rows,fn){let best=rows[0];for(const r of rows)if(fn(r)>fn(best))best=r;return best;}

async function main(){
  const three=require(path.join(THREE_DIR,'package.json')).version;
  if(three!=='0.160.0')console.warn(`[renders] warning: worktree three is ${three}, the game pins 0.160.0`);
  fs.mkdirSync(OUT,{recursive:true});
  const server=await startServer();
  const {chromium}=require(PLAYWRIGHT);
  const args=GL==='swiftshader'?['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']:['--use-angle=metal','--ignore-gpu-blocklist','--enable-gpu'];
  const browser=await chromium.launch({headless:!options.headed,args});
  const report={script:'hero-pose-renders',startedAt:new Date().toISOString(),three,race:RACE,gl:GL,size:SIZE,background:BG,out:OUT,models:[],poses:null,cameras:{gameplay:GAMEPLAY_CAMERAS,closeups:CLOSEUPS},problems:[],
    rendering:{
      lighting:'world-engine.js defaults: HemisphereLight(0xc4d4bd,0x30281f,2.35) + DirectionalLight(0xffefd2,2.8) with PCF soft shadows; the sun keeps the game offset (-9,18,10) relative to the default camera offset (0,7.5,8), rotated with each camera azimuth; ACESFilmic, exposure 1.12, sRGB; scene.environment from sky-environment.mjs (Vaelthar background 0x1b2422). city-atmosphere.mjs time-of-day changes are NOT applied.',
      background:BG==='sky'?'game sky gradient':'flat 0x737b82 backdrop (does not light the scene) so the black armour reads; a 0.5 m grid ground plane receives shadows',
      gameplayCamera:'fov 44 (game), target at half the race standing height, distance so the standing body is 40% of frame height (about 5.7 m for human, near controls.minDistance 5.5), 12 deg above horizontal',
      closeups:'legs: target hips x/z at 0.62 m, 1.45 m frame; shoulders: centre of both shoulder and elbow joints, 1.15 m frame; hand: 60% from RightHand to RightHandMiddle1, 0.62 m frame, near plane pulled to 0.16-0.2 m in front of the hand so the torso/thigh does not block the view; close-ups add a 0.9 headlight fill (not a game light)',
      actor:'CharacterActor from site/world3d/character-actor.js (game clip mapping, rotationOffset PI, hero race-height scale, tint, envMapIntensity 1.15) and equipClass from class-equipment.js; selection ring hidden; clips sampled with the action time set directly (no blending)'
    }};
  const t0=Date.now();
  try{
    const openModel=async model=>{
      const context=await browser.newContext({viewport:{width:Math.min(SIZE,1280),height:Math.min(SIZE,1280)},deviceScaleFactor:1});
      const page=await context.newPage();const pageErrors=[],consoleErrors=[];
      page.on('pageerror',e=>pageErrors.push(String(e?.stack||e).slice(0,800)));
      page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text().slice(0,400));});
      await page.goto(`http://127.0.0.1:${PORT}/__hero_pose.html`);
      await page.waitForFunction(()=>window.__heroPoseReady===true,null,{timeout:60000});
      const init=await page.evaluate(a=>window.heroInit(a),{name:model.name,kind:model.kind,url:`/__models/${model.name}.glb`,race:RACE,size:SIZE,bg:BG,swordFromUrl:model.swordFrom?`/__models/${model.swordFrom}.glb`:null,sockets:model.sockets||null});
      return{context,page,init,pageErrors,consoleErrors};
    };

    // 1. Fixed clip times, measured once on the baseline rig (the first model).
    const first=await openModel(models[0]);
    if(!first.init.ok)throw new Error(`baseline ${models[0].name} failed to load: ${JSON.stringify(first.init.info)}`);
    const slash=await first.page.evaluate(()=>window.heroAnalyse('attack_slash'));
    const heavy=await first.page.evaluate(()=>window.heroAnalyse('attack_heavy'));
    const cast=await first.page.evaluate(()=>window.heroAnalyse('cast'));
    const clipsInfo=first.init.info.clips;
    const peaks={
      'attack_slash:rightArmRaise':argmax(slash.rows,r=>r.right),
      'attack_heavy:rightArmRaise':argmax(heavy.rows,r=>r.right),
      'attack_heavy:eitherArmRaise':argmax(heavy.rows,r=>Math.max(r.right,r.left)),
      'cast:armsRaise':argmax(cast.rows,r=>r.right+r.left),
    };
    const poses=selectedPoses.map(p=>{
      if(p.state==='bind')return{...p,clipName:'bind',duration:0,time:0,how:'skin bind pose (skeleton.pose())'};
      const duration=clipsInfo[p.state]?.duration;if(duration===undefined)throw new Error(`baseline has no ${p.state} action`);
      let time,how;
      if(p.at.seconds!==undefined){time=Math.min(p.at.seconds,duration);how=`${p.at.seconds}s`;}
      else if(p.at.fraction!==undefined){time=duration*p.at.fraction;how=`${Math.round(p.at.fraction*100)}% of ${duration.toFixed(3)}s`;}
      else{const row=peaks[`${p.state}:${p.at.peak}`];time=row.t;const pct=`${(row.t/duration*100).toFixed(1)}% of the clip`;
        how=p.at.peak==='rightArmRaise'?`max right upper-arm raise on the baseline rig (${row.right.toFixed(1)}° from hanging, ${pct})`
          :p.at.peak==='eitherArmRaise'?`max upper-arm raise of either arm on the baseline rig (R ${row.right.toFixed(1)}°, L ${row.left.toFixed(1)}° from hanging, ${pct})`
          :`max summed upper-arm raise on the baseline rig (R ${row.right.toFixed(1)}° + L ${row.left.toFixed(1)}°, ${pct})`;}
      return{...p,clipName:clipsInfo[p.state].clip,duration,time:+time.toFixed(5),how};
    });
    const curves={attack_slash:slash.rows.filter((_,i)=>i%4===0),attack_heavy:heavy.rows.filter((_,i)=>i%4===0),cast:cast.rows.filter((_,i)=>i%4===0)};
    fs.writeFileSync(path.join(OUT,'poses.json'),JSON.stringify({measuredOn:models[0].name,poses:poses.map(({id,state,clipName,duration,time,how,drawn,extra})=>({id,state,clip:clipName,duration,time,how,swordDrawn:drawn,extra})),curves},null,1));
    report.poses=poses.map(({id,clipName,time,how,drawn})=>({id,clip:clipName,time,how,drawn}));
    for(const p of poses)console.log(`[renders] pose ${p.id.padEnd(13)} ${p.clipName.padEnd(13)} t=${p.time.toFixed(3)}s  (${p.how})`);

    // 2. Render every model at those times.
    const refHeight=Number(first.init.info.raceHeight)||1.8322;
    const shotsFor=(model,pose)=>{
      const shots=GAMEPLAY_CAMERAS.map(c=>({kind:'gameplay',id:c.id,az:c.az,refHeight,file:`${pose.id}_${c.id}.png`}));
      for(const group of CLOSEUPS)if(group.poses.includes(pose.id))for(const c of group.cameras){
        const kind=group.kind||(group.group==='close-legs'?'legs':group.group==='close-shoulders'?'shoulders':'hand');
        shots.push({kind,id:c.id,az:c.az,el:c.el,hand:c.hand,bone:c.bone,offset:c.offset,height:c.height,slab:c.slab,refScale:refHeight/1.8322,file:`${pose.id}_${c.id}.png`});
      }
      return shots;
    };
    for(let index=0;index<models.length;index++){
      const model=models[index];const opened=index===0?first:await openModel(model);
      const entry={name:model.name,kind:model.kind,label:model.label,file:model.file,bytes:fs.statSync(model.file).size,ok:opened.init.ok,info:opened.init.info,poses:{},files:[]};
      report.models.push(entry);
      if(!opened.init.ok){report.problems.push(`${model.name}: failed to load (${JSON.stringify(opened.init.info)})`);console.error(`[renders] ${model.name} FAILED to load`,opened.init.info);await opened.context.close();continue;}
      for(const [state,c] of Object.entries(opened.init.info.clips)){const ref=clipsInfo[state];if(!ref||ref.clip!==c.clip||Math.abs(ref.duration-c.duration)>1e-3)report.problems.push(`${model.name}: action ${state} -> ${c.clip} ${c.duration}s differs from baseline ${ref?`${ref.clip} ${ref.duration}s`:'(missing)'}`);}
      for(const s of Object.keys(clipsInfo))if(!opened.init.info.clips[s])report.problems.push(`${model.name}: no action for state ${s}`);
      const started=Date.now();
      for(const pose of poses){
        const label=`${model.name}  ·  ${pose.id}  ·  ${pose.clipName} t=${pose.time.toFixed(3)}s`;
        const res=await opened.page.evaluate(args=>window.heroRender(args),{pose:{state:pose.state},time:pose.time,drawn:pose.drawn,shots:shotsFor(model,pose),label});
        for(const shot of res.shots){const f=path.join(OUT,model.name,shot.file);writePng(f,shot.png);entry.files.push(path.relative(OUT,f));}
        entry.poses[pose.id]={clip:res.clip,time:res.time,...res.metrics};
      }
      entry.pageErrors=opened.pageErrors;entry.consoleErrors=opened.consoleErrors;entry.warnings=opened.init.warnings;entry.renderSeconds=+((Date.now()-started)/1000).toFixed(1);
      if(opened.pageErrors.length)report.problems.push(`${model.name}: ${opened.pageErrors.length} page error(s)`);
      const bad=(opened.init.warnings||[]).filter(w=>/PropertyBinding|failed|missing/i.test(w));if(bad.length)report.problems.push(`${model.name}: warnings ${JSON.stringify(bad).slice(0,300)}`);
      console.log(`[renders] ${model.name}: ${entry.files.length} images in ${entry.renderSeconds}s (gl: ${opened.init.info.glRenderer})`);
      if(index!==0)await opened.context.close();
    }

    // 3. Contact sheets (rows = models, columns = cameras) composed in the same browser.
    const sheetPage=first.page;const okModels=report.models.filter(m=>m.ok);
    const rowLabel=m=>m.kind==='hero'?`${m.name} (hero)`:m.kind==='race_fpsword'?`${m.name} (socket ref)`:`${m.name} (live)`;
    const sheets=[];
    const makeSheet=async(file,title,cols,cellFile,tile)=>{
      const cells=okModels.map(m=>cols.map(c=>{const f=cellFile(m,c);return fs.existsSync(path.join(OUT,m.name,f))?`/__out/${m.name}/${f}`:null;}));
      const png=await sheetPage.evaluate(a=>window.heroSheet(a),{title,rows:okModels.map(rowLabel),cols,cells,tile});
      const out=path.join(OUT,'sheets',file);writePng(out,png);sheets.push(path.relative(OUT,out));
    };
    for(const pose of poses){
      await makeSheet(`${pose.id}.png`,`${pose.id}: ${pose.clipName} @ ${pose.time.toFixed(3)}s (${pose.how})${pose.drawn?' · sword drawn':' · sword stowed'}`,GAMEPLAY_CAMERAS.map(c=>c.id),(m,c)=>`${pose.id}_${c}.png`,380);
      for(const group of CLOSEUPS)if(group.poses.includes(pose.id))await makeSheet(`${pose.id}_${group.group}.png`,`${pose.id} ${group.group}: ${group.note}`,group.cameras.map(c=>c.id),(m,c)=>`${pose.id}_${c}.png`,380);
    }
    // Per-model overview: poses x gameplay cameras.
    for(const m of okModels){
      const cells=poses.map(p=>GAMEPLAY_CAMERAS.map(c=>`/__out/${m.name}/${p.id}_${c.id}.png`));
      const png=await sheetPage.evaluate(a=>window.heroSheet(a),{title:`${m.label}: every pose, gameplay cameras`,rows:poses.map(p=>`${p.id} (${p.time.toFixed(2)}s)`),cols:GAMEPLAY_CAMERAS.map(c=>c.id),cells,tile:300,labelW:150});
      const out=path.join(OUT,m.name,'_overview.png');writePng(out,png);sheets.push(path.relative(OUT,out));
    }
    report.sheets=sheets;
    await first.context.close();
  }finally{
    report.seconds=+((Date.now()-t0)/1000).toFixed(1);
    fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,1));
    await browser.close().catch(()=>{});
    await new Promise(resolve=>server.close(resolve));
  }
  console.log(`[renders] done in ${report.seconds}s -> ${OUT}`);
  const okModels=report.models.filter(m=>m.ok),ids=Object.keys(okModels[0]?.poses||{});
  console.log('[renders] lowest skinned point (m) per pose:');console.log('  '+'pose'.padEnd(14)+okModels.map(m=>m.name.padStart(15)).join(''));
  for(const id of ids)console.log('  '+id.padEnd(14)+okModels.map(m=>String(m.poses[id]?.skinMinY??'-').padStart(15)).join(''));
  // The sword is rigid on RightHand, so this offset is a per-rig constant of the socket (judge the grip on the close-ups).
  for(const m of okModels){const g=Object.values(m.poses).find(p=>p.grip)?.grip;if(g)console.log(`[renders] ${m.name}: FP_Sword grip centre is ${g.gripToMiddle1} m from the RightHandMiddle1 knuckle joint and ${g.gripToWrist} m from the wrist (socket constant)`);}
  if(report.problems.length){console.log('[renders] problems:');for(const p of report.problems)console.log('  - '+p);}
  return report;
}

main().then(report=>{process.exitCode=report.models.every(m=>m.ok)?0:1;}).catch(error=>{console.error(error);process.exitCode=1;});
