#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Create review-only Java Display fixtures, never substitute for engine QA.

Native Bedrock geometry is decoded with the existing editor codec helper, then
shifted to Java's 8,0,8 origin for Blockbench's Display mode. All source texture
bytes are embedded unchanged. The fixture does not change runtime geometry.
"""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT/'docs/validation/visual-audio/blockbench-20261108/remaining-static'))
import scene_lib as sl

sl.OUT = Path(__file__).parent/'scenes'
sl.OUT.mkdir(exist_ok=True)
source = ROOT/'upstream/reference/common/src/main/resources/assets/ordertocook/models/block/refrigerator.json'
texture = ROOT/'runtime/RP/textures/ordertocook/block/refrigerator.png'
path = ROOT/'runtime/RP/models/blocks/refrigerator_item.geo.json'
native = json.loads(path.read_text())['minecraft:geometry'][0]

for name, compact in [('java-source-display', False), ('compact-bedrock-item-display', True)]:
    scene = sl.Scene(name)
    if compact:
        scene.bedrock(path, texture, [8,0,8])
        display = native['item_display_transforms']
    else:
        scene.java(source, texture, [8,0,8])
        display = json.loads(source.read_text())['display']
    scene.j['meta']['model_format'] = 'java_block'
    scene.j['resolution'] = {'width':96, 'height':96}
    scene.j['display'] = {key:value for key,value in display.items() if key != 'on_shelf'}
    scene.save(name+'.bbmodel')
scene = sl.Scene('CARY .54 exact cached item display, prior to first-person correction')
cached = Path(__file__).parent/'cary-054-refrigerator-item.geo.json'
scene.bedrock(cached, texture, [8,0,8])
scene.j['meta']['model_format'] = 'java_block'
scene.j['resolution'] = {'width':96, 'height':96}
scene.j['display'] = json.loads(cached.read_text())['minecraft:geometry'][0]['item_display_transforms']
scene.save('cary-054-item-display.bbmodel')
print(sl.OUT)
