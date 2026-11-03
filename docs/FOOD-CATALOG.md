# 食品目錄、營養依據與尚未支援項目

盤點日期：2026-11-03。此表記錄 OTC 可選食品供應的固定目錄與來源；**目錄有定義不等於世界已安裝該 Addon，也不等於已完成料理取得的實機驗收**。玩家實際持有符合條件的食品，才透過現有菜單操作登記。OTC 不替玩家生成食品，也不要求把煙火、酒館、世界名酒或整套森羅家族全部安裝。

目前固定目錄增加 **64 個食品身份、328 點營養**：煙火 56／300、酒館 4／8、世界名酒 4／20。連同既有 40 種原版食品／159 點，合計是 **104 個食品身份／487 點**。這是完整已知目錄的加總，含已結束活動的喜糖和仍有取得限制的食材，**不能宣稱全新生存世界已能自然取得 487 點**。

## 1. 數值和來源怎樣判定

OTC 的營養值沿用 Java 食品規則中的 `nutrition`，即食物回復的飢餓值。它不是飽和度，不是效果持續時間，也不是售價。未知或零營養的飲品不會因為可以喝、有品質、帶有熱度、調味或有增益效果，就得到額外營養。固定食品的進食時間代理和品質代理，只對應原有食品身份，不增加菜種或累加同一道料理的營養。

本次盤點使用以下來源快照；這些 commit 是核對依據，不是要求玩家遵守的跨模組版本鎖。

| 來源 | 核對版本 | 用途 |
| --- | --- | --- |
| [煙火 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2) | `389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2` | 物品定義、取得流程、品質與進食時間代理 |
| [煙火 Java 1.1.1](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c) | `9a1acdab27698457bec16c9362678e574895a28c` | NeoForge 1.21.1 `ModItems`、食物營養與原作配方 |
| [酒館 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/tree/5b209aa9b365735bcbfcb42eea232fb90bf71c10) | `5b209aa9b365735bcbfcb42eea232fb90bf71c10` | 全部 255 個物品定義、葡萄種植與飲品流程 |
| [酒館 Java 原作](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/tree/c4ec1880bd44cf3139d3ba744ab30bb379cf1416) | `c4ec1880bd44cf3139d3ba744ab30bb379cf1416` | `ModFoods`、`ModItems`、飲品／玻璃杯物品類別 |
| [世界名酒 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/tree/3424205a3c4a68b93316d15516594a2f3fb1c14d) | `3424205a3c4a68b93316d15516594a2f3fb1c14d` | 全部 159 個物品定義、冰櫃與合成配方 |

**已獨立核實 Java 營養：**煙火下列 56 種固定食品；酒館四種葡萄均使用 Java `ModFoods.GRAPE` 的營養 2，與 Bedrock 的食物元件一致。酒館現有 NeoForge `data/upstream/javap/init.ModFoods.txt` 也記錄 2，並非只依賴另一載入器的推測。

**已核實 Bedrock 供應值，但未獨立核實原作數值：**世界名酒四種甜點的現行 `minecraft:food.nutrition` 都是 5。來源轉換器將它們描述為 Twilight 整合的獨立命名空間後備食品；本次沒有取得足以獨立核實 Twilight Java「5 點」的原始食品類別。因此這四項明確列為「Bedrock 供應值」，不宣稱它們的營養已完成 Java 等價驗證。

數值來源：[煙火 Java ModItems](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java)、[酒館 Java ModFoods](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/blob/c4ec1880bd44cf3139d3ba744ab30bb379cf1416/src/main/java/com/github/ysbbbbbb/kaleidoscopetavern/init/ModFoods.java)、[酒館 Java ModItems](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/blob/c4ec1880bd44cf3139d3ba744ab30bb379cf1416/src/main/java/com/github/ysbbbbbb/kaleidoscopetavern/init/ModItems.java)、[世界名酒來源轉換器](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/tools/_build_port_source.py)。

## 2. 完整新增食品清單

下表列的是 canonical 食品 ID；每列的「物品」連結是當前 Bedrock 供應定義。煙火各表另連結 Java 營養與取得程式／配方。原料串與烤熟串在原作中是不同的可食用物品，保留其不同身份；負面效果不會自動取消原作食品資格。

### 2.1 煙火：烤串成品

