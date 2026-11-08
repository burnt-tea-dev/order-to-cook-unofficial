# Changelog

## 0.1.45-alpha.1

- Restore the pinned Java renderer’s washing-table water quad in all 11 plate states, with original RGBA, two physical UV-correct faces and uniform world blend materials. Preserve the dry item through item_visual; body/plates and gameplay scripts stay unchanged.
- Preserve dine-in bagging guide text through real asset regeneration by synchronizing 12 editable language values, with fallback/repeated-generation/provenance regressions in both Python CI stages.
- Record 8 cloud Blockbench review scenes and 16 unmodified GUI screenshots. Keep the observed five-plate preview occlusion discrepancy and native sorting/backface/item-display gates explicit; no Minecraft, BDS, LIVE or full-parity acceptance is claimed.
- Integrate onto merged .44 with unchanged UUIDs/APIs and append-only paired .45 payload identity. See [source and limitations](docs/validation/UNRELEASED-washingtable-water.md).

## 0.1.44-alpha.1

- Add localized, customer-named five-minute, one-minute and expired notices for ordinary carried paper orders and dine-in/delivery bags. Keep severity-first selection, durable per-item flags and fresh flags on newly prepared bags; plates, dropped items and world containers are excluded.
- Preserve full native stacks and existing tick/legacy deadline semantics. Reject retained terminal/stale/proof-mismatched work; keep orphan paper silent and disclose that self-contained orphan bags cannot reconstruct pruned history. Mark-before-chat suppresses routine replay but does not guarantee atomic or exactly-once delivery.
- Reuse the existing 20-tick callback with at most 36P inventory reads. Build an ephemeral lookup once per referenced restaurant per pass; CPU/memory scale with its retained record count, without a persistent cache, arbitrary history cap or native performance claim.
- Integrate reviewed alert source onto merged .43 without changing rename logic/tests or prior visual evidence. Freeze paired .44 identity with unchanged UUIDs/APIs and append-only payload history. No client/LIVE/BDS probe, NPC/vehicle/artwork change or full Java-parity claim. [Contract, source checks and limitations](docs/validation/0.1.44-alpha.1/CARRIED_ORDER_ALERTS.md).

## 0.1.43-alpha.1

- Match current-name restaurant pricing: first/cleared naming is free; confirming a current custom name costs one physical currency unit, including same-name and empty submissions. Preserve cancel separately, custom currencies and denomination change.
- Restrict renaming to owners and the existing explicit Bedrock admin/Creative override. Revalidate canonical machine, range, ownership, name state and quoted currency after forms; rejected saves refund the exact touched native ItemStacks without resaving a detached record. Cross-layer native atomicity is not claimed.
- Preserve the optional default/custom marker through JSON and version-1 portable placement. Interpret missing legacy markers using the saved-owner generated name; document unavoidable ambiguity. Malformed explicit markers fail closed without deleting records. Correct obsolete settings help about portable level/statistics loss.
- Freeze paired 0.1.43 manifests with unchanged UUIDs/APIs and append-only payload history. Retain the separate visual-documentation evidence; no model, texture, animation, NPC, vehicle or deadline-alert changes. Source/adapter checks and independent review are not native/client acceptance. [Rename contract, validation and limitations](docs/validation/0.1.43-alpha.1/RESTAURANT_RENAME.md).

## 0.1.42-alpha.1

- Expose server-global `deliveryRate` through the existing Server/creative/`otc_admin` operator event. Accept only finite JSON probabilities in `0..1`, with default/reset `0.3` and no coercion; preserve malformed saved settings.
- Apply the current global value at every machine generation entry, with canonical identity validation, and initialize ordinary/portable machines with it. Reload, partial restaurant propagation and later restaurant rollback cannot restore an obsolete generation rate.
- Preserve existing order types, proof, deadlines and carriers; ordinary walk-ins remain dine-in. Keep .40 uncertain native-write boundaries and .41 count-only no-migration behavior; this is not an atomic multi-record configuration update.
- No other probability controls, assets, vehicle/NPC changes or native/client acceptance. [Source validation and operator-interface adaptation](docs/validation/0.1.42-alpha.1/DELIVERY_RATE.md).

