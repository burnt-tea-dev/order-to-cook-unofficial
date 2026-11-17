// SPDX-License-Identifier: GPL-3.0-only
// Production stove service with engine/form doubles. These are not BDS or GUI tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place, advance } from './appliances.harness.js';

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

test('native input removal resets progress while same-identity stock keeps it', () => {
  const f = makeStove();
  const raw = new FakeItem('minecraft:beef', 4); raw.nameTag = 'Kitchen stock'; raw.setLore(['same batch']);
  f.inventory.setItem(0, raw); f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 70);
  assert.equal(f.station.appliance.cookProgress, 70);
  raw.amount = 7; f.inventory.setItem(0, raw); advance(f.service, f.env, 1);
  assert.equal(f.station.appliance.cookProgress, 71);
  f.inventory.setItem(0, undefined); advance(f.service, f.env, 1);
  assert.equal(f.station.appliance.cookProgress, 0);
  assert.equal(f.saved.get(f.station.id).appliance.cookProgress, 0);
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
  assert.equal(f.dimension.spawnCount, 0);
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
  assert.equal(f.dimension.spawnCount, 0);
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


test('stove clicks use the native container and never script-debit held stock', () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  player.container.setItem(0, new FakeItem('minecraft:beef', 6));
  assert.equal(f.service.canOpenStove(player, f.block), false, 'the first use must still claim the station');
  f.station.ownerId = player.id;
  assert.equal(f.service.canOpenStove(player, f.block), true);
  f.service.onInteract(player, f.block, { nativeEntryCancelled: true });
  assert.equal(player.messages.length, 1);
  assert.match(player.messages[0], /再次點擊.*原生容器/);
  f.service.onInteract(player, f.block);
  assert.equal(player.messages.length, 1, 'the normal native after callback must remain quiet');
  assert.equal(player.container.getItem(0).amount, 6);
  assert.equal(f.inventory.getItem(0), undefined);
  assert.equal(f.inventory, f.block.getComponent('minecraft:inventory').container);
});
