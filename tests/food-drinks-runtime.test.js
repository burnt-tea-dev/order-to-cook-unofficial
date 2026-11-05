// SPDX-License-Identifier: GPL-3.0-only
// Shipped catalog/menu/order/store paths with native IO doubles. These checks
// are not an engine cross-pack event test or a real saved-world restart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mainFixture, balance } from './main.harness.js';
import { FakeItem, FakeContainer, place } from './appliances.harness.js';
import { FOOD_CATALOG_EVENT } from '../runtime/BP/scripts/food_catalog.js';

const WINE = 'kaleidoscope_tavern:wine_q1';
const COLA = 'kaleidoscope_world_liquor:cola';

class DrinkStack extends FakeItem {
  constructor(typeId, amount = 1, quality = 0) {
    super(typeId, amount);
    this.lore = [{ translate: 'senluo.public.food.v1', with: [JSON.stringify({
      v: 1, hotUntil: 0, seasoning: [], quality, nativeVariant: 31
    })] }];
  }
  getRawLore() { return structuredClone(this.lore); }
  clone() { const copy = new DrinkStack(this.typeId); Object.assign(copy, structuredClone(this)); return copy; }
}

function boardFixture(env) {
  const block = place(env, 'ordertocook:board', { x: 0, y: 0, z: 1 });
  const station = env.store.getStation(block);
  station.initialized = true; station.menu = []; env.store.saveStation(station);
  return { block, station };
}
async function registerHeld(env, block, item) {
  env.player.isSneaking = false; env.player.selectedSlotIndex = 0;
  env.player.container.setItem(0, item);
  await env.hooks.boardForm(env.player, block);
}
async function drinkBoard(env, withCola = true) {
  const board = boardFixture(env);
  await registerHeld(env, board.block, new DrinkStack(WINE));
  if (withCola) await registerHeld(env, board.block, new DrinkStack(COLA));
  return board;
}
function newOrder(env, delivery = false) {
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
function pickup(env, counter, order) {
  env.hooks.pickupDisplay(env.player, counter.above());
  const slot = env.player.container.slots.findIndex(item =>
    item?.typeId === (order.type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate') &&
    item.getDynamicProperty('ordertocook:order_id') === order.id);
  assert.ok(slot >= 0);
  env.player.selectedSlotIndex = slot;
  return env.player.container.getItem(slot);
}
function publish(env, entry) {
  env.system.sendScriptEvent(FOOD_CATALOG_EVENT, JSON.stringify({
    v: 1, provider: 'test', replace: true, foods: [entry]
  }));
}

test('real wine quality IDs are one zero-nutrition drink and a drink-only menu generates drinks', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  for (let quality = 1; quality <= 6; quality++) {
    const held = new DrinkStack(`kaleidoscope_tavern:wine_q${quality}`, 12, quality % 4);
    assert.equal(held.getComponent('minecraft:food'), undefined);
    await registerHeld(env, block, held);
    assert.equal(station.menu.length, 1, 'quality is an equivalent item ID, not an additional menu drink');
    assert.deepEqual(env.player.container.getItem(0), held, 'menu registration never consumes the held drink');
  }
  const wine = station.menu[0];
  assert.equal(wine.typeId, WINE); assert.equal(wine.nutrition, 0);
  assert.equal(wine.servingKind, 'drink'); assert.equal(wine.foodIdentity, undefined);
  assert.deepEqual(wine.aliases, [2, 3, 4, 5, 6].map(n => `kaleidoscope_tavern:wine_q${n}`));
  await registerHeld(env, block, new DrinkStack(COLA));
  assert.equal(station.menu.length, 2); assert.equal(env.core.getMenuNutrition(station.menu), 0);
  const order = newOrder(env);
  assert.deepEqual(new Set(order.items.map(item => item.typeId)), new Set([WINE, COLA]));
  assert.equal(order.items.some(item => item.typeId === 'minecraft:apple'), false);
  assert.ok(order.items.every(item => item.servingKind === 'drink' && item.nutrition === 0));
  assert.equal(env.core.getUpgradeQuote(env.restaurant).reason, 'menu_nutrition');
  assert.equal(env.core.getUpgradeQuote(env.restaurant).requiredNutrition, 40);
  env.restaurant.level = 7;
  assert.equal(env.core.getEffectiveBenefitLevel(env.restaurant), 0);
  assert.equal(env.core.getUpgradeQuote(env.restaurant).requiredNutrition, 600);
  assert.equal(env.core.getMenuNutrition(env.restaurant), 0);
  assert.equal(order.reward, env.core.calculateReward({ ...order, items: [] }, order.benefitLevel), 'a drink adds no hunger bonus');
  assert.equal([...env.properties.keys()].some(key => key.startsWith('ordertocook:food_override:')), false);
});

test('zero-nutrition drinks are prepared from fridge/backpack quality aliases and delivered once for the original base quote', async () => {
  const env = await mainFixture(); await drinkBoard(env);
  const order = newOrder(env, true), { counter, shelf } = counterFixture(env, true);
  const wine = order.items.find(item => item.typeId === WINE);
  const cola = order.items.find(item => item.typeId === COLA);
  assert.ok(wine && cola); assert.ok(wine.amount > 2);
  const quoted = structuredClone(order);
  const fridge = env.store.getStation(place(env, 'ordertocook:refrigerator', { x: 3, y: 0, z: 0 }));
  const storage = new FakeContainer(27);
  storage.setItem(0, new DrinkStack(WINE, 2, 0));
  storage.setItem(1, new DrinkStack(COLA, cola.amount, 3));
  env.hooks.appliances.getStorage = station => station.id === fridge.id ? storage : undefined;
  env.player.container.setItem(0, new DrinkStack('kaleidoscope_tavern:wine_q6', wine.amount - 2, 3));
  const unrelated = new FakeItem('minecraft:glass_bottle', 9);
  env.player.container.setItem(1, unrelated);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'packed'); assert.equal(shelf.supplies, 2);
  assert.equal(storage.getItem(0), undefined); assert.equal(storage.getItem(1), undefined);
  assert.equal(env.player.container.getItem(0), undefined);
  assert.deepEqual(env.player.container.getItem(1), unrelated);
  assert.deepEqual(order.items, quoted.items); assert.equal(order.reward, quoted.reward);
  const parcel = pickup(env, counter, order);
  env.customer.setDynamicProperty('ordertocook:order_id', order.id);
  env.player.location = { x: order.destination.x, y: 0, z: order.destination.z };
  env.customer.location = { ...env.player.location };
  const linkage = { restaurantId: env.restaurant.id, orderId: order.id };
  env.hooks.customerInteract(env.player, env.customer, linkage, { rng: () => 0.999 });
  assert.equal(order.status, 'completed'); assert.equal(order.paidReward, quoted.reward);
  assert.equal(balance(env.player), quoted.reward);
  const replaySlot = env.player.container.slots.findIndex(item => !item);
  env.player.container.setItem(replaySlot, parcel); env.player.selectedSlotIndex = replaySlot;
  env.hooks.customerInteract(env.player, env.customer, linkage, { rng: () => 0.999 });
  assert.equal(balance(env.player), quoted.reward); assert.equal(env.restaurant.stats.completed, 1);
});

