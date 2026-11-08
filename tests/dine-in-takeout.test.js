// SPDX-License-Identifier: GPL-3.0-only
// Shipped main/core/store/dining/entities with native IO doubles. Native entity
// timer properties are inputs here, not a simulation or client/world proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, balance, itemCount, configure } from './main.harness.js';
import { entityServices, FakeItem, place } from './appliances.harness.js';

async function setup({ walkIn = false, seated = true, consumeLeather = true } = {}) {
  const env = await mainFixture();
  for (const entity of [...env.dimension.entities.values()]) entity.remove();
  env.restaurant.orders = [];
  env.player.container.setItem(0, undefined);
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) place(env, 'minecraft:stone', { x, y: -1, z });
  if (seated || walkIn) env.store.getStation(env.chair); else env.chair.setType('minecraft:air');
  const service = entityServices.createEntityService({ world: env.world, system: env.system, ...env.store,
    orderTime: () => ({ wall: Date.now(), tick: env.system.currentTick }),
    onCustomerReactionFinished: (restaurantId, orderId) => env.finishNativeReaction(restaurantId, orderId) });
  Object.assign(env.hooks.entities, service);
  const queued = env.system.callbacks.length; service.init(); env.system.callbacks[queued](); env.system.currentTick = 40;
  const order = (walkIn ? env.core.generateWalkInOrder : env.core.generateOrder)(env.restaurant,
    { wall: Date.now(), tick: env.system.currentTick }, () => 0.9999);
  env.store.saveRestaurant(env.restaurant);
  if (walkIn) service.spawnCustomer(env.restaurant, order);
  env.hooks.acceptWithTicket(env.player, env.restaurant, order);
  assert.equal(order.type, 'dine_in'); assert.equal(order.status, 'accepted');
  const customer = env.dimension.getEntities({ type: 'ordertocook:customer' })[0]; assert.ok(customer);
  if (!seated && walkIn) {
    // Walk-ins must arrive seated; a chair can be removed before handoff.
    service.onBlockBreak(env.chair, env.store.findStation(env.chair), env.chair.permutation); env.chair.setType('minecraft:air');
  }
  assert.equal(!!customer.getComponent('minecraft:riding')?.entityRidingOn, seated);
  const ticket = env.player.container.getItem(0);
  const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
  const shelfBlock = place(env, 'ordertocook:shelf', { x: 1, y: 0, z: 1 });
  env.player.container.setItem(0, new FakeItem('minecraft:leather', 3)); env.player.isSneaking = true;
  env.hooks.shelfInteract(env.player, shelfBlock); env.player.isSneaking = false;
  env.player.container.setItem(0, ticket); env.player.container.setItem(1, new FakeItem('minecraft:bread', 64));
  const shelf = env.store.findStation(shelfBlock);
  if (!consumeLeather) {
    configure(env, { countertopConsumeLeather: false }, 'server');
    env.store.deleteStation(shelf); shelfBlock.setType('minecraft:air');
  }
  return { ...env, order, customer, ticket, counter, shelf: consumeLeather ? shelf : undefined, service,
    linkage: { restaurantId: env.restaurant.id, orderId: order.id } };
}

async function packBag(env, entry = 'held-ticket') {
  env.player.isSneaking = true;
  if (entry === 'picker') { env.player.container.setItem(0, undefined); env.formResponses.push(0); }
  env.formResponses.push(1);
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.order.status, 'packed', 'sneak choice must pack the accepted dine-in order without a clean plate');
  assert.equal(env.counter.above().typeId, 'ordertocook:takeout_bag');
}

