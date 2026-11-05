// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mainFixture } from './main.harness.js';
import { place } from './appliances.harness.js';
import { MACHINE_TICKS } from '../runtime/BP/scripts/machine_timing.js';
const machineComponents = JSON.parse(await readFile(new URL('../runtime/BP/blocks/order_machine.json', import.meta.url), 'utf8'))['minecraft:block'].components;

async function fixture(properties) {
  const env = await mainFixture(properties), r = env.restaurant;
  const board = place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 });
  const menu = [{ typeId: 'minecraft:bread', nutrition: 5 }];
  env.store.saveStation({ id: 'timer-board', typeId: board.typeId, dimensionId: board.dimension.id,
    location: board.location, ownerId: r.ownerId, menu });
  env.store.getStation(env.chair);
  r.active = true; r.menu = menu; r.config.refreshMs = 1000;
  env.store.saveRestaurant(r);
  const component = env.blockComponents.get('ordertocook:machine_timing');
  return { ...env, nativeTicks(count = 1) {
    for (let i = 0; i < count; i++) {
      env.system.currentTick++;
      component.onTick({ block: env.machine });
    }
  }, remaining: () => env.hooks.machineTiming.remaining(env.store.getRestaurant(r.id)) };
}

test('wall jumps and unloaded time cannot refresh the machine; paused native ticks preserve progress', async () => {
  const env = await fixture(), sequence = env.restaurant.orderSequence, original = Date.now, wall = Date.now();
  // Direct callback tests would otherwise still pass if the shipped block
  // stopped scheduling it. Bind the real JSON to the registered native entry.
  assert.deepEqual(machineComponents['minecraft:tick'], { interval_range: [1, 1], looping: true });
  assert.ok('ordertocook:machine_timing' in machineComponents);
  assert.equal(typeof env.blockComponents.get('ordertocook:machine_timing').onTick, 'function');
  assert.equal(env.remaining(), 20);
  env.nativeTicks(7); assert.equal(env.remaining(), 13);
  try {
    Date.now = () => wall + 86400000;
    env.system.currentTick += 10000; env.hooks.tickRestaurants();
    assert.equal(env.restaurant.orderSequence, sequence); assert.equal(env.remaining(), 13);
    env.restaurant.active = false; env.nativeTicks(100);
    assert.equal(env.remaining(), 13);
    env.restaurant.active = true; env.nativeTicks(12);
    assert.equal(env.restaurant.orderSequence, sequence); assert.equal(env.remaining(), 1);
    env.nativeTicks(); assert.ok(env.restaurant.orderSequence > sequence); assert.equal(env.remaining(), 20);
  } finally { Date.now = original; }
});

test('the same saved progress resumes after reload without consuming offline wall time', async () => {
  const env = await fixture(); env.restaurant.savedExtra = { kept: 'metadata' }; env.store.saveRestaurant(env.restaurant);
  env.nativeTicks(7);
  const restored = await fixture([...env.properties]);
  assert.equal(restored.remaining(), 13); assert.deepEqual(restored.restaurant.savedExtra, { kept: 'metadata' });
  const sequence = restored.restaurant.orderSequence;
  restored.nativeTicks(12); assert.equal(restored.restaurant.orderSequence, sequence);
  restored.nativeTicks(); assert.ok(restored.restaurant.orderSequence > sequence);
});

test('legacy wall progress is adopted once, retaining a partial tick and all other saved data', async () => {
  const original = Date.now, wall = 1800000000000;
  try {
    Date.now = () => wall;
    const env = await fixture();
    delete env.restaurant.machineRefreshOrigin;
    env.restaurant.nextRefreshAt = wall + 51; env.restaurant.nextWalkInAt = wall + 3;
    env.restaurant.savedExtra = { kept: 3 }; env.store.saveRestaurant(env.restaurant);
    const restored = await fixture([...env.properties]);
    assert.equal(restored.remaining(), 2);
    assert.equal('nextRefreshAt' in restored.restaurant, false); assert.equal('nextWalkInAt' in restored.restaurant, false);
    const origin = restored.restaurant.machineRefreshOrigin;
    Date.now = () => wall + 86400000;
    assert.equal(restored.hooks.machineTiming.adopt(restored.restaurant, { wall: Date.now(), tick: 100 }), false);
    assert.equal(restored.restaurant.machineRefreshOrigin, origin);
    assert.deepEqual(restored.restaurant.savedExtra, { kept: 3 });
  } finally { Date.now = original; }
});

test('refresh save failure keeps the previous offers and leaves progress due for one retry', async () => {
  const env = await fixture(), sequence = env.restaurant.orderSequence;
  env.nativeTicks(19); env.failWrite(key => key === 'ordertocook:r:' + env.restaurant.id);
  assert.throws(() => env.nativeTicks(), /simulated native persistence failure/);
  assert.equal(env.store.getRestaurant(env.restaurant.id).orderSequence, sequence); assert.equal(env.remaining(), 0);
  env.nativeTicks(); assert.ok(env.store.getRestaurant(env.restaurant.id).orderSequence > sequence); assert.equal(env.remaining(), 20);
});

test('walk-in attempts use active native ticks, reset on reload and obey the configured subsequent interval', async () => {
  const original = Math.random; Math.random = () => 0;
  try {
    const env = await fixture(); env.restaurant.config.refreshMs = 10000000; env.restaurant.config.walkInIntervalMs = 100;
    env.restaurant.config.walkInChances = [1];
    env.store.saveRestaurant(env.restaurant);
    const walkIns = () => env.restaurant.orders.filter(order => order.source === 'walk_in').length;
    env.nativeTicks(1200); assert.equal(walkIns(), 0);
    env.nativeTicks(); assert.equal(walkIns(), 1);
    env.nativeTicks(2); assert.equal(walkIns(), 1);
    env.nativeTicks(); assert.equal(walkIns(), 2);
    env.system.currentTick += 3000; env.hooks.tickRestaurants();
    env.nativeTicks(2); assert.equal(walkIns(), 2);
    env.nativeTicks(); assert.equal(walkIns(), 3);
    const getBlock = env.dimension.getBlock;
    env.dimension.getBlock = location => {
      if (location.x === env.machine.location.x && location.z === env.machine.location.z) throw Error('native chunk unloaded');
      return getBlock(location);
    };
    env.hooks.tickRestaurants(); env.dimension.getBlock = getBlock;
    env.nativeTicks(1200); assert.equal(walkIns(), 3);
    env.nativeTicks(); assert.equal(walkIns(), 4);
    const restored = await fixture([...env.properties]); restored.restaurant.config.refreshMs = 10000000;
    const saved = restored.restaurant.orders.filter(order => order.source === 'walk_in').length;
    restored.nativeTicks(1200); assert.equal(restored.restaurant.orders.filter(order => order.source === 'walk_in').length, saved);
    restored.nativeTicks(); assert.equal(restored.restaurant.orders.filter(order => order.source === 'walk_in').length, saved + 1);
  } finally { Math.random = original; }
});

test('deleting a restaurant removes its owned counter; corrupt progress is preserved and reported', async () => {
  const env = await fixture(), key = MACHINE_TICKS + env.restaurant.id;
  env.nativeTicks(); assert.equal(env.world.getDynamicProperty(key), 1);
  env.world.setDynamicProperty(key, 'unreadable');
  assert.throws(() => env.nativeTicks(), /Invalid saved machine progress/);
  assert.equal(env.world.getDynamicProperty(key), 'unreadable');
  env.store.deleteRestaurant(env.restaurant.id); assert.equal(env.world.getDynamicProperty(key), undefined);
});
