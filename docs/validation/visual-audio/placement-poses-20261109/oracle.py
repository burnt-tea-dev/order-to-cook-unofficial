"""Independent bounded numeric oracle, never imports production or prior samplers.
Source transforms: pinned Gecko BakedModelFactory, RenderUtils, GeoRenderer.
No general Molang engine: the three exact registered clips are hand-stated below.
"""
from pathlib import Path
import math,json,copy,itertools,hashlib
ROOT=Path(__file__).resolve().parent
SRC=ROOT/'inputs/source'; RP=ROOT/'inputs/runtime/RP'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
FAMILY={'printer':'order_machine','bag':'takeout_bag_placed','plate':'food_plate_placed'}
ROOT_BONE={'printer':'order','bag':'group','plate':'group2'}
KEYS={'printer':[(0,.95),(.125,1.05),(.25,.95),(.375,1)],'bag':[(0,.85),(.1667,1.1),(.3333,.95),(.5,1)],'plate':[(0,.85),(.1667,1.05),(.3333,.95),(.5,1)]}
SCENES=[{'id':'01_printer_frame2','family':'printer','time':2/15,'frame':2}, {'id':'02_printer_frame4','family':'printer','time':4/15,'frame':4}, {'id':'03_bag_frame3','family':'bag','time':.1,'frame':3},{'id':'04_bag_frame7','family':'bag','time':.3,'frame':7},{'id':'05_plate_settled','family':'plate','time':.5},{'id':'06_plate_rebound','family':'plate','time':.1667}]
SIDES=['north','east','south','west','up','down']
# Source factory VertexSet order, not inferred from a converter's output.
BITS=[(0,0,0),(0,0,1),(0,1,0),(0,1,1),(1,1,0),(1,1,1),(1,0,0),(1,0,1)]
QUADS={'west':[3,2,0,1],'east':[4,5,7,6],'north':[2,4,6,0],'south':[5,3,1,7],'up':[3,5,4,2],'down':[0,6,7,1]}
def linear(keys,t):
 if t<=keys[0][0]:return keys[0][1]
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if t<=b:return x+(y-x)*(t-a)/(b-a)
 return keys[-1][1]
def stated_pose(f,t):
 end=.4167 if f=='printer' else .5;amp=5 if f=='printer' else 3
 p={'rotation':[0,0,amp*math.sin(math.radians(1000*t))*max(0,1-t/end)],'scale':[linear(KEYS[f],t)]*3}
 if f!='printer':p['position']=[0,.5*(1-min(t,.5)/.5),0]
 out={ROOT_BONE[f]:p}
 if f=='printer':out['group']={'position':[0,-2+9*min(t,1),-.75+3.75*min(t,1)]}
 return out

def verify_authored_contracts():
 for f,stem in FAMILY.items():
  clip=read(SRC/'animations'/f'{stem}.animation.json')['animations']['neworder' if f=='printer' else 'maked']
  root=ROOT_BONE[f];end='0.4167' if f=='printer' else '0.5';amp=5 if f=='printer' else 3
  expected={root:{'rotation':{'0.0':{'vector':[0,0,f'math.sin(query.anim_time * 1000) * {amp}']},end:{'vector':[0,0,0]}},'scale':{str(t):{'vector':[v]*3} for t,v in KEYS[f]}}}
  expected[root]['scale']['0.0']=expected[root]['scale'].pop('0')
  if f=='printer':expected['group']={'position':{'0.0':{'vector':[0,-2,-.75]},'1.0':{'vector':[0,7,3]}}}
  else:expected[root]['position']={'0.0':{'vector':[0,.5,0]},'0.5':{'vector':[0,0,0]}}
  assert clip['bones']==expected,(f,'source channels changed')
  assert clip['loop']=='hold_on_last_frame' and clip['animation_length']==(1 if f=='printer' else .5)
 return True

