// SPDX-License-Identifier: GPL-3.0-only
// Recipes match breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642
// fabric-1.20.1/src/main/resources/data/ordertocook/recipes/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function recipe(name) {
  return JSON.parse(readFileSync(new URL(`../runtime/BP/recipes/${name}.json`, import.meta.url), 'utf8'));
}

const conversions = [
  ['chef_coin_100_from_20', 20, 5, 100, 1],
  ['chef_coin_1_from_5', 5, 1, 1, 5],
  ['chef_coin_20_from_100', 100, 1, 20, 5],
  ['chef_coin_20_from_5', 5, 4, 20, 1],
  ['chef_coin_5_from_1', 1, 5, 5, 1],
  ['chef_coin_5_from_20', 20, 1, 5, 4]
];

test('all six pinned Java coin-exchange recipes exist, preserve value and require the correct input slots', () => {
  for (const [name, from, input, to, output] of conversions) {
    const document = recipe(name);
    assert.equal(document.format_version, '1.20.10', name);
    const result = document['minecraft:recipe_shapeless'];
    assert.ok(result, name + ': must be shapeless');
    assert.equal(result.description.identifier, 'ordertocook:' + name);
    assert.deepEqual(result.tags, ['crafting_table']);
    assert.equal(result.group, 'ordertocook:chef_coins');
    assert.deepEqual(result.ingredients, Array.from({ length: input }, () => ({
      item: 'ordertocook:chef_coin_' + from
    })), name + ': input grid must match Java');
    assert.deepEqual(result.result, { item: 'ordertocook:chef_coin_' + to, count: output });
    assert.deepEqual(result.unlock, { context: 'AlwaysUnlocked' });
    assert.equal(from * input, to * output, name + ': conversion must not mint coins');
  }
});

test('motorcycle is craftable through the original Java 3x3 recipe without changing colour or vehicle lifecycle', () => {
  const document = recipe('motorcycle');
  assert.equal(document.format_version, '1.20.10');
  const r = document['minecraft:recipe_shaped'];
  assert.ok(r);
  assert.equal(r.description.identifier, 'ordertocook:motorcycle');
  assert.deepEqual(r.tags, ['crafting_table']);
  assert.deepEqual(r.pattern, ['I C', 'BRB', '5 5']);
  assert.deepEqual(r.key, {
    I: { item: 'minecraft:iron_ingot' },
    C: { item: 'minecraft:chest' },
    B: { item: 'minecraft:iron_block' },
    R: { item: 'minecraft:redstone_block' },
    '5': { item: 'ordertocook:chef_coin_5' }
  });
  assert.deepEqual(r.result, { item: 'ordertocook:motorcycle', count: 1 });
  assert.deepEqual(r.unlock, { context: 'AlwaysUnlocked' });
});
