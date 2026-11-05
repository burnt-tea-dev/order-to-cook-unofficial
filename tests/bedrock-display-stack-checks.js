// SPDX-License-Identifier: GPL-3.0-only
// Isolated QA only. Run qa_display_stack twice across a normal same-world restart.
// The actor uses a real native entity inventory; it is not a native Player/UI test.
import { world, system, ItemStack, GameMode } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { generateOrder, acceptOrder } from './core.js';
import { getStation, saveStation, saveRestaurant } from './store.js';

const KEY = 'ordertocook:qa_display_stack';
const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa_display_stack' || running) return;
  running = true;
  run().catch(error => console.error('OTC_DISPLAY_STACK_FATAL ' + error + ' ' + error?.stack));
});

function snapshot(stack) {
  if (!stack) return undefined;
  return { typeId: stack.typeId, amount: stack.amount, maxAmount: stack.maxAmount,
    nameTag: stack.nameTag, lore: stack.getLore(), keepOnDeath: stack.keepOnDeath,
    properties: Object.fromEntries(stack.getDynamicPropertyIds().sort().map(id => [id, stack.getDynamicProperty(id)])) };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function run() {
  const h = getQaHooks(), d = world.getDimension('overworld'), raw = world.getDynamicProperty(KEY);
  const saved = raw ? JSON.parse(raw) : undefined, phase = saved ? 'restart' : 'seed', checks = [];
  const check = (name, passed) => {
    checks.push({ name, passed: !!passed }); console.warn('OTC_DISPLAY_STACK_CHECK ' + JSON.stringify(checks.at(-1)));
    if (!passed) throw Error(name);
  };
  check('production startup ready', h.ready);
  if (!saved) {
    d.runCommand('fill -3 4 -3 22 4 8 stone'); d.runCommand('fill -3 5 -3 22 9 8 air');
  }
  const storage = saved ? world.getEntity(saved.storageId) : d.spawnEntity('ordertocook:storage', { x: 1.5, y: 5, z: 3.5 });
  const inventory = storage?.getComponent('minecraft:inventory')?.container;
  check('native actor inventory exists', !!inventory);
  const actor = { id: 'otc-display-qa-owner', name: 'Display stack QA', isValid: true, isSneaking: true,
    dimension: d, location: { x: 2, y: 5, z: 0 }, selectedSlotIndex: 0,
    getComponent: id => id === 'minecraft:inventory' ? { container: inventory } : undefined,
    getTags: () => [], hasTag: () => false, getGameMode: () => GameMode.Survival, sendMessage() {} };
  const table = x => d.getBlock({ x, y: 5, z: 0 });
  const drops = location => d.getEntities({ type: 'minecraft:item', location, maxDistance: 1.3 });
  function annotate(stack, label) {
    stack.nameTag = label; stack.setLore(['正常成品的保存資料 🍵']); stack.keepOnDeath = true;
    stack.setDynamicProperty('ordertocook:qa_note', label);
    return stack;
  }
  if (!saved) {
    const machine = table(0); machine.setType('ordertocook:order_machine');
    const r = h.getMachine(actor, machine); r.menu = [{ typeId: 'minecraft:bread', label: '麵包', nutrition: 5 }]; saveRestaurant(r);
    const boardBlock = table(1); boardBlock.setType('ordertocook:board');
    const board = getStation(boardBlock);
    Object.assign(board, { ownerId: actor.id, initialized: true, menu: r.menu }); saveStation(board);
    const counter = table(2); counter.setType('ordertocook:countertop');
    for (const [x, id] of [[3, 'ordertocook:plate_shelf'], [4, 'ordertocook:shelf']]) {
      table(x).setType(id); const s = getStation(table(x)); s.ownerId = actor.id; s.supplies = 10; saveStation(s);
    }
    function prepare(type, label) {
      actor.location = { x: 2, y: 5, z: 0 };
      inventory.setItem(0, undefined); inventory.setItem(40, new ItemStack('minecraft:bread', 2));
      const order = generateOrder(r, Date.now(), () => 0.9999); order.type = type;
      order.items = [{ typeId: 'minecraft:bread', label: '麵包', nutrition: 5, amount: 2 }];
      acceptOrder(r, order.id, { wall: Date.now(), tick: system.currentTick }); saveRestaurant(r);
      h.prepareOrderAtCountertop(actor, counter, r, order);
      const display = counter.above(), cargo = display.getComponent('minecraft:inventory')?.container;
      check(label + ' preparation owns one native carrier', cargo?.size === 1 && cargo.getItem(0)?.getDynamicProperty('ordertocook:proof') === order.proof);
      h.pickupDisplay(actor, display);
      const stack = annotate(inventory.getItem(0), label); inventory.setItem(0, stack);
      return { order, expected: snapshot(stack) };
    }
    function placeAt(x) {
      table(x).setType('minecraft:stone'); actor.location = { x, y: 5, z: 0 };
      h.placeParcel(actor, table(x), 'Up'); return table(x).above();
    }
    for (const type of ['dine_in', 'delivery']) {
      const entry = prepare(type, 'native roundtrip ' + type), display = placeAt(6);
      h.pickupDisplay(actor, display);
      check(type + ' placement and pickup preserve native metadata', same(snapshot(inventory.getItem(0)), entry.expected));
      check(type + ' pickup does not also spill cargo', drops(display.location).length === 0);
    }
    const broken = prepare('dine_in', 'native destroy'), display = placeAt(6);
    d.runCommand('setblock 6 6 0 air destroy'); await wait(3);
    let items = drops(display.location);
    check('actual destruction drops exactly one complete carrier', items.length === 1 && same(snapshot(items[0].getComponent('minecraft:item').itemStack), broken.expected));
    for (const item of items) item.remove();
    const replaced = prepare('dine_in', 'native replacement'); placeAt(6).setType('minecraft:stone'); await wait(3);
    items = drops(display.location);
    check('actual ID replacement spills exactly one complete carrier', items.length === 1 && same(snapshot(items[0].getComponent('minecraft:item').itemStack), replaced.expected));
    for (const item of items) item.remove(); table(6).above().setType('minecraft:air');
    const persisted = [];
    for (const [x, type] of [[8, 'dine_in'], [10, 'delivery']]) {
      const entry = prepare(type, 'persisted ' + type); placeAt(x);
      persisted.push({ x, expected: entry.expected });
    }
    const emptied = prepare('dine_in', 'native moved-out');
    const empty = placeAt(12); empty.getComponent('minecraft:inventory').container.moveItem(0, 5, inventory);
    h.pickupDisplay(actor, empty); h.tickRestaurants();
    check('empty native slot never reconstructs a second carrier', !empty.getComponent('minecraft:inventory').container.getItem(0) && same(snapshot(inventory.getItem(5)), emptied.expected));
    const legacy = prepare('dine_in', 'legacy fixture'), old = placeAt(16), s = getStation(old);
    // Reproduce the old supported saved format: only its real order link, no
    // physical carrier. This is a migration fixture, not the metadata counterexample.
    old.getComponent('minecraft:inventory').container.setItem(0, undefined); delete s.nativeParcel; saveStation(s);
    table(18).setType('minecraft:hopper'); table(18).above().setType('minecraft:chest');
    table(18).above().getComponent('minecraft:inventory').container.setItem(0, new ItemStack('minecraft:bread', 1));
    await wait(40);
    const controlInventory = table(18).getComponent('minecraft:inventory').container;
    const controlItems = Array.from({ length: controlInventory.size }, (_, slot) => controlInventory.getItem(slot)).filter(Boolean);
    check('vanilla chest-to-hopper positive control extracts one bread', controlItems.length === 1 && controlItems[0].typeId === 'minecraft:bread' && controlItems[0].amount === 1);
    const hopper = prepare('dine_in', 'hopper capability');
    table(14).setType('minecraft:hopper'); actor.location = { x: 14, y: 5, z: 0 };
    h.placeParcel(actor, table(14), 'Up'); await wait(40);
    const hopperInventory = table(14).getComponent('minecraft:inventory')?.container;
    const pulled = Array.from({ length: hopperInventory?.size || 0 }, (_, slot) => hopperInventory.getItem(slot)).filter(Boolean);
    const retained = table(14).above().getComponent('minecraft:inventory').container.getItem(0);
    check('hopper observation retains exactly one original carrier', pulled.length + Number(!!retained) === 1 && same(snapshot(pulled[0] || retained), hopper.expected));
    const capability = { hopperExtracts: pulled.length === 1, javaInventoryExposed: false, parityApproved: false };
    console.warn('OTC_DISPLAY_STACK_CAPABILITY ' + JSON.stringify(capability));
    world.setDynamicProperty(KEY, JSON.stringify({ storageId: storage.id, persisted, empty: emptied.expected, legacyOrderId: legacy.order.id, legacyProof: legacy.order.proof, capability }));
  } else {
    for (const entry of saved.persisted) {
      const block = table(entry.x).above(), cargo = block.getComponent('minecraft:inventory')?.container;
      check(entry.expected.typeId + ' full native stack survives same-world restart', same(snapshot(cargo?.getItem(0)), entry.expected));
      actor.location = { x: entry.x, y: 5, z: 0 }; inventory.setItem(0, undefined);
      h.pickupDisplay(actor, block);
      check(entry.expected.typeId + ' restart pickup returns one original with no drop', same(snapshot(inventory.getItem(0)), entry.expected) && drops(block.location).length === 0);
    }
    const empty = table(12).above(); actor.location = { x: 12, y: 5, z: 0 }; inventory.setItem(0, undefined);
    h.pickupDisplay(actor, empty); h.tickRestaurants();
    check('empty native slot stays empty after restart', !empty.getComponent('minecraft:inventory').container.getItem(0) && !inventory.getItem(0) && same(snapshot(inventory.getItem(5)), saved.empty));
    const old = table(16).above(); actor.location = { x: 16, y: 5, z: 0 };
    h.pickupDisplay(actor, old);
    check('old link adopts one canonical carrier on reload', inventory.getItem(0)?.getDynamicProperty('ordertocook:proof') === saved.legacyProof);
    check('legacy pickup has no additional world drop', drops(old.location).length === 0);
    world.setDynamicProperty(KEY, undefined);
  }
  console.warn('OTC_DISPLAY_STACK_RESULT ' + JSON.stringify({ passed: true, phase, checks, playersAfter: world.getAllPlayers().length,
    capability: saved?.capability, scope: 'Real ItemStack/native block inventory, production preparation/place/pickup adapters with native-inventory fixture actor, engine destruction/replacement and same-world persistence. Hopper observation is not parity approval. No native Player/UI/client or LIVE verdict.' }));
}
