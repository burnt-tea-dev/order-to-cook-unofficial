// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { restaurantNameIsDefault, sanitizeRestaurantName } from '../runtime/BP/scripts/restaurant_name.js';
import { writePortableBlock, readPortableBlock } from '../runtime/BP/scripts/portable_blocks.js';
import { mainFixture } from './main.harness.js';
import { FakeItem } from './appliances.harness.js';
const TYPE = 'ordertocook:order_machine', DATA = 'ordertocook:block_data';
const emit = (signal, event) => { for (const fn of signal.subscriptions) fn(event); return event; };
function move(env, stack) {
  const block = env.dimension.getBlock({ x: 40, y: 0, z: 0 });
  env.player.container.setItem(0, stack);
  const component = env.blockComponents.get('ordertocook:interact');
  const event = { block, player: env.player, permutationToPlace: { type: { id: TYPE } }, cancel: false };
  component.beforeOnPlayerPlace(event);
  if (!event.cancel) {
    block.setType(TYPE); env.player.container.setItem(0, undefined);
    emit(env.world.afterEvents.playerPlaceBlock, { player: env.player, block });
    component.onPlace({ block });
  }
  return { event, block, restored: env.store.getRestaurant(env.store.locationId(block.dimension.id, block.location)) };
}
function rawPayload(record) {
  const stack = new FakeItem(TYPE);
  stack.setDynamicProperty(DATA, 1);
  stack.setDynamicProperty(DATA + ':0', JSON.stringify({ version: 1, typeId: TYPE, data: record }));
  return stack;
}

test('pure marker interpretation keeps explicit state and rejects malformed explicit values', () => {
  const base = { name: 'Owner 的餐廳', ownerName: 'Owner' };
  assert.equal(restaurantNameIsDefault(base), true);
  assert.equal(restaurantNameIsDefault({ ...base, nameIsDefault: false }), false);
  assert.equal(restaurantNameIsDefault({ ...base, name: 'Custom' }), false);
  assert.equal(restaurantNameIsDefault({ ...base, name: '' }), true);
  for (const marker of [undefined, null, 'true', 0, [], {}]) assert.throws(() => restaurantNameIsDefault({ ...base, nameIsDefault: marker }), /Invalid/);
  for (const record of [undefined, {}, { name: 1, ownerName: 'Owner' }]) assert.throws(() => restaurantNameIsDefault(record), /Invalid/);
  assert.equal(sanitizeRestaurantName(' §bName '), 'Name'); assert.equal(sanitizeRestaurantName(null), undefined);
});
for (const state of ['default', 'custom', 'legacy-generated', 'legacy-empty', 'legacy-custom', 'explicit-generated-custom']) test(`${state} survives portable break, actual placement and store reload without resetting durable fields`, async () => {
  const env = await mainFixture(); env.restaurant.orders = []; env.restaurant.active = false;
  env.restaurant.ownerName = 'Saved Owner'; env.restaurant.staff = ['staff']; env.restaurant.level = 6;
  env.restaurant.orderSequence = 23;
  Object.keys(env.restaurant.stats).forEach((key, index) => { env.restaurant.stats[key] = index * 11; });
  env.restaurant.name = ['default', 'legacy-generated', 'explicit-generated-custom'].includes(state) ? 'Saved Owner 的餐廳' : state === 'legacy-empty' ? '' : 'Original Custom';
  if (state.startsWith('legacy-')) delete env.restaurant.nameIsDefault;
  else env.restaurant.nameIsDefault = state === 'default';
  env.store.saveRestaurant(env.restaurant);
  const before = readPortableBlock(writePortableBlock(new FakeItem(TYPE), env.restaurant));
  const isDefault = ['default', 'legacy-generated', 'legacy-empty'].includes(state);
  assert.equal(restaurantNameIsDefault(before), isDefault);
  const event = emit(env.world.beforeEvents.playerBreakBlock, { block: env.machine, player: env.player, cancel: false });
  assert.equal(event.cancel, false);
  const brokenBlockPermutation = env.machine.permutation; env.machine.setType('minecraft:air');
  const component = env.blockComponents.get('ordertocook:interact');
  component.onBreak({ block: env.machine, brokenBlockPermutation });
  const stack = env.dimension.drops.at(-1).stack;
  assert.equal(env.store.getRestaurant(env.restaurant.id), undefined);
  assert.deepEqual(readPortableBlock(stack), before);
  env.player.id = 'new-placer'; env.player.name = 'Different Placer';
  const { restored, event: placed } = move(env, stack);
  assert.equal(placed.cancel, false);
  for (const [key, value] of Object.entries(before)) assert.deepEqual(restored[key], value, key);
  assert.equal(restaurantNameIsDefault(restored), isDefault); assert.equal(restored.active, false); assert.deepEqual(restored.orders, []);
  assert.equal(Object.hasOwn(restored, 'nameIsDefault'), !state.startsWith('legacy-'));
  const loaded = await mainFixture(env.properties), persisted = loaded.store.getRestaurant(restored.id);
  assert.equal(restaurantNameIsDefault(persisted), isDefault); assert.equal(persisted.name, before.name);
  assert.deepEqual(persisted.stats, before.stats);
});
for (const marker of [null, 1, 'false', [], {}]) test(`malformed portable marker ${JSON.stringify(marker)} never places or erases the input`, async () => {
  const env = await mainFixture();
  const valid = readPortableBlock(writePortableBlock(new FakeItem(TYPE), env.restaurant));
  const record = { ...valid, nameIsDefault: marker };
  const output = new FakeItem(TYPE); assert.throws(() => writePortableBlock(output, record), /marker/); assert.deepEqual(output.properties, {});
  const stack = rawPayload(record); assert.throws(() => readPortableBlock(stack), /marker/);
  const before = structuredClone(env.restaurant);
  const { event, block, restored } = move(env, stack);
  assert.equal(event.cancel, true); assert.equal(block.typeId, 'minecraft:air'); assert.equal(restored, undefined);
  assert.deepEqual(env.player.container.getItem(0), stack); assert.deepEqual(env.store.getRestaurant(env.restaurant.id), before);
});
test('malformed stored marker cancels player break; force-break adapter cannot remove the saved record', async () => {
  const env = await mainFixture(); env.restaurant.orders = []; env.restaurant.nameIsDefault = 'invalid'; env.store.saveRestaurant(env.restaurant);
  const before = structuredClone(env.restaurant), drops = env.dimension.drops.length;
  const event = emit(env.world.beforeEvents.playerBreakBlock, { block: env.machine, player: env.player, cancel: false });
  assert.equal(event.cancel, true); assert.equal(env.machine.typeId, TYPE);
  const brokenBlockPermutation = env.machine.permutation; env.machine.setType('minecraft:air');
  env.blockComponents.get('ordertocook:interact').onBreak({ block: env.machine, brokenBlockPermutation });
  assert.deepEqual(env.store.getRestaurant(env.restaurant.id), before); assert.equal(env.dimension.drops.length, drops);
});
