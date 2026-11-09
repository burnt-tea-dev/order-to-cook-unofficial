#!/usr/bin/env python3
"""Exact-pin shared-root review fixtures, not a production asset generator."""
import sys
sys.dont_write_bytecode = True
import argparse, base64, copy, hashlib, itertools, json, math, subprocess, tempfile, uuid
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE/'lib'))
import source_affine as a
import scene_lib as sl

PIN = 'e544f563062bf92e58afaa057a9ee52fd7ccbdc8'
TREE = 'bb9f843cdb79a9ea9488acf8db67748cb2e69c21'
UPSTREAM = 'e59e3dbcabe19b783d9adb933db5fcb8bc1e4642'
ROOT = HERE/'inputs/e544'
ASSET = 'upstream/reference/common/src/main/resources/assets/ordertocook'
PNG_SHA = 'a545ea6a2c2ef3c25d48fd65051bf00e01382b01a97ef4f295b6d3b171e02039'
FACING = {'north':0, 'west':90, 'south':180, 'east':-90}


def door(closing, frame, opened=None):
    return {'closing':closing, 'frame':frame,
            'open':not closing if opened is None else opened,
            'position':(10-frame if closing else frame)*2}


CASES = [
    {'name':'lower_closing_upper_open', 'lower':door(True,5), 'upper':door(False,10), 'facing':'north',
     'purpose':'Same formerly discrepant lower-close peak / upper-open control; both halves share root 2.'},
    {'name':'upper_closing_lower_open', 'lower':door(False,10), 'upper':door(True,5), 'facing':'north',
     'purpose':'Same formerly discrepant upper-close peak / lower-open control; both halves share root 2.'},
]
SUPPLEMENTAL = [
    {'name':'lower_peak_upper_open_frame3','lower':door(True,5),'upper':door(False,3),'facing':'north',
     'purpose':'Shared peak with upper door partway through opening; frame 3 is a sampled pose, not exactly half of its angular sweep.'},
    {'name':'upper_peak_lower_open_frame3','lower':door(False,3),'upper':door(True,5),'facing':'north',
     'purpose':'Shared peak with lower door partway through opening; inspect fitted-door residual, not an exact affine-parity claim.'},
    {'name':'lower_neutral_active_overrides_upper_peak','lower':door(True,1),'upper':door(True,5),'facing':'north',
     'purpose':'Active lower close 0.1 s writes neutral root and overrides upper close 0.5 s peak.'},
    {'name':'lower_recovering_overrides_upper_peak','lower':door(True,6),'upper':door(True,5),'facing':'north',
     'purpose':'Both close at staggered times: lower 0.6 s overrides upper 0.5 s, selecting root 3.'},
    {'name':'lower_peak_overrides_upper_recovering','lower':door(True,5),'upper':door(True,6),'facing':'north',
     'purpose':'Opposite stagger: lower 0.5 s overrides upper 0.6 s, selecting root 2.'},
]


def git(root, *args):
    return subprocess.check_output(['git','-C',str(root),*args], text=True).strip()


def verify_pin(root):
    if root == ROOT:
        from review_inputs import verify_snapshot
        verify_snapshot(root)
    else:
        assert git(root,'rev-parse','HEAD') == PIN
        assert git(root,'rev-parse','HEAD^{tree}') == TREE
        assert git(root,'status','--porcelain','--untracked-files=no') == '', 'Tracked checkout must be clean'
    assert a.read(root/'upstream/source.lock.json')['commit'] == UPSTREAM
    for row in a.read(HERE/'source-evidence/provenance.json'):
        data=(HERE/row['local_path']).read_bytes()
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['git_blob_sha']
        assert a.sha(HERE/row['local_path']) == row['sha256']
    java=(HERE/'source-evidence/RefrigeratorBlockEntity.java').read_text()
    assert java.index('"upper_door"') < java.index('"lower_door"')
    manager=(HERE/'source-evidence/AnimatableManager.java').read_text()
    assert 'new ObjectArrayList<>(4)' in manager and 'this.controllers.addAll(Arrays.asList(controllers))' in manager
    assert 'new Object2ObjectArrayMap<>(this.controllers.size())' in manager
    assert 'this.controllers.forEach(controller -> map.put(controller.getName(), controller))' in manager
    processor=(HERE/'source-evidence/AnimationProcessor.java').read_text()
    assert 'animatableManager.getAnimationControllers().values()' in processor
    assert 'bone.setPosZ((float)EasingType.lerpWithOverride(posZPoint, easingType))' in processor
    assert 'bone.setScaleZ((float)EasingType.lerpWithOverride(scaleZPoint, easingType))' in processor


