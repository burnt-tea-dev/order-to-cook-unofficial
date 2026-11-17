// SPDX-License-Identifier: GPL-3.0-only
// Real appliance service and generated permutations, with engine/form doubles.
// No Minecraft renderer, native packets or GUI are exercised by this suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place } from './appliances.harness.js';

const root = new URL('../', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const definition = json('runtime/BP/blocks/stove.json')['minecraft:block'];
const terrain = json('runtime/RP/textures/terrain_texture.json').texture_data;
const textures = ['stove', 'stove_fire', 'stove_fire_0', 'stove_fire_1', 'stove_fire_2', 'stove_fire_3'];
const defaults = Object.fromEntries(Object.entries(definition.description.states).map(([key, values]) => [key, values[0]]));
const componentRules = definition.permutations.map(row => ({ ...row,
  matches: Function('q', `return ${row.condition};`) }));

function resolve(block) {
  const states = { ...defaults, ...block.permutation.getAllStates() };
  let components = { ...definition.components };
  for (const row of componentRules) if (row.matches({ block_state: key => states[key] })) {
    components = { ...components, ...row.components };
  }
  const geometry = components['minecraft:geometry'];
  const mesh = json(`runtime/RP/models/blocks/${geometry.replace('geometry.ordertocook.', '')}.geo.json`)['minecraft:geometry'][0];
  assert.equal(mesh.description.identifier, geometry);
  // Every actual face can resolve a material, then one of the six source PNGs.
  for (const bone of mesh.bones) for (const cube of bone.cubes ?? []) for (const face of Object.values(cube.uv)) {
    const materials = components['minecraft:material_instances'];
    const material = materials[face.material_instance] ?? materials['*'];
    assert.ok(material);
    assert.equal(terrain[material.texture].textures, `textures/ordertocook/block/${textures[states['ordertocook:fire_frame']]}`);
  }
  return { states, components, mesh, geometry };
}

function fixture({ facing = 'north', fuelTicks } = {}) {
  const env = makeEnvironment(), saved = new Map();
  if (fuelTicks) env.ctx.fuelTicks = fuelTicks;
  env.ctx.saveStation = station => { env.records.set(station.id, station); saved.set(station.id, structuredClone(station)); };
  const service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:stove', { x: 0, y: 0, z: 0 }, { 'minecraft:cardinal_direction': facing });
  service.onPlace(block);
  const station = env.ctx.getStation(block), inventory = service.getStorage(station), writes = [];
  const original = block.setPermutation.bind(block);
  block.setPermutation = permutation => { writes.push({ tick: env.system.currentTick, states: permutation.getAllStates() }); original(permutation); };
  service.tick();
  writes.length = 0;
  return { env, service, block, station, inventory, saved, writes };
}
function stock(f, fuel = 'minecraft:coal', count = 1) {
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 10));
  f.inventory.setItem(3, new FakeItem(fuel, count));
}
function publish(f, ticks = 2) {
  const before = f.writes.length;
  f.env.system.currentTick += ticks;
  f.service.tick();
  assert.ok(f.writes.length - before <= 1, 'lit, texture and low/high age must be one permutation commit');
  return resolve(f.block);
}
function expected(f, age, frame, lit = true) {
  const result = resolve(f.block);
  assert.equal(result.states['ordertocook:lit'], lit);
  assert.equal(result.states['ordertocook:fire_frame'], frame);
  assert.equal(result.states['ordertocook:ignition_frame'], age % 16);
  assert.equal(result.states['ordertocook:ignition_frame_high'], age >= 16);
  assert.equal(result.geometry, `geometry.ordertocook.${age ? `stove_ignition_${age}` : 'stove'}`);
  assert.equal(result.mesh.bones.reduce((n, bone) => n + (bone.cubes ?? []).reduce((m, cube) => m + Object.keys(cube.uv).length, 0), 0), age ? 17 : 18);
  return result;
}

for (const [facing, rotation] of Object.entries({ north: 0, south: 180, west: 90, east: -90 })) {
  for (const firstInterval of [1, 2]) test(`production ignition resolves every ${firstInterval === 1 ? 'even' : 'odd'} age and material facing ${facing}`, () => {
    const f = fixture({ facing }); stock(f);
    const seen = [];
    for (let time = firstInterval; time <= 54; time += 2) {
      publish(f, time === firstInterval ? firstInterval : 2);
      const sourceAge = time - 1;
      const age = sourceAge < 20 ? sourceAge : 0;
      const frame = sourceAge < 15 ? 0 : sourceAge < 20 ? 1 : 2 + Math.floor((sourceAge - 20) / 8) % 4;
      const result = expected(f, age, frame);
      assert.deepEqual(result.components['minecraft:transformation'].rotation, [0, rotation, 0]);
      assert.equal(f.station.appliance.fireAnimationTicks, Math.max(0, 20 - sourceAge));
      seen.push(age);
    }
    assert.deepEqual(seen.slice(0, 10), Array.from({ length: 10 }, (_, i) => firstInterval - 1 + i * 2));
    assert.equal(f.inventory.getItem(3), undefined);
    assert.equal(f.env.system.intervals.length, 0, 'no second scheduler was installed');
  });
}

