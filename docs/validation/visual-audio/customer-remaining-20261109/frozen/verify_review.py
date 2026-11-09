#!/usr/bin/env python3
"""Independent raw-timeline and hierarchical-matrix verification, no production imports."""
import json,hashlib,math,base64,subprocess,tempfile,shutil
from pathlib import Path
from decimal import Decimal as D
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent;INPUT=ROOT/'inputs';A=INPUT/'upstream/reference/common/src/main/resources/assets/ordertocook'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def unwrap(x):
 if isinstance(x,dict):
  if 'vector'in x:return unwrap(x['vector'])
  return {k:unwrap(v) for k,v in x.items()}
 if isinstance(x,list):return [unwrap(v) for v in x]
 return x

def evaluate(v,t,q):
 if isinstance(v,(float,int)):return D(str(v))
 if v.startswith('-query.target_'):return -D(str(q[v[7:]]))
 if v=='-math.sin(q.anim_time * 3000) * 3':return D(str(-math.sin(float(t)*math.pi/180*3000)*3))
 if v=='math.cos(q.anim_time * 2000) * 3':return D(str(math.cos(float(t)*math.pi/180*2000)*3))
 raise ValueError(v)
def oracle(track,t,q,java):
 t=D(str(t));track=unwrap(track)
 if isinstance(track,list):return np.array([float(evaluate(v,t,q)) for v in track])
 if java:
  events=[]
  for key,value in track.items():
   at=D(key)
   if isinstance(value,list):events.append((at,value))
   else:
    if 'pre'in value:events.append((at-D('.001') if at else at,value['pre']))
    if 'post'in value:events.append((at,value['post']))
  events.sort();left=events[0];right=events[-1]
  if t<=left[0]:return np.array([float(evaluate(v,t,q)) for v in left[1]])
  if t>=right[0]:return np.array([float(evaluate(v,t,q)) for v in right[1]])
  for i in range(1,len(events)):
   if t<events[i][0]:left,right=events[i-1],events[i];break
  k=(t-left[0])/(right[0]-left[0])
  return np.array([float(evaluate(a,t,q)+(evaluate(b,t,q)-evaluate(a,t,q))*k) for a,b in zip(left[1],right[1])])
 # RP input: outgoing post, incoming pre at same native timestamp.
 keys=sorted(track,key=D)
 def incoming(k):v=track[k];return v if isinstance(v,list) else (v['pre'] if 'pre' in v else v['post'])
 def outgoing(k):v=track[k];return v if isinstance(v,list) else (v['post'] if 'post' in v else v['pre'])
 if t<D(keys[0]):return np.array([float(evaluate(v,t,q)) for v in incoming(keys[0])])
 for k in keys:
  if t==D(k):return np.array([float(evaluate(v,t,q)) for v in outgoing(k)])
 if t>D(keys[-1]):return np.array([float(evaluate(v,t,q)) for v in outgoing(keys[-1])])
 l=sorted((k for k in keys if D(k)<t),key=D)[-1]
 r=sorted((k for k in keys if D(k)>t),key=D)[0];a=(t-D(l))/(D(r)-D(l))
 return np.array([float(evaluate(x,t,q)+(evaluate(y,t,q)-evaluate(x,t,q))*a) for x,y in zip(outgoing(l),incoming(r))])
def trans(v):m=np.eye(4);m[:3,3]=v;return m
def rotate(v):
 x,y,z=np.radians(v);cx,cy,cz=np.cos([x,y,z]);sx,sy,sz=np.sin([x,y,z])
 # Independent analytic ZYX matrix, as official BB default / Gecko RenderUtils.
 m=np.eye(4);m[:3,:3]=[[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],[sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],[-sy,cy*sx,cy*cx]];return m
