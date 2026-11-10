# Independent finite overlap review

> Historical first-pass snapshot, local commit `4cc310c57f0fa48cc450526458c666d3a30521af`. Later door-back and near-coplanar stain-layer repairs are documented in the parent report. Its input hashes and counts bind only that snapshot, not the later candidate. The nonzero-alpha occlusion assumption below misses alpha-tested openings; zero same-facing records never established absence of the user-reported flicker.

## Verdict

The five narrow repair families are supported by this review: exact duplicate chair leg, dishwasher drawer caps, meal stages 5/6 cap joins (both block and entity outputs), helmet visor joins, and the motorcycle chest connector. The reviewed working-tree snapshot retains 450 geometry identifiers in 410 files. Its positive-area coplanar candidate count falls from 2,977 to 2,774, not to zero. Coplanarity alone is not a defect.

With resolved textures, all four dishwasher visibility tiers (0, 1, 2, 3+ dishes), four motorcycle colors, and its emissive texture, the baseline has 33 sampled same-facing/differing-nontransparent/exposed records. The candidate has zero such records. These records include repeated states and material variants; they are not 33 distinct defects. This is a finite geometric/texel detection result, not native rendering acceptance or an all-view proof.

Two opposing-face records remain for meal stage 2, and customer animation overlaps remain unresolved. Do not describe this change as eliminating every model or animated overlap.

## Identities and provenance

Baseline: commit `a4176b193294d8f57234b3b316ad6b092acf5d5b`.
Upstream OTC source: `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`, repository `https://github.com/breezeth-CN/OrdertoCook`, GPL-3.0-only. See `input-identities.json` for the complete pinned lock and separate baseline/candidate SHA-256 values for all 89 changed runtime files. The candidate is a working-tree snapshot, not a claim of a published commit.

The source assets, textures, customer rig, and customer animations are unchanged. These are explicit Bedrock output adaptations, not assertions that every corrected corner remains source-exact. The motorcycle oracle retains strict source equality by default; its caller supplies only the known connector translation when testing adapted output.

## Targeted changes checked

- Chair: exact duplicate root cube 3 removed; duplicate cube was identical to root cube 2, including UVs. Candidate pairs 11 to 4. The remaining four are leg/seat mating interfaces.
- Dishwasher: inner drawer origin Y +0.015 and height -0.03 before baking. All 82 baked geometries inherit it. Candidate pairs 364 to 200. A baseline differing witness occurs at phases 4/6 frame 9, group3 cubes 0/1 down. The outer body opening is alpha-transparent over the interior; it must not be treated as an opaque z-fighting panel.
- Meal stages 5/6: cap Z inset 0.015 per end. Source models are `models/block/food_plate_anim/2_1.json` cap indices 3/4/5/6 and `2_2.json` cap indices 3/4. The shared Java-model conversion reaches both food_plate_display and dining_plate. Per-family pairs 230 to 218. The side/top UV crops follow the reduced physical axis and preserve surviving texel density. No PNG changes.
- Visor: front X trimmed 0.0625 per end to meet side-panel inner edges at ±5.1375. Front N/S and up/down U are cropped proportionally. Pairs 6 to 2; the remaining two are opposing internal contacts. The original front/side north overlap included blue alpha 50 and white alpha 255 at the same position. Shell/visor combined scan found no coplanar positive-area cross-geometry pairs before or after the proposed repair.
- Motorcycle: chest cube 4 translates Y +0.015 only. Size, inflation, box-UV parameters and four color PNGs remain unchanged. Pairs 8 to 4, with no new coplanar pairs. Baseline underside witnesses: chest0/down versus chest4/down and chest3/down versus chest4/down, each area 0.0609. The remaining body/chest, body/handle, and two wheel-support pairs are opposing mating interfaces. The emissive texture is transparent at all these candidate overlaps.

## Remaining-family classification