test('generated dine-in order packs without a plate, moves its exact native bag and completes through the real entity service', async () => {
  const env = await setup(); const deadline = { wall: env.order.expiresAt, tick: env.order.expiresTick };
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.forms.length, 0); assert.equal(env.order.status, 'accepted');
  assert.equal(itemCount(env.player, 'minecraft:bread'), 64); assert.equal(env.shelf.supplies, 3);
  await packBag(env);
  assert.equal(env.order.type, 'dine_in'); assert.equal(env.order.carrier, 'bag');
  assert.deepEqual({ wall: env.order.expiresAt, tick: env.order.expiresTick }, deadline);
  assert.equal(env.shelf.supplies, 2); assert.equal(itemCount(env.player, 'minecraft:bread'), 64 - env.order.items[0].amount);
  env.hooks.pickupDisplay(env.player, env.counter.above());
  const bag = env.player.container.getItem(0);
  bag.nameTag = '堂食打包'; bag.setLore(['完整保留']); bag.setDynamicProperty('test:batch', 'dine-in-bag');
  env.player.container.setItem(0, bag); env.hooks.placeParcel(env.player, env.counter, 'Up');
  env.hooks.pickupDisplay(env.player, env.counter.above());
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(bag));
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0 });
  assert.equal(env.order.status, 'completed'); assert.equal(env.order.completion.action, 3);
  assert.equal(env.order.meal, undefined); assert.equal(env.order.boomBonus, 0);
  assert.equal(env.restaurant.pendingDishes.length, 0); assert.equal(env.restaurant.stats.delivery, 0);
  assert.equal(balance(env.player), env.order.paidReward); assert.equal(env.customer.getProperty('ordertocook:action'), 3);
  env.system.currentTick += 40;
  env.customer.setProperty('ordertocook:reaction_tick', 40); env.customer.setProperty('ordertocook:reaction_done', true);
  env.service.tick();
  assert.equal(env.customer.isValid, false); assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
  assert.equal(itemCount(env.player, 'ordertocook:dirty_plate'), 0);
});

function snapshot(env) {
  return Array.from({ length: env.player.container.size }, (_, slot) => structuredClone(env.player.container.getItem(slot)));
}
function canonicalOrder(env) { return env.store.getRestaurant(env.restaurant.id).orders.find(order => order.id === env.order.id); }
function assertNoPreparation(env, before) {
  assert.deepEqual(snapshot(env), before); if (env.shelf) assert.equal(env.shelf.supplies, 3);
  assert.equal(env.counter.above().isAir, true); assert.equal(canonicalOrder(env).status, 'accepted');
  assert.equal(canonicalOrder(env).carrier, undefined);
}

// Matrix covers the two entry points and the native seated/standing actions.
// The walk-in standing case removes its required arrival chair before handoff.
test('ordinary and walk-in bag handoffs keep tips/statistics and use seated or standing take reactions without plate/boom effects', async () => {
  for (const walkIn of [false, true]) for (const seated of [false, true]) {
    const env = await setup({ walkIn, seated });
    env.restaurant.config.tipNormalChance = 1; env.restaurant.config.tipUrgentChance = 1;
    env.restaurant.config.tipEasterEggCustomerChance = 1; env.order.easterEgg = true;
    env.store.saveRestaurant(env.restaurant);
    await packBag(env, walkIn ? 'picker' : 'held-ticket');
    env.hooks.pickupDisplay(env.player, env.counter.above());
    // Make the real dining admission test reject a plate; a bag must bypass it.
    const base = env.service.getCustomerSeat(env.customer)?.location ?? env.customer.location;
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) place(env, 'minecraft:stone',
      { x: Math.floor(base.x) + dx, y: Math.floor(base.y) + 1, z: Math.floor(base.z) + dz });
    assert.equal(env.hooks.dining.hasVacancy(env.restaurant, env.customer), false);
    const bag = env.player.container.getItem(0); const soundAt = env.dimension.sounds.length;
    let rolls = 0;
    env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => { rolls++; return 0; } });
    assert.equal(rolls, 2, 'tip chance/value only; no eat/boom roll');
    assert.equal(env.order.status, 'completed'); assert.equal(env.order.type, 'dine_in');
    assert.equal(env.order.tip, 1); assert.equal(balance(env.player), env.order.reward + 1);
    assert.equal(env.restaurant.stats.completed, 1); assert.equal(env.restaurant.stats.walkIn, Number(walkIn));
    assert.equal(env.restaurant.stats.delivery, 0); assert.equal(env.restaurant.stats.deliveryEarnings, 0);
    assert.equal(env.order.completion.action, seated ? 3 : 4);
    assert.equal(env.order.completion.finishAt - env.order.completion.startedAt, seated ? 2000 : 3000);
    assert.equal(env.customer.getProperty('ordertocook:stage'), 'leaving');
    assert.equal(env.order.meal, undefined); assert.equal(env.order.boomBonus, 0);
    assert.equal(env.hooks.dining.queueMeal(env.restaurant, env.order, env.customer), undefined);
    assert.equal(env.restaurant.pendingDishes.length, 0);
    assert.equal(env.dimension.sounds.slice(soundAt).some(sound => /food_plate|explosion/.test(sound)), false);
    assert.doesNotMatch(env.player.messages.at(-1), /髒餐盤/);
    env.player.container.setItem(5, bag); env.player.selectedSlotIndex = 5;
    env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => { throw Error('duplicate payment'); } });
    assert.equal(balance(env.player), env.order.paidReward); assert.equal(env.restaurant.stats.completed, 1);
    env.system.currentTick += seated ? 40 : 60;
    env.customer.setProperty('ordertocook:reaction_tick', seated ? 40 : 60);
    env.customer.setProperty('ordertocook:reaction_done', true); env.service.tick();
    assert.equal(env.customer.isValid, false); assert.equal(env.dimension.getEntities({ type: 'ordertocook:seat' }).length, 0);
    assert.equal(env.restaurant.pendingDishes.length, 0); assert.equal(balance(env.player), env.order.paidReward);
  }
});