test('actual service initialization retains its sole two-tick scheduler and first publishes age one', () => {
  const f = fixture(); stock(f);
  f.service.init();
  for (const callback of f.env.system.callbacks.splice(0)) callback();
  assert.deepEqual(f.env.system.intervals.map(row => row.ticks), [2]);
  f.env.system.currentTick = 2;
  f.env.system.intervals[0].fn();
  expected(f, 1, 0);
  assert.equal(f.writes.length, 1);
  f.env.system.currentTick = 4;
  f.env.system.intervals[0].fn();
  expected(f, 3, 0);
  assert.equal(f.writes.length, 2);
});

test('14/15/19/20 boundaries atomically pair source geometry and texture, without changing cooking', () => {
  const f = fixture(); stock(f);
  publish(f, 1); expected(f, 0, 0);
  for (const [ticks, age, frame] of [[14, 14, 0], [1, 15, 1], [4, 19, 1], [1, 0, 2]]) {
    const count = f.writes.length;
    publish(f, ticks); expected(f, age, frame);
    assert.equal(f.writes.length, count + 1);
    const write = f.writes.at(-1).states;
    assert.equal(write['ordertocook:ignition_frame'] + 16 * write['ordertocook:ignition_frame_high'], age);
    assert.equal(write['ordertocook:fire_frame'], frame);
  }
  assert.equal(f.station.appliance.cookProgress, 21);
  assert.equal(f.station.appliance.litTime, 1580);
  const count = f.writes.length;
  f.service.tick(); assert.equal(f.writes.length, count, 'same system tick is not processed twice');
});

test('two stoves burn independently and successful ordinary refuelling restarts geometry exactly once', () => {
  const f = fixture(); stock(f, 'minecraft:stick', 2);
  const block = place(f.env, 'ordertocook:stove', { x: 3, y: 0, z: 0 }, { 'minecraft:cardinal_direction': 'east' });
  f.service.onPlace(block);
  const station = f.env.ctx.getStation(block), inventory = f.service.getStorage(station);
  publish(f); publish(f); publish(f); // First stove age 5, second still idle.
  assert.equal(resolve(block).geometry, 'geometry.ordertocook.stove');
  inventory.setItem(0, new FakeItem('minecraft:potato', 2));
  inventory.setItem(3, new FakeItem('minecraft:coal'));
  publish(f); expected(f, 7, 0);
  assert.equal(resolve(block).geometry, 'geometry.ordertocook.stove_ignition_1');
  while (f.env.system.currentTick < 100) publish(f);
  expected(f, 0, 3); // Age 99, cycle floor((99-20)/8)%4 == 1.
  assert.equal(f.inventory.getItem(3).amount, 1);
  publish(f); expected(f, 1, 0);
  assert.equal(f.inventory.getItem(3), undefined);
  assert.equal(f.station.appliance.cookProgress, 102);
  assert.equal(f.station.appliance.litTime, 99);
  assert.equal(station.appliance.fireAnimationTicks, 0);
  assert.equal(inventory.getItem(3), undefined);
});

test('native container use, input removal and full output never restart the active ignition', () => {
  const f = fixture(); stock(f);
  publish(f); expected(f, 1, 0);
  f.service.onInteract(new FakePlayer(f.env.dimension), f.block);
  expected(f, 1, 0);
  publish(f); expected(f, 3, 0);
  f.inventory.setItem(0, undefined);
  publish(f); expected(f, 5, 0);
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 64));
  publish(f); expected(f, 7, 0);
  assert.equal(f.station.appliance.cookProgress, 0);
  while (f.env.system.currentTick < 20) publish(f);
  expected(f, 19, 1);
  publish(f); expected(f, 0, 2);
  assert.equal(f.inventory.getItem(4).amount, 64);
});

