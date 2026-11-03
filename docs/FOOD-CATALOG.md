# 食品／飲品目錄、營養依據與供應限制

盤點日期：2026-11-03。此表記錄 OTC 可選食品供應的固定目錄與來源；**目錄有定義不等於世界已安裝該 Addon，也不等於已完成料理取得的實機驗收**。玩家實際持有符合條件的食品或飲品，才透過現有菜單操作登記。OTC 不替玩家生成食品，也不要求把煙火、酒館、世界名酒或整套森羅家族全部安裝。

目前森羅目錄支援 **67 種正營養食品／331 點營養**，以及 **72 種零營養飲品**。同菜別名歸一後，共 **139 種食品／飲品、425 個實際物品 ID**；品質和進食時間代理不重複計為新菜。

| 供應範圍 | 正營養食品 | 零營養飲品 | 實際食品 ID | 實際飲品 ID | 營養總和 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 煙火 Grilling | 59 | 0 | 135 | 0 | 303 |
| 酒館 Tavern | 4 | 45 | 4 | 165 | 8 |
| 世界名酒 World Liquor | 4 | 27 | 4 | 117 | 20 |
| 森羅合計 | 67 | 72 | 143 | 282 | 331 |

正營養食品包含 **76 個別名 ID**，飲品包含 **210 個別名 ID**。連同既有 40 種原版食品／159 點，已知目錄共 **179 種菜品／490 點營養**；每塊菜單立牌仍最多 **150 種**，不會因目錄擴充而提高容量。490 是完整已知正營養集合的加總，含已結束活動的喜糖和仍有取得限制的食材，**不能宣稱全新生存世界已能自然取得 490 點**。零營養飲品可接單服務，但不增加營養總和。

## 1. 數值和來源怎樣判定

OTC 對正營養菜品沿用 Java **Item 基礎食品屬性**的 `nutrition`，即基礎飢餓回復值。它不是飽和度，不是效果持續時間，也不是售價；有動態內容的食品也不直接改採該份物品的食用回復演算法。固定食品的進食時間代理和品質代理，只對應原有食品身份，不增加菜種或累加同一道料理的營養。

**零營養飲品服務是明示的 Bedrock 菜單擴充，不是 Java OTC 的預設行為。**Java `MenuFoodCompatApi` 預設只允許正營養食品；本移植以 `servingKind: "drink"` 明確宣告已核對的可飲用物品，讓它們沿用既有菜單、訂單、備料和交付流程，營養保持 0。它們不產生營養報酬加成，只沿用既有基本服務報酬及原有結算規則。品質、熱度、調味、酒精和狀態效果都不產生新的營養或報酬倍率；未宣告的零營養使用觸發工具不會因此自動變成飲品。

本次盤點使用以下來源快照；這些 commit 與官方發布物是核對依據，不是要求玩家遵守的跨模組版本鎖。

| 來源 | 核對版本 | 用途 |
| --- | --- | --- |
| [OTC Java 1.3.7a](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642) | `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642` | Forge `MenuFoodCompatApi` 基礎營養、菜單按 Item ID 去重、訂單報酬 |
| [煙火 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af) | `7ba0c6ac0461f56d4de4d4aafd15baaddedc05af` | 物品定義、取得流程、品質與進食時間代理 |
| [煙火 Java 1.1.1](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c) | `9a1acdab27698457bec16c9362678e574895a28c` | NeoForge 1.21.1 `ModItems`、食物營養與原作配方 |
| [酒館 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/tree/5b209aa9b365735bcbfcb42eea232fb90bf71c10) | `5b209aa9b365735bcbfcb42eea232fb90bf71c10` | 全部 255 個物品定義、葡萄種植與飲品流程 |
| [酒館 Java 原作](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/tree/c4ec1880bd44cf3139d3ba744ab30bb379cf1416) | `c4ec1880bd44cf3139d3ba744ab30bb379cf1416` | `ModFoods`、`ModItems`、飲品／玻璃杯物品類別 |
| [世界名酒 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/tree/3424205a3c4a68b93316d15516594a2f3fb1c14d) | `3424205a3c4a68b93316d15516594a2f3fb1c14d` | 全部 159 個物品定義、冰櫃與合成配方 |
| [世界名酒 Java 1.1.12](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-world-liquor/files/9217896) | CurseForge 檔案 `9217896`；SHA-256 `d963089ad0a7f99a8950171d76913cfeea99a0126ee12b16c72c3162f8545da3` | 官方發布物中的 `ModFoods`、`init/kaleidoscope_twilight/KTItems` 與後備食品註冊條件 |

**已獨立核實 Java 營養：**煙火下列 59 種食品，包括秘製串、烤串盤和花椒的 Item 基礎營養各 1；酒館四種葡萄均使用 Java `ModFoods.GRAPE` 的營養 2，與 Bedrock 的食物元件一致。酒館現有 NeoForge `data/upstream/javap/init.ModFoods.txt` 也記錄 2，並非只依賴另一載入器的推測。

**世界名酒四種甜點的 Java 後備食品值也已核實：**官方 Java 1.1.12 的 `ModFoods` 為四項分別建立營養 5、飽和度係數 0.4 的食品屬性，`init/kaleidoscope_twilight/KTItems` 把它們交給 `CompatFoodItem`。主類別只在未載入 `kaleidoscope_twilight` 時註冊這組後備物品；Bedrock 供應包將它們置於 `kaleidoscope_world_liquor` 命名空間，現行 food 元件也各為 5。因此本目錄保留各 5，並更正上一版「未獨立核實 Java 數值」的缺口。

