# Customer source audit and seven static review candidates

**Status: preparation and offline checks only. No GUI was operated by this worker.
No runtime edits, Minecraft client, BDS, LIVE, user computer, upload or release.**

The three first-priority frozen files are `01_slim_idle4_wrist`,
`04_wide_interrupt_shrink`, and `05_wide_boom_peak` under `scenes/`.
They open directly in Blockbench; there is no need to enter Animate mode.
All seven scenes are immutable review candidates. Actual photographs and their
observations must be recorded separately, never retroactively added as a pass here.

## Fixed inputs

- Runtime integration commit: `d3982c98a71424ff9c449a144e792ad384058f69` (.47).
- Author source: `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`.
- Java reference platform: Forge 1.20.1 and GeckoLib 4.8.3,
  commit `e81962eefd04e0cab90445d3df37b477d2767ffd`.
- Editor decoder: official Blockbench Desktop 5.2.2, app.asar SHA-256
  `6d5d5ae941465ff88a58f158e1e529e428f04deaa8da2a8a40949ed0a2291123`.
- `input-manifest.json` records SHA-256, size, and exact integration Git blob for
  every input. The selected author files were also independently checked against
  upstream Git blob identities, recorded in `source-evidence/input-upstream-provenance.json`.
- All original PNG bytes remain unchanged, including those embedded into scenes.
  Both skins have physical and virtual UV dimensions **64×64**, not the 96×96
  refrigerator dimensions. Each comparison uses one shared original texture and
  the same rig on both sides. PNG alpha values are only 0 and 255; this does not
  establish equal native material, overlay culling, or transparency behavior.

Source `drive_idle` / runtime `customer` is wide. Source `drive_idle_alex` /
runtime `customer_slim` is slim. All 11 bones and 20 cubes of each source rig are
field-equal to their corresponding runtime rig. Identifiers differ. There are
no signed-size cubes, authored cube rotations, or Java rescale flags in these
customer inputs. The original skin/overlay cube ordering and inflate are retained.

The pinned `CustomerEntityModel` chooses these models, the corresponding two
bundled skins, and the two animation files. Its optional player-skin/custom-skin
branches are outside this review. `CustomerEntityRenderer` adds only a .5 shadow
radius; it does not add a customer-specific scale transformation. This is a
source inspection, not an executed Java renderer.

The eight customer input files recorded by the earlier .37 GUI manifest still
match .47 byte-for-byte; `earlier-input-equivalence.json` records this limited
identity check. It does not expand the earlier sampling coverage.

## What the pair actually means

Each scene is a **source-asset snapshot versus RP-asset snapshot in the same
Blockbench cube renderer**. It is not a Java-game screenshot versus Bedrock-game
screenshot. Most pairs are intentionally identical data-preservation controls,
because the author bone tracks and the shipped normalized tracks are identical.
No claim of two independent native renderers is made.

- SOURCE is at model X = −20. RP is at model X = +20. Top-level outliner names
  identify the side. Left/right on screen depends on the camera. Do not caption
  a side from a previous camera's left/right assumption.
- Both sides use ordinary cubes, not a mesh/cube comparison. Every source/RP
  texture is automatic-side (`auto`); record the actual global Render Sides
  setting, which should also be Auto. Do not repair the scene if it differs.
- Geometry is frozen at the declared time. There is no animation controller,
  clock seek, entity transform, runtime property, native target, sound or particle.
- Original per-face UVs are decoded with the pinned official `parseCube` function.
  Skin PNGs are embedded byte-identically. No texture normalization, crop,
  resampling, atlas rewrite or rescale is used.
- Static freezing preserves the complete bone hierarchy and uniform body scale.
  There is no cuboid fitting or lost elbow/knee segment in these seven samples.

## Smallest useful GUI sequence and camera focus

All times below are **local clip seconds**, not wall-clock time, server action
age or a promise that the game renders this exact timestamp.

