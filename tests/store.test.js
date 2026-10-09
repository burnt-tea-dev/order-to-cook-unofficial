// SPDX-License-Identifier: GPL-3.0-only
// Executes the production store with only the Minecraft world import replaced.
// The adapter enforces the native string-byte ceiling and can interrupt writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRestaurant } from '../runtime/BP/scripts/core.js';

const storeSource = await readFile(new URL('../runtime/BP/scripts/store.js', import.meta.url), 'utf8');
const importLine = /^import \{ world \} from '@minecraft\/server';$/m;
assert.match(storeSource, importLine, 'update the explicit world adapter if the production import changes');
const worldAdapter = `
const world = {
  properties: new Map(), writes: [], beforeWrite: undefined, afterWrite: undefined,
  getDynamicPropertyIds() { return [...this.properties.keys()]; },
  getDynamicProperty(key) { return this.properties.get(key); },
  setDynamicProperty(key, value) {
    const write = { key, value, index: this.writes.length + 1 };
    this.writes.push(write);
    this.beforeWrite?.(write, this);
    if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > 32767) {
      throw new Error('Native dynamic property string limit exceeded');
    }
    if (value === undefined) this.properties.delete(key);
    else this.properties.set(key, value);
    this.afterWrite?.(write, this);
  },
  getDimension() { return { getBlock() { return undefined; } }; }
};
`;
let fixtureId = 0;
async function fixture(properties = new Map()) {
  const source = storeSource.replace(importLine, worldAdapter) +
    `\nexport { world as testWorld };\n// fixture ${++fixtureId}`;
  const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  api.testWorld.properties = new Map(properties);
  return api;
}
function silenceExpectedWarning(action) {
  const warn = console.warn;
  console.warn = () => {};
  try { return action(); } finally { console.warn = warn; }
}
function station(id = 'overworld_0_64_0', extra = {}) {
  return {
    id, dimensionId: 'minecraft:overworld', location: { x: 0, y: 64, z: 0 },
    typeId: 'ordertocook:menu', kind: 'menu', ownerId: 'owner', menu: [], supplies: 0,
    ...extra
  };
}
function rootKey(value, kind = 's') { return `ordertocook:${kind}:${value.id}`; }
function manifestOf(api, value, kind = 's') {
  return JSON.parse(api.testWorld.properties.get(rootKey(value, kind)));
}
function chunksFor(api, value, kind = 's') {
  const key = rootKey(value, kind);
  const manifest = manifestOf(api, value, kind);
  return Array.from({ length: manifest.parts }, (_, index) =>
    api.testWorld.properties.get(`${key}:part:${manifest.buffer}:${index}`));
}
async function reload(api) {
  const next = await fixture(api.testWorld.properties);
  silenceExpectedWarning(() => next.initStore());
  return next;
}
function largeStation() {
  return station(undefined, {
    displayName: '餐廳 🍲 客製資料',
    menu: Array.from({ length: 150 }, (_, index) => ({
      typeId: `example:food_${index}`, nutrition: index % 16 + 1,
      label: `招牌 ${index} ${'湯麵🥘'.repeat(40)}`,
      metadata: { source: '自訂料理', note: '這些資料必須完整保存 🥢' }
    }))
  });
}

test('legacy inline JSON loads and migrates to a manifest on the next save', async () => {
  const saved = station(undefined, { supplies: 17, note: 'existing world data' });
  const key = rootKey(saved);
  const api = await fixture(new Map([[key, JSON.stringify(saved)]]));
  api.initStore();
  assert.deepEqual(api.stations(), [saved]);
  assert.equal(api.testWorld.writes.length, 0, 'loading alone must not rewrite a legacy save');
  api.stations()[0].supplies = 18;
  api.saveStation(api.stations()[0]);
  assert.deepEqual(manifestOf(api, saved), { __otcParts: true, id: saved.id, buffer: 'a', parts: 1 });
  const restored = await reload(api);
  assert.deepEqual(restored.stations(), [{ ...saved, supplies: 18 }]);
});

