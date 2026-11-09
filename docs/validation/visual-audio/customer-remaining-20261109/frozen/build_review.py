#!/usr/bin/env python3
"""Strict, source-pinned static review snapshots. Never imports production tools."""
from pathlib import Path
import json, math, copy, hashlib, uuid, base64, subprocess
ROOT=Path(__file__).resolve().parent
INPUT=ROOT/'inputs'; A=INPUT/'upstream/reference/common/src/main/resources/assets/ordertocook'
def read(p):return json.loads(p.read_text())
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'otc-customer-remaining-review:'+s))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
SAMPLES=[{'id': '01_slim_sit1_counterphase', 'rig': 'slim', 'clip': 'customer_sit_1', 'time': 0.75, 'why': 'Exact opposite arm/foot phase to the earlier slim 1.5 sample: right arm -20, left arm -10; right foot 50 at Z -.75, left foot 30 at Z -.25.'}, {'id': '02_wide_wait1_phase0', 'rig': 'wide', 'clip': 'customer_wait_1', 'time': 0.0, 'why': 'Previously unsampled standing idle1 family: asymmetric arms -10/-20 and body Y -2 with undeformed standing legs, not a neutral-rig duplicate.'}, {'id': '03_slim_sit2_head_query', 'rig': 'slim', 'clip': 'customer_sit_2', 'time': 0.375, 'query': {'target_x_rotation': 15, 'target_y_rotation': -30}, 'why': 'Previously unsampled idle2 head-only query [-15,30,0]; symmetric midpoint arms/feet isolate head-local rotation from the already reviewed idle3 whole-body query. Synthetic inputs, not native look-at.'}, {'id': '04_wide_wait4_yaw', 'rig': 'wide', 'clip': 'customer_wait_4', 'time': 3.7778, 'why': 'Previously unsampled standing idle4 and late head yaw -20; wrist has returned to zero. Distinct from seated slim 1.3333 wrist/pitch extreme.'}, {'id': '05_wide_eat_left_wrist', 'rig': 'wide', 'clip': 'npc_eat&scale', 'time': 4.0, 'why': 'Left wrist +52.5 degrees at [.75,1.5,0], rather than prior slim right-wrist peak. Wide sleeve/left-hand overlap with the preserved full seated hierarchy.'}, {'id': '06_slim_sittake_phase0', 'rig': 'slim', 'clip': 'npc_sittake', 'time': 0.0, 'why': 'Slim early take with maximum two-arm splay and foot phase30/50. Arms repeat at 1.0, but earlier 1.0 was wide and feet differ. Retained to compare directly with the next same-rig phase.'}, {'id': '07_slim_sittake_phase05', 'rig': 'slim', 'clip': 'npc_sittake', 'time': 0.5, 'why': 'Slim opposite early take arm splay with foot phase43.3333/36.6667; pair with scene06 shows the small arm/foot phase change without claiming playback.'}]

def ev(v,t,q):
 if isinstance(v,(float,int)):return float(v)
 if v=='-query.target_x_rotation':return -q['target_x_rotation']
 if v=='-query.target_y_rotation':return -q['target_y_rotation']
 if v=='-math.sin(q.anim_time * 3000) * 3':return -math.sin(math.radians(t*3000))*3
 if v=='math.cos(q.anim_time * 2000) * 3':return math.cos(math.radians(t*2000))*3
 raise ValueError('Unsupported Molang, no default value: '+repr(v))
def vec(x):
 while isinstance(x,dict) and 'vector'in x:x=x['vector']
 if not isinstance(x,list) or len(x)!=3:raise ValueError(x)
 return x

def frames(ch,source):
 if isinstance(ch,list) or 'vector' in ch:return [(0,vec(ch),vec(ch))]
 out=[]
 for k,v in ch.items():
  t=float(k)
  if isinstance(v,dict) and ('pre'in v or 'post'in v):
   if source:
    if 'pre'in v:out.append((t-.001 if t else t,vec(v['pre']),vec(v['pre'])))
    if 'post'in v:out.append((t,vec(v['post']),vec(v['post'])))
   else:
    pre=vec(v.get('pre',v.get('post')));post=vec(v.get('post',v.get('pre')))
    out.append((t,pre,post))
  else:out.append((t,vec(v),vec(v)))
 out.sort(key=lambda x:x[0]);return out

