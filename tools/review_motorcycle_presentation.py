#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Render bounded motorcycle angle comparisons without a game or GUI.

The first sheet/GIF evaluates the actual active wheel expression at synthetic
nonnegative distances chosen to isolate its X sign. The second pair is explicitly
UNWIRED: selected source steering/signed phases, not a proposed input mapping.
All geometry/physical-face UVs come from the existing independent model oracle.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "tests"))
from motorcycle_oracle import BV, jfaces, jworld, rpfaces, rpworld
from test_motorcycle_presentation import (
    ANIMATION, CLIENT, DRIVE, GEOMETRY, SOURCE, active_pose, assert_pose,
    compare_pose, load_inputs, reference_pose, source_pose, wheel_coefficient,
)
from render_visual_review import BG, INK, ACCENT, bounds, font, raster

BASELINE = "8008294306180ece040b908684bf4fa11afb75c8"
UPSTREAM = "e59e3dbcabe19b783d9adb933db5fcb8bc1e4642"
CAMERA = (6, 2.6, -2.5)
REFERENCE_CAMERA = (4, 5.3, -6)
TEXTURE = REPO / "runtime/RP/textures/ordertocook/entity/motorcycle.png"
ORIGINAL_TEXTURE = REPO / "upstream/reference/common/src/main/resources/assets/ordertocook/textures/entity/motorcycle.png"
NATIVE_RIDER_URL = "https://raw.githubusercontent.com/Mojang/bedrock-samples/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json"
NATIVE_RIDER_SHA256 = "d3688f959a95f6b39c9bd8b15312a19361256ae161d2d055ba63d810e17a8ca8"


