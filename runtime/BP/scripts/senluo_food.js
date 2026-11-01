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
    if (typeof stack?.getRawLore !== 'function') return { status: 'unsupported' };
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
  if (current.status === 'unsupported') return true; // Explicit legacy capability fallback.
  return current.status !== 'unreadable' && current.signature === snapshot.signature;
}
