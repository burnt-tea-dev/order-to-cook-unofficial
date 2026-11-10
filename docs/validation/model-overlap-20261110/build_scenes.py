#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Rebuild static editor fixtures; no editor or engine acceptance."""
from pathlib import Path
import sys,json,subprocess,copy
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'docs/validation/visual-audio/blockbench-20261108/remaining-static'))
import scene_lib as sl
OUT=ROOT/'docs/validation/model-overlap-20261110/scenes';OUT.mkdir(exist_ok=True);sl.OUT=OUT
import tempfile
TEMP=tempfile.TemporaryDirectory()
BASE=Path(TEMP.name)
for name,texture in [('chair','chair'),('dishwasher_1_0','dishwasher'),('dishwasher_5_0','dishwasher'),('board','board'),('takeout_bag','takeout_bag_placed')]:
 rel=f'runtime/RP/models/blocks/{name}.geo.json';orig=BASE/(name+'.geo.json');orig.write_bytes(subprocess.check_output(['git','show','a4176b1:'+rel],cwd=ROOT))
 s=sl.Scene(name+' BASELINE left / REPAIR right')
 tex=ROOT/f'runtime/RP/textures/ordertocook/block/{texture}.png'
 s.bedrock(orig,tex,[-12,0,0],name='BASELINE a4176b1')
 s.bedrock(ROOT/rel,tex,[12,0,0],name='REPAIR current')
 s.save(name+'-pair.bbmodel')
 if name=='dishwasher_1_0':
  for kind,path in [('baseline',orig),('repair',ROOT/rel)]:
   j=json.loads(path.read_text());g=j['minecraft:geometry'][0];b=next(x for x in g['bones'] if x['name']=='group3');b.pop('parent',None);g['bones']=[b];(BASE/(kind+'-basket.geo.json')).write_text(json.dumps(j))
  s=sl.Scene('DRAWER ONLY: baseline left / repair right; diagnostic isolation')
  for dx,kind in [(-8,'baseline'),(8,'repair')]:s.bedrock(BASE/(kind+'-basket.geo.json'),tex,[dx,0,0],name=kind+' isolated basket')
  s.save('drawer-isolated-pair.bbmodel')
print(OUT)

import itertools
sl.SEQ=itertools.count()
from pathlib import Path
import sys,json,subprocess
R=ROOT;sys.path.insert(0,str(R/'docs/validation/visual-audio/blockbench-20261108/remaining-static'));import scene_lib as sl
sl.OUT=R/'docs/validation/model-overlap-20261110/scenes';B=BASE
terrain=json.loads((R/'runtime/RP/textures/terrain_texture.json').read_text())['texture_data']
texmap={k:R/('runtime/RP/'+v['textures']+'.png') for k,v in terrain.items() if isinstance(v['textures'],str)}
for stage in [5,6]:
 name=f'food_plate_display_{stage}';rel=f'runtime/RP/models/blocks/{name}.geo.json';base=B/(name+'.geo.json');base.write_bytes(subprocess.check_output(['git','show','a4176b1:'+rel],cwd=R))
 s=sl.Scene(name+' baseline left / repaired right')
 for x,p,label in [(-9,base,'BASELINE'),(9,R/rel,'REPAIR')]:s.bedrock(p,texmap,[x,0,0],name=label)
 s.save(name+'-pair.bbmodel')
s=sl.Scene('HELMET baseline left / repaired right; local authored position')
for x,rev in [(-9,'baseline'),(9,'repair')]:
 for part in ['shell','visor']:
  rel=f'runtime/RP/models/entity/helmet_{part}.geo.json';p=R/rel
  if rev=='baseline':p=B/(part+'.geo.json');p.write_bytes(subprocess.check_output(['git','show','a4176b1:'+rel],cwd=R))
  tex=R/f'runtime/RP/textures/ordertocook/item/delivery_helmet{"_glass" if part=="visor" else ""}.png'
  s.bedrock(p,tex,[x,-24,0],name=rev+' '+part)
s.save('helmet-pair.bbmodel')

TEMP.cleanup()
