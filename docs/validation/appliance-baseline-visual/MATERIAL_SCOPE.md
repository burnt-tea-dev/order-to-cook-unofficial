# Dishwasher material source scope

This source-only audit supplies limits for interpreting the Blockbench control.
It does not establish a native defect, authorize a runtime material change or
claim native transparency parity.

## Verified inputs and declared paths

The source and .46 canonical dishwasher PNG bytes match, SHA-256
`7c85e91a5fb2a8baff87528cec4512cf63dc4004ee209aad8ba169755eb97c90`.
The actual image is **64×64**. Its alpha histogram is 0:1326, 100:16, 161:8,
255:2746 texels. All 24 partial-alpha texel centers overlap the original
`group5` first cube's north `[36,37]+[12,9]` and south `[36,46]+[12,-9]` UV
rectangles. This is a static UV overlap, not proof of visible fragments.

The fixed runtime block binds `alpha_test`, with `ambient_occlusion: false`.
All 82 geometry-pose permutations retain this material; none supplies another
material or geometry-culling rule. `face_dimming` is omitted and the official
schema inspected defaults it to true. Source binding and per-texel details are
in [material-checks.json](material-checks.json), rechecked against the bundled
.46 inputs by the verifier.

The pinned OTC [DishwasherRenderer](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/DishwasherRenderer.java)
and [DishwasherGeoModel](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/DishwasherGeoModel.java)
do not override render type. The model inherits GeckoLib 4.8.3's
[`RenderType.entityCutoutNoCull(texture)`](https://github.com/bernie-g/geckolib/blob/e81962eefd04e0cab90445d3df37b477d2767ffd/Forge/src/main/java/software/bernie/geckolib/model/GeoModel.java#L98-L99).
Original Java bytes and provenance are included or reused from the fridge report.

## Official Java 1.20.1 evidence

The official distribution was inspected as ZIP/class-file data, not executed.
[Official version metadata](https://piston-meta.mojang.com/v1/packages/72ae93b0934df5541860e3e6b72cf883c74da491/1.20.1.json)
binds client SHA-1 `0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838` and mapping
SHA-1 `6c48521eed01fe2e8ecdadbd5ae348415f3c47da`. Only the URL/hash provenance is
included here, not the archive, mapping file or compiled classes.

The archive's `rendertype_entity_cutout_no_cull.fsh` lines 22–24 sample the
texture and reject `color.a < 0.1`, before tint, overlay, lightmap and fog.
SHA-256: `05af797273b1fcba6a9c447c25dc9097cb22becfd4621ef01c43be15f79e599b`.
Direct samples of both 100/255 and 161/255 survive this test; zero does not.
This alone does not require Bedrock `blend`.

Mapped class source-line range 167–176 of RenderType (bytecode offsets 0–72)
selects the cutout-no-cull shader, texture blur=false/mipmap=false,
`NO_TRANSPARENCY`, `NO_CULL`, `LIGHTMAP` and `OVERLAY`. RenderStateShard source
lines 55–58 connect the no-transparency setup to `disableBlend()`. These are
mapping/LineNumberTable references, not citations to a third-party decompile.
The shader does not replace surviving alpha with 1 and its JSON also declares
blend factors, so neither the method name nor that JSON alone establishes every
final framebuffer result. Java entity lightmap/normal lighting also differs from
Bedrock terrain face dimming. No native output was measured.

## Bedrock boundary

The pinned [official render-method documentation](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/creator/Reference/Content/BlockReference/Examples/BlockComponents/minecraftBlock_material_instances.md#render-method-choices)
and [schema](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/content/forms/block/material_instance.form.json#L69)
describe `alpha_test` as binary transparency with backface culling disabled;
`blend` is a different translucent method. They do not provide a numeric cutoff
or per-material custom cutoff for the inspected custom-block path.

**Not proven:** target Bedrock cutoff, survival of the 16/8 partial-alpha texels,
matching filtering/lighting/depth, native face-order behavior, or a pane defect.
Do not assume a cutoff of 0.5, flatten the PNG alpha or switch to `blend` from
this evidence. The preview face-order result is separate from native acceptance.

Exact official source URLs and hashes are in
[java-official-provenance.json](provenance/java-official-provenance.json) and
[bedrock-docs-provenance.json](provenance/bedrock-docs-provenance.json). These
citations record the completed read-only source audit; the offline verifier
checks bundled geometry/material/PNG facts but cannot reproduce external
class-file/shader inspection without those intentionally unbundled game assets.
No network retrieval is needed or attempted by the verification command.
