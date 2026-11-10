// SPDX-License-Identifier: GPL-3.0-only
// Exercise shipped order transactions and their visible native block states.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mainFixture, configure } from './main.harness.js';

const state = machine => [machine.permutation.getState('ordertocook:mode'), machine.permutation.getState('ordertocook:frame')];
async function fixture() {
  const env = await mainFixture();
  configure(env, { deliveryRate: 0 }, 'server');
  return env;
}

test('a machine refresh raises paper for one second, holds through Java PRINTING, and never loops', async () => {
  const f = await fixture();
  f.system.currentTick = 100;
  f.hooks.refreshMachineOrders(f.restaurant, f.machine);
  assert.deepEqual(state(f.machine), ['printing', 0]);
  assert.equal(f.dimension.sounds.filter(id => id === 'ordertocook:order_refresh').length, 1);
  f.system.currentTick = 110; f.hooks.tickPrinters();
  assert.deepEqual(state(f.machine), ['printing', 7]);
  f.system.currentTick = 120; f.hooks.tickPrinters();
  assert.deepEqual(state(f.machine), ['printing', 15]);
  f.system.currentTick = 144; f.hooks.tickPrinters();
  assert.deepEqual(state(f.machine), ['printing', 15]);
  f.system.currentTick = 146; f.hooks.tickPrinters();
  assert.deepEqual(state(f.machine), ['waiting', 0]);
  f.system.currentTick = 500; f.hooks.syncPrinter(f.restaurant);
  assert.deepEqual(state(f.machine), ['waiting', 0]);
  assert.equal(f.dimension.sounds.filter(id => id === 'ordertocook:order_refresh').length, 1);
});

test('accepting a machine offer hides its paper immediately even with a walk-in offer left', async () => {
  const f = await fixture();
  f.hooks.refreshMachineOrders(f.restaurant, f.machine);
  const offer = f.restaurant.orders.find(order => order.status === 'offered' && !order.walkIn);
  const walkIn = f.core.generateWalkInOrder(f.restaurant);
  f.system.currentTick = 8; f.hooks.tickPrinters();
  assert.equal(state(f.machine)[0], 'printing');
  f.hooks.acceptWithTicket(f.player, f.restaurant, offer);
  assert.equal(offer.status, 'accepted');
  assert.equal(walkIn.status, 'offered');
  assert.deepEqual(state(f.machine), ['idle', 0]);
  f.system.currentTick = 30; f.hooks.tickPrinters();
  assert.deepEqual(state(f.machine), ['idle', 0]);
});

test('restored offers hold their terminal pose and unloaded printing does not restart', async () => {
  const f = await fixture();
  f.core.refreshOrders(f.restaurant);
  f.hooks.syncPrinter(f.restaurant);
  assert.deepEqual(state(f.machine), ['waiting', 0]);
  assert.equal(f.dimension.sounds.filter(id => id === 'ordertocook:order_refresh').length, 0);
  f.hooks.refreshMachineOrders(f.restaurant, f.machine);
  f.machine.setType('minecraft:air');
  f.system.currentTick = 100; f.hooks.tickPrinters();
  f.machine.setType('ordertocook:order_machine');
  f.hooks.syncPrinter(f.restaurant);
  assert.deepEqual(state(f.machine), ['waiting', 0]);
});
