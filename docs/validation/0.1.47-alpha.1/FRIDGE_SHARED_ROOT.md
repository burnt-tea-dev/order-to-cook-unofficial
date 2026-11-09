# 0.1.47-alpha.1 refrigerator shared root

Date: 2026-11-08. This candidate is based on merged .46 main `11280a09d232a3dd7e7d1e6f5ae42e5a9e5c53d7`, with implementation `e544f563062bf92e58afaa057a9ee52fd7ccbdc8` and reviewed recovery fix `dcee546b7b918e3deb0163ec607f280cef2880d4`. It is an unofficial GPLv3 adaptation, not a GitHub Release, tag, main-branch update, LIVE installation or native-client acceptance.

## Scope and independent review

The [source report](../fridge-shared-root/README.md) records the pinned OTC and GeckoLib evidence, common-root samples, runtime precedence, generated-state coverage and numerical limits. Both refrigerator blocks receive the same root sample while retaining their own door clip/frame. The active lower close controller overwrites upper, including neutral samples and restored zero-elapsed endpoints.

The first independent review found an upper-block lookup exception escaping storage recovery before cosmetic motion could run. The reviewed fix isolates that existing error log from cosmetic updates; it does not weaken migration refusal or mark failed migration complete. Its original three independent probes pass, including upper lookup failure/recovery, unreadable lower-anchor suspension and failed lower writes with same-tick deduplication. Official service tests additionally distinguish persisted pose recovery from stale viewer/motion cache and preserve container identities and cargo.

No new model, texture or functionality changes occur during this freeze. Only paired manifest versions alter the reviewed runtime bytes. Existing GUI evidence is maintained separately; this versioning report does not add screenshots or broaden their acceptance scope.

## Paired identity and preservation

Package and lock metadata use `0.1.47-alpha.1`. BP/RP headers, all modules and the BP-to-RP dependency use `[0,1,47]`. All stable pack/module UUIDs, min engine `1.26.60`, `@minecraft/server 2.11.0` and `@minecraft/server-ui 2.0.0` remain unchanged. Upcoming Creator Features remains required for the native refrigerator containers.

Baseline fingerprints are computed by the unchanged `tools/build.py` algorithm. `release-history.json` appends one entry; all 40 preceding entries are unchanged. No same-version payload is overwritten and no hash guard is bypassed.

- BP: 101 files, `08ef5595a66a8914d21f7136fce6639a65fa20857170f6c21de4e5dc6460fae8`
- RP: 546 files, `2f0debb5446c7b4071be3162d280ba2367ae96b63eaeaccda5998e9df6390077`
- Runtime tree SHA-256: `102621a6b1873ccde386b2848252a5ea6fd5f8edb46e98c3d1eabdb652debe98`

No player.json, Java JAR, copied dependency binary, new API/permission, native world operation, inventory/cooking change or unrelated asset is included. Original pixels, provenance and license notices remain intact.

## Validation procedure

The source-ready .46 guard failures remain historical evidence in the source report. The .47 candidate must pass the normal build checks with its new identity. Full JavaScript verification is serialized to avoid repeating the earlier unexplained whole-worker failures; no test is disabled and package scripts remain unchanged. Python validation uses the exact CI dependencies, Pillow 12.3.0 and NumPy 2.3.5, in an existing isolated Python 3.12 environment.

Preparation passed the literal `npm run verify` under a single-CPU process affinity (`taskset`; Node reports availableParallelism=1): **937 JavaScript tests**, TypeScript, **519 JSON / 450 geometries / 578 permutations**, and both MCPack files plus the MCAddon. This is explicitly serialized execution of the existing scripts, not a new default-parallel result. Local Node is 24.22.1; the remote workflow remains Node 22 and still requires its own exact-head CI result.

All Python discovery tests passed: **65 total** (appliance 33, shared root 3, dining 4, guide 3, CI scope 9, segmented player 13), using Pillow 12.3.0 and NumPy 2.3.5. Compliance reports zero errors with 924 tracked source references; the existing pending rights-scope clarification remains advisory, not a claim of new permission. Release-policy regression and the matching-tag environment fixture pass. No tag was created. The preparation build truthfully reports `sourceDirty: true` and `sourceRevision: null` before this documentation/freeze commit; those preparation package hashes are not the final clean-build delivery.

Segmented-player prototype checks use external, unmodified Mojang inputs pinned at `15701fa9c13923f12662984c32c124327e40e3d3`: humanoid Git blob `20be2c062b76d76782273d484c73d1c3a5d30858` and mobs blob `02d00eb952023ec67eb214af184a6f703e74f478`. Their bytes were rechecked against that repository ref. They are test inputs only, not included in source or packages.

A clean isolated clone of the final commit is required for deliverable packages. `build-info.json` must record its exact `sourceRevision` and `sourceDirty: false`; package payloads, nested MCAddon packs, source/legal notices, manifest identities and checksums must match the frozen source. A repeated clean build must produce identical bytes. A matching-tag environment fixture tests the release-policy guard without creating a tag or publishing anything. Exact-commit results and package hashes accompany the build, avoiding a self-referential commit claim inside this source document.

## Remaining adaptations

The 176 meshes cover each own door pose times four common-root samples. Source affine-to-cuboid fitting has a measured maximum residual of **0.20155644370746567 modelpx**, separately from the maximum **0.08611500000000305px** bounds shift. UV changes and cabinet seam difference are zero in the offline cross-product tests. These are mathematical checks, not native render measurements.

Animation is sampled every two ticks. Java continuous interpolation, forceAnimationReset, STOP/bone reset and mid-stroke reopen are not reproduced exactly. Two block writes are non-atomic; a failed half converges only on a later successful tick. An unreadable upper no longer retains its root contribution on readable lower; an unreadable lower anchor still suspends the whole station and cannot update a lone upper. Native client, material timing/transparency, actual multiplayer/UI input and internal food display remain open. This is not full Java parity or all-model visual acceptance.
