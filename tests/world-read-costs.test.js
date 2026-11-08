// SPDX-License-Identifier: GPL-3.0-only
// Exact calls through shipped store/appliance code with native IO doubles.
// These budgets establish redundant-read removal, not native MSPT/TPS gains.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture } from './main.harness.js';
import { appliances, FakePermutation, makeEnvironment, place } from './appliances.harness.js';

async function restaurantsFixture(entries) {
  const env = await mainFixture(); env.store.deleteRestaurant(env.restaurant.id);
  const records = entries.map(([id, x, z = 0, dimensionId = env.dimension.id]) => {
    const location = { x, y: 64, z }, record = env.core.createRestaurant({ id, ownerId: id, dimensionId, location });
    env.store.saveRestaurant(record);
    if (dimensionId === env.dimension.id) place(env, 'ordertocook:order_machine', location);
    return record;
  });
  const get = env.dimension.getBlock.bind(env.dimension), modes = new Map(), reads = [];
  env.dimension.getBlock = location => {
    reads.push({ ...location }); const mode = modes.get(location.x);
    if (mode === 'unloaded') throw Error('chunk unavailable');
    if (mode === 'missing') return undefined;
    if (mode === 'removed') return { typeId: 'minecraft:air' };
    return get(location);
  };
  const query = { dimension: env.dimension, location: { x: 0, y: 64, z: 0 } };
  return { ...env, records, modes, reads, query,
    nearest() { reads.length = 0; return env.store.nearestRestaurant(query); } };
}

test('nearest restaurant stops native reads at the first valid distance-sorted candidate', async () => {
  // The larger set is a synthetic lookup fixture, not simulated players or a
  // claim that placement rules admit this density in an ordinary new world.
  const env = await restaurantsFixture(Array.from({ length: 20 }, (_, index) => [`r${index}`, 20 - index]));
  assert.equal(env.nearest(), env.records[19]); assert.equal(env.reads.length, 1);
  const ties = await restaurantsFixture([['west', -2], ['east', 2]]);
  assert.equal(ties.nearest(), ties.records[0]); assert.deepEqual(ties.reads.map(p => p.x), [-2]);
});

test('nearest lookup retries unavailable candidates and rechecks load state on every call', async () => {
  const env = await restaurantsFixture([['outside', 25], ['other-world', 0, 0, 'minecraft:nether'], ['far', 3], ['middle', 2], ['near', 1]]);
  env.modes.set(1, 'unloaded'); env.modes.set(2, 'removed');
  assert.equal(env.nearest(), env.records[2]); assert.equal(env.reads.length, 3);
  env.modes.set(3, 'missing'); assert.equal(env.nearest(), undefined); assert.equal(env.reads.length, 3);
  env.modes.delete(1); assert.equal(env.nearest(), env.records[4]);
  assert.ok(env.reads.every(p => p.x >= 1 && p.x <= 3), 'dimension/radius filtering precedes world reads');
  env.records[4].location.x = 24; place(env, 'ordertocook:order_machine', env.records[4].location);
  assert.equal(env.nearest(), env.records[4]); assert.equal(env.reads.at(-1).x, 24, 'the radius boundary remains inclusive');
});

test('nearest lookup sees canonical rollback, metadata changes and membership without a cache', async () => {
  const env = await restaurantsFixture([['near', 1], ['far', 20]]), stale = env.records[0];
  stale.location.x = 100; env.records[1].ownerId = 'new-owner';
  assert.equal(env.nearest(), env.records[1]); assert.equal(env.nearest().ownerId, 'new-owner');
  env.failWrite(key => key === 'ordertocook:r:near');
  assert.throws(() => env.store.saveRestaurant(stale), /persistence failure/);
  const canonical = env.store.getRestaurant('near'); assert.notEqual(canonical, stale);
  assert.equal(env.nearest(), canonical); assert.equal(canonical.location.x, 1);
  env.store.deleteRestaurant('near'); assert.equal(env.nearest(), env.records[1]);
});

