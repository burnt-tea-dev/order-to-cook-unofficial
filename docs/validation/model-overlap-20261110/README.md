# Model overlap audit and narrow repairs — 0.1.53-alpha.1

## Result and scope

All **450 geometry IDs in 410 runtime geometry files** were scanned, including cube inflation, nested bone transforms, cross-bone faces, per-face/box UVs and positive-area coplanarity. Source: main `a4176b193294d8f57234b3b316ad6b092acf5d5b`; upstream OTC `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`. The source files, textures, original/imported reference geometries, customer rig, animation clips, gameplay, collision and pack UUIDs remain unchanged.

Five repair families are supported. Raw positive-area face pairs decrease **2977 → 2774** (203 fewer). The independent finite classifier's same-facing, differing-nontransparent, outward-exposed records decrease **33 → 0**, counting repeated states/material variants. Neither number proves all-view or native flicker absence. See the [independent review](independent/REVIEW.md), [summary](independent/summary.json), [input hashes](independent/input-identities.json) and [negative controls](negative-controls.json).

**Not fully resolved:** customer animated seams, meal stage 2's source-authored zero-width opposite-facing plane, native transparency/depth precision and continuous motion. This is a draft source repair, not a claim that every OTC flicker has been fixed. No Minecraft client, BDS, LIVE world or user's PC was used.

## Repairs

| Family | Narrow output adaptation | Evidence and preservation |
|---|---|---|
| Chair | Remove root cube 3, exactly identical to cube 2 | Seven cubes become six, no vertex/UV movement; pairs 11→4 |
| Dishwasher | Inner basket Y+0.015, height−0.03 **before** posing | All 82 shipped phase/frame geometries; outer shell, X/Z walls, UVs and plate groups unchanged; 164 cap pairs removed |
| Meal 5/6 | Rotated food caps inset Z 0.015 at both ends | Shared conversion fixes block and dining actor; side/top UV cropping preserves surviving texel density; 24 pairs removed across both families |
| Helmet visor | Trim front X 0.0625 at both ends to side-panel inner edges ±5.1375 | Front N/S and up/down U cropped, sides/shell/PNG unchanged; 6→2 opposing contact pairs |
| Motorcycle | Translate chest connector cube 4 Y+0.015 only | Box dimensions, inflation and box-UV layout unchanged across four colors and emissive layer; 8→4 opposing mating pairs |

All lengths are model pixels (16 per block), not blocks. Source guards reject changed source contracts. These are documented Bedrock adaptations, not source-exact vertex claims. The motorcycle oracle stays source-exact by default; its caller explicitly supplies the single allowed connector translation. Previous static-mapping reports remain historical, not assertions that this new connector remains identical to Java.

## All-model classification and remaining work