由既有烤架將對應的 `raw_*` 食材串烤製成 `grilled_*` 成品。取得與燒烤仍由煙火負責，本次 OTC 修改沒有改動烤架製程。

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 烤牛肉串<br>`kaleidoscope_grilling:grilled_beef_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_beef_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_beef_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L435)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤饅頭片串<br>`kaleidoscope_grilling:grilled_bun_slice_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_bun_slice_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_bun_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L472)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤豬兒蟲串<br>`kaleidoscope_grilling:grilled_caterpillar_skewer` | 12 | 烤架烤製 `kaleidoscope_grilling:raw_caterpillar_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_caterpillar_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L465)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤雞皮串<br>`kaleidoscope_grilling:grilled_chicken_skin_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_chicken_skin_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_chicken_skin_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L443)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤末影珍珠串<br>`kaleidoscope_grilling:grilled_ender_pearl_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_ender_pearl_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_ender_pearl_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L473)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤魚串<br>`kaleidoscope_grilling:grilled_fish_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_fish_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_fish_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L457)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤煎蛋串<br>`kaleidoscope_grilling:grilled_fried_egg_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_fried_egg_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_fried_egg_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L483)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤麵筋串<br>`kaleidoscope_grilling:grilled_gluten_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_gluten_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_gluten_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L484)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 黃金烤串<br>`kaleidoscope_grilling:grilled_golden_skewer` | 12 | 烤架烤製 `kaleidoscope_grilling:raw_golden_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_golden_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L396)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤羊肉串<br>`kaleidoscope_grilling:grilled_lamb_skewer` | 8 | 烤架烤製 `kaleidoscope_grilling:raw_lamb_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_lamb_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L366)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤骨肉相連串<br>`kaleidoscope_grilling:grilled_meat_and_bone_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_meat_and_bone_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_meat_and_bone_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L482)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤丸子串<br>`kaleidoscope_grilling:grilled_meatball_skewer` | 12 | 烤架烤製 `kaleidoscope_grilling:raw_meatball_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_meatball_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L475)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤中翅串<br>`kaleidoscope_grilling:grilled_mid_wing_skewer` | 7 | 烤架烤製 `kaleidoscope_grilling:raw_mid_wing_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_mid_wing_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L449)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤蘑菇串<br>`kaleidoscope_grilling:grilled_mushroom_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_mushroom_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_mushroom_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L466)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤五花肉串<br>`kaleidoscope_grilling:grilled_pork_belly_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_pork_belly_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_pork_belly_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L442)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤馬鈴薯片串<br>`kaleidoscope_grilling:grilled_potato_slice_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_potato_slice_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_potato_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L464)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤黏液串<br>`kaleidoscope_grilling:grilled_slime_skewer` | 4 | 烤架烤製 `kaleidoscope_grilling:raw_slime_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_slime_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L481)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤魷魚鬚串<br>`kaleidoscope_grilling:grilled_squid_tentacle_skewer` | 5 | 烤架烤製 `kaleidoscope_grilling:raw_squid_tentacle_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_squid_tentacle_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L450)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 烤苕皮串<br>`kaleidoscope_grilling:grilled_sweet_potato_sheet_skewer` | 6 | 烤架烤製 `kaleidoscope_grilling:raw_sweet_potato_sheet_skewer`；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/grilled_sweet_potato_sheet_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L458)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |

