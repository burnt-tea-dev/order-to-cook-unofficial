// SPDX-License-Identifier: GPL-3.0-only
// Shipped appliance/native-fridge code with engine adapter doubles. The modeled
// block drops and single-call moves are not real-client or crash-durability proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appliances, FakeItem, FakePlayer, FakeForm, makeEnvironment, place, advance } from './appliances.harness.js';

const LOWER = 'ordertocook:refrigerator', UPPER = 'ordertocook:refrigerator_upper';
const fingerprint = appliances.itemFingerprint;

// Preserve native properties beyond an ID/count pair, including an unstackable
// carrier's proof and the enchantment/placement data read by the real fingerprint.
class MetadataItem extends FakeItem {
  constructor(typeId, amount, proof) {
    super(typeId, amount);
    this.nameTag = `Saved ${proof}`; this.setLore(['原始說明', proof]);
    this.setDynamicProperty('ordertocook:proof', proof); this.setDynamicProperty('sample:variant', 'same-id-different-data');
    this.damage = 7; this.keepOnDeath = true; this.lockMode = 'inventory';
    this.enchantments = [{ type: { id: 'unbreaking' }, level: 2 }];
  }
  clone() { const copy = new MetadataItem(this.typeId, this.amount, ''); Object.assign(copy, structuredClone(this)); return copy; }
  getComponent(id) { return id === 'minecraft:enchantable' ? { getEnchantments: () => structuredClone(this.enchantments) } : super.getComponent(id); }
  getCanDestroy() { return ['minecraft:stone']; }
  getCanPlaceOn() { return ['minecraft:dirt']; }
}

function setup({ legacy = false, nativeUpper = false, nativeContainers = true } = {}) {
  const env = makeEnvironment();
  env.dimension.nativeContainers = nativeContainers;
  const lower = place(env, LOWER, undefined, { 'ordertocook:half': 'lower', 'minecraft:cardinal_direction': 'west' });
  const station = env.ctx.getStation(lower);
  let helper;
  if (legacy) {
    place(env, nativeUpper ? UPPER : LOWER, { x: 0, y: 1, z: 0 }, { 'ordertocook:half': 'upper' });
    helper = env.dimension.spawnEntity('ordertocook:storage', { x: 0.5, y: 0.1, z: 0.5 });
    helper.setDynamicProperty('ordertocook:station_id', station.id);
    helper.setDynamicProperty('ordertocook:storage_anchor', JSON.stringify({ stationId: station.id, dimensionId: station.dimensionId, location: station.location, typeId: LOWER }));
    helper.addTag('ordertocook:appliance_storage'); station.storageId = helper.id;
  }
  const service = appliances.createApplianceService(env.ctx);
  if (!legacy) service.onPlace(lower);
  return { ...env, lower, station, helper, service, upper: env.dimension.getBlock({ x: 0, y: 1, z: 0 }) };
}

function seedLegacy(f) {
  const entries = [
    [0, new MetadataItem('minecraft:apple', 13, 'upper-first')],
    [26, new MetadataItem('ordertocook:takeout_bag', 1, 'upper-last-parcel')],
    [27, new MetadataItem('ordertocook:food_plate', 1, 'lower-first-plate')],
    [80, new MetadataItem('minecraft:apple', 7, 'lower-last')],
  ];
  for (const [slot, item] of entries) f.helper.container.setItem(slot, item);
  return entries;
}

function fingerprints(container) {
  return Array.from({ length: container.size }, (_, slot) => fingerprint(container.getItem(slot))).filter(Boolean).sort();
}

function allCargo(f) {
  return [f.lower.container, f.upper.container, f.helper?.isValid ? f.helper.container : undefined]
    .filter(container => container?.isValid).flatMap(fingerprints).sort();
}

