// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiningService, mealStage, resolveMealAnchor, DINING_ENTITY, DINING_BLOCK, MEAL_TOKEN } from '../runtime/BP/scripts/dining.js';
import { FakeItem, FakePlayer, makeEnvironment, place, entityServices } from './appliances.harness.js';

const NOW = 1800000000000;

function fixture() {
  const env = makeEnvironment();
  const snapshots = new Map();
  let failSave = 0;
  env.ctx.ItemStack = FakeItem;
  env.ctx.canManage = (player, restaurant) => player.id === restaurant.ownerId;
  env.ctx.saveRestaurant = restaurant => {
    if (failSave > 0 && --failSave === 0) {
      env.restaurants.set(restaurant.id, structuredClone(snapshots.get(restaurant.id)));
      throw Error('simulated restaurant persistence failure');
    }
    env.restaurants.set(restaurant.id, restaurant);
    snapshots.set(restaurant.id, structuredClone(restaurant));
  };
  const player = new FakePlayer(env.dimension, { x: 0.5, y: 0, z: 0.5 });
  const chair = place(env, 'ordertocook:chair', { x: 0, y: 0, z: 0 }, { 'minecraft:cardinal_direction': 'south' });
  const customer = env.dimension.spawnEntity('ordertocook:customer', { x: 0.5, y: 0.5625, z: 0.5 });
  customer.setProperty('ordertocook:action', 6);
  customer.setDynamicProperty('ordertocook:restaurant_id', 'r');
  customer.setDynamicProperty('ordertocook:order_id', 'r:one');
  const resumed = [], interrupted = [];
  env.ctx.getCustomerSeat = () => chair;
  env.ctx.resumeCustomerMeal = (...args) => resumed.push(args);
  env.ctx.interruptCustomerMeal = (...args) => interrupted.push(args);
  const order = { id: 'r:one', type: 'dine_in', status: 'completed', platedVariant: 7,
    meal: { startedAt: NOW, finishAt: NOW + 5500, action: 6, boomBonus: 0 } };
  const restaurant = { id: 'r', ownerId: player.id, dimensionId: env.dimension.id,
    location: { x: 0, y: 0, z: 0 }, orders: [order], pendingDishes: [] };
  env.ctx.saveRestaurant(restaurant);
  env.ctx.settleMealBonus = (restaurant, meal) => { delete meal.reactionPending; env.ctx.saveRestaurant(restaurant); return true; };
  const service = createDiningService(env.ctx);
  const meal = service.queueMeal(restaurant, order, customer, NOW);
  // These existing fixtures represent timestamp-only saves; current native
  // meals are exercised separately below.
  delete meal.reactionPending;
  env.ctx.saveRestaurant(restaurant);
  return { ...env, service, restaurant, order, meal, customer, player, chair, resumed, interrupted,
    snapshots, failNextSave: (offset = 1) => { failSave = offset; } };
}

function nativePlate(env) {
  return env.dimension.getBlock({ x: Math.floor(env.meal.location.x), y: Math.floor(env.meal.location.y), z: Math.floor(env.meal.location.z) });
}
function nativeStage(env) {
  const state = nativePlate(env).permutation;
  return state.getState('ordertocook:stage') + 16 * state.getState('ordertocook:stage_high');
}

function dirtyCount(player) {
  let count = 0;
  for (let slot = 0; slot < player.container.size; slot++) {
    const item = player.container.getItem(slot);
    if (item?.typeId === 'ordertocook:dirty_plate') count += item.amount;
  }
  return count;
}

function advanceFood(env, ticks) {
  for (let i = 0; i < ticks; i++) env.service.tickFood(nativePlate(env), NOW);
}

test('all ten original plate variants use exact 15/60/80/100-tick stage thresholds', () => {
  for (let variant = 0; variant < 10; variant++) {
    const meal = { variant, startedAt: NOW };
    const expected = [[0, 0], [14, 0], [15, variant * 4 + 1], [59, variant * 4 + 1],
      [60, variant * 4 + 2], [79, variant * 4 + 2], [80, variant * 4 + 3], [99, variant * 4 + 3],
      [100, variant * 4 + 4], [10000, variant * 4 + 4]];
    for (const [elapsed, stage] of expected) assert.equal(mealStage(meal, elapsed), stage);
  }
});

