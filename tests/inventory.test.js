// SPDX-License-Identifier: GPL-3.0-only
// Runs the production inventory helpers unchanged except for their single
// Minecraft import. The in-memory adapter models ItemStack cloning, metadata,
// stack limits, partial writes and container failures; it does not mock the
// production payment/extraction algorithms themselves.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const inventorySource = await readFile(new URL("../runtime/BP/scripts/inventory.js", import.meta.url), "utf8");
const importLine = /^import \{ ItemStack \} from '@minecraft\/server';$/m;
assert.match(inventorySource, importLine, "update the explicit Minecraft import adapter if the production import changes");
const stackAdapter = `
class ItemStack {
  constructor(typeId, amount = 1) {
    if (typeof typeId !== "string" || !typeId.includes(":")) throw new Error("Invalid item ID");
    this.typeId = typeId;
    this.maxAmount = typeId === "test:unstackable" ? 1 : 64;
    this.nameTag = undefined;
    this.data = {};
    this.lore = [];
    this.amount = amount;
  }
  get amount() { return this._amount; }
  set amount(value) {
    if (!Number.isInteger(value) || value < 1 || value > this.maxAmount) throw new Error("Invalid stack amount");
    this._amount = value;
  }
  clone() {
    const next = new ItemStack(this.typeId, this.amount);
    next.nameTag = this.nameTag;
    next.data = structuredClone(this.data);
    next.lore = [...this.lore];
    return next;
  }
  isStackableWith(other) {
    return this.maxAmount > 1 && this.typeId === other.typeId &&
      this.nameTag === other.nameTag &&
      JSON.stringify(this.data) === JSON.stringify(other.data) &&
      JSON.stringify(this.lore) === JSON.stringify(other.lore);
  }
}
`;
const moduleSource = inventorySource.replace(importLine, stackAdapter)
  .replace("'./senluo_food.js'", JSON.stringify(new URL('../runtime/BP/scripts/senluo_food.js', import.meta.url).href)) + "\nexport { ItemStack as TestItemStack };";
const api = await import("data:text/javascript;base64," + Buffer.from(moduleSource).toString("base64"));
const {
  TestItemStack: Stack, countItem, planExtraction, applyExtraction,
  restoreExtraction, consumeHeld, payCoins, coinBalance, giveCoins, giveItems
} = api;

class Container {
  constructor(slots) {
    this.size = slots.length;
    this.slots = slots.map(item => item?.clone());
    this.writes = 0;
    this.reads = 0;
    this.failBefore = new Set();
    this.failAfter = new Set();
  }
  getItem(slot) {
    this.reads++;
    this.onRead?.(slot, this.reads);
    return this.slots[slot]?.clone();
  }
  setItem(slot, stack) {
    this.writes++;
    if (this.failBefore.has(this.writes)) throw new Error("Injected write failure before mutation");
    this.slots[slot] = stack?.clone();
    if (this.failAfter.has(this.writes)) throw new Error("Injected write failure after mutation");
  }
  addItem(stack) {
    let remaining = stack.amount;
    for (let slot = 0; slot < this.size && remaining; slot++) {
      const existing = this.slots[slot];
      if (!existing?.isStackableWith(stack)) continue;
      const count = Math.min(remaining, existing.maxAmount - existing.amount);
      if (count) { existing.amount += count; remaining -= count; }
    }
    for (let slot = 0; slot < this.size && remaining; slot++) {
      if (this.slots[slot]) continue;
      const next = stack.clone();
      next.amount = Math.min(remaining, next.maxAmount);
      this.slots[slot] = next;
      remaining -= next.amount;
    }
    if (!remaining) return undefined;
    const leftover = stack.clone();
    leftover.amount = remaining;
    return leftover;
  }
}
function playerWith(slots) {
  const inventory = new Container(slots);
  const drops = [];
  const player = {
    inventory, drops, selectedSlotIndex: 0, location: { x: 0, y: 64, z: 0 },
    getComponent: id => id === "minecraft:inventory" ? { container: inventory } : undefined,
    dimension: { spawnItem: stack => { drops.push(stack.clone()); return {}; } }
  };
  return player;
}
function coin(value, amount = 1, name) {
  const stack = new Stack("ordertocook:chef_coin_" + value, amount);
  if (name) {
    stack.nameTag = name;
    stack.lore = ["original lore"];
    stack.data = { origin: "metadata must survive" };
  }
  return stack;
}
function state(container) {
  return JSON.stringify(container.slots.map(stack => stack ? {
    typeId: stack.typeId, amount: stack.amount, nameTag: stack.nameTag,
    data: stack.data, lore: stack.lore
  } : null));
}
function expectedFailure(action) {
  const warn = console.warn;
  console.warn = () => {};
  try { return action(); } finally { console.warn = warn; }
}
function allCoinValue(player) {
  const value = stack => Number(stack.typeId.split("_").at(-1)) * stack.amount;
  return coinBalance(player) + player.drops.filter(stack => stack.typeId.startsWith("ordertocook:chef_coin_")).reduce((sum, stack) => sum + value(stack), 0);
}

