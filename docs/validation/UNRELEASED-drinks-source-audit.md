# 飲品供應與世界名酒食品來源核對

核對日期：2026-11-03。本文記錄靜態物品、消費流程與 Java 原作查核；沒有把程式閱讀或 Node 斷言當成 Minecraft 客戶端／世界實測。原始模組 JAR 與反編譯檔只作暫存查核，不納入倉庫或 Bedrock 套件。

## 結論

新增的 [`SENLUO_DRINKS`](../../runtime/BP/scripts/senluo_drink_catalog.js) 有 **72 個飲品身份、282 個實際 Bedrock 物品 ID**。它們具有實際飲用完成流程，但沒有正的基礎食品營養，故以 `nutrition: 0`、`servingKind: "drink"` 供應菜單。這是明示的 **Bedrock 飲品菜單擴充**；Java OTC 預設不接受零營養食品。

酒品質、酒精、狀態效果、熱度與調味不轉換成營養或報酬倍率。四款世界名酒甜點保留每款 **5 點**：已核實它們對應世界名酒 Java 自己提供的 Twilight 後備物品，並非套用獨立 Twilight 模組的另一組數值。

## 1. 固定來源

| 來源 | 固定版本／雜湊 | 本次用途 |
| --- | --- | --- |
| [OTC Java](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642) | `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642` | `MenuFoodCompatApi`、告示板、訂單機的正營養限制 |
| [酒館 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/tree/5b209aa9b365735bcbfcb42eea232fb90bf71c10) | `5b209aa9b365735bcbfcb42eea232fb90bf71c10` | 實際物品 ID、飲用與容器交換、繁中名稱 |
| [酒館 Java](https://github.com/KaleidoscopeMods/KaleidoscopeTavern/tree/c4ec1880bd44cf3139d3ba744ab30bb379cf1416) | `c4ec1880bd44cf3139d3ba744ab30bb379cf1416` | `DrinkBlockItem`、`CocktailBlockItem` 與品質身份 |
| [世界名酒 Bedrock](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/tree/3424205a3c4a68b93316d15516594a2f3fb1c14d) | `3424205a3c4a68b93316d15516594a2f3fb1c14d` | 實際 ID、瓶裝飲品完成流程、Twilight 後備食品映射 |
| [世界名酒 Java 1.1.12，NeoForge 1.21.1](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-world-liquor/files/9217896) | CurseForge project `1502365` / file `9217896`；6,802,055 bytes；SHA-256 `d963089ad0a7f99a8950171d76913cfeea99a0126ee12b16c72c3162f8545da3` | `ModItems`、`ModFoods`、`init/kaleidoscope_twilight/KTItems`、`CompatFoodItem` 與模組載入條件 |
| [獨立 Twilight Java 1.2.0，NeoForge 1.21.1](https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-twilight/files/9028413) | CurseForge project `1525243` / file `9028413`；880,777 bytes；SHA-256 `4db856d255094f4fd54eef5df54a73f79a37efa33272d74f44a193f06f9f5189` | 對照同名食品在另一供應模組中的數值，避免誤套 |

世界名酒 Java 1.1.12 的檔案 ID 與雜湊亦符合供應倉庫的 [2026-10-28 原作者版本核對記錄](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/data/current-author-review-20261028.json)。兩個 Java JAR 均由 CurseForge 官方下載端點取得並以 CFR 0.152 檢查指定類別；其 `META-INF/neoforge.mods.toml` 的模組 ID／版本分別為 `kaleidoscope_world_liquor` / `1.1.12-neoforge+1.21.1` 與 `kaleidoscope_twilight` / `1.2.0-neoforge+mc1.21.1`。

## 2. 282 個 ID 的可飲用性與基礎營養

| 供應方／分類 | 菜單身份 | 實際 ID | 實際完成入口 | 基礎營養 |
| --- | ---: | ---: | --- | ---: |
| 酒館品質瓶裝酒／醋 | 24 | 144 | `completeDrink` → `consumeDrink` → `settleDrinkUse` | 0 |
| 酒館西瓜汁 | 1 | 1 | `parseBottle` 明確識別，進入 `completeDrink` | 0 |
| 酒館固定雞尾酒 | 12 | 12 | `completeCocktail` | 0 |
| 酒館神秘／特調雞尾酒 | 2 | 2 | `completeCocktail`；特調效果讀取原供應方 payload | 0 |
| 酒館六種果汁桶 | 6 | 6 | `completeDrink` 的 `JUICE_BUCKETS` 分支 | 0 |
| 世界名酒品質瓶裝酒／茶／酸梅湯 | 18 | 108 | 註冊到酒館擴充介面，進入酒館 `completeDrink` | 0 |
| 世界名酒雞尾酒 | 7 | 7 | 註冊到酒館擴充介面，進入 `completeCocktail` | 0 |
| 世界名酒可樂／湯力水 | 2 | 2 | 自有 `completeBottledDrink` | 0 |
| **合計** | **72** | **282** | 酒館 45／165；世界名酒 27／117 | **0** |

逐 ID 查核確認：282 個定義全部存在，全部有 `minecraft:use_animation: "drink"`，全部沒有 `minecraft:food` 元件。此判定還追查了自訂完成處理，並非只根據飲用動畫或元件缺省推測。

消費來源與判讀：

- [酒館 `drink-effects.js`](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/bedrock/drink-effects.js)：瓶裝飲品套用來源效果，再交由容器交換處理。六種果汁桶確實可以飲用，會移除中毒效果，再消耗原桶並返還空桶；它們同時也是釀造材料。
- [酒館 `mixology.js`](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/bedrock/mixology.js)：`completeCocktail` 套用固定或特調效果，之後消耗原飲品並返還空杯。
- [酒館 `drink-completion.js`](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/5b209aa9b365735bcbfcb42eea232fb90bf71c10/runtime/BP/scripts/bedrock/drink-completion.js)：綁定實際使用中的完整物品堆疊，處理消耗、創造模式與容器返還；沒有額外基礎營養給付。
- [世界名酒 `main.js`](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/scripts/main.js) 把瓶酒與雞尾酒資料交給現有酒館擴充 API；[其 `content.js`](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/scripts/content.js) 保留實際品質 ID 與效果。
- [世界名酒 `bottled-drink.js`](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/runtime/BP/scripts/bottled-drink.js)：可樂給予急迫／速度，湯力水給予回復，然後消耗原物品並返還玻璃瓶；沒有基礎飢餓值增加。Java 1.1.12 `ModItems.COLA`／`TONIC_WATER` 建立只含效果和 `alwaysEdible()` 的 `FoodProperties.Builder`，沒有設定 `nutrition`，其基礎值為 0。

「基礎營養 0」不表示飲品效果不會影響生命、飽和度、飢餓、消耗量或其他玩家狀態。上述效果依舊由原供應模組處理；OTC 不把效果的幅度或持續時間換算成菜單營養，也不修改喝下物品的行為。

42 組品質飲品各以**實際存在的 `_q1`** 為 canonical，`_q2` 至 `_q6` 共 210 個 ID 作 aliases。沒有生成供應方不存在的無品質 ID。兩個動態雞尾酒仍按 Java Item 身份供應；目前目錄不宣稱私人顏色／效果 payload 是可被 OTC 檢查的獨立調酒配方。若將來供應方公開穩定的配方身份，可再使用明示的變體協定。

## 3. Java OTC 的零營養限制

[`MenuFoodCompatApi.Result.allowed()`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/MenuFoodCompatApi.java) 同時要求 `Decision.ALLOW` 與 `nutrition > 0`。`resolve` 的自訂營養設定、最後的 `Item.getFoodProperties()` 後備判定也要求正值。供應的擴充規則即使回傳 `allow(0)`，亦不能直接越過此資格限制。

同一 Java 快照的 [`BoardBlockEntity.tryAddTemplate`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/BoardBlockEntity.java) 拒絕 `nutritionOf(source) <= 0`；[`OrderMachineBlockEntity`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java) 建立菜單食品清單時也略過零／負營養。此 OTC 原作快照沒有內建 `MenuFoodCompatApi.register` 呼叫來專門允許酒館或世界名酒飲品。

因此本次使用可識別的 `servingKind: "drink"` 擴充資格，保留來源營養 0。它不增加餐廳升級所需的營養總和，不調低 Lv.8 的 600 門檻，也不靠把飲品填成 1 點來偽裝正營養。

## 4. 四款甜點：世界名酒後備來源與獨立 Twilight 不同

世界名酒 Java 1.1.12 的 `com.bmt.kaleidoscope_world_liquor.KaleidoscopeWorldLiquor` 建構器，只有在 **未載入 `kaleidoscope_twilight`** 時才呼叫 `init.kaleidoscope_twilight.KTItems.register`。這個後備註冊器使用 `kaleidoscope_twilight` 命名空間，為四款物品建立 `CompatFoodItem`，食品值來自**世界名酒自己的** `init.ModFoods`。

`CompatFoodItem` 直接繼承 `Item`，建構器把傳入的食品屬性交給 `super(properties)`；`getCreatorModId` 回報模擬的 Twilight 來源，`finishUsingItem` 加上可選容器返還。它沒有把基礎營養改成另一模組的值。

| Bedrock 實際供應 ID | 世界名酒 Java 後備 nutrition／saturationModifier | Bedrock nutrition／saturation_modifier | 獨立 Twilight 1.2.0 的同名物品 nutrition／saturationModifier |
| --- | --- | --- | --- |
| `kaleidoscope_world_liquor:kita_stuffed_crisp` | 5／0.4 | 5／0.4 | 6／0.5 |
| `kaleidoscope_world_liquor:liangshan_ice_cone` | 5／0.4 | 5／0.4 | 5／0.4 |
| `kaleidoscope_world_liquor:magic_crispy_corner` | 5／0.4 | 5／0.4 | 4／0.3 |
| `kaleidoscope_world_liquor:pochi_pudding` | 5／0.4 | 5／0.4 | 8／0.7 |

獨立 Twilight 的 `com.bmt.kaleidoscope_twilight.init.KTItems` 把同名四個 ID 註冊為 `FoodWithEffectsItem(KTFoods.…)`；`KTFoods` 確實包含右欄的另一組數值。兩種 Java 載入情況不能混為同一供應定義。

Bedrock 世界名酒的 [來源轉換器](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/blob/3424205a3c4a68b93316d15516594a2f3fb1c14d/tools/_build_port_source.py) 明確把這四個後備食品放到自己的 `kaleidoscope_world_liquor` 命名空間，避免未來 Twilight 移植碰撞。因此 OTC 目前對這四個實際 ID 採用世界名酒後備值 **5**；不把未安裝的獨立 Twilight 數值套入，亦不改動供應模組或既存菜單／訂單快照。四項的 Java 營養來源疑點至此已消除。

## 5. 本次實際完成的核對

- 重新取得兩個 Bedrock 供應倉庫最新 main，確認與上述固定 commit 相符。
- 枚舉 282 個飲品物品 JSON，確認 ID、原生飲用動畫、自訂完成入口，以及不存在正的原生食品營養。
- 追查瓶酒、雞尾酒、果汁桶、可樂／湯力水的完成流程、消耗與容器返還；保留效果與基礎營養的區別。
- 對新增目錄執行 Node 斷言：72 canonical、282 個唯一實際 ID、與前次完整未支援飲品集合完全相等、每項皆 `nutrition: 0`／`servingKind: "drink"`、所有 canonical 與 aliases 均有對應的供應物品定義。斷言通過。
- 直接讀取並核對上述官方 Java JAR 的版本、大小、SHA-256、食品註冊、類別繼承與條件載入；沒有把 JAR 或整份反編譯內容寫入交付檔。

本文件只記來源驗證。完整訂單生成、備料、交付、取消、重啟的回歸結果與 CI 由本次 PR 的驗證記錄另行列出；實機飲用、容器與跨 Addon 顯示仍須依客戶端驗收記錄判定。
