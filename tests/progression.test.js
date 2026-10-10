// SPDX-License-Identifier: GPL-3.0-only
import test from "node:test";
import assert from "node:assert/strict";
import {
  PROGRESSION_DEFINITIONS, PROGRESSION_UPSTREAM, createProgress, parseProgress,
  applyProgressEvent, qualifiesGoldenRestaurant, progressRows
} from "../runtime/BP/scripts/progression.js";

const NOW = 1_800_000_000_000;
const ids = result => result.newlyUnlocked.map(definition => definition.id);
const totals = (earned, completed = 1, urgent = 0, longDistance = 0) => ({
  type: "order_totals", earned, completed, urgent, longDistance
});
const restaurant = (id, ownerId, earnings = 0, extra = {}) => ({
  id, ownerId, dimensionId: "minecraft:overworld", stats: { earnings }, ...extra
});
const four = (ownerId = "cook") => [0, 1, 2, 3].map(index => restaurant("r" + index, ownerId));

test("all eleven pinned advancements remain visible and the unported eat action is explicit", () => {
  assert.equal(PROGRESSION_UPSTREAM, "e59e3dbcabe19b783d9adb933db5fcb8bc1e4642");
  assert.equal(PROGRESSION_DEFINITIONS.length, 11);
  assert.equal(new Set(PROGRESSION_DEFINITIONS.map(value => value.id)).size, 11);
  assert.equal(PROGRESSION_DEFINITIONS.filter(value => value.supported).length, 10);
  const expired = PROGRESSION_DEFINITIONS.find(value => value.id === "expired_bag_eaten");
  assert.equal(expired.supported, false);
  assert.equal(expired.parent, "minecraft:adventure/root");
  assert.equal(expired.sourceId, "ordertocook:ordertocook/expired_bag_eaten");
  assert.ok(PROGRESSION_DEFINITIONS.every(value => value.sourcePath.endsWith("/" + value.id + ".json")));
  assert.ok(Object.isFrozen(PROGRESSION_DEFINITIONS));
  assert.ok(PROGRESSION_DEFINITIONS.every(Object.isFrozen));
});

test("a new personal record starts at zero without guessing alpha.2 earnings", () => {
  const progress = createProgress(NOW);
  assert.deepEqual(progress.totals, { earned: 0, completed: 0, urgent: 0, longDistance: 0 });
  assert.deepEqual(progress.unlocked, {});
  assert.equal(progress.startedAt, NOW);
  assert.equal(progress.updatedAt, NOW);
  assert.deepEqual(parseProgress(undefined, NOW), progress);
  assert.deepEqual(parseProgress(JSON.stringify(progress), NOW + 99), progress);
});

test("placing a machine unlocks root once without changing earnings or mutating its input", () => {
  const before = createProgress(NOW);
  const result = applyProgressEvent(before, { type: "order_machine_placed" }, NOW + 1);
  assert.deepEqual(ids(result), ["root"]);
  assert.equal(result.state.unlocked.root, NOW + 1);
  assert.equal(result.state.totals.earned, 0);
  assert.deepEqual(before, createProgress(NOW));
  const again = applyProgressEvent(result.state, { type: "order_machine_placed" }, NOW + 2);
  assert.equal(again.changed, false);
  assert.deepEqual(again.newlyUnlocked, []);
  assert.equal(again.state.updatedAt, NOW + 1);
});

test("ordinary zero-reward completion still unlocks first_order without manufacturing parent progress", () => {
  const result = applyProgressEvent(createProgress(NOW), totals(0), NOW + 1);
  assert.deepEqual(ids(result), ["first_order"]);
  assert.equal(result.state.unlocked.root, undefined);
  assert.equal(result.state.totals.completed, 1);
  assert.equal(result.state.totals.earned, 0);
});

