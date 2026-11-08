// SPDX-License-Identifier: GPL-3.0-only
// Pure Java OrderNpcManager candidate-order rules. Not wired into the Bedrock
// entity adapter until its current shared-file owner coordinates integration.

/** Java findFallbackPosNearMachine: dx ascending, then dz ascending, disk radius. */
export function normalFallbackOffsets(radius = 5) {
  const offsets = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= radius * radius) offsets.push([dx, dz]);
    }
  }
  return offsets;
}

/**
 * Java tryFindDrySpot: perimeter rings, top/bottom edges before left/right
 * edges. The attempt cap counts probes, including unloaded columns.
 */
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

/** Java World.random.nextInt(candidateCount), represented by a fixed [0,1) roll. */
export function chooseUniformCandidate(candidates, roll) {
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
  const value = Number(roll);
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.9999999999999999, value)) : 0;
  return candidates[Math.floor(normalized * candidates.length)];
}

/** Keep the three distinct Java delivery search stages explicit. */
export const JAVA_DELIVERY_SEARCH = Object.freeze([
  Object.freeze({ radius: 8, attempts: 64, stage: "primary" }),
  Object.freeze({ radius: 10, attempts: 64, stage: "nearby-retry" }),
  Object.freeze({ radius: 50, attempts: 256, stage: "wide-retry" })
]);
