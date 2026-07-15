import * as THREE from 'three';
import {placeProductionAsset} from '../production-assets.mjs';
import {createMedievalMaterialLibrary} from '../medieval-materials.mjs';
import {tarnishedCupActions} from '../tarnished-cup-actions.mjs';

const WIDTH=18,DEPTH=14;

function addInteraction(root,interactables,{id,label,x,z,range=1.8,actions,onInteract}){
  const object=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(.8,range*.62),Math.max(.8,range*.62),.42,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  object.position.set(x,.21,z);object.userData.interactionId=id;object.name=`interaction:${id}`;root.add(object);
  interactables.push({id,label,object,position:new THREE.Vector3(x,0,z),range,actions,onInteract});return object;
}

export function buildTarnishedCup(location={}){
  const root=new THREE.Group(),obstacles=[],interactables=[],animated=[],assetJobs=[],materials=createMedievalMaterialLibrary();
  root.name='The Tarnished Cup — Where Secrets Drown';root.userData.zoneKit='tavern';root.userData.interior=true;
  const timber=materials.material('timber',0x6b4025,{bumpScale:.055}),darkTimber=materials.material('timber',0x321d14,{bumpScale:.05}),stone=materials.material('stone',0x62584a,{bumpScale:.07}),plaster=materials.material('plaster',0x9a8060,{bumpScale:.035}),iron=materials.material('metal',0x292c29,{metalness:.72,roughness:.42}),cloth=new THREE.MeshStandardMaterial({color:0x682e2a,roughness:.92,side:THREE.DoubleSide}),glass=new THREE.MeshStandardMaterial({color:0xb97b43,emissive:0x7f3518,emissiveIntensity:.45,transparent:true,opacity:.72});
  const addMesh=(geometry,material,position=[0,0,0],rotation=[0,0,0],name='tavern-detail')=>{const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.rotation.set(...rotation);object.name=name;object.castShadow=object.receiveShadow=true;root.add(object);return object;};
  const addBox=(x,z,w,h,d,material=timber,{y=0,rotation=0,collision=false,name='tavern-box'}={})=>{const object=addMesh(new THREE.BoxGeometry(w,h,d),material,[x,y+h/2,z],[0,rotation,0],name);if(collision){const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));obstacles.push({x,z,hw:c*w/2+s*d/2,hd:s*w/2+c*d/2});}return object;};
  const addCylinder=(x,z,r,h,material=timber,y=0,name='tavern-cylinder')=>addMesh(new THREE.CylinderGeometry(r,r,h,18),material,[x,y+h/2,z],[0,0,0],name);
  const addFlame=(x,y,z,scale=1)=>{const flame=addMesh(new THREE.ConeGeometry(.12*scale,.42*scale,8),new THREE.MeshStandardMaterial({color:0xffbd62,emissive:0xff6b22,emissiveIntensity:5,transparent:true,opacity:.88}),[x,y,z],[0,0,0],'tavern-flame');animated.push({kind:'flame',object:flame,phase:(x+z)*1.71});return flame;};
  const addWarmLight=(x,y,z,intensity=8,distance=8)=>{const light=new THREE.PointLight(0xff8a42,intensity,distance,2);light.position.set(x,y,z);light.castShadow=false;root.add(light);return light;};

  const ground=addMesh(new THREE.PlaneGeometry(WIDTH,DEPTH),timber,[0,.012,0],[-Math.PI/2,0,0],'navigation-ground');ground.castShadow=false;
  addBox(0,DEPTH/2-.18,WIDTH,4.9,.36,plaster,{collision:true,name:'tavern-north-wall'});addBox(-WIDTH/2+.18,0,.36,4.9,DEPTH,plaster,{collision:true,name:'tavern-west-wall'});addBox(WIDTH/2-.18,0,.36,4.9,DEPTH,plaster,{collision:true,name:'tavern-east-wall'});
  addBox(-5.2,-DEPTH/2+.18,7.3,4.9,.36,plaster,{collision:true,name:'tavern-south-wall-west'});addBox(5.2,-DEPTH/2+.18,7.3,4.9,.36,plaster,{collision:true,name:'tavern-south-wall-east'});
  const ceiling=addBox(0,0,WIDTH, .28,DEPTH,darkTimber,{y:4.75,name:'tavern-ceiling'});ceiling.castShadow=true;
  for(const x of[-7.2,-3.6,0,3.6,7.2])addBox(x,0,.22,4.75,.22,darkTimber,{name:'tavern-ceiling-beam'});
  for(const z of[-5.2,-1.7,1.8,5.25])addBox(0,z,WIDTH,.18,.22,darkTimber,{y:4.43,name:'tavern-cross-beam'});

  const shell=placeProductionAsset(root,'tavern_interior',{name:'production:tarnished-cup-authored-shell',position:[0,.03,0],rotation:0,size:[WIDTH,6.1,DEPTH]}).then(object=>{materials.apply(object);return object;}).catch(error=>{console.warn('Tarnished Cup shell failed to load',error);return null;});assetJobs.push(shell);

  // Bar, shelves, bottles, and kitchen pass.
  addBox(0,4.18,7.4,1.22,.82,darkTimber,{collision:true,name:'tarnished-cup-bar'});addBox(0,4.08,7.8,.13,1.02,stone,{y:1.19,name:'bar-stone-counter'});
  const charredPaper=new THREE.MeshStandardMaterial({color:0x8f7955,roughness:1,side:THREE.DoubleSide});for(const [index,[x,z,rotation]]of[[-2.12,3.58,-.18],[-1.72,3.62,.08],[-1.34,3.55,.21]].entries()){const page=addMesh(new THREE.PlaneGeometry(.54,.7),charredPaper,[x,1.345,z],[-Math.PI/2,0,rotation],`burned-ledger-page-${index}`);page.castShadow=false;}addBox(-1.72,3.83,.66,.08,.12,darkTimber,{y:1.32,name:'burned-ledger-binding'});
  addBox(0,6.1,8.8,2.8,.35,darkTimber,{name:'black-shelf-backing'});for(const y of[.72,1.42,2.12])addBox(0,5.87,8.3,.12,.62,timber,{y,name:'black-shelf'});
  for(let i=0;i<22;i++){const x=-3.8+(i%11)*.76,y=.82+Math.floor(i/11)*.7,color=i%3===0?0x486948:i%3===1?0x7e5531:0x5b3042;const bottle=addCylinder(x,5.7,.09,.37,new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.05,transparent:true,opacity:.86}),y,'black-shelf-bottle');bottle.castShadow=false;}
  addBox(-4.6,5.85,1.8,1.45,.9,timber,{collision:true,name:'tavern-cask-rack'});for(const x of[-5.1,-4.25]){const cask=addCylinder(x,5.32,.44,1.08,darkTimber,.15,'ale-cask');cask.rotation.z=Math.PI/2;}

  // Tables, benches, private booth, musicians' stage, and hearth.
  const addTable=(x,z,rotation=0)=>{addBox(x,z,2.45,.16,1.25,timber,{y:.88,rotation,collision:true,name:'scarred-tavern-table'});for(const side of[-1,1])addBox(x+Math.cos(rotation)*side*.93,z-Math.sin(rotation)*side*.93,.16,.88,.16,darkTimber,{rotation,name:'table-leg'});for(const side of[-1,1])addBox(x-Math.sin(rotation)*side*1.02,z-Math.cos(rotation)*side*1.02,2.2,.48,.34,darkTimber,{rotation,collision:false,name:'tavern-bench'});};
  addTable(-3.9,-1.7,.12);addTable(1.15,-2.1,-.08);addTable(4.55,.35,.16);
  addBox(-5.55,2.25,3.25,2.45,2.2,darkTimber,{collision:false,name:'cloaked-booth-canopy'});addBox(-5.55,2.2,2.35,.16,1.05,timber,{y:.85,collision:true,name:'cloaked-booth-table'});addBox(-7.18,2.25,.3,2.4,2.3,cloth,{name:'cloaked-booth-curtain'});
  addBox(5.65,4.35,4.1,.38,2.65,timber,{collision:true,name:'musicians-stage'});addBox(5.65,5.52,3.1,2.1,.22,cloth,{name:'stage-tapestry'});
  const hearth=addBox(7.65,1.15,1.8,2.7,2.4,stone,{collision:true,name:'tavern-hearth'});addBox(7.02,1.15,.28,1.05,1.25,iron,{y:.18,name:'hearth-grate'});for(const x of[6.82,7.18])addFlame(x,.55,1.15,.86);
  addWarmLight(6.95,1.35,1.15,9,8);
  for(let i=0;i<7;i++){const smoke=addMesh(new THREE.SphereGeometry(.12+i*.018,8,7),new THREE.MeshBasicMaterial({color:0x7d6d5c,transparent:true,opacity:.12,depthWrite:false}),[7,.9+i*.38,1.15],[0,0,0],'hearth-smoke');smoke.castShadow=smoke.receiveShadow=false;animated.push({kind:'smoke',object:smoke,phase:i*.8,baseY:smoke.position.y});}

  // Windows, chandeliers, candles, clutter, and story dressing.
  for(const z of[-3.9,3.55]){const window=addBox(-8.78,z,.08,1.65,1.7,glass,{y:1.65,name:'amber-window'});window.castShadow=false;}
  for(const x of[-2.6,2.6]){const ring=addMesh(new THREE.TorusGeometry(.72,.07,8,24),iron,[x,3.55,-.25],[Math.PI/2,0,0],'iron-chandelier');addBox(x,-.25,.08,1.2,.08,iron,{y:3.55,name:'chandelier-chain'});animated.push({kind:'sway',object:ring,phase:x});for(let i=0;i<5;i++){const angle=i/5*Math.PI*2;addFlame(x+Math.cos(angle)*.62,3.62,-.25+Math.sin(angle)*.62,.42);}addWarmLight(x,3.45,-.25,7.5,8.5);}
  for(const [x,z] of [[-6,-4.8],[-2.5,-4.9],[3.4,-4.8],[6.7,-2.8],[-1.2,1.2]]){addCylinder(x,z,.28,.54,darkTimber,0,'tavern-stool');addBox(x,z,.7,.12,.7,timber,{y:.52,name:'stool-seat'});}
  for(let i=0;i<18;i++){const x=-7.4+(i%6)*2.75,z=-5.6+Math.floor(i/6)*5.25,mug=addCylinder(x,z,.11,.28,stone,.04,'discarded-tankard');mug.rotation.z=(i%3-1)*.08;}
  addBox(7.72,-2.8,.16,2.4,3.2,timber,{y:.85,name:'missing-board'});for(let i=0;i<5;i++){const notice=addMesh(new THREE.PlaneGeometry(.55,.78),new THREE.MeshStandardMaterial({color:i%2?0xc6b389:0x9e8a69,roughness:1,side:THREE.DoubleSide}),[7.61,1.28+(i%2)*.88,-3.85+i*.52],[0,-Math.PI/2,(i-2)*.04],`missing-notice-${i}`);notice.castShadow=false;}
  addMesh(new THREE.PlaneGeometry(.48,.62),new THREE.MeshStandardMaterial({color:0x30261f,roughness:1,side:THREE.DoubleSide}),[7.04,1.24,.42],[0,-Math.PI/2,0],'old-hearth-cross');
  addBox(-6.25,4.55,2.05,.16,1.55,iron,{collision:false,name:'cellar-hatch'});for(const x of[-6.85,-6.25,-5.65])addBox(x,4.55,.08,.04,1.35,timber,{y:.17,name:'cellar-hatch-plank'});

  const direct=(id,icon,label,onSelect,requiresFlag)=>({id,icon,label,direct:true,onSelect,requiresFlag});
  addInteraction(root,interactables,{id:'tarnished_room',label:'Listen to the common room',x:0,z:-4.55,actions:[direct('listen','👂','Listen to the common room',(engine)=>{if(window.runScene)window.runScene('tarnished_cup_arrival');else engine.toast('Every table lowers its voice when you listen too closely.');})]});
  addInteraction(root,interactables,{id:'tarnished_bar_ledger',label:'Burned ledger behind the bar',x:-1.8,z:3.35,actions:tarnishedCupActions('burnedLedger')});
  addInteraction(root,interactables,{id:'tarnished_cloaked_booth',label:'The cloaked figures’ booth',x:-5.35,z:1.05,actions:tarnishedCupActions('cloakedBooth')});
  addInteraction(root,interactables,{id:'tarnished_cellar_hatch',label:'Sealed cellar hatch',x:-6.15,z:3.48,actions:[...tarnishedCupActions('cellarHatch'),direct('open_hidden_cache','🗝','Open the concealed ledger cache',(engine)=>engine.toast('The catch opens. Inside lies a narrow compartment stripped bare except for fresh white candle wax.'),'tarnished_cellar_catch_known')]});
  addInteraction(root,interactables,{id:'tarnished_missing_board',label:'Wall of missing regulars',x:6.85,z:-2.8,actions:tarnishedCupActions('missingBoard')});
  addInteraction(root,interactables,{id:'tarnished_hearth_cross',label:'Old carving beside the hearth',x:6.55,z:1.05,actions:tarnishedCupActions('oldCross')});
  addInteraction(root,interactables,{id:'tarnished_black_shelf',label:'The Black Shelf',x:3.1,z:3.35,actions:[direct('trade','◈','Ask to see the Black Shelf',engine=>{if(window.openShop)window.openShop();else engine.toast('The hidden merchant is unavailable.');})]});
  addInteraction(root,interactables,{id:'interior_exit',label:'Return to Cupside Lane',x:0,z:-6.28,range:1.7,actions:[direct('leave','↩','Return to Cupside Lane',engine=>{const destination=window.world3dReturnLocation||location.connections?.[0]||'vaelthar_city';if(!engine.transitionToWorldLocation(destination,'Vaelthar — Cupside Lane'))engine.toast('The way outside is blocked.');})]});

  const npcs=[
    {id:'lyra_innkeeper',name:'Lyra',title:'Keeper of the Cup',position:[0,0,5.18],facing:Math.PI,race:'human',classId:'ranger',action:'dialogue'},
    {id:'drunk_cartographer',name:'Eron',title:'Cartographer · Deep in His Cups',position:[-3.55,0,-2.72],facing:.15,race:'human',classId:'mage',action:'dialogue'},
    {id:'nervous_merchant',name:'Cael',title:'Merchant · Watching the Door',position:[2.95,0,-2.82],facing:-.2,race:'human',classId:'rogue',action:'dialogue'},
    {id:'cloaked_figure_1',name:'Cloaked Figure',title:'Church Informant',position:[-5.88,0,1.23],facing:1.15,race:'human',classId:'rogue',action:'dialogue'},
    {id:'cloaked_figure_2',name:'Second Cloaked Figure',title:'Frightened Witness',position:[-4.72,0,1.18],facing:-1.15,race:'human',classId:'ranger',action:'dialogue'},
    {id:'cup_server',name:'Mara',title:'Server · Knows Every Regular',position:[1.7,0,.15],race:'human',classId:'ranger',action:'ambient',ambientLine:'“If Lyra asks, you saw nothing. If the Church asks, you saw even less.”',patrol:[[-1.3,.4],[3.8,-.8],[1.1,-3.8],[-2.2,-.2]],patrolDelay:7},
    {id:'off_duty_watch',name:'Watchman Pell',title:'Off Duty · Still Armed',position:[5.25,0,-.72],facing:-.65,race:'human',classId:'warrior',action:'ambient',ambientLine:'“I am off duty. That means I only notice trouble after the second chair breaks.”'},
  ];

  const warmFill=new THREE.HemisphereLight(0xe1b781,0x241914,1.25);root.add(warmFill);for(const [x,z]of[[-4,-1],[4,-1],[0,3.8]]){const fill=new THREE.PointLight(0xffb66d,9,11,1.7);fill.position.set(x,3.75,z);fill.castShadow=false;root.add(fill);}
  return{
    id:'tarnished_cup',name:'The Tarnished Cup — Where Secrets Drown',profile:{id:'tarnished_cup',kit:'tavern',interactionLabel:'Listen to the common room',danger:1},root,ground,spawn:new THREE.Vector3(0,0,-5.45),bounds:{minX:-8.35,maxX:8.35,minZ:-6.35,maxZ:6.35},obstacles,interactables,npcs,
    ready:Promise.all(assetJobs),scene:{background:0x1d120d,fog:0x1d120d,fogDensity:.009,exposure:1.48,ambientIntensity:2.8,sunIntensity:.72},
    update(time){for(const item of animated){if(item.kind==='flame')item.object.scale.y=.86+Math.sin(time*9+item.phase)*.17;else if(item.kind==='smoke'){item.object.position.y=item.baseY+(time*.18+item.phase)%1.6;item.object.position.x=7+Math.sin(time*.7+item.phase)*.13;item.object.material.opacity=.1*(1-((time*.18+item.phase)%1.6)/1.6);}else if(item.kind==='sway')item.object.rotation.z=Math.sin(time*.55+item.phase)*.018;}},
    dispose(){const geometries=new Set(),ownedMaterials=new Set();root.traverse(object=>{if(object.userData?.environmentAssetShared)return;if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])ownedMaterials.add(material);});for(const geometry of geometries)geometry.dispose();for(const material of ownedMaterials)material.dispose();},
  };
}
