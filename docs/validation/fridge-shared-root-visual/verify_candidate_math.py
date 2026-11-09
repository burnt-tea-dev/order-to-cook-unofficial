#!/usr/bin/env python3
"""Independent source-to-shipped geometry checks; never import the converter."""
import sys
sys.dont_write_bytecode=True
import ast,copy,itertools,json,math,re,subprocess,tempfile
from pathlib import Path
import build_candidates as build
a=build.a
HERE=Path(__file__).resolve().parent


def records(g,bone,cube,clip,offset=(0,0,0)):
    bones={b['name']:b for b in g['bones']}
    vertices=[a.add(a.posed(a.rotate(v,a.erotation(cube.get('rotation',[0]*3)),a.editor(cube.get('pivot',[0]*3))),bone,bones,clip,0),offset)
              for v in a.cube_vertices(cube)]
    return [(vertices[i],uv) for _,indices,uvs in a.face_corners(cube,[1,1]) for i,uv in zip(indices,uvs)]


def cut_source_body(cube,half):
    """Clip the original body at world Y16, with linear physical UV clipping.

    This is a review oracle, not the production splitter. Signed Z is retained.
    Newly exposed internal caps are omitted, matching the cabinet union.
    Door cubes deliberately remain whole and are assigned by door bone.
    """
    assert not cube.get('rotation') and cube['size'][1]>0
    lo=cube['origin'][1];hi=lo+cube['size'][1]
    lower=max(lo,0 if half=='lower' else 16)
    upper=min(hi,16 if half=='lower' else 32)
    if upper<=lower:return None
    out=copy.deepcopy(cube);out['origin'][1]=lower;out['size'][1]=upper-lower
    for side,face in list(out['uv'].items()):
        if side=='up' and upper!=hi or side=='down' and lower!=lo:
            del out['uv'][side]
        elif side not in ('up','down'):
            u,v=face['uv'];du,dv=face['uv_size']
            face['uv']=[u,v+dv*(hi-upper)/(hi-lo)]
            face['uv_size']=[du,dv*(upper-lower)/(hi-lo)]
    return out


def source_half_cubes(source,half):
    result={}
    for bone in source['bones']:
        cubes=[]
        for index,cube in enumerate(bone.get('cubes',[]),1):
            if bone['name']=='bone':
                clipped=cut_source_body(cube,half)
                if clipped:cubes.append((index,clipped))
            elif bone['name']==('bone3' if half=='lower' else 'bone2'):
                cubes.append((index,copy.deepcopy(cube)))
        result[bone['name']]=cubes
    return result


def facing(point,name):
    # Source-to-editor conversion reflects X. A Geo-space yaw therefore becomes
    # the opposite-signed editor yaw. No scale or review placement is included.
    return a.rotate(point,[0,-build.FACING[name],0],[0,0,0])


def corner_gap(src,dst,turn):
    maximum=0
    for point,uv in src:
        candidates=[p for p,tuv in dst if max(abs(x-y)for x,y in zip(uv,tuv))<1e-9]
        assert candidates,('Missing physical UV corner',uv)
        maximum=max(maximum,min(math.dist(facing(point,turn),facing(p,turn))for p in candidates))
    return maximum


def source_clip_for_half(clips,roots,half,closing,frame,root):
    clip_name=('down_' if half=='lower' else 'up_')+('close' if closing else 'open')
    sampled={'bones':{}}
    for bone,channels in clips[clip_name]['bones'].items():
        sampled['bones'][bone]={channel:a.sample(data,frame/10,[1]*3 if channel=='scale' else [0]*3)
                                for channel,data in channels.items()}
    sampled['bones']['bone']=copy.deepcopy(roots[root])
    return sampled


def condition(text):
    expression=re.sub(r"q\.block_state\('([^']+)'\)",lambda m:'states['+repr(m[1])+']',text)
    expression=expression.replace('&&',' and ').replace('||',' or ')
    expression=re.sub(r'\btrue\b','True',expression);expression=re.sub(r'\bfalse\b','False',expression)
    tree=ast.parse(expression,mode='eval')
    permitted=(ast.Expression,ast.BoolOp,ast.And,ast.Or,ast.Compare,ast.Eq,ast.Constant,ast.Subscript,ast.Name,ast.Load)
    assert all(isinstance(n,permitted)for n in ast.walk(tree))
    return compile(tree,'<fixed block condition>','eval')


def geometry_name(half,closing,frame,root):
    return f'refrigerator_{half}_{"close_" if closing else ""}{frame}'+(f'_root_{root}' if root else '')


