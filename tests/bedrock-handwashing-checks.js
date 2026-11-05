// SPDX-License-Identifier: GPL-3.0-only
// Isolated QA only. Add @minecraft/server-gametest 1.0.0-beta and the gametest
// experiment to the QA copy; keep production @minecraft/server 2.11.0 unchanged.
// Native Player API acceptance is not client pose/rendering evidence.
import { world, system, ItemStack, GameMode, EquipmentSlot } from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import { getQaHooks } from './main.js';
import { getStation, saveStation } from './store.js';

const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa_handwash' || running) return;
  running = true;
  run().catch(error => console.error(`OTC_HANDWASH_FATAL ${String(error)} ${error?.stack || ''}`)).finally(() => { running = false; });
});

async function run() {
  const checks = [], dimension = world.getDimension('overworld'), hooks = getQaHooks();
  let player, completed = false;
  function check(name, condition) {
    checks.push({ name, passed: !!condition });
    console.warn(`OTC_HANDWASH_CHECK ${JSON.stringify(checks[checks.length - 1])}`);
    if (!condition) throw Error(name);
  }
  try {
    check('production entry initialized', hooks.ready);
    dimension.runCommand('fill -3 4 -3 4 4 4 stone');
    dimension.runCommand('fill -3 5 -3 4 8 4 air');
    const block = dimension.getBlock({ x: 0, y: 5, z: 0 }); block.setType('ordertocook:washingtable');
    await wait(3);
    player = gameTest.spawnSimulatedPlayer({ dimension, x: 2.5, y: 5, z: 0.5 }, 'OtcHandwashProbe', GameMode.Survival);
    player.setDynamicProperty('ordertocook:welcomed', true);
    // This disposable fixture can be rerun after a driver/setup failure. It is
    // not an upgrade/persistence test and owns all of its station contents.
    const station = getStation(block); station.ownerId = player.id; station.appliance.plates = 0; saveStation(station);
    player.selectedSlotIndex = 0;
    const inventory = player.getComponent('minecraft:inventory').container;
    inventory.clearAll(); player.getComponent('minecraft:equippable').setEquipment(EquipmentSlot.Offhand, undefined);
    await wait(3);
    check('native Player exposes playAnimation', player.typeId === 'minecraft:player' && typeof player.playAnimation === 'function');
    // Explicit native calls surface errors that production rightly treats as
    // cosmetic. No wrapper replaces the native Player method in this probe.
    for (const suffix of ['', '_first_person']) {
      player.playAnimation('animation.ordertocook.player.handwash' + suffix, { controller: 'ordertocook_handwash' + suffix, blendOutTime: 0.1 });
      player.playAnimation('animation.ordertocook.player.handwash_stop', { controller: 'ordertocook_handwash' + suffix, blendOutTime: 0.1 });
    }
    check('native Player accepts both perspective start and replacement-stop requests', true);
    inventory.setItem(0, new ItemStack('ordertocook:dirty_plate'));
    hooks.appliances.onInteract(player, block);
    player.lookAtLocation({ x: 0.5, y: 5.8, z: 0.5 }); await wait(3);
    check('native sight ray reaches the sink', player.getBlockFromViewDirection({ maxDistance: 4 })?.block.typeId === 'ordertocook:washingtable');
    hooks.appliances.onInteract(player, block);
    await wait(20);
    check('production wash session remains active', !!hooks.appliances.getWashingProgress(player));
    await wait(65);
    check('production session completes one native plate', getStation(block).appliance.plates === 0 && inventory.getItem(0)?.typeId === 'ordertocook:clean_plate');
    check('completed session leaves no running progress', hooks.appliances.getWashingProgress(player) === undefined);
    inventory.clearAll(); inventory.setItem(0, new ItemStack('ordertocook:dirty_plate'));
    hooks.appliances.onInteract(player, block); hooks.appliances.onInteract(player, block);
    await wait(10); player.lookAtLocation({ x: 20, y: 30, z: 20 });
    await wait(85);
    check('native look-away cancels without issuing a clean plate', getStation(block).appliance.plates === 1 && inventory.emptySlotsCount === inventory.size);
    completed = true;
  } finally {
    try { player?.disconnect(); } catch { /* QA actor already removed. */ }
    await wait(3);
    console.warn(`OTC_HANDWASH_CLEANUP ${JSON.stringify({ playersAfter: world.getAllPlayers().length })}`);
    if (completed) {
      const playersAfter = world.getAllPlayers().length;
      check('QA simulated Player disconnected', playersAfter === 0);
      console.warn(`OTC_HANDWASH_RESULT ${JSON.stringify({ passed: true, checks, playersAfter,
        scope: 'Native simulated Player playAnimation acceptance and adapter-driven wash lifecycle over native inventory/ray. No client geometry, pose, first-person, hardware input or audiovisual verdict.' })}`);
    }
  }
}
