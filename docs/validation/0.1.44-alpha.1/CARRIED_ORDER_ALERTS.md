# Carried paper and bag deadline alerts — 0.1.44-alpha.1

Date: 2026-11-08. The independently reviewed alert gameplay source is `be1d68fca76b5fff2453e19794c5709dd65b8da3`, originally based on merged .42 `b0d54f4c7f1353788f82307227ac008b83d89c63`. It is mechanically integrated onto exact merged .43 `74bf27c08dabf6a67435e55231651baef63a62ae` (tree `b2044f8eea089aa23a3e3139f490df4aa5992ee5`) as source commit `19644600a281590a311b1d55dc10d6271b4d718c`.

This local candidate freezes paired BP/RP headers, modules and the BP-to-RP dependency at 0.1.44, with package/lock version 0.1.44-alpha.1 and actual runtime hashes appended to release-history.json and recorded in baseline.json. Stable UUIDs, minimum engine version and APIs are unchanged. This is not a published release or native acceptance result. No model, texture, entity, animation or vehicle input changed. All .43 rename logic, optional main-harness support and prior visual evidence are preserved; only adjacent import/PARITY paragraph conflicts required mechanical resolution.

## Pinned Java contract

Reference: `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`.

- [OrderItem.inventoryTick](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/OrderItem.java#L105-L163) and [TakeoutBagItem.inventoryTick](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java#L685-L734) run for a Player, not just the selected item. At remaining ticks <=0, emit expiry once; otherwise <=1200, one minute once; otherwise <=6000, five minutes once. First observation at one minute/expiry emits only that severity, not a backlog.
- Three flags belong to each physical stack. Slot changes, player transfers and ordinary serialization preserve them. Two fresh physical copies of one order can each notify. [TakeoutBoxBlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java#L100-L169) creates a new bag without the paper's warning flags.
- FoodPlateItem does not implement this warning path. Dropped items, placed meals and world-container contents do not notify a former holder.
- Messages use the original `message.ordertocook.order_expiring_soon_5`, `_1`, `order_expired_named` keys, yellow/red severity and the customer name. English and Simplified Chinese wording comes from the pinned language sources. Traditional Chinese is translated; the generic customer fallback is localized rather than copying Java paper's corrupted missing-name literal.

This patch adds notices only. Existing expiry, lifecycle cleanup, rewards, proofs and food transactions retain their own production paths. It does not claim to implement the Java lifecycle event API.

## Bedrock implementation and deliberate differences

`carried_order_alerts.js` runs from the existing 20-tick restaurant callback, after worldLoad. It reads each connected player's ordinary inventory once, capped at 36 slots. No offhand, chest, dropped-entity, world-cell or chunk scan is added. Native inventory-change events are not used as proof of complete load/idle coverage, and no item cache survives a pass.

Scheduled observation can be **less than 20 game ticks later** than Java's every-tick callback. Deadlines themselves remain exact. Invalid/unavailable native IO can postpone a notice longer. This is not a wall-clock or client-frame latency guarantee.

Authoritative anti-stale gates are a **Bedrock adaptation**, not Java's item code:

- Paper requires a matching retained accepted order (or an expired, previously accepted order), matching proof, and no evidence of packing. A paper reprinted while still accepted is a fresh physical paper; a packed-work reprint is informational and silent. A paper with no retained order is silent.
- Bag requires a matching retained packed/expired bag order and proof when a record exists. Completed, cancelled, offered, wrong-carrier/proof and otherwise unusable records stay silent. A deadline disagreeing with the retained tick deadline fails closed.
- An orphan bag with its own valid restaurant/order/proof identifiers and deadline can notify. Those fields do not authenticate missing history. Once the completed/cancelled record has been pruned or the restaurant deleted, the bag cannot know that former terminal status; this is an explicit limit, not invented recovery. The paper remains silent in the same situation.
- Legacy timestamp adoption uses the existing `adoptOrderDeadline` conversion on a temporary object, then stores the resulting tick on the same item. Linked legacy paper uses the retained deadline. Adoption never restarts a known tick deadline, edits a canonical order, or parses lore.

### Physical properties and failures

New paper/bag items store `ordertocook:customer_name`, capped at 128 UTF-16 code units without a trailing unmatched high surrogate. This is a display snapshot, not an identity proof. Legacy items use the retained customer's name when available; missing/invalid orphan names use `keyword.ordertocook.customer`. Presentation lore is never authority.

Three boolean properties persist per physical item:

- `ordertocook:expiry_warned_5m`
- `ordertocook:expiry_warned_1m`
- `ordertocook:expiry_expired_notified`

Absent/false means not yet marked. Invalid flag types are preserved and skipped, not coerced or cleared. New bags are created with fresh absent flags. Existing `ordertocook:expires_tick`, `expires_at`, `restaurant`, `order_id` and `proof` keep their roles. Items with unusable identities/deadlines fail closed.

The pass modifies the full stack returned by the native container and writes it back only for a newly applicable flag or one-time legacy adoption. It does not reconstruct metadata, consume items, replace them with a new item, or rewrite name/lore/unknown properties. A read failure or write failure before commit leaves the slot unchanged; the next bounded pass can retry. A write which applies and then throws is not rolled back. Existing flags are retained and observed next pass.

Markers are committed **before** attempting chat, unlike Java's send-then-mark order. Native persistence and chat are not atomic. A failed send, an uncertain applied write or a crash can lose a notice. Exactly-once delivery across crashes is not promised; routine replay after a persisted marker is suppressed.

### Actual bounds and cost

There is no schema guarantee of at most 64 restaurant records: `saveRestaurant` trims terminal history to 12 but retains every live record. This patch neither rejects valid large histories nor adds a persistent store index/cache. Store code is unchanged.

Within one pass, the first carried eligible item referencing a restaurant builds an ephemeral lookup of that restaurant's current records. Other items referencing it reuse the lookup only during this synchronous pass. A failed record traversal is attempted once per restaurant per pass, then retried next pass rather than being mistaken for absent history. A later save, rollback, pruning or replacement is read afresh next pass. No unrelated restaurant list is scanned by the alert service.

Costs are therefore at most **36P inventory slot reads plus one traversal of the retained records of each referenced restaurant**, per 20 ticks. CPU and temporary lookup memory depend on those record counts; they are not constant-time in arbitrarily large saves. At nominal 20 TPS, 36P is a slot-read estimate per second, **not measured native performance**. A qualifying stack uses up to nine dynamic-property reads. Each changed slot is written at most once per pass. A new non-legacy item normally writes at most three times over its warning lifecycle; legacy adoption before thresholds can add one write.

The fixture measured 72 slot reads for two players, zero writes before a threshold, one at five minutes, zero on the repeat, and three total after all three thresholds. A separate 201-live-record fixture with two physical papers measured one 201-record alert lookup traversal for the pass, not two. Existing independent HUD and restaurant housekeeping costs are excluded from these feature-specific counts.

## Verification

The first 16 production-path tests ran against unchanged .42 runtime: **14 expected failures, 2 passing negative controls**. The original 16-test input and TAP log are retained locally as `/tmp/otc-carried-alerts-baseline.test.js` and `/tmp/otc-carried-alerts-baseline.tap`; the baseline main.js SHA-256 is in `/tmp/otc-carried-alerts-baseline-source.sha256`. The tests were written before implementation, not only after the new code was available.

The **26-test final focused suite** covers registered production scheduling, real accept/prepare/pickup, all threshold boundaries and skipped bands, duplicate physical items, slot/player transfer and serialized reload, fresh paper-to-bag flags, storage/retrieval, plate/drop exclusions, terminal/reprinted items, history pruning, legacy adoption/wall jumps, malformed properties, native read/write exceptions, applied-then-thrown writes, failed chat, unknown metadata, and read/write/record-scan bounds. Native IO and rendering are doubled. Item JSON reconstruction is **not** a native save/restart test.

Run using already installed dependencies, without npm/install/registry operations:

```
node --test tests/carried-order-alerts.test.js
node --test tests/*.test.js
node node_modules/typescript/bin/tsc --noEmit
python tools/validate_pack.py
OTC_NATIVE_PLAYER_GEOMETRY=/tmp/otc-native-inputs-20261108/humanoid.json \
OTC_NATIVE_SLIM_GEOMETRY=/tmp/otc-native-inputs-20261108/mobs.json \
python -m unittest discover -s tests -p 'test_*.py'
python tools/build.py
python tools/check_compliance.py
python tests/check_release_policy.py
```

External geometry inputs are previously obtained pinned Mojang sources at `15701fa9c13923f12662984c32c124327e40e3d3`; they are test inputs only. No client, LIVE world, BDS, native probe or new environment/dependency installation was used. Native item durability, actual locale rendering, real multiplayer IO, performance and disk-restart delivery remain unverified.

The initial source-stage build correctly refused the changed runtime under its unchanged .42 identity, and release-policy checking lacked dist/build-info.json. Those were expected blocks, not passing package checks. After independent source review and mechanical integration onto .43, this candidate receives the fresh paired .44 identity. The original baseline failures and those source-stage blockers remain part of the evidence.

### Source review and integrated checks

- Focused author carried-alert suite: 26/26 pass; original .42 full suite with this patch: 838/838 pass.
- Independent source review: PASS, with 10/10 supplemental cases and all seven deliberate mutations detected. Supplemental cases include 10,001-record histories, cross-player reuse, canonical replacement, player failure isolation and legacy partial-property writes. Independent source review is not approval of an unknown package.
- Mechanical .43 integration: 908/908 Node tests pass (882 existing .43 tests plus 26 alert tests), TypeScript passes, pack validation has zero errors, and Python discovery passes 48/48 using the supplied pinned geometry. No reviewed gameplay/test byte was altered to obtain integration.
- The separate alert module, alert tests and four translations in each language remain byte-identical to reviewed be1d68f. Removing only its reviewed alert additions from main.js reproduces .43 main.js byte-for-byte. Existing rename/portable/inventory/harness files and all visual evidence documents remain unchanged. README/PARITY additions do not remove earlier visual limitations.

After freezing the paired identity, the full Node suite again passes 908/908, the independent supplemental suite passes 10/10 against the integrated runtime, TypeScript and pack validation pass, and all 48 Python checks pass. The preliminary build, source/package compliance and release-policy regression also pass; matching-tag checking succeeds and wrong-tag checking fails as intended. No aggregate npm-run success or native acceptance is implied. The exact final committed-source check results, clean build metadata and two-build package hashes accompany the candidate; the precommit build is only a preliminary packaging check.

Final export must come from the clean source commit with `sourceDirty: false` and `sourceRevision` matching that commit, then a repeated build must produce identical package SHA-256 values. A successful local export creates neither a Git tag nor a published Release.

Frozen runtime identity:

- BP: 101 files, SHA-256 `bd491b3162ccde2eec826102c2edfc2e881675056e6843646d4582eb7512fd20`.
- RP: 394 files, SHA-256 `3b2ee7920b48754d7f17c6ea32fd27a1d792e82b18e673d3823a85cce8265c9d`.
- Build runtime tree SHA-256: `5d5e18a667de39b12f27bc4114b91572e2a9936e8da731a1d2507f953c4298e6`.

Local integrated check outputs use `/tmp/otc-carried-alerts-integrated-*.log` and `.tap`; source-stage originals remain `/tmp/otc-carried-alerts-*`. These are local reproduction records, not downloaded native evidence.