test('large Unicode metadata spans byte-safe chunks and reloads without loss', async () => {
  const api = await fixture();
  api.initStore();
  const value = largeStation();
  assert.ok(Buffer.byteLength(JSON.stringify(value), 'utf8') > 60000);
  api.saveStation(value);
  const chunks = chunksFor(api, value);
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) {
    assert.ok(Buffer.byteLength(chunk, 'utf8') <= 30000);
    assert.doesNotMatch(chunk, /^[\uDC00-\uDFFF]/, 'chunk cannot start with a low surrogate');
    assert.doesNotMatch(chunk, /[\uD800-\uDBFF]$/, 'chunk cannot end with a high surrogate');
  }
  assert.equal(chunks.join(''), JSON.stringify(value));
  assert.deepEqual((await reload(api)).stations(), [value]);
});

test('new chunks precede the root commit and old-buffer cleanup follows it', async () => {
  const api = await fixture();
  api.initStore();
  const value = largeStation();
  api.saveStation(value);
  const key = rootKey(value);
  const oldManifest = manifestOf(api, value);
  const start = api.testWorld.writes.length;
  value.supplies = 42;
  api.saveStation(value);
  const nextManifest = manifestOf(api, value);
  assert.equal(nextManifest.buffer, 'b');
  const writes = api.testWorld.writes.slice(start);
  const rootIndex = writes.findIndex(write => write.key === key);
  assert.equal(rootIndex, nextManifest.parts);
  assert.ok(writes.slice(0, rootIndex).every(write => write.key.startsWith(`${key}:part:b:`) && typeof write.value === 'string'));
  assert.ok(writes.slice(rootIndex + 1).every(write => write.key.startsWith(`${key}:part:a:`) && write.value === undefined));
  assert.equal(writes.length, nextManifest.parts + 1 + oldManifest.parts);
  for (let index = 0; index < oldManifest.parts; index++) {
    assert.equal(api.testWorld.properties.has(`${key}:part:a:${index}`), false);
  }
  value.supplies++;
  api.saveStation(value);
  assert.equal(manifestOf(api, value).buffer, 'a');
  assert.deepEqual((await reload(api)).stations(), [value]);
});

test('a partial new-buffer write preserves disk and restores the canonical Map snapshot', async () => {
  const api = await fixture();
  api.initStore();
  const value = largeStation();
  api.saveStation(value);
  const key = rootKey(value), rootBefore = api.testWorld.properties.get(key);
  const before = structuredClone(value);
  value.supplies = 999;
  value.menu[0].label = 'uncommitted mutation';
  api.testWorld.beforeWrite = ({ key: writeKey }) => {
    if (writeKey === `${key}:part:b:1`) throw new Error('Interrupted second chunk');
  };
  assert.throws(() => api.saveStation(value), /Interrupted second chunk/);
  assert.equal(api.testWorld.properties.get(key), rootBefore);
  assert.ok(api.testWorld.properties.has(`${key}:part:b:0`), 'interrupted write can leave an orphan');
  assert.deepEqual(api.stations(), [before]);
  assert.notEqual(api.stations()[0], value, 'dirty caller reference is detached from the canonical store');
  const restored = await reload(api);
  assert.deepEqual(restored.stations(), [before]);
  assert.equal(restored.stations().length, 1, 'orphan fragments are not records');
  api.testWorld.beforeWrite = undefined;
  api.stations()[0].supplies = 43;
  api.saveStation(api.stations()[0]);
  assert.equal(manifestOf(api, value).buffer, 'b', 'retry safely reuses the inactive buffer');
  assert.deepEqual((await reload(api)).stations(), [{ ...before, supplies: 43 }]);
});

