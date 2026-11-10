# SPDX-License-Identifier: GPL-3.0-only
import json,sys,math,collections,itertools
from pathlib import Path
import numpy as np
from PIL import Image
import argparse
p=argparse.ArgumentParser(description='Finite UV/alpha coplanar review; not native or continuous-animation acceptance.')
p.add_argument('repo',type=Path);p.add_argument('census',type=Path);p.add_argument('output',type=Path)
args=p.parse_args();ROOT=args.repo.resolve()
sys.path.insert(0,str(ROOT/'tools'));import render_visual_review as rv
BASE=json.load(open(args.census))
terrain=json.load(open(ROOT/'runtime/RP/textures/terrain_texture.json'))['texture_data']
def terrainmat(m):
 out={}
 for key,val in m.items():
  p=terrain[val['texture']]['textures'];p=p[0] if isinstance(p,list) else p
  out[key]=(p+'.png',val.get('render_method','alpha_test'))
 return out
maps={};srcs={};visibility={}
for p in (ROOT/'runtime/BP/blocks').glob('*.json'):
 block=json.load(open(p))['minecraft:block'];base=block['components'];sets=[base]+[{**base,**x['components']} for x in block.get('permutations',[])]
 for comp in sets:
  if 'minecraft:geometry' in comp:
   g=comp['minecraft:geometry'];n=g if isinstance(g,str) else g['identifier']
   maps[n]=[terrainmat(comp['minecraft:material_instances'])];srcs[n]=str(p.relative_to(ROOT));visibility[n]=g.get('bone_visibility',{}) if isinstance(g,dict) else {}
  if 'minecraft:item_visual' in comp:
   i=comp['minecraft:item_visual'];g=i['geometry'];n=g if isinstance(g,str) else g['identifier'];maps[n]=[terrainmat(i['material_instances'])]
for folder,tag in [('entity','minecraft:client_entity'),('attachables','minecraft:attachable')]:
 for p in (ROOT/f'runtime/RP/{folder}').glob('*.json'):
  d=json.load(open(p))[tag]['description'];tx=d.get('textures',{})
  for k,g in d.get('geometry',{}).items():
   if 'motorcycle' in g:keys=['white','red','blue','yellow','light']
   elif k in tx:keys=[k]
   elif 'default' in tx:keys=['default']
   else:keys=list(tx)
   maps[g]=[{'*':(tx[x]+'.png','blend' if 'visor' in g else 'alpha_test')} for x in keys];srcs[g]=str(p.relative_to(ROOT))
texcache={}
def texture(m,key):
 t=m.get(key,m.get('*'));assert t is not None,(m,key)
 p,method=t
 if not (ROOT/'runtime/RP'/p).exists() and (ROOT/'runtime/RP'/p).with_suffix('.tga').exists():p=str(Path(p).with_suffix('.tga'))
 if p not in texcache:texcache[p]=np.array(Image.open(ROOT/'runtime/RP'/p).convert('RGBA'))
 return texcache[p],p,method

