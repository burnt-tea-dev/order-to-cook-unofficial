// SPDX-License-Identifier: GPL-3.0-only
// Isolated QA entry only. Native blocks/inventories/chunks; no connected players.
import { world, system, BlockPermutation, ItemStack } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { generateOrder, acceptOrder } from './core.js';
import { getStation, getStationById, saveStation, getRestaurant, saveRestaurant, nearbyStations } from './store.js';
import { nearbyStationBlocks, restaurantChairBlocks } from './station_poi.js';

// The disabled-beta run must prove that even this QA module did not execute.
console.warn('OTC_POI_LIFECYCLE_ENTRY');

const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
const key = 'ordertocook:qa_poi_lifecycle';
const origin = { x: 527, y: 70, z: 520 };
const locations = {
  board: { x: 528, y: 70, z: 520 },
  refrigerator: { x: 530, y: 70, z: 520 },
  shelf: { x: 532, y: 75, z: 525 },
  plate_shelf: { x: 532, y: 65, z: 525 },
  chair: { x: 532, y: 70, z: 522 }
};
const ownerId = 'poi-lifecycle-owner';
function loaded(dim, location) { try { return dim.getBlock(location); } catch { return undefined; } }
function rawRecord(prefix, id) {
  const root = prefix + id;
  const data = JSON.parse(String(world.getDynamicProperty(root)));
  return data.__otcParts ? JSON.parse(Array.from({ length: data.parts }, (_, i) =>
    world.getDynamicProperty(`${root}:part:${data.buffer}:${i}`)).join('')) : data;
}
function identity(record) {
  return { id: record.id, typeId: record.typeId, ownerId: record.ownerId,
    dimensionId: record.dimensionId, location: record.location,
    boardId: record.boardId, menu: record.menu, supplies: record.supplies, orders: record.orders,
    stats: record.stats, level: record.level, active: record.active, staff: record.staff };
}
function checkpoint(expected) {
  return JSON.stringify({
    restaurant: identity(rawRecord('ordertocook:r:', expected.restaurantId)),
    stations: expected.stationIds.map(id => identity(rawRecord('ordertocook:s:', id)))
  });
}
function addAreas(dim) {
  dim.runCommand('tickingarea add 512 70 512 527 70 527 otc_lifecycle_machine');
  dim.runCommand('tickingarea add 528 70 512 543 70 527 otc_lifecycle_equipment');
}
function report(mode, checks, details = {}) {
  console.warn('OTC_POI_LIFECYCLE ' + JSON.stringify({ mode, passed: checks.every(c => c.passed), checks, ...details }));
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:poi_lifecycle') return;
  run(event.message).catch(error => report(event.message,
    [{ name: 'probe completed', passed: false, detail: String(error?.stack || error) }]));
});