def source_pose(clips, lower, upper):
    """Sample each controller independently, then upper/lower ordered writes.

    Open tracks do not write root. A closing lower track writes neutral root
    values too; do not maximize, add or multiply overlapping controller values.
    This models explicit active samples, not STOP/reset/reopen transitions.
    """
    result={'bones':{}}; controllers=[]
    for half,motion in [('upper',upper),('lower',lower)]:
        if motion is None:
            continue
        name=('up_' if half=='upper' else 'down_')+('close' if motion['closing'] else 'open')
        time=motion['frame']/10
        sampled={}
        for bone,channels in clips[name]['bones'].items():
            for channel,data in channels.items():
                value=a.sample(data,time,[1]*3 if channel=='scale' else [0]*3)
                sampled.setdefault(bone,{})[channel]=value
                result['bones'].setdefault(bone,{})[channel]=value
        controllers.append({'half':half,'clip':name,'time_seconds':time,'sampled_channels':sampled})
    return result,controllers


def source_roots(clips):
    samples=[]
    for frame in [0,4,5,6]:
        sample={k:a.sample(v,frame/10,[1]*3 if k=='scale' else [0]*3)
                for k,v in clips['down_close']['bones']['bone'].items()}
        assert sample=={k:a.sample(v,frame/10,[1]*3 if k=='scale' else [0]*3)
                       for k,v in clips['up_close']['bones']['bone'].items()}
        samples.append(sample)
    return samples


def root_index(clip, roots):
    channels=clip['bones'].get('bone',{})
    normalized={k:channels.get(k,d) for k,d in [('scale',[1]*3),('position',[0]*3)]}
    indices=[i for i,r in enumerate(roots) if all(max(abs(x-y)for x,y in zip(normalized[k],r[k]))<1e-12 for k in normalized)]
    assert len(indices)==1
    return indices[0]


def runtime_roots(root, cases):
    script='''import {fridgeRootFrame} from %s;
const cases=%s; console.log(JSON.stringify(cases.map(c=>fridgeRootFrame(c.upper,c.lower))));'''
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',script %
        (json.dumps((root/'runtime/BP/scripts/appliance_motion.js').as_uri()),json.dumps(cases))],text=True))


def affine_vertices(g,clip):
    bones={b['name']:b for b in g['bones']}; result=[]
    for bone in g['bones']:
        for index,cube in enumerate(bone.get('cubes',[]),1):
            points=[a.posed(a.rotate(v,a.erotation(cube.get('rotation',[0]*3)),a.editor(cube.get('pivot',[0]*3))),bone['name'],bones,clip,0)
                    for v in a.cube_vertices(cube)]
            result.append({'bone':bone['name'],'cube':index,'points':points})
    return result


