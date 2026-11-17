# Occupied countertop PACK output

Source base: `9d26b38` / 0.1.51-alpha.1. Date: 2026-11-10. Export identity: 0.1.52-alpha.1, unchanged UUIDs and Script APIs.

## Actual upstream caller

Pinned source `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`:

- [TakeoutBoxScreenHandler.clickMenuButton](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/screen/TakeoutBoxScreenHandler.java) sends button 0 through the real PACK API.
- [CountertopAutomationApi.execute](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/CountertopAutomationApi.java) calls `tryPackOrder`; output obstruction rejects only PLATE.
- [Forge tryPackOrder](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java) and [NeoForge tryPackOrder](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java) both place the full bag when air is available, otherwise spawn the item at counter + (0.5, 1.2, 0.5), with upward velocity 0.2. Existing food, packaging, expiry and order consumption precede that output.

## Source change and discriminating checks

The original Bedrock `prepareOrderAtCountertop` rejected occupied output before any packing. The shipped caller now branches only for bags; plates keep the prior refusal. The original `parcelFor` factory supplies the same full stack. No inventory fallback, new timer, registry, ID or schema was added. Stable server 2.11.0 declares `spawnItem` returning Entity and supports `clearVelocity` plus `applyImpulse`.

Before repair, the real caller left delivery and dine-in bag cases accepted and never reached the requested spawn-failure branches; the PLATE refusal control already passed. After repair, the focused source cases pass:

- Delivery and dine-in PACK consume exact food/packaging once, drop the complete factory stack at the selected source position/vector, and preserve deadline and original occupied block/native meal. Reusing the order creates no second bag.
- PLATE refuses an occupied output with food and clean plates untouched.
- A known spawn failure restores the transaction. A velocity failure after receiving the new entity removes that new drop, restores food/packaging/order, and preserves the pre-existing native meal and station record.
- The existing leather-disabled test now expects a dropped bag at occupied output while retaining missing-food and clean-plate requirements.

Tests call the shipped main/core/store/inventory and factory with existing native I/O doubles. The new groups live in default-core `tests/dine-in-takeout.test.js`; `tests/leather-config.test.js` covers the existing global setting. Unchanged countertop controls retain their prior coverage. No full historical asset/animation matrix was replayed.

These are source/API-boundary checks, not native item pickup, physics, restart, UI rendering or FPS evidence. Native writes and persistent order storage do not form an atomic cross-layer transaction; unknown after-write failures are not claimed as covered by the known failure fixtures. No BDS, test world, LIVE or shared deployment was operated by this source repair.
