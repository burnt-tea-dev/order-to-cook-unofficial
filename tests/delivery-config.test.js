// SPDX-License-Identifier: GPL-3.0-only
// Shipped configuration, placement, UI and native-tick callbacks with IO doubles.
// These are source regressions, not native disk/restart or multiplayer acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, configure } from './main.harness.js';
import { FakeItem, place } from './appliances.harness.js';
import { writePortableBlock, readPortableBlock } from '../runtime/BP/scripts/portable_blocks.js';
import { MACHINE_TICKS } from '../runtime/BP/scripts/machine_timing.js';

const SETTINGS = 'ordertocook:settings', TYPE = 'ordertocook:order_machine';
const settle = () => new Promise(resolve => setImmediate(resolve));
const drain = env => { for (const fn of env.system.callbacks.splice(0)) fn(); };
async function fixed(value, fn) {
  const original = Math.random; Math.random = () => value;
  try { return await fn(); } finally { Math.random = original; }
}
function boardFor(env, restaurant) {
  const location = { ...restaurant.location, x: restaurant.location.x + 3 };
  const board = place(env, 'ordertocook:board', location), record = env.store.getStation(board);
  record.ownerId = restaurant.ownerId;
  record.menu = [{ typeId: 'minecraft:bread', label: 'Bread', nutrition: 5 }];
  env.store.saveStation(record);
  if (env.hooks.syncMenu(restaurant)) env.store.saveRestaurant(restaurant);
}
async function fixture(saved = []) {
  const env = await mainFixture(saved);
  // A fresh native double has no world blocks. Recreate saved physical devices
  // independently of their canonical records before exercising reload callbacks.
  for (const record of env.store.restaurants()) place(env, TYPE, record.location);
  for (const record of env.store.stations()) if (record.typeId === 'ordertocook:board') place(env, record.typeId, record.location);
  env.restaurant.orders = []; env.restaurant.orderSequence = 0;
  // Avoid the main harness's deliberate dine-in core override masking the bug.
  env.restaurant.config.deliveryRate = 0.3; boardFor(env, env.restaurant);
  env.store.saveRestaurant(env.restaurant); return env;
}
function attempt(env, x, portable = false) {
  const block = env.dimension.getBlock({ x, y: 0, z: 0 });
  const stack = portable ? writePortableBlock(new FakeItem(TYPE), { ...env.restaurant, name: 'Portable shop',
    config: { ...env.restaurant.config, deliveryRate: 0.75 } }) : new FakeItem(TYPE);
  if (portable) assert.equal(readPortableBlock(stack).config, undefined, 'portable data cannot carry an override');
  env.player.container.setItem(0, stack);
  const event = { block, player: env.player, permutationToPlace: { type: { id: TYPE } }, cancel: false };
  env.blockComponents.get('ordertocook:interact').beforeOnPlayerPlace(event);
  assert.equal(event.cancel, false);
  block.setType(TYPE); env.player.container.setItem(0, undefined);
  for (const fn of env.world.afterEvents.playerPlaceBlock.subscriptions) fn({ block, player: env.player });
  env.blockComponents.get('ordertocook:interact').onPlace({ block }); drain(env);
  const restaurant = env.store.getRestaurant(env.store.locationId(env.dimension.id, block.location));
  assert.ok(restaurant); boardFor(env, restaurant); return { block, restaurant };
}
async function refresh(env, entry = 'event', block = env.machine) {
  const restaurant = env.store.getRestaurant(env.store.locationId(env.dimension.id, block.location));
  const sequence = restaurant.orderSequence;
  env.player.location = { ...block.location, x: block.location.x + 1 };
  if (entry === 'event') {
    env.player.tags.add('otc_admin');
    for (const fn of env.system.afterEvents.scriptEventReceive.subscriptions) fn({
      id: 'ordertocook:refresh', message: '', sourceType: 'Entity', sourceEntity: env.player
    });
  } else if (entry === 'tick') {
    restaurant.active = true; env.store.saveRestaurant(restaurant);
    env.properties.set(MACHINE_TICKS + restaurant.id, restaurant.machineRefreshOrigin + Math.ceil(restaurant.config.refreshMs / 50) - 1);
    env.system.currentTick++;
    env.blockComponents.get('ordertocook:machine_timing').onTick({ block });
  } else {
    assert.equal(restaurant.orderSequence, 0); restaurant.active = false; env.store.saveRestaurant(restaurant);
    env.player.container.setItem(0, undefined); env.formResponses.push(0);
    env.blockComponents.get('ordertocook:interact').onPlayerInteract({ block, player: env.player });
    await settle();
  }
  assert.ok(env.store.getRestaurant(restaurant.id).orderSequence > sequence, `${entry} must generate new offers, not return old ones`);
  return env.store.getRestaurant(restaurant.id).orders.filter(order => order.status === 'offered' && !order.walkIn);
}
async function expectType(env, type, { entry = 'event', block = env.machine, rng = 0.2 } = {}) {
  const orders = await fixed(rng, () => refresh(env, entry, block));
  assert.ok(orders.length > 0, `${entry} must generate offers`);
  assert.ok(orders.every(order => order.type === type), `${entry}/${rng}: expected ${type}, got ${orders.map(order => order.type)}`);
  return orders;
}

