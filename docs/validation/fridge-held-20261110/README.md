# Compact refrigerator first-person item, 0.1.55-alpha.1 draft

## Result

The exact refrigerator item recovered read-only from the CARY 26.63 client's
cached OTC resource pack 0.1.54 has a **16-pixel-tall mesh**, not a 32-pixel
mesh. It is already uniformly reduced around the block center, with bounds
X/Z `[-4,4]`, Y `[4,20]`. Both first-person display scales are then doubled to
`[0.8,0.8,0.8]`, restoring a 12.8-pixel transformed height. The supplied client
picture shows the large right-hand fridge clipping below the viewport.

This candidate changes **only those two first-person scales to `[0.4,0.4,0.4]`**
relative to the cached item. The transformed height is 6.4 pixels. Geometry,
ten cubes, sixty face UVs, rotations, translations and all five other display
contexts remain structurally identical. This is an intentional smaller held
item, not a claim of exact Java first-person size.

The native Blockbench comparison visibly reproduces the large baseline and
shows the reduced candidate in the same preview. **Minecraft after-repair
acceptance is NOT RUN.** This branch is main plus a fridge-only repair; it is
not a verified upgrade superset of the unknown full 0.1.54 server payload or
PR #87. Do not install the whole package over that session as a drop-in upgrade.

## Two baselines, kept distinct

- Repository main: `a4176b193294d8f57234b3b316ad6b092acf5d5b`, version 0.1.52.
  It has no separate refrigerator item mesh or `minecraft:item_visual` binding.
  This PR adds both, with the source-derived generator, so rebuilding reproduces
  the reviewed item rather than reverting to the placed lower-half geometry.
- Observed client RP: version 0.1.54, stable UUID
  `b3d9a3bc-5e3d-42e9-8bb1-55f4b47ddeec`. The original cached
  [item JSON](cary-054-refrigerator-item.geo.json) is included unchanged with
  SHA-256 `1cea082601b71066ea07057ffcdf02c3f8c1aa1aa077151bc5fb7821526412e1`.
  [Identity record](cary-input-identity.json) includes the manifest/SOURCE hashes.
  The cache's SOURCE marker claims commit
  `0dc5c5ca7a842eb4942c3c3b26f423eccc5966b2`; both Git and the GitHub Contents
  API could not resolve it. This declaration is **not verified source
  correspondence**. Server BP was unavailable in the resource-only client
  cache, so its actual binding has not been independently established.
- Original supplied client picture: `12-fridge-held.png`, SHA-256
  `8310a1ff62b253151d6991f658462ee548741e5b8b2aea94d41545b1eca76cfb`.
  It is pre-fix observation, not evidence that the candidate has been loaded.

## Source and native format

Pinned upstream: [breezeth-CN/OrdertoCook at e59e3dbc](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642).
The [item model](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/assets/ordertocook/models/item/refrigerator.json)
inherits the [block model](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/assets/ordertocook/models/block/refrigerator.json):
ten axis-aligned elements spanning 16×32×16, FP rotations 107°/103°,
translations Y 1/1.25, and original scale 0.4 in each hand.

The generator uniformly halves geometry about `(0,8,0)` and compensates the
five non-first-person source scales by two, matching the cached item. The two
first-person scales intentionally do not receive that compensation. No source
PNG, UV rectangle, model element or world-placement geometry is edited.

Official references checked for this repair:

- [Item display transforms](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/itemdisplaytransforms?view=minecraft-bedrock-stable): geometry format ≥1.21.0, separate hand/GUI/ground/frame transforms. The geometry uses 1.21.0; transforms are within documented ranges.
- [Block item_visual](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_item_visual?view=minecraft-bedrock-stable): separate item geometry/materials, block format ≥1.21.60. This block already uses 1.26.60. Numeric AO=0 follows that format.
- [Block size limits](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblockoversized?view=minecraft-bedrock-stable): the 30-pixel geometry extent limit is checked separately from display scaling. Candidate raw extents are 8×16×8; shrinking display alone is not used to excuse an oversized raw mesh.

