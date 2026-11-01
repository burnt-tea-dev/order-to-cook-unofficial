// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectSenluoFood, matchesSenluoFoodSnapshot } from '../runtime/BP/scripts/senluo_food.js';

// Exercise production extraction; replace only the unavailable Minecraft import.
const scripts = new URL('../runtime/BP/scripts/', import.meta.url);
const source = await readFile(new URL('inventory.js', scripts), 'utf8');
const adapted = source
  .replace("import { ItemStack } from '@minecraft/server';", 'class ItemStack {}')
  .replace("'./senluo_food.js'", JSON.stringify(new URL('senluo_food.js', scripts).href));
const { planExtraction, applyExtraction, restoreExtraction } = await import(
  'data:text/javascript;base64,' + Buffer.from(adapted).toString('base64'));

// Deliberately no getRawLore: models the legacy capability path, not a real engine.
class LegacyStack {
  constructor(nameTag) {
    this.typeId = 'test:meal'; this.amount = 3; this.nameTag = nameTag;
    this.opaque = { owner: 'provider', nested: [7] };
  }
  getLore() { throw Error('translated lore must not be parsed as V1'); }
  clone() { return Object.assign(new LegacyStack(), structuredClone(this)); }
}
class Container {
  constructor(items) { this.slots = items.map(item => item.clone()); this.size = items.length; this.writes = 0; }
  getItem(slot) { return this.slots[slot]?.clone(); }
  setItem(slot, item) { this.writes++; this.slots[slot] = item?.clone(); }
}
const requirements = [{ typeId: 'test:meal', amount: 1 }];

for (const [before, after] of [['Original', 'Replacement'], [undefined, 'Named'], ['Named', undefined], ['', 'Named']]) {
  test(`legacy same-ID/count name change ${String(before)} -> ${String(after)} is rejected`, () => {
    const container = new Container([new LegacyStack(before)]);
    const plan = planExtraction([container], requirements);
    assert.equal(plan.ok, true);
    container.slots[0].nameTag = after;
    assert.equal(applyExtraction(plan), false);
    assert.equal(container.writes, 0);
    assert.equal(container.slots[0].nameTag, after);
    assert.equal(container.slots[0].amount, 3);
  });
}

for (const name of [undefined, '', 'Unchanged']) {
  test(`unchanged legacy stack ${String(name)} can be extracted and restored`, () => {
    const container = new Container([new LegacyStack(name)]);
    const before = structuredClone(container.slots);
    const plan = planExtraction([container], requirements);
    assert.equal(applyExtraction(plan), true);
    assert.equal(container.slots[0].amount, 2);
    assert.deepEqual(container.slots[0].opaque, before[0].opaque);
    restoreExtraction(plan);
    assert.deepEqual(structuredClone(container.slots), before);
  });
}

test('a stale second legacy source prevents all writes', () => {
  const container = new Container([new LegacyStack('First'), new LegacyStack('Second')]);
  const plan = planExtraction([container], [{ typeId: 'test:meal', amount: 4 }]);
  container.slots[1].nameTag = 'Replaced';
  assert.equal(applyExtraction(plan), false);
  assert.equal(container.writes, 0);
  assert.equal(container.slots[0].amount, 3);
});

test('name getter failure is unreadable even without raw-lore capability', () => {
  const stack = { get nameTag() { throw Error('native read failed'); } };
  assert.equal(inspectSenluoFood(stack).status, 'unreadable');
  assert.equal(matchesSenluoFoodSnapshot(stack, { status: 'unsupported' }), false);
});

test('unsupported remains distinct from raw metadata and does not invoke translated lore', () => {
  const stack = new LegacyStack('Named');
  const snapshot = inspectSenluoFood(stack);
  assert.equal(snapshot.status, 'unsupported');
  assert.equal('state' in snapshot, false);
  assert.equal(matchesSenluoFoodSnapshot(stack, snapshot), true);
  stack.getRawLore = () => [];
  assert.equal(matchesSenluoFoodSnapshot(stack, snapshot), false);
});
