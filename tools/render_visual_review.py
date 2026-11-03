#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Deterministic CPU model review; these images are NOT game screenshots.

Rasterizes source/candidate textured triangles with a depth buffer and nearest
texel sampling. Source references evaluate the original bone hierarchy directly,
including signed cubes and inherited affine scale; they do not use bake_pose.
This checks model/UV differences, not Bedrock lighting, networking or UI behavior.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
from pathlib import Path
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

NS = "ordertocook:"
ASSET_REL = Path("upstream/reference/common/src/main/resources/assets/ordertocook")
BG = (231, 235, 237, 255)
INK = (30, 42, 50)
ACCENT = (29, 91, 105)
FACE_INDICES = {"west": [3, 2, 0, 1], "east": [4, 5, 7, 6],
                "north": [2, 4, 6, 0], "south": [5, 3, 1, 7],
                "up": [3, 5, 4, 2], "down": [0, 6, 7, 1]}
INPUTS = {}
CELLS = []


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    INPUTS[str(path)] = digest(path)


def read(path):
    record(path)
    return json.loads(path.read_text(encoding="utf-8-sig"))


def texture(path):
    record(path)
    return np.asarray(Image.open(path).convert("RGBA"))


def font(size, bold=False):
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans" + ("-Bold" if bold else "") + ".ttf", size)


def rotate(points, angles, pivot=(0, 0, 0)):
    """Native geo convention: standard XYZ angles are (-x, +y, -z).

    The final X reflection below yields GeckoLib's (-x,-y,+z) world rotations.
    See pinned GeckoLib BakedModelFactory/GeoQuad source in the manifest.
    """
    result = np.asarray(points, dtype=float) - pivot
    for axis, value in enumerate((-angles[0], angles[1], -angles[2])):
        c, s = math.cos(math.radians(value)), math.sin(math.radians(value))
        matrix = (np.array([[1, 0, 0], [0, c, -s], [0, s, c]]) if axis == 0 else
                  np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]) if axis == 1 else
                  np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]))
        result = result @ matrix.T
    return result + pivot


def numeric(value, seconds):
    if isinstance(value, (int, float)):
        return float(value)
    match = re.fullmatch(r"(-?)math\.(sin|cos)\((?:q|query)\.anim_time\s*\*\s*([\d.]+)\)\s*\*\s*([\d.]+)", value)
    if not match:
        raise ValueError(f"Unsupported source expression: {value}")
    sign, kind, frequency, amplitude = match.groups()
    return (-1 if sign else 1) * getattr(math, kind)(math.radians(seconds * float(frequency))) * float(amplitude)


def easing(name, t, args):
    if name in (None, "linear") or t == 1:
        return t
    if name == "step":
        count = int(args[0]) if args else 2
        return min(count - 1, math.floor(t * count)) / count
    def elastic(x):
        amount = args[0] if args else 1
        return 1 - math.cos(x * math.pi / 2) ** 3 * math.cos(x * amount * math.pi)
    def bounce(x):
        amount = args[0] if args else 0.5
        return min(121 / 16 * x*x, 121 / 4 * amount * (x - 6/11)**2 + 1 - amount,
                   121 * amount**2 * (x - 9/11)**2 + 1 - amount**2,
                   484 * amount**3 * (x - 10.5/11)**2 + 1 - amount**3)
    for family, curve in (("Elastic", elastic), ("Bounce", bounce)):
        if name == "easeIn" + family:
            return curve(t)
        if name == "easeOut" + family:
            return 1 - curve(1 - t)
        if name == "easeInOut" + family:
            return curve(t * 2) / 2 if t < .5 else 1 - curve((1 - t) * 2) / 2
    raise ValueError(f"Unsupported easing: {name}")


