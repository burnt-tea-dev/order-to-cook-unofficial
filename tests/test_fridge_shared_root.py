#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Common-root cross-product checks, independent forward affine and BP dispatch.

Run directly with --report PATH to save measurements; no client renderer claims.
"""
import copy
import functools
import hashlib
import importlib.util
import itertools
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('converter', ROOT/'tools/convert_assets.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
c.ASSETS = ROOT/'upstream/reference'/c.ASSET_REL
# Independent source keyframe arithmetic: bounce at .4 gives .3025; .6 is
# linear recovery from .5 to .6667. Do not use the production root selector.
ROOTS = [(1, 0), (.984875, .075625), (.95, .25),
         (1-.05*(.6667-.6)/(.6667-.5), .25*(.6667-.6)/(.6667-.5))]


def corner(bones, name, cube, mask, tracks=None, seconds=0):
    """Forward source S-R-T hierarchy; never invert or fit an affine matrix."""
    point = [v+s*f for v,s,f in zip(cube['origin'], cube['size'], mask)]
    point = c.geometry_transform3(point, cube.get('rotation', [0]*3), cube.get('pivot', [0]*3))
    while name:
        bone = bones[name]
        channels = (tracks or {}).get(name, {})
        scale = c.sample_channel(channels.get('scale'), seconds, [1]*3)
        position = c.sample_channel(channels.get('position'), seconds, [0]*3)
        rotation = [a+b for a,b in zip(bone.get('rotation', [0]*3), c.sample_channel(channels.get('rotation'), seconds, [0]*3))]
        point = [bone['pivot'][i]+(point[i]-bone['pivot'][i])*scale[i] for i in range(3)]
        point = [a+b for a,b in zip(c.geometry_transform3(point, rotation, bone['pivot']), position)]
        name = bone.get('parent')
    return point


def turn(point, facing):
    for _ in range(facing):
        point = [point[2], point[1], -point[0]]
    return point


@functools.lru_cache(maxsize=1)
def measure():
    source = c.normalize_geo(c.ASSETS/'geo/block/refrigerator.geo.json', 'geometry.source')
    clips = c.read_json(c.ASSETS/'animations/refrigerator.animation.json')['animations']
    roots, _ = c.fridge_root_samples(clips)
    metrics = {'poses': 0, 'facings': 4, 'vertices_per_facing': 0,
               'affine_to_fit_max_px': 0, 'bounds_shift_max_px': 0,
               'affine_to_bounded_max_px': 0, 'cabinet_seam_max_px': 0,
               'uv_changed_cubes': 0, 'shifted_poses': []}
    meshes = {}
    for half, closing, frame, root_id in itertools.product(('lower','upper'), (False,True), range(11), range(4)):
        name = c.fridge_pose_name(half, closing, frame, root_id)
        original = c.split_fridge_geo(source, half)
        clip_name = ('up_' if half == 'upper' else 'down_')+('close' if closing else 'open')
        expected = copy.deepcopy(clips[clip_name]['bones'])
        sz, pz = ROOTS[root_id]
        expected['bone'] = {'scale': [1,1,sz], 'position': [0,0,pz]}
        fitted = c.bake_pose(original, c.fridge_pose_clip(clips, half, closing, roots[root_id]), frame/10, 'geometry.ordertocook.'+name)
        bounded = c.read_json(ROOT/f'runtime/RP/models/blocks/{name}.geo.json')
        if bounded != c.bound_fridge_swing(copy.deepcopy(fitted), half):
            raise AssertionError('Shipped geometry is not the final factory output: '+name)
        meshes[half, closing, frame, root_id] = bounded
        before, fit, after = [{b['name']:b for b in g['minecraft:geometry'][0]['bones']} for g in (original,fitted,bounded)]
        local_shift = 0
        for bone_name,bone in before.items():
            for cube, fcube, bcube in zip(bone.get('cubes', []), fit[bone_name].get('cubes', []), after[bone_name].get('cubes', [])):
                metrics['uv_changed_cubes'] += int(cube['uv'] != bcube['uv'])
                for mask in itertools.product((0,1), repeat=3):
                    exact = corner(before, bone_name, cube, mask, expected, frame/10)
                    a = corner(fit, bone_name, fcube, mask)
                    b = corner(after, bone_name, bcube, mask)
                    metrics['vertices_per_facing'] += 1
                    for facing in range(4):
                        ep, ap, bp = [turn(p, facing) for p in (exact,a,b)]
                        for key,value in [('affine_to_fit_max_px',math.dist(ep,ap)), ('bounds_shift_max_px',math.dist(ap,bp)), ('affine_to_bounded_max_px',math.dist(ep,bp))]:
                            if value > metrics[key]:
                                metrics[key] = value
                                metrics[key+'_at'] = [half,closing,frame,root_id,bone_name,list(mask),facing]
                    local_shift = max(local_shift, math.dist(a,b))
        if local_shift > 1e-6:
            metrics['shifted_poses'].append({'pose': name, 'shift_px': local_shift})
        metrics['poses'] += 1
        c.assert_block_bounds(bounded)
    # Every independently posed pair has the same Y=16 cabinet seam. Door
    # crossings are intentionally not split at that seam. Use actual vertices.
    for root_id in range(4):
        seams = {}
        for half, closing, frame in itertools.product(('lower','upper'), (False,True), range(11)):
            mesh = meshes[half,closing,frame,root_id]['minecraft:geometry'][0]
            bones = {b['name']:b for b in mesh['bones']}
            points = []
            for cube in bones['bone']['cubes']:
                for mask in itertools.product((0,1), repeat=3):
                    p = corner(bones, 'bone', cube, mask)
                    if half == 'upper': p[1] += 16
                    if abs(p[1]-16) < 1e-6: points.append(p)
            seams[half,closing,frame] = sorted(set(map(tuple, points)))
        lower = seams['lower',False,0]
        if not lower: raise AssertionError('No cabinet seam vertices')
        for points in seams.values():
            if len(points) != len(lower): raise AssertionError('Cabinet seam topology differs')
            metrics['cabinet_seam_max_px'] = max(metrics['cabinet_seam_max_px'], max(math.dist(a,b) for a,b in zip(lower,points)))
    return metrics


class FridgeSharedRootTests(unittest.TestCase):
    def test_pinned_root_samples_and_runtime_mapping_match_source(self):
        pins = {'geo/block/refrigerator.geo.json': '30a92337a06df621d66c3156d1d81be537626a65',
                'animations/refrigerator.animation.json': 'a8c06567396965b28ef214d50760b6953f525387'}
        for path,pin in pins.items():
            data = (c.ASSETS/path).read_bytes()
            self.assertEqual(hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(), pin)
        clips = c.read_json(c.ASSETS/'animations/refrigerator.animation.json')['animations']
        source = c.read_json(c.ASSETS/'geo/block/refrigerator.geo.json')
        self.assertEqual(source['minecraft:geometry'][0]['bones'][0]['pivot'], [0,0,0])
        roots, mapping = c.fridge_root_samples(clips)
        self.assertEqual(mapping, [0,0,0,0,1,2,3,0,0,0,0])
        for actual,(sz,pz) in zip(roots,ROOTS):
            self.assertAlmostEqual(actual['scale'][2], sz, places=14)
            self.assertAlmostEqual(actual['position'][2], pz, places=14)
        text = (ROOT/'runtime/BP/scripts/appliance_pose_data.js').read_text()
        self.assertIn('export const FRIDGE_ROOT_BY_CLOSE_FRAME = '+json.dumps(mapping)+';', text)
        broken = copy.deepcopy(clips)
        broken['up_close']['bones']['bone']['scale']['0.5']['vector'][2] = .9
        with self.assertRaisesRegex(ValueError, 'close roots differ'):
            c.fridge_root_samples(broken)

    def test_all_176_poses_keep_affine_fit_bounds_uv_and_seam_limits_separate(self):
        result = measure()
        self.assertEqual(result['poses'], 176)
        self.assertEqual(result['uv_changed_cubes'], 0)
        self.assertLess(result['affine_to_fit_max_px'], .201557)
        self.assertGreater(result['affine_to_fit_max_px'], .20155)  # Catches accidental old .086 bound.
        self.assertLess(result['bounds_shift_max_px'], .126)
        self.assertLess(result['cabinet_seam_max_px'], 1e-6)
        self.assertGreater(len(result['shifted_poses']), 0)

    def test_all_2112_bp_states_resolve_exactly_one_own_door_times_common_root(self):
        total = 0
        for block_name, halves in [('refrigerator', ('lower','upper')), ('refrigerator_upper', ('upper',))]:
            definition = c.read_json(ROOT/f'runtime/BP/blocks/{block_name}.json')['minecraft:block']
            geometry_rows = [r for r in definition['permutations'] if 'minecraft:geometry' in r['components']]
            self.assertEqual(len(geometry_rows), len(halves)*88)
            self.assertEqual(len(definition['permutations']), len(geometry_rows)+4)
            self.assertEqual(definition['description']['states']['ordertocook:root_frame'], [0,1,2,3])
            self.assertEqual(definition['description']['traits']['minecraft:placement_direction']['y_rotation_offset'], 180)
            self.assertIs(definition['components']['minecraft:collision_box'], True)
            self.assertIs(definition['components']['minecraft:selection_box'], True)
            self.assertEqual(definition['components']['minecraft:material_instances']['*'],
                             {'texture':'ordertocook_block_refrigerator','render_method':'alpha_test','ambient_occlusion':0})
            for half, opened, closing, frame, root, facing in itertools.product(halves, (False,True), (False,True), range(11), range(4), ('north','south','west','east')):
                states = {'ordertocook:half':half, 'ordertocook:open':opened,'ordertocook:closing':closing,
                          'ordertocook:frame':frame,'ordertocook:root_frame':root,'minecraft:cardinal_direction':facing}
                rows = [r for r in definition['permutations'] if eval(r['condition'].replace('&&', 'and'), {'__builtins__':{}}, {'q':SimpleNamespace(block_state=states.__getitem__), 'true':True, 'false':False})]
                selected = [r for r in rows if 'minecraft:geometry' in r['components']]
                self.assertEqual(len(selected), 1)
                expected = f"refrigerator_{half}_{'close_' if closing else ''}{frame}"+(f'_root_{root}' if root else '')
                self.assertEqual(selected[0]['components']['minecraft:geometry'], 'geometry.ordertocook.'+expected)
                facing_rows = [r['components']['minecraft:transformation'] for r in rows if 'minecraft:transformation' in r['components']]
                self.assertEqual(facing_rows, [{'rotation':[0,{'north':0,'south':180,'west':90,'east':-90}[facing],0]}])
                total += 1
        self.assertEqual(total, 2112)


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--report':
        Path(sys.argv[2]).write_text(json.dumps(measure(), indent=2)+'\n')
    else:
        unittest.main()
