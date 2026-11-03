// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSmokingRecipeRegistry } from '../runtime/BP/scripts/smoking_recipes.js';

const wing = 'kaleidoscope_grilling:chicken_wing';
const roastWing = 'kaleidoscope_grilling:roasted_chicken_wing';
const potato = 'kaleidoscope_grilling:sweet_potato';
const roastPotato = 'kaleidoscope_grilling:roasted_sweet_potato';
const raw = 'example:raw_fillet', cooked = 'example:cooked_fillet';
const recipe = overrides => ({ id: 'example:smoked_fillet', process: 'smoking', input: raw,
  output: cooked, count: 1, ...overrides });
const snapshot = (recipes = [recipe()], provider = 'example') => ({ version: 1, provider, recipes });
const create = ids => createSmokingRecipeRegistry({ hasItem: id => ids.includes(id) });

test('OTC alone keeps its nine vanilla recipes without an optional provider', () => {
  const registry = create([]);
  assert.equal(Object.keys(registry.recipes).length, 9);
  assert.deepEqual(registry.recipes['minecraft:beef'], { output: 'minecraft:cooked_beef', count: 1 });
  assert.equal(registry.recipes[wing], undefined);
});

test('audited Grilling smoker recipes require both native input and output IDs', () => {
  const complete = create([wing, roastWing, potato, roastPotato]);
  assert.equal(Object.keys(complete.recipes).length, 11);
  assert.deepEqual(complete.recipes[wing], { output: roastWing, count: 1 });
  assert.deepEqual(complete.recipes[potato], { output: roastPotato, count: 1 });
  const partial = create([wing, roastWing, potato]);
  assert.deepEqual(partial.recipes[wing], { output: roastWing, count: 1 });
  assert.equal(partial.recipes[potato], undefined);
  assert.equal(create([roastWing]).recipes[wing], undefined);
});

test('late provider registration, repeated snapshots, updates and withdrawal share one live map', () => {
  const registry = create([raw, cooked]);
  const live = registry.recipes;
  assert.equal(registry.registerProvider(snapshot()).ok, true);
  assert.equal(registry.registerProvider(snapshot()).ok, true);
  assert.equal(Object.keys(live).length, 10);
  assert.deepEqual(live[raw], { output: cooked, count: 1 });
  assert.equal(registry.registerProvider(snapshot([recipe({ count: 2 })])).ok, true);
  assert.deepEqual(live[raw], { output: cooked, count: 2 });
  assert.deepEqual(registry.registerProvider(snapshot([])), { ok: true, provider: 'example', catalog: 'main', registered: 0 });
  assert.equal(registry.recipes, live);
  assert.equal(live[raw], undefined);
  assert.equal(Object.keys(live).length, 9);
});

test('one invalid row cannot erase a valid snapshot or leave half a replacement', () => {
  const registry = create([raw, cooked, 'example:raw_cutlet', 'example:cooked_cutlet']);
  registry.registerProvider(snapshot());
  const before = structuredClone(registry.recipes);
  const result = registry.registerProvider(snapshot([
    recipe({ id: 'example:cutlet', input: 'example:raw_cutlet', output: 'example:cooked_cutlet' }),
    recipe({ output: 'example:not_installed' }),
  ]));
  assert.equal(result.ok, false);
  assert.deepEqual(registry.recipes, before);
});

test('providers cannot claim vanilla or another add-on ingredient namespace', () => {
  const registry = create([raw, cooked, 'minecraft:beef', 'minecraft:cooked_beef']);
  for (const value of [
    snapshot([recipe({ input: 'minecraft:beef', output: 'minecraft:cooked_beef' })]),
    snapshot([recipe()], 'another'),
    snapshot([recipe({ id: 'another:smoked_fillet' })]),
    snapshot([], 'minecraft'),
  ]) assert.equal(registry.registerProvider(value).ok, false);
  assert.equal(Object.keys(registry.recipes).length, 9);
});

