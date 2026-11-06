#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Exercise the actual offline converter against its pinned source and outputs."""
import copy
import importlib.util
import json
import math
import itertools
import re
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("converter", ROOT / "tools/convert_assets.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
converter.ASSETS = ROOT / "upstream/reference" / converter.ASSET_REL


def posed_point(bones, animation, seconds, name, value):
    """Forward-render a source/native point; no inverse retargeting or arm fit."""
    lookup = {bone['name']: bone for bone in bones}
    while name:
        bone = lookup[name]; channels = animation.get('bones', {}).get(name, {})
        pivot = bone['pivot']
        scale = converter.sample_channel(channels.get('scale'), seconds, [1]*3)
        value = [pivot[i]+(value[i]-pivot[i])*scale[i] for i in range(3)]
        value = converter.geometry_transform3(value, converter.sample_channel(channels.get('rotation'), seconds, [0]*3), pivot)
        value = [a+b for a,b in zip(value, converter.sample_channel(channels.get('position'), seconds, [0]*3))]
        name = bone.get('parent')
    return value


def native_player_rig():
    # Mojang 1.26.60.5 humanoid.custom: legs have +/-1.9 pivots and cube centers.
    bones = [{'name': 'root', 'pivot': [0, 0, 0]},
             {'name': 'waist', 'parent': 'root', 'pivot': [0, 12, 0]},
             {'name': 'body', 'parent': 'waist', 'pivot': [0, 24, 0]},
             {'name': 'head', 'parent': 'body', 'pivot': [0, 24, 0]}]
    for side, sign in [('right', -1), ('left', 1)]:
        bones.extend([{'name': side+'Arm', 'parent': 'body', 'pivot': [sign*5, 22, 0]},
                      {'name': side+'Leg', 'parent': 'root', 'pivot': [sign*1.9, 12, 0]}])
    return bones


class ApplianceGeometryTests(unittest.TestCase):
    def setUp(self):
        self.source = converter.normalize_geo(converter.ASSETS / "geo/block/refrigerator.geo.json", "geometry.source")
        self.clips = converter.read_json(converter.ASSETS / "animations/refrigerator.animation.json")["animations"]

    def test_dining_plate_all_encoded_states_have_bounded_meshes_and_only_visible_food_stages(self):
        with TemporaryDirectory() as temp:
            output = Path(temp)
            with patch.multiple(converter, create=True, SOURCE=ROOT / 'upstream/reference', OUT=output,
                                BP=output/'BP', RP=output/'RP', PROVENANCE=[], GEOMETRY_SOURCES={}):
                converter.make_dining_plate()
            block = converter.read_json(output/'BP/blocks/dining_plate_block.json')['minecraft:block']
            geometries = {entry['description']['identifier']: entry
                          for name in ('blocks/dining_plate_empty', 'entity/dining_plate')
                          for entry in converter.read_json(output/f'RP/models/{name}.geo.json')['minecraft:geometry']}
        # Bedrock compiles all 16x3 encoded values, including 41..47. Execute
        # the emitted constant-state predicate subset, not a second stage map.
        states = block['description']['states']
        for low, high, direction in itertools.product(states['ordertocook:stage'], states['ordertocook:stage_high'],
                                                     ('north','south','east','west')):
            values={'ordertocook:stage':low,'ordertocook:stage_high':high,'minecraft:cardinal_direction':direction}
            query=SimpleNamespace(block_state=values.__getitem__)
            components=copy.deepcopy(block['components'])
            for row in block['permutations']:
                if eval(row['condition'], {'__builtins__': {}}, {'q': query}):
                    components.update(row['components'])
            reference=components['minecraft:geometry']
            identifier=reference if isinstance(reference,str) else reference['identifier']
            geometry=geometries[identifier]
            self.assertTrue(any(b.get('cubes') for b in geometry['bones']), 'empty block geometry has no finite mesh bounds')
            stage=low+16*high
            if stage == 0 or stage > 40:
                self.assertEqual(reference['bone_visibility'], {'root': False})
            else:
                self.assertEqual(identifier, f'geometry.ordertocook.dining_plate_{stage}')
            rotation=components['minecraft:transformation']['rotation']
            bounds=converter.geometry_bounds({'minecraft:geometry':[geometry]})
            for point in itertools.product(*zip(*bounds)):
                x,y,z=converter.geometry_transform3(point,rotation)
                self.assertTrue(-8-1e-6<=x<=8+1e-6 and -8-1e-6<=z<=8+1e-6 and 0<=y<=16,
                                (stage,direction,identifier,(x,y,z)))

    def test_native_block_factory_converts_legacy_material_occlusion_in_base_and_permutations(self):
        materials = {"*": {"texture": "test", "render_method": "alpha_test", "ambient_occlusion": False}}
        variants = [{"condition": "1", "components": {"minecraft:material_instances": copy.deepcopy(materials)}}]
        with TemporaryDirectory() as temp:
            with patch.object(converter, "BP", Path(temp), create=True):
                converter.block_definition("native_material_probe", "geometry.test", materials, variants=variants,
                                           native_container={"slot_count": 1})
            doc = converter.read_json(Path(temp) / "blocks/native_material_probe.json")
        self.assertEqual(doc["format_version"], "1.26.60")
        block = doc["minecraft:block"]
        self.assertEqual(block["components"]["minecraft:block_entity"]["container"]["slot_count"], 1)
        values = [block["components"]["minecraft:material_instances"]["*"]["ambient_occlusion"],
                  block["permutations"][-1]["components"]["minecraft:material_instances"]["*"]["ambient_occlusion"]]
        self.assertEqual(values, [0, 0])
        self.assertTrue(all(type(value) is int for value in values))
        self.assertIs(materials["*"]["ambient_occlusion"], False)

    def test_player_handwash_reproduces_both_bounded_perspectives(self):
        with TemporaryDirectory() as temp:
            output = Path(temp)
            with patch.multiple(converter, create=True, SOURCE=ROOT / 'upstream/reference', OUT=output, RP=output, PROVENANCE=[]):
                converter.make_player_handwashing_animation()
            generated = json.loads((output / 'animations/handwashing_player.animation.json').read_text())
        self.assertEqual(generated, json.loads((ROOT / 'runtime/RP/animations/handwashing_player.animation.json').read_text()))
        clips = generated['animations']
        third = clips['animation.ordertocook.player.handwash']
        first = clips['animation.ordertocook.player.handwash_first_person']
        for clip in (third, first):
            self.assertEqual(clip['animation_length'], 4)
            self.assertFalse(clip['loop'])
        self.assertEqual(third['blend_weight'], '!query.is_first_person')
        self.assertEqual(set(first['bones']), {'rightArm', 'leftArm'})
        for side, rotation in [('right', [95, -45, 115]), ('left', [95, 45, -115])]:
            arm = first['bones'][side+'Arm']
            self.assertEqual(arm['rotation']['0'], rotation)
            self.assertEqual(arm['rotation']['0'], arm['rotation']['4'])
            self.assertNotEqual(arm['rotation']['0'], arm['rotation']['0.5'])
        self.assertLessEqual(clips['animation.ordertocook.player.handwash_stop']['animation_length'], 0.1)

    def test_first_person_left_stroke_uses_its_own_source_and_leaves_other_actions_unchanged(self):
        expected = converter.read_json(ROOT / 'runtime/RP/animations/handwashing_player.animation.json')['animations']
        with TemporaryDirectory() as temp:
            source = Path(temp) / 'source'
            assets = source / converter.ASSET_REL
            for relative in ('animations/player_wash.animation.json', 'geo/drive_idle.geo.json'):
                document = converter.read_json(converter.ASSETS / relative)
                if relative.startswith('animations/'):
                    document['animations']['player_wash']['bones']['left_arm']['rotation']['0.5']['vector'][0] += 12
                converter.write_json(assets / relative, document)
            output = Path(temp) / 'output'
            with patch.multiple(converter, create=True, SOURCE=source, ASSETS=assets, OUT=output, RP=output, PROVENANCE=[]):
                converter.make_player_handwashing_animation()
            actual = converter.read_json(output / 'animations/handwashing_player.animation.json')['animations']
        fp = 'animation.ordertocook.player.handwash_first_person'
        self.assertNotEqual(actual[fp]['bones']['leftArm'], expected[fp]['bones']['leftArm'])
        self.assertEqual(actual[fp]['bones']['rightArm'], expected[fp]['bones']['rightArm'])
        for name, clip in expected.items():
            for bone, channels in clip.get('bones', {}).items():
                if bone != 'leftArm':
                    self.assertEqual(actual[name]['bones'][bone], channels, (name, bone))

    def test_player_handwash_preserves_source_body_and_arm_endpoints(self):
        # Forward-evaluate the actual source and generated animation. This does
        # not repeat the retargeter's direction fit or inverse-parent algorithm.
        source = converter.read_json(converter.ASSETS / 'geo/drive_idle.geo.json')['minecraft:geometry'][0]['bones']
        original = converter.unwrap_vectors(converter.read_json(converter.ASSETS / 'animations/player_wash.animation.json')['animations']['player_wash'])
        native = native_player_rig()
        clip = converter.read_json(ROOT / 'runtime/RP/animations/handwashing_player.animation.json')['animations']['animation.ordertocook.player.handwash']
        cases = [('torso', 'body', [0, 18, -2], [0, 18, -2]), ('head', 'head', [0, 28, -4], [0, 28, -4]),
                 ('right_leg', 'rightLeg', [-2, 0, 0], [-1.9, 0, 0]), ('left_leg', 'leftLeg', [2, 0, 0], [1.9, 0, 0])]
        for side, sign in [('right', -1), ('left', 1)]:
            cases += [(side+'_arm', side+'Arm', [sign*6, 24, 0], [sign*6, 24, 0]),
                      (side+'_hand', side+'Arm', [sign*6, 12, 0], [sign*6, 12, 0])]
        for seconds in (0, .025, .25, .5, .75, 1, 1.975, 2, 2.025, 3.975, 4):
            for old, new, vertex, native_vertex in cases:
                expected = posed_point(source, original, seconds % 2, old, vertex)
                actual = posed_point(native, clip, seconds, new, native_vertex)
                self.assertLess(math.dist(expected, actual), .02, (seconds, old, expected, actual))

    def test_first_person_actions_keep_source_arm_length_and_native_shoulder_anchor(self):
        source = converter.read_json(converter.ASSETS / 'geo/drive_idle.geo.json')['minecraft:geometry'][0]['bones']
        for filename, action, generate, output_name, clip_name, period in [
            ('player_wash', 'player_wash', converter.make_player_handwashing_animation, 'handwashing', 'handwash', 2),
            ('player', 'player_sit&clap', converter.make_player_chair_clap_animation, 'chair_clap', 'chair_clap', None)
        ]:
            original = converter.unwrap_vectors(converter.read_json(converter.ASSETS / f'animations/{filename}.animation.json')['animations'][action])
            # First person deliberately excludes the torso/root camera transform.
            arms = {'bones': {name: channel for name, channel in original['bones'].items()
                              if name in ('right_arm', 'right_hand', 'left_arm', 'left_hand')}}
            with TemporaryDirectory() as temp:
                output = Path(temp)
                with patch.multiple(converter, create=True, SOURCE=ROOT / 'upstream/reference', OUT=output, RP=output, PROVENANCE=[]):
                    generate()
                clip = converter.read_json(output / f'animations/{output_name}_player.animation.json')['animations'][f'animation.ordertocook.player.{clip_name}_first_person']
            for side, sign in [('right', -1), ('left', 1)]:
                name = side + 'Arm'
                native = [{'name': name, 'pivot': [sign*5, 22, 0]}]
                shoulder, tip = [sign*6, 24, 0], [sign*6, 12, 0]
                for key in clip['bones'][name]['rotation']:
                    seconds = float(key)
                    original_time = seconds % period if period else seconds
                    source_top = posed_point(source, arms, original_time, side+'_arm', shoulder)
                    source_tip = posed_point(source, arms, original_time, side+'_hand', tip)
                    actual_top = posed_point(native, clip, seconds, name, shoulder)
                    actual_tip = posed_point(native, clip, seconds, name, tip)
                    self.assertAlmostEqual(math.dist(actual_top, actual_tip), math.dist(source_top, source_tip), delta=.002,
                                           msg=(action, side, seconds, source_top, source_tip, actual_top, actual_tip))
                basis = {'bones': {name: {'rotation': [95, sign*45, -sign*115], 'position': [-sign*13.5, -10, 12]}}}
                expected_top = posed_point(native, basis, 0, name, shoulder)
                self.assertLess(math.dist(posed_point(native, clip, 0, name, shoulder), expected_top), .002)

    def test_player_chair_clap_reproduces_bounded_perspective_clips(self):
        with TemporaryDirectory() as temp:
            output = Path(temp)
            with patch.multiple(converter, create=True, SOURCE=ROOT / 'upstream/reference', OUT=output, RP=output, PROVENANCE=[]):
                converter.make_player_chair_clap_animation()
            generated = json.loads((output / 'animations/chair_clap_player.animation.json').read_text())
        self.assertEqual(generated, json.loads((ROOT / 'runtime/RP/animations/chair_clap_player.animation.json').read_text()))
        clip = generated['animations']['animation.ordertocook.player.chair_clap']
        self.assertEqual(clip['animation_length'], 3)
        self.assertFalse(clip['loop'])
        self.assertEqual(clip['blend_weight'], '!query.is_first_person')
        first = generated['animations']['animation.ordertocook.player.chair_clap_first_person']
        self.assertEqual(first['animation_length'], 3)
        self.assertFalse(first['loop'])
        self.assertLessEqual(generated['animations']['animation.ordertocook.player.chair_clap_stop']['animation_length'], 0.1)

    def test_chair_actions_preserve_source_body_shoulders_hands_and_foot_endpoints(self):
        source = converter.read_json(converter.ASSETS / 'geo/drive_idle.geo.json')['minecraft:geometry'][0]['bones']
        native = native_player_rig()
        cases = [('body', 'root', [0, 12, 0], [0, 12, 0])]
        for side, sign in [('right', -1), ('left', 1)]:
            cases += [(side+'_arm', side+'Arm', [sign*6, 24, 0], [sign*6, 24, 0]),
                      (side+'_hand', side+'Arm', [sign*6, 12, 0], [sign*6, 12, 0]),
                      (side+'_leg', side+'Leg', [sign*2, 12, 0], [sign*1.9, 12, 0]),
                      (side+'_foot', side+'Leg', [sign*2, 0, 0], [sign*1.9, 0, 0])]
        with TemporaryDirectory() as temp:
            output = Path(temp)
            with patch.multiple(converter, create=True, SOURCE=ROOT / 'upstream/reference', OUT=output, RP=output, PROVENANCE=[]):
                converter.make_player_chair_clap_animation()
            clips = converter.read_json(output / 'animations/chair_clap_player.animation.json')['animations']
        for action, clip_name, duration in [('player_sit&clap', 'chair_clap', 3), ('player_sit', 'chair_idle', 4.5)]:
            original = converter.unwrap_vectors(converter.read_json(converter.ASSETS / 'animations/player.animation.json')['animations'][action])
            # These source leg channels have constant post values. Evaluate the
            # data directly rather than copying the inverse limb fit.
            for name in ('right_leg', 'left_leg'):
                values = [key['post'] for key in original['bones'][name]['rotation'].values()]
                self.assertTrue(all(value == values[0] for value in values))
                original['bones'][name]['rotation'] = values[0]
            clip = clips[f'animation.ordertocook.player.{clip_name}']
            times = [t for t in (0, .1, .2222, .3056, .3889, .5556, .7, 1, 1.5, 2.975, 3, 3.75, 4.45, 4.5) if t <= duration]
            for seconds in times:
                for old, new, old_point, new_point in cases:
                    expected = posed_point(source, original, seconds, old, old_point)
                    actual = posed_point(native, clip, seconds, new, new_point)
                    self.assertLess(math.dist(expected, actual), .02, (action, seconds, old, expected, actual))

    def pose(self, half, frame, closing=False):
        clip = ("up_" if half == "upper" else "down_") + ("close" if closing else "open")
        return converter.bake_pose(converter.split_fridge_geo(self.source, half),
            self.clips[clip], frame/10,
            f"geometry.ordertocook.refrigerator_{half}_{'close_' if closing else ''}{frame}")

    def test_all_44_committed_fridge_poses_reproduce_from_the_converter(self):
        for half in ("lower", "upper"):
            for closing in (False, True):
                for frame in range(11):
                    with self.subTest(half=half, closing=closing, frame=frame):
                        result = converter.bound_fridge_swing(self.pose(half, frame, closing), half)
                        converter.assert_block_bounds(result)
                        expected = converter.read_json(ROOT / f"runtime/RP/models/blocks/refrigerator_{half}_{'close_' if closing else ''}{frame}.geo.json")
                        self.assertEqual(result, expected)

    def test_guard_preserves_door_sizes_uvs_angles_and_cabinet(self):
        for half, frame, closing, axis in (("lower", 2, True, 2), ("upper", 3, False, 2), ("upper", 6, False, 0)):
            original = self.pose(half, frame, closing)
            result = converter.bound_fridge_swing(copy.deepcopy(original), half)
            name = "bone3" if half == "lower" else "bone2"
            for before, after in zip(original["minecraft:geometry"][0]["bones"], result["minecraft:geometry"][0]["bones"]):
                if before["name"] != name:
                    self.assertEqual(before, after)
                    continue
                self.assertEqual(before["rotation"], after["rotation"])
                shift = after["pivot"][axis] - before["pivot"][axis]
                self.assertGreater(abs(shift), 0)
                self.assertLess(abs(shift), 0.126)
                for a, b in zip(before["cubes"], after["cubes"]):
                    self.assertEqual(a["size"], b["size"])
                    self.assertEqual(a["uv"], b["uv"])
                    for other in set(range(3))-{axis}:
                        self.assertEqual(a["origin"][other], b["origin"][other])
                    self.assertAlmostEqual(b["origin"][axis] - a["origin"][axis], shift, places=6)
            low, high = converter.geometry_bounds(result)
            self.assertGreaterEqual(low[axis], -22 + 1/2048)
            self.assertLessEqual(high[axis]-low[axis], 30 - 1/2048)

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
        model = self.pose("lower", 2, True)
        door = next(b for b in model["minecraft:geometry"][0]["bones"] if b["name"] == "bone3")
        door["pivot"][2] -= 1
        for cube in door["cubes"]:
            cube["origin"][2] -= 1
        with self.assertRaises(ValueError):
            converter.bound_fridge_swing(model, "lower")

    def test_geometry_rotation_matches_the_blockbench_loader_coordinate_conversion(self):
        # Official loader reflects X positions/pivots and negates X/Y angles.
        vertex = [3, 9, -5]; pivot = [1, 2, -3]; declared = [23, -47, 15]
        rendered = converter.transform3([-vertex[0],*vertex[1:]],
                                       [-declared[0],-declared[1],declared[2]],
                                       [-pivot[0],*pivot[1:]])
        expected = [-rendered[0],*rendered[1:]]
        for actual,reference in zip(converter.geometry_transform3(vertex,declared,pivot),expected):
            self.assertAlmostEqual(actual,reference)
        # A positive-X appliance hinge opens forwards (-Z), not into the body.
        self.assertEqual([round(v,6) for v in converter.geometry_transform3([0,1,0],[90,0,0])], [0,0,-1])

    def test_source_elastic_and_bounce_curves_are_distinct_and_keep_exact_endpoints(self):
        opening = self.clips["down_open"]["bones"]["bone3"]["rotation"]
        closing = self.clips["down_close"]["bones"]["bone3"]["rotation"]
        # GeckoLib's elastic reaches its endpoint at halfway then overshoots.
        self.assertAlmostEqual(converter.sample_channel(opening, .5, [0]*3)[1], -125)
        self.assertLess(converter.sample_channel(opening, .6, [0]*3)[1], -125)
        # Bounce argument .1 is materially different from a linear reverse.
        self.assertAlmostEqual(converter.sample_channel(closing, .2, [0]*3)[1], -87.1875)
        self.assertEqual(converter.sample_channel(closing, 1, [0]*3), [0,0,0])
        self.assertEqual(converter.sample_channel(opening, 0, [0]*3), [0,0,0])

    def test_dishwasher_and_fridge_keep_original_per_axis_squash(self):
        machine = converter.normalize_geo(converter.ASSETS / "geo/block/dishwasher.geo.json", "geometry.test")
        clips = converter.read_json(converter.ASSETS / "animations/dishwasher.animation.json")["animations"]
        cabinet = machine["minecraft:geometry"][0]["bones"][0]["cubes"][0]
        for clip, seconds, factor in (("empty_in", .5, .9), ("empty_out", .625, 1.1)):
            result = converter.bake_pose(machine, clips[clip], seconds, "geometry.test")
            cube = result["minecraft:geometry"][0]["bones"][0]["cubes"][0]
            self.assertEqual(cube["size"][:2], cabinet["size"][:2])
            self.assertAlmostEqual(cube["size"][2], cabinet["size"][2]*factor)
            self.assertEqual(cube["uv"], cabinet["uv"])
        normal = self.pose("lower", 0)
        closed = self.pose("lower", 5, True)
        self.assertAlmostEqual(closed["minecraft:geometry"][0]["bones"][0]["cubes"][0]["size"][2],
                               normal["minecraft:geometry"][0]["bones"][0]["cubes"][0]["size"][2]*.95)

    def test_signed_cavity_normalization_preserves_every_physical_texel_corner_in_four_facings(self):
        # Independent GeckoLib VertexSet quad order, including the reflected X.
        # Compare spatial UV corners, not converter-produced JSON to itself.
        indices = {"west": (3,2,0,1), "east": (4,5,7,6),
                   "north": (2,4,6,0), "south": (5,3,1,7),
                   "up": (3,5,4,2), "down": (0,6,7,1)}
        def corners(cube, facing):
            x0 = -(cube["origin"][0]+cube["size"][0]); x1 = x0+cube["size"][0]
            y0,z0 = cube["origin"][1:]; y1 = y0+cube["size"][1]; z1 = z0+cube["size"][2]
            vertices = ((x0,y0,z0),(x0,y0,z1),(x0,y1,z0),(x0,y1,z1),
                        (x1,y1,z0),(x1,y1,z1),(x1,y0,z0),(x1,y0,z1))
            result = []
            for face, uv in cube["uv"].items():
                u,v = uv["uv"]; du,dv = uv["uv_size"]
                coords = ((u+du,v),(u,v),(u,v+dv),(u+du,v+dv))
                for index, texel in zip(indices[face], coords):
                    point = vertices[index]
                    for _ in range(facing): point = (point[2],point[1],-point[0])
                    result.append((*point,*texel))
            return sorted(result)
        affected = 0
        for name in ("refrigerator", "dishwasher"):
            raw = converter.read_json(converter.ASSETS / f"geo/block/{name}.geo.json")
            for bone in raw["minecraft:geometry"][0]["bones"]:
                for cube in bone.get("cubes", []):
                    if min(cube["size"]) >= 0: continue
                    affected += 1
                    fixed = converter.normalize_signed_cube(copy.deepcopy(cube))
                    for facing in range(4):
                        with self.subTest(machine=name, bone=bone["name"], facing=facing):
                            self.assertEqual(corners(cube,facing),corners(fixed,facing))
        self.assertEqual(affected,4)

    def test_source_affine_shear_residual_remains_below_one_third_texel(self):
        # Full source S->R->T hierarchy is independent of the cuboid fitting.
        for name in ("dishwasher", "refrigerator"):
            source = converter.normalize_geo(converter.ASSETS / f"geo/block/{name}.geo.json", "geometry.test")
            clips = converter.read_json(converter.ASSETS / f"animations/{name}.animation.json")["animations"]
            maximum = 0
            for clip_name, clip in clips.items():
                count = 11 if name == "refrigerator" else 16
                for frame in range(count):
                    seconds = clip["animation_length"] * frame / (16 if clip_name == "washing" else count-1)
                    original = converter.split_fridge_geo(source, "upper" if clip_name.startswith("up") else "lower") if name == "refrigerator" else source
                    result = converter.bake_pose(original, clip, seconds, "geometry.test")
                    before = {b["name"]: b for b in original["minecraft:geometry"][0]["bones"]}
                    after = {b["name"]: b for b in result["minecraft:geometry"][0]["bones"]}
                    for bone_name, bone in before.items():
                        if name == "dishwasher" and ((bone_name == "drity_dish" and clip_name != "dirty_in") or (bone_name == "clear_dish" and clip_name != "clear_out")):
                            continue
                        for cube, baked in zip(bone.get("cubes", []), after[bone_name].get("cubes", [])):
                            for signs in itertools.product((0,1), repeat=3):
                                point = [a+b*c for a,b,c in zip(cube["origin"],cube["size"],signs)]
                                point = converter.geometry_transform3(point,cube.get("rotation",[0]*3),cube.get("pivot",[0]*3))
                                current = bone
                                while True:
                                    tracks = clip.get("bones",{}).get(current["name"],{})
                                    position = converter.sample_channel(tracks.get("position"),seconds,[0]*3)
                                    scale = converter.sample_channel(tracks.get("scale"),seconds,[1]*3)
                                    rotation = [a+b for a,b in zip(current.get("rotation",[0]*3),converter.sample_channel(tracks.get("rotation"),seconds,[0]*3))]
                                    pivot = current["pivot"]
                                    point = [pivot[i]+(point[i]-pivot[i])*scale[i] for i in range(3)]
                                    point = [a+b for a,b in zip(converter.geometry_transform3(point,rotation,pivot),position)]
                                    if "parent" not in current: break
                                    current = before[current["parent"]]
                                actual = [a+b*c for a,b,c in zip(baked["origin"],baked["size"],signs)]
                                actual = converter.geometry_transform3(actual,baked.get("rotation",[0]*3),baked.get("pivot",[0]*3))
                                current = after[bone_name]
                                while True:
                                    actual = converter.geometry_transform3(actual,current.get("rotation",[0]*3),current["pivot"])
                                    if "parent" not in current: break
                                    current = after[current["parent"]]
                                maximum = max(maximum, math.dist(point,actual))
            with self.subTest(machine=name):
                self.assertLess(maximum, 1/3)

    def test_dishwasher_count_culling_matches_one_two_and_many_source_plates(self):
        definition = converter.read_json(ROOT / "runtime/BP/blocks/dishwasher.json")["minecraft:block"]
        geometry = definition["components"]["minecraft:geometry"]
        self.assertIn("bone_visibility", geometry)
        for components in [definition["components"], *[p["components"] for p in definition["permutations"]]]:
            shape = components.get("minecraft:geometry")
            if not shape: continue
            for count, expected in ((0, []), (1, [2]), (2, [2,5]), (3, list(range(1,7))), (16,list(range(1,7)))):
                for family in ("drity_dish", "clear_dish"):
                    shown = [i for i in range(1,7) if count >= int(re.search(r">= (\d+)$", shape["bone_visibility"][f"{family}_{i}"]).group(1))]
                    self.assertEqual(shown, expected)
            model = converter.read_json(ROOT / "runtime/RP/models/blocks" / (shape["identifier"].removeprefix("geometry.ordertocook.")+".geo.json"))
            names = {b["name"] for b in model["minecraft:geometry"][0]["bones"]}
            self.assertTrue(set(shape["bone_visibility"]) <= names)

    def test_printer_uses_full_source_geo_and_original_rise_squash_and_wobble(self):
        source = converter.normalize_geo(converter.ASSETS / "geo/block/order_machine.geo.json", "geometry.test")
        clip = converter.read_json(converter.ASSETS / "animations/order_machine.animation.json")["animations"]["neworder"]
        source_bones = {b["name"]: b for b in source["minecraft:geometry"][0]["bones"]}
        for mode in ("idle", "printing", "waiting"):
            for frame in (range(16) if mode == "printing" else (0,)):
                identifier = f"geometry.ordertocook.order_machine_{mode}_{frame}"
                result = converter.bake_pose(source, {} if mode == "idle" else clip, frame/15 if mode == "printing" else 1, identifier)
                if mode == "idle":
                    next(b for b in result["minecraft:geometry"][0]["bones"] if b["name"] == "group")["cubes"] = []
                expected = converter.read_json(ROOT / f"runtime/RP/models/blocks/order_machine_{mode}_{frame}.geo.json")
                self.assertEqual(result,expected)
                converter.assert_block_bounds(result)
        initial = converter.bake_pose(source,clip,0,"geometry.test")["minecraft:geometry"][0]["bones"]
        final = converter.bake_pose(source,clip,1,"geometry.test")["minecraft:geometry"][0]["bones"]
        by_name = lambda bones: {b["name"]:b for b in bones}
        # Physical source controls: 95% body at start; raised paper holds at end.
        self.assertAlmostEqual(by_name(initial)["group2"]["cubes"][0]["size"][0],13.3)
        self.assertEqual(by_name(final)["group"]["pivot"],[0,15,3])
        self.assertEqual(by_name(final)["group2"]["cubes"],source_bones["group2"]["cubes"])
        definition = converter.read_json(ROOT / "runtime/BP/blocks/order_machine.json")["minecraft:block"]
        self.assertEqual(definition["description"]["states"]["ordertocook:frame"],list(range(16)))
        self.assertEqual(definition["components"]["minecraft:material_instances"]["*"]["texture"],"ordertocook_block_order_machine_geo")

    def test_placed_bag_uses_original_geo_material_and_half_second_placement(self):
        source = converter.normalize_geo(converter.ASSETS / "geo/block/takeout_bag_placed.geo.json", "geometry.test")
        clip = converter.read_json(converter.ASSETS / "animations/takeout_bag_placed.animation.json")["animations"]["maked"]
        for frame in range(11):
            name = "takeout_bag" if frame == 0 else f"takeout_bag_{frame}"
            seconds = .5 if frame == 0 else (frame-1)/20
            result = converter.bake_pose(source,clip,seconds,f"geometry.ordertocook.{name}")
            self.assertEqual(result,converter.read_json(ROOT / f"runtime/RP/models/blocks/{name}.geo.json"))
            converter.assert_block_bounds(result)
        initial = converter.bake_pose(source,clip,0,"geometry.test")["minecraft:geometry"][0]["bones"][0]
        settled = converter.bake_pose(source,clip,.5,"geometry.test")["minecraft:geometry"][0]["bones"][0]
        self.assertEqual(initial["pivot"],[0,8.5,0])
        self.assertEqual(initial["cubes"][0]["size"],[6.8,7.65,1.7])
        self.assertEqual(settled["cubes"],source["minecraft:geometry"][0]["bones"][0]["cubes"])
        self.assertAlmostEqual(converter.sample_channel(clip["bones"]["group"]["rotation"],.1,[0]*3)[2],math.sin(math.radians(100))*2.4)
        definition = converter.read_json(ROOT / "runtime/BP/blocks/takeout_bag.json")["minecraft:block"]
        self.assertEqual(definition["description"]["states"]["ordertocook:frame"],list(range(11)))
        self.assertEqual(definition["components"]["minecraft:material_instances"]["*"]["texture"],"ordertocook_block_takeout_bag_placed")
        self.assertNotIn("minecraft:tick",definition["components"])
        self.assertNotIn("ordertocook:bag_motion",definition["components"])
        ticking = [p for p in definition["permutations"] if "minecraft:tick" in p["components"]]
        self.assertEqual(ticking,[{"condition":"q.block_state('ordertocook:frame') > 0","components":{"minecraft:tick":{"interval_range":[1,1],"looping":True},"ordertocook:bag_motion":{}}}])

if __name__ == "__main__":
    unittest.main()
