// SPDX-License-Identifier: GPL-3.0-only
// Production domain/inventory code; only native ItemStack/container IO is doubled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeFoodIdentity, snapshotMenuFood, menuFoodKey, menuFoodLabel } from '../runtime/BP/scripts/senluo_food.js';
import { normalizeMenu, addMenuFood, removeMenuFood, getMenuNutrition, createRestaurant, generateOrder, acceptOrder } from '../runtime/BP/scripts/core.js';

const scripts = new URL('../runtime/BP/scripts/', import.meta.url);
const source = (await readFile(new URL('inventory.js', scripts), 'utf8'))
  .replace("import { ItemStack } from '@minecraft/server';", 'class ItemStack {}')
  .replace("'./senluo_food.js'", JSON.stringify(new URL('senluo_food.js', scripts).href));
const { planExtraction, applyExtraction, restoreExtraction } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const identity = variant => ({ carrier: 'senluo.public.food.v1', nativeVariant: variant });
const dish = (variant, nutrition = 7) => ({ typeId: 'test:meal', label: '原菜名', nutrition,
  ...(variant === undefined ? {} : { foodIdentity: identity(variant) }) });
const request = (variant, amount) => { const { nutrition, ...food } = dish(variant); return { ...food, amount }; };
class Stack {
  constructor(variant, amount = 3) {
    this.typeId = 'test:meal'; this.amount = amount; this.nameTag = '原菜名'; this.opaque = { preserve: true };
    this.rows = [{ text: 'custom lore' }, { translate: 'senluo.public.food.v1', with: [JSON.stringify({
      v: 1, nativeVariant: variant, hotUntil: 1000, seasoning: [], quality: 0
    })] }];
  }
  getRawLore() { if (this.failRead) throw Error('native read failed'); return structuredClone(this.rows); }
  clone() { const clone = new Stack(); Object.assign(clone, structuredClone(this)); return clone; }
}
class Container {
  constructor(stacks) { this.slots = stacks.map(s => s?.clone()); this.size = this.slots.length; this.writes = 0; }
  getItem(slot) { return this.slots[slot]?.clone(); }
  setItem(slot, value) {
    this.writes++;
    if (this.failWrite === this.writes) throw Error('native write failed');
    this.slots[slot] = value?.clone();
  }
}

for (const variant of [0, 7, 32767]) test(`variant ${variant} is bounded, detached and survives JSON storage`, () => {
  const original = identity(variant), normalized = normalizeFoodIdentity(original);
  assert.deepEqual(normalized, original); assert.notEqual(normalized, original);
  assert.deepEqual(normalizeMenu(JSON.parse(JSON.stringify([dish(variant)]))), [dish(variant)]);
});

test('malformed or unknown variant requirements never become generic requirements', () => {
  for (const value of [null, {}, { carrier: 'other', nativeVariant: 1 }, identity(-1), identity(32768), identity('1'), { ...identity(1), quality: 3 }]) {
    assert.equal(normalizeFoodIdentity(value), null);
    assert.deepEqual(normalizeMenu([{ ...dish(), foodIdentity: value }]), []);
    const container = new Container([new Stack(1)]);
    const plan = planExtraction([container], [{ ...request(undefined, 1), foodIdentity: value }]);
    assert.equal(plan.ok, false); assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
  }
});

test('menu identity ignores heat, seasoning and quality, and does not invent nutrition', () => {
  const stack = new Stack(7, 64), before = structuredClone(stack);
  const a = snapshotMenuFood(stack, dish());
  assert.deepEqual(a, dish(7)); assert.deepEqual(structuredClone(stack), before);
  stack.rows[1].with[0] = JSON.stringify({ v: 1, nativeVariant: 7, hotUntil: 0, seasoning: ['test:salt'], quality: 3 });
  assert.equal(menuFoodKey(snapshotMenuFood(stack, dish())), menuFoodKey(a));
  assert.equal(a.nutrition, 7); assert.equal(getMenuNutrition([a]), 7);
});

test('missing/unsupported metadata retains legacy menu identity; unreadable reads refuse registration', () => {
  assert.deepEqual(snapshotMenuFood({ nameTag: 'legacy' }, dish()), dish());
  const absent = new Stack(); absent.rows = [];
  assert.deepEqual(snapshotMenuFood(absent, dish()), dish());
  absent.rows = [{ translate: 'senluo.public.food.v1', with: ['bad-json'] }];
  assert.deepEqual(snapshotMenuFood(absent, dish()), dish());
  absent.failRead = true;
  assert.equal(snapshotMenuFood(absent, dish()), undefined);
});

test('distinct variants can be menu dishes without duplicate nutrition or generic overlap', () => {
  const restaurant = { menu: [] };
  assert.equal(addMenuFood(restaurant, dish(7)).ok, true);
  assert.equal(addMenuFood(restaurant, dish(8)).ok, true);
  assert.equal(addMenuFood(restaurant, dish(7, 999)).ok, false);
  assert.equal(addMenuFood(restaurant, dish()).ok, false);
  assert.equal(getMenuNutrition(restaurant), 14);
  assert.equal(removeMenuFood(restaurant, 'test:meal', identity(7)).ok, true);
  assert.deepEqual(restaurant.menu, [dish(8)]);
  assert.equal(removeMenuFood(restaurant, 'test:meal').ok, false);
  assert.deepEqual(restaurant.menu, [dish(8)]);
  assert.equal(addMenuFood({ menu: [dish()] }, dish(7)).ok, false);
});

