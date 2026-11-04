// SPDX-License-Identifier: GPL-3.0-only
// Optional food declarations. This catalog never creates items or changes saves.
import { SENLUO_FOODS, SENLUO_UNSUPPORTED_IDS } from './senluo_food_catalog.js';
import { SENLUO_DRINKS } from './senluo_drink_catalog.js';
import { inspectSenluoFood, normalizeFoodIdentity, normalizeFoodAliases, menuFoodKey } from './senluo_food.js';

export const FOOD_CATALOG_EVENT = 'ordertocook:food_catalog_v1';
export const FOOD_CATALOG_REQUEST = 'ordertocook:food_catalog_request_v1';

function indexFoods(foods) {
  const index = new Map();
  for (const food of foods) {
    for (const id of [food.typeId, ...(food.aliases || [])]) {
      const variants = index.get(id) || new Map();
      for (const previous of variants.values()) {
        if (previous.typeId !== food.typeId) throw new Error(`Conflicting food alias: ${id}`);
      }
      variants.set(food.foodIdentity?.nativeVariant, food);
      index.set(id, variants);
    }
  }
  return index;
}

function providerFood(entry, namespace) {
  if (!entry || typeof entry.typeId !== 'string' || !entry.typeId.startsWith(namespace + ':') ||
      !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(entry.typeId)) throw new Error('Food ID must belong to the provider namespace');
  if (entry.servingKind !== undefined && entry.servingKind !== 'drink') throw new Error('Unknown serving kind');
  const drink = entry.servingKind === 'drink';
  if (!Number.isInteger(entry.nutrition) || entry.nutrition < (drink ? 0 : 1) || entry.nutrition > 10000) throw new Error('Food requires positive nutrition; only declared drinks may use zero');
  const foodIdentity = entry.nativeVariant === undefined ? undefined : normalizeFoodIdentity({
    carrier: 'senluo.public.food.v1', nativeVariant: entry.nativeVariant
  });
  const aliases = normalizeFoodAliases(entry.aliases, entry.typeId);
  if (foodIdentity === null || aliases === null || aliases?.some(id => !id.startsWith(namespace + ':'))) throw new Error('Invalid food variant or alias');
  return {
    typeId: entry.typeId, nutrition: entry.nutrition,
    label: String(entry.label || entry.typeId).slice(0, 100),
    ...(drink ? { servingKind: 'drink' } : {}),
    ...(aliases?.length ? { aliases } : {}), ...(foodIdentity ? { foodIdentity } : {})
  };
}

export function createFoodCatalog() {
  const builtin = indexFoods([...SENLUO_FOODS, ...SENLUO_DRINKS]);
  const unsupported = new Set(SENLUO_UNSUPPORTED_IDS);
  const providers = new Map();
  let supplied = new Map();

  function register(message) {
    if (message?.v !== 1 || typeof message.provider !== 'string' ||
        !/^[a-z0-9_.-]+$/.test(message.provider) || ['minecraft', 'ordertocook'].includes(message.provider) ||
        !Array.isArray(message.foods) || (message.replace !== undefined && typeof message.replace !== 'boolean')) throw new Error('Invalid food catalog V1 message');
    // Batches are upserts, so a large catalog can use several <=2048-character
    // script events. replace:true starts a fresh declaration for this provider.
    const next = message.replace ? new Map() : new Map(providers.get(message.provider));
    for (const entry of message.foods) {
      const food = providerFood(entry, message.provider);
      next.set(menuFoodKey(food), food);
    }
    const all = new Map(providers);
    all.set(message.provider, next);
    const nextIndex = indexFoods([...all.values()].flatMap(entries => [...entries.values()]));
    // An invalid batch leaves the previous working catalog untouched.
    providers.set(message.provider, next);
    supplied = nextIndex;
  }

  function resolve(stack) {
    const variants = supplied.get(stack?.typeId) || builtin.get(stack?.typeId);
    if (!variants) return { known: unsupported.has(stack?.typeId), food: undefined };
    const snapshot = inspectSenluoFood(stack);
    if (snapshot.status === 'unreadable') return { known: true, food: undefined };
    const variant = snapshot.status === 'valid' ? snapshot.state.nativeVariant : undefined;
    const declared = variants.get(variant) || variants.get(undefined);
    if (!declared) return { known: true, food: undefined };
    // Only a declared recipe variant creates a new dish. Incidental heat,
    // quality, seasoning or a forged variant cannot multiply fixed-food entries.
    return { known: true, food: {
      typeId: declared.typeId, nutrition: declared.nutrition, label: declared.label,
      ...(declared.servingKind === 'drink' ? { servingKind: 'drink' } : {}),
      ...(declared.aliases ? { aliases: [...declared.aliases] } : {}),
      ...(declared.foodIdentity ? { foodIdentity: { ...declared.foodIdentity } } : {})
    } };
  }

  function labelFor(typeId) {
    return (supplied.get(typeId) || builtin.get(typeId))?.get(undefined)?.label;
  }
  return { register, resolve, labelFor };
}

/** Subscribe during script loading, before any pack's worldLoad announcement. */
export function connectFoodCatalog(system, catalog) {
  system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id !== FOOD_CATALOG_EVENT || event.sourceType !== 'Server') return;
    try { catalog.register(JSON.parse(event.message)); }
    catch (error) { console.warn(`[OrderToCook] Food catalog rejected: ${error}`); }
  });
  return () => system.run(() => system.sendScriptEvent(FOOD_CATALOG_REQUEST, '{"v":1}'));
}
