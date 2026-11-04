// SPDX-License-Identifier: GPL-3.0-only
// Production catalog -> board -> order -> inventory -> payment paths. Native
// events/containers are doubles; JSON reload is not a BDS or client play test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mainFixture, balance } from './main.harness.js';
import { FakeItem, FakeContainer, place } from './appliances.harness.js';
import { createFoodCatalog, FOOD_CATALOG_EVENT } from '../runtime/BP/scripts/food_catalog.js';

class PublicFoodStack extends FakeItem {
  constructor(typeId, nativeVariant, amount = 1, metadata = {}) {
    super(typeId, amount);
    this.lore = [{ translate: 'senluo.public.food.v1', with: [JSON.stringify({
      v: 1, hotUntil: 0, seasoning: [], ...(nativeVariant === undefined ? {} : { nativeVariant }), ...metadata
    })] }];
  }
  getRawLore() { return structuredClone(this.lore); }
  clone() { const copy = new PublicFoodStack(this.typeId); Object.assign(copy, structuredClone(this)); return copy; }
}

function scriptEvent(env, id, data) {
  for (const listener of env.system.afterEvents.scriptEventReceive.subscriptions) {
    listener({ id, sourceType: 'Server', message: JSON.stringify(data) });
  }
}
function publish(env, foods, options = {}) {
  scriptEvent(env, FOOD_CATALOG_EVENT, { v: 1, provider: 'test', replace: true, foods, ...options });
}
function boardFixture(env) {
  const block = place(env, 'ordertocook:board', { x: 0, y: 0, z: 1 });
  const station = env.store.getStation(block);
  station.initialized = true; station.menu = []; env.store.saveStation(station);
  return { block, station };
}
async function addHeld(env, block, stack) {
  env.player.selectedSlotIndex = 0; env.player.isSneaking = false;
  env.player.container.setItem(0, stack);
  await env.hooks.boardForm(env.player, block);
}
function acceptOrder(env, delivery = false) {
  env.hooks.syncMenu(env.restaurant); env.restaurant.orders = [];
  env.restaurant.config.deliveryRate = delivery ? 1 : 0;
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
  assert.equal(env.core.acceptOrder(env.restaurant, order.id).ok, true);
  env.store.saveRestaurant(env.restaurant);
  return order;
}
function counterFixture(env, delivery = false) {
  const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
  const shelf = env.store.getStation(place(env, delivery ? 'ordertocook:shelf' : 'ordertocook:plate_shelf', { x: 1, y: 0, z: 1 }));
  shelf.supplies = 3; env.store.saveStation(shelf);
  return { counter, shelf };
}
function pickupParcel(env, counter, order) {
  env.hooks.pickupDisplay(env.player, counter.above());
  const slot = env.player.container.slots.findIndex(stack =>
    stack?.typeId === (order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate') &&
    stack.getDynamicProperty('ordertocook:order_id') === order.id);
  assert.ok(slot >= 0, 'the actual preparation path must produce the matching parcel');
  env.player.selectedSlotIndex = slot;
  return env.player.container.getItem(slot);
}
function deliverOnce(env, counter, order) {
  const parcel = pickupParcel(env, counter, order);
  const quote = order.reward, initialBalance = balance(env.player);
  const linkage = { restaurantId: env.restaurant.id, orderId: order.id };
  env.customer.setDynamicProperty('ordertocook:order_id', order.id);
  if (order.type === 'delivery') {
    env.player.location = { x: order.destination.x, y: 0, z: order.destination.z };
    env.customer.location = { ...env.player.location };
  }
  env.hooks.customerInteract(env.player, env.customer, linkage, { rng: () => 0.999 });
  assert.equal(order.status, 'completed');
  assert.equal(order.paidReward, quote);
  assert.equal(balance(env.player), initialBalance + quote);
  const replaySlot = env.player.container.slots.findIndex(stack => !stack);
  assert.ok(replaySlot >= 0);
  env.player.container.setItem(replaySlot, parcel); env.player.selectedSlotIndex = replaySlot;
  env.hooks.customerInteract(env.player, env.customer, linkage, { rng: () => 0.999 });
  assert.equal(balance(env.player), initialBalance + quote, 'replaying a physical carrier cannot pay twice');
  assert.equal(env.restaurant.stats.completed, 1);
  return parcel;
}

const variantFoods = [
  { typeId: 'test:meal', nativeVariant: 7, nutrition: 6, label: '供應料理甲', aliases: ['test:meal_in_hand'] },
  { typeId: 'test:meal', nativeVariant: 8, nutrition: 9, label: '供應料理乙', aliases: ['test:meal_in_hand'] }
];
async function variantBoard(env) {
  publish(env, variantFoods);
  const board = boardFixture(env);
  await addHeld(env, board.block, new PublicFoodStack('test:meal_in_hand', 7));
  await addHeld(env, board.block, new PublicFoodStack('test:meal_in_hand', 8));
  return board;
}

test('a real Grilling food enters the menu without commands and mixed presentation IDs fulfil one dish', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  const typeId = 'kaleidoscope_grilling:grilled_lamb_skewer';
  const held = new PublicFoodStack(typeId + '_native_plain', 123, 64, { quality: 0, hotUntil: 999999 });
  assert.equal(held.getComponent('minecraft:food'), undefined, 'the test requires the actual shipped catalog');
  await addHeld(env, block, held);
  assert.equal(station.menu.length, 1);
  assert.equal(station.menu[0].typeId, typeId); assert.equal(station.menu[0].nutrition, 8);
  assert.equal(station.menu[0].foodIdentity, undefined, 'presentation metadata cannot create a new dish');
  assert.deepEqual(env.player.container.getItem(0), held);
  const order = acceptOrder(env), { counter, shelf } = counterFixture(env);
  assert.deepEqual(order.items[0].aliases, station.menu[0].aliases);
  const needed = order.items[0].amount;
  env.player.container.setItem(0, new PublicFoodStack(typeId, 999, 2, { quality: 3 }));
  env.player.container.setItem(1, new PublicFoodStack(typeId + '_java_three_alt', 888, needed - 2));
  const unrelated = new FakeItem('kaleidoscope_tavern:grape', 12);
  env.player.container.setItem(2, unrelated);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'packed'); assert.equal(shelf.supplies, 2);
  assert.equal(env.player.container.getItem(0), undefined); assert.equal(env.player.container.getItem(1), undefined);
  assert.deepEqual(env.player.container.getItem(2), unrelated);
  assert.match(deliverOnce(env, counter, order).getLore().join('\n'), /烤羊肉串/);
  assert.equal([...env.properties.keys()].some(key => key.startsWith('ordertocook:food_override:')), false);
});

