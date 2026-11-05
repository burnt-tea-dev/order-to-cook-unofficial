// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, balance, itemCount } from './main.harness.js';
import { place } from './appliances.harness.js';
import { mealStage } from '../runtime/BP/scripts/dining.js';

async function delivered() {
  const env = await mainFixture(); env.restaurant.level = 2; env.store.saveRestaurant(env.restaurant);
  let index = 0; const rolls = [0.9999, 0.05, 0.9999];
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => rolls[index++] });
  return { ...env, meal: env.restaurant.pendingDishes[0], initial: balance(env.player) };
}

test('boom coins, restaurant income and personal earnings arrive only at the six-second finish', async () => {
  const env = await delivered(); const { meal, initial } = env;
  assert.equal(meal.boomBonus, 6); assert.equal(balance(env.player), env.order.reward);
  assert.equal(env.restaurant.stats.earnings, initial);
  env.hooks.dining.tick(meal.finishAt - 1);
  assert.equal(balance(env.player), initial);
  env.hooks.dining.tick(meal.finishAt);
  assert.equal(balance(env.player), initial + 6);
  assert.equal(env.order.paidReward, initial + 6);
  assert.equal(env.restaurant.stats.earnings, initial + 6);
  assert.equal(env.hooks.progression.getState(env.player.id).totals.earned, initial + 6);
  assert.equal(env.restaurant.stats.completed, 1);
  env.hooks.dining.tick(meal.finishAt + 5000);
  assert.equal(balance(env.player), initial + 6); assert.equal(env.world.messages.length, 1);
});

test('pickup before the dirty stage interrupts and cancels only the pending extra reward', async () => {
  const env = await delivered();
  assert.equal(env.hooks.dining.claim(env.player, env.restaurant, env.meal, env.meal.startedAt + 1000).early, true);
  env.hooks.dining.tick(env.order.completion.finishAt + 1);
  assert.equal(balance(env.player), env.initial); assert.equal(env.restaurant.stats.earnings, env.initial);
  assert.equal(itemCount(env.player, 'ordertocook:dirty_plate'), 1);
  assert.equal(env.restaurant.pendingDishes.length, 0);
});

test('pickup after five seconds returns a plate while retaining the original six-second reward', async () => {
  const env = await delivered(); const end = env.meal.finishAt;
  assert.equal(env.hooks.dining.claim(env.player, env.restaurant, env.meal, env.meal.startedAt + 5000).early, false);
  assert.equal(env.restaurant.pendingDishes.length, 1);
  env.hooks.dining.tick(end - 1); assert.equal(balance(env.player), env.initial);
  env.hooks.dining.tick(end);
  assert.equal(balance(env.player), env.initial + 6); assert.equal(env.restaurant.pendingDishes.length, 0);
  assert.equal(itemCount(env.player, 'ordertocook:dirty_plate'), 1);
});

test('native plate removal does not cancel the customer bonus', async () => {
  const env = await delivered(); const { meal } = env;
  const block = env.dimension.getBlock({ x: Math.floor(meal.location.x), y: Math.floor(meal.location.y), z: Math.floor(meal.location.z) });
  env.hooks.dining.removeBlock(block, meal.startedAt + 1000);
  env.hooks.dining.tick(meal.finishAt);
  assert.equal(balance(env.player), env.initial + 6); assert.equal(env.restaurant.pendingDishes.length, 0);
});

test('disconnected recipient earns no personal coins or progress; restaurant still receives its bonus once', async () => {
  const env = await delivered(); env.world.players.length = 0;
  env.hooks.dining.tick(env.meal.finishAt);
  assert.equal(balance(env.player), env.initial);
  assert.equal(env.hooks.progression.getState(env.player.id).totals.earned, env.initial);
  assert.equal(env.restaurant.stats.earnings, env.initial + 6);
  env.world.players.push(env.player); env.hooks.dining.tick(env.meal.finishAt + 1);
  assert.equal(balance(env.player), env.initial); assert.equal(env.world.messages.length, 1);
});

