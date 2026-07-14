import * as THREE from 'three';

export const NATURE_COMPONENTS=Object.freeze(['terrain','forest','tree','rockFormation','river','path','undergrowth','fogBank','wind']);

const smoothstep=(min,max,value)=>{const t=Math.max(0,Math.min(1,(value-min)/(max-min||1)));return t*t*(3-2*t);};
const colorValue=(value,fallback)=>typeof value==='number'?value:fallback;

function ribbonGeometry(points,width,y=.03,samplesPerSegment=10){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,y,z)),false,'centripetal'),samples=Math.max(8,(points.length-1)*samplesPerSegment),vertices=[],uvs=[],indices=[];let previous=new THREE.Vector3(1,0,0);
  for(let index=0;index<=samples;index++){const t=index/samples,point=curve.getPoint(t),tangent=curve.getTangent(t).setY(0).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x);if(normal.lengthSq()<.1)normal.copy(previous);else previous.copy(normal);vertices.push(point.x+normal.x*width/2,y,point.z+normal.z*width/2,point.x-normal.x*width/2,y,point.z-normal.z*width/2);uvs.push(0,t*8,1,t*8);if(index<samples){const a=index*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,b,c,d);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createNatureKit({root,obstacles=[],architecture,random=Math.random,palette={}}={}){
  if(!root)throw new Error('Nature kit requires a root group');
  if(!architecture)throw new Error('Nature kit requires the architecture kit');
  const colors={ground:colorValue(palette.ground,0x334236),soil:colorValue(palette.soil,0x4a3d2d),rock:colorValue(palette.rock??palette.stone,0x555d56),water:colorValue(palette.water,0x315e62),leaf:colorValue(palette.leaf,0x2d4b35),fog:colorValue(palette.fog,0x71857c)};
  const material=(color,options={})=>new THREE.MeshStandardMaterial({color,roughness:options.roughness??.9,metalness:options.metalness??0,emissive:options.emissive??0,emissiveIntensity:options.emissiveIntensity??0,transparent:!!options.transparent,opacity:options.opacity??1,side:options.side??THREE.FrontSide,depthWrite:options.depthWrite??true});
  const groundMaterial=material(colors.ground),soilMaterial=material(colors.soil),rockMaterials=[material(colors.rock),material(new THREE.Color(colors.rock).multiplyScalar(.72).getHex()),material(new THREE.Color(colors.rock).multiplyScalar(1.12).getHex())],waterMaterial=material(colors.water,{roughness:.18,metalness:.08,emissive:new THREE.Color(colors.water).multiplyScalar(.38).getHex(),emissiveIntensity:.55,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false});
  const animated=[];
  const name=(object,type)=>{object.name=`nature:${type}`;object.userData.natureType=type;return object;};
  const addObstacle=(x,z,width,depth)=>obstacles.push({x,z,hw:width/2,hd:depth/2});

  function terrain({size=64,segments=36,flatRadius=22,amplitude=4,y=-.14,name:terrainName='terrain'}={}){
    const geometry=new THREE.PlaneGeometry(size,size,segments,segments);geometry.rotateX(-Math.PI/2);const positions=geometry.attributes.position,maxRadius=size*.68;
    for(let index=0;index<positions.count;index++){const x=positions.getX(index),z=positions.getZ(index),radius=Math.hypot(x,z),edge=smoothstep(flatRadius,maxRadius,radius),ridge=Math.sin(x*.17+z*.06)*.55+Math.cos(z*.21-x*.04)*.36+Math.sin((x+z)*.09)*.24;positions.setY(index,y+ridge*amplitude*edge);}
    positions.needsUpdate=true;geometry.computeVertexNormals();const mesh=name(new THREE.Mesh(geometry,groundMaterial),terrainName);mesh.receiveShadow=true;root.add(mesh);return mesh;
  }

  function tree(options={}){const group=architecture.tree(options);group.userData.natureType=options.dead?'dead-tree':'tree';animated.push({kind:'sway',object:group,phase:random()*Math.PI*2,strength:(options.dead ? .004 : .012)*(options.scale??1)});return group;}

  function undergrowth({x=0,z=0,radius=1,count=7,color='leaf'}={}){const group=architecture.vegetation({x,z,radius,count,color});group.userData.natureType='undergrowth';animated.push({kind:'sway',object:group,phase:random()*Math.PI*2,strength:.018});return group;}

  function rockFormation({x=0,z=0,scale=1,count=3,collision=true,name:rockName='rock-formation'}={}){
    const group=name(new THREE.Group(),rockName);group.position.set(x,0,z);for(let index=0;index<count;index++){const radius=scale*(.45+random()*.55),rock=new THREE.Mesh(new THREE.DodecahedronGeometry(radius,index%2),rockMaterials[index%rockMaterials.length]);rock.position.set((random()-.5)*scale*1.4,radius*.55,(random()-.5)*scale*1.25);rock.scale.set(.75+random()*.7,.75+random()*1.2,.7+random()*.7);rock.rotation.set(random(),random()*Math.PI,random()*.4);rock.castShadow=rock.receiveShadow=true;group.add(rock);}root.add(group);if(collision)addObstacle(x,z,scale*1.7,scale*1.55);return group;
  }

  function path({points,width=2.4,y=.025,name:pathName='path'}={}){const mesh=name(new THREE.Mesh(ribbonGeometry(points,width,y,12),soilMaterial),pathName);mesh.receiveShadow=true;root.add(mesh);return mesh;}

  function river({points,width=4,y=.04,name:riverName='river'}={}){
    const bank=name(new THREE.Mesh(ribbonGeometry(points,width+1.8,y-.025,14),soilMaterial),`${riverName}-bank`);bank.receiveShadow=true;root.add(bank);const water=name(new THREE.Mesh(ribbonGeometry(points,width,y,16),waterMaterial),riverName);water.receiveShadow=true;root.add(water);animated.push({kind:'water',object:water,phase:random()*Math.PI*2,baseY:y});return{bank,water};
  }

  function fogBank({x=0,z=0,width=12,depth=7,count=32,color=colors.fog,name:fogName='ground-fog'}={}){
    const positions=new Float32Array(count*3);for(let index=0;index<count;index++){positions[index*3]=(random()-.5)*width;positions[index*3+1]=.18+random()*.85;positions[index*3+2]=(random()-.5)*depth;}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const points=name(new THREE.Points(geometry,new THREE.PointsMaterial({color,size:.65,transparent:true,opacity:.16,depthWrite:false,sizeAttenuation:true})),fogName);points.position.set(x,0,z);root.add(points);animated.push({kind:'fog',object:points,phase:random()*Math.PI*2,originX:x,width});return points;
  }

  function forest({center=[0,0],innerRadius=10,outerRadius=24,count=48,dead=false,collision=true,undergrowthCount=Math.floor(count*.8)}={}){
    const trees=[];for(let index=0;index<count;index++){const angle=index/count*Math.PI*2+(random()-.5)*.28,radius=innerRadius+random()*(outerRadius-innerRadius),scale=.65+random()*.75;trees.push(tree({x:center[0]+Math.cos(angle)*radius,z:center[1]+Math.sin(angle)*radius,height:4.6+random()*2.5,scale,dead,collision}));}
    if(!dead)for(let index=0;index<undergrowthCount;index++){const angle=random()*Math.PI*2,radius=innerRadius*.65+random()*(outerRadius-innerRadius*.65);undergrowth({x:center[0]+Math.cos(angle)*radius,z:center[1]+Math.sin(angle)*radius,radius:.35+random()*.7,count:4+Math.floor(random()*6)});}return trees;
  }

  function update(time){for(const item of animated){if(item.kind==='sway'){item.object.rotation.z=Math.sin(time*.8+item.phase)*item.strength;item.object.rotation.x=Math.cos(time*.55+item.phase)*item.strength*.45;}else if(item.kind==='water'){item.object.position.y=item.baseY+Math.sin(time*1.7+item.phase)*.018;item.object.material.emissiveIntensity=.45+Math.sin(time*.9+item.phase)*.12;}else if(item.kind==='fog'){item.object.position.x=item.originX+Math.sin(time*.1+item.phase)*item.width*.12;item.object.material.opacity=.12+Math.sin(time*.35+item.phase)*.04;}}}

  return{terrain,tree,forest,rockFormation,river,path,undergrowth,fogBank,update,materials:{ground:groundMaterial,soil:soilMaterial,water:waterMaterial}};
}