test('provider declarations supply distinct same-ID variants in the backpack picker without native nutrition', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  publish(env, variantFoods);
  env.player.container.setItem(0, new PublicFoodStack('test:meal_in_hand', 7, 64));
  env.player.container.setItem(1, new PublicFoodStack('test:meal_in_hand', 8, 64));
  env.player.isSneaking = true;
  env.formResponses.push(0, (_player, _title, _body, buttons) => {
    assert.equal(buttons.length, 2); assert.match(buttons[0], /供應料理甲.*變體 7.*營養 6/);
    assert.match(buttons[1], /供應料理乙.*變體 8.*營養 9/); return 0;
  });
  await env.hooks.boardForm(env.player, block);
  env.formResponses.push(0, 0); await env.hooks.boardForm(env.player, block);
  assert.deepEqual(station.menu.map(food => food.foodIdentity.nativeVariant), [7, 8]);
  assert.equal(env.core.getMenuNutrition(station.menu), 15);
  assert.equal(env.player.container.getItem(0).amount, 64); assert.equal(env.player.container.getItem(1).amount, 64);
  assert.equal(env.hooks.foodFromStack(new PublicFoodStack('test:meal_in_hand', 9)), undefined);
  assert.equal(env.hooks.foodFromStack(new FakeItem('test:meal_in_hand')), undefined);
});

