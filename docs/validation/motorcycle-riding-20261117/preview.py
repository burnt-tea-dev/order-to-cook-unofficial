#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Compare actual riding-exporter outputs with a deterministic CPU renderer.

This is a before/after visualization, never a Java-animation oracle or a game
screenshot. Both exporters consume the same externally supplied native inputs.
The full four-part emitted animation is combined before evaluating the unchanged
model hierarchy. Native look, item, controller, skin selection and gameplay are
outside this review. Native input/output geometry is kept in temporary storage.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from types import ModuleType

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
BASELINE = "1c47c5779e6b7a7ef111c70a276541d84468eb74"
NATIVE_COMMIT = "15701fa9c13923f12662984c32c124327e40e3d3"
JAVA_COMMIT = "e59e3dbcabe19b783d9adb933db5fcb8bc1e4642"
PARTS = ("body", "head", "right", "left")
CAMERA = (4, 2.2, -5)
VARIANTS = ("classic", "slim")
NATIVE_HASHES = {
    "classic": "d3688f959a95f6b39c9bd8b15312a19361256ae161d2d055ba63d810e17a8ca8",
    "slim": "0279492e5f6a7b5bbafb4fbaa80290146acb79332d06ac39619376a4831ff464",
}
VISIBLE = {"body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg",
           "ordertocook_right_forearm", "ordertocook_left_forearm",
           "ordertocook_right_shin", "ordertocook_left_shin"}
