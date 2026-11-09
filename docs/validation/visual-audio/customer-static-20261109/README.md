# Customer static-pose evidence: seven scenes, eight photographs

**Eight original Blockbench JPEGs have now been independently inspected across
seven frozen scenes.** Both figures are complete and unselected in every image.
No newly visible broad missing texture or broken face appears in these particular
views. Occluded surfaces remain unreviewed. This is a source-asset/RP-asset
comparison inside **the same Blockbench cube renderer**, not Java-game versus
Bedrock-game rendering, animation playback, or native acceptance.

No runtime, original skin, scene, sample, or image bytes are changed. The images
are original full-window JPEGs: no crop, alignment, rescale or re-encoding.

## What was actually inspected

SOURCE is model X=-20 and RP is X=+20. SOURCE appears **right/lower** and RP
**left/upper** in these isometric views; in North, SOURCE is right and RP left.
Identity follows the frozen layout plus camera record, not a visual guess between
near-identical skins. The North label is visible. The exact isometric preset,
**Isometric Right (2:1)**, comes from the capture operator and is consistent with
the displayed axes/layout. The application version, Blockbench Desktop 5.2.2,
comes from the capture/preparation record, not these title bars.

All listed times are declared **local clip seconds**, not observed native clock
values. Both members use one shared original 64x64 skin with 64x64 virtual UVs.

| Scene and declared time | Original image | Limited observation |
| --- | --- | --- |
| Slim seated idle4, `customer_sit_4`, 1.3333 s | [Isometric](frozen/screenshots/01_slim_idle4_wrist-isometric-right-2-1.jpg), [North](frozen/screenshots/01_slim_idle4_wrist-north.jpg) | Pitched head, raised wrist/hand near face, sleeve, opposite arm, seated legs/feet. North adds frontal visibility. |
| Wide interrupt shrink, `npc_eat&scale_interrupt`, 0.375 s | [Isometric](frozen/screenshots/04_wide_interrupt_shrink-isometric-right-2-1.jpg) | Lowered head, bent hand/arm chains and seated legs/feet. Scale 0.5 is input provenance, not a screenshot measurement. |
| Wide boom peak, `npc_eat&boom`, 5.9157 s | [Isometric](frozen/screenshots/05_wide_boom_peak-isometric-right-2-1.jpg) | Enlarged head/body, asymmetric arms and bent legs. Source scale 1.6 versus RP 1.5928057554 is a known mathematical input difference, not measured here. |
| Slim eating hand extreme, `npc_eat&scale`, 3 s | [Isometric](frozen/screenshots/03_slim_eat_hand_extreme-isometric-right-2-1.jpg) | Lowered head, hands/wrists near chest and face, sleeve texture, seated legs/feet. Some inner hands/joint faces are occluded. |
| Wide standing take, `npc_standtake`, 2.5 s | [Isometric](frozen/screenshots/07_wide_standtake_wrist-isometric-right-2-1.jpg) | Asymmetric arm reach, bent right wrist, front torso and standing legs/feet. No observation of the earlier hop or later removal. |
| Slim seated spawn rebound, `npc_sitspawn`, 0.25 s | [Isometric](frozen/screenshots/06_slim_spawn_rebound-isometric-right-2-1.jpg) | Full head, torso, hanging arms and seated leg/foot chains. The 2.6-unit rebound and 1.875-degree roll come from the input, not observed motion. |
| Wide idle3 body turn, `customer_wait_3`, 0.5833 s | [Isometric](frozen/screenshots/02_wide_idle3_body_turn-isometric-right-2-1.jpg) | Turned/tilted body and raised left hand near head. **Synthetic** target_x_rotation=15, target_y_rotation=-30 only, not native look-at. |

The full captions, scene/image SHA-256, dimensions, times, queries, per-side rig,
geometry/skin identities and reviewer scope are in
[the new independent receipt](gui-independent-receipt.json). Automated checks
validate the receipt's consistency and image decodability; they do not perform
image-quality judgment or prove a screenshot's capture time.

## Three separate renderer diagnostics

These do not count as customer-pose coverage or new refrigerator acceptance:

1. [Customer white viewport](frozen/screenshots/renderer-white-diagnostic.jpg).
2. [Known refrigerator control also white](frozen/screenshots/known-control-renderer-white-diagnostic.jpg).
3. [Known control visible after editor restart](frozen/screenshots/known-control-after-editor-restart.jpg).

The operator reported closing only their own editor, then restarting the original
executable with the same independent profile, without new flags, a service,
settings changes, or scene saves. Hardware Acceleration had previously been off;
it was not changed or diagnosed in this run. The images support recovery after
restart, **not a GPU, driver, backend or asset root cause**. Root cause is unknown.
Global Render Sides is not exposed in these screenshots. Frozen texture fields
are `auto`; no native alpha, culling, transparency or material conclusion follows.