test('meal begins in front of the chair with opposite-facing plate orientation', () => {
  const env = fixture();
  assert.deepEqual(env.meal.location, { x: 0.5, y: 1.0125, z: 1.5 });
  assert.equal(env.meal.rotationY, 180);
});

test('occupied front cell is preserved and an adjacent clear table receives the plate', () => {
  const env = fixture();
  const occupied = place(env, 'minecraft:chest', { x: 0, y: 1, z: 1 });
  place(env, 'minecraft:stone', { x: 1, y: 0, z: 0 });
  const anchor = resolveMealAnchor(env.customer, env.chair);
  assert.deepEqual(anchor.location, { x: 1.5, y: 1.0125, z: 0.5 });
  assert.equal(occupied.typeId, 'minecraft:chest');
});

test('queue callback reentry retains one canonical meal and never changes its timing', () => {
  const env = fixture();
  assert.equal(env.service.queueMeal(env.restaurant, env.order, env.customer, NOW + 1000), env.meal);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  assert.equal(env.meal.startedAt, NOW);
});

test('only completed dine-in orders can queue a recoverable dirty plate', () => {
  const env = fixture();
  for (const patch of [{ status: 'packed' }, { type: 'delivery' }]) {
    const order = { ...env.order, ...patch, id: 'unpaid' };
    assert.equal(env.service.queueMeal(env.restaurant, order, env.customer), undefined);
  }
  assert.equal(env.restaurant.pendingDishes.length, 1);
});

test('cosmetic meal progresses and remains dirty after the customer departure deadline', () => {
  const env = fixture(); let previous = 0; env.service.tick(NOW);
  for (const [elapsed, stage] of [[0, 0], [750, 29], [3000, 30], [4000, 31], [5000, 32], [10000, 32]]) {
    advanceFood(env, (elapsed - previous) / 50); previous = elapsed;
    env.service.tick(NOW + elapsed);
    const plates = env.dimension.getEntities({ type: DINING_ENTITY });
    assert.equal(plates.length, stage === 0 ? 1 : 0);
    assert.equal(nativePlate(env).typeId, DINING_BLOCK);
    assert.equal(nativeStage(env), stage);
  }
  assert.equal(env.restaurant.pendingDishes[0].status, 'dirty');
  assert.equal(env.dimension.drops.length, 0);
  assert.equal(dirtyCount(env.player), 0);
});

test('late-loaded placement seeks the original half-second clip without restarting the meal', () => {
  const env = fixture();
  env.service.tick(NOW + 350);
  let plate = env.dimension.getEntities({ type: DINING_ENTITY })[0];
  assert.equal(plate.getProperty('ordertocook:stage'), 0);
  assert.equal(plate.getProperty('ordertocook:placement_age'), 0.35);
  plate.remove();
  advanceFood(env, 7); env.service.tick(NOW + 700);
  plate = env.dimension.getEntities({ type: DINING_ENTITY })[0];
  assert.equal(plate.getProperty('ordertocook:placement_age'), 0.5);
  assert.equal(plate.getProperty('ordertocook:stage'), 0);
  advanceFood(env, 1); env.service.tick(NOW + 750);
  assert.equal(plate.isValid, false);
  assert.equal(nativeStage(env), 29);
  assert.equal(env.meal.startedAt, NOW);
  assert.equal(dirtyCount(env.player), 0);
});

test('restart reconciles the persisted plate without resetting meal time or duplicating geometry', () => {
  const env = fixture(); env.service.tick(NOW + 3000);
  env.ctx.saveRestaurant(env.restaurant);
  const restored = structuredClone(env.snapshots.get('r'));
  env.restaurants.set('r', restored);
  const restarted = createDiningService(env.ctx); restarted.tick(NOW + 4000);
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
  assert.equal(nativeStage(env), 30, 'offline wall time does not advance an adopted meal');
  for (let i = 0; i < 20; i++) restarted.tickFood(nativePlate(env), NOW + 4000);
  assert.equal(nativeStage(env), 31);
  assert.equal(restored.pendingDishes[0].startedAt, NOW);
});