test('both extra-choice cancellation paths leave the ticket, food, supplies and order untouched', async () => {
  for (const consumeLeather of [true, false]) for (const entry of ['held-ticket', 'picker']) {
    const env = await setup({ consumeLeather }); env.player.isSneaking = true;
    if (entry === 'picker') { env.player.container.setItem(0, undefined); env.formResponses.push(0); }
    const before = snapshot(env);
    await env.hooks.countertopForm(env.player, env.counter);
    assertNoPreparation(env, before); assert.equal(env.forms.length, entry === 'picker' ? 2 : 1);
  }
});

test('extra-choice callbacks revalidate canonical state, rights, deadline, proximity and the original held ticket', async () => {
  for (const consumeLeather of [true, false]) for (const mutation of ['canonical', 'permission', 'deadline', 'distance', 'ticket', 'proof', 'machine']) {
    const env = await setup({ consumeLeather }); env.player.isSneaking = true;
    const before = snapshot(env);
    env.formResponses.push(() => {
      if (mutation === 'canonical') env.store.saveRestaurant(JSON.parse(JSON.stringify(env.restaurant)));
      if (mutation === 'permission') { env.restaurant.ownerId = 'someone-else'; env.store.saveRestaurant(env.restaurant); }
      if (mutation === 'deadline') env.system.currentTick = env.order.expiresTick;
      if (mutation === 'distance') env.player.location = { x: 100, y: 0, z: 0 };
      if (mutation === 'ticket') env.player.container.setItem(0, undefined);
      if (mutation === 'proof') { const ticket = env.ticket.clone(); ticket.setDynamicProperty('ordertocook:proof', 'stale'); env.player.container.setItem(0, ticket); }
      if (mutation === 'machine') env.machine.setType('minecraft:air');
      return 1;
    });
    await env.hooks.countertopForm(env.player, env.counter);
    if (mutation === 'ticket' || mutation === 'proof') before[0] = structuredClone(env.player.container.getItem(0));
    assertNoPreparation(env, before);
  }
});

