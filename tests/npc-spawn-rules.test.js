// SPDX-License-Identifier: GPL-3.0-only
// Source-rule candidate tests, NOT native terrain, API, persistence or gameplay acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalFallbackOffsets, deliveryRingOffsets, chooseUniformCandidate,
  findNormalFallback, findDeliveryPosition, isHeadClear, isDry
} from '../prototypes/npc-spawn/rules.js';

const origin = { x: 0, y: 10, z: 0 };
const AIR = Object.freeze({ air: true, fluidEmpty: true, chair: false, redstoneConductor: false });
const FLOOR = Object.freeze({ ...AIR, air: false, redstoneConductor: true });

function fixture() {
  const columns = new Map(), blocks = new Map(), probes = [], heights = [];
  const world = {
    minY: -64, maxY: 320,
    isLoadedColumn(x, z) { probes.push([x, z]); return true; },
    topY(x, z) { heights.push([x, z]); return columns.get(`${x},${z}`); },
    blockAt(p) { return blocks.get(`${p.x},${p.y},${p.z}`) ?? AIR; }
  };
  function block(p, facts) { blocks.set(`${p.x},${p.y},${p.z}`, facts); }
  function surface(x, z, y = 10, facts = FLOOR) {
    columns.set(`${x},${z}`, y); block({ x, y: y - 1, z }, facts);
    return { x, y, z };
  }
  return { world, probes, heights, columns, block, surface };
}

test('normal fallback uses the inclusive 81-column disk in Java x/z order', () => {
  const offsets = normalFallbackOffsets();
  assert.equal(offsets.length, 81);
  assert.deepEqual(offsets[0], [-5, 0]); assert.deepEqual(offsets.at(-1), [5, 0]);
  assert.ok(offsets.every(([x, z]) => x*x + z*z <= 25));
  assert.ok(!offsets.some(([x, z]) => x === 5 && z === 1));
  const env = fixture(); const edge = env.surface(5, 0, 200); env.surface(5, 1);
  assert.deepEqual(findNormalFallback(env.world, origin, () => 0), edge);
  assert.deepEqual(env.heights, offsets, 'all columns are considered, not a truncated nearest-first list');
});

test('normal fallback filters first, uses heightmap Y and draws once from the complete pool', () => {
  for (const [roll, index] of [[0, 0], [1/3, 1], [2/3, 2], [.999999, 2]]) {
    const env = fixture();
    const pool = [env.surface(-5, 0, 30), env.surface(0, 0, 100), env.surface(5, 0, -20)];
    env.surface(-4, 0, 10, { ...FLOOR, fluidEmpty: false });
    let calls = 0;
    assert.deepEqual(findNormalFallback(env.world, origin, () => { calls++; return roll; }), pool[index]);
    assert.equal(calls, 1); assert.equal(env.heights.length, 81);
  }
});

test('normal empty pool returns no position without RNG; negative coordinates translate exactly', () => {
  const env = fixture();
  assert.equal(findNormalFallback(env.world, origin, () => { assert.fail('empty pool must not draw'); }), undefined);
  const machine = { x: -30, y: 5, z: -50 }, expected = env.surface(-35, -50, 70);
  assert.deepEqual(findNormalFallback(env.world, machine, () => 0), expected);
});

test('delivery ring order and attempt caps include partial rings, not the nominal full radii', () => {
  const near = deliveryRingOffsets(8, 64), wide = deliveryRingOffsets(50, 256);
  assert.deepEqual(near.slice(0, 8), [[-1,-1],[-1,1],[0,-1],[0,1],[1,-1],[1,1],[-1,0],[1,0]]);
  assert.deepEqual(near[8], [-2,-2]); assert.deepEqual(near[23], [2,1]);
  assert.equal(near.length, 64); assert.deepEqual(near.at(-1), [3,4]);
  assert.deepEqual(deliveryRingOffsets(10, 64), near);
  assert.equal(wide.length, 256); assert.deepEqual(wide.at(-1), [7,8]);
  assert.equal(new Set(wide.map(JSON.stringify)).size, 256);
});

test('delivery tests exact target heightmap first; unsafe target advances in ring order', () => {
  const env = fixture(), direct = env.surface(0, 0, 100);
  env.surface(-1, -1, 20); const next = env.surface(-1, 1, 30);
  assert.deepEqual(findDeliveryPosition(env.world, origin), direct);
  assert.deepEqual(env.probes, [[0, 0]]);
  env.block({ x: 0, y: 100, z: 0 }, { ...AIR, air: false });
  env.block({ x: -1, y: 19, z: -1 }, { ...FLOOR, fluidEmpty: false });
  assert.deepEqual(findDeliveryPosition(env.world, origin), next);
});

