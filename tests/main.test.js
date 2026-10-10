// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, balance, itemCount } from './main.harness.js';
import { FakeItem, place } from './appliances.harness.js';

test('ordinary machine dining accepts without a chair and issues its canonical ticket', async () => {
  const env = await mainFixture(); env.chair.setType('minecraft:air');
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.9999);
  env.store.saveRestaurant(env.restaurant);
  assert.equal(order.type, 'dine_in'); assert.equal(order.walkIn, false); assert.equal(order.status, 'offered');
  assert.equal(env.store.nearbyStations(env.restaurant.dimensionId, env.restaurant.location, 24, 'ordertocook:chair').length, 0);
  env.hooks.acceptWithTicket(env.player, env.restaurant, order);
  assert.equal(order.status, 'accepted');
  assert.equal(itemCount(env.player, 'ordertocook:order'), 1);
  const ticket = Array.from({ length: env.player.container.size }, (_, slot) => env.player.container.getItem(slot))
    .find(item => item?.typeId === 'ordertocook:order');
  assert.equal(ticket.getDynamicProperty('ordertocook:order_id'), order.id);
  assert.equal(ticket.getDynamicProperty('ordertocook:restaurant'), env.restaurant.id);
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
  assert.equal(balance(env.player), 0); assert.equal(env.restaurant.stats.completed, 0);
});

test('walk-in without a chair remains offered and does not consume or issue any item', async () => {
  const env = await mainFixture(); env.chair.setType('minecraft:air');
  const order = env.core.generateWalkInOrder(env.restaurant, Date.now(), () => 0.9999);
  env.store.saveRestaurant(env.restaurant);
  const before = Array.from({ length: env.player.container.size }, (_, slot) => env.player.container.getItem(slot));
  const stats = structuredClone(env.restaurant.stats);
  env.hooks.acceptWithTicket(env.player, env.restaurant, order);
  assert.equal(order.status, 'offered'); assert.equal(order.walkIn, true);
  assert.deepEqual(Array.from({ length: env.player.container.size }, (_, slot) => env.player.container.getItem(slot)), before);
  assert.deepEqual(env.restaurant.stats, stats);
  assert.equal(itemCount(env.player, 'ordertocook:order'), 0);
  assert.match(env.player.messages.at(-1), /到店顧客.*椅子/);
});

test('production handoff records one animation/plate and pays the canonical reward once', async () => {
  const env = await mainFixture();
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 });
  assert.equal(env.order.status, 'completed'); assert.equal(balance(env.player), env.order.paidReward);
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 0);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  assert.equal(env.order.meal.action, 6); assert.equal(env.endings.length, 1);
  env.player.container.setItem(5, env.parcel); env.player.selectedSlotIndex = 5;
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => { throw Error('replay rolled'); } });
  assert.equal(balance(env.player), env.order.paidReward);
  assert.equal(env.restaurant.pendingDishes.length, 1); assert.equal(env.endings.length, 1);
});

test('production boom selection is persisted with one bounded bonus payment', async () => {
  const env = await mainFixture(); env.restaurant.level = 2; env.store.saveRestaurant(env.restaurant);
  let at = 0; const values = [0.9999, 0.05, 0.9999];
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => values[at++] });
  assert.equal(env.order.meal.action, 5); assert.equal(env.order.boomBonus, 6);
  assert.equal(env.order.paidReward, env.order.reward + 6);
  assert.equal(env.restaurant.stats.completed, 1); assert.equal(balance(env.player), env.order.paidReward);
  assert.equal(env.endings[0][1].finishAt - env.endings[0][1].startedAt, 6000);
});

