#!/usr/bin/env python3
"""Build Bedrock definitions from the pinned Order To Cook source assets.

This is an offline, deterministic converter. It does not download dependencies,
execute upstream code, or modify the Java checkout. Pillow is only used for
mechanical texture-sheet/alpha conversion and original-model thumbnails.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import itertools
import json
import math
from pathlib import Path
import re
import shutil
import subprocess

from PIL import Image

NS = "ordertocook"
BLOCK_VERSION = "1.21.100"
GEOMETRY_VERSION = "1.21.0"
ROOT = Path(__file__).resolve().parents[1]
ASSET_REL = Path("common/src/main/resources/assets/ordertocook")
PROVENANCE: list[dict] = []
NOTES: list[str] = []
GEOMETRY_SOURCES: dict[str, tuple[list[Path], str]] = {}
FACES = ("north", "east", "south", "west", "up", "down")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def rounded(value):
    if isinstance(value, float):
        return round(value, 6) + 0.0
    if isinstance(value, list):
        return [rounded(v) for v in value]
    if isinstance(value, dict):
        return {k: rounded(v) for k, v in value.items()}
    return value


def sid(name: str) -> str:
    return re.sub(r"[^a-z0-9_.]", "_", name.lower()).strip("_")


def record(source: Path, dest: Path, operation="copy"):
    PROVENANCE.append({"source": str(source.relative_to(SOURCE)), "output": str(dest.relative_to(OUT)),
                       "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "operation": operation})


def copy_asset(source: Path, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)
    record(source, dest)


def geometry(identifier, bones, width=16, height=16):
    return {"format_version": GEOMETRY_VERSION, "minecraft:geometry": [{
        "description": {"identifier": identifier, "texture_width": width, "texture_height": height,
                        "visible_bounds_width": 4, "visible_bounds_height": 4,
                        "visible_bounds_offset": [0, 1, 0]}, "bones": rounded(bones)}]}


def model_path(name):
    namespace, name = name.split(":", 1) if ":" in name else (NS, name)
    if namespace != NS:
        raise ValueError(f"Unexpected external model {namespace}:{name}")
    return ASSETS / "models" / (name + ".json")


def resolve_model(name, visited=()):
    if name in visited:
        raise ValueError("Cyclic Java model parent: " + name)
    path = model_path(name)
    child = read_json(path)
    if child.get("parent", "").startswith(NS + ":"):
        result = resolve_model(child["parent"], (*visited, name))
        result.update({k: v for k, v in child.items() if k != "textures"})
        result["textures"] = {**result.get("textures", {}), **child.get("textures", {})}
        return result
    return child


def resolve_texture(name, textures):
    visited = set()
    while name.startswith("#"):
        if name in visited:
            raise ValueError("Cyclic texture: " + name)
        visited.add(name)
        name = textures[name[1:]]
    return name


def texture_tile(name):
    return NS + "_" + sid(name.split(":", 1)[-1].replace("/", "_"))


def texture_file(name):
    return ASSETS / "textures" / (name.split(":", 1)[-1] + ".png")


def auto_uv(face, low, high):
    x0, y0, z0 = low
    x1, y1, z1 = high
    return {"down": [x0, 16-z1, x1, 16-z0], "up": [x0, z0, x1, z1],
            "north": [16-x1, 16-y1, 16-x0, 16-y0], "south": [x0, 16-y1, x1, 16-y0],
            "west": [z0, 16-y1, z1, 16-y0], "east": [16-z1, 16-y1, 16-z0, 16-y0]}[face]


def java_cube(element, textures):
    # Bedrock uses the reflected X axis. This is the coordinate transform used
    # by Blockbench's Bedrock exporter after centering a Java model at 8,0,8.
    raw_from, raw_to = element["from"], element["to"]
    low = [min(a, b) for a, b in zip(raw_from, raw_to)]
    high = [max(a, b) for a, b in zip(raw_from, raw_to)]
    rotation = element.get("rotation", {})
    pivot = rotation.get("origin", [8, 8, 8])
    axis, angle = rotation.get("axis", "y"), rotation.get("angle", 0)
    if rotation.get("rescale") and angle:
        factor = 1 / math.cos(math.radians(angle))
        for index in range(3):
            if index != "xyz".index(axis):
                low[index] = pivot[index] + (low[index]-pivot[index]) * factor
                high[index] = pivot[index] + (high[index]-pivot[index]) * factor
    cube = {"origin": [8-high[0], low[1], low[2]-8],
            "size": [b-a for a, b in zip(low, high)], "uv": {}}
    for direction, face in element.get("faces", {}).items():
        uv = face.get("uv", auto_uv(direction, raw_from, raw_to))
        u0, v0, u1, v1 = uv
        if direction in ("up", "down"):
            u0, v0, u1, v1 = u1, v1, u0, v0
        texture = resolve_texture(face["texture"], textures)
        cube["uv"][direction] = {"uv": [u0, v0], "uv_size": [u1-u0, v1-v0],
                                  "material_instance": texture_tile(texture)}
        if face.get("rotation"):
            cube["uv"][direction]["uv_rotation"] = face["rotation"]
    if angle:
        cube["pivot"] = [8-pivot[0], pivot[1], pivot[2]-8]
        cube["rotation"] = [0, 0, 0]
        cube["rotation"]["xyz".index(axis)] = angle * (-1 if axis != "z" else 1)
    return rounded(cube)


def convert_java_model(name, identifier, extra_models=()):
    cubes, materials = [], {}
    sources = []
    for model_name in (name, *extra_models):
        parent_name = model_name
        while parent_name.startswith(NS + ":"):
            source_path = model_path(parent_name)
            sources.append(source_path)
            parent_name = read_json(source_path).get("parent", "")
        model = resolve_model(model_name)
        for cube in model.get("elements", []):
            cubes.append(java_cube(cube, model.get("textures", {})))
        for tex in model.get("textures", {}).values():
            resolved = resolve_texture(tex, model["textures"])
            if texture_file(resolved).is_file():
                materials[texture_tile(resolved)] = {"texture": texture_tile(resolved),
                    "render_method": "alpha_test", "ambient_occlusion": False, "face_dimming": True}
    if not materials:
        materials[NS + "_block_order_machine"] = {"texture": NS + "_block_order_machine", "render_method": "alpha_test"}
    materials["*"] = copy.deepcopy(next(iter(materials.values())))
    GEOMETRY_SOURCES[identifier] = (list(dict.fromkeys(sources)), "Java elements, rescale, reflected coordinates and per-face UV conversion")
    return geometry(identifier, [{"name": "root", "pivot": [0, 0, 0], "cubes": cubes}]), materials


def normalize_geo(source: Path, identifier: str):
    g = copy.deepcopy(read_json(source))
    g["format_version"] = GEOMETRY_VERSION
    for entry in g["minecraft:geometry"]:
        entry["description"]["identifier"] = identifier
        for bone in entry["bones"]:
            for cube in bone.get("cubes", []):
                for axis in range(3):
                    if cube["size"][axis] < 0:
                        cube["origin"][axis] += cube["size"][axis]
                        cube["size"][axis] *= -1
    return g


def uv_crop_y(face, old_top, old_bottom, new_top, new_bottom):
    # The refrigerator cut intersects only unrotated vertical UV rectangles.
    # Crop the actual texels instead of stretching the same door over both halves.
    result = copy.deepcopy(face)
    old_height = old_top-old_bottom
    if not old_height:
        return result
    t0 = (old_top-new_top)/old_height
    t1 = (old_top-new_bottom)/old_height
    result["uv"][1] += result["uv_size"][1] * t0
    result["uv_size"][1] *= t1-t0
    return result


def split_fridge_geo(g, half, opened):
    result = copy.deepcopy(g)
    result["minecraft:geometry"][0]["description"]["identifier"] = f"geometry.{NS}.refrigerator_{half}_{int(opened)}"
    lower, upper = (0, 16) if half == "lower" else (16, 32)
    offset = 0 if half == "lower" else 16
    for bone in result["minecraft:geometry"][0]["bones"]:
        kept = []
        for cube in bone.get("cubes", []):
            y0, y1 = cube["origin"][1], cube["origin"][1]+cube["size"][1]
            a, b = max(y0, lower), min(y1, upper)
            if a >= b:
                continue
            part = copy.deepcopy(cube)
            part["origin"][1] = a-offset
            part["size"][1] = b-a
            for face_name, uv in list(part["uv"].items()):
                if face_name not in ("up", "down"):
                    part["uv"][face_name] = uv_crop_y(uv, y1, y0, b, a)
            if b < y1:
                part["uv"].pop("up", None)
            if a > y0:
                part["uv"].pop("down", None)
            if "pivot" in part:
                part["pivot"][1] -= offset
            kept.append(part)
        bone["cubes"] = kept
        bone["pivot"][1] -= offset
        if opened and bone["name"] in ("bone2", "bone3"):
            bone["rotation"] = [0, -135 if bone["name"] == "bone2" else -125, 0]
    return rounded(result)


def unwrap_vectors(value):
    if isinstance(value, dict):
        if "vector" in value:
            return unwrap_vectors(value["vector"])
        return {key: unwrap_vectors(item) for key, item in value.items() if key not in ("easing", "easingArgs")}
    if isinstance(value, list):
        return [unwrap_vectors(x) for x in value]
    return value


def convert_animations():
    names = {}
    for source in sorted((ASSETS / "animations").glob("*.json")):
        family = source.name.replace(".animation.json", "").replace(".", "_")
        result = {"format_version": "1.8.0", "animations": {}}
        for name, body in read_json(source)["animations"].items():
            identifier = f"animation.{NS}.{family}.{sid(name)}"
            names[(family, name)] = identifier
            body = unwrap_vectors(body)
            # Java's easing extensions do not exist in Bedrock. The key poses
            # and durations remain exact; native interpolation is used between.
            body.pop("particle_effects", None)  # upstream's effect '3' has no declared particle asset
            result["animations"][identifier] = body
        dest = RP / "animations" / source.name
        write_json(dest, result)
        record(source, dest, "GeckoLib vector wrapper/identifier normalization; native interpolation")
    return names


def emit_geo(name, g):
    dest = RP / "models" / "blocks" / (name + ".geo.json")
    write_json(dest, g)
    identifier = g["minecraft:geometry"][0]["description"]["identifier"]
    if identifier in GEOMETRY_SOURCES:
        sources, operation = GEOMETRY_SOURCES[identifier]
        for source in sources:
            record(source, dest, operation)
    return identifier


def state_condition(states):
    return " && ".join(f"q.block_state('{NS}:{key}') == " + (f"'{value}'" if isinstance(value, str) else str(value).lower()) for key, value in states.items())


def block_definition(name, base_geo, materials, states=None, variants=(), collision=True, selection=None):
    description = {"identifier": f"{NS}:{name}", "menu_category": {"category": "construction"},
                   "traits": {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"], "y_rotation_offset": 180}}}
    if states:
        description["states"] = {}
        for key, values in states.items():
            if len(values) > 16:
                assert values == list(range(len(values))), "Wide state must be contiguous integer range"
                description["states"][f"{NS}:{key}"] = list(range(16))
                high = (len(values)-1)//16
                description["states"][f"{NS}:{key}_high"] = [False, True] if high == 1 else list(range(high+1))
                for variant in variants:
                    variant["condition"] = variant["condition"].replace(
                        f"q.block_state('{NS}:{key}')",
                        f"(q.block_state('{NS}:{key}') + 16 * q.block_state('{NS}:{key}_high'))")
            else:
                description["states"][f"{NS}:{key}"] = values
    particle = materials["*"]["texture"]
    components = {"minecraft:geometry": base_geo, "minecraft:material_instances": materials,
        "minecraft:collision_box": collision, "minecraft:selection_box": selection if selection is not None else collision,
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 6},
        "minecraft:loot": f"loot_tables/blocks/{name}.json",
        "minecraft:destruction_particles": {"texture": particle, "particle_count": 50},
        "minecraft:light_dampening": 0, "minecraft:map_color": "#9b9286",
        "minecraft:movable": {"movement_type": "immovable"}, f"{NS}:interact": {}}
    permutations = [{"condition": f"q.block_state('minecraft:cardinal_direction') == '{direction}'",
                     "components": {"minecraft:transformation": {"rotation": [0, rotation, 0]}}}
                    for direction, rotation in (("north", 0), ("south", 180), ("west", 90), ("east", -90))]
    permutations.extend(variants)
    result = {"format_version": BLOCK_VERSION, "minecraft:block": {"description": description, "components": components, "permutations": permutations}}
    write_json(BP / "blocks" / (name + ".json"), result)
    drop = "dirty_plate" if name == "food_plate_display" else name
    loot = {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:{drop}", "weight": 1}]}]}
    if name in ("food_plate_display", "takeout_bag"):
        loot = {"pools": []}  # Script returns the unique signed stack, never an unbound duplicate.
    write_json(BP / "loot_tables" / "blocks" / (name + ".json"), loot)


def simple_block(name, model, collision=True, selection=None):
    g, mats = convert_java_model(NS + ":block/" + model, f"geometry.{NS}.{name}")
    emit_geo(name, g)
    block_definition(name, g["minecraft:geometry"][0]["description"]["identifier"], mats, collision=collision, selection=selection)


def make_blocks():
    simple_block("board", "board", False, {"origin": [-8, 0, 4], "size": [16, 16, 4]})
    simple_block("countertop", "countertop")
    simple_block("chair", "chair", {"origin": [-5, 0, -5], "size": [10, 8, 10]}, {"origin": [-5, 0, -5], "size": [10, 16, 10]})
    simple_block("takeout_bag", "takeout_bag", False, {"origin": [-5, 0, -5], "size": [10, 10, 10]})
    for name, state, maximum in (("shelf", "papers", 10), ("plate_shelf", "plates", 18), ("washingtable", "plates", 10)):
        variants = []
        for count in range(maximum+1):
            extra = (f"{NS}:block/{name}_{count}",) if count else ()
            g, mats = convert_java_model(f"{NS}:block/{name}_idle", f"geometry.{NS}.{name}_{count}", extra)
            identifier = emit_geo(f"{name}_{count}", g)
            variants.append({"condition": state_condition({state: count}), "components": {"minecraft:geometry": identifier, "minecraft:material_instances": mats}})
        coll = True if name == "washingtable" else {"origin": [-8, 0, 0], "size": [16, 16, 8]}
        block_definition(name, f"geometry.{NS}.{name}_0", mats, {state: list(range(maximum+1))}, variants, coll)
    # Every Java food/eating stage is retained. Stage 0 is the empty display.
    blockstates_source = ASSETS / "blockstates" / "food_plate_display.json"
    blockstates = read_json(blockstates_source)["variants"]
    variants = []
    for stage in range(41):
        spec = blockstates[f"facing=north,stage={stage}"]
        if isinstance(spec, list):
            spec = spec[0]
        display_model = f"{NS}:block/clean_plate" if stage == 0 else spec["model"]
        g, mats = convert_java_model(display_model, f"geometry.{NS}.food_plate_display_{stage}")
        identifier = emit_geo(f"food_plate_display_{stage}", g)
        variants.append({"condition": state_condition({"stage": stage}), "components": {"minecraft:geometry": identifier, "minecraft:material_instances": mats}})
    block_definition("food_plate_display", f"geometry.{NS}.food_plate_display_0", mats, {"stage": list(range(41))}, variants,
                     False, {"origin": [-6, 0, -6], "size": [12, 5, 12]})
    record(blockstates_source, BP / "blocks/food_plate_display.json", "Original stage-to-model mapping with clean-plate stage zero adaptation")
    # Printer animation uses the original three paper positions.
    variants = []
    for mode in ("idle", "printing", "waiting"):
        for frame in range(3):
            extra = () if mode == "idle" else (f"{NS}:block/order_machine_paper{frame if mode == 'printing' else 2}",)
            g, mats = convert_java_model(f"{NS}:block/order_machine_idle", f"geometry.{NS}.order_machine_{mode}_{frame}", extra)
            identifier = emit_geo(f"order_machine_{mode}_{frame}", g)
            variants.append({"condition": state_condition({"mode": mode, "frame": frame}), "components": {"minecraft:geometry": identifier}})
    block_definition("order_machine", f"geometry.{NS}.order_machine_idle_0", mats,
                     {"mode": ["idle", "printing", "waiting"], "frame": [0, 1, 2]}, variants,
                     {"origin": [-7, 0, -7], "size": [14, 14, 14]})
    # Fridge is genuinely two blocks; no over-30-pixel geometry is registered.
    fridge = normalize_geo(ASSETS / "geo/block/refrigerator.geo.json", f"geometry.{NS}.refrigerator_source")
    tile = texture_tile(f"{NS}:block/refrigerator")
    mats = {"*": {"texture": tile, "render_method": "alpha_test", "ambient_occlusion": False}}
    variants = []
    for half, opened in itertools.product(("lower", "upper"), (False, True)):
        g = split_fridge_geo(fridge, half, opened)
        identifier = emit_geo(f"refrigerator_{half}_{int(opened)}", g)
        record(ASSETS / "geo/block/refrigerator.geo.json", RP / "models/blocks" / f"refrigerator_{half}_{int(opened)}.geo.json", "Y=16 split with cropped original UVs and synchronized door pose")
        components = {"minecraft:geometry": identifier}
        if half == "upper":
            components["minecraft:loot"] = "loot_tables/empty.json"
        variants.append({"condition": state_condition({"half": half, "open": opened}), "components": components})
    block_definition("refrigerator", f"geometry.{NS}.refrigerator_lower_0", mats,
                     {"half": ["lower", "upper"], "open": [False, True]}, variants)
    write_json(BP / "loot_tables" / "empty.json", {"pools": []})
    # Dishwasher: native static bone poses follow the six upstream phase IDs.
    source = ASSETS / "geo/block/dishwasher.geo.json"
    base = normalize_geo(source, f"geometry.{NS}.dishwasher")
    tile = texture_tile(f"{NS}:block/dishwasher")
    mats = {"*": {"texture": tile, "render_method": "alpha_test", "ambient_occlusion": False}}
    variants = []
    for phase in range(6):
        g = copy.deepcopy(base)
        g["minecraft:geometry"][0]["description"]["identifier"] = f"geometry.{NS}.dishwasher_{phase}"
        for bone in g["minecraft:geometry"][0]["bones"]:
            if bone["name"] == "group5" and phase in (4, 5):
                bone["rotation"] = [90, 0, 0]
            if bone["name"] == "group3" and phase in (4, 5):
                # A safe static extended drawer pose, within the block bounds.
                for child in g["minecraft:geometry"][0]["bones"]:
                    if child["name"] in ("group3", "drity_dish", "clear_dish"):
                        child["pivot"][2] -= 10
                        for c in child.get("cubes", []):
                            c["origin"][2] -= 10
            if bone["name"] == "drity_dish" and phase not in (2, 3):
                bone["cubes"] = []
            if bone["name"] == "clear_dish" and phase not in (4, 5):
                bone["cubes"] = []
        identifier = emit_geo(f"dishwasher_{phase}", g)
        record(source, RP / "models/blocks" / f"dishwasher_{phase}.geo.json", f"Original bones with static dishwasher phase {phase} pose")
        variants.append({"condition": state_condition({"phase": phase}), "components": {"minecraft:geometry": identifier}})
    block_definition("dishwasher", f"geometry.{NS}.dishwasher_0", mats,
                     {"phase": list(range(6)), "plates": list(range(17))}, variants)
    g, mats = convert_java_model(f"{NS}:block/stove", f"geometry.{NS}.stove")
    emit_geo("stove", g)
    lit_mats = copy.deepcopy(mats)
    for material in lit_mats.values():
        if material["texture"] == texture_tile(f"{NS}:block/stove"):
            material["texture"] = f"{NS}_stove_lit"
    block_definition("stove", f"geometry.{NS}.stove", mats, {"lit": [False, True]}, [{
        "condition": state_condition({"lit": True}), "components": {"minecraft:material_instances": lit_mats,
        "minecraft:light_emission": 7}}])


def transform3(v, rotation, pivot=(0, 0, 0)):
    x, y, z = (v[i]-pivot[i] for i in range(3))
    for axis, degrees in enumerate(rotation):
        a = math.radians(degrees)
        c, s = math.cos(a), math.sin(a)
        if axis == 0:
            y, z = y*c-z*s, y*s+z*c
        elif axis == 1:
            x, z = x*c+z*s, -x*s+z*c
        else:
            x, y = x*c-y*s, x*s+y*c
    return [x+pivot[0], y+pivot[1], z+pivot[2]]


def render_item_icon(model_name, dest):
    """Orthographic, textured model thumbnail; no substitute artwork."""
    model = resolve_model(model_name)
    quads = []
    textures = {}
    for element in model.get("elements", []):
        low, high = element["from"], element["to"]
        x0, y0, z0 = low
        x1, y1, z1 = high
        positions = {
            "north": [[x1,y1,z0],[x0,y1,z0],[x0,y0,z0],[x1,y0,z0]],
            "south": [[x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[x0,y0,z1]],
            "east": [[x1,y1,z1],[x1,y1,z0],[x1,y0,z0],[x1,y0,z1]],
            "west": [[x0,y1,z0],[x0,y1,z1],[x0,y0,z1],[x0,y0,z0]],
            "up": [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],
            "down": [[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0]],
        }
        for direction, face in element.get("faces", {}).items():
            tex_name = resolve_texture(face["texture"], model.get("textures", {}))
            path = texture_file(tex_name)
            if not path.is_file():
                continue
            textures.setdefault(tex_name, Image.open(path).convert("RGBA"))
            vertices = positions[direction]
            rotation = element.get("rotation", {})
            if rotation.get("angle"):
                angles = [0, 0, 0]
                angles["xyz".index(rotation["axis"])] = rotation["angle"]
                if rotation.get("rescale"):
                    p = rotation["origin"]
                    factor = 1/math.cos(math.radians(rotation["angle"]))
                    vertices = [[p[i]+(v[i]-p[i])*(1 if i == "xyz".index(rotation["axis"]) else factor) for i in range(3)] for v in vertices]
                vertices = [transform3(v, angles, rotation["origin"]) for v in vertices]
            # Camera yaw then pitch keeps the upper surface facing the viewer.
            # Applying pitch before yaw would rotate its normal away and render
            # the underside of shallow plates as their inventory thumbnail.
            vertices = [transform3(transform3(v, [0, 135, 0], [8, 8, 8]), [25, 0, 0], [8, 8, 8]) for v in vertices]
            uv = face.get("uv", auto_uv(direction, low, high))
            texcoords = [[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]]
            shift = face.get("rotation", 0)//90
            texcoords = texcoords[-shift:]+texcoords[:-shift] if shift else texcoords
            quads.append((vertices, texcoords, tex_name, direction))
    if not quads:
        raise ValueError("No renderable model for " + model_name)
    points = [v for quad in quads for v in quad[0]]
    minx, maxx = min(v[0] for v in points), max(v[0] for v in points)
    miny, maxy = min(v[1] for v in points), max(v[1] for v in points)
    size, padding = 128, 10
    scale = (size-2*padding)/max(maxx-minx, maxy-miny, 1)
    midx, midy = (minx+maxx)/2, (miny+maxy)/2
    canvas = Image.new("RGBA", (size, size))
    pixels = canvas.load()
    depth = [[float("-inf")]*size for _ in range(size)]
    for vertices, coords, texture, direction in quads:
        projected = [[(v[0]-midx)*scale+size/2, size/2-(v[1]-midy)*scale, v[2]] for v in vertices]
        tex = textures[texture]
        texpx = tex.load()
        shade = {"up": 1, "down": .68, "north": .9, "south": .9, "east": .79, "west": .79}[direction]
        for ia, ib, ic in ((0,1,2),(0,2,3)):
            a,b,c = [projected[i] for i in (ia,ib,ic)]
            denom = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(denom)<1e-8:
                continue
            for y in range(max(0, math.floor(min(a[1],b[1],c[1]))), min(size, math.ceil(max(a[1],b[1],c[1])))):
                for x in range(max(0, math.floor(min(a[0],b[0],c[0]))), min(size, math.ceil(max(a[0],b[0],c[0])))):
                    aa=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/denom
                    bb=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/denom
                    cc=1-aa-bb
                    if min(aa,bb,cc)<-1e-6:
                        continue
                    zz=aa*a[2]+bb*b[2]+cc*c[2]
                    if zz<depth[y][x]-1e-6:
                        continue
                    uv=[aa*coords[ia][i]+bb*coords[ib][i]+cc*coords[ic][i] for i in range(2)]
                    tx=min(tex.width-1,max(0,int(uv[0]*tex.width/16)))
                    ty=min(tex.height-1,max(0,int(uv[1]*tex.height/16)))
                    color=texpx[tx,ty]
                    if color[3]<15:
                        continue
                    depth[y][x]=zz
                    pixels[x,y]=tuple(round(v*shade) for v in color[:3])+(color[3],)
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest)
    record(model_path(model_name), dest, "Orthographic thumbnail rendered from original model and texture pixels")


def make_items():
    flat = {f"chef_coin_{n}": f"item/chef_coin_{n}" for n in (1,5,20,100,10000)}
    flat.update({"order": "item/order", "otc_upgrade_box": "item/otc_upgrade_box", "guide": "item/order", "controller": "item/order"})
    models = {"clean_plate": "block/clean_plate", "dirty_plate": "block/dirty_plate_item", "food_plate": "block/food_plate", "takeout_bag": "block/takeout_bag",
              "motorcycle": "block/motorcycle", "helmet": "item/helmet"}
    icon_map = {}
    for name, tex in flat.items():
        icon_map[f"{NS}_{name}"] = {"textures": f"textures/{NS}/{tex}"}
    for name, model in models.items():
        dest = RP / "textures" / "items" / (name + ".png")
        render_item_icon(f"{NS}:{model}", dest)
        icon_map[f"{NS}_{name}"] = {"textures": f"textures/items/{name}"}
    for name in (*flat, *models):
        components = {"minecraft:display_name": {"value": f"item.{NS}:{name}.name"},
            "minecraft:icon": {"textures": {"default": f"{NS}_{name}"}},
            "minecraft:max_stack_size": 1 if name in ("guide","controller","order","food_plate","takeout_bag","motorcycle","helmet") else 64}
        if name in ("guide", "controller", "order", "food_plate", "takeout_bag", "motorcycle", "otc_upgrade_box"):
            components[f"{NS}:use"] = {}
            components["minecraft:interact_button"] = True
            components["minecraft:use_modifiers"] = {"use_duration": .1, "movement_modifier": 1}
        if name == "takeout_bag":
            components["minecraft:block_placer"] = {"block": f"{NS}:takeout_bag", "replace_block_item": True}
        if name == "helmet":
            components["minecraft:wearable"] = {"slot": "slot.armor.head", "protection": 2}
        write_json(BP / "items" / (name + ".json"), {"format_version": BLOCK_VERSION, "minecraft:item": {
            "description": {"identifier": f"{NS}:{name}", "menu_category": {"category": "items"}}, "components": components}})
    write_json(RP / "textures/item_texture.json", {"resource_pack_name": "Order To Cook Unofficial", "texture_name": "atlas.items", "texture_data": icon_map})


def make_helmet_attachable():
    """Original shell and visor on the armor head bone, without player.json."""
    model = resolve_model(f"{NS}:item/helmet")
    geometries, textures = {}, {}
    controllers = {}
    for part, texture in (("shell", f"{NS}:item/delivery_helmet"), ("visor", f"{NS}:item/delivery_helmet_glass")):
        cubes = []
        for element in model["elements"]:
            cube = java_cube(element, model["textures"])
            cube["uv"] = {direction: {k:v for k,v in face.items() if k != "material_instance"}
                          for direction,face in cube["uv"].items() if face["material_instance"] == texture_tile(texture)}
            if not cube["uv"]:
                continue
            cube["origin"][1] += 24
            if "pivot" in cube:
                cube["pivot"][1] += 24
            cubes.append(cube)
        identifier = f"geometry.{NS}.helmet_{part}"
        dest = RP / "models/entity" / f"helmet_{part}.geo.json"
        write_json(dest, geometry(identifier, [{"name":"head","pivot":[0,24,0],"cubes":cubes}]))
        record(model_path(f"{NS}:item/helmet"), dest, "Head armor attachment; source shell/visor materials retained")
        geometries[part] = identifier
        textures[part] = "textures/" + NS + "/" + texture.split(":",1)[1]
        controllers[f"controller.render.{NS}.helmet_{part}"] = {"geometry": f"Geometry.{part}",
            "materials":[{"*":f"Material.{part}"}],"textures":[f"Texture.{part}"]}
    write_json(RP / "attachables/helmet.attachable.json", {"format_version":"1.10.0","minecraft:attachable":{"description":{
        "identifier":f"{NS}:helmet", "materials":{"shell":"armor","visor":"entity_alphablend"},
        "textures":textures,"geometry":geometries,"scripts":{"parent_setup":"variable.helmet_layer_visible = 0.0;"},
        "render_controllers":list(controllers)}}})
    write_json(RP / "render_controllers/helmet.render_controllers.json", {"format_version":"1.10.0","render_controllers":controllers})


def entity_description(name, properties=None):
    d = {"identifier": f"{NS}:{name}", "is_spawnable": name in ("customer", "motorcycle"), "is_summonable": True, "is_experimental": False}
    if properties:
        d["properties"] = properties
    return d


def entity_base(family, gravity=False, collision=False):
    return {"minecraft:type_family": {"family": [family, NS]}, "minecraft:persistent": {},
        "minecraft:health": {"value": 20, "max": 20}, "minecraft:physics": {"has_gravity": gravity, "has_collision": collision},
        "minecraft:damage_sensor": {"triggers": [{"deals_damage": "no"}]},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False}}


def write_entity(name, components, properties=None):
    write_json(BP / "entities" / (name + ".json"), {"format_version": BLOCK_VERSION, "minecraft:entity": {
        "description": entity_description(name, properties), "components": components,
        "component_groups": {f"{NS}:despawn": {"minecraft:instant_despawn": {}}},
        "events": {f"{NS}:despawn": {"add": {"component_groups": [f"{NS}:despawn"]}}}}})


def make_motorcycle_geo():
    """Read the original Mojang CubeListBuilder model (41 textured boxes)."""
    source = SOURCE / "forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java"
    text = source.read_text(encoding="utf-8")
    pattern = re.compile(r'(\w+)\.addOrReplaceChild\("([^"]+)",\s*(CubeListBuilder\.create\(\).*?),\s*PartPose\.(offset(?:AndRotation)?)\((.*?)\)\);', re.S)
    bones, pivots = [], {"partdefinition": [0,0,0]}
    for match in pattern.finditer(text):
        parent, name, cubes_text, pose_type, pose_text = match.groups()
        pose = [float(x.rstrip("Ff")) for x in pose_text.split(",")]
        parent_offset = pivots[parent]
        origin = [parent_offset[i]+pose[i] for i in range(3)]
        pivots[name] = origin
        pivot = [-origin[0], 24-origin[1], origin[2]]
        bone = {"name": name, "pivot": pivot, "cubes": []}
        if parent != "partdefinition":
            bone["parent"] = parent
        if pose_type == "offsetAndRotation":
            bone["rotation"] = [-math.degrees(pose[3]), -math.degrees(pose[4]), math.degrees(pose[5])]
        for cm in re.finditer(r'\.texOffs\(([^)]+)\)\.addBox\((.*?),\s*new CubeDeformation\(([^)]+)\)\)', cubes_text, re.S):
            uv = [int(v.strip()) for v in cm.group(1).split(",")]
            vals = [float(v.strip().rstrip("Ff")) for v in cm.group(2).split(",")]
            x,y,z,sx,sy,sz = vals
            cube = {"origin": [-(origin[0]+x+sx), 24-(origin[1]+y+sy), origin[2]+z], "size": [sx,sy,sz], "uv": uv}
            inflate = float(cm.group(3).strip().rstrip("Ff"))
            if inflate:
                cube["inflate"] = inflate
            bone["cubes"].append(cube)
        bones.append(bone)
    if len(bones) != 16 or sum(len(b["cubes"]) for b in bones) != 41:
        raise ValueError(f"Upstream motorcycle model changed: {len(bones)} bones / {sum(len(b['cubes']) for b in bones)} cubes; inspect converter")
    dest = RP / "models/entity/motorcycle.geo.json"
    write_json(dest, geometry(f"geometry.{NS}.motorcycle", bones, 128, 128))
    record(source, dest, "CubeListBuilder hierarchy, PartPose and box-UV conversion")


def make_entities(animation_names):
    customer = entity_base("ordertocook_customer", True, True)
    customer.update({"minecraft:collision_box": {"width": .6, "height": 1.8}, "minecraft:movement": {"value": .22},
        "minecraft:movement.basic": {}, "minecraft:navigation.walk": {"can_walk": True, "can_open_doors": True},
        "minecraft:jump.static": {}, "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False}})
    props = {f"{NS}:stage": {"type": "enum", "values": ["waiting","seated","eating","leaving"], "default": "waiting", "client_sync": True},
             f"{NS}:variant": {"type": "int", "range": [0,1], "default": 0, "client_sync": True},
             f"{NS}:action": {"type": "int", "range": [0,7], "default": 0, "client_sync": True}}
    write_entity("customer", customer, props)
    for name in ("storage", "seat"):
        components = entity_base(f"ordertocook_{name}")
        components["minecraft:collision_box"] = {"width": .01, "height": .01}
        if name == "storage":
            components["minecraft:inventory"] = {"inventory_size": 81, "container_type": "inventory", "private": True, "can_be_siphoned_from": False}
        else:
            components["minecraft:rideable"] = {"seat_count": 1, "family_types": ["player", "ordertocook_customer"],
                "interact_text": "action.interact.sit", "pull_in_entities": False, "seats": [{"position": [0,0,0], "lock_rider_rotation": 45}]}
        write_entity(name, components)
    motorcycle = entity_base("ordertocook_motorcycle", True, True)
    motorcycle.update({"minecraft:collision_box": {"width": 1.2, "height": 1.2}, "minecraft:movement": {"value": .35},
        "minecraft:movement.basic": {}, "minecraft:input_ground_controlled": {}, "minecraft:jump.static": {},
        "minecraft:variable_max_auto_step": {"base_value":1, "controlled_value":1, "jump_prevented_value":.5625},
        "minecraft:rideable": {"seat_count": 1, "controlling_seat": 0, "crouching_skip_interact": True,
            "family_types": ["player"], "interact_text": "action.interact.ride.horse", "pull_in_entities": False,
            "seats": [{"position": [0,.6,.45]}]},
        "minecraft:inventory": {"inventory_size": 54, "container_type": "inventory", "private": True, "can_be_siphoned_from": False}})
    write_entity("motorcycle", motorcycle, {
        f"{NS}:color": {"type":"int","range":[0,3],"default":0,"client_sync":True},
        f"{NS}:light": {"type":"bool","default":True,"client_sync":True}})
    make_motorcycle_geo()
    for original, short in (("drive_idle", "customer"), ("drive_idle_alex", "customer_slim")):
        source = ASSETS / "geo" / (original + ".geo.json")
        dest = RP / "models/entity" / (short + ".geo.json")
        write_json(dest, normalize_geo(source, f"geometry.{NS}.{short}"))
        record(source, dest, "Geometry identifier and version normalization")
    write_json(RP / "models/entity/invisible.geo.json", geometry(f"geometry.{NS}.invisible", [{"name":"root", "pivot":[0,0,0]}]))
    anims = {"eating": animation_names[("npc_transition","npc_eat&scale")], "walk": f"animation.{NS}.customer.walk"}
    for index in range(1,5):
        anims[f"waiting{index}"] = animation_names[("npc",f"customer_wait_{index}")]
        anims[f"seated{index}"] = animation_names[("npc",f"customer_sit_{index}")]
    # The original waiting/seated clips are once-off in Java's controller; the
    # Bedrock controller cycles back through reset to preserve their duration.
    write_json(RP / "animations/runtime.animation.json", {"format_version":"1.8.0","animations":{
        f"animation.{NS}.customer.walk": {"loop":True, "bones":{
            "right_leg":{"rotation":["math.cos(q.modified_distance_moved * 38.17) * 28",0,0]},
            "left_leg":{"rotation":["-math.cos(q.modified_distance_moved * 38.17) * 28",0,0]},
            "right_arm":{"rotation":["-math.cos(q.modified_distance_moved * 38.17) * 14",0,0]},
            "left_arm":{"rotation":["math.cos(q.modified_distance_moved * 38.17) * 14",0,0]}}},
        f"animation.{NS}.motorcycle.drive": {"loop":True,"bones":{
            "front_t":{"rotation":["q.modified_distance_moved * -114.6",0,0]},
            "rear_t":{"rotation":["q.modified_distance_moved * -114.6",0,0]}}}}})
    stages = {}
    for stage in ("waiting","seated","eating","leaving"):
        clip = "walk" if stage == "leaving" else stage
        transitions = [{other: f"q.property('{NS}:stage') == '{other}'"} for other in ("waiting","seated","eating","leaving") if other != stage]
        if stage != "leaving":
            transitions.append({stage+"_reset":"q.all_animations_finished"})
            stages[stage+"_reset"] = {"transitions":[{stage:"1.0"}]}
        clips = [{f"{stage}{index+1}":f"math.mod(q.property('{NS}:action'), 4) == {index}"} for index in range(4)] if stage in ("waiting","seated") else [clip]
        stages[stage] = {"animations":clips,"blend_transition":.15,"transitions":transitions}
    write_json(RP / "animation_controllers/customer.animation_controllers.json", {"format_version":"1.10.0","animation_controllers":{
        f"controller.animation.{NS}.customer":{"initial_state":"waiting","states":stages}}})
    anims["controller"] = f"controller.animation.{NS}.customer"
    write_json(RP / "entity/customer.entity.json", {"format_version":"1.10.0","minecraft:client_entity":{"description":{
        "identifier":f"{NS}:customer", "materials":{"default":"entity_alphatest"},
        "textures":{"wide":f"textures/{NS}/entity/otc_zombie_custom","slim":f"textures/{NS}/entity/otc_zombie_custom2"},
        "geometry":{"wide":f"geometry.{NS}.customer","slim":f"geometry.{NS}.customer_slim"},
        "animations":anims,"scripts":{"animate":["controller"]},"render_controllers":[f"controller.render.{NS}.customer"],
        "spawn_egg":{"base_color":"c89d5a","overlay_color":"f3e3ca"}}}})
    for name in ("seat","storage"):
        write_json(RP / "entity" / (name + ".entity.json"), {"format_version":"1.10.0","minecraft:client_entity":{"description":{
            "identifier":f"{NS}:{name}","materials":{"default":"entity_alphatest"},
            "textures":{"default":f"textures/{NS}/entity/otc_zombie_custom"},"geometry":{"default":f"geometry.{NS}.invisible"},
            "render_controllers":[f"controller.render.{NS}.helper"]}}})
    write_json(RP / "entity/motorcycle.entity.json", {"format_version":"1.10.0","minecraft:client_entity":{"description":{
        "identifier":f"{NS}:motorcycle","materials":{"default":"entity_alphatest","light":"entity_emissive_alpha"},
        "textures":{"white":f"textures/{NS}/entity/motorcycle","red":f"textures/{NS}/entity/electric_motorcycle_red",
            "blue":f"textures/{NS}/entity/electric_motorcycle_blue","yellow":f"textures/{NS}/entity/electric_motorcycle_yellow",
            "light":f"textures/{NS}/entity/electric_motorcycle_light_emissive"},"geometry":{"default":f"geometry.{NS}.motorcycle"},
        "animations":{"drive":f"animation.{NS}.motorcycle.drive"},"scripts":{"animate":["drive"]},
        "render_controllers":[f"controller.render.{NS}.motorcycle",{f"controller.render.{NS}.motorcycle_light":f"q.property('{NS}:light')"}],
        "spawn_egg":{"base_color":"efe3d2","overlay_color":"bd4c37"}}}})
    write_json(RP / "render_controllers/ordertocook.render_controllers.json", {"format_version":"1.10.0","render_controllers":{
        f"controller.render.{NS}.customer":{"arrays":{"textures":{"Array.skins":["Texture.wide","Texture.slim"]},
            "geometries":{"Array.models":["Geometry.wide","Geometry.slim"]}},
            "geometry":f"Array.models[q.property('{NS}:variant')]","materials":[{"*":"Material.default"}],"textures":[f"Array.skins[q.property('{NS}:variant')]"]},
        f"controller.render.{NS}.helper":{"geometry":"Geometry.default","materials":[{"*":"Material.default"}],"textures":["Texture.default"]},
        f"controller.render.{NS}.motorcycle":{"arrays":{"textures":{"Array.colors":["Texture.white","Texture.red","Texture.blue","Texture.yellow"]}},
            "geometry":"Geometry.default","materials":[{"*":"Material.default"}],"textures":[f"Array.colors[q.property('{NS}:color')]"]},
        f"controller.render.{NS}.motorcycle_light":{"geometry":"Geometry.default","materials":[{"*":"Material.light"}],"textures":["Texture.light"]}}})


def recipe(name, pattern, key, output=None, count=1):
    write_json(BP / "recipes" / (name + ".json"), {"format_version":"1.20.10","minecraft:recipe_shaped":{
        "description":{"identifier":f"{NS}:{name}"},"tags":["crafting_table"],"pattern":pattern,
        "key":{k:{"item":v} for k,v in key.items()},"unlock":{"context":"AlwaysUnlocked"},
        "result":{"item":output or f"{NS}:{name}","count":count}}})


def make_recipes():
    recipe("guide", ["BP"], {"B":"minecraft:book","P":"minecraft:paper"})
    recipe("order_machine", ["III","PRP","III"], {"I":"minecraft:iron_ingot","P":"minecraft:paper","R":"minecraft:redstone"})
    recipe("board", ["PPP","SSS"], {"P":"minecraft:paper","S":"minecraft:stick"})
    recipe("countertop", ["III","PPP"], {"I":"minecraft:iron_ingot","P":"minecraft:oak_planks"},count=2)
    recipe("shelf", ["PPP","SSS"], {"P":"minecraft:oak_planks","S":"minecraft:stick"})
    recipe("plate_shelf", ["P P","III"], {"P":"minecraft:oak_planks","I":"minecraft:iron_ingot"})
    recipe("washingtable", ["I I","IBI","PPP"], {"I":"minecraft:iron_ingot","B":"minecraft:bucket","P":"minecraft:oak_planks"})
    recipe("chair", ["P  ","PPP","S S"], {"P":"minecraft:oak_planks","S":"minecraft:stick"},count=2)
    recipe("clean_plate", ["Q Q"," Q "], {"Q":"minecraft:quartz"},count=4)
    source = SOURCE / "common/src/main/resources/data/ordertocook/recipes/otc_upgrade_box.json"
    original = read_json(source)
    recipe("otc_upgrade_box", original["pattern"], {k:v["item"] for k,v in original["key"].items()},
           original["result"]["item"], original["result"].get("count", 1))
    record(source, BP / "recipes/otc_upgrade_box.json", "Java shaped recipe converted to Bedrock; original ingredients and result retained")


def make_textures_and_sounds():
    terrain = {}
    for source in sorted((ASSETS / "textures").rglob("*.png")):
        rel = source.relative_to(ASSETS / "textures")
        dest = RP / "textures" / NS / rel
        copy_asset(source, dest)
        if rel.parts[0] in ("block", "item"):
            tex = str(rel.with_suffix(""))
            terrain[texture_tile(NS + ":" + tex)] = {"textures": f"textures/{NS}/{tex}"}
    # Bedrock emissive materials use alpha to encode emissiveness. The Java
    # light layer is fully opaque at nine lamp texels; preserve its RGB/mask
    # and lower only those alpha values for the native emissive overlay.
    light_source = ASSETS / "textures/entity/electric_motorcycle_light.png"
    light = Image.open(light_source).convert("RGBA")
    light.putalpha(light.getchannel("A").point(lambda a: 64 if a else 0))
    light_dest = RP / "textures" / NS / "entity/electric_motorcycle_light_emissive.tga"
    light.save(light_dest)
    record(light_source, light_dest, "Original lamp RGB and transparency mask; nonzero alpha encoded as 64 for Bedrock emissiveness")
    frames = [Image.open(ASSETS / "textures/block" / f"stove_fire_{n}.png").convert("RGBA") for n in range(4)]
    if len({im.size for im in frames}) != 1:
        raise ValueError("Stove animation frame sizes differ")
    sheet = Image.new("RGBA", (frames[0].width,frames[0].height*4))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (0,index*frame.height))
    dest = RP / "textures" / NS / "block/stove_fire_flipbook.png"
    sheet.save(dest)
    for index in range(4):
        record(ASSETS / "textures/block" / f"stove_fire_{index}.png", dest, "Four original frames vertically concatenated; no pixel repainting")
    terrain[f"{NS}_stove_lit"] = {"textures": f"textures/{NS}/block/stove_fire_0"}
    write_json(RP / "textures/terrain_texture.json", {"resource_pack_name":"Order To Cook Unofficial","texture_name":"atlas.terrain","padding":8,"num_mip_levels":4,"texture_data":terrain})
    write_json(RP / "textures/flipbook_textures.json", [{"flipbook_texture":f"textures/{NS}/block/stove_fire_flipbook","atlas_tile":f"{NS}_stove_lit","ticks_per_frame":2,"blend_frames":False}])
    for source in sorted((ASSETS / "sounds").rglob("*.ogg")):
        copy_asset(source, RP / "sounds" / NS / source.relative_to(ASSETS / "sounds"))
    sounddefs = {}
    for name, spec in read_json(ASSETS / "sounds.json").items():
        sounddefs[f"{NS}:{name}"] = {"category":"block","sounds":["sounds/"+NS+"/"+s.split(":",1)[1] for s in spec["sounds"]]}
    write_json(RP / "sounds/sound_definitions.json", {"format_version":"1.14.0","sound_definitions":sounddefs})
    record(ASSETS / "sounds.json", RP / "sounds/sound_definitions.json", "Original sound event aliases registered in the Bedrock sound schema")
    block_sounds = {"format_version":"1.1.0"}
    for name in ("order_machine","countertop","washingtable","chair","shelf","plate_shelf","takeout_bag","food_plate_display","board","dishwasher","refrigerator","stove"):
        block_sounds[f"{NS}:{name}"]={"sound":"wood" if name in ("chair","shelf","plate_shelf","board") else "metal"}
    write_json(RP / "blocks.json", block_sounds)
    copy_asset(ASSETS / "icon.png", RP / "pack_icon.png")
    copy_asset(ASSETS / "icon.png", BP / "pack_icon.png")


def preserve_imported_geometry():
    for source in sorted((ASSETS / "geo").rglob("*.json")):
        name = source.relative_to(ASSETS / "geo").as_posix().replace(".geo.json", "").replace("/", "_")
        dest = RP / "models/entity/imported" / (name + ".geo.json")
        write_json(dest, normalize_geo(source, f"geometry.{NS}.imported.{name}"))
        record(source, dest, "Full upstream bone/UV archive; unique identifier, valid version, nonnegative dimensions")


def make_languages():
    traditional = {"order_machine":"訂單機","countertop":"料理檯","washingtable":"洗碗檯","chair":"椅子","shelf":"包裝架",
        "plate_shelf":"餐盤架","takeout_bag":"外賣袋","food_plate_display":"已擺放的餐盤","board":"菜單板","dishwasher":"洗碗機",
        "refrigerator":"冰箱","stove":"爐灶","clean_plate":"乾淨餐盤","dirty_plate":"髒餐盤","food_plate":"裝盤料理",
        "motorcycle":"外賣電單車","helmet":"外賣頭盔","order":"訂單","otc_upgrade_box":"設備升級工具箱","guide":"Order To Cook 使用指南","controller":"餐廳控制器"}
    for value in (1,5,20,100,10000):
        traditional[f"chef_coin_{value}"]=f"廚師幣（{value}）"
    english_extra = {"guide":"Order To Cook Guide", "controller":"Restaurant Controller"}
    for src_name, out_name in (("en_us","en_US"),("zh_cn","zh_CN"),("zh_cn","zh_TW")):
        lang = read_json(ASSETS / "lang" / (src_name + ".json"))
        lines=["## Order To Cook — source translations by breezeth-CN; Bedrock additions by this port.","pack.name=Order To Cook Unofficial","pack.description=Unofficial Bedrock adaptation of Order To Cook."]
        for path in sorted((BP / "blocks").glob("*.json")):
            name=path.stem
            value=traditional[name] if out_name == "zh_TW" else lang.get(f"block.{NS}.{name}", name.replace("_"," ").title())
            lines.append(f"tile.{NS}:{name}.name={value}")
        for path in sorted((BP / "items").glob("*.json")):
            name=path.stem
            fallback=english_extra.get(name,name.replace("_"," ").title())
            value=traditional[name] if out_name == "zh_TW" else lang.get(f"item.{NS}.{name}",fallback if out_name == "en_US" else traditional[name])
            lines.append(f"item.{NS}:{name}.name={value}")
        lines += [f"entity.{NS}:customer.name="+("Customer" if out_name=="en_US" else "顧客"), f"entity.{NS}:motorcycle.name="+("Delivery Motorcycle" if out_name=="en_US" else "外賣電單車")]
        dest=RP / "texts" / (out_name+".lang")
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text("\n".join(lines)+"\n",encoding="utf-8")
        record(ASSETS / "lang" / (src_name + ".json"), dest, "Bedrock localization keys; additional port labels and Traditional Chinese translations")
    write_json(RP / "texts/languages.json",["en_US","zh_CN","zh_TW"])


def main():
    global SOURCE, ASSETS, OUT, BP, RP
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source",type=Path,default=ROOT / "upstream/reference",help="Bundled upstream/reference source subset (default), or a local OrdertoCook checkout")
    parser.add_argument("--output",type=Path,default=ROOT / "runtime")
    args=parser.parse_args()
    SOURCE=args.source.resolve(); ASSETS=SOURCE / ASSET_REL; OUT=args.output.resolve(); BP=OUT / "BP"; RP=OUT / "RP"
    if not (SOURCE / "LICENSE.txt").is_file() or not ASSETS.is_dir():
        parser.error("Expected OrdertoCook source inputs with LICENSE.txt and common resources")
    metadata = SOURCE / "UPSTREAM.json"
    if metadata.is_file():
        revision = read_json(metadata).get("commit")
        if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-fA-F]{40}", revision):
            parser.error("UPSTREAM.json must contain the full 40-character upstream commit")
    else:
        try:
            revision=subprocess.check_output(["git","rev-parse","HEAD"],cwd=SOURCE,text=True).strip()
        except (OSError,subprocess.CalledProcessError):
            revision="unknown"
    make_textures_and_sounds()
    animations=convert_animations()
    make_blocks()
    make_items()
    make_helmet_attachable()
    make_entities(animations)
    preserve_imported_geometry()
    make_recipes()
    make_languages()
    write_json(OUT / "asset_conversion_manifest.json", {"upstream":"https://github.com/breezeth-CN/OrdertoCook","revision":revision,
        "license":"GPL-3.0", "assets":PROVENANCE,
        "adaptations":["Two-part refrigerator with clipped UVs and synchronous door poses", "GeckoLib easing replaced by native Bedrock interpolation", "Static dishwasher phase poses; original animation clips retained", "Default customer skins prebundled; runtime web skin lookup not available", "Source-model inventory thumbnails", "Early-game furniture recipes added for survival access"]})
    print(f"Converted {len(PROVENANCE)} source resource references; {len(list(BP.rglob('*.json')))} BP JSON, {len(list(RP.rglob('*.json')))} RP JSON")


if __name__ == "__main__":
    main()
