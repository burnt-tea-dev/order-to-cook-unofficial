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

function distanceSquared(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function locationOrder(a, b) { return a.x - b.x || a.y - b.y || a.z - b.z; }

/**
 * Query the engine index, then recheck loaded blocks and the caller's exact
 * geometry. An index hit never grants ownership or authorizes inventory access.
 * @param {import('@minecraft/server').Dimension} dimension
 * @param {import('@minecraft/server').Vector3} center
 * @param {string} typeId
 * @param {number} radius
 * @param {{ shape?: 'sphere' | 'cylinder', halfHeight?: number }} options
 * @returns {import('@minecraft/server').Block[]}
 */
export function nearbyStationBlocks(dimension, center, typeId, radius, options = {}) {
  const shape = options.shape ?? 'sphere', halfHeight = options.halfHeight ?? radius;
  if (!STATION_TYPES.has(typeId)) throw new Error(`Unsupported station POI: ${typeId}`);
  if (!Number.isFinite(radius) || radius < 0 || !Number.isFinite(halfHeight) || halfHeight < 0 ||
      !['sphere', 'cylinder'].includes(shape)) throw new Error('Invalid station POI range');
  const manager = requireStationPoi(dimension);
  // getInRangeSorted's beta documentation is ambiguous about its volume.
  // Use the unsorted shape-specific queries and define our ordering explicitly.
  const hits = shape === 'sphere'
    ? manager.getInRange({ name: typeId }, center, radius)
    : manager.getInSquare({ name: typeId }, center, Math.max(radius, halfHeight));
  const candidates = [], seen = new Set();
  for (const hit of hits) {
    const p = hit.position;
    if (!p || ![p.x, p.y, p.z].every(Number.isInteger)) continue;
    const dx = p.x - center.x, dy = p.y - center.y, dz = p.z - center.z;
    if (shape === 'sphere' ? dx * dx + dy * dy + dz * dz > radius * radius :
        Math.abs(dy) > halfHeight || dx * dx + dz * dz > radius * radius) continue;
    const key = `${p.x},${p.y},${p.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const block = dimension.getBlock(p);
      if (!block || block.typeId !== typeId) continue;
      // A refrigerator is one inventory anchored at its lower half.
      if (typeId === 'ordertocook:refrigerator' && block.permutation.getAllStates()['ordertocook:half'] === 'upper') continue;
      candidates.push(block);
    } catch { /* A chunk can unload between the POI query and the block read. */ }
  }
  return candidates.sort((a, b) => distanceSquared(a.location, center) - distanceSquared(b.location, center) ||
    locationOrder(a.location, b.location));
}

/** Java's restaurant chair search is a horizontal circle, with a separate Y cap. */
export function restaurantChairBlocks(dimension, center) {
  return nearbyStationBlocks(dimension, center, 'ordertocook:chair', 24, { shape: 'cylinder', halfHeight: 8 });
}
