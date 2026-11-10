#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Independent physical-coordinate checks of the proposed implementation.
No writes to the repository; run with PYTHONDONTWRITEBYTECODE=1.
"""
import argparse, copy, importlib.util, math, pathlib, unittest
from PIL import Image
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo',type=pathlib.Path,default=pathlib.Path.cwd())
args,unittest_args=parser.parse_known_args()
ROOT=args.repo.resolve()
HERE=pathlib.Path(__file__).resolve().parent
ASSETS=ROOT/'upstream/reference/common/src/main/resources/assets/ordertocook'
def load(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
h=load('proposed_stain_helpers',HERE/'proposed_stain_helpers.py')
c=load('converter_under_review',ROOT/'tools/convert_assets.py');c.ASSETS=ASSETS
source=Image.open(ASSETS/'textures/block/food_plate_variants.png').convert('RGBA')

def sample_java_up(element,x,z):
    face=element['faces']['up'];u0,v0,u1,v1=face['uv']
    u=u0+(u1-u0)*(x-element['from'][0])/(element['to'][0]-element['from'][0])
    v=v0+(v1-v0)*(z-element['from'][2])/(element['to'][2]-element['from'][2])
    return source.getpixel((math.floor(10*u),math.floor(10*v)))

class BakeTests(unittest.TestCase):
    def test_all_5616_physical_texels_and_exact_other_cube_preservation(self):
        sheet=h.food_stain_sheet(source);checks=0;changed=0
        self.assertEqual(sheet.size,(16,64))
        for family in range(1,11):
            for phase in range(1,5):
                name=f'ordertocook:block/food_plate_anim/{family}_{phase}'
                model=c.resolve_model(name)
                cubes=[c.java_cube(e,model['textures']) for e in model['elements']]
                c.separate_food_cap_faces(name,cubes)
                before=copy.deepcopy(cubes)
                result=h.flatten_food_plate_stain(name,cubes)
                with self.subTest(model=name):
                    if not result:
                        self.assertEqual((family,phase),(9,4));self.assertEqual(cubes,before);continue
                    changed+=1
                    index=(13,11,8,4)[phase-1] if family==10 else 1
                    expected=copy.deepcopy(before);expected[0]['uv']['up']=cubes[0]['uv']['up'];del expected[index]
                    self.assertEqual(cubes,expected)
                    stain=model['elements'][index];top=cubes[0]['uv']['up']
                    for py in range(12):
                        for px in range(12):
                            # Compute original Java world-space sample directly,
                            # independently of the implementation's crop/paste.
                            x,z=13.5-px,13.5-py
                            expected=sample_java_up(model['elements'][0],x,z)
                            if stain['from'][0]<=x<stain['to'][0] and stain['from'][2]<=z<stain['to'][2]:
                                overlay=sample_java_up(stain,x,z)
                                self.assertIn(overlay[3],(0,255))
                                if overlay[3]:expected=overlay
                            u=top['uv'][0]+(px+.5)/12*top['uv_size'][0]
                            v=top['uv'][1]+(py+.5)/12*top['uv_size'][1]
                            actual=sheet.getpixel((math.floor(u),math.floor(4*v)))
                            self.assertEqual(actual,expected);checks+=1
        self.assertEqual((changed,checks),(39,5616))

    def test_binary_alpha_guard_and_shifted_overhang(self):
        for xy in [(0,0),(5,30),(45,40)]:
            changed=source.copy();changed.putpixel(xy,(*changed.getpixel(xy)[:3],128))
            with self.assertRaises(ValueError):h.food_stain_sheet(changed)
        changed=source.copy();changed.putpixel((5,37),(1,2,3,255))
        with self.assertRaises(ValueError):h.food_stain_sheet(changed)

    def test_rejects_changed_height_uv_faces_and_base(self):
        name='ordertocook:block/food_plate_anim/1_1';model=c.resolve_model(name)
        raw=[c.java_cube(e,model['textures']) for e in model['elements']]
        changes=[lambda x:x[1]['origin'].__setitem__(1,1.01564),
                 lambda x:x[1]['uv']['up']['uv'].__setitem__(0,.1),
                 lambda x:x[1]['uv'].__setitem__('down',copy.deepcopy(x[1]['uv']['up'])),
                 lambda x:x[0]['size'].__setitem__(1,1.01)]
        for change in changes:
            with self.subTest(change=change):
                changed=copy.deepcopy(raw);change(changed)
                with self.assertRaises(ValueError):h.flatten_food_plate_stain(name,changed)

    def test_noop_for_unrelated_and_stain_free_geometry(self):
        for name in ['ordertocook:block/dirty_plate_item','ordertocook:block/food_plate_anim/9_4','ordertocook:block/washingtable_1']:
            model=c.resolve_model(name);cubes=[c.java_cube(e,model['textures']) for e in model['elements']];before=copy.deepcopy(cubes)
            self.assertFalse(h.flatten_food_plate_stain(name,cubes));self.assertEqual(cubes,before)

    def test_original_copies_and_atlas_offsets_need_not_change(self):
        original=ASSETS/'textures/block/food_plate_variants.png'
        self.assertEqual(original.read_bytes(),(ROOT/'runtime/RP/textures/ordertocook/block/food_plate_variants.png').read_bytes())
        # Original tiles: food_plate_placed32x32, food_plate_variants160x160.
        x=2;offsets=[]
        for width in [32,160,16]:offsets.append(x);x+=width+4
        self.assertEqual(offsets,[2,38,202]);self.assertEqual(1<<(x-3).bit_length(),256)

if __name__=='__main__':unittest.main(argv=[__file__,*unittest_args],verbosity=2)
