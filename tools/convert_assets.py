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
NATIVE_CONTAINER_VERSION = "1.26.60"
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


def normalize_signed_cube(cube):
    """Keep the physical face/texel mapping when making signed sizes legal.

    The source uses negative X/Z cubes for the dishwasher/fridge inner walls.
    Taking abs(size) alone moves their opaque rear face over the open front.
    These face/UV reflections follow GeckoLib's VertexSet/GeoQuad ordering,
    which is also used by Blockbench's Bedrock codec.
    """
    for axis in range(3):
        if cube["size"][axis] >= 0:
            continue
        cube["origin"][axis] += cube["size"][axis]
        cube["size"][axis] *= -1
        if not isinstance(cube.get("uv"), dict):
            raise ValueError("Signed source cubes require explicit per-face UVs")
        opposite = (("east", "west"), ("up", "down"), ("north", "south"))[axis]
        faces = cube["uv"]
        cube["uv"] = {}
        for name, face in faces.items():
            target = opposite[1-opposite.index(name)] if name in opposite else name
            flip = 0 if axis == 0 or (axis == 2 and name not in ("up", "down")) else 1
            # For quarter-turned UVs, the reflected texture axis is exchanged.
            if face.get("uv_rotation", 0) % 180:
                flip = 1-flip
            uv = copy.deepcopy(face)
            uv["uv"][flip] += uv["uv_size"][flip]
            uv["uv_size"][flip] *= -1
            cube["uv"][target] = uv
    return cube


def normalize_geo(source: Path, identifier: str):
    g = copy.deepcopy(read_json(source))
    g["format_version"] = GEOMETRY_VERSION
    for entry in g["minecraft:geometry"]:
        entry["description"]["identifier"] = identifier
        for bone in entry["bones"]:
            for cube in bone.get("cubes", []):
                normalize_signed_cube(cube)
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


def split_fridge_geo(g, half):
    """Split the cabinet at Y=16, but keep each entire door on one block.

    The lower door ends at Y=19.5. Clipping it at the cabinet seam makes
    independently opening compartments tear that door into two moving pieces.
    Its complete 19.5-pixel mesh still fits the stable block geometry bounds.
    """
    result = copy.deepcopy(g)
    lower, upper = (0, 16) if half == "lower" else (16, 32)
    offset = 0 if half == "lower" else 16
    for bone in result["minecraft:geometry"][0]["bones"]:
        kept = []
        for cube in bone.get("cubes", []):
            y0, y1 = cube["origin"][1], cube["origin"][1]+cube["size"][1]
            door_half = {"bone3": "lower", "bone2": "upper"}.get(bone["name"])
            if door_half and door_half != half:
                continue
            a, b = (y0, y1) if door_half else (max(y0, lower), min(y1, upper))
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
    return rounded(result)


def sample_number(value, seconds):
    """Evaluate only the single numeric sine channel present in the source."""
    if isinstance(value, (int, float)):
        return float(value)
    match = re.fullmatch(r"math\.sin\(query\.anim_time\s*\*\s*([\d.]+)\)\s*\*\s*([\d.]+)", value)
    if not match:
        raise ValueError(f"Unsupported baked animation expression: {value!r}")
    return math.sin(math.radians(seconds*float(match.group(1))))*float(match.group(2))


def easing_fraction(kind, fraction, args=()):
    """GeckoLib 4 curves used by the pinned source, including easingArgs.

    Verified against core/animation/EasingType.java at GeckoLib 7d6f32d.
    In particular its elastic/bounce are not the usual easings.net formulas.
    """
    t = max(0.0, min(1.0, fraction))
    if t == 1 or kind in (None, "linear", "none"):
        return t
    if kind == "step":
        steps = int(args[0]) if args else 2
        if steps < 2:
            raise ValueError("GeckoLib step easing requires at least two steps")
        return min(steps-1, math.floor(t*steps))/steps
    def elastic(value):
        amount = args[0] if args else 1
        return 1-math.cos(value*math.pi/2)**3*math.cos(value*amount*math.pi)
    def bounce(value):
        amount = args[0] if args else 0.5
        return min(121/16*value**2,
                   121/4*amount*(value-6/11)**2+1-amount,
                   121*amount**2*(value-9/11)**2+1-amount**2,
                   484*amount**3*(value-10.5/11)**2+1-amount**3)
    for family, curve in (("Elastic", elastic), ("Bounce", bounce)):
        if kind == "easeIn"+family:
            return curve(t)
        if kind == "easeOut"+family:
            return 1-curve(1-t)
        if kind == "easeInOut"+family:
            return curve(t*2)/2 if t < 0.5 else 1-curve((1-t)*2)/2
    raise ValueError(f"Unsupported source easing: {kind!r}")


def sample_channel(channel, seconds, default):
    """Sample source vectors, honoring the destination keyframe's easing."""
    if channel is None:
        return list(default)
    if isinstance(channel, dict) and "vector" in channel:
        channel = channel["vector"]
    if isinstance(channel, (list, int, float)):
        vector = channel if isinstance(channel, list) else [channel]*3
        return [sample_number(value, seconds) for value in vector]
    keys = sorted((float(time), value) for time, value in channel.items())
    if not keys:
        return list(default)
    for index, (time, value) in enumerate(keys):
        if seconds <= time:
            if index == 0:
                return sample_channel(value, seconds, default)
            previous_time, previous = keys[index-1]
            fraction = (seconds-previous_time)/(time-previous_time)
            if isinstance(value, dict):
                fraction = easing_fraction(value.get("easing"), fraction, value.get("easingArgs", ()))
            a = sample_channel(previous, seconds, default)
            b = sample_channel(value, seconds, default)
            return [x+(y-x)*fraction for x, y in zip(a, b)]
    return sample_channel(keys[-1][1], seconds, default)


def closest_cuboid_axes(matrix):
    """Polar rotation of a positive-scale affine matrix, without dependencies.

    Static Bedrock cubes cannot contain a shear. R * diag(R^T * M) preserves
    the closest rigid axes and their scale; only off-diagonal shear remains.
    """
    rotation = [row[:] for row in matrix]
    for _ in range(16):
        a,b,c = rotation
        cofactors = [[b[1]*c[2]-b[2]*c[1], b[2]*c[0]-b[0]*c[2], b[0]*c[1]-b[1]*c[0]],
                     [a[2]*c[1]-a[1]*c[2], a[0]*c[2]-a[2]*c[0], a[1]*c[0]-a[0]*c[1]],
                     [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]]
        determinant = sum(a[i]*cofactors[0][i] for i in range(3))
        updated = [[(rotation[i][j]+cofactors[i][j]/determinant)/2 for j in range(3)] for i in range(3)]
        error = max(abs(updated[i][j]-rotation[i][j]) for i in range(3) for j in range(3))
        rotation = updated
        if error < 1e-12:
            break
    scale = [sum(rotation[k][i]*matrix[k][i] for k in range(3)) for i in range(3)]
    y = math.asin(max(-1.0,min(1.0,-rotation[2][0])))
    if abs(math.cos(y)) > 1e-8:
        x = math.atan2(rotation[2][1],rotation[2][2])
        z = math.atan2(rotation[1][0],rotation[0][0])
    else:
        x = 0
        z = math.atan2(-rotation[0][1],rotation[1][1])
    return [math.degrees(value) for value in (-x,y,-z)], scale


