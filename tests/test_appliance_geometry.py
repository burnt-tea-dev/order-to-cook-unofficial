#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Exercise the actual offline converter against its pinned source and outputs."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("converter", ROOT / "tools/convert_assets.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
converter.ASSETS = ROOT / "upstream/reference" / converter.ASSET_REL

class ApplianceGeometryTests(unittest.TestCase):
    def setUp(self):
        self.source = converter.normalize_geo(converter.ASSETS / "geo/block/refrigerator.geo.json", "geometry.source")
        self.clips = converter.read_json(converter.ASSETS / "animations/refrigerator.animation.json")["animations"]

    def pose(self, half, frame):
        return converter.bake_pose(converter.split_fridge_geo(self.source, half),
            self.clips["up_open" if half == "upper" else "down_open"], frame/10,
            f"geometry.ordertocook.refrigerator_{half}_{frame}")

    def test_all_22_committed_fridge_poses_reproduce_from_the_converter(self):
        for half in ("lower", "upper"):
            for frame in range(11):
                with self.subTest(half=half, frame=frame):
                    result = converter.bound_fridge_swing(self.pose(half, frame), half)
                    converter.assert_block_bounds(result)
                    expected = converter.read_json(ROOT / f"runtime/RP/models/blocks/refrigerator_{half}_{frame}.geo.json")
                    self.assertEqual(result, expected)

    def test_guard_preserves_door_sizes_uvs_angles_and_cabinet(self):
        for half, frame in (("lower", 7), ("upper", 6)):
            original = self.pose(half, frame)
            result = converter.bound_fridge_swing(copy.deepcopy(original), half)
            name = "bone3" if half == "lower" else "bone2"
            for before, after in zip(original["minecraft:geometry"][0]["bones"], result["minecraft:geometry"][0]["bones"]):
                if before["name"] != name:
                    self.assertEqual(before, after)
                    continue
                self.assertEqual(before["rotation"], after["rotation"])
                self.assertEqual(before["pivot"][:2], after["pivot"][:2])
                shift = after["pivot"][2] - before["pivot"][2]
                self.assertGreater(shift, 0)
                self.assertLess(shift, 0.126)
                for a, b in zip(before["cubes"], after["cubes"]):
                    self.assertEqual(a["size"], b["size"])
                    self.assertEqual(a["uv"], b["uv"])
                    self.assertEqual(a["origin"][:2], b["origin"][:2])
                    self.assertAlmostEqual(b["origin"][2] - a["origin"][2], shift, places=6)
            low, high = converter.geometry_bounds(result)
            self.assertGreaterEqual(low[2], -22 + 1/2048)
            self.assertLessEqual(high[2]-low[2], 30 - 1/2048)

    def test_closed_and_fully_open_source_poses_are_unchanged(self):
        for half in ("lower", "upper"):
            for frame in (0, 10):
                original = self.pose(half, frame)
                self.assertEqual(converter.bound_fridge_swing(copy.deepcopy(original), half), original)

    def test_native_position_limits_are_not_confused_with_total_extent(self):
        for axis, value in ((0, -23), (0, 22.1), (1, -15), (1, 30.1), (2, -23), (2, 22.1)):
            origin = [0, 0, 0]; origin[axis] = value
            model = converter.geometry("geometry.invalid", [{"name": "root", "pivot": [0,0,0], "cubes": [{"origin": origin, "size": [0.5]*3, "uv": {}}]}])
            with self.subTest(axis=axis, value=value), self.assertRaises(ValueError):
                converter.assert_block_bounds(model)

    def test_excessive_swing_is_rejected_instead_of_silently_distorting_the_model(self):
        model = self.pose("lower", 7)
        door = next(b for b in model["minecraft:geometry"][0]["bones"] if b["name"] == "bone3")
        door["pivot"][2] -= 1
        for cube in door["cubes"]:
            cube["origin"][2] -= 1
        with self.assertRaises(ValueError):
            converter.bound_fridge_swing(model, "lower")

if __name__ == "__main__":
    unittest.main()
