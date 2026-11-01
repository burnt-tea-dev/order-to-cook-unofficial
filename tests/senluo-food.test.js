// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectSenluoFood, matchesSenluoFoodSnapshot } from '../runtime/BP/scripts/senluo_food.js';

const scripts = new URL('../runtime/BP/scripts/', import.meta.url);
const source = await readFile(new URL('inventory.js', scripts), 'utf8');
const adapted = source
  .replace("import { ItemStack } from '@minecraft/server';", 'class ItemStack {}')
  .replace("'./senluo_food.js'", JSON.stringify(new URL('senluo_food.js', scripts).href));
const { planExtraction, applyExtraction, restoreExtraction } = await import(
  'data:text/javascript;base64,' + Buffer.from(adapted).toString('base64'));
const payload = (overrides = {}) => ({ v: 1, hotUntil: 101, seasoning: ['test:salt'], nativeVariant: 7, quality: 0, ...overrides });
const row = value => ({ translate: 'senluo.public.food.v1', with: [JSON.stringify(value)] });
class Stack {
  constructor(rows = [row(payload())]) {
    this.typeId = 'test:meal'; this.amount = 3; this.nameTag = 'Original meal';
    this.rows = structuredClone(rows); this.privateData = { opaque: 'preserve' };
    this.readError = false;
  }
  getRawLore() { if (this.readError) throw Error('unreadable'); return structuredClone(this.rows); }
  setLore() { throw Error('read-only consumer must not write lore'); }
  getDynamicProperty() { throw Error('must not inspect private properties'); }
  clone() { const result = new Stack(); Object.assign(result, structuredClone(this)); return result; }
}
class Container {
  constructor(items) { this.slots = items.map(item => item.clone()); this.size = items.length; this.writes = 0; }
  getItem(slot) { return this.slots[slot]?.clone(); }
  setItem(slot, stack) {
    this.writes++;
    if (this.failAt === this.writes && !this.failAfter) throw Error('write failed');
    this.slots[slot] = stack?.clone();
    if (this.failAt === this.writes && this.failAfter) throw Error('accepted then threw');
  }
}
const requirements = [{ typeId: 'test:meal', amount: 1 }];

test('vendored SDK bytes match the pinned canonical export', async () => {
  const lock = JSON.parse(await readFile(new URL('vendor/senluo/lock.json', scripts), 'utf8'));
  assert.match(lock.commit, /^[0-9a-f]{40}$/);
  assert.equal(lock.sdkVersion, '0.1.0');
  for (const [name, hash] of Object.entries(lock.files)) {
    assert.equal(createHash('sha256').update(await readFile(new URL('vendor/senluo/' + name, scripts))).digest('hex'), hash);
  }
});

test('reads V1 without rounding stored heat or changing the actual item', () => {
  const item = new Stack([{ text: 'custom lore' }, row(payload())]);
  const before = structuredClone(item);
  const result = inspectSenluoFood(item);
  assert.equal(result.status, 'valid'); assert.deepEqual(result.state, payload());
  assert.deepEqual(structuredClone(item), before);
  assert.equal('nutrition' in result.state, false);
  result.state.seasoning.push('test:pepper');
  assert.deepEqual(inspectSenluoFood(item).state, payload());
});

for (const quality of [0, 1, 2, 3]) {
  test(`retains canonical quality ${quality} without converting it to a multiplier`, () => {
    assert.equal(inspectSenluoFood(new Stack([row(payload({ quality }))])).state.quality, quality);
  });
}

for (const bad of [payload({ quality: 4 }), payload({ hotUntil: -1 }), payload({ v: 2 }), payload({ seasoning: ['invalid'] })]) {
  test(`invalid payload stays opaque: ${JSON.stringify(bad)}`, () => {
    const item = new Stack([row(bad)]); const before = structuredClone(item);
    assert.equal(inspectSenluoFood(item).status, 'invalid');
    assert.deepEqual(structuredClone(item), before);
  });
}

test('absent, duplicate, malformed, unsupported and unreadable are distinct', () => {
  assert.equal(inspectSenluoFood(new Stack([])).status, 'absent');
  assert.equal(inspectSenluoFood(new Stack([row(payload()), row(payload())])).status, 'invalid');
  assert.equal(inspectSenluoFood(new Stack([{ translate: 'senluo.public.food.v1', with: ['{'] }])).status, 'invalid');
  assert.equal(inspectSenluoFood({ getLore() { throw Error('never parse translated text'); } }).status, 'unsupported');
  const item = new Stack(); item.readError = true;
  assert.equal(inspectSenluoFood(item).status, 'unreadable');
  assert.equal(inspectSenluoFood({ getRawLore: () => null }).status, 'unreadable');
});