def build(root, out, batch='priority'):
    verify_pin(root); out.mkdir(parents=True,exist_ok=True);sl.OUT=out
    asset=root/ASSET;g=a.read(asset/'geo/block/refrigerator.geo.json')['minecraft:geometry'][0]
    clips=a.read(asset/'animations/refrigerator.animation.json')['animations']
    cases=CASES if batch=='priority' else SUPPLEMENTAL
    roots=source_roots(clips);resolved=runtime_roots(root,cases)
    inputs={}; outputs=[]
    def track(path):
        inputs[str(path.relative_to(root))]=a.sha(path)
    for rel in ['geo/block/refrigerator.geo.json','animations/refrigerator.animation.json','textures/block/refrigerator.png']:
        track(asset/rel)
    for rel in ['runtime/BP/blocks/refrigerator.json','runtime/BP/blocks/refrigerator_upper.json',
                'runtime/BP/scripts/appliance_motion.js','runtime/BP/scripts/appliance_pose_data.js','runtime/BP/scripts/appliances.js',
                'runtime/RP/textures/terrain_texture.json','runtime/RP/textures/ordertocook/block/refrigerator.png']:
        track(root/rel)
    png=asset/'textures/block/refrigerator.png'
    assert a.sha(png)==PNG_SHA and png.read_bytes()==(root/'runtime/RP/textures/ordertocook/block/refrigerator.png').read_bytes()
    assert Image.open(png).size==(96,96)
    assert [g['description']['texture_width'],g['description']['texture_height']]==[96,96]
    for case,runtime_root in zip(cases,resolved):
        sequence=itertools.count()
        sl.uid=lambda:str(uuid.uuid5(uuid.NAMESPACE_URL,f'otc-fridge-shared-root:{PIN}:{case["name"]}:{next(sequence)}'))
        clip,controllers=source_pose(clips,case['lower'],case['upper'])
        root_id=root_index(clip,roots);assert root_id==runtime_root
        name=case['name'];scene=sl.Scene(f'{name} | e544 shared root {root_id} | SOURCE -X / CANONICAL +X | PREPARED')
        source_off=[-24,0,0];canonical_off=[24,0,0]
        sample=a.source_mesh(scene,g,clip,0,png,source_off,'SOURCE '+name)
        source_elements=copy.deepcopy(scene.j['elements'])
        expected=affine_vertices(g,clip)
        assert len(source_elements)==len(expected)==10
        for element,item in zip(source_elements,expected):
            for i,point in enumerate(item['points']):
                restored=[element['vertices'][f'v{i}'][j]-source_off[j] for j in range(3)]
                assert max(abs(x-y)for x,y in zip(restored,point))<1e-12
        canonical=[]
        for half in ['lower','upper']:
            motion=case[half]
            state={'minecraft:cardinal_direction':case['facing'],'ordertocook:half':half,'ordertocook:open':motion['open'],
                   'ordertocook:closing':motion['closing'],'ordertocook:frame':motion['frame'],'ordertocook:root_frame':root_id}
            path,textures,visibility,components=a.binding(root,'refrigerator_upper' if half=='upper' else 'refrigerator',state)
            track(path)
            assert components['minecraft:transformation']=={'rotation':[0,FACING[case['facing']],0]}
            offset=a.add(canonical_off,[0,16 if half=='upper' else 0,0])
            before=len(scene.j['elements']);groups_before=len(scene.j['groups'])
            a.canonical(scene,path,textures,visibility,offset,'CANONICAL '+half+' '+path.stem)
            # Independently decode at origin and undo the review assembly offset.
            zero=sl.Scene('inverse-placement-check');a.canonical(zero,path,textures,visibility,[0,0,0],'zero')
            actual=scene.j['elements'][before:]
            assert len(actual)==len(zero.j['elements'])
            for placed,local in zip(actual,zero.j['elements']):
                for key in ['from','to','origin']:
                    assert max(abs(placed[key][i]-offset[i]-local[key][i])for i in range(3))<1e-12
                assert placed['rotation']==local['rotation']
                for side,face in placed['faces'].items():
                    local_face=copy.deepcopy(local['faces'][side])
                    if face['texture'] is not None:
                        assert scene.j['textures'][face['texture']]['source']==zero.j['textures'][local_face['texture']]['source']
                        local_face['texture']=face['texture']
                    assert face==local_face
            for placed,local in zip(scene.j['groups'][groups_before:],zero.j['groups']):
                assert max(abs(placed['origin'][i]-offset[i]-local['origin'][i])for i in range(3))<1e-12
                assert placed['rotation']==local['rotation']
            canonical.append({'half':half,'path':str(path.relative_to(root)),'sha256':a.sha(path),'states':state,
                              'assembly_offset':offset,'resolved_transformation':components['minecraft:transformation'],
                              'inverse_assembly_placement_verified':True})
        # Keep the calibrated automatic texture-side policy. No face flipping,
        # abs-size substitution, polygon fitting or texture edits are performed.
        for texture in scene.j['textures']:
            texture['render_sides']='auto'
            assert base64.b64decode(texture['source'].split(',',1)[1])==png.read_bytes()
            assert [texture[k]for k in ['width','height','uv_width','uv_height']]==[96]*4
        assert case['facing']=='north', 'Non-North placement added only after explicit yaw validation'
        file=out/(name+'.bbmodel');a.write(file,scene.j)
        outputs.append({'path':file.name,'sha256':a.sha(file),'status':'CAPTURE_PLANNED_NOT_GUI_ACCEPTED',
                        'case':case,'root_frame':root_id,'source_controller_order':controllers,'source_pose':sample,
                        'canonical_inputs':canonical,'source_offset':source_off,'canonical_offset':canonical_off,
                        'independent_affine_vertices':expected,'reverse_source_translation_verified':True,
                        'textures_auto_original_png_ratio_1':True})
    manifest={'status':'PREPARED_SHARED_ROOT_CANDIDATE_NOT_GUI_ACCEPTED','canonical_commit':PIN,'canonical_tree':TREE,
              'source_commit':UPSTREAM,'roots_independently_sampled':roots,'inputs':inputs,'files':outputs,
              'source_helper':'Independent source hierarchy/easing helper; no production converter import.',
              'runtime_selector':'Actual exact-pin fridgeRootFrame called with each explicit motion; compared to source ordered writes.',
              'limits':['Static active samples only; Java STOP/reset/reopen and running timing not simulated.',
                        'Source affine mesh versus bounded fitted canonical cuboids retains documented residuals.',
                        'No Minecraft, BDS, native material or gameplay acceptance.'],
              'gui_run':False,'runtime_modified':False}
    a.write(out/'manifest.json',manifest)
    a.write(out/'gui_queue.json',{'status':'CAPTURE_PLANNED_NOT_GUI_ACCEPTED','views':[
        {'scene':r['path'],'sha256':r['sha256'],'camera':camera,'source_side':'left' if camera in ['Top','Bottom'] else 'right','status':'NOT_RUN'}
        for r in outputs for camera in (['Isometric Right (2:1)','Top' if r['case']['name']=='lower_closing_upper_open' else 'Bottom']
            if batch=='priority' else ['Isometric Right (2:1)'])]})
    verify_pin(root)
    return {f.name:a.sha(f)for f in out.iterdir()if f.is_file()}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT)
    parser.add_argument('--out',type=Path);parser.add_argument('--batch',choices=['priority','supplemental'],default='priority');parser.add_argument('--build-only',action='store_true')
    args=parser.parse_args();out=(args.out or HERE/('scenes' if args.batch=='priority' else 'supplemental-scenes')).resolve()
    actual=build(args.root.resolve(),out,args.batch)
    if not args.build_only:
        with tempfile.TemporaryDirectory(prefix='otc-shared-root-review-') as tmp:
            subprocess.run([sys.executable,'-B',str(Path(__file__).resolve()),'--root',str(args.root.resolve()),'--out',tmp,'--batch',args.batch,'--build-only'],check=True,stdout=subprocess.DEVNULL)
            assert actual=={f.name:a.sha(f)for f in Path(tmp).iterdir()if f.is_file()}
    print(json.dumps({'status':'PREPARED_ONLY','pin':PIN,'outputs':actual,'fresh_process_reproduction':not args.build_only},indent=2))


if __name__=='__main__':main()
