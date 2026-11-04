// SPDX-License-Identifier: GPL-3.0-only
// Interaction adapter only: recipes, burn time and cooking remain in appliances.js.

const INPUTS = [0, 1, 2];
const OUTPUTS = [4, 5, 6];
const ALL_SLOTS = [0, 1, 2, 3, 4, 5, 6];
const LABELS = ["食材 1", "食材 2", "食材 3", "燃料", "成品 1", "成品 2", "成品 3"];

/**
 * Single-screen controls over the existing seven real inventory slots.
 * Minecraft objects and UI are injected so the actual interaction can be tested
 * without replacing the cooking service or inventing a second inventory owner.
 */
export function createStoveControls(ctx) {
  const sessions = new Map();
  const slotsOf = container => Array.from({ length: container.size }, (_, slot) => slot);
  const snapshot = (container, slots) => slots.map(slot => ({ slot, stack: container.getItem(slot) }));
  const matches = (container, entries) => entries.every(entry =>
    ctx.fingerprint(container.getItem(entry.slot)) === ctx.fingerprint(entry.stack));
  const destinations = stack => ctx.isFuel(stack) ? [3] : ctx.isIngredient(stack) ? INPUTS : undefined;

  // This temporary plan contains cloned stacks only. The native containers remain
  // authoritative; no inventory is serialized or stored in a form response.
  function previewPlacement(preview, stack, slots) {
    const capacity = slots.reduce((sum, slot) => {
      const stored = preview.get(slot);
      return sum + (!stored ? stack.maxAmount : stored.isStackableWith(stack) ? stored.maxAmount - stored.amount : 0);
    }, 0);
    if (capacity < stack.amount) return false;
    let remaining = stack.amount;
    for (const emptyPass of [false, true]) {
      for (const slot of slots) {
        if (!remaining) break;
        const stored = preview.get(slot);
        if (emptyPass ? !!stored : !stored || !stored.isStackableWith(stack)) continue;
        const amount = Math.min(remaining, stored ? stored.maxAmount - stored.amount : stack.maxAmount);
        if (amount <= 0) continue;
        const next = stored ? stored.clone() : stack.clone();
        next.amount = (stored?.amount ?? 0) + amount;
        preview.set(slot, next);
        remaining -= amount;
      }
    }
    return true;
  }

  function refillPlan(inventory, stove) {
    const preview = new Map(snapshot(stove, [0, 1, 2, 3]).map(entry => [entry.slot, entry.stack]));
    const entries = [];
    for (let slot = 0; slot < inventory.size; slot++) {
      const stack = inventory.getItem(slot);
      if (!stack) continue;
      const targetSlots = destinations(stack);
      if (targetSlots && previewPlacement(preview, stack, targetSlots)) entries.push({ slot, stack, targetSlots });
    }
    return entries;
  }

  function moveBatch(source, target, entries, targetSlots) {
    if (!entries.length) return { ok: false, message: "沒有可移動的物品。" };
    if (!matches(source, entries)) return { ok: false, message: "物品已改變，請在更新後的畫面重新操作。" };
    const targetBefore = snapshot(target, targetSlots);
    const preview = new Map(targetBefore.map(entry => [entry.slot, entry.stack]));
    for (const entry of entries) {
      if (!previewPlacement(preview, entry.stack, entry.targetSlots ?? targetSlots)) {
        return { ok: false, message: "空間不足；這批物品全部留在原處。" };
      }
    }
    // No awaits occur between validation and commit. A failed later transfer must
    // also restore earlier transfers in this batch, including all native metadata.
    try {
      for (const entry of entries) {
        const result = ctx.transferStackToRange(source, entry.slot, target, entry.targetSlots ?? targetSlots, entry.stack);
        if (!result.ok) throw new Error(result.message);
      }
    } catch (error) {
      for (const entry of targetBefore) target.setItem(entry.slot, entry.stack);
      for (const entry of entries) source.setItem(entry.slot, entry.stack);
      throw error;
    }
    return { ok: true, message: `已移動 ${entries.reduce((sum, entry) => sum + entry.stack.amount, 0)} 件物品。` };
  }

  // Keep direct controls and cooking-state persistence in the same synchronous
  // transaction. A save failure restores both native inventories and lets the
  // cooking owner restore its input fingerprint/progress, without another store.
  function commitChange(station, stove, inventory, transfer) {
    const beforeStove = snapshot(stove, ALL_SLOTS);
    const beforePlayer = snapshot(inventory, slotsOf(inventory));
    try {
      const result = transfer();
      if (result.ok) ctx.onChange?.(station, stove);
      return result;
    } catch (error) {
      for (const entry of beforeStove) stove.setItem(entry.slot, entry.stack);
      for (const entry of beforePlayer) inventory.setItem(entry.slot, entry.stack);
      throw error;
    }
  }

  async function interact(player, station) {
    if (sessions.has(player.id) || !player.isValid || !ctx.isAccessible(player, station)) return;
    const session = { player, station };
    sessions.set(player.id, session);
    const accessible = () => sessions.get(player.id) === session && player.isValid && ctx.isAccessible(player, station);
    try {
      const initialStove = ctx.getStorage(station), initialInventory = ctx.playerInventory(player);
      if (!initialStove?.isValid || !initialInventory?.isValid) {
        ctx.notify(player, "爐灶庫存尚未載入，請稍後重試。");
        return;
      }
      const held = initialInventory.getItem(player.selectedSlotIndex);
      const targetSlots = held && destinations(held);
      if (targetSlots) {
        const result = commitChange(station, initialStove, initialInventory, () =>
          ctx.transferStackToRange(initialInventory, player.selectedSlotIndex, initialStove, targetSlots, held));
        ctx.notify(player, result.message);
        return;
      }

      while (accessible()) {
        const stove = ctx.getStorage(station), inventory = ctx.playerInventory(player);
        if (!stove?.isValid || !inventory?.isValid) return;
        const contents = snapshot(stove, ALL_SLOTS);
        const refill = refillPlan(inventory, stove);
        const progress = ctx.getProgress(station);
        const outputCount = contents.filter(entry => OUTPUTS.includes(entry.slot))
          .reduce((sum, entry) => sum + (entry.stack?.amount ?? 0), 0);
        const ingredientCount = refill.filter(entry => entry.targetSlots[0] !== 3)
          .reduce((sum, entry) => sum + entry.stack.amount, 0);
        const fuelCount = refill.filter(entry => entry.targetSlots[0] === 3)
          .reduce((sum, entry) => sum + entry.stack.amount, 0);
        const form = ctx.makeForm().title("三槽爐灶").body(
          `手持食材或燃料點擊爐灶可直接存入整疊。\n點格子直接取回；一鍵補料只加入可容納的整疊。\n進度 ${Math.min(100, Math.floor(progress.cookProgress / 2))}% · 剩餘燃燒 ${Math.ceil(progress.litTime / 20)} 秒`
        );
        for (const entry of contents) form.button(
          `${LABELS[entry.slot]} · ${entry.stack ? "取出" : "空"}\n${entry.stack ? `${ctx.itemLabel(entry.stack)} × ${entry.stack.amount}` : "—"}`
        );
        form.button(`收取全部成品 · ${outputCount} 件`)
          .button(`一鍵補料 · 食材 ${ingredientCount}／燃料 ${fuelCount} 件`)
          .button("刷新狀態").button("關閉");
        const response = await form.show(player);
        if (response.canceled || response.selection === undefined || response.selection === 10 || !accessible()) return;
        const liveStove = ctx.getStorage(station), liveInventory = ctx.playerInventory(player);
        if (!liveStove?.isValid || !liveInventory?.isValid) return;
        const selected = response.selection;
        if (selected >= 0 && selected <= 6) {
          const entry = contents[selected];
          if (!entry.stack) continue;
          if (!matches(liveStove, [entry])) {
            ctx.notify(player, "這一格已改變，請在更新後的畫面重新選擇。");
            continue;
          }
          ctx.notify(player, commitChange(station, liveStove, liveInventory, () =>
            ctx.transferStackToRange(liveStove, selected, liveInventory, undefined, entry.stack)).message);
        } else if (selected === 7) {
          const outputs = contents.filter(entry => OUTPUTS.includes(entry.slot));
          if (!matches(liveStove, outputs)) {
            ctx.notify(player, "成品已改變，請在更新後的畫面重新收取。");
            continue;
          }
          ctx.notify(player, commitChange(station, liveStove, liveInventory, () =>
            moveBatch(liveStove, liveInventory, outputs.filter(entry => entry.stack), slotsOf(liveInventory))).message);
        } else if (selected === 8) {
          if (!matches(liveStove, contents.slice(0, 4)) || !matches(liveInventory, refill)) {
            ctx.notify(player, "食材或燃料已改變，請在更新後的畫面重新補料。");
            continue;
          }
          ctx.notify(player, commitChange(station, liveStove, liveInventory, () =>
            moveBatch(liveInventory, liveStove, refill, [0, 1, 2, 3])).message);
        }
      }
    } catch (error) {
      if (player.isValid) ctx.notify(player, `操作未完成：${String(error)}`);
    } finally {
      if (sessions.get(player.id) === session) sessions.delete(player.id);
    }
  }

  return {
    interact,
    forgetPlayer: playerId => sessions.delete(playerId),
    forgetStation: stationId => {
      for (const [id, session] of sessions) if (session.station.id === stationId) sessions.delete(id);
    },
    forgetInaccessible: () => {
      for (const [id, session] of sessions) {
        if (!session.player.isValid || !ctx.isAccessible(session.player, session.station)) sessions.delete(id);
      }
    },
  };
}
