// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliances, FakeContainer, FakeItem, FakePlayer, FakeForm, makeEnvironment, place, advance } from './appliances.harness.js';

test('unstackable parcel transfers with its proof, name and lore intact', () => {
  const player = new FakeContainer(5), cooler = new FakeContainer(54);
  const parcel = new FakeItem('ordertocook:takeout_bag');
  parcel.nameTag = '已打包外送'; parcel.setLore(['牛排 × 2']); parcel.setDynamicProperty('ordertocook:proof', 'unique-proof');
  player.setItem(0, parcel);
  const result = appliances.transferStackToRange(player, 0, cooler, undefined, player.getItem(0));
  assert.equal(result.ok, true); assert.equal(player.getItem(0), undefined);
  assert.equal(appliances.itemFingerprint(cooler.getItem(0)), appliances.itemFingerprint(parcel));
});

test('a changed parcel proof invalidates an old form selection', () => {
  const source = new FakeContainer(1), target = new FakeContainer(2);
  const item = new FakeItem('ordertocook:food_plate'); item.setDynamicProperty('ordertocook:proof', 'old'); source.setItem(0, item);
  const expected = source.getItem(0); item.setDynamicProperty('ordertocook:proof', 'new'); source.setItem(0, item);
  assert.equal(appliances.transferStackToRange(source, 0, target, undefined, expected).ok, false);
  assert.equal(source.getItem(0).getDynamicProperty('ordertocook:proof'), 'new'); assert.equal(target.emptySlotsCount, 2);
});

test('full upper fridge refuses a stack instead of spilling into lower slots', () => {
  const source = new FakeContainer(1), fridge = new FakeContainer(81);
  source.setItem(0, new FakeItem('minecraft:apple', 12));
  for (let i = 0; i < 27; i++) fridge.setItem(i, new FakeItem('minecraft:stone', 64));
  assert.equal(appliances.transferStackToRange(source, 0, fridge, Array.from({ length: 27 }, (_, i) => i)).ok, false);
  assert.equal(source.getItem(0).amount, 12); assert.equal(fridge.getItem(27), undefined);
});

test('bounded transfer fills existing stack before using an empty slot', () => {
  const source = new FakeContainer(1), target = new FakeContainer(2);
  source.setItem(0, new FakeItem('minecraft:apple', 12)); target.setItem(0, new FakeItem('minecraft:apple', 60));
  assert.equal(appliances.transferStackToRange(source, 0, target).ok, true);
  assert.equal(target.getItem(0).amount, 64); assert.equal(target.getItem(1).amount, 8); assert.equal(source.getItem(0), undefined);
});

test('failed destination write rolls source and destination back', () => {
  const source = new FakeContainer(1), target = new FakeContainer(2);
  source.setItem(0, new FakeItem('minecraft:apple', 12)); target.setItem(0, new FakeItem('minecraft:apple', 60)); target.failNextSlot = 1;
  assert.throws(() => appliances.transferStackToRange(source, 0, target), /simulated/);
  assert.equal(source.getItem(0).amount, 12); assert.equal(target.getItem(0).amount, 60); assert.equal(target.getItem(1), undefined);
});

test('saved unloaded inventory is never replaced by a new empty helper', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  const station = env.ctx.getStation(block); station.storageId = 'not-loaded-yet';
  assert.equal(service.getStorage(station), undefined); assert.equal(env.dimension.spawnCount, 0); assert.equal(station.storageId, 'not-loaded-yet');
});

test('double fridge initialization preserves both halves and one inventory', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(block); const station = env.ctx.getStation(block); const helperId = station.storageId;
  service.getStorage(station).setItem(0, new FakeItem('minecraft:apple', 4)); service.onPlace(block);
  assert.equal(block.typeId, 'ordertocook:refrigerator'); assert.equal(env.dimension.getBlock({ x: 0, y: 1, z: 0 }).permutation.getState('ordertocook:half'), 'upper');
  assert.equal(station.storageId, helperId); assert.equal(env.dimension.spawnCount, 1); assert.equal(service.getStorage(station).getItem(0).amount, 4); assert.equal(env.dimension.drops.length, 0);
});

test('three stove lanes cook together after 200 ticks using one fuel supply', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:stove'); service.onPlace(block); const station = env.ctx.getStation(block); const inventory = service.getStorage(station);
  for (let i = 0; i < 3; i++) inventory.setItem(i, new FakeItem('minecraft:beef', 2)); inventory.setItem(3, new FakeItem('minecraft:coal'));
  service.tick(); advance(service, env, 199); assert.equal(inventory.getItem(4), undefined); advance(service, env, 1);
  for (let i = 0; i < 3; i++) { assert.equal(inventory.getItem(i).amount, 1); assert.equal(inventory.getItem(i + 4).typeId, 'minecraft:cooked_beef'); }
  assert.equal(inventory.getItem(3), undefined); assert.equal(station.appliance.litTime, 1401); assert.equal(station.appliance.cookProgress, 0);
});

test('blocked stove outputs preserve inputs and do not ignite new fuel', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:stove'); service.onPlace(block); const station = env.ctx.getStation(block); const inventory = service.getStorage(station);
  inventory.setItem(0, new FakeItem('minecraft:beef', 2)); inventory.setItem(4, new FakeItem('minecraft:cooked_beef', 64)); inventory.setItem(3, new FakeItem('minecraft:coal', 4));
  service.tick(); advance(service, env, 250);
  assert.equal(inventory.getItem(0).amount, 2); assert.equal(inventory.getItem(3).amount, 4); assert.equal(station.appliance.litTime, 0);
});

