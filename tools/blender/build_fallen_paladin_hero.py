"""Bind the CC BY "Fallen Paladin" knight to the game rig as a playable hero (BUILD-SPEC §2, §3, §4.1).

Primary method (spec §2.3): import the live human.glb rig, pose + stretch it onto the knight's sculpted
A-pose, "Apply Pose as Rest" on that single rig, weight + bind the knight, export with NO animations.
The 26 human clips are copied afterwards at the glTF level by tools/hero/transplant-clips.mjs.

Usage (Blender 5.2):
  Blender --background --python-exit-code 1 --python tools/blender/build_fallen_paladin_hero.py -- \
      --out <bind.glb> [--weights copy|heat|distance] [--canary] [--canary-out <canary.glb>] \
      [--report <report.json>] [--labels <labels.json>] [--landmarks <rig-frame.json>] [--save-blend <f.blend>] \
      [--human <human.glb>] [--source <fallen-paladin-static.glb>]

  --weights copy      §3.1 PRIMARY: nearest-surface copy from the posed/stretched vanguard_Mesh
  --weights heat      §3.2 bone-heat weights on a voxel-remeshed proxy, copied back by nearest surface
  --weights distance  §3.3 inverse-distance-to-bone-segment weights restricted per segment label
  All three then run plate locking (§3.1.2), region overrides (§3.1.3) and normalize/limit/clean (§3.1.4).
  --canary            also export a second GLB that keeps vanguard_Mesh as an extra skinned mesh (§6.1.3)
  --labels            per-vertex region/segment labels (glTF-frame positions) for verify-hero.cjs
  --fallback-tpose    §2.3 FALLBACK is not implemented in v1 (the primary method passes the gates).
  --cape-thigh F      symmetric thigh share at the cape hem (default REG['cape_thigh_share'] = 0.4; 0 = pelvis only)
  --smooth N / --rigid-plates   seam diffusion iterations after the overrides (default 20) / keep locked plates fixed
  k_leg is reported here; tools/hero/build-hero.sh applies the §6.1.4 one-step ground-contact correction after the gates.

Read-only inputs: human.glb (sha256-checked) and the static knight (sha256-checked). Writes only the paths given.
"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
HUMAN_DEFAULT = ROOT / 'site/world3d/assets/production/characters/human.glb'
HUMAN_SHA256 = '63dbac868a655d671fc93219bb8f5e0eae55cbbe691b9ec628b651dbe8ab9ab5'
SOURCE_DEFAULT = '/Users/michelzakhia/Downloads/sanctum-shadow/site/prototype/fallen-paladin/fallen-paladin-static.glb'
SOURCE_SHA256 = '6c8a444bbbb97f4110e16e67580abb57b1239c8c411f00b01df24f599388868d'

# ---------------------------------------------------------------------------------------------
# Joint targets, rig frame (Blender world, metres; X<0 = mixamorig Left, +Y front, +Z up).
# Converted from understand/source/landmarks_final.json with (x, y, z) -> (-y, x - 0.09, z).
# This table is the only place joint positions live; every length factor and swing is derived from it.
# ---------------------------------------------------------------------------------------------
LANDMARKS = {
    'Neck': (0.0, -0.065, 1.720),
    'Head': (0.0, -0.020, 1.840),
    'Arm': {'L': (-0.300, -0.080, 1.565), 'R': (0.300, -0.080, 1.565)},
    'ForeArm': {'L': (-0.410, -0.105, 1.300), 'R': (0.410, -0.105, 1.300)},
    'Hand': {'L': (-0.455, 0.020, 1.030), 'R': (0.455, 0.020, 1.030)},
    'HandTip': {'L': (-0.450, 0.030, 0.925), 'R': (0.455, 0.030, 0.860)},
    'Leg': {'L': (-0.225, 0.000, 0.590), 'R': (0.225, 0.000, 0.590)},
    'Foot': {'L': (-0.285, -0.060, 0.120), 'R': (0.285, -0.060, 0.120)},
    'ToeBase': {'L': (-0.385, 0.075, 0.020), 'R': (0.385, 0.075, 0.020)},
}
TORSO_FACTOR = 1.205          # Spine, Spine1, Spine2, Left/RightShoulder (human offsets x 1.205, no swing)
SWORD_TIP = (-0.5025, 0.31, 0.0002)
SWORD_TRIS = 3214
BODY_TRIS = 61785
SIDES = (('L', 'Left'), ('R', 'Right'))
LM_ACTIVE = LANDMARKS         # the table in use (LANDMARKS or --landmarks)


def log(*a):
    print('[hero]', *a, flush=True)


def B(n):
    return 'mixamorig:' + n


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser(prog='build_fallen_paladin_hero.py')
    ap.add_argument('--out', required=True)
    ap.add_argument('--weights', choices=['copy', 'heat', 'distance'], default='copy')
    ap.add_argument('--canary', action='store_true')
    ap.add_argument('--canary-out')
    ap.add_argument('--report')
    ap.add_argument('--labels')
    ap.add_argument('--landmarks')
    ap.add_argument('--save-blend')
    ap.add_argument('--human', default=str(HUMAN_DEFAULT))
    ap.add_argument('--source', default=SOURCE_DEFAULT)
    ap.add_argument('--heat-voxel', type=float, default=0.008)
    ap.add_argument('--heat-scale', type=float, default=10.0)
    ap.add_argument('--heat-decimate', type=int, default=0, help='decimate the remeshed proxy to about this many faces')
    ap.add_argument('--smooth', type=int, default=20, help='seam diffusion iterations after the overrides (0 = off)')
    ap.add_argument('--rigid-plates', action='store_true',
                    help='keep locked plates out of the seam diffusion (measured worse: the tabard is welded along the thigh plate)')
    ap.add_argument('--fallback-tpose', action='store_true')
    ap.add_argument('--cape-thigh', type=float, default=None, help='override REG cape_thigh_share (0 = pelvis-only hem)')
    return ap.parse_args(argv)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def update():
    bpy.context.view_layer.update()


# ---------------------------------------------------------------------------------------------
# §2.3 steps 1-6: rig import, base pose, lengthen + aim, bake vanguard, apply pose as rest
# ---------------------------------------------------------------------------------------------
def import_rig(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    rig = bpy.data.objects['Character']
    assert rig.type == 'ARMATURE', 'Character is not an armature'
    armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    assert len(armatures) == 1, f'expected 1 armature, got {[o.name for o in armatures]}'
    assert len(rig.data.bones) == 49, f'expected 49 bones, got {len(rig.data.bones)}'
    assert not any(b.use_connect for b in rig.data.bones), 'connected bones present'
    ad = rig.animation_data
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    ad.action = None
    rig.data.pose_position = 'POSE'
    for name in ('Icosphere', 'vanguard_visor'):
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    van = bpy.data.objects['vanguard_Mesh']
    assert len(van.vertex_groups) == 49
    return rig, van


def base_pose(rig):
    """Arms (Shoulder/Arm/Hand, fingers included) from Idle's first frame; spine, neck, head, legs at rest."""
    act = bpy.data.actions['Idle']
    ad = rig.animation_data
    ad.action = act
    if hasattr(ad, 'action_slot') and ad.action_slot is None and len(act.slots):
        ad.action_slot = act.slots[0]
    f0 = int(round(act.frame_range[0]))
    bpy.context.scene.frame_set(f0)
    update()
    keys = ('Shoulder', 'Arm', 'Hand')
    base = {pb.name: pb.matrix_basis.copy() for pb in rig.pose.bones if any(k in pb.name for k in keys)}
    ad.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    for n, m in base.items():
        rig.pose.bones[n].matrix_basis = m
    update()
    dev = max(abs(a - b) for r1, r2 in zip(rig.pose.bones[B('LeftArm')].matrix_basis, Matrix.Identity(4)) for a, b in zip(r1, r2))
    assert dev > 0.1, 'Idle base pose did not apply (action slot not assigned?)'
    return {'idle_frame': f0, 'posed_bones': len(base)}


