# Two missing customer idle families: four scenes, eight photographs

**Eight original model photographs and one Auto-setting diagnostic were
independently inspected.** Each model photograph shows both complete, unselected
figures. No new port-only broad missing texture or broken face was identified on
these visible surfaces. Hand/head overlaps and other hidden faces remain open.
This is a bounded source/RP comparison inside **one common Blockbench ordinary
CubeRenderer**, not native Java-versus-Bedrock rendering or animation playback.

## What was newly observed

These scenes cover the previously unsampled standing-idle2 and seated-idle3
postures on both wide and slim rigs. The earlier seated-idle2/head-query and
standing-idle3/body-query samples did not cover these complete combinations.
Times and query inputs are **synthetic frozen inputs**, not measured native
clocks or accepted look-at conventions.

- **Wide standing idle2**, `customer_wait_2`, 0.375 s:
  [Isometric](frozen/screenshots/01_wide_wait2-isometric-right-2-1.jpg) and
  [North](frozen/screenshots/01_wide_wait2-north.jpg).
  Turned/pitched head, forward-facing torso, hanging arms, straight legs and
  original wide skin are visible. North adds faces, shirt fronts and hands.
- **Slim standing idle2**, `customer_wait_2`, 0.375 s:
  [Isometric](frozen/screenshots/02_slim_wait2-isometric-right-2-1.jpg) and
  [North](frozen/screenshots/02_slim_wait2-north.jpg).
  The same declared head-only pose on the original slim geometry and skin;
  narrower sleeves, hands, trouser and boot silhouette are visible.
- **Wide seated idle3**, `customer_sit_3`, 0.5833 s:
  [Isometric](frozen/screenshots/03_wide_sit3-isometric-right-2-1.jpg) and
  [North](frozen/screenshots/03_wide_sit3-north.jpg).
  Turned/tilted torso, raised left hand near the head, hanging opposite arm,
  bent legs and forward feet are visible. Inner hand/head and joint faces overlap.
- **Slim seated idle3**, `customer_sit_3`, 0.5833 s:
  [Isometric](frozen/screenshots/04_slim_sit3-isometric-right-2-1.jpg) and
  [North](frozen/screenshots/04_slim_sit3-north.jpg).
  The same declared body-query pose on slim geometry; raised sleeve/hand,
  bent legs and both boot fronts are visible. Interior and rear surfaces remain
  occluded.
- [Render Sides diagnostic](frozen/screenshots/09_editor-render-sides-auto.jpg):
  Auto is visibly selected. This is not a model acceptance photograph or a
  native transparency/culling test. No setting change was reported.

SOURCE is model X=-20, **screen right/lower in Isometric Right (2:1)** and **right
in North**. RP is X=+20, screen left/upper and left respectively. Identity follows
the frozen layout and operator camera record, not a guess from near-identical
skins. North labels and Auto are visible. Desktop version 5.2.2 and the exact
isometric preset are operator provenance, not established by title bars. Equal
camera matrices across separate scenes are not asserted.

Both families use target_x_rotation=15 and target_y_rotation=-30. Wait2 rotates
only the head [-15,30,0], with unrotated body and straight legs. Sit3 rotates the
body [-15,30,0], with head-local zero, seated legs and authored left-arm splay
[-157.5348,-6.8699,16.134]. Numerical pose values are input provenance, not visual
measurements or native query validation. The full per-image captions, hashes,
scene/skin/geometry identities and limits are in the
[independent receipt](gui-independent-receipt.json) and separate
[capture receipt public projection](capture-receipt-public.json).

## History stays historical

The [original preparation report](frozen/README.md),
[summary public projection](provenance/preparation-report-public.md), [scene manifest](frozen/scene-manifest.json) and
[offline verification](frozen/verification.json) keep their original pending-GUI
wording. They describe work done before photographs existed. None is rewritten
as a GUI PASS. The 73-file preparation inventory remains SHA-256
`59b4a9bd2a5ac037649a1fa35761c9f578a5e25aab3252c31aabcf4e2de41ea6`.
Later capture and independent pixel observations are separate records.

Scene, sample, PNG and full-window JPEG bytes are unchanged. Images were not
cropped, aligned, resized or re-encoded. The automated verifier checks identities,
decoding and bindings; it does not judge image quality or authenticate timestamps.