test("one authoritative snapshot can unlock both order flags and every crossed income threshold", () => {
  const result = applyProgressEvent(createProgress(NOW), totals(10000, 1, 1, 1), NOW + 1);
  assert.deepEqual(ids(result), ["first_order", "first_urgent", "first_long_distance", "earn_100", "earn_1000", "earn_10000"]);
  assert.equal(result.state.unlocked.root, undefined);
  assert.equal(result.state.totals.earned, 10000);
});

test("income thresholds use personal lifetime order earnings with exact inclusive boundaries", () => {
  let progress = createProgress(NOW);
  for (const [earned, expected] of [[99, ["first_order"]], [100, ["earn_100"]], [999, []], [1000, ["earn_1000"]], [9999, []], [10000, ["earn_10000"]]]) {
    const result = applyProgressEvent(progress, totals(earned), NOW + earned);
    assert.deepEqual(ids(result), expected);
    assert.equal(result.state.totals.earned, earned);
    progress = result.state;
  }
});

test("replaying reconciled absolute totals is idempotent and does not duplicate notifications", () => {
  const progress = applyProgressEvent(createProgress(NOW), totals(123, 4, 2, 1), NOW + 1).state;
  const snapshot = JSON.stringify(progress);
  for (let repeat = 0; repeat < 3; repeat++) {
    const result = applyProgressEvent(progress, totals(123, 4, 2, 1), NOW + 10 + repeat);
    assert.equal(result.changed, false);
    assert.deepEqual(result.newlyUnlocked, []);
    assert.equal(JSON.stringify(result.state), snapshot);
  }
  assert.equal(JSON.stringify(progress), snapshot);
});

test("absolute totals reject each kind of rollback without modifying the saved input", () => {
  const progress = applyProgressEvent(createProgress(NOW), totals(100, 4, 2, 2), NOW + 1).state;
  const before = JSON.stringify(progress);
  for (const event of [totals(99, 4, 2, 2), totals(100, 3, 2, 2), totals(100, 4, 1, 2), totals(100, 4, 2, 1)]) {
    assert.throws(() => applyProgressEvent(progress, event, NOW + 2), /backwards/);
    assert.equal(JSON.stringify(progress), before);
  }
});

test("malformed counters, overflow, and impossible subtype totals cannot award progress", () => {
  const progress = createProgress(NOW);
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "100", undefined]) {
    assert.throws(() => applyProgressEvent(progress, totals(value), NOW + 1));
  }
  for (const event of [totals(1, 0), totals(1, 1, 2), totals(1, 1, 0, 2)]) {
    assert.throws(() => applyProgressEvent(progress, event, NOW + 1));
  }
  assert.deepEqual(progress, createProgress(NOW));
});

test("direct trusted completion includes its whole credited reward and strict boolean flags", () => {
  const first = applyProgressEvent(createProgress(NOW), {
    type: "order_completed", reward: 99, rush: false, longDistance: false
  }, NOW + 1);
  const second = applyProgressEvent(first.state, {
    type: "order_completed", reward: 6, rush: true, longDistance: true
  }, NOW + 2);
  assert.deepEqual(second.state.totals, { earned: 105, completed: 2, urgent: 1, longDistance: 1 });
  assert.deepEqual(ids(second), ["first_urgent", "first_long_distance", "earn_100"]);
  assert.throws(() => applyProgressEvent(second.state, { type: "order_completed", reward: 1, rush: 1 }, NOW + 3));
  assert.throws(() => applyProgressEvent(second.state, { type: "order_completed", reward: Number.MAX_SAFE_INTEGER }, NOW + 3));
});

test("dishwasher progress requires the upgrade event and has no machine-placement prerequisite", () => {
  const progress = createProgress(NOW);
  const result = applyProgressEvent(progress, { type: "dishwasher_upgraded" }, NOW + 1);
  assert.deepEqual(ids(result), ["dishwasher"]);
  assert.equal(result.state.unlocked.root, undefined);
  assert.throws(() => applyProgressEvent(progress, { type: "dishwasher_placed" }, NOW + 1), /Unsupported/);
});

