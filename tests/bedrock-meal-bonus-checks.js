// SPDX-License-Identifier: GPL-3.0-only
// Isolated BDS observer: real native inventory, adapter handoff, same-world restart.
import { world, system, GameMode } from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import { getQaHooks } from './main.js';
import { generateOrder, acceptOrder, packOrder } from './core.js';
import { getRestaurant, saveRestaurant } from './store.js';
const KEY = 'ordertocook:qa_meal_bonus';
const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== KEY || running) return; running = true;
  run().catch(error => console.error('OTC_MEAL_BONUS_FATAL ' + String(error) + ' ' + error?.stack));
});
async function run() {
  const dimension = world.getDimension('overworld'), hooks = getQaHooks(), checks = [];
  const check = (name, ok) => { checks.push({ name, passed: !!ok }); console.warn('OTC_MEAL_BONUS_CHECK ' + JSON.stringify(checks.at(-1))); if (!ok) throw Error(name); };
  const raw = world.getDynamicProperty(KEY), saved = raw ? JSON.parse(raw) : undefined;
  const phase = saved ? 'restart' : 'first'; let player, completed = false;
  const money = who => {
    const inventory = who.getComponent('minecraft:inventory').container; let amount = 0;
    for (let slot = 0; slot < inventory.size; slot++) {
      const stack = inventory.getItem(slot), match = stack?.typeId.match(/^ordertocook:chef_coin_(\d+)$/);
      if (match) amount += Number(match[1]) * stack.amount;
    }
    return amount;
  };
  const due = async meal => { while (Date.now() < meal.finishAt + 400) await wait(5); };
  const deliver = (index, name) => {
    const x = index * 8;
    const machine = dimension.getBlock({ x, y: 5, z: 0 }); machine.setType('ordertocook:order_machine');
    player = gameTest.spawnSimulatedPlayer({ dimension, x: x + 1.5, y: 5, z: 1.5 }, name, GameMode.Survival);
    player.setDynamicProperty('ordertocook:welcomed', true);
    const inventory = player.getComponent('minecraft:inventory').container; inventory.clearAll();
    const restaurant = hooks.getMachine(player, machine); restaurant.level = 2;
    restaurant.menu = [{ typeId: 'minecraft:bread', label: 'Bread', nutrition: 5 }];
    restaurant.config = { ...restaurant.config, deliveryRate: 0, tipNormalChance: 0, tipUrgentChance: 0 };
    const now = Date.now(), order = generateOrder(restaurant, now, () => .9999);
    acceptOrder(restaurant, order.id, now); packOrder(restaurant, order.id, now);
    order.proof = 'isolated-bonus-' + index; saveRestaurant(restaurant);
    const customer = dimension.spawnEntity('ordertocook:customer', { x: x + 2.5, y: 5.5625, z: .5 });
    customer.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
    customer.setDynamicProperty('ordertocook:order_id', order.id); order.customerEntityId = customer.id;
    const seat = dimension.spawnEntity('ordertocook:seat', customer.location);
    seat.getComponent('minecraft:rideable').addRider(customer);
    inventory.setItem(0, hooks.parcelFor(restaurant, order)); player.selectedSlotIndex = 0;
    let cursor = 0; const rolls = [.9999, .05, .9999];
    hooks.customerInteract(player, customer, { restaurantId: restaurant.id, orderId: order.id }, { rng: () => rolls[cursor++] });
    const meal = restaurant.pendingDishes[0];
    check(name + ' selected one six-second bonus and paid only the base', order.status === 'completed' && meal.action === 5 && meal.boomBonus === 6 && money(player) === order.reward && restaurant.stats.earnings === order.reward);
    return { restaurant, order, meal, initial: money(player) };
  };
  try {
    check('production entry initialized', hooks.ready);
    if (phase === 'first') {
      dimension.runCommand('fill -3 4 -3 29 4 5 stone'); dimension.runCommand('fill -3 5 -3 29 9 5 air');
      const normal = deliver(0, 'BonusOnline');
      while (Date.now() < normal.meal.startedAt + 5100) await wait(5);
      check('five seconds do not pay the bonus', money(player) === normal.initial);
      check('dirty plate pickup preserves the pending extra payment', !hooks.dining.claim(player, normal.restaurant, normal.meal).early && normal.restaurant.pendingDishes.includes(normal.meal));
      await due(normal.meal);
      check('six-second completion pays native coins and personal earnings once', money(player) === normal.initial + 6 && normal.restaurant.stats.earnings === normal.initial + 6 && hooks.progression.getState(player.id).totals.earned === normal.initial + 6);
      hooks.dining.tick(); check('completed payment is not replayed', money(player) === normal.initial + 6);
      player.disconnect(); player = undefined; await wait(3);
      const early = deliver(1, 'BonusInterrupted');
      check('early native plate output interrupts the meal', hooks.dining.claim(player, early.restaurant, early.meal).early);
      await due(early.order.completion);
      check('interrupted meal gives no extra coins or income', money(player) === early.initial && early.restaurant.stats.earnings === early.initial);
      player.disconnect(); player = undefined; await wait(3);
      const offline = deliver(2, 'BonusOffline');
      player.disconnect(); player = undefined; await due(offline.meal);
      check('offline recipient still credits restaurant income', offline.restaurant.stats.earnings === offline.initial + 6 && !offline.meal.bonusPlayerId);
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
    try { player?.disconnect(); } catch {} await wait(3);
    if (completed) {
      check('QA players disconnected', world.getAllPlayers().length === 0);
      console.warn('OTC_MEAL_BONUS_RESULT ' + JSON.stringify({ passed: true, phase, checks, playersAfter: world.getAllPlayers().length, scope: 'Real native inventories and simulated Player recipients; production handoff/plate adapters and same-world restart. No client rendering or hardware-input verdict; existing wall-clock timing remains.' }));
    }
  }
}
