// SPDX-License-Identifier: GPL-3.0-only
// StoveBlockEntity at Java e59e3dbc: 15-tick delay, 5-tick burst, 8-tick frames.
// These fields live with the appliance's saved fuel and cooking progress.

/** Call once when this service first sees a stove, including after a reload. */
export function initializeStoveFire(data) {
  data.firePhase = data.litTime > 0 ? 3 : 0;
  data.fireTicks = 0;
  data.cycleFrame = data.litTime > 0 && Number.isInteger(data.cycleFrame) &&
    data.cycleFrame >= 0 && data.cycleFrame < 4 ? data.cycleFrame : 0;
}

/** Call after consuming a fresh fuel item, even if the previous fuel just ended. */
export function igniteStoveFire(data) {
  data.firePhase = 1;
  data.fireTicks = 0;
  data.cycleFrame = 0;
}

/**
 * Advance one game tick BEFORE decrementing litTime. This is Java's order:
 * the last burning tick still advances the fire; the next unlit tick clears it.
 * The caller handles the returned cosmetic event at the stove's facing mouth.
 * @returns {"burst" | "cycle" | undefined}
 */
export function advanceStoveFire(data) {
  if (data.litTime <= 0) {
    data.firePhase = 0;
    data.fireTicks = 0;
    data.cycleFrame = 0;
    return undefined;
  }
  data.fireTicks++;
  if (data.firePhase === 1 && data.fireTicks >= 15) {
    data.firePhase = 2;
    data.fireTicks = 0;
    return "burst";
  }
  if (data.firePhase === 2 && data.fireTicks >= 5) {
    data.firePhase = 3;
    data.fireTicks = 0;
    data.cycleFrame = 0;
    return undefined;
  }
  if (data.firePhase === 3 && data.fireTicks >= 8) {
    data.fireTicks = 0;
    data.cycleFrame = (data.cycleFrame + 1) % 4;
    return "cycle";
  }
  return undefined;
}

/** 0 = unlit/ignition delay; 1 = burst; 2..5 = the four original cycle textures. */
export function stoveFireFrame(data) {
  if (data.firePhase === 2) return 1;
  if (data.firePhase === 3) return data.cycleFrame + 2;
  return 0;
}
