// SPDX-License-Identifier: GPL-3.0-only
// Original timing: FoodPlateBlockEntity.java at pinned upstream e59e3db.
// Entity geometry is cosmetic. Only restaurant.pendingDishes can mint a plate.

export const DINING_ENTITY = 'ordertocook:dining_plate';
export const MEAL_TOKEN = 'ordertocook:meal_token';
const RESTAURANT = 'ordertocook:restaurant_id';
const ORDER = 'ordertocook:order_id';
const STAGE = 'ordertocook:stage';
const DIRTY_PLATE = 'ordertocook:dirty_plate';
const DIRTY_AFTER = 5000;
const DIRECTIONS = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };

function distance2(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function validLocation(value) { return value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key])); }
function clampVariant(value) { return Math.min(9, Math.max(0, Math.floor(Number(value) || 0))); }
function floorLocation(value) { return { x: Math.floor(value.x), y: Math.floor(value.y), z: Math.floor(value.z) }; }

/** Ten food variants each have four stages; stage zero is the shared placement. */
export function mealStage(meal, now) {
  const elapsed = Math.max(0, Number(now) - Number(meal.startedAt));
  const phase = elapsed < 750 ? 0 : elapsed < 3000 ? 1 : elapsed < 4000 ? 2 : elapsed < DIRTY_AFTER ? 3 : 4;
  return phase ? clampVariant(meal.variant) * 4 + phase : 0;
}

/** Prefer Java's chair-front position, then an adjacent clear table surface.
 * Unlike Java destroyBlock, this never replaces a player's occupied block.
 */
export function resolveMealAnchor(entity, chair) {
  const dimension = entity.dimension;
  const yaw = Number(entity.getRotation?.().y) || 0;
  const direction = chair?.permutation?.getState('minecraft:cardinal_direction');
  const forward = DIRECTIONS[String(direction)] || (Math.abs(Math.sin(yaw * Math.PI / 180)) > Math.abs(Math.cos(yaw * Math.PI / 180))
    ? [Math.sin(yaw * Math.PI / 180) < 0 ? 1 : -1, 0] : [0, Math.cos(yaw * Math.PI / 180) < 0 ? -1 : 1]);
  const base = floorLocation(chair?.location || entity.location);
  const front = { x: base.x + forward[0], y: base.y + 1, z: base.z + forward[1] };
  const clear = location => {
    try { const block = dimension.getBlock(location); return !!block?.isAir; } catch { return false; }
  };
  const center = location => ({ x: location.x + 0.5, y: location.y + 0.0125, z: location.z + 0.5 });
  if (clear(front)) return { dimensionId: dimension.id, location: center(front), rotationY: yaw + 180 };
  const candidates = Object.values(DIRECTIONS).map(([x, z]) => ({ x: base.x + x, y: base.y + 1, z: base.z + z }));
  candidates.sort((a, b) => distance2(a, front) - distance2(b, front));
  for (const candidate of candidates) {
    if (!clear(candidate)) continue;
    try {
      const support = dimension.getBlock({ ...candidate, y: candidate.y - 1 });
      if (support && !support.isAir && !support.isLiquid && support.typeId !== 'ordertocook:chair') {
        return { dimensionId: dimension.id, location: center(candidate), rotationY: yaw + 180 };
      }
    } catch { /* The next loaded surface is sufficient. */ }
  }
  for (const candidate of candidates) if (clear(candidate)) {
    return { dimensionId: dimension.id, location: center(candidate), rotationY: yaw + 180 };
  }
  // An unobstructed point on the customer's lap still has a stable saved anchor.
  const lap = { x: entity.location.x + forward[0] * 0.35, y: base.y + 1.0125, z: entity.location.z + forward[1] * 0.35 };
  return { dimensionId: dimension.id, location: clear(lap) ? lap : center(front), rotationY: yaw + 180 };
}

/** Dependency injection lets tests exercise state and failed native writes.
 * ctx: world, ItemStack, restaurants/getRestaurant/saveRestaurant, canManage,
 * getCustomerSeat, resumeCustomerMeal, interruptCustomerMeal.
 */
