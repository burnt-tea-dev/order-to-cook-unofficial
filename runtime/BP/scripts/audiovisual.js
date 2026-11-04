// SPDX-License-Identifier: GPL-3.0-only
// Event counts, offsets and cue times from OrdertoCook e59e3dbc (Forge 1.20.1).
// Pure cue descriptions keep cosmetic playback separate from inventory/state.
const NS = "ordertocook:";
const FRONT = Object.freeze({ north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] });
const point = (p, y = 0, x = 0, z = 0) => ({ x: p.x + x, y: p.y + y, z: p.z + z });
const center = (p, y = 0.5) => point(p, y, 0.5, 0.5);
const sound = (id, location, volume = 1, pitch = 1) => ({ sound: id, location, volume, pitch });
const burst = (id, location, count, spread = [0, 0, 0], speed = 0) => ({ particle: `${NS}${id}`, location, count, spread, speed });

/** Emit exactly one explicit burst, rather than a vanilla manual-rate emitter. */
export function playEffects(dimension, cues, VariableMap) {
  for (const cue of cues) {
    try {
      if (cue.sound) dimension.playSound(cue.sound, cue.location, { volume: cue.volume, pitch: cue.pitch });
      else {
        const variables = new VariableMap();
        variables.setFloat("variable.count", cue.count);
        variables.setVector3("variable.spread", { x: cue.spread[0], y: cue.spread[1], z: cue.spread[2] });
        // Java packets give blocks/tick; Bedrock particle velocity is blocks/s.
        variables.setFloat("variable.speed", cue.speed * 20);
        dimension.spawnParticle(cue.particle, cue.location, variables);
      }
    } catch { /* A cosmetic API failure must not change item/state accounting. */ }
  }
}

export function plateSound(location, rng = Math.random) {
  return [sound(`${NS}plate_place`, location, 0.75, 0.95 + rng() * 0.1)];
}

export function fridgeDoorEffects(location, half, open) {
  const pitch = open ? (half === "upper" ? 2 : 1.7) : (half === "upper" ? 1.1 : 0.9);
  return [sound(`${NS}${open ? "dishwasher_out" : "dishwasher_in"}`, center(location), 0.35, pitch)];
}

export function dishwasherPreviewEffects(location) {
  return [sound(`${NS}dishwasher_out`, center(location, 0.6), 0.75, 1)];
}

export function dishwasherTakeEffects(location, rng = Math.random) {
  return [...plateSound(center(location), rng), sound(`${NS}dishwasher_in`, center(location), 0.85, 1.05)];
}

/** (before, after] interval; use before=-1 once on entering a phase. */
export function dishwasherTimedEffects(location, facing, phase, plates, before, after, rng = Math.random) {
  const cues = [];
  const crossed = tick => before < tick && after >= tick;
  const sparkle = count => cues.push(burst("sparkle", center(location, 0.85), count, [0.28, 0.22, 0.28], 0.015));
  if (phase === 1 && crossed(0)) sparkle(7);
  if (phase === 2 && crossed(14)) { cues.push(...plateSound(center(location), rng)); sparkle(10); }
  if (phase === 3) {
    const duration = plates > 8 ? 80 : 40;
    for (let tick = 0; tick <= duration; tick += 10) {
      if (!crossed(tick)) continue;
      if (tick === 0 || (plates > 8 && tick === 40)) {
        cues.push(sound(`${NS}dishwasher_washing`, center(location), 0.9)); sparkle(12);
      } else sparkle(4);
    }
  }
  if (phase === 4 && crossed(0)) {
    const [x, z] = FRONT[facing] || FRONT.north;
    const mouth = point(center(location, 0.62), 0, x * 0.56, z * 0.56);
    cues.push(sound(`${NS}dishwasher_clear_out`, center(location), 0.95),
      burst("cloud", mouth, 18, [0.18, 0.15, 0.18], 0.025),
      burst("poof", point(mouth, 0.05), 8, [0.12, 0.1, 0.12], 0.01));
    sparkle(12);
  }
  return cues;
}

/** Java's first half-second cue plus second 1/2/3; none at completion. */
export function washingEffectBeat(elapsedTicks) {
  return elapsedTicks >= 10 && elapsedTicks < 80 ? Math.floor(elapsedTicks / 20) : -1;
}

export function basinPoint(location, facing, x, z) {
  const localX = 3 / 16 + x * 10 / 16, localZ = 3 / 16 + z * 9 / 16;
  const [rx, rz] = facing === "east" ? [1 - localZ, localX] : facing === "south" ? [1 - localX, 1 - localZ]
    : facing === "west" ? [localZ, 1 - localX] : [localX, localZ];
  return point(location, 0.94, rx, rz);
}

export function handwashingEffects(location, facing, rng = Math.random) {
  const cues = [];
  // Upstream evaluates nextInt(6) in the loop condition, rather than choosing
  // one uniformly distributed count for the complete burst.
  for (let i = 0; i < 10 + Math.floor(rng() * 6); i++) {
    const p = basinPoint(location, facing, rng(), rng());
    cues.push(burst("bubble_pop", point(p, rng() * 0.05), 1));
  }
  for (let i = 0; i < 2; i++) cues.push(burst("splash", basinPoint(location, facing, rng(), rng()), 1, [0, 0.01, 0]));
  cues.push(sound("random.splash", center(location), 0.22, 0.9 + rng() * 0.2));
  return cues;
}

export function freshMealEffects(outputLocation) {
  return [burst("cloud", center(outputLocation, 0.35), 6, [0.18, 0.05, 0.18], 0.01)];
}

export function newOrderEffects(location) {
  return [sound(`${NS}order_refresh`, center(location)),
    burst("sparkle", center(location, 0.85), 10, [0.22, 0.18, 0.22], 0.015)];
}

export function customerCompletionEffects(location, rng = Math.random) {
  // Java 1.20.1 entity.villager.celebrate aliases the same yes1/2/3 files as
  // entity.villager.yes. Bedrock has no mob.villager.celebrate event.
  const voices = ["mob.villager.yes", "mob.villager.idle", "mob.villager.yes"];
  return [burst("happy", point(location, 0.5), 30, [0.3, 0.5, 0.3], 0.1),
    sound(voices[Math.floor(rng() * voices.length)], location, 0.9, 0.95 + rng() * 0.1)];
}

export function customerPortalEffects(location) {
  return [sound("mob.endermen.portal", location), burst("portal", point(location, 0.8), 40, [0.35, 0.5, 0.35], 0.2)];
}

export function customerExplosionEffects(location) {
  const p = point(location, 0.8);
  return [sound("random.explode", location), burst("explosion", p, 1), burst("cloud", p, 18, [0.3, 0.4, 0.3], 0.05)];
}

export function customerUnsuccessfulEffects(location) {
  return [sound("random.fizz", location), burst("large_smoke", point(location, 0.5), 20, [0.3, 0.5, 0.3])];
}

export function motorcycleHitEffects(location) {
  // MotorcycleEntity.WIDTH/HEIGHT and the Bedrock collision box are both 1.2.
  const p = point(location, 1.2 * 0.6);
  return [burst("smoke", p, 3, [1.2 * 0.2, 1.2 * 0.1, 1.2 * 0.2], 0.005),
    burst("poof", p, 2, [1.2 * 0.15, 1.2 * 0.08, 1.2 * 0.15], 0.01)];
}
