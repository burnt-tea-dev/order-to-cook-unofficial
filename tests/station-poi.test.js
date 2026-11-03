// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { nearbyStationBlocks, restaurantChairBlocks, requireStationPoi } from '../runtime/BP/scripts/station_poi.js';
import { FakeContainer, FakeItem, FakePlayer, makeEnvironment, place } from './appliances.harness.js';
import { mainFixture } from './main.harness.js';

const origin = { x: 0, y: 0, z: 0 };

function savedRestaurant(env) {
  const key = 'ordertocook:r:' + env.restaurant.id;
  const manifest = JSON.parse(env.properties.get(key));
  return manifest.__otcParts ? JSON.parse(Array.from({ length: manifest.parts }, (_, i) =>
    env.properties.get(`${key}:part:${manifest.buffer}:${i}`)).join('')) : manifest;
}

function silenceWarning(action) {
  const warn = console.warn; console.warn = () => {};
  try { return action(); } finally { console.warn = warn; }
}

test('POI sphere results are ordered by distance and never expand the exact radius', () => {
  const env = makeEnvironment();
  const far = place(env, 'ordertocook:shelf', { x: 5, y: 0, z: 0 });
  const near = place(env, 'ordertocook:shelf', { x: 1, y: 0, z: 0 });
  const outside = place(env, 'ordertocook:shelf', { x: 5, y: 1, z: 0 });
  const calls = [];
  env.dimension.poiManager.blocks.getInRange = (...args) => {
    calls.push(args); return [outside, far, near, near].map(b => ({ position: b.location }));
  };
  assert.deepEqual(nearbyStationBlocks(env.dimension, origin, 'ordertocook:shelf', 5), [near, far]);
  assert.deepEqual(calls, [[{ name: 'ordertocook:shelf' }, origin, 5]]);
});

test('chair candidates retain horizontal radius 24 and Y ±8 including the elevated edge', () => {
  const env = makeEnvironment();
  const edge = place(env, 'ordertocook:chair', { x: 24, y: 8, z: 0 });
  place(env, 'ordertocook:chair', { x: 24, y: 9, z: 0 });
  place(env, 'ordertocook:chair', { x: 20, y: 0, z: 20 });
  const below = place(env, 'ordertocook:chair', { x: 0, y: -8, z: 0 });
  place(env, 'ordertocook:chair', { x: 0, y: -9, z: 0 });
  assert.deepEqual(restaurantChairBlocks(env.dimension, origin), [below, edge]);
});

test('board lookup matches Java horizontal radius 24 and Y ±8 instead of accepting square corners', () => {
  const env = makeEnvironment();
  const edge = place(env, 'ordertocook:board', { x: 24, y: 8, z: 0 });
  place(env, 'ordertocook:board', { x: 24, y: 9, z: 0 });
  place(env, 'ordertocook:board', { x: 20, y: 0, z: 20 });
  place(env, 'ordertocook:board', { x: 25, y: 0, z: 0 });
  assert.deepEqual(nearbyStationBlocks(env.dimension, origin, 'ordertocook:board', 24, { shape: 'cylinder', halfHeight: 8 }), [edge]);
});

test('Java supply range includes cube corners while refrigerator range remains spherical', () => {
  const env = makeEnvironment();
  const corner = place(env, 'ordertocook:shelf', { x: 5, y: 5, z: 5 });
  place(env, 'ordertocook:shelf', { x: 5, y: 6, z: 5 });
  place(env, 'ordertocook:shelf', { x: 6, y: 0, z: 0 });
  const calls = [];
  const query = env.dimension.poiManager.blocks.getInSquare;
  env.dimension.poiManager.blocks.getInSquare = (...args) => { calls.push(args); return query(...args); };
  assert.deepEqual(nearbyStationBlocks(env.dimension, origin, 'ordertocook:shelf', 5, { shape: 'cube' }), [corner]);
  assert.deepEqual(calls, [[{ name: 'ordertocook:shelf' }, origin, 5]]);
  const fridge = place(env, 'ordertocook:refrigerator', { x: 24, y: 0, z: 0 });
  place(env, 'ordertocook:refrigerator', { x: 24, y: 1, z: 0 });
  assert.deepEqual(nearbyStationBlocks(env.dimension, origin, 'ordertocook:refrigerator', 24), [fridge]);
});

