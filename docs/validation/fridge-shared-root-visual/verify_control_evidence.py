#!/usr/bin/env python3
"""Verify four supplied candidate photographs without editing any image."""
import sys
sys.dont_write_bytecode=True
import json,math,statistics
from pathlib import Path
import numpy as np
from PIL import Image
import build_candidates as build
a=build.a;HERE=Path(__file__).resolve().parent
OLD=HERE/'baseline-evidence'
EXPECTED={
 'lower_closing_upper_open-isometric-right-2-1.jpg':'af610bd65e726073ad06b7a8803ae1a2339e59ad8913ead15124492ff47254fb',
 'lower_closing_upper_open-top.jpg':'41b3920e2254900d6c498015fe92154d6305519411d8ac66bec275d7e4fde906',
 'upper_closing_lower_open-isometric-right-2-1.jpg':'a886faa00b725f25513487423ad9baa17b476792f228a3fb11f7e0657283d392',
 'upper_closing_lower_open-bottom.jpg':'fa8608f1854322aa2f2b8ce584069e2a5c764bc4e1a5227bb0eaa8c71c5fe303',
}
BASELINE={
 'lower_closing_upper_open-isometric-right-2-1.jpg':'a825d5815364214318312064e65d9aeff42860295af77217e05809cc0e827715',
 'lower_closing_upper_open-top.jpg':'f0540e7bc1488ced8694afa9e84b9e090721e1a303e10ca8adabf7ba361fc4a0',
 'upper_closing_lower_open-isometric-right-2-1.jpg':'a20cebf0db47a491c337bc19535824c01be1fd01e907ed20f0861afcfb2d04ed',
 'upper_closing_lower_open-bottom.jpg':'c8ed02644164800257535786193427e738c0937d05fb4a8c02ea969464cb1452',
}


def roi_metrics(before,after,box):
    x,y,X,Y=box;delta=np.abs(before[y:Y,x:X]-after[y:Y,x:X]);peak=delta.max(2)
    return {'roi_xyxy':list(box),'pixels':int(peak.size),'exact_rgb_pixels':int(np.sum(peak==0)),
            'exact_rgb_fraction':float(np.mean(peak==0)),'mean_absolute_channel_error_0_to_255':float(delta.mean()),
            'max_channel_error':int(peak.max()),'pixels_max_channel_over_16':int(np.sum(peak>16)),
            'pixels_max_channel_over_32':int(np.sum(peak>32))}


def longest_run(mask,start):
    runs=[];begin=None
    for i,yes in enumerate(mask):
        if yes and begin is None:begin=i+start
        if begin is not None and (not yes or i==len(mask)-1):
            end=i+start-int(not yes);runs.append([begin,end,end-begin+1]);begin=None
    assert runs
    return max(runs,key=lambda row:row[2])


def roof(image,cols):
    rows=[{'x':x,'longest_run_y0_y1_inclusive_count':longest_run(image[370:550,x,:].min(1)>180,370)}for x in cols]
    return {'columns':rows,'median_run_pixels':statistics.median(r['longest_run_y0_y1_inclusive_count'][2]for r in rows)}


def bottom(image,cols):
    rows=[]
    for x in cols:
        reference=image[450,x,:]
        mask=np.max(np.abs(image[340:550,x,:]-reference),axis=1)<=5
        rows.append({'x':x,'reference_rgb_at_y450':list(map(int,reference)),
                     'longest_run_y0_y1_inclusive_count':longest_run(mask,340)})
    return {'columns':rows,'median_run_pixels':statistics.median(r['longest_run_y0_y1_inclusive_count'][2]for r in rows)}