test('large lore fails closed without modifying the source', () => {
  for (const rows of [Array.from({ length: 21 }, () => ({ text: 'x' })), [{ text: 'x'.repeat(32769) }]]) {
    const item = new Stack(rows); const before = structuredClone(item);
    assert.equal(inspectSenluoFood(item).status, 'unreadable');
    assert.deepEqual(structuredClone(item), before);
  }
});

for (const [field, value] of [['quality', 3], ['seasoning', ['test:pepper']], ['nativeVariant', 8], ['hotUntil', 999]]) {
  test(`same-ID same-count ${field} swap rejects extraction before any write`, () => {
    const container = new Container([new Stack()]);
    const plan = planExtraction([container], requirements);
    container.slots[0].rows = [row(payload({ [field]: value }))];
    assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
    assert.deepEqual(container.slots[0].rows, [row(payload({ [field]: value }))]);
  });
}

for (const field of ['nameTag', 'rows']) {
  test(`a changed ${field} cannot be overwritten with the old extraction snapshot`, () => {
    const container = new Container([new Stack()]); const plan = planExtraction([container], requirements);
    if (field === 'nameTag') container.slots[0].nameTag = 'Changed';
    else container.slots[0].rows.push({ text: 'new custom lore' });
    assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
  });
}

test('checks all sources before mutating the first slot', () => {
  const container = new Container([new Stack(), new Stack()]);
  const plan = planExtraction([container], [{ typeId: 'test:meal', amount: 4 }]);
  container.slots[1].rows = [];
  assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
});

test('unchanged malformed carrier is preserved by ordinary ID-only extraction', () => {
  const rows = [{ translate: 'senluo.public.food.v1', with: ['bad-json'] }];
  const container = new Container([new Stack(rows)]);
  const plan = planExtraction([container], requirements);
  assert.equal(plan.ok, true); assert.equal(applyExtraction(plan), true);
  assert.deepEqual(container.slots[0].rows, rows);
  assert.equal(container.slots[0].amount, 2);
});

test('different malformed carriers cannot compare equal through schema normalization', () => {
  const container = new Container([new Stack([{ translate: 'senluo.public.food.v1', with: ['bad-a'] }])]);
  const plan = planExtraction([container], requirements);
  container.slots[0].rows[0].with[0] = 'bad-b';
  assert.equal(applyExtraction(plan), false); assert.equal(container.writes, 0);
});

test('read failures reject planning or applying without deleting the item', () => {
  const container = new Container([new Stack()]);
  const plan = planExtraction([container], requirements);
  container.slots[0].readError = true;
  assert.equal(applyExtraction(plan), false);
  assert.equal(planExtraction([container], requirements).ok, false);
  assert.equal(container.writes, 0); assert.equal(container.slots[0].amount, 3);
});

test('raw-lore capability loss is not treated as absent metadata', () => {
  const snapshot = inspectSenluoFood(new Stack());
  assert.equal(matchesSenluoFoodSnapshot({}, snapshot), false);
  assert.equal(matchesSenluoFoodSnapshot({}, { status: 'unsupported' }), true);
});

test('partial extraction and restoration retain native clone data and exact carrier', () => {
  const container = new Container([new Stack([{ text: 'custom' }, row(payload())])]);
  const before = structuredClone(container.slots);
  const plan = planExtraction([container], requirements);
  assert.equal(plan.actions[0].foodSnapshot.state.hotUntil, 101);
  assert.equal(applyExtraction(plan), true);
  assert.deepEqual(container.slots[0].privateData, before[0].privateData);
  assert.deepEqual(container.slots[0].rows, before[0].rows);
  restoreExtraction(plan);
  assert.deepEqual(structuredClone(container.slots), before);
});

for (const failAfter of [false, true]) {
  test(`rollback retains exact carriers after a later ${failAfter ? 'accepted' : 'rejected'} write`, () => {
    const container = new Container([new Stack(), new Stack([row(payload({ quality: 3 }))])]);
    const before = structuredClone(container.slots);
    const plan = planExtraction([container], [{ typeId: 'test:meal', amount: 4 }]);
    container.failAt = 2; container.failAfter = failAfter;
    const warn = console.warn; console.warn = () => {};
    try { assert.equal(applyExtraction(plan), false); } finally { console.warn = warn; }
    assert.deepEqual(structuredClone(container.slots), before);
  });
}
