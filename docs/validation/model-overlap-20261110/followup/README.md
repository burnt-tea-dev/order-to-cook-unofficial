# Follow-up: dishwasher door and stained plates

使用者補報的兩處有不同原因：洗碗機門背與籃前共面；39 個餐盤階段的污漬另用非常貼近盤面的薄片。本輪分別退開門背、把原污漬像素合到盤面，沒有把所有髒盤一律移高。下列是真實雲端 Blockbench 圖；測試消除了競爭幾何，但不是 Minecraft 閃爍已驗收的聲明。

## Why the first pass was insufficient

The first exact-coplanarity classifier treated every nonzero-alpha texel as an occluder. The closed dishwasher front has partially transparent pixels: an alpha-test threshold can discard some of them and expose its back/basket contact. The stain faces are not exactly coplanar at all: they are only **0.01563 model pixels / 0.000976875 blocks** above the plate. Neither issue is cleared by the historical 33→0 same-facing sample count.

The bounded door diagnostic tests alpha thresholds 1, 128, 162 and 255 as sensitivity scenarios. Threshold 128 yields 324 exposed differing samples in the closed contact, while treating every nonzero alpha as opaque yields none. No scenario is asserted to reproduce the engine's exact material behavior. Original diagnostic findings prompted a geometric repair, not a native success claim.

## Dishwasher repair

After the existing pose/shear fit, multiply only group5 cube0's local Z thickness by 0.985, rounded to six decimals. The front face, origin, pivots, rotations, X/Y dimensions, UV coordinates and every other cube remain unchanged. Before posing, the exact pinned source shape is guarded. After posing, the helper rejects nonfinite/nonpositive thickness or a rounded result without a positive retreat.

Across all 82 poses, the thickness remains 0.906212–0.985175 model pixels. Door-back/basket-front coplanarity decreases 25→0; exhaustive affected-model checks find 200→175 raw pairs, with no new or enlarged overlap. The smaller door solid is contained inside the old solid. Side-face art coordinates stay unchanged, so physical side texel density changes by 1.5%; this small adaptation is explicit, not a source-exact thickness claim. The earlier basket-cap repair still applies.

See [independent door review](door-review/REVIEW.md), [all-state evidence](door-review/states.json), [guards](door-review/guard-probes.json), and [helper identities](door-review/door-helper-identities.json). That review was completed before the subsequent stain changes; its statement that the other 328 model files were unchanged applies to the door-only snapshot.

## Stain repair

39/40 staged food models have one upward-only stain quad at Y1.01563. Stage 36 (`9_4`) is stain-free; stage 0 is a different placed-food model. The repair keeps all original source PNGs and chooses each original opaque stain texel over the original opaque plate texel, then removes only the redundant stain quad and rebinds only the plate's top face.

All sampled source alpha is exactly 0 or 255, so no color blending or unknown alpha threshold is introduced. Four physical layouts need different mappings:

- Standard full orange stain, 27 stages.
- Half orange stain, four family 2 stages.
- Alternate stain, four family 8 stages, with the required vertical flip.
- Shifted stain, four family 10 stages, one pixel lower in the derived tile. Its geometric overhang has only transparent pixels. The separate food decal at Y1.0625 is retained, not moved or deleted.

The generated 16×64 sheet has four 12×12 tops, with two-pixel edge padding in each 16×16 cell. It is appended at x=202 in the dining atlas, retaining the original source regions/padding at x=2 and x=38 and the original 256×256 atlas dimensions. **5,616 physical-texel comparisons** match the original Java mapping in both the generated sheet and actual shipped atlas. Both generated geometry paths lose 39 competing quads; stage 0/36 and all other food geometry/UVs are preserved, apart from the previously documented stage 5/6 cap repair.

Inventory dirty-item stains, sink plates, and dishwasher plate stains are already baked into their textures. They do not get this quad-removal repair. Twenty-one related unchanged assets and all 1,148 dirty/clean plate bones across 82 dishwasher poses were checked. No runtime dining lifecycle, render controller, collision, account, world, or gameplay code changes.