test('strict global endpoints govern every machine generation entry for server, creative and tagged admins', async () => {
  for (const source of ['server', 'creative', 'admin']) for (const rate of [0, 1]) for (const entry of ['event', 'tick', 'open']) {
    const env = await fixture(); configure(env, { deliveryRate: rate }, source);
    assert.equal(JSON.parse(env.properties.get(SETTINGS)).deliveryRate, rate);
    assert.equal(env.restaurant.config.deliveryRate, rate);
    // A stale persisted restaurant config must never defeat the global value.
    env.restaurant.config.deliveryRate = 1 - rate; env.store.saveRestaurant(env.restaurant);
    await expectType(env, rate ? 'delivery' : 'dine_in', { entry, rng: rate ? 0.999999 : 0 });
    assert.equal(env.store.getRestaurant(env.restaurant.id).config.deliveryRate, rate);
  }
});

test('ordinary players and non-player entity events cannot change delivery probability', async () => {
  const env = await fixture(); const before = [...env.properties];
  configure(env, { deliveryRate: 0 }, 'ordinary');
  for (const fn of env.system.afterEvents.scriptEventReceive.subscriptions) fn({
    id: 'ordertocook:config', message: '{"deliveryRate":0}', sourceType: 'Entity', sourceEntity: { typeId: 'minecraft:cow' }
  });
  assert.deepEqual([...env.properties], before); await expectType(env, 'delivery');
});

test('invalid probabilities reject the whole command without companion settings or live changes', async () => {
  for (const initial of [0, 1]) for (const value of [null, true, false, '0', '1', [], {}, -0.001, 1.001]) {
    const env = await fixture(); configure(env, { deliveryRate: initial }); const before = [...env.properties];
    configure(env, { deliveryRate: value, countertopConsumeLeather: false, maxOrderMachinesWithin24: 2, refreshSeconds: 42 });
    assert.deepEqual([...env.properties], before); assert.match(env.player.messages.at(-1), /deliveryRate.*0\.\.1/);
    await expectType(env, initial ? 'delivery' : 'dine_in');
  }
  // 1e400 is valid JSON syntax but parses to Infinity. Avoid JSON.stringify
  // turning nonfinite inputs into null and accidentally testing only null.
  for (const literal of ['1e400', '-1e400', 'NaN', 'Infinity']) {
    const env = await fixture(); configure(env, { deliveryRate: 0 }); const before = [...env.properties];
    for (const fn of env.system.afterEvents.scriptEventReceive.subscriptions) fn({ id: 'ordertocook:config',
      message: `{"deliveryRate":${literal},"refreshSeconds":42}`, sourceType: 'Server' });
    assert.deepEqual([...env.properties], before); await expectType(env, 'dine_in');
  }
});

