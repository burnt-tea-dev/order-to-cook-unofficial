// SPDX-License-Identifier: GPL-3.0-only
// POI owns candidate positions. Canonical station data, permissions and seat
// riders remain with their existing owners; this module stores no world index.

const STATION_TYPES = new Set([
  'ordertocook:board', 'ordertocook:chair', 'ordertocook:refrigerator',
  'ordertocook:shelf', 'ordertocook:plate_shelf'
]);
const REQUIREMENT = 'Order To Cook requires Bedrock 26.60, @minecraft/server 2.12.0-beta, and the Beta APIs and Points of Interest (POI) world experiments.';

/** Must only run after worldLoad, outside before-events/restricted execution. */
export function requireStationPoi(dimension) {
  let blocks;
  try { blocks = dimension.poiManager?.blocks; }
  catch (error) { throw new Error(`${REQUIREMENT} ${String(error)}`); }
  if (typeof blocks?.getInRange !== 'function' || typeof blocks?.getInSquare !== 'function') {
    throw new Error(REQUIREMENT);
  }
  return blocks;
}

function locationOrder(a, b) { return a.x - b.x || a.y - b.y || a.z - b.z; }

/**
 * Query the engine index, then recheck loaded blocks and the caller's exact
 * geometry. An index hit never grants ownership or authorizes inventory access.
 * @param {import('@minecraft/server').Dimension} dimension
 * @param {import('@minecraft/server').Vector3} center
 * @param {string} typeId
 * @param {number} radius
 * @param {{ shape?: 'sphere' | 'cylinder' | 'cube', halfHeight?: number }} options
 * @returns {import('@minecraft/server').Block[]}
 */
export function nearbyStationBlocks(dimension, center, typeId, radius, options = {}) {
  const shape = options.shape ?? 'sphere', halfHeight = options.halfHeight ?? radius;
  if (!STATION_TYPES.has(typeId)) throw new Error(`Unsupported station POI: ${typeId}`);
  if (!Number.isFinite(radius) || radius < 0 || !Number.isFinite(halfHeight) || halfHeight < 0 ||
      !['sphere', 'cylinder', 'cube'].includes(shape)) throw new Error('Invalid station POI range');
  const manager = requireStationPoi(dimension);
  // getInRangeSorted's beta documentation is ambiguous about its volume.
  // Use the unsorted shape-specific queries and define our ordering explicitly.
  const hits = shape === 'sphere'
    ? manager.getInRange({ name: typeId }, center, radius)
    : manager.getInSquare({ name: typeId }, center, Math.max(radius, halfHeight));
  const candidates = [], seen = new Set();
  for (const hit of hits) {
    const p = hit.position;
    if (!p) continue;
    const { x, y, z } = p;
    if (![x, y, z].every(Number.isInteger)) continue;
    const position = { x, y, z };
    const dx = x - center.x, dy = y - center.y, dz = z - center.z;
    const distance = dx * dx + dy * dy + dz * dz;
    const outside = shape === 'sphere' ? distance > radius * radius :
      shape === 'cube' ? Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) > radius :
      Math.abs(dy) > halfHeight || dx * dx + dz * dz > radius * radius;
    if (outside) continue;
    const key = `${x},${y},${z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const block = dimension.getBlock(position);
      if (!block || block.typeId !== typeId) continue;
      // A refrigerator is one inventory anchored at its lower half.
      if (typeId === 'ordertocook:refrigerator' && block.permutation.getAllStates()['ordertocook:half'] === 'upper') continue;
      candidates.push({ block, position, distance });
    } catch { /* A chunk can unload between the POI query and the block read. */ }
  }
  // Sorting must stay in JavaScript: Block.location crosses the native bridge
  // on every comparison. The validated POI position already identifies the block.
  return candidates.sort((a, b) => a.distance - b.distance || locationOrder(a.position, b.position))
    .map(candidate => candidate.block);
}

/** Java's restaurant chair search is a horizontal circle, with a separate Y cap. */
export function restaurantChairBlocks(dimension, center) {
  return nearbyStationBlocks(dimension, center, 'ordertocook:chair', 24, { shape: 'cylinder', halfHeight: 8 });
}
