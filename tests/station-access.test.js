// SPDX-License-Identifier: GPL-3.0-only
// Execute the shipped interaction entry with native IO doubles, not client input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture } from './main.harness.js';
import { FakePlayer, place } from './appliances.harness.js';

async function interact(env, player, block) {
  env.system.currentTick += 4;
  env.hooks.appliances.onInteract = () => false;
  env.hooks.entities.onBlockInteract = () => false;
  const event = { player, block, isFirstEvent: true, cancel: false };
  for (const callback of env.world.beforeEvents.playerInteractWithBlock.subscriptions) callback(event);
  assert.equal(event.cancel, true);
  while (env.system.callbacks.length) await env.system.callbacks.shift()();
}

for (const registered of [false, true]) {
  test(`denied visitor cannot claim a restaurant board (${registered ? 'legacy record' : 'unregistered block'})`, async () => {
    const env = await mainFixture();
    const board = place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 });
    if (registered) {
      const station = env.store.getStation(board);
      station.initialized = true;
      station.menu = [{ typeId: 'minecraft:bread', label: 'Legacy menu', nutrition: 5 }];
      env.store.saveStation(station);
      env.hooks.syncMenu(env.restaurant);
      env.store.saveRestaurant(env.restaurant);
    }
    const visitor = new FakePlayer(env.dimension, { x: 3.5, y: 0, z: 0.5 });
    visitor.getGameMode = () => 'Survival';
    const before = new Map(env.properties), menu = structuredClone(env.restaurant.menu);
    await interact(env, visitor, board);
    assert.match(visitor.messages.at(-1), /其他玩家的餐廳設備/);
    assert.deepEqual(env.properties, before, 'denial must precede station creation or ownership writes');
    if (registered) {
      assert.equal(env.store.findStation(board).ownerId, '');
      env.hooks.syncMenu(env.restaurant);
      assert.deepEqual(env.restaurant.menu, menu, 'a denied visitor cannot sever the menu binding');
    } else assert.equal(env.store.findStation(board), undefined);
  });
}

for (const role of ['owner', 'staff']) for (const registered of [false, true]) {
  test(`${role} can claim a ${registered ? 'legacy' : 'new'} board through the existing entry`, async () => {
    const env = await mainFixture();
    const board = place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 });
    const actor = role === 'owner' ? env.player : new FakePlayer(env.dimension, { x: 3.5, y: 0, z: 0.5 });
    actor.getGameMode = () => 'Survival';
    if (role === 'staff') { env.restaurant.staff = [actor.id]; env.store.saveRestaurant(env.restaurant); }
    if (registered) {
      const station = env.store.getStation(board);
      station.initialized = true;
      station.menu = [{ typeId: 'minecraft:bread', label: 'Legacy menu', nutrition: 5 }];
      env.store.saveStation(station);
    }
    await interact(env, actor, board);
    assert.equal(env.store.findStation(board).ownerId, actor.id);
    assert.equal(env.forms.at(-1)[1], '菜單立牌');
  });
}

test('revoked staff cannot claim a legacy board and standalone ownership still works', async () => {
  const env = await mainFixture();
  const actor = new FakePlayer(env.dimension, { x: 3.5, y: 0, z: 0.5 });
  actor.getGameMode = () => 'Survival';
  env.restaurant.staff = [actor.id]; env.store.saveRestaurant(env.restaurant);
  const board = place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 });
  const station = env.store.getStation(board);
  env.restaurant.staff = []; env.store.saveRestaurant(env.restaurant);
  const before = new Map(env.properties);
  await interact(env, actor, board);
  assert.equal(station.ownerId, '');
  assert.deepEqual(env.properties, before);

  const standalone = place(env, 'ordertocook:board', { x: 40, y: 0, z: 0 });
  actor.location = { x: 40.5, y: 0, z: 0.5 };
  await interact(env, actor, standalone);
  assert.equal(env.store.findStation(standalone).ownerId, actor.id);
});
