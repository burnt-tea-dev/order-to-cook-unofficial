// SPDX-License-Identifier: GPL-3.0-only
// Real main/store callbacks with native I/O doubles. Not native event-order QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, configure } from './main.harness.js';
import { FakeItem, makeEnvironment, place } from './appliances.harness.js';
import { writePortableBlock, readPortableBlock } from '../runtime/BP/scripts/portable_blocks.js';

const TYPE = 'ordertocook:order_machine';
const add = (location, delta) => ({ x: location.x + delta[0], y: location.y + delta[1], z: location.z + delta[2] });
const drain = env => { for (const callback of env.system.callbacks.splice(0)) callback(); };
async function clean(saved = []) {
  const env = await mainFixture(saved);
  env.store.deleteRestaurant(env.restaurant.id); env.machine.setType('minecraft:air'); drain(env);
  env.player.container.setItem(0, undefined);
  return env;
}
function preflight(env, location, stack = new FakeItem(TYPE), dimension = env.dimension) {
  env.player.dimension = dimension;
  env.player.container.setItem(0, stack);
  const event = { block: dimension.getBlock(location), player: env.player, permutationToPlace: { type: { id: TYPE } }, cancel: false };
  env.blockComponents.get('ordertocook:interact').beforeOnPlayerPlace(event);
  return event;
}
function attempt(env, location, stack = new FakeItem(TYPE), dimension = env.dimension) {
  const event = preflight(env, location, stack, dimension), { block } = event;
  if (!event.cancel) {
    block.setType(TYPE); env.player.container.setItem(0, undefined);
    for (const callback of env.world.afterEvents.playerPlaceBlock.subscriptions) callback({ block, player: env.player });
    env.blockComponents.get('ordertocook:interact').onPlace({ block });
  }
  drain(env);
  return { event, block, record: env.store.getRestaurant(env.store.locationId(dimension.id, location)) };
}
function seed(env, location, dimensionId = env.dimension.id) {
  // Legacy/saved fixtures intentionally bypass new-player placement restrictions.
  const record = env.core.createRestaurant({ id: env.store.locationId(dimensionId, location), ownerId: env.player.id, dimensionId, location });
  env.store.saveRestaurant(record);
  if (dimensionId === env.dimension.id) place(env, TYPE, location);
  return record;
}

for (const [label, delta] of [['positive face', [25, 0, 0]], ['horizontal corner', [24, 0, 24]]]) {
  test(`ordinary placement rejects Java ${label} that equipment sphere excludes`, async () => {
    const env = await clean(), target = { x: 100, y: 64, z: 100 }, first = attempt(env, add(target, delta));
    assert.equal(first.event.cancel, false); assert.ok(first.record);
    const saved = [...env.properties];
    assert.equal(env.store.nearestRestaurant({ dimension: env.dimension, location: target }), undefined);
    const second = attempt(env, target);
    assert.equal(second.event.cancel, true); assert.equal(second.block.typeId, 'minecraft:air');
    assert.equal(second.record, undefined); assert.equal(env.store.findStation(second.block), undefined);
    assert.equal(env.player.container.getItem(0).amount, 1); assert.deepEqual([...env.properties], saved);
    assert.equal(first.block.typeId, TYPE);
  });
}

test('portable corner denial preserves item and ledgers; a later retry restores once', async () => {
  const env = await clean(), target = { x: -100, y: -30, z: -100 }, first = attempt(env, add(target, [25, 25, 25]));
  env.restaurant.stats.earnings = 57; env.restaurant.stats.completed = 3;
  const stack = writePortableBlock(new FakeItem(TYPE), { ...env.restaurant, ownerId: 'portable-owner', staff: ['friend'], name: 'Portable restaurant', level: 5 });
  stack.nameTag = 'Keep this machine'; stack.setLore(['Keep this lore']); stack.setDynamicProperty('test:extra', 'kept');
  const data = readPortableBlock(stack), saved = [...env.properties], drops = env.dimension.drops.length;
  const blocked = attempt(env, target, stack), held = env.player.container.getItem(0);
  assert.equal(blocked.event.cancel, true); assert.equal(blocked.record, undefined);
  assert.deepEqual(held, stack); assert.deepEqual(readPortableBlock(held), data);
  assert.deepEqual([...env.properties], saved); assert.equal(env.store.findStation(blocked.block), undefined);
  drain(env); assert.equal(env.dimension.drops.length, drops); assert.equal(held.amount, 1);
  first.block.setType('minecraft:air');
  const retry = attempt(env, target, held);
  assert.equal(retry.event.cancel, false); assert.equal(env.player.container.getItem(0), undefined);
  assert.equal(retry.record.ownerId, data.ownerId); assert.equal(retry.record.name, data.name);
  assert.equal(retry.record.level, data.level); assert.deepEqual(retry.record.staff, data.staff);
  assert.deepEqual(retry.record.stats, data.stats); assert.deepEqual(retry.record.orders, []);
  assert.equal(env.dimension.drops.length, drops);
  const restored = JSON.stringify(retry.record); drain(env); assert.equal(JSON.stringify(retry.record), restored);
});