test('missing and invalid saved probabilities use default 0.3 without rewriting raw settings', async () => {
  for (const value of [undefined, null, true, '0', [], {}, -1, 2]) {
    const raw = JSON.stringify({ currencyItem: '', deliveryRate: value }); const env = await fixture([[SETTINGS, raw]]);
    env.restaurant.config.deliveryRate = 1; env.store.saveRestaurant(env.restaurant);
    await expectType(env, 'dine_in', { rng: 0.4 }); await expectType(env, 'delivery', { rng: 0.2 });
    assert.equal(env.properties.get(SETTINGS), raw);
  }
  for (const raw of ['{"deliveryRate":1e400}', '{"deliveryRate":-1e400}']) {
    const env = await fixture([[SETTINGS, raw]]);
    await expectType(env, 'dine_in', { rng: 0.4 }); await expectType(env, 'delivery', { rng: 0.2 });
    assert.equal(env.properties.get(SETTINGS), raw);
  }
  const env = await fixture(); env.restaurant.config.deliveryRate = 1; env.store.saveRestaurant(env.restaurant);
  await expectType(env, 'dine_in', { rng: 0.3 }); await expectType(env, 'delivery', { rng: 0.2 });
  assert.equal(env.properties.has(SETTINGS), false);
});

test('malformed global documents stop initialization and remain untouched by configuration', async () => {
  for (const raw of ['{broken', 'null', '[]', 'false', '42', '"wrong"', 42]) {
    const env = await mainFixture([[SETTINGS, raw]]); assert.equal(env.hooks.ready, false);
    configure(env, { deliveryRate: 1 }); assert.equal(env.properties.get(SETTINGS), raw);
  }
});

test('new ordinary and portable machines inherit global rate, including reload and default reset', async () => {
  for (const rate of [0, 1]) for (const portable of [false, true]) {
    const env = await fixture(); configure(env, { deliveryRate: rate }, 'server');
    const { block, restaurant } = attempt(env, 50, portable);
    assert.equal(restaurant.config.deliveryRate, rate);
    if (portable) assert.equal(restaurant.name, 'Portable shop');
    await expectType(env, rate ? 'delivery' : 'dine_in', { entry: 'open', block });
    restaurant.config.deliveryRate = 1 - rate; env.store.saveRestaurant(restaurant);
    const reloaded = await fixture([...env.properties]), restoredBlock = place(reloaded, TYPE, block.location);
    assert.equal(JSON.parse(reloaded.properties.get(SETTINGS)).deliveryRate, rate);
    await expectType(reloaded, rate ? 'delivery' : 'dine_in', { entry: 'tick', block: restoredBlock });
    configure(reloaded, { deliveryRate: 0.3 });
    await expectType(reloaded, 'delivery', { block: restoredBlock, rng: 0.2 });
    await expectType(reloaded, 'dine_in', { block: restoredBlock, rng: 0.3 });
    const reset = await fixture([...reloaded.properties]); place(reset, TYPE, block.location);
    await expectType(reset, 'dine_in', { entry: 'tick', block: reset.dimension.getBlock(block.location), rng: 0.4 });
  }
});

test('pre-write failure and silent settings non-write preserve prior live behavior and stored bytes', async () => {
  for (const rate of [0, 1]) for (const failure of ['throw', 'omit']) {
    const env = await fixture(); configure(env, { deliveryRate: rate }); const before = [...env.properties];
    if (failure === 'throw') env.failWrite(key => key === SETTINGS);
    else { const write = env.world.setDynamicProperty; env.world.setDynamicProperty = (key, value) => { if (key !== SETTINGS) write(key, value); }; }
    configure(env, { deliveryRate: 1 - rate }); assert.deepEqual([...env.properties], before);
    assert.doesNotMatch(env.player.messages.at(-1), /設定已儲存/);
    await expectType(env, rate ? 'delivery' : 'dine_in');
  }
});