def sample(channel, seconds, default, edge="post"):
    if channel is None:
        return np.array(default, dtype=float)
    if isinstance(channel, dict):
        if "vector" in channel:
            return sample(channel["vector"], seconds, default)
        if "post" in channel or "pre" in channel:
            return sample(channel.get(edge, channel.get("post", channel.get("pre"))), seconds, default)
        keys = sorted((float(time), value) for time, value in channel.items())
        for index, (time, value) in enumerate(keys):
            if seconds <= time:
                if index == 0 or seconds == time:
                    return sample(value, seconds, default)
                previous_time, previous = keys[index - 1]
                t = (seconds - previous_time) / (time - previous_time)
                if isinstance(value, dict):
                    t = easing(value.get("easing"), t, value.get("easingArgs", []))
                a = sample(previous, seconds, default)
                b = sample(value, seconds, default, "pre")
                return a + (b - a) * t
        return sample(keys[-1][1], seconds, default)
    values = channel if isinstance(channel, list) else [channel] * 3
    return np.array([numeric(value, seconds) for value in values])


def expression(value, states):
    if isinstance(value, bool):
        return value
    text = re.sub(r"q\.block_state\('([^']+)'\)", lambda m: repr(states.get(m[1], 0)), value)
    text = text.replace("&&", " and ").replace("||", " or ").replace("true", "True").replace("false", "False")
    tree = ast.parse(text, mode="eval")
    allowed = (ast.Expression, ast.BoolOp, ast.BinOp, ast.UnaryOp, ast.Compare, ast.Constant,
               ast.And, ast.Or, ast.Add, ast.Mult, ast.Sub, ast.USub, ast.Not, ast.Eq, ast.NotEq,
               ast.Gt, ast.GtE, ast.Lt, ast.LtE)
    if any(not isinstance(node, allowed) for node in ast.walk(tree)):
        raise ValueError(f"Unsupported block visibility expression: {value}")
    return bool(eval(compile(tree, "<block states>", "eval"), {"__builtins__": {}}, {}))


class Pack:
    def __init__(self, root, label):
        self.root, self.label = root, label
        self.rp = root / "runtime/RP"
        self.terrain = read(self.rp / "textures/terrain_texture.json")["texture_data"]
        self.models = {}
        for path in sorted((self.rp / "models").rglob("*.geo.json")):
            for model in json.loads(path.read_text())["minecraft:geometry"]:
                self.models[model["description"]["identifier"]] = (path, model)

    def material(self, definition):
        name = definition["texture"]
        path = self.terrain[name]["textures"]
        if isinstance(path, list):
            path = path[0]
        return texture(self.rp / (path + ".png"))

    def block(self, name, overrides=None, offset=(0, 0, 0)):
        path = self.root / f"runtime/BP/blocks/{name}.json"
        block = read(path)["minecraft:block"]
        states = {key: values[0] if isinstance(values, list) else values["min"]
                  for key, values in block["description"].get("states", {}).items()}
        states["minecraft:cardinal_direction"] = "north"
        for key, value in (overrides or {}).items():
            states[key if ":" in key else NS + key] = value
        components = dict(block["components"])
        for permutation in block.get("permutations", []):
            if expression(permutation["condition"], states):
                components.update(permutation["components"])
        spec = components["minecraft:geometry"]
        identifier = spec if isinstance(spec, str) else spec["identifier"]
        geo_path, geo = self.models[identifier]
        record(geo_path)
        visibility = spec.get("bone_visibility", {}) if isinstance(spec, dict) else {}
        visible = lambda name, index: expression(visibility.get(name, True), states)
        materials = {key: self.material(value) for key, value in components["minecraft:material_instances"].items()}
        rotations = components.get("minecraft:transformation", {}).get("rotation", [0, 0, 0])
        quads = geometry_quads(geo, materials, visible=visible, rotation=rotations, offset=offset)
        return {"quads": quads, "pack": self.label, "block": name, "states": states,
                "geometry": str(geo_path.relative_to(self.root)), "geometry_identifier": identifier}

    def fridge(self, frame=10, facing="north", closing=False):
        specs = {"frame": frame, "closing": closing, "minecraft:cardinal_direction": facing}
        lower = self.block("refrigerator", {**specs, "half": "lower"})
        upper = self.block("refrigerator", {**specs, "half": "upper"}, (0, 16, 0))
        return {"quads": lower["quads"] + upper["quads"], "pack": self.label,
                "block": "refrigerator", "parts": [metadata(lower), metadata(upper)]}

    def plate(self, stage, seconds=0):
        path = self.rp / "models/entity/dining_plate.geo.json"
        geo = read(path)["minecraft:geometry"][stage]
        clip = None
        if stage == 0 and self.label != "BASELINE main":
            clips = read(self.rp / "animations/food_plate_placed.animation.json")["animations"]
            clip = clips["animation.ordertocook.food_plate_placed.maked"]
        quads = geometry_quads(geo, {"*": texture(self.rp / "textures/ordertocook/entity/dining_plate_atlas.png")}, clip, seconds)
        return {"quads": quads, "pack": self.label, "entity": "dining_plate", "stage": stage,
                "seconds": seconds, "geometry": str(path.relative_to(self.root))}


