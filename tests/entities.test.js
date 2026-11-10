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

function readyService(env) {
  const service = entityServices.createEntityService(env.ctx);
  const queued = env.system.callbacks.length;
  service.init();
  env.system.callbacks[queued]();
  env.system.currentTick = 40;
  return service;
}

function tickAt(service, env, milliseconds) {
  env.ctx.now = () => milliseconds;
  env.system.currentTick += 20;
  service.tick();
}

// These values are inputs from the native entity properties. Native timer
// stepping itself is exercised by the isolated BDS test, not reimplemented here.
function nativePhase(entity, ticks, done = false) {
  entity.setProperty('ordertocook:reaction_tick', ticks);
  entity.setProperty('ordertocook:reaction_done', done);
  entity.setProperty('ordertocook:action_elapsed', ticks / 20);
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

test('creative-mode motorcycle placement keeps the colored item and deduplicates same-tick use', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = entityServices.createEntityService(env.ctx);
  player.getGameMode = () => 'Creative';
  for (let x = -3; x <= 3; x++) for (let z = 0; z <= 5; z++) place(env, 'minecraft:stone', { x, y: -1, z });
  const bikeItem = new FakeItem('ordertocook:motorcycle');
  bikeItem.setDynamicProperty('ordertocook:color', 3);
  player.container.setItem(0, bikeItem);
  service.onItemUse(player, bikeItem); service.onItemUse(player, bikeItem);
  const bikes = env.dimension.getEntities({ type: 'ordertocook:motorcycle' });
  assert.equal(bikes.length, 1);
  assert.equal(bikes[0].getProperty('ordertocook:color'), 3);
  assert.equal(player.container.getItem(0).amount, 1);
  assert.equal(player.container.getItem(0).getDynamicProperty('ordertocook:color'), 3);
});

test('motorcycle recoloring consumes dye in survival but not creative mode', () => {
  for (const [mode, expectedAmount] of [['Survival', 1], ['Creative', 2]]) {
    const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = entityServices.createEntityService(env.ctx);
    player.getGameMode = () => mode;
    const bike = env.dimension.spawnEntity('ordertocook:motorcycle', { x: 1.5, y: 0, z: 0.5 });
    const dye = new FakeItem('minecraft:red_dye', 2);
    player.container.setItem(0, dye);
    assert.equal(service.onEntityInteract(player, bike), true);
    assert.equal(bike.getProperty('ordertocook:color'), 1);
    assert.equal(player.container.getItem(0).amount, expectedAmount, mode);
  }
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

test('ordinary accepted dine-in orders retain the Java standing fallback within five blocks', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  fixture.chair.setType('minecraft:air');
  place(env, 'minecraft:stone', { x: 5, y: -1, z: 0 });
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.ok(customer);
  assert.deepEqual(customer.location, { x: 5.5, y: 0, z: 0.5 });
  assert.equal(customer.getProperty('ordertocook:stage'), 'waiting');
  assert.equal(customer.getProperty('ordertocook:action'), 2);
  assert.equal(customer.getComponent('minecraft:riding'), undefined);
});

for (const equipment of ['stove', 'countertop']) {
  test(`standing guests select nearby ground instead of the ${equipment} top`, () => {
    const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
    fixture.chair.setType('minecraft:air');
    place(env, `ordertocook:${equipment}`, { x: 0, y: 0, z: 0 });
    place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
    place(env, 'minecraft:stone', { x: 1, y: -1, z: 0 });
    assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 1, z: 0 }), true, 'The real equipment collision is a full top surface.');
    const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
    assert.deepEqual(customer.location, { x: 1.5, y: 0, z: 0.5 });
    assert.equal(fixture.order.status, 'accepted');
  });
}

test('equipment-only standing space leaves the order pending until safe ground is available', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  fixture.chair.setType('minecraft:air');
  place(env, 'ordertocook:stove', { x: 0, y: 0, z: 0 });
  const before = structuredClone(fixture.order);
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined);
  assert.deepEqual(fixture.order, before);
  assert.equal(env.dimension.spawnCount, 0);
  place(env, 'minecraft:stone', { x: 1, y: -1, z: 0 });
  assert.deepEqual(service.spawnCustomer(fixture.restaurant, fixture.order).location, { x: 1.5, y: 0, z: 0.5 });
  assert.equal(env.dimension.spawnCount, 1);
});

