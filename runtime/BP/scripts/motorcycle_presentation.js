// SPDX-License-Identifier: GPL-3.0-only
// Source-backed third-person base pose only; no input or physics inference.
const MOTORCYCLE = "ordertocook:motorcycle";
const ANIMATION = "animation.ordertocook.player.motorcycle_idle";
const CONTROLLER = "ordertocook_motorcycle_idle";

/** Own only transient animation sessions; inventory and movement stay native. */
export function createMotorcyclePresentation() {
  /** @type {Map<string, {player: import('@minecraft/server').Player, bikeId: string}>} */
  const sessions = new Map();

  /** @param {import('@minecraft/server').Player} player */
  function motorcycle(player) {
    try {
      if (!player?.isValid) return undefined;
      const bike = player.getComponent("minecraft:riding")?.entityRidingOn;
      return bike?.isValid && bike.typeId === MOTORCYCLE ? bike : undefined;
    } catch { return undefined; }
  }

  /** @param {import('@minecraft/server').Player} player
   * @param {boolean} [restart] A confirmed new mount can follow native stop
   * before the next five-tick session cleanup, even on the same motorcycle.
   */
  function start(player, restart = false) {
    const bike = motorcycle(player);
    if (!bike || (!restart && sessions.get(player.id)?.bikeId === bike.id)) return;
    try {
      player.playAnimation(ANIMATION, {
        controller: CONTROLLER,
        blendOutTime: 0.1,
        stopExpression: "!query.is_riding_any_entity_of_type('ordertocook:motorcycle')",
      });
      sessions.set(player.id, { player, bikeId: bike.id });
    } catch { /* A cosmetic failure must not reject a successful mount. */ }
  }

  /** @param {string} id */
  function stop(id) {
    const session = sessions.get(id);
    sessions.delete(id);
    if (!session) return;
    try {
      if (session.player.isValid) session.player.playAnimation(`${ANIMATION}_stop`, {
        controller: CONTROLLER, blendOutTime: 0.1,
      });
    } catch { /* The native mount gate also disables the pose after dismount. */ }
  }

  // Reuse the entity service's five-tick maintenance. No world/player scan,
  // saved registry, new interval, velocity integration or per-tick pose replay.
  function tick() {
    for (const [id, session] of sessions) {
      if (motorcycle(session.player)?.id !== session.bikeId) stop(id);
    }
  }

  return { start, stop, tick };
}