test('main permissions still follow the nearest live owner and immediate staff changes', async () => {
  const env = await mainFixture(), shelf = place(env, 'ordertocook:shelf', { x: 3, y: 0, z: 0 });
  const station = env.store.getStation(shelf); station.ownerId = env.player.id; env.store.saveStation(station);
  const machine = place(env, 'ordertocook:order_machine', { x: 4, y: 0, z: 0 });
  const near = { ...structuredClone(env.restaurant), id: 'near', location: { ...machine.location }, ownerId: 'other-owner', staff: [], orders: [] };
  env.store.saveRestaurant(near);
  assert.equal(env.hooks.canUseStation(env.player, station), false, 'a farther owned restaurant or owned shelf cannot override the nearest owner');
  near.staff.push(env.player.id); assert.equal(env.hooks.canUseStation(env.player, station), true);
  near.staff.length = 0; assert.equal(env.hooks.canUseStation(env.player, station), false);
  machine.setType('minecraft:air'); assert.equal(env.hooks.canUseStation(env.player, station), true);
  machine.setType('ordertocook:order_machine'); assert.equal(env.hooks.canUseStation(env.player, station), false);
  near.staff.push(env.player.id); env.failWrite(key => key === 'ordertocook:r:near');
  assert.throws(() => env.store.saveRestaurant(near));
  assert.notEqual(env.store.getRestaurant('near'), near); assert.equal(env.hooks.canUseStation(env.player, station), false);
});

test('dishwasher updates visuals once per tick while preserving every phase boundary and write count', () => {
  const expected = [
    { phase: 0, remaining: 30, frame: 0, writes: 0, saves: 0 },
    { phase: 0, remaining: 0, frame: 0, writes: 2, saves: 1 },
    { phase: 2, remaining: 28, frame: 1, writes: 1, saves: 0 },
    { phase: 3, remaining: 28, frame: 4, writes: 0, saves: 0 },
    { phase: 5, remaining: 0, frame: 15, writes: 2, saves: 1 },
    { phase: 5, remaining: 30, frame: 15, writes: 0, saves: 0 }
  ];
  for (let phase = 0; phase <= 5; phase++) {
    const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx), block = place(env, 'ordertocook:dishwasher');
    service.onPlace(block); const station = env.ctx.getStation(block);
    Object.assign(station.appliance, { phase, plates: phase >= 2 ? 2 : 0, remainingTicks: phase === 1 || phase === 4 ? 1 : 30 });
    service.tick();
    const counts = { blocks: 0, states: 0, writes: 0, saves: 0 };
    const get = env.dimension.getBlock.bind(env.dimension), state = FakePermutation.prototype.getState;
    const set = block.setPermutation.bind(block), save = env.ctx.saveStation;
    env.dimension.getBlock = location => { counts.blocks++; return get(location); };
    block.setPermutation = permutation => { counts.writes++; return set(permutation); };
    env.ctx.saveStation = value => { counts.saves++; return save(value); };
    FakePermutation.prototype.getState = function (...args) { counts.states++; return state.apply(this, args); };
    try { env.system.currentTick = 2; service.tick(); }
    finally { FakePermutation.prototype.getState = state; }
    const active = phase > 0 && phase < 5, result = expected[phase];
    assert.deepEqual(counts, { blocks: active ? 3 : 2, states: active ? 5 : 4, writes: result.writes, saves: result.saves }, `phase ${phase}`);
    assert.equal(station.appliance.phase, result.phase); assert.equal(station.appliance.remainingTicks, result.remaining);
    assert.equal(block.permutation.getState('ordertocook:phase'), result.phase);
    assert.equal(block.permutation.getState('ordertocook:frame'), result.frame);
    assert.equal(block.permutation.getState('ordertocook:plates'), phase >= 2 ? 2 : 0);
  }
});

test('a transient cosmetic getter failure retries on the next normal dishwasher update', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx), block = place(env, 'ordertocook:dishwasher');
  service.onPlace(block); const station = env.ctx.getStation(block);
  Object.assign(station.appliance, { phase: 2, plates: 2, remainingTicks: 30 }); service.tick();
  const getState = FakePermutation.prototype.getState; let failed = false;
  FakePermutation.prototype.getState = function (name) {
    if (!failed && name === 'ordertocook:frame') { failed = true; throw Error('temporary visual read failure'); }
    return getState.call(this, name);
  };
  try { env.system.currentTick = 2; service.tick(); }
  finally { FakePermutation.prototype.getState = getState; }
  assert.equal(failed, true); assert.equal(station.appliance.remainingTicks, 28);
  assert.equal(block.permutation.getState('ordertocook:frame'), 0, 'no accidental duplicate-pass retry in the same update');
  env.system.currentTick = 4; service.tick();
  assert.equal(station.appliance.remainingTicks, 26); assert.equal(station.appliance.plates, 2);
  assert.equal(block.permutation.getState('ordertocook:frame'), 2);
});