test('pending bonus survives order-history pruning and restaurant reload without replaying completion', async () => {
  const env = await delivered(); const id = env.player.id; const end = env.meal.finishAt;
  env.restaurant.orders = []; env.store.saveRestaurant(env.restaurant);
  const resumed = await mainFixture([...env.properties]); resumed.player.id = id;
  const restaurant = resumed.store.getRestaurant(env.restaurant.id);
  assert.equal(restaurant.pendingDishes[0].bonusPlayerId, id);
  resumed.hooks.dining.tick(end);
  assert.equal(balance(resumed.player), 6);
  assert.equal(restaurant.stats.completed, 1); assert.equal(restaurant.stats.earnings, env.initial + 6);
  resumed.hooks.dining.tick(end + 1); assert.equal(balance(resumed.player), 6);
});

test('a failed restaurant save leaves the bonus unpaid and retries from restored canonical state', async () => {
  const env = await delivered(); env.failWrite(id => id === `ordertocook:r:${env.restaurant.id}`);
  env.hooks.dining.tick(env.meal.finishAt);
  const restored = env.store.getRestaurant(env.restaurant.id);
  assert.equal(balance(env.player), env.initial); assert.equal(restored.stats.earnings, env.initial);
  assert.equal(restored.pendingDishes[0].bonusPlayerId, env.player.id);
  env.hooks.dining.tick(env.meal.finishAt + 1);
  assert.equal(balance(env.player), env.initial + 6);
});

test('failed early plate output restores its pending bonus with the original action', async () => {
  const env = await delivered();
  env.player.container.failNextSlot = Array.from({ length: env.player.container.size }, (_, slot) => slot).find(slot => !env.player.container.getItem(slot));
  assert.throws(() => env.hooks.dining.claim(env.player, env.restaurant, env.meal, env.meal.startedAt + 1000));
  assert.equal(env.meal.action, 5); assert.equal(env.meal.bonusPlayerId, env.player.id);
  env.hooks.dining.tick(env.meal.finishAt); assert.equal(balance(env.player), env.initial + 6);
});

test('legacy already-paid meal has no pending marker and cannot pay again', async () => {
  const env = await delivered(); delete env.meal.bonusPlayerId; env.store.saveRestaurant(env.restaurant);
  env.hooks.dining.tick(env.meal.finishAt);
  assert.equal(balance(env.player), env.initial); assert.equal(env.restaurant.stats.earnings, env.initial);
});

 test('an unloaded meal waits for its anchor before settling the reward', async () => {
  const env = await delivered(); const getBlock = env.dimension.getBlock.bind(env.dimension);
  env.dimension.getBlock = () => { throw Error('unloaded chunk'); };
  env.hooks.dining.tick(env.meal.finishAt); assert.equal(balance(env.player), env.initial);
  env.dimension.getBlock = getBlock; env.hooks.dining.tick(env.meal.finishAt + 1);
  assert.equal(balance(env.player), env.initial + 6);
});

async function anotherMeal(env) {
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => .9999);
  env.core.acceptOrder(env.restaurant, order.id); env.core.packOrder(env.restaurant, order.id);
  order.proof = 'second-meal-proof';
  const customer = env.dimension.spawnEntity('ordertocook:customer', { x: 4.5, y: .5625, z: 2.5 });
  customer.setDynamicProperty('ordertocook:restaurant_id', env.restaurant.id);
  customer.setDynamicProperty('ordertocook:order_id', order.id);
  customer.qaChair = place(env, 'ordertocook:chair', { x: 4, y: 0, z: 2 }, { 'minecraft:cardinal_direction': 'south' });
  const seat = env.dimension.spawnEntity('ordertocook:seat', customer.location);
  seat.getComponent('minecraft:rideable').addRider(customer);
  env.store.saveRestaurant(env.restaurant);
  env.player.container.setItem(4, env.hooks.parcelFor(env.restaurant, order)); env.player.selectedSlotIndex = 4;
  let index = 0; const rolls = [.9999, .05, .9999];
  env.hooks.customerInteract(env.player, customer, { restaurantId: env.restaurant.id, orderId: order.id }, { rng: () => rolls[index++] });
  return { order, customer, meal: env.restaurant.pendingDishes.find(value => value.id === order.id) };
}

