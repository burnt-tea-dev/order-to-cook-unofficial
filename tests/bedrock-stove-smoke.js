// SPDX-License-Identifier: GPL-3.0-only
// Disposable BDS test entry only. Never included by tools/build.py.
import { world, system, ItemStack, ItemTypes, BlockPermutation } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { getStation } from './store.js';
import { createApplianceService, transferStackToRange } from './appliances.js';
import { SMOKING_RECIPES } from './smoking_recipes.js';

const RAW = 'otc_stove_probe:raw', COOKED = 'otc_stove_probe:cooked';
const RECORD = 'ordertocook:qa_stove_fixture', EXPECTED = 'ordertocook:qa_stove_expected';
const WAIT = ticks => new Promise(resolve => system.runTimeout(() => resolve(undefined), ticks));
const PROVIDER = { version: 1, provider: 'otc_stove_probe', catalog: 'native', recipes: [
  { id: 'otc_stove_probe:double', process: 'smoking', input: RAW, output: COOKED, count: 2 },
] };
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa' || running) return;
  running = true;
  run(event.message).catch(error => console.error('OTC_NATIVE_FATAL ' + String(error) + '\n' + String(error?.stack ?? '')))
    .finally(() => { running = false; });
});

/** Only this service sees its record. Main's global station scanner cannot double-tick it. */
function controlled(dimension, location, { restored, persist = false } = {}) {
  let clock = 0, saved;
  const block = dimension.getBlock(location);
  if (!restored) block.setPermutation(BlockPermutation.resolve('ordertocook:stove'));
  const station = restored ?? { id: `qa_stove_${location.x}_${location.z}`,
    dimensionId: dimension.id, location: { ...location }, typeId: 'ordertocook:stove' };
  const service = createApplianceService({
    world, system: { get currentTick() { return clock; } },
    getStation: () => station, stations: () => [station], deleteStation() {},
    saveStation(value) {
      saved = JSON.parse(JSON.stringify(value));
      if (persist) world.setDynamicProperty(RECORD, JSON.stringify(saved));
    },
    smokingRecipes: { [RAW]: { output: COOKED, count: 2 } },
  });
  if (!restored) service.onPlace(block);
  service.tick();
  const inventory = service.getStorage(station);
  return { service, station, block, inventory, saved: () => saved,
    advance(ticks) {
      for (let elapsed = 0; elapsed < ticks;) {
        const step = Math.min(20, ticks - elapsed);
        clock += step; elapsed += step; service.tick();
      }
    },
  };
}

function snapshotItem(item) {
  return item ? { typeId: item.typeId, amount: item.amount, name: item.nameTag ?? '', lore: item.getLore(),
    proof: item.getDynamicProperty('ordertocook:qa_stove_proof') ?? null } : null;
}

