import * as THREE from 'three';

export const ARCHITECTURE_COMPONENTS=Object.freeze(['house','wall','tower','gatehouse','bridge','castle','ruin','tavern','temple','crypt','tree','vegetation']);

const DEFAULTS=Object.freeze({stone:0x5f635b,stoneDark:0x343a36,stoneLight:0x898b7e,plaster:0x8b8270,timber:0x3b281b,roof:0x292b2b,metal:0x6e726b,glass:0xd99650,leaf:0x2f4935,leafDark:0x1e3427,bark:0x37271d,cloth:0x743b34,gold:0xb89a4d});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createArchitectureKit({root,obstacles=[],palette={},random=Math.random}={}){
  if(!root)throw new Error('Architecture kit requires a root group');
  const colors={...DEFAULTS,...palette};
  const materials={};
  const material=(key,options={})=>{
    const cacheKey=`${key}:${JSON.stringify(options)}`;
    if(!materials[cacheKey])materials[cacheKey]=new THREE.MeshStandardMaterial({color:typeof key==='number'?key:colors[key]??DEFAULTS.stone,roughness:options.roughness??.86,metalness:options.metalness??.03,emissive:options.emissive??0,emissiveIntensity:options.emissiveIntensity??0,transparent:!!options.transparent,opacity:options.opacity??1,side:options.side??THREE.FrontSide});
    return materials[cacheKey];
  };
  const mats={stone:material('stone'),stoneDark:material('stoneDark'),stoneLight:material('stoneLight'),plaster:material('plaster'),timber:material('timber'),roof:material('roof'),metal:material('metal',{metalness:.62,roughness:.38}),glass:material('glass',{emissive:colors.glass,emissiveIntensity:1.15,roughness:.34}),leaf:material('leaf'),leafDark:material('leafDark'),bark:material('bark'),cloth:material('cloth'),gold:material('gold',{metalness:.68,roughness:.3})};
  const named=(object,name)=>{object.name=`architecture:${name}`;object.userData.architectureType=name;return object;};
  const shadow=mesh=>{mesh.castShadow=true;mesh.receiveShadow=true;return mesh;};
  const add=(parent,geometry,mat,position=[0,0,0],rotation=[0,0,0])=>{const mesh=shadow(new THREE.Mesh(geometry,mat));mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;};
  const box=(parent,w,h,d,mat,position=[0,0,0],rotation=[0,0,0])=>add(parent,new THREE.BoxGeometry(w,h,d),mat,position,rotation);
  const worldPoint=(x,z,rotation,lx=0,lz=0)=>({x:x+lx*Math.cos(rotation)+lz*Math.sin(rotation),z:z-lx*Math.sin(rotation)+lz*Math.cos(rotation)});
  const obstacle=(x,z,w,d,rotation=0)=>{const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));obstacles.push({x,z,hw:c*w/2+s*d/2,hd:s*w/2+c*d/2});};
  const localObstacle=(x,z,rotation,lx,lz,w,d)=>{const point=worldPoint(x,z,rotation,lx,lz);obstacle(point.x,point.z,w,d,rotation);};
  const place=(group,x,z,rotation=0)=>{group.position.set(x,0,z);group.rotation.y=rotation;root.add(group);return group;};
  const gableGeometry=(width,depth,height)=>{const hw=width/2,hd=depth/2;const vertices=new Float32Array([-hw,0,-hd, hw,0,-hd, hw,0,hd, -hw,0,hd, 0,height,-hd, 0,height,hd]);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setIndex([0,1,4,3,5,2,0,3,2,0,2,1,0,4,5,0,5,3,1,2,5,1,5,4]);geometry.computeVertexNormals();return geometry;};
  const roof=(parent,width,depth,y,height=1.5,mat=mats.roof)=>add(parent,gableGeometry(width,depth,height),mat,[0,y,0]);
  const framedWindow=(parent,x,y,z,front=true,scale=1)=>{const frameDepth=.11,pane=box(parent,.8*scale,1.08*scale,.07,mats.glass,[x,y,z]);pane.castShadow=false;box(parent,1.02*scale,.1,frameDepth,mats.timber,[x,y+.58*scale,z+.01]);box(parent,1.02*scale,.1,frameDepth,mats.timber,[x,y-.58*scale,z+.01]);box(parent,.1,1.26*scale,frameDepth,mats.timber,[x-.51*scale,y,z+.01]);box(parent,.1,1.26*scale,frameDepth,mats.timber,[x+.51*scale,y,z+.01]);box(parent,.07,1.14*scale,frameDepth,mats.timber,[x,y,z+.02]);return pane;};
  const door=(parent,x,y,z,width=1.05,height=2.05)=>{const slab=box(parent,width,height,.14,mats.timber,[x,y+height/2,z]);box(parent,.13,height+.18,.2,mats.stoneDark,[x-width/2-.08,y+height/2,z]);box(parent,.13,height+.18,.2,mats.stoneDark,[x+width/2+.08,y+height/2,z]);box(parent,width+.28,.14,.2,mats.stoneDark,[x,y+height+.06,z]);const handle=add(parent,new THREE.SphereGeometry(.055,8,6),mats.metal,[x+width*.3,y+height*.52,z+.1]);return slab;};

  function house({x=0,z=0,width=6,depth=5,height=4.2,rotation=0,stories=2,wallMaterial=mats.plaster,roofMaterial=mats.roof,doorSide='front',name='house'}={}){
    const group=named(new THREE.Group(),name);const baseHeight=Math.max(2.8,height);
    box(group,width,baseHeight,depth,wallMaterial,[0,baseHeight/2,0]);
    box(group,width+.18,.28,depth+.18,mats.stoneDark,[0,.14,0]);
    roof(group,width+1,depth+1,baseHeight,Math.max(1.35,width*.24),roofMaterial);
    for(const sx of[-1,1]){box(group,.16,baseHeight-.35,.16,mats.timber,[sx*(width/2-.18),baseHeight/2,depth/2+.07]);box(group,width-.3,.14,.16,mats.timber,[0,baseHeight*.48,depth/2+.07]);}
    door(group,0,0,depth/2+.09,clamp(width*.18,.9,1.35),clamp(baseHeight*.52,1.9,2.35));
    const windowY=stories>1?baseHeight*.68:baseHeight*.52;for(const sx of[-1,1])framedWindow(group,sx*width*.28,windowY,depth/2+.11,true,clamp(width/7,.72,1));
    box(group,.52,1.8,.52,mats.stoneDark,[width*.28,baseHeight+1.05,-depth*.18]);box(group,.62,.18,.62,mats.stoneLight,[width*.28,baseHeight+1.96,-depth*.18]);
    place(group,x,z,rotation);obstacle(x,z,width,depth,rotation);return group;
  }

  function wall({x=0,z=0,width=8,depth=.8,height=4.4,rotation=0,crenellated=true,name='wall'}={}){
    const group=named(new THREE.Group(),name);box(group,width,height,depth,mats.stoneDark,[0,height/2,0]);box(group,width+.12,.3,depth+.18,mats.stoneLight,[0,height-.15,0]);
    if(crenellated){const count=Math.max(2,Math.floor(width/1.25));for(let i=0;i<count;i++){const px=-width/2+(i+.5)*width/count;box(group,width/count*.55,.7,depth+.2,mats.stoneLight,[px,height+.35,0]);}}
    place(group,x,z,rotation);obstacle(x,z,width,depth,rotation);return group;
  }

  function tower({x=0,z=0,radius=2.4,height=7,rotation=0,roofed=false,name='tower'}={}){
    const group=named(new THREE.Group(),name);const body=add(group,new THREE.CylinderGeometry(radius*.92,radius,height,16),mats.stoneDark,[0,height/2,0]);
    for(let y=1.25;y<height-.7;y+=1.35)add(group,new THREE.TorusGeometry(radius*(.94-y*.008),.07,6,28),mats.stoneLight,[0,y,0],[Math.PI/2,0,0]);
    for(const angle of[0,Math.PI/2,Math.PI,Math.PI*1.5]){const wx=Math.sin(angle)*radius*.94,wz=Math.cos(angle)*radius*.94;const slit=box(group,.28,.9,.08,mats.glass,[wx,height*.58,wz],[0,angle,0]);slit.castShadow=false;}
    if(roofed)add(group,new THREE.ConeGeometry(radius*1.25,2.5,12),mats.roof,[0,height+1.25,0]);else for(let i=0;i<10;i++){const angle=i/10*Math.PI*2;box(group,.68,.75,.7,mats.stoneLight,[Math.cos(angle)*radius*.78,height+.35,Math.sin(angle)*radius*.78],[0,-angle,0]);}
    place(group,x,z,rotation);obstacle(x,z,radius*1.75,radius*1.75);return group;
  }

  function gatehouse({x=0,z=0,width=10,depth=3.6,height=6.8,rotation=0,open=true,name='gatehouse'}={}){
    const group=named(new THREE.Group(),name),towerRadius=Math.max(1.5,width*.22),gateWidth=Math.max(2.6,width*.38);
    for(const side of[-1,1]){const tx=side*(width/2-towerRadius*.65);add(group,new THREE.CylinderGeometry(towerRadius*.92,towerRadius,height,14),mats.stoneDark,[tx,height/2,0]);for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;box(group,.58,.65,.58,mats.stoneLight,[tx+Math.cos(angle)*towerRadius*.72,height+.32,Math.sin(angle)*towerRadius*.72],[0,-angle,0]);}}
    box(group,gateWidth,height*.32,depth,mats.stoneDark,[0,height*.84,0]);
    if(!open){box(group,gateWidth*.92,height*.68,.24,mats.timber,[0,height*.34,depth/2+.04]);for(let gx=-gateWidth*.38;gx<=gateWidth*.38;gx+=.35)box(group,.08,height*.72,.12,mats.metal,[gx,height*.36,depth/2+.14]);}
    place(group,x,z,rotation);for(const side of[-1,1])localObstacle(x,z,rotation,side*(width/2-towerRadius*.65),0,towerRadius*1.7,depth);return group;
  }

  function bridge({x=0,z=0,width=4,length=10,height=.65,rotation=0,name='bridge'}={}){
    const group=named(new THREE.Group(),name);box(group,width,height,length,mats.stone,[0,height/2,0]);for(const side of[-1,1]){box(group,.24,1.2,length,mats.stoneDark,[side*(width/2-.12),height+.55,0]);for(let p=-length/2+.7;p<length/2;p+=1.4)box(group,.42,.45,.42,mats.stoneLight,[side*(width/2-.12),height+1.25,p]);}place(group,x,z,rotation);return group;
  }

  function castle({x=0,z=0,width=16,depth=13,height=8,rotation=0,name='castle'}={}){
    const group=named(new THREE.Group(),name);box(group,width*.48,height,depth*.48,mats.stoneDark,[0,height/2,0]);roof(group,width*.54,depth*.54,height,2.3,mats.roof);
    for(const [sx,sz]of[[-1,-1],[-1,1],[1,-1],[1,1]]){const tx=sx*width*.39,tz=sz*depth*.39;add(group,new THREE.CylinderGeometry(2,2.25,height*.88,14),mats.stone,[tx,height*.44,tz]);add(group,new THREE.ConeGeometry(2.65,3,12),mats.roof,[tx,height*.88+1.5,tz]);}
    box(group,width,3.7,.75,mats.stoneDark,[0,1.85,-depth/2]);box(group,width,3.7,.75,mats.stoneDark,[0,1.85,depth/2]);box(group,.75,3.7,depth,mats.stoneDark,[-width/2,1.85,0]);box(group,.75,3.7,depth,mats.stoneDark,[width/2,1.85,0]);
    place(group,x,z,rotation);obstacle(x,z,width,depth,rotation);return group;
  }

  function ruin({x=0,z=0,width=8,depth=6,height=4,rotation=0,name='ruin'}={}){
    const group=named(new THREE.Group(),name);box(group,width,height,.65,mats.stoneDark,[0,height/2,-depth/2]);box(group,.65,height*.72,depth,mats.stoneDark,[-width/2,height*.36,0]);box(group,width*.36,height*.48,.65,mats.stone,[width*.32,height*.24,depth/2]);
    for(let i=0;i<12;i++){const angle=random()*Math.PI*2,radius=1+random()*Math.max(width,depth)*.55;const rubble=box(group,.35+random()*.65,.22+random()*.5,.35+random()*.65,i%2?mats.stone:mats.stoneLight,[Math.cos(angle)*radius,(i%3)*.08,Math.sin(angle)*radius],[random(),random()*3,random()]);rubble.castShadow=true;}
    place(group,x,z,rotation);obstacle(x,z,width*.38,depth*.38,rotation);return group;
  }

  function tavern(options={}){const group=house({...options,width:options.width??8,depth:options.depth??6,height:options.height??4.8,wallMaterial:options.wallMaterial??mats.plaster,name:options.name??'tavern'});const signGroup=named(new THREE.Group(),'tavern-sign');box(signGroup,.12,1.5,.12,mats.timber,[0,.75,0]);box(signGroup,1.2,.75,.12,mats.cloth,[.58,.25,0]);signGroup.position.set((options.width??8)*.36,(options.height??4.8)*.56,(options.depth??6)/2+.18);group.add(signGroup);return group;}

  function temple({x=0,z=0,width=10,depth=13,height=6.5,rotation=0,name='temple'}={}){
    const group=named(new THREE.Group(),name);box(group,width,height,depth,mats.stoneLight,[0,height/2,0]);roof(group,width+1.2,depth+1,height,Math.max(2.4,width*.3),mats.roof);box(group,width*.66,1.2,2.6,mats.stone,[0,.6,depth/2+1]);
    for(const sx of[-1,1])for(const zc of[-depth*.28,0,depth*.28]){const column=add(group,new THREE.CylinderGeometry(.36,.46,height*.72,12),mats.stone,[sx*(width/2+.55),height*.36,zc]);column.castShadow=true;}
    door(group,0,0,depth/2+.08,1.65,2.8);for(const sx of[-1,1])framedWindow(group,sx*width*.27,height*.55,depth/2+.1,true,.9);
    const spire=add(group,new THREE.ConeGeometry(.55,4.5,10),mats.gold,[0,height+Math.max(2.4,width*.3)+2,0]);spire.castShadow=true;
    place(group,x,z,rotation);obstacle(x,z,width,depth,rotation);return group;
  }

  function crypt({x=0,z=0,width=7,depth=8,height=3.4,rotation=0,name='crypt'}={}){
    const group=named(new THREE.Group(),name);box(group,width,height,depth,mats.stoneDark,[0,height/2,0]);add(group,new THREE.CylinderGeometry(width*.58,width*.58,depth,12,1,false,0,Math.PI),mats.stone,[0,height,0],[Math.PI/2,0,0]);door(group,0,0,depth/2+.1,1.4,2.2);for(const sx of[-1,1])box(group,.25,1.35,.12,mats.glass,[sx*width*.25,1.8,depth/2+.1]);place(group,x,z,rotation);obstacle(x,z,width,depth,rotation);return group;
  }

  function tree({x=0,z=0,height=5,scale=1,dead=false,rotation=random()*Math.PI*2,name='tree',collision=true}={}){
    const group=named(new THREE.Group(),dead?'dead-tree':name),h=height*scale;add(group,new THREE.CylinderGeometry(.22*scale,.42*scale,h*.58,9),mats.bark,[0,h*.29,0],[0,0,(random()-.5)*.08]);
    for(const [angle,y,length]of[[.3,.46,.32],[2.4,.52,.3],[4.4,.4,.26]]){const branch=add(group,new THREE.CylinderGeometry(.07*scale,.15*scale,h*length,7),mats.bark,[Math.cos(angle)*h*.08,h*y,Math.sin(angle)*h*.08],[Math.cos(angle)*.8,0,Math.sin(angle)*.8]);branch.castShadow=true;}
    if(!dead){const crownMaterial=random()>.45?mats.leaf:mats.leafDark;for(const [cx,cy,cz,s]of[[0,.78,0,1],[.45,.7,.15,.72],[-.38,.68,-.22,.78],[.12,.9,-.2,.67]])add(group,new THREE.DodecahedronGeometry(h*.22*s,0),crownMaterial,[cx*scale,h*cy,cz*scale],[random(),random(),random()]);}
    place(group,x,z,rotation);if(collision)obstacle(x,z,.55*scale,.55*scale);return group;
  }

  function vegetation({x=0,z=0,radius=1,count=7,color='leaf',name='vegetation'}={}){
    const group=named(new THREE.Group(),name),foliage=material(color);for(let i=0;i<count;i++){const angle=random()*Math.PI*2,distance=random()*radius,height=.28+random()*.55;const blade=add(group,new THREE.ConeGeometry(.08+random()*.08,height,5),foliage,[Math.cos(angle)*distance,height/2,Math.sin(angle)*distance],[0,random()*Math.PI,(random()-.5)*.25]);blade.castShadow=false;}place(group,x,z,random()*Math.PI);return group;
  }

  return{materials:mats,house,wall,tower,gatehouse,bridge,castle,ruin,tavern,temple,crypt,tree,vegetation};
}