def sample(ch,t,q,source):
 rows=frames(ch,source)
 if t<rows[0][0]:return [ev(x,t,q) for x in rows[0][1]]
 for i,(at,pre,post) in enumerate(rows):
  if t==at:return [ev(x,t,q) for x in post]
  if i+1<len(rows) and at<t<rows[i+1][0]:
   end,npre,_=rows[i+1];f=(t-at)/(end-at)
   return [ev(x,t,q)*(1-f)+ev(y,t,q)*f for x,y in zip(post,npre)]
 return [ev(x,t,q) for x in rows[-1][2]]

def load_clip(name,source):
 family='npc' if name.startswith('customer_') else 'npc.transition'
 path=A/'animations'/f'{family}.animation.json' if source else INPUT/'runtime/RP/animations'/f'{family}.animation.json'
 data=read(path)['animations'];key=name if source else ('animation.ordertocook.'+family.replace('.','_')+'.'+name.replace('&','_'))
 return data[key]
def geometry(rig,source):
 if source:p=A/'geo'/('drive_idle_alex.geo.json' if rig=='slim' else 'drive_idle.geo.json')
 else:p=INPUT/'runtime/RP/models/entity'/('customer_slim.geo.json' if rig=='slim' else 'customer.geo.json')
 return read(p)['minecraft:geometry'][0]
def posed_geo(g,pose):
 # All customer scale is uniform and lives on root body; static transformation is exact.
 out=copy.deepcopy(g);by={b['name']:b for b in out['bones']}
 root=by['body']['pivot'];s=pose.get('body',{}).get('scale',[1,1,1]);assert max(s)-min(s)<1e-12;s=s[0]
 root_pos=pose.get('body',{}).get('position',[0,0,0])
 def ancestors(n):
  names=[]
  while n:
   names.append(n);n=by[n].get('parent')
  return names
 def move(v,n):
  shifts=[pose.get(b,{}).get('position',[0,0,0]) for b in ancestors(n) if b!='body']
  return [root[i]+s*(v[i]-root[i]+sum(sh[i] for sh in shifts))+root_pos[i] for i in range(3)]
 for b in out['bones']:
  n=b['name'];assert not b.get('rotation')
  assert n=='body' or pose.get(n,{}).get('scale',[1,1,1])==[1,1,1]
  b['pivot']=move(b['pivot'],n);b['rotation']=pose.get(n,{}).get('rotation',[0,0,0])
  for c in b.get('cubes',[]):
   assert not c.get('rotation') and not c.get('rescale')
   c['origin']=move(c['origin'],n);c['size']=[x*s for x in c['size']]
   if 'inflate'in c:c['inflate']*=s
 return out