獨立的 [Twilight Java 1.2.0](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-twilight/files/9028413) 對同名甜點有另一組數值（喜多夾心脆 6、涼山田筒 5、妙脆角 4、波奇布丁 8），它不是世界名酒的上述後備物品，不能把這組值套到本供應包。兩者的載入條件和物品來源必須分開核對；本次沒有修改供應包的食用數值。

兩個官方 Java 發布物的版本、雜湊、條件載入與食品類別核對，詳見[飲品供應與世界名酒食品來源核對](validation/UNRELEASED-drinks-source-audit.md)。原始 JAR 和完整反編譯內容沒有納入倉庫或套件。

數值來源：[煙火 Java ModItems](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java)、[酒館 Java ModFoods](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/blob/c4ec1880bd44cf3139d3ba744ab30bb379cf1416/src/main/java/com/github/ysbbbbbb/kaleidoscopetavern/init/ModFoods.java)、[酒館 Java ModItems](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/blob/c4ec1880bd44cf3139d3ba744ab30bb379cf1416/src/main/java/com/github/ysbbbbbb/kaleidoscopetavern/init/ModItems.java)、[世界名酒來源轉換器](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/tools/_build_port_source.py)。

## 2. 完整新增食品清單

下表列的是 canonical 食品 ID；每列的「物品」連結是當前 Bedrock 供應定義。煙火各表另連結 Java 營養與取得程式／配方。原料串與烤熟串在原作中是不同的可食用物品，保留其不同身份；負面效果不會自動取消原作食品資格。

### 2.1 煙火：烤串成品

由既有烤架將對應的 `raw_*` 食材串烤製成 `grilled_*` 成品。取得與燒烤仍由煙火負責，本次 OTC 修改沒有改動烤架製程。

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 烤牛肉串<br>`kaleidoscope_grilling:grilled_beef_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_beef_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_beef_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L435)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤饅頭片串<br>`kaleidoscope_grilling:grilled_bun_slice_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_bun_slice_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_bun_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L472)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤豬兒蟲串<br>`kaleidoscope_grilling:grilled_caterpillar_skewer` | 12 | 烤架烤製 `kaleidoscope_grilling:raw_caterpillar_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_caterpillar_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L465)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤雞皮串<br>`kaleidoscope_grilling:grilled_chicken_skin_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_chicken_skin_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_chicken_skin_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L443)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤末影珍珠串<br>`kaleidoscope_grilling:grilled_ender_pearl_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_ender_pearl_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_ender_pearl_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L473)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤魚串<br>`kaleidoscope_grilling:grilled_fish_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_fish_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_fish_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L457)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤煎蛋串<br>`kaleidoscope_grilling:grilled_fried_egg_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_fried_egg_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_fried_egg_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L483)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤麵筋串<br>`kaleidoscope_grilling:grilled_gluten_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_gluten_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_gluten_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L484)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 黃金烤串<br>`kaleidoscope_grilling:grilled_golden_skewer` | 12 | 烤架烤製 `kaleidoscope_grilling:raw_golden_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_golden_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L396)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤羊肉串<br>`kaleidoscope_grilling:grilled_lamb_skewer` | 8 | 烤架烤製 `kaleidoscope_grilling:raw_lamb_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_lamb_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L366)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤骨肉相連串<br>`kaleidoscope_grilling:grilled_meat_and_bone_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_meat_and_bone_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_meat_and_bone_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L482)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤丸子串<br>`kaleidoscope_grilling:grilled_meatball_skewer` | 12 | 烤架烤製 `kaleidoscope_grilling:raw_meatball_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_meatball_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L475)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤中翅串<br>`kaleidoscope_grilling:grilled_mid_wing_skewer` | 7 | 烤架烤製 `kaleidoscope_grilling:raw_mid_wing_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_mid_wing_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L449)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤蘑菇串<br>`kaleidoscope_grilling:grilled_mushroom_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_mushroom_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_mushroom_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L466)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤五花肉串<br>`kaleidoscope_grilling:grilled_pork_belly_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_pork_belly_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_pork_belly_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L442)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤馬鈴薯片串<br>`kaleidoscope_grilling:grilled_potato_slice_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_potato_slice_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_potato_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L464)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤黏液串<br>`kaleidoscope_grilling:grilled_slime_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_slime_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_slime_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L481)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤魷魚鬚串<br>`kaleidoscope_grilling:grilled_squid_tentacle_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_squid_tentacle_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_squid_tentacle_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L450)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤苕皮串<br>`kaleidoscope_grilling:grilled_sweet_potato_sheet_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_sweet_potato_sheet_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/grilled_sweet_potato_sheet_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L458)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |

### 2.2 煙火：可食用的原料串及特殊串

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 黑暗燒烤<br>`kaleidoscope_grilling:dark_grilling` | 1 | 烤架失敗產物，原作本來可食用；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/dark_grilling.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L144)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 迷之烤串<br>`kaleidoscope_grilling:mysterious_skewer` | 2 | 烤架失敗產物，原作本來可食用；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/mysterious_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L129)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| “普通”烤串<br>`kaleidoscope_grilling:ordinary_skewer` | 5 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/ordinary_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L407)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生牛肉串<br>`kaleidoscope_grilling:raw_beef_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_beef_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L491)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生饅頭片串<br>`kaleidoscope_grilling:raw_bun_slice_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_bun_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L501)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生豬兒蟲串<br>`kaleidoscope_grilling:raw_caterpillar_skewer` | 6 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_caterpillar_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L499)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生雞皮串<br>`kaleidoscope_grilling:raw_chicken_skin_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_chicken_skin_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L493)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生末影珍珠串<br>`kaleidoscope_grilling:raw_ender_pearl_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_ender_pearl_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L502)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生魚串<br>`kaleidoscope_grilling:raw_fish_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_fish_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L496)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生煎蛋串<br>`kaleidoscope_grilling:raw_fried_egg_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_fried_egg_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L511)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生麵筋串<br>`kaleidoscope_grilling:raw_gluten_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_gluten_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L512)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生黃金烤串<br>`kaleidoscope_grilling:raw_golden_skewer` | 6 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_golden_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L381)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生羊肉串<br>`kaleidoscope_grilling:raw_lamb_skewer` | 4 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_lamb_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L351)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生骨肉相連串<br>`kaleidoscope_grilling:raw_meat_and_bone_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_meat_and_bone_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L510)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生丸子串<br>`kaleidoscope_grilling:raw_meatball_skewer` | 4 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_meatball_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L508)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生中翅串<br>`kaleidoscope_grilling:raw_mid_wing_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_mid_wing_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L494)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生蘑菇串<br>`kaleidoscope_grilling:raw_mushroom_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_mushroom_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L500)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生五花肉串<br>`kaleidoscope_grilling:raw_pork_belly_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_pork_belly_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L492)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生馬鈴薯片串<br>`kaleidoscope_grilling:raw_potato_slice_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_potato_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L498)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生黏液串<br>`kaleidoscope_grilling:raw_slime_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_slime_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L509)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生魷魚鬚串<br>`kaleidoscope_grilling:raw_squid_tentacle_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_squid_tentacle_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L495)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |
| 生苕皮串<br>`kaleidoscope_grilling:raw_sweet_potato_sheet_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/raw_sweet_potato_sheet_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L497)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/data/java/recipes.json) |