def faces(geo,materials,clip=None,seconds=0):
 bones={x['name']:x for x in geo['bones']};out={}
 for b in bones.values():
  chain=[b]
  while chain[-1].get('parent'):chain.append(bones[chain[-1]['parent']])
  for i,c in enumerate(b.get('cubes',[])):
   inf=c.get('inflate',b.get('inflate',0));o=np.array(c['origin'],float)-inf;s=np.array(c['size'],float)+2*inf
   lo=o;hi=o+s;x0,y0,z0=lo;x1,y1,z1=hi
   pts=np.array([[x1,y0,z0],[x1,y0,z1],[x1,y1,z0],[x1,y1,z1],[x0,y1,z0],[x0,y1,z1],[x0,y0,z0],[x0,y0,z1]])
   pts=rv.rotate(pts,c.get('rotation',[0,0,0]),c.get('pivot',[0,0,0]))
   for b1 in chain:
    tr=(clip or {}).get('bones',{}).get(b1['name'],{});pv=np.array(b1.get('pivot',[0,0,0]))
    pts=(pts-pv)*rv.sample(tr.get('scale'),seconds,[1,1,1])+pv
    pts=rv.rotate(pts,np.array(b1.get('rotation',[0,0,0]))+rv.sample(tr.get('rotation'),seconds,[0,0,0]),pv)+rv.sample(tr.get('position'),seconds,[0,0,0])
   pts[:,0]*=-1
   isbox=not isinstance(c.get('uv'),dict)
   if isbox:
    sys.path.insert(0,str(ROOT/'tests'));from motorcycle_oracle import rpfaces
    boxq=rpfaces(dict(c,mirror=c.get('mirror',b.get('mirror',False))))
    uvitems={f:{'uv':[0,0],'uv_size':[1,1]} for f in boxq}
   else:uvitems=c['uv']
   for f,uv in uvitems.items():
    if 0 in uv['uv_size']:continue
    p=pts[rv.FACE_INDICES[f]];n=np.cross(p[1]-p[0],p[2]-p[0]);norm=np.linalg.norm(n)
    if norm<1e-9:continue
    n/=norm
    # Winding here is outward after X reflection, including signed source coordinates.
    # Positive and zero-size runtime boxes keep winding normals; do not infer from centroid.
    t,path,method=texture(materials,uv.get('material_instance'));u,v=uv['uv'];du,dv=uv['uv_size']
    q=np.array([[u+du,v],[u,v],[u,v+dv],[u+du,v+dv]],float)
    if uv.get('uv_rotation'):q=np.roll(q,uv['uv_rotation']//90,axis=0)
    if isbox:q=np.array(boxq[f])[[2,3,1,0] if f in ['up','down'] else [1,0,2,3]]
    q*=np.array([t.shape[1]/geo['description']['texture_width'],t.shape[0]/geo['description']['texture_height']])
    # local [a,b] map from p0 along p1-p0 and p3-p0; same for UV
    edges=np.array([p[1]-p[0],p[3]-p[0]]).T;inv=np.linalg.pinv(edges)
    out[(b['name'],i,f)]={'p':p,'n':n,'q':q,'t':t,'tex':path,'method':method,'inv':inv,'edges':edges}
 return out

def color(F,P):
 ab=(P-F['p'][0])@F['inv'].T
 q=F['q'][0]+ab@np.array([F['q'][1]-F['q'][0],F['q'][3]-F['q'][0]])
 x=np.floor(q[:,0]).astype(int).clip(0,F['t'].shape[1]-1);y=np.floor(q[:,1]).astype(int).clip(0,F['t'].shape[0]-1)
 return F['t'][y,x],ab

def pair(A,B,fs):
 # Dense 64x64 samples within A intersect B, plus their four interior corner neighborhoods.
 # Sampling is detection evidence, never proof of zero opaque overlap.
 rng=(np.arange(64)+.371)/64
 grid=np.array(list(itertools.product(rng,rng)))
 pts=A['p'][0]+grid@A['edges'].T
 ca,aa=color(A,pts);cb,ab=color(B,pts)
 mask=(ab.min(1)>1e-7)&(ab.max(1)<1-1e-7)
 pts=pts[mask];ca=ca[mask];cb=cb[mask]
 if not len(pts):return {'samples':0}
 same=A['n']@B['n']>.999
 both=(ca[:,3]>0)&(cb[:,3]>0);diff=np.any(ca!=cb,axis=1)&both
 res={'samples':len(pts),'same_normal':bool(same),'both_nonzero':int(both.sum()),'different_rgba':int(diff.sum()),'a_alpha':sorted(set(map(int,ca[:,3]))),'b_alpha':sorted(set(map(int,cb[:,3]))),'texture_a':A['tex'],'texture_b':B['tex']}
 if both.any():
  targets=np.flatnonzero(diff if diff.any() else both);targets=targets[::max(1,len(targets)//64)][:64];P=pts[targets];D=A['n'];blocked=np.zeros(len(P),bool)
  for C in fs.values():
   if C is A or C is B:continue
   denom=C['n']@D
   if abs(denom)<1e-8:continue
   ts=(C['p'][0]-P)@C['n']/denom;I=P+ts[:,None]*D;cc,cd=color(C,I)
   blocked|=(ts>1e-5)&(cd.min(1)>1e-6)&(cd.max(1)<1-1e-6)&(cc[:,3]>0)
  res['visible_normal_samples']=int((~blocked).sum());res['tested_normal_samples']=len(P)
  if (~blocked).any():
   z=targets[np.flatnonzero(~blocked)[0]];res['witness']={'position':pts[z].tolist(),'a_rgba':ca[z].tolist(),'b_rgba':cb[z].tolist()}
 return res

def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def clip(p,c):
 if sum(cross(c[i],c[(i+1)%len(c)]) for i in range(len(c)))<0:c=c[::-1]
 for a,b in zip(c,c[1:]+c[:1]):
  if not p:return []
  out=[];prev=p[-1];dp=cross(b-a,prev-a)
  for cur in p:
   dc=cross(b-a,cur-a)
   if (dc>=-1e-8)!=(dp>=-1e-8):out.append(prev+(cur-prev)*dp/(dp-dc))
   if dc>=-1e-8:out.append(cur)
   prev,dp=cur,dc
  p=out
 return p

def scan(fs, limit_cross=False):
 res=[]
 for (ka,A),(kb,B) in itertools.combinations(fs.items(),2):
  if ka[:2]==kb[:2]:continue
  if limit_cross and ka[0].split('/')[0]==kb[0].split('/')[0]:continue
  if abs(A['n']@B['n'])<.999999999 or np.max(abs((B['p']-A['p'][0])@A['n']))>1e-6:continue
  u=A['p'][1]-A['p'][0];u/=np.linalg.norm(u);v=np.cross(A['n'],u)
  proj=lambda p:[np.array([(z-A['p'][0])@u,(z-A['p'][0])@v]) for z in p]
  p=clip(proj(A['p']),proj(B['p']));ar=abs(sum(cross(p[i],p[(i+1)%len(p)]) for i in range(len(p))))/2 if len(p)>2 else 0
  if ar>1e-6:res.append({'a':ka,'b':kb,'area':ar,**pair(A,B,fs)})
 return res
orig_numeric=rv.numeric
rv.numeric=lambda v,t:0.0 if isinstance(v,str) and v.startswith('-query.target_') else orig_numeric(v,t)
clips={}
for p in ['npc.animation.json','npc.transition.animation.json']:clips.update(json.load(open(ROOT/'runtime/RP/animations'/p))['animations'])
results=[]
for rig in ['customer','customer_slim']:
 g=json.load(open(ROOT/f'runtime/RP/models/entity/{rig}.geo.json'))['minecraft:geometry'][0];m=maps[g['description']['identifier']][0]
 for name,c in clips.items():
  dur=c['animation_length'];times=sorted(set([round(dur*x,6) for x in [0,.25,.5,.75,1]]+([4.0] if dur>=4 else [])))
  for t in times:
   fs=faces(g,m,c,t);pairs=scan(fs)
   good=[x for x in pairs if x.get('different_rgba') and x.get('visible_normal_samples') and x.get('same_normal')]
   results.append({'rig':rig,'clip':name,'seconds':t,'coplanar_pairs':len(pairs),'exposed_differing_same_facing':good})
   if good:print(rig,name,t,[(x['a'],x['b'],x['area']) for x in good],flush=True)
args.output.write_text(json.dumps({'scope':'5 fractional endpoint/quartile samples per15 customer clips plus4.0s wherein duration; both rigs; query.target_x/y_rotation fixed0. No native playback or continuous-time completeness. Constant catmullrom tracks follow repository prior oracle assumptions.','samples':results},indent=2)+'\n')
