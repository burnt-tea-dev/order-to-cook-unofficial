// SPDX-License-Identifier: GPL-3.0-only
// Stable pack UUID + an atomic manifest per station/restaurant. Never erase bad data.
import { world } from '@minecraft/server';

const REST = 'ordertocook:r:';
const STATION = 'ordertocook:s:';
const PROFILE = 'ordertocook:p:';
// Bedrock strings allow 32,767 UTF-8 bytes. Leave room below that ceiling and
// split on Unicode code points, never between an emoji's surrogate pair.
const CHUNK_BYTES = 30000;
const restaurantsById = new Map();
const stationsById = new Map();
const profilesById = new Map();
const unreadableKeys = new Set();
const savedSnapshots = new Map();
const savedManifests = new Map();
let ready = false;

export function locationId(dimensionId, location) {
  return `${dimensionId.replace('minecraft:', '')}_${Math.floor(location.x)}_${Math.floor(location.y)}_${Math.floor(location.z)}`;
}

export function initStore() {
  if (ready) return;
  const keys = new Set(world.getDynamicPropertyIds());
  for (const key of keys) {
    if (!key.startsWith(REST) && !key.startsWith(STATION) && !key.startsWith(PROFILE)) continue;
    // Incomplete writes can leave unreferenced chunks. Only root manifests are
    // authoritative, so fragments must never be mistaken for saved records.
    if (key.includes(':part:')) continue;
    try {
      const raw = world.getDynamicProperty(key);
      if (typeof raw !== 'string') throw new Error('Expected JSON string');
      let json = raw;
      let value = JSON.parse(raw);
      let manifest;
      if (value?.__otcParts === true) {
        manifest = value;
        if (typeof manifest.id !== 'string' || !['a', 'b'].includes(manifest.buffer) ||
            !Number.isSafeInteger(manifest.parts) || manifest.parts < 1 || manifest.parts > keys.size) {
          throw new Error('Invalid saved record manifest');
        }
        const chunks = [];
        for (let index = 0; index < manifest.parts; index++) {
          const partKey = chunkKey(key, manifest.buffer, index);
          if (!keys.has(partKey)) throw new Error('Missing saved record chunk');
          const chunk = world.getDynamicProperty(partKey);
          if (typeof chunk !== 'string') throw new Error('Invalid saved record chunk');
          chunks.push(chunk);
        }
        json = chunks.join('');
        value = JSON.parse(json);
        if (value?.id !== manifest.id) throw new Error('Saved record manifest ID does not match');
      }
      const prefix = key.startsWith(REST) ? REST : key.startsWith(STATION) ? STATION : PROFILE;
      validateRecord(prefix, key, value);
      (prefix === REST ? restaurantsById : prefix === STATION ? stationsById : profilesById).set(value.id, value);
      savedSnapshots.set(key, json);
      if (manifest) savedManifests.set(key, manifest);
    } catch (error) {
      unreadableKeys.add(key);
      console.warn(`[OrderToCook] Saved record ${key} could not be read; left untouched. ${error}`);
    }
  }
  ready = true;
}

function chunkKey(root, buffer, index) { return `${root}:part:${buffer}:${index}`; }

function validateRecord(prefix, key, value) {
  if (!value || typeof value.id !== 'string' || !value.id || (prefix !== PROFILE && !value.location) ||
      key !== prefix + value.id || value.id.includes(':part:')) throw new Error('Invalid saved record');
}