test('delivery guests also choose ground beside equipment and save that ground address', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  fixture.order.type = 'delivery';
  fixture.order.destination = { x: 0, y: 0, z: 0, dimensionId: env.dimension.id };
  place(env, 'ordertocook:countertop', { x: 0, y: 0, z: 0 });
  place(env, 'minecraft:stone', { x: 1, y: -1, z: 0 });
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.deepEqual(customer.location, { x: 1.5, y: 0, z: 0.5 });
  assert.equal(fixture.order.destination.y, 0);
});

for (const terrain of ['land', 'water', 'underwater_air', 'unloaded', 'blocked']) {
  test(`delivery surface resolution handles ${terrain} without inventing or moving an existing address`, () => {
    const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
    env.dimension.heightRange = { min: -8, max: 16 };
    fixture.order.type = 'delivery';
    fixture.order.proof = 'saved-proof';
    fixture.order.destination = { x: 0, y: 0, z: 0, dimensionId: env.dimension.id, distance: 0 };
    if (terrain === 'land') place(env, 'minecraft:stone', { x: 0, y: 3, z: 0 });
    else if (terrain === 'water' || terrain === 'underwater_air') {
      place(env, 'minecraft:stone', { x: 0, y: terrain === 'water' ? -4 : -1, z: 0 });
      place(env, 'minecraft:water', { x: 0, y: terrain === 'water' ? 2 : 4, z: 0 });
    } else if (terrain === 'unloaded') env.dimension.getBlock = () => { throw Error('chunk unloaded'); };
    else place(env, 'ordertocook:countertop', { x: 0, y: 0, z: 0 });
    const before = structuredClone(fixture.order.destination);
    const resolved = service.resolveDeliveryDestination(fixture.restaurant, fixture.order.destination);
    assert.equal(resolved.status, terrain === 'land' ? 'ready' : terrain === 'underwater_air' ? 'water' : terrain);
    assert.deepEqual(fixture.order.destination, before, 'resolution is read-only');
    const actor = service.spawnCustomer(fixture.restaurant, fixture.order);
    if (terrain === 'land') {
      assert.deepEqual(actor.location, { x: 0.5, y: 4, z: 0.5 });
      assert.equal(fixture.order.destination.y, 4);
    } else {
      assert.equal(actor, undefined); assert.equal(env.dimension.spawnCount, 0);
      assert.deepEqual(fixture.order.destination, before);
    }
    assert.equal(fixture.order.proof, 'saved-proof');
  });
}

test('a saved valid delivery retries its original anchor after reload and never rerolls an ocean address', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), firstService = entityServices.createEntityService(env.ctx);
  env.dimension.heightRange = { min: -8, max: 16 };
  fixture.order.type = 'delivery'; fixture.order.proof = 'proof-before-reload';
  fixture.order.destination = { x: 0, y: 0, z: 0, dimensionId: env.dimension.id, distance: 0 };
  place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  const first = firstService.spawnCustomer(fixture.restaurant, fixture.order);
  const anchor = structuredClone(fixture.order.customerAnchor), loaded = JSON.parse(JSON.stringify(fixture.restaurant));
  first.remove(); env.restaurants.set(loaded.id, loaded);
  const service = readyService(env);
  tickAt(service, env, Date.now() + 1000);
  const restored = env.dimension.getEntities({ type: 'ordertocook:customer' });
  assert.equal(restored.length, 1); assert.deepEqual(restored[0].location, anchor.location);
  assert.equal(loaded.orders[0].proof, 'proof-before-reload');
  service.cleanupOrder(loaded.orders[0].id);
  place(env, 'minecraft:water', { x: 0, y: 2, z: 0 });
  const before = structuredClone(loaded.orders[0]);
  tickAt(service, env, Date.now() + 2000); tickAt(service, env, Date.now() + 4000);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 0);
  assert.deepEqual(loaded.orders[0], before);
});

test('walk-in orders still require a chair despite an available standing floor', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env, 'offered', true), service = entityServices.createEntityService(env.ctx);
  fixture.chair.setType('minecraft:air');
  place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined);
  assert.equal(env.dimension.spawnCount, 0);
});

test('standing fallback rejects plants, thin floor slabs, liquids and missing support', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  fixture.chair.setType('minecraft:air');
  place(env, 'minecraft:short_grass', { x: 0, y: -1, z: 0 });
  place(env, 'minecraft:stone_slab', { x: 1, y: -1, z: 0 });
  place(env, 'minecraft:water', { x: -1, y: -1, z: 0 });
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined);
  place(env, 'minecraft:stone', { x: 4, y: -1, z: 0 });
  assert.deepEqual(service.spawnCustomer(fixture.restaurant, fixture.order).location, { x: 4.5, y: 0, z: 0.5 });
});

