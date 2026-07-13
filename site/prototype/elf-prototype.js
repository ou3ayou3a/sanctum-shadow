import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#game-canvas');
const loading = document.querySelector('#loading');
const errorBox = document.querySelector('#error');
const stateText = document.querySelector('#state-text');
const cooldownShade = document.querySelector('#cooldown');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10201d);
scene.fog = new THREE.FogExp2(0x10201d, 0.026);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(42, 1, .1, 160);
camera.position.set(7.2, 7.2, 9.2);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.enablePan = false;
controls.minDistance = 5.5;
controls.maxDistance = 16;
controls.minPolarAngle = .42;
controls.maxPolarAngle = 1.12;
controls.target.set(0, 1.4, 0);

scene.add(new THREE.HemisphereLight(0x9fc9c0, 0x162018, 1.7));
const moon = new THREE.DirectionalLight(0xd4e7df, 4.2);
moon.position.set(-8, 17, 9);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -22; moon.shadow.camera.right = 22;
moon.shadow.camera.top = 22; moon.shadow.camera.bottom = -22;
moon.shadow.bias = -.00025;
scene.add(moon);
const rim = new THREE.PointLight(0x4bbf87, 18, 21, 2);
rim.position.set(-7, 4, -7);
scene.add(rim);

const walkable = new THREE.Mesh(
  new THREE.CircleGeometry(24, 64),
  new THREE.MeshStandardMaterial({ color:0x263a30, roughness:.96, metalness:.02 })
);
walkable.rotation.x = -Math.PI / 2;
walkable.receiveShadow = true;
walkable.name = 'walkable';
scene.add(walkable);

const stoneMat = new THREE.MeshStandardMaterial({ color:0x59665e, roughness:.9 });
const darkStone = new THREE.MeshStandardMaterial({ color:0x33433c, roughness:1 });
function stone(x,z,sx,sy,sz,rot=0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz,2,2,2), stoneMat.clone());
  m.material.color.offsetHSL((Math.random()-.5)*.03,0,(Math.random()-.5)*.08);
  m.position.set(x,sy/2,z); m.rotation.y=rot; m.castShadow=m.receiveShadow=true; scene.add(m); return m;
}
for (let i=0;i<28;i++) {
  const a=i/28*Math.PI*2, r=18+Math.sin(i*4.7)*2.2;
  stone(Math.cos(a)*r,Math.sin(a)*r,1.2+Math.random()*2,.5+Math.random()*2.7,1+Math.random()*1.8,a+.4);
}
for (const [x,z,h] of [[-7,-7,5],[7,-8,4.3],[-9,5,3.7],[10,5,5.4]]) {
  stone(x,z,1.4,h,1.4,.1);
  const cap=stone(x,z,2.05,.35,2.05,.1); cap.position.y=h+.12;
  for(let j=0;j<3;j++){ const ring=new THREE.Mesh(new THREE.TorusGeometry(.82-j*.07,.07,8,20),darkStone); ring.rotation.x=Math.PI/2; ring.position.set(x,h*.22+j*.28,z); scene.add(ring); }
}
for(let i=0;i<45;i++){
  const a=Math.random()*Math.PI*2,r=3+Math.random()*18;
  const tuft=new THREE.Mesh(new THREE.ConeGeometry(.08+Math.random()*.12,.4+Math.random()*.45,4),new THREE.MeshStandardMaterial({color:i%3?0x41664d:0x6b7d50,roughness:1}));
  tuft.position.set(Math.cos(a)*r,.22,Math.sin(a)*r); tuft.rotation.z=(Math.random()-.5)*.3; scene.add(tuft);
}

// Moonwell destination and ambient magical motes.
const well = new THREE.Group(); well.position.set(-8,0,-9); scene.add(well);
const wellRing = new THREE.Mesh(new THREE.TorusGeometry(1.7,.32,12,48),stoneMat); wellRing.rotation.x=Math.PI/2; wellRing.position.y=.35; wellRing.castShadow=true; well.add(wellRing);
const water = new THREE.Mesh(new THREE.CircleGeometry(1.52,48),new THREE.MeshPhysicalMaterial({color:0x57d9b4,emissive:0x176f59,emissiveIntensity:1.5,roughness:.18,metalness:.1,transparent:true,opacity:.78})); water.rotation.x=-Math.PI/2; water.position.y=.27; well.add(water);
const wellLight=new THREE.PointLight(0x55e3b4,23,11,2); wellLight.position.y=1.3; well.add(wellLight);

