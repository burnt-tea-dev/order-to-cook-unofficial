// SPDX-License-Identifier: GPL-3.0-only
// Personal progress uses the same chunked world store as restaurants. Successful
// handoffs save a cumulative per-player ledger WITH the completed order. Profiles
// reconcile monotonic checkpoints, so retries, history trimming, and offline
// players do not need a second economic transaction or duplicate rewards.
import { createProgress, parseProgress, applyProgressEvent } from './progression.js';

const FIELDS = Object.freeze(['earned', 'completed', 'urgent', 'longDistance']);
const zero = () => ({ earned: 0, completed: 0, urgent: 0, longDistance: 0 });
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function validId(id) {
  if (typeof id !== 'string' || !id || id.includes(':part:')) throw new Error('Invalid progress identity');
}
function checkedTotals(value) {
  if (!object(value) || FIELDS.some(key => !Number.isSafeInteger(value[key]) || value[key] < 0) ||
      value.urgent > value.completed || value.longDistance > value.completed) throw new Error('Invalid progress totals; saved data preserved');
  return Object.fromEntries(FIELDS.map(key => [key, value[key]]));
}
function add(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('Progress counter overflow');
  return result;
}
function ledgerOf(restaurant) {
  const ledger = restaurant.progressLedger;
  if (ledger === undefined) return undefined;
  if (!object(ledger) || ledger.version !== 1 || !object(ledger.players)) throw new Error('Invalid restaurant progress ledger; saved data preserved');
  validId(ledger.id);
  return ledger;
}

/** Call only after completeOrder succeeds, before the SAME saveRestaurant call. */
export function creditCompletedOrder(restaurant, playerId, order) {
  validId(playerId);
  if (!restaurant || restaurant.orders?.find(value => value.id === order?.id) !== order ||
      order.status !== 'completed' || !Number.isSafeInteger(order.paidReward) || order.paidReward < 0) {
    throw new Error('Progress requires a canonical completed order');
  }
  if (order.progressionReceipt !== undefined) {
    const receipt = order.progressionReceipt;
    if (!object(receipt) || receipt.version !== 1 || receipt.playerId !== playerId) throw new Error('Conflicting progress receipt');
    return false;
  }
  const previous = ledgerOf(restaurant);
  if (!previous && (!Number.isSafeInteger(restaurant.createdAt) || restaurant.createdAt < 0)) throw new Error('Invalid restaurant creation time');
  // First completed order distinguishes a new restaurant at a reused location.
  const ledger = previous ? clone(previous) : {
    version: 1, id: restaurant.id + '@' + restaurant.createdAt + '#' + order.id, players: {}
  };
  const before = Object.hasOwn(ledger.players, playerId) ? checkedTotals(ledger.players[playerId]) : zero();
  ledger.players[playerId] = {
    earned: add(before.earned, order.paidReward),
    completed: add(before.completed, 1),
    urgent: add(before.urgent, order.rush ? 1 : 0),
    longDistance: add(before.longDistance, order.type === 'delivery' && order.longDistance ? 1 : 0)
  };
  restaurant.progressLedger = ledger;
  order.progressionReceipt = { version: 1, playerId };
  return true;
}

export function createProgressionService(context) {
  const clock = context.now || Date.now;
  function loadProfile(playerId) {
    validId(playerId);
    const saved = context.getProfile(playerId);
    if (saved === undefined) return { id: playerId, state: createProgress(clock()), sources: {} };
    if (!object(saved) || saved.id !== playerId || !object(saved.sources) || !object(saved.state)) {
      throw new Error('Invalid personal progress profile; saved data preserved');
    }
    const record = clone(saved);
    record.state = parseProgress(JSON.stringify(saved.state), clock());
    const accounted = zero();
    for (const [id, totals] of Object.entries(record.sources)) {
      validId(id); checkedTotals(totals);
      for (const key of FIELDS) accounted[key] = add(accounted[key], totals[key]);
    }
    if (FIELDS.some(key => accounted[key] !== record.state.totals[key])) throw new Error('Progress checkpoint totals do not match the profile; saved data preserved');
    return record;
  }
  function announce(playerId, newlyUnlocked) {
    if (!newlyUnlocked.length) return;
    try { context.onUnlock?.(playerId, newlyUnlocked); }
    catch (error) { console.warn('[OrderToCook] Progress notification: ' + error); }
  }
  function recordEvent(playerId, event) {
    if (['order_completed', 'order_totals'].includes(event?.type)) throw new Error('Order progress requires canonical ledger reconciliation');
    const record = loadProfile(playerId);
    const result = applyProgressEvent(record.state, event, clock());
    if (result.changed) {
      record.state = result.state;
      context.saveProfile(record);
      announce(playerId, result.newlyUnlocked);
    }
    return result.state;
  }
  function reconcilePlayer(playerId, sourceRestaurants = context.restaurants()) {
    const record = loadProfile(playerId);
    const totals = checkedTotals(record.state.totals);
    let changed = false;
    const sourceIds = new Set();
    for (const restaurant of sourceRestaurants) {
      const ledger = ledgerOf(restaurant);
      if (!ledger || !Object.hasOwn(ledger.players, playerId)) continue;
      if (sourceIds.has(ledger.id)) throw new Error('Duplicate progress ledger identity');
      sourceIds.add(ledger.id);
      const current = checkedTotals(ledger.players[playerId]);
      const previous = Object.hasOwn(record.sources, ledger.id) ? checkedTotals(record.sources[ledger.id]) : zero();
      for (const key of FIELDS) {
        if (current[key] < previous[key]) throw new Error('Progress ledger went backwards; saved data preserved');
        const delta = current[key] - previous[key];
        totals[key] = add(totals[key], delta);
        if (delta) changed = true;
      }
      if (!Object.hasOwn(record.sources, ledger.id)) changed = true;
      record.sources[ledger.id] = current;
    }
    const result = applyProgressEvent(record.state, { type: 'order_totals', ...totals }, clock());
    if (changed || result.changed) {
      record.state = result.state;
      context.saveProfile(record);
      announce(playerId, result.newlyUnlocked);
    }
    return result.state;
  }
  function reconcileRestaurant(restaurant) {
    const ledger = ledgerOf(restaurant);
    if (!ledger) return;
    for (const playerId of Object.keys(ledger.players)) reconcilePlayer(playerId, [restaurant]);
  }
  // Checkpoints stay with the personal profile after a restaurant is removed.
  // This allows an acknowledgement/save retry without replaying its earnings.
  return { recordEvent, reconcilePlayer, reconcileRestaurant, getState: playerId => loadProfile(playerId).state };
}