test('uncertain settings commit keeps old live value until reload; no new atomicity guarantee', async () => {
  for (const failure of ['write-then-throw', 'readback-throw', 'readback-mismatch']) {
    const env = await fixture(); configure(env, { deliveryRate: 0 });
    const write = env.world.setDynamicProperty, read = env.world.getDynamicProperty;
    if (failure === 'write-then-throw') env.world.setDynamicProperty = (key, value) => { write(key, value); if (key === SETTINGS) throw Error('write may have committed'); };
    else env.world.getDynamicProperty = key => { if (key === SETTINGS) { if (failure === 'readback-throw') throw Error('read unavailable'); return '{}'; } return read(key); };
    configure(env, { deliveryRate: 1 });
    env.world.setDynamicProperty = write; env.world.getDynamicProperty = read;
    assert.equal(JSON.parse(env.properties.get(SETTINGS)).deliveryRate, 1);
    assert.doesNotMatch(env.player.messages.at(-1), /設定已儲存/);
    await expectType(env, 'dine_in');
    const reloaded = await fixture([...env.properties]); await expectType(reloaded, 'delivery');
  }
});

test('partial restaurant propagation cannot undo global commit or control future refreshes', async () => {
  for (const failedIndex of [0, 1]) for (const rate of [0, 1]) {
    const env = await fixture(); configure(env, { deliveryRate: 1 - rate });
    const second = attempt(env, 50), third = attempt(env, 100);
    const records = [env.restaurant, second.restaurant, third.restaurant], failed = records[failedIndex];
    for (const [index, record] of records.entries()) {
      const order = env.core.generateOrder(record, { wall: Date.now(), tick: env.system.currentTick }, () => 0.2);
      Object.assign(order, { status: ['offered', 'accepted', 'packed'][index], proof: `kept-${index}`, carrier: 'bag' });
      env.store.saveRestaurant(record);
    }
    const orders = records.map(record => JSON.stringify(record.orders));
    env.failWrite(key => key === 'ordertocook:r:' + failed.id);
    configure(env, { deliveryRate: rate, maxOrderMachinesWithin24: 2 });
    assert.equal(JSON.parse(env.properties.get(SETTINGS)).deliveryRate, rate);
    assert.doesNotMatch(env.player.messages.at(-1), /設定已儲存/);
    assert.notEqual(env.store.getRestaurant(failed.id), failed, 'rollback must replace canonical identity');
    for (let i = 0; i < records.length; i++) assert.equal(JSON.stringify(env.store.getRestaurant(records[i].id).orders), orders[i]);
    const reloaded = await fixture([...env.properties]);
    for (const target of [env, reloaded]) for (const block of [env.machine, second.block, third.block]) {
      const localBlock = place(target, TYPE, block.location);
      await expectType(target, rate ? 'delivery' : 'dine_in', { entry: 'tick', block: localBlock });
    }
    const fresh = attempt(env, 150, true); assert.equal(fresh.restaurant.config.deliveryRate, rate);
  }
});

test('failed generation rolls back canonical orders, retries current rate and never revives stale snapshots', async () => {
  const env = await fixture(); configure(env, { deliveryRate: 0 });
  env.restaurant.config.deliveryRate = 1; env.restaurant.active = true; env.store.saveRestaurant(env.restaurant);
  const stale = env.restaurant, before = structuredClone(stale.orders);
  env.failWrite(key => key === 'ordertocook:r:' + stale.id);
  // Set progress directly so the failure belongs to the shipped tick's final save.
  env.properties.set(MACHINE_TICKS + stale.id, stale.machineRefreshOrigin + Math.ceil(stale.config.refreshMs / 50) - 1);
  await fixed(0.2, async () => assert.throws(() => env.blockComponents.get('ordertocook:machine_timing').onTick({ block: env.machine }), /persistence failure/));
  const canonical = env.store.getRestaurant(stale.id); assert.notEqual(canonical, stale);
  assert.deepEqual(canonical.orders, before); assert.equal(canonical.config.deliveryRate, 1);
  assert.throws(() => env.hooks.refreshMachineOrders(stale, env.machine), /stale|canonical/i);
  assert.equal(env.store.getRestaurant(stale.id), canonical); assert.deepEqual(canonical.orders, before);
  await expectType(env, 'dine_in', { entry: 'tick' });
});

