# 素材來源、轉換方式與視覺限制

本移植使用 Order To Cook 上游的模型、紋理、動畫與音效。家具、餐盤、外賣袋、頭盔與電單車的外形均來自原始資源；沒有以新畫的方塊、替代圖示或 AI 圖像取代原作。

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

Pillow 僅用於把四張原始爐火畫格縱向拼接、車燈的 alpha 編碼轉換，以及把原始模型投影成物品欄縮圖。紋理採樣保留原圖像素，縮圖加入一般面向明暗；沒有重繪物件。獨立的原始 PNG 仍完整保留，便於後續修正渲染。

## 原素材盤點與使用情況

固定提交的共用資源包含 140 個 Java 模型 JSON、9 個 GeckoLib geometry JSON、11 個動畫檔（36 個動畫片段）、67 張 PNG 紋理、12 個 OGG、13 個 blockstate JSON 和 2 份語言檔。平台目錄中的重複資源不再另打包。

| 資源 | Bedrock 實作 |
|---|---|
| 全部 67 張紋理 | 原檔複製到 `RP/textures/ordertocook/`，包括 block、item、entity、gui；GUI 圖集保留但原 Java GUI 沒有直接套用到表單 |
| 全部 12 個 OGG | 原檔複製；由 `RP/sounds/sound_definitions.json` 註冊 11 個 `ordertocook:` 音效事件 |
| 9 個原始 geometry | 正規化格式與識別碼，保存在 `RP/models/entity/imported/`；活躍模型使用另行註冊的明確識別碼 |
| 36 個原始動畫片段 | 正規化後全部保留；目前顧客實際接線 8 個等待／坐姿動畫及 `npc_eat&scale` |
| Java 家具／餐盤模型 | 解析 parent、元素、旋轉與逐面 UV，合成 106 個方塊 geometry，覆蓋 12 個功能方塊的外形與狀態 |
| 電單車 | 從原 Java `CubeListBuilder`／`PartPose` 轉出 16 個骨骼、41 個立方體，保留原 128×128 紋理座標 |
| 白／紅／藍／黃車身 | 使用原 `motorcycle` 及三張 `electric_motorcycle_*` 紋理，依實體 color property 切換 |
| 車燈 | 原燈光 RGB 和透明遮罩保留；另輸出 TGA，把非零 alpha 設成 64 以編碼 Bedrock emissive 強度，再以原生材質疊加；不會照亮周圍地形 |
| 頭盔 | 原 20 個元素轉成外殼與透明護目鏡兩個 geometry，以 attachable 綁到頭部；保留原兩張紋理 |
| 物品圖示 | 原硬幣、訂單與升級工具箱圖示直接引用；盤、袋、車、頭盔使用原模型渲染的縮圖；指南及控制器共用訂單圖示 |
| 語言 | 保留英語及簡體原名稱，轉為 Bedrock 鍵名，另加繁體中文及移植新增物品名稱 |

物品 JSON 共 15 個；其餘家具物品由 Bedrock 方塊自動產生。模型共有 121 個 geometry 識別碼，包括 106 個方塊 geometry、顧客／車輛／頭盔、隱形輔助實體與上游 geometry 存檔。

Java 模型中的 item display transform、predicate override，以及未綁定的頭盔顏色／騎行變體不會被 Bedrock 自動解讀。保留相關原始紋理不代表所有 Java 物品顯示方式均已重現。

## 幾何與動畫轉換

### Java 模型

每個 `parent` 層的元素和 texture alias 在轉換時解析。以 Java 模型中心 `(8, 0, 8)` 為基準，反射 X 軸得到 Bedrock 座標；旋轉支點作相同變換，X／Y 旋轉取反，Z 旋轉保留。`rescale` 依旋轉角的餘弦補償垂直於旋轉軸的尺寸。逐面 UV 保留 Java 的 16 單位座標，頂面／底面的 UV 端點依 Bedrock 面向調整，90 度 UV 旋轉保留。

geometry 統一使用 `1.21.0` 格式，以支援原作已使用的逐面 `uv_rotation`。各面的 `material_instance` 對應 terrain atlas 中的原始紋理。方塊定義使用 `1.21.100`，同時提供 geometry 和 material_instances。

