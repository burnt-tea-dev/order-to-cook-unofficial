// SPDX-License-Identifier: GPL-3.0-only
import { ItemTypes } from '@minecraft/server';
import { normalizeFoodIdentity } from './senluo_food.js';

/** Compose client text without turning translation components into strings. */
export function message(...parts) {
  return { rawtext: parts.map(part => typeof part === 'object' ? part : { text: String(part) }) };
}

export function translate(key, ...args) {
  return { translate: key, ...(args.length ? { with: message(...args) } : {}) };
}

export function joinMessages(parts, separator = '\n') {
  return message(...parts.flatMap((part, index) => index ? [separator, part] : [part]));
}

/** Resolve the actual item key, including vanilla's non-ID-shaped keys.
 * Saved labels remain a fallback for items whose producer is no longer loaded;
 * they must not fix every viewer to the language used when a menu was saved.
 */
export function menuFoodText(food) {
  const nativeKey = ItemTypes.get(food.typeId)?.localizationKey;
  // Only our explicit display-key contract wraps a plain translation key.
  // Unknown addon keys and vanilla's irregular keys are used exactly as given.
  const prefix = 'senluo.tooltip.';
  const key = nativeKey?.startsWith(prefix) ? nativeKey.slice(prefix.length) : nativeKey;
  const name = key ? translate(key) : message(food.label || food.typeId);
  const identity = normalizeFoodIdentity(food.foodIdentity);
  return identity ? message(name, ' · ', translate('otc.food.variant', identity.nativeVariant)) : name;
}

export function foodAmountText(food) {
  return message(menuFoodText(food), ` ×${food.amount}`);
}
