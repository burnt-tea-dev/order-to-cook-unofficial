// SPDX-License-Identifier: GPL-3.0-only
// Production stove service with engine/form doubles. These are not BDS or GUI tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, FakeItem, FakePlayer, FakeForm, makeEnvironment, place, advance } from './appliances.harness.js';

function makeStove(options = {}) {
  const env = makeEnvironment();
  Object.assign(env.ctx, options);
  // Keep persistence separate from the mutable live record, as store.js does.
  const saved = new Map();
  const saveStation = env.ctx.saveStation;
  env.ctx.saveStation = station => {
    saved.set(station.id, JSON.parse(JSON.stringify(station)));
    saveStation(station);
  };
  const service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:stove');
  service.onPlace(block);
  const station = env.ctx.getStation(block);
  const inventory = service.getStorage(station);
  service.tick();
  return { ...env, env, service, block, station, inventory, saved };
}

const choose = selection => ({ canceled: false, selection });
const settle = () => new Promise(resolve => setImmediate(resolve));

async function respondWith(responses, action) {
  const originalShow = FakeForm.prototype.show;
  let index = 0;
  FakeForm.prototype.show = async function () {
    const response = responses[index++];
    return typeof response === 'function' ? response() : response ?? { canceled: true };
  };
  try { action(); await settle(); }
  finally { FakeForm.prototype.show = originalShow; }
}

function restart(fixture) {
  const station = JSON.parse(JSON.stringify(fixture.saved.get(fixture.station.id)));
  fixture.records.set(station.id, station);
  fixture.system.currentTick = 0;
  const service = appliances.createApplianceService(fixture.ctx);
  service.tick();
  return { station, service };
}

test('mixed stove lanes finish together at 200 ticks and keep their paired outputs', () => {
  const f = makeStove();
  const inputs = ['beef', 'potato', 'kelp'];
  const outputs = ['cooked_beef', 'baked_potato', 'dried_kelp'];
  inputs.forEach((id, slot) => f.inventory.setItem(slot, new FakeItem(`minecraft:${id}`, 2)));
  f.inventory.setItem(3, new FakeItem('minecraft:coal', 2));
  advance(f.service, f.env, 199);
  for (let slot = 4; slot < 7; slot++) assert.equal(f.inventory.getItem(slot), undefined);
  advance(f.service, f.env, 1);
  outputs.forEach((id, lane) => {
    assert.equal(f.inventory.getItem(lane).amount, 1);
    assert.equal(f.inventory.getItem(lane + 4).typeId, `minecraft:${id}`);
    assert.equal(f.inventory.getItem(lane + 4).amount, 1);
  });
  assert.equal(f.inventory.getItem(3).amount, 1);
  assert.equal(f.station.appliance.cookProgress, 0);
});

test('a full output and an invalid input leave the other lane free to cook', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 64));
  f.inventory.setItem(1, new FakeItem('minecraft:potato', 2));
  f.inventory.setItem(2, new FakeItem('minecraft:stone', 8));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 200);
  assert.equal(f.inventory.getItem(0).amount, 2);
  assert.equal(f.inventory.getItem(4).amount, 64);
  assert.equal(f.inventory.getItem(1).amount, 1);
  assert.equal(f.inventory.getItem(5).typeId, 'minecraft:baked_potato');
  assert.equal(f.inventory.getItem(2).amount, 8);
  assert.equal(f.inventory.getItem(6), undefined);
});

test('blocking every lane freezes shared progress while burning, then prevents refuelling', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:stick', 2));
  advance(f.service, f.env, 40);
  f.inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 64));
  const before = { ...f.station.appliance };
  advance(f.service, f.env, 20);
  assert.equal(f.station.appliance.cookProgress, before.cookProgress);
  assert.equal(f.station.appliance.litTime, before.litTime - 20);
  assert.equal(f.inventory.getItem(3).amount, 1);
  advance(f.service, f.env, 100);
  assert.equal(f.station.appliance.litTime, 0);
  assert.equal(f.station.appliance.cookProgress, 0);
  assert.equal(f.inventory.getItem(3).amount, 1);
  assert.equal(f.inventory.getItem(0).amount, 2);
});

test('fuel exhaustion cools by two points per tick and new fuel resumes the remaining batch', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:stick'));
  advance(f.service, f.env, 100);
  assert.equal(f.station.appliance.litTime, 1);
  assert.equal(f.station.appliance.cookProgress, 100);
  advance(f.service, f.env, 10);
  assert.equal(f.station.appliance.cookProgress, 80);
  assert.equal(f.block.permutation.getState('ordertocook:lit'), false);
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 119);
  assert.equal(f.inventory.getItem(4), undefined);
  advance(f.service, f.env, 1);
  assert.equal(f.inventory.getItem(4).amount, 1);
  assert.equal(f.inventory.getItem(0).amount, 1);
  assert.equal(f.block.permutation.getState('ordertocook:lit'), true);
});

