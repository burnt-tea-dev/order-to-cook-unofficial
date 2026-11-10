// SPDX-License-Identifier: GPL-3.0-only
// Real script-event configuration and countertop adapters, with native IO doubles.
// These checks do not certify native forms, disk restart or multiplayer scheduling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, configure, itemCount } from './main.harness.js';
import { FakeItem, FakePlayer, place } from './appliances.harness.js';

const SETTINGS = 'ordertocook:settings';
async function counter({ type = 'delivery', saved = [] } = {}) {
  const env = await mainFixture(saved);
  env.restaurant.orders = [];
  const order = env.core.generateOrder(env.restaurant, Date.now(), () => 0.999);
  env.core.acceptOrder(env.restaurant, order.id); order.type = type;
  order.items = [{ typeId: 'minecraft:bread', label: 'Bread', nutrition: 5, amount: 2 }];
  env.store.saveRestaurant(env.restaurant);
  const block = place(env, 'ordertocook:countertop', { x: 1, y: 0, z: 0 });
  env.player.container.setItem(0, env.hooks.parcelFor(env.restaurant, order, 'ordertocook:order'));
  const food = new FakeItem('minecraft:bread', 5); food.setLore(['preserve food metadata']);
  food.nameTag = 'Special bread'; food.setDynamicProperty('test:batch', 'bread-7');
  env.player.container.setItem(1, food);
  return { ...env, order, block, food };
}
async function prepare(env, entry = 'ticket') {
  if (entry === 'picker') { env.player.container.setItem(0, undefined); env.formResponses.push(0); }
  if (env.order.type === 'dine_in') { env.player.isSneaking = true; env.formResponses.push(1); }
  await env.hooks.countertopForm(env.player, env.block);
}
function stock(env, count = 3, typeId = 'ordertocook:shelf') {
  const block = place(env, typeId, { x: 1, y: 0, z: 1 });
  const ticket = env.player.container.getItem(0);
  env.player.container.setItem(0, new FakeItem(typeId === 'ordertocook:shelf' ? 'minecraft:leather' : 'ordertocook:clean_plate', Math.max(count, 1)));
  env.player.isSneaking = true;
  if (count) env.hooks.shelfInteract(env.player, block); else env.store.saveStation(env.store.getStation(block));
  env.player.isSneaking = false; env.player.container.setItem(0, ticket);
  return { block, station: env.store.findStation(block) };
}
const inventory = env => Array.from({ length: env.player.container.size }, (_, slot) => structuredClone(env.player.container.getItem(slot)));
const stationRecords = env => [...env.properties].filter(([key]) => key.startsWith('ordertocook:s:'));

// One success matrix differentiates both entries/carriers and every supply state.
test('disabled global leather bypasses all shelf IO but preserves exact food remainder and native bags', async () => {
  for (const type of ['delivery', 'dine_in']) for (const entry of ['ticket', 'picker']) {
    for (const state of ['absent', 'empty', 'stocked', 'inaccessible', 'unloaded']) {
      const env = await counter({ type });
      const shelf = state === 'absent' ? undefined : stock(env, state === 'empty' ? 0 : 3);
      if (state === 'inaccessible') {
        // A foreign machine controls the shelf without controlling our counter.
        shelf.block.setType('minecraft:air'); env.store.deleteStation(shelf.station);
        const other = new FakePlayer(env.dimension, { x: 7, y: 5, z: 5 }); other.getGameMode = () => 'Survival';
        env.hooks.getMachine(other, place(env, 'ordertocook:order_machine', other.location));
        shelf.block = place(env, 'ordertocook:shelf', { x: 6, y: 5, z: 5 });
        shelf.station = env.store.getStation(shelf.block); shelf.station.supplies = 3; env.store.saveStation(shelf.station);
        assert.equal(env.hooks.canUseStation(env.player, shelf.station), false);
      }
      configure(env, { countertopConsumeLeather: false }, 'server');
      // A conflicting restaurant value must not override the world setting.
      env.restaurant.config.countertopConsumeLeather = true; env.store.saveRestaurant(env.restaurant);
      const records = stationRecords(env), supply = shelf && JSON.stringify(shelf.station);
      const getBlock = env.dimension.getBlock.bind(env.dimension), setProperty = env.world.setDynamicProperty;
      let shelfReads = 0, shelfWrites = 0;
      env.dimension.getBlock = location => {
        if (shelf && JSON.stringify(location) === JSON.stringify(shelf.block.location)) {
          shelfReads++;
          if (state === 'unloaded') throw Error('unloaded shelf must never be read');
          assert.fail('disabled bag must not discover or update a shelf');
        }
        return getBlock(location);
      };
      env.world.setDynamicProperty = (key, value) => {
        if (shelf && key.startsWith(`ordertocook:s:${shelf.station.id}`)) { shelfWrites++; assert.fail('disabled bag must never write a shelf'); }
        setProperty(key, value);
      };
      await prepare(env, entry);
      assert.equal(env.order.status, 'packed', `${type}/${entry}/${state}`);
      // loadedBlock deliberately catches native read errors, so assert counts
      // outside the read trap rather than relying on a swallowed assertion.
      assert.equal(shelfReads, 0); assert.equal(shelfWrites, 0);
      assert.equal(env.order.carrier, 'bag'); assert.equal(env.block.above().typeId, 'ordertocook:takeout_bag');
      if (entry === 'picker' && type === 'delivery') assert.match(env.forms[0][3][0], /可製作/);
      if (type === 'dine_in') assert.match(env.forms.at(-1)[2], /不需.*包材/);
      const expectedFood = env.food.clone(); expectedFood.amount = 3;
      assert.deepEqual(structuredClone(env.player.container.getItem(1)), structuredClone(expectedFood));
      const native = env.block.above().container.getItem(0);
      assert.deepEqual(structuredClone(native), structuredClone(env.hooks.parcelFor(env.restaurant, env.order)));
      assert.deepEqual(stationRecords(env).filter(([key]) => !key.includes(`:${env.store.findStation(env.block.above()).id}`)), records);
      if (shelf) assert.equal(JSON.stringify(shelf.station), supply);
      env.hooks.pickupDisplay(env.player, env.block.above());
      assert.deepEqual(structuredClone(env.player.container.getItem(0)), structuredClone(native));
      const after = inventory(env);
      await prepare(env); // No accepted order remains: never create a second bag.
      assert.deepEqual(inventory(env), after); assert.equal(env.block.above().isAir, true);
    }
  }
});

