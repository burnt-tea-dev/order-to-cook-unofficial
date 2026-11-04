# Optional food supply and menu nutrition — source verification

Date: 2026-11-03. Unreleased source change; no Release or LIVE operation.

## Completion follow-up on PR #18

This follow-up extends initial commit `f2982a3189f37ca688e193266f67c638684bb970`.
The initial 349-test record below is retained as history; the current revision
has **359 passing Node tests** and the completed food/drink coverage described
here. The final published head and CI run are recorded on
[PR #18](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/18).

| Current check | Result | Scope |
| --- | --- | --- |
| `npm run verify` | PASS — 359 Node tests, stable API typecheck, 286 JSON resource validations, local build | Full production source including all catalog, provider and drink regressions |
| Catalog/provider/drink focused tests | 26/26 PASS | 10 catalog cases, 9 provider/runtime cases, 7 drink/runtime cases |
| Supplier item-set comparison | PASS — 72 drinks, 282 unique physical IDs | Matches the complete previously unsupported drink set; each ID exists in its pinned supplier and has an actual drink-consumption path |

The three newly included positive foods are secret skewers (with two hand-ID
aliases), skewer plates and Sichuan pepper, each using Java base nutrition **1**.
The initial exclusion of secret skewers/plates was over-conservative: Java OTC
reads no-argument `Item.getFoodProperties()`, not the stack-aware eating overload.
No private ingredient or plate parsing is needed for that rule. Pepper is
harvestable and now eligible for OTC service; its supplier's handheld-eating
component gap remains outside this change.

The **72 zero-nutrition drinks / 282 physical IDs** use the explicit
`servingKind: 'drink'` menu extension. Java's positive-nutrition gate is documented,
not claimed as parity. The regression suite covers quality alias deduplication,
drink-only order generation, zero progression/hunger-bonus contribution, original
base service rewards, fridge/backpack preparation, delivery/replay, accepted and
packed cancellations, provider changes while a picker is open, and fresh
production-store JSON reload alongside legacy food entries. Unknown zero-value
food/tools are still rejected.

The resulting Senluo catalog has **67 positive foods / 331 nutrition** and
**72 drinks**, with **139 menu identities / 425 physical IDs**. Including vanilla
gives 107 positive foods plus 72 drinks, total nutrition **490**, or **470** without
the expired wedding candy. All 107 positive foods fit within the unchanged
150-template capacity; Lv.8 still requires **600**. The two excluded items are a
recipe book and a processing ingredient, not missing food support.

World Liquor Java 1.1.12 independently confirms all four fallback snacks at
nutrition 5. Its conditional fallback registration differs from standalone
Twilight's values; the latter are not substituted. Official artifact IDs,
checksums, source methods and the drink-consumption audit are recorded in
[UNRELEASED-drinks-source-audit.md](UNRELEASED-drinks-source-audit.md).

The local build's runtime fingerprint is
`de59c4fff817b962a265876a112212769420a904c683f04c0e212dbc791417e5`.
No native BDS, real cross-pack announcement, old player-world restart, rendered
client, supplier crafting chain or multiplayer acceptance was run in this
follow-up. The initial native/client limitations below continue to apply.

## Initial revision: baseline and scope

Started from main `eaf593d330b24405c09f068dec531f5fdc09a12f`, which already
contains merged PR #10's V1 variant/menu/order flow. Before submission, main
advanced to `ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`; that intervening change
only adjusts candidate workflow triggering and is retained as the PR base.

Runtime changes are the audited optional catalog, the script-event provider
receiver, food lookup, equivalent-ID menu/order snapshots, and extraction of
those saved equivalents. No stove process, recipe, Cookery guide, vendor SDK,
manifest/UUID, save-owner or world-property-key change is included.

Primary Java rules and the intentionally retained Bedrock native-variant
extension are documented in [FOOD-PROVIDERS.md](../FOOD-PROVIDERS.md). Supplier
revisions and the complete food/drink inventory are documented in
[FOOD-CATALOG.md](../FOOD-CATALOG.md). Pins are evidence, not new installation
version locks.

## Initial revision: executed verification

| Check | Result | Meaning |
| --- | --- | --- |
| `npm run verify` | PASS — 349 Node tests, official stable API typecheck, 286 JSON resource validations and local build | Current production JavaScript, including the 16 new catalog/provider tests |
| `node --test tests/food-catalog.test.js` | 7/7 PASS | Fixed catalog, alias/quality deduplication, positive nutrition, declared variants, batch lifecycle, request/reply ordering and 600 threshold |
| `node --test tests/food-provider-runtime.test.js` | 9/9 PASS | Production menu/order/preparation/payment paths, legacy matching, cancellation and persisted-JSON reload |
| `python -m unittest discover -s tests -p test_appliance_geometry.py` | 5/5 PASS | Existing source-converter CI regression, no converter changes |
| `python tools/check_compliance.py` | PASS, existing advisory retained | Existing attribution/provenance and packaged notices |
| `python tests/check_release_policy.py` | PASS | Existing release-policy regression, no policy changes |
| `git diff --check` | PASS | Source whitespace check |

The first focused local run exposed two incorrect test fixtures: a V1 carrier
omitted required `hotUntil`/`seasoning`, and the test used nonexistent bare
`kaleidoscope_tavern:wine` instead of a real `wine_q1` item. The fixtures were
corrected to the existing public schema and actual supplier ID; production
validation was not weakened.

The existing GitHub `Validate and build Bedrock add-on` workflow runs these
same checks for the PR. Its final head/run URL and conclusion are reported on
the PR; local success does not stand in for remote CI success. The build above
is a local verification output using the existing development package version,
not a newly published or redistributed same-version candidate.

## Initial revision: player-visible scenarios covered

- Held Grilling lamb skewer enters the board from the real shipped catalog
  without administrator registration or a mocked food component. Base,
  `_native_plain` and `_java_three_alt` stacks can supply the single quoted dish.
- Fixed Grilling quality IDs use base nutrition and cannot manufacture
  additional dishes. Raw and cooked foods remain distinct, as in Java.
- An optional provider declares two recipes under one item ID with explicit
  V1 variants and different nutrition. The backpack picker shows them separately.
- Wrong variants consume neither food nor supplies. Valid variants can be
  collected jointly from the player's backpack and permitted refrigerator.
- Later provider changes to names, nutrition or aliases do not rewrite menu or
  accepted-order snapshots. Alias-only updates while a picker is open reject the
  stale selection.
- An already prepared parcel can be delivered after its provider withdraws;
  replay cannot pay twice. Accepted and packed cancellations are terminal and
  preserve the existing no-food-refund rule.
- Old ID-only and old V1-only entries retain their original matching behavior.
  An old presentation-ID entry blocks duplicate canonical registration.
  Existing exact-ID administrator overrides retain precedence and save format.
- A fresh instance of production `store.js` loads actual chunked JSON written
  by the production save functions. New aliases, old menus and
  accepted/packed/cancelled orders survive without a provider registry or load
  writes. This is a storage-module reload, not an engine restart.

## Initial revision: nutrition and then-open gaps

The following is the original revision's result. The completion follow-up above
supersedes its secret-skewer/plate/pepper and drink exclusions and resolves the
World Liquor Java fallback nutrition question.

The catalog adds 64 canonical foods with 328 nutrition, recognizing 138 physical
IDs after the 74 aliases. Together with vanilla, the table has 104 dishes and
487 nutrition: enough for Lv.7, still 113 below Lv.8. Excluding the expired
wedding-candy event gives 103/467 before other supplier acquisition gaps. The
test asserts the original `[0,40,80,120,160,200,300,400,600]` thresholds unchanged.

The default catalog excludes 282 zero/unknown-nutrition drink IDs, dynamic
secret skewers and skewer plates, Bedrock-ineligible Sichuan pepper, and
zero-nutrition use-trigger items. World Liquor's four snacks use verified current
Bedrock nutrition 5; independent Twilight Java nutrition parity remains open.
See the catalog for exact IDs, sources, expired-event and initial-crop limits.

## Not run

Native BDS, actual cross-pack script-event delivery in an engine, a genuine old
player-world upgrade/restart, rendered client forms, mobile controls, supplier
crafting chains and real multiplayer were **not run for this source revision**.
Node event/container doubles and stored-JSON reloads do not prove those results.
Historical client failures and prior native evidence are unchanged and are not
relabelled as this revision's acceptance.

The targeted client follow-up is to install OTC with the desired supplier(s),
obtain a real dish, add it to a board, prepare with another equivalent hand ID,
deliver once, then restart with saved working orders. For a third-party
provider, verify the automatic announcement with both pack loading orders.