class Fitter:
    def __init__(self, rig):
        self.rig = rig
        self.MW = rig.matrix_world.copy()
        self.MWi = self.MW.inverted()
        self.factors = {}
        self.swings = {}

    def pb(self, n):
        return self.rig.pose.bones[n]

    def head_w(self, n):
        return self.MW @ self.pb(n).head

    def lengthen(self, child, factor):
        pb = self.pb(child)
        b = pb.bone
        rel = b.parent.matrix_local.inverted() @ b.matrix_local      # child rest in parent rest frame
        dp = rel.translation * (factor - 1.0)                       # delta in parent frame
        pb.location = pb.location + rel.to_3x3().inverted() @ dp    # into child rest axes
        update()
        self.factors[child] = factor

    def lengthen_to(self, parent, child, target_w):
        bones = self.rig.data.bones
        l_rest = (bones[child].head_local - bones[parent].head_local).length
        tgt = self.MWi @ Vector(target_w)
        l_tgt = (tgt - self.pb(parent).head).length
        self.lengthen(child, l_tgt / l_rest)

    def aim(self, bone, child, target_w):
        """Shortest-arc swing about the bone head so head->child_head points at the target."""
        pb = self.pb(bone)
        head = pb.head.copy()
        v1 = (self.pb(child).head - head).normalized()
        v2 = ((self.MWi @ Vector(target_w)) - head).normalized()
        q = v1.rotation_difference(v2)
        pb.matrix = Matrix.Translation(head) @ q.to_matrix().to_4x4() @ Matrix.Translation(-head) @ pb.matrix
        update()
        self.swings[bone] = math.degrees(q.angle)

    def yaw_foot(self, foot, toe, target_w):
        """Give the foot the human's REST orientation turned about world vertical only (no tilt), with the yaw that
        points its toe joint at the target's horizontal direction.

        Why not aim(): the clips write the human's absolute foot rotations, so whatever rotation separates the
        hero's bind foot frame from the human's rest foot frame is applied in reverse to the sabaton in every frame.
        A shortest-arc aim at the end of the splayed A-stance chain (thigh 17 deg out) left the bind foot frame
        tilted ~18 deg from the human's: in Idle the right sabaton stood 17.9 deg on its outer edge and heel strikes
        in Run missed the floor by 3.3 cm. A pure yaw keeps the sole flat whenever the human's sole is flat and
        still turns the toe joint toward the knight's ball landmark (the toe hinge stays on the toe cap)."""
        pb = self.pb(foot)
        head = pb.head.copy()
        b = pb.bone
        rest_rot = b.matrix_local.to_3x3().normalized()                      # human rest, armature space
        tb = self.rig.data.bones[toe]
        up_arm = (self.MWi.to_3x3() @ Vector((0, 0, 1))).normalized()
        to_world = self.MW.to_3x3()
        h_dir = to_world @ (tb.head_local - b.head_local)                    # human rest ankle->toe, world
        k_dir = Vector(target_w) - self.MW @ head                            # hero ankle->ball target, world
        a_h = math.atan2(h_dir.y, h_dir.x)
        a_k = math.atan2(k_dir.y, k_dir.x)
        yaw = math.atan2(math.sin(a_k - a_h), math.cos(a_k - a_h))
        R = Matrix.Rotation(yaw, 3, up_arm) @ rest_rot
        pb.matrix = Matrix.Translation(head) @ R.to_4x4()
        update()
        self.swings[foot] = math.degrees(yaw)
        self.foot_yaw = getattr(self, 'foot_yaw', {})
        self.foot_yaw[foot] = round(math.degrees(yaw), 3)


def fit_rig(rig, lm):
    F = Fitter(rig)
    for c in ('Spine', 'Spine1', 'Spine2'):
        F.lengthen(B(c), TORSO_FACTOR)
    F.lengthen_to(B('Spine2'), B('Neck'), lm['Neck'])
    F.aim(B('Spine2'), B('Neck'), lm['Neck'])
    F.lengthen_to(B('Neck'), B('Head'), lm['Head'])
    F.aim(B('Neck'), B('Head'), lm['Head'])
    for s, side in SIDES:
        F.lengthen(B(side + 'Shoulder'), TORSO_FACTOR)
        for parent, child in (('Shoulder', 'Arm'), ('Arm', 'ForeArm'), ('ForeArm', 'Hand')):
            F.lengthen_to(B(side + parent), B(side + child), lm[child][s])
            F.aim(B(side + parent), B(side + child), lm[child][s])
        F.aim(B(side + 'Hand'), B(side + 'HandMiddle1'), lm['HandTip'][s])
        for parent, child in (('UpLeg', 'Leg'), ('Leg', 'Foot')):
            F.lengthen_to(B(side + parent), B(side + child), lm[child][s])
            F.aim(B(side + parent), B(side + child), lm[child][s])
        F.lengthen_to(B(side + 'Foot'), B(side + 'ToeBase'), lm['ToeBase'][s])
        F.yaw_foot(B(side + 'Foot'), B(side + 'ToeBase'), lm['ToeBase'][s])
    # Verify every target (spec: < 2 mm). ToeBase is placed by the yaw-only foot (no tilt), so it lands within the
    # landmark's +-3 cm hidden-joint uncertainty instead of on it; its offset is reported and bounded separately.
    errors = {}
    toe_offsets = {}
    errors['Neck'] = (F.head_w(B('Neck')) - Vector(lm['Neck'])).length * 1000
    errors['Head'] = (F.head_w(B('Head')) - Vector(lm['Head'])).length * 1000
    for s, side in SIDES:
        for j in ('Arm', 'ForeArm', 'Hand', 'Leg', 'Foot'):
            errors[side + j] = (F.head_w(B(side + j)) - Vector(lm[j][s])).length * 1000
        toe_offsets[side + 'ToeBase_mm'] = round((F.head_w(B(side + 'ToeBase')) - Vector(lm['ToeBase'][s])).length * 1000, 2)
        toe_offsets[side + 'ToeBase_pos'] = [round(c, 4) for c in F.head_w(B(side + 'ToeBase'))]
        d_have = (F.head_w(B(side + 'HandMiddle1')) - F.head_w(B(side + 'Hand'))).normalized()
        d_want = (Vector(lm['HandTip'][s]) - Vector(lm['Hand'][s])).normalized()
        errors[side + 'HandDir_deg'] = math.degrees(d_have.angle(d_want))
    worst = max(v for k, v in errors.items() if not k.endswith('_deg'))
    worst_dir = max(v for k, v in errors.items() if k.endswith('_deg'))
    assert worst < 2.0, f'joint target error {worst:.3f} mm >= 2 mm: {errors}'
    assert worst_dir < 0.1, f'hand direction error {worst_dir:.4f} deg'
    worst_toe = max(v for k, v in toe_offsets.items() if k.endswith('_mm'))
    assert worst_toe < 30.0, f'yaw-only ToeBase {worst_toe:.1f} mm from its landmark (> 3 cm uncertainty): {toe_offsets}'
    posed = {n: [round(c, 4) for c in F.head_w(n)] for n in (B('Spine2'), B('LeftShoulder'), B('RightShoulder'))}
    return F, {'target_errors_mm': {k: round(v, 4) for k, v in errors.items()}, 'worst_target_error_mm': round(worst, 4),
               'toebase_yaw_only': toe_offsets, 'foot_yaw_deg': getattr(F, 'foot_yaw', {}),
               'factors': {k.split(':')[1]: round(v, 4) for k, v in F.factors.items()},
               'swings_deg': {k.split(':')[1]: round(v, 3) for k, v in F.swings.items()}, 'posed_heads': posed}