test('invalid fuel is retained and lava fuel returns exactly one empty bucket', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:stone', 4));
  advance(f.service, f.env, 200);
  assert.equal(f.inventory.getItem(3).amount, 4);
  assert.equal(f.inventory.getItem(4), undefined);
  f.inventory.setItem(3, new FakeItem('minecraft:lava_bucket'));
  advance(f.service, f.env, 1);
  assert.equal(f.inventory.getItem(3).typeId, 'minecraft:bucket');
  assert.equal(f.inventory.getItem(3).amount, 1);
  advance(f.service, f.env, 199);
  assert.equal(f.inventory.getItem(4).amount, 1);
  assert.equal(f.inventory.getItem(3).amount, 1);
  assert.equal(f.dimension.drops.length, 0);
});

test('declared result counts require the whole paired output capacity and legacy strings still work', () => {
  const f = makeStove({ smokingRecipes: {
    'supplier:raw_cut': { output: 'supplier:cooked_cut', count: 2 },
    'supplier:raw_fish': 'supplier:cooked_fish',
  } });
  f.inventory.setItem(0, new FakeItem('supplier:raw_cut', 2));
  f.inventory.setItem(4, new FakeItem('supplier:cooked_cut', 63));
  f.inventory.setItem(1, new FakeItem('supplier:raw_fish', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 200);
  assert.equal(f.inventory.getItem(0).amount, 2);
  assert.equal(f.inventory.getItem(4).amount, 63);
  assert.equal(f.inventory.getItem(5).typeId, 'supplier:cooked_fish');
  f.inventory.setItem(4, new FakeItem('supplier:cooked_cut', 62));
  advance(f.service, f.env, 200);
  assert.equal(f.inventory.getItem(0).amount, 1);
  assert.equal(f.inventory.getItem(4).amount, 64);
  assert.equal(f.inventory.getItem(5).amount, 2);
});

test('provider additions and withdrawals affect the existing stove through its live ctx map', () => {
  const smokingRecipes = {};
  const f = makeStove({ smokingRecipes });
  f.inventory.setItem(0, new FakeItem('supplier:raw', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 200);
  assert.equal(f.inventory.getItem(3).amount, 1);
  smokingRecipes['supplier:raw'] = 'supplier:cooked';
  advance(f.service, f.env, 199);
  assert.equal(f.inventory.getItem(4), undefined);
  advance(f.service, f.env, 1);
  assert.equal(f.inventory.getItem(4).typeId, 'supplier:cooked');
  delete smokingRecipes['supplier:raw'];
  advance(f.service, f.env, 200);
  assert.equal(f.inventory.getItem(0).amount, 1);
  assert.equal(f.inventory.getItem(4).amount, 1);
});

test('input kind or metadata changes reset the shared batch while topping up the same identity does not', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 4));
  f.inventory.setItem(1, new FakeItem('minecraft:potato', 4));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 90);
  f.inventory.setItem(0, new FakeItem('minecraft:porkchop', 4));
  advance(f.service, f.env, 1);
  assert.equal(f.station.appliance.cookProgress, 1);
  advance(f.service, f.env, 30);
  const changed = f.inventory.getItem(0);
  changed.setLore(['different batch']);
  f.inventory.setItem(0, changed);
  advance(f.service, f.env, 1);
  assert.equal(f.station.appliance.cookProgress, 1);
  const toppedUp = f.inventory.getItem(0);
  toppedUp.amount = 8;
  f.inventory.setItem(0, toppedUp);
  advance(f.service, f.env, 1);
  assert.equal(f.station.appliance.cookProgress, 2);
  assert.equal(f.inventory.getItem(5), undefined, 'a different lane cannot inherit the old shared progress');
});

test('cancelled input selection keeps stock and progress; successfully taking it out resets and saves', async () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 4));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 70);
  await respondWith([choose(0), choose(1), { canceled: true }], () => f.service.onInteract(player, f.block));
  assert.equal(f.inventory.getItem(0).amount, 4);
  assert.equal(f.station.appliance.cookProgress, 70);
  assert.equal(player.container.emptySlotsCount, 36);
  await respondWith([choose(0), choose(1), choose(0)], () => f.service.onInteract(player, f.block));
  assert.equal(f.inventory.getItem(0), undefined);
  assert.equal(player.container.getItem(0).amount, 4);
  assert.equal(f.station.appliance.cookProgress, 0);
  assert.equal(f.saved.get(f.station.id).appliance.cookProgress, 0);
});

