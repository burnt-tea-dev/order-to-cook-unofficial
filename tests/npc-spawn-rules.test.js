// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalFallbackOffsets, deliveryRingOffsets, chooseUniformCandidate, JAVA_DELIVERY_SEARCH } from './helpers/npc-spawn-rules.js';

test('normal no-chair fallback enumerates the Java radius-5 disk in dx/dz order', () => {
  const offsets = normalFallbackOffsets();
  assert.equal(offsets.length, 81);
  assert.deepEqual(offsets[0], [-5, 0]);
  assert.deepEqual(offsets.at(-1), [5, 0]);
  assert.ok(offsets.every(([x, z]) => x*x + z*z <= 25));
  assert.ok(offsets.some(([x, z]) => x === 5 && z === 0));
  assert.ok(!offsets.some(([x, z]) => x === 5 && z === 1));
});

test('delivery primary candidate sequence matches the Java perimeter ring and probe cap', () => {
  const offsets = deliveryRingOffsets(8, 64);
  assert.equal(offsets.length, 64);
  assert.deepEqual(offsets.slice(0, 8), [
    [-1,-1], [-1,1], [0,-1], [0,1], [1,-1], [1,1], [-1,0], [1,0]
  ]);
  assert.deepEqual(offsets[8], [-2,-2]);
  assert.deepEqual(offsets[23], [2,1]);
});

test('delivery retry radii and budgets remain distinct from long-distance delivery', () => {
  assert.deepEqual(JAVA_DELIVERY_SEARCH, [
    { radius: 8, attempts: 64, stage: 'primary' },
    { radius: 10, attempts: 64, stage: 'nearby-retry' },
    { radius: 50, attempts: 256, stage: 'wide-retry' }
  ]);
  assert.equal(deliveryRingOffsets(10, 64).length, 64);
  assert.equal(deliveryRingOffsets(50, 256).length, 256);
});

test('uniform fallback selection honors deterministic random boundaries', () => {
  const candidates = ['first', 'middle', 'last'];
  assert.equal(chooseUniformCandidate(candidates, 0), 'first');
  assert.equal(chooseUniformCandidate(candidates, 1/3), 'middle');
  assert.equal(chooseUniformCandidate(candidates, 2/3), 'last');
  assert.equal(chooseUniformCandidate(candidates, 0.999999), 'last');
  assert.equal(chooseUniformCandidate([], 0), undefined);
});
