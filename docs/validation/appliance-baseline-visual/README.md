# Appliance baseline visual review: 0.1.46

This is the completed finite Blockbench review of the **0.1.46 baseline**, not
photographs of the later refrigerator repair, and not complete addon acceptance.
No production file changes are made by this documentation bundle.

## Fixed identity and scope

- Canonical baseline: `625dd3fe0e4cc944240d32678d65c91dc4f5a220`, tree
  `fb0bd9b7ccb507fdc28e63699593ea365ba8a141`.
- Original Java source: [Order To Cook e59e3db](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642).
- The entire runtime tree is identical at `11280a09d232a3dd7e7d1e6f5ae42e5a9e5c53d7`:
  `22ddad2b2e83a0f7a6e58ae63b73f2c759f332bd`. Complete tree records reconstruct this
  identity offline; no old branch, fetch or original local commit object is needed.
- 32 review sheets contain 142 source/canonical pairs: 12 refrigerator sheets
  cover 44 finite poses; 17 dishwasher sheets cover 82 finite poses; two separate
  count sheets cover 0/1/2/3/8/16 at fixed dirty/clean poses; one refrigerator
  assembly sheet covers four combinations.
- **39 planned sheet views were actually photographed**, covering all 32 sheets.
  Four isolated refrigerator views bring the baseline evidence to **43 original
  JPEGs**. Two further dishwasher face-order control photographs are separate
  diagnostic evidence, not extra baseline coverage.

