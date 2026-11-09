# Motorcycle presentation: bounded source repair

2026-11-09. Based on main `8008294306180ece040b908684bf4fa11afb75c8` and
Java `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`,
**Forge 1.20.1**. Candidate identity: `0.1.51-alpha.1`, not a published Release.
No BDS, Minecraft client, LIVE or user computer was used. The evidence below is
source inspection, formal API declarations, API doubles and offline model work.

## Result

- Correct the active wheel **model-local X-angle sign** after the .48 geometry
  repair. Keep the existing unsigned distance source and magnitude. This does
  **not** implement signed reverse, Java wheel speed or collision/coasting parity.
- Bind the original eight-second `drive_idle` as a third-person, motorcycle-only
  base pose. Fit the source segmented limbs to the existing classic native rigid
  limbs, including their endpoint lengths, and compensate the native head's
  additional torso parent. It is not a replacement segmented player renderer.
- Do not infer steering input from heading changes, velocity, position deltas or
  undocumented mounted `getMovementVector()` signs. Stationary steering remains
  unbound. Reverse uses the same newly restored base pose; `drive_back` selection,
  body-yaw lock, automatic helmet, first-person and horn/light rider clips remain
  unimplemented.

## Main and open-PR check

`AGENTS.md`, `docs/PARITY.md`, latest remote main, the four initially open PRs and their
changed-file lists were inspected before editing. A pre-commit recheck also
inspected the newly opened #81 and its changed-file list; main was unchanged. The two shared `entities.js`
patches were also read, along with their discussions:

