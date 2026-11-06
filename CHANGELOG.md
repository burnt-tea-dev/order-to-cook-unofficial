# Changelog

## 0.1.29-alpha.1

- Fix the shared initialization of nine particle emitters: default direct scalar spread variables instead of putting vector members on the left of `??`, which the client rejects. Pass the same three scalars from the real `MolangVariableMap` caller and update the native smoke fixture. Burst counts, spread values, velocity conversion, timing and artwork are unchanged.
- Pair BP/RP/modules/dependency at 0.1.29 with preserved UUIDs and append-only payload history. Actual generator-output and caller regressions cover the repaired contract; this source validation does not claim a fresh client ContentLog or FPS result. See [particle repair](docs/validation/0.1.29-alpha.1/PARTICLES.md).

## 0.1.28-alpha.1

- Deliver the canonical guide-icon and invisible dining-plate fixes under a fresh paired identity. A temporary installation already used RP 0.1.27 with a different geometry payload; 0.1.28 avoids reusing that UUID/version for different bytes. The 027 source history and all gameplay/resource content are preserved; only paired manifests advance.

## 0.1.23-alpha.1

- Declare `pbr` in the canonical RP manifest so a resource-pack stack requiring the optional Vibrant Visuals mode can admit it. Keep the existing 1.26.60 minimum, which exceeds the documented 1.21.120 requirement. No texture sets, material maps, global lighting overrides or artwork are added; missing texture sets use the selected mode's fallbacks. This is a compatibility declaration, not verified PBR artwork or client rendering.
- Advance the matching BP/RP/module/dependency identity to 0.1.23 and append payload history. Preserve all non-manifest runtime bytes, including the 0.1.22 first-person pose/request gate, gameplay quantities, APIs and UUIDs.

## 0.1.22-alpha.1