test('sixteen-plate washer follows 30+80+24 ticks and produces plates once', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx); const player = new FakePlayer(env.dimension);
  const block = place(env, 'ordertocook:dishwasher'); service.onPlace(block); const station = env.ctx.getStation(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate', 20)); service.onInteract(player, block); service.tick();
  assert.equal(player.container.getItem(0).amount, 4); assert.equal(station.appliance.phase, 2); assert.equal(station.appliance.plates, 16);
  assert.equal(block.permutation.getState('ordertocook:plates'), 0); assert.equal(block.permutation.getState('ordertocook:plates_high'), true);
  advance(service, env, 30); assert.equal(station.appliance.phase, 3); advance(service, env, 80); assert.equal(station.appliance.phase, 4);
  advance(service, env, 24); assert.equal(station.appliance.phase, 5); service.onInteract(player, block);
  assert.equal(station.appliance.plates, 0); assert.equal(station.appliance.phase, 1);
  assert.equal(player.container.slots.filter(stack => stack?.typeId === 'ordertocook:clean_plate').reduce((n, item) => n + item.amount, 0), 16);
  service.onInteract(player, block); assert.equal(station.appliance.phase, 1); advance(service, env, 14); assert.equal(station.appliance.phase, 0);
});

test('washing a sink requires staying empty-handed and facing it for 80 ticks', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx); const player = new FakePlayer(env.dimension);
  const block = place(env, 'ordertocook:washingtable'); service.onPlace(block); player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block); player.viewedBlock = block; service.onInteract(player, block); service.tick(); advance(service, env, 79);
  assert.equal(player.container.slots.some(stack => stack?.typeId === 'ordertocook:clean_plate'), false); advance(service, env, 1);
  assert.equal(env.ctx.getStation(block).appliance.plates, 0); assert.equal(player.container.getItem(0).typeId, 'ordertocook:clean_plate');
});

test('looking away cancels sink washing without deleting the dirty plate', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx); const player = new FakePlayer(env.dimension);
  const block = place(env, 'ordertocook:washingtable'); service.onPlace(block); player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block); player.viewedBlock = block; service.onInteract(player, block); service.tick(); advance(service, env, 40);
  player.viewedBlock = undefined; advance(service, env, 100);
  assert.equal(env.ctx.getStation(block).appliance.plates, 1); assert.equal(player.container.emptySlotsCount, 36);
});

test('staff permission revoked during a fridge selection prevents the transfer', async () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  let permitted = true;
  env.ctx.canUseStation = (actor, station) => actor === player && env.records.get(station.id) === station && permitted;
  const service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(block);
  const station = env.ctx.getStation(block), inventory = service.getStorage(station);
  const food = new FakeItem('minecraft:apple', 12); food.nameTag = 'Owner stock'; inventory.setItem(27, food);
  const originalShow = FakeForm.prototype.show;
  let showCount = 0, selectionReady, chooseItem;
  const itemFormShown = new Promise(resolve => { selectionReady = resolve; });
  const pendingSelection = new Promise(resolve => { chooseItem = resolve; });
  FakeForm.prototype.show = async function () {
    if (++showCount === 1) return { canceled: false, selection: 1 }; // Take from the lower compartment.
    selectionReady();
    return pendingSelection;
  };
  try {
    service.onInteract(player, block);
    await itemFormShown;
    permitted = false;
    chooseItem({ canceled: false, selection: 0 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(showCount, 2);
    assert.equal(player.container.emptySlotsCount, 36);
    assert.equal(inventory.getItem(27).amount, 12);
    assert.equal(inventory.getItem(27).nameTag, 'Owner stock');
    assert.equal(block.permutation.getState('ordertocook:open'), false);
  } finally {
    FakeForm.prototype.show = originalShow;
  }
});

test('staff permission revoked during washing leaves the dirty plate in the sink', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  let permitted = true;
  env.ctx.canUseStation = () => permitted;
  const service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:washingtable'); service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block); player.viewedBlock = block; service.onInteract(player, block);
  service.tick(); advance(service, env, 40); permitted = false; advance(service, env, 100);
  assert.equal(env.ctx.getStation(block).appliance.plates, 1);
  assert.equal(player.container.emptySlotsCount, 36);
});

test('init called after worldLoad starts ticking without waiting for another worldLoad', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx); service.init();
  assert.equal(env.world.afterEvents.worldLoad.subscriptions.length, 0);
  for (const callback of env.system.callbacks) callback(); assert.equal(env.system.intervals.length, 1); assert.equal(env.system.intervals[0].ticks, 2);
});

test('orphan recovery runs when five-tick intervals are offset from tick zero', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:stove'); service.onPlace(block); const station = env.ctx.getStation(block);
  service.getStorage(station).setItem(0, new FakeItem('minecraft:beef', 3)); block.setType('minecraft:air');
  for (let tick = 7; tick <= 112; tick += 5) { env.system.currentTick = tick; service.tick(); }
  assert.equal(env.dimension.drops.length, 1); assert.equal(env.dimension.drops[0].stack.amount, 3);
  assert.equal(env.dimension.getEntities({ type: 'ordertocook:storage' }).length, 0);
});
