// SPDX-License-Identifier: GPL-3.0-only
// Algorithms adapted from breezeth-CN/OrdertoCook (breezeth), GPL v3.
// Pinned source and platform differences: docs/UPSTREAM_RULES.md.
// This module deliberately imports no Minecraft API: every clock and random
// decision can be supplied by the caller and exercised with node:test.

import {
  DEFAULT_CONFIG, DEFAULT_MENU, VANILLA_FOOD_BY_ID, LEGACY_FOOD_ALIASES,
  MAX_LEVEL, MENU_CAPACITY, ORDER_SLOT_COUNTS, HUNGER_BONUS_RATES,
  URGENT_LEVEL_BONUSES, DELIVERY_LEVEL_BONUSES, PURPLE_WEIGHT_BONUSES,
  RED_WEIGHT_BONUSES, TIER_FOOD_KINDS, TIER_MAX_COUNTS, COIN_DENOMINATIONS,
  NAMESPACE
} from "./config.js";

import { normalizeFoodIdentity, normalizeFoodAliases, menuFoodsOverlap } from "./senluo_food.js";
import { DEFAULT_CUSTOMER_NAMES, ENGLISH_CUSTOMER_NAMES } from './customer_names.js';

// CustomerProfileLibrary.java at the pinned upstream commit. Bedrock cannot
// fetch these accounts' player skins; their original identity still travels
// with the order and drives its name, tips and completion reaction.
export const EASTER_EGG_CUSTOMERS = Object.freeze([
  ['Breezeth', '微风(作者)', 'a1b3e264-652b-42db-b8e7-5393b409776b'],
  ['Kuroneko_RikoP', '猫猫子(贡献)', 'e2ca8e07-c1b5-46e1-86f9-932718a44e60'],
  ['YYN0114', '以诺(贡献)', '035c0419-c744-47eb-b2a2-470d92b3bb0c'],
  ['Yunan_ovo', '遇南(贡献)', '772fcb25-c047-42b8-9d5e-df82d7a4a233'],
  ['Ao2333', 'Ao(美术)', '25b8aea8-c9c2-41ef-8f17-3b9c0f7aa365'],
  ['Assumine', 'Assumine(贡献)', '76640ae8-c4da-44ea-9d4b-53329ea02b2d'],
  ['zsdr', 'N44(美术)', '5a33e9b0-35bc-44ed-9b4e-03e3e180a3d2']
]);

const OPEN_STATUSES = new Set(["offered", "accepted", "packed"]);
const WORK_STATUSES = new Set(["accepted", "packed"]);
export const STAT_KEYS = ["completed", "delivery", "longDistance", "earnings", "failed",
  "walkIn", "deliveryEarnings", "maxDeliveryDistance"];