test('Grilling can replace or withdraw its reviewed defaults without changing another provider', () => {
  const registry = create([wing, roastWing, potato, roastPotato, raw, cooked]);
  registry.registerProvider(snapshot());
  assert.equal(registry.registerProvider(snapshot([
    { id: 'kaleidoscope_grilling:roasted_chicken_wing', process: 'smoking', input: wing, output: roastWing, count: 2 },
  ], 'kaleidoscope_grilling')).ok, true);
  assert.deepEqual(registry.recipes[wing], { output: roastWing, count: 2 });
  assert.equal(registry.recipes[potato], undefined);
  assert.equal(registry.registerProvider(snapshot([], 'kaleidoscope_grilling')).ok, true);
  assert.equal(registry.recipes[wing], undefined);
  assert.deepEqual(registry.recipes[raw], { output: cooked, count: 1 });
});

test('special processes, multi-input recipes and container semantics are not silently flattened', () => {
  const registry = create([raw, cooked]);
  for (const invalid of [
    recipe({ process: 'grilling' }), recipe({ process: 'shaker' }), recipe({ process: 'wok' }),
    recipe({ ingredients: [raw, 'minecraft:water_bucket'] }), recipe({ container: 'minecraft:bowl' }),
    recipe({ cookingTicks: 100 }), recipe({ inputCount: 2 }), recipe({ count: 0 }),
    recipe({ count: 1.5 }), recipe({ count: 65 }),
  ]) assert.equal(registry.registerProvider(snapshot([invalid])).ok, false);
  assert.equal(registry.recipes[raw], undefined);
});

test('unavailable inputs, ambiguous IDs and wrong API versions preserve existing recipes', () => {
  const registry = create([raw, cooked]);
  registry.registerProvider(snapshot());
  const before = structuredClone(registry.recipes);
  for (const invalid of [
    snapshot([recipe({ input: 'example:missing' })]), snapshot([recipe(), recipe({ id: 'example:duplicate_input' })]),
    snapshot([recipe(), recipe({ input: 'example:another_input' })]), { ...snapshot(), version: 2 },
    { ...snapshot(), catalog: 'invalid/catalog' }, { ...snapshot(), catalog: null },
  ]) assert.equal(registry.registerProvider(invalid).ok, false);
  assert.deepEqual(registry.recipes, before);
});

test('restarting without a provider does not restore its previous declarations', () => {
  const first = create([raw, cooked]);
  first.registerProvider(snapshot());
  assert.ok(first.recipes[raw]);
  const restarted = create([]);
  assert.equal(restarted.recipes[raw], undefined);
  assert.equal(Object.keys(restarted.recipes).length, 9);
});

test('one provider can publish two catalogs and withdraw one without erasing the other', () => {
  const cutlet = 'example:raw_cutlet', cookedCutlet = 'example:cooked_cutlet';
  const registry = create([raw, cooked, cutlet, cookedCutlet]);
  const live = registry.recipes;
  assert.equal(registry.registerProvider({ ...snapshot(), catalog: 'fish' }).ok, true);
  assert.equal(registry.registerProvider({ ...snapshot([
    recipe({ id: 'example:smoked_cutlet', input: cutlet, output: cookedCutlet }),
  ]), catalog: 'meat' }).ok, true);
  assert.deepEqual(live[raw], { output: cooked, count: 1 });
  assert.deepEqual(live[cutlet], { output: cookedCutlet, count: 1 });
  assert.deepEqual(registry.registerProvider({ ...snapshot([]), catalog: 'fish' }), {
    ok: true, provider: 'example', catalog: 'fish', registered: 0,
  });
  assert.equal(registry.recipes, live);
  assert.equal(live[raw], undefined);
  assert.deepEqual(live[cutlet], { output: cookedCutlet, count: 1 });
  assert.equal(Object.keys(live).length, 10);
});

test('a catalog cannot overwrite another catalog input even within the same provider', () => {
  const registry = create([raw, cooked]);
  registry.registerProvider(snapshot()); // Omitted catalog means main.
  const before = structuredClone(registry.recipes);
  assert.deepEqual(registry.registerProvider({ ...snapshot([recipe({ count: 2 })]), catalog: 'extra' }), {
    ok: false, reason: 'recipe_owned_by_another_catalog',
  });
  assert.deepEqual(registry.recipes, before);
  registry.registerProvider({ ...snapshot([]), catalog: 'main' });
  assert.equal(registry.registerProvider({ ...snapshot([recipe({ count: 2 })]), catalog: 'extra' }).ok, true);
  assert.deepEqual(registry.recipes[raw], { output: cooked, count: 2 });
});