test('configuration preserves offered, accepted, packed and completed order data and physical carriers', async () => {
  const env = await fixture();
  // Keep varied canonical records without accepting a second offer canceling the first.
  const now = { wall: Date.now(), tick: env.system.currentTick };
  for (const [index, status] of ['offered', 'accepted', 'packed', 'completed'].entries()) {
    const order = env.core.generateOrder(env.restaurant, now, () => 0.2);
    Object.assign(order, { status, type: index % 2 ? 'delivery' : 'dine_in', proof: `proof-${index}`, carrier: index % 2 ? 'bag' : 'plate', expiresTick: 12345 + index, metadata: { kept: index } });
  }
  env.store.saveRestaurant(env.restaurant);
  const packed = env.restaurant.orders.find(order => order.status === 'packed');
  const carrier = env.hooks.parcelFor(env.restaurant, packed); env.player.container.setItem(1, carrier);
  const before = structuredClone(env.restaurant.orders), sequence = env.restaurant.orderSequence;
  configure(env, { deliveryRate: 0 }); configure(env, { deliveryRate: 1 }); configure(env, { deliveryRate: 0.3 });
  assert.deepEqual(env.restaurant.orders, before); assert.equal(env.restaurant.orderSequence, sequence);
  assert.deepEqual(env.player.container.getItem(1), carrier);
});

test('an open form reads current rate; failed propagation invalidates stale form rather than recommitting it', async () => {
  for (const fail of [false, true]) {
    const env = await fixture(); configure(env, { deliveryRate: 1 });
    let close; env.formResponses.push(() => new Promise(resolve => { close = resolve; }));
    env.player.container.setItem(0, undefined); env.restaurant.active = false; env.store.saveRestaurant(env.restaurant);
    env.blockComponents.get('ordertocook:interact').onPlayerInteract({ block: env.machine, player: env.player });
    await settle(); assert.equal(typeof close, 'function');
    if (fail) env.failWrite(key => key === 'ordertocook:r:' + env.restaurant.id);
    configure(env, { deliveryRate: 0 }); const canonical = env.store.getRestaurant(env.restaurant.id);
    await fixed(0.2, async () => { close(0); await settle(); });
    assert.equal(env.store.getRestaurant(canonical.id), canonical);
    if (fail) { assert.equal(canonical.orders.length, 0); await expectType(env, 'dine_in', { entry: 'tick' }); }
    else assert.equal(canonical.orders.find(order => order.status === 'offered').type, 'dine_in');
  }
});

test('ordinary walk-ins stay dine-in even with global delivery probability one', async () => {
  const env = await fixture(); configure(env, { deliveryRate: 1 });
  env.restaurant.active = true; env.restaurant.config.refreshMs = 10000000; env.restaurant.config.walkInChances = [1];
  env.store.getStation(env.chair); env.store.saveRestaurant(env.restaurant);
  await fixed(0.2, async () => {
    for (let tick = 0; tick < 1201; tick++) {
      env.system.currentTick++; env.blockComponents.get('ordertocook:machine_timing').onTick({ block: env.machine });
    }
  });
  const arrivals = env.restaurant.orders.filter(order => order.walkIn);
  assert.equal(arrivals.length, 1); assert.equal(arrivals[0].type, 'dine_in');
});
