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

reports=[]
for idx,r in enumerate(BASE['models']):
 if not r['coplanar']:continue
 if r['id'] not in maps:reports.append({'id':r['id'],'unused':not r['references'],'unmapped':True,'pairs':len(r['coplanar'])});continue
 g=next(x for x in json.load(open(ROOT/r['path']))['minecraft:geometry'] if x['description']['identifier']==r['id'])
 for mi,m in enumerate(maps[r['id']]):
  allfaces=faces(g,m)
  vis=visibility.get(r['id'],{})
  for count in ([0,1,2,3] if any('block_state' in str(v) for v in vis.values()) else [None]):
   states={'ordertocook:plates':count or 0,'ordertocook:plates_high':0}
   visible_bones={b['name']:rv.expression(vis.get(b['name'],True),states) for b in g['bones']}
   for bone in g['bones']:
    parent=bone.get('parent')
    while parent:
     visible_bones[bone['name']] &= visible_bones[parent]
     parent=next(x for x in g['bones'] if x['name']==parent).get('parent')
   fs={k:v for k,v in allfaces.items() if visible_bones[k[0]]}
   for h in r['coplanar']:
    a,b=tuple(h['a']),tuple(h['b'])
    if a not in fs or b not in fs:continue
    q=pair(fs[a],fs[b],fs)
    reports.append({'id':r['id'],'material_variant':mi,'dish_count_tier':count,'a':a,'b':b,'area':h['area'],**q})
 if idx%30==0:print(idx,r['id'],flush=True)
args.output.write_text(json.dumps(reports,indent=2)+'\n')
print('records',len(reports),'unmapped',sum(x.get('unmapped',False) for x in reports))
for r in reports:
 if r.get('different_rgba',0) and r.get('visible_normal_samples',0) and r.get('same_normal'):
  if not any(s in r['id'] for s in ['refrigerator','dishwasher','dining_plate','food_plate_display','washingtable','plate_shelf','shelf_']):print(r['id'],r['a'],r['b'],r['different_rgba'],r['visible_normal_samples'],r['witness'])
