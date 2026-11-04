// SPDX-License-Identifier: GPL-3.0-only
// Opt-in native BDS probe. Copy this beside main.js only in a disposable QA pack.
// Modes: legacy (pinned old runtime), upgrade (new runtime), reload (same world).
// Exercises real blocks/inventories/ItemStacks. No real Player, open GUI, input,
// permission revocation inside an open window, or player-break packets are tested.
import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { getStation, saveStation, stations } from './store.js';

const LOWER = 'ordertocook:refrigerator';
const UPPER = 'ordertocook:refrigerator_upper';
const EXPECTED = 'ordertocook:qa_fridge_expected_v1';
const WAIT = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;

function snapshot(stack) {
  if (!stack) return undefined;
  return {
    typeId: stack.typeId, amount: stack.amount, nameTag: stack.nameTag ?? '',
    lore: stack.getLore(),
    properties: Object.fromEntries(stack.getDynamicPropertyIds().sort().map(id => [id, stack.getDynamicProperty(id)])),
  };
}

function markedStack(typeId, amount, label, proof = undefined) {
  const stack = new ItemStack(typeId, amount);
  stack.nameTag = label;
  stack.setLore([`Native fridge: ${label}`, 'Preserve exact stack metadata']);
  if (proof) {
    stack.setDynamicProperty('ordertocook:restaurant', 'native-fridge-test-restaurant');
    stack.setDynamicProperty('ordertocook:order_id', `${label}-order`);
    stack.setDynamicProperty('ordertocook:proof', proof);
  }
  return stack;
}

function expectedSlots(label) {
  return [
    [0, markedStack('minecraft:apple', 17, `${label}-upper-first`)],
    [26, markedStack('ordertocook:food_plate', 1, `${label}-upper-last`, `${label}-plate-proof`)],
    [27, markedStack('minecraft:cooked_beef', 63, `${label}-lower-first`)],
    [80, markedStack('ordertocook:takeout_bag', 1, `${label}-lower-last`, `${label}-bag-proof`)],
  ];
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa_fridge' || running) return;
  running = true;
  run(event.message).catch(error => console.error('OTC_FRIDGE_FATAL ' + String(error?.stack || error)))
    .finally(() => { running = false; });
});

