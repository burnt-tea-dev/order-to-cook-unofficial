# Dirty plate layer audit and proposed repair

Audited 2026-11-10. This read-only audit did not modify repository files. All prototype artifacts are local to this folder. The separate dishwasher door repair is outside this stain-layer review. See INTEGRATION_REVIEW.md for the subsequent shipped-asset review.

## Finding and scope

39 of the 40 `upstream/reference/common/src/main/resources/assets/ordertocook/models/block/food_plate_anim/{family}_{phase}.json` models have a zero-thickness upward-only stain face at Java Y=1.01563 over a plate top at Y=1. This gap is 0.000976875 blocks. Stage 36 (`9_4`) has no such stain quad. The gap is a credible depth-precision risk, not proof of a reproduced native-client defect.

The forty food stages have two generated geometry paths: `runtime/RP/models/blocks/food_plate_display_1..40.geo.json` and all stages in `runtime/RP/models/entity/dining_plate.geo.json`. `tools/convert_assets.py` calls `convert_java_model` for both. The normal `dining_plate_block` binds the latter geometry to the shared dining atlas under `alpha_test`. `runtime/BP/scripts/dining.js:syncVisual` normally removes the visual actor for stages >0; the actor still exposes all 41 geometry variants under `entity_alphatest`. Both paths should receive the same repair, without touching this lifecycle logic. Stage zero is the separate placed-food Geo and has no stain overlay.

The carried/inventory `dirty_plate` is a flat item icon rendered from the one-cube upstream `block/dirty_plate_item` and `item/food_plate2.png`; its stain is already in that texture. There is no plate attachable. The washing-table plate-count sources contain one ordinary solid cube per plate (counts 1..10), referencing `block/washingtable.png`; their stains are already baked. The washing-table placed material is `blend` because its separately sourced water is translucent; leave its material and geometry unchanged. Dishwasher `drity_dish` has six textured cuboids in `geo/block/dishwasher.geo.json`, with stains encoded directly in `block/dishwasher.png`; no stain decal is present. Its phase-2 material is `alpha_test`. These are not candidates for a blanket stain-height offset or this four-top bake.

## Safe semantics

Use the existing source pixels, mechanically flattening each near-surface stain into a duplicate of the plate's top texture. Rebind only the base cube's `up` face and remove only that one stain quad. Preserve all other cubes/faces/material options. Invoke after `separate_food_cap_faces` so the original cap indices remain correct. Keep family 10's other food decal at Y=1.0625, not a stain, untouched.

The 12x12 clean plate top has alpha 255 everywhere. Orange stain: 37 pixels alpha255 and 107 alpha0. Half stain: 18 pixels alpha255 and 54 alpha0 across its 12x6 footprint. Alternate family8 stain: 79 pixels alpha255 and 65 alpha0. There are no partial alpha values. Exact choose-opaque-stain-else-base retains colors under both active cutout materials and avoids guessing the engine's alpha cutoff. This does not claim identical minified/filtering output or client lighting; those still need native review. The original 0.01563px layer height/parallax is intentionally removed.

Four tiles are necessary:
1. Standard orange full stain: 27 models. Crop source (0,26)-(12,38), over plate top (0,0)-(12,12).
2. Family2 half stain: 4 models. Only the top six source rows (0,26)-(12,32), pasted at base (0,0).
3. Family8 alternate stain: 4 models. Crop (39,37)-(51,49), flip vertically before pasting. Original source V direction is opposite the plate top; do not omit this flip.
4. Family10 shifted stain: 4 models. Standard orange crop pasted at base (0,1). Its source-last-row overhang is entirely transparent; reject any source change that makes it opaque.

A new **16x64** derivative texture contains these four 12x12 tops in 16x16 cells, each with two pixels of clamped edge padding. Bedrock normalized top UV is `[2, slot*4+.5]`, `uv_size=[12,3]`. The V range is divided by four because the texture is four times taller than 16. Do not use `[12,12]` as UV size on this tall image.

## Copy-ready implementation

`proposed_stain_helpers.py` contains the complete source-contract-checked `food_stain_sheet(Image)` and `flatten_food_plate_stain(name,cubes)` helpers plus stable texture names. It is deliberately not installed in the checkout. `verify_helpers.py` compares the helpers to the original Java physical-coordinate sampling, not to their own crop algorithm. All five tests passed, including 5,616 exact RGBA samples, unrelated-cube preservation, all39 plane removals, alpha rejection, changed-source rejection, and no-op dirty-item/sink/stain-free paths.

## Integration points

1. Copy helper constants/functions into the converter. Leave original source and copied `food_plate_variants.png` unchanged.
2. In `make_textures_and_sounds`, after normal texture copying, generate `RP/textures/ordertocook/block/food_plate_stains_baked.png` from the pinned source PNG. Add terrain key `ordertocook_block_food_plate_stains_baked` pointing at that file. Record derivation from source PNG, not an invented source path. No new artwork or original PNG editing is needed.
3. In `convert_java_model`, run `flatten_food_plate_stain(model_name,converted)` after `separate_food_cap_faces`. When true, register the new material by copying the old food-variants material options and replacing only its `texture` key; do not let its wildcard replace the existing default. Add a provenance operation noting stain-to-top flattening. Preserve original cap tests by checking cap repair before removed index1, or remap their expected indices afterward.
4. In `make_dining_plate`, append the new baked image **after** sorting/loading original source images. Do not add it to the list before sorting. Existing images remain at atlas x=2 and x=38; the new image starts x=202. Total padded width220 still rounds to256; max height164 still rounds to256. Retain existing two-pixel atlas boundary extrusion. Record the new atlas contribution against the source PNG and relevant model files; do not pass a generated RP path to `record`, which expects SOURCE-relative inputs. Atlas material references are removed as usual after remapping, so entity and dining-block material bindings stay unchanged.
5. Regenerate pack artifacts, then tests should verify both geometry outputs have no removed stain plane, all39 base `up` faces use baked UVs, stage0 and9_4 are unchanged, original texture bytes/atlas source regions are unchanged, all unaffected food cubes/faces and family10's food decal are retained, provenance mentions the adaptation, full `npm run verify` passes, and a second regeneration is deterministic.

## Evidence artifacts

- `audit_stain_bake.py`: read-only audit, exact world-coordinate sampling, artifact creation.
- `audit.json`: all40 source models, their stain indices, four layouts, alpha counts and mapping.
- `proposed_stain_helpers.py`: complete proposed helper implementation.
- `verify_helpers.py`: five independent passing tests.
- `food_plate_stains_baked.prototype.png`: exact 16x64 proposed derived sheet.
- `dirty-terminal-bake-preview.png`: current/prototype terminal states for all10 families, inspected visually. It is CPU-rendered, not a game screenshot.

No native Bedrock test, LIVE world access, or user-PC action was performed. Native validation should move the camera across distance/grazing angles and test high world coordinates, all dirty stages, both block render paths and the legacy actor path, with current/upcoming renderer settings. Static elimination of the redundant face pair is justified; claiming the reported flicker is confirmed fixed is not.
