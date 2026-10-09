// SPDX-License-Identifier: GPL-3.0-only
// Copied next to production scripts only in the disposable native QA pack.
// Real BDS blocks/entities/containers; no connected Player or client rendering.
import { ItemStack, BlockTypes } from '@minecraft/server';
import { createEntityService, hasFullStandingSupport } from './entities.js';
import { getRestaurant, saveRestaurant, deleteRestaurant, getStation, findStation, saveStation, deleteStation } from './store.js';

const CUSTOMER = 'ordertocook:customer';
const SEAT = 'ordertocook:seat';
const CHAIR = 'ordertocook:chair';
const RESTAURANT = 'ordertocook:restaurant_id';
const ORDER = 'ordertocook:order_id';
const ANCHOR = 'ordertocook:chair_anchor';
const blockKey = point => `${point.x},${point.y},${point.z}`;

/**
 * The clock wrapper advances completion state without sleeping for every clip.
 * All entities, seat membership, properties, block rays and cargo are native.
 * The scoped dimension views prevent that test clock reaching the caller's
 * existing restaurant/customer, and a canonical temporary restaurant prevents
 * the normal production scanner treating these actors as orphaned orders.
 */
export async function runCustomerChecks({ world, system, hooks, restaurant, player, dimension, test, wait }) {
  const origin = { x: -10, y: 4, z: -10 };
  const fixtureId = `${restaurant.id}_native_customer_checks`;
  const fixture = {
    ...restaurant,
    id: fixtureId,
    name: 'Native customer lifecycle QA',
    location: { ...origin },
    dimensionId: dimension.id,
    active: false,
    removing: false,
    orders: [],
    menu: [],
    pendingDishes: [],
    stats: { completed: 0, delivery: 0, longDistance: 0, earnings: 0, failed: 0 },
  };
  let clock = Date.now();
  let syntheticTick = system.currentTick;
  let fixtureStations = [];
  let sequence = 0;
  let interactionCalls = 0;
  const orderIds = new Set();
  const helperIds = new Set();
  const touchedBlocks = new Map();
  const views = new Map();
  const standIn = { ...player, id: `${player.id}:customer-checks`, location: { x: -9.5, y: 4, z: -8.5 }, dimension };
  const signal = { subscribe() {} };

  function ours(entity) {
    try {
      if (entity.typeId === CUSTOMER) return entity.getDynamicProperty(RESTAURANT) === fixtureId;
      if (entity.typeId === SEAT) {
        const value = entity.getDynamicProperty(ANCHOR);
        if (typeof value !== 'string') return false;
        const anchor = JSON.parse(value);
        return anchor.dimensionId === dimension.id && touchedBlocks.has(blockKey(anchor.location));
      }
      return helperIds.has(entity.id);
    } catch { return false; }
  }

  function dimensionView(id) {
    if (views.has(id)) return views.get(id);
    const real = world.getDimension(id);
    const view = {
      id: real.id,
      heightRange: real.heightRange,
      getEntities: options => real.getEntities(options).filter(ours),
      getBlock: location => real.getBlock(location),
      getBlockFromRay: (location, direction, options) => real.getBlockFromRay(location, direction, options),
      spawnEntity: (type, location) => real.spawnEntity(type, location),
      spawnItem: (item, location) => real.spawnItem(item, location),
      playSound: (id, location, options) => real.playSound(id, location, options),
      spawnParticle: (id, location) => real.spawnParticle(id, location),
    };
    views.set(id, view);
    return view;
  }

  const worldView = {
    getDimension: dimensionView,
    getEntity: id => world.getEntity(id),
    getAllPlayers: () => [standIn],
    beforeEvents: { playerInteractWithEntity: signal },
    afterEvents: { entityHitEntity: signal, playerButtonInput: signal, playerLeave: signal },
  };
  const systemView = {
    get currentTick() { return syntheticTick; },
    run(callback) { callback(); return 0; },
    runInterval() { return 0; },
    runTimeout: (callback, ticks) => system.runTimeout(callback, ticks),
  };
  const service = createEntityService({
    world: worldView,
    system: systemView,
    getRestaurant,
    saveRestaurant,
    restaurants: () => getRestaurant(fixtureId) ? [getRestaurant(fixtureId)] : [],
    stations: () => fixtureStations,
    now: () => clock,
    random: () => 0.80,
    notify() {},
    onCustomerInteract() { interactionCalls++; },
  });

  function tickAt(value) {
    clock = value;
    syntheticTick += 20;
    service.tick();
  }

  function order(label, extras = {}) {
    const value = {
      id: `${fixtureId}_${++sequence}_${label}`,
      restaurantId: fixtureId,
      type: 'dine_in',
      status: 'accepted',
      walkIn: false,
      expiresAt: Date.now() + 120000,
      createdAt: Date.now(),
      items: [{ typeId: 'minecraft:bread', amount: 1, nutrition: 5, label: '麵包' }],
      reward: 1,
      tier: 0,
      ...extras,
    };
    fixture.orders.push(value);
    orderIds.add(value.id);
    saveRestaurant(fixture);
    return value;
  }

  function endOrder(value) {
    value.status = 'cancelled';
    saveRestaurant(fixture);
    service.cleanupOrder(value.id);
  }

  function rememberBlock(location) {
    const block = dimension.getBlock(location);
    const key = blockKey(location);
    if (!touchedBlocks.has(key)) {
      const oldStation = findStation(block);
      touchedBlocks.set(key, { location: { ...location }, permutation: block.permutation, station: oldStation ? JSON.parse(JSON.stringify(oldStation)) : undefined });
    }
    return block;
  }

  function chairAt(location) {
    const block = rememberBlock(location);
    block.setType(CHAIR);
    const station = getStation(block);
    station.typeId = CHAIR;
    saveStation(station);
    return { block, station };
  }

  function registeredBlock(candidates) {
    for (const id of candidates) {
      try { const type = BlockTypes.get(id); if (type) return type.id; } catch { /* Try the next registered spelling. */ }
    }
    return undefined;
  }

  function supportDetail(feet) {
    const hit = dimension.getBlockFromRay({ x: feet.x + .5, y: feet.y + 1.5, z: feet.z + .5 }, { x: 0, y: -1, z: 0 },
      { maxDistance: 3, includeLiquidBlocks: true, includePassableBlocks: false });
    return JSON.stringify({ floor: dimension.getBlock({ ...feet, y: feet.y - 1 }).typeId,
      hit: hit ? { block: hit.block.typeId, location: hit.block.location, face: hit.face, faceLocation: hit.faceLocation } : null });
  }

  async function complete(value, actor, action) {
    const duration = ({ 3: 2000, 4: 3000, 5: 6000, 6: 5500 })[action];
    value.status = 'completed';
    value.completion = { startedAt: clock, finishAt: clock + duration, action };
    if (value.type === 'dine_in') value.meal = value.completion;
    saveRestaurant(fixture);
    service.finishCustomer(value.id, value.completion);
    // Entity properties written through setProperty become readable on the
    // following engine tick. Do not mistake that native boundary for failure.
    await wait(2);
    test(`native customer action ${action} property and duration`, actor?.isValid && actor.getProperty('ordertocook:action') === action &&
      actor.getDynamicProperty('ordertocook:depart_at') === clock + duration, String(actor?.getProperty('ordertocook:action')));
    return value.completion;
  }

  try {
    saveRestaurant(fixture);
    service.init();
    syntheticTick += 40;
    test('native customer fixture is canonical and isolated', getRestaurant(fixtureId) === fixture && fixture.id !== restaurant.id && hooks.ready);

    const rays = [];
    for (const y of [4.05, 4.5, 5.05]) for (const maxDistance of [.1, .5, 1, 2]) {
      try {
        const hit = dimension.getBlockFromRay({ x: origin.x + .5, y, z: origin.z + .5 }, { x: 0, y: -1, z: 0 },
          { maxDistance, includeLiquidBlocks: true, includePassableBlocks: false });
        rays.push({ y, maxDistance, hit: hit ? { block: hit.block.typeId, location: hit.block.location, face: hit.face, faceLocation: hit.faceLocation } : null });
      } catch (error) { rays.push({ y, maxDistance, error: String(error) }); }
    }
    const support = dimension.getBlockFromRay(
      { x: origin.x + .5, y: origin.y + 1.5, z: origin.z + .5 },
      { x: 0, y: -1, z: 0 },
      { maxDistance: 3, includeLiquidBlocks: true, includePassableBlocks: false }
    );
    test('native integer-length ray resolves the exact full floor top', support?.block.typeId === 'minecraft:stone' && support.block.location.y === 3 &&
      support.face === 'Up' && (Math.abs(support.faceLocation.y) <= .01 || Math.abs(support.faceLocation.y - 1) <= .01),
      JSON.stringify({ production: support ? { block: support.block.typeId, location: support.block.location, face: support.face, faceLocation: support.faceLocation } : null, diagnostics: rays }));
    test('native complete footprint validates standing support', hasFullStandingSupport(dimension, origin));

    const negativeFeet = { x: -13, y: 4, z: -13 };
    const negativeFloor = rememberBlock({ x: -13, y: 3, z: -13 });
    const negativeBelow = rememberBlock({ x: -13, y: 2, z: -13 });
    const floorBefore = negativeFloor.permutation, belowBefore = negativeBelow.permutation;
    const slabId = registeredBlock(['minecraft:oak_slab', 'minecraft:stone_block_slab', 'minecraft:stone_slab']);
    test('native thin-support slab fixture identifier is registered', !!slabId, String(slabId));
    if (slabId) {
      negativeFloor.setType(slabId);
      let lower = negativeFloor.permutation, upper;
      const states = lower.getAllStates();
      if (typeof states['minecraft:vertical_half'] === 'string') {
        upper = lower.withState('minecraft:vertical_half', 'top');
        lower = lower.withState('minecraft:vertical_half', 'bottom');
      } else if (typeof states['top_slot_bit'] === 'boolean') {
        upper = lower.withState('top_slot_bit', true);
        lower = lower.withState('top_slot_bit', false);
      }
      negativeFloor.setPermutation(lower);
      test('native lower slab is rejected as full standing support', negativeFloor.typeId === slabId && !hasFullStandingSupport(dimension, negativeFeet), supportDetail(negativeFeet));
      test('native upper slab fixture exposes its placement state', !!upper, JSON.stringify(states));
      if (upper) {
        negativeFloor.setPermutation(upper);
        test('native upper slab is rejected despite its full-height top face', negativeFloor.typeId === slabId && !hasFullStandingSupport(dimension, negativeFeet), supportDetail(negativeFeet));
      }
    }
    const plantId = registeredBlock(['minecraft:short_grass', 'minecraft:tallgrass', 'minecraft:dandelion']);
    test('native plant-support fixture identifier is registered', !!plantId, String(plantId));
    if (plantId) {
      negativeBelow.setType('minecraft:dirt');
      negativeFloor.setType(plantId);
      await wait(1);
      test('native plant over solid dirt is rejected as standing support', negativeFloor.typeId === plantId && !hasFullStandingSupport(dimension, negativeFeet), supportDetail(negativeFeet));
    }
    negativeFloor.setType('minecraft:water');
    test('native water is rejected as standing support', negativeFloor.isLiquid && !hasFullStandingSupport(dimension, negativeFeet), supportDetail(negativeFeet));
    negativeFloor.setPermutation(floorBefore);
    negativeBelow.setPermutation(belowBefore);

    const standingOrder = order('standing');
    const standing = service.spawnCustomer(fixture, standingOrder);
    await wait(2);
    test('native ordinary dine-in spawns standing when its chair list is empty', standing?.isValid &&
      !standing.getComponent('minecraft:riding')?.entityRidingOn && standing.getProperty('ordertocook:action') === 2 &&
      Math.abs(standing.location.x - origin.x) <= 5.5 && Math.abs(standing.location.z - origin.z) <= 5.5);
    if (standing?.isValid) {
      const completion = await complete(standingOrder, standing, 4);
      const previousLocation = standIn.location;
      standIn.location = { ...standing.location };
      service.onEntityInteract(standIn, standing);
      standIn.location = previousLocation;
      test('native departure blocks another customer submission', interactionCalls === 0);
      tickAt(completion.finishAt);
      test('native standing-take deadline removes the actor', !standing.isValid);
    } else endOrder(standingOrder);

    const walkInOrder = order('walkin_without_chair', { status: 'offered', walkIn: true });
    test('native walk-in refuses a standing fallback without a chair', service.spawnCustomer(fixture, walkInOrder) === undefined);
    endOrder(walkInOrder);

    // Both coordinates lie on the existing stone floor and outside the main
    // x=0..12,z=0..5 appliances. (24,24) is outside the 24-block circle.
    const outsideChair = chairAt({ x: 14, y: 4, z: 14 });
    fixtureStations = [outsideChair.station];
    const cornerOrder = order('circle_corner', { status: 'offered', walkIn: true });
    test('native walk-in excludes a chair in the old square corner', service.spawnCustomer(fixture, cornerOrder) === undefined);
    const boundaryChair = chairAt({ x: 14, y: 4, z: -10 });
    fixtureStations.push(boundaryChair.station);
    const seated = service.spawnCustomer(fixture, cornerOrder);
    await wait(2);
    const realSeat = seated?.isValid ? service.getCustomerSeat(seated) : undefined;
    test('native circular boundary chair is eligible and mounted', realSeat?.typeId === CHAIR && realSeat.location.x === 14 && realSeat.location.z === -10);
    test('native customer exposes separate original idle variant', seated?.isValid && seated.getProperty('ordertocook:animation_variant') === 3);
    if (seated?.isValid) {
      const completion = await complete(cornerOrder, seated, 3);
      const firstDeadline = seated.getDynamicProperty('ordertocook:depart_at');
      clock += 500;
      service.finishCustomer(cornerOrder.id);
      test('native repeated completion cannot extend the departure', seated.getDynamicProperty('ordertocook:depart_at') === firstDeadline);
      tickAt(completion.finishAt);
      test('native seated-take cleanup removes actor and its empty helper', !seated.isValid &&
        !dimension.getEntities({ type: SEAT, location: { x: 14.5, y: 4.5625, z: -9.5 }, maxDistance: 1 }).length);
    } else endOrder(cornerOrder);

    for (const action of [5, 6]) {
      const value = order(`eating_${action}`);
      const actor = service.spawnCustomer(fixture, value);
      await wait(1);
      test(`native eating ${action} starts with a real seat`, actor?.isValid && !!service.getCustomerSeat(actor));
      if (!actor?.isValid) { endOrder(value); continue; }
      const completion = await complete(value, actor, action);
      if (action === 6) {
        clock += 2000;
        value.meal = { startedAt: clock, finishAt: clock + 500, action: 7 };
        saveRestaurant(fixture);
        service.interruptCustomerMeal(value.id, value.meal);
        await wait(2);
        test('native early-plate interruption selects original action 7', actor.getProperty('ordertocook:action') === 7 && actor.getDynamicProperty('ordertocook:depart_at') === clock + 500);
        tickAt(value.meal.finishAt);
        test('native interrupted customer is removed after half a second', !actor.isValid);
      } else {
        tickAt(completion.startedAt + 5000);
        test('native boom branch is still present at the dirty-plate time', actor.isValid && actor.getProperty('ordertocook:action') === 5);
        tickAt(completion.finishAt);
        test('native boom branch ends without destroying the chair', !actor.isValid && boundaryChair.block.typeId === CHAIR);
      }
    }

    fixtureStations = [];
    const corruptOrder = order('corrupt_seat', { type: 'delivery', destination: { ...origin, dimensionId: dimension.id } });
    const corruptActor = service.spawnCustomer(fixture, corruptOrder);
    const bike = dimension.spawnEntity('ordertocook:motorcycle', { x: -6.5, y: 4, z: -12.5 });
    helperIds.add(bike.id);
    const cargo = bike.getComponent('minecraft:inventory')?.container;
    cargo?.setItem(0, new ItemStack('minecraft:diamond', 3));
    if (corruptActor?.isValid) corruptActor.setDynamicProperty('ordertocook:seat_id', bike.id);
    endOrder(corruptOrder);
    test('native corrupt customer seat reference preserves motorcycle cargo', !!corruptActor && !corruptActor.isValid && bike.isValid &&
      cargo?.getItem(0)?.typeId === 'minecraft:diamond' && cargo.getItem(0).amount === 3);
  } catch (error) {
    test('native customer probe completes without an engine exception', false, String(error?.stack || error));
  } finally {
    // Restrict every removal to fixture metadata/IDs and restore exact prior
    // blocks/stations. The caller's test parcel, bike and restaurant stay put.
    try {
      for (const id of orderIds) service.cleanupOrder(id);
      for (const entity of dimension.getEntities()) if (ours(entity)) entity.remove();
      for (const id of helperIds) {
        const helper = world.getEntity(id);
        if (helper?.isValid) helper.remove();
      }
      for (const value of touchedBlocks.values()) dimension.getBlock(value.location)?.setPermutation(value.permutation);
      await wait(2);
      for (const value of touchedBlocks.values()) {
        if (value.station) saveStation(value.station);
        else {
          const current = findStation(dimension.getBlock(value.location));
          if (current) deleteStation(current);
        }
      }
      deleteRestaurant(fixtureId);
      test('native customer fixture cleanup preserves the main restaurant', !getRestaurant(fixtureId) && getRestaurant(restaurant.id) === restaurant &&
        !dimension.getEntities({ type: CUSTOMER }).some(entity => entity.getDynamicProperty(RESTAURANT) === fixtureId));
    } catch (error) { test('native customer fixture cleanup', false, String(error?.stack || error)); }
  }
}
