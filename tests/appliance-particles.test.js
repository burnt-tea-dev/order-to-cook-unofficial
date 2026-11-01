// SPDX-License-Identifier: GPL-3.0-only
// Exercise the production service, not a second implementation of its feedback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, makeEnvironment, FakeItem, FakePlayer, place } from './appliances.harness.js';

// Match main.js: the appliance service is called every two game ticks.
function advance(service, env, ticks) {
  for (let elapsed = 0; elapsed < ticks; elapsed += 2) {
    env.system.currentTick += 2;
    service.tick();
  }
}

function fixture(kind, count = 1) {
  const env = makeEnvironment();
  const service = appliances.createApplianceService(env.ctx);
  const player = new FakePlayer(env.dimension);
  const block = place(env, `ordertocook:${kind}`);
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate', count));
  service.onInteract(player, block);
  player.viewedBlock = block;
  const emissions = [];
  env.dimension.spawnParticle = (id, location, variables) => {
    emissions.push({ id, location, variables, tick: env.system.currentTick });
  };
  return { env, service, player, block, emissions, station: env.ctx.getStation(block) };
}

function assertSplash(emission, expectedLocation) {
  assert.equal(emission.id, 'minecraft:water_splash_particle');
  assert.deepEqual(emission.location, expectedLocation);
  assert.ok(emission.variables, 'A native splash requires variable.direction.x/y/z, not just a position.');
  assert.deepEqual(emission.variables.vectors, { 'variable.direction': { x: 0, y: -1, z: 0 } });
}

test('handwashing supplies splash direction at the existing 20-tick cadence', () => {
  const { env, service, player, emissions, station } = fixture('washingtable');
  service.onInteract(player, player.viewedBlock);
  service.tick(); advance(service, env, 80);
  assert.deepEqual(emissions.map(e => e.tick), [0, 20, 40, 60, 80]);
  for (const emission of emissions) assertSplash(emission, { x: 0.5, y: 0.94, z: 0.5 });
  assert.equal(new Set(emissions.map(e => e.variables)).size, emissions.length);
  assert.equal(station.appliance.plates, 0);
  assert.equal(player.container.getItem(0).typeId, 'ordertocook:clean_plate');
  advance(service, env, 40);
  assert.equal(emissions.length, 5, 'Finished sessions must not keep emitting.');
});

test('cancelled washing stops feedback and preserves the dirty plate', () => {
  const { env, service, player, emissions, station } = fixture('washingtable');
  service.onInteract(player, player.viewedBlock); service.tick();
  advance(service, env, 20);
  player.viewedBlock = undefined; advance(service, env, 80);
  assert.equal(emissions.length, 2);
  for (const emission of emissions) assertSplash(emission, { x: 0.5, y: 0.94, z: 0.5 });
  assert.equal(station.appliance.plates, 1);
  assert.equal(player.container.slots.some(s => s?.typeId === 'ordertocook:clean_plate'), false);
});

test('dishwasher supplies direction only to splash, leaving smoke and its phase timing unchanged', () => {
  const { env, service, emissions, station } = fixture('dishwasher', 16);
  service.tick(); advance(service, env, 134);
  const water = emissions.filter(e => e.id === 'minecraft:water_splash_particle');
  assert.deepEqual(water.map(e => e.tick), [40, 60, 80, 100]);
  for (const emission of water) assertSplash(emission, { x: 0.5, y: 0.9, z: 0.5 });
  const smoke = emissions.filter(e => e.id === 'minecraft:basic_smoke_particle');
  assert.equal(smoke.length, 1); assert.equal(smoke[0].variables, undefined);
  assert.equal(station.appliance.phase, 5); assert.equal(station.appliance.plates, 16);
});

test('a particle API failure cannot cancel a valid wash or duplicate its plate', () => {
  const { env, service, player, station } = fixture('washingtable');
  let attempts = 0;
  env.dimension.spawnParticle = () => { attempts++; throw new Error('unloaded cosmetic emitter'); };
  service.onInteract(player, player.viewedBlock); service.tick(); advance(service, env, 100);
  assert.equal(attempts, 5);
  assert.equal(station.appliance.plates, 0);
  assert.equal(player.container.slots.filter(s => s?.typeId === 'ordertocook:clean_plate').reduce((n, s) => n + s.amount, 0), 1);
});
