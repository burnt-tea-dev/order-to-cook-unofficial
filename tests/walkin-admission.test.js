// SPDX-License-Identifier: GPL-3.0-only
// Real main/core/store/timing/entities save path with Minecraft IO doubles.
// Unrelated main-harness UI/appliance stubs remain; this is not native acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture } from './main.harness.js';
import { entityServices, place } from './appliances.harness.js';
import { MACHINE_TICKS } from '../runtime/BP/scripts/machine_timing.js';

async function fixture({ refreshTogether = false, blocked = 'above' } = {}) {
  const env = await mainFixture(), restaurant = env.restaurant;
  if (blocked !== 'occupied') for (const entity of [...env.dimension.entities.values()]) entity.remove();
  const board = env.store.getStation(place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 }));
  board.menu = [{ typeId: 'minecraft:bread', nutrition: 5 }]; env.store.saveStation(board);
  env.store.getStation(env.chair); restaurant.orders = []; restaurant.active = true;
  restaurant.config.refreshMs = refreshTogether ? 1201 * 50 : 10000000;
  restaurant.config.walkInIntervalMs = 100; restaurant.config.walkInChances = [1]; restaurant.machineRefreshOrigin = 0;
  env.hooks.syncMenu(restaurant); restaurant.updatedAt = 1; env.store.saveRestaurant(restaurant);
  const service = entityServices.createEntityService({ world: env.world, system: env.system, ...env.store,
    orderTime: () => ({ wall: Date.now(), tick: env.system.currentTick }) });
  Object.assign(env.hooks.entities, service);
  const p = env.chair.location;
  if (blocked === 'above' || blocked === 'head') place(env, 'minecraft:stone', { ...p, y: p.y + (blocked === 'above' ? 1 : 2) });
  if (blocked === 'head-unloaded' || blocked === 'chair-unloaded') {
    const get = env.dimension.getBlock.bind(env.dimension); let chairReads = 0;
    env.dimension.getBlock = location => {
      if (location.x === p.x && location.z === p.z) {
        if (blocked === 'head-unloaded' && location.y === p.y + 2) throw Error('headroom unavailable');
        if (blocked === 'chair-unloaded' && location.y === p.y && ++chairReads > 1) throw Error('chair unloaded after arrival gate');
      }
      return get(location);
    };
  }
  const root = 'ordertocook:r:' + restaurant.id;
  return { ...env, service, root, board,
    step(count = 1) { for (let i = 0; i < count; i++) { env.system.currentTick++; env.hooks.tickMachine(env.machine); } },
    saved() { const manifest = JSON.parse(env.properties.get(root)); return JSON.parse(Array.from({ length: manifest.parts }, (_, i) =>
      env.properties.get(`${root}:part:${manifest.buffer}:${i}`)).join('')); },
    count(type) { return env.dimension.getEntities({ type: `ordertocook:${type}` }).length; } };
}
async function withRandom(action) {
  const random = Math.random; Math.random = () => 0;
  try { await action(); } finally { Math.random = random; }
}

for (const refreshTogether of [false, true]) for (const blocked of ['occupied', 'above', 'head', 'head-unloaded', 'chair-unloaded']) {
  test(`no eligible ${blocked} chair withdraws only this new arrival (refresh=${refreshTogether})`, () => withRandom(async () => {
    const env = await fixture({ blocked, refreshTogether }), before = env.saved(), customers = env.count('customer'), seats = env.count('seat');
    const spawn = env.dimension.spawnEntity.bind(env.dimension), sounds = env.dimension.sounds.length; let allocations = 0;
    env.dimension.spawnEntity = (type, location) => { allocations++; return spawn(type, location); };
    env.step(1201); const saved = env.saved();
    assert.equal(saved.orders.filter(order => order.walkIn).length, 0);
    assert.equal(saved.orders.filter(order => order.source === 'machine').length, Number(refreshTogether));
    assert.equal(saved.orderSequence, before.orderSequence + 1 + Number(refreshTogether), 'generated IDs remain consumed and persisted');
    assert.ok(saved.updatedAt > before.updatedAt);
    assert.equal(saved.machineRefreshOrigin, refreshTogether ? 1201 : 0);
    assert.equal(env.count('customer'), customers); assert.equal(env.count('seat'), seats);
    assert.equal(allocations, 0); assert.equal(env.dimension.sounds.length - sounds, Number(refreshTogether));
    assert.equal(env.properties.get(MACHINE_TICKS + env.restaurant.id), 1201);
    assert.equal(env.store.getRestaurant(env.restaurant.id), env.restaurant);
  }));
}

