// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { mainFixture } from './main.harness.js';
import { FakeItem, place } from './appliances.harness.js';
import { writePortableBlock, readPortableBlock } from '../runtime/BP/scripts/portable_blocks.js';

function emit(signal, event) { for (const callback of signal.subscriptions) callback(event); return event; }
function breakDevice(env, block) {
  const event = emit(env.world.beforeEvents.playerBreakBlock, { block, player: env.player, cancel: false });
  assert.equal(event.cancel, false);
  const brokenBlockPermutation = block.permutation;
  block.setType('minecraft:air');
  const component = env.blockComponents.get('ordertocook:interact');
  component.onBreak({ block, brokenBlockPermutation, entitySource: env.player });
  component.onPlayerBreak({ block, brokenBlockPermutation, player: env.player });
  return env.dimension.drops.at(-1).stack;
}
function placeDevice(env, stack, location) {
  env.player.container.setItem(0, stack);
  const block = env.dimension.getBlock(location);
  const component = env.blockComponents.get('ordertocook:interact');
  const event = { block, player: env.player, permutationToPlace: { type: { id: stack.typeId } }, cancel: false };
  component.beforeOnPlayerPlace(event);
  if (event.cancel) return event;
  block.setType(stack.typeId);
  env.player.container.setItem(0, undefined);
  emit(env.world.afterEvents.playerPlaceBlock, { block, player: env.player });
  component.onPlace({ block });
  for (const callback of env.system.callbacks.splice(0)) callback();
  return block;
}

test('expired bag requires native consumption, retains its deadline without the order and unlocks once across reload', async () => {
  const env = await mainFixture();
  env.order.type = 'delivery'; env.order.carrier = 'bag'; env.order.expiresAt = Date.now() - 1;
  const bag = env.hooks.parcelFor(env.restaurant, env.order);
  env.restaurant.orders = []; env.store.saveRestaurant(env.restaurant);
  const use = { source: env.player, itemStack: bag, cancel: false };
  emit(env.world.beforeEvents.itemUse, use);
  assert.equal(use.cancel, false);
  env.itemComponents.get('ordertocook:use').onUse(use);
  assert.equal(env.store.getProfile(env.player.id), undefined);
  env.itemComponents.get('ordertocook:consume_bag').onConsume(use);
  const saved = structuredClone(env.store.getProfile(env.player.id));
  assert.ok(saved.state.unlocked.expired_bag_eaten);
  assert.deepEqual(saved.state.totals, { earned: 0, completed: 0, urgent: 0, longDistance: 0 });
  const resumed = await mainFixture(env.properties);
  resumed.player.id = env.player.id;
  resumed.itemComponents.get('ordertocook:consume_bag').onConsume({ source: resumed.player, itemStack: bag.clone() });
  assert.deepEqual(resumed.store.getProfile(resumed.player.id), saved);
});

test('fresh, blank and malformed bags cannot start eating or claim progress', async () => {
  const env = await mainFixture();
  const fresh = env.hooks.parcelFor(env.restaurant, { ...env.order, type: 'delivery', carrier: 'bag', expiresAt: Date.now() + 60000 });
  const malformed = new FakeItem('ordertocook:takeout_bag'); malformed.setDynamicProperty('ordertocook:expires_at', '0');
  for (const itemStack of [fresh, new FakeItem('ordertocook:takeout_bag'), malformed, env.parcel]) {
    const event = { source: env.player, itemStack, cancel: false };
    emit(env.world.beforeEvents.itemUse, event);
    if (itemStack.typeId === 'ordertocook:takeout_bag') assert.equal(event.cancel, true);
    env.itemComponents.get('ordertocook:consume_bag').onConsume(event);
  }
  assert.equal(env.store.getProfile(env.player.id), undefined);
});

test('failed native-consumption progress save returns the complete consumed parcel', async () => {
  const env = await mainFixture();
  const bag = env.hooks.parcelFor(env.restaurant, { ...env.order, type: 'delivery', carrier: 'bag', expiresAt: Date.now() - 1 });
  env.player.container.setItem(0, undefined); // Native consumption already removed it.
  env.failWrite(id => id.startsWith('ordertocook:p:'));
  env.itemComponents.get('ordertocook:consume_bag').onConsume({ source: env.player, itemStack: bag });
  assert.deepEqual(env.player.container.getItem(0), bag);
  assert.equal(env.store.getProfile(env.player.id), undefined);
});

