# Senluo integration standard for Order To Cook

Status: proposal, introduced by the `integration/senluo-food-v1` workstream.

This document defines the compatibility contract for optional integrations. It does
not claim that any provider is already implemented or client-accepted. Runtime
changes must follow this standard in separate, reviewable pull requests.

## 1. Goals and non-goals

Order To Cook (OTC) remains fully playable without Senluo Bedrock Core, Grilling,
Tavern, World Liquor, Cookery, or any other companion pack. Companion integrations
are optional capabilities, not hard dependencies.

The integration must preserve the original identity and behavior of provider
ItemStacks. It must not replace an item with a newly constructed stack merely
because the replacement has the same type ID.

Java parity remains the gameplay authority. A Bedrock adapter may expose a
platform-specific workflow, but must document that difference rather than silently
claiming equivalence.

## 2. Dependency and capability discovery

- Do not add a hard manifest dependency on Core or another optional addon.
- Discover providers through their documented public contract and validate the
  advertised API version and capabilities before using them.
- Missing providers, unsupported API versions, malformed responses, and timeouts
  must disable only the affected optional feature. Vanilla OTC behavior must remain
  available.
- Never infer a provider from a namespace, display name, installed file name, or
  private dynamic-property key.
- Do not poll every tick for provider presence. Use a bounded handshake/cache and
  explicit invalidation or documented lifecycle events.
- Treat Script Events as an integration transport, not as cryptographic module
  authentication. Validate source type, payload schema, size, request identity,
  and replay behavior.

## 3. Food metadata contract

### 3.1 Existing V1 compatibility

The current public carrier is `senluo.public.food.v1`, owned by Senluo Bedrock
Core and implemented in its `food_api_core.js`. Its persisted payload includes
`v`, `hotUntil`, `seasoning`, optional `nativeVariant`, and optional
`quality`.

OTC must consume V1 read-only in the first implementation. It must not rewrite,
normalize-and-write-back, rename, delete, or duplicate this carrier. It must not
assume that an empty translated carrier is display lore. Existing user lore and
the provider's quality presentation must remain intact.

A missing V1 carrier means “no public Senluo metadata”, not “invalid food”.
A malformed or duplicated carrier means “metadata unavailable”; it must not
invalidate an otherwise valid food ItemStack or cause the stack to be discarded.

### 3.2 Food classification

Food eligibility and food metadata are separate questions. A provider item must
be explicitly classified as one of:

- `consumable`: may be selected as a restaurant menu dish;
- `ingredient`: may be used by a registered recipe but is not itself a menu dish
  unless it is independently consumable;
- `processing_material`: used by a machine or recipe, not a dish;
- `tool`: equipment, container, bottle, utensil, or reusable implement;
- `unknown`: not automatically accepted.

Do not infer “consumable” from a namespace, lore text, item name, or recipe output
alone. Prefer a provider's explicit public food registration. A readable native
`minecraft:food` component may be used as a fallback only when no provider
classification exists.

### 3.3 Nutrition precedence and snapshots

Use this deterministic precedence:

1. Valid provider-published food nutrition for the exact item identity.
2. OTC's explicit built-in food catalog.
3. A readable native `minecraft:food` component.
4. An administrator-supplied OTC override.

An invalid provider payload must not shadow a valid lower-priority source.
Conflicting valid provider records must be rejected and diagnosed, not resolved
by “last writer wins”.

A menu entry stores a bounded nutrition/label snapshot and source identity at
registration time. An accepted order stores its own immutable per-line snapshot.
Later provider reloads, recipe changes, or metadata changes must not silently
change existing menu requirements, accepted orders, or already quoted rewards.
Changing a menu item requires an explicit menu edit.

Do not multiply menu nutrition by the held stack count. Preserve the existing OTC
rule that one menu entry represents one dish.

### 3.4 ItemStack and metadata preservation

- Read metadata from the actual stack being registered or processed.
- Keep the original stack through extraction, storage, packing, delivery, and
  rollback wherever the native API permits.
- Do not reconstruct a stack from `typeId`, name, nutrition, or lore alone.
- Do not overwrite provider lore or the V1 carrier to attach OTC order identity.
- Keep OTC order proof/identity in OTC-owned data using the existing OTC mechanism.
- If a transformation is unavoidable, define an explicit provider-supported
  clone/transfer contract and test custom components, amount, name, lore, aux
  variant, durability, and other exposed stack data before and after.
- If metadata cannot be safely read, preserve the item and continue only with the
  documented fallback; never “repair” it by deleting unknown data.

## 4. Recipe and processing-provider contract

A recipe is not just an input/output pair. Each registration must declare:

- stable recipe ID and provider ID;
- ingredient IDs, quantities, and optional alternatives;
- output ID and quantity;
- processing station/method;
- duration, fuel rules, and relevant quality/effect semantics;
- provider API version and source version;
- whether the recipe is available to OTC's restaurant kitchen.

Station routing is mandatory. Grilling skewer/grill recipes must remain Grilling
recipes and must not be inserted into OTC's three-slot smoker/stove merely because
both produce food. OTC may show those recipes in its guide or order preparation
instructions, but execution remains with the owning Grilling station unless a
separately reviewed adapter explicitly supports that station.

OTC's existing vanilla stove recipes remain unchanged. A provider registration
must be idempotent; duplicate IDs with identical content are harmless, while
conflicting content is rejected. No arbitrary recipe discovery from private
registries or guessed JSON paths.