### 2.3 煙火：料理、作物、食材與活動食品

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 紅燒雞翅<br>`kaleidoscope_grilling:braised_chicken_wings` | 10 | Cookery 炒鍋／彈性炒鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/braised_chicken_wings.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L305)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_pot/braised_chicken_wings.json) |
| 雞翅<br>`kaleidoscope_grilling:chicken_wing` | 2 | 使用廚刀取得雞掉落食材；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/chicken_wing.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L97)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/world/chicken_acquisition_core.js) |
| 涼拌折耳根<br>`kaleidoscope_grilling:cold_houttuynia` | 6 | 3 份折耳根＋2 單位高品質辣椒油，工作台潛行使用；折耳根初始取得有限制；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/cold_houttuynia.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L248)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/food/cold_houttuynia_core.js) |
| 青椒炒魷魚鬚<br>`kaleidoscope_grilling:green_pepper_squid_tentacles` | 8 | Cookery 炒鍋／彈性炒鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/green_pepper_squid_tentacles.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L303)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_pot/green_pepper_squid_tentacles.json) |
| 折耳根<br>`kaleidoscope_grilling:houttuynia` | 2 | 作物收穫；初始種子／自然取得尚待供應模組驗證；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/houttuynia.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L109)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/world/houttuynia_crop_runtime.js) |
| 折耳根炒肉<br>`kaleidoscope_grilling:houttuynia_stir_fried_pork` | 9 | Cookery 炒鍋／彈性炒鍋配方；折耳根初始取得有限制；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/houttuynia_stir_fried_pork.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L301)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_pot/houttuynia_stir_fried_pork.json) |
| 花椒蜂蜜<br>`kaleidoscope_grilling:pepper_honey` | 4 | 原作無序合成配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/pepper_honey.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L274)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/pepper_honey.json) |
| 馬鈴薯燉牛肉（煙火版）<br>`kaleidoscope_grilling:potato_beef_stew` | 12 | Cookery 湯鍋／彈性湯鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/potato_beef_stew.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L307)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_stockpot/potato_beef_stew.json) |
| 紅苕稀飯<br>`kaleidoscope_grilling:red_sweet_potato_porridge` | 14 | Cookery 湯鍋／彈性湯鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/red_sweet_potato_porridge.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L309)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_stockpot/red_sweet_potato_porridge.json) |
| 烤雞翅<br>`kaleidoscope_grilling:roasted_chicken_wing` | 5 | 熔爐、煙燻爐或營火烹調；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/roasted_chicken_wing.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L236)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/roasted_chicken_wing.json) |
| 烤番薯<br>`kaleidoscope_grilling:roasted_sweet_potato` | 6 | 熔爐、煙燻爐或營火烹調；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/roasted_sweet_potato.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L220)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/roasted_sweet_potato.json) |
| 酸辣粉<br>`kaleidoscope_grilling:sour_spicy_noodles` | 10 | Cookery 湯鍋／彈性湯鍋配方；另需酒館醋；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/sour_spicy_noodles.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L419)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_stockpot/sour_spicy_noodles.json) |
| 糖拌番茄<br>`kaleidoscope_grilling:sugared_tomato` | 6 | 原作無序合成配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/sugared_tomato.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L262)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/sugared_tomato.json) |
| 番薯<br>`kaleidoscope_grilling:sweet_potato` | 3 | 作物收穫；初始種子／自然取得尚待供應模組驗證；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/sweet_potato.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L208)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/world/sweet_potato_crop_core.js) |
| 喜糖<br>`kaleidoscope_grilling:wedding_candy` | 20 | 2026-09-01 至 09-12 活動；現已結束，只保留已有庫存；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/wedding_candy.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L288)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/food/wedding_candy_core.js) |

### 2.4 酒館：四種葡萄（Java 與 Bedrock 均為 2）

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 金葡萄<br>`kaleidoscope_tavern:gold_grape` | 2 | 在地獄石／岩漿塊底材上的棚架種植；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/gold_grape.json) |
| 葡萄<br>`kaleidoscope_tavern:grape` | 2 | 在一般適用土壤上的棚架種植成熟葡萄；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/grape.json) |
| 青提<br>`kaleidoscope_tavern:green_grape` | 2 | 成熟葡萄收穫時有 30% 機會額外產出；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/green_grape.json) |
| 冰葡萄<br>`kaleidoscope_tavern:ice_grape` | 2 | 在適用冰／雪底材上的棚架種植；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/ice_grape.json) |

