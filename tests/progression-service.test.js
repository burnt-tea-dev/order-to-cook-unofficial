// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressionService, creditCompletedOrder, queueProgressEvent } from '../runtime/BP/scripts/progression_service.js';

const copy = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const records = new Map(), restaurants = [], unlocks = [];
  let fail = false, writes = 0;
  const service = createProgressionService({
    now: () => 1000,
    getProfile: id => records.get(id),
    saveProfile: value => {
      if (fail) { fail = false; throw Error('profile save unavailable'); }
      records.set(value.id, copy(value)); writes++;
    },
    restaurants: () => restaurants,
    onUnlock: (id, definitions) => unlocks.push([id, definitions.map(value => value.id)])
  });
  return { service, records, restaurants, unlocks, failNext: () => { fail = true; }, writes: () => writes };
}
function restaurant(id = 'overworld_0_0_0', createdAt = 10) {
  return { id, createdAt, orders: [], ownerId: 'owner', dimensionId: 'minecraft:overworld' };
}
function paid(r, id, reward, options = {}) {
  const order = { id: r.id + ':' + id, status: 'completed', paidReward: reward, type: 'dine_in', ...options };
  r.orders.push(order); return order;
}

test('committed cumulative ledger credits the actual deliverer and retries exactly once', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  const order = paid(r, 'one', 107, { rush: true });
  assert.equal(creditCompletedOrder(r, 'courier', order), true);
  assert.equal(creditCompletedOrder(r, 'courier', order), false);
  const first = env.service.reconcilePlayer('courier');
  assert.deepEqual(first.totals, { earned: 107, completed: 1, urgent: 1, longDistance: 0 });
  assert.deepEqual(env.service.getState('owner').totals, { earned: 0, completed: 0, urgent: 0, longDistance: 0 });
  assert.equal(env.writes(), 1);
  const announcements = copy(env.unlocks);
  env.service.reconcileRestaurant(r); env.service.reconcilePlayer('courier');
  assert.equal(env.writes(), 1); assert.deepEqual(env.unlocks, announcements);
});

test('personal income spans restaurants and remains after every restaurant is removed', () => {
  const env = fixture(), a = restaurant(), b = restaurant('nether_0_0_0');
  env.restaurants.push(a, b);
  creditCompletedOrder(a, 'worker', paid(a, 'one', 40));
  creditCompletedOrder(b, 'worker', paid(b, 'two', 65, { type: 'delivery', longDistance: true }));
  const state = env.service.reconcilePlayer('worker');
  assert.deepEqual(state.totals, { earned: 105, completed: 2, urgent: 0, longDistance: 1 });
  assert.ok(state.unlocked.earn_100);
  env.restaurants.length = 0;
  assert.deepEqual(env.service.reconcilePlayer('worker').totals, state.totals);
});

test('profile write failure leaves the committed ledger available after history trimming', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'offline-worker', paid(r, 'one', 70));
  env.failNext();
  assert.throws(() => env.service.reconcileRestaurant(r), /save unavailable/);
  assert.equal(env.records.has('offline-worker'), false); assert.equal(env.unlocks.length, 0);
  r.orders = [];
  creditCompletedOrder(r, 'offline-worker', paid(r, 'two', 40));
  r.orders = [];
  env.service.reconcileRestaurant(r);
  assert.equal(env.service.getState('offline-worker').totals.earned, 110);
  assert.equal(env.service.getState('offline-worker').totals.completed, 2);
  env.service.reconcileRestaurant(r);
  assert.equal(env.writes(), 1);
});

test('reloading saved profiles and restaurant ledgers does not replay earnings', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'p', paid(r, 'one', 90)); env.service.reconcilePlayer('p');
  const next = fixture();
  next.records.set('p', copy(env.records.get('p'))); next.restaurants.push(copy(r));
  assert.equal(next.service.reconcilePlayer('p').totals.earned, 90);
  assert.equal(next.writes(), 0); assert.deepEqual(next.unlocks, []);
  const again = next.restaurants[0];
  creditCompletedOrder(again, 'p', paid(again, 'two', 15));
  assert.equal(next.service.reconcilePlayer('p').totals.earned, 105);
  assert.equal(next.writes(), 1);
});

