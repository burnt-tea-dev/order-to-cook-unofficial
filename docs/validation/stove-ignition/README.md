# Stove ignition source-geometry repair

Date: 2026-11-08. Source-only candidate based on `f8e0895f0703d786c6f282ad3001a9de2ada5460` (the unchanged 0.1.45-alpha.1 release identity). This report covers source inspection, production-service tests with engine doubles, and offline geometry checks. It does **not** report Blockbench GUI, Minecraft Java/Bedrock client, BDS, multiplayer, native rendering, or published-package validation.

## Result and scope

The registered Java stove renderer uses a two-bone Geo model and a reachable one-second `fire` clip. The existing Bedrock stove had only the six texture phases, with no binding for the source ignition wobble or squash. The repair makes the source poses reachable through ordinary cooking/fuel use without replacing the cooking service or introducing another scheduler.

- The source's independent `fireAnimationTicks` countdown is set to 20 on every successful fuel consumption, decremented at the start of each processed game tick, and cleared on service/chunk initialization. It continues after fuel expires. No separate animation token or clock is added.
- `stoveIgnitionFrame` derives age `20 - remaining` while the countdown is positive. Zero is neutral both at ignition age 0 and after age 20/STOP. The runtime never writes ages outside 0–19.
- Age is represented by `ignition_frame` (0–15) plus 16 times `ignition_frame_high` (boolean). The converter's existing wide-state adapter generates the matching geometry conditions. This is independent of `fire_frame`, so even custom fuel shorter than 20 ticks can extinguish its texture while geometry finishes.
- `lit`, `fire_frame`, and both age states are committed in a **single** `setPermutation` call, only when something changed. A missing resource/state fails cosmetically without changing inventory or cooking state.
- Age 1–19 selects `stove_ignition_1.geo.json` through `stove_ignition_19.geo.json`, baked from the original Geo hierarchy at age/20 seconds. Ages 0 and 20 use the unchanged canonical `stove.geo.json`. There are 20 distinct reachable pose choices, not a continuously evaluated client animation.
- The original six PNGs, all material settings, canonical neutral/item mesh, collision/selection, sounds, particles, fuel rules, cooking, storage and rollback algorithms remain unchanged. The only cooking-loop addition records that the source animation countdown advanced.

The normal appliance scheduler remains **one call every two game ticks**. It processes both ticks before publishing, so a newly consumed fuel normally first appears at age **1**, then 3, 5, …, 19. A one-tick initial service offset reaches ages 0, 2, …, 18; all integer ages are available. Neither the service nor other appliances were accelerated for this repair.

## Fixed source evidence