test('wrong physical carrier type and wrong proof cannot complete the order', async () => {
  const env = await mainFixture();
  const wrongType = new FakeItem('ordertocook:takeout_bag');
  Object.assign(wrongType.properties, env.parcel.properties);
  env.player.container.setItem(0, wrongType);
  env.hooks.customerInteract(env.player, env.customer, env.linkage);
  assert.equal(env.order.status, 'packed'); assert.equal(balance(env.player), 0);
  const wrongProof = env.parcel.clone(); wrongProof.setDynamicProperty('ordertocook:proof', 'copied-from-other-order');
  env.player.container.setItem(0, wrongProof);
  env.hooks.customerInteract(env.player, env.customer, env.linkage);
  assert.equal(env.order.status, 'packed'); assert.equal(env.restaurant.pendingDishes.length, 0);
});

test('handoff native consume failure cannot leave a paid order or lose its parcel', async () => {
  const env = await mainFixture(); env.player.container.failNextSlot = 0;
  assert.throws(() => env.hooks.customerInteract(env.player, env.customer, env.linkage));
  const restored = env.store.getRestaurant(env.restaurant.id);
  assert.equal(restored.orders[0].status, 'packed'); assert.equal(restored.stats.completed, 0);
  assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:proof'), env.order.proof);
  assert.equal(balance(env.player), 0);
});

test('handoff native consume failure after accepting the write restores the exact proof', async () => {
  const env = await mainFixture(); const original = env.player.container.setItem.bind(env.player.container); let once = true;
  env.player.container.setItem = (slot, item) => { original(slot, item); if (once && item === undefined) { once = false; throw Error('consume accepted then threw'); } };
  assert.throws(() => env.hooks.customerInteract(env.player, env.customer, env.linkage));
  assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:proof'), env.order.proof);
  assert.equal(env.store.getRestaurant(env.restaurant.id).orders[0].status, 'packed');
  assert.equal(balance(env.player), 0);
});

test('failed canonical completion save rolls back the physical parcel before retry', async () => {
  const env = await mainFixture(); env.failWrite(id => id === `ordertocook:r:${env.restaurant.id}`);
  assert.throws(() => env.hooks.customerInteract(env.player, env.customer, env.linkage));
  const restored = env.store.getRestaurant(env.restaurant.id);
  assert.equal(restored.orders[0].status, 'packed'); assert.equal(restored.pendingDishes.length, 0);
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1); assert.equal(balance(env.player), 0);
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 });
  assert.equal(restored.orders[0].status, 'completed'); assert.equal(restored.stats.completed, 1);
});

test('dirty plate claim through production hook stays independent from order payout', async () => {
  const env = await mainFixture(); env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 });
  const meal = env.restaurant.pendingDishes[0], paid = balance(env.player);
  meal.startedAt -= 6000; env.store.saveRestaurant(env.restaurant); env.hooks.dining.tick();
  const visual = env.dimension.getEntities({ type: 'ordertocook:dining_plate' })[0];
  env.hooks.collectDiningPlate(env.player, visual); env.hooks.collectDiningPlate(env.player, visual);
  assert.equal(itemCount(env.player, 'ordertocook:dirty_plate'), 1);
  assert.equal(balance(env.player), paid); assert.equal(env.restaurant.pendingDishes.length, 0);
});

test('occupied dining anchor rejects a fresh handoff before consuming or paying anything', async () => {
  const env = await mainFixture();
  env.restaurant.pendingDishes.push({ id: 'previous-meal', dimensionId: env.dimension.id, location: { x: 2.5, y: 1.0125, z: 3.5 }, status: 'dirty' });
  env.store.saveRestaurant(env.restaurant);
  env.hooks.customerInteract(env.player, env.customer, env.linkage);
  assert.equal(env.order.status, 'packed'); assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
  assert.equal(balance(env.player), 0); assert.equal(env.restaurant.stats.completed, 0);
  assert.match(env.player.messages.at(-1), /先收走/);
});

test('replaced machine cannot reopen a closing restaurant or accept a late physical handoff', async () => {
  const env = await mainFixture();
  env.restaurant.removing = true; env.restaurant.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: 'Do not rewrite' }];
  env.store.saveRestaurant(env.restaurant);
  assert.equal(env.hooks.getMachine(env.player, env.machine), env.restaurant);
  assert.equal(env.restaurant.menu[0].label, 'Do not rewrite');
  env.hooks.customerInteract(env.player, env.customer, env.linkage);
  assert.equal(env.order.status, 'packed'); assert.equal(balance(env.player), 0);
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
  assert.equal(env.hooks.canUseStation(env.player, env.machine), false);
});