for (const limit of [1, 2]) for (const target of [{ x: 100, y: 64, z: 100 }, { x: -100, y: -30, z: -100 }]) {
  test(`limit ${limit}: all signed faces, corners and self at ${JSON.stringify(target)}`, async () => {
    const env = await clean();
    configureLimit(env, limit);
    if (limit === 2) seed(env, add(target, [24, 24, 24]));
    const cases = [];
    for (let axis = 0; axis < 3; axis++) for (const offset of [-25, -24, 24, 25, 26]) {
      const delta = [0, 0, 0]; delta[axis] = offset;
      cases.push([delta, offset >= -24 && offset <= 25]);
    }
    cases.push([[17, 0, 17], true], [[25, 25, 25], true], [[-24, -24, -24], true],
      [[25, -24, 25], true], [[-25, 24, 24], false], [[24, 26, 24], false], [[0, 0, 0], false]);
    for (const [delta, blocked] of cases) {
      const location = add(target, delta), record = seed(env, location);
      const equipment = delta.reduce((total, value) => total + value * value, 0) <= 24 * 24;
      assert.equal(env.store.nearestRestaurant({ dimension: env.dimension, location: target })?.id, equipment ? record.id : undefined, `unchanged equipment sphere ${delta}`);
      assert.equal(preflight(env, target).cancel, blocked, `existing minus new ${delta}`);
      env.store.deleteRestaurant(record.id); env.dimension.getBlock(location).setType('minecraft:air'); drain(env);
    }
    const placed = attempt(env, target);
    assert.equal(placed.event.cancel, false); assert.equal(env.store.restaurants().length, limit);
    const record = placed.record; drain(env); assert.equal(env.store.getRestaurant(record.id), record);
  });
}

for (const limit of [1, 2]) test(`limit ${limit}: metadata filters before reads; live count stops at threshold`, async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 }, block = env.dimension.getBlock(target);
  configureLimit(env, limit);
  const component = env.blockComponents.get('ordertocook:interact');
  const check = () => { const event = { block, player: env.player, permutationToPlace: { type: { id: TYPE } }, cancel: false }; component.beforeOnPlayerPlace(event); return event.cancel; };
  const get = env.dimension.getBlock.bind(env.dimension), getDimension = env.world.getDimension.bind(env.world);
  const reads = [], dimensions = [], modes = new Map();
  env.dimension.getBlock = location => {
    reads.push({ ...location }); const mode = modes.get(location.x);
    if (mode === 'unloaded') throw Error('chunk unavailable');
    if (mode === 'missing') return undefined;
    if (mode === 'replaced') return { typeId: 'minecraft:air' };
    return get(location);
  };
  env.world.getDimension = id => { dimensions.push(id); return getDimension(id); };
  const probe = () => { reads.length = 0; dimensions.length = 0; return check(); };
  assert.equal(probe(), false); assert.deepEqual(reads, []);
  for (const delta of [[26, 0, 0], [0, -25, 0], [0, 0, 26], [0, 0, 0]]) seed(env, add(target, delta));
  seed(env, add(target, [24, 0, 24]), 'minecraft:nether');
  const malformed = seed(env, add(target, [90, 0, 0]));
  delete malformed.location.x; env.store.saveRestaurant(malformed);
  assert.equal(probe(), false); assert.deepEqual(reads, []); assert.deepEqual(dimensions, []);
  const candidates = [[25, 25, 25], [24, 0, 24], [23, 0, 23], [22, 0, 22]].map(delta => seed(env, add(target, delta)));
  modes.set(125, 'unloaded'); modes.set(124, 'missing'); modes.set(123, 'replaced');
  const saved = [...env.properties];
  assert.equal(probe(), limit === 1); assert.deepEqual(reads.map(p => p.x), [125, 124, 123, 122]);
  modes.delete(125);
  assert.equal(probe(), true); assert.deepEqual(reads.map(p => p.x), limit === 1 ? [125] : [125, 124, 123, 122], 'count only live records, no sort or scan');
  modes.delete(124);
  assert.equal(probe(), true); assert.deepEqual(reads.map(p => p.x), limit === 1 ? [125] : [125, 124], 'stop at configured threshold');
  for (const record of candidates) modes.set(record.location.x, 'missing');
  assert.equal(probe(), false); assert.equal(reads.length, 4);
  modes.delete(124); modes.delete(123);
  assert.equal(probe(), true); assert.deepEqual(reads.map(p => p.x), limit === 1 ? [125, 124] : [125, 124, 123], 'load state is rechecked');
  assert.deepEqual([...env.properties], saved, 'unavailable records and save data remain untouched');
});

