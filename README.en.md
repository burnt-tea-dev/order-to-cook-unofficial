# Order To Cook — Unofficial Minecraft Bedrock Port (下單了)

[简体中文](README.zh-CN.md) · [繁體中文](README.md) · **English**

Current source checks restaurant permission before claiming a station and uses the Java ±5-per-axis cube for both countertop supply shelves. Refrigerator queries keep their existing sphere. This stable API fix does not integrate POI or establish real-client acceptance. See [0.1.30 validation](docs/validation/0.1.30-alpha.1/STATION_BOUNDARIES.md).

**Current source version: [package.json](package.json) (unreleased). The refrigerator uses native upper 27-slot / lower 54-slot containers; stove and countertop controls take fewer steps, and dishwasher batch transfers have stronger recovery handling. Bedrock 26.60 and Upcoming Creator Features are required. Full Java parity and real-client acceptance remain incomplete.** [Container validation (0.1.5)](docs/validation/0.1.5-alpha.1/CONTAINER_GUI.md) · [Native container capabilities and limits](docs/NATIVE-CONTAINERS.md)

Historical `0.1.2-alpha.3` client evidence includes refrigerator geometry, hand-washing particles and greyed progression text FAILs; it does not certify this version: [historical client record](docs/validation/0.1.2-alpha.3/client-20261101-linux-dot.md) · [button-contrast correction](docs/validation/UNRELEASED-button-contrast.md).

**Current source visual/audio changes.** It fixes refrigerator interior UVs and door curves, dishwasher deformation and preview, the initial meal model, customer timing, printer/bag animations, and confirmed sound/particle differences. See [VISUAL_AUDIO_PARITY.md](docs/VISUAL_AUDIO_PARITY.md) for fixes and reproducible evidence. Interactive Blockbench inspection and Java/Bedrock client comparisons have **not been run for this candidate**; offline comparisons do not replace the historical client results or establish complete parity.


