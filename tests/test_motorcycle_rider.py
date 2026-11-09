#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Source samples and forward endpoint checks for the mounted TP idle.

The reference values below are hand-calculated from the pinned authored keys
and GeckoLib 4.8.3 spline. The forward evaluator does not call the converter's
inverse retargeting, limb fitting, sampling or rotation functions.
"""
import copy
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from test_appliance_geometry import converter, native_player_rig

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'upstream/reference'
ASSETS = SOURCE / converter.ASSET_REL
ANIMATION = ASSETS / 'animations/drive.animation.json'
NAME = 'animation.ordertocook.player.motorcycle_idle'
RELATIVE_OUTPUT = 'animations/motorcycle_player.animation.json'


def first_authored_value(channel):
    """Read only the initial value; no temporal interpolation here."""
    while isinstance(channel, dict):
        if 'vector' in channel:
            channel = channel['vector']
        elif 'post' in channel:
            channel = channel['post']
        else:
            channel = channel[min(channel, key=float)]
    return list(channel)


def source_reference(original, seconds):
    # right X, left X, head Y, both foot X, both foot Z.
    # .5s arm entries use Gecko's p0=start, p1=start, p2=end, p3=next,
    # respectively [-75,-75,-72.5,-75] and [-75,-75,-77.5,-72.5].
    samples = {
        0: (-75, -75, 0, 50, -.75),
        .5: (-73.59375, -76.5625, 0, 47.5, -17/24),
        5: (-72.5, -77.5, -5, 45, -.5),
        7: (-77.5, -72.5, 5, 40, -.5),
        8: (-75, -75, 0, 50, -.75),
    }
    right_x, left_x, head_y, foot_x, foot_z = samples[seconds]
    bones = {name: {channel: first_authored_value(value) for channel, value in channels.items()}
             for name, channels in original['bones'].items()}
    bones['right_arm']['rotation'][0] = right_x
    bones['left_arm']['rotation'][0] = left_x
    bones['head']['rotation'][1] = head_y
    for side in ('right', 'left'):
        bones[side+'_foot']['rotation'][0] = foot_x
        bones[side+'_foot']['position'][2] = foot_z
    return bones


def sample_emitted(channel, seconds, default):
    if channel is None:
        return list(default)
    if isinstance(channel, list):
        return channel
    return channel[f'{seconds:g}']


def forward_point(rig, pose, name, point, seconds=None):
    """Apply the authored hierarchy forward, in Bedrock JSON coordinates."""
    lookup = {bone['name']: bone for bone in rig}
    point = list(point)
    while name:
        bone = lookup[name]
        channels = pose.get(name, {})
        get = (lambda key, default: sample_emitted(channels.get(key), seconds, default)) if seconds is not None else (
            lambda key, default: channels.get(key, default))
        pivot = bone['pivot']
        scale = get('scale', [1, 1, 1])
        x, y, z = [(point[i]-pivot[i])*scale[i] for i in range(3)]
        rx, ry, rz = [math.radians(v) for v in get('rotation', [0, 0, 0])]
        # X reflection in the renderer turns declared JSON X/Z into negative
        # conventional right-handed rotations, while Y keeps its sign.
        for axis, angle in ((0, -rx), (1, ry), (2, -rz)):
            c, s = math.cos(angle), math.sin(angle)
            if axis == 0:
                y, z = c*y-s*z, s*y+c*z
            elif axis == 1:
                x, z = c*x+s*z, -s*x+c*z
            else:
                x, y = c*x-s*y, s*x+c*y
        point = [v+p+q for v, p, q in zip((x, y, z), pivot, get('position', [0, 0, 0]))]
        name = bone.get('parent')
    return point


class MotorcycleRiderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source_document = json.loads(ANIMATION.read_text())
        cls.original = cls.source_document['animations']['drive_idle']
        cls.source_rig = json.loads((ASSETS / 'geo/drive_idle.geo.json').read_text())['minecraft:geometry'][0]['bones']
        cls.source_lookup = {bone['name']: bone for bone in cls.source_rig}
        cls.native_rig = native_player_rig()

    def generate(self, document=None):
        read_json = converter.read_json
        def read(path):
            return copy.deepcopy(document) if document is not None and path == ANIMATION else read_json(path)
        with TemporaryDirectory() as temporary:
            output = Path(temporary)
            with patch.multiple(converter, create=True, SOURCE=SOURCE, ASSETS=ASSETS,
                                OUT=output, RP=output/'RP', PROVENANCE=[]), patch.object(converter, 'read_json', read):
                converter.make_player_motorcycle_animation()
                provenance = copy.deepcopy(converter.PROVENANCE)
            return json.loads((output/'RP'/RELATIVE_OUTPUT).read_text()), provenance

    def assert_pose_endpoints(self, source_pose, native_pose, time):
        for side, sign in (('right', -1), ('left', 1)):
            for upper, lower, native_name, native_x, native_y in (
                    ('arm', 'hand', side+'Arm', sign*6, 24),
                    ('leg', 'foot', side+'Leg', sign*1.9, 12)):
                source_upper = self.source_lookup[side+'_'+upper]
                cube = source_upper['cubes'][0]
                source_x = cube['origin'][0] + cube['size'][0]/2
                source_top = [source_x, cube['origin'][1]+cube['size'][1], 0]
                source_tip = [source_x, self.source_lookup[side+'_'+lower]['cubes'][0]['origin'][1], 0]
                for source_name, source_point, native_point in (
                        (side+'_'+upper, source_top, [native_x, native_y, 0]),
                        (side+'_'+lower, source_tip, [native_x, native_y-12, 0])):
                    expected = forward_point(self.source_rig, source_pose, source_name, source_point)
                    actual = forward_point(self.native_rig, native_pose, native_name, native_point, time)
                    self.assertLess(math.dist(expected, actual), .0001,
                                    (time, source_name, source_point, expected, actual))
        # Head is a torso sibling in Java and a body child in native geometry.
        # Nonzero idle head yaw catches a component-wise Euler subtraction.
        for point in ([0, 24, 0], [1, 24, 0], [0, 25, 0], [0, 24, 1]):
            expected = forward_point(self.source_rig, source_pose, 'head', point)
            actual = forward_point(self.native_rig, native_pose, 'head', point, time)
            self.assertLess(math.dist(expected, actual), .0001, (time, 'head', expected, actual))

    def test_regeneration_keeps_mount_gate_source_knots_and_no_camera_or_world_offset(self):
        generated, provenance = self.generate()
        self.assertEqual(generated, json.loads((ROOT/'runtime/RP'/RELATIVE_OUTPUT).read_text()))
        clips = generated['animations']
        self.assertEqual(set(clips), {NAME, NAME+'_stop'})
        clip = clips[NAME]
        self.assertIs(clip['loop'], True)
        self.assertEqual(clip['animation_length'], self.original['animation_length'])
        self.assertEqual(clip['blend_weight'], "!query.is_first_person && query.is_riding_any_entity_of_type('ordertocook:motorcycle')")
        self.assertEqual(clips[NAME+'_stop'], {'animation_length': .05})
        self.assertEqual(clip['bones']['root'], {'scale': [1, 1, 1], 'position': [0, 0, 0]})
        keys = set(clip['bones']['rightArm']['rotation'])
        self.assertTrue({'0', '0.5', '1.4167', '3.999', '4', '8'} <= keys)
        self.assertEqual(len(keys), 163)  # 161 ticks + 1.4167s hand knot + 3.999s Gecko pre.
        self.assertEqual({entry['source'] for entry in provenance}, {
            str(ANIMATION.relative_to(SOURCE)), str((ASSETS/'geo/drive_idle.geo.json').relative_to(SOURCE))})

    def test_actual_source_spline_samples_differ_from_linear_and_use_gecko_pre_time(self):
        right = converter.motorcycle_idle_keyframes(self.original['bones']['right_arm']['rotation'])
        left = converter.motorcycle_idle_keyframes(self.original['bones']['left_arm']['rotation'])
        head = converter.motorcycle_idle_keyframes(self.original['bones']['head']['rotation'])
        self.assertEqual(right[0][1], [-75, 12.5, 0])
        self.assertEqual(right[1][1], [-72.5, 12.5, 0])
        self.assertEqual(left[1][1], [-77.5, -12.5, 0])
        self.assertEqual(converter.sample_motorcycle_idle_channel(right, .5), [-73.59375, 12.5, 0])
        self.assertEqual(converter.sample_motorcycle_idle_channel(left, .5), [-76.5625, -12.5, 0])
        self.assertEqual([entry[0] for entry in head[:2]], [3.999, 4])
        self.assertEqual(converter.sample_motorcycle_idle_channel(head, 4.5), [0, -3.125, 0])

    def test_generated_limb_endpoints_and_head_orientation_follow_independent_source_samples(self):
        generated, _ = self.generate()
        for time in (0, .5, 5, 7, 8):
            with self.subTest(time=time):
                self.assert_pose_endpoints(source_reference(self.original, time), generated['animations'][NAME]['bones'], time)

    def test_source_forearm_change_moves_only_its_fitted_arm_and_rejects_stale_output(self):
        baseline, _ = self.generate()
        document = copy.deepcopy(self.source_document)
        original = document['animations']['drive_idle']
        original['bones']['left_hand']['rotation']['vector'][2] += 20
        changed, _ = self.generate(document)
        before, after = baseline['animations'][NAME]['bones'], changed['animations'][NAME]['bones']
        self.assertNotEqual(before['leftArm'], after['leftArm'])
        for bone in set(before) - {'leftArm'}:
            self.assertEqual(before[bone], after[bone], bone)
        self.assert_pose_endpoints(source_reference(original, .5), after, .5)
        with self.assertRaises(AssertionError):
            self.assert_pose_endpoints(source_reference(original, .5), before, .5)

    def test_unreviewed_curve_or_moving_torso_fails_closed(self):
        for change in ('easing', 'torso'):
            document = copy.deepcopy(self.source_document)
            original = document['animations']['drive_idle']
            if change == 'easing':
                original['bones']['right_arm']['rotation']['1.0']['lerp_mode'] = 'easeInBounce'
            else:
                original['bones']['torso']['rotation']['1.0'] = {'vector': [17.5, -10, 0]}
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.generate(document)


if __name__ == '__main__':
    unittest.main()
