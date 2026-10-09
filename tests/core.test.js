// SPDX-License-Identifier: GPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRestaurant, normalizeMenu, normalizeFoodId, getMenuNutrition,
  addMenuFood, removeMenuFood, getUnlockedSlots, getUpgradeQuote, upgradeRestaurant,
  getEffectiveBenefitLevel, getTierWeights, calculateReward, generateOrder,
  generateWalkInOrder, refreshOrders, synchronizeOfferRewards,
  acceptOrder, packOrder, completeOrder, cancelOrder, expireOrders, rollTip, splitCoins
} from "../runtime/BP/scripts/core.js";
import { DEFAULT_CONFIG, VANILLA_FOODS, DEFAULT_MENU } from "../runtime/BP/scripts/config.js";

const NOW = 1_800_000_000_000;
const noTip = { rng: () => 0.9999 };
const restaurant = spec => createRestaurant({
  id: "test-restaurant", ownerId: "test-player", ownerName: "廚師",
  location: { x: 10, y: 64, z: -20 }, ...spec
}, NOW);
const rolls = (...values) => {
  let cursor = 0;
  return () => values[Math.min(cursor++, values.length - 1)] ?? 0.9999;
};
const richMenu = [{ typeId: "test:feast", nutrition: 600, label: "測試宴席" }];
function packed(r, now = NOW) {
  const order = generateOrder(r, now, () => 0.5);
  assert.equal(acceptOrder(r, order.id, now + 1).ok, true);
  assert.equal(packOrder(r, order.id, now + 2).ok, true);
  return order;
}

test("new restaurants start closed at level zero with four upstream starter dishes", () => {
  const r = restaurant();
  assert.equal(r.level, 0);
  assert.equal(r.active, false);
  assert.equal(r.menu.length, 4);
  assert.equal(getMenuNutrition(r), 25);
  assert.equal(r.nextRefreshAt, NOW + 600000);
  assert.equal(r.nextWalkInAt, NOW + 60000);
  assert.equal(r.stats.completed, 0);
  assert.deepEqual(r.orders, []);
  assert.equal(getUpgradeQuote(r).reason, "menu_nutrition");
});

test("restaurant menus and config copies cannot modify another restaurant or defaults", () => {
  const settings = { defaultCoinArray: [10, 20, 30, 40, 60] };
  const a = restaurant({ config: settings });
  const b = restaurant();
  a.menu[0].nutrition = 999;
  a.config.defaultCoinArray[0] = 999;
  assert.equal(getMenuNutrition(b), 25);
  assert.equal(DEFAULT_MENU[0].nutrition, 8);
  assert.equal(settings.defaultCoinArray[0], 10);
  assert.equal(DEFAULT_CONFIG.defaultCoinArray[0], 1);
});

test("the vanilla catalog uses canonical Bedrock IDs and explicit nutrition", () => {
  assert.equal(VANILLA_FOODS.length, 40);
  assert.equal(getMenuNutrition(VANILLA_FOODS), 159);
  const ids = VANILLA_FOODS.map(food => food.typeId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("minecraft:cooked_cod"));
  assert.ok(ids.includes("minecraft:cooked_mutton"));
  assert.ok(ids.includes("minecraft:enchanted_golden_apple"));
  for (const legacy of ["fish", "cooked_fish", "muttonRaw", "muttonCooked", "appleEnchanted", "clownfish", "melon"]) {
    assert.ok(!ids.includes("minecraft:" + legacy), legacy);
  }
});

test("menu stacks and legacy aliases cannot inflate nutritional requirements", () => {
  const menu = normalizeMenu([
    { typeId: "minecraft:fish", nutrition: 2, amount: 64 },
    { typeId: "minecraft:cod", nutrition: 200 },
    { typeId: "minecraft:cooked_mutton", nutrition: 6 },
    { typeId: "bad id", nutrition: 100 },
    { typeId: "test:negative", nutrition: -1 }
  ]);
  assert.equal(menu.length, 2);
  assert.equal(getMenuNutrition(menu), 8);
  assert.equal(normalizeFoodId("minecraft:muttonRaw"), "minecraft:mutton");
  assert.equal(normalizeFoodId("bread"), "minecraft:bread");
});

