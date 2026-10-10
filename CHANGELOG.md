# Changelog

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
