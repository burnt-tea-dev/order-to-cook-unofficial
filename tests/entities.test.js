// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityServices, FakeItem, FakePlayer, makeEnvironment, place } from './appliances.harness.js';

function restaurantFixture(env, status = 'accepted', walkIn = false) {
  const chair = place(env, 'ordertocook:chair', { x: 2, y: 0, z: 0 }); env.ctx.getStation(chair);
  const order = { id: 'r1-order1', restaurantId: 'r1', type: 'dine_in', status, walkIn, items: [{ typeId: 'minecraft:bread', amount: 1 }], expiresAt: Date.now() + 600000 };
  const restaurant = { id: 'r1', name: '測試餐廳', dimensionId: env.dimension.id, location: { x: 0, y: 0, z: 0 }, orders: [order] };
  env.restaurants.set(restaurant.id, restaurant); const player = new FakePlayer(env.dimension); env.world.players.push(player);
  return { chair, order, restaurant, player };
}

test('offered walk-in creates a seated NPC before the player accepts it', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env, 'offered', true); const service = entityServices.createEntityService(env.ctx);
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.ok(customer); assert.equal(customer.getProperty('ordertocook:stage'), 'seated'); assert.equal(customer.getDynamicProperty('ordertocook:order_id'), fixture.order.id);
  assert.equal(customer.getComponent('minecraft:riding').entityRidingOn.typeId, 'ordertocook:seat');
});

test('ordinary unaccepted machine offers do not create customers', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env, 'offered', false); const service = entityServices.createEntityService(env.ctx);
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined); assert.equal(env.dimension.spawnCount, 0);
});

test('one order remains one NPC when spawn is retried', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env); const service = entityServices.createEntityService(env.ctx);
  const first = service.spawnCustomer(fixture.restaurant, fixture.order), second = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.equal(first.id, second.id); assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 1);
});

test('faraway delivery does not spawn or force-load its destination', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env); const service = entityServices.createEntityService(env.ctx);
  fixture.order.type = 'delivery'; fixture.order.destination = { x: 2000, y: 0, z: 0, dimensionId: env.dimension.id };
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined); assert.equal(env.dimension.spawnCount, 0);
});

test('finishing a customer starts the full eating animation and creates no rewards or plates', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env); const service = entityServices.createEntityService(env.ctx);
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order), before = Date.now(); service.finishCustomer(fixture.order.id);
  assert.equal(customer.getProperty('ordertocook:stage'), 'eating'); assert.ok(customer.getDynamicProperty('ordertocook:depart_at') >= before + 5500);
  const departure = customer.getDynamicProperty('ordertocook:depart_at'); service.finishCustomer(fixture.order.id);
  assert.equal(customer.getDynamicProperty('ordertocook:depart_at'), departure); assert.equal(env.dimension.drops.length, 0); assert.equal(fixture.player.container.emptySlotsCount, 36);
});

test('motorcycle custom-item duplicate callback consumes and spawns exactly once', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension); const service = entityServices.createEntityService(env.ctx);
  for (let x = -3; x <= 3; x++) for (let z = 0; z <= 5; z++) place(env, 'minecraft:stone', { x, y: -1, z });
  const bikeItem = new FakeItem('ordertocook:motorcycle'); bikeItem.setDynamicProperty('ordertocook:color', 2); player.container.setItem(0, bikeItem);
  service.onItemUse(player, bikeItem); service.onItemUse(player, bikeItem);
  const bikes = env.dimension.getEntities({ type: 'ordertocook:motorcycle' }); assert.equal(bikes.length, 1); assert.equal(player.container.getItem(0), undefined);
  assert.equal(bikes[0].getProperty('ordertocook:color'), 2); assert.equal(bikes[0].container.size, 54);
});

test('order cleanup removes its NPC and empty chair helper together', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env); const service = entityServices.createEntityService(env.ctx);
  service.spawnCustomer(fixture.restaurant, fixture.order); service.cleanupOrder(fixture.order.id);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 0); assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
});

test('entity init uses scheduled startup after the already-fired worldLoad', () => {
  const env = makeEnvironment(), service = entityServices.createEntityService(env.ctx); service.init();
  assert.equal(env.world.afterEvents.worldLoad.subscriptions.length, 0); for (const callback of env.system.callbacks) callback();
  assert.equal(env.system.intervals.length, 1); assert.equal(env.system.intervals[0].ticks, 5);
});

test('deferred customer retry runs with a nonzero five-tick interval offset', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env); const service = entityServices.createEntityService(env.ctx);
  service.init(); env.system.currentTick = 2; for (const callback of [...env.system.callbacks]) callback();
  for (let tick = 7; tick <= 67; tick += 5) { env.system.currentTick = tick; service.tick(); }
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 1);
});
