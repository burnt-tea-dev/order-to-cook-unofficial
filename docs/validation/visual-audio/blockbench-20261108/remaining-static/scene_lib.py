"""Review-only Blockbench projects. No runtime files are modified or exported.
The Bedrock decode follows Blockbench 5.2.2's I6/D6 codec transforms.
"""
import json,base64,uuid,copy,itertools
SEQ=itertools.count()
from pathlib import Path
from PIL import Image
OUT=Path(__file__).parent/'scenes';OUT.mkdir(exist_ok=True)
SIDES=['north','east','south','west','up','down']
def uid():return str(uuid.uuid5(uuid.NAMESPACE_URL,'otc-washing-review:'+str(next(SEQ))))
def read(p):return json.loads(p.read_text())
class Scene:
 def __init__(self,name):self.j={'meta':{'format_version':'5.0','model_format':'free','box_uv':False},'name':name,'resolution':{'width':128,'height':128},'elements':[],'groups':[],'outliner':[],'textures':[]};self.tex={}
 def texture(self,path):
  if str(path) in self.tex:return self.tex[str(path)]
  i=len(self.j['textures']);w,h=Image.open(path).size; self.tex[str(path)]=i
  self.j['textures'].append({'name':path.name,'id':str(i),'uuid':uid(),'width':w,'height':h,'uv_width':w,'uv_height':h,'render_mode':'default','render_sides':'front','internal':True,'saved':True,'source':'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()});return i
 def group(self,name,origin=[0,0,0],rotation=[0,0,0],parent=None):
  u=uid();self.j['groups'].append({'name':name,'uuid':u,'origin':origin,'rotation':rotation,'visibility':True,'export':True,'isOpen':False});node={'uuid':u,'isOpen':False,'children':[]}; (parent['children'] if parent else self.j['outliner']).append(node);return node
 def cube(self,name,fr,to,faces,origin,rotation,parent):
  u=uid();allfaces={side:{'uv':[0,0,0,0],'texture':None} for side in SIDES};allfaces.update(faces)
  self.j['elements'].append({'name':name,'uuid':u,'type':'cube','box_uv':False,'from':fr,'to':to,'origin':origin,'rotation':rotation,'autouv':0,'faces':allfaces,'visibility':True});parent['children'].append(u)
 def bedrock(self,path,texture,offset=[0,0,0],yaw=0,parent=None,name='canonical'):
  g=read(path)['minecraft:geometry'][0];texmap=texture if isinstance(texture,dict) else {'*':texture};group=self.group(name,offset,[0,yaw,0],parent);nodes={}
  def add(v):return [v[i]+offset[i] for i in range(3)]
  for b in g['bones']:
   assert not b.get('mirror') and not b.get('inflate');assert not b.get('parent') or b['parent'] in nodes
   p=b.get('pivot',[0,0,0]);r=b.get('rotation',[0,0,0]);node=self.group(b['name'],add([-p[0],p[1],p[2]]),[-r[0],-r[1],r[2]],nodes.get(b.get('parent'),group));nodes[b['name']]=node
   for n,c in enumerate(b.get('cubes',[])):
    assert isinstance(c['uv'],dict) and not c.get('inflate') and not c.get('mirror')
    o=c['origin'];z=c['size'];fr=[-o[0]-z[0],o[1],o[2]];to=[fr[i]+z[i] for i in range(3)];p=c.get('pivot',[0,0,0]);r=c.get('rotation',[0,0,0]);faces={}
    for side,f in c['uv'].items():
     path=texmap.get(f.get('material_instance'),texmap.get('*'));assert path is not None
     tex=self.texture(path);w,h=Image.open(path).size;d=g['description']
     a,bv=f['uv'];du,dv=f['uv_size'];uv=[a,bv,a+du,bv+dv];uv=[n*[w/d['texture_width'],h/d['texture_height']][i%2] for i,n in enumerate(uv)]
     if side in ('up','down'):uv=uv[2:]+uv[:2]
     faces[side]={'uv':uv,'texture':tex,'rotation':f.get('uv_rotation',0)}
    self.cube(b['name']+'_'+str(n),add(fr),add(to),faces,add([-p[0],p[1],p[2]]),[-r[0],-r[1],r[2]],node)
 def java(self,path,texture,offset=[0,0,0]):
  j=read(path);assert not j.get('parent');texmap=texture if isinstance(texture,dict) else {'*':texture};group=self.group('Java authored '+path.stem,offset)
  def add(v):return [v[i]+offset[i]+(-8 if i!=1 else 0) for i in range(3)]
  for n,e in enumerate(j['elements']):
   r=e.get('rotation',{});assert not r.get('rescale');rot=[0,0,0];rot['xyz'.index(r.get('axis','y'))]=r.get('angle',0)
   faces={}
   for side,f in e['faces'].items():
    texture_path=texmap.get(f['texture'],texmap.get('*'));assert texture_path is not None
    tex=self.texture(texture_path);w,h=Image.open(texture_path).size
    faces[side]={'uv':[x*([w,h][k%2]/16) for k,x in enumerate(f['uv'])],'texture':tex,'rotation':f.get('rotation',0)}
   self.cube('Java element '+str(n),add(e['from']),add(e['to']),faces,add(r.get('origin',[8,0,8])),rot,group)
 def save(self,name): (OUT/name).write_text(json.dumps(self.j,indent=2)+'\n')
