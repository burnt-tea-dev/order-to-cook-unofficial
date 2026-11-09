#!/usr/bin/env python3
"""Negative storage/path tests. No network, GUI, production imports or external writes."""
import copy, gzip, json, tempfile, unittest
from unittest.mock import patch
from pathlib import Path
import verify_public_bundle as v

class SafetyTests(unittest.TestCase):
 def setUp(self):
  self.old=v.ROOT,v.PRIOR;self.temp=tempfile.TemporaryDirectory(prefix='otc-public-negative-');self.p=Path(self.temp.name);v.ROOT=self.p/'bundle';v.PRIOR=self.p/'prior';v.ROOT.mkdir();v.PRIOR.mkdir()
  # Some managed executors wrap /tmp itself in a checkout. Isolate fixture
  # ancestry so standalone behavior can be tested without touching that repo.
  original=v.enclosing_repositories
  self.boundary=patch.object(v,'enclosing_repositories',side_effect=lambda source: {r for r in original(source) if r==self.p or self.p in r.parents})
  self.boundary.start()
 def tearDown(self):self.boundary.stop();v.ROOT,v.PRIOR=self.old;self.temp.cleanup()
 def inventory(self):
  data=(v.PRIOR/'public-file-hashes.json');data.write_text('{}')
  preservation={'files':[],'dependency':{'public_inventory_sha256':v.sha(data.read_bytes())}}
  (v.ROOT/'preservation.json').write_text(json.dumps(preservation))
  self.rehash();return preservation
 def rehash(self):
  rows={p.relative_to(v.ROOT).as_posix():{'bytes':p.stat().st_size,'sha256':v.sha(p.read_bytes())} for p in v.ROOT.rglob('*') if p.is_file() and p!=v.ROOT/'public-file-hashes.json'}
  (v.ROOT/'public-file-hashes.json').write_text(json.dumps(rows))
 def payload(self,name='file',data=b'original',compressed=False):
  raw=gzip.compress(data,mtime=0) if compressed else data;p=v.ROOT/name;p.write_bytes(raw)
  return {'original_path':name,'published_path':name,'bytes':len(data),'sha256':v.sha(data),'git_blob':v.oid('blob',data),'published_bytes':len(raw),'published_sha256':v.sha(raw),'storage':'gzip-original-bytes' if compressed else 'original-bytes'}
 def test_valid(self):
  p=self.inventory();r=self.payload();p['files']=[r];out=v.assemble(self.p/'assembled',p,{});self.assertEqual((out/'file').read_bytes(),b'original')
 def test_member_traversal(self):
  for name in ['../escape','/tmp/escape','a/../escape','.','','a\\escape','a//b']:
   with self.assertRaises(ValueError):v.member(v.ROOT,name)
 def test_symlink_parent(self):
  (v.ROOT/'link').symlink_to(self.p,target_is_directory=True)
  with self.assertRaises(ValueError):v.member(v.ROOT,'link/file')
 def test_destination_guards(self):
  for p in [v.ROOT,v.PRIOR,v.ROOT/'child',self.p,self.p/'x/../out',self.p/'absent/out']:
   with self.assertRaises((ValueError,FileExistsError)):v.destination(p)
  (self.p/'link').symlink_to(self.p,target_is_directory=True)
  with self.assertRaises(ValueError):v.destination(self.p/'link/out')
 def test_repository_worktree_file_rejected(self):
  (self.p/'.git').write_text('gitdir: unused-metadata-target\n')
  r=self.payload()
  with self.assertRaises(ValueError):v.assemble(self.p/'new-output',{'files':[r]}, {})
  self.assertFalse((self.p/'new-output').exists())
 def test_repository_git_directory_rejected(self):
  (self.p/'.git').mkdir()
  with self.assertRaises(ValueError):v.destination(self.p/'new-output')
  (self.p/'runtime').mkdir()
  for target in [self.p/'runtime/new-output',self.p/'.git/new-output',self.p.parent]:
   with self.assertRaises(ValueError):v.destination(target)
  (self.p/'unrelated').mkdir()
  with self.assertRaises(ValueError):v.destination(self.p/'unrelated/new-output')
 def test_standalone_sibling_restoration_allowed(self):
  r=self.payload();out=v.assemble(self.p/'standalone-output',{'files':[r]}, {})
  self.assertEqual((out/'file').read_bytes(),b'original')
 def test_dependency_enclosing_repository_rejected(self):
  dependency=self.p/'dependency-repo';dependency.mkdir();(dependency/'.git').mkdir()
  v.PRIOR=dependency/'prior';v.PRIOR.mkdir()
  with self.assertRaises(ValueError):v.destination(dependency/'new-output')
 def test_collision_preflight(self):
  r=self.payload();p={'files':[r,r]}
  with self.assertRaises(ValueError):v.assemble(self.p/'out',p,{})
  self.assertFalse((self.p/'out').exists())
  r2=copy.deepcopy(r);r2['original_path']='file/child'
  with self.assertRaises(ValueError):v.assemble(self.p/'out',{'files':[r,r2]}, {})
  self.assertFalse((self.p/'out').exists())
 def test_corrupt_preflight(self):
  r=self.payload();(v.ROOT/'file').write_bytes(b'changed')
  with self.assertRaises(AssertionError):v.assemble(self.p/'out',{'files':[r]}, {})
  self.assertFalse((self.p/'out').exists())
 def test_bounded_gzip(self):
  r=self.payload(data=b'x'*10000,compressed=True);self.assertEqual(len(v.original(r,{})),10000)
  r['bytes']=20
  with self.assertRaises(AssertionError):v.original(r,{})
 def test_dependency_authentication(self):
  r=self.payload();r['dependency']='different'
  with self.assertRaises(AssertionError):v.original(r,{})
  r['dependency']=v.PRIOR.name
  with self.assertRaises(KeyError):v.original(r,{})
 def test_extra_inventory_named_file_rejected(self):
  self.inventory();(v.ROOT/'nested').mkdir();(v.ROOT/'nested/public-file-hashes.json').write_text('{}')
  with self.assertRaises(AssertionError):v.storage()
 def test_inventory_hash_and_limit(self):
  self.inventory();(v.ROOT/'preservation.json').write_text('{}')
  with self.assertRaises(AssertionError):v.storage()
  self.inventory();(v.ROOT/'large').write_bytes(b'x'*(v.LIMIT+1));self.rehash()
  with self.assertRaises(AssertionError):v.storage()
 def test_dependency_inventory_mutation(self):
  self.inventory();(v.PRIOR/'public-file-hashes.json').write_text('{"bad":1}')
  with self.assertRaises(AssertionError):v.storage()
 def test_symlink_inventory_rejected(self):
  self.inventory();(v.ROOT/'link').symlink_to(self.p,target_is_directory=True)
  with self.assertRaises(ValueError):v.storage()

if __name__=='__main__':unittest.main()
