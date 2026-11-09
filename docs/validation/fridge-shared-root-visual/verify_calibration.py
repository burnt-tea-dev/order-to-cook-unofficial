#!/usr/bin/env python3
"""Portable checks for original Geo-import/Auto and renderer-recovery evidence."""
import sys
sys.dont_write_bytecode=True
import copy,json,math
from pathlib import Path
import numpy as np
from PIL import Image
import build_candidates as build
a=build.a;HERE=Path(__file__).resolve().parent;C=HERE/'calibration'


def metrics(first,second,box):
    x,y,X,Y=box;f=np.asarray(Image.open(first).convert('RGB'),dtype=float)[y:Y,x:X]
    s=np.asarray(Image.open(second).convert('RGB'),dtype=float)[y:Y,x:X]
    d=np.abs(f-s);peak=d.max(2);foreground=np.maximum(f.max(2),s.max(2))>55
    def stats(mask):
        p=peak[mask];v=d[mask]
        return {'pixels':int(p.size),'exact_rgb_pixels':int(np.sum(p==0)),'exact_rgb_fraction':float(np.mean(p==0)),
                'mean_absolute_channel_error_0_to_255':float(v.mean()),'root_mean_square_channel_error':float(np.sqrt(np.mean(v*v))),
                'max_channel_error':int(p.max()),'pixels_max_channel_over_16':int(np.sum(p>16)),'pixels_max_channel_over_32':int(np.sum(p>32))}
    return {'roi_xyxy':box,'full_roi':stats(np.ones(peak.shape,dtype=bool)),
            'foreground_union_rgb_max_over_55':stats(foreground),'alignment':'Same original coordinates, no registration, resizing, rotation, filtering or saved crop.'}


