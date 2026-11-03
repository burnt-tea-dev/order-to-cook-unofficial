// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoodCatalog, connectFoodCatalog, FOOD_CATALOG_EVENT, FOOD_CATALOG_REQUEST } from '../runtime/BP/scripts/food_catalog.js';
import { SENLUO_FOODS, SENLUO_UNSUPPORTED_IDS } from '../runtime/BP/scripts/senluo_food_catalog.js';
import { VANILLA_FOODS, UPGRADE_NUTRITION } from '../runtime/BP/scripts/config.js';
import { normalizeMenu, addMenuFood, getMenuNutrition, createRestaurant, upgradeRestaurant, getUpgradeQuote } from '../runtime/BP/scripts/core.js';

const stack = (typeId, metadata = undefined) => ({ typeId,
  getRawLore: () => metadata ? [{ translate: 'senluo.public.food.v1', with: [JSON.stringify({ v: 1, hotUntil: 0, seasoning: [], ...metadata })] }] : []
});
const food = (typeId, nutrition, other = {}) => ({ typeId, nutrition, ...other });
const publish = (catalog, foods, other = {}) => catalog.register({ v: 1, provider: 'test', foods, ...other });

test('audited catalog improves the original 159 without lowering Java upgrade requirements', () => {
  assert.equal(getMenuNutrition(VANILLA_FOODS), 159);
  assert.equal(SENLUO_FOODS.length, 64);
  assert.equal(getMenuNutrition(SENLUO_FOODS), 328);
  assert.equal(new Set(SENLUO_FOODS.flatMap(f => [f.typeId, ...(f.aliases || [])])).size, 138);
  assert.equal(SENLUO_UNSUPPORTED_IDS.length, 289);
  const catalog = createFoodCatalog();
  const menu = [...VANILLA_FOODS, ...SENLUO_FOODS.map(f => catalog.resolve(stack(f.typeId)).food)];
  const restaurant = createRestaurant({ menu });
  assert.equal(restaurant.menu.length, 104);
  assert.equal(getMenuNutrition(restaurant), 487);
  for (let level = 1; level <= 7; level++) assert.equal(upgradeRestaurant(restaurant).ok, true);
  assert.equal(restaurant.level, 7);
  assert.deepEqual(UPGRADE_NUTRITION, [0, 40, 80, 120, 160, 200, 300, 400, 600]);
  assert.equal(getUpgradeQuote(restaurant).requiredNutrition, 600);
  assert.equal(upgradeRestaurant(restaurant).reason, 'menu_nutrition');
  assert.equal(getMenuNutrition(menu.filter(f => f.typeId !== 'kaleidoscope_grilling:wedding_candy')), 467);
});

test('real food aliases are one dish; quality, heat and fabricated V1 variants add no nutrition', () => {
  const catalog = createFoodCatalog(), restaurant = { menu: [] };
  const canonical = 'kaleidoscope_grilling:braised_chicken_wings';
  const first = catalog.resolve(stack(canonical)).food;
  assert.equal(first.nutrition, 10);
  assert.equal(addMenuFood(restaurant, first).ok, true);
  for (let quality = 0; quality < 4; quality++) {
    const supplied = catalog.resolve(stack(`${canonical}_cuisine_q${quality}`, {
      quality, nativeVariant: quality + 20, hotUntil: 9999999999999, seasoning: ['test:salt']
    })).food;
    assert.deepEqual(supplied, first);
    assert.equal(addMenuFood(restaurant, supplied).reason, 'duplicate_food');
  }
  assert.equal(getMenuNutrition(restaurant), 10);
  for (const entry of SENLUO_FOODS) for (const alias of entry.aliases || []) {
    assert.deepEqual(catalog.resolve(stack(alias)).food, catalog.resolve(stack(entry.typeId)).food);
  }
});

test('a new canonical dish cannot duplicate an existing legacy alias menu entry', () => {
  const old = food('kaleidoscope_grilling:grilled_beef_skewer_native_plain', 5, { label: '舊菜' });
  const restaurant = { menu: [old] };
  const canonical = createFoodCatalog().resolve(stack('kaleidoscope_grilling:grilled_beef_skewer')).food;
  assert.equal(addMenuFood(restaurant, canonical).reason, 'duplicate_food');
  assert.deepEqual(restaurant.menu, [old]);
  assert.deepEqual(normalizeMenu([old, canonical]), [old]);
  assert.deepEqual(normalizeMenu([canonical, old]), [canonical]);
});

