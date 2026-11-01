# Third-party notices

## Order To Cook / 下单了

Original author: **breezeth / breezeth-CN**.

- Official project: https://www.curseforge.com/minecraft/mc-mods/order-to-cook
- Source: https://github.com/breezeth-CN/OrdertoCook
- Exact source commit: `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`
- License: **GNU General Public License, version 3**; the complete upstream license is included as `LICENSE`.

This project is an **unofficial, modified Bedrock adaptation**, maintained in
`burnt-tea-dev/order-to-cook-unofficial`. It is not the original Java mod and is not
presented as an official release or endorsement by its author. The first port
was prepared on 2026-10-09.

The gameplay rules were translated from Java into JavaScript. Original models,
textures, sounds and translations were copied or mechanically converted for
Bedrock. The conversion includes coordinate/UV conversion, split geometry for
the two-block refrigerator, native animation normalization, icon projections,
state poses and emissive alpha encoding. These are modifications to the original
work. The source-to-output hashes and exact operations are recorded in
`runtime/asset_conversion_manifest.json` and described in
`docs/ASSET_PROVENANCE.md`.

The original Java mod JAR is **not** included. Complete corresponding source for
this adaptation, build tools, tests and original conversion inputs are available
in this repository. `upstream/reference` is a clearly identified subset of the
pinned original source used by the asset converter; it is not another playable
Java distribution.

## Minecraft

Minecraft is a trademark of Mojang Studios / Microsoft. This is a community
add-on, not an official Minecraft product. Minecraft engine binaries and the
Bedrock Dedicated Server are not distributed in this repository or the add-on.
Vanilla item identifiers and food-component data are referenced for compatibility;
the food catalog source commit is documented in `docs/UPSTREAM_RULES.md`.

`@minecraft/server`, `@minecraft/server-ui`, TypeScript and Pillow are development
or runtime dependencies governed by their own licenses. They are not bundled as
third-party JavaScript modules in the `.mcaddon`.

The local build script embeds the GPL license, this notice and the rights register in each generated BP/RP package. Those locally generated packages are for private maintainer verification and author sample review only while the rights hold remains active; they are not authorised public downloads.

The port-authored code, scripts and build tools are declared GPL-3.0-only. Do not infer from that code licence that the upstream artwork, sounds, models, animations or translations have a separately verified redistribution grant.

## Rights-scope verification status

The upstream repository README declares GNU GPL v3 for the project and the
pinned upstream commit contains LICENSE.txt. This port preserves that license
and records every copied or converted upstream asset in
runtime/asset_conversion_manifest.json. However, repository-level licensing
does not independently prove that the upstream author owns or controls all
rights in every individual image, sound, model, animation and translation.
No separate third-party exclusion was found in the inspected pinned source
subset, but that absence is not proof of title. The rights holder's confirmation
for the complete asset set is still pending. Until that confirmation is
recorded in docs/ASSET_LICENSE_REGISTER.md, do not publish a public release
that redistributes the upstream asset bundle. The release CI gate enforces
this hold.