All OTC references use [`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642). Full file URLs, Git blob identities and SHA-256 values are in [source-provenance.json](source-provenance.json).

- [`OrderToCookModClient.registerRenderers`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/OrderToCookModClient.java) registers STOVE with StoveRenderer (blob `9ce9ceabf37b4d39a390f75ac44fced8516043fe`).
- [`StoveRenderer`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/StoveRenderer.java) constructs StoveGeoModel (blob `b0c40be9c79d37bbab0b2c5942ea2dee7c0285d4`).
- [`StoveGeoModel`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/StoveGeoModel.java) binds `geo/block/stove.geo.json`, `animations/stove.animation.json` and the six stove textures (blob `344065ea0707ec53ac4a056e142cacdb02df12f1`).
- [`StoveBlockEntity`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/StoveBlockEntity.java) decrements `fireAnimationTicks` before the burning/fuel logic, triggers it on every new fuel, sets it to 20, and resets controller playback on a new token. Closing the UI, removing inputs or blocking outputs does not cancel this countdown (blob `1e294bf78139daaa676732e84d2331da195bcdee`). NeoForge's corresponding entity has the same trigger, controller and load/reset behavior.
- The bundled source Geo and animation bytes have Git blobs `875a37c0579eb449512a03361e42509625a6a29b` and `0e13e05844344566da40d904992f15936b8e81e0`. Tests hash those bytes directly. Every generated active geometry has both source dependencies and SHA-256 values in `runtime/asset_conversion_manifest.json`.
- OTC declares GeckoLib **4.8.3**. Its source commit is [`e81962eefd04e0cab90445d3df37b477d2767ffd`](https://github.com/bernie-g/geckolib/tree/e81962eefd04e0cab90445d3df37b477d2767ffd). The relevant parser, controller, easing, degree-sine, Animation/RawAnimation, GeoAnimatable and AnimationProcessor blobs are identical at the previously cited 4.8.4 commit `7d6f32db9168a24e14b327c0ad9f8f87dfc204de`.

## Geometry and easing contracts

The body scales about `[0,8,0]`; its child `group5` scales and rotates about `[0,2,-5]`. The child's early rotation is `sin(t*3000 degrees)*3`, including the interval before its first key at 0.0833. The sine is then attenuated to zero at 0.75 seconds. The initial key is not a quiet lead-in, and the sine is not radians per second.

Both late scale tracks use Gecko's elastic curve `1 - cos(pi*u/2)^3*cos(pi*u)` toward their 0.875-second key, followed by its default two-step easing toward neutral. In the pinned `EasingType.step`, the final internal interval shortcut uses **strict >**. Therefore the expanded pose remains at exactly **0.9375 seconds**, and the halfway return begins only immediately after that point. Both `tools/convert_assets.py` and the independent review evaluator now honor this boundary. Tests use literal expected values at 0.9375, `nextafter(0.9375, 1)`, 0.9375+1e-9, and 1, rather than using either evaluator to manufacture the expectation. Four-step controls also ensure the fix does not incorrectly move every internal boundary backwards.

The only pinned animation using step is the stove. Existing baked refrigerator/dishwasher/printer/bag geometry is unchanged. The integer game-tick grid never lands on 0.9375, but the shared evaluators must still be correct for offline review and other sample times.

The source has three axis-aligned cuboids and **17 faces**, with signed/rotated UVs preserved. The old neutral mesh has the same cube corners and the same source texels after normalizing 16px to 64px UV coordinates, plus one wholly interior upper-lip south face at `z=-5`, `x=[-8,8]`, `y=[12,16]`. Active source meshes omit that interior face; neutral and inventory appearance retain the previous 18-face mesh. This is an explicit source-mesh difference, not a missing exterior face.

No descendant shear exists in this clip: the child rotation is zero before nonuniform parent scaling starts. Independent direct source formulas compared against 1,005 baked sample times, including extrema and both sides of the step boundary, found:

- Maximum corresponding vertex distance: **0.000001417696 pixels**, attributable to six-decimal serialization.
- Union bounds: X `[-8,8]`, Y `[-0.42629,16.42629]`, Z `[-8.852579,8.852579]` pixels.
- All poses passed the existing block-geometry bounds without clipping, resizing or corrective translation.
- Every active runtime face retains the original source UV data. The service integration tests resolve emitted age/material states to the actual generated geometry, and cover every age in all four facings.

## Adaptations still present

This is a **finite 20Hz source-pose grid published at 10Hz**, not exact continuous Java or native-client parity. Sub-tick elastic extrema are skipped, and the 8.333Hz wobble is aliased by the publication cadence. No interpolation claim is made.

Java starts the controller from a received animation token, not a shared server ignition timestamp. Late client/render initialization can start at clip age zero after the server countdown has already advanced. Its update-packet handlers also call `load`, whose burning-phase normalization can force the client texture to cycle phase 3. The Bedrock implementation retains the existing server-intended 15-tick dark delay, 5-tick burst and 8-tick cycle sequence rather than silently reproducing those packet/load quirks.

GeckoLib's default bone reset is five ticks after STOP. If the client receives STOP before the neutral clip endpoint, its return can interpolate from the last rendered pose. This adapter returns to canonical neutral at countdown zero and does not emulate that render-dependent reset or add a timer to pursue it. Disk/chunk/service reload intentionally clears animation playback and resumes burning cycle textures, without replaying fuel, catching up unloaded time or repeating ignition.

The short-fuel regression injects a three-tick stick duration through the existing test/context hook; it is not a shipped fuel-map change. The shipped minimum remains 50 ticks. The independent source countdown correctly survives that early extinction, without extending fuel, cooking, sounds or particles.

## Executed checks

Commands were run from the source candidate. Results are also recorded in [checks.json](checks.json).

- `node --test tests/stove-ignition.test.js tests/stove-fire.test.js tests/stove.test.js tests/stove-controls.test.js tests/appliance-particles.test.js`: **59 passed, 0 failed**. Twenty new service tests cover actual scheduler initialization, both publication offsets, all four facings, 14/15/19/20 boundaries, two stoves, ordinary refuel, canceled UI, input removal, full output, invalid input/fuel, reload/unload during delay and burst, old saves, short fuel, break and external removal. Existing inventory, cooking, rollback and cosmetic tests remain enabled.
- `python -m unittest discover -s tests -p test_appliance_geometry.py`: **33 passed**, including five new stove source/easing/geometry tests.
- `python -m unittest discover -s tests -p test_dining_assets.py`: **4 passed**.
- `python -m unittest discover -s tests -p test_guide_languages.py`: **3 passed**.
- `python -m unittest discover -s tests -p test_ci_scope.py`: **8 passed**.
- `OTC_NATIVE_PLAYER_GEOMETRY=<external humanoid.json> OTC_NATIVE_SLIM_GEOMETRY=<external mobs.json> python -m unittest discover -s tests -p test_segmented_player.py`: **13 passed**, using the existing pinned external Mojang inputs. No native input or generated player override is added to runtime.
- `python tools/check_compliance.py`: **no errors**, 660 source references. Existing rights-scope clarification remains advisory. No package was produced, so the absent build-info warning is expected.
- `npm run verify`: **928 JavaScript tests pass, 0 fail**; TypeScript and resource checks pass (387 JSON, 318 geometry, 380 permutation entries, zero errors); **build is intentionally blocked** by `BP payload changed; freeze a fresh paired release identity before exporting`. The candidate does not modify package versions, UUIDs, baseline or release history. This is not an end-to-end successful verify/build and must be rerun after a fresh paired identity is frozen.

No original Java mod JAR, third-party dependency binary, player.json, GUI evidence or game-client claim is included. Native visual review and final paired-release validation remain separate gates.
