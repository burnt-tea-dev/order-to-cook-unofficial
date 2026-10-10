// SPDX-License-Identifier: GPL-3.0-only
// Advancement rules adapted from breezeth-CN/OrdertoCook (breezeth), GPL v3.
// Source audit and platform differences: docs/PROGRESSION.md.
// Pure data/reducer only: no Minecraft API, currency reward, or Xbox achievement.

export const PROGRESSION_VERSION = 1;
export const PROGRESSION_UPSTREAM = "e59e3dbcabe19b783d9adb933db5fcb8bc1e4642";

const ADVANCEMENT_ROOT = "common/src/main/resources/data/ordertocook/advancements/ordertocook/";
const definitions = [
  ["root", "開始營業啦", "放置第一台打單機。", "task", null, true],
  ["first_order", "首單達成", "親自完成第一張訂單。", "task", "root", true],
  ["first_urgent", "別餓，我來了", "親自完成第一張加急訂單。", "goal", "first_order", true],
  ["first_long_distance", "千山萬水總是情，給個好評行不行", "親自完成第一張遠距離外送。", "goal", "first_order", true],
  ["earn_100", "小賺一筆", "透過交單累積獲得 100 oTc 幣，包含小費與驚喜加賞。", "task", "first_order", true],
  ["earn_1000", "我要開分店", "透過交單累積獲得 1,000 oTc 幣。", "goal", "earn_100", true],
  ["earn_10000", "世界首富要從一家外賣店開始說起", "透過交單累積獲得 10,000 oTc 幣。", "challenge", "earn_1000", true],
  ["dishwasher", "全自動洗碗機", "親自用工具箱將洗碗池升級為洗碗機。", "goal", "root", true],
  ["eight_star_restaurant", "八星級餐廳", "親自將打單機升級至 Lv.8。", "challenge", "root", true],
  ["golden_restaurant", "金牌餐廳", "在同一維度擁有至少 4 間已放置餐廳，且其中一間的總利潤並列或獨佔該維度第一。", "challenge", "root", true],
  ["expired_bag_eaten", "你的外賣員正在攻擊你的外賣！", "食用一個已逾時的外送包裹。", "goal", "minecraft:adventure/root", false]
];

/** The original parent links arrange the display; they are not prerequisites. */
export const PROGRESSION_DEFINITIONS = Object.freeze(definitions.map(values => {
  const [id, title, description, frame, parent, supported] = values;
  return Object.freeze({
    id: String(id), title: String(title), description: String(description),
    frame: String(frame), parent: parent === null ? null : String(parent), supported: supported === true,
    sourceId: "ordertocook:ordertocook/" + id,
    sourcePath: ADVANCEMENT_ROOT + id + ".json"
  });
}));
const byId = new Map(PROGRESSION_DEFINITIONS.map(definition => [definition.id, definition]));
const TOTAL_KEYS = ["earned", "completed", "urgent", "longDistance"];
const STATE_KEYS = new Set(["version", "startedAt", "updatedAt", "totals", "unlocked"]);
const THRESHOLDS = [
  ["earn_100", 100], ["earn_1000", 1000], ["earn_10000", 10000]
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(name + " must be a non-negative safe integer");
  return value;
}
function checkTotals(totals) {
  if (!isRecord(totals) || Object.keys(totals).some(key => !TOTAL_KEYS.includes(key))) {
    throw new TypeError("Invalid progression totals");
  }
  for (const key of TOTAL_KEYS) nonNegativeInteger(totals[key], "totals." + key);
  if (totals.urgent > totals.completed || totals.longDistance > totals.completed) {
    throw new RangeError("Order subtype totals cannot exceed completed orders");
  }
  if (totals.earned > 0 && totals.completed === 0) throw new RangeError("Order earnings require a completed order");
}
function checkProgress(progress) {
  if (!isRecord(progress) || progress.version !== PROGRESSION_VERSION ||
      Object.keys(progress).some(key => !STATE_KEYS.has(key))) {
    throw new TypeError("Unsupported or invalid progression record; preserve the saved value");
  }
  nonNegativeInteger(progress.startedAt, "startedAt");
  nonNegativeInteger(progress.updatedAt, "updatedAt");
  if (progress.updatedAt < progress.startedAt) throw new RangeError("Progression dates are reversed");
  checkTotals(progress.totals);
  if (!isRecord(progress.unlocked)) throw new TypeError("Invalid progression unlocks");
  for (const [id, at] of Object.entries(progress.unlocked)) {
    const definition = byId.get(id);
    if (!definition || !definition.supported) throw new TypeError("Unknown or unsupported progression unlock: " + id);
    nonNegativeInteger(at, "unlocked." + id);
    if (at < progress.startedAt || at > progress.updatedAt) throw new RangeError("Unlock date is outside the tracking period");
  }
}