test('chair eligibility uses the original circular radius instead of a square corner', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env, 'offered', true), service = entityServices.createEntityService(env.ctx);
  fixture.chair.setType('minecraft:air');
  const corner = place(env, 'ordertocook:chair', { x: 20, y: 0, z: 20 }); env.ctx.getStation(corner);
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined);
  const edge = place(env, 'ordertocook:chair', { x: 24, y: 0, z: 0 }); env.ctx.getStation(edge);
  assert.ok(service.spawnCustomer(fixture.restaurant, fixture.order));
});

test('idle seed uses upstream weights and the server never changes a client clip mid-cycle', () => {
  assert.deepEqual([0, .549999, .55, .699999, .70, .849999, .85, .999999].map(entityServices.rollCustomerAnimationVariant), [1, 1, 2, 2, 3, 3, 4, 4]);
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const rolls = [0.1, 0.60, 0.80]; env.ctx.random = () => rolls.shift() ?? .9; env.ctx.now = () => start;
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.equal(customer.getProperty('ordertocook:animation_variant'), 1);
  assert.equal(customer.getProperty('ordertocook:action'), 1);
  tickAt(service, env, start + 550);
  assert.equal(customer.getProperty('ordertocook:action'), 1);
  nativePhase(customer, 12, true); tickAt(service, env, start + 600);
  assert.equal(customer.getProperty('ordertocook:action'), 0);
  tickAt(service, env, start + 5100);
  assert.equal(customer.getProperty('ordertocook:animation_variant'), 1);
  tickAt(service, env, start + 9600);
  assert.equal(customer.getProperty('ordertocook:animation_variant'), 1);
  assert.equal(rolls.length, 2, 'subsequent cycles are selected at the client clip boundary');
  assert.equal(customer.getProperty('ordertocook:action'), 0);
});

test('both explicit customer skins are preserved instead of rehashing the wide skin', () => {
  for (const variant of [0, 1]) {
    const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env);
    fixture.order.id = 'odd'; fixture.order.customerVariant = variant;
    const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
    assert.equal(customer.getProperty('ordertocook:variant'), variant);
  }
});

test('named special customer is red and reuses the saved identity on actor respawn', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env);
  Object.assign(fixture.order, { customerName: '微风(作者)', easterEgg: true, customerVariant: 0, skinAccount: 'Breezeth' });
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.match(customer.nameTag, /^§c微风\(作者\)§r\n/);
  service.cleanupOrder(fixture.order.id);
  const resumed = service.spawnCustomer(fixture.restaurant, fixture.order);
  assert.match(resumed.nameTag, /^§c微风\(作者\)§r\n/);
  assert.equal(resumed.getProperty('ordertocook:variant'), 0);
  assert.equal(fixture.order.skinAccount, 'Breezeth');
});

test('loaded reaction preserves native progress through wall-time jumps and service restart', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  env.ctx.now = () => start;
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + 5500, action: 6, clock: 'loaded' };
  service.finishCustomer(fixture.order.id, fixture.order.meal);
  nativePhase(customer, 80);
  tickAt(service, env, start + 60000);
  assert.equal(customer.getProperty('ordertocook:action_elapsed'), 4); assert.equal(customer.isValid, true);
  const events = customer.events.length, restarted = readyService(env);
  tickAt(restarted, env, start + 120000);
  assert.equal(customer.events.length, events); assert.equal(customer.getProperty('ordertocook:reaction_tick'), 80);
  assert.equal(restarted.interruptCustomerMeal(fixture.order.id, { startedAt: start + 120000, finishAt: start + 120500, clock: 'loaded' }), 1);
  assert.equal(customer.getProperty('ordertocook:action'), 7); assert.equal(customer.getProperty('ordertocook:reaction_tick'), 0);
});

test('each completion branch waits for native done, never wall time, and duplicate handoffs keep progress', () => {
  for (const [action, ticks] of [[3, 40], [4, 60], [5, 120], [6, 110]]) {
    const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
    const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
    fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + ticks * 50, action, clock: 'loaded' };
    service.finishCustomer(fixture.order.id, fixture.order.meal);
    nativePhase(customer, ticks - 1); tickAt(service, env, start + 60000);
    const events = customer.events.length;
    service.finishCustomer(fixture.order.id, fixture.order.meal);
    assert.equal(customer.isValid, true); assert.equal(customer.events.length, events);
    nativePhase(customer, ticks, true); tickAt(service, env, start + 60001);
    assert.equal(customer.isValid, false); assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
    assert.equal(env.dimension.drops.length, 0); assert.equal(fixture.player.container.emptySlotsCount, 36);
  }
});