test('index hits are revalidated; removed, unloaded and upper fridge halves are excluded', () => {
  const env = makeEnvironment();
  const lower = place(env, 'ordertocook:refrigerator', origin, { 'ordertocook:half': 'lower' });
  const upper = place(env, 'ordertocook:refrigerator', { x: 0, y: 1, z: 0 }, { 'ordertocook:half': 'upper' });
  const removed = place(env, 'minecraft:air', { x: 2, y: 0, z: 0 });
  const unloaded = { x: 3, y: 0, z: 0 };
  env.dimension.poiManager.blocks.getInRange = () => [lower.location, upper.location, removed.location, unloaded].map(position => ({ position }));
  const getBlock = env.dimension.getBlock.bind(env.dimension);
  env.dimension.getBlock = p => { if (p.x === 3) throw Error('unloaded'); return getBlock(p); };
  assert.deepEqual(nearbyStationBlocks(env.dimension, origin, 'ordertocook:refrigerator', 24), [lower]);
});

test('missing or disabled POI fails explicitly without substituting an empty search', () => {
  assert.throws(() => requireStationPoi({}), /Beta APIs and Points of Interest/);
  const disabled = { get poiManager() { throw Error('POI experiment is disabled'); } };
  assert.throws(() => requireStationPoi(disabled), /POI experiment is disabled/);
  const env = makeEnvironment();
  env.dimension.poiManager.blocks.getInRange = () => { throw Error('native query unavailable'); };
  assert.throws(() => nearbyStationBlocks(env.dimension, origin, 'ordertocook:shelf', 5), /native query unavailable/);
});

test('startup without POI stops before opening services or modifying saved state', async () => {
  const errors = [], original = console.error;
  console.error = message => errors.push(message);
  let env;
  try { env = await mainFixture({ withoutPoi: true, prepareRestaurant: false }); }
  finally { console.error = original; }
  assert.equal(env.hooks.ready, false);
  assert.equal(env.system.intervals.length, 0);
  assert.equal(env.properties.size, 0);
  assert.match(errors.join('\n'), /Initialization stopped.*Beta APIs and Points of Interest/);
});

test('POI discoveries join canonical station data without creating ownership or inventory records', async () => {
  const env = await mainFixture();
  const shelf = place(env, 'ordertocook:shelf', { x: 3, y: 0, z: 0 });
  const unknown = place(env, 'ordertocook:shelf', { x: 1, y: 0, z: 0 });
  const replaced = place(env, 'ordertocook:board', { x: 2, y: 0, z: 0 });
  const stale = env.store.getStation(replaced); stale.ownerId = 'old-owner'; env.store.saveStation(stale);
  replaced.setType('ordertocook:shelf');
  const record = env.store.getStation(shelf); record.ownerId = 'owner'; record.supplies = 7; env.store.saveStation(record);
  const before = new Map(env.properties), count = env.store.stations().length;
  assert.deepEqual(env.store.nearbyStations(env.dimension.id, origin, 5, 'ordertocook:shelf'), [record]);
  assert.equal(env.store.findStation(unknown), undefined);
  assert.equal(env.store.stations().length, count);
  assert.deepEqual(env.properties, before);
  assert.equal(record.ownerId, 'owner'); assert.equal(record.supplies, 7);
  assert.equal(env.store.getStationById(stale.id).typeId, 'ordertocook:board');
});

test('before-placement overlap and before-break authorization never read the POI manager', async () => {
  const env = await mainFixture();
  const components = new Map();
  for (const callback of env.system.beforeEvents.startup.subscriptions) callback({
    blockComponentRegistry: { registerCustomComponent: (name, handlers) => components.set(name, handlers) },
    itemComponentRegistry: { registerCustomComponent() {} },
  });
  let poiReads = 0;
  Object.defineProperty(env.dimension, 'poiManager', { get() { poiReads++; throw Error('restricted execution'); } });
  const target = env.dimension.getBlock({ x: 10, y: 0, z: 0 });
  const placing = { block: target, permutationToPlace: { type: { id: 'ordertocook:order_machine' } }, player: env.player, cancel: false };
  components.get('ordertocook:interact').beforeOnPlayerPlace(placing);
  assert.equal(placing.cancel, true);
  const chair = place(env, 'ordertocook:chair', { x: 2, y: 0, z: 0 });
  const breaking = { block: chair, player: { id: 'stranger', hasTag: () => false, getGameMode: () => 'Survival' }, cancel: false };
  for (const callback of env.world.beforeEvents.playerBreakBlock.subscriptions) callback(breaking);
  assert.equal(breaking.cancel, true);
  assert.equal(poiReads, 0);
});

