# OTC 0.1.2-alpha.4 — client retest handoff (NOT-RUN)

## Scope and immutable history

This is a **new stable-API QA candidate**, not a release. It contains the already
merged source fixes for three 0.1.2-alpha.3 client FAILs plus the pinned Java
motorcycle and coin crafting recipes added in PR #15. It does **not** include
experimental 26.60 POI from Draft PR #11. Do not treat results from one candidate
as evidence for the other.

Original 2026-11-01 client observations and hashes stay unchanged:
[checkpoint](../0.1.2-alpha.3/client-20261101-linux-dot.md).
All [11 remaining single-player batches](../0.1.2-alpha.3/REMAINING-SINGLEPLAYER.md)
are **NOT-RUN on alpha.4** until independently observed. No participant or
test agent may overwrite that checkpoint to mark a historical FAIL as PASS.

## Entry identity

- GitHub source branch: `fix/otc-java-crafting-parity-20261103` (PR #15).
- Source commit, exact BP/RP file hashes and `.mcaddon` bytes/SHA256:
  obtain from the passing `Validate and build Bedrock add-on` run for the
  **final** PR head and the corresponding packaged files. The build prints
  `dist/build-info.json`; a source tree digest alone is **not** a package digest.
- npm 0.1.2-alpha.4; BP/RP version `[0,1,4]`; original pack UUIDs unchanged.
- Stable `@minecraft/server` 2.0.0 + UI 2.0.0, minimum Bedrock 1.21.100;
  no experimental POI / Beta APIs requirement on this branch.
- Use an isolated copy of a world, back up the complete original world before
  replacing BP/RP, and do not load this pack alongside older packs with the
  same UUID. Report exact OS, Bedrock version, input, world, commit and file SHA.

## Targeted real-client cases (all NOT-RUN)

1. **Fridge geometry**: with no unrelated resource packs, place a fridge
   north/east/south/west, open/close both halves and reverse mid-motion.
   Compare Content Log to the previous `refrigerator_lower_7` out-of-bounds
   and missing-geometry errors; capture frames and actual logs. Inventory
   content/stack identity and 27/54 capacity must also persist across reload.
2. **Water splash**: insert a dirty plate; wash by looking at sink for four
   seconds and cancel by turning away. Verify splash and absence/presence of
   raw Molang `.x/.y/.z` errors; also run an 8-plate dishwasher cycle. A
   successful plate transaction alone does not close the particle FAIL.
3. **Progress form contrast**: open personal progress and move focus from
   locked to unlocked to unsupported rows, under both keyboard and available
   touch/controller. Capture unselected text, focus background, counters and
   navigation. Do not infer readable text from the Node sanitizer test.
4. **Java motorcycle crafting**: in Survival, use the 3×3 pattern
   `I C / BRB / 5 5` (iron ingot, chest, two iron blocks, redstone block,
   two five-value OTC coins). Confirm exactly one motorcycle, no unpaid free
   item, then place/ride/recover with original vehicle metadata.
5. **Coin exchanges**: craft all six upstream conversions and compare input
   count and resulting denominations: `5×20→100`, `100→5×20`,
   `4×5→20`, `20→4×5`, `5×1→5`, `5→5×1`.
   Each operation preserves total value; also try a full inventory and log
   actual behavior. Recipe JSON tests are NOT a native crafting test.
6. **World migration and rollback**: use a *clone* of a backed-up
   0.1.2-alpha.3 diagnostic world, import 0.1.2-alpha.4 with unchanged
   UUIDs, compare a named fridge item, a saved customer/order and restaurant
   coin ledger, exit normally, reload and compare again. For rollback, restore
   the complete original world backup **and** original BP/RP together.
   Never downgrade only the pack against a mutated world.

Use the existing [results template](../DOT_REPORT_TEMPLATE.md) for precise
PASS / FAIL / BLOCKED / NOT-RUN, camera/log evidence and hashes.
No native-client, real-player concurrency or arbitrary saved-world rollback
claim is made here. Keep PR #15 Draft and do not ship until acceptance.