test('native boom cues remain cosmetic and fire once at their counted phases', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + 6000, action: 5, clock: 'loaded' };
  service.finishCustomer(fixture.order.id, fixture.order.meal);
  nativePhase(customer, 100); tickAt(service, env, start + 50000);
  nativePhase(customer, 115); tickAt(service, env, start + 60000);
  assert.equal(env.dimension.sounds.filter(id => id === 'random.fuse').length, 1);
  assert.equal(env.dimension.sounds.filter(id => id === 'random.explode').length, 0);
  nativePhase(customer, 120, true); tickAt(service, env, start + 60001);
  assert.equal(env.dimension.sounds.filter(id => id === 'random.explode').length, 1);
  assert.equal(customer.isValid, false); assert.equal(fixture.chair.typeId, 'ordertocook:chair');
});

test('old timestamp-only completion adopts its saved phase once and then uses native ticks', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + 5500, action: 6 };
  tickAt(service, env, start + 4000);
  assert.equal(customer.getProperty('ordertocook:reaction_tick'), 80);
  tickAt(service, env, start + 100000);
  assert.equal(customer.getProperty('ordertocook:reaction_tick'), 80); assert.equal(customer.isValid, true);
  nativePhase(customer, 110, true); tickAt(service, env, start + 100001);
  assert.equal(customer.isValid, false); assert.equal(env.dimension.spawnCount, 2);
});

test('pending meal preserves a pruned order and a failed native finish can retry its payment', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.restaurant.pendingDishes = [{ id: fixture.order.id, startedAt: start, finishAt: start + 6000, action: 5, clock: 'loaded', status: 'dirty' }];
  fixture.restaurant.orders = [];
  tickAt(service, env, start + 60000);
  assert.equal(customer.getProperty('ordertocook:action'), 5); assert.equal(customer.isValid, true);
  nativePhase(customer, 120, true); env.ctx.onCustomerReactionFinished = () => false;
  tickAt(service, env, start + 60001); assert.equal(customer.isValid, true);
  env.ctx.onCustomerReactionFinished = () => true;
  tickAt(service, env, start + 60002); assert.equal(customer.isValid, false);
  assert.equal(fixture.restaurant.pendingDishes.length, 1);
});

test('another early pickup restarts the native ten-tick interruption without extending duplicate callbacks', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + 6000, action: 5, clock: 'loaded' };
  service.finishCustomer(fixture.order.id, fixture.order.meal);
  fixture.order.meal = { startedAt: start + 2000, finishAt: start + 2500, action: 7, clock: 'loaded' };
  service.interruptCustomerMeal(fixture.order.id, fixture.order.meal); nativePhase(customer, 8);
  fixture.order.meal = { startedAt: start + 2400, finishAt: start + 2900, action: 7, clock: 'loaded' };
  service.interruptCustomerMeal(fixture.order.id, fixture.order.meal);
  assert.equal(customer.getProperty('ordertocook:reaction_tick'), 0);
  nativePhase(customer, 9); tickAt(service, env, start + 90000); assert.equal(customer.isValid, true);
  nativePhase(customer, 10, true); tickAt(service, env, start + 90001); assert.equal(customer.isValid, false);
});

test('breaking a chair during eating preserves the canonical completion action and independent dish', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  env.ctx.now = () => start;
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order), previous = fixture.chair.permutation;
  fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + 5500, action: 6 };
  fixture.restaurant.pendingDishes = [{ id: fixture.order.id, status: 'eating' }];
  service.finishCustomer(fixture.order.id, fixture.order.meal);
  fixture.chair.setType('minecraft:air'); service.onBlockBreak(fixture.chair, env.ctx.getStation(fixture.chair), previous);
  assert.equal(customer.getProperty('ordertocook:action'), 6);
  assert.equal(customer.getProperty('ordertocook:stage'), 'eating');
  assert.equal(customer.getComponent('minecraft:riding'), undefined);
  assert.equal(service.getCustomerSeat(customer), undefined);
  nativePhase(customer, 110, true); tickAt(service, env, start + 5500);
  assert.equal(customer.isValid, false);
  assert.equal(fixture.restaurant.pendingDishes.length, 1);
});

