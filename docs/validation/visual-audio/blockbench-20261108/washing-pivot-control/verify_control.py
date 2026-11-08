#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Verify only the recorded scene control and evidence identities."""
from pathlib import Path
import hashlib,json
D=Path(__file__).resolve().parent
original=D.parent/'washing-water/scenes/water-after-5.bbmodel'
control=D/'water-source-zero-angle-pivots-normalized-5.bbmodel'
a=json.loads(original.read_text());b=json.loads(control.read_text())
assert b['name']=='water-source-zero-angle-pivots-normalized-5'
a['name']=b['name']
expected={6:[-15,16,5],7:[-15,17,5],8:[-15,20,5],9:[-15,19,5],13:[-16.5,13.5,-.5],14:[-16.5,12.5,-1]}
for index,old in expected.items():
 assert a['elements'][index]['origin']==old
 assert a['elements'][index]['rotation']==[0,0,0]
 a['elements'][index]['origin']=[-14,0,0]
assert a==b,'Unexpected change beyond display name and six zero-angle pivots'
manifest=json.loads((D/'manifest.json').read_text())
for path,identity in manifest.items():
 data=(D/path).read_bytes()
 assert len(data)==identity['bytes'],path
 assert hashlib.sha256(data).hexdigest()==identity['sha256'],path
print('PASS: six inactive source pivots only; original scene, control and two raw GUI captures match recorded identities. Native rendering not tested.')
