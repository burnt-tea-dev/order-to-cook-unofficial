// SPDX-License-Identifier: GPL-3.0-only
// Stable adapter regressions. Native doubles are not client/world acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mainFixture } from './main.harness.js';
import { place } from './appliances.harness.js';

function savedRestaurant(env) {
  const root = 'ordertocook:r:' + env.restaurant.id;
  const manifest = JSON.parse(env.properties.get(root));
  return JSON.parse(Array.from({ length: manifest.parts }, (_, i) =>
    env.properties.get(`${root}:part:${manifest.buffer}:${i}`)).join(''));
}
function dish(variant = 7, nutrition = 9) {
  return { typeId: 'test:meal', label: `Saved variant ${variant}`, nutrition,
    foodIdentity: { carrier: 'senluo.public.food.v1', nativeVariant: variant } };
}
function board(env, location = { x: 3, y: 0, z: 0 }, menu = [dish()]) {
  const block = place(env, 'ordertocook:board', location);
  const record = env.store.getStation(block);
  record.ownerId = env.player.id; record.menu = menu; env.store.saveStation(record);
  return { block, record };
}
function bind(env, value) {
  env.restaurant.active = false;
  env.restaurant.boardId = value.record.id;
  env.restaurant.menu = env.core.normalizeMenu(value.record.menu);
  env.restaurant.nearbyBoardNutrition = env.core.getMenuNutrition(value.record.menu);
  env.store.saveRestaurant(env.restaurant);
}
function rootWrites(env) {
  const original = env.world.setDynamicProperty;
  const writes = [];
  env.world.setDynamicProperty = (key, value) => {
    if (key === 'ordertocook:r:' + env.restaurant.id) writes.push(value);
    return original(key, value);
  };
  return writes;
}
function withUnavailable(env, block, mode) {
  const original = env.dimension.getBlock;
  env.dimension.getBlock = location => {
    if (Object.keys(block.location).every(axis => block.location[axis] === location[axis])) {
      if (mode === 'throw') throw Error('chunk unavailable');
      return undefined;
    }
    return original(location);
  };
  return () => { env.dimension.getBlock = original; };
}
function tick(env) {
  const original = console.warn;
  console.warn = () => {};
  try { env.hooks.tickRestaurants(); } finally { console.warn = original; }
}

test('idle discovery and same-nutrition variant changes persist without refresh or expiry', async () => {
  const env = await mainFixture(), value = board(env);
  env.restaurant.active = false; env.store.saveRestaurant(env.restaurant);
  tick(env);
  assert.equal(savedRestaurant(env).boardId, value.record.id);
  assert.deepEqual(savedRestaurant(env).menu, value.record.menu);
  value.record.menu = [dish(8)]; env.store.saveStation(value.record);
  tick(env);
  assert.deepEqual(savedRestaurant(env).menu, [dish(8)]);
});

test('getMachine commits binding before its caller can cancel the form', async () => {
  const env = await mainFixture(), value = board(env);
  env.hooks.getMachine(env.player, env.machine);
  assert.equal(savedRestaurant(env).boardId, value.record.id);
  assert.deepEqual(savedRestaurant(env).menu, value.record.menu);
});

test('unchanged binding and rewards cause no restaurant root writes', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  const writes = rootWrites(env);
  tick(env); tick(env); env.hooks.getMachine(env.player, env.machine);
  assert.equal(writes.length, 0);
});

test('reward-only offer changes persist without changing accepted or packed snapshots', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  const offered = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
  offered.reward = -1; offered.benefitLevel = -1;
  const packed = structuredClone(env.order);
  const accepted = structuredClone(env.order); accepted.id += ':accepted'; accepted.status = 'accepted';
  env.restaurant.orders.push(accepted); env.store.saveRestaurant(env.restaurant);
  tick(env);
  const saved = savedRestaurant(env);
  assert.notEqual(saved.orders.find(o => o.id === offered.id).reward, -1);
  assert.notEqual(saved.orders.find(o => o.id === offered.id).benefitLevel, -1);
  assert.deepEqual(saved.orders.find(o => o.id === packed.id), packed);
  assert.deepEqual(saved.orders.find(o => o.id === accepted.id), accepted);
  const writes = rootWrites(env); tick(env); assert.equal(writes.length, 0);
});

for (const action of ['cancel', 'nutrition', 'funds', 'max-level']) test(`upgrade ${action} retains its discovered menu immediately`, async () => {
  const env = await mainFixture(), value = board(env);
  if (action === 'max-level') { env.restaurant.level = 8; env.store.saveRestaurant(env.restaurant); }
  if (action === 'funds') { value.record.menu = [dish(7, 100)]; env.store.saveStation(value.record); }
  env.formResponses.push(action === 'cancel' ? 1 : 0);
  await env.hooks.upgradeForm(env.player, env.machine, env.restaurant);
  assert.equal(savedRestaurant(env).boardId, value.record.id);
  assert.deepEqual(savedRestaurant(env).menu, value.record.menu);
  assert.equal(savedRestaurant(env).level, action === 'max-level' ? 8 : 0);
});

