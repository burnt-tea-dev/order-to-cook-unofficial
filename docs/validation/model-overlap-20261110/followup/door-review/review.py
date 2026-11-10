#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Read-only checkout review. All evidence output is written to --output.

Uses independent matrix transforms and exhaustive face comparisons for all 82
changed geometries, not the existing rounded-plane grouping census. Does not
measure rendered alpha visibility, depth precision or temporal flicker.
"""
import argparse, ast, copy, hashlib, importlib.util, itertools, json, math, subprocess, sys
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser()
parser.add_argument('repo', type=Path)
parser.add_argument('candidate', type=Path)
parser.add_argument('--baseline', default='48ef920779cd7d76244061bad9dd31ffc2f6b57a')
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent)
args = parser.parse_args()
ROOT, OUT = args.repo.resolve(), args.output.resolve()
OUT.mkdir(parents=True, exist_ok=True)
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)
def write(name, data):
    (OUT/name).write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')
def sha(data):
    return hashlib.sha256(data).hexdigest()
BASE = git('rev-parse', args.baseline).decode().strip()
tracked = git('ls-tree', '-r', '--name-only', BASE, 'runtime/RP/models').decode().splitlines()
inputs, changed = [], []
for rel in tracked:
    old = git('show', BASE+':'+rel)
    new = (ROOT/rel).read_bytes()
    if old != new:
        changed.append(rel)
    inputs.append({'path': rel, 'baseline_sha256': sha(old), 'reviewed_sha256': sha(new), 'unchanged': old == new})
actual = {str(p.relative_to(ROOT)) for p in (ROOT/'runtime/RP/models').rglob('*') if p.is_file()}
assert actual == set(tracked), 'Model inventory changed'
assert len(changed) == 82 and all('/dishwasher_' in p for p in changed)

# JSON-space Bedrock rotations: X and Z angles negated, order X then Y then Z.
# Rigid cube rotation followed by child-to-root bone rotations, with fixed pivots.
def rotate(points, degrees, pivot):
    a, b, c = np.deg2rad(np.array(degrees, float)*[-1, 1, -1])
    sx,cx,sy,cy,sz,cz = math.sin(a),math.cos(a),math.sin(b),math.cos(b),math.sin(c),math.cos(c)
    rx = np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
    ry = np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])
    rz = np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])
    return (points-np.array(pivot))@(rz@ry@rx).T+np.array(pivot)
INDICES = {'north':[0,2,6,4], 'south':[1,5,7,3], 'east':[4,5,7,6],
           'west':[0,2,3,1], 'up':[2,3,7,6], 'down':[0,4,5,1]}
def faces(data):
    g = data['minecraft:geometry'][0]
    bones = {b['name']: b for b in g['bones']}
    result = {}
    for bone in bones.values():
        for index, cube in enumerate(bone.get('cubes', [])):
            inflate = cube.get('inflate', bone.get('inflate', 0))
            low = np.array(cube['origin'], float)-inflate
            size = np.array(cube['size'], float)+inflate*2
            points = low + np.array(list(itertools.product((0,1), repeat=3)))*size
            points = rotate(points, cube.get('rotation', [0,0,0]), cube.get('pivot', [0,0,0]))
            cur = bone
            while True:
                points = rotate(points, cur.get('rotation', [0,0,0]), cur.get('pivot', [0,0,0]))
                if 'parent' not in cur: break
                cur = bones[cur['parent']]
            assert isinstance(cube['uv'], dict), 'Review expects explicit UVs'
            for name, ids in INDICES.items():
                if name not in cube['uv'] or 0 in cube['uv'][name].get('uv_size', [1,1]): continue
                p = points[ids]; n = np.cross(p[1]-p[0], p[2]-p[0]); length = np.linalg.norm(n)
                if length < 1e-9: continue
                result[(bone['name'],index,name)] = {'p': p, 'n': n/length, 'uv': cube['uv'][name]}
    return result
def cross(a,b): return float(a[0]*b[1]-a[1]*b[0])
def area(p):
    return abs(sum(cross(p[i],p[(i+1)%len(p)]) for i in range(len(p))))/2 if len(p)>2 else 0
def clip(p, boundary):
    if sum(cross(boundary[i],boundary[(i+1)%len(boundary)]) for i in range(len(boundary))) < 0:
        boundary = boundary[::-1]
    for a,b in zip(boundary,boundary[1:]+boundary[:1]):
        if not p: return []
        out = []; previous = p[-1]; previous_d = cross(b-a, previous-a)
        for current in p:
            d = cross(b-a, current-a)
            if (d >= -1e-8) != (previous_d >= -1e-8):
                out.append(previous+(current-previous)*previous_d/(previous_d-d))
            if d >= -1e-8: out.append(current)
            previous, previous_d = current, d
        p = out
    return p
def census(fs):
    hits = {}
    for (ka,a),(kb,b) in itertools.combinations(fs.items(),2):
        if ka[:2] == kb[:2]: continue
        if abs(float(a['n']@b['n'])) < 1-1e-10: continue
        if np.max(abs((b['p']-a['p'][0])@a['n'])) > 1e-5: continue
        if np.any(np.minimum(a['p'].max(0),b['p'].max(0))+1e-8 < np.maximum(a['p'].min(0),b['p'].min(0))): continue
        u = a['p'][1]-a['p'][0]; u /= np.linalg.norm(u); v = np.cross(a['n'],u)
        def project(points): return [np.array([(x-a['p'][0])@u,(x-a['p'][0])@v]) for x in points]
        overlap = area(clip(project(a['p']),project(b['p'])))
        if overlap > 1e-6: hits[tuple(sorted((ka,kb)))] = overlap
    return hits
def serialize(hits):
    return [{'a':list(key[0]), 'b':list(key[1]), 'area':round(value,8)} for key,value in sorted(hits.items())]
def contact(fs):
    a,b = fs[('group5',0,'south')], fs[('group3',0,'north')]
    parallel = abs(float(a['n']@b['n'])) > 1-1e-10
    gap = float(np.max(abs((b['p']-a['p'][0])@a['n'])))
    return {'parallel':parallel, 'max_plane_distance':gap, 'coplanar':parallel and gap<1e-5}

states = []
for rel in changed:
    old_bytes, new_bytes = git('show', BASE+':'+rel), (ROOT/rel).read_bytes()
    old, new = json.loads(old_bytes), json.loads(new_bytes)
    def door(g): return next(b for b in g['minecraft:geometry'][0]['bones'] if b['name']=='group5')['cubes'][0]
    a,b = door(old),door(new)
    expected = copy.deepcopy(old); door(expected)['size'][2] = round(a['size'][2]*.985,6)
    assert expected == new, 'Unexpected delta '+rel
    candidate_bytes = (args.candidate/Path(rel).name).read_bytes()
    assert json.loads(candidate_bytes) == new, 'Candidate mismatch '+rel
    f0,f1 = faces(old),faces(new)
    front = ('group5',0,'north')
    assert np.array_equal(f0[front]['p'],f1[front]['p'])
    assert f0[front]['uv'] == f1[front]['uv']
    # Every vertex change is confined to the door's back four corners; its
    # new solid is a strict subset of its old solid in unchanged local frame.
    assert 0 < b['size'][2] < a['size'][2]
    h0,h1 = census(f0),census(f1)
    added = {key:value for key,value in h1.items() if key not in h0}
    removed = {key:value for key,value in h0.items() if key not in h1}
    enlarged = {key:h1[key]-h0[key] for key in h1.keys() & h0.keys() if h1[key]-h0[key] > 1e-6}
    assert not added and not enlarged, 'New or enlarged coplanar overlap '+rel
    states.append({'path':rel, 'baseline_sha256':sha(old_bytes), 'reviewed_sha256':sha(new_bytes),
                   'candidate_sha256':sha(candidate_bytes), 'candidate_json_exact':True,
                   'candidate_bytes_exact':candidate_bytes==new_bytes, 'only_door_size_z_changed':True,
                   'front_physical_vertices_exact':True, 'all_uv_pivots_rotations_exact':True,
                   'baseline_thickness':a['size'][2], 'reviewed_thickness':b['size'][2],
                   'retreat':a['size'][2]-b['size'][2], 'baseline_contact':contact(f0), 'reviewed_contact':contact(f1),
                   'baseline_coplanar_count':len(h0), 'reviewed_coplanar_count':len(h1),
                   'added':serialize(added), 'removed':serialize(removed), 'enlarged':serialize(enlarged)})
    print(Path(rel).name, len(h0), '->', len(h1), flush=True)

# Execute the real make_blocks entry point into an isolated temporary output.
spec = importlib.util.spec_from_file_location('reviewed_converter', ROOT/'tools/convert_assets.py')
conv = importlib.util.module_from_spec(spec); spec.loader.exec_module(conv)
conv.SOURCE = ROOT/'upstream/reference'; conv.ASSETS=conv.SOURCE/conv.ASSET_REL
with TemporaryDirectory(prefix='otc-door-regenerate-') as temp:
    conv.OUT=Path(temp);conv.BP=conv.OUT/'BP';conv.RP=conv.OUT/'RP'
    conv.make_blocks()
    generated = list((conv.RP/'models/blocks').glob('dishwasher_*.geo.json'))
    assert len(generated)==82
    for p in generated:
        assert json.loads(p.read_text()) == json.loads((ROOT/'runtime/RP/models/blocks'/p.name).read_text()), p.name
source = conv.normalize_geo(conv.ASSETS/'geo/block/dishwasher.geo.json','geometry.test')
guards = {}
for label, mutate in [('source_origin',lambda c: c['origin'].__setitem__(2,c['origin'][2]+.1)),
                      ('source_thickness',lambda c: c['size'].__setitem__(2,2)),
                      ('source_zero_thickness',lambda c: c['size'].__setitem__(2,0))]:
    bad=copy.deepcopy(source);mutate(door(bad))
    try: conv.separate_dishwasher_drawer_faces(bad)
    except ValueError as e: guards[label]={'rejected':True,'error':str(e)}
    else: guards[label]={'rejected':False}
for value in [0,-1,1e-8,float('nan'),float('inf')]:
    bad=copy.deepcopy(source);door(bad)['size'][2]=value
    try:
        conv.separate_dishwasher_door_back(bad)
        result=door(bad)['size'][2]
        guards['posed_'+str(value)]={'rejected':False,'output':str(result)}
    except ValueError as e: guards['posed_'+str(value)]={'rejected':True,'error':str(e)}
assert all(row['rejected'] for row in guards.values()), 'Unsafe guard input accepted'
converter_text = (ROOT/'tools/convert_assets.py').read_text()
converter_tree = ast.parse(converter_text)
door_helpers = {node.name: ast.get_source_segment(converter_text, node)
               for node in converter_tree.body if isinstance(node, ast.FunctionDef)
               and node.name in ['separate_dishwasher_door_back','separate_dishwasher_drawer_faces']}
write('door-helper-identities.json', {
    'scope': 'Door source-contract and post-pose trim helpers only. Other concurrent converter work is outside this review; whole-file SHA records this review snapshot.',
    'converter_sha256': sha(converter_text.encode()),
    'helpers': {name:{'sha256':sha(source.encode()), 'source':source} for name,source in door_helpers.items()}})
write('input-identities.json',{'baseline_commit':BASE,'geometry_files':inputs,
      'reviewed_inputs':[{'path':p,'sha256':sha((ROOT/p).read_bytes())} for p in [
          'tools/convert_assets.py','tests/test_appliance_geometry.py',
          'runtime/asset_conversion_manifest.json',
          'upstream/reference/common/src/main/resources/assets/ordertocook/geo/block/dishwasher.geo.json',
          'upstream/reference/common/src/main/resources/assets/ordertocook/animations/dishwasher.animation.json']]})
write('states.json',states)
write('guard-probes.json',guards)
summary = {'baseline_commit':BASE,'geometry_file_count':len(tracked),'changed_files':len(changed),
    'unchanged_geometry_files':len(tracked)-len(changed),'all_82_match_candidate_json':True,
    'candidate_byte_matches':sum(s['candidate_bytes_exact'] for s in states),
    'actual_make_blocks_matches_runtime_states':82,'front_physical_vertices_exact':True,
    'all_uv_pivots_rotations_exact':True,'all_other_fields_exact':True,
    'baseline_door_thickness_range':[min(s['baseline_thickness'] for s in states),max(s['baseline_thickness'] for s in states)],
    'reviewed_door_thickness_range':[min(s['reviewed_thickness'] for s in states),max(s['reviewed_thickness'] for s in states)],
    'door_retreat_range':[min(s['retreat'] for s in states),max(s['retreat'] for s in states)],
    'baseline_pair_coplanar_poses':sum(s['baseline_contact']['coplanar'] for s in states),
    'reviewed_pair_coplanar_poses':sum(s['reviewed_contact']['coplanar'] for s in states),
    'baseline_dishwasher_coplanar_pairs':sum(s['baseline_coplanar_count'] for s in states),
    'reviewed_dishwasher_coplanar_pairs':sum(s['reviewed_coplanar_count'] for s in states),
    'new_coplanar_pair_instances':sum(len(s['added']) for s in states),
    'enlarged_coplanar_pair_instances':sum(len(s['enlarged']) for s in states),
    'removed_coplanar_pair_instances':sum(len(s['removed']) for s in states),
    'source_and_posed_negative_guard_probes_rejected':len(guards),
    'limits':'Offline finite geometry verification. No game/editor/native checks, alpha-threshold acceptance, all-view or temporal flicker claim. Guard probes are synthetic inputs, not source data.'}
write('summary.json',summary)
print(json.dumps(summary,indent=2))