def scale(v):return np.diag([*v,1])
def flip(v):return np.array(v)*[-1,1,1]
def src_world(g,pose):
 bones={b['name']:b for b in g['bones']};cache={}
 def mat(n):
  if n in cache:return cache[n]
  b=bones[n];pivot=flip(b['pivot']);p=b.get('parent');origin=pivot-flip(bones[p]['pivot']) if p else pivot
  anim=pose.get(n,{});m=trans(origin+flip(anim.get('position',[0,0,0])))@rotate(np.array(anim.get('rotation',[0,0,0]))*[-1,-1,1])@scale(anim.get('scale',[1,1,1]))
  cache[n]=(mat(p)@m) if p else m;return cache[n]
 out={}
 for b in g['bones']:
  for i,c in enumerate(b.get('cubes',[])):
   a=np.array(c['origin'],float);z=a+np.array(c['size']);inflate=c.get('inflate',0)
   xs=[-z[0]-inflate,-a[0]+inflate];ys=[a[1]-inflate,z[1]+inflate];zs=[a[2]-inflate,z[2]+inflate]
   out[(b['name'],i)]=np.array([(mat(b['name'])@np.array([x-flip(b['pivot'])[0],y-b['pivot'][1],z-b['pivot'][2],1]))[:3] for x in xs for y in ys for z in zs])
 return out

def bb_world(scene):
 groups={x['uuid']:x for x in scene['groups']};elements={x['uuid']:x for x in scene['elements']};out={}
 def walk(node,parent=None,world=None):
  g=groups[node['uuid']];origin=np.array(g['origin']);local=origin-(np.array(groups[parent]['origin']) if parent else 0);m=trans(local)@rotate(g['rotation']);m=(world@m) if world is not None else m
  for ch in node['children']:
   if isinstance(ch,dict):walk(ch,g['uuid'],m)
   else:
    e=elements[ch];a=np.array(e['from'])-e['inflate'];b=np.array(e['to'])+e['inflate'];assert e['rotation']==[0,0,0]
    out[e['name']]=np.array([(m@np.array([x-origin[0],y-origin[1],z-origin[2],1]))[:3] for x in [a[0],b[0]] for y in [a[1],b[1]] for z in [a[2],b[2]]])
 for n in scene['outliner']:walk(n)
 return out