def main():
    root=build.ROOT;build.verify_pin(root)
    asset=root/build.ASSET
    source=a.read(asset/'geo/block/refrigerator.geo.json')['minecraft:geometry'][0]
    clips=a.read(asset/'animations/refrigerator.animation.json')['animations']
    roots=build.source_roots(clips)
    assert source['bones'][0]['name']=='bone' and source['bones'][0]['pivot']==[0,0,0]
    # Directly inspect all legal states, not only names inferred by a generator.
    dispatch=0;dispatch_inputs={}
    for block,halves in [('refrigerator',['lower','upper']),('refrigerator_upper',['upper'])]:
        path=root/f'runtime/BP/blocks/{block}.json';d=a.read(path)['minecraft:block']
        assert d['description']['states']['ordertocook:root_frame']==[0,1,2,3]
        assert d['description']['traits']['minecraft:placement_direction']['y_rotation_offset']==180
        compiled=[(condition(p['condition']),p['components'])for p in d['permutations']]
        for half,opened,closing,frame,r,turn in itertools.product(halves,[False,True],[False,True],range(11),range(4),build.FACING):
            states={'ordertocook:half':half,'ordertocook:open':opened,'ordertocook:closing':closing,
                    'ordertocook:frame':frame,'ordertocook:root_frame':r,'minecraft:cardinal_direction':turn}
            selected=[components for code,components in compiled if eval(code,{'__builtins__':{}},{'states':states})]
            geometries=[p['minecraft:geometry']for p in selected if 'minecraft:geometry'in p]
            assert geometries==['geometry.ordertocook.'+geometry_name(half,closing,frame,r)]
            transforms=[p['minecraft:transformation']for p in selected if 'minecraft:transformation'in p]
            assert transforms==[{'rotation':[0,build.FACING[turn],0]}]
            assert d['components']['minecraft:material_instances']['*']=={'texture':'ordertocook_block_refrigerator','render_method':'alpha_test','ambient_occlusion':0}
            dispatch+=1
        dispatch_inputs[str(path.relative_to(root))]=a.sha(path)
    assert dispatch==2112

    # The selector domain includes absent input to document pure-function
    # behavior. Service anchoring/missing-block behavior is explicitly separate.
    motions=[None]+[build.door(closing,frame)for closing,frame in itertools.product([False,True],range(11))]
    combinations=[{'upper':upper,'lower':lower}for upper,lower in itertools.product(motions,motions)]
    runtime=build.runtime_roots(root,combinations);histogram={str(i):0 for i in range(4)}
    for item,actual in zip(combinations,runtime):
        composed,_=build.source_pose(clips,item['lower'],item['upper'])
        expected=build.root_index(composed,roots)
        assert actual==expected,(item,actual,expected)
        histogram[str(actual)]+=1
    assert len(combinations)==529

    maximum=0;body_max=0;worst=None;corners=0;uv_cubes=0;geometry_inputs={};pose_rows=[];seams={}
    for half,closing,frame,r in itertools.product(['lower','upper'],[False,True],range(11),range(4)):
        name=geometry_name(half,closing,frame,r)
        path=root/f'runtime/RP/models/blocks/{name}.geo.json'
        g=a.read(path)['minecraft:geometry'][0];geometry_inputs[str(path.relative_to(root))]=a.sha(path)
        target={b['name']:b for b in g['bones']};split=source_half_cubes(source,half)
        clip=source_clip_for_half(clips,roots,half,closing,frame,r)
        local_max=0
        for bone,originals in split.items():
            canon=target[bone].get('cubes',[]);assert len(canon)==len(originals)
            for (original_index,cube),actual in zip(originals,canon):
                src=records(source,bone,cube,clip)
                dst=records(g,bone,actual,{'bones':{}},[0,16 if half=='upper' else 0,0])
                # Bidirectional physical UV-coordinate matching, including the
                # signed cavity's reflected face names and clipped side UVs.
                assert len(src)==len(dst)
                assert {tuple(uv)for _,uv in src}=={tuple(uv)for _,uv in dst}
                uv_cubes+=1
                for turn in build.FACING:
                    gap=max(corner_gap(src,dst,turn),corner_gap(dst,src,turn))
                    if gap>maximum:maximum=gap;worst={'pose':name,'bone':bone,'source_cube':original_index,'facing':turn}
                    local_max=max(local_max,gap)
                    if bone=='bone':body_max=max(body_max,gap)
                    corners+=len(src)
                if bone=='bone':
                    for point,_ in dst:
                        if abs(point[1]-16)<1e-8:seams.setdefault((half,closing,frame,r),set()).add(tuple(point))
        pose_rows.append({'geometry':name,'max_source_to_final_physical_uv_corner_gap_model_units':local_max})
    assert len(pose_rows)==176 and len(geometry_inputs)==176
    assert maximum<.201557 and maximum>.20155
    assert body_max<2e-6
    seam_max=0
    for r in range(4):
        expected=sorted(seams[('lower',False,0,r)]);assert expected
        for half,closing,frame in itertools.product(['lower','upper'],[False,True],range(11)):
            actual=sorted(seams[(half,closing,frame,r)]);assert len(actual)==len(expected)
            for turn in build.FACING:
                seam_max=max(seam_max,max(math.dist(facing(x,turn),facing(y,turn))for x,y in zip(expected,actual)))
    assert seam_max==0

    # Original and new source controls must depict the same affine pose.
    oldroot=HERE/'baseline-scenes'
    old_source_gap=0
    for name in ['lower_closing_upper_open','upper_closing_lower_open']:
        old=a.read(oldroot/(name+'.bbmodel'));new=a.read(HERE/'scenes'/(name+'.bbmodel'))
        old_mesh=[e for e in old['elements']if e['type']=='mesh'];new_mesh=[e for e in new['elements']if e['type']=='mesh']
        assert len(old_mesh)==len(new_mesh)==10
        for before,after in zip(old_mesh,new_mesh):
            assert before['name']==after['name'] and before['faces']==after['faces']
            for key in before['vertices']:
                bp=a.add(before['vertices'][key],before['origin']);ap=a.add(after['vertices'][key],after['origin'])
                old_source_gap=max(old_source_gap,math.dist(bp,ap))
    assert old_source_gap<1e-12

    # Check actual scene bytes against a fresh interpreter, without overwriting
    # either captured/openable candidate or any old review files.
    reproduction={}
    for batch,folder in [('priority','scenes'),('supplemental','supplemental-scenes')]:
        with tempfile.TemporaryDirectory(prefix='otc-root-math-')as tmp:
            subprocess.run([sys.executable,'-B',str(HERE/'build_candidates.py'),'--batch',batch,'--out',tmp,'--build-only'],check=True,stdout=subprocess.DEVNULL)
            for file in Path(tmp).iterdir():
                assert a.sha(file)==a.sha(HERE/folder/file.name),(folder,file.name)
        reproduction[batch]=True
    result={'status':'OFFLINE_MATH_AND_FIXTURES_VERIFIED_NOT_GUI_ACCEPTANCE','canonical_commit':build.PIN,'canonical_tree':build.TREE,
            'source_commit':build.UPSTREAM,'source_controller_selector_cases':529,'selector_root_histogram':histogram,
            'actual_bp_dispatch_states':dispatch,'geometry_poses':176,'facings':4,'physical_uv_corner_comparisons':corners,
            'source_to_final_corner_max_model_units':maximum,'worst':worst,
            'source_body_max_model_units':body_max,'matching_uv_cube_pairs':uv_cubes,'shared_seam_max_model_units':seam_max,
            'old_control_source_affine_max_gap_model_units':old_source_gap,'new_process_reproduction':reproduction,
            'geometry_inputs':geometry_inputs,'dispatch_inputs':dispatch_inputs,'pose_metrics':pose_rows,
            'oracle':'Original signed source cubes, independent Y-plane clipping/UV interpolation, independent source S/R/T and authored easing; no production converter import or fitted intermediate used as truth.',
            'limits':['176 geometry poses include dispatchable combinations that the ordered runtime selector may not produce in a particular two-door sequence.',
                      '529 cases test the pure root selector; absent lower anchor pauses the station service, so an upper-only selector value does not prove that upper-only state is applied.',
                      'Source calculations use Python double-precision evaluation of the authored Gecko formulas; this is not execution of Java float bone writes, STOP/reset or renderer timing.',
                      'The .201557 bound is source affine to final cuboid geometry, not rendered-pixel error or a material/gameplay claim.',
                      'Four-facing coordinate/permutation checks and zero settled seam do not prove atomic cross-block writes or runtime visual continuity.'],
            'gui_run':False,'runtime_modified':False}
    build.verify_pin(root);a.write(HERE/'math-verification.json',result)
    print(json.dumps({k:v for k,v in result.items()if k not in ['geometry_inputs','dispatch_inputs','pose_metrics']},indent=2))


if __name__=='__main__':main()
