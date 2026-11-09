#!/usr/bin/env python3
"""Verify this directory without Git, network, GUI or mutable original artifacts.

An optional --assemble DIR writes original bytes into a *new* directory outside
this bundle, under an existing real directory. Dot-dot paths and symlinks are
rejected before writes. Normal verification uses a temporary copy and removes it.
Python 3.10+, NumPy, Pillow and Node 18+ must already be installed.
"""
import argparse
import ast
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import numpy
import PIL
from PIL import Image

ROOT = Path(__file__).resolve().parent
if sys.flags.optimize:
    raise SystemExit('Run without -O: all assertions must remain active.')

def load(path):
    return json.loads(path.read_text())

def sha(data):
    return hashlib.sha256(data).hexdigest()

def oid(kind, data):
    return hashlib.sha1(f'{kind} {len(data)}'.encode() + b'\0' + data).hexdigest()

def member(base, relative):
    p = Path(relative)
    assert not p.is_absolute() and '..' not in p.parts
    result = base / p
    assert not result.is_symlink()
    return result

def verify_storage():
    expected = load(ROOT / 'public-file-hashes.json')
    entries = list(ROOT.rglob('*'))
    if any(p.is_symlink() for p in entries):
        raise ValueError('The public bundle must not contain symlinks.')
    actual = {p.relative_to(ROOT).as_posix() for p in entries
              if p.is_file() and p != ROOT / 'public-file-hashes.json'}
    assert actual == set(expected), ('unexpected or missing public files', actual ^ set(expected))
    for name, row in expected.items():
        data = member(ROOT, name).read_bytes()
        assert sha(data) == row['sha256'] and len(data) == row['bytes'], name
        assert len(data) <= 128 * 1024, ('publication blob limit', name)
    return len(expected)

def original_bytes(row):
    data = member(ROOT, row['published_path']).read_bytes()
    assert sha(data) == row['published_sha256'] and len(data) == row['published_bytes']
    if row['storage'] == 'gzip-original-bytes':
        data = gzip.decompress(data)
    else:
        assert row['storage'] == 'original-bytes'
    assert sha(data) == row['sha256'] and len(data) == row['bytes']
    assert oid('blob', data) == row['git_blob']
    return data

def assembly_destination(destination):
    """Validate every destination relationship before creating any directory."""
    destination = Path(destination)
    if '..' in destination.parts:
        raise ValueError('Assembly destination must not contain dot-dot components.')
    absolute = destination.absolute()
    for component in (absolute, *absolute.parents):
        if component.is_symlink():
            raise ValueError('Assembly destination and its parents must not be symlinks.')
    source = ROOT.resolve(strict=True)
    canonical = absolute.resolve(strict=False)
    if canonical == source or source in canonical.parents or canonical in source.parents:
        raise ValueError('Assembly destination must not be the source, its child or its ancestor.')
    if absolute.exists():
        raise FileExistsError('Assembly requires a new, nonexistent output directory.')
    if not absolute.parent.is_dir():
        raise ValueError('Assembly destination requires an existing real parent directory.')
    return canonical

def assemble(destination):
    destination = assembly_destination(destination)
    preservation = load(ROOT / 'preservation.json')
    plan = []
    paths = set()
    for row in preservation['files']:
        if row['storage'] == 'omitted-provenance-metadata':
            continue
        path = member(destination, row['original_path'])
        if path == destination or path in paths or any(
                prior in path.parents or path in prior.parents for prior in paths):
            raise ValueError('Assembly manifest contains duplicate or conflicting output paths.')
        paths.add(path)
        # Preflight all payload hashes and decompression before any filesystem write.
        plan.append((path, original_bytes(row)))
    destination = assembly_destination(destination)
    destination.mkdir()
    for path, data in plan:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return preservation