def leg_lengths(rig_bones_heads):
    out = {}
    for s, side in SIDES:
        h = rig_bones_heads
        out[side] = {'thigh': (h[B(side + 'Leg')] - h[B(side + 'UpLeg')]).length,
                     'shin': (h[B(side + 'Foot')] - h[B(side + 'Leg')]).length}
    return out


def bake_vanguard(van):
    select_only(van)
    for m in list(van.modifiers):
        if m.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=m.name)
    assert not any(m.type == 'ARMATURE' for m in van.modifiers)


def apply_pose_as_rest(rig):
    select_only(rig)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    update()
    for pb in rig.pose.bones:
        dev = max(abs(a - b) for r1, r2 in zip(pb.matrix_basis, Matrix.Identity(4)) for a, b in zip(r1, r2))
        assert dev < 1e-5, f'{pb.name} pose not identity after armature_apply'


# ---------------------------------------------------------------------------------------------
# §2.1 knight import, alignment, UV clean-up; §3.0 connectivity + sword separation
# ---------------------------------------------------------------------------------------------
def import_knight(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    assert len(meshes) == 1, f'expected one knight mesh, got {[o.name for o in new]}'
    body = meshes[0]
    for o in new:
        if o is not body:
            bpy.data.objects.remove(o, do_unlink=True)
    body.parent = None
    body.rotation_mode = 'XYZ'
    body.location = (0.0, -0.09, 0.0)
    body.rotation_euler = (0.0, 0.0, math.radians(90.0))
    body.scale = (1.0, 1.0, 1.0)
    select_only(body)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = body.data
    assert len(me.polygons) == BODY_TRIS + SWORD_TRIS
    assert all(p.loop_total == 3 for p in me.polygons)
    # UV clean-up: repoint every UV consumer at layer 0, then delete layers 2 and 1 (byte-identical copies).
    n = len(me.loops)
    uv0 = np.empty(n * 2, np.float32)
    me.uv_layers[0].data.foreach_get('uv', uv0)
    uv_dev = 0.0
    for k in range(1, len(me.uv_layers)):
        uvk = np.empty(n * 2, np.float32)
        me.uv_layers[k].data.foreach_get('uv', uvk)
        uv_dev = max(uv_dev, float(np.abs(uvk - uv0).max()))
    name0 = me.uv_layers[0].name
    assert len(me.materials) == 1
    mat = me.materials[0]
    for node in mat.node_tree.nodes:
        if node.type in ('UVMAP', 'NORMAL_MAP'):
            node.uv_map = name0
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[len(me.uv_layers) - 1])
    return body, {'uv_layers_max_abs_diff_vs_layer0': uv_dev, 'material': mat.name,
                  'double_sided': not mat.use_backface_culling}


class UnionFind:
    def __init__(self, n):
        self.p = np.arange(n)

    def find(self, a):
        p = self.p
        while p[a] != a:
            p[a] = p[p[a]]
            a = p[a]
        return a

    def union_edges(self, edges):
        p = self.p
        find = self.find
        for a, b in edges:
            ra, rb = find(a), find(b)
            if ra != rb:
                p[ra] = rb

    def labels(self):
        return np.array([self.find(i) for i in range(len(self.p))])


def mesh_arrays(obj):
    me = obj.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    co = np.array([list(obj.matrix_world @ Vector(c)) for c in co]) if obj.matrix_world != Matrix.Identity(4) else co
    ed = np.empty(len(me.edges) * 2, np.int64)
    me.edges.foreach_get('vertices', ed)
    tri = np.empty(len(me.polygons) * 3, np.int64)
    me.polygons.foreach_get('vertices', tri)
    return co, ed.reshape(-1, 2), tri.reshape(-1, 3)


def welded(co, edges):
    keys = np.round(co / 1e-5).astype(np.int64)
    _, weld = np.unique(keys, axis=0, return_inverse=True)
    weld = weld.ravel()
    nw = int(weld.max()) + 1
    wco = np.zeros((nw, 3))
    wco[weld] = co
    wed = weld[edges]
    wed = wed[wed[:, 0] != wed[:, 1]]
    wed = np.unique(np.sort(wed, axis=1), axis=0)
    return weld, wco, wed


def components(n, edges):
    uf = UnionFind(n)
    uf.union_edges(edges.tolist())
    return uf.labels()


def separate_sword(body):
    co, ed, tri = mesh_arrays(body)
    weld, wco, wed = welded(co, ed)
    comp = components(len(wco), wed)[weld]
    uniq, counts = np.unique(comp, return_counts=True)
    seed = int(np.argmin(((co - np.array(SWORD_TIP)) ** 2).sum(1)))
    sword_comp = comp[seed]
    face_comp = comp[tri[:, 0]]
    sword_faces = face_comp == sword_comp
    info = {'components': int(len(uniq)), 'seed_vertex_dist_m': float(np.linalg.norm(co[seed] - np.array(SWORD_TIP))),
            'sword_tris': int(sword_faces.sum()), 'body_tris': int((~sword_faces).sum())}
    assert info['components'] == 2, f'expected 2 connected components, got {info}'
    assert info['sword_tris'] == SWORD_TRIS, f'sword triangle gate failed: {info}'
    me = body.data
    vsel = comp == sword_comp
    me.vertices.foreach_set('select', vsel)
    me.edges.foreach_set('select', vsel[ed].all(1))
    me.polygons.foreach_set('select', sword_faces)
    select_only(body)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    sword = next(o for o in bpy.context.selected_objects if o is not body)
    body.name = 'FallenPaladin_Body'
    body.data.name = 'FallenPaladin_Body'
    sword.name = 'FP_Sword_Mesh'
    sword.data.name = 'FP_Sword_Mesh'
    assert len(body.data.polygons) == BODY_TRIS and len(sword.data.polygons) == SWORD_TRIS
    return sword, info