test('missing loaded cosmetic entity is reconstructed from canonical state without creating an item', () => {
  const env = fixture(); env.service.tick(NOW);
  env.dimension.getEntities({ type: DINING_ENTITY })[0].remove();
  advanceFood(env, 100); env.service.tick(NOW + 5000);
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
  assert.equal(nativePlate(env).typeId, DINING_BLOCK);
  assert.equal(env.dimension.drops.length, 0);
});

test('unloaded meal anchor neither spawns entities nor loses its canonical record', () => {
  const env = fixture(), original = env.dimension.getBlock;
  env.dimension.getBlock = () => { throw Error('unloaded chunk'); };
  env.service.tick(NOW + 10000);
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  env.dimension.getBlock = original; env.service.tick(NOW + 11000);
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
  assert.equal(nativePlate(env).typeId, DINING_BLOCK);
});

test('normal pickup is exactly once and leaves no duplicate helper or pending row', () => {
  const env = fixture(); env.service.tick(NOW + 5000);
  const first = env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100);
  const second = env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100);
  assert.deepEqual(first, { ok: true, early: false, dropped: false, interruptedCustomer: undefined });
  assert.equal(second.reason, 'already_claimed');
  assert.equal(dirtyCount(env.player), 1);
  assert.equal(env.restaurant.pendingDishes.length, 0);
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
});

test('full inventory drops one plain plate without changing any full slot', () => {
  const env = fixture(); env.service.tick(NOW + 5000);
  for (let slot = 0; slot < env.player.container.size; slot++) env.player.container.setItem(slot, new FakeItem('minecraft:stone', 64));
  const before = env.player.container.slots.map(item => item.clone());
  assert.deepEqual(env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100), { ok: true, early: false, dropped: true, interruptedCustomer: undefined });
  assert.deepEqual(env.player.container.slots, before);
  assert.equal(env.restaurant.pendingDishes.length, 0);
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
  assert.equal(env.dimension.drops.length, 1);
  assert.equal(env.dimension.drops[0].stack.typeId, 'ordertocook:dirty_plate');
  assert.deepEqual(env.dimension.drops[0].stack.getDynamicPropertyIds(), []);
});

test('dirty pickup merges ordinary plates and preserves every unrelated full slot', () => {
  const env = fixture(); env.service.tick(NOW + 5000);
  for (let slot = 0; slot < env.player.container.size; slot++) env.player.container.setItem(slot, new FakeItem('minecraft:stone', 64));
  env.player.container.setItem(12, new FakeItem('ordertocook:dirty_plate', 63));
  assert.equal(env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100).ok, true);
  assert.equal(env.player.container.getItem(12).amount, 64);
  assert.equal(env.player.container.getItem(11).amount, 64);
});

test('wrong owner and distant player cannot claim the dirty plate', () => {
  const env = fixture(), intruder = new FakePlayer(env.dimension);
  assert.equal(env.service.claim(intruder, env.restaurant, env.meal, NOW).reason, 'permission');
  env.player.location.x = 50;
  assert.equal(env.service.claim(env.player, env.restaurant, env.meal, NOW).reason, 'too_far');
  assert.equal(env.meal.status, 'eating');
});

test('early pickup leaves exactly one dirty plate and persists the original 10-tick interruption', () => {
  const env = fixture(); env.service.tick(NOW + 750);
  assert.deepEqual(env.service.claim(env.player, env.restaurant, env.meal, NOW + 1000), { ok: true, early: true, dropped: false, interruptedCustomer: '顧客' });
  assert.equal(dirtyCount(env.player), 1);
  assert.equal(env.order.meal.action, 7);
  assert.equal(env.order.meal.finishAt, NOW + 1500);
  assert.equal(env.interrupted.length, 1);
});

test('early pickup retains a pruned-order interruption checkpoint across restart until its 10 ticks end', () => {
  const env = fixture(); env.restaurant.orders = []; env.ctx.saveRestaurant(env.restaurant); env.service.tick(NOW);
  env.service.claim(env.player, env.restaurant, env.meal, NOW + 1000);
  const pending = env.snapshots.get('r').pendingDishes[0];
  assert.equal(pending.status, 'claiming'); assert.equal(pending.action, 7);
  assert.equal(pending.finishAt, NOW + 1500);
  const restored = structuredClone(env.snapshots.get('r')); env.restaurants.set('r', restored);
  const restarted = createDiningService(env.ctx); restarted.tick(NOW + 1100);
  assert.equal(env.resumed.at(-1)[2].action, 7);
  assert.equal(restored.pendingDishes.length, 1);
  restarted.finishReaction('r', env.order.id, NOW + 1500);
  restarted.tick(NOW + 1500);
  assert.equal(restored.pendingDishes.length, 0); assert.equal(dirtyCount(env.player), 1);
});