test('a successful UI top-up with identical metadata preserves the current progress', async () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  const raw = new FakeItem('minecraft:beef', 4);
  raw.nameTag = 'Kitchen stock'; raw.setLore(['same batch']);
  f.inventory.setItem(0, raw);
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 70);
  raw.amount = 3; player.container.setItem(0, raw);
  await respondWith([choose(0), choose(0), choose(0)], () => f.service.onInteract(player, f.block));
  assert.equal(f.inventory.getItem(0).amount, 7);
  assert.deepEqual(f.inventory.getItem(0).getLore(), ['same batch']);
  assert.equal(player.container.getItem(0), undefined);
  assert.equal(f.station.appliance.cookProgress, 70);
});

test('a full backpack refuses both raw-stock and finished-food collection without losing progress', async () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 4));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 70);
  f.inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 3));
  for (let slot = 0; slot < player.container.size; slot++) player.container.setItem(slot, new FakeItem('minecraft:stone', 64));
  await respondWith([choose(0), choose(1), choose(0)], () => f.service.onInteract(player, f.block));
  assert.equal(f.inventory.getItem(0).amount, 4);
  assert.equal(f.station.appliance.cookProgress, 70);
  // Outputs have only Take and Close, so Take is button 0.
  await respondWith([choose(4), choose(0), choose(0)], () => f.service.onInteract(player, f.block));
  assert.equal(f.inventory.getItem(4).amount, 3);
  assert.equal(f.station.appliance.cookProgress, 70);
  assert.equal(f.dimension.drops.length, 0);
});

test('a selected player stack that changes before confirmation is retained and does not reset progress', async () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 4));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 70);
  player.container.setItem(0, new FakeItem('minecraft:beef', 2));
  await respondWith([choose(0), choose(0), () => {
    const changed = new FakeItem('minecraft:beef', 2); changed.setLore(['changed batch']);
    player.container.setItem(0, changed);
    return choose(0);
  }], () => f.service.onInteract(player, f.block));
  assert.equal(f.inventory.getItem(0).amount, 4);
  assert.deepEqual(player.container.getItem(0).getLore(), ['changed batch']);
  assert.equal(f.station.appliance.cookProgress, 70);
});

test('a stove selection left open across an observed unload cannot regain access on reload', async () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 4));
  const originalShow = FakeForm.prototype.show;
  const getBlock = f.dimension.getBlock;
  let selected, reachedSelection;
  const selection = new Promise(resolve => { selected = resolve; });
  const selectionShown = new Promise(resolve => { reachedSelection = resolve; });
  let forms = 0;
  FakeForm.prototype.show = async function () {
    forms++;
    if (forms === 1) return choose(0);
    if (forms === 2) return choose(1);
    if (forms === 3) { reachedSelection(); return selection; }
    return { canceled: true };
  };
  try {
    f.service.onInteract(player, f.block);
    await selectionShown;
    f.dimension.getBlock = () => undefined;
    advance(f.service, f.env, 1);
    f.dimension.getBlock = getBlock;
    f.system.currentTick += 1000; f.service.tick();
    selected(choose(0)); await settle();
    assert.equal(player.container.emptySlotsCount, 36);
    assert.equal(f.inventory.getItem(0).amount, 4);
    assert.equal(forms, 3);
  } finally {
    selected({ canceled: true });
    f.dimension.getBlock = getBlock;
    FakeForm.prototype.show = originalShow;
    await settle();
  }
});

test('an observed unload saves the last loaded state and reload does not catch up unloaded time', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 37);
  const before = { ...f.station.appliance };
  const getBlock = f.dimension.getBlock;
  f.dimension.getBlock = () => undefined;
  advance(f.service, f.env, 1);
  assert.equal(f.saved.get(f.station.id).appliance.cookProgress, before.cookProgress);
  assert.equal(f.saved.get(f.station.id).appliance.litTime, before.litTime);
  f.system.currentTick += 1000; f.service.tick();
  f.dimension.getBlock = getBlock;
  f.system.currentTick++; f.service.tick();
  assert.equal(f.station.appliance.cookProgress, before.cookProgress);
  assert.equal(f.station.appliance.litTime, before.litTime);
  advance(f.service, f.env, 1);
  assert.equal(f.station.appliance.cookProgress, before.cookProgress + 1);
  assert.equal(f.inventory.getItem(4), undefined);
});

