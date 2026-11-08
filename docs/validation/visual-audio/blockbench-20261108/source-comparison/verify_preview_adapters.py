#!/usr/bin/env python3
"""Check the documented preview-only adapters. Never write runtime assets."""

import importlib.util
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = next(p for p in HERE.parents if (p / "upstream/source.lock.json").is_file())
ASSETS = ROOT / "upstream/reference/common/src/main/resources/assets/ordertocook"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def unwrap(value):
    if isinstance(value, list):
        return [unwrap(v) for v in value]
    if isinstance(value, dict):
        assert "easing" not in value and "easingArgs" not in value
        if "vector" in value:
            assert set(value) == {"vector"}, "Do not silently discard metadata"
            return unwrap(value["vector"])
        return {key: unwrap(v) for key, v in value.items()}
    return value


dishwasher = unwrap(read(ASSETS / "animations/dishwasher.animation.json"))
dishwasher["animations"] = {
    "animation.qa_java.dishwasher." + key: value
    for key, value in dishwasher["animations"].items()
}
assert dishwasher == read(HERE / "java-dishwasher.animation.json")

spec = importlib.util.spec_from_file_location("convert_assets", ROOT / "tools/convert_assets.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
fridge = read(ASSETS / "animations/refrigerator.animation.json")["animations"]
expected = {"format_version": "1.8.0", "animations": {}}
largest_error = 0.0
for clip_name, bone_name, angle in (("up_open", "bone2", -135), ("down_open", "bone3", -125)):
    clip = fridge[clip_name]
    assert clip["loop"] == "hold_on_last_frame" and clip["animation_length"] == 1
    assert set(clip["bones"]) == {bone_name}
    assert set(clip["bones"][bone_name]) == {"rotation"}
    rotation = clip["bones"][bone_name]["rotation"]
    assert rotation == {
        "0.0": {"vector": [0, 0, 0]},
        "1.0": {"vector": [0, angle, 0], "easing": "easeInElastic"},
    }
    expression = (
        f"{angle} * (1 - math.pow(math.cos(math.clamp(q.anim_time, 0, 1) * 90), 3)"
        " * math.cos(math.clamp(q.anim_time, 0, 1) * 180))"
    )
    expected["animations"]["animation.qa_java.refrigerator." + clip_name] = {
        "loop": "hold_on_last_frame", "animation_length": 1,
        "bones": {bone_name: {"rotation": [0, expression, 0]}},
    }
    for index in range(1001):
        time = index / 1000
        preview = angle * (1 - math.cos(math.radians(time * 90)) ** 3 * math.cos(math.radians(time * 180)))
        original = converter.sample_channel(rotation, time, [0, 0, 0])[1]
        error = abs(preview - original)
        largest_error = max(largest_error, error)
        assert error < 1e-10, (clip_name, time, error)
assert expected == read(HERE / "java-refrigerator-open.animation.json")
print("PASS: dishwasher adapter preserves normalized source structure")
print(f"PASS: fridge preview expressions match 2 x 1001 samples; maximum error {largest_error:.3g} degrees")
