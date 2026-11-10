#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Read-only structural review of the shipped stain patch against a Git baseline.

Run from the repository or pass --repo. Produces no checkout changes; --output
is optional. Requires Pillow. This is not a native Minecraft rendering test.
"""
import argparse, copy, hashlib, io, json, re, subprocess
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo',type=Path,default=Path.cwd())
parser.add_argument('--baseline',default='48ef920779cd7d76244061bad9dd31ffc2f6b57a')
parser.add_argument('--output',type=Path)
args=parser.parse_args();repo=args.repo.resolve()
def current(path):return (repo/path).read_bytes()
def prior(path):return subprocess.check_output(['git','show',f'{args.baseline}:{path}'],cwd=repo)
def cj(path):return json.loads(current(path))
def bj(path):return json.loads(prior(path))
def unchanged(path):
    assert current(path)==prior(path),f'Unexpected modification: {path}'
    return path

base_actor=bj('runtime/RP/models/entity/dining_plate.geo.json')['minecraft:geometry']
actor=cj('runtime/RP/models/entity/dining_plate.geo.json')['minecraft:geometry']
assert len(base_actor)==len(actor)==41
assert actor[0]==base_actor[0] and actor[36]==base_actor[36]
modified=[]
for stage in range(1,41):
    family,phase=(stage-1)//4+1,(stage-1)%4+1
    path=f'runtime/RP/models/blocks/food_plate_display_{stage}.geo.json'
    before=bj(path);after=cj(path)
    if stage==36:
        assert before==after;continue
    index=(13,11,8,4)[phase-1] if family==10 else 1
    slot=1 if family==2 else 2 if family==8 else 3 if family==10 else 0
    expected=copy.deepcopy(before)
    cubes=expected['minecraft:geometry'][0]['bones'][0]['cubes']
    assert cubes[index]['origin'][1]==1.01563 and cubes[index]['size'][1]==0
    cubes[0]['uv']['up']={'uv':[2,slot*4+.5],'uv_size':[12,3],
                        'material_instance':'ordertocook_block_food_plate_stains_baked'}
    del cubes[index]
    assert after==expected,f'Unexpected block geometry delta: {stage}'
    expected_actor=copy.deepcopy(base_actor[stage])
    ac=expected_actor['bones'][0]['cubes']
    ac[0]['uv']['up']={'uv':[204,4+slot*16],'uv_size':[12,12]}
    del ac[index]
    assert actor[stage]==expected_actor,f'Unexpected actor geometry delta: {stage}'
    modified.append(stage)
assert len(modified)==39

# Material declarations remain exact except for the required new named material.
before=bj('runtime/BP/blocks/food_plate_display.json')['minecraft:block']
after=cj('runtime/BP/blocks/food_plate_display.json')['minecraft:block']
expected=copy.deepcopy(before);added=0
for component in [expected['components']]+[p['components'] for p in expected['permutations']]:
    mats=component.get('minecraft:material_instances')
    if not mats:continue
    identifier=component.get('minecraft:geometry','')
    stage=int(identifier.rsplit('_',1)[-1]) if isinstance(identifier,str) and identifier.startswith('geometry.ordertocook.food_plate_display_') else None
    # The base definition inherits last-stage material defaults, as before.
    if component is expected['components'] or stage in modified:
        old=mats['ordertocook_block_food_plate_variants']
        mats['ordertocook_block_food_plate_stains_baked']={**old,'texture':'ordertocook_block_food_plate_stains_baked'}
        added+=1
assert expected==after,'Unexpected food display block/material delta'
assert added==40
terrain=cj('runtime/RP/textures/terrain_texture.json')['texture_data']
assert terrain['ordertocook_block_food_plate_stains_baked']=={'textures':'textures/ordertocook/block/food_plate_stains_baked'}
for path in ['runtime/BP/blocks/dining_plate_block.json','runtime/RP/entity/dining_plate.entity.json',
             'runtime/RP/render_controllers/dining_plate.render_controllers.json','runtime/BP/scripts/dining.js',
             'runtime/RP/models/blocks/food_plate_display_0.geo.json']:
    unchanged(path)
assert cj('runtime/RP/entity/dining_plate.entity.json')['minecraft:client_entity']['description']['materials']=={'default':'entity_alphatest'}
assert cj('runtime/BP/blocks/dining_plate_block.json')['minecraft:block']['components']['minecraft:material_instances']['*']['render_method']=='alpha_test'

# Original image regions, including two-pixel extrusion, remain pixel-identical.
atlas_path='runtime/RP/textures/ordertocook/entity/dining_plate_atlas.png'
a=Image.open(io.BytesIO(current(atlas_path))).convert('RGBA')
b=Image.open(io.BytesIO(prior(atlas_path))).convert('RGBA')
assert a.size==b.size==(256,256)
assert a.crop((0,0,36,36)).tobytes()==b.crop((0,0,36,36)).tobytes()
assert a.crop((36,0,200,164)).tobytes()==b.crop((36,0,200,164)).tobytes()
sheet=Image.open(repo/'runtime/RP/textures/ordertocook/block/food_plate_stains_baked.png').convert('RGBA')
assert sheet.size==(16,64) and set(sheet.getchannel('A').tobytes())=={255}
assert a.crop((202,2,218,66)).tobytes()==sheet.tobytes()

# All unrelated dirty-plate render assets remain byte-identical. Dishwasher
# meshes have a separate intentional door repair, so compare their plate bones.
paths=['runtime/RP/textures/ordertocook/block/food_plate_variants.png',
       'runtime/RP/textures/ordertocook/item/food_plate2.png','runtime/RP/textures/items/dirty_plate.png',
       'runtime/BP/items/dirty_plate.json','runtime/RP/textures/item_texture.json',
       'runtime/BP/blocks/washingtable.json','runtime/RP/textures/ordertocook/block/washingtable.png',
       'runtime/RP/textures/ordertocook/block/dishwasher.png','runtime/BP/blocks/dishwasher.json']
paths += [str(p.relative_to(repo)) for p in sorted((repo/'runtime/RP/models/blocks').glob('washingtable*.geo.json'))]
for path in paths:unchanged(path)
source_dir=repo/'upstream/reference/common/src/main/resources/assets/ordertocook'
source_files=[str(p.relative_to(repo)) for p in sorted((source_dir/'models/block/food_plate_anim').glob('*.json'))]
source_files += [str((source_dir/'textures/block/food_plate_variants.png').relative_to(repo))]
for path in source_files:unchanged(path)
dishwasher=0;plate_bones=0
for path in sorted((repo/'runtime/RP/models/blocks').glob('dishwasher_[0-6]_*.geo.json')):
    rel=str(path.relative_to(repo));old=bj(rel)['minecraft:geometry'][0];new=cj(rel)['minecraft:geometry'][0]
    old_bones={b['name']:b for b in old['bones']};new_bones={b['name']:b for b in new['bones']}
    for name,bone in old_bones.items():
        if name.startswith(('drity_dish','clear_dish')):
            assert new_bones[name]==bone;plate_bones+=1
    dishwasher+=1
assert dishwasher==82

manifest=cj('runtime/asset_conversion_manifest.json')['assets']
derived='RP/textures/ordertocook/block/food_plate_stains_baked.png'
assert any(e['output']==derived and 'binary-alpha' in e['operation'] for e in manifest)
for stage in modified:
    path=f'RP/models/blocks/food_plate_display_{stage}.geo.json'
    entries=[e for e in manifest if e['output']==path]
    assert entries and all('stain' in e['operation'] for e in entries)

report={'result':'PASS','baseline':args.baseline,'reviewed_paths_sha256':{
    p:hashlib.sha256(current(p)).hexdigest() for p in [
        'tools/convert_assets.py','tests/test_food_stain_bake.py','runtime/BP/blocks/food_plate_display.json',
        'runtime/RP/models/entity/dining_plate.geo.json','runtime/RP/textures/ordertocook/entity/dining_plate_atlas.png',
        'runtime/RP/textures/ordertocook/block/food_plate_stains_baked.png']},
    'stained_stages_checked_in_both_paths':modified,'stain_free_stage_unchanged':36,
    'stage_zero_unchanged':True,'material_additions':added,'atlas_original_regions_unchanged':True,
    'unrelated_dirty_plate_asset_files_unchanged':len(paths),'source_files_unchanged':len(source_files),
    'dishwasher_poses_checked':dishwasher,'dishwasher_plate_bones_unchanged':plate_bones,
    'limitations':['Static structural/pixel checks only.','No native Minecraft rendering or flicker reproduction.']}
text=json.dumps(report,indent=2)+'\n'
if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text)
print(text,end='')
