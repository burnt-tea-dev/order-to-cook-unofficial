// SPDX-License-Identifier: GPL-3.0-only
// QA-only workload. Synthetic restaurant origins are NOT connected players.
import { world, system, BlockPermutation } from '@minecraft/server';
import { getQaHooks } from './main.js';
import { getStation, saveStation, nearbyStations, saveRestaurant, distanceSquared } from './store.js';
import { createRestaurant, refreshOrders, getMenuNutrition, normalizeMenu } from './core.js';
import { baselineNearbyStations } from './performance-baseline.js';
import { settings } from './performance-settings.js';

const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
const kinds = ['board', 'chair', 'refrigerator', 'shelf', 'plate_shelf'];
const output = (event, value) => console.warn(`OTC_PERF_${event} ${JSON.stringify(value)}`);
const dimensions = { shape: 'cylinder', halfHeight: 8 };
const phases = [];
let fixtureCount = 0;
let running = false;

function quantile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

// A compact grid increases both global registry size and local station density.
// All stations have y=70 so old spherical and new cylindrical menu ranges agree.
async function extendFixture(dimension, count) {
  for (let i = fixtureCount; i < count; i++) {
    const location = { x: i % 80, y: 70, z: Math.floor(i / 80) };
    const block = dimension.getBlock(location);
    const kind = kinds[i % kinds.length];
    block.setPermutation(BlockPermutation.resolve(`ordertocook:${kind}`,
      kind === 'refrigerator' ? { 'ordertocook:half': 'lower' } : {}));
    const station = getStation(block);
    station.ownerId = 'otc-performance-owner';
    if (kind === 'board') station.menu = [{ typeId: 'minecraft:bread', nutrition: 5, label: 'Bread' }];
    saveStation(station);
    if (i % 80 === 79) await wait(1);
  }
  fixtureCount = count;
  await wait(20);
}

function origins(count, stationCount) {
  const depth = Math.ceil(stationCount / 80);
  return Array.from({ length: count }, (_, i) => ({
    x: count === 1 ? 40 : 5 + (i % 8) * 10,
    y: 70,
    z: count <= 8 ? Math.floor(depth / 2) : Math.floor((Math.floor(i / 8) + 0.5) * depth / 4)
  }));
}

function query(queryFn, dimension, point, kind) {
  const radius = ['shelf', 'plate_shelf'].includes(kind) ? 5 : 24;
  return queryFn(dimension.id, point, radius, `ordertocook:${kind}`,
    ['board', 'chair'].includes(kind) ? dimensions : {});
}

function selectMenu(queryFn, dimension, restaurant) {
  const candidates = query(queryFn, dimension, restaurant.location, 'board')
    .filter(s => !s.ownerId || s.ownerId === restaurant.ownerId || restaurant.staff?.includes(s.ownerId));
  candidates.sort((a, b) => getMenuNutrition(b.menu) - getMenuNutrition(a.menu) ||
    distanceSquared(a.location, restaurant.location) - distanceSquared(b.location, restaurant.location));
  restaurant.menu = normalizeMenu(candidates[0]?.menu || []);
  restaurant.boardId = candidates[0]?.id || '';
}

