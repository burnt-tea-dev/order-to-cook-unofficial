#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Build original-main/current comparison fixtures; no GUI/engine acceptance."""
from pathlib import Path
import json,subprocess,sys,tempfile
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'docs/validation/visual-audio/blockbench-20261108/remaining-static'))
import scene_lib as sl
sl.OUT=Path(__file__).resolve().parent/'scenes';sl.OUT.mkdir(exist_ok=True)
terrain=json.loads((ROOT/'runtime/RP/textures/terrain_texture.json').read_text())['texture_data']
texmap={k:ROOT/('runtime/RP/'+v['textures']+'.png') for k,v in terrain.items() if isinstance(v['textures'],str)}
with tempfile.TemporaryDirectory() as tmp:
 for stage in [4,8,32,40]:
  rel=f'runtime/RP/models/blocks/food_plate_display_{stage}.geo.json'
  base=Path(tmp)/f'{stage}.json';base.write_bytes(subprocess.check_output(['git','show','a4176b193294d8f57234b3b316ad6b092acf5d5b:'+rel],cwd=ROOT))
  s=sl.Scene(f'Stain stage {stage}: original main left / baked top right')
  s.bedrock(base,texmap,[-9,0,0],name='BASELINE a4176b1')
  s.bedrock(ROOT/rel,texmap,[9,0,0],name='REPAIRED BAKED TOP')
  s.save(f'stain-stage{stage}-pair.bbmodel')
print(sl.OUT)