test('failed interruption tombstone cleanup cannot resume a pruned order as the original eating action', () => {
  const env = fixture(); env.restaurant.orders = []; env.ctx.saveRestaurant(env.restaurant);
  env.service.claim(env.player, env.restaurant, env.meal, NOW + 1000);
  env.service.tick(NOW + 1100);
  env.service.finishReaction('r', env.order.id, NOW + 1499);
  env.failNextSave(); env.service.tick(NOW + 1500);
  const restored = env.restaurants.get('r'), pending = restored.pendingDishes[0];
  assert.equal(pending.action, 7); assert.equal(pending.finishAt, NOW + 1500);
  createDiningService(env.ctx).tick(NOW + 1600);
  assert.equal(env.resumed.at(-1)[2].action, 7); assert.equal(dirtyCount(env.player), 1);
  assert.equal(restored.pendingDishes.length, 0);
});

test('failed durable claim leaves inventory untouched and the restored meal retryable', () => {
  const env = fixture(); env.service.tick(NOW + 5000); env.failNextSave();
  assert.equal(env.service.atBlock(nativePlate(env)).meal, env.meal);
  assert.throws(() => env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100));
  assert.equal(dirtyCount(env.player), 0);
  const restored = env.restaurants.get('r');
  assert.equal(restored.pendingDishes[0].status, 'dirty');
  assert.equal(env.service.atBlock(nativePlate(env)).restaurant, restored);
  assert.equal(env.service.atBlock(nativePlate(env)).meal, restored.pendingDishes[0]);
  assert.equal(env.service.claim(env.player, restored, restored.pendingDishes[0], NOW + 5200).ok, true);
  assert.equal(env.service.atBlock(nativePlate(env), false), undefined);
});

test('native inventory exception before writing is rolled back before retrying a claim', () => {
  const env = fixture(); env.service.tick(NOW + 5000);
  env.player.container.failNextSlot = 0;
  assert.throws(() => env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100));
  assert.equal(dirtyCount(env.player), 0); assert.equal(env.meal.status, 'dirty');
  assert.equal(env.service.claim(env.player, env.restaurant, env.meal, NOW + 5200).ok, true);
  assert.equal(dirtyCount(env.player), 1);
});

test('native inventory exception after writing rolls back the accepted increment', () => {
  const env = fixture(); env.service.tick(NOW + 5000);
  env.player.container.setItem(0, new FakeItem('ordertocook:dirty_plate', 4));
  const original = env.player.container.setItem.bind(env.player.container); let once = true;
  env.player.container.setItem = (slot, item) => { original(slot, item); if (once) { once = false; throw Error('accepted then threw'); } };
  assert.throws(() => env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100));
  assert.equal(dirtyCount(env.player), 4); assert.equal(env.meal.status, 'dirty');
  env.service.claim(env.player, env.restaurant, env.meal, NOW + 5200);
  assert.equal(dirtyCount(env.player), 5);
});

test('failed final cleanup save cannot mint a second plate after restart', () => {
  const env = fixture(); env.service.tick(NOW + 5000); env.failNextSave(2);
  assert.equal(env.service.claim(env.player, env.restaurant, env.meal, NOW + 5100).ok, true);
  const restored = env.restaurants.get('r');
  assert.equal(restored.pendingDishes[0].status, 'claiming');
  const restarted = createDiningService(env.ctx); restarted.tick(NOW + 5200);
  assert.equal(env.restaurants.get('r').pendingDishes.length, 0);
  assert.equal(dirtyCount(env.player), 1);
});

test('interrupted claim checkpoint is never replayed as an unclaimed plate', () => {
  const env = fixture(); env.meal.status = 'claiming'; env.ctx.saveRestaurant(env.restaurant);
  createDiningService(env.ctx).tick(NOW + 6000);
  assert.equal(env.restaurant.pendingDishes.length, 0);
  assert.equal(dirtyCount(env.player), 0);
  assert.equal(env.dimension.drops.length, 0);
});

