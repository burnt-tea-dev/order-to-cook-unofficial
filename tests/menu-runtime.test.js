// SPDX-License-Identifier: GPL-3.0-only
// Tests the real board/order/countertop/customer paths with native IO doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, balance } from './main.harness.js';
import { FakeItem, place } from './appliances.harness.js';

class FoodStack extends FakeItem {
  constructor(variant, amount = 1) {
    super('test:meal', amount); this.nutrition = 7; this.nameTag = '原菜名';
    this.lore = [{ translate: 'senluo.public.food.v1', with: [JSON.stringify({
      v: 1, nativeVariant: variant, quality: 0, hotUntil: 1000, seasoning: []
    })] }];
  }
  getRawLore() { return structuredClone(this.lore); }
  getComponent(id) { return id === 'minecraft:food' ? { nutrition: this.nutrition } : super.getComponent(id); }
  clone() { const copy = new FoodStack(); Object.assign(copy, structuredClone(this)); return copy; }
}
function boardFixture(env) {
  const block = place(env, 'ordertocook:board', { x: 0, y: 0, z: 1 });
  const station = env.store.getStation(block); station.initialized = true; station.menu = []; env.store.saveStation(station);
  return { block, station };
}
function configureFood(env, nutrition, label) {
  for (const callback of env.system.afterEvents.scriptEventReceive.subscriptions) callback({
    id: 'ordertocook:food', sourceType: 'Server', message: JSON.stringify({ typeId: 'test:meal', nutrition, label })
  });
}

test('V1 metadata alone cannot admit a tool or invent a food nutrition value', async () => {
  const env = await mainFixture(), item = new FoodStack(7);
  for (const nutrition of [0, 0.5, NaN, Infinity]) {
    item.nutrition = nutrition; assert.equal(env.hooks.foodFromStack(item), undefined);
  }
  const tool = new FakeItem('test:tool'); tool.lore = item.lore;
  assert.equal(env.hooks.foodFromStack(tool), undefined);
});

test('held menu registration preserves the stack and counts one dish, not the held amount', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  const item = new FoodStack(7, 64); env.player.container.setItem(0, item);
  await env.hooks.boardForm(env.player, block);
  assert.equal(env.core.getMenuNutrition(station.menu), 7);
  assert.deepEqual(station.menu[0].foodIdentity, { carrier: 'senluo.public.food.v1', nativeVariant: 7 });
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(item));
});

test('inventory picker shows distinct same-ID variants and removes only the selected variant', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  env.player.container.setItem(0, new FoodStack(7)); env.player.container.setItem(1, new FoodStack(8));
  env.player.isSneaking = true;
  env.formResponses.push(0, (player, title, body, buttons) => {
    assert.equal(buttons.length, 2); assert.match(buttons[0], /變體 7/); assert.match(buttons[1], /變體 8/); return 0;
  });
  await env.hooks.boardForm(env.player, block);
  env.formResponses.push(0, 0); await env.hooks.boardForm(env.player, block);
  assert.deepEqual(station.menu.map(f => f.foodIdentity.nativeVariant), [7, 8]);
  env.formResponses.push(1, 0); await env.hooks.boardForm(env.player, block);
  assert.deepEqual(station.menu.map(f => f.foodIdentity.nativeVariant), [8]);
});

test('async menu selection rejects an item removed or swapped while the form was open', async () => {
  for (const replacement of [undefined, new FoodStack(8)]) {
    const env = await mainFixture(), { block, station } = boardFixture(env);
    env.player.container.setItem(0, new FoodStack(7)); env.player.isSneaking = true;
    env.formResponses.push(0, () => { env.player.container.setItem(0, replacement); return 0; });
    await env.hooks.boardForm(env.player, block);
    assert.deepEqual(station.menu, []);
    assert.match(env.player.messages.at(-1), /已改變/);
  }
});