test('ignition is persisted immediately so reloading a JSON snapshot does not lose the consumed fuel', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 1);
  const snapshot = f.saved.get(f.station.id);
  assert.notEqual(snapshot, f.station);
  assert.notEqual(snapshot.appliance, f.station.appliance);
  assert.equal(f.inventory.getItem(3), undefined);
  assert.equal(snapshot.appliance.litDuration, 1600);
  assert.equal(snapshot.appliance.litTime, f.station.appliance.litTime);
  const loaded = restart(f);
  assert.equal(loaded.service.getStorage(loaded.station), f.inventory);
  advance(loaded.service, f.env, 200 - loaded.station.appliance.cookProgress);
  assert.equal(f.inventory.getItem(4).amount, 1);
  assert.equal(f.inventory.getItem(0).amount, 1);
  assert.equal(f.dimension.spawnCount, 1);
});

test('batch completion saves zero progress outside the periodic checkpoint and survives reload once', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 7);
  f.station.appliance.cookProgress = 199;
  advance(f.service, f.env, 1); // Tick 8 is deliberately not a 20-tick checkpoint.
  assert.equal(f.inventory.getItem(4).amount, 1);
  assert.equal(f.saved.get(f.station.id).appliance.cookProgress, 0);
  const loaded = restart(f);
  advance(loaded.service, f.env, 199);
  assert.equal(f.inventory.getItem(4).amount, 1);
  advance(loaded.service, f.env, 1);
  assert.equal(f.inventory.getItem(4).amount, 2);
  assert.equal(f.inventory.getItem(0), undefined);
});

test('legacy saved stoves seed new fields without resetting progress or consuming fuel again', () => {
  const f = makeStove();
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal', 2));
  f.inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 3));
  const legacy = JSON.parse(JSON.stringify(f.saved.get(f.station.id)));
  Object.assign(legacy.appliance, { litTime: 1200, litDuration: 1600, cookProgress: 73 });
  for (const key of ['inputKeys', 'firePhase', 'fireTicks', 'cycleFrame']) delete legacy.appliance[key];
  f.saved.set(legacy.id, JSON.parse(JSON.stringify(legacy)));

  const loaded = restart(f);
  assert.equal(loaded.station.appliance.cookProgress, 73);
  assert.equal(loaded.station.appliance.litTime, 1200);
  assert.equal(loaded.station.appliance.litDuration, 1600);
  assert.equal(loaded.service.getStorage(loaded.station), f.inventory);
  assert.equal(f.inventory.getItem(4).amount, 3);
  assert.equal(f.inventory.getItem(3).amount, 2);
  advance(loaded.service, f.env, 1);
  const seeded = f.saved.get(legacy.id).appliance;
  assert.equal(seeded.cookProgress, 74);
  assert.equal(seeded.inputKeys.length, 3);
  for (const key of ['firePhase', 'fireTicks', 'cycleFrame']) assert.equal(Number.isInteger(seeded[key]), true);

  const reloaded = restart(f);
  assert.equal(reloaded.station.appliance.cookProgress, 74);
  assert.deepEqual(reloaded.station.appliance.inputKeys, seeded.inputKeys);
  advance(reloaded.service, f.env, 125);
  assert.equal(reloaded.station.appliance.cookProgress, 199);
  assert.equal(f.inventory.getItem(4).amount, 3);
  advance(reloaded.service, f.env, 1); // 1 + 125 + 1 = the legacy batch's remaining 127 ticks.
  assert.equal(reloaded.station.appliance.cookProgress, 0);
  assert.equal(reloaded.station.appliance.litTime, 1200 - 127);
  assert.equal(f.inventory.getItem(0).amount, 1);
  assert.equal(f.inventory.getItem(4).amount, 4);
  assert.equal(f.inventory.getItem(3).amount, 2);
  assert.equal(f.dimension.spawnCount, 1);
});

test('breaking a stove drops all seven real stacks once and leaves no helper to recover twice', () => {
  const f = makeStove();
  const stacks = ['beef', 'potato', 'kelp', 'coal', 'cooked_beef', 'baked_potato', 'dried_kelp']
    .map((id, slot) => new FakeItem(`minecraft:${id}`, slot + 1));
  stacks[0].nameTag = 'Named raw stock'; stacks[0].setLore(['keep this batch']);
  stacks.forEach((stack, slot) => f.inventory.setItem(slot, stack));
  const oldPermutation = f.block.permutation;
  f.block.setType('minecraft:air');
  f.service.onBreak(f.block, f.station, oldPermutation);
  advance(f.service, f.env, 200);
  assert.equal(f.dimension.drops.length, 7);
  assert.deepEqual(f.dimension.drops.map(drop => appliances.itemFingerprint(drop.stack)), stacks.map(appliances.itemFingerprint));
  assert.equal(f.dimension.getEntities({ type: 'ordertocook:storage' }).length, 0);
  assert.equal(f.records.size, 0);
});