def preserve_scaled_descendants(original, baked, clip, seconds):
    """Correct inherited scale after rotations using each cube's full affine.

    This keeps rotated door dimensions and translations faithful instead of
    applying a parent's Z squash in the child's already-rotated axes. Per-axis
    deformation is exact for orthogonal transformed cubes; remaining shear is
    approximated by the closest cuboid and measured in the validation report.
    """
    source = {bone["name"]: bone for bone in original["minecraft:geometry"][0]["bones"]}
    target = {bone["name"]: bone for bone in baked["minecraft:geometry"][0]["bones"]}
    channels = {}
    for name,bone in source.items():
        tracks = clip.get("bones", {}).get(name,{})
        channels[name] = (sample_channel(tracks.get("position"),seconds,[0]*3),
                          sample_channel(tracks.get("scale"),seconds,[1]*3),
                          [a+b for a,b in zip(bone.get("rotation",[0]*3),sample_channel(tracks.get("rotation"),seconds,[0]*3))])
    for name,bone in source.items():
        chain = [name]
        while "parent" in source[chain[-1]]:
            chain.append(source[chain[-1]]["parent"])
        if not any(max(channels[key][1])-min(channels[key][1]) > 1e-7 for key in chain):
            continue
        for cube,output in zip(bone.get("cubes",[]),target[name].get("cubes",[])):
            def converted(point):
                point = geometry_transform3(point,cube.get("rotation",[0]*3),cube.get("pivot",[0]*3))
                for key in chain:
                    position,scale,rotation = channels[key]; pivot = source[key]["pivot"]
                    point = [pivot[i]+(point[i]-pivot[i])*scale[i] for i in range(3)]
                    point = geometry_transform3(point,rotation,pivot)
                    point = [a+b for a,b in zip(point,position)]
                # Express exact world vertices in the baked bone's rigid frame.
                for key in reversed(chain):
                    node = target[key]
                    for axis in (2,1,0):
                        inverse = [0]*3; inverse[axis] = -node.get("rotation",[0]*3)[axis]
                        point = geometry_transform3(point,inverse,node["pivot"])
                return point
            center = [a+b/2 for a,b in zip(cube["origin"],cube["size"])]
            transformed = converted(center)
            axes = []
            for axis in range(3):
                endpoint = center[:]; endpoint[axis] += 1
                axes.append([a-b for a,b in zip(converted(endpoint),transformed)])
            rotation,scale = closest_cuboid_axes([[axes[j][i] for j in range(3)] for i in range(3)])
            size = [a*b for a,b in zip(cube["size"],scale)]
            output.update({"origin":[a-b/2 for a,b in zip(transformed,size)],"size":size,
                           "pivot":transformed,"rotation":rotation})


def bake_pose(g, clip, seconds, identifier):
    """Bake source bone motion, including per-axis squash/stretch.

    Static cuboids retain dimensions, UVs, pivots and the source rotations.
    Nonuniform scales are applied to the complete descendant subtree; local
    translations inherit their ancestor scales. The full source affine then
    corrects rotated descendants to the closest cuboid. Only residual shear,
    which static cuboid geometry cannot encode, remains approximate. No texture
    pixels are redrawn.
    """
    result = copy.deepcopy(g)
    entry = result["minecraft:geometry"][0]
    entry["description"]["identifier"] = identifier
    bones = entry["bones"]
    by_name = {bone["name"]: bone for bone in bones}

    def under(bone, ancestor):
        while True:
            if bone["name"] == ancestor:
                return True
            if "parent" not in bone:
                return False
            bone = by_name[bone["parent"]]

    inherited_scales = {}
    for bone in bones:
        channels = clip.get("bones", {}).get(bone["name"], {})
        rotation = sample_channel(channels.get("rotation"), seconds, [0, 0, 0])
        bone["rotation"] = [a+b for a, b in zip(bone.get("rotation", [0, 0, 0]), rotation)]
        position = sample_channel(channels.get("position"), seconds, [0, 0, 0])
        scale = sample_channel(channels.get("scale"), seconds, [1, 1, 1])
        inherited = inherited_scales.get(bone.get("parent"), [1, 1, 1])
        position = [a*b for a, b in zip(position, inherited)]
        inherited_scales[bone["name"]] = [a*b for a, b in zip(scale, inherited)]
        pivot = list(bone["pivot"])
        for child in bones:
            if not under(child, bone["name"]):
                continue
            child["pivot"] = [pivot[i]+(child["pivot"][i]-pivot[i])*scale[i]+position[i] for i in range(3)]
            if max(scale) <= 0.00001:
                child["cubes"] = []
            for cube in child.get("cubes", []):
                cube["origin"] = [pivot[i]+(cube["origin"][i]-pivot[i])*scale[i]+position[i] for i in range(3)]
                cube["size"] = [size*factor for size, factor in zip(cube["size"], scale)]
                if "pivot" in cube:
                    cube["pivot"] = [pivot[i]+(cube["pivot"][i]-pivot[i])*scale[i]+position[i] for i in range(3)]
    preserve_scaled_descendants(g, result, clip, seconds)
    return rounded(result)


def geometry_bounds(g):
    """Measure transformed corners, including every cube and parent rotation."""
    entry = g["minecraft:geometry"][0]
    bones = {bone["name"]: bone for bone in entry["bones"]}
    points = []
    for bone in bones.values():
        for cube in bone.get("cubes", []):
            for factors in itertools.product((0, 1), repeat=3):
                point = [cube["origin"][axis]+cube["size"][axis]*factors[axis] for axis in range(3)]
                point = geometry_transform3(point, cube.get("rotation", [0, 0, 0]), cube.get("pivot", [0, 0, 0]))
                current = bone
                while True:
                    point = geometry_transform3(point, current.get("rotation", [0, 0, 0]), current["pivot"])
                    if "parent" not in current:
                        break
                    current = bones[current["parent"]]
                points.append(point)
    return ([min(point[axis] for point in points) for axis in range(3)],
            [max(point[axis] for point in points) for axis in range(3)])


def assert_block_bounds(g):
    # Native content-log envelope (-0.875..1.875 blocks) converted to model
    # pixels: X/Z are centred at 8, whereas Y starts at the block bottom.
    # An epsilon must not bless a serialized corner outside this envelope.
    low, high = geometry_bounds(g)
    minimum, maximum = (-22, -14, -22), (22, 30, 22)
    if any(high[i]-low[i] > 30 or low[i] < minimum[i] or high[i] > maximum[i] for i in range(3)):
        raise ValueError(f"Baked block pose exceeds stable bounds: {g['minecraft:geometry'][0]['description']['identifier']} {low} {high}")


def bound_fridge_swing(g, half):
    """Keep the complete door's sampled elastic sweep inside native bounds.

    The source door can exceed the 30px extent by under 0.126px at two points:
    depth near a right angle, and X near the upper door's elastic overshoot.
    Translate only that complete door by the excess; never resize it or crop
    its UV. Endpoints need no correction. The 1/1024px guard survives rounding.
    """
    low, high = geometry_bounds(g)
    guard = 1 / 1024
    correction = [0.0, 0.0, 0.0]
    correction[2] = max(0.0, high[2]-low[2]-(30-guard), (-22+guard)-low[2])
    correction[0] = -max(0.0, high[0]-low[0]-(30-guard), high[0]-(22-guard))
    if max(abs(value) for value in correction) > 0.126:
        raise ValueError(f"Unexpected refrigerator swing bound correction: {correction}")
    if any(correction):
        for bone in g["minecraft:geometry"][0]["bones"]:
            if bone["name"] == ("bone2" if half == "upper" else "bone3"):
                bone["pivot"] = [a+b for a, b in zip(bone["pivot"], correction)]
                for cube in bone.get("cubes", []):
                    cube["origin"] = [a+b for a, b in zip(cube["origin"], correction)]
                    if "pivot" in cube:
                        cube["pivot"] = [a+b for a, b in zip(cube["pivot"], correction)]
    return rounded(g)


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
            if family == "npc_transition":
                # Seek to the authoritative action phase when an actor enters
                # view/reloads. Otherwise Bedrock restarts a six-second eating
                # clip although the server may remove the actor a moment later.
                length = body["animation_length"]
                body["anim_time_update"] = (f"math.min({length}, math.max(q.anim_time + q.delta_time, "
                                            f"q.property('{NS}:action_elapsed')))")
                body["loop"] = "hold_on_last_frame"
            elif family == "food_plate_placed":
                body["anim_time_update"] = (f"math.min(0.5, math.max(q.anim_time + q.delta_time, "
                                            f"q.property('{NS}:placement_age')))")
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