test('new refrigerator uses two bounded native inventories and keeps them across door-state changes', () => {
  const f = setup(), joined = f.service.getStorage(f.station);
  const upper = f.upper.getComponent('minecraft:inventory').container, lower = f.lower.getComponent('minecraft:inventory').container;
  assert.equal(upper.size, 27); assert.equal(lower.size, 54); assert.equal(joined.size, 81);
  const item = new MetadataItem('ordertocook:takeout_bag', 1, 'physical'); joined.setItem(26, item);
  joined.setItem(80, new FakeItem('minecraft:apple', 64));
  assert.equal(fingerprint(upper.getItem(26)), fingerprint(item)); assert.equal(lower.getItem(53).amount, 64);
  assert.throws(() => upper.setItem(27, new FakeItem('minecraft:apple')), /slot bounds/);
  f.upper.setPermutation(f.upper.permutation.withState('ordertocook:frame', 10));
  assert.equal(f.upper.getComponent('minecraft:inventory').container, upper);
  assert.equal(f.service.getStorage(f.station), joined); assert.equal(joined.emptySlotsCount, 79);
  assert.equal(f.station.storageId, undefined); assert.equal(f.dimension.spawnCount, 0); assert.equal(f.dimension.drops.length, 0);
});

test('legacy 81-slot helper migrates upper/lower boundary slots with full metadata exactly once', () => {
  const f = setup({ legacy: true }), entries = seedLegacy(f), helperId = f.helper.id;
  let moves = 0;
  const move = f.helper.container.moveItem.bind(f.helper.container);
  f.helper.container.moveItem = (...args) => { moves++; return move(...args); };
  const joined = f.service.getStorage(f.station);
  assert.equal(f.upper.typeId, UPPER); assert.equal(f.helper.isValid, false); assert.equal(f.station.storageId, undefined);
  assert.equal(f.station.nativeFridge, true); assert.equal(f.dimension.entities.has(helperId), false);
  for (const [slot, item] of entries) assert.equal(fingerprint(joined.getItem(slot)), fingerprint(item));
  assert.equal(fingerprint(f.upper.container.getItem(26)), fingerprint(entries[1][1]));
  assert.equal(fingerprint(f.lower.container.getItem(0)), fingerprint(entries[2][1]));
  f.service.getStorage(f.station); f.service.onPlace(f.lower);
  assert.equal(moves, 4); assert.equal(f.dimension.spawnCount, 1); assert.equal(f.dimension.drops.length, 0);
  assert.deepEqual(allCargo(f), entries.map(([, item]) => fingerprint(item)).sort());
});

test('an interrupted native move resumes remaining source slots without duplicating the completed moves', () => {
  const f = setup({ legacy: true, nativeUpper: true }), entries = seedLegacy(f);
  f.upper.container.failNextSlot = 26;
  assert.throws(() => f.service.getStorage(f.station), /simulated container write failure/);
  assert.equal(f.helper.container.getItem(0), undefined);
  assert.equal(fingerprint(f.upper.container.getItem(0)), fingerprint(entries[0][1]));
  assert.equal(fingerprint(f.helper.container.getItem(26)), fingerprint(entries[1][1]));
  assert.equal(f.upper.container.getItem(26), undefined); assert.equal(f.station.storageId, f.helper.id);
  assert.deepEqual(allCargo(f), entries.map(([, item]) => fingerprint(item)).sort());
  const joined = f.service.getStorage(f.station);
  for (const [slot, item] of entries) assert.equal(fingerprint(joined.getItem(slot)), fingerprint(item));
  assert.deepEqual(allCargo(f), entries.map(([, item]) => fingerprint(item)).sort());
  assert.equal(f.helper.isValid, false); assert.equal(f.dimension.drops.length, 0);
});