test('equal nutrition menus select the nearest authorized canonical board independent of index order', async () => {
  const env = await mainFixture();
  const board = (x, ownerId, nutrition) => {
    const block = place(env, 'ordertocook:board', { x, y: 0, z: 0 });
    const record = env.store.getStation(block);
    Object.assign(record, { ownerId, menu: [{ typeId: 'test:meal', label: 'Meal', nutrition }] });
    env.store.saveStation(record); return record;
  };
  const far = board(10, env.player.id, 8), near = board(4, env.player.id, 8);
  board(2, 'stranger', 100);
  const cornerBlock = place(env, 'ordertocook:board', { x: 20, y: 0, z: 20 });
  const corner = env.store.getStation(cornerBlock);
  Object.assign(corner, { ownerId: env.player.id, menu: [{ typeId: 'test:meal', label: 'Corner', nutrition: 100 }] });
  env.store.saveStation(corner);
  env.hooks.tickRestaurants();
  assert.equal(env.restaurant.boardId, near.id);
  assert.deepEqual(env.restaurant.menu, near.menu);
  assert.notEqual(env.restaurant.boardId, far.id);
});

test('POI menu selection and equipment use honor staff revocation without storing POI ownership', async () => {
  const env = await mainFixture();
  const employee = new FakePlayer(env.dimension, { x: 2, y: 0, z: 1 });
  employee.getGameMode = () => 'Survival';
  env.restaurant.staff = [employee.id];
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);
  const records = ['board', 'chair', 'refrigerator', 'shelf', 'plate_shelf'].map((kind, index) => {
    const station = env.store.getStation(place(env, 'ordertocook:' + kind, { x: index + 2, y: 0, z: 0 }));
    station.ownerId = employee.id;
    if (kind === 'board') station.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: 'Employee menu' }];
    env.store.saveStation(station);
    assert.equal(env.hooks.canUseStation(employee, station), true);
    assert.equal(env.hooks.canUseStation(env.player, station), true);
    return station;
  });
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, records[0].id);
  env.restaurant.staff = [];
  env.store.saveRestaurant(env.restaurant);
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, '');
  assert.deepEqual(savedRestaurant(env).menu, []);
  for (const station of records) {
    assert.equal(env.hooks.canUseStation(employee, station), false, station.typeId);
    assert.equal(env.hooks.canUseStation(env.player, station), true, station.typeId);
    assert.equal(env.store.getStationById(station.id).ownerId, employee.id);
  }
});