test("only the successful Lv.8 upgrade event unlocks the maximum-level advancement", () => {
  const progress = createProgress(NOW);
  for (const level of [0, 1, 7]) {
    const result = applyProgressEvent(progress, { type: "restaurant_upgraded", level }, NOW + 1);
    assert.equal(result.changed, false);
  }
  const result = applyProgressEvent(progress, { type: "restaurant_upgraded", level: 8 }, NOW + 1);
  assert.deepEqual(ids(result), ["eight_star_restaurant"]);
  assert.equal(result.state.unlocked.root, undefined);
  for (const level of [-1, 9, 8.1, "8"]) {
    assert.throws(() => applyProgressEvent(progress, { type: "restaurant_upgraded", level }, NOW + 1));
  }
});

test("golden restaurant counts four owned restaurants rather than four across the server", () => {
  assert.equal(qualifiesGoldenRestaurant("cook", four().slice(0, 3)), false);
  assert.equal(qualifiesGoldenRestaurant("cook", [
    restaurant("a", "cook", 100), restaurant("b", "other"), restaurant("c", "other"), restaurant("d", "other")
  ]), false);
  assert.equal(qualifiesGoldenRestaurant("cook", four()), true);
});

test("golden restaurant allows ties including zero and compares individual restaurants rather than combined profit", () => {
  const owned = four();
  for (const value of owned) value.stats.earnings = 40;
  assert.equal(qualifiesGoldenRestaurant("cook", [...owned, restaurant("rival", "other", 50)]), false);
  owned[0].stats.earnings = 50;
  assert.equal(qualifiesGoldenRestaurant("cook", [...owned, restaurant("rival", "other", 50)]), true);
  assert.equal(qualifiesGoldenRestaurant("cook", [...four(), restaurant("rival", "other", 0)]), true);
});

test("unloaded or closed placed restaurants count but removing and unplaced restaurants do not", () => {
  const values = four().map(value => ({ ...value, active: false, loaded: false }));
  assert.equal(qualifiesGoldenRestaurant("cook", values), true);
  values[0].removing = true;
  assert.equal(qualifiesGoldenRestaurant("cook", values), false);
  values[0].removing = false;
  values[0].isPlaced = false;
  assert.equal(qualifiesGoldenRestaurant("cook", values), false);
});

test("golden restaurant uses stable ownership IDs and fails closed on duplicate or corrupt ranking records", () => {
  const values = four();
  values[0].ownerName = "renamed cook";
  assert.equal(qualifiesGoldenRestaurant("cook", values), true);
  assert.equal(qualifiesGoldenRestaurant("renamed cook", values), false);
  assert.equal(qualifiesGoldenRestaurant("cook", [values[0], values[0], values[0], values[0]]), false);
  assert.equal(qualifiesGoldenRestaurant("cook", [...values, restaurant("rival", "other", NaN)]), false);
  assert.equal(qualifiesGoldenRestaurant("cook", [...values, restaurant("rival", "other", -1)]), false);
  assert.equal(qualifiesGoldenRestaurant("", values), false);
});

test("golden advancement remains unlocked after ranking changes without awarding money or parents", () => {
  const records = four();
  const before = JSON.stringify(records);
  const result = applyProgressEvent(createProgress(NOW), {
    type: "restaurant_ranking", playerId: "cook", restaurants: records
  }, NOW + 1);
  assert.deepEqual(ids(result), ["golden_restaurant"]);
  assert.equal(JSON.stringify(records), before);
  assert.equal(result.state.totals.earned, 0);
  assert.equal(result.state.unlocked.root, undefined);
  const later = applyProgressEvent(result.state, {
    type: "restaurant_ranking", playerId: "cook", restaurants: []
  }, NOW + 2);
  assert.equal(later.state.unlocked.golden_restaurant, NOW + 1);
  assert.equal(later.changed, false);
});

