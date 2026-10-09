// SPDX-License-Identifier: GPL-3.0-only
// Loads the shipped main/core/store/inventory/dining source with isolated native
// doubles. This checks adapter transactions, not native GUI or actual disk IO.
import { readFile } from 'node:fs/promises';
import { FakeItem, FakePlayer, FakePermutation, makeEnvironment, place } from './appliances.harness.js';

let sequence = 0;
const scripts = new URL('../runtime/BP/scripts/', import.meta.url);
const signal = () => ({ subscriptions: [], subscribe(fn) { this.subscriptions.push(fn); return fn; } });
const signals = () => new Proxy({}, { get(target, name) { return target[name] ||= signal(); } });

export async function mainFixture() {
  const env = makeEnvironment();
  const properties = new Map();
  env.world.getDynamicPropertyIds = () => [...properties.keys()];
  env.world.getDynamicProperty = id => properties.get(id);
  let failProperty;
  env.world.setDynamicProperty = (id, value) => {
    if (failProperty?.(id, value)) { failProperty = undefined; throw Error('simulated native persistence failure'); }
    if (value === undefined) properties.delete(id); else properties.set(id, value);
  };
  env.system.beforeEvents = signals(); env.system.afterEvents = signals();
  const originalGetBlock = env.dimension.getBlock.bind(env.dimension);
  env.dimension.getBlock = location => {
    const block = originalGetBlock(location);
    block.above = (amount = 1) => env.dimension.getBlock({ ...block.location, y: block.location.y + amount });
    block.getComponent = () => undefined;
    return block;
  };
  const player = new FakePlayer(env.dimension, { x: 1.5, y: 0, z: 1.5 });
  player.getGameMode = () => 'Survival';
  env.world.players.push(player);
  const native = { world: env.world, system: env.system, ItemStack: FakeItem, BlockPermutation: FakePermutation, GameMode: { Creative: 'Creative', Survival: 'Survival' } };
  const key = `__otcMainTests${++sequence}`;
  const endings = [], interruptions = [];
  const stubs = {
    createEntityService: () => ({ init() {}, spawnCustomer() {}, cleanupOrder() {}, onBlockBreak() {},
      finishCustomer: (...args) => endings.push(args), resumeCustomerMeal() {},
      interruptCustomerMeal: (...args) => interruptions.push(args),
      getCustomerSeat: () => chair }),
    createApplianceService: () => ({ init() {}, onPlace() {}, onBreak() {}, getStorage() {} }),
    notify: (who, text) => who.sendMessage(text), choose: async () => undefined, textInput: async () => undefined,
    safely: (who, fn) => Promise.resolve().then(fn),
  };
  globalThis[key] = { native, stubs };
  const loaded = new Map();
  async function moduleUrl(name) {
    if (loaded.has(name)) return loaded.get(name);
    let source = await readFile(new URL(name, scripts), 'utf8');
    const imports = [...source.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g)];
    for (const match of imports) {
      const [, bindings, specifier] = match;
      let replacement;
      if (specifier === '@minecraft/server') replacement = `const {${bindings}} = globalThis.${key}.native;`;
      else if (['./entities.js', './appliances.js', './ui.js'].includes(specifier)) replacement = `const {${bindings}} = globalThis.${key}.stubs;`;
      else if (specifier.startsWith('./')) replacement = `import {${bindings}} from '${await moduleUrl(specifier.slice(2))}';`;
      else throw Error(`Unmocked import ${specifier}`);
      source = source.replace(match[0], replacement);
    }
    // Pure modules also need a unique URL when they close over native modules.
    const url = `data:text/javascript;base64,${Buffer.from(source + `\n// fixture ${key}`).toString('base64')}`;
    loaded.set(name, url); return url;
  }
  const main = await import(await moduleUrl('main.js'));
  for (const fn of env.world.afterEvents.worldLoad.subscriptions) fn();
  const store = await import(await moduleUrl('store.js'));
  const core = await import(await moduleUrl('core.js'));
  const hooks = main.getQaHooks();
  const machine = place(env, 'ordertocook:order_machine', { x: 0, y: 0, z: 0 });
  const chair = place(env, 'ordertocook:chair', { x: 2, y: 0, z: 2 }, { 'minecraft:cardinal_direction': 'south' });
  const restaurant = hooks.getMachine(player, machine);
  restaurant.menu = [{ typeId: 'minecraft:bread', label: '麵包', nutrition: 5 }];
  restaurant.config = { ...restaurant.config, deliveryRate: 0, tipNormalChance: 0, tipUrgentChance: 0 };
  const now = Date.now(), order = core.generateOrder(restaurant, now, () => 0.9999);
  core.acceptOrder(restaurant, order.id, now + 1); core.packOrder(restaurant, order.id, now + 2);
  order.proof = 'native-like-order-proof'; order.platedVariant = 3; store.saveRestaurant(restaurant);
  const parcel = new FakeItem('ordertocook:food_plate');
  parcel.setDynamicProperty('ordertocook:restaurant', restaurant.id);
  parcel.setDynamicProperty('ordertocook:order_id', order.id);
  parcel.setDynamicProperty('ordertocook:proof', order.proof);
  player.container.setItem(0, parcel);
  const customer = env.dimension.spawnEntity('ordertocook:customer', { x: 2.5, y: 0.5625, z: 2.5 });
  const seat = env.dimension.spawnEntity('ordertocook:seat', customer.location);
  seat.getComponent('minecraft:rideable').addRider(customer);
  customer.setDynamicProperty('ordertocook:restaurant_id', restaurant.id);
  customer.setDynamicProperty('ordertocook:order_id', order.id);
  return { ...env, hooks, store, core, player, customer, chair, machine, restaurant, order, parcel, properties,
    endings, interruptions, failWrite: predicate => { failProperty = predicate; },
    linkage: { restaurantId: restaurant.id, orderId: order.id } };
}

export function itemCount(player, id) {
  let amount = 0;
  for (let slot = 0; slot < player.container.size; slot++) {
    const stack = player.container.getItem(slot);
    if (stack?.typeId === id) amount += stack.amount;
  }
  return amount;
}

export function balance(player) {
  return [1, 5, 20, 100, 10000].reduce((sum, value) => sum + itemCount(player, `ordertocook:chef_coin_${value}`) * value, 0);
}
