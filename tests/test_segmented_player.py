#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Local prototype checks, using the explicitly supplied pinned Mojang input.

Not part of exported runtime or the existing 026 release workflow. See the
prototype source notes for the exact native input and invocation.
"""
import copy
import itertools
import math
import os
from pathlib import Path
import unittest

from test_appliance_geometry import converter, posed_point

ROOT = Path(__file__).resolve().parents[1]


def corners(cube):
    inflate = cube.get('inflate', 0)
    return list(itertools.product(*[(p-inflate, p+size+inflate)
                                    for p, size in zip(cube['origin'], cube['size'])]))


class SegmentedPlayerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.native = converter.read_json(Path(os.environ['OTC_NATIVE_PLAYER_GEOMETRY']))
        cls.original_bones = cls.native['minecraft:geometry'][0]['bones']
        cls.variants = {}
        for variant, filename in [('classic', 'drive_idle'), ('slim', 'drive_idle_alex')]:
            rig = converter.read_json(converter.ASSETS / f'geo/{filename}.geo.json')['minecraft:geometry'][0]['bones']
            cls.variants[variant] = {bone['name']: bone for bone in rig}

    def geometry(self, variant):
        return converter.segmented_player_geometry(self.native, self.variants[variant],
            f'geometry.ordertocook.prototype.segmented_{variant}')

    def source_actions(self):
        for file, name, duration, period in [('player_wash', 'player_wash', 4, 2),
                ('player', 'player_sit', 4.5, None), ('player', 'player_sit&clap', 3, None)]:
            original = converter.unwrap_vectors(converter.read_json(converter.ASSETS / f'animations/{file}.animation.json')['animations'][name])
            yield name, original, duration, period

    def test_neutral_native_bounds_seams_and_source_side_texels_are_preserved(self):
        # Source side UVs are an independent reference. Some author cap UVs and
        # the -0.05 foot inflation differ from the native neutral mesh, so caps
        # use the explicit native-box reference in the following test.
        for variant, source in self.variants.items():
            geometry = self.geometry(variant)['minecraft:geometry'][0]
            self.assertEqual([geometry['description'][key] for key in ('texture_width', 'texture_height')], [64, 64])
            target = {bone['name']: bone for bone in geometry['bones']}
            native = {bone['name']: bone for bone in self.original_bones}
            for side in ('right', 'left'):
                for limb, overlay, joint, upper, lower in [('Arm', 'Sleeve', 'forearm', 'arm', 'hand'),
                                                         ('Leg', 'Pants', 'shin', 'leg', 'foot')]:
                    for exterior, skin_index in [(False, 0), (True, 1)]:
                        parent = side + (overlay if exterior else limb)
                        child = f'ordertocook_{side}_{joint}' + ('_'+overlay.lower() if exterior else '')
                        before = corners(native[parent]['cubes'][0])
                        expected_min = [min(p[i] for p in before) for i in range(3)]
                        expected_max = [max(p[i] for p in before) for i in range(3)]
                        if variant == 'slim' and limb == 'Arm':
                            # Explicit 3px source variant; not an inferred client
                            # skin or an assertion about native customSlim pivots.
                            if side == 'right': expected_min[0] += 1
                            else: expected_max[0] -= 1
                        after = [p for name in (parent, child) for p in corners(target[name]['cubes'][0])]
                        self.assertLess(math.dist([min(p[i] for p in after) for i in range(3)], expected_min), 1e-6)
                        self.assertLess(math.dist([max(p[i] for p in after) for i in range(3)], expected_max), 1e-6)
                        upper_bottom = min(p[1] for p in corners(target[parent]['cubes'][0]))
                        lower_top = max(p[1] for p in corners(target[child]['cubes'][0]))
                        self.assertEqual(upper_bottom, lower_top, 'neutral overlay must not overlap at the seam')
                        for original_name, new_name in [(upper, parent), (lower, child)]:
                            old = source[side+'_'+original_name]['cubes'][skin_index]
                            new = target[new_name]['cubes'][0]
                            for face in ('north', 'south', 'east', 'west'):
                                self.assertEqual(new['uv'][face], old['uv'][face], (variant, new_name, face))

    def test_native_box_external_caps_keep_their_original_uv_orientation(self):
        # Fixed native box-UV examples, checked against Blockbench's box face
        # layout and Bedrock up/down export reversal. This is data, not a copy
        # of the converter's UV algorithm; source-specific cap mistakes remain
        # separate from the requested native neutral baseline.
        classic = {
            'rightArm': ([44,16], [48,20], 4), 'rightSleeve': ([44,32], [48,36], 4),
            'leftArm': ([36,48], [40,52], 4), 'leftSleeve': ([52,48], [56,52], 4),
            'rightLeg': ([4,16], [8,20], 4), 'rightPants': ([4,32], [8,36], 4),
            'leftLeg': ([20,48], [24,52], 4), 'leftPants': ([4,48], [8,52], 4)}
        slim = dict(classic, rightArm=([44,16], [47,20], 3), rightSleeve=([44,32], [47,36], 3),
                    leftArm=([36,48], [39,52], 3), leftSleeve=([52,48], [55,52], 3))
        for variant, examples in [('classic', classic), ('slim', slim)]:
            bones = {bone['name']: bone for bone in self.geometry(variant)['minecraft:geometry'][0]['bones']}
            for name, (top, bottom, width) in examples.items():
                side = 'right' if name.startswith('right') else 'left'
                joint = 'forearm' if name.endswith(('Arm', 'Sleeve')) else 'shin'
                child = f'ordertocook_{side}_{joint}'
                if name.endswith('Sleeve'): child += '_sleeve'
                if name.endswith('Pants'): child += '_pants'
                self.assertEqual(bones[name]['cubes'][0]['uv']['up'], {'uv': top, 'uv_size': [width, 4]})
                self.assertEqual(bones[child]['cubes'][0]['uv']['down'], {'uv': bottom, 'uv_size': [width, -4]})

    def test_original_controls_and_neutral_item_locator_routes_are_preserved(self):
        animation = {'bones': {'root': {'rotation': [0, 23, 0], 'position': [1, 2, 3]},
            'waist': {'rotation': [7, 0, 0]}, 'body': {'rotation': [12, 5, 0]},
            'rightArm': {'rotation': [35, 23, -15], 'position': [1, 2, 3], 'scale': [.8, 1.2, .9]},
            'leftArm': {'rotation': [-25, -35, 10]}}}
        for variant in self.variants:
            bones = self.geometry(variant)['minecraft:geometry'][0]['bones']
            lookup = {bone['name']: bone for bone in bones}
            for original in self.original_bones:
                name = original['name']; current = lookup[name]
                self.assertEqual(current['pivot'], original['pivot'])
                if name not in ('rightItem', 'leftItem'):
                    self.assertEqual(current.get('parent'), original.get('parent'))
                if name not in [side+part for side in ('right', 'left') for part in ('Arm', 'Leg', 'Sleeve', 'Pants', 'Item')]:
                    self.assertEqual(current, original)
                points = [original['pivot'], *original.get('locators', {}).values()]
                for point in points:
                    expected = posed_point(self.original_bones, animation, 0, name, point)
                    actual = posed_point(bones, animation, 0, name, point)
                    self.assertLess(math.dist(actual, expected), 1e-6, (variant, name))
                if name.endswith('Item'):
                    self.assertEqual(current.get('locators'), original.get('locators'))
                    self.assertEqual(current['parent'], f'ordertocook_{name[:-4]}_forearm')

    def test_source_upper_forearm_thigh_and_shin_matrices_match_actual_meshes(self):
        for variant, source in self.variants.items():
            geometry = self.geometry(variant)
            bones = geometry['minecraft:geometry'][0]['bones']
            target = {bone['name']: bone for bone in bones}
            for action, original, duration, period in self.source_actions():
                clip = {'bones': converter.segmented_player_action_pose(original, source, geometry, duration, period)}
                times = sorted(set(converter.player_action_times(original, duration, period)) | {.025, .137, .3056, .3889})
                pairs = [('torso', 'body'), ('head', 'head')]
                for side in ('right', 'left'):
                    pairs.extend([(side+'_arm', side+'Arm'), (side+'_hand', f'ordertocook_{side}_forearm'),
                                  (side+'_arm', side+'Sleeve'), (side+'_hand', f'ordertocook_{side}_forearm_sleeve'),
                                  (side+'_leg', side+'Leg'), (side+'_foot', f'ordertocook_{side}_shin'),
                                  (side+'_leg', side+'Pants'), (side+'_foot', f'ordertocook_{side}_shin_pants')])
                for seconds in times:
                    for old, new in pairs:
                        offset = (source[old]['pivot'][0]-target[new]['pivot'][0]) if old.endswith(('_leg', '_foot')) else 0
                        for vertex in corners(target[new]['cubes'][0]):
                            point = [vertex[0]+offset, vertex[1], vertex[2]]
                            expected = posed_point(list(source.values()), original, seconds % period if period else seconds, old, point)
                            actual = posed_point(bones, clip, seconds, new, vertex)
                            self.assertLess(math.dist(actual, expected), .02, (variant, action, seconds, old, vertex, expected, actual))

    def test_distal_bends_move_forearm_shin_and_item_without_moving_upper_segments(self):
        _, original, duration, period = next(self.source_actions())
        changed = copy.deepcopy(original)
        changed['bones']['right_hand']['rotation'][2] += 35
        changed['bones']['right_foot'] = {'rotation': [30, 0, 0]}
        for variant, source in self.variants.items():
            geometry = self.geometry(variant)
            bones = geometry['minecraft:geometry'][0]['bones']
            lookup = {bone['name']: bone for bone in bones}
            base = {'bones': converter.segmented_player_action_pose(original, source, geometry, duration, period)}
            bent = {'bones': converter.segmented_player_action_pose(changed, source, geometry, duration, period)}
            for name in ('body', 'head', 'rightArm', 'rightLeg', 'leftArm', 'leftLeg', 'ordertocook_left_forearm', 'ordertocook_left_shin'):
                self.assertEqual(base['bones'][name], bent['bones'][name], name)
            for name in ('ordertocook_right_forearm', 'ordertocook_right_shin'):
                vertex = lookup[name]['cubes'][0]['origin']
                a = posed_point(bones, base, .5, name, vertex)
                b = posed_point(bones, bent, .5, name, vertex)
                self.assertGreater(math.dist(a,b), 1, (variant, name))
            item = lookup['rightItem']
            for point in [item['pivot'], *item.get('locators', {}).values()]:
                expected = posed_point(list(source.values()), changed, .5, 'right_hand', point)
                actual = posed_point(bones, bent, .5, 'rightItem', point)
                self.assertLess(math.dist(expected, actual), .002)
                self.assertGreater(math.dist(actual, posed_point(bones, base, .5, 'rightItem', point)), .1)

    def test_prototype_does_not_mutate_native_or_author_inputs(self):
        native = copy.deepcopy(self.native)
        for variant, source in self.variants.items():
            before = copy.deepcopy(source)
            geometry = self.geometry(variant)
            for _, action, duration, period in self.source_actions():
                original = copy.deepcopy(action)
                converter.segmented_player_action_pose(action, source, geometry, duration, period)
                self.assertEqual(action, original)
            self.assertEqual(source, before)
        self.assertEqual(self.native, native)


if __name__ == '__main__':
    unittest.main()
