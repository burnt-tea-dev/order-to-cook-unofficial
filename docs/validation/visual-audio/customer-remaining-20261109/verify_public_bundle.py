#!/usr/bin/env python3
"""Verify paired same-repository evidence bundles offline. Python, NumPy, Pillow, Node required."""
import argparse, ast, gzip, hashlib, io, json, os, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
PRIOR=ROOT.parent/'customer-static-20261109'
LIMIT=110*1024
if sys.flags.optimize:raise SystemExit('Run without -O; assertions are required.')
def read(p):return json.loads(p.read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(t,b):return hashlib.sha1(f'{t} {len(b)}'.encode()+b'\0'+b).hexdigest()
def member(base,name):
 p=Path(name)
 if not name or '\\' in name or p.is_absolute() or '..' in p.parts or p.as_posix()!=name or name=='.':raise ValueError('Unsafe path')
 q=base/p
 for x in (q,*q.parents):
  if x.is_symlink():raise ValueError('Symlink path')
 return q

def storage():
 expected=read(ROOT/'public-file-hashes.json');actual=set()
 for p in ROOT.rglob('*'):
  if p.is_symlink():raise ValueError('Symlink in bundle')
  if p.is_file() and p!=ROOT/'public-file-hashes.json':actual.add(p.relative_to(ROOT).as_posix())
 assert actual==set(expected)
 for name,r in expected.items():
  b=member(ROOT,name).read_bytes();assert len(b)==r['bytes']<=LIMIT and sha(b)==r['sha256'],name
 preservation=read(ROOT/'preservation.json');raw=member(PRIOR,'public-file-hashes.json').read_bytes();assert sha(raw)==preservation['dependency']['public_inventory_sha256']
 return preservation, json.loads(raw)

def original(r,inventory):
 base=PRIOR if 'dependency' in r else ROOT
 if 'dependency' in r:
  assert r['dependency']==PRIOR.name
  expected=inventory[r['published_path']];assert expected=={'bytes':r['published_bytes'],'sha256':r['published_sha256']}
 b=member(base,r['published_path']).read_bytes();assert len(b)==r['published_bytes']<=128*1024 and sha(b)==r['published_sha256']
 assert 0<r['bytes']<=2*1024*1024
 if r['storage']=='gzip-original-bytes':
  with gzip.GzipFile(fileobj=io.BytesIO(b)) as f:
   b=f.read(r['bytes']+1);assert len(b)==r['bytes'] and f.read(1)==b''
 else:assert r['storage']=='original-bytes'
 assert len(b)==r['bytes'] and sha(b)==r['sha256'] and oid('blob',b)==r['git_blob']
 return b

def enclosing_repositories(source):
 return {ancestor for ancestor in (source,*source.parents)
         if (ancestor/'.git').exists() or (ancestor/'.git').is_symlink()}

def destination(p):
 p=Path(p)
 if '..' in p.parts:raise ValueError('Dot-dot destination')
 p=p.absolute()
 for x in (p,*p.parents):
  if x.is_symlink():raise ValueError('Symlink destination')
 # Protect enclosing repositories as well as the individual evidence folders.
 # A linked Git worktree has a .git file, an ordinary checkout a directory.
 # No Git command or metadata read is needed; standalone sibling bundles have
 # no such boundary and may still restore into a new sibling directory.
 protected={ROOT,PRIOR}
 for source in (ROOT,PRIOR):protected.update(enclosing_repositories(source))
 for source in protected:
  if p==source or source in p.parents or p in source.parents:raise ValueError('Overlapping destination')
 if p.exists():raise FileExistsError('New directory required')
 if not p.parent.is_dir():raise ValueError('Existing real parent required')
 return p

def assemble(p,preservation,inventory):
 p=destination(p);plan=[];paths=set()
 for r in preservation['files']:
  if r['storage'].startswith('omitted-'):continue
  q=member(p,r['original_path'])
  if q in paths or any(q in x.parents or x in q.parents for x in paths):raise ValueError('Conflicting output')
  paths.add(q);plan.append((q,original(r,inventory)))
 p=destination(p);p.mkdir()
 for q,b in plan:q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b)
 return p

