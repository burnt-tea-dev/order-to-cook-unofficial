// SPDX-License-Identifier: GPL-3.0-only
// Production event timing, emitter counts and origin checks; not a client render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, makeEnvironment, FakeItem, FakePlayer, place } from './appliances.harness.js';
import { basinPoint } from '../runtime/BP/scripts/audiovisual.js';

function advance(service, env, ticks) {
  for (let elapsed = 0; elapsed < ticks; elapsed += 2) {
    env.system.currentTick += 2;
    service.tick();
  }
}

function fixture(kind, count = 1, facing = 'north') {
  const env = makeEnvironment();
  const service = appliances.createApplianceService(env.ctx);
  const player = new FakePlayer(env.dimension);
  const block = place(env, `ordertocook:${kind}`, { x: 0, y: 0, z: 0 }, { 'minecraft:cardinal_direction': facing });
  service.onPlace(block);
  const emissions = [], sounds = [];
  env.dimension.spawnParticle = (id, location, variables) => emissions.push({ id, location, variables, tick: env.system.currentTick });
  env.dimension.playSound = (id, location, options) => sounds.push({ id, location, ...options, tick: env.system.currentTick });
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate', count));
  service.onInteract(player, block);
  player.viewedBlock = block;
  return { env, service, player, block, emissions, sounds, station: env.ctx.getStation(block) };
}
const amount = e => e.variables.floats['variable.count'];

test('handwashing uses source half-second/second cues, basin positions and 10–15 bubbles plus two splashes', () => {
  const { env, service, player, emissions, sounds, station } = fixture('washingtable');
  service.onInteract(player, player.viewedBlock);
  service.tick(); advance(service, env, 80);
  assert.deepEqual([...new Set(emissions.map(e => e.tick))], [10, 20, 40, 60]);
  for (const tick of [10, 20, 40, 60]) {
    const at = emissions.filter(e => e.tick === tick);
    const bubbles = at.filter(e => e.id === 'ordertocook:bubble_pop');
    assert.ok(bubbles.length >= 10 && bubbles.length <= 15);
    assert.equal(at.filter(e => e.id === 'ordertocook:splash').length, 2);
    for (const e of at) {
      assert.equal(amount(e), 1);
      assert.ok(e.location.x >= 3 / 16 && e.location.x <= 13 / 16);
      assert.ok(e.location.z >= 3 / 16 && e.location.z <= 12 / 16);
      assert.ok(e.location.y >= 0.94 && e.location.y <= 0.99);
    }
  }
  const water = sounds.filter(e => e.id === 'random.splash');
  assert.deepEqual(water.map(e => e.tick), [10, 20, 40, 60]);
  for (const cue of water) { assert.ok(Math.abs(cue.volume - 0.264) < 1e-12); assert.ok(cue.pitch >= 0.9 && cue.pitch <= 1.1); }
  assert.equal(station.appliance.plates, 0);
  assert.equal(player.container.getItem(0).typeId, 'ordertocook:clean_plate');
  const count = emissions.length; advance(service, env, 40); assert.equal(emissions.length, count);
});

test('four orientations rotate the off-centre basin instead of spraying the rim', () => {
  const p = { x: 4, y: 8, z: 12 };
  assert.deepEqual(basinPoint(p, 'north', 0, 0), { x: 4.1875, y: 8.94, z: 12.1875 });
  assert.deepEqual(basinPoint(p, 'east', 0, 0), { x: 4.8125, y: 8.94, z: 12.1875 });
  assert.deepEqual(basinPoint(p, 'south', 0, 0), { x: 4.8125, y: 8.94, z: 12.8125 });
  assert.deepEqual(basinPoint(p, 'west', 0, 0), { x: 4.1875, y: 8.94, z: 12.8125 });
});

test('cancelled washing stops feedback and preserves its dirty plate', () => {
  const { env, service, player, emissions, station } = fixture('washingtable');
  service.onInteract(player, player.viewedBlock); service.tick(); advance(service, env, 20);
  const count = emissions.length;
  player.viewedBlock = undefined; advance(service, env, 80);
  assert.equal(emissions.length, count);
  assert.equal(station.appliance.plates, 1);
  assert.equal(player.container.slots.some(s => s?.typeId === 'ordertocook:clean_plate'), false);
});

test('sixteen-plate dishwasher repeats original wash sound and emits white sparkle/door bursts, never water', () => {
  const { env, service, player, block, emissions, sounds, station } = fixture('dishwasher', 16, 'east');
  assert.equal(sounds.length, 0, 'Contact sound must wait for dirty_in tick 14.');
  service.tick(); advance(service, env, 134);
  assert.deepEqual(sounds.filter(e => e.id === 'ordertocook:plate_place').map(e => e.tick), [14]);
  assert.deepEqual(sounds.filter(e => e.id === 'ordertocook:dishwasher_washing').map(e => e.tick), [30, 70]);
  assert.deepEqual(sounds.filter(e => e.id === 'ordertocook:dishwasher_clear_out').map(e => e.tick), [110]);
  assert.equal(emissions.some(e => e.id.includes('splash')), false);
  const sparks = emissions.filter(e => e.id === 'ordertocook:sparkle');
  assert.deepEqual(sparks.map(e => [e.tick, amount(e)]), [[14, 10], [30, 12], [40, 4], [50, 4], [60, 4], [70, 12], [80, 4], [90, 4], [100, 4], [110, 4], [110, 12]]);
  const cloud = emissions.find(e => e.id === 'ordertocook:cloud');
  assert.equal(amount(cloud), 18); assert.deepEqual(cloud.location, { x: 1.06, y: 0.62, z: 0.5 });
  assert.deepEqual(['x', 'y', 'z'].map(axis => cloud.variables.floats[`variable.spread_${axis}`]), [0.18, 0.15, 0.18]);
  assert.equal(cloud.variables.floats['variable.speed'], 0.5);
  const poof = emissions.find(e => e.id === 'ordertocook:poof');
  assert.equal(amount(poof), 8); assert.equal(poof.location.y, 0.67);
  assert.equal(station.appliance.phase, 5); assert.equal(station.appliance.plates, 16);
  service.onInteract(player, block);
  const taking = sounds.slice(-2);
  assert.equal(taking[0].id, 'ordertocook:plate_place'); assert.ok(Math.abs(taking[0].volume - 0.9) < 1e-12);
  assert.equal(taking[1].id, 'ordertocook:dishwasher_in'); assert.ok(Math.abs(taking[1].volume - 1.02) < 1e-12); assert.equal(taking[1].pitch, 1.05);
  assert.equal(amount(emissions.at(-1)), 7);
  advance(service, env, 14); assert.equal(station.appliance.phase, 0);
});

test('a particle API failure cannot cancel a wash or duplicate its plate', () => {
  const { env, service, player, station } = fixture('washingtable');
  let attempts = 0;
  env.dimension.spawnParticle = () => { attempts++; throw new Error('unloaded cosmetic emitter'); };
  service.onInteract(player, player.viewedBlock); service.tick(); advance(service, env, 100);
  assert.ok(attempts >= 48 && attempts <= 68);
  assert.equal(station.appliance.plates, 0);
  assert.equal(player.container.slots.filter(s => s?.typeId === 'ordertocook:clean_plate').reduce((n, s) => n + s.amount, 0), 1);
});