test('alpha.1 dueAt and duplicate pending rows migrate without creating two claims', () => {
  const env = fixture(); const legacy = { id: env.order.id, dimensionId: env.dimension.id, location: { x: 0.5, y: 1, z: 1.5 }, dueAt: NOW + 10000 };
  env.restaurant.pendingDishes = [legacy, { ...legacy }]; env.ctx.saveRestaurant(env.restaurant);
  env.service.tick(NOW + 6000);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  const migrated = env.restaurant.pendingDishes[0];
  assert.equal(migrated.version, 2); assert.equal(migrated.finishAt, legacy.dueAt);
  assert.equal(migrated.startedAt, NOW + 4500);
  assert.equal(mealStage(migrated, 30), 29);
});

test('paid order history pruning does not erase its dirty-plate lifecycle', () => {
  const env = fixture(); env.restaurant.orders = []; env.ctx.saveRestaurant(env.restaurant);
  env.service.tick(NOW + 5000);
  assert.equal(env.resumed.at(-1)[1].id, env.meal.id);
  assert.equal(env.service.claim(env.player, env.restaurant, env.meal, NOW + 5200).ok, true);
  assert.equal(dirtyCount(env.player), 1);
});

test('restaurant removal returns every outstanding plate once and removes cosmetic helpers', () => {
  const env = fixture(); env.service.tick(NOW + 1000);
  assert.equal(env.service.cleanupRestaurant(env.restaurant, NOW + 1000), true);
  assert.equal(env.service.cleanupRestaurant(env.restaurant, NOW + 1000), true);
  assert.equal(env.dimension.drops.length, 1);
  assert.equal(env.dimension.drops[0].stack.typeId, 'ordertocook:dirty_plate');
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 0);
});

test('restaurant removal waits for an unloaded plate anchor instead of dropping elsewhere', () => {
  const env = fixture(); env.dimension.getBlock = () => undefined;
  assert.equal(env.service.cleanupRestaurant(env.restaurant), false);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  assert.equal(env.dimension.drops.length, 0);
});

test('restaurant removal retries a verified pre-spawn exception without losing the dirty plate', () => {
  const env = fixture(), original = env.dimension.spawnItem;
  env.dimension.spawnItem = () => { throw Error('spawn failed before write'); };
  assert.throws(() => env.service.cleanupRestaurant(env.restaurant));
  assert.equal(env.meal.status, 'eating'); assert.equal(env.restaurant.pendingDishes.length, 1);
  env.dimension.spawnItem = original;
  assert.equal(env.service.cleanupRestaurant(env.restaurant), true);
  assert.equal(env.dimension.drops.length, 1);
});

test('restaurant removal detects a receipt when native spawn succeeds then throws', () => {
  const env = fixture();
  env.dimension.spawnItem = (item, location) => {
    const entity = env.dimension.spawnEntity('minecraft:item', location);
    entity.getComponent = id => id === 'minecraft:item' ? { itemStack: item.clone() } : undefined;
    throw Error('spawn succeeded then threw');
  };
  assert.equal(env.service.cleanupRestaurant(env.restaurant), true);
  assert.equal(env.service.cleanupRestaurant(env.restaurant), true);
  assert.equal(env.dimension.getEntities({ type: 'minecraft:item' }).length, 1);
  assert.equal(env.restaurant.pendingDishes.length, 0);
});

test('uncertain native spawn receipt is kept claimed rather than blindly duplicated', () => {
  const env = fixture(), query = env.dimension.getEntities;
  env.dimension.spawnItem = () => { throw Error('unknown native spawn result'); };
  env.dimension.getEntities = options => { if (options.type === 'minecraft:item') throw Error('cannot verify write'); return query.call(env.dimension, options); };
  assert.throws(() => env.service.cleanupRestaurant(env.restaurant));
  assert.equal(env.meal.status, 'claiming');
  const restarted = createDiningService(env.ctx);
  assert.equal(restarted.cleanupRestaurant(env.restaurant), true);
  assert.equal(env.dimension.drops.length, 0);
});