test('station-save failure retains the empty helper reference and retries without moving already-migrated cargo', () => {
  const f = setup({ legacy: true }), entries = seedLegacy(f);
  const save = f.ctx.saveStation; let fail = true;
  f.ctx.saveStation = station => { if (fail) { fail = false; throw Error('simulated native migration save failure'); } return save(station); };
  const service = appliances.createApplianceService(f.ctx);
  assert.throws(() => service.getStorage(f.station), /migration save failure/);
  assert.equal(f.station.storageId, f.helper.id); assert.notEqual(f.station.nativeFridge, true);
  assert.equal(f.helper.isValid, true); assert.equal(f.helper.container.emptySlotsCount, 81);
  assert.equal(service.canOpenFridge(new FakePlayer(f.dimension), f.lower), false);
  assert.deepEqual(allCargo(f), entries.map(([, item]) => fingerprint(item)).sort());
  const joined = service.getStorage(f.station);
  assert.equal(f.station.nativeFridge, true); assert.equal(f.station.storageId, undefined); assert.equal(f.helper.isValid, false);
  for (const [slot, item] of entries) assert.equal(fingerprint(joined.getItem(slot)), fingerprint(item));
  assert.equal(f.dimension.drops.length, 0);
});

test('migration refuses an occupied destination instead of overwriting either physical stack', () => {
  const f = setup({ legacy: true, nativeUpper: true });
  const old = new MetadataItem('minecraft:apple', 9, 'old'), existing = new MetadataItem('minecraft:apple', 3, 'native');
  f.helper.container.setItem(0, old); f.upper.container.setItem(0, existing);
  assert.throws(() => f.service.getStorage(f.station), /目的格已有物品/);
  const lowerContainer = f.lower.container, upperContainer = f.upper.container, helperContainer = f.helper.container;
  const beforeNative = f.station.nativeFridge;
  f.lower.setPermutation(f.lower.permutation.withState('ordertocook:closing', true).withState('ordertocook:frame', 4));
  f.service.tick();
  advance(f.service, f, 2);
  assert.equal(f.lower.permutation.getState('ordertocook:frame'), 5);
  assert.equal(f.lower.permutation.getState('ordertocook:root_frame'), 2);
  assert.equal(f.upper.permutation.getState('ordertocook:root_frame'), 2);
  assert.equal(f.station.nativeFridge, beforeNative, 'Failed migration cannot be marked complete.');
  assert.equal(f.lower.container, lowerContainer); assert.equal(f.upper.container, upperContainer);
  assert.equal(f.helper.container, helperContainer);
  assert.equal(lowerContainer.emptySlotsCount, 54);

  assert.equal(fingerprint(f.helper.container.getItem(0)), fingerprint(old));
  assert.equal(fingerprint(f.upper.container.getItem(0)), fingerprint(existing));
  assert.equal(f.station.storageId, f.helper.id); assert.equal(f.helper.isValid, true); assert.equal(f.dimension.drops.length, 0);
});

test('a saved helper that has not loaded blocks access and is never replaced by an empty inventory', () => {
  const f = setup({ legacy: true }), entries = seedLegacy(f);
  f.dimension.entities.delete(f.helper.id);
  assert.equal(f.service.getStorage(f.station), undefined);
  assert.equal(f.service.canOpenFridge(new FakePlayer(f.dimension), f.lower), false);
  assert.equal(f.station.storageId, f.helper.id); assert.notEqual(f.station.nativeFridge, true); assert.equal(f.dimension.spawnCount, 1);
  assert.deepEqual(fingerprints(f.helper.container), entries.map(([, item]) => fingerprint(item)).sort());
  f.dimension.entities.set(f.helper.id, f.helper);
  assert.equal(f.service.getStorage(f.station).emptySlotsCount, 77); assert.equal(f.dimension.spawnCount, 1);
});