取得來源：[酒館 cultivation 規則](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/core/cultivation.js)。上述四種葡萄沒有新增品質或熱度營養倍率。

### 2.5 世界名酒：四種甜點（Java 後備食品與 Bedrock 均為 5）

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 喜多夾心脆<br>`kaleidoscope_world_liquor:kita_stuffed_crisp` | 5 | 冰櫃：甜漿果汁＋雪球，1200 ticks；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/kita_stuffed_crisp.json) |
| 涼山田筒<br>`kaleidoscope_world_liquor:liangshan_ice_cone` | 5 | 冰櫃：牛奶＋藍色染料，1200 ticks；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/liangshan_ice_cone.json) |
| 妙脆角<br>`kaleidoscope_world_liquor:magic_crispy_corner` | 5 | 工作台：8 個金粒包圍 1 塊曲奇；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/magic_crispy_corner.json) |
| 波奇布丁<br>`kaleidoscope_world_liquor:pochi_pudding` | 5 | 冰櫃：葡萄汁＋黏液球，1200 ticks；用碗取出；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/pochi_pudding.json) |

取得來源：[世界名酒現行冰櫃配方](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/scripts/freezer-recipes.js)、[妙脆角合成](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/recipes/magic_crispy_corner.json)。這些食品的狀態效果不計作額外營養。世界名酒本身既有的酒館相依仍由該供應模組管理，OTC 不擴張成整套家族相依。

### 2.6 本次補齊：秘製串、串盤與花椒

| 食品／完整 ID | OTC 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 秘製烤串<br>`kaleidoscope_grilling:secret_skewer` | 1 | 穿入三份原料而未匹配固定配方時產生；`_native_plain`、`_java_three_alt` 是同菜的進食時間代理。[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/secret_skewer.json)／[出料判定](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/skewer/skewering_core.js) |
| 烤串盤<br>`kaleidoscope_grilling:skewer_plate` | 1 | 把已有烤串放入盤中；生存模式打破裝有串的盤子會取得保留內容的串盤物品。[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/skewer_plate.json)／[裝盤與掉落](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/plate/plate_recipe_runtime.js) |
| 花椒<br>`kaleidoscope_grilling:sichuan_pepper` | 1 | 空手採收結果的花椒葉，每次 1–2 顆；打破結果葉也有花椒產出。菜單與備料已支援，獨立手持食用缺口見第 4 節。[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/sichuan_pepper.json)／[採收](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/world/pepper_tree_runtime.js)／[數量](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/scripts/world/pepper_tree_core.js) |

三項營養均來自 [Grilling Java `ModItems`](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java) 明確註冊的 `FoodProperties.Builder().nutrition(1)`。秘製串與串盤的實際食用回復依內容變動，但 [OTC Java `MenuFoodCompatApi.resolve`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/MenuFoodCompatApi.java) 使用無參數的 `stack.getItem().getFoodProperties()`；[訂單營養報酬](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderGenerator.java) 同樣經由這個解析器。因此 OTC 採基礎 1，無須讀取供應模組的私有配方記錄，也不把一盤的多串營養相加。

## 3. 取得限制與 Lv.8

| 範圍 | 食品／飲品身份數 | 營養總和 | 可作出的結論 |
| --- | ---: | ---: | --- |
| 原有原版表 | 40 | 159 | 原本的固定目錄基線 |
| 新增煙火食品 | 59 | 303 | 含喜糖，以及有取得前置／缺口的食品 |
| 新增酒館葡萄 | 4 | 8 | 不包括酒的品質等級 |
| 新增世界名酒甜點 | 4 | 20 | Java 後備食品與現行 Bedrock 食品元件均為每項 5 |
| 新增零營養飲品 | 72 | 0 | 可服務；不提高營養或營養報酬 |
| 全部已知目錄 | 179 | 490 | 其中 107 種是正營養食品；比 Lv.8 的 600 少 110 |
| 排除已結束活動的喜糖 | 178 | 470 | 其中 106 種是正營養食品；比 600 少 130，其他取得限制仍須另計 |

需要保留的取得限制：

- **喜糖 `wedding_candy`：**供應模組活動窗口是 Asia/Shanghai 的 2026-09-01 至 2026-09-12。11 月的新世界不能靠該活動自然新增喜糖；舊世界已持有的喜糖仍是有效食品，不刪除其菜單或庫存。
- **折耳根 `houttuynia`：**種植／收穫已有程式，但煙火自己的 PARITY 仍把要塞等自然初始取得列作未完成。這也影響涼拌折耳根、折耳根炒肉，以及用到折耳根／碎折耳根的黏液串、苕皮串等料理。不能把已有種子可收成寫成新世界一定能取得種子。
- **番薯 `sweet_potato`：**已有作物收穫流程，初始種子／世界取得仍需要供應模組實機核對；其派生料理相應受限。
- **酸辣粉 `sour_spicy_noodles`：**原作及現有供應配方要求酒館醋。沒有酒館時，這不是一項 Grilling 單獨可生產的料理。實際既有成品仍可被識別。
- **Cookery 食材和設備：**部分穿串、炒鍋與湯鍋配方使用 Cookery 食材或設備。OTC 只接受供應者既有成品，不建立替代製程，不以指令補材料，亦不要求與該食品無關的其他 Addon。

