import {placeEnvironmentAsset,placeEnvironmentAssetBatch,preloadEnvironmentAsset} from './environment-asset-loader.js?v=144';
import {productionAssetSpec} from './production-assets.mjs';

function registerObstacle(obstacles,{x,z,width,depth,rotation=0}){const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));obstacles.push({x,z,hw:c*width/2+s*depth/2,hd:s*width/2+c*depth/2});}
function seeded(seed){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};}

export function buildVaeltharAssetSlice({root,obstacles,buildingPlots,materialLibrary}){
  const animated=[],doors=[],jobs=[],failures=[];
  jobs.push(preloadEnvironmentAsset(productionAssetSpec('tavern_interior')).catch(error=>{failures.push({name:'preload:tavern-interior',error});return null;}));
  const place=(spec,placement,{sway=0,doorId=null}={})=>{const job=placeEnvironmentAsset(root,spec,placement).then(object=>{materialLibrary?.apply(object);if(sway)animated.push({object,phase:placement.position[0]*.37+placement.position[2]*.19,strength:sway});if(doorId)object.traverse(child=>{if(/INTERACT.*Door/i.test(child.name))doors.push({id:doorId,object:child,closed:child.rotation.y,target:0,amount:0});});return object;}).catch(error=>{failures.push({name:placement.name,error});console.warn(`Environment asset failed: ${placement.name}`,error);return null;});jobs.push(job);return job;};
  const placeBatch=(spec,placements,name)=>{const job=placeEnvironmentAssetBatch(root,spec,placements,{name}).then(object=>{if(object)materialLibrary?.apply(object);return object;}).catch(error=>{failures.push({name,error});console.warn(`Environment asset batch failed: ${name}`,error);return null;});jobs.push(job);return job;};

  for(const [index,plot] of buildingPlots.entries()){
    registerObstacle(obstacles,plot);
    const asset=plot.asset||['house_a','house_b','house_c'][index%3];
    place(productionAssetSpec(asset),{name:`production:${plot.id}`,position:[plot.x,0,plot.z],rotation:plot.rotation,size:[plot.width,plot.height,plot.depth]});
  }

  registerObstacle(obstacles,{x:-16,z:13,width:10,depth:7.4});
  place(productionAssetSpec('tavern'),{name:'production:tarnished-cup',position:[-16,0,13],rotation:0,size:[10,8.4,8.7]},{doorId:'tarnished_cup'});
  registerObstacle(obstacles,{x:27,z:13,width:7.4,depth:6.2,rotation:-.12});
  place(productionAssetSpec('merchant_shop'),{name:'production:ash-market-smithy',position:[27,0,13],rotation:-.12,size:[7.4,8.2,6.2]});
  registerObstacle(obstacles,{x:-22,z:-4,width:8,depth:8});
  place(productionAssetSpec('house_b'),{name:'production:church-archive',position:[-22,0,-4],rotation:Math.PI/2,size:[8,8.8,8]},{doorId:'church_archive'});
  registerObstacle(obstacles,{x:17,z:-17,width:9,depth:9});
  place(productionAssetSpec('temple'),{name:'production:eternal-flame-temple',position:[17,0,-17],rotation:0,size:[11.5,11.5,9]},{doorId:'temple_quarter'});
  registerObstacle(obstacles,{x:-13,z:-14,width:5,depth:4,rotation:.08});
  place(productionAssetSpec('ancient_ruin'),{name:'production:signing-hall-ruin',position:[-13,.04,-14],rotation:.08,size:[11,5.2,8]});

  for(const [z,label,rotation] of[[-39,'crown-gate',0],[41,'south-gate',Math.PI]]){
    for(const side of[-1,1])registerObstacle(obstacles,{x:side*4.2,z,width:4.7,depth:5.2});
    place(productionAssetSpec('city_gatehouse'),{name:`production:${label}`,position:[0,0,z],rotation,size:[11.5,10.2,5.2]},{doorId:label==='crown-gate'?'north_gate':'south_gate'});
  }

  // Complete authored curtain wall: repeated shared GLB templates keep the
  // silhouette continuous while retaining one cached geometry/material set.
  const wallSegments=[];
  for(const z of[-30,-20,-10,0,10,20,30])for(const x of[-39,39])wallSegments.push({x,z,rotation:Math.PI/2,name:`${x<0?'west':'east'}-${z}`});
  for(const x of[-31.5,-22,-12.5,12.5,22,31.5])for(const z of[-39,39])wallSegments.push({x,z,rotation:0,name:`${z<0?'north':'south'}-${x}`});
  for(const segment of wallSegments)registerObstacle(obstacles,{...segment,width:9.5,depth:1.45});
  placeBatch(productionAssetSpec('castle_wall'),wallSegments.map(segment=>({name:`production:curtain-wall-${segment.name}`,position:[segment.x,0,segment.z],rotation:segment.rotation,size:[9.5,5.8,2]})),'production:instanced-curtain-walls');
  const cornerTowers=[[-39,-39],[-39,39],[39,-39],[39,39]];for(const[x,z]of cornerTowers)registerObstacle(obstacles,{x,z,width:6.2,depth:6.2});
  placeBatch(productionAssetSpec('castle_tower'),cornerTowers.map(([x,z])=>({name:`production:corner-tower-${x}-${z}`,position:[x,0,z],rotation:0,size:[6.2,11.5,6.2]})),'production:instanced-corner-towers');

  // The northern citadel is a layered authored silhouette rather than one inflated primitive castle.
  place(productionAssetSpec('castle_keep'),{name:'production:crown-citadel',position:[0,4,-51],rotation:0,size:[16,19,13.5]});
  for(const [x,z,height]of[[-10,-48,15],[10,-48,15],[-10,-56,13],[10,-56,13]])place(productionAssetSpec('castle_tower'),{name:`production:citadel-tower-${x}-${z}`,position:[x,4,z],rotation:0,size:[6.4,height,6.4]});
  for(const [x,z,rotation]of[[0,-43,0],[0,-59,0],[-12,-51,Math.PI/2],[12,-51,Math.PI/2]])place(productionAssetSpec('castle_wall'),{name:`production:citadel-wall-${x}-${z}`,position:[x,4,z],rotation,size:[12,6.5,2.2]});
  place(productionAssetSpec('street_chapel'),{name:'production:citadel-chapel',position:[-18,4,-52],rotation:0,size:[7.4,10,7]});
  place(productionAssetSpec('guild_hall'),{name:'production:citadel-barracks',position:[18,4,-52],rotation:0,size:[10.4,10,8.2]});

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
    openDoor(id){for(const door of doors)if(door.id===id){door.target=1;clearTimeout(door.timer);door.timer=setTimeout(()=>door.target=0,2200);}},
    update(time){for(const item of animated)item.object.rotation.z=Math.sin(time*.72+item.phase)*item.strength;for(const door of doors){door.amount+=(door.target-door.amount)*.16;door.object.rotation.y=door.closed+door.amount*Math.PI*.48;}},
    failures
  };
}
