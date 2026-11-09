#!/usr/bin/env python3
"""Read-only offline verification. Writes only inside owned temporary directories."""
import ast, contextlib, hashlib, json, os, stat, subprocess, sys, tempfile, zlib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).absolute().parent
LIMIT=110*1024
RAW_LIMIT=2*1024*1024
HISTORY='59b4a9bd2a5ac037649a1fa35761c9f578a5e25aab3252c31aabcf4e2de41ea6'
BASELINE='dbb2574154a54cc5ad69e75e71d23900a98a79fe'
DEPENDENCIES={'customer-static-20261109','customer-remaining-20261109'}
if sys.flags.optimize:raise SystemExit('Run without -O; assertions are required.')
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(kind,b):return hashlib.sha1(f'{kind} {len(b)}'.encode()+b'\0'+b).hexdigest()
def member(base,name):
 p=Path(name)
 if not name or '\\'in name or p.is_absolute() or '..'in p.parts or p.as_posix()!=name or name=='.':raise ValueError('Unsafe relative path')
 q=base/p
 for x in (q,*q.parents):
  if x.is_symlink():raise ValueError('Symlink path')
 return q

def bounded_read(p,limit):
 info=p.stat()
 if not stat.S_ISREG(info.st_mode):raise ValueError('Non-regular stored file')
 if info.st_size>limit:raise ValueError('Oversized stored file')
 with p.open('rb') as f:b=f.read(limit+1)
 if len(b)>limit:raise ValueError('Oversized stored read')
 return b

def read(name):return json.loads(bounded_read(member(ROOT,name),LIMIT))

def inflate(b,size):
 if not isinstance(size,int) or isinstance(size,bool) or not 0<size<=RAW_LIMIT:raise ValueError('Invalid expansion size')
 decoder=zlib.decompressobj(31);out=decoder.decompress(b,size+1)
 if len(out)!=size or not decoder.eof or decoder.unused_data or decoder.unconsumed_tail:raise ValueError('Invalid, excessive or concatenated gzip')
 return out

def storage():
 expected=read('public-file-hashes.json');actual=set()
 for p in ROOT.rglob('*'):
  if p.is_symlink():raise ValueError('Symlink in bundle')
  if p.is_file() and p!=ROOT/'public-file-hashes.json':actual.add(p.relative_to(ROOT).as_posix())
 assert actual==set(expected),'Public inventory mismatch'
 for name,r in expected.items():
  b=bounded_read(member(ROOT,name),LIMIT);assert len(b)==r['bytes'] and sha(b)==r['sha256'] and oid('blob',b)==r['git_blob'],name
 preservation=read('preservation.json');assert set(preservation['dependencies'])==DEPENDENCIES;inventories={}
 for name,r in preservation['dependencies'].items():
  b=bounded_read(member(ROOT.parent/name,'public-file-hashes.json'),LIMIT)
  assert len(b)==r['public_inventory_bytes'] and sha(b)==r['public_inventory_sha256'] and oid('blob',b)==r['public_inventory_git_blob']
  inventories[name]=json.loads(b)
 return preservation,inventories

def payload(r,inventories):
 if 'dependency'in r:
  name=r['dependency'];assert name in DEPENDENCIES
  inventory=inventories[name][r['published_path']]
  assert inventory=={'bytes':r['published_bytes'],'sha256':r['published_sha256']}
  base=ROOT.parent/name
 else:base=ROOT
 b=bounded_read(member(base,r['published_path']),128*1024)
 assert len(b)==r['published_bytes'] and sha(b)==r['published_sha256'] and oid('blob',b)==r['published_git_blob']
 if r['storage']=='gzip-original-bytes':b=inflate(b,r['bytes'])
 else:assert r['storage']=='original-bytes' and 0<len(b)<=RAW_LIMIT
 assert len(b)==r['bytes'] and sha(b)==r['sha256'] and oid('blob',b)==r['git_blob']
 return b

def load_plan(preservation,inventories):
 plan={};allpaths=set()
 for r in preservation['files']:
  name=r['original_path'];q=member(Path('/'),name)
  if q in allpaths or any(q in p.parents or p in q.parents for p in allpaths):raise ValueError('Conflicting original paths')
  allpaths.add(q)
  if not r['storage'].startswith('omitted-'):plan[name]=payload(r,inventories)
 return plan

@contextlib.contextmanager
def temporary_review(plan):
 # No caller-selected destination, no --assemble mode. All payloads validated before this call.
 with tempfile.TemporaryDirectory(prefix='otc-idles-public-') as td:
  root=Path(td)/'review';root.mkdir()
  for name,b in plan.items():
   p=member(root,name);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
  yield root