- Refrigerator: 176 baked geometries, 993 within-geometry pairs. An additional assembled check pairs all 88 matching lower/upper states with the upper half offset by 16 model units; it finds 16 cross-half pairs, all opposing-facing, and no same-facing pair. Mostly signed-cavity inner faces, shelf/cavity contacts and closed-door contacts. Alpha holes exclude several nominal plane intersections. Neither outward nor inward normal sampling found differing exposed fragments. This does not prove all oblique views safe.
- Dishwasher count bones: visibility expressions have only four distinct geometric tiers (0, 1, 2, 3+). The classifier tests all four. Dirty/clean content in the imported source should not be mistaken for simultaneously active runtime content.
- Board: 12 pairs. Six opposing support contacts; six same-facing intersections of rotated components. Sampled differing overlap points are covered by other opaque parts. No indiscriminate epsilon shift is recommended.
- Takeout bag: 11 baked geometries, 44 pairs. Fold intersections are source-authored; no exposed differing sample was found along either face-normal direction. Retain unless a separate view demonstrates a conflict.
- Countertop, shelf, plate shelf, stove, washingtable: principally opposing mating surfaces, stacked-paper/plate contacts, or transparent source regions. No detected same-facing, differing, exposed sample. Water transparency is not certified by this classifier.
- Other meal stages: many opposing faces and intended zero-thickness source planes. Stage 2 root3/east and zero-width root4/west differ in texture while sharing a plane. They face opposite directions. This is material-sidedness dependent, not evidence for deleting the source-authored plane. Native alpha/backface behavior is untested; retained explicitly.
- Helmet shell: nine within-shell pairs are opposing contacts. Visor blending remains a separate native/material-ordering limitation even after geometric separation.
- Customers: wide and slim render-controller variants are mutually selected, not simultaneous geometry. Their 139 bind-pose pairs do not represent the active animated pose space. A bounded review of 170 poses across both rigs and all 15 declared clips found 71 poses containing 311 sampled exposed differing pair instances. These include knees, sleeves, neck/torso and torso/leg contacts. The known source/RP sleeve diagnostic at `docs/validation/visual-audio/customer-remaining-20261109/sleeve-overlap.json` already documents source-equivalent overlap. No universal safe offset was established across motion. Do not alter rig, skins or animations based only on this static repair.
- Imported originals: nine identifiers have no runtime JSON reference; eight of them contain 203 raw pairs. They are retained provenance/reference geometry, not active model failures. Their unused count alone is not a license to delete them.
- Geometries with no raw candidate are only clear under the finite coplanarity predicate; they are not certified free of intersections, near-coplanarity, animation effects, or separate render-pass effects.

## Method and limits

`census.py` transforms cube and ancestor-bone corners, includes inflation, groups planes within numeric tolerances and clips face polygons to require positive area. It does not infer defects. The classifier resolves actual material paths and UV rotations, uses the repository's retained geometry transform helpers and physical-corner motorcycle box-UV oracle, and samples a deterministic 64×64 grid inside each face/intersection. It checks up to 64 differing points along the outward normal against other textured faces. Extra inward-normal checks were run on relevant baseline families and found no additional exposed differing witness.

Zero-thickness face orientation follows winding, not a centroid sign test. An early exploratory centroid inference was corrected before these final results. Opposing faces, invisible count bones, all-transparent texels, identical colors, and unreferenced imported models are distinguished.

Absence of a sampled witness is not proof that the overlap is harmless. Thin texel strips can escape finite sampling, normal rays do not cover every oblique view, nonzero-alpha occluders are conservatively treated as blockers even when blended, and native draw order/depth precision/backface behavior are not reproduced. Small epsilon separations also remain subject to native distance/depth precision. Continuous motion, transitions, query ranges, network state, full assembled scenes, and the user's Minecraft client were not exercised. No PC, LIVE world, client, BDS or GUI was used for this independent review.

Customer sampling fixes head target queries at zero and uses clip endpoints, quartiles, and 4.0 seconds when within duration. The repository's prior oracle notes that relevant Catmull-Rom tracks are constant; this sampler does not claim a general Catmull-Rom engine. It does not evaluate animation controllers' action clocks or native blending.

## Reproduction

Requires Python 3, NumPy and Pillow already available. Use a checkout/snapshot containing `runtime/`, `tools/render_visual_review.py`, `tools/convert_assets.py` and `tests/motorcycle_oracle.py` matching the identities. Scripts only read that checkout and write the explicitly supplied output.

```
python census.py REPO census.json
python classify.py REPO census.json classified.json
python dynamic_scan.py REPO census.json customer-samples.json
python fridge_pairs.py REPO census.json fridge-cross-half.json
```

`input-identities.json` separates baseline and repaired runtime inputs. `summary.json` records concise count/selection facts; full machine outputs can be regenerated. The portable customer sampler was executed against the candidate and reproduced the earlier 170-pose output exactly. Human source-intent classifications above are not mechanically proven by the scripts.