test('provider order snapshots survive updates, consume the quoted variants from fridge/backpack and deliver after withdrawal', async () => {
  const env = await mainFixture(), { station } = await variantBoard(env);
  const order = acceptOrder(env, true), { counter, shelf } = counterFixture(env, true);
  const menuBefore = structuredClone(station.menu), quoted = structuredClone(order);
  const first = order.items.find(food => food.foodIdentity.nativeVariant === 7);
  const second = order.items.find(food => food.foodIdentity.nativeVariant === 8);
  env.player.container.setItem(0, new PublicFoodStack('test:meal_in_hand', 8, first.amount + second.amount));
  const wrongVariant = structuredClone(env.player.container.slots);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'accepted'); assert.equal(shelf.supplies, 3);
  assert.deepEqual(structuredClone(env.player.container.slots), wrongVariant, 'enough of the wrong variant must not be consumed');
  assert.match(env.player.messages.at(-1), /供應料理甲.*變體 7/);
  publish(env, variantFoods.map(food => ({ ...food, label: '改名料理', nutrition: 100, aliases: ['test:meal_new_hand'] })));
  env.hooks.syncMenu(env.restaurant);
  assert.deepEqual(station.menu, menuBefore); assert.deepEqual(order, quoted);
  env.player.container.setItem(0, new PublicFoodStack('test:meal_new_hand', 7, first.amount));
  env.player.container.setItem(1, new PublicFoodStack('test:meal_in_hand', 8, second.amount));
  const beforeRejected = structuredClone(env.player.container.slots);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'accepted'); assert.equal(shelf.supplies, 3); assert.equal(counter.above().isAir, true);
  assert.deepEqual(structuredClone(env.player.container.slots), beforeRejected, 'a new alias cannot rewrite an accepted requirement');
  assert.match(env.player.messages.at(-1), /供應料理甲.*變體 7/);

  const fridge = env.store.getStation(place(env, 'ordertocook:refrigerator', { x: 3, y: 0, z: 0 }));
  const storage = new FakeContainer(27);
  storage.setItem(0, new PublicFoodStack('test:meal_in_hand', 7, first.amount, { quality: 3, hotUntil: 0 }));
  env.hooks.appliances.getStorage = station => station.id === fridge.id ? storage : undefined;
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'packed'); assert.equal(shelf.supplies, 2);
  assert.equal(storage.getItem(0), undefined); assert.equal(env.player.container.getItem(1), undefined);
  assert.equal(env.player.container.getItem(0).typeId, 'test:meal_new_hand', 'unquoted alias remains untouched');
  assert.deepEqual(order.items, quoted.items); assert.equal(order.reward, quoted.reward); assert.equal(order.expiresAt, quoted.expiresAt);
  publish(env, []);
  assert.equal(env.hooks.foodFromStack(new PublicFoodStack('test:meal', 7)), undefined);
  const parcel = deliverOnce(env, counter, order);
  assert.match(parcel.getLore().join('\n'), /供應料理甲.*變體 7/);
  assert.doesNotMatch(parcel.getLore().join('\n'), /改名料理/);
});

test('old alias-only menu/order data stays exact-ID and is not silently converted by the new catalog', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  const typeId = 'kaleidoscope_grilling:grilled_lamb_skewer';
  const legacy = { typeId: typeId + '_native_plain', nutrition: 8, label: '舊版羊肉串' };
  station.menu = [legacy]; env.store.saveStation(station);
  await addHeld(env, block, new FakeItem(typeId));
  assert.deepEqual(station.menu, [legacy], 'the new canonical entry must not duplicate a historical alias');
  const order = acceptOrder(env), { counter, shelf } = counterFixture(env);
  assert.equal(order.items[0].typeId, legacy.typeId); assert.equal(order.items[0].aliases, undefined);
  env.player.container.setItem(0, new FakeItem(typeId, order.items[0].amount));
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'accepted'); assert.equal(shelf.supplies, 3);
  assert.equal(env.player.container.getItem(0).amount, order.items[0].amount);
  env.player.container.setItem(0, new FakeItem(legacy.typeId, order.items[0].amount));
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'packed'); assert.equal(shelf.supplies, 2);
});

test('existing administrator overrides precede providers and keep the old persisted override shape', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  const typeId = 'kaleidoscope_tavern:brandy';
  assert.equal(env.hooks.foodFromStack(new FakeItem(typeId)), undefined);
  publish(env, [{ typeId, nutrition: 3, label: '供應商設定' }], { provider: 'kaleidoscope_tavern' });
  const override = { typeId, nutrition: 7, label: '原管理員設定' };
  scriptEvent(env, 'ordertocook:food', override);
  await addHeld(env, block, new FakeItem(typeId));
  assert.deepEqual(station.menu, [override]);
  assert.deepEqual(JSON.parse(env.properties.get('ordertocook:food_override:' + typeId)), override);
  publish(env, [{ typeId, nutrition: 99, label: '後來的供應商設定' }], { provider: 'kaleidoscope_tavern' });
  assert.deepEqual(env.hooks.foodFromStack(new FakeItem(typeId)), override);
  assert.deepEqual(station.menu, [override]);
});

test('changing only provider aliases while the picker is open rejects the stale selection', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  const food = { typeId: 'test:meal', nutrition: 6, label: '料理', aliases: ['test:meal_old_hand'] };
  publish(env, [food]);
  env.player.container.setItem(0, new FakeItem('test:meal')); env.player.isSneaking = true;
  env.formResponses.push(0, () => {
    publish(env, [{ ...food, aliases: ['test:meal_new_hand'] }]); return 0;
  });
  await env.hooks.boardForm(env.player, block);
  assert.deepEqual(station.menu, []); assert.match(env.player.messages.at(-1), /已改變/);
  assert.equal(env.player.container.getItem(0).amount, 1);
});