def geometry_quads(geo, materials, clip=None, seconds=0, visible=lambda name, index: True,
                   rotation=(0, 0, 0), offset=(0, 0, 0)):
    bones = {bone["name"]: bone for bone in geo["bones"]}
    output = []
    for name, bone in bones.items():
        chain = [bone]
        while "parent" in chain[-1]:
            chain.append(bones[chain[-1]["parent"]])
        if not all(visible(entry["name"], 0) for entry in chain):
            continue
        for index, cube in enumerate(bone.get("cubes", []), 1):
            if not visible(name, index):
                continue
            inflate = float(cube.get("inflate", 0))
            x0, y0, z0 = np.array(cube["origin"], dtype=float) - inflate
            x1, y1, z1 = np.array(cube["origin"], dtype=float) + cube["size"] + inflate
            # GeoQuad/VertexSet ordering before the final world X reflection.
            vertices = np.array([[x1, y0, z0], [x1, y0, z1], [x1, y1, z0], [x1, y1, z1],
                                 [x0, y1, z0], [x0, y1, z1], [x0, y0, z0], [x0, y0, z1]])
            vertices = rotate(vertices, cube.get("rotation", [0, 0, 0]), cube.get("pivot", [0, 0, 0]))
            for parent in chain:
                tracks = (clip or {}).get("bones", {}).get(parent["name"], {})
                pivot = np.array(parent.get("pivot", [0, 0, 0]))
                vertices = (vertices - pivot) * sample(tracks.get("scale"), seconds, [1, 1, 1]) + pivot
                angles = np.array(parent.get("rotation", [0, 0, 0])) + sample(tracks.get("rotation"), seconds, [0, 0, 0])
                vertices = rotate(vertices, angles, pivot) + sample(tracks.get("position"), seconds, [0, 0, 0])
            vertices = rotate(vertices + offset, rotation)
            vertices[:, 0] *= -1
            for face, uv in cube.get("uv", {}).items():
                tex = materials.get(uv.get("material_instance"), materials.get("*"))
                if tex is None:
                    raise ValueError(f"No texture for {name}/{face}")
                u, v = uv["uv"]
                du, dv = uv["uv_size"]
                coords = np.array([[u + du, v], [u, v], [u, v + dv], [u + du, v + dv]], dtype=float)
                if uv.get("uv_rotation"):
                    coords = np.roll(coords, uv["uv_rotation"] // 90, axis=0)
                coords *= [tex.shape[1] / geo["description"]["texture_width"],
                           tex.shape[0] / geo["description"]["texture_height"]]
                output.append((vertices[FACE_INDICES[face]], coords, tex))
    return output


def source_model(repo, name, clip_name=None, seconds=0, count=0):
    assets = repo / ASSET_REL
    path = assets / f"geo/block/{name}.geo.json"
    geo = read(path)["minecraft:geometry"][0]
    clip = None
    if clip_name:
        clips = read(assets / f"animations/{name}.animation.json")["animations"]
        if isinstance(clip_name, list):
            clip = {"bones": {key: value for entry in clip_name for key, value in clips[entry]["bones"].items()}}
        else:
            clip = clips[clip_name]
    def visible(bone, index):
        if name == "dishwasher" and bone in ("clear_dish", "drity_dish") and index:
            return count >= 3 or (count == 1 and index == 2) or (count == 2 and index in (2, 5))
        return True
    texture_name = "order_machine_geo" if name == "order_machine" else name
    quads = geometry_quads(geo, {"*": texture(assets / f"textures/block/{texture_name}.png")}, clip, seconds, visible)
    return {"quads": quads, "pack": "PINNED JAVA ASSETS", "model": name, "clip": clip_name,
            "seconds": seconds, "plate_count": count, "geometry": str(path.relative_to(repo))}


def customer_scene(current, slim, clip_name, seconds, original=False):
    skin = "slim" if slim else "wide"
    texture_name = "otc_zombie_custom2" if slim else "otc_zombie_custom"
    if original:
        assets = current.root / ASSET_REL
        path = assets / ("geo/drive_idle_alex.geo.json" if slim else "geo/drive_idle.geo.json")
        geo = read(path)["minecraft:geometry"][0]
        clip = read(assets / "animations/npc.animation.json")["animations"][clip_name]
        tex = texture(assets / f"textures/entity/{texture_name}.png")
    else:
        path = current.rp / ("models/entity/customer_slim.geo.json" if slim else "models/entity/customer.geo.json")
        geo = read(path)["minecraft:geometry"][0]
        clip = read(current.rp / "animations/npc.animation.json")["animations"]["animation.ordertocook.npc." + clip_name]
        tex = texture(current.rp / f"textures/ordertocook/entity/{texture_name}.png")
    quads = geometry_quads(geo, {"*": tex}, clip, seconds)
    return {"quads": quads, "pack": "PINNED JAVA ASSETS" if original else current.label,
            "entity": "customer", "skin": skin, "clip": clip_name, "seconds": seconds,
            "geometry": str(path.relative_to(current.root))}


def camera_basis(camera):
    camera = np.array(camera, dtype=float)
    camera /= np.linalg.norm(camera)
    right = np.cross(camera, [0, 1, 0]); right /= np.linalg.norm(right)
    up = np.cross(right, camera)
    return np.array([right, up, camera])


def bounds(scenes, camera):
    basis = camera_basis(camera)
    points = np.concatenate([quad[0] for scene in scenes for quad in scene["quads"]]) @ basis.T
    return (points[:, :2].min(axis=0), points[:, :2].max(axis=0))


def raster(scene, size, camera=(3, 2.4, -4.2), fit=None):
    width, height = size
    basis = camera_basis(camera)
    low, high = fit if fit else bounds([scene], camera)
    span = np.maximum(high - low, 1)
    scale = min((width - 24) / span[0], (height - 20) / span[1])
    midpoint = (low + high) / 2
    pixels = np.full((height, width, 4), BG, dtype=np.uint8)
    depth = np.full((height, width), -np.inf)
    light = np.array([-.4, .85, -.35]); light /= np.linalg.norm(light)
    for vertices, uvs, tex in scene["quads"]:
        normal = np.cross(vertices[1] - vertices[0], vertices[2] - vertices[0])
        length = np.linalg.norm(normal)
        if length < 1e-8:
            continue
        normal /= length
        # Both sides are inspected deliberately: signed source cubes reverse
        # winding, and this review must compare UVs without pretending to test
        # either engine's GPU material/culling policy.
        if np.dot(normal, basis[2]) < 0:
            normal *= -1
        shade = .65 + .35 * max(0, np.dot(normal, light))
        points = vertices @ basis.T
        points[:, 0] = (points[:, 0] - midpoint[0]) * scale + width / 2
        points[:, 1] = height / 2 - (points[:, 1] - midpoint[1]) * scale
        for indices in ((0, 1, 2), (0, 2, 3)):
            a, b, c = points[list(indices)]
            x0, y0 = np.maximum(np.floor(np.minimum(np.minimum(a[:2], b[:2]), c[:2])).astype(int), [0, 0])
            x1, y1 = np.minimum(np.ceil(np.maximum(np.maximum(a[:2], b[:2]), c[:2])).astype(int), [width, height])
            if x1 <= x0 or y1 <= y0:
                continue
            denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(denominator) < 1e-9:
                continue
            xx, yy = np.meshgrid(np.arange(x0, x1) + .5, np.arange(y0, y1) + .5)
            aa = ((b[1] - c[1]) * (xx - c[0]) + (c[0] - b[0]) * (yy - c[1])) / denominator
            bb = ((c[1] - a[1]) * (xx - c[0]) + (a[0] - c[0]) * (yy - c[1])) / denominator
            cc = 1 - aa - bb
            z = aa * a[2] + bb * b[2] + cc * c[2]
            coords = aa[..., None] * uvs[indices[0]] + bb[..., None] * uvs[indices[1]] + cc[..., None] * uvs[indices[2]]
            tx = np.clip(np.floor(coords[..., 0]).astype(int), 0, tex.shape[1] - 1)
            ty = np.clip(np.floor(coords[..., 1]).astype(int), 0, tex.shape[0] - 1)
            colors = tex[ty, tx].copy()
            mask = (np.minimum(np.minimum(aa, bb), cc) >= -1e-7) & (z >= depth[y0:y1, x0:x1] - 1e-7) & (colors[..., 3] >= 128)
            colors[..., :3] = (colors[..., :3].astype(float) * shade).astype(np.uint8)
            pixels[y0:y1, x0:x1][mask] = colors[mask]
            depth[y0:y1, x0:x1][mask] = z[mask]
    return Image.fromarray(pixels)


def metadata(scene):
    return {key: value for key, value in scene.items() if key != "quads"}


def caption(draw, xy, lines, size=15, color=INK):
    for index, line in enumerate(lines):
        draw.text((xy[0], xy[1] + index * (size + 5)), line, font=font(size), fill=color)


def header(image, title, subtitle):
    draw = ImageDraw.Draw(image)
    draw.text((24, 16), title, fill=INK, font=font(25, True))
    draw.text((24, 54), "OFFLINE MODEL RENDER - NOT GAME SCREENSHOTS", fill=ACCENT, font=font(15, True))
    draw.text((24, 79), subtitle, fill=INK, font=font(13))


def focused(current, old, output):
    source = current.root
    rows = [
        ("Refrigerator / both doors open", "t=0.70s; compare inside UVs and eased door angles", (3, 2.2, -5),
         source_model(source, "refrigerator", ["up_open", "down_open"], .7), old.fridge(7), current.fridge(7)),
        ("Dishwasher / one clean plate", "ready phase; source selects cube 2 only", (-4, 8, -2),
         source_model(source, "dishwasher", "clear_out", 1.1667, 1), old.block("dishwasher", {"phase": 5, "plates": 1}), current.block("dishwasher", {"phase": 5, "plates": 1})),
        ("Dishwasher / two clean plates", "ready phase; source selects cubes 2 and 5", (-4, 8, -2),
         source_model(source, "dishwasher", "clear_out", 1.1667, 2), old.block("dishwasher", {"phase": 5, "plates": 2}), current.block("dishwasher", {"phase": 5, "plates": 2})),
        ("Dishwasher / closing squash", "empty_in frame 8/15; exact source affine vs baked cubes", (3, 2.4, -4.2),
         source_model(source, "dishwasher", "empty_in", .6667 * 8 / 15), old.block("dishwasher", {"phase": 1, "frame": 8}), current.block("dishwasher", {"phase": 1, "frame": 8})),
        ("Order printer / paper feed and body motion", "t=0.20s / frame 3 of 15; baseline waiting frame 0 at global tick 4", (3, 2.7, -4.2),
         source_model(source, "order_machine", "neworder", .2), old.block("order_machine", {"mode": "waiting", "frame": 0}), current.block("order_machine", {"mode": "printing", "frame": 3})),
        ("Takeout bag / placed meal bag", "t=0.15s / frame 4; placed Geo texture and maked scale", (3, 3.5, -4.2),
         source_model(source, "takeout_bag_placed", "maked", .15), old.block("takeout_bag"), current.block("takeout_bag", {"frame": 4})),
        ("Meal placement / stage zero", "t=0.1667s; original food and maked scale=1.05", (3, 4.4, -4.2),
         source_model(source, "food_plate_placed", "maked", .1667), old.plate(0), current.plate(0, .1667)),
    ]
    width, row_height, top = 1164, 316, 142
    image = Image.new("RGBA", (width, top + len(rows) * row_height + 48), BG)
    header(image, "Order To Cook | focused source / before / after", "Fixed camera + shared scale within each row. Original pixel textures. Uniform CPU lighting; no game client.")
    draw = ImageDraw.Draw(image)
    for col, label in enumerate(("PINNED JAVA ASSET POSE", "BASELINE main ce8a45e", "CANDIDATE 0.1.6-alpha.1")):
        draw.text((col * 380 + 28, 114), label, font=font(16, True), fill=ACCENT)
    for row, (title, detail, camera, *scenes) in enumerate(rows):
        y = top + row * row_height
        draw.line((24, y, width - 24, y), fill=(177, 190, 195), width=1)
        caption(draw, (26, y + 7), [title, detail], 14)
        fit = bounds(scenes, camera)
        for col, scene in enumerate(scenes):
            image.alpha_composite(raster(scene, (360, 247), camera, fit), (col * 380 + 24, y + 59))
            CELLS.append({"sheet": "focused-before-after.png", "row": row, "column": col, "title": title,
                          "camera": camera, **metadata(scene)})
    caption(draw, (24, image.height - 35), ["Read manifest.json for source files, frame/state selections, input hashes and limitations."], 13)
    image.convert("RGB").save(output / "focused-before-after.png")


def plates(current, output):
    columns, cellw, cellh, top = 8, 178, 177, 114
    image = Image.new("RGBA", (columns * cellw + 32, top + 6 * cellh + 28), BG)
    header(image, "Order To Cook | all 41 dining stages", "Candidate model snapshots. Stage 0 at t=0.1667s; stages 1-40 retain Java food shapes. No client playback claim.")
    draw = ImageDraw.Draw(image)
    scenes = [current.plate(stage, .1667 if stage == 0 else 0) for stage in range(41)]
    camera = (3, 4.4, -4.2); fit = bounds(scenes, camera)
    for stage, scene in enumerate(scenes):
        row, col = divmod(stage, columns); x, y = 16 + col * cellw, top + row * cellh
        image.alpha_composite(raster(scene, (cellw - 8, cellh - 45), camera, fit), (x, y))
        label = "0 | placed meal" if stage == 0 else f"{stage} | food {(stage - 1) // 4 + 1}, phase {(stage - 1) % 4 + 1}"
        caption(draw, (x + 5, y + cellh - 39), [label, "dirty" if stage and stage % 4 == 0 else ""], 12)
        CELLS.append({"sheet": "plates-41-stages.png", "row": row, "column": col, "camera": camera, **metadata(scene)})
    image.convert("RGB").save(output / "plates-41-stages.png")


def blocks(current, output):
    choices = [("board", {}), ("countertop", {}), ("chair", {}), ("shelf", {"papers": 6}),
               ("plate_shelf", {"plates": 6}), ("washingtable", {"plates": 3}),
               ("order_machine", {"mode": "waiting", "frame": 0}), ("refrigerator", {"frame": 10}),
               ("dishwasher", {"phase": 5, "plates": 2}), ("stove", {}),
               ("takeout_bag", {}), ("food_plate_display", {"stage": 1})]
    rowh, cellw, top = 202, 240, 124
    image = Image.new("RGBA", (4 * cellw + 196, top + len(choices) * rowh + 32), BG)
    header(image, "Order To Cook | 12 blocks x four directions", "Candidate generated meshes + configured cardinal transformations. Shared scale per row; rows independently fit.")
    draw = ImageDraw.Draw(image)
    for col, facing in enumerate(("north", "east", "south", "west")):
        draw.text((198 + col * cellw, 103), facing.upper(), fill=ACCENT, font=font(15, True))
    for row, (name, states) in enumerate(choices):
        scenes = []
        for facing in ("north", "east", "south", "west"):
            scenes.append(current.fridge(10, facing) if name == "refrigerator" else current.block(name, {**states, "minecraft:cardinal_direction": facing}))
        y = top + row * rowh
        draw.line((20, y, image.width - 20, y), fill=(177, 190, 195))
        caption(draw, (20, y + 38), [name.replace("_", " "), *[f"{key}={value}" for key, value in states.items()]], 13)
        camera = (3, 2.5, -4.2); fit = bounds(scenes, camera)
        for col, scene in enumerate(scenes):
            image.alpha_composite(raster(scene, (cellw - 12, rowh - 8), camera, fit), (188 + col * cellw, y + 3))
            CELLS.append({"sheet": "blocks-12-four-directions.png", "row": row, "column": col, "camera": camera, **metadata(scene)})
    image.convert("RGB").save(output / "blocks-12-four-directions.png")


def customers(current, output):
    columns, cellw, rowh, top = 4, 286, 330, 142
    rows = [("Standing idle", "customer_wait_1", .75, (3, 2, -5)),
            ("Seated idle (chair omitted)", "customer_sit_1", .75, (3, 2, -5)),
            ("Standing idle / back view", "customer_wait_1", .75, (-3, 2, 5))]
    image = Image.new("RGBA", (columns * cellw + 32, top + len(rows) * rowh + 45), BG)
    header(image, "Order To Cook | both customer skins", "Source hierarchy / converted entity comparisons at exact idle keyframes. Outer skin inflate layers included.")
    draw = ImageDraw.Draw(image)
    for col, label in enumerate(("JAVA ASSET / WIDE", "CANDIDATE / WIDE", "JAVA ASSET / SLIM", "CANDIDATE / SLIM")):
        draw.text((24 + col * cellw, 111), label, font=font(15, True), fill=ACCENT)
    for row, (title, clip, seconds, camera) in enumerate(rows):
        scenes = [customer_scene(current, slim, clip, seconds, original)
                  for slim in (False, True) for original in (True, False)]
        fit = bounds(scenes, camera)
        y = top + row * rowh
        draw.line((24, y, image.width - 24, y), fill=(177, 190, 195))
        caption(draw, (24, y + 8), [f"{title} | {clip} at t={seconds:.2f}s"], 14)
        for col, scene in enumerate(scenes):
            image.alpha_composite(raster(scene, (cellw - 16, rowh - 42), camera, fit), (16 + col * cellw, y + 36))
            CELLS.append({"sheet": "customers-two-skins.png", "row": row, "column": col,
                          "title": title, "camera": camera, **metadata(scene)})
    caption(draw, (24, image.height - 32), ["Static poses verify model, skin and idle keyframes. In-game head tracking and action playback require client capture."], 13)
    image.convert("RGB").save(output / "customers-two-skins.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or args.repo / "docs/validation/0.1.6-alpha.1/visual"
    output.mkdir(parents=True, exist_ok=True)
    current, baseline = Pack(args.repo.resolve(), "CANDIDATE"), Pack(args.baseline.resolve(), "BASELINE main")
    focused(current, baseline, output)
    plates(current, output)
    blocks(current, output)
    customers(current, output)
    source_lock = read(args.repo / "upstream/source.lock.json")
    record(Path(__file__).resolve())
    roots = [(str(current.root), "candidate"), (str(baseline.root), "baseline")]
    inputs = []
    for path, sha in sorted(INPUTS.items()):
        role, relative = next((role, str(Path(path).relative_to(root))) for root, role in roots if Path(path).is_relative_to(root))
        inputs.append({"role": role, "path": relative, "sha256": sha})
    manifest = {"kind": "offline-textured-model-render", "is_game_screenshot": False,
                "source_revision": source_lock["commit"],
                "baseline_commit": "ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49",
                "method": "CPU orthographic two-sided textured triangles; depth buffer; nearest texels; alpha cutout; signed source cubes; direct source bone affine evaluation",
                "coordinate_reference": "https://github.com/bernie-g/geckolib/blob/7d6f32db9168a24e14b327c0ad9f8f87dfc204de/Forge/src/main/java/software/bernie/geckolib/loading/object/BakedModelFactory.java",
                "two_sided_source_material_reference": "https://github.com/bernie-g/geckolib/blob/7d6f32db9168a24e14b327c0ad9f8f87dfc204de/Forge/src/main/java/software/bernie/geckolib/model/GeoModel.java",
                "limitations": ["Not Java or Bedrock game-client screenshots", "Two-sided inspection: GPU material and face-culling behavior are not validated", "No engine lighting, fog or mipmap validation", "No multiplayer, input, audio or animation playback validation", "Static block appliance poses may retain cuboid approximations of source shear; source column uses the full affine"],
                "cells": CELLS, "inputs": inputs,
                "outputs": [{"path": path.name, "sha256": digest(path), "bytes": path.stat().st_size} for path in sorted(output.glob("*.png"))]}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"output": str(output), "sheets": len(manifest["outputs"]), "cells": len(CELLS), "inputs": len(inputs)}))


if __name__ == "__main__":
    main()