test('adding audited zero-nutrition drinks does not admit unknown zero-nutrition food or tools', async () => {
  const env = await mainFixture();
  class ZeroFood extends FakeItem {
    getComponent(id) { return id === 'minecraft:food' ? { nutrition: 0 } : super.getComponent(id); }
  }
  assert.equal(env.hooks.foodFromStack(new FakeItem('test:tool')), undefined);
  assert.equal(env.hooks.foodFromStack(new ZeroFood('test:zero_food')), undefined);
  assert.equal(env.hooks.foodFromStack(new FakeItem('kaleidoscope_tavern:shaker')), undefined);
  assert.deepEqual(env.core.normalizeMenu([{ typeId: 'test:tool', nutrition: 0 }]), []);
  assert.equal(env.hooks.foodFromStack(new FakeItem('minecraft:bread')).nutrition, 5);
});

test('a provider serving-kind change while the picker is open rejects the stale selection', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  const supplied = { typeId: 'test:beverage', nutrition: 3, label: '供應飲品', servingKind: 'drink' };
  publish(env, supplied);
  env.player.container.setItem(0, new FakeItem(supplied.typeId)); env.player.isSneaking = true;
  assert.equal(env.hooks.foodFromStack(env.player.container.getItem(0)).servingKind, 'drink');
  env.formResponses.push(0, () => {
    const { servingKind, ...asFood } = supplied;
    publish(env, asFood);
    return 0;
  });
  await env.hooks.boardForm(env.player, block);
  assert.deepEqual(station.menu, []); assert.match(env.player.messages.at(-1), /已改變/);
  assert.equal(env.player.container.getItem(0).amount, 1);
});

