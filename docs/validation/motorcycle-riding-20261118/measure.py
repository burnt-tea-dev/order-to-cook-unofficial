#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Audit actual riding exports before/after exact linear-key compaction.

The baseline converter AND curve helper come from the fixed git commit. The
candidate is the current production exporter. The independent rational sampler
does not import either compactor. Serialized records are measured, not Bedrock
RAM, frame time, FPS or native animation playback. Native geometry stays local.
"""
from __future__ import annotations

import argparse
from bisect import bisect_left
from collections import Counter, defaultdict
import copy
from fractions import Fraction
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
BASELINE = 'ff19994ba426341c310d76839f13f605a5dbcbb7'
PREVIEW = 'docs/validation/motorcycle-riding-20261117/preview.py'
ANIMATION = 'RP/animations/ordertocook_player_riding.animation.json'
CAMERA = (4, 2.2, -5)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git_source(path):
    return subprocess.check_output(['git', 'show', f'{BASELINE}:{path}'], cwd=ROOT)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def records(document):
    total, per_clip, nodes = Counter(), defaultdict(Counter), Counter()
    for name, clip in document['animations'].items():
        mode = name.split('.')[-2]
        for tally in (total, per_clip[mode]):
            tally['clips'] += 1
        for channels in clip['bones'].values():
            for value in channels.values():
                track = isinstance(value, dict)
                vectors = len(value) if track else 1
                for tally in (total, per_clip[mode]):
                    tally['channels'] += 1
                    tally['tracks' if track else 'constant_vectors'] += 1
                    tally['time_keys'] += len(value) if track else 0
                    tally['vectors'] += vectors
                    tally['channel_numbers'] += vectors * 3

    def walk(value):
        if isinstance(value, dict):
            nodes['objects'] += 1
            nodes['member_keys'] += len(value)
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            nodes['arrays'] += 1
            for item in value:
                walk(item)
        elif isinstance(value, bool):
            nodes['booleans'] += 1
        elif isinstance(value, (float, int)):
            nodes['numbers'] += 1
        elif isinstance(value, str):
            nodes['strings'] += 1

    walk(document)
    total['pretty_bytes'] = len((json.dumps(document, ensure_ascii=False, indent=2) + '\n').encode())
    total['minified_bytes'] = len(json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode())
    return {'total': dict(total), 'by_clip': dict(per_clip), 'json_nodes': dict(nodes)}


def track(value):
    pairs = value.items() if isinstance(value, dict) else [('0', value)]
    points = []
    for time, vector in pairs:
        if not isinstance(vector, list) or len(vector) != 3:
            raise ValueError('Audit accepts only exported numeric linear vectors')
        if any(isinstance(v, bool) or not isinstance(v, (float, int)) for v in vector):
            raise ValueError('Unexpected non-numeric exported channel')
        points.append((Fraction(time), tuple(Fraction(str(v)) for v in vector)))
    if not points or any(a[0] >= b[0] for a, b in zip(points, points[1:])):
        raise ValueError('Expected ordered numeric keys')
    return [t for t, _ in points], [v for _, v in points]


def sample(times, vectors, time):
    index = bisect_left(times, time)
    if index == 0:
        return vectors[0]
    if index == len(times):
        return vectors[-1]
    factor = (time-times[index-1])/(times[index]-times[index-1])
    return tuple(a+(b-a)*factor for a, b in zip(vectors[index-1], vectors[index]))


def verify_channels(before, after):
    if before.keys() != after.keys() or before['format_version'] != after['format_version']:
        raise ValueError('Document metadata changed')
    if before['animations'].keys() != after['animations'].keys():
        raise ValueError('Animation identities changed')
    counts, max_float, worst = Counter(), 0.0, None
    for name, old in before['animations'].items():
        new = after['animations'][name]
        if {k: v for k, v in old.items() if k != 'bones'} != {k: v for k, v in new.items() if k != 'bones'}:
            raise ValueError('Animation policy changed: ' + name)
        if old['bones'].keys() != new['bones'].keys():
            raise ValueError('Bone ownership changed: ' + name)
        for bone, channels in old['bones'].items():
            if channels.keys() != new['bones'][bone].keys():
                raise ValueError('Channel ownership changed: ' + bone)
            for channel, value in channels.items():
                bt, bv = track(value)
                at, av = track(new['bones'][bone][channel])
                knots = sorted(set(bt + at))
                times = set(knots) | {min(knots)-1, max(knots)+1}
                for lo, hi in zip(knots, knots[1:]):
                    times.update(lo+(hi-lo)*f for f in (Fraction(1, 4), Fraction(1, 2), Fraction(3, 4)))
                bft, aft = list(map(float, bt)), list(map(float, at))
                bfv = [tuple(map(float, v)) for v in bv]
                afv = [tuple(map(float, v)) for v in av]
                for time in sorted(times):
                    if sample(bt, bv, time) != sample(at, av, time):
                        raise ValueError(f'Linear function changed: {name}/{bone}/{channel}/{time}')
                    delta = max(abs(a-b) for a, b in zip(sample(bft, bfv, float(time)), sample(aft, afv, float(time))))
                    if delta > max_float:
                        max_float, worst = delta, [name, bone, channel, str(time)]
                    counts['exact_rational_vector_checks'] += 1
                counts['channels'] += 1
                counts['partition_intervals'] += len(knots)-1
    return {**counts, 'max_float_component_delta': max_float, 'max_float_location': worst,
            'proof': 'All channels are numeric piecewise-linear vectors. Equality at every union boundary proves equality throughout each interval; quarter/midpoint and exterior samples also checked.'}


def full_mesh(renderer, preview, export, variant, name, time):
    geometry, animations, _ = export
    model = copy.deepcopy(geometry[variant])
    materials = {'debug': np.array([[(128, 160, 185, 255)]], dtype=np.uint8)}
    for bone in model['bones']:
        for cube in bone.get('cubes', []):
            cube['uv'] = {face: {'uv': [0, 0], 'uv_size': [1, 1], 'material_instance': 'debug'}
                          for face in ('west', 'east', 'north', 'south', 'up', 'down')}
    # Include every exported cube, including clothing/hat/cape overlays. Only
    # material lookup changes; coordinates, inflate, hierarchy and pivots do not.
    return renderer.geometry_quads(model, materials, preview.merged_clip(animations, variant, name), time)


def verify_mesh(renderer, preview, before, after):
    samples = {'drive_idle': [0, .5, 3.999, 4, 4.5, 8], 'drive_back': [0, .5, 3, 8],
               'drive_didi': [.2, 1.3323, 1.3333], 'drive_didi_repeat': [.1, .31, 1.059, 1.06],
               'drive_didi_light': [.05, .1667, .8323, .8333]}
    maximum, corners, poses = 0.0, 0, 0
    for variant in ('classic', 'slim'):
        for name, times in samples.items():
            for time in times:
                a, b = [np.concatenate([quad[0] for quad in full_mesh(renderer, preview, export, variant, name, time)])
                        for export in (before, after)]
                if a.shape != b.shape:
                    raise ValueError('Mesh topology changed')
                maximum = max(maximum, float(np.linalg.norm(a-b, axis=1).max()))
                corners += len(a)
                poses += 1
    return {'pose_comparisons': poses, 'face_corner_comparisons': corners,
            'max_corner_delta_model_px': maximum, 'sample_times_seconds': samples,
            'note': 'All exported cubes included; face corners repeat shared vertices. Geometry is separately byte-identical.'}


def pose_sheet(renderer, preview, before, after, output):
    rows = [('drive_idle', .5), ('drive_didi', .2), ('drive_back', .5)]
    sheet = Image.new('RGBA', (1440, 1285), renderer.BG)
    preview.title(renderer, sheet, 'Motorcycle riding | same curves, fewer stored keys',
                  'Actual ff19994 export vs exact compaction. Native classic/slim. Fixed camera and scale within each row.')
    draw = ImageDraw.Draw(sheet)
    for index, label in enumerate(('CLASSIC / ff19994', 'CLASSIC / compacted', 'SLIM / ff19994', 'SLIM / compacted')):
        draw.text((24+356*index, 115), label, font=renderer.font(15, True), fill=renderer.ACCENT)
    rows_result = []
    for row, (name, time) in enumerate(rows):
        y = 145+row*362
        scenes = [preview.scene(renderer, export, variant, name, time)
                  for variant in ('classic', 'slim') for export in (before, after)]
        fit = renderer.bounds(scenes, CAMERA)
        draw.line((20, y, 1420, y), fill=(177, 190, 195), width=1)
        draw.text((24, y+8), f'{name} / t={time:g}s', font=renderer.font(16, True), fill=renderer.INK)
        for pair, variant in enumerate(('classic', 'slim')):
            frames = [renderer.raster(scene, (348, 298), CAMERA, fit) for scene in scenes[pair*2:pair*2+2]]
            changed = int(np.any(np.asarray(frames[0]) != np.asarray(frames[1]), axis=2).sum())
            rows_result.append({'variant': variant, 'clip': name, 'seconds': time, 'changed_pixels': changed})
            draw.text((24+712*pair, y+34), f'Before/after changed image pixels: {changed}', font=renderer.font(13), fill=renderer.INK)
            for offset, frame in enumerate(frames):
                sheet.alpha_composite(frame, (20+(pair*2+offset)*356, y+58))
    renderer.caption(draw, (24, 1241), [
        'OFFLINE comparison only. Debug colors; neutral native look; empty hands. Overlays hidden in this sheet only.',
        'Exact numeric linear-function audit is separate. No Minecraft client, native controller, RAM or FPS measurement.'], 12)
    sheet.convert('RGB').save(output / 'poses-before-after.png')
    return rows_result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--native-classic', required=True, type=Path)
    parser.add_argument('--native-slim', required=True, type=Path)
    parser.add_argument('--native-license', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    common = ['player-presentation.json', 'data/java-creative-tabs.json', PREVIEW, 'tools/render_visual_review.py', *[
        'upstream/reference/common/src/main/resources/assets/ordertocook/'+name for name in
        ('animations/drive.animation.json', 'geo/drive_idle.geo.json', 'geo/drive_idle_alex.geo.json')]]
    for path in common:
        if git_source(path) != (ROOT / path).read_bytes():
            raise ValueError('Shared comparison input changed: ' + path)
    preview = load('riding_prior_preview', ROOT / PREVIEW)
    renderer = load('riding_cost_renderer', ROOT / 'tools/render_visual_review.py')
    native_paths = (args.native_classic, args.native_slim)
    for variant, path in zip(('classic', 'slim'), native_paths):
        if digest(path.read_bytes()) != preview.NATIVE_HASHES[variant]:
            parser.error('Expected the pinned Mojang ' + variant + ' input')
    license_hash = digest(args.native_license.read_bytes())
    if license_hash != 'be3564338140626538c57993573b65798d0ef2afdd4d71f285d43ebb2eedb972':
        parser.error('Expected the license accompanying the pinned native input')
    baseline_sources = {p: git_source(p) for p in ('tools/convert_assets.py', 'tools/motorcycle_curves.py')}
    args.output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='otc-riding-cost-') as temporary:
        temporary = Path(temporary)
        isolated = temporary / 'baseline-source'
        initialization = {p: git_source(p) for p in ('player-presentation.json', 'data/java-creative-tabs.json')}
        for path, data in {**baseline_sources, **initialization}.items():
            target = isolated / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        baseline = preview.load_module('riding_cost_baseline', isolated / 'tools/convert_assets.py')
        candidate = preview.load_module('riding_cost_candidate', ROOT / 'tools/convert_assets.py')
        before = preview.load_export(baseline, native_paths, temporary / 'before')
        after = preview.load_export(candidate, native_paths, temporary / 'after')
        old = json.loads((temporary / 'before' / ANIMATION).read_text())
        new = json.loads((temporary / 'after' / ANIMATION).read_text())
        unchanged = {p: before[2][p] == after[2][p] for p in before[2] if p != ANIMATION}
        if not all(unchanged.values()) or before[0] != after[0]:
            raise ValueError('Geometry, controller or shared contract changed')
        channels = verify_channels(old, new)
        meshes = verify_mesh(renderer, preview, before, after)
        images = pose_sheet(renderer, preview, before, after, args.output)
    paths = ['tools/convert_assets.py', 'tools/motorcycle_curves.py', *common,
             str(Path(__file__).resolve().relative_to(ROOT))]
    result = {
        'schema': 1, 'purpose': 'Actual-export linear equivalence and serialized-data audit',
        'baseline_commit': BASELINE,
        'baseline_program_sha256': {p: digest(v) for p, v in baseline_sources.items()},
        'candidate_git_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'candidate_identity': 'Working-tree source hashes below; git head alone does not identify an uncommitted candidate',
        'candidate_source_sha256': {p: digest((ROOT / p).read_bytes()) for p in paths},
        'native_commit': preview.NATIVE_COMMIT, 'native_sha256': preview.NATIVE_HASHES,
        'native_license_sha256': license_hash, 'before_output_sha256': before[2], 'after_output_sha256': after[2],
        'unchanged_outputs': unchanged, 'before': records(old), 'after': records(new),
        'channel_equivalence': channels, 'mesh_equivalence': meshes, 'pose_sheet': images,
        'image_sha256': digest((args.output / 'poses-before-after.png').read_bytes()),
        'limits': ['Serialized keys/vectors/numbers/bytes are not measured Bedrock RAM, FPS, frame time or load time.',
                   'Rational arithmetic proves the exported linear functions equal; native floating-point evaluation is not observed.',
                   'CPU model rendering is not Minecraft playback; no native controller, blending, network, skin or item acceptance.',
                   'Native inputs and generated player geometry remain external or temporary; not redistributed.'],
    }
    (args.output / 'results.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({k: result[k] for k in ('before', 'after', 'channel_equivalence', 'mesh_equivalence', 'pose_sheet')}, indent=2))


if __name__ == '__main__':
    main()