490 和 470 都只是已識別食品集合的總和，並未證明全新生存世界能完成全部生產鏈。單塊菜單最多 150 種，不能同時放入全部 179 種菜品；全部 107 種正營養食品仍少於容量上限，因此加入零營養飲品本身不會填補營養缺口。這次擴充改善 159 點的原有上限，但**尚未解決自然達到 Lv.8 的內容缺口**。後續應接入真正可取得、營養有依據的其他料理；Java 的 600 門檻、報酬公式及品質規則不會為了湊數而降低或放大。

## 4. 菜品身份、供應差距與非食品

**更正上一版排除判斷：**曾因秘製串和串盤的食用營養動態變化，把 Java 的基礎 1 視為不能採用的佔位值；這沒有對齊 OTC 的無參數 Item 查詢。兩者現已按 Java OTC 基礎規則支援。Java 的 [菜單記錄](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/BoardBlockEntity.java) 按 Item ID 去重；不同秘製配方、盤內原料或食用動作不會被臆造為額外菜種或營養。

**花椒的菜單／備料支援與供應包手持食用分開處理：**花椒已有真實可取得 ID，Java 基礎營養為 1，OTC 現在可登記並備料交付。Grilling Bedrock 的 `sichuan_pepper.json` 仍缺少獨立食物／使用元件，其食用資料表也沒有花椒條目；既有原料效果分支不等於獨立手持食用支援。本次沒有修改該供應模組功能，這項差距仍需由供應包補齊。

以下項目不屬於食品，**不是未完成支援的菜品**：

| 完整 ID | 分類與依據 |
| --- | --- |
| `kaleidoscope_grilling:sweet_potato_powder` | 揉粉製程原料。Java 以未設定 `.food(...)` 的 `Item.Properties` 建立；Bedrock 的 0 營養元件只觸發揉粉，完成後轉成生苕皮，不代表可供餐廳食用。 |
| `kaleidoscope_grilling:skewer_recipe_book` | 烤串食譜工具。Java 同樣沒有食品屬性；使用事件或動畫不給予菜品資格。 |

煙火食品另有 **64 個進食時間代理 ID** 和 **12 個料理品質代理 ID**，合計 76 個食品別名。目錄把它們接回對應的食品身份，因此不會把同一道紅燒雞翅的多個品質或進食時間版本當作多道獨立增長營養的菜。備料預檢與失敗回退沿用原生堆疊複本，保留供應模組的原料、串盤內容等資料。成功備料後取消訂單，仍按原有規則不退還已消耗食品；短期堆疊複本不會成為訂單的持久化食品庫存。

森羅 V1 是公開的狀態讀取格式。其 `quality`、`hotUntil` 和 `seasoning` 本身不提供食品營養，也不等於新增一道菜的資格；已公開的 `nativeVariant` 仍由現有快照規則核對。本次不解析供應模組的私有內容來造新變體。已存在的菜單、訂單或存檔不會因目錄更新被批次清除或重算；舊營養快照仍保留。

## 5. 已支援的零營養飲品：完整 ID 清單

以下 **282 個飲品 ID 已納入目錄**：酒館 165、世界名酒 117，歸一為 **72 種飲品**（酒館 45、世界名酒 27）。它們均核對過供應包的物品定義與實際飲用完成流程，以 `nutrition: 0, servingKind: "drink"` 支援菜單、訂單生成、備料、交付、取消與存檔快照。實作清單見 [`senluo_drink_catalog.js`](../runtime/BP/scripts/senluo_drink_catalog.js)。

| 供應模組 | 飲品分類 | 歸一後飲品數 | 實際 ID 數 |
| --- | --- | ---: | ---: |
| 酒館 | 24 種品質酒、12 種固定雞尾酒、特調／神秘雞尾酒 2 種、6 種可飲果汁桶、西瓜汁 1 種 | 45 | 165 |
| 世界名酒 | 18 種品質瓶裝飲品、7 種雞尾酒、可樂與湯力水 | 27 | 117 |
| 合計 | 42 個品質家族各 6 個 ID，加 30 個單項 ID | 72 | 282 |

每個品質家族使用真實存在的 `_q1` 作 canonical ID，`_q2` 至 `_q6` 是同菜別名；共 210 個品質別名，不是額外菜種。六種果汁桶本身有飲用完成、解除中毒與歸還桶的既有流程，因此可當飲品供應；空桶、搖酒器及操作代理不在目錄內。這項零營養服務擴充不虛構營養 1，也不把品質或狀態效果轉成營養／報酬倍率。