COLORS = {
    "body": (57, 117, 141), "head": (221, 180, 132),
    "rightArm": (188, 112, 68), "leftArm": (188, 112, 68),
    "ordertocook_right_forearm": (233, 167, 106),
    "ordertocook_left_forearm": (233, 167, 106),
    "rightLeg": (59, 74, 105), "leftLeg": (59, 74, 105),
    "ordertocook_right_shin": (100, 127, 166),
    "ordertocook_left_shin": (100, 127, 166),
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_module(name, path, source=None):
    # Keep the converter's ordinary repo-relative inputs. Only the baseline
    # program text comes from the fixed git object; no checkout is changed.
    if source is not None:
        module = ModuleType(name)
        module.__file__ = str(path)
        sys.modules[name] = module
        exec(compile(source, str(path), "exec"), module.__dict__)
        return module
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def load_export(module, native_paths, destination):
    module.SOURCE = ROOT / "upstream/reference"
    module.ASSETS = module.SOURCE / module.ASSET_REL
    native = module.native_player_variants(*(module.read_json(p) for p in native_paths))
    module.make_player_riding_source(native, destination)
    contract = json.loads((destination / "player-riding.json").read_text())
    animation_path = destination / "RP/animations/ordertocook_player_riding.animation.json"
    animations = json.loads(animation_path.read_text())["animations"]
    geometry = {name: json.loads((destination / contract["variants"][name]["file"]).read_text())
                ["minecraft:geometry"][0] for name in VARIANTS}
    hashes = {str(p.relative_to(destination)): sha(p.read_bytes())
              for p in sorted(destination.rglob("*.json"))}
    return geometry, animations, hashes


def merged_clip(animations, variant, clip):
    bones = {}
    for part in PARTS:
        key = f"animation.ordertocook.player.riding.{variant}.{clip}.{part}"
        selected = animations[key]["bones"]
        if bones.keys() & selected.keys():
            raise ValueError("Exported riding parts overlap")
        bones.update(selected)
    return {"bones": bones}


def colored_model(geometry):
    # Replace material lookup only. Never alter pivots, parents or vertices.
    # Native clothing/hat/cape/item meshes are hidden for this pose comparison;
    # the source transforms on all their parents remain in the actual hierarchy.
    model = copy.deepcopy(geometry)
    materials = {}
    for bone in model["bones"]:
        name = bone["name"]
        if name not in VISIBLE:
            bone.pop("cubes", None)
            continue
        materials[name] = np.array([[(*COLORS[name], 255)]], dtype=np.uint8)
        for cube in bone.get("cubes", []):
            cube["uv"] = {face: {"uv": [0, 0], "uv_size": [1, 1], "material_instance": name}
                          for face in ("west", "east", "north", "south", "up", "down")}
    return model, materials


def scene(renderer, export, variant, clip, seconds):
    geometry, animations, _ = export
    model, materials = colored_model(geometry[variant])
    animation = merged_clip(animations, variant, clip)
    return {"quads": renderer.geometry_quads(model, materials, animation, seconds),
            "variant": variant, "clip": clip, "seconds": seconds}


def difference(before, after):
    a = np.concatenate([quad[0] for quad in before["quads"]])
    b = np.concatenate([quad[0] for quad in after["quads"]])
    if a.shape != b.shape:
        raise ValueError("A pose-only comparison needs the same mesh topology")
    deltas = np.linalg.norm(a-b, axis=1)
    index = int(deltas.argmax())
    return float(deltas[index]), a[index], b[index]


def mark_corner(renderer, image, point, fit):
    width, height = image.size
    low, high = fit
    span = np.maximum(high-low, 1)
    scale = min((width-24)/span[0], (height-20)/span[1])
    projected = np.asarray(point) @ renderer.camera_basis(CAMERA).T
    x = (projected[0]-(low[0]+high[0])/2)*scale + width/2
    y = height/2 - (projected[1]-(low[1]+high[1])/2)*scale
    draw = ImageDraw.Draw(image)
    draw.ellipse((x-4, y-4, x+4, y+4), outline=(190, 44, 51), width=2)


def title(renderer, image, heading, detail):
    draw = ImageDraw.Draw(image)
    draw.text((24, 16), heading, font=renderer.font(25, True), fill=renderer.INK)
    draw.text((24, 52), "OFFLINE MODEL RENDER / NOT GAME", font=renderer.font(16, True), fill=renderer.ACCENT)
    draw.text((24, 79), detail, font=renderer.font(13), fill=renderer.INK)


def comparison_sheet(renderer, before, after, output):
    rows = [("drive_idle", .5, "Idle / Catmull-Rom sample"),
            ("drive_didi", .2, "Horn / elastic sample"),
            ("drive_back", .5, "Reverse / unchanged linear control")]
    width, cellw, cellh, top, rowh = 1440, 348, 298, 145, 362
    image = Image.new("RGBA", (width, top+len(rows)*rowh+54), renderer.BG)
    title(renderer, image, "Motorcycle riding | current main vs source-curve repair",
          "True native classic/slim bases. All four exported parts. Fixed camera and scale within each row.")
    draw = ImageDraw.Draw(image)
    for index, text in enumerate(("CLASSIC / main 1c47c57", "CLASSIC / candidate",
                                  "SLIM / main 1c47c57", "SLIM / candidate")):
        draw.text((24+index*356, 115), text, font=renderer.font(15, True), fill=renderer.ACCENT)
    records = []
    for row, (clip, seconds, label) in enumerate(rows):
        y = top + row*rowh
        scenes = [scene(renderer, export, variant, clip, seconds)
                  for variant in VARIANTS for export in (before, after)]
        fit = renderer.bounds(scenes, CAMERA)
        draw.line((20, y, width-20, y), fill=(177, 190, 195), width=1)
        draw.text((24, y+8), f"{label} / t={seconds:g}s", font=renderer.font(16, True), fill=renderer.INK)
        for pair, variant in enumerate(VARIANTS):
            delta, old, new = difference(*scenes[pair*2:pair*2+2])
            records.append({"variant": variant, "clip": clip, "seconds": seconds,
                            "max_visible_mesh_corner_delta_model_px": delta})
            draw.text((24+pair*712, y+34), f"Max corner displacement: {delta:.5f} model px",
                      font=renderer.font(13), fill=renderer.INK)
            for offset, point in enumerate((old, new)):
                index = pair*2 + offset
                frame = renderer.raster(scenes[index], (cellw, cellh), CAMERA, fit)
                if delta > 1e-5:
                    mark_corner(renderer, frame, point, fit)
                image.alpha_composite(frame, (20+index*356, y+58))
    renderer.caption(draw, (24, image.height-44), [
        "Red circle: projected corner with greatest 3D change (may be occluded). Debug colors; no skin/clothing/item evaluation.",
        "Neutral native look; empty hands; no vehicle, camera, network, controller-loop or in-game acceptance claim."], 12)
    image.convert("RGB").save(output / "riding-before-after.png")
    return records


def horn_gif(renderer, before, after, output):
    times = [index*.05 for index in range(27)] + [1.3333]
    scenes = {(index, variant, label): scene(renderer, export, variant, "drive_didi", seconds)
              for index, seconds in enumerate(times) for variant in VARIANTS
              for label, export in (("main", before), ("candidate", after))}
    fit = renderer.bounds(list(scenes.values()), CAMERA)
    frames = []
    max_delta = 0.0
    for index, seconds in enumerate(times):
        image = Image.new("RGBA", (800, 884), renderer.BG)
        title(renderer, image, "Motorcycle horn | sampled exporter outputs",
              f"t={seconds:.4f}s / fixed scale across all 28 frames / debug colors")
        draw = ImageDraw.Draw(image)
        for column, label in enumerate(("main", "candidate")):
            draw.text((24+column*394, 112), "MAIN 1c47c57" if label == "main" else "CANDIDATE",
                      font=renderer.font(16, True), fill=renderer.ACCENT)
        for row, variant in enumerate(VARIANTS):
            y = 142 + row*350
            pair = [scenes[index, variant, label] for label in ("main", "candidate")]
            delta, old, new = difference(*pair)
            max_delta = max(max_delta, delta)
            draw.text((24, y), f"{variant.upper()} / max corner displacement {delta:.5f} model px",
                      font=renderer.font(14), fill=renderer.INK)
            for column, (current, point) in enumerate(zip(pair, (old, new))):
                rendered = renderer.raster(current, (380, 316), CAMERA, fit)
                if delta > 1e-5:
                    mark_corner(renderer, rendered, point, fit)
                image.alpha_composite(rendered, (14+column*394, y+27))
        draw.text((24, 853), "Geometry/animation comparison only; no Minecraft client or playback validation.",
                  font=renderer.font(12), fill=renderer.INK)
        frames.append(image.convert("RGB"))
    frames[0].save(output / "horn-before-after.gif", save_all=True, append_images=frames[1:],
                   duration=[50]*27+[300], loop=0, disposal=2, optimize=False)
    return {"clip": "drive_didi", "times_seconds": times,
            "max_visible_mesh_corner_delta_model_px": max_delta,
            "final_frame_display_hold_ms": 300,
            "note": "Repeated comparison GIF; not a claim that the non-looping horn clip loops in game."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-classic", required=True, type=Path)
    parser.add_argument("--native-slim", required=True, type=Path)
    parser.add_argument("--native-license", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    native_paths = (args.native_classic, args.native_slim)
    for variant, path in zip(VARIANTS, native_paths):
        if sha(path.read_bytes()) != NATIVE_HASHES[variant]:
            parser.error(f"Expected the documented pinned Mojang {variant} input")
    if not args.native_license.is_file():
        parser.error("Supply the license accompanying the native input")
    sys.path.insert(0, str(ROOT / "tools"))
    baseline_text = subprocess.check_output(["git", "show", f"{BASELINE}:tools/convert_assets.py"], cwd=ROOT)
    shared_inputs = ["player-presentation.json", *[
        "upstream/reference/common/src/main/resources/assets/ordertocook/"+name for name in (
            "animations/drive.animation.json", "geo/drive_idle.geo.json", "geo/drive_idle_alex.geo.json")]]
    for relative in shared_inputs:
        original = subprocess.check_output(["git", "show", f"{BASELINE}:{relative}"], cwd=ROOT)
        if original != (ROOT / relative).read_bytes():
            raise ValueError("Before/after inputs differ: "+relative)
    baseline = load_module("riding_preview_baseline", ROOT / "tools/convert_assets.py", baseline_text)
    candidate = load_module("riding_preview_candidate", ROOT / "tools/convert_assets.py")
    renderer = load_module("riding_preview_raster", ROOT / "tools/render_visual_review.py")
    args.output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="otc-riding-preview-") as temp:
        before = load_export(baseline, native_paths, Path(temp) / "before")
        after = load_export(candidate, native_paths, Path(temp) / "after")
        if before[0] != after[0]:
            raise ValueError("This review is restricted to a pose-only repair; geometry changed")
        if before[1] == after[1]:
            raise ValueError("Candidate animation repair is not present")
        sheet = comparison_sheet(renderer, before, after, args.output)
        gif = horn_gif(renderer, before, after, args.output)
    source_paths = [ROOT / "tools/convert_assets.py", ROOT / "tools/render_visual_review.py",
                    Path(__file__).resolve(), ROOT / "tools/motorcycle_curves.py"]
    source_paths.extend(ROOT / relative for relative in shared_inputs)
    manifest = {
        "schema": 1, "purpose": "Actual-export before/after offline model visualization",
        "baseline_commit": BASELINE, "baseline_converter_sha256": sha(baseline_text),
        "candidate_git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "candidate_identity": "Working tree program hashes below; git head alone does not identify the candidate",
        "java_commit": JAVA_COMMIT, "native_commit": NATIVE_COMMIT,
        "native_input_sha256": NATIVE_HASHES,
        "native_license_sha256": sha(args.native_license.read_bytes()),
        "native_license_url": f"https://github.com/Mojang/bedrock-samples/blob/{NATIVE_COMMIT}/LICENSE.md",
        "source_files_sha256": {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in source_paths},
        "before_output_sha256": before[2], "after_output_sha256": after[2],
        "camera": CAMERA, "visible_mesh_bones": sorted(VISIBLE),
        "parts_combined": PARTS, "pose_sheet": sheet, "horn_gif": gif,
        "artifacts_sha256": {name: sha((args.output / name).read_bytes())
                             for name in ("riding-before-after.png", "horn-before-after.gif")},
        "limits": ["CPU rasterizer; not Minecraft screenshots or in-game acceptance",
                   "Compares actual exported outputs; source correctness is established separately by independent witnesses",
                   "Debug solid colors; hides hat, cape, clothing overlays and items; no skin or UV comparison",
                   "Neutral native head look and empty hands; evaluates all four exported animation parts together",
                   "Explicit clip time; no game controller, long loop, blending, camera, selector or network evaluation",
                   "20 TPS sampled intervals remain a linear approximation between keys",
                   "No native input or generated player geometry is redistributed with these images"],
    }
    (args.output / "preview-manifest.json").write_text(json.dumps(manifest, indent=2)+"\n")
    print(json.dumps({"pose_sheet": sheet, "horn_gif": gif, "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
