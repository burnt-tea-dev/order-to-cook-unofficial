// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoveControls } from '../runtime/BP/scripts/stove_controls.js';
import { appliances, FakeContainer, FakeItem, FakePlayer, makeEnvironment } from './appliances.harness.js';

function fixture() {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  const station = { id: 'stove' }, stove = new FakeContainer(7);
  const responses = [], forms = [];
  let permitted = true, loaded = true;
  const ctx = {
    getStorage: () => loaded ? stove : undefined,
    isAccessible: () => permitted && loaded,
    playerInventory: who => who.container,
    transferStackToRange: appliances.transferStackToRange,
    fingerprint: appliances.itemFingerprint, itemLabel: appliances.itemLabel,
    isIngredient: stack => ['minecraft:beef', 'minecraft:potato'].includes(stack.typeId),
    isFuel: stack => stack.typeId === 'minecraft:coal',
    notify: (who, message) => who.messages.push(message),
    getProgress: () => ({ cookProgress: 60, litTime: 400 }),
    makeForm() {
      const form = {
        titleText: '', bodyText: '', buttons: [],
        title(text) { this.titleText = text; return this; },
        body(text) { this.bodyText = text; return this; },
        button(text) { this.buttons.push(text); return this; },
        async show(who) {
          forms.push(this);
          const next = responses.shift();
          return typeof next === 'function' ? next(who, this) : next ?? { canceled: true };
        },
      };
      return form;
    },
  };
  const controls = createStoveControls(ctx);
  return { ...env, player, station, stove, responses, forms, controls,
    revoke: () => { permitted = false; }, remove: () => { loaded = false; } };
}

function named(typeId, amount, proof) {
  const stack = new FakeItem(typeId, amount);
  stack.nameTag = '廚師專用'; stack.setLore(['保留原始附加資料']); stack.setDynamicProperty('sample:proof', proof);
  return stack;
}

function total(container, typeId) {
  return Array.from({ length: container.size }, (_, slot) => container.getItem(slot))
    .reduce((sum, stack) => sum + (stack?.typeId === typeId ? stack.amount : 0), 0);
}

test('holding an ingredient or fuel inserts its complete native stack directly without a form', async () => {
  const f = fixture(), food = named('minecraft:beef', 20, 'raw');
  const stored = food.clone(); stored.amount = 50; f.stove.setItem(0, stored);
  f.player.container.setItem(0, food);
  await f.controls.interact(f.player, f.station);
  assert.equal(f.forms.length, 0);
  assert.equal(f.stove.getItem(0).amount, 64); assert.equal(f.stove.getItem(1).amount, 6);
  assert.equal(f.stove.getItem(1).getDynamicProperty('sample:proof'), 'raw');
  assert.equal(f.player.container.getItem(0), undefined);
  const fuel = named('minecraft:coal', 4, 'fuel'); f.player.container.setItem(0, fuel);
  await f.controls.interact(f.player, f.station);
  assert.equal(appliances.itemFingerprint(f.stove.getItem(3)), appliances.itemFingerprint(fuel));
  assert.equal(f.forms.length, 0);
});

test('full ingredient lanes leave held food untouched and never insert into output slots', async () => {
  const f = fixture(), food = named('minecraft:beef', 3, 'keep');
  for (const slot of [0, 1, 2]) f.stove.setItem(slot, new FakeItem('minecraft:potato', 64));
  f.player.container.setItem(0, food);
  await f.controls.interact(f.player, f.station);
  assert.equal(appliances.itemFingerprint(f.player.container.getItem(0)), appliances.itemFingerprint(food));
  assert.equal(f.stove.getItem(4), undefined); assert.equal(f.forms.length, 0);
});

test('one overview click withdraws a slot without a deposit/withdraw submenu', async () => {
  const f = fixture(), food = named('minecraft:cooked_beef', 7, 'finished');
  f.stove.setItem(4, food); f.responses.push({ selection: 4 });
  await f.controls.interact(f.player, f.station);
  assert.equal(f.forms.length, 2); assert.equal(f.forms[0].titleText, f.forms[1].titleText);
  assert.equal(f.forms[0].buttons.length, 11);
  assert.equal(f.stove.getItem(4), undefined);
  assert.equal(appliances.itemFingerprint(f.player.container.getItem(0)), appliances.itemFingerprint(food));
});

test('collect all preserves distinct output metadata and refuses the whole batch when space is insufficient', async () => {
  const f = fixture(), first = named('minecraft:cooked_beef', 3, 'a'), second = named('minecraft:cooked_beef', 5, 'b');
  f.stove.setItem(4, first); f.stove.setItem(5, second);
  for (let slot = 1; slot < f.player.container.size; slot++) f.player.container.setItem(slot, new FakeItem('minecraft:stone', 64));
  f.responses.push({ selection: 7 });
  await f.controls.interact(f.player, f.station);
  assert.equal(total(f.player.container, 'minecraft:cooked_beef'), 0);
  assert.equal(appliances.itemFingerprint(f.stove.getItem(4)), appliances.itemFingerprint(first));
  assert.equal(appliances.itemFingerprint(f.stove.getItem(5)), appliances.itemFingerprint(second));
  f.player.container.setItem(1, undefined); f.responses.push({ selection: 7 });
  await f.controls.interact(f.player, f.station);
  assert.equal(total(f.player.container, 'minecraft:cooked_beef'), 8);
  assert.equal(f.player.container.getItem(0).getDynamicProperty('sample:proof'), 'a');
  assert.equal(f.player.container.getItem(1).getDynamicProperty('sample:proof'), 'b');
  assert.equal(f.stove.getItem(4), undefined); assert.equal(f.stove.getItem(5), undefined);
});