### 2.2 煙火：可食用的原料串及特殊串

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 黑暗燒烤<br>`kaleidoscope_grilling:dark_grilling` | 1 | 烤架失敗產物，原作本來可食用；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/dark_grilling.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L144)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| 迷之烤串<br>`kaleidoscope_grilling:mysterious_skewer` | 2 | 烤架失敗產物，原作本來可食用；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/mysterious_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L129)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/grill/runtime.js) |
| “普通”烤串<br>`kaleidoscope_grilling:ordinary_skewer` | 5 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/ordinary_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L407)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生牛肉串<br>`kaleidoscope_grilling:raw_beef_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_beef_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L491)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生饅頭片串<br>`kaleidoscope_grilling:raw_bun_slice_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_bun_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L501)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生豬兒蟲串<br>`kaleidoscope_grilling:raw_caterpillar_skewer` | 6 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_caterpillar_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L499)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生雞皮串<br>`kaleidoscope_grilling:raw_chicken_skin_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_chicken_skin_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L493)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生末影珍珠串<br>`kaleidoscope_grilling:raw_ender_pearl_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_ender_pearl_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L502)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生魚串<br>`kaleidoscope_grilling:raw_fish_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_fish_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L496)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生煎蛋串<br>`kaleidoscope_grilling:raw_fried_egg_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_fried_egg_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L511)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生麵筋串<br>`kaleidoscope_grilling:raw_gluten_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_gluten_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L512)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生黃金烤串<br>`kaleidoscope_grilling:raw_golden_skewer` | 6 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_golden_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L381)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生羊肉串<br>`kaleidoscope_grilling:raw_lamb_skewer` | 4 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_lamb_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L351)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生骨肉相連串<br>`kaleidoscope_grilling:raw_meat_and_bone_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_meat_and_bone_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L510)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生丸子串<br>`kaleidoscope_grilling:raw_meatball_skewer` | 4 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_meatball_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L508)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生中翅串<br>`kaleidoscope_grilling:raw_mid_wing_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_mid_wing_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L494)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生蘑菇串<br>`kaleidoscope_grilling:raw_mushroom_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_mushroom_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L500)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生五花肉串<br>`kaleidoscope_grilling:raw_pork_belly_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_pork_belly_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L492)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生馬鈴薯片串<br>`kaleidoscope_grilling:raw_potato_slice_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_potato_slice_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L498)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生黏液串<br>`kaleidoscope_grilling:raw_slime_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_slime_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L509)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生魷魚鬚串<br>`kaleidoscope_grilling:raw_squid_tentacle_skewer` | 2 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_squid_tentacle_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L495)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |
| 生苕皮串<br>`kaleidoscope_grilling:raw_sweet_potato_sheet_skewer` | 3 | 依原作食材組合穿串；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/raw_sweet_potato_sheet_skewer.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L497)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/data/java/recipes.json) |

### 2.3 煙火：料理、作物、食材與活動食品

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 紅燒雞翅<br>`kaleidoscope_grilling:braised_chicken_wings` | 10 | Cookery 炒鍋／彈性炒鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/braised_chicken_wings.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L305)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_pot/braised_chicken_wings.json) |
| 雞翅<br>`kaleidoscope_grilling:chicken_wing` | 2 | 使用廚刀取得雞掉落食材；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/chicken_wing.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L97)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/world/chicken_acquisition_core.js) |
| 涼拌折耳根<br>`kaleidoscope_grilling:cold_houttuynia` | 6 | 3 份折耳根＋2 單位高品質辣椒油，工作台潛行使用；折耳根初始取得有限制；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/cold_houttuynia.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L248)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/food/cold_houttuynia_core.js) |
| 青椒炒魷魚鬚<br>`kaleidoscope_grilling:green_pepper_squid_tentacles` | 8 | Cookery 炒鍋／彈性炒鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/green_pepper_squid_tentacles.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L303)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_pot/green_pepper_squid_tentacles.json) |
| 折耳根<br>`kaleidoscope_grilling:houttuynia` | 2 | 作物收穫；初始種子／自然取得尚待供應模組驗證；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/houttuynia.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L109)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/world/houttuynia_crop_runtime.js) |
| 折耳根炒肉<br>`kaleidoscope_grilling:houttuynia_stir_fried_pork` | 9 | Cookery 炒鍋／彈性炒鍋配方；折耳根初始取得有限制；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/houttuynia_stir_fried_pork.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L301)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_pot/houttuynia_stir_fried_pork.json) |
| 花椒蜂蜜<br>`kaleidoscope_grilling:pepper_honey` | 4 | 原作無序合成配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/pepper_honey.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L274)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/pepper_honey.json) |
| 馬鈴薯燉牛肉（煙火版）<br>`kaleidoscope_grilling:potato_beef_stew` | 12 | Cookery 湯鍋／彈性湯鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/potato_beef_stew.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L307)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_stockpot/potato_beef_stew.json) |
| 紅苕稀飯<br>`kaleidoscope_grilling:red_sweet_potato_porridge` | 14 | Cookery 湯鍋／彈性湯鍋配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/red_sweet_potato_porridge.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L309)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_stockpot/red_sweet_potato_porridge.json) |
| 烤雞翅<br>`kaleidoscope_grilling:roasted_chicken_wing` | 5 | 熔爐、煙燻爐或營火烹調；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/roasted_chicken_wing.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L236)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/roasted_chicken_wing.json) |
| 烤番薯<br>`kaleidoscope_grilling:roasted_sweet_potato` | 6 | 熔爐、煙燻爐或營火烹調；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/roasted_sweet_potato.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L220)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/roasted_sweet_potato.json) |
| 酸辣粉<br>`kaleidoscope_grilling:sour_spicy_noodles` | 10 | Cookery 湯鍋／彈性湯鍋配方；另需酒館醋；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/sour_spicy_noodles.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L419)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/flex_stockpot/sour_spicy_noodles.json) |
| 糖拌番茄<br>`kaleidoscope_grilling:sugared_tomato` | 6 | 原作無序合成配方；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/sugared_tomato.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L262)／[取得](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipe/sugared_tomato.json) |
| 番薯<br>`kaleidoscope_grilling:sweet_potato` | 3 | 作物收穫；初始種子／自然取得尚待供應模組驗證；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/sweet_potato.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L208)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/world/sweet_potato_crop_core.js) |
| 喜糖<br>`kaleidoscope_grilling:wedding_candy` | 20 | 2026-09-01 至 09-12 活動；現已結束，只保留已有庫存；[物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/items/wedding_candy.json)／[Java](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java#L288)／[取得](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/389b9b5cdfafae631f84d6b66cd30fe82cfdf0a2/projects/grilling/gameplay_core/behavior_pack/scripts/food/wedding_candy_core.js) |

### 2.4 酒館：四種葡萄（Java 與 Bedrock 均為 2）

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 金葡萄<br>`kaleidoscope_tavern:gold_grape` | 2 | 在地獄石／岩漿塊底材上的棚架種植；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/gold_grape.json) |
| 葡萄<br>`kaleidoscope_tavern:grape` | 2 | 在一般適用土壤上的棚架種植成熟葡萄；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/grape.json) |
| 青提<br>`kaleidoscope_tavern:green_grape` | 2 | 成熟葡萄收穫時有 30% 機會額外產出；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/green_grape.json) |
| 冰葡萄<br>`kaleidoscope_tavern:ice_grape` | 2 | 在適用冰／雪底材上的棚架種植；[物品](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/items/ice_grape.json) |

取得來源：[酒館 cultivation 規則](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/core/cultivation.js)。上述四種葡萄沒有新增品質或熱度營養倍率。

### 2.5 世界名酒：四種甜點（現行 Bedrock 明確供應值）

| 食品／完整 ID | 營養 | 取得方式與來源 |
| --- | ---: | --- |
| 喜多夾心脆<br>`kaleidoscope_world_liquor:kita_stuffed_crisp` | 5 | 冰櫃：甜漿果汁＋雪球，1200 ticks；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/kita_stuffed_crisp.json) |
| 涼山田筒<br>`kaleidoscope_world_liquor:liangshan_ice_cone` | 5 | 冰櫃：牛奶＋藍色染料，1200 ticks；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/liangshan_ice_cone.json) |
| 妙脆角<br>`kaleidoscope_world_liquor:magic_crispy_corner` | 5 | 工作台：8 個金粒包圍 1 塊曲奇；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/magic_crispy_corner.json) |
| 波奇布丁<br>`kaleidoscope_world_liquor:pochi_pudding` | 5 | 冰櫃：葡萄汁＋黏液球，1200 ticks；用碗取出；[物品](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/items/pochi_pudding.json) |

取得來源：[世界名酒現行冰櫃配方](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/scripts/freezer-recipes.js)、[妙脆角合成](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/recipes/magic_crispy_corner.json)。這些食品的狀態效果不計作額外營養。世界名酒本身既有的酒館相依仍由該供應模組管理，OTC 不擴張成整套家族相依。

## 3. 取得限制與 Lv.8

| 範圍 | 食品身份數 | 營養總和 | 可作出的結論 |
| --- | ---: | ---: | --- |
| 原有原版表 | 40 | 159 | 原本的固定目錄基線 |
| 新增煙火固定食品 | 56 | 300 | 含喜糖，以及有取得前置／缺口的食品 |
| 新增酒館葡萄 | 4 | 8 | 不包括酒的品質等級 |
| 新增世界名酒甜點 | 4 | 20 | 使用現行 Bedrock 食品元件數值 |
| 全部已知固定目錄 | 104 | 487 | 目錄合計，仍比 Lv.8 的 600 少 113 |
| 排除已結束活動的喜糖 | 103 | 467 | 仍比 600 少 133；其他取得限制仍須另計 |

需要保留的取得限制：

- **喜糖 `wedding_candy`：**供應模組活動窗口是 Asia/Shanghai 的 2026-09-01 至 2026-09-12。11 月的新世界不能靠該活動自然新增喜糖；舊世界已持有的喜糖仍是有效食品，不刪除其菜單或庫存。
- **折耳根 `houttuynia`：**種植／收穫已有程式，但煙火自己的 PARITY 仍把要塞等自然初始取得列作未完成。這也影響涼拌折耳根、折耳根炒肉，以及用到折耳根／碎折耳根的黏液串、苕皮串等料理。不能把已有種子可收成寫成新世界一定能取得種子。
- **番薯 `sweet_potato`：**已有作物收穫流程，初始種子／世界取得仍需要供應模組實機核對；其派生料理相應受限。
- **酸辣粉 `sour_spicy_noodles`：**原作及現有供應配方要求酒館醋。沒有酒館時，這不是一項 Grilling 單獨可生產的料理。實際既有成品仍可被識別。
- **Cookery 食材和設備：**部分穿串、炒鍋與湯鍋配方使用 Cookery 食材或設備。OTC 只接受供應者既有成品，不建立替代製程，不以指令補材料，亦不要求與該食品無關的其他 Addon。

487 和 467 都只是已識別食品集合的總和，並未證明全新生存世界能完成全部生產鏈。這次擴充改善 159 點的原有上限，但**尚未解決自然達到 Lv.8 的內容缺口**。後續應接入真正可取得、營養有依據的其他料理；Java 的 600 門檻、報酬公式及品質規則不會為了湊數而降低或放大。

## 4. 暫未納入的煙火食品／容器

| 完整 ID | 目前不能預設納入的原因 |
| --- | --- |
| `kaleidoscope_grilling:secret_skewer` 及其進食時間代理 | 每份材料與有效營養來自動態內容；目前沒有可供 OTC 使用的公開食品／營養規則。Java 預設物品的佔位值 1 和 Bedrock 原生 0 都不能代替整份串的可靠營養。 |
| `kaleidoscope_grilling:skewer_plate` | 一個盤子可含不同串；不能把容器當一道固定食物，也不能憑 V1 的品質、熱度或調味猜測內容營養。 |
| `kaleidoscope_grilling:sichuan_pepper` | Java 可食且營養為 1，但現行 Bedrock 物品沒有食物元件；OTC 不藉目錄把不可食的供應物品改成可食。 |
| `kaleidoscope_grilling:sweet_potato_powder` | 原生食物元件的營養為 0，作使用事件觸發用途；不視為正營養料理。 |
| `kaleidoscope_grilling:skewer_recipe_book` | 營養為 0 的使用事件觸發物，不是料理。 |

固定煙火食品另有 **62 個進食時間代理 ID** 和 **12 個料理品質代理 ID**。目錄把它們接回對應的固定食品身份，因此不會把同一道紅燒雞翅的多個品質或進食時間版本當作多道獨立增長營養的菜。它們不屬於上表的未支援食品；實際訂單仍必須保留並核對玩家登記的物品快照。

森羅 V1 是公開的狀態讀取格式。其 `quality`、`hotUntil` 和 `seasoning` 本身不提供食品營養，也不等於新增一道菜的資格。已存在的菜單、訂單或存檔不可因這份目錄更新被批次清除。

## 5. 尚未有正營養來源的飲品：完整 ID 清單

以下 **282 個飲品 ID** 均逐項核對現行 Bedrock 定義：酒館 165、世界名酒 117。它們可透過供應模組的自訂流程飲用，但都沒有原生的正營養食物數值，故目前預設固定目錄不會將它們視作餐廳的正營養食品。

這是本次預設目錄的支援狀態，**不是永久黑名單**。以後若可選食品供應者提供可靠、可核對的食品營養規則，可按該規則支援；不能先給未知飲品隨意填 1，也不能把酒的品質或狀態效果轉成營養／報酬倍率。

酒館原作的普通酒瓶和調酒物品由非 food 的 `Item.Properties` 建立，飲用效果不等於 Java `FoodProperties`。世界名酒可樂／通寧水本次只確認現行 Bedrock 未提供原生營養，未獨立取得所有 Java 版本的食品類別證據，不能把這點擴張成「每個 Java 版本必然為零」。

酒瓶的 `_q1` 至 `_q6` 是 Bedrock 的品質編碼，對應一個 Java 物品的 BrewLevel；不是六種額外營養。招牌調酒的原有顏色、效果和材料由酒館自己的動態資料保存，目前沒有核實為可直接給 OTC 使用的公開 V1 食品變體；本次不讀取它的私有資料來造營養。

<details>
<summary>酒館：165 個完整飲品 ID</summary>

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
<summary>世界名酒：117 個完整飲品 ID</summary>

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
