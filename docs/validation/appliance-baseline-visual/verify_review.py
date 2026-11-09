#!/usr/bin/env python3
"""Read-only/offline reproduction of the fixed 0.1.46 appliance review.

No Git, network, editor or game process is invoked. Temporary inputs and scenes
are removed at completion. Shared calibration checks execute only on a copy.
"""
import sys
sys.dont_write_bytecode = True
import argparse, base64, copy, hashlib, importlib.util, itertools, json, math
import shutil, subprocess, tempfile
from pathlib import Path
from PIL import Image
import numpy as np
HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / 'fridge-shared-root-visual'
sys.path.insert(0, str(SHARED / 'lib'))
sys.path.insert(0, str(SHARED))
import source_affine as b
import scene_lib as sl
from review_inputs import object_sha, tree_sha
from tree_inputs import tree_record_bytes, unique_object
from restore_review import restore_bundle, validate_restored
PIN = '625dd3fe0e4cc944240d32678d65c91dc4f5a220'
EQUIVALENT = '11280a09d232a3dd7e7d1e6f5ae42e5a9e5c53d7'
TREES = {PIN: 'fb0bd9b7ccb507fdc28e63699593ea365ba8a141', EQUIVALENT: '2df3ee8dbad6bc42c28300af5a86ee2b6309bab2'}


def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def encoded(obj): return (json.dumps(obj, indent=2, ensure_ascii=False) + '\n').encode()


def verify_inputs(root):
    trees = json.loads(tree_record_bytes(), object_pairs_hook=unique_object)
    assert set(trees) == {PIN, EQUIVALENT}
    for pin, data in trees.items():
        assert tree_sha(data['entries']) == data['tree'] == TREES[pin]
        runtime = [dict(row, path=row['path'][8:]) for row in data['entries'] if row['path'].startswith('runtime/')]
        assert tree_sha(runtime) == data['runtime_tree']
    assert trees[PIN]['runtime_tree'] == trees[EQUIVALENT]['runtime_tree'] == '22ddad2b2e83a0f7a6e58ae63b73f2c759f332bd'
    source = {r['path']: r for r in trees[PIN]['entries']}
    rows = read(HERE / 'provenance/input-files.json')
    for row in rows:
        data = (HERE / row['path']).read_bytes()
        assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']
        assert object_sha('blob', data) == row['git_blob_sha'] == source[row['source_path']]['sha']
        dst = root / row['source_path']; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_bytes(data)
    for row in read(HERE / 'provenance/java-sources.json'):
        data = (HERE / row['path']).read_bytes()
        assert sha(HERE / row['path']) == row['sha256'] and object_sha('blob', data) == row['git_blob_sha']
    assert read(root / 'upstream/source.lock.json')['commit'] == 'e59e3dbcabe19b783d9adb933db5fcb8bc1e4642'
    for pack in ['BP', 'RP']:
        assert read(root / f'runtime/{pack}/manifest.json')['header']['version'] == [0, 1, 46]
    return len(rows)