test('unloaded columns consume delivery budget without any height/block lookup', () => {
  const env = fixture();
  env.world.isLoadedColumn = (x, z) => { env.probes.push([x, z]); return false; };
  let heightReads = 0, blockReads = 0;
  env.world.topY = () => { heightReads++; return undefined; };
  env.world.blockAt = () => { blockReads++; return undefined; };
  assert.equal(findDeliveryPosition(env.world, origin, true), undefined);
  assert.equal(env.probes.length, 65); assert.deepEqual(env.probes.at(-1), [3,4]);
  env.probes.length = 0;
  assert.equal(findDeliveryPosition(env.world, origin, false), undefined);
  assert.equal(env.probes.length, 385); assert.deepEqual(env.probes.at(-1), [7,8]);
  assert.equal(heightReads, 0); assert.equal(blockReads, 0);
});

test('regular retries restart and recheck the same columns; long-distance never uses them', () => {
  for (const longDistance of [false, true]) {
    const env = fixture(), expected = env.surface(-1, -1, 80); let visits = 0;
    const read = env.world.topY;
    env.world.topY = (x, z) => x === -1 && z === -1 && ++visits === 1 ? undefined : read(x, z);
    assert.deepEqual(findDeliveryPosition(env.world, origin, longDistance), longDistance ? undefined : expected);
    assert.equal(visits, longDistance ? 1 : 2);
  }
});

test('regular delivery reaches the last wide-budget candidate but not the next one', () => {
  const env = fixture(), last = env.surface(7, 8, 60);
  assert.deepEqual(findDeliveryPosition(env.world, origin, true), undefined);
  assert.deepEqual(findDeliveryPosition(env.world, origin, false), last);
  env.columns.clear(); env.surface(8, -8, 60);
  assert.equal(findDeliveryPosition(env.world, origin, false), undefined);
});

test('unload or read exceptions fail closed and the next candidate is still tested', () => {
  for (const failing of ['isLoadedColumn', 'topY', 'blockAt']) {
    const env = fixture(); env.surface(-1, -1); const safe = env.surface(-1, 1);
    const read = env.world[failing];
    env.world[failing] = (...args) => {
      const x = typeof args[0] === 'object' ? args[0].x : args[0];
      const z = typeof args[0] === 'object' ? args[0].z : args[1];
      if (x === -1 && z === -1) throw Error('unloaded between checks');
      return read(...args);
    };
    assert.deepEqual(findDeliveryPosition(env.world, origin, true), safe);
  }
});

test('Forge safety distinguishes partial/non-conducting support, its chair exception and fluids', () => {
  const env = fixture(), pos = env.surface(0, 0), below = { ...pos, y: pos.y - 1 };
  assert.equal(isHeadClear(env.world, pos) && isDry(env.world, pos), true);
  for (const support of [AIR, { ...FLOOR, redstoneConductor: false }]) {
    env.block(below, support); assert.equal(isHeadClear(env.world, pos), false);
  }
  env.block(below, { ...FLOOR, redstoneConductor: false, chair: true });
  assert.equal(isHeadClear(env.world, pos) && isDry(env.world, pos), true);
  env.block(below, { ...FLOOR, chair: true, fluidEmpty: false });
  assert.equal(isHeadClear(env.world, pos), true); assert.equal(isDry(env.world, pos), false);
  env.block(below, FLOOR); env.block(pos, { ...AIR, fluidEmpty: false });
  assert.equal(isDry(env.world, pos), false);
  env.block(pos, AIR); env.block({ ...pos, y: pos.y + 1 }, { ...AIR, air: false });
  assert.equal(isHeadClear(env.world, pos), false);
});

test('Forge height guard is exclusive; low-Y is diagnostic, not an extra rejection rule', () => {
  const env = fixture(); env.world.maxY = 16; env.world.minY = -4;
  const top = env.surface(0, 0, 15);
  // The Java-world fixture supplies out-of-build air, NOT a native Bedrock read.
  assert.equal(isHeadClear(env.world, top), true);
  assert.equal(isHeadClear(env.world, { ...top, y: 16 }), false);
  const bottom = env.surface(1, 0, -3);
  assert.equal(isHeadClear(env.world, bottom) && isDry(env.world, bottom), true);
  assert.equal(isDry(env.world, { x: 5, y: -4, z: 0 }), true);
  assert.equal(isHeadClear(env.world, { x: 5, y: -4, z: 0 }), false, 'void still provides no support');
});

test('unknown facts are not air/dry/support and no-safe-point never returns the requested coordinate', () => {
  const env = fixture(); env.surface(0, 0); env.world.blockAt = () => undefined;
  assert.equal(findDeliveryPosition(env.world, origin), undefined);
  assert.equal(findNormalFallback(env.world, origin, () => 0), undefined);
  assert.equal(chooseUniformCandidate([], 0), undefined);
  assert.throws(() => chooseUniformCandidate(['only'], 1), RangeError);
});
