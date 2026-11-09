# Remaining static assets and stove ignition comparison

Review inputs are pinned to OTC Java `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642` and Bedrock `.45` main `f8e0895f0703d786c6f282ad3001a9de2ada5460` (tree `cb40a256eb2ad65b26e107eb957d5546357f97ca`). This folder is a review artifact, not runtime content. No Java/Minecraft client or LIVE world is involved.

## Scope

The 21 static layouts compare 40 source/canonical states: chair, order board, countertop; all 11 paper-shelf counts; all 19 plate-shelf counts; all six stove texture selections; and the currently bound manual helmet's shell and visor. The independent decoders compare 375 source cubes and 2,248 present source faces against their canonical counterparts. Normalized positions and rotations agree; pixel UV values agree within `1e-5` for decimal representation only. There is no general geometry or UV tolerance used to excuse a known adaptation.

Each furniture/shelf scene checks the actual source NORTH blockstate binding, runtime geometry permutation, material texture alias, terrain atlas path, and identical source/runtime PNG bytes before constructing the pair. Other cardinal rotations, collision, count transitions and interaction are not exercised by opening these layouts. Stove texture selection is checked against all six declared material permutations; texture changes are not animated by these static scenes. These six neutral stove pairs compare the authored block/item JSON with the retained neutral mesh, not the registered animated renderer. The renderer’s distinct 17-face Geo model is used for the separate source-pose diagnostics below.

The helmet comparison includes both original material layers and both actually referenced attachable geometry files. The canonical head-space `+24Y` translation is removed from the preview only, to compare its local authored shape. This does not prove a worn helmet follows a player, head animation, armor-layer visibility, automatic riding helmets, or color variants. Source PNG dimensions and the canonical virtual UV dimensions are applied explicitly for each material; neither layer is stretched to the other's dimensions.

The two `baseline/stove.*.json` files preserve the exact .45 stove declaration and idle geometry so this before-fix evidence remains reproducible after a subsequent stove change. Their bytes match the pinned .45 commit. Other input paths are identified in the manifest.

## Preview conventions

Source-equivalent geometry is offset to negative X and canonical geometry to positive X. In **Top view the source is left and canonical right**. In the **North** camera used for the upright count sheets and stove close-ups, the **source is right and canonical left**. In the default isometric camera the **source is right/front and canonical left/back**. In a multi-count sheet, rows run from the lowest count at the bottom to highest at the top along Y. These artificial review offsets are not world placements. Read the scene name for the exact covered counts.

The free-format Blockbench scenes preserve original PNG bytes, per-face UVs, cube rotations and the decoded bone hierarchy. They do not emulate Java render types or Bedrock material instances, shader lighting, alpha sorting or controller logic. None of these Java elements uses `rescale`; the helper rejects that flag rather than ignoring it. A geometric match is not native material or gameplay acceptance.

## Stove source-pose diagnostic

Nine further scenes isolate the confirmed missing ignition pose: times `0`, `.05`, `.45`, `.75`, `.83`, `.875`, `.9375`, `.95` and `1` seconds. They use the registered original `geo/block/stove.geo.json`, with two bones and three cubes, versus the baseline .45 static Bedrock geometry. Both sides use the same selected texture to isolate geometry. That texture follows the original server phase intent, not proof of Java client packet behavior.

`build_stove_pose_scenes.py` expresses the original scale and rotation tracks independently, without importing the production converter. Source GeckoLib 4.8.3 uses a live degree-based sine before and after the first `.0833` rotation key, its own elastic formula, and a strict `fraction > .5` step threshold. At exactly `.9375` the larger pose is still held; `.95` is the halfway return. The child's rotation ends before ancestor nonuniform scaling begins, so these three cuboids introduce no shear. An independent direct forward evaluation of the original hierarchy matched all 17 source faces' corners and UVs at all nine times.

The idle canonical mesh has the same three cuboid corners and 17 matching source faces, plus one wholly hidden south face on the upper lip at `z=-5`, `y=12..16`, `x=-8..8`. Source-pose previews retain the original Geo mesh and omit this interior face. They do not fabricate an exterior idle mismatch.

Original Java starts from a received animation token rather than a shared server timestamp, and its loader also changes the client texture phase. A stopped bone can return over five ticks. These scenes do not exercise that packet/controller/reset behavior. A future finite geometry fix must retain the distinction between sampled source poses and native continuous animation parity.

## Stove GUI result

Official cloud Blockbench 5.2.2 opened all nine source/baseline scenes and all six source/candidate scenes, plus one identical-candidate control. The 19 original JPEG application captures show:

