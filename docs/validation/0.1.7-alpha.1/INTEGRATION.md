# 0.1.7-alpha.1 — integrated kitchen candidate

This is a new, unreleased source identity. It combines PR #18 (foods/drinks),
#20 (native containers), #19 (stove), #21 (visual/audio source conversion),
#15 (Java crafting) and #16 (confirmed saves). It does not include POI PR #11:
that branch's measured high-density performance regression remains unresolved.
Pack UUIDs and canonical data ownership are unchanged. Minimum Bedrock 26.60,
stable server API 2.11.0 / server-ui 2.0.0, Upcoming Creator Features required.
No Beta API or POI dependency is introduced by this integration.

## Actual integration repairs

- Keep the new direct/single-page stove controls, not the old nested form.
  Connect both direct deposit and form transfers to the stove's existing input
  identity, reset and save owner. Failed synchronous saves restore the native
  player/stove stacks and input/progress state. Unload invalidates the actual
  live single-page session, so reopening a chunk cannot revive an old response.
- The same live smoking registry drives both cooking and direct-deposit routing.
  Preserve 200-tick batches, result counts, lane blockage and per-stove fire state.
- Preserve real 27/54-slot refrigerator block inventories while integrating the
  separate opening/closing clips. The hidden upper block receives the closing
  state and generated permutations too; neither a form inventory nor an empty
  replacement helper is reintroduced.
- Merge food and recipe provider entrypoints instead of overwriting either one.
- Keep owned guide text as editable generator input and prevent duplicate keys
  when retaining non-guide translations. Regeneration preserves native-container
  labels, the current stove guide and all existing chapters.
- Reconcile source animation, smoke/fire resources, crafting and native-container
  generation under one converter, and reserve paired 0.1.7 package metadata.

## Checks executed during integration

- Node actual-module/API-fixture suite: **460/460 PASS**, zero skipped.
  Includes added direct-control/save-failure and late-provider integration cases.
  Previous nested-form tests were adapted to the delivered single-page controls;
  cancellation, stale-stack, full-inventory and unload assertions remain.
- Python source/geometry suite: **16/16 PASS**.
- Resource validator: **361 JSON, 13 block definitions, 17 recipes,
  297 geometries, 38 animations, 317 permutations; zero errors**.
- Typecheck, source conversion, BP/RP/mcaddon build, legal/source inventory and
  release-policy regression passed locally. Remote verification must independently
  install the declared lockfile and test the exact integrated source.

The original PR reports describe their original runtime hashes. They remain
historical evidence, not a claim that this combined candidate was run in BDS.
**Combined BDS, real Player containers, revocation, touch/controller, multiplayer,
Blockbench visual review and actual game/audio checks remain NOT_RUN.**
The original alpha.3 client failures are not overwritten. No Release, tag,
private family lock, LIVE world, or author distribution permission was changed.
