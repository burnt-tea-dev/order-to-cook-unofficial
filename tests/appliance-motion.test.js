// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceDoorMotion, dishwasherFrame } from '../runtime/BP/scripts/appliance_motion.js';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place, advance } from './appliances.harness.js';

const state = (block, key) => block.permutation.getState(`ordertocook:${key}`);
// Inject documented after-event payloads. These are script adapter tests, not
// proof that a real client opened or closed the native inventory screen.
const opened = (service, block, player) => service.onContainerOpened({ block, openSource: { entity: player } });
const closed = (service, block, player) => service.onContainerClosed({ block, closeSource: { entity: player } });

test('door motion takes 20 loaded ticks and reverses from its current angle', () => {
  let motion = advanceDoorMotion(0, true, 8);
  assert.deepEqual(motion, { position: 8, frame: 4, closing: false });
  motion = advanceDoorMotion(motion, false, 2);
  assert.deepEqual(motion, { position: 6, frame: 3, closing: false });
  motion = advanceDoorMotion(motion, true, 2);
  assert.deepEqual(motion, { position: 8, frame: 4, closing: false });
  assert.deepEqual(advanceDoorMotion(motion, true, 12), { position: 20, frame: 10, closing: false });
  assert.deepEqual(advanceDoorMotion(20, false, 20), { position: 0, frame: 0, closing: false });
  assert.equal(advanceDoorMotion(20, true, 10000).position, 20);
  assert.equal(advanceDoorMotion(0, false, 10000).position, 0);
});

test('dishwasher frames derive from saved phase and timer including the second wash loop', () => {
  assert.equal(dishwasherFrame({ phase: 2, remainingTicks: 30, plates: 16 }), 0);
  assert.equal(dishwasherFrame({ phase: 2, remainingTicks: 20, plates: 16 }), 5);
  assert.equal(dishwasherFrame({ phase: 3, remainingTicks: 70, plates: 16 }), 4);
  assert.equal(dishwasherFrame({ phase: 3, remainingTicks: 30, plates: 16 }), 4);
  assert.equal(dishwasherFrame({ phase: 4, remainingTicks: 12, plates: 16 }), 7);
  assert.equal(dishwasherFrame({ phase: 5, remainingTicks: 0, plates: 16 }), 15);
  assert.equal(dishwasherFrame({ phase: 1, remainingTicks: 7, plates: 0 }), 7);
  assert.equal(dishwasherFrame({ phase: 0, remainingTicks: 0, plates: 0 }), 0);
});

test('a full close selects the original close clip and reopening reverses that same visible clip', () => {
  let motion = advanceDoorMotion({ position: 20, closing: false }, false, 6);
  assert.deepEqual(motion, { position: 14, frame: 3, closing: true });
  assert.deepEqual(advanceDoorMotion(motion, true, 0), motion, 'Changing target alone never swaps curves.');
  motion = advanceDoorMotion(motion, true, 2);
  assert.deepEqual(motion, { position: 16, frame: 2, closing: true });
  motion = advanceDoorMotion(motion, true, 4);
  assert.deepEqual(motion, { position: 20, frame: 10, closing: false });
  assert.deepEqual(advanceDoorMotion(motion, false, 20), { position: 0, frame: 0, closing: false });
});

