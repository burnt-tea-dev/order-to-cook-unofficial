# Restaurant rename parity repair — 0.1.43-alpha.1

Date: 2026-11-08. Base: merged main `b0d54f4c7f1353788f82307227ac008b83d89c63`, full tree `c059bb65c02d79777426bdd04f5fa97cd0fff88c` (0.1.42). The reviewed gameplay source is `6dd0664cc90998d22fde1fdb44821bb1332cc3b7`. This candidate pairs BP/RP headers, modules and the BP-to-RP dependency at 0.1.43 with unchanged UUIDs, minimum engine version and stable APIs. Package/lock version is 0.1.43-alpha.1; the actual payload hashes are recorded in baseline.json and appended to release-history.json. This is an offline source/adapter candidate, not a published release or native/client acceptance.

## Fixed Java contract

The pinned upstream is `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`:

- [OrderMachineBlockEntity.java L692–719](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L692-L719): the **current** custom name being empty makes naming free; otherwise consume one physical currency unit before assigning. Same-name confirmation costs one. Clearing costs one and makes the next naming free. This is not an ever-renamed rule.
- [ModNetworking.java L257–277](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/network/ModNetworking.java#L257-L277): rename is owner-only through the actual machine menu.
- [OrderMachineScreen.java L500–535](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/screen/OrderMachineScreen.java#L500-L535): confirmation sends an empty value too; cancel sends nothing. Client text length is 32.
- [CoinUtils.java L29–152](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/util/CoinUtils.java#L29-L152): custom currency counts actual items; the normal path consumes denomination value and gives change. Lifetime restaurant earnings are not a wallet.

No Java executable was run. These are source-derived expectations. The separately audited carried-order deadline alerts are outside this change.

## Implementation and compatibility

Fresh Bedrock restaurants retain their existing owner-generated display name but explicitly start with `nameIsDefault: true`. A confirmed nonempty sanitized name sets false. A confirmed empty value restores the saved-owner fallback display and sets true; cancel (`undefined`) leaves everything unchanged. The modal states the current free/one-unit price and current currency, including the same-name and clearing rule.

The optional boolean is part of the existing JSON record and portable machine version-1 whitelist. Placement already copies validated portable durable fields into the new record and now carries this marker as well. Old version-1 items remain readable without adding or requiring a marker. Owner/staff, level, statistics, sequence and every existing display name remain intact through loading and relocation; orders remain world-bound, as before.

For a missing marker, only an empty name or an exact `${saved ownerName} 的餐廳` is interpreted as default. Other names are custom. Use the saved owner, never the current viewer or placer. Old data cannot reveal whether someone deliberately selected exactly that generated text: that ambiguous legacy case is treated as default until the next explicit naming. This policy does not claim to reconstruct naming history. Legacy loading and cancellation do not rewrite visible names or eagerly migrate markers.

An explicitly present non-boolean marker fails closed. Renaming and portable serialization/read reject it without erasing existing records. Player break is canceled before destruction when the stored name state is invalid; a forced destruction callback also does not serialize or delete that invalid record. Invalid portable input cancels placement and retains the full original item. There is no automatic repair or data reset.

Ordinary staff and outsiders cannot rename. Bedrock retains its existing explicit `otc_admin`/Creative override; this is a port policy, not a Java exception. Existing Bedrock formatting-code removal, trimming and a 32 UTF-16-code-unit slice remain a presentation adaptation rather than exact Java text acceptance. Sanitized empty input intentionally clears.

After the modal resolves, the handler rechecks the canonical restaurant object, block type/location, validity, distance, dimension, owner/admin permission, owner ID/name, visible name, raw marker, effective cost and configured currency. A changed quote or state aborts without payment. Current physical inventory is read by the real payment implementation immediately before synchronous mutation/save. There is no await between these steps.

## Transaction boundary

The existing denomination/change planner and custom-item extraction perform payment. Successful payment optionally returns the touched slots' complete original native ItemStacks. A rejected canonical save refunds those exact stacks into only those slots, including metadata and originally empty change slots, rather than minting equivalent coins or rewriting unrelated tools. Existing callers without a receipt behave as before. The store remains responsible for restoring its last committed canonical snapshot; the failed detached object is never saved again.

Tests distinguish a rejected chunk/root write, a silent omitted root and an exception after the root really committed. The last case stays successful and paid under the existing store's read-back rule. Payment write exceptions before and after a slot mutation restore original stacks using the existing inventory rollback.

This does **not** make native inventory and world dynamic properties atomic. A crash between payment and save, an unavailable read-back, persistent inventory restore errors, or uncertain native write outcomes remain recovery limits. Refund restoration tries each touched slot and logs failures; it does not promise success when native writes remain unavailable. Native UI rendering, real multiplayer interleaving, full ItemStack component persistence and same-world disk restart were not exercised in this change.

The settings dialog's obsolete warning that breaking resets levels/statistics is narrowly corrected to the already implemented portable preservation and paused re-placement behavior.

## Tests and checks

Before runtime edits, the new production-interaction regression file produced **6 expected RED / 3 passing controls** against unchanged main. Its failures discriminated second-name payment, same-name payment, insufficient balance, clear/reset, custom currency and staff permission. The existing focused core/clock/inventory/canonical suite passed **75/75** before the change.

After the repair, **70 new tests** cover actual registered interaction routing, quotes, first/second/same/clear/reset/cancel, sanitation/defensive handler input guards, custom currency, denomination change/full inventory, owner/staff/outsider/admin, deferred changes and currency loss, payment/save failures, native-stack metadata rollback, typed/legacy/malformed marker handling, JSON reload and actual portable break/place/reload. The portable regression suite plus new tests pass **78/78**. The three malformed-modal-value tests inject raw nonstrings after bypassing production ui.js, which normally coerces values to strings. They cover a defensive handler guard, not native malformed-response rejection. Independent review additionally passed six adapter cases through actual ui.js for cancel/empty/reset, earlier-form owner loss, coordinate mismatch, a marker changed while the modal was open, and multi-slot 10000-denomination refund. Five independent mutations were detected; no reviewed gameplay behavior was changed for this identity freeze. These are source/adapter doubles, not native probes. Error capture in the main harness is opt-in for these expected-failure tests; unrelated tests retain their original fail-on-unhandled-error behavior.

Executed directly with preinstalled local dependencies, without npm, installation, registry/network calls, BDS, client, LIVE world or environment probes:

- `node --test --test-reporter=tap tests/*.test.js`: **882/882** (812 prior + 70 new).
- `node node_modules/typescript/bin/tsc --noEmit`: pass.
- `python tools/validate_pack.py`: **367 JSON**, no errors.
- Python dining assets: **4/4**; appliance geometry **23/23**; segmented player **13/13**; CI scope **8/8**.
- Segmented checks use the preexisting external `humanoid.json` and `mobs.json` pinned to Mojang commit `15701fa9c13923f12662984c32c124327e40e3d3`; they are not added to the repository.
- Source-stage `python tools/check_compliance.py`: no errors; existing pending-rights clarification remains advisory.
- Before the identity freeze, `python tools/build.py` correctly refused the changed BP against .42, and release-policy lacked build metadata. Those source-stage failures were expected, not passed package checks.

After integrating main `8979974bd4e1117e583bcbc705592065b3163a3d` (#67), all the listed source checks passed again, together with `python tools/build.py`, `python tools/check_compliance.py` and `python tests/check_release_policy.py`. The unchanged existing rights-clarification status remains advisory; matching-tag checks pass and wrong-tag checks fail as intended. The initial working-tree build was only a precommit check, not the deliverable.

Final export is from the clean committed source: verify `sourceDirty: false` and matching `sourceRevision`, then rebuild and compare the three package SHA-256 values. The exact final commit, build metadata, repeated-build package hashes and check outputs accompany the candidate; a successful local build does not create a Release or certify native/client play.

Frozen runtime identity:

- BP: 100 files, SHA-256 `e3bffc4e05d69c3399ea175b0c173ba47edfd5176569f37f4b1adfee4067e92f`.
- RP: 394 files, SHA-256 `11fa3c14cb8d874abc117ab44e9cd03492c5d3503ed50adf69550c7b1e8e7f88`.
- Build runtime tree SHA-256: `181a998cf29121b3f61c0e6399ba9df8cc22b9d4004a1a6dd547ca2fbc43b220`.

Models, textures, animations, entities, NPC spawn logic and vehicle input are unchanged; .30–.42 gameplay fixes remain present. All 30 added #67 documentation/evidence files and prior visual-audio evidence (including #61/#65) remain byte-identical. Both #67 visual-status and motorcycle-gap paragraphs remain in PARITY.md alongside the new rename paragraph; the whole PARITY file is therefore not byte-identical. Three README visual summaries are aligned with that partial-inspection evidence. These documentation changes are not new gameplay or runtime assets.
