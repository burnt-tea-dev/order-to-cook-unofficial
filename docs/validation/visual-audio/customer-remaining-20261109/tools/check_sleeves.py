#!/usr/bin/env python3
"""Geometric overlap diagnostic, not a native renderer or pixel attribution test."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from verify_review import src_world
root=Path(sys.argv[1]);g=json.loads((root/'inputs/runtime/RP/models/entity/customer.geo.json').read_text())['minecraft:geometry'][0]
s=json.loads((root/'samples/05_wide_eat_left_wrist.json').read_text())
def cross2(a,b):return a[0]*b[1]-a[1]*b[0]
def area(poly):
 return abs(sum(cross2(poly[(i+1)%len(poly)]-poly[0],poly[i]-poly[0]) for i in range(len(poly))))/2 if len(poly)>2 else 0.
def clip(subject,cutter):
 # Normalize cutter to counterclockwise, then intersect convex polygons.
 signed=sum(cross2(cutter[i],cutter[(i+1)%len(cutter)]) for i in range(len(cutter)))
 if signed<0:cutter=list(reversed(cutter))
 for a,b in zip(cutter,cutter[1:]+cutter[:1]):
  if not subject:return []
  out=[];prev=subject[-1];dp=cross2(b-a,prev-a)
  for cur in subject:
   dc=cross2(b-a,cur-a)
   if (dc>=-1e-10)!=(dp>=-1e-10):out.append(prev+(cur-prev)*dp/(dp-dc))
   if dc>=-1e-10:out.append(cur)
   prev,dp=cur,dc
  subject=out
 return subject
rows=[]
for side in s['sides']:
 w=src_world(g,side['sampled_bones'])
 for arm in ['right','left']:
  for cube in [0,1]:
   a=w[(arm+'_arm',cube)];b=w[(arm+'_hand',cube)]
   for name,idx in [('z-min',[0,2,6,4]),('z-max',[1,3,7,5])]:
    pa=a[idx];pb=b[idx];u=pa[1]-pa[0];u/=np.linalg.norm(u);v=pa[3]-pa[0];v/=np.linalg.norm(v);n=np.cross(u,v)
    dist=float(max(abs((pb-pa[0])@n)))
    projected=lambda p:[np.array([np.dot(q-pa[0],u),np.dot(q-pa[0],v)]) for q in p]
    overlap=float(area(clip(projected(pa),projected(pb)))) if dist<1e-10 else 0
    assert dist<1e-10 and overlap>0
    rows.append({'side':side['side'],'limb':arm,'cube':cube,'parallel_surface':name,'max_plane_distance':dist,'overlap_area_model_units_squared':overlap})
assert all(abs(rows[i]['overlap_area_model_units_squared']-rows[i+8]['overlap_area_model_units_squared'])<1e-10 for i in range(8))
im=np.array(Image.open(root/'inputs/runtime/RP/textures/ordertocook/entity/otc_zombie_custom.png').convert('RGBA'))
report={'classification':'Shared positive-area coplanar arm/hand face overlap; consistent with editor depth competition, not proof of exact rasterizer root cause or native defect. No source/RP geometry, UV, inflate or PNG difference identified.','rows':rows,'skin_alpha_values':sorted(set(im[:,:,3].flatten().tolist())),'limits':'No draw-order, depth-buffer, transparency or GPU instrumentation. JPEG artifacts also prevent assigning every pixel to one mechanism. Both figures use the same CubeRenderer.'}
print(json.dumps(report,indent=2))
