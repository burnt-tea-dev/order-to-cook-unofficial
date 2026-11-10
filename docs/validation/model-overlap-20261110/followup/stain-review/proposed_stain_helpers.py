# SPDX-License-Identifier: GPL-3.0-only
"""Copy-ready helpers for tools/convert_assets.py; this file is not installed.

Mechanical derivation only. The upstream PNG and its normal copied texture stay
byte-identical. Call flatten_food_plate_stain AFTER separate_food_cap_faces, which
uses original source cube indices. Dependencies already exist in the converter.
"""
import copy
import re
from PIL import Image

FOOD_STAIN_TEXTURE = 'ordertocook:block/food_plate_stains_baked'
FOOD_STAIN_TILE = 'ordertocook_block_food_plate_stains_baked'
FOOD_STAIN_SOURCE_TILE = 'ordertocook_block_food_plate_variants'


def food_stain_sheet(source_image):
    """Four exact 12x12 tops in 16x16 cells, with 2px clamped edge padding.

    Alpha is binary in all pinned source samples. Choose the original stain
    texel when alpha=255 and the original plate texel when alpha=0; do not blend
    colors or apply an arbitrary alphatest cutoff. Source UV=16 units; actual
    source resolution=160. Slot order: full, half, alternate, shifted.
    """
    image = source_image.convert('RGBA')
    if image.size != (160, 160):
        raise ValueError('Changed food stain texture dimensions')
    base = image.crop((0, 0, 12, 12))
    orange = image.crop((0, 26, 12, 38))
    alternate = image.crop((39, 37, 51, 49))
    if set(base.getchannel('A').tobytes()) != {255}:
        raise ValueError('Changed food stain base alpha')
    for texture, opaque in ((orange, 37), (alternate, 79)):
        alpha = texture.getchannel('A').tobytes()
        if set(alpha) != {0, 255} or alpha.count(255) != opaque:
            raise ValueError('Changed food stain binary alpha contract')
    # Family 10's quad overhangs the plate by 1px. Its last source row is the
    # overhanging world-Z strip, so it may be discarded only while transparent.
    if any(orange.crop((0, 11, 12, 12)).getchannel('A').tobytes()):
        raise ValueError('Changed food stain outside-plate alpha')
    tiles = [base.copy() for _ in range(4)]
    tiles[0].paste(orange, (0, 0), orange)
    half = orange.crop((0, 0, 12, 6))
    if half.getchannel('A').tobytes().count(255) != 18:
        raise ValueError('Changed food stain half alpha contract')
    tiles[1].paste(half, (0, 0), half)
    # Family 8's V direction is opposite the plate top. U is shared.
    alternate = alternate.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    tiles[2].paste(alternate, (0, 0), alternate)
    tiles[3].paste(orange, (0, 1), orange)
    result = Image.new('RGBA', (16, 64))
    for slot, tile in enumerate(tiles):
        for y in range(16):
            for x in range(16):
                result.putpixel((x, slot*16+y), tile.getpixel(
                    (min(11, max(0, x-2)), min(11, max(0, y-2)))))
    return result


def flatten_food_plate_stain(name, cubes):
    """Rebind only the base up face and remove only its matching stain quad.

    39/40 pinned food stages have one redundant alpha-test stain plane. Keep
    every other face/cube, including family 10's separate Y=1.0625 food decal.
    Refuse changed source contracts rather than silently flattening new content.
    """
    match = re.fullmatch(r'ordertocook:block/food_plate_anim/(10|[1-9])_([1-4])', name)
    if not match:
        return False
    family, phase = map(int, match.groups())
    found = [index for index, cube in enumerate(cubes)
             if cube['origin'][1] == 1.01563 and cube['size'][1] == 0]
    if family == 9 and phase == 4:
        if found:
            raise ValueError('Changed stain-free food stage contract')
        return False
    slot = 1 if family == 2 else 2 if family == 8 else 3 if family == 10 else 0
    index = (13, 11, 8, 4)[phase-1] if family == 10 else 1
    expected_plane = {'origin': [-6, 1.01563, 0 if family == 2 else -7 if family == 10 else -6],
                      'size': [12, 0, 6 if family == 2 else 12], 'uv': {'up': {
                          'uv': [3.9, 4.9] if family == 8 else [0, 2.6],
                          'uv_size': [1.2, -1.2] if family == 8 else [1.2, .6 if family == 2 else 1.2],
                          'material_instance': FOOD_STAIN_SOURCE_TILE}}}
    expected_top = {'uv': [0, 0], 'uv_size': [1.2, 1.2],
                    'material_instance': FOOD_STAIN_SOURCE_TILE}
    if (not cubes or found != [index] or cubes[index] != expected_plane
            or cubes[0]['origin'] != [-6, 0, -6] or cubes[0]['size'] != [12, 1, 12]
            or cubes[0].get('rotation') or cubes[0].get('pivot')
            or cubes[0]['uv'].get('up') != expected_top):
        raise ValueError('Changed food stain plate/quad/UV contract')
    cubes[0]['uv']['up'] = {'uv': [2, slot*4+.5], 'uv_size': [12, 3],
                           'material_instance': FOOD_STAIN_TILE}
    del cubes[index]
    return True
