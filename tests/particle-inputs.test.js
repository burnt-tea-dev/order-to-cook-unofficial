// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { playEffects, newOrderEffects, handwashingEffects, freshMealEffects,
  customerCompletionEffects, customerPortalEffects, customerExplosionEffects,
  customerUnsuccessfulEffects, motorcycleHitEffects } from '../runtime/BP/scripts/audiovisual.js';

test('real particle callers pass scalar count, spread and speed through the playback boundary', () => {
  const location = { x: 2, y: 3, z: 4 };
  const cues = [newOrderEffects(location), handwashingEffects(location, 'north', () => 0.25),
    freshMealEffects(location), customerCompletionEffects(location, () => 0.25),
    customerPortalEffects(location), customerExplosionEffects(location),
    customerUnsuccessfulEffects(location), motorcycleHitEffects(location)].flat();
  // Unequal axes detect a transposed component at the public playback boundary.
  cues.push({ particle: 'ordertocook:sparkle', location, count: 7, spread: [0.11, 0.23, 0.37], speed: 0.013 });
  class ScalarMap {
    values = {};
    setFloat(name, value) { this.values[name] = value; }
  }
  const emitted = [];
  playEffects({ playSound() {}, spawnParticle(id, position, variables) {
    emitted.push({ id, position, values: variables.values });
  } }, cues, ScalarMap);
  const particles = cues.filter(cue => cue.particle);
  assert.equal(emitted.length, particles.length, 'Every real burst must reach spawnParticle with scalar inputs.');
  assert.deepEqual(new Set(emitted.map(row => row.id)), new Set(['sparkle', 'bubble_pop', 'splash', 'cloud',
    'happy', 'portal', 'explosion', 'large_smoke', 'smoke', 'poof'].map(name => 'ordertocook:' + name)));
  for (let index = 0; index < particles.length; index++) {
    const cue = particles[index], actual = emitted[index];
    assert.equal(actual.id, cue.particle);
    assert.deepEqual(actual.position, cue.location);
    assert.deepEqual(actual.values, {
      'variable.count': cue.count,
      'variable.spread_x': cue.spread[0],
      'variable.spread_y': cue.spread[1],
      'variable.spread_z': cue.spread[2],
      'variable.speed': cue.speed * 20,
    });
  }
});
