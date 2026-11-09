#!/usr/bin/env python3
"""Pure deterministic scene construction for the verifier. No writes or GUI."""
import base64,copy,json,uuid,struct
from pathlib import Path
import oracle as O
ROOT=O.ROOT
# A constant gray PNG only for the explicitly labelled reference slabs.
REFERENCE_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNoaGj4DwAFhAKAjM1mJgAAAABJRU5ErkJggg=='
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'otc-placement-review-20261109:'+s))
def encoded(x):return json.dumps(x,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
def png_size(b):assert b[:8]==b'\x89PNG\r\n\x1a\n';return list(struct.unpack('>II',b[16:24]))
def texture_paths(f):
 stem='order_machine_geo' if f=='printer' else O.FAMILY[f]
 src=O.SRC/'textures/block'/f'{stem}.png'
 rp=O.RP/('textures/ordertocook/entity/dining_plate_atlas.png' if f=='plate' else f'textures/ordertocook/block/{stem}.png')
 return src,rp

def make_scene(spec):
 sid=spec['id'];f=spec['family'];d={'meta':{'format_version':'5.0','model_format':'free','box_uv':False},'name':sid+' | SOURCE X-18 | RP X+18','resolution':{'width':64,'height':64},'elements':[],'groups':[],'outliner':[],'textures':[]}
 def texture(name,data):
  n=len(d['textures']);w,h=png_size(data)
  d['textures'].append({'name':name,'id':str(n),'uuid':uid(sid+':texture:'+str(n)),'width':w,'height':h,'uv_width':w,'uv_height':h,'render_mode':'default','render_sides':'double','internal':True,'saved':True,'source':'data:image/png;base64,'+base64.b64encode(data).decode()});return n
 tex=[texture(label+' '+p.name,p.read_bytes()) for label,p in zip(['SOURCE','RP'],texture_paths(f))]
 def group(name,p,r,parent,key):
  u=uid(sid+key);d['groups'].append({'uuid':u,'name':name,'origin':p,'rotation':r,'visibility':True,'export':True,'isOpen':False});node={'uuid':u,'isOpen':False,'children':[]};(parent['children'] if parent else d['outliner']).append(node);return node
 def element(c,bone,parent,label,offset,n,description):
  o=c['origin'];s=c['size'];fr=[-o[0]-s[0]+offset[0],o[1]+offset[1],o[2]+offset[2]];to=[fr[i]+s[i] for i in range(3)];p=O.reflect(c.get('pivot',[0,0,0]));p=[p[i]+offset[i] for i in range(3)];faces={k:{'uv':[0,0,0,0],'texture':None,'rotation':0} for k in O.SIDES}
  for side,v in c['uv'].items():
   u,w=v['uv'];du,dv=v['uv_size'];uv=[u,w,u+du,w+dv]
   if side in ('up','down'):uv=uv[2:]+uv[:2]
   png=d['textures'][n];uv=[val*png['width' if i%2==0 else 'height']/description['texture_width' if i%2==0 else 'texture_height'] for i,val in enumerate(uv)]
   faces[side]={'uv':uv,'texture':n,'rotation':v.get('uv_rotation',0)}
  u=uid(sid+label+bone);e={'name':label+' '+bone,'uuid':u,'type':'cube','box_uv':False,'autouv':0,'from':fr,'to':to,'origin':p,'rotation':O.angles(c.get('rotation',[0,0,0])),'inflate':0,'faces':faces,'visibility':True,'export':True,'shade':True};d['elements'].append(e);parent['children'].append(u)
 for side,(label,offset) in enumerate([('SOURCE',[-18,0,0]),('RP',[18,.2 if f=='plate' else 0,0])]):
  is_src=side==0;g=O.src_geo(f) if is_src else O.runtime_geo(spec);pose=O.stated_pose(f,spec['time']) if is_src else O.runtime_plate_pose(spec['time']) if f=='plate' else {}
  frozen=O.freeze_for_editor(g,pose);O.strict_inputs(frozen)
  assembly=group(label+' | block-center origin | '+('Java Y=0' if is_src else 'helper Y=+.2' if f=='plate' else 'NORTH rotation=0'),offset,[0,0,0],None,label+'assembly');nodes={}
  for b in frozen['bones']:
   p=O.reflect(b.get('pivot',[0,0,0]));p=[p[i]+offset[i] for i in range(3)]
   nodes[b['name']]=group(label+' '+b['name'],p,O.angles(b.get('rotation',[0,0,0])),nodes.get(b.get('parent'),assembly),label+':'+b['name'])
   for ci,c in enumerate(b.get('cubes',[])):element(c,f"{b['name']}:{ci}",nodes[b['name']],label,offset,tex[side],g['description'])
 if f=='plate':
  ref=texture('REFERENCE gray | not game material',base64.b64decode(REFERENCE_PNG))
  for label,x in [('SOURCE',-18),('RP',18)]:
   g=group(label+' REFERENCE ONLY | top plane block-local Y=0',[x,0,0],[0,0,0],None,label+'reference')
   c={'origin':[-8,-.25,-8],'size':[16,.25,16],'uv':{k:{'uv':[0,0],'uv_size':[1,1]} for k in O.SIDES}}
   element(c,'REFERENCE Y=0',g,label,[x,0,0],ref,{'texture_width':1,'texture_height':1})
 return d