test('a foreign or incorrectly anchored helper cannot be migrated through a saved refrigerator reference', () => {
  for (const mismatch of ['station', 'dimension', 'location', 'type']) {
    const f = setup({ legacy: true }), entries = seedLegacy(f);
    if (mismatch === 'station') f.helper.setDynamicProperty('ordertocook:station_id', 'someone-else');
    if (mismatch === 'dimension') f.helper.dimension = { ...f.dimension, id: 'minecraft:nether' };
    if (mismatch === 'location') f.helper.location = { x: 50, y: 0, z: 50 };
    if (mismatch === 'type') f.helper.typeId = 'minecraft:chest_minecart';
    assert.throws(() => f.service.getStorage(f.station), /身份不符/);
    assert.deepEqual(fingerprints(f.helper.container), entries.map(([, item]) => fingerprint(item)).sort());
    assert.equal(f.station.storageId, f.helper.id); assert.equal(f.helper.isValid, true);
    assert.equal(f.upper.container.emptySlotsCount, 27); assert.equal(f.lower.container.emptySlotsCount, 54);
  }
});

test('without the native container component a fridge preserves legacy cargo and never opens a paginated fallback', () => {
  const previous = FakeForm.prototype.show; let shown = 0;
  FakeForm.prototype.show = async () => { shown++; return { canceled: true }; };
  try {
    for (const legacy of [false, true]) {
      const f = setup({ legacy, nativeContainers: false }), player = new FakePlayer(f.dimension), entries = legacy ? seedLegacy(f) : [];
      f.service.onInteract(player, f.lower);
      assert.equal(f.service.getStorage(f.station), undefined); assert.equal(f.service.canOpenFridge(player, f.lower), false);
      assert.equal(f.dimension.spawnCount, legacy ? 1 : 0);
      assert.notEqual(f.station.nativeFridge, true);
      if (legacy) {
        assert.equal(f.station.storageId, f.helper.id);
        assert.deepEqual(fingerprints(f.helper.container), entries.map(([, item]) => fingerprint(item)).sort());
      }
      assert.equal(f.dimension.drops.length, 0);
    }
    assert.equal(shown, 0);
  } finally { FakeForm.prototype.show = previous; }
});

async function emulatePlayerBreak(f, block) {
  const permutation = block.permutation, station = f.station;
  // Use the actual definition's declared loot. The harness separately models
  // automatic cargo spill on block-ID replacement, before the script callback.
  const resource = block.typeId === UPPER ? 'refrigerator_upper' : 'refrigerator';
  const definition = JSON.parse(await readFile(new URL(`../runtime/BP/blocks/${resource}.json`, import.meta.url), 'utf8'));
  const lootPath = definition['minecraft:block'].components['minecraft:loot'];
  const loot = JSON.parse(await readFile(new URL(`../runtime/BP/${lootPath}`, import.meta.url), 'utf8'));
  for (const pool of loot.pools) for (const entry of pool.entries) {
    if (entry.type === 'item') f.dimension.spawnItem(new FakeItem(entry.name, pool.rolls), block.location);
  }
  block.setType('minecraft:air');
  f.service.onBreak(block, station, permutation);
  return permutation;
}

test('breaking either half and restarting recovery preserve a rejected legacy helper and its exact cargo', async () => {
  const observations = [], expected = [];
  for (const mismatch of ['station', 'dimension', 'location', 'type']) for (const half of ['lower', 'upper']) {
    const f = setup({ legacy: true, nativeUpper: true }); seedLegacy(f);
    if (mismatch === 'station') f.helper.setDynamicProperty('ordertocook:station_id', 'someone-else');
    if (mismatch === 'dimension') f.helper.dimension = { ...f.dimension, id: 'minecraft:nether' };
    if (mismatch === 'location') f.helper.location = { x: 50, y: 0, z: 50 };
    if (mismatch === 'type') f.helper.typeId = 'minecraft:chest_minecart';
    const snapshot = () => JSON.stringify(Array.from({ length: 81 }, (_, slot) => fingerprint(f.helper.container.getItem(slot))));
    const before = snapshot();
    assert.throws(() => f.service.getStorage(f.station), /身份不符/);
    try { await emulatePlayerBreak(f, half === 'lower' ? f.lower : f.upper); }
    catch (error) { assert.match(String(error), /身份不符/); }
    const observe = phase => {
      const scenario = `${mismatch}/${half}/${phase}`;
      observations.push({ scenario, helperPreserved: f.helper.isValid, cargoPreserved: snapshot() === before,
        foreignDrops: f.dimension.drops.filter(drop => drop.stack.typeId !== LOWER).length,
        savedReferencePreserved: f.records.get(f.station.id)?.storageId === f.helper.id });
      expected.push({ scenario, helperPreserved: true, cargoPreserved: true, foreignDrops: 0, savedReferencePreserved: true });
    };
    observe('break');
    // Recreate the service to discard its transient maps, then let the ordinary
    // orphan scan and its next retry see both removed halves. This is a service
    // restart with adapter doubles, not a native chunk or disk-reload test.
    const restarted = appliances.createApplianceService(f.ctx);
    restarted.tick(); advance(restarted, f, 101);
    observe('recovery');
  }
  assert.deepEqual(observations, expected);
});