[The photograph index](PHOTO_INDEX.md) links every accepted original JPEG and
its fixed scene. [Restore manifest.json](#restore-original-review-files) records exact hashes, camera,
source/canonical sides, state bindings, coverage and excluded capture identities.
The index is a portable projection of the capture ledger with SHA-256
`f4009e0b0f3641fa4cafbd025c036932dfa5256ad5334aec4ff212d16377f7ce`.
Only the specifically enumerated captures are accepted. Two earlier filenames
with unconfirmed provenance are excluded; their separately captured
`-recaptured` photographs retain distinct hashes. The earlier images are not
modified, renamed, rehabilitated or included here.

## What the photographs establish

The source side is the original signed geometry with the authored hierarchy and
affine pose sampled into mesh vertices. The canonical side uses fixed Bedrock
cube geometry and actual BP state/texture bindings. Source is **right in North
and Isometric Right (2:1)** and **left in Top/Bottom**. Y-arranged sheet rows
must not be accepted from a Top view, where they overlap.

The reviewed visible body, door, basket, cavity and texture arrangements are
recorded view by view. This is a finite editor comparison with known differences:

1. **Refrigerator shared-root gap in .46.** During closing, the Java full cabinet
   and both doors share root squash, but the baseline canonical opposite half
   does not. The isolated Top/Bottom controls retain this real difference. The
   later [.47 shared-root report](../fridge-shared-root-visual/README.md) documents
   its repair separately; no .46 image is relabelled as a repaired image.
2. **Dishwasher preview window difference.** Nine North baseline views retain
   their original window appearance. An isolated phase 1/frame 15 control changes
   only the source door mesh's face-key order to match the editor cube order.
   This produces the matching four-band arrangement while all 41,209 pixels of
   the canonical-model ROI remain unchanged. See [the control report](face-order/README.md).
   It establishes a prepared-preview ordering effect at that endpoint, not a
   native material defect or a blanket pass for every affected pose.
3. **Finite cuboid approximation remains.** The reproduced maximum physical
   UV-corner residual is 0.25964161378011075 model units for the dishwasher and
   0.08617698358695226 for the active refrigerator door, over 18,200 compared
   corners. These are geometry distances, not screenshot pixel errors and not a
   bound on the separate opposite-half root discrepancy.

Dishwasher finite-pose sheets use count 3. Counts 3/8/16 select the same six
source plate-cube elements, not necessarily six visually separable plates.
Phase 2/frame 0 has six selected dirty cubes with zero-scale, degenerate faces;
the canonical pose has zero effective dirty cubes. Washing phase 3 samples
`2 * frame / 16` through 1.875 seconds and selects neither plate family. Phase
4 and 6 share body tracks but differ in selected clean-plate geometry. These are
verified source/state facts; the still images do not establish animation timing.

## Calibration and material limits

The review uses texture `render_sides: auto` and global editor Render Sides Auto.
The earlier front-only preview falsely hid canonical cavity backs. The original
front→auto control, official Blockbench 5.2.2 decoder/material sources, independent
direct Geo imports and renderer-recovery evidence are reused from the
[shared calibration](../fridge-shared-root-visual/README.md#editor-calibration-and-renderer-recovery).
Disabling Hardware Acceleration restored a white viewport; the repeated control
ROIs matched the earlier Auto-only photographs exactly. This is an editor
recovery/calibration result, not a graphics-driver identification or runtime fix.

The [material source audit](MATERIAL_SCOPE.md) establishes the same unchanged
64×64 dishwasher PNG and declared cutout/no-cull class on both platforms. Java's
pinned shader rejects sampled alpha below 0.1. Official Bedrock documentation
inspected does not establish its numerical cutoff or survival of the 100/161
partial-alpha texels. Native sampling, lighting, depth and final blending are
not accepted by this review. No guessed alpha cutoff, flattened texture or
`blend` change is proposed.

## Restore original review files

To keep each uploaded evidence object bounded, 35 original text/model files
larger than 128 KiB are stored as separate deterministic gzip files. Their
original paths, byte lengths, SHA-256 and Git blob identities are fixed in
[packed-inputs/index.json](packed-inputs/index.json). The original files total
10,453,599 bytes; their gzip objects total 794,840 bytes, with a maximum of
41,657 bytes per object. There is no ZIP archive or duplicated uncompressed
copy in this bundle. JPEGs and PNGs remain directly available and byte-identical.

From this directory, explicitly restore before opening a packed scene:

```sh
python -B restore_review.py
```

The command prints the new temporary location. Open the desired
`appliance-baseline-visual/scenes/*.bbmodel` there. Both manifests and all packed
inputs are restored at their original relative paths, alongside a copy of the
shared fridge bundle. Restoration only decodes stored bytes; it does not
regenerate JSON or launch Blockbench. Use `--output <new-directory>` to choose
a new location with an existing parent. Existing destinations, links and outputs
inside either source bundle are rejected, and no source file is overwritten.

The index is fixed by a SHA-256 pin in the restore helper. Each compressed input
is limited to 61,440 bytes, each original to 1 MiB and total originals to 10 MiB.
Missing, extra, linked, reordered, corrupted or unsafe inputs, duplicate paths,
trailing gzip data and expansion beyond the declared byte length are rejected.
Both the original SHA-256 and Git blob ID must match before output is created.

## Reproduce without Git or a GUI

From this directory, run:

```sh
python -B verify_review.py
```

Requirements: Python 3.10+, Pillow and NumPy. No dependencies are installed
automatically. Keep this directory
beside `../fridge-shared-root-visual/`; that existing bundle provides exact
shared source snapshots, decoder helpers, calibration and licenses.

The baseline tree-record bytes are stored in eight ordered raw chunks of at most
61,440 bytes, with an index at [provenance/git-trees.json](provenance/git-trees.json).
Reassembly preserves the original 456,347 bytes exactly (SHA-256
`c891d6cbac98c32d2ec728f57a39503893d547896ddfd60923acbeff7170ade1`, Git blob
`265bc7f373b237e03791048555b7b957780d595e`); both 1,229-entry baseline trees and
their common runtime tree are unchanged. The adjacent .47 bundle's authenticated
loader is reused in a separate module instance pinned to this baseline record.
Its own .47 record and files remain unchanged. Missing, additional, reordered,
linked, oversized, corrupted or unsafe chunks are rejected. Regression checks
run automatically as part of verification. Updating the two shared helper and
inventory dependency hashes for the .47 chunked bundle changes no old capture,
model, baseline identity or acceptance claim.

The verifier first restores the packed files to a temporary copy using this
same mechanism, then binds 142 selected input files to reconstructed baseline Git-tree
records, checks byte-identical original JPEGs, reproduces all 32 scene bytes in
two fresh processes, verifies all 5,576 dishwasher and 528 refrigerator state
bindings, reproduces 4,141 channel samples and 18,200 physical-UV-corner checks,
reconstructs isolated controls and recomputes the original-pixel face-order
measurements. Shared calibration runs only in a temporary copy. It does not
modify the bundle, current runtime, original images or existing fridge docs.

Scene preparation status is deliberately retained separately from actual
capture status. A successful verifier authenticates/reproduces the recorded
inputs, transformations and measurements; it cannot retroactively photograph a
GUI or replace the recorded human visual inspection. The optional
`--skip-calibration` is a partial check and reports that calibration was skipped.
Pixel-tool versions are recorded; a different JPEG decoder may alter small
residuals, so exact original image hashes remain the evidence identity.

## What remains untested

No Minecraft Java or Bedrock client/world, BDS, running animation, timing,
reversal/reopen/STOP behavior, multiplayer, networking or complete native-state
acceptance is claimed. Both-closing source-controller precedence is not covered
by this baseline assembly sheet; it is addressed separately by the refrigerator
repair review. Food display is not added. Still previews and mathematical checks
are not a 100% addon visual-completion claim. Small anti-aliasing/JPEG residuals
are not independently diagnosed as asset defects.

## Bundle and rights

Only documentation, review helpers, selected source snapshots and raw review
images are added. Four baseline JPEGs and two isolated scenes already present in
the fridge bundle are referenced rather than duplicated; this directory adds
39 baseline JPEGs plus two face-order control JPEGs. No application, game, Java
mod JAR, installer, credential or machine-specific execution path is included.
Preserve [NOTICE.md](NOTICE.md), the repo rights register and all linked GPL/MIT
license texts when conveying these materials.
