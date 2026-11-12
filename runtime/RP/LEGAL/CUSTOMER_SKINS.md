# External customer-skin inputs

The customer identities come from CustomerProfileLibrary.java in breezeth-CN/OrdertoCook at e59e3dbcabe19b783d9adb933db5fcb8bc1e4642. The Java mod requests their current public Minecraft profile skins. The seven PNG files here were retrieved from the Mojang session server and textures.minecraft.net on 2026-11-11 for the user's requested local Bedrock restoration.

These PNG files are external player content, not files in the pinned OrderToCook repository. The repository's GPL declaration is not asserted to relicense them. The Minecraft accounts identify the profiles using the skins, not necessarily their original artists. No separate permissive redistribution license or rights-holder confirmation for these PNG files was found. Preserve this notice, the profile responses, exact URL and hash records. No public release or upload of these snapshots was performed as part of this source change. A later distributor must assess the applicable rights for its destination; this is not a claim of Mojang or account-holder endorsement.

The metadata and conversion code are part of the GPL-3.0-only adaptation. The PNGs are copied without modification. Profile model metadata selects the Java-derived wide/slim customer geometry. Assumine's original 64x32 PNG uses a derived classic legacy geometry with mirrored left-limb UVs and no body/limb overlays; its transparent head overlay is preserved. No PNG is resized or repainted. These are fixed dated snapshots, not an online skin cache or live account lookup.

manifest.json lists the account names and UUIDs from pinned Java, the resolved Mojang profile names, official profile/texture URLs, image SHA-256, model and retrieval time. profiles/*.json preserve the public profile responses. special/*.png are the exact input bytes. tools/customer_skins.py generates the corresponding BP catalog, RP references and separate customer_skin_manifest.json; these external PNGs are deliberately not included under the upstream GPL asset ledger.

## Optional custom inputs

Place your own 64x64 PNG files in customs/custom_wide_1.png, custom_wide_2.png, etc. and customs/custom_slim_1.png, custom_slim_2.png, etc. Add customs/NOTICE.md identifying their sources and rights. Each sequence starts at 1, stops at the first missing number and is capped at 512, matching Java's resource scan. No sample or invented skin is supplied.

Run the normal asset converter with --customer-skins-only after changing these source inputs. Enable customMultipleCustomerSkins through the existing server config event only after installing the resulting paired pack. Default is false. An empty sequence falls back to that model's ordinary skin. A special profile always takes precedence.

Higher-priority resource packs may replace registered texture paths. Bedrock does not provide the Java resource-manager scan at runtime: adding a new numbered skin requires regeneration of the registered aliases/arrays and a fresh paired version. A resource pack that only adds an unregistered filename is insufficient. Use the same generated customer client entity and render controller when creating a compatible higher-priority custom pack; preserve the special profile aliases. See docs/CUSTOMER_SKINS.md for the supported workflow and remaining differences.