test('matching legacy refrigerator helpers still drop full cargo once and retire on break or recovery', async () => {
  for (const half of ['lower', 'upper']) for (const removal of ['player-adapter', 'command-recovery']) {
    const f = setup({ legacy: true, nativeUpper: true }), entries = seedLegacy(f);
    const expected = entries.map(([, item]) => fingerprint(item)).sort();
    const block = half === 'lower' ? f.lower : f.upper;
    if (removal === 'player-adapter') await emulatePlayerBreak(f, block);
    else { block.setType('minecraft:air'); f.service.tick(); }
    const cargo = () => f.dimension.drops.filter(drop => drop.stack.typeId !== LOWER).map(drop => fingerprint(drop.stack)).sort();
    assert.deepEqual(cargo(), expected, `${half}/${removal}`);
    assert.equal(f.lower.isAir, true); assert.equal(f.upper.isAir, true);
    assert.equal(f.helper.isValid, false); assert.equal(f.records.has(f.station.id), false);
    const restarted = appliances.createApplianceService(f.ctx);
    restarted.tick(); advance(restarted, f, 101);
    assert.deepEqual(cargo(), expected, `${half}/${removal}/restart`);
    assert.equal(f.dimension.spawnCount, 1);
  }
});

test('breaking either half spills each native stack once and drops only one refrigerator item', async () => {
  for (const half of ['lower', 'upper']) {
    const f = setup();
    const first = new MetadataItem('ordertocook:takeout_bag', 1, 'upper-drop'), second = new MetadataItem('minecraft:apple', 13, 'lower-drop');
    f.upper.container.setItem(0, first); f.lower.container.setItem(53, second);
    const block = half === 'upper' ? f.upper : f.lower, permutation = await emulatePlayerBreak(f, block);
    assert.equal(f.lower.isAir, true); assert.equal(f.upper.isAir, true); assert.equal(f.records.has(f.station.id), false);
    const cargo = f.dimension.drops.filter(drop => drop.stack.typeId !== LOWER);
    assert.deepEqual(cargo.map(drop => fingerprint(drop.stack)).sort(), [fingerprint(first), fingerprint(second)].sort());
    assert.equal(f.dimension.drops.filter(drop => drop.stack.typeId === LOWER).reduce((sum, drop) => sum + drop.stack.amount, 0), 1);
    f.service.onBreak(block, undefined, permutation);
    assert.equal(f.dimension.drops.length, 3); assert.equal(f.dimension.spawnCount, 0);
  }
});

test('command removal cleans the remaining half without replaying automatic native cargo drops', () => {
  for (const half of ['lower', 'upper']) {
    const f = setup(), first = new MetadataItem('minecraft:apple', 5, 'command-upper'), second = new MetadataItem('minecraft:apple', 7, 'command-lower');
    f.upper.container.setItem(26, first); f.lower.container.setItem(0, second);
    (half === 'upper' ? f.upper : f.lower).setType('minecraft:air');
    assert.equal(f.dimension.drops.length, 1);
    f.service.tick();
    assert.equal(f.lower.isAir, true); assert.equal(f.upper.isAir, true); assert.equal(f.records.has(f.station.id), false);
    assert.deepEqual(f.dimension.drops.map(drop => fingerprint(drop.stack)).sort(), [fingerprint(first), fingerprint(second)].sort());
    advance(f.service, f, 101); assert.equal(f.dimension.drops.length, 2); assert.equal(f.dimension.spawnCount, 0);
  }
});