for (const limit of [1, 2]) test(`limit ${limit}: current canonical rollback and membership determine placement without cached records`, async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 }, stale = seed(env, add(target, [25, 25, 25]));
  configureLimit(env, limit); if (limit === 2) seed(env, add(target, [1, 1, 1]));
  assert.equal(preflight(env, target).cancel, true);
  stale.location.x += 100;
  assert.equal(preflight(env, target).cancel, false, 'current metadata, not insertion snapshot');
  env.failWrite(key => key === 'ordertocook:r:' + stale.id);
  assert.throws(() => env.store.saveRestaurant(stale), /persistence failure/);
  const canonical = env.store.getRestaurant(stale.id); assert.notEqual(canonical, stale);
  assert.equal(preflight(env, target).cancel, true, 'rollback restores the blocking canonical record');
  env.store.deleteRestaurant(canonical.id);
  assert.equal(preflight(env, target).cancel, false, 'physical but unregistered machines remain out of scope');
  env.store.saveRestaurant(canonical); assert.equal(preflight(env, target).cancel, true);
});

for (const limit of [1, 2]) test(`limit ${limit}: owner, staff, stranger, creative and admin cannot bypass count; dimensions remain independent`, async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 }, first = attempt(env, add(target, [25, -24, 25]));
  configureLimit(env, limit); if (limit === 2) attempt(env, add(target, [24, -24, 25]));
  const owner = env.player.id;
  for (const role of ['owner', 'stranger', 'staff', 'creative', 'admin']) {
    env.player.id = role === 'owner' ? owner : 'other'; first.record.staff = role === 'staff' ? ['other'] : [];
    env.player.getGameMode = () => role === 'creative' ? 'Creative' : 'Survival';
    env.player.hasTag = tag => role === 'admin' && tag === 'otc_admin'; env.store.saveRestaurant(first.record);
    assert.equal(preflight(env, target).cancel, true, role);
  }
  const nether = makeEnvironment().dimension; nether.id = 'minecraft:nether';
  const original = env.world.getDimension.bind(env.world); env.world.getDimension = id => id === nether.id ? nether : original(id);
  const second = attempt(env, target, new FakeItem(TYPE), nether);
  assert.equal(second.event.cancel, false); assert.ok(second.record); assert.equal(first.block.typeId, TYPE);
});

test('retained removal journal blocks same-position placement before portable capture', async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 }, old = attempt(env, target);
  old.record.removing = true; env.store.saveRestaurant(old.record); old.block.setType('minecraft:air');
  configureLimit(env, 2147483647); // The removal journal is independent of any count allowance.
  const stack = writePortableBlock(new FakeItem(TYPE), env.restaurant), saved = [...env.properties];
  assert.equal(attempt(env, target, stack).event.cancel, true);
  assert.deepEqual(env.player.container.getItem(0), stack); assert.deepEqual([...env.properties], saved);
  assert.equal(old.block.typeId, 'minecraft:air');
});

