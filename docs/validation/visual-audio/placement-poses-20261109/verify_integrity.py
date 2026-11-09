"""Public package identity checks. Offline and read-only; rejects escaped paths."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import stat

if not __debug__:
    raise SystemExit('Run without Python optimization: assertions are verification checks.')

ROOT = Path(__file__).resolve().parent
BASE = '78c615f219314f719489987d59b51c678cc42095'
TREE = '6d54021e860eab653b721440a2236631ac6f9fff'
RUNTIME = 'dbb2574154a54cc5ad69e75e71d23900a98a79fe'
JAVA = 'e59e3dbcabe19b783d9adb933db5fcb8bc1e4642'
GECKO = 'e81962eefd04e0cab90445d3df37b477d2767ffd'


def local_file(name):
    assert isinstance(name, str) and name and '\\' not in name, ('invalid path', name)
    p = PurePosixPath(name)
    assert not p.is_absolute() and '..' not in p.parts and str(p) == name, ('unsafe path', name)
    target = ROOT.joinpath(*p.parts)
    assert target.resolve().is_relative_to(ROOT), ('escaped path', name)
    assert not any(ROOT.joinpath(*p.parts[:i]).is_symlink() for i in range(1, len(p.parts) + 1)), ('symlink', name)
    assert target.is_file(), ('missing file', name)
    return target


def read(name):
    return json.loads(local_file(name).read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_record(name, row):
    p = local_file(name)
    data = p.read_bytes()
    assert len(data) == row['bytes'], ('size mismatch', name)
    assert hashlib.sha256(data).hexdigest() == row['sha256'], ('SHA-256 mismatch', name)
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == row['git_blob'], ('Git blob mismatch', name)


def check_public_integrity():
    actual = set()
    for p in ROOT.rglob('*'):
        name = p.relative_to(ROOT).as_posix()
        mode = p.lstat().st_mode
        if stat.S_ISDIR(mode):
            continue
        assert stat.S_ISREG(mode), ('non-regular package entry', name)
        if name != 'artifact-hashes.json':
            actual.add(name)
    index = read('artifact-hashes.json')
    assert 'artifact-hashes.json' not in index
    assert actual == set(index), ('package inventory mismatch', sorted(actual ^ set(index)))
    for name, digest in index.items():
        assert re.fullmatch('[0-9a-f]{64}', digest), ('invalid digest', name)
        assert sha(local_file(name)) == digest, ('artifact SHA mismatch', name)
    m = read('input-manifest.json')
    assert (m['runtime_commit'], m['published_docs_base_commit'], m['docs_tree'], m['java_commit'], m['gecko_commit']) == (RUNTIME, BASE, TREE, JAVA, GECKO)
    for name, row in m['files'].items():
        check_record(name, row)
    provenance = read('provenance.json')
    assert (provenance['publication_base_commit'], provenance['publication_base_tree'], provenance['runtime_commit']) == (BASE, TREE, RUNTIME)
    assert provenance['original_acquisition_docs_snapshot_commit'] == 'd06461f29dc75fc6f4f1820dfa46807bcc769c03'
    assert provenance['original_acquisition_docs_snapshot_tree'] == TREE
    assert provenance['original_preparation_artifact_index_sha256'] == '596a5ab9e8bfc1b60bfe6e614b6463edb3663075d1b734bfcc01173b38dd1004'
    assert sha(local_file('validation.json')) == provenance['original_numeric_validation_sha256']
    assert read('validation.json')['gui_run'] is False  # saved numeric-only run, not a GUI claim
    assert set(provenance['projection']) == {'input_manifest', 'scene_manifest', 'blockbench_provenance', 'omissions', 'scripts', 'fridge'}
    official = read('source/blockbench/official-provenance.json')
    assert official['application'] == 'Blockbench5.2.2'
    assert official['source_map_sha256'] == 'e51e5a44d2a8b39137ff5af8f52adb9230f481758a18b32460dfed688b74dcc8'
    assert len(official['files']) == 5
    expected_official_files = {'source/blockbench/js__formats__bedrock__bedrock.js.txt': 'd77fa9edfaaa042cd5f72211aea34cce19ff88ec477364d9bbc237355374d347', 'source/blockbench/js__formats__generic.ts.txt': '7fc5ef646b66058f8071d033a26c5fe29ddf6d71f1c98bf2c76fc4cc73ccc0f0', 'source/blockbench/js__outliner__types__group.js.txt': 'edc6a16fed27d9f4855e17df362c6d5e1efc5e8a8928c697ba0f257ab9ce98ff', 'source/blockbench/js__outliner__types__cube.js.txt': '57cad3b3eb30af04fa54d7b41c2e3a58ad26098c8585eaf30344a7f3f1fe430d', 'source/blockbench/js__io__format.ts.txt': '6e1fe2faf85aebbec01999979acec5d1c9be9aaa70898baf9d65b2d0c7435f1c'}
    assert {row['path']: row['sha256'] for row in official['files'].values()} == expected_official_files
    for row in official['files'].values():
        assert sha(local_file(row['path'])) == row['sha256'] == m['files'][row['path']]['sha256']
    fridge = read('fridge/source-manifest.json')
    assert len(fridge) == 16
    for row in fridge:
        check_record(row['path'], row)
        assert row['sha256'] == m['files'][row['path']]['sha256']
    assert read('fridge/official-api/package-provenance.json')['package_version'] == '2.11.0'
    scenes = read('scene-manifest.json')['scenes']
    assert len(scenes) == 6 and len({s['id'] for s in scenes}) == 6
    assert {s['path'] for s in scenes} == {p for p in index if p.startswith('scenes/')}
    for scene in scenes:
        assert sha(local_file(scene['path'])) == scene['sha256']
    return {'files': len(index), 'exact_inputs': len(m['files']), 'fridge_sources': len(fridge), 'scenes': len(scenes)}


if __name__ == '__main__':
    print(json.dumps(check_public_integrity(), indent=2))