## History stays historical

[frozen/README.md](frozen/README.md) is the original preparation report and still
says no GUI operation by its author. The prepared manifest remains
`prepared, not GUI tested`; `verification.json` remains offline-only.

- [First GUI receipt](frozen/gui-receipt.json) and
  [its narrative](frozen/GUI_REVIEW.md): four actual photographs of three scenes,
  independently inspected at that stage.
- [Completion receipt](frozen/gui-receipt-completion.json): the last four images
  had only capture-operator review at that stage and its pending status is retained.
- [New independent receipt](gui-independent-receipt.json): separate review of
  all eight originals, including those last four. It does not rewrite either
  preceding receipt or promote preparation to PASS.

The preserved preparation scripts are historical artifacts. Use the public
verification command below, rather than executing those scripts in `frozen/`.

## Portable reproduction and exact identities

Prerequisites already installed: Python 3.10+, NumPy, Pillow, Node 18+.
No Git checkout, network, GUI, app binary, Minecraft client or BDS is needed.
From this directory:

```sh
python -B verify_public_bundle.py
```

This creates a temporary copy, verifies both historical and new receipts,
then invokes the separately written numerical oracle and frozen scene builder
in fresh processes. It verifies:

- Seven scene and seven sample files reproduce byte-for-byte.
- All 2,240 inflated cube-corner comparisons, with maximum coordinate-component
  residual 2.8961721909581684e-11 model units, and all 165 normalized bone/channel
  records across 15 clips. This bounds the **static freezing transformation**.
- Raw PNG bytes, embedded skins, raw JPEG identities, scene bindings and preserved
  preparation/receipt records.
- The 17 declared source/RP/context input files have the same SHA-256 and Git blob
  IDs in original local integration `d3982c98a71424ff9c449a144e792ad384058f69`
  and merged main `ed1b0aa4a213b1e5a898c75d1704687cc22521be`.
  [Portable commit/tree objects](provenance/repository-identity.json) verify
  membership without Git or network. These are different commits and different
  complete trees; this is only selected-input equivalence. Object hashes are
  identity evidence, not a fresh server authentication or signature validation.
- Public blobs are at most 128 KiB. Only the historical converter fixture exceeds
  that limit uncompressed. It is stored as deterministic gzip (`mtime=0`), with
  original bytes, SHA-256 and Git blob identity in [preservation.json](preservation.json).
  It is restored in the temporary copy, never imported or run by this review.

To explicitly restore the exact original files into a new disposable directory:

```sh
tmp=$(mktemp -d)
python -B verify_public_bundle.py --assemble "$tmp/customer-review"
# Inspect "$tmp/customer-review"; remove the temporary directory when finished.
```

The narrowly scoped `.gitattributes` preserves upstream trailing whitespace in
hash-bound source excerpts and signed commit objects. Newly authored documents
and scripts still receive normal whitespace checks.

No semantic JSON rewrite is used. The raw model/animation/PNG/JPEG/scene/sample
bytes remain unchanged. [Preservation records](preservation.json) cover all 86
original files: 85 are published as original bytes or reversible compression.
One original acquisition-metadata receipt is not published because it included
acquisition-location labels and unrelated source records. Its original hash is
retained, and [a clearly labelled public projection](provenance/geckolib-sources.json)
contains the five bundled source identities and immutable upstream URLs. The raw
Java/properties files are unchanged. No claim is made that the omitted original
metadata bytes are independently reconstructible from this projection.

The [public verifier adaptation](provenance/portable-adaptation.json) changes only
root/output plumbing, the projected provenance input, and interpreter selection.
The original oracle remains preserved. Neither implementation imports the
production asset converter. The two mathematical paths share published semantic
assumptions; they are not two native game engines.

See [recorded verification](validation.json) for the two Pillow environments and
repository checks actually run. The source attribution and GPL/MIT notices are
retained in [frozen/licenses](frozen/licenses/NOTICE.md), along with pinned
Blockbench source-map excerpts and GeckoLib 4.8.3 source evidence. No Java JAR,
application/game binary, private filesystem location, or credential is bundled.

## Open boundaries

No new runtime fix is proposed. The known GeckoLib pre/post expansion places a
source mathematical peak 1 ms earlier; this has **not** been demonstrated as a
player-visible native defect. These static files do not test Java float/render
execution, Bedrock interpolation, partial ticks, full curves, action clock,
controller STOP/reset/re-entry, native look-at, transitions, late join, unload /
reload, riding alignment, sounds, particles, multiplayer, native material handling,
entity removal, or all poses/rigs. A matching selected pose is data preservation,
not full visual/native parity. Existing coverage gaps remain open.
