# Global machine count: source validation

Date: 2026-11-08. Integrated base: `4914962ed9be585614f0aca495433a1b9cc6fbc6` (`0.1.40-alpha.1`, including the #61 visual-review documentation). The runtime reproduction base was `7373238756b6fefdcac37458bfaeaa0887b0ed9b`, whose runtime is unchanged by #61. Scope: the global `maxOrderMachinesWithin24` setting and the existing registered/live placement check only. Paired BP/RP/module/dependency identity is `0.1.41-alpha.1`, with unchanged UUIDs and an append-only payload-history entry. This document does not imply publication. No client or native acceptance is implied.

## Pinned Java contract

- [`ModConfig.java`, lines 9–10](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ModConfig.java#L9-L10) declares `public int maxOrderMachinesWithin24 = 1`.
- [`OrderMachineBlock.java`, lines 110–150](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/OrderMachineBlock.java#L110-L150) uses `Math.max(1, ConfigManager.get().maxOrderMachinesWithin24)`. It counts other physical machine blocks within `new AABB(pos).inflate(24)` and `BlockPos.betweenClosed`, rejecting once the count reaches the limit. Existing minus new is **[-24,+25] on each axis**, inclusive, with self excluded. Limit two therefore permits a new machine with one qualifying neighbor and rejects one with two. All owners count.
- [`ConfigManager.java`, lines 41–70](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ConfigManager.java#L41-L70) stores server-global configuration. The verified Java operator interface is editing the config file loaded at startup, not a player-facing screen or claimed live file reload.

The Bedrock command reuses its existing administrator interface:

```mcfunction
/scriptevent ordertocook:config {"maxOrderMachinesWithin24":2}
/scriptevent ordertocook:config {"maxOrderMachinesWithin24":1}
```

Server script events, creative players and `otc_admin` players retain access; ordinary players cannot change the setting. Every placement uses the current world-global value. A nearby restaurant, portable snapshot, owner/staff role or creative placement does not supply a different limit.

## Effective behavior and persistence

- Command input must be a JSON number representing an integer in `-2147483648..2147483647`. Fractions, strings, booleans, arrays, objects, null and out-of-range numbers reject the entire command before writes. Java's effective minimum is preserved: values below one are normalized to and saved as one, never unlimited. The default is one.
- Global defaults and the existing `ordertocook:settings` document include the setting. A missing or invalid saved field uses one in memory without rewriting that document on worldLoad. Valid signed integer fields are clamped in memory to at least one. A later successful config command persists the effective settings.
- Malformed JSON, a non-object settings document or a non-string property preserves the raw data and stops initialization. The config handler cannot overwrite it while initialization is stopped.
- Limit two permits the first and second nearby machine and refuses a third. Cancellation precedes portable capture and placement completion, leaving the entire ordinary/portable ItemStack, its metadata and existing records unchanged. When enough other machines no longer qualify, retry succeeds once through the existing placement path.
- Resetting to one affects future attempts only. Count-only commands do not rewrite restaurant records, including their separate configs, orders, owners, staff, levels or statistics. Existing dense machines are not removed, relocated or deactivated. The retained-removal journal still rejects its exact position independently, even at the largest allowed count.
- Placement traverses current canonical registered records, applying same-dimension, self and signed-box metadata filters before world reads. Only currently readable machine blocks count. It short-circuits at the threshold, with no sorting, persistent cache, reservation or 125,000-cell world scan. A larger configured count can require more registered-candidate reads than the old first-match rule; counted source calls do not establish native performance.
- `nearestRestaurant` is unchanged: equipment still uses its 24-block sphere and nearest-live ordering. Dense placement can change which restaurant controls shared equipment. This setting does not redefine equipment selection, ownership or station permissions.
- Placement errors include the effective limit used by that attempt. The deferred message retains that value even if an administrator changes the setting before it is delivered. English, Simplified Chinese and Traditional Chinese runtime translations and guidebook source agree on count, geometry and unchanged equipment scope.

## Settings-write boundary

Writes containing this setting are read back before replacing the live global settings. The exercised setter failure **before applying a write** and silent non-write both preserve the prior persisted bytes and live limit. The .40 leather switch retains the same validation/readback and preparation behavior.

This is not a new native transaction guarantee. If a setter writes then throws, or readback throws/does not match after storage changed, live behavior can remain old while the new value is already persisted; a later worldLoad may apply it. No uncertain-outcome recovery is added. A combined command containing legacy currency/refresh/upgrade/leather fields still runs the preexisting restaurant propagation after the global commit. A later restaurant save failure does not roll back that global commit. Count-only commands skip this unrelated propagation.

## Executed regressions

Before runtime edits, two new tests ran through the real registered config and block-placement callbacks on the `.40` base. **Both failed as expected**, while all **11 existing placement tests passed**: limit two was not saved, and the second nearby machine remained canceled. These are discriminating contract groups, not separate underlying defects.

After the change, the placement suite has **26 passing test groups**. It extends the existing `.39` boundary/current-record tests to limits one and two instead of copying another matrix:

- Real first/second/third ordinary/portable placement flow, complete item equality on cancellation, no drops or ledger mutation, permitted retry and one restore.
- Server/creative/tagged-admin input and ordinary-player denial; owner/staff/stranger/creative/admin placement all count, with independent dimensions.
- Reused positive/negative targets, signed faces/corners, self exclusion and unchanged equipment sphere; metadata filters before reads, unloaded/undefined/replaced candidates, live threshold read counts, current mutated metadata, rollback-restored canonical objects, deletion/re-registration.
- Default, absent, invalid and valid signed saved fields; malformed documents; reload and reset to one without changing dense restaurant records or blocks; conflicting restaurant configs cannot override global settings; the portable writer excludes config and its reader rejects an injected config field without changing the item.
- Invalid command types and bounds reject without applying companion settings; pre-write failure and silently omitted writes preserve previous live count. Retained removal journal and deferred localized count remain covered.

After integration on `4914962` and the paired `.41` identity freeze, direct checks passed: **799/799 JavaScript tests** via `node --test tests/*.test.js`, direct TypeScript `--noEmit`, pack validation (**367 JSON files, no errors**), **23 geometry tests**, **13 segmented-source tests** with the previously obtained pinned Mojang inputs and **8 CI-scope tests**. Deterministic packaging, compliance and release-policy checks also passed. The existing pending asset-rights clarification remains advisory and its evidence is unchanged. A separate clean-commit rebuild verifies exact `sourceRevision` and `sourceDirty=false`; generated package hashes are not embedded in this source report. All gameplay execution uses shipped scripts with native I/O doubles, not a substitute config or placement implementation.

Commands use existing Node, TypeScript and Python directly. No npm, registry, installation, new dependencies, client, LIVE world, personal desktop or BDS was used. Tests do not demonstrate actual disk restart, native translated rendering, true multiplayer scheduling or performance.

## Retained differences

Java checks physical world blocks. Bedrock still discovers only registered, currently readable machines, not unregistered/unloaded blocks. Two synthetic preflights can both finish before either completion callback registers its machine; this retained ordering limitation is not claimed to be an observed native multiplayer race. No reservation, destructive refund, after-placement removal or world scan is added to mask it. The [.39 source and native-ordering limits](../0.1.39-alpha.1/MACHINE_PLACEMENT.md) remain relevant.

The .40 global leather feature is preserved. Delivery-rate and other config fields are not newly exposed. No models, textures, animations, UUIDs, property names or store schemas are changed by this repair. Full Java parity remains incomplete.