test('separate native refrigerator events count all viewers and preserve both real containers', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(lower); service.tick();
  const upper = env.dimension.getBlock({ x: 0, y: 1, z: 0 });
  const station = env.ctx.getStation(lower), container = service.getStorage(station);
  const lowerContainer = lower.getComponent('minecraft:inventory').container, upperContainer = upper.getComponent('minecraft:inventory').container;
  const apple = new FakeItem('minecraft:apple', 7); apple.nameTag = 'Saved stock'; container.setItem(27, apple);
  const players = [new FakePlayer(env.dimension), new FakePlayer(env.dimension), new FakePlayer(env.dimension)];
  opened(service, lower, players[0]); advance(service, env, 10);
  assert.equal(state(lower, 'frame'), 5); assert.equal(state(upper, 'frame'), 0);
  opened(service, lower, players[0]); // An identical event must not add a second viewer.
  opened(service, lower, players[1]); opened(service, upper, players[2]); advance(service, env, 10);
  assert.equal(state(lower, 'frame'), 10); assert.equal(state(upper, 'frame'), 5);
  closed(service, lower, players[0]); advance(service, env, 10);
  assert.equal(state(lower, 'open'), true); assert.equal(state(lower, 'frame'), 10); assert.equal(state(upper, 'frame'), 10);
  closed(service, lower, players[1]); advance(service, env, 6);
  assert.equal(state(lower, 'open'), false); assert.equal(state(lower, 'closing'), true); assert.equal(state(lower, 'frame'), 3); assert.equal(state(upper, 'frame'), 10);
  closed(service, upper, players[2]); advance(service, env, 20);
  assert.equal(state(lower, 'frame'), 0); assert.equal(state(upper, 'frame'), 0);
  assert.equal(env.dimension.spawnCount, 0); assert.equal(station.storageId, undefined);
  assert.equal(lower.getComponent('minecraft:inventory').container, lowerContainer);
  assert.equal(upper.getComponent('minecraft:inventory').container, upperContainer);
  assert.equal(container.getItem(27).amount, 7); assert.equal(container.getItem(27).nameTag, 'Saved stock');
});

test('reopening a closing native compartment reverses without an endpoint jump', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx), player = new FakePlayer(env.dimension);
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(lower); service.tick();
  opened(service, lower, player); advance(service, env, 8); assert.equal(state(lower, 'frame'), 4);
  closed(service, lower, player); advance(service, env, 2); assert.equal(state(lower, 'frame'), 3);
  opened(service, lower, player); assert.equal(state(lower, 'frame'), 3);
  advance(service, env, 2); assert.equal(state(lower, 'frame'), 4);
});

test('unload clears native viewer bookkeeping and closes on reload without replacing cargo', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx), player = new FakePlayer(env.dimension);
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(lower); service.tick();
  const station = env.ctx.getStation(lower), originalContainer = lower.getComponent('minecraft:inventory').container;
  service.getStorage(station).setItem(27, new FakeItem('minecraft:apple', 4));
  const oldGetBlock = env.dimension.getBlock;
  try {
    opened(service, lower, player); advance(service, env, 10); assert.equal(state(lower, 'frame'), 5);
    env.dimension.getBlock = () => undefined; advance(service, env, 200);
    env.dimension.getBlock = oldGetBlock; advance(service, env, 1);
    assert.equal(state(lower, 'open'), false); assert.equal(state(lower, 'frame'), 5);
    closed(service, lower, player); advance(service, env, 10);
    assert.equal(state(lower, 'frame'), 0); assert.equal(player.container.emptySlotsCount, 36);
    assert.equal(service.getStorage(station).getItem(27).amount, 4); assert.equal(station.storageId, undefined); assert.equal(env.dimension.spawnCount, 0);
    assert.equal(lower.getComponent('minecraft:inventory').container, originalContainer);
  } finally { env.dimension.getBlock = oldGetBlock; }
});

test('player departure removes only that native viewer and leaves the other compartment open', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  service.init();
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(lower); service.tick();
  const upper = env.dimension.getBlock({ x: 0, y: 1, z: 0 });
  const first = new FakePlayer(env.dimension), second = new FakePlayer(env.dimension);
  opened(service, lower, first); opened(service, upper, second); advance(service, env, 20);
  for (const callback of env.world.afterEvents.playerLeave.subscriptions) callback({ playerId: first.id });
  advance(service, env, 20);
  assert.equal(state(lower, 'open'), false); assert.equal(state(lower, 'frame'), 0);
  assert.equal(state(upper, 'open'), true); assert.equal(state(upper, 'frame'), 10);
  assert.equal(env.dimension.spawnCount, 0);
});

test('a loaded fridge closes stale persisted frames after service restart without touching its native inventory', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower', 'ordertocook:open': true, 'ordertocook:frame': 10 });
  service.onPlace(lower);
  const station = env.ctx.getStation(lower);
  service.getStorage(station).setItem(0, new FakeItem('minecraft:apple', 9));
  const upper = env.dimension.getBlock({ x: 0, y: 1, z: 0 }), originalContainer = upper.getComponent('minecraft:inventory').container;
  const restarted = appliances.createApplianceService(env.ctx);
  env.system.currentTick = 5000; restarted.tick();
  assert.equal(state(lower, 'open'), false); assert.equal(state(lower, 'frame'), 10);
  advance(restarted, env, 20); assert.equal(state(lower, 'frame'), 0);
  assert.equal(station.storageId, undefined); assert.equal(restarted.getStorage(station).getItem(0).amount, 9);
  assert.equal(upper.getComponent('minecraft:inventory').container, originalContainer);
});

