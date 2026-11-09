// SPDX-License-Identifier: GPL-3.0-only
// Bedrock adaptation of Order To Cook by breezeth-CN; see THIRD_PARTY_NOTICES.md.
import { BlockPermutation, EquipmentSlot, ItemStack, MolangVariableMap, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { advanceDoorMotion, fridgeRootFrame, dishwasherFrame, APPLIANCE_TICK_INTERVAL, FRIDGE_MOTION_TICKS, FRIDGE_LAST_FRAME } from "./appliance_motion.js";
import { formatEquipmentInspection, INSPECTION_TYPES } from "./equipment_inspection.js";
import { createNativeFridgeStorage, compactFridgeInventory, FRIDGE_UPPER, isFridge, isUpperFridge } from "./native_fridge.js";
import { createStoveControls } from "./stove_controls.js";
import { SMOKING_RECIPES } from "./smoking_recipes.js";
import { initializeStoveFire, igniteStoveFire, advanceStoveFire, stoveFireFrame, stoveIgnitionFrame } from "./stove_fire.js";

export { SMOKING_RECIPES };
import { playEffects, plateSound, fridgeDoorEffects, dishwasherTakeEffects, dishwasherTimedEffects, washingEffectBeat, handwashingEffects } from "./audiovisual.js";

const NS = "ordertocook:";
const FRIDGE = `${NS}refrigerator`;
const STOVE = `${NS}stove`;
const SINK = `${NS}washingtable`;
const DISHWASHER = `${NS}dishwasher`;
const WASH_ANIMATION_CONTROLLER = 'ordertocook_handwash';
const STORAGE = `${NS}storage`;
const DIRTY = `${NS}dirty_plate`;
const CLEAN = `${NS}clean_plate`;
const KINDS = new Set([FRIDGE, FRIDGE_UPPER, STOVE, SINK, DISHWASHER]);
const storageForms = new Set();

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
        const selectedStack = mode === "put" ? refreshedPlayer.getItem(entry.slot) : undefined;
        if (mode === "put" && options.accept && (!selectedStack || !options.accept(selectedStack))) {
          say(ctx, player, "所選物品目前不能放入這個分區。");
          return;
        }
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
  if (isUpperFridge(block)) {
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
  const initializedStoves = new Set();
  // Cosmetic only. Java's preview is local to one client; Bedrock block poses
  // are shared, so keep the drawer open while any eligible viewer targets it.
  const dishwasherPreviews = new Map();
  let lastTick = -1;
  let lastRecoveryTick = -100;
  // Keep the provider's live registry: late announcements and withdrawals must
  // reach existing stoves. Legacy callers may still supply input -> output IDs.
  const recipes = ctx.smokingRecipes ?? {};
  const fuelTicks = { ...FUEL_TICKS, ...(ctx.fuelTicks ?? {}) };
  const nativeFridge = createNativeFridgeStorage({
    loadedBlock: loadedStation, saveStation: ctx.saveStation,
    placeUpper: placeFridgeUpper, findLegacy: station => ensureStorage(station, false),
  });
  const stoveControls = createStoveControls({
    getStorage, isAccessible: accessible, playerInventory, transferStackToRange,
    itemLabel, fingerprint: itemFingerprint,
    isIngredient: stack => !!recipeResult(stack), isFuel: stack => fuelTicks[stack.typeId] > 0,
    makeForm: () => new ActionFormData(), notify: (player, message) => say(ctx, player, message), getProgress: data,
    onChange: (station, inventory) => {
      const d = data(station), before = { inputKeys: d.inputKeys, cookProgress: d.cookProgress };
      try { syncStoveInputs(station, inventory); ctx.saveStation(station); }
      catch (error) { Object.assign(d, before); throw error; }
    },
  });

  function placeFridgeUpper(lower, upper) {
    upper.setPermutation(BlockPermutation.resolve(FRIDGE_UPPER, {
      "minecraft:cardinal_direction": lower.permutation.getState("minecraft:cardinal_direction") || "north",
      [`${NS}half`]: "upper", [`${NS}open`]: false, [`${NS}frame`]: 0,
    }));
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

  function assertStorageIdentity(entity, station) {
    if (entity.typeId !== STORAGE || entity.getDynamicProperty(`${NS}station_id`) !== station.id ||
        entity.dimension.id !== station.dimensionId || squaredDistance(entity.location, center(station.location, 0.1)) > 1.5 ** 2) {
      throw new Error("設備儲物身份不符；保留原引用及兩邊物品。");
    }
  }

  function ensureStorage(station, create = true) {
    let entity = findEntity(station.storageId);
    const block = loadedStation(station);
    if (!block) return undefined;
    if (entity) assertStorageIdentity(entity, station);
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
    if (station.typeId === FRIDGE) return nativeFridge.ensure(station);
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
      const preview = d.phase === 0 ? dishwasherPreviews.get(station.id) : undefined;
      setState(block, `${NS}phase`, preview ? 6 : d.phase);
      setState(block, `${NS}frame`, preview
        ? Math.min(15, Math.floor((gameSystem.currentTick - preview.start) / (1.1667 * 20) * 15))
        : dishwasherFrame(d));
      setState(block, `${NS}plates`, d.plates % 16);
      setState(block, `${NS}plates_high`, d.plates === 16);
    }
    if (station.typeId === STOVE) {
      // Commit texture and both halves of the pose age atomically. Separate
      // writes can briefly bind a new texture to the previous ignition pose.
      const age = stoveIgnitionFrame(d);
      const states = { [`${NS}lit`]: d.litTime > 0, [`${NS}fire_frame`]: stoveFireFrame(d),
        [`${NS}ignition_frame`]: age % 16, [`${NS}ignition_frame_high`]: age >= 16 };
      try {
        let permutation = block.permutation;
        let changed = false;
        for (const [state, value] of Object.entries(states)) {
          if (permutation.getState(state) !== value) {
            permutation = permutation.withState(state, value);
            changed = true;
          }
        }
        if (changed) block.setPermutation(permutation);
      } catch { /* Missing resources cannot change the saved cooking state. */ }
    }
  }

  function accessible(player, station) {
    return player.isValid && player.dimension.id === station.dimensionId &&
      squaredDistance(player.location, center(station.location)) <= 36 && !!loadedStation(station) &&
      (!ctx.canUseStation || !!ctx.canUseStation(player, station));
  }

  function updateDishwasherPreviews(stations) {
    const idle = new Map(stations.filter(station => station.typeId === DISHWASHER && station.appliance?.phase === 0)
      .map(station => [`${station.dimensionId}:${station.location.x}:${station.location.y}:${station.location.z}`, station]));
    const next = new Map();
    for (const player of gameWorld.getAllPlayers()) {
      try {
        const held = playerInventory(player)?.getItem(player.selectedSlotIndex);
        const offhand = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand);
        if (held?.typeId !== DIRTY && offhand?.typeId !== DIRTY) continue;
        const block = player.getBlockFromViewDirection({ maxDistance: 6, includeLiquidBlocks: false })?.block;
        if (block?.typeId !== DISHWASHER) continue;
        const station = idle.get(`${block.dimension.id}:${block.location.x}:${block.location.y}:${block.location.z}`);
        if (!station || !accessible(player, station)) continue;
        const previous = dishwasherPreviews.get(station.id);
        let preview = next.get(station.id);
        if (!preview) {
          preview = { start: previous?.start ?? gameSystem.currentTick, viewers: new Set() };
          next.set(station.id, preview);
        }
        preview.viewers.add(player.id);
        if (!previous?.viewers.has(player.id)) {
          // Match Java playLocalSound: do not make other players hear another
          // viewer repeatedly moving their crosshair over the same appliance.
          try { player.playSound(`${NS}dishwasher_out`, { location: center(station.location, 0.6), volume: 0.75, pitch: 1 }); } catch { /* Cosmetic only. */ }
        }
      } catch { /* A departing player or unloaded ray target has no preview. */ }
    }
    dishwasherPreviews.clear();
    for (const [id, preview] of next) dishwasherPreviews.set(id, preview);
  }

  /**
   * Resolve an existing station and its existing helper only. Merely looking at
   * equipment must not call getStation/data/ensureStorage or write saved state.
   */
  function getInspection(player, block) {
    try {
      if (!block?.isValid || (!isFridge(block) && !INSPECTION_TYPES.includes(block.typeId))) return undefined;
      const upper = isUpperFridge(block);
      const normalized = normalizeApplianceBlock(block);
      const station = (ctx.stations?.() ?? []).find(entry =>
        entry.dimensionId === normalized.dimension.id && entry.typeId === normalized.typeId &&
        sameLocation(entry.location, normalized.location));
      if (!station || !accessible(player, station)) return undefined;
      const snapshot = { typeId: station.typeId, supplies: station.supplies, upper,
        appliance: station.appliance ? { ...station.appliance } : undefined,
        occupied: undefined, storageLoaded: false };
      if (station.typeId === FRIDGE || station.typeId === STOVE) {
        const helper = station.typeId === STOVE && findEntity(station.storageId);
        const inventory = station.typeId === FRIDGE ? nativeFridge.peek(station) : helper?.typeId === STORAGE && helper.getDynamicProperty(`${NS}station_id`) === station.id &&
          helper.dimension.id === station.dimensionId && squaredDistance(helper.location, center(station.location, 0.1)) <= 1.5 ** 2
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
        if (!accessible(player, session.station) || !canHandwash(player) ||
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
    const session = washing.get(id);
    washing.delete(id);
    if (session) playWashingAnimation(session.player, true);
    if (feedback) washingFeedback.set(id, { until: gameSystem.currentTick + 20, text: "§7洗碗已中止" });
  }

  function playWashingAnimation(player, stop = false) {
    // Both clips share a start tick; the client selects its current perspective.
    // Keep the first-person arm independent of third-person body transforms.
    for (const suffix of ['', '_first_person']) {
      try {
        player.playAnimation(`animation.ordertocook.player.${stop ? 'handwash_stop' : 'handwash' + suffix}`, {
          controller: WASH_ANIMATION_CONTROLLER + suffix, blendOutTime: 0.1
        });
      } catch {
        // Each cosmetic request is independent; neither can change plate delivery.
        // The clips are finite even if a disconnected Player rejects the stop.
      }
    }
  }

  function fridgeBlock(station, half) {
    const lower = loadedStation(station);
    if (!lower || half === "lower") return lower;
    try {
      const upper = lower.dimension.getBlock({ ...lower.location, y: lower.location.y + 1 });
      return isUpperFridge(upper) ? upper : undefined;
    } catch { return undefined; }
  }

  function fridgeDoors(station, half, open) {
    const block = fridgeBlock(station, half);
    if (!block) return;
    const changed = block.permutation.getState(`${NS}open`) !== open;
    setState(block, `${NS}open`, open);
    if (changed) playEffects(block.dimension, fridgeDoorEffects(station.location, half, open), MolangVariableMap);
  }

  function resetFridgeSessions(station) {
    viewers.delete(station.id);
    nativeFridge.forget(station);
    for (const half of ["lower", "upper"]) doorPositions.delete(`${station.id}:${half}`);
  }

  function tickFridge(station, ticks) {
    const compartments = viewers.get(station.id);
    const poses = {};
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
      const storedClosing = block.permutation.getState(`${NS}closing`) === true;
      const frame = Number.isFinite(storedFrame) ? Number(storedFrame) : 0;
      const previous = doorPositions.get(key) ?? {
        position: (storedClosing ? FRIDGE_LAST_FRAME - frame : frame) / FRIDGE_LAST_FRAME * FRIDGE_MOTION_TICKS,
        closing: storedClosing,
      };
      const motion = advanceDoorMotion(previous, open, ticks);
      doorPositions.set(key, motion);
      poses[half] = { block, motion, open };
    }
    const root = fridgeRootFrame(poses.upper?.motion, poses.lower?.motion);
    for (const half of ["lower", "upper"]) {
      if (!poses[half]) continue;
      const { block, motion, open } = poses[half];
      fridgeDoors(station, half, open);
      // Each block gets one coherent door/root pose. Cross-block writes are not
      // atomic: compare actual states every tick so a failed write is retried
      // at the current pose on the next loaded tick, including idle endpoints.
      try {
        if (block.permutation.getState(`${NS}closing`) !== motion.closing ||
            block.permutation.getState(`${NS}frame`) !== motion.frame ||
            block.permutation.getState(`${NS}root_frame`) !== root)
          block.setPermutation(block.permutation.withState(`${NS}closing`, motion.closing)
            .withState(`${NS}frame`, motion.frame).withState(`${NS}root_frame`, root));
      } catch { /* Missing resources do not change stored food. */ }
    }
    if (compartments && !compartments.lower.size && !compartments.upper.size) viewers.delete(station.id);
  }

  function onContainerOpened(event) {
    if (!isFridge(event.block)) return;
    const player = event.openSource?.entity;
    if (player?.typeId !== "minecraft:player") return;
    const station = (ctx.stations?.() ?? []).find(value => value.dimensionId === event.block.dimension.id &&
      sameLocation(value.location, normalizeApplianceBlock(event.block).location));
    if (!station || !nativeFridge.peek(station) || !accessible(player, station)) return;
    const half = isUpperFridge(event.block) ? "upper" : "lower";
    let compartments = viewers.get(station.id);
    if (!compartments) { compartments = { lower: new Map(), upper: new Map() }; viewers.set(station.id, compartments); }
    compartments[half].set(player.id, { player });
    fridgeDoors(station, half, true);
  }

  function onContainerClosed(event) {
    if (!isFridge(event.block)) return;
    const player = event.closeSource?.entity;
    if (!player) return;
    const normalized = normalizeApplianceBlock(event.block);
    const station = (ctx.stations?.() ?? []).find(value => value.dimensionId === normalized.dimension.id && sameLocation(value.location, normalized.location));
    if (!station) return;
    const half = isUpperFridge(event.block) ? "upper" : "lower";
    const active = viewers.get(station.id);
    active?.[half].delete(player.id);
    if (!active?.[half].size) fridgeDoors(station, half, false);
    if (active && !active.lower.size && !active.upper.size) viewers.delete(station.id);
  }

  /** Read-only entry decision; the main before-event owns cancel and scheduling. */
  function canOpenFridge(player, block) {
    const normalized = normalizeApplianceBlock(block);
    const station = (ctx.stations?.() ?? []).find(value => value.dimensionId === normalized.dimension.id && sameLocation(value.location, normalized.location));
    return !!station && accessible(player, station) && !!nativeFridge.peek(station);
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

  function canHandwash(player) {
    const mount = player.getComponent('minecraft:riding')?.entityRidingOn;
    return handEmpty(player) && ![`${NS}seat`, `${NS}motorcycle`].includes(mount?.typeId);
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
        playEffects(player.dimension, plateSound(center(station.location)), MolangVariableMap);
      }
      return;
    }
    if (washing.has(player.id)) { stopWashing(player.id); say(ctx, player, "已停止洗碗。"); return; }
    if (d.plates <= 0) { say(ctx, player, "手持髒盤子放入洗碗池；空手點擊後持續望著池子 4 秒清洗一個。"); return; }
    if (!canHandwash(player)) { say(ctx, player, "請空出雙手並離開椅子／小電驢後再洗碗。"); return; }
    if ([...washing.values()].some(session => session.station.id === station.id)) {
      say(ctx, player, "已有玩家正在使用這個洗碗池。"); return;
    }
    washingFeedback.delete(player.id);
    washing.set(player.id, { player, station, start: gameSystem.currentTick, effectBeat: -1 });
    playWashingAnimation(player);
    say(ctx, player, "清洗中：保持空手並望著洗碗池 4 秒；再次點擊可停止。");
  }

  function interactDishwasher(player, station) {
    const d = data(station);
    const inventory = playerInventory(player);
    if (!inventory?.isValid) return;
    if (d.phase === 5 && d.plates > 0) {
      if (!handEmpty(player)) { say(ctx, player, "請騰空雙手，再點擊一次取出整批乾淨盤子。"); return; }
      const clean = new ItemStack(CLEAN, d.plates);
      if (containerCapacity(inventory, clean) < clean.amount) { say(ctx, player, "背包空間不足；乾淨盤子仍保存在洗碗機。"); return; }
      const beforeInventory = Array.from({ length: inventory.size }, (_, slot) => inventory.getItem(slot));
      const beforeState = { ...d };
      const count = d.plates;
      try {
        if (inventory.addItem(clean)) throw new Error("背包空間已改變，盤子保留在洗碗機。");
        d.plates = 0;
        d.phase = 1;
        d.remainingTicks = 14;
        ctx.saveStation(station);
      } catch (error) {
        for (let slot = 0; slot < beforeInventory.length; slot++) inventory.setItem(slot, beforeInventory[slot]);
        Object.assign(d, beforeState);
        throw error;
      }
      updateVisual(station);
      playEffects(player.dimension, [
        ...dishwasherTakeEffects(station.location),
        ...dishwasherTimedEffects(station.location, "north", 1, 0, -1, 0)
      ], MolangVariableMap);
      say(ctx, player, `已取出 ${count} 個乾淨盤子。`);
      return;
    }
    if (d.phase !== 0) { say(ctx, player, `洗碗機正在運作 · ${d.plates} 個盤子。`); return; }
    const held = inventory.getItem(player.selectedSlotIndex);
    if (held?.typeId !== DIRTY) { say(ctx, player, "手持髒盤點擊，一次放入背包內最多 16 個；完成後空手點擊取出。"); return; }
    const changes = [];
    const beforeState = { ...d };
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
      Object.assign(d, beforeState);
      throw error;
    }
    updateVisual(station);
    // Java plays this when the dish contacts the drawer, 14 ticks into dirty_in.
    say(ctx, player, `已放入 ${count} 個髒盤子；完成後再次點擊取出。`);
  }

  async function openStove(player, station) {
    const inventory = getStorage(station);
    if (inventory && syncStoveInputs(station, inventory)) ctx.saveStation(station);
    return stoveControls.interact(player, station);
  }

  function stoveInputKeys(container) {
    return [0, 1, 2].map(lane => {
      const item = container.getItem(lane);
      if (!item) return "";
      item.amount = 1; // Java identity excludes count; same-stack top-ups keep progress.
      return itemFingerprint(item);
    });
  }

  function syncStoveInputs(station, container) {
    const d = data(station), keys = stoveInputKeys(container);
    const previous = d.inputKeys;
    if (previous && keys.every((key, lane) => key === previous[lane])) return false;
    // Old saves lack the fingerprints: seed them without discarding valid progress.
    if (previous) d.cookProgress = 0;
    d.inputKeys = keys;
    return true;
  }

  function recipeResult(input) {
    if (!input) return undefined;
    const recipe = recipes[input.typeId] ?? SMOKING_RECIPES[input.typeId];
    const output = typeof recipe === "string" ? recipe : recipe?.output;
    const count = typeof recipe === "string" ? 1 : recipe?.count;
    if (!output || !Number.isInteger(count) || count < 1) return undefined;
    try {
      const result = new ItemStack(output, count);
      return count <= result.maxAmount && result.amount === count ? result : undefined;
    } catch { return undefined; } // A removed supplier cannot mint a missing item.
  }

  function canCook(container, lane) {
    const result = recipeResult(container.getItem(lane));
    if (!result) return false;
    const output = container.getItem(lane + 4);
    return !output || (output.isStackableWith(result) && output.amount + result.amount <= output.maxAmount);
  }

  function cookLane(container, lane) {
    if (!canCook(container, lane)) return;
    const input = container.getItem(lane);
    const beforeOutput = container.getItem(lane + 4);
    const result = recipeResult(input);
    const output = beforeOutput ? beforeOutput.clone() : result;
    if (beforeOutput) output.amount += result.amount;
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
    let changed = syncStoveInputs(station, inventory);
    for (let step = 0; step < ticks; step++) {
      if (d.fireAnimationTicks > 0) changed = true;
      const effect = advanceStoveFire(d);
      if (effect) stoveFeedback(station, effect);
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
          igniteStoveFire(d);
          changed = true;
        }
      }
      if (d.litTime > 0 && possible) {
        d.cookProgress++;
        changed = true;
        if (d.cookProgress >= 200) {
          const before = [0, 1, 2, 4, 5, 6].map(slot => ({ slot, item: inventory.getItem(slot) }));
          try {
            for (let lane = 0; lane < 3; lane++) cookLane(inventory, lane);
          } catch (error) {
            for (const { slot, item } of before) inventory.setItem(slot, item);
            d.cookProgress = 199;
            ctx.saveStation(station);
            throw error;
          }
          d.cookProgress = 0;
          // Internal shrink is not a player changing the input identity.
          d.inputKeys = stoveInputKeys(inventory);
        }
      } else if (d.litTime <= 0 && d.cookProgress > 0) {
        d.cookProgress = Math.max(0, d.cookProgress - 2);
        changed = true;
      }
    }
    // Persist one processed update (normally two ticks), including ignition and
    // the exact remaining fuel/progress. A shutdown before-event cannot write
    // world state, and a 20-tick checkpoint would rewind an ordinary restart.
    if (changed) ctx.saveStation(station);
    updateVisual(station);
  }

  function stoveFeedback(station, effect) {
    const block = loadedStation(station);
    if (!block) return;
    const facing = block.permutation.getState("minecraft:cardinal_direction");
    const direction = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] }[String(facing)] ?? [0, -1];
    const position = { x: block.location.x + 0.5 + direction[0] * 0.375,
      y: block.location.y + 0.4, z: block.location.z + 0.5 + direction[1] * 0.375 };
    if (effect === "burst") safeSound(block.dimension, "item.firecharge.use", center(block.location), 1, 1);
    for (let i = 0; i < (effect === "burst" ? 12 : 3); i++) safeParticle(block.dimension, "minecraft:basic_flame_particle", position);
    if (effect === "burst") for (let i = 0; i < 6; i++) safeParticle(block.dimension, "minecraft:basic_smoke_particle", position);
  }

  function tickDishwasher(station, ticks) {
    const d = data(station);
    if (d.phase === 0 || d.phase === 5) return;
    const block = loadedStation(station);
    const facing = block?.permutation.getState("minecraft:cardinal_direction") || "north";
    const durations = { 1: 14, 2: 30, 3: d.plates > 8 ? 80 : 40, 4: 24 };
    let remaining = ticks;
    while (remaining > 0 && d.phase !== 0 && d.phase !== 5) {
      const duration = durations[d.phase];
      if (!duration) throw new Error("洗碗機狀態超出範圍，已保留原資料。");
      const before = duration - d.remainingTicks;
      const step = Math.min(remaining, Math.max(0, d.remainingTicks));
      d.remainingTicks -= step;
      remaining -= step;
      if (block) playEffects(block.dimension,
        dishwasherTimedEffects(station.location, facing, d.phase, d.plates, before, before + step), MolangVariableMap);
      if (d.remainingTicks > 0) break;
      d.phase = d.phase === 1 ? 0 : d.phase + 1;
      d.remainingTicks = durations[d.phase] || 0;
      ctx.saveStation(station);
      if (block) playEffects(block.dimension,
        dishwasherTimedEffects(station.location, facing, d.phase, d.plates, -1, 0), MolangVariableMap);
    }
    if (gameSystem.currentTick % 20 < ticks) ctx.saveStation(station);
  }

  function tickWashing() {
    for (const [id, session] of washing) {
      const { player, station, start } = session;
      try {
        const hit = player.isValid && player.getBlockFromViewDirection({ maxDistance: 4, includeLiquidBlocks: false });
        if (!accessible(player, station) || !canHandwash(player) || !hit || !sameLocation(hit.block.location, station.location)) {
          stopWashing(id, player.isValid);
          continue;
        }
        const d = data(station);
        if (d.plates <= 0) { stopWashing(id, false); continue; }
        const elapsed = gameSystem.currentTick - start;
        const effectBeat = washingEffectBeat(elapsed);
        if (effectBeat >= 0 && effectBeat > session.effectBeat) {
          session.effectBeat = effectBeat;
          playEffects(player.dimension, handwashingEffects(station.location,
            hit.block.permutation.getState("minecraft:cardinal_direction") || "north"), MolangVariableMap);
        }
        if (elapsed >= 80) {
          if (!giveItem(player, new ItemStack(CLEAN))) {
            say(ctx, player, "背包空間不足，盤子仍留在洗碗池。");
          } else {
            d.plates--;
            ctx.saveStation(station);
            updateVisual(station);
            playEffects(player.dimension, plateSound(center(station.location)), MolangVariableMap);
            say(ctx, player, "已洗好 1 個盤子。");
          }
          stopWashing(id, false);
        }
      } catch {
        stopWashing(id, false);
      }
    }
  }

  function onPlace(block) {
    if (!KINDS.has(block.typeId)) return false;
    if (isUpperFridge(block)) return true;
    if (block.typeId === FRIDGE) {
      const upper = block.dimension.getBlock({ ...block.location, y: block.location.y + 1 });
      const alreadyUpper = isUpperFridge(upper);
      if (!upper?.isAir && !alreadyUpper) {
        block.dimension.spawnItem(new ItemStack(FRIDGE), center(block.location));
        const rejected = (ctx.stations?.() ?? []).find(station => station.dimensionId === block.dimension.id && sameLocation(station.location, block.location));
        if (rejected) ctx.deleteStation(rejected.id);
        block.setType("minecraft:air");
        return true;
      }
      if (!alreadyUpper) placeFridgeUpper(block, upper);
    }
    const station = ctx.getStation(block);
    data(station);
    if (block.typeId === FRIDGE) nativeFridge.ensure(station);
    if (block.typeId === STOVE) ensureStorage(station);
    updateVisual(station);
    return true;
  }

  function onInteract(player, block) {
    if (!KINDS.has(block.typeId)) return false;
    const normalized = normalizeApplianceBlock(block);
    const station = ctx.getStation(normalized);
    if (!accessible(player, station)) return true;
    data(station);
    try {
      if (isFridge(block)) {
        if (!nativeFridge.peek(station)) {
          const inventory = nativeFridge.ensure(station);
          say(ctx, player, inventory ? "冰箱庫存已就緒，請再次點擊開啟原生容器。" : "冰箱原生容器尚未就緒；需 Bedrock 26.60 並啟用 Upcoming Creator Features。舊庫存會保留，請稍後再試。");
        } else if (player.isSneaking && !playerInventory(player)?.getItem(player.selectedSlotIndex)) {
          const half = isUpperFridge(block) ? "upper" : "lower";
          const container = fridgeBlock(station, half)?.getComponent("minecraft:inventory")?.container;
          if (container?.isValid) compactFridgeInventory(container);
        }
      }
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
    const upperHalf = typeId === FRIDGE_UPPER || (typeId === FRIDGE && permutation?.getState(`${NS}half`) === "upper");
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
      if (isUpperFridge(upper)) upper.setType("minecraft:air");
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
        // Breaking must not bypass the identity check that already rejects use.
        // The block is gone here, so validate the saved anchor without loading it.
        assertStorageIdentity(entity, station);
        const inventory = entity.getComponent("minecraft:inventory")?.container;
        if (!inventory || dropContainerContents(inventory, block.dimension, center(baseLocation))) entity.remove();
      }
      ctx.deleteStation(station.id);
      clocks.delete(station.id);
      initializedStoves.delete(station.id);
      stoveControls.forgetStation(station.id);
      dishwasherPreviews.delete(station.id);
      resetFridgeSessions(station);
      for (const [id, session] of washing) if (session.station.id === station.id) stopWashing(id, false);
    }
    return true;
  }

  function recoverOrphanStorage() {
    // Native inventories already spill when a block is removed. Remove the other
    // half after command/explosion removal too, without spawning its cargo again.
    for (const station of ctx.stations?.() ?? []) {
      if (station.typeId !== FRIDGE) continue;
      try {
        const dimension = gameWorld.getDimension(station.dimensionId);
        const lower = dimension.getBlock(station.location);
        const upper = dimension.getBlock({ ...station.location, y: station.location.y + 1 });
        if (!lower || !upper) continue; // An unloaded half is not a removed half.
        const lowerPresent = lower.typeId === FRIDGE && !isUpperFridge(lower);
        const upperPresent = isUpperFridge(upper);
        if (lowerPresent && upperPresent) continue;
        if (lowerPresent) lower.setType("minecraft:air");
        if (upperPresent) upper.setType("minecraft:air");
        resetFridgeSessions(station);
        // The existing legacy recovery below owns any old helper cargo, including
        // a helper that is still unloaded. Native-only records can now be retired.
        if (!station.storageId) ctx.deleteStation(station.id);
      } catch { /* Wait for both positions to be loaded before removing either. */ }
    }
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
          // Recovery must not spill a helper rejected by the break/use paths.
          assertStorageIdentity(entity, { id: anchor.stationId, dimensionId: anchor.dimensionId, location: anchor.location });
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
    stoveControls.forgetInaccessible();
    for (const [id, feedback] of washingFeedback) if (now >= feedback.until) washingFeedback.delete(id);
    tickWashing();
    const stations = ctx.stations?.() ?? [];
    updateDishwasherPreviews(stations);
    for (const station of stations) {
      if (!KINDS.has(station.typeId)) continue;
      const block = loadedStation(station);
      if (!block) {
        clocks.delete(station.id);
        initializedStoves.delete(station.id);
        if (station.typeId === FRIDGE) resetFridgeSessions(station);
        continue;
      }
      const delta = Math.max(0, Math.min(20, now - (clocks.get(station.id) ?? now)));
      clocks.set(station.id, now);
      try {
        if (station.typeId === STOVE && !initializedStoves.has(station.id)) {
          initializeStoveFire(data(station));
          initializedStoves.add(station.id);
        }
        if (station.typeId === STOVE && delta) tickStove(station, delta);
        else if (station.typeId === DISHWASHER && delta) { tickDishwasher(station, delta); updateVisual(station); }
        if (station.typeId === FRIDGE) {
          try { nativeFridge.ensure(station); }
          catch (error) {
            // Storage recovery failures must not retain an unreadable half's
            // viewers/motion or its shared root on the still-loaded half.
            console.warn(`[OrderToCook] ${station.id}: ${String(error)}`);
          }
          tickFridge(station, delta);
        }
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
    gameWorld.afterEvents.blockContainerOpened.subscribe(onContainerOpened);
    gameWorld.afterEvents.blockContainerClosed.subscribe(onContainerClosed);
    gameWorld.afterEvents.playerLeave.subscribe(event => {
      stopWashing(event.playerId, false);
      washingFeedback.delete(event.playerId);
      storageForms.delete(event.playerId);
      stoveControls.forgetPlayer(event.playerId);
      for (const compartments of viewers.values()) {
        compartments.lower.delete(event.playerId);
        compartments.upper.delete(event.playerId);
      }
    });
  }

  return { init, tick, onPlace, onInteract, onBreak, getStorage, countFood, consumeFood, getInspection, getWashingProgress,
    canOpenFridge, onContainerOpened, onContainerClosed, normalizeBlock: normalizeApplianceBlock };
}
