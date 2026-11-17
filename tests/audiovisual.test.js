// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { playEffects, handwashingEffects, fridgeDoorEffects, customerCompletionEffects, customerPortalEffects, customerExplosionEffects, motorcycleHitEffects, newOrderEffects, customerUnsuccessfulEffects } from '../runtime/BP/scripts/audiovisual.js';
import { entityServices, makeEnvironment, FakeItem, FakePlayer, FakeMolangVariableMap, place } from './appliances.harness.js';
import { mainFixture } from './main.harness.js';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('playback raises custom and vanilla cues by twenty percent without changing source cue data', () => {
  const p = { x: 2, y: 3, z: 4 };
  const cues = [...newOrderEffects(p), ...customerCompletionEffects(p, () => 0.5), ...handwashingEffects(p, 'north', () => 0.25)];
  const source = structuredClone(cues), sounds = [];
  playEffects({ playSound: (id, location, options) => sounds.push({ id, location, ...options }), spawnParticle() {} }, cues, FakeMolangVariableMap);
  assert.deepEqual(cues, source);
  assert.deepEqual(sounds.map(row => row.id), ['ordertocook:order_refresh', 'mob.villager.idle', 'random.splash']);
  for (const [index, volume] of [1.2, 1.08, 0.264].entries()) assert.ok(Math.abs(sounds[index].volume - volume) < 1e-12);
  const originals = cues.filter(cue => cue.sound);
  assert.deepEqual(sounds.map(row => row.location), originals.map(cue => cue.location));
  assert.deepEqual(sounds.map(row => row.pitch), originals.map(cue => cue.pitch));
});

test('the plate-shelf direct sound uses the same playback adjustment once', async () => {
  const env = await mainFixture(), sounds = [];
  const shelf = place(env, 'ordertocook:plate_shelf', { x: 0, y: 0, z: 2 });
  env.player.container.setItem(0, new FakeItem('ordertocook:clean_plate', 2));
  env.dimension.playSound = (id, location, options) => sounds.push({ id, location, ...options });
  env.hooks.shelfInteract(env.player, shelf);
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].id, 'ordertocook:plate_place');
  assert.ok(Math.abs(sounds[0].volume - 0.9) < 1e-12);
  assert.ok(sounds[0].pitch >= 0.95 && sounds[0].pitch <= 1.05);
  assert.deepEqual(sounds[0].location, { x: 0.5, y: 0.5, z: 2.5 });
});

test('fridge compartment/direction sounds use all four Java pitches at the lower anchor', () => {
  const location = { x: 3, y: 5, z: 7 };
  const cues = [fridgeDoorEffects(location, 'upper', true), fridgeDoorEffects(location, 'lower', true),
    fridgeDoorEffects(location, 'upper', false), fridgeDoorEffects(location, 'lower', false)].flat();
  assert.deepEqual(cues.map(cue => cue.pitch), [2, 1.7, 1.1, 0.9]);
  assert.deepEqual(cues.map(cue => cue.volume), [0.35, 0.35, 0.35, 0.35]);
  for (const cue of cues) assert.deepEqual(cue.location, { x: 3.5, y: 5.5, z: 7.5 });
});

test('customer cue counts/origins match source packets and use existing vanilla sound aliases', () => {
  const p = { x: 2, y: 3, z: 4 };
  const complete = [0, 0.5, 0.99].map(roll => customerCompletionEffects(p, () => roll));
  assert.deepEqual(complete.map(cues => cues[1].sound), ['mob.villager.yes', 'mob.villager.idle', 'mob.villager.yes']);
  assert.equal(complete[0][0].count, 30); assert.equal(complete[0][0].location.y, 3.5);
  const portal = customerPortalEffects(p), boom = customerExplosionEffects(p);
  assert.equal(portal[0].volume, 1); assert.equal(portal[1].count, 40); assert.equal(portal[1].location.y, 3.8);
  assert.deepEqual(portal[1].spread, [0.35, 0.5, 0.35]);
  assert.equal(boom[0].volume, 1); assert.equal(boom[1].count, 1); assert.equal(boom[2].count, 18);
  assert.equal(boom[2].location.y, 3.8);
  assert.equal(newOrderEffects(p)[1].count, 10);
  assert.equal(customerUnsuccessfulEffects(p)[1].count, 20);
});

