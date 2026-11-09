# Missing customer idle families: four frozen static scenes

**Offline preparation only. All four scenes still require real GUI observation.**
No game, GUI, runtime, repository, remote, LIVE, BDS, user-local computer or old
frozen evidence was changed. No app was installed or controlled. This directory
contains new review derivatives and copied, pinned inputs, not a runtime fix.

## New useful coverage

The earlier two public customer batches explicitly left standing idle2 and seated
idle3 unsampled. These four scenes add each full posture on both wide and slim
rigs. They do not duplicate the head-query seated idle2 or body-query standing
idle3 combinations previously photographed. A second rig is useful for its arm,
sleeve and silhouette geometry, not a claim of new animation logic.

| File in scenes/ | Clip and local time | Hand-stated landmarks |
| --- | --- | --- |
| 01_wide_wait2_head_query.bbmodel | customer_wait_2, 0.375 s | Head local rotation [-15,30,0]; body rotation zero and position [0,-2,0]; both arms -15 degrees; legs and feet unbent. |
| 02_slim_wait2_head_query.bbmodel | customer_wait_2, 0.375 s | Same authored pose on slim geometry and original slim skin. |
| 03_wide_sit3_body_query.bbmodel | customer_sit_3, 0.5833 s | Body rotation [-15,30,0], not head-local query. Left arm authored key [-157.5348,-6.8699,16.134]; right arm -17.7773333333 degrees; seated legs and counterphase feet. |
| 04_slim_sit3_body_query.bbmodel | customer_sit_3, 0.5833 s | Same body turn, raised/splayed left arm and seated hierarchy on slim geometry. |

All four use declared **synthetic target_x_rotation=15, target_y_rotation=-30**.
This does not establish native query axes/signs, clamping, target selection or
controller output. Sit3 head local rotation is zero but inherits body rotation.
For sit3, leg rotations are [-84.92327,9.96156,0.88045] and
[-84.92327,-9.96156,-0.88045]. At 0.5833/0.75=5833/7500, right/left feet are
45.5546666667/34.4453333333 degrees, Y=1.5, Z=-0.6388666667/-0.3611333333.
These are source-key/linear-interpolation expectations, not screenshots or
measurements of native motion. All times are local clip seconds.

## Inputs checked against current main

- Current clean local main: dbb2574154a54cc5ad69e75e71d23900a98a79fe, release .48.
  No remote was queried. Every one of the earlier **17** input/context files was
  freshly checked against current worktree bytes and current commit Git objects.
- **16 are byte-identical** to the earlier remaining-batch snapshot at
  dd3153ed9c9755702244696c5271dcd35feb6d13. This includes both rigs, animations,
  skins, entity/controller files, source lock and motion tests.
- **tools/convert_assets.py changed**. AST comparison found only the top-level
  make_motorcycle_geo function changed. This is the unrelated motorcycle repair,
  not a new customer asset change. The exact current converter is a context-only
  fixture; it was parsed as data, never imported or executed. See
  input-manifest.json and input-equivalence.json. No whole-tree equivalence claim.
- Author assets: breezeth-CN/OrdertoCook e59e3dbcabe19b783d9adb933db5fcb8bc1e4642.
  Source semantics: GeckoLib 4.8.3 e81962eefd04e0cab90445d3df37b477d2767ffd.
  Source excerpts and blob identities remain under source-evidence/.
- Official Blockbench Desktop 5.2.2 decoder excerpts are pinned by
  official-provenance.json. Application asar SHA-256 is
  6d5d5ae941465ff88a58f158e1e529e428f04deaa8da2a8a40949ed0a2291123.
  Only the existing data-only cube decoder was run, not the application.
- GPL/MIT author notices and full license texts remain in licenses/.
  This is an unofficial GPL-3.0-only Bedrock adaptation. No JAR or app binary.

The previous 73-file preparation manifest was checked unchanged. Its later GUI
records were neither rewritten nor regenerated. New work uses a separate UUID
namespace; all 248 group/cube IDs are unique across the four files and are
disjoint from the fourteen earlier frozen scenes checked in namespace-check.json.

