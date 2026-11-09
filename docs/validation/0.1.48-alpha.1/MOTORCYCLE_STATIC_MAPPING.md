# 0.1.48-alpha.1 motorcycle static mapping: unpublished candidate

Date: 2026-11-09. This is an unpublished .48 integration/freeze/build candidate,
not a Release, tag, .48 main update, LIVE installation or native-client result.
PR #75 has merged. This candidate is based on actual main
`769ed851643aa438c65f600795ddb64b1f751225`. Its package source identity must
always be checked against the exact candidate commit; a generated source URL
is not by itself evidence of publication.

## Included inputs and preservation

The actual main base is `769ed851643aa438c65f600795ddb64b1f751225`, whose tree
is `25b597b33293b9dab982acf5beb1c29f1da56f27`. Its .47 runtime descends from
`ce7e8916ac5627be08a6c366ea933a4ad96ad3bd`. Merged #75 customer/helmet
documentation matches the reviewed local input
`db39ad51523e031e78a765f354e3bf1d0c29143e`, tree
`25b597b33293b9dab982acf5beb1c29f1da56f27`. All 94 changed document paths
are retained: 93 byte-identically,
and `docs/VISUAL_AUDIO_PARITY.md` with only additive motorcycle text.

Static source repair inputs are `1ee5757cbaf2547debd523fdedbbca59939d504f` and
`df6d0ade7fe6e0667c0078e5d417686a89f1159a`. The independently reviewed public
motorcycle evidence input is `6a1a68f619480213d63b84eb8785cf1f9e4b7a6e`, tree
`f281ba195146733ad6d40088fb4d0b51e59b5a91`. All 27 files inside the motorcycle public-evidence bundle and the separate
`docs/MOTORCYCLE_SOURCE_MAPPING.md` contract remain byte-identical to that input.
The additional `docs/VISUAL_AUDIO_PARITY.md` index text is combined with the
earlier records. These are the 29 paths in that evidence commit.

Only `runtime/RP/models/entity/motorcycle.geo.json` changes functionally:
seven static bone X signs and 41 cube mirror flags. Every other authored field,
texture, sound, original source, runtime behavior script, material binding and
animation remains unchanged. Geometry SHA-256 is
`c94a03d87f3916b374375f2cd03d98f213d5867c0a56464fc6a12c5987490093`.

The [mapping contract](../../MOTORCYCLE_SOURCE_MAPPING.md) explains renderer
registration, the explicit common coordinate frame and 0.016 vertical-origin
normalization, official GPL Blockbench exporter evidence, physical-face UV
identity, zero-width planes, inflation and full bounded parser consumption.
The [nine raw photographs and reproducible scenes](../visual-audio/motorcycle-source-mapping-20261109/README.md)
record the old front V-fold and corrected neutral white/red/blue/yellow models.
They use a common editor renderer; they are not native Java/Bedrock screenshots.

## Paired .48 identity

Package/lock version: `0.1.48-alpha.1`. BP/RP header and module versions plus
BP-to-RP dependency: `[0,1,48]`. Stable pack/module UUIDs, engine `1.26.60`,
Server API `2.11.0` and Server UI `2.0.0` are unchanged. Upcoming Creator Features
remains required for native refrigerator containers.

The unchanged build algorithm computes:

- BP: 101 files, `2c30ff50a65dfd746510857930f793b0a625d8d57cdb76cad7a9ae84ceb103c2`
- RP: 546 files, `1bdb6df554acccb94c3660cfacd3eab12dbb74eab3245ebad0c032155d7a826b`

`release-history.json` appends only `0.1.48`; every prior entry is preserved.
Relative to the reviewed source, runtime changes during freeze are limited to
the two versioned manifests. No original artwork or extra feature is bundled.

## Required local verification and package identity

Run the full JavaScript suite serially (937 tests), full Python discovery with
existing pinned native-input fixtures (74 tests), TypeScript/pack checks, actual
motorcycle regeneration, the prior customer/helmet public verifiers and the
motorcycle public verifier plus six safety regressions. No test is disabled.
Existing local dependencies are reused without installation.

Native prototype inputs remain the unmodified external Mojang files pinned at
`15701fa9c13923f12662984c32c124327e40e3d3`: humanoid blob
`20be2c062b76d76782273d484c73d1c3a5d30858` and mobs blob
`02d00eb952023ec67eb214af184a6f703e74f478`. They are test inputs, not shipped files.

Build only after the source commit is clean. Verify non-release compliance,
release-policy regression and matching-tag environment fixture without creating
any tag. The build-info sourceRevision must equal the exact local source commit
and sourceDirty must be false. Audit BP/RP contents, nested MCAddon bytes,
manifest identities, source/legal notices and SHA-256 sums against that source.
A repeated clean build must reproduce all bytes. Exact commit/tree, commands,
results and package checksums belong in accompanying external validation logs,
not a self-referential source commit claim inside this document.

## Publication gate and remaining limits

The reviewed .48 increments have been integrated onto actual merged #75 main,
with source, evidence and frozen runtime identities preserved. Publication of
this .48 candidate remains a separate step. Recheck current main and candidate
identity before publication; any later commit/tree change requires fresh build
and preservation proofs. Do not relabel these packages as another commit's output.

Independent source checks yield max corner residual 1.2905531e-7 model units and
zero physical UV endpoint residual. That does not prove all 41 prior mappings
were visible pixel defects. Fixture UUID graphs are collision-free and checked
through their actual parent chains. Original zero thickness and inflation are
preserved; editor 0.001 plane expansion and 1/64-pixel UV insets are not native
measurements. Native filtering, backface culling, alpha/emissive lights, moving
steering/wheels, ridden alignment, gameplay/client timing, multiplayer and LIVE
behavior remain untested. Existing missing steering and unsigned-distance wheel
adaptations are explicitly not repaired by this static correction.
