// SPDX-License-Identifier: GPL-3.0-only
// Bedrock adaptation of Order To Cook by breezeth-CN; see THIRD_PARTY_NOTICES.md.
import { BlockPermutation, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { advanceDoorMotion, dishwasherFrame, APPLIANCE_TICK_INTERVAL, FRIDGE_MOTION_TICKS, FRIDGE_LAST_FRAME } from "./appliance_motion.js";
import { formatEquipmentInspection, INSPECTION_TYPES } from "./equipment_inspection.js";

const NS = "ordertocook:";
const FRIDGE = `${NS}refrigerator`;
const STOVE = `${NS}stove`;
const SINK = `${NS}washingtable`;
const DISHWASHER = `${NS}dishwasher`;
const STORAGE = `${NS}storage`;
const DIRTY = `${NS}dirty_plate`;
const CLEAN = `${NS}clean_plate`;
const KINDS = new Set([FRIDGE, STOVE, SINK, DISHWASHER]);
const storageForms = new Set();

/** Explicit baseline: Script API 2.0.0 cannot query the smoking recipe registry. */
export const SMOKING_RECIPES = Object.freeze({
  "minecraft:beef": "minecraft:cooked_beef",
  "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton",
  "minecraft:rabbit": "minecraft:cooked_rabbit",
  "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon",
  "minecraft:potato": "minecraft:baked_potato",
  "minecraft:kelp": "minecraft:dried_kelp",
});

/** Burn times in game ticks. Only known, explicitly supported fuels are accepted. */
export const FUEL_TICKS = Object.freeze({
  "minecraft:coal": 1600,
  "minecraft:charcoal": 1600,
  "minecraft:coal_block": 16000,
  "minecraft:dried_kelp_block": 4000,
  "minecraft:blaze_rod": 2400,
  "minecraft:stick": 100,
  "minecraft:bamboo": 50,
  "minecraft:lava_bucket": 20000,
  "minecraft:oak_planks": 300,
  "minecraft:spruce_planks": 300,
  "minecraft:birch_planks": 300,
  "minecraft:jungle_planks": 300,
  "minecraft:acacia_planks": 300,
  "minecraft:dark_oak_planks": 300,
  "minecraft:mangrove_planks": 300,
  "minecraft:cherry_planks": 300,
  "minecraft:bamboo_planks": 300,
  "minecraft:oak_log": 300,
  "minecraft:spruce_log": 300,
  "minecraft:birch_log": 300,
  "minecraft:jungle_log": 300,
  "minecraft:acacia_log": 300,
  "minecraft:dark_oak_log": 300,
  "minecraft:mangrove_log": 300,
  "minecraft:cherry_log": 300,
});

const KNOWN_FOOD = new Set([
  ...Object.keys(SMOKING_RECIPES), ...Object.values(SMOKING_RECIPES),
  "minecraft:apple", "minecraft:golden_apple", "minecraft:enchanted_golden_apple",
  "minecraft:bread", "minecraft:carrot", "minecraft:golden_carrot", "minecraft:beetroot",
  "minecraft:melon_slice", "minecraft:sweet_berries", "minecraft:glow_berries",
  "minecraft:cookie", "minecraft:pumpkin_pie", "minecraft:mushroom_stew",
  "minecraft:rabbit_stew", "minecraft:beetroot_soup", "minecraft:suspicious_stew",
  "minecraft:honey_bottle", "minecraft:chorus_fruit", "minecraft:rotten_flesh",
  "minecraft:spider_eye", "minecraft:poisonous_potato", "minecraft:tropical_fish", "minecraft:pufferfish",
]);

export function itemLabel(stack) {
  return stack?.nameTag || stack?.typeId?.replace(/^minecraft:/, "").replace(/^ordertocook:/, "").replace(/_/g, " ") || "空";
}

export function playerInventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

/** Readable identity for one unstackable item selected before an async form. */
export function itemFingerprint(stack) {
  if (!stack) return "";
  const properties = stack.getDynamicPropertyIds().sort().map(id => [id, stack.getDynamicProperty(id)]);
  const enchantments = stack.getComponent("minecraft:enchantable")?.getEnchantments()
    .map(entry => [entry.type.id, entry.level]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) ?? [];
  return JSON.stringify({
    type: stack.typeId, amount: stack.amount, name: stack.nameTag ?? "", lore: stack.getLore(), properties,
    damage: stack.getComponent("minecraft:durability")?.damage ?? 0, enchantments,
    keepOnDeath: stack.keepOnDeath, lockMode: stack.lockMode,
    canDestroy: stack.getCanDestroy().sort(), canPlaceOn: stack.getCanPlaceOn().sort(),
  });
}

function slotsOf(container, requested) {
  return requested ?? Array.from({ length: container.size }, (_, i) => i);
}

export function containerCapacity(container, stack, requested) {
  let capacity = 0;
  for (const i of slotsOf(container, requested)) {
    const stored = container.getItem(i);
    if (!stored) capacity += stack.maxAmount;
    else if (stored.isStackableWith(stack)) capacity += Math.max(0, stored.maxAmount - stored.amount);
  }
  return capacity;
}

/**
 * Transfer one complete stack between bounded inventory ranges without serializing it.
 * Every read/validation precedes the synchronous commit; snapshots retain custom data.
 * A failed write rolls the touched slots back instead of reconstructing plain items.
 */
export function transferStackToRange(source, fromSlot, target, requested, expected) {
  const stack = source.getItem(fromSlot);
  if (!stack) return { ok: false, message: "物品已被移動，請重新選擇。" };
  if (expected && (stack.amount !== expected.amount || stack.typeId !== expected.typeId ||
      !(stack.isStackableWith(expected) || itemFingerprint(stack) === itemFingerprint(expected)))) {
    return { ok: false, message: "所選格子的物品已改變，請重新選擇。" };
  }
  if (source === target) return { ok: false, message: "來源與目的地相同。" };
  const targetSlots = slotsOf(target, requested);
  if (containerCapacity(target, stack, targetSlots) < stack.amount) {
    return { ok: false, message: "空間不足；整疊物品仍留在原處。" };
  }
  const writes = [];
  let remaining = stack.amount;
  // Fill compatible stacks before empty slots, preserving all item components.
  for (const emptyPass of [false, true]) {
    for (const i of targetSlots) {
      if (remaining <= 0) break;
      const old = target.getItem(i);
      if (emptyPass ? !!old : !old || !old.isStackableWith(stack)) continue;
      const amount = Math.min(remaining, old ? old.maxAmount - old.amount : stack.maxAmount);
      if (amount <= 0) continue;
      const next = old ? old.clone() : stack.clone();
      next.amount = (old?.amount ?? 0) + amount;
      writes.push({ i, old, next });
      remaining -= amount;
    }
  }
  try {
    source.setItem(fromSlot, undefined);
    for (const write of writes) target.setItem(write.i, write.next);
  } catch (error) {
    for (const write of writes) target.setItem(write.i, write.old);
    source.setItem(fromSlot, stack);
    throw error;
  }
  return { ok: true, message: `已移動 ${itemLabel(stack)} × ${stack.amount}` };
}

/** Used for actual drops only; a failed spawn leaves that slot intact for recovery. */
export function dropContainerContents(container, dimension, location, requested) {
  for (const i of slotsOf(container, requested)) {
    const stack = container.getItem(i);
    if (!stack) continue;
    dimension.spawnItem(stack, location);
    container.setItem(i, undefined);
  }
  return slotsOf(container, requested).every(i => !container.getItem(i));
}

function sameLocation(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;
}

function squaredDistance(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

function say(ctx, player, message) {
  if (ctx.notify) ctx.notify(player, message);
  else player.sendMessage(`§6[點單吧]§r ${message}`);
}

function safeSound(dimension, id, location, volume = 0.6, pitch = 1) {
  try { dimension.playSound(id, location, { volume, pitch }); } catch { /* Cosmetic only. */ }
}

function safeParticle(dimension, id, location) {
  try { dimension.spawnParticle(id, location); } catch { /* Cosmetic only. */ }
}

function center(location, y = 0.5) {
  return { x: location.x + 0.5, y: location.y + y, z: location.z + 0.5 };
}

/**
 * Native Bedrock form adapter for a real entity inventory. Range restrictions are
 * enforced on every action, including responses to a form left open by the player.
 */
export async function openContainerForm(ctx, player, resolveContainer, title, options = {}) {
  if (storageForms.has(player.id)) return;
  storageForms.add(player.id);
  const allowed = options.isAccessible ?? (() => player.isValid);
  try {
    for (;;) {
      if (!player.isValid || !allowed()) return;
      const target = resolveContainer();
      if (!target?.isValid) { say(ctx, player, "儲物實體尚未載入；物品資料保留，請稍後重試。"); return; }
      const range = slotsOf(target, options.slots);
      const occupied = range.filter(i => target.getItem(i)).length;
      const buttons = [];
      const form = new ActionFormData().title(title).body(
        `${occupied} / ${range.length} 格已使用\n選擇整疊存入或取出。物品名稱、附加資料與耐久會保留。`
      );
      if (options.allowDeposit !== false) { form.button("存入物品"); buttons.push("put"); }
      form.button("取出物品"); buttons.push("take");
      form.button("關閉"); buttons.push("close");
      const response = await form.show(player);
      if (response.canceled || response.selection === undefined || buttons[response.selection] === "close") return;
      const mode = buttons[response.selection];
      let page = 0;
      for (;;) {
        if (!player.isValid || !allowed()) return;
        const liveTarget = resolveContainer();
        const inventory = playerInventory(player);
        if (!liveTarget?.isValid || !inventory?.isValid) return;
        const source = mode === "put" ? inventory : liveTarget;
        const sourceRange = mode === "put" ? slotsOf(inventory) : range;
        const entries = sourceRange.map(slot => ({ slot, stack: source.getItem(slot) }))
          .filter(entry => entry.stack && (mode !== "put" || !options.accept || options.accept(entry.stack)));
        if (!entries.length) { say(ctx, player, mode === "put" ? "背包沒有可以存入的物品。" : "這個分區是空的。"); break; }
        const pages = Math.max(1, Math.ceil(entries.length / 14));
        page = Math.min(page, pages - 1);
        const visible = entries.slice(page * 14, page * 14 + 14);
        const select = new ActionFormData().title(`${mode === "put" ? "存入" : "取出"} · ${title}`)
          .body(`第 ${page + 1} / ${pages} 頁`);
        for (const entry of visible) select.button(`${itemLabel(entry.stack)} × ${entry.stack.amount}\n格 ${entry.slot + 1}`);
        const previous = visible.length;
        const next = visible.length + 1;
        select.button("上一頁").button("下一頁").button("返回");
        const picked = await select.show(player);
        if (picked.canceled || picked.selection === undefined || picked.selection === visible.length + 2) break;
        if (picked.selection === previous) { page = Math.max(0, page - 1); continue; }
        if (picked.selection === next) { page = Math.min(pages - 1, page + 1); continue; }
        const entry = visible[picked.selection];
        if (!entry || !allowed() || !player.isValid) return;
        const refreshed = resolveContainer();
        const refreshedPlayer = playerInventory(player);
        if (!refreshed?.isValid || !refreshedPlayer?.isValid) return;
        const result = mode === "put"
          ? transferStackToRange(refreshedPlayer, entry.slot, refreshed, range, entry.stack)
          : transferStackToRange(refreshed, entry.slot, refreshedPlayer, undefined, entry.stack);
        say(ctx, player, result.message);
        if (result.ok) options.onChange?.();
        break;
      }
    }
  } catch (error) {
    if (player.isValid) say(ctx, player, `操作未完成：${String(error)}`);
  } finally {
    storageForms.delete(player.id);
  }
}

/** Map the upper half of a refrigerator to its single persistent lower station. */
export function normalizeApplianceBlock(block) {
  if (block.typeId === FRIDGE && block.permutation.getState(`${NS}half`) === "upper") {
    const below = block.dimension.getBlock({ ...block.location, y: block.location.y - 1 });
    if (below?.typeId === FRIDGE) return below;
  }
  return block;
}

export function createApplianceService(ctx) {
  const gameWorld = ctx.world ?? world;
  const gameSystem = ctx.system ?? system;
  const clocks = new Map();
  const washing = new Map();
  const washingFeedback = new Map();
  const viewers = new Map();
  const doorPositions = new Map();
  let lastTick = -1;
  let lastRecoveryTick = -100;
  const recipes = { ...SMOKING_RECIPES, ...(ctx.smokingRecipes ?? {}) };
  const fuelTicks = { ...FUEL_TICKS, ...(ctx.fuelTicks ?? {}) };

  function isFood(stack) {
    if (ctx.food?.isFood) return !!ctx.food.isFood(stack);
    return KNOWN_FOOD.has(stack.typeId) || !!stack.getComponent("minecraft:food");
  }

  function blockFor(station) {
    try { return gameWorld.getDimension(station.dimensionId).getBlock(station.location); } catch { return undefined; }
  }

  function loadedStation(station) {
    const block = blockFor(station);
    return block && block.typeId === station.typeId ? block : undefined;
  }

  function data(station) {
    if (station.appliance === undefined) {
      station.appliance = { phase: 0, remainingTicks: 0, plates: 0, litTime: 0, litDuration: 0, cookProgress: 0 };
      ctx.saveStation(station);
    }
    if (!station.appliance || typeof station.appliance !== "object" || Array.isArray(station.appliance)) {
      throw new Error("設備存檔格式異常，已保留原資料。");
    }
    for (const key of ["phase", "remainingTicks", "plates", "litTime", "litDuration", "cookProgress"]) {
      if (!Number.isFinite(station.appliance[key]) || station.appliance[key] < 0) {
        throw new Error(`設備存檔 ${key} 無效，已保留原資料。`);
      }
    }
    if (!Number.isInteger(station.appliance.phase) || station.appliance.phase > 5 ||
        !Number.isInteger(station.appliance.plates) || station.appliance.plates > 16) {
      throw new Error("設備存檔數值超出範圍，已保留原資料。");
    }
    return station.appliance;
  }

  function findEntity(id) {
    if (!id) return undefined;
    try { const entity = gameWorld.getEntity(id); return entity?.isValid ? entity : undefined; } catch { return undefined; }
  }

  function ensureStorage(station, create = true) {
    let entity = findEntity(station.storageId);
    const block = loadedStation(station);
    if (!block) return undefined;
    if (!entity) {
      const candidates = block.dimension.getEntities({ type: STORAGE, location: center(station.location), maxDistance: 1.5 });
      entity = candidates.find(candidate => candidate.getDynamicProperty(`${NS}station_id`) === station.id);
      if (entity) { station.storageId = entity.id; ctx.saveStation(station); }
    }
    // A missing saved entity may be in the middle of a chunk load. Never replace
    // saved cargo with an empty inventory just because getEntity returned undefined.
    if (!entity && create && !station.storageId) {
      entity = block.dimension.spawnEntity(STORAGE, center(station.location, 0.1));
      entity.setDynamicProperty(`${NS}station_id`, station.id);
      entity.setDynamicProperty(`${NS}storage_anchor`, JSON.stringify({
        stationId: station.id, dimensionId: station.dimensionId, location: station.location, typeId: station.typeId,
      }));
      entity.addTag(`${NS}appliance_storage`);
      station.storageId = entity.id;
      ctx.saveStation(station);
    }
    return entity;
  }

  function getStorage(station) {
    return ensureStorage(station)?.getComponent("minecraft:inventory")?.container;
  }

  function setState(block, state, value) {
    try {
      if (block.permutation.getState(state) !== value) block.setPermutation(block.permutation.withState(state, value));
    } catch { /* Resources missing: gameplay state remains in the persistent station. */ }
  }

  function updateVisual(station) {
    const block = loadedStation(station);
    if (!block) return;
    const d = data(station);
    if (station.typeId === SINK) setState(block, `${NS}plates`, d.plates);
    if (station.typeId === DISHWASHER) {
      setState(block, `${NS}phase`, d.phase);
      setState(block, `${NS}frame`, dishwasherFrame(d));
      setState(block, `${NS}plates`, d.plates % 16);
      setState(block, `${NS}plates_high`, d.plates === 16);
    }
    if (station.typeId === STOVE) setState(block, `${NS}lit`, d.litTime > 0);
  }

  function accessible(player, station) {
    return player.isValid && player.dimension.id === station.dimensionId &&
      squaredDistance(player.location, center(station.location)) <= 36 && !!loadedStation(station) &&
      (!ctx.canUseStation || !!ctx.canUseStation(player, station));
  }

  /**
   * Resolve an existing station and its existing helper only. Merely looking at
   * equipment must not call getStation/data/ensureStorage or write saved state.
   */
  function getInspection(player, block) {
    try {
      if (!block?.isValid || !INSPECTION_TYPES.includes(block.typeId)) return undefined;
      const upper = block.typeId === FRIDGE && block.permutation.getState(`${NS}half`) === "upper";
      const normalized = normalizeApplianceBlock(block);
      const station = (ctx.stations?.() ?? []).find(entry =>
        entry.dimensionId === normalized.dimension.id && entry.typeId === normalized.typeId &&
        sameLocation(entry.location, normalized.location));
      if (!station || !accessible(player, station)) return undefined;
      const snapshot = { typeId: station.typeId, supplies: station.supplies, upper,
        appliance: station.appliance ? { ...station.appliance } : undefined,
        occupied: undefined, storageLoaded: false };
      if (station.typeId === FRIDGE || station.typeId === STOVE) {
        const helper = findEntity(station.storageId);
        const inventory = helper?.typeId === STORAGE && helper.getDynamicProperty(`${NS}station_id`) === station.id
          ? helper.getComponent("minecraft:inventory")?.container : undefined;
        snapshot.storageLoaded = !!inventory?.isValid && inventory.size >= (station.typeId === FRIDGE ? 81 : 7);
        if (snapshot.storageLoaded && station.typeId === FRIDGE) {
          const first = upper ? 0 : 27, length = upper ? 27 : 54;
          let occupied = 0;
          for (let slot = first; slot < first + length; slot++) if (inventory.getItem(slot)) occupied++;
          snapshot.occupied = occupied;
        }
      }
      return formatEquipmentInspection(snapshot);
    } catch {
      // A ray target, helper or permission can disappear between reads.
      return undefined;
    }
  }

  /** The main HUD is the only action-bar writer; this method has no side effects. */
  function getWashingProgress(player) {
    if (!player?.isValid) return undefined;
    const session = washing.get(player.id);
    if (session) {
      try {
        const hit = player.getBlockFromViewDirection({ maxDistance: 4, includeLiquidBlocks: false });
        if (!accessible(player, session.station) || !handEmpty(player) ||
            !hit || !sameLocation(hit.block.location, session.station.location) ||
            !(session.station.appliance?.plates > 0)) return undefined;
        const elapsed = Math.max(0, gameSystem.currentTick - session.start);
        return `§b洗碗中 ${Math.min(100, Math.floor(elapsed / 80 * 100))}%`;
      } catch { return undefined; }
    }
    const feedback = washingFeedback.get(player.id);
    return feedback && gameSystem.currentTick < feedback.until ? feedback.text : undefined;
  }

  function stopWashing(id, feedback = true) {
    washing.delete(id);
    if (feedback) washingFeedback.set(id, { until: gameSystem.currentTick + 20, text: "§7洗碗已中止" });
  }

  function fridgeBlock(station, half) {
    const lower = loadedStation(station);
    if (!lower || half === "lower") return lower;
    try {
      const upper = lower.dimension.getBlock({ ...lower.location, y: lower.location.y + 1 });
      return upper?.typeId === FRIDGE && upper.permutation.getState(`${NS}half`) === "upper" ? upper : undefined;
    } catch { return undefined; }
  }

  function fridgeDoors(station, half, open) {
    const block = fridgeBlock(station, half);
    if (!block) return;
    const changed = block.permutation.getState(`${NS}open`) !== open;
    setState(block, `${NS}open`, open);
    if (changed) safeSound(block.dimension, `${NS}${open ? "dishwasher_out" : "dishwasher_in"}`, center(block.location), 0.35, 1.5);
  }

  function resetFridgeSessions(station) {
    // A stale async form must never regain access merely by reloading a chunk.
    viewers.delete(station.id);
    for (const half of ["lower", "upper"]) doorPositions.delete(`${station.id}:${half}`);
  }

  function tickFridge(station, ticks) {
    const compartments = viewers.get(station.id);
    for (const half of ["lower", "upper"]) {
      const block = fridgeBlock(station, half);
      const key = `${station.id}:${half}`;
      const sessions = compartments?.[half];
      if (!block) { sessions?.clear(); doorPositions.delete(key); continue; }
      for (const [id, session] of sessions ?? []) {
        if (!accessible(session.player, station)) sessions.delete(id);
      }
      const open = (sessions?.size ?? 0) > 0;
      const storedFrame = block.permutation.getState(`${NS}frame`);
      const previous = doorPositions.get(key) ?? (Number.isFinite(storedFrame) ? Number(storedFrame) / FRIDGE_LAST_FRAME * FRIDGE_MOTION_TICKS : 0);
      const motion = advanceDoorMotion(previous, open, ticks);
      doorPositions.set(key, motion.position);
      fridgeDoors(station, half, open);
      setState(block, `${NS}frame`, motion.frame);
    }
    if (compartments && !compartments.lower.size && !compartments.upper.size) viewers.delete(station.id);
  }

  async function openFridge(player, station, upper) {
    if (storageForms.has(player.id) || !accessible(player, station)) return;
    const half = upper ? "upper" : "lower";
    let compartments = viewers.get(station.id);
    if (!compartments) { compartments = { lower: new Map(), upper: new Map() }; viewers.set(station.id, compartments); }
    const session = { player };
    compartments[half].set(player.id, session);
    fridgeDoors(station, half, true);
    const range = Array.from({ length: upper ? 27 : 54 }, (_, i) => i + (upper ? 0 : 27));
    try {
      await openContainerForm(ctx, player, () => getStorage(station), upper ? "冰箱 · 上層 27 格" : "冰箱 · 下層 54 格", {
        slots: range, accept: isFood,
        isAccessible: () => accessible(player, station) && viewers.get(station.id)?.[half].get(player.id) === session,
      });
    } finally {
      const active = viewers.get(station.id);
      if (active?.[half].get(player.id) === session) active[half].delete(player.id);
      if (!active?.[half].size) fridgeDoors(station, half, false);
      if (active && !active.lower.size && !active.upper.size) viewers.delete(station.id);
    }
  }

  function consumeHeld(player, expectedId, count = 1) {
    const inventory = playerInventory(player);
    const index = player.selectedSlotIndex;
    const stack = inventory?.getItem(index);
    if (!stack || stack.typeId !== expectedId || stack.amount < count) return false;
    // Storage/economy consumes physical items even in Creative, preventing a
    // creative-mode toggle from duplicating stock into another player's station.
    if (stack.amount === count) inventory.setItem(index, undefined);
    else { stack.amount -= count; inventory.setItem(index, stack); }
    return true;
  }

  function giveItem(player, stack) {
    const inventory = playerInventory(player);
    if (!inventory || containerCapacity(inventory, stack) < stack.amount) return false;
    return inventory.addItem(stack) === undefined;
  }

  function handEmpty(player) {
    const inventory = playerInventory(player);
    if (inventory?.getItem(player.selectedSlotIndex)) return false;
    return !player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand);
  }

  function interactSink(player, station) {
    const d = data(station);
    const inventory = playerInventory(player);
    const held = inventory?.getItem(player.selectedSlotIndex);
    if (held?.typeId === DIRTY) {
      if (d.plates >= 10) { say(ctx, player, "洗碗池最多可放 10 個髒盤子。"); return; }
      if (consumeHeld(player, DIRTY)) {
        d.plates++;
        ctx.saveStation(station);
        updateVisual(station);
        safeSound(player.dimension, `${NS}plate_place`, center(station.location));
      }
      return;
    }
    if (washing.has(player.id)) { stopWashing(player.id); say(ctx, player, "已停止洗碗。"); return; }
    if (d.plates <= 0) { say(ctx, player, "手持髒盤子放入洗碗池；空手點擊後持續望著池子 4 秒清洗一個。"); return; }
    if (!handEmpty(player)) { say(ctx, player, "請騰空雙手後再洗碗。"); return; }
    if ([...washing.values()].some(session => session.station.id === station.id)) {
      say(ctx, player, "已有玩家正在使用這個洗碗池。"); return;
    }
    washingFeedback.delete(player.id);
    washing.set(player.id, { player, station, start: gameSystem.currentTick });
    say(ctx, player, "清洗中：保持空手並望著洗碗池 4 秒；再次點擊可停止。");
  }

  function interactDishwasher(player, station) {
    const d = data(station);
    if (d.phase === 5 && d.plates > 0) {
      const clean = new ItemStack(CLEAN, d.plates);
      if (!giveItem(player, clean)) { say(ctx, player, "背包空間不足；乾淨盤子仍保存在洗碗機。"); return; }
      const count = d.plates;
      d.plates = 0;
      d.phase = 1;
      d.remainingTicks = 14;
      ctx.saveStation(station);
      updateVisual(station);
      safeSound(player.dimension, `${NS}dishwasher_in`, center(station.location));
      say(ctx, player, `已取出 ${count} 個乾淨盤子。`);
      return;
    }
    if (d.phase !== 0) { say(ctx, player, `洗碗機正在運作 · ${d.plates} 個盤子。`); return; }
    const inventory = playerInventory(player);
    if (!inventory) return;
    const changes = [];
    let count = 0;
    for (let i = 0; i < inventory.size && count < 16; i++) {
      const stack = inventory.getItem(i);
      if (stack?.typeId !== DIRTY) continue;
      const take = Math.min(16 - count, stack.amount);
      changes.push({ i, stack, take });
      count += take;
    }
    if (!count) { say(ctx, player, "背包放入髒盤子後點擊洗碗機，一次最多清洗 16 個。"); return; }
    try {
      for (const change of changes) {
        const next = change.stack.clone();
        if (next.amount === change.take) inventory.setItem(change.i, undefined);
        else { next.amount -= change.take; inventory.setItem(change.i, next); }
      }
      d.plates = count;
      d.phase = 2;
      d.remainingTicks = 30;
      ctx.saveStation(station);
    } catch (error) {
      for (const change of changes) inventory.setItem(change.i, change.stack);
      throw error;
    }
    updateVisual(station);
    safeSound(player.dimension, `${NS}plate_place`, center(station.location));
    say(ctx, player, `已放入 ${count} 個髒盤子；完成後再次點擊取出。`);
  }

  async function openStove(player, station) {
    const inventory = getStorage(station);
    if (!inventory) { say(ctx, player, "爐灶儲物實體尚未載入，請稍後重試。"); return; }
    const d = data(station);
    const form = new ActionFormData().title("三槽爐灶").body(
      `三份食材每 10 秒同步烹調一次，共用燃料。\n進度 ${Math.min(100, Math.floor(d.cookProgress / 2))}% · 剩餘燃燒 ${Math.ceil(d.litTime / 20)} 秒\n只接受已登記的煙燻配方及燃料。`
    );
    const labels = ["食材 1", "食材 2", "食材 3", "燃料", "成品 1", "成品 2", "成品 3"];
    for (let i = 0; i < 7; i++) {
      const stack = inventory.getItem(i);
      form.button(`${labels[i]}\n${stack ? `${itemLabel(stack)} × ${stack.amount}` : "空"}`);
    }
    form.button("關閉");
    const response = await form.show(player);
    if (response.canceled || response.selection === undefined || response.selection > 6 || !accessible(player, station)) return;
    const slot = response.selection;
    await openContainerForm(ctx, player, () => getStorage(station), `爐灶 · ${labels[slot]}`, {
      slots: [slot], allowDeposit: slot < 4,
      accept: stack => slot === 3 ? fuelTicks[stack.typeId] > 0 : !!recipes[stack.typeId],
      isAccessible: () => accessible(player, station),
    });
  }

  function canCook(container, lane) {
    const input = container.getItem(lane);
    const resultId = input && recipes[input.typeId];
    if (!resultId) return false;
    let result;
    try { result = new ItemStack(resultId); } catch { return false; }
    const output = container.getItem(lane + 4);
    return !output || (output.isStackableWith(result) && output.amount < output.maxAmount);
  }

  function cookLane(container, lane) {
    if (!canCook(container, lane)) return;
    const input = container.getItem(lane);
    const beforeOutput = container.getItem(lane + 4);
    const output = beforeOutput ? beforeOutput.clone() : new ItemStack(recipes[input.typeId]);
    if (beforeOutput) output.amount++;
    const remainder = input.clone();
    try {
      if (remainder.amount === 1) container.setItem(lane, undefined);
      else { remainder.amount--; container.setItem(lane, remainder); }
      container.setItem(lane + 4, output);
    } catch (error) {
      container.setItem(lane, input);
      container.setItem(lane + 4, beforeOutput);
      throw error;
    }
  }

  function tickStove(station, ticks) {
    const d = data(station);
    const inventory = getStorage(station);
    if (!inventory) return;
    let changed = false;
    for (let step = 0; step < ticks; step++) {
      if (d.litTime > 0) { d.litTime--; changed = true; }
      const possible = [0, 1, 2].some(lane => canCook(inventory, lane));
      if (d.litTime <= 0 && possible) {
        const fuel = inventory.getItem(3);
        const duration = fuel && fuelTicks[fuel.typeId];
        if (duration > 0) {
          if (fuel.typeId === "minecraft:lava_bucket") inventory.setItem(3, new ItemStack("minecraft:bucket"));
          else if (fuel.amount === 1) inventory.setItem(3, undefined);
          else { fuel.amount--; inventory.setItem(3, fuel); }
          d.litTime = duration;
          d.litDuration = duration;
          changed = true;
          const block = loadedStation(station);
          if (block) safeSound(block.dimension, "fire.ignite", center(block.location), 0.6);
        }
      }
      if (d.litTime > 0 && possible) {
        d.cookProgress++;
        changed = true;
        if (d.cookProgress >= 200) {
          for (let lane = 0; lane < 3; lane++) cookLane(inventory, lane);
          d.cookProgress = 0;
          ctx.saveStation(station);
        }
      } else if (d.litTime <= 0 && d.cookProgress > 0) {
        d.cookProgress = Math.max(0, d.cookProgress - 2);
        changed = true;
      }
    }
    if (changed && gameSystem.currentTick % 20 < ticks) ctx.saveStation(station);
    updateVisual(station);
    if (d.litTime > 0 && gameSystem.currentTick % 20 < ticks) {
      const block = loadedStation(station);
      if (block) safeParticle(block.dimension, "minecraft:basic_smoke_particle", center(block.location, 0.75));
    }
  }

  function tickDishwasher(station, ticks) {
    const d = data(station);
    if (d.phase === 0 || d.phase === 5) return;
    d.remainingTicks -= ticks;
    while (d.remainingTicks <= 0 && d.phase !== 0 && d.phase !== 5) {
      if (d.phase === 1) { d.phase = 0; d.remainingTicks = 0; }
      else if (d.phase === 2) { d.phase = 3; d.remainingTicks += d.plates > 8 ? 80 : 40; }
      else if (d.phase === 3) { d.phase = 4; d.remainingTicks += 24; }
      else if (d.phase === 4) { d.phase = 5; d.remainingTicks = 0; }
      else throw new Error("洗碗機狀態超出範圍，已保留原資料。");
      ctx.saveStation(station);
      const block = loadedStation(station);
      if (block && d.phase === 3) safeSound(block.dimension, `${NS}dishwasher_washing`, center(block.location), 0.9);
      if (block && d.phase === 4) {
        safeSound(block.dimension, `${NS}dishwasher_clear_out`, center(block.location), 0.9);
        safeParticle(block.dimension, "minecraft:basic_smoke_particle", center(block.location, 0.8));
      }
    }
    if (gameSystem.currentTick % 20 < ticks) {
      ctx.saveStation(station);
      const block = loadedStation(station);
      if (block && d.phase === 3) safeParticle(block.dimension, "minecraft:water_splash_particle", center(block.location, 0.9));
    }
    updateVisual(station);
  }

  function tickWashing() {
    for (const [id, session] of washing) {
      const { player, station, start } = session;
      try {
        const hit = player.isValid && player.getBlockFromViewDirection({ maxDistance: 4, includeLiquidBlocks: false });
        if (!accessible(player, station) || !handEmpty(player) || !hit || !sameLocation(hit.block.location, station.location)) {
          stopWashing(id, player.isValid);
          continue;
        }
        const d = data(station);
        if (d.plates <= 0) { washing.delete(id); continue; }
        const elapsed = gameSystem.currentTick - start;
        if (elapsed % 20 < APPLIANCE_TICK_INTERVAL) {
          safeParticle(player.dimension, "minecraft:water_splash_particle", center(station.location, 0.94));
          safeSound(player.dimension, "random.splash", center(station.location, 0.94), 0.2);
        }
        if (elapsed >= 80) {
          if (!giveItem(player, new ItemStack(CLEAN))) {
            say(ctx, player, "背包空間不足，盤子仍留在洗碗池。");
          } else {
            d.plates--;
            ctx.saveStation(station);
            updateVisual(station);
            safeSound(player.dimension, `${NS}plate_place`, center(station.location));
            say(ctx, player, "已洗好 1 個盤子。");
          }
          washing.delete(id);
        }
      } catch {
        washing.delete(id);
      }
    }
  }

  function onPlace(block) {
    if (!KINDS.has(block.typeId)) return false;
    if (block.typeId === FRIDGE) {
      if (block.permutation.getState(`${NS}half`) === "upper") return true;
      const upper = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
      const alreadyUpper = upper?.typeId === FRIDGE && upper.permutation.getState(`${NS}half`) === "upper";
      if (!upper?.isAir && !alreadyUpper) {
        block.dimension.spawnItem(new ItemStack(FRIDGE), center(block.location));
        const rejected = (ctx.stations?.() ?? []).find(station => station.dimensionId === block.dimension.id && sameLocation(station.location, block.location));
        if (rejected) ctx.deleteStation(rejected.id);
        block.setType("minecraft:air");
        return true;
      }
      if (!alreadyUpper) upper.setPermutation(block.permutation.withState(`${NS}half`, "upper"));
    }
    const station = ctx.getStation(block);
    data(station);
    if (block.typeId === FRIDGE || block.typeId === STOVE) ensureStorage(station);
    updateVisual(station);
    return true;
  }

  function onInteract(player, block) {
    if (!KINDS.has(block.typeId)) return false;
    const upper = block.typeId === FRIDGE && block.permutation.getState(`${NS}half`) === "upper";
    const normalized = normalizeApplianceBlock(block);
    const station = ctx.getStation(normalized);
    data(station);
    try {
      if (block.typeId === FRIDGE) void openFridge(player, station, upper);
      else if (block.typeId === STOVE) void openStove(player, station).catch(error => say(ctx, player, String(error)));
      else if (block.typeId === SINK) interactSink(player, station);
      else if (block.typeId === DISHWASHER) interactDishwasher(player, station);
    } catch (error) { say(ctx, player, `設備操作未完成：${String(error)}`); }
    return true;
  }

  function onBreak(block, station, permutation) {
    const typeId = permutation?.type?.id ?? station?.typeId;
    if (!KINDS.has(typeId)) return false;
    let baseLocation = block.location;
    const upperHalf = typeId === FRIDGE && permutation?.getState(`${NS}half`) === "upper";
    if (upperHalf) {
      baseLocation = { ...block.location, y: block.location.y - 1 };
      const lower = block.dimension.getBlock(baseLocation);
      if (lower?.typeId === FRIDGE) {
        station = ctx.getStation(lower);
        // Upper half has no loot. Spawn the one lower-half item before removing it.
        block.dimension.spawnItem(new ItemStack(FRIDGE), center(baseLocation));
        lower.setType("minecraft:air");
      }
    } else if (typeId === FRIDGE) {
      const upper = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
      if (upper?.typeId === FRIDGE && upper.permutation.getState(`${NS}half`) === "upper") upper.setType("minecraft:air");
    }
    if (!station) {
      station = (ctx.stations?.() ?? []).find(entry => entry.dimensionId === block.dimension.id && sameLocation(entry.location, baseLocation));
    }
    if (station) {
      const d = station.appliance;
      if (d?.plates > 0) {
        const clean = typeId === DISHWASHER && (d.phase === 4 || d.phase === 5);
        block.dimension.spawnItem(new ItemStack(clean ? CLEAN : DIRTY, d.plates), center(baseLocation));
        d.plates = 0;
      }
      const entity = findEntity(station.storageId);
      if (entity) {
        const inventory = entity.getComponent("minecraft:inventory")?.container;
        if (!inventory || dropContainerContents(inventory, block.dimension, center(baseLocation))) entity.remove();
      }
      ctx.deleteStation(station.id);
      clocks.delete(station.id);
      resetFridgeSessions(station);
      for (const [id, session] of washing) if (session.station.id === station.id) washing.delete(id);
    }
    return true;
  }

  function recoverOrphanStorage() {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
      const dimension = gameWorld.getDimension(dimensionId);
      for (const entity of dimension.getEntities({ type: STORAGE, tags: [`${NS}appliance_storage`] })) {
        const anchorValue = entity.getDynamicProperty(`${NS}storage_anchor`);
        if (typeof anchorValue !== "string") continue;
        let anchor;
        try { anchor = JSON.parse(anchorValue); } catch { continue; }
        if (!anchor?.location || !anchor.typeId) continue;
        let block;
        try { block = dimension.getBlock(anchor.location); } catch { continue; }
        if (!block || block.typeId === anchor.typeId) continue;
        // Explosion/commands may bypass a player-break callback. Spill exact cargo
        // once; retain any undropped slots if a chunk boundary prevents spawning.
        try {
          const inventory = entity.getComponent("minecraft:inventory")?.container;
          if (!inventory || dropContainerContents(inventory, dimension, center(anchor.location))) {
            entity.remove();
            ctx.deleteStation(anchor.stationId);
          }
        } catch { /* Retry after the next loaded-chunk scan. */ }
      }
    }
  }

  function tick() {
    const now = gameSystem.currentTick;
    if (now === lastTick) return;
    lastTick = now;
    for (const [id, feedback] of washingFeedback) if (now >= feedback.until) washingFeedback.delete(id);
    tickWashing();
    for (const station of ctx.stations?.() ?? []) {
      if (!KINDS.has(station.typeId)) continue;
      const block = loadedStation(station);
      if (!block) { clocks.delete(station.id); if (station.typeId === FRIDGE) resetFridgeSessions(station); continue; }
      const delta = Math.max(0, Math.min(20, now - (clocks.get(station.id) ?? now)));
      clocks.set(station.id, now);
      try {
        if (station.typeId === STOVE && delta) tickStove(station, delta);
        else if (station.typeId === DISHWASHER && delta) tickDishwasher(station, delta);
        if (station.typeId === FRIDGE) tickFridge(station, delta);
        else if (!delta) updateVisual(station);
      } catch (error) {
        // Do not reset invalid state or erase missing inventories on recovery.
        console.warn(`[OrderToCook] ${station.id}: ${String(error)}`);
      }
    }
    if (now - lastRecoveryTick >= 100) { lastRecoveryTick = now; recoverOrphanStorage(); }
  }

  function countFood(station, itemId) {
    const inventory = getStorage(station);
    if (!inventory) return 0;
    let count = 0;
    const range = station.typeId === FRIDGE ? slotsOf(inventory) : [4, 5, 6];
    for (const i of range) {
      const stack = inventory.getItem(i);
      if (stack?.typeId === itemId) count += stack.amount;
    }
    return count;
  }

  function consumeFood(station, itemId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    const inventory = getStorage(station);
    if (!inventory || countFood(station, itemId) < amount) return 0;
    let remaining = amount;
    const changes = [];
    const range = station.typeId === FRIDGE ? slotsOf(inventory) : [4, 5, 6];
    for (const i of range) {
      if (!remaining) break;
      const stack = inventory.getItem(i);
      if (stack?.typeId !== itemId) continue;
      const take = Math.min(remaining, stack.amount);
      changes.push({ i, stack, take });
      remaining -= take;
    }
    try {
      for (const change of changes) {
        if (change.stack.amount === change.take) inventory.setItem(change.i, undefined);
        else {
          const next = change.stack.clone();
          next.amount -= change.take;
          inventory.setItem(change.i, next);
        }
      }
    } catch (error) {
      for (const change of changes) inventory.setItem(change.i, change.stack);
      throw error;
    }
    return amount;
  }

  function init() {
    // main calls init from worldLoad. Scheduling also stays safe if init is moved
    // to early execution; do not wait for a second worldLoad event that never fires.
    gameSystem.run(() => {
      gameSystem.runInterval(tick, APPLIANCE_TICK_INTERVAL);
    });
    gameWorld.afterEvents.playerLeave.subscribe(event => {
      washing.delete(event.playerId);
      washingFeedback.delete(event.playerId);
      storageForms.delete(event.playerId);
      for (const compartments of viewers.values()) {
        compartments.lower.delete(event.playerId);
        compartments.upper.delete(event.playerId);
      }
    });
  }

  return { init, tick, onPlace, onInteract, onBreak, getStorage, countFood, consumeFood, getInspection, getWashingProgress, normalizeBlock: normalizeApplianceBlock };
}
