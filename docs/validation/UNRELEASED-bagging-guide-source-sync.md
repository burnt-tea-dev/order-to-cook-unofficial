# Bagging guide source synchronization

Date: 2026-11-08. Local base: `9b137744e4ed32a2be1d04143324fcce6df28155`.

The editable `assets/guidebook/{en_US,zh_CN,zh_TW}.lang` files still contained
delivery-only bagging instructions, while the shipped `runtime/RP/texts` files
already described dine-in bags and canonical carrier validation. Since the
converter gives guide source keys precedence, regeneration restored twelve old
values. This is the existing drift recorded in the washing-table water report,
not a change introduced by the water geometry.

Only `otc.guide.page.bagging.title` and `step1`–`step3` in each guide source were
copied verbatim from the shipped language files at the base commit. All other
source values and line ordering remain unchanged. The three `port_assets`
SHA-256 values were refreshed. The converter and all shipped RP language bytes
remain unchanged; no newer runtime wording is replaced by this patch.

## Regression coverage and results

- New `tests/test_guide_languages.py`: three tests pass. The tests call the real
  `make_languages()` against temporary outputs and compare parsed key/value maps,
  rejecting duplicates. They cover fresh-output fallback, existing-output
  preservation of a newer runtime-only message (including `=` in its value),
  replacement of stale guide/generated labels, repeated regeneration and key
  order, and source SHA provenance. Both existing CI asset-test stages run it.
- Before the source fix, the same suite failed on all twelve individual bagging
  key comparisons and the complete regenerated maps. Afterward all 198 current
  translations per language survive regeneration.
- Full offline `tools/convert_assets.py --output <temporary directory>` succeeds:
  622 source references, 59 BP JSON and 299 RP JSON outputs. Generated provenance
  matches the updated manifest byte-for-byte. Every generated file matches the
  checked-in counterpart except the three language files, whose parsed maps are
  identical; their pre-existing machine-limit key relocation is not committed.
- Appliance geometry: 28 tests pass. Dining assets: 4 pass. CI scope: 8 pass.
- `npm run verify`: all 812 JavaScript tests, TypeScript and static pack validation
  pass (368 JSON, 299 geometries, 361 permutations, zero resource errors).
  **The complete verify command does not pass:** build stops at the existing
  `BP payload changed; freeze a fresh paired release identity before exporting`
  guard inherited from the water candidate. No identity or version was changed.
- `tools/check_compliance.py`: zero errors; existing rights-scope advisory and
  missing-dist warning remain. Local tools: Node 24.22.1, Python 3.12.14,
  Pillow 13.0.0; CI specifies Pillow 12.3.0.

## Limits and integration

This is source/output consistency coverage, not an in-game language or visual
acceptance result. No Minecraft, BDS, GUI, LIVE data, user-local environment,
publication or versioned package was involved. Integrate the narrow source
changes without overwriting later runtime translations, then rerun regeneration
and the complete build against the final paired release identity. The water
candidate's separate rendering limitations are unaffected.
