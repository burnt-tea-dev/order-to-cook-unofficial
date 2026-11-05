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
    return Math.max(0, refreshInterval(restaurant) - (total(restaurant) - restaurant.machineRefreshOrigin));
  }

  function refreshed(restaurant) {
    // The origin and the new offers commit in the same restaurant save. A
    // failed save leaves progress due, rather than losing a refresh interval.
    restaurant.machineRefreshOrigin = total(restaurant);
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
    if (!restaurant.active || restaurant.removing) return;
    // This callback exists only while the native block is simulated. Persist
    // a small number, as dining already does, not the full menu/order record.
    const advanced = total(restaurant) + 1;
    ctx.world.setDynamicProperty(MACHINE_TICKS + restaurant.id, advanced);
    let changed = false;
    if (advanced - restaurant.machineRefreshOrigin >= refreshInterval(restaurant)) changed = ctx.refresh(restaurant, block);
    if (arrival.remaining > 0) arrival.remaining--;
    else {
      arrival.remaining = ticks(restaurant.config?.walkInIntervalMs ?? DEFAULT_CONFIG.walkInIntervalMs);
      changed = ctx.arrive(restaurant, block) || changed;
    }
    if (changed) ctx.saveRestaurant(restaurant);
  }

  return { adopt, remaining, refreshed, tick, forget: id => arrivals.delete(id) };
}
