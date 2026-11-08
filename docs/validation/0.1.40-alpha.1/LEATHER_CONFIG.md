# Global countertop leather setting: source validation

Date: 2026-11-08. Base: `a1037b6391c34e245118b467d540f79f863d4feb` (`0.1.39-alpha.1`). Scope: the existing administrator configuration channel and countertop leather gate only. Paired BP/RP/module/dependency identity is `0.1.40-alpha.1`, with unchanged UUIDs and an append-only payload-history entry. This document does not imply a published package or native acceptance.

## Pinned Java contract

- [`ModConfig.java`, lines 104–105](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ModConfig.java#L104-L105) defaults `countertopConsumeLeather` to true.
- [`TakeoutBoxBlockEntity.java`, lines 60–61 and 80–98](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java#L60-L98) gates both missing-packaging status and consumption on that value. False permits packing without a shelf. The plate branch independently requires a clean plate. Packing is not limited to delivery orders.
- [`ConfigManager.java`, lines 41–70](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ConfigManager.java#L41-L70) supplies global configuration. The verified Java access is the administrator-edited configuration file loaded at startup, not a player-facing configuration screen or a claimed file live-reload feature.

The Bedrock `/scriptevent ordertocook:config {"countertopConsumeLeather":false}` command is its existing administrator-interface adaptation. Server events, creative players and `otc_admin` players retain access; ordinary players do not gain access. This setting is global across the world, not stored in or selected from a nearby restaurant's config.

## Effective behavior and persistence

- Default true, explicit true and old saves missing the field require/consume one leather supply for a delivery or explicitly selected dine-in bag. A conflicting restaurant-config field has no effect.
- False skips shelf discovery, count snapshots, writes, block-state updates and supply rollback. Absent, empty, stocked, inaccessible and unloaded shelves do not block a bag. Existing shelf records and stock remain unchanged. Food is still consumed and the same full native ItemStack is produced.
- Default/explicit plating still requires and consumes a clean plate. Ordinary dine-in entry still defaults to plating; sneak-click alone offers the .38 carrier choice. Delivery cannot choose a plate.
- Only actual JSON true/false is accepted. Invalid command field types reject that command before any writes, including companion fields. Saved missing/nonboolean leather fields use true in memory without rewriting the saved document at worldLoad. A later successful configuration write saves the effective settings; no automatic recovery/migration is performed.
- Malformed JSON, a non-object settings document or a non-string settings property stops initialization and preserves the raw property. It does not open a configuration overwrite path. This matches the existing fail-closed malformed-JSON behavior and additionally rejects malformed document shapes.
- A valid false value survives a fresh worldLoad. Setting true restores the requirement for subsequent preparations without reclaiming leather or changing existing bags or shelf stock.
- Preparation reads the current global setting after the awaited order picker or carrier-choice form closes. Readiness text reflects the setting when rendered; already open text is not live-updated. A changed setting is enforced at commit.
- The settings-property write precedes the live assignment, and writes including this switch are read back. The tested failure cases are a setter throwing **before it writes** and a silently omitted write: both preserve the saved property and current leather behavior. These checks do not prove that every failed command leaves storage unchanged. If a native setter writes then throws, or the following readback throws/does not match, storage may already contain the new value while live behavior remains old; a later worldLoad can apply that persisted value. There is no added recovery/atomicity guarantee for an uncertain native outcome.
- This also does not turn the old restaurant-wide refresh/upgrade propagation into an all-or-nothing transaction. Once the world settings write/readback and live assignment succeed, a later unrelated restaurant propagation write can fail while the new global setting remains saved and active. The existing refresh/upgrade pipeline was not expanded into a transaction.

## Executed regressions

Before any runtime edit, `node --test tests/leather-config.test.js` on the base source produced **7 expected failures and 2 passing controls**. The failures cover disabled shelf-free bags, operator persistence, invalid command types, malformed saved document shapes, reset/reload, failed-write live behavior and post-form changes. The two default/plate controls already passed. These are discriminating contract groups, not seven independent bugs or an inflated count of every loop case.

After the runtime change:

- New configuration groups: **9/9 pass** through real registered script events, worldLoad and shipped countertop preparation, not an injected settings setter.
- Focused configuration, dine-in takeout, countertop controls and machine-placement suites: **82/82 pass**.
- Successful false-mode matrix covers both order types and ticket/picker entries with absent, empty, stocked, inaccessible and unloaded shelves. Existing shelf read/write attempts are trapped, persistent records are compared, metadata-rich food remainders and the full native output stack are checked. Pickup and repeated preparation cannot create a second bag.
- Existing carrier tests were expanded rather than copied: cancel paths and canonical/rights/deadline/distance/ticket/proof/machine changes run with default leather and shelf-free false mode. Both delivery/dine-in preparation paths roll back after actual packed restaurant commit, output placement, display record, unavailable native container and native item-write failures, then permit one canonical retry. Failure injection is armed after the earlier countertop preflight save, so it cannot falsely pass by failing before preparation begins.
- False-mode tests retain missing food/output refusal and both clean-plate entry modes; the existing full plate handoff/dirty-plate/deferred-boom control now runs with leather disabled. The .38 bag lifecycle and .39 placement suites remain passing.

After the paired `.40` identity was frozen, the direct installed-tool equivalent of repository verify passed: **784/784 JavaScript tests**, TypeScript `--noEmit`, pack validation (367 JSON files, no errors) and deterministic packaging. Additional checks passed: **23 geometry tests**, **13 segmented-source tests** using the previously obtained pinned external Mojang inputs, **8 CI-scope tests**, compliance and release-policy checks. The existing pending asset-rights clarification remains advisory; its evidence was not edited. A clean-commit package is rebuilt separately so `build-info.json` can report the exact source commit and `sourceDirty=false`; generated package hashes are not embedded in this source document.

Commands used: `node --test tests/*.test.js`, `node node_modules/typescript/bin/tsc --noEmit`, `python tools/validate_pack.py`, `python tools/build.py`, the three `python -m unittest discover -s tests -p ...` suites, `python tools/check_compliance.py` and `python tests/check_release_policy.py`. Existing local dependencies were reused without invoking npm. All executable gameplay tests here use the shipped scripts with native I/O doubles; they do not demonstrate native disk-restart behavior, true multiplayer scheduling, player input, GUI rendering or performance.

## Retained limits

The counter still requires a clear output block. Java PACK can drop a bag when output is obstructed; that interaction remains a separate adaptation. Machine-count and delivery-rate settings are not newly exposed. No store schema, UUID, property name, machine-placement semantics, texture, model or animation is changed by this repair. No client, LIVE world, personal desktop or BDS was used. Only existing local Node/TypeScript/Python tools were used, without npm, registry access, installation or new dependencies. Full Java parity remains incomplete.