test('orphaned seating restores only the nearby original chair and never jumps to another table', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  env.ctx.now = () => start;
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  let seat = customer.getComponent('minecraft:riding').entityRidingOn;
  seat.getComponent('minecraft:rideable').ejectRider(customer); seat.remove();
  tickAt(service, env, start + 1000);
  assert.equal(service.getCustomerSeat(customer), fixture.chair);
  seat = customer.getComponent('minecraft:riding').entityRidingOn;
  seat.getComponent('minecraft:rideable').ejectRider(customer); seat.remove();
  customer.location = { x: 20.5, y: 0, z: 0.5 };
  const other = place(env, 'ordertocook:chair', { x: 20, y: 0, z: 0 }); env.ctx.getStation(other);
  tickAt(service, env, start + 2000);
  assert.equal(customer.getComponent('minecraft:riding'), undefined);
  assert.deepEqual(customer.location, { x: 20.5, y: 0, z: 0.5 });
});

test('loaded duplicate cleanup keeps the persisted canonical actor regardless of query order', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const first = service.spawnCustomer(fixture.restaurant, fixture.order);
  const canonical = env.dimension.spawnEntity('ordertocook:customer', { x: 3.5, y: 0, z: .5 });
  canonical.setDynamicProperty('ordertocook:restaurant_id', fixture.restaurant.id);
  canonical.setDynamicProperty('ordertocook:order_id', fixture.order.id);
  fixture.order.customerEntityId = canonical.id;
  tickAt(service, env, start + 1000);
  assert.equal(first.isValid, false);
  assert.equal(canonical.isValid, true);
  assert.deepEqual(env.dimension.getEntities({ type: 'ordertocook:customer' }).map(entity => entity.id), [canonical.id]);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
});

test('a persisted customer anchor in an unloaded chunk postpones replacement spawning', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  service.spawnCustomer(fixture.restaurant, fixture.order); service.cleanupOrder(fixture.order.id);
  const getBlock = env.dimension.getBlock.bind(env.dimension);
  env.dimension.getBlock = location => {
    if (Math.floor(location.x) === 2 && Math.floor(location.y) === 1) throw Error('chunk unloaded');
    return getBlock(location);
  };
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined);
  assert.equal(env.dimension.spawnCount, 2);
  env.dimension.getBlock = getBlock;
  assert.ok(service.spawnCustomer(fixture.restaurant, fixture.order));
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 1);
});

test('out-of-range and cross-dimension customer callbacks never reach order submission', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  let called = 0; env.ctx.onCustomerInteract = () => { called++; };
  fixture.player.location = { x: 30, y: 0, z: 0 }; service.onEntityInteract(fixture.player, customer);
  fixture.player.location = { ...customer.location }; fixture.player.dimension = { ...env.dimension, id: 'minecraft:nether' };
  service.onEntityInteract(fixture.player, customer); assert.equal(called, 0);
  fixture.player.dimension = env.dimension; service.onEntityInteract(fixture.player, customer); assert.equal(called, 1);
});

test('bounded respawn retries rotate fairly across more than four blocked destinations', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now(), reads = Array(9).fill(0);
  fixture.restaurant.orders = reads.map((_, i) => {
    const order = { ...fixture.order, id: `remote${i}`, type: 'delivery' };
    Object.defineProperty(order, 'destination', { get() { reads[i]++; return { x: 2000 + i, y: 0, z: 0, dimensionId: env.dimension.id }; } });
    return order;
  });
  tickAt(service, env, start + 1000);
  assert.equal(reads.filter(Boolean).length, 4);
  tickAt(service, env, start + 2000);
  assert.equal(reads.filter(Boolean).length, 8);
  tickAt(service, env, start + 3000);
  assert.equal(reads.filter(Boolean).length, 9);
  assert.equal(env.dimension.spawnCount, 0);
});

test('delivery completion saved before NPC notification restores its original take action', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  fixture.order.type = 'delivery'; fixture.order.destination = { x: 0, y: 0, z: 0, dimensionId: env.dimension.id };
  place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 }); env.ctx.now = () => start;
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.order.status = 'completed'; fixture.order.completion = { startedAt: start, finishAt: start + 3000, action: 4 };
  tickAt(service, env, start + 1000);
  assert.equal(customer.getProperty('ordertocook:action'), 4);
  assert.equal(customer.getDynamicProperty('ordertocook:depart_at'), start + 3000);
  nativePhase(customer, 60, true); tickAt(service, env, start + 3000);
  assert.equal(customer.isValid, false);
});

test('a corrupt customer seat reference never removes a vehicle or its cargo', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  fixture.order.type = 'delivery'; fixture.order.destination = { x: 0, y: 0, z: 0, dimensionId: env.dimension.id };
  place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  const bike = env.dimension.spawnEntity('ordertocook:motorcycle', { x: 10, y: 0, z: 0 });
  bike.container.setItem(0, new FakeItem('minecraft:diamond', 64));
  customer.setDynamicProperty('ordertocook:seat_id', bike.id);
  service.cleanupOrder(fixture.order.id);
  assert.equal(customer.isValid, false);
  assert.equal(bike.isValid, true);
  assert.equal(bike.container.getItem(0).amount, 64);
});

