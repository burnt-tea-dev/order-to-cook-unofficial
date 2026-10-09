// SPDX-License-Identifier: GPL-3.0-only
import { ItemStack } from '@minecraft/server';

export function containerOf(entity) { return entity.getComponent('minecraft:inventory')?.container; }
export function heldItem(player) { return containerOf(player)?.getItem(player.selectedSlotIndex); }
export function freeSlot(container) {
  if (!container) return -1;
  for (let slot = 0; slot < container.size; slot++) if (!container.getItem(slot)) return slot;
  return -1;
}
export function countItem(containers, typeId) {
  let count = 0;
  for (const container of new Set(containers.filter(Boolean))) for (let slot = 0; slot < container.size; slot++) {
    const stack = container.getItem(slot);
    if (stack?.typeId === typeId) count += stack.amount;
  }
  return count;
}

/** Build and validate the entire extraction before changing a single slot. */
export function planExtraction(containers, requirements) {
  const requested = new Map();
  for (const item of requirements) {
    if (typeof item.typeId !== 'string' || !item.typeId || !Number.isSafeInteger(item.amount) || item.amount < 1) return { ok: false, missing: ['invalid amount or item'], actions: [] };
    const total = (requested.get(item.typeId) || 0) + item.amount;
    if (!Number.isSafeInteger(total)) return { ok: false, missing: ['invalid amount'], actions: [] };
    requested.set(item.typeId, total);
  }
  const actions = [];
  const missing = [];
  for (const [typeId, amount] of requested) {
    let remaining = amount;
    for (const container of [...new Set(containers.filter(Boolean))]) {
      for (let slot = 0; slot < container.size && remaining > 0; slot++) {
        const stack = container.getItem(slot);
        if (stack?.typeId !== typeId) continue;
        const take = Math.min(remaining, stack.amount);
        actions.push({ container, slot, before: stack, take });
        remaining -= take;
      }
    }
    if (remaining) missing.push(`${typeId} ×${remaining}`);
  }
  return { ok: missing.length === 0, missing, actions };
}

export function applyExtraction(plan) {
  if (!plan.ok) return false;
  const applied = [];
  try {
    for (const action of plan.actions) {
      const current = action.container.getItem(action.slot);
      if (!current || current.typeId !== action.before.typeId || current.amount !== action.before.amount) return false;
    }
    for (const action of plan.actions) {
      const next = action.before.clone();
      // Include the attempted write in rollback even if a container implementation
      // throws after accepting the new value.
      applied.push(action);
      if (next.amount === action.take) action.container.setItem(action.slot, undefined);
      else { next.amount -= action.take; action.container.setItem(action.slot, next); }
    }
    return true;
  } catch (error) {
    for (const action of applied.reverse()) {
      try { action.container.setItem(action.slot, action.before); }
      catch (rollbackError) { console.warn(`[OrderToCook] Extraction rollback failed: ${rollbackError}`); }
    }
    console.warn(`[OrderToCook] Extraction failed: ${error}`);
    return false;
  }
}
export function restoreExtraction(plan) {
  for (const action of plan.actions) action.container.setItem(action.slot, action.before);
}
export function consumeHeld(player, typeId, amount = 1) {
  if (!Number.isSafeInteger(amount) || amount < 1) return false;
  const container = containerOf(player);
  const stack = container?.getItem(player.selectedSlotIndex);
  if (!stack || stack.typeId !== typeId || stack.amount < amount) return false;
  if (stack.amount === amount) container.setItem(player.selectedSlotIndex, undefined);
  else { stack.amount -= amount; container.setItem(player.selectedSlotIndex, stack); }
  return true;
}
export function giveStack(player, stack) {
  const container = containerOf(player);
  const leftover = container ? container.addItem(stack) : stack;
  if (leftover) player.dimension.spawnItem(leftover, player.location);
}
export function giveItems(player, typeId, amount) {
  while (amount > 0) {
    const stack = new ItemStack(typeId);
    stack.amount = Math.min(amount, stack.maxAmount);
    giveStack(player, stack);
    amount -= stack.amount;
  }
}

const COINS = [10000, 100, 20, 5, 1];
export function coinBalance(player) {
  const container = containerOf(player);
  return COINS.reduce((total, value) => total + countItem([container], `ordertocook:chef_coin_${value}`) * value, 0);
}
export function giveCoins(player, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid coin value');
  for (const coin of COINS) {
    const count = Math.floor(value / coin);
    if (count) giveItems(player, `ordertocook:chef_coin_${coin}`, count);
    value %= coin;
  }
}
export function payCoins(player, cost) {
  if (!Number.isSafeInteger(cost) || cost < 0) return false;
  if (cost === 0) return true;
  const container = containerOf(player);
  if (!container) return false;
  const before = [];
  const after = [];
  const changed = new Set();
  const applied = [];
  try {
    // Snapshot every slot, including item metadata. Simulate the entire payment
    // and change before writing anything to the real inventory.
    for (let slot = 0; slot < container.size; slot++) {
      const stack = container.getItem(slot);
      before.push(stack?.clone());
      after.push(stack?.clone());
    }
    let remaining = cost;
    for (const value of [...COINS].reverse()) {
      if (remaining <= 0) break;
      const typeId = `ordertocook:chef_coin_${value}`;
      for (let slot = 0; slot < after.length && remaining > 0; slot++) {
        const stack = after[slot];
        if (stack?.typeId !== typeId) continue;
        const take = Math.min(stack.amount, Math.ceil(remaining / value));
        remaining -= take * value;
        if (stack.amount === take) after[slot] = undefined;
        else stack.amount -= take;
        changed.add(slot);
      }
    }
    if (remaining > 0) return false;

    let change = -remaining;
    for (const value of COINS) {
      let count = Math.floor(change / value);
      change %= value;
      if (!count) continue;
      const template = new ItemStack(`ordertocook:chef_coin_${value}`);
      // isStackableWith compares custom data too: named/lore-bearing coins must
      // not silently lose metadata when ordinary change is merged into them.
      for (let slot = 0; slot < after.length && count > 0; slot++) {
        const stack = after[slot];
        if (!stack || !stack.isStackableWith(template)) continue;
        const add = Math.min(count, stack.maxAmount - stack.amount);
        if (add <= 0) continue;
        stack.amount += add;
        count -= add;
        changed.add(slot);
      }
      for (let slot = 0; slot < after.length && count > 0; slot++) {
        if (after[slot]) continue;
        const stack = template.clone();
        stack.amount = Math.min(count, stack.maxAmount);
        after[slot] = stack;
        count -= stack.amount;
        changed.add(slot);
      }
      // Change is never dropped into the world. Capacity failure leaves every
      // original coin untouched, including coins that would have freed a slot.
      if (count > 0) return false;
    }

    // Only changed slots are written. They contained coins or were empty; all
    // unrelated tools and their component data remain untouched.
    for (const slot of changed) {
      const current = container.getItem(slot);
      const original = before[slot];
      if (!original) { if (current) return false; }
      else if (!current || current.typeId !== original.typeId || current.amount !== original.amount || !current.isStackableWith(original)) return false;
    }
    for (const slot of changed) {
      applied.push(slot);
      container.setItem(slot, after[slot]);
    }
    return true;
  } catch (error) {
    for (const slot of applied.reverse()) {
      try { container.setItem(slot, before[slot]); }
      catch (rollbackError) { console.warn(`[OrderToCook] Payment rollback failed: ${rollbackError}`); }
    }
    console.warn(`[OrderToCook] Payment failed: ${error}`);
    return false;
  }
}
