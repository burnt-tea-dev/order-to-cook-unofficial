# Customer skins: source implementation, not a client PASS

This follow-up starts from OTC 0.1.57-alpha.1 commit 207f33ed1ba6c496d3ffd9067ad64d4759fec3ea. P174 stays frozen. This source draft has no allocated release version, has not been packaged or deployed, and has no new client observation. No tests, CI, fixtures or probes were run. Only the normal targeted resource generator was executed.

## Upstream behavior

Pinned Java: [CustomerProfileLibrary](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/core/CustomerProfileLibrary.java), [CustomerEntityModel](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/client/java/cn/breezeth/ordertocook/client/renderer/CustomerEntityModel.java), [ModConfig](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/config/ModConfig.java).

- Ordinary customers use two bundled skins, with default 50% slim selection.
- The default 10% special-customer path selects one of the seven original accounts. Its player profile skin and body model take precedence.
- customMultipleCustomerSkins defaults to false. When enabled for ordinary customers, each wide/slim list scans custom_<model>_1.png through 512 and stops at the first gap. Empty lists fall back to the ordinary texture.
- Java selects a custom list member with floorMod(entity UUID hashCode, list size).

## Implemented source

assets/customer_skins/manifest.json is the shared identity and texture source. core.js re-exports the generated identity catalog, preserving its existing public symbol and all seven original names/UUIDs. Order creation probability, names, tips and reaction logic are unchanged.

The seven exact public Mojang PNG snapshots were retrieved on 2026-11-11. UUID and texture metadata, not account-name guessing, determine their associations:
- Wide: Breezeth, Ao2333, Assumine.
- Slim: Kuroneko_RikoP, YYN0114, Yunan_ovo (Mojang currently returns YuNan_OVO), zsdr.

Assumine is a classic 64x32 skin. It is not stretched onto a modern 64x64 UV layout. The converter preserves the PNG byte-for-byte and derives a legacy geometry from the same wide customer rig: texture height 32, mirrored right-limb UVs on left limbs, and no unsupported body/limb outer layers. Its captured image contains transparent hat pixels, so the head outer layer is retained. The sampled base face rectangles in this captured PNG are fully opaque; transparency exists only outside those base faces and in the hat, so preserving these pixels does not omit Java's forced-base-opacity effect. All rig names, pivots and animation bindings remain unchanged. The other six snapshots use their existing 64x64 wide/slim rigs. This geometry mapping still needs actual client observation.

The existing entity scan synchronizes three cosmetic properties: skin_profile (0 ordinary, 1..7 special), custom_skins and skin_seed. The ordinary variant property remains the saved order's model choice. Existing loaded actors and respawns recover appearance from the same saved order, without creating a second order, rerolling identity, changing rewards, or adding a timer. Missing cosmetic properties retain the prior nonfatal behavior.

## Custom skins

No user custom PNGs were supplied, so both custom lists are currently empty and deliberately fall back to the original ordinary textures.

1. Supply your own 64x64 PNG files under assets/customer_skins/customs/custom_wide_1.png, custom_wide_2.png, etc. and custom_slim_1.png, custom_slim_2.png, etc. Supply customs/NOTICE.md identifying their sources and rights.
2. Run python tools/convert_assets.py --customer-skins-only as normal generation. Full conversion calls the same function, so regeneration retains support. Each list is contiguous from 1 and capped at 512.
3. Allocate and freeze a fresh paired BP/RP version through the existing release owner before packaging. Changing skin inputs is a runtime payload change, not an in-place P174 replacement.
4. After the paired pack is installed, enable with the existing server configuration event:
   /scriptevent ordertocook:config {"customMultipleCustomerSkins":true}
   Disable with false. The existing server-only authorization boundary applies. Non-boolean values are rejected and the saved world setting is read back before applying it. This appearance-only change does not rewrite restaurant records.

A higher-priority RP can replace registered texture paths using Bedrock's normal resource-stack rules. If it adds list members, it must also supply the regenerated customer client-entity aliases and customer render-controller arrays. Copy only the customer controller entry when composing such a pack, preserving unrelated controllers. Merely adding an unregistered numbered filename is not supported. This is a build-time adaptation of Java's runtime resource scan, not automatic discovery of any dropped-in Java resource pack.

## Explicit remaining differences

- Snapshots do not update when the account owner changes skin. Refresh requires an explicit new input snapshot and fresh paired release.
- The stable Bedrock custom-entity APIs do not document Java GameProfile lookup or runtime registration of downloaded PNGs. No beta API, HTTP server module or new access permission was added.
- Bedrock Entity.id is opaque, not Java's UUID. Selection uses a small nonnegative hash of the saved order ID instead, stable through respawn and exactly representable in Molang. The specific list member is not claimed to match Java's UUID hash.
- Optional custom inputs currently support modern 64x64 PNGs. Arbitrary resolutions, legacy custom PNG normalization, capes and persona assets are not implemented.
- No native client rendering, save/reload observation or custom user-art demonstration was performed. Source generation is not gameplay verification.

## Source ownership and rights

The ordinary textures and geometry remain under the existing pinned upstream ledger. The seven online PNGs are not in that repository and are not automatically GPL just because Java requests them. Exact official URLs, original profile responses, source/output paths, model metadata and SHA-256 hashes are retained in assets/customer_skins and runtime/customer_skin_manifest.json. RP/LEGAL/CUSTOMER_SKINS.json and .md travel with the resource pack.

No separate player-art redistribution grant was found, and no public upload/release was performed here. Account identity is not proof of authorship. Keep these external-content notices distinct from GPL-covered port code and upstream resources; assess applicable rights before later distribution. No blanket block is imposed on unrelated GPL-covered work.

## Bedrock sources

- [Client entity texture aliases](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/cliententitydocumentation/cliententitydocumentationintroduction?view=minecraft-bedrock-stable)
- [Render-controller texture and geometry arrays](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationrendercontroller?view=minecraft-bedrock-stable)
- [Synced entity properties](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable)
- [Resource-pack overrides](https://learn.microsoft.com/en-us/minecraft/creator/documents/overwritingassets?view=minecraft-bedrock-stable)
- [Entity.id and stable API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)
- [Molang numeric and array behavior](https://learn.microsoft.com/en-us/minecraft/creator/documents/molang/syntax-guide?view=minecraft-bedrock-stable)

Legacy mirroring was also compared with the 1.20.1 processLegacySkin copyRect layout in a [decompiled code mirror](https://github.com/Blackjack200/minecraft_client_1_20_1/blob/c129e3e3e6ca89a731d4cfc35bb606c6bd2cae2c/net/minecraft/client/renderer/texture/HttpTexture.java). This is not a Mojang-published source repository. The actual input PNG and existing pinned geometry remain the recorded conversion inputs; no code from that mirror is bundled.