test('nutrition and names remain snapshots across override changes; explicit remove/re-add updates them', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  configureFood(env, 7, '登記菜名'); env.player.container.setItem(0, new FoodStack(7));
  await env.hooks.boardForm(env.player, block); env.hooks.syncMenu(env.restaurant);
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
  env.core.acceptOrder(env.restaurant, order.id);
  const before = structuredClone(order);
  configureFood(env, 900, '新設定名稱'); env.hooks.syncMenu(env.restaurant);
  assert.equal(env.core.getMenuNutrition(env.restaurant), 7);
  assert.equal(env.restaurant.menu[0].label, '登記菜名'); assert.deepEqual(order, before);
  assert.match(env.hooks.orderBody(order), /登記菜名 · 變體 7/);
  assert.doesNotMatch(env.hooks.orderBody(order), /新設定名稱/);
  assert.match(env.hooks.parcelFor(env.restaurant, order).getLore().join('\n'), /登記菜名 · 變體 7/);
  env.core.removeMenuFood(station, 'test:meal', station.menu[0].foodIdentity);
  await env.hooks.boardForm(env.player, block); env.hooks.syncMenu(env.restaurant);
  assert.equal(env.core.getMenuNutrition(env.restaurant), 900);
  assert.equal(env.restaurant.menu[0].label, '新設定名稱'); assert.deepEqual(order, before);
});

test('async selection also rejects a changed nutrition registration instead of storing stale data', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  configureFood(env, 7, '登記菜名'); env.player.container.setItem(0, new FoodStack(7)); env.player.isSneaking = true;
  env.formResponses.push(0, () => { configureFood(env, 8, '更新菜名'); return 0; });
  await env.hooks.boardForm(env.player, block);
  assert.deepEqual(station.menu, []);
});

test('board -> order -> variant-matched cooking counter -> handoff pays once and leaves wrong variant intact', async () => {
  const env = await mainFixture(), { block, station } = boardFixture(env);
  env.player.container.setItem(0, new FoodStack(7)); await env.hooks.boardForm(env.player, block);
  env.hooks.syncMenu(env.restaurant); env.restaurant.orders = [];
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
  env.core.acceptOrder(env.restaurant, order.id); env.store.saveRestaurant(env.restaurant);
  const wrong = new FoodStack(8, 10); env.player.container.setItem(0, wrong);
  env.player.container.setItem(1, new FoodStack(7, order.items[0].amount));
  const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
  const shelf = env.store.getStation(place(env, 'ordertocook:plate_shelf', { x: 1, y: 0, z: 1 }));
  shelf.supplies = 3; env.store.saveStation(shelf);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'packed'); assert.equal(shelf.supplies, 2);
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(wrong));
  assert.equal(env.player.container.getItem(1), undefined);
  env.hooks.pickupDisplay(env.player, counter.above());
  const parcelSlot = env.player.container.slots.findIndex(s => s?.typeId === 'ordertocook:food_plate');
  assert.ok(parcelSlot >= 0); env.player.selectedSlotIndex = parcelSlot;
  const parcel = env.player.container.getItem(parcelSlot);
  assert.match(parcel.getLore().join('\n'), /原菜名 · 變體 7/);
  const linkage = { restaurantId: env.restaurant.id, orderId: order.id };
  env.customer.setDynamicProperty('ordertocook:order_id', order.id);
  env.hooks.customerInteract(env.player, env.customer, linkage, { rng: () => 0.999 });
  assert.equal(order.status, 'completed'); assert.equal(balance(env.player), order.paidReward);
  const paid = balance(env.player);
  const replaySlot = env.player.container.slots.findIndex(s => !s);
  env.player.container.setItem(replaySlot, parcel); env.player.selectedSlotIndex = replaySlot;
  env.hooks.customerInteract(env.player, env.customer, linkage);
  assert.equal(balance(env.player), paid); assert.equal(env.restaurant.stats.completed, 1);
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(wrong));
  assert.equal(station.menu[0].foodIdentity.nativeVariant, 7);
});

test('counter failure for the wrong variant preserves dishes, supplies and order state', async () => {
  const env = await mainFixture(), { block } = boardFixture(env);
  env.player.container.setItem(0, new FoodStack(7)); await env.hooks.boardForm(env.player, block);
  env.hooks.syncMenu(env.restaurant); env.restaurant.orders = [];
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
  env.core.acceptOrder(env.restaurant, order.id); env.store.saveRestaurant(env.restaurant);
  env.player.container.setItem(0, new FoodStack(8, 64));
  const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
  const shelf = env.store.getStation(place(env, 'ordertocook:plate_shelf', { x: 1, y: 0, z: 1 }));
  shelf.supplies = 3; env.store.saveStation(shelf);
  const before = structuredClone(env.player.container.slots);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, order);
  assert.equal(order.status, 'accepted'); assert.equal(shelf.supplies, 3); assert.equal(counter.above().isAir, true);
  assert.deepEqual(structuredClone(env.player.container.slots), before);
  assert.match(env.player.messages.at(-1), /變體 7/);
});
