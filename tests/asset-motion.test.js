// SPDX-License-Identifier: GPL-3.0-only
// Generated-resource contracts, not a substitute for client visual inspection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const mesh = path => json(`runtime/RP/models/blocks/${path}.geo.json`)['minecraft:geometry'][0];
const bone = (geometry, name) => geometry.bones.find(entry => entry.name === name);

function rotate(point, angles = [0, 0, 0], pivot = [0, 0, 0]) {
  let [x, y, z] = point.map((value, axis) => value - pivot[axis]);
  for (let axis = 0; axis < 3; axis++) {
    const r = angles[axis] * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    if (axis === 2) [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z].map((value, axis) => value + pivot[axis]);
}

test('all 88 generated appliance poses fit the stable bounds after parent rotations', () => {
  const paths = readdirSync(new URL('runtime/RP/models/blocks/', root)).filter(name => /^(refrigerator_(lower|upper)_\d+|dishwasher_\d+_\d+)\.geo\.json$/.test(name));
  assert.equal(paths.length, 88);
  for (const path of paths) {
    const geometry = json(`runtime/RP/models/blocks/${path}`)['minecraft:geometry'][0];
    const bones = new Map(geometry.bones.map(entry => [entry.name, entry]));
    const corners = [];
    for (const entry of geometry.bones) for (const cube of entry.cubes ?? []) for (let mask = 0; mask < 8; mask++) {
      let point = cube.origin.map((value, axis) => value + ((mask >> axis) & 1) * cube.size[axis]);
      point = rotate(point, cube.rotation, cube.pivot);
      let parent = entry;
      while (parent) { point = rotate(point, parent.rotation, parent.pivot); parent = bones.get(parent.parent); }
      corners.push(point);
    }
    for (let axis = 0; axis < 3; axis++) {
      const low = Math.min(...corners.map(point => point[axis])), high = Math.max(...corners.map(point => point[axis]));
      assert.ok(high - low <= 30.00001 && low >= -30.00001 && high <= 30.00001, `${path} axis${axis}: ${low}..${high}`);
    }
  }
});

test('independent refrigerator meshes retain the whole lower door across the cabinet seam', () => {
  const source = json('upstream/reference/common/src/main/resources/assets/ordertocook/geo/block/refrigerator.geo.json')['minecraft:geometry'][0];
  const lower = mesh('refrigerator_lower_0'), upper = mesh('refrigerator_upper_0');
  assert.deepEqual(bone(lower, 'bone3').cubes, bone(source, 'bone3').cubes);
  assert.equal(bone(upper, 'bone3').cubes.length, 0);
  assert.equal(bone(lower, 'bone2').cubes.length, 0);
  assert.equal(bone(upper, 'bone2').cubes.length, bone(source, 'bone2').cubes.length);
  assert.equal(bone(mesh('refrigerator_lower_10'), 'bone3').rotation[1], -125);
  assert.equal(bone(mesh('refrigerator_upper_10'), 'bone2').rotation[1], -135);
});

test('dishwasher terminal poses keep the original drawer translation and only the appropriate dish', () => {
  const ready = mesh('dishwasher_5_0'), closed = mesh('dishwasher_1_15');
  assert.equal(bone(ready, 'group3').pivot[2], -12);
  assert.deepEqual(bone(ready, 'group3').rotation, [5, 0, 0]);
  assert.deepEqual(bone(ready, 'group5').rotation, [92.5, 0, 0]);
  assert.equal(bone(ready, 'drity_dish').cubes.length, 0); assert.equal(bone(ready, 'clear_dish').cubes.length, 6);
  assert.equal(bone(closed, 'group3').pivot[2], 0); assert.deepEqual(bone(closed, 'group5').rotation, [0, 0, 0]);
  assert.equal(bone(closed, 'drity_dish').cubes.length, 0); assert.equal(bone(closed, 'clear_dish').cubes.length, 0);
});

test('all dining stages use one valid entity atlas instead of block material names', () => {
  const plate = json('runtime/RP/models/entity/dining_plate.geo.json')['minecraft:geometry'];
  const atlas = readFileSync(new URL('runtime/RP/textures/ordertocook/entity/dining_plate_atlas.png', root));
  const width = atlas.readUInt32BE(16), height = atlas.readUInt32BE(20);
  assert.equal(plate.length, 41); assert.equal(width, 256); assert.equal(height, 256);
  for (const geometry of plate) {
    assert.equal(geometry.description.texture_width, width); assert.equal(geometry.description.texture_height, height);
    for (const entry of geometry.bones) for (const cube of entry.cubes) for (const face of Object.values(cube.uv)) {
      assert.equal(face.material_instance, undefined);
      for (let axis = 0; axis < 2; axis++) {
        const a = face.uv[axis], b = a + face.uv_size[axis];
        assert.ok(Math.min(a, b) >= 0 && Math.max(a, b) <= (axis ? height : width));
      }
    }
  }
  const entity = json('runtime/BP/entities/dining_plate.json')['minecraft:entity'];
  assert.equal(entity.components['minecraft:inventory'], undefined);
  assert.deepEqual(entity.components['minecraft:physics'], { has_gravity: false, has_collision: false });
  assert.deepEqual(entity.description.properties['ordertocook:stage'].range, [0, 40]);
  assert.deepEqual(json('runtime/BP/loot_tables/empty.json').pools, []);
});

test('customer actions have seven distinct original clips and no automatic completed-action replay', () => {
  const description = json('runtime/RP/entity/customer.entity.json')['minecraft:client_entity'].description;
  const states = json('runtime/RP/animation_controllers/customer.animation_controllers.json').animation_controllers['controller.animation.ordertocook.customer'].states;
  assert.equal(new Set(Array.from({ length: 7 }, (_, i) => description.animations[`action${i + 1}`])).size, 7);
  for (let action = 1; action <= 7; action++) {
    assert.deepEqual(states[`action_${action}`].animations, [`action${action}`]);
    assert.equal(JSON.stringify(states[`action_${action}`]).includes('all_animations_finished'), false);
  }
  assert.equal(JSON.stringify(states.waiting.animations).includes('animation_variant'), true);
  assert.equal(JSON.stringify(states.waiting.animations).includes('math.mod'), false);
});
