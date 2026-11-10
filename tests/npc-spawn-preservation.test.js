// SPDX-License-Identifier: GPL-3.0-only
// Actual unchanged entity service with existing Minecraft doubles.
// Fail-before-commit injection only: NOT native persistence/cleanup atomicity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityServices, FakePlayer, makeEnvironment, place } from './appliances.harness.js';

function fixture(type = 'delivery', ground = true) {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  env.world.players.push(player); env.ctx.random = () => .5;
  const restaurant = { id: 'spawn-preservation', name: 'Spawn', dimensionId: env.dimension.id,
    location: { x: 0, y: 0, z: 0 }, orders: [] };
  const order = { id: 'spawn-order', restaurantId: restaurant.id, type, status: 'accepted',
    items: [{ typeId: 'minecraft:bread', amount: 1 }],
    destination: type === 'delivery' ? { x: 0, y: 0, z: 0, dimensionId: env.dimension.id, distance: 50 } : undefined,
    customerEntityId: 'missing-previous-actor',
    customerAnchor: { dimensionId: env.dimension.id, location: { x: 12.5, y: 0, z: .5 } } };
  restaurant.orders.push(order); env.restaurants.set(restaurant.id, restaurant);
  let chair;
  if (type === 'dine_in') {
    chair = place(env, 'ordertocook:chair', { x: 2, y: 0, z: 0 }); env.ctx.getStation(chair);
  } else if (ground) place(env, 'minecraft:stone', { x: 1, y: -1, z: 0 });
  return { ...env, player, restaurant, order, chair, service: entityServices.createEntityService(env.ctx) };
}

for (const type of ['dine_in', 'delivery']) test(`${type} rejected customer save restores association/address and releases resources for one retry`, () => {
  const env = fixture(type), previous = {
    id: env.order.customerEntityId, anchor: env.order.customerAnchor, destination: env.order.destination
  };
  let saves = 0, committed;
  env.ctx.saveRestaurant = restaurant => {
    assert.notEqual(env.order.customerEntityId, previous.id, 'inject after allocation/association, not before');
    if (++saves === 1) throw Error('injected customer save rejection before commit');
    committed = structuredClone(restaurant);
  };
  assert.equal(env.service.spawnCustomer(env.restaurant, env.order), undefined);
  assert.equal(env.order.customerEntityId, previous.id);
  assert.equal(env.order.customerAnchor, previous.anchor);
  assert.equal(env.order.destination, previous.destination);
  assert.equal(env.order.status, 'accepted'); assert.equal(env.restaurant.orders.length, 1);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 0);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
  assert.equal(committed, undefined);
  const customer = env.service.spawnCustomer(env.restaurant, env.order);
  assert.ok(customer); assert.equal(committed.orders[0].customerEntityId, customer.id);
  if (type === 'dine_in') assert.equal(env.service.getCustomerSeat(customer), env.chair, 'seat claim must be released');
  else {
    assert.equal(env.order.destination.x, 1);
    assert.equal(env.order.destination.distance, 50);
    assert.deepEqual(committed.orders[0].destination, env.order.destination);
  }
  assert.equal(env.service.spawnCustomer(env.restaurant, env.order), customer);
  assert.equal(saves, 2, 'duplicate retry must not allocate or save a second customer');
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 1);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, type === 'dine_in' ? 1 : 0);
});

test('no safe delivery point preserves the pending order and destination without allocating or saving', () => {
  const env = fixture('delivery', false), before = structuredClone(env.order);
  let saves = 0; env.ctx.saveRestaurant = () => { saves++; };
  assert.equal(env.service.spawnCustomer(env.restaurant, env.order), undefined);
  assert.deepEqual(env.order, before); assert.equal(env.restaurant.orders[0], env.order);
  assert.equal(env.dimension.spawnCount, 0); assert.equal(saves, 0);
});

test('current standing support rejects waterlogging even when the dry stone shape would pass', () => {
  const env = makeEnvironment(), floor = place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 0, z: 0 }), true);
  floor.isWaterlogged = true;
  let rays = 0; env.dimension.getBlockFromRay = () => { rays++; return undefined; };
  assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 0, z: 0 }), false);
  assert.equal(rays, 0);
});