| Order | File / rig / clip time | What to inspect | Suggested view |
|---|---|---|---|
| First | `01_slim_idle4_wrist.bbmodel`, slim, `customer_sit_4` 1.3333 | Head pitch 27.5°; upper arm has three-axis rotation; right wrist rotation [−6.6088,.9375,−41.3679] plus position [−.5,1.5,0]. Inspect elbow/wrist skin seams, sleeve overlays and handedness. | Isometric first, then a side only if the wrist is obscured. |
| First | `04_wide_interrupt_shrink.bbmodel`, wide, `npc_eat&scale_interrupt` .375 | Uniform body scale .5 about the original [0,12,0] pivot, while retaining translated wrists and bent legs. Earlier .25 sample was before shrinking. | Same isometric framing for both members; inspect whole-body proportions and separated limb segments. |
| First | `05_wide_boom_peak.bbmodel`, wide, `npc_eat&boom` 5.9157 | Source scale 1.6, RP mathematical scale 1.5928057554. Inspect enlarged head, skin overlays, body root, legs and both arms. A small size difference is expected from source-code pre/post expansion; do not label it an observed native bug. | Isometric with both complete silhouettes visible. |
| Next | `03_slim_eat_hand_extreme.bbmodel`, slim, `npc_eat&scale` 3.0 | Right wrist −50° and [−.5,1.5,0] translation, head pitch 32.5°, torso lean, both hands near the eating posture. | Isometric; alternate side if hands overlap. |
| Next | `07_wide_standtake_wrist.bbmodel`, wide, `npc_standtake` 2.5 | Post-hop reach endpoint: right wrist −27.5°, right arm [−57.6203,−.9498,−5.6281], asymmetrical left arm/wrist. | Isometric or frontal, keep hands visible. |
| Next | `06_slim_spawn_rebound.bbmodel`, slim, `npc_sitspawn` .25 | Rebound height 2.6 model units, body Z rotation 1.875°, seated leg/foot hierarchy. This is distinct from previous .31 rotational-peak sampling. | Isometric with feet and full body visible. |
| Conditional | `02_wide_idle3_body_turn.bbmodel`, wide, `customer_wait_3` .5833 | Left-arm extreme [−157.5348,−6.8699,16.134] with body rotation [−15,30,0]. Explicit synthetic query inputs are target_x_rotation=15, target_y_rotation=−30 degrees. This tests hierarchy with a declared input, **not actual native look-at**. | Isometric; note entire body turns, unlike idle2's head-only channel. |

Do not infer flat-layer alpha acceptance from these views. If a surface mismatch
appears, preserve the exact full-window image and settings before any diagnosis.
Do not change the PNG, cube winding, UVs or runtime to hide an editor difference.

## Coverage gaps and why this is not a giant contact sheet

The earlier editor report sampled two neutral rigs, `sit_1`, slim `sit_4`, and
some times in each action, mostly wide. It did not cover all eight idle clips,
all nontrivial limb/scale extrema, both rigs for every clip, transitions or
re-entry. This batch targets distinguishable gaps rather than relabelling those
old observations or preparing duplicate neutral/zero-scale screenshots.

- Idle1: arm/foot opposite phases at 0 and .75 remain a useful future paired
  motion check; its final pose repeats the initial pose. No full idle1 acceptance.
- Idle2: head-only target_x/y query, unlike idle1. Need verified nonzero native
  look-at inputs and observation, not zero-valued duplicate screenshots.
- Idle3: raised left arm and body-target rotation. Scene02 supplies a declared
  synthetic probe only. Native query conventions, clamping and target selection
  remain open for both standing and seated variants.
- Idle4: 1.3333 wrist/head extreme is prepared; later head yaw at 3.7778 and
  return at 4.6944 remain unobserved. Standing and seated share upper-body tracks
  but differ in leg/foot posture; one scene does not accept both.
- Spawn: both source clips share the root bounce curve: Y12 at 0, Y0 at .1667,
  rebound Y2.6 at .25, Z-rotation maximum 2.5° at .3056, then final neutral root
  at .5833. Scene06 checks the seated rebound, not the full curve or standing rig.
- Take: sit .0/.5 hand/arm alternation and stand .5278 hop apex remain useful
  motion checks; scene07 adds the later wrist/reach endpoint rather than another
  old hop sample. It does not replace seated take or terminal runtime removal.
- Eat: scene03 is the right-wrist/head extreme. Left-wrist maximum at 4.0 and
  other times are not photographed here.
- Shrink: sit-take 1.75–2.0, stand-take 2.75–3.0, eat-scale 5.25–5.5 and
  interrupt .25–.5 have the same six authored scale keys after subtracting their
  start time. The midpoint is .5 scale. This exact data fact permits one useful
  shrink control rather than four near-duplicate scale-only sheets. Different
  underlying arm poses and native transitions remain untested.
- Endpoints: those four actions reach zero scale at their listed final time.
  Boom reaches zero at 5.9167, before its 6.0 clip end. These are data endpoints,
  not accepted disappearance, controller completion or entity removal. We do
  not inflate progress with repeated empty screenshots.

All fifteen clips' 165 bone/channel records equal the runtime records after
only removing the source `vector` wrapper. No authored easing/easingArgs occurs
in these customer clips. This does **not** mean every engine interprets the
records identically. The known constant-leg catmullrom warning scope remains
unchanged; no source warning was removed or counted as newly fixed.

## Source pre/post timing and editor sampling limitation