## 0.1.41-alpha.1

- Honor administrator-global `maxOrderMachinesWithin24` using signed 32-bit integers and Java's effective minimum of one. Missing/invalid saved fields safely default to one; malformed settings remain preserved.
- Count registered, currently readable same-dimension machines in the existing inclusive [-24,+25] box until the threshold, with metadata-first filtering, self exclusion and current canonical membership. No sorting, world-cell scan, persistent cache or equipment-binding change.
- A limit of two allows first/second placement and cancels third without consuming the ordinary/portable item. Reset affects future attempts only; count-only commands never rewrite dense restaurant records. Retained removal journals still block their exact position.
- Extend setting readback, count-aware placement translations and the three guidebook languages. Preserve .40 leather behavior and its uncertain-native-write limitations.
- Source/adapter evidence only. Registered/unloaded discovery and actual multiplayer ordering remain limitations; no new client, LIVE, BDS, performance or full-parity claim. See [validation](docs/validation/0.1.41-alpha.1/MACHINE_COUNT.md).

## 0.1.40-alpha.1

- Honor Java's global `countertopConsumeLeather` through the existing server/creative/`otc_admin` configuration event. Strict booleans, default true for legacy/invalid saved field values, persistence and post-form revalidation keep it a world setting.
- Disabled leather skips all shelf discovery and transactions for delivery and explicit dine-in bags. Food, native full-ItemStack output, permissions, canonical order/proof/deadline checks and clean-plate requirements remain.
- Preserve shelf stock/records and malformed settings. Regressions exercise actual preparation commit failures with no supply object, safe retry, cancelled/stale forms and reset/reload. Existing restaurant-wide refresh/upgrade propagation is not made atomic by this patch.
- Retain .38 carrier and .39 placement behavior. No client, LIVE world or BDS acceptance, configurable machine count, delivery-rate setting or 100% parity claim. [Source validation](docs/validation/0.1.40-alpha.1/LEATHER_CONFIG.md).

## 0.1.39-alpha.1

- Match Java’s default machine-placement box: another registered, readable machine blocks placement when existing-minus-new offsets are in [-24, +25] on all axes, inclusive, excluding self. Filter current records before world reads and stop at the first live machine. Keep equipment’s 24-block spherical nearest lookup unchanged.
- Preserve portable-item cancellation/retry, removal journals and existing dense worlds. Do not add machine-count configuration, unloaded/unregistered discovery, reservations or post-placement destruction. Update the placement error and handbook in all three languages.
- Confirm ordinary +25/corner and portable-corner regressions fail before the fix and pass afterward; adapter coverage includes signed faces, negative coordinates, live-state changes, canonical rollback and existing-world retention. No client, LIVE world or BDS acceptance is claimed. [Source validation](docs/validation/0.1.39-alpha.1/MACHINE_PLACEMENT.md).

## 0.1.38-alpha.1

- Add an explicit sneak-click plate/bag choice for dine-in orders while retaining ordinary clicks and held-ticket defaults. Persist the independent carrier; only missing legacy fields on packed orders inherit the old type-based fulfillment default. Validate canonical carrier and proof at placement/handoff, retain full native ItemStacks, and reject delivery plates.
- Keep dine-in/walk-in rewards, tips, deadlines and statistics for bags. Use seated/standing take reactions without dining vacancy checks, plates, dirty dishes or boom bonuses. Reuse existing reaction cleanup.
- Add generated-order main/core/store/dining/entities regressions for both entries, cancellation, deferred revalidation, persistence, rollback and rejection. Pair BP/RP/modules/dependency at 0.1.38 with stable UUIDs and append-only payload history. No client/live-world testing is included in this source change.

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