test('legacy dense restaurants retain data and machines across normal ticks and reload', async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 };
  const records = [seed(env, target), seed(env, add(target, [24, 0, 24]))];
  for (const [index, record] of records.entries()) {
    record.level = index + 3; record.staff = ['friend']; record.stats.earnings = 100 + index; env.store.saveRestaurant(record);
  }
  env.hooks.tickRestaurants();
  const resumed = await clean(env.properties);
  for (const record of records) place(resumed, TYPE, record.location);
  resumed.hooks.tickRestaurants();
  for (const record of records) for (const current of [env, resumed]) {
    const kept = current.store.getRestaurant(record.id);
    assert.ok(kept); assert.equal(kept.level, record.level); assert.equal(kept.ownerId, record.ownerId);
    assert.deepEqual(kept.staff, record.staff); assert.deepEqual(kept.stats, record.stats);
    assert.equal(current.dimension.getBlock(record.location).typeId, TYPE);
  }
});

test('placement rejection uses localized box guidance without changing equipment guidance', async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 };
  attempt(env, add(target, [25, 0, 0])); attempt(env, target);
  assert.deepEqual(env.player.messages.at(-1), { rawtext: [
    { text: '§6[下單了]§r ' }, { translate: 'otc.error.machine_placement_conflict', with: ['1'] }
  ] });
  const { readFile } = await import('node:fs/promises');
  for (const locale of ['en_US', 'zh_CN', 'zh_TW']) {
    const source = await readFile(new URL(`../assets/guidebook/${locale}.lang`, import.meta.url), 'utf8');
    const runtime = await readFile(new URL(`../runtime/RP/texts/${locale}.lang`, import.meta.url), 'utf8');
    const step = source.split('\n').find(line => line.startsWith('otc.guide.page.placing_station.step2='));
    assert.ok(runtime.split('\n').includes(step), `generated handbook matches source ${locale}`);
    const error = runtime.split('\n').filter(line => line.startsWith('otc.error.machine_placement_conflict='));
    assert.equal(error.length, 1); assert.match(error[0], /%s/); assert.match(error[0], /-24.*\+25/); assert.match(step, /24.*-24.*\+25.*maxOrderMachinesWithin24.*26/);
  }
});

const SETTINGS = 'ordertocook:settings';
const configureLimit = (env, limit, source = 'server') => configure(env, { maxOrderMachinesWithin24: limit }, source);

test('global limit two permits first and second, cancels third with full ordinary or portable item, and permits retry once', async () => {
  for (const portable of [false, true]) {
    const env = await clean(), target = { x: 100, y: 64, z: 100 };
    configureLimit(env, 2);
    const first = attempt(env, add(target, [2, 0, 0]));
    const second = attempt(env, add(target, [1, 0, 0]));
    assert.equal(first.event.cancel, false); assert.equal(second.event.cancel, false);
    assert.ok(first.record); assert.ok(second.record);
    env.restaurant.stats.earnings = 73;
    const stack = portable ? writePortableBlock(new FakeItem(TYPE), { ...env.restaurant, name: 'Counted portable', ownerId: 'other-owner', staff: ['friend'], level: 5,
      config: { ...env.restaurant.config, maxOrderMachinesWithin24: 99 } }) : new FakeItem(TYPE);
    stack.nameTag = 'Keep exact machine'; stack.setLore(['Counted item lore']); stack.setDynamicProperty('test:extra', 'retain');
    const data = portable && readPortableBlock(stack), saved = [...env.properties], drops = env.dimension.drops.length;
    const denied = attempt(env, target, stack);
    assert.equal(denied.event.cancel, true); assert.equal(denied.block.typeId, 'minecraft:air');
    assert.equal(denied.record, undefined); assert.equal(env.store.findStation(denied.block), undefined);
    assert.deepEqual(env.player.container.getItem(0), stack); assert.deepEqual([...env.properties], saved);
    assert.equal(env.dimension.drops.length, drops);
    // One now-unloaded/nonmachine candidate ceases to count on this attempt.
    first.block.setType('minecraft:air');
    const retried = attempt(env, target, env.player.container.getItem(0));
    assert.equal(retried.event.cancel, false); assert.ok(retried.record);
    assert.equal(env.player.container.getItem(0), undefined); assert.equal(env.dimension.drops.length, drops);
    if (portable) {
      for (const key of ['ownerId', 'name', 'staff', 'level', 'stats']) assert.deepEqual(retried.record[key], data[key]);
      assert.deepEqual(retried.record.orders, []);
    }
    const restored = JSON.stringify(retried.record); drain(env); assert.equal(JSON.stringify(retried.record), restored);
  }
});