test('parcel placement consumes exactly one physical carrier and pickup preserves its proof', async () => {
  const env = await mainFixture(); const table = place(env, 'minecraft:stone', { x: 1, y: 0, z: 2 });
  env.player.isSneaking = true;
  env.hooks.placeParcel(env.player, table, 'Up');
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 0);
  assert.equal(table.above().typeId, 'ordertocook:food_plate_display');
  env.hooks.pickupDisplay(env.player, table.above());
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
  assert.equal(env.player.container.getItem(0).getDynamicProperty('ordertocook:proof'), env.order.proof);
  assert.equal(table.above().typeId, 'minecraft:air');
});

test('initial display-station persistence failure removes failed placement without consuming its parcel', async () => {
  const env = await mainFixture(); const table = place(env, 'minecraft:stone', { x: 1, y: 0, z: 2 });
  env.player.isSneaking = true; env.failWrite(id => id.startsWith('ordertocook:s:'));
  assert.throws(() => env.hooks.placeParcel(env.player, table, 'Up'));
  assert.equal(table.above().typeId, 'minecraft:air');
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
  assert.equal(env.store.findStation(table.above()), undefined);
});

test('parcel-placement consume exception after writing restores one carrier and no display', async () => {
  const env = await mainFixture(); const table = place(env, 'minecraft:stone', { x: 1, y: 0, z: 2 });
  env.player.isSneaking = true; const original = env.player.container.setItem.bind(env.player.container); let once = true;
  env.player.container.setItem = (slot, item) => { original(slot, item); if (once && !item) { once = false; throw Error('accepted then threw'); } };
  assert.throws(() => env.hooks.placeParcel(env.player, table, 'Up'));
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
  assert.equal(table.above().typeId, 'minecraft:air');
  assert.equal(env.store.findStation(table.above()), undefined);
});

test('production handoff commits personal earnings with the canonical completed order', async () => {
  const env = await mainFixture();
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 });
  const state = env.hooks.progression.getState(env.player.id);
  assert.equal(state.totals.earned, env.order.paidReward);
  assert.equal(state.totals.completed, 1);
  assert.ok(state.unlocked.first_order); assert.equal(state.unlocked.root, undefined);
  assert.equal(env.restaurant.progressLedger.players[env.player.id].earned, env.order.paidReward);
  env.player.container.setItem(5, env.parcel); env.player.selectedSlotIndex = 5;
  env.hooks.customerInteract(env.player, env.customer, env.linkage);
  env.hooks.progression.reconcilePlayer(env.player.id);
  assert.deepEqual(env.hooks.progression.getState(env.player.id), state);
});

test('a delayed profile write does not fail the paid order and catches up from its saved ledger', async () => {
  const env = await mainFixture();
  env.failWrite(id => id.startsWith('ordertocook:p:'));
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 });
  assert.equal(env.order.status, 'completed'); assert.equal(balance(env.player), env.order.paidReward);
  assert.equal(env.hooks.progression.getState(env.player.id).totals.earned, 0);
  assert.equal(env.hooks.reconcileProgress(env.restaurant), true);
  assert.equal(env.hooks.progression.getState(env.player.id).totals.earned, env.order.paidReward);
  env.hooks.reconcileProgress(env.restaurant);
  assert.equal(env.hooks.progression.getState(env.player.id).totals.completed, 1);
});

test('failed restaurant commit rolls back the pending personal ledger with the parcel', async () => {
  const env = await mainFixture();
  env.failWrite(id => id === 'ordertocook:r:' + env.restaurant.id);
  assert.throws(() => env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 }), /persistence failure/);
  const saved = env.store.getRestaurant(env.restaurant.id);
  assert.equal(saved.progressLedger, undefined);
  assert.equal(saved.orders.find(order => order.id === env.order.id).status, 'packed');
  assert.equal(env.hooks.progression.getState(env.player.id).totals.earned, 0);
  assert.equal(itemCount(env.player, 'ordertocook:food_plate'), 1);
});

