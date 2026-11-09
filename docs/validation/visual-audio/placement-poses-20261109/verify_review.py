#!/usr/bin/env python3
"""Readonly verifier: no output files, caches, imports of production, GUI or network.
Run: python -B verify_review.py (optional shell redirection for a report).
Requires Python3, Pillow, Node for the exact official Blockbench parseCube harness.
"""
import sys
sys.dont_write_bytecode=True
import json,base64,copy,io,subprocess,hashlib
from PIL import Image
import oracle as O
import build_review as B
from verify_integrity import check_public_integrity
R=O.ROOT

def scene_physical(d,label,offset):
 groups={g['uuid']:g for g in d['groups']};parent={}
 def walk(nodes,p=None):
  for n in nodes:
   if isinstance(n,str):parent[n]=p
   else:parent[n['uuid']]=p;walk(n['children'],n['uuid'])
 walk(d['outliner']);out={}
 for e in d['elements']:
  if not e['name'].startswith(label+' ') or 'REFERENCE' in e['name']:continue
  m=O.pivot_matrix(e['origin'],e['rotation']);p=parent[e['uuid']]
  while p:
   g=groups[p];m=O.mul(O.pivot_matrix(g['origin'],g['rotation']),m);p=parent[p]
  corners=[]
  for bits in O.BITS:
   v=[e['from'][i] if bits[i]==0 else e['to'][i] for i in range(3)];v=O.apply(m,v);v=[v[i]-offset[i] for i in range(3)];corners.append(v)
  faces={}
  for side,f in e['faces'].items():
   if f['texture'] is None:continue
   uv=f['uv'];uv=uv[2:]+uv[:2] if side in ('up','down') else uv;u,v,U,V=uv
   uvs=[[U,v],[u,v],[u,V],[U,V]];faces[side]=[{'corner_index':idx,'position':corners[idx],'uv':x} for idx,x in zip(O.QUADS[side],uvs)]
  out[e['name'].removeprefix(label+' ')]={'corners':corners,'faces':faces}
 return out

def rejected(name,fn):
 try:fn()
 except (AssertionError,ValueError) as e:return {'mutation':name,'detected':True,'reason':str(e)[:200]}
 raise AssertionError('Negative mutation was not detected: '+name)

def check_bindings():
 terrain=O.read(O.RP/'textures/terrain_texture.json')['texture_data'];rows={}
 for f,block,alias in [('printer','order_machine','ordertocook_block_order_machine_geo'),('bag','takeout_bag','ordertocook_block_takeout_bag_placed')]:
  b=O.read(R/'inputs/runtime/BP/blocks'/f'{block}.json')['minecraft:block'];base=b['components'];assert base['minecraft:material_instances']['*']['texture']==alias
  north=[p for p in b['permutations'] if p['condition']=="q.block_state('minecraft:cardinal_direction') == 'north'"];assert len(north)==1 and north[0]['components']['minecraft:transformation']['rotation']==[0,0,0]
  target=terrain[alias]['textures'];assert target=='textures/ordertocook/block/'+('order_machine_geo' if f=='printer' else 'takeout_bag_placed');assert (O.RP/(target+'.png')).read_bytes()==B.texture_paths(f)[0].read_bytes()
  for spec in [s for s in O.SCENES if s['family']==f]:
   suffix=f" && q.block_state('ordertocook:frame') == {spec['frame']}" if f=='printer' else ''
   cond=("q.block_state('ordertocook:mode') == 'printing'"+suffix) if f=='printer' else f"q.block_state('ordertocook:frame') == {spec['frame']}"
   perm=[p for p in b['permutations'] if p['condition']==cond];assert len(perm)==1 and perm[0]['components']['minecraft:geometry']==O.runtime_geo(spec)['description']['identifier']
  rows[f]={'north_rotation':[0,0,0],'terrain_alias':alias,'texture':target,'material':base['minecraft:material_instances']['*'],'original_png_bytes_identical':True}
 c=O.read(O.RP/'entity/dining_plate.entity.json')['minecraft:client_entity']['description'];rc=O.read(O.RP/'render_controllers/dining_plate.render_controllers.json')['render_controllers']['controller.render.ordertocook.dining_plate']
 assert c['geometry']['stage0']=='geometry.ordertocook.dining_plate_0' and c['textures']['default']=='textures/ordertocook/entity/dining_plate_atlas' and c['materials']['default']=='entity_alphatest'
 assert c['scripts']['animate']==[{'placed':"q.property('ordertocook:stage') == 0"}] and c['animations']['placed']=='animation.ordertocook.food_plate_placed.maked'
 assert rc['geometry']=="Array.stages[q.property('ordertocook:stage')]" and rc['arrays']['geometries']['Array.stages'][0]=='Geometry.stage0'
 assert rc['textures']==['Texture.default'] and rc['materials']==[{'*':'Material.default'}]
 bp=O.read(R/'inputs/runtime/BP/entities/dining_plate.json')['minecraft:entity'];assert bp['description']['identifier']=='ordertocook:dining_plate'
 assert bp['description']['properties']['ordertocook:stage']['client_sync'] and bp['description']['properties']['ordertocook:placement_age']['client_sync']
 assert bp['description']['properties']['ordertocook:placement_age']['range']==[0,.5] and 'minecraft:scale' not in bp['components']
 dining=(R/'inputs/runtime/BP/scripts/dining.js').read_text();assert 'y: location.y + 0.0125' in dining and 'rotationY: yaw + 180' in dining and 'Math.min(0.5, Math.max(0, ticks / 20))' in dining
 src,atlas=[Image.open(p).convert('RGBA') for p in B.texture_paths('plate')];assert src.size==(32,32) and atlas.size==(256,256);assert src.tobytes()==atlas.crop((2,2,34,34)).tobytes()
 rows['plate']={'geometry':'geometry.ordertocook.dining_plate_0','material':'entity_alphatest','atlas_virtual_dimensions':[256,256],'atlas_png_dimensions':[256,256],'source_virtual_dimensions':[32,32],'source_png_dimensions':[32,32],'atlas_tile_box_pixels':[2,2,34,34],'entire_tile_RGBA_identical':True,'helper_offset_modelpx':.2,'yaw_contract':'saved customer yaw + 180; scene chooses model-local zero, native actor yaw NOT proved'}
 return rows

