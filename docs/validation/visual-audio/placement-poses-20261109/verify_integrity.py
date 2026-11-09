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


def check_gui_evidence(index, scenes):
    """Check capture identity and associations, not the truth of pixel observations."""
    from PIL import Image

    gui = read('gui-evidence.json')
    assert gui['schema'] == 1 and gui['status'] == 'COMPLETED: six bounded static GUI comparisons'
    assert gui['gui_run'] is True and gui['native_run'] is False and gui['runtime_changed'] is False
    assert (gui['scene_count'], gui['primary_image_count'], gui['control_image_count']) == (6, 8, 17)
    assert gui['editor']['application'] == 'Blockbench' and gui['editor']['version'] == '5.2.2'
    assert gui['source_record_hashes'] == {
        'capture_allowlist_sha256': 'd383ca404e4e0264bf9d6d1b1a00113ad549520f67fdac2783970447683551db',
        'capture_report_sha256': 'c32b1dcaa3b78d5c38ec39773d15af1a91937b0eef024108b6ec742651a336eb',
        'capture_index_sha256': '614b505fb846e1fe06ad3172547049a96115cb80e0fda3dd7026a24a2af63ffc',
        'frozen_preparation_artifact_index_sha256': '596a5ab9e8bfc1b60bfe6e614b6463edb3663075d1b734bfcc01173b38dd1004',
    }
    expected_cameras = {
        'printer': ([0, 24, -80], [0, 8, 0], 'printer_camera_definition.jpg'),
        'bag_oblique': ([-30, 25, -80], [0, 8, 0], 'bag_camera_definition.jpg'),
        'plate_front': ([0, 4, -80], [0, 4, 0], 'plate_camera_definition.jpg'),
    }
    assert set(gui['cameras']) == set(expected_cameras)
    controls = {gui['editor']['version_evidence'], gui['screen_mapping']['evidence']}
    assert gui['editor']['version_evidence'] == 'screenshots/controls/editor_version.jpg'
    assert gui['screen_mapping']['evidence'] == 'screenshots/controls/source_screen_mapping.jpg'
    assert (gui['screen_mapping']['left'], gui['screen_mapping']['right']) == ('RP', 'SOURCE')
    for key, (position, focal_point, filename) in expected_cameras.items():
        camera = gui['cameras'][key]
        assert camera['projection'] == 'Orthographic'
        assert camera['position'] == position and camera['focal_point'] == focal_point
        assert camera['definition_evidence'] == 'screenshots/controls/' + filename
        controls.add(camera['definition_evidence'])
    images = gui['images']
    assert len(images) == 25
    assert set(images) == {p for p in index if p.startswith('screenshots/')}
    for path, capture in images.items():
        image_path = local_file(path)
        original = capture['original_relative_path']
        mapped = 'screenshots/controls/' + original.removeprefix('evidence/') if original.startswith('evidence/') else 'screenshots/' + original
        assert path == mapped
        assert capture['role'] == ('control' if original.startswith('evidence/') else 'primary')
        assert capture['sha256'] == index[path] == sha(image_path)
        assert capture['bytes'] == image_path.stat().st_size
        assert capture['original_bytes_unchanged'] is True
        assert capture['format'] == 'JPEG' and capture['dimensions'] == [1188, 848]
        with Image.open(image_path) as image:
            assert image.format == 'JPEG' and list(image.size) == capture['dimensions']
            image.load()
    by_id = {scene['id']: scene for scene in scenes}
    assert len(gui['scenes']) == 6 and {s['id'] for s in gui['scenes']} == set(by_id)
    primary = set()
    for observation in gui['scenes']:
        sid = observation['id']; scene = by_id[sid]
        assert observation['scene_path'] == scene['path'] and observation['scene_sha256'] == scene['sha256']
        assert observation['time'] == scene['time'] and observation['editor_version'] == '5.2.2'
        assert observation['status'] == 'completed bounded static GUI comparison'
        frozen = read(scene['path'])
        assert observation['serialized_project_name'] == frozen['name']
        assert observation['gui_project_title'] == sid + ' - Blockbench'
        assert observation['gui_tab'] == sid + '.bbmodel'
        assert observation['hierarchy_group_names_from_frozen_file'] == [g['name'] for g in frozen['groups']]
        groups = {g['uuid']: g for g in frozen['groups']}
        assert observation['gui_root_groups_visible'] == [groups[g['uuid']]['name'] for g in frozen['outliner']]
        assert all(g['visibility'] for g in frozen['groups']) and all(e['visibility'] for e in frozen['elements'])
        assert observation['selection_at_main_capture'] == 'none; no outline/gizmo; GUI count 0/' + str(len(frozen['elements']))
        texture = observation['texture_control']
        assert texture['source'] == texture['runtime'] == 'Inside and Outside'
        assert texture['serialized_equivalent'] == 'double' and texture['render_mode'] == 'Default'
        for i, label in enumerate(('source', 'runtime')):
            file = 'screenshots/controls/' + sid[:2] + '_' + label + '_texture.jpg'
            assert texture[label + '_evidence'] == file
            assert texture[label + '_uv_size'] == [frozen['textures'][i]['uv_width'], frozen['textures'][i]['uv_height']]
            assert frozen['textures'][i]['render_sides'] == 'double'
            controls.add(file)
        expected_views = [(sid + '_front.jpg', 'plate_front'), (sid + '_oblique.jpg', 'bag_oblique')] if scene['family'] == 'plate' else [(sid + '_paired.jpg', 'printer' if scene['family'] == 'printer' else 'bag_oblique')]
        assert len(observation['views']) == len(expected_views)
        for view, (filename, camera_key) in zip(observation['views'], expected_views):
            assert view['image'] == 'screenshots/' + filename and view['camera_key'] == camera_key
            assert view['screen_mapping'] == {'left': 'RP', 'right': 'SOURCE'}
            assert view['whole_assemblies_in_frame'] is True and view['unselected'] is True
            primary.add(view['image'])
    assert len(primary) == 8 and len(controls) == 17 and primary.isdisjoint(controls)
    assert primary == {p for p, row in images.items() if row['role'] == 'primary'}
    assert controls == {p for p, row in images.items() if row['role'] == 'control'}
    return {'gui_scenes': 6, 'primary_gui_images': len(primary), 'gui_control_images': len(controls)}


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
    assert set(provenance['projection']) == {'input_manifest', 'scene_manifest', 'blockbench_provenance', 'omissions', 'scripts', 'fridge', 'gui_evidence'}
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
    gui = check_gui_evidence(index, scenes)
    return {'files': len(index), 'exact_inputs': len(m['files']), 'fridge_sources': len(fridge), 'scenes': len(scenes), **gui}


if __name__ == '__main__':
    print(json.dumps(check_public_integrity(), indent=2))