test('uncleared tabletop cannot receive overlapping meals at the same anchor', () => {
  const env = fixture();
  assert.equal(env.service.hasVacancy(env.restaurant, env.customer), false);
  env.service.claim(env.player, env.restaurant, env.meal, NOW + 5000);
  assert.equal(env.service.hasVacancy(env.restaurant, env.customer), true);
});

test('orphan and duplicate cosmetic actors never carry a second recoverable plate', () => {
  const env = fixture(); env.service.tick(NOW);
  const duplicate = env.dimension.spawnEntity(DINING_ENTITY, env.meal.location);
  duplicate.setDynamicProperty(MEAL_TOKEN, env.meal.token); duplicate.setDynamicProperty('ordertocook:restaurant_id', 'r');
  env.dimension.spawnEntity(DINING_ENTITY, { x: 2, y: 2, z: 2 });
  env.service.sweepOrphans();
  assert.equal(env.dimension.getEntities({ type: DINING_ENTITY }).length, 1);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  assert.equal(env.dimension.drops.length, 0);
});

test('invalid saved meal rows remain untouched instead of being silently discarded', () => {
  const env = fixture(); const bad = { id: 'bad', dimensionId: env.dimension.id, location: { x: 1, y: 1, z: 1 }, dueAt: 'broken' };
  env.restaurant.pendingDishes.push(bad); env.service.tick(NOW);
  assert.ok(env.restaurant.pendingDishes.includes(bad));
  assert.equal(env.service.cleanupRestaurant(env.restaurant), false);
  assert.ok(env.restaurant.pendingDishes.includes(bad));
});

test('supporting-table interaction resolves the oldest outstanding canonical plate', () => {
  const env = fixture();
  const support = place(env, 'minecraft:stone', { x: 0, y: 0, z: 1 });
  assert.equal(env.service.atBlock(support).meal, env.meal);
  assert.equal(env.service.atBlock(place(env, 'minecraft:stone', { x: 1, y: 0, z: 1 })), undefined);
  const sameLevel = { ...env.meal, id: 'same-level', token: 'same-level', location: { ...env.meal.location, y: 0.0125 } };
  env.restaurant.pendingDishes = [env.meal, sameLevel];
  assert.equal(env.service.atBlock(support).meal, env.meal, 'upper and same-cell ties retain array order');
  env.restaurant.pendingDishes = [sameLevel, env.meal];
  assert.equal(env.service.atBlock(support).meal, sameLevel, 'same-tick array replacement changes the authoritative tie');
  const other = { ...env.restaurant, id: 'other', pendingDishes: [{ ...sameLevel, id: 'other-meal' }] };
  env.restaurants.set(other.id, other);
  assert.equal(env.service.atBlock(support).restaurant, env.restaurant, 'restaurant enumeration order breaks an equal-time tie');
});

test('same-tick new meals, record replacement and removal bypass earlier location misses', () => {
  const env = fixture(), first = nativePlate(env);
  const elsewhere = place(env, DINING_BLOCK, { x: 3, y: 1, z: 1 });
  assert.equal(env.service.atBlock(elsewhere), undefined);
  const replacement = { ...env.restaurant, pendingDishes: [{ ...env.meal, location: { x: 3.5, y: 1.0125, z: 1.5 } }] };
  env.restaurants.set('r', replacement);
  assert.equal(env.service.atBlock(elsewhere).restaurant, replacement);
  assert.equal(env.service.atBlock(first, false), undefined);
  env.restaurants.set('r', env.restaurant);
  assert.equal(env.service.atBlock(first, false).meal, env.meal);
  const nextOrder = { ...env.order, id: 'r:next', meal: { ...env.order.meal, startedAt: NOW - 1 } };
  env.restaurant.orders.push(nextOrder);
  const next = env.service.queueMeal(env.restaurant, nextOrder, env.customer, NOW);
  assert.equal(env.service.atBlock(first, false).meal, next, 'queue invalidates an already-built same-tick index');
  env.restaurants.delete('r');
  assert.equal(env.service.atBlock(first, false), undefined);
});