export function createDiningService(ctx) {
  const gameWorld = ctx.world;
  const lastStages = new Map();
  let lastSweepAt = -Infinity;

  function canonical(restaurant) { return ctx.getRestaurant(restaurant.id) === restaurant; }
  function loadedDimension(meal) {
    try {
      const dimension = gameWorld.getDimension(meal.dimensionId);
      return dimension.getBlock(floorLocation(meal.location)) ? dimension : undefined;
    } catch { return undefined; }
  }
  function validMeal(meal) {
    return meal && typeof meal.id === 'string' && typeof meal.dimensionId === 'string' && validLocation(meal.location) &&
      Number.isFinite(meal.startedAt) && Number.isFinite(meal.finishAt) && typeof meal.token === 'string' &&
      ['eating', 'dirty', 'claiming'].includes(meal.status);
  }

  /** Keep alpha.1's pending dueAt; do not infer new plates from paid history. */
  function migrate(restaurant) {
    if (!Array.isArray(restaurant.pendingDishes)) return false;
    let changed = false;
    const unique = new Map();
    const retained = [];
    for (const old of restaurant.pendingDishes) {
      if (!old || typeof old.id !== 'string' || typeof old.dimensionId !== 'string' || !validLocation(old.location)) {
        retained.push(old); continue; // Preserve invalid saved data for recovery.
      }
      let meal = old;
      if (meal.version !== 2) {
        if (!Number.isFinite(meal.dueAt)) { retained.push(old); continue; }
        const order = restaurant.orders?.find(order => order.id === old.id);
        meal = { ...old, version: 2, orderId: old.id, restaurantId: restaurant.id,
          startedAt: old.dueAt - 5500, finishAt: old.dueAt, action: 6, boomBonus: 0,
          variant: clampVariant(order?.platedVariant), rotationY: 0, status: 'eating',
          token: `${restaurant.id}|${old.id}` };
        changed = true;
      }
      const previous = unique.get(meal.id);
      if (previous) {
        // A claimed copy dominates an eating copy, so a duplicated legacy row
        // or repeated callback cannot create a second dirty plate.
        if (meal.status === 'claiming') unique.set(meal.id, meal);
        changed = true;
      } else unique.set(meal.id, meal);
    }
    if (changed) {
      restaurant.pendingDishes = [...retained, ...unique.values()];
      ctx.saveRestaurant(restaurant);
    }
    return changed;
  }

  function queueMeal(restaurant, order, customer, now = Date.now()) {
    if (!canonical(restaurant) || order.status !== 'completed' || order.type !== 'dine_in') return undefined;
    restaurant.pendingDishes ||= [];
    const existing = restaurant.pendingDishes.find(meal => meal?.id === order.id);
    if (existing) return existing;
    const timing = order.meal || { startedAt: now, finishAt: now + 5500, action: 6, boomBonus: 0 };
    const anchor = resolveMealAnchor(customer, ctx.getCustomerSeat?.(customer));
    const meal = { id: order.id, orderId: order.id, restaurantId: restaurant.id, version: 2,
      ...timing, ...anchor, dueAt: timing.finishAt, variant: clampVariant(order.platedVariant),
      token: `${restaurant.id}|${order.id}`, status: 'eating' };
    restaurant.pendingDishes.push(meal);
    return meal; // The caller saves payment + meal in the same restaurant record.
  }

  function hasVacancy(restaurant, customer) {
    const anchor = resolveMealAnchor(customer, ctx.getCustomerSeat?.(customer));
    return !(restaurant.pendingDishes || []).some(meal => meal && meal.status !== 'claiming' &&
      meal.dimensionId === anchor.dimensionId && validLocation(meal.location) && distance2(meal.location, anchor.location) < 0.64);
  }

  function queryVisuals(dimension, token) {
    return dimension.getEntities({ type: DINING_ENTITY }).filter(entity => entity.isValid && entity.getDynamicProperty(MEAL_TOKEN) === token);
  }
  function removeVisuals(meal, dimension = loadedDimension(meal)) {
    if (!dimension) return false;
    let complete = true;
    for (const entity of queryVisuals(dimension, meal.token)) {
      try { lastStages.delete(entity.id); entity.remove(); } catch { complete = false; }
    }
    return complete;
  }
  function syncVisual(restaurant, meal, now) {
    const dimension = loadedDimension(meal);
    if (!dimension) return;
    let entity;
    try { entity = meal.visualEntityId ? gameWorld.getEntity(meal.visualEntityId) : undefined; } catch { /* Query a loaded anchor below. */ }
    if (!entity?.isValid || entity.typeId !== DINING_ENTITY || entity.getDynamicProperty(MEAL_TOKEN) !== meal.token) {
      const matching = queryVisuals(dimension, meal.token);
      entity = matching[0];
      for (const duplicate of matching.slice(1)) duplicate.remove();
    }
    if (!entity?.isValid) {
      // This helper is never loot: a failed metadata write removes it, and a
      // crash leaving an unbound actor is removed by the orphan sweep.
      try {
        entity = dimension.spawnEntity(DINING_ENTITY, meal.location);
        entity.setDynamicProperty(MEAL_TOKEN, meal.token);
        entity.setDynamicProperty(RESTAURANT, restaurant.id);
        entity.setDynamicProperty(ORDER, meal.id);
        entity.setRotation({ x: 0, y: meal.rotationY || 0 });
      } catch (error) { try { entity?.remove(); } catch { /* Cosmetic cleanup retries. */ } throw error; }
      meal.visualEntityId = entity.id;
      // Entity ID is a cache. A stale/missing ID never decides plate ownership.
    }
    const stage = mealStage(meal, now);
    if (lastStages.get(entity.id) !== stage) {
      entity.setProperty(STAGE, stage);
      lastStages.set(entity.id, stage);
    }
  }

  function finishClaim(restaurant, meal, now = Date.now()) {
    if (!removeVisuals(meal)) return false;
    // Keep an interrupted meal's non-minting tombstone for the original 10
    // ticks. It remains the NPC's restart source if paid history was pruned.
    if (meal.action === 7 && now < meal.finishAt) return false;
    restaurant.pendingDishes = restaurant.pendingDishes.filter(value => value?.id !== meal.id);
    ctx.saveRestaurant(restaurant);
    return true;
  }

  function tick(now = Date.now()) {
    for (const restaurant of ctx.restaurants()) {
      if (restaurant.removing) continue;
      try {
        migrate(restaurant);
        for (const meal of [...(restaurant.pendingDishes || [])]) {
          if (!validMeal(meal) || !canonical(restaurant)) continue;
          if (meal.status === 'claiming') {
            if (meal.action === 7) {
              const order = restaurant.orders?.find(order => order.id === meal.id);
              ctx.resumeCustomerMeal?.(restaurant, order || { id: meal.id, type: 'dine_in', status: 'completed', meal }, meal);
            }
            finishClaim(restaurant, meal, now); continue;
          }
          if (now >= meal.startedAt + DIRTY_AFTER && meal.status !== 'dirty') {
            meal.status = 'dirty'; ctx.saveRestaurant(restaurant);
          }
          const order = restaurant.orders?.find(order => order.id === meal.id);
          ctx.resumeCustomerMeal?.(restaurant, order || { id: meal.id, type: 'dine_in', status: 'completed', meal }, meal);
          syncVisual(restaurant, meal, now);
        }
      } catch (error) { console.warn(`[OrderToCook] Dining ${restaurant.id}: ${String(error)}`); }
    }
    if (now - lastSweepAt >= 1000) { lastSweepAt = now; sweepOrphans(); }
  }

  function sweepOrphans() {
    for (const id of ['overworld', 'nether', 'the_end']) {
      try {
        const seen = new Set();
        for (const entity of gameWorld.getDimension(id).getEntities({ type: DINING_ENTITY })) {
          try {
            const token = entity.getDynamicProperty(MEAL_TOKEN);
            const restaurant = ctx.getRestaurant(entity.getDynamicProperty(RESTAURANT));
            const meal = restaurant?.pendingDishes?.find(meal => validMeal(meal) && meal.token === token && meal.status !== 'claiming');
            if (!meal || meal.dimensionId !== entity.dimension.id || seen.has(token) || distance2(entity.location, meal.location) > 0.25) {
              lastStages.delete(entity.id); entity.remove();
            } else seen.add(token);
          } catch { /* A helper may unload during the scan; retry when loaded. */ }
        }
      } catch { /* No dimension or chunk is loaded by a cleanup scan. */ }
    }
  }

  function resolveEntity(entity) {
    if (!entity?.isValid || entity.typeId !== DINING_ENTITY) return undefined;
    const restaurant = ctx.getRestaurant(entity.getDynamicProperty(RESTAURANT));
    const token = entity.getDynamicProperty(MEAL_TOKEN);
    const meal = restaurant?.pendingDishes?.find(value => validMeal(value) && value.token === token);
    return meal ? { restaurant, meal } : undefined;
  }

  /** Also lets a player click the supporting table where custom entity hit
   * testing is unavailable on a particular input device/client. */
  function atBlock(block) {
    const candidates = [];
    for (const restaurant of ctx.restaurants()) for (const meal of restaurant.pendingDishes || []) {
      if (!validMeal(meal) || meal.status === 'claiming' || meal.dimensionId !== block.dimension.id) continue;
      const anchor = floorLocation(meal.location);
      if (anchor.x === block.location.x && anchor.z === block.location.z &&
          (anchor.y === block.location.y || anchor.y === block.location.y + 1)) candidates.push({ restaurant, meal });
    }
    candidates.sort((a, b) => a.meal.startedAt - b.meal.startedAt);
    return candidates[0];
  }

  function reservePlateSlot(player) {
    const container = player.getComponent('minecraft:inventory')?.container;
    if (!container) return undefined;
    const item = new ctx.ItemStack(DIRTY_PLATE);
    let empty = -1;
    for (let slot = 0; slot < container.size; slot++) {
      const before = container.getItem(slot);
      if (!before) { if (empty < 0) empty = slot; continue; }
      if (before.amount < before.maxAmount && before.isStackableWith(item)) {
        const after = before.clone(); after.amount++;
        return { container, slot, before, after };
      }
    }
    return empty < 0 ? undefined : { container, slot: empty, before: undefined, after: item };
  }

  /** Claim is durable before touching native inventory. Retries and restart
   * cannot issue twice, even if visual removal/the final cleanup save fails.
   * Bedrock cannot atomically commit world DPs and inventory: an abrupt process
   * kill between the durable claim and native write can lose this one plate.
   * We prefer that bounded loss to a replayable duplication path.
   */
  function claim(player, restaurant, meal, now = Date.now()) {
    if (!canonical(restaurant) || !restaurant.pendingDishes?.includes(meal) || !validMeal(meal) || meal.status === 'claiming') return { ok: false, reason: 'already_claimed' };
    if (!player?.isValid || player.dimension.id !== meal.dimensionId || distance2(player.location, meal.location) > 36) return { ok: false, reason: 'too_far' };
    if (ctx.canManage && !ctx.canManage(player, restaurant)) return { ok: false, reason: 'permission' };
    const reservation = reservePlateSlot(player);
    if (!reservation) return { ok: false, reason: 'inventory_full' };
    const previousStatus = meal.status;
    const early = now < meal.startedAt + DIRTY_AFTER;
    const order = restaurant.orders?.find(order => order.id === meal.id);
    const previousMeal = order?.meal;
    const previousTiming = { action: meal.action, startedAt: meal.startedAt, finishAt: meal.finishAt };
    if (early) {
      Object.assign(meal, { action: 7, startedAt: now, finishAt: now + 500 });
      if (order) order.meal = { ...order.meal, action: 7, startedAt: now, finishAt: now + 500 };
    }
    meal.status = 'claiming';
    meal.claimedAt = now;
    meal.claimedBy = player.id;
    ctx.saveRestaurant(restaurant);
    try {
      reservation.container.setItem(reservation.slot, reservation.after);
    } catch (error) {
      // Native setItem can throw before OR after accepting the value. Roll back
      // the exact reserved slot before making its saved claim retryable.
      try {
        reservation.container.setItem(reservation.slot, reservation.before);
        meal.status = previousStatus;
        Object.assign(meal, previousTiming);
        delete meal.claimedAt; delete meal.claimedBy;
        if (order) order.meal = previousMeal;
        ctx.saveRestaurant(restaurant);
      } catch (rollbackError) {
        console.warn(`[OrderToCook] Dirty plate claim retained after uncertain inventory write: ${String(rollbackError)}`);
      }
      throw error;
    }
    if (early) ctx.interruptCustomerMeal?.(meal.id, { startedAt: now, finishAt: now + 500, action: 7 });
    try { finishClaim(restaurant, meal, now); }
    catch (error) { console.warn(`[OrderToCook] Claimed plate cleanup deferred: ${String(error)}`); }
    return { ok: true, early };
  }

  /** Machine removal returns each outstanding plate once at its own anchor. */
  function cleanupRestaurant(restaurant, now = Date.now()) {
    if (!canonical(restaurant)) return false;
    migrate(restaurant);
    for (const meal of [...(restaurant.pendingDishes || [])]) {
      if (!validMeal(meal)) return false;
      const dimension = loadedDimension(meal);
      if (!dimension) return false;
      if (meal.status !== 'claiming') {
        const previousStatus = meal.status;
        meal.status = 'claiming'; meal.claimedAt = now; meal.claimedBy = 'restaurant_removed';
        ctx.saveRestaurant(restaurant);
        const item = new ctx.ItemStack(DIRTY_PLATE);
        item.setDynamicProperty(MEAL_TOKEN, meal.token);
        // Like a player claim, the persisted marker is the authority. A crash
        // never turns this into an endlessly retryable item-spawn instruction.
        try { dimension.spawnItem(item, meal.location); }
        catch (error) {
          let receiptKnown = false, receiptExists = false;
          try {
            receiptExists = dimension.getEntities({ type: 'minecraft:item', location: meal.location, maxDistance: 2 })
              .some(entity => entity.getComponent('minecraft:item')?.itemStack?.getDynamicProperty(MEAL_TOKEN) === meal.token);
            receiptKnown = true;
          } catch { /* An uncertain write stays claimed; never replay it blindly. */ }
          if (!receiptExists) {
            if (receiptKnown && canonical(restaurant)) {
              meal.status = previousStatus; delete meal.claimedAt; delete meal.claimedBy;
              ctx.saveRestaurant(restaurant);
            }
            throw error;
          }
        }
      }
      if (!finishClaim(restaurant, meal, now)) return false;
    }
    return !(restaurant.pendingDishes || []).length;
  }

  return { queueMeal, hasVacancy, tick, migrate, claim, resolveEntity, atBlock, cleanupRestaurant, sweepOrphans };
}