for (const [orderType, shelfType] of [['delivery', 'shelf'], ['dine_in', 'plate_shelf']]) {
  test(`countertop can consume a Java-valid ${shelfType} at the diagonal cube boundary`, async () => {
    const env = await mainFixture();
    const counter = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
    const shelf = env.store.getStation(place(env, 'ordertocook:' + shelfType, { x: 6, y: 5, z: 5 }));
    shelf.ownerId = env.player.id; shelf.supplies = 2; env.store.saveStation(shelf);
    env.order.type = orderType; env.order.status = 'accepted';
    env.order.items = [{ typeId: 'minecraft:bread', amount: 1, nutrition: 5, label: 'Bread' }];
    env.player.container.setItem(0, new FakeItem('minecraft:bread'));
    env.store.saveRestaurant(env.restaurant);

    env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, env.order);
    assert.equal(env.order.status, 'packed');
    assert.equal(shelf.supplies, 1);
    assert.equal(env.player.container.getItem(0), undefined);
    assert.equal(counter.above().typeId, orderType === 'delivery' ? 'ordertocook:takeout_bag' : 'ordertocook:food_plate_display');
  });

  test(`POI ${shelfType} and fridge queries cannot consume a neighboring restaurant's supplies`, async () => {
    const env = await mainFixture();
    const neighbor = new FakePlayer(env.dimension, { x: 30, y: 0, z: 0 });
    neighbor.getGameMode = () => 'Survival';
    env.hooks.getMachine(neighbor, place(env, 'ordertocook:order_machine', { x: 30, y: 0, z: 0 }));
    const counter = place(env, 'ordertocook:countertop', { x: 14, y: 0, z: 0 });
    env.player.location = { x: 14.5, y: 0, z: 0.5 };
    const station = (kind, x, z, ownerId) => {
      const record = env.store.getStation(place(env, 'ordertocook:' + kind, { x, y: 0, z }));
      record.ownerId = ownerId; record.supplies = 3;
      env.store.saveStation(record); return record;
    };
    const forbiddenShelf = station(shelfType, 16, 0, neighbor.id);
    const ownShelf = station(shelfType, 10, 0, env.player.id);
    const forbiddenFridge = station('refrigerator', 16, 1, neighbor.id);
    const ownFridge = station('refrigerator', 8, 0, env.player.id);
    const foreignFood = new FakeContainer(27), ownFood = new FakeContainer(27);
    foreignFood.setItem(0, new FakeItem('minecraft:bread', 9));
    ownFood.setItem(0, new FakeItem('minecraft:bread', 3));
    const storageReads = [];
    env.hooks.appliances.getStorage = record => {
      storageReads.push(record.id);
      return record.id === ownFridge.id ? ownFood : foreignFood;
    };
    env.order.type = orderType; env.order.status = 'accepted';
    env.order.items = [{ typeId: 'minecraft:bread', amount: 3, nutrition: 5, label: 'Bread' }];
    env.store.saveRestaurant(env.restaurant);

    env.hooks.prepareOrderAtCountertop(env.player, counter, env.restaurant, env.order);
    assert.equal(env.order.status, 'packed');
    assert.equal(ownShelf.supplies, 2);
    assert.equal(forbiddenShelf.supplies, 3);
    assert.equal(ownFood.getItem(0), undefined);
    assert.equal(foreignFood.getItem(0).amount, 9);
    assert.deepEqual(storageReads, [ownFridge.id]);
    assert.equal(env.store.getStationById(forbiddenFridge.id).ownerId, neighbor.id);
  });
}

test('menu POI failure cannot lose an expiry commit or count its failure again after recovery', async () => {
  const env = await mainFixture();
  env.order.expiresAt = Date.now() - 1;
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);
  const query = env.dimension.poiManager.blocks.getInSquare;
  env.dimension.poiManager.blocks.getInSquare = () => { throw Error('menu index unavailable'); };
  silenceWarning(() => env.hooks.tickRestaurants());
  assert.equal(env.order.status, 'expired');
  let saved = savedRestaurant(env);
  assert.equal(saved.orders.find(order => order.id === env.order.id).status, 'expired');
  assert.equal(saved.stats.failed, 1);
  env.dimension.poiManager.blocks.getInSquare = query;
  env.hooks.tickRestaurants();
  saved = savedRestaurant(env);
  assert.equal(saved.orders.find(order => order.id === env.order.id).status, 'expired');
  assert.equal(saved.stats.failed, 1);
});

