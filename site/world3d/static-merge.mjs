// Sanctum & Shadow — static geometry merger.
//
// The procedural city is authored as thousands of small primitive meshes
// (block()/addMesh() output). Each visible mesh is a draw call, and each
// shadow-casting mesh is drawn AGAIN into the sun's shadow map — profiling
// the live city showed ~2,800 meshes / ~1,350 shadow casters, which is what
// tanks the frame rate even on strong GPUs. Triangles are cheap; draw calls
// are not.
//
// This pass welds all STATIC primitive meshes that share a material into one
// big mesh per (material, castShadow, receiveShadow) group. Eligibility is
// deliberately conservative:
//   · only primitive geometries (geometry.parameters exists — block()/addMesh()
//     output; GLTF buildings, and their openable doors, are never touched)
//   · never the ground (movement raycasts), never interactables or their
//     descendants (click raycasts), never skinned meshes or sprites
//   · never transparent materials (smoke puffs, water, and the invisible
//     landmark cylinders are all animated or raycast-sensitive — and all
//     transparent, so this one rule excludes them)
//   · never anything with userData.noMerge, or named like a door/gate
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function eligible(mesh, excluded) {
  if (!mesh.isMesh || mesh.isSkinnedMesh) return false;
  if (excluded.has(mesh)) return false;
  const geo = mesh.geometry, mat = mesh.material;
  if (!geo || !geo.getAttribute || !geo.getAttribute('position')) return false;
  if (Array.isArray(mat)) return false;
  if (!mat || mat.transparent) return false;
  if (mesh.userData && mesh.userData.noMerge) return false;
  if (/door|gate/i.test(mesh.name || '')) return false;
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length) return false;
  return true;
}

// Merging requires identical attribute sets per bucket; bucket on the
// signature so GLTF meshes (uv/color layouts vary per model) never collide.
function attributeSignature(geo) {
  return Object.keys(geo.attributes).filter(n => n === 'position' || n === 'normal' || n === 'uv' || n === 'color').sort().join(',');
}

function collectExcluded(zone) {
  const excluded = new Set();
  const addTree = obj => { if (obj) obj.traverse ? obj.traverse(o => excluded.add(o)) : excluded.add(obj); };
  addTree(zone.ground);
  for (const record of zone.interactables || []) addTree(record.object);
  return excluded;
}

// Merge the zone's static primitives in place. Returns stats for logging.
export function mergeZoneStatics(zone) {
  const root = zone && zone.root;
  if (!root) return { merged: 0, groups: 0 };
  root.updateMatrixWorld(true);
  const excluded = collectExcluded(zone);

  // Bucket by material instance + shadow flags.
  const buckets = new Map();
  root.traverse(mesh => {
    if (!eligible(mesh, excluded)) return;
    const key = mesh.material.uuid + '|' + (mesh.castShadow ? 1 : 0) + '|' + (mesh.receiveShadow ? 1 : 0) + '|' + attributeSignature(mesh.geometry);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, bucket = { material: mesh.material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, meshes: [] });
    bucket.meshes.push(mesh);
  });

  const mergedGroup = new THREE.Group();
  mergedGroup.name = 'static-merged';
  mergedGroup.userData.noMerge = true;
  let mergedCount = 0, groupCount = 0;

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 2) continue;           // nothing to gain
    const geometries = [];
    for (const mesh of bucket.meshes) {
      let geo = mesh.geometry.clone();
      // Keep only the attributes in the bucket signature, drop morphs, and
      // de-index so indexed and non-indexed geometry can merge together.
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') geo.deleteAttribute(name);
      }
      geo.morphAttributes = {};
      if (geo.index) geo = geo.toNonIndexed();
      geo.applyMatrix4(mesh.matrixWorld);
      geometries.push(geo);
    }
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.matrixAutoUpdate = false;
    mergedGroup.add(mesh);
    groupCount++;
    for (const original of bucket.meshes) {
      original.removeFromParent();
      original.geometry.dispose();
      mergedCount++;
    }
  }

  if (groupCount) root.add(mergedGroup);
  return { merged: mergedCount, groups: groupCount };
}