for (const packed of [false, true]) test(`cancelling ${packed ? 'a packed' : 'an accepted'} provider order is terminal and never refunds or pays food`, async () => {
  const env = await mainFixture(); await variantBoard(env);
  const order = acceptOrder(env), { counter, shelf } = counterFixture(env);
  order.items.forEach((food, slot) => env.player.container.setItem(slot,
    new PublicFoodStack('test:meal_in_hand', food.foodIdentity.nativeVariant, food.amount)));
  if (packed) env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  let parcel;
  if (packed) parcel = pickupParcel(env, counter, order);
  const inventoryBefore = structuredClone(env.player.container.slots), suppliesBefore = shelf.supplies;
  const expiresAt = order.expiresAt;
  assert.equal(env.core.cancelOrder(env.restaurant, order.id).ok, true); env.store.saveRestaurant(env.restaurant);
  publish(env, []);
  if (packed) {
    assert.ok(parcel); env.customer.setDynamicProperty('ordertocook:order_id', order.id);
    env.hooks.customerInteract(env.player, env.customer, { restaurantId: env.restaurant.id, orderId: order.id });
  } else env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'cancelled'); assert.equal(order.expiresAt, expiresAt);
  assert.deepEqual(structuredClone(env.player.container.slots), inventoryBefore);
  assert.equal(shelf.supplies, suppliesBefore); assert.equal(balance(env.player), 0);
  assert.equal(env.core.cancelOrder(env.restaurant, order.id).reason, 'already_cancelled');
  assert.equal(env.restaurant.stats.failed, 1); assert.equal(env.restaurant.stats.completed, 0);
});

let reloadNumber = 0;
async function readSavedStore(properties) {
  const original = await readFile(new URL('../runtime/BP/scripts/store.js', import.meta.url), 'utf8');
  const source = original.replace("import { world } from '@minecraft/server';", `
    const properties = new Map(${JSON.stringify([...properties])});
    const world = {
      writes: [], getDynamicPropertyIds: () => [...properties.keys()],
      getDynamicProperty: key => properties.get(key),
      setDynamicProperty(key, value) { this.writes.push([key, value]); if (value === undefined) properties.delete(key); else properties.set(key, value); }
    };
  `) + `\nexport { world as testWorld };\n// food reload ${++reloadNumber}`;
  const store = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  store.initStore();
  return store;
}

test('fresh initStore restores old and provider menu/order snapshots from saved JSON without a provider registry', async () => {
  const env = await mainFixture(), { station } = await variantBoard(env);
  const legacy = { typeId: 'minecraft:bread', nutrition: 5, label: '舊麵包' };
  const legacyVariant = { typeId: 'test:legacy_meal', nutrition: 4, label: '舊變體料理',
    foodIdentity: { carrier: 'senluo.public.food.v1', nativeVariant: 13 } };
  station.menu.push(legacy, legacyVariant); env.store.saveStation(station);
  env.hooks.syncMenu(env.restaurant); env.restaurant.orders = [];
  for (const status of ['accepted', 'packed', 'cancelled']) {
    const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
    assert.equal(env.core.acceptOrder(env.restaurant, order.id).ok, true);
    if (status === 'packed') assert.equal(env.core.packOrder(env.restaurant, order.id).ok, true);
    if (status === 'cancelled') assert.equal(env.core.cancelOrder(env.restaurant, order.id).ok, true);
  }
  env.store.saveRestaurant(env.restaurant);
  const expectedRestaurant = structuredClone(env.restaurant), expectedStation = structuredClone(station);
  const absentProvider = createFoodCatalog();
  assert.equal(absentProvider.resolve(new PublicFoodStack('test:meal', 7)).food, undefined);
  const restored = await readSavedStore(env.properties);
  const loadedRestaurant = restored.getRestaurant(env.restaurant.id);
  const loadedStation = restored.stations().find(item => item.id === station.id);
  assert.deepEqual(loadedRestaurant, expectedRestaurant);
  assert.deepEqual(loadedStation, expectedStation);
  assert.deepEqual(env.core.normalizeMenu(loadedStation.menu), expectedStation.menu);
  assert.equal(loadedRestaurant.menu.find(item => item.typeId === 'minecraft:bread').aliases, undefined);
  assert.equal(loadedRestaurant.menu.find(item => item.typeId === 'test:legacy_meal').aliases, undefined);
  assert.deepEqual(loadedRestaurant.menu[0].aliases, ['test:meal_in_hand']);
  assert.equal(restored.testWorld.writes.length, 0, 'loading preserved snapshots must not migrate or rewrite them');
  assert.equal([...env.properties.keys()].some(key => key.includes('food_catalog') || key.includes('food_provider')), false);
});
