// SPDX-License-Identifier: GPL-3.0-only
// Staged, NOT shipped. Forge 1.20.1 OrderNpcManager at
// e59e3dbcabe19b783d9adb933db5fcb8bc1e4642, lines 1521-1667.
// World IO and predicates are explicit ports, NOT inferred Bedrock equivalents.

/** Java normal fallback: x ascending, then z ascending, radius-5 disk. */
export function normalFallbackOffsets(radius = 5) {
  const offsets = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= radius * radius) offsets.push([dx, dz]);
    }
  }
  return offsets;
}

/** A probe consumes the budget even when its column is unavailable. */
export function deliveryRingOffsets(radius, attempts) {
  const offsets = [];
  for (let ring = 1; ring <= radius && offsets.length < attempts; ring++) {
    for (let dx = -ring; dx <= ring && offsets.length < attempts; dx++) {
      for (const dz of [-ring, ring]) {
        if (offsets.length >= attempts) break;
        offsets.push([dx, dz]);
      }
    }
    for (let dz = -ring + 1; dz < ring && offsets.length < attempts; dz++) {
      for (const dx of [-ring, ring]) {
        if (offsets.length >= attempts) break;
        offsets.push([dx, dz]);
      }
    }
  }
  return offsets;
}

/** Distribution only: this does not reproduce Java RandomSource bit sequences. */
export function chooseUniformCandidate(candidates, roll) {
  if (!candidates.length) return undefined;
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('Expected a random roll in [0, 1)');
  return candidates[Math.floor(roll * candidates.length)];
}

export const JAVA_DELIVERY_SEARCH = Object.freeze([
  Object.freeze({ radius: 8, attempts: 64, stage: 'primary' }),
  Object.freeze({ radius: 10, attempts: 64, stage: 'nearby-retry' }),
  Object.freeze({ radius: 50, attempts: 256, stage: 'wide-retry' })
]);

/**
 * @typedef {{x: number, y: number, z: number}} Position
 * @typedef {{air: boolean, fluidEmpty: boolean, chair: boolean, redstoneConductor: boolean}} BlockFacts
 * @typedef {{minY: number, maxY: number,
 *   isLoadedColumn: (x: number, z: number) => boolean,
 *   topY: (x: number, z: number) => number | undefined,
 *   blockAt: (position: Position) => BlockFacts | undefined}} SpawnWorld
 * topY MUST mean MOTION_BLOCKING_NO_LEAVES spawn Y, not the supporting block Y.
 * maxY is exclusive. redstoneConductor MUST mean Forge isRedstoneConductor,
 * not Bedrock isSolid, collision height, or a guessed list of block names.
 */

/** Exact Forge headroom predicate on known snapshots; unknown IO fails closed.
 * @param {SpawnWorld} world @param {Position} pos
 */
export function isHeadClear(world, pos) {
  try {
    if (pos.y >= world.maxY) return false;
    const below = world.blockAt({ ...pos, y: pos.y - 1 });
    const feet = world.blockAt(pos);
    const head = world.blockAt({ ...pos, y: pos.y + 1 });
    return !!(feet?.air === true && head?.air === true && below?.air === false &&
      (below.chair === true || below.redstoneConductor === true));
  } catch { return false; }
}

/** Forge tests fluids at feet and below, not merely Block.isLiquid.
 * @param {SpawnWorld} world @param {Position} pos
 */
export function isDry(world, pos) {
  try {
    if (world.blockAt(pos)?.fluidEmpty !== true) return false;
    return pos.y - 1 < world.minY || world.blockAt({ ...pos, y: pos.y - 1 })?.fluidEmpty === true;
  } catch { return false; }
}

/**
 * Bedrock safety adaptation: gate EVERY column, including the initial target
 * and normal fallback. Java explicitly gates only the ring-column helper.
 * No world mutation, force-load, entity allocation or persistence occurs here.
 * @param {SpawnWorld} world @param {number} x @param {number} z
 */
function safeColumn(world, x, z) {
  try {
    if (world.isLoadedColumn(x, z) !== true) return undefined;
    const y = world.topY(x, z);
    if (!Number.isInteger(y)) return undefined;
    const pos = { x, y, z };
    return isHeadClear(world, pos) && isDry(world, pos) ? pos : undefined;
  } catch { return undefined; }
}

/** Only called AFTER the existing normal-chair search fails. Not for walk-ins.
 * @param {SpawnWorld} world @param {Position} machine @param {() => number} rng
 */
export function findNormalFallback(world, machine, rng = Math.random) {
  const candidates = [];
  for (const [dx, dz] of normalFallbackOffsets()) {
    const candidate = safeColumn(world, machine.x + dx, machine.z + dz);
    if (candidate) candidates.push(candidate);
  }
  // Forge draws once even with one candidate; never draws for an empty pool.
  return candidates.length ? chooseUniformCandidate(candidates, rng()) : undefined;
}

/**
 * Regular delivery retries restart their own ring enumeration; do not dedupe.
 * Long-distance delivery uses only the target and primary 8/64 stage.
 * @param {SpawnWorld} world @param {Position} target @param {boolean} longDistance
 */
export function findDeliveryPosition(world, target, longDistance = false) {
  const direct = safeColumn(world, target.x, target.z);
  if (direct) return direct;
  const stages = longDistance ? JAVA_DELIVERY_SEARCH.slice(0, 1) : JAVA_DELIVERY_SEARCH;
  for (const { radius, attempts } of stages) {
    for (const [dx, dz] of deliveryRingOffsets(radius, attempts)) {
      const candidate = safeColumn(world, target.x + dx, target.z + dz);
      if (candidate) return candidate;
    }
  }
  return undefined;
}