test("duplicate container references cannot inflate item availability", () => {
  const container = new Container([new Stack("minecraft:bread", 4)]);
  assert.equal(countItem([container, container], "minecraft:bread"), 4);
  const plan = planExtraction([container, container], [{ typeId: "minecraft:bread", amount: 5 }]);
  assert.equal(plan.ok, false);
  assert.equal(applyExtraction(plan), false);
  assert.equal(container.getItem(0).amount, 4);
});

test("duplicate ingredient requirements aggregate before any extraction", () => {
  const container = new Container([new Stack("minecraft:bread", 6)]);
  const plan = planExtraction([container], [
    { typeId: "minecraft:bread", amount: 2 }, { typeId: "minecraft:bread", amount: 3 }
  ]);
  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.equal(applyExtraction(plan), true);
  assert.equal(container.getItem(0).amount, 1);
});

test("missing one ingredient leaves every other ingredient untouched", () => {
  const container = new Container([new Stack("minecraft:bread", 10), new Stack("minecraft:carrot", 1)]);
  const before = state(container);
  const plan = planExtraction([container], [
    { typeId: "minecraft:bread", amount: 3 }, { typeId: "minecraft:carrot", amount: 2 }
  ]);
  assert.equal(plan.ok, false);
  assert.equal(applyExtraction(plan), false);
  assert.equal(state(container), before);
  assert.equal(container.writes, 0);
});