const marker = new THREE.Group(); marker.visible=false; scene.add(marker);
const markerRing = new THREE.Mesh(new THREE.RingGeometry(.42,.52,32),new THREE.MeshBasicMaterial({color:0xe2c779,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));
markerRing.rotation.x=-Math.PI/2; markerRing.position.y=.035; marker.add(markerRing);
const markerGlow=new THREE.PointLight(0xe2c779,2.2,3); markerGlow.position.y=.4; marker.add(markerGlow);

const player = new THREE.Group(); player.position.set(4,0,6); scene.add(player);
let model, mixer, currentAction, currentState='loading', moveTarget=null, running=false, abilityCooldown=0, castTimer=0;
const actions={};
const clock=new THREE.Clock();
const desiredCameraOffset=new THREE.Vector3();

function setState(name) {
  if(currentState===name) return;
  currentState=name;
  stateText.textContent=name.toUpperCase();
  const action=actions[name];
  if(action && action!==currentAction){ action.reset().fadeIn(.22).play(); if(currentAction) currentAction.fadeOut(.22); currentAction=action; }
}

function addElfDetails(root) {
  const head=root.getObjectByName('mixamorig:Head');
  if(head){
    const earMat=new THREE.MeshStandardMaterial({color:0xb87352,roughness:.72});
    for(const side of [-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(2.1,8.5,12),earMat);
      ear.rotation.z=side*Math.PI/2; ear.rotation.y=.35; ear.position.set(side*7.2,4,0); ear.castShadow=true; head.add(ear);
    }
  }
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; } });
  const cloakShape=new THREE.BufferGeometry();
  cloakShape.setAttribute('position',new THREE.Float32BufferAttribute([-.34,.52,0,.34,.52,0,.58,-.68,.08,-.58,-.68,.08],3));
  cloakShape.setIndex([0,2,1,0,3,2]); cloakShape.computeVertexNormals();
  const cloak=new THREE.Mesh(cloakShape,new THREE.MeshStandardMaterial({color:0x173b30,roughness:.92,side:THREE.DoubleSide}));
  cloak.position.set(0,1.22,-.2); cloak.rotation.x=-.08; cloak.castShadow=true;
  const bow=new THREE.Group();
  const arc=new THREE.Mesh(new THREE.TorusGeometry(.72,.035,7,30,Math.PI*1.55),new THREE.MeshStandardMaterial({color:0x8a5e32,roughness:.7})); arc.rotation.z=.72; bow.add(arc);
  const stringMat=new THREE.LineBasicMaterial({color:0xd9d0ad});
  const pts=[new THREE.Vector3(-.51,.51,0),new THREE.Vector3(.12,0,0),new THREE.Vector3(.51,-.51,0)]; bow.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),stringMat));
  bow.scale.setScalar(.62); bow.position.set(-.4,1.2,-.22); bow.rotation.set(.1,.2,-.35); player.add(bow);
}

new GLTFLoader().load('prototype/assets/elf-ranger.glb', gltf=>{
  model=gltf.scene;
  model.rotation.y=Math.PI;
  player.add(model);
  addElfDetails(model);
  mixer=new THREE.AnimationMixer(model);
  for(const clip of gltf.animations){ const key=clip.name.toLowerCase(); if(key.includes('idle'))actions.idle=mixer.clipAction(clip); if(key.includes('walk'))actions.walk=mixer.clipAction(clip); if(key.includes('run'))actions.run=mixer.clipAction(clip); }
  setState('idle');
  loading.classList.add('loading-done');
  setTimeout(()=>loading.remove(),750);
},undefined,err=>{
  console.error(err); loading.hidden=true; errorBox.hidden=false; errorBox.textContent='The rigged character could not load. Run the game through its local server and reopen this page.';
});

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
function pointerGround(e){
  const rect=canvas.getBoundingClientRect();
  pointer.x=((e.clientX-rect.left)/rect.width)*2-1; pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObject(walkable,false)[0]?.point || null;
}
let pointerDown=null;
canvas.addEventListener('pointerdown',e=>pointerDown={x:e.clientX,y:e.clientY});
canvas.addEventListener('pointerup',e=>{
  if(!model||!pointerDown||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>7){pointerDown=null;return;}
  pointerDown=null;
  const point=pointerGround(e); if(!point)return;
  point.x=THREE.MathUtils.clamp(point.x,-19,19); point.z=THREE.MathUtils.clamp(point.z,-19,19); point.y=0;
  moveTarget=point; running=e.shiftKey; marker.position.copy(point); marker.visible=true; setState(running?'run':'walk');
});