def runtime_plate_pose(t):
 # Read the actual RP channels, separate from the hand-stated source formulas.
 a=next(iter(read(RP/'animations/food_plate_placed.animation.json')['animations'].values()))
 assert a['anim_time_update']=="math.min(0.5, math.max(q.anim_time + q.delta_time, q.property('ordertocook:placement_age')))"
 def value(v):
  if isinstance(v,(float,int)):return v
  assert v=='math.sin(query.anim_time * 1000) * 3',v
  return 3*math.sin(t*1000/180*math.pi)
 result={}
 for bone,channels in a['bones'].items():
  result[bone]={}
  for ch,keys in channels.items():
   rows=sorted((float(k),v) for k,v in keys.items());ans=rows[-1][1]
   for (lo,lv),(hi,hv) in zip(rows,rows[1:]):
    if lo<=t<=hi:ans=[value(x)+(value(y)-value(x))*(t-lo)/(hi-lo) for x,y in zip(lv,hv)];break
   result[bone][ch]=[value(x) for x in ans]
 return result

def src_geo(f):return read(SRC/'geo/block'/f'{FAMILY[f]}.geo.json')['minecraft:geometry'][0]
def runtime_path(spec):
 f=spec['family']
 if f=='printer':return RP/'models/blocks'/f"order_machine_printing_{spec['frame']}.geo.json"
 if f=='bag':return RP/'models/blocks'/f"takeout_bag_{spec['frame']}.geo.json"
 return RP/'models/entity/dining_plate.geo.json'
