# Default machine-placement box: source validation

Date: 2026-11-08. Base: `4bd27721b56f5f11d9049da1fb6b0a371be68e52` (`0.1.38-alpha.1`). Paired BP/RP/modules/dependency identity is `0.1.39-alpha.1`, with stable UUIDs and append-only payload history. This change aligns only the default single-machine placement geometry. It is not a POI redesign, equipment-radius change or native gameplay acceptance result.

## Pinned source and exact bounds

- Java [`OrderMachineBlock.setPlacedBy`, lines 110–150](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/OrderMachineBlock.java#L110-L150) constructs `new AABB(pos).inflate(24)`, casts the min/max coordinates to integers and iterates `BlockPos.betweenClosed`, skipping the placed position. It counts physical order-machine blocks of every owner. It does not call `getBlockStates`.
- Java [`ModConfig`, lines 9–10](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ModConfig.java#L9-L10) defaults `maxOrderMachinesWithin24` to 1; placement compares the count with `Math.max(1, ...)`.
- The pinned MC 1.20.1 mapped-source mirror’s [`AABB` BlockPos constructor](https://github.com/Blackjack200/minecraft_client_1_20_1/blob/c129e3e3e6ca89a731d4cfc35bb606c6bd2cae2c/net/minecraft/world/phys/AABB.java#L28-L29) uses `[pos, pos+1]`; [`inflate`](https://github.com/Blackjack200/minecraft_client_1_20_1/blob/c129e3e3e6ca89a731d4cfc35bb606c6bd2cae2c/net/minecraft/world/phys/AABB.java#L178-L189) expands both ends. [`SharedConstants`](https://github.com/Blackjack200/minecraft_client_1_20_1/blob/c129e3e3e6ca89a731d4cfc35bb606c6bd2cae2c/net/minecraft/SharedConstants.java#L20-L29) identifies 1.20.1, world version 3465, protocol 763.
- [`BlockPos.betweenClosed`](https://github.com/Blackjack200/minecraft_client_1_20_1/blob/c129e3e3e6ca89a731d4cfc35bb606c6bd2cae2c/net/minecraft/core/BlockPos.java#L337-L355) includes both endpoints. Its final cursor expression has a decompiler variable-shadowing artifact, so the readable [same-version second mirror](https://github.com/0xFruzz/Extazyy-1.20.1/blob/59e64d4de4bc99fb5fb5e7149b8c866abb3b2b4b/src/main/java/net/minecraft/core/BlockPos.java#L347-L366) was independently checked in the source audit.

For **delta = existing machine position minus newly attempted position**, each axis is therefore **-24 <= delta <= +25**, inclusive. Self is excluded. Integer block coordinates retain these exact bounds at negative world coordinates: new x=-100 gives existing x in [-124,-75]. At an axial separation of 25, placement order matters. Neither a symmetric ±24/±25 box nor a sphere matches this source.

## Discriminating red-to-green reproduction

Before editing production code, three new tests dispatched the shipped `main.js` registered component’s `beforeOnPlayerPlace`, ordinary `afterEvents.playerPlaceBlock` and delayed `onPlace` through `main.harness.js`:

1. Ordinary existing-minus-new (+25,0,0).
2. Ordinary existing-minus-new (+24,0,+24).
3. Portable, data-bearing machine at (+25,+25,+25), translated to negative coordinates.

All three failed with actual `cancel=false`, expected `true`. The old `nearestRestaurant(block,24)` sphere let them commit. With the fix all pass. Ordinary cases verify the first machine was placed through the same production callback path; denied placement preserves its block, all saved data and the held machine, without target restaurant/station creation. Portable denial verifies the complete original item, including name, lore and an extra dynamic property, remains unchanged; a later permitted retry consumes once and restores owner, staff, level and nonzero statistics without a duplicate drop.

## Narrow implementation and retained limits

`hasMachinePlacementConflict` iterates the current canonical restaurant map, filters dimension, self and inclusive per-axis bounds before reading a world block, and returns on the first live machine. Positive interval comparisons also reject missing/NaN axes before world reads. It adds no sorting, cache, index, persistent format or 50³-cell world scan.

Only machine pre-placement spacing calls this predicate. `nearestRestaurant` is byte-for-byte unchanged: equipment still uses the existing spherical radius, distance ordering/ties, live lookup and permissions. The pre-worldLoad guard, exact-target removal journal, portable capture ordering and complete ItemStack handling remain. Existing densely placed saved restaurants are not deleted, migrated or disabled.

Bedrock still considers only registered records whose block is currently readable and still an order machine. Unregistered physical machines and unloaded/missing blocks are outside this lookup, without deletion of their saved records. Java’s physical-world discovery and configurable `maxOrderMachinesWithin24` are **not implemented**. The error and handbook distinguish the placement box from equipment radius in English, Simplified Chinese and Traditional Chinese; guidebook source and generated strings stay aligned.

The existing synthetic ordering where two preflights both run before either placement callback can still admit two machines. This is not a newly reproduced native race. This patch adds no reservation, deferred revalidation, refund or destructive post-placement correction. A native-confirmed ordering problem would require separate work.

## Executed source checks

- Three distinguishing production-adapter regressions: **3 expected failures before the fix**, then all pass.
- Focused machine placement plus unchanged world-read, portable, store, main and station-access suites: **90/90 pass**, including 11 new placement tests.
- Placement coverage groups all signed face endpoints (-25,-24,+24,+25,+26) on X/Y/Z, corners, mixed signs and self at positive/negative positions; canonical rollback/current membership; metadata-first filtering and exact native-read counts; unloaded/missing/replaced/live transitions; ownership/staff/admin/creative; dimensions; removal journal; portable retry/data; localized guidance; and legacy dense-world tick/reload retention. Existing tests separately cover malformed portable data and nearest lookup distance/ties/permissions.
- Installed TypeScript `--noEmit`: pass. Pack validator: pass, 367 JSON files, no errors.

After checking remote main remained the exact base and no 0.1.39 ref was occupied, the paired 0.1.39 identity was frozen with unchanged pack UUIDs and an append-only release-history entry. Final direct installed-tool checks: **775/775 JavaScript tests**, TypeScript `--noEmit`, pack validator, deterministic package build, **23 geometry tests**, **13 segmented-source tests** with the pinned external Mojang inputs, **8 CI-scope tests**, compliance and release-policy tests all pass. Compliance retains the existing advisory pending-rights clarification; no rights evidence was changed. These commands call installed Node/Python directly, not npm. No client, real-player input, LIVE world, personal desktop or BDS was used. Adapter doubles are not proof of Bedrock event ordering, native saves, performance or rendering. No npm/registry/install/dependency operation was used.