async function run(mode) {
  const checks = [];
  const test = (name, condition, detail = '') => {
    checks.push({ name, passed: !!condition, detail });
    if (!condition) console.error('OTC_NATIVE_FAIL ' + name + ' ' + detail);
  };
  const report = () => console.warn('OTC_NATIVE_REPORT ' + JSON.stringify({ mode, passed: checks.every(c => c.passed), checks }));
  const dimension = world.getDimension('overworld'), hooks = getQaHooks();
  if (mode === 'reload') {
    const stored = JSON.parse(String(world.getDynamicProperty(RECORD)));
    const expected = JSON.parse(String(world.getDynamicProperty(EXPECTED)));
    const helper = world.getEntity(stored.storageId);
    const inventory = helper?.getComponent('minecraft:inventory')?.container;
    test('real server restart restores the same stove block and native storage entity', hooks.ready && helper?.isValid &&
      helper.id === expected.storageId && dimension.getBlock(stored.location)?.typeId === 'ordertocook:stove');
    test('all seven native slots and input metadata survive the real disk save', !!inventory &&
      JSON.stringify(Array.from({ length: 7 }, (_, i) => snapshotItem(inventory.getItem(i)))) === JSON.stringify(expected.slots));
    test('offline time and unrelated main scheduling do not advance the isolated saved stove',
      stored.appliance.cookProgress === expected.cookProgress && stored.appliance.litTime === expected.litTime &&
      stored.appliance.litDuration === expected.litDuration,
      JSON.stringify({ expected: [expected.cookProgress, expected.litTime], actual: [stored.appliance.cookProgress, stored.appliance.litTime] }));
    const fixture = controlled(dimension, stored.location, { restored: stored, persist: true });
    const resumedFrame = fixture.block.permutation.getState('ordertocook:fire_frame');
    fixture.advance(200 - expected.cookProgress);
    test('restored fuel and progress finish exactly one batch without repeating ignition or debiting fuel twice',
      resumedFrame >= 2 && resumedFrame <= 5 && fixture.inventory.getItem(4)?.typeId === 'minecraft:cooked_beef' &&
      fixture.inventory.getItem(4)?.amount === 1 && fixture.inventory.getItem(5)?.typeId === COOKED &&
      fixture.inventory.getItem(5)?.amount === 2 && fixture.inventory.getItem(0)?.amount === 2 &&
      fixture.inventory.getItem(0)?.nameTag === 'Restart raw' &&
      fixture.inventory.getItem(0)?.getLore()?.[0] === 'native persistent input' &&
      fixture.inventory.getItem(1)?.amount === 1 && !fixture.inventory.getItem(3) && fixture.station.appliance.cookProgress === 0);
    report();
    return;
  }

  dimension.runCommand('fill -15 3 -15 15 3 15 stone');
  dimension.runCommand('fill -15 4 -15 15 10 15 air');
  const missing = [...new Set([...Object.keys(SMOKING_RECIPES), ...Object.values(SMOKING_RECIPES), RAW, COOKED])]
    .filter(id => !ItemTypes.get(id));
  test('production entry and all baseline/native fixture item identifiers are registered', hooks.ready && missing.length === 0, JSON.stringify(missing));

  function mainStove(x) {
    const block = dimension.getBlock({ x, y: 4, z: 0 });
    block.setPermutation(BlockPermutation.resolve('ordertocook:stove'));
    hooks.onPlace(block);
    const station = getStation(block);
    return { block, station, inventory: hooks.appliances.getStorage(station) };
  }
  const native = mainStove(0), supplier = mainStove(3), started = system.currentTick;
  ['minecraft:beef', 'minecraft:chicken', 'minecraft:potato'].forEach((id, lane) => native.inventory.setItem(lane, new ItemStack(id, 2)));
  native.inventory.setItem(3, new ItemStack('minecraft:coal'));
  supplier.inventory.setItem(0, new ItemStack(RAW, 2));
  supplier.inventory.setItem(3, new ItemStack('minecraft:coal'));
  system.sendScriptEvent('ordertocook:smoking_recipes_v1', JSON.stringify({ ...PROVIDER,
    recipes: [{ ...PROVIDER.recipes[0], process: 'grilling' }] }));
  await WAIT(10);
  test('specialized grilling process is refused through the real supplier event ingress',
    supplier.inventory.getItem(0)?.amount === 2 && supplier.inventory.getItem(3)?.amount === 1 && !supplier.inventory.getItem(4));
  system.sendScriptEvent('ordertocook:smoking_recipes_v1', JSON.stringify({ ...PROVIDER,
    recipes: [{ ...PROVIDER.recipes[0], output: 'otc_stove_probe:missing' }] }));
  await WAIT(10);
  test('uninstalled output ID cannot create a valid supplier recipe',
    supplier.inventory.getItem(3)?.amount === 1 && !supplier.inventory.getItem(4) && !ItemTypes.get('otc_stove_probe:missing'));
  system.sendScriptEvent('ordertocook:smoking_recipes_v1', JSON.stringify(PROVIDER));
  await WAIT(Math.max(1, 190 - (system.currentTick - started)));
  test('real main scheduler does not complete an ordinary batch before 200 ticks',
    [4, 5, 6].every(slot => !native.inventory.getItem(slot)), `elapsed=${system.currentTick - started}`);
  await WAIT(40);
  test('real main scheduler cooks all three lanes using one fuel after the Java batch interval',
    ['minecraft:cooked_beef', 'minecraft:cooked_chicken', 'minecraft:baked_potato'].every((id, lane) =>
      native.inventory.getItem(lane + 4)?.typeId === id && native.inventory.getItem(lane + 4)?.amount === 1 &&
      native.inventory.getItem(lane)?.amount === 1) && !native.inventory.getItem(3));
  test('late provider event reaches an already-created production stove and produces its actual count two',
    supplier.inventory.getItem(4)?.typeId === COOKED && supplier.inventory.getItem(4)?.amount === 2 && supplier.inventory.getItem(0)?.amount === 1);
  for (let lane = 0; lane < 3; lane++) native.inventory.setItem(lane, undefined);
  system.sendScriptEvent('ordertocook:smoking_recipes_v1', JSON.stringify({ ...PROVIDER, recipes: [] }));
  await WAIT(4);
  const beforeWithdraw = supplier.station.appliance.cookProgress;
  await WAIT(12);
  test('provider withdrawal stops existing production stoves without consuming the raw item',
    supplier.station.appliance.cookProgress === beforeWithdraw && supplier.inventory.getItem(0)?.amount === 1 &&
    supplier.inventory.getItem(4)?.amount === 2);

  const partial = controlled(dimension, { x: -12, y: 4, z: 5 });
  partial.inventory.setItem(0, new ItemStack(RAW, 2));
  partial.inventory.setItem(4, new ItemStack(COOKED, 63));
  partial.inventory.setItem(1, new ItemStack('minecraft:beef', 2));
  partial.inventory.setItem(2, new ItemStack('minecraft:stone', 7));
  partial.inventory.setItem(3, new ItemStack('minecraft:coal'));
  partial.advance(200);
  const blocked = partial.inventory.getItem(0)?.amount === 2 && partial.inventory.getItem(4)?.amount === 63 &&
    partial.inventory.getItem(5)?.typeId === 'minecraft:cooked_beef' && partial.inventory.getItem(2)?.amount === 7;
  partial.inventory.setItem(4, new ItemStack(COOKED, 62));
  partial.advance(200);
  test('count-two capacity blocks only its lane, invalid raw is retained, and freed capacity resumes output',
    blocked && partial.inventory.getItem(4)?.amount === 64 && partial.inventory.getItem(0)?.amount === 1);
  await WAIT(1);

  const blockedFixture = controlled(dimension, { x: -8, y: 4, z: 5 });
  blockedFixture.inventory.setItem(0, new ItemStack('minecraft:beef', 2));
  const namedOutput = new ItemStack('minecraft:cooked_beef'); namedOutput.nameTag = 'Unmergeable native output';
  blockedFixture.inventory.setItem(4, namedOutput);
  blockedFixture.inventory.setItem(3, new ItemStack('minecraft:coal', 2));
  blockedFixture.advance(200);
  test('native output metadata blocks mixing and a fully blocked stove does not ignite fuel',
    blockedFixture.inventory.getItem(0)?.amount === 2 && blockedFixture.inventory.getItem(3)?.amount === 2 &&
    blockedFixture.inventory.getItem(4)?.nameTag === namedOutput.nameTag && blockedFixture.station.appliance.litTime === 0);

  const fuel = controlled(dimension, { x: -4, y: 4, z: 5 });
  fuel.inventory.setItem(0, new ItemStack('minecraft:beef', 2));
  fuel.inventory.setItem(3, new ItemStack('minecraft:stick'));
  fuel.advance(100);
  const firstHundred = fuel.station.appliance.cookProgress === 100 && fuel.station.appliance.litTime === 1;
  fuel.advance(1);
  const cooling = fuel.station.appliance.cookProgress === 98 && fuel.station.appliance.litTime === 0;
  fuel.station.appliance.litTime = 1; fuel.station.appliance.cookProgress = 199;
  fuel.advance(1);
  test('native fuel exhaustion cools by two and the last burn tick cannot finish a 199-tick batch',
    firstHundred && cooling && fuel.station.appliance.cookProgress === 197 && !fuel.inventory.getItem(4));
  await WAIT(1);

  const lava = controlled(dimension, { x: 0, y: 4, z: 5 });
  lava.inventory.setItem(0, new ItemStack('minecraft:beef'));
  lava.inventory.setItem(3, new ItemStack('minecraft:lava_bucket'));
  lava.advance(1);
  test('native lava fuel leaves one empty bucket and immediately persists all 20000 burn ticks',
    lava.inventory.getItem(3)?.typeId === 'minecraft:bucket' && lava.inventory.getItem(3)?.amount === 1 &&
    lava.saved()?.appliance.litTime === 20000 && lava.saved()?.appliance.litDuration === 20000 && lava.saved()?.appliance.cookProgress === 1);

  const changed = controlled(dimension, { x: 4, y: 4, z: 5 });
  changed.inventory.setItem(0, new ItemStack('minecraft:beef', 2));
  changed.inventory.setItem(3, new ItemStack('minecraft:coal'));
  changed.advance(100);
  changed.inventory.setItem(0, new ItemStack('minecraft:chicken', 2));
  changed.advance(1);
  const reset = changed.station.appliance.cookProgress === 1;
  changed.advance(198);
  const notEarly = !changed.inventory.getItem(4);
  changed.advance(1);
  test('replacing real native input resets the shared batch and the replacement needs its own 200 ticks',
    reset && notEarly && changed.inventory.getItem(4)?.typeId === 'minecraft:cooked_chicken' && changed.inventory.getItem(0)?.amount === 1);
  await WAIT(1);

  const carrier = dimension.spawnEntity('ordertocook:storage', { x: 9.5, y: 4, z: 5.5 });
  const cargo = carrier.getComponent('minecraft:inventory').container;
  const meta = new ItemStack('minecraft:beef', 4); meta.nameTag = 'Native raw metadata';
  meta.setLore(['retained native lore']);
  changed.inventory.setItem(2, meta);
  const transfer = transferStackToRange(changed.inventory, 2, cargo, [0], meta);
  const roundtrip = transferStackToRange(cargo, 0, changed.inventory, [2]);
  for (let slot = 0; slot < 36; slot++) cargo.setItem(slot, new ItemStack('minecraft:stone', 64));
  const full = transferStackToRange(changed.inventory, 2, cargo, Array.from({ length: 36 }, (_, i) => i));
  test('native transfers preserve ItemStack metadata and a full 36-slot destination leaves all source items intact',
    transfer.ok && roundtrip.ok && !full.ok && JSON.stringify(snapshotItem(changed.inventory.getItem(2))) === JSON.stringify(snapshotItem(meta)));

  const states = [];
  for (let frame = 0; frame < 6; frame++) {
    changed.block.setPermutation(changed.block.permutation.withState('ordertocook:fire_frame', frame));
    states.push(changed.block.permutation.getState('ordertocook:fire_frame'));
  }
  test('all six stove fire frames are valid native permutations', JSON.stringify(states) === '[0,1,2,3,4,5]');

  const persistent = controlled(dimension, { x: 12, y: 4, z: 10 }, { persist: true });
  const retained = new ItemStack('minecraft:beef', 3); retained.nameTag = 'Restart raw';
  retained.setLore(['native persistent input']);
  persistent.inventory.setItem(0, retained);
  persistent.inventory.setItem(1, new ItemStack(RAW, 2));
  persistent.inventory.setItem(2, new ItemStack('minecraft:stone', 17));
  persistent.inventory.setItem(3, new ItemStack('minecraft:coal'));
  persistent.advance(73);
  const saved = JSON.parse(String(world.getDynamicProperty(RECORD)));
  world.setDynamicProperty(EXPECTED, JSON.stringify({ storageId: saved.storageId,
    cookProgress: saved.appliance.cookProgress, litTime: saved.appliance.litTime, litDuration: saved.appliance.litDuration,
    slots: Array.from({ length: 7 }, (_, i) => snapshotItem(persistent.inventory.getItem(i))) }));
  test('native world checkpoint retains the exact partial batch and spent fuel before shutdown',
    saved.appliance.cookProgress === 73 && saved.appliance.litTime === 1528 && !persistent.inventory.getItem(3) &&
    persistent.inventory.getItem(0)?.amount === 3 && persistent.inventory.getItem(1)?.amount === 2 && !persistent.inventory.getItem(4));
  report();
}