Original by **breezeth**: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/order-to-cook) · [Java source](https://github.com/breezeth-CN/OrdertoCook). Maintained by `casama233` / `burnt-tea-dev`, retaining upstream GPLv3, author attribution and asset provenance. A request about supplementary asset scope has not received a response and is recorded as non-blocking; development continues, but actual licensing conflicts still require resolution.

## Download and installation

These changes **do not restore previously withdrawn packages, publish a formal Release, or misrepresent new source with an old version number as an accepted historical package**. See [historical artifacts](artifacts/README.md). Build current sources using the commands below; output goes to `dist/`. Future candidates must have their own version, commit, SHA-256 and documented test scope.

Use a disposable world for local testing; enable both behavior (BP) and resource (RP) packs. Declared minimum target: **Bedrock 26.60 (manifest: 1.26.60)** with stable `@minecraft/server 2.11.0` and `@minecraft/server-ui 2.0.0`. **Enable Upcoming Creator Features** for the native refrigerator block containers. Beta APIs and POI experiments are not required. See the [version and capability audit](docs/NATIVE-CONTAINERS.md). This does not claim validation on every version/device. The guide is supplied on first join and can also be crafted alongside basic equipment.

**Guidebook:** Order To Cook retains its own `ordertocook:guide`. It is not a Cookery chapter and does not require Cookery. Following Cookery's three-level taxonomy, it contains **6 chapters, 13 topic groups and 26 tutorials**, with icons, previous/next page, index navigation and Traditional Chinese / Simplified Chinese / English. Existing item and crafting recipes remain unchanged. Bedrock uses native forms rather than a literal copy of Cookery's book UI. Icon sources and current client observations are documented in the [independent guidebook structure](docs/GUIDEBOOK.md).

Additional original-author confirmation is no longer a blanket release gate; attribution, GPL, corresponding source, source hashes and actual QA checks are still required. See the [asset register](docs/ASSET_LICENSE_REGISTER.md), [third-party notices](THIRD_PARTY_NOTICES.md) and [release compliance checks](docs/RELEASE_COMPLIANCE.md). Neither original authors nor Mojang/Microsoft endorse this project.

### Upgrading to 0.1.5-alpha.1 (unreleased source)

Back up the complete world, enable Upcoming Creator Features in a Bedrock 26.60 test copy, and confirm **both BP and RP use version 0.1.5**. Their existing UUIDs are preserved; do not enable old and new copies together. The equipment service moves each slot of the legacy 81-slot entity inventory into the two native compartments. Unloaded storage or a blocked migration waits; opening and countertop extraction stay unavailable while migration is pending. Do not manually delete the old storage entity. Rollback requires the complete pre-upgrade backup. See [migration and validation limits](docs/NATIVE-CONTAINERS.md).

### Historical: 0.1.2-alpha.2 / alpha.1 to alpha.3

This paragraph records the old upgrade only: back up the world, import alpha.3 and confirm BP/RP version 0.1.2 with unchanged UUIDs. That alpha.2 → alpha.3 upgrade requires dot's acceptance under its handoff instructions; results from other versions cannot be reused.

Personal progression counts completed order settlements only after this feature started recording them. Old restaurant revenue has no per-delivering-player attribution and cannot be retroactively assigned to owners/employees. Existing levels, orders, inventory and revenue remain in the original save. Upgrading from alpha.1 also includes alpha.2's persistent dirty-dish behavior; old settled orders do not retroactively spawn dishes. Rollback requires the complete pre-upgrade backup.

## Survival restaurant walkthrough

1. **Set up a restaurant.** Craft/place an order printer, menu stand, preparation counter, packaging rack, plate rack, chairs and washing basin. Different restaurants' order printers must be more than **24 blocks apart**.
2. **Configure the menu.** Click the stand with food to register a dish without consuming it. Empty-hand/sneak-click to manage the menu. Each dish counts a single nutritional value regardless of stack size.
3. **Restock supplies.** Supply leather to the packaging rack and clean plates to the plate rack. Both racks must be within **5 blocks** of the counter; the counter, chairs and relevant freezers must be within **24 blocks** of the restaurant.
4. **Open and accept orders.** Click the printer to open, then choose a candidate order. Accepting one removes the other candidates in that batch; independent walk-in orders remain.
5. **Prepare finished foods.** Put required foods in your inventory or an accessible nearby refrigerator. Use a valid order ticket on the countertop to plate/pack it directly; interact empty-handed to see dish names, quantities and missing supplies on one page. **The counter does not craft whole dishes automatically**; it consumes finished food.
6. **Collect and deliver.** Keep the block above the counter clear. Completed plates/parcels appear on the counter; click to pick them up and use them on the corresponding customer. Sneak-place and retrieve them while [preserving the complete carrier](docs/PARITY.md#未交付的展示餐點). Delivery packages/tickets can show destination and direction.
7. **Receive payment, clear dishes and wash.** Successful orders award oTc coins and possibly tips. Dine-in customers eat in about **5 seconds**, leaving a dirty plate. Owners/employees click the plate or supporting table, put it into the basin, start with an empty hand and keep looking at the basin for **4 seconds**. Restock the clean plate rack. Old plates at the same table must be collected before the next delivery.
8. **Expand.** Spend coins on levels and equipment via the printer. A toolbox upgrades an empty two-block barrel into a refrigerator, an empty smoker into a three-slot stove, and an empty washing basin into a dishwasher.

Standard orders last **30 minutes**, rush orders **10 minutes**, measured from creation. The printer refreshes after **10 minutes of active simulated operation** by default; closing, suspended simulation and shutdown preserve its remaining progress. Maximum restaurant level is **8**. Order deadlines use saved world ticks: shutdown pauses them, while leaving a region on a running server does not. Appliances do not retroactively cook while their chunks are unloaded.

> The default stand lists four dishes. The 40 vanilla foods total **159**, supporting only Lv.3. Unreleased source adds 67 positive-nutrition Senluo foods and 72 zero-nutrition drinks. The complete catalog totals **490**, supporting Lv.7 but still below Java's **600** for Lv.8. Excluding the expired-event wedding candy leaves 470; other acquisition limits are listed in the [food catalog](docs/FOOD-CATALOG.md). Drinks add no nutrition and upgrade thresholds are unchanged.

## Appliance controls (0.1.5-alpha.1)

| Equipment | Controls |
| --- | --- |
| Refrigerator | Interact with the upper or lower block to open its native 27-slot or 54-slot container. Use Bedrock's inventory controls; there is no paginated storage menu. |
| Stove | Use a supported ingredient/fuel stack on the stove to deposit it. Interact empty-handed for all seven slots on one page: select a slot to withdraw, collect all outputs, or refill from inventory. |
| Dishwasher | Retains its existing direct batch controls: hold a dirty plate and interact to load up to 16 from inventory. Once ready, empty both hands and interact to collect the whole batch. Insufficient inventory space leaves it inside. |
| Countertop | Use a valid ticket to process that order directly, or interact empty-handed to choose a ready order and inspect shortages on the same page. Pick up the finished plate/parcel before delivering it. |

Closing a stove or countertop form exits; reopening reads the latest state. Keyboard/mouse, touch and controller use the native container/form input paths; actual experience on all three still needs client acceptance.

## Features implemented in this version

| System | Functionality |
| --- | --- |
| Orders | Standard, dine-in, delivery, rush, long-distance and walk-in orders; five quality levels, mutually exclusive candidates, timeout, cancellation, packaging, delivery and double-payment protection |
| Business | Lv.0–8, original upgrade costs and nutrition thresholds, nutrition/level reward multipliers, tips, coin denominations/change and restaurant ranking |
| Personal progression | 11 original definitions, all wired; first/rush/distant orders, 100/1000/10000 earned, equipment upgrades, eight-star and gold restaurants; cross-store persistence and reconciliation |
| Crosshair HUD | Racks, basins, dishwashers, freezer tiers and stove readings; 10-tick refresh with washing/delivery display and renewed permission checks |
| Menu | Up to 150 non-consuming templates per board; 40 vanilla foods, 67 optional Senluo foods, 72 zero-nutrition drinks, automatic provider declarations and existing admin overrides; presentation/quality aliases count as one dish |
| Preparation counter | Consume from inventory and permitted refrigerators within 24 blocks, with supplies within 5 blocks; ticket shortcut and same-page readiness/shortages; physical plate/bag placement and pickup |
| Plates | Original placed meal and 0.5-second placement animation, ten staged meals, persistent dirty dishes, owner/employee collection, early pickup interruption, manual/automatic washing |
| Appliances | Native upper 27-slot / lower 54-slot refrigerator, 11 opening and 11 closing poses each; seven-slot stove controls on one page; up to 16 dishwasher plates and 82 poses, with batch-transfer rollback; toolbox upgrades |
| Printer and bag visuals | Complete original printer Geo, 16 printing poses and persistent waiting paper; original placed-bag material and 11-pose placement animation |
| Customers | Two original looks, four idle variants, seven arrival/collection/dining actions; standing if no chair for standard customers, chairs mandatory for walk-ins; original surprise rewards |
| Scooter | Original model, four dye colors, Bedrock riding, 54-slot insulated box, horn, emissive lights, remote control and retrieval |
| Multiplayer | Owners/employees, supply permissions, script-operation rechecks and persistence; an already-open native refrigerator cannot be forcibly closed immediately after revocation (see limits below) |
| Resources | Original textures/sounds and generated blocks, items, entities, models and animations; see the [source inventory](docs/ASSET_PROVENANCE.md). Pack validation reports the actual resource counts. |

**Asset presence is not proof of complete gameplay-driven animations.** See the [parity matrix](docs/PARITY.md), [visual provenance](docs/ASSET_PROVENANCE.md) and [runtime adaptations](docs/RUNTIME_ADAPTATIONS.md).

## Deliberate adaptations and open gaps

- Refrigerators use real native containers. Stove and countertop controls combine direct interaction with single-page forms; Java's specialized slot layouts and shortcuts are not identical.
- Sneak and interact empty-handed with either refrigerator half to merge matching item data and compact that compartment in first-seen order. Native Bedrock stack limits apply; food-only slots and 128-item stacks remain unsupported.
- Looking at an idle dishwasher while holding a dirty plate now triggers preview. Eligible players share its block pose; Java previews are per client. Bag placement pauses while unloaded, and the printer restores waiting paper after restart. Playback still needs client comparison.
- Menu stands and printers now carry menu and durable owner/level/statistics data in their drops. Bedrock records still use placement coordinates rather than Java's numeric machine ID. See the [native data evidence](docs/validation/0.1.10-alpha.1/PORTABLE_NATIVE.md).
- 26.60 provides no usable native-container force-close API, so revocation cannot immediately terminate an already-open refrigerator screen. Whether the before-event entry cancellation reliably prevents a native window still needs a real Player test. The refrigerator is not a validated private vault; see [permission boundaries](docs/NATIVE-CONTAINERS.md).
- Source review confirmed original customers spawn directly rather than navigating through a door. Standard dining prefers a chair within 24 blocks and stands within 5 if none exists; walk-ins require a chair. The seven original special names, persistent identities, tips and reactions are wired; downloaded player skins and maid integration remain unfinished.
- Ordinary seated customers have an original **10% surprise** chance and a `1–4 + restaurant level` bonus. The bonus pays after the six-second reaction; early pickup interrupts the first nearby eating customer in native query order and cancels that customer’s bonus, potentially at another table. Dirty-plate pickup after five seconds or block removal preserves the bonus. Disconnected recipients receive no personal coins or earnings; restaurant income still includes the bonus. Old plates must be cleared, whereas Java replaces/drops them.
- Handwashing FP now preserves arm length and the camera shoulder anchor. Seated idle/clap retain source body, forearm and foot endpoints; clap has separate TP/FP poses without changing held-item gameplay. Empty-hand left arms need the shared multi-request connection. Real elbows/knees, absolute Java ACTION calibration, slim/custom rigs, client playback and riding remain incomplete or unverified. See the [current player scope](docs/PARITY.md#玩家動作的來源與骨架).
- The scooter uses Bedrock vehicle physics and a jump-key/control-panel horn. Light surfaces glow but do not cast dynamic world lighting.
- The stove keeps **9 vanilla smoking recipes** and enables Grilling's roasted chicken wing and sweet potato when both real item IDs are installed. Other suppliers can publish explicit smoking recipes through the [recipe provider contract](docs/STOVE-RECIPES.md). The three lanes share a 200-tick batch and respect result counts and blocked outputs. Shakers, skewer grills and woks keep their own processes; menu catalogs never imply stove recipes.
- Jade equipment data is replaced by addon action-bar text, not Jade itself. SDM Currency, Touhou Little Maid, Aeronautics/Sable APIs are not directly ported; installed Bedrock currency items and special food registrations can be configured.
- Personal progression is an internal list and notifications, not official Xbox achievements or bonus currency. Eating an expired delivery package unlocks the final progression through native consumption, without nutrition or saturation gain.
- Basic crafting and in-shop equipment acquisition are added so survival players can start. Shop prices are initial adaptation values.

## Menu and food variants (unreleased source fix)

Public foods exposing `nativeVariant` via `senluo.public.food.v1` use **item ID + variant** for menu entries and orders. Preparation only consumes matching variants and missing materials identify the variant. Heat, quality and seasoning do not become new dishes or reward multipliers. Legacy menus/orders without a published variant still match by item ID. A generic item and an explicit variant of the same ID cannot coexist on a menu; remove the generic dish before registering its variant.

Dish names and nutrition are frozen when registered. Updating virtual nutrition settings does not silently mutate existing menu entries or accepted orders; remove and re-register to apply changes. Selecting a dish from inventory also rechecks the original item on form submission to avoid registering an item that moved/changed while the form was open.

The catalog includes 59 Grilling foods, four Tavern grapes and four World Liquor (世界名酒) snacks; secret skewers, skewer plates and Sichuan pepper use Java's base nutrition of 1 each. Another 45 Tavern and 27 World Liquor drinks cover 282 actual item IDs. Zero-nutrition drink menus and orders are an explicit Bedrock extension using the existing base service rewards. Senluo supplies 139 distinct menu entries across 425 physical IDs: hold an actual item to register it, with presentation/quality aliases saved into orders and old menu/order matching preserved. Other addons can announce through the [food provider interface](docs/FOOD-PROVIDERS.md); V1 itself supplies no nutrition. See the [complete catalog](docs/FOOD-CATALOG.md) for every ID, pepper's handheld-eating gap and acquisition limits, and the [verification record](docs/validation/UNRELEASED-food-catalog.md) for executed checks.

## Personal progression and equipment information

Use “Personal Progress” in the guide or its entry at a manageable printer. All 11 definitions can be inspected; details return to the list and closing exits to the world. Settlement amounts, including tips and surprise bonuses, accrue to the **actual delivery player** across restaurants, unaffected by spending/picking up coins.

Gold restaurant follows the original **per-dimension** criteria: one player owns at least **four still-placed restaurants in the same dimension**, and one ties or leads that dimension's revenue ranking. Idle/unloaded restaurants count; confirmed demolished ones do not. Zero-revenue ties count. A split of two restaurants in each of two dimensions is not four in one. See [PROGRESSION.md](docs/PROGRESSION.md).

Look at permitted appliances within **6 blocks** to see real plate counts, packing supplies, washing phase, freezer compartment occupied slots or stove progress. The freezer has **27 upper / 54 lower slots**. Looking alone neither creates inventory nor moves items. HUD line one prioritizes hand-washing; line two preserves navigation for a valid delivery ticket/package in the main hand. Washing requires both hands empty; hold the delivery item again to restore navigation.

## Validation completed and limitations

- The `0.1.6-alpha.1` visual/audio candidate [retest report](docs/validation/0.1.6-alpha.1/VISUAL_RETEST.md) records 354 Node tests, 16 Python tests, and BDS 1.26.60.6 initial 138/138 and restart 15/15, with zero content errors in both runs. Offline images and native server checks do not certify client rendering or audio.
- Historical alpha.3 recorded **254 automated tests**; newer source checks depend on the CI of their specific commits.
- `npm run check` uses official stable `@minecraft/server 2.11.0` / `@minecraft/server-ui 2.0.0` type checking plus JSON, geometry, animation, icon, recipe and custom component checks.
- `npm run build` produces BP, RP, combined pack and hashes. Ordinary validation does not publish packages; the separate candidate workflow verifies artifacts.
- The [limited 2026-11-01 alpha.3 client record](docs/validation/0.1.2-alpha.3/client-20261101-linux-dot.md) contains bounded passes and **three FAILs**; the full client matrix has not passed. New fixes need a new candidate retest.
- Historical alpha.2 native assertions (127/15/12) apply only to that runtime fingerprint. Keyboard/mouse, touch, controller, genuine multiplayer, RP visuals and forms cannot be certified by CI alone.

See the [0.1.5-alpha.1 report](docs/validation/0.1.5-alpha.1/CONTAINER_GUI.md) for this change's executed checks, fingerprint and outstanding cases. [VALIDATION.md](docs/VALIDATION.md) retains historical evidence; the old [DOT_HANDOFF.md](docs/DOT_HANDOFF.md) and [remaining single-player cases](docs/validation/0.1.2-alpha.3/REMAINING-SINGLEPLAYER.md) do not certify this version.

Personal ledgers can catch up after temporary profile-write failure; upgrades retry the accounting without charging or upgrading again. Reconcile the personal ledger before deleting a restaurant; pending equipment actions are saved before normal demolition.

**World save and native inventory are not one atomic transaction.** Plate collection writes a claimed marker first to prevent duplicate claims after retries/restarts. A forced process termination precisely between marker write and inventory write can lose one plate. Known synchronization-write errors have recovery handling, but arbitrary crash moments cannot be guaranteed lossless.

## Administrator configuration and compatibility

Only creative-mode players, players with the `otc_admin` tag or server commands can change global settings. A headless server console cannot issue a personal kit when there is no player.

```mcfunction
/tag @s add otc_admin
/scriptevent ordertocook:kit
/scriptevent ordertocook:refresh
```

`kit` is a test kit; `refresh` tests the printer within 24 blocks. **Neither is needed for normal survival play.**

Catalog/provider foods are recognized automatically. Administrators can still explicitly override other installed foods using the existing command:

```mcfunction
/scriptevent ordertocook:food {"typeId":"example:your_dish","nutrition":12,"label":"你的料理"}
/scriptevent ordertocook:config {"currencyItem":"minecraft:emerald"}
/scriptevent ordertocook:config {"currencyItem":""}
```

`example:your_dish` is a placeholder and must be replaced by an installed item ID. Empty currency ID restores oTc coins. Each configured currency item counts as one unit; switching affects future payments but does not convert existing coins.

You may temporarily override refresh intervals and nutrition thresholds:

```mcfunction
/scriptevent ordertocook:config {"refreshSeconds":30,"upgradeNutrition":[0,25,40,60,80,100,120,140,159]}
```

**This example changes original game balance.** Original thresholds: `[0,40,80,120,160,200,300,400,600]`, default refresh **600 seconds**. Cooking extension hooks: `SMOKING_RECIPES`, `FUEL_TICKS`, [RUNTIME_ADAPTATIONS.md](docs/RUNTIME_ADAPTATIONS.md).

## Development and reproduction

Requires Node.js 22+ and Python 3.12+. Generated assets are checked in; ordinary builds do not require re-downloading the original mod or installing art tools.

```sh
npm ci
npm run verify
python tools/check_compliance.py
```

`dist/` contains `.mcaddon`, standalone `.mcpack`, `SHA256SUMS.txt` and runtime fingerprint. If changing source models or conversion tools:

```sh
python -m pip install Pillow==12.3.0
python tools/convert_assets.py
npm run verify
```

The converter defaults to pinned assets in `upstream/reference/`; `--source /path/to/full/OrdertoCook` can select a full upstream checkout. See [upstream/source.lock.json](upstream/source.lock.json).

For native BDS tests, obtain Linux BDS from the [official Minecraft site](https://www.minecraft.net/en-us/download/server/bedrock) and unpack it into a **separate disposable test directory without other worlds**:

```sh
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode initial
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode reload
```

The probe is never enabled in production installers and is only injected by the test tool into disposable copies.

## Original versions and license

The pinned comparison references CurseForge public **1.3.6** and selected GitHub commit `e59e3db` with Forge version **1.3.7a**. They are distinct versions; see [UPSTREAM_RULES.md](docs/UPSTREAM_RULES.md) for provenance and line numbers.

The port declares **GPL-3.0-only**; see [LICENSE](LICENSE). Original attribution, modification notices and asset scope are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). **Original Java JARs are not redistributed.**