test('failed seat metadata creation leaves neither orphan seat nor customer behind', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  const spawn = env.dimension.spawnEntity.bind(env.dimension);
  env.dimension.spawnEntity = (type, location) => {
    const entity = spawn(type, location);
    if (type === 'ordertocook:seat') entity.setDynamicProperty = () => { throw Error('metadata save unavailable'); };
    return entity;
  };
  assert.equal(service.spawnCustomer(fixture.restaurant, fixture.order), undefined);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:customer' }).length, 0);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
  assert.equal(fixture.order.customerEntityId, undefined);
});

test('standing support remains available when native sub-block rays return no hit', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = entityServices.createEntityService(env.ctx);
  fixture.chair.setType('minecraft:air'); place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  const raycast = env.dimension.getBlockFromRay.bind(env.dimension), calls = [];
  env.dimension.getBlockFromRay = (origin, direction, options) => {
    calls.push(options.maxDistance);
    return options.maxDistance < 1 ? undefined : raycast(origin, direction, options);
  };
  assert.ok(service.spawnCustomer(fixture.restaurant, fixture.order));
  assert.deepEqual(calls, [3, 3, 3, 3]);
});

test('native Up-face boundary normalized to y=0 is accepted like documented y=1', () => {
  const env = makeEnvironment(); place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  const raycast = env.dimension.getBlockFromRay.bind(env.dimension);
  env.dimension.getBlockFromRay = (origin, direction, options) => {
    const hit = raycast(origin, direction, options);
    if (hit) hit.faceLocation.y = 0;
    return hit;
  };
  assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 0, z: 0 }), true);
});

test('standing support validates the hit top and all four footprint corners', () => {
  const env = makeEnvironment(); place(env, 'minecraft:stone', { x: 0, y: -1, z: 0 });
  const raycast = env.dimension.getBlockFromRay.bind(env.dimension);
  env.dimension.getBlockFromRay = (origin, direction, options) => {
    const hit = raycast(origin, direction, options);
    if (hit && origin.x > .5 && origin.z > .5) hit.faceLocation.y = .5;
    return hit;
  };
  assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 0, z: 0 }), false);
  env.dimension.getBlockFromRay = (origin, direction, options) => {
    const hit = raycast(origin, direction, options);
    return hit ? { ...hit, block: env.dimension.getBlock({ x: 0, y: -2, z: 0 }) } : undefined;
  };
  assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 0, z: 0 }), false);
});

test('an upper-half slab is rejected even if a native ray hits its top at y=1', () => {
  const env = makeEnvironment(); const slab = place(env, 'minecraft:oak_slab', { x: 0, y: -1, z: 0 });
  env.dimension.getBlockFromRay = () => ({ block: slab, face: 'Up', faceLocation: { x: .5, y: 1, z: .5 } });
  assert.equal(entityServices.hasFullStandingSupport(env.dimension, { x: 0, y: 0, z: 0 }), false);
});

function chairClapFixture(configurePlayer = () => {}) {
  const env = makeEnvironment(), fixture = restaurantFixture(env), scheduled = [];
  configurePlayer(fixture.player);
  env.system.runTimeout = (fn, ticks) => scheduled.push({ fn, at: env.system.currentTick + ticks });
  const service = readyService(env);
  assert.equal(service.sitOnChair(fixture.player, fixture.chair), true);
  function step(ticks) {
    for (let i = 0; i < ticks; i++) {
      env.system.currentTick++;
      for (const task of scheduled.filter(task => task.at === env.system.currentTick)) task.fn();
      service.tick();
    }
  }
  const swing = (source = 'Attack') => {
    for (const fn of env.world.afterEvents.playerSwingStart.subscriptions) fn({ player: fixture.player, swingSource: source });
  };
  return { ...env, ...fixture, service, step, swing };
}