test("menu operations reject duplicate/non-food dishes and cap unique templates at 150", () => {
  const r = restaurant({ menu: [] });
  assert.equal(addMenuFood(r, { typeId: "minecraft:bread" }).ok, true);
  assert.equal(addMenuFood(r, { typeId: "minecraft:bread", nutrition: 500 }).reason, "duplicate_food");
  assert.equal(addMenuFood(r, { typeId: "test:stone", nutrition: 0 }).reason, "invalid_food");
  assert.equal(removeMenuFood(r, "minecraft:bread").ok, true);
  assert.equal(removeMenuFood(r, "minecraft:bread").reason, "food_not_found");
  r.menu = Array.from({ length: 150 }, (_, index) => ({ typeId: "test:dish_" + index, nutrition: 1 }));
  assert.equal(addMenuFood(r, { typeId: "test:extra", nutrition: 1 }).reason, "menu_full");
  assert.equal(normalizeMenu([...r.menu, { typeId: "test:extra", nutrition: 99 }]).length, 150);
});

test("order slots retain the upstream level-zero to level-eight progression", () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, level) => getUnlockedSlots(level)),
    [1, 2, 3, 3, 4, 5, 5, 5, 5]);
});

test("higher-level rare tiers add weight before renormalization", () => {
  assert.deepEqual(getTierWeights(0), [50, 25, 15, 8, 2]);
  assert.deepEqual(getTierWeights(3), [50, 25, 15, 13, 4]);
  assert.deepEqual(getTierWeights(8), [50, 25, 15, 28, 22]);
  const r = restaurant({ level: 8, config: { tierWeights: [100, 0, 0, 0, 0] } });
  assert.deepEqual(getTierWeights(r), [100, 0, 0, 0, 0]);
});

test("a red-tier order selects unique dishes and respects the six-by-six maximum", () => {
  const r = restaurant({ menu: VANILLA_FOODS });
  const order = generateOrder(r, NOW, () => 0.99999);
  assert.equal(order.tier, 4);
  assert.equal(order.items.length, 6);
  assert.equal(new Set(order.items.map(item => item.typeId)).size, 6);
  assert.ok(order.items.every(item => item.amount === 6));
  assert.equal(r.orders[0], order);
});

test("small/empty menus produce valid orders without asking for unavailable menu kinds", () => {
  const empty = restaurant({ menu: [] });
  const fallback = generateOrder(empty, NOW, () => 0.99);
  assert.deepEqual(fallback.items.map(item => item.typeId), ["minecraft:apple"]);
  const single = restaurant({ menu: [{ typeId: "minecraft:bread", nutrition: 5 }] });
  const order = generateOrder(single, NOW, () => 0.99);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].amount, 6);
});

test("default rewards apply rush and distance before adding nutrition", () => {
  const order = { tier: 3, rush: true, type: "delivery", longDistance: false,
    items: [{ typeId: "minecraft:cooked_beef", nutrition: 8, amount: 2 }] };
  assert.equal(calculateReward(order, 5), 22); // ceil(7 * 1.8 * 1.3) + ceil(16 * .30)
  assert.equal(calculateReward({ ...order, longDistance: true }, 5), 42);
  assert.equal(calculateReward({ ...order, type: "dine_in" }, 5), 12);
  assert.equal(calculateReward({ ...order, rush: false, tier: 0, type: "dine_in" }, 0), 1);
});

test("short/long delivery destinations use the upstream radial ranges", () => {
  const short = generateOrder(restaurant(), NOW, rolls(0, 0, 0.99, 0.99, 0.5, 0, 0.5));
  assert.equal(short.type, "delivery");
  assert.equal(short.longDistance, false);
  assert.deepEqual(short.destination, { x: 260, y: 64, z: -20, dimensionId: "minecraft:overworld", distance: 250 });
  const long = generateOrder(restaurant(), NOW, rolls(0, 0, 0.99, 0, 0.5, 0, 0.5));
  assert.equal(long.longDistance, true);
  assert.equal(long.destination.distance, 2250);
});

test("rush probability uses actual restaurant level even when reward benefits are reduced", () => {
  const r = restaurant({ level: 8, menu: [] });
  const order = generateOrder(r, NOW, rolls(0, 0.99, 0.39, 0.5));
  assert.equal(order.rush, true); // .10 base + .30 level-eight bonus
  assert.equal(order.benefitLevel, 0);
  assert.equal(order.expiresAt - order.createdAt, 600000);
});

