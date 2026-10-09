#!/usr/bin/env python3
"""Validate linked pack resources and invariants; this is not a renderer or client."""
from pathlib import Path
import json
import re
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / 'runtime/BP', ROOT / 'runtime/RP'
PACK_VERSION = [int(part) for part in json.loads((ROOT / 'package.json').read_text())['version'].split('-')[0].split('.')]
errors = []
def check(condition, message):
    if not condition:
        errors.append(message)
def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate JSON key: ' + key)
        result[key] = value
    return result
def parse(path):
    try:
        return json.loads(path.read_text(encoding='utf-8-sig'), object_pairs_hook=unique_object)
    except Exception as exc:
        errors.append(f'{path.relative_to(ROOT)}: {exc}')
        return {}
documents = {path: parse(path) for pack in [BP, RP] for path in pack.rglob('*.json')}
for forbidden in list(BP.rglob('*.jar')) + list(RP.rglob('player.json')):
    errors.append('Forbidden Java JAR / player override: ' + str(forbidden))
manifests = [documents.get(pack / 'manifest.json', {}) for pack in [BP, RP]]
uuids = []
for manifest in manifests:
    header = manifest.get('header', {})
    check(header.get('min_engine_version') == [1, 21, 100], 'Unexpected minimum engine version')
    check(header.get('version') == PACK_VERSION, 'Pack version must match package.json numeric version')
    for entry in [header, *manifest.get('modules', [])]:
        check(entry.get('version') == PACK_VERSION, 'Pack/module version mismatch')
        try:
            uuid.UUID(entry['uuid'])
            uuids.append(entry['uuid'])
        except Exception:
            errors.append('Invalid pack/module UUID')
check(len(uuids) == len(set(uuids)), 'Pack/module UUID collision')
dependencies = manifests[0].get('dependencies', [])
for module in ['@minecraft/server', '@minecraft/server-ui']:
    check(any(d.get('module_name') == module and d.get('version') == '2.0.0' for d in dependencies), module + ' must be stable 2.0.0')
check(any(d.get('uuid') == manifests[1].get('header', {}).get('uuid') and d.get('version') == PACK_VERSION for d in dependencies), 'BP must depend on the matching RP version')
check((BP / 'scripts/main.js').is_file(), 'Missing script entry')

geometries, animations, controllers = {}, set(), set()
for path, obj in documents.items():
    if not isinstance(obj, dict):
        continue
    for geo in obj.get('minecraft:geometry', []):
        ident = geo.get('description', {}).get('identifier')
        check(ident not in geometries, f'Duplicate geometry {ident}')
        geometries[ident] = geo
        names = [bone.get('name') for bone in geo.get('bones', [])]
        check(len(names) == len(set(names)), f'{ident}: duplicate bone name')
        for bone in geo.get('bones', []):
            check(not bone.get('parent') or bone['parent'] in names, f'{ident}: missing parent bone')
            for cube in bone.get('cubes', []):
                check(all(v >= 0 for v in cube.get('size', [])), f'{ident}: negative cube size')
                for face in cube.get('uv', {}).values() if isinstance(cube.get('uv'), dict) else []:
                    check(face.get('uv_rotation', 0) in [0, 90, 180, 270], f'{ident}: invalid UV rotation')
    animations.update(obj.get('animations', {}).keys())
    controllers.update(obj.get('animation_controllers', {}).keys())

terrain = documents.get(RP / 'textures/terrain_texture.json', {}).get('texture_data', {})
icons = documents.get(RP / 'textures/item_texture.json', {}).get('texture_data', {})
def check_texture(value, context):
    if isinstance(value, list):
        for child in value:
            check_texture(child, context)
    elif isinstance(value, dict):
        if 'path' in value:
            check_texture(value['path'], context)
        elif 'textures' in value:
            check_texture(value['textures'], context)
    elif isinstance(value, str):
        check((RP / (value + '.png')).is_file() or (RP / (value + '.tga')).is_file(), f'{context}: missing texture {value}')
for key, obj in {**terrain, **icons}.items():
    check_texture(obj.get('textures'), key)

