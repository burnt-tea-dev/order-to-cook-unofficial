from pathlib import Path
import re,json
r=Path.cwd();pat=re.compile(r'<<<<<<<[^\n]*\n(.*?)=======\n(.*?)>>>>>>>[^\n]*(?:\n|$)',re.S)
def resolve(f,fn):
 p=r/f;s=p.read_text();i=0
 def sub(m):
  nonlocal i
  out=fn(i,m[1],m[2]);i+=1;return out
 p.write_text(pat.sub(sub,s));print(f,i)
resolve('runtime/BP/scripts/appliances.js',lambda i,a,b:a+b if i<3 else a.replace('tickDishwasher(station, delta);','{ tickDishwasher(station, delta); updateVisual(station); }'))
resolve('runtime/BP/scripts/main.js',lambda i,a,b:"import { world, system, ItemStack, ItemTypes, BlockPermutation, GameMode, MolangVariableMap } from '@minecraft/server';\n" if i==0 else a.replace('tickRestaurants,','tickRestaurants, refreshMachineOrders, syncPrinter, tickPrinters,'))
resolve('tests/main.harness.js',lambda i,a,b:a.replace('ItemStack: FakeItem,','ItemStack: FakeItem, MolangVariableMap: FakeMolangVariableMap,'))
resolve('tests/appliance-motion.test.js',lambda i,a,b:b[:b.index("test('separate refrigerator compartments")]+a if i==0 else a.replace("assert.equal(state(lower, 'frame'), 7);","assert.equal(state(lower, 'closing'), true); assert.equal(state(lower, 'frame'), 3);"))
def converter(i,a,b):
 if i==0:return '    upper_variants = []\n'+b
 if i==1:
  s=a.replace('"half": half, "frame": frame','"half": half, "closing": closing, "frame": frame')
  s=s.replace('"open": [False, True], "frame":','"open": [False, True], "closing": [False, True], "frame":')
  return s+b[b.index('    # Shared data'):]
 if i==2:return b.replace('"refrigerator":"metal",','"refrigerator":"metal","refrigerator_upper":"metal",')
 if i==3:return b
 if i==4:
  stove=next(x for x in a.splitlines() if 'Stove uses' in x)
  return b.replace('            "Dishwasher drawer',stove+'\n            "Dishwasher drawer')
 raise AssertionError(i)
resolve('tools/convert_assets.py',converter)
for f in ['package.json','package-lock.json','runtime/BP/manifest.json','runtime/RP/manifest.json','runtime/asset_conversion_manifest.json']:
 resolve(f,lambda i,a,b:a)
for f in ['package.json','package-lock.json']:
 p=r/f;d=json.loads(p.read_text());d['version']='0.1.7-alpha.1'
 if 'packages' in d:d['packages']['']['version']='0.1.7-alpha.1'
 p.write_text(json.dumps(d,indent=2)+'\n')
for f in ['runtime/BP/manifest.json','runtime/RP/manifest.json']:
 p=r/f;d=json.loads(p.read_text());d['header']['version']=[0,1,7]
 for m in d['modules']:m['version']=[0,1,7]
 for dep in d.get('dependencies',[]):
  if 'uuid' in dep:dep['version']=[0,1,7]
 p.write_text(json.dumps(d,indent=2)+'\n')
# Merge feature tables by row ownership, not by replacing a whole README.
for f in ['README.md','README.en.md','README.zh-CN.md']:
 def readme(i,a,b):
  if i==0:
   extra=b.split('\n\n')[-1].replace('0.1.6-alpha.1','0.1.7-alpha.1')
   return a.replace('0.1.5-alpha.1`','0.1.7-alpha.1`')+'\n'+extra+'\n'
  if i==1:
   al=a.strip().splitlines();bl=b.strip().splitlines()
   appliance=al[3].replace('66','82').replace('11 door poses each','11 opening and 11 closing poses each').replace('每門 11 姿態','每門開／關各 11 姿態').replace('每门 11 姿态','每门开／关各 11 姿态')
   return '\n'.join(al[:2]+[bl[2],appliance,bl[4]]+al[4:7]+[al[7].replace('240','297')])+'\n'
  if i==2:return '\n'.join([a.splitlines()[0]]+b.strip().splitlines()[1:]+[a.strip().splitlines()[-1]])+'\n'
  raise AssertionError(i)
 resolve(f,readme)
resolve('docs/ASSET_PROVENANCE.md',lambda i,a,b:b[:b.index('爐火仍使用')]+a[a.index('爐火使用'):]+ '\n' if i==0 else '\n'.join(b.strip().splitlines()[:2]+[a.strip().splitlines()[-1]])+'\n')
def parity(i,a,b):
 if i==0:return a.replace('0.1.5-alpha.1（未發布來源）','0.1.7-alpha.1（整合來源）')+'\n'+b.replace('0.1.6-alpha.1 視覺／音效候選來源','已整合的視覺／音效修復')
 if i==1:return b
 al=a.strip().splitlines();bl=b.strip().splitlines()
 fridge=al[1].replace('每門 11 姿態','每門開／關各 11 姿態，保留原開關曲線及內壁 UV 修復')
 dish=bl[3].replace(' | 補回',' | 批次存取失敗保留物品，補回')
 stove=al[3].replace('原生表單、','單頁控制與直接存取，')
 return '\n'.join(bl[:2]+[fridge,dish,stove,bl[-1]])+'\n'
resolve('docs/PARITY.md',parity)
resolve('docs/RUNTIME_ADAPTATIONS.md',lambda i,a,b:a.replace('0.1.5-alpha.1（未發布來源）','0.1.7-alpha.1（整合來源）')+'\n'+b.replace('0.1.6-alpha.1 視覺／音效候選來源','視覺／音效修復') if i==0 else a.replace('每扇門 11 姿態','每扇門開／關各 11 姿態'))
for name in ['en_US','zh_CN','zh_TW']:
 lines=(r/f'runtime/RP/texts/{name}.lang').read_text().splitlines()
 (r/f'assets/guidebook/{name}.lang').write_text('\n'.join(x for x in lines if x.startswith('otc.guide.'))+'\n')
for p in r.rglob('*'):
 if not p.is_file() or '.git' in p.parts or 'node_modules' in p.parts:continue
 try:s=p.read_text()
 except (UnicodeDecodeError,OSError):continue
 if re.search(r'^(<<<<<<< |=======\s*$|>>>>>>> )',s,re.M):print('UNRESOLVED',p)