The pinned GeckoLib `BakedAnimationsAdapter.addBedrockKeyframes` turns a nonzero
`pre` key at time T into a key at **T−.001 seconds**, followed by `post` at T.
`buildKeyframeStack` then converts seconds to ticks by multiplying by 20.
`AnimationController` sets Molang `q.anim_time` from adjusted clip ticks /20 and
reads dynamic keyframe values at the current evaluation time. Sine/cosine are
in degrees, as verified in the pinned `SinDegrees` and `CosDegrees` sources.

Thus boom's scale peak is at 5.9157 in this **source-code-derived continuous
curve**. The RP retains Bedrock pre/post at the same 5.9167 key. Intended RP
incoming interpolation goes to 1.6 and switches to 0 at that key. A small difference
also exists on the preceding ramp because the source peak arrives .001s earlier.

| Clip seconds | Source-code-derived scale | RP-JSON mathematical scale |
|---|---:|---:|
|5.8611|1.2|1.2|
|5.9|1.4849816850|1.4798561151|
|5.9157|1.6|1.5928057554|
|5.9162|.8|1.5964028777|
|5.9167|0|0|
|6.0|0|0|

This is not a newly observed player-visible defect. Source entity tickCount,
client render/partial-tick timing, native Bedrock animation evaluation and the
server action clock were not executed. The source peak and 1ms intermediate
values may not correspond to a displayed frame. No runtime change is proposed
from this fact alone. The 5.9162 narrow-edge sample is numeric only, not an extra
primary GUI fixture.

Official Blockbench 5.2.2 `BoneAnimator.interpolate` uses an epsilon of 1/1200 s
when selecting nearby keys. Direct timeline scrubbing can snap across the
1ms source interval. It also displays zero animation scale as .00001 internally.
The static candidates avoid both editor-sampling behaviors; that makes a frozen
shape reproducible, not an exact native animation-time observation.

## Independent numerical checks: precise oracle and limit

`build_review.py` reads the raw source or RP animation, uses a strict expression
whitelist, samples the selected channels and bakes their translations/uniform
root scale into static cubes and bone pivots. Unsupported Molang raises an error;
there are no guessed query defaults. It never imports `tools/convert_assets.py`.

`verify_review.py` is a separate implementation. It:

1. Verifies fixed SHA-256 and upstream Git blob identities, geometry/skin equality,
   and all 15 clips' raw-track normalization.
2. Uses independent Decimal timestamp arithmetic and separate source-event versus
   RP incoming/outgoing selection logic to calculate the **seven declared sample
   poses**, not every frame. Java pre/post expansion comes from the pinned source
   code, not from the production converter or Blockbench output.
3. Builds direct animated hierarchy matrices from the original model and those
   independently sampled channel values. Rotation is Rz·Ry·Rx, with the documented
   source/BB X/Y sign conversion, root scale and parent-relative translations.
   The checked source evidence is `RenderUtils.prepMatrixForBone` plus the
   animation loader/controller. Java float arithmetic/render execution is not run.
4. Separately decodes the generated BB scene graph, evaluates its static group
   transforms, and compares all 20 cubes ×8 inflated corners ×2 sides ×7 scenes.
   Maximum coordinate-component residual is **2.8962e−11 model units** across
   2,240 comparisons. This bounds **this static freezing transformation**, not
   native parity, image pixels, Java-vs-Bedrock rendering or every animation curve.
5. Checks PNG byte identity and uses the exact official Blockbench `parseCube`
   excerpt for cube/UV data decoding. The data-only harness is not GUI acceptance.
6. Rebuilds scenes/samples in a fresh temporary directory and process and checks
   byte-identical files. Does not modify the frozen scene files in this directory.

The two paths are independently written pose/matrix calculations with shared
published semantic assumptions, not independent native game engines. Especially
because original source and runtime rig/track data are already equal, zero pair
difference is a preservation check, not a proof of 100% visual equivalence.
See `verification.json`, `samples/` and `scene-manifest.json` for exact records.

Reproduce using Python 3.10+, NumPy, Pillow and Node 18+:

```sh
python -B verify_review.py
```

## Remaining native / runtime boundaries

No source/runtime full playback, controller STOP/reset/re-entry, idle-selection
cadence, action_elapsed seek, late joining, view unload/reload, multiplayer,
server removal, riding-seat alignment, sounds, particles or native material
handling was tested. The selected source controller has a 0-tick transition
constructor and explicit forceAnimationReset branches; those source facts do
not execute the Bedrock controller. Existing native-clock/root acceptance
limitations remain open. No helper or unrelated NPC PR is integrated here.

The original .47 checkout and runtime assets remain unmodified. Attribution,
licenses, source URLs and exact identities accompany this review; no Java JAR
or application/game binary is bundled.
