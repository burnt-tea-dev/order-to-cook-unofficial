# Integrated dirty-plate stain review

Date: 2026-11-10. Baseline: `48ef920779cd7d76244061bad9dd31ffc2f6b57a`.

## Outcome

The integrated stain repair passes this read-only structural, material-binding, and source-pixel review. No blocking defect was found in the reviewed stain change. This is not evidence of native-client flicker reproduction or final resolution.

## Checks performed

- Inspected the actual converter diff, `tests/test_food_stain_bake.py`, updated dining/appliance tests, generated display materials, and atlas integration.
- Confirmed cap repair runs before stain removal. All 39 affected block stages and all 39 atlas/actor stages have exactly two changes relative to the baseline: the base top face is rebound and the original stain quad is removed. Every other face, UV, cube, rotation, and pivot remains exact. In particular, family10's separate Y=1.0625 food decal remains unchanged.
- Confirmed stage0 and the stain-free stage36 (`9_4`) remain exact.
- Confirmed the 39 display permutations and the inherited default receive the new named material. Its alpha-test, AO, and dimming settings match the original food material; wildcard behavior stays unchanged.
- Confirmed normal dining-block definitions, actor definitions, render controller, and runtime dining lifecycle are byte-identical to baseline. The dining block still uses `alpha_test`; the actor still uses `entity_alphatest`.
- Confirmed the standalone derivative is 16×64 with all alpha255. The source clean/stain samples are binary-alpha; no opacity threshold or color blend approximation is used.
- Confirmed both original atlas regions, including their existing padding, remain pixel-identical. Their offsets stay x2 and x38; the appended derivative starts x202, while atlas dimensions stay256×256.
- Confirmed41 source files remain byte-identical: all40 food-stage models plus their source PNG.
- Confirmed21 unrelated dirty-item/sink/dishwasher texture or definition files remain byte-identical. Across82 dishwasher poses, all1,148 dirty/clean plate bones remain exact despite the separate door repair.
- Confirmed generated texture and affected geometry provenance identifies the stain adaptation.
- Confirmed guards reject changed plane height, UV, additional faces, plate thickness, intermediate alpha, and opaque content in the shifted overhang.

## Tests actually run

- `tests/test_food_stain_bake.py`: 5 passed. Includes5,616 physical-coordinate samples checked against both the generated texture and shipped dining atlas.
- `tests/test_dining_assets.py`: 4 passed.
- `tests/test_appliance_geometry.py`: 42 passed.
- Portable reference helper tests: 5 passed.
- `review_integrated_stains.py`: PASS against the stated Git baseline. Full counts and SHA256 identities are in `integrated-review.json`.
- `audit_stain_bake.py`: completed successfully after portability conversion. Its current/prototype image is a CPU render, not a game screenshot.

This review did not run the repository's aggregate `npm run verify`; that must be recorded separately by the release/build validation. No GUI, user computer, LIVE world, native rendering, distance/grazing-angle, mipmap, lighting, or large-coordinate test was performed here.

## Reproduction

From the repository root, with Python, Pillow, and NumPy installed:

    PYTHONDONTWRITEBYTECODE=1 python docs/validation/model-overlap-20261110/followup/stain-review/review_integrated_stains.py --repo . --output review.json
    PYTHONDONTWRITEBYTECODE=1 python docs/validation/model-overlap-20261110/followup/stain-review/verify_helpers.py --repo .
    PYTHONDONTWRITEBYTECODE=1 python docs/validation/model-overlap-20261110/followup/stain-review/audit_stain_bake.py --repo . --output evidence-output
    PYTHONDONTWRITEBYTECODE=1 python tests/test_food_stain_bake.py
    PYTHONDONTWRITEBYTECODE=1 python tests/test_dining_assets.py
    PYTHONDONTWRITEBYTECODE=1 python tests/test_appliance_geometry.py

The scripts contain no machine-specific repository paths. `--baseline` can select another compatible pre-stain-repair Git revision. The integrated review script expects the recorded baseline's earlier cap repairs to exist; it is intentionally specific rather than a generic geometry comparison.

## Published baseline identity

The review originally ran against local commit `4cc310c57f0fa48cc450526458c666d3a30521af`. The published equivalent is `48ef920779cd7d76244061bad9dd31ffc2f6b57a`; both have the exact Git tree `e789e28e00751d54d17e94853efdef87500e511a`. Stored review logs retain their original identifiers. Only baseline metadata and script defaults were rebound; geometry and image findings were not changed.
