// SPDX-License-Identifier: GPL-3.0-only
// The real local compiler, generated publisher and OTC registry/stove; no BDS claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSmokingRecipeRegistry } from '../runtime/BP/scripts/smoking_recipes.js';
import { appliances, FakeItem, makeEnvironment, place, advance } from './appliances.harness.js';

const compiler = fileURLToPath(new URL('../tools/build_smoking_provider.py', import.meta.url));
const compile = files => JSON.parse(execFileSync('python3', ['-c', `
import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('provider',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
result=module.compile_smoking_provider({k:v.encode() for k,v in json.load(sys.stdin).items()})
result['updates']={k:v.decode() for k,v in result['updates'].items()}
print(json.dumps(result))
`, compiler], { input: JSON.stringify(files), encoding: 'utf8' }));
const recipe = (id, input, output, fields = {}) => JSON.stringify({ format_version: '1.21.10',
  'minecraft:recipe_furnace': { description: { identifier: id }, tags: ['smoker'], input, output, ...fields } });
const pack = recipes => ({
  'manifest.json': JSON.stringify({ modules: [{ type: 'script', entry: 'scripts/main.js' }],
    dependencies: [{ module_name: '@minecraft/server', version: '2.11.0' }] }),
  'scripts/main.js': '// Original author entry\nexport const original = true;\n',
  ...recipes,
});

function engine(registry, installed) {
  const loads = [], listeners = [], queued = [], messages = [];
  return {
    world: { afterEvents: { worldLoad: { subscribe: fn => loads.push(fn) } } },
    ItemTypes: { get: id => installed.has(id) ? { id } : undefined },
    system: { run: fn => queued.push(fn), afterEvents: { scriptEventReceive: { subscribe: fn => listeners.push(fn) } },
      sendScriptEvent(id, message) {
        assert.equal(id, 'ordertocook:smoking_recipes_v1');
        assert.ok(message.length <= 2048);
        messages.push(message);
        assert.equal(registry.registerProvider(JSON.parse(message)).ok, true);
      } },
    emit: (sourceType = 'Server') => listeners.forEach(fn => fn({ sourceType, id: 'ordertocook:request_smoking_recipes_v1' })),
    load: () => loads.forEach(fn => fn()),
    flush() { while (queued.length) queued.shift()(); }, messages,
  };
}
let moduleNumber = 0;
async function start(source, fixture) {
  globalThis.__otcSmokingProviderTest = fixture;
  const executable = source.replace("import { system, world, ItemTypes } from '@minecraft/server';",
    'const { system, world, ItemTypes } = globalThis.__otcSmokingProviderTest;');
  await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}#${moduleNumber++}`);
  delete globalThis.__otcSmokingProviderTest;
}

test('compile native item forms once, coalesce equivalent recipes and preserve author bytes', () => {
  const files = pack({
    'recipes/a.json': recipe('supplier:roast', 'supplier:raw', 'supplier:cooked'),
    'recipes/b.json': recipe('supplier:another_roast', { item: 'supplier:raw' }, { item: 'supplier:cooked', count: 1 }),
    'recipes/c.json': recipe('supplier:cutlets', { item: 'supplier:cut' }, { item: 'supplier:cooked_cut', count: 2 }),
    'recipes/furnace.json': recipe('supplier:brick', 'supplier:clay', 'supplier:brick', { tags: ['furnace'] }),
  });
  const original = structuredClone(files), result = compile(files);
  assert.deepEqual(files, original);
  assert.equal(result.recipes.length, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.recipes.find(row => row.input === 'supplier:cut').count, 2);
  assert.deepEqual(Object.keys(result.updates).sort(), ['scripts/main.js', 'scripts/otc_smoking_provider.js']);
  assert.equal(result.updates['scripts/main.js'], "import './otc_smoking_provider.js';\n" + files['scripts/main.js']);
  assert.deepEqual(compile({ ...files, ...result.updates }).updates, {});
  const retired = { ...files, ...result.updates };
  for (const path of Object.keys(retired)) if (path.startsWith('recipes/')) delete retired[path];
  const removal = compile(retired);
  assert.deepEqual(removal.removals, ['scripts/otc_smoking_provider.js']);
  assert.deepEqual(removal.updates, { 'scripts/main.js': files['scripts/main.js'] });
});