def tree_proof(plan):
 proof=read('provenance/repository-identity.json');assert proof['commit']==BASELINE;objects={};types={}
 for r in proof['objects']:
  b=bounded_read(member(ROOT,r['path']),LIMIT)
  assert len(b)==r['bytes'] and sha(b)==r['sha256'] and oid(r['type'],b)==r['oid']
  assert r['oid'] not in objects and r['type'] in ['commit','tree'];objects[r['oid']]=b;types[r['oid']]=r['type']
 assert types[BASELINE]=='commit';tree_line=objects[BASELINE].split(b'\n',1)[0];assert tree_line.startswith(b'tree ')
 root=tree_line[5:].decode();assert root==proof['tree']
 manifest=json.loads(plan['input-manifest.json']);assert manifest['commit']==manifest['main_commit_checked_locally']==BASELINE
 seen=set();assert len(proof['inputs'])==len(manifest['files'])==17
 for row in proof['inputs']:
  path=row['path'];assert path not in seen;seen.add(path);tree=root;parts=Path(path).parts
  member(Path('/'),path)
  for i,part in enumerate(parts):
   assert types[tree]=='tree';data=objects[tree];entries={}
   while data:
    header,data=data.split(b'\0',1);mode,name=header.split(b' ',1);assert len(data)>=20 and name not in entries
    entries[name]=(mode,data[:20].hex());data=data[20:]
   mode,tree=entries[part.encode()];assert mode==(b'100644' if i==len(parts)-1 else b'40000')
  b=plan['inputs/'+path];r=manifest['files'][path]
  assert len(b)==r['size'] and sha(b)==r['sha256'] and tree==row['git_blob']==r['repo_git_blob']==oid('blob',b)
 assert seen==set(manifest['files']);return len(seen)

def input_comparison(plan,preservation,inventories):
 extra=preservation['extra_audit_dependencies'];prior=json.loads(payload(extra['prior_input_manifest'],inventories));old=payload(extra['prior_converter'],inventories)
 current=json.loads(plan['input-manifest.json']);record=json.loads(plan['input-equivalence.json']);assert record['current_tree']==read('provenance/repository-identity.json')['tree'];assert record['prior_manifest_sha256']==extra['prior_input_manifest']['sha256']
 assert record['current_commit']==BASELINE and record['prior_commit']==prior['commit'];assert len(record['files'])==17
 seen=set();changed=[]
 for r in record['files']:
  path=r['path'];assert path not in seen;seen.add(path);p=prior['files'][path];c=current['files'][path]
  assert (r['prior_sha256'],r['prior_git_blob'],r['current_sha256'],r['current_git_blob'])==(p['sha256'],p['repo_git_blob'],c['sha256'],c['repo_git_blob'])
  equal=p['sha256']==c['sha256'];assert r['byte_identical']==equal
  if not equal:changed.append(path)
 assert seen==set(current['files'])==set(prior['files']);assert changed==['tools/convert_assets.py']
 assert sha(old)==prior['files'][changed[0]]['sha256'] and oid('blob',old)==prior['files'][changed[0]]['repo_git_blob']
 # Parse context bytes only. Never import/execute either converter.
 before=ast.parse(old);after=ast.parse(plan['inputs/tools/convert_assets.py']);assert len(before.body)==len(after.body);nodes=[]
 for a,b in zip(before.body,after.body):
  if ast.dump(a)!=ast.dump(b):
   assert isinstance(a,ast.FunctionDef) and isinstance(b,ast.FunctionDef) and a.name==b.name=='make_motorcycle_geo';nodes.append(a.name)
 assert nodes==record['converter_ast_changed_top_level_nodes']==['make_motorcycle_geo'];return {'unchanged':16,'changed_context_only':['tools/convert_assets.py']}

