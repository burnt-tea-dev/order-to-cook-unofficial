#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Reproduce layout identities and compare a real Blockbench GUI export.

This is an offline evidence check, not a renderer or Minecraft client test.
"""
import copy
import hashlib
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]


def read(path):
    return json.loads(path.read_text())


def same(actual, expected, tolerance=1e-12):
    if isinstance(expected, dict):
        assert set(actual) == set(expected), (set(actual), set(expected))
        for key in expected:
            same(actual[key], expected[key], tolerance)
    elif isinstance(expected, list):
        assert len(actual) == len(expected)
        for a, b in zip(actual, expected):
            same(a, b, tolerance)
    elif isinstance(expected, (int, float)):
        assert math.isclose(actual, expected, rel_tol=0, abs_tol=tolerance), (actual, expected)
    else:
        assert actual == expected, (actual, expected)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = read(HERE / 'manifest.json')
for group, root in [('inputs', ROOT), ('evidence', HERE)]:
    for item in manifest[group]:
        path = root / item['path']
        assert sha(path) == item['sha256'], path
        assert path.stat().st_size == item['size'], path
print(f"Verified {len(manifest['inputs'])} input and {len(manifest['evidence'])} evidence identities")

with tempfile.TemporaryDirectory(prefix='otc-review-') as temporary:
    subprocess.run([sys.executable, str(HERE / 'build_stage_sheets.py'), str(ROOT), temporary], check=True)
    same(read(Path(temporary) / 'layout-manifest.json'), read(HERE / 'layout-manifest.json'))
print('Reproduced all 15 inspected layouts, with full reverse-translation checks')

# The first eight source stages were converted/exported in the actual GUI.
# Undo only the documented layout translation and the runtime atlas placement.
export = read(HERE / 'fixtures/blockbench-export-plates-01-08.geo.json')['minecraft:geometry'][0]
assert export['description']['texture_width'] == export['description']['texture_height'] == 160
assert len(export['bones']) == 1 and not export['bones'][0].get('rotation')
export_cubes = export['bones'][0]['cubes']
formal = read(ROOT / 'runtime/RP/models/entity/dining_plate.geo.json')['minecraft:geometry']
offset = 0
faces = 0
for stage in range(1, 9):
    layout = [((stage - 1) % 4 - 1.5) * 20, 0, ((stage - 1) // 4 - .5) * 20]
    expected = formal[stage]['bones'][0]['cubes']
    actual = copy.deepcopy(export_cubes[offset:offset + len(expected)])
    offset += len(expected)
    assert len(actual) == len(expected)
    for exported, runtime in zip(actual, expected):
        for key in ('origin', 'pivot'):
            if key in exported:
                exported[key][0] += layout[0]
                exported[key][2] -= layout[2]
        runtime = copy.deepcopy(runtime)
        for face in runtime['uv'].values():
            face['uv'][0] -= 38
            face['uv'][1] -= 2
            face.pop('material_instance', None)
            faces += 1
        same(exported, runtime, 1e-4)  # Blockbench rounds exported positions.
assert offset == len(export_cubes) == 50
print(f'Independent Blockbench export: {offset} cubes and {faces} faces match runtime')

# Warnings seen in Java projects are inherited zero-area faces, not layout bounds.
source = ROOT / 'upstream/reference/common/src/main/resources/assets/ordertocook/models/block/food_plate_anim'
warning_counts = []
for first in range(1, 41, 8):
    count = 0
    for stage in range(first, first + 8):
        model = read(source / f'{(stage - 1) // 4 + 1}_{(stage - 1) % 4 + 1}.json')
        for cube in model['elements']:
            size = [b - a for a, b in zip(cube['from'], cube['to'])]
            for name, face in cube['faces'].items():
                u0, v0, u1, v1 = face['uv']
                if u0 == u1 or v0 == v1:
                    axes = (0, 1) if name in ('north', 'south') else (1, 2) if name in ('east', 'west') else (0, 2)
                    assert abs(size[axes[0]] * size[axes[1]]) < 1e-12
                    count += 1
    warning_counts.append(count)
assert warning_counts == [4, 0, 16, 0, 16]
print('Source zero-area UV warnings: 4 / 0 / 16 / 0 / 16, all physically zero-area faces')

# These are static source-angle illustrations, not a proposed runtime binding.
motor = read(ROOT / 'runtime/RP/models/entity/motorcycle.geo.json')['minecraft:geometry'][0]['bones']
for yaw in (-45, 45):
    fixture = read(HERE / f'fixtures/motorcycle_steering_{yaw}.geo.json')['minecraft:geometry'][0]['bones']
    assert len(fixture) == 2 * len(motor)
    for side, prefix, shift in [(0, 'current_', -22), (1, 'source_equivalent_', 22)]:
        part = copy.deepcopy(fixture[side * len(motor):(side + 1) * len(motor)])
        for bone, original in zip(part, motor):
            assert bone['name'] == prefix + original['name']
            bone['name'] = original['name']
            if 'parent' in bone:
                assert bone['parent'].startswith(prefix)
                bone['parent'] = bone['parent'][len(prefix):]
            for obj in [bone, *bone.get('cubes', [])]:
                for key in ('origin', 'pivot'):
                    if key in obj:
                        obj[key][0] -= shift
            if side == 1 and bone['name'] in ('handle', 'front_t'):
                assert bone['rotation'] == [0, yaw, 0]
                assert 'rotation' not in original
                del bone['rotation']
        same(part, motor)
print('Both steering illustrations preserve all geometry except declared Y rotations and layout')
