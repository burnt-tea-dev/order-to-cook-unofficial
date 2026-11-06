#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Local prototype checks, using the explicitly supplied pinned Mojang input.

CI fetches both fixed inputs into external temporary storage. No native input,
generated player, selector or pose is part of the exported runtime.
"""
import copy
import itertools
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

from test_appliance_geometry import converter, posed_point

ROOT = Path(__file__).resolve().parents[1]


def corners(cube):
    inflate = cube.get('inflate', 0)
    return list(itertools.product(*[(p-inflate, p+size+inflate)
                                    for p, size in zip(cube['origin'], cube['size'])]))


class SegmentedPlayerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.classic_input = converter.read_json(Path(os.environ['OTC_NATIVE_PLAYER_GEOMETRY']))
        cls.slim_input = converter.read_json(Path(os.environ['OTC_NATIVE_SLIM_GEOMETRY']))
        cls.natives = converter.native_player_variants(cls.classic_input, cls.slim_input)
        cls.original_bones = {variant: model['minecraft:geometry'][0]['bones'] for variant, model in cls.natives.items()}
        cls.variants = {}
        for variant, filename in [('classic', 'drive_idle'), ('slim', 'drive_idle_alex')]:
            rig = converter.read_json(converter.ASSETS / f'geo/{filename}.geo.json')['minecraft:geometry'][0]['bones']
            cls.variants[variant] = {bone['name']: bone for bone in rig}

    def geometry(self, variant):
        return converter.segmented_player_geometry(self.natives[variant], self.variants[variant],
            f'geometry.ordertocook.prototype.segmented_{variant}')

    def source_actions(self):
        for file, name, duration, period in [('player_wash', 'player_wash', 4, 2),
                ('player', 'player_sit', 4.5, None), ('player', 'player_sit&clap', 3, None)]:
            original = converter.unwrap_vectors(converter.read_json(converter.ASSETS / f'animations/{file}.animation.json')['animations'][name])
            yield name, original, duration, period

    def test_variants_retain_the_two_real_native_definitions_without_inventing_inheritance(self):
        self.assertEqual(self.natives['classic'], self.classic_input)
        self.assertEqual(self.original_bones['slim'], self.slim_input['geometry.humanoid.customSlim']['bones'])
        for variant, shoulder, hand, cape_z in [('classic', 22, 15, 3), ('slim', 21.5, 14.5, -3)]:
            native = {bone['name']: bone for bone in self.original_bones[variant]}
            model = {bone['name']: bone for bone in self.geometry(variant)['minecraft:geometry'][0]['bones']}
            self.assertEqual(native['cape']['pivot'][2], cape_z)
            for side in ('right', 'left'):
                self.assertEqual(model[side+'Arm']['pivot'][1], shoulder)
                self.assertEqual(model[f'ordertocook_{side}_forearm']['pivot'][1], shoulder-4)
                self.assertEqual(model[side+'Item']['pivot'][1], hand)
            self.assertEqual(model['rightItem']['locators']['lead_hold'][1], hand)

    def test_native_slim_mirrored_left_leg_keeps_explicit_side_texels_on_both_segments(self):
        native = {bone['name']: bone for bone in self.original_bones['slim']}
        self.assertIs(native['leftLeg']['mirror'], True)
        bones = {bone['name']: bone for bone in self.geometry('slim')['minecraft:geometry'][0]['bones']}
        # Fixed UV references from the selected native left-leg box [16,48],
        # with its documented X mirror (including exchanged east/west faces).
        references = {'north': 24, 'south': 32, 'east': 28, 'west': 20}
        for name, top_v in [('leftLeg', 52), ('ordertocook_left_shin', 58)]:
            self.assertNotIn('mirror', bones[name])
            cube = bones[name]['cubes'][0]
            for face, u in references.items():
                self.assertEqual(cube['uv'][face], {'uv': [u, top_v], 'uv_size': [-4, 6]})
        # Pants are a separate native bone without that skin mirror.
        self.assertEqual(bones['leftPants']['cubes'][0]['uv']['north'], {'uv': [4,52], 'uv_size': [4,6]})

    def test_neutral_native_bounds_seams_and_source_side_texels_are_preserved(self):
        # Source side UVs are an independent reference. Some author cap UVs and
        # the -0.05 foot inflation differ from the native neutral mesh, so caps
        # use the explicit native-box reference in the following test.
        for variant, source in self.variants.items():
            geometry = self.geometry(variant)['minecraft:geometry'][0]
            self.assertEqual([geometry['description'][key] for key in ('texture_width', 'texture_height')], [64, 64])
            target = {bone['name']: bone for bone in geometry['bones']}
            native = {bone['name']: bone for bone in self.original_bones[variant]}
            for side in ('right', 'left'):
                for limb, overlay, joint, upper, lower in [('Arm', 'Sleeve', 'forearm', 'arm', 'hand'),
                                                         ('Leg', 'Pants', 'shin', 'leg', 'foot')]:
                    for exterior, skin_index in [(False, 0), (True, 1)]:
                        parent = side + (overlay if exterior else limb)
                        child = f'ordertocook_{side}_{joint}' + ('_'+overlay.lower() if exterior else '')
                        before = corners(native[parent]['cubes'][0])
                        expected_min = [min(p[i] for p in before) for i in range(3)]
                        expected_max = [max(p[i] for p in before) for i in range(3)]
                        after = [p for name in (parent, child) for p in corners(target[name]['cubes'][0])]
                        self.assertLess(math.dist([min(p[i] for p in after) for i in range(3)], expected_min), 1e-6)
                        self.assertLess(math.dist([max(p[i] for p in after) for i in range(3)], expected_max), 1e-6)
                        upper_bottom = min(p[1] for p in corners(target[parent]['cubes'][0]))
                        lower_top = max(p[1] for p in corners(target[child]['cubes'][0]))
                        self.assertEqual(upper_bottom, lower_top, 'neutral overlay must not overlap at the seam')
                        for original_name, new_name in [(upper, parent), (lower, child)]:
                            old = source[side+'_'+original_name]['cubes'][skin_index]
                            new = target[new_name]['cubes'][0]
                            for face in (() if variant == 'slim' and parent == 'leftLeg' else ('north', 'south', 'east', 'west')):
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
                mirrored = variant == 'slim' and name == 'leftLeg'
                expected_top = [top[0]+width, top[1]] if mirrored else top
                expected_bottom = [bottom[0]+width, bottom[1]] if mirrored else bottom
                self.assertEqual(bones[name]['cubes'][0]['uv']['up'], {'uv': expected_top, 'uv_size': [-width if mirrored else width, 4]})
                self.assertEqual(bones[child]['cubes'][0]['uv']['down'], {'uv': expected_bottom, 'uv_size': [-width if mirrored else width, -4]})

    def test_original_controls_and_neutral_item_locator_routes_are_preserved(self):
        animation = {'bones': {'root': {'rotation': [0, 23, 0], 'position': [1, 2, 3]},
            'waist': {'rotation': [7, 0, 0]}, 'body': {'rotation': [12, 5, 0]},
            'rightArm': {'rotation': [35, 23, -15], 'position': [1, 2, 3], 'scale': [.8, 1.2, .9]},
            'leftArm': {'rotation': [-25, -35, 10]}}}
        for variant in self.variants:
            bones = self.geometry(variant)['minecraft:geometry'][0]['bones']
            lookup = {bone['name']: bone for bone in bones}
            for original in self.original_bones[variant]:
                name = original['name']; current = lookup[name]
                self.assertEqual(current['pivot'], original['pivot'])
                if name.endswith('Arm'):
                    self.assertEqual(current['parent'], f'ordertocook_{name[:-3]}_arm_body')
                elif name not in ('rightItem', 'leftItem'):
                    self.assertEqual(current.get('parent'), original.get('parent'))
                if name not in [side+part for side in ('right', 'left') for part in ('Arm', 'Leg', 'Sleeve', 'Pants', 'Item')]:
                    self.assertEqual(current, original)
                points = [original['pivot'], *original.get('locators', {}).values()]
                for point in points:
                    expected = posed_point(self.original_bones[variant], animation, 0, name, point)
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
                        offset = ([-.1 if old.startswith('right') else .1, 0, 0] if old.endswith(('_leg', '_foot'))
                                  else [0, .5 if variant == 'slim' and old.endswith(('_arm', '_hand')) else 0, 0])
                        for vertex in corners(target[new]['cubes'][0]):
                            point = [a+b for a,b in zip(vertex, offset)]
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
                source_point = [point[0], point[1]+(.5 if variant == 'slim' else 0), point[2]]
                expected = posed_point(list(source.values()), changed, .5, 'right_hand', source_point)
                actual = posed_point(bones, bent, .5, 'rightItem', point)
                self.assertLess(math.dist(expected, actual), .002)
                self.assertGreater(math.dist(actual, posed_point(bones, base, .5, 'rightItem', point)), .1)

    def test_first_person_keeps_full_source_body_upper_and_forearm_matrices_in_each_explicit_view(self):
        # Two deliberately different camera frames are supplied by the caller.
        # These are reference model-space frames, not measured Bedrock cameras.
        views = {'right': {'rotation': [90.5, 25.5, -9], 'position': [-6, -7, -13.5]},
                 'left': {'rotation': [69.5, -18.5, -11], 'position': [-8, 0, -15.5]}}
        for variant, source in self.variants.items():
            geometry = self.geometry(variant)
            bones = geometry['minecraft:geometry'][0]['bones']
            lookup = {bone['name']: bone for bone in bones}
            for action, original, duration, period in self.source_actions():
                clip = {'bones': converter.segmented_player_first_person_pose(original, source, geometry,
                    duration, views, period)}
                for time in sorted(set(converter.player_action_times(original, duration, period)) | {.025, .3056, .3889}):
                    for side in ('right', 'left'):
                        for old, new in [(side+'_arm', side+'Arm'), (side+'_arm', side+'Sleeve'),
                                         (side+'_hand', f'ordertocook_{side}_forearm'),
                                         (side+'_hand', f'ordertocook_{side}_forearm_sleeve')]:
                            for point in corners(lookup[new]['cubes'][0]):
                                source_point = [point[0], point[1]+(.5 if variant == 'slim' else 0), point[2]]
                                expected = posed_point(list(source.values()), original, time % period if period else time, old, source_point)
                                expected = converter.geometry_transform3(expected, views[side]['rotation'])
                                expected = [a+b for a,b in zip(expected, views[side]['position'])]
                                actual = posed_point(bones, clip, time, new, point)
                                self.assertLess(math.dist(actual, expected), .02, (variant, action, time, new))

    def test_first_person_distal_bend_moves_its_skin_sleeve_and_item_but_not_upper_or_other_arm(self):
        _, original, duration, period = next(self.source_actions())
        changed = copy.deepcopy(original)
        changed['bones']['right_hand']['rotation'][2] += 35
        views = {'right': {'rotation': [95, -45, 115], 'position': [13.5, -10, 12]},
                 'left': {'rotation': [95, 45, -115], 'position': [-13.5, -10, 12]}}
        for variant, source in self.variants.items():
            geometry = self.geometry(variant)
            bones = geometry['minecraft:geometry'][0]['bones']
            lookup = {bone['name']: bone for bone in bones}
            base = {'bones': converter.segmented_player_first_person_pose(original, source, geometry, duration, views, period)}
            bent = {'bones': converter.segmented_player_first_person_pose(changed, source, geometry, duration, views, period)}
            for name in ('root', 'waist', 'body', 'rightArm', 'leftArm', 'ordertocook_left_forearm'):
                self.assertEqual(base['bones'][name], bent['bones'][name], name)
            for name in ('ordertocook_right_forearm', 'ordertocook_right_forearm_sleeve', 'rightItem'):
                point = lookup[name]['pivot'] if name.endswith('Item') else lookup[name]['cubes'][0]['origin']
                self.assertGreater(math.dist(posed_point(bones, base, .5, name, point),
                                             posed_point(bones, bent, .5, name, point)), .1, name)
            item = lookup['rightItem']
            for point in [item['pivot'], *item.get('locators', {}).values()]:
                source_point = [point[0], point[1]+(.5 if variant == 'slim' else 0), point[2]]
                expected = posed_point(list(source.values()), changed, .5, 'right_hand', source_point)
                expected = converter.geometry_transform3(expected, views['right']['rotation'])
                expected = [a+b for a,b in zip(expected, views['right']['position'])]
                self.assertLess(math.dist(posed_point(bones, bent, .5, 'rightItem', point), expected), .002)

    def test_prototype_does_not_mutate_native_or_author_inputs(self):
        native = copy.deepcopy(self.natives)
        for variant, source in self.variants.items():
            before = copy.deepcopy(source)
            geometry = self.geometry(variant)
            for _, action, duration, period in self.source_actions():
                original = copy.deepcopy(action)
                converter.segmented_player_action_pose(action, source, geometry, duration, period)
                self.assertEqual(action, original)
            self.assertEqual(source, before)
        self.assertEqual(self.natives, native)

    def test_source_generator_writes_linked_poses_visibility_and_complete_new_bone_reset(self):
        views = {side: {'rotation': [0, 0, 0], 'position': [0, 0, 0]} for side in ('right', 'left')}
        before = copy.deepcopy(views)
        with TemporaryDirectory() as temp, patch.object(converter, 'SOURCE', ROOT / 'upstream/reference', create=True):
            output = Path(temp)
            converter.make_segmented_player_source(self.natives, views, output)
            contract = converter.read_json(output / 'player-rig-source.json')
            for variant, references in contract['variants'].items():
                model = converter.read_json(output / references['geometry'])['minecraft:geometry'][0]
                poses = converter.read_json(output / references['poses'])['animations']
                names = {bone['name'] for bone in model['bones']}
                for clip in poses.values():
                    self.assertTrue(set(clip['bones']) <= names)
                additions = names - {bone['name'] for bone in self.original_bones[variant]}
                reset = poses[f'animation.ordertocook.prototype.{variant}.reset']['bones']
                self.assertEqual(set(reset), additions)
                for channels in reset.values():
                    self.assertEqual(channels, {'rotation': [0]*3, 'position': [0]*3, 'scale': [1]*3})
                for child, parent in contract['part_visibility'].items():
                    self.assertIn(child, names)
                    self.assertIn(parent, names)
                self.assertIn(f'animation.ordertocook.prototype.{variant}.handwash.first_person', poses)
                self.assertEqual(references['native_geometry'], 'geometry.humanoid.custom' + ('Slim' if variant == 'slim' else ''))
                self.assertEqual(references['native_inheritance'], [])
                for side in ('right', 'left'):
                    self.assertEqual(references['source_frame_offsets'][side+'Arm'], [0, .5 if variant == 'slim' else 0, 0])
            self.assertEqual(contract['status'], 'prototype_no_selector')
        self.assertEqual(views, before)

    def test_source_generator_rejects_invalid_external_camera_frames_before_writing(self):
        with TemporaryDirectory() as temp:
            output = Path(temp)
            views = {side: {'rotation': [0, 0, 0], 'position': [0, 0, 0]} for side in ('right', 'left')}
            views['left']['position'][2] = float('nan')
            with self.assertRaisesRegex(ValueError, 'finite three-number'):
                converter.make_segmented_player_source(self.natives, views, output)
            self.assertEqual(list(output.iterdir()), [])

    def test_cli_requires_and_uses_the_separate_external_slim_input(self):
        with TemporaryDirectory() as temp:
            directory = Path(temp)
            frames = directory / 'frames.json'
            frames.write_text(json.dumps({side: {'rotation': [0]*3, 'position': [0]*3} for side in ('right', 'left')}))
            output = directory / 'source'
            command = [sys.executable, str(ROOT / 'tools/convert_assets.py'),
                '--segmented-player-native', os.environ['OTC_NATIVE_PLAYER_GEOMETRY'],
                '--segmented-camera-frames', str(frames), '--output', str(output)]
            missing = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(missing.returncode, 2)
            self.assertIn('separate native classic/slim', missing.stderr)
            self.assertFalse(output.exists())
            complete = subprocess.run([*command, '--segmented-player-slim', os.environ['OTC_NATIVE_SLIM_GEOMETRY']],
                                      capture_output=True, text=True)
            self.assertEqual(complete.returncode, 0, complete.stderr)
            slim = converter.read_json(output / 'slim.geometry.json')['minecraft:geometry'][0]
            bones = {bone['name']: bone for bone in slim['bones']}
            self.assertEqual(bones['rightArm']['pivot'], [-5, 21.5, 0])
            self.assertEqual(bones['rightItem']['locators']['lead_hold'], [-6, 14.5, 1])


if __name__ == '__main__':
    unittest.main()