test('sneak-empty compaction merges matching metadata in first-seen order within one compartment', () => {
  const f = setup(), player = new FakePlayer(f.dimension); player.isSneaking = true;
  const apple = new FakeItem('minecraft:apple', 40); apple.nameTag = 'A'; apple.setLore(['saved']);
  const later = apple.clone(); later.amount = 30;
  const other = new FakeItem('minecraft:apple', 4); other.nameTag = 'B';
  const sword = new MetadataItem('minecraft:diamond_sword', 1, 'opaque'); sword.maxAmount = 1;
  f.lower.container.setItem(3, apple); f.lower.container.setItem(7, new FakeItem('minecraft:bread', 2));
  f.lower.container.setItem(9, later); f.lower.container.setItem(11, other); f.lower.container.setItem(53, sword);
  f.upper.container.setItem(26, new FakeItem('minecraft:apple', 8));
  f.service.onInteract(player, f.lower);
  assert.deepEqual(f.lower.container.slots.filter(Boolean).map(item => [item.typeId, item.amount, item.nameTag]), [
    ['minecraft:apple', 64, 'A'], ['minecraft:apple', 6, 'A'], ['minecraft:bread', 2, undefined],
    ['minecraft:apple', 4, 'B'], ['minecraft:diamond_sword', 1, sword.nameTag],
  ]);
  assert.equal(fingerprint(f.lower.container.getItem(4)), fingerprint(sword));
  assert.deepEqual(f.lower.container.getItem(0).getLore(), ['saved']);
  assert.equal(f.upper.container.getItem(26).amount, 8);
  f.service.onInteract(player, f.upper);
  assert.equal(f.upper.container.getItem(0).amount, 8); assert.equal(f.upper.container.getItem(26), undefined);
  assert.equal(f.lower.container.getItem(1).amount, 6); assert.equal(f.dimension.drops.length, 0);
});

test('ordinary use, holding an item and denied access cannot compact fridge cargo', () => {
  for (const reason of ['ordinary', 'held', 'permission']) {
    const f = setup(), player = new FakePlayer(f.dimension);
    f.lower.container.setItem(8, new FakeItem('minecraft:apple', 3));
    player.isSneaking = reason !== 'ordinary';
    if (reason === 'held') player.container.setItem(0, new FakeItem('minecraft:stick'));
    if (reason === 'permission') f.ctx.canUseStation = () => false;
    f.service.onInteract(player, f.lower);
    assert.equal(f.lower.container.getItem(0), undefined, reason);
    assert.equal(f.lower.container.getItem(8).amount, 3, reason);
  }
});

test('compaction restores full slot snapshots when a write throws before or after acceptance', () => {
  for (const accepted of [false, true]) {
    const f = setup(), player = new FakePlayer(f.dimension); player.isSneaking = true;
    f.lower.container.setItem(8, new MetadataItem('minecraft:apple', 3, 'restore'));
    f.lower.container.setItem(9, new FakeItem('minecraft:bread', 2));
    const snapshot = () => Array.from({ length: f.lower.container.size }, (_, slot) => fingerprint(f.lower.container.getItem(slot)));
    const before = snapshot(), write = f.lower.container.setItem.bind(f.lower.container);
    let failed = false;
    f.lower.container.setItem = (slot, stack) => {
      if (!failed && slot === 1) {
        failed = true; if (accepted) write(slot, stack);
        throw Error('injected sort write failure');
      }
      write(slot, stack);
    };
    f.service.onInteract(player, f.lower);
    assert.equal(failed, true); assert.deepEqual(snapshot(), before);
    assert.equal(f.dimension.drops.length, 0);
  }
});
