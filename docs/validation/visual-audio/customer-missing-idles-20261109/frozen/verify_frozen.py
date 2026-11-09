#!/usr/bin/env python3
"""Read-only exact inventory verification; new GUI evidence stays outside this inventory."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parent
manifest=json.loads((ROOT/'artifact-hashes.json').read_text())
for rel,row in manifest['files'].items():
 p=ROOT/rel;assert p.is_file() and not p.is_symlink(),rel
 b=p.read_bytes();assert len(b)==row['size'] and hashlib.sha256(b).hexdigest()==row['sha256'],rel
print('PASS:',len(manifest['files']),'frozen preparation files, read-only check.')
