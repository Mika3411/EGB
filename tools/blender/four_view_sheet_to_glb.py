"""Build a GLB from a 2x2 character view sheet.

Run with Blender:
blender --background --python tools/blender/four_view_sheet_to_glb.py -- --sheet "4 faces.png" --out "character.glb" --name "Hero"
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
    parser.add_argument("--sheet", required=True)
    parser.add_argument("--out", default="")
    parser.add_argument("--blend", default="")
    parser.add_argument("--name", default="Character")
    parser.add_argument("--height", type=float, default=1.95)
    parser.add_argument("--build", type=float, default=1.12)
    parser.add_argument("--sample", type=int, default=104)
    parser.add_argument("--depth-scale", type=float, default=0.72)
    return parser.parse_args(argv)


def safe_name(value):
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value or "character").strip("-")
    return cleaned[:60] or "character"


def load_image_rows(path):
    image = bpy.data.images.load(path, check_existing=False)
    width, height = image.size
    pixels = list(image.pixels[:])
    rows = []
    for y in range(height):
        source_y = height - 1 - y
        row = []
        for x in range(width):
            offset = (source_y * width + x) * 4
            row.append((
                pixels[offset],
                pixels[offset + 1],
                pixels[offset + 2],
                pixels[offset + 3],
            ))
        rows.append(row)
    return rows, width, height


def avg_color(colors):
    count = max(1, len(colors))
    return (
        sum(color[0] for color in colors) / count,
        sum(color[1] for color in colors) / count,
        sum(color[2] for color in colors) / count,
    )


def color_distance(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def luminance(color):
    return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722


def saturation(color):
    return max(color[:3]) - min(color[:3])


def sample_region(rows, region, target_height):
    left, top, right, bottom = region
    source_width = max(1, right - left)
    source_height = max(1, bottom - top)
    target_width = max(12, int(round(target_height * source_width / source_height)))
    sampled = []
    for y in range(target_height):
        source_y = min(bottom - 1, top + int((y + 0.5) / target_height * source_height))
        row = []
        for x in range(target_width):
            source_x = min(right - 1, left + int((x + 0.5) / target_width * source_width))
            row.append(rows[source_y][source_x])
        sampled.append(row)
    return {
        "width": target_width,
        "height": target_height,
        "pixels": sampled,
        "mask": None,
        "bbox": (0, 0, target_width - 1, target_height - 1),
    }


def dilate(mask, rounds=1):
    height = len(mask)
    width = len(mask[0])
    current = mask
    for _ in range(rounds):
        next_mask = [[False for _ in range(width)] for _ in range(height)]
        for y in range(height):
            for x in range(width):
                value = False
                for oy in (-1, 0, 1):
                    for ox in (-1, 0, 1):
                        ny = y + oy
                        nx = x + ox
                        if 0 <= nx < width and 0 <= ny < height and current[ny][nx]:
                            value = True
                next_mask[y][x] = value
        current = next_mask
    return current


def erode(mask, rounds=1):
    height = len(mask)
    width = len(mask[0])
    current = mask
    for _ in range(rounds):
        next_mask = [[False for _ in range(width)] for _ in range(height)]
        for y in range(height):
            for x in range(width):
                value = True
                for oy in (-1, 0, 1):
                    for ox in (-1, 0, 1):
                        ny = y + oy
                        nx = x + ox
                        if not (0 <= nx < width and 0 <= ny < height and current[ny][nx]):
                            value = False
                next_mask[y][x] = value
        current = next_mask
    return current


def connected_keep(mask):
    height = len(mask)
    width = len(mask[0])
    seen = [[False for _ in range(width)] for _ in range(height)]
    components = []
    for y in range(height):
        for x in range(width):
            if seen[y][x] or not mask[y][x]:
                continue
            stack = [(x, y)]
            seen[y][x] = True
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + ox, cy + oy
                    if 0 <= nx < width and 0 <= ny < height and not seen[ny][nx] and mask[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            components.append(cells)
    if not components:
        return mask
    largest = max(len(cells) for cells in components)
    keep = [[False for _ in range(width)] for _ in range(height)]
    for cells in components:
        min_x = min(cell[0] for cell in cells)
        max_x = max(cell[0] for cell in cells)
        min_y = min(cell[1] for cell in cells)
        max_y = max(cell[1] for cell in cells)
        tall = (max_y - min_y + 1) > height * 0.24
        broad = (max_x - min_x + 1) > width * 0.08
        if len(cells) >= max(10, largest * 0.012) or (tall and broad):
            for x, y in cells:
                keep[y][x] = True
    return keep


def fill_holes(mask):
    height = len(mask)
    width = len(mask[0])
    outside = [[False for _ in range(width)] for _ in range(height)]
    stack = []
    for x in range(width):
        if not mask[0][x]:
            stack.append((x, 0))
            outside[0][x] = True
        if not mask[height - 1][x]:
            stack.append((x, height - 1))
            outside[height - 1][x] = True
    for y in range(height):
        if not mask[y][0]:
            stack.append((0, y))
            outside[y][0] = True
        if not mask[y][width - 1]:
            stack.append((width - 1, y))
            outside[y][width - 1] = True
    while stack:
        cx, cy = stack.pop()
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = cx + ox, cy + oy
            if 0 <= nx < width and 0 <= ny < height and not outside[ny][nx] and not mask[ny][nx]:
                outside[ny][nx] = True
                stack.append((nx, ny))
    return [[mask[y][x] or not outside[y][x] for x in range(width)] for y in range(height)]


def make_mask(view):
    pixels = view["pixels"]
    width = view["width"]
    height = view["height"]
    min_alpha = min(pixel[3] for row in pixels for pixel in row)
    if min_alpha < 0.98:
        mask = [[pixels[y][x][3] > 0.15 for x in range(width)] for y in range(height)]
    else:
        border = max(4, min(width, height) // 18)
        row_left = [avg_color([pixels[y][x] for x in range(border)]) for y in range(height)]
        row_right = [avg_color([pixels[y][width - 1 - x] for x in range(border)]) for y in range(height)]
        col_top = [avg_color([pixels[y][x] for y in range(border)]) for x in range(width)]
        col_bottom = [avg_color([pixels[height - 1 - y][x] for y in range(border)]) for x in range(width)]
        mask = []
        for y in range(height):
            row = []
            for x in range(width):
                horizontal = x / max(1, width - 1)
                vertical = y / max(1, height - 1)
                row_bg = tuple(row_left[y][i] * (1 - horizontal) + row_right[y][i] * horizontal for i in range(3))
                col_bg = tuple(col_top[x][i] * (1 - vertical) + col_bottom[x][i] * vertical for i in range(3))
                bg = tuple(row_bg[i] * 0.68 + col_bg[i] * 0.32 for i in range(3))
                color = pixels[y][x]
                diff = color_distance(color, bg)
                gray = luminance(color)
                bg_gray = luminance(bg)
                sat = saturation(color)
                row.append(diff > 0.105 or (gray - bg_gray > 0.04 and diff > 0.055) or (sat > 0.12 and diff > 0.045))
            mask.append(row)
        mask = dilate(mask, 2)
        mask = erode(mask, 1)
    mask = connected_keep(mask)
    mask = fill_holes(mask)
    mask = dilate(mask, 1)
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    for y in range(height):
        for x in range(width):
            if mask[y][x]:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if min_x > max_x:
        min_x, min_y, max_x, max_y = 0, 0, width - 1, height - 1
    view["mask"] = mask
    view["bbox"] = (min_x, min_y, max_x, max_y)
    return view


def sample_view(view, u, v):
    min_x, min_y, max_x, max_y = view["bbox"]
    x = max(min_x, min(max_x, int(round(min_x + u * max(1, max_x - min_x)))))
    y = max(min_y, min(max_y, int(round(min_y + v * max(1, max_y - min_y)))))
    return view["mask"][y][x], view["pixels"][y][x]


def blended_front(front, alt, back, u, v):
    candidates = []
    for view in (front, alt, back):
        present, color = sample_view(view, u, v)
        if present:
            candidates.append(color)
    if not candidates:
        return False, (0.02, 0.018, 0.016, 1.0)
    count = len(candidates)
    return True, (
        sum(color[0] for color in candidates) / count,
        sum(color[1] for color in candidates) / count,
        sum(color[2] for color in candidates) / count,
        1.0,
    )


def build_visual_hull(front, back, front_alt, side, args):
    front_bbox = front["bbox"]
    side_bbox = side["bbox"]
    front_aspect = max(0.25, (front_bbox[2] - front_bbox[0] + 1) / max(1, front_bbox[3] - front_bbox[1] + 1))
    side_aspect = max(0.18, (side_bbox[2] - side_bbox[0] + 1) / max(1, side_bbox[3] - side_bbox[1] + 1))
    ny = max(48, args.sample)
    nx = max(18, min(84, int(round(ny * front_aspect))))
    nz = max(14, min(58, int(round(ny * side_aspect * args.depth_scale))))
    height = args.height
    width = max(height * 0.48 * args.build, height * front_aspect * 0.58)
    depth = max(height * 0.26 * args.build, height * min(0.55, side_aspect * 0.52) * args.build)

    occupied = set()
    colors = {}
    for iy in range(ny):
        v = (iy + 0.5) / ny
        for ix in range(nx):
            u = (ix + 0.5) / nx
            xy_present, xy_color = blended_front(front, front_alt, back, u, v)
            if not xy_present:
                continue
            for iz in range(nz):
                side_u = (iz + 0.5) / nz
                side_present, side_color = sample_view(side, side_u, v)
                if side_present:
                    key = (ix, iy, iz)
                    occupied.add(key)
                    colors[key] = (xy_color, side_color)

    vertices = []
    vertex_map = {}
    faces = []
    face_colors = []

    def vertex(ix, iy, iz):
        key = (ix, iy, iz)
        if key in vertex_map:
            return vertex_map[key]
        x = (ix / nx - 0.5) * width
        y = (iz / nz - 0.5) * depth
        z = (0.5 - iy / ny) * height + height * 0.54
        vertex_map[key] = len(vertices)
        vertices.append((x, y, z))
        return vertex_map[key]

    def add_face(corners, color):
        faces.append(tuple(vertex(*corner) for corner in corners))
        face_colors.append(color)

    directions = [
        ((1, 0, 0), lambda ix, iy, iz: [(ix + 1, iy, iz), (ix + 1, iy + 1, iz), (ix + 1, iy + 1, iz + 1), (ix + 1, iy, iz + 1)]),
        ((-1, 0, 0), lambda ix, iy, iz: [(ix, iy, iz + 1), (ix, iy + 1, iz + 1), (ix, iy + 1, iz), (ix, iy, iz)]),
        ((0, 1, 0), lambda ix, iy, iz: [(ix, iy + 1, iz), (ix, iy + 1, iz + 1), (ix + 1, iy + 1, iz + 1), (ix + 1, iy + 1, iz)]),
        ((0, -1, 0), lambda ix, iy, iz: [(ix, iy, iz + 1), (ix, iy, iz), (ix + 1, iy, iz), (ix + 1, iy, iz + 1)]),
        ((0, 0, 1), lambda ix, iy, iz: [(ix, iy, iz + 1), (ix + 1, iy, iz + 1), (ix + 1, iy + 1, iz + 1), (ix, iy + 1, iz + 1)]),
        ((0, 0, -1), lambda ix, iy, iz: [(ix + 1, iy, iz), (ix, iy, iz), (ix, iy + 1, iz), (ix + 1, iy + 1, iz)]),
    ]

    for ix, iy, iz in occupied:
        xy_color, side_color = colors[(ix, iy, iz)]
        for direction, corner_fn in directions:
            neighbor = (ix + direction[0], iy + direction[1], iz + direction[2])
            if neighbor in occupied:
                continue
            if direction[2] > 0:
                color = xy_color
            elif direction[2] < 0:
                _, color = sample_view(back, (ix + 0.5) / nx, (iy + 0.5) / ny)
            elif direction[0] != 0:
                color = side_color
            else:
                color = (
                    (xy_color[0] + side_color[0]) * 0.5,
                    (xy_color[1] + side_color[1]) * 0.5,
                    (xy_color[2] + side_color[2]) * 0.5,
                    1.0,
                )
            add_face(corner_fn(ix, iy, iz), color)

    mesh = bpy.data.meshes.new(safe_name(args.name) + "-mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    color_attr = mesh.color_attributes.new(name="Albedo", type="BYTE_COLOR", domain="CORNER")
    for polygon in mesh.polygons:
        color = face_colors[polygon.index]
        for loop_index in polygon.loop_indices:
            color_attr.data[loop_index].color = color

    obj = bpy.data.objects.new(args.name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    material = bpy.data.materials.new(safe_name(args.name) + "-vertex-color")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next((node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf:
        try:
            color_node = nodes.new("ShaderNodeVertexColor")
            color_node.layer_name = "Albedo"
            links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])
        except Exception:
            attribute = nodes.new("ShaderNodeAttribute")
            attribute.attribute_name = "Albedo"
            links.new(attribute.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.58
        bsdf.inputs["Metallic"].default_value = 0.18
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    bevel = obj.modifiers.new("Soft bevel", "BEVEL")
    bevel.width = max(0.004, width / max(1, nx) * 0.16)
    bevel.segments = 1
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
    light_data.energy = 750
    light_data.size = 4
    light = bpy.data.objects.new("Key", light_data)
    light.location = (-3.2, -4.2, 5.2)
    bpy.context.collection.objects.link(light)
    fill_data = bpy.data.lights.new("Fill", "POINT")
    fill_data.energy = 95
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.location = (3, 3.5, 2.5)
    bpy.context.collection.objects.link(fill)
    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    camera.location = (0, -4.8, 1.35)
    target = Vector((0, 0, 1.0))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


def main():
    args = parse_args()
    rows, width, height = load_image_rows(args.sheet)
    half_w = width // 2
    half_h = height // 2
    front = make_mask(sample_region(rows, (0, 0, half_w, half_h), args.sample))
    back = make_mask(sample_region(rows, (half_w, 0, width, half_h), args.sample))
    front_alt = make_mask(sample_region(rows, (0, half_h, half_w, height), args.sample))
    side = make_mask(sample_region(rows, (half_w, half_h, width, height), args.sample))
    character = build_visual_hull(front, back, front_alt, side, args)
    setup_scene(character)
    output_dir = os.path.dirname(os.path.abspath(args.out)) if args.out else os.path.join(os.path.expanduser("~"), "Downloads")
    os.makedirs(output_dir, exist_ok=True)
    base = safe_name(args.name)
    blend_path = args.blend or os.path.join(output_dir, base + "-4v.blend")
    glb_path = args.out or os.path.join(output_dir, base + "-4v.glb")
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