for (const packed of [false, true]) test(`cancelling ${packed ? 'a packed' : 'an accepted'} drink order keeps the existing no-refund terminal state`, async () => {
  const env = await mainFixture(); await drinkBoard(env, false);
  const order = newOrder(env), { counter, shelf } = counterFixture(env);
  env.player.container.setItem(0, new DrinkStack('kaleidoscope_tavern:wine_q6', order.items[0].amount, 3));
  if (packed) { env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order); pickup(env, counter, order); }
  const beforeInventory = structuredClone(env.player.container.slots), beforeSupplies = shelf.supplies;
  assert.equal(env.core.cancelOrder(env.restaurant, order.id).ok, true); env.store.saveRestaurant(env.restaurant);
  if (packed) {
    env.customer.setDynamicProperty('ordertocook:order_id', order.id);
    env.hooks.customerInteract(env.player, env.customer, { restaurantId: env.restaurant.id, orderId: order.id });
  } else env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'cancelled'); assert.equal(balance(env.player), 0);
  assert.deepEqual(structuredClone(env.player.container.slots), beforeInventory);
  assert.equal(shelf.supplies, beforeSupplies);
  assert.equal(env.core.cancelOrder(env.restaurant, order.id).reason, 'already_cancelled');
  assert.equal(env.restaurant.stats.failed, 1);
});

let reloadNumber = 0;
async function readSavedStore(properties) {
  const storeUrl = new URL('../runtime/BP/scripts/store.js', import.meta.url);
  const original = (await readFile(storeUrl, 'utf8')).replace(/from '(\.[^']+)'/g, (_match, path) => `from '${new URL(path, storeUrl).href}'`);
  const source = original.replace("import { world } from '@minecraft/server';", `
    const properties = new Map(${JSON.stringify([...properties])});
    const world = {
      writes: [], getDynamicPropertyIds: () => [...properties.keys()],
      getDynamicProperty: key => properties.get(key),
      setDynamicProperty(key, value) { this.writes.push([key, value]); if (value === undefined) properties.delete(key); else properties.set(key, value); }
    };
  `) + `\nexport { world as testWorld };\n// drink reload ${++reloadNumber}`;
  const store = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  store.initStore();
  return store;
}

test('fresh store initialization preserves zero-nutrition drink snapshots and legacy food through JSON reload', async () => {
  const env = await mainFixture(), { station } = await drinkBoard(env);
  const legacy = { typeId: 'minecraft:bread', nutrition: 5, label: '舊麵包' };
  station.menu.push(legacy); env.store.saveStation(station);
  env.hooks.syncMenu(env.restaurant); env.restaurant.orders = [];
  for (const status of ['accepted', 'packed', 'cancelled']) {
    const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
    assert.equal(env.core.acceptOrder(env.restaurant, order.id).ok, true);
    if (status === 'packed') assert.equal(env.core.packOrder(env.restaurant, order.id).ok, true);
    if (status === 'cancelled') assert.equal(env.core.cancelOrder(env.restaurant, order.id).ok, true);
    assert.equal(order.items.filter(item => item.servingKind === 'drink').length, 2);
  }
  env.store.saveRestaurant(env.restaurant);
  const expectedRestaurant = structuredClone(env.restaurant), expectedStation = structuredClone(station);
  const restored = await readSavedStore(env.properties);
  const restaurant = restored.getRestaurant(env.restaurant.id);
  const board = restored.stations().find(item => item.id === station.id);
  assert.deepEqual(restaurant, expectedRestaurant); assert.deepEqual(board, expectedStation);
  assert.deepEqual(env.core.normalizeMenu(board.menu), expectedStation.menu);
  assert.equal(env.core.getMenuNutrition(board.menu), 5);
  assert.deepEqual(board.menu.find(item => item.typeId === legacy.typeId), legacy);
  assert.equal(restored.testWorld.writes.length, 0, 'reload does not migrate or overwrite older menu data');
});
