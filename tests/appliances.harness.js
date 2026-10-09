// SPDX-License-Identifier: GPL-3.0-only
// Engine adapter doubles: the actual shipped service source is imported below.
// These checks do not simulate Bedrock rendering, native physics or disk saves.
import { readFile } from 'node:fs/promises';

export class FakeItem {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
    this.maxAmount = ['ordertocook:food_plate', 'ordertocook:takeout_bag', 'ordertocook:motorcycle', 'minecraft:lava_bucket'].includes(typeId) ? 1 : 64;
    this.nameTag = undefined;
    this.keepOnDeath = false;
    this.lockMode = 'none';
    this.properties = {};
    this.lore = [];
    this.damage = 0;
  }
  clone() { const copy = new FakeItem(this.typeId, this.amount); Object.assign(copy, structuredClone(this)); return copy; }
  isStackableWith(other) {
    return this.maxAmount > 1 && other.maxAmount > 1 && this.typeId === other.typeId && this.nameTag === other.nameTag &&
      JSON.stringify(this.lore) === JSON.stringify(other.lore) && JSON.stringify(this.properties) === JSON.stringify(other.properties) && this.damage === other.damage;
  }
  getDynamicPropertyIds() { return Object.keys(this.properties); }
  getDynamicProperty(id) { return this.properties[id]; }
  setDynamicProperty(id, value) { if (value === undefined) delete this.properties[id]; else this.properties[id] = value; }
  getLore() { return [...this.lore]; }
  setLore(lore) { this.lore = [...lore]; }
  getCanDestroy() { return []; }
  getCanPlaceOn() { return []; }
  getComponent(id) {
    if (id === 'minecraft:durability') return { damage: this.damage };
    if (id === 'minecraft:food' && !this.typeId.startsWith('minecraft:')) return undefined;
    return undefined;
  }
}

export class FakeContainer {
  constructor(size) { this.size = size; this.slots = new Array(size); this.isValid = true; this.failNextSlot = undefined; }
  get emptySlotsCount() { return this.slots.filter(Boolean).length ? this.size - this.slots.filter(Boolean).length : this.size; }
  getItem(i) { if (i < 0 || i >= this.size) throw Error('slot bounds'); return this.slots[i]?.clone(); }
  setItem(i, stack) {
    if (i < 0 || i >= this.size) throw Error('slot bounds');
    if (this.failNextSlot === i) { this.failNextSlot = undefined; throw Error('simulated container write failure'); }
    if (stack && (stack.amount < 1 || stack.amount > stack.maxAmount)) throw Error('stack bounds');
    this.slots[i] = stack?.clone();
  }
  addItem(stack) {
    let remaining = stack.amount;
    for (let i = 0; i < this.size && remaining; i++) {
      const old = this.slots[i];
      if (old?.isStackableWith(stack)) { const amount = Math.min(remaining, old.maxAmount - old.amount); old.amount += amount; remaining -= amount; }
    }
    for (let i = 0; i < this.size && remaining; i++) if (!this.slots[i]) {
      const next = stack.clone(); next.amount = Math.min(remaining, stack.maxAmount); this.slots[i] = next; remaining -= next.amount;
    }
    if (!remaining) return undefined;
    const rest = stack.clone(); rest.amount = remaining; return rest;
  }
}

export class FakePermutation {
  constructor(id, states = {}) { this.type = { id }; this.states = { ...states }; }
  getState(key) { return this.states[key]; }
  getAllStates() { return { ...this.states }; }
  withState(key, value) { return new FakePermutation(this.type.id, { ...this.states, [key]: value }); }
  static resolve(id, states) { return new FakePermutation(id, states); }
}

export class FakeBlock {
  constructor(dimension, location, typeId = 'minecraft:air', states = {}) {
    this.dimension = dimension; this.location = { ...location }; this.permutation = new FakePermutation(typeId, states); this.isValid = true;
  }
  get typeId() { return this.permutation.type.id; }
  get isAir() { return this.typeId === 'minecraft:air'; }
  get isLiquid() { return ['minecraft:water', 'minecraft:lava'].includes(this.typeId); }
  setType(id) { this.permutation = new FakePermutation(id); }
  setPermutation(permutation) { this.permutation = permutation; }
}

