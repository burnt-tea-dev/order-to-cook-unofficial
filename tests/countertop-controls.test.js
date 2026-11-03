// SPDX-License-Identifier: GPL-3.0-only
// Exercises the shipped countertop entry and transaction with native IO doubles.
// These checks do not establish native client input or GUI rendering behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, itemCount } from './main.harness.js';
import { FakeItem, FakePlayer, place } from './appliances.harness.js';

function acceptedOrder(env, restaurant = env.restaurant, typeId = 'minecraft:bread', label = '麵包') {
  const order = env.core.generateOrder(restaurant, Date.now(), () => 0.9999);
  env.core.acceptOrder(restaurant, order.id);
  order.items = [{ typeId, label, nutrition: 5, amount: 2 }];
  env.store.saveRestaurant(restaurant);
  return order;
}

async function countertopFixture() {
  const env = await mainFixture();
  env.restaurant.orders = [];
  const order = acceptedOrder(env);
  const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
  const shelf = env.store.getStation(place(env, 'ordertocook:plate_shelf', { x: 1, y: 0, z: 1 }));
  shelf.supplies = 3;
  env.store.saveStation(shelf);
  env.player.container.setItem(0, undefined);
  const food = new FakeItem('minecraft:bread', 5);
  food.nameTag = '保留名稱的麵包';
  food.setLore(['原食品資料']);
  food.setDynamicProperty('test:batch', 'batch-7');
  env.player.container.setItem(1, food);
  return { ...env, order, counter, shelf, food };
}

function inventorySnapshot(player) {
  return Array.from({ length: player.container.size }, (_, slot) =>
    structuredClone(player.container.getItem(slot)));
}

function assertStockUnchanged(env, before) {
  assert.deepEqual(inventorySnapshot(env.player), before);
  assert.equal(env.shelf.supplies, 3);
  assert.equal(env.counter.above().isAir, true);
}

test('held accepted order prepares that order directly and preserves remaining food metadata', async () => {
  const env = await countertopFixture();
  env.player.container.setItem(0, env.hooks.parcelFor(env.restaurant, env.order, 'ordertocook:order'));
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.forms.length, 0);
  assert.equal(env.order.status, 'packed');
  assert.equal(env.shelf.supplies, 2);
  assert.equal(env.player.container.getItem(0), undefined);
  const expected = env.food.clone();
  expected.amount = 3;
  assert.deepEqual(structuredClone(env.player.container.getItem(1)), structuredClone(expected));
  assert.equal(env.counter.above().typeId, 'ordertocook:food_plate_display');
});

test('invalid held tickets never fall back to another accepted order', async t => {
  const scenarios = [
    ['missing linkage', (env, ticket) => {
      ticket.setDynamicProperty('ordertocook:restaurant', undefined);
      ticket.setDynamicProperty('ordertocook:order_id', undefined);
    }],
    ['unknown order', (env, ticket) => ticket.setDynamicProperty('ordertocook:order_id', 'absent-order')],
    ['mismatched proof', (env, ticket) => ticket.setDynamicProperty('ordertocook:proof', 'forged-proof')],
    ['other restaurant', (env, ticket) => {
      const machine = place(env, 'ordertocook:order_machine', { x: 12, y: 0, z: 0 });
      const restaurant = env.hooks.getMachine(env.player, machine);
      restaurant.menu = [{ typeId: 'minecraft:bread', label: '麵包', nutrition: 5 }];
      const order = acceptedOrder(env, restaurant);
      ticket.setDynamicProperty('ordertocook:restaurant', restaurant.id);
      ticket.setDynamicProperty('ordertocook:order_id', order.id);
    }],
    ['expired order', env => { env.order.expiresAt = Date.now() - 1000; env.store.saveRestaurant(env.restaurant); }],
    ['already completed order', env => { env.order.status = 'completed'; env.store.saveRestaurant(env.restaurant); }],
  ];
  for (const [name, invalidate] of scenarios) {
    await t.test(name, async () => {
      const env = await countertopFixture();
      const alternative = acceptedOrder(env);
      const ticket = env.hooks.parcelFor(env.restaurant, env.order, 'ordertocook:order');
      invalidate(env, ticket);
      env.player.container.setItem(0, ticket);
      const before = inventorySnapshot(env.player);
      // If the invalid-ticket path incorrectly opens a picker, this response
      // would prepare a different order and make the failure visible.
      env.formResponses.push(0);
      await env.hooks.countertopForm(env.player, env.counter);
      assert.equal(env.forms.length, 0);
      assert.equal(alternative.status, 'accepted');
      assertStockUnchanged(env, before);
    });
  }
});