function integer(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
}
function levelOf(value) {
  return integer(typeof value === "object" ? value?.level : value, 0, 0, MAX_LEVEL);
}
function clock(now) {
  if (!Number.isFinite(now) || now < 0) throw new RangeError("now must be a non-negative millisecond timestamp");
  return Math.floor(now);
}
function unit(rng) {
  const n = Number(rng());
  return Number.isFinite(n) ? Math.min(1 - Number.EPSILON, Math.max(0, n)) : 0;
}
function chance(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

/** Select once when an order/customer is created, never again on respawn. */
export function createCustomerProfile(config = DEFAULT_CONFIG, rng = Math.random) {
  // Java accepts both fractions and percentages for these two profile rates.
  const rate = value => chance(value > 1 && value <= 100 ? value / 100 : value);
  if (unit(rng) < rate(config.easterEggCustomerRate ?? DEFAULT_CONFIG.easterEggCustomerRate)) {
    const [skinAccount, customerName, skinUuid] = EASTER_EGG_CUSTOMERS[Math.floor(unit(rng) * EASTER_EGG_CUSTOMERS.length)];
    return { customerName, customerVariant: 0, skinAccount, skinUuid, easterEgg: true };
  }
  const customerVariant = unit(rng) < rate(config.customerFemaleRate ?? DEFAULT_CONFIG.customerFemaleRate) ? 1 : 0;
  const names = String(config.namesLanguage || 'default').toLowerCase() === 'en_us' ? ENGLISH_CUSTOMER_NAMES : DEFAULT_CUSTOMER_NAMES;
  return { customerName: names[Math.floor(unit(rng) * names.length)], customerVariant, skinAccount: '', skinUuid: '', easterEgg: false };
}
function configFor(restaurant) {
  return { ...DEFAULT_CONFIG, ...(restaurant?.config || {}) };
}
function listValue(list, index, fallback = 0) {
  if (!Array.isArray(list) || !list.length) return fallback;
  return integer(list[Math.min(index, list.length - 1)], fallback);
}
function getStats(restaurant) {
  if (!restaurant.stats || typeof restaurant.stats !== "object") restaurant.stats = {};
  for (const key of STAT_KEYS) restaurant.stats[key] = integer(restaurant.stats[key]);
  return restaurant.stats;
}
function ordersOf(restaurant) {
  if (!Array.isArray(restaurant.orders)) restaurant.orders = [];
  return restaurant.orders;
}
function coordinate(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export function normalizeFoodId(typeId) {
  if (typeof typeId !== "string") return "";
  const id = typeId.trim().toLowerCase();
  const qualified = id.includes(":") ? id : "minecraft:" + id;
  return LEGACY_FOOD_ALIASES[qualified] || qualified;
}

/** Menu entries represent one unique dish, never the held stack count. */
export function normalizeMenu(menu, capacity = MENU_CAPACITY) {
  if (!Array.isArray(menu)) return [];
  const result = [];
  const seen = new Map();
  for (const entry of menu) {
    if (!entry || typeof entry !== "object") continue;
    const typeId = normalizeFoodId(entry.typeId);
    const foodIdentity = normalizeFoodIdentity(entry.foodIdentity);
    const aliases = normalizeFoodAliases(entry.aliases, typeId);
    if (!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(typeId) || foodIdentity === null || aliases === null) continue;
    const ids = [typeId, ...(aliases || [])];
    if (ids.some(id => {
      const variants = seen.get(id);
      return variants && (variants.has(undefined) || !foodIdentity || variants.has(foodIdentity.nativeVariant));
    })) continue;
    const vanilla = VANILLA_FOOD_BY_ID[typeId];
    const nutrition = integer(entry.nutrition ?? vanilla?.nutrition, 0, 0, 10000);
    const drink = entry.servingKind === 'drink';
    // A declared zero-nutrition drink can be served without increasing hunger
    // points. Do not turn missing/invalid/negative values into a zero drink.
    if (nutrition <= 0 && !(drink && entry.nutrition === 0)) continue;
    const food = {
      typeId,
      nutrition,
      label: String(entry.label || vanilla?.label || typeId).slice(0, 100),
      ...(drink ? { servingKind: 'drink' } : {}),
      ...(foodIdentity ? { foodIdentity } : {}),
      ...(aliases?.length ? { aliases } : {})
    };
    result.push(food);
    for (const id of ids) {
      if (!seen.has(id)) seen.set(id, new Set());
      seen.get(id).add(foodIdentity?.nativeVariant);
    }
    if (result.length >= integer(capacity, MENU_CAPACITY, 1, MENU_CAPACITY)) break;
  }
  return result;
}

export function getMenuNutrition(restaurantOrMenu) {
  const menu = Array.isArray(restaurantOrMenu) ? restaurantOrMenu : restaurantOrMenu?.menu;
  return normalizeMenu(menu).reduce((sum, food) => sum + food.nutrition, 0);
}
export const menuNutrition = getMenuNutrition;

export function addMenuFood(restaurant, food) {
  const current = normalizeMenu(restaurant.menu);
  const normalized = normalizeMenu([food])[0];
  if (!normalized) return { ok: false, reason: "invalid_food" };
  if (current.some(item => menuFoodsOverlap(item, normalized))) return { ok: false, reason: "duplicate_food" };
  if (current.length >= MENU_CAPACITY) return { ok: false, reason: "menu_full" };
  restaurant.menu = [...current, normalized];
  return { ok: true, food: normalized, nutrition: getMenuNutrition(restaurant) };
}
export function removeMenuFood(restaurant, typeId, foodIdentity = undefined) {
  const id = normalizeFoodId(typeId);
  const current = normalizeMenu(restaurant.menu);
  const identity = normalizeFoodIdentity(foodIdentity);
  if (identity === null) return { ok: false, reason: "invalid_food" };
  const next = current.filter(item => item.typeId !== id ||
    normalizeFoodIdentity(item.foodIdentity)?.nativeVariant !== identity?.nativeVariant);
  if (next.length === current.length) return { ok: false, reason: "food_not_found" };
  restaurant.menu = next;
  return { ok: true, nutrition: getMenuNutrition(restaurant) };
}

export function createRestaurant(spec = {}, now = Date.now()) {
  const at = clock(now);
  const location = {
    x: coordinate(spec.location?.x),
    y: coordinate(spec.location?.y),
    z: coordinate(spec.location?.z)
  };
  const dimensionId = String(spec.dimensionId || "minecraft:overworld");
  const id = String(spec.id || dimensionId + ":" + location.x + "," + location.y + "," + location.z);
  const restaurant = {
    id,
    name: String(spec.name || "我的餐廳").trim().slice(0, 48),
    ownerId: String(spec.ownerId || ""),
    ownerName: String(spec.ownerName || ""),
    dimensionId,
    location,
    level: levelOf(spec.level),
    active: false,
    menu: normalizeMenu(spec.menu === undefined ? DEFAULT_MENU : spec.menu),
    orders: [],
    stats: Object.fromEntries(STAT_KEYS.map(key => [key, 0])),
    orderSequence: 0,
    createdAt: at,
    updatedAt: at,
    nextRefreshAt: at + DEFAULT_CONFIG.refreshMs,
    nextWalkInAt: at + DEFAULT_CONFIG.walkInIntervalMs
  };
  if (spec.config && typeof spec.config === "object") {
    restaurant.config = JSON.parse(JSON.stringify(spec.config));
    const cfg = configFor(restaurant);
    restaurant.nextRefreshAt = at + integer(cfg.refreshMs, DEFAULT_CONFIG.refreshMs, 1);
    restaurant.nextWalkInAt = at + integer(cfg.walkInIntervalMs, DEFAULT_CONFIG.walkInIntervalMs, 1);
  }
  return restaurant;
}

export function getUnlockedSlots(restaurantOrLevel) {
  return ORDER_SLOT_COUNTS[levelOf(restaurantOrLevel)];
}

export function getUpgradeQuote(restaurant) {
  const level = levelOf(restaurant);
  const cfg = configFor(restaurant);
  const maxLevel = integer(cfg.maxLevel, MAX_LEVEL, 0, MAX_LEVEL);
  if (level >= maxLevel) return {
    ok: false, reason: "max_level", level, nextLevel: level, cost: 0,
    requiredNutrition: listValue(cfg.orderMachineUpgradeBoardHunger, level),
    currentNutrition: getMenuNutrition(restaurant)
  };
  const nextLevel = level + 1;
  const requiredNutrition = listValue(cfg.orderMachineUpgradeBoardHunger, nextLevel);
  const currentNutrition = getMenuNutrition(restaurant);
  const cost = listValue(cfg.upgradeCosts, nextLevel, DEFAULT_CONFIG.upgradeCosts[nextLevel]);
  const quote = { level, nextLevel, cost, requiredNutrition, currentNutrition };
  if (currentNutrition < requiredNutrition) return { ok: false, reason: "menu_nutrition", ...quote };
  return { ok: true, ...quote };
}

/**
 * Caller must verify and debit the quoted physical currency synchronously
 * before this mutation. The domain never treats lifetime earnings as a wallet.
 * Upgrading does not generate free orders or reset the refresh timer.
 */
export function upgradeRestaurant(restaurant, now = Date.now()) {
  const quote = getUpgradeQuote(restaurant);
  if (!quote.ok) return quote;
  const at = clock(now);
  restaurant.level = quote.nextLevel;
  restaurant.updatedAt = at;
  return { ...quote, level: restaurant.level, benefitLevel: getEffectiveBenefitLevel(restaurant) };
}

export function getEffectiveBenefitLevel(restaurant) {
  const cfg = configFor(restaurant);
  const nutrition = getMenuNutrition(restaurant);
  let benefit = levelOf(restaurant);
  while (benefit > 0 && listValue(cfg.orderMachineUpgradeBoardHunger, benefit) > nutrition) benefit--;
  return benefit;
}

/** High levels add absolute weight, not percentage points of final probability. */
export function getTierWeights(restaurantOrLevel, config = DEFAULT_CONFIG) {
  const level = levelOf(restaurantOrLevel);
  const cfg = typeof restaurantOrLevel === "object" ? configFor(restaurantOrLevel) : config;
  const weights = DEFAULT_CONFIG.tierWeights.map((fallback, index) =>
    integer(cfg.tierWeights?.[index], fallback)
  );
  const baseTotal = weights.reduce((sum, value) => sum + value, 0);
  if (baseTotal <= 0) return weights;
  if (weights[3] > 0 && PURPLE_WEIGHT_BONUSES[level] > 0) {
    weights[3] += Math.max(1, Math.round(baseTotal * PURPLE_WEIGHT_BONUSES[level]));
  }
  if (weights[4] > 0 && RED_WEIGHT_BONUSES[level] > 0) {
    weights[4] += Math.max(1, Math.round(baseTotal * RED_WEIGHT_BONUSES[level]));
  }
  return weights;
}

function selectTier(restaurant, rng) {
  const weights = getTierWeights(restaurant);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 0;
  const roll = Math.floor(unit(rng) * total);
  let cumulative = 0;
  for (let tier = 0; tier < weights.length; tier++) {
    cumulative += weights[tier];
    if (roll < cumulative) return tier;
  }
  return 4;
}

/** Default upstream formula: delivery multiplier excludes the hunger bonus. */
export function calculateReward(order, benefitLevel = 0, config = DEFAULT_CONFIG) {
  const level = levelOf(benefitLevel);
  const tier = integer(order.tier, 0, 0, 4);
  let base = listValue(config.defaultCoinArray, tier, 1);
  if (order.rush) base += integer(config.rushBonus, 3);
  if (order.type === "delivery") {
    const raw = order.longDistance ? config.longDistanceDeliveryMultiplier : config.deliveryMultiplier;
    const fallback = order.longDistance ? 4 : 1.8;
    const multiplier = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : fallback;
    base = Math.ceil(base * multiplier * (1 + DELIVERY_LEVEL_BONUSES[level]));
  }
  const hunger = (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => {
    const id = normalizeFoodId(item.typeId);
    const nutrition = integer(item.nutrition ?? VANILLA_FOOD_BY_ID[id]?.nutrition, 0, 0, 10000);
    return sum + nutrition * integer(item.amount, 0, 0, 64);
  }, 0);
  return base + Math.ceil(hunger * HUNGER_BONUS_RATES[level]);
}

function destinationFor(restaurant, longDistance, cfg, rng) {
  const min = integer(longDistance ? cfg.longMinDistance : cfg.shortMinDistance, longDistance ? 1500 : 50);
  const max = integer(longDistance ? cfg.longMaxDistance : cfg.shortMaxDistance, longDistance ? 3000 : 450, min);
  const radius = min + unit(rng) * (max - min);
  const angle = unit(rng) * Math.PI * 2;
  const x = coordinate(restaurant.location?.x) + Math.round(Math.cos(angle) * radius);
  const z = coordinate(restaurant.location?.z) + Math.round(Math.sin(angle) * radius);
  const dx = x - coordinate(restaurant.location?.x);
  const dz = z - coordinate(restaurant.location?.z);
  return {
    x, y: coordinate(restaurant.location?.y), z,
    dimensionId: restaurant.dimensionId,
    distance: Math.round(Math.sqrt(dx * dx + dz * dz))
  };
}

function nextOrderId(restaurant, now) {
  let sequence = integer(restaurant.orderSequence);
  let id;
  do {
    sequence++;
    id = restaurant.id + ":" + now.toString(36) + ":" + sequence.toString(36);
  } while (ordersOf(restaurant).some(order => order.id === id));
  restaurant.orderSequence = sequence;
  return id;
}

function makeOrder(restaurant, now, rng, walkIn) {
  const at = clock(now);
  const cfg = configFor(restaurant);
  const level = levelOf(restaurant);
  const tier = selectTier(restaurant, rng);
  const delivery = walkIn ? false : unit(rng) < chance(cfg.deliveryRate);
  const rush = walkIn ? true : unit(rng) < chance(Number(cfg.urgentRate) + URGENT_LEVEL_BONUSES[level]);
  const longDistance = delivery && unit(rng) < chance(cfg.longDistanceDeliveryChance);
  const destination = delivery ? destinationFor(restaurant, longDistance, cfg, rng) : undefined;
  const pool = normalizeMenu(restaurant.menu);
  if (!pool.length) pool.push({ ...VANILLA_FOOD_BY_ID["minecraft:apple"] });
  // Fisher-Yates gives the same uniform unique-dish selection as Java shuffle;
  // matching Java's PRNG byte stream across platforms is not required.
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(unit(rng) * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  const items = pool.slice(0, TIER_FOOD_KINDS[tier]).map(food => ({
    typeId: food.typeId,
    amount: 1 + Math.floor(unit(rng) * TIER_MAX_COUNTS[tier]),
    nutrition: food.nutrition,
    label: food.label,
    ...(food.servingKind === 'drink' ? { servingKind: 'drink' } : {}),
    ...(food.foodIdentity ? { foodIdentity: { ...food.foodIdentity } } : {}),
    ...(food.aliases ? { aliases: [...food.aliases] } : {})
  }));
  const duration = integer(rush ? cfg.rushDurationMs : cfg.normalDurationMs,
    rush ? DEFAULT_CONFIG.rushDurationMs : DEFAULT_CONFIG.normalDurationMs, 1);
  const order = {
    id: nextOrderId(restaurant, at),
    restaurantId: restaurant.id,
    type: delivery ? "delivery" : "dine_in",
    source: walkIn ? "walk_in" : "machine",
    walkIn: Boolean(walkIn),
    tier,
    rush,
    longDistance,
    items,
    reward: 0,
    benefitLevel: getEffectiveBenefitLevel(restaurant),
    createdAt: at,
    expiresAt: at + duration,
    status: "offered"
  };
  if (destination) order.destination = destination;
  order.reward = calculateReward(order, order.benefitLevel, cfg);
  Object.assign(order, createCustomerProfile(cfg, rng));
  ordersOf(restaurant).push(order);
  restaurant.updatedAt = at;
  return order;
}

/** Returns the new order and appends it to restaurant.orders. */
export function generateOrder(restaurant, now = Date.now(), rng = Math.random) {
  return makeOrder(restaurant, now, rng, false);
}

/** Walk-ins have independent offers, are always dine-in/rush, and expire from arrival. */
export function generateWalkInOrder(restaurant, now = Date.now(), rng = Math.random) {
  return makeOrder(restaurant, now, rng, true);
}

export function getWalkInChance(restaurant) {
  const values = configFor(restaurant).walkInChances;
  return chance(values?.[levelOf(restaurant)] || 0);
}

export function synchronizeOfferRewards(restaurant) {
  const benefitLevel = getEffectiveBenefitLevel(restaurant);
  const cfg = configFor(restaurant);
  for (const order of ordersOf(restaurant)) {
    if (order.status !== "offered") continue;
    order.benefitLevel = benefitLevel;
    order.reward = calculateReward(order, benefitLevel, cfg);
  }
  return benefitLevel;
}

function cancelOffer(order, now, reason) {
  order.status = "cancelled";
  order.cancelledAt = now;
  order.cancelReason = reason;
}

/** Accepted/packed orders survive machine refreshes. Only the remaining offers change. */
export function refreshOrders(restaurant, now = Date.now(), rng = Math.random) {
  const at = clock(now);
  expireOrders(restaurant, at);
  for (const order of ordersOf(restaurant)) {
    if (order.status === "offered" && order.source !== "walk_in") cancelOffer(order, at, "refresh");
  }
  const fresh = [];
  for (let index = 0; index < getUnlockedSlots(restaurant); index++) {
    fresh.push(generateOrder(restaurant, at, rng));
  }
  restaurant.nextRefreshAt = at + integer(configFor(restaurant).refreshMs, DEFAULT_CONFIG.refreshMs, 1);
  restaurant.updatedAt = at;
  return { ok: true, orders: fresh, nextRefreshAt: restaurant.nextRefreshAt };
}

/** Expiry is inclusive: an order cannot be packed/paid at exactly expiresAt. */
export function expireOrders(restaurant, now = Date.now()) {
  const at = clock(now);
  const expired = [];
  let failed = 0;
  for (const order of ordersOf(restaurant)) {
    if (!OPEN_STATUSES.has(order.status)) continue;
    if (Number.isFinite(order.expiresAt) && at < order.expiresAt) continue;
    if (WORK_STATUSES.has(order.status)) failed++;
    order.status = "expired";
    order.expiredAt = at;
    expired.push(order);
  }
  if (expired.length) {
    getStats(restaurant).failed += failed;
    restaurant.updatedAt = at;
  }
  return { ok: true, orders: expired, expired: expired.length, failed };
}

function lookup(restaurant, orderId, now) {
  expireOrders(restaurant, now);
  const order = ordersOf(restaurant).find(entry => entry.id === orderId);
  if (!order) return { ok: false, reason: "not_found" };
  if (order.status === "expired") return { ok: false, reason: "expired", order };
  if (order.status === "completed") return { ok: false, reason: "already_completed", order };
  if (order.status === "cancelled") return { ok: false, reason: "already_cancelled", order };
  return { ok: true, order };
}

export function acceptOrder(restaurant, orderId, now = Date.now()) {
  const at = clock(now);
  const found = lookup(restaurant, orderId, at);
  if (!found.ok) return found;
  const order = found.order;
  if (order.status !== "offered") return { ok: false, reason: "already_accepted", order };
  // This is the last point at which the menu may lower the offered reward.
  order.benefitLevel = getEffectiveBenefitLevel(restaurant);
  order.reward = calculateReward(order, order.benefitLevel, configFor(restaurant));
  order.status = "accepted";
  order.acceptedAt = at;
  if (order.source !== "walk_in") {
    for (const other of ordersOf(restaurant)) {
      if (other.id !== order.id && other.status === "offered" && other.source !== "walk_in") {
        cancelOffer(other, at, "another_offer_accepted");
      }
    }
  }
  restaurant.updatedAt = at;
  return { ok: true, order };
}

/** Ingredient and packaging transactions belong to the Minecraft adapter. */
export function packOrder(restaurant, orderId, now = Date.now()) {
  const at = clock(now);
  const found = lookup(restaurant, orderId, at);
  if (!found.ok) return found;
  const order = found.order;
  if (order.status === "packed") return { ok: false, reason: "already_packed", order };
  if (order.status !== "accepted") return { ok: false, reason: "not_accepted", order };
  order.status = "packed";
  order.packedAt = at;
  restaurant.updatedAt = at;
  return { ok: true, order };
}

export function rollTip(order, options = {}, config = DEFAULT_CONFIG) {
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  const rate = options.easterEgg ? config.tipEasterEggCustomerChance
    : (order.rush ? config.tipUrgentChance : config.tipNormalChance);
  if (unit(rng) >= chance(rate)) return 0;
  const min = integer(options.raining ? config.rainTipMin : config.tipMin, options.raining ? 3 : 1);
  const max = integer(options.raining ? config.rainTipMax : config.tipMax, options.raining ? 5 : 3, min);
  return min + Math.floor(unit(rng) * (max - min + 1));
}

/** Original seated plate completion: 10% boom (60% for a known easter egg).
 * The adapter supplies actual seating; delivery/takeaway never rolls a boom.
 * Pick once during the canonical completion transition, never on NPC retries.
 */
export function rollCustomerCompletion(restaurant, order, now, options = {}) {
  const seated = options.customerSeated === true;
  const rng = typeof options.rng === "function" ? options.rng : Math.random;
  let action = seated ? 3 : 4;
  let boomBonus = 0;
  if (seated && order.type === "dine_in") {
    action = unit(rng) < (options.easterEgg ? 0.6 : 0.1) ? 5 : 6;
    if (action === 5) boomBonus = 1 + Math.floor(unit(rng) * 4) + levelOf(restaurant);
  }
  const duration = { 3: 2000, 4: 3000, 5: 6000, 6: 5500 }[action];
  return { startedAt: clock(now), finishAt: clock(now) + duration, action, boomBonus };
}

/**
 * The adapter first proves ownership, carrier identity and NPC/proximity.
 * A successful transition can occur once; it returns the exact coins to pay.
 * Options: {rng, raining, easterEgg, customerSeated}. Without customerSeated,
 * callers retain the alpha.1 pure-core contract (no customer animation roll).
 * Bedrock pays a recorded boom bonus with the main payment, instead of a second
 * physical-inventory payment after the animation; see RUNTIME_ADAPTATIONS.md.
 */
export function completeOrder(restaurant, orderId, now = Date.now(), options = {}) {
  const at = clock(now);
  const found = lookup(restaurant, orderId, at);
  if (!found.ok) return found;
  const order = found.order;
  if (order.status !== "packed") return { ok: false, reason: "not_packed", order };
  const baseReward = integer(order.reward);
  const tip = rollTip(order, options, configFor(restaurant));
  const completion = typeof options.customerSeated === "boolean"
    ? rollCustomerCompletion(restaurant, order, at, options) : undefined;
  const boomBonus = completion?.boomBonus || 0;
  const reward = baseReward + tip + boomBonus;
  order.status = "completed";
  order.completedAt = at;
  order.tip = tip;
  if (completion) {
    order.completion = completion;
    if (order.type === "dine_in") order.meal = completion;
    order.boomBonus = boomBonus;
  }
  order.paidReward = reward;
  const stats = getStats(restaurant);
  stats.completed++;
  stats.earnings += reward;
  if (order.type === "delivery") {
    stats.delivery++;
    stats.deliveryEarnings += reward;
    stats.maxDeliveryDistance = Math.max(stats.maxDeliveryDistance, integer(order.destination?.distance));
    if (order.longDistance) stats.longDistance++;
  }
  if (order.walkIn) stats.walkIn++;
  restaurant.updatedAt = at;
  return { ok: true, order, reward, baseReward, tip, boomBonus, completion };
}

export function cancelOrder(restaurant, orderId, now = Date.now()) {
  const at = clock(now);
  const found = lookup(restaurant, orderId, at);
  if (!found.ok) return found;
  const order = found.order;
  if (!OPEN_STATUSES.has(order.status)) return { ok: false, reason: "invalid_state", order };
  if (WORK_STATUSES.has(order.status)) getStats(restaurant).failed++;
  cancelOffer(order, at, "player");
  restaurant.updatedAt = at;
  return { ok: true, order };
}

/** Physical currency breakdown; the adapter splits resulting amounts into stacks. */
export function splitCoins(amount) {
  let remaining = integer(amount);
  const result = [];
  for (const value of COIN_DENOMINATIONS) {
    const count = Math.floor(remaining / value);
    if (count > 0) result.push({ typeId: NAMESPACE + ":chef_coin_" + value, amount: count, value });
    remaining %= value;
  }
  return result;
}