def tree_proof(frozen):
 proof=read(ROOT/'provenance/repository-identity.json');objects={}
 for r in proof['objects']:
  b=member(ROOT,r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256'] and oid(r['type'],b)==r['oid'];objects[r['oid']]=b
 manifest=read(frozen/'input-manifest.json');assert proof['commits']=={'prepared':manifest['commit'],'earlier_main':manifest['main_commit_checked_locally'],'baseline':'ce7e8916ac5627be08a6c366ea933a4ad96ad3bd'}
 assert len(proof['inputs'])==3*len(manifest['files']);seen=set()
 for r in proof['inputs']:
  key=r['commit_label'],r['path'];assert key not in seen;seen.add(key)
  tree=objects[proof['commits'][r['commit_label']]].split(b'\n',1)[0].removeprefix(b'tree ').decode()
  parts=Path(r['path']).parts
  for i,part in enumerate(parts):
   data=objects[tree];entries={}
   while data:
    head,data=data.split(b'\0',1);mode,name=head.split(b' ',1);entries[name.decode()]=(mode,data[:20].hex());data=data[20:]
   mode,tree=entries[part];assert mode==(b'100644' if i==len(parts)-1 else b'40000')
  b=member(frozen/'inputs',r['path']).read_bytes();assert tree==r['git_blob']==manifest['files'][r['path']]['repo_git_blob']==oid('blob',b)
 return len(seen)

def verify(frozen,preservation):
 mapping={r['original_path']:r for r in preservation['files']};assert len(mapping)==len(preservation['files']);history=read(frozen/'artifact-hashes.json')['files']
 assert len(history)==73 and sha((frozen/'artifact-hashes.json').read_bytes())=='460e22c0b7e85abc1c1c57899556013e34cdf451d47fc5aa334f82c4fc121157'
 for name,r in history.items():
  assert mapping[name]['sha256']==r['sha256'] and mapping[name]['bytes']==r['size']
  if mapping[name]['storage']!='omitted-provenance-metadata':assert sha(member(frozen,name).read_bytes())==r['sha256']
 omitted=[r for r in mapping.values() if r['storage'].startswith('omitted-')];assert {r['original_path'] for r in omitted}=={'source-evidence/gecko-cache-provenance.json','GUI_CAPTURE_RECEIPT.json'}
 projection=read(ROOT/'provenance/geckolib-sources.json');assert projection['original_receipt_sha256']==mapping['source-evidence/gecko-cache-provenance.json']['sha256']
 manifest=read(frozen/'scene-manifest.json');assert manifest['gui_run'] is False and manifest['native_run'] is False
 assert all(r['status']=='prepared, not GUI tested' for r in manifest['samples'])
 receipt=read(ROOT/'capture-receipt-public.json');ind=read(ROOT/'gui-independent-receipt.json');assert receipt['frozen_manifest_sha256']==sha((frozen/'artifact-hashes.json').read_bytes())
 assert len(receipt['screenshots'])==len(ind['photographs'])==10
 projection=receipt['public_projection'];assert projection['original_receipt_sha256']==mapping['GUI_CAPTURE_RECEIPT.json']['sha256'] and projection['original_receipt_bytes']==mapping['GUI_CAPTURE_RECEIPT.json']['bytes'];assert receipt['operator']=='visual review operator'
 assert ind['capture_receipt_sha256']==mapping['GUI_CAPTURE_RECEIPT.json']['sha256'] and ind['prepared_status_promoted'] is False and ind['native_acceptance'] is False
 assert all(c['original_pixels_independently_inspected'] for c in ind['photographs'])
 scenes={r['id']:r for r in manifest['samples']}
 for r,c in zip(receipt['screenshots'],ind['photographs']):
  assert r['path']==c['path'] and r['sha256']==c['sha256']
  p=member(frozen,r['path']);assert sha(p.read_bytes())==r['sha256'] and p.stat().st_size==r['size']
  with Image.open(p) as im:im.load();assert list(im.size)==r['dimensions']==[1188,848] and im.format=='JPEG'
  if c['scene_id']:
   s=scenes[c['scene_id']];assert c['scene_sha256']==s['sha256'] and c['clip']==s['clip'] and c['time']==s['time'] and c['query_inputs']==s['query_inputs'] and c['sides']==s['sides']
 assert sum(bool(c['scene_id']) for c in ind['photographs'])==9 and len({c['scene_id'] for c in ind['photographs'] if c['scene_id']})==7
 memberships=tree_proof(frozen)
 # Adapt in disposable tree only; preserve original script and records in publication.
 a=(frozen/'verify_review.py').read_text();record=read(ROOT/'provenance/portable-adaptation.json');assert sha(a.encode())==record['original_sha256']
 for r in record['replacements']:assert r['old'] in a;a=a.replace(r['old'],r['new'])
 b=(ROOT/'tools/verify_pose.py').read_text();assert a==b and sha(b.encode())==record['adapted_sha256']
 (frozen/'verify_review.py').write_text(b);(frozen/'public-geckolib-sources.json').write_bytes((ROOT/'provenance/geckolib-sources.json').read_bytes())
 env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
 for name in ['verify_review.py','verify_selection.py']:subprocess.run([sys.executable,'-B',str(frozen/name)],check=True,capture_output=True,env=env)
 numerical=read(frozen/'verification.json');selection=read(frozen/'selection-verification.json')
 assert numerical['sampled_corner_comparisons']==2240 and numerical['independently_checked_face_uv_records']==1680 and numerical['fresh_process_reproduction']=='byte-identical'
 assert selection['new_scenes_equal_to_any_declared_same_rig_prior_static_pose']==0
 # Reports reproduce original bytes even though invoked with public provenance.
 for name in ['verification.json','selection-verification.json']:assert sha((frozen/name).read_bytes())==mapping[name]['sha256']
 (frozen/'check_sleeves.py').write_bytes((ROOT/'tools/check_sleeves.py').read_bytes())
 run=subprocess.run([sys.executable,'-B',str(frozen/'check_sleeves.py'),str(frozen)],check=True,capture_output=True,text=True,env=env)
 assert json.loads(run.stdout)==read(ROOT/'sleeve-overlap.json')
 return {'status':'PASS offline identity and static reproduction only','frozen_manifest_files':73,'preserved_original_files':len(mapping)-2,'omitted_private_metadata':2,'model_photos':9,'unique_scenes':7,'setting_diagnostics':1,'repository_input_memberships':memberships,'corner_comparisons':2240,'face_uv_checks':1680,'max_corner_error':numerical['max_corner_component_error_model_units'],'native_acceptance':False}

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--assemble',type=Path);args=parser.parse_args();p,inventory=storage()
 if args.assemble:assemble(args.assemble,p,inventory);print('Restored original artifacts except explicitly omitted acquisition and capture metadata.');return
 with tempfile.TemporaryDirectory(prefix='otc-remaining-public-') as t:result=verify(assemble(Path(t)/'review',p,inventory),p)
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