## Renderer and preservation contract

Each scene has SOURCE at **model X=-20** and RP at **model X=+20**, both ordinary
cubes in the **same Blockbench CubeRenderer**. Screen sides depend on camera;
identify them using the outliner and record the camera. This is not a comparison
of native Java and Bedrock engines.

Each side preserves all 11 bones and 20 cubes, cube ordering, full parent chain,
original per-face UVs and overlay inflate. There is one complete, unique outliner
reference per group/cube. Both use the original embedded PNG bytes for that rig,
physical and virtual 64x64 dimensions, default texture mode and Auto texture sides.
Do not edit hierarchy, geometry, UVs, PNGs, inflate or render sides to hide a
visual discrepancy. No animation or controller is embedded in the static files.

## Verification actually executed

With existing Python 3.10+, NumPy, Pillow and Node 18+, from this directory:

```sh
python -B verify_review.py
python -B verify_selection.py
python -B verify_frozen.py
```

The first two scripts only rewrite their deterministic new verification reports.
They do not rebuild the originals. The builder runs in a fresh temporary copy
and reproduces all four scene files, four sample files and the scene manifest
byte-for-byte. Use the verifier, not build_review.py, in this frozen directory.

Recorded results:

- 41 input/provenance checks; all 15 source/RP clips, 165 normalized bone/channel
  tracks agree. The 18 inherited constant catmullrom tracks are retained, not
  newly repaired or accepted as native interpolation.
- Independent Decimal timeline sampling matches the float builder at these four
  times (maximum selected-channel residual 0).
- Direct authored hierarchy matrices versus the **actual serialized static scene
  graph**: 1,280 inflated corners, maximum coordinate-component error
  4.440892098500626e-15 model units; maximum group-pivot residual 0.
- Independent per-face UV decoding without the official decoder: 960 face
  records, 80 parent edges, local cube bounds, original texture bytes, cube order
  and inflate checked. Complete ID/reference/parent validation rejects seven
  focused structural mutations, including cross-type collisions and a detached
  parent. No repeated test-count padding.
- 52 hand-stated pose/default landmarks, with four wrong-query-bone mutations
  rejected. In particular, the prior general assertion that body rotation is
  always zero is removed: it would be wrong for sit3.
- Bounded comparison against 29 documented earlier sample instants: each new
  pose differs from every declared same-rig prior pose. The smallest prior
  maximum-corner differences are 4.66899 (both wait2 rigs), 11.88823 (wide sit3),
  and 13.61784 (slim sit3) model units. The two new families differ by 19.55620
  units on each rig. These values do not promise useful visibility at every zoom
  or assert that a pose never occurs elsewhere in a clip.

scene-freeze-hashes.json binds the exact four scenes, four samples and manifest.
artifact-hashes.json freezes preparation files, excluding itself and any future
GUI outputs. Helper provenance makes clear that the earlier independently written
Decimal/matrix/UV oracle is reused and strengthened; this is not a second native
renderer or a newly independent author of every semantic assumption.

## GUI handoff and open limits

See GUI_REVIEW.md. Open the four frozen files directly, with no timeline seeking
or save. Start with one full-pair isometric view per scene. Use a North or side
control only when head, sleeve/hand, turned torso or feet are occluded. Save future
original full-window screenshots and receipts separately; do not update this
historical preparation's gui_run=false to pretend it performed GUI work.

No broad port defect was found numerically in these four static samples. Only a
real GUI review can judge these displayed surfaces. Hidden surfaces, native
Java float/rendering, Bedrock interpolation, continuous playback, query behavior,
controller selection, transitions, STOP/reset/re-entry, action clocks, late join,
unload/reload, riding alignment, custom skins, multiplayer, sound, particles,
entity removal, native alpha/transparency/culling and the known narrow boom
pre/post timing question remain open. Four new snapshots cannot close them.
