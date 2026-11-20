import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../experiments/stove-ui/resource_pack/ui/data_driven_container_screen.json', import.meta.url);
const source = readFileSync(path, 'utf8');
const json = source.replace(/^\/\*[\s\S]*?\*\/\s*/m, '');
const ui = JSON.parse(json);

function indices(name) {
  return ui[name].controls.map(control => Object.values(control)[0].collection_index);
}

test('stove UI uses all seven existing native container slots exactly once', () => {
  assert.deepEqual(indices('stove_ingredient_slots'), [0, 1, 2]);
  assert.deepEqual(indices('stove_fuel_slot'), [3]);
  assert.deepEqual(indices('stove_output_slots'), [4, 5, 6]);
  assert.deepEqual(
    [...indices('stove_ingredient_slots'), ...indices('stove_fuel_slot'), ...indices('stove_output_slots')].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6]
  );
});

test('stove UI coordinates reproduce the pinned Java slot layout', () => {
  const controls = Object.fromEntries(ui.stove_top_half.controls.map(control => {
    const [name, value] = Object.entries(control)[0];
    return [name, value];
  }));
  assert.deepEqual(controls['stove_ingredient_slots@data_driven_container.stove_ingredient_slots'].offset, [38, 6]);
  assert.deepEqual(controls['stove_fuel_slot@data_driven_container.stove_fuel_slot'].offset, [56, 42]);
  assert.deepEqual(controls['stove_output_slots@data_driven_container.stove_output_slots'].offset, [116, 24]);
  assert.deepEqual(ui.stove_top_half.offset, [0, 11]);
});

test('custom stove panel is desktop-only and preserves vanilla fallbacks', () => {
  const vars = ui['screen@common.inventory_screen_common'].variables;
  assert.match(vars[0].requires, /container\.ordertocook\.stove/);
  assert.equal(vars[0]['$screen_content'], 'data_driven_container.stove_panel');
  assert.equal(vars[1]['$screen_content'], 'data_driven_container.desktop_panel');
  assert.equal(vars[2]['$screen_content'], 'pocket_containers.data_driven_container_panel');
});

test('slot panels bind to the original native container item collection', () => {
  for (const name of ['stove_ingredient_slots', 'stove_fuel_slot', 'stove_output_slots']) {
    assert.equal(ui[name].collection_name, 'container_items');
    for (const control of ui[name].controls) {
      const template = Object.keys(control)[0];
      assert.match(template, /@chest\.chest_grid_item$/);
    }
  }
});
