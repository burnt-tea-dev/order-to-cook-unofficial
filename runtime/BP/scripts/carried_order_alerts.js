// SPDX-License-Identifier: GPL-3.0-only
// Java OrderItem/TakeoutBagItem inventoryTick, observed on the existing 20-tick
// adapter pass. This service only writes full carried stacks, never order state.
import { adoptOrderDeadline, orderCarrier } from './core.js';

const P = 'ordertocook:';
const PAPER = P + 'order', BAG = P + 'takeout_bag';
const RESTAURANT = P + 'restaurant', ORDER = P + 'order_id', PROOF = P + 'proof';
const TICK = P + 'expires_tick', WALL = P + 'expires_at';
export const ITEM_CUSTOMER_NAME = P + 'customer_name';
const FLAGS = [P + 'expiry_warned_5m', P + 'expiry_warned_1m', P + 'expiry_expired_notified'];
const MESSAGES = ['message.ordertocook.order_expiring_soon_5', 'message.ordertocook.order_expiring_soon_1', 'message.ordertocook.order_expired_named'];
const validTick = value => Number.isSafeInteger(value) && value >= 0;
const validId = value => typeof value === 'string' && value.length > 0;
const validName = value => typeof value === 'string' && value.length <= 128 && value.trim().length > 0;

/** A small display snapshot, never lore or a replacement for canonical identity. */
export function alertCustomerName(value) {
  if (typeof value !== 'string') return undefined;
  const name = value.slice(0, 128).replace(/[\uD800-\uDBFF]$/, '');
  return validName(name) ? name : undefined;
}

/** First observation in a later band does not backfill earlier notices. */
export function deadlineAlert(remainingTicks) {
  if (!Number.isFinite(remainingTicks)) return undefined;
  return remainingTicks <= 0 ? 2 : remainingTicks <= 1200 ? 1 : remainingTicks <= 6000 ? 0 : undefined;
}

function inspect(stack, getRestaurant, linkedOrders, time) {
  if (![PAPER, BAG].includes(stack?.typeId) || stack.amount !== 1) return undefined;
  const restaurantId = stack.getDynamicProperty(RESTAURANT), orderId = stack.getDynamicProperty(ORDER);
  if (!validId(restaurantId) || !validId(orderId)) return undefined;
  const restaurant = getRestaurant(restaurantId);
  if (restaurant?.removing) return undefined;
  // Ephemeral for this pass only. Retained live records have no schema limit;
  // scan each referenced restaurant once, never all world restaurants. No cache
  // survives a save/rollback, pruning, array replacement or the next pass.
  let orders;
  if (restaurant) {
    if (!Array.isArray(restaurant.orders)) return undefined;
    if (linkedOrders.has(restaurant)) {
      orders = linkedOrders.get(restaurant);
      if (!orders) return undefined;
    } else {
      // A failed traversal is also remembered for this pass, so another item
      // cannot immediately retry the same unavailable record. Next pass retries.
      linkedOrders.set(restaurant, undefined);
      orders = new Map();
      for (const value of restaurant.orders) if (value && !orders.has(value.id)) orders.set(value.id, value);
      linkedOrders.set(restaurant, orders);
    }
  }
  const order = orders?.get(orderId);
  const proof = stack.getDynamicProperty(PROOF);
  if (order) {
    if (proof !== order.proof) return undefined;
    if (stack.typeId === PAPER) {
      // Packed-work reprints are informational, not another active paper task.
      if (!['accepted', 'expired'].includes(order.status) || order.acceptedAt === undefined || order.packedAt !== undefined || order.carrier !== undefined) return undefined;
    } else if (!['packed', 'expired'].includes(order.status) || orderCarrier(order) !== 'bag' || order.packedAt === undefined) return undefined;
  } else if (stack.typeId === PAPER || !validId(proof)) return undefined;

  const flags = FLAGS.map(key => stack.getDynamicProperty(key));
  if (flags.some(value => value !== undefined && typeof value !== 'boolean')) return undefined;
  let tick = stack.getDynamicProperty(TICK);
  const legacy = tick === undefined;
  if (legacy) {
    if (order?.expiresTick !== undefined) tick = order.expiresTick;
    else {
      const expiry = stack.getDynamicProperty(WALL) ?? order?.expiresAt;
      if (!validTick(expiry)) return undefined;
      // Reuse the existing one-time compatibility conversion on a temporary
      // object, not the canonical record. A failed item commit adopts nothing.
      const deadline = { expiresAt: expiry, expiresTick: undefined };
      adoptOrderDeadline(deadline, time);
      tick = deadline.expiresTick;
    }
  }
  if (!validTick(tick) || (order?.expiresTick !== undefined && tick !== order.expiresTick)) return undefined;
  if (order?.status === 'expired' && tick > time.tick) return undefined;
  const severity = deadlineAlert(tick - time.tick);
  const warn = severity !== undefined && flags[severity] !== true;
  if (!legacy && !warn) return undefined;
  const savedName = stack.getDynamicProperty(ITEM_CUSTOMER_NAME);
  const name = validName(savedName) ? savedName : alertCustomerName(order?.customerName);
  return { tick, legacy, severity, warn, name };
}

/** At most 36 ordinary slots per player/pass. Each changed slot is committed
 * once, preserving the native stack and all unknown metadata. Native IO may
 * throw: skip that slot and retry only at the next bounded pass. No rollback
 * rewrite is attempted because an uncertain native write must not replace it.
 */
export function tickCarriedOrderAlerts(players, time, getRestaurant) {
  if (!validTick(time.tick)) return;
  const linkedOrders = new Map();
  for (const player of players) {
    try {
      if (!player?.isValid) continue;
      const container = player.getComponent('minecraft:inventory')?.container;
      if (!container?.isValid || !Number.isSafeInteger(container.size) || container.size < 0) continue;
      const slots = Math.min(36, container.size);
      for (let slot = 0; slot < slots; slot++) {
        try {
          const stack = container.getItem(slot);
          const alert = inspect(stack, getRestaurant, linkedOrders, time);
          if (!alert) continue;
          if (alert.legacy) stack.setDynamicProperty(TICK, alert.tick);
          if (alert.warn) stack.setDynamicProperty(FLAGS[alert.severity], true);
          container.setItem(slot, stack);
          if (alert.warn) {
            // Mark before sending to avoid routine replay. Item persistence and
            // chat are not atomic: a failed send/crash can lose the notification.
            player.sendMessage({ rawtext: [
              { text: alert.severity === 0 ? '§e' : '§c' },
              { translate: MESSAGES[alert.severity], with: { rawtext: [alert.name
                ? { text: alert.name } : { translate: 'keyword.ordertocook.customer' }] } },
              { text: '§r' }
            ] });
          }
        } catch { /* No rollback/replacement; inspect persisted flags next pass. */ }
      }
    } catch { /* Player/container unloaded; do not prevent other players' checks. */ }
  }
}