參考：[官方 geometry 1.21 格式](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/geometry.v1.21.0?view=minecraft-bedrock-stable)、[方塊 geometry 元件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_geometry?view=minecraft-bedrock-stable)、[Blockbench 的 Bedrock exporter](https://github.com/JannisX11/blockbench/blob/master/js/formats/bedrock/bedrock.js)。轉換器為本移植的實作，沒有把第三方 exporter 程式碼打包到遊戲中。

### 冰箱

原冰箱高 32 像素；Bedrock 自訂方塊幾何有尺寸邊界，因此在 `y = 16` 分為上下兩個真正方塊。切到的垂直面按比例裁切原 UV，移除人造切面的內側面，上半部幾何和支點下移 16。兩個原始內壁立方體帶有負 Z 尺寸，轉換器調整原點並改成正尺寸；內壁貼圖方向仍列入客戶端驗收。

原下門跨越上下格的分界。首版將上下門的 `open` 狀態同步，使分割後的門保持對齊；儲物仍分上層 27 格、下層 54 格。開／關直接切換原門角度的姿態，沒有播放 Java 的獨立門過渡動畫。

參考：[官方自訂方塊幾何邊界](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblockoversized?view=minecraft-bedrock-stable)。

### 洗碗機、餐盤和打單機

洗碗機使用原模型的門、抽屜及乾淨／髒盤骨骼，對應原 Java 的 6 個 phase。出盤姿態將抽屜移出並打開門；其他 phase 切換盤子可見性。實際計時、16 盤容量與物品轉移由 BP script 處理，RP 現在顯示階段姿態。5 個原洗碗機動畫片段雖已轉換並保存，尚未逐幀驅動方塊；不能把功能 phase 支援等同原版完整機械動畫。

餐盤架保留 0–18 盤、包裝架保留 0–10 份包材、洗碗檯保留 0–10 盤的原 multipart 外形。裝盤料理保留原 40 個食物／吃食階段；stage 0 在 Java 是空 geometry，本移植改為可見乾淨餐盤，方便辨識空盤。吃完的髒盤由 script 返還原 dirty_plate 物品。

打單機使用原三個紙張位置，由 `mode`、`frame` 切換列印狀態；原 `neworder` GeckoLib 片段保留但沒有直接作為方塊動畫播放。爐火則使用原四張畫格製成 Bedrock flipbook。

### 顧客、騎乘與尚未使用的片段

顧客使用原 `drive_idle`／`drive_idle_alex` 骨架及兩張預設顧客皮膚。等待與坐姿各有 4 個原片段，按照 `ordertocook:action` 選擇；用餐使用原 5.5 秒 `npc_eat&scale`。電單車輪子另以移動距離驅動轉動。車燈採原生 `entity_emissive_alpha`，原 Java 燈光的 9 個像素轉為較低 alpha，RGB 不變；[官方材質文件](https://learn.microsoft.com/en-us/minecraft/creator/documents/material-files?view=minecraft-bedrock-stable)說明此材質以 alpha 決定發光程度。實際亮度仍需客戶端確認。

GeckoLib 的 `{ "vector": [...] }` 包裝轉為原生向量，識別碼中的 `&` 等字元正規化。GeckoLib 專用 `easing`／`easingArgs` 刪除，保留關鍵姿態、時間以及 Bedrock 的 linear／catmullrom 插值。來源洗碗動畫引用未定義的粒子效果 `3`，此孤立粒子事件不輸出。

以下原動畫目前只保存，沒有在運行時接線：玩家坐姿與拍手、玩家刷盤、5 個騎車姿勢／喇叭動作、餐盤／外賣袋放置、打單機、冰箱、爐灶、洗碗機，以及其餘 6 個顧客過渡動畫。玩家仍使用原生騎乘姿態；本包沒有覆寫 `player.entity.json` 或全域玩家動畫。線上下載玩家皮膚及女僕模組替換不在本包實作範圍內。

## Block state 與實體契約

所有自訂狀態採 `ordertocook:` 前綴。方塊有 `minecraft:cardinal_direction` 放置 trait；朝向與模型的旋轉集中在 BP permutations。

| 方塊 | 狀態／邏輯範圍 |
|---|---|
| order_machine | `mode`: idle／printing／waiting；`frame`: 0–2 |
| shelf | `papers`: 0–10 |
| plate_shelf | `plates` + 16 × `plates_high`: 0–18 |
| washingtable | `plates`: 0–10 |
| food_plate_display | `stage` + 16 × `stage_high`: 0–40 |
| dishwasher | `phase`: 0–5；`plates` + 16 × `plates_high`: 0–16 |
| refrigerator | `half`: lower／upper；`open`: false／true |
| stove | `lit`: false／true |

超過 16 個值的整數狀態拆成低位與高位，以免單一 block state 超出允許值數。`plates_high` 是布林值，`stage_high` 是 0–2；真實數量仍由 script 保存。盤數 16 必須寫低位 0、高位 true，不能寫低位 15、高位 true。未使用的高低位組合不由 script 產生。

顧客的 stage、variant、action，以及電單車的 color／light 是同步到客戶端的 entity property。storage／seat 是無重力、無碰撞、不可受傷的隱形持久實體；storage 具 81 格真正 inventory，motorcycle 具 54 格真正 inventory。所有四種實體的 `ordertocook:despawn` 事件供 script 清理使用。

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

轉換產物經 JSON 解析、geometry／紋理／掉落引用、方塊狀態值數、旋轉後幾何邊界與資源雜湊檢查。服務端的 schema 載入檢查已協助修正 damage_sensor 使用字串 `"no"` 以及 1.20.10 配方的 unlock 資料。

專用服務端不渲染 RP，因此服務端能載入不等於所有視覺已通過客戶端驗收。仍需在 Bedrock 客戶端檢查所有朝向的逐面 UV、分格冰箱開門、頭盔位置與透明面、電單車騎乘和輪軸、顧客各動畫／皮膚、四格爐火、聲音及觸控／控制器互動。完整運行與測試記錄以主 README 和測試文件為準。
