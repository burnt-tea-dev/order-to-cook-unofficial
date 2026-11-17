// SPDX-License-Identifier: GPL-3.0-only
// The native seven-slot block inventory is the only live stove cargo owner.
// This adapter adopts the former helper without reconstructing ItemStacks.
export const STOVE_SLOT_COUNT = 7;

export function createNativeStoveStorage(ctx) {
  function inventory(station) {
    const block = ctx.loadedBlock(station);
    if (block?.typeId !== 'ordertocook:stove') return undefined;
    const container = block.getComponent('minecraft:inventory')?.container;
    return container?.isValid && container.size === STOVE_SLOT_COUNT ? container : undefined;
  }

  /** Read-only, including when called from the native before-interact event. */
  function peek(station) {
    if (!station?.nativeStove || station.storageId) return undefined;
    try { return inventory(station); } catch { return undefined; }
  }

  function ensure(station) {
    const existing = peek(station);
    if (existing) return existing;
    const target = inventory(station);
    if (!target) return undefined;
    const helper = ctx.findLegacy(station);
    if (station.storageId && !helper) return undefined;
    if (helper) {
      const source = helper.getComponent('minecraft:inventory')?.container;
      if (!source?.isValid || source.size < STOVE_SLOT_COUNT) return undefined;
      // The generic old helper had 81 slots, but the stove owned only 0..6.
      // Unexpected cargo cannot fit the seven-slot destination; keep it intact.
      for (let slot = STOVE_SLOT_COUNT; slot < source.size; slot++) {
        if (source.getItem(slot)) throw new Error('舊爐灶輔助庫存有額外物品，已保留兩邊庫存，未切換容器。');
      }
      for (let slot = 0; slot < STOVE_SLOT_COUNT; slot++) {
        const stack = source.getItem(slot);
        if (!stack) continue;
        if (target.getItem(slot)) throw new Error('爐灶遷移目的格已有物品；兩邊實物均保留，未覆寫。');
        const expected = ctx.fingerprint(stack);
        source.moveItem(slot, slot, target);
        if (source.getItem(slot) || ctx.fingerprint(target.getItem(slot)) !== expected) {
          throw new Error('爐灶遷移讀回不一致，已保留原輔助庫存及原生容器，未完成切換。');
        }
      }
      if (source.emptySlotsCount !== source.size) return undefined;
    }
    const beforeId = station.storageId;
    const beforeNative = station.nativeStove;
    station.nativeStove = true;
    delete station.storageId;
    try { ctx.saveStation(station); }
    catch (error) {
      station.storageId = beforeId;
      station.nativeStove = beforeNative;
      throw error;
    }
    // Native moves cleared the old cargo; retire it only after the owner saves.
    if (helper?.isValid) helper.remove();
    return peek(station);
  }

  return { ensure, peek };
}
