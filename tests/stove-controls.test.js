// SPDX-License-Identifier: GPL-3.0-only
// Real native-storage adapter with native Container boundary doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeStoveStorage } from '../runtime/BP/scripts/stove_controls.js';
import { appliances, FakeContainer, FakeItem } from './appliances.harness.js';

function fixture({ helper = true, size = 7 } = {}) {
  const station = { id: 'stove', storageId: helper ? 'legacy' : undefined };
  const target = new FakeContainer(size), source = helper && new FakeContainer(81);
  const old = source && { isValid: true, getComponent: () => ({ container: source }), remove() { this.isValid = false; } };
  let loaded = true, helperLoaded = true, rejectSave = false, saves = 0;
  const adapter = createNativeStoveStorage({
    loadedBlock: () => loaded ? { typeId: 'ordertocook:stove', getComponent: () => ({ container: target }) } : undefined,
    findLegacy: () => helperLoaded ? old : undefined,
    fingerprint: appliances.itemFingerprint,
    saveStation() { saves++; if (rejectSave) throw Error('save rejected'); },
  });
  return { station, source, target, old, adapter, get saves() { return saves; },
    unload: () => { loaded = false; }, hideHelper: () => { helperLoaded = false; },
    failSave: value => { rejectSave = value; } };
}

function cargo(typeId, amount, value) {
  const stack = new FakeItem(typeId, amount);
  stack.nameTag = '廚房原物'; stack.setLore(['原資料']); stack.setDynamicProperty('sample:proof', value);
  return stack;
}
const fingerprints = container => Array.from({ length: 7 }, (_, slot) => appliances.itemFingerprint(container.getItem(slot)));

test('new stoves expose the existing native seven slots without creating a helper', () => {
  const f = fixture({ helper: false });
  assert.equal(f.adapter.peek(f.station), undefined);
  assert.equal(f.adapter.ensure(f.station), f.target);
  assert.equal(f.station.nativeStove, true); assert.equal(f.station.storageId, undefined);
  assert.equal(f.adapter.peek(f.station), f.target); assert.equal(f.saves, 1);
  assert.equal(f.adapter.ensure(f.station), f.target); assert.equal(f.saves, 1);
});

test('legacy seven-slot cargo moves intact before retiring its empty helper', () => {
  const f = fixture();
  for (let slot = 0; slot < 7; slot++) f.source.setItem(slot, cargo('minecraft:beef', slot + 1, String(slot)));
  const before = fingerprints(f.source);
  assert.equal(f.adapter.ensure(f.station), f.target);
  assert.deepEqual(fingerprints(f.target), before);
  assert.equal(f.source.emptySlotsCount, 81); assert.equal(f.old.isValid, false);
  assert.equal(f.station.nativeStove, true); assert.equal(f.station.storageId, undefined);
});

test('an occupied destination keeps both original stacks and the legacy owner', () => {
  const f = fixture(), legacy = cargo('minecraft:beef', 2, 'legacy'), occupied = cargo('minecraft:potato', 3, 'native');
  f.source.setItem(0, legacy); f.target.setItem(0, occupied);
  assert.throws(() => f.adapter.ensure(f.station), /目的格已有物品/);
  assert.equal(appliances.itemFingerprint(f.source.getItem(0)), appliances.itemFingerprint(legacy));
  assert.equal(appliances.itemFingerprint(f.target.getItem(0)), appliances.itemFingerprint(occupied));
  assert.equal(f.old.isValid, true); assert.equal(f.station.storageId, 'legacy');
});

test('an interrupted native move resumes only the remaining source slots', () => {
  const f = fixture();
  f.source.setItem(0, cargo('minecraft:beef', 2, 'a')); f.source.setItem(1, cargo('minecraft:potato', 3, 'b'));
  const before = fingerprints(f.source); f.target.failNextSlot = 1;
  assert.throws(() => f.adapter.ensure(f.station), /simulated container write failure/);
  assert.equal(f.source.getItem(0), undefined); assert.equal(f.source.getItem(1).amount, 3);
  assert.equal(f.target.getItem(0).amount, 2); assert.equal(f.old.isValid, true);
  assert.equal(f.adapter.ensure(f.station), f.target); assert.deepEqual(fingerprints(f.target), before);
  assert.equal(f.old.isValid, false);
});

test('an unloaded saved helper cannot be replaced by an empty native inventory', () => {
  const f = fixture(); f.source.setItem(0, cargo('minecraft:beef', 2, 'wait')); f.hideHelper();
  assert.equal(f.adapter.ensure(f.station), undefined);
  assert.equal(f.source.getItem(0).amount, 2); assert.equal(f.target.emptySlotsCount, 7);
  assert.equal(f.station.storageId, 'legacy'); assert.equal(f.station.nativeStove, undefined);
});

test('save failure preserves native cargo and a retryable legacy reference', () => {
  const f = fixture(); const stack = cargo('minecraft:beef', 3, 'keep'); f.source.setItem(0, stack); f.failSave(true);
  assert.throws(() => f.adapter.ensure(f.station), /save rejected/);
  assert.equal(f.old.isValid, true); assert.equal(f.station.storageId, 'legacy');
  assert.equal(f.station.nativeStove, undefined); assert.equal(f.adapter.peek(f.station), undefined);
  assert.equal(appliances.itemFingerprint(f.target.getItem(0)), appliances.itemFingerprint(stack));
  f.failSave(false); assert.equal(f.adapter.ensure(f.station), f.target);
  assert.equal(f.old.isValid, false); assert.equal(f.target.getItem(0).amount, 3);
});

test('unexpected cargo outside the old seven stove slots is retained', () => {
  const f = fixture(); f.source.setItem(80, cargo('minecraft:diamond', 1, 'extra'));
  assert.throws(() => f.adapter.ensure(f.station), /額外物品/);
  assert.equal(f.source.getItem(80).typeId, 'minecraft:diamond'); assert.equal(f.target.emptySlotsCount, 7);
  assert.equal(f.old.isValid, true); assert.equal(f.station.storageId, 'legacy');
});

test('missing or wrong-capacity block containers never become the cargo owner', () => {
  const wrong = fixture({ size: 9 }); assert.equal(wrong.adapter.ensure(wrong.station), undefined);
  assert.equal(wrong.station.nativeStove, undefined); assert.equal(wrong.old.isValid, true);
  const unloaded = fixture({ helper: false }); unloaded.adapter.ensure(unloaded.station); unloaded.unload();
  assert.equal(unloaded.adapter.peek(unloaded.station), undefined); assert.equal(unloaded.saves, 1);
});