See [integrated review](stain-review/INTEGRATION_REVIEW.md), [hash-bound result](stain-review/integrated-review.json), [source audit](stain-review/audit.json), and the repository's `tests/test_food_stain_bake.py`. The CPU preview in that review folder is clearly labeled as such and is **not** one of the editor screenshots below.

## New original Blockbench captures

Official Blockbench Desktop 5.2.2 on the managed cloud computer, in a separate empty window. The original unrelated work window and model tabs were preserved; no plugin or global setting was changed. These JPEGs are original, unretouched UI captures.

| Capture | Comparison |
|---|---|
| [Closed dishwasher](screenshots/door-closed-pair.jpg) | Closed idle, prior basket repair left / added door-back repair right |
| [Washing pose](screenshots/door-wash-pair.jpg) | Phase 3/frame 8, same pair |
| [Open completed pose](screenshots/door-open-pair.jpg) | Phase 5/frame 0, same pair; front/side appearance retained at selected view |
| [Full stain](screenshots/stain-stage4-top.jpg) | Main source left / baked-top stage4 right |
| [Half stain](screenshots/stain-stage8-top.jpg) | Stage8, retained half-stain position and leftover food |
| [Alternate stain](screenshots/stain-stage32-top.jpg) | Stage32, verified alternate orientation |
| [Shifted stain](screenshots/stain-stage40-top.jpg) | Stage40, retained shifted stain and other food geometry |

The door fixtures retain their preparation-time label “CANDIDATE not integrated”; their right-hand geometry was separately verified byte-identical to the later working output. Their left baseline is the first-pass snapshot (published as `48ef920`, identical tree to local `4cc310c`), which already includes the earlier basket-cap fix. The initial ten pictures are kept unchanged in the parent report. The final [identity manifest](final-identities.json) binds all new images/fixtures and current runtime files.

The paired editor views show retained art layout and no gross shape changes at these selected views. They do not establish temporal flicker removal, engine alpha threshold, minified/mipmap output, high-coordinate precision, lighting or continuous animation equivalence. The intended tiny stain height/parallax is removed. Customer animated seam candidates and the opposite-facing stage2 food-plane/material question remain open.

## Validation

[Recorded aggregate logs](validation/) include the executed suites, release policy, regeneration and final census summary. Paths in copied logs are normalized; values and outcomes are unchanged.

- `npm run verify:full`: 980/980 passed; types, resources and package build passed.
- Full Python suite with CI-pinned Mojang inputs: 89/89 passed, including 42 appliance/model, 5 stain bake, 4 dining and 10 motorcycle tests.
- `check_compliance.py` and `tests/check_release_policy.py`: passed. Existing advisory rights-scope clarification remains pending.
- A second full conversion left all 650 runtime files byte-identical.
- Final all-geometry census: 450 IDs/410 files, raw pairs 2977→2749. Stain near-coplanarity is tracked separately, not counted as an exact-plane removal.
- No native Minecraft/BDS/LIVE/user-PC test, release, install or merge was performed here.

Portable audit scripts accept explicit repository/output arguments. Door/stain delta scripts expect the compatible pre-follow-up snapshot named in their reports; the first-pass model and independent hashes distinguish it from main. Current regression tests and `build_stain_scenes.py` use the pinned source/main directly. Do not treat local package builds as released or installed artifacts.

## Reproducible baseline mapping

The pre-follow-up baseline is published as [`48ef920`](https://github.com/burnt-tea-dev/order-to-cook-unofficial/commit/48ef920779cd7d76244061bad9dd31ffc2f6b57a). It has the exact tree `e789e28e00751d54d17e94853efdef87500e511a` of the original local `4cc310c` snapshot. Historical logs and fixture labels keep the original local identifier. The stain delta script defaults to the published baseline and runs against the final checkout. The historical door review script requires its door-only snapshot and isolated candidate input; use the current appliance regression tests for the final integrated tree. See [mapping](baseline-mapping.json).
