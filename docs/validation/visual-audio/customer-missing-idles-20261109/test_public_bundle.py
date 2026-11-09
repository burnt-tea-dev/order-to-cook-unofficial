#!/usr/bin/env python3
"""Focused packaging guardrails. No writes outside owned temporary directories."""
import copy,gzip,subprocess,sys,tempfile,zlib
from pathlib import Path
import verify_public_bundle as v

def rejects(label,fn):
 try:fn()
 except (AssertionError,ValueError,KeyError,OSError,zlib.error):return label
 raise AssertionError('Accepted invalid case: '+label)

def main():
 preservation,inventories=v.storage();checks=[]
 with tempfile.TemporaryDirectory(prefix='otc-idles-guardrails-') as td:
  root=Path(td)
  for name in ['../escape','/absolute','a/../b','a//b','a\\b','.']:
   checks.append(rejects('unsafe path '+repr(name),lambda name=name:v.member(root,name)))
  (root/'target').mkdir();(root/'alias').symlink_to(root/'target',target_is_directory=True)
  checks.append(rejects('symlink ancestor',lambda:v.member(root,'alias/file')))
  checks.append(rejects('symlink file',lambda:v.member(root,'alias')))
  data=gzip.compress(b'original',mtime=0);assert v.inflate(data,8)==b'original'
  for label,b,size in [('excess expansion',data,7),('truncated gzip',data[:-4],8),('trailing bytes',data+b'x',8),('concatenated gzip',data+gzip.compress(b'',mtime=0),8),('oversized declared expansion',data,v.RAW_LIMIT+1)]:
   checks.append(rejects(label,lambda b=b,size=size:v.inflate(b,size)))
  r=next(x for x in preservation['files'] if 'dependency'in x);bad=copy.deepcopy(r);bad['published_git_blob']='0'*40
  checks.append(rejects('dependency Git blob mismatch',lambda:v.payload(bad,inventories)))
  bad=copy.deepcopy(preservation);bad['files']=[r,copy.deepcopy(r)]
  checks.append(rejects('duplicate original target',lambda:v.load_plan(bad,inventories)))
  bad['files'][1]['original_path']=r['original_path']+'/child'
  checks.append(rejects('file/directory original conflict',lambda:v.load_plan(bad,inventories)))
  target=root/'must-not-exist'
  run=subprocess.run([sys.executable,'-B',str(v.ROOT/'verify_public_bundle.py'),'--assemble',str(target)],capture_output=True,text=True)
  assert run.returncode!=0 and 'takes no arguments'in run.stderr and not target.exists();checks.append('no arbitrary output flag')
 print('PASS focused storage guardrails: '+', '.join(checks))
 print('These are packaging controls, not additional visual or native coverage.')
if __name__=='__main__':main()
