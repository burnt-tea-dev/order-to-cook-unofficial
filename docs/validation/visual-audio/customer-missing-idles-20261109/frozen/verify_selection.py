#!/usr/bin/env python3
"""Bounded new-family selection: hand-stated landmarks, query attachment, prior-pose deltas."""
from pathlib import Path
import json,copy
import numpy as np
from verify_review import oracle,src_world,bb_world
ROOT=Path(__file__).resolve().parent
A=ROOT/'inputs/upstream/reference/common/src/main/resources/assets/ordertocook'
def read(p):return json.loads(p.read_text())
clips={}
for f in ['npc','npc.transition']:clips.update(read(A/'animations'/f'{f}.animation.json')['animations'])
def pose(spec):
 if spec['clip']=='neutral':return {}
 return {b:{c:oracle(v,spec['time'],spec.get('query',{}),True).tolist() for c,v in chs.items()} for b,chs in clips[spec['clip']]['bones'].items()}
def geom(rig):return read(A/'geo'/('drive_idle_alex.geo.json'if rig=='slim'else'drive_idle.geo.json'))['minecraft:geometry'][0]
def near(actual,wanted):assert np.max(np.abs(np.array(actual)-wanted))<1e-10,(actual,wanted)
def value(p,key):
 bone,ch=key.split('.');return p.get(bone,{}).get(ch,[1,1,1] if ch=='scale' else [0,0,0])
# These expectations are stated from authored constants/keyframe endpoints, not sampled outputs.
# 0.5833 / 0.75 = 5833/7500; only right arm and feet interpolate at that time.
r=5833/7500
wait_expected={'head.rotation':[-15,30,0],'body.rotation':[0,0,0],'body.position':[0,-2,0],'body.scale':[1,1,1],
 'right_arm.rotation':[-15,0,0],'left_arm.rotation':[-15,0,0],
 'right_leg.rotation':[0,0,0],'left_leg.rotation':[0,0,0],'right_foot.rotation':[0,0,0],'left_foot.rotation':[0,0,0],
 'right_hand.rotation':[0,0,0],'left_hand.rotation':[0,0,0]}
sit_expected={'body.rotation':[-15,30,0],'body.position':[0,-2,0],'body.scale':[1,1,1],'head.rotation':[0,0,0],
 'left_arm.rotation':[-157.5348,-6.8699,16.134],'right_arm.rotation':[-10-10*r,0,0],
 'right_leg.rotation':[-84.92327,9.96156,.88045],'left_leg.rotation':[-84.92327,-9.96156,-.88045],
 'right_foot.rotation':[30+20*r,0,0],'left_foot.rotation':[50-20*r,0,0],
 'right_foot.position':[0,1.5,-.25-.5*r],'left_foot.position':[0,1.5,-.75+.5*r],
 'right_hand.rotation':[0,0,0],'left_hand.rotation':[0,0,0]}
def query_controls(spec,p):
 assert spec['query']=={'target_x_rotation':15,'target_y_rotation':-30}
 bones=clips[spec['clip']]['bones'];expressions=['-query.target_x_rotation','-query.target_y_rotation',0]
 if spec['clip']=='customer_wait_2':
  assert spec['time']==.375 and bones['head']['rotation']['vector']==expressions
  assert 'rotation' not in bones['body']
  assert not any(b in bones for b in ['right_leg','left_leg','right_foot','left_foot'])
  near(value(p,'body.rotation'),[0,0,0]);near(value(p,'head.rotation'),[-15,30,0])
 elif spec['clip']=='customer_sit_3':
  assert spec['time']==.5833 and bones['body']['rotation']['vector']==expressions
  assert 'head' not in bones
  assert bones['left_arm']['rotation']['0.5833']['vector']==[-157.5348,-6.8699,16.134]
  near(value(p,'body.rotation'),[-15,30,0]);near(value(p,'head.rotation'),[0,0,0])
 else:raise AssertionError('Undeclared new family')

def main():
 specs=read(ROOT/'scene-manifest.json')['samples'];old=read(ROOT/'prior-coverage.json')['samples'];report=[];landmarks=0;queries=[]
 assert [(s['rig'],s['clip']) for s in specs]==[('wide','customer_wait_2'),('slim','customer_wait_2'),('wide','customer_sit_3'),('slim','customer_sit_3')]
 for s in specs:
  p=pose(s);stored=read(ROOT/'samples'/(s['id']+'.json'));expected=wait_expected if s['clip']=='customer_wait_2' else sit_expected
  for key,wanted in expected.items():
   near(value(p,key),wanted)
   for side in stored['sides']:near(value(side['sampled_bones'],key),wanted)
   landmarks+=1
  query_controls(s,p)
  # Negative control of the prior overgeneralization: sit3 cannot be zero-body/head-query.
  wrong=copy.deepcopy(p)
  if s['clip']=='customer_sit_3':wrong['body']['rotation']=[0,0,0];wrong['head']={'rotation':[-15,30,0]}
  else:wrong['head']['rotation']=[0,0,0];wrong['body']['rotation']=[-15,30,0]
  try:query_controls(s,wrong)
  except AssertionError:queries.append(s['id'])
  else:raise AssertionError('Wrong query bone accepted')
  g=geom(s['rig']);new=src_world(g,p);deltas=[]
  for previous in old:
   if previous['rig']!=s['rig']:continue
   world=src_world(g,pose(previous));delta=max(float(np.max(np.abs(new[k]-world[k]))) for k in new)
   assert delta>1e-8,(s['id'],previous['id'],'duplicate static cube geometry')
   deltas.append({'previous_id':previous['id'],'max_corner_component_difference_model_units':delta})
  actual=bb_world(read(ROOT/s['path']));side_delta=max(float(np.max(np.abs((actual['SOURCE '+b+' cube'+str(i)]+[20,0,0])-(actual['RP '+b+' cube'+str(i)]-[20,0,0])))) for b,i in new)
  assert side_delta<1e-10
  report.append({'id':s['id'],'hand_stated_landmarks':expected,'same_rig_prior_differences':deltas,'minimum_of_prior_max_corner_component_differences':min(d['max_corner_component_difference_model_units'] for d in deltas),'actual_serialized_source_rp_corner_difference':side_delta})
 pairs=[]
 for rig in ['wide','slim']:
  relevant=[s for s in specs if s['rig']==rig];a,b=[src_world(geom(rig),pose(s)) for s in relevant]
  delta=max(float(np.max(np.abs(a[k]-b[k]))) for k in a);assert delta>1
  pairs.append({'rig':rig,'scenes':[s['id'] for s in relevant],'max_corner_component_difference_model_units':delta})
 result={'status':'PASS bounded selection checks','scene_count':len(specs),'hand_stated_landmark_records':landmarks,'query_attachment_mutations_rejected':queries,'new_scenes_equal_to_any_declared_same_rig_prior_static_pose':0,'declared_prior_samples':len(old),'prior_scope':'Only the documented instants in prior-coverage.json; old approximate UI times are checked at their recorded decimals. Geometry difference is not visible novelty at every camera, native acceptance, or an all-times claim.','new_same_rig_family_differences':pairs,'scenes':report}
 (ROOT/'selection-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='scenes'},indent=2))
if __name__=='__main__':main()