def receipts(plan,preservation):
 mapping={r['original_path']:r for r in preservation['files']};assert len(mapping)==84
 history=plan['artifact-hashes.json'];assert sha(history)==HISTORY;history=json.loads(history)['files'];assert len(history)==73
 for name,r in history.items():
  assert mapping[name]['sha256']==r['sha256'] and mapping[name]['bytes']==r['size']
  if name in plan:assert sha(plan[name])==r['sha256']
 omitted={r['original_path'] for r in mapping.values() if r['storage'].startswith('omitted-')}
 assert omitted=={'source-evidence/gecko-cache-provenance.json','preparation/init_preparation.py','preparation/strengthen_verifier.py','REPORT.md','GUI_REVIEW.md','GUI_CAPTURE_RECEIPT.json'}
 manifest=json.loads(plan['scene-manifest.json']);assert manifest['gui_run'] is False and manifest['native_run'] is False
 assert all(s['status']=='prepared, not GUI tested' for s in manifest['samples'])
 capture=read('capture-receipt-public.json');ind=read('gui-independent-receipt.json');origin=mapping['GUI_CAPTURE_RECEIPT.json']
 assert capture['public_projection']['original_receipt_sha256']==ind['capture_receipt_original_sha256']==origin['sha256']
 assert capture['public_projection']['original_receipt_bytes']==origin['bytes']
 assert capture['preparation_manifest_sha256']==ind['preparation_manifest_sha256']==HISTORY
 assert capture['baseline_tree']==read('provenance/repository-identity.json')['tree'];assert capture['baseline_commit']==BASELINE and capture['model_photographs']==8 and capture['setting_diagnostics']==1
 assert ind['prepared_status_promoted'] is False and ind['native_acceptance'] is False
 assert len(capture['screenshots'])==len(ind['photographs'])==9;scenes={s['id']:s for s in manifest['samples']};seen={};diagnostics=0
 import io
 for c,r in zip(capture['screenshots'],ind['photographs']):
  assert r['path']==c['path'] and r['sha256']==c['sha256'] and r['original_pixels_independently_inspected'] is True
  b=plan[c['path']];assert sha(b)==r['sha256'] and len(b)==c['bytes']==r['bytes']
  with Image.open(io.BytesIO(b)) as im:im.load();assert im.format=='JPEG' and list(im.size)==r['dimensions']==c['dimensions']==[1188,848]
  for key in ['scene_id','scene_sha256','camera','source_display_position','rp_display_position','clip','time','query_inputs','sides']:assert r[key]==c[key]
  if r['scene_id']:
   s=scenes[r['scene_id']];assert r['complete_figures'] is True and r['unselected'] is True
   assert r['scene_sha256']==s['sha256']==sha(plan[s['path']])
   for key in ['clip','time','query_inputs','sides']:assert r[key]==s[key]
   expected=('right and lower','left and upper') if r['camera']=='Isometric Right (2:1)' else ('right','left')
   assert r['camera'] in ['Isometric Right (2:1)','NORTH'];assert (r['source_display_position'],r['rp_display_position'])==expected
   seen.setdefault(s['id'],[]).append(r['camera'])
  else:diagnostics+=1;assert r['render_sides_visible']=='Auto'
 assert len(seen)==4 and diagnostics==1 and all(sorted(c)==['Isometric Right (2:1)','NORTH'] for c in seen.values())
 return mapping

def verify():
 preservation,inventories=storage();plan=load_plan(preservation,inventories);mapping=receipts(plan,preservation);memberships=tree_proof(plan);comparison=input_comparison(plan,preservation,inventories)
 extra=preservation['extra_audit_dependencies'];projection=payload(extra['geckolib_sources'],inventories)
 assert json.loads(projection)['original_receipt_sha256']==mapping['source-evidence/gecko-cache-provenance.json']['sha256']
 with temporary_review(plan) as frozen:
  original=plan['verify_review.py'].decode();adaptation=read('provenance/portable-adaptation.json');assert sha(original.encode())==adaptation['original_sha256']
  adapted=original
  for r in adaptation['replacements']:assert adapted.count(r['old'])==1;adapted=adapted.replace(r['old'],r['new'])
  b=bounded_read(member(ROOT,'tools/verify_pose.py'),LIMIT);assert adapted.encode()==b and sha(b)==adaptation['adapted_sha256']
  (frozen/'verify_review.py').write_bytes(b);(frozen/'public-geckolib-sources.json').write_bytes(projection)
  env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
  for name in ['verify_review.py','verify_selection.py']:subprocess.run([sys.executable,'-B',str(frozen/name)],check=True,capture_output=True,env=env)
  for name in ['verification.json','selection-verification.json']:assert (frozen/name).read_bytes()==plan[name]
  numerical=json.loads((frozen/'verification.json').read_bytes());selection=json.loads((frozen/'selection-verification.json').read_bytes())
  assert numerical['sampled_corner_comparisons']==1280 and numerical['independently_checked_face_uv_records']==960 and numerical['fresh_process_reproduction']=='byte-identical'
  assert len(numerical['structure_mutation_rejections'])==7 and len(selection['query_attachment_mutations_rejected'])==4
 return {'status':'PASS offline identities, receipt bindings and static reproduction','historical_preparation_files':73,'original_files_reconstructible':len(plan),'original_files_explicitly_omitted':6,'reused_exact_artifacts':sum('dependency'in r for r in preservation['files']),'repository_input_memberships':memberships,'current_input_comparison':comparison,'model_photos_independently_inspected':8,'setting_diagnostics':1,'corner_comparisons':1280,'face_uv_records':960,'max_corner_component_error_model_units':numerical['max_corner_component_error_model_units'],'fresh_process_reproduction':'byte-identical','write_scope':'Owned TemporaryDirectory only; no assemble output option','automated_image_quality_judgment':False,'native_acceptance':False}

def main():
 if len(sys.argv)!=1:raise SystemExit('This verifier takes no arguments and writes only to owned temporary directories.')
 print(json.dumps(verify(),indent=2))
if __name__=='__main__':main()