let entitySequence = 0;
export class FakeEntity {
  constructor(dimension, typeId, location) {
    this.id = `entity${++entitySequence}`; this.dimension = dimension; this.typeId = typeId; this.location = { ...location };
    this.isValid = true; this.dynamic = {}; this.properties = {}; this.tags = new Set(); this.riders = [];
    this.container = typeId === 'ordertocook:storage' ? new FakeContainer(81) : typeId === 'ordertocook:motorcycle' ? new FakeContainer(54) : undefined;
    this.rotation = { x: 0, y: 0 }; this.riding = undefined;
  }
  getComponent(id) {
    if (id === 'minecraft:inventory') return this.container ? { container: this.container } : undefined;
    if (id === 'minecraft:riding') return this.riding ? { entityRidingOn: this.riding } : undefined;
    if (id === 'minecraft:rideable' && ['ordertocook:seat', 'ordertocook:motorcycle'].includes(this.typeId)) return {
      getRiders: () => this.riders.filter(rider => rider.isValid),
      addRider: rider => { if (this.riders.length) return false; this.riders.push(rider); rider.riding = this; return true; },
      ejectRider: rider => { this.riders = this.riders.filter(item => item !== rider); rider.riding = undefined; },
      ejectRiders: () => { for (const rider of this.riders) rider.riding = undefined; this.riders = []; },
    };
    return undefined;
  }
  getDynamicProperty(key) { return this.dynamic[key]; }
  setDynamicProperty(key, value) { if (value === undefined) delete this.dynamic[key]; else this.dynamic[key] = value; }
  getProperty(key) { return this.properties[key]; }
  setProperty(key, value) { this.properties[key] = value; }
  setRotation(value) { this.rotation = { ...value }; }
  getRotation() { return { ...this.rotation }; }
  addTag(tag) { this.tags.add(tag); }
  hasTag(tag) { return this.tags.has(tag); }
  remove() { this.isValid = false; this.dimension.entities.delete(this.id); }
}

export class FakePlayer extends FakeEntity {
  constructor(dimension, location = { x: 0.5, y: 0, z: 0.5 }) {
    super(dimension, 'minecraft:player', location); this.container = new FakeContainer(36); this.selectedSlotIndex = 0;
    this.messages = []; this.isSneaking = false; this.viewedBlock = undefined; this.name = 'Tester';
    this.onScreenDisplay = { setActionBar: message => this.messages.push(message) };
  }
  sendMessage(message) { this.messages.push(message); }
  getBlockFromViewDirection() { return this.viewedBlock ? { block: this.viewedBlock } : undefined; }
  getEntitiesFromViewDirection() { return []; }
  getViewDirection() { return { x: 0, y: 0, z: 1 }; }
}

