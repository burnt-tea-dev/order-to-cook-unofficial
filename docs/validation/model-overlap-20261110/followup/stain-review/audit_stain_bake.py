#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Read-only source audit and mechanical prototype; never edits the checkout.

The preview is CPU-rendered evidence, not a Minecraft screenshot or a client test.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, json, math, sys
from collections import Counter, defaultdict
from PIL import Image, ImageDraw
import numpy as np

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo',type=Path,default=Path.cwd(),help='Order To Cook adaptation repository')
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent,help='Evidence output folder')
args=parser.parse_args()
REPO=args.repo.resolve()
OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)
ASSETS=REPO/'upstream/reference/common/src/main/resources/assets/ordertocook'
TEX=ASSETS/'textures/block/food_plate_variants.png'
SOURCE=Image.open(TEX).convert('RGBA')
assert SOURCE.size == (160,160)

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
conv=module('converter',REPO/'tools/convert_assets.py')
render=module('review',REPO/'tools/render_visual_review.py')
conv.ASSETS=ASSETS

def key(e):
    return tuple(e['from'][::2]+e['to'][::2]+e['faces']['up']['uv'])

def sample(face,e,x,z):
    u0,v0,u1,v1=face['uv']
    assert not face.get('rotation')
    u=u0+(u1-u0)*(x-e['from'][0])/(e['to'][0]-e['from'][0])
    v=v0+(v1-v0)*(z-e['from'][2])/(e['to'][2]-e['from'][2])
    return SOURCE.getpixel((math.floor(u*10),math.floor(v*10)))

def build_tile(base,stain):
    assert base['from']==[2,0,2] and base['to']==[14,1,14]
    assert base['faces']['up']['uv']==[1.2,1.2,0,0]
    assert not base.get('rotation',{}).get('angle')
    assert not stain.get('rotation',{}).get('angle')
    assert stain['from'][1] == stain['to'][1] == 1.01563
    assert set(stain['faces'])=={'up'}
    # Source physical X/Z raster has exactly one source texel per model pixel.
    assert math.isclose(abs((stain['faces']['up']['uv'][2]-stain['faces']['up']['uv'][0])*10),stain['to'][0]-stain['from'][0])
    assert math.isclose(abs((stain['faces']['up']['uv'][3]-stain['faces']['up']['uv'][1])*10),stain['to'][2]-stain['from'][2])
    tile=Image.new('RGBA',(12,12)); counts=Counter(); outside=0
    for py in range(12):
        for px in range(12):
            # Preserve the existing base-top orientation: source pixel (0,0)
            # is at Java world X=13.5, Z=13.5 (both axes reversed).
            x,z=13.5-px,13.5-py
            base_rgba=sample(base['faces']['up'],base,x,z)
            assert base_rgba[3]==255
            inside=stain['from'][0]<=x<stain['to'][0] and stain['from'][2]<=z<stain['to'][2]
            rgba=sample(stain['faces']['up'],stain,x,z) if inside else (0,0,0,0)
            assert rgba[3] in (0,255), 'Do not silently blend semi-transparent source pixels'
            counts[rgba[3]]+=1
            tile.putpixel((px,py),rgba if rgba[3]==255 else base_rgba)
    # Check even the geometrically protruding strip: deleting it is safe only
    # if every texel outside the plate footprint was already transparent.
    for x in np.arange(stain['from'][0]+.5,stain['to'][0],1):
        for z in np.arange(stain['from'][2]+.5,stain['to'][2],1):
            if not (2<=x<14 and 2<=z<14):
                if sample(stain['faces']['up'],stain,float(x),float(z))[3]:outside+=1
    assert outside==0
    return tile,dict(counts),outside

models=[]; variants={}; rows=[]
for family in range(1,11):
    for phase in range(1,5):
        name=f'{family}_{phase}';path=ASSETS/f'models/block/food_plate_anim/{name}.json';m=json.loads(path.read_text())
        found=[(i,e) for i,e in enumerate(m['elements']) if e['from'][1]==e['to'][1]==1.01563]
        assert len(found)==(0 if name=='9_4' else 1)
        entry={'model':name,'stage':(family-1)*4+phase,'source':str(path.relative_to(REPO))}
        if found:
            i,e=found[0];k=key(e);tile,alpha,outside=build_tile(m['elements'][0],e)
            if k not in variants:variants[k]={'slot':len(variants),'tile':tile,'names':[],'alpha':alpha,'outside_opaque':outside}
            else:assert tile.tobytes()==variants[k]['tile'].tobytes()
            variants[k]['names'].append(name)
            entry.update(stain_index=i,slot=variants[k]['slot'],base_y=1,stain_y=1.01563,alpha_counts=alpha,opaque_outside_plate=outside)
        models.append((m,entry));rows.append(entry)
