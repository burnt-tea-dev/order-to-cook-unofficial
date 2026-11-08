# Java NPC spawn parity — isolated source audit

Baseline: `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`, Forge/Fabric 1.20.1 source.

## Source-derived behavior

- **Normal order**: `NormalOrderNpcManager.spawn` calls `OrderNpcManager.findSpawnPosNormal`. It scans a horizontal disk of radius 24; X offset ascends, then Z offset ascends, then Y descends from machine Y+8 to Y-8 (clamped to world bounds). The first chair whose two-block headroom, dryness and occupancy checks pass wins.
- **Normal no-chair / no-usable-chair fallback**: `findFallbackPosNearMachine(world, machinePos, 5)` scans a radius-5 horizontal disk, X then Z ascending. For each column it uses `MOTION_BLOCKING_NO_LEAVES` heightmap and gathers every position passing headroom and dry checks, then uniformly chooses one. This is a random pool, not nearest-first. It does not check chair occupancy because this is a standing fallback.
- **Delivery**: `findSpawnPosDelivery` first tests the exact target X/Z at `MOTION_BLOCKING_NO_LEAVES` top Y. It then searches perimeter rings radius 1..8, with at most 64 column probes. Ring order is top/bottom edges (dx ascending) followed by left/right edges (dz ascending). The delivery column helper explicitly skips chunks that are not already loaded.
- **Delivery retries**: ordinary delivery adds a radius-10/64-probe retry and then radius-50/256-probe retry after the primary search fails. `LongDistanceDeliveryNpcManager` does not add those two retries; it only uses the primary delivery search.
- **Safety**: feet and head blocks must be air; the block below must be non-air and either the mod chair or a solid block. Fluid state must be empty both at the spawn position and directly below. Thus a dry-looking top surface over water is rejected, and a partial/non-solid support is rejected unless it is the mod chair.
- **Failure**: normal spawn returns without creating an NPC if chair scan and radius-5 fallback both fail. Delivery returns false if all applicable stages fail. Neither source path force-loads delivery retry chunks; there is no universal fallback to an unsafe coordinate.

## Bedrock implementation gap (read-only shared files)

`entities.js` currently uses a different shared `standPosition` policy: radius-2 local offsets sorted by distance, vertical probes `[0,1,-1,2,-2,3,-3,4,-4]`, then a limited vertical ray fallback (first 5 or 24 columns). That does not reproduce Java's heightmap-based radius-5 random normal fallback or delivery ring order / attempt budgets. It also currently applies the same generic stand-position helper to regular and long-distance delivery, so Java's regular-delivery extra retries are not represented as separate policy stages.

Existing protections must remain: duplicate-customer reconciliation, persisted-anchor/unloaded checks, loaded-only delivery candidate checks, and canonical save rollback. The current adapter's `hasFullStandingSupport` is stricter in shape terms than Java's `isSolidBlock` and separately rejects waterlogged blocks; its exact equivalence for modded blocks is not established.

## Ownership and scope

Open PR #11 (`codex/otc-poi-discovery-26-60`) changes `entities.js` and `main.js`; it is Draft and remains active. Do not modify those shared files until its owner coordinates. Open PR #61 changes Blockbench evidence docs only. `config.js` is not changed by either open PR. This branch therefore adds only a pure candidate-order module, focused tests and this source audit; it does not claim runtime behavior is repaired.

## Deferred integration / validation

Integration must keep normal, regular delivery and long-distance delivery as separate policies; pass only loaded columns to delivery checks; use heightmap semantics only where a compatible Bedrock API is available; preserve support/fluid/headroom/occupancy semantics; and keep failed spawn/save rollback and duplicate protections intact. A future adapter-level suite should cover fixed RNG, radius/Y boundaries, liquid at feet and support, partial support, unloaded columns, no safe position, occupied chairs and failed persistence. World-scan discovery of unregistered chairs is a separate design item, not part of this change.