test('server, creative and tagged admin can persist global count; ordinary source cannot', async () => {
  for (const source of ['server', 'creative', 'admin', 'ordinary']) {
    const env = await clean(), target = { x: 100, y: 64, z: 100 };
    attempt(env, add(target, [1, 0, 0])); const saved = [...env.properties];
    configureLimit(env, 2, source);
    if (source === 'ordinary') assert.deepEqual([...env.properties], saved);
    else assert.equal(JSON.parse(env.properties.get(SETTINGS)).maxOrderMachinesWithin24, 2);
    assert.equal(preflight(env, target).cancel, source === 'ordinary');
  }
});


test('signed 32-bit input is normalized to minimum one, never unlimited', async () => {
  for (const value of [-2147483648, -1, 0, 1, 2, 2147483647]) {
    const env = await clean(), target = { x: 100, y: 64, z: 100 };
    seed(env, add(target, [1, 0, 0])); configureLimit(env, value);
    assert.equal(JSON.parse(env.properties.get(SETTINGS)).maxOrderMachinesWithin24, Math.max(1, value));
    assert.equal(preflight(env, target).cancel, value <= 1);
  }
});

test('invalid input rejects the whole command and preserves previous count and leather behavior', async () => {
  for (const initial of [1, 2]) for (const value of [null, true, false, '2', [], {}, 1.5, -2147483649, 2147483648, NaN, Infinity]) {
    const env = await clean(), target = { x: 100, y: 64, z: 100 };
    seed(env, add(target, [1, 0, 0])); configureLimit(env, initial);
    const before = [...env.properties];
    configure(env, { maxOrderMachinesWithin24: value, countertopConsumeLeather: false, refreshSeconds: 42 });
    assert.deepEqual([...env.properties], before);
    assert.match(env.player.messages.at(-1), /maxOrderMachinesWithin24.*整數/);
    assert.equal(preflight(env, target).cancel, initial === 1);
  }
});

test('missing or invalid saved count defaults to one without rewriting settings; valid signed inputs normalize', async () => {
  const invalid = [null, true, false, '2', [], {}, 1.5, -2147483649, 2147483648];
  for (const value of [undefined, ...invalid, -2147483648, 0, 1, 2, 2147483647]) {
    const raw = JSON.stringify({ currencyItem: '', maxOrderMachinesWithin24: value });
    const env = await clean([[SETTINGS, raw]]), target = { x: 100, y: 64, z: 100 };
    assert.equal(env.hooks.ready, true); assert.equal(env.properties.get(SETTINGS), raw);
    seed(env, add(target, [1, 0, 0]));
    assert.equal(preflight(env, target).cancel, ![2, 2147483647].includes(value));
    assert.equal(env.properties.get(SETTINGS), raw);
  }
  const fresh = await clean(); seed(fresh, { x: 1, y: 0, z: 0 });
  assert.equal(preflight(fresh, { x: 2, y: 0, z: 0 }).cancel, true);
  assert.equal(fresh.properties.has(SETTINGS), false, 'default requires no saved settings document');
});

test('malformed settings stop initialization and cannot be replaced by a count command', async () => {
  for (const raw of ['{broken', 'null', '[]', 'false', '42', '"wrong"', 42]) {
    const env = await mainFixture([[SETTINGS, raw]]);
    assert.equal(env.hooks.ready, false); configureLimit(env, 2);
    assert.equal(env.properties.get(SETTINGS), raw);
    assert.equal(preflight(env, { x: 100, y: 64, z: 100 }).cancel, true);
  }
});

