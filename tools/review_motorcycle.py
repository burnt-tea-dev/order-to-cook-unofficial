#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Prepare explicit physical-face source/candidate comparisons, without a GUI.
Original zero thickness and inflation are preserved. Blockbench's .001 plane
expansion is editor-only; explicit face UVs bypass its 1/64 box-UV inset.
These are static neutral fixtures, not native engine acceptance.
"""
import argparse, base64, json, math, sys, uuid
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO/'tests'))
from motorcycle_oracle import parse_java, add, jfaces, rpfaces, bbrect
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--geometry',type=Path,default=REPO/'runtime/RP/models/entity/motorcycle.geo.json')
p.add_argument('--comparison-label',default='CANDIDATE RP')
a=p.parse_args(); R=a.output; (R/'scenes').mkdir(parents=True,exist_ok=True)
def write(path,obj): path.write_text(json.dumps(obj,indent=2)+'\n')
source_path=REPO/'upstream/reference/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java'
J=parse_java(source_path.read_text())
geo=json.loads(a.geometry.read_text())
comparison_label=a.comparison_label
B={b['name']:b for b in geo['minecraft:geometry'][0]['bones']}
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'independent-motorcycle-20261109:'+s))
def offset(n):
 b=J[n];return add(b['offset'],offset(b['parent'])) if b['parent'] else b['offset']
for color,png in [('white','motorcycle.png'),('red','electric_motorcycle_red.png'),('blue','electric_motorcycle_blue.png'),('yellow','electric_motorcycle_yellow.png')]:
 sp=REPO/'upstream/reference/common/src/main/resources/assets/ordertocook/textures/entity'/png;rp=REPO/'runtime/RP/textures/ordertocook/entity'/png
 assert sp.read_bytes()==rp.read_bytes()
 d={'meta':{'format_version':'5.0','model_format':'free','box_uv':False},'name':color+' | JAVA SOURCE X-20 | '+comparison_label+' X+20','resolution':{'width':128,'height':128},'elements':[],'groups':[],'outliner':[],'textures':[{'name':png,'id':'0','uuid':uid(png),'width':128,'height':128,'uv_width':128,'uv_height':128,'render_mode':'default','render_sides':'auto','internal':True,'saved':True,'source':'data:image/png;base64,'+base64.b64encode(sp.read_bytes()).decode()}]}
 for source,dx,label in [(True,-20,'JAVA SOURCE'),(False,20,comparison_label)]:
  nodes={n:{'uuid':uid(color+label+n),'isOpen':False,'children':[]} for n in J}
  for n,jb in J.items():
   if source:
    p=offset(n);pivot=[p[0],24-p[1],p[2]];rx,ry,rz=jb['rotation'];rotation=[math.degrees(-rx),math.degrees(ry),math.degrees(-rz)]
   else:
    b=B[n];pivot=[-b['pivot'][0],*b['pivot'][1:]];rx,ry,rz=b.get('rotation',[0,0,0]);rotation=[-rx,-ry,rz]
   pivot[0]+=dx;d['groups'].append({'uuid':nodes[n]['uuid'],'name':label+' '+n,'origin':pivot,'rotation':rotation,'visibility':True,'export':True,'isOpen':False})
   if jb['parent']:nodes[jb['parent']]['children'].append(nodes[n])
   else:d['outliner'].append(nodes[n])
   for i,jc in enumerate(jb['cubes']):
    sz=jc['size'];inf=jc['inflate']
    if source:
     p=add(offset(n),jc['origin']);lo=[p[0],24-p[1]-sz[1],p[2]];faces=jfaces(jc)
    else:
     bc=B[n]['cubes'][i];lo=[-bc['origin'][0]-sz[0],*bc['origin'][1:]];faces=rpfaces(dict(bc, mirror=bc.get('mirror', B[n].get('mirror', False))))
    lo[0]+=dx;hi=add(lo,sz);cu=uid(color+label+n+'::cube:'+str(i));nodes[n]['children'].append(cu)
    d['elements'].append({'name':label+' '+n+' cube'+str(i),'uuid':cu,'type':'cube','box_uv':False,'autouv':0,'from':lo,'to':hi,'origin':[dx,0,0],'rotation':[0,0,0],'inflate':inf,'faces':{f:{'uv':bbrect(q),'texture':0,'rotation':0} for f,q in faces.items()},'visibility':True,'export':True})
 write(R/'scenes'/('motorcycle_'+color+'.bbmodel'),d)

# Retain ancestor groups for the three-box discrimination control.
d=json.loads((R/'scenes/motorcycle_white.bbmodel').read_text())
keep=[e for e in d['elements'] if any(e['name'].endswith(t) for t in [' body cube0',' chest cube2',' cube_r1 cube0'])]
ids={e['uuid'] for e in keep}; used=set()
def prune(nodes):
 out=[]
 for n in nodes:
  if isinstance(n,str):
   if n in ids: out.append(n)
  else:
   n['children']=prune(n['children'])
   if n['children']: out.append(n); used.add(n['uuid'])
 return out
d['elements']=keep;d['outliner']=prune(d['outliner']);d['groups']=[g for g in d['groups'] if g['uuid'] in used]
d['name']='CONTROL | JAVA SOURCE X-20 | '+comparison_label+' X+20'
write(R/'scenes/00_neutral_geometry_uv_control.bbmodel',d)
import hashlib
write(R/'manifest.json', {'source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
 'geometry_sha256':hashlib.sha256(a.geometry.read_bytes()).hexdigest(),
 'scope':'Static neutral model only. No native engine or GUI acceptance.',
 'editor_limits':'Authored zero width and inflation retained; editor .001 plane expansion is not native. Explicit UVs bypass box-UV 1/64 margin.',
 'scenes':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((R/'scenes').glob('*.bbmodel'))}})
print(R/'manifest.json')