test('empty-hand picker shows ready and missing-food status in one page; cancel consumes nothing', async () => {
  const env = await countertopFixture();
  const missing = acceptedOrder(env, env.restaurant, 'minecraft:apple', '蘋果');
  const before = inventorySnapshot(env.player);
  env.formResponses.push((player, title, body, buttons) => {
    assert.equal(buttons.length, 2);
    assert.match(buttons[0], /可製作/);
    assert.match(buttons[1], /缺|不足/);
    assert.match(buttons[1], /蘋果|minecraft:apple/);
    return undefined;
  });
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.forms.length, 1);
  assert.equal(env.order.status, 'accepted');
  assert.equal(missing.status, 'accepted');
  assertStockUnchanged(env, before);
});

test('a single empty-hand order still requires an explicit selection and has no nested confirmation', async () => {
  const env = await countertopFixture();
  env.formResponses.push(0);
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.forms.length, 1);
  assert.equal(env.forms[0][3].length, 1);
  assert.equal(env.order.status, 'packed');
  assert.equal(itemCount(env.player, 'minecraft:bread'), 3);
  assert.equal(env.shelf.supplies, 2);
});

test('a picker opened before permission revocation cannot consume food or a plate', async () => {
  const env = await countertopFixture();
  const before = inventorySnapshot(env.player);
  env.formResponses.push(() => {
    env.restaurant.ownerId = 'new-owner';
    env.restaurant.staff = [];
    env.store.saveRestaurant(env.restaurant);
    return 0;
  });
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.order.status, 'accepted');
  assertStockUnchanged(env, before);
});

test('removing the countertop while its picker is open leaves food and supplies unchanged', async () => {
  const env = await countertopFixture();
  const before = inventorySnapshot(env.player);
  env.formResponses.push(() => { env.counter.setType('minecraft:air'); return 0; });
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.order.status, 'accepted');
  assertStockUnchanged(env, before);
});

test('a stale picker cannot prepare an order that another player has already made and collected', async () => {
  const env = await countertopFixture();
  const second = new FakePlayer(env.dimension, { x: 1.5, y: 0, z: 1.5 });
  second.getGameMode = () => 'Survival';
  second.container.setItem(1, env.food);
  env.restaurant.staff.push(second.id);
  env.store.saveRestaurant(env.restaurant);
  env.world.players.push(second);
  let resolveFirst;
  env.formResponses.push(() => new Promise(resolve => { resolveFirst = resolve; }), 0);
  const first = env.hooks.countertopForm(env.player, env.counter);
  assert.equal(typeof resolveFirst, 'function');
  await env.hooks.countertopForm(second, env.counter);
  assert.equal(env.order.status, 'packed');
  env.hooks.pickupDisplay(second, env.counter.above());
  assert.equal(env.counter.above().isAir, true);
  const secondAfter = inventorySnapshot(second);
  resolveFirst(0);
  await first;
  assert.equal(env.forms.length, 2);
  assert.equal(itemCount(env.player, 'minecraft:bread'), 5);
  assert.equal(itemCount(second, 'minecraft:bread'), 3);
  assert.equal(env.shelf.supplies, 2);
  assert.deepEqual(inventorySnapshot(second), secondAfter);
  assert.equal(env.counter.above().isAir, true);
});