test('early pickup interrupts the first nearby eating customer, not the plate order, and preserves that other plate age', async () => {
  const env = await delivered(), second = await anotherMeal(env);
  const foodStart = env.meal.startedAt, at = second.meal.startedAt + 2000;
  env.hooks.dining.claim(env.player, env.restaurant, second.meal, at);
  assert.equal(env.meal.action, 7); assert.equal(env.meal.bonusPlayerId, undefined);
  assert.equal(second.meal.action, 5); assert.equal(second.meal.bonusPlayerId, env.player.id);
  assert.equal(env.meal.foodStartedAt, foodStart); assert.equal(mealStage(env.meal, at), 13);
  const before = balance(env.player);
  env.hooks.dining.tick(second.order.completion.finishAt);
  assert.equal(balance(env.player), before + 6);
});

test('taking a plate without a nearby eating customer does not cancel its distant customer bonus', async () => {
  const env = await delivered(); env.customer.location = { x: 50, y: 0, z: 50 };
  env.hooks.dining.claim(env.player, env.restaurant, env.meal, env.meal.startedAt + 1000);
  assert.equal(env.meal.action, 5); assert.equal(env.meal.bonusPlayerId, env.player.id);
  assert.equal(env.interruptions.length, 0);
  env.hooks.dining.tick(env.meal.finishAt); assert.equal(balance(env.player), env.initial + 6);
});

 test('native cuboid corners can select an eating customer beyond three blocks in spherical distance', async () => {
  const env = await delivered(), second = await anotherMeal(env), block = second.meal.location;
  env.customer.location = { x: Math.floor(block.x) + 3.5, y: 0, z: Math.floor(block.z) + 3.5 };
  env.hooks.dining.claim(env.player, env.restaurant, second.meal, second.meal.startedAt + 1000);
  assert.equal(env.meal.action, 7); assert.equal(second.meal.action, 5);
});

 test('waiting customer is skipped while the first eating customer is interrupted', async () => {
  const env = await delivered(), second = await anotherMeal(env);
  const waiting = env.dimension.spawnEntity('ordertocook:customer', { x: 3.5, y: 0, z: 2.5 });
  waiting.setProperty('ordertocook:action', 0);
  env.dimension.entities = new Map([[waiting.id, waiting], ...env.dimension.entities]);
  env.hooks.dining.claim(env.player, env.restaurant, second.meal, second.meal.startedAt + 1000);
  assert.equal(env.meal.action, 7); assert.equal(second.meal.action, 5);
});

 test('the committed eating reaction wins over the same-tick stale native visual property', async () => {
  const env = await delivered(); env.customer.setProperty('ordertocook:action', 0);
  env.hooks.dining.claim(env.player, env.restaurant, env.meal, env.meal.startedAt + 1);
  assert.equal(env.meal.action, 7); assert.equal(env.meal.bonusPlayerId, undefined);
});

 test('a customer whose dirty plate was already collected still keeps a nearby interruption in its order', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const env = await mainFixture();
  env.hooks.customerInteract(env.player, env.customer, env.linkage, { rng: () => .9999 });
  const old = env.restaurant.pendingDishes[0]; now += 5000;
  env.hooks.dining.claim(env.player, env.restaurant, old, now);
  assert.equal(env.restaurant.pendingDishes.length, 0);
  const second = await anotherMeal(env);
  env.hooks.dining.claim(env.player, env.restaurant, second.meal, now + 1);
  assert.equal(env.order.meal.action, 7); assert.equal(env.order.meal.finishAt, now + 501);
  assert.equal(second.meal.action, 5);
});

 test('a preserved malformed legacy row does not block interruption of a valid nearby meal', async () => {
  const env = await delivered(); env.restaurant.pendingDishes.unshift(null); env.store.saveRestaurant(env.restaurant);
  env.hooks.dining.claim(env.player, env.restaurant, env.meal, env.meal.startedAt + 1000);
  assert.equal(env.meal.action, 7); assert.equal(env.meal.bonusPlayerId, undefined);
  assert.equal(env.restaurant.pendingDishes[0], null);
});
