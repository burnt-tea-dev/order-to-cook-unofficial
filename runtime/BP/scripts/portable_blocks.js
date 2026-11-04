// SPDX-License-Identifier: GPL-3.0-only
// Only durable device data travels with an item. Orders and customer anchors
// belong to the placed world record and must never be cloned by moving a shop.
import { normalizeMenu, STAT_KEYS } from './core.js';

const DATA = 'ordertocook:block_data';
const MACHINE_FIELDS = ['name', 'ownerId', 'ownerName', 'staff', 'level', 'stats', 'orderSequence', 'createdAt'];

export function writePortableBlock(stack, record) {
  const data = stack.typeId === 'ordertocook:order_machine'
    ? Object.fromEntries(MACHINE_FIELDS.filter(key => record[key] !== undefined).map(key => [key, record[key]]))
    : { menu: record.menu, initialized: record.initialized === true };
  const json = JSON.stringify({ version: 1, typeId: stack.typeId, data });
  // A full 150-dish menu can exceed one native 32 KiB string. Item properties
  // travel together with the stack; no world-side per-item registry is needed.
  const parts = []; let part = '', bytes = 0;
  for (const char of json) {
    const code = char.codePointAt(0);
    const size = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + size > 30000) { parts.push(part); part = ''; bytes = 0; }
    part += char; bytes += size;
  }
  parts.push(part);
  stack.setDynamicProperty(DATA, parts.length);
  parts.forEach((value, index) => stack.setDynamicProperty(`${DATA}:${index}`, value));
  return stack;
}

export function readPortableBlock(stack) {
  const count = stack?.getDynamicProperty(DATA);
  if (count === undefined) return undefined;
  if (!Number.isSafeInteger(count) || count < 1 || count > stack.getDynamicPropertyIds().length) throw Error('Invalid portable device data');
  const parts = [];
  for (let index = 0; index < count; index++) {
    const part = stack.getDynamicProperty(`${DATA}:${index}`);
    if (typeof part !== 'string') throw Error('Missing portable device data');
    parts.push(part);
  }
  const value = JSON.parse(parts.join(''));
  if (value?.version !== 1 || value.typeId !== stack.typeId || !value.data || typeof value.data !== 'object' || Array.isArray(value.data)) throw Error('Invalid portable device data');
  const data = value.data;
  if (stack.typeId === 'ordertocook:board') {
    if (!Array.isArray(data.menu) || data.menu.length > 150 || typeof data.initialized !== 'boolean') throw Error('Invalid portable menu');
    const menu = normalizeMenu(data.menu);
    if (menu.length !== data.menu.length) throw Error('Invalid portable menu entries');
    return { menu, initialized: data.initialized };
  }
  if (stack.typeId !== 'ordertocook:order_machine' || Object.keys(data).some(key => !MACHINE_FIELDS.includes(key)) ||
      typeof data.name !== 'string' || typeof data.ownerId !== 'string' || typeof data.ownerName !== 'string' ||
      !Array.isArray(data.staff) || data.staff.some(id => typeof id !== 'string') ||
      !Number.isInteger(data.level) || data.level < 0 || data.level > 8 || !data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats) ||
      Object.keys(data.stats).length !== STAT_KEYS.length || STAT_KEYS.some(key => !Number.isSafeInteger(data.stats[key]) || data.stats[key] < 0) ||
      !Number.isSafeInteger(data.createdAt) || data.createdAt < 0 || !Number.isSafeInteger(data.orderSequence) || data.orderSequence < 0) throw Error('Invalid portable restaurant');
  return data;
}