test('a new restaurant at a reused coordinate has a different source checkpoint', () => {
  const env = fixture(), first = restaurant(); env.restaurants.push(first);
  creditCompletedOrder(first, 'p', paid(first, 'one', 80)); env.service.reconcileRestaurant(first);
  env.restaurants.length = 0;
  const next = restaurant(first.id, 20); env.restaurants.push(next);
  creditCompletedOrder(next, 'p', paid(next, 'one', 30));
  assert.notEqual(first.progressLedger.id, next.progressLedger.id);
  assert.equal(env.service.reconcilePlayer('p').totals.earned, 110);
});

test('alpha.2 restaurant statistics and old paid history are never assigned to a player', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  r.stats = { earnings: 99999, completed: 1000 };
  paid(r, 'historical', 99999);
  assert.equal(env.service.reconcilePlayer('p').totals.earned, 0);
  assert.equal(env.writes(), 0);
  creditCompletedOrder(r, 'p', paid(r, 'new', 5));
  assert.equal(env.service.reconcilePlayer('p').totals.earned, 5);
});

test('one restaurant tracks different physical proof holders independently', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'alice', paid(r, 'a', 10));
  creditCompletedOrder(r, 'bob', paid(r, 'b', 20, { rush: true }));
  env.service.reconcileRestaurant(r);
  assert.equal(env.service.getState('alice').totals.earned, 10);
  assert.equal(env.service.getState('bob').totals.earned, 20);
  assert.equal(env.service.getState('alice').totals.urgent, 0);
  assert.equal(env.service.getState('bob').totals.urgent, 1);
});

test('bad profile data is preserved and never silently replaced with zero progress', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'p', paid(r, 'one', 10));
  const damaged = { id: 'p', sources: {}, state: { version: 99, totals: { earned: 1000 } } };
  env.records.set('p', copy(damaged));
  assert.throws(() => env.service.reconcilePlayer('p'));
  assert.deepEqual(env.records.get('p'), damaged); assert.equal(env.writes(), 0);
});

test('a backwards source checkpoint refuses reconciliation without changing the profile', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'p', paid(r, 'one', 100));
  env.service.reconcilePlayer('p');
  const saved = copy(env.records.get('p'));
  r.progressLedger.players.p.earned = 1;
  assert.throws(() => env.service.reconcilePlayer('p'), /backwards/);
  assert.deepEqual(env.records.get('p'), saved);
});

test('a duplicate ledger identity cannot be double-counted in the same reconciliation', () => {
  const env = fixture(), r = restaurant();
  creditCompletedOrder(r, 'p', paid(r, 'one', 100)); env.restaurants.push(r, copy(r));
  assert.throws(() => env.service.reconcilePlayer('p'), /Duplicate progress ledger/);
  assert.equal(env.records.has('p'), false); assert.equal(env.writes(), 0);
});

test('noncanonical, unpaid, and conflicting delivery receipts cannot create progress', () => {
  const env = fixture(), r = restaurant(), order = paid(r, 'one', 5);
  assert.throws(() => creditCompletedOrder(r, 'p', { ...order }), /canonical/);
  order.status = 'packed';
  assert.throws(() => creditCompletedOrder(r, 'p', order), /canonical/);
  assert.equal(r.progressLedger, undefined);
  order.status = 'completed'; creditCompletedOrder(r, 'p', order);
  const before = copy(r.progressLedger);
  assert.throws(() => creditCompletedOrder(r, 'q', order), /Conflicting/);
  assert.deepEqual(r.progressLedger, before);
});

test('overflow aborts before mutating either the ledger or the order receipt', () => {
  const r = restaurant(), first = paid(r, 'one', Number.MAX_SAFE_INTEGER);
  creditCompletedOrder(r, 'p', first);
  const before = copy(r.progressLedger), second = paid(r, 'two', 1);
  assert.throws(() => creditCompletedOrder(r, 'p', second), /overflow/);
  assert.deepEqual(r.progressLedger, before); assert.equal(second.progressionReceipt, undefined);
});