test("unknown and unimplemented triggers cannot claim expired-bag progress", () => {
  for (const type of ["expired_bag_eaten", "item_used", "coin_received", "restaurant_owned", ""]) {
    assert.throws(() => applyProgressEvent(createProgress(NOW), { type }, NOW + 1));
  }
  assert.throws(() => applyProgressEvent(createProgress(NOW), null, NOW + 1));
});

test("invalid persisted progress is rejected instead of silently resetting or accepting future schemas", () => {
  const progress = createProgress(NOW);
  const cases = [
    "{bad", "null", "[]", "{}", JSON.stringify({ ...progress, version: 2 }),
    JSON.stringify({ ...progress, extraField: true }),
    JSON.stringify({ ...progress, totals: { ...progress.totals, earned: -1 } }),
    JSON.stringify({ ...progress, totals: { ...progress.totals, other: 1 } }),
    JSON.stringify({ ...progress, unlocked: { root: NOW - 1 } }),
    JSON.stringify({ ...progress, unlocked: { root: NOW + 1 } }),
    JSON.stringify({ ...progress, unlocked: { mystery: NOW } }),
    JSON.stringify({ ...progress, unlocked: { expired_bag_eaten: NOW } }),
    JSON.stringify({ ...progress, updatedAt: NOW - 1 })
  ];
  for (const raw of cases) assert.throws(() => parseProgress(raw, NOW + 20));
  for (const raw of [null, 0, false, {}]) assert.throws(() => parseProgress(raw, NOW + 20));
  assert.deepEqual(progress, createProgress(NOW));
});

test("clock rollback cannot rewrite an existing timestamp or invalidate a new unlock", () => {
  const progress = applyProgressEvent(createProgress(NOW), { type: "order_machine_placed" }, NOW + 100).state;
  const result = applyProgressEvent(progress, { type: "dishwasher_upgraded" }, NOW - 100);
  assert.equal(result.state.updatedAt, NOW + 100);
  assert.equal(result.state.unlocked.dishwasher, NOW + 100);
  assert.deepEqual(parseProgress(JSON.stringify(result.state)), result.state);
  for (const now of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createProgress(now));
    assert.throws(() => applyProgressEvent(progress, { type: "dishwasher_upgraded" }, now));
  }
});

test("display rows expose bounded counters, source IDs and explicit unsupported status without modifying progress", () => {
  const progress = applyProgressEvent(createProgress(NOW), totals(999, 6, 2, 1), NOW + 1).state;
  const before = JSON.stringify(progress);
  const rows = progressRows(progress);
  assert.equal(rows.length, 11);
  assert.deepEqual([rows.find(row => row.id === "earn_100").current, rows.find(row => row.id === "earn_100").target], [100, 100]);
  assert.deepEqual([rows.find(row => row.id === "earn_1000").current, rows.find(row => row.id === "earn_1000").target], [999, 1000]);
  assert.equal(rows.find(row => row.id === "earn_100").status, "已解鎖");
  assert.equal(rows.find(row => row.id === "earn_1000").status, "未解鎖");
  const expired = rows.find(row => row.id === "expired_bag_eaten");
  assert.equal(expired.unlocked, false);
  assert.match(expired.status, /尚未移植/);
  assert.equal(JSON.stringify(progress), before);
});

test("golden restaurant checks the pinned source's dimension-local persisted rankings", () => {
  const split = four();
  split[0].dimensionId = "minecraft:nether";
  split[1].dimensionId = "minecraft:nether";
  assert.equal(qualifiesGoldenRestaurant("cook", split), false);
  const owned = four().map(value => ({ ...value, dimensionId: "minecraft:nether" }));
  const rival = restaurant("overworld-rival", "other", 10000);
  assert.equal(qualifiesGoldenRestaurant("cook", [...owned, rival]), true);
  rival.dimensionId = "minecraft:nether";
  assert.equal(qualifiesGoldenRestaurant("cook", [...owned, rival]), false);
  owned[0].stats.earnings = 10000;
  assert.equal(qualifiesGoldenRestaurant("cook", [...owned, rival]), true);
});
