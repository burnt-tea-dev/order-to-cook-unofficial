# Refrigerator shared-root visual review

The Java refrigerator applies its closing squash to a shared root above the
whole cabinet and both doors. The earlier independent-half geometry preserved
the active door's squash but left the other half unchanged. The revised
geometry dispatch gives both halves the same sampled root state while retaining
their independent door poses.

This review concerns the refrigerator change only. It is not a complete addon
visual acceptance, runtime release or Minecraft client test.

## Fixed inputs and source behavior

The reviewed fixtures were built from commit
`e544f563062bf92e58afaa057a9ee52fd7ccbdc8`, tree
`bb9f843cdb79a9ea9488acf8db67748cb2e69c21`. Their original identity is retained.
The upstream source is fixed at
[`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642).

The pinned Java block entity registers the upper animation controller before
the lower controller. GeckoLib 4.8.3 preserves this order and writes each active
controller's root values directly. Therefore an active lower closing clip wins,
including when its current root sample is neutral. Taking the largest squash,
multiplying both scales or ignoring a neutral lower sample would be different.
Exact source URLs and hashes accompany the review.

The actual Bedrock state is `ordertocook:root_frame`. The closing-frame mapping
is `[0,0,0,0,1,2,3,0,0,0,0]`. Both halves receive the same root state; their
closing/frame states remain independent. The peak root is Z scale .95 and
Z translation .25 model units, applied about the original zero pivot.

## Photographed controls

Seven isolated comparisons were opened in Blockbench 5.2.2 and photographed in
nine views. The first two before/after controls are:

- Lower close .5 s with upper open 1.0 s: Isometric Right (2:1) and Top.
- Upper close .5 s with lower open 1.0 s: Isometric Right (2:1) and Bottom.

Each scene compares the original source's full affine mesh to the revised
canonical cubes, using the unchanged 96×96 PNG and calibrated automatic-side
preview settings. Source is right in the isometric views and left in Top/Bottom.
The previously visible opposite-half depth difference is resolved in these
views. The source mesh and fitted canonical door cubes are not asserted to be
mathematically identical.

Original-pixel measurements support the visual observation without treating
anti-aliasing as a defect:

- Roof interior scanlines: source stays 152 pixels; canonical changes from
  160 to 152 pixels.
- Bottom-panel same-color-run median: source stays 168 pixels; canonical changes
  from 175 to 168 pixels. This measures a flat-color interior, not a precise
  subpixel silhouette boundary.

The source Top/Bottom ROIs and one isometric source ROI are unchanged pixel for
pixel. The other isometric source ROI has only small residuals, maximum channel
difference 12 on a 0–255 scale. No specific compression or rasterization cause
is assumed. No image was cropped for delivery, edited, aligned, rescaled or
re-encoded. Exact ROIs, scanline methods and raw-image hashes are in the evidence
manifest.

## Numerical coverage and retained approximation

The independent verifier starts from original signed source cubes and authored
easing, clips body geometry/UVs at Y16 and applies the source hierarchy. It does
not import the production converter or use its fitted output as the oracle.

- 529 upper/lower selector cases, including absent inputs, match the actual
  pinned pure runtime selector.
- 2,112 real BP state/facing dispatches resolve the intended geometry and facing.
- 176 geometry poses across four facings cover 95,744 physical UV-corner
  comparisons and 1,056 source/canonical cube pairs.
- The settled cabinet seam difference is zero throughout that geometry domain.
- Maximum source-affine to final-cuboid corner difference is
  **.20155644370746567 model units**, at upper open frame5/root2. This is a
  geometric fitting residual, not an image-pixel measurement.

All fixture files reproduce byte-for-byte in fresh processes. Five further
single-pair isometric photographs cover an active neutral lower close overriding
an upper peak, a recovering lower close overriding an upper peak, the opposite
stagger, and each door partway through opening while the other reaches its
closing peak. Both models are fully visible and unselected. No new broad
missing-face or shared-depth discrepancy appears in these five views; the
known cuboid-fit residual remains. The neutral-override photograph uses a
different zoom, so no cross-image pixel-size comparison is claimed. The
`supplemental-evidence-manifest.json` records the exact samples and photographs.
Generated preparation manifests retain their original planned status; actual
GUI coverage is recorded separately rather than retroactively changing them.

## Later service commit and scope

Commit `dcee546b7b918e3deb0163ec607f280cef2880d4`, tree
`b30ddd91768fd19bee556b3f337bf9ee08855fe5`, adds a service exception-path fix.
An exact Git-object comparison verifies that all 176 refrigerator geometries,
the complete RP and BP-block trees, source assets, converter, root selector and
pose data are unchanged. The nine e544 photographs therefore apply to identical
visual inputs at dcee. This is documented as input equivalence, not by changing
the screenshots' source identity or claiming that images verify the service fix.

Remaining limits include two-tick finite sampling, fitted cuboids, Java
STOP/reset/reopen behavior, non-atomic writes to two blocks and unload/reload
behavior. A missing lower station anchor does not guarantee an orphan upper
block is updated. The pure-selector absent-input cases are not service tests.
No Minecraft/Bedrock material, client-world, animation-running/timing, BDS,
gameplay or networking acceptance is claimed here.

## Reproducibility and attribution

The accompanying manifests identify the exact source, geometry, PNG, state
bindings, scenes, raw JPEGs and later-commit equivalence. Run:

```sh
python -B verify_candidate_math.py
python -B verify_control_evidence.py
python -B verify_candidate_equivalence.py
python -B verify_calibration.py
```

These checks do not operate a GUI or modify runtime assets. Preserve
`licenses/NOTICE.md`, the upstream attribution/rights register and the applicable
GPL/MIT texts when integrating the review materials. No Java mod JAR, Minecraft
binary or Blockbench application binary is included.

## Editor calibration and renderer recovery

The review uses texture `render_sides: auto` with the global editor Render Sides
setting at Auto. A previous front-only preview asymmetrically culled the
normalized canonical cavity backs while the original signed source mesh remained
visible. Those failed photographs and the exact two-value front→auto control
are retained under `calibration/`; no runtime mesh or PNG was changed to hide it.

Independent direct Blockbench Geo imports at the fully open endpoint show
corresponding source/canonical surfaces in North and isometric views with the
same original PNG. The original source Geo is retained separately from a review
copy changing only two door rotations. Canonical assembly only prefixes bone
names and translates the upper half Y+16, verified reversibly. The source
import's accidental Create Group was immediately undone without save; both
direct imports had texture-load dirty markers, and all disk hashes remained
unchanged. This is editor calibration, not Minecraft native import acceptance.

Later editor GPU-process failures produced a white viewport. Disabling Hardware
Acceleration using the official Settings dialog and restarting restored the
preview. Its Settings and diagnostic photographs are retained. Both repeated
control model ROIs match the earlier Auto-only photographs exactly. The setting
does not identify a graphics driver/backend and is not an asset fix or a proof
of native transparency equivalence. Official Blockbench 5.2.2 decoder/material
source and pinned Gecko renderer provenance accompany the calibration; the
Java `entityCutoutNoCull` contract also does not establish Bedrock material
behavior.

## Bundle and dependencies

This directory contains seven candidate fixtures and nine actual candidate
photographs, two earlier comparison fixtures and four before-change photographs,
and separately labelled calibration/settings/failure evidence. It also includes
only the selected source inputs needed for verification, source licenses and
provenance. It does not include the unfinished broader appliance review or any
application/game binaries.

Run `python -B verify_review.py` from this directory. Python 3.10+, Pillow, NumPy and
Node.js 18+ are required; they are not bundled or automatically installed. The
selected inputs are repo-relative snapshots, not the currently checked-out
runtime. Complete Git-tree records reconstruct the fixed tree hashes and bind
each snapshot file to its exact source blob. No private execution path, external
checkout, network access or installed Blockbench is needed to reproduce the
numerical/fixture/pixel checks. The checks do not operate the GUI.

## Final runtime-freeze input equivalence

The later local runtime-freeze identity is
`e0f7f54e9c85475abf3975e31f96bf8d25f4c1e4`, tree
`a523979692bdf30b84ccdcb5bd2d4d79e29aaf29`. The separate
`freeze-input-equivalence.json` verifies that all 187 tracked scene/helper
inputs are unchanged from dcee. Its runtime changes relative to dcee are only
the BP/RP manifest identities; RP visual content, BP block/script content and
source assets remain unchanged. No photograph or fixture is regenerated or
relabeled to establish this equivalence.

These commit IDs are original local review identities, not promised fetchable
remote commits. Publication may create different commits. All verifiers use
the explicit bundled snapshots and reconstruct the recorded tree/blob hashes
offline; they never require these local Git objects or any original branch.
A clean clone can run the complete suite using only this directory and the
documented Python/Node dependencies.

The original 857,501-byte Git-tree record is stored as 14 ordered raw-byte
chunks, each at most 61,440 bytes, under `provenance/git-tree-chunks/`.
`provenance/git-trees.json` is now a small index with each chunk's exact size
and SHA-256. The `.jsonpart` files are byte ranges, not standalone JSON.
The loader rejects missing, extra, reordered, linked or unsafe chunk paths,
then reconstructs the original bytes before parsing any tree entries. The
original SHA-256 remains
`ca574655d31881372dd738e45a35b8c6a81359063094709bd2de626d2d20afde`
and its Git blob SHA-1 remains
`1d78b3013ccb7c17a3ac73b673ef2a02d8347090`. All 1,364 / 1,364 / 1,365 entries
and the three recorded tree hashes are unchanged. Chunking changes storage
only; it does not relabel fixtures, screenshots or source identities.
`test_tree_chunks.py`, included in `verify_review.py`, checks exact-byte and
semantic equivalence plus corruption, missing/extra files, order, traversal
and symlink rejection. Original vendor source and photograph bytes are not
split or changed.

## Original photograph index

The first four comparisons retain their before/after image pairs:

| Control/view | Before shared-root change | Revised candidate |
| --- | --- | --- |
| Lower close, ISO | [Before](baseline-evidence/lower_closing_upper_open-isometric-right-2-1.jpg) | [After](screenshots/lower_closing_upper_open-isometric-right-2-1.jpg) |
| Lower close, Top | [Before](baseline-evidence/lower_closing_upper_open-top.jpg) | [After](screenshots/lower_closing_upper_open-top.jpg) |
| Upper close, ISO | [Before](baseline-evidence/upper_closing_lower_open-isometric-right-2-1.jpg) | [After](screenshots/upper_closing_lower_open-isometric-right-2-1.jpg) |
| Upper close, Bottom | [Before](baseline-evidence/upper_closing_lower_open-bottom.jpg) | [After](screenshots/upper_closing_lower_open-bottom.jpg) |

Additional actual isometric views, not merely prepared poses:

- [Active neutral lower overrides upper peak](screenshots/lower_neutral_active_overrides_upper_peak-isometric-right-2-1.jpg): lower close .1 s, upper close .5 s, root0.
- [Recovering lower overrides upper peak](screenshots/lower_recovering_overrides_upper_peak-isometric-right-2-1.jpg): lower close .6 s, upper close .5 s, root3.
- [Lower peak with intermediate upper opening](screenshots/lower_peak_upper_open_frame3-isometric-right-2-1.jpg): lower close .5 s, upper open .3 s, root2.
- [Upper peak with intermediate lower opening](screenshots/upper_peak_lower_open_frame3-isometric-right-2-1.jpg): upper close .5 s, lower open .3 s, root2.
- [Lower peak overrides recovering upper](screenshots/lower_peak_overrides_upper_recovering-isometric-right-2-1.jpg): lower close .5 s, upper close .6 s, root2.

Exact fixture paths and hashes are in `index.json`. These finite observations
do not accept every possible world state, animation transition or transparency
configuration.

The recorded pixel-tool versions are in `provenance/pixel-tool-versions.json`;
JPEG decoder changes can alter tiny residual counts. The preserved original
JPEGs and reported tool versions remain the evidence identity, rather than an
unqualified cross-decoder pixel promise.

## Separate item-display source/API review

The [2026-11-09 item-display contract](../visual-audio/FRIDGE_ITEM_DISPLAY_CONTRACT_20261109.md)
documents the Java 8+8 selection and root/closing-state behavior, official Bedrock
held-item support, and the remaining custom-holder rendering and safety tests.
It adds no runtime display and does not change these cabinet/door observations.