test('failed cosmetic event saves neither unlocks nor announces; retry can succeed', () => {
  const env = fixture(); env.failNext();
  assert.throws(() => env.service.recordEvent('p', { type: 'order_machine_placed' }), /save unavailable/);
  assert.equal(env.records.has('p'), false); assert.equal(env.unlocks.length, 0);
  env.service.recordEvent('p', { type: 'order_machine_placed' });
  assert.ok(env.service.getState('p').unlocked.root);
  assert.equal(env.unlocks.length, 1);
  env.service.recordEvent('p', { type: 'order_machine_placed' });
  assert.equal(env.unlocks.length, 1);
});

test('public cosmetic events cannot bypass the canonical order ledger', () => {
  const env = fixture();
  assert.throws(() => env.service.recordEvent('p', { type: 'order_completed', reward: 10000 }), /canonical ledger/);
  assert.throws(() => env.service.recordEvent('p', { type: 'order_totals', earned: 10000, completed: 1, urgent: 0, longDistance: 0 }), /canonical ledger/);
  assert.equal(env.records.has('p'), false);
});

test('a well-formed but inconsistent personal checkpoint is preserved for recovery', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'p', paid(r, 'one', 100));
  env.service.reconcilePlayer('p');
  const damaged = copy(env.records.get('p')); damaged.sources[r.progressLedger.id].earned = 90;
  env.records.set('p', damaged);
  assert.throws(() => env.service.reconcilePlayer('p'), /checkpoint totals/);
  assert.deepEqual(env.records.get('p'), damaged);
});

test('one damaged player cannot block other players but restaurant cleanup still fails closed', () => {
  const env = fixture(), r = restaurant(); env.restaurants.push(r);
  creditCompletedOrder(r, 'alice', paid(r, 'a', 10));
  creditCompletedOrder(r, 'bob', paid(r, 'b', 20));
  const damaged = { id: 'alice', state: { version: 99 }, sources: {} };
  env.records.set('alice', copy(damaged));
  assert.throws(() => env.service.reconcileRestaurant(r), /Pending restaurant progress/);
  assert.equal(env.service.getState('bob').totals.earned, 20);
  assert.deepEqual(env.records.get('alice'), damaged);
  assert.throws(() => env.service.reconcileRestaurant(r));
  assert.equal(env.service.getState('bob').totals.completed, 1);
});

test('earnings without a completed order are rejected in each source before aggregation', () => {
  const env = fixture(), a = restaurant(), b = restaurant('overworld_30_0_0');
  env.restaurants.push(a);
  creditCompletedOrder(a, 'p', paid(a, 'a', 5)); env.service.reconcilePlayer('p');
  const before = copy(env.records.get('p'));
  b.progressLedger = { version: 1, id: 'bad-source', players: { p: { earned: 1000, completed: 0, urgent: 0, longDistance: 0 } } };
  env.restaurants.push(b);
  assert.throws(() => env.service.reconcilePlayer('p'), /Invalid progress totals/);
  assert.deepEqual(env.records.get('p'), before);
});

test('operation acknowledgement failure can replay without granting or announcing twice', () => {
  const records = new Map(), notifications = [];
  let failAck = true;
  const service = createProgressionService({
    now: () => 1000, getProfile: id => records.get(id), saveProfile: record => records.set(record.id, copy(record)),
    restaurants: () => [],
    saveRestaurant: () => { if (failAck) throw Error('ack failed'); },
    onUnlock: (id, values) => notifications.push([id, values.map(value => value.id)])
  });
  const r = restaurant();
  queueProgressEvent(r, 'worker', { type: 'restaurant_upgraded', level: 8 });
  assert.throws(() => service.reconcileRestaurant(r), /ack failed/);
  assert.equal(r.progressEvents.length, 1);
  assert.ok(service.getState('worker').unlocked.eight_star_restaurant);
  failAck = false; service.reconcileRestaurant(r);
  assert.equal(r.progressEvents.length, 0);
  assert.equal(notifications.length, 1);
});