test('chair POI failure preserves a completed refresh and retries walk-in generation without advancing its clock', async () => {
  const env = await mainFixture();
  const board = env.store.getStation(place(env, 'ordertocook:board', { x: 1, y: 0, z: 0 }));
  board.menu = [{ typeId: 'minecraft:bread', label: 'Bread', nutrition: 5 }]; env.store.saveStation(board);
  env.restaurant.active = true;
  env.restaurant.nextRefreshAt = 0; env.restaurant.nextWalkInAt = 0;
  env.restaurant.config.walkInChances = Array(9).fill(1);
  env.store.saveRestaurant(env.restaurant);
  const query = env.dimension.poiManager.blocks.getInSquare;
  env.dimension.poiManager.blocks.getInSquare = (filter, ...args) => {
    if (filter.name === 'ordertocook:chair') throw Error('chair index unavailable');
    return query(filter, ...args);
  };
  silenceWarning(() => env.hooks.tickRestaurants());
  let saved = savedRestaurant(env);
  assert.ok(saved.orders.some(order => order.status === 'offered' && !order.walkIn));
  assert.equal(saved.nextRefreshAt, env.restaurant.nextRefreshAt);
  assert.ok(saved.nextRefreshAt > Date.now());
  assert.equal(saved.nextWalkInAt, 0);
  assert.equal(saved.orders.filter(order => order.walkIn).length, 0);
  env.dimension.poiManager.blocks.getInSquare = query;
  env.hooks.tickRestaurants();
  saved = savedRestaurant(env);
  assert.ok(saved.nextWalkInAt > Date.now());
  assert.equal(saved.orders.filter(order => order.walkIn).length, 1);
});

test('POI menu rebinding persists across restart even with an inactive restaurant', async () => {
  const env = await mainFixture();
  const block = place(env, 'ordertocook:board', { x: 3, y: 0, z: 1 });
  const board = env.store.getStation(block);
  board.ownerId = env.player.id;
  const dish = variant => ({
    typeId: 'test:meal', label: '保存的變體 ' + variant, nutrition: 9,
    foodIdentity: { carrier: 'senluo.public.food.v1', nativeVariant: variant }
  });
  board.menu = [dish(7)];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);

  // No active order refresh or expiry should be required to save a new board.
  env.hooks.tickRestaurants();
  let persisted = savedRestaurant(env);
  assert.equal(persisted.boardId, board.id);
  assert.deepEqual(persisted.menu, [dish(7)]);

  const original = env.world.setDynamicProperty.bind(env.world);
  let rootWrites = 0;
  env.world.setDynamicProperty = (key, value) => {
    if (key === 'ordertocook:r:' + env.restaurant.id) rootWrites++;
    return original(key, value);
  };
  env.hooks.tickRestaurants();
  assert.equal(rootWrites, 0, 'stable POI menu must not rewrite the restaurant every tick');

  board.menu = [dish(8)];
  env.store.saveStation(board);
  env.hooks.tickRestaurants();
  persisted = savedRestaurant(env);
  assert.deepEqual(persisted.menu, [dish(8)], 'variant identity is persisted, not just cached');

  block.setType('minecraft:air');
  env.hooks.tickRestaurants();
  persisted = savedRestaurant(env);
  assert.equal(persisted.boardId, '');
  assert.deepEqual(persisted.menu, [], 'removed POI board must not resurrect its menu after reload');
});

test('an unloaded previously bound POI board preserves the saved menu until it returns', async () => {
  const env = await mainFixture();
  const block = place(env, 'ordertocook:board', { x: 3, y: 0, z: 1 });
  const board = env.store.getStation(block);
  board.ownerId = env.player.id;
  board.menu = [{ typeId: 'minecraft:bread', label: '保存中的麵包', nutrition: 6 }];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);
  env.hooks.tickRestaurants();
  const saved = savedRestaurant(env);
  assert.equal(saved.boardId, board.id);

  const originalGetBlock = env.dimension.getBlock;
  env.dimension.getBlock = position => {
    if (position.x === block.location.x && position.y === block.location.y && position.z === block.location.z) {
      throw Error('board chunk temporarily unloaded');
    }
    return originalGetBlock(position);
  };
  silenceWarning(() => env.hooks.tickRestaurants());
  assert.equal(env.restaurant.boardId, board.id, 'missing chunk is not a removed board');
  assert.deepEqual(savedRestaurant(env).menu, saved.menu);
  assert.equal(savedRestaurant(env).boardId, board.id);

  env.dimension.getBlock = originalGetBlock;
  board.menu = [{ typeId: 'minecraft:carrot', label: '已恢復的菜品', nutrition: 7 }];
  env.store.saveStation(board);
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, board.id);
  assert.deepEqual(savedRestaurant(env).menu, board.menu);
});