test('dishwasher unload and restart resume the persisted pose and generate no second batch', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  let service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:dishwasher'); service.onPlace(block); service.tick();
  const station = env.ctx.getStation(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate', 16)); service.onInteract(player, block);
  advance(service, env, 10); assert.equal(state(block, 'frame'), 5);
  const oldGetBlock = env.dimension.getBlock;
  env.dimension.getBlock = () => undefined; advance(service, env, 200); env.dimension.getBlock = oldGetBlock;
  assert.equal(station.appliance.remainingTicks, 20);
  advance(service, env, 1); assert.equal(state(block, 'frame'), 5); advance(service, env, 20);
  assert.equal(station.appliance.phase, 3); advance(service, env, 10); assert.equal(state(block, 'frame'), 4);
  block.setPermutation(block.permutation.withState('ordertocook:frame', 0));
  service = appliances.createApplianceService(env.ctx); env.system.currentTick += 5000; service.tick();
  assert.equal(station.appliance.remainingTicks, 70); assert.equal(state(block, 'frame'), 4);
  advance(service, env, 94); assert.equal(station.appliance.phase, 5); assert.equal(state(block, 'frame'), 15);
  service.onInteract(player, block); assert.equal(state(block, 'frame'), 0); advance(service, env, 14);
  assert.equal(station.appliance.phase, 0); service.onInteract(player, block);
  assert.equal(player.container.getItem(0).typeId, 'ordertocook:clean_plate'); assert.equal(player.container.getItem(0).amount, 16);
  assert.equal(env.dimension.drops.length, 0);
});

function pairedFridge() {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(lower); service.tick();
  const upper = env.dimension.getBlock({ x: 0, y: 1, z: 0 });
  const lowerPlayer = new FakePlayer(env.dimension), upperPlayer = new FakePlayer(env.dimension);
  return { env, service, lower, upper, lowerPlayer, upperPlayer };
}
const roots = (lower, upper, expected) => {
  assert.equal(state(lower, 'root_frame'), expected, 'lower shared root');
  assert.equal(state(upper, 'root_frame'), expected, 'upper shared root');
};

test('shared root selector uses last active controller, including neutral lower samples', async () => {
  const { fridgeRootFrame } = await import('../runtime/BP/scripts/appliance_motion.js');
  const close = frame => ({ closing: true, position: 20 - frame * 2, frame });
  assert.equal(fridgeRootFrame(close(4), undefined), 1);
  assert.equal(fridgeRootFrame(close(5), close(6)), 3);
  assert.equal(fridgeRootFrame(close(6), close(1)), 0);
  // A zero-elapsed restore can retain an active close at either endpoint.
  assert.equal(fridgeRootFrame(close(5), close(0)), 0);
  assert.equal(fridgeRootFrame(close(5), close(10)), 0);
  assert.equal(fridgeRootFrame(close(6), { ...close(4), closing: false }), 3);
  for (const bad of [undefined, { closing: true, position: NaN, frame: 4 },
    { closing: true, position: -1, frame: 4 }, { closing: true, position: 21, frame: 4 },
    { closing: true, position: 12, frame: -1 }, { closing: true, position: 12, frame: 4.5 }])
    assert.equal(fridgeRootFrame(undefined, bad), 0);
});

test('a closing half drives the fully open half and preserves native inventory identity', () => {
  const { env, service, lower, upper, lowerPlayer, upperPlayer } = pairedFridge();
  const containers = [lower, upper].map(block => block.getComponent('minecraft:inventory').container);
  containers[0].setItem(0, new FakeItem('minecraft:apple', 6));
  containers[1].setItem(0, new FakeItem('minecraft:carrot', 3));
  opened(service, lower, lowerPlayer); opened(service, upper, upperPlayer); advance(service, env, 20);
  closed(service, upper, upperPlayer); advance(service, env, 8);
  assert.equal(state(lower, 'frame'), 10); assert.equal(state(lower, 'closing'), false);
  assert.equal(state(upper, 'frame'), 4); roots(lower, upper, 1);
  advance(service, env, 2); roots(lower, upper, 2);
  advance(service, env, 2); roots(lower, upper, 3);
  advance(service, env, 2); roots(lower, upper, 0);
  assert.equal(lower.getComponent('minecraft:inventory').container, containers[0]);
  assert.equal(upper.getComponent('minecraft:inventory').container, containers[1]);
  assert.equal(containers[0].getItem(0).amount, 6); assert.equal(containers[1].getItem(0).amount, 3);
});

