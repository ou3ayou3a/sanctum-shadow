import * as THREE from 'three';

function seeded(seed=0x51a7c1){let value=seed>>>0;return()=>((value=Math.imul(value^value>>>15,2246822519)^Math.imul(value^value>>>13,3266489917))>>>0)/4294967296;}
function transform(x,y,z,rotation=0,scale=[1,1,1]){return{x,y,z,rotation,scale};}

export function createCityDetailKit({root,streets=[],buildingPlots=[],materials}){
  const random=seeded(),animated=[],instances=[],dummy=new THREE.Object3D();
  const pbr=(kind,color,options)=>materials?.material(kind,color,options)||new THREE.MeshStandardMaterial({color,roughness:.9,...options});
  const makeInstances=(name,geometry,material,items,{cast=true,receive=true}={})=>{const mesh=new THREE.InstancedMesh(geometry,material,items.length);mesh.name=name;mesh.castShadow=cast;mesh.receiveShadow=receive;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);items.forEach((item,index)=>{dummy.position.set(item.x,item.y,item.z);dummy.rotation.set(0,item.rotation||0,0);dummy.scale.set(...(item.scale||[1,1,1]));dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;root.add(mesh);instances.push(mesh);return mesh;};

  const curbs=[],drains=[],streetDebris=[],puddles=[];
  for(const street of streets){
    const curve=new THREE.CatmullRomCurve3(street.points.map(([x,z])=>new THREE.Vector3(x,.075,z)),false,'centripetal'),length=curve.getLength(),count=Math.max(3,Math.floor(length/1.45));
    for(let index=0;index<=count;index++){
      const t=index/count,point=curve.getPoint(t),tangent=curve.getTangent(t).setY(0).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x),rotation=Math.atan2(tangent.x,tangent.z),edge=street.width*.5+.15;
      for(const side of[-1,1]){if((index+side+street.id.length)%13!==0)curbs.push(transform(point.x+normal.x*edge,.13,point.z+normal.z*edge,rotation,[1.22,.18,.24]));drains.push(transform(point.x+normal.x*(edge-.34),.057,point.z+normal.z*(edge-.34),rotation,[1.28,.025,.22]));}
      if(index%7===0)streetDebris.push(transform(point.x+(random()-.5)*street.width*.7,.10,point.z+(random()-.5)*street.width*.7,random()*Math.PI,[.22+random()*.35,.12+random()*.25,.2+random()*.3]));
      if(index%11===0)puddles.push(transform(point.x+(random()-.5)*street.width*.55,.07,point.z+(random()-.5)*street.width*.55,random()*Math.PI,[.55+random()*.8,.55+random()*.65,1]));
    }
  }
  makeInstances('street-curbs',new THREE.BoxGeometry(1,1,1),pbr('stone',0x726552,{bumpScale:.06}),curbs);
  makeInstances('drainage-channels',new THREE.BoxGeometry(1,1,1),pbr('stone',0x282621,{bumpScale:.08}),drains,{cast:false});
  makeInstances('street-wear-and-rubble',new THREE.DodecahedronGeometry(.5,0),pbr('stone',0x554c40),streetDebris);
  const puddleMaterial=new THREE.MeshStandardMaterial({color:0x293e3c,metalness:.12,roughness:.18,transparent:true,opacity:.58,depthWrite:false});const puddleGeometry=new THREE.CircleGeometry(1,24);puddleGeometry.rotateX(-Math.PI/2);const puddleMesh=makeInstances('rain-puddles',puddleGeometry,puddleMaterial,puddles,{cast:false});

  const alleyMaterial=pbr('mud',0x665039,{bumpScale:.07}),alleyTransforms=[];
  const alleys=[[[-36,25],[-24,25]],[[-35,-16],[-21,-16]],[[12,33],[32,33]],[[-29,-4],[-19,-4]],[[21,-34],[34,-34]],[[8,-25],[8,-14]]];
  for(const [[ax,az],[bx,bz]]of alleys){const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),rotation=Math.atan2(dx,dz);alleyTransforms.push(transform((ax+bx)/2,.045,(az+bz)/2,rotation,[2.0,.035,length]));}
  makeInstances('packed-earth-alleys',new THREE.BoxGeometry(1,1,1),alleyMaterial,alleyTransforms,{cast:false});

  const authoredSteps=[];for(let i=0;i<7;i++)authoredSteps.push(transform(0,.08+i*.16,-36.5-i*.48,0,[8+i*.55,.18,.52]));for(let i=0;i<5;i++)authoredSteps.push(transform(17,.08+i*.1,-9.2-i*.42,0,[6+i*.28,.14,.46]));for(let i=0;i<4;i++)authoredSteps.push(transform(-24-i*.42,.08+i*.08,-1,Math.PI/2,[5+i*.2,.13,.46]));
  makeInstances('district-stone-stairs',new THREE.BoxGeometry(1,1,1),pbr('stone',0x655a49),authoredSteps);

  const barrels=[],crates=[],sacks=[],hay=[],signPosts=[],fencePosts=[];
  for(const [index,plot]of buildingPlots.entries()){
    const side=index%4,along=(random()-.5)*(side<2?plot.width:plot.depth)*.6,x=plot.x+(side===0?-plot.width*.53:side===1?plot.width*.53:along),z=plot.z+(side===2?-plot.depth*.54:side===3?plot.depth*.54:along);
    barrels.push(transform(x,.48,z,random()*Math.PI,[.72,.95,.72]));crates.push(transform(x+(random()-.5)*1.25,.34,z+(random()-.5)*1.25,random()*Math.PI,[.65,.65,.65]));
    if(index%2===0)sacks.push(transform(x+(random()-.5)*1.5,.27,z+(random()-.5)*1.5,random()*Math.PI,[.5,.7,.5]));
    if(index%5===0)hay.push(transform(x+(random()-.5)*1.6,.42,z+(random()-.5)*1.6,random()*Math.PI,[1.1,.78,.72]));
    if(index%2===0)signPosts.push(transform(x,.95,z,plot.rotation||0,[.16,1.9,.16]));
  }
  for(let i=0;i<95;i++){const angle=random()*Math.PI*2,radius=10+random()*28,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;if(Math.abs(x)<5||Math.abs(z)<5)continue;crates.push(transform(x,.22,z,random()*Math.PI,[.28+random()*.4,.28+random()*.4,.28+random()*.4]));}
  for(const [x,z,length,rotation]of[[-36,8,14,0],[-35,-27,12,0],[35,25,13,0],[-28,36,12,Math.PI/2],[28,-36,10,Math.PI/2]])for(let i=0;i<length;i++)fencePosts.push(transform(x+(rotation?0:i*.9),.65,z+(rotation?i*.9:0),rotation,[.13,1.3,.13]));
  makeInstances('working-city-barrels',new THREE.CylinderGeometry(.46,.42,1,12),pbr('timber',0x54351e),barrels);
  makeInstances('working-city-crates',new THREE.BoxGeometry(1,1,1),pbr('timber',0x67472b),crates);
  makeInstances('working-city-sacks',new THREE.SphereGeometry(.5,10,7),pbr('plaster',0x92734d),sacks);
  makeInstances('working-city-hay',new THREE.BoxGeometry(1,1,1),pbr('vegetation',0x9b7d3c),hay);
  makeInstances('shop-sign-posts',new THREE.BoxGeometry(1,1,1),pbr('timber',0x3b281b),signPosts);
  makeInstances('yard-and-wall-fences',new THREE.BoxGeometry(1,1,1),pbr('timber',0x332316),fencePosts);

  const flags=[];for(const [index,[x,z]]of[[-7,-36],[7,-36],[-36,-8],[36,8],[-11,-27],[11,-27],[24,-20],[-25,8]].entries()){const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.2,2.25,5,3),new THREE.MeshStandardMaterial({color:index%2?0x8a6837:0x6f2928,roughness:.82,side:THREE.DoubleSide}));flag.position.set(x,5.3,z);flag.rotation.y=index%4*Math.PI/2;flag.castShadow=true;root.add(flag);flags.push({mesh:flag,base:flag.geometry.attributes.position.array.slice(),phase:index*.74});}animated.push({kind:'flags',items:flags});

  const animals=[];for(let index=0;index<12;index++){const group=new THREE.Group(),body=new THREE.Mesh(new THREE.SphereGeometry(.22,index%3===0?10:7,6),pbr('vegetation',index%3===0?0x5a4432:0x8b7656));body.scale.set(index%3===0?1.8:1.15,.82,index%3===0?.75:1);body.position.y=.27;group.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.12,7,5),body.material);head.position.set(.22,.34,0);group.add(head);const x=-28+random()*56,z=-27+random()*55;group.position.set(x,0,z);root.add(group);animals.push({group,origin:new THREE.Vector3(x,0,z),phase:random()*Math.PI*2,radius:1+random()*2.4,speed:.14+random()*.16});}animated.push({kind:'animals',items:animals});

  return{
    instanceCount:instances.reduce((sum,mesh)=>sum+mesh.count,0),
    setWetness(amount){const wet=THREE.MathUtils.clamp(amount,0,1);puddleMesh.visible=wet>.04;puddleMaterial.opacity=.12+wet*.52;puddleMaterial.roughness=.5-wet*.34;alleyMaterial.roughness=1-wet*.18;},
    update(time){for(const group of animated){if(group.kind==='flags')for(const flag of group.items){const position=flag.mesh.geometry.attributes.position,array=position.array;for(let i=0;i<position.count;i++){array[i*3+2]=flag.base[i*3+2]+Math.sin(time*2.2+flag.phase+i*.65)*.07*(i%6)/5;}position.needsUpdate=true;}else for(const animal of group.items){const angle=time*animal.speed+animal.phase;animal.group.position.set(animal.origin.x+Math.cos(angle)*animal.radius,0,animal.origin.z+Math.sin(angle)*animal.radius);animal.group.rotation.y=-angle;}}},
    dispose(){for(const mesh of instances){mesh.geometry.dispose();mesh.material.dispose();}for(const group of animated)if(group.kind==='flags')for(const flag of group.items){flag.mesh.geometry.dispose();flag.mesh.material.dispose();}else if(group.kind==='animals')for(const animal of group.items)animal.group.traverse(object=>{object.geometry?.dispose();object.material?.dispose?.();});}
  };
}
