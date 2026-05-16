"""Convert front/back alpha images into a Blender mesh and GLB.

Run with Blender:
blender --background --python tools/blender/alpha_character_to_glb.py -- --front "front.png" --back "back.png" --out "character.glb" --name "Hero"
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
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--front", required=True)
    parser.add_argument("--back", default="")
    parser.add_argument("--out", default="")
    parser.add_argument("--blend", default="")
    parser.add_argument("--name", default="Character")
    parser.add_argument("--height", type=float, default=1.85)
    parser.add_argument("--build", type=float, default=1.08)
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--depth", type=float, default=0.42)
    parser.add_argument("--relief", type=float, default=0.18)
    parser.add_argument("--sample", type=int, default=118)
    parser.add_argument("--no-mirror-back", action="store_true")
    return parser.parse_args(argv)


def safe_name(value):
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value or "character").strip("-")
    return cleaned[:60] or "character"


def load_pixels(path, target_long_side):
    image = bpy.data.images.load(path, check_existing=False)
    width, height = image.size
    pixels = list(image.pixels[:])
    longest = max(width, height, 1)
    scale = min(1.0, float(target_long_side) / float(longest))
    sample_width = max(12, int(round(width * scale)))
    sample_height = max(12, int(round(height * scale)))
    rows = []
    for y in range(sample_height):
        row = []
        source_y = int((1.0 - ((y + 0.5) / sample_height)) * (height - 1))
        for x in range(sample_width):
            source_x = int(((x + 0.5) / sample_width) * (width - 1))
            offset = (source_y * width + source_x) * 4
            red = pixels[offset]
            green = pixels[offset + 1]
            blue = pixels[offset + 2]
            alpha = pixels[offset + 3]
            luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
            row.append({
                "color": (red, green, blue, alpha),
                "alpha": alpha,
                "luminance": luminance,
            })
        rows.append(row)
    return {"width": sample_width, "height": sample_height, "rows": rows}


def make_cell_grid(front, back, mirror_back=True):
    width = front["width"]
    height = front["height"]
    rows = []
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    for y in range(height):
        row = []
        for x in range(width):
            front_cell = front["rows"][y][x]
            back_cell = None
            if back:
                back_x = width - 1 - x if mirror_back else x
                back_y = min(back["height"] - 1, y)
                back_cell = back["rows"][back_y][min(back["width"] - 1, max(0, back_x))]
            front_alpha = front_cell["alpha"]
            back_alpha = back_cell["alpha"] if back_cell else 0.0
            alpha = max(front_alpha, back_alpha)
            if alpha <= 0.17:
                row.append(None)
                continue
            color_weight = max(0.001, front_alpha + back_alpha)
            front_color = front_cell["color"]
            back_color = back_cell["color"] if back_cell else (0.0, 0.0, 0.0, 0.0)
            color = (
                (front_color[0] * front_alpha + back_color[0] * back_alpha) / color_weight,
                (front_color[1] * front_alpha + back_color[1] * back_alpha) / color_weight,
                (front_color[2] * front_alpha + back_color[2] * back_alpha) / color_weight,
                alpha,
            )
            luminance = (
                front_cell["luminance"] * front_alpha
                + (back_cell["luminance"] if back_cell else 0.0) * back_alpha
            ) / color_weight
            row.append({
                "alpha": alpha,
                "color": color,
                "luminance": luminance,
            })
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
        rows.append(row)
    if min_x > max_x or min_y > max_y:
        raise RuntimeError("No visible alpha pixels found.")
    return rows, (min_x, min_y, max_x, max_y)


def make_image_material(name, path, roughness=0.62, metalness=0.08):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next((node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf:
        image_node = nodes.new("ShaderNodeTexImage")
        image_node.image = bpy.data.images.load(path, check_existing=True)
        links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
        if "Alpha" in image_node.outputs and "Alpha" in bsdf.inputs:
            links.new(image_node.outputs["Alpha"], bsdf.inputs["Alpha"])
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
    material.blend_method = "CLIP"
    material.use_screen_refraction = False
    return material


def make_solid_material(name, color, roughness=0.74, metalness=0.12):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = next((node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
    return material


def build_mesh(rows, bounds, args):
    min_x, min_y, max_x, max_y = bounds
    bounds_width = max(1, max_x - min_x + 1)
    bounds_height = max(1, max_y - min_y + 1)
    model_height = args.height * args.scale
    volume_height = model_height * 1.08
    volume_width = max(model_height * 0.5 * args.build, volume_height * 0.48)
    half_depth = args.depth * args.build * 0.5
    center_y = volume_height * 0.5
    vertices = []
    faces = []
    face_uvs = []
    face_materials = []
    front_vertices = {}
    back_vertices = {}
    grid_width = max(1, len(rows[0]))
    grid_height = max(1, len(rows))

    def cell_at(local_x, local_y):
        x = min_x + local_x
        y = min_y + local_y
        if y < 0 or y >= len(rows) or x < 0 or x >= len(rows[0]):
            return None
        return rows[y][x]

    def adjacent(local_x, local_y):
        values = []
        for oy in (-1, 0):
            for ox in (-1, 0):
                cell = cell_at(local_x + ox, local_y + oy)
                if cell:
                    values.append(cell)
        return values

    def make_vertex(local_x, local_y, side):
        target = front_vertices if side > 0 else back_vertices
        key = (local_x, local_y)
        if key in target:
            return target[key]
        samples = adjacent(local_x, local_y) or [{"luminance": 0.0, "alpha": 0.0}]
        avg_luminance = sum(cell["luminance"] for cell in samples) / len(samples)
        avg_alpha = sum(cell["alpha"] for cell in samples) / len(samples)
        x = ((local_x / bounds_width) - 0.5) * volume_width
        y = center_y + (0.5 - (local_y / bounds_height)) * volume_height
        taper = 0.72 + min(0.28, avg_alpha * 0.28)
        z = side * (half_depth + avg_luminance * args.relief * taper)
        target[key] = len(vertices)
        vertices.append((x, z, y))
        return target[key]

    def front_uv(local_x, local_y):
        return (
            (min_x + local_x) / grid_width,
            1.0 - ((min_y + local_y) / grid_height),
        )

    def back_uv(local_x, local_y):
        return (
            1.0 - ((min_x + local_x) / grid_width),
            1.0 - ((min_y + local_y) / grid_height),
        )

    def add_face(indices, uvs, material_index):
        faces.append(indices)
        face_uvs.append(uvs)
        face_materials.append(material_index)

    for local_y in range(bounds_height):
        for local_x in range(bounds_width):
            cell = cell_at(local_x, local_y)
            if not cell:
                continue
            color = cell["color"]
            v00 = make_vertex(local_x, local_y, 1)
            v10 = make_vertex(local_x + 1, local_y, 1)
            v11 = make_vertex(local_x + 1, local_y + 1, 1)
            v01 = make_vertex(local_x, local_y + 1, 1)
            b00 = make_vertex(local_x, local_y, -1)
            b10 = make_vertex(local_x + 1, local_y, -1)
            b11 = make_vertex(local_x + 1, local_y + 1, -1)
            b01 = make_vertex(local_x, local_y + 1, -1)
            add_face(
                (v00, v01, v11, v10),
                (front_uv(local_x, local_y), front_uv(local_x, local_y + 1), front_uv(local_x + 1, local_y + 1), front_uv(local_x + 1, local_y)),
                0,
            )
            add_face(
                (b10, b11, b01, b00),
                (back_uv(local_x + 1, local_y), back_uv(local_x + 1, local_y + 1), back_uv(local_x, local_y + 1), back_uv(local_x, local_y)),
                1,
            )
            if not cell_at(local_x, local_y - 1):
                add_face((v10, b10, b00, v00), ((0, 0), (1, 0), (1, 1), (0, 1)), 2)
            if not cell_at(local_x, local_y + 1):
                add_face((v01, b01, b11, v11), ((0, 0), (1, 0), (1, 1), (0, 1)), 2)
            if not cell_at(local_x - 1, local_y):
                add_face((v00, b00, b01, v01), ((0, 0), (1, 0), (1, 1), (0, 1)), 2)
            if not cell_at(local_x + 1, local_y):
                add_face((v11, b11, b10, v10), ((0, 0), (1, 0), (1, 1), (0, 1)), 2)

    mesh = bpy.data.meshes.new(safe_name(args.name) + "-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        polygon.material_index = face_materials[polygon.index]
        for loop_index, uv in zip(polygon.loop_indices, face_uvs[polygon.index]):
            uv_layer.data[loop_index].uv = uv

    obj = bpy.data.objects.new(args.name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    obj.data.materials.append(make_image_material(safe_name(args.name) + "-front", args.front))
    obj.data.materials.append(make_image_material(safe_name(args.name) + "-back", args.back or args.front))
    obj.data.materials.append(make_solid_material(safe_name(args.name) + "-edge", (0.045, 0.041, 0.036, 1.0)))
    bpy.ops.object.shade_smooth()
    bevel = obj.modifiers.new("Soft bevel", "BEVEL")
    bevel.width = max(0.006, volume_width / bounds_width * 0.22)
    bevel.segments = 2
    try:
        bevel.affect = "EDGES"
    except Exception:
        pass
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def setup_scene(obj):
    bpy.ops.object.select_all(action="SELECT")
    for candidate in list(bpy.context.selected_objects):
        if candidate != obj:
            bpy.data.objects.remove(candidate, do_unlink=True)
    light_data = bpy.data.lights.new("Key", "AREA")
    light_data.energy = 650
    light_data.size = 4
    light = bpy.data.objects.new("Key", light_data)
    light.location = (-3.0, -4.0, 5.0)
    bpy.context.collection.objects.link(light)
    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    camera.location = (0.0, 4.6, 1.35)
    target = Vector((0.0, 0.0, 1.0))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def main():
    args = parse_args()
    front = load_pixels(args.front, args.sample)
    back = load_pixels(args.back, args.sample) if args.back else None
    rows, bounds = make_cell_grid(front, back, mirror_back=not args.no_mirror_back)
    character = build_mesh(rows, bounds, args)
    setup_scene(character)
    output_dir = os.path.dirname(os.path.abspath(args.out)) if args.out else os.path.join(os.path.expanduser("~"), "Downloads")
    os.makedirs(output_dir, exist_ok=True)
    base = safe_name(args.name)
    blend_path = args.blend or os.path.join(output_dir, base + ".blend")
    glb_path = args.out or os.path.join(output_dir, base + ".glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    try:
        bpy.ops.export_scene.gltf(
            filepath=glb_path,
            export_format="GLB",
            use_selection=False,
            export_vertex_color="NAME",
            export_vertex_color_name="Albedo",
        )
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=False)
    print("Blender file:", blend_path)
    print("GLB export:", glb_path)


if __name__ == "__main__":
    main()
