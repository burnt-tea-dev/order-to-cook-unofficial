// SPDX-License-Identifier: GPL-3.0-only
// Actual entity service with Minecraft IO doubles, not native-world acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { entityServices, FakePlayer, makeEnvironment, place } from './appliances.harness.js';

function fixture(offsets, { origin = { x: 0, y: 0, z: 0 }, roll = 0.99 } = {}) {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  player.location = { ...origin }; env.world.players.push(player);
  const restaurant = { id: 'normal-scan', name: 'Normal', dimensionId: env.dimension.id, location: origin, orders: [] };
  const order = { id: 'normal-1', restaurantId: restaurant.id, type: 'dine_in', status: 'accepted',
    items: [{ typeId: 'minecraft:bread', amount: 1 }], expiresAt: Date.now() + 600000 };
  restaurant.orders.push(order); env.restaurants.set(restaurant.id, restaurant); env.ctx.random = () => roll;
  const chairs = offsets.map(([x, y, z]) => {
    const block = place(env, 'ordertocook:chair', { x: origin.x + x, y: origin.y + y, z: origin.z + z });
    env.ctx.getStation(block); return block;
  });
  const service = entityServices.createEntityService(env.ctx);
  return { ...env, player, restaurant, order, chairs, service,
    spawn() { const customer = service.spawnCustomer(restaurant, order); assert.ok(customer); return service.getCustomerSeat(customer); } };
}

for (const [name, offsets] of [
  ['ascending x before distance', [[-20, 0, 0], [-1, 0, 0]]],
  ['ascending z before distance when x ties', [[0, 0, -20], [0, 0, -1]]],
  ['descending y when x and z tie', [[4, 8, 0], [4, 0, 0]]],
  ['x takes precedence over z', [[-20, 0, 12], [-5, 0, -1]]],
  ['z takes precedence over y', [[0, -8, -20], [0, 8, -2]]],
  ['both height edges use descending y', [[4, 8, 0], [4, -8, 0]]]
]) test(`normal diners use Java scan order: ${name}`, () => {
  const env = fixture(offsets); assert.equal(env.spawn(), env.chairs[0]);
});

for (const order of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
  test(`registered insertion order ${order.join(',')} cannot change normal chair selection`, () => {
    const positions = [[-20, 8, 0], [-20, 0, 0], [1, 0, 0]];
    const env = fixture(order.map(index => positions[index]));
    assert.equal(env.spawn(), env.chairs[order.indexOf(0)]);
  });
}

for (const roll of [0, 0.5, 0.999999]) test(`normal chair priority is independent of RNG ${roll}`, () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0], [-20, 0, 0]], { roll });
  assert.equal(env.spawn(), env.chairs[1]);
});

test('scan order is unchanged when the machine is translated across negative coordinates', () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0], [-20, 0, 0]], { origin: { x: -100, y: 30, z: -70 } });
  assert.equal(env.spawn(), env.chairs[1]);
});

for (const invalid of ['occupied', 'above', 'head', 'removed', 'unloaded', 'dimension', 'horizontal-range', 'vertical-range', 'type']) {
  test(`normal scan skips its first ${invalid} candidate and keeps the next eligible chair`, () => {
    const env = fixture([[-20, 8, 0], [2, 0, 0]]), bad = env.chairs[0];
    if (invalid === 'occupied') assert.equal(env.service.sitOnChair(env.player, bad), true);
    if (invalid === 'above') place(env, 'minecraft:stone', { ...bad.location, y: bad.location.y + 1 });
    if (invalid === 'head') place(env, 'minecraft:stone', { ...bad.location, y: bad.location.y + 2 });
    if (invalid === 'removed') bad.setType('minecraft:air');
    if (invalid === 'dimension') env.ctx.getStation(bad).dimensionId = 'minecraft:nether';
    if (invalid === 'horizontal-range') env.ctx.getStation(bad).location = { x: -24, y: 8, z: 1 };
    if (invalid === 'vertical-range') env.ctx.getStation(bad).location = { x: -20, y: 9, z: 0 };
    if (invalid === 'type') env.ctx.getStation(bad).typeId = 'ordertocook:board';
    if (invalid === 'unloaded') {
      const get = env.dimension.getBlock.bind(env.dimension);
      env.dimension.getBlock = location => { if (location.x === -20) throw Error('chunk unavailable'); return get(location); };
    }
    assert.equal(env.spawn(), env.chairs[1]);
  });
}

test('normal scan stops loaded-block validation after the first eligible chair', () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0], [10, 0, 0]]), get = env.dimension.getBlock.bind(env.dimension), reads = [];
  env.dimension.getBlock = location => { reads.push({ ...location }); return get(location); };
  assert.equal(env.spawn(), env.chairs[1]);
  assert.equal(reads.some(location => location.x === 2 || location.x === 10), false, 'later chairs must not incur block/headroom reads');
});

test('normal scan honors an in-flight claim before the first customer is queryable', () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0]]), spawn = env.dimension.spawnEntity.bind(env.dimension);
  const next = { ...env.order, id: 'normal-2' }; env.restaurant.orders.push(next);
  let reentered = false, second;
  env.dimension.spawnEntity = (type, location) => {
    if (type === 'ordertocook:customer' && !reentered) { reentered = true; second = env.service.spawnCustomer(env.restaurant, next); }
    return spawn(type, location);
  };
  const first = env.service.spawnCustomer(env.restaurant, env.order);
  assert.ok(first); assert.ok(second);
  assert.equal(env.service.getCustomerSeat(first), env.chairs[1]);
  assert.equal(env.service.getCustomerSeat(second), env.chairs[0]);
});

test('packed normal orders use the same scan order', () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0]]); env.order.status = 'packed';
  assert.equal(env.spawn(), env.chairs[1]);
});

test('an offered non-walk-in order remains ineligible to create a customer', () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0]]); env.order.status = 'offered';
  assert.equal(env.service.spawnCustomer(env.restaurant, env.order), undefined);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 0);
});

for (const dy of [1, 2]) test(`a first chair unloading during headroom read +${dy} defers to the next`, () => {
  const env = fixture([[-20, 8, 0], [2, 0, 0]]), get = env.dimension.getBlock.bind(env.dimension);
  env.dimension.getBlock = location => {
    if (location.x === -20 && location.y === 8 + dy) throw Error('headroom chunk unavailable');
    return get(location);
  };
  assert.equal(env.spawn(), env.chairs[1]);
});

test('a rejected spawn releases the normal scan chair claim for a later retry', () => {
  const env = fixture([[2, 0, 0], [-20, 8, 0]]), spawn = env.dimension.spawnEntity.bind(env.dimension);
  let rejected = false;
  env.dimension.spawnEntity = (type, location) => {
    if (type === 'ordertocook:customer' && !rejected) { rejected = true; throw Error('injected spawn rejection'); }
    return spawn(type, location);
  };
  assert.equal(env.service.spawnCustomer(env.restaurant, env.order), undefined);
  assert.equal(env.spawn(), env.chairs[1]);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 1);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 1);
});