test('board break emits one complete menu item; relocation and store reload keep variants, aliases and snapshots', async () => {
  const env = await mainFixture();
  const board = place(env, 'ordertocook:board', { x: 1, y: 0, z: 1 });
  const station = env.store.getStation(board);
  station.ownerId = env.player.id; station.initialized = true;
  station.menu = env.core.normalizeMenu([{ typeId: 'test:meal', nutrition: 7, label: '茶點🍵', foodIdentity: { carrier: 'senluo.public.food.v1', nativeVariant: 8 }, aliases: ['test:meal_alias'] }]);
  env.store.saveStation(station);
  const menu = structuredClone(station.menu), before = env.dimension.drops.length;
  const stack = breakDevice(env, board);
  assert.equal(env.dimension.drops.length, before + 1);
  assert.equal(env.store.findStation(board), undefined);
  const restored = placeDevice(env, stack.clone(), { x: 3, y: 0, z: 1 });
  assert.deepEqual(env.store.findStation(restored).menu, menu);
  const resumed = await mainFixture(env.properties);
  const record = resumed.store.stations().find(row => row.id === env.store.findStation(restored).id);
  assert.deepEqual(record.menu, menu); assert.equal(record.initialized, true);
});

test('restaurant relocation keeps owner, staff, level and all statistics without copying orders or personal ledgers', async () => {
  const env = await mainFixture();
  env.order.status = 'cancelled'; env.restaurant.active = false;
  Object.assign(env.restaurant, { name: '原店名🍵', level: 7, staff: ['helper'], orderSequence: 35 });
  Object.keys(env.restaurant.stats).forEach((key, index) => { env.restaurant.stats[key] = index * 37; });
  env.store.saveRestaurant(env.restaurant);
  const data = readPortableBlock(writePortableBlock(new FakeItem('ordertocook:order_machine'), env.restaurant));
  const stack = breakDevice(env, env.machine);
  assert.equal(env.store.getRestaurant(env.restaurant.id), undefined);
  const owner = env.player.id;
  env.player.id = 'placing-helper'; env.player.name = '新放置者';
  const block = placeDevice(env, stack, { x: 40, y: 0, z: 0 });
  const restored = env.store.getRestaurant(env.store.locationId(block.dimension.id, block.location));
  for (const [key, value] of Object.entries(data)) assert.deepEqual(restored[key], value, key);
  assert.equal(restored.ownerId, owner); assert.equal(restored.active, false);
  assert.equal(restored.progressLedger, undefined);
  assert.deepEqual(restored.orders, []); assert.deepEqual(restored.pendingDishes, []);
  const resumed = await mainFixture(env.properties);
  assert.deepEqual(resumed.store.getRestaurant(restored.id).stats, data.stats);
  assert.equal(resumed.store.getRestaurant(restored.id).ownerId, owner);
});

test('large menus retain all metadata across native-sized property chunks; broken data cancels placement', async () => {
  const env = await mainFixture();
  const menu = env.core.normalizeMenu(Array.from({ length: 150 }, (_, index) => ({ typeId: `test:meal_${index}`, nutrition: index + 1, label: '茶🍵'.repeat(33) })));
  const stack = writePortableBlock(new FakeItem('ordertocook:board'), { menu, initialized: true });
  assert.ok(stack.getDynamicProperty('ordertocook:block_data') > 1);
  for (const id of stack.getDynamicPropertyIds().filter(id => /:\d+$/.test(id))) assert.ok(Buffer.byteLength(stack.getDynamicProperty(id)) <= 30000);
  assert.deepEqual(readPortableBlock(stack).menu, menu);
  stack.setDynamicProperty('ordertocook:block_data:1', undefined);
  const result = placeDevice(env, stack, { x: 5, y: 0, z: 0 });
  assert.equal(result.cancel, true);
  assert.equal(env.player.container.getItem(0).typeId, stack.typeId);
});

test('portable placement returns the original data-bearing item when the world save fails', async () => {
  for (const typeId of ['ordertocook:board', 'ordertocook:order_machine']) {
    const env = await mainFixture();
    const record = typeId.endsWith(':board') ? { menu: env.restaurant.menu, initialized: true } : env.restaurant;
    const stack = writePortableBlock(new FakeItem(typeId), record);
    const snapshot = readPortableBlock(stack);
    env.failWrite(id => id.startsWith(typeId.endsWith(':board') ? 'ordertocook:s:' : 'ordertocook:r:'));
    const block = placeDevice(env, stack, { x: 40, y: 0, z: 0 });
    assert.equal(block.typeId, 'minecraft:air');
    assert.deepEqual(readPortableBlock(env.player.container.getItem(0)), snapshot);
    assert.equal(env.store.getRestaurant(env.store.locationId(block.dimension.id, block.location)), undefined);
    assert.equal(env.store.findStation(block), undefined);
  }
});

test('native consume callbacks are attached only to items that declare minecraft:food', async () => {
  const env = await mainFixture(), items = new URL('../runtime/BP/items/', import.meta.url);
  for (const filename of await readdir(items)) {
    if (!filename.endsWith('.json')) continue;
    const item = JSON.parse(await readFile(new URL(filename, items), 'utf8'))['minecraft:item'];
    for (const [id, component] of env.itemComponents) {
      if (component.onConsume && Object.hasOwn(item.components, id)) {
        assert.ok(item.components['minecraft:food'], `${item.description.identifier} cannot register a native consume callback`);
      }
    }
  }
  assert.equal(env.itemComponents.get('ordertocook:use').onConsume, undefined);
});
