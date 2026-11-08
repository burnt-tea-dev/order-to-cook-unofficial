// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, itemCount } from './main.harness.js';
import { FakeItem, place } from './appliances.harness.js';

function registeredBagTick(env) {
  const components = new Map();
  for (const start of env.system.beforeEvents.startup.subscriptions) start({
    blockComponentRegistry: { registerCustomComponent: (id, component) => components.set(id, component) },
    itemComponentRegistry: { registerCustomComponent() {} }
  });
  assert.equal(components.get('ordertocook:interact').onTick, undefined);
  assert.equal(typeof components.get('ordertocook:bag_motion').onTick, 'function');
  return block => components.get('ordertocook:bag_motion').onTick({ block });
}

test('placed delivery bag plays ten source ticks once and preserves its physical proof', async () => {
  const env = await mainFixture(), tick = registeredBagTick(env);
  env.order.type = 'delivery'; env.order.carrier = 'bag'; env.store.saveRestaurant(env.restaurant);
  const parcel = env.hooks.parcelFor(env.restaurant, env.order);
  env.player.container.setItem(0, parcel); env.player.isSneaking = true;
  const table = place(env, 'minecraft:stone', { x: 1, y: 0, z: 2 });
  env.hooks.placeParcel(env.player, table, 'Up');
  const bag = table.above(), proof = env.store.findStation(bag).proof;
  assert.equal(itemCount(env.player, 'ordertocook:takeout_bag'), 0);
  assert.equal(proof, env.order.proof);
  for (let frame = 1; frame <= 10; frame++) {
    assert.equal(bag.permutation.getState('ordertocook:frame'), frame);
    env.system.currentTick++; tick(bag);
  }
  assert.equal(bag.permutation.getState('ordertocook:frame'), 0);
  tick(bag);
  assert.equal(bag.permutation.getState('ordertocook:frame'), 0);
  assert.equal(env.order.status, 'packed');
  env.hooks.pickupDisplay(env.player, bag);
  assert.equal(bag.typeId, 'minecraft:air');
  assert.equal(itemCount(env.player, 'ordertocook:takeout_bag'), 1);
  assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:proof'), proof);
  tick(bag); // A queued native callback after pickup cannot recreate a bag.
  assert.equal(bag.typeId, 'minecraft:air');

  // A saved mid-animation permutation needs no transient marker or new store
  // record: the native tick callback advances its remaining frames to rest.
  const restored = place(env, 'ordertocook:takeout_bag', { x: 4, y: 1, z: 0 }, { 'ordertocook:frame': 7 });
  const savedProperties = [...env.properties];
  for (let i = 0; i < 4; i++) tick(restored);
  assert.equal(restored.permutation.getState('ordertocook:frame'), 0);
  tick(restored);
  assert.equal(restored.permutation.getState('ordertocook:frame'), 0);
  assert.deepEqual([...env.properties], savedProperties);
});

test('countertop delivery output starts the same bag animation after the transaction commits', async () => {
  const env = await mainFixture();
  env.order.type = 'delivery'; env.order.carrier = 'bag'; env.order.status = 'accepted';
  env.order.items = [{ typeId: 'minecraft:bread', amount: 1 }];
  env.store.saveRestaurant(env.restaurant);
  env.player.container.setItem(0, new FakeItem('minecraft:bread'));
  const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 2 });
  const shelf = place(env, 'ordertocook:shelf', { x: 1, y: 0, z: 3 });
  const supply = env.store.getStation(shelf); supply.supplies = 1; env.store.saveStation(supply);
  env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, env.order);
  const bag = counter.above();
  assert.equal(bag.typeId, 'ordertocook:takeout_bag');
  assert.equal(bag.permutation.getState('ordertocook:frame'), 1);
  assert.equal(env.order.status, 'packed');
  assert.equal(itemCount(env.player, 'minecraft:bread'), 0);
  assert.equal(supply.supplies, 0);
  assert.equal(env.store.findStation(bag).proof, env.order.proof);
  env.hooks.pickupDisplay(env.player, bag);
  assert.equal(itemCount(env.player, 'ordertocook:takeout_bag'), 1);
  assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:proof'), env.order.proof);
});