const signal = () => ({ subscriptions: [], subscribe(fn) { this.subscriptions.push(fn); return fn; } });
const signals = () => new Proxy({}, { get(target, key) { return target[key] ??= signal(); } });
export function makeEnvironment() {
  const dimension = {
    id: 'minecraft:overworld', blocks: new Map(), entities: new Map(), drops: [], sounds: [], spawnCount: 0,
    heightRange: { min: -64, max: 320 },
    getBlock(location) {
      const key = `${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
      if (!this.blocks.has(key)) this.blocks.set(key, new FakeBlock(this, { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) }));
      return this.blocks.get(key);
    },
    getBlockFromRay() { return undefined; },
    getEntities(options = {}) {
      return [...this.entities.values()].filter(entity => entity.isValid && (!options.type || entity.typeId === options.type) &&
        (!options.tags || options.tags.every(tag => entity.tags.has(tag))) &&
        (!options.location || (entity.location.x - options.location.x) ** 2 + (entity.location.y - options.location.y) ** 2 + (entity.location.z - options.location.z) ** 2 <= options.maxDistance ** 2));
    },
    spawnEntity(typeId, location) { const entity = new FakeEntity(this, typeId, location); this.entities.set(entity.id, entity); this.spawnCount++; return entity; },
    spawnItem(stack, location) { this.drops.push({ stack: stack.clone(), location: { ...location } }); },
    playSound(id) { this.sounds.push(id); }, spawnParticle() {},
  };
  const gameSystem = {
    currentTick: 0, callbacks: [], intervals: [],
    run(fn) { this.callbacks.push(fn); return this.callbacks.length; },
    runInterval(fn, ticks) { this.intervals.push({ fn, ticks }); return this.intervals.length; },
    runTimeout(fn, ticks) { this.callbacks.push(fn); return this.callbacks.length; },
  };
  const gameWorld = {
    afterEvents: signals(), beforeEvents: signals(), players: [],
    getDimension(id) { if (!['overworld', 'minecraft:overworld'].includes(id)) return { ...dimension, id, getEntities: () => [] }; return dimension; },
    getEntity(id) { return dimension.entities.get(id); },
    getAllPlayers() { return this.players; },
  };
  const records = new Map();
  const restaurants = new Map();
  const ctx = {
    world: gameWorld, system: gameSystem,
    getStation(block) {
      const id = `${block.dimension.id}_${block.location.x}_${block.location.y}_${block.location.z}`;
      if (!records.has(id)) records.set(id, { id, dimensionId: block.dimension.id, location: { ...block.location }, typeId: block.typeId });
      return records.get(id);
    },
    stations: () => [...records.values()], saveStation: station => records.set(station.id, station),
    deleteStation: station => records.delete(typeof station === 'string' ? station : station.id),
    getRestaurant: id => restaurants.get(id), restaurants: () => [...restaurants.values()], saveRestaurant: restaurant => restaurants.set(restaurant.id, restaurant),
    notify: (player, message) => player.messages.push(message), food: { isFood: stack => stack.typeId === 'minecraft:apple' },
  };
  return { ctx, dimension, world: gameWorld, system: gameSystem, records, restaurants };
}

export class FakeForm {
  title() { return this; } body() { return this; } button() { return this; }
  async show() { return { canceled: true }; }
}

globalThis.__otcApplianceMocks = { ItemStack: FakeItem, EquipmentSlot: { Offhand: 'Offhand' }, BlockPermutation: FakePermutation, system: {}, world: {}, ActionFormData: FakeForm };
let applianceSource = await readFile(new URL('../runtime/BP/scripts/appliances.js', import.meta.url), 'utf8');
applianceSource = applianceSource.replace(/import \{[^}]+\} from "@minecraft\/server";/, 'const {BlockPermutation, EquipmentSlot, ItemStack, system, world} = globalThis.__otcApplianceMocks;');
applianceSource = applianceSource.replace(/import \{[^}]+\} from "@minecraft\/server-ui";/, 'const {ActionFormData} = globalThis.__otcApplianceMocks;');
export const appliances = await import(`data:text/javascript;base64,${Buffer.from(applianceSource).toString('base64')}`);

globalThis.__otcEntityMocks = { ...appliances, ...globalThis.__otcApplianceMocks, ButtonState: { Pressed: 'Pressed' }, InputButton: { Jump: 'Jump' } };
let entitySource = await readFile(new URL('../runtime/BP/scripts/entities.js', import.meta.url), 'utf8');
entitySource = entitySource.replace(/import \{[^}]+\} from "@minecraft\/server";/, 'const {ButtonState, InputButton, ItemStack, system, world} = globalThis.__otcEntityMocks;');
entitySource = entitySource.replace(/import \{[^}]+\} from "@minecraft\/server-ui";/, 'const {ActionFormData} = globalThis.__otcEntityMocks;');
entitySource = entitySource.replace(/import \{[^}]+\} from "\.\/appliances.js";/, 'const {containerCapacity, dropContainerContents, itemLabel, openContainerForm, playerInventory} = globalThis.__otcEntityMocks;');
export const entityServices = await import(`data:text/javascript;base64,${Buffer.from(entitySource).toString('base64')}`);

export function place(env, typeId, location = { x: 0, y: 0, z: 0 }, states = {}) {
  const block = env.dimension.getBlock(location); block.setPermutation(new FakePermutation(typeId, states)); return block;
}
export function advance(service, env, ticks) { for (let i = 0; i < ticks; i++) { env.system.currentTick++; service.tick(); } }