def verify_trees(frozen):
    proof = load(ROOT / 'provenance/repository-identity.json')
    objects = {}
    for row in proof['objects']:
        data = member(ROOT, row['path']).read_bytes()
        assert len(data) == row['bytes'] and sha(data) == row['sha256']
        assert oid(row['type'], data) == row['oid']
        objects[row['type'], row['oid']] = data
    def tree_entries(tree):
        data = objects['tree', tree]
        entries = {}
        while data:
            raw, data = data.split(b'\0', 1)
            mode, name = raw.split(b' ', 1)
            assert len(data) >= 20
            entries[name.decode()] = (mode, data[:20].hex())
            data = data[20:]
        return entries
    manifest = load(frozen / 'input-manifest.json')
    assert set(proof['commits']) == {'current_main', 'original_local_integration'}
    assert proof['commits']['original_local_integration'] == manifest['commit']
    assert proof['commits']['current_main'] == 'ed1b0aa4a213b1e5a898c75d1704687cc22521be'
    assert len(proof['inputs']) == 2 * len(manifest['files']) == 34
    seen = set()
    for row in proof['inputs']:
        key = row['commit_label'], row['path']
        assert key not in seen
        seen.add(key)
        commit = objects['commit', proof['commits'][row['commit_label']]]
        first_line = commit.split(b'\n', 1)[0]
        assert first_line.startswith(b'tree ')
        tree = first_line[5:].decode()
        parts = Path(row['path']).parts
        for index, part in enumerate(parts):
            mode, tree = tree_entries(tree)[part]
            assert mode == (b'100644' if index == len(parts)-1 else b'40000')
        raw = member(frozen / 'inputs', row['path']).read_bytes()
        expected = manifest['files'][row['path']]
        assert tree == row['git_blob'] == expected['repo_git_blob'] == oid('blob', raw)
        assert len(raw) == row['bytes'] == expected['size']
        assert sha(raw) == row['sha256'] == expected['sha256']
    return len(proof['inputs'])

def verify_history_and_receipts(frozen, preservation):
    mapping = {row['original_path']: row for row in preservation['files']}
    history = load(frozen / 'artifact-hashes.json')
    omitted = [k for k, row in mapping.items() if row['storage'] == 'omitted-provenance-metadata']
    assert omitted == ['source-evidence/gecko-cache-provenance.json']
    for path, digest in history.items():
        assert mapping[path]['sha256'] == digest
        if path not in omitted:
            assert sha(member(frozen, path).read_bytes()) == digest
    projection = load(ROOT / 'provenance/geckolib-sources.json')
    assert projection['original_receipt_sha256'] == history[omitted[0]]
    assert len(projection['records']) == 5
    for row in projection['records']:
        raw = member(frozen, row['file']).read_bytes()
        assert sha(raw) == row['sha256'] and len(raw) == row['bytes']
        assert oid('blob', raw) == row['git_blob']
    manifest = load(frozen / 'scene-manifest.json')
    assert manifest['gui_run'] is False and manifest['native_run'] is False
    scenes = {x['id']: x for x in manifest['samples']}
    assert len(scenes) == 7 and all(x['status'] == 'prepared, not GUI tested' for x in scenes.values())
    assert load(frozen / 'verification.json')['gui_tested'] is False
    for path, digest in load(frozen / 'scene-freeze-hashes.json').items():
        assert sha(member(frozen, path).read_bytes()) == digest
    first = load(frozen / 'gui-receipt.json')
    completion = load(frozen / 'gui-receipt-completion.json')
    current = load(ROOT / 'gui-independent-receipt.json')
    assert len(first['customer_observations']) == 4 and len(completion['customer_observations']) == 4
    assert 'pending' in completion['status']  # Historical pending review remains historical.
    assert completion['previous_receipt']['sha256'] == sha((frozen / 'gui-receipt.json').read_bytes())
    assert first['scene_freeze_manifest_sha256'] == sha((frozen / 'scene-freeze-hashes.json').read_bytes())
    for item in current['historical_receipts']:
        assert sha(member(frozen, item['path']).read_bytes()) == item['sha256']
    photographs = {}
    for receipt in (first, completion, current):
        assert receipt['prepared_manifest_sha256'] == sha((frozen / 'scene-manifest.json').read_bytes())
        for row in receipt['customer_observations']:
            s = scenes[row['scene_id']]
            assert row['scene'] == s['path'] and row['scene_sha256'] == s['sha256']
            assert (row['rig'], row['clip'], row['clip_seconds']) == (s['rig'], s['clip'], s['time'])
            assert row['query_inputs'] == s['query_inputs'] and row['sides'] == s['sides']
            assert row['source_screen_side'].startswith('right') and row['rp_screen_side'].startswith('left')
            assert row['frame_complete'] and row['models_unselected']
        for row in receipt['customer_observations'] + receipt.get('diagnostics', []):
            raw = member(frozen, row['path']).read_bytes()
            assert sha(raw) == row['sha256'] and len(raw) == row['bytes']
            with Image.open(member(frozen, row['path'])) as im:
                im.load()
                assert list(im.size) == row['dimensions'] == [1188, 848]
                assert im.format == row['format'] == 'JPEG'
            if row['path'] in photographs:
                assert photographs[row['path']] == row['sha256']
            photographs[row['path']] = row['sha256']
    assert {r['path'] for r in current['customer_observations']} == {r['path'] for r in first['customer_observations'] + completion['customer_observations']}
    assert all(r['independent_original_image_inspection'] for r in current['customer_observations'])
    assert all(r['counts_as_customer_scene'] is False for r in current['diagnostics'])
    assert current['counts'] == {'customer_photographs': 8, 'unique_customer_scenes': 7, 'separate_renderer_diagnostics': 3}
    assert len({r['scene_id'] for r in current['customer_observations']}) == 7
    assert len(photographs) == 11
    assert current['native_acceptance'] is False and current['prepared_status_promoted'] is False
    return {'original_preparation_artifacts_unchanged': len(history)-1,
            'omitted_original_metadata_receipts': 1, 'original_files_preserved': len(mapping)-1,
            'customer_photographs': 8, 'unique_customer_scenes': 7, 'renderer_diagnostics': 3}

