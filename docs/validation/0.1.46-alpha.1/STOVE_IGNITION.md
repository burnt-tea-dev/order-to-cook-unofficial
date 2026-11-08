# 0.1.46-alpha.1 stove ignition and visual review

Date: 2026-11-08. This candidate integrates onto merged .45 main `f8e0895f0703d786c6f282ad3001a9de2ada5460`. It is an unofficial GPLv3 adaptation. It does not create a Release/tag, restore withdrawn binaries, change LIVE worlds or report Minecraft/Java/Bedrock client or BDS acceptance.

## Implemented and observed

The [source-only implementation report](../stove-ignition/README.md) documents the missing registered Java stove ignition clip and its repair: independent 20-tick countdown, atomic material/age writes, 19 source-derived active poses and unchanged two-tick scheduling. Its original unfrozen build failure is retained as a historical candidate result, not this final version's build result.

The [new editor report](../visual-audio/blockbench-20261108/remaining-static/README.md) includes 19 actual stove source/baseline/candidate captures and 19 static furniture/shelf/helmet captures. All six sampled restored stove poses agree with an independent source evaluator in the inspected views. Paper shelf counts 0–10 and plate shelf counts 0–18 were inspected. The local helmet's North view agrees, while its isometric visor has a recorded editor transparency discrepancy. This is not native transparency or worn-player acceptance.

The [washing control](../visual-audio/blockbench-20261108/washing-pivot-control/README.md) adds two captures. Changing only six inactive source-cube pivots removed the previously recorded five-plate preview occlusion discrepancy. This supports editor sorting sensitivity, not a proven renderer-internal cause or native blend result. Historical screenshots and their recorded hashes remain unchanged.

## Version and preservation

BP/RP headers, modules and paired dependency use 0.1.46; package metadata uses 0.1.46-alpha.1. Stable pack/module UUIDs, min engine 1.26.60 and stable API versions remain unchanged. Baseline payload fingerprints and a new append-only release-history entry are frozen for 101 BP and 414 RP files.

All existing six stove textures, neutral/item stove geometry, appliance poses, fuel/cooking/inventory behavior and unrelated .45 payload are retained except the documented stove runtime additions and paired version fields. No player.json, Java JAR, copied dependency binary, live-world operation or new service/plugin is added. The full source includes its provenance and build tools.

## Validation gates

Independent source review passed the source candidate with 928 serialized JavaScript tests, 59 focused stove tests and eight additional direct probes. It verified all 14 pinned source provenance records and 1,536 state/material/facing combinations, including cosmetic failures and short-fuel countdowns. Python appliance 33, dining 4, guide 3, CI scope 8 and segmented player 13 passed. Its full default-parallel run failed once at a whole test-file worker; a second default-parallel run recorded a SIGKILL in a different worker (926 pass, one failure). Both files passed alone and the full serialized suite passed. The cause is not established; no memory-pressure or GUI explanation is asserted and test concurrency is not changed.

The frozen runtime candidate then passed the literal `npm run verify` with default test concurrency: **928 passed, zero failed**, TypeScript checks, 387 JSON / 318 geometries / 380 permutation resource checks and full .mcpack/.mcaddon construction. This later success does not erase the earlier worker failures. The preparation build truthfully reported `sourceDirty: true` before committing review documentation; a clean exact-commit build is required again before publication.

Python appliance **33**, dining **4**, guide **3**, CI scope **8** and segmented player **13** passed again. The segmented tests used the existing external Mojang humanoid/mobs files; those external inputs and any player override are not included in the repository or packages. Compliance reported zero errors with 660 tracked source references, and the release-policy regression passed. A direct `--release` check without a tag environment correctly failed the tag guard; the same checker passed under a matching `GITHUB_REF_NAME=v0.1.46-alpha.1` test fixture. That environment-only check does not create a tag or authorize a Release.

The new scene verifier passed **133 inputs / 100 evidence identities / 37 layouts / 38 JPEG mappings**. The washing-water verifier and six-pivot/two-image control verifier passed; local report links resolve. Independent GUI-evidence review inspected representative original screenshots and reproduced all 53 generated scene/pose artifacts byte-for-byte. Neither reproducer performs GUI or native acceptance.

Runtime tree SHA-256: `29d76d2a8bde343b1eeb3d229a8b682afb8fa2c4c44fa14f7be2f6de0d69e940`. BP payload: `603487b568b65a94f529fd1b705d13ea87146f881289b5a256f61ad4106f41ca` (101 files). RP payload: `3f23d772fd24721a716083dbc52e9f875347e648022d92cec765ba13679be5e3` (414 files).

A clean exact-commit build, independent frozen-package review and exact remote PR-head CI remain publication gates. GitHub's PR checks identify their actual remote commit; this preparation report does not assert an unobserved future CI result.

## Remaining adaptations

The result samples source poses at integer ticks and publishes every two ticks, with no interpolation. Sub-tick elastic extrema, the high-frequency wobble, Java client token/packet start and five-tick STOP bone reset are not exactly reproduced. It retains the previous server-intended texture phases rather than copying client load/packet quirks. Native transparency, shaders, controller playback, world placement, all camera angles, actual helmet wearing and multiplayer/client behavior remain untested. Other OTC models/animations still require further review; this batch is not all-model or 100% Java parity acceptance.
