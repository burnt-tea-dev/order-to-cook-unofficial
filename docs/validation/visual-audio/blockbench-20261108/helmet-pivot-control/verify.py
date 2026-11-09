"""Read-only helmet pivot diagnostic verification; standard library only."""
from pathlib import Path
import copy
import hashlib
import itertools
import json
import math

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def difference(a, b, path=''):
    if isinstance(a, dict) and isinstance(b, dict):
        assert a.keys() == b.keys(), path
        return sum((difference(a[k], b[k], f'{path}/{k}') for k in a), [])
    if isinstance(a, list) and isinstance(b, list) and path == '/elements':
        assert len(a) == len(b)
        return sum((difference(x, y, f'{path}/{i}') for i, (x, y) in enumerate(zip(a, b))), [])
    return [] if a == b else [path.lstrip('/')]


def corner(e, p):
    x, y, z = (p[k] - e['origin'][k] for k in range(3))
    rx, ry, rz = map(math.radians, e['rotation'])
    y, z = math.cos(rx)*y-math.sin(rx)*z, math.sin(rx)*y+math.cos(rx)*z
    x, z = math.cos(ry)*x+math.sin(ry)*z, -math.sin(ry)*x+math.cos(ry)*z
    x, y = math.cos(rz)*x-math.sin(rz)*y, math.sin(rz)*x+math.cos(rz)*y
    return [x+e['origin'][0], y+e['origin'][1], z+e['origin'][2]]


def jpeg_dimensions(raw):
    # Read baseline/progressive JPEG SOF dimensions without decoding or writing.
    assert raw[:2] == b'\xff\xd8'
    pos = 2
    while pos < len(raw):
        assert raw[pos] == 255
        while raw[pos] == 255:
            pos += 1
        marker = raw[pos]
        pos += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        size = int.from_bytes(raw[pos:pos+2], 'big')
        assert size >= 2
        if marker in (0xC0, 0xC1, 0xC2):
            return [int.from_bytes(raw[pos+5:pos+7], 'big'), int.from_bytes(raw[pos+3:pos+5], 'big')]
        pos += size
    raise AssertionError('No supported JPEG dimensions found')


def main():
    prep = json.loads((HERE/'preparation.json').read_bytes())
    gui = json.loads((HERE/'gui-observations.json').read_bytes())
    manifest = json.loads((HERE/'manifest.json').read_bytes())
    for relative, identity in manifest['artifacts'].items():
        raw = (HERE/relative).read_bytes()
        assert sha(raw) == identity['sha256'], relative
        assert len(raw) == identity['bytes'], relative
    assert (HERE/manifest['original_scene_dependency']).resolve() == (ROOT/prep['base_scene_path']).resolve()
    assert manifest['original_scene_sha256'] == prep['base_scene_sha256']
    a_raw = (ROOT/prep['base_scene_path']).read_bytes()
    b_raw = (HERE/'scenes/helmet-pivot-control.bbmodel').read_bytes()
    assert sha(a_raw) == prep['base_scene_sha256']
    assert sha(b_raw) == prep['control_scene_sha256']
    a, b = json.loads(a_raw), json.loads(b_raw)
    expected = ['name']+[f'elements/{i}/origin' for i in range(15)]
    assert sorted(difference(a, b)) == sorted(expected) == sorted(prep['changed_fields'])
    generated = copy.deepcopy(a)
    generated['name'] = 'Helmet inactive source pivots control; geometry unchanged'
    assert len(a['elements']) == len(b['elements']) == 40
    assert len(a['groups']) == 5
    assert all(g['rotation'] == [0, 0, 0] and g.get('scale', [1, 1, 1]) == [1, 1, 1] for g in a['groups'])
    changes = []
    for i in range(15):
        source, rp = a['elements'][i], a['elements'][i+20]
        assert source['rotation'] == rp['rotation'] == [0, 0, 0]
        assert rp['origin'] == [11, -24, 0]
        generated['elements'][i]['origin'] = [-11, -24, 0]
        changes.append({'element_index': i, 'before': source['origin'], 'after': [-11, -24, 0]})
    assert changes == prep['changes']
    assert generated == b
    assert (json.dumps(generated, ensure_ascii=False, indent=2)+'\n').encode() == b_raw
    assert a['elements'][20:] == b['elements'][20:]
    for key in ('textures', 'groups', 'outliner'):
        assert a[key] == b[key]
    count, worst = 0, 0.0
    for old, new in zip(a['elements'], b['elements']):
        assert old['faces'] == new['faces']
        for signs in itertools.product((0, 1), repeat=3):
            p = [old['to' if signs[k] else 'from'][k]+(1 if signs[k] else -1)*old.get('inflate', 0) for k in range(3)]
            worst = max(worst, *(abs(x-y) for x, y in zip(corner(old, p), corner(new, p))))
            count += 1
    assert count == prep['world_corners_checked'] == 320 and worst < 1e-12
    assert worst == prep['maximum_vertex_component_residual_model_units']
    assert len(prep['runtime_inputs']) == 6
    for relative, identity in prep['runtime_inputs'].items():
        raw = (ROOT/relative).read_bytes()
        assert sha(raw) == identity['sha256'], relative
        assert len(raw) == identity['size'], relative
        assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == identity['git_blob_sha'], relative
    assert gui['sequence'] == manifest['capture_sequence']
    for capture in gui['screenshots']:
        raw = (HERE/capture['path']).read_bytes()
        assert sha(raw) == capture['sha256'] and len(raw) == capture['bytes']
        assert raw.startswith(b'\xff\xd8') and raw.endswith(b'\xff\xd9')
        assert jpeg_dimensions(raw) == capture['dimensions'] == [1188, 848]
    print(json.dumps({'status': 'PASS', 'changed_fields': len(expected), 'changed_inactive_origins': 15,
        'cubes': 40, 'corners': count, 'maximum_component_residual': worst,
        'runtime_source_identities': 6, 'original_captures': 3,
        'control_byte_reproduction': True, 'writes': 0}, indent=2))


if __name__ == '__main__':
    main()