def main():
    for path,digest in a.read(HERE/'provenance/calibration-files.json').items():assert a.sha(HERE/path)==digest
    front=C/'diagnostic-scenes/fridge-cavity-front-only-original.bbmodel';auto=C/'diagnostic-scenes/fridge-cavity-render-sides-auto-only.bbmodel'
    assert front.read_bytes().count(b'"render_sides": "front"')==2
    assert front.read_bytes().replace(b'"render_sides": "front"',b'"render_sides": "auto"')==auto.read_bytes()
    native=C/'direct-blockbench-geo-import'
    original=a.read(native/'source-refrigerator.original.geo.json');endpoint=copy.deepcopy(original)
    for bone,angle in [('bone3',-125),('bone2',-135)]:
        next(b for b in endpoint['minecraft:geometry'][0]['bones']if b['name']==bone)['rotation']=[0,angle,0]
    assert endpoint==a.read(native/'source-refrigerator-both-open.endpoint.geo.json')
    assembly=a.read(native/'canonical-refrigerator-both-open.assembled.geo.json')['minecraft:geometry'][0]
    for half,offset in [('lower',0),('upper',16)]:
        target=a.read(native/f'canonical-refrigerator-{half}-10.original.geo.json')['minecraft:geometry'][0]['bones']
        reverted=[]
        for bone in assembly['bones']:
            if not bone['name'].startswith(half+'_'):continue
            b=copy.deepcopy(bone);b['name']=b['name'].removeprefix(half+'_')
            if 'parent'in b:b['parent']=b['parent'].removeprefix(half+'_')
            b['pivot'][1]-=offset
            for cube in b.get('cubes',[]):
                cube['origin'][1]-=offset
                if 'pivot'in cube:cube['pivot'][1]-=offset
            reverted.append(b)
        assert reverted==target
        # Neutral fully-open input was not changed by the shared-root repair.
        assert a.sha(native/f'canonical-refrigerator-{half}-10.original.geo.json')==a.sha(build.ROOT/f'runtime/RP/models/blocks/refrigerator_{half}_10.geo.json')
    assert a.sha(native/'refrigerator.png')==build.PNG_SHA
    official=a.read(C/'official-provenance.json')
    for row in official['files'].values():assert a.sha(C/row['path'])==row['sha256']
    gecko=C/'gecko-render-source'
    for row in a.read(gecko/'verified-provenance.json'):assert a.sha(gecko/row['file'])==row['sha256']
    assert 'RenderType.entityCutoutNoCull(texture)'in(gecko/'GeoModel.java').read_text()
    assert 'getRenderType'not in(HERE/'source-evidence/RefrigeratorRenderer.java').read_text()
    assert 'getRenderType'not in(HERE/'source-evidence/RefrigeratorGeoModel.java').read_text()

    screenshots=[]
    for path in sorted((C/'screenshots').glob('*.jpg')):
        with Image.open(path)as im:assert im.format=='JPEG'and im.size==(1188,848)
        role='renderer_failure_diagnostic'if'white-diagnostic'in path.name else'original_front_only_failure'if'-fail'in path.name else'settings_evidence'if path.name in ['global-render-sides-auto.jpg','recovery-hardware-acceleration-off.jpg']else'calibration_model_view'
        screenshots.append({'path':str(path.relative_to(HERE)),'sha256':a.sha(path),'role':role,'dimensions':[1188,848]})
    direct={};recovery={}
    for cam,box in [('north',[480,104,840,480]),('isometric-right-2-1',[440,135,750,710])]:
        direct[cam]=metrics(C/f'screenshots/fridge-direct-source-{cam}.jpg',C/f'screenshots/fridge-direct-canonical-{cam}.jpg',box)
    for cam,box in [('north',[300,175,995,480]),('isometric-right-2-1',[335,150,855,745])]:
        recovery[cam]=metrics(C/f'screenshots/fridge-auto-only-{cam}.jpg',C/f'screenshots/fridge-software-recovery-{cam}.jpg',box)
        assert recovery[cam]['full_roi']['max_channel_error']==0
    assert direct['north']['full_roi']['exact_rgb_pixels']==134684
    assert direct['isometric-right-2-1']['full_roi']['exact_rgb_pixels']==177336
    result={'status':'EDITOR_CALIBRATION_AND_RECOVERY_NOT_NATIVE_MATERIAL_ACCEPTANCE',
      'application':'Blockbench Desktop 5.2.2','screenshots':screenshots,'direct_geo_original_pixel_comparisons':direct,
      'hardware_acceleration_recovery_original_pixel_comparisons':recovery,
      'auto_only_change':'Exactly two texture render_sides values front to auto; every other original scene byte unchanged.',
      'source_endpoint_change':'Only source bone3 Y=-125 and bone2 Y=-135; original source Geo/PNG retained.',
      'canonical_assembly_change':'Prefix lower_/upper_ bone names and parents; upper Y+16; reverse check exact.',
      'rendering_evidence':'Official Texture default auto; global Auto preview is double-sided without a format override. The pinned Java model uses entityCutoutNoCull. Neither establishes Minecraft Bedrock material behavior.',
      'interaction_note':'During the source direct import an accidental Create Group was immediately undone, without save, before loading the original PNG. Canonical import did not have that step. Both direct tabs showed texture-loading dirty markers and were not saved. On-disk fixture hashes remained unchanged.',
      'recovery_note':'After reported GPU-process failures and a white viewport, Hardware Acceleration was disabled through the official editor Settings and the application restarted. The supplied Settings image confirms off. Repeated both-open control model ROIs match the earlier Auto-only images exactly. This recovers the editor renderer, not an asset or game fix.',
      'limits':['The graphics backend/driver is not independently identified by the settings screenshot.',
                'Direct-Geo JPEGs are not losslessly identical; small residuals are retained without assigning an unproved cause.',
                'All image computations use untouched originals and in-memory arrays only.',
                'No running animation, other pose, native-world transparency, game/client/BDS or network acceptance.']}
    a.write(HERE/'calibration-verification.json',result)
    print('PASS: original Geo/endpoint/assembly identities; two-value Auto change; direct-import and renderer-recovery pixel checks. Editor scope only.')


if __name__=='__main__':main()
