# SPDX-License-Identifier: GPL-3.0-only
"""Regenerate actual converter output, compare against independent source oracle."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys
import base64
from motorcycle_oracle import compare, parse_java, jfaces, jworld, rpfaces, bbrect, verify_scene_graph

ROOT = Path(__file__).resolve().parents[1]
MODEL = Path('forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java')
SOURCE = (ROOT / 'upstream/reference' / MODEL).read_text()
GEOMETRY = ROOT / 'runtime/RP/models/entity/motorcycle.geo.json'


def regenerate(text):
    spec = importlib.util.spec_from_file_location('production_motorcycle', ROOT / 'tools/convert_assets.py')
    converter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(converter)
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        converter.SOURCE = base / 'source'
        converter.OUT = base / 'runtime'
        converter.RP = converter.OUT / 'RP'
        source = converter.SOURCE / MODEL
        source.parent.mkdir(parents=True)
        source.write_text(text)
        converter.make_motorcycle_geo()
        return json.loads((converter.RP / 'models/entity/motorcycle.geo.json').read_text())


class MotorcycleMapping(unittest.TestCase):
    def assert_mapping(self, text, geometry):
        report = compare(text, geometry)
        self.assertLess(report['max_corner_distance'], 1e-5, report)
        self.assertEqual(report['max_uv_residual_pixels'], 0, report)
        return report

    def test_real_regeneration_and_checked_in_geometry(self):
        result = regenerate(SOURCE)
        self.assertEqual(result, json.loads(GEOMETRY.read_text()))
        print('REGENERATED SOURCE COMPARISON', self.assert_mapping(SOURCE, result))

    def test_independent_hand_controls(self):
        java = parse_java(SOURCE)
        center = jworld(java, 'cube_r1', [2.5, 18, 1.5])
        for actual, expected in zip(center, [2.5, 9.7489282637, -15.3526184199]):
            self.assertAlmostEqual(actual, expected, places=8)
        faces = jfaces(java['body']['cubes'][0])
        self.assertEqual(faces['north'][0], [61, 8])
        self.assertEqual(faces['north'][1], [53, 8])
        planes = [c for b in java.values() for c in b['cubes'] if c['size'][0] == 0]
        self.assertEqual(len(planes), 2)
        for c in planes:
            self.assertNotEqual(jfaces(c)['east'], jfaces(c)['west'])

    def test_old_x_and_uv_regressions_fail_independently(self):
        good = regenerate(SOURCE)
        wrong_x = copy.deepcopy(good)
        for b in wrong_x['minecraft:geometry'][0]['bones']:
            if 'rotation' in b:
                b['rotation'][0] *= -1
        r = compare(SOURCE, wrong_x)
        self.assertEqual(r['affected_corner_boxes'], 16)
        self.assertGreater(r['max_corner_distance'], 16)
        self.assertEqual(r['max_uv_residual_pixels'], 0)
        wrong_uv = copy.deepcopy(good)
        for b in wrong_uv['minecraft:geometry'][0]['bones']:
            for c in b['cubes']:
                c.pop('mirror', None)
        r = compare(SOURCE, wrong_uv)
        self.assertEqual(r['uv_changed_boxes'], 41)
        self.assertEqual(r['max_uv_residual_pixels'], 34)
        self.assertLess(r['max_corner_distance'], 1e-5)

    def test_source_x_and_uv_mutations_regenerate(self):
        baseline = regenerate(SOURCE)
        for old, new in [('-0.384F', '-0.617F'), ('.texOffs(45, 0)', '.texOffs(43, 2)')]:
            self.assertIn(old, SOURCE)
            mutated = SOURCE.replace(old, new, 1)
            result = regenerate(mutated)
            self.assertNotEqual(result, baseline)
            self.assert_mapping(mutated, result)
            with self.assertRaises(AssertionError):
                self.assert_mapping(mutated, baseline)

    def test_inflation_and_original_zero_width_are_preserved(self):
        mutated = SOURCE.replace('new CubeDeformation(0.0F)', 'new CubeDeformation(0.125F)')
        self.assertNotEqual(mutated, SOURCE)
        self.assert_mapping(mutated, regenerate(mutated))

    def test_unexercised_z_is_rejected(self):
        # Locate an existing X-only PartPose rather than assume its parent offset.
        import re
        match = re.search(r'PartPose.offsetAndRotation\([^;]*?-0.384F, 0.0F, 0.0F\)', SOURCE)
        self.assertIsNotNone(match)
        mutated = SOURCE.replace(match[0], match[0][:-5] + '0.2F)', 1)
        with self.assertRaisesRegex(ValueError, 'Z|single.axis'):
            regenerate(mutated)

    def test_unsupported_source_mirror_and_multi_axis_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'mirror'):
            regenerate(SOURCE.replace('.texOffs(45, 0)', '.texOffs(45, 0).mirror()', 1))
        with self.assertRaisesRegex(ValueError, 'single.axis'):
            regenerate(SOURCE.replace('-0.384F, 0.0F, 0.0F', '-0.384F, 0.2F, 0.0F', 1))

    def test_entire_builder_statement_and_pose_grammar_is_consumed(self):
        mutations = [
            ('new CubeDeformation(0.0F))', 'new CubeDeformation(0.0F)).mirror (true)'),
            ('CubeListBuilder.create()', 'CubeListBuilder.create().mirror\n(true)'),
            ('new CubeDeformation(0.0F))', 'new CubeDeformation(0.0F)).unknownCall()'),
            (', PartPose.offset(', '.mirror (false), PartPose.offset('),
            ('-0.384F, 0.0F, 0.0F)', '-0.384F, 0.0F, 0.0F, 0.5F)'),
            ('-0.384F, 0.0F, 0.0F)', '-0.384F, 0.0F, 0.0F).unknownCall()'),
            ('return LayerDefinition.create', 'body.unknownCall();\nreturn LayerDefinition.create'),
        ]
        for old, new in mutations:
            with self.subTest(unsupported=new):
                self.assertIn(old, SOURCE)
                with self.assertRaisesRegex(ValueError, 'grammar'):
                    regenerate(SOURCE.replace(old, new, 1))

    def test_review_fixtures_match_formal_geometry_and_original_art(self):
        bones = {b['name']: b for b in regenerate(SOURCE)['minecraft:geometry'][0]['bones']}
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run([sys.executable, str(ROOT / 'tools/review_motorcycle.py'),
                            '--output', temp], check=True, capture_output=True)
            for path in (Path(temp) / 'scenes').glob('*.bbmodel'):
                scene = json.loads(path.read_text())
                verify_scene_graph(scene, parse_java(SOURCE), bones)
                collision = copy.deepcopy(scene)
                collision['elements'][0]['uuid'] = collision['groups'][0]['uuid']
                with self.assertRaisesRegex(AssertionError, 'collision'):
                    verify_scene_graph(collision, parse_java(SOURCE), bones)
                missing = copy.deepcopy(scene)
                missing['outliner'].pop()
                with self.assertRaisesRegex(AssertionError, 'missing'):
                    verify_scene_graph(missing, parse_java(SOURCE), bones)
                self.assertEqual(len(scene['elements']), 6 if path.name.startswith('00_') else 82)
                texture = scene['textures'][0]
                original = ROOT / 'upstream/reference/common/src/main/resources/assets/ordertocook/textures/entity' / texture['name']
                self.assertEqual(base64.b64decode(texture['source'].split(',')[1]), original.read_bytes())
                all_ids = [e['uuid'] for e in scene['elements'] + scene['groups']]
                self.assertEqual(len(all_ids), len(set(all_ids)))
                for element in scene['elements']:
                    if not element['name'].startswith('CANDIDATE RP'):
                        continue
                    _, _, name, index = element['name'].split()
                    cube = bones[name]['cubes'][int(index.removeprefix('cube'))]
                    low = [-cube['origin'][0] - cube['size'][0] + 20, *cube['origin'][1:]]
                    self.assertEqual(element['from'], low)
                    self.assertEqual(element['to'], [a+b for a,b in zip(low, cube['size'])])
                    self.assertEqual(element['inflate'], cube.get('inflate', 0))
                    self.assertFalse(element['box_uv'])
                    self.assertEqual(element['faces'], {f: {'uv': bbrect(q), 'texture': 0,
                                     'rotation': 0} for f,q in rpfaces(cube).items()})


def load_tests(loader, tests, pattern):
    # The existing CI command selects this file explicitly. Include the dynamic
    # mapping and rider regressions here instead of leaving new suites unrun.
    import test_motorcycle_presentation
    import test_motorcycle_rider
    tests.addTests(loader.loadTestsFromModule(test_motorcycle_presentation))
    tests.addTests(loader.loadTestsFromModule(test_motorcycle_rider))
    return tests


if __name__ == '__main__':
    unittest.main()
