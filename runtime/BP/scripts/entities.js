// SPDX-License-Identifier: GPL-3.0-only
// Bedrock adaptation of Order To Cook by breezeth-CN; see THIRD_PARTY_NOTICES.md.
import { ButtonState, InputButton, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { containerCapacity, dropContainerContents, itemLabel, openContainerForm, playerInventory } from "./appliances.js";

const NS = "ordertocook:";
const CUSTOMER = `${NS}customer`;
const MOTORCYCLE = `${NS}motorcycle`;
const CONTROLLER = `${NS}controller`;
const SEAT = `${NS}seat`;
const CHAIR = `${NS}chair`;
const LIVE_ORDER = new Set(["accepted", "packed"]);
const COLORS = ["白色", "紅色", "藍色", "黃色"];
const DYES = Object.freeze({ "minecraft:white_dye": 0, "minecraft:red_dye": 1, "minecraft:blue_dye": 2, "minecraft:yellow_dye": 3 });
// Pinned CustomerEntity.java: special actions are separate from the four idle
// variants. These durations must match the converted original animation clips.
const ACTION_TICKS = Object.freeze({ 1: 12, 2: 12, 3: 40, 4: 60, 5: 120, 6: 110, 7: 10 });
const COMPLETION_ACTIONS = new Set([3, 4, 5, 6, 7]);
const EATING_ACTIONS = new Set([5, 6, 7]);
const IDLE_MILLISECONDS = Object.freeze({ 1: 4500, 2: 4500, 3: 4500, 4: 4695 });
function needsCustomer(order) { return !!order && (LIVE_ORDER.has(order.status) || (order.status === "offered" && !!order.walkIn)); }

function dist2(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function horizontalDist2(a, b) { return (a.x - b.x) ** 2 + (a.z - b.z) ** 2; }
function center(location, height = 0.5) { return { x: Math.floor(location.x) + 0.5, y: Math.floor(location.y) + height, z: Math.floor(location.z) + 0.5 }; }
function sameBlock(a, b) { return a.x === b.x && a.y === b.y && a.z === b.z; }

/** The Java idle-animation weights are 55%, 15%, 15%, 15%. */
export function rollCustomerAnimationVariant(roll = Math.random()) {
  return roll < 0.55 ? 1 : roll < 0.70 ? 2 : roll < 0.85 ? 3 : 4;
}

/** Stable loaded-block support check for the 0.6-wide customer footprint. */
export function hasFullStandingSupport(dimension, location) {
  try {
    const feet = dimension.getBlock(location);
    const head = dimension.getBlock({ ...location, y: location.y + 1 });
    const floor = dimension.getBlock({ ...location, y: location.y - 1 });
    if (!feet?.isAir || !head?.isAir || !floor || floor.isAir || floor.isLiquid || floor.isWaterlogged) return false;
    // A top slab can have a hit at y=1 despite not being a full floor block.
    // Exclude thin fixtures explicitly; the footprint rays also reject narrow
    // modded support shapes without relying on beta Block.isSolid.
    if (/(?:_slab[0-4]?|_stairs|_carpet|_trapdoor|_fence|_wall|_rail|_pressure_plate|_button|_door|_pane)$/.test(floor.typeId) ||
        ['minecraft:end_rod', 'minecraft:lightning_rod', 'minecraft:chain', 'minecraft:iron_bars', 'minecraft:scaffolding'].includes(floor.typeId)) return false;
    for (const [dx, dz] of [[0.2, 0.2], [0.2, 0.8], [0.8, 0.2], [0.8, 0.8]]) {
      // BDS 1.26.52.3 returned no hit with maxDistance=0.1 even just above a
      // stone floor. Use an integer-length ray and validate the actual hit
      // height instead of depending on sub-block distance handling.
      const hit = dimension.getBlockFromRay(
        { x: location.x + dx, y: location.y + 1.5, z: location.z + dz },
        { x: 0, y: -1, z: 0 },
        { maxDistance: 3, includeLiquidBlocks: true, includePassableBlocks: false }
      );
      // Actual BDS 1.26.52.3 normalizes an exact top boundary to y=0;
      // other versions/adapters report y=1. Both represent the same Up face.
      const hitY = hit?.faceLocation?.y;
      if (!hit || !sameBlock(hit.block.location, floor.location) || hit.face !== 'Up' ||
          !Number.isFinite(hitY) || (Math.abs(hitY) > 0.01 && Math.abs(hitY - 1) > 0.01)) return false;
    }
    return true;
  } catch { return false; }
}

function readAnchor(value) {
  if (typeof value !== "string") return undefined;
  try {
    const anchor = JSON.parse(value);
    return typeof anchor.dimensionId === "string" && [anchor.location?.x, anchor.location?.y, anchor.location?.z].every(Number.isFinite)
      ? anchor : undefined;
  } catch { return undefined; }
}

function property(entity, name, value) {
  try { entity.setProperty(`${NS}${name}`, value); } catch { /* Missing cosmetic property must not consume orders. */ }
}

function currentProperty(entity, name, fallback) {
  try { return entity.getProperty(`${NS}${name}`) ?? fallback; } catch { return fallback; }
}

function playSound(entity, id, volume = 0.5, pitch = 1) {
  try { entity.dimension.playSound(id, entity.location, { volume, pitch }); } catch { /* Cosmetic only. */ }
}

function sparkle(entity, id = "minecraft:basic_smoke_particle") {
  try { entity.dimension.spawnParticle(id, entity.location); } catch { /* Cosmetic only. */ }
}

/** Owns world-facing NPC/vehicle/seat behavior; core remains the only reward owner. */
export function createEntityService(ctx) {
  const gameWorld = ctx.world ?? world;
  const gameSystem = ctx.system ?? system;
  const activeForms = new Set();
  const lastUse = new Map();
  const hornTimes = new Map();
  const retryTimes = new Map();
  const entityInteractions = new Map();
  const chairClaims = new Set();
  let lastTick = -1;
  let readyTick = Infinity;
  let scanTick = -100;
  let seatCleanupTick = -100;
  let entities = [];

  function clock() { return ctx.now?.() ?? Date.now(); }

  function nextIdle(entity, at = clock()) {
    const variant = rollCustomerAnimationVariant(ctx.random?.() ?? Math.random());
    property(entity, "animation_variant", variant);
    entity.setDynamicProperty(`${NS}idle_until`, at + IDLE_MILLISECONDS[variant]);
  }

  function notify(player, text) {
    if (ctx.notify) ctx.notify(player, text);
    else player.sendMessage(`§6[點單吧]§r ${text}`);
  }

  function findEntity(id) {
    if (!id) return undefined;
    try { const entity = gameWorld.getEntity(id); return entity?.isValid ? entity : undefined; } catch { return undefined; }
  }

  function queryAll(type) {
    const found = [];
    for (const id of ["overworld", "nether", "the_end"]) {
      try { found.push(...gameWorld.getDimension(id).getEntities({ type })); } catch { /* No chunk is forced to load. */ }
    }
    return found;
  }

  function customerOrder(entity) {
    return {
      restaurantId: entity.getDynamicProperty(`${NS}restaurant_id`),
      orderId: entity.getDynamicProperty(`${NS}order_id`),
    };
  }

  function loadedCustomers(orderId, restaurantId) {
    return queryAll(CUSTOMER).filter(entity => entity.getDynamicProperty(`${NS}order_id`) === orderId &&
      (!restaurantId || entity.getDynamicProperty(`${NS}restaurant_id`) === restaurantId));
  }

  function chairKey(block) {
    return `${block.dimension.id}:${block.location.x}:${block.location.y}:${block.location.z}`;
  }

  function seatAt(block) {
    return block.dimension.getEntities({ type: SEAT, location: center(block.location, 0.5625), maxDistance: 0.8 })
      .find(entity => {
        const anchor = readAnchor(entity.getDynamicProperty(`${NS}chair_anchor`));
        return anchor?.dimensionId === block.dimension.id && sameBlock(anchor.location, block.location);
      });
  }

  /** Actual loaded chair, also usable by the independent dining-plate service. */
  function getCustomerSeat(entity) {
    if (!entity?.isValid || entity.typeId !== CUSTOMER) return undefined;
    try {
      const seat = entity.getComponent("minecraft:riding")?.entityRidingOn ?? findEntity(entity.getDynamicProperty(`${NS}seat_id`));
      if (!seat || seat.typeId !== SEAT) return undefined;
      if (!seat.getComponent("minecraft:rideable")?.getRiders().some(rider => rider.id === entity.id)) return undefined;
      const anchor = readAnchor(seat.getDynamicProperty(`${NS}chair_anchor`));
      if (!anchor || anchor.dimensionId !== entity.dimension.id) return undefined;
      const block = entity.dimension.getBlock(anchor.location);
      return block?.typeId === CHAIR ? block : undefined;
    } catch { return undefined; }
  }

  function chairOccupied(block, except) {
    const candidates = block.dimension.getEntities({ location: center(block.location, 1), maxDistance: 2 });
    for (const entity of candidates) {
      if (entity.id === except?.id || !entity.isValid) continue;
      if (entity.typeId === SEAT) {
        const anchor = readAnchor(entity.getDynamicProperty(`${NS}chair_anchor`));
        if (anchor?.dimensionId === block.dimension.id && sameBlock(anchor.location, block.location) &&
          entity.getComponent("minecraft:rideable")?.getRiders().some(rider => rider.id !== except?.id)) return true;
      }
      if (![CUSTOMER, "minecraft:player"].includes(entity.typeId)) continue;
      if (Math.abs(entity.location.x - (block.location.x + 0.5)) < 0.65 &&
        Math.abs(entity.location.z - (block.location.z + 0.5)) < 0.65 &&
        entity.location.y >= block.location.y && entity.location.y < block.location.y + 2.8) return true;
    }
    return false;
  }

  function clearSeat(entity) {
    if (!entity?.isValid) return;
    const riders = entity.getComponent("minecraft:rideable")?.getRiders() ?? [];
    if (!riders.length) entity.remove();
  }

  function chairYaw(block) {
    const direction = block.permutation.getState("minecraft:cardinal_direction");
    return ({ north: 180, east: -90, south: 0, west: 90 })[String(direction)] ?? 0;
  }

  function sitOnChair(rider, block) {
    if (!rider?.isValid || block.typeId !== CHAIR || rider.dimension.id !== block.dimension.id) return false;
    if (rider.getComponent("minecraft:riding")?.entityRidingOn) return false;
    // Restore only the actor's nearby chair after unloading. Never snap a
    // standing customer across the dining room to a newly available chair.
    if (rider.typeId === CUSTOMER && (horizontalDist2(rider.location, center(block.location, 0)) > 1.5 ** 2 ||
      Math.abs(rider.location.y - block.location.y) > 3)) return false;
    const above = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
    const head = block.dimension.getBlock({ ...block.location, y: block.location.y + 2 });
    if (!above?.isAir || !head?.isAir) return false;
    if (chairOccupied(block, rider)) return false;
    let seat = seatAt(block);
    if (seat?.getComponent("minecraft:rideable")?.getRiders().length) return false;
    if (!seat) {
      seat = block.dimension.spawnEntity(SEAT, center(block.location, 0.5625));
      try {
        seat.setDynamicProperty(`${NS}chair_anchor`, JSON.stringify({ dimensionId: block.dimension.id, location: block.location }));
        seat.addTag(`${NS}chair_seat`);
        seat.setRotation({ x: 0, y: chairYaw(block) });
      } catch (error) { clearSeat(seat); throw error; }
    }
    const mounted = seat.getComponent("minecraft:rideable")?.addRider(rider) ?? false;
    if (!mounted) { clearSeat(seat); return false; }
    rider.setRotation({ x: 0, y: chairYaw(block) });
    if (rider.typeId === CUSTOMER) {
      rider.setDynamicProperty(`${NS}seat_id`, seat.id);
      rider.setDynamicProperty(`${NS}chair_anchor`, JSON.stringify({ dimensionId: block.dimension.id, location: block.location }));
      if (!rider.getDynamicProperty(`${NS}depart_at`)) property(rider, "stage", "seated");
    }
    return true;
  }

  function findChair(restaurant) {
    const choices = (ctx.stations?.() ?? []).filter(station =>
      station.typeId === CHAIR && station.dimensionId === restaurant.dimensionId &&
      horizontalDist2(station.location, restaurant.location) <= 24 ** 2 &&
      Math.abs(station.location.y - restaurant.location.y) <= 8);
    choices.sort((a, b) => dist2(a.location, restaurant.location) - dist2(b.location, restaurant.location));
    for (const candidate of choices) {
      try {
        const block = gameWorld.getDimension(candidate.dimensionId).getBlock(candidate.location);
        if (block?.typeId !== CHAIR || chairClaims.has(chairKey(block))) continue;
        if (chairOccupied(block)) continue;
        const above = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
        const head = block.dimension.getBlock({ ...block.location, y: block.location.y + 2 });
        if (above?.isAir && head?.isAir) return block;
      } catch { /* A candidate can unload between the lookup and head checks. */ }
    }
    return undefined;
  }

  /** Ground checks read loaded blocks only, never tickingarea/structure commands. */
  function standPosition(dimension, requested, radius = 2) {
    const offsets = [];
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      if (dx * dx + dz * dz <= radius * radius) offsets.push([dx, dz]);
    }
    offsets.sort((a, b) => a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2);
    const clearAt = location => hasFullStandingSupport(dimension, location);
    for (const [dx, dz] of offsets) {
      for (const dy of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        const location = { x: Math.floor(requested.x) + dx, y: Math.floor(requested.y) + dy, z: Math.floor(requested.z) + dz };
        if (clearAt(location)) return center(location, 0);
      }
    }
    // A generated delivery address can use the restaurant's original Y. Find a
    // nearby surface once that column is actually loaded; persist the resolved Y.
    for (const [dx, dz] of offsets.slice(0, radius === 5 ? 24 : 5)) {
      try {
        const range = dimension.heightRange;
        const originY = dimension.id === "minecraft:overworld" ? range.max - 2 : Math.min(range.max - 2, requested.y + 24);
        const hit = dimension.getBlockFromRay(
          { x: Math.floor(requested.x) + dx + 0.5, y: originY, z: Math.floor(requested.z) + dz + 0.5 },
          { x: 0, y: -1, z: 0 },
          { maxDistance: Math.min(384, originY - range.min), includeLiquidBlocks: true, includePassableBlocks: false }
        );
        if (!hit || hit.block.isLiquid) continue;
        const location = { ...hit.block.location, y: hit.block.location.y + 1 };
        if (clearAt(location)) return center(location, 0);
      } catch { /* An unloaded column is retried when a player approaches it. */ }
    }
    return undefined;
  }

  function spawnCustomer(restaurant, order) {
    if (!restaurant || !needsCustomer(order)) return undefined;
    const existing = loadedCustomers(order.id, restaurant.id);
    if (existing.length) {
      const canonical = existing.find(entity => entity.id === order.customerEntityId) ?? existing[0];
      for (const duplicate of existing) if (duplicate.id !== canonical.id) removeCustomer(duplicate);
      if (order.customerEntityId !== canonical.id) {
        const previous = { customerEntityId: order.customerEntityId, customerAnchor: order.customerAnchor };
        order.customerEntityId = canonical.id;
        order.customerAnchor = { dimensionId: canonical.dimension.id, location: { ...canonical.location } };
        try { ctx.saveRestaurant?.(restaurant); }
        catch (error) { Object.assign(order, previous); console.warn(`[OrderToCook] Customer association save deferred: ${String(error)}`); }
      }
      return canonical;
    }
    const destination = order.type === "delivery" ? order.destination : restaurant.location;
    if (!destination) return undefined;
    const dimensionId = destination.dimensionId ?? restaurant.dimensionId;
    let dimension;
    try { dimension = gameWorld.getDimension(dimensionId); } catch { return undefined; }
    const playerNear = gameWorld.getAllPlayers().some(player => player.dimension.id === dimension.id && horizontalDist2(player.location, destination) <= 64 ** 2);
    if (!playerNear) return undefined;
    if (order.customerEntityId && order.customerAnchor?.location) {
      // A persisted actor may be outside the currently loaded entity set. Do
      // not spawn a replacement while its last known chunk is unavailable.
      try {
        const oldDimension = gameWorld.getDimension(order.customerAnchor.dimensionId ?? dimension.id);
        if (!oldDimension.getBlock(order.customerAnchor.location)) return undefined;
      } catch { return undefined; }
    }
    const chair = order.type === "dine_in" ? findChair(restaurant) : undefined;
    // Java walk-ins require a free chair. An accepted machine order instead
    // permits a nearby standing customer when every chair is missing/occupied.
    if (order.type === "dine_in" && order.walkIn && !chair) return undefined;
    const location = chair ? center(chair.location, 1) : standPosition(dimension, destination, order.type === "dine_in" ? 5 : 2);
    if (!location) return undefined;
    const claim = chair ? chairKey(chair) : undefined;
    if (claim) chairClaims.add(claim);
    const previous = { customerEntityId: order.customerEntityId, customerAnchor: order.customerAnchor, destination: order.destination };
    let entity;
    try {
      entity = dimension.spawnEntity(CUSTOMER, location);
      entity.setDynamicProperty(`${NS}restaurant_id`, restaurant.id);
      entity.setDynamicProperty(`${NS}order_id`, order.id);
      entity.addTag(`${NS}order_customer`);
      property(entity, "variant", order.customerVariant === 1 ? 1 : stableVariant(order.id));
      property(entity, "stage", "waiting");
      entity.nameTag = `${order.customerName || (order.type === "delivery" ? "外送顧客" : "堂食顧客")}\n§e${restaurant.name || "餐廳"} · ${String(order.id).slice(-6)}`;
      if (chair && !sitOnChair(entity, chair)) { entity.remove(); return undefined; }
      startSpawnAction(entity, !!chair);
      order.customerEntityId = entity.id;
      order.customerAnchor = { dimensionId: dimension.id, location: { ...location } };
      if (order.type === "delivery") {
        order.destination = { ...order.destination, x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z), dimensionId: dimension.id };
      }
      ctx.saveRestaurant?.(restaurant);
      playSound(entity, `${NS}order_refresh`, 0.25);
      return entity;
    } catch (error) {
      if (entity?.isValid) removeCustomer(entity);
      Object.assign(order, previous);
      console.warn(`[OrderToCook] Customer spawn delayed: ${String(error)}`);
      return undefined;
    } finally { if (claim) chairClaims.delete(claim); }
  }

  function stableVariant(id) {
    let hash = 0;
    for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return Math.abs(hash % 2);
  }

  function removeCustomer(entity) {
    if (!entity?.isValid) return;
    const riding = entity.getComponent("minecraft:riding")?.entityRidingOn;
    const candidate = riding?.typeId === SEAT ? riding : findEntity(entity.getDynamicProperty(`${NS}seat_id`));
    const seat = candidate?.typeId === SEAT ? candidate : undefined;
    if (seat) seat.getComponent("minecraft:rideable")?.ejectRider(entity);
    entity.remove();
    if (seat) clearSeat(seat);
    for (const key of entityInteractions.keys()) if (key.endsWith(`:${entity.id}`)) entityInteractions.delete(key);
  }

  function startSpawnAction(entity, seated) {
    const at = clock();
    const action = seated ? 1 : 2;
    property(entity, "action", action);
    entity.setDynamicProperty(`${NS}action_started_at`, at);
    entity.setDynamicProperty(`${NS}spawn_until`, at + ACTION_TICKS[action] * 50);
    nextIdle(entity, at + ACTION_TICKS[action] * 50);
    gameSystem.runTimeout(() => {
      if (!entity?.isValid || entity.getDynamicProperty(`${NS}depart_at`)) return;
      if (Number(currentProperty(entity, "action", 0)) !== action) return;
      property(entity, "action", 0);
      entity.setDynamicProperty(`${NS}spawn_until`, undefined);
    }, ACTION_TICKS[action]);
  }

  function defaultCompletionAction(entity) {
    const seated = !!getCustomerSeat(entity);
    const association = customerOrder(entity);
    const restaurant = ctx.getRestaurant?.(association.restaurantId);
    const order = restaurant?.orders?.find(entry => entry.id === association.orderId);
    return seated && order?.type === "dine_in" ? 6 : seated ? 3 : 4;
  }

  /**
   * @param {{startedAt?: number, finishAt?: number, action?: number}} options
   */
  function applyCompletion(entity, options, replace = false, resumed = false) {
    const priorFinish = entity.getDynamicProperty(`${NS}depart_at`);
    if (!replace && typeof priorFinish === "number") return false;
    const requested = Number(options.action);
    const action = COMPLETION_ACTIONS.has(requested) ? requested : defaultCompletionAction(entity);
    const at = Number.isFinite(options.startedAt) ? Number(options.startedAt) : clock();
    const finishAt = Number.isFinite(options.finishAt) && Number(options.finishAt) >= at
      ? Number(options.finishAt) : at + ACTION_TICKS[action] * 50;
    const previousAction = Number(currentProperty(entity, "action", 0));
    const unchanged = priorFinish === finishAt && entity.getDynamicProperty(`${NS}action_started_at`) === at && previousAction === action;
    if (clock() >= finishAt) {
      // The boom cue is at tick 118 and the service runs every five ticks.
      // Emit that final crossed cue before removal, but never replay old cues
      // when a world is reopened long after its completion deadline.
      if (unchanged && clock() - finishAt <= 250) completionEffects(entity, clock());
      removeCustomer(entity); return true;
    }
    if (unchanged) return false;
    entity.setDynamicProperty(`${NS}action_started_at`, at);
    entity.setDynamicProperty(`${NS}depart_at`, finishAt);
    entity.setDynamicProperty(`${NS}spawn_until`, undefined);
    entity.setDynamicProperty(`${NS}action_signal`, false);
    entity.setDynamicProperty(`${NS}action_finish_signal`, false);
    entity.setDynamicProperty(`${NS}last_eat_beat`, -1);
    property(entity, "stage", EATING_ACTIONS.has(action) ? "eating" : "leaving");
    property(entity, "action", action);
    // The order core owns every coin and dirty plate. These are visual effects,
    // including the boom: no explosion command, damage, or block destruction.
    if (!resumed) {
      sparkle(entity, "minecraft:villager_happy");
      playSound(entity, "mob.villager.yes", 0.7);
    }
    return true;
  }

  /** Starts one original completion action; repeats cannot extend its lifetime.
   * @param {{startedAt?: number, finishAt?: number, action?: number}} [options]
   */
  function finishCustomer(orderId, options = {}) {
    retryTimes.delete(orderId);
    let changed = 0;
    for (const entity of loadedCustomers(orderId)) {
      if (applyCompletion(entity, options)) changed++;
    }
    return changed;
  }

  /** Reconciles canonical timing after reload; never spawns a completed actor.
   * @param {{startedAt?: number, finishAt?: number, action?: number}} [options]
   */
  function resumeCustomerMeal(restaurant, order, options = order?.meal ?? order?.completion) {
    if (!restaurant || !order || !options) return 0;
    let changed = 0;
    for (const entity of loadedCustomers(order.id, restaurant.id)) {
      if (applyCompletion(entity, options, true, true)) changed++;
    }
    return changed;
  }

  /** Early plate pickup changes only the visual action, never payment state.
   * @param {{startedAt?: number, finishAt?: number, action?: number}} [options]
   */
  function interruptCustomerMeal(orderId, options = {}) {
    let changed = 0;
    for (const entity of loadedCustomers(orderId)) {
      if (![5, 6].includes(Number(currentProperty(entity, "action", 0)))) continue;
      if (applyCompletion(entity, { ...options, action: 7 }, true)) changed++;
    }
    return changed;
  }

  function cleanupOrder(orderId) {
    retryTimes.delete(orderId);
    for (const entity of loadedCustomers(orderId)) removeCustomer(entity);
  }

  function nearbyBike(player) {
    const riding = player.getComponent("minecraft:riding")?.entityRidingOn;
    if (riding?.typeId === MOTORCYCLE) return riding;
    const viewed = player.getEntitiesFromViewDirection({ maxDistance: 12 }).find(hit => hit.entity.typeId === MOTORCYCLE)?.entity;
    if (viewed) return viewed;
    const bikes = player.dimension.getEntities({ type: MOTORCYCLE, location: player.location, maxDistance: 12 });
    bikes.sort((a, b) => dist2(a.location, player.location) - dist2(b.location, player.location));
    return bikes[0];
  }

  function bikeAccessible(player, entity, range = 14) {
    return player.isValid && entity?.isValid && player.dimension.id === entity.dimension.id && dist2(player.location, entity.location) <= range * range;
  }

  function horn(entity) {
    const now = gameSystem.currentTick;
    if ((hornTimes.get(entity.id) ?? -100) + 12 > now) return;
    hornTimes.set(entity.id, now);
    playSound(entity, `${NS}horn`, 1);
  }

  function coloredMotorcycle(entity) {
    const item = new ItemStack(MOTORCYCLE);
    const color = Number(currentProperty(entity, "color", 0));
    item.setDynamicProperty(`${NS}color`, color);
    if (color) item.nameTag = `${COLORS[color] || "白色"}小電驢`;
    return item;
  }

  function recoverMotorcycle(player, entity) {
    if (!bikeAccessible(player, entity)) return;
    if (entity.getComponent("minecraft:rideable")?.getRiders().length) { notify(player, "請先下車再收回小電驢。"); return; }
    const cargo = entity.getComponent("minecraft:inventory")?.container;
    if (cargo && cargo.emptySlotsCount !== cargo.size) { notify(player, "請先取出保溫箱物品，避免收車時遺留貨物。"); return; }
    const item = coloredMotorcycle(entity);
    const inventory = playerInventory(player);
    if (!inventory || containerCapacity(inventory, item) < 1) { notify(player, "請空出一格背包再收車。"); return; }
    const remaining = inventory.addItem(item);
    if (remaining) return;
    entity.remove();
    notify(player, "已收回小電驢，車身顏色已保留。");
  }

  async function openMotorcycle(player, entity) {
    if (activeForms.has(player.id) || !bikeAccessible(player, entity)) return;
    activeForms.add(player.id);
    try {
      const inventory = entity.getComponent("minecraft:inventory")?.container;
      const color = Number(currentProperty(entity, "color", 0));
      const light = !!currentProperty(entity, "light", true);
      const form = new ActionFormData().title("小電驢").body(
        `${COLORS[color] || "白色"}車身 · 車燈${light ? "開啟" : "關閉"}\n保溫箱 ${inventory ? inventory.size - inventory.emptySlotsCount : "?"} / 54 格\n右鍵上車；蹲下右鍵或遙控器開啟此面板。駕駛時按跳躍可鳴笛。`
      ).button("開啟保溫箱").button("鳴笛").button(light ? "關閉車燈" : "開啟車燈").button("收回車輛（先清空保溫箱）").button("關閉");
      const result = await form.show(player);
      if (result.canceled || result.selection === undefined || !bikeAccessible(player, entity)) return;
      if (result.selection === 0) {
        await openContainerForm(ctx, player, () => entity.isValid ? entity.getComponent("minecraft:inventory")?.container : undefined, "小電驢 · 保溫箱 54 格", {
          isAccessible: () => bikeAccessible(player, entity),
        });
      } else if (result.selection === 1) horn(entity);
      else if (result.selection === 2) {
        property(entity, "light", !currentProperty(entity, "light", true));
        notify(player, "已切換車燈。");
      } else if (result.selection === 3) recoverMotorcycle(player, entity);
    } catch (error) { if (player.isValid) notify(player, `車輛操作未完成：${String(error)}`); }
    finally { activeForms.delete(player.id); }
  }

  function consumeItem(player, typeId) {
    const inventory = playerInventory(player);
    const slot = player.selectedSlotIndex;
    const item = inventory?.getItem(slot);
    if (!item || item.typeId !== typeId) return false;
    if (item.amount === 1) inventory.setItem(slot, undefined);
    else { item.amount--; inventory.setItem(slot, item); }
    return true;
  }

  function spawnMotorcycle(player, requested) {
    if (!player.isValid) return undefined;
    const inventory = playerInventory(player);
    const stack = inventory?.getItem(player.selectedSlotIndex);
    if (stack?.typeId !== MOTORCYCLE) return undefined;
    const direction = player.getViewDirection();
    const proposed = requested ?? { x: player.location.x + direction.x * 2.5, y: player.location.y, z: player.location.z + direction.z * 2.5 };
    const location = standPosition(player.dimension, proposed);
    if (!location || dist2(location, player.location) > 36) { notify(player, "前方需要兩格高的空間及可站立地面。"); return undefined; }
    // Do not place into another parked vehicle's collision box.
    if (player.dimension.getEntities({ type: MOTORCYCLE, location, maxDistance: 1.25 }).length) {
      notify(player, "前方已有小電驢，請換一個位置。"); return undefined;
    }
    let entity;
    try {
      const color = stack.getDynamicProperty(`${NS}color`);
      entity = player.dimension.spawnEntity(MOTORCYCLE, location);
      entity.setRotation({ x: 0, y: player.getRotation().y });
      property(entity, "color", Number.isInteger(color) && Number(color) >= 0 && Number(color) <= 3 ? Number(color) : 0);
      property(entity, "light", true);
      entity.setDynamicProperty(`${NS}owner_id`, player.id);
      entity.setDynamicProperty(`${NS}hit_count`, 0);
      if (!consumeItem(player, MOTORCYCLE)) { entity.remove(); return undefined; }
      playSound(entity, `${NS}bag_place`, 0.5);
      notify(player, "小電驢已放置：右鍵上車，蹲下右鍵開保溫箱及車輛面板。");
      return entity;
    } catch (error) {
      if (entity?.isValid) entity.remove();
      notify(player, `放置失敗：${String(error)}`);
      return undefined;
    }
  }

  function onItemUse(player, itemStack) {
    if (itemStack?.typeId !== MOTORCYCLE && itemStack?.typeId !== CONTROLLER) return false;
    const previous = lastUse.get(player.id);
    if (previous && previous.tick === gameSystem.currentTick && previous.typeId === itemStack.typeId) return true;
    lastUse.set(player.id, { tick: gameSystem.currentTick, typeId: itemStack.typeId });
    if (itemStack.typeId === MOTORCYCLE) spawnMotorcycle(player);
    else {
      const bike = nearbyBike(player);
      if (!bike) notify(player, "12 格內沒有小電驢；靠近車輛後再用遙控器。");
      else void openMotorcycle(player, bike);
    }
    return true;
  }

  function onEntityInteract(player, entity) {
    if (!entity?.isValid || !player.isValid) return false;
    if (entity.typeId === CUSTOMER) {
      if (player.dimension.id !== entity.dimension.id || dist2(player.location, entity.location) > 36) return true;
      const association = customerOrder(entity);
      if (typeof association.restaurantId !== "string" || typeof association.orderId !== "string") {
        notify(player, "這位顧客沒有關聯訂單。"); return true;
      }
      const restaurant = ctx.getRestaurant?.(association.restaurantId);
      const order = restaurant?.orders?.find(entry => entry.id === association.orderId);
      const canonical = order?.customerEntityId ? findEntity(order.customerEntityId) : undefined;
      if (canonical && canonical.id !== entity.id) {
        removeCustomer(entity);
        notify(player, "已清理重複顧客，請與同一訂單的原顧客互動。"); return true;
      }
      if (typeof entity.getDynamicProperty(`${NS}depart_at`) === "number" || COMPLETION_ACTIONS.has(Number(currentProperty(entity, "action", 0)))) {
        notify(player, EATING_ACTIONS.has(Number(currentProperty(entity, "action", 0))) ? "顧客正在享用餐點。" : "顧客已收取餐點，正在離開。"); return true;
      }
      const result = ctx.onCustomerInteract?.(player, entity, association);
      if (result?.catch) result.catch(error => { if (player.isValid) notify(player, `交付未完成：${String(error)}`); });
      return true;
    }
    if (entity.typeId !== MOTORCYCLE) return false;
    if (!bikeAccessible(player, entity, 6)) return true;
    if (player.isSneaking) { void openMotorcycle(player, entity); return true; }
    const held = playerInventory(player)?.getItem(player.selectedSlotIndex);
    if (held && DYES[held.typeId] !== undefined) {
      if (consumeItem(player, held.typeId)) {
        property(entity, "color", DYES[held.typeId]);
        notify(player, `已染成${COLORS[DYES[held.typeId]]}。`);
      }
      return true;
    }
    if (player.getComponent("minecraft:riding")?.entityRidingOn) { void openMotorcycle(player, entity); return true; }
    const rideable = entity.getComponent("minecraft:rideable");
    if (rideable?.getRiders().length) { notify(player, "這輛小電驢已有駕駛。"); return true; }
    if (rideable?.addRider(player)) notify(player, "用移動鍵駕駛、跳躍鍵鳴笛、蹲下離座。遙控器可切換車燈。");
    return true;
  }

  function onBlockInteract(player, block) {
    if (block.typeId !== CHAIR) return false;
    if (!sitOnChair(player, block)) notify(player, "這張椅子已被使用，或上方空間不足。");
    return true;
  }

  function onBlockBreak(block, station, permutation) {
    if ((permutation?.type?.id ?? station?.typeId) !== CHAIR) return false;
    const candidates = block.dimension.getEntities({ type: SEAT, location: center(block.location, 0.5625), maxDistance: 0.8 });
    for (const seat of candidates) {
      const anchor = readAnchor(seat.getDynamicProperty(`${NS}chair_anchor`));
      if (!anchor || anchor.dimensionId !== block.dimension.id || !sameBlock(anchor.location, block.location)) continue;
      const rideable = seat.getComponent("minecraft:rideable");
      const riders = rideable?.getRiders() ?? [];
      rideable?.ejectRiders();
      for (const rider of riders) if (rider.typeId === CUSTOMER) releaseCustomerChair(rider);
      seat.remove();
    }
    return true;
  }

  function releaseCustomerChair(entity) {
    entity.setDynamicProperty(`${NS}seat_id`, undefined);
    entity.setDynamicProperty(`${NS}chair_anchor`, undefined);
    if (typeof entity.getDynamicProperty(`${NS}depart_at`) !== "number") {
      property(entity, "stage", "waiting");
      property(entity, "action", 0);
      entity.setDynamicProperty(`${NS}spawn_until`, undefined);
      nextIdle(entity);
    }
  }

  function onMotorcycleHit(event) {
    const entity = event.hitEntity;
    if (!entity?.isValid || entity.typeId !== MOTORCYCLE) return;
    const hits = Number(entity.getDynamicProperty(`${NS}hit_count`) ?? 0) + 1;
    entity.setDynamicProperty(`${NS}hit_count`, hits);
    sparkle(entity);
    if (hits < 5) return;
    const dimension = entity.dimension;
    const location = entity.location;
    const item = coloredMotorcycle(entity);
    const inventory = entity.getComponent("minecraft:inventory")?.container;
    try {
      if (inventory && !dropContainerContents(inventory, dimension, location)) return;
      dimension.spawnItem(item, location);
      entity.getComponent("minecraft:rideable")?.ejectRiders();
      entity.remove();
    } catch (error) { console.warn(`[OrderToCook] Vehicle cargo retained after failed recovery: ${String(error)}`); }
  }

  function cleanSeats() {
    for (const seat of queryAll(SEAT)) {
      const anchor = readAnchor(seat.getDynamicProperty(`${NS}chair_anchor`));
      if (!anchor || anchor.dimensionId !== seat.dimension.id) continue;
      let block;
      try { block = seat.dimension.getBlock(anchor.location); } catch { continue; }
      if (!block) continue;
      if (block.typeId !== CHAIR) {
        const rideable = seat.getComponent("minecraft:rideable");
        const riders = rideable?.getRiders() ?? [];
        rideable?.ejectRiders();
        for (const rider of riders) if (rider.typeId === CUSTOMER) releaseCustomerChair(rider);
        seat.remove();
      } else clearSeat(seat);
    }
  }

  function restoreCustomerChair(entity) {
    if (entity.getComponent("minecraft:riding")?.entityRidingOn) return;
    const anchor = readAnchor(entity.getDynamicProperty(`${NS}chair_anchor`));
    if (!anchor || anchor.dimensionId !== entity.dimension.id) return;
    try {
      const chair = entity.dimension.getBlock(anchor.location);
      if (!chair) return;
      if (chair.typeId !== CHAIR) { releaseCustomerChair(entity); return; }
      sitOnChair(entity, chair);
    } catch { /* Preserve the association until the original chair loads. */ }
  }

  function canonicalMeal(restaurant, order, orderId) {
    const source = order?.meal ?? order?.completion ?? restaurant?.pendingDishes?.find(entry => (entry.orderId ?? entry.id) === orderId);
    if (!source || !Number.isFinite(source.startedAt) || !Number.isFinite(source.finishAt) || !COMPLETION_ACTIONS.has(source.action)) return undefined;
    return source;
  }

  function completionEffects(entity, currentTime) {
    let action = Number(currentProperty(entity, "action", 0));
    const finishAt = Number(entity.getDynamicProperty(`${NS}depart_at`));
    let at = entity.getDynamicProperty(`${NS}action_started_at`);
    if (typeof at !== "number") {
      // alpha.1 persisted only depart_at and used the generic eating clip.
      property(entity, "action", 6);
      action = 6;
      at = finishAt - ACTION_TICKS[6] * 50;
      entity.setDynamicProperty(`${NS}action_started_at`, at);
    }
    const elapsed = currentTime - Number(at);
    if ([5, 6].includes(action) && elapsed >= 2450 && elapsed < 4750) {
      const beat = Math.floor((elapsed - 2450) / 350);
      if (Number(entity.getDynamicProperty(`${NS}last_eat_beat`) ?? -1) < beat) {
        entity.setDynamicProperty(`${NS}last_eat_beat`, beat);
        playSound(entity, "random.eat", 0.7);
      }
    }
    const signalAt = ({ 3: 1750, 4: 2750, 5: 4850, 6: 5250, 7: 250 })[action];
    if (signalAt !== undefined && elapsed >= signalAt && !entity.getDynamicProperty(`${NS}action_signal`)) {
      entity.setDynamicProperty(`${NS}action_signal`, true);
      if (action === 5) playSound(entity, "random.fuse", 0.9);
      else { playSound(entity, "mob.endermen.portal", 0.8); sparkle(entity, "minecraft:mob_portal"); }
    }
    if (action === 5 && elapsed >= 5900 && !entity.getDynamicProperty(`${NS}action_finish_signal`)) {
      entity.setDynamicProperty(`${NS}action_finish_signal`, true);
      playSound(entity, "random.explode", 0.7);
      sparkle(entity, "minecraft:huge_explosion_emitter");
    }
  }

  function deduplicateCustomers() {
    const groups = new Map();
    for (const entity of entities) {
      if (!entity.isValid) continue;
      const association = customerOrder(entity);
      if (typeof association.restaurantId !== "string" || typeof association.orderId !== "string") continue;
      const key = `${association.restaurantId}\n${association.orderId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entity);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const association = customerOrder(group[0]);
      const restaurant = ctx.getRestaurant?.(association.restaurantId);
      const order = restaurant?.orders?.find(entry => entry.id === association.orderId);
      const canonical = group.find(entity => entity.id === order?.customerEntityId) ?? group[0];
      for (const duplicate of group) if (duplicate.id !== canonical.id) removeCustomer(duplicate);
    }
  }

  function tick() {
    const now = gameSystem.currentTick;
    if (now === lastTick || now < readyTick) return;
    lastTick = now;
    const refresh = now - scanTick >= 20;
    if (refresh) {
      entities = queryAll(CUSTOMER);
      deduplicateCustomers();
      scanTick = now;
    }
    const currentTime = clock();
    for (const entity of entities) {
      if (!entity.isValid) continue;
      try {
        const association = customerOrder(entity);
        if (!association.orderId || !association.restaurantId) continue;
        const restaurant = ctx.getRestaurant?.(association.restaurantId);
        const order = restaurant?.orders?.find(entry => entry.id === association.orderId);
        const meal = canonicalMeal(restaurant, order, association.orderId);
        if (meal) {
          applyCompletion(entity, meal, true, true);
          if (!entity.isValid) continue;
        }
        const departure = entity.getDynamicProperty(`${NS}depart_at`);
        if (typeof departure === "number") {
          completionEffects(entity, currentTime);
          if (currentTime >= departure) removeCustomer(entity);
          else restoreCustomerChair(entity);
          continue;
        }
        if (!needsCustomer(order) || currentTime >= order.expiresAt) { removeCustomer(entity); continue; }
        restoreCustomerChair(entity);
        const spawnUntil = entity.getDynamicProperty(`${NS}spawn_until`);
        if (typeof spawnUntil === "number" && currentTime >= spawnUntil) {
          entity.setDynamicProperty(`${NS}spawn_until`, undefined);
          property(entity, "action", 0);
        }
        if (!entity.getDynamicProperty(`${NS}spawn_until`) && currentTime >= Number(entity.getDynamicProperty(`${NS}idle_until`) ?? 0)) nextIdle(entity, currentTime);
      } catch { /* An actor can unload between the dimension query and this tick. */ }
    }
    if (refresh) {
      const candidates = [];
      for (const restaurant of ctx.restaurants?.() ?? []) {
        for (const order of restaurant.orders ?? []) {
          if (!needsCustomer(order) || currentTime >= order.expiresAt) continue;
          if ((retryTimes.get(order.id) ?? -100) + 40 > now) continue;
          if (entities.some(entity => entity.isValid && entity.getDynamicProperty(`${NS}order_id`) === order.id)) continue;
          candidates.push({ restaurant, order });
        }
      }
      // Four attempts per scan bound worst-case floor/chunk checks; oldest
      // attempts go first so several blocked restaurants cannot starve others.
      candidates.sort((a, b) => (retryTimes.get(a.order.id) ?? -100) - (retryTimes.get(b.order.id) ?? -100));
      for (const { restaurant, order } of candidates.slice(0, 4)) {
        retryTimes.set(order.id, now);
        spawnCustomer(restaurant, order);
      }
    }
    if (now - seatCleanupTick >= 100) { seatCleanupTick = now; cleanSeats(); }
  }

  function init() {
    gameWorld.beforeEvents.playerInteractWithEntity.subscribe(event => {
      if (![CUSTOMER, MOTORCYCLE, SEAT].includes(event.target.typeId)) return;
      event.cancel = true;
      const { player, target } = event;
      const key = `${player.id}:${target.id}`;
      const previous = entityInteractions.get(key) ?? -100;
      entityInteractions.set(key, gameSystem.currentTick);
      if (gameSystem.currentTick - previous < 6) return;
      gameSystem.run(() => { if (player.isValid && target.isValid) onEntityInteract(player, target); });
    });
    gameWorld.afterEvents.entityHitEntity.subscribe(onMotorcycleHit);
    gameWorld.afterEvents.playerButtonInput.subscribe(event => {
      if (event.button !== InputButton.Jump || event.newButtonState !== ButtonState.Pressed) return;
      const bike = event.player.getComponent("minecraft:riding")?.entityRidingOn;
      if (bike?.typeId === MOTORCYCLE) horn(bike);
    });
    gameWorld.afterEvents.playerLeave.subscribe(event => {
      activeForms.delete(event.playerId);
      lastUse.delete(event.playerId);
      for (const key of entityInteractions.keys()) if (key.startsWith(`${event.playerId}:`)) entityInteractions.delete(key);
    });
    gameSystem.run(() => {
      readyTick = gameSystem.currentTick + 40;
      gameSystem.runInterval(tick, 5);
    });
  }

  return {
    init, tick, spawnCustomer, finishCustomer, resumeCustomerMeal, interruptCustomerMeal, cleanupOrder, getCustomerSeat, spawnMotorcycle, openMotorcycle,
    onItemUse, onEntityInteract, onBlockInteract, onBlockBreak, sitOnChair,
  };
}
