import {placeEnvironmentAsset} from './environment-asset-loader.js';
import {productionAssetSpec} from './production-assets.mjs';

function registerObstacle(obstacles,{x,z,width,depth,rotation=0}){const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));obstacles.push({x,z,hw:c*width/2+s*depth/2,hd:s*width/2+c*depth/2});}
function seeded(seed){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};}

export function buildVaeltharAssetSlice({root,obstacles,buildingPlots}){
  const animated=[],jobs=[],failures=[];
  const place=(spec,placement,{sway=0}={})=>{const job=placeEnvironmentAsset(root,spec,placement).then(object=>{if(sway)animated.push({object,phase:placement.position[0]*.37+placement.position[2]*.19,strength:sway});return object;}).catch(error=>{failures.push({name:placement.name,error});console.warn(`Environment asset failed: ${placement.name}`,error);return null;});jobs.push(job);return job;};

  const houseNames=['house_a','house_b','house_c'];
  for(const [index,plot] of buildingPlots.entries()){
    registerObstacle(obstacles,plot);
    place(productionAssetSpec(houseNames[index%houseNames.length]),{name:`production:${plot.id}`,position:[plot.x,0,plot.z],rotation:plot.rotation,size:[plot.width,plot.height+2.8,plot.depth]});
  }

  registerObstacle(obstacles,{x:-16,z:13,width:10,depth:7.4});
  place(productionAssetSpec('tavern'),{name:'production:tarnished-cup',position:[-16,0,13],rotation:0,size:[10,8.4,8.7]});
  registerObstacle(obstacles,{x:27,z:13,width:7.4,depth:6.2,rotation:-.12});
  place(productionAssetSpec('merchant_shop'),{name:'production:ash-market-smithy',position:[27,0,13],rotation:-.12,size:[7.4,8.2,6.2]});
  registerObstacle(obstacles,{x:-22,z:-4,width:8,depth:8});
  place(productionAssetSpec('house_b'),{name:'production:church-archive',position:[-22,0,-4],rotation:Math.PI/2,size:[8,8.8,8]});
  registerObstacle(obstacles,{x:17,z:-17,width:9,depth:9});
  place(productionAssetSpec('temple'),{name:'production:eternal-flame-temple',position:[17,0,-17],rotation:0,size:[11.5,11.5,9]});
  registerObstacle(obstacles,{x:-13,z:-14,width:5,depth:4,rotation:.08});
  place(productionAssetSpec('ancient_ruin'),{name:'production:signing-hall-ruin',position:[-13,.04,-14],rotation:.08,size:[11,5.2,8]});

  for(const [z,label,rotation] of[[-39,'crown-gate',0],[41,'south-gate',Math.PI]]){
    for(const side of[-1,1])registerObstacle(obstacles,{x:side*4.2,z,width:4.7,depth:5.2});
    place(productionAssetSpec('city_gatehouse'),{name:`production:${label}`,position:[0,0,z],rotation,size:[11.5,10.2,5.2]});
  }

  // The northern citadel is a layered authored silhouette rather than one inflated primitive castle.
  place(productionAssetSpec('castle_keep'),{name:'production:crown-citadel',position:[0,4,-49],rotation:0,size:[15,18,12.5]});
  for(const side of[-1,1])place(productionAssetSpec('castle_tower'),{name:`production:citadel-tower-${side}`,position:[side*9,4,-47],rotation:0,size:[6.2,14,6.2]});

  const random=seeded(0x5a17c1),treeNames=['forest_tree','oak_tree'];
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
    place(productionAssetSpec(treeNames[index%treeNames.length]),{name:`production:tree-${index}`,position:[x,-.12,z],rotation:random()*Math.PI*2,size:[4.6*scale,height,4.6*scale]},{sway:.005+random()*.004});
  }
  registerObstacle(obstacles,{x:-25,z:55,width:11,depth:7,rotation:.18});
  place(productionAssetSpec('cave_entrance'),{name:'production:thornwood-cave',position:[-25,-.1,55],rotation:.18,size:[12,8,8]});

  return{
    ready:Promise.all(jobs).then(()=>({loaded:jobs.length-failures.length,failed:failures.length,failures})),
    update(time){for(const item of animated)item.object.rotation.z=Math.sin(time*.72+item.phase)*item.strength;},
    failures
  };
}
