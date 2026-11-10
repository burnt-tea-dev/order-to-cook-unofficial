// SPDX-License-Identifier: GPL-3.0-only
// Serialized item contract only. This does not emulate a Bedrock camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const sourcePath = 'upstream/reference/common/src/main/resources/assets/ordertocook/models/block/refrigerator.json';
const source = read(sourcePath);
const block = read('runtime/BP/blocks/refrigerator.json')['minecraft:block'];
const itemPath = 'runtime/RP/models/blocks/refrigerator_item.geo.json';
const item = read(itemPath), mesh = item['minecraft:geometry'][0];
const contexts = ['firstperson_righthand', 'firstperson_lefthand', 'thirdperson_righthand', 'thirdperson_lefthand', 'gui', 'ground', 'fixed'];

test('fridge item uses a separate complete source-derived mesh without changing placed dispatch', () => {
  assert.equal(block.components['minecraft:item_visual'].geometry, mesh.description.identifier);
  assert.equal(mesh.description.identifier, 'geometry.ordertocook.refrigerator_item');
  assert.equal(block.components['minecraft:geometry'], 'geometry.ordertocook.refrigerator_lower_0');
  assert.equal(block.components['minecraft:block_entity'].container.slot_count, 54);
  assert.equal(block.components['minecraft:collision_box'], true);
  assert.equal(block.components['minecraft:selection_box'], true);
  assert.equal(block.permutations.length, 180);
  for (const row of block.permutations) assert.ok(!('minecraft:item_visual' in row.components));
  const upper = read('runtime/BP/blocks/refrigerator_upper.json')['minecraft:block'];
  assert.ok(!upper.components['minecraft:item_visual']);
  assert.equal(upper.components['minecraft:block_entity'].container.slot_count, 27);
  assert.equal(mesh.bones.length, 1);
  assert.equal(mesh.bones[0].cubes.length, 10);
  assert.equal(source.elements.length, 10);
});

test('all ten source elements are uniformly half-sized and retain all sixty source face UVs', () => {
  assert.deepEqual([mesh.description.texture_width, mesh.description.texture_height], [16, 16]);
  const points = [];
  mesh.bones[0].cubes.forEach((cube, index) => {
    const element = source.elements[index];
    const lo = element.from.map((v, axis) => Math.min(v, element.to[axis]));
    const hi = element.from.map((v, axis) => Math.max(v, element.to[axis]));
    assert.deepEqual(cube.origin, [(8-hi[0])/2, lo[1]/2+4, (lo[2]-8)/2]);
    assert.deepEqual(cube.size, hi.map((v, axis) => (v-lo[axis])/2));
    assert.ok(!cube.rotation);
    assert.deepEqual(Object.keys(cube.uv).sort(), Object.keys(element.faces).sort());
    for (const [face, java] of Object.entries(element.faces)) {
      let [a,b,c,d] = java.uv;
      if (['up','down'].includes(face)) [a,b,c,d] = [c,d,a,b];
      const native = cube.uv[face];
      assert.deepEqual(native.uv, [a,b]);
      const rounded = value => Math.round(value*1000000)/1000000;
      assert.deepEqual(native.uv_size, [rounded(c-a),rounded(d-b)]);
      assert.equal(native.material_instance, 'ordertocook_block_refrigerator');
    }
    for (let mask=0;mask<8;mask++) points.push(cube.origin.map((v, axis) => v+((mask>>axis)&1)*cube.size[axis]));
  });
  const low = [0,1,2].map(axis => Math.min(...points.map(p => p[axis])));
  const high = [0,1,2].map(axis => Math.max(...points.map(p => p[axis])));
  assert.deepEqual(low, [-4,4,-4]);
  assert.deepEqual(high, [4,20,4]);
  assert.ok(high.every((v,axis) => v-low[axis] <= 30));
});

test('both first-person hands explicitly use source poses on the compact mesh', () => {
  assert.equal(item.format_version, '1.21.0');
  assert.deepEqual(Object.keys(mesh.item_display_transforms).sort(), contexts.slice().sort());
  for (const context of contexts) {
    const pose = mesh.item_display_transforms[context];
    for (const [key, fallback] of [['rotation',[0,0,0]], ['translation',[0,0,0]], ['scale',[1,1,1]]]) {
      const factor = key === 'scale' && !context.startsWith('firstperson_') ? 2 : 1;
      assert.deepEqual(pose[key] ?? fallback, (source.display[context][key] ?? fallback).map(value => value*factor));
    }
    for (const value of pose.scale) assert.ok(value >= 0 && value <= 4);
    for (const value of pose.translation ?? [0,0,0]) assert.ok(Math.abs(value) <= 80);
    for (const value of pose.rotation ?? [0,0,0]) assert.ok(Math.abs(value) <= 360);
  }
  assert.deepEqual(mesh.item_display_transforms.firstperson_righthand.scale, [.4,.4,.4]);
  assert.deepEqual(mesh.item_display_transforms.firstperson_lefthand.scale, [.4,.4,.4]);
  assert.equal(16 * mesh.item_display_transforms.firstperson_righthand.scale[1], 6.4);
  for (const material of Object.values(block.components['minecraft:item_visual'].material_instances)) {
    assert.equal(material.ambient_occlusion, 0);
    assert.equal(material.render_method, 'alpha_test');
    assert.equal(material.texture, 'ordertocook_block_refrigerator');
  }
});

test('relative to the exact CARY .54 item only the two first-person scales change', () => {
  const path = 'docs/validation/fridge-held-20261110/cary-054-refrigerator-item.geo.json';
  assert.equal(createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex'),
    '1cea082601b71066ea07057ffcdf02c3f8c1aa1aa077151bc5fb7821526412e1');
  const baseline = read(path);
  for (const hand of ['firstperson_righthand', 'firstperson_lefthand']) {
    assert.deepEqual(baseline['minecraft:geometry'][0].item_display_transforms[hand].scale, [.8,.8,.8]);
    baseline['minecraft:geometry'][0].item_display_transforms[hand].scale = [.4,.4,.4];
  }
  assert.deepEqual(item, baseline);
});

test('all original placed fridge files and Java inputs remain at the reviewed baseline', () => {
  const identities = read('docs/validation/fridge-held-20261110/preserved-inputs.json');
  for (const [path, expected] of Object.entries(identities.files)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex'), expected, path);
  }
  assert.equal(readdirSync(new URL('runtime/RP/models/blocks/', root)).filter(name => /^refrigerator_(lower|upper)_.*\.geo\.json$/.test(name)).length, 176);
});