test('foreign inputs, ambiguous results and unmodelled conditions never become guessed recipes', () => {
  const result = compile(pack({
    'recipes/a.json': recipe('supplier:a', 'supplier:raw', 'supplier:cooked'),
    'recipes/b.json': recipe('supplier:b', 'supplier:raw', 'supplier:other_result'),
    'recipes/foreign.json': recipe('supplier:foreign', 'minecraft:water_bucket', 'supplier:salt'),
    'recipes/tag.json': recipe('supplier:tag', { tag: 'minecraft:logs' }, 'supplier:coal'),
    'recipes/data.json': recipe('supplier:data', { item: 'supplier:raw', data: 1 }, 'supplier:cooked'),
    'recipes/condition.json': recipe('supplier:condition', 'supplier:other', 'supplier:cooked', { conditions: [] }),
  }));
  assert.deepEqual(result.updates, {}); assert.deepEqual(result.recipes, []);
  assert.equal(result.skipped.length, 6);
  assert.equal(result.skipped.filter(row => row.reason === 'conflicting_smoker_input').length, 2);
  const collision = compile(pack({
    'recipes/a.json': recipe('supplier:same', 'supplier:raw', 'supplier:cooked'),
    'recipes/b.json': recipe('supplier:same', 'supplier:raw', 'supplier:other'),
    'recipes/c.json': recipe('supplier:third', 'supplier:raw', 'supplier:cooked'),
  }));
  assert.deepEqual(collision.recipes, []);
  const unrepresentableAlternative = compile(pack({
    'recipes/a.json': recipe('supplier:base', 'supplier:raw', 'supplier:cooked'),
    'recipes/b.json': recipe('supplier:conditional', 'supplier:raw', 'supplier:other', { conditions: ['custom'] }),
  }));
  assert.deepEqual(unrepresentableAlternative.recipes, []);
});

test('generated native catalogs cannot replace an existing author catalog or its input', async () => {
  const installed = new Set(['supplier:raw', 'supplier:cooked', 'supplier:handwritten']);
  const registry = createSmokingRecipeRegistry({ hasItem: id => installed.has(id) });
  assert.equal(registry.registerProvider({ version: 1, provider: 'supplier', catalog: 'main', recipes: [
    { id: 'supplier:manual', process: 'smoking', input: 'supplier:raw', output: 'supplier:handwritten', count: 1 },
  ] }).ok, true);
  const fixture = engine(registry, installed), responses = [];
  fixture.system.sendScriptEvent = (id, message) => {
    assert.equal(id, 'ordertocook:smoking_recipes_v1');
    responses.push(registry.registerProvider(JSON.parse(message)));
  };
  const generated = compile(pack({ 'recipes/a.json': recipe('supplier:native', 'supplier:raw', 'supplier:cooked') }));
  await start(generated.updates['scripts/otc_smoking_provider.js'], fixture);
  fixture.load(); fixture.flush();
  assert.deepEqual(responses, [{ ok: false, reason: 'recipe_owned_by_another_catalog' }]);
  assert.deepEqual(registry.recipes['supplier:raw'], { output: 'supplier:handwritten', count: 1 });
  assert.deepEqual(registry.recipes['minecraft:beef'], { output: 'minecraft:cooked_beef', count: 1 });
});

