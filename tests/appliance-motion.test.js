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
  assert.deepEqual(motion, { position: 8, frame: 4 });
  motion = advanceDoorMotion(motion.position, false, 2);
  assert.deepEqual(motion, { position: 6, frame: 3 });
  motion = advanceDoorMotion(motion.position, true, 2);
  assert.deepEqual(motion, { position: 8, frame: 4 });
  assert.deepEqual(advanceDoorMotion(motion.position, true, 12), { position: 20, frame: 10 });
  assert.deepEqual(advanceDoorMotion(20, false, 20), { position: 0, frame: 0 });
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
  assert.equal(state(lower, 'open'), false); assert.equal(state(lower, 'frame'), 7); assert.equal(state(upper, 'frame'), 10);
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