blocks, items, entities, recipes = {}, {}, {}, {}
scripts = '\n'.join(path.read_text() for path in (BP / 'scripts').rglob('*.js'))
registered = set(re.findall(r"registerCustomComponent\(['\"]([^'\"]+)", scripts))
permutation_count = 0
for path, obj in documents.items():
    if not isinstance(obj, dict):
        continue
    for kind, mapping in [('minecraft:block', blocks), ('minecraft:item', items), ('minecraft:entity', entities)]:
        if kind not in obj:
            continue
        definition = obj[kind]
        ident = definition.get('description', {}).get('identifier')
        check(ident and ident.startswith('ordertocook:'), f'{path.name}: unexpected identifier {ident}')
        check(ident not in mapping, f'Duplicate {kind} {ident}')
        mapping[ident] = definition
        if kind == 'minecraft:block':
            for state, values in definition.get('description', {}).get('states', {}).items():
                count = len(values) if isinstance(values, list) else values.get('max', 0) - values.get('min', 0) + 1
                check(count <= 16, f'{ident} {state}: more than 16 values')
            permutation_count += len(definition.get('permutations', []))
        components_list = [definition.get('components', {}), *[p.get('components', {}) for p in definition.get('permutations', [])]]
        for components in components_list:
            if kind != 'minecraft:entity':
                for component in components:
                    if component.startswith('ordertocook:'):
                        check(component in registered, f'{ident}: unregistered component {component}')
            geo = components.get('minecraft:geometry')
            if geo:
                geo_id = geo if isinstance(geo, str) else geo.get('identifier')
                check(geo_id in geometries, f'{ident}: missing geometry {geo_id}')
            for material in components.get('minecraft:material_instances', {}).values():
                check(material.get('texture') in terrain, f'{ident}: unknown material texture {material.get("texture")}')
            loot = components.get('minecraft:loot')
            if loot:
                loot_path = loot.get('table') if isinstance(loot, dict) else loot
                check(isinstance(loot_path, str) and (BP / loot_path).is_file(), f'{ident}: missing loot {loot_path}')
            icon = components.get('minecraft:icon')
            if icon:
                icon_id = icon if isinstance(icon, str) else icon.get('texture', icon.get('textures', {}).get('default'))
                check(icon_id in icons, f'{ident}: missing item icon {icon_id}')
            triggers = components.get('minecraft:damage_sensor', {}).get('triggers', [])
            for trigger in triggers if isinstance(triggers, list) else [triggers]:
                if 'deals_damage' in trigger:
                    check(isinstance(trigger['deals_damage'], str), f'{ident}: damage_sensor deals_damage must be string')
    for key, definition in obj.items():
        if key.startswith('minecraft:recipe_'):
            ident = definition.get('description', {}).get('identifier')
            recipes[ident] = definition
            check(bool(definition.get('unlock')), f'{ident}: missing recipe unlock data')
    client = obj.get('minecraft:client_entity', {}).get('description')
    if client:
        for texture in client.get('textures', {}).values():
            check_texture(texture, client.get('identifier'))
        for geometry in client.get('geometry', {}).values():
            check(geometry in geometries, f'{client.get("identifier")}: unknown geometry {geometry}')
        for animation in client.get('animations', {}).values():
            check(animation in animations or animation in controllers, f'{client.get("identifier")}: unknown animation {animation}')
for path, obj in documents.items():
    if not isinstance(obj, dict):
        continue
    client = obj.get('minecraft:client_entity', {}).get('description')
    if client:
        check(client.get('identifier') in entities, f'{path.name}: client entity has no BP definition')
for definition in recipes.values():
    outputs = definition.get('result', [])
    for output in outputs if isinstance(outputs, list) else [outputs]:
        ident = output.get('item', '')
        check(ident.startswith('minecraft:') or ident in blocks or ident in items, 'Missing recipe output ' + ident)
        check(ident not in ['ordertocook:food_plate', 'ordertocook:takeout_bag', 'ordertocook:order'], 'Do not craft valid order carriers')
for path in (BP / 'scripts').rglob('*.js'):
    text = path.read_text()
    for target in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]", text):
        check(target in ['@minecraft/server', '@minecraft/server-ui'] or (target.startswith('.') and (path.parent / target).is_file()), f'{path.name}: unresolved import {target}')
check(len(blocks) == 12, f'Expected 12 blocks, got {len(blocks)}')
expected_entities = {'ordertocook:' + name for name in ['customer', 'motorcycle', 'storage', 'seat', 'dining_plate']}
check(set(entities) == expected_entities, f'Entity set mismatch: missing {sorted(expected_entities - set(entities))}, extra {sorted(set(entities) - expected_entities)}')
check(len(recipes) >= 10, 'Survival bootstrap recipes are incomplete')
summary = {'jsonFiles': len(documents), 'blocks': len(blocks), 'items': len(items), 'entities': len(entities), 'recipes': len(recipes), 'geometries': len(geometries), 'animations': len(animations), 'permutations': permutation_count, 'errors': errors}
if errors:
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    sys.exit(1)
print(json.dumps(summary, ensure_ascii=False))