def setup_sword(sword_mesh_obj):
    """§3.4: blade along Blender +Z (glTF +Y), crossguard along +X, origin at the crossguard, data in cm.

    Deviation from the spec text (documented in the report): FP_Sword is an EMPTY (scale 0.01, location 0,
    no parent) with the mesh as child 'FP_Sword_Mesh'. gltf-transform quantize rewrites the TRS of a leaf
    mesh node to dequantize it, which would break `blade.scale.setScalar(1)` in class-equipment.js; with a
    parent node the dequantization lands on the child and FP_Sword keeps its clean scale of 0.01."""
    me = sword_mesh_obj.data
    P = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', P)
    P = P.reshape(-1, 3)
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False)
    a1, a2 = vt[0], vt[1]
    if np.dot(np.array(SWORD_TIP) - c, a1) < 0:
        a1 = -a1                                   # guard -> tip
    s = (P - c) @ a1
    w = (P - c) @ a2
    edges = np.arange(s.min(), s.max() + 0.01, 0.01)
    widths = []
    for lo in edges[:-1]:
        m = (s >= lo) & (s < lo + 0.01)
        widths.append(float(w[m].max() - w[m].min()) if m.any() else 0.0)
    k = int(np.argmax(widths))
    s0 = edges[k] + 0.005
    sel = np.abs(s - s0) <= 0.015
    origin = P[sel].mean(0)
    ref = 0 if abs(a2[0]) >= abs(a2[1]) else 1      # deterministic crossguard sign
    if a2[ref] < 0:
        a2 = -a2
    a3 = np.cross(a1, a2)                            # X = crossguard, Y = a1 x a2, Z = blade
    R = Matrix(((*a2, 0), (*a3, 0), (*a1, 0), (0, 0, 0, 1)))
    M = Matrix.Scale(100.0, 4) @ R @ Matrix.Translation(-Vector(origin))
    me.transform(M)
    me.update()
    Q = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', Q)
    Q = Q.reshape(-1, 3)
    empty = bpy.data.objects.new('FP_Sword', None)
    bpy.context.scene.collection.objects.link(empty)
    empty.location = (0, 0, 0)
    empty.rotation_mode = 'QUATERNION'
    empty.rotation_quaternion = (1, 0, 0, 0)
    empty.scale = (0.01, 0.01, 0.01)
    sword_mesh_obj.parent = empty
    sword_mesh_obj.matrix_parent_inverse = Matrix.Identity(4)
    sword_mesh_obj.location = (0, 0, 0)
    sword_mesh_obj.rotation_mode = 'QUATERNION'
    sword_mesh_obj.rotation_quaternion = (1, 0, 0, 0)
    sword_mesh_obj.scale = (1, 1, 1)
    for p in me.polygons:
        p.use_smooth = True
    # Grip: the narrow run of 1 cm slices between the guard (z=0) and the pommel (min z).
    zs = np.arange(np.floor(Q[:, 2].min()), -1.0, 1.0)
    prof = []
    for lo in zs:
        m = (Q[:, 2] >= lo) & (Q[:, 2] < lo + 1.0)
        prof.append(float(np.ptp(Q[m, 0])) if m.sum() > 2 else 0.0)
    prof = np.array(prof)
    inner = prof[2:-2] if len(prof) > 6 else prof
    wmin = float(inner[inner > 0].min()) if (inner > 0).any() else 0.0
    grip_bins = zs[(prof > 0) & (prof <= wmin * 1.35)]
    grip_centre = float(grip_bins.mean() + 0.5) if len(grip_bins) else None
    return {'origin_source_rigframe_m': [round(float(v), 4) for v in origin], 'crossguard_width_cm': round(widths[k] * 100, 2),
            'blade_axis_rigframe': [round(float(v), 4) for v in a1], 'crossguard_axis_rigframe': [round(float(v), 4) for v in a2],
            'length_cm': round(float(Q[:, 2].max() - Q[:, 2].min()), 2), 'tip_z_cm': round(float(Q[:, 2].max()), 2),
            'pommel_z_cm': round(float(Q[:, 2].min()), 2),
            'grip_centre_z_cm_estimate': round(grip_centre, 2) if grip_centre is not None else None,
            'grip_width_cm': round(wmin, 2)}


# ---------------------------------------------------------------------------------------------
# §3 weighting
# ---------------------------------------------------------------------------------------------
class Skel:
    def __init__(self, rig):
        MW = rig.matrix_world
        self.names = [b.name for b in rig.data.bones]
        self.idx = {n: i for i, n in enumerate(self.names)}
        self.H = {b.name: np.array(MW @ b.head_local) for b in rig.data.bones}

    def seg(self, short):
        H = self.H
        n = B(short)
        if short == 'Hips':
            return H[n], H[B('Spine')]
        nxt = {'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
        if short in nxt:
            return H[n], H[B(nxt[short])]
        if short == 'Head':
            return H[n], H[n] + np.array([0, 0, 0.20])
        for side in ('Left', 'Right'):
            chain = {'Shoulder': 'Arm', 'Arm': 'ForeArm', 'ForeArm': 'Hand', 'UpLeg': 'Leg', 'Leg': 'Foot', 'Foot': 'ToeBase'}
            for a, b in chain.items():
                if short == side + a:
                    return H[n], H[B(side + b)]
            if short == side + 'Hand':
                return H[n], H[n] + 1.8 * (H[B(side + 'HandMiddle1')] - H[n])
            if short == side + 'ToeBase':
                d = H[n] - H[B(side + 'Foot')]
                return H[n], H[n] + 0.08 * d / np.linalg.norm(d)
        raise KeyError(short)


SEG_TORSO, SEG_ARM_L, SEG_ARM_R, SEG_CAPE = 0, 1, 2, 3
SEG_NAMES = ['torso_legs', 'arm_L', 'arm_R', 'cape']
REGIONS = ['copied', 'plate', 'hand', 'helmet', 'gorget', 'hood', 'cape', 'tabard', 'tasset', 'pauldron', 'sabaton', 'fallback']
RID = {n: i for i, n in enumerate(REGIONS)}


def segment_labels(co, ed):
    """§3.0 segment labels via union-find on the welded submeshes."""
    weld, wco, wed = welded(co, ed)
    lab_w = np.full(len(wco), SEG_TORSO)
    stats = {}

    def comps_below(zmax):
        m = wco[:, 2] < zmax
        e = wed[m[wed[:, 0]] & m[wed[:, 1]]]
        c = components(len(wco), e)
        out = []
        for cid in np.unique(c[m]):
            ids = np.nonzero((c == cid) & m)[0]
            out.append((ids, wco[ids].mean(0)))
        return out

    arms = []
    for ids, cen in comps_below(1.46):
        if abs(cen[0]) > 0.30:
            lab_w[ids] = SEG_ARM_L if cen[0] < 0 else SEG_ARM_R
            arms.append({'verts': int(len(ids)), 'centroid': [round(float(v), 3) for v in cen]})
    capes = []
    for ids, cen in comps_below(1.50):
        if cen[1] < -0.20:
            free = ids[lab_w[ids] == SEG_TORSO]
            lab_w[free] = SEG_CAPE
            capes.append({'verts': int(len(ids)), 'centroid': [round(float(v), 3) for v in cen]})
    big = sorted(comps_below(1.46), key=lambda t: -len(t[0]))[:6]
    stats['components_below_1.46'] = [{'verts': int(len(i)), 'centroid': [round(float(v), 3) for v in c]} for i, c in big]
    stats['arm_components'] = arms
    stats['cape_components'] = capes
    lab = lab_w[weld]
    stats['vertex_counts'] = {SEG_NAMES[k]: int((lab == k).sum()) for k in range(4)}
    return lab, stats


def point_seg_dist(P, a, b):
    d = b - a
    t = np.clip(((P - a) @ d) / max(float(d @ d), 1e-12), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * d[None, :]), axis=1), t


ARM_BONES = ['Shoulder', 'Arm', 'ForeArm', 'Hand']
TORSO_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
               'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm',
               'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
CAPE_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2']


def distance_weights(sk, co, seg, mask=None):
    """§3.3: weight ~ 1/max(d, 0.01)^4 over the 2 nearest allowed bone segments."""
    N = len(co)
    W = np.zeros((N, len(sk.names)), np.float32)
    allowed = {SEG_TORSO: TORSO_BONES, SEG_CAPE: CAPE_BONES,
               SEG_ARM_L: ['Left' + b for b in ARM_BONES], SEG_ARM_R: ['Right' + b for b in ARM_BONES]}
    for lab, bones in allowed.items():
        sel = seg == lab
        if mask is not None:
            sel &= mask
        ids = np.nonzero(sel)[0]
        if not len(ids):
            continue
        D = np.stack([point_seg_dist(co[ids], *sk.seg(b))[0] for b in bones], 1)
        order = np.argsort(D, 1)[:, :2]
        for k in range(2):
            j = order[:, k]
            d = D[np.arange(len(ids)), j]
            w = 1.0 / np.maximum(d, 0.01) ** 4
            cols = np.array([sk.idx[B(bones[q])] for q in j])
            W[ids, cols] += w
    s = W.sum(1, keepdims=True)
    W = np.where(s > 0, W / np.maximum(s, 1e-12), W)
    return W