def controls():
 out={'printer':{},'bag':{}}
 for t,s in [(.125,1.05),(.25,.95),(.375,1),(.4167,1),(1,1)]:
  p=O.stated_pose('printer',t);assert p['order']['scale']==[s]*3
  if t>=.4167:assert p['order']['rotation']==[0,0,0]
  out['printer'][str(t)]=p
 for t,s in [(.1667,1.1),(.3333,.95),(.5,1)]:
  p=O.stated_pose('bag',t);assert abs(p['group']['scale'][0]-s)<1e-12;out['bag'][str(t)]=p
 assert O.stated_pose('printer',1)['group']['position']==[0,7,3]
 assert O.stated_pose('bag',.5)=={'group':{'rotation':[0,0,0],'scale':[1,1,1],'position':[0,0,0]}}
 # Idle uses rest pose + renderer paper suppression, not neworder t=0.
 g=O.src_geo('printer');g['bones']=[b for b in g['bones'] if b['name']!='group'];idle=O.read(O.RP/'models/blocks/order_machine_idle_0.geo.json')['minecraft:geometry'][0]
 out['printer']['idle_no_paper']=O.compare(O.physical(g),O.physical(idle))
 wait=O.read(O.RP/'models/blocks/order_machine_waiting_0.geo.json')['minecraft:geometry'][0]
 out['printer']['waiting_paper_0_7_3']=O.compare(O.physical(O.src_geo('printer'),{'group':{'position':[0,7,3]}}),O.physical(wait))
 final=O.read(O.RP/'models/blocks/takeout_bag.geo.json')['minecraft:geometry'][0];out['bag']['frame0_settled']=O.compare(O.physical(O.src_geo('bag'),O.stated_pose('bag',.5)),O.physical(final))
 return out

