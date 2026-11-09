"""Review-only static asset pairs. No client controller, state or material emulation."""
from pathlib import Path
import json,hashlib,math
from scene_lib import Scene,OUT
ROOT=Path(__file__).resolve().parents[5]
A=ROOT/'upstream/reference/common/src/main/resources/assets/ordertocook'
R=ROOT/'runtime/RP'
def read(p):return json.loads(p.read_text())
def pair(s,name,count,offset):
 texture=A/f'textures/block/{name}.png'
 # Inspect actual source NORTH binding and actual canonical block declaration,
 # rather than selecting a similarly named but unused asset.
 source_state=read(A/f'blockstates/{name}.json')
 state_key='papers' if name=='shelf' else 'plates'
 if count is None:
  source_models=[source_state['variants']['facing=north']['model']]
 else:
  active=[p for p in source_state['multipart'] if p['when'].get('facing')=='north' and (state_key not in p['when'] or p['when'][state_key]==str(count))]
  source_models=[p['apply']['model'] for p in active]
 expected=[name] if count is None else [name+'_idle']+([f'{name}_{count}'] if count else [])
 assert source_models==['ordertocook:block/'+m for m in expected]
 block=read(ROOT/f'runtime/BP/blocks/{name}.json')['minecraft:block']
 components=block['components'];geometry=components['minecraft:geometry']
 if count is not None:
  condition=(f"q.block_state('ordertocook:papers') == {count}" if name=='shelf' else f"(q.block_state('ordertocook:plates') + 16 * q.block_state('ordertocook:plates_high')) == {count}")
  variants=[v for v in block['permutations'] if v['condition']==condition];assert len(variants)==1
  geometry=variants[0]['components']['minecraft:geometry']
 f=name if count is None else f'{name}_{count}'
 assert geometry==read(R/f'models/blocks/{f}.geo.json')['minecraft:geometry'][0]['description']['identifier']
 tile='ordertocook_block_'+name
 assert all(m['texture']==tile for m in components['minecraft:material_instances'].values())
 formal=R/(read(R/'textures/terrain_texture.json')['texture_data'][tile]['textures']+'.png')
 assert formal.read_bytes()==texture.read_bytes()
 models=[name] if count is None else [name+'_idle']+([f'{name}_{count}'] if count else [])
 src=[offset[0]-11,offset[1],offset[2]]
 dst=[offset[0]+11,offset[1],offset[2]]
 for model in models:s.java(A/f'models/block/{model}.json',texture,src)
 f=name if count is None else f'{name}_{count}'
 s.bedrock(R/f'models/blocks/{f}.geo.json',texture,dst,name=f'Canonical {f}')
def same(a,b):
 if isinstance(a,dict):return a.keys()==b.keys() and all(same(a[k],b[k]) for k in a)
 if isinstance(a,list):return len(a)==len(b) and all(same(x,y) for x,y in zip(a,b))
 if isinstance(a,(float,int)) and isinstance(b,(float,int)):return math.isclose(a,b,rel_tol=0,abs_tol=1e-5)
 return a==b
def assert_pair(s,start,n,offset):
 left=s.j['elements'][start:start+n];right=s.j['elements'][start+n:]
 assert len(left)==len(right)
 for a,b in zip(left,right):
  for k in ['from','to']:assert [round(v+(22 if i==0 else 0),6) for i,v in enumerate(a[k])]==b[k]
  assert same(a['faces'],b['faces']) and same(a['rotation'],b['rotation'])
  if any(a['rotation']):assert [round(v+(22 if i==0 else 0),6) for i,v in enumerate(a['origin'])]==b['origin']
for name in ['chair','board','countertop']:
 s=Scene(name+' source and canonical');pair(s,name,None,[0,0,0]);n=len(read(A/f'models/block/{name}.json')['elements']);assert_pair(s,0,n,[0,0,0]);s.save(name+'.bbmodel')
