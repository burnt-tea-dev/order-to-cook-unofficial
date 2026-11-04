// SPDX-License-Identifier: GPL-3.0-only
// Copy beside main.js ONLY in the existing isolated QA candidate. Never install
// this observer on LIVE. Run `ordertocook:qa_portable first`, save/stop/start the
// SAME world, then run `ordertocook:qa_portable reload`.
import { world, system, ItemStack } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { getStation, saveStation, findStation, getRestaurant, saveRestaurant, getProfile, saveProfile, locationId } from './store.js';
import { normalizeMenu, generateOrder } from './core.js';
import { readPortableBlock } from './portable_blocks.js';

const KEY = 'otc-qa-portable-expected';
const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa_portable' || running) return;
  running = true;
  run(event.message).catch(error => console.error(`OTC_PORTABLE_FATAL ${error?.stack || error}`)).finally(() => { running = false; });
});

async function run(mode) {
  const checks = [], hooks = getQaHooks(), dimension = world.getDimension('overworld');
  function check(name, ok) { checks.push({ name, passed: !!ok }); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  check('runtime initialized', hooks.ready);
  if (!hooks.ready) throw Error('Runtime was not ready');
  if (mode === 'first') {
    dimension.runCommand('tickingarea add circle 112 5 5 4 otc_portable_qa');
    dimension.runCommand('fill 96 5 -3 134 8 13 air');
    await wait(4);
    // Dedicated coordinates inside the isolated fixture; no production world
    // copy is modified by importing this file alone.
    const storage = dimension.spawnEntity('ordertocook:storage', { x: 104.5, y: 5, z: 0.5 });
    const inventory = storage.getComponent('minecraft:inventory').container;
    const actor = { id: 'otc-portable-qa-owner', name: 'Native portable QA', isValid: true,
      dimension, location: { x: 104, y: 5, z: 0 }, selectedSlotIndex: 0,
      getComponent: id => id === 'minecraft:inventory' ? { container: inventory } : undefined,
      sendMessage() {} };
    const cases = [];
    for (const [index, typeId] of ['ordertocook:board', 'ordertocook:order_machine'].entries()) {
      const location = { x: 100 + index * 30, y: 5, z: 0 };
      dimension.runCommand(`setblock ${location.x} 4 0 stone`);
      const block = dimension.getBlock(location); block.setType(typeId);
      await wait(3);
      let record;
      if (index === 0) {
        record = getStation(block); record.initialized = true; record.ownerId = actor.id;
        record.menu = normalizeMenu(Array.from({ length: 150 }, (_, n) => ({ typeId: 'minecraft:bread', nutrition: 5,
          label: '原生保存🍵'.repeat(15), foodIdentity: { carrier: 'senluo.public.food.v1', nativeVariant: n } })));
        saveStation(record);
      } else {
        record = hooks.getMachine(actor, block);
        record.name = '原生保存餐廳🍵'; record.level = 7; record.staff = ['qa-employee'];
        Object.keys(record.stats).forEach((key, n) => { record.stats[key] = 37 * n; });
        record.orderSequence = 25; saveRestaurant(record);
      }
      // This is the actual engine destruction event, including loot emission.
      dimension.runCommand(`setblock ${location.x} 5 0 air destroy`);
      await wait(4);
      const drops = dimension.getEntities({ type: 'minecraft:item', location, maxDistance: 3 })
        .filter(entity => entity.getComponent('minecraft:item')?.itemStack.typeId === typeId);
      check(`${typeId} native break emits one item`, drops.length === 1);
      if (drops.length !== 1) throw Error(`Unexpected native drop count: ${typeId}`);
      const stack = drops[0].getComponent('minecraft:item').itemStack;
      const data = readPortableBlock(stack);
      check(`${typeId} item permits native dynamic properties`, stack.maxAmount === 1 && !!data);
      if (index === 0) check('all menu variants survived native break', same(data.menu, record.menu));
      else check('owner level statistics survived native break', data.ownerId === actor.id && data.level === 7 && same(data.stats, record.stats));
      stack.nameTag = `QA retained ${typeId}`; stack.setLore(['完整 metadata 🍵']);
      inventory.setItem(index, stack); drops[0].remove();
      cases.push({ index, typeId, data, nameTag: stack.nameTag, lore: stack.getLore() });
    }
    const bag = new ItemStack('ordertocook:takeout_bag');
    bag.setDynamicProperty('ordertocook:expires_at', Date.now() - 1); inventory.setItem(2, bag);
    const profileBlock = dimension.getBlock({ x: 160, y: 5, z: 0 }); profileBlock.setType('ordertocook:order_machine');
    const profileRestaurant = hooks.getMachine(actor, profileBlock);
    profileRestaurant.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: '麵包' }];
    profileRestaurant.config.easterEggCustomerRate = 1;
    const profileOrder = generateOrder(profileRestaurant, Date.now(), () => 0);
    saveRestaurant(profileRestaurant);
    // Reuse the sharded store for the large expected fixture. A full menu must
    // not overflow a single native world property in the observer either.
    saveProfile({ id: KEY, storageId: storage.id, cases, profileRestaurantId: profileRestaurant.id, profileOrderId: profileOrder.id });
  } else if (mode === 'reload') {
    const expected = getProfile(KEY);
    const storage = world.getEntity(expected.storageId);
    const inventory = storage?.getComponent('minecraft:inventory')?.container;
    check('native item storage restored in same world', !!inventory);
    if (!inventory) throw Error('Native storage was not restored');
    const actor = { id: 'otc-portable-qa-placer', name: 'Different placer', isValid: true, dimension,
      location: { x: 100, y: 5, z: 10 }, selectedSlotIndex: 0,
      getComponent: id => id === 'minecraft:inventory' ? { container: inventory } : undefined,
      sendMessage() {} };
    for (const entry of expected.cases) {
      const stack = inventory.getItem(entry.index);
      check(`${entry.typeId} all native properties survived restart`, same(readPortableBlock(stack), entry.data));
      check(`${entry.typeId} name and lore survived restart`, stack.nameTag === entry.nameTag && same(stack.getLore(), entry.lore));
      // Exercise the production placement adapter with real native inventory
      // and blocks. The actor is an adapter fixture, not native player input.
      actor.selectedSlotIndex = entry.index;
      const block = dimension.getBlock({ x: 100 + entry.index * 30, y: 5, z: 10 });
      hooks.capturePortablePlacement({ player: actor, block, permutationToPlace: { type: { id: entry.typeId } } });
      block.setType(entry.typeId); inventory.setItem(entry.index, undefined);
      hooks.onPlayerPlace({ player: actor, block });
      const restored = entry.index === 0 ? findStation(block) : getRestaurant(locationId(dimension.id, block.location));
      check(`${entry.typeId} production adapter restored durable data`, Object.entries(entry.data).every(([key, value]) => same(restored[key], value)));
    }
    check('parcel expiry survives native restart', inventory.getItem(2).getDynamicProperty('ordertocook:expires_at') < Date.now());
    const profileOrder = getRestaurant(expected.profileRestaurantId)?.orders.find(row => row.id === expected.profileOrderId);
    check('named special order identity survives native restart', profileOrder?.easterEgg === true && profileOrder.customerName === '微风(作者)' &&
      profileOrder.skinAccount === 'Breezeth' && profileOrder.skinUuid === 'a1b3e264-652b-42db-b8e7-5393b409776b' && profileOrder.customerVariant === 0);
    dimension.runCommand('tickingarea remove otc_portable_qa');
  } else throw Error('Use first or reload');
  console.warn(`OTC_PORTABLE_RESULT ${JSON.stringify({ mode, passed: checks.every(row => row.passed), checks,
    scope: 'Native break/drop and item disk save; placement adapter uses a fixture actor. Native player consumption/input and client audiovisuals are not established.' })}`);
}
