"""Read-only all-geometry coplanar positive-area candidate census. Not visibility acceptance."""
import json,sys,itertools,math,hashlib
from pathlib import Path
from collections import defaultdict,Counter
import numpy as np
ROOT=Path(sys.argv[1]);OUT=Path(sys.argv[2])
sys.path.insert(0,str(ROOT/'tools'));import convert_assets as conv
INDICES={'north':[0,2,6,4],'south':[1,5,7,3],'east':[0,1,3,2],'west':[4,6,7,5],'up':[2,3,7,6],'down':[0,4,5,1]}
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def area(p):return abs(sum(cross(p[i],p[(i+1)%len(p)]) for i in range(len(p))))/2 if len(p)>2 else 0
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
references={}
for p in (ROOT/'runtime').rglob('*.json'):
 if '/models/' not in str(p):references[str(p.relative_to(ROOT))]=p.read_text()
reports=[]
for path in sorted((ROOT/'runtime/RP/models').rglob('*.json')):
 for geo in json.loads(path.read_text()).get('minecraft:geometry',[]):
  name=geo['description']['identifier'];bones={b['name']:b for b in geo['bones']};faces=[];duplicates=[];sig={}
  for b in bones.values():
   for i,c in enumerate(b.get('cubes',[])):
    inf=c.get('inflate',b.get('inflate',0));o=np.array(c['origin'])-inf;sz=np.array(c['size'])+inf*2
    pts=[]
    for fs in itertools.product((0,1),repeat=3):
     p=o+sz*np.array(fs);p=conv.geometry_transform3(p,c.get('rotation',[0,0,0]),c.get('pivot',[0,0,0]));cur=b
     while True:
      p=conv.geometry_transform3(p,cur.get('rotation',[0,0,0]),cur.get('pivot',[0,0,0]))
      if 'parent' not in cur:break
      cur=bones[cur['parent']]
     pts.append(p)
    pts=np.array(pts);key=tuple(sorted(tuple(round(float(q),6) for q in p) for p in pts))
    if key in sig:duplicates.append([sig[key],[b['name'],i]])
    sig[key]=[b['name'],i]
    for face,ids in INDICES.items():
     uv=c.get('uv',{})
     if isinstance(uv,dict):
      if face not in uv:continue
      if 0 in uv[face].get('uv_size',[1,1]):continue
     p=pts[ids];n=np.cross(p[1]-p[0],p[2]-p[0]);norm=np.linalg.norm(n)
     if norm<1e-9:continue
     n/=norm;d=float(n@p[0]);
     if next((x for x in n if abs(x)>1e-8),0)<0:n=-n;d=-d
     faces.append({'bone':b['name'],'cube':i,'face':face,'p':p,'n':n,'d':d,'aabb':(p.min(0),p.max(0))})
  groups=defaultdict(list)
  for f in faces:groups[tuple(round(float(q),5) for q in (*f['n'],f['d']))].append(f)
  hits=[]
  for fs in groups.values():
   for a,b in itertools.combinations(fs,2):
    if a['bone']==b['bone'] and a['cube']==b['cube']:continue
    if np.max(abs((b['p']-a['p'][0])@a['n']))>1e-5:continue
    if np.any(np.minimum(a['aabb'][1],b['aabb'][1])+1e-8<np.maximum(a['aabb'][0],b['aabb'][0])):continue
    u=a['p'][1]-a['p'][0];u/=np.linalg.norm(u);v=np.cross(a['n'],u)
    project=lambda p:[np.array([np.dot(q-a['p'][0],u),np.dot(q-a['p'][0],v)]) for q in p]
    overlap=area(clip(project(a['p']),project(b['p'])))
    if overlap>1e-6:hits.append({'a':[a['bone'],a['cube'],a['face']],'b':[b['bone'],b['cube'],b['face']],'area':round(overlap,8)})
  reports.append({'path':str(path.relative_to(ROOT)),'id':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'references':[p for p,s in references.items() if '"'+name+'"' in s], 'cubes':sum(len(b.get('cubes',[])) for b in bones.values()),'faces':len(faces),'duplicates':duplicates,'coplanar':hits})
OUT.write_text(json.dumps({'geometry_count':len(reports),'file_count':len(set(x['path'] for x in reports)),'models':reports},indent=2)+'\n')
print('geometries',len(reports),'hits',sum(len(r['coplanar']) for r in reports),'with hits',sum(bool(r['coplanar']) for r in reports))
for r in reports:
 if r['coplanar'] and not any(k in r['path'] for k in ['refrigerator','dishwasher','stove_lit','dining_plate']): print(r['path'],len(r['coplanar']),'duplicate',r['duplicates'],'refs',r['references'])