test('batch write failure restores earlier successful transfers as well as the failed output', async () => {
  const f = fixture();
  f.stove.setItem(4, named('minecraft:cooked_beef', 2, 'one'));
  f.stove.setItem(5, named('minecraft:cooked_beef', 3, 'two'));
  const original = [4, 5].map(slot => appliances.itemFingerprint(f.stove.getItem(slot)));
  f.player.container.failNextSlot = 1; f.responses.push({ selection: 7 });
  await f.controls.interact(f.player, f.station);
  assert.equal(f.player.container.emptySlotsCount, f.player.container.size);
  assert.deepEqual([4, 5].map(slot => appliances.itemFingerprint(f.stove.getItem(slot))), original);
});

test('refill shows and moves only fitting whole stacks into their ingredient/fuel roles', async () => {
  const f = fixture(), food = named('minecraft:beef', 4, 'raw'), fuel = named('minecraft:coal', 2, 'fuel');
  f.player.container.setItem(1, food); f.player.container.setItem(2, fuel);
  f.player.container.setItem(3, new FakeItem('minecraft:stone', 10)); f.responses.push({ selection: 8 });
  await f.controls.interact(f.player, f.station);
  assert.match(f.forms[0].buttons[8], /食材 4／燃料 2/);
  assert.equal(appliances.itemFingerprint(f.stove.getItem(0)), appliances.itemFingerprint(food));
  assert.equal(appliances.itemFingerprint(f.stove.getItem(3)), appliances.itemFingerprint(fuel));
  assert.equal(f.player.container.getItem(3).amount, 10); assert.equal(f.stove.getItem(4), undefined);
});

test('cancel, revoked access, or a removed device cannot commit a pending screen action', async () => {
  for (const action of ['cancel', 'revoke', 'remove']) {
    const f = fixture(), food = named('minecraft:cooked_beef', 2, action); f.stove.setItem(4, food);
    f.responses.push(() => {
      if (action === 'revoke') f.revoke();
      if (action === 'remove') f.remove();
      return action === 'cancel' ? { canceled: true } : { selection: 7 };
    });
    await f.controls.interact(f.player, f.station);
    assert.equal(f.player.container.emptySlotsCount, f.player.container.size);
    assert.equal(appliances.itemFingerprint(f.stove.getItem(4)), appliances.itemFingerprint(food));
  }
});

test('changing only metadata while the screen is open invalidates withdrawal and refill', async () => {
  for (const action of ['withdraw', 'refill']) {
    const f = fixture(), source = action === 'withdraw' ? f.stove : f.player.container, slot = action === 'withdraw' ? 4 : 1;
    const item = named(action === 'withdraw' ? 'minecraft:cooked_beef' : 'minecraft:beef', 2, 'before'); source.setItem(slot, item);
    f.responses.push(() => { item.setDynamicProperty('sample:proof', 'after'); source.setItem(slot, item); return { selection: action === 'withdraw' ? 4 : 8 }; });
    await f.controls.interact(f.player, f.station);
    assert.equal(source.getItem(slot).getDynamicProperty('sample:proof'), 'after');
    assert.equal(action === 'withdraw' ? total(f.player.container, item.typeId) : total(f.stove, item.typeId), 0);
  }
});

test('two open screens cannot collect the same output and repeated open by one player is ignored', async () => {
  const f = fixture(), second = new FakePlayer(f.dimension);
  f.stove.setItem(4, named('minecraft:cooked_beef', 6, 'shared'));
  let resolveFirst, resolveSecond;
  f.responses.push(() => new Promise(resolve => { resolveFirst = resolve; }), () => new Promise(resolve => { resolveSecond = resolve; }));
  const first = f.controls.interact(f.player, f.station), other = f.controls.interact(second, f.station);
  await f.controls.interact(f.player, f.station); assert.equal(f.forms.length, 2);
  resolveFirst({ selection: 7 }); await first;
  resolveSecond({ selection: 7 }); await other;
  assert.equal(total(f.player.container, 'minecraft:cooked_beef'), 6);
  assert.equal(total(second.container, 'minecraft:cooked_beef'), 0);
  assert.equal(f.stove.getItem(4), undefined);
});

test('forgetting a disconnected player invalidates the old response without unlocking a newer session', async () => {
  const f = fixture(); f.stove.setItem(4, new FakeItem('minecraft:cooked_beef', 2));
  let resolveOld, resolveNew;
  f.responses.push(() => new Promise(resolve => { resolveOld = resolve; }), () => new Promise(resolve => { resolveNew = resolve; }));
  const old = f.controls.interact(f.player, f.station); f.controls.forgetPlayer(f.player.id);
  const current = f.controls.interact(f.player, f.station);
  resolveOld({ selection: 4 }); await old;
  await f.controls.interact(f.player, f.station); assert.equal(f.forms.length, 2);
  resolveNew({ canceled: true }); await current;
  assert.equal(total(f.player.container, 'minecraft:cooked_beef'), 0); assert.equal(f.stove.getItem(4).amount, 2);
});