test('older pending walk-ins survive the new no-chair attempt and can still retry', () => withRandom(async () => {
  const env = await fixture(), old = env.core.generateWalkInOrder(env.restaurant, { wall: Date.now(), tick: 0 }, () => 0);
  env.store.saveRestaurant(env.restaurant); const before = env.saved();
  env.step(1201); assert.equal(env.saved().orders.length, 1); assert.deepEqual(env.saved().orders[0], before.orders[0]);
  assert.equal(env.saved().orderSequence, before.orderSequence + 1);
  place(env, 'minecraft:air', { ...env.chair.location, y: env.chair.location.y + 1 });
  env.service.init(); for (const callback of env.system.callbacks.splice(0)) callback();
  env.system.currentTick += 40; env.service.tick();
  const customer = env.dimension.getEntities({ type: 'ordertocook:customer' })[0]; assert.ok(customer);
  env.system.currentTick += 40; env.service.tick();
  assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
  assert.equal(env.saved().orders.length, 1); assert.equal(env.saved().orders[0].id, old.id);
}));

test('no-chair rejection keeps the arrival cooldown and the next due attempt can succeed', () => withRandom(async () => {
  const env = await fixture(); env.step(1201); const sequence = env.saved().orderSequence;
  place(env, 'minecraft:air', { ...env.chair.location, y: env.chair.location.y + 1 });
  env.step(2); assert.equal(env.saved().orders.length, 0); assert.equal(env.saved().orderSequence, sequence);
  env.step(); assert.equal(env.saved().orders.length, 1); assert.equal(env.saved().orderSequence, sequence + 1);
  assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
}));

for (const failure of ['spawn-rejected', 'metadata-rejected', 'cleanup-unconfirmed']) {
  test(`${failure} is not a no-chair signal and keeps the existing pending behavior`, () => withRandom(async () => {
    const env = await fixture({ blocked: false, refreshTogether: true }), spawn = env.dimension.spawnEntity.bind(env.dimension);
    env.dimension.spawnEntity = (type, location) => {
      if (type === 'ordertocook:customer' && failure === 'spawn-rejected') throw Error('spawn rejected');
      const entity = spawn(type, location);
      if (type === 'ordertocook:customer') {
        entity.setDynamicProperty = () => { throw Error('metadata rejected'); };
        if (failure === 'cleanup-unconfirmed') entity.remove = () => {};
      }
      return entity;
    };
    env.step(1201);
    assert.equal(env.saved().orders.filter(order => order.walkIn).length, 1);
    assert.equal(env.saved().orders.filter(order => order.source === 'machine').length, 1);
    assert.equal(env.count('customer'), Number(failure === 'cleanup-unconfirmed'));
  }));
}

test('no nearby player is not classified as a confirmed no-chair rejection', () => withRandom(async () => {
  const env = await fixture({ blocked: false }); env.world.players = [];
  env.step(1201); assert.equal(env.saved().orders.filter(order => order.walkIn).length, 1); assert.equal(env.count('customer'), 0);
}));

for (const phase of ['chunk', 'root', 'silent-root']) test(`failed final ${phase} save restores the snapshot after a no-chair attempt`, () => withRandom(async () => {
  const env = await fixture({ refreshTogether: true }), before = env.saved(); env.step(1200);
  if (phase !== 'silent-root') env.failWrite(key => phase === 'root' ? key === env.root : key.startsWith(env.root + ':part:'));
  else {
    const set = env.world.setDynamicProperty; let omitted = false;
    env.world.setDynamicProperty = (key, value) => { if (!omitted && key === env.root) { omitted = true; return; } return set(key, value); };
  }
  assert.throws(() => env.step()); assert.deepEqual(env.saved(), before);
  assert.deepEqual(env.store.getRestaurant(env.restaurant.id), before); assert.notEqual(env.store.getRestaurant(env.restaurant.id), env.restaurant);
  assert.equal(env.count('customer'), 0); assert.equal(env.count('seat'), 0);
  env.step(); assert.equal(env.saved().orders.filter(order => order.source === 'machine').length, 1);
  assert.equal(env.saved().orders.filter(order => order.walkIn).length, 0);
}));

test('a confirmed final save followed by a setter exception retains the rejected-arrival bookkeeping', () => withRandom(async () => {
  const env = await fixture(), before = env.saved(), set = env.world.setDynamicProperty; env.step(1200); let injected = false;
  env.world.setDynamicProperty = (key, value) => { set(key, value); if (!injected && key === env.root) { injected = true; throw Error('after commit'); } };
  env.step(); assert.equal(injected, true); assert.equal(env.saved().orders.length, 0);
  assert.equal(env.saved().orderSequence, before.orderSequence + 1);
  assert.equal(env.store.getRestaurant(env.restaurant.id), env.restaurant);
}));

