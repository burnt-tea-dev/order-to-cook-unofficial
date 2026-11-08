"""Evidence-only scenes. Java body input stays unmodified; its renderer quad is explicit.
No material render_method emulation or Bedrock client execution is implied.
"""
from pathlib import Path
import json,hashlib,re
from scene_lib import Scene,OUT
ROOT=Path(__file__).resolve().parents[5]
A=ROOT/'upstream/reference/common/src/main/resources/assets/ordertocook'
R=ROOT/'runtime/RP'
BODY=A/'textures/block/washingtable.png'
WATER=A/'textures/block/water.png'
SOURCE=ROOT/'upstream/reference/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/WashingTableWaterRenderer.java'
txt=SOURCE.read_text()
assert hashlib.sha1(b'blob '+str(len(SOURCE.read_bytes())).encode()+b'\0'+SOURCE.read_bytes()).hexdigest()=='a47acf4717344c0196066cccbf199c8c21347585'
v={k:float(re.search(r'float '+k+r' = ([\d.]+)f / 16f;',txt)[1]) for k in ['X0','X1','Z0','Z1','Y']}
assert v==dict(X0=3,X1=13,Z0=3,Z1=12,Y=15.08)
assert 'RenderType.entityTranslucent(WATER_TEXTURE)' in txt and 'RenderSystem.disableCull()' in txt
def source(s,count,offset):
 s.java(A/'models/block/washingtable_idle.json',BODY,offset)
 if count:s.java(A/f'models/block/washingtable_{count}.json',BODY,offset)
 group=s.group('Java registered water renderer equivalent',offset)
 add=lambda p:[p[i]+offset[i] for i in range(3)]
 tex=s.texture(WATER)
 # Original flat water.png is one RGBA texel repeated over32x32. This scene
 # represents the full quad and both sides; it does not test UV direction.
 faces={side:{'uv':[0,0,32,32],'texture':tex} for side in ['up','down']}
 s.cube('Java renderer water y15.08',add([v['X0']-8,v['Y'],v['Z0']-8]),add([v['X1']-8,v['Y'],v['Z1']-8]),faces,offset,[0,0,0],group)
for count in [0,5,10]:
 s=Scene(f'water-before-{count}: Java equivalent left; current Bedrock right')
 source(s,count,[-14,0,0])
 s.bedrock(Path(__file__).parent/f'fixtures/before-washingtable_{count}.geo.json',{'ordertocook_block_washingtable':BODY,'ordertocook_block_water':WATER},[14,0,0],name='Current Bedrock NO water')
 s.save(f'water-before-{count}.bbmodel')
 print('built',OUT/f'water-before-{count}.bbmodel')
AFTER=R/'models/blocks'
if (AFTER/'washingtable_0.geo.json').is_file():
 for count in [0,5,10]:
  s=Scene(f'water-after-{count}: Java equivalent left; candidate Bedrock right')
  source(s,count,[-14,0,0])
  s.bedrock(AFTER/f'washingtable_{count}.geo.json',{'ordertocook_block_washingtable':BODY,'ordertocook_block_water':WATER},[14,0,0],name='Candidate Bedrock with source water')
  s.save(f'water-after-{count}.bbmodel')
  print('built',OUT/f'water-after-{count}.bbmodel')

s=Scene('water-identical-candidates-5')
for x in [-14,14]:s.bedrock(AFTER/'washingtable_5.geo.json',{'ordertocook_block_washingtable':BODY,'ordertocook_block_water':WATER},[x,0,0],name='Same candidate at '+str(x))
s.save('water-identical-candidates-5.bbmodel')
s=Scene('water-item-dry-source-and-candidate')
s.java(A/'models/block/washingtable_idle.json',BODY,[-14,0,0])
s.bedrock(AFTER/'washingtable_item.geo.json',BODY,[14,0,0],name='Candidate dry item')
s.save('water-item-dry-source-and-candidate.bbmodel')