test("normal and walk-in clocks begin at generation, never acceptance", () => {
  const r = restaurant();
  const normal = generateOrder(r, NOW, () => 0.5);
  assert.equal(normal.expiresAt, NOW + 1800000);
  const walkIn = generateWalkInOrder(r, NOW, () => 0.5);
  assert.equal(walkIn.type, "dine_in");
  assert.equal(walkIn.rush, true);
  assert.equal(walkIn.walkIn, true);
  assert.equal(walkIn.source, "walk_in");
  assert.equal(acceptOrder(r, walkIn.id, NOW + 300000).ok, true);
  assert.equal(walkIn.expiresAt, NOW + 600000);
});

test("accepting one machine offer cancels its alternatives but preserves independent walk-ins", () => {
  const r = restaurant({ level: 2, menu: richMenu });
  const { orders } = refreshOrders(r, NOW, () => 0.5);
  const walkIn = generateWalkInOrder(r, NOW, () => 0.5);
  const originalExpiry = orders[0].expiresAt;
  const originalRefresh = r.nextRefreshAt;
  assert.equal(acceptOrder(r, orders[0].id, NOW + 5000).ok, true);
  assert.equal(orders[1].status, "cancelled");
  assert.equal(orders[2].status, "cancelled");
  assert.equal(walkIn.status, "offered");
  assert.equal(orders[0].expiresAt, originalExpiry);
  assert.equal(r.nextRefreshAt, originalRefresh);
  assert.equal(r.stats.failed, 0);
  assert.equal(acceptOrder(r, orders[0].id, NOW + 6000).reason, "already_accepted");
});

test("accepting a walk-in leaves machine offers available", () => {
  const r = restaurant();
  const machineOrder = generateOrder(r, NOW, () => 0.5);
  const walkIn = generateWalkInOrder(r, NOW, () => 0.5);
  assert.equal(acceptOrder(r, walkIn.id, NOW + 1).ok, true);
  assert.equal(machineOrder.status, "offered");
});

test("orders cannot skip acceptance or packing", () => {
  const r = restaurant();
  const order = generateOrder(r, NOW, () => 0.5);
  assert.equal(packOrder(r, order.id, NOW + 1).reason, "not_accepted");
  assert.equal(completeOrder(r, order.id, NOW + 1, noTip).reason, "not_packed");
  assert.equal(acceptOrder(r, order.id, NOW + 2).ok, true);
  assert.equal(completeOrder(r, order.id, NOW + 3, noTip).reason, "not_packed");
  assert.equal(r.stats.earnings, 0);
});

test("one packed order pays exactly once; replay does not even roll another tip", () => {
  const r = restaurant();
  const order = packed(r);
  let randomCalls = 0;
  const options = { rng: () => { randomCalls++; return 0.9999; } };
  const completed = completeOrder(r, order.id, NOW + 3, options);
  assert.equal(completed.ok, true);
  assert.equal(completed.reward, order.reward);
  assert.equal(order.paidReward, completed.reward);
  assert.equal(r.stats.completed, 1);
  assert.equal(r.stats.earnings, completed.reward);
  assert.equal(completeOrder(r, order.id, NOW + 4, options).reason, "already_completed");
  assert.equal(randomCalls, 1);
  assert.equal(r.stats.completed, 1);
  assert.equal(r.stats.earnings, completed.reward);
  assert.equal(cancelOrder(r, order.id, NOW + 4).reason, "already_completed");
});

test("packing just before expiry is permitted; delivery at the exact deadline is refused", () => {
  const r = restaurant();
  const order = generateOrder(r, NOW, () => 0.5);
  acceptOrder(r, order.id, NOW + 1);
  assert.equal(packOrder(r, order.id, order.expiresAt - 1).ok, true);
  assert.equal(completeOrder(r, order.id, order.expiresAt, noTip).reason, "expired");
  assert.equal(r.stats.failed, 1);
  assert.equal(r.stats.earnings, 0);
  assert.equal(expireOrders(r, order.expiresAt + 1000).expired, 0);
  assert.equal(r.stats.failed, 1);
});