def block_definition(name, base_geo, materials, states=None, variants=(), collision=True, selection=None,
                     native_container=None, hidden=False, loot_table=None):
    description = {"identifier": f"{NS}:{name}", "menu_category": {"category": "construction"},
                   "traits": {"minecraft:placement_direction": {"enabled_states": ["minecraft:cardinal_direction"], "y_rotation_offset": 180}}}
    if hidden:
        description["menu_category"] = {"category": "none", "is_hidden_in_commands": True}
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
        "minecraft:loot": loot_table if loot_table is not None else f"loot_tables/blocks/{name}.json",
        "minecraft:destruction_particles": {"texture": particle, "particle_count": 50},
        "minecraft:light_dampening": 0, "minecraft:map_color": "#9b9286",
        "minecraft:movable": {"movement_type": "immovable"}, f"{NS}:interact": {}}
    if native_container is not None:
        components["minecraft:block_entity"] = {"dynamic_properties": True, "container": native_container}
    permutations = [{"condition": f"q.block_state('minecraft:cardinal_direction') == '{direction}'",
                     "components": {"minecraft:transformation": {"rotation": [0, rotation, 0]}}}
                    for direction, rotation in (("north", 0), ("south", 180), ("west", 90), ("east", -90))]
    permutations.extend(variants)
    version = NATIVE_CONTAINER_VERSION if native_container is not None else BLOCK_VERSION
    result = {"format_version": version, "minecraft:block": {"description": description, "components": components, "permutations": permutations}}
    write_json(BP / "blocks" / (name + ".json"), result)
    drop = "dirty_plate" if name == "food_plate_display" else name
    loot = {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:{drop}", "weight": 1}]}]}
    if name in ("food_plate_display", "takeout_bag", "board", "order_machine"):
        loot = {"pools": []}  # Script returns the unique signed stack, never an unbound duplicate.
    if loot_table is None:
        write_json(BP / "loot_tables" / "blocks" / (name + ".json"), loot)


def simple_block(name, model, collision=True, selection=None):
    g, mats = convert_java_model(NS + ":block/" + model, f"geometry.{NS}.{name}")
    emit_geo(name, g)
    block_definition(name, g["minecraft:geometry"][0]["description"]["identifier"], mats, collision=collision, selection=selection)


def make_blocks():
    simple_block("board", "board", False, {"origin": [-8, 0, 4], "size": [16, 16, 4]})
    simple_block("countertop", "countertop")
    simple_block("chair", "chair", {"origin": [-5, 0, -5], "size": [10, 8, 10]}, {"origin": [-5, 0, -5], "size": [10, 16, 10]})
    # Java's placed bag has an empty block model and a complete Geo renderer.
    # Keep frame zero settled for existing worlds; frames 1..10 play maked at
    # one source tick each. Only an active placement requests native block ticks.
    bag_source = ASSETS / "geo/block/takeout_bag_placed.geo.json"
    bag_animation = ASSETS / "animations/takeout_bag_placed.animation.json"
    bag = normalize_geo(bag_source, f"geometry.{NS}.takeout_bag_source")
    bag_clip = read_json(bag_animation)["animations"]["maked"]
    bag_tile = texture_tile(f"{NS}:block/takeout_bag_placed")
    mats = {"*": {"texture": bag_tile, "render_method": "alpha_test", "ambient_occlusion": False}}
    variants = []
    for frame in range(11):
        name = "takeout_bag" if frame == 0 else f"takeout_bag_{frame}"
        seconds = .5 if frame == 0 else (frame-1)/20
        g = bake_pose(bag, bag_clip, seconds, f"geometry.{NS}.{name}")
        assert_block_bounds(g)
        identifier = emit_geo(name, g)
        for source in (bag_source, bag_animation):
            record(source, RP / "models/blocks" / f"{name}.geo.json", "Complete original placed-bag Geo and material; original 0.5s maked rise/scale/wobble sampled every tick; frame zero is the settled endpoint")
        variants.append({"condition": state_condition({"frame": frame}), "components": {"minecraft:geometry": identifier}})
    variants.append({"condition": f"q.block_state('{NS}:frame') > 0", "components": {
        "minecraft:tick": {"interval_range": [1, 1], "looping": True}, f"{NS}:bag_motion": {}}})
    block_definition("takeout_bag", f"geometry.{NS}.takeout_bag", mats, {"frame": list(range(11))}, variants,
                     False, {"origin": [-5, 0, -5], "size": [10, 10, 10]})
    for name, state, maximum in (("shelf", "papers", 10), ("plate_shelf", "plates", 18), ("washingtable", "plates", 10)):
        variants = []
        for count in range(maximum+1):
            extra = (f"{NS}:block/{name}_{count}",) if count else ()
            g, mats = convert_java_model(f"{NS}:block/{name}_idle", f"geometry.{NS}.{name}_{count}", extra)
            identifier = emit_geo(f"{name}_{count}", g)
            variants.append({"condition": state_condition({state: count}), "components": {"minecraft:geometry": identifier, "minecraft:material_instances": mats}})
        coll = True if name == "washingtable" else {"origin": [-8, 0, 0], "size": [16, 16, 8]}
        block_definition(name, f"geometry.{NS}.{name}_0", mats, {state: list(range(maximum+1))}, variants, coll)
    # Stage zero is drawn by Java's placed-meal renderer. The block fallback
    # retains its terminal geometry; the dining entity plays the actual clip.
    blockstates_source = ASSETS / "blockstates" / "food_plate_display.json"
    blockstates = read_json(blockstates_source)["variants"]
    variants = []
    for stage in range(41):
        spec = blockstates[f"facing=north,stage={stage}"]
        if isinstance(spec, list):
            spec = spec[0]
        if stage == 0:
            source = ASSETS / "geo/block/food_plate_placed.geo.json"
            geometry_id = f"geometry.{NS}.food_plate_display_{stage}"
            g = normalize_geo(source, geometry_id)
            tile = texture_tile(f"{NS}:block/food_plate_placed")
            mats = {"*": {"texture": tile, "render_method": "alpha_test", "ambient_occlusion": False, "face_dimming": True}}
            GEOMETRY_SOURCES[geometry_id] = ([source], "Original placed-meal renderer terminal pose for the static block display")
        else:
            g, mats = convert_java_model(spec["model"], f"geometry.{NS}.food_plate_display_{stage}")
        identifier = emit_geo(f"food_plate_display_{stage}", g)
        variants.append({"condition": state_condition({"stage": stage}), "components": {"minecraft:geometry": identifier, "minecraft:material_instances": mats}})
    block_definition("food_plate_display", f"geometry.{NS}.food_plate_display_0", mats, {"stage": list(range(41))}, variants,
                     False, {"origin": [-6, 0, -6], "size": [12, 5, 12]})
    record(blockstates_source, BP / "blocks/food_plate_display.json", "Original stage1..40 mapping with original placed-meal renderer geometry at stage zero")
    # Fixed Java blockstates are empty; the Geo renderer owns the entire
    # printer. Sample its real 1s neworder rise/squash/wobble, then hold the
    # terminal paper pose until all pending machine orders are taken.
    printer_source = ASSETS / "geo/block/order_machine.geo.json"
    printer_animation = ASSETS / "animations/order_machine.animation.json"
    printer = normalize_geo(printer_source, f"geometry.{NS}.order_machine_source")
    printer_clip = read_json(printer_animation)["animations"]["neworder"]
    printer_tile = texture_tile(f"{NS}:block/order_machine_geo")
    mats = {"*": {"texture": printer_tile, "render_method": "alpha_test", "ambient_occlusion": False}}
    variants = []
    for old in (RP / "models/blocks").glob("order_machine_*.geo.json"):
        if re.fullmatch(r"order_machine_(idle|waiting)_[12]\.geo\.json", old.name):
            old.unlink()
    for mode in ("idle", "printing", "waiting"):
        for frame in (range(16) if mode == "printing" else (0,)):
            name = f"order_machine_{mode}_{frame}"
            clip = {} if mode == "idle" else printer_clip
            seconds = frame/15 if mode == "printing" else 1
            g = bake_pose(printer, clip, seconds, f"geometry.{NS}.{name}")
            if mode == "idle":
                next(bone for bone in g["minecraft:geometry"][0]["bones"] if bone["name"] == "group")["cubes"] = []
            assert_block_bounds(g)
            identifier = emit_geo(name, g)
            for source in (printer_source, printer_animation):
                record(source, RP / "models/blocks" / f"{name}.geo.json", "Complete original Geo printer; original neworder 1s rise/squash/wobble sampled into 16 poses; idle paper hidden and waiting endpoint held")
            condition = {"mode": mode, "frame": frame} if mode == "printing" else {"mode": mode}
            variants.append({"condition": state_condition(condition), "components": {"minecraft:geometry": identifier}})
    block_definition("order_machine", f"geometry.{NS}.order_machine_idle_0", mats,
                     {"mode": ["idle", "printing", "waiting"], "frame": list(range(16))}, variants,
                     {"origin": [-7, 0, -7], "size": [14, 14, 14]})
    # Separate source open/close curves; each complete door belongs to one
    # compartment. Root squash uses each half's closing phase (see adaptations).
    fridge_source = ASSETS / "geo/block/refrigerator.geo.json"
    fridge_animation = ASSETS / "animations/refrigerator.animation.json"
    fridge = normalize_geo(fridge_source, f"geometry.{NS}.refrigerator_source")
    fridge_clips = read_json(fridge_animation)["animations"]
    tile = texture_tile(f"{NS}:block/refrigerator")
    # Format >= 1.26.20 requires a numeric AO exponent; 0 disables the effect.
    mats = {"*": {"texture": tile, "render_method": "alpha_test", "ambient_occlusion": 0}}
    variants = []
    upper_variants = []
    for half, closing, frame in itertools.product(("lower", "upper"), (False, True), range(11)):
        name = f"refrigerator_{half}_{'close_' if closing else ''}{frame}"
        clip = fridge_clips[("up_" if half == "upper" else "down_")+("close" if closing else "open")]
        g = bound_fridge_swing(bake_pose(split_fridge_geo(fridge, half), clip, frame/10, f"geometry.{NS}.{name}"), half)
        assert_block_bounds(g)
        identifier = emit_geo(name, g)
        for source in (fridge_source, fridge_animation):
            record(source, RP / "models/blocks" / f"{name}.geo.json", "Complete independent door; separate GeckoLib elastic opening/bounce closing sampled at 0.1s; signed interior UV preserved; per-half close squash; bounded hinge sweep")
        components = {"minecraft:geometry": identifier}
        if half == "upper":
            components["minecraft:loot"] = "loot_tables/empty.json"
        variant = {"condition": state_condition({"half": half, "closing": closing, "frame": frame}), "components": components}
        variants.append(variant)
        if half == "upper":
            upper_variants.append(variant)
    # block_entity is not allowed in permutations. Two identifiers give each
    # compartment its actual capacity; the old upper state remains migratable.
    block_definition("refrigerator", f"geometry.{NS}.refrigerator_lower_0", mats,
                     {"half": ["lower", "upper"], "open": [False, True], "closing": [False, True], "frame": list(range(11))}, variants,
                     native_container={"slot_count": 54, "title": f"container.{NS}.refrigerator.lower"})
    block_definition("refrigerator_upper", f"geometry.{NS}.refrigerator_upper_0", mats,
                     {"half": ["upper"], "open": [False, True], "closing": [False, True], "frame": list(range(11))}, upper_variants,
                     native_container={"slot_count": 27, "title": f"container.{NS}.refrigerator.upper"},
                     hidden=True, loot_table="loot_tables/empty.json")
    # Shared data keeps script reversal selection tied to the actual baked
    # source angles, rather than duplicating a second easing implementation.
    progress = {mode: [rounded(sample_channel(fridge_clips["down_"+mode]["bones"]["bone3"]["rotation"], frame/10, [0, 0, 0])[1]/-125)
                       for frame in range(11)] for mode in ("open", "close")}
    pose_data = BP / "scripts/appliance_pose_data.js"
    pose_data.parent.mkdir(parents=True, exist_ok=True)
    pose_data.write_text("// SPDX-License-Identifier: GPL-3.0-only\n// Generated from pinned refrigerator.animation.json by tools/convert_assets.py.\n"
                        + "export const FRIDGE_POSE_PROGRESS = " + json.dumps(progress, indent=2) + ";\n", encoding="utf-8")
    record(fridge_animation, pose_data, "Normalized source door angles shared with reversible runtime motion")
    write_json(BP / "loot_tables" / "empty.json", {"pools": []})
    # Source drawer/door keyframes plus the original empty_out preview. Preview
    # is visual phase 6 only; it never becomes a saved washing-machine phase.
    source = ASSETS / "geo/block/dishwasher.geo.json"
    animation_source = ASSETS / "animations/dishwasher.animation.json"
    dishwasher_clips = read_json(animation_source)["animations"]
    base = normalize_geo(source, f"geometry.{NS}.dishwasher")
    tile = texture_tile(f"{NS}:block/dishwasher")
    mats = {"*": {"texture": tile, "render_method": "alpha_test", "ambient_occlusion": False}}
    variants = []
    phase_clips = {0: None, 1: "empty_in", 2: "dirty_in", 3: "washing", 4: "clear_out", 5: "clear_out", 6: "empty_out"}
    # Java DishwasherRenderer: 1 plate -> cube 2, 2 -> cubes 2 and 5,
    # 3+ -> all six. Separate child bones keep the original cube transforms.
    plate_count = f"(q.block_state('{NS}:plates') + 16 * q.block_state('{NS}:plates_high'))"
    visibility = {f"{dish}_{index}": f"{plate_count} >= {1 if index == 2 else 2 if index == 5 else 3}"
                  for dish in ("drity_dish", "clear_dish") for index in range(1, 7)}
    for old in (RP / "models/blocks").glob("dishwasher_[0-5].geo.json"):
        old.unlink()
    for phase in range(7):
        frames = [0] if phase in (0, 5) else range(16)
        for frame in frames:
            clip = dishwasher_clips[phase_clips[phase]] if phase_clips[phase] else {}
            # The 2s wash loop excludes its repeated endpoint; other phases
            # include the exact terminal keyframe, including the open ready pose.
            length = clip.get("animation_length", 0)
            seconds = length if phase == 5 else length*frame/(16 if phase == 3 else 15)
            name = f"dishwasher_{phase}_{frame}"
            g = bake_pose(base, clip, seconds, f"geometry.{NS}.{name}")
            bones = g["minecraft:geometry"][0]["bones"]
            dishes = []
            for bone in bones:
                if bone["name"] == "drity_dish" and phase != 2:
                    bone["cubes"] = []
                if bone["name"] == "clear_dish" and phase not in (4, 5):
                    bone["cubes"] = []
                if bone["name"] in ("drity_dish", "clear_dish"):
                    cubes = bone.get("cubes", [])
                    for index in range(1, 7):
                        dishes.append({"name": f"{bone['name']}_{index}", "parent": bone["name"],
                                       "pivot": list(bone["pivot"]), "cubes": cubes[index-1:index]})
                    bone["cubes"] = []
            bones.extend(dishes)
            assert_block_bounds(g)
            identifier = emit_geo(name, g)
            for original in (source, animation_source):
                record(original, RP / "models/blocks" / f"{name}.geo.json", f"Source phase {phase}, frame {frame}; per-axis squash, signed-cavity UV and count-selected plates; cuboid descendant-shear approximation")
            condition = {"phase": phase} if phase in (0, 5) else {"phase": phase, "frame": frame}
            variants.append({"condition": state_condition(condition), "components": {"minecraft:geometry": {"identifier": identifier, "bone_visibility": visibility}}})
    block_definition("dishwasher", {"identifier": f"geometry.{NS}.dishwasher_0_0", "bone_visibility": visibility}, mats,
                     {"phase": list(range(7)), "plates": list(range(17)), "frame": list(range(16))}, variants)
    g, mats = convert_java_model(f"{NS}:block/stove", f"geometry.{NS}.stove")
    emit_geo("stove", g)
    # Each stove owns its ignition delay, burst and four 8-tick cycle frames.
    # A global atlas flipbook cannot preserve independent ignition/reload times.
    # Java's stove has no block light emission; retain lit only as saved state.
    variants = []
    for frame, texture in enumerate(("stove_fire", *(f"stove_fire_{n}" for n in range(4))), 1):
        frame_mats = copy.deepcopy(mats)
        for material in frame_mats.values():
            if material["texture"] == texture_tile(f"{NS}:block/stove"):
                material["texture"] = texture_tile(f"{NS}:block/{texture}")
        variants.append({"condition": state_condition({"fire_frame": frame}),
                         "components": {"minecraft:material_instances": frame_mats}})
    block_definition("stove", f"geometry.{NS}.stove", mats,
                     {"lit": [False, True], "fire_frame": list(range(6))}, variants)


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


def geometry_transform3(v, rotation, pivot=(0, 0, 0)):
    """Rotate JSON-space geometry using the actual Bedrock/GeckoLib axes.

    Both loaders reflect X and negate declared X/Y angles in render space.
    Conjugating that operation back into JSON coordinates negates X/Z angles.
    Java thumbnail transforms instead use the conventional transform3 above.
    """
    return transform3(v, [-rotation[0], rotation[1], -rotation[2]], pivot)


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


def make_customer_names():
    """NpcNames.java trims and deduplicates each locale in insertion order."""
    destination = BP / "scripts/customer_names.js"
    destination.parent.mkdir(parents=True, exist_ok=True)
    source = "// SPDX-License-Identifier: GPL-3.0-only\n// Generated from pinned upstream npc_names*.json by tools/convert_assets.py.\n"
    for key, filename in (("DEFAULT_CUSTOMER_NAMES", "npc_names.json"), ("ENGLISH_CUSTOMER_NAMES", "npc_names_en_us.json")):
        path = ASSETS / filename
        names = list(dict.fromkeys(name.strip() for name in read_json(path)["npc_names"] if isinstance(name, str) and name.strip()))
        source += f"export const {key} = Object.freeze(" + json.dumps(names, ensure_ascii=False) + ");\n"
        record(path, destination, "Original customer names; Java insertion-order deduplication and trimming")
    destination.write_text(source, encoding="utf-8")


def make_items():
    flat = {f"chef_coin_{n}": f"item/chef_coin_{n}" for n in (1,5,20,100,10000)}
    flat.update({"order": "item/order", "otc_upgrade_box": "item/otc_upgrade_box", "guide": "item/guide_book", "controller": "item/order"})
    # The existing port-authored pixel book is an editable input too. Rebuilding
    # upstream models must not silently revert it to the printer ticket icon.
    guide_dest = RP / "textures" / NS / "item/guide_book.png"
    guide_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "assets/guidebook/guide_book.png", guide_dest)
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
            # Java's expired branch shrinks the bag without applying food stats.
            components["minecraft:food"] = {"nutrition": 0, "saturation_modifier": 0, "can_always_eat": True}
            components["minecraft:use_animation"] = "eat"
            components["minecraft:use_modifiers"] = {"use_duration": 1.6, "movement_modifier": .35}
        if name == "helmet":
            components["minecraft:wearable"] = {"slot": "slot.armor.head", "protection": 2}
        write_json(BP / "items" / (name + ".json"), {"format_version": BLOCK_VERSION, "minecraft:item": {
            "description": {"identifier": f"{NS}:{name}", "menu_category": {"category": "items"}}, "components": components}})
    # Native ItemStack dynamic properties require a non-stackable item. Keep
    # the block's native item rendering while carrying its saved device data.
    for name in ("board", "order_machine"):
        write_json(BP / "items" / (name + ".json"), {"format_version": BLOCK_VERSION, "minecraft:item": {
            "description": {"identifier": f"{NS}:{name}", "menu_category": {"category": "construction"}},
            "components": {"minecraft:display_name": {"value": f"item.{NS}:{name}.name"}, "minecraft:max_stack_size": 1,
                "minecraft:block_placer": {"block": f"{NS}:{name}", "replace_block_item": True}}}})
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