test("negative, fractional and unsafe ingredient counts cannot create or delete items", () => {
  const container = new Container([new Stack("minecraft:bread", 10)]);
  for (const amount of [-1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.equal(planExtraction([container], [{ typeId: "minecraft:bread", amount }]).ok, false);
  }
  assert.equal(container.getItem(0).amount, 10);
  assert.equal(container.writes, 0);
});

test("stale extraction plans validate all source slots before the first write", () => {
  const container = new Container([new Stack("minecraft:bread", 5), new Stack("minecraft:carrot", 5)]);
  const plan = planExtraction([container], [
    { typeId: "minecraft:bread", amount: 2 }, { typeId: "minecraft:carrot", amount: 2 }
  ]);
  container.slots[1].amount = 4;
  assert.equal(applyExtraction(plan), false);
  assert.equal(container.getItem(0).amount, 5);
  assert.equal(container.writes, 0);
});

for (const afterWrite of [false, true]) {
  test("extraction rolls back when a later write throws " + (afterWrite ? "after mutation" : "before mutation"), () => {
    const bread = new Stack("minecraft:bread", 5);
    bread.nameTag = "A particular stack";
    bread.data = { unique: 42 };
    const container = new Container([bread, new Stack("minecraft:carrot", 5)]);
    const before = state(container);
    const plan = planExtraction([container], [
      { typeId: "minecraft:bread", amount: 2 }, { typeId: "minecraft:carrot", amount: 2 }
    ]);
    (afterWrite ? container.failAfter : container.failBefore).add(2);
    assert.equal(expectedFailure(() => applyExtraction(plan)), false);
    assert.equal(state(container), before);
  });
}

test("successful extraction and explicit restoration preserve stack metadata", () => {
  const bread = new Stack("minecraft:bread", 5);
  bread.nameTag = "Custom meal";
  bread.lore = ["Kitchen A"];
  bread.data = { recipe: "special" };
  const container = new Container([bread]);
  const before = state(container);
  const plan = planExtraction([container], [{ typeId: "minecraft:bread", amount: 2 }]);
  assert.equal(applyExtraction(plan), true);
  assert.equal(container.getItem(0).nameTag, bread.nameTag);
  assert.deepEqual(container.getItem(0).data, bread.data);
  restoreExtraction(plan);
  assert.equal(state(container), before);
});

test("consumeHeld rejects a negative amount instead of increasing the held stack", () => {
  const player = playerWith([new Stack("minecraft:leather", 3)]);
  assert.equal(consumeHeld(player, "minecraft:leather", -2), false);
  assert.equal(consumeHeld(player, "minecraft:leather", 0.5), false);
  assert.equal(player.inventory.getItem(0).amount, 3);
  assert.equal(consumeHeld(player, "minecraft:leather", 2), true);
  assert.equal(player.inventory.getItem(0).amount, 1);
});

test("mixed coin denominations pay an exact value and retain unrelated metadata", () => {
  const player = playerWith([coin(1, 2), coin(5), coin(20, 2), coin(100, 1, "Savings"), undefined]);
  const oldSavings = player.inventory.getItem(3);
  const initialValue = coinBalance(player);
  assert.equal(initialValue, 147);
  assert.equal(payCoins(player, 31), true);
  assert.equal(coinBalance(player), 116);
  assert.equal(player.inventory.getItem(3).nameTag, oldSavings.nameTag);
  assert.deepEqual(player.inventory.getItem(3).data, oldSavings.data);
  assert.equal(player.drops.length, 0);
});

test("a full inventory can receive change in the slot freed by paying", () => {
  const player = playerWith([coin(5), new Stack("minecraft:diamond", 64)]);
  player.dimension.spawnItem = () => { throw new Error("World drops must never be used for change"); };
  assert.equal(payCoins(player, 2), true);
  assert.equal(coinBalance(player), 3);
  assert.equal(player.inventory.getItem(0).typeId, "ordertocook:chef_coin_1");
  assert.equal(player.inventory.getItem(0).amount, 3);
  assert.equal(player.inventory.getItem(1).amount, 64);
});

test("if all change cannot fit, the payment performs zero writes and keeps the original coins", () => {
  const player = playerWith([coin(100, 2), new Stack("minecraft:diamond", 64)]);
  const before = state(player.inventory);
  assert.equal(payCoins(player, 2), false);
  assert.equal(state(player.inventory), before);
  assert.equal(player.inventory.writes, 0);
  assert.equal(player.drops.length, 0);
});

test("one freed slot is insufficient when the change requires multiple item types", () => {
  const player = playerWith([coin(100)]);
  const before = state(player.inventory);
  assert.equal(payCoins(player, 1), false);
  assert.equal(state(player.inventory), before);
  assert.equal(coinBalance(player), 100);
});

test("an exact payment needs no change capacity", () => {
  const player = playerWith([coin(100), new Stack("minecraft:diamond", 64)]);
  assert.equal(payCoins(player, 100), true);
  assert.equal(player.inventory.getItem(0), undefined);
  assert.equal(player.inventory.getItem(1).amount, 64);
  assert.equal(player.drops.length, 0);
});

test("insufficient funds and invalid costs leave the inventory unchanged", () => {
  const player = playerWith([coin(1)]);
  const before = state(player.inventory);
  for (const cost of [2, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.equal(payCoins(player, cost), false);
    assert.equal(state(player.inventory), before);
  }
  assert.equal(payCoins(player, 0), true);
  assert.equal(player.inventory.writes, 0);
});

for (const afterWrite of [false, true]) {
  test("coin payment restores all originals when writing change fails " + (afterWrite ? "after mutation" : "before mutation"), () => {
    const player = playerWith([coin(100, 1, "Original savings"), undefined, undefined, undefined]);
    const before = state(player.inventory);
    (afterWrite ? player.inventory.failAfter : player.inventory.failBefore).add(2);
    assert.equal(expectedFailure(() => payCoins(player, 2)), false);
    assert.equal(state(player.inventory), before);
    assert.equal(coinBalance(player), 100);
    assert.equal(player.drops.length, 0);
  });
}

test("partial coin consumption preserves the original coin stack's custom data", () => {
  const player = playerWith([coin(100, 2, "Restaurant reserve")]);
  const before = player.inventory.getItem(0);
  assert.equal(payCoins(player, 100), true);
  const after = player.inventory.getItem(0);
  assert.equal(after.amount, 1);
  assert.equal(after.nameTag, before.nameTag);
  assert.deepEqual(after.data, before.data);
  assert.deepEqual(after.lore, before.lore);
});

test("a same-count coin stack changed after the snapshot is rejected by metadata validation", () => {
  const player = playerWith([coin(5, 1, "Before"), undefined]);
  player.inventory.onRead = (slot, readCount) => {
    if (readCount === 3) player.inventory.slots[0].nameTag = "Changed by another operation";
  };
  assert.equal(payCoins(player, 2), false);
  assert.equal(player.inventory.writes, 0);
  assert.equal(player.inventory.slots[0].nameTag, "Changed by another operation");
  assert.equal(player.inventory.slots[0].amount, 1);
});

test("coin rewards preserve exact value when normal inventory overflow is dropped", () => {
  const player = playerWith([new Stack("minecraft:diamond", 64)]);
  giveCoins(player, 10126);
  assert.equal(allCoinValue(player), 10126);
  assert.ok(player.drops.every(stack => stack.amount <= stack.maxAmount));
});

test("generic rewards respect an unstackable item's actual maximum", () => {
  const player = playerWith([undefined, undefined, undefined]);
  giveItems(player, "test:unstackable", 3);
  assert.ok(player.inventory.slots.every(stack => stack.amount === 1));
  assert.equal(player.drops.length, 0);
});