test("expired unaccepted offers do not count as failed work", () => {
  const r = restaurant();
  const order = generateOrder(r, NOW, () => 0.5);
  const result = expireOrders(r, order.expiresAt);
  assert.equal(result.expired, 1);
  assert.equal(result.orders[0], order);
  assert.equal(result.failed, 0);
  assert.equal(r.stats.failed, 0);
  assert.equal(acceptOrder(r, order.id, order.expiresAt).reason, "expired");
});

test("cancelling accepted work is terminal and increments failures only once", () => {
  const r = restaurant();
  const order = packed(r);
  assert.equal(cancelOrder(r, order.id, NOW + 3).ok, true);
  assert.equal(cancelOrder(r, order.id, NOW + 4).reason, "already_cancelled");
  assert.equal(completeOrder(r, order.id, NOW + 5, noTip).reason, "already_cancelled");
  assert.equal(r.stats.failed, 1);
  assert.equal(r.stats.earnings, 0);
});

test("refreshing a machine does not discard already accepted or packed work", () => {
  const r = restaurant({ level: 4, menu: richMenu });
  const order = packed(r);
  const oldOffer = generateOrder(r, NOW + 100, () => 0.5);
  const result = refreshOrders(r, NOW + 200, () => 0.5);
  assert.equal(result.orders.length, 4);
  assert.equal(order.status, "packed");
  assert.equal(oldOffer.status, "cancelled");
  assert.equal(oldOffer.cancelReason, "refresh");
  assert.equal(r.orders.includes(order), true);
  assert.equal(r.stats.failed, 0);
});

test("removing menu variety downgrades offered benefits without erasing purchased level", () => {
  const r = restaurant({ level: 8, menu: richMenu });
  const order = generateOrder(r, NOW, () => 0.5);
  const fullReward = order.reward;
  assert.equal(order.benefitLevel, 8);
  r.menu = [...DEFAULT_MENU];
  assert.equal(getEffectiveBenefitLevel(r), 0);
  assert.equal(synchronizeOfferRewards(r), 0);
  assert.equal(order.benefitLevel, 0);
  assert.ok(order.reward < fullReward);
  assert.equal(r.level, 8);
  assert.equal(getUnlockedSlots(r), 5);
  assert.equal(order.reward, calculateReward(order, 0));
});

test("an accepted price is locked even if its menu is subsequently removed", () => {
  const r = restaurant({ level: 8, menu: richMenu });
  const order = generateOrder(r, NOW, () => 0.5);
  acceptOrder(r, order.id, NOW + 1);
  const agreedReward = order.reward;
  r.menu = [];
  synchronizeOfferRewards(r);
  assert.equal(order.reward, agreedReward);
  packOrder(r, order.id, NOW + 2);
  assert.equal(completeOrder(r, order.id, NOW + 3, noTip).reward, agreedReward);
});

test("level upgrades require distinct-menu nutrition, not large lifetime earnings", () => {
  const r = restaurant();
  r.stats.earnings = 1000000;
  const quote = getUpgradeQuote(r);
  assert.equal(quote.ok, false);
  assert.equal(quote.requiredNutrition, 40);
  assert.equal(quote.currentNutrition, 25);
  assert.equal(quote.cost, 2);
  assert.equal(upgradeRestaurant(r, NOW + 1).ok, false);
  assert.equal(r.level, 0);
  const vanillaOnly = restaurant({ level: 3, menu: VANILLA_FOODS });
  assert.equal(getUpgradeQuote(vanillaOnly).currentNutrition, 159);
  assert.equal(getUpgradeQuote(vanillaOnly).requiredNutrition, 160);
  assert.equal(getUpgradeQuote(vanillaOnly).ok, false);
});

