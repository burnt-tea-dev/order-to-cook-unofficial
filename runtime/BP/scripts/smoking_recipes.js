// SPDX-License-Identifier: GPL-3.0-only
// OTC's stove accepts smoking recipes; it is not a replacement for other kitchens.

/** Existing public input/output shorthand, also accepted by ctx.smokingRecipes. */
export const SMOKING_RECIPES = Object.freeze({
  "minecraft:beef": "minecraft:cooked_beef",
  "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton",
  "minecraft:rabbit": "minecraft:cooked_rabbit",
  "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon",
  "minecraft:potato": "minecraft:baked_potato",
  "minecraft:kelp": "minecraft:dried_kelp",
});

/** Reviewed native smoker recipes. Provenance and the 200-tick OTC rule are in docs/STOVE-RECIPES.md. */
export const AUDITED_SMOKING_PROVIDERS = Object.freeze([
  Object.freeze({
    version: 1,
    provider: "kaleidoscope_grilling",
    recipes: Object.freeze([
      Object.freeze({ id: "kaleidoscope_grilling:roasted_chicken_wing", process: "smoking",
        input: "kaleidoscope_grilling:chicken_wing", output: "kaleidoscope_grilling:roasted_chicken_wing", count: 1 }),
      Object.freeze({ id: "kaleidoscope_grilling:roasted_sweet_potato", process: "smoking",
        input: "kaleidoscope_grilling:sweet_potato", output: "kaleidoscope_grilling:roasted_sweet_potato", count: 1 }),
    ]),
  }),
]);

const NAMESPACE = /^[a-z0-9_.-]+$/;
const ITEM_ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
const SNAPSHOT_FIELDS = new Set(["version", "provider", "catalog", "recipes"]);
const RECIPE_FIELDS = new Set(["id", "process", "input", "output", "count"]);

/**
 * One live recipe map, passed directly as ctx.smokingRecipes. Registration replaces
 * one provider/catalog snapshot in place, so already-created stoves see late registration
 * and withdrawal. Only ownership is kept separately; no persisted recipe cache.
 * Call after worldLoad with the native ItemTypes lookup as hasItem.
 * @param {{hasItem: (id: string) => boolean}} options
 */
export function createSmokingRecipeRegistry({ hasItem }) {
  const recipes = Object.fromEntries(Object.entries(SMOKING_RECIPES)
    .map(([input, output]) => [input, Object.freeze({ output, count: 1 })]));
  const owners = new Map();

  function registerProvider(payload) {
    if (!payload || payload.version !== 1 || typeof payload.provider !== "string" ||
        !NAMESPACE.test(payload.provider) || payload.provider === "minecraft" ||
        (payload.catalog !== undefined && (typeof payload.catalog !== "string" || !NAMESPACE.test(payload.catalog))) ||
        !Array.isArray(payload.recipes) || Object.keys(payload).some(key => !SNAPSHOT_FIELDS.has(key))) {
      return { ok: false, reason: "invalid_provider_snapshot" };
    }
    const provider = payload.provider;
    const catalog = payload.catalog ?? "main";
    const ownerKey = `${provider}:${catalog}`;
    const entries = new Map(), ids = new Set();
    for (const recipe of payload.recipes) {
      if (!recipe || typeof recipe !== "object" || Array.isArray(recipe) ||
          Object.keys(recipe).some(key => !RECIPE_FIELDS.has(key)) || recipe.process !== "smoking" ||
          !Number.isInteger(recipe.count) || recipe.count < 1 || recipe.count > 64 ||
          [recipe.id, recipe.input, recipe.output].some(id => typeof id !== "string" || !ITEM_ID.test(id))) {
        return { ok: false, reason: "invalid_smoking_recipe" };
      }
      if (!recipe.id.startsWith(`${provider}:`) || !recipe.input.startsWith(`${provider}:`)) {
        return { ok: false, reason: "foreign_recipe_namespace" };
      }
      if (ids.has(recipe.id) || entries.has(recipe.input)) {
        return { ok: false, reason: "duplicate_recipe_or_input" };
      }
      if (Object.hasOwn(recipes, recipe.input) && owners.get(recipe.input) !== ownerKey) {
        return { ok: false, reason: "recipe_owned_by_another_catalog" };
      }
      if (!hasItem(recipe.input) || !hasItem(recipe.output)) {
        return { ok: false, reason: "unavailable_recipe_item" };
      }
      ids.add(recipe.id);
      entries.set(recipe.input, Object.freeze({ output: recipe.output, count: recipe.count }));
    }
    // Validate the complete replacement first. An invalid snapshot leaves all
    // recipes already in use intact; [] deliberately withdraws only this catalog.
    for (const [input, owner] of owners) {
      if (owner !== ownerKey) continue;
      delete recipes[input];
      owners.delete(input);
    }
    for (const [input, recipe] of entries) {
      recipes[input] = recipe;
      owners.set(input, ownerKey);
    }
    return { ok: true, provider, catalog, registered: entries.size };
  }

  for (const provider of AUDITED_SMOKING_PROVIDERS) {
    registerProvider({ ...provider,
      recipes: provider.recipes.filter(recipe => hasItem(recipe.input) && hasItem(recipe.output)) });
  }
  return { recipes, registerProvider };
}
