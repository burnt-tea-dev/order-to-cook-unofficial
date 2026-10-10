// SPDX-License-Identifier: GPL-3.0-only
// Read-only status and service-boundary checks. Client HUD layout is tested by dot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEquipmentInspection } from '../runtime/BP/scripts/equipment_inspection.js';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place, advance } from './appliances.harness.js';

const baseline = (changes = {}) => ({
  phase: 0, remainingTicks: 0, plates: 0, litTime: 0, litDuration: 0, cookProgress: 0, ...changes,
});
const format = (type, fields = {}) => formatEquipmentInspection({ typeId: 'ordertocook:' + type, ...fields });

test('shelf HUD uses the actual packaging 10 and plate 18 capacities', () => {
  assert.equal(format('shelf', { supplies: 10 }), '§f包裝架 · 皮革 10/10');
  assert.equal(format('plate_shelf', { supplies: 18 }), '§f餐盤架 · 乾淨盤 18/18');
  assert.equal(format('shelf', { supplies: 0 }), '§f包裝架 · 皮革 0/10');
  assert.match(format('shelf', { supplies: 11 }), /資料異常/);
  assert.match(format('plate_shelf'), /資料異常/);
  assert.equal(formatEquipmentInspection({ typeId: 'minecraft:stone' }), undefined);
});

test('washer HUD distinguishes every phase and never calls dirty intake clean-ready', () => {
  const labels = ['等待髒盤', '關閉中', '收盤中', '清洗中', '出盤中', '可取乾淨盤'];
  for (let phase = 0; phase <= 5; phase++) {
    const plates = phase < 2 ? 0 : 16;
    assert.equal(format('dishwasher', { appliance: baseline({ phase, plates }) }),
      '§f洗碗機 · ' + labels[phase] + ' ' + plates + '/16');
  }
  assert.equal(format('washingtable', { appliance: baseline({ plates: 10 }) }), '§f洗碗池 · 髒盤 10/10');
  assert.match(format('washingtable', { appliance: baseline({ plates: 11 }) }), /資料異常/);
});

test('stove HUD derives cooking percentage and burn seconds from loaded tick state', () => {
  const appliance = baseline({ cookProgress: 99, litTime: 21, litDuration: 1600 });
  assert.equal(format('stove', { appliance, storageLoaded: true }), '§f爐灶 · 烹調 49% · 燃燒剩餘 2 秒');
  assert.equal(format('stove', { appliance, storageLoaded: false }), '§f爐灶 · 儲物尚未載入');
  assert.equal(appliance.cookProgress, 99);
  assert.equal(appliance.litTime, 21);
});

test('unavailable or malformed status does not become an invented empty inventory', () => {
  assert.equal(format('refrigerator', { upper: true, storageLoaded: false }), '§f冰箱 · 上層儲物尚未載入');
  assert.match(format('refrigerator', { upper: true, occupied: 28, storageLoaded: true }), /資料異常/);
  for (const appliance of [undefined, null, [], baseline({ plates: -1 }), baseline({ phase: 6 }), baseline({ litTime: NaN })]) {
    assert.match(format('dishwasher', { appliance }), /資料異常/);
  }
});

test('inspection of an unregistered appliance cannot create a station or helper', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx), player = new FakePlayer(env.dimension);
  const block = place(env, 'ordertocook:stove');
  env.ctx.getStation = () => { throw Error('inspection created a station'); };
  env.ctx.saveStation = () => { throw Error('inspection saved a station'); };
  env.dimension.spawnEntity = () => { throw Error('inspection created storage'); };
  assert.equal(service.getInspection(player, block), undefined);
  assert.equal(env.records.size, 0);
  assert.equal(env.dimension.spawnCount, 0);
});

test('fridge inspection reads only the viewed 27/54 partition without writing state', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  const service = appliances.createApplianceService(env.ctx);
  const lower = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(lower);
  const upper = env.dimension.getBlock({ x: 0, y: 1, z: 0 });
  const station = env.ctx.getStation(lower), inventory = service.getStorage(station);
  inventory.setItem(0, new FakeItem('minecraft:apple', 64));
  inventory.setItem(26, new FakeItem('minecraft:apple', 1));
  inventory.setItem(80, new FakeItem('minecraft:apple', 12));
  const original = JSON.stringify(station), items = JSON.stringify(inventory.slots);
  Object.freeze(station.appliance);
  Object.freeze(station);
  env.ctx.getStation = () => { throw Error('inspection requested a mutable station'); };
  env.ctx.saveStation = () => { throw Error('inspection saved data'); };
  env.dimension.spawnEntity = () => { throw Error('inspection replaced storage'); };
  assert.equal(service.getInspection(player, upper), '§f冰箱 · 上層 已用 2/27 格');
  assert.equal(service.getInspection(player, lower), '§f冰箱 · 下層 已用 1/54 格');
  assert.equal(JSON.stringify(station), original);
  assert.equal(JSON.stringify(inventory.slots), items);
  assert.equal(env.dimension.spawnCount, 1);
});

test('inspection of an unloaded saved helper preserves the helper identity and saved cargo', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(block);
  const station = env.ctx.getStation(block), helper = env.dimension.entities.get(station.storageId);
  helper.container.setItem(27, new FakeItem('minecraft:apple', 8));
  env.dimension.entities.delete(helper.id);
  const before = JSON.stringify(station);
  assert.equal(service.getInspection(player, block), '§f冰箱 · 下層儲物尚未載入');
  assert.equal(JSON.stringify(station), before);
  assert.equal(env.dimension.spawnCount, 1);
  assert.equal(helper.container.getItem(27).amount, 8);
  env.dimension.entities.set(helper.id, helper);
  assert.equal(service.getInspection(player, block), '§f冰箱 · 下層 已用 1/54 格');
});

