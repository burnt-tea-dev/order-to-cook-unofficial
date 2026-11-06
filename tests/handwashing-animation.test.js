// SPDX-License-Identifier: GPL-3.0-only
// The shipped appliance service owns the session. Native IO doubles only record
// its actual requests; these checks do not certify a client-rendered pose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appliances, FakeItem, FakePlayer, makeEnvironment, place, advance } from './appliances.harness.js';

function fixture() {
  const env = makeEnvironment(), player = new FakePlayer(env.dimension);
  const service = appliances.createApplianceService(env.ctx), block = place(env, 'ordertocook:washingtable');
  service.onPlace(block); player.container.setItem(0, new FakeItem('ordertocook:dirty_plate'));
  service.onInteract(player, block); player.viewedBlock = block;
  return { ...env, player, service, block };
}
const names = player => player.animations.map(row => row.name);
const START = 'animation.ordertocook.player.handwash', FP = START + '_first_person', STOP = START + '_stop';
const STARTS = [START, FP], FINISHED = [START, FP, STOP, STOP];
const clips = Object.assign({}, ...['handwashing', 'chair_clap'].map(name =>
  JSON.parse(readFileSync(new URL(`../runtime/RP/animations/${name}_player.animation.json`, import.meta.url))).animations));
const requests = JSON.parse(readFileSync(new URL('../player-presentation.json', import.meta.url))).first_person_arm_requests;

// The emitted request expressions use the shared JS/Molang boolean-assignment
// subset. Execute those actual expressions; this is not a native Molang or
// same-frame render-order test.
const evaluateBlend = (name, query, variable) => new Function('query', 'variable', clips[name].blend_weight)(query, variable);
const checkedVariables = initial => new Proxy(initial, {
  get(target, key) { assert.ok(key in target, `read before assignment: ${key}`); return target[key]; }
});

test('first-person pose and shared request use the same bounded empty-hand gate', () => {
  for (const [overrides, requested, blend] of [
    [{}, true, true], [{ time: 3.99 }, true, true],
    [{ first: 0 }, false, false], [{ vr: 1 }, false, false],
    [{ ui: 1 }, false, false], [{ main: 1 }, false, false], [{ off: 1 }, false, false],
    [{ time: -0.01 }, false, false], [{ time: 4 }, false, false], [{ time: 4.01 }, false, false]
  ]) {
    const state = { first: 1, vr: 0, ui: 0, main: 0, off: 0, time: 0, ...overrides };
    const variable = checkedVariables({ is_using_vr: state.vr });
    const query = { is_first_person: state.first, is_in_ui: state.ui, anim_time: state.time,
      is_item_equipped: hand => {
        assert.equal(state.ui, 0, 'UI previews must not inspect a gameplay inventory');
        assert.ok(['main_hand', 'off_hand'].includes(hand), hand);
        return hand === 'main_hand' ? state.main : state.off;
      } };
    assert.equal(Boolean(evaluateBlend(FP, query, variable)), blend, JSON.stringify(overrides));
    assert.equal(Boolean(variable.senluo_fp_left_arm_request), requested, JSON.stringify(overrides));
  }
});

test('the existing replacement-stop clip clears a previous or initially missing shared request', () => {
  for (const initial of [{}, { senluo_fp_left_arm_request: 1 }]) {
    const variable = checkedVariables(initial);
    assert.equal(evaluateBlend(STOP, {}, variable), 1);
    assert.equal(variable.senluo_fp_left_arm_request, 0);
  }
});

test('clap camera gate is bounded independently from its gameplay session', () => {
  const request = requests.chair_clap.replace('variable.', '');
  for (const [overrides, expected] of [[{}, true], [{ time: 2.99 }, true], [{ time: 3 }, false],
    [{ first: 0 }, false], [{ vr: 1 }, false], [{ ui: 1 }, false], [{ main: 1 }, false], [{ off: 1 }, false]]) {
    const state = { first: 1, vr: 0, ui: 0, main: 0, off: 0, time: 0, ...overrides };
    const variable = checkedVariables({ is_using_vr: state.vr });
    const query = { is_first_person: state.first, is_in_ui: state.ui, anim_time: state.time,
      is_item_equipped: hand => {
        assert.equal(state.ui, 0, 'UI previews must not inspect a gameplay inventory');
        return hand === 'main_hand' ? state.main : state.off;
      } };
    assert.equal(Boolean(evaluateBlend('animation.ordertocook.player.chair_clap_first_person', query, variable)), expected);
    assert.equal(Boolean(variable[request]), expected);
  }
});