def digest_bytes(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def source_scene(java, texture):
    quads = []
    for name, bone in java.items():
        for cube in bone["cubes"]:
            inflation = cube["inflate"]
            faces = jfaces(cube)
            for face, bits in BV.items():
                vertices = []
                for physical in bits:
                    local_bits = [physical[0], 1 - physical[1], physical[2]]
                    point = [cube["origin"][axis] + cube["size"][axis] * local_bits[axis]
                             + inflation * (2 * local_bits[axis] - 1) for axis in range(3)]
                    vertices.append(jworld(java, name, point))
                # Oracle face corners are a 2x2 grid; raster needs perimeter order.
                order = [0, 1, 3, 2]
                quads.append((np.asarray(vertices)[order], np.asarray(faces[face])[order], texture))
    return {"quads": quads}


def bedrock_scene(bedrock, texture):
    quads = []
    for name, bone in bedrock.items():
        for cube in bone["cubes"]:
            inflation = cube.get("inflate", 0)
            low = [-cube["origin"][0] - cube["size"][0], *cube["origin"][1:]]
            faces = rpfaces(dict(cube, mirror=cube.get("mirror", bone.get("mirror", False))))
            for face, bits in BV.items():
                vertices = []
                for physical in bits:
                    point = [low[axis] + cube["size"][axis] * physical[axis]
                             + inflation * (2 * physical[axis] - 1) for axis in range(3)]
                    vertices.append(rpworld(bedrock, name, point))
                order = [0, 1, 3, 2]
                quads.append((np.asarray(vertices)[order], np.asarray(faces[face])[order], texture))
    return {"quads": quads}


def title(image, heading, detail, reference=False):
    draw = ImageDraw.Draw(image)
    draw.text((24, 14), heading, font=font(25, True), fill=INK)
    draw.text((24, 50), "OFFLINE MODEL RENDER - NOT GAME SCREENSHOTS", font=font(15, True), fill=ACCENT)
    draw.text((24, 77), detail, font=font(13), fill=INK)
    if reference:
        draw.text((24, 101), "REFERENCE ONLY / UNWIRED - steering and reverse are not active runtime controls",
                  font=font(14, True), fill=(143, 67, 28))


def active_sheet(output, java, bedrock, drive, before, texture):
    phases = (15, 60, 120)
    width, cell_width, row_height, top = 1248, 400, 296, 144
    image = Image.new("RGBA", (width, top + len(phases) * row_height + 42), BG)
    title(image, "Motorcycle | active X-angle sign", "Selected source angles; constructed nonnegative distance isolates sign. Existing gain is unchanged.")
    draw = ImageDraw.Draw(image)
    for column, label in enumerate(("SOURCE ANGLE", "BEFORE ACTIVE EXPRESSION", "CANDIDATE ACTIVE EXPRESSION")):
        draw.text((24 + column * 412, 113), label, font=font(15, True), fill=ACCENT)
    reports = []
    for row, phase in enumerate(phases):
        distance = phase / 114.6
        source = source_pose(java, 0, phase)
        old = active_pose(bedrock, before, distance)
        current = active_pose(bedrock, drive, distance)
        report = assert_pose(source, current)
        old_report = compare_pose(source, old)
        if old_report["max_corner_residual_pixels"] < 1:
            raise AssertionError("Before sign no longer discriminates this source pose")
        scenes = [source_scene(source, texture), bedrock_scene(old, texture), bedrock_scene(current, texture)]
        fit = bounds(scenes, CAMERA)
        y = top + row * row_height
        draw.line((24, y, width - 24, y), fill=(177, 190, 195))
        draw.text((24, y + 7), f"Fixed source wheel phase +{phase} deg  |  synthetic q.modified_distance_moved = {distance:.7f}",
                  font=font(14), fill=INK)
        for column, scene in enumerate(scenes):
            image.alpha_composite(raster(scene, (cell_width, row_height - 45), CAMERA, fit), (16 + column * 412, y + 36))
        reports.append({"source_steer_degrees": 0, "source_wheel_degrees": phase,
                        "synthetic_modified_distance": distance, "before": old_report, "candidate": report})
    draw.text((24, image.height - 29), "This proves a coordinate sign at selected angles; it does not equate accumulated travel with Java internal speed.",
              font=font(13), fill=INK)
    image.convert("RGB").save(output / "active-wheel-sign.png")
    return reports


def reference_sheet(output, java, bedrock, texture):
    poses = ((-45, 0), (45, 0), (0, -60), (0, 60), (-45, 120), (45, -60))
    width, row_height, top = 1000, 230, 160
    image = Image.new("RGBA", (width, top + len(poses) * row_height + 40), BG)
    title(image, "Motorcycle | signed phase and two-axis references", "Original hierarchy, texture, zero-width planes and inflation. No source movement simulation.", True)
    draw = ImageDraw.Draw(image)
    draw.text((24, 132), "PINNED JAVA MODEL POSE", font=font(15, True), fill=ACCENT)
    draw.text((512, 132), "MAPPED RP REFERENCE (UNWIRED)", font=font(15, True), fill=ACCENT)
    reports = []
    for row, (steer, wheel) in enumerate(poses):
        source = source_pose(java, steer, wheel)
        reference = reference_pose(bedrock, steer, wheel)
        report = assert_pose(source, reference)
        scenes = [source_scene(source, texture), bedrock_scene(reference, texture)]
        fit = bounds(scenes, REFERENCE_CAMERA)
        y = top + row * row_height
        draw.line((24, y, width - 24, y), fill=(177, 190, 195))
        draw.text((24, y + 7), f"Selected Java steer {steer:+g} deg, wheel {wheel:+g} deg  |  RP front = [{wheel:+g}, {-steer:+g}, 0]",
                  font=font(14), fill=INK)
        for column, scene in enumerate(scenes):
            image.alpha_composite(raster(scene, (472, row_height - 40), REFERENCE_CAMERA, fit), (16 + column * 488, y + 34))
        reports.append({"source_steer_degrees": steer, "source_wheel_degrees": wheel, "reference": report})
    draw.text((24, image.height - 28), "Rear wheel receives X roll only. Handle/front share Y steering; selected phases do not bind player input.",
              font=font(13), fill=INK)
    image.convert("RGB").save(output / "unwired-signed-steering-reference.png")
    return reports


def animated_pair(output, java, bedrock, drive, texture, reference=False):
    if reference:
        selected = [(45 * math.sin(index * math.tau / 32), 120 * math.sin(index * math.tau / 32)) for index in range(32)]
        camera = REFERENCE_CAMERA
        filename = "unwired-signed-reference.gif"
    else:
        selected = [(0, index * 15) for index in range(24)]
        camera = CAMERA
        filename = "active-positive-phase.gif"
    pairs = []
    records = []
    for steer, wheel in selected:
        source = source_pose(java, steer, wheel)
        candidate = reference_pose(bedrock, steer, wheel) if reference else active_pose(bedrock, drive, wheel / 114.6)
        assert_pose(source, candidate)
        pairs.append([source_scene(source, texture), bedrock_scene(candidate, texture)])
        records.append({"selected_source_steer_degrees": steer, "selected_source_wheel_degrees": wheel,
                        **({} if reference else {"synthetic_modified_distance": wheel / 114.6})})
    fit = bounds([scene for pair in pairs for scene in pair], camera)
    frames = []
    for pair, record in zip(pairs, records):
        frame = Image.new("RGBA", (848, 432), BG)
        draw = ImageDraw.Draw(frame)
        label = "UNWIRED REFERENCE POSES" if reference else "ACTUAL CANDIDATE EXPRESSION / SYNTHETIC DISTANCE"
        draw.text((18, 13), label, font=font(17, True), fill=ACCENT)
        draw.text((18, 42), "OFFLINE MODEL RENDER - NOT GAME SCREENSHOTS", font=font(14, True), fill=INK)
        draw.text((18, 68), "Source pose", font=font(14, True), fill=INK)
        draw.text((438, 68), "Mapped reference (unwired)" if reference else "Candidate active wheel expression", font=font(14, True), fill=INK)
        for column, scene in enumerate(pair):
            frame.alpha_composite(raster(scene, (410, 280), camera, fit), (8 + column * 424, 92))
        draw.text((18, 377), f"Selected source steer {record['selected_source_steer_degrees']:+.1f} deg, wheel {record['selected_source_wheel_degrees']:+.1f} deg",
                  font=font(14), fill=INK)
        draw.text((18, 404), "100 ms review frames; arbitrary playback, no game-time / input / vehicle-physics claim", font=font(12), fill=INK)
        frames.append(frame.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(output / filename, save_all=True, append_images=frames[1:], duration=100,
                   loop=0, optimize=False, disposal=2)
    return {"file": filename, "frame_duration_ms": 100, "camera": list(camera), "reference_only": reference, "frames": records}


def rider_sheet(output, native_path):
    # Only these independent source sample / forward evaluation helpers run.
    # Their inverse-retargeting and production-sampler test helpers are unused.
    from test_motorcycle_rider import source_reference, forward_point
    original_path = REPO / "upstream/reference/common/src/main/resources/assets/ordertocook/animations/drive.animation.json"
    rig_path = REPO / "upstream/reference/common/src/main/resources/assets/ordertocook/geo/drive_idle.geo.json"
    clip_path = REPO / "runtime/RP/animations/motorcycle_player.animation.json"
    original = json.loads(original_path.read_text())["animations"]["drive_idle"]
    source_rig = json.loads(rig_path.read_text())["minecraft:geometry"][0]["bones"]
    source_lookup = {bone["name"]: bone for bone in source_rig}
    native_bytes = native_path.read_bytes()
    if digest_bytes(native_bytes) != NATIVE_RIDER_SHA256:
        raise AssertionError("Native classic reference must match the reviewed pinned Mojang input")
    native = json.loads(native_bytes)["minecraft:geometry"][0]
    if native["description"]["identifier"] != "geometry.humanoid.custom":
        raise AssertionError("Wrong native player variant")
    native_rig = native["bones"]
    native_lookup = {bone["name"]: bone for bone in native_rig}
    actual = json.loads(clip_path.read_text())["animations"]["animation.ordertocook.player.motorcycle_idle"]["bones"]
    source_selection = {name: (1 if name == "torso" else 0) for name in
                        ("torso", "head", "right_arm", "right_hand", "left_arm", "left_hand",
                         "right_leg", "right_foot", "left_leg", "left_foot")}
    native_selection = {name: 0 for name in ("body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg")}

    def mesh(rig, pose, selection, time=None):
        quads = []
        for bone in rig:
            if bone.get("rotation", [0, 0, 0]) != [0, 0, 0]:
                raise AssertionError("Review new static rider bone rotations")
            name = bone["name"]
            if name not in selection:
                continue
            cube = bone["cubes"][selection[name]]
            if cube.get("rotation", [0, 0, 0]) != [0, 0, 0]:
                raise AssertionError("Review new static rider cube rotations")
            color = ((65, 130, 158) if name.startswith("right") else (178, 117, 80) if name.startswith("left")
                     else (203, 193, 173) if name == "head" else (130, 141, 147))
            neutral_texture = np.asarray([[(*color, 255)]], dtype=np.uint8)
            for bits in BV.values():
                vertices = []
                for physical in bits:
                    point = [cube["origin"][axis] + cube["size"][axis] * physical[axis]
                             + cube.get("inflate", 0) * (2 * physical[axis] - 1) for axis in range(3)]
                    transformed = forward_point(rig, pose, name, point, time)
                    transformed[0] *= -1  # Explicit common display reflection.
                    vertices.append(transformed)
                quads.append((np.asarray(vertices)[[0, 1, 3, 2]], np.zeros((4, 2)), neutral_texture))
        return {"quads": quads}

    def endpoints(source_pose, time):
        errors = []
        for side in ("right", "left"):
            for upper, lower, native_name in (("arm", "hand", side + "Arm"), ("leg", "foot", side + "Leg")):
                upper_cube = source_lookup[side + "_" + upper]["cubes"][0]
                lower_cube = source_lookup[side + "_" + lower]["cubes"][0]
                native_cube = native_lookup[native_name]["cubes"][0]
                sx = upper_cube["origin"][0] + upper_cube["size"][0] / 2
                nx = native_cube["origin"][0] + native_cube["size"][0] / 2
                points = ((side + "_" + upper, [sx, upper_cube["origin"][1] + upper_cube["size"][1], 0],
                           [nx, native_cube["origin"][1] + native_cube["size"][1], 0]),
                          (side + "_" + lower, [sx, lower_cube["origin"][1], 0], [nx, native_cube["origin"][1], 0]))
                for source_name, sp, np_ in points:
                    errors.append(math.dist(forward_point(source_rig, source_pose, source_name, sp),
                                            forward_point(native_rig, actual, native_name, np_, time)))
        for point in ([0, 24, 0], [1, 24, 0], [0, 25, 0], [0, 24, 1]):
            errors.append(math.dist(forward_point(source_rig, source_pose, "head", point),
                                    forward_point(native_rig, actual, "head", point, time)))
        if max(errors) >= 1e-4:
            raise AssertionError({"time": time, "rider_endpoint_residuals": errors})
        return {"checked_points": len(errors), "max_endpoint_residual_pixels": max(errors)}

    times = (0, .5, 5, 7)
    camera = (4, 2.1, -7)
    poses, pairs = [], []
    for seconds in times:
        source_pose = source_reference(original, seconds)
        poses.append({"seconds": seconds, **endpoints(source_pose, seconds)})
        pairs.append([mesh(source_rig, source_pose, source_selection), mesh(native_rig, actual, native_selection, seconds)])
    fit = bounds([scene for pair in pairs for scene in pair], camera)
    width, top, row_height = 1000, 168, 288
    image = Image.new("RGBA", (width, top + len(times) * row_height + 53), BG)
    title(image, "Motorcycle rider | bounded TP pose references", "Model-local comparison on actual source/native meshes. Neutral materials; no skin or armor imagery.")
    draw = ImageDraw.Draw(image)
    draw.text((24, 101), "RIGID ENDPOINT ADAPTATION - source elbows/knees remain visibly different", font=font(14, True), fill=(143, 67, 28))
    for column, label in enumerate(("SOURCE SEGMENTED RIG", "ACTUAL RP CLIP / NATIVE CLASSIC RIG")):
        draw.text((24 + column * 488, 133), label, font=font(15, True), fill=ACCENT)
    for row, (pair, report) in enumerate(zip(pairs, poses)):
        y = top + row * row_height
        draw.line((24, y, width - 24, y), fill=(177, 190, 195))
        draw.text((24, y + 7), f"t = {report['seconds']:g} s  |  12 endpoint/head points: max residual {report['max_endpoint_residual_pixels']:.2e} model pixels",
                  font=font(14), fill=INK)
        for column, scene in enumerate(pair):
            image.alpha_composite(raster(scene, (472, row_height - 42), camera, fit), (16 + column * 488, y + 34))
    draw.text((24, image.height - 41), "Head/torso: neutral gray. Right limbs: blue; left limbs: clay. Base mesh cubes only; overlays omitted.", font=font(13), fill=INK)
    draw.text((24, image.height - 22), "No seat/world anchor, body yaw, FP view, skin selection, material, multiplayer or client acceptance claim.", font=font(13), fill=INK)
    image.convert("RGB").save(output / "rider-tp-pose-reference.png")
    return {"file": "rider-tp-pose-reference.png", "camera": list(camera), "poses": poses,
            "scope": "Bounded model-local base-mesh preview; endpoint/head agreement, not surface/UV or source segmentation parity.",
            "source_cube_selection": source_selection, "native_cube_selection": native_selection,
            "native_geometry": {"url": NATIVE_RIDER_URL, "sha256": NATIVE_RIDER_SHA256,
                                "identifier": native["description"]["identifier"], "bytes": len(native_bytes), "redistributed": False},
            "inputs": {str(path.relative_to(REPO)): digest_bytes(path.read_bytes()) for path in
                       (original_path, rig_path, clip_path, REPO / "tests/test_motorcycle_rider.py")}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--native-rider-geometry", type=Path, help="Optional exact pinned Mojang classic input; held outside repository/runtime")
    args = parser.parse_args()
    output = args.output.resolve()
    if output == REPO / "runtime" or REPO / "runtime" in output.parents:
        raise ValueError("Review output must remain outside runtime")
    output.mkdir(parents=True, exist_ok=True)
    java, bedrock, drive = load_inputs()
    before_bytes = subprocess.run(["git", "show", f"{BASELINE}:runtime/RP/animations/runtime.animation.json"],
                                  cwd=REPO, check=True, capture_output=True).stdout
    before = json.loads(before_bytes)["animations"][DRIVE]
    for name in ("front_t", "rear_t"):
        if wheel_coefficient(before["bones"][name]["rotation"][0]) != -114.6:
            raise AssertionError("Unexpected pinned before binding")
    if TEXTURE.read_bytes() != ORIGINAL_TEXTURE.read_bytes():
        raise AssertionError("Original motorcycle texture is no longer byte-identical")
    texture = np.asarray(Image.open(TEXTURE).convert("RGBA"))
    active = active_sheet(output, java, bedrock, drive, before, texture)
    reference = reference_sheet(output, java, bedrock, texture)
    animations = [animated_pair(output, java, bedrock, drive, texture),
                  animated_pair(output, java, bedrock, drive, texture, reference=True)]
    rider = rider_sheet(output, args.native_rider_geometry) if args.native_rider_geometry else None
    inputs = [SOURCE, GEOMETRY, ANIMATION, CLIENT, TEXTURE, ORIGINAL_TEXTURE,
              REPO / "tests/motorcycle_oracle.py", REPO / "tests/test_motorcycle_presentation.py",
              REPO / "tools/render_visual_review.py", Path(__file__).resolve()]
    manifest = {
        "upstream_commit": UPSTREAM, "before_commit": BASELINE,
        "before_animation_sha256": digest_bytes(before_bytes),
        "before_drive_clip": before,
        "active_drive_clip": drive,
        "scope": "Offline CPU geometry/UV comparisons. No GUI, Minecraft client, BDS, player input or native Molang execution.",
        "coordinate_frame": "(Java X, 24 - Java Y, Java Z); renderer constant +0.016 model-pixel Y normalized as in MOTORCYCLE_SOURCE_MAPPING.md.",
        "rendering": "Depth buffer, nearest texel, common neutral lighting, double-sided inspection, alpha >= 128. No native shader/culling claim.",
        "active_contract": "Constructed nonnegative query distances isolate the active X sign. Gain 114.6 is retained, not identified with Java internal speed.",
        "reference_contract": "Signed wheel/steering samples are explicitly unwired coordinate references, not input or reverse-control implementation.",
        "inputs": {str(path.relative_to(REPO)): digest_bytes(path.read_bytes()) for path in inputs},
        "active_sheet": {"file": "active-wheel-sign.png", "camera": list(CAMERA), "poses": active},
        "reference_sheet": {"file": "unwired-signed-steering-reference.png", "camera": list(REFERENCE_CAMERA), "poses": reference},
        "animations": animations,
        "rider": rider,
        "outputs": {path.name: {"sha256": digest_bytes(path.read_bytes()), "bytes": path.stat().st_size}
                    for path in sorted(output.iterdir()) if path.suffix in (".png", ".gif")},
    }
    write_json(output / "preview-manifest.json", manifest)
    print(json.dumps({"output": str(output), "max_candidate_corner_residual": max(
        row["candidate"]["max_corner_residual_pixels"] for row in active), "files": list(manifest["outputs"])}))


if __name__ == "__main__":
    main()
