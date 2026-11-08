#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Prepare comparison-only sheets by translation, without using the converter."""
import copy, hashlib, json, math, shutil, sys
from pathlib import Path
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent).resolve()
assert (ROOT / 'upstream/source.lock.json').is_file(), 'Run from the repository root or pass it as the first argument'
ASSETS = ROOT / 'upstream/reference/common/src/main/resources/assets/ordertocook'
RP = ROOT / 'runtime/RP'
manifest = {'runtime_changed': False, 'generated_review_layouts_not_runtime': True, 'asset_baseline_commit': '45e1a6d5a845174cfb8ff4be1a463abb4f3ac9d6', 'sheets': []}

def read(path): return json.loads(path.read_text())
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data,indent=2)+'\n')
def point(v,off): return [a+b for a,b in zip(v,off)]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def close(a,b):
 if isinstance(a,dict): return set(a)==set(b) and all(close(a[k],b[k]) for k in a)
 if isinstance(a,list): return len(a)==len(b) and all(close(x,y) for x,y in zip(a,b))
 if isinstance(a,(int,float)) and isinstance(b,(int,float)): return math.isclose(a,b,rel_tol=0,abs_tol=1e-12)
 return a==b

def offset_bones(original,prefix,off):
 bones=copy.deepcopy(original)
 for b in bones:
  assert not b.get('locators'), 'Explicitly handle locators before using this helper'
  b['name']=prefix+b['name']
  if 'parent' in b:b['parent']=prefix+b['parent']
  if 'pivot' in b:b['pivot']=point(b['pivot'],off)
  for c in b.get('cubes',[]):
   for key in ('origin','pivot'):
    if key in c:c[key]=point(c[key],off)
 # Independently reverse every layout-only edit and compare all fields.
 restored=copy.deepcopy(bones)
 for b in restored:
  b['name']=b['name'][len(prefix):]
  if 'parent' in b:b['parent']=b['parent'][len(prefix):]
  if 'pivot' in b:b['pivot']=point(b['pivot'],[-v for v in off])
  for c in b.get('cubes',[]):
   for key in ('origin','pivot'):
    if key in c:c[key]=point(c[key],[-v for v in off])
 assert close(restored,original)
 return bones

def bedrock_sheet(name,cases,columns,spacing,texture):
 bones=[];layout=[];dims=None
 for i,(label,path,mesh) in enumerate(cases):
  off=[(i%columns-(columns-1)/2)*spacing,0,(i//columns-(math.ceil(len(cases)/columns)-1)/2)*spacing]
  dim=[mesh['description']['texture_width'],mesh['description']['texture_height']]
  if dims is None:dims=dim
  assert dim==dims
  bones+=offset_bones(mesh['bones'],label+'__',off)
  layout.append({'label':label,'input':str(path.relative_to(ROOT)),'input_sha256':sha(path),'geometry':mesh['description']['identifier'],'offset':off})
 geo={'format_version':'1.21.0','minecraft:geometry':[{'description':{'identifier':'geometry.qa.'+name,'texture_width':dims[0],'texture_height':dims[1],'visible_bounds_width':32,'visible_bounds_height':8,'visible_bounds_offset':[0,0,0]},'bones':bones}]}
 path=OUT/'bedrock'/f'{name}.geo.json';write(path,geo)
 manifest['sheets'].append({'path':str(path.relative_to(OUT)),'sha256':sha(path),'texture':str(texture.relative_to(ROOT)),'texture_sha256':sha(texture),'cases':layout})

plates=RP/'models/entity/dining_plate.geo.json';meshes=read(plates)['minecraft:geometry']
assert len(meshes)==41
for start in range(1,41,8):
 stages=list(range(start,start+8));name=f'plate_stages_{start}_{start+7}'
 bedrock_sheet(name,[(f'stage_{s}',plates,meshes[s]) for s in stages],4,20,RP/'textures/ordertocook/entity/dining_plate_atlas.png')
 # Original Java model elements are only translated in x/z, not converted.
 combined={'credit':'QA layout only; original models by breezeth-CN/OrdertoCook, GPL-3.0-only','texture_size':[160,160],'textures':{'1':'ordertocook:block/food_plate_variants'},'elements':[]};layout=[]
 for i,s in enumerate(stages):
  src=ASSETS/f'models/block/food_plate_anim/{(s-1)//4+1}_{(s-1)%4+1}.json';model=read(src)
  assert model['textures']==combined['textures']
  assert model['texture_size']==[160,160] and not model.get('parent')
  off=[(i%4-1.5)*20,0,(i//4-.5)*20]
  for original in model['elements']:
   e=copy.deepcopy(original)
   for key in ('from','to'):e[key]=point(e[key],off)
   if 'rotation' in e:e['rotation']['origin']=point(e['rotation']['origin'],off)
   restored=copy.deepcopy(e)
   for key in ('from','to'):restored[key]=point(restored[key],[-v for v in off])
   if 'rotation' in restored:restored['rotation']['origin']=point(restored['rotation']['origin'],[-v for v in off])
   assert close(restored,original)
   combined['elements'].append(e)
  layout.append({'stage':s,'input':str(src.relative_to(ROOT)),'sha256':sha(src),'offset':off})
 path=OUT/'assets/ordertocook/models/block'/f'{name}.json';write(path,combined)
 manifest['sheets'].append({'path':str(path.relative_to(OUT)),'sha256':sha(path),'texture':'assets/ordertocook/textures/block/food_plate_variants.png','cases':layout})
tex=OUT/'assets/ordertocook/textures/block/food_plate_variants.png';tex.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ASSETS/'textures/block/food_plate_variants.png',tex)
assert sha(tex)==sha(RP/'textures/ordertocook/block/food_plate_variants.png')
orders=['order_machine_idle_0','order_machine_waiting_0']+[f'order_machine_printing_{i}' for i in range(16)]
for start in range(0,len(orders),6):
 cases=[]
 for n in orders[start:start+6]:
  p=RP/f'models/blocks/{n}.geo.json';cases.append((n,p,read(p)['minecraft:geometry'][0]))
 bedrock_sheet(f'orders_{start}_{start+len(cases)-1}',cases,3,26,RP/'textures/ordertocook/block/order_machine_geo.png')
bags=['takeout_bag']+[f'takeout_bag_{i}' for i in range(1,11)]
for start in range(0,len(bags),6):
 cases=[]
 for n in bags[start:start+6]:
  p=RP/f'models/blocks/{n}.geo.json';cases.append((n,p,read(p)['minecraft:geometry'][0]))
 bedrock_sheet(f'bags_{start}_{start+len(cases)-1}',cases,3,24,RP/'textures/ordertocook/block/takeout_bag_placed.png')
write(OUT/'layout-manifest.json',manifest)
print(f'Built {len(manifest["sheets"])} translation-only review sheets; every source element round-trip verified')
