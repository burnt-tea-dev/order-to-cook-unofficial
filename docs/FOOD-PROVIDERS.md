# Optional food catalog V1

This is an OTC-owned **food supply declaration**, separate from Core's
`senluo.public.food.v1` item-state carrier. Both use their existing owners:
Core reads heat/quality/seasoning/recipe identity; OTC decides menu eligibility,
nutrition and saved order requirements. No shared JavaScript singleton between
behavior packs, private host API, player override, family recipe or fixed pack
order is required.

The built-in [audited catalog](FOOD-CATALOG.md) already recognizes Grilling's
fixed foods, Tavern grapes and 世界名酒 snacks. Players install the supplying
addon, obtain its food and use the usual board interaction; they do **not** run
one administrator command per dish. The board still registers a held/backpack
sample without consuming it. Uninstalled items are never generated or inserted
into a menu by the catalog.

## Java rule and the existing Bedrock extension

Pinned Java OTC 1.3.7a
[`MenuFoodCompatApi.resolve`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/MenuFoodCompatApi.java)
tries an administrator/config value, registered compat rules, then positive
`stack.getItem().getFoodProperties().getNutrition()`. That last call uses the
item's base food properties, not a stack quality multiplier or saturation.
[`BoardBlockEntity.tryAddTemplate`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/BoardBlockEntity.java)
deduplicates Java Item IDs and counts one portion per template. Consequently
Grilling's Bedrock animation IDs and quality IDs represent the **same dish**.