// Exact input/output facts from the five original public author files named in
// STOVE-RECIPES.md. No author scripts or archives are distributed in this test.
const authorRecipes = [
  ['kaleidoscope_cookery', 'stuffed_dough_food', 'samsa'],
  ['kaleidoscope_chinesefood', 'raw_mooncake', 'mooncake'],
  ['kaleidoscope_nether', 'raw_piglin_meat', 'cooked_piglin_meat'],
  ['kaleidoscope_nether', 'raw_strider_meat', 'cooked_strider_meat'],
  ['kaleidoscope_nether', 'ghast_tentacle', 'roasted_ghast_tentacle'],
  ['kaleidoscope_nether', 'ham', 'roasted_ham'],
  ['kaleidoscope_end', 'raw_ender_dragon_meat', 'cooked_ender_dragon_meat'],
  ['kaleidoscope_end', 'raw_endermite_meat', 'roasted_endermite_meat'],
  ['kaleidoscope_sculk', 'eerie_meat', 'cooked_eerie_meat'],
].map(([provider, input, output]) => [provider, `${provider}:${input}`, `${provider}:${output}`]);

test('source-derived optional catalogs feed all nine author recipes through the real 200-tick stove', async () => {
  const installed = new Set(authorRecipes.flatMap(([, input, output]) => [input, output]));
  const registry = createSmokingRecipeRegistry({ hasItem: id => installed.has(id) });
  const fixture = engine(registry, installed);
  for (const provider of new Set(authorRecipes.map(row => row[0]))) {
    const files = pack(Object.fromEntries(authorRecipes.filter(row => row[0] === provider).map(([, input, output], i) =>
      [`recipes/${i}.json`, recipe(`${provider}:smoke_${i}`, input, output)])));
    await start(compile(files).updates['scripts/otc_smoking_provider.js'], fixture);
  }
  fixture.emit(); fixture.flush(); assert.equal(fixture.messages.length, 0);
  fixture.load(); fixture.flush(); assert.equal(fixture.messages.length, 5);
  for (let offset = 0; offset < authorRecipes.length; offset += 3) {
    const env = makeEnvironment(); env.ctx.smokingRecipes = registry.recipes;
    const service = appliances.createApplianceService(env.ctx), block = place(env, 'ordertocook:stove');
    service.onPlace(block);
    const inventory = service.getStorage(env.ctx.getStation(block)); service.tick();
    const batch = authorRecipes.slice(offset, offset + 3);
    batch.forEach(([, input], lane) => inventory.setItem(lane, new FakeItem(input, 2)));
    inventory.setItem(3, new FakeItem('minecraft:coal'));
    advance(service, env, 199);
    batch.forEach((_, lane) => assert.equal(inventory.getItem(lane + 4), undefined));
    advance(service, env, 1);
    batch.forEach(([, , output], lane) => {
      assert.equal(inventory.getItem(lane).amount, 1);
      assert.equal(inventory.getItem(lane + 4).typeId, output);
      assert.equal(inventory.getItem(lane + 4).amount, 1);
    });
  }
  fixture.emit('Entity'); fixture.flush(); assert.equal(fixture.messages.length, 5);
  fixture.emit(); fixture.flush(); assert.equal(fixture.messages.length, 10);
  assert.equal(Object.keys(registry.recipes).length, 18);
});

test('large catalogs stay within event limits and unavailable optional items withdraw only their own entries', async () => {
  const rows = Array.from({ length: 35 }, (_, i) => [`supplier:raw_${i}`, `supplier:cooked_${i}`]);
  const installed = new Set(rows.flat()), registry = createSmokingRecipeRegistry({ hasItem: id => installed.has(id) });
  const fixture = engine(registry, installed);
  const files = pack(Object.fromEntries(rows.map(([input, output], i) => [`recipes/${i}.json`, recipe(`supplier:smoke_${i}`, input, output)])));
  await start(compile(files).updates['scripts/otc_smoking_provider.js'], fixture);
  fixture.load(); fixture.flush();
  assert.ok(fixture.messages.length > 1);
  assert.equal(Object.keys(registry.recipes).length, 44);
  installed.delete(rows[0][1]); fixture.emit(); fixture.flush();
  assert.equal(registry.recipes[rows[0][0]], undefined);
  assert.equal(Object.keys(registry.recipes).length, 43);
  installed.clear(); fixture.emit(); fixture.flush();
  assert.equal(Object.keys(registry.recipes).length, 9);
});
