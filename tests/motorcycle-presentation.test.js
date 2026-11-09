// SPDX-License-Identifier: GPL-3.0-only
// Exercise the shipped entity service and presentation module with API doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { entityServices, FakeItem, FakePlayer, makeEnvironment } from './appliances.harness.js';
import { createMotorcyclePresentation } from '../runtime/BP/scripts/motorcycle_presentation.js';

const IDLE = 'animation.ordertocook.player.motorcycle_idle';

function fixture() {
  const env = makeEnvironment();
  const player = new FakePlayer(env.dimension);
  env.world.players.push(player);
  const bike = env.dimension.spawnEntity('ordertocook:motorcycle', player.location);
  const cargo = new FakeItem('ordertocook:takeout_bag');
  cargo.nameTag = 'delivery'; cargo.setLore(['external lore']); cargo.setDynamicProperty('external:parcel', 'keep');
  bike.container.setItem(7, cargo);
  const service = entityServices.createEntityService(env.ctx);
  return { env, player, bike, cargo, service };
}

function initialize(env, service) {
  const first = env.system.callbacks.length;
  service.init();
  for (const callback of env.system.callbacks.slice(first)) callback();
  env.system.currentTick = 40;
}

test('successful motorcycle mount starts one TP base loop without touching cargo or movement', () => {
  const { env, player, bike, cargo, service } = fixture();
  initialize(env, service);
  service.onEntityInteract(player, bike);
  assert.equal(player.riding, bike);
  assert.deepEqual(player.animations.map(a => a.name), [IDLE]);
  for (let tick = 40; tick <= 65; tick += 5) { env.system.currentTick = tick; service.tick(); }
  assert.equal(player.animations.length, 1, 'maintenance must not restart the loop');
  assert.deepEqual(bike.container.getItem(7), cargo);
  assert.deepEqual(bike.rotation, { x: 0, y: 0 });
  assert.deepEqual(player.rotation, { x: 0, y: 0 });
  assert.deepEqual(bike.dynamic, {});
  assert.equal(env.system.intervals.length, 1, 'reuse the existing entity-service interval');
  assert.equal(env.system.intervals[0].ticks, 5);
});

test('occupied motorcycles and rejected native mounts do not start a pose', () => {
  for (const occupied of [true, false]) {
    const { env, player, bike, service } = fixture();
    if (occupied) bike.getComponent('minecraft:rideable').addRider(new FakePlayer(env.dimension));
    else {
      const getComponent = bike.getComponent.bind(bike);
      bike.getComponent = id => id === 'minecraft:rideable' ? { getRiders: () => [], addRider: () => false } : getComponent(id);
    }
    service.onEntityInteract(player, bike);
    assert.equal(player.riding, undefined);
    assert.deepEqual(player.animations, []);
  }
});

test('returning to the same motorcycle before maintenance restarts the natively stopped loop', () => {
  const { env, player, bike, service } = fixture();
  initialize(env, service); service.onEntityInteract(player, bike);
  env.system.currentTick = 100; service.tick();
  bike.getComponent('minecraft:rideable').ejectRiders();
  // Native stopExpression may finish while the old session is still cached.
  env.system.currentTick = 102; service.onEntityInteract(player, bike);
  assert.equal(player.riding, bike);
  assert.deepEqual(player.animations.map(a => a.name), [IDLE, IDLE]);
  env.system.currentTick = 105; service.tick();
  assert.equal(player.animations.length, 2);
});

test('dismount or a different mount stops only the motorcycle controller and releases the session', () => {
  for (const nextMount of [undefined, 'ordertocook:seat', 'ordertocook:motorcycle']) {
    const { env, player, bike, service } = fixture();
    initialize(env, service); service.onEntityInteract(player, bike);
    bike.getComponent('minecraft:rideable').ejectRiders();
    if (nextMount) env.dimension.spawnEntity(nextMount, player.location).getComponent('minecraft:rideable').addRider(player);
    service.tick();
    assert.equal(player.animations.at(-1).name, `${IDLE}_stop`);
    assert.equal(player.animations.at(-1).options.controller, player.animations[0].options.controller);
    env.system.currentTick += 5; service.tick();
    assert.equal(player.animations.length, 2, 'stop does not repeat after cleanup');
  }
});

test('script reload and playerSpawn restore a mounted base pose; leave permits a fresh session', () => {
  const { env, player, bike, service } = fixture();
  bike.getComponent('minecraft:rideable').addRider(player);
  initialize(env, service);
  assert.deepEqual(player.animations.map(a => a.name), [IDLE]);
  let queued = env.system.callbacks.length;
  for (const callback of env.world.afterEvents.playerSpawn.subscriptions) callback({ player });
  for (const callback of env.system.callbacks.slice(queued)) callback();
  assert.equal(player.animations.length, 1);
  player.isValid = false;
  for (const callback of env.world.afterEvents.playerLeave.subscriptions) callback({ playerId: player.id });
  player.isValid = true;
  queued = env.system.callbacks.length;
  for (const callback of env.world.afterEvents.playerSpawn.subscriptions) callback({ player });
  for (const callback of env.system.callbacks.slice(queued)) callback();
  assert.deepEqual(player.animations.map(a => a.name), [IDLE, IDLE]);
});

test('cosmetic API failures preserve a successful mount and failed starts can be retried', () => {
  const { player, bike, cargo, service } = fixture();
  player.playAnimation = () => { throw Error('animation unavailable'); };
  assert.doesNotThrow(() => service.onEntityInteract(player, bike));
  assert.equal(player.riding, bike);
  assert.deepEqual(bike.container.getItem(7), cargo);
  const presentation = createMotorcyclePresentation();
  presentation.start(player);
  player.playAnimation = FakePlayer.prototype.playAnimation;
  presentation.start(player); presentation.start(player);
  assert.deepEqual(player.animations.map(a => a.name), [IDLE]);
  const getComponent = player.getComponent.bind(player);
  player.getComponent = () => { throw Error('entity unloaded'); };
  assert.doesNotThrow(() => presentation.tick());
  player.getComponent = getComponent;
  presentation.start(player);
  assert.deepEqual(player.animations.map(a => a.name), [IDLE, `${IDLE}_stop`, IDLE]);
});

test('actual rider animation gates TP by motorcycle mount and releases on native dismount', async () => {
  const definition = JSON.parse(await readFile(new URL('../runtime/RP/animations/motorcycle_player.animation.json', import.meta.url)));
  const clip = definition.animations[IDLE];
  assert.equal(clip.loop, true); assert.equal(clip.animation_length, 8); assert.equal(clip.override_previous_animation, true);
  const { player, bike, service } = fixture(); service.onEntityInteract(player, bike);
  const blend = new Function('query', `return ${clip.blend_weight};`);
  const stop = new Function('query', `return ${player.animations[0].options.stopExpression};`);
  for (const type of [undefined, 'ordertocook:seat', 'minecraft:boat', 'ordertocook:motorcycle']) {
    for (const firstPerson of [false, true]) {
      const query = { is_first_person: firstPerson, is_riding_any_entity_of_type: (...types) => types.includes(type) };
      assert.equal(blend(query), !firstPerson && type === 'ordertocook:motorcycle');
      assert.equal(stop(query), type !== 'ordertocook:motorcycle');
    }
  }
  assert.ok(definition.animations[`${IDLE}_stop`].animation_length <= 0.1);
  assert.equal(definition.animations[`${IDLE}_stop`].bones, undefined);
});
