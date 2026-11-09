#!/usr/bin/env python3
"""Bounded case-selection checks, hand-stated landmark expectations and old-sample differences."""
from pathlib import Path
import json
import numpy as np
from verify_review import oracle,src_world
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
expected={
 '01_slim_sit1_counterphase':{'right_arm.rotation':[-20,0,0],'left_arm.rotation':[-10,0,0],'right_foot.rotation':[50,0,0],'left_foot.rotation':[30,0,0],'right_foot.position':[0,1.5,-.75],'left_foot.position':[0,1.5,-.25]},
 '02_wide_wait1_phase0':{'right_arm.rotation':[-10,0,0],'left_arm.rotation':[-20,0,0],'body.position':[0,-2,0]},
 '03_slim_sit2_head_query':{'head.rotation':[-15,30,0],'right_arm.rotation':[-15,0,0],'left_arm.rotation':[-15,0,0],'right_foot.rotation':[40,0,0],'left_foot.rotation':[40,0,0],'right_foot.position':[0,1.5,-.5],'left_foot.position':[0,1.5,-.5]},
 '04_wide_wait4_yaw':{'head.rotation':[0,-20,0],'right_arm.rotation':[-19.629333333333333,0,0],'left_arm.rotation':[-10.370666666666667,0,0],'right_hand.rotation':[0,0,0],'right_hand.position':[0,0,0]},
 '05_wide_eat_left_wrist':{'head.rotation':[32.5,0,0],'torso.rotation':[15,0,0],'left_hand.rotation':[0,0,52.5],'left_hand.position':[.75,1.5,0],'right_hand.rotation':[0,0,-35],'right_hand.position':[-1/3,7/6,0],'body.scale':[1,1,1]},
 '06_slim_sittake_phase0':{'right_arm.rotation':[-170.4542,2.9932,-17.2501],'left_arm.rotation':[-175.3001,-1.7082,19.9298],'right_foot.rotation':[30,0,0],'left_foot.rotation':[50,0,0],'right_hand.rotation':[0,0,0],'left_hand.rotation':[0,0,0]},
 '07_slim_sittake_phase05':{'right_arm.rotation':[-170.149,1.728,-9.8511],'left_arm.rotation':[-175.1179,-1.0809,12.4538],'right_foot.rotation':[130/3,0,0],'left_foot.rotation':[110/3,0,0],'right_hand.rotation':[0,0,0],'left_hand.rotation':[0,0,0]},
}
specs=read(ROOT/'scene-manifest.json')['samples'];old=read(ROOT/'prior-coverage.json')['samples'];report=[];landmark_count=0
for s in specs:
 p=pose(s);stored=read(ROOT/'samples'/(s['id']+'.json'))
 for key,value in expected[s['id']].items():
  bone,channel=key.split('.');near(p[bone][channel],value)
  for side in stored['sides']:near(side['sampled_bones'][bone][channel],value)
  landmark_count+=1
 assert p.get('body',{}).get('rotation',[0,0,0])==[0,0,0]
 assert p.get('body',{}).get('scale',[1,1,1])==[1,1,1]
 if s['clip'].startswith('customer_wait_'):assert not any(b in p for b in ['right_leg','left_leg','right_foot','left_foot'])
 if s['clip']=='customer_sit_2':
  assert s['query']=={'target_x_rotation':15,'target_y_rotation':-30}
  assert clips[s['clip']]['bones']['head']['rotation']['vector']==['-query.target_x_rotation','-query.target_y_rotation',0]
  assert 'rotation'not in clips[s['clip']]['bones']['body']
 g=geom(s['rig']);new=src_world(g,p);deltas=[]
 for previous in old:
  if previous['rig']!=s['rig']:continue
  world=src_world(g,pose(previous));delta=max(float(np.max(np.abs(new[k]-world[k]))) for k in new)
  assert delta>1e-8,(s['id'],previous['id'],'duplicate static cube geometry')
  deltas.append({'previous_id':previous['id'],'max_corner_component_difference_model_units':delta})
 report.append({'id':s['id'],'hand_stated_landmarks':expected[s['id']],'same_rig_prior_differences':deltas,'note':'A geometric difference is not proof of useful visible novelty or native parity. Old approximate times are checked at their recorded decimals only.'})
# The same-rig phases intentionally differ; no reversed/duplicated scene claim.
first=pose(specs[5]);second=pose(specs[6]);g=geom('slim');w0=src_world(g,first);w1=src_world(g,second)
phase_delta=max(float(np.max(np.abs(w0[k]-w1[k]))) for k in w0)
assert phase_delta>1
result={'status':'PASS bounded selection checks','scene_count':len(specs),'hand_stated_landmark_records':landmark_count,'new_scenes_equal_to_any_declared_same_rig_prior_static_pose':0,'seated_take_phase_max_corner_component_difference_model_units':phase_delta,'prior_scope':'Only the documented sample instants in prior-coverage.json; no blanket novelty claim across all frames.','scenes':report}
(ROOT/'selection-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='scenes'},indent=2))