test('native lookups index meals once per tick while still checking every current restaurant', () => {
  const env = makeEnvironment();
  let mealReads = 0, restaurantVisits = 0;
  const count = 80, perRestaurant = 10;
  for (let start = 0; start < count; start += perRestaurant) {
    const dishes = Array.from({ length: perRestaurant }, (_, offset) => {
      const id = start + offset;
      return { id: String(id), token: String(id), dimensionId: env.dimension.id, location: { x: id + 0.5, y: 1.0125, z: 0.5 },
        startedAt: NOW, finishAt: NOW + 5000, status: 'eating' };
    });
    env.restaurants.set(String(start), { id: String(start), pendingDishes: new Proxy(dishes, {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) mealReads++;
        return Reflect.get(target, key, receiver);
      }
    }) });
  }
  env.ctx.restaurants = () => ({
    *[Symbol.iterator]() { for (const restaurant of env.restaurants.values()) { restaurantVisits++; yield restaurant; } }
  });
  const service = createDiningService(env.ctx);
  for (let id = 0; id < count; id++) {
    const block = place(env, DINING_BLOCK, { x: id, y: 1, z: 0 });
    assert.equal(service.atBlock(block).meal.id, String(id));
  }
  assert.equal(mealReads, count, '80 queries read 80 meal rows, not 80 squared');
  assert.equal(restaurantVisits, count * (count / perRestaurant), 'the canonical restaurant pass remains P times R');
  env.system.currentTick++;
  assert.equal(service.atBlock(env.dimension.getBlock({ x: 0, y: 1, z: 0 })).meal.id, '0');
  assert.equal(mealReads, count * 2, 'the next native tick rebuilds from canonical meals');
  delete env.ctx.system;
  service.atBlock(env.dimension.getBlock({ x: 0, y: 1, z: 0 }));
  service.atBlock(env.dimension.getBlock({ x: 0, y: 1, z: 0 }));
  assert.equal(mealReads, count * 4, 'without a tick clock each query stays uncached');
});

test('settled dirty plates avoid customer scans while unresolved reactions and bonuses still retry', () => {
  const env = fixture();
  const entities = entityServices.createEntityService(env.ctx);
  env.ctx.resumeCustomerMeal = (...args) => entities.resumeCustomerMeal(...args);
  let customerQueries = 0;
  const getDimension = env.world.getDimension.bind(env.world);
  env.world.getDimension = id => {
    const dimension = getDimension(id);
    return { ...dimension, getEntities: options => {
      if (options.type === 'ordertocook:customer') customerQueries++;
      return dimension.getEntities(options);
    } };
  };
  env.meal.reactionPending = false;
  env.service.tick(NOW + 5000);
  env.service.tick(NOW + 5250);
  assert.equal(customerQueries, 0);
  assert.equal(nativeStage(env), 32); assert.equal(env.restaurant.pendingDishes.length, 1);
  assert.equal(dirtyCount(env.player), 0);
  for (const state of [undefined, true]) {
    env.meal.reactionPending = state;
    env.service.tick(NOW + 5300);
  }
  env.meal.reactionPending = false; env.meal.bonusPlayerId = env.player.id;
  env.service.tick(NOW + 5400);
  assert.equal(customerQueries, 9, 'each of three unresolved states still queries all three dimensions');
});

test('native block removal drops once without the use-only early interruption or inventory writes', () => {
  const env = fixture(); env.service.tick(NOW + 1000);
  const block = nativePlate(env); block.setType('minecraft:air');
  assert.equal(env.service.removeBlock(block, NOW + 1000), true);
  assert.equal(env.service.removeBlock(block, NOW + 1000), false);
  assert.equal(dirtyCount(env.player), 0); assert.equal(env.dimension.drops.length, 1);
  assert.equal(env.order.meal.action, 6); assert.equal(env.interrupted.length, 0);
  const restored = structuredClone(env.snapshots.get('r')); env.restaurants.set('r', restored);
  createDiningService(env.ctx).tick(NOW + 1600);
  assert.equal(restored.pendingDishes.length, 0); assert.equal(env.dimension.drops.length, 1);
});