def scene(spec):
 sid=spec['id'];rig=spec['rig'];png=A/'textures/entity'/('otc_zombie_custom2.png' if rig=='slim' else 'otc_zombie_custom.png')
 d={'meta':{'format_version':'5.0','model_format':'free','box_uv':False},'name':sid+' | SOURCE X-20 | RP X+20','resolution':{'width':64,'height':64},'elements':[],'groups':[],'outliner':[],'textures':[{'name':png.name,'id':'0','uuid':uid(png.name),'width':64,'height':64,'uv_width':64,'uv_height':64,'render_mode':'default','render_sides':'auto','internal':True,'saved':True,'source':'data:image/png;base64,'+base64.b64encode(png.read_bytes()).decode()}]}
 evidence=[]
 for source,offset,label in [(True,-20,'SOURCE'),(False,20,'RP')]:
  clip=load_clip(spec['clip'],source);pose={b:{c:sample(ch,spec['time'],spec.get('query',{}),source) for c,ch in chs.items()} for b,chs in clip['bones'].items()};g=geometry(rig,source);pg=posed_geo(g,pose)
  decoded=json.loads(subprocess.check_output(['node',str(ROOT/'decode_cubes.cjs')],input=json.dumps(pg).encode()))
  bone_ids={b['name']:uid(sid+label+b['name']) for b in pg['bones']};nodes={b['name']:{'uuid':bone_ids[b['name']],'isOpen':False,'children':[]} for b in pg['bones']}
  for b in pg['bones']:
   d['groups'].append({'uuid':bone_ids[b['name']],'name':label+' '+b['name'],'origin':[-b['pivot'][0]+offset,b['pivot'][1],b['pivot'][2]],'rotation':[-b['rotation'][0],-b['rotation'][1],b['rotation'][2]],'visibility':True,'export':True,'isOpen':False})
   if 'parent'in b:nodes[b['parent']]['children'].append(nodes[b['name']])
   else:d['outliner'].append(nodes[b['name']])
  for c in decoded:
   cu=uid(sid+label+c['bone']+str(c['cube']));nodes[c['bone']]['children'].append(cu)
   e={'name':label+' '+c['bone']+' cube'+str(c['cube']),'uuid':cu,'type':'cube','box_uv':False,'autouv':0,'from':c['from'],'to':c['to'],'origin':c['origin'],'rotation':c['rotation'],'inflate':c['inflate'],'faces':c['faces'],'visibility':True,'export':True}
   for k in ['from','to','origin']:e[k][0]+=offset
   d['elements'].append(e)
  evidence.append({'side':label,'offset_x':offset,'sampled_bones':pose,'static_geo':pg})
 return d,evidence

def main():
 rows=[]
 for spec in SAMPLES:
  d,e=scene(spec);p=ROOT/'scenes'/(spec['id']+'.bbmodel');write(p,d);write(ROOT/'samples'/(spec['id']+'.json'),{'sample':spec,'sides':e})
  row={**spec,'path':str(p.relative_to(ROOT)),'sha256':sha(p),'status':'prepared, not GUI tested'}
  inputs=read(ROOT/'input-manifest.json')['files'];rig=spec['rig'];src='drive_idle_alex'if rig=='slim'else'drive_idle';dst='customer_slim'if rig=='slim'else'customer';png='otc_zombie_custom2.png'if rig=='slim'else'otc_zombie_custom.png'
  row['clock_scope']='Frozen local clip seconds; q.anim_time equals sample time only for evaluating authored expressions. Runtime anim_time_update/action_elapsed not evaluated.'
  row['query_inputs']={'q.anim_time':spec['time'],**{('query.'+k):v for k,v in spec.get('query',{}).items()}}
  row['scope']='prepared static cube snapshot, not Java renderer/Bedrock native output or GUI acceptance';row['sides']=[]
  for label,offset,geo,texture in [('SOURCE',-20,'upstream/reference/common/src/main/resources/assets/ordertocook/geo/'+src+'.geo.json','upstream/reference/common/src/main/resources/assets/ordertocook/textures/entity/'+png),('RP',20,'runtime/RP/models/entity/'+dst+'.geo.json','runtime/RP/textures/ordertocook/entity/'+png)]:
   row['sides'].append({'label':label,'offset_x':offset,'rig':rig,'geometry':geo,'geometry_sha256':inputs[geo]['sha256'],'skin':texture,'skin_sha256':inputs[texture]['sha256'],'physical_texture_dimensions':[64,64],'virtual_uv_dimensions':[64,64],'render_sides':'auto'})
  rows.append(row)
 write(ROOT/'scene-manifest.json',{'runtime_modified':False,'gui_run':False,'native_run':False,'snapshot_commit':read(ROOT/'input-manifest.json')['commit'],'main_commit_checked_locally':read(ROOT/'input-manifest.json')['main_commit_checked_locally'],'samples':rows,'freeze_note':'Scene bytes frozen before GUI handoff; later documentation does not regenerate or relabel them.'})
 print('Prepared',len(rows),'static comparison files, no GUI or runtime use.')
if __name__=='__main__':main()