## 5. Drink and effect-provider contract

Tavern and World Liquor drinks may be menu dishes only when the provider explicitly
declares them consumable and supplies a valid nutrition/menu policy. Ingredients,
empty bottles, shaker inputs, brewing vessels, and display-only items are not
automatically menu dishes.

OTC must not trigger drink effects when adding a drink to a menu, storing it,
packing it, or handing it to a customer. The provider's existing consume callback
remains the sole authority for drink consumption and effects. OTC must preserve
quality, aging, delivery identity, and other public stack metadata. If the provider
is absent, drinks are unavailable as an integration feature; existing OTC foods
continue working.

## 6. Currency-provider contract

The current OTC configurable single currency item is a compatibility fallback,
not a complete Senluo currency integration.

A future provider must expose authoritative balance and transactional operations
for quote, debit, credit, change-making, commit, and rollback (or an equivalent
idempotent transaction API). It must define denominations, rounding, insufficient
funds, inventory capacity, concurrency, restart recovery, and duplicate request
handling.

Never treat lifetime restaurant earnings as a wallet balance. Never silently
convert existing balances when changing providers. Do not apply a quality price
multiplier until the real provider quality scale and original OTC reward formula
have been reviewed and a balance regression suite exists. Existing OTC prices and
rewards remain the default.

## 7. Cookery guide and operation-entry invariants

**The original Cookery guide layout is a protected interface.** Integration work
must not redesign, flatten, reorder, rename, or replace its existing structure.

The following are invariants:

- Preserve every original top-level section and its hierarchy/depth.
- Preserve original section IDs, parent relationships, ordering, entry IDs,
  recipe ordering, localized content, icons, and navigation behavior.
- Preserve the original renderer, typography, page sizing, pagination, and
  interaction model.
- Do not move original entries into new categories or merge unrelated categories.
- Do not rewrite the author's Cookery archive in the public repository or publish
  a modified author archive as if it were an official release.
- Do not add another guidebook item or a parallel replacement UI.

Preferred integration path:

1. Inspect the exact supported Cookery guide extension API and current author
   version used by the family.
2. Publish OTC content as a separate, namespaced extension payload through that
   API, using the same host rendering path as existing extensions.
3. Add one clearly owned OTC entry/entrance only at a documented extension slot.
4. Keep OTC's internal hierarchy beneath that entrance; do not inject OTC entries
   into unrelated original categories.
5. Preserve all existing locale maps and use the host's locale selection/fallback.

Before and after guide snapshots must compare the original host payload. For all
pre-existing nodes, IDs, parents, sibling order, recipes, locales, and rendered
navigation must remain unchanged. Only the new OTC-owned extension node and its
children may be added.

If the current Cookery API has no safe independent extension slot, do not mutate
the guide structure. Keep the Cookery guide unchanged and provide a reciprocal
navigation link from the existing Tavern guide/OTC guide entry instead. This
fallback is preferable to breaking the author's information architecture.

The OTC guide content should cover restaurant operation, orders/delivery, menu
management, equipment, dining/cleaning, motorcycle delivery, and optional Senluo
food/drink integration. It must distinguish “how to use a station” from “recipe
owned by a product”: equipment pages explain operation; product entries own
their recipes.

## 8. Versioning, save compatibility, and security

- Preserve OTC BP/RP UUIDs, module UUIDs, item IDs, block IDs, entity IDs, state
  values, and all persisted dynamic-property keys.
- Add optional capabilities without changing the meaning of existing save data.
- Pin provider API versions and exact companion pack versions in integration
  tests and release metadata.
- Never place private author archives, private integration scripts, worlds,
  credentials, or server configuration in public source or releases.
- Do not modify LIVE worlds during development. Test disposable worlds and
  stopped-world save copies with a rollback path.
- Do not treat BDS load, static validation, hashes, or mocked tests as client
  acceptance.

## 9. Required test matrix

Every integration PR must include applicable tests for:

- OTC alone (no provider);
- provider absent, late, incompatible, malformed, and timed out;
- valid, missing, duplicated, and malformed V1 metadata;
- preserved lore and ItemStack identity through storage/packing/rollback;
- food classification and nutrition precedence;
- recipe registration idempotency, conflict rejection, and station routing;
- menu and accepted-order snapshots across provider reload;
- no drink effect before the provider's real consume callback;
- currency insufficient funds, change, rollback, retry, concurrency, and restart;
- guide before/after structural snapshot and unchanged original navigation;
- existing save migration and pack identity compatibility.

Record separately: source implementation, unit/contract tests, static checks,
native BDS tests, saved-world first-load/restart, and real client acceptance.
A pass in one layer must not be described as a pass in another.

## 10. Implementation sequence

1. Standards and baseline contract (this document).
2. Read-only OTC consumer for Senluo public food V1, with isolated tests.
3. Explicit Grilling recipe-provider adapter and station routing.
4. Tavern/World Liquor drink registration and consume/effect preservation.
5. Transactional currency provider after reviewing the actual currency owner.
6. Cookery guide extension only after exact host API and structural snapshot tests.
7. Complete-family native/save/client acceptance and versioned release.

Each stage is a separate PR. Do not bundle unrelated runtime changes or advance
pack versions for documentation-only changes.
