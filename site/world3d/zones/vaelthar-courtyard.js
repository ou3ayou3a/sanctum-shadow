import * as THREE from 'three';
import {VAELTHAR_BOUNDS,VAELTHAR_SPAWN,VAELTHAR_LANDMARKS} from './vaelthar-layout.mjs';
import {VAELTHAR_NPCS} from '../vaelthar-npcs.mjs';

const COLORS={stone:0x596159,stoneDark:0x333c38,stoneLight:0x788078,plaster:0x807b6e,timber:0x3d2b1c,roof:0x292d2e,crimson:0x762d2a,gold:0xc5a554,market:0x6b4434};
function canvasTexture(draw,size=512,repeat=[1,1]){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d');draw(context,size);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(...repeat);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}
function cobbles(){return canvasTexture((c,s)=>{c.fillStyle='#292c28';c.fillRect(0,0,s,s);for(let y=0;y<10;y++)for(let x=0;x<10;x++){const w=s/10,h=s/10,offset=(y%2)*w*.5;c.fillStyle=`hsl(80 5% ${28+(x*y%7)}%)`;c.beginPath();c.roundRect(x*w+offset-s*.02,y*h+3,w-s*.04,h-6,8);c.fill();c.strokeStyle='rgba(10,12,10,.75)';c.lineWidth=4;c.stroke();}},512,[14,14]);}
function bannerTexture(){return canvasTexture((c,s)=>{c.clearRect(0,0,s,s);c.fillStyle='#d8cfb9';c.fillRect(s*.14,0,s*.72,s*.86);c.fillStyle='#762d2a';c.fillRect(s*.19,0,s*.08,s*.75);c.fillRect(s*.73,0,s*.08,s*.75);c.fillStyle='#c5a554';c.beginPath();c.moveTo(s*.5,s*.16);c.quadraticCurveTo(s*.7,s*.4,s*.5,s*.64);c.quadraticCurveTo(s*.3,s*.4,s*.5,s*.16);c.fill();c.clearRect(s*.14,s*.76,s*.16,s*.2);c.clearRect(s*.48,s*.81,s*.12,s*.2);c.clearRect(s*.75,s*.72,s*.11,s*.25);});}
function mat(color,options={}){return new THREE.MeshStandardMaterial({color,roughness:options.roughness??.9,metalness:options.metalness??.02,emissive:options.emissive??0,emissiveIntensity:options.emissiveIntensity??0,map:options.map||null,transparent:options.transparent||false,opacity:options.opacity??1,side:options.side||THREE.FrontSide});}
function addMesh(root,geometry,material,position=[0,0,0],rotation=[0,0,0]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
function addBox(root,x,z,w,h,d,material,y=0,rotation=0){return addMesh(root,new THREE.BoxGeometry(w,h,d),material,[x,y+h/2,z],[0,rotation,0]);}
function labelSprite(text,accent=0xc5a554){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='rgba(4,10,9,.82)';c.fillRect(0,12,512,62);c.strokeStyle=`#${accent.toString(16).padStart(6,'0')}`;c.strokeRect(2,14,508,58);c.fillStyle='#eee5ce';c.textAlign='center';c.font='600 25px Cinzel,serif';c.fillText(text,256,52);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(5.8,1.08,1);sprite.renderOrder=4;return sprite;}

export function buildVaeltharCourtyard(){
  const root=new THREE.Group();root.name='Vaelthar — The Fractured Capital';const obstacles=[],interactables=[],flames=[];
  const stone=mat(COLORS.stone),stoneDark=mat(COLORS.stoneDark),stoneLight=mat(COLORS.stoneLight),plaster=mat(COLORS.plaster),timber=mat(COLORS.timber),roof=mat(COLORS.roof),gold=mat(COLORS.gold,{metalness:.65,roughness:.3});
  const ground=addMesh(root,new THREE.PlaneGeometry(64,64),new THREE.MeshStandardMaterial({map:cobbles(),color:0x74776c,roughness:1}),[0,0,0],[-Math.PI/2,0,0]);ground.name='navigation-ground';ground.castShadow=false;
  const roadMat=mat(0x343a35,{roughness:1});addMesh(root,new THREE.PlaneGeometry(8,58),roadMat,[0,.025,0],[-Math.PI/2,0,0]);addMesh(root,new THREE.PlaneGeometry(54,8),roadMat,[0,.026,1],[-Math.PI/2,0,0]);
  const plaza=addMesh(root,new THREE.CircleGeometry(9.5,48),mat(0x4b5049),[0,.03,1],[-Math.PI/2,0,0]);plaza.receiveShadow=true;
  const block=(x,z,w,h,d,material=stone,y=0,rotation=0,collision=true)=>{const mesh=addBox(root,x,z,w,h,d,material,y,rotation);if(collision)obstacles.push({x,z,hw:w/2,hd:d/2});return mesh;};
  const wallSegment=(x,z,w,d)=>{block(x,z,w,4.8,d,stoneDark);for(let cursor=-w/2+.35;cursor<w/2;cursor+=1.4)block(x+cursor,z,.65,.65,d+.15,stoneLight,4.8,0,false);};
  wallSegment(-27.7,0,1.2,55);wallSegment(27.7,0,1.2,55);wallSegment(-15,-27.7,24,1.2);wallSegment(15,-27.7,24,1.2);wallSegment(-16,27.7,22,1.2);wallSegment(16,27.7,22,1.2);
  // Crown Gate and southern road gate.
  for(const z of[-27,27]){block(-4.2,z,4.2,7,4.2,stoneDark);block(4.2,z,4.2,7,4.2,stoneDark);block(0,z,5,1.1,1.5,stoneLight,5.8,0,false);for(const x of[-4.2,4.2]){const roofCone=addMesh(root,new THREE.ConeGeometry(3.2,3,4),roof,[x,8.5,z],[0,Math.PI/4,0]);roofCone.castShadow=true;}}
  const banners=bannerTexture();for(const [x,z,ry] of[[-3.4,-24.8,0],[3.4,-24.8,0],[-27,8,Math.PI/2],[27,-8,-Math.PI/2]]){const banner=addMesh(root,new THREE.PlaneGeometry(1.6,3),new THREE.MeshStandardMaterial({map:banners,transparent:true,side:THREE.DoubleSide,roughness:.9}),[x,4.2,z],[0,ry,0]);banner.castShadow=false;}

  function house(x,z,w,d,h,tint,rotation=0){
    const walls=mat(tint);block(x,z,w,h,d,walls,0,rotation);const leftRoof=addMesh(root,new THREE.BoxGeometry(w*.62,.34,d*1.12),roof,[x-w*.22,h+.72,z],[0,rotation,.42]);const rightRoof=addMesh(root,new THREE.BoxGeometry(w*.62,.34,d*1.12),roof,[x+w*.22,h+.72,z],[0,rotation,-.42]);leftRoof.castShadow=rightRoof.castShadow=true;
    for(const side of[-1,1]){const beam=addBox(root,x+side*w*.32,z+d*.505,.18,h*.9,.12,timber,.2,rotation);beam.castShadow=true;const window=addMesh(root,new THREE.PlaneGeometry(.75,1),mat(0xe6a85e,{emissive:0xc8752f,emissiveIntensity:1.5}),[x+side*w*.22,h*.55,z+d*.511],[0,rotation,0]);window.castShadow=false;}
  }
  house(-22,-19,7,6,4.6,0x716b5d);house(-22,19,7,7,4.2,0x685f55);house(22,-20,7,6,4.8,0x70685c);house(22,20,7,7,4.5,0x67675f);house(-8,22,7,5,3.8,0x746d60);house(8,22,7,5,4.1,0x6b6256);house(-8,-22,7,5,4.2,0x736b60);house(8,-22,7,5,4,0x69645a);

  // Covenant fountain, broken statue and Watch command post.
  const fountain=new THREE.Group();fountain.position.set(0,0,2);root.add(fountain);const basin=new THREE.Mesh(new THREE.TorusGeometry(2.2,.42,12,40),stoneLight);basin.rotation.x=Math.PI/2;basin.position.y=.38;basin.castShadow=true;fountain.add(basin);const water=new THREE.Mesh(new THREE.CircleGeometry(1.9,40),mat(0x4d8d87,{roughness:.2,metalness:.1,transparent:true,opacity:.75,emissive:0x174b45,emissiveIntensity:.55}));water.rotation.x=-Math.PI/2;water.position.y=.28;fountain.add(water);const statue=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,3.2,8),stone);statue.position.y=1.7;statue.rotation.z=.12;statue.castShadow=true;fountain.add(statue);obstacles.push({x:0,z:2,hw:2.3,hd:2.3});
  block(3,-7,5,1.1,3,stoneDark);const watchBanner=labelSprite('WATCH COMMAND',COLORS.crimson);watchBanner.position.set(3,3,-7);root.add(watchBanner);

  // Ruined signing hall: scorched floor, broken columns, collapsed wall and evidence table.
  const ruinFloor=addMesh(root,new THREE.PlaneGeometry(13,10),mat(0x282824),[-13,.04,-14],[-Math.PI/2,0,0]);ruinFloor.receiveShadow=true;
  for(const [x,z,h] of[[-18,-17,4.8],[-9,-17,2.2],[-18,-11,3.4],[-9,-11,1.6]]){const column=addMesh(root,new THREE.CylinderGeometry(.52,.65,h,12),stone,[x,h/2,z]);column.castShadow=true;obstacles.push({x,z,hw:.65,hd:.65});}
  block(-13,-18,11,2.5,1,stoneDark);block(-18.5,-14,1,3.4,7,stoneDark);for(let i=0;i<13;i++){const x=-18+Math.random()*10,z=-17+Math.random()*7;block(x,z,.5+Math.random()*1.2,.25+Math.random()*.65,.4+Math.random(),stone,false,Math.random(),true);}
  const hallLabel=labelSprite('RUINED SIGNING HALL',COLORS.crimson);hallLabel.position.set(-13,5,-15);root.add(hallLabel);

  // Church Archive and Temple Quarter.
  house(-22,-4,8,8,5.6,0x777365);const archiveDoor=addBox(root,-18.02,-4,0.12,2.6,1.5,timber,0,Math.PI/2);archiveDoor.castShadow=true;const archiveLabel=labelSprite('CHURCH ARCHIVE');archiveLabel.position.set(-18,4,-4);root.add(archiveLabel);
  const templeBase=block(17,-15,12,1,11,stoneLight);for(const x of[13,15.7,18.3,21]){const column=addMesh(root,new THREE.CylinderGeometry(.42,.5,5.2,12),stoneLight,[x,3.1,-9.4]);column.castShadow=true;obstacles.push({x,z:-9.4,hw:.5,hd:.5});}block(17,-17,9,7,6,plaster);const templeRoof=addMesh(root,new THREE.ConeGeometry(7.2,5.5,4),roof,[17,9.7,-17],[0,Math.PI/4,0]);templeRoof.castShadow=true;const spire=addMesh(root,new THREE.ConeGeometry(.7,5,10),gold,[17,14.5,-17]);spire.castShadow=true;const templeLabel=labelSprite('TEMPLE QUARTER');templeLabel.position.set(17,6.8,-10);root.add(templeLabel);

  // Tarnished Cup: open-front interior that is directly walkable.
  const tavernX=-16,tavernZ=13;addMesh(root,new THREE.PlaneGeometry(10,8),mat(0x493426),[tavernX,.05,tavernZ],[-Math.PI/2,0,0]);
  block(tavernX,tavernZ-4,10,4.4,.5,plaster);block(tavernX-5,tavernZ,.5,4.4,8,plaster);block(tavernX+5,tavernZ,.5,4.4,8,plaster);block(tavernX-3.5,tavernZ+4,3,4.4,.5,plaster);block(tavernX+3.5,tavernZ+4,3,4.4,.5,plaster);
  for(const x of[-18.4,-15.5,-12.8]){const table=block(x,12.3,1.8,.18,1.1,timber,.75,0,true);for(const sx of[-.65,.65])block(x+sx,11.5,.22,.55,.22,timber,0,0,true);}
  const bar=block(-19.8,14.3,.7,1.1,5.2,timber);const hearth=block(-12.2,11.2,.6,2.4,2.1,stoneDark);const hearthLight=new THREE.PointLight(0xff8b43,9,7,2);hearthLight.position.set(-12.7,1.4,11.2);root.add(hearthLight);flames.push(hearthLight);
  const tavernLabel=labelSprite('THE TARNISHED CUP');tavernLabel.position.set(tavernX,5,tavernZ+3.7);root.add(tavernLabel);

  // Ash Market stalls, awnings, crates and central brazier.
  const clothColors=[0x733f35,0x62533a,0x405d50,0x5e445f];for(let i=0;i<6;i++){const x=9+(i%3)*4,z=8+Math.floor(i/3)*5;const stall=block(x,z,2.8,.2,1.8,timber,.85,0,true);for(const sx of[-1.2,1.2])block(x+sx,z,.12,2.5,.12,timber,0,0,false);const awning=addMesh(root,new THREE.BoxGeometry(3.2,.12,2.2),mat(clothColors[i%clothColors.length]),[x,2.45,z],[0,0,(i%2?-.04:.04)]);awning.castShadow=true;for(let c=0;c<3;c++)block(x-1+c,z+.4,.5,.45,.5,mat(0x695037),0,0,true);}
  const marketLabel=labelSprite('ASH MARKET');marketLabel.position.set(13,4.2,10);root.add(marketLabel);

  // Street lanterns and ambient smoke points.
  const torchPositions=[[-5,-9],[5,-9],[-7,8],[6,9],[-24,7],[24,-6],[-10,-25],[10,25]];
  for(const [x,z] of torchPositions){block(x,z,.14,1.8,.14,timber,0,0,false);const cup=addMesh(root,new THREE.CylinderGeometry(.16,.11,.2,8),gold,[x,1.9,z]);const flame=addMesh(root,new THREE.ConeGeometry(.13,.48,8),mat(0xffb64d,{emissive:0xff6d20,emissiveIntensity:3}),[x,2.25,z]);flame.castShadow=false;const light=new THREE.PointLight(0xff8b43,5,7,2);light.position.set(x,2.2,z);root.add(light);flames.push(light);}

  function landmarkMessage(id){const messages={north_gate:'The Crown Gate is watched from both towers. Beyond it, the northern road disappears into smoke.',signing_hall:'The signing hall still smells of ash. Broken seals and scorched stone mark where the Covenant failed.',church_archive:'The Archive doors are sealed by Crown order. Fresh scratches surround the lock.',temple_quarter:'Incense and smoke mingle beneath the Temple spire. The district is tense but open.',watch_post:'Maps, arrest orders, and patrol routes cover the Watch table. Captain Rhael normally commands from here.',covenant_fountain:'Someone broke the treaty statue at the waist. Coins glitter beneath the dark water.',ash_market:'Merchants trade beneath guarded voices. Every stall seems to know a different version of the crisis.',tarnished_cup:'Warm light spills from the Tarnished Cup. Its open common room is directly ahead.',south_gate:'The southern gate opens onto the Merchant Road. Wagon tracks leave the city, but few return.'};return messages[id]||'Vaelthar watches in silence.';}
  function useLandmark(landmark,engine){
    if(landmark.action?.startsWith('scene:')&&typeof window.runScene==='function'){window.runScene(landmark.action.slice(6));return;}
    if(landmark.action==='shop'&&typeof window.openShop==='function'){window.openShop();return;}
    if(landmark.action==='map'&&typeof window.openWorldMap==='function'){window.openWorldMap();return;}
    engine.toast(landmarkMessage(landmark.id),4800);
  }
  for(const landmark of VAELTHAR_LANDMARKS){const [x,y,z]=landmark.position;const object=new THREE.Mesh(new THREE.CylinderGeometry(landmark.range*.72,landmark.range*.72,.5,18),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));object.position.set(x,.25,z);object.userData.interactionId=landmark.id;root.add(object);interactables.push({id:landmark.id,object,position:new THREE.Vector3(x,y,z),range:landmark.range,label:landmark.label,onInteract:engine=>useLandmark(landmark,engine)});}

  return{id:'vaelthar_city',name:'Vaelthar — The Fractured Capital',root,ground,spawn:new THREE.Vector3(VAELTHAR_SPAWN.x,VAELTHAR_SPAWN.y,VAELTHAR_SPAWN.z),bounds:{...VAELTHAR_BOUNDS},obstacles,interactables,npcs:VAELTHAR_NPCS,scene:{background:0x1b2422,fog:0x1b2422},
    update(time){water.material.emissiveIntensity=.45+Math.sin(time*1.8)*.12;for(let i=0;i<flames.length;i++)flames[i].intensity=5.5+Math.sin(time*8+i*1.7)*1.5;},
    dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);if(m.map)textures.add(m.map);});});for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const m of materials)m.dispose();}
  };
}
