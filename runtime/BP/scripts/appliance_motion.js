// SPDX-License-Identifier: GPL-3.0-only
// Pure timing for bounded poses baked from the pinned Order To Cook animations.

export const APPLIANCE_TICK_INTERVAL = 2;
export const FRIDGE_MOTION_TICKS = 20;
export const FRIDGE_LAST_FRAME = 10;
export const DISHWASHER_LAST_FRAME = 15;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/** Progress measures opening, so reversing a target never jumps to an endpoint. */
export function advanceDoorMotion(position, open, elapsedTicks) {
  const current = clamp(Number.isFinite(position) ? position : 0, 0, FRIDGE_MOTION_TICKS);
  const elapsed = Math.max(0, Number.isFinite(elapsedTicks) ? elapsedTicks : 0);
  const next = clamp(current + (open ? elapsed : -elapsed), 0, FRIDGE_MOTION_TICKS);
  return { position: next, frame: Math.round(next / FRIDGE_MOTION_TICKS * FRIDGE_LAST_FRAME) };
}

/** A persisted phase and remaining timer fully determine the cosmetic pose. */
export function dishwasherFrame(appliance) {
  const phase = appliance.phase;
  if (phase === 0) return 0;
  if (phase === 5) return DISHWASHER_LAST_FRAME;
  const duration = phase === 1 ? 14 : phase === 2 ? 30 : phase === 3 ? (appliance.plates > 8 ? 80 : 40) : 24;
  const elapsed = clamp(duration - appliance.remainingTicks, 0, duration);
  if (phase === 3) return Math.min(DISHWASHER_LAST_FRAME, Math.floor((elapsed % 40) / 40 * (DISHWASHER_LAST_FRAME + 1)));
  return clamp(Math.floor(elapsed / duration * DISHWASHER_LAST_FRAME), 0, DISHWASHER_LAST_FRAME);
}
