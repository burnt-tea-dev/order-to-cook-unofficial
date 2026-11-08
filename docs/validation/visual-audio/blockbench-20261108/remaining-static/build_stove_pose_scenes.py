"""Review-only source-equivalent ignition poses versus baseline .45 static runtime.
Specialized, independently expressed source formulas for GeckoLib 4.8.3.
This neither drives a client animation controller nor emulates world timing.
"""
import copy,json,math
from pathlib import Path
import scene_lib as sl
from scene_lib import Scene
ROOT=Path(__file__).resolve().parents[5]
A=ROOT/'upstream/reference/common/src/main/resources/assets/ordertocook'
OUT=Path(__file__).parent/'stove-pose-scenes';OUT.mkdir(exist_ok=True);sl.OUT=OUT
G=json.loads((A/'geo/block/stove.geo.json').read_text())
assert [(b['name'],b.get('parent'),b['pivot']) for b in G['minecraft:geometry'][0]['bones']]==[('group2',None,[0,8,0]),('group5','group2',[0,2,-5])]
assert [len(b['cubes']) for b in G['minecraft:geometry'][0]['bones']]==[2,1]
# Original easeInElastic function, not the similarly named easings.net curve.
def elastic(x):return 1-math.cos(x*math.pi/2)**3*math.cos(x*math.pi)
def lerp(a,b,x):return [u+(v-u)*x for u,v in zip(a,b)]
def pose(t):
 if t<=.75:body=[1,1,1]
 elif t<=.875:body=lerp([1,1,1],[1,1.05,1.1],elastic((t-.75)/.125))
 else:body=lerp([1,1.05,1.1],[1,1,1],1 if t>=1 else (.5 if (t-.875)/.125>.5 else 0))
 if t<=.125:door=lerp([1,1,1],[1,.9,1],t/.125)
 elif t<=.75:door=lerp([1,.9,1],[.9,.8,.9],(t-.125)/.625)
 elif t<=.875:door=lerp([.9,.8,.9],[1.3,1.3,1.3],elastic((t-.75)/.125))
 else:door=lerp([1.3,1.3,1.3],[1,1,1],1 if t>=1 else (.5 if (t-.875)/.125>.5 else 0))
 angle=math.sin(math.radians(t*3000))*3*(1 if t<=.0833 else max(0,(.75-t)/(.75-.0833)))
 assert all(x==1 for x in body) or abs(angle)<1e-9
 result=copy.deepcopy(G);a,b=result['minecraft:geometry'][0]['bones']
 # All three source cubes are axis aligned. Child rotation only occurs while
 # ancestor scale is identity, so these transforms introduce no shear.
 for node,local_scale in [(a,[1,1,1]),(b,door)]:
  pivot=node['pivot'][:]
  for c in node['cubes']:
   assert not c.get('rotation') and not c.get('pivot')
   c['origin']=[pivot[i]+(c['origin'][i]-pivot[i])*local_scale[i] for i in range(3)]
   c['size']=[c['size'][i]*local_scale[i] for i in range(3)]
   c['origin']=[a['pivot'][i]+(c['origin'][i]-a['pivot'][i])*body[i] for i in range(3)]
   c['size']=[c['size'][i]*body[i] for i in range(3)]
  if node is b:node['pivot']=[a['pivot'][i]+(pivot[i]-a['pivot'][i])*body[i] for i in range(3)]
 b['rotation']=[0,0,angle]
 return result,body,door,angle
poses=[]
for t in [0,.05,.45,.75,.83,.875,.9375,.95,1]:
 g,body,door,angle=pose(t);tag=str(t).replace('.','p')
 path=OUT/f'source-pose-{tag}.geo.json';path.write_text(json.dumps(g,indent=2)+'\n')
 texture=A/('textures/block/'+('stove' if t<.75 else 'stove_fire' if t<1 else 'stove_fire_0')+'.png')
 s=Scene(f'Source ignition {t}s versus baseline .45 static runtime')
 s.bedrock(path,texture,[-11,0,0],name='Source-equivalent Gecko 4.8.3 pose')
 s.bedrock(Path(__file__).parent/'baseline/stove.geo.json',texture,[11,0,0],name='Baseline .45 canonical static geometry')
 s.save(f'stove-source-pose-{tag}-vs-current.bbmodel')
 poses.append(dict(time=t,body_scale=body,door_scale=door,door_rotation_z=angle,texture=texture.name))
(OUT/'poses.json').write_text(json.dumps(poses,indent=2)+'\n')
print('Prepared',len(poses),'source-equivalent pose scenes. This preparation does not perform GUI checks.')
