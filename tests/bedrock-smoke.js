// SPDX-License-Identifier: GPL-3.0-only
// Native BDS probe. Copied into an isolated QA pack by tools/bedrock_smoke.py.
// This exercises real engine blocks/entities/ItemStacks, not client UI or input.
import { world, system, ItemStack, ItemTypes, BlockPermutation, GameMode } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { getRestaurant, saveRestaurant, getStation, saveStation, setBlockState } from './store.js';
import { generateOrder } from './core.js';
import { VANILLA_FOODS } from './config.js';
import { coinBalance, countItem } from './inventory.js';
import { transferStackToRange } from './appliances.js';
import { runCustomerChecks } from './bedrock-customer-checks.js';
import { DINING_ENTITY, MEAL_TOKEN } from './dining.js';

const WAIT = ticks => new Promise(resolve => system.runTimeout(() => resolve(undefined), ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa' || running) return;
  running = true;
  run(event.message).catch(error => console.error('OTC_NATIVE_FATAL ' + String(error?.stack || error))).finally(() => { running = false; });
});

async function run(mode) {
  const checks = [];
  function test(name, condition, detail = '') { checks.push({ name, passed: !!condition, detail }); if (!condition) console.error('OTC_NATIVE_FAIL ' + name + ' ' + detail); }
  const hooks = getQaHooks();
  const dim = world.getDimension('overworld');
  test('production entry initialized', hooks.ready);
  if (mode === 'reload' || mode === 'upgrade') {
    const expected = JSON.parse(String(world.getDynamicProperty('ordertocook:qa_expected')));
    const restaurant = getRestaurant(expected.restaurantId);
    test('restaurant restored across server restart', restaurant?.stats.completed === (expected.completed ?? 1) && restaurant?.stats.earnings === expected.earnings);
    const storage = world.getEntity(expected.storageId);
    const item = storage?.getComponent('minecraft:inventory')?.container.getItem(7);
    test('native storage entity restored', !!storage?.isValid);
    test('non-stackable parcel proof restored', item?.typeId === 'ordertocook:food_plate' && item?.getDynamicProperty('ordertocook:test_proof') === 'native-proof-20261009');
    test('native ItemStack name and lore restored', item?.nameTag === 'Native parcel metadata' && item?.getLore()?.[0] === 'persistent native lore');
    const machine = dim.getBlock(restaurant.location);
    test('custom block restored across server restart', machine?.typeId === 'ordertocook:order_machine');
    const fridge = dim.getBlock({ x: 6, y: 4, z: 0 });
    const fridgeInventory = hooks.appliances.getStorage(getStation(fridge));
    test('refrigerator native contents and name survive restart or upgrade', fridgeInventory?.getItem(0)?.typeId === 'minecraft:cooked_beef' && fridgeInventory.getItem(0)?.amount === 16 && fridgeInventory.getItem(0)?.nameTag === 'Native retained food');
    test('refrigerator persisted state accepts independent frame encoding', fridge.permutation.getState('ordertocook:frame') === 0 && fridge.above()?.permutation.getState('ordertocook:frame') === 0);
    const washer = dim.getBlock({ x: 10, y: 4, z: 0 });
    test('finished dishwasher retains all plates across restart or upgrade', getStation(washer).appliance?.plates === 16 && getStation(washer).appliance?.phase === 5);
    test('finished dishwasher loads new final frame permutation', washer.permutation.getState('ordertocook:frame') === 15);
    if (mode === 'upgrade') {
      test('saved baseline is alpha.1 QA schema', !expected.addonVersion && !expected.meal);
      test('completed alpha.1 history does not mint a new dirty plate', !(restaurant.pendingDishes || []).length && !dim.getEntities({ type: DINING_ENTITY }).length);
    } else {
      const meal = restaurant.pendingDishes?.find(entry => entry.id === expected.meal?.id);
      test('unfinished meal restores canonical token and original clock', meal?.token === expected.meal?.token && meal?.startedAt === expected.meal?.startedAt && meal?.finishAt === expected.meal?.finishAt);
      const visuals = dim.getEntities({ type: DINING_ENTITY }).filter(entity => entity.getDynamicProperty(MEAL_TOKEN) === meal?.token);
      test('restart reconciles exactly one dirty visual', visuals.length === 1 && visuals[0].getProperty('ordertocook:stage') === meal?.variant * 4 + 4 && meal?.status === 'dirty');
      test('restart does not respawn the finished meal customer', !dim.getEntities({ type: 'ordertocook:customer' }).some(entity => entity.getDynamicProperty('ordertocook:order_id') === meal?.id));
      const player = makePlayer(dim, storage.getComponent('minecraft:inventory').container);
      player.location = { ...meal.location, y: meal.location.y - 1 };
      const before = countItem([player.getComponent('minecraft:inventory').container], 'ordertocook:dirty_plate');
      hooks.collectDiningPlate(player, visuals[0]);
      test('restored dirty plate can be collected exactly once', countItem([player.getComponent('minecraft:inventory').container], 'ordertocook:dirty_plate') === before + 1 && !restaurant.pendingDishes.some(entry => entry.id === meal.id));
      hooks.collectDiningPlate(player, { restaurant, meal });
      test('stale restored meal reference cannot mint a second plate', countItem([player.getComponent('minecraft:inventory').container], 'ordertocook:dirty_plate') === before + 1);
    }
    console.warn('OTC_NATIVE_REPORT ' + JSON.stringify({ mode, passed: checks.every(c => c.passed), checks }));
    return;
  }
  // All probes are bounded to a loaded, isolated 32x32 test area.
  for (const entity of dim.getEntities({ location: { x: 0, y: 5, z: 0 }, maxDistance: 40 })) if (entity.typeId.startsWith('ordertocook:') || entity.typeId === 'minecraft:item') entity.remove();
  dim.runCommand('fill -15 3 -15 15 3 15 stone');
  dim.runCommand('fill -15 4 -15 15 10 15 air');
  const blockIds = ['order_machine', 'board', 'countertop', 'shelf', 'plate_shelf', 'washingtable', 'chair', 'dishwasher', 'refrigerator', 'stove', 'takeout_bag', 'food_plate_display'];
  for (const id of blockIds) {
    try { test('block registered: ' + id, BlockPermutation.resolve('ordertocook:' + id).type.id === 'ordertocook:' + id); }
    catch (error) { test('block registered: ' + id, false, String(error)); }
  }
  const itemIds = ItemTypes.getAll().map(type => type.id).filter(id => id.startsWith('ordertocook:'));
  test('custom items registered', itemIds.length >= 26, String(itemIds.length));
  for (const food of VANILLA_FOODS) {
    try { test('vanilla food identifier: ' + food.typeId, new ItemStack(food.typeId).typeId === food.typeId); }
    catch (error) { test('vanilla food identifier: ' + food.typeId, false, String(error)); }
  }
  function block(id, x, z) { const value = dim.getBlock({ x, y: 4, z }); value.setPermutation(BlockPermutation.resolve('ordertocook:' + id)); return value; }
  const machine = block('order_machine', 0, 0);
  block('board', 1, 0);
  const counter = block('countertop', 3, 0);
  const shelf = block('plate_shelf', 4, 1);
  const fridge = block('refrigerator', 6, 0);
  const stove = block('stove', 8, 0);
  const washer = block('dishwasher', 10, 0);
  const sink = block('washingtable', 12, 0);
  await WAIT(8);
  for (const value of [machine, counter, shelf, fridge, stove, washer, sink]) hooks.onPlace(value);
  test('two-block refrigerator placed without double-placement deletion', fridge.typeId === 'ordertocook:refrigerator' && fridge.above()?.typeId === 'ordertocook:refrigerator');
  setBlockState(shelf, 'ordertocook:plates', 18);
  test('18-plate state encoded through native permutations', shelf.permutation.getState('ordertocook:plates') === 2 && shelf.permutation.getState('ordertocook:plates_high') === true);
  const geometryPlate = block('food_plate_display', 5, 4);
  setBlockState(geometryPlate, 'ordertocook:stage', 37);
  test('40-stage plate visuals have native state encoding', geometryPlate.permutation.getState('ordertocook:stage') === 5 && geometryPlate.permutation.getState('ordertocook:stage_high') === 2);
  geometryPlate.setType('minecraft:air');
  const storage = dim.spawnEntity('ordertocook:storage', { x: 0.5, y: 4, z: 5.5 });
  const inventory = storage.getComponent('minecraft:inventory')?.container;
  test('native inventory helper has 81 slots', inventory?.size === 81);
  const fakePlayer = makePlayer(dim, inventory);
  const restaurant = hooks.getMachine(fakePlayer, machine);
  restaurant.orders = [];
  restaurant.stats = { completed: 0, delivery: 0, longDistance: 0, earnings: 0, failed: 0 };
  restaurant.active = false;
  restaurant.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: '麵包' }];
  restaurant.config = { ...restaurant.config, tierWeights: [1, 0, 0, 0, 0], deliveryRate: 0, urgentRate: 0 };
  const order = generateOrder(restaurant, Date.now(), () => 0.99);
  saveRestaurant(restaurant);
  hooks.acceptWithTicket(fakePlayer, restaurant, order);
  test('production acceptance allows an ordinary dine-in before any chair is placed', order.status === 'accepted');
  test('native order ticket carries canonical server ID', inventory.getItem(0)?.typeId === 'ordertocook:order' && inventory.getItem(0)?.getDynamicProperty('ordertocook:order_id') === order.id);
  const foodRequired = order.items[0].amount;
  inventory.setItem(1, new ItemStack('minecraft:bread', foodRequired));
  const supply = getStation(shelf); supply.supplies = 2; saveStation(supply);
  hooks.prepareOrderAtCountertop(fakePlayer, counter, restaurant, order);
  test('actual countertop adapter transitions to packed', order.status === 'packed');
  test('actual countertop adapter consumes exact food', countItem([inventory], 'minecraft:bread') === 0);
  test('actual countertop adapter consumes one plate', supply.supplies === 1);
  test('actual countertop places visible native output', counter.above()?.typeId === 'ordertocook:food_plate_display');
  const amountBeforeDuplicate = supply.supplies;
  hooks.prepareOrderAtCountertop(fakePlayer, counter, restaurant, order);
  test('native duplicate packing has no second debit', supply.supplies === amountBeforeDuplicate);
  hooks.pickupDisplay(fakePlayer, counter.above());
  let parcelSlot = -1;
  for (let i = 0; i < inventory.size; i++) if (inventory.getItem(i)?.typeId === 'ordertocook:food_plate') parcelSlot = i;
  fakePlayer.selectedSlotIndex = parcelSlot;
  const parcel = inventory.getItem(parcelSlot);
  test('pickup preserves unstackable delivery proof', parcel?.getDynamicProperty('ordertocook:proof') === order.proof && parcel?.maxAmount === 1);
  const chair = block('chair', 2, 3);
  hooks.onPlace(chair);
  const customer = dim.spawnEntity('ordertocook:customer', { x: 3.5, y: 4, z: 3.5 });
  customer.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
  customer.setDynamicProperty('ordertocook:order_id', order.id);
  test('customer entity registered with native properties', customer.getProperty('ordertocook:stage') !== undefined);
  test('chair mounts a real native customer', hooks.entities.sitOnChair(customer, chair));
  test('native mounted customer resolves its actual chair block', hooks.entities.getCustomerSeat(customer)?.location.x === chair.location.x && hooks.entities.getCustomerSeat(customer)?.location.z === chair.location.z);
  order.customerEntityId = customer.id;
  hooks.customerInteract(fakePlayer, customer, { restaurantId: restaurant.id, orderId: order.id }, { rng: () => 0.99 });
  await WAIT(1); // Native entity properties commit at the next engine tick.
  test('native submission completes order', order.status === 'completed' && restaurant.stats.completed === 1);
  test('native submission pays exact recorded reward', coinBalance(fakePlayer) === order.paidReward);
  const meal = restaurant.pendingDishes.find(entry => entry.id === order.id);
  const mealVisual = world.getEntity(meal?.visualEntityId);
  test('handoff starts native scale action with canonical deadline', customer.getProperty('ordertocook:action') === 6 && customer.getDynamicProperty('ordertocook:depart_at') === order.meal?.finishAt);
  test('native dining helper starts at shared stage zero', mealVisual?.typeId === DINING_ENTITY && mealVisual.getProperty('ordertocook:stage') === 0 && mealVisual.getDynamicProperty(MEAL_TOKEN) === meal.token);
  test('native dining helper carries no recoverable inventory', !mealVisual?.getComponent('minecraft:inventory'));
  const earned = coinBalance(fakePlayer);
  let copiedSlot = 0;
  while (inventory.getItem(copiedSlot)) copiedSlot++;
  inventory.setItem(copiedSlot, parcel);
  fakePlayer.selectedSlotIndex = copiedSlot;
  hooks.customerInteract(fakePlayer, customer, { restaurantId: restaurant.id, orderId: order.id });
  test('copied native parcel cannot earn a second payout', coinBalance(fakePlayer) === earned && restaurant.stats.completed === 1);
  inventory.setItem(copiedSlot, undefined);
  const bike = dim.spawnEntity('ordertocook:motorcycle', { x: 6.5, y: 4, z: 4.5 });
  const cargo = bike.getComponent('minecraft:inventory')?.container;
  test('native motorcycle has 54 cargo slots', cargo?.size === 54);
  test('native motorcycle exposes rideable input vehicle', !!bike.getComponent('minecraft:rideable'));
  const marked = new ItemStack('ordertocook:food_plate');
  marked.nameTag = 'Native parcel metadata'; marked.setLore(['persistent native lore']);
  marked.setDynamicProperty('ordertocook:test_proof', 'native-proof-20261009');
  inventory.setItem(7, marked);
  const moved = transferStackToRange(inventory, 7, cargo, undefined, marked);
  test('unstackable parcel transfers into native cargo', moved.ok && !inventory.getItem(7) && cargo.getItem(0)?.getDynamicProperty('ordertocook:test_proof') === 'native-proof-20261009');
  const returned = transferStackToRange(cargo, 0, inventory, [7], cargo.getItem(0));
  test('native cargo returns exact name/lore/proof', returned.ok && inventory.getItem(7)?.nameTag === marked.nameTag && inventory.getItem(7)?.getLore()[0] === marked.getLore()[0]);
  const fridgeContainer = hooks.appliances.getStorage(getStation(fridge));
  test('native refrigerator exposes 81 storage slots', fridgeContainer?.size === 81);
  const allFoods = new ItemStack('minecraft:cooked_beef', 16); allFoods.nameTag = 'Native retained food';
  fridgeContainer.setItem(0, allFoods);
  test('refrigerator supplies can be counted through production adapter', hooks.appliances.countFood(getStation(fridge), 'minecraft:cooked_beef') === 16);
  const stoveContainer = hooks.appliances.getStorage(getStation(stove));
  stoveContainer.setItem(0, new ItemStack('minecraft:beef'));
  stoveContainer.setItem(1, new ItemStack('minecraft:chicken'));
  stoveContainer.setItem(2, new ItemStack('minecraft:potato'));
  stoveContainer.setItem(3, new ItemStack('minecraft:coal'));
  inventory.setItem(10, new ItemStack('ordertocook:dirty_plate', 16));
  fakePlayer.location = { x: 10.5, y: 4, z: 1.5 };
  hooks.appliances.onInteract(fakePlayer, washer);
  test('native dishwasher accepts 16 dirty plates', getStation(washer).appliance?.plates === 16 && !inventory.getItem(10));
  fakePlayer.location = { x: 3.5, y: 4, z: 2.5 };
  // Observe real scheduled transitions. Exact millisecond boundaries are tested
  // separately by pure tests; the native samples leave room for a five-tick scan.
  async function until(elapsed) {
    while (Date.now() < meal.startedAt + elapsed) await WAIT(2);
  }
  for (const [elapsed, phase] of [[1100, 1], [3350, 2], [4350, 3], [5350, 4]]) {
    await until(elapsed);
    test(`native dining reaches source phase ${phase}`, mealVisual?.isValid && mealVisual.getProperty('ordertocook:stage') === meal.variant * 4 + phase);
  }
  await until(6250);
  test('native completed customer leaves at the saved deadline', !customer.isValid);
  test('native dirty plate persists after customer departure', mealVisual?.isValid && meal.status === 'dirty');
  const dirtyCount = dim.getEntities({ type: 'minecraft:item', location: fakePlayer.location, maxDistance: 12 })
    .map(entity => entity.getComponent('minecraft:item')?.itemStack).filter(item => item?.typeId === 'ordertocook:dirty_plate').reduce((sum, item) => sum + item.amount, 0);
  test('native meal completion does not auto-drop an extra plate', dirtyCount === 0, String(dirtyCount));
  const duplicate = dim.spawnEntity(DINING_ENTITY, meal.location);
  duplicate.setDynamicProperty(MEAL_TOKEN, meal.token);
  duplicate.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
  duplicate.setDynamicProperty('ordertocook:order_id', meal.id);
  await WAIT(24);
  const canonicalVisuals = dim.getEntities({ type: DINING_ENTITY }).filter(entity => entity.getDynamicProperty(MEAL_TOKEN) === meal.token);
  test('native duplicate dining helpers reconcile to one', canonicalVisuals.length === 1);
  fakePlayer.location = { ...meal.location, y: meal.location.y - 1 };
  const dirtyBefore = countItem([inventory], 'ordertocook:dirty_plate');
  hooks.collectDiningPlate(fakePlayer, canonicalVisuals[0]);
  test('explicit native plate pickup returns exactly one dirty plate', countItem([inventory], 'ordertocook:dirty_plate') === dirtyBefore + 1 && !restaurant.pendingDishes.some(entry => entry.id === meal.id));
  hooks.collectDiningPlate(fakePlayer, { restaurant, meal });
  test('stale native plate pickup cannot return another plate', countItem([inventory], 'ordertocook:dirty_plate') === dirtyBefore + 1);
  await until(12000);
  test('native stove cooks three lanes', stoveContainer.getItem(4)?.typeId === 'minecraft:cooked_beef' && stoveContainer.getItem(5)?.typeId === 'minecraft:cooked_chicken' && stoveContainer.getItem(6)?.typeId === 'minecraft:baked_potato');
  test('native dishwasher completes all 16 plates', getStation(washer).appliance?.phase === 5 && getStation(washer).appliance?.plates === 16);
  test('native dishwasher selects the final source pose', washer.permutation.getState('ordertocook:frame') === 15);
  await runCustomerChecks({ world, system, hooks, restaurant, player: fakePlayer, dimension: dim, test, wait: WAIT });
  // Leave a genuine second paid meal in progress. Reload must retain the same
  // clock/token, finish while offline, and allow one collection after restart.
  fakePlayer.location = { x: 3.5, y: 4, z: 2.5 };
  fakePlayer.selectedSlotIndex = 0;
  const nextOrder = generateOrder(restaurant, Date.now(), () => 0.99);
  saveRestaurant(restaurant);
  hooks.acceptWithTicket(fakePlayer, restaurant, nextOrder);
  // The restaurant's regular menu sync may have refreshed its source board
  // while the first meal ran. Supply the actual canonical second order.
  for (const required of nextOrder.items) inventory.addItem(new ItemStack(required.typeId, required.amount));
  hooks.prepareOrderAtCountertop(fakePlayer, counter, restaurant, nextOrder);
  hooks.pickupDisplay(fakePlayer, counter.above());
  for (let i = 0; i < inventory.size; i++) if (inventory.getItem(i)?.getDynamicProperty('ordertocook:order_id') === nextOrder.id && inventory.getItem(i)?.typeId === 'ordertocook:food_plate') fakePlayer.selectedSlotIndex = i;
  const nextCustomer = dim.spawnEntity('ordertocook:customer', { x: 3.5, y: 4, z: 3.5 });
  nextCustomer.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
  nextCustomer.setDynamicProperty('ordertocook:order_id', nextOrder.id);
  nextOrder.customerEntityId = nextCustomer.id;
  hooks.entities.sitOnChair(nextCustomer, chair);
  hooks.customerInteract(fakePlayer, nextCustomer, { restaurantId: restaurant.id, orderId: nextOrder.id }, { rng: () => 0.99 });
  const nextMeal = restaurant.pendingDishes.find(entry => entry.id === nextOrder.id);
  test('second native meal is saved before shutdown', nextOrder.status === 'completed' && !!nextMeal && nextMeal.status === 'eating');
  // syncVisual's entity ID is merely a cache; the restaurant still persists the
  // canonical token and anchors needed to find/rebuild the native helper.
  saveRestaurant(restaurant);
  world.setDynamicProperty('ordertocook:qa_expected', JSON.stringify({ addonVersion: '0.1.1-alpha.2', restaurantId: restaurant.id, storageId: storage.id, completed: restaurant.stats.completed, earnings: restaurant.stats.earnings,
    meal: nextMeal ? { id: nextMeal.id, token: nextMeal.token, startedAt: nextMeal.startedAt, finishAt: nextMeal.finishAt } : undefined }));
  console.warn('OTC_NATIVE_REPORT ' + JSON.stringify({ mode: 'initial', passed: checks.every(c => c.passed), checks }));
}

function makePlayer(dimension, inventory) {
  return {
    id: 'otc-native-probe', name: 'Native QA', typeId: 'minecraft:player', isValid: true, selectedSlotIndex: 0,
    location: { x: 3.5, y: 4, z: 2.5 }, dimension, isSneaking: false,
    getComponent: id => id === 'minecraft:inventory' ? { container: inventory } : undefined,
    getGameMode: () => GameMode.Survival, hasTag: () => false,
    sendMessage: message => console.warn('OTC_NATIVE_MESSAGE ' + message),
    getViewDirection: () => ({ x: 0, y: 0, z: 1 }), getHeadLocation: () => ({ x: 3.5, y: 5.6, z: 2.5 })
  };
}