test('upgrade confirmation commits a board changed while its form was open', async () => {
  const env = await mainFixture(), value = board(env, undefined, [dish(7, 100)]); bind(env, value);
  env.formResponses.push(() => { value.record.menu = []; env.store.saveStation(value.record); return 0; });
  await env.hooks.upgradeForm(env.player, env.machine, env.restaurant);
  assert.deepEqual(savedRestaurant(env).menu, []);
  assert.equal(savedRestaurant(env).level, 0);
  assert.match(env.player.messages.at(-1), /菜單總營養值不足/);
});

test('administrator empty refresh persists confirmed board removal', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  value.block.setType('minecraft:air'); env.player.getGameMode = () => 'Creative';
  for (const callback of env.system.afterEvents.scriptEventReceive.subscriptions) callback({
    id: 'ordertocook:refresh', sourceType: 'Entity', sourceEntity: env.player, message: ''
  });
  assert.equal(savedRestaurant(env).boardId, '');
  assert.deepEqual(savedRestaurant(env).menu, []);
});

for (const mode of ['throw', 'undefined']) test(`unavailable bound board (${mode}) retains snapshot and defers replacement`, async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  const before = savedRestaurant(env), restore = withUnavailable(env, value.block, mode);
  board(env, { x: 4, y: 0, z: 0 }, [dish(9, 100)]);
  const writes = rootWrites(env); tick(env);
  assert.equal(env.restaurant.boardId, value.record.id);
  assert.deepEqual(env.restaurant.menu, before.menu);
  assert.deepEqual(savedRestaurant(env), before);
  assert.equal(writes.length, 0);
  restore(); tick(env);
  assert.deepEqual(savedRestaurant(env).menu, value.record.menu);
  assert.equal(savedRestaurant(env).nearbyBoardNutrition, 100);
});

for (const replacement of ['minecraft:air', 'minecraft:stone']) test(`loaded ${replacement} is confirmed removal, not unloading`, async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  value.block.setType(replacement); tick(env);
  assert.equal(savedRestaurant(env).boardId, ''); assert.deepEqual(savedRestaurant(env).menu, []);
});

for (const ineligible of ['owner', 'dimension', 'range', 'type']) test(`ineligible ${ineligible} binding is not retained just because unloaded`, async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  if (ineligible === 'owner') value.record.ownerId = 'unrelated-owner';
  if (ineligible === 'dimension') value.record.dimensionId = 'minecraft:nether';
  if (ineligible === 'range') value.record.location.x = 25;
  if (ineligible === 'type') value.record.typeId = 'ordertocook:shelf';
  env.store.saveStation(value.record);
  const getBlock = env.dimension.getBlock;
  env.dimension.getBlock = location => location.x === 0 ? getBlock(location) : undefined;
  tick(env);
  assert.equal(savedRestaurant(env).boardId, ''); assert.deepEqual(savedRestaurant(env).menu, []);
});

test('expiry commits even when menu synchronization defers an unloaded bound board', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  env.system.currentTick = 1; env.order.expiresTick = 0; env.order.expiresAt = Date.now() - 1;
  env.store.saveRestaurant(env.restaurant);
  const restore = withUnavailable(env, value.block, 'throw'); tick(env);
  let saved = savedRestaurant(env);
  assert.equal(saved.orders.find(o => o.id === env.order.id).status, 'expired');
  assert.equal(saved.stats.failed, 1); assert.deepEqual(saved.menu, value.record.menu);
  restore(); tick(env); saved = savedRestaurant(env); assert.equal(saved.stats.failed, 1);
});

for (const phase of ['chunk', 'root']) test(`rejected ${phase} save keeps old snapshot and retries binding next tick`, async () => {
  const env = await mainFixture(), value = board(env);
  env.restaurant.active = false; env.store.saveRestaurant(env.restaurant);
  const before = savedRestaurant(env), key = 'ordertocook:r:' + env.restaurant.id;
  env.failWrite(id => phase === 'root' ? id === key : id.startsWith(key + ':part:'));
  tick(env);
  assert.deepEqual(savedRestaurant(env), before);
  assert.deepEqual(env.store.getRestaurant(env.restaurant.id), before);
  tick(env);
  assert.equal(savedRestaurant(env).boardId, value.record.id);
  assert.deepEqual(savedRestaurant(env).menu, value.record.menu);
  assert.deepEqual(savedRestaurant(env).orders, before.orders);
});