test('staggered closes use lower precedence even while its root is neutral', () => {
  const { env, service, lower, upper, lowerPlayer, upperPlayer } = pairedFridge();
  opened(service, lower, lowerPlayer); opened(service, upper, upperPlayer); advance(service, env, 20);
  closed(service, upper, upperPlayer); advance(service, env, 8); roots(lower, upper, 1);
  closed(service, lower, lowerPlayer); advance(service, env, 2);
  assert.equal(state(upper, 'frame'), 5); assert.equal(state(lower, 'frame'), 1); roots(lower, upper, 0);
  advance(service, env, 6);
  assert.equal(state(upper, 'frame'), 8); assert.equal(state(lower, 'frame'), 4); roots(lower, upper, 1);
  advance(service, env, 12); roots(lower, upper, 0);
});

test('closing-clip reversal keeps bounded behavior and updates the shared root', () => {
  const { env, service, lower, upper, lowerPlayer } = pairedFridge();
  opened(service, lower, lowerPlayer); advance(service, env, 20);
  closed(service, lower, lowerPlayer); advance(service, env, 12); roots(lower, upper, 3);
  opened(service, lower, lowerPlayer); advance(service, env, 2);
  assert.equal(state(lower, 'closing'), true); assert.equal(state(lower, 'frame'), 5); roots(lower, upper, 2);
  advance(service, env, 2); roots(lower, upper, 1);
  advance(service, env, 8); assert.equal(state(lower, 'closing'), false); roots(lower, upper, 0);
});

test('missing upper half cannot leave its deformation on the remaining half', () => {
  const { env, service, lower, upper, upperPlayer } = pairedFridge();
  opened(service, upper, upperPlayer); advance(service, env, 20);
  closed(service, upper, upperPlayer); advance(service, env, 10); roots(lower, upper, 2);
  const getBlock = env.dimension.getBlock;
  env.dimension.getBlock = location => location.y === 1 ? undefined : getBlock.call(env.dimension, location);
  advance(service, env, 1); assert.equal(state(lower, 'root_frame'), 0);
  env.dimension.getBlock = getBlock;
  advance(service, env, 1); roots(lower, upper, 3); // Resumes upper's persisted close pose, not deleted cache.
});

test('restart and unload derive shared root from persisted door clips, not stale root states', () => {
  const { env, service, lower, upper } = pairedFridge();
  lower.setPermutation(lower.permutation.withState('ordertocook:frame', 5).withState('ordertocook:closing', true).withState('ordertocook:root_frame', 3));
  upper.setPermutation(upper.permutation.withState('ordertocook:root_frame', 1));
  const restarted = appliances.createApplianceService(env.ctx);
  env.system.currentTick += 100; restarted.tick(); roots(lower, upper, 2);
  const getBlock = env.dimension.getBlock;
  env.dimension.getBlock = () => undefined; advance(restarted, env, 200);
  lower.setPermutation(lower.permutation.withState('ordertocook:frame', 4).withState('ordertocook:root_frame', 3));
  env.dimension.getBlock = getBlock; advance(restarted, env, 1); roots(lower, upper, 1);
  advance(restarted, env, 20); roots(lower, upper, 0);
  for (const endpoint of [0, 10]) {
    lower.setPermutation(lower.permutation.withState('ordertocook:closing', true).withState('ordertocook:frame', endpoint));
    upper.setPermutation(upper.permutation.withState('ordertocook:closing', true).withState('ordertocook:frame', 5));
    const restored = appliances.createApplianceService(env.ctx);
    env.system.currentTick += 100; restored.tick();
    assert.equal(state(lower, 'closing'), true);
    roots(lower, upper, 0); // Lower's active neutral endpoint still overwrites upper.
  }
});