test('dropped player claims retry only a verified failed spawn and retain state if writing is uncertain', () => {
  for (const uncertain of [false, true]) {
    const env = fixture(), query = env.dimension.getEntities;
    let queries = 0;
    for (let slot = 0; slot < env.player.container.size; slot++) env.player.container.setItem(slot, new FakeItem('minecraft:stone', 64));
    env.dimension.spawnItem = () => { throw Error('native spawn failure'); };
    env.dimension.getEntities = options => {
      if (options.type === 'minecraft:item' && ++queries > 1 && uncertain) throw Error('readback unavailable');
      return query.call(env.dimension, options);
    };
    assert.throws(() => env.service.claim(env.player, env.restaurant, env.meal, NOW + 1000));
    assert.equal(env.meal.status, uncertain ? 'claiming' : 'eating');
    assert.equal(env.dimension.drops.length, 0); assert.equal(env.interrupted.length, 0);
  }
});

test('native stackable-item restriction cannot prevent restaurant removal from returning a plain plate', () => {
  const env = fixture();
  env.ctx.ItemStack = class extends FakeItem {
    setDynamicProperty() { throw Error('stackable item cannot carry dynamic properties'); }
  };
  assert.equal(env.service.cleanupRestaurant(env.restaurant), true);
  assert.equal(env.dimension.drops.length, 1); assert.equal(env.dimension.drops[0].stack.amount, 1);
  assert.deepEqual(env.dimension.drops[0].stack.getDynamicPropertyIds(), []);
});

test('old helper-backed meals gain native blocks without changing identity or stored data', () => {
  const env = fixture(); env.meal.extra = { marker: 'saved value' };
  const old = env.dimension.spawnEntity(DINING_ENTITY, env.meal.location);
  old.setDynamicProperty(MEAL_TOKEN, env.meal.token); env.meal.visualEntityId = old.id;
  env.ctx.saveRestaurant(env.restaurant);
  const saved = structuredClone(env.snapshots.get('r')); env.restaurants.set('r', saved);
  createDiningService(env.ctx).tick(NOW + 6000);
  assert.equal(old.isValid, false); assert.equal(nativePlate(env).typeId, DINING_BLOCK);
  assert.equal(saved.pendingDishes[0].token, env.meal.token);
  assert.deepEqual(saved.pendingDishes[0].extra, { marker: 'saved value' });
  assert.equal(env.dimension.drops.length, 0);
});

test('native reconciliation preserves a replacement player block and waits for a clear anchor', () => {
  const env = fixture(), block = nativePlate(env); block.setType('minecraft:chest');
  env.service.tick(NOW + 6000); assert.equal(block.typeId, 'minecraft:chest');
  assert.equal(env.restaurant.pendingDishes.length, 1); assert.equal(env.dimension.drops.length, 0);
  block.setType('minecraft:air'); env.service.tick(NOW + 6100);
  assert.equal(block.typeId, DINING_BLOCK);
});

test('a native plate occupied by another restaurant rejects a second meal at that anchor', () => {
  const env = fixture(); env.service.tick(NOW + 1000);
  const second = { ...env.restaurant, id: 'other', orders: [], pendingDishes: [] };
  env.restaurants.set(second.id, second);
  assert.equal(env.service.hasVacancy(second, env.customer), false);
});

test('native food callbacks, not wall time or restaurant scans, own the saved 100-tick clock', () => {
  const env = fixture(); env.meal.clock = 'loaded'; env.meal.reactionPending = true;
  env.service.tick(NOW); const block = nativePlate(env);
  env.service.tick(NOW + 600000); assert.equal(nativeStage(env), 0);
  for (let i = 0; i < 15; i++) env.service.tickFood(block, NOW + 600000);
  assert.equal(nativeStage(env), 29);
  const restarted = createDiningService(env.ctx); restarted.tick(NOW + 1200000);
  assert.equal(nativeStage(env), 29);
  for (let i = 15; i < 100; i++) restarted.tickFood(block, NOW + 1200000);
  assert.equal(nativeStage(env), 32); assert.equal(env.meal.status, 'dirty');
  assert.equal(env.meal.reactionPending, true);
  restarted.finishReaction('r', env.order.id);
  assert.equal(restarted.claim(env.player, env.restaurant, env.meal).early, false);
  assert.equal(env.world.getDynamicProperty('ordertocook:food_tick:' + env.meal.token), undefined);
  assert.equal(dirtyCount(env.player), 1); assert.equal(env.restaurant.pendingDishes.length, 0);
});
