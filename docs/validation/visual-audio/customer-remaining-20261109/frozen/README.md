# Customer remaining static views: seven frozen candidates

**Preparation and offline verification only. No GUI photographs or native acceptance
are produced by this batch.** All work is in this independent directory. No runtime,
earlier receipt/manifest, repository, desktop, Minecraft client, BDS or LIVE state was
changed. No plugin/service/software installation, upload or GitHub operation occurred.

## Fixed inputs and renderer contract

- Actual snapshot source: local `.47` checkout at
  `dd3153ed9c9755702244696c5271dcd35feb6d13`.
- Locally available main commit checked:
  `36e9d6eac9594ed598a7cf528189b7c942f3bafa`. The parent reported this as
  origin/main; this worker did not query a remote. Both commit trees are
  `ad3435cf0cb126c1f3e8a06be57ca01ae90741fb`.
- All 17 input/context files match both commits' Git object bytes and the earlier
  `d3982c98a71424ff9c449a144e792ad384058f69` frozen snapshot. See
  `input-manifest.json` and `input-equivalence.json`; a revision label alone was
  not used to infer unchanged customer assets.
- Author assets: `breezeth-CN/OrdertoCook` at
  `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`.
- Source semantic reference: Forge 1.20.1 / GeckoLib 4.8.3 at
  `e81962eefd04e0cab90445d3df37b477d2767ffd`. Pinned source excerpts and Git
  blob proofs remain in `source-evidence/`.
- Decoder reference: official Blockbench Desktop 5.2.2, app.asar SHA-256
  `6d5d5ae941465ff88a58f158e1e529e428f04deaa8da2a8a40949ed0a2291123`.
  `official-provenance.json` identifies the exact excerpt bytes. Only the
  previously frozen data decoder was run, not an application or GUI.
- Author notices and license texts are in `licenses/`. No Java JAR or application
  binary is bundled. This remains an unofficial GPL-3.0 Bedrock adaptation.

Each file has **one source/RP pair, both using ordinary cubes in the same
Blockbench CubeRenderer**. It is not a comparison of independent game renderers.
SOURCE is at model X −20, RP at X +20. Identify sides using the outliner, not an
assumption about screen left/right. All 11 bones, 20 cubes, their ordering, parent
hierarchy, original per-face UVs, overlay inflate, and original embedded PNG bytes
are preserved per side. Both physical and virtual texture dimensions are 64×64.
Texture sides are Auto. Do not alter PNGs, UVs, hierarchy, culling or inflate during
review to hide a renderer difference.

The original helpers are reused with new case declarations, isolated UUIDs and
stronger independent checks. `helper-provenance.json` identifies the original
helper hashes. The production converter is never imported or executed.

## Small review sequence

Open these frozen files directly. They do not require timeline seeking or Animate
mode. All times are local clip seconds, not server action age or wall-clock time.

| File under `scenes/` | Exact case | What is newly worth looking at |
| --- | --- | --- |
| `01_slim_sit1_counterphase.bbmodel` | slim, `customer_sit_1`, .75 | Right/left arms −20/−10°, feet 50/30°; foot Z offsets −.75/−.25. Exact opposite phase of the earlier slim 1.5 view. Keep both feet and sleeves visible. |
| `02_wide_wait1_phase0.bbmodel` | wide, `customer_wait_1`, 0 | Previously unsampled standing idle1 family: arms −10/−20°, body Y −2 and unbent legs. This is not a neutral model, although its arm animation is shared with seated idle1. |
| `03_slim_sit2_head_query.bbmodel` | slim, `customer_sit_2`, .375 | Head-only [−15,30,0]° with symmetric arms −15° and feet 40°. Declared synthetic target_x=15, target_y=−30. Unlike the old wait3 probe, the body is not rotated. |
| `04_wide_wait4_yaw.bbmodel` | wide, `customer_wait_4`, 3.7778 | Standing idle4's late head yaw −20°. Right wrist has returned to zero. Distinct from the previously reviewed seated slim wrist/head-pitch peak. |
| `05_wide_eat_left_wrist.bbmodel` | wide, `npc_eat&scale`, 4 | Left wrist +52.5° at [.75,1.5,0], right wrist −35°, head pitch32.5°. Check the left sleeve/hand join and head/arm overlaps; earlier new-batch eat3 targeted the slim right hand. |
| `06_slim_sittake_phase0.bbmodel` | slim, `npc_sittake`, 0 | Early arm splay [−170.4542,2.9932,−17.2501] / [−175.3001,−1.7082,19.9298]°, feet30/50°. Use the same camera as scene07. |
| `07_slim_sittake_phase05.bbmodel` | slim, `npc_sittake`, .5 | Opposite arm-splay phase [−170.149,1.728,−9.8511] / [−175.1179,−1.0809,12.4538]°, feet43.3333/36.6667°. Both wrist local rotations remain zero. |

