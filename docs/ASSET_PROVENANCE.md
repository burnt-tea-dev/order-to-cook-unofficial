# 素材來源、轉換方式與視覺限制

本文件對應 **0.1.1-alpha.2**。本移植使用 Order To Cook 上游的模型、紋理、動畫與音效。家具、餐盤、外賣袋、頭盔與電單車的外形均來自原始資源；沒有以新畫的方塊、替代圖示或 AI 圖像取代原作。動畫與材質的轉換方式及限制如下，保留源檔不代表全部片段都已在玩法中使用。

## 上游與授權

| 項目 | 基線 |
|---|---|
| 原作 | [Order To Cook／下單了](https://www.curseforge.com/minecraft/mc-mods/order-to-cook)，breezeth-CN／breezeth |
| 原始碼 | [breezeth-CN/OrdertoCook](https://github.com/breezeth-CN/OrdertoCook) |
| 固定提交 | [`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642) |
| 原資源根目錄 | `common/src/main/resources/assets/ordertocook/` |
| 車輛模型來源 | `forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java` |
| 授權文件 | 上游 [LICENSE.txt](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/LICENSE.txt)，GNU GPL v3 |
| 本移植 | 非官方 Bedrock 派生作品，使用 GPL-3.0-only，保留原作者及修改記錄 |

上游 README 明示程式碼採 GPL v3。上述提交的素材目錄沒有另外的授權排除文件，本移植按倉庫授權保留素材來源；這不是對原作者另行授權或認可的聲稱。原 Java JAR、GeckoLib 二進位檔與 Minecraft 遊戲資產不包含在發行包中。程式與素材的可修改來源、轉換器和 GPL 文件一同保留。

`runtime/asset_conversion_manifest.json` 記錄每個輸入檔的來源路徑、SHA-256、輸出路徑與操作。單一來源可產生多個輸出，同一輸出也可結合多個原始模型，因此條目數不等於獨立素材數。原始 PNG 和 OGG 的 `copy` 條目可直接比對原檔雜湊；衍生 geometry 和縮圖則記錄其模型來源及轉換操作。

## 轉換器與重現

本倉庫的 `upstream/reference/` 隨附上述固定提交的可編輯來源子集：完整的共用 `assets/ordertocook/` 目錄、原工具箱配方、`MotorcycleModel.java` 及上游 `LICENSE.txt`。來源原檔未修改；`upstream/reference/UPSTREAM.json` 記錄提交、作者、授權及子集範圍。它包含轉換器需要的全部上游輸入，因此重產不依賴日後仍可存取的外部下載，也不需要 Java JAR 或完整 Java 建置。

使用本倉庫的 `tools/convert_assets.py`；預設來源就是隨附子集。安裝一次 Pillow 後，資源轉換可以離線執行：

```sh
python -m pip install Pillow==12.3.0
python tools/convert_assets.py
```

若要在獨立目錄驗證產物，使用 `python tools/convert_assets.py --output ./offline-rebuild`。也可繼續以 `--source ../upstream-order-to-cook` 指向上述提交的完整本機 checkout。轉換器優先讀取來源目錄內 `UPSTREAM.json` 的 commit；沒有此檔才讀取該 checkout 的 Git HEAD，避免將本移植的提交誤記為上游版本。

轉換器只讀取本機上游內容，不執行 Java、Gradle 或上游腳本。它寫入 `runtime/BP` 的方塊、物品、實體、配方及掉落表，以及 `runtime/RP` 的資源；不覆寫兩個 pack manifest 或 Script API 程式。`--output` 可選另一個輸出目錄。相同來源和工具版本可重現相同輸出。

Pillow 用於把四張原始爐火畫格縱向拼接、車燈的 alpha 編碼轉換、組合用餐餐盤的單張 atlas，以及把原始模型投影成物品欄縮圖。餐盤 atlas 按原像素複製並外擴邊緣；縮圖加入一般面向明暗，沒有重繪物件。獨立的原始 PNG 仍完整保留，便於後續修正渲染。

## 原素材盤點與使用情況

固定提交的共用資源包含 140 個 Java 模型 JSON、9 個 GeckoLib geometry JSON、11 個動畫檔（36 個動畫片段）、67 張 PNG 紋理、12 個 OGG、13 個 blockstate JSON 和 2 份語言檔。平台目錄中的重複資源不再另打包。

| 資源 | Bedrock 實作 |
|---|---|
| 全部 67 張紋理 | 原檔複製到 `RP/textures/ordertocook/`，包括 block、item、entity、gui；GUI 圖集保留但原 Java GUI 沒有直接套用到表單 |
| 全部 12 個 OGG | 原檔複製；由 `RP/sounds/sound_definitions.json` 註冊 11 個 `ordertocook:` 音效事件 |
| 9 個原始 geometry | 正規化格式與識別碼，保存在 `RP/models/entity/imported/`；活躍模型使用另行註冊的明確識別碼 |
| 36 個原始動畫片段 | 正規化後全部保留；顧客接線 8 個等待／坐姿片段與 7 個 action；冰箱及洗碗機的原關鍵幀另取樣成方塊姿態 |
| Java 家具／餐盤模型 | 解析 parent、元素、旋轉與逐面 UV，合成 184 個方塊 geometry，覆蓋 12 個功能方塊的外形與狀態 |
| 用餐餐盤 helper | 另有 41 個 entity geometry，依原 `food_plate_display` stage 對照產生；stage 0 改用原乾淨盤，逐面 UV 映射到 256×256 單張 atlas |
| 電單車 | 從原 Java `CubeListBuilder`／`PartPose` 轉出 16 個骨骼、41 個立方體，保留原 128×128 紋理座標 |
| 白／紅／藍／黃車身 | 使用原 `motorcycle` 及三張 `electric_motorcycle_*` 紋理，依實體 color property 切換 |
| 車燈 | 原燈光 RGB 和透明遮罩保留；另輸出 TGA，把非零 alpha 設成 64 以編碼 Bedrock emissive 強度，再以原生材質疊加；不會照亮周圍地形 |
| 頭盔 | 原 20 個元素轉成外殼與透明護目鏡兩個 geometry，以 attachable 綁到頭部；保留原兩張紋理 |
| 物品圖示 | 原硬幣、訂單與升級工具箱圖示直接引用；盤、袋、車、頭盔使用原模型渲染的縮圖；指南及控制器共用訂單圖示 |
| 語言 | 保留英語及簡體原名稱，轉為 Bedrock 鍵名，另加繁體中文及移植新增物品名稱 |

物品 JSON 共 15 個；其餘家具物品由 Bedrock 方塊自動產生。模型共有 240 個 geometry 識別碼，包括 184 個方塊 geometry、41 個用餐餐盤 geometry、顧客／車輛／頭盔、隱形輔助實體與上游 geometry 存檔。原 67 張 PNG 與 12 個 OGG 仍逐檔保留，衍生 atlas、flipbook、縮圖及 TGA 不計入這些原檔數量。

Java 模型中的 item display transform、predicate override，以及未綁定的頭盔顏色／騎行變體不會被 Bedrock 自動解讀。保留相關原始紋理不代表所有 Java 物品顯示方式均已重現。

## 幾何與動畫轉換

### Java 模型

每個 `parent` 層的元素和 texture alias 在轉換時解析。以 Java 模型中心 `(8, 0, 8)` 為基準，反射 X 軸得到 Bedrock 座標；旋轉支點作相同變換，X／Y 旋轉取反，Z 旋轉保留。`rescale` 依旋轉角的餘弦補償垂直於旋轉軸的尺寸。逐面 UV 保留 Java 的 16 單位座標，頂面／底面的 UV 端點依 Bedrock 面向調整，90 度 UV 旋轉保留。

geometry 統一使用 `1.21.0` 格式，以支援原作已使用的逐面 `uv_rotation`。方塊各面的 `material_instance` 對應 terrain atlas 中的原始紋理；用餐餐盤 entity 則改寫為單張實體 atlas 的 UV，不能沿用方塊的逐面紋理選擇。方塊定義使用 `1.21.100`，同時提供 geometry 和 material_instances。

參考：[官方 geometry 1.21 格式](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/geometry.v1.21.0?view=minecraft-bedrock-stable)、[方塊 geometry 元件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_geometry?view=minecraft-bedrock-stable)、[Blockbench 的 Bedrock exporter](https://github.com/JannisX11/blockbench/blob/master/js/formats/bedrock/bedrock.js)。轉換器為本移植的實作，沒有把第三方 exporter 程式碼打包到遊戲中。

### 冰箱

原冰箱高 32 像素；Bedrock 自訂方塊幾何有尺寸邊界，因此把櫃體在 `y = 16` 分成上下兩個真正方塊。切到的垂直面按比例裁切原 UV，移除人造切面的內側面，上半部幾何和支點下移 16。兩個原始內壁立方體帶有負 Z 尺寸，轉換器調整原點並改成正尺寸；內壁貼圖方向仍列入客戶端驗收。

原下門跨越上下格的分界。alpha.2 把整扇下門留在下半 geometry，最高到 Y=19.5，上半 geometry 只擁有上門；櫃體仍分格。如此上下門可以各自開合而不在 Y=16 斷裂，不需讓上門狀態跟著下門改變。儲物仍分上層 27 格、下層 54 格。

`refrigerator.animation.json` 的 `up_open`／`down_open` 分別在 0–1 秒取 11 個姿態，保留原 −135°／−125° 終點與支點。各半 `frame` 為 0–10，服務端依該分區觀看者推進或反向收回。原門片寬 16、厚 2 像素，部分中間角度的旋轉範圍略超過 30 像素；轉換器只平移該姿態的整扇門，最大 0.125 像素，保持原尺寸、UV、角度及兩個端點。每個輸出姿態均檢查旋轉後邊界。

這是有限線性取樣，沒有保留 GeckoLib easing、關門機身擠壓／回彈或打開後的內部食品陳列。動畫的來源與每個衍生姿態都記入 conversion manifest，沒有另畫門模型。

參考：[官方自訂方塊幾何邊界](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblockoversized?view=minecraft-bedrock-stable)。

### 洗碗機

洗碗機使用原模型的門、抽屜及乾淨／髒盤骨骼，對應原 Java 的 6 個 phase。alpha.2 由 `dishwasher.animation.json` 烘焙 **66 個姿態**：empty_in、dirty_in、washing、clear_out 四個活動 phase 各 16 個，加 idle／clear_ready 兩個端點。保留骨骼階層的剛體位移／旋轉、盤子均勻縮放與原洗滌抖動；原關鍵幀中的非均勻機身 squash/stretch 不輸出。最終抽屜 Z 位移 −12、抽屜組旋轉 5°、門角度 92.5° 來自原片段。

`phase` 與 `frame` 分開，`frame` 0–15 從持久化的剩餘 tick 計算。洗滌在超過 8 盤時重複原 40 tick 循環，容量、計時、取出及存檔由 BP script 負責。轉換器線性取樣原關鍵幀，對來源唯一使用的 `math.sin` 位移作限定求值，不執行任意 Molang 或 Java 程式。5 個原片段仍保留，`empty_out` 的準星預覽開門尚未接線；有限方塊姿態並非每一幀 GeckoLib renderer。

### 餐盤、架子和打單機

餐盤架保留 0–18 盤、包裝架保留 0–10 份包材、洗碗檯保留 0–10 盤的原 multipart 外形。`food_plate_display` 方塊與用餐 helper 都保留原 40 個食物／進食階段；stage 0 在 Java 是空 geometry，另有短暫放盤渲染，本移植改用原乾淨盤模型，方便辨識起始段。

用餐時的 `ordertocook:dining_plate` 是獨立的外觀實體，41 個 geometry 由同一個 client render controller 選取。它使用單張 `dining_plate_atlas.png`，避免把方塊的 per-face material instance 誤當成 entity 可用的多紋理綁定：

| 原紋理 | 原尺寸 | 256×256 atlas 內左上角 | UV 處理 |
| --- | --- | --- | --- |
| `block/food_plate_variants.png` | 160×160 | (2, 2) | Java 16 單位 UV 按原實際寬高縮放，再加 atlas 偏移 |
| `item/clean_plate.png` | 64×64 | (166, 2) | 同上；保留逐面 UV 旋轉與負向 UV 尺寸 |

來源像素逐一複製，各邊額外延伸 2 像素降低相鄰取樣串色；沒有重繪、重新著色或把多張圖直接當成 entity 材質別名。餐盤以底部 Y=0、XZ 中心為原點，方向由腳本旋轉，放置高度另留少量偏移以降低桌面 z-fighting。幾何和 atlas 離線比對可以核對座標與像素，**不能證明客戶端渲染、透明排序及遠距取樣已正確**。

helper 無庫存、重力、物理碰撞或自動掉落。`minecraft:custom_hit_test` 設定寬 0.8、高 0.2、中心 `[0, 0.1, 0]`；[官方元件說明](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_custom_hit_test?view=minecraft-bedrock-stable)描述近戰／遠程命中，不能據此推定所有右鍵與觸控互動。腳本也支援點支撐桌面收盤，兩種入口均需實機驗收。

進食約 5 秒後，第四階段髒盤留在原位直到店主／員工領取；沒有顯示實體自動掉一個髒盤的規則。權威記錄在 `restaurant.pendingDishes`，領取先保存 claim，再由腳本給一個 `dirty_plate`，因此重建 helper 或重複 visual ID 不應再次發盤。提前收盤、同一位置舊盤阻擋新餐及重啟邊界見 [RUNTIME_ADAPTATIONS.md](RUNTIME_ADAPTATIONS.md#餐盤進食收盤與付款)。

打單機使用原三個紙張位置，由 `mode`、`frame` 切換列印狀態；原 `neworder` GeckoLib 片段保留但沒有直接作為方塊動畫播放。爐火則使用原四張畫格製成 Bedrock flipbook。

### 顧客、騎乘與保留片段

顧客使用原 `drive_idle`／`drive_idle_alex` 骨架及兩張預設顧客皮膚。等待與坐姿各有 4 個原片段，按照獨立的 `ordertocook:animation_variant` 1–4 選擇，原機率為 55／15／15／15；`ordertocook:action` 0–7 另選無特殊動作、坐姿／站立生成、坐姿／站立取餐、爆炸進食、普通進食及中斷離場。7 個 action 直接對應原片段，不再用 action 取餘數混作 idle 變體。進食分別保留 6 秒 `npc_eat&boom` 與 5.5 秒 `npc_eat&scale` 的名義長度。

顧客服務端 movement 為 0，符合原直接生成的預設；沒有加一條原作不存在的入店行走。動作完成由已保存的時序控制，客戶端重載沒有按已過時間 seek 片段，可能重播當前動作開頭，服務端原離場時間不因此延後。

電單車輪子另以移動距離驅動轉動。車燈採原生 `entity_emissive_alpha`，原 Java 燈光的 9 個像素轉為較低 alpha，RGB 不變；[官方材質文件](https://learn.microsoft.com/en-us/minecraft/creator/documents/material-files?view=minecraft-bedrock-stable)說明此材質以 alpha 決定發光程度。實際亮度仍需客戶端確認。

GeckoLib 的 `{ "vector": [...] }` 包裝轉為原生向量，識別碼中的 `&` 等字元正規化。GeckoLib 專用 `easing`／`easingArgs` 刪除，保留關鍵姿態、時間以及 Bedrock 的 linear／catmullrom 插值。來源洗碗動畫引用未定義的粒子效果 `3`，此孤立粒子事件不輸出。

以下原片段仍只保存，沒有直接接線：玩家坐姿與拍手、玩家刷盤、5 個騎車姿勢／喇叭動作、餐盤／外賣袋放置、打單機及爐灶的完整 GeckoLib 動作。冰箱和洗碗機動畫來源則已參與上述姿態烘焙，不能再把它們描述成完全未使用；保留的動畫 JSON 本身沒有作為方塊動畫逐幀播放。玩家仍使用原生騎乘姿態；本包沒有覆寫 `player.entity.json` 或全域玩家動畫。線上下載玩家皮膚及女僕模組替換不在本包實作範圍內。

## Block state 與實體契約

所有自訂狀態採 `ordertocook:` 前綴。方塊有 `minecraft:cardinal_direction` 放置 trait；朝向與模型的旋轉集中在 BP permutations。

| 方塊 | 狀態／邏輯範圍 |
|---|---|
| order_machine | `mode`: idle／printing／waiting；`frame`: 0–2 |
| shelf | `papers`: 0–10 |
| plate_shelf | `plates` + 16 × `plates_high`: 0–18 |
| washingtable | `plates`: 0–10 |
| food_plate_display | `stage` + 16 × `stage_high`: 0–40 |
| dishwasher | `phase`: 0–5；`frame`: 0–15；`plates` + 16 × `plates_high`: 0–16 |
| refrigerator | `half`: lower／upper；`open`: false／true；`frame`: 0–10 |
| stove | `lit`: false／true |

超過 16 個值的整數狀態拆成低位與高位，以免單一 block state 超出允許值數。`plates_high` 是布林值，`stage_high` 是 0–2；真實數量仍由 script 保存。盤數 16 必須寫低位 0、高位 true，不能寫低位 15、高位 true。未使用的高低位組合不由 script 產生。

顧客的 stage、皮膚 variant、animation_variant 1–4、action 0–7，以及電單車的 color／light 是同步到客戶端的 entity property。用餐餐盤的 `ordertocook:stage` 是 **entity int property 0–40**，不需要拆高低位；它與 `food_plate_display` 方塊的兩個 state 編碼不可混用。storage／seat 是無重力、無碰撞、不可受傷的隱形持久實體；storage 具 81 格真正 inventory，motorcycle 具 54 格真正 inventory。customer、motorcycle、storage、seat、dining_plate 五種實體均提供 `ordertocook:despawn` 事件供 script 清理。

所有功能方塊註冊 `ordertocook:interact` v2 元件。可使用的訂單、指南、控制器、料理、袋、機車、工具箱物品使用 `ordertocook:use` v2 元件，統一由 script 的 custom onUse 處理；不能只依賴 `use_modifiers` 自動形成可用動作。帶訂單身份的物品最大堆疊為 1。外賣袋及餐盤展示方塊的原生掉落表為空，由 script 返還含身份的實際物品，避免生成額外的無身份成品。

## Bedrock 生存合成適配

原作設備取得依賴額外商店／遊戲環境。為使本包可以從生存模式開局，新增以下 9 個工作台配方；它們是本移植的遊戲性適配。所有配方使用 `AlwaysUnlocked` 讓配方書可見，仍須支付表列材料。

| 產物 | 數量 | 材料 |
|---|---:|---|
| 指南 | 1 | 書 ×1、紙 ×1 |
| 打單機 | 1 | 鐵錠 ×6、紙 ×2、紅石 ×1 |
| 立牌 | 1 | 紙 ×3、木棒 ×3 |
| 料理檯 | 2 | 鐵錠 ×3、橡木木板 ×3 |
| 包裝架 | 1 | 橡木木板 ×3、木棒 ×3 |
| 餐盤架 | 1 | 橡木木板 ×2、鐵錠 ×3 |
| 洗碗檯 | 1 | 鐵錠 ×4、空桶 ×1、橡木木板 ×3 |
| 椅子 | 2 | 橡木木板 ×4、木棒 ×2 |
| 乾淨餐盤 | 4 | 石英 ×3 |

第 10 個是原工具箱配方：100 面額廚師幣 ×1、金錠 ×4、紅石方塊 ×1、鎖鏈 ×1。高階家電透過工具箱升級原設備。訂單、已打包外賣和裝盤料理沒有合成配方。

## 驗證的界線

轉換產物以 JSON 解析、geometry／紋理／掉落引用、方塊狀態值數、旋轉後幾何邊界及資源雜湊檢查；新姿態與餐盤 atlas 另有來源角度／像素映射及離線重產比對。各版實際執行結果集中於 [VALIDATION.md](VALIDATION.md)，不以源檔存在推定特定客户端會正確顯示。

專用服務端不渲染 RP，因此服務端能載入不等於視覺已通過客戶端驗收。仍需在 Bedrock 客戶端檢查所有朝向的逐面 UV、獨立冰箱門、洗碗機中間姿態、41 階段餐盤 entity atlas、頭盔位置與透明面、電單車騎乘和輪軸、顧客各動畫／皮膚、四格爐火、聲音及觸控／控制器互動。真實客戶端、表單與觸控驗收均尚未完成，清單見 [PLAYTEST.md](PLAYTEST.md)。