/** Tracking begins with this version. No alpha.2 restaurant total is imported. */
export function createProgress(now = Date.now()) {
  const at = nonNegativeInteger(now, "now");
  return {
    version: PROGRESSION_VERSION, startedAt: at, updatedAt: at,
    totals: { earned: 0, completed: 0, urgent: 0, longDistance: 0 },
    unlocked: {}
  };
}

/**
 * Missing data starts a new record. Malformed JSON, an unknown version or invalid
 * counters throw; callers must leave the original saved value untouched.
 */
export function parseProgress(raw, now = Date.now()) {
  if (raw === undefined) return createProgress(now);
  if (typeof raw !== "string") throw new TypeError("Saved progression must be a JSON string");
  const value = JSON.parse(raw);
  checkProgress(value);
  return value;
}

/**
 * Pinned Java code requires FOUR restaurants belonging to the SAME player.
 * A tie for highest profit qualifies, including a zero-profit tie.
 * Bedrock stable player IDs replace mutable Java profile names for ownership.
 * MachineRankingState uses dimension-local world storage. Each dimension is
 * evaluated independently; four restaurants split across dimensions do not count.
 * Unloaded placed restaurants still count; closed restaurants still count.
 * Records: {id, ownerId, dimensionId, stats:{earnings}, removing?}.
 */
export function qualifiesGoldenRestaurant(playerId, restaurants) {
  if (typeof playerId !== "string" || !playerId || !Array.isArray(restaurants)) return false;
  const placed = [];
  const seen = new Set();
  for (const restaurant of restaurants) {
    if (!restaurant || restaurant.removing || restaurant.isPlaced === false) continue;
    if (typeof restaurant.id !== "string" || !restaurant.id || seen.has(restaurant.id) ||
        typeof restaurant.ownerId !== "string" || typeof restaurant.dimensionId !== "string" ||
        !restaurant.dimensionId || !restaurant.stats ||
        !Number.isSafeInteger(restaurant.stats.earnings) || restaurant.stats.earnings < 0) {
      return false;
    }
    seen.add(restaurant.id);
    placed.push(restaurant);
  }
  const dimensions = new Set(placed.map(restaurant => restaurant.dimensionId));
  for (const dimensionId of dimensions) {
    const sameDimension = placed.filter(restaurant => restaurant.dimensionId === dimensionId);
    const owned = sameDimension.filter(restaurant => restaurant.ownerId === playerId);
    if (owned.length < 4) continue;
    const highest = sameDimension.reduce((maximum, restaurant) => Math.max(maximum, restaurant.stats.earnings), 0);
    if (owned.some(restaurant => restaurant.stats.earnings === highest)) return true;
  }
  return false;
}

/**
 * Accept only authoritative post-commit gameplay facts. This reducer is not an
 * order-proof verifier or a second payment path. Production uses order_totals
 * after checkpoint reconciliation of the canonical per-restaurant ledger.
 *
 * Events:
 * - order_machine_placed
 * - order_totals { earned, completed, urgent, longDistance } (absolute, monotonic)
 * - order_completed { reward, rush?, longDistance? } (trusted single completion)
 * - restaurant_upgraded { level } (the actor's successful upgrade)
 * - dishwasher_upgraded (the actor's successful washing-table conversion)
 * - restaurant_ranking { playerId, restaurants } (all placed records)
 *
 * Returns a new fixed-size state and only newly unlocked definitions. It never
 * mutates the input, gives currency, resets progress, or unlocks parent entries.
 */