test('a root commit failure leaves the previous complete snapshot readable', async () => {
  const api = await fixture();
  api.initStore();
  const value = largeStation();
  api.saveStation(value);
  const before = structuredClone(value), key = rootKey(value);
  const rootBefore = api.testWorld.properties.get(key);
  value.ownerId = 'uncommitted owner';
  api.testWorld.beforeWrite = ({ key: writeKey }) => {
    if (writeKey === key) throw new Error('Interrupted manifest commit');
  };
  assert.throws(() => api.saveStation(value), /Interrupted manifest commit/);
  assert.equal(api.testWorld.properties.get(key), rootBefore);
  assert.deepEqual(api.stations(), [before]);
  assert.deepEqual((await reload(api)).stations(), [before]);
});

test('a first-save interruption cannot expose a partial new record on reload', async () => {
  const api = await fixture();
  api.initStore();
  const value = largeStation(), key = rootKey(value);
  api.testWorld.beforeWrite = ({ key: writeKey }) => {
    if (writeKey === `${key}:part:a:1`) throw new Error('First save interrupted');
  };
  assert.throws(() => api.saveStation(value), /First save interrupted/);
  assert.equal(api.testWorld.properties.has(key), false);
  assert.equal(api.stations().length, 0);
  const restored = await reload(api);
  assert.equal(restored.stations().length, 0);
  restored.saveStation(value);
  assert.deepEqual((await reload(restored)).stations(), [value]);
});

test('an exception after the manifest was applied recognizes the committed save', async () => {
  const api = await fixture();
  api.initStore();
  const value = station(), key = rootKey(value);
  api.saveStation(value);
  value.supplies = 19;
  api.testWorld.afterWrite = ({ key: writeKey }) => {
    if (writeKey === key) throw new Error('Adapter threw after commit');
  };
  assert.equal(api.saveStation(value), value);
  assert.equal(api.stations()[0].supplies, 19);
  assert.deepEqual((await reload(api)).stations(), [value]);
});

test('cleanup failure cannot undo a successful new snapshot', async () => {
  const api = await fixture();
  api.initStore();
  const value = station(), key = rootKey(value);
  api.saveStation(value);
  value.supplies = 24;
  api.testWorld.beforeWrite = ({ key: writeKey, value: newValue }) => {
    if (writeKey.startsWith(`${key}:part:a:`) && newValue === undefined) throw new Error('Cleanup unavailable');
  };
  silenceExpectedWarning(() => api.saveStation(value));
  assert.equal(manifestOf(api, value).buffer, 'b');
  assert.ok(api.testWorld.properties.has(`${key}:part:a:0`));
  assert.deepEqual((await reload(api)).stations(), [value]);
});

test('unreadable inline data and incomplete manifests remain fail-closed', async () => {
  for (const bad of [
    '{broken JSON',
    JSON.stringify({ __otcParts: true, id: station().id, buffer: 'a', parts: 2 }),
    JSON.stringify({ __otcParts: true, id: station().id, buffer: 'x', parts: 1 }),
    JSON.stringify({ __otcParts: true, id: station().id, buffer: 'a', parts: Number.MAX_SAFE_INTEGER })
  ]) {
    const value = station(), key = rootKey(value);
    const props = new Map([[key, bad], [`${key}:part:a:0`, 'left untouched']]);
    const api = await fixture(props);
    silenceExpectedWarning(() => api.initStore());
    assert.deepEqual(api.stations(), []);
    assert.throws(() => api.saveStation(value), /needs recovery/);
    assert.throws(() => api.deleteStation(value), /needs recovery/);
    assert.deepEqual(api.testWorld.properties, props);
    assert.equal(api.testWorld.writes.length, 0);
  }
});

test('manifest-record ID mismatch is not loaded under a second identity', async () => {
  const value = station(), key = rootKey(value);
  const props = new Map([
    [key, JSON.stringify({ __otcParts: true, id: value.id, buffer: 'a', parts: 1 })],
    [`${key}:part:a:0`, JSON.stringify({ ...value, id: 'different_identity' })]
  ]);
  const api = await fixture(props);
  silenceExpectedWarning(() => api.initStore());
  assert.equal(api.stations().length, 0);
  assert.throws(() => api.saveStation(value), /needs recovery/);
  assert.deepEqual(api.testWorld.properties, props);
});

