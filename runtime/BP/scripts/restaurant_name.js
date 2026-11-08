// SPDX-License-Identifier: GPL-3.0-only
// Display names survive legacy load unchanged. The marker represents CURRENT
// empty/custom state, not whether this restaurant was ever renamed.
export function defaultRestaurantName(ownerName) { return `${ownerName} 的餐廳`; }
export function restaurantNameIsDefault(record) {
  if (typeof record?.name !== 'string' || typeof record?.ownerName !== 'string') throw Error('Invalid restaurant name data');
  if (Object.hasOwn(record, 'nameIsDefault')) {
    if (typeof record.nameIsDefault !== 'boolean') throw Error('Invalid restaurant naming marker; saved data retained');
    return record.nameIsDefault;
  }
  // Old saves cannot distinguish a custom name deliberately identical to the
  // generated default. Use the saved owner, never the current viewer/placer.
  return record.name === '' || record.name === defaultRestaurantName(record.ownerName);
}
export function sanitizeRestaurantName(value) {
  if (typeof value !== 'string') return undefined;
  return value.replace(/§./g, '').trim().slice(0, 32);
}