test('customer runtime emits each portal burst once, with its explicit count and no new inventory effects', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  env.world.players.push(player);
  const chair = place(env, 'ordertocook:chair', { x: 2, y: 0, z: 0 }); env.ctx.getStation(chair);
  const order = { id: 'audio-order', restaurantId: 'r1', type: 'dine_in', status: 'accepted', items: [], expiresAt: 9999999999999 };
  const restaurant = { id: 'r1', name: 'Audio', dimensionId: env.dimension.id, location: { x: 0, y: 0, z: 0 }, orders: [order] };
  env.restaurants.set(restaurant.id, restaurant); env.ctx.now = () => 10000;
  const service = entityServices.createEntityService(env.ctx);
  service.init(); for (const callback of env.system.callbacks) callback();
  const customer = service.spawnCustomer(restaurant, order);
  const emissions = [];
  env.dimension.spawnParticle = (id, location, variables) => emissions.push({ id, location, variables });
  order.status = 'completed'; order.meal = { startedAt: 10000, finishAt: 15500, action: 6 };
  service.finishCustomer(order.id, order.meal);
  customer.setProperty('ordertocook:reaction_tick', 105);
  env.ctx.now = () => 15250; env.system.currentTick = 105; service.tick();
  env.ctx.now = () => 15300; env.system.currentTick = 106; service.tick();
  const portals = emissions.filter(e => e.id === 'ordertocook:portal');
  assert.equal(portals.length, 1); assert.equal(portals[0].variables.floats['variable.count'], 40);
  assert.equal(portals[0].location.y, customer.location.y + 0.8);
  const happyCount = emissions.filter(e => e.id === 'ordertocook:happy').length;
  service.interruptCustomerMeal(order.id, { startedAt: 15300, finishAt: 15800 });
  assert.equal(emissions.filter(e => e.id === 'ordertocook:happy').length, happyCount, 'Early pickup must not replay successful handoff happiness.');
  assert.equal(env.dimension.drops.length, 0);
});

test('motorcycle hit puff uses body height and original three-smoke/two-poof counts', () => {
  const cues = motorcycleHitEffects({ x: 1, y: 2, z: 3 });
  assert.deepEqual(cues.map(c => c.count), [3, 2]);
  assert.ok(Math.abs(cues[0].location.y - 2.72) < 1e-12);
  assert.deepEqual(cues[0].spread, [0.24, 0.12, 0.24]);
  assert.deepEqual(cues[1].spread, [0.18, 0.096, 0.18]);
});

test('generated feedback definitions use explicit counts with self-terminating emitters and native atlas sprites', async () => {
  for (const name of ['sparkle', 'cloud', 'smoke', 'large_smoke', 'poof', 'happy', 'portal', 'bubble_pop', 'splash']) {
    const definition = await json(`../runtime/RP/particles/${name}.json`);
    const { description, components } = definition.particle_effect;
    assert.equal(description.basic_render_parameters.texture, 'textures/particle/particles');
    assert.equal(components['minecraft:emitter_rate_instant'].num_particles, 'variable.count');
    assert.ok(components['minecraft:emitter_lifetime_once']);
    assert.equal(components['minecraft:emitter_rate_manual'], undefined);
  }
  const explosion = (await json('../runtime/RP/particles/explosion.json')).particle_effect.components;
  assert.equal(explosion['minecraft:emitter_lifetime_once'].active_time, 0.4);
  assert.equal(explosion['minecraft:emitter_lifetime_looping'], undefined);
  const sounds = await json('../runtime/RP/blocks.json');
  assert.deepEqual(['order_machine', 'countertop', 'washingtable', 'takeout_bag', 'food_plate_display', 'stove'].map(name => sounds[`ordertocook:${name}`].sound), ['stone', 'wood', 'stone', 'cloth', 'cloth', 'wood']);
});