def runtime_geo(spec):return read(runtime_path(spec))['minecraft:geometry'][0]
def reflect(v):return [-v[0],v[1],v[2]]
def angles(v):return [-v[0],-v[1],v[2]]
def ident():return [[float(i==j) for j in range(4)] for i in range(4)]
def mul(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def translation(p):
 m=ident()
 for i in range(3):m[i][3]=p[i]
 return m
def scale(v):
 m=ident()
 for i in range(3):m[i][i]=v[i]
 return m
def rotation(v):
 result=ident()
 # Rz Ry Rx, equivalent to Gecko's sequential PoseStack multiplication.
 for axis in (2,1,0):
  c=math.cos(math.radians(v[axis]));s=math.sin(math.radians(v[axis]));a,b=[(1,2),(2,0),(0,1)][axis];m=ident();m[a][a]=m[b][b]=c;m[a][b]=-s;m[b][a]=s;result=mul(result,m)
 return result
def compose(*args):
 m=ident()
 for a in args:m=mul(m,a)
 return m
def apply(m,p):return [sum(m[i][j]*p[j] for j in range(3))+m[i][3] for i in range(3)]
def pivot_matrix(p,r,s=(1,1,1),pos=(0,0,0)):return compose(translation(pos),translation(p),rotation(r),scale(s),translation([-x for x in p]))
def strict_inputs(g):
 for b in g['bones']:
  assert not b.get('mirror') and not b.get('inflate') and not b.get('reset')
  for c in b.get('cubes',[]):
   # All selected original/runtime inputs are explicit per-face UV, no mirrors,
   # inflation, Java element rescale or material overrides. Fail, never drop one.
   assert isinstance(c['uv'],dict) and not c.get('mirror') and not c.get('inflate') and not c.get('rescale') and c.get('shade',True)
   assert not c.get('material')
   for side,v in c['uv'].items():assert side in SIDES and not v.get('material_instance') and v.get('uv_rotation',0)==0

def physical(g,pose=None,parent_y=0):
 """Transform each original physical vertex through the complete source hierarchy."""
 strict_inputs(g);pose=pose or {};matrices={};out={}
 for b in g['bones']:
  p=reflect(b.get('pivot',[0,0,0]));a=pose.get(b['name'],{});r=[x+y for x,y in zip(b.get('rotation',[0,0,0]),a.get('rotation',[0,0,0]))]
  local=pivot_matrix(p,angles(r),a.get('scale',[1,1,1]),reflect(a.get('position',[0,0,0])))
  m=mul(matrices.get(b.get('parent'),translation([0,parent_y,0])),local);matrices[b['name']]=m
  for i,c in enumerate(b.get('cubes',[])):
   o=c['origin'];size=c['size'];lo=[-o[0]-size[0],o[1],o[2]]
   vertices=[[lo[k]+bits[k]*size[k] for k in range(3)] for bits in BITS]
   cm=mul(m,pivot_matrix(reflect(c.get('pivot',[0,0,0])),angles(c.get('rotation',[0,0,0]))))
   corners=[apply(cm,v) for v in vertices]
   faces={}
   for side,uv in c['uv'].items():
    u,v=uv['uv'];du,dv=uv['uv_size'];uvs=[[u+du,v],[u,v],[u,v+dv],[u+du,v+dv]]
    faces[side]=[{'corner_index':n,'position':corners[n],'uv':tex} for n,tex in zip(QUADS[side],uvs)]
   out[f"{b['name']}:{i}"]={'corners':corners,'faces':faces}
 return out

def compare(source,actual,allowed_y=0,atlas=(0,0),tol=3e-6):
 assert source.keys()==actual.keys(),('cube identity',source.keys(),actual.keys())
 maxerr=0;maxuv=0;miny=1e9;maxy=-1e9
 for key,s in source.items():
  a=actual[key];assert s['faces'].keys()==a['faces'].keys(),(key,'physical face identity')
  for p,q in zip(s['corners'],a['corners']):
   delta=[q[i]-p[i] for i in range(3)];miny=min(miny,delta[1]);maxy=max(maxy,delta[1]);maxerr=max(maxerr,max(abs(delta[i]-(allowed_y if i==1 else 0)) for i in range(3)))
  for side,face in s['faces'].items():
   for p,q in zip(face,a['faces'][side]):
    assert p['corner_index']==q['corner_index']
    maxuv=max(maxuv,max(abs(q['uv'][i]-p['uv'][i]-atlas[i]) for i in (0,1)))
 assert maxerr<=tol,('corner mismatch',maxerr,tol)
 assert maxuv<1e-10,('physical UV mismatch',maxuv)
 return {'max_corner_residual_modelpx':maxerr,'observed_y_delta_modelpx':[miny,maxy],'allowed_intentional_y_modelpx':allowed_y,'max_uv_residual_virtualpx':maxuv,'cube_count':len(source),'face_count':sum(len(c['faces']) for c in source.values())}

# Independent uniform-scale embedding for an editor without group scale.
# It does not generate expected oracle vertices or alter the input files.
def freeze_for_editor(g,pose):
 out=copy.deepcopy(g);by={b['name']:b for b in g['bones']};roots=[b for b in g['bones'] if 'parent' not in b];assert len(roots)==1
 root=roots[0];p=root['pivot'];a=pose.get(root['name'],{});sv=a.get('scale',[1,1,1]);assert max(sv)-min(sv)<1e-12;s=sv[0];shift=a.get('position',[0,0,0])
 def move(v,name):
  extra=[0,0,0]
  while name!=root['name']:
   x=pose.get(name,{});assert x.get('scale',[1,1,1])==[1,1,1] and x.get('rotation',[0,0,0])==[0,0,0]
   extra=[extra[i]+x.get('position',[0,0,0])[i] for i in range(3)];name=by[name]['parent']
  return [p[i]+s*(v[i]-p[i]+extra[i])+shift[i] for i in range(3)]
 for b in out['bones']:
  n=b['name'];b['pivot']=move(b.get('pivot',[0,0,0]),n);b['rotation']=[x+y for x,y in zip(b.get('rotation',[0,0,0]),pose.get(n,{}).get('rotation',[0,0,0]))]
  for c in b.get('cubes',[]):
   c['origin']=move(c['origin'],n);c['size']=[v*s for v in c['size']]
   # A rotated cube's pivot must follow the same scale+translation as its vertices.
   if 'pivot' in c or c.get('rotation'):c['pivot']=move(c.get('pivot',[0,0,0]),n)
 return out