def main():
 check_public_integrity()
 O.verify_authored_contracts();binding=check_bindings();control=controls();rows=[]
 manifest=O.read(R/'scene-manifest.json');assert len(manifest['scenes'])==6
 for spec in O.SCENES:
  f=spec['family'];pose=O.stated_pose(f,spec['time']);src=O.src_geo(f);rp=O.runtime_geo(spec);rp_pose=O.runtime_plate_pose(spec['time']) if f=='plate' else {};dy=.2 if f=='plate' else 0;tile=(2,2) if f=='plate' else (0,0)
  a=O.physical(src,pose);b=O.physical(rp,rp_pose,dy);result=O.compare(a,b,dy,tile)
  # The scene's original/source cube hierarchy is frozen separately from the oracle.
  scene=O.read(R/'scenes'/f"{spec['id']}.bbmodel");assert scene==B.make_scene(spec),('scene reproduction',spec['id'])
  mr=next(x for x in manifest['scenes'] if x['id']==spec['id']);assert O.sha(R/mr['path'])==mr['sha256']
  O.compare(a,scene_physical(scene,'SOURCE',[-18,0,0]))
  O.compare(b,scene_physical(scene,'RP',[18,0,0]))
  for n,p in enumerate(B.texture_paths(f)):
   t=scene['textures'][n];data=base64.b64decode(t['source'].split(',',1)[1]);assert data==p.read_bytes();im=Image.open(io.BytesIO(data));im.load();assert list(im.size)==[t['width'],t['height']]==[t['uv_width'],t['uv_height']]
  # Cross-check our packaged element decoder against exact official parseCube.
  for side,(g,po) in enumerate([(src,pose),(rp,rp_pose)]):
   frozen=O.freeze_for_editor(g,po);official=json.loads(subprocess.check_output(['node',str(R/'check_official_decode.cjs')],input=json.dumps(frozen).encode()))
   label=['SOURCE','RP'][side];off=[-18,0,0] if side==0 else [18,dy,0]
   for q in official:
    e=next(e for e in scene['elements'] if e['name']==f"{label} {q['bone']}:{q['cube']}")
    for key in ['from','to','origin']:
     assert max(abs(e[key][i]-off[i]-q[key][i]) for i in range(3))<1e-12,(key,e['name'])
    assert e['rotation']==q['rotation'] and e['inflate']==q['inflate']
    assert all(e['faces'][k]['rotation']==v['rotation'] for k,v in q['faces'].items())
    for side2,face in q['faces'].items():assert e['faces'][side2]['uv']==face['uv'] and (e['faces'][side2]['texture'] is None)==(face['texture'] is None)
  if f=='plate':
   refs=[e for e in scene['elements'] if 'REFERENCE Y=0' in e['name']];assert len(refs)==2
   assert all(e['to'][1]==0 and e['from'][1]==-.25 for e in refs)
  rows.append({'id':spec['id'],**result,'editor_geometry_and_uv_against_oracle':'pass','official_Blockbench_parseCube_agreement':'pass','original_embedded_texture_bytes':'pass'})
 # Mutate distinct failure modes, never claim a high test count as new coverage.
 mutations=[];s=O.SCENES[0];a=O.physical(O.src_geo('printer'),O.stated_pose('printer',s['time']));g=O.runtime_geo(s)
 q=copy.deepcopy(g);q['bones'][0]['rotation'][2]*=-1;mutations.append(rejected('printer wobble sign inverted',lambda:O.compare(a,O.physical(q))))
 q=copy.deepcopy(g);paper=next(b for b in q['bones'] if b['name']=='group');delta=[-v*O.stated_pose('printer',s['time'])['order']['scale'][0] for v in O.stated_pose('printer',s['time'])['group']['position']]
 for obj in [paper,*paper['cubes']]:
  for field in ['origin','pivot']:
   if field in obj:obj[field]=[obj[field][i]+delta[i] for i in range(3)]
 mutations.append(rejected('printer child paper translation omitted',lambda:O.compare(a,O.physical(q))))
 s=O.SCENES[3];a=O.physical(O.src_geo('bag'),O.stated_pose('bag',s['time']));q=O.runtime_geo(s);q['bones'][0]['cubes'][0]['size'][0]/=O.stated_pose('bag',s['time'])['group']['scale'][0];mutations.append(rejected('bag root scale lost on one cube',lambda:O.compare(a,O.physical(q))))
 s=O.SCENES[5];po=O.stated_pose('plate',s['time']);a=O.physical(O.src_geo('plate'),po);b=O.physical(O.runtime_geo(s),O.runtime_plate_pose(s['time']),.2)
 mutations.append(rejected('plate intentional helper offset normalized away',lambda:O.compare(a,O.physical(O.runtime_geo(s),O.runtime_plate_pose(s['time'])),.2,(2,2))))
 q=copy.deepcopy(b);q['group3:0']['faces']['east'][0]['uv'][0]+=1;mutations.append(rejected('plate atlas one physical corner shifted 1px',lambda:O.compare(a,q,.2,(2,2))))
 p=O.stated_pose('bag',.1);p['group']['rotation'][2]=3*__import__('math').sin(1000*.1)*(1-.1/.5);expected=O.physical(O.src_geo('bag'),O.stated_pose('bag',.1));mutations.append(rejected('sine mistakenly evaluated in radians',lambda:O.compare(expected,O.physical(O.src_geo('bag'),p))))
 print(B.encoded({'status':'PASS: bounded numeric/source/editor-package checks only','gui_run':False,'native_run':False,'runtime_changed':False,'bindings':binding,'scenes':rows,'controls_numerical_only':control,'negative_mutations':mutations,'tolerance_modelpx':3e-6,'limitations':['Frozen clip-local times; no runtime clock/reset/transition validation','Double-sided common editor preview does not emulate native alpha-test/light/AO/culling','Java and native float GPU arithmetic not executed; formula comparison uses doubles, tolerates six-decimal RP output','Plate actor yaw/world contact and actor-to-block transition require native client'],'finding':'No new geometry or physical-UV mismatch in the six bounded cases. Plate +0.2 modelpx is intentional and preserved.'}))
if __name__=='__main__':main()
