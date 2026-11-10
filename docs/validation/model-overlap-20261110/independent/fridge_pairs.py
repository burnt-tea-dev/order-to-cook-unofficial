# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
s=Path(__file__).with_name('classify.py').read_text().split('\nreports=[]')[0];exec(s)
f=Path(__file__).with_name('dynamic_scan.py').read_text();f=f[f.index('def cross('):f.index('orig_numeric=')];exec(f)
results=[]
for p in (ROOT/'runtime/RP/models/blocks').glob('refrigerator_lower*.geo.json'):
 lo=json.load(open(p))['minecraft:geometry'][0];upper=p.with_name(p.name.replace('lower','upper'));hi=json.load(open(upper))['minecraft:geometry'][0]
 fs={('lower/'+k[0],*k[1:]):v for k,v in faces(lo,maps[lo['description']['identifier']][0]).items()}
 for k,v in faces(hi,maps[hi['description']['identifier']][0]).items():
  v['p']+=np.array([0,16,0]);fs[('upper/'+k[0],*k[1:])]=v
 q=scan(fs,True);results.append({'lower':lo['description']['identifier'],'upper':hi['description']['identifier'],'pairs':q})
args.output.write_text(json.dumps(results,indent=2)+'\n')
print('paired states',len(results),'pairs',sum(len(x['pairs']) for x in results),'same normals',sum(y.get('same_normal',False) for x in results for y in x['pairs']))
