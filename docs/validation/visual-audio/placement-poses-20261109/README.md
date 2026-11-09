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

All six frozen scenes were inspected in **Blockbench 5.2.2** on 2026-11-09.
The eight primary images below are original 1188×848 full-window JPEGs, with no
crop, resize, recompression, pixel edits or labels added. Both complete assemblies
are in each primary frame, without selection outlines or transform handles.

**Screen left is RP; screen right is SOURCE in every primary view.** The
[selection control](screenshots/controls/source_screen_mapping.jpg) visibly marks
the SOURCE root on screen right. The recorded negative-Z cameras preserve that
order; the mapping is not inferred from the assembly X labels alone.

| Frozen scene | Original GUI views | Bounded observation |
| --- | --- | --- |
| Printer frame 2 | [Paired](screenshots/01_printer_frame2_paired.jpg) | Paper opening, low paper projection, silhouette and visible texels match. |
| Printer frame 4 | [Paired](screenshots/02_printer_frame4_paired.jpg) | Raised paper, opposite lean and smaller form match. |
| Bag frame 3 | [Paired oblique](screenshots/03_bag_frame3_paired.jpg) | Carrot panel, folded side and upper handle-region texture match. |
| Bag frame 7 | [Paired oblique](screenshots/04_bag_frame7_paired.jpg) | Opposite lean retains the matching panel, side attachment and silhouette. |
| Plate settled | [Front](screenshots/05_plate_settled_front.jpg), [oblique](screenshots/05_plate_settled_oblique.jpg) | Tiered form and visible texels match. The front view shows the small RP gap above its support, consistent with the intentional +0.2-model-pixel parent offset. |
| Plate rebound | [Front](screenshots/06_plate_rebound_front.jpg), [oblique](screenshots/06_plate_rebound_oblique.jpg) | The slightly tilted/enlarged form and visible texels match while retaining the RP parent offset. |

No new shape or physical-UV discrepancy was observed in these finite views.
The plate offset remains the existing anti-z-fighting design, not a new defect.
Whole assemblies in frame do not make every occluded face visible; the plate
front silhouettes are supplemented by oblique views of the top and side surfaces.

Actual camera settings were entered and read in the editor's Save Angle dialog:

| Uses | Projection | Camera position | Focal point | Raw control |
| --- | --- | --- | --- | --- |
| Both printer views | Orthographic | `[0,24,-80]` | `[0,8,0]` | [Printer](screenshots/controls/printer_camera_definition.jpg) |
| Both bags and both plate oblique views | Orthographic | `[-30,25,-80]` | `[0,8,0]` | [Oblique](screenshots/controls/bag_camera_definition.jpg) |
| Both plate front views | Orthographic | `[0,4,-80]` | `[0,4,0]` | [Plate front](screenshots/controls/plate_camera_definition.jpg) |

No subsequent pan, orbit or zoom was reported after applying each camera preset.
A separate numeric zoom value is not claimed. The 17 raw control images document
these three cameras, [editor version](screenshots/controls/editor_version.jpg),
screen mapping, and SOURCE/RP Texture Properties for every scene. Those dialogs
show **Inside and Outside**, the editor label for the fixture's explicit Double
setting, with Default render mode and the original per-texture UV sizes.

[gui-evidence.json](gui-evidence.json) links every image hash, scene hash, camera,
visible root group, texture control and observation. It is an explicit public
metadata projection, not a copy of the acquisition report. The screenshots are
unchanged originals. The original numeric `validation.json` and its
`gui_run: false` remain unchanged; this GUI record is separate evidence.

These observations do not establish native alpha/culling/AO/light, contact
shadows, actor yaw, clocks, stage transitions, interaction or multiplayer parity.
No Minecraft client or BDS was run for this comparison.

## Replay

From this directory, with Python 3, Pillow and Node already available:

```sh
python -B verify_review.py
```

This is offline and read-only. It verifies package and input identities, source
contracts, actual runtime bindings, every physical corner and face UV, original
embedded PNG bytes, the complete atlas tile, deterministic scene reconstruction
and an exact official Blockbench `parseCube` excerpt in a minimal data-only Node
harness. It also checks all 25 GUI image identities, JPEG format/dimensions and
recorded scene/camera/control associations. It does not recapture a GUI or prove
visual observations by reading metadata. It imports no production converter or
previous CPU renderer. It writes
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
except itself. The verifier rejects missing, extra, changed and nonregular
entries, including symlinks and FIFOs, and rejects escaped paths. These hashes are consistency checks, not a signature.

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