function castMoonfire(){
  if(!model||abilityCooldown>0)return;
  abilityCooldown=3.2; castTimer=.48; moveTarget=null; marker.visible=false; setState('idle');
  const from=player.position.clone().add(new THREE.Vector3(0,1.35,0));
  const forward=new THREE.Vector3(0,0,1).applyQuaternion(player.quaternion);
  const to=from.clone().add(forward.multiplyScalar(7)); to.y=.55;
  const bolt=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.65,5,10),new THREE.MeshBasicMaterial({color:0xf4dc86}));
  bolt.position.copy(from); bolt.rotation.z=Math.PI/2; scene.add(bolt);
  const glow=new THREE.PointLight(0x8affe0,12,6,2); bolt.add(glow);
  const start=performance.now();
  function fly(now){ const t=Math.min(1,(now-start)/420); bolt.position.lerpVectors(from,to,t); bolt.scale.setScalar(1+Math.sin(t*Math.PI)*.5); if(t<1)requestAnimationFrame(fly); else{ scene.remove(bolt); burst(to); } }
  requestAnimationFrame(fly);
}
function burst(at){
  const ring=new THREE.Mesh(new THREE.RingGeometry(.18,.28,32),new THREE.MeshBasicMaterial({color:0x6fffd2,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.copy(at); scene.add(ring);
  const light=new THREE.PointLight(0x63ffd0,28,8,2); light.position.copy(at).add(new THREE.Vector3(0,.6,0)); scene.add(light);
  let t=0; function pulse(){t+=.045;ring.scale.setScalar(1+t*13);ring.material.opacity=1-t;light.intensity=28*(1-t);if(t<1)requestAnimationFrame(pulse);else{scene.remove(ring,light);}} pulse();
}
document.querySelector('#ability-shot').addEventListener('click',castMoonfire);
addEventListener('keydown',e=>{if(e.code==='Digit1')castMoonfire();});
document.querySelector('#instructions button').addEventListener('click',()=>document.querySelector('#instructions').classList.add('hidden'));

function updateMovement(dt){
  if(!moveTarget||castTimer>0)return;
  const delta=moveTarget.clone().sub(player.position); delta.y=0; const distance=delta.length();
  if(distance<.16){ player.position.copy(moveTarget); moveTarget=null; marker.visible=false; setState('idle'); return; }
  const direction=delta.normalize(), speed=running?4.8:2.45;
  player.position.addScaledVector(direction,Math.min(speed*dt,distance));
  const angle=Math.atan2(direction.x,direction.z); player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,angle,1-Math.exp(-dt*12));
  markerRing.rotation.z+=dt*1.8;
}
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();

function animate(){
  requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),.05);
  if(mixer)mixer.update(dt);
  if(castTimer>0){castTimer-=dt;player.rotation.z=Math.sin((.48-castTimer)/.48*Math.PI)*-.08; if(castTimer<=0)player.rotation.z=0;}
  updateMovement(dt);
  if(abilityCooldown>0){ abilityCooldown=Math.max(0,abilityCooldown-dt); cooldownShade.style.transform=`scaleY(${abilityCooldown/3.2})`; }
  else cooldownShade.style.transform='scaleY(0)';
  const focus=player.position.clone().add(new THREE.Vector3(0,1.25,0));
  controls.target.lerp(focus,1-Math.exp(-dt*4.2));
  controls.update();
  water.material.emissiveIntensity=1.25+Math.sin(performance.now()*.0025)*.35;
  wellLight.intensity=22+Math.sin(performance.now()*.002)*4;
  renderer.render(scene,camera);
}
animate();
