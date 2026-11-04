// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place, advance } from './appliances.harness.js';

const value = (block, state) => block.permutation.getState(`ordertocook:${state}`);

function setup() {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:dishwasher');
  service.onPlace(block);
  const station = env.ctx.getStation(block), player = new FakePlayer(env.dimension);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate', 2));
  player.viewedBlock = block;
  player.playSound = (id, options) => player.sounds.push({ id, ...options });
  player.sounds = [];
  env.world.players.push(player);
  return { env, service, block, station, player };
}

test('looking with a dirty plate previews the original drawer without moving inventory or saving gameplay state', () => {
  const { env, service, block, station, player } = setup();
  let saves = 0; env.ctx.saveStation = () => { saves++; };
  service.tick();
  assert.equal(value(block, 'phase'), 6);
  assert.equal(value(block, 'frame'), 0);
  advance(service, env, 24);
  assert.equal(value(block, 'frame'), 15);
  assert.equal(station.appliance.phase, 0);
  assert.equal(station.appliance.plates, 0);
  assert.equal(player.container.getItem(0).amount, 2);
  assert.equal(saves, 0);
  assert.deepEqual(player.sounds, [{ id: 'ordertocook:dishwasher_out', location: { x: 0.5, y: 0.6, z: 0.5 }, volume: 0.75, pitch: 1 }]);
  player.viewedBlock = undefined; advance(service, env, 2);
  assert.equal(value(block, 'phase'), 0);
  assert.equal(value(block, 'frame'), 0);
});

test('offhand preview closes on permission loss and never opens a working dishwasher', () => {
  const { env, service, block, station, player } = setup();
  player.container.setItem(0, undefined);
  const getComponent = player.getComponent.bind(player);
  player.getComponent = id => id === 'minecraft:equippable'
    ? { getEquipment: () => new FakeItem('ordertocook:dirty_plate') } : getComponent(id);
  service.tick(); assert.equal(value(block, 'phase'), 6);
  env.ctx.canUseStation = () => false;
  advance(service, env, 2); assert.equal(value(block, 'phase'), 0);
  env.ctx.canUseStation = () => true;
  station.appliance = { ...station.appliance, phase: 3, remainingTicks: 40, plates: 2 };
  advance(service, env, 2); assert.equal(value(block, 'phase'), 3);
  assert.equal(player.sounds.length, 1);
});

test('multiple viewers keep one shared preview open and a batch immediately replaces the preview', () => {
  const { env, service, block, station, player } = setup();
  const other = new FakePlayer(env.dimension);
  other.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  other.viewedBlock = block;
  env.world.players.push(other);
  service.tick(); advance(service, env, 10);
  player.viewedBlock = undefined; advance(service, env, 2);
  assert.equal(value(block, 'phase'), 6);
  assert.equal(value(block, 'frame'), 7);
  service.onInteract(player, block);
  assert.equal(station.appliance.phase, 2);
  assert.equal(station.appliance.plates, 2);
  assert.equal(value(block, 'phase'), 2);
  assert.equal(value(block, 'frame'), 0);
  advance(service, env, 2); assert.equal(value(block, 'phase'), 2);
});

test('preview from an unloaded or removed device does not survive service restart', () => {
  const { env, service, block, station, player } = setup();
  service.tick(); advance(service, env, 10);
  assert.equal(value(block, 'phase'), 6);
  env.world.players = [];
  const restarted = appliances.createApplianceService(env.ctx);
  restarted.tick();
  assert.equal(value(block, 'phase'), 0);
  assert.equal(station.appliance.phase, 0);
  assert.equal(player.container.getItem(0).amount, 2);
});
