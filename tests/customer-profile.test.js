// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerProfile, createRestaurant, generateOrder, generateWalkInOrder, acceptOrder, packOrder } from '../runtime/BP/scripts/core.js';
import { mainFixture, balance } from './main.harness.js';

function rolls(...values) { let index = 0; return () => values[index++] ?? 0.9999; }

test('Java default 10% profile boundary selects original named customers with their stable identity', () => {
  assert.deepEqual(createCustomerProfile(undefined, rolls(0.099999, 0)), {
    customerName: '微风(作者)', customerVariant: 0, skinAccount: 'Breezeth',
    skinUuid: 'a1b3e264-652b-42db-b8e7-5393b409776b', easterEgg: true
  });
  const last = createCustomerProfile(undefined, rolls(0, 0.99999));
  assert.equal(last.skinAccount, 'zsdr'); assert.equal(last.customerName, 'N44(美术)');
  assert.equal(createCustomerProfile(undefined, rolls(0.1, 0, 0)).easterEgg, false);
  assert.equal(createCustomerProfile({ easterEggCustomerRate: 10 }, rolls(0.0999, 0)).easterEgg, true);
});

test('ordinary profiles use original names, Java gender boundary and locale without being marked special', () => {
  const slim = createCustomerProfile({ easterEggCustomerRate: 0 }, rolls(0, 0.49999, 0));
  assert.equal(slim.customerName, '艾草'); assert.equal(slim.customerVariant, 1);
  assert.equal(slim.easterEgg, false); assert.equal(slim.skinUuid, '');
  const wide = createCustomerProfile({ easterEggCustomerRate: 0, namesLanguage: 'EN_US' }, rolls(0, 0.5, 0));
  assert.equal(wide.customerName, 'Aloe'); assert.equal(wide.customerVariant, 0);
  assert.equal(wide.easterEgg, false); assert.equal(wide.skinAccount, '');
});

test('machine and walk-in offers retain their selected profile through acceptance, packing and store reload', async () => {
  for (const generate of [generateOrder, generateWalkInOrder]) {
    const env = await mainFixture();
    env.restaurant.config.easterEggCustomerRate = 1;
    const order = generate(env.restaurant, Date.now(), () => 0);
    assert.equal(order.easterEgg, true); assert.equal(order.customerName, '微风(作者)');
    const profile = { name: order.customerName, account: order.skinAccount, uuid: order.skinUuid, variant: order.customerVariant, easterEgg: order.easterEgg };
    assert.equal(acceptOrder(env.restaurant, order.id).ok, true);
    assert.equal(packOrder(env.restaurant, order.id).ok, true);
    env.store.saveRestaurant(env.restaurant);
    const resumed = await mainFixture(env.properties);
    const restored = resumed.store.getRestaurant(env.restaurant.id).orders.find(row => row.id === order.id);
    assert.deepEqual({ name: restored.customerName, account: restored.skinAccount, uuid: restored.skinUuid, variant: restored.customerVariant, easterEgg: restored.easterEgg }, profile);
  }
});

test('production handoff reads the persisted special flag, pays the Java tip and 60% seated branch once', async () => {
  for (const [special, reaction, expectedTip, expectedBonus] of [[true, 0.59999, 1, 1], [true, 0.6, 1, 0], [false, 0.59999, 0, 0]]) {
    const env = await mainFixture();
    Object.assign(env.order, createCustomerProfile({ easterEggCustomerRate: special ? 1 : 0 }, rolls(0, 0, 0)));
    env.store.saveRestaurant(env.restaurant);
    const base = env.order.reward;
    // Tip-chance, special tip amount, completion reaction, boom amount.
    const rng = special ? rolls(0.5, 0, reaction, 0) : rolls(0.5, reaction, 0);
    env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng });
    assert.equal(env.order.tip, expectedTip);
    assert.equal(env.order.completion.boomBonus, expectedBonus);
    assert.equal(balance(env.player), base + expectedTip + expectedBonus);
    const paid = balance(env.player);
    env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0 });
    assert.equal(balance(env.player), paid);
    assert.equal(env.restaurant.stats.completed, 1);
  }
});
