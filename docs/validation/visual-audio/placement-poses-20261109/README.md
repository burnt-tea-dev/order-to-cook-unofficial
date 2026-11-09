# Placement and pose comparisons

Six finite source/runtime fixtures for printer, takeout bag and stage-zero plate.
The runtime is unchanged `0.1.48-alpha.1` at
`dbb2574154a54cc5ad69e75e71d23900a98a79fe`. This evidence is documentation only.

## Numeric result

The four printer/bag poses agree with the pinned Java hierarchy and authored
formula at the corresponding actual NORTH RP frames. Maximum physical-corner
residual is **0.000000742 model pixels**, consistent with six-decimal runtime
rounding. Physical face UV coordinates match exactly.

The two plate poses retain all nine cubes and their hierarchy. The original
32×32 PNG is RGBA-identical to atlas pixels `[2,2]..[34,34)`. Every RP corner has
the deliberate **+0.2 model-pixel Y parent offset**, with no other meaningful
residual. This is the documented +0.0125-block anti-z-fighting anchor in
[asset provenance](source/context/ASSET_PROVENANCE.md) and the saved dining test,
not a newly discovered defect. Neither visible native floating nor an
actor-to-block jump is established here.

No new runtime geometry or physical-UV mismatch is established by these six
cases. That finding does not accept native materials, clocks, orientation or play.

## Scenes and identity

SOURCE assembly X=−18 and RP X=+18 identify model coordinates, not apparent screen
left/right. Coordinates are model pixels, 16 per block. Y origins are preserved.
The plate reference slab tops are Y=0 on both sides and are not game materials.

| Scene | Frozen time | Selected behavior |
| --- | --- | --- |
| [01 printer frame 2](scenes/01_printer_frame2.bbmodel) | 2/15 s | Positive wobble; scale 1.0433333333; paper `[0,−0.8,−0.25]` |
| [02 printer frame 4](scenes/02_printer_frame4.bbmodel) | 4/15 s | Negative wobble; scale 0.9566666667; paper `[0,0.4,0.25]` |
| [03 bag frame 3](scenes/03_bag_frame3.bbmodel) | 0.1 s | Positive wobble; scale 0.9999700060; Y=0.4 |
| [04 bag frame 7](scenes/04_bag_frame7.bbmodel) | 0.3 s | Negative wobble; scale 0.9799819928; Y=0.2 |
| [05 plate settled](scenes/05_plate_settled.bbmodel) | 0.5 s | Settled nine-cube form; intentional RP parent Y=+0.2 |
| [06 plate rebound](scenes/06_plate_rebound.bbmodel) | 0.1667 s | Scale 1.05; Z=+0.4600534644°; Y=0.3333 plus RP parent +0.2 |

Printer/bag use their actual NORTH block permutation, rotation `[0,0,0]`, terrain
aliases and original PNG bytes. Plate comparisons are **anchor-local in the same
model direction**. Native dining actors use saved customer yaw+180; editor yaw
zero does not prove the native actor-to-block facing relationship.

Exact inputs are pinned in [input-manifest.json](input-manifest.json):
Java OTC `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`, GeckoLib 4.8.3
`e81962eefd04e0cab90445d3df37b477d2767ffd`, the .48 runtime, and official
Blockbench 5.2.2 codec source-map excerpts. The public docs base is
`78c615f219314f719489987d59b51c678cc42095`, tree
`6d54021e860eab653b721440a2236631ac6f9fff`.

## GUI observations

GUI capture is pending. No screenshots or camera findings are claimed by this
staging copy. The original numeric report's `gui_run: false` remains unchanged.

## Replay

From this directory, with Python 3, Pillow and Node already available:

```sh
python -B verify_review.py
```

This is offline and read-only. It verifies package and input identities, source
contracts, actual runtime bindings, every physical corner and face UV, original
embedded PNG bytes, the complete atlas tile, deterministic scene reconstruction
and an exact official Blockbench `parseCube` excerpt in a minimal data-only Node
harness. It imports no production converter or previous CPU renderer. It writes
only JSON to stdout. [METHOD.md](METHOD.md) explains the independent formulas,
coordinate conventions and the harness trust boundary.

[validation.json](validation.json) preserves the original successful numeric
report. That report ran no GUI or native client; later GUI observations are
separate evidence. Numerical controls cover source key times, idle hidden paper,
waiting paper and settled bag frame 0. Six negative mutations detect wrong wobble
sign, omitted paper motion, lost scale, removal of the intended plate offset,
atlas-corner shift and radians/degree confusion. They do not constitute engine QA.

[provenance.json](provenance.json) explains the public projections: acquisition
paths, one-time collection code, unrelated reports and coordination data are
omitted. Source/runtime/scene/texture bytes are unchanged. Original acquisition
manifest hashes are retained without presenting projected metadata as originals.
[artifact-hashes.json](artifact-hashes.json) covers the complete public package
except itself. The verifier rejects missing, extra, changed and symlinked files
and escaped paths. These hashes are consistency checks, not a signature.

## What this does not prove

Both editor halves deliberately use **Double** as a common geometry/UV control.
Java's default `entityCutoutNoCull`, RP block `alpha_test` and plate
`entity_alphatest` are recorded independently. Double does not emulate native
alpha cutoff, culling, lighting, AO or contact shadows. PNGs are not resized;
negative face UV extents are retained. Unsupported box UV, mirror, inflate,
rescale and material overrides are rejected rather than approximated.

Frozen clip-local samples do not execute native clocks, STOP/reset, re-entry,
late load, stage changes, interaction or multiplayer. The oracle uses doubles
with a 3e−6 model-pixel tolerance for rounded RP fields, not Java/Bedrock GPU
bitwise equivalence. The rebound scene checks animated parent scale/rotation and
child pivots that the settled scene cannot exercise.

Earlier evidence remains valid within its original bounds: all 18 printer and
11 bag FORMAL-only meshes were already photographed, and the earlier independent
CPU run sampled printer 0.2 s, bag 0.15 s and plate 0.1667 s. These six comparisons
supplement those results; they do not rewrite their status or repeat the 40 stable
food stages, customer batches, appliance fixes or countertop states.

For the separate, still-unimplemented refrigerator content layer, see the
[source/API contract](../FRIDGE_ITEM_DISPLAY_CONTRACT_20261109.md). This bundle
includes its exact source proofs but no runtime candidate.

## Attribution

OTC models, animations, textures, source and new review derivatives are
GPL-3.0-only. GeckoLib sources are MIT. Blockbench source excerpts are GPL-3.0.
See [license notices](licenses/NOTICE.md) and full adjacent licenses. Official
Mojang sample JSON and its [original license](fridge/official-api/Mojang-LICENSE.md)
are included only as reference sources. No Java mod JAR, Minecraft binary or
Blockbench application is redistributed. The gray support texture is solely a
review aid.
