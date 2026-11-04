// SPDX-License-Identifier: GPL-3.0-only
// Exercise shipped main.js initialization and event subscriptions. Native ItemTypes
// and the script-event transport are doubles; this is not a cross-pack BDS test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture } from './main.harness.js';

const announcement = 'ordertocook:smoking_recipes_v1';
const request = 'ordertocook:request_smoking_recipes_v1';
const raw = 'supplier:raw_fillet', cooked = 'supplier:cooked_fillet';
const recipe = overrides => ({ id: 'supplier:smoked_fillet', process: 'smoking',
  input: raw, output: cooked, count: 1, ...overrides });
const snapshot = (recipes = [recipe()]) => ({ version: 1, provider: 'supplier', catalog: 'fish', recipes });
const announce = (fixture, value) => fixture.system.sendScriptEvent(announcement, JSON.stringify(value));

test('main gives appliances its nine-recipe map and sends exactly one deferred startup request', async () => {
  const f = await mainFixture();
  const live = f.applianceContext.smokingRecipes;
  assert.equal(Object.keys(live).length, 9);
  assert.deepEqual(live['minecraft:beef'], { output: 'minecraft:cooked_beef', count: 1 });
  assert.equal(f.scriptEvents.filter(event => event.id === request).length, 0);
  // Run each scheduled callback once, just as the engine drains its run queue.
  while (f.system.callbacks.length) f.system.callbacks.shift()();
  const requests = f.scriptEvents.filter(event => event.id === request);
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].message), { version: 1 });
  assert.equal(f.applianceContext.smokingRecipes, live);
  assert.equal(Object.keys(live).length, 9);
});

test('Server announcements add, update and withdraw a provider catalog on the actual appliance context', async () => {
  const f = await mainFixture();
  const alternative = 'supplier:smoked_fillet';
  [raw, cooked, alternative].forEach(id => f.installedItems.add(id));
  const live = f.applianceContext.smokingRecipes;
  announce(f, snapshot());
  assert.deepEqual(live[raw], { output: cooked, count: 1 });
  assert.equal(Object.keys(live).length, 10);
  announce(f, snapshot([recipe({ output: alternative, count: 2 })]));
  assert.equal(f.applianceContext.smokingRecipes, live);
  assert.deepEqual(live[raw], { output: alternative, count: 2 });
  assert.equal(Object.keys(live).length, 10);
  announce(f, snapshot([]));
  assert.equal(f.applianceContext.smokingRecipes, live);
  assert.equal(live[raw], undefined);
  assert.equal(Object.keys(live).length, 9);
});

test('main rejects Entity, Block and malformed provider events without changing accepted data', async t => {
  const f = await mainFixture();
  [raw, cooked].forEach(id => f.installedItems.add(id));
  announce(f, snapshot());
  const live = f.applianceContext.smokingRecipes;
  const before = structuredClone(live);
  const message = JSON.stringify(snapshot([recipe({ count: 2 })]));
  for (const sourceType of ['Entity', 'Block']) {
    for (const receive of f.system.afterEvents.scriptEventReceive.subscriptions) {
      receive({ id: announcement, message, sourceType, sourceEntity: sourceType === 'Entity' ? f.player : undefined });
    }
    assert.deepEqual(live, before);
  }
  t.mock.method(console, 'warn', () => {}); // Expected parser rejection is not a test-run failure.
  f.system.sendScriptEvent(announcement, '{malformed');
  assert.deepEqual(live, before);
  assert.equal(f.applianceContext.smokingRecipes, live);
});

test('main uses native ItemTypes availability for both recipe ends before admitting a provider', async t => {
  const f = await mainFixture();
  f.installedItems.add(raw);
  t.mock.method(console, 'warn', () => {}); // Missing optional pack output is an expected rejection.
  announce(f, snapshot());
  assert.equal(f.applianceContext.smokingRecipes[raw], undefined);
  assert.equal(Object.keys(f.applianceContext.smokingRecipes).length, 9);
  f.installedItems.add(cooked);
  announce(f, snapshot());
  assert.deepEqual(f.applianceContext.smokingRecipes[raw], { output: cooked, count: 1 });
  assert.equal(Object.keys(f.applianceContext.smokingRecipes).length, 10);
});