test('serialization failure restores the last committed mutable record', async () => {
  const api = await fixture();
  api.initStore();
  const value = station();
  api.saveStation(value);
  const before = structuredClone(value), writes = api.testWorld.writes.length;
  value.supplies = 33;
  value.cycle = value;
  assert.throws(() => api.saveStation(value), /circular/i);
  assert.deepEqual(api.stations(), [before]);
  assert.equal(api.testWorld.writes.length, writes);
  assert.deepEqual((await reload(api)).stations(), [before]);
});

test('32 active orders and the retained 12 history entries can exceed one property safely', async () => {
  const api = await fixture();
  api.initStore();
  const value = createRestaurant({
    id: 'overworld_10_64_20', ownerId: 'owner', level: 8,
    location: { x: 10, y: 64, z: 20 }, menu: largeStation().menu
  }, 1000);
  const order = (id, status) => ({
    id, type: 'delivery', tier: 4, rush: true, longDistance: true,
    items: Array.from({ length: 6 }, (_, index) => ({ typeId: `example:food_${index}`, amount: 6 })),
    reward: 450, createdAt: 1000, expiresAt: 601000, status,
    destination: { dimensionId: 'minecraft:overworld', x: 1650, y: 64, z: 1200 },
    note: '配送記錄 🥡'.repeat(25)
  });
  value.orders = [
    ...Array.from({ length: 20 }, (_, index) => order(`history_${index}`, 'completed')),
    ...Array.from({ length: 32 }, (_, index) => order(`active_${index}`, ['offered', 'accepted', 'packed'][index % 3]))
  ];
  api.saveRestaurant(value);
  assert.equal(value.orders.length, 44);
  assert.equal(value.orders[0].id, 'history_8');
  assert.equal(value.orders.filter(item => item.id.startsWith('active_')).length, 32);
  assert.ok(Buffer.byteLength(JSON.stringify(value), 'utf8') > 32767);
  const restored = await reload(api);
  assert.deepEqual(restored.getRestaurant(value.id), value);
});

test('failed restaurant completion save restores its prior accepted state in memory', async () => {
  const api = await fixture();
  api.initStore();
  const value = createRestaurant({ id: 'overworld_0_64_0' }, 1000);
  value.orders = [{ id: 'order_1', status: 'accepted', reward: 7 }];
  api.saveRestaurant(value);
  const before = structuredClone(value), key = rootKey(value, 'r');
  value.orders[0].status = 'completed';
  value.stats.earnings += 7;
  api.testWorld.beforeWrite = ({ key: writeKey }) => {
    if (writeKey === key) throw new Error('Restaurant commit failure');
  };
  assert.throws(() => api.saveRestaurant(value), /Restaurant commit failure/);
  assert.deepEqual(api.getRestaurant(value.id), before);
  assert.notEqual(api.getRestaurant(value.id), value);
  assert.deepEqual((await reload(api)).getRestaurant(value.id), before);
});

test('deleting a chunked record clears the root before chunks and excludes it on reload', async () => {
  const api = await fixture();
  api.initStore();
  const value = largeStation();
  api.saveStation(value);
  const start = api.testWorld.writes.length, key = rootKey(value);
  api.deleteStation(value);
  assert.deepEqual(api.testWorld.writes[start], { key, value: undefined, index: start + 1 });
  assert.equal(api.testWorld.properties.size, 0);
  assert.deepEqual(api.stations(), []);
  assert.deepEqual((await reload(api)).stations(), []);
});

test('failed root deletion retains the previous record and all its referenced chunks', async () => {
  const api = await fixture();
  api.initStore();
  const value = station();
  api.saveStation(value);
  const props = new Map(api.testWorld.properties), key = rootKey(value);
  api.testWorld.beforeWrite = ({ key: writeKey }) => {
    if (writeKey === key) throw new Error('Delete unavailable');
  };
  assert.throws(() => api.deleteStation(value), /Delete unavailable/);
  assert.deepEqual(api.testWorld.properties, props);
  assert.deepEqual(api.stations(), [value]);
  assert.deepEqual((await reload(api)).stations(), [value]);
});
