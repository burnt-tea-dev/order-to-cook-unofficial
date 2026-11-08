// SPDX-License-Identifier: GPL-3.0-only
// Real shipped main/core/store/timing and entity service on the save path.
// Minecraft IO is doubled; unrelated appliance/UI harness stubs remain.
// These regressions do not prove native world/disk transactionality.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture } from './main.harness.js';
import { entityServices, place } from './appliances.harness.js';
import { MACHINE_TICKS } from '../runtime/BP/scripts/machine_timing.js';

async function fixture({ occupied = false, refreshTogether = false } = {}) {
  const env = await mainFixture(), restaurant = env.restaurant;
  if (!occupied) for (const entity of [...env.dimension.entities.values()]) entity.remove();
  const board = env.store.getStation(place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 }));
  board.menu = [{ typeId: 'minecraft:bread', nutrition: 5 }]; env.store.saveStation(board);
  env.store.getStation(env.chair);
  restaurant.orders = []; restaurant.active = true;
  restaurant.config.refreshMs = refreshTogether ? 1201 * 50 : 10000000;
  restaurant.config.walkInIntervalMs = 100; restaurant.config.walkInChances = [1];
  restaurant.machineRefreshOrigin = 0;
  env.hooks.syncMenu(restaurant); env.store.saveRestaurant(restaurant);
  const service = entityServices.createEntityService({ world: env.world, system: env.system, ...env.store,
    orderTime: () => ({ wall: Date.now(), tick: env.system.currentTick }) });
  // Replaces the main harness stub with the actual shipped entity service.
  Object.assign(env.hooks.entities, service);
  const root = 'ordertocook:r:' + restaurant.id;
  return { ...env, service, root,
    step(count = 1) { for (let i = 0; i < count; i++) { env.system.currentTick++; env.hooks.tickMachine(env.machine); } },
    saved() {
      const manifest = JSON.parse(env.properties.get(root));
      return JSON.parse(Array.from({ length: manifest.parts }, (_, i) =>
        env.properties.get(`${root}:part:${manifest.buffer}:${i}`)).join(''));
    },
    count(type) { return env.dimension.getEntities({ type: `ordertocook:${type}` }).length; }
  };
}
async function withRandom(action) {
  const original = Math.random; Math.random = () => 0;
  try { await action(); } finally { Math.random = original; }
}
function rejectSave(env, phase) {
  if (phase !== 'silent-root') env.failWrite(key => phase === 'root' ? key === env.root : key.startsWith(env.root + ':part:'));
  else {
    const set = env.world.setDynamicProperty; let omitted = false;
    env.world.setDynamicProperty = (key, value) => {
      if (!omitted && key === env.root) { omitted = true; return; }
      return set(key, value);
    };
  }
}

for (const refreshTogether of [false, true]) for (const phase of ['chunk', 'root', 'silent-root']) {
  test(`${phase} failure during arrival cannot revive a rolled-back restaurant (refresh=${refreshTogether})`, () => withRandom(async () => {
    const env = await fixture({ refreshTogether }), before = env.saved();
    env.step(1200); rejectSave(env, phase);
    assert.throws(() => env.step(), /stale timer save aborted/);
    const canonical = env.store.getRestaurant(env.restaurant.id);
    assert.deepEqual(env.saved(), before); assert.deepEqual(canonical, before);
    assert.notEqual(canonical, env.restaurant);
    assert.equal(env.count('customer'), 0); assert.equal(env.count('seat'), 0);
    assert.equal(env.properties.get(MACHINE_TICKS + env.restaurant.id), 1201, 'the native counter is not a cross-record rollback');
    if (refreshTogether) {
      env.step();
      assert.equal(env.saved().orders.filter(order => order.source === 'machine').length, 1);
      assert.equal(env.saved().orders.filter(order => order.walkIn).length, 0);
      assert.equal(env.saved().machineRefreshOrigin, 1202);
    }
  }));
}

for (const failure of ['occupied', 'spawn-rejected']) test(`ordinary ${failure} spawn miss retains existing pending semantics and a simultaneous refresh`, () => withRandom(async () => {
  const env = await fixture({ occupied: failure === 'occupied', refreshTogether: true });
  const before = env.count('customer');
  if (failure === 'spawn-rejected') {
    const spawn = env.dimension.spawnEntity.bind(env.dimension);
    env.dimension.spawnEntity = (type, location) => {
      if (type === 'ordertocook:customer') throw Error('injected spawn rejection');
      return spawn(type, location);
    };
  }
  env.step(1201);
  assert.equal(env.saved().orders.filter(order => order.walkIn).length, 1);
  assert.equal(env.saved().orders.filter(order => order.source === 'machine').length, 1);
  assert.equal(env.saved().machineRefreshOrigin, 1201);
  assert.equal(env.count('customer'), before);
  assert.equal(env.store.getRestaurant(env.restaurant.id), env.restaurant);
}));

test('a confirmed manifest commit followed by a setter exception remains successful', () => withRandom(async () => {
  const env = await fixture(), set = env.world.setDynamicProperty;
  env.step(1200); let injected = false;
  env.world.setDynamicProperty = (key, value) => {
    set(key, value);
    if (!injected && key === env.root) { injected = true; throw Error('post-commit adapter exception'); }
  };
  env.step(); assert.equal(injected, true);
  assert.equal(env.saved().orders.length, 1); assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
  assert.equal(env.store.getRestaurant(env.restaurant.id), env.restaurant);
}));

test('an older pending order survives arrival rollback and later retries without duplicate customers', () => withRandom(async () => {
  const env = await fixture(), restaurant = env.restaurant;
  const old = env.core.generateWalkInOrder(restaurant, { wall: Date.now(), tick: env.system.currentTick }, () => 0);
  env.store.saveRestaurant(restaurant); const before = env.saved();
  env.step(1200); rejectSave(env, 'root');
  assert.throws(() => env.step(), /stale timer save aborted/);
  assert.deepEqual(env.saved(), before);
  const canonical = env.store.getRestaurant(restaurant.id), order = canonical.orders[0];
  assert.equal(order.id, old.id);
  const customer = env.service.spawnCustomer(canonical, order);
  assert.ok(customer); assert.equal(env.service.spawnCustomer(canonical, order).id, customer.id);
  assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
  assert.equal(env.saved().orders.length, 1); assert.equal(env.saved().orders[0].id, old.id);
}));

test('failure of the outer save preserves the already committed customer association', () => withRandom(async () => {
  const env = await fixture(), set = env.world.setDynamicProperty;
  env.step(1200); let roots = 0;
  env.world.setDynamicProperty = (key, value) => {
    if (key === env.root && ++roots === 2) throw Error('outer save rejected');
    return set(key, value);
  };
  assert.throws(() => env.step(), /outer save rejected/);
  const canonical = env.store.getRestaurant(env.restaurant.id);
  assert.notEqual(canonical, env.restaurant);
  assert.equal(env.saved().orders.length, 1); assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
  const order = canonical.orders[0];
  assert.equal(env.service.spawnCustomer(canonical, order).id, order.customerEntityId);
  assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
}));
