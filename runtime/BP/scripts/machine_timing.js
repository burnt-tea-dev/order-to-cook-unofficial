// SPDX-License-Identifier: GPL-3.0-only
// OrderMachineBlockEntity: refresh progress is saved; walkInTimer is transient.
import { DEFAULT_CONFIG } from './config.js';

export const MACHINE_TICKS = 'ordertocook:machine_ticks:';
const ticks = milliseconds => Math.max(1, Math.ceil(milliseconds / 50));
const refreshInterval = restaurant => ticks(restaurant.config?.refreshMs ?? DEFAULT_CONFIG.refreshMs);

export function createMachineTiming(ctx) {
  const arrivals = new Map();

  function total(restaurant) {
    const value = ctx.world.getDynamicProperty(MACHINE_TICKS + restaurant.id);
    if (value === undefined) return 0;
    if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid saved machine progress; preserved');
    return value;
  }

  function adopt(restaurant, time) {
    if (restaurant.machineRefreshOrigin !== undefined) {
      if (!Number.isSafeInteger(restaurant.machineRefreshOrigin)) throw Error('Invalid saved refresh origin; preserved');
      return false;
    }
    const interval = refreshInterval(restaurant);
    const remaining = Number.isFinite(restaurant.nextRefreshAt)
      ? Math.max(0, Math.ceil((restaurant.nextRefreshAt - time.wall) / 50)) : interval;
    restaurant.machineRefreshOrigin = total(restaurant) - Math.max(0, interval - remaining);
    // Old wall deadlines are consumed once. New runtime never uses them.
    delete restaurant.nextRefreshAt;
    delete restaurant.nextWalkInAt;
    return true;
  }

  function remaining(restaurant) {
    return Math.max(0, refreshInterval(restaurant) - Math.max(0, total(restaurant) - restaurant.machineRefreshOrigin));
  }

  function placed(restaurant) {
    // setPlacedBy schedules 20 initialization ticks, even while closed. A
    // future origin reserves them in the existing saved counters; load resumes
    // the remainder without adding fields or resetting an initialized machine.
    restaurant.machineRefreshOrigin = total(restaurant) + 20;
    arrivals.delete(restaurant.id);
  }

  function refreshed(restaurant) {
    // The origin and the new offers commit in the same restaurant save. A
    // failed save leaves progress due, rather than losing a refresh interval.
    // An explicit refresh during initialization must not finish the warmup.
    restaurant.machineRefreshOrigin = Math.max(total(restaurant), restaurant.machineRefreshOrigin);
    delete restaurant.nextRefreshAt;
    delete restaurant.nextWalkInAt;
  }

  function tick(restaurant, block) {
    let arrival = arrivals.get(restaurant.id);
    if (!arrival) {
      // Java does not serialize walkInTimer. A newly loaded block instance
      // starts with the original 1200-tick delay, including after restart.
      arrival = { remaining: ticks(DEFAULT_CONFIG.walkInIntervalMs) };
      arrivals.set(restaurant.id, arrival);
    }
    if (restaurant.removing) return;
    const elapsed = total(restaurant);
    if (elapsed < restaurant.machineRefreshOrigin) {
      // Java returns on the twentieth initialization tick too. Neither order
      // progress nor walkInTimer advances until the next block callback.
      ctx.world.setDynamicProperty(MACHINE_TICKS + restaurant.id, elapsed + 1);
      return;
    }
    if (!restaurant.active) return;
    // This callback exists only while the native block is simulated. Persist
    // a small number, as dining already does, not the full menu/order record.
    const advanced = elapsed + 1;
    ctx.world.setDynamicProperty(MACHINE_TICKS + restaurant.id, advanced);
    let changed = false;
    if (advanced - restaurant.machineRefreshOrigin >= refreshInterval(restaurant)) changed = ctx.refresh(restaurant, block);
    if (arrival.remaining > 0) arrival.remaining--;
    else {
      arrival.remaining = ticks(restaurant.config?.walkInIntervalMs ?? DEFAULT_CONFIG.walkInIntervalMs);
      changed = ctx.arrive(restaurant, block) || changed;
    }
    // A nested customer save can fail and restore a different canonical
    // snapshot. Never recommit this stale object after that rollback.
    if (ctx.getRestaurant(restaurant.id) !== restaurant) {
      throw Error('Machine restaurant changed during tick; stale timer save aborted');
    }
    if (changed) ctx.saveRestaurant(restaurant);
  }

  return { adopt, placed, remaining, refreshed, tick, forget: id => arrivals.delete(id) };
}
