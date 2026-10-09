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
  if (mode === 'reload') {
    const expected = JSON.parse(String(world.getDynamicProperty('ordertocook:qa_expected')));
    const restaurant = getRestaurant(expected.restaurantId);
    test('restaurant restored across server restart', restaurant?.stats.completed === 1 && restaurant?.stats.earnings === expected.earnings);
    const storage = world.getEntity(expected.storageId);
    const item = storage?.getComponent('minecraft:inventory')?.container.getItem(7);
    test('native storage entity restored', !!storage?.isValid);
    test('non-stackable parcel proof restored', item?.typeId === 'ordertocook:food_plate' && item?.getDynamicProperty('ordertocook:test_proof') === 'native-proof-20261009');
    test('native ItemStack name and lore restored', item?.nameTag === 'Native parcel metadata' && item?.getLore()?.[0] === 'persistent native lore');
    const machine = dim.getBlock(restaurant.location);
    test('custom block restored across server restart', machine?.typeId === 'ordertocook:order_machine');
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
  const chair = block('chair', 2, 3);
  const fridge = block('refrigerator', 6, 0);
  const stove = block('stove', 8, 0);
  const washer = block('dishwasher', 10, 0);
  const sink = block('washingtable', 12, 0);
  await WAIT(8);
  for (const value of [machine, counter, shelf, chair, fridge, stove, washer, sink]) hooks.onPlace(value);
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
  const fakePlayer = {
    id: 'otc-native-probe', name: 'Native QA', typeId: 'minecraft:player', isValid: true, selectedSlotIndex: 0,
    location: { x: 3.5, y: 4, z: 2.5 }, dimension: dim, isSneaking: false,
    getComponent: id => id === 'minecraft:inventory' ? { container: inventory } : undefined,
    getGameMode: () => GameMode.Survival, hasTag: () => false,
    sendMessage: message => console.warn('OTC_NATIVE_MESSAGE ' + message),
    getViewDirection: () => ({ x: 0, y: 0, z: 1 }), getHeadLocation: () => ({ x: 3.5, y: 5.6, z: 2.5 })
  };
  const restaurant = hooks.getMachine(fakePlayer, machine);
  restaurant.orders = [];
  restaurant.stats = { completed: 0, delivery: 0, longDistance: 0, earnings: 0, failed: 0 };
  restaurant.active = false;
  restaurant.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: '麵包' }];
  restaurant.config = { ...restaurant.config, tierWeights: [1, 0, 0, 0, 0], deliveryRate: 0, urgentRate: 0 };
  const order = generateOrder(restaurant, Date.now(), () => 0.99);
  saveRestaurant(restaurant);
  hooks.acceptWithTicket(fakePlayer, restaurant, order);
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
  const customer = dim.spawnEntity('ordertocook:customer', { x: 3.5, y: 4, z: 3.5 });
  customer.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
  customer.setDynamicProperty('ordertocook:order_id', order.id);
  test('customer entity registered with native properties', customer.getProperty('ordertocook:stage') !== undefined);
  test('chair mounts a real native customer', hooks.entities.sitOnChair(customer, chair));
  hooks.customerInteract(fakePlayer, customer, { restaurantId: restaurant.id, orderId: order.id });
  test('native submission completes order', order.status === 'completed' && restaurant.stats.completed === 1);
  test('native submission pays exact recorded reward', coinBalance(fakePlayer) === order.paidReward);
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
  // Give the production dirty-dish timer time to run. UI/keyboard/rendering is
  // deliberately absent: the stand-in only supplies a real engine inventory.
  await WAIT(230);
  const dirtyCount = dim.getEntities({ type: 'minecraft:item', location: fakePlayer.location, maxDistance: 12 })
    .map(entity => entity.getComponent('minecraft:item')?.itemStack).filter(item => item?.typeId === 'ordertocook:dirty_plate').reduce((sum, item) => sum + item.amount, 0);
  test('native timed dining returns exactly one dirty plate', dirtyCount === 1, String(dirtyCount));
  test('native stove cooks three lanes', stoveContainer.getItem(4)?.typeId === 'minecraft:cooked_beef' && stoveContainer.getItem(5)?.typeId === 'minecraft:cooked_chicken' && stoveContainer.getItem(6)?.typeId === 'minecraft:baked_potato');
  test('native dishwasher completes all 16 plates', getStation(washer).appliance?.phase === 5 && getStation(washer).appliance?.plates === 16);
  world.setDynamicProperty('ordertocook:qa_expected', JSON.stringify({ restaurantId: restaurant.id, storageId: storage.id, earnings: restaurant.stats.earnings }));
  console.warn('OTC_NATIVE_REPORT ' + JSON.stringify({ mode: 'initial', passed: checks.every(c => c.passed), checks }));
}