def main():
 checks=0;manifest=read(ROOT/'input-manifest.json')
 for path,digest in read(ROOT/'scene-freeze-hashes.json').items():assert sha(ROOT/path)==digest
 for p,v in manifest['files'].items():
  data=(INPUT/p).read_bytes();assert sha(INPUT/p)==v['sha256'];assert len(data)==v['size'];assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==v['repo_git_blob'];checks+=1
 for r in read(ROOT/'source-evidence/gecko-cache-provenance.json')['records']:
  p=ROOT/'source-evidence'/Path(r['cachePath']).name
  if p.exists():data=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==r['blobSha'];checks+=1
 for p in ['cos','render']:
  r=read(ROOT/f'source-evidence/{p}-provenance.json');f=ROOT/'source-evidence'/r['display_title'];data=f.read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==r['sha'];checks+=1
 for row in read(ROOT/'source-evidence/input-upstream-provenance.json'):
  data=(INPUT/row['path']).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['blob'];checks+=1
 for row in read(ROOT/'official-provenance.json')['files'].values():assert sha(ROOT/row['path'])==row['sha256'];checks+=1
 for row in read(ROOT/'source-evidence/customer-provenance.json'):
  data=(ROOT/'source-evidence'/row['display_title']).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['sha'];checks+=1
 tracks=0;source_clips={};canon_clips={};warnings=[]
 for family in ['npc','npc.transition']:
  s=read(A/'animations'/f'{family}.animation.json')['animations'];c=read(INPUT/'runtime/RP/animations'/f'{family}.animation.json')['animations']
  for name,body in s.items():
   target=c['animation.ordertocook.'+family.replace('.','_')+'.'+name.replace('&','_')]
   assert unwrap(body['bones'])==target['bones'];assert body['animation_length']==target['animation_length'];assert 'easing'not in json.dumps(body)
   source_clips[name]=body;canon_clips[name]=target
   for bone,chs in body['bones'].items():
    for channel,track in chs.items():
     tracks+=1
     if 'catmullrom'in json.dumps(track):
      vals=[]
      for value in unwrap(track).values():
       if isinstance(value,dict):vals.append(value.get('post',value.get('pre')))
      assert all(v==vals[0] for v in vals);warnings.append([name,bone,channel])
 assert len(warnings)==18
 pngs=[]
 for rig,src,dst,png in [('wide','drive_idle','customer','otc_zombie_custom.png'),('slim','drive_idle_alex','customer_slim','otc_zombie_custom2.png')]:
  g=read(A/'geo'/f'{src}.geo.json')['minecraft:geometry'][0];c=read(INPUT/'runtime/RP/models/entity'/f'{dst}.geo.json')['minecraft:geometry'][0];assert g['bones']==c['bones'];assert len(g['bones'])==11
  p=A/'textures/entity'/png;assert p.read_bytes()==(INPUT/'runtime/RP/textures/ordertocook/entity'/png).read_bytes()
  im=Image.open(p);assert im.size==(64,64);alphas=im.convert('RGBA').getchannel('A');pngs.append({'rig':rig,'size':list(im.size),'alpha_values':sorted(set(np.asarray(alphas).flatten().tolist())),'sha256':sha(p)})
 rows=[];maxerr=0;points=0;channelerr=0;faces_checked=0;hierarchy_edges=0;group_pivot_error=0
 for row in read(ROOT/'scene-manifest.json')['samples']:
  p=ROOT/row['path'];assert sha(p)==row['sha256'];scene=read(p);stored=read(ROOT/'samples'/(row['id']+'.json'));world=bb_world(scene)
  assert len(scene['elements'])==40 and len(scene['groups'])==22 and len(scene['outliner'])==2 and len(scene['textures'])==1
  assert all(e['type']=='cube' and e['box_uv']==False and e['autouv']==0 for e in scene['elements'])
  assert 'animations'not in scene and 'animation_controllers'not in scene
  texture=scene['textures'][0];assert texture['render_sides']=='auto' and texture['render_mode']=='default';assert [texture[k] for k in ['width','height','uv_width','uv_height']]==[64,64,64,64]
  decoded=base64.b64decode(texture['source'].split(',',1)[1]);assert hashlib.sha256(decoded).hexdigest()==next(x['sha256'] for x in pngs if x['rig']==row['rig']);assert scene['resolution']=={'width':64,'height':64}
  allids=[x['uuid'] for x in scene['groups']+scene['elements']];assert len(set(allids))==62
  groupby={x['uuid']:x for x in scene['groups']};groupnames={x['name']:x for x in scene['groups']};parents={};children={}
  def topology(node,parent=None):
   name=groupby[node['uuid']]['name'];parents[name]=parent;children[name]=[]
   for ch in node['children']:
    if isinstance(ch,dict):topology(ch,name)
    else:children[name].append(ch)
  for node in scene['outliner']:topology(node)
  expected_order=[]
  for side in stored['sides']:
   java=side['side']=='SOURCE';clip=source_clips[row['clip']] if java else canon_clips[row['clip']]
   poses={b:{c:oracle(v,row['time'],row.get('query',{}),java).tolist() for c,v in chs.items()} for b,chs in clip['bones'].items()}
   for b,chs in poses.items():
    for c,v in chs.items():channelerr=max(channelerr,float(np.max(np.abs(np.array(v)-side['sampled_bones'][b][c]))))
   src='drive_idle_alex'if row['rig']=='slim'else'drive_idle';g=read(A/'geo'/f'{src}.geo.json')['minecraft:geometry'][0]
   # Independently decode face UV rectangles from original geometry, without
   # invoking parseCube, the builder, stored static geometry or sampled poses.
   label=side['side'];bones={b['name']:b for b in g['bones']};elements={x['name']:x for x in scene['elements']}
   assert poses.get('body',{}).get('scale',[1,1,1])==[1,1,1]
   for bone in g['bones']:
    name=bone['name'];group=groupnames[label+' '+name]
    assert parents[label+' '+name]==(label+' '+bone['parent'] if 'parent'in bone else None);hierarchy_edges+=int('parent'in bone)
    chain=[];at=name
    while at:chain.append(at);at=bones[at].get('parent')
    pivot=np.array(bone['pivot'],float)+sum((np.array(poses.get(n,{}).get('position',[0,0,0])) for n in chain),np.zeros(3))
    expected_pivot=flip(pivot)+[side['offset_x'],0,0];group_pivot_error=max(group_pivot_error,float(np.max(np.abs(expected_pivot-group['origin']))))
    assert np.max(np.abs(np.array(group['rotation'])-np.array(poses.get(name,{}).get('rotation',[0,0,0]))*[-1,-1,1]))<1e-10
    assert group['visibility'] is True and group['export'] is True
    expected_children=[]
    for i,cube in enumerate(bone.get('cubes',[])):
     ename=f'{label} {name} cube{i}';element=elements[ename];expected_order.append(ename);expected_children.append(element['uuid'])
     assert element['inflate']==cube.get('inflate',0) and element['rotation']==[0,0,0]
     assert element['visibility'] is True and element['export'] is True
     for face in ['north','east','south','west','up','down']:
      uv=cube.get('uv',{}).get(face)
      if uv:
       u,v=uv['uv'];du,dv=uv['uv_size'];rect=[u,v,u+du,v+dv]
       if face in ['up','down']:rect=rect[2:]+rect[:2]
       expected_face={'uv':rect,'rotation':uv.get('uv_rotation',0),'texture':0}
      else:expected_face={'uv':[0,0,0,0],'rotation':0,'texture':None}
      assert element['faces'][face]==expected_face,(row['id'],ename,face);faces_checked+=1
    assert children[label+' '+name]==expected_children
   # Runtime geometry was independently proved field-equal; verify input-specific snapshot too.
   expected=src_world(g,poses)
   for (b,i),corners in expected.items():
    actual=world[f"{side['side']} {b} cube{i}"]-np.array([side['offset_x'],0,0]);err=float(np.max(np.abs(actual-corners)));maxerr=max(maxerr,err);points+=len(corners)
   rows.append({'id':row['id'],'side':side['side'],'root_scale':poses.get('body',{}).get('scale',[1,1,1]),'root_rotation':poses.get('body',{}).get('rotation',[0,0,0])})
  assert [e['name'] for e in scene['elements']]==expected_order
 assert channelerr<1e-10 and maxerr<1e-10 and group_pivot_error<1e-10,(channelerr,maxerr,group_pivot_error)
 # The precise source pre/post discrepancy, independent Decimal equations.
 boom=[]
 for t in [5.8611,5.9,5.9157,5.9162,5.9167,6.0]:
  s=oracle(source_clips['npc_eat&boom']['bones']['body']['scale'],t,{},True)[0];c=oracle(canon_clips['npc_eat&boom']['bones']['body']['scale'],t,{},False)[0];boom.append({'seconds':t,'source_scale':s,'rp_json_scale':c})
 # Shrink curves are exact translated copies, avoiding redundant screenshots.
 shrink={};reference=None
 for name,start in [('npc_sittake',1.75),('npc_standtake',2.75),('npc_eat&scale',5.25),('npc_eat&scale_interrupt',.25)]:
  tr=unwrap(source_clips[name]['bones']['body']['scale']);normalized=[(str((D(t)-D(str(start))).normalize()),v) for t,v in tr.items() if D(t)>=D(str(start))]
  if reference is None:reference=normalized
  assert normalized==reference
  shrink[name]={'starts':start,'ends':source_clips[name]['animation_length'],'at_half_interval':oracle(source_clips[name]['bones']['body']['scale'],start+.125,{},True).tolist()}
 # Rebuild in isolated copy and compare exact bytes to detect hidden clock/UUID effects.
 with tempfile.TemporaryDirectory(prefix='otc-customer-reproduce-') as td:
  dest=Path(td)/'review';shutil.copytree(ROOT,dest);subprocess.run(['python','-B',str(dest/'build_review.py')],check=True,capture_output=True)
  assert (ROOT/'scene-manifest.json').read_bytes()==(dest/'scene-manifest.json').read_bytes()
  for directory in ['scenes','samples']:
   for p in (ROOT/directory).glob('*.json' if directory=='samples' else '*.bbmodel'):assert p.read_bytes()==(dest/directory/p.name).read_bytes()
 report={'status':'PASS offline/source-code-derived only','input_hash_checks':checks,'clips':len(source_clips),'bone_channel_tracks':tracks,'constant_catmullrom_tracks':len(warnings),'scene_count':len(read(ROOT/'scene-manifest.json')['samples']),'sampled_corner_comparisons':points,'max_corner_component_error_model_units':maxerr,'max_channel_error':channelerr,'max_group_pivot_error':group_pivot_error,'independently_checked_face_uv_records':faces_checked,'verified_parent_edges':hierarchy_edges,'cube_order_inflate_and_texture_bytes':'preserved','pngs':pngs,'boom_prepost':boom,'shared_shrink':shrink,'samples':rows,'fresh_process_reproduction':'byte-identical','gui_tested':False,'bedrock_native_tested':False,'java_native_tested':False}
 (ROOT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['samples','pngs']},indent=2))
if __name__=='__main__':main()
