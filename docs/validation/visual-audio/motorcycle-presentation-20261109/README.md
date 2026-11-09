# Motorcycle dynamic coordinate review

This bundle is an **offline CPU model preview**, prepared on 2026-11-09. It does
not contain new Blockbench GUI screenshots, Minecraft client observations, BDS
results or real player input. No user's computer or LIVE installation was used.

The active wheel correction changes the X-angle sign while retaining the
existing unsigned-distance driver and magnitude. The additional steering and
signed-wheel samples are explicitly **reference only / unwired**. They establish
how a selected Java angle maps onto the current corrected RP geometry; they do
not implement reverse driving or establish any mounted-input axis convention.

## Source and coordinate contract

The fixed Java source is `breezeth-CN/OrdertoCook` commit
`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`, Forge 1.20.1.
[`MotorcycleModel.setupAnim`, lines 93–105](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java#L93-L105)
assigns the interpolated handle angle to `handle.yRot` and `front_t.yRot`, and
the interpolated wheel angle to `front_t.xRot` and `rear_t.xRot`.

The [existing neutral-model contract](../../../MOTORCYCLE_SOURCE_MAPPING.md)
defines the review common frame as `(JavaX, 24−JavaY, JavaZ)`. It reflects the
Bedrock import X axis and normalizes the Java renderer's constant +0.016 model
pixel Y offset. This is not an absolute world/seat-origin comparison.

With the corrected current geometry, the dynamic mapping is:

| Bone | Java angle assignment | Bedrock rotation in degrees |
| --- | --- | --- |
| `handle` | Y = steer | `[0, −steer, 0]` |
| `front_t` | X = wheel, Y = steer | `[wheel, −steer, 0]` |
| `rear_t` | X = wheel | `[wheel, 0, 0]` |

**Wheel X retains the Java angle sign; steering Y reverses it.** The older
visual-binding audit's statement that both X and Y negate predates the neutral
model correction and must not be used as the dynamic mapping authority.
The corner checks include simultaneous front-wheel X/Y rotation, its rotated
child cubes, both handle branches and the untouched rear-wheel yaw.

## Active expression comparison

[`active-wheel-sign.png`](active-wheel-sign.png) compares fixed Java wheel
phases +15°, +60° and +120° against the before and candidate active RP
expressions. The before expression is read from exact addon commit
`8008294306180ece040b908684bf4fa11afb75c8`; the candidate is read from the actual
`animation.ordertocook.motorcycle.drive` entry. Both wheels are evaluated
separately, and the client entity's active animation binding is checked.

For each selected source phase, the supplied `q.modified_distance_moved` is
constructed as `phase / 114.6`. This isolates angle direction. **It does not
claim that Bedrock accumulated travel equals Java internal speed or elapsed
wheel phase.** The magnitude 114.6 is an unchanged Bedrock adaptation, not a
source-derived Java gain. The correction is `−114.6 → +114.6` on the two X
channels, with no sign lookup from rider input or velocity.

[`active-positive-phase.gif`](active-positive-phase.gif) uses the same actual
expression for 24 selected nonnegative phases. Each frame lasts 100 ms for
review; this arbitrary playback is not a simulation of either engine's clock,
acceleration, coasting or collision behavior.

## Unwired signed-phase and steering references

[`unwired-signed-steering-reference.png`](unwired-signed-steering-reference.png)
shows six explicitly selected `(steer, wheel)` pairs:
`(−45,0)`, `(+45,0)`, `(0,−60)`, `(0,+60)`, `(−45,+120)`, `(+45,−60)` degrees.
Each source pose is applied to the original Java hierarchy; the other side
applies the mapping table above to the actual current RP hierarchy.

[`unwired-signed-reference.gif`](unwired-signed-reference.gif) illustrates
positive and negative angle selections. Its frame list is an authored review
trajectory, not the Java steering/speed state machine and not a Bedrock input
adapter. Steering at rest, reverse phase, input-device signs, smoothing and
network interpolation remain outside this result.

## Numeric tests and controls

The [targeted suite](../../../../tests/test_motorcycle_presentation.py) checks
every physical corner of all **41 cubes** (328 corner pairs per pose) and every
physical face's UV coordinates. It reads `MotorcycleModel.java` and verifies
the actual `setupAnim` assignments used by the independent pose reader. Java
and RP transforms use separate hierarchy evaluators from the existing
[`motorcycle_oracle.py`](../../../../tests/motorcycle_oracle.py); the production
converter is not imported.

The recorded red baseline at the uncorrected active expression failed at
+15°, +60° and +120°. Maximum corner residuals were respectively
**3.4336178767**, **11.4891094118** and **11.4891094386** model pixels, with zero
UV residual. Twenty wheel/child boxes were affected. The neutral zero phase
cannot distinguish the two signs and is retained only as a control.

The suite also deliberately restores the old negative coefficient and rejects
it, removes front-wheel yaw, flips handle yaw, and incorrectly adds rear-wheel
yaw. These controls distinguish the mapping from a test that simply compares
a copied expected object to itself. Original zero-width planes, inflation,
parent relationships, full physical face UVs and original PNG bytes are retained.

The generated [preview manifest](preview-manifest.json) records the selected
poses, before/candidate numerical results, source and tool hashes, camera
vectors, frame times and output hashes. Its candidate corner residual should
remain below `1e−5` model pixels, with zero UV residual; this tolerance allows
the existing decimal rounding of static model angles. These are model-space
comparisons, not screenshot pixel-equality or native renderer results.

## Reproduce

From the repository root:

```sh
python -B tests/test_motorcycle_presentation.py -v
python -B tools/review_motorcycle_presentation.py --output /tmp/otc-motorcycle-presentation
```

The preview builder requires the pinned before commit in local Git history,
NumPy and Pillow. It refuses to render the active candidate comparison if the
actual expression fails the source-angle corner check. It writes only review
artifacts, never runtime assets. It reuses the CPU rasterizer for depth/texture
drawing; motorcycle geometry and box-UV conversion are supplied independently
by physical-corner readers, because the generic renderer's explicit-UV loader
does not support the motorcycle's box-UV input directly.

The completed wheel suite passed **4/4 tests**. All active candidate and six
unwired reference samples had a maximum corner residual of approximately
**1.290553 × 10⁻⁷ model pixels**, with **zero physical UV residual**. The two
generated GIFs contain 24 and 32 frames respectively, each with a 100 ms review
duration. Both PNG sheets were visually inspected: the active candidate follows
the selected source phases, the before phase differs, and both reference
steering directions retain the intended handle/front-wheel relationship.

The PNG/GIF images use nearest texel sampling, neutral review lighting,
double-sided inspection and an alpha threshold of 128. They do not prove
Bedrock culling, shader behavior, emissive lighting, transparency ordering,
filtering or visible motion continuity. The source/runtime motorcycle texture
files are verified byte-identical before drawing.

## Rider model-local pose preview

[`rider-tp-pose-reference.png`](rider-tp-pose-reference.png) adds four source
`drive_idle` samples at **0, 0.5, 5 and 7 seconds**, beside the actual generated
`animation.ordertocook.player.motorcycle_idle` clip on the pinned official native
classic geometry. It does not place a player on the motorcycle or choose a
world/seat offset. The neutral gray/blue/clay materials contain no player skin,
armor, headgear, item or game material representation.

The source values come from the hand-derived independent `source_reference`
samples in [the rider test](../../../../tests/test_motorcycle_rider.py). That
includes the source Gecko spline at 0.5 seconds; the preview does not silently
replace it with linear interpolation. The same test's independent forward
evaluator applies the actual source and native parent chains. The inverse
retargeter and production spline sampler are not used to derive the expected
pose. The native side reads the emitted RP key at each exact sample time.

The native input is the official
[`humanoid.custom.geo.json`](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json)
at Mojang commit `15701fa9c13923f12662984c32c124327e40e3d3`, with SHA-256
`d3688f959a95f6b39c9bd8b15312a19361256ae161d2d055ba63d810e17a8ca8`.
Its complete file remains outside the repository and is not redistributed.
The preview checks this byte identity and the `geometry.humanoid.custom`
identifier before using it. It uses that file's actual pivots and limb mesh
centers, including legs at ±1.9 model pixels.

Each time sample checks eight shoulder/hand and hip/foot endpoints, plus four
head-origin/basis points. The maximum of those **48 point comparisons** is
**5.916617 × 10⁻⁶ model pixels**, below the `1e−4` tolerance. The image's visible
source knees/elbows remain different from the native rigid limbs: endpoint
agreement is not a claim of matching segmented surfaces or full silhouettes.
The original foot skin's negative inflation is retained; the source torso's
base cube is selected explicitly. Native overlays and all source overlay cubes
are omitted in this neutral base-mesh comparison. Exact selections and input
hashes are recorded in the preview manifest.

To include this optional rider sheet during reproduction, first obtain the
exact pinned native file above into a temporary directory, then supply it:

```sh
python -B tools/review_motorcycle_presentation.py \
  --output /tmp/otc-motorcycle-presentation \
  --native-rider-geometry /tmp/humanoid.custom.geo.json
```

The completed sheet was visually inspected. Corresponding head/torso placement
and limb endpoints agree within the recorded finite samples; the expected
segmented-versus-rigid limb-shape difference remains visible. This does not
validate skin selection, native bone visibility, first person, animation layer
priority, body yaw, seat alignment, clipping, client blending or multiplayer.

## Remaining work

The production wheel clock still cannot reverse its accumulated phase. The
Java source integrates separate signed internal speed, which can continue while
collision prevents displacement; this bundle does not substitute native
velocity or position deltas for that state. Handle/front-wheel steering is not
newly bound here. The bounded rider base-pose preview above does not establish
helmet presentation, actual seat position, input availability or
controller/keyboard/touch behavior.
