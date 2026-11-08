"""Verify review scenes independently of runtime converter code.
These checks validate the evidence inputs, not Bedrock render behaviour.
"""
import base64,hashlib,json
from pathlib import Path
P=Path(__file__).parent
A=P.parents[4]/'upstream/reference/common/src/main/resources/assets/ordertocook'
def read(p):return json.loads(p.read_text())
for phase in ['before','after']:
 for count in [0,5,10]:
  d=read(P/f'scenes/water-{phase}-{count}.bbmodel');n=10+count
  assert d['meta']['model_format']=='free'
  assert len(d['elements'])==n*2+(1 if phase=='before' else 2)
  left=d['elements'][:n]
  right=d['elements'][n+1:] if phase=='before' else d['elements'][n+1:-1]
  for a,b in zip(left,right):
   for key in ['from','to']:
    assert [round(v+(28 if i==0 else 0),6) for i,v in enumerate(a[key])]==b[key]
   assert a['faces']==b['faces'] and a['rotation']==b['rotation']
   if any(a['rotation']):
    assert [round(v+(28 if i==0 else 0),6) for i,v in enumerate(a['origin'])]==b['origin']
  water=d['elements'][n]
  assert water['from']==[-19,15.08,-5] and water['to']==[-9,15.08,4]
  if phase=='after':
   water2=d['elements'][-1]
   assert water2['from']==[9,15.08,-5] and water2['to']==[19,15.08,4]
  for t in d['textures']:
   raw=base64.b64decode(t['source'].split(',',1)[1])
   assert raw==(A/'textures/block'/t['name']).read_bytes()
   expect=64 if t['name']=='washingtable.png' else 32
   assert t['width']==t['height']==t['uv_width']==t['uv_height']==expect
  # Source and candidate top maps are equal. Bottom orientation is covered by
  # source-corner regression tests, not visible with this uniform water PNG.
  if phase=='after':
   for key in ['uv','texture']:assert water['faces']['up'][key]==water2['faces']['up'][key]
   assert water2['faces']['up'].get('rotation',0)==0
  print(phase,count,n,'body cubes paired, water bounds and original texture bytes verified')
for entry in read(P/'manifest.json')['evidence']:
 assert hashlib.sha256((P/entry['path']).read_bytes()).hexdigest()==entry['sha256']
print('Initial before evidence scenes remain unchanged.')

for filename,count in [('water-identical-candidates-5.bbmodel',16),('water-item-dry-source-and-candidate.bbmodel',10)]:
 d=read(P/'scenes'/filename);assert len(d['elements'])==count*2
 for a,b in zip(d['elements'][:count],d['elements'][count:]):
  for key in ['from','to']:
   assert [round(v+(28 if i==0 else 0),6) for i,v in enumerate(a[key])]==b[key]
  assert a['faces']==b['faces'] and a['rotation']==b['rotation']
  if any(a['rotation']):
   assert [round(v+(28 if i==0 else 0),6) for i,v in enumerate(a['origin'])]==b['origin']
 print(filename,'paired cube data verified')

root=P.parents[4]
for entry in read(P/'manifest.json')['inputs']:
 assert hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()==entry['sha256'], entry['path']
print('All recorded source/runtime/evidence identities match.')
