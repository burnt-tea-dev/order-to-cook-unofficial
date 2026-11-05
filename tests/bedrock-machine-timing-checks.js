// SPDX-License-Identifier: GPL-3.0-only
// Isolated QA: same small world, normal stop/restart. Never import on LIVE.
import { world, system, GameMode } from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import { getQaHooks } from './main.js';
import { getRestaurant, getStation, saveRestaurant, saveStation } from './store.js';
import { MACHINE_TICKS } from './machine_timing.js';
const KEY = 'ordertocook:qa_machine_timing', wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa_machine_timing' || running) return;
  running = true;
  run().catch(error => console.error('OTC_MACHINE_TIME_FATAL ' + error + ' ' + error?.stack));
});
async function run() {
  const h = getQaHooks(), d = world.getDimension('overworld'), raw = world.getDynamicProperty(KEY);
  const saved = raw ? JSON.parse(raw) : undefined, phase = saved ? 'restart' : 'seed', checks = [];
  const check = (name, passed) => {
    checks.push({ name, passed: !!passed }); console.warn('OTC_MACHINE_TIME_CHECK ' + JSON.stringify(checks.at(-1)));
    if (!passed) throw Error(name);
  };
  let player;
  try {
    check('production startup ready', h.ready);
    player = gameTest.spawnSimulatedPlayer({ dimension: d, x: 2.5, y: 5, z: 1.5 }, 'MachineClock21', GameMode.Survival);
    player.setDynamicProperty('ordertocook:welcomed', true);
    const machine = d.getBlock({ x: 0, y: 5, z: 0 });
    if (!saved) {
      d.runCommand('fill -3 4 -3 12 4 8 stone'); d.runCommand('fill -3 5 -3 12 9 8 air');
      machine.setType('ordertocook:order_machine');
      const r = h.getMachine(player, machine), board = d.getBlock({ x: 3, y: 5, z: 0 }); board.setType('ordertocook:board');
      const s = getStation(board); s.ownerId = r.ownerId; s.menu = [{ typeId: 'minecraft:bread', nutrition: 5 }]; saveStation(s);
      r.config.refreshMs = 3000; r.savedTimingMetadata = { owner: r.ownerId, note: 'preserve' };
      r.active = true; h.syncMenu(r); saveRestaurant(r);
      await wait(15);
      check('native block callbacks advance active machine progress', h.machineTiming.remaining(r) > 0 && h.machineTiming.remaining(r) < 60);
      r.active = false; saveRestaurant(r);
      const remaining = h.machineTiming.remaining(r), total = world.getDynamicProperty(MACHINE_TICKS + r.id);
      await wait(20);
      check('native callbacks while closed do not consume saved progress', h.machineTiming.remaining(r) === remaining && world.getDynamicProperty(MACHINE_TICKS + r.id) === total);
      check('runtime no longer retains wall refresh or arrival deadlines', r.nextRefreshAt === undefined && r.nextWalkInAt === undefined);
      world.setDynamicProperty(KEY, JSON.stringify({ id: r.id, remaining, total, sequence: r.orderSequence, metadata: r.savedTimingMetadata, wall: Date.now() }));
    } else {
      const r = getRestaurant(saved.id);
      check('same world retains progress counter and refresh origin after offline wall time', Date.now() - saved.wall > 3000 && world.getDynamicProperty(MACHINE_TICKS + r.id) === saved.total && h.machineTiming.remaining(r) === saved.remaining);
      check('restaurant metadata survives clock persistence', JSON.stringify(r.savedTimingMetadata) === JSON.stringify(saved.metadata));
      r.active = true; saveRestaurant(r); h.tickRestaurants();
      check('opening after restart does not immediately catch up offline refreshes', r.orderSequence === saved.sequence);
      for (let i = 0; i < 100 && r.orderSequence === saved.sequence; i++) await wait(1);
      check('remaining native callbacks generate exactly one configured refresh', r.orderSequence === saved.sequence + 1 && h.machineTiming.remaining(r) > 0);
      r.config.refreshMs = 600000; saveRestaurant(r);
      d.runCommand('tickingarea add circle 4096 5 4096 1 otc_machine_far true');
      player.teleport({ x: 4096.5, y: 5, z: 4096.5 }, { dimension: d });
      d.runCommand('tickingarea remove otc_machine_warm');
      await wait(100);
      const stopped = world.getDynamicProperty(MACHINE_TICKS + r.id);
      await wait(60);
      check('actual machine region stop freezes its persisted active-block counter', world.getDynamicProperty(MACHINE_TICKS + r.id) === stopped);
      d.runCommand('tickingarea add circle 0 5 0 2 otc_machine_warm true');
      player.teleport({ x: 2.5, y: 5, z: 1.5 }, { dimension: d });
      for (let i = 0; i < 30 && world.getDynamicProperty(MACHINE_TICKS + r.id) === stopped; i++) await wait(1);
      check('reloaded region resumes a few native callbacks without catchup', world.getDynamicProperty(MACHINE_TICKS + r.id) > stopped && world.getDynamicProperty(MACHINE_TICKS + r.id) < stopped + 30);
      d.runCommand('tickingarea remove otc_machine_far');
      world.setDynamicProperty(KEY, undefined);
    }
  } finally { try { player?.disconnect(); } catch {} await wait(3); }
  console.warn('OTC_MACHINE_TIME_RESULT ' + JSON.stringify({ passed: true, phase, checks, playersAfter: world.getAllPlayers().length,
    scope: 'Native block callback persistence/pause, same-world restart and real region stop/resume. Short QA refresh interval only. No client visual or LIVE verdict.' }));
}