The [independent report](independent/REVIEW.md#remaining-family-classification) covers every candidate family, including unused source references. It resolves all four dishwasher plate-count visibility tiers, four motorcycle palettes plus emissive, mutually selected customer rigs, and 88 assembled refrigerator lower/upper states. Raw same-plane counts include opposing internal seams, transparent texels, identical pixels, covered joins and intentionally unused imported originals; they are not a defect count.

- **Customer motion remains open:** 170 bounded poses across both rigs and all 15 clips contain 71 poses / 311 sampled exposed differing pair instances. Knee, sleeve, neck and torso/leg joints move relative to their parents. A universal epsilon shift was not shown safe. Source-equivalent sleeves were already documented in the prior customer review. Rig, skins and animation were not changed just to suppress a static count.
- **Meal stage 2 remains material-dependent:** one authored zero-width surface shares a plane with an opposite-facing food face. Do not delete or offset it without validating native sidedness and intended appearance.
- **Other families:** board/bag joins were occluded in sampled normal rays; refrigerator/counter/shelves/stove/washingtable contacts were mainly opposing or alpha-empty. Retained geometry is not certified clean for every oblique view.
- **Limits:** 64×64 sampling may miss narrow texel strips. Normal rays do not reproduce every camera direction. A nonzero-alpha occluder is treated as a blocker, including blended surfaces. No engine draw order, depth precision, camera-distance stress, head-query sweep, animation blend/transition or continuous-time proof is supplied. Visor blending and water ordering remain native checks.

## Actual Blockbench inspection

[SHA-256 identities](editor-evidence.json) bind the fixtures and images. The original JPEGs below were captured from **official Blockbench Desktop 5.2.2 on the managed cloud computer**, opening the tracked `.bbmodel` fixtures through the native file UI. They were not generated renderer images, retouched, or substituted for a game screenshot. Existing unrelated editor plugins and settings were not modified. Runtime files were not exported from the editor.

Except the motorcycle, baseline is on the left/back and repaired output on the right/front. Motorcycle compares pinned Java source left with repaired RP right. The paired views support no gross silhouette/art-placement regression at these selected views; **the tiny numerical clearances are established by geometry tests, not by pixel-scale screenshot inspection**. Static editor photos cannot demonstrate temporal flicker elimination.

| Original screenshot | Contents / observed scope |
|---|---|
| [Chair](screenshots/chair-pair.jpg) | Full paired chairs, duplicate removal preserves visible legs and seat |
| [Open dishwasher](screenshots/dishwasher-open-pair.jpg) | Phase 1 frame 0, empty basket and cabinet |
| [Completed dishwasher](screenshots/dishwasher-completed-pair.jpg) | Phase 5 frame 0, 3+ count tier with six authored clean-plate display cubes |
| [Isolated basket](screenshots/drawer-isolated-isometric.jpg) | Diagnostic basket-only pair, parent/body/plate occlusion deliberately removed |
| [Basket bottom](screenshots/drawer-isolated-bottom.jpg) | Bottom camera on the same diagnostic pair; not a world view |
| [Meal stage 5](screenshots/food-stage5-pair.jpg) | Paired full plate, retained cap profile and atlas art |
| [Meal stage 6](screenshots/food-stage6-pair.jpg) | Paired consumed stage, retained profile and atlas art |
| [Helmet](screenshots/helmet-pair.jpg) | Shell+visor at local authored position, not an equipped player/native alpha pass |
| [Motorcycle](screenshots/motorcycle-pair.jpg) | Full neutral source/RP pair, original white palette |
| [Motorcycle underside](screenshots/motorcycle-bottom.jpg) | Underside pair for chest/connector inspection, static pose only |

The fixtures embed unchanged source PNG bytes. `scenes/` uses the repository's tracked per-face Bedrock-to-Blockbench conversion helper. `motorcycle/` uses the existing independent physical-face oracle so box-UV mirror and inflation are not guessed by an editor default. The editor's zero-width expansion and material handling remain preview limitations. Board/bag fixtures are diagnostic inputs, not claims that additional screenshots were captured for them. Other motorcycle colors are generated fixtures; only white was photographed in this pass.

## Validation run

- `npm run verify`: passed (core tests, TypeScript, resource validation and package build).
- `npm run verify:full`: **980/980 passed**, types/resources/build passed; 450 geometries, 46 animations, 578 permutations, zero validation errors.
- Python repository tests with the CI-pinned Mojang player/slim fixtures: **83/83 passed**. Includes appliance/model 41, dining 4 and motorcycle 10. An earlier run without the required external fixture environment variables stopped with one setup error; rerun with the exact pinned inputs passed.
- `python tools/check_compliance.py`: zero errors. Existing rights-holder asset-scope clarification remains advisory/pending; no new rights claim.
- `python tests/check_release_policy.py`: passed. No Release or tag is created by this repair.
- Negative control: original main runtime fails chair, all 82 drawer subcases, food and visor assertions with zero test errors; original motorcycle fails the explicit connector adaptation oracle. Current repaired outputs pass.
- Exact regeneration: all 649 runtime files byte-identical after another full conversion.
- Final exact-head checks and CI are recorded in the PR; do not treat an uncommitted local package as a published candidate.

## Reproduce

From the repository root with its declared npm dependencies and the CI's Python Pillow/NumPy dependencies:

```sh
python tools/convert_assets.py
npm run verify:full
python -m unittest discover -s tests -p test_appliance_geometry.py
python -m unittest discover -s tests -p test_dining_assets.py
python -m unittest discover -s tests -p test_motorcycle_mapping.py
python tools/check_compliance.py
python tests/check_release_policy.py
python docs/validation/model-overlap-20261110/build_scenes.py
python tools/review_motorcycle.py --output docs/validation/model-overlap-20261110/motorcycle --comparison-label 'REPAIRED RP'
```

See [independent reproduction](independent/REVIEW.md#reproduction) for the portable census, textured classifier, customer sampling and assembled-fridge checks. Those scripts are read-only on the supplied checkout and write only the requested report. Baseline needs the named main snapshot, not the current patched working tree. Complete all-Python testing additionally requires the exact native fixture URLs/environment variables already declared in `.github/workflows/build.yml`.

Original OTC source assets remain credited under the repository's GPL-3.0-only provenance and existing legal notices. No upstream mod JAR or editor application is redistributed.
