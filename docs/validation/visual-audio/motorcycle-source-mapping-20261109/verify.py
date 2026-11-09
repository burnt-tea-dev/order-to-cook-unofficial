#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Verify frozen motorcycle evidence and regenerate scenes in an isolated temp dir.

No extractor, output-directory argument, network, GUI, or repository writes.
The gzip scene payloads are decoded in memory with a 1 MiB hard bound.
"""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import zlib

sys.dont_write_bytecode = True

BUNDLE = Path(__file__).resolve().parent
ROOT = BUNDLE.parents[3]
MAX_SCENE = 1024 * 1024


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def checked_path(root, relative):
    p = PurePosixPath(relative)
    if (not relative or relative != p.as_posix() or p.is_absolute() or
            '..' in p.parts or '.' in p.parts or '\\' in relative):
        raise ValueError('invalid relative path')
    target = root
    for part in p.parts:
        target = target / part
        if target.is_symlink():
            raise ValueError('symlink not allowed')
    if not target.is_file():
        raise ValueError('not a regular file')
    return target


def bounded_gzip(data, expected_size):
    if not isinstance(expected_size, int) or not 0 < expected_size <= MAX_SCENE:
        raise ValueError('invalid decompressed size')
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    decoded = decoder.decompress(data, expected_size + 1)
    if (len(decoded) != expected_size or not decoder.eof or
            decoder.unused_data or decoder.unconsumed_tail):
        raise ValueError('gzip size, trailing data, or completeness mismatch')
    return decoded


def load_json(path):
    return json.loads(path.read_text())


def run():
    inventory = load_json(BUNDLE / 'bundle-hashes.json')
    actual = {p.relative_to(BUNDLE).as_posix() for p in BUNDLE.rglob('*')
              if p.is_file() and '__pycache__' not in p.parts and p != BUNDLE / 'bundle-hashes.json'}
    assert actual == set(inventory), 'bundle inventory mismatch'
    for relative, expected in inventory.items():
        data = checked_path(BUNDLE, relative).read_bytes()
        assert len(data) == expected['bytes'] and sha(data) == expected['sha256'], relative

    identities = load_json(BUNDLE / 'input-identities.json')
    for relative, expected in identities['current_inputs'].items():
        data = checked_path(ROOT, relative).read_bytes()
        assert sha(data) == expected['sha256'] and blob(data) == expected['git_blob'], relative
    before_raw = checked_path(BUNDLE, identities['before_geometry']['bundle_path']).read_bytes()
    assert sha(before_raw) == identities['before_geometry']['sha256']
    assert blob(before_raw) == identities['before_geometry']['git_blob']
    model = ROOT / 'upstream/reference/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java'
    source = model.read_text()
    spec = importlib.util.spec_from_file_location('evidence_oracle', ROOT / 'tests/motorcycle_oracle.py')
    oracle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(oracle)
    java = oracle.parse_java(source)
    geometries = {'before': json.loads(before_raw),
                  'candidate': load_json(ROOT / 'runtime/RP/models/entity/motorcycle.geo.json')}
    reports = {kind: oracle.compare(source, geometry) for kind, geometry in geometries.items()}
    assert reports['before']['affected_corner_boxes'] == 16
    assert reports['before']['uv_changed_boxes'] == 41
    assert abs(reports['before']['max_corner_distance'] - 16.6363672034) < 1e-8
    assert reports['before']['max_uv_residual_pixels'] == 34
    assert reports['candidate']['max_corner_distance'] < 1e-5
    assert reports['candidate']['max_uv_residual_pixels'] == 0
    assert reports['candidate']['affected_corner_boxes'] == 0
    assert reports['candidate']['uv_changed_boxes'] == 0

    rows = load_json(BUNDLE / 'scene-manifest.json')
    assert len(rows) == 10
    expected_names = {'00_neutral_geometry_uv_control.bbmodel'} | {
        'motorcycle_' + color + '.bbmodel' for color in ['white', 'red', 'blue', 'yellow']}
    assert {(r['kind'], r['name']) for r in rows} == {
        (kind, name) for kind in geometries for name in expected_names}
    decoded_scenes = {}
    graph_checks = []
    for row in rows:
        packed = checked_path(BUNDLE, row['path']).read_bytes()
        assert len(packed) == row['bytes'] and sha(packed) == row['sha256']
        raw = bounded_gzip(packed, row['uncompressed_bytes'])
        assert sha(raw) == row['uncompressed_sha256']
        decoded_scenes[row['kind'], row['name']] = raw
        scene = json.loads(raw)
        bones = {b['name']: b for b in geometries[row['kind']]['minecraft:geometry'][0]['bones']}
        graph_checks.append(dict(kind=row['kind'], scene=row['name'],
                                 **oracle.verify_scene_graph(scene, java, bones)))
        assert len(scene['elements']) == (6 if row['name'].startswith('00_') else 82)
        for texture in scene['textures']:
            original = ROOT / 'upstream/reference/common/src/main/resources/assets/ordertocook/textures/entity' / texture['name']
            assert base64.b64decode(texture['source'].split(',', 1)[1], validate=True) == original.read_bytes()
            assert texture['render_mode'] == 'default' and texture['render_sides'] == 'auto'

    # The reviewed helper writes only inside this newly created private temp dir.
    # Both complete sets must reproduce the exact originally viewed bytes.
    with tempfile.TemporaryDirectory(prefix='otc-motorcycle-evidence-') as temp:
        for kind, label, geometry in [('before', 'CURRENT RP', BUNDLE / 'before.geo.json'),
                                      ('candidate', 'CANDIDATE RP', ROOT / 'runtime/RP/models/entity/motorcycle.geo.json')]:
            output = Path(temp) / kind
            subprocess.run([sys.executable, '-B', str(ROOT / 'tools/review_motorcycle.py'),
                            '--output', str(output), '--geometry', str(geometry),
                            '--comparison-label', label], check=True, capture_output=True)
            for name in expected_names:
                assert (output / 'scenes' / name).read_bytes() == decoded_scenes[kind, name], (kind, name)

    receipt = load_json(BUNDLE / 'capture-receipt.json')
    assert len(receipt['images']) == 9
    for row in receipt['images']:
        data = checked_path(BUNDLE, row['image']).read_bytes()
        assert len(data) == row['bytes'] and sha(data) == row['sha256']
        assert row['scene_sha256'] == sha(decoded_scenes[row['fixture_kind'], row['scene']])
    result = {'status': 'PASS', 'current_input_identities': len(identities['current_inputs']),
              'raw_GUI_images': 9, 'exact_scene_regenerations': 10,
              'mapping': reports, 'serialized_graph_checks': graph_checks,
              'scope': 'Static model evidence. No native renderer, gameplay, steering, timing or shader acceptance.'}
    print(json.dumps(result, indent=2))
    return result


if __name__ == '__main__':
    run()