async function run(mode) {
  const checks = [];
  function check(name, condition, detail = '') {
    checks.push({ name, passed: !!condition, detail });
    if (!condition) console.error(`OTC_FRIDGE_FAIL ${name} ${detail}`);
  }
  const hooks = getQaHooks();
  const dim = world.getDimension('overworld');
  check('production entry initialized', hooks.ready);
  if (!hooks.ready) throw new Error('Production initialization did not complete');

  function stationHelpers(station) {
    return dim.getEntities({ type: 'ordertocook:storage' }).filter(entity =>
      entity.getDynamicProperty('ordertocook:station_id') === station.id);
  }
  function verifySlots(inventory, expected, prefix) {
    for (const entry of expected) {
      const actual = snapshot(inventory?.getItem(entry.slot));
      check(`${prefix}: slot ${entry.slot} keeps exact count and metadata`, JSON.stringify(actual) === JSON.stringify(entry.stack), JSON.stringify(actual));
    }
    let occupied = 0;
    for (let slot = 0; slot < (inventory?.size ?? 0); slot++) if (inventory.getItem(slot)) occupied++;
    check(`${prefix}: no duplicate stacks`, occupied === expected.length, String(occupied));
  }
  async function placeFridge(location) {
    const lower = dim.getBlock(location);
    lower.setPermutation(BlockPermutation.resolve(LOWER));
    await WAIT(4);
    hooks.onPlace(lower);
    await WAIT(4);
    const station = getStation(lower);
    const inventory = hooks.appliances.getStorage(station);
    if (!inventory) throw new Error(`Fridge storage unavailable at ${JSON.stringify(location)}`);
    return { lower, station, inventory };
  }
  function verifyNative(fixture, prefix) {
    const lower = dim.getBlock(fixture.location);
    const upper = lower.above();
    const station = getStation(lower);
    const inventory = hooks.appliances.getStorage(station);
    check(`${prefix}: lower ID retained`, lower.typeId === LOWER);
    check(`${prefix}: upper native block installed`, upper?.typeId === UPPER, upper?.typeId);
    check(`${prefix}: real lower block inventory has 54 slots`, lower.getComponent('minecraft:inventory')?.container?.size === 54);
    check(`${prefix}: real upper block inventory has 27 slots`, upper?.getComponent('minecraft:inventory')?.container?.size === 27);
    check(`${prefix}: joined adapter has 81 slots`, inventory?.size === 81);
    check(`${prefix}: station remains canonical with original owner`, station.id === fixture.stationId && station.ownerId === fixture.ownerId);
    check(`${prefix}: native station has no helper ID`, station.nativeFridge === true && !station.storageId);
    check(`${prefix}: no matching helper remains`, stationHelpers(station).length === 0);
    verifySlots(inventory, fixture.slots, prefix);
    return { lower, upper, station, inventory };
  }

  if (mode === 'legacy') {
    if (world.getDynamicProperty(EXPECTED)) throw new Error('Legacy mode needs a new disposable QA world');
    dim.runCommand('fill -20 3 -12 20 3 12 stone');
    dim.runCommand('fill -20 4 -12 20 10 12 air');
    const location = { x: 0, y: 4, z: 0 };
    const { lower, station, inventory } = await placeFridge(location);
    station.ownerId = 'qa-original-owner';
    saveStation(station);
    const entries = expectedSlots('legacy');
    for (const [slot, item] of entries) inventory.setItem(slot, item);
    check('legacy runtime uses two halves with the original ID', lower.typeId === LOWER && lower.above()?.typeId === LOWER && lower.above()?.permutation.getState('ordertocook:half') === 'upper');
    check('legacy cargo is in the real 81-slot helper', inventory.size === 81 && !!station.storageId && stationHelpers(station).length === 1);
    const legacy = { location, stationId: station.id, ownerId: station.ownerId, storageId: station.storageId,
      slots: entries.map(([slot, item]) => ({ slot, stack: snapshot(item) })) };
    verifySlots(inventory, legacy.slots, 'legacy before shutdown');
    world.setDynamicProperty(EXPECTED, JSON.stringify({ schema: 1, legacy }));
  } else if (mode === 'upgrade' || mode === 'reload') {
    const expected = JSON.parse(String(world.getDynamicProperty(EXPECTED)));
    if (expected.schema !== 1 || !expected.legacy) throw new Error('Missing genuine legacy fixture');
    const migrated = verifyNative(expected.legacy, mode === 'upgrade' ? 'legacy migration' : 'migrated fridge after restart');
    let previousHelper;
    try { previousHelper = world.getEntity(expected.legacy.storageId); } catch { /* Removed native entity. */ }
    check('original legacy helper retired', !previousHelper?.isValid);

    if (mode === 'upgrade') {
      migrated.lower.setPermutation(migrated.lower.permutation.withState('ordertocook:frame', 3));
      migrated.upper.setPermutation(migrated.upper.permutation.withState('ordertocook:frame', 6));
      verifySlots(hooks.appliances.getStorage(migrated.station), expected.legacy.slots, 'same-ID animated permutations');
      const location = { x: 8, y: 4, z: 0 };
      const fresh = await placeFridge(location);
      fresh.station.ownerId = 'qa-new-owner';
      saveStation(fresh.station);
      const entries = expectedSlots('native');
      for (const [slot, item] of entries) fresh.inventory.setItem(slot, item);
      expected.fresh = { location, stationId: fresh.station.id, ownerId: fresh.station.ownerId,
        slots: entries.map(([slot, item]) => ({ slot, stack: snapshot(item) })) };
      verifyNative(expected.fresh, 'new native fridge');

      for (const [half, location] of [['lower', { x: 0, y: 4, z: 8 }], ['upper', { x: 8, y: 4, z: 8 }]]) {
        const fixture = await placeFridge(location);
        const top = markedStack('minecraft:apple', 3, `break-${half}-upper`);
        const bottom = markedStack('minecraft:cooked_beef', 4, `break-${half}-lower`);
        fixture.inventory.setItem(0, top);
        fixture.inventory.setItem(27, bottom);
        const broken = half === 'upper' ? fixture.lower.above() : fixture.lower;
        const before = broken.permutation;
        // This is a command-style native block removal plus the production
        // player-break adapter, not a packet from a real player.
        broken.setType('minecraft:air');
        hooks.appliances.onBreak(broken, fixture.station, before);
        await WAIT(6);
        const drops = dim.getEntities({ type: 'minecraft:item', location, maxDistance: 4 })
          .map(entity => entity.getComponent('minecraft:item')?.itemStack).filter(Boolean);
        for (const wanted of [top, bottom]) {
          const matching = drops.filter(item => item.nameTag === wanted.nameTag);
          check(`break ${half}: ${wanted.nameTag} drops once with metadata`, matching.length === 1 && JSON.stringify(snapshot(matching[0])) === JSON.stringify(snapshot(wanted)), JSON.stringify(matching.map(snapshot)));
        }
        check(`break ${half}: both halves removed`, dim.getBlock(location).isAir && dim.getBlock({ ...location, y: location.y + 1 }).isAir);
        check(`break ${half}: station retired`, !stations().some(station => station.id === fixture.station.id));
        check(`break ${half}: no helper can drop twice`, stationHelpers(fixture.station).length === 0);
      }
      world.setDynamicProperty(EXPECTED, JSON.stringify(expected));
    } else {
      if (!expected.fresh) throw new Error('Reload requires the completed native upgrade fixture');
      verifyNative(expected.fresh, 'new native fridge after restart');
    }
  } else throw new Error('Expected legacy, upgrade or reload mode');

  console.warn('OTC_FRIDGE_REPORT ' + JSON.stringify({ mode, passed: checks.every(value => value.passed), checks,
    scope: 'Native BDS blocks, real container ItemStacks, genuine old-runtime migration and normal restart. No client GUI, real Player, input, open-window permission revocation or player-break packets.' }));
}
