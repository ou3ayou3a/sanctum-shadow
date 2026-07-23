// Sanctum & Shadow — static geometry merger, v2.
//
// WHY V1 BROKE THE GAME (2026-07-22, reverted): it merged building shells and
// interior walls into giant per-material blobs. CameraObstruction fades the
// individual wall/roof mesh between the camera and the player — with walls
// welded into one mesh it either fades the whole building (ghost city) or,
// when it can't, the camera stares into an unlit merged shell (black tavern).
// It also deleted TANGENT attributes, flattening normal-mapped lighting.
//
// V2 RULES — obstruction is a design constraint, not an afterthought:
//   · runs ONLY in the open city (vaelthar_city). Interiors are a couple
//     hundred meshes — they never had a draw-call problem, and their walls
//     are exactly what obstruction must keep fadeable.
//   · never merges anything CameraObstruction could classify as an occluder:
//     the SAME test it uses (ancestor-name regex + bounding radius > 1.65).
//     Building shells, roofs, walls, towers stay individual and fadeable.
//     What merges is the small static clutter — posts, crates, stalls,
//     fences, cobbles, trim — which is most of the mesh count.
//   · preserves TANGENT attributes (normal maps keep their shading).
//   · merged output is tagged noOccluder so obstruction ignores it by
//     radius (it only ever contains small props, never legitimate walls).
//   · plus all v1 exclusions: ground (movement raycasts), interactables
//     and their subtrees (click raycasts), transparent materials (smoke,
//     water, landmark cylinders), skinned/morphing meshes, door/gate names,
//     userData.noMerge.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Mirror of camera-obstruction.mjs OCCLUDER_NAMES — keep in sync.
const OCCLUDER_NAMES = /roof|wall|house|keep|tower|gate|building|production|tavern|temple|citadel|church|shop|warehouse|workshop|estate|interior|canopy/;
const OCCLUDER_RADIUS = 1.65;
const MERGEABLE_ZONES = new Set(['vaelthar_city']);
const KEEP_ATTRS = new Set(['position', 'normal', 'uv', 'color', 'tangent']);

function isObstructionOccluder(mesh, zoneRoot) {
  let name = '', current = mesh;
  while (current && current !== zoneRoot) { name += ' ' + (current.name || ''); current = current.parent; }
  if (OCCLUDER_NAMES.test(name.toLowerCase())) return true;
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const radius = (mesh.geometry.boundingSphere?.radius || 0) * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z);
  return radius > OCCLUDER_RADIUS;
}

function eligible(mesh, excluded, zoneRoot) {
  if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh) return false;
  if (excluded.has(mesh)) return false;
  const geo = mesh.geometry, mat = mesh.material;
  if (!geo || !geo.getAttribute || !geo.getAttribute('position')) return false;
  if (Array.isArray(mat) || !mat || mat.transparent) return false;
  if (mesh.userData && (mesh.userData.noMerge || mesh.userData.interactionId)) return false;
  if (/door|gate/i.test(mesh.name || '')) return false;
  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length) return false;
  if (isObstructionOccluder(mesh, zoneRoot)) return false;   // ← the v2 rule
  return true;
}

function attributeSignature(geo) {
  return Object.keys(geo.attributes).filter(n => KEEP_ATTRS.has(n)).sort().join(',');
}

function collectExcluded(zone) {
  const excluded = new Set();
  const addTree = obj => { if (obj && obj.traverse) obj.traverse(o => excluded.add(o)); else if (obj) excluded.add(obj); };
  addTree(zone.ground);
  for (const record of zone.interactables || []) addTree(record.object);
  return excluded;
}

export function mergeZoneStatics(zone) {
  const root = zone && zone.root;
  if (!root || !MERGEABLE_ZONES.has(zone.id)) return { merged: 0, groups: 0, skippedZone: true };
  root.updateMatrixWorld(true);
  const excluded = collectExcluded(zone);

  const buckets = new Map();
  root.traverse(mesh => {
    if (!eligible(mesh, excluded, root)) return;
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
    if (bucket.meshes.length < 3) continue;
    const geometries = [];
    for (const mesh of bucket.meshes) {
      let geo = mesh.geometry.clone();
      for (const name of Object.keys(geo.attributes)) {
        if (!KEEP_ATTRS.has(name)) geo.deleteAttribute(name);
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
    mesh.userData.noOccluder = true;   // obstruction must ignore the blob
    mesh.userData.noMerge = true;
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