## Current inputs and portable replay

Keep this directory and its sibling
[customer-static-20261109](../customer-static-20261109/) and
[customer-remaining-20261109](../customer-remaining-20261109/) together from the
same repository. This is intentionally not a standalone single-folder download.
It reuses 44 exact licensed artifacts instead of copying them again. Every used
dependency is bound by published length, SHA-256 and Git blob identity; its prior
public inventory is pinned too.

All **17 current input/context files** have portable commit/tree membership proof
for main `dbb2574154a54cc5ad69e75e71d23900a98a79fe`, tree
`be96dc9adc99c4afbf79b7be153ee0387372bb54`. Sixteen match the previous customer
snapshot. **The converter is different**: only `make_motorcycle_geo` changed by
AST comparison. The exact current converter is compressed as context-only data,
never imported or executed. The old converter is reused solely for byte/AST
comparison. This does not claim whole-tree equality, fresh remote authentication
or signature validation. See [input comparison](frozen/input-equivalence.json)
and [repository identity](provenance/repository-identity.json).

With Python 3.10+, NumPy, Pillow and Node 18+ already installed, run here:

```sh
python -B verify_public_bundle.py
python -B test_public_bundle.py
python -B check_public_docs.py
```

These commands are read-only for the checkout. Replay writes only inside owned
TemporaryDirectory instances and offers **no assemble/output-path option**.
The verifier rejects symlinks, traversal, conflicting original paths and invalid
or oversized gzip expansion, validates all payloads before restoration, and runs
the builder and independent oracle in fresh processes. No network, Git executable,
GUI, app binary, Java JAR, Minecraft client or BDS is needed. New public files are
at most 110 KiB; inherited dependencies retain their earlier 128 KiB limit.

Replay checks 1,280 inflated corners against the actual serialized graph (maximum
component error 4.440892098500626e-15 model units), 960 independently decoded face
UV records, 80 bone-parent edges, cube order, inflate and original texture bytes.
All 248 group/cube IDs are unique with complete parent/outliner membership.
Seven structural and four query-attachment mutations are rejected. The 52
hand-stated landmarks and bounded comparison against 29 earlier sample instants
are reproduced. All four scenes, four samples and scene manifest rebuild
byte-for-byte. This is static preservation, not continuous/native acceptance.

The [preservation inventory](preservation.json) records 84 original file
identities. Seventy-eight are reconstructible from exact bytes or reversible gzip; six
are explicitly omitted: private source-acquisition metadata, two one-shot
preparation scripts, two documents with private review-routing prose, and original
capture-process metadata. The [preparation summary](provenance/preparation-report-public.md)
and [GUI checklist](provenance/gui-review-public.md) projections retain their original
pending-GUI meaning, with original hashes and an explicit statement of the prose changes. Public projections
retain the relevant source identities and capture observations with original
hashes; omitted originals are **not** reconstructible from projections. Raw
licensed source bytes are unchanged. Replay-helper changes are explicitly recorded:
the [oracle adaptation record](provenance/portable-adaptation.json) changes only its
acquisition-metadata input to the existing public source projection. Historical
scripts in frozen/ are evidence, not the public replay entry points.

Original OTC, Blockbench and GeckoLib attribution and full GPL/MIT texts are
reused unchanged; see [the retained license notice](../customer-static-20261109/frozen/licenses/NOTICE.md).
New review scripts and derivatives are GPL-3.0-only. No private acquisition URL,
local absolute path, credential, application binary or Java JAR is published.
[Validation](validation.json) records executed checks separately from limits.

## Still open

All eight named customer idle clips now have at least one documented static
sample across these batches, but both rigs at every clip/time are not covered.
The original renderer and interpolation assumptions are shared; this is not two
independent game engines. No native Java float/render execution, Bedrock playback,
query clamping/selection, transitions, STOP/reset/re-entry, action clocks, late
join, unload/reload, riding alignment, custom/worn skins, multiplayer, entity
removal, sound, particles or native alpha/material/culling ordering is accepted.
The narrow boom pre/post timing question remains separate and open. No runtime
or version change is made by this evidence publication.