test('direct retry callers without the optional no-chair reporter retain their order', () => withRandom(async () => {
  const env = await fixture(), order = env.core.generateWalkInOrder(env.restaurant, Date.now(), () => 0);
  env.store.saveRestaurant(env.restaurant); const before = env.saved();
  assert.equal(env.service.spawnCustomer(env.restaurant, order), undefined);
  assert.deepEqual(env.saved(), before); assert.equal(env.restaurant.orders[0], order);
}));

for (const failure of ['spawn-applied-throws', 'seat-cleanup-unconfirmed', 'late-headroom']) {
  test(`${failure} after chair selection does not withdraw the new pending order`, () => withRandom(async () => {
    const env = await fixture({ blocked: false, refreshTogether: true }), spawn = env.dimension.spawnEntity.bind(env.dimension);
    env.dimension.spawnEntity = (type, location) => {
      const entity = spawn(type, location);
      if (type === 'ordertocook:customer' && failure === 'spawn-applied-throws') throw Error('spawn applied then threw');
      if (type === 'ordertocook:customer' && failure === 'late-headroom') place(env, 'minecraft:stone', { ...env.chair.location, y: env.chair.location.y + 1 });
      if (type === 'ordertocook:seat' && failure === 'seat-cleanup-unconfirmed') {
        entity.setDynamicProperty = () => { throw Error('seat metadata rejected'); }; entity.remove = () => {};
      }
      return entity;
    };
    env.step(1201);
    assert.equal(env.saved().orders.filter(order => order.walkIn).length, 1);
    assert.equal(env.saved().orders.filter(order => order.source === 'machine').length, 1);
    assert.equal(env.count('customer'), Number(failure === 'spawn-applied-throws'));
    assert.equal(env.count('seat'), Number(failure === 'seat-cleanup-unconfirmed'));
  }));
}

test('a cleanup exception preserves the existing failure path instead of pruning uncertain state', () => withRandom(async () => {
  const env = await fixture({ blocked: false, refreshTogether: true }), before = env.saved(), spawn = env.dimension.spawnEntity.bind(env.dimension);
  env.dimension.spawnEntity = (type, location) => {
    const entity = spawn(type, location);
    if (type === 'ordertocook:customer') {
      entity.setDynamicProperty = () => { throw Error('metadata rejected'); };
      entity.remove = () => { throw Error('cleanup rejected'); };
    }
    return entity;
  };
  assert.throws(() => env.step(1201), /cleanup rejected/);
  assert.deepEqual(env.saved(), before);
  assert.equal(env.restaurant.orders.filter(order => order.walkIn).length, 1);
  assert.equal(env.count('customer'), 1);
}));

test('a menu snapshot committed before no-chair withdrawal remains current', () => withRandom(async () => {
  const env = await fixture(); env.step(1200);
  env.board.menu = [{ typeId: 'minecraft:carrot', nutrition: 3 }]; env.store.saveStation(env.board);
  env.step(); assert.equal(env.saved().menu[0].typeId, 'minecraft:carrot'); assert.equal(env.saved().orders.length, 0);
  assert.equal(env.store.getRestaurant(env.restaurant.id), env.restaurant);
}));

test('a menu snapshot committed before nested customer rollback is not reverted with the arrival', () => withRandom(async () => {
  const env = await fixture({ blocked: false }); env.step(1200);
  env.board.menu = [{ typeId: 'minecraft:carrot', nutrition: 3 }]; env.store.saveStation(env.board);
  const set = env.world.setDynamicProperty; let roots = 0;
  env.world.setDynamicProperty = (key, value) => { if (key === env.root && ++roots === 2) throw Error('customer save rejected'); return set(key, value); };
  assert.throws(() => env.step(), /stale timer save aborted/);
  assert.equal(env.saved().menu[0].typeId, 'minecraft:carrot'); assert.equal(env.saved().orders.length, 0);
  assert.equal(env.count('customer'), 0); assert.equal(env.count('seat'), 0);
}));

test('an admitted new arrival persists exactly one association and plays its success sound', () => withRandom(async () => {
  const env = await fixture({ blocked: false }), sounds = env.dimension.sounds.length; env.step(1201);
  assert.equal(env.saved().orders.length, 1); assert.equal(env.count('customer'), 1); assert.equal(env.count('seat'), 1);
  const order = env.restaurant.orders[0]; assert.equal(env.service.spawnCustomer(env.restaurant, order).id, order.customerEntityId);
  assert.equal(env.count('customer'), 1); assert.equal(env.dimension.sounds.length - sounds, 1);
}));
