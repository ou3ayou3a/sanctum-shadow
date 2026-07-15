import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

const TEMPLATE_CACHE=new Map();

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
  if(!TEMPLATE_CACHE.has(key))TEMPLATE_CACHE.set(key,(async()=>{
    let object;
    if(spec.type==='gltf')object=(await new GLTFLoader().loadAsync(spec.url)).scene;
    else if(spec.type==='fbx')object=await new FBXLoader().loadAsync(spec.url);
    else if(spec.type==='obj'){
      const materials=await new MTLLoader().loadAsync(spec.mtlUrl);materials.preload();
      object=await new OBJLoader().setMaterials(materials).loadAsync(spec.objUrl);
    }else throw new Error(`Unsupported environment asset type: ${spec.type}`);
    return prepareTemplate(object);
  })().catch(error=>{TEMPLATE_CACHE.delete(key);throw error;}));
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

export async function preloadEnvironmentAsset(spec){await loadTemplate(spec);return assetKey(spec);}

export function cachedEnvironmentAssetCount(){return TEMPLATE_CACHE.size;}