test('bag preparation rolls back real commit failures with or without a supply object and allows one canonical retry', async () => {
  for (const consumeLeather of [true, false]) for (const type of ['dine_in', 'delivery']) {
    for (const failure of ['restaurant', 'output', 'display', 'container', 'item']) {
      const env = await setup({ consumeLeather }); env.order.type = type; env.store.saveRestaurant(env.restaurant);
      const before = snapshot(env); env.player.isSneaking = true;
      const output = env.counter.above(), setPermutation = output.setPermutation.bind(output);
      let armed = false;
      // Arm failures after countertopForm's expire/save preflight. In particular,
      // the restaurant failure must hit the packed commit, not that earlier save.
      const armFailure = () => {
        armed = true;
        if (failure === 'restaurant') env.failWrite(id => id === `ordertocook:r:${env.restaurant.id}`);
        if (failure === 'display') env.failWrite(id => id === `ordertocook:s:${env.store.locationId(output.dimension.id, output.location)}`);
        if (failure === 'container') env.dimension.nativeContainers = false;
        if (['output', 'item'].includes(failure)) output.setPermutation = permutation => {
          if (armed && permutation.type.id === 'ordertocook:takeout_bag') {
            armed = false;
            if (failure === 'output') throw Error('simulated output placement failure');
            setPermutation(permutation); output.container.failNextSlot = 0; return;
          }
          setPermutation(permutation);
        };
        return 1;
      };
      if (type === 'dine_in') env.formResponses.push(armFailure);
      else { env.player.container.setItem(0, undefined); before[0] = undefined; env.formResponses.push(() => { armFailure(); return 0; }); }
      await assert.rejects(env.hooks.countertopForm(env.player, env.counter));
      assertNoPreparation(env, before); assert.equal(env.dimension.drops.length, 0);
      assert.equal(env.store.findStation(output), undefined);
      env.dimension.nativeContainers = true;
      env.restaurant = env.store.getRestaurant(env.restaurant.id); env.order = canonicalOrder(env);
      if (type === 'dine_in') await packBag(env);
      else { env.formResponses.push(0); await env.hooks.countertopForm(env.player, env.counter); }
      assert.equal(env.order.status, 'packed');
      if (env.shelf) assert.equal(env.shelf.supplies, 2);
      assert.equal(itemCount(env.player, 'minecraft:bread'), 64 - env.order.items[0].amount);
    }
  }
});

test('persisted dine-in bag carrier and proof survive store reload, while absent legacy fields alone retain type defaults', async () => {
  const env = await setup(); await packBag(env);
  const saved = await mainFixture([...env.properties]);
  const restored = saved.store.getRestaurant(env.restaurant.id).orders.find(order => order.id === env.order.id);
  assert.equal(restored.carrier, 'bag'); assert.equal(restored.type, 'dine_in'); assert.equal(restored.proof, env.order.proof);
  assert.equal(saved.hooks.parcelFor(saved.restaurant, restored).typeId, 'ordertocook:takeout_bag');
  for (const type of ['dine_in', 'delivery']) {
    const legacy = { ...restored, type }; delete legacy.carrier;
    assert.equal(saved.hooks.parcelFor(saved.restaurant, legacy).typeId, type === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate');
  }
  for (const carrier of [null, '', 'unknown']) {
    restored.carrier = carrier;
    assert.equal(saved.core.orderCarrier(restored), undefined);
    assert.throws(() => saved.hooks.parcelFor(saved.restaurant, restored), /承載物/);
    assert.equal(saved.core.completeOrder(saved.restaurant, restored.id, { wall: Date.now(), tick: saved.system.currentTick }).reason, 'invalid_carrier');
  }
});

test('canonical carrier and proof reject the other physical item at placement and handoff in both directions', async () => {
  for (const bagOrder of [false, true]) {
    const env = bagOrder ? await setup() : await mainFixture();
    if (bagOrder) { await packBag(env); env.hooks.pickupDisplay(env.player, env.counter.above()); }
    else delete env.order.carrier; // Actual legacy plated save, not a new selected plate.
    const valid = env.player.container.getItem(0);
    const wrong = new FakeItem(bagOrder ? 'ordertocook:food_plate' : 'ordertocook:takeout_bag');
    Object.assign(wrong.properties, valid.properties);
    const wrongProof = valid.clone(); wrongProof.setDynamicProperty('ordertocook:proof', 'forged');
    const table = place(env, 'minecraft:stone', { x: 1, y: 0, z: 2 }); env.player.isSneaking = true;
    for (const invalid of [wrong, wrongProof]) {
      env.player.container.setItem(0, invalid);
      env.hooks.placeParcel(env.player, table, 'Up'); env.hooks.customerInteract(env.player, env.customer, env.linkage);
      assert.equal(table.above().isAir, true); assert.equal(env.order.status, 'packed');
      assert.equal(balance(env.player), 0); assert.equal(env.restaurant.pendingDishes.length, 0);
      assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(invalid));
    }
  }
});

