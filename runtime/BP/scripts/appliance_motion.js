// SPDX-License-Identifier: GPL-3.0-only
// Pure timing for bounded poses baked from the pinned Order To Cook animations.

export const APPLIANCE_TICK_INTERVAL = 2;
export const FRIDGE_MOTION_TICKS = 20;
export const FRIDGE_LAST_FRAME = 10;
export const DISHWASHER_LAST_FRAME = 15;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

/**
 * Full strokes use the original open/close clips. On an intermediate reversal
 * play the active clip backwards, retaining the visible pose instead of jumping
 * between two different elastic/bounce curves. `closing` selects the clip, not
 * the target. Position keeps the old 0=closed/20=open time coordinate.
 */
export function advanceDoorMotion(previous, open, elapsedTicks) {
  const state = typeof previous === 'number' ? { position: previous, closing: false } : previous;
  const current = clamp(Number.isFinite(state?.position) ? state.position : 0, 0, FRIDGE_MOTION_TICKS);
  const elapsed = Math.max(0, Number.isFinite(elapsedTicks) ? elapsedTicks : 0);
  let closing = state?.closing === true;
  if (elapsed && current === FRIDGE_MOTION_TICKS && !open) closing = true;
  else if (elapsed && current === 0 && open) closing = false;
  const next = clamp(current + (open ? elapsed : -elapsed), 0, FRIDGE_MOTION_TICKS);
  // Both terminal poses have neutral cabinet scale and coincide between clips.
  if (elapsed && (next === 0 || next === FRIDGE_MOTION_TICKS)) closing = false;
  return { position: next, closing,
    frame: Math.round((closing ? FRIDGE_MOTION_TICKS - next : next) / FRIDGE_MOTION_TICKS * FRIDGE_LAST_FRAME) };
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