function equalCandidateSets(dimension, points) {
  let candidates = 0;
  for (const point of points) for (const kind of kinds) {
    const a = query(baselineNearbyStations, dimension, point, kind).map(s => s.id).sort();
    const b = query(nearbyStations, dimension, point, kind).map(s => s.id).sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Candidate mismatch: ${kind} at ${JSON.stringify(point)}`);
    candidates += a.length;
  }
  return candidates;
}

async function phase(dimension, spec) {
  const queryFn = spec.arm === 'scan' ? baselineNearbyStations : nearbyStations;
  const points = origins(spec.origins, spec.stations);
  let seed = 12345;
  const clock = Date.now();
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  // No order-machine blocks are placed: production periodic tasks cannot refresh
  // these QA restaurants. Actual core generation and canonical saving are used.
  const restaurants = points.map((location, i) => createRestaurant({
    id: `otc-perf-${i}`, ownerId: 'otc-performance-owner', ownerName: 'QA',
    dimensionId: dimension.id, location, name: 'Performance fixture',
    menu: [{ typeId: 'minecraft:bread', nutrition: 5, label: 'Bread' }]
  }, clock));
  for (const restaurant of restaurants) saveRestaurant(restaurant);
  const work = iteration => {
    let count = 0;
    if (spec.workload === 'lookup') {
      for (const point of points) for (const kind of kinds) count += query(queryFn, dimension, point, kind).length;
    } else {
      for (const restaurant of restaurants) {
        selectMenu(queryFn, dimension, restaurant);
        const result = refreshOrders(restaurant, clock + iteration * 1000, random);
        count += result.orders.length;
        saveRestaurant(restaurant);
      }
    }
    return count;
  };
  for (let i = 0; i < settings.warmupTicks; i++) { work(i); await wait(1); }
  // Diagnostics commands must be issued by the runner's BDS console; calling
  // them through Dimension.runCommand can return without producing a capture.
  output('CAPTURE', spec);
  await wait(4);
  const start = Date.now(), startTick = system.currentTick;
  const absoluteStartTick = world.getAbsoluteTime();
  output('BEGIN', { ...spec, startTick, absoluteStartTick });
  let previous = start, checksum = 0;
  const intervals = [], workTimes = [];
  for (let i = 0; i < settings.measureTicks; i++) {
    const workStart = Date.now();
    checksum += work(i + settings.warmupTicks);
    workTimes.push(Date.now() - workStart);
    await wait(1);
    const now = Date.now();
    intervals.push(now - previous);
    previous = now;
  }
  const elapsedMs = Date.now() - start, elapsedTicks = system.currentTick - startTick;
  const result = {
    ...spec, startTick, endTick: system.currentTick, absoluteStartTick, absoluteEndTick: world.getAbsoluteTime(),
    elapsedMs, elapsedTicks, effectiveTps: elapsedTicks * 1000 / elapsedMs,
    meanTickIntervalMs: elapsedMs / elapsedTicks, p95TickIntervalMs: quantile(intervals, 0.95),
    workloadMs: workTimes.reduce((a, b) => a + b, 0),
    meanWorkloadMsPerBatch: workTimes.reduce((a, b) => a + b, 0) / workTimes.length,
    p95WorkloadMsPerBatch: quantile(workTimes, 0.95), batches: workTimes.length, checksum,
    queriesOrRefreshes: settings.measureTicks * spec.origins * (spec.workload === 'lookup' ? kinds.length : 1),
    timerResolutionMs: 1
  };
  output('END', result);
  phases.push(result);
  await wait(10);
}

async function run() {
  if (!getQaHooks().ready) throw new Error('Production addon did not initialize');
  const dimension = world.getDimension('overworld');
  dimension.runCommand('tickingarea add 0 0 0 95 100 63 otc_perf');
  dimension.runCommand('gamerule doMobSpawning false');
  dimension.runCommand('gamerule randomTickSpeed 0');
  await wait(40);
  const equality = [];
  for (const stations of settings.stationCounts) {
    await extendFixture(dimension, stations);
    for (const count of settings.originCounts) {
      equality.push({ stations, origins: count, candidatesPerLookupBatch: equalCandidateSets(dimension, origins(count, stations)) });
      for (const workload of ['lookup', 'refresh-save']) {
        // ABBA balances a monotonic thermal, GC, or cache drift between arms.
        for (const [index, arm] of ['scan', 'poi', 'poi', 'scan'].entries()) {
          await phase(dimension, { id: phases.length, stations, origins: count, workload, arm, repeat: Math.floor(index / 2) + 1 });
        }
      }
    }
  }
  output('REPORT', { passed: true, candidateEquality: equality, phases,
    realPlayers: 0, clientValidation: false,
    scope: 'Same BDS process, dense native blocks and canonical records; exact old query helper vs current POI helper. Synthetic query origins and forced refreshes once per tick, not full old/new pack or real multiplayer comparison.',
    timingNote: 'Date.now measures JS workload wall time at millisecond resolution. Effective TPS includes paced waits; mean tick interval is not active engine MSPT. Use native diagnostics for active tick categories.' });
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:performance' || running) return;
  running = true;
  run().catch(error => output('REPORT', { passed: false, error: String(error?.stack || error), phases }));
});