test('a missing helper ID is never filled in by looking at a fridge', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  const station = env.ctx.getStation(block);
  assert.equal(station.storageId, undefined);
  assert.equal(service.getInspection(player, block), '§f冰箱 · 下層儲物尚未載入');
  assert.equal(station.storageId, undefined);
  assert.equal(station.appliance, undefined);
  assert.equal(env.dimension.spawnCount, 0);
});

test('a helper linked to another station never exposes that station inventory', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(block);
  const station = env.ctx.getStation(block), helper = env.dimension.entities.get(station.storageId);
  helper.setDynamicProperty('ordertocook:station_id', 'other-restaurant');
  helper.container.getItem = () => { throw Error('read foreign inventory'); };
  assert.equal(service.getInspection(player, block), '§f冰箱 · 下層儲物尚未載入');
});

test('inspection rechecks permission, dimension, distance and current block before reading inventory', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  let permitted = true;
  env.ctx.canUseStation = () => permitted;
  const service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:refrigerator', undefined, { 'ordertocook:half': 'lower' });
  service.onPlace(block);
  const station = env.ctx.getStation(block), inventory = service.getStorage(station);
  const originalRead = inventory.getItem.bind(inventory);
  let reads = 0;
  inventory.getItem = slot => { reads++; return originalRead(slot); };
  assert.match(service.getInspection(player, block), /下層 已用 0\/54/);
  reads = 0;
  permitted = false;
  assert.equal(service.getInspection(player, block), undefined);
  permitted = true;
  player.dimension = { ...env.dimension, id: 'minecraft:nether' };
  assert.equal(service.getInspection(player, block), undefined);
  player.dimension = env.dimension;
  player.location = { x: 7, y: 0, z: 0 };
  assert.equal(service.getInspection(player, block), undefined);
  player.location = { x: 0.5, y: 0, z: 0.5 };
  block.setType('minecraft:air');
  assert.equal(service.getInspection(player, block), undefined);
  assert.equal(reads, 0);
});

test('equipment inspection preserves malformed saved data for recovery', () => {
  const env = makeEnvironment(), service = appliances.createApplianceService(env.ctx), player = new FakePlayer(env.dimension);
  const block = place(env, 'ordertocook:dishwasher');
  const station = env.ctx.getStation(block);
  station.appliance = baseline({ plates: 99 });
  const before = JSON.stringify(station);
  env.ctx.saveStation = () => { throw Error('inspection repaired data'); };
  assert.match(service.getInspection(player, block), /資料異常/);
  assert.equal(JSON.stringify(station), before);
});

test('shelf inspection uses the persisted supply count and the permission callback', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), stranger = new FakePlayer(env.dimension);
  env.ctx.canUseStation = actor => actor.id === player.id;
  const service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:shelf'), station = env.ctx.getStation(block);
  station.supplies = 7;
  assert.equal(service.getInspection(player, block), '§f包裝架 · 皮革 7/10');
  assert.equal(service.getInspection(stranger, block), undefined);
  assert.equal(station.supplies, 7);
});

test('washing progress is a read-only HUD source and the service never writes the action bar', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  player.onScreenDisplay.setActionBar = () => { throw Error('multiple action-bar writers'); };
  const block = place(env, 'ordertocook:washingtable');
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block);
  player.viewedBlock = block;
  service.onInteract(player, block);
  service.tick();
  advance(service, env, 40);
  const before = JSON.stringify(env.ctx.getStation(block));
  assert.equal(service.getWashingProgress(player), '§b洗碗中 50%');
  assert.equal(service.getWashingProgress(player), '§b洗碗中 50%');
  assert.equal(JSON.stringify(env.ctx.getStation(block)), before);
  advance(service, env, 40);
  assert.equal(service.getWashingProgress(player), undefined);
  assert.equal(player.container.getItem(0).typeId, 'ordertocook:clean_plate');
});

test('looking away produces a bounded cancellation hint and leaves the dirty plate intact', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  const block = place(env, 'ordertocook:washingtable');
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block);
  player.viewedBlock = block;
  service.onInteract(player, block);
  service.tick();
  advance(service, env, 40);
  player.viewedBlock = undefined;
  assert.equal(service.getWashingProgress(player), undefined);
  advance(service, env, 1);
  assert.equal(service.getWashingProgress(player), '§7洗碗已中止');
  advance(service, env, 19);
  assert.equal(service.getWashingProgress(player), '§7洗碗已中止');
  advance(service, env, 1);
  assert.equal(service.getWashingProgress(player), undefined);
  assert.equal(env.ctx.getStation(block).appliance.plates, 1);
});

test('manual stop, restart and player departure cannot leave a stale washing HUD', () => {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension), service = appliances.createApplianceService(env.ctx);
  service.init();
  const block = place(env, 'ordertocook:washingtable');
  service.onPlace(block);
  player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block);
  player.viewedBlock = block;
  service.onInteract(player, block);
  service.onInteract(player, block);
  assert.equal(service.getWashingProgress(player), '§7洗碗已中止');
  service.onInteract(player, block);
  assert.equal(service.getWashingProgress(player), '§b洗碗中 0%');
  for (const callback of env.world.afterEvents.playerLeave.subscriptions) callback({ playerId: player.id });
  assert.equal(service.getWashingProgress(player), undefined);
});