test('physically loaded bound board survives a transient missing POI index entry', async () => {
  const env = await mainFixture();
  const block = place(env, 'ordertocook:board', { x: 4, y: 0, z: 0 });
  const board = env.store.getStation(block);
  board.ownerId = env.player.id;
  board.menu = [{ typeId: 'minecraft:bread', nutrition: 11, label: '已載入的立牌' }];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, board.id);

  const query = env.dimension.poiManager.blocks.getInSquare;
  env.dimension.poiManager.blocks.getInSquare = (filter, ...args) =>
    filter.name === 'ordertocook:board' ? [] : query(filter, ...args);
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, board.id);
  assert.deepEqual(savedRestaurant(env).menu, board.menu);
  env.dimension.poiManager.blocks.getInSquare = query;
});

test('POI menu rebinding retries after a rejected restaurant commit without losing the old snapshot', async () => {
  const env = await mainFixture();
  const block = place(env, 'ordertocook:board', { x: 3, y: 0, z: 1 });
  const board = env.store.getStation(block);
  board.ownerId = env.player.id;
  board.menu = [{ typeId: 'minecraft:bread', label: '新立牌', nutrition: 12 }];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);
  const before = savedRestaurant(env), rootKey = 'ordertocook:r:' + env.restaurant.id;
  env.failWrite(id => id === rootKey);
  silenceWarning(() => env.hooks.tickRestaurants());
  assert.deepEqual(savedRestaurant(env), before, 'failed commit cannot replace the saved menu or order ledger');
  assert.deepEqual(env.store.getRestaurant(env.restaurant.id), before, 'canonical cache rolls back to a readable snapshot');
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, board.id);
  assert.deepEqual(savedRestaurant(env).menu, board.menu);
  assert.deepEqual(savedRestaurant(env).orders, before.orders);
  assert.equal(env.store.stations().length, 1);
});

test('cancelling an upgrade saves a newly discovered POI menu before the next idle tick', async () => {
  const env = await mainFixture();
  const board = env.store.getStation(place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 }));
  board.ownerId = env.player.id;
  board.menu = [{ typeId: 'minecraft:carrot', label: 'New menu', nutrition: 3 }];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.store.saveRestaurant(env.restaurant);
  env.formResponses.push(1);

  await env.hooks.upgradeForm(env.player, env.machine, env.restaurant);
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, board.id);
  assert.deepEqual(savedRestaurant(env).menu, board.menu);
});

test('upgrade confirmation saves a changed POI menu even when nutrition no longer permits upgrading', async () => {
  const env = await mainFixture();
  const board = env.store.getStation(place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 }));
  board.ownerId = env.player.id;
  board.menu = [{ typeId: 'minecraft:bread', label: 'Old menu', nutrition: 100 }];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.hooks.getMachine(env.player, env.machine);
  env.store.saveRestaurant(env.restaurant);
  env.formResponses.push(() => { board.menu = []; env.store.saveStation(board); return 0; });

  await env.hooks.upgradeForm(env.player, env.machine, env.restaurant);
  env.hooks.tickRestaurants();
  assert.deepEqual(savedRestaurant(env).menu, []);
  assert.equal(savedRestaurant(env).level, 0);
  assert.match(env.player.messages.at(-1), /菜單總營養值不足/);
});

test('administrator refresh persists removal of the bound POI board when no orders can be generated', async () => {
  const env = await mainFixture();
  const block = place(env, 'ordertocook:board', { x: 3, y: 0, z: 0 });
  const board = env.store.getStation(block);
  board.ownerId = env.player.id;
  board.menu = [{ typeId: 'minecraft:bread', label: 'Old menu', nutrition: 5 }];
  env.store.saveStation(board);
  env.restaurant.active = false;
  env.hooks.getMachine(env.player, env.machine);
  env.store.saveRestaurant(env.restaurant);
  block.setType('minecraft:air');
  env.player.getGameMode = () => 'Creative';

  for (const callback of env.system.afterEvents.scriptEventReceive.subscriptions) callback({
    id: 'ordertocook:refresh', sourceType: 'Entity', sourceEntity: env.player, message: ''
  });
  env.hooks.tickRestaurants();
  assert.equal(savedRestaurant(env).boardId, '');
  assert.deepEqual(savedRestaurant(env).menu, []);
});