Start with an isometric view showing the complete pair. Use a second side view
only if a wrist, sleeve, foot or turned head is obscured. The seated-take two-file
comparison is intentionally small: the maximum corresponding-corner change is
1.3814808645 model units. Its arms repeat at 1.0, but the old 1.0 photo was wide
and its foot pose differs. This is a new slim geometry/phase check, not proof that
a previously unseen motion exists.

`GUI_REVIEW.md` supplies the recording checklist. Do not overwrite or regenerate
the frozen scenes after opening them. Save any future photographs and receipts
separately; the manifest's `gui_run: false` remains an honest preparation record.

## Verified offline, with bounded meaning

Run with existing Python 3.10+, NumPy, Pillow and Node 18+:

```sh
python -B verify_review.py
python -B verify_selection.py
```

Both pass. `verification.json` records:

- 41 pinned input/provenance checks; complete source/RP equality of the 15 clips'
  165 bone-channel records after source `vector` unwrapping. The existing 18
  constant-leg catmullrom tracks are preserved, not fixed or newly accepted.
- Independently sampled Decimal timelines versus the build's float sampling.
  Maximum selected-channel residual: **7.1054e−15**.
- Direct animated hierarchy matrices versus decoded static scene graph matrices
  for **2,240 inflated corners**. Maximum coordinate-component residual:
  **7.1054e−15 model units**. Group-pivot residual: **3.5527e−15**.
- **1,680 face-UV records** independently decoded from original per-face UV origin
  and size, without calling the official decoder, and **140 parent edges**.
  Cube ordering, all inflate values, texture bytes and 64×64 dimensions agree.
- A fresh-process temporary rebuild reproduces scenes, sample files and manifest
  byte-for-byte. This does not change the frozen originals.

`selection-verification.json` adds 40 hand-stated pose landmarks and comparison
against each declared earlier same-rig sampled static geometry. None of these seven
equals a declared old same-rig sample. Old approximate UI times are checked only
at their recorded decimals. This is **not** a claim that these poses never occur
elsewhere in a clip, or that a numerical difference will necessarily be meaningful
at every GUI camera/zoom. `prior-coverage.json` states the bounded comparison set.

These numerical tests are independent of the build sampler but reuse the earlier
independently written verifier. They are not two independent native engines.
Stored boom pre/post and shared-shrink checks in `verification.json` are inherited
math regressions, **not new scene coverage, new GUI progress or native fixes**.

## Assumptions that are not acceptance

The static transformation uses Rz·Ry·Rx rotations and the pinned source/Blockbench
X/Y sign conversion, parent-relative translations and root scale. Source
`RenderUtils.prepMatrixForBone` and the animation loader support those documented
semantics; Java float arithmetic, actual Java rendering and native Bedrock
evaluation were not executed. Existing source pre/post expansion is retained,
but no new case targets its narrow time discontinuity.

Synthetic look inputs are supplied values, not measured native query conventions,
clamping, target selection or controller values. These scenes have no animation
controller, clock, entity state, sound or particles. Unchanged binary PNG alpha
does not prove equivalent native transparency, overlay ordering or culling.
One common CubeRenderer can hide a difference between actual engines.

## Remaining gaps

1. **Every scene in this new batch still needs real GUI observation.** No prepared
   or numeric pass is a screenshot pass. No earlier photo is relabelled as new.
2. Standing idle2 and seated idle3 remain distinct unsampled combinations. Their
   head-only/body-query tracks are related to the sampled opposite posture, but
   their full posture/hierarchy combinations are not thereby visually accepted.
   Both rigs across all idle/action clips are still not covered. Add a further
   rig view only where its silhouette, sleeve, wrist or leg geometry is useful.
3. Idle phase changes, idle4 return, both spawn curves, seated/standing take,
   interrupt/eat shrink and boom are not continuous playback tests. Old and new
   snapshots cannot accept interpolation between them, clip endpoints,
   transitions, STOP/reset/re-entry or controller-selection cadence.
4. The earlier narrow boom timing difference, actual native query behavior,
   action_elapsed seeking, late join, view unload/reload, multiplayer and terminal
   entity removal remain open. Repeating zero-scale screenshots would not close
   them, so no empty endpoint scene was prepared.
5. Riding-seat alignment, optional player/custom skins, material/transparency
   ordering, sound, particles, native Java/Bedrock parity and player-visible
   frame timing still require their appropriate environment. No 100% claim is
   made, and these remaining boundaries are not runtime changes proposed here.
