// SPDX-License-Identifier: GPL-3.0-only
// Read-only consumer. The pinned Core SDK owns the V1 schema; it supplies no nutrition.
import { readPublicFoodLore } from './vendor/senluo/food_api_core.js';

const MAX_LORE_ROWS = 20;
const MAX_LORE_CODE_UNITS = 32768;

/**
 * Capture only publicly readable data without changing or reconstructing a stack.
 * Unsupported API is different from an absent carrier. Invalid carriers remain
 * opaque and usable by legacy ID-only orders, provided their raw data is unchanged.
 * @returns {{status: string, signature?: string, state?: any}}
 */
export function inspectSenluoFood(stack) {
  try {
    // Lack of raw lore does not make the independently readable name unavailable.
    // Do not parse translated getLore() text or claim V1 verification in this mode.
    if (typeof stack?.getRawLore !== 'function') return { status: 'unsupported', signature: stack?.nameTag };
    const rows = stack.getRawLore();
    if (!Array.isArray(rows) || rows.length > MAX_LORE_ROWS) return { status: 'unreadable' };
    const raw = JSON.stringify(rows);
    if (raw.length > MAX_LORE_CODE_UNITS) return { status: 'unreadable' };
    // Copy first: a caller cannot mutate a captured snapshot through raw lore references.
    const result = readPublicFoodLore(JSON.parse(raw));
    const signature = JSON.stringify([stack.nameTag ?? null, raw]);
    return {
      status: !result.present ? 'absent' : result.valid ? 'valid' : 'invalid',
      signature,
      ...(result.valid ? { state: result.state } : {})
    };
  } catch {
    // An API/read error must not be mistaken for an empty lore list.
    return { status: 'unreadable' };
  }
}

/** Compare immediately before a planned extraction; never repair foreign data. */
export function matchesSenluoFoodSnapshot(stack, snapshot) {
  if (!snapshot || snapshot.status === 'unreadable') return false;
  const current = inspectSenluoFood(stack);
  if (current.status !== snapshot.status) return false;
  // In unsupported mode this checks the name only, not raw or opaque metadata.
  return current.status !== 'unreadable' && current.signature === snapshot.signature;
}

/** OTC-owned persisted requirement, not a new version of the Core carrier.
 * undefined means a legacy ID-only dish; null means an invalid requirement.
 * Never silently turn malformed variant requirements into generic dishes.
 */
export function normalizeFoodIdentity(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.carrier !== 'senluo.public.food.v1' ||
      !Number.isInteger(value.nativeVariant) || value.nativeVariant < 0 || value.nativeVariant > 32767 ||
      Object.keys(value).some(key => !['carrier', 'nativeVariant'].includes(key))) return null;
  return { carrier: 'senluo.public.food.v1', nativeVariant: value.nativeVariant };
}

/** The V1 carrier supplies identity, not eligibility, nutrition or a price bonus. */
export function snapshotMenuFood(stack, food) {
  const snapshot = inspectSenluoFood(stack);
  if (snapshot.status === 'unreadable') return undefined;
  const variant = snapshot.status === 'valid' ? snapshot.state.nativeVariant : undefined;
  return { ...food, ...(variant === undefined ? {} : {
    foodIdentity: { carrier: 'senluo.public.food.v1', nativeVariant: variant }
  }) };
}

export function menuFoodKey(food) {
  const identity = normalizeFoodIdentity(food?.foodIdentity);
  if (identity === null || typeof food?.typeId !== 'string') return '';
  return JSON.stringify([food.typeId, identity?.nativeVariant ?? null]);
}

/** Generic and specific entries for the same item overlap; do not double-count them. */
export function menuFoodsOverlap(left, right) {
  if (typeof left?.typeId !== 'string' || left.typeId !== right?.typeId) return false;
  const a = normalizeFoodIdentity(left.foodIdentity), b = normalizeFoodIdentity(right.foodIdentity);
  return a !== null && b !== null && (!a || !b || a.nativeVariant === b.nativeVariant);
}

export function matchesFoodIdentity(snapshot, identity) {
  const normalized = normalizeFoodIdentity(identity);
  if (normalized === undefined) return true;
  return normalized !== null && snapshot?.status === 'valid' &&
    snapshot.state?.nativeVariant === normalized.nativeVariant;
}

/** Use the registered/quoted name, not a later global catalog or override value. */
export function menuFoodLabel(food, fallback = '') {
  const name = food.label || fallback || food.typeId;
  const identity = normalizeFoodIdentity(food.foodIdentity);
  return identity ? `${name} · 變體 ${identity.nativeVariant}` : name;
}
