import {placeEnvironmentAsset} from './environment-asset-loader.js';

const CITY='world3d/assets/environment/medieval-village';
const NATURE='world3d/assets/environment/stylized-nature';
const CAVE='world3d/assets/environment/cave/Cave_Entrance_lowpoly';

const cityModel=name=>({type:'obj',objUrl:`${CITY}/${name}.obj`,mtlUrl:`${CITY}/${name}.mtl`});
const natureModel=name=>({type:'gltf',url:`${NATURE}/${name}.gltf`});
const caveModel={type:'fbx',url:`${CAVE}/Cave_Entrance.fbx`};

function registerObstacle(obstacles,{x,z,width,depth,rotation=0}){const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));obstacles.push({x,z,hw:c*width/2+s*depth/2,hd:s*width/2+c*depth/2});}
function seeded(seed){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};}

export function buildVaeltharAssetSlice({root,obstacles,buildingPlots}){
  const animated=[],jobs=[],failures=[];
  const place=(spec,placement,{sway=0}={})=>{const job=placeEnvironmentAsset(root,spec,placement).then(object=>{if(sway)animated.push({object,phase:placement.position[0]*.37+placement.position[2]*.19,strength:sway});return object;}).catch(error=>{failures.push({name:placement.name,error});console.warn(`Environment asset failed: ${placement.name}`,error);return null;});jobs.push(job);return job;};

  const houseNames=['House_1','House_2','House_3','House_4'];
  for(const [index,plot] of buildingPlots.entries()){
    registerObstacle(obstacles,plot);
    place(cityModel(houseNames[index%houseNames.length]),{name:`authored:${plot.id}`,position:[plot.x,0,plot.z],rotation:plot.rotation,size:[plot.width,plot.height+2,plot.depth]});
  }

  registerObstacle(obstacles,{x:-16,z:13,width:10,depth:7.4});
  place(cityModel('Inn'),{name:'authored:tarnished-cup',position:[-16,0,13],rotation:0,size:[10,6.4,7.4]});
  registerObstacle(obstacles,{x:27,z:13,width:7.4,depth:6.2,rotation:-.12});
  place(cityModel('Blacksmith'),{name:'authored:ash-market-smithy',position:[27,0,13],rotation:-.12,size:[7.4,5.8,6.2]});
  registerObstacle(obstacles,{x:-22,z:-4,width:8,depth:8});
  place(cityModel('House_2'),{name:'authored:church-archive',position:[-22,0,-4],rotation:Math.PI/2,size:[8,7.4,8]});
  registerObstacle(obstacles,{x:17,z:-17,width:9,depth:9});
  place(cityModel('Bell_Tower'),{name:'authored:eternal-flame-temple',position:[17,0,-17],rotation:Math.PI,size:[9,13.5,9]});

  for(const [z,label] of[[-39,'crown-gate'],[41,'south-gate']])for(const side of[-1,1]){
    registerObstacle(obstacles,{x:side*6.5,z,width:5,depth:5});
    place(cityModel('Bell_Tower'),{name:`authored:${label}-${side<0?'west':'east'}`,position:[side*6.5,0,z],rotation:side<0?.05:-.05,size:[5.4,11.5,5.4]});
  }

  // The northern citadel is a layered authored silhouette rather than one inflated primitive castle.
  for(const item of[
    {name:'Bell_Tower',x:0,z:-49,size:[9,15,9],rotation:0},
    {name:'House_1',x:-9,z:-47,size:[10,10,9],rotation:.08},
    {name:'House_2',x:9,z:-47,size:[10,10,9],rotation:-.08}
  ])place(cityModel(item.name),{name:`authored:citadel-${item.name}-${item.x}`,position:[item.x,4,item.z],rotation:item.rotation,size:item.size});

  const random=seeded(0x5a17c1),treeNames=['BirchTree_1','BirchTree_2','BirchTree_3'];
  const treePositions=[[-5.8,58],[6.2,61],[-7.2,64],[7.4,55],[-8.2,51],[8.5,48],[-11,60],[11.5,65]];
  for(let i=0;i<42;i++){
    const side=i%2===0?-1:1,z=42+random()*23,x=side*(5.5+random()*34.5);
    if(Math.abs(x)<11&&z<48)continue;
    treePositions.push([x,z]);
  }
  for(let i=0;i<24;i++){
    const angle=random()*Math.PI*2,radius=47+random()*15,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(z>38)continue;treePositions.push([x,z]);
  }
  for(const [index,[x,z]] of treePositions.entries()){
    const height=6.4+random()*3.5,scale=.82+random()*.26;
    place(natureModel(treeNames[index%treeNames.length]),{name:`authored:tree-${index}`,position:[x,-.12,z],rotation:random()*Math.PI*2,size:[4.6*scale,height,4.6*scale]},{sway:.005+random()*.004});
  }
  for(let i=0;i<30;i++){
    const side=i%2===0?-1:1,x=side*(4+random()*33),z=43+random()*22;
    place(natureModel('Bush_Large'),{name:`authored:bush-${i}`,position:[x,-.08,z],rotation:random()*Math.PI*2,size:[1.2+random()*.7,1.2+random()*.65,1.2+random()*.7]},{sway:.012});
  }

  registerObstacle(obstacles,{x:-25,z:55,width:11,depth:7,rotation:.18});
  place(caveModel,{name:'authored:thornwood-cave',position:[-25,-.1,55],rotation:.18,size:[12,8,8]});

  return{
    ready:Promise.all(jobs).then(()=>({loaded:jobs.length-failures.length,failed:failures.length,failures})),
    update(time){for(const item of animated)item.object.rotation.z=Math.sin(time*.72+item.phase)*item.strength;},
    failures
  };
}
