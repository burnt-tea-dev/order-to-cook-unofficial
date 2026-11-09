# Full finite food stages and additional visual checks

2026-11-08, cloud Blockbench Desktop 5.2.2. This adds **21 real application
screenshots** to the [earlier sampled review](../README.md). No runtime files or
version identity changed. This is not Minecraft client or BDS acceptance.

Assets were opened from `45e1a6d5a845174cfb8ff4be1a463abb4f3ac9d6` (0.1.41).
Before integration, the reviewed models, textures, animations, motorcycle entity
bindings and converter were checked unchanged at the 0.1.42 main commit
`b0d54f4c7f1353788f82307227ac008b83d89c63`. The [manifest](manifest.json) records
81 input identities, 21 screenshot identities and three saved fixture/export
identities. The fixed Java source remains
`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`.

## What was actually viewed

| Content | Actual GUI coverage | Result and limits |
| --- | --- | --- |
| Stable dining food | All 40 formal stages and all 40 original Java stages, in groups of eight | Top views show the expected food, partial servings and leftovers without a newly observed missing texture. Additional isometric views cover stages 33–40. Not every face/angle or native block transition was tested. |
| Order machine | Idle, waiting and all 16 printing meshes, three groups of six | Complete body and visible paper rise across the finite poses. Not a running animation/controller or player-triggered printing test. |
| Placed takeout bag | All 11 finite meshes, groups of six and five | Texture and varying placement shapes visible. No playback timing, multiplayer or native placement conclusion. |
| Motorcycle steering | Neutral current geometry beside two source-equivalent ±45° yaw illustrations | Both handlebar and front wheel yaw visibly differ from the current straight state. This illustrates the independently verified source gap, not an implemented fix or real input test. |

The 40 dining stages refer to `models/entity/dining_plate.geo.json`, also bound
by the stable native dining-block stages. They do **not** mean the separate
countertop `food_plate_display_*` geometry, stage-zero helper animation, food
placement timing or visibility transition has been accepted.

### Dining views

In the top-view screenshots, each Java row runs left-to-right in ascending stage
order. The separately laid out Bedrock row runs right-to-left. This is a layout
ordering difference: the original Java import/export reflects X, while each
formal model was translated after conversion. Compare the same numbered stage,
not the same screen column. Exact offsets and inputs are in the
[layout manifest](layout-manifest.json).

| Stages | Original Java | Formal dining geometry |
| --- | --- | --- |
| 1–8 | [Top](evidence/java-plates-01-08-top.png) | [Top](evidence/dining-01-08-top.png) |
| 9–16 | [Top](evidence/java-plates-09-16-top.png) | [Top](evidence/dining-09-16-top.png) |
| 17–24 | [Top](evidence/java-plates-17-24-top.png) | [Top](evidence/dining-17-24-top.png) |
| 25–32 | [Top](evidence/java-plates-25-32-top.png) | [Top](evidence/dining-25-32-top.png) |
| 33–40 | [Top](evidence/java-plates-33-40-top.png), [isometric](evidence/java-plates-33-40-isometric.png) | [Top](evidence/dining-33-40-top.png), [isometric](evidence/dining-33-40-isometric.png) |

### Machine and bag views

- [Idle, waiting, printing 0–3](evidence/orders-00-05-isometric.png).
- [Printing 4–9](evidence/orders-06-11-isometric.png).
- [Printing 10–15](evidence/orders-12-17-isometric.png).
- [Bag meshes 0–5](evidence/bags-00-05-isometric.png).
- [Bag meshes 6–10](evidence/bags-06-10-isometric.png).

These machine/bag sheets contain the formal meshes with their actual textures.
They are not independent Java animation samples. The source curves and native
playback still need a separate comparison; the earlier source and finite-pose
tests do not substitute for that GUI work.

### Steering views

The left bike in each top-view image has the source-equivalent handle and front
wheel yaw; the right is the current neutral model. Both use the same existing
geometry and texture. Wheel roll is held at zero to isolate yaw.

- [Java −45° equivalent versus current](evidence/motorcycle-source-minus45-vs-current-top.png).
- [Java +45° equivalent versus current](evidence/motorcycle-source-plus45-vs-current-top.png).

Only those two bone Y rotations, name prefixes and translation differ in these
fixtures. The verifier reverses every permitted change and compares every field
with the formal model. See the [binding audit](../../MOTORCYCLE_VISUAL_BINDING_20261108.md)
for the actual Java input/smoothing/wheel semantics and unresolved Bedrock input
mapping. These are reviewer illustrations, not raw Java renderer screenshots.

## Independent Blockbench export

The original Java stages 1–8 were imported in the GUI with the original 160×160
texture. File → Convert Project → Bedrock Entity was used with **Create Copy**
enabled, followed by a GUI Bedrock-model export. The saved
[export](fixtures/blockbench-export-plates-01-08.geo.json) and its
[rendered view](evidence/blockbench-export-plates-01-08-top.png) are preserved.

After undoing the review layout and the formal atlas offset `(38, 2)`, all
**50 cubes and 260 faces** match the formal geometry, including sizes, pivots,
rotations and face UVs. Position tolerance is 0.0001 pixel because the independent
export rounds decimal coordinates. This compares an actual Blockbench export
against the project converter, not the converter against itself. It covers only
the first eight stages, not all 40.

## Warnings checked rather than hidden

The original Java sheet groups show 4 / 0 / 16 / 0 / 16 zero-size UV warnings.
The [issue panel](evidence/java-source-zero-area-uv-warnings.png) identifies the
zero UV sizes. Inspection of the fixed source verifies that all 36 are on
physically zero-area faces of thin cubes/planes. The review layouts do not change
their UVs. This is inherited source data, not evidence of a new port regression.
No warnings were suppressed and no original art was changed to make them vanish.

## Reproduction and checks

The [layout builder](build_stage_sheets.py) does not import the project converter.
It only prefixes bone names and translates origins/pivots, or translates original
Java element bounds and rotation origins. It independently reverses those edits
and compares all fields, preserving UVs, sizes and rotations. The 15 generated
layouts are review scenes, not installed pack files. Original source textures are
copied byte-for-byte when needed for Java's asset lookup.

From the repository root:

```sh
python docs/validation/visual-audio/blockbench-20261108/stage-review/verify_review_evidence.py
python docs/validation/visual-audio/blockbench-20261108/stage-review/build_stage_sheets.py . /tmp/otc-stage-review
```

The verifier checks input/evidence hashes, reproduces all 15 layout hashes,
compares the independent GUI export, checks the source's zero-area warnings and
limits the two steering illustrations to the declared edits. It is an offline
evidence check, not a renderer. The screenshots themselves came from the cloud
desktop application and were not synthesized from this verifier.

Local integration checks: the evidence verifier passed; full `npm run verify`
passed with 812 JavaScript tests and the generated-pack checks/build. Standalone
Python dining tests passed 4/4 and appliance geometry tests passed 23/23. This
documentation-only build is not a new runtime release. Existing runtime failures
and untested client gates remain open.

## Still open

The earlier appliance samples are not a review of every refrigerator/dishwasher
phase. Remaining furniture/storage stages, material variants, motorcycle colors
and light/helmet materials, player perspectives and remaining original animation
comparisons must be tracked separately. This batch does not close those gaps or
claim all addon models have passed. No local user machine, LIVE installation or
Minecraft client was used.