def verify_oracle_adaptation(frozen):
    original = (frozen / 'verify_review.py').read_text()
    public = (ROOT / 'tools/verify_pose.py').read_text()
    record = load(ROOT / 'provenance/portable-adaptation.json')
    assert sha(original.encode()) == record['original_verifier_sha256']
    assert sha(public.encode()) == record['public_verifier_sha256']
    a = {n.name: ast.dump(n) for n in ast.parse(original).body if isinstance(n, ast.FunctionDef)}
    b = {n.name: ast.dump(n) for n in ast.parse(public).body if isinstance(n, ast.FunctionDef)}
    assert set(a) == set(b)
    assert all(a[name] == b[name] for name in a if name != 'main'), 'Pose math must remain unchanged.'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assemble', type=Path, help='restore originals into a new directory, then exit')
    args = parser.parse_args()
    storage_count = verify_storage()
    if args.assemble:
        assemble(args.assemble)
        print('Assembled original bytes. No historical preparation record was promoted.')
        return
    with tempfile.TemporaryDirectory(prefix='otc-customer-public-') as td:
        frozen = Path(td) / 'assembled'
        preservation = assemble(frozen)
        receipts = verify_history_and_receipts(frozen, preservation)
        memberships = verify_trees(frozen)
        verify_oracle_adaptation(frozen)
        before = {p.relative_to(frozen).as_posix(): sha(p.read_bytes()) for p in frozen.rglob('*') if p.is_file()}
        result = subprocess.run([sys.executable, '-B', str(ROOT / 'tools/verify_pose.py'), str(frozen)],
                                text=True, check=True, capture_output=True, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
        numerical = load(frozen / 'verification.json')
        assert numerical['scene_count'] == 7 and numerical['sampled_corner_comparisons'] == 2240
        assert numerical['fresh_process_reproduction'] == 'byte-identical'
        assert numerical['gui_tested'] is False and numerical['bedrock_native_tested'] is False
        after = {p.relative_to(frozen).as_posix(): sha(p.read_bytes()) for p in frozen.rglob('*') if p.is_file()}
        assert before == after, 'Even the disposable report should reproduce the historical bytes.'
    report = {'status': 'PASS portable identity, receipt integrity and static pose reproduction only',
              'public_files_verified': storage_count, 'repository_input_memberships': memberships,
              **receipts, 'frozen_scenes_reproduced': 7, 'sampled_corner_comparisons': 2240,
              'max_corner_component_error_model_units': numerical['max_corner_component_error_model_units'],
              'python': sys.version.split()[0], 'pillow': PIL.__version__, 'numpy': numpy.__version__,
              'native_acceptance': False, 'runtime_changed': False, 'images_modified': False}
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