assert len(variants)==4
# One 16x64 derivative is small enough to keep the dining atlas 256x256:
# existing source widths 32 and 160, plus 4px each; derived 16+4 => 220px.
sheet=Image.new('RGBA',(16,64))
for variant in variants.values():
    tile,slot=variant['tile'],variant['slot']
    for y in range(16):
        for x in range(16):
            sheet.putpixel((x,16*slot+y),tile.getpixel((min(11,max(0,x-2)),min(11,max(0,y-2)))))
sheet.save(OUT/'food_plate_stains_baked.prototype.png')

# Verify the normalized 16-unit UV mapping for every physical texel in every
# source layout, using the same sign change as the Bedrock converter.
checks=0
for m,e in models:
    if 'slot' not in e:continue
    slot=e['slot'];uv=[2,4*slot+.5];size=[12,3]
    for py in range(12):
        for px in range(12):
            u=uv[0]+(px+.5)/12*size[0]
            v=uv[1]+(py+.5)/12*size[1]
            actual=sheet.getpixel((math.floor(u),math.floor(v*4)))
            expected=variants[key(m['elements'][e['stain_index']])]['tile'].getpixel((px,py))
            assert actual==expected;checks+=1

# Preview original/repaired stage-terminal shapes using existing converter and
# CPU rasterizer. Other geometry, food UVs, face colors, and the source PNG stay
# unchanged; source cap repair applies to both variants.
w,h=320,240;preview=Image.new('RGB',(w*4,h*5),(231,235,237));draw=ImageDraw.Draw(preview)
for family in range(1,11):
    m,e=models[family*4-1]
    raw=[conv.java_cube(c,m['textures']) for c in m['elements']]
    conv.separate_food_cap_faces('ordertocook:block/food_plate_anim/'+e['model'],raw)
    repaired=copy.deepcopy(raw)
    materials={'ordertocook_block_food_plate_variants':np.asarray(SOURCE),'baked':np.asarray(sheet)}
    if 'slot' in e:
        repaired[0]['uv']['up']={'uv':[2,4*e['slot']+.5],'uv_size':[12,3],'material_instance':'baked'}
        del repaired[e['stain_index']]
    scenes=[]
    for cubes,label in [(raw,'Current'),(repaired,'Baked prototype')]:
        geo={'description':{'texture_width':16,'texture_height':16},'bones':[{'name':'root','pivot':[0,0,0],'cubes':cubes}]}
        scenes.append({'quads':render.geometry_quads(geo,materials),'label':label})
    camera=(3,7,-4.2);fit=render.bounds(scenes,camera)
    for col,scene in enumerate(scenes):
        x=((family-1)%2*2+col)*w;y=((family-1)//2)*h
        preview.paste(render.raster(scene,(w,h-24),camera,fit).convert('RGB'),(x,y+24));draw.text((x+8,y+7),f'{e["model"]} / {scene["label"]}',fill=(20,30,40))
preview.save(OUT/'dirty-terminal-bake-preview.png')
summary={'source_sha256':hashlib.sha256(TEX.read_bytes()).hexdigest(),'models':40,'stained':39,'unchanged_no_stain':'9_4','layout_count':4,'physical_texel_checks':checks,'sheet_dimensions':[16,64],'dining_atlas_raw_width_after_new_sheet':220,'dining_atlas_dimensions_after_new_sheet':[256,256], 'variants':[{k:v for k,v in v.items() if k!='tile'}|{'layout':list(k),'java_up_uv':[14,4*v['slot']+3.5,2,4*v['slot']+.5],'bedrock_up_uv':[2,4*v['slot']+.5],'bedrock_up_uv_size':[12,3]} for k,v in variants.items()],'models_detail':rows,'limitations':['CPU source/texel audit only; no native client, depth precision, lighting, mipmap, large-coordinate, or motion test.','Flattening deliberately removes the original 0.01563 model-pixel layer height/parallax; remaining food geometry and food decals are untouched.']}
(OUT/'audit.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k not in ['models_detail','variants']},indent=2));print(json.dumps(summary['variants'],indent=2))
