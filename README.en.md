# Order To Cook — Unofficial Minecraft Bedrock Port (下單了)

[简体中文](README.zh-CN.md) · [繁體中文](README.md) · **English**

**Current development baseline: `0.1.2-alpha.3`. Restaurant management, delivery, kitchen appliances, personal progression and equipment HUDs exist. Limited client acceptance is recorded, but refrigerator geometry, hand-washing particles and greyed progression text have FAIL results. This is not full Java parity.** [Client evidence](docs/validation/0.1.2-alpha.3/client-20261101-linux-dot.md) · [Unreleased button-contrast correction](docs/validation/UNRELEASED-button-contrast.md)

Original by **breezeth**: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/order-to-cook) · [Java source](https://github.com/breezeth-CN/OrdertoCook). Maintained by `casama233` / `burnt-tea-dev`, retaining upstream GPLv3, author attribution and asset provenance. A request about supplementary asset scope has not received a response and is recorded as non-blocking; development continues, but actual licensing conflicts still require resolution.

## Download and installation

These changes **do not restore previously withdrawn packages, publish a formal Release, or misrepresent new source with an old version number as an accepted historical package**. See [historical artifacts](artifacts/README.md). Build current sources using the commands below; output goes to `dist/`. Future candidates must have their own version, commit, SHA-256 and documented test scope.

Use a disposable world for local testing; enable both behavior (BP) and resource (RP) packs. Declared minimum target: **Bedrock 1.21.100** with stable `@minecraft/server 2.0.0` and `@minecraft/server-ui 2.0.0`. **Beta APIs and Upcoming Creator Features are not required.** This does not claim validation on every version/device. The guide is supplied on first join and can also be crafted alongside basic equipment.

**Guidebook (unreleased source improvement):** Order To Cook retains its own `ordertocook:guide`. It is not a Cookery chapter and does not require Cookery. Following Cookery's three-level taxonomy, it contains **6 chapters, 13 topic groups and 26 tutorials**, with icons, previous/next page, index navigation and Traditional Chinese / Simplified Chinese / English. Existing item and crafting recipes remain unchanged. Bedrock uses native forms rather than a literal copy of Cookery's book UI. See the [independent guidebook structure](docs/GUIDEBOOK.md); hands-on client UI acceptance is pending.

Additional original-author confirmation is no longer a blanket release gate; attribution, GPL, corresponding source, source hashes and actual QA checks are still required. See the [asset register](docs/ASSET_LICENSE_REGISTER.md), [third-party notices](THIRD_PARTY_NOTICES.md) and [release compliance checks](docs/RELEASE_COMPLIANCE.md). Neither original authors nor Mojang/Microsoft endorse this project.

### Upgrading from alpha.2 / alpha.1

Back up the entire world first, import alpha.3, and confirm **both BP and RP use version 0.1.2**. Their UUIDs are preserved; do not enable old and new copies together. A real-world alpha.2 → alpha.3 upgrade requires dot's acceptance following the handoff instructions; historical test results cannot be reused.

Personal progression counts completed order settlements only after this feature started recording them. Old restaurant revenue has no per-delivering-player attribution and cannot be retroactively assigned to owners/employees. Existing levels, orders, inventory and revenue remain in the original save. Upgrading from alpha.1 also includes alpha.2's persistent dirty-dish behavior; old settled orders do not retroactively spawn dishes. Rollback requires the complete pre-upgrade backup.

## Survival restaurant walkthrough

1. **Set up a restaurant.** Craft/place an order printer, menu stand, preparation counter, packaging rack, plate rack, chairs and washing basin. Different restaurants' order printers must be more than **24 blocks apart**.
2. **Configure the menu.** Click the stand with food to register a dish without consuming it. Empty-hand/sneak-click to manage the menu. Each dish counts a single nutritional value regardless of stack size.
3. **Restock supplies.** Supply leather to the packaging rack and clean plates to the plate rack. Both racks must be within **5 blocks** of the counter; the counter, chairs and relevant freezers must be within **24 blocks** of the restaurant.
4. **Open and accept orders.** Click the printer to open, then choose a candidate order. Accepting one removes the other candidates in that batch; independent walk-in orders remain.
5. **Prepare finished foods.** Put already-cooked required foods in your inventory or an accessible nearby refrigerator, then click the counter to plate/pack them. **The counter does not craft whole dishes automatically**; it consumes finished food.
6. **Collect and deliver.** Keep the block above the counter clear. Completed plates/parcels appear on the counter; click to pick them up and use them on the corresponding customer. Delivery packages/tickets can show destination and direction.
7. **Receive payment, clear dishes and wash.** Successful orders award oTc coins and possibly tips. Dine-in customers eat in about **5 seconds**, leaving a dirty plate. Owners/employees click the plate or supporting table, put it into the basin, start with an empty hand and keep looking at the basin for **4 seconds**. Restock the clean plate rack. Old plates at the same table must be collected before the next delivery.
8. **Expand.** Spend coins on levels and equipment via the printer. A toolbox upgrades an empty two-block barrel into a refrigerator, an empty smoker into a three-slot stove, and an empty washing basin into a dishwasher.

Standard orders last **30 minutes**, rush orders **10 minutes**, measured from creation. The order printer refreshes every **10 minutes**. Maximum restaurant level is **8**. Deadlines use real time, so orders can expire while away from the world; appliances do not retroactively cook while their chunks are unloaded.

> The default stand lists four dishes. The 40 vanilla foods total **159**, supporting only Lv.3. Unreleased source adds 64 optional Senluo foods: the complete catalog totals **487**, supporting Lv.7 but still below Java's **600** for Lv.8. Excluding the expired-event wedding candy leaves 467; other acquisition limits are listed in the [food catalog](docs/FOOD-CATALOG.md). Upgrade thresholds are unchanged.

## Features implemented in this version

| System | Functionality |
| --- | --- |
| Orders | Standard, dine-in, delivery, rush, long-distance and walk-in orders; five quality levels, mutually exclusive candidates, timeout, cancellation, packaging, delivery and double-payment protection |
| Business | Lv.0–8, original upgrade costs and nutrition thresholds, nutrition/level reward multipliers, tips, coin denominations/change and restaurant ranking |
| Personal progression | 11 original definitions, 10 wired; first/rush/distant orders, 100/1000/10000 earned, equipment upgrades, eight-star and gold restaurants; cross-store persistence and reconciliation |
| Crosshair HUD | Racks, basins, dishwashers, freezer tiers and stove readings; 10-tick refresh with washing/delivery display and renewed permission checks |
| Menu | Up to 150 non-consuming templates; 40 vanilla foods, 64 optional Senluo foods, automatic provider declarations and existing admin overrides; presentation aliases count as one dish |
| Preparation counter | Consume from inventory and permitted refrigerators within 24 blocks; consumables from racks within 5 blocks; place and retrieve physical plates/bags |
| Plates | Ten staged dine-in meal animations, persistent dirty dishes, owner/employee collection, early pickup interruption, manual/automatic washing |
| Appliances | 27+54-slot refrigerator with separate upper/lower doors and 11 poses each; three-slot stove; dishwasher holding up to 16 plates with 66 poses; toolbox upgrades |
| Customers | Two original looks, four idle variants, seven arrival/collection/dining actions; standing if no chair for standard customers, chairs mandatory for walk-ins; original surprise rewards |
| Scooter | Original model, four dye colors, Bedrock riding, 54-slot insulated box, horn, emissive lights, remote control and retrieval |
| Multiplayer | Owners/employees, supply permission, rechecks after forms and save persistence across restarts |
| Resources | 12 blocks, 15 explicit custom items plus block items, 5 entities, 240 geometry and 38 animation definitions; 67 original PNG and 12 OGG retained |

**Asset presence is not proof of complete gameplay-driven animations.** See the [parity matrix](docs/PARITY.md), [visual provenance](docs/ASSET_PROVENANCE.md) and [runtime adaptations](docs/RUNTIME_ADAPTATIONS.md).

## Deliberate adaptations and open gaps

- Java container windows use Bedrock native forms, without identical drag/drop, Shift-click or shortcut layouts.
- The refrigerator keeps two compartments and slot counts, but uses Bedrock item stack limits; it lacks Java's 128 items per slot and internal food display. Doors are independent; animations are discretely sampled from source keyframes. Dishwasher body does not use the original non-uniform squash.
- Source review confirmed original customers spawn directly rather than navigating through a door. Standard dining prefers a chair within 24 blocks and stands within 5 if none exists; walk-ins require a chair. Easter-egg characters, downloaded skins and maid integration are unfinished.
- Ordinary seated customers have an original **10% surprise** chance and a `1–4 + restaurant level` bonus. This port pays when food is delivered, rather than after the animation, and early plate collection does not reclaim the award. Old plates must be cleared, whereas Java replaces/drops them.
- Washing requires clicking and sustained looking; `player.json` is not overridden, so the player-specific washing, clapping and scooter-riding poses are incomplete.
- The scooter uses Bedrock vehicle physics and a jump-key/control-panel horn. Light surfaces glow but do not cast dynamic world lighting.
- The stove has **9 explicit cooking mappings**; it does not read every other addon's recipes. A menu item is not necessarily stove-cookable.
- Jade equipment data is replaced by addon action-bar text, not Jade itself. SDM Currency, Touhou Little Maid, Aeronautics/Sable APIs are not directly ported; installed Bedrock currency items and special food registrations can be configured.
- Personal progression is an internal list and notifications, not official Xbox achievements or bonus currency. The original “eat expired delivery package” progression and local dishwasher preview-open when holding a dirty plate remain unported.
- Basic crafting and in-shop equipment acquisition are added so survival players can start. Shop prices are initial adaptation values.

## Menu and food variants (unreleased source fix)

Public foods exposing `nativeVariant` via `senluo.public.food.v1` use **item ID + variant** for menu entries and orders. Preparation only consumes matching variants and missing materials identify the variant. Heat, quality and seasoning do not become new dishes or reward multipliers. Legacy menus/orders without a published variant still match by item ID. A generic item and an explicit variant of the same ID cannot coexist on a menu; remove the generic dish before registering its variant.

Dish names and nutrition are frozen when registered. Updating virtual nutrition settings does not silently mutate existing menu entries or accepted orders; remove and re-register to apply changes. Selecting a dish from inventory also rechecks the original item on form submission to avoid registering an item that moved/changed while the form was open.

The fixed food catalog now includes 56 Grilling foods, four Tavern grapes and four World Liquor (世界名酒) snacks. Hold the actual food to register it without per-food admin commands. Seventy-four presentation/quality aliases count as their original dish and are saved into new orders; old menu/order matching is preserved. Other addons can announce through the [food provider interface](docs/FOOD-PROVIDERS.md). V1 itself supplies no nutrition: dynamic secret skewers, plates and 282 drinks without positive nutrition remain unsupported. See the [complete food catalog](docs/FOOD-CATALOG.md) and [verification record](docs/validation/UNRELEASED-food-catalog.md). Cooking processes and the Cookery guide are unchanged.

## Personal progression and equipment information

Use “Personal Progress” in the guide or its entry at a manageable printer. All 11 definitions can be inspected; details return to the list and closing exits to the world. Settlement amounts, including tips and surprise bonuses, accrue to the **actual delivery player** across restaurants, unaffected by spending/picking up coins.

Gold restaurant follows the original **per-dimension** criteria: one player owns at least **four still-placed restaurants in the same dimension**, and one ties or leads that dimension's revenue ranking. Idle/unloaded restaurants count; confirmed demolished ones do not. Zero-revenue ties count. A split of two restaurants in each of two dimensions is not four in one. See [PROGRESSION.md](docs/PROGRESSION.md).

Look at permitted appliances within **6 blocks** to see real plate counts, packing supplies, washing phase, freezer compartment occupied slots or stove progress. The freezer has **27 upper / 54 lower slots**. Looking alone neither creates inventory nor moves items. HUD line one prioritizes hand-washing; line two preserves navigation for a valid delivery ticket/package in the main hand. Washing requires both hands empty; hold the delivery item again to restore navigation.

## Validation completed and limitations

- Historical alpha.3 recorded **254 automated tests**; newer source checks depend on the CI of their specific commits.
- `npm run check` uses official stable 2.0.0 type checking plus JSON, geometry, animation, icon, recipe and custom component checks.
- `npm run build` produces BP, RP, combined pack and hashes. Ordinary validation does not publish packages; the separate candidate workflow verifies artifacts.
- The [limited 2026-11-01 alpha.3 client record](docs/validation/0.1.2-alpha.3/client-20261101-linux-dot.md) contains bounded passes and **three FAILs**; the full client matrix has not passed. New fixes need a new candidate retest.
- Historical alpha.2 native assertions (127/15/12) apply only to that runtime fingerprint. Keyboard/mouse, touch, controller, genuine multiplayer, RP visuals and forms cannot be certified by CI alone.

See [VALIDATION.md](docs/VALIDATION.md) for build fingerprints and evidence, [DOT_HANDOFF.md](docs/DOT_HANDOFF.md) for client handoff, and [remaining single-player cases](docs/validation/0.1.2-alpha.3/REMAINING-SINGLEPLAYER.md) for unverified coverage.

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