test('order requirement and quote are detached from later menu edits', () => {
  const restaurant = createRestaurant({ menu: [dish(7)], config: { deliveryRate: 0 } }, 100);
  const order = generateOrder(restaurant, 200, () => 0.999);
  assert.equal(acceptOrder(restaurant, order.id, 201).ok, true);
  const saved = JSON.stringify(order);
  restaurant.menu[0].label = '後來的名稱'; restaurant.menu[0].nutrition = 900;
  restaurant.menu[0].foodIdentity.nativeVariant = 8;
  assert.equal(JSON.stringify(order), saved);
  assert.equal(menuFoodLabel(order.items[0], '後來的名稱'), '原菜名 · 變體 7');
});

test('variant-aware extraction skips a same-ID wrong variant and preserves its original stack', () => {
  const container = new Container([new Stack(8), new Stack(7)]), before = structuredClone(container.slots);
  const plan = planExtraction([container], [request(7, 2)]);
  assert.equal(plan.ok, true); assert.equal(applyExtraction(plan), true);
  assert.deepEqual(structuredClone(container.slots[0]), before[0]);
  assert.equal(container.slots[1].amount, 1);
  assert.deepEqual(container.slots[1].rows, before[1].rows);
  assert.deepEqual(container.slots[1].opaque, before[1].opaque);
  restoreExtraction(plan); assert.deepEqual(structuredClone(container.slots), before);
});

test('missing variant reports the exact requirement and changes no slot', () => {
  const container = new Container([new Stack(8, 64)]);
  const plan = planExtraction([container], [request(7, 2)]);
  assert.equal(plan.ok, false); assert.deepEqual(plan.missingFoods, [request(7, 2)]);
  assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
});

test('generic requirements cannot reserve the only matching constrained stack first', () => {
  const container = new Container([new Stack(7, 1), new Stack(8, 1)]);
  const plan = planExtraction([container, container], [request(undefined, 1), request(7, 1)]);
  assert.equal(plan.ok, true); assert.equal(plan.actions.length, 2);
  assert.equal(applyExtraction(plan), true); assert.deepEqual(container.slots, [undefined, undefined]);
});

test('a slot shared by generic and specific lines is reserved/written only once', () => {
  const container = new Container([new Stack(7, 3)]);
  const plan = planExtraction([container], [request(undefined, 1), request(7, 1), request(7, 1)]);
  assert.equal(plan.ok, true); assert.equal(plan.actions.length, 1); assert.equal(plan.actions[0].take, 3);
  assert.equal(applyExtraction(plan), true); assert.equal(container.writes, 1); assert.equal(container.slots[0], undefined);
});

test('different variants never merge into one requirement or reuse another reserved unit', () => {
  const container = new Container([new Stack(7, 2), new Stack(8, 1)]);
  const plan = planExtraction([container], [request(7, 2), request(8, 2)]);
  assert.equal(plan.ok, false); assert.deepEqual(plan.missingFoods, [request(8, 1)]);
  assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
});

test('cold or lower-quality matching variants can fulfill a saved requirement', () => {
  const stack = new Stack(7);
  stack.rows[1].with[0] = JSON.stringify({ v: 1, nativeVariant: 7, hotUntil: 0, seasoning: ['test:salt'], quality: 3 });
  const container = new Container([stack]);
  assert.equal(applyExtraction(planExtraction([container], [request(7, 1)])), true);
});

test('saved variant requirements cannot silently fall back on unsupported or malformed raw lore', () => {
  for (const rows of [[], [{ translate: 'senluo.public.food.v1', with: ['bad-json'] }]]) {
    const stack = new Stack(7); stack.rows = rows;
    const container = new Container([stack]);
    assert.equal(planExtraction([container], [request(7, 1)]).ok, false);
  }
  const legacy = { typeId: 'test:meal', amount: 3, nameTag: 'legacy' };
  assert.equal(planExtraction([{ size: 1, getItem: () => legacy }], [request(7, 1)]).ok, false);
  assert.equal(planExtraction([{ size: 1, getItem: () => legacy }], [request(undefined, 1)]).ok, true);
});

test('later-slot metadata swaps reject the entire plan before a write', () => {
  const container = new Container([new Stack(7), new Stack(8)]);
  const plan = planExtraction([container], [request(7, 1), request(8, 1)]);
  container.slots[1] = new Stack(9);
  assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
});

test('multi-container failure restores all earlier variant-aware debits with exact metadata', () => {
  const one = new Container([new Stack(7)]), two = new Container([new Stack(8)]);
  const before = [one, two].map(c => structuredClone(c.slots));
  const plan = planExtraction([one, two], [request(7, 1), request(8, 1)]);
  two.failWrite = 1;
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(applyExtraction(plan), false); } finally { console.warn = warn; }
  assert.deepEqual([one, two].map(c => structuredClone(c.slots)), before);
});