test('restaurant removal retains an unacknowledged personal ledger for a later retry', async () => {
  const env = await mainFixture();
  env.failWrite(id => id.startsWith('ordertocook:p:'));
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => 0.9999 });
  const before = env.machine.permutation; env.machine.setType('minecraft:air');
  env.failWrite(id => id.startsWith('ordertocook:p:'));
  env.hooks.onBreak({ block: env.machine, brokenBlockPermutation: before });
  const saved = env.store.getRestaurant(env.restaurant.id);
  assert.ok(saved); assert.equal(saved.removing, true);
  assert.equal(saved.progressLedger.players[env.player.id].earned, env.order.paidReward);
  assert.equal(env.hooks.reconcileProgress(saved), true);
  assert.equal(env.hooks.progression.getState(env.player.id).totals.earned, env.order.paidReward);
});

test('one HUD update combines equipment with delivery and prioritizes washing without losing navigation', async () => {
  const env = await mainFixture();
  env.order.type = 'delivery'; env.order.destination = { dimensionId: env.player.dimension.id, x: 100, y: 0, z: 100 };
  env.store.saveRestaurant(env.restaurant);
  env.player.viewedBlock = env.machine;
  env.hooks.appliances.getInspection = () => '設備讀數';
  env.hooks.appliances.getWashingProgress = () => undefined;
  env.hooks.updateHud();
  assert.match(env.player.messages.at(-1), /^設備讀數\n§r§6外送/);
  env.hooks.appliances.getWashingProgress = () => '手洗進度';
  env.hooks.updateHud();
  assert.match(env.player.messages.at(-1), /^手洗進度\n§r§6外送/);
  assert.doesNotMatch(env.player.messages.at(-1), /設備讀數/);
});

test('unloaded crosshair targets do not hide delivery hints and idle HUD clears only once', async () => {
  const env = await mainFixture();
  env.order.type = 'delivery'; env.order.destination = { dimensionId: env.player.dimension.id, x: 100, y: 0, z: 100 };
  env.store.saveRestaurant(env.restaurant);
  env.player.getBlockFromViewDirection = () => { throw Error('chunk unavailable'); };
  env.hooks.updateHud();
  assert.match(env.player.messages.at(-1), /外送/);
  env.player.container.setItem(0, undefined);
  env.hooks.updateHud(); assert.equal(env.player.messages.at(-1), '');
  const count = env.player.messages.length; env.hooks.updateHud();
  assert.equal(env.player.messages.length, count);
});

test('placement unlocks only the actual placer and looking at a machine does not grant root', async () => {
  const env = await mainFixture();
  assert.equal(env.hooks.progression.getState(env.player.id).unlocked.root, undefined);
  for (const fn of env.world.afterEvents.playerPlaceBlock.subscriptions) fn({ block: env.machine, player: env.player });
  assert.ok(env.hooks.progression.getState(env.player.id).unlocked.root);
});

test('golden progress excludes known removed blocks but keeps valid distant registered machines', async () => {
  const env = await mainFixture();
  for (let i = 1; i <= 3; i++) {
    const machine = place(env, 'ordertocook:order_machine', { x: i * 30, y: 0, z: 0 });
    env.hooks.getMachine(env.player, machine);
  }
  env.dimension.getBlock({ x: 90, y: 0, z: 0 }).setType('minecraft:air');
  env.hooks.updateProgressRankings();
  assert.equal(env.hooks.progression.getState(env.player.id).unlocked.golden_restaurant, undefined);
  env.dimension.getBlock({ x: 90, y: 0, z: 0 }).setType('ordertocook:order_machine');
  env.hooks.updateProgressRankings();
  assert.ok(env.hooks.progression.getState(env.player.id).unlocked.golden_restaurant);
});
