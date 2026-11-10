// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestaurant, generateOrder, acceptOrder, packOrder } from '../runtime/BP/scripts/core.js';
import { entityServices, FakePlayer, makeEnvironment, place } from './appliances.harness.js';
import { mainFixture, balance } from './main.harness.js';

const wall = 1800000000000;
const ocean = { x: 50, y: 0, z: 50, dimensionId: 'minecraft:overworld', distance: 71 };
const land = { x: 0, y: 0, z: 50 };
const rolls = () => { let index = 0; return () => [0, 0.25][index++ % 2]; };

function terrain(env, kind = 'water') {
  env.dimension.heightRange = { min: -8, max: 16 };
  if (kind === 'water') {
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (x * x + z * z <= 4) {
      place(env, 'minecraft:stone', { x: ocean.x + x, y: -4, z: ocean.z + z });
      place(env, 'minecraft:water', { x: ocean.x + x, y: 2, z: ocean.z + z });
    }
  } else place(env, 'ordertocook:countertop', ocean);
  place(env, 'minecraft:stone', { ...land, y: -1 });
}

function fixture(kind = 'water') {
  const env = makeEnvironment();
  const restaurant = createRestaurant({ id: 'saved-delivery', dimensionId: env.dimension.id,
    location: { x: 0, y: 0, z: 0 }, config: { deliveryRate: 1, longDistanceDeliveryChance: 0 },
    menu: [{ typeId: 'minecraft:bread', nutrition: 5 }] }, wall);
  const time = () => ({ wall, tick: env.system.currentTick });
  const order = generateOrder(restaurant, time(), () => 0.9999);
  acceptOrder(restaurant, order.id, time()); packOrder(restaurant, order.id, time());
  Object.assign(order, { destination: { ...ocean }, proof: 'existing-physical-bag-proof' });
  env.restaurants.set(restaurant.id, restaurant);
  const player = new FakePlayer(env.dimension, { x: 50.5, y: 0, z: 50.5 });
  env.world.players.push(player);
  Object.assign(env.ctx, { orderTime: time, now: () => wall, random: rolls() });
  terrain(env, kind);
  return { ...env, restaurant, order, player };
}

function retry(env) {
  const service = entityServices.createEntityService(env.ctx), queued = env.system.callbacks.length;
  service.init(); env.system.callbacks[queued]();
  env.system.currentTick = 40; service.tick();
  return service;
}

for (const kind of ['water', 'blocked']) test(`existing ${kind} destination recovers through the bounded customer retry without replacing the order`, () => {
  const env = fixture(kind), before = structuredClone(env.order), sequence = env.restaurant.orderSequence;
  retry(env);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 1);
  assert.deepEqual(env.order.destination, { ...ocean, ...land });
  const unchanged = { ...env.order };
  for (const key of ['destination', 'customerEntityId', 'customerAnchor']) delete unchanged[key];
  const original = { ...before }; delete original.destination;
  assert.deepEqual(unchanged, original);
  assert.equal(env.restaurant.orderSequence, sequence);
  assert.equal(env.restaurant.orders.length, 1);
  assert.deepEqual(env.order.customerAnchor.location, { x: 0.5, y: 0, z: 50.5 });
});

test('unloaded address is unknown and never starts replacement sampling', () => {
  const env = fixture(), before = structuredClone(env.order);
  let draws = 0; env.ctx.random = () => { draws++; return 0; };
  env.dimension.getBlock = () => { throw Error('unloaded chunk'); };
  retry(env);
  assert.equal(draws, 0); assert.equal(env.dimension.spawnCount, 0);
  assert.deepEqual(env.order, before);
});

test('a saved customer anchor is retained when its current surface becomes unsafe', () => {
  const env = fixture();
  env.order.customerEntityId = 'saved-native-id';
  env.order.customerAnchor = { dimensionId: env.dimension.id, location: { x: 50.5, y: 0, z: 50.5 } };
  const before = structuredClone(env.order);
  let draws = 0; env.ctx.random = () => { draws++; return 0; };
  retry(env);
  assert.equal(draws, 0); assert.equal(env.dimension.spawnCount, 0);
  assert.deepEqual(env.order, before);
});

test('four failed replacement candidates retain the original work and use the existing retry cooldown', () => {
  const env = fixture(); place(env, 'minecraft:air', { ...land, y: -1 });
  let draws = 0; const random = rolls(); env.ctx.random = () => { draws++; return random(); };
  const before = structuredClone(env.order), service = retry(env);
  assert.equal(draws, 8); assert.equal(env.dimension.spawnCount, 0);
  env.system.currentTick = 60; service.tick();
  assert.equal(draws, 8, 'The original forty-tick cooldown still applies.');
  assert.deepEqual(env.order, before);
});