def write_entity(name, components, properties=None, events=None):
    write_json(BP / "entities" / (name + ".json"), {"format_version": BLOCK_VERSION, "minecraft:entity": {
        "description": entity_description(name, properties), "components": components,
        "component_groups": {f"{NS}:despawn": {"minecraft:instant_despawn": {}}},
        "events": {f"{NS}:despawn": {"add": {"component_groups": [f"{NS}:despawn"]}}, **(events or {})}}})


def make_dining_plate():
    """Cosmetic meal entity with 41 exact stage shapes and one real atlas.

    Entity render controllers bind one texture; block material_instance names
    cannot select different source PNGs there. Remap every face into the atlas
    using its actual source resolution, retaining pixels and UV rotations.
    """
    blockstates_source = ASSETS / "blockstates/food_plate_display.json"
    variants = read_json(blockstates_source)["variants"]
    meshes, textures = [], {}
    for stage in range(41):
        spec = variants[f"facing=north,stage={stage}"]
        if isinstance(spec, list):
            spec = spec[0]
        identifier = f"geometry.{NS}.dining_plate_{stage}"
        if stage == 0:
            # Java's blockstate is empty here because its Gecko renderer draws
            # the original placed meal during ticks 0..14. A clean plate is not
            # that render: preserve the food, hierarchy, pixels and maked clip.
            source = ASSETS / "geo/block/food_plate_placed.geo.json"
            g = normalize_geo(source, identifier)
            tile = texture_tile(f"{NS}:block/food_plate_placed")
            textures[tile] = texture_file(f"{NS}:block/food_plate_placed")
            GEOMETRY_SOURCES[identifier] = ([source], "Original stage-zero placed meal geometry and hierarchy")
            for bone in g["minecraft:geometry"][0]["bones"]:
                for cube in bone.setdefault("cubes", []):
                    for face in cube["uv"].values():
                        # Native geo UVs use 32px; the common atlas conversion
                        # below takes normalized Java 16-unit UV coordinates.
                        face["uv"] = [value / 2 for value in face["uv"]]
                        face["uv_size"] = [value / 2 for value in face["uv_size"]]
                        face["material_instance"] = tile
        else:
            model_name = spec["model"]
            g, _ = convert_java_model(model_name, identifier)
            model = resolve_model(model_name)
            for value in model.get("textures", {}).values():
                name = resolve_texture(value, model["textures"])
                textures[texture_tile(name)] = texture_file(name)
        meshes.append(g["minecraft:geometry"][0])
    images = {name: Image.open(path).convert("RGBA") for name, path in sorted(textures.items())}
    padding = 2
    raw_width = sum(img.width+2*padding for img in images.values())
    raw_height = max(img.height+2*padding for img in images.values())
    width = 1 << (raw_width-1).bit_length()
    height = 1 << (raw_height-1).bit_length()
    atlas = Image.new("RGBA", (width, height))
    mapping = {}
    x = padding
    for name, img in images.items():
        atlas.paste(img, (x, padding))
        # Extrude boundary texels mechanically to prevent atlas-edge bleeding.
        atlas.paste(img.crop((0, 0, 1, img.height)).resize((padding, img.height)), (x-padding, padding))
        atlas.paste(img.crop((img.width-1, 0, img.width, img.height)).resize((padding, img.height)), (x+img.width, padding))
        atlas.paste(img.crop((0, 0, img.width, 1)).resize((img.width, padding)), (x, 0))
        atlas.paste(img.crop((0, img.height-1, img.width, img.height)).resize((img.width, padding)), (x, padding+img.height))
        mapping[name] = (x, padding, img.width/16, img.height/16)
        x += img.width+2*padding
    atlas_path = RP / f"textures/{NS}/entity/dining_plate_atlas.png"
    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(atlas_path)
    for name, path in textures.items():
        record(path, atlas_path, f"Exact source pixels placed in a single entity atlas; x,y,UV scales={mapping[name]}")
    for mesh in meshes:
        mesh["description"]["texture_width"] = width
        mesh["description"]["texture_height"] = height
        mesh["description"]["visible_bounds_width"] = 2
        mesh["description"]["visible_bounds_height"] = 1
        mesh["description"]["visible_bounds_offset"] = [0, 0.25, 0]
        for bone in mesh["bones"]:
            for cube in bone.get("cubes", []):
                for face in cube["uv"].values():
                    x, y, sx, sy = mapping[face.pop("material_instance")]
                    face["uv"] = [x+face["uv"][0]*sx, y+face["uv"][1]*sy]
                    face["uv_size"] = [face["uv_size"][0]*sx, face["uv_size"][1]*sy]
    geometry_path = RP / "models/entity/dining_plate.geo.json"
    write_json(geometry_path, {"format_version": GEOMETRY_VERSION, "minecraft:geometry": rounded(meshes)})
    record(blockstates_source, geometry_path, "Original stage1..40 mapping; stage0 uses the original FoodPlatePlacedRenderer meal")
    for path in sorted({source for mesh in meshes for source in GEOMETRY_SOURCES[mesh['description']['identifier']][0]}):
        record(path, geometry_path, "Original food stage cube shapes and per-face UVs remapped to the exact-pixel entity atlas")
    components = entity_base("ordertocook_dining_plate")
    components.update({
        "minecraft:collision_box": {"width": 0.01, "height": 0.01},
        "minecraft:custom_hit_test": {"hitboxes": [{"width": 0.8, "height": 0.2, "pivot": [0, 0.1, 0]}]},
        "minecraft:loot": {"table": "loot_tables/empty.json"},
        "minecraft:interact": {"interactions": [{"on_interact": {"event": f"{NS}:plate_interact", "target": "self"},
            "interact_text": f"action.interact.{NS}.plate"}]},
    })
    write_entity("dining_plate", components, {
        f"{NS}:stage": {"type": "int", "range": [0, 40], "default": 0, "client_sync": True},
        f"{NS}:placement_age": {"type": "float", "range": [0.0, 0.5], "default": 0.0, "client_sync": True},
    }, {f"{NS}:plate_interact": {}})
    write_json(RP / "entity/dining_plate.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"{NS}:dining_plate", "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/{NS}/entity/dining_plate_atlas"},
        "geometry": {f"stage{stage}": f"geometry.{NS}.dining_plate_{stage}" for stage in range(41)},
        "animations": {"placed": f"animation.{NS}.food_plate_placed.maked"},
        "scripts": {"animate": [{"placed": f"q.property('{NS}:stage') == 0"}]},
        "render_controllers": [f"controller.render.{NS}.dining_plate"],
    }}})
    write_json(RP / "render_controllers/dining_plate.render_controllers.json", {"format_version": "1.10.0", "render_controllers": {
        f"controller.render.{NS}.dining_plate": {
            "arrays": {"geometries": {"Array.stages": [f"Geometry.stage{stage}" for stage in range(41)]}},
            "geometry": f"Array.stages[q.property('{NS}:stage')]", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
        },
    }})


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
    customer.update({"minecraft:collision_box": {"width": .6, "height": 1.8}, "minecraft:movement": {"value": 0},
        "minecraft:movement.basic": {}, "minecraft:navigation.walk": {"can_walk": True, "can_open_doors": True},
        "minecraft:jump.static": {}, "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.02},
        "minecraft:behavior.random_look_around": {"priority": 9}})
    props = {f"{NS}:stage": {"type": "enum", "values": ["waiting","seated","eating","leaving"], "default": "waiting", "client_sync": True},
             f"{NS}:variant": {"type": "int", "range": [0,1], "default": 0, "client_sync": True},
             f"{NS}:action": {"type": "int", "range": [0,7], "default": 0, "client_sync": True},
             f"{NS}:action_elapsed": {"type": "float", "range": [0.0,6.0], "default": 0.0, "client_sync": True},
             f"{NS}:animation_variant": {"type": "int", "range": [1,4], "default": 1, "client_sync": True}}
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
    action_clips = {1: "npc_sitspawn", 2: "npc_standspawn", 3: "npc_sittake", 4: "npc_standtake",
                    5: "npc_eat&boom", 6: "npc_eat&scale", 7: "npc_eat&scale_interrupt"}
    anims = {f"action{action}": animation_names[("npc_transition", clip)] for action, clip in action_clips.items()}
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
    action_transitions = [{f"action_{action}": f"q.property('{NS}:action') == {action}"} for action in action_clips]
    idle_transitions = [{"select": f"q.property('{NS}:action') == 0"}]
    stages["select"] = {"on_entry": [f"v.idle_variant = q.property('{NS}:animation_variant');"],
        "transitions": copy.deepcopy(action_transitions) + [
            {"seated": f"q.property('{NS}:stage') == 'seated'"}, {"waiting": "1.0"}]}
    for stage in ("waiting", "seated"):
        other = "seated" if stage == "waiting" else "waiting"
        condition = f"q.property('{NS}:stage') {'==' if other == 'seated' else '!='} 'seated'"
        transitions = copy.deepcopy(action_transitions)+[{"select": condition}, {stage+"_reset": "q.all_animations_finished"}]
        # Java selects a new weighted idle only when the current clip finishes
        # on the client. Latch it for that cycle; a server timer must not change
        # animation weights halfway through a late-loaded four-second clip.
        stages[stage] = {"animations": [{f"{stage}{index}": f"v.idle_variant == {index}"} for index in range(1, 5)],
                         "blend_transition": 0, "transitions": transitions}
        stages[stage+"_reset"] = {
            "on_entry": ["v.idle_roll = math.random(0, 1);",
                         "v.idle_variant = v.idle_roll < 0.55 ? 1 : (v.idle_roll < 0.7 ? 2 : (v.idle_roll < 0.85 ? 3 : 4));"],
            "transitions": copy.deepcopy(action_transitions)+[{"select": condition}, {stage: "1.0"}]}
    for action in action_clips:
        # Authoritative server action/timer decides completion. Never loop a
        # completed eating/arrival effect simply because the clip ended locally.
        transitions = [entry for entry in action_transitions if f"action_{action}" not in entry]+copy.deepcopy(idle_transitions)
        stages[f"action_{action}"] = {"animations": [f"action{action}"], "blend_transition": 0, "transitions": transitions}
    write_json(RP / "animation_controllers/customer.animation_controllers.json", {"format_version":"1.10.0","animation_controllers":{
        f"controller.animation.{NS}.customer":{"initial_state":"select","states":stages}}})
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