test('default, explicit true and legacy missing settings retain the leather gate for both carriers and entries', async () => {
  for (const source of ['default', 'true', 'legacy']) for (const type of ['delivery', 'dine_in']) for (const entry of ['ticket', 'picker']) {
    const env = await counter({ type, saved: source === 'legacy' ? [[SETTINGS, '{"currencyItem":"minecraft:emerald"}']] : [] });
    if (source === 'true') configure(env, { countertopConsumeLeather: true });
    env.restaurant.config.countertopConsumeLeather = false; env.store.saveRestaurant(env.restaurant);
    await prepare(env, entry);
    assert.equal(env.order.status, 'accepted'); assert.equal(itemCount(env.player, 'minecraft:bread'), 5);
    const shelf = stock(env); await prepare(env, entry);
    assert.equal(env.order.status, 'packed'); assert.equal(shelf.station.supplies, 2);
  }
});

test('server, creative and tagged admins persist strict booleans; ordinary players cannot change the global switch', async () => {
  for (const source of ['server', 'creative', 'admin', 'ordinary']) {
    const env = await counter(); const before = [...env.properties];
    configure(env, { countertopConsumeLeather: false }, source);
    if (source === 'ordinary') assert.deepEqual([...env.properties], before);
    else assert.equal(JSON.parse(env.properties.get(SETTINGS)).countertopConsumeLeather, false);
    await prepare(env); assert.equal(env.order.status, source === 'ordinary' ? 'accepted' : 'packed');
  }
});

test('invalid config types reject without persisting or mutating previously enabled/disabled behavior', async () => {
  for (const initial of [false, true]) for (const value of [null, 0, 1, 'false', 'true', [], {}]) {
    const env = await counter(); configure(env, { countertopConsumeLeather: initial });
    const before = [...env.properties];
    configure(env, { countertopConsumeLeather: value, refreshSeconds: 42 });
    assert.deepEqual([...env.properties], before);
    assert.match(env.player.messages.at(-1), /countertopConsumeLeather.*boolean/);
    await prepare(env); assert.equal(env.order.status, initial ? 'accepted' : 'packed');
  }
});

test('invalid saved field types default true without rewriting the raw settings; malformed documents stop safely', async () => {
  for (const value of [null, 0, 1, 'false', 'true', [], {}]) {
    const raw = JSON.stringify({ countertopConsumeLeather: value });
    const env = await counter({ saved: [[SETTINGS, raw]] });
    assert.equal(env.hooks.ready, true); assert.equal(env.properties.get(SETTINGS), raw);
    await prepare(env); assert.equal(env.order.status, 'accepted'); assert.equal(env.properties.get(SETTINGS), raw);
  }
  for (const raw of ['{broken', 'null', '[]', 'false', '42', '"wrong"', 42]) {
    const env = await mainFixture([[SETTINGS, raw]]);
    assert.equal(env.hooks.ready, false); assert.equal(env.properties.get(SETTINGS), raw);
    configure(env, { countertopConsumeLeather: false }); assert.equal(env.properties.get(SETTINGS), raw);
  }
});