for name,maximum in [('shelf',10),('plate_shelf',18)]:
 for first in range(0,maximum+1,3):
  counts=list(range(first,min(first+3,maximum+1)))
  s=Scene(f'{name} source and canonical counts '+','.join(map(str,counts)))
  for i,count in enumerate(counts):
   start=len(s.j['elements']);offset=[0,(i-(len(counts)-1)/2)*26,0]
   n=len(read(A/f'models/block/{name}_idle.json')['elements'])
   if count:n+=len(read(A/f'models/block/{name}_{count}.json')['elements'])
   pair(s,name,count,offset);assert_pair(s,start,n,offset)
  s.save(f'{name}-{counts[0]}-{counts[-1]}.bbmodel')
stove=read(Path(__file__).parent/'baseline/stove.block.json')['minecraft:block']
names=['stove','stove_fire']+[f'stove_fire_{i}' for i in range(4)]
for frame,name in enumerate(names):
 mats=stove['components']['minecraft:material_instances']
 if frame:
  variants=[p for p in stove['permutations'] if p['condition']==f"q.block_state('ordertocook:fire_frame') == {frame}"]
  assert len(variants)==1;mats=variants[0]['components']['minecraft:material_instances']
 assert all(m['texture']=='ordertocook_block_'+name for m in mats.values())
 source=A/f'textures/block/{name}.png';formal=R/f'textures/ordertocook/block/{name}.png';assert source.read_bytes()==formal.read_bytes()
 s=Scene(f'stove source and canonical texture frame {frame}');s.java(A/'models/block/stove.json',source,[-11,0,0]);s.bedrock(Path(__file__).parent/'baseline/stove.geo.json',formal,[11,0,0]);
 # Texture indices are distinct paths, but their embedded bytes match exactly.
 for e in s.j['elements'][len(s.j['elements'])//2:]:
  for f in e['faces'].values():
   if f['texture'] is not None:f['texture']=0
 s.j['textures']=s.j['textures'][:1]
 assert_pair(s,0,len(read(A/'models/block/stove.json')['elements']),[0,0,0]);s.save(f'stove-{frame}-{name}.bbmodel')
# Manual helmet item only. +24 head translation is removed from the canonical
# preview to compare authored local shapes; this does not exercise head binding.
helmet=read(A/'models/item/helmet.json')
attach=read(R/'attachables/helmet.attachable.json')['minecraft:attachable']['description']
texmap={}
for part,key in [('shell','#layer0'),('visor','#layer1')]:
 formal=R/(attach['textures'][part]+'.png')
 source=A/('textures/'+helmet['textures'][key[1:]].split(':',1)[1]+'.png')
 assert source.read_bytes()==formal.read_bytes();texmap[key]=source
s=Scene('helmet authored local shape and canonical attachment minus 24y')
s.java(A/'models/item/helmet.json',texmap,[-11,0,0]);n=len(s.j['elements'])
for part,key in [('shell','#layer0'),('visor','#layer1')]:
 s.bedrock(R/f'models/entity/helmet_{part}.geo.json',texmap[key],[11,-24,0],name='Canonical '+part+' translated -24y')
# Match shape/face records independently of source element ordering. Ignore
# inactive rotation pivots because they do not affect vertex positions.
def normalized(e,dx):
 d={k:e[k] for k in ['from','to','faces','rotation']}
 for k in ['from','to']:d[k]=[round(v+(dx if i==0 else 0),5) for i,v in enumerate(d[k])]
 if any(e['rotation']):d['origin']=[round(v+(dx if i==0 else 0),5) for i,v in enumerate(e['origin'])]
 return json.dumps(d,sort_keys=True)
assert sorted(normalized(e,22) for e in s.j['elements'][:n])==sorted(normalized(e,0) for e in s.j['elements'][n:])
assert n==20 and len(s.j['elements'])==40
s.save('helmet-shell-and-visor.bbmodel')
print('Prepared',len(list(OUT.glob('*.bbmodel'))),'static scenes; this preparation does not perform GUI checks.')