def make_feedback_particles():
    """One-shot OTC cues using vanilla particle-atlas sprites, never new art.

    The vanilla endrod/happy/mob_portal/smoke definitions use manual emitters;
    spawnParticle does not supply their native emitter data. Explicit instant
    emitters make Java packet counts, Gaussian spread and velocity observable.
    Sprite UVs: Mojang/bedrock-samples resource_pack/particles (see audio audit).
    """
    gaussian = "(math.sqrt(-2 * math.ln(math.max(0.000001, math.random(0, 1)))) * math.cos(360 * math.random(0, 1)))"
    smoke_uv = {"texture_width":128,"texture_height":128,"uv":[0,0],"uv_size":[1,1],
                "flipbook":{"base_UV":[56,0],"size_UV":[8,8],"step_UV":[-8,0],"frames_per_second":8,"max_frame":8,"stretch_to_lifetime":True}}
    specs = {
        "sparkle": {"uv": {**copy.deepcopy(smoke_uv), "flipbook": {**smoke_uv["flipbook"], "base_UV":[56,88]}},
                    "size":"0.1 + variable.particle_random_1 * 0.1", "life":"math.random(3, 3.6)", "color":[1,1,1,"1 - 0.6 * math.max(0, 2 * variable.particle_age / variable.particle_lifetime - 1)"], "gravity":-0.2},
        "cloud": {"uv":smoke_uv,"size":"0.15 + variable.particle_random_1 * 0.15","life":"math.random(0.6, 1.4)","color":[1,1,1,"1 - variable.particle_age / variable.particle_lifetime"],"gravity":0.1},
        "smoke": {"uv":smoke_uv,"size":0.1,"life":"math.random(0.4, 1.4)","color":["variable.particle_random_1 * 0.5"]*3+[1],"gravity":0.1},
        "large_smoke": {"uv":smoke_uv,"size":0.25,"life":"math.random(0.4, 1.4)","color":["variable.particle_random_1 * 0.5"]*3+[1],"gravity":0.1},
        "poof": {"uv":smoke_uv,"size":"0.1 + variable.particle_random_1 * 0.2","life":"math.random(0.3, 0.7)","color":[1,1,1,"1 - variable.particle_age / variable.particle_lifetime"],"gravity":0},
        "happy": {"uv":{"texture_width":128,"texture_height":128,"uv":[16,40],"uv_size":[8,8]},"size":0.14,"life":"math.random(1, 1.5)","color":[1,1,1,1],"gravity":0},
        "portal": {"uv":{"texture_width":128,"texture_height":128,"uv":["math.floor(variable.particle_random_3 * 8) * 8",0],"uv_size":[8,8]},
                   "size":"(0.05 + 0.02 * variable.particle_random_2) * (1 - math.pow(1 - variable.particle_age / variable.particle_lifetime, 2))", "life":"math.random(2, 2.45)",
                   "color":["variable.particle_random_1 * 0.6 + 0.4","(variable.particle_random_1 * 0.6 + 0.4) * 0.3","(variable.particle_random_1 * 0.6 + 0.4) * 0.9",1],"gravity":0},
        "bubble_pop": {"uv":{"texture_width":128,"texture_height":128,"uv":[0,16],"uv_size":[8,8]},"size":"0.06 * (1 - variable.particle_age / variable.particle_lifetime)","life":0.2,"color":[1,1,1,1],"gravity":0},
        "splash": {"uv":{"texture_width":128,"texture_height":128,"uv":["24 + math.floor(variable.particle_random_1 * 4) * 8",8],"uv_size":[8,8]},"size":0.1,"life":"math.random(0.2, 0.5)","color":[1,1,1,1],"gravity":-4},
    }
    defaults = "variable.count = variable.count ?? 1; variable.spread.x = variable.spread.x ?? 0; variable.spread.y = variable.spread.y ?? 0; variable.spread.z = variable.spread.z ?? 0; variable.speed = variable.speed ?? 0;"
    for name, spec in specs.items():
        components = {
            "minecraft:emitter_initialization":{"creation_expression":defaults},
            "minecraft:emitter_lifetime_once":{"active_time":0.05},
            "minecraft:emitter_rate_instant":{"num_particles":"variable.count"},
            "minecraft:emitter_shape_point":{"offset":[f"variable.spread.{axis} * {gaussian}" for axis in "xyz"]},
            "minecraft:particle_initial_speed":[f"variable.speed * {gaussian}" for _ in range(3)],
            "minecraft:particle_lifetime_expression":{"max_lifetime":spec["life"]},
            "minecraft:particle_motion_dynamic":{"linear_acceleration":[0,spec["gravity"],0],"linear_drag_coefficient":0.49},
            "minecraft:particle_appearance_billboard":{"size":[spec["size"],spec["size"]],"facing_camera_mode":"lookat_xyz","uv":copy.deepcopy(spec["uv"])},
            "minecraft:particle_appearance_tinting":{"color":spec["color"]},
        }
        if name == "splash":
            components["minecraft:particle_initial_speed"] = ["math.random(-0.4, 0.4)", "math.random(0.5, 1)", "math.random(-0.4, 0.4)"]
        if name not in ("sparkle", "portal"):
            components["minecraft:particle_appearance_lighting"] = {}
        write_json(RP / "particles" / (name + ".json"), {"format_version":"1.10.0","particle_effect":{
            "description":{"identifier":f"{NS}:{name}","basic_render_parameters":{"material":"particles_blend","texture":"textures/particle/particles"}},"components":components}})
    # Java EXPLOSION_EMITTER is one short-lived emitter, not one smoke mote.
    write_json(RP / "particles/explosion.json", {"format_version":"1.10.0","particle_effect":{
        "description":{"identifier":f"{NS}:explosion","basic_render_parameters":{"material":"particles_alpha","texture":"textures/particle/particles"}},
        "components":{
            "minecraft:emitter_lifetime_once":{"active_time":0.4},
            "minecraft:emitter_rate_steady":{"spawn_rate":120,"max_particles":50},
            "minecraft:emitter_shape_point":{"offset":["math.random(-4, 4)"]*3},
            "minecraft:particle_lifetime_expression":{"max_lifetime":"math.random(0.3, 0.5)"},
            "minecraft:particle_appearance_billboard":{"size":[1,1],"facing_camera_mode":"lookat_xyz","uv":{
                "texture_width":128,"texture_height":128,"uv":[0,0],"uv_size":[1,1],"flipbook":{"base_UV":[0,80],"size_UV":[8,8],"step_UV":[8,0],"frames_per_second":8,"max_frame":16,"stretch_to_lifetime":True}}},
            "minecraft:particle_appearance_tinting":{"color":["0.4 + variable.particle_random_1 * 0.6"]*3+[1]}
        }}})


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
    # Original stove.png, stove_fire.png and stove_fire_0..3.png are already
    # copied above and selected by each stove's explicit fire_frame block state.
    (RP / "textures" / NS / "block/stove_fire_flipbook.png").unlink(missing_ok=True)
    write_json(RP / "textures/terrain_texture.json", {"resource_pack_name":"Order To Cook Unofficial","texture_name":"atlas.terrain","padding":8,"num_mip_levels":4,"texture_data":terrain})
    write_json(RP / "textures/flipbook_textures.json", [])
    for source in sorted((ASSETS / "sounds").rglob("*.ogg")):
        copy_asset(source, RP / "sounds" / NS / source.relative_to(ASSETS / "sounds"))
    sounddefs = {}
    for name, spec in read_json(ASSETS / "sounds.json").items():
        sounddefs[f"{NS}:{name}"] = {"category":"player" if name == "horn" else "block","sounds":["sounds/"+NS+"/"+s.split(":",1)[1] for s in spec["sounds"]]}
    write_json(RP / "sounds/sound_definitions.json", {"format_version":"1.14.0","sound_definitions":sounddefs})
    record(ASSETS / "sounds.json", RP / "sounds/sound_definitions.json", "Original sound event aliases registered in the Bedrock sound schema")
    block_sounds = {"format_version":"1.1.0"}
    # Preserve the block sound families inherited in pinned ModBlocks.java.
    sound_families = {"order_machine":"stone","countertop":"wood","washingtable":"stone",
        "chair":"wood","shelf":"wood","plate_shelf":"wood","takeout_bag":"cloth",
        "food_plate_display":"cloth","board":"wood","dishwasher":"metal","refrigerator":"metal","refrigerator_upper":"metal","stove":"wood"}
    for name, sound_family in sound_families.items():
        block_sounds[f"{NS}:{name}"]={"sound":sound_family}
    write_json(RP / "blocks.json", block_sounds)
    make_feedback_particles()
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
        "refrigerator":"冰箱","refrigerator_upper":"冰箱上層","stove":"爐灶","clean_plate":"乾淨餐盤","dirty_plate":"髒餐盤","food_plate":"裝盤料理",
        "motorcycle":"外賣電單車","helmet":"外賣頭盔","order":"訂單","otc_upgrade_box":"設備升級工具箱","guide":"Order To Cook 使用指南","controller":"餐廳控制器"}
    for value in (1,5,20,100,10000):
        traditional[f"chef_coin_{value}"]=f"廚師幣（{value}）"
    english_extra = {"guide":"Order To Cook Guide", "controller":"Restaurant Controller"}
    fridge_labels = {
        "en_US": {"upper": "Refrigerator — Upper (27 slots)", "lower": "Refrigerator — Lower (54 slots)", "block": "Upper Refrigerator"},
        "zh_CN": {"upper": "冰箱上层（27格）", "lower": "冰箱下层（54格）", "block": "冰箱上层"},
        "zh_TW": {"upper": "冰箱上層（27格）", "lower": "冰箱下層（54格）", "block": "冰箱上層"},
    }
    for src_name, out_name in (("en_us","en_US"),("zh_cn","zh_CN"),("zh_cn","zh_TW")):
        lang = read_json(ASSETS / "lang" / (src_name + ".json"))
        lines=["## Order To Cook — source translations by breezeth-CN; Bedrock additions by this port.","pack.name=Order To Cook Unofficial","pack.description=Unofficial Bedrock adaptation of Order To Cook."]
        for path in sorted((BP / "blocks").glob("*.json")):
            name=path.stem
            value=traditional[name] if out_name == "zh_TW" else lang.get(f"block.{NS}.{name}", name.replace("_"," ").title())
            if name == "refrigerator_upper":
                value = fridge_labels[out_name]["block"]
            lines.append(f"tile.{NS}:{name}.name={value}")
        for half in ("upper", "lower"):
            lines.append(f"container.{NS}.refrigerator.{half}={fridge_labels[out_name][half]}")
        for path in sorted((BP / "items").glob("*.json")):
            name=path.stem
            fallback=english_extra.get(name,name.replace("_"," ").title())
            value=traditional[name] if out_name == "zh_TW" else lang.get(f"item.{NS}.{name}",fallback if out_name == "en_US" else traditional[name])
            lines.append(f"item.{NS}:{name}.name={value}")
        lines += [f"entity.{NS}:customer.name="+("Customer" if out_name=="en_US" else "顧客"), f"entity.{NS}:motorcycle.name="+("Delivery Motorcycle" if out_name=="en_US" else "外賣電單車"),
                  f"entity.{NS}:dining_plate.name="+("Dining Plate" if out_name=="en_US" else "用餐餐盤"),
                  f"action.interact.{NS}.plate="+("Check plate" if out_name=="en_US" else "查看餐盤")]
        dest=RP / "texts" / (out_name+".lang")
        # Handbook and runtime messages are maintained independently of Java
        # asset labels. Regeneration must retain those additional keys.
        guide_text = (ROOT / "assets/guidebook" / (out_name + ".lang")).read_text(encoding="utf-8")
        guide_keys = {line.partition("=")[0] for line in guide_text.splitlines() if "=" in line}
        previous = dest if dest.is_file() else ROOT / "runtime/RP/texts" / (out_name+".lang")
        if previous.is_file():
            generated_keys = {line.partition("=")[0] for line in lines if "=" in line}
            lines += [line for line in previous.read_text(encoding="utf-8").splitlines()
                      if line not in lines and line.partition("=")[0] not in generated_keys | guide_keys]
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text("\n".join(lines)+"\n"+guide_text,encoding="utf-8")
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
    make_customer_names()
    make_items()
    make_helmet_attachable()
    make_entities(animations)
    make_dining_plate()
    preserve_imported_geometry()
    make_recipes()
    make_languages()
    write_json(OUT / "asset_conversion_manifest.json", {"upstream":"https://github.com/breezeth-CN/OrdertoCook","revision":revision,
        "license":"GPL-3.0", "assets":PROVENANCE,
        "port_assets": [{"source": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                        for path in sorted((ROOT / "assets/guidebook").glob("*")) if path.suffix in (".png", ".lang")],
        "adaptations":["Two-part refrigerator with complete independent doors; separate 11-pose open/close source clips; at most 0.126px intermediate hinge translation bounds the sweep",
            "Original GeckoLib elastic/bounce easing and appliance squash retained in sampled static cuboids; residual descendant shear and unsynchronized cabinet halves remain documented",
            "Stove uses six original textures selected by saved per-stove fire phases: 15-tick ignition delay, 5-tick burst and four 8-tick cycle frames; original ignition bone squash is not rendered",
            "Dishwasher drawer, door, plate-count visibility and wash vibration sampled into 82 poses including look-target preview; preview geometry is shared rather than per-client",
            "Dining plate entity uses original stage-zero placement geometry/animation plus 40 source food stages and an exact-pixel atlas; no inventory or automatic loot",
            "Seven original customer actions seek from canonical elapsed time; weighted idle variation changes only between completed clips",
            "Default customer skins prebundled; runtime web skin lookup not available", "Source-model inventory thumbnails", "Early-game furniture recipes added for survival access"]})
    print(f"Converted {len(PROVENANCE)} source resource references; {len(list(BP.rglob('*.json')))} BP JSON, {len(list(RP.rglob('*.json')))} RP JSON")


if __name__ == "__main__":
    main()
