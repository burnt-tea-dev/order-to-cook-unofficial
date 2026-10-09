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
function needsCustomer(order) { return !!order && (LIVE_ORDER.has(order.status) || (order.status === "offered" && !!order.walkIn)); }

function dist2(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
function horizontalDist2(a, b) { return (a.x - b.x) ** 2 + (a.z - b.z) ** 2; }
function center(location, height = 0.5) { return { x: Math.floor(location.x) + 0.5, y: Math.floor(location.y) + height, z: Math.floor(location.z) + 0.5 }; }
function sameBlock(a, b) { return a.x === b.x && a.y === b.y && a.z === b.z; }

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
  let lastTick = -1;
  let readyTick = Infinity;
  let scanTick = -100;
  let seatCleanupTick = -100;
  let entities = [];

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

  function loadedCustomers(orderId) {
    return queryAll(CUSTOMER).filter(entity => entity.getDynamicProperty(`${NS}order_id`) === orderId);
  }

  function seatAt(block) {
    return block.dimension.getEntities({ type: SEAT, location: center(block.location, 0.5625), maxDistance: 0.8 })
      .find(entity => {
        const value = entity.getDynamicProperty(`${NS}chair_anchor`);
        if (typeof value !== "string") return false;
        try { return sameBlock(JSON.parse(value).location, block.location); } catch { return false; }
      });
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
    if (rider.getComponent("minecraft:riding")?.entityRidingOn) return false;
    const above = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
    const head = block.dimension.getBlock({ ...block.location, y: block.location.y + 2 });
    if (!above?.isAir || !head?.isAir) return false;
    let seat = seatAt(block);
    if (seat?.getComponent("minecraft:rideable")?.getRiders().length) return false;
    if (!seat) {
      seat = block.dimension.spawnEntity(SEAT, center(block.location, 0.5625));
      seat.setDynamicProperty(`${NS}chair_anchor`, JSON.stringify({ dimensionId: block.dimension.id, location: block.location }));
      seat.addTag(`${NS}chair_seat`);
      seat.setRotation({ x: 0, y: chairYaw(block) });
    }
    const mounted = seat.getComponent("minecraft:rideable")?.addRider(rider) ?? false;
    if (!mounted) { clearSeat(seat); return false; }
    rider.setRotation({ x: 0, y: chairYaw(block) });
    if (rider.typeId === CUSTOMER) {
      rider.setDynamicProperty(`${NS}seat_id`, seat.id);
      property(rider, "stage", "seated");
    }
    return true;
  }

  function findChair(restaurant) {
    const choices = (ctx.stations?.() ?? []).filter(station =>
      station.typeId === CHAIR && station.dimensionId === restaurant.dimensionId &&
      Math.abs(station.location.x - restaurant.location.x) <= 24 &&
      Math.abs(station.location.z - restaurant.location.z) <= 24 &&
      Math.abs(station.location.y - restaurant.location.y) <= 8);
    choices.sort((a, b) => dist2(a.location, restaurant.location) - dist2(b.location, restaurant.location));
    for (const candidate of choices) {
      let block;
      try { block = gameWorld.getDimension(candidate.dimensionId).getBlock(candidate.location); } catch { continue; }
      if (block?.typeId !== CHAIR) continue;
      if (seatAt(block)?.getComponent("minecraft:rideable")?.getRiders().length) continue;
      const above = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
      const head = block.dimension.getBlock({ ...block.location, y: block.location.y + 2 });
      if (above?.isAir && head?.isAir) return block;
    }
    return undefined;
  }

  /** Ground checks read loaded blocks only, never tickingarea/structure commands. */
  function standPosition(dimension, requested) {
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]];
    const clearAt = location => {
      try {
        const feet = dimension.getBlock(location);
        const head = dimension.getBlock({ ...location, y: location.y + 1 });
        const floor = dimension.getBlock({ ...location, y: location.y - 1 });
        return feet?.isAir && head?.isAir && floor && !floor.isAir && !floor.isLiquid;
      } catch { return false; }
    };
    for (const [dx, dz] of offsets) {
      for (const dy of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        const location = { x: Math.floor(requested.x) + dx, y: Math.floor(requested.y) + dy, z: Math.floor(requested.z) + dz };
        if (clearAt(location)) return center(location, 0);
      }
    }
    // A generated delivery address can use the restaurant's original Y. Find a
    // nearby surface once that column is actually loaded; persist the resolved Y.
    for (const [dx, dz] of offsets.slice(0, 5)) {
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
    const existing = loadedCustomers(order.id);
    if (existing.length) {
      // An interrupted reload may have left redundant visual actors; one order
      // remains one service target. The core validates every submission again.
      for (const duplicate of existing.slice(1)) removeCustomer(duplicate);
      return existing[0];
    }
    const destination = order.type === "delivery" ? order.destination : restaurant.location;
    if (!destination) return undefined;
    const dimensionId = destination.dimensionId ?? restaurant.dimensionId;
    let dimension;
    try { dimension = gameWorld.getDimension(dimensionId); } catch { return undefined; }
    const playerNear = gameWorld.getAllPlayers().some(player => player.dimension.id === dimension.id && horizontalDist2(player.location, destination) <= 64 ** 2);
    if (!playerNear) return undefined;
    const chair = order.type === "dine_in" ? findChair(restaurant) : undefined;
    if (order.type === "dine_in" && !chair) return undefined;
    const location = chair ? center(chair.location, 1) : standPosition(dimension, destination);
    if (!location) return undefined;
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
      property(entity, "action", chair ? 1 : 2);
      gameSystem.runTimeout(() => { if (entity?.isValid && !entity.getDynamicProperty(`${NS}depart_at`)) property(entity, "action", 0); }, 12);
      order.customerEntityId = entity.id;
      if (order.type === "delivery") {
        order.destination = { ...order.destination, x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z), dimensionId: dimension.id };
      }
      ctx.saveRestaurant?.(restaurant);
      playSound(entity, `${NS}order_refresh`, 0.25);
      return entity;
    } catch (error) {
      if (entity?.isValid) removeCustomer(entity);
      console.warn(`[OrderToCook] Customer spawn delayed: ${String(error)}`);
      return undefined;
    }
  }

  function stableVariant(id) {
    let hash = 0;
    for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return Math.abs(hash % 2);
  }

  function removeCustomer(entity) {
    if (!entity?.isValid) return;
    const seat = findEntity(entity.getDynamicProperty(`${NS}seat_id`));
    if (seat) seat.getComponent("minecraft:rideable")?.ejectRider(entity);
    entity.remove();
    if (seat) clearSeat(seat);
  }

  function finishCustomer(orderId) {
    retryTimes.delete(orderId);
    for (const entity of loadedCustomers(orderId)) {
      if (entity.getDynamicProperty(`${NS}depart_at`)) continue;
      const seated = !!entity.getComponent("minecraft:riding")?.entityRidingOn;
      property(entity, "stage", "eating");
      property(entity, "action", seated ? 3 : 4);
      // Only the core pays or creates dirty dishes. This is a visual lifecycle.
      // The imported npc_eat&scale animation is 5.5 seconds long.
      entity.setDynamicProperty(`${NS}depart_at`, Date.now() + 5500);
      playSound(entity, "random.eat", 0.5);
    }
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
      const association = customerOrder(entity);
      if (typeof association.restaurantId !== "string" || typeof association.orderId !== "string") {
        notify(player, "這位顧客沒有關聯訂單。"); return true;
      }
      if (currentProperty(entity, "stage", "waiting") === "eating") { notify(player, "顧客正在享用餐點。"); return true; }
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
      const anchor = seat.getDynamicProperty(`${NS}chair_anchor`);
      if (typeof anchor !== "string") continue;
      try { if (!sameBlock(JSON.parse(anchor).location, block.location)) continue; } catch { continue; }
      const rideable = seat.getComponent("minecraft:rideable");
      const riders = rideable?.getRiders() ?? [];
      rideable?.ejectRiders();
      for (const rider of riders) if (rider.typeId === CUSTOMER) {
        rider.setDynamicProperty(`${NS}seat_id`, undefined);
        property(rider, "stage", "waiting");
        property(rider, "action", 0);
      }
      seat.remove();
    }
    return true;
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
      const value = seat.getDynamicProperty(`${NS}chair_anchor`);
      if (typeof value !== "string") continue;
      let anchor;
      try { anchor = JSON.parse(value); } catch { continue; }
      let block;
      try { block = seat.dimension.getBlock(anchor.location); } catch { continue; }
      if (!block) continue;
      if (block.typeId !== CHAIR) {
        const rideable = seat.getComponent("minecraft:rideable");
        const riders = rideable?.getRiders() ?? [];
        rideable?.ejectRiders();
        for (const rider of riders) if (rider.typeId === CUSTOMER) {
          property(rider, "stage", "waiting");
          rider.setDynamicProperty(`${NS}seat_id`, undefined);
        }
        seat.remove();
      } else clearSeat(seat);
    }
  }

  function tick() {
    const now = gameSystem.currentTick;
    if (now === lastTick || now < readyTick) return;
    lastTick = now;
    const refresh = now - scanTick >= 20;
    if (refresh) { entities = queryAll(CUSTOMER); scanTick = now; }
    const currentTime = Date.now();
    for (const entity of entities) {
      if (!entity.isValid) continue;
      try {
        const association = customerOrder(entity);
        if (!association.orderId || !association.restaurantId) continue;
        const departure = entity.getDynamicProperty(`${NS}depart_at`);
        if (typeof departure === "number") {
          if (currentTime >= departure + 500) removeCustomer(entity);
          else if (currentTime >= departure) {
            property(entity, "stage", "leaving");
            property(entity, "action", 0);
            sparkle(entity);
          }
          continue;
        }
        const restaurant = ctx.getRestaurant?.(association.restaurantId);
        const order = restaurant?.orders?.find(entry => entry.id === association.orderId);
        if (!needsCustomer(order) || currentTime >= order.expiresAt) { removeCustomer(entity); continue; }
        const riding = entity.getComponent("minecraft:riding")?.entityRidingOn;
        if (order.type === "dine_in" && !riding) {
          const chair = findChair(restaurant);
          if (chair) sitOnChair(entity, chair);
        }
      } catch { /* An actor can unload between the dimension query and this tick. */ }
    }
    if (refresh) {
      for (const restaurant of ctx.restaurants?.() ?? []) {
        for (const order of restaurant.orders ?? []) {
          if (!needsCustomer(order) || currentTime >= order.expiresAt) continue;
          if ((retryTimes.get(order.id) ?? -100) + 40 > now) continue;
          if (entities.some(entity => entity.isValid && entity.getDynamicProperty(`${NS}order_id`) === order.id)) continue;
          retryTimes.set(order.id, now);
          spawnCustomer(restaurant, order);
        }
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
    init, tick, spawnCustomer, finishCustomer, cleanupOrder, spawnMotorcycle, openMotorcycle,
    onItemUse, onEntityInteract, onBlockInteract, onBlockBreak, sitOnChair,
  };
}
