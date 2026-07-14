"""Build Sanctum & Shadow's deterministic, browser-ready Blender asset library.

Run with:
  Blender --background --factory-startup --python tools/blender/build_visual_library.py

The script intentionally uses only Blender primitives and the project's CC0
Quaternius character source. Every output is reproducible and safe to commit.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "site/world3d/assets/production"
SOURCE_LIBRARY = ROOT / "tools/blender/sanctum-visual-library.blend"
CHARACTER_SOURCE = ROOT / "site/prototype/assets/elf-ranger.glb"

OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / "environment").mkdir(exist_ok=True)
(OUTPUT / "interiors").mkdir(exist_ok=True)
(OUTPUT / "equipment").mkdir(exist_ok=True)
(OUTPUT / "characters").mkdir(exist_ok=True)

MANIFEST: dict[str, dict] = {}
MATERIALS: dict[str, bpy.types.Material] = {}


PALETTE = {
    # Blender exports linear values.  These deliberately low values become
    # weathered brown-grey masonry in Three's sRGB display instead of chalky
    # white fortifications under the city's strong daylight.
    "stone": (0.085, 0.065, 0.045, 1),
    "stone_light": (0.16, 0.12, 0.075, 1),
    "stone_dark": (0.032, 0.025, 0.019, 1),
    "plaster": (0.46, 0.38, 0.27, 1),
    "plaster_warm": (0.55, 0.39, 0.22, 1),
    "timber": (0.20, 0.12, 0.065, 1),
    "timber_light": (0.36, 0.22, 0.11, 1),
    "roof": (0.18, 0.095, 0.065, 1),
    "roof_blue": (0.12, 0.18, 0.21, 1),
    "metal": (0.31, 0.34, 0.34, 1),
    "metal_gold": (0.54, 0.38, 0.12, 1),
    "glass": (0.17, 0.48, 0.58, 0.78),
    "cloth": (0.36, 0.055, 0.045, 1),
    "leaf": (0.16, 0.31, 0.18, 1),
    "leaf_light": (0.31, 0.47, 0.22, 1),
    "bark": (0.22, 0.14, 0.08, 1),
    "earth": (0.22, 0.17, 0.11, 1),
    "fire": (1.0, 0.28, 0.035, 1),
    "shadow": (0.012, 0.016, 0.019, 1),
}


def set_shader_input(shader, names, value):
    """Set a Principled input across Blender 4.x/5.x socket renames."""
    for name in names:
        socket = shader.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name: str, color, *, metallic=0.0, roughness=0.72, emission=None):
    key = f"{name}:{color}:{metallic}:{roughness}:{emission}"
    if key in MATERIALS:
        return MATERIALS[key]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    set_shader_input(bsdf, ("Base Color",), color)
    set_shader_input(bsdf, ("Metallic", "Metallic IOR Level"), metallic)
    set_shader_input(bsdf, ("Roughness",), roughness)
    if color[3] < 1:
        mat.surface_render_method = "DITHERED"
        set_shader_input(bsdf, ("Alpha",), color[3])
    if emission:
        set_shader_input(bsdf, ("Emission Color", "Emission"), emission)
        set_shader_input(bsdf, ("Emission Strength",), 2.5)
    MATERIALS[key] = mat
    return mat


def mat(name: str, **kwargs):
    return material(name, PALETTE[name], **kwargs)


def finish(obj, name: str, material_value=None, bevel=0.0, parent=None):
    obj.name = name
    if material_value and obj.type == "MESH":
        obj.data.materials.append(material_value)
    if bevel and obj.type == "MESH":
        modifier = obj.modifiers.new("softened masonry edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    if parent:
        obj.parent = parent
    obj["ss_visual"] = True
    return obj


def box(name, size, location, material_value, *, bevel=0.04, rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material_value, bevel, parent)


def cylinder(name, radius, depth, location, material_value, *, vertices=12, rotation=(0, 0, 0), parent=None, bevel=0.035):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.object, name, material_value, bevel, parent)


def cone(name, radius1, radius2, depth, location, material_value, *, vertices=12, rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.object, name, material_value, 0.025, parent)


def sphere(name, radius, location, material_value, *, scale=(1, 1, 1), parent=None, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, material_value, 0, parent)


def root_object(name: str):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root["ss_asset"] = name
    return root


def gable_roof(parent, width, depth, eave_z, height, material_value, name="Roof"):
    verts = [
        (-width / 2, -depth / 2, eave_z), (width / 2, -depth / 2, eave_z), (0, -depth / 2, eave_z + height),
        (-width / 2, depth / 2, eave_z), (width / 2, depth / 2, eave_z), (0, depth / 2, eave_z + height),
    ]
    faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material_value)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    finish(obj, name, None, 0.06)
    return obj


def window(parent, x, y, z, *, width=0.75, height=1.05, front=True):
    glass = mat("glass", roughness=0.2)
    frame = mat("timber", roughness=0.86)
    depth = 0.10
    if front:
        box("WindowGlass", (width, depth, height), (x, y, z), glass, bevel=0.01, parent=parent)
        box("WindowFrame", (width + 0.16, depth + 0.05, 0.10), (x, y - 0.015, z + height / 2), frame, bevel=0.015, parent=parent)
        box("WindowFrame", (width + 0.16, depth + 0.05, 0.10), (x, y - 0.015, z - height / 2), frame, bevel=0.015, parent=parent)
        for dx in (-width / 2, 0, width / 2):
            box("WindowMullion", (0.08, depth + 0.05, height + 0.12), (x + dx, y - 0.015, z), frame, bevel=0.012, parent=parent)
        for side in (-1, 1):
            shutter = box("WoodenShutter", (width * 0.42, 0.10, height + 0.08), (x + side * (width * 0.76), y + 0.015, z), mat("timber_light"), bevel=0.025, parent=parent)
            for dz in (-height * .28, height * .28):
                box("ShutterBrace", (width * .34, .035, .055), (shutter.location.x, y - .05, z + dz), frame, bevel=.008, parent=parent)
    else:
        box("WindowGlass", (depth, width, height), (x, y, z), glass, bevel=0.01, parent=parent)


def door(parent, x, y, z=1.15, *, width=1.2, height=2.25, name="INTERACT_Door"):
    timber = mat("timber_light", roughness=0.86)
    metal = mat("metal", metallic=0.7, roughness=0.34)
    panel = box(name, (width, 0.16, height), (x, y, z), timber, bevel=0.045, parent=parent)
    panel["ss_interaction"] = "door"
    for dz in (-height * 0.27, height * 0.27):
        box("DoorBrace", (width * 0.88, 0.055, 0.09), (x, y - 0.105, z + dz), metal, bevel=0.01, parent=parent)
    sphere("DoorHandle", 0.07, (x + width * 0.32, y - 0.15, z), metal, parent=parent, subdivisions=1)
    return panel


def timber_frame(parent, width, depth, wall_height, base_z=0):
    timber = mat("timber", roughness=0.88)
    for x in (-width / 2 + 0.16, 0, width / 2 - 0.16):
        box("TimberPost", (0.18, 0.20, wall_height), (x, -depth / 2 - 0.05, base_z + wall_height / 2), timber, bevel=0.018, parent=parent)
        box("TimberPost", (0.18, 0.20, wall_height), (x, depth / 2 + 0.05, base_z + wall_height / 2), timber, bevel=0.018, parent=parent)
    for z in (0.18, wall_height * 0.52, wall_height - 0.12):
        box("TimberBeam", (width, 0.20, 0.18), (0, -depth / 2 - 0.05, base_z + z), timber, bevel=0.018, parent=parent)
        box("TimberBeam", (width, 0.20, 0.18), (0, depth / 2 + 0.05, base_z + z), timber, bevel=0.018, parent=parent)
    diagonal_length=math.hypot(width*.42,wall_height*.68)
    angle=math.atan2(wall_height*.68,width*.42)
    for side in (-1,1):
        for face_y in (-depth/2-.065,depth/2+.065):
            box("DiagonalBrace",(diagonal_length,.15,.13),(side*width*.27,face_y,base_z+wall_height*.46),timber,bevel=.015,rotation=(0,-side*angle,0),parent=parent)


def roof_courses(parent,width,depth,eave_z,height,material_value):
    slope=math.atan2(height,width/2)
    slope_length=math.hypot(width/2,height)
    for side in (-1,1):
        for row in range(7):
            t=(row+.25)/7
            x=side*(width/2)*(1-t)
            z=eave_z+height*t+.035
            box("RoofTileCourse",(.10,depth+.54,slope_length/7*.8),(x,0,z),material_value,bevel=.012,rotation=(0,side*slope,0),parent=parent)


def make_house(name="House_A", *, width=6.5, depth=5.3, stories=2, roof_color="roof", shop=False):
    root = root_object(name)
    stone = mat("stone", roughness=0.9)
    plaster = mat("plaster_warm" if shop else "plaster", roughness=0.82)
    ground_height=2.45
    upper_height=2.35 * max(0, stories - 1)
    ground_width,ground_depth=width*.90,depth*.91
    upper_width,upper_depth=width+.42,depth+.34
    wall_height=.55+ground_height+upper_height
    box("StoneFoundation", (width + 0.35, depth + 0.35, 0.68), (0, 0, 0.34), stone, bevel=0.10, parent=root)
    box("GroundFloor", (ground_width, ground_depth, ground_height), (0, 0, .58 + ground_height/2), plaster, bevel=0.06, parent=root)
    timber_frame(root,ground_width,ground_depth,ground_height,.58)
    if stories>1:
        for x in (-upper_width*.38,-upper_width*.12,upper_width*.12,upper_width*.38):
            box("OverhangCorbel",(.16,.72,.24),(x,-ground_depth/2-.18,3.0),mat("timber"),bevel=.018,rotation=(math.radians(10),0,0),parent=root)
        box("OverhangingUpperFloor",(upper_width,upper_depth,upper_height),(0,0,.58+ground_height+upper_height/2),plaster,bevel=.055,parent=root)
        timber_frame(root,upper_width,upper_depth,upper_height,.58+ground_height)
    roof_width=(upper_width if stories>1 else ground_width)+.9
    roof_depth=(upper_depth if stories>1 else ground_depth)+1.05
    roof_eave=wall_height
    roof_height=2.65 if stories>1 else 2.25
    roof_material=mat(roof_color,roughness=.91)
    gable_roof(root,roof_width,roof_depth,roof_eave,roof_height,roof_material)
    door(root, 0, -ground_depth / 2 - 0.10, 1.48)
    box("DoorStoneLintel",(1.55,.28,.28),(0,-ground_depth/2-.03,2.68),stone,bevel=.06,parent=root)
    for floor in range(stories):
        z = 1.65 + floor * 2.35
        face_depth=ground_depth if floor==0 else upper_depth
        face_width=ground_width if floor==0 else upper_width
        for x in (-width * 0.29, width * 0.29):
            window(root, x, -face_depth / 2 - 0.10, z,width=.64,height=.9)
        if floor==stories-1:
            for side in (-1,1):window(root,side*face_width/2+.06,0,z,width=.68,height=.92,front=False)
    box("Chimney", (0.72, 0.72, 2.7), (width * 0.29, depth * 0.15, wall_height + 1.3), stone, bevel=0.08, parent=root)
    if shop:
        box("ShopAwning", (3.3, 1.2, 0.16), (0, -depth / 2 - 0.68, 2.55), mat("cloth", roughness=0.74), bevel=0.025, rotation=(math.radians(10), 0, 0), parent=root)
        box("ShopSign", (1.25, 0.13, 0.72), (width * 0.32, -depth / 2 - 0.22, 2.8), mat("timber_light"), bevel=0.08, parent=root)
    return root


def make_tavern():
    root = make_house("Tavern", width=9.2, depth=7.0, stories=2, roof_color="roof_blue")
    box("TavernPorch", (7.2, 2.0, 0.28), (0, -4.35, 0.26), mat("timber_light"), bevel=0.06, parent=root)
    for x in (-3.2, 3.2):
        cylinder("PorchPost", 0.16, 2.8, (x, -4.35, 1.65), mat("timber"), vertices=10, parent=root)
    box("TavernCanopy", (7.2, 2.1, 0.18), (0, -4.35, 3.05), mat("roof"), bevel=0.04, parent=root)
    sign = box("TavernSign", (1.65, 0.16, 1.05), (3.55, -3.75, 3.75), mat("timber_light"), bevel=0.1, parent=root)
    sign["ss_landmark"] = "tavern"
    return root


def make_narrow_house():
    root = make_house("Narrow_House", width=4.35, depth=5.4, stories=3, roof_color="roof_blue")
    box("HangingSign", (0.82, 0.12, 0.62), (1.62, -2.88, 3.15), mat("timber_light"), bevel=0.07, parent=root)
    box("SignBracket", (0.08, 0.72, 0.08), (1.62, -2.58, 3.55), mat("metal", metallic=.66), bevel=.012, parent=root)
    return root


def make_row_house():
    root = make_house("Row_House", width=8.8, depth=4.65, stories=2, roof_color="roof")
    timber = mat("timber", roughness=.9)
    for x in (-2.75, 2.75):
        box("PartyWallPier", (.32, 5.0, 5.15), (x, 0, 2.58), timber, bevel=.025, parent=root)
    door(root, -2.15, -2.23, 1.45, width=1.0, name="INTERACT_RowDoorA")
    door(root, 2.15, -2.23, 1.45, width=1.0, name="INTERACT_RowDoorB")
    return root


def make_workshop():
    root = make_house("Craft_Workshop", width=8.2, depth=6.2, stories=1, shop=True)
    timber = mat("timber", roughness=.9)
    stone = mat("stone_dark", roughness=.95)
    box("WorkshopLeanTo", (4.1, 2.7, .18), (-1.6, -4.0, 2.65), mat("roof"), bevel=.04, rotation=(math.radians(11), 0, 0), parent=root)
    for x in (-3.2, 0):
        cylinder("WorkshopPost", .14, 2.5, (x, -4.0, 1.35), timber, vertices=8, parent=root)
    box("Forge", (2.0, 1.35, 1.15), (2.45, -3.7, .58), stone, bevel=.09, parent=root)
    box("ForgeChimney", (.85, .85, 4.0), (2.45, -2.25, 3.5), stone, bevel=.08, parent=root)
    return root


def make_warehouse():
    root = root_object("Merchant_Warehouse")
    stone = mat("stone", roughness=.94)
    timber = mat("timber", roughness=.9)
    plaster = mat("plaster", roughness=.88)
    box("WarehouseFoundation", (10.5, 7.2, .72), (0, 0, .36), stone, bevel=.1, parent=root)
    box("WarehouseBody", (9.8, 6.5, 5.8), (0, 0, 3.55), plaster, bevel=.07, parent=root)
    timber_frame(root, 9.8, 6.5, 5.8, .65)
    gable_roof(root, 10.8, 7.5, 6.45, 3.1, mat("roof"), "WarehouseRoof")
    for x in (-1.0, 1.0):
        door(root, x, -3.34, 1.75, width=1.75, height=3.35, name=f"INTERACT_WarehouseDoor_{x}")
    box("HoistBeam", (.25, 2.1, .28), (0, -4.0, 6.0), timber, bevel=.03, parent=root)
    cylinder("HoistWheel", .42, .12, (0, -4.95, 5.4), timber, vertices=12, rotation=(math.radians(90), 0, 0), parent=root)
    return root


def make_guildhall():
    root = make_house("Guild_Hall", width=10.4, depth=7.0, stories=2, roof_color="roof_blue")
    stone = mat("stone_light", roughness=.92)
    timber = mat("timber_light", roughness=.88)
    box("GuildSteps", (4.7, 2.0, .42), (0, -4.25, .21), stone, bevel=.08, parent=root)
    for x in (-1.75, 1.75):
        cylinder("GuildColumn", .25, 3.4, (x, -4.15, 1.9), stone, vertices=10, parent=root)
    box("GuildPortico", (4.8, 2.15, .32), (0, -4.15, 3.55), timber, bevel=.06, parent=root)
    box("GuildCrest", (1.8, .16, 1.45), (0, -3.68, 5.05), mat("metal_gold", metallic=.62), bevel=.12, parent=root)
    return root


def make_chapel():
    root = root_object("Street_Chapel")
    stone = mat("stone", roughness=.94)
    light = mat("stone_light", roughness=.91)
    box("ChapelFoundation", (7.4, 7.0, .55), (0, 0, .275), stone, bevel=.08, parent=root)
    box("ChapelNave", (6.4, 5.9, 4.8), (0, .3, 2.85), light, bevel=.09, parent=root)
    gable_roof(root, 7.0, 6.5, 5.25, 2.65, mat("roof_blue"), "ChapelRoof")
    door(root, 0, -2.72, 1.5, width=1.45, height=2.85, name="INTERACT_ChapelDoor")
    for x in (-2.15, 2.15):
        box("LancetWindow", (.48, .10, 1.4), (x, -2.68, 3.45), mat("glass", emission=(.16,.32,.42,1)), bevel=.14, parent=root)
    cone("ChapelBellSpire", .78, 0, 3.5, (0, .8, 8.1), mat("metal_gold", metallic=.62), vertices=8, parent=root)
    return root


def make_noble_house():
    root = make_house("Noble_Estate", width=11.2, depth=8.0, stories=3, roof_color="roof_blue")
    stone = mat("stone_light", roughness=.9)
    timber = mat("timber_light", roughness=.86)
    box("NobleBalcony", (5.2, 1.45, .22), (0, -4.65, 4.25), stone, bevel=.06, parent=root)
    for x in (-2.25, 2.25):
        cylinder("BalconySupport", .18, 3.2, (x, -4.62, 2.55), stone, vertices=10, parent=root)
    box("BalconyRail", (5.2, .12, .72), (0, -5.25, 4.65), timber, bevel=.025, parent=root)
    for x in (-4.65, 4.65):
        cylinder("CornerOriel", .72, 6.4, (x, -3.35, 4.0), stone, vertices=10, parent=root)
        cone("OrielRoof", 1.05, 0, 1.9, (x, -3.35, 8.05), mat("roof_blue"), vertices=10, parent=root)
    return root


def make_granary():
    root = root_object("Raised_Granary")
    stone = mat("stone", roughness=.95)
    timber = mat("timber_light", roughness=.93)
    for x in (-3.2, 0, 3.2):
        for y in (-2.0, 2.0):
            cylinder("GranaryPier", .32, 1.25, (x, y, .625), stone, vertices=10, parent=root)
    box("GranaryBody", (8.4, 5.7, 4.4), (0, 0, 3.25), timber, bevel=.08, parent=root)
    gable_roof(root, 9.2, 6.5, 5.45, 2.7, mat("roof"), "GranaryRoof")
    door(root, 0, -2.94, 3.05, width=1.65, height=2.6, name="INTERACT_GranaryDoor")
    box("GranaryRamp", (2.0, 3.2, .22), (0, -4.35, 1.1), timber, bevel=.05, rotation=(math.radians(18), 0, 0), parent=root)
    return root


def battlements(parent, width, depth, z, material_value):
    for x in [(-width / 2 + 0.35) + i * 0.75 for i in range(max(2, int(width / 0.75)))]:
        for y in (-depth / 2, depth / 2):
            box("Crenellation", (0.42, 0.55, 0.65), (x, y, z), material_value, bevel=0.035, parent=parent)
    for y in [(-depth / 2 + 0.35) + i * 0.75 for i in range(max(2, int(depth / 0.75)))]:
        for x in (-width / 2, width / 2):
            box("Crenellation", (0.55, 0.42, 0.65), (x, y, z), material_value, bevel=0.035, parent=parent)


def make_tower(name="Castle_Tower", radius=2.4, height=8.2):
    root = root_object(name)
    stone = mat("stone", roughness=0.92)
    dark = mat("stone_dark", roughness=0.93)
    cylinder("TowerBody", radius, height, (0, 0, height / 2), stone, vertices=12, parent=root, bevel=0.08)
    cylinder("TowerBand", radius + 0.16, 0.36, (0, 0, 1.2), dark, vertices=16, parent=root)
    cylinder("TowerBand", radius + 0.16, 0.36, (0, 0, height - 0.8), dark, vertices=16, parent=root)
    for angle in range(0, 360, 45):
        a = math.radians(angle)
        box("TowerMerlon", (0.6, 0.6, 0.85), ((radius + 0.05) * math.cos(a), (radius + 0.05) * math.sin(a), height + 0.4), stone, bevel=0.045, rotation=(0, 0, a), parent=root)
    masonry=(stone,dark)
    for course,z in enumerate((.55,1.35,2.25,3.2,4.25,5.35,6.5,7.5)):
        for index,angle in enumerate(range((course%2)*22,360,45)):
            a=math.radians(angle)
            block_mat=masonry[(course+index)%len(masonry)]
            box("MasonryBlock",(.68,.09,.30),(radius*math.cos(a),radius*math.sin(a),min(z,height-.4)),block_mat,bevel=.028,rotation=(0,0,a+math.pi/2),parent=root)
    door(root, 0, -radius - 0.08, 1.25, width=1.05, height=2.25)
    for angle in (0, 90, 180, 270):
        a = math.radians(angle)
        box("ArrowSlit", (0.18 if angle % 180 == 0 else 0.08, 0.08 if angle % 180 == 0 else 0.18, 0.92), (radius * 0.99 * math.sin(a), radius * 0.99 * math.cos(a), 4.8), mat("shadow"), bevel=0.01, parent=root)
    return root


def make_gatehouse():
    root = root_object("City_Gatehouse")
    stone = mat("stone", roughness=0.92)
    for side in (-1, 1):
        tower = make_tower(f"GateTower_{side}", radius=2.35, height=8.5)
        tower.parent = root
        tower.location.x = side * 4.15
    box("GateBridge", (4.2, 2.4, 3.3), (0, 0, 6.2), stone, bevel=0.1, parent=root)
    box("GateLintel", (4.2, 1.2, 1.3), (0, 0, 4.2), stone, bevel=0.08, parent=root)
    for index,angle in enumerate(range(15,166,15)):
        a=math.radians(angle);x=2.15*math.cos(a);z=3.15+2.15*math.sin(a)
        box("ArchVoussoir",(.72,.52,.42),(x,-1.25,z),mat("stone_light" if index%2 else "stone"),bevel=.045,rotation=(0,-a+math.pi/2,0),parent=root)
    battlements(root, 4.2, 2.4, 8.15, stone)
    # Vaelthar is explorable, so its gate is visibly raised rather than presenting
    # a closed barrier that the navigation system lets the player walk through.
    for x in [i * 0.34 for i in range(-5, 6)]:
        box("RaisedPortcullis", (0.09, 0.13, 4.3), (x, -0.82, 6.3), mat("metal", metallic=0.72, roughness=0.38), bevel=0.01, parent=root)
    return root


def make_wall():
    root = root_object("Castle_Wall")
    stone = mat("stone", roughness=0.94)
    box("WallBody", (9.5, 1.25, 4.8), (0, 0, 2.4), stone, bevel=0.1, parent=root)
    battlements(root, 9.5, 1.25, 5.15, stone)
    for x in (-3.3, 0, 3.3):
        box("WallButtress", (0.72, 2.0, 3.4), (x, 0, 1.7), mat("stone_dark"), bevel=0.07, parent=root)
    return root


def make_castle_keep():
    root = root_object("Castle_Keep")
    stone = mat("stone", roughness=0.93)
    dark = mat("stone_dark", roughness=0.94)
    box("KeepBody", (12, 10, 10.5), (0, 0, 5.25), stone, bevel=0.12, parent=root)
    box("KeepUpper", (8.2, 7.2, 4.0), (0, 0, 12.5), dark, bevel=0.10, parent=root)
    battlements(root, 12, 10, 10.85, stone)
    battlements(root, 8.2, 7.2, 14.8, dark)
    door(root, 0, -5.1, 1.6, width=1.8, height=3.1, name="INTERACT_KeepDoor")
    for z in (4.2, 7.3, 12.5):
        for x in (-3.7, 0, 3.7):
            box("ArrowSlit", (0.23, 0.10, 1.15), (x, -5.03, z), mat("shadow"), bevel=0.015, parent=root)
    for side in (-1, 1):
        banner = box("CovenantBanner", (1.35, 0.08, 4.0), (side * 4.7, -5.12, 7.2), mat("cloth"), bevel=0.02, parent=root)
        banner["ss_animated"] = "wind"
    return root


def make_temple():
    root = root_object("Temple")
    stone = mat("stone_light", roughness=0.9)
    dark = mat("stone", roughness=0.93)
    box("TempleBase", (11.5, 9.0, 0.65), (0, 0, 0.325), dark, bevel=0.09, parent=root)
    box("TempleNave", (8.2, 7.2, 5.8), (0, 0.7, 3.55), stone, bevel=0.1, parent=root)
    gable_roof(root, 9.0, 7.8, 6.45, 2.6, mat("roof_blue"), "TempleRoof")
    for x in (-4.5, -2.7, 2.7, 4.5):
        cylinder("TempleColumn", 0.34, 5.2, (x, -4.0, 2.9), stone, vertices=12, parent=root)
    box("TemplePortico", (10, 2.0, 0.55), (0, -4.0, 5.55), dark, bevel=0.08, parent=root)
    door(root, 0, -3.02, 1.6, width=1.7, height=3.15, name="INTERACT_TempleDoor")
    glass = mat("glass", metallic=0.12, roughness=0.25, emission=(0.18, 0.30, 0.42, 1))
    for side in (-1, 1):
        for y in (-1.8, 0.4, 2.6):
            box("TempleStainedWindow", (0.10, 0.78, 1.65), (side * 4.13, y, 3.65), glass, bevel=0.10, parent=root)
            box("TempleButtress", (0.48, 0.75, 3.6), (side * 4.34, y, 1.8), dark, bevel=0.07, parent=root)
    for x in (-2.2, 0, 2.2):
        box("TempleRearWindow", (0.82, 0.10, 1.55), (x, 4.31, 3.75), glass, bevel=0.10, parent=root)
    cone("TempleSpire", 1.1, 0, 4.5, (0, 1.0, 10.5), mat("metal_gold", metallic=0.55, roughness=0.32), vertices=8, parent=root)
    return root


def make_bridge():
    root = root_object("Stone_Bridge")
    stone = mat("stone", roughness=0.95)
    for i in range(-5, 6):
        z = i * 0.82
        rise = 0.75 * (1 - abs(i) / 6)
        box("BridgeDeck", (4.8, 0.92, 0.38), (0, z, 1.25 + rise), stone, bevel=0.07, parent=root)
    for x in (-2.15, 2.15):
        for i in range(-5, 6):
            z = i * 0.82
            rise = 0.75 * (1 - abs(i) / 6)
            box("BridgeParapet", (0.28, 0.82, 0.82), (x, z, 1.83 + rise), stone, bevel=0.05, parent=root)
    for x in (-1.35, 1.35):
        cylinder("BridgePier", 0.55, 2.2, (x, 0, 0.1), stone, vertices=10, parent=root)
    return root


def make_crypt():
    root = root_object("Crypt")
    stone = mat("stone", roughness=0.95)
    dark = mat("stone_dark", roughness=0.96)
    box("CryptBase", (7.0, 6.0, 0.55), (0, 0, 0.275), dark, bevel=0.08, parent=root)
    box("CryptBody", (6.2, 5.2, 3.7), (0, 0.3, 2.1), stone, bevel=0.12, parent=root)
    gable_roof(root, 6.8, 5.8, 3.95, 1.5, dark, "CryptRoof")
    door(root, 0, -2.38, 1.35, width=1.25, height=2.55, name="INTERACT_CryptDoor")
    for x in (-2.0, 2.0):
        cone("Gargoyle", 0.38, 0.08, 1.0, (x, -2.72, 4.4), dark, vertices=6, rotation=(math.radians(90), 0, 0), parent=root)
    return root


def make_ruin():
    root = root_object("Ancient_Ruin")
    stone = mat("stone", roughness=0.97)
    box("BrokenWall", (7.5, 0.75, 3.4), (0, 0, 1.7), stone, bevel=0.13, parent=root)
    box("BrokenWall", (0.8, 5.8, 4.6), (-3.4, 2.2, 2.3), stone, bevel=0.13, parent=root)
    for x, y, height, tilt in ((-2.2, -1.1, 3.8, 0.0), (1.0, 0.7, 2.4, 0.1), (3.0, 1.8, 4.5, -0.12)):
        cylinder("BrokenColumn", 0.42, height, (x, y, height / 2), stone, vertices=10, rotation=(tilt, tilt * 0.6, 0), parent=root)
    for x, y in ((-1.2, 2.2), (2.0, -1.6), (3.1, -0.5)):
        sphere("Rubble", 0.65, (x, y, 0.35), stone, scale=(1.3, 0.8, 0.6), subdivisions=1, parent=root)
    return root


def make_cave():
    root = root_object("Cave_Entrance")
    rock = mat("stone_dark", roughness=0.98)
    shadow = mat("shadow", roughness=1)
    box("CaveVoid", (4.8, 0.45, 4.6), (0, 1.25, 2.3), shadow, bevel=1.0, parent=root)
    for index, angle in enumerate([160, 132, 105, 75, 48, 20]):
        a = math.radians(angle)
        x = math.cos(a) * 3.0
        z = 2.0 + math.sin(a) * 2.65
        sphere(f"CaveRock_{index}", 1.25, (x, 0.35, z), rock, scale=(1.1, 1.45, 1.25), subdivisions=1, parent=root)
    for x in (-3.5, 3.5):
        sphere("CaveBoulder", 1.5, (x, 0.2, 1.0), rock, scale=(1.4, 1.15, 0.9), subdivisions=1, parent=root)
    return root


def make_tree(name="Oak_Tree", dead=False, wide=False):
    root = root_object(name)
    bark = mat("bark", roughness=0.98)
    leaf = mat("leaf_light" if wide else "leaf", roughness=0.92)
    cylinder("TreeTrunk", 0.42 if wide else 0.32, 5.4, (0, 0, 2.7), bark, vertices=10, parent=root, bevel=0.05)
    for index, (z, angle, length) in enumerate(((3.2, 0.3, 2.1), (3.8, 2.4, 2.0), (4.3, 4.2, 1.75))):
        branch = cylinder("TreeBranch", 0.16, length, (math.cos(angle) * 0.55, math.sin(angle) * 0.55, z + 0.4), bark, vertices=8, rotation=(0, math.radians(58), angle), parent=root, bevel=0.03)
        branch["ss_animated"] = "wind"
    if not dead:
        clusters = ((0, 0, 5.6), (-1.0, 0.2, 4.9), (1.0, -0.3, 4.8), (-0.2, 1.0, 4.7), (0.35, -0.9, 5.0))
        for index, location in enumerate(clusters):
            crown = sphere("LeafCluster", 1.55 if wide else 1.25, location, leaf, scale=(1.25, 1.0, 0.85), subdivisions=1, parent=root)
            crown["ss_animated"] = "wind"
    return root


def furniture_table(parent, location=(0, 0, 0)):
    x, y, z = location
    timber = mat("timber_light", roughness=0.88)
    box("TableTop", (2.2, 1.1, 0.16), (x, y, z + 0.92), timber, bevel=0.06, parent=parent)
    for dx in (-0.8, 0.8):
        for dy in (-0.35, 0.35):
            box("TableLeg", (0.14, 0.14, 0.88), (x + dx, y + dy, z + 0.44), timber, bevel=0.025, parent=parent)


def furniture_bench(parent, location=(0, 0, 0), rotation=0):
    x, y, z = location
    timber = mat("timber", roughness=0.9)
    box("BenchSeat", (1.9, 0.45, 0.14), (x, y, z + 0.55), timber, bevel=0.05, rotation=(0, 0, rotation), parent=parent)
    for offset in (-0.7, 0.7):
        dx, dy = math.cos(rotation) * offset, math.sin(rotation) * offset
        box("BenchLeg", (0.13, 0.13, 0.52), (x + dx, y + dy, z + 0.26), timber, bevel=0.025, parent=parent)


def barrel(parent, location=(0, 0, 0), scale=1.0):
    x, y, z = location
    wood = mat("timber_light", roughness=0.88)
    metal = mat("metal", metallic=0.55, roughness=0.42)
    cylinder("Barrel", 0.38 * scale, 0.95 * scale, (x, y, z + 0.475 * scale), wood, vertices=12, parent=parent)
    for dz in (0.18, 0.72):
        cylinder("BarrelHoop", 0.395 * scale, 0.055 * scale, (x, y, z + dz * scale), metal, vertices=12, parent=parent, bevel=0.005)


def interior_shell(name, width=10, depth=8, height=4.4, material_name="plaster"):
    root = root_object(name)
    stone = mat("stone", roughness=0.94)
    wall = mat(material_name, roughness=0.84)
    box("InteriorFloor", (width, depth, 0.28), (0, 0, 0.14), stone, bevel=0.04, parent=root)
    box("InteriorBackWall", (width, 0.30, height), (0, depth / 2, height / 2), wall, bevel=0.05, parent=root)
    box("InteriorLeftWall", (0.30, depth, height), (-width / 2, 0, height / 2), wall, bevel=0.05, parent=root)
    box("InteriorRightWall", (0.30, depth, height), (width / 2, 0, height / 2), wall, bevel=0.05, parent=root)
    return root


def make_tavern_interior():
    root = interior_shell("Tavern_Interior", 12, 9, 4.8)
    for location in ((-3, 1.8, 0), (0.4, 1.6, 0), (3.5, 1.3, 0), (-1.8, -1.4, 0)):
        furniture_table(root, location)
        furniture_bench(root, (location[0], location[1] - 0.9, 0))
        furniture_bench(root, (location[0], location[1] + 0.9, 0))
    box("BarCounter", (7.0, 0.85, 1.25), (1.5, 3.0, 0.625), mat("timber_light"), bevel=0.08, parent=root)
    for x in (-1.2, 0, 1.2, 2.4, 3.6, 4.4):
        barrel(root, (x, 3.75, 0))
    box("Fireplace", (2.2, 0.65, 2.35), (-4.6, 4.0, 1.18), mat("stone_dark"), bevel=0.1, parent=root)
    sphere("HearthFire", 0.44, (-4.6, 3.58, 0.58), mat("fire", emission=PALETTE["fire"]), scale=(1, 0.55, 0.8), subdivisions=1, parent=root)
    return root


def make_shop_interior():
    root = interior_shell("Shop_Interior", 9, 7, 4.2)
    for x in (-3.4, 3.4):
        for z in (0.7, 1.7, 2.7):
            box("Shelf", (0.45, 5.2, 0.12), (x, 0.7, z), mat("timber_light"), bevel=0.035, parent=root)
    box("ShopCounter", (5.4, 0.85, 1.2), (0, 2.2, 0.6), mat("timber"), bevel=0.08, parent=root)
    for x, y in ((-2.5, -1.5), (1.8, -1.2), (2.7, 0.2)):
        box("TradeCrate", (1.0, 1.0, 0.9), (x, y, 0.45), mat("timber_light"), bevel=0.055, parent=root)
    return root


def make_temple_interior():
    root = interior_shell("Temple_Interior", 12, 12, 7.2, "stone_light")
    for x in (-4.8, 4.8):
        for y in (-3.8, -0.8, 2.2):
            cylinder("NaveColumn", 0.34, 5.5, (x, y, 2.75), mat("stone_light"), vertices=12, parent=root)
    for y in (-3.5, -1.5, 0.5):
        furniture_bench(root, (0, y, 0))
    box("TempleDais", (6.2, 2.6, 0.42), (0, 4.4, 0.21), mat("stone"), bevel=0.07, parent=root)
    box("SacredAltar", (3.2, 1.15, 1.3), (0, 4.5, 1.0), mat("stone_light"), bevel=0.12, parent=root)
    sphere("SacredFlame", 0.42, (0, 4.4, 2.0), mat("fire", emission=PALETTE["fire"]), scale=(0.75, 0.75, 1.5), subdivisions=1, parent=root)
    return root


def make_castle_interior():
    root = interior_shell("Castle_Interior", 15, 14, 8.5, "stone")
    for x in (-6.3, 6.3):
        for y in (-4.6, 0, 4.6):
            cylinder("GreatHallColumn", 0.45, 7.0, (x, y, 3.5), mat("stone_light"), vertices=12, parent=root)
    box("ThroneDais", (7.5, 3.2, 0.65), (0, 5.1, 0.325), mat("stone_dark"), bevel=0.1, parent=root)
    box("ThroneBack", (2.2, 0.55, 3.4), (0, 5.8, 2.25), mat("metal_gold", metallic=0.42, roughness=0.36), bevel=0.15, parent=root)
    box("ThroneSeat", (2.4, 1.6, 0.45), (0, 5.15, 1.0), mat("cloth"), bevel=0.12, parent=root)
    for x in (-5.4, 5.4):
        banner = box("GreatHallBanner", (1.3, 0.08, 4.2), (x, 6.85, 5.6), mat("cloth"), bevel=0.02, parent=root)
        banner["ss_animated"] = "wind"
    return root


def make_house_interior():
    root = interior_shell("House_Interior", 7.5, 6.5, 3.8)
    furniture_table(root, (0.5, 0.8, 0))
    furniture_bench(root, (0.5, -0.1, 0))
    box("BedFrame", (2.2, 3.2, 0.42), (-2.2, 1.3, 0.35), mat("timber"), bevel=0.07, parent=root)
    box("Bedroll", (1.8, 2.75, 0.32), (-2.2, 1.3, 0.68), material("linen", (0.38, 0.31, 0.22, 1), roughness=0.95), bevel=0.15, parent=root)
    box("Hearth", (1.8, 0.72, 1.8), (2.7, 2.85, 0.9), mat("stone_dark"), bevel=0.09, parent=root)
    return root


def make_dungeon_interior():
    root = interior_shell("Dungeon_Interior", 14, 16, 5.5, "stone_dark")
    floor = mat("stone", roughness=0.98)
    for x in (-4.5, 0, 4.5):
        for y in (-5, 0, 5):
            box("DungeonFlagstone", (4.1, 4.5, 0.08), (x, y, 0.32), floor, bevel=0.03, parent=root)
    metal = mat("metal", metallic=0.7, roughness=0.42)
    for x in (-4.5, 4.5):
        for bar in range(-4, 5):
            box("CellBar", (0.09, 0.12, 3.3), (x + bar * 0.35, 5.2, 1.85), metal, bevel=0.01, parent=root)
    for x, y in ((-5.8, -5.8), (5.8, -5.8), (-5.8, 4.8), (5.8, 4.8)):
        sphere("DungeonTorch", 0.22, (x, y, 2.3), mat("fire", emission=PALETTE["fire"]), scale=(0.7, 0.7, 1.6), subdivisions=1, parent=root)
    return root


def make_weapon(kind: str):
    root = root_object(kind)
    steel = mat("metal", metallic=0.78, roughness=0.28)
    gold = mat("metal_gold", metallic=0.7, roughness=0.3)
    wood = mat("timber", roughness=0.86)
    if kind in ("Greatsword", "Dagger"):
        length = 86 if kind == "Greatsword" else 38
        width = 4.8 if kind == "Greatsword" else 2.8
        box("Blade", (width, 1.4, length), (0, 0, length / 2), steel, bevel=0.35, parent=root)
        cone("BladeTip", width * 0.58, 0, width * 1.35, (0, 0, length + width * 0.62), steel, vertices=4, parent=root)
        box("Guard", (22 if kind == "Greatsword" else 11, 3.0, 2.4), (0, 0, -1), gold, bevel=0.55, parent=root)
        cylinder("Grip", 1.45 if kind == "Greatsword" else 0.9, 16 if kind == "Greatsword" else 9, (0, 0, -10 if kind == "Greatsword" else -6), wood, vertices=10, parent=root)
    elif kind == "Mace":
        cylinder("MaceGrip", 1.35, 54, (0, 0, 20), wood, vertices=10, parent=root)
        sphere("MaceHead", 8.5, (0, 0, 51), steel, scale=(1.0, 1.0, 0.82), subdivisions=1, parent=root)
        for angle in range(0, 360, 45):
            a = math.radians(angle)
            cone("MaceFlange", 2.2, 0, 7.0, (math.cos(a) * 8, math.sin(a) * 8, 51), steel, vertices=4, rotation=(0, math.radians(90), a), parent=root)
    elif kind in ("Holy_Staff", "Arcane_Staff"):
        cylinder("StaffShaft", 1.6, 92, (0, 0, 38), wood, vertices=10, parent=root)
        color = (0.25, 0.85, 0.52, 1) if kind == "Holy_Staff" else (0.28, 0.43, 1.0, 1)
        sphere("StaffFocus", 7.5, (0, 0, 88), material(f"{kind}Focus", color, metallic=0.18, roughness=0.2, emission=color), scale=(0.75, 0.75, 1.25), subdivisions=2, parent=root)
        for angle in range(0, 360, 120):
            a = math.radians(angle)
            cone("FocusClaw", 2.0, 0.5, 13, (math.cos(a) * 5.5, math.sin(a) * 5.5, 81), gold, vertices=6, rotation=(0.15, 0.5, a), parent=root)
    elif kind == "Shield":
        cylinder("ShieldFace", 18, 3.2, (0, 0, 0), steel, vertices=12, rotation=(math.radians(90), 0, 0), parent=root)
        sphere("ShieldBoss", 6.0, (0, -2.4, 0), gold, scale=(1, 0.45, 1), subdivisions=2, parent=root)
        for angle in range(0, 360, 45):
            a = math.radians(angle)
            box("ShieldRivet", (1.2, 0.9, 1.2), (math.cos(a) * 14, -2.0, math.sin(a) * 14), gold, bevel=0.25, parent=root)
    elif kind == "Bow":
        curve = bpy.data.curves.new("BowCurve", "CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = 1.2
        curve.bevel_resolution = 2
        spline = curve.splines.new("BEZIER")
        spline.bezier_points.add(4)
        for point, co in zip(spline.bezier_points, [(-22, 0, -34), (-9, 0, -18), (0, 0, 0), (9, 0, 18), (22, 0, 34)]):
            point.co = co
            point.handle_left_type = point.handle_right_type = "AUTO"
        bow = bpy.data.objects.new("BowLimb", curve)
        bpy.context.collection.objects.link(bow)
        bow.data.materials.append(wood)
        bow.parent = root
        string_curve = bpy.data.curves.new("BowString", "CURVE")
        string_curve.dimensions = "3D"
        string_curve.bevel_depth = 0.18
        string = string_curve.splines.new("POLY")
        string.points.add(2)
        for p, co in zip(string.points, [(-22, 0, -34, 1), (0, 5, 0, 1), (22, 0, 34, 1)]):
            p.co = co
        string_obj = bpy.data.objects.new("BowString", string_curve)
        bpy.context.collection.objects.link(string_obj)
        string_curve.materials.append(material("bowstring", (0.7, 0.68, 0.58, 1), roughness=0.95))
        string_obj.parent = root
    return root


RACES = {
    "human": {"scale": (1.0, 1.0, 1.0), "tint": (1.0, 1.0, 1.0, 1), "features": []},
    "dwarf": {"scale": (1.13, 1.08, 0.82), "tint": (0.90, 0.82, 0.73, 1), "features": ["beard"]},
    "elf": {"scale": (0.93, 0.93, 1.06), "tint": (0.84, 0.95, 0.89, 1), "features": ["ears"]},
    "high_elf": {"scale": (0.91, 0.91, 1.09), "tint": (1.0, 0.94, 0.78, 1), "features": ["ears", "circlet"]},
    "dark_elf": {"scale": (0.93, 0.93, 1.05), "tint": (0.54, 0.48, 0.66, 1), "features": ["ears", "circlet"]},
    "orc": {"scale": (1.20, 1.15, 1.12), "tint": (0.55, 0.68, 0.43, 1), "features": ["tusks"]},
    "goblin": {"scale": (0.78, 0.76, 0.67), "tint": (0.61, 0.72, 0.43, 1), "features": ["ears", "brow"]},
}


def weight_to_bone(obj, armature, bone_name):
    bpy.context.view_layer.objects.active = obj
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    modifier = obj.modifiers.new("RaceFeatureRig", "ARMATURE")
    modifier.object = armature
    obj.parent = armature
    obj.matrix_parent_inverse = armature.matrix_world.inverted()


def capture_relaxed_pose(armature):
    """Choose the most symmetrical in-place Walk frame as a dependable relaxed base."""
    walk = bpy.data.actions.get("Walk")
    if not walk:
        return {bone.name: bone.matrix_basis.copy() for bone in armature.pose.bones}
    armature.animation_data.action = walk
    start, end = (int(round(value)) for value in walk.frame_range)
    best = None
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        bones = armature.pose.bones
        required = [bones.get(name) for name in (
            "mixamorig:LeftHand", "mixamorig:RightHand", "mixamorig:LeftFoot", "mixamorig:RightFoot", "mixamorig:Hips"
        )]
        if any(bone is None for bone in required):
            best = (0, frame)
            break
        left_hand, right_hand, left_foot, right_foot, hips = [bone.head.copy() for bone in required]
        hand_level = abs(left_hand.z - right_hand.z)
        foot_level = abs(left_foot.z - right_foot.z)
        stride = abs(left_foot.y - right_foot.y)
        hand_spread = abs(left_hand.y - right_hand.y)
        hand_height = abs((left_hand.z + right_hand.z) * .5 - hips.z)
        score = hand_level * 12 + foot_level * 16 + stride * 6 + hand_spread * 2 + hand_height
        if best is None or score < best[0]:
            best = (score, frame)
    bpy.context.scene.frame_set(best[1] if best else start)
    bpy.context.view_layer.update()
    return {bone.name: bone.matrix_basis.copy() for bone in armature.pose.bones}


def set_pose_from_basis(bone, basis, offset=(0.0, 0.0, 0.0)):
    location, rotation, scale = basis.decompose()
    bone.rotation_mode = "QUATERNION"
    bone.location = location
    bone.rotation_quaternion = rotation @ Euler(offset, "XYZ").to_quaternion()
    bone.scale = scale


def build_relaxed_idle(armature, neutral_pose):
    previous = bpy.data.actions.get("Idle")
    if previous:
        bpy.data.actions.remove(previous)
    action = bpy.data.actions.new("Idle")
    action.use_fake_user = True
    armature.animation_data.action = action
    for frame, breath in ((1, 0.0), (24, -0.022), (48, 0.0)):
        for bone in armature.pose.bones:
            set_pose_from_basis(bone, neutral_pose[bone.name], (breath, 0, 0) if bone.name == "mixamorig:Spine2" else (0, 0, 0))
            bone.keyframe_insert(data_path="location", frame=frame, group=bone.name)
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
            bone.keyframe_insert(data_path="scale", frame=frame, group=bone.name)


def add_combat_actions(armature):
    """Author a compact shared combat set directly on the Mixamo-compatible rig."""
    armature.animation_data_create()
    bones = armature.pose.bones
    neutral_pose = capture_relaxed_pose(armature)
    build_relaxed_idle(armature, neutral_pose)
    action_specs = {
        "Attack_Slash": {
            1: {},
            7: {"mixamorig:Spine2": (0.0, -0.30, 0.20), "mixamorig:RightArm": (-0.75, 0.15, -1.05), "mixamorig:RightForeArm": (-0.25, 0.1, -0.65)},
            13: {"mixamorig:Spine2": (0.0, 0.42, -0.26), "mixamorig:RightArm": (0.42, -0.1, 0.72), "mixamorig:RightForeArm": (0.18, 0.0, 0.35)},
            20: {},
        },
        "Attack_Smite": {
            1: {},
            8: {"mixamorig:Spine2": (-0.18, 0.0, 0.0), "mixamorig:RightArm": (-1.28, 0.0, -0.34), "mixamorig:RightForeArm": (-0.52, 0.0, -0.15)},
            14: {"mixamorig:Spine2": (0.28, 0.0, 0.0), "mixamorig:RightArm": (0.75, 0.0, 0.14), "mixamorig:RightForeArm": (0.3, 0.0, 0.1)},
            22: {},
        },
        "Cast": {
            1: {},
            8: {"mixamorig:Spine2": (-0.12, 0.0, 0.0), "mixamorig:RightArm": (-0.35, -0.18, -1.0), "mixamorig:LeftArm": (-0.35, 0.18, 1.0)},
            18: {"mixamorig:Spine2": (-0.05, 0.0, 0.0), "mixamorig:RightArm": (-0.65, -0.05, -1.28), "mixamorig:LeftArm": (-0.65, 0.05, 1.28)},
            28: {},
        },
        "Bow_Shot": {
            1: {},
            8: {"mixamorig:Spine2": (0.0, -0.32, 0.0), "mixamorig:LeftArm": (-0.15, -0.2, 1.12), "mixamorig:RightArm": (-0.18, 0.2, -1.08), "mixamorig:RightForeArm": (-0.55, 0.0, -0.25)},
            15: {"mixamorig:Spine2": (0.0, -0.28, 0.0), "mixamorig:LeftArm": (-0.12, -0.15, 1.1), "mixamorig:RightArm": (-0.15, 0.15, -0.42)},
            23: {},
        },
        "Block": {
            1: {},
            7: {"mixamorig:Spine2": (0.08, 0.0, 0.0), "mixamorig:LeftArm": (-0.4, 0.15, 0.72), "mixamorig:LeftForeArm": (-0.9, 0.0, 0.2), "mixamorig:RightArm": (-0.15, 0.0, -0.35)},
            22: {"mixamorig:Spine2": (0.08, 0.0, 0.0), "mixamorig:LeftArm": (-0.4, 0.15, 0.72), "mixamorig:LeftForeArm": (-0.9, 0.0, 0.2), "mixamorig:RightArm": (-0.15, 0.0, -0.35)},
            28: {},
        },
        "Dodge": {
            1: {},
            7: {"mixamorig:Hips": (0.0, 0.35, -0.28), "mixamorig:Spine": (0.28, 0.0, -0.18), "mixamorig:LeftUpLeg": (-0.55, 0.0, 0.18), "mixamorig:RightUpLeg": (0.38, 0.0, -0.18)},
            15: {"mixamorig:Hips": (0.0, -0.25, -0.18), "mixamorig:Spine": (0.18, 0.0, 0.16), "mixamorig:LeftUpLeg": (0.25, 0.0, -0.12), "mixamorig:RightUpLeg": (-0.4, 0.0, 0.12)},
            23: {},
        },
        "Hit": {
            1: {},
            5: {"mixamorig:Spine": (0.32, 0.0, 0.0), "mixamorig:Spine2": (0.25, 0.12, 0.0), "mixamorig:RightArm": (-0.2, 0.0, 0.55), "mixamorig:LeftArm": (-0.2, 0.0, -0.55)},
            13: {},
        },
        "Death": {
            1: {},
            10: {"mixamorig:Spine": (0.45, 0.0, 0.0), "mixamorig:Spine2": (0.35, 0.12, 0.0), "mixamorig:RightArm": (-0.45, 0.0, 0.65), "mixamorig:LeftArm": (-0.45, 0.0, -0.65)},
            24: {"mixamorig:Hips": (1.18, 0.0, 0.0), "mixamorig:Spine": (0.72, 0.0, 0.0), "mixamorig:Spine2": (0.48, 0.08, 0.0), "mixamorig:RightArm": (-0.6, 0.0, 0.82), "mixamorig:LeftArm": (-0.6, 0.0, -0.82)},
            38: {"mixamorig:Hips": (1.42, 0.0, 0.0), "mixamorig:Spine": (0.82, 0.0, 0.0), "mixamorig:Spine2": (0.55, 0.08, 0.0), "mixamorig:RightArm": (-0.72, 0.0, 0.94), "mixamorig:LeftArm": (-0.72, 0.0, -0.94)},
        },
    }
    for action_name, frames in action_specs.items():
        previous = bpy.data.actions.get(action_name)
        if previous:
            bpy.data.actions.remove(previous)
        action = bpy.data.actions.new(action_name)
        action.use_fake_user = True
        armature.animation_data.action = action
        for frame, rotations in frames.items():
            for bone_name in {name for values in frames.values() for name in values}:
                bone = bones.get(bone_name)
                if not bone:
                    continue
                set_pose_from_basis(bone, neutral_pose[bone_name], rotations.get(bone_name, (0.0, 0.0, 0.0)))
                bone.keyframe_insert(data_path="location", frame=frame, group=bone_name)
                bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone_name)
                bone.keyframe_insert(data_path="scale", frame=frame, group=bone_name)
    armature.animation_data.action = None
    bpy.context.scene.frame_set(1)


def make_character_variant(race_id: str, config: dict):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(CHARACTER_SOURCE))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in [o for o in bpy.context.scene.objects if o.type == "EMPTY" and o.parent is None]:
        bpy.data.objects.remove(obj, do_unlink=True)

    root = root_object(f"Race_{race_id}")
    root.scale = config["scale"]
    root["ss_race"] = race_id
    armature.parent = root
    for mesh in meshes:
        if mesh.parent is None:
            mesh.parent = root
        for index, source in enumerate(list(mesh.data.materials)):
            if not source:
                continue
            upgraded = source.copy()
            upgraded.name = f"{race_id}_{source.name}"
            color = source.diffuse_color
            tint = config["tint"]
            upgraded.diffuse_color = tuple(min(1.0, color[i] * tint[i]) for i in range(3)) + (color[3],)
            upgraded.use_nodes = True
            bsdf = upgraded.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                set_shader_input(bsdf, ("Roughness",), 0.58)
                set_shader_input(bsdf, ("Metallic", "Metallic IOR Level"), 0.24)
                set_shader_input(bsdf, ("Base Color",), upgraded.diffuse_color)
            mesh.data.materials[index] = upgraded
        mesh["ss_character_mesh"] = True

    skin_color = {
        "dark_elf": (0.30, 0.24, 0.40, 1), "orc": (0.37, 0.52, 0.25, 1), "goblin": (0.45, 0.58, 0.27, 1)
    }.get(race_id, (0.78, 0.56, 0.40, 1))
    skin = material(f"{race_id}_skin", skin_color, roughness=0.76)
    ivory = material("ivory", (0.82, 0.76, 0.59, 1), roughness=0.68)
    feature_objects = []
    if "ears" in config["features"]:
        for side in (-1, 1):
            ear = cone("RaceEar", 0.075 if race_id != "goblin" else 0.11, 0.014, 0.28 if race_id != "goblin" else 0.36, (side * 0.13, -0.055, 1.61), skin, vertices=10, rotation=(0, side * math.radians(90), 0))
            feature_objects.append(ear)
    if "beard" in config["features"]:
        beard = cone("DwarfBeard", 0.11, 0.025, 0.32, (0, -0.10, 1.47), material("beard", (0.23, 0.10, 0.045, 1), roughness=0.96), vertices=12)
        feature_objects.append(beard)
    if "tusks" in config["features"]:
        for side in (-1, 1):
            tusk = cone("OrcTusk", 0.025, 0, 0.13, (side * 0.045, -0.115, 1.53), ivory, vertices=8, rotation=(math.radians(72), 0, 0))
            feature_objects.append(tusk)
    if "circlet" in config["features"]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.105, minor_radius=0.009, major_segments=20, minor_segments=6, location=(0, -0.055, 1.68), rotation=(math.radians(90), 0, 0))
        feature_objects.append(finish(bpy.context.object, "ElvenCirclet", mat("metal_gold", metallic=0.72, roughness=0.25)))
    if "brow" in config["features"]:
        feature_objects.append(box("GoblinBrow", (0.19, 0.045, 0.025), (0, -0.13, 1.63), skin, bevel=0.012))
    for feature in feature_objects:
        weight_to_bone(feature, armature, "mixamorig:Head")
    add_combat_actions(armature)
    return root


def select_hierarchy(root):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(root, relative_path: str, *, animations=False):
    destination = OUTPUT / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Custom authored meshes such as gable roofs need UVs so the browser's
    # shared PBR material library can apply roof tile and masonry maps.
    for child in [root, *root.children_recursive]:
        if child.type != "MESH" or child.data.uv_layers:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        child.select_set(True)
        bpy.context.view_layer.objects.active = child
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.02)
        bpy.ops.object.mode_set(mode="OBJECT")
    select_hierarchy(root)
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        export_apply=not animations,
        export_animations=animations,
        export_lights=False,
        export_cameras=False,
        export_materials="EXPORT",
        export_yup=True,
    )
    return destination


def register(asset_id, category, factory, footprint, *, path=None, interactive=None):
    reset_scene()
    root = factory()
    relative = path or f"{category}/{asset_id}.glb"
    destination = export_glb(root, relative)
    MANIFEST[asset_id] = {
        "category": category,
        "url": f"world3d/assets/production/{relative}",
        "footprint": footprint,
        "interactive": interactive or [],
        "bytes": destination.stat().st_size,
    }


def build_environment():
    register("house_a", "environment", lambda: make_house("House_A", width=6.4, depth=5.0, stories=2), [6.4, 5.0])
    register("house_b", "environment", lambda: make_house("House_B", width=7.2, depth=5.6, stories=2, roof_color="roof_blue"), [7.2, 5.6])
    register("house_c", "environment", lambda: make_house("House_C", width=5.8, depth=4.8, stories=1), [5.8, 4.8])
    register("merchant_shop", "environment", lambda: make_house("Merchant_Shop", width=7.4, depth=5.8, stories=2, shop=True), [7.4, 5.8], interactive=["door", "shop"])
    register("narrow_house", "environment", make_narrow_house, [4.35, 5.4], interactive=["door"])
    register("row_house", "environment", make_row_house, [8.8, 4.65], interactive=["door"])
    register("craft_workshop", "environment", make_workshop, [8.2, 7.4], interactive=["door", "workshop"])
    register("merchant_warehouse", "environment", make_warehouse, [10.5, 7.5], interactive=["door", "warehouse"])
    register("guild_hall", "environment", make_guildhall, [10.4, 8.2], interactive=["door", "guild"])
    register("street_chapel", "environment", make_chapel, [7.4, 7.0], interactive=["door", "chapel"])
    register("noble_estate", "environment", make_noble_house, [11.2, 9.0], interactive=["door", "estate"])
    register("raised_granary", "environment", make_granary, [9.2, 7.0], interactive=["door", "storage"])
    register("tavern", "environment", make_tavern, [9.2, 9.0], interactive=["door", "tavern"])
    register("temple", "environment", make_temple, [11.5, 9.0], interactive=["door", "temple"])
    register("castle_tower", "environment", make_tower, [5.0, 5.0])
    register("city_gatehouse", "environment", make_gatehouse, [11.5, 5.2], interactive=["gate"])
    register("castle_wall", "environment", make_wall, [9.5, 2.0])
    register("castle_keep", "environment", make_castle_keep, [12.0, 10.0], interactive=["door", "castle"])
    register("stone_bridge", "environment", make_bridge, [5.0, 9.5])
    register("crypt", "environment", make_crypt, [7.0, 6.0], interactive=["door", "crypt"])
    register("ancient_ruin", "environment", make_ruin, [8.0, 7.0])
    register("cave_entrance", "environment", make_cave, [8.0, 5.0], interactive=["cave"])
    register("oak_tree", "environment", lambda: make_tree("Oak_Tree", wide=True), [3.5, 3.5])
    register("forest_tree", "environment", lambda: make_tree("Forest_Tree"), [3.0, 3.0])
    register("dead_tree", "environment", lambda: make_tree("Dead_Tree", dead=True), [2.5, 2.5])


def build_interiors():
    register("tavern_interior", "interiors", make_tavern_interior, [12, 9], interactive=["bar", "tables", "fireplace"])
    register("shop_interior", "interiors", make_shop_interior, [9, 7], interactive=["counter", "shelves"])
    register("temple_interior", "interiors", make_temple_interior, [12, 12], interactive=["altar", "sacred_flame"])
    register("castle_interior", "interiors", make_castle_interior, [15, 14], interactive=["throne", "banners"])
    register("house_interior", "interiors", make_house_interior, [7.5, 6.5], interactive=["hearth", "bed"])
    register("dungeon_interior", "interiors", make_dungeon_interior, [14, 16], interactive=["cells", "torches"])


def build_equipment():
    for asset_id, kind, footprint in (
        ("greatsword", "Greatsword", [22, 3]), ("mace", "Mace", [18, 18]), ("shield", "Shield", [36, 5]),
        ("holy_staff", "Holy_Staff", [16, 16]), ("arcane_staff", "Arcane_Staff", [16, 16]),
        ("dagger", "Dagger", [11, 3]), ("bow", "Bow", [46, 10]),
    ):
        register(asset_id, "equipment", lambda kind=kind: make_weapon(kind), footprint)


def build_characters():
    for race_id, config in RACES.items():
        root = make_character_variant(race_id, config)
        relative = f"characters/{race_id}.glb"
        destination = export_glb(root, relative, animations=True)
        MANIFEST[f"character_{race_id}"] = {
            "category": "characters",
            "url": f"world3d/assets/production/{relative}",
            "race": race_id,
            "animations": ["Idle", "Walk", "Run", "Attack_Slash", "Attack_Smite", "Cast", "Bow_Shot", "Block", "Dodge", "Hit", "Death"],
            "bytes": destination.stat().st_size,
        }


def write_manifest():
    manifest_path = OUTPUT / "manifest.json"
    manifest_path.write_text(json.dumps({"version": 1, "assets": MANIFEST}, indent=2) + "\n")
    total = sum(entry["bytes"] for entry in MANIFEST.values())
    print(f"Built {len(MANIFEST)} assets ({total / 1024 / 1024:.2f} MiB runtime GLBs)")


def main():
    build_environment()
    build_interiors()
    build_equipment()
    build_characters()
    write_manifest()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_LIBRARY), check_existing=False)


if __name__ == "__main__":
    main()
