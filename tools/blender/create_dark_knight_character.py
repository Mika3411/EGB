"""Create a real stylized dark knight character in Blender.

Run with Blender:
blender --background --python tools/blender/create_dark_knight_character.py -- --out "regent.glb" --blend "regent.blend"
"""

import argparse
import math
import os
import re
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="")
    parser.add_argument("--blend", default="")
    parser.add_argument("--name", default="Regent du sergent")
    parser.add_argument("--height", type=float, default=2.1)
    return parser.parse_args(argv)


def safe_name(value):
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value or "character").strip("-")
    return cleaned[:60] or "character"


def make_material(name, color, metallic=0.0, roughness=0.55, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = color
    nodes = mat.node_tree.nodes
    bsdf = next((node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if alpha < 1 and "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission[0]
            bsdf.inputs["Emission Strength"].default_value = emission[1]
    if alpha < 1:
        mat.blend_method = "BLEND"
        mat.show_transparent_back = True
    return mat


def set_origin_select(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def bevel(obj, width=0.025, segments=2):
    mod = obj.modifiers.new("soft bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    try:
        mod.affect = "EDGES"
    except Exception:
        pass
    obj.modifiers.new("weighted normals", "WEIGHTED_NORMAL")
    return obj


def add_cube(name, loc, scale, mat, bevel_width=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel_width:
        bevel(obj, bevel_width, 2)
    return obj


def add_uv_sphere(name, loc, scale, mat, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_cone(name, loc, radius1, radius2, depth, mat, vertices=24, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def cylinder_between(name, start, end, radius, mat, vertices=20):
    start = Vector(start)
    end = Vector(end)
    mid = (start + end) * 0.5
    direction = end - start
    length = direction.length
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_ragged_cape(mat):
    columns = 14
    rows = 18
    width = 1.75
    top_z = 2.02
    bottom_z = 0.22
    verts = []
    faces = []
    for y in range(rows + 1):
        v = y / rows
        for x in range(columns + 1):
            u = x / columns
            side = (u - 0.5) * 2
            rag = max(0, v - 0.72) * (0.08 * math.sin(x * 1.7) + 0.10 * abs(side))
            px = (u - 0.5) * width * (1.0 - 0.15 * v)
            py = 0.22 + 0.12 * v + math.sin(u * math.pi * 3.0 + v * 2.0) * 0.035
            pz = top_z * (1 - v) + bottom_z * v - rag
            verts.append((px, py, pz))
    for y in range(rows):
        for x in range(columns):
            a = y * (columns + 1) + x
            faces.append((a, a + 1, a + columns + 2, a + columns + 1))
    mesh = bpy.data.meshes.new("ragged-cape-mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Ragged cape", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    solid = obj.modifiers.new("cloth thickness", "SOLIDIFY")
    solid.thickness = 0.025
    obj.modifiers.new("cape normals", "WEIGHTED_NORMAL")
    return obj


def add_gold_trim(gold):
    add_cube("Chest heraldry", (0, -0.345, 1.58), (0.32, 0.028, 0.42), gold, 0.012)
    add_cube("Belt", (0, -0.335, 1.10), (0.78, 0.04, 0.075), gold, 0.012)
    add_cube("Tabard", (0, -0.36, 0.78), (0.28, 0.035, 0.62), gold, 0.01)
    for side in (-1, 1):
        add_cube(f"Boot trim {side}", (side * 0.26, -0.235, 0.28), (0.24, 0.04, 0.06), gold, 0.01)
        add_cube(f"Forearm trim {side}", (side * 0.86, -0.19, 1.22), (0.18, 0.05, 0.12), gold, 0.01)
        add_cone(f"Shoulder spike {side}", (side * 0.93, -0.07, 1.92), 0.085, 0.0, 0.38, gold, 18, rotation=(0, math.radians(90) * side, 0))
        add_cone(f"Knee spike {side}", (side * 0.27, -0.26, 0.68), 0.055, 0.0, 0.25, gold, 16, rotation=(math.radians(90), 0, 0))


def create_character(args):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    armor = make_material("blackened iron", (0.035, 0.030, 0.024, 1), metallic=0.75, roughness=0.34)
    dark = make_material("deep black", (0.006, 0.007, 0.010, 1), metallic=0.25, roughness=0.58)
    gold = make_material("old gold", (0.75, 0.47, 0.14, 1), metallic=0.88, roughness=0.28)
    cloth = make_material("torn black cloth", (0.012, 0.016, 0.024, 0.92), metallic=0.0, roughness=0.86, alpha=0.92)
    leather = make_material("dark leather", (0.05, 0.034, 0.022, 1), metallic=0.1, roughness=0.7)
    blade = make_material("worn blade", (0.58, 0.55, 0.48, 1), metallic=0.92, roughness=0.24)
    eye = make_material("red eye glow", (1.0, 0.02, 0.0, 1), emission=((1.0, 0.01, 0.0, 1), 3.5))

    # Body mass.
    add_uv_sphere("Torso armor", (0, -0.02, 1.48), (0.48, 0.30, 0.58), armor, 32, 16)
    add_cube("Lower cuirass", (0, -0.03, 1.02), (0.58, 0.32, 0.34), armor, 0.04)
    add_cube("Pelvis armor", (0, -0.02, 0.84), (0.50, 0.30, 0.26), armor, 0.035)

    # Head and helmet.
    add_uv_sphere("Helmet", (0, -0.03, 2.23), (0.25, 0.22, 0.31), armor, 32, 16)
    add_cone("Helmet crown", (0, -0.03, 2.51), 0.22, 0.06, 0.34, armor, 5, rotation=(0, 0, math.radians(45)))
    add_cube("Visor", (0, -0.245, 2.24), (0.34, 0.035, 0.12), dark, 0.01)
    add_cube("Left red eye", (-0.075, -0.27, 2.25), (0.08, 0.012, 0.018), eye, 0.002)
    add_cube("Right red eye", (0.075, -0.27, 2.25), (0.08, 0.012, 0.018), eye, 0.002)
    for index, x in enumerate((-0.18, 0, 0.18)):
        add_cone(f"Crown spike {index}", (x, -0.04, 2.70), 0.045, 0.0, 0.34 if x == 0 else 0.25, gold, 14)

    # Shoulders and limbs.
    for side in (-1, 1):
        add_uv_sphere(f"Pauldron {side}", (side * 0.58, -0.02, 1.86), (0.33, 0.28, 0.18), armor, 24, 12)
        cylinder_between(f"Upper arm {side}", (side * 0.63, -0.04, 1.72), (side * 0.78, -0.05, 1.25), 0.105, armor)
        cylinder_between(f"Forearm {side}", (side * 0.78, -0.05, 1.25), (side * 0.86, -0.12, 0.88), 0.115, armor)
        add_uv_sphere(f"Gauntlet {side}", (side * 0.88, -0.15, 0.82), (0.13, 0.11, 0.11), armor, 18, 10)
        cylinder_between(f"Thigh {side}", (side * 0.22, 0.00, 0.83), (side * 0.25, -0.02, 0.43), 0.13, armor)
        cylinder_between(f"Shin {side}", (side * 0.25, -0.02, 0.43), (side * 0.28, -0.03, 0.14), 0.115, armor)
        add_cube(f"Boot {side}", (side * 0.30, -0.10, 0.06), (0.26, 0.38, 0.12), armor, 0.025)

    add_gold_trim(gold)
    add_ragged_cape(cloth)

    # Sword on character left.
    cylinder_between("Sword grip", (-0.82, -0.34, 1.12), (-0.82, -0.34, 1.48), 0.035, leather, 16)
    add_cube("Sword guard", (-0.82, -0.36, 1.12), (0.42, 0.055, 0.055), gold, 0.012)
    add_cube("Sword blade", (-0.82, -0.38, 0.55), (0.075, 0.035, 1.10), blade, 0.01)
    add_cone("Sword tip", (-0.82, -0.38, -0.05), 0.055, 0.0, 0.22, blade, 4, rotation=(0, 0, math.radians(45)))
    add_uv_sphere("Sword pommel", (-0.82, -0.34, 1.62), (0.065, 0.065, 0.065), gold, 16, 8)

    # Simple floor and lighting.
    floor_mat = make_material("matte floor", (0.18, 0.18, 0.18, 1), roughness=0.9)
    add_cube("small floor", (0, 0, -0.09), (2.7, 2.7, 0.035), floor_mat, 0)

    key_data = bpy.data.lights.new("Key", "AREA")
    key_data.energy = 900
    key_data.size = 4.0
    key = bpy.data.objects.new("Key", key_data)
    key.location = (-3.5, -4.2, 5.0)
    bpy.context.collection.objects.link(key)

    rim_data = bpy.data.lights.new("Rim", "POINT")
    rim_data.energy = 120
    rim = bpy.data.objects.new("Rim", rim_data)
    rim.location = (2.8, 3.0, 2.2)
    bpy.context.collection.objects.link(rim)

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    camera.location = (0, -5.2, 1.35)
    target = Vector((0, -0.02, 1.22))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.lens = 55
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def main():
    args = parse_args()
    create_character(args)
    output_dir = os.path.dirname(os.path.abspath(args.out)) if args.out else os.path.join(os.path.expanduser("~"), "Downloads")
    os.makedirs(output_dir, exist_ok=True)
    base = safe_name(args.name)
    blend_path = args.blend or os.path.join(output_dir, base + "-procedural.blend")
    glb_path = args.out or os.path.join(output_dir, base + "-procedural.glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=False)
    print("Blender file:", blend_path)
    print("GLB export:", glb_path)


if __name__ == "__main__":
    main()