酒館原作的普通酒瓶和調酒物品由非 food 的 `Item.Properties` 建立，飲用效果不等於 Java `FoodProperties`。世界名酒 Java 1.1.12 的可樂／湯力水則有包含 `alwaysEdible()` 和狀態效果的食品屬性，但沒有設定 `nutrition`，基礎值為 0；Bedrock 版本由自訂完成流程消耗飲品並返還玻璃瓶，沒有原生 food 元件。兩種實作都不提供正的基礎營養；具體食品註冊及完成流程見[來源核對第 2 節](validation/UNRELEASED-drinks-source-audit.md#2-282-個-id-的可飲用性與基礎營養)。

酒瓶的 `_q1` 至 `_q6` 是 Bedrock 的品質編碼，對應一個 Java 物品的 BrewLevel。招牌／神秘調酒按既有 Item 身份服務；原有顏色、效果和材料由酒館自己的動態資料保存，目前沒有核實為可直接給 OTC 使用的公開 V1 配方身份。本次不把私有顏色或效果資料當成不同菜種，也不讀取它們來造營養。備料預檢及失敗回退使用原生堆疊，訂單只保存既有供應要求與報酬快照。

<details>
<summary>酒館：已支援的 165 個完整飲品 ID（45 種飲品）</summary>

```text
kaleidoscope_tavern:allium_garden
kaleidoscope_tavern:bloody_mary
kaleidoscope_tavern:brandy_q1
kaleidoscope_tavern:brandy_q2
kaleidoscope_tavern:brandy_q3
kaleidoscope_tavern:brandy_q4
kaleidoscope_tavern:brandy_q5
kaleidoscope_tavern:brandy_q6
kaleidoscope_tavern:brass_heart
kaleidoscope_tavern:carignan_q1
kaleidoscope_tavern:carignan_q2
kaleidoscope_tavern:carignan_q3
kaleidoscope_tavern:carignan_q4
kaleidoscope_tavern:carignan_q5
kaleidoscope_tavern:carignan_q6
kaleidoscope_tavern:champagne_q1
kaleidoscope_tavern:champagne_q2
kaleidoscope_tavern:champagne_q3
kaleidoscope_tavern:champagne_q4
kaleidoscope_tavern:champagne_q5
kaleidoscope_tavern:champagne_q6
kaleidoscope_tavern:depth_charge
kaleidoscope_tavern:emerald
kaleidoscope_tavern:glow_berries_bucket
kaleidoscope_tavern:glowflower_brew_q1
kaleidoscope_tavern:glowflower_brew_q2
kaleidoscope_tavern:glowflower_brew_q3
kaleidoscope_tavern:glowflower_brew_q4
kaleidoscope_tavern:glowflower_brew_q5
kaleidoscope_tavern:glowflower_brew_q6
kaleidoscope_tavern:godfather
kaleidoscope_tavern:gold_grape_bucket
kaleidoscope_tavern:grape_bucket
kaleidoscope_tavern:grasshopper
kaleidoscope_tavern:green_grape_bucket
kaleidoscope_tavern:honey_wine_q1
kaleidoscope_tavern:honey_wine_q2
kaleidoscope_tavern:honey_wine_q3
kaleidoscope_tavern:honey_wine_q4
kaleidoscope_tavern:honey_wine_q5
kaleidoscope_tavern:honey_wine_q6
kaleidoscope_tavern:ice_grape_bucket
kaleidoscope_tavern:ice_wine_q1
kaleidoscope_tavern:ice_wine_q2
kaleidoscope_tavern:ice_wine_q3
kaleidoscope_tavern:ice_wine_q4
kaleidoscope_tavern:ice_wine_q5
kaleidoscope_tavern:ice_wine_q6
kaleidoscope_tavern:luminous_bride_q1
kaleidoscope_tavern:luminous_bride_q2
kaleidoscope_tavern:luminous_bride_q3
kaleidoscope_tavern:luminous_bride_q4
kaleidoscope_tavern:luminous_bride_q5
kaleidoscope_tavern:luminous_bride_q6
kaleidoscope_tavern:madame_shexiang_q1
kaleidoscope_tavern:madame_shexiang_q2
kaleidoscope_tavern:madame_shexiang_q3
kaleidoscope_tavern:madame_shexiang_q4
kaleidoscope_tavern:madame_shexiang_q5
kaleidoscope_tavern:madame_shexiang_q6
kaleidoscope_tavern:miners_star_q1
kaleidoscope_tavern:miners_star_q2
kaleidoscope_tavern:miners_star_q3
kaleidoscope_tavern:miners_star_q4
kaleidoscope_tavern:miners_star_q5
kaleidoscope_tavern:miners_star_q6
kaleidoscope_tavern:mojito
kaleidoscope_tavern:mother_snow_q1
kaleidoscope_tavern:mother_snow_q2
kaleidoscope_tavern:mother_snow_q3
kaleidoscope_tavern:mother_snow_q4
kaleidoscope_tavern:mother_snow_q5
kaleidoscope_tavern:mother_snow_q6
kaleidoscope_tavern:mystery_cocktail
kaleidoscope_tavern:nether_special
kaleidoscope_tavern:plum_wine_q1
kaleidoscope_tavern:plum_wine_q2
kaleidoscope_tavern:plum_wine_q3
kaleidoscope_tavern:plum_wine_q4
kaleidoscope_tavern:plum_wine_q5
kaleidoscope_tavern:plum_wine_q6
kaleidoscope_tavern:polaris_sweet_white_q1
kaleidoscope_tavern:polaris_sweet_white_q2
kaleidoscope_tavern:polaris_sweet_white_q3
kaleidoscope_tavern:polaris_sweet_white_q4
kaleidoscope_tavern:polaris_sweet_white_q5
kaleidoscope_tavern:polaris_sweet_white_q6
kaleidoscope_tavern:red_queen_q1
kaleidoscope_tavern:red_queen_q2
kaleidoscope_tavern:red_queen_q3
kaleidoscope_tavern:red_queen_q4
kaleidoscope_tavern:red_queen_q5
kaleidoscope_tavern:red_queen_q6
kaleidoscope_tavern:riesling_dry_white_q1
kaleidoscope_tavern:riesling_dry_white_q2
kaleidoscope_tavern:riesling_dry_white_q3
kaleidoscope_tavern:riesling_dry_white_q4
kaleidoscope_tavern:riesling_dry_white_q5
kaleidoscope_tavern:riesling_dry_white_q6
kaleidoscope_tavern:rum_q1
kaleidoscope_tavern:rum_q2
kaleidoscope_tavern:rum_q3
kaleidoscope_tavern:rum_q4
kaleidoscope_tavern:rum_q5
kaleidoscope_tavern:rum_q6
kaleidoscope_tavern:sakura_wine_q1
kaleidoscope_tavern:sakura_wine_q2
kaleidoscope_tavern:sakura_wine_q3
kaleidoscope_tavern:sakura_wine_q4
kaleidoscope_tavern:sakura_wine_q5
kaleidoscope_tavern:sakura_wine_q6
kaleidoscope_tavern:sauvignon_blanc_dry_white_q1
kaleidoscope_tavern:sauvignon_blanc_dry_white_q2
kaleidoscope_tavern:sauvignon_blanc_dry_white_q3
kaleidoscope_tavern:sauvignon_blanc_dry_white_q4
kaleidoscope_tavern:sauvignon_blanc_dry_white_q5
kaleidoscope_tavern:sauvignon_blanc_dry_white_q6
kaleidoscope_tavern:screwdriver
kaleidoscope_tavern:sculk_special
kaleidoscope_tavern:sherry_q1
kaleidoscope_tavern:sherry_q2
kaleidoscope_tavern:sherry_q3
kaleidoscope_tavern:sherry_q4
kaleidoscope_tavern:sherry_q5
kaleidoscope_tavern:sherry_q6
kaleidoscope_tavern:signature_cocktail
kaleidoscope_tavern:sunset_glow_q1
kaleidoscope_tavern:sunset_glow_q2
kaleidoscope_tavern:sunset_glow_q3
kaleidoscope_tavern:sunset_glow_q4
kaleidoscope_tavern:sunset_glow_q5
kaleidoscope_tavern:sunset_glow_q6
kaleidoscope_tavern:sweet_berries_bucket
kaleidoscope_tavern:sweet_berry_wine_q1
kaleidoscope_tavern:sweet_berry_wine_q2
kaleidoscope_tavern:sweet_berry_wine_q3
kaleidoscope_tavern:sweet_berry_wine_q4
kaleidoscope_tavern:sweet_berry_wine_q5
kaleidoscope_tavern:sweet_berry_wine_q6
kaleidoscope_tavern:vinegar_q1
kaleidoscope_tavern:vinegar_q2
kaleidoscope_tavern:vinegar_q3
kaleidoscope_tavern:vinegar_q4
kaleidoscope_tavern:vinegar_q5
kaleidoscope_tavern:vinegar_q6
kaleidoscope_tavern:vodka_q1
kaleidoscope_tavern:vodka_q2
kaleidoscope_tavern:vodka_q3
kaleidoscope_tavern:vodka_q4
kaleidoscope_tavern:vodka_q5
kaleidoscope_tavern:vodka_q6
kaleidoscope_tavern:watermelon_juice
kaleidoscope_tavern:whiskey_q1
kaleidoscope_tavern:whiskey_q2
kaleidoscope_tavern:whiskey_q3
kaleidoscope_tavern:whiskey_q4
kaleidoscope_tavern:whiskey_q5
kaleidoscope_tavern:whiskey_q6
kaleidoscope_tavern:white_lady
kaleidoscope_tavern:wine_q1
kaleidoscope_tavern:wine_q2
kaleidoscope_tavern:wine_q3
kaleidoscope_tavern:wine_q4
kaleidoscope_tavern:wine_q5
kaleidoscope_tavern:wine_q6
```

</details>

<details>
<summary>世界名酒：已支援的 117 個完整飲品 ID（27 種飲品）</summary>

```text
kaleidoscope_world_liquor:absolut_vodka_q1
kaleidoscope_world_liquor:absolut_vodka_q2
kaleidoscope_world_liquor:absolut_vodka_q3
kaleidoscope_world_liquor:absolut_vodka_q4
kaleidoscope_world_liquor:absolut_vodka_q5
kaleidoscope_world_liquor:absolut_vodka_q6
kaleidoscope_world_liquor:around_the_world
kaleidoscope_world_liquor:bacardi_carta_blanca_q1
kaleidoscope_world_liquor:bacardi_carta_blanca_q2
kaleidoscope_world_liquor:bacardi_carta_blanca_q3
kaleidoscope_world_liquor:bacardi_carta_blanca_q4
kaleidoscope_world_liquor:bacardi_carta_blanca_q5
kaleidoscope_world_liquor:bacardi_carta_blanca_q6
kaleidoscope_world_liquor:bamboo_leaf_green_liquor_q1
kaleidoscope_world_liquor:bamboo_leaf_green_liquor_q2
kaleidoscope_world_liquor:bamboo_leaf_green_liquor_q3
kaleidoscope_world_liquor:bamboo_leaf_green_liquor_q4
kaleidoscope_world_liquor:bamboo_leaf_green_liquor_q5
kaleidoscope_world_liquor:bamboo_leaf_green_liquor_q6
kaleidoscope_world_liquor:bombay_sapphire_gin_q1
kaleidoscope_world_liquor:bombay_sapphire_gin_q2
kaleidoscope_world_liquor:bombay_sapphire_gin_q3
kaleidoscope_world_liquor:bombay_sapphire_gin_q4
kaleidoscope_world_liquor:bombay_sapphire_gin_q5
kaleidoscope_world_liquor:bombay_sapphire_gin_q6
kaleidoscope_world_liquor:cola
kaleidoscope_world_liquor:cool_tea_q1
kaleidoscope_world_liquor:cool_tea_q2
kaleidoscope_world_liquor:cool_tea_q3
kaleidoscope_world_liquor:cool_tea_q4
kaleidoscope_world_liquor:cool_tea_q5
kaleidoscope_world_liquor:cool_tea_q6
kaleidoscope_world_liquor:dassai_q1
kaleidoscope_world_liquor:dassai_q2
kaleidoscope_world_liquor:dassai_q3
kaleidoscope_world_liquor:dassai_q4
kaleidoscope_world_liquor:dassai_q5
kaleidoscope_world_liquor:dassai_q6
kaleidoscope_world_liquor:gin_tonic
kaleidoscope_world_liquor:highball
kaleidoscope_world_liquor:ice_tea_q1
kaleidoscope_world_liquor:ice_tea_q2
kaleidoscope_world_liquor:ice_tea_q3
kaleidoscope_world_liquor:ice_tea_q4
kaleidoscope_world_liquor:ice_tea_q5
kaleidoscope_world_liquor:ice_tea_q6
kaleidoscope_world_liquor:jack_daniel_q1
kaleidoscope_world_liquor:jack_daniel_q2
kaleidoscope_world_liquor:jack_daniel_q3
kaleidoscope_world_liquor:jack_daniel_q4
kaleidoscope_world_liquor:jack_daniel_q5
kaleidoscope_world_liquor:jack_daniel_q6
kaleidoscope_world_liquor:jerk
kaleidoscope_world_liquor:johnnie_walker_q1
kaleidoscope_world_liquor:johnnie_walker_q2
kaleidoscope_world_liquor:johnnie_walker_q3
kaleidoscope_world_liquor:johnnie_walker_q4
kaleidoscope_world_liquor:johnnie_walker_q5
kaleidoscope_world_liquor:johnnie_walker_q6
kaleidoscope_world_liquor:kwas_chlebowy_q1
kaleidoscope_world_liquor:kwas_chlebowy_q2
kaleidoscope_world_liquor:kwas_chlebowy_q3
kaleidoscope_world_liquor:kwas_chlebowy_q4
kaleidoscope_world_liquor:kwas_chlebowy_q5
kaleidoscope_world_liquor:kwas_chlebowy_q6
kaleidoscope_world_liquor:lafite_1982_q1
kaleidoscope_world_liquor:lafite_1982_q2
kaleidoscope_world_liquor:lafite_1982_q3
kaleidoscope_world_liquor:lafite_1982_q4
kaleidoscope_world_liquor:lafite_1982_q5
kaleidoscope_world_liquor:lafite_1982_q6
kaleidoscope_world_liquor:long_island_iced_tea
kaleidoscope_world_liquor:maotai_q1
kaleidoscope_world_liquor:maotai_q2
kaleidoscope_world_liquor:maotai_q3
kaleidoscope_world_liquor:maotai_q4
kaleidoscope_world_liquor:maotai_q5
kaleidoscope_world_liquor:maotai_q6
kaleidoscope_world_liquor:pina_colada_q1
kaleidoscope_world_liquor:pina_colada_q2
kaleidoscope_world_liquor:pina_colada_q3
kaleidoscope_world_liquor:pina_colada_q4
kaleidoscope_world_liquor:pina_colada_q5
kaleidoscope_world_liquor:pina_colada_q6
kaleidoscope_world_liquor:pine_colada
kaleidoscope_world_liquor:shrimp_cocktail
kaleidoscope_world_liquor:skyy_vodka_q1
kaleidoscope_world_liquor:skyy_vodka_q2
kaleidoscope_world_liquor:skyy_vodka_q3
kaleidoscope_world_liquor:skyy_vodka_q4
kaleidoscope_world_liquor:skyy_vodka_q5
kaleidoscope_world_liquor:skyy_vodka_q6
kaleidoscope_world_liquor:smirnoff_red_vodka_q1
kaleidoscope_world_liquor:smirnoff_red_vodka_q2
kaleidoscope_world_liquor:smirnoff_red_vodka_q3
kaleidoscope_world_liquor:smirnoff_red_vodka_q4
kaleidoscope_world_liquor:smirnoff_red_vodka_q5
kaleidoscope_world_liquor:smirnoff_red_vodka_q6
kaleidoscope_world_liquor:sour_plum_q1
kaleidoscope_world_liquor:sour_plum_q2
kaleidoscope_world_liquor:sour_plum_q3
kaleidoscope_world_liquor:sour_plum_q4
kaleidoscope_world_liquor:sour_plum_q5
kaleidoscope_world_liquor:sour_plum_q6
kaleidoscope_world_liquor:spiryt_vodka_q1
kaleidoscope_world_liquor:spiryt_vodka_q2
kaleidoscope_world_liquor:spiryt_vodka_q3
kaleidoscope_world_liquor:spiryt_vodka_q4
kaleidoscope_world_liquor:spiryt_vodka_q5
kaleidoscope_world_liquor:spiryt_vodka_q6
kaleidoscope_world_liquor:strongbow_q1
kaleidoscope_world_liquor:strongbow_q2
kaleidoscope_world_liquor:strongbow_q3
kaleidoscope_world_liquor:strongbow_q4
kaleidoscope_world_liquor:strongbow_q5
kaleidoscope_world_liquor:strongbow_q6
kaleidoscope_world_liquor:tonic_water
```

</details>

酒館的 `kaleidoscope_tavern:shaker` 雖有 `minecraft:food`，其營養是 0；`shaker_active` 和 `shaker_pouring` 雖使用飲用動畫，也只是工具代理。三者都不是餐廳食品，沒有混入上述 165 個飲品。

飲品核對來源：[酒館物品定義](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/tree/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items)、[酒館飲用完成流程](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/bedrock/drink-effects.js)、[酒館招牌調酒資料](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/bedrock/mixology.js)、[世界名酒物品定義](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/tree/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items)、[世界名酒瓶裝飲品流程](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/scripts/bottled-drink.js)。

## 6. 驗證範圍

本次清單來自最新 main 的程式、物品定義及原作來源比對，並核算了固定食品數量、營養和代理去重。這份目錄本身不構成 Minecraft 客戶端、生存生產鏈、實際交付或重啟驗收；PR 中的程式測試與 CI 結果應按實際執行結果另行記錄。未修改供應模組原始玩法、Cookery 指南、LIVE 或正式 Release。
