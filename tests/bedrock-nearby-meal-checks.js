// SPDX-License-Identifier: GPL-3.0-only
// Isolated BDS observer: real native inventory, adapter handoff, same-world restart.
import { world, system, GameMode } from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import { getQaHooks } from './main.js';
import { generateOrder, acceptOrder, packOrder } from './core.js';
import { getRestaurant, saveRestaurant } from './store.js';
const KEY = 'ordertocook:qa_nearby_meal';
const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== KEY || running) return; running = true;
  run(event.message).catch(error => console.error('OTC_NEARBY_MEAL_FATAL ' + String(error) + ' ' + error?.stack));
});
async function run(mode) {
  const dimension = world.getDimension('overworld'), hooks = getQaHooks(), checks = [];
  const check = (name, ok) => { checks.push({ name, passed: !!ok }); console.warn('OTC_NEARBY_MEAL_CHECK ' + JSON.stringify(checks.at(-1))); if (!ok) throw Error(name); };
  const raw = world.getDynamicProperty(KEY), saved = raw ? JSON.parse(raw) : undefined;
  const phase = saved ? 'restart' : 'first'; let player, completed = false; const players = [];
  const money = who => {
    const inventory = who.getComponent('minecraft:inventory').container; let amount = 0;
    for (let slot = 0; slot < inventory.size; slot++) {
      const stack = inventory.getItem(slot), match = stack?.typeId.match(/^ordertocook:chef_coin_(\d+)$/);
      if (match) amount += Number(match[1]) * stack.amount;
    }
    return amount;
  };
  const due = async meal => { while (Date.now() < meal.finishAt + 400) await wait(5); };
  const deliver = (index, name, customerX, scenario = {}) => {
    const x = index * 8;
    const machine = dimension.getBlock({ x, y: 5, z: 0 }); machine.setType('ordertocook:order_machine');
    player = gameTest.spawnSimulatedPlayer({ dimension, x: x + 1.5, y: 5, z: 1.5 }, name, GameMode.Survival);
    players.push(player); player.setDynamicProperty('ordertocook:welcomed', true);
    const inventory = player.getComponent('minecraft:inventory').container; inventory.clearAll();
    const restaurant = hooks.getMachine(player, machine); restaurant.level = 2;
    restaurant.menu = [{ typeId: 'minecraft:bread', label: 'Bread', nutrition: 5 }];
    restaurant.config = { ...restaurant.config, deliveryRate: 0, tipNormalChance: 0, tipUrgentChance: 0 };
    const now = Date.now(), order = generateOrder(restaurant, now, () => .9999);
    acceptOrder(restaurant, order.id, now); packOrder(restaurant, order.id, now);
    order.proof = 'isolated-bonus-' + index; saveRestaurant(restaurant);
    if (customerX !== undefined) player.teleport({ x: customerX + 1, y: 5, z: 1.5 });
    const customer = dimension.spawnEntity('ordertocook:customer', { x: customerX ?? x + 2.5, y: 5.5625, z: .5 });
    customer.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
    customer.setDynamicProperty('ordertocook:order_id', order.id); order.customerEntityId = customer.id;
    if (scenario.seated !== false) {
      const seat = dimension.spawnEntity('ordertocook:seat', customer.location);
      seat.getComponent('minecraft:rideable').addRider(customer);
    }
    inventory.setItem(0, hooks.parcelFor(restaurant, order)); player.selectedSlotIndex = 0;
    let cursor = 0; const rolls = [.9999, scenario.reaction ?? .05, .9999];
    hooks.customerInteract(player, customer, { restaurantId: restaurant.id, orderId: order.id }, { rng: () => rolls[cursor++] });
    const meal = restaurant.pendingDishes[0];
    check(name + ' selected its original reaction and paid only the base', order.status === 'completed' && meal.action === (scenario.action ?? 5) && meal.boomBonus === (scenario.bonus ?? 6) && money(player) === order.reward && restaurant.stats.earnings === order.reward);
    return { restaurant, order, meal, customer, who: player, initial: money(player) };
  };
  try {
    check('production entry initialized', hooks.ready);
    if (phase === 'first') {
      dimension.runCommand('fill 45 4 -3 95 4 5 stone'); dimension.runCommand('fill 45 5 -3 95 9 5 air');
      if (mode !== 'refine') {
      dimension.runCommand('fill -3 4 -3 44 4 5 stone'); dimension.runCommand('fill -3 5 -3 44 9 5 air');
      const normal = deliver(0, 'BonusOnline');
      while (Date.now() < normal.meal.startedAt + 5100) await wait(5);
      check('five seconds do not pay the bonus', money(player) === normal.initial);
      check('dirty plate pickup preserves the pending extra payment', !hooks.dining.claim(player, normal.restaurant, normal.meal).early && normal.restaurant.pendingDishes.includes(normal.meal));
      await due(normal.meal);
      check('six-second completion pays native coins and personal earnings once', money(player) === normal.initial + 6 && normal.restaurant.stats.earnings === normal.initial + 6 && hooks.progression.getState(player.id).totals.earned === normal.initial + 6);
      hooks.dining.tick(); check('completed payment is not replayed', money(player) === normal.initial + 6);
      player.disconnect(); player = undefined; await wait(3);
      const early = deliver(1, 'BonusInterrupted');
      console.warn('OTC_NEARBY_MEAL_IMMEDIATE ' + JSON.stringify({ nativeAction: early.customer.getProperty('ordertocook:action'), savedAction: early.meal.action }));
      check('early native plate output interrupts the meal', hooks.dining.claim(player, early.restaurant, early.meal).early);
      await due(early.order.completion);
      check('interrupted meal gives no extra coins or income', money(player) === early.initial && early.restaurant.stats.earnings === early.initial);
      player.disconnect(); player = undefined; await wait(3);
      const offline = deliver(2, 'BonusOffline');
      player.disconnect(); player = undefined; await due(offline.meal);
      check('offline recipient still credits restaurant income', offline.restaurant.stats.earnings === offline.initial + 6 && !offline.meal.bonusPlayerId);
      }
      const a = deliver(7, 'AdjacentA17'), b = deliver(8, 'AdjacentB17', 60.5);
      await wait(22);
      const floor = meal => ({ x: Math.floor(meal.location.x), y: Math.floor(meal.location.y), z: Math.floor(meal.location.z) });
      const box = meal => { const p = floor(meal); return { type: 'ordertocook:customer', location: { x: p.x - 3, y: p.y - 3, z: p.z - 3 }, volume: { x: 6, y: 6, z: 6 } }; };
      const first = dimension.getEntities(box(a.meal)).find(actor => [5, 6, 7].includes(Number(actor.getProperty('ordertocook:action'))));
      const affected = first.id === a.customer.id ? a : b, taken = affected === a ? b : a;
      check('native query selects one of two adjacent eating customers', [a.customer.id, b.customer.id].includes(first.id));
      check('other plate query has the same first native target', dimension.getEntities(box(taken.meal)).find(actor => [5, 6, 7].includes(Number(actor.getProperty('ordertocook:action'))))?.id === affected.customer.id);
      const foodStart = affected.meal.foodStartedAt;
      check('early pickup of the other plate succeeds', hooks.dining.claim(taken.who, taken.restaurant, taken.meal).early);
      check('only native-selected customer loses its pending bonus', affected.meal.action === 7 && !affected.meal.bonusPlayerId && taken.meal.action === 5 && taken.meal.bonusPlayerId === taken.who.id);
      await wait(1);
      check('targeted interruption does not alter the other native actor', affected.customer.getProperty('ordertocook:action') === 7 && taken.customer.getProperty('ordertocook:action') === 5);
      await wait(12); hooks.dining.tick();
      const food = dimension.getBlock(floor(affected.meal));
      check('the other plate retains its original food age and stage', affected.meal.foodStartedAt === foodStart && food.typeId === 'ordertocook:dining_plate_block' && Number(food.permutation.getState('ordertocook:stage')) === 1);
      await due(taken.meal);
      check('only the un-interrupted customer pays its selected native bonus', money(affected.who) === affected.initial && money(taken.who) === taken.initial + 6);
      a.who.disconnect(); b.who.disconnect(); player = undefined; await wait(3);
      const query = { type: 'ordertocook:customer', location: { x: 47, y: 2, z: -3 }, volume: { x: 6, y: 6, z: 6 } };
      const body = dimension.spawnEntity('ordertocook:customer', { x: 53.5, y: 5, z: 3.5 });
      check('native cuboid includes the diagonal corner beyond a three-block sphere', dimension.getEntities(query).some(actor => actor.id === body.id));
      body.teleport({ x: 54.2, y: 5, z: 0 }); await wait(1);
      const overlapping = dimension.getEntities(query).some(actor => actor.id === body.id);
      body.teleport({ x: 54.4, y: 5, z: 0 }); await wait(1);
      const outside = dimension.getEntities(query).some(actor => actor.id === body.id);
      console.warn('OTC_NEARBY_MEAL_VOLUME ' + JSON.stringify({ overlapping, outside }));
      check('native query uses body intersection at the inflated-box edge', overlapping && !outside);
      body.remove();
      const collected = deliver(9, 'CollectedPlate17', undefined, { action: 6, bonus: 0, reaction: .9999 });
      while (Date.now() < collected.meal.foodStartedAt + 5050) await wait(1);
      check('dirty pickup removes a non-bonus plate while its customer still eats', !hooks.dining.claim(collected.who, collected.restaurant, collected.meal).early && collected.restaurant.pendingDishes.length === 0 && collected.customer.isValid);
      const standing = deliver(10, 'StandingNeighbor17', 76.5, { action: 4, bonus: 0, seated: false });
      const outcome = hooks.dining.claim(standing.who, standing.restaurant, standing.meal);
      check('a nearby customer without a pending plate still saves its interruption', outcome.early && collected.order.meal.action === 7 && standing.meal.action === 4);
      await wait(1);
      check('selected plate-less native customer enters interruption', collected.customer.getProperty('ordertocook:action') === 7 && standing.customer.getProperty('ordertocook:action') === 4);
      collected.who.disconnect(); standing.who.disconnect(); player = undefined; await wait(3);
      const pending = deliver(3, 'BonusRestart');
      world.setDynamicProperty(KEY, JSON.stringify({ restaurant: pending.restaurant.id, order: pending.order.id, initial: pending.initial, payee: player.id, finishAt: pending.meal.finishAt }));
      check('unpaid bonus is saved before shutdown', pending.meal.bonusPlayerId === player.id && Date.now() < pending.meal.finishAt);
      completed = true;
    } else {
      const restaurant = getRestaurant(saved.restaurant);
      while (Date.now() < saved.finishAt + 500) await wait(5);
      hooks.dining.tick();
      const order = restaurant.orders.find(value => value.id === saved.order);
      const meal = restaurant.pendingDishes.find(value => value.id === saved.order);
      check('pending restaurant bonus survives disk restart and settles once', restaurant.stats.earnings === saved.initial + 6 && !meal.bonusPlayerId);
      check('offline restart does not credit personal progress', hooks.progression.getState(saved.payee).totals.earned === saved.initial && order.paidReward === saved.initial);
      hooks.dining.tick(); check('restart payment cannot repeat', restaurant.stats.earnings === saved.initial + 6);
      world.setDynamicProperty(KEY, undefined); completed = true;
    }
  } finally {
    for (const value of players) try { value.disconnect(); } catch {} await wait(3);
    if (completed) {
      check('QA players disconnected', world.getAllPlayers().length === 0);
      console.warn('OTC_NEARBY_MEAL_RESULT ' + JSON.stringify({ passed: true, phase, mode, checks, playersAfter: world.getAllPlayers().length, scope: 'Native cuboid/body bounds, two adjacent restaurant customers and real coin inventories; production handoff/plate adapters and same-world restart. No client rendering or hardware-input verdict; existing wall-clock timing remains.' }));
    }
  }
}
