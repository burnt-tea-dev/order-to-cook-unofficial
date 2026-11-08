#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Compare the rendered plate stages to pinned Java models and exact PNG pixels."""
import json
from pathlib import Path
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "upstream/reference/common/src/main/resources/assets/ordertocook"


def read(path):
    return json.loads(path.read_text())


class DiningAssetTests(unittest.TestCase):
    def test_client_synced_elapsed_properties_use_native_float_literals(self):
        # BDS rejects an integer JSON default (0) for a float property and
        # consequently fails to load the actor's properties. Python's JSON
        # decoder preserves the distinction between 0 and the required 0.0.
        for actor, name, maximum in (("customer", "action_elapsed", 6.0),
                                     ("dining_plate", "placement_age", 0.5)):
            with self.subTest(actor=actor, property=name):
                entity = read(ROOT / f"runtime/BP/entities/{actor}.json")["minecraft:entity"]
                prop = entity["description"]["properties"][f"ordertocook:{name}"]
                self.assertEqual(prop["type"], "float")
                self.assertIs(prop["client_sync"], True)
                self.assertIs(type(prop["default"]), float)
                self.assertEqual(prop["default"], 0.0)
                self.assertEqual(prop["range"], [0.0, maximum])
                for bound in prop["range"]:
                    self.assertIs(type(bound), float)

    def test_native_plate_keeps_java_collision_and_all_stable_models(self):
        block = read(ROOT / "runtime/BP/blocks/dining_plate_block.json")["minecraft:block"]
        components = block["components"]
        # FoodPlateBlock.SHAPE: box(1,0,1,15,2,15) + box(3,2,3,13,5,13).
        self.assertEqual(components["minecraft:collision_box"], [
            {"origin": [-7, 0, -7], "size": [14, 2, 14]},
            {"origin": [-5, 2, -5], "size": [10, 3, 10]},
        ])
        self.assertEqual(components["minecraft:selection_box"],
                         {"origin": [-7, 0, -7], "size": [14, 5, 14]})
        # Stage zero has a legal finite placeholder mesh hidden by the native
        # component. A string-only reference would expose that placeholder.
        self.assertEqual(components["minecraft:geometry"], {
            "identifier": "geometry.ordertocook.dining_plate_empty",
            "bone_visibility": {"root": False},
        })
        stages = {p["components"]["minecraft:geometry"] for p in block["permutations"]
                  if "minecraft:geometry" in p["components"]}
        self.assertEqual(stages, {f"geometry.ordertocook.dining_plate_{i}" for i in range(1, 41)})

    def test_all_food_stage_shapes_and_uvs_retain_the_java_source(self):
        variants = read(ASSETS / "blockstates/food_plate_display.json")["variants"]
        meshes = read(ROOT / "runtime/RP/models/entity/dining_plate.geo.json")["minecraft:geometry"]
        for stage in range(1, 41):
            with self.subTest(stage=stage):
                name = variants[f"facing=north,stage={stage}"]["model"].split(":")[1]
                model = read(ASSETS / "models" / (name + ".json"))
                cubes = meshes[stage]["bones"][0]["cubes"]
                self.assertEqual(len(cubes), len(model["elements"]))
                for cube, original in zip(cubes, model["elements"]):
                    high_x = 8 - cube["origin"][0]
                    recovered_from = [high_x - cube["size"][0], cube["origin"][1], cube["origin"][2] + 8]
                    recovered_to = [high_x, cube["origin"][1] + cube["size"][1], cube["origin"][2] + cube["size"][2] + 8]
                    self.assertFalse(original.get("rotation", {}).get("rescale", False))
                    for actual, expected in zip(recovered_from + recovered_to, original["from"] + original["to"]):
                        self.assertAlmostEqual(actual, expected, places=5)
                    # The source uses the 160px variant atlas. Recover its
                    # original 16-unit UVs from the remapped entity atlas.
                    for direction, face in original["faces"].items():
                        self.assertEqual(model["textures"][face["texture"][1:]], "ordertocook:block/food_plate_variants")
                        converted = cube["uv"][direction]
                        start = [(converted["uv"][0] - 38) / 10, (converted["uv"][1] - 2) / 10]
                        end = [start[0] + converted["uv_size"][0] / 10, start[1] + converted["uv_size"][1] / 10]
                        recovered = end + start if direction in ("up", "down") else start + end
                        for actual, expected in zip(recovered, face["uv"]):
                            self.assertAlmostEqual(actual, expected, places=5)
                        self.assertEqual(converted.get("uv_rotation", 0), face.get("rotation", 0))

    def test_stage_zero_and_food_atlas_pixels_are_exact_upstream_pixels(self):
        atlas = Image.open(ROOT / "runtime/RP/textures/ordertocook/entity/dining_plate_atlas.png").convert("RGBA")
        for name, x in (("food_plate_placed", 2), ("food_plate_variants", 38)):
            with self.subTest(texture=name):
                original = Image.open(ASSETS / f"textures/block/{name}.png").convert("RGBA")
                restored = atlas.crop((x, 2, x + original.width, 2 + original.height))
                self.assertEqual(restored.tobytes(), original.tobytes())
        # Both bundled customer skins remain the original pixel art as well.
        for name in ("otc_zombie_custom", "otc_zombie_custom2"):
            self.assertEqual((ROOT / f"runtime/RP/textures/ordertocook/entity/{name}.png").read_bytes(),
                             (ASSETS / f"textures/entity/{name}.png").read_bytes())


if __name__ == "__main__":
    unittest.main()