export function applyProgressEvent(progress, event, now = Date.now()) {
  checkProgress(progress);
  const at = Math.max(nonNegativeInteger(now, "now"), progress.updatedAt);
  if (!isRecord(event) || typeof event.type !== "string") throw new TypeError("Invalid progression event");
  const state = {
    version: progress.version, startedAt: progress.startedAt, updatedAt: progress.updatedAt,
    totals: { ...progress.totals }, unlocked: { ...progress.unlocked }
  };
  const newlyUnlocked = [];
  let changed = false;
  function unlock(id) {
    if (Object.prototype.hasOwnProperty.call(state.unlocked, id)) return;
    state.unlocked[id] = at;
    newlyUnlocked.push(byId.get(id));
    changed = true;
  }
  function orderMilestones() {
    if (state.totals.completed > 0) unlock("first_order");
    if (state.totals.urgent > 0) unlock("first_urgent");
    if (state.totals.longDistance > 0) unlock("first_long_distance");
    for (const [id, minimum] of THRESHOLDS) if (state.totals.earned >= minimum) unlock(id);
  }
  switch (event.type) {
    case "order_machine_placed":
      unlock("root");
      break;
    case "order_totals": {
      const totals = Object.fromEntries(TOTAL_KEYS.map(key => [key, event[key]]));
      checkTotals(totals);
      for (const key of TOTAL_KEYS) {
        if (totals[key] < state.totals[key]) throw new RangeError("Progression totals cannot move backwards: " + key);
        if (totals[key] !== state.totals[key]) changed = true;
      }
      state.totals = totals;
      orderMilestones();
      break;
    }
    case "order_completed": {
      nonNegativeInteger(event.reward, "reward");
      if ((event.rush !== undefined && typeof event.rush !== "boolean") ||
          (event.longDistance !== undefined && typeof event.longDistance !== "boolean")) {
        throw new TypeError("Order subtype flags must be booleans");
      }
      const totals = {
        earned: state.totals.earned + event.reward,
        completed: state.totals.completed + 1,
        urgent: state.totals.urgent + (event.rush === true ? 1 : 0),
        longDistance: state.totals.longDistance + (event.longDistance === true ? 1 : 0)
      };
      checkTotals(totals);
      state.totals = totals;
      changed = true;
      orderMilestones();
      break;
    }
    case "restaurant_upgraded":
      nonNegativeInteger(event.level, "level");
      if (event.level > 8) throw new RangeError("Restaurant level exceeds the pinned upstream maximum");
      if (event.level === 8) unlock("eight_star_restaurant");
      break;
    case "dishwasher_upgraded":
      unlock("dishwasher");
      break;
    case "restaurant_ranking":
      if (qualifiesGoldenRestaurant(event.playerId, event.restaurants)) unlock("golden_restaurant");
      break;
    default:
      throw new RangeError("Unsupported progression event: " + event.type);
  }
  if (changed) state.updatedAt = at;
  return { state, newlyUnlocked, changed };
}

/** Plain display data for a stable Bedrock form; no client UI or platform API. */
export function progressRows(progress) {
  checkProgress(progress);
  return PROGRESSION_DEFINITIONS.map(definition => {
    const unlocked = Object.prototype.hasOwnProperty.call(progress.unlocked, definition.id);
    let current = unlocked ? 1 : 0;
    let target = 1;
    if (definition.id === "first_order") current = progress.totals.completed;
    else if (definition.id === "first_urgent") current = progress.totals.urgent;
    else if (definition.id === "first_long_distance") current = progress.totals.longDistance;
    else if (definition.id.startsWith("earn_")) {
      current = progress.totals.earned;
      target = Number(definition.id.slice(5));
    }
    return {
      ...definition, unlocked, unlockedAt: progress.unlocked[definition.id],
      current: Math.min(current, target), target,
      status: !definition.supported ? "尚未移植：需要真正食用逾時包裹" : unlocked ? "已解鎖" : "未解鎖"
    };
  });
}