test('false survives a fresh worldLoad; true reset affects subsequent preparation without reclaiming shelf stock', async () => {
  const first = await counter(); const shelf = stock(first);
  configure(first, { countertopConsumeLeather: false }); await prepare(first);
  assert.equal(shelf.station.supplies, 3);
  const saved = first.properties.get(SETTINGS);
  const reload = await counter({ saved: [[SETTINGS, saved]] }); await prepare(reload);
  assert.equal(reload.order.status, 'packed');
  const reset = await counter({ saved: [[SETTINGS, saved]] }); const resetShelf = stock(reset);
  const shelfBefore = JSON.stringify(resetShelf.station);
  configure(reset, { countertopConsumeLeather: true }); assert.equal(JSON.stringify(resetShelf.station), shelfBefore);
  assert.equal(JSON.parse(reset.properties.get(SETTINGS)).countertopConsumeLeather, true);
  await prepare(reset); assert.equal(resetShelf.station.supplies, 2);
  const reloadedTrue = await counter({ saved: [[SETTINGS, reset.properties.get(SETTINGS)]] });
  await prepare(reloadedTrue); assert.equal(reloadedTrue.order.status, 'accepted');
});

test('failed and silently omitted settings writes do not change current preparation behavior', async () => {
  for (const initial of [false, true]) for (const failure of ['throw', 'omit']) {
    const env = await counter(); configure(env, { countertopConsumeLeather: initial });
    const before = env.properties.get(SETTINGS);
    if (failure === 'throw') env.failWrite(id => id === SETTINGS);
    else { const write = env.world.setDynamicProperty; env.world.setDynamicProperty = (id, value) => { if (id !== SETTINGS) write(id, value); }; }
    configure(env, { countertopConsumeLeather: !initial });
    assert.equal(env.properties.get(SETTINGS), before);
    assert.doesNotMatch(env.player.messages.at(-1), /設定已儲存/);
    await prepare(env); assert.equal(env.order.status, initial ? 'accepted' : 'packed');
  }
});

test('preparation reads the current global switch after either deferred picker or carrier form closes', async () => {
  for (const type of ['delivery', 'dine_in']) for (const initial of [false, true]) {
    const env = await counter({ type }); configure(env, { countertopConsumeLeather: initial });
    let close;
    if (type === 'delivery') env.player.container.setItem(0, undefined); else env.player.isSneaking = true;
    env.formResponses.push(() => new Promise(resolve => { close = resolve; }));
    const pending = env.hooks.countertopForm(env.player, env.block);
    assert.equal(typeof close, 'function'); configure(env, { countertopConsumeLeather: !initial });
    close(type === 'delivery' ? 0 : 1); await pending;
    assert.equal(env.order.status, initial ? 'packed' : 'accepted');
    assert.equal(itemCount(env.player, 'minecraft:bread'), initial ? 3 : 5);
  }
});

test('disabled leather still requires food, drops blocked bags and both plate entry modes require a clean plate', async () => {
  const missing = await counter(); configure(missing, { countertopConsumeLeather: false });
  missing.player.container.setItem(1, undefined);
  const before = inventory(missing); await prepare(missing);
  assert.equal(missing.order.status, 'accepted'); assert.deepEqual(inventory(missing), before);
  const blocked = await counter(); configure(blocked, { countertopConsumeLeather: false });
  place(blocked, 'minecraft:stone', blocked.block.above().location);
  await prepare(blocked);
  assert.equal(blocked.order.status, 'packed'); assert.equal(itemCount(blocked.player, 'minecraft:bread'), 3);
  assert.equal(blocked.block.above().typeId, 'minecraft:stone'); assert.equal(blocked.dimension.drops.length, 1);
  assert.deepEqual(structuredClone(blocked.dimension.drops[0].stack), structuredClone(blocked.hooks.parcelFor(blocked.restaurant, blocked.order)));
  for (const choice of ['default', 'explicit']) {
    const env = await counter({ type: 'dine_in' }); configure(env, { countertopConsumeLeather: false });
    env.player.isSneaking = choice === 'explicit'; if (choice === 'explicit') env.formResponses.push(0);
    const before = inventory(env); await env.hooks.countertopForm(env.player, env.block);
    assert.equal(env.order.status, 'accepted'); assert.deepEqual(inventory(env), before);
    const shelf = stock(env, 3, 'ordertocook:plate_shelf');
    env.player.isSneaking = choice === 'explicit'; if (choice === 'explicit') env.formResponses.push(0);
    await env.hooks.countertopForm(env.player, env.block);
    assert.equal(env.order.status, 'packed'); assert.equal(env.order.carrier, 'plate'); assert.equal(shelf.station.supplies, 2);
  }
});