def read_groups(obj, sk):
    W = np.zeros((len(obj.data.vertices), len(sk.names)), np.float32)
    gi = {g.index: g.name for g in obj.vertex_groups}
    for v in obj.data.vertices:
        for g in v.groups:
            j = sk.idx.get(gi[g.group])
            if j is not None:
                W[v.index, j] = g.weight
    return W


def transfer_groups(src, dst):
    """Nearest-surface (POLYINTERP_NEAREST) vertex-group copy src -> dst, creating groups by name."""
    for g in list(dst.vertex_groups):
        dst.vertex_groups.remove(g)
    select_only(dst)
    mod = dst.modifiers.new('weights_from_' + src.name, 'DATA_TRANSFER')
    mod.object = src
    mod.use_object_transform = True
    mod.use_vert_data = True
    mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'POLYINTERP_NEAREST'
    mod.layers_vgroup_select_src = 'ALL'
    mod.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.datalayout_transfer(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def weights_copy(body, van, sk):
    transfer_groups(van, body)
    return read_groups(body, sk), {}


def weights_heat(body, sk, co, seg, voxel, heat_scale=10.0, decimate_faces=0):
    t0 = time.time()
    proxy = body.copy()
    proxy.data = body.data.copy()
    proxy.name = 'HeatProxy'
    bpy.context.scene.collection.objects.link(proxy)
    for g in list(proxy.vertex_groups):
        proxy.vertex_groups.remove(g)
    select_only(proxy)
    rm = proxy.modifiers.new('voxel', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = voxel
    rm.adaptivity = 0.0
    rm.use_smooth_shade = False
    bpy.ops.object.modifier_apply(modifier=rm.name)
    remesh_faces = len(proxy.data.polygons)
    if decimate_faces and remesh_faces > decimate_faces:
        dm = proxy.modifiers.new('decimate', 'DECIMATE')
        dm.ratio = decimate_faces / remesh_faces
        bpy.ops.object.modifier_apply(modifier=dm.name)
    proxy_faces = len(proxy.data.polygons)
    # Blender's bone-heat solver has absolute-distance thresholds tuned for larger scenes and fails on this
    # 2 m proxy ("failed to find solution", every weight 0). Solve at heat_scale x, then scale back.
    S = Matrix.Scale(heat_scale, 4)
    proxy.data.transform(S)
    # Throwaway armature with sane tails (tail = primary child head; leaves 0.10 m along the parent direction).
    primary = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
    for side in ('Left', 'Right'):
        primary.update({side + 'Shoulder': side + 'Arm', side + 'Arm': side + 'ForeArm', side + 'ForeArm': side + 'Hand',
                        side + 'Hand': side + 'HandMiddle1', side + 'UpLeg': side + 'Leg', side + 'Leg': side + 'Foot',
                        side + 'Foot': side + 'ToeBase'})
        for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'):
            primary[f'{side}Hand{f}1'] = f'{side}Hand{f}2'
            primary[f'{side}Hand{f}2'] = f'{side}Hand{f}3'
    src_rig = bpy.data.objects['Character']
    adata = bpy.data.armatures.new('HeatRig')
    heat = bpy.data.objects.new('HeatRig', adata)
    bpy.context.scene.collection.objects.link(heat)
    select_only(heat)
    bpy.ops.object.mode_set(mode='EDIT')
    ebs = {}
    def depth(b):
        return 0 if b.parent is None else 1 + depth(b.parent)
    for b in sorted(src_rig.data.bones, key=depth):
        eb = adata.edit_bones.new(b.name)
        h = Vector(sk.H[b.name])
        short = b.name.split(':')[1]
        child = primary.get(short)
        if child and B(child) in sk.H:
            t = Vector(sk.H[B(child)])
        else:
            if b.parent:
                d = (h - Vector(sk.H[b.parent.name]))
                d = d.normalized() if d.length > 1e-6 else Vector((0, 0, 1))
            else:
                d = Vector((0, 0, 1))
            is_finger = short.startswith(('LeftHand', 'RightHand')) and short not in ('LeftHand', 'RightHand')
            t = h + (0.02 if is_finger else 0.10) * d
        if (t - h).length < 1e-3:
            t = h + Vector((0, 0, 0.02))
        eb.head = h * heat_scale
        eb.tail = t * heat_scale
        if b.parent:
            eb.parent = ebs[b.parent.name]
        eb.use_connect = False
        ebs[b.name] = eb
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    proxy.select_set(True)
    heat.select_set(True)
    bpy.context.view_layer.objects.active = heat
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for m in list(proxy.modifiers):
        proxy.modifiers.remove(m)
    proxy.parent = None
    proxy.matrix_world = Matrix.Identity(4)
    proxy.data.transform(S.inverted())
    Wp = read_groups(proxy, sk)
    per_bone = {sk.names[j].split(':')[1]: int((Wp[:, j] > 0.01).sum()) for j in range(len(sk.names))}
    unweighted_proxy = int((Wp.sum(1) <= 0).sum())
    transfer_groups(proxy, body)
    W = read_groups(body, sk)
    bpy.data.objects.remove(proxy, do_unlink=True)
    bpy.data.objects.remove(heat, do_unlink=True)
    # Vertices that inherited no weight (failed heat solve) fall back to §3.3 distance weights.
    empty = W.sum(1) <= 1e-6
    if empty.any():
        Wd = distance_weights(sk, co, seg, mask=empty)
        W[empty] = Wd[empty]
    return W, {'voxel_size': voxel, 'remesh_faces': remesh_faces, 'proxy_faces': proxy_faces, 'heat_scale': heat_scale, 'proxy_unweighted_verts': unweighted_proxy,
               'body_verts_without_heat_weight_fallback_to_distance': int(empty.sum()),
               'proxy_verts_per_bone_gt_0.01': per_bone, 'seconds': round(time.time() - t0, 1)}, empty


def restrict_to_segments(W, co, seg, sk):
    """Zero source weights a vertex's segment may not carry (applied to every mode before plate locking).

    Deviation from §3.1.1 (documented): a plain nearest-surface copy from the slim vanguard body leaks bones
    across segments, because the knight's armour surface is often closer to an unrelated vanguard part than to
    the right one. Measured: the vanguard's hanging left index finger ends at z 0.81, 6.4 cm from the knight's
    left thigh plate, so thigh vertices at z 0.75 inherited LeftHandIndex3 = 1.0 and tore by ~1.1 m in Run.
    The allowed sets are the §3.3 ones: torso/legs never take ForeArm/Hand/fingers and only take Arm above
    z 1.40 (armpit band); arms only take their own Shoulder/Arm/ForeArm/Hand chain; leg chains are side-locked
    (Left only for x < +0.04, Right only for x > -0.04). Rows left empty fall back to §3.3 distance weights."""
    allowed = np.zeros_like(W, bool)
    x, z = co[:, 0], co[:, 2]
    cols = lambda names: [sk.idx[B(n)] for n in names]
    torso = seg == SEG_TORSO
    core = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder']
    allowed[np.ix_(torso, cols(core))] = True
    for side, ok in (('Left', x < 0.04), ('Right', x > -0.04)):
        allowed[np.ix_(torso & ok, cols([side + b for b in ('UpLeg', 'Leg', 'Foot', 'ToeBase')]))] = True
        allowed[np.ix_(torso & (z > 1.40), cols([side + 'Arm']))] = True
    for lab, side in ((SEG_ARM_L, 'Left'), (SEG_ARM_R, 'Right')):
        m = seg == lab
        own = [n for n in sk.names if n.startswith(B(side + 'Hand'))] + [B(side + b) for b in ('Shoulder', 'Arm', 'ForeArm')]
        allowed[np.ix_(m, [sk.idx[n] for n in own])] = True
    allowed[np.ix_(seg == SEG_CAPE, cols(CAPE_BONES))] = True
    before = W.copy()
    W[~allowed] = 0
    removed = before.sum(1) - W.sum(1)
    empty = W.sum(1) <= 1e-6
    if empty.any():
        W[empty] = distance_weights(sk, co, seg, mask=empty)[empty]
    return empty, {'verts_with_disallowed_weight': int((removed > 1e-6).sum()),
                   'verts_with_disallowed_weight_gt_0.5': int((removed > 0.5).sum()),
                   'verts_emptied_fallback_to_distance': int(empty.sum())}


def lock_plates(W, co, seg, sk):
    locked = np.zeros(len(co), bool)
    counts = {}
    argmax = W.argmax(1)
    eligible = seg != SEG_CAPE
    for side in ('Left', 'Right'):
        for short in ('UpLeg', 'Leg', 'Arm', 'ForeArm'):
            n = side + short
            j = sk.idx[B(n)]
            a, b = sk.seg(n)
            d = b - a
            t = ((co - a) @ d) / float(d @ d)
            m = eligible & (argmax == j) & (W[:, j] >= 0.6) & (t >= 0.20) & (t <= 0.80)
            if short == 'UpLeg':          # never split the crotch / skirt centre line between the two thighs
                m &= np.abs(co[:, 0]) >= REG['upleg_lock_min_abs_x']
            W[m] = 0
            W[m, j] = 1.0
            locked |= m
            counts[n] = int(m.sum())
    return locked, counts


# Region-override boxes (§3.1.3), rig frame. Values that differ from the spec text are marked; see report notes.
REG = {
    'helmet_z': 1.84,
    'gorget': (1.72, 1.84, 0.16),
    'hood': (1.55, 1.82, -0.10, 0.20),        # spec: no |x| limit; 0.20 keeps the pauldron backs out of the hood
    'tabard_front': (0.12, 0.50, 0.88, 0.20),
    'rear_flap': (-0.24, -0.05, 0.62, 0.88, 0.18),  # spec: y >= -0.20, z >= 0.70; the panel hangs to z 0.67 at y -0.205
    'tassets': (0.775, 0.94, 0.12),
    'pauldron': (1.47, 1.84, 0.18),           # spec: z <= 1.67; the spikes rise to ~1.82 and kept random copied weights
    'pauldron_arm_full_below_z': 1.50,        # added: blend to Arm = 1 toward the band's lower edge (upper-arm plate)
    'sabaton_z': 0.10,
    'upleg_lock_min_abs_x': 0.06,             # added
    'cape_spine2_band': (0.45, 1.45),         # changed: smoothstep Spine2 share (0 at the low z, 1 at the high z)
    'cape_thigh_ramp': (0.75, 0.25),          # added: symmetric thigh share ramps in from the first z to the second
    'cape_thigh_share': 0.4,                  # added: total (Left+Right UpLeg) share at the hem (see region_overrides)
}


def region_overrides(W, co, seg, sk, region):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    I = sk.idx
    is_arm = (seg == SEG_ARM_L) | (seg == SEG_ARM_R)
    is_cape = seg == SEG_CAPE
    arms_found = is_arm.any()
    counts = {}

    def put(m, assign, name):
        """assign: dict bone_short -> weight array or scalar (only on rows m)."""
        if not m.any():
            counts[name] = 0
            return
        W[m] = 0
        for bone, w in assign.items():
            W[m, I[B(bone)]] = w if np.isscalar(w) else w[m]
        region[m] = RID[name]
        counts[name] = counts.get(name, 0) + int(m.sum())

    # Hands: past the wrist plane, within 0.16 m of the wrist. The spec radius misses the right fist: its tip
    # landmark is 0.170 m from the wrist, so the radius is max(0.16, |tip - wrist| + 0.03) per side.
    for s, side in SIDES:
        wrist = sk.H[B(side + 'Hand')]
        fdir = wrist - sk.H[B(side + 'ForeArm')]
        fdir = fdir / np.linalg.norm(fdir)
        radius = max(0.16, float(np.linalg.norm(np.array(LM_ACTIVE['HandTip'][s]) - wrist)) + 0.03)
        counts['_hand_radius_' + s] = round(radius, 3)
        m = (((co - wrist) @ fdir) > 0) & (np.linalg.norm(co - wrist, axis=1) < radius)
        m &= (seg == (SEG_ARM_L if s == 'L' else SEG_ARM_R)) if arms_found else ((x < 0) if s == 'L' else (x > 0))
        put(m, {side + 'Hand': 1.0}, 'hand')
    # Helmet.
    put(z > REG['helmet_z'], {'Head': 1.0}, 'helmet')
    # Gorget.
    g0, g1, gx = REG['gorget']
    m = (z >= g0) & (z <= g1) & (ax < gx)
    hw = np.clip((z - g0) / (g1 - g0), 0, 1)
    put(m, {'Head': hw, 'Neck': 1 - hw}, 'gorget')
    # Hood / cowl.
    h0, h1, hy, hx = REG['hood']
    hood = (z >= h0) & (z <= h1) & (y < hy) & (ax <= hx) & ~is_arm
    put(hood, {'Spine2': 0.7, 'Neck': 0.3}, 'hood')
    # Cape (free slab). Deviation from the spec's bands (documented): the spec's three 10-25 cm bands
    # (Spine2 >= 1.30, Spine2/Spine1 1.05-1.30, Spine1/Hips 0.95-1.05, Hips below) put the whole spine-vs-pelvis
    # bend of a clip into one strip that the Tripo cape crosses with 15-24 cm edges: at the end of Death (body folded
    # ~90 deg at the hips) those edges tore by 395 mm and the lower cape, rigid to the pelvis, stuck out as a
    # horizontal slab 39 cm above the legs. Now:
    #  * one smooth Spine2 -> Hips band over the full cape height (smoothstep, z 0.45 -> 1.45), so a spine bend is
    #    spread over ~1 m of cloth instead of 10-25 cm (Death elongation 395 -> ~190 mm with this alone);
    #  * toward the hem a SYMMETRIC share of both thighs (LeftUpLeg = RightUpLeg for every vertex, ramping in below
    #    z 0.95). Equal left/right weights cannot tear the cape (every vertex at a given height gets the same blend,
    #    the sheet stays continuous), which is what the spec's "no leg weights" rule protects against; it makes the
    #    lower cape follow the average thigh, so the corpse's cape bends down toward the legs instead of standing off
    #    the pelvis. Every clip brings the thighs 17 deg in from the sculpt's splayed bind, so the share costs cape
    #    stretch in EVERY clip; it is kept at 0.4 and confined to the lower cape (ramp z 0.75 -> 0.25). Measured worst
    #    cape-edge elongation, share 0 / 0.4 over z 0.95-0.40 / 0.4 over z 0.75-0.25 / 0.8 over z 0.95-0.40:
    #    Idle 13 / 32 / 27 / 55 mm, Run 39 / 65 / 64 / 126 mm, Attack_Smite 44 / 74 / 48 / 103 mm,
    #    Death 193 / 237 / 198 / 270 mm (human.glb's own body: Idle 48, Run 66, Smite 48, Death 97 mm).
    #    The low ramp also bends the corpse's hem furthest down, onto the feet.
    c = is_cape & (z < 1.55)
    lo, hi = REG['cape_spine2_band']
    s = np.clip((z - lo) / (hi - lo), 0, 1)
    s = s * s * (3 - 2 * s)
    t0, t1 = REG['cape_thigh_ramp']
    th = np.clip((t0 - z) / (t0 - t1), 0, 1)
    th = REG['cape_thigh_share'] * th * th * (3 - 2 * th)
    put(c, {'Spine2': s * (1 - th), 'Hips': (1 - s) * (1 - th), 'LeftUpLeg': th / 2, 'RightUpLeg': th / 2}, 'cape')
    # Tabard front + rear flap (not cape, not arm).
    ty, tz0, tz1, tx = REG['tabard_front']
    ry0, ry1, rz0, rz1, rx = REG['rear_flap']
    tab = ((y > ty) & (z >= tz0) & (z <= tz1) & (ax < tx)) | \
          ((y >= ry0) & (y <= ry1) & (z >= rz0) & (z <= rz1) & (ax < rx))
    tab &= ~is_cape & ~is_arm
    hip = 0.5 + 0.5 * np.clip((z - 0.50) / 0.30, 0, 1)
    sL = np.clip(0.5 - x / 0.40, 0, 1)
    put(tab, {'Hips': hip, 'LeftUpLeg': (1 - hip) * sL, 'RightUpLeg': (1 - hip) * (1 - sL)}, 'tabard')
    # Side tassets (not cape; also not arm, so the hanging fists at z 0.86-0.94 keep their hand weights).
    a0, a1, ax0 = REG['tassets']
    tas = (z >= a0) & (z <= a1) & (ax >= ax0) & ~is_cape & ~is_arm & ~tab
    put(tas & (x < 0), {'LeftUpLeg': 0.6, 'Hips': 0.4}, 'tasset')
    put(tas & (x > 0), {'RightUpLeg': 0.6, 'Hips': 0.4}, 'tasset')
    # Pauldrons.
    p0, p1, px = REG['pauldron']
    pa = (z >= p0) & (z <= p1) & (ax >= px) & ~is_cape & ~hood & ~is_arm
    aw = 0.6 * np.clip((ax - 0.20) / 0.12, 0, 1)
    zf = REG['pauldron_arm_full_below_z']
    aw = np.maximum(aw, np.clip((zf - z) / (zf - p0), 0, 1))
    put(pa & (x < 0), {'LeftArm': aw, 'LeftShoulder': 1 - aw}, 'pauldron')
    put(pa & (x > 0), {'RightArm': aw, 'RightShoulder': 1 - aw}, 'pauldron')
    # Sabatons: Foot = 1, except the toe cap past the ball (ToeBase head) which goes to ToeBase with a 4 cm blend.
    # Deviation (documented): the spec's all-Foot sabaton keeps the toes rigid, so at toe-off in Walk the toe
    # cap dipped 3.7 cm below the human control's lowest point (ground gate). Hinging at the ball fixes that.
    for s, side in SIDES:
        sab = (z < REG['sabaton_z']) & ((x < 0) if s == 'L' else (x >= 0))
        ball = sk.H[B(side + 'ToeBase')]
        fd = ball - sk.H[B(side + 'Foot')]
        fd[2] = 0
        fd = fd / np.linalg.norm(fd)
        tw = np.clip(((co - ball) @ fd + 0.02) / 0.04, 0, 1)
        put(sab, {side + 'ToeBase': tw, side + 'Foot': 1 - tw}, 'sabaton')
    # No finger weights anywhere (spec: the sculpted fist / half-open hand stay rigid): fold any finger weight
    # that survived outside the hand region (nearest-surface copies near the cuffs) into the same-side Hand.
    folded = 0
    for side in ('Left', 'Right'):
        h = I[B(side + 'Hand')]
        fingers = [I[n] for n in sk.names if n.startswith(B(side + 'Hand')) and n != B(side + 'Hand')]
        fw = W[:, fingers].sum(1)
        folded += int((fw > 0).sum())
        W[:, h] += fw
        W[:, fingers] = 0
    counts['_finger_weights_folded_into_hand'] = folded
    # Diagnostics for the spec's open questions.
    counts['_helmet_verts_with_|x|>0.16'] = int(((z > 1.84) & (ax > 0.16)).sum())
    counts['_verts_|x|>=0.18_z1.67-1.84_now_pauldron'] = int(((z > 1.67) & (z <= 1.84) & (ax >= 0.18)).sum())
    return counts


def smooth_seams(W, co, ed, region, iterations, fix_plates=False):
    """Graph diffusion of weights over welded edges (added step, documented in the report).

    The region overrides of §3.1.3 are hard boxes on a fused shell, so their borders cut straight through
    welded surfaces (tabard side edge -> thigh plate, pauldron -> upper-arm plate, hood -> pauldron). With one
    edge between 80 % Hips and 100 % UpLeg, a Run knee lift opens a 35 cm gap. Averaging each free vertex with
    its welded neighbours for a few iterations spreads every seam over ~sqrt(n) edge rings (median edge 1.6 cm).
    Fixed (sources only, never changed): hand, helmet, cape, sabaton - so the fists stay rigid, the helmet stays
    on the head, the cape never receives leg weights and the toe hinge stays exact. Locked plates do take part by
    default: the tabard's side edges are welded along the thigh plates, so keeping plates fixed concentrated the
    seam (148 mm worst elongation in Run vs 37 mm); plate interiors stay at ~1.0 because all their neighbours do."""
    if iterations <= 0:
        return {'iterations': 0}
    weld, wco, wed = welded(co, ed)
    nw = len(wco)
    # welded-vertex weights = mean of the coincident vertices (they are identical in practice)
    cnt = np.bincount(weld, minlength=nw).astype(np.float32)
    Ww = np.zeros((nw, W.shape[1]), np.float32)
    np.add.at(Ww, weld, W)
    Ww /= cnt[:, None]
    fixed_names = ['hand', 'helmet', 'cape', 'sabaton'] + (['plate'] if fix_plates else [])
    fixed_v = np.isin(region, [RID[n] for n in fixed_names])
    fixed_w = np.zeros(nw, bool)
    np.logical_or.at(fixed_w, weld, fixed_v)
    deg = np.bincount(wed.ravel(), minlength=nw).astype(np.float32)
    free = ~fixed_w & (deg > 0)
    for _ in range(iterations):
        acc = np.zeros_like(Ww)
        np.add.at(acc, wed[:, 0], Ww[wed[:, 1]])
        np.add.at(acc, wed[:, 1], Ww[wed[:, 0]])
        new = (Ww + acc) / (1.0 + deg)[:, None]
        Ww[free] = new[free]
    changed = np.abs(Ww[weld] - W).max(1) > 0.02
    W[:] = Ww[weld]
    return {'iterations': iterations, 'fixed_regions': fixed_names,
            'verts_changed_gt_0.02': int(changed.sum())}


def finalize_weights(W):
    s = W.sum(1, keepdims=True)
    assert (s > 0).all(), f'{int((s <= 0).sum())} vertices without weights'
    W = W / s
    order = np.argsort(-W, 1)
    keep = np.zeros_like(W, bool)
    np.put_along_axis(keep, order[:, :4], True, 1)
    W = np.where(keep, W, 0)
    W = W / W.sum(1, keepdims=True)
    W[W < 0.01] = 0
    W = W / W.sum(1, keepdims=True)
    assert np.allclose(W.sum(1), 1, atol=1e-5)
    assert ((W > 0).sum(1) <= 4).all()
    return W


def write_groups(obj, W, sk):
    for g in list(obj.vertex_groups):
        obj.vertex_groups.remove(g)
    for j, name in enumerate(sk.names):
        vg = obj.vertex_groups.new(name=name)
        nz = np.nonzero(W[:, j] > 0)[0]
        for i in nz.tolist():
            vg.add([i], float(W[i, j]), 'REPLACE')


def bind(obj, rig):
    for m in list(obj.modifiers):
        obj.modifiers.remove(m)
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()


# ---------------------------------------------------------------------------------------------
# §4.1 export
# ---------------------------------------------------------------------------------------------
def export_glb(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    want = dict(filepath=str(path), export_format='GLB', export_animations=False, export_yup=True,
                export_lights=False, export_cameras=False, export_image_format='AUTO', export_tangents=False,
                export_influence_nb=4, export_def_bones=False, export_leaf_bone=False, export_apply=False,
                export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=False,
                use_selection=False, use_visible=False)
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kwargs = {k: v for k, v in want.items() if k in props}
    skipped = sorted(set(want) - set(kwargs))
    bpy.ops.export_scene.gltf(**kwargs)
    return skipped


def scene_inventory():
    return sorted((o.name, o.type, o.parent.name if o.parent else None) for o in bpy.data.objects)


def main():
    args = parse_args()
    if args.fallback_tpose:
        raise SystemExit('--fallback-tpose (spec §2.3 FALLBACK) is not implemented in v1; the primary method is used.')
    t0 = time.time()
    report = {'weights_mode': args.weights, 'blender': bpy.app.version_string}
    assert sha256(args.human) == HUMAN_SHA256, 'human.glb hash differs from the spec; refusing to run'
    assert sha256(args.source) == SOURCE_SHA256, 'fallen-paladin-static.glb hash differs from the spec; refusing to run'
    global LM_ACTIVE
    lm = LANDMARKS
    if args.landmarks:
        lm = json.loads(Path(args.landmarks).read_text())
        report['landmarks_file'] = args.landmarks
    report['landmarks'] = lm
    LM_ACTIVE = lm
    if args.cape_thigh is not None:
        REG['cape_thigh_share'] = args.cape_thigh

    rig, van = import_rig(args.human)
    rest_heads = {b.name: (rig.matrix_world @ b.head_local).copy() for b in rig.data.bones}
    report['human_legs'] = leg_lengths(rest_heads)
    report['base_pose'] = base_pose(rig)
    F, fit = fit_rig(rig, lm)
    report['fit'] = fit
    bake_vanguard(van)
    apply_pose_as_rest(rig)
    sk = Skel(rig)
    hero_heads = {n: Vector(v) for n, v in sk.H.items()}
    report['hero_legs'] = leg_lengths(hero_heads)
    hl = report['hero_legs']['Left']
    ul = report['human_legs']['Left']
    report['k_leg'] = round((hl['thigh'] + hl['shin']) / (ul['thigh'] + ul['shin']), 5)
    report['hero_rest_heads_m'] = {n.split(':')[1]: [round(float(c), 4) for c in v] for n, v in sk.H.items()}

    body, kinfo = import_knight(args.source)
    report['knight'] = kinfo
    sword, sinfo = separate_sword(body)
    report['sword_split'] = sinfo
    report['sword'] = setup_sword(sword)

    co, ed, tri = mesh_arrays(body)
    seg, sstats = segment_labels(co, ed)
    report['segments'] = sstats
    region = np.zeros(len(co), np.int64)
    if args.weights == 'copy':
        W, winfo = weights_copy(body, van, sk)
    elif args.weights == 'heat':
        W, winfo, fb = weights_heat(body, sk, co, seg, args.heat_voxel, args.heat_scale, args.heat_decimate)
        region[fb] = RID['fallback']
    else:
        W, winfo = distance_weights(sk, co, seg), {}
    empty = W.sum(1) <= 1e-6
    if empty.any():                       # e.g. a vertex the copy could not reach: fall back to §3.3
        W[empty] = distance_weights(sk, co, seg, mask=empty)[empty]
        region[empty] = RID['fallback']
    winfo['verts_without_source_weight'] = int(empty.sum())
    report['weights_source'] = winfo
    emptied, rinfo = restrict_to_segments(W, co, seg, sk)
    region[emptied] = RID['fallback']
    report['segment_restriction'] = rinfo
    locked, lcounts = lock_plates(W, co, seg, sk)
    region[locked] = RID['plate']
    report['plate_lock_counts'] = lcounts
    report['region_counts'] = region_overrides(W, co, seg, sk, region)
    report['region_boxes'] = REG
    report['smoothing'] = smooth_seams(W, co, ed, region, args.smooth, fix_plates=args.rigid_plates)
    W = finalize_weights(W)
    locked_final = locked & (region == RID['plate']) & (W.max(1) >= 0.999)
    write_groups(body, W, sk)
    report['weights_final'] = {
        'influences_hist': {int(k): int(v) for k, v in zip(*np.unique((W > 0).sum(1), return_counts=True))},
        'verts_per_bone': {sk.names[j].split(':')[1]: int((W[:, j] > 0).sum()) for j in range(len(sk.names)) if (W[:, j] > 0).any()},
        'locked_plate_verts': int(locked_final.sum())}
    bind(body, rig)

    if args.labels:
        gl = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)          # Blender Z-up -> glTF Y-up
        Path(args.labels).parent.mkdir(parents=True, exist_ok=True)
        Path(args.labels).write_text(json.dumps({
            'note': 'per Blender vertex of FallenPaladin_Body: glTF-frame rest position (m), segment label, region',
            'segment_names': SEG_NAMES, 'region_names': REGIONS,
            'positions': np.round(gl, 5).ravel().tolist(), 'segment': seg.tolist(), 'region': region.tolist(),
            'locked': locked_final.astype(int).tolist()}))

    for o in bpy.data.objects:                 # rest pose, no actions anywhere
        if o.animation_data:
            o.animation_data.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    update()

    if args.canary:
        # vanguard_Mesh keeps its import parenting (child of Character, data in armature space, cm):
        # only the Armature modifier is re-added. Its 49 groups are the human's own.
        mod = van.modifiers.new('Armature', 'ARMATURE')
        mod.object = rig
        canary_out = args.canary_out or str(Path(args.out).with_name(Path(args.out).stem + '-canary.glb'))
        report['canary_inventory'] = scene_inventory()
        report['export_skipped_options'] = export_glb(canary_out)
        report['canary_out'] = canary_out
    bpy.data.objects.remove(van, do_unlink=True)
    inv = scene_inventory()
    expected = sorted([('Character', 'ARMATURE', None), ('FallenPaladin_Body', 'MESH', 'Character'),
                       ('FP_Sword', 'EMPTY', None), ('FP_Sword_Mesh', 'MESH', 'FP_Sword'),
                       ('mixamorig:LeftHandPinky3', 'EMPTY', 'Character'), ('mixamorig:LeftHandThumb3', 'EMPTY', 'Character'),
                       ('mixamorig:RightHandPinky3', 'EMPTY', 'Character')])
    assert inv == expected, f'scene inventory mismatch: {inv}'
    report['inventory'] = inv
    report['export_skipped_options'] = export_glb(args.out)
    report['out'] = args.out
    report['out_bytes'] = Path(args.out).stat().st_size
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save_blend))
    report['seconds'] = round(time.time() - t0, 1)
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(json.dumps(report, indent=1))
    log('DONE', args.weights, args.out, report['out_bytes'], 'bytes', 'k_leg', report['k_leg'],
        'worst target mm', fit['worst_target_error_mm'], f"{report['seconds']}s")


if __name__ == '__main__':
    main()
