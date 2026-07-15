import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

const TEMPLATE_CACHE=new Map();
const LOAD_QUEUE=[];
const MAX_CONCURRENT_LOADS=4;
let activeLoads=0,completedLoads=0;

function pumpLoadQueue(){
  while(activeLoads<MAX_CONCURRENT_LOADS&&LOAD_QUEUE.length){const job=LOAD_QUEUE.shift();activeLoads++;job.task().then(job.resolve,job.reject).finally(()=>{activeLoads--;completedLoads++;pumpLoadQueue();});}
}

function scheduleLoad(task){return new Promise((resolve,reject)=>{LOAD_QUEUE.push({task,resolve,reject});pumpLoadQueue();});}

function assetKey(spec){return `${spec.type}:${spec.url||spec.objUrl}`;}

function standardMaterial(source){
  if(source?.isMeshStandardMaterial)return source;
  const material=new THREE.MeshStandardMaterial({
    name:source?.name||'environment-material',
    color:source?.color?.clone?.()||new THREE.Color(0x777777),
    map:source?.map||null,
    normalMap:source?.normalMap||null,
    emissive:source?.emissive?.clone?.()||new THREE.Color(0x000000),
    emissiveMap:source?.emissiveMap||null,
    transparent:!!source?.transparent,
    opacity:source?.opacity??1,
    alphaTest:source?.alphaTest??0,
    side:source?.side??THREE.FrontSide,
    roughness:.84,
    metalness:.03
  });
  if(material.transparent||material.alphaTest>0){material.side=THREE.DoubleSide;material.depthWrite=false;}
  return material;
}

function prepareTemplate(object){
  object.traverse(child=>{
    child.userData.environmentAssetShared=true;
    if(!child.isMesh)return;
    child.castShadow=true;child.receiveShadow=true;
    child.material=Array.isArray(child.material)?child.material.map(standardMaterial):standardMaterial(child.material);
  });
  return object;
}

async function loadTemplate(spec){
  const key=assetKey(spec);
  if(!TEMPLATE_CACHE.has(key))TEMPLATE_CACHE.set(key,scheduleLoad(async()=>{
    let object;
    if(spec.type==='gltf')object=(await new GLTFLoader().loadAsync(spec.url)).scene;
    else if(spec.type==='fbx')object=await new FBXLoader().loadAsync(spec.url);
    else if(spec.type==='obj'){
      const materials=await new MTLLoader().loadAsync(spec.mtlUrl);materials.preload();
      object=await new OBJLoader().setMaterials(materials).loadAsync(spec.objUrl);
    }else throw new Error(`Unsupported environment asset type: ${spec.type}`);
    return prepareTemplate(object);
  }).catch(error=>{TEMPLATE_CACHE.delete(key);throw error;}));
  return TEMPLATE_CACHE.get(key);
}

function fittedClone(template,{size=[1,1,1],position=[0,0,0],rotation=0,name='environment-asset'}={}){
  const model=template.clone(true),sourceBox=new THREE.Box3().setFromObject(model),sourceSize=sourceBox.getSize(new THREE.Vector3());
  const scale=Math.min(size[0]/Math.max(sourceSize.x,.001),size[1]/Math.max(sourceSize.y,.001),size[2]/Math.max(sourceSize.z,.001));
  model.scale.setScalar(scale);
  const scaledBox=new THREE.Box3().setFromObject(model),center=scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-scaledBox.min.y,-center.z);
  const holder=new THREE.Group();holder.name=name;holder.userData.environmentAsset=true;holder.position.set(...position);holder.rotation.y=rotation;holder.add(model);
  return holder;
}

export async function placeEnvironmentAsset(root,spec,placement={}){
  if(!root)throw new Error('Environment assets require a scene root.');
  const template=await loadTemplate(spec),object=fittedClone(template,placement);root.add(object);return object;
}

export async function placeEnvironmentAssetBatch(root,spec,placements=[],{name='environment-asset-batch'}={}){
  if(!root)throw new Error('Environment asset batches require a scene root.');
  if(!Array.isArray(placements)||!placements.length)return null;
  const template=await loadTemplate(spec),holders=placements.map(placement=>fittedClone(template,placement)),meshSets=holders.map(holder=>{holder.updateMatrixWorld(true);const meshes=[];holder.traverse(child=>{if(child.isMesh&&!child.isSkinnedMesh)meshes.push(child);});return meshes;}),meshCount=meshSets[0]?.length||0;
  if(!meshCount){const group=new THREE.Group();group.name=name;for(const holder of holders)group.add(holder);root.add(group);return group;}
  const group=new THREE.Group();group.name=name;group.userData.environmentAsset=true;group.userData.instancedBatch=true;group.userData.instanceCount=placements.length;
  for(let meshIndex=0;meshIndex<meshCount;meshIndex++){const source=meshSets[0][meshIndex],instances=new THREE.InstancedMesh(source.geometry,source.material,placements.length);instances.name=`${name}:mesh-${meshIndex}`;instances.castShadow=source.castShadow;instances.receiveShadow=source.receiveShadow;instances.userData.environmentAssetShared=true;for(let placementIndex=0;placementIndex<placements.length;placementIndex++){const mesh=meshSets[placementIndex][meshIndex];instances.setMatrixAt(placementIndex,mesh.matrixWorld);}instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();group.add(instances);}
  root.add(group);return group;
}

export async function preloadEnvironmentAsset(spec){await loadTemplate(spec);return assetKey(spec);}

export function cachedEnvironmentAssetCount(){return TEMPLATE_CACHE.size;}

export function environmentAssetLoadStats(){return{active:activeLoads,queued:LOAD_QUEUE.length,completed:completedLoads,cached:TEMPLATE_CACHE.size,maxConcurrent:MAX_CONCURRENT_LOADS};}