test('chair attack starts one three-second clap and sounds at original ticks 0, 12 and 20', () => {
  const env = chairClapFixture(), volumes = [];
  const playSound = env.dimension.playSound.bind(env.dimension);
  env.dimension.playSound = (id, location, options) => { volumes.push(options.volume); playSound(id, location, options); };
  env.swing();
  assert.deepEqual(env.player.animations.map(x => x.name), ['animation.ordertocook.player.chair_idle', 'animation.ordertocook.player.chair_clap', 'animation.ordertocook.player.chair_clap_first_person']);
  assert.equal(env.dimension.sounds.length, 1);
  env.swing(); env.swing('Mine'); env.swing('UseItem'); env.step(11);
  assert.equal(env.dimension.sounds.length, 1); assert.equal(env.player.animations.length, 3);
  env.step(1); assert.equal(env.dimension.sounds.length, 2);
  env.step(8); assert.equal(env.dimension.sounds.length, 3);
  assert.deepEqual(volumes, [1.08, 1.08, 1.08]);
  env.step(39); assert.equal(env.player.animations.length, 3);
  env.step(1); assert.equal(env.player.animations.at(-1).name, 'animation.ordertocook.player.chair_idle');
  assert.equal(env.player.animations[1].options.controller, env.player.animations[3].options.controller);
  assert.equal(env.player.animations[2].options.controller, env.player.animations[4].options.controller);
  assert.equal(env.player.animations[0].options.controller, env.player.animations[5].options.controller);
  env.swing(); assert.equal(env.player.animations.length, 8);
  assert.equal(env.dimension.sounds.length, 4);
  assert.equal(env.player.container.emptySlotsCount, 36); assert.equal(env.order.status, 'accepted');
});

test('clap consumes only own-chair melee and mining; other actions and mounts stay native', () => {
  const env = chairClapFixture();
  const hurt = { damageSource: { cause: 'entityAttack', damagingEntity: env.player }, cancel: false };
  const mining = { player: env.player, cancel: false };
  for (const fn of env.world.beforeEvents.entityHurt.subscriptions) fn(hurt);
  for (const fn of env.world.beforeEvents.playerBreakBlock.subscriptions) fn(mining);
  assert.equal(hurt.cancel, true); assert.equal(mining.cancel, true);
  for (const fn of [...env.system.callbacks].slice(1)) fn();
  assert.equal(env.player.animations.length, 3);
  for (const mount of [undefined, env.dimension.spawnEntity('ordertocook:motorcycle', env.player.location), env.dimension.spawnEntity('ordertocook:seat', env.player.location)]) {
    env.player.riding = mount; env.step(1);
    const before = env.player.animations.length;
    env.swing(); env.swing('Mine');
    const attack = { damageSource: { cause: 'entityAttack', damagingEntity: env.player }, cancel: false };
    const block = { player: env.player, cancel: false };
    for (const fn of env.world.beforeEvents.entityHurt.subscriptions) fn(attack);
    for (const fn of env.world.beforeEvents.playerBreakBlock.subscriptions) fn(block);
    assert.equal(attack.cancel, false); assert.equal(block.cancel, false);
    assert.equal(env.player.animations.length, before);
  }
  const other = chairClapFixture(); other.swing('UseItem'); other.swing('Interact'); other.swing('DropItem');
  assert.deepEqual(other.player.animations.map(row => row.name), ['animation.ordertocook.player.chair_idle']);
  const projectile = { damageSource: { cause: 'projectile', damagingEntity: other.player }, cancel: false };
  for (const fn of other.world.beforeEvents.entityHurt.subscriptions) fn(projectile);
  assert.equal(projectile.cancel, false);
});

test('dismount, chair change and leave stop clap and discard delayed voices', () => {
  for (const reason of ['dismount', 'chair', 'leave']) {
    const env = chairClapFixture(); env.swing(); env.step(5);
    if (reason === 'dismount') env.player.riding = undefined;
    if (reason === 'chair') {
      env.player.riding = undefined;
      const next = place(env, 'ordertocook:chair', { x: 4, y: 0, z: 0 });
      assert.equal(env.service.sitOnChair(env.player, next), true);
    }
    if (reason === 'leave') for (const fn of env.world.afterEvents.playerLeave.subscriptions) fn({ playerId: env.player.id });
    env.step(60);
    assert.equal(env.dimension.sounds.length, 1, reason);
    const expected = ['animation.ordertocook.player.chair_idle', 'animation.ordertocook.player.chair_clap', 'animation.ordertocook.player.chair_clap_first_person', 'animation.ordertocook.player.chair_clap_stop', 'animation.ordertocook.player.chair_clap_stop'];
    if (reason === 'chair') expected.push('animation.ordertocook.player.chair_idle');
    else expected.push('animation.ordertocook.player.chair_idle_stop');
    assert.deepEqual(env.player.animations.map(x => x.name), expected, reason);
  }
});