Already-merged [PR #10](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/10)
adds genuine recipe `nativeVariant` identities and quoted menu/order snapshots.
That same-ID variant feature is an intentional Bedrock integration extension;
Java's pinned generator carries Item IDs. This change preserves the extension
while requiring a provider to declare actual recipe variants. Known fixed foods
do not gain extra identities from arbitrary V1 metadata.

Lookup order for newly selected items:

1. Existing exact-ID administrator `ordertocook:food` overrides, including old
   saved overrides. This retains their previous semantics.
2. Live provider declaration, then the built-in audited catalog for that item.
3. The existing vanilla table and readable positive native food component.

Known zero-nutrition drinks, unresolved dynamic foods and nonfood use-trigger
items do not receive invented values from the native fallback. A later explicit
provider can support them with a sourced, positive food rule. The protocol is a
cooperative installed-addon contract, not authentication of food or metadata.

## Message contract

`system.sendScriptEvent('ordertocook:food_catalog_v1', JSON.stringify(message))`
publishes a batch:

```json
{
  "v": 1,
  "provider": "example_foods",
  "replace": true,
  "foods": [
    {
      "typeId": "example_foods:finished_meal",
      "nutrition": 8,
      "label": "Example finished meal",
      "aliases": ["example_foods:finished_meal_in_hand"]
    },
    {
      "typeId": "example_foods:recipe_bowl",
      "nativeVariant": 7,
      "nutrition": 6,
      "label": "Example bowl recipe"
    }
  ]
}
```

The IDs and values above are schema examples, **not added playable foods**.
Use the actual supplier's edible output, recipe and nutrition facts.

| Field | Meaning |
| --- | --- |
| `v` | Exactly `1`; does not change the Core food carrier version. |
| `provider` | The item namespace this addon owns. `minecraft` and `ordertocook` are reserved; existing administrator overrides remain available. |
| `foods` | Batch of positive food declarations. Every canonical ID and alias must belong to `provider`. |
| `replace` | Optional boolean. `true` replaces this provider's live declarations before applying the batch. Otherwise batches upsert by canonical ID plus optional variant. An empty replacement withdraws live declarations, leaving built-in defaults and all saved menus/orders intact. |
| `typeId` | Canonical dish ID. This and its aliases must represent the same real food. |
| `nutrition` | Explicit integer `1..10000`, in hunger points. No inferred quality, heat, seasoning or price multiplier. |
| `label` | Optional display name, at most 100 characters; otherwise the ID. |
| `aliases` | Optional additional physical item IDs for that dish. An alias cannot belong to two different canonical dishes in a provider catalog. |
| `nativeVariant` | Optional integer `0..32767` identifying a specific recipe in valid public V1 item metadata. Omit for a fixed dish. |

An item-specific variant is chosen before its provider's generic declaration.
When only specific recipes are declared, absent, invalid, unsupported or unknown
variant metadata cannot fall back to a guessed generic recipe. Generic/specific
overlap cannot be counted twice on a board. Provider declarations never create
an actual item, recipe or edible component.

Only `Server`-origin script events are accepted for this contract. Player,
command-block and NPC-origin messages cannot silently register a catalog. The
existing administrator command is unchanged. Invalid batches leave the previous
working live catalog intact and log the rejected declaration.

## Automatic registration without a pack order dependency

The OTC receiver subscribes while scripts load, before `worldLoad`. After its
world initialization, it sends one deferred
`ordertocook:food_catalog_request_v1` message with `{"v":1}`. A provider should
announce on its own `worldLoad` and answer this request. If its catalog depends
on asynchronous initialization, it should also announce when that completes.
No polling loop or persisted provider registry is needed.

Example provider-side code:

```js
import { world, system } from '@minecraft/server';

const foods = [
  // Populate from this addon's real, obtainable output definitions.
  { typeId: 'example_foods:finished_meal', nutrition: 8, label: 'Example meal' }
];

function announce() {
  // sendScriptEvent permits at most 2048 characters per message in API 2.0.
  // One small declaration per message avoids a large all-foods payload.
  system.sendScriptEvent('ordertocook:food_catalog_v1', JSON.stringify({
    v: 1, provider: 'example_foods', replace: true, foods: []
  }));
  for (const food of foods) {
    system.sendScriptEvent('ordertocook:food_catalog_v1', JSON.stringify({
      v: 1, provider: 'example_foods', foods: [food]
    }));
  }
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id === 'ordertocook:food_catalog_request_v1' && event.sourceType === 'Server') announce();
});
world.afterEvents.worldLoad.subscribe(() => system.run(announce));
```

Keep each declaration within the documented size, including its aliases. Larger
catalogs can batch several small declarations per event; repeated announcements
are idempotent. This sample needs no OTC import or installed dependency: without
OTC, no consumer receives the event. API evidence is the pinned official
`@minecraft/server@2.0.0` `System.sendScriptEvent` declaration and
[Microsoft's System documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/system).

## Menu, order, preparation and save behavior

New menu entries snapshot `{typeId, nutrition, label, aliases?, foodIdentity?}`.
Orders copy that data. Extraction matches the **saved** canonical/alias IDs and
the saved recipe variant, then uses the existing raw-lore/name preflight and
native stack clones. It never rebuilds foreign food or reads another addon's
private properties. A provider update during the inventory picker rejects a
changed name, nutrition, alias set or recipe; the player selects again.

Heat, quality and seasoning are preserved during extraction rollback, but are
not part of the recipe identity or additional payment. Cooling a matching dish
does not invalidate its order. Menu nutrition counts each dish once, independent
of held stack size and the number of presentation IDs.

Old menu/order entries without `aliases` keep their original exact-ID matching;
old V1 identities remain supported. The new catalog does not rewrite, clear or
refill saved restaurant menus. An old alias entry prevents adding its new
canonical dish as a duplicate. To adopt the new equivalent-ID policy for an old
menu entry, remove and re-add that one dish; existing accepted orders keep their
original quote and match policy.

No new world property keys, pack UUIDs, save owners or schema migration are
introduced. Provider registrations are recreated in memory on each load.
Existing menus and accepted/packed/cancelled orders reload without a provider,
retaining nutrition, name, aliases, identity, deadline and terminal state. A
saved food that was uninstalled is not fabricated; the original requirement
remains visible. Existing supplies, preparation rollback, cancellation and
single-payment delivery rules continue to own their operations.

The full fixed catalog totals 487 with vanilla, or 467 without the expired-event
wedding candy, before other supplier acquisition gaps. Java Lv.8 remains 600.
[FOOD-CATALOG.md](FOOD-CATALOG.md) lists every supported food, exact unsupported
drink ID and acquisition limitation. This is food supply wiring, not stove
recipe, Cookery guide, currency, dynamic plate or secret-skewer implementation.

Verification for this source change is recorded in
[UNRELEASED-food-catalog.md](validation/UNRELEASED-food-catalog.md).