test('count persists across worldLoad; reset changes only future attempts and preserves dense restaurants exactly', async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 };
  configureLimit(env, 2);
  const first = attempt(env, add(target, [2, 0, 0]));
  const resumed = await clean(env.properties); place(resumed, TYPE, first.block.location);
  const second = attempt(resumed, add(target, [1, 0, 0]));
  assert.equal(second.event.cancel, false); assert.equal(preflight(resumed, target).cancel, true);
  for (const record of resumed.store.restaurants()) {
    record.level = 3; record.stats.earnings = 101; record.staff = ['friend'];
    // Reset must not perform the legacy refresh/upgrade config rewrite either.
    record.config.refreshMs = 34567; record.config.maxOrderMachinesWithin24 = 99;
    resumed.store.saveRestaurant(record);
  }
  const records = JSON.stringify(resumed.store.restaurants());
  const persisted = [...resumed.properties].filter(([key]) => key !== SETTINGS);
  configureLimit(resumed, 1);
  assert.equal(JSON.stringify(resumed.store.restaurants()), records);
  assert.deepEqual([...resumed.properties].filter(([key]) => key !== SETTINGS), persisted);
  for (const record of resumed.store.restaurants()) assert.equal(resumed.dimension.getBlock(record.location).typeId, TYPE);
  assert.equal(preflight(resumed, target).cancel, true);
  const reset = await clean(resumed.properties);
  for (const record of reset.store.restaurants()) place(reset, TYPE, record.location);
  assert.equal(JSON.stringify(reset.store.restaurants()), records);
  assert.equal(preflight(reset, target).cancel, true);
  reset.hooks.tickRestaurants();
  for (const record of reset.store.restaurants()) assert.equal(reset.dimension.getBlock(record.location).typeId, TYPE);
});

test('restaurant count cannot override global; portable format excludes config and rejects an injected field', async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 };
  const first = attempt(env, add(target, [2, 0, 0]));
  first.record.config.maxOrderMachinesWithin24 = 99; env.store.saveRestaurant(first.record);
  const stack = writePortableBlock(new FakeItem(TYPE), { ...env.restaurant, config: { ...env.restaurant.config, maxOrderMachinesWithin24: 99 } });
  assert.equal(Object.hasOwn(readPortableBlock(stack), 'config'), false, 'portable writer does not carry restaurant config');
  assert.equal(preflight(env, target, stack).cancel, true, 'global default beats high restaurant config');
  configureLimit(env, 2); first.record.config.maxOrderMachinesWithin24 = 1; env.store.saveRestaurant(first.record);
  const forged = stack.clone();
  const payload = JSON.parse(forged.getDynamicProperty('ordertocook:block_data:0'));
  payload.data.config = { maxOrderMachinesWithin24: 99 };
  forged.setDynamicProperty('ordertocook:block_data:0', JSON.stringify(payload));
  const saved = [...env.properties];
  assert.throws(() => readPortableBlock(forged), /Invalid portable restaurant/);
  assert.equal(attempt(env, target, forged).event.cancel, true, 'malformed portable config cannot supply another limit');
  assert.deepEqual(env.player.container.getItem(0), forged); assert.deepEqual([...env.properties], saved);
  const low = writePortableBlock(new FakeItem(TYPE), { ...env.restaurant, config: { ...env.restaurant.config, maxOrderMachinesWithin24: 1 } });
  assert.equal(attempt(env, target, low).event.cancel, false, 'global two beats low restaurant config for valid portable placement');
  assert.equal(preflight(env, add(target, [1, 0, 0]), stack).cancel, true, 'high snapshot cannot bypass two neighbors');
});

test('failed and silently omitted settings writes keep prior live count and persisted bytes', async () => {
  for (const initial of [1, 2]) for (const failure of ['throw', 'omit']) {
    const env = await clean(), target = { x: 100, y: 64, z: 100 };
    seed(env, add(target, [1, 0, 0])); configureLimit(env, initial);
    const before = [...env.properties];
    if (failure === 'throw') env.failWrite(key => key === SETTINGS);
    else { const write = env.world.setDynamicProperty; env.world.setDynamicProperty = (key, value) => { if (key !== SETTINGS) write(key, value); }; }
    configureLimit(env, initial === 1 ? 2 : 1, 'admin');
    assert.deepEqual([...env.properties], before); assert.doesNotMatch(env.player.messages.at(-1), /設定已儲存/);
    assert.equal(preflight(env, target).cancel, initial === 1);
  }
});

test('deferred count-aware error retains the attempted limit when global configuration changes', async () => {
  const env = await clean(), target = { x: 100, y: 64, z: 100 };
  configureLimit(env, 2); seed(env, add(target, [1, 0, 0])); seed(env, add(target, [2, 0, 0]));
  assert.equal(preflight(env, target).cancel, true); configureLimit(env, 3); drain(env);
  assert.deepEqual(env.player.messages.at(-1), { rawtext: [
    { text: '§6[下單了]§r ' }, { translate: 'otc.error.machine_placement_conflict', with: ['2'] }
  ] });
  assert.equal(preflight(env, target).cancel, false);
});