test('missing animation capability never changes seating, rewards or sound lifecycle', () => {
  const env = chairClapFixture(player => { player.playAnimation = () => { throw Error('animation unavailable'); }; });
  assert.doesNotThrow(() => env.swing()); env.step(60);
  assert.equal(env.dimension.sounds.length, 3);
  assert.equal(env.player.riding.typeId, 'ordertocook:seat');
  assert.equal(env.order.status, 'accepted'); assert.equal(env.player.container.emptySlotsCount, 36);
});

test('seated idle has an immediate native mount guard and stops once when ownership of the seat changes', () => {
  const env = chairClapFixture(), idle = env.player.animations[0];
  assert.equal(idle.name, 'animation.ordertocook.player.chair_idle');
  const stop = new Function('query', 'return ' + idle.options.stopExpression);
  assert.equal(stop({ is_riding_any_entity_of_type: (...types) => types.includes('ordertocook:seat') }), false);
  assert.equal(stop({ is_riding_any_entity_of_type: (...types) => types.includes('ordertocook:motorcycle') }), true);
  // The native type check alone cannot distinguish an unowned helper seat.
  // The real service still checks its existing chair tag/id and clears idle.
  env.player.riding = env.dimension.spawnEntity('ordertocook:seat', env.player.location);
  env.step(1);
  assert.equal(env.player.animations.at(-1).name, 'animation.ordertocook.player.chair_idle_stop');
  const after = env.player.animations.length; env.step(60);
  assert.equal(env.player.animations.length, after);
  assert.equal(env.dimension.sounds.length, 0); assert.equal(env.order.status, 'accepted');
});

test('script reload and player spawn restore the chair idle without repeating requests on later ticks', () => {
  const env = chairClapFixture(), before = env.player.animations.length;
  const restored = readyService(env);
  assert.equal(env.player.animations.length, before + 1);
  for (let tick = 0; tick < 20; tick++) { env.system.currentTick++; restored.tick(); }
  assert.equal(env.player.animations.length, before + 1);
  const leave = env.world.afterEvents.playerLeave.subscriptions.at(-1);
  leave({ playerId: env.player.id });
  const count = env.player.animations.length;
  const spawn = env.world.afterEvents.playerSpawn.subscriptions.at(-1);
  const queued = env.system.callbacks.length;
  spawn({ player: env.player }); env.system.callbacks[queued]();
  assert.equal(env.player.animations.length, count + 1);
  assert.equal(env.player.animations.at(-1).name, 'animation.ordertocook.player.chair_idle');
  const queuedAgain = env.system.callbacks.length;
  spawn({ player: env.player }); env.system.callbacks[queuedAgain]();
  assert.equal(env.player.animations.length, count + 1);
});

test('held items do not prevent the existing chair clap or change its sound/session lifecycle', () => {
  const env = chairClapFixture(), held = new FakeItem('minecraft:stick', 3);
  held.nameTag = '仍在手中的物品'; env.player.container.setItem(0, held);
  env.swing();
  assert.deepEqual(env.player.animations.map(row => row.name), ['animation.ordertocook.player.chair_idle', 'animation.ordertocook.player.chair_clap', 'animation.ordertocook.player.chair_clap_first_person']);
  env.step(60);
  assert.equal(env.dimension.sounds.length, 3);
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(held));
  assert.equal(env.order.status, 'accepted');
});

 test('the old native done flag cannot finish a new action in its property-update tick', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.order.status = 'completed'; fixture.order.meal = { startedAt: start, finishAt: start + 6000, action: 5, clock: 'loaded' };
  service.finishCustomer(fixture.order.id, fixture.order.meal);
  customer.setProperty('ordertocook:reaction_done', true);
  service.tick(); assert.equal(customer.isValid, true);
  customer.setProperty('ordertocook:reaction_done', false);
  tickAt(service, env, start + 60000); assert.equal(customer.isValid, true);
});

 test('alpha.1 departure-only actor adopts generic eating even after order history was pruned', () => {
  const env = makeEnvironment(), fixture = restaurantFixture(env), service = readyService(env), start = Date.now();
  const customer = service.spawnCustomer(fixture.restaurant, fixture.order);
  fixture.restaurant.orders = [];
  customer.setDynamicProperty('ordertocook:reaction_action', undefined);
  customer.setDynamicProperty('ordertocook:action_started_at', undefined);
  customer.setDynamicProperty('ordertocook:depart_at', start + 5500);
  customer.setProperty('ordertocook:action', 0);
  tickAt(service, env, start + 2000);
  assert.equal(customer.getProperty('ordertocook:action'), 6);
  assert.equal(customer.getProperty('ordertocook:reaction_tick'), 40);
  nativePhase(customer, 110, true); tickAt(service, env, start + 60000);
  assert.equal(customer.isValid, false);
});
