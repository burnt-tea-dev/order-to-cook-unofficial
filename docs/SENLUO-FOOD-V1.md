# T1a: read-only Senluo food V1 and extraction preflight

Status: implemented source candidate, not a released or client-accepted integration.
This is the first runtime slice following [the proposed integration standard](SENLUO-INTEGRATION-STANDARD.md).

## Scope and corrections to the initial proposal

Core SDK 0.1.0 publishes heat deadlines, seasoning IDs, optional native variant
and quality in `senluo.public.food.v1`. It does **not** publish nutrition, a food
catalog, recipe registration, currency, or a universal guide API. Do not infer
those capabilities from the carrier. There is no reason to introduce V2 here.
Quality is the existing 0..3 scale (superb/excellent/standard/poor), not the
previously suggested five grades. This change adds no quality price multiplier.

`senluo_food.js` imports the byte-identical Core export at commit
`08b8adc720dc4aa725132eee00fb9fbcdedfaaca`; source and license hashes are recorded
in `runtime/BP/scripts/vendor/senluo/lock.json`. Do not edit the vendored export;
update the canonical SDK, then replace it and update the pin. Its BSD notice is
kept alongside the code and included by the existing BP builder. OTC only calls
the read function; it never invokes the SDK's write functions.

## Actual runtime behavior

The existing `planExtraction` now captures a public raw-lore/name snapshot for
each selected stack. `applyExtraction` rechecks **all** selected sources before
its first write. A same-ID, same-count change to quality, seasoning, heat,
variant, name or raw lore rejects the stale plan without consuming anything.
Existing native clone/remainder/rollback operations retain the original stacks;
there is no item reconstruction, new scheduler, provider pack dependency,
private-property read, effect callback or new persisted key.

The read result distinguishes:

- `valid`: exactly one valid V1 carrier; a detached read-only-by-convention state.
- `absent`: raw lore is readable but no V1 carrier exists.
- `invalid`: duplicated/malformed V1 carrier; no semantic metadata is trusted.
- `unsupported`: `getRawLore` is unavailable. Existing ID/quantity extraction
  remains available; **raw metadata verification is not claimed** in this mode.
- `unreadable`: native read/serialization failure or the reader's bounded budget
  exceeded. The current transaction is refused; the source items are not deleted.

Unchanged invalid carriers can still pass legacy ID-only extraction. Their exact
raw data is compared rather than being normalized to an empty payload. Readable
raw lore is limited to 20 rows and 32,768 serialized UTF-16 code units per stack.
Raw serialization differences conservatively reject a stale plan even when two
payloads might have equivalent semantics; replan from the current item.
Stored heat deadlines are not rounded, extended or restarted.

The reader does not decide whether an item is edible. V1 metadata is public and
is not authentication, proof of quality, or a basis for increasing rewards.
Native food eligibility, administrator overrides, existing menus, order matching,
reward formulas and currency behavior remain unchanged. This supersedes any
suggestion that V1 alone provides a nutrition provider or should outrank existing
administrator settings. Provider registration and menu/order policy require a
separate reviewed implementation.

## Evidence and limitations

Local Node 22 focused run: 47 tests passed (21 existing inventory regressions and
26 new reader/extraction cases). Four same-ID/same-count metadata swap tests fail
against the unchanged original inventory source and pass against this candidate.
The two pure reader/SDK modules also passed local TypeScript checkJs validation.
The complete repository suite, official API typecheck and build are owned by PR CI;
local focused results must not be presented as a complete `npm run verify` run.

No native BDS, saved-world first-load/restart, rendered client or real multiplayer
test was performed for this candidate. The current stable API declaration is not
raised: capability detection avoids assuming `getRawLore` exists on every target.
The guard compares public name/raw lore, not every opaque native component; it is
not a general ItemStack equality proof or a crash-atomic transaction guarantee.
Snapshots are short-lived extraction data, not persisted menu/order snapshots.

## Explicitly unchanged and next slices

Cookery author files, guide layout, section hierarchy/order, navigation, locale
selection, Tavern/Grilling guide publishers and every existing guide item are
untouched. There is no new guide UI or book. Pack UUIDs, item/block IDs, save keys
and current release artifacts are unchanged; no candidate package is published.
The existing asset-release HOLD remains in force. A new release identity must be
assigned before packaging this runtime as a distributable candidate.

Remaining work: explicit food catalog/nutrition registration; variant-aware menu
and accepted-order snapshots; recipe ownership/station routing; beverage policy;
any actual currency-provider integration; and safe guide extension only after
inspecting the exact Cookery host contract and preserving its original hierarchy.
Do not label the whole T1 phase, full Senluo interoperability or Java parity complete.