test('legacy display reconstruction uses the canonical carrier and rejects a mismatched display type', async () => {
  const env = await setup(); await packBag(env);
  const display = env.counter.above(), station = env.store.findStation(display);
  display.container.setItem(0, undefined); delete station.nativeParcel; env.store.saveStation(station);
  env.hooks.pickupDisplay(env.player, display);
  assert.equal(env.player.container.getItem(0).typeId, 'ordertocook:takeout_bag');
  assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:proof'), env.order.proof);
  env.player.container.setItem(0, undefined);
  display.setType('ordertocook:food_plate_display');
  const wrong = env.store.getStation(display);
  Object.assign(wrong, { restaurantId: env.restaurant.id, orderId: env.order.id, proof: env.order.proof });
  env.store.saveStation(wrong); env.hooks.pickupDisplay(env.player, display);
  assert.equal(env.player.container.getItem(0), undefined); assert.equal(display.container.getItem(0), undefined);
});

test('bag handoff save failure restores the exact bag and canonical packed state before a single payment retry', async () => {
  const env = await setup(); await packBag(env); env.hooks.pickupDisplay(env.player, env.counter.above());
  const bag = env.player.container.getItem(0); bag.setLore(['保留']); bag.setDynamicProperty('test:batch', 'rollback'); env.player.container.setItem(0, bag);
  env.failWrite(id => id === `ordertocook:r:${env.restaurant.id}`);
  assert.throws(() => env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0 }));
  assert.equal(canonicalOrder(env).status, 'packed'); assert.equal(canonicalOrder(env).carrier, 'bag');
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(bag)); assert.equal(balance(env.player), 0);
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0 });
  assert.equal(canonicalOrder(env).status, 'completed'); assert.equal(balance(env.player), canonicalOrder(env).paidReward);
  assert.equal(env.store.getRestaurant(env.restaurant.id).pendingDishes.length, 0);
});

test('delivery cannot select a plate and expired dine-in bags cannot pay', async () => {
  const env = await setup(); const before = snapshot(env);
  env.order.type = 'delivery'; env.store.saveRestaurant(env.restaurant);
  env.hooks.prepareOrderAtCountertop(env.player, env.counter, env.restaurant, env.order, 'plate');
  assertNoPreparation(env, before);
  assert.equal(env.core.packOrder(env.restaurant, env.order.id, { wall: Date.now(), tick: env.system.currentTick }, 'plate').reason, 'invalid_carrier');
  env.order.type = 'dine_in'; env.store.saveRestaurant(env.restaurant);
  await packBag(env); env.hooks.pickupDisplay(env.player, env.counter.above());
  const bag = structuredClone(env.player.container.getItem(0)); env.system.currentTick = env.order.expiresTick;
  env.hooks.customerInteract(env.player, env.customer, env.linkage);
  assert.equal(env.order.status, 'expired'); assert.equal(balance(env.player), 0);
  assert.deepEqual(structuredClone(env.player.container.getItem(0)), bag); assert.equal(env.restaurant.pendingDishes.length, 0);
});

test('the explicit plate choice preserves seated dining, dirty-plate ownership and the deferred boom bonus with leather disabled', async () => {
  const env = await setup(); configure(env, { countertopConsumeLeather: false }, 'server');
  const shelfBlock = place(env, 'ordertocook:plate_shelf', { x: 1, y: 0, z: -1 });
  env.player.container.setItem(0, new FakeItem('ordertocook:clean_plate')); env.hooks.shelfInteract(env.player, shelfBlock);
  env.player.container.setItem(0, env.ticket); env.player.isSneaking = true; env.formResponses.push(0);
  await env.hooks.countertopForm(env.player, env.counter);
  assert.equal(env.order.carrier, 'plate'); assert.equal(env.shelf.supplies, 3);
  env.hooks.pickupDisplay(env.player, env.counter.above());
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0 });
  assert.equal(env.order.status, 'completed'); assert.equal(env.order.meal.action, 5);
  assert.ok(env.order.boomBonus > 0); assert.equal(env.restaurant.pendingDishes.length, 1);
  assert.equal(balance(env.player), env.order.reward, 'boom bonus is not paid at handoff');
  assert.equal(env.customer.getProperty('ordertocook:stage'), 'eating');
});
