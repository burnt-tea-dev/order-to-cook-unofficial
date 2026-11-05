// SPDX-License-Identifier: GPL-3.0-only
// Isolated GameTest only. Native input callbacks and API acceptance do not
// certify a rendered client pose or keyboard/touch/controller input.
import { world, system, GameMode } from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import { getQaHooks } from './main.js';

const wait = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let running = false;
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== 'ordertocook:qa_clap' || running) return;
  running = true;
  run().catch(error => console.error(`OTC_CLAP_FATAL ${String(error)} ${error?.stack || ''}`));
});

async function run() {
  const checks = [], dimension = world.getDimension('overworld'), hooks = getQaHooks();
  const swings = [], hits = [], breaks = [];
  let player, target, finished = false;
  const swing = event => { if (event.player.id === player?.id) swings.push({ tick: system.currentTick, source: event.swingSource }); };
  const hurt = event => { if (event.damageSource.damagingEntity?.id === player?.id) hits.push({ tick: system.currentTick, cancelled: event.cancel }); };
  const mining = event => { if (event.player.id === player?.id) breaks.push({ tick: system.currentTick, cancelled: event.cancel }); };
  function check(name, condition) {
    checks.push({ name, passed: !!condition });
    console.warn(`OTC_CLAP_CHECK ${JSON.stringify(checks.at(-1))}`);
    if (!condition) throw Error(name);
  }
  world.afterEvents.playerSwingStart.subscribe(swing);
  world.beforeEvents.entityHurt.subscribe(hurt);
  world.beforeEvents.playerBreakBlock.subscribe(mining);
  try {
    check('production entry initialized', hooks.ready);
    dimension.runCommand('fill -3 4 -3 4 4 4 stone');
    dimension.runCommand('fill -3 5 -3 4 8 4 air');
    const chair = dimension.getBlock({ x: 0, y: 5, z: 0 }); chair.setType('ordertocook:chair');
    await wait(3);
    player = gameTest.spawnSimulatedPlayer({ dimension, x: 0.5, y: 5, z: 0.5 }, 'OtcClapProbe', GameMode.Survival);
    player.setDynamicProperty('ordertocook:welcomed', true);
    target = dimension.spawnEntity('minecraft:pig', { x: 2.5, y: 5, z: 0.5 });
    check('production chair seats native simulated Player', hooks.entities.sitOnChair(player, chair));
    player.playAnimation('animation.ordertocook.player.chair_clap', { controller: 'ordertocook_chair_clap', blendOutTime: 0.1 });
    player.playAnimation('animation.ordertocook.player.chair_clap_stop', { controller: 'ordertocook_chair_clap', blendOutTime: 0.1 });
    check('native Player accepts bounded clap and replacement stop', true);
    await wait(3);
    const hp = target.getComponent('minecraft:health').currentValue;
    player.attackEntity(target); await wait(3);
    check('native melee reaches cancelled beforeHurt', hits.some(row => row.cancelled));
    check('chair melee does not damage its real target', target.getComponent('minecraft:health').currentValue === hp);
    check('real native callback started canonical clap without duplicate', hooks.entities.clapOnChair(player) === false);
    check('native attack swing was observed', swings.some(row => row.source === 'Attack'));
    await wait(61);
    check('canonical clap accepts a new request after sixty ticks', hooks.entities.clapOnChair(player));
    player.getComponent('minecraft:riding').entityRidingOn.getComponent('minecraft:rideable').ejectRider(player);
    await wait(6);
    check('dismounted Player cannot clap', hooks.entities.clapOnChair(player) === false);
    player.attackEntity(target); await wait(3);
    check('standing melee remains native and deals damage', target.getComponent('minecraft:health').currentValue < hp && hits.some(row => !row.cancelled));
    await wait(12);
    check('same chair can be used again', hooks.entities.sitOnChair(player, chair));
    player.setGameMode(GameMode.Creative);
    const block = dimension.getBlock({ x: 1, y: 5, z: 1 }); block.setType('minecraft:stone');
    player.breakBlock(block.location); await wait(8); player.stopBreakingBlock();
    check('native mining reaches cancelled beforeBreak', breaks.some(row => row.cancelled));
    check('chair mining leaves native block intact', block.typeId === 'minecraft:stone');
    check('native mining started one canonical clap', hooks.entities.clapOnChair(player) === false);
    finished = true;
  } finally {
    world.afterEvents.playerSwingStart.unsubscribe(swing);
    world.beforeEvents.entityHurt.unsubscribe(hurt);
    world.beforeEvents.playerBreakBlock.unsubscribe(mining);
    try { target?.remove(); } catch {}
    try { player?.disconnect(); } catch {}
    await wait(3);
    if (finished) {
      const playersAfter = world.getAllPlayers().length;
      check('simulated Player disconnected', playersAfter === 0);
      console.warn(`OTC_CLAP_RESULT ${JSON.stringify({ passed: true, checks, playersAfter, swings, hits, breaks,
        scope: 'Native simulated Player melee/mining callbacks, own-chair cancellation, three-second lifecycle and playAnimation API acceptance. No rendered pose, first-person or hardware-input verdict.' })}`);
    }
  }
}