| Source time / candidate age | Baseline evidence | Restored candidate evidence | Observation |
| --- | --- | --- | --- |
| Neutral 0 | [Isometric](screenshots/stove-before-0-isometric.jpg) | Unchanged neutral mesh | Shared idle surfaces agree; the hidden internal-face difference is not visible here. |
| .05 / age 1 | [North](screenshots/stove-before-0p05-north.jpg), [isometric](screenshots/stove-before-0p05-isometric.jpg) | [North](screenshots/stove-after-age1-north.jpg) | Source door tilts while the baseline stays rigid; candidate matches the source tilt and scale. |
| .15 / age 3 | Not repeated | [North](screenshots/stove-after-age3-north.jpg) | Both show the stronger early tilt and contracted door. |
| .45 / age 9 | [North](screenshots/stove-before-0p45-north.jpg), [isometric](screenshots/stove-before-0p45-isometric.jpg) | [North](screenshots/stove-after-age9-north.jpg) | The opposite tilt and reduced dimensions agree after the fix. |
| .75 / age 15 | [North](screenshots/stove-before-0p75-north.jpg) | [North](screenshots/stove-after-age15-north.jpg) | Source minimum squash is absent before the fix and present in the candidate. |
| .83 | [North](screenshots/stove-before-0p83-north.jpg) | Not a runtime tick sample | The source elastic overshoot is visibly larger than the baseline. No claim that the discrete runtime reaches this exact sub-tick pose. |
| .85 / age 17 | Not repeated | [North](screenshots/stove-after-age17-north.jpg), [isometric](screenshots/stove-after-age17-isometric.jpg) | Candidate and source show matching expanded body and door, with intact top/side textures. |
| .875 and exactly .9375 | [Key](screenshots/stove-before-0p875-north.jpg), [step boundary](screenshots/stove-before-0p9375-north.jpg) | Not runtime tick samples | Both source views retain the expanded pose at the exact boundary. |
| .95 / age 19 | [North](screenshots/stove-before-0p95-north.jpg) | [North](screenshots/stove-after-age19-north.jpg) | Both candidate and source show the halfway return rather than a premature neutral pose. |
| Neutral 1 | [North](screenshots/stove-before-1-north.jpg) | Unchanged neutral mesh | Endpoints visually agree. This does not exercise Java STOP/reset interpolation. |
| Identical candidate age 17 | — | [North control](screenshots/stove-identical-age17-north.jpg) | Two copies agree, supporting interpretation of the paired preview. |

In every North pair above, **canonical/baseline is left and source is right**. Isometric pairs put source at the right/front. The identical control contains canonical on both sides. No missing texture, exterior face or shifted UV was seen in the six sampled restored poses. These are static pose inspections through the actual editor, not a native client or a running Java animation controller.

The separate source-only implementation report is [stove ignition](../../../stove-ignition/README.md). Its service tests, independent geometry formulas and GUI observations have different scopes; none replaces the others.

## Static GUI result

Eighteen of the 21 prepared static layouts were newly opened in official cloud Blockbench 5.2.2, producing 19 raw JPEG application captures. The other three neutral stove texture layouts were not redundantly opened: their base, burst and first cycle PNGs were already visible in the stove pose inspections above. All 21 prepared layouts still undergo the numerical and binding checks. This is not a claim of 21 new GUI sessions.

- Chair, order board and countertop: three isometric pairs show matching silhouettes, original textures and visible surfaces.
- Paper shelf: North sheets cover counts 0–2, 3–5, 6–8 and 9–10. All eleven stacks are visible, with no missing or shifted source texture observed.
- Plate shelf: isometric sheets cover counts 0–2 through 15–17, followed by a count-18 close-up. All nineteen stack counts are represented; visible plate faces and stand dimensions agree. The sheets use Y-separated review rows to avoid hiding one count behind another.
- Remaining stove cycle textures: `stove_fire_1`, `stove_fire_2` and `stove_fire_3` isometric pairs show the correct distinct fire patterns and intact surrounding surfaces. They supplement, rather than replay, the base/burst/first-cycle views above.
- Helmet: the [North capture](screenshots/helmet-shell-and-visor-north.jpg) agrees in local shell and visor shape and texel placement. The [isometric capture](screenshots/helmet-shell-and-visor-isometric.jpg) shows different background visibility through the visor between the two offsets. This is a recorded editor transparency discrepancy, **not** a passed transparency comparison or a confirmed native asset defect. No helmet-specific single-variable sorting control was run. The separate [washing pivot control](../washing-pivot-control/README.md) demonstrates that this editor can change transparent ordering after inactive-pivot changes, but cannot prove the cause for the helmet.

All screenshots are original application JPEG bytes, without cropping, retouching or rendering substitution. Each current review project was closed read-only after capture to limit accumulated editor tabs; other reviewers' projects were not saved or closed. The earlier shared editor had lost its 3D context even for previously working scenes. These captures use the recovered official executable in a separate profile, with no plugin, security-bypass flag or local service. A failed viewport is not an asset diagnosis.

## Reproduce and verify

Run `python docs/validation/visual-audio/blockbench-20261108/remaining-static/verify_scenes.py` from the repository. It checks recorded source/runtime inputs and evidence hashes, recreates all 37 layouts (21 static, nine source/baseline poses and seven source/candidate/control), and verifies deterministic output. It does not open Blockbench, replay the screenshots or test a game client. Input identities and screenshot-to-scene mappings are in [manifest.json](manifest.json).

This batch supplies 38 application captures: 19 stove pose captures and 19 static captures. The separate washing control supplies two more. Neither this count nor the 40 prepared static state pairs means all OTC models, camera angles, animation timing, native materials, player binding or gameplay have been accepted.

Scene packaging note: an input-discovery run initially executed builders in one Python process and advanced their shared deterministic UUID sequence. Each builder is now reproduced in its own process, as in ordinary preparation. An independent structural comparison found only consistent UUID renaming in the nine baseline and seven candidate/control projects, with geometry, UVs, texture bytes and hierarchy unchanged. The manifest records the reproducible standalone form, not an assertion that editor-internal object IDs appeared in the screenshots.

## Later helmet-only pivot diagnostic (2026-11-09)

The historical helmet result above remains unchanged. A subsequent [helmet A → B → A inactive-pivot control](../helmet-pivot-control/README.md) now records three original editor captures: changing only fifteen zero-rotation SOURCE shell origins changes the visor preview, and returning to the original restores the discrepancy. All geometry, UVs, PNGs, groups and RP content are unchanged. This supports pivot-dependent editor preview behavior, not a native transparency pass or runtime asset repair.
