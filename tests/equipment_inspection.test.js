// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place, advance } from './appliances.harness.js';

test('washing progress is a read-only HUD source and the service never writes the action bar', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  player.onScreenDisplay.setActionBar = () => { throw Error('multiple action-bar writers'); };
  const block = place(env, 'ordertocook:washingtable');
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block);
  player.viewedBlock = block;
  service.onInteract(player, block);
  service.tick();
  advance(service, env, 40);
  const before = JSON.stringify(env.ctx.getStation(block));
  assert.equal(service.getWashingProgress(player), '§b洗碗中 50%');
  assert.equal(service.getWashingProgress(player), '§b洗碗中 50%');
  assert.equal(JSON.stringify(env.ctx.getStation(block)), before);
  advance(service, env, 40);
  assert.equal(service.getWashingProgress(player), undefined);
  assert.equal(player.container.getItem(0).typeId, 'ordertocook:clean_plate');
});

test('looking away produces a bounded cancellation hint and leaves the dirty plate intact', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:washingtable');
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block);
  player.viewedBlock = block;
  service.onInteract(player, block);
  service.tick();
  advance(service, env, 40);
  player.viewedBlock = undefined;
  assert.equal(service.getWashingProgress(player), undefined);
  advance(service, env, 1);
  assert.equal(service.getWashingProgress(player), '§7洗碗已中止');
  advance(service, env, 19);
  assert.equal(service.getWashingProgress(player), '§7洗碗已中止');
  advance(service, env, 1);
  assert.equal(service.getWashingProgress(player), undefined);
  assert.equal(env.ctx.getStation(block).appliance.plates, 1);
});

test('manual stop, restart and player departure cannot leave a stale washing HUD', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  service.init();
  const block = place(env, 'ordertocook:washingtable');
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block);
  player.viewedBlock = block;
  service.onInteract(player, block);
  service.onInteract(player, block);
  assert.equal(service.getWashingProgress(player), '§7洗碗已中止');
  service.onInteract(player, block);
  assert.equal(service.getWashingProgress(player), '§b洗碗中 0%');
  for (const callback of env.world.afterEvents.playerLeave.subscriptions) callback({ playerId: player.id });
  assert.equal(service.getWashingProgress(player), undefined);
});
