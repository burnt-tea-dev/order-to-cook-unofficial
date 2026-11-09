#!/usr/bin/env python3
"""Read-only hash/provenance checks for the separate actual-GUI receipt."""
from pathlib import Path
import json,hashlib
from PIL import Image
W=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda p:json.loads(p.read_text())
r=load(W/'gui-receipt.json');m=load(W/'scene-manifest.json');scenes={s['id']:s for s in m['samples']}
assert sha(W/'scene-manifest.json')==r['prepared_manifest_sha256']
assert sha(W/'scene-freeze-hashes.json')==r['scene_freeze_manifest_sha256']
assert m['gui_run'] is False and all('prepared' in s['status'] for s in m['samples'])
for p,h in load(W/'scene-freeze-hashes.json').items():assert sha(W/p)==h
original=load(W/'artifact-hashes.json')
for p,h in original.items():assert sha(W/p)==h,('original preparation artifact changed',p)
seen=set()
for row in r['customer_observations']+r['diagnostics']:
 assert row['path'] not in seen;seen.add(row['path']);p=W/row['path']
 assert sha(p)==row['sha256'] and p.stat().st_size==row['bytes']
 with Image.open(p) as im:assert list(im.size)==row['dimensions'] and im.format==row['format']=='JPEG'
for row in r['customer_observations']:
 s=scenes[row['scene_id']];assert row['scene']==s['path'] and row['scene_sha256']==s['sha256'];assert sha(W/s['path'])==row['scene_sha256']
 assert row['rig']==s['rig'] and row['clip']==s['clip'] and row['clip_seconds']==s['time'] and row['query_inputs']==s['query_inputs'] and row['sides']==s['sides']
 assert row['source_screen_side'].startswith('right') and row['rp_screen_side'].startswith('left')
 assert row['independent_image_inspection'] and row['frame_complete'] and row['models_unselected']
for row in r['diagnostics']:assert row['counts_as_customer_scene'] is False
counts={'customer_photographs':len(r['customer_observations']),'unique_customer_scenes':len({x['scene_id'] for x in r['customer_observations']}),'diagnostic_photographs':len(r['diagnostics']),'prepared_scenes':len(scenes)}
assert counts==r['counts']
result={'status':'PASS hash/receipt integrity, not automated image-quality or native acceptance','counts':counts,'original_preparation_files_unchanged':len(original),'frozen_scene_files_unchanged':len(scenes),'raw_images_readable_and_hash_bound':len(seen),'image_pixels_modified':False,'prepared_manifest_promoted':False,'receipt_sha256':sha(W/'gui-receipt.json')}
(W/'gui-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