| PR | Existing work | Relationship to this change |
| --- | --- | --- |
| [#11](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11) | POI chair lookup/customer spawn | Shared file, different functions. No POI or spawn changes here. Its import may need ordinary integration context resolution. |
| [#77](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/77) | Creative placement/dye consumption | Shared file and nearby interaction context; consumption lines are untouched. This branch does not include or supersede that fix. |
| [#63](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/63) | Unwired NPC candidate rules and preservation tests | Separate files and behavior. |
| [#80](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/80) | Low-memory dining/dishwasher work, .49 candidate | No gameplay overlap. Package identity files are shared integration metadata; this branch uses a separate .51 identity and does not include .49 changes. |
| [#81](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/81) | Fridge helper identity preservation, .50 candidate | Opened during this work. No gameplay overlap; package identity files are shared. This branch uses .51 and does not include the fridge fix. |

There is **file-level overlap**, not an exclusive-owner agreement. No claim of
coordination approval is made. New session logic and tests are separate files;
`entities.js` contains only the import, construction and mount/spawn/leave/reload/
existing-tick hooks. No remote branch was overwritten or force-pushed. Recheck
current PR patches when integrating; this draft is not permission to merge them.

## Three different Java data sources

All paths in this section belong to the fixed Java commit above.

### Steering state

[`MotorcycleEntity.java:180–280`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L180-L280)
maps positive side input to −45°, negative to +45°, and zero to zero. The mounted
target approaches by 4.5°/tick; unmounted return is 2°/tick. Visible handle angle
separately approaches the target by `6 + 8*clamp(abs(internalSpeed)/0.6,0,1)`.
Reverse changes body-turn direction, not the handle target. Heading change cannot
recover steering at rest.

The [official stable InputInfo page](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputinfo?view=minecraft-bedrock-stable)
and locked `@minecraft/server@2.11.0` declare `getMovementVector(): Vector2`, without
a mounted custom-vehicle axis/sign contract. The separate protocol evidence and
its missing Script API bridge are preserved in the
[existing input audit](visual-audio/MOTORCYCLE_INPUT_CONTRACT_20261109.md).
This review did not close that gap. It does not claim directional input is
impossible or absent from every official source.

### Wheel phase

[`MotorcycleEntity.java:180–288`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L180-L288)
maintains `internalSpeed` separately from actual displacement. It approaches
+0.6/−0.3 by 0.02 per tick, decays by 0.01 while mounted or 0.005 unmounted, and
adds `internalSpeed*25` degrees when its magnitude exceeds 0.001. Collision-limited
movement does not replace that state. A stationary throttle-against-wall case and
a neutral stopped case can have the same displacement but different wheel phase.

The [official distance query](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_modified_distance_moved?view=minecraft-bedrock-stable)
is accumulated horizontal distance since load, potentially modified by status
flags. [`Entity.getVelocity()`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable#getvelocity)
returns current velocity; it does not expose Java's hidden engine-speed state.
No velocity or position reader was added. Multiplying all accumulated distance by
the current input sign would invert old phase and is not used.

### Rider reverse selection

[`RiderAnimatable.java:288–318`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/gecko/RiderAnimatable.java#L288-L318)
projects `getDeltaMovement()` onto
`Vec3.directionFromRotation(0, m.getYRot()).normalize().scale(-1.0)`, the Java
motorcycle's forward axis, and selects `drive_back` below −0.01. This is different from the wheel's `internalSpeed`.
The controller explicitly uses `thenLoop("drive_back")`; the JSON's
`hold_on_last_frame` alone is not the effective Java controller policy.
No reverse selector was wired in this change.

[`RideOrientationLock.java`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/animation/RideOrientationLock.java)
sets the local player's body yaw to vehicle yaw+180 without setting head/camera
yaw. Bedrock `setRotation` is not substituted for this renderer-only operation.
Java seat/world constants and renderer pre-transforms are not copied into the
Bedrock seat or player position.

## Wheel mapping repair

[`MotorcycleModel.java:93–105`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java#L93-L105)
assigns steering to handle/front Y and rolling to front/rear X. The current
[neutral mapping](../MOTORCYCLE_SOURCE_MAPPING.md) uses the common frame
`(JavaX,24-JavaY,JavaZ)`. Its reviewed dynamic extension is:

| Bone | Bedrock rotation for Java wheel W and handle H |
| --- | --- |
| `handle` | `[0, -H, 0]` |
| `front_t` | `[W, -H, 0]` |
| `rear_t` | `[W, 0, 0]` |

The old dynamic audit's X/Y-both-negative statement preceded the .48 correction;
it must not be reused for the current model. The runtime and generator now use
`q.modified_distance_moved * 114.6` on both wheel X channels. The magnitude 114.6
is retained as an existing native adaptation, not presented as Java's 25°/tick
integrator or a calibrated real wheel circumference.

The regression reads the **actual active RP expression**, constructs a
nonnegative distance only to isolate selected positive source angles, then
evaluates separate Java and RP hierarchies. It does not feed synthetic reverse
distance into production and call it a working reverse controller. Signed wheel
and ±45° combined steering views are explicitly **UNWIRED reference poses**.

At +15/+60/+120°, the old sign gives maximum corner errors of approximately
3.4336/11.4891/11.4891 model pixels. The repaired and combined reference mappings
are within `1.291e-7`, with zero face-corner UV error across all 41 cubes. This is
a finite model-coordinate result, not a game-space travel or rendering result.

## Third-person base pose

Source assets are `common/src/main/resources/assets/ordertocook/animations/drive.animation.json`
(`drive_idle`) and `geo/drive_idle.geo.json`, already preserved under
`upstream/reference`. New provenance entries point to these exact input bytes.
The dedicated converter rejects unsupported easing or an unreviewed moving torso
instead of applying the chair/handwash assumptions silently.

The pinned GeckoLib 4.8.3
[keyframe decoder](visual-audio/placement-poses-20261109/source/gecko/BakedAnimationsAdapter.java)
expands a `pre` key at t−0.001, applies the keyframe's `lerp_mode` to its post value, and selects spline
anchors in `addSplineArgs`. The
[CatmullRom implementation](visual-audio/placement-poses-20261109/source/gecko/EasingType.java)
supplies the curve. Thus source right-arm X at 0.5s is −73.59375°, not the linear
−73.75°. The source is sampled at 20 TPS plus authored/expanded knots: **163
times**. Constant output channels collapse to one vector. Between output samples
Bedrock interpolation remains an approximation to the Java curve.

The source head and upper arms are torso siblings; native head/arms are body
children. The new idle path composes the complete inverse torso transform for
the head, including its changing Y angle, and uses the existing endpoint fit for
rigid limbs. Source head direction and shoulder/hand/hip/foot endpoints are checked
at 0, 0.5, 5, 7 and 8 seconds. Matching endpoints does not reproduce elbows, knees,
the entire limb surface or every skin geometry. Existing handwash, chair and
segmented-prototype conversion paths are unchanged.

[`motorcycle_presentation.js`](../../runtime/BP/scripts/motorcycle_presentation.js)
uses [stable `playAnimation`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable#playanimation)
with a distinct controller and
[mount-type stop expression](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_is_riding_any_entity_of_type?view=minecraft-bedrock-stable).
The RP also gates the pose by motorcycle mount and `!query.is_first_person` and
uses [override_previous_animation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_animation.v1.8.0?view=minecraft-bedrock-stable)
to reset its participating bones before applying the pose.

Successful package-owned mounts start the loop; a confirmed mount restarts even
if a same-bike dismount/remount occurred before the next five-tick cleanup. The
existing startup/playerSpawn hooks restore mounted players. Leave/dismount clears
only this controller. Maintenance inspects existing sessions and never restarts
the loop on each pass. There is no new interval, global scan, saved state, player
definition, item mutation, seat adjustment or movement override.

API failures remain cosmetic. A failed start can be retried on a later mount,
spawn or reload; there is no automatic background retry. External commands or
other addons that mount/change vehicles without these hooks are not fully
adopted. The old .20 native API acceptance supports the existing calling pattern,
not successful rendering of this new clip/controller.

## Verification and previews

The new Node suite is included by the unchanged `tests/*.test.js` entry. The
existing CI-selected `test_motorcycle_mapping.py` now loads the dynamic and rider
suites explicitly; they are not orphaned tests. The workflow is unchanged.

- `node --test tests/motorcycle-presentation.test.js`: **7/7 PASS**.
- `python -m unittest discover -s tests -p test_motorcycle_mapping.py -v`:
  **18/18 PASS** (9 existing + 4 dynamic mapping + 5 rider cases).
- Source forearm perturbation changes only its fitted arm and rejects the stale
  output. Restoring the old wheel sign fails without changing UV. Missing front
  steering or adding rear steering fails the reference checks.
- Full `npm run verify`: **944/944 Node tests PASS**, zero failures/skips;
  TypeScript, **520 JSON / 450 geometry** validation and paired build PASS.
- `tools/check_compliance.py`: **926 source references**, zero errors;
  `tests/check_release_policy.py` PASS. Existing attribution/rights notices remain.
- Runtime tree SHA-256:
  `6d11b283d0a3638c963d50a7253427201549487111edffa7d8037d7b20d900be`.
  Exact commit CI results are recorded in the final PR.

[Offline preview package](visual-audio/motorcycle-presentation-20261109/README.md)
contains source/before/candidate wheel views, separate unwired steering/reverse
references and a manifest of exact inputs and output hashes. It uses original
model/texture data and a CPU rasterizer, with declared cameras and synthetic pose
times. It is not a Blockbench GUI capture, Minecraft screenshot or native clock.
The separate rider sheet compares the original segmented rig and pinned Mojang
classic geometry with the actual RP pose at 0, 0.5, 5 and 7 seconds. Its 48
endpoint/head-basis checks have a maximum residual of `5.917e-6` model pixels;
the different elbow/knee silhouettes remain visible. Neutral reference colors,
no skin/armor and no guessed seat/world positioning are used for that sheet.

## Remaining verification

Not run: mounted keyboard/touch/gamepad input, actual forward/reverse motion,
collision/coasting, live property/query values, client controller binding/layer
order, normal/slim/custom skins, clothing/armor/held items, seat contact, body/head
orientation, first-person, lighting/culling and cross-chunk/reconnect gameplay.
No offline pass is substituted for any of these. The unbound steering/signed
wheel/reverse rider/helmet differences remain visible in `docs/PARITY.md`.

The fresh paired .51 package identity preserves UUIDs and stable API/engine
dependencies. It exists to prevent changed BP/RP bytes being exported under .48
or the unrelated .49/.50 candidates; it does not publish, deploy or accept the pack.
Integration must retain the other branches' history entries and freeze the actual
combined payload under its own appropriate paired identity.
