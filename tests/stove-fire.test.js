// SPDX-License-Identifier: GPL-3.0-only
// Timings are from Java StoveBlockEntity at e59e3dbc, not a separate fire engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeStoveFire, igniteStoveFire, advanceStoveFire, stoveFireFrame } from '../runtime/BP/scripts/stove_fire.js';

function burningStove() {
  const data = { litTime: 0 };
  initializeStoveFire(data);
  data.litTime = 1600;
  igniteStoveFire(data);
  return data;
}

function tick(data) {
  const event = advanceStoveFire(data);
  if (data.litTime > 0) data.litTime--;
  return event;
}

test('Java ignition stays dark 15 ticks, bursts 5, then cycles every 8 ticks', () => {
  const data = burningStove(), events = [], frames = [];
  for (let elapsed = 0; elapsed <= 52; elapsed++) {
    if (elapsed) {
      const event = tick(data);
      if (event) events.push([elapsed, event]);
    }
    if ([0, 14, 15, 19, 20, 27, 28, 35, 36, 43, 44, 51, 52].includes(elapsed)) {
      frames.push([elapsed, stoveFireFrame(data)]);
    }
  }
  assert.deepEqual(events, [[15, 'burst'], [28, 'cycle'], [36, 'cycle'], [44, 'cycle'], [52, 'cycle']]);
  assert.deepEqual(frames, [[0, 0], [14, 0], [15, 1], [19, 1], [20, 2], [27, 2],
    [28, 3], [35, 3], [36, 4], [43, 4], [44, 5], [51, 5], [52, 2]]);
});

test('two stoves keep independent phases and reload resumes without another ignition burst', () => {
  const first = burningStove();
  for (let i = 0; i < 15; i++) tick(first);
  const second = burningStove();
  assert.equal(stoveFireFrame(first), 1);
  assert.equal(stoveFireFrame(second), 0);
  for (let i = 0; i < 21; i++) tick(first);
  assert.equal(stoveFireFrame(first), 4);
  assert.equal(stoveFireFrame(second), 0);
  const restored = JSON.parse(JSON.stringify(first));
  initializeStoveFire(restored);
  assert.equal(stoveFireFrame(restored), 4);
  assert.equal(restored.litTime, first.litTime);
  const events = Array.from({ length: 8 }, () => tick(restored)).filter(Boolean);
  assert.deepEqual(events, ['cycle']);
  assert.equal(stoveFireFrame(restored), 5);
  const duringIgnition = burningStove();
  initializeStoveFire(duringIgnition);
  assert.equal(stoveFireFrame(duringIgnition), 2, 'Reloaded burning stoves skip unfinished ignition, as Java does.');
});

test('last burning tick still advances fire; the next unlit tick clears it and fresh fuel restarts delay', () => {
  const data = burningStove();
  for (let i = 0; i < 14; i++) tick(data);
  data.litTime = 1;
  assert.equal(tick(data), 'burst');
  assert.equal(data.litTime, 0);
  assert.equal(stoveFireFrame(data), 1);
  assert.equal(tick(data), undefined);
  assert.equal(stoveFireFrame(data), 0);
  assert.equal(data.fireTicks, 0);
  data.litTime = 100;
  igniteStoveFire(data);
  assert.equal(stoveFireFrame(data), 0);
  for (let i = 0; i < 14; i++) assert.equal(tick(data), undefined);
  assert.equal(tick(data), 'burst');
});

test('generated stove selects the six unmodified Java textures without global animation or extra light', () => {
  const root = new URL('../', import.meta.url);
  const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
  const block = json('runtime/BP/blocks/stove.json')['minecraft:block'];
  const terrain = json('runtime/RP/textures/terrain_texture.json').texture_data;
  assert.deepEqual(block.description.states['ordertocook:lit'], [false, true]);
  assert.deepEqual(block.description.states['ordertocook:fire_frame'], [0, 1, 2, 3, 4, 5]);
  assert.equal(block.components['minecraft:light_emission'], undefined);
  const textures = ['stove', 'stove_fire', 'stove_fire_0', 'stove_fire_1', 'stove_fire_2', 'stove_fire_3'];
  for (let frame = 0; frame < textures.length; frame++) {
    const components = frame === 0 ? block.components : block.permutations.find(
      p => p.condition === `q.block_state('ordertocook:fire_frame') == ${frame}`).components;
    assert.equal(components['minecraft:light_emission'], undefined);
    for (const material of Object.values(components['minecraft:material_instances'])) {
      assert.equal(terrain[material.texture].textures, `textures/ordertocook/block/${textures[frame]}`);
    }
    assert.deepEqual(readFileSync(new URL(`runtime/RP/textures/ordertocook/block/${textures[frame]}.png`, root)),
      readFileSync(new URL(`upstream/reference/common/src/main/resources/assets/ordertocook/textures/block/${textures[frame]}.png`, root)));
  }
  assert.equal(json('runtime/RP/textures/flipbook_textures.json').some(entry => /stove/.test(entry.atlas_tile)), false);
});