test('declared same-ID recipe variants have their own nutrition; unknown variants are not guessed', () => {
  const catalog = createFoodCatalog();
  publish(catalog, [
    food('test:meal', 6, { label: '菜式甲', nativeVariant: 7, aliases: ['test:meal_in_hand'] }),
    food('test:meal', 9, { label: '菜式乙', nativeVariant: 8, aliases: ['test:meal_in_hand'] })
  ]);
  const menu = [7, 8].map(nativeVariant => catalog.resolve(stack('test:meal_in_hand', { nativeVariant })).food);
  assert.equal(getMenuNutrition(menu), 15);
  assert.deepEqual(menu.map(f => f.foodIdentity.nativeVariant), [7, 8]);
  assert.equal(catalog.resolve(stack('test:meal', { nativeVariant: 9 })).food, undefined);
  assert.equal(catalog.resolve(stack('test:meal')).food, undefined);
  assert.equal(catalog.resolve({ typeId: 'test:meal' }).food, undefined);
});

test('batch announcements are idempotent and update only future snapshots', () => {
  const catalog = createFoodCatalog();
  publish(catalog, [food('test:meal', 6, { label: '原菜', aliases: ['test:meal_old_hand'] })]);
  const captured = catalog.resolve(stack('test:meal')).food;
  publish(catalog, [food('test:snack', 3)]);
  publish(catalog, [food('test:meal', 7, { label: '新菜', aliases: ['test:meal_new_hand'] })]);
  assert.equal(catalog.resolve(stack('test:snack')).food.nutrition, 3);
  assert.equal(catalog.resolve(stack('test:meal')).food.nutrition, 7);
  assert.equal(catalog.resolve(stack('test:meal_old_hand')).known, false);
  assert.equal(captured.nutrition, 6); assert.equal(captured.label, '原菜');
  assert.deepEqual(captured.aliases, ['test:meal_old_hand']);
  publish(catalog, [], { replace: true });
  assert.equal(catalog.resolve(stack('test:meal')).known, false);
  assert.equal(captured.nutrition, 6);
  assert.equal(createFoodCatalog().resolve(stack('test:snack')).known, false);
});

test('food declarations require positive sourced nutrition and unambiguous owned aliases', () => {
  const catalog = createFoodCatalog();
  publish(catalog, [food('test:meal', 6)]);
  for (const invalid of [
    food('test:meal', 0), food('test:meal', 1.5), food('minecraft:apple', 900),
    food('test:meal', 7, { aliases: ['other:meal'] }), food('test:meal', 7, { nativeVariant: -1 })
  ]) {
    assert.throws(() => publish(catalog, [food('test:new', 3), invalid], { replace: true }));
    assert.equal(catalog.resolve(stack('test:meal')).food.nutrition, 6);
    assert.equal(catalog.resolve(stack('test:new')).known, false);
  }
  assert.throws(() => publish(catalog, [food('test:other', 7, { aliases: ['test:meal'] })]));
  for (const typeId of ['kaleidoscope_grilling:secret_skewer', 'kaleidoscope_grilling:skewer_plate',
    'kaleidoscope_tavern:wine_q1', 'kaleidoscope_world_liquor:cola']) {
    const result = catalog.resolve(stack(typeId, { quality: 0, nativeVariant: 1 }));
    assert.equal(result.known, true); assert.equal(result.food, undefined);
  }
  assert.equal(catalog.resolve(stack('test:tool')).known, false);
});

test('boot announcement and request/reply both work without world access or pack-order dependencies', () => {
  for (const announceFirst of [true, false]) {
    const catalog = createFoodCatalog(), subscribers = [], nextTick = [], sent = [];
    const system = {
      afterEvents: { scriptEventReceive: { subscribe: fn => subscribers.push(fn) } },
      run: fn => nextTick.push(fn),
      sendScriptEvent: (id, message) => {
        sent.push(id);
        for (const listener of subscribers) listener({ id, message, sourceType: 'Server' });
      }
    };
    const request = connectFoodCatalog(system, catalog);
    const announce = () => system.sendScriptEvent(FOOD_CATALOG_EVENT, JSON.stringify({ v: 1, provider: 'test', foods: [food('test:meal', 6)] }));
    if (announceFirst) announce();
    request();
    subscribers.push(event => { if (event.id === FOOD_CATALOG_REQUEST) announce(); });
    for (const fn of nextTick) fn();
    assert.equal(catalog.resolve(stack('test:meal')).food.nutrition, 6);
    assert.equal(sent.filter(id => id === FOOD_CATALOG_REQUEST).length, 1);
    for (const sourceType of ['Entity', 'Block', 'NPCDialogue']) for (const fn of subscribers) fn({
      id: FOOD_CATALOG_EVENT, sourceType,
      message: JSON.stringify({ v: 1, provider: 'test', foods: [food('test:meal', 999)] })
    });
    assert.equal(catalog.resolve(stack('test:meal')).food.nutrition, 6);
  }
});
