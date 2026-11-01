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

The build script embeds the GPL license, this notice and the rights register in
each generated BP/RP package. The port-authored code, scripts and build tools are
declared GPL-3.0-only. Preserve upstream notices and provide the corresponding
source when distributing covered modified works.

## Rights-scope verification status

The upstream README declares GPLv3 for the code and the pinned source includes
LICENSE.txt. Source and conversion evidence are retained; no separate author
confirmation covering every asset has been recorded. The pending supplementary
inquiry is an advisory record, not a blanket publication veto or a claim that
all asset rights have independently been proved. It is not necessary to obtain
a second grant for material already covered by the applicable GPL grant.

Any concrete asset-specific licence conflict or credible ownership objection
must still be resolved for the affected material. See
`docs/ASSET_LICENSE_REGISTER.md` and `docs/RELEASE_COMPLIANCE.md`. The earlier
blanket hold based only on an unanswered author inquiry has been superseded.