test('invalid fuel, invalid input and already full output never create an ignition', () => {
  for (const mode of ['fuel', 'input', 'output']) {
    const f = fixture(); stock(f);
    if (mode === 'fuel') f.inventory.setItem(3, new FakeItem('minecraft:stone', 3));
    if (mode === 'input') f.inventory.setItem(0, new FakeItem('minecraft:stone', 3));
    if (mode === 'output') f.inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 64));
    for (let i = 0; i < 15; i++) publish(f);
    expected(f, 0, 0, false);
    assert.equal(f.station.appliance.fireAnimationTicks, 0);
    assert.ok(f.inventory.getItem(3));
  }
});

for (const age of [5, 17]) {
  for (const mode of ['reload', 'unload']) test(`${mode} during ignition age ${age} clears geometry without replaying fuel or elapsed offline time`, () => {
    const f = fixture(); stock(f, 'minecraft:coal', 2);
    publish(f, age + 1); expected(f, age, age < 15 ? 0 : 1);
    const before = structuredClone(f.station.appliance);
    if (mode === 'reload') {
      f.station = structuredClone(f.saved.get(f.station.id));
      f.env.records.set(f.station.id, f.station);
      f.env.system.currentTick += 1000;
      f.service = appliances.createApplianceService(f.env.ctx);
      f.service.tick();
    } else {
      const getBlock = f.env.dimension.getBlock;
      f.env.dimension.getBlock = () => undefined;
      publish(f);
      f.env.system.currentTick += 1000; f.service.tick();
      assert.equal(f.station.appliance.fireAnimationTicks, before.fireAnimationTicks);
      f.env.dimension.getBlock = getBlock;
      publish(f);
    }
    expected(f, 0, 2);
    assert.equal(f.station.appliance.fireAnimationTicks, 0);
    assert.equal(f.station.appliance.litTime, before.litTime);
    assert.equal(f.station.appliance.cookProgress, before.cookProgress);
    assert.equal(f.inventory.getItem(3).amount, 1);
    publish(f); expected(f, 0, 2);
    assert.equal(f.station.appliance.cookProgress, before.cookProgress + 2);
  });
}

test('old saves without animation fields initialize neutral and retain progress, material and stock', () => {
  const f = fixture(); stock(f, 'minecraft:coal', 2);
  Object.assign(f.station.appliance, { litTime: 800, litDuration: 1600, cookProgress: 89 });
  for (const key of ['fireAnimationTicks', 'firePhase', 'fireTicks', 'cycleFrame']) delete f.station.appliance[key];
  f.service = appliances.createApplianceService(f.env.ctx);
  f.env.system.currentTick += 100;
  f.service.tick();
  expected(f, 0, 2);
  assert.equal(f.station.appliance.fireAnimationTicks, 0);
  assert.equal(f.station.appliance.cookProgress, 89);
  assert.equal(f.station.appliance.litTime, 800);
  assert.equal(f.inventory.getItem(3).amount, 2);
});

test('short custom fuel extinguishes texture while the independent source geometry countdown finishes', () => {
  const f = fixture({ fuelTicks: { 'minecraft:stick': 3 } }); stock(f, 'minecraft:stick');
  publish(f); expected(f, 1, 0);
  publish(f); expected(f, 3, 0, false);
  publish(f); expected(f, 5, 0, false);
  assert.equal(f.station.appliance.firePhase, 0);
  assert.equal(f.station.appliance.cookProgress, 0);
  assert.equal(f.saved.get(f.station.id).appliance.fireAnimationTicks, 15);
  while (f.env.system.currentTick < 20) publish(f);
  expected(f, 19, 0, false);
  assert.equal(f.saved.get(f.station.id).appliance.fireAnimationTicks, 1);
  publish(f); expected(f, 0, 0, false);
  assert.equal(f.saved.get(f.station.id).appliance.fireAnimationTicks, 0);
  assert.equal(f.station.appliance.fireAnimationTicks, 0);
});

test('breaking or externally removing an igniting block never resurrects its geometry', () => {
  for (const explicitBreak of [true, false]) {
    const f = fixture(); stock(f);
    publish(f); expected(f, 1, 0);
    const permutation = f.block.permutation;
    f.block.setType('minecraft:air');
    if (explicitBreak) f.service.onBreak(f.block, f.station, permutation);
    const writeCount = f.writes.length;
    for (let i = 0; i < 55; i++) { f.env.system.currentTick += 2; f.service.tick(); }
    assert.equal(f.block.typeId, 'minecraft:air');
    assert.equal(f.writes.length, writeCount);
    assert.equal(f.env.records.size, 0);
    assert.equal(f.env.dimension.getEntities({ type: 'ordertocook:storage' }).length, 0);
  }
});