test('partial root write failure retries next tick and idle neutral poses do not rewrite', () => {
  const { env, service, lower, upper, lowerPlayer } = pairedFridge();
  opened(service, lower, lowerPlayer); advance(service, env, 20);
  closed(service, lower, lowerPlayer); advance(service, env, 6);
  const setPermutation = upper.setPermutation.bind(upper);
  let failed = false, writes = 0;
  upper.setPermutation = permutation => {
    writes++;
    if (!failed && permutation.getState('ordertocook:root_frame') === 1) { failed = true; throw Error('transient pose write'); }
    setPermutation(permutation);
  };
  advance(service, env, 1);
  assert.equal(failed, true); assert.equal(state(lower, 'root_frame'), 1); assert.equal(state(upper, 'root_frame'), 0);
  advance(service, env, 1); roots(lower, upper, 1); // Retry even when the rounded pose has not changed.
  advance(service, env, 4); roots(lower, upper, 3);
  let failedNeutral = false;
  upper.setPermutation = permutation => {
    writes++;
    if (!failedNeutral && permutation.getState('ordertocook:root_frame') === 0) {
      failedNeutral = true; throw Error('transient neutral write');
    }
    setPermutation(permutation);
  };
  // A capped large tick reaches the neutral endpoint in one update.
  env.system.currentTick += 20; service.tick();
  assert.equal(failedNeutral, true);
  assert.equal(state(lower, 'root_frame'), 0); assert.equal(state(upper, 'root_frame'), 3);
  advance(service, env, 1); roots(lower, upper, 0);
  const settledWrites = writes; let lowerWrites = 0;
  const setLower = lower.setPermutation.bind(lower);
  lower.setPermutation = permutation => { lowerWrites++; setLower(permutation); };
  advance(service, env, 40);
  assert.equal(writes, settledWrites); assert.equal(lowerWrites, 0);
});


test('throwing upper lookup clears its shared deformation without touching cargo', () => {
  const { env, service, lower, upper, upperPlayer } = pairedFridge();
  const containers = [lower, upper].map(block => block.getComponent('minecraft:inventory').container);
  containers[0].setItem(0, new FakeItem('minecraft:apple', 6));
  containers[1].setItem(0, new FakeItem('minecraft:carrot', 3));
  opened(service, upper, upperPlayer); advance(service, env, 20);
  closed(service, upper, upperPlayer); advance(service, env, 10); roots(lower, upper, 2);
  const getBlock = env.dimension.getBlock;
  try {
    env.dimension.getBlock = location => {
      if (location.y === 1) throw Error('upper chunk unavailable');
      return getBlock.call(env.dimension, location);
    };
    advance(service, env, 1); assert.equal(state(lower, 'root_frame'), 0);
  } finally { env.dimension.getBlock = getBlock; }
  advance(service, env, 1); roots(lower, upper, 3);
  assert.equal(lower.getComponent('minecraft:inventory').container, containers[0]);
  assert.equal(upper.getComponent('minecraft:inventory').container, containers[1]);
  assert.equal(containers[0].getItem(0).amount, 6); assert.equal(containers[1].getItem(0).amount, 3);
});

test('throwing upper lookup clears viewers and restores persisted motion instead of its old cache', () => {
  const { env, service, lower, upper, upperPlayer } = pairedFridge();
  opened(service, upper, upperPlayer); advance(service, env, 20);
  assert.equal(state(upper, 'open'), true); assert.equal(state(upper, 'frame'), 10);
  const getBlock = env.dimension.getBlock;
  try {
    env.dimension.getBlock = location => {
      if (location.y === 1) throw Error('upper chunk unavailable');
      return getBlock.call(env.dimension, location);
    };
    advance(service, env, 1);
    upper.setPermutation(upper.permutation.withState('ordertocook:closing', true).withState('ordertocook:frame', 4));
  } finally { env.dimension.getBlock = getBlock; }
  advance(service, env, 1);
  assert.equal(state(upper, 'open'), false, 'Unavailable half must lose its native viewer.');
  assert.equal(state(upper, 'closing'), true);
  assert.equal(state(upper, 'frame'), 5, 'Restore uses persisted close frame4, not cached open frame10.');
  roots(lower, upper, 2);
});
