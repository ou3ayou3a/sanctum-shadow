"""Contact sheets for a hero candidate (BUILD-SPEC §3.1.5, §6.4 Blender renders). Workbench, textured.

Usage:
  Blender --background --python-exit-code 1 --python tools/blender/render_hero_sheets.py -- \
      --glb <fallen_paladin.glb> --out-dir <dir> [--canary <canary-bind.glb>] [--report <build-report.json>]
      [--sheets bind,weights,poses] [--res 520]

Writes:
  sheet-bind.png     bind pose (no animation): front + side textured with joint overlay (always drawn on top),
                     then front + side X-ray with joint overlay, the landmark targets (yellow) and, if --canary is
                     given, the posed+stretched vanguard_Mesh used as the weight source (cyan wire).
  sheet-weights.png  weight heat maps (front + back) for Spine2, Hips, L/R UpLeg, L/R Arm, L/R ForeArm.
  sheet-poses.png    key poses from the transplanted clips (3/4 front + side): Idle, Walk 25 %, Run 25 %,
                     Combat_Idle, Attack_Heavy peak, Attack_Smite impact, Cast, Death end.
Joint colours: green = centre, blue = Left (mixamorig Left, X<0), red = Right.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--glb', required=True)
ap.add_argument('--out-dir', required=True)
ap.add_argument('--canary')
ap.add_argument('--report')
ap.add_argument('--sheets', default='bind,weights,poses')
ap.add_argument('--res', type=int, default=520)
ap.add_argument('--label', default='')
ap.add_argument('--poses', default='Idle:0.5,Walk:0.25,Run:0.25,Combat_Idle:0.5,Attack_Heavy:0.45,Attack_Smite:0.55,Cast:0.6,Death:1.0',
                help='comma list of Clip:fraction')
ap.add_argument('--pose-views', default='front34,side', help='front34, side, back34')
ap.add_argument('--pose-file', default='sheet-poses.png')
ap.add_argument('--zoom', default='', help='x,y,z,ortho: camera target and ortho size for the pose sheet (close-ups)')
A = ap.parse_args(argv)
OUT = Path(A.out_dir)
OUT.mkdir(parents=True, exist_ok=True)
TMP = OUT / '_tiles'
TMP.mkdir(exist_ok=True)
SHEETS = set(A.sheets.split(','))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


objs = imp(A.glb)
rig = next(o for o in objs if o.type == 'ARMATURE')
body = next((o for o in objs if o.type == 'MESH' and o.name.startswith('FallenPaladin_Body')), None) or \
    next(o for o in objs if o.type == 'MESH' and o.vertex_groups)          # human control: vanguard_Mesh
swords = [o for o in objs if o.name.startswith('FP_Sword')]
for o in swords:
    o.hide_render = True
if rig.animation_data:
    for t in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(t)
    rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()
van = None
if A.canary and 'bind' in SHEETS:
    cobjs = imp(A.canary)
    for o in cobjs:
        if o.type == 'MESH' and o.name.startswith('vanguard_Mesh'):
            van = o
        elif o.type == 'ARMATURE':
            pass
        else:
            o.hide_render = True
    for o in cobjs:
        if o.type == 'MESH' and o is not van:
            o.hide_render = True

scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = A.res
scene.render.resolution_y = int(A.res * 1.45)
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
sh = scene.display.shading
sh.light = 'STUDIO'
sh.color_type = 'TEXTURE'
sh.background_type = 'VIEWPORT'
sh.background_color = (0.86, 0.87, 0.89)
sh.show_cavity = False
sh.show_object_outline = False
scene.display.render_aa = '8'

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def look(direction, target=(0, 0, 1.05), ortho=2.45, dist=6.0):
    d = Vector(direction).normalized()
    cam.location = Vector(target) - d * dist
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = ortho
    cam_data.clip_end = 50


def colmat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    return m


GREEN, BLUE, RED, YELLOW, CYAN = (0.1, 0.85, 0.25), (0.2, 0.45, 1.0), (1.0, 0.22, 0.15), (1.0, 0.85, 0.0), (0.0, 0.85, 0.9)
overlay = bpy.data.collections.new('overlay')
scene.collection.children.link(overlay)


def side_col(name):
    return BLUE if 'Left' in name else RED if 'Right' in name else GREEN


def add_obj(o, rgb):
    for c in o.users_collection:
        c.objects.unlink(o)
    overlay.objects.link(o)
    o.data.materials.clear()
    o.data.materials.append(colmat('m%.2f%.2f%.2f' % rgb, rgb))
    o.color = (*rgb, 1)
    o.show_in_front = True
    return o


def sphere(p, r, rgb):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=p, segments=14, ring_count=8)
    return add_obj(bpy.context.object, rgb)


def rod(a, b, r, rgb):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-5:
        return None
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=8)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return add_obj(o, rgb)


def caption(text, size=0.06):
    bpy.ops.object.text_add()
    t = bpy.context.object
    t.data.body = text
    t.data.size = size * cam_data.ortho_scale / 2.45
    for c in t.users_collection:
        c.objects.unlink(t)
    overlay.objects.link(t)
    t.data.materials.append(colmat('caption', (0.05, 0.05, 0.08)))
    t.color = (0.05, 0.05, 0.08, 1)
    t.show_in_front = True
    q = cam.rotation_euler.to_quaternion()
    right, up, fwd = q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), q @ Vector((0, 0, -1))
    half = cam_data.ortho_scale / 2                      # ortho_scale spans the larger (vertical) dimension
    rx, ry = scene.render.resolution_x, scene.render.resolution_y
    hv, hh = (half, half * rx / ry) if ry >= rx else (half * ry / rx, half)
    t.location = cam.location + fwd * 1.0 - right * (hh * 0.95) + up * (hv * 0.93)
    t.rotation_euler = cam.rotation_euler
    return t


def render(path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path


def tile(paths, cols, out):
    imgs = []
    for p in paths:
        im = bpy.data.images.load(str(p))
        w, h = im.size
        a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)
        imgs.append(a)
        bpy.data.images.remove(im)
    h, w = imgs[0].shape[:2]
    rows = math.ceil(len(imgs) / cols)
    sheet = np.ones((rows * h, cols * w, 4), np.float32)
    for k, a in enumerate(imgs):
        r, c = divmod(k, cols)
        y0 = (rows - 1 - r) * h          # Blender pixel rows start at the bottom
        sheet[y0:y0 + h, c * w:(c + 1) * w] = a
    im = bpy.data.images.new('sheet', cols * w, rows * h, alpha=True)
    im.pixels.foreach_set(sheet.ravel())
    im.filepath_raw = str(out)
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)
    print('SHEET', out, flush=True)


def clear_overlay():
    for o in list(overlay.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def joint_overlay(with_targets):
    MW = rig.matrix_world
    heads = {b.name: MW @ b.head_local for b in rig.data.bones}
    for b in rig.data.bones:
        n = b.name
        if any(f in n for f in ('Index', 'Middle', 'Ring', 'Pinky', 'Thumb')):
            sphere(heads[n], 0.006, side_col(n))
        else:
            sphere(heads[n], 0.016, side_col(n))
        if b.parent:
            rod(heads[b.parent.name], heads[n], 0.004, side_col(n))
    if with_targets and A.report:
        rep = json.loads(Path(A.report).read_text())
        lm = rep['landmarks']
        for k, v in lm.items():
            pts = v.values() if isinstance(v, dict) else [v]
            for p in pts:
                bpy.ops.mesh.primitive_cube_add(size=0.022, location=p)
                add_obj(bpy.context.object, YELLOW)


TAG = (A.label + ' ') if A.label else ''

# ------------------------------------------------------------------ bind sheet
if 'bind' in SHEETS:
    tiles = []
    if van:
        van.hide_render = True
    joint_overlay(with_targets=False)
    for view, d in (('front', (0, -1, 0)), ('side', (-1, 0, 0))):
        look(d)
        cap = caption(f'{TAG}bind pose {view} | joints on top')
        tiles.append(render(TMP / f'bind-{view}.png'))
        bpy.data.objects.remove(cap, do_unlink=True)
    clear_overlay()
    joint_overlay(with_targets=True)
    sh.show_xray = True
    sh.xray_alpha = 0.35
    if van:
        van.hide_render = False
        van.data.materials.clear()
        van.data.materials.append(colmat('van', CYAN))
        van.color = (*CYAN, 1)
    for view, d in (('front', (0, -1, 0)), ('side', (-1, 0, 0))):
        look(d)
        cap = caption(f'{TAG}{view} x-ray | yellow = targets' + (' | cyan = vanguard weight source' if van else ''))
        tiles.append(render(TMP / f'bind-{view}-xray.png'))
        bpy.data.objects.remove(cap, do_unlink=True)
    sh.show_xray = False
    if van:
        van.hide_render = True
    clear_overlay()
    tile(tiles, 4, OUT / 'sheet-bind.png')

# ------------------------------------------------------------------ weights sheet
if 'weights' in SHEETS:
    me = body.data
    attr = me.color_attributes.new('wt', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = attr
    sh.color_type = 'VERTEX'
    sh.light = 'STUDIO'
    gi = {g.name: g.index for g in body.vertex_groups}
    N = len(me.vertices)

    def heat(w):
        # blue (0) -> green (.5) -> red (1); zero weight stays dark grey
        r = np.clip(2 * w - 1, 0, 1)
        g = np.clip(1 - np.abs(2 * w - 1), 0, 1)
        b = np.clip(1 - 2 * w, 0, 1)
        c = np.stack([r, g, b, np.ones_like(w)], 1)
        c[w <= 0.0] = (0.12, 0.12, 0.14, 1)
        return c

    tiles = []
    res0 = scene.render.resolution_x
    scene.render.resolution_x = int(A.res * 0.62)
    scene.render.resolution_y = int(A.res * 0.62 * 1.45)
    for bone in ('Spine2', 'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'):
        w = np.zeros(N, np.float32)
        gidx = gi.get('mixamorig:' + bone)
        if gidx is not None:
            for v in me.vertices:
                for g in v.groups:
                    if g.group == gidx:
                        w[v.index] = g.weight
        attr.data.foreach_set('color', heat(w).ravel())
        me.update()
        for view, d in (('front', (0, -1, 0)), ('back', (0, 1, 0))):
            look(d)
            cap = caption(f'{TAG}{bone} {view}', size=0.09)
            tiles.append(render(TMP / f'w-{bone}-{view}.png'))
            bpy.data.objects.remove(cap, do_unlink=True)
    tile(tiles, 8, OUT / 'sheet-weights.png')
    scene.render.resolution_x = res0
    scene.render.resolution_y = int(res0 * 1.45)
    sh.color_type = 'TEXTURE'
    me.color_attributes.remove(attr)

# ------------------------------------------------------------------ poses sheet
if 'poses' in SHEETS:
    ad = rig.animation_data or rig.animation_data_create()

    def act(name):
        for a in bpy.data.actions:
            if a.name == name or a.name.split('_Character')[0] == name or a.name.startswith(name + '_'):
                if a.name.startswith(name):
                    return a
        return None

    poses = [(p.split(':')[0], float(p.split(':')[1])) for p in A.poses.split(',')]
    VIEWS = {'front34': ('3/4 front', (-0.5, -0.866, -0.08)), 'side': ('side', (-1, 0, 0)), 'back34': ('3/4 back', (0.5, 0.866, -0.08))}
    tiles = []
    for view, d in [VIEWS[v] for v in A.pose_views.split(',')]:
        for clip, frac in poses:
            a = next((x for x in bpy.data.actions if x.name == clip), None) or act(clip)
            if a is None:
                print('MISSING ACTION', clip, [x.name for x in bpy.data.actions][:30])
                continue
            ad.action = a
            if hasattr(ad, 'action_slot') and ad.action_slot is None and len(a.slots):
                ad.action_slot = a.slots[0]
            f0, f1 = a.frame_range
            scene.frame_set(int(round(f0 + frac * (f1 - f0))))
            bpy.context.view_layer.update()
            if A.zoom:
                zx, zy, zz, zo = (float(v) for v in A.zoom.split(','))
                look(d, target=(zx, zy, zz), ortho=zo)
            else:
                look(d, target=(0, 0, 1.0), ortho=2.6)
            cap = caption(f'{TAG}{clip} {int(frac * 100)}% {view}', size=0.07)
            tiles.append(render(TMP / f'p-{clip}-{int(frac * 1000)}-{view.replace("/", "")}.png'.replace(' ', '')))
            bpy.data.objects.remove(cap, do_unlink=True)
    ad.action = None
    tile(tiles, len(poses), OUT / A.pose_file)
print('RENDER_DONE', flush=True)
