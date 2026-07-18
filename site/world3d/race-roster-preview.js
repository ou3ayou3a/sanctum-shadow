import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CharacterActor} from './character-actor.js?v=179';
import {RACE_IDS,getRaceProfile} from './race-profiles.mjs';

const canvas=document.getElementById('roster-canvas'),loading=document.getElementById('roster-loading'),errorBox=document.getElementById('roster-error');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1a17);scene.fog=new THREE.FogExp2(0x0d1a17,.026);
const camera=new THREE.PerspectiveCamera(42,1,.1,120);camera.position.set(0,3.9,13.5);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=false;controls.target.set(0,1,0);controls.minDistance=5;controls.maxDistance=22;controls.maxPolarAngle=1.25;
scene.add(new THREE.HemisphereLight(0xb9d3cc,0x141d18,2));const key=new THREE.DirectionalLight(0xe4eee8,4);key.position.set(-7,13,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-14;key.shadow.camera.right=14;key.shadow.camera.top=12;key.shadow.camera.bottom=-8;scene.add(key);const rim=new THREE.DirectionalLight(0x70bd9a,2);rim.position.set(8,5,-5);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(18,64),new THREE.MeshStandardMaterial({color:0x293a32,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
for(let i=0;i<7;i++){const disc=new THREE.Mesh(new THREE.CylinderGeometry(.8,.9,.12,32),new THREE.MeshStandardMaterial({color:i%2?0x34443b:0x3c4d43,roughness:.82}));disc.position.set((i-3)*1.9,.06,0);disc.receiveShadow=true;scene.add(disc);}

const actors=[],buttons=document.getElementById('race-controls'),details=document.getElementById('race-details');let focusTarget=new THREE.Vector3(0,1,0),cameraTarget=new THREE.Vector3(0,3.9,13.5),selected=null;
function selectRace(id){selected=id;for(const button of buttons.children)button.classList.toggle('active',button.dataset.race===id);if(!id){details.style.setProperty('--accent','#d8bc72');details.querySelector('strong').textContent='ALL RACES';focusTarget.set(0,1,0);cameraTarget.set(0,3.9,13.5);return;}const index=RACE_IDS.indexOf(id),profile=getRaceProfile(id),actor=actors[index];details.style.setProperty('--accent',`#${profile.accent.toString(16).padStart(6,'0')}`);details.querySelector('strong').textContent=profile.name.toUpperCase();focusTarget.set(actor.position.x,.95,actor.position.z);cameraTarget.set(actor.position.x,2.6,6.2);}
for(const id of RACE_IDS){const profile=getRaceProfile(id),button=document.createElement('button');button.type='button';button.dataset.race=id;button.textContent=profile.name;button.style.setProperty('--accent',`#${profile.accent.toString(16).padStart(6,'0')}`);button.addEventListener('click',()=>selectRace(selected===id?null:id));buttons.appendChild(button);}

try{
  await Promise.all(RACE_IDS.map(async(id,index)=>{const actor=new CharacterActor({modelUrl:'prototype/assets/elf-ranger.glb',race:id});actor.position.set((index-3)*1.9,.12,0);actor.rotation.y=0;scene.add(actor);actors[index]=actor;await actor.load();}));
  loading.classList.add('loaded');setTimeout(()=>loading.remove(),550);
}catch(error){console.error(error);loading.hidden=true;errorBox.hidden=false;errorBox.textContent='The animated race roster could not be loaded.';}

const clock=new THREE.Clock();function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);for(const actor of actors)actor?.update(dt);controls.target.lerp(focusTarget,1-Math.exp(-dt*4));if(selected)camera.position.lerp(cameraTarget,1-Math.exp(-dt*3));controls.update();renderer.render(scene,camera);}frame();
