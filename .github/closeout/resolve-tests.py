from pathlib import Path
p=Path('tests/stove.test.js');s=p.read_text()
s=s.replace("await respondWith([choose(0), choose(1), { canceled: true }],", "await respondWith([{ canceled: true }],",1)
s=s.replace("await respondWith([choose(0), choose(1), choose(0)],", "await respondWith([choose(0), { canceled: true }],",2)
s=s.replace("// Outputs have only Take and Close, so Take is button 0.","// In the integrated seven-slot screen, output slot 4 is directly withdrawable.")
s=s.replace("await respondWith([choose(4), choose(0), choose(0)],", "await respondWith([choose(4), { canceled: true }],")
s=s.replace("  player.container.setItem(0, new FakeItem('minecraft:beef', 2));\n  await respondWith([choose(0), choose(0), () => {", "  player.container.setItem(1, new FakeItem('minecraft:beef', 2));\n  await respondWith([() => {")
s=s.replace("    player.container.setItem(0, changed);\n    return choose(0);", "    player.container.setItem(1, changed);\n    return choose(8);")
s=s.replace("assert.deepEqual(player.container.getItem(0).getLore(), ['changed batch']);", "assert.deepEqual(player.container.getItem(1).getLore(), ['changed batch']);")
s=s.replace("    if (forms === 1) return choose(0);\n    if (forms === 2) return choose(1);\n    if (forms === 3) { reachedSelection(); return selection; }", "    if (forms === 1) { reachedSelection(); return selection; }")
s=s.replace('    assert.equal(forms, 3);','    assert.equal(forms, 1);')
s+='''

test('integrated direct stove input saves a reset immediately and recovers both inventories on save failure', async () => {
  const f = makeStove(), player = new FakePlayer(f.dimension);
  f.inventory.setItem(0, new FakeItem('minecraft:beef', 2));
  f.inventory.setItem(3, new FakeItem('minecraft:coal'));
  advance(f.service, f.env, 70);
  // A different ingredient fills another lane and resets shared progress.
  player.container.setItem(0, new FakeItem('minecraft:potato', 3));
  const save = f.ctx.saveStation;
  f.ctx.saveStation = () => { throw new Error('unavailable save'); };
  await respondWith([], () => f.service.onInteract(player, f.block));
  assert.equal(player.container.getItem(0).amount, 3);
  assert.equal(f.inventory.getItem(1), undefined);
  assert.equal(f.station.appliance.cookProgress, 70);
  f.ctx.saveStation = save;
  await respondWith([], () => f.service.onInteract(player, f.block));
  assert.equal(player.container.getItem(0), undefined);
  assert.equal(f.inventory.getItem(1).typeId, 'minecraft:potato');
  assert.equal(f.station.appliance.cookProgress, 0);
  assert.equal(f.saved.get(f.station.id).appliance.cookProgress, 0);
});

test('integrated direct controls use the live recipe registry after a supplier joins', async () => {
  const recipes = {}, f = makeStove({ smokingRecipes: recipes });
  const player = new FakePlayer(f.dimension);
  player.container.setItem(0, new FakeItem('supplier:raw', 2));
  await respondWith([{ canceled: true }], () => f.service.onInteract(player, f.block));
  assert.equal(player.container.getItem(0).amount, 2);
  recipes['supplier:raw'] = { output: 'supplier:cooked', count: 2 };
  await respondWith([], () => f.service.onInteract(player, f.block));
  assert.equal(player.container.getItem(0), undefined);
  assert.equal(f.inventory.getItem(0).amount, 2);
});
'''
p.write_text(s)
p=Path('tools/convert_assets.py');s=p.read_text()
s=s.replace('        previous = dest if dest.is_file() else ROOT / "runtime/RP/texts" / (out_name+".lang")\n','        guide_text = (ROOT / "assets/guidebook" / (out_name + ".lang")).read_text(encoding="utf-8")\n        guide_keys = {line.partition("=")[0] for line in guide_text.splitlines() if "=" in line}\n        previous = dest if dest.is_file() else ROOT / "runtime/RP/texts" / (out_name+".lang")\n')
s=s.replace('not in generated_keys]','not in generated_keys | guide_keys]')
s=s.replace('        dest.parent.mkdir(parents=True,exist_ok=True)\n        guide_text = (ROOT / "assets/guidebook" / (out_name + ".lang")).read_text(encoding="utf-8")\n','        dest.parent.mkdir(parents=True,exist_ok=True)\n')
p.write_text(s)