test('stopping either action clears only its own actual request producer', () => {
  const wash = requests.handwash.replace('variable.', ''), clap = requests.chair_clap.replace('variable.', '');
  const query = { is_first_person: 1, is_in_ui: 0, anim_time: 1, is_item_equipped: () => 0 };
  const variable = checkedVariables({ is_using_vr: 0 });
  evaluateBlend(FP, query, variable);
  evaluateBlend('animation.ordertocook.player.chair_clap_first_person', query, variable);
  evaluateBlend('animation.ordertocook.player.chair_clap_stop', {}, variable);
  assert.equal(Boolean(variable[wash]), true); assert.equal(variable[clap], 0);
  evaluateBlend('animation.ordertocook.player.chair_clap_first_person', query, variable);
  evaluateBlend(STOP, {}, variable);
  assert.equal(variable[wash], 0); assert.equal(Boolean(variable[clap]), true);
});

test('washing starts synchronized bounded perspectives and stops both controllers after 80 ticks', () => {
  const env = fixture(); env.service.onInteract(env.player, env.block);
  assert.deepEqual(names(env.player), STARTS);
  assert.equal(env.player.animations[0].options.controller, 'ordertocook_handwash');
  advance(env.service, env, 79); assert.deepEqual(names(env.player), STARTS);
  advance(env.service, env, 1); assert.deepEqual(names(env.player), FINISHED);
  assert.equal(env.player.animations[2].options.controller, env.player.animations[0].options.controller);
  assert.equal(env.player.container.getItem(0).typeId, 'ordertocook:clean_plate');
  assert.equal(env.player.animations[3].options.controller, env.player.animations[1].options.controller);
  assert.notEqual(env.player.animations[0].options.controller, env.player.animations[1].options.controller);
  advance(env.service, env, 80); assert.deepEqual(names(env.player), FINISHED);
});

test('all existing cancellation paths stop the visual without issuing a clean plate', () => {
  for (const reason of ['look', 'item', 'permission', 'click', 'break', 'empty', 'leave', 'ride']) {
    const env = fixture(); let allowed = true; env.ctx.canUseStation = () => allowed;
    env.service.init(); env.service.onInteract(env.player, env.block); advance(env.service, env, 20);
    if (reason === 'look') env.player.viewedBlock = undefined;
    if (reason === 'item') env.player.container.setItem(0, new FakeItem('minecraft:stick'));
    if (reason === 'permission') allowed = false;
    if (reason === 'click') env.service.onInteract(env.player, env.block);
    if (reason === 'break') env.service.onBreak(env.block, env.ctx.getStation(env.block), env.block.permutation);
    if (reason === 'empty') env.ctx.getStation(env.block).appliance.plates = 0;
    if (reason === 'leave') for (const callback of env.world.afterEvents.playerLeave.subscriptions) callback({ playerId: env.player.id });
    if (reason === 'ride') env.player.riding = env.dimension.spawnEntity('ordertocook:seat', env.player.location);
    advance(env.service, env, 100);
    assert.deepEqual(names(env.player), FINISHED, reason);
    assert.equal(env.player.container.slots.some(item => item?.typeId === 'ordertocook:clean_plate'), false, reason);
  }
});

test('Java chair and motorcycle restrictions prevent starting the wash animation', () => {
  for (const mount of ['ordertocook:seat', 'ordertocook:motorcycle']) {
    const env = fixture(); env.player.riding = env.dimension.spawnEntity(mount, env.player.location);
    env.service.onInteract(env.player, env.block); advance(env.service, env, 100);
    assert.deepEqual(names(env.player), []);
    assert.equal(env.ctx.getStation(env.block).appliance.plates, 1);
  }
});

test('native animation failures cannot cancel washing or change its plate result', () => {
  for (const fail of [{ name: START, controller: 'ordertocook_handwash' },
                     { name: FP, controller: 'ordertocook_handwash_first_person' },
                     { name: STOP, controller: 'ordertocook_handwash' },
                     { name: STOP, controller: 'ordertocook_handwash_first_person' }]) {
    const env = fixture(), original = env.player.playAnimation.bind(env.player);
    env.player.playAnimation = (name, options) => {
      if (name === fail.name && options.controller === fail.controller) throw Error('native animation unavailable');
      original(name, options);
    };
    env.service.onInteract(env.player, env.block); advance(env.service, env, 80);
    assert.equal(env.player.container.getItem(0).typeId, 'ordertocook:clean_plate');
    assert.equal(env.ctx.getStation(env.block).appliance.plates, 0);
    if (fail.name === START) assert.equal(names(env.player).includes(FP), true);
    if (fail.name === FP) assert.equal(names(env.player).includes(START), true);
    if (fail.name === STOP) {
      const stops = env.player.animations.filter(row => row.name === STOP);
      assert.equal(stops.length, 1);
      assert.notEqual(stops[0].options.controller, fail.controller);
    }
  }
});