## Actual editor evidence

Official Blockbench Desktop 5.2.2, managed cloud computer, separate native
window. The tracked `.bbmodel` fixtures were opened through the native file
dialog. No plugin/settings changes or runtime export was used. These are
original, unretouched JPEG UI captures, not generated renders or game photos.

The existing repository codec helper converts the native mesh back to editor
coordinates, with the Java `(8,0,8)` origin, embedded unchanged 96×96 PNG, and
the actual display transforms. See [fixture builder](build_scenes.py) and
[content identities](editor-evidence.json). The source-only Java fixture is
provided for inspection but was not additionally photographed.

| Capture | Observation |
|---|---|
| [CARY .54 first-person right](screenshots/01-cary-054-firstperson-right.jpg) | Explicit 0.8 scale; large fridge covers much of the right preview |
| [Candidate first-person right](screenshots/02-candidate-firstperson-right.jpg) | Same orientation/position, 0.4 scale; visibly smaller |
| [Candidate first-person left](screenshots/03-candidate-firstperson-left.jpg) | Compact opposite hand, original 103°/Y1.25 pose |
| [Candidate GUI](screenshots/04-candidate-gui.jpg) | Original compensated 0.85 scale preserved |
| [Candidate third-person right](screenshots/05-candidate-thirdperson-right.jpg) | Original compensated 0.75 scale preserved |
| [Candidate ground](screenshots/06-candidate-ground.jpg) | Original compensated 0.5 scale preserved |
| [Candidate fixed](screenshots/07-candidate-fixed.jpg) | Original compensated 1.0 scale preserved |

These are selected Blockbench Display views. Bedrock FOV, UI scale, arm bob,
item use, control scheme, native offhand eligibility and different aspect ratios
are not emulated. The item still meets the bottom edge in the hand preview,
which is not a claim of zero clipping in every camera pose. Native acceptance
must check the user's real viewing setup, placement/pick/break behavior, reload,
and the actual integrated BP/RP pair without overwriting unrelated changes.

## Verification

- New exact-item/source/display tests: **5/5**. Includes whole-JSON equality
  against cached .54 after changing only the two scales.
- Targeted item/bounds/native-fridge/motion suite: **39/39** on final source.
- Complete Node suite: **985/985**, zero failures/skips.
- `npm run verify`: **328/328** core tests, TypeScript, resource links and paired
  build passed. 521 JSON, 451 geometry IDs, 46 animations, 578 permutations.
- Appliance Python suite: **34/34**; shared-root suite: **3/3**; CI-scope: **9/9**.
- Final full conversion: all **650 runtime files byte-identical** on rerun.
- Negative control restoring right-hand scale 0.8 is rejected by the new test.
- Independent read-only review reran the five tests and verified all **190**
  preserved-input hashes against actual main Git blobs. The lower block equals
  main after removing only `minecraft:item_visual`; all 176 placed fridge poses,
  scripts, upper block, storage/collision and original source assets are unchanged.
- Compliance/release-policy/diff checks passed. Existing rights-scope
  clarification remains advisory, not a new rights assertion.

See [test summary](verification.json) and `logs/`. CI for the published commit
must be checked separately; this document does not infer remote CI from local
tests. No BDS, candidate client load, LIVE update, merge, tag or Release.

## Integration and version ownership

Latest inspected main is .52; open #87 uses .53, and actual CARY uses .54.
This isolated candidate therefore uses **.55** with unchanged stable UUIDs and
new paired content fingerprints. Main release history is append-only; no .54
payload identity is invented from a resource-only cache. The .55 build is not
a promise that unknown .54 changes are preserved.

#81 owns fridge helper identity logic, which is untouched. #87 shares the
converter, workflow and version files but has different model hunks. An actual
integration must preserve both branches' changes and histories, recalculate
the combined pair, rerun the generator/checks, and then test the exact pair.
This PR stays Draft until that review/native acceptance is addressed.
