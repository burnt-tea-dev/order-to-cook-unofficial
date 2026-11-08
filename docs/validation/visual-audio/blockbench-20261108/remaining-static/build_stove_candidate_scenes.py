#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Pair independent source-equivalent poses with actual candidate geometry.
OTC_CANDIDATE_ROOT can select an unmerged candidate during preparation.
No controllers, native block transitions, or game renderer are executed.
"""
import json,os,math
from pathlib import Path
import build_stove_pose_scenes as source
import scene_lib as sl
from scene_lib import Scene
D=Path(__file__).resolve().parent
ROOT=Path(os.environ.get('OTC_CANDIDATE_ROOT',str(D.parents[4])))
OUT=D/'stove-candidate-scenes';OUT.mkdir(exist_ok=True);sl.OUT=OUT
block=json.loads((ROOT/'runtime/BP/blocks/stove.json').read_text())['minecraft:block']
for age in [1,3,9,15,17,19]:
 t=age/20;g,_,_,_=source.pose(t)
 source_file=OUT/f'source-age-{age}.geo.json';source_file.write_text(json.dumps(g,indent=2)+'\n')
 native=ROOT/f'runtime/RP/models/blocks/stove_ignition_{age}.geo.json'
 native_data=json.loads(native.read_text())['minecraft:geometry'][0]
 condition=f"(q.block_state('ordertocook:ignition_frame') + 16 * q.block_state('ordertocook:ignition_frame_high')) == {age}"
 variant=[v for v in block['permutations'] if v['condition']==condition]
 assert len(variant)==1 and variant[0]['components']['minecraft:geometry']==native_data['description']['identifier']
 texture=source.A/('textures/block/'+('stove' if age<15 else 'stove_fire')+'.png')
 s=Scene(f'Source ignition age {age} versus restored canonical pose')
 s.bedrock(source_file,texture,[-11,0,0],name='Source-equivalent Gecko 4.8.3')
 s.bedrock(native,texture,[11,0,0],name='Canonical restored pose')
 assert len(s.j['elements'])==6
 for left,right in zip(s.j['elements'][:3],s.j['elements'][3:]):
  for key in ['from','to']:
   assert all(math.isclose(a+(22 if i==0 else 0),b,rel_tol=0,abs_tol=2e-6) for i,(a,b) in enumerate(zip(left[key],right[key])))
  assert left['faces']==right['faces']
 s.save(f'stove-age-{age}-source-vs-candidate.bbmodel')
# A same-pose control detects preview asymmetry without altering any runtime data.
s=Scene('Identical canonical stove age 17 control')
native=ROOT/'runtime/RP/models/blocks/stove_ignition_17.geo.json'
texture=source.A/'textures/block/stove_fire.png'
s.bedrock(native,texture,[-11,0,0],name='Canonical age17 A')
s.bedrock(native,texture,[11,0,0],name='Canonical age17 B')
s.save('stove-identical-age-17-control.bbmodel')
print('Prepared six source/candidate pairs and one identical-pose control. This preparation does not perform GUI checks.')
