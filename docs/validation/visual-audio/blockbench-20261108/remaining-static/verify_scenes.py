#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Validate recorded inputs and artifacts, then reproduce all review scenes.
Does not perform or claim GUI or game-client acceptance.
"""
from pathlib import Path
import hashlib,json,subprocess,sys
D=Path(__file__).resolve().parent
ROOT=D.parents[4]
m=json.loads((D/'manifest.json').read_text())
assert sum(m['layouts'].values())==37
assert len(m['screenshots'])==38
for capture,details in m['screenshots'].items():
 assert (D/details['scene']).is_file(),capture
 assert (D/capture).read_bytes().startswith(b'\xff\xd8\xff'),capture
for scope,base in [('inputs',ROOT),('evidence',D)]:
 for path,entry in m[scope].items():
  b=(base/path).read_bytes()
  assert len(b)==entry['bytes'],path
  assert hashlib.sha256(b).hexdigest()==entry['sha256'],path
for script in ['build_scenes.py','build_stove_pose_scenes.py','build_stove_candidate_scenes.py']:
 subprocess.run([sys.executable,str(D/script)],check=True)
for path,entry in m['evidence'].items():
 if path.endswith(('.bbmodel','.geo.json')) or path.endswith('poses.json'):
  assert hashlib.sha256((D/path).read_bytes()).hexdigest()==entry['sha256'],path
print(f"PASS: {len(m['inputs'])} source/runtime inputs; {len(m['evidence'])} evidence identities; 37 layouts reproduced (21 static, 9 source/baseline and 7 source/candidate/control). Native rendering not tested.")
