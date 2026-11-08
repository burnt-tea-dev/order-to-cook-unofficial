# Dine-in takeout: source validation

Date: 2026-11-08. Integrated base: `71d8952a9d38cc9df9ad557e41338fbbc2f656ab` (`0.1.37-alpha.1`); original reproduction base: `6a896d2` (`0.1.36-alpha.1`). Paired BP/RP/module/dependency identity is `0.1.38-alpha.1`, with stable UUIDs and append-only payload history. This source candidate does not publish packages or claim client/native-world acceptance.

## Verified upstream contract

Pinned source: [`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642). Paths below are under `forge-1.20.1`:

- [`src/client/java/cn/breezeth/ordertocook/screen/TakeoutBoxScreen.java`, lines 32–36](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/screen/TakeoutBoxScreen.java#L32-L36) exposes separate Pack and Plate buttons.
- [`src/main/java/cn/breezeth/ordertocook/screen/TakeoutBoxScreenHandler.java`, lines 145–160](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/screen/TakeoutBoxScreenHandler.java#L145-L160) dispatches PACK/PLATE through CountertopAutomationApi.
- [`block/entity/TakeoutBoxBlockEntity.java`, lines 61–196](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java#L61-L196) allows PACK for dine-in, preserves order type/deadline and uses packaging; PLATE rejects delivery (also lines 257–280). This change does not modify the separate `countertopConsumeLeather` configuration gap.
- [`item/TakeoutBagItem.java`, lines 252–266](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java#L252-L266) permits direct dine-in bag handoff. Lines 417–465 preserve reward, tips, completion and walk-in statistics; lines 512–540 only choose eating/boom for a seated FoodPlateItem; lines 624–632 only place a dining plate for FoodPlateItem.

## Reproduction and fix

The first regression in `tests/dine-in-takeout.test.js` failed against the base with actual status `accepted`, expected `packed`. It generates and accepts a real dine-in order, spawns the customer through the shipped entity service, and stocks three leather through `shelfInteract` plus 64 bread. With no clean plate, normal held-ticket interaction correctly retains the old plating default. The new explicit sneak-click bag choice previously could not prepare it.

The fixed test follows preparation, native-container pickup, annotated full-ItemStack replacement/pickup, customer handoff, and native reaction-done input through the shipped entity cleanup. The bag consumes exactly the quoted food and one packaging unit. It retains `type: dine_in`, proof and both deadlines. A seated customer performs SIT_TAKE (40 ticks) with no meal, dish or boom bonus, then the existing reaction callback removes the customer and seat.

Implementation:

- `carrier: bag | plate` is persisted on successful preparation independently of order type. For already-packed orders and fulfillment, only an absent carrier falls back to the old delivery→bag/dine-in→plate mapping; null, unknown and delivery→plate combinations fail closed at parcel creation, placement or handoff. Preparation explicitly chooses its carrier and can replace a pre-existing field on an accepted order; this change does not add corrupt-accepted-state recovery.
- Normal clicks and held-ticket shortcuts keep their defaults. Sneak-click opens the explicit extra choice. Cancel consumes nothing. Returning from a form rechecks distance, countertop/machine identity, canonical restaurant/order, rights, status/deadline and, for the ticket entry, the same canonical ticket/proof.
- Output, legacy display adoption, native placement and handoff use canonical carrier+proof. Native moves retain full ItemStack metadata. A mismatched legacy display cannot mint the other carrier.
- Bags bypass dining vacancy and queueing; core completion and the entity fallback use the selected physical carrier. Bag completion does not create meal records, plate sounds, dirty dishes or boom rewards. Reward, tips, deadline, ordinary/walk-in counts and existing reaction cleanup stay intact.
- No world scan, POI redesign, source configuration change, custom player override or new cleanup service is included.

## Regression coverage and limits

Eleven focused tests cover the distinguishing generated end-to-end flow; ordinary/walk-in seated/standing bag completion through real entities (walk-ins arrive seated, then may lose their chair); both entry cancellations; deferred validation; preparation and handoff rollback; carrier/proof persistence; absent-field legacy mapping; wrong carrier/proof rejection in both directions; legacy display adoption; delivery-plate rejection; expiry; and the explicit plate choice retaining its meal/boom behavior. Existing fixture-only delivery conversions now set their bag carrier explicitly, so their old assertions continue exercising the intended delivery path rather than accidentally failing on a mismatched new carrier.

Final integration validation used only installed local Node, TypeScript and Python tools, with no dependency downloads:

- `node --test tests/*.test.js`: **764/764 passed** (the prior main's 753 plus these 11 focused regressions).
- `node node_modules/typescript/bin/tsc --noEmit`: passed. `python tools/validate_pack.py`: passed, **367 JSON files**, zero errors.
- `python tools/build.py`: passed under the fresh paired identity. A clean post-commit rebuild records `sourceDirty: false` and the exact source revision in `dist/build-info.json`; artifact checksums are in `dist/SHA256SUMS.txt`.
- Geometry reproduction: **23/23 passed**. Segmented prototype checks: **13/13 passed**, using the pre-existing pinned Mojang classic/slim input files outside the repository. CI scope: **8/8 passed**.
- Compliance and release-policy checks: passed. Existing asset-scope clarification remains advisory and unchanged; no permission record was manufactured and no Release was published.
- Previous history entries are unchanged; only `0.1.38` was appended. Pack/module UUIDs, API versions, dependencies and engine requirements are unchanged. The old identity gate had correctly rejected exporting this changed payload under `.36` before integration.

Frozen payload fingerprints (the manifests are included):

- BP: `d89c4d8580c45f83930acce76a6f7cea610d351300edd7fe96c37bb99accbe25` (99 files).
- RP: `bfd52b53e0bfbbcfd2b86307e333609a37211790a7d5a7dc635bd649e96b665e` (394 files).
- Combined runtime: `d2e0bf926c8531bc828d6b6433cd369ceb2a5aabb7203d6923eeb78c9cafd753`.

All of main/core/store/dining/entities execute shipped code; Minecraft I/O is doubled. Native reaction timer properties are supplied as inputs, not simulated engine proof. No client, LIVE world, personal computer, headless BDS, real disk/restart, multiplayer UI or rendering acceptance was run. The pack build's identity gate is retained: changed payload cannot be exported under an existing frozen version. This candidate assigns a fresh paired identity before building. Models, textures, geometry and animations are unchanged from the integrated base.
