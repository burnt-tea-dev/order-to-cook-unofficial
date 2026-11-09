# Refrigerator item-display contract

Source/API review, 2026-11-09. Runtime remains `0.1.48-alpha.1` at
`dbb2574154a54cc5ad69e75e71d23900a98a79fe`. This document adds no item display,
entity, inventory migration or experimental API. No Minecraft client or BDS was
run for this review.

**The missing feature is dynamic rendering of inventory contents, not missing
food cubes in the refrigerator model.** Native held-item rendering exists in
Bedrock. A safe custom holder with general item-model support has not yet been
validated for this refrigerator.

## Pinned Java behavior

The [registered renderer](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/OrderToCookModClient.java#L137-L155)
adds a food layer to `RefrigeratorRenderer`. The
[block entity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L53-L137)
has 27 upper and 54 lower slots. Each half scans all its slots in order and takes
the **first eight nonempty stacks**, not slots 0–7. Repeated IDs in different
slots retain separate display positions. The layer does not filter the selected
stacks again by food type. Each display copy has count one.

The [render layer](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/RefrigeratorRenderer.java#L19-L100)
uses these block-local positions, grouped by compressed display ordinal:

| Ordinals | X | Upper Y | Lower Y | Z |
| --- | --- | --- | --- | --- |
| 1, 2 | −0.24, +0.24 | 1.625 | 0.75 | −0.18 |
| 3, 4 | −0.24, +0.24 | 1.3125 | 0.1875 | −0.18 |
| 5, 6 | −0.24, +0.24 | 1.75 | 0.9375 | −0.18 |
| 7, 8 | −0.24, +0.24 | 1.4375 | 0.375 | −0.18 |

Each item receives translation, positive X rotation of 60°, uniform scale 0.28,
then `ItemRenderer.renderStatic` with `ItemDisplayContext.FIXED`, supplied world
light and `NO_OVERLAY`. Item models, tint and render types belong to that native
Java renderer, not the refrigerator's cabinet texture or material. Its lower
row adjustment is numerically 3/16 block; the source's “+4px” comment does not
change those values.

The layer runs on root `bone`, after its transform and before its children in
[GeckoLib 4.8.3](https://github.com/bernie-g/geckolib/blob/e81962eefd04e0cab90445d3df37b477d2767ffd/Forge/src/main/java/software/bernie/geckolib/renderer/GeoRenderer.java#L245-L256).
Contents follow the shared root and block facing, **not the door rotation**.
A half is visible while its state is nonzero, including the 20-tick closing
state. A fully open angle is not required. Both close animations affect the root;
any future display must use the [existing shared-root contract](../fridge-shared-root/README.md).

`copyWithCount` preserves the current stack data in memory, but does not establish
end-to-end metadata preservation. The pinned
[save/update path](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L356-L456)
writes only Slot, id and Count and reconstructs a new stack. **Do not reproduce
that limitation by discarding Bedrock inventory metadata.**

## Bedrock capability and safety boundary

The existing [native inventory adapter](https://github.com/burnt-tea-dev/order-to-cook-unofficial/blob/dbb2574154a54cc5ad69e75e71d23900a98a79fe/runtime/BP/scripts/native_fridge.js)
keeps the real 27+54 slots authoritative. A future visual reader can use `peek()`
and `getItem()`. It must not migrate, compact, move, serialize or replace cargo to
prepare an image. Current door synchronization is not item-content synchronization.

Official documentation establishes useful capabilities:

- [Attachable model binding](https://learn.microsoft.com/en-us/minecraft/creator/documents/attachables?view=minecraft-bedrock-stable#attaching-by-model-binding)
  maps equipment slots to item bones. The pinned
  [vanilla armor stand](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/entity/armor_stand.entity.json)
  enables attachables. This is real native held-item rendering, not evidence that
  an arbitrary custom actor inherits every vanilla behavior or Java FIXED pose.
  An attachable may also restrict its owner, as the official wrench example does.
- [EntityEquippableComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityequippablecomponent?view=minecraft-bedrock-stable)
  holds real ItemStacks. [`minecraft:equipment`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_equipment?view=minecraft-bedrock-stable)
  can set slot drop chance to zero. This is a valid defense, but it does not alone
  prevent normal equip/unequip or extraction. An empty loot table alone does not
  cover equipment and inventory drops.
- [`minecraft:transient`](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_transient?view=minecraft-bedrock-stable)
  is a valid nonpersistent helper mechanism. [`Entity.remove()`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable#remove)
  removes without the normal death/loot path. Neither proves safety before
  cleanup, and transient does not remove still-loaded actors on script reload.

These official stable-view pages were read on 2026-11-09 and can change. The
review also checked existing `@minecraft/server` 2.11.0 declarations. No verified
pure-display `ItemStack` drawing API was found in this review; this is **not** a
proof that general native display is impossible.

## Next proof, not an implementation claim

The next useful optional native experiment is **one transient custom holder with
synthetic items only**: ordinary 2D food, a 3D block item and an owner-gated
attachable. First establish actual equipment support, rendering, empty-slot
clearing, transforms, lighting and transparency. Then test ordinary keyboard and
touch equip/extract interactions, death/explosion, unload/reload and cleanup.
Do not connect real refrigerator cargo or expand to 8+8 displays before those
contracts are demonstrated. None of these native tests ran in this review.

A no-item geometry actor can instead avoid creating real item copies by design,
but supports only a finite authored asset/variant mapping. It is not arbitrary
ItemRenderer parity and has not been adopted. Unknown items must not silently
become another food or cause the ninth stack to replace a selected unknown stack.
`spawnItem` is unsuitable for a read-only display because it creates real world
items. Existing inventory and motion unit tests are not tests of any new display.

## Reproducible sources

[Sixteen exact source/license records](placement-poses-20261109/fridge/source-manifest.json)
cover Java registration, block entity, renderer, geometry/animation, Gecko
renderer and dependency versions, plus official vanilla samples and their license.
They reuse identical files within the companion package. The
[offline verifier](placement-poses-20261109/README.md#replay)
checks their SHA-256 and Git blob identities. [Official API links](placement-poses-20261109/fridge/official-api/sources.json)
and [declaration version provenance](placement-poses-20261109/fridge/official-api/package-provenance.json)
are separate from native runtime evidence. No Java JAR or Minecraft binary is included.