test("all eight upgrade prices are preserved and upgrading never refreshes orders for free", () => {
  const r = restaurant({ menu: richMenu });
  const nextRefresh = r.nextRefreshAt;
  const costs = [];
  for (let expected = 1; expected <= 8; expected++) {
    const quote = getUpgradeQuote(r);
    assert.equal(quote.ok, true);
    assert.equal(r.level, expected - 1); // quoting is read-only
    costs.push(quote.cost);
    assert.equal(upgradeRestaurant(r, NOW + expected).level, expected);
    assert.equal(r.nextRefreshAt, nextRefresh);
    assert.deepEqual(r.orders, []);
  }
  assert.deepEqual(costs, [2, 20, 40, 100, 300, 500, 500, 800]);
  assert.equal(getUpgradeQuote(r).reason, "max_level");
  assert.equal(upgradeRestaurant(r, NOW + 20).ok, false);
  assert.equal(r.stats.earnings, 0);
});

test("configuration may change requirements without permitting duplicate-menu exploits", () => {
  const r = restaurant({ menu: [
    { typeId: "minecraft:bread", nutrition: 5 },
    { typeId: "minecraft:bread", nutrition: 1000 }
  ], config: { orderMachineUpgradeBoardHunger: [0, 6] } });
  assert.equal(getUpgradeQuote(r).currentNutrition, 5);
  assert.equal(getUpgradeQuote(r).ok, false);
  r.config.orderMachineUpgradeBoardHunger = [0, 5];
  assert.equal(getUpgradeQuote(r).ok, true);
});

test("tip probabilities and random endpoints match normal, rush, rain and easter-egg defaults", () => {
  assert.equal(rollTip({ rush: false }, { rng: rolls(0.1, 0) }), 0);
  assert.equal(rollTip({ rush: false }, { rng: rolls(0.09, 0) }), 1);
  assert.equal(rollTip({ rush: false }, { rng: rolls(0.09, 0.9999) }), 3);
  assert.equal(rollTip({ rush: true }, { rng: rolls(0.499, 0.9999), raining: true }), 5);
  assert.equal(rollTip({ rush: true }, { rng: rolls(0.5, 0), raining: true }), 0);
  assert.equal(rollTip({ rush: false }, { rng: rolls(0.9999, 0), easterEgg: true }), 1);
});

test("completion reports exact tip-inclusive totals and attributes delivery statistics once", () => {
  const r = restaurant();
  const order = generateOrder(r, NOW, rolls(0, 0, 0.99, 0, 0.5, 0, 0.5));
  acceptOrder(r, order.id, NOW + 1);
  packOrder(r, order.id, NOW + 2);
  const result = completeOrder(r, order.id, NOW + 3, { raining: true, easterEgg: true, rng: rolls(0, 0.9999) });
  assert.equal(result.tip, 5);
  assert.equal(result.reward, result.baseReward + 5);
  assert.equal(r.stats.delivery, 1);
  assert.equal(r.stats.longDistance, 1);
  assert.equal(r.stats.deliveryEarnings, result.reward);
  assert.equal(r.stats.maxDeliveryDistance, 2250);
});

test("JSON save/reload keeps terminal status, fixed expiry and collision-free order IDs", () => {
  const r = restaurant();
  const order = packed(r);
  const beforeExpiry = order.expiresAt;
  const saved = JSON.parse(JSON.stringify(r));
  assert.equal(saved.orders[0].expiresAt, beforeExpiry);
  assert.equal(completeOrder(saved, order.id, NOW + 3, noTip).ok, true);
  const loadedAgain = JSON.parse(JSON.stringify(saved));
  assert.equal(completeOrder(loadedAgain, order.id, NOW + 4, noTip).reason, "already_completed");
  const next = generateOrder(loadedAgain, NOW, () => 0.5);
  assert.notEqual(next.id, order.id);
});

test("malformed clocks are rejected before domain mutation", () => {
  const r = restaurant({ menu: richMenu });
  const snapshot = JSON.stringify(r);
  assert.throws(() => upgradeRestaurant(r, NaN), RangeError);
  assert.equal(JSON.stringify(r), snapshot);
  assert.throws(() => generateOrder(r, -1), RangeError);
  assert.equal(JSON.stringify(r), snapshot);
});

test("coin denomination output preserves every coin and includes no empty stacks", () => {
  const coins = splitCoins(10126);
  assert.deepEqual(coins.map(coin => coin.value), [10000, 100, 20, 5, 1]);
  assert.equal(coins.reduce((sum, coin) => sum + coin.value * coin.amount, 0), 10126);
  assert.ok(coins.every(coin => coin.amount > 0));
  assert.deepEqual(splitCoins(0), []);
});

