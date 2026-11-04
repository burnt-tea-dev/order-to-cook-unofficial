// SPDX-License-Identifier: GPL-3.0-only
// Native block inventories own all cargo. This adapter only joins their slots
// for existing order extraction and migrates the former 81-slot helper once.
export const FRIDGE_LOWER = "ordertocook:refrigerator";
export const FRIDGE_UPPER = "ordertocook:refrigerator_upper";

export function isFridge(block) {
  return block?.typeId === FRIDGE_LOWER || block?.typeId === FRIDGE_UPPER;
}

export function isUpperFridge(block) {
  return block?.typeId === FRIDGE_UPPER ||
    (block?.typeId === FRIDGE_LOWER && block.permutation.getState("ordertocook:half") === "upper");
}

/** Preserve the old extraction ordering: upper 0..26, lower 27..80. */
export function joinedFridgeInventory(upper, lower) {
  const locate = index => {
    if (!Number.isInteger(index) || index < 0 || index >= 81) throw new RangeError("Invalid refrigerator slot");
    return index < 27 ? [upper, index] : [lower, index - 27];
  };
  return {
    size: 81,
    get isValid() { return upper.isValid && lower.isValid; },
    get emptySlotsCount() { return upper.emptySlotsCount + lower.emptySlotsCount; },
    getItem(index) { const [container, slot] = locate(index); return container.getItem(slot); },
    setItem(index, stack) { const [container, slot] = locate(index); container.setItem(slot, stack); },
  };
}

export function createNativeFridgeStorage(ctx) {
  const joined = new Map();

  function parts(station) {
    const lower = ctx.loadedBlock(station);
    if (lower?.typeId !== FRIDGE_LOWER || isUpperFridge(lower)) return undefined;
    const upper = lower.dimension.getBlock({ ...lower.location, y: lower.location.y + 1 });
    if (upper?.typeId !== FRIDGE_UPPER) return undefined;
    const lowerInventory = lower.getComponent("minecraft:inventory")?.container;
    const upperInventory = upper.getComponent("minecraft:inventory")?.container;
    if (!lowerInventory?.isValid || !upperInventory?.isValid || lowerInventory.size !== 54 || upperInventory.size !== 27) return undefined;
    return { lower, upper, lowerInventory, upperInventory };
  }

  /** Read-only: safe in before events and the HUD; never creates or moves cargo. */
  function peek(station) {
    if (!station?.nativeFridge || station.storageId) return undefined;
    let current;
    try { current = parts(station); } catch { return undefined; }
    if (!current) { joined.delete(station.id); return undefined; }
    // Block state animation preserves the underlying block entity. Refresh a
    // wrapper only when the saved handles become invalid after chunk unloading.
    let inventory = joined.get(station.id);
    if (!inventory?.isValid) {
      inventory = joinedFridgeInventory(current.upperInventory, current.lowerInventory);
      joined.set(station.id, inventory);
    }
    return inventory;
  }

  function ensure(station) {
    const existing = peek(station);
    if (existing) return existing;
    const lower = ctx.loadedBlock(station);
    if (lower?.typeId !== FRIDGE_LOWER || isUpperFridge(lower)) return undefined;
    const lowerInventory = lower.getComponent("minecraft:inventory")?.container;
    if (!lowerInventory?.isValid || lowerInventory.size !== 54) return undefined;
    const upper = lower.dimension.getBlock({ ...lower.location, y: lower.location.y + 1 });
    if (upper?.typeId === FRIDGE_LOWER && isUpperFridge(upper)) {
      // A pre-native upper half has no cargo of its own. Never replace a block
      // someone has filled through commands: replacing an ID spills its cargo.
      const previous = upper.getComponent("minecraft:inventory")?.container;
      if (previous && previous.emptySlotsCount !== previous.size) {
        throw new Error("舊冰箱上半部含有額外庫存，已保留原物品；請先清空該半部再升級。");
      }
      ctx.placeUpper(lower, upper);
    }
    const current = parts(station);
    if (!current) return undefined;
    const helper = ctx.findLegacy(station);
    if (station.storageId && !helper) return undefined; // Saved helper may still be loading.
    if (helper) {
      const source = helper.getComponent("minecraft:inventory")?.container;
      if (!source?.isValid || source.size !== 81) return undefined;
      // Each native move clears its source in the same engine call. A partial
      // migration resumes only the remaining source slots after an interruption.
      for (let slot = 0; slot < 81; slot++) {
        if (!source.getItem(slot)) continue;
        const destination = slot < 27 ? current.upperInventory : current.lowerInventory;
        const targetSlot = slot < 27 ? slot : slot - 27;
        if (destination.getItem(targetSlot)) throw new Error("冰箱遷移目的格已有物品；兩邊實物均保留，未覆寫。");
        source.moveItem(slot, targetSlot, destination);
      }
    }
    const beforeId = station.storageId;
    const beforeNative = station.nativeFridge;
    station.nativeFridge = true;
    delete station.storageId;
    try { ctx.saveStation(station); }
    catch (error) {
      station.storageId = beforeId;
      station.nativeFridge = beforeNative;
      throw error;
    }
    // Only retire the empty old helper after the station points at native cargo.
    if (helper?.isValid) helper.remove();
    joined.delete(station.id);
    return peek(station);
  }

  return { ensure, peek, forget: station => joined.delete(station.id) };
}