- Generate an independent first-person left-arm stroke from the original left upper/forearm data. Its camera basis mirrors the native empty right hand; Java ACTION calibration and actual client rendering remain unverified. Third-person poses and the existing first-person right-arm curves are unchanged.
- Write `variable.senluo_fp_left_arm_request` only within the finite first-person, non-VR/UI, empty-hand animation window, and return that same gate as the pose blend. Taking a map/item therefore releases this pose while the existing server cancellation catches up. The existing replacement-stop clip clears the request without reading an undefined flag.
- Use the optional public [Core player/controller contract](https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/7e8185177d7a8d58991bccd76d32bce2276e5f57/docs/PORT-ADAPTERS.md#shared-first-person-left-arm-request) for visibility; this pack does not replace a player or renderer. A standalone pack without that connection does not promise an empty-hand left arm. Same-frame transfer, pose and visible stopping remain unobserved.
- Pair BP/RP/modules/dependency at 0.1.22 with preserved UUIDs and append-only payload history. Server wash/session/storage behavior and APIs are unchanged; reuse the existing 0.1.20 API-acceptance evidence rather than repeating a headless test that cannot show the new arm. Current scope: [first-person arms](docs/PARITY.md#手洗第一人稱左臂).

## 0.1.21-alpha.1

- Count printer refresh progress only through active native block callbacks. Closed, unsimulated and offline machines cannot catch up wall time. Save a compact cumulative work count and commit each refresh origin with its new offers, retaining a due retry after a failed restaurant save.
- Keep the Java walk-in wait transient: pause with operation, reset on world load or an observed missing machine, and use the configured subsequent interval. Preserve the existing loaded-block scan instead of adding a global clock or polling loop. Very short unload/reload between scans remains unverified.
- Adopt remaining legacy refresh time once, retain metadata and remove obsolete runtime wall deadlines. Update the displayed interval and remaining time, preserve the pure-core timestamp contract, and clear only the deleted machine's own counter.
- Pair BP/RP/modules/dependency at 0.1.21 with preserved UUIDs and append-only runtime trees. Targeted persistence/clock regressions and same-world native seed4/restart7 (11 checks), including real region stop/resume, passed; both native runs stopped normally and the disposable world/engine were removed. See [machine timing](docs/validation/0.1.21-alpha.1/MACHINE_TIMING.md).

## 0.1.20-alpha.1

- Retarget the original washing body scale, torso lean, head and legs to the native hierarchy without letting the new torso parent rotate the head/arms twice. Include source forearm rotation/translation in a rigid-arm shoulder-to-hand endpoint fit; an actual elbow joint remains unavailable.
- Separate third-person body animation from a native first-person right-arm relative stroke. Start/stop both finite controllers through the existing wash session; either animation failure leaves plate delivery unchanged. Empty-hand left-arm visibility, Java ACTION dual-arm calibration and visible playback remain unverified or incomplete; VR retains the native pose.
- Preserve player definitions, equipment, stable API dependencies, UUIDs and persisted state. Pair the new BP/RP identity at 0.1.20 and append its payload history. Scope and original sources are in [player poses](docs/validation/0.1.20-alpha.1/PLAYER_POSES.md).

## 0.1.17-alpha.1

- Match Java early plate pickup: interrupt the first eating customer in the inflated block box, potentially at another table, and cancel only that customer’s pending bonus. Keep native query order and permit another pickup to restart action7.
- Separate the food’s start time from the customer reaction. A nearby interruption cannot restart another plate’s food stages; an already-collected plate’s still-eating customer also keeps its new reaction. Pickup feedback names the actual affected customer.
- Read the committed reaction rather than the same-tick stale visual property. Native volume extent6 reproduces the Java seven-unit box, including body intersection at its edge.
- BDS1.26.60.6 final refinement20 and same-world restart5 passed. Initial visual-state, QA configuration and query-edge failures are retained separately; exact scope is in [nearby pickup](docs/validation/0.1.17-alpha.1/NEARBY_PICKUP.md).

## 0.1.16-alpha.1

- Restore Java meal-bonus timing: pay the quote and tip at handoff, then the selected boom bonus at the end of the six-second reaction. Early pickup cancels it; later dirty-plate pickup and native block removal preserve it.
- Retain the unpaid bonus in the existing meal record through order-history trimming, plate claims and reload. Disconnected recipients receive no coins or personal earnings, while restaurant income still increases. Old already-paid meals have no pending marker and do not pay again.
- Native BDS1.26.60.6 passed 14 first-load and 5 same-world restart checks using actual inventories and simulated Players. Exact scope and remaining timing/atomicity limits: [meal bonus](docs/validation/0.1.16-alpha.1/MEAL_BONUS.md).

## 0.1.12-alpha.1

- Add native refrigerator compartment compaction through sneak-empty interaction. Merge only natively stackable item data, preserve first-seen order, and keep upper/lower cargo separate.
- Recheck access in the existing deferred interaction and restore complete touched-slot snapshots after a failed write. Ordinary use still opens the native container.
- Preserve Bedrock stack limits; food-only slots and Java 128-item stacks remain differences. No saved-state schema or pack UUID changes.
- Validation: 481 functional tests and repository verify passed; real BDS 1.26.60.6 compaction passed 7 initial and 4 same-world restart checks. Client input/rendering was not tested.

## 0.1.11-alpha.1

- Connect native Player handwashing arm-animation requests to the existing wash lifecycle, with the original two-second arm keys repeated twice in a bounded four-second clip. Use a dedicated controller and replacement stop; no player.json override or new global player loop.
- Stop the visual on completion and every existing cancellation/cleanup path. Animation API failures do not alter plate delivery. Match Java by excluding the addon’s chair and motorcycle while starting or continuing a wash.
- Preserve full-body, segmented forearm and first-person differences explicitly. Native QA SimulatedPlayer API acceptance and adapter-driven 80-tick/cancellation checks passed; client pose/stop appearance remains unverified.
- Pair BP/RP/modules/dependency at 0.1.11, preserve UUIDs and append the new runtime trees. No persistent state format changed.

## 0.1.10-alpha.1

- Fix the native BDS registration error introduced by 0.1.8: the shared use component attached `onConsume` to non-food items such as the guide and food plate. Register consumption on a separate bag-only component.
- A regression derives the registered callbacks from the actual startup adapter and checks their item definitions against the native food requirement. Ordinary use callbacks stay on the existing shared component.
- Pair BP/RP/modules/dependency at 0.1.10 with unchanged UUIDs and a new append-only payload identity. Native 1.26.60.6 rejected 0.1.8; 0.1.9 inherits the same error. Neither is suitable for game delivery. The same isolated world is retained for the corrected-source restart probe.

## 0.1.9-alpha.1

- Select the original seven named Easter egg customers at Java’s default 10% rate for machine and walk-in orders. Preserve their name, account, UUID and special flag in the order; actor retries do not reroll them.
- Generate ordinary names from the pinned original locale lists and use Java’s default 50% slim/wide split. Names are deduplicated by the existing asset converter.
- Wire the persisted identity into the existing actual-handoff special tips and 60% seated reaction; display the original special names in red. Remote player skins remain unported and use the bundled wide fallback.
- Advance paired BP/RP/modules/dependency identity to 0.1.9 and append its runtime trees. Source regressions cover profile boundaries, acceptance/packing/store reload and real handoff rewards. The isolated observer adds an original special-order identity check across the same-world restart.

## 0.1.8-alpha.1

- Complete the expired-takeout advancement from native consumption, with no nutrition or saturation gain. New parcels retain their deadline after order-history trimming.
- Carry complete menu snapshots and durable restaurant data in non-stackable board/machine items. Relocation keeps the original owner, staff, level, statistics; personal ledgers, live orders and customer/plate anchors stay in the world.
- Preserve stable pack UUIDs; pair BP/RP/modules/dependency versions at 0.1.8. Record source trees in baseline.json and append-only release-history.json.
- Source tests cover consumption, one drop per break, variant metadata, relocation, corrupted-item refusal and store reload. Native BDS/save rehearsal is coordinated separately; no client rendering or LIVE result is claimed.

## 0.1.2-alpha.3 — 2026-10-10

### Personal progression

- Adapt all eleven upstream advancement definitions into an in-pack progress
  list; wire ten conditions and label eating an expired delivery bag unimplemented.
- Attribute cumulative order settlements, including tips and boom bonuses, to
  the actual delivery player. Do not infer player income from alpha.2 history.
- Preserve progress across restaurants, restarts, removals and rebuilds using
  cumulative restaurant ledgers and chunked personal checkpoints.
- Persist placement, dishwasher conversion and Lv.8 upgrade events with their
  gameplay records; retry personal saves without repeating upgrades or payment.
- Match the source's four-owned-restaurants rule within one dimension, including
  ties and unloaded placed restaurants; filter known removed machine locations.
- Add guide and machine progress forms. These grant no money or Xbox achievements.

### Equipment HUD

- Show permission-checked, read-only supplies, plate counts, washer phases,
  fridge compartment occupancy and stove progress when looking at equipment.
- Combine handwashing feedback, equipment information and delivery navigation
  through one action-bar writer every ten ticks.
- Reject incorrectly linked, moved or unloaded storage helpers without creating
  replacement inventory. Keep the original empty-out client preview unimplemented.

### Verification and handoff

- Add regression coverage for real adapter flows, delayed operation saves,
  per-player failure isolation, malformed checkpoints, HUD merging and read-only
  equipment snapshots. Fix a missing placement method in the test double.
- Retain UUIDs and update both numeric pack versions to 0.1.2.
- Provide dot with a 29-case handoff and report template alongside the existing
  73-case client checklist; all client cases remain unexecuted.
- Build and verify through GitHub Actions while the local environment is offline.
  Native BDS checks were not rerun; alpha.2 evidence remains separately archived.

## 0.1.1-alpha.2 — 2026-10-09

### Dining and customers

- Drive the original ten meal variants through the 15/60/80/100-tick plate
  stages, keeping a cosmetic dirty plate until the owner or staff collects it.
- Persist meal identity and timing separately from trimmed order history;
  recover missing loaded visuals and remove duplicates without minting items.
- Support early pickup with the original half-second interruption action.
  Require clearing a previous plate before handing over a new meal at that spot.
- Add the original seated customer's 10% boom reaction and one-time bonus
  (1–4 plus restaurant level). The bonus is paid at handoff in this adaptation.
- Restore all four idle variants and seven customer actions. Ordinary dine-in
  customers may stand nearby without a chair; walk-ins still require a chair.
  The pinned Java source also spawns customers directly with zero movement.
- Preserve completion deadlines on reentry/reload and reject corrupt seat links
  without removing unrelated vehicles or their cargo.

### Appliances and assets

- Animate refrigerator compartments independently with eleven poses per door,
  multi-viewer tracking, and reversible one-second open/close motion.
- Sample 66 dishwasher poses from the original keyframes and resume animation
  from persisted processing state. Easing is linear; body squash is omitted.
- Add a dining entity atlas assembled from exact original pixels, retaining all
  original textures and sounds and reproducible asset provenance.

### Persistence and verification

- Harden physical parcel handoff, display placement, and dirty-plate claims
  against duplicate callbacks and known synchronous native-write failures.
- Block reopening a restaurant while removed-machine cleanup is waiting for
  unloaded meal anchors, preserving the existing data until cleanup completes.
- Keep pack UUIDs stable, increase numeric pack versions to 0.1.1, and migrate
  alpha.1 pending plates without inferring plates from already-paid history.
- Expand deterministic regression, source-pose and native server probes;
  preserve versioned evidence in `docs/validation/`. See `docs/VALIDATION.md`
  for exact results and `docs/PLAYTEST.md` for client work still outstanding.

## 0.1.0-alpha.1 — 2026-10-09

First unofficial Bedrock adaptation. Implements restaurant menus, orders,
packing/plating, persistent order proofs, dine-in and delivery submission,
coins and atomic change, levels, restaurant roles and leaderboards, reusable
plates, native cargo and refrigerator inventories, dishwashers, stoves and
rideable delivery motorcycles.

Preserves original textures/sounds and converts original furniture, vehicle and
customer models/animations. Adds survival bootstrap recipes, native forms and
admin food/currency configuration for the Bedrock environment.

Includes pinned original conversion inputs, GPL notices, deterministic build
tools, CI, unit/service regression tests and isolated native-server probes.

See `docs/PARITY.md` for the explicit remaining Java parity gaps and
`docs/PLAYTEST.md` for client work that is still unverified. This is an alpha,
not a claim that every original animation or interaction has been reproduced.