def cases_for(sheet, m):
    if sheet['kind'] != 'renderer_count_contract':
        return [next(c for c in m['cases'] if c['label'] == label) for label in sheet['cases']]
    rows = []
    for i, count in enumerate(sheet['counts']):
        off = [(i % 2 - .5) * 112 - 24, (i // 2 - 1) * 42, 0]
        found = [c for c in m['cases'] if c.get('phase') == sheet['phase'] and c.get('frame') == (5 if sheet['phase']==2 else 0) and c.get('count') == count and c['source_offset'] == off]
        assert len(found) == 1; rows.extend(found)
    return rows


def rebuild(root, out):
    m = read(HERE / 'scenes/manifest.json')
    assert m['canonical_commit'] == PIN and len(m['sheets']) == 32 and len(m['cases']) == 142
    sl.SEQ = itertools.count(); sl.OUT = out
    asset = root / 'upstream/reference/common/src/main/resources/assets/ordertocook'
    for sheet in m['sheets']:
        original = read(HERE / 'scenes' / sheet['path'])
        scene = sl.Scene(original['name'])
        for row in cases_for(sheet, m):
            family = 'refrigerator' if row['family'].startswith('refrigerator') else 'dishwasher'
            g = read(asset / f'geo/block/{family}.geo.json')['minecraft:geometry'][0]
            clips = read(asset / f'animations/{family}.animation.json')['animations']
            if row['family'] == 'refrigerator_assembly':
                clip = {'bones': {}}; t = 0; name = 'SOURCE ' + row['label']
                for component in row['source_components']:
                    for bone, channels in clips[component['clip']]['bones'].items():
                        dest = clip['bones'].setdefault(bone, {})
                        for key, channel in channels.items():
                            assert key not in dest
                            dest[key] = b.sample(channel, component['time'], [1]*3 if key == 'scale' else [0]*3)
            else:
                clip = clips[row['clip']] if row['clip'] else {}; t = row['time']
                name = ('SOURCE ' + row['clip'] + f' {t:.3f}s') if family == 'refrigerator' else f'SOURCE phase {row["phase"]} {t:.5f}s count {row["count"]}'
            data = b.source_mesh(scene, g, clip, t, asset / f'textures/block/{family}.png', row['source_offset'], name,
                                 row.get('phase'), row.get('count', 0))
            assert data == row['source'], row['label']
            for item in row['canonical_inputs']:
                block = family if item['states'].get('ordertocook:half') != 'upper' else 'refrigerator_upper'
                p, textures, visible, _ = b.binding(root, block, item['states'])
                assert p == root / item['path'] and visible == item['visibility']
                name = 'CANONICAL ' + p.stem if family == 'refrigerator' else f'CANONICAL phase {row["phase"]} frame {row["frame"]} count {row["count"]}'
                b.canonical(scene, p, textures, visible, item['assembly_offset'], name)
        raw = encoded(scene.j)
        assert hashlib.sha256(raw).hexdigest() == sheet['original_sha256'], sheet['path']
        assert raw.count(b'"render_sides": "front"') == sheet['texture_side_substitutions'] == 2
        raw = raw.replace(b'"render_sides": "front"', b'"render_sides": "auto"')
        assert raw == (HERE / 'scenes' / sheet['path']).read_bytes(), sheet['path']
        assert hashlib.sha256(raw).hexdigest() == sheet['sha256']
        (out / sheet['path']).write_bytes(raw)
    return m


def numerical_checks(root, m):
    asset = root / 'upstream/reference/common/src/main/resources/assets/ordertocook'
    def records(g, bone, cube, clip, t, offset=(0,0,0)):
        lookup = {x['name']: x for x in g['bones']}
        verts = [b.add(b.posed(b.rotate(v, b.erotation(cube.get('rotation',[0]*3)), b.editor(cube.get('pivot',[0]*3))), bone, lookup, clip, t), offset) for v in b.cube_vertices(cube)]
        return [(verts[i], uv) for _, ids, uvs in b.face_corners(cube,[1,1]) for i, uv in zip(ids, uvs)]
    def distance(a, z):
        largest = 0
        for p, uv in a:
            candidates = [q for q, other in z if max(abs(x-y) for x,y in zip(uv,other)) < 1e-6]
            assert candidates
            largest = max(largest, min(math.dist(p,q) for q in candidates))
        return largest
    maxima = {'dishwasher': 0., 'fridge_active_door': 0.}; corners = 0
    for row in m['cases'][:126]:
        fam = row['family']; g = read(asset / f'geo/block/{fam}.geo.json')['minecraft:geometry'][0]
        clip = {} if row['clip'] is None else read(asset / f'animations/{fam}.animation.json')['animations'][row['clip']]
        item = row['canonical_inputs'][0]
        if fam == 'refrigerator': item = next(x for x in row['canonical_inputs'] if x['states']['ordertocook:half'] == row['moving_half'])
        target = read(root / item['path'])['minecraft:geometry'][0]; lookup = {x['name']: x for x in target['bones']}
        for bone in g['bones']:
            if fam == 'refrigerator' and bone['name'] != ('bone2' if row['moving_half'] == 'upper' else 'bone3'): continue
            for index,cube in enumerate(bone.get('cubes',[]),1):
                if fam == 'dishwasher' and not b.selected(row['phase'], row['count'], bone['name'], index): continue
                if max(b.sample(clip.get('bones',{}).get(bone['name'],{}).get('scale'), row['time'], [1]*3)) <= 1e-5: continue
                name = bone['name']; ci = index - 1
                if fam == 'dishwasher' and name in ['drity_dish','clear_dish']: name += f'_{index}'; ci = 0
                src = records(g, bone['name'], cube, clip, row['time'])
                dst = records(target, name, lookup[name]['cubes'][ci], {}, 0, (0,16 if fam == 'refrigerator' and row['moving_half'] == 'upper' else 0,0))
                category = 'dishwasher' if fam == 'dishwasher' else 'fridge_active_door'
                maxima[category] = max(maxima[category], distance(src,dst)); corners += len(src)
    assert corners == 18200
    assert abs(maxima['dishwasher'] - .25964161378011075) < 1e-12
    assert abs(maxima['fridge_active_door'] - .08617698358695226) < 1e-12
    # The source-affine builder is independent of this production converter;
    # this supplementary comparison checks sampled channel values only.
    spec = importlib.util.spec_from_file_location('fixed_converter', root / 'tools/convert_assets.py')
    converter = importlib.util.module_from_spec(spec); spec.loader.exec_module(converter)
    samples = 0; max_error = 0
    for family in ['refrigerator', 'dishwasher']:
        for clip in read(asset / f'animations/{family}.animation.json')['animations'].values():
            for channels in clip['bones'].values():
                for key,ch in channels.items():
                    for step in range(101):
                        t=clip['animation_length']*step/100; default=[1]*3 if key=='scale' else [0]*3
                        error=max(abs(x-y) for x,y in zip(converter.sample_channel(ch,t,default),b.sample(ch,t,default)))
                        assert error < 1e-10; max_error=max(max_error,error); samples+=1
    assert samples == 4141
    dish = fridge = 0
    for row in m['cases'][:126]:
        if row['family'] == 'dishwasher':
            for count, direction in itertools.product(range(17), ['north','east','south','west']):
                states = dict(row['canonical_inputs'][0]['states'], **{'minecraft:cardinal_direction': direction,'ordertocook:plates': count%16,'ordertocook:plates_high': count>=16})
                p, _, visible, comp = b.binding(root, 'dishwasher', states)
                assert p == root / row['canonical_inputs'][0]['path']
                assert comp['minecraft:transformation']['rotation'] == [0,{'north':0,'east':-90,'south':180,'west':90}[direction],0]
                for family in ['drity_dish','clear_dish']:
                    assert [i for i in range(1,7) if visible[f'{family}_{i}']] == ([] if not count else [2] if count==1 else [2,5] if count==2 else list(range(1,7)))
                dish += 1
        else:
            item = next(x for x in row['canonical_inputs'] if x['states']['ordertocook:half'] == row['moving_half'])
            for direction, opened in itertools.product(['north','east','south','west'], [False,True]):
                for block in (['refrigerator','refrigerator_upper'] if row['moving_half']=='upper' else ['refrigerator']):
                    states = dict(item['states'], **{'minecraft:cardinal_direction':direction,'ordertocook:open':opened})
                    p, _, _, comp = b.binding(root, block, states)
                    assert p == root / item['path']
                    assert comp['minecraft:transformation']['rotation'] == [0,{'north':0,'east':-90,'south':180,'west':90}[direction],0]
                    fridge += 1
    assert (dish,fridge) == (5576,528)
    return {'physical_uv_corners':corners,'maximum_corner_residual_model_units':maxima,'channel_samples':samples,'maximum_channel_disagreement':max_error,'state_bindings':{'dishwasher':dish,'refrigerator':fridge}}


def descendants(node):
    if isinstance(node,str): return {node}
    return {node['uuid']}.union(*(descendants(child) for child in node['children']))


def extract(whole, label, n, delta):
    names={g['uuid']:g['name'] for g in whole['groups']}
    starts=[i for i,node in enumerate(whole['outliner']) if names[node['uuid']]==label]; assert len(starts)==1
    nodes=whole['outliner'][starts[0]:starts[0]+n]; ids=set().union(*(descendants(x) for x in nodes))
    result=copy.deepcopy(whole);result['outliner']=copy.deepcopy(nodes)
    for k in ['groups','elements']:result[k]=[item for item in result[k] if item['uuid'] in ids]
    for g in result['groups']: g['origin']=[v+d for v,d in zip(g['origin'],delta)]
    for e in result['elements']:
        for k in (['from','to','origin'] if e['type']=='cube' else ['origin']):e[k]=[v+d for v,d in zip(e[k],delta)]
    return result


def photo_checks(m):
    e=read(HERE/'manifest.json'); photos=e['screenshots']
    assert len(photos)==43 and len({r['path'] for r in photos})==43
    assert sum(not r['diagnostic_not_additional_sheet'] for r in photos)==39
    assert {Path(r['scene']).name for r in photos if not r['diagnostic_not_additional_sheet']} == {s['path'] for s in m['sheets']}
    iso={'dish_5_0_0.bbmodel','fridge_lower_close_4_7.bbmodel','fridge_upper_close_4_7.bbmodel','dish_2_6_11.bbmodel','dish_counts_phase2_0_1_2_3_8_16.bbmodel','dish_counts_phase5_0_1_2_3_8_16.bbmodel','fridge_full_assembly_controls.bbmodel'}
    expected={(r['path'],'North') for r in m['sheets']} | {(name,'Isometric Right (2:1)') for name in iso}
    actual={(Path(r['scene']).name,r['camera']) for r in photos if not r['diagnostic_not_additional_sheet']}
    assert expected==actual and len(actual)==39
    for sheet in m['sheets']:
        for photo in [r for r in photos if Path(r['scene']).name==sheet['path'] and not r['diagnostic_not_additional_sheet']]:
            cases=cases_for(sheet,m);assert photo['cases']==[c['label'] for c in cases]
            assert photo['pair_count']==len(cases)
    for r in photos:
        p=HERE/r['path']; assert sha(p)==r['sha256'] and p.stat().st_size==r['bytes']
        assert sha(HERE/r['scene'])==r['scene_sha256']
        with Image.open(p) as im: assert im.format=='JPEG' and list(im.size)==r['dimensions']==[1188,848]
        assert (r['source_side'],r['canonical_side']) == (('left','right') if r['camera'] in ['Top','Bottom'] else ('right','left'))
    assert len(e['provenance_pending_excluded'])==2
    for r in e['provenance_pending_excluded']:
        assert not any(Path(p['path']).name==r['original_filename'] for p in photos)
        replacement=next(p for p in photos if Path(p['path']).name==r['replacement_filename'])
        assert replacement['sha256']!=r['sha256']
    assert [len(e[k]) for k in ['finite_refrigerator_pose_bindings','finite_dishwasher_pose_bindings','dishwasher_count_pose_bindings']]==[44,82,12]
    # Two isolated fridge controls are exact extractions of existing .46 sheets.
    whole=read(HERE/'scenes/fridge_full_assembly_controls.bbmodel')
    for name,delta in [('lower_closing_upper_open',[56.,-24.,-0.]),('upper_closing_lower_open',[-56.,-24.,-0.])]:
        data=extract(whole,'SOURCE '+name,3,delta)
        assert encoded(data)==(SHARED/'baseline-scenes'/f'{name}.bbmodel').read_bytes()
    return {'full_sheets':32,'pose_pairs_on_sheets':142,'baseline_original_jpegs':43,'full_sheet_views':39,'isolated_fridge_views':4,'excluded_unconfirmed_photographs':2}


def order_differences(a,z,path='$'):
    assert type(a) is type(z)
    out=[]
    if isinstance(a,dict):
        assert set(a)==set(z)
        if list(a)!=list(z):out.append(path)
        for k in a:out.extend(order_differences(a[k],z[k],path+'.'+k))
    elif isinstance(a,list):
        assert len(a)==len(z)
        for i,(x,y) in enumerate(zip(a,z)):out.extend(order_differences(x,y,f'{path}[{i}]'))
    else:assert a==z,path
    return out


def metric(a,z):
    d=np.abs(a.astype(np.int16)-z.astype(np.int16))
    return {'pixel_count':int(d.shape[0]*d.shape[1]),'changed_rgb_pixels':int(np.any(d!=0,axis=2).sum()),'mean_absolute_channel_difference_0_to_255':float(d.mean()),'maximum_channel_difference':int(d.max()),'p95_absolute_channel_difference':float(np.percentile(d,95))}


def face_order_checks(root):
    d=HERE/'face-order';m=read(d/'manifest.json')
    a=read(d/m['fixtures'][0]['path']);z=read(d/m['fixtures'][1]['path'])
    for row in m['fixtures']:assert sha(d/row['path'])==row['sha256'] and (d/row['path']).stat().st_size==row['bytes']
    reconstructed=extract(read(HERE/'scenes/dish_1_12_15.bbmodel'),'SOURCE phase 1 0.66670s count 3',2,[-56,-21,0])
    assert encoded(reconstructed)==(d/m['fixtures'][0]['path']).read_bytes()
    assert order_differences(a,z)==['$.elements[3].faces']
    assert list(a['elements'][3]['faces'])==m['controlled_variable']['baseline_face_order']
    assert list(z['elements'][3]['faces'])==m['controlled_variable']['control_face_order']
    restored=copy.deepcopy(z);restored['elements'][3]['faces']={k:restored['elements'][3]['faces'][k] for k in a['elements'][3]['faces']}
    assert encoded(restored)==encoded(a)
    # Identity endpoint: physical vertices, visible faces and UVs match exactly.
    mesh=[e for e in a['elements'] if e['type']=='mesh']; cubes=[e for e in a['elements'] if e['type']=='cube']; faces=corners=0
    for src,dst in zip(mesh,cubes):
        vs=b.cube_vertices({'origin':[-dst['to'][0],dst['from'][1],dst['from'][2]],'size':[t-f for f,t in zip(dst['from'],dst['to'])],'uv':{}})
        canonical_records=[]
        for side,face in dst['faces'].items():
            if face.get('texture') is None: continue
            u0,v0,u1,v1=face['uv']; uv=[[u1,v0],[u0,v0],[u0,v1],[u1,v1]]
            if side in ['up','down']: uv=uv[2:]+uv[:2]
            canonical_records.extend((vs[index],value) for index,value in zip(b.INDICES[side],uv))
        for side,f in src['faces'].items():
            for vertex in f['vertices']:
                point=[v+o+(48 if j==0 else 0) for j,(v,o) in enumerate(zip(src['vertices'][vertex],src['origin']))]
                assert any(max(abs(x-y) for x,y in zip(point,p))<1e-12 and f['uv'][vertex]==v for p,v in canonical_records),(src['name'],side,vertex)
                corners+=1
            faces+=1
    assert (len(mesh),len(cubes),faces,corners)==(6,6,35,140)
    for tex in a['textures']:
        assert base64.b64decode(tex['source'].split(',',1)[1])==(root/'runtime/RP/textures/ordertocook/block/dishwasher.png').read_bytes()
    arrays=[]
    for row in m['screenshots']:
        p=d/row['path'];assert sha(p)==row['sha256'] and p.stat().st_size==row['bytes']
        with Image.open(p) as im:
            assert im.format=='JPEG' and im.size==(1188,848);arrays.append(np.array(im.convert('RGB')))
    pa=m['pixel_analysis'];rois=pa['rois']
    def roi(im,key):x0,y0,x1,y1=rois[key];return im[y0:y1,x0:x1]
    for k in rois:assert metric(roi(arrays[0],k),roi(arrays[1],k))==pa['same_position_baseline_to_control'][k]
    for label,im in zip(['baseline','control'],arrays):assert metric(roi(im,'canonical_window'),roi(im,'source_window'))==pa['same_scale_canonical_to_source_window'][label]
    for row in pa['sampled_center_rows']:
        for label,im in zip(['baseline','control'],arrays):
            for side in ['canonical','source']:assert im[row['y'],row[side+'_x']].tolist()==row[label+'_'+side+'_rgb']
    y0,y1=pa['viewport_strip_y_half_open'];ys,xs=np.where(np.any(arrays[0][y0:y1]!=arrays[1][y0:y1],axis=2))
    assert len(xs)==pa['viewport_changed_pixel_count']
    assert [int(xs.min()),int(ys.min()+y0),int(xs.max()+1),int(ys.max()+y0+1)]==pa['viewport_changed_bbox_half_open']
    with Image.open(root/'runtime/RP/textures/ordertocook/block/dishwasher.png') as im:
        assert im.size==(64,64);values,counts=np.unique(np.array(im.convert('RGBA'))[:,:,3],return_counts=True)
        assert dict(zip(values.tolist(),counts.tolist()))=={0:1326,100:16,161:8,255:2746}
    material=read(HERE/'material-checks.json')
    block=read(root/'runtime/BP/blocks/dishwasher.json')
    assert block['format_version']==material['block_format']
    block=block['minecraft:block'];assert block['components']['minecraft:material_instances']==material['material_instances']
    poses=[p for p in block['permutations'] if 'minecraft:geometry' in p['components']]
    assert len(poses)==material['pose_permutations']==82
    assert sum('minecraft:material_instances' in p['components'] for p in block['permutations'])==material['material_overrides']==0
    geometry=[block['components'].get('minecraft:geometry')]+[p['components'].get('minecraft:geometry') for p in block['permutations']]
    assert sum(isinstance(g,dict) and 'culling' in g for g in geometry)==material['geometry_culling_declarations']==0
    png=root/'runtime/RP/textures/ordertocook/block/dishwasher.png'
    asset=root/'upstream/reference/common/src/main/resources/assets/ordertocook'
    assert png.read_bytes()==(asset/'textures/block/dishwasher.png').read_bytes()
    with Image.open(png) as im:
        rgba=np.array(im.convert('RGBA'));assert list(im.size)==material['texture_size']
    values,counts=np.unique(rgba[:,:,3],return_counts=True)
    assert dict(zip(map(str,values.tolist()),counts.tolist()))==material['alpha_histogram']
    yy,xx=np.where((rgba[:,:,3]>0)&(rgba[:,:,3]<255))
    partial=[{'x':int(x),'y':int(y),'rgba':rgba[y,x].tolist()} for y,x in zip(yy,xx)]
    assert partial==material['partial_alpha_texels']
    source=read(asset/'geo/block/dishwasher.geo.json')['minecraft:geometry'][0]
    for face in material['source_uv_center_overlap_not_visibility_proof']:
        cube=next(bone for bone in source['bones'] if bone['name']==face['bone'])['cubes'][face['cube_zero_based']]
        uv=cube['uv'][face['face']];assert uv==face['uv']
        u,v=uv['uv'];w,h=uv['uv_size'];x0,x1=sorted([u,u+w]);y0,y1=sorted([v,v+h])
        assert [i for i,p in enumerate(partial) if x0<=p['x']+.5<=x1 and y0<=p['y']+.5<=y1]==face['partial_texel_indices']
    assert read(root/'runtime/RP/textures/terrain_texture.json')['texture_data']['ordertocook_block_dishwasher']==material['texture_atlas_entry']
    java=read(HERE/'provenance/java-sources.json')
    for name in ['DishwasherRenderer.java','DishwasherGeoModel.java']:
        text=(HERE/next(r['path'] for r in java if Path(r['path']).name==name)).read_text();assert 'getRenderType' not in text
    assert 'return RenderType.entityCutoutNoCull(texture);' in (SHARED/'calibration/gecko-render-source/GeoModel.java').read_text()
    return {'original_jpegs':2,'identity_cubes':6,'identity_faces':35,'identity_uv_corners':140,'canonical_roi_unchanged_pixels':41209,'changed_viewport_pixels':4430,'native_material_acceptance':False}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--rebuild-only',type=Path);ap.add_argument('--skip-calibration',action='store_true');ap.add_argument('--restored',action='store_true',help=argparse.SUPPRESS);args=ap.parse_args()
    if not args.restored:
        with tempfile.TemporaryDirectory(prefix='appliance-restored-') as temporary:
            restored = restore_bundle(Path(temporary)/'review')
            subprocess.run([sys.executable, '-B', str(restored/'verify_review.py'), '--restored', *sys.argv[1:]], check=True)
        return
    validate_restored(HERE)
    if args.rebuild_only:
        args.rebuild_only.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)/'inputs';verify_inputs(root);rebuild(root,args.rebuild_only)
        return
    hashes=read(HERE/'files.sha256.json')
    for rel,digest in hashes.items():assert sha(HERE/rel)==digest,rel
    for rel,digest in read(HERE/'provenance/shared-files.json').items():assert sha(HERE/rel)==digest,rel
    shared_hashes=read(SHARED/'files.sha256.json')
    for rel,digest in shared_hashes.items():assert sha(SHARED/rel)==digest,rel
    for script in ['test_tree_chunks.py', 'test_restore_review.py']:
        subprocess.run([sys.executable, '-B', str(HERE/script)], check=True, capture_output=True, text=True)
    with tempfile.TemporaryDirectory(prefix='appliance-review-') as tmp:
        tmp=Path(tmp);root=tmp/'inputs';count=verify_inputs(root)
        out=tmp/'rebuilt';out.mkdir();m=rebuild(root,out)
        second=tmp/'fresh'
        subprocess.run([sys.executable,'-B',str(Path(__file__)), '--restored', '--rebuild-only',str(second)],check=True,capture_output=True,text=True)
        assert {p.name:sha(p) for p in out.iterdir()}=={p.name:sha(p) for p in second.iterdir()}
        numerical=numerical_checks(root,m);photos=photo_checks(m);face=face_order_checks(root)
        if not args.skip_calibration:
            shared_copy=tmp/'fridge-shared-root-visual';shutil.copytree(SHARED,shared_copy)
            subprocess.run([sys.executable,'-B',str(shared_copy/'verify_calibration.py')],check=True,capture_output=True,text=True)
    for rel,digest in hashes.items():assert sha(HERE/rel)==digest,('Verifier changed artifact',rel)
    for rel,digest in shared_hashes.items():assert sha(SHARED/rel)==digest,('Shared artifact changed',rel)
    for p in HERE.rglob('*'):
        if p.is_file() and p.suffix not in ['.jpg','.png']:
            text=p.read_text(errors='ignore')
            assert not any(token in text for token in ['/work'+'space/','/home/'+'agent/']),p.name
    result={'status':'APPLIANCE_BASELINE_REPRODUCED_NOT_NATIVE_ACCEPTANCE','source_input_references':count,**photos,'numerical':numerical,'face_order_control':face,'fresh_process_scene_bytes_identical':True,'shared_calibration_reproduced':not args.skip_calibration,'git_required':False,'network_required':False,'gui_operated':False,'runtime_modified':False}
    if not args.skip_calibration: assert result==read(HERE/'verification.json'),'Recorded verification result drift'
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