function splitUtf8(json) {
  const chunks = [];
  let chunk = '', bytes = 0;
  for (const char of json) {
    const code = char.codePointAt(0);
    const size = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + size > CHUNK_BYTES) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += char;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function restoreSnapshot(key, records, id) {
  const snapshot = savedSnapshots.get(key);
  if (snapshot === undefined) records.delete(id);
  else records.set(id, JSON.parse(snapshot));
}

function clearBuffer(key, manifest) {
  if (!manifest) return;
  for (let index = 0; index < manifest.parts; index++) {
    try { world.setDynamicProperty(chunkKey(key, manifest.buffer, index), undefined); }
    catch (error) { console.warn(`[OrderToCook] Unreferenced saved chunk could not be removed; retained safely. ${error}`); }
  }
}

function assertWritable(key) {
  if (!ready) throw new Error('OrderToCook world is not ready');
  if (unreadableKeys.has(key)) throw new Error('This saved record needs recovery before it can be modified');
}

function persist(prefix, records, value, prepare = undefined) {
  const id = value?.id;
  const key = prefix + id;
  let json, manifest, manifestJson;
  const previous = savedManifests.get(key);
  try {
    assertWritable(key);
    validateRecord(prefix, key, value);
    if (prepare) prepare();
    json = JSON.stringify(value);
    const chunks = splitUtf8(json);
    manifest = { __otcParts: true, id, buffer: previous?.buffer === 'a' ? 'b' : 'a', parts: chunks.length };
    manifestJson = JSON.stringify(manifest);
    for (let index = 0; index < chunks.length; index++) {
      world.setDynamicProperty(chunkKey(key, manifest.buffer, index), chunks[index]);
    }
    // This one-property write commits the whole record. Before it, all readers
    // still use the old buffer; after it, every new chunk is already present.
    world.setDynamicProperty(key, manifestJson);
  } catch (error) {
    // A platform adapter can throw after applying a write. If the final root
    // really committed, keep cache and disk consistent instead of replaying it.
    let committed = false;
    if (manifestJson !== undefined) {
      try { committed = world.getDynamicProperty(key) === manifestJson; } catch { /* unavailable world */ }
    }
    if (!committed) {
      restoreSnapshot(key, records, id);
      throw error;
    }
  }
  records.set(id, value);
  savedSnapshots.set(key, json);
  savedManifests.set(key, manifest);
  // Cleanup is deliberately after the commit and cannot invalidate the save.
  clearBuffer(key, previous);
  return value;
}

function remove(prefix, records, id) {
  const key = prefix + id;
  assertWritable(key);
  const previous = savedManifests.get(key);
  try { world.setDynamicProperty(key, undefined); }
  catch (error) {
    let removed = false;
    try { removed = world.getDynamicProperty(key) === undefined; } catch { /* unavailable world */ }
    if (!removed) {
      restoreSnapshot(key, records, id);
      throw error;
    }
  }
  records.delete(id);
  savedSnapshots.delete(key);
  savedManifests.delete(key);
  clearBuffer(key, previous);
}

export function getProfile(id) {
  if (unreadableKeys.has(PROFILE + id)) throw new Error('This personal progress record needs recovery; saved data was preserved');
  return profilesById.get(id);
}
export function saveProfile(value) { return persist(PROFILE, profilesById, value); }

export function getRestaurant(id) { return restaurantsById.get(id); }
export function restaurants() { return [...restaurantsById.values()]; }
export function saveRestaurant(value) {
  return persist(REST, restaurantsById, value, () => {
    const live = value.orders.filter(order => ['offered', 'accepted', 'packed'].includes(order.status));
    const history = value.orders.filter(order => !['offered', 'accepted', 'packed'].includes(order.status)).slice(-12);
    value.orders = [...history, ...live];
  });
}
export function deleteRestaurant(id) { remove(REST, restaurantsById, id); }

export function stations() { return [...stationsById.values()]; }
export function findStation(block) { return stationsById.get(locationId(block.dimension.id, block.location)); }
export function getStation(block, kind) {
  const id = locationId(block.dimension.id, block.location);
  let value = stationsById.get(id);
  if (!value) {
    value = { id, dimensionId: block.dimension.id, location: { ...block.location }, typeId: block.typeId, kind: kind || block.typeId.split(':')[1], ownerId: '', menu: [], supplies: 0 };
    saveStation(value);
  }
  return value;
}
export function saveStation(value) { return persist(STATION, stationsById, value); }
export function deleteStation(value) {
  const id = typeof value === 'string' ? value : value.id;
  remove(STATION, stationsById, id);
}

export function loadedBlock(record) {
  try { return world.getDimension(record.dimensionId).getBlock(record.location); }
  catch { return undefined; }
}
export function distanceSquared(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2; }
export function nearbyStations(dimensionId, location, radius, typeId) {
  return stations().filter(s => s.dimensionId === dimensionId && (!typeId || s.typeId === typeId) && distanceSquared(s.location, location) <= radius * radius && loadedBlock(s)?.typeId === s.typeId);
}
export function nearestRestaurant(block, radius = 24) {
  return restaurants().filter(r => r.dimensionId === block.dimension.id && distanceSquared(r.location, block.location) <= radius * radius && loadedBlock(r)?.typeId === 'ordertocook:order_machine')
    .sort((a, b) => distanceSquared(a.location, block.location) - distanceSquared(b.location, block.location))[0];
}
export function setBlockState(block, name, value) {
  try {
    let permutation = block.permutation;
    const states = permutation.getAllStates();
    // Bedrock permits at most 16 values for one custom block state. Asset
    // conversion splits the upstream 18-plate / 40-stage values into two states.
    if (name === 'ordertocook:plates' && 'ordertocook:plates_high' in states) {
      const low = Number(value) % 16, high = Number(value) >= 16;
      if (states[name] === low && states['ordertocook:plates_high'] === high) return;
      permutation = permutation.withState(name, low).withState('ordertocook:plates_high', high);
    } else if (name === 'ordertocook:stage' && 'ordertocook:stage_high' in states) {
      const low = Number(value) % 16, high = Math.floor(Number(value) / 16);
      if (states[name] === low && states['ordertocook:stage_high'] === high) return;
      permutation = permutation.withState(name, low).withState('ordertocook:stage_high', high);
    } else {
      if (states[name] === value) return;
      permutation = permutation.withState(name, value);
    }
    block.setPermutation(permutation);
  }
  catch (error) { console.warn(`[OrderToCook] Cannot set ${name}: ${error}`); }
}