test('saved binding, variant and removal survive loading a fresh production store', async () => {
  const env = await mainFixture(), value = board(env);
  const storeUrl = new URL('../runtime/BP/scripts/store.js', import.meta.url);
  const source = (await readFile(storeUrl, 'utf8'))
    .replace(/from '(\.[^']+)'/g, (_match, path) => `from '${new URL(path, storeUrl).href}'`);
  let sequence = 0;
  async function reload() {
    const adapter = `const properties = new Map(${JSON.stringify([...env.properties])});
      const world = { getDynamicPropertyIds: () => [...properties.keys()], getDynamicProperty: key => properties.get(key) };`;
    const text = source.replace("import { world } from '@minecraft/server';", adapter) + `\n// restart ${++sequence}`;
    const fresh = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
    fresh.initStore(); return fresh.getRestaurant(env.restaurant.id);
  }
  tick(env);
  assert.equal((await reload()).boardId, value.record.id);
  assert.deepEqual((await reload()).menu, value.record.menu);
  value.record.menu = [dish(8)]; env.store.saveStation(value.record); tick(env);
  assert.deepEqual((await reload()).menu, [dish(8)]);
  value.block.setType('minecraft:air'); tick(env);
  assert.equal((await reload()).boardId, ''); assert.deepEqual((await reload()).menu, []);
});

test('native refresh callback saves empty rebinding even when it generates no offers', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  env.restaurant.active = true; env.restaurant.config.refreshMs = 50;
  env.store.saveRestaurant(env.restaurant); value.block.setType('minecraft:air');
  env.hooks.tickMachine(env.machine);
  assert.equal(savedRestaurant(env).boardId, ''); assert.deepEqual(savedRestaurant(env).menu, []);
});

test('native arrival callback saves empty rebinding even when it generates no walk-in', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  env.restaurant.active = true; env.restaurant.config.refreshMs = 99999999;
  env.store.saveRestaurant(env.restaurant);
  for (let i = 0; i < 1200; i++) env.hooks.tickMachine(env.machine);
  value.block.setType('minecraft:air'); env.hooks.tickMachine(env.machine);
  assert.equal(savedRestaurant(env).boardId, ''); assert.deepEqual(savedRestaurant(env).menu, []);
});

test('unavailable binding defers upgrade rather than authorizing it from a stale snapshot', async () => {
  const env = await mainFixture(), value = board(env, undefined, [dish(7, 100)]); bind(env, value);
  const before = savedRestaurant(env); withUnavailable(env, value.block, 'throw');
  await assert.rejects(env.hooks.upgradeForm(env.player, env.machine, env.restaurant), /chunk is unavailable/);
  assert.deepEqual(savedRestaurant(env), before); assert.equal(env.forms.length, 0);
});

test('unavailable board does not block printer expiry state or unrelated progress acknowledgement', async () => {
  const env = await mainFixture(), value = board(env); bind(env, value);
  env.order.status = 'offered'; env.order.expiresTick = 0; env.system.currentTick = 1;
  env.restaurant.progressEvents = [{ playerId: env.player.id, event: { type: 'order_machine_placed' } }];
  env.store.saveRestaurant(env.restaurant);
  env.hooks.syncPrinter(env.restaurant, env.machine);
  assert.equal(env.machine.permutation.getState('ordertocook:mode'), 'waiting');
  withUnavailable(env, value.block, 'throw'); tick(env);
  assert.equal(savedRestaurant(env).orders.find(o => o.id === env.order.id).status, 'expired');
  assert.equal(env.machine.permutation.getState('ordertocook:mode'), 'idle');
  assert.deepEqual(savedRestaurant(env).progressEvents, []);
  assert.ok(env.hooks.progression.getState(env.player.id).unlocked.root);
  assert.equal(savedRestaurant(env).boardId, value.record.id);
});

test('failed menu commit does not reconcile pending progress on a rolled-back stale object', async () => {
  const env = await mainFixture(); board(env);
  env.restaurant.progressEvents = [{ playerId: env.player.id, event: { type: 'order_machine_placed' } }];
  env.store.saveRestaurant(env.restaurant);
  const before = savedRestaurant(env), key = 'ordertocook:r:' + env.restaurant.id;
  env.failWrite(id => id === key); tick(env);
  assert.deepEqual(savedRestaurant(env), before);
  assert.equal(env.hooks.progression.getState(env.player.id).unlocked.root, undefined);
  tick(env);
  assert.ok(env.hooks.progression.getState(env.player.id).unlocked.root);
  assert.deepEqual(savedRestaurant(env).progressEvents, []);
});