async function run(mode) {
  const checks = [];
  const test = (name, condition, detail) => checks.push({ name, passed: !!condition, ...(detail === undefined ? {} : { detail }) });
  const hooks = getQaHooks(), dim = world.getDimension('overworld');
  let expected = JSON.parse(String(world.getDynamicProperty(key) || 'null'));
  if (mode === 'poi-off') {
    test('POI-disabled startup refuses gameplay initialization', !hooks.ready);
    test('POI-disabled startup preserves canonical fixture records', checkpoint(expected) === expected.records);
    return report(mode, checks);
  }
  test('current production entry initialized', hooks.ready);
  if (!hooks.ready) return report(mode, checks);
  if (mode === 'prepare') {
    addAreas(dim);
    await wait(80);
    const place = (type, location) => {
      const block = dim.getBlock(location);
      block.setPermutation(BlockPermutation.resolve('ordertocook:' + type,
        type === 'refrigerator' ? { 'ordertocook:half': 'lower' } : undefined));
      hooks.onPlace(block);
      return block;
    };
    const machine = place('order_machine', origin);
    const stationIds = [];
    for (const [type, location] of Object.entries(locations)) {
      const block = place(type, location), station = getStation(block);
      station.ownerId = ownerId;
      if (type === 'board') station.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: 'Lifecycle bread' }];
      if (type === 'shelf') station.supplies = 7;
      if (type === 'plate_shelf') station.supplies = 17;
      saveStation(station);
      stationIds.push(station.id);
    }
    await wait(20);
    const restaurant = hooks.getMachine({ id: ownerId, name: 'Native QA' }, machine);
    restaurant.active = false;
    restaurant.orders = [];
    const order = generateOrder(restaurant, Date.now(), () => 0.9);
    // A real canonical accepted order, with time to finish all restart scenarios.
    order.expiresAt = Date.now() + 60 * 60 * 1000;
    const accepted = acceptOrder(restaurant, order.id);
    test('canonical accepted-order fixture is nonempty', accepted.ok && order.status === 'accepted' && order.items.length > 0);
    saveRestaurant(restaurant);
    const fridge = getStation(dim.getBlock(locations.refrigerator));
    const inventory = hooks.appliances.getStorage(fridge);
    for (const slot of [0, 27]) {
      const item = new ItemStack('minecraft:bread', slot === 0 ? 11 : 13);
      item.nameTag = 'Native lifecycle ' + slot;
      inventory.setItem(slot, item);
    }
    await wait(25);
    expected = { restaurantId: restaurant.id, stationIds, fridgeId: fridge.id, boardId: restaurant.boardId };
    expected.records = checkpoint(expected);
    world.setDynamicProperty(key, JSON.stringify(expected));
    test('menu bound from native POI', restaurant.boardId === getStation(dim.getBlock(locations.board)).id);
    test('five native station types found', Object.entries(locations).every(([type, position]) =>
      nearbyStationBlocks(dim, origin, 'ordertocook:' + type, 24).some(b =>
        b.location.x === position.x && b.location.y === position.y && b.location.z === position.z)));
    test('Java packaging cube includes three-axis corner', nearbyStations(dim.id, origin, 5, 'ordertocook:shelf', { shape: 'cube' }).length === 1);
    test('Java plate cube includes negative-Y corner', nearbyStations(dim.id, origin, 5, 'ordertocook:plate_shelf', { shape: 'cube' }).length === 1);
    test('fridge lower and upper share one indexed inventory', nearbyStations(dim.id, origin, 24, 'ordertocook:refrigerator').length === 1);
  } else if (mode === 'unload') {
    dim.runCommand('tickingarea remove otc_lifecycle_equipment');
    dim.runCommand('tickingarea remove otc_lifecycle_machine');
    let ticks = 0;
    while (loaded(dim, locations.board) && ticks < 600) { await wait(20); ticks += 20; }
    const absent = !loaded(dim, locations.board);
    test('actual native equipment chunk becomes unreadable', absent, { waitedTicks: ticks });
    if (absent) {
      const restaurant = getRestaurant(expected.restaurantId);
      let deferred = false;
      try { hooks.syncMenu(restaurant); } catch { deferred = true; }
      test('unloaded bound board defers menu rebinding', deferred);
      test('unloaded block candidates do not return usable stations',
        Object.keys(locations).every(type => nearbyStationBlocks(dim, origin, 'ordertocook:' + type, 24).length === 0));
      hooks.tickRestaurants();
      test('native unload leaves saved menu and supply records intact', checkpoint(expected) === expected.records);
      test('unloaded chair is not a usable seat', restaurantChairBlocks(dim, origin).length === 0);
    }
    addAreas(dim);
    await wait(100);
    test('chunk reload restores five native station kinds', Object.keys(locations).every(type =>
      nearbyStationBlocks(dim, origin, 'ordertocook:' + type, 24).length === 1));
    test('reloaded menu and supply records match saved checkpoint', checkpoint(expected) === expected.records);
  } else if (mode === 'restore') {
    await wait(60);
    test('experiment re-enable retains canonical records', checkpoint(expected) === expected.records);
    test('re-enable reindexes all five already placed station kinds', Object.keys(locations).every(type =>
      nearbyStationBlocks(dim, origin, 'ordertocook:' + type, 24).length === 1));
    test('board binding is unchanged', getRestaurant(expected.restaurantId)?.boardId === expected.boardId);
  } else throw new Error('Unknown lifecycle mode: ' + mode);
  const inventory = hooks.appliances.getStorage(getStationById(expected.fridgeId));
  test('named upper-tier native food retained', inventory?.getItem(0)?.typeId === 'minecraft:bread' && inventory.getItem(0)?.amount === 11 && inventory.getItem(0)?.nameTag === 'Native lifecycle 0');
  test('named lower-tier native food retained', inventory?.getItem(27)?.typeId === 'minecraft:bread' && inventory.getItem(27)?.amount === 13 && inventory.getItem(27)?.nameTag === 'Native lifecycle 27');
  report(mode, checks);
}