def main():
    manifest=a.read(HERE/'scenes/manifest.json');before={};after={};photos=[]
    for name,digest in EXPECTED.items():
        path=HERE/'screenshots'/name;baseline=OLD/name
        assert a.sha(path)==digest and a.sha(baseline)==BASELINE[name]
        for file,target in [(path,after),(baseline,before)]:
            with Image.open(file)as im:
                assert im.format=='JPEG' and im.size==(1188,848)
                target[name]=np.asarray(im.convert('RGB'),dtype=np.float64)
        case=name.split('-')[0]
        scene=next(r for r in manifest['files']if r['path']==case+'.bbmodel')
        assert a.sha(HERE/'scenes'/scene['path'])==scene['sha256']
        for item in scene['canonical_inputs']:
            assert a.sha(build.ROOT/item['path'])==item['sha256']
            assert item['states']['ordertocook:root_frame']==2
        for rel,sha in manifest['inputs'].items():assert a.sha(build.ROOT/rel)==sha
        isflat='-top.'in name or '-bottom.'in name
        box=(130,275,455,555)if '-top.'in name else (35,340,425,740)if '-bottom.'in name else (580,260,920,765)
        photos.append({'path':'screenshots/'+name,'sha256':digest,'bytes':path.stat().st_size,'dimensions':[1188,848],
                       'baseline_path':str(baseline.relative_to(HERE)),'baseline_sha256':BASELINE[name],
                       'scene':'scenes/'+scene['path'],'scene_sha256':scene['sha256'],'source_side':'left'if isflat else'right',
                       'source_baseline_to_candidate_raw_pixel_check':roi_metrics(before[name],after[name],box),
                       'result':'VISIBLE_OPPOSITE_HALF_ROOT_DEPTH_GAP_RESOLVED_WITH_FITTED_CUBOID_RESIDUAL_RETAINED'})
    top='lower_closing_upper_open-top.jpg';base='upper_closing_lower_open-bottom.jpg'
    measurements={
        'roof_top':{'method':'Longest contiguous min(R,G,B)>180 run within y=370..549 at fixed interior columns; no image edits.',
                    'source_before':roof(before[top],[300,320,350]),'source_after':roof(after[top],[300,320,350]),
                    'canonical_before':roof(before[top],[780,800,830]),'canonical_after':roof(after[top],[780,800,830]),
                    'source_geometry_depth_model_units':15.2,'baseline_canonical_depth_model_units':16,
                    'candidate_canonical_depth_model_units':15.2},
        'bottom_panel':{'method':'Longest contiguous run within 5 channel values of the same column at y450, searched y=340..549. This is a flat-color interior span, not an exact silhouette boundary.',
                        'source_before':bottom(before[base],[260,280,300,320,340]),'source_after':bottom(after[base],[260,280,300,320,340]),
                        'canonical_before':bottom(before[base],[860,880,900,920,940]),'canonical_after':bottom(after[base],[860,880,900,920,940]),
                        'source_geometry_depth_model_units':13.3,'baseline_canonical_depth_model_units':14,
                        'candidate_canonical_depth_model_units':13.3}}
    for name,digest in EXPECTED.items():assert a.sha(HERE/'screenshots'/name)==digest
    result={'status':'TWO_CANDIDATE_CONTROLS_GUI_REVIEWED_NOT_RELEASE_ACCEPTANCE','canonical_fixture_commit':build.PIN,
            'canonical_fixture_tree':build.TREE,'source_commit':build.UPSTREAM,'screenshots':photos,'measurements':measurements,
            'geometry_source_oracle':'math-verification.json','independent_visual_review':'All four original supplied JPEGs inspected offline. Both opposite-half depth differences disappear in the photographed views; remaining fitted door differences are retained.',
            'integrity':'Original source geometry is the same pose: independent old/new source affine corner gap 7.105427357601002e-15 model units. Neither old/candidate scenes nor any JPEG was changed.',
            'scope':'Two full assemblies, four static views only. Supplemental fixtures, all other state combinations and game rendering are not visually accepted by these pictures.',
            'service_status':'These fixtures retain e544 identity. The separate dcee-input-equivalence receipt verifies unchanged visual inputs at the later service commit; photographs do not validate service exception behavior.',
            'limits':['Source Top/Bottom ROIs and upper isometric source ROI are RGB-identical to baseline; lower isometric source ROI has small residuals with maximum channel difference 12. No definite AA/compression cause is inferred.',
                      'Matching source ROIs and independently matching source geometry support comparable framing; metrics do not compare unrelated cameras or infer game rendering.',
                      'Flat-color scanline spans corroborate depth change, not subpixel geometry measurement or universal pixel-parity thresholds.',
                      'Geometric fit residuals, Java float/rendering precision, animation timing, STOP/reset/reopen behavior and non-atomic cross-block updates remain outside this GUI result.',
                      'No Minecraft/BDS/material/gameplay/network result, runtime change or publication by this audit.'],
            'gui_operated_by_this_verifier':False,'runtime_modified':False}
    a.write(HERE/'control-evidence-manifest.json',result)
    print(json.dumps({'status':result['status'],'photos':len(photos),
                      'roof_medians':{k:v['median_run_pixels']for k,v in measurements['roof_top'].items()if isinstance(v,dict)},
                      'bottom_medians':{k:v['median_run_pixels']for k,v in measurements['bottom_panel'].items()if isinstance(v,dict)}},indent=2))


if __name__=='__main__':main()