for (const failure of ['spawn', 'save']) test(`recovered destination ${failure} failure leaves the original order and no replacement actor`, () => {
  const env = fixture(), before = structuredClone(env.order);
  let attempts = 0;
  if (failure === 'spawn') env.dimension.spawnEntity = () => { attempts++; throw Error('native spawn unavailable'); };
  else env.ctx.saveRestaurant = () => { attempts++; throw Error('native save unavailable'); };
  retry(env);
  assert.equal(attempts, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(env.order)), before, 'The original persisted document is restored.');
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 0);
});

test('expired work cannot use destination repair to renew its deadline', () => {
  const env = fixture(); env.order.expiresTick = 40;
  const before = structuredClone(env.order);
  let draws = 0; env.ctx.random = () => { draws++; return 0; };
  retry(env);
  assert.equal(draws, 0); assert.equal(env.dimension.spawnCount, 0);
  assert.deepEqual(env.order, before);
});

async function heldBag() {
  const env = await mainFixture();
  for (const type of ['ordertocook:customer', 'ordertocook:seat']) {
    for (const actor of env.dimension.getEntities({ type })) actor.remove();
  }
  Object.assign(env.order, { type: 'delivery', carrier: 'bag', destination: { ...ocean }, expiresTick: 12000 });
  env.store.saveRestaurant(env.restaurant);
  const bag = env.hooks.parcelFor(env.restaurant, env.order);
  bag.nameTag = 'Original named parcel'; bag.keepOnDeath = true;
  bag.setDynamicProperty('other:untouched', 'original');
  bag.setLore(['Player prefix', ...bag.getLore(), '目的地 X:777 Z:888', 'Player suffix']);
  env.player.container.setItem(0, bag); env.player.location = { x: 50.5, y: 0, z: 50.5 };
  return env;
}

const useBag = (env, stack = env.player.container.getItem(0)) =>
  env.itemComponents.get('ordertocook:use').onUse({ source: env.player, itemStack: stack });

test('the same physical recovered bag lazily updates only its factory coordinate line and pays once through the real handoff owner', async () => {
  const env = await heldBag(); terrain(env);
  const before = env.player.container.getItem(0), proof = env.order.proof, deadline = env.order.expiresTick, reward = env.order.reward;
  const service = entityServices.createEntityService({ ...env.applianceContext, random: rolls() });
  Object.assign(env.hooks.entities, service);
  const queued = env.system.callbacks.length; service.init(); env.system.callbacks[queued]();
  env.system.currentTick = 40; service.tick();
  assert.deepEqual(env.order.destination, { ...ocean, ...land });
  assert.equal(env.order.proof, proof); assert.equal(env.order.expiresTick, deadline); assert.equal(env.order.reward, reward);
  let writes = 0; const set = env.player.container.setItem.bind(env.player.container);
  env.player.container.setItem = (...args) => { writes++; return set(...args); };
  useBag(env);
  const updated = env.player.container.getItem(0);
  const expected = before.clone(); expected.setLore(before.getLore().map(line => line === '目的地 X:50 Z:50' ? '目的地 X:0 Z:50' : line));
  assert.deepEqual(updated, expected);
  assert.equal(writes, 1);
  useBag(env); assert.equal(writes, 1, 'Current lore does not cause an unconditional native write.');
  const customer = env.dimension.getEntities({ type: 'ordertocook:customer' })[0];
  env.hooks.customerInteract(env.player, customer, env.linkage, { rng: () => 0.9999 });
  assert.equal(env.order.status, 'packed'); assert.equal(balance(env.player), 0, 'The courier must actually reach the repaired address.');
  env.player.location = { ...customer.location };
  env.hooks.customerInteract(env.player, customer, env.linkage, { rng: () => 0.9999 });
  assert.equal(env.order.status, 'completed'); assert.equal(balance(env.player), reward);
  const afterPayment = JSON.stringify(env.player.container.slots), paidWrites = writes;
  useBag(env, updated);
  env.hooks.customerInteract(env.player, customer, env.linkage, { rng: () => 0.9999 });
  assert.equal(balance(env.player), reward);
  assert.equal(writes, paidWrites, 'A late callback cannot rewrite the consumed bag over received coins.');
  assert.equal(JSON.stringify(env.player.container.slots), afterPayment);
});

test('unrecognized player lore is not treated as a factory coordinate line', async () => {
  const env = await heldBag();
  const bag = env.player.container.getItem(0); bag.setLore(['目的地 X:50 Z:50', 'Player text without factory instructions']);
  env.player.container.setItem(0, bag);
  env.order.destination = { ...ocean, ...land }; env.store.saveRestaurant(env.restaurant);
  let writes = 0; const set = env.player.container.setItem.bind(env.player.container);
  env.player.container.setItem = (...args) => { writes++; return set(...args); };
  useBag(env);
  assert.deepEqual(env.player.container.getItem(0), bag); assert.equal(writes, 0);
});
