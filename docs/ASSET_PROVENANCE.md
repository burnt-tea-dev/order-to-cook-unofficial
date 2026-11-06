# 素材來源、轉換方式與視覺限制

本文件記錄 **0.1.6-alpha.1 視覺／音效候選來源**的轉換方式；修正證據與驗證結果見 [VISUAL_AUDIO_PARITY.md](VISUAL_AUDIO_PARITY.md)。本移植使用 Order To Cook 上游的模型、紋理、動畫與音效。家具、餐盤、外賣袋、頭盔與電單車的外形均來自原始資源，未以 AI 圖像取代原作。保留源檔不代表片段已由玩法觸發，也不能代替本候選尚未執行的 Blockbench 互動檢視及 Java／Bedrock 客戶端畫面驗收。

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

上游 README 明確聲明程式碼採 GPL v3；這足以記錄程式碼的上游授權聲明，但不能自動證明每張貼圖、模型、音效、動畫或翻譯的完整權利鏈。固定提交的素材目錄未找到獨立排除文件，但「沒有找到排除」不等於權利鏈已證實。補充素材範圍詢問依本倉庫目前的[素材登記](ASSET_LICENSE_REGISTER.md)及[發布政策](RELEASE_COMPLIANCE.md)記為 `PENDING_RIGHTS_HOLDER_CONFIRMATION`，**本身不阻止開發、測試候選或發布，也不改稱已取得確認**。原署名、GPL、完整對應來源與雜湊繼續保留；具體已知衝突另行處理。原 Java JAR、GeckoLib 二進位檔與 Minecraft 遊戲資產不包含在本地候選包中。

`runtime/asset_conversion_manifest.json` 記錄每個輸入檔的來源路徑、SHA-256、輸出路徑與操作。單一來源可產生多個輸出，同一輸出也可結合多個原始模型，因此條目數不等於獨立素材數。原始 PNG 和 OGG 的 `copy` 條目可直接比對原檔雜湊；衍生 geometry 和縮圖則記錄其模型來源及轉換操作。

## 轉換器與重現

本倉庫的 `upstream/reference/` 隨附上述固定提交的可編輯來源子集：完整的共用 `assets/ordertocook/` 目錄、原工具箱配方、`MotorcycleModel.java` 及上游 `LICENSE.txt`。來源原檔未修改；`upstream/reference/UPSTREAM.json` 記錄提交、作者、授權及子集範圍。它包含轉換器需要的全部上游輸入，因此重產不依賴日後仍可存取的外部下載，也不需要 Java JAR 或完整 Java 建置。

使用本倉庫的 `tools/convert_assets.py`；預設來源就是隨附子集。安裝一次 Pillow 後，資源轉換可以離線執行：

```sh
python -m pip install Pillow==12.3.0
python tools/convert_assets.py
```

若要在獨立目錄驗證產物，使用 `python tools/convert_assets.py --output ./offline-rebuild`。也可繼續以 `--source ../upstream-order-to-cook` 指向上述提交的完整本機 checkout。轉換器優先讀取來源目錄內 `UPSTREAM.json` 的 commit；沒有此檔才讀取該 checkout 的 Git HEAD，避免將本移植的提交誤記為上游版本。

轉換器只讀取本機上游內容，不執行 Java、Gradle 或上游腳本。它寫入 `runtime/BP` 的方塊、物品、實體、配方、掉落表與生成的 `scripts/appliance_pose_data.js` 姿態資料，以及 `runtime/RP` 資源；不覆寫兩個 pack manifest 或手寫的服務程式。`--output` 可選另一個輸出目錄。相同來源和工具版本可重現相同輸出。

Pillow 用於把四張原始爐火畫格縱向拼接、車燈的 alpha 編碼轉換、組合用餐餐盤的單張 atlas，以及把原始模型投影成物品欄縮圖。餐盤 atlas 按原像素複製並外擴邊緣；縮圖加入一般面向明暗，沒有重繪物件。獨立的原始 PNG 仍完整保留，便於後續修正渲染。

## 原素材盤點與使用情況

固定提交的共用資源包含 140 個 Java 模型 JSON、9 個 GeckoLib geometry JSON、11 個動畫檔（36 個動畫片段）、67 張 PNG 紋理、12 個 OGG、13 個 blockstate JSON 和 2 份語言檔。平台目錄中的重複資源不再另打包。

| 資源 | Bedrock 實作 |
|---|---|
| 全部 67 張紋理 | 原檔複製到 `RP/textures/ordertocook/`，包括 block、item、entity、gui；GUI 圖集保留但原 Java GUI 沒有直接套用到表單 |
| 全部 12 個 OGG | 原檔複製；由 `RP/sounds/sound_definitions.json` 註冊 11 個 `ordertocook:` 音效事件 |
| 9 個原始 geometry | 正規化格式與識別碼，保存在 `RP/models/entity/imported/`；活躍模型使用另行註冊的明確識別碼 |
| 36 個原始動畫片段 | 正規化後全部保留；顧客使用 8 個等待／坐姿及 7 個 action，餐盤使用原放置片段；冰箱、洗碗機、打單機及外賣袋另從來源動畫取樣方塊姿態 |
| Java／Geo 家具及餐盤模型 | 解析元素、旋轉與逐面 UV，生成 241 個方塊 geometry，覆蓋 12 類方塊；數量只記錄輸出規模，不作還原完成證據 |
| 用餐餐盤 helper | 41 個 entity geometry；stage 0 使用原放盤食物 Geo 與動畫，stage 1–40 按原 blockstate 映射，逐面 UV 寫入 256×256 原像素 atlas |
| 電單車 | 從原 Java `CubeListBuilder`／`PartPose` 轉出 16 個骨骼、41 個立方體，保留原 128×128 紋理座標 |
| 白／紅／藍／黃車身 | 使用原 `motorcycle` 及三張 `electric_motorcycle_*` 紋理，依實體 color property 切換 |
| 車燈 | 原燈光 RGB 和透明遮罩保留；另輸出 TGA，把非零 alpha 設成 64 以編碼 Bedrock emissive 強度，再以原生材質疊加；不會照亮周圍地形 |
| 頭盔 | 原 20 個元素轉成外殼與透明護目鏡兩個 geometry，以 attachable 綁到頭部；保留原兩張紋理 |
| 物品圖示 | 原硬幣、訂單與升級工具箱圖示直接引用；盤、袋、車、頭盔使用原模型渲染的縮圖；指南用自有像素書圖示，控制器引用訂單圖示；指南設備縮圖沿原料理檯／冰箱／爐灶模型生成，不用UV展開圖 |
| 語言 | 保留英語及簡體原名稱，轉為 Bedrock 鍵名，另加繁體中文及移植新增物品名稱 |

物品JSON與geometry識別碼的目前數量由 [資源檢查器](../tools/validate_pack.py) 從實際定義輸出；其餘家具物品由Bedrock方塊自動產生。逐檔來源與生成操作查 [轉換清單](../runtime/asset_conversion_manifest.json)。原始PNG與OGG保留；衍生atlas、flipbook、縮圖及TGA不當作原檔。

`tools/validate_pack.py` 對方塊引用的geometry檢查實際非零面積，不以cube數量當成有效網格；零尺寸cube雖可解析且有一筆資料，仍沒有面。這保留可有面積的薄片，並攔截本次客戶端回報的全零模型。原生實體故意不可見的骨架沿原用途保留。回歸直接把實際全零輸入送進真正的檢查器，確認它拒絕，而不修改生成產物或LIVE。

Java 模型中的 item display transform、predicate override，以及未綁定的頭盔顏色／騎行變體不會被 Bedrock 自動解讀。保留相關原始紋理不代表所有 Java 物品顯示方式均已重現。

## 幾何與動畫轉換

### Java 模型

每個 `parent` 層的元素和 texture alias 在轉換時解析。以 Java 模型中心 `(8, 0, 8)` 為基準，反射 X 軸得到 Bedrock 座標；旋轉支點作相同變換，X／Y 旋轉取反，Z 旋轉保留。`rescale` 依旋轉角的餘弦補償垂直於旋轉軸的尺寸。逐面 UV 保留 Java 的 16 單位座標，頂面／底面的 UV 端點依 Bedrock 面向調整，90 度 UV 旋轉保留。

geometry 統一使用 `1.21.0` 格式，以支援原作已使用的逐面 `uv_rotation`。方塊各面的 `material_instance` 對應 terrain atlas 中的原始紋理；用餐餐盤 entity 則改寫為單張實體 atlas 的 UV，不能沿用方塊的逐面紋理選擇。方塊定義使用 `1.21.100`，同時提供 geometry 和 material_instances。

12 類方塊均以 Java north／east／south／west 的 0／90／180／270° 對應 Bedrock 0／−90／180／90°；放置 trait 的 180° 偏移對應 Java 放在玩家朝向的反面。原 Geo 中的負尺寸另按實際面位置交換面與 UV 方向，不能只把尺寸取絕對值，也不能把這個修正誤套到已反射 X 的 Java 元素轉換。來源有 4 個此類立方體，測試逐一比對四方向的頂點與 UV 組合。

參考：[官方 geometry 1.21 格式](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/geometry.v1.21.0?view=minecraft-bedrock-stable)、[方塊 geometry 元件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_geometry?view=minecraft-bedrock-stable)、[Blockbench 的 Bedrock exporter](https://github.com/JannisX11/blockbench/blob/master/js/formats/bedrock/bedrock.js)。轉換器為本移植的實作，沒有把第三方 exporter 程式碼打包到遊戲中。

### 冰箱

原冰箱高 32 像素；Bedrock 自訂方塊幾何有尺寸邊界，因此把櫃體在 `y = 16` 分成上下兩個真正方塊。切到的垂直面按比例裁切原 UV，移除人造切面的內側面，上半部幾何和支點下移 16。兩個原始內壁立方體帶有負 Z 尺寸；候選同步調整原點、面位置和 UV 方向，修正舊轉換把不透明背板貼到開口的問題，原材質像素不變。

原下門跨越上下格的分界。alpha.2 把整扇下門留在下半 geometry，最高到 Y=19.5，上半 geometry 只擁有上門；櫃體仍分格。如此上下門可以各自開合而不在 Y=16 斷裂，不需讓上門狀態跟著下門改變。儲物仍分上層 27 格、下層 54 格。

`refrigerator.animation.json` 的上下門 open／close 四段各在 0–1 秒取 11 個姿態，共 **44 個**，保留原 −135°／−125° 開門終點、Elastic 開門、帶 `easingArgs=[0.1]` 的 Bounce 關門與關門機身縮放。採用固定 GeckoLib 4 的實際公式，並非用另一套同名曲線猜測。各半 `frame` 為 0–10，`closing` 選擇活動片段；途中反轉倒播當前片段，端點才改用原另一段。部分中間姿態對完整門片平移不足 0.126 像素以符合原生邊界，保持尺寸、UV、角度及端點。全部生成模型另以四方向及 Float32 運算檢查邊界。

非均勻縮放完整作用於子部件，再用最接近的靜態立方體表示無法直接輸出的剪切；取樣測試的冰箱最大頂點殘差約 0.087 像素。仍缺上下層各最多 8 件食品陳列，且 Java 關門壓縮整座櫃體，本版只有各自分區跟隨自己的關門片段。有限取樣及分區共用櫃體的差異仍須實機驗收。來源和每個衍生姿態均記入 conversion manifest，沒有另畫門模型。

參考：[官方自訂方塊幾何邊界](https://learn.microsoft.com/en-us/minecraft/creator/documents/customblockoversized?view=minecraft-bedrock-stable)、[固定 GeckoLib 曲線實作](https://github.com/bernie-g/geckolib/blob/7d6f32db9168a24e14b327c0ad9f8f87dfc204de/core/src/main/java/software/bernie/geckolib/core/animation/EasingType.java)。

### 洗碗機

洗碗機使用原模型的門、抽屜及乾淨／髒盤骨骼，對應 Java 的 6 個工作 phase；另用只影響畫面的 phase 6 表示 `empty_out` 預覽。候選共有 **82 個姿態**：empty_in、dirty_in、washing、clear_out、empty_out 五段各 16 個，加 idle／clear_ready 端點。保留來源 easing、非均勻機身縮放、子部件位移／旋轉及洗滌抖動；旋轉子部件剪切用最接近的立方體近似，取樣最大頂點殘差約 0.260 像素。最終抽屜 Z 位移 −12、抽屜組旋轉 5°、門角度 92.5° 來自原片段。

`phase` 與 `frame` 分開，工作姿態的 frame 0–15 從持久化剩餘 tick 計算；超過 8 盤時重複原 40 tick 洗滌循環。盤數 1／2／至少 3 對應原第 2 個、第 2＋5 個、全部 6 個盤子；基礎及各 permutation 的 `bone_visibility` 使用同一規則。兩個負 X 尺寸的櫃體／抽屜也保留原物理面與 UV。轉換器僅限定求值來源的正弦表達式，不執行任意 Molang 或 Java。

`empty_out` 由持髒盤、視線及權限條件驅動。Java 每客戶端獨立預覽，本版由合資格玩家共用方塊姿態；持久設備 phase 仍為 0–5，不寫入額外工作狀態。有限取樣不是逐幀 renderer。

### 餐盤、架子和打單機

餐盤架保留 0–18 盤、包裝架保留 0–10 份包材、洗碗檯保留 0–10 盤的原 multipart 外形。`food_plate_display` 方塊與用餐 helper 均保留原 40 個食物／進食階段。Java stage 0 的空 blockstate 另由 `FoodPlatePlacedRenderer` 顯示食物；候選使用該原 Geo 與專用材質，靜態方塊保留完成姿態，用餐 helper 播放原 0.5 秒 `maked` 並按已過時間定位。

用餐時的 `ordertocook:dining_plate` 是獨立的外觀實體，41 個 geometry 由同一個 client render controller 選取。它使用單張 `dining_plate_atlas.png`，避免把方塊的 per-face material instance 誤當成 entity 可用的多紋理綁定：

| 原紋理 | 原尺寸 | 256×256 atlas 內左上角 | UV 處理 |
| --- | --- | --- | --- |
| `block/food_plate_placed.png` | 32×32 | (2, 2) | 原 Geo 像素 UV 加 atlas 偏移，保留初始食物位置及骨架 |
| `block/food_plate_variants.png` | 160×160 | (38, 2) | Java 16 單位 UV 按原實際尺寸縮放，保留旋轉與負向 UV 尺寸 |

來源像素逐一複製，各邊額外延伸 2 像素降低相鄰取樣串色；沒有重繪、重新著色或把多張圖直接當成 entity 材質別名。餐盤以底部 Y=0、XZ 中心為原點，方向由腳本旋轉，放置高度另留少量偏移以降低桌面 z-fighting。幾何和 atlas 離線比對可以核對座標與像素，**不能證明客戶端渲染、透明排序及遠距取樣已正確**。

helper 無庫存、重力、物理碰撞或自動掉落。`minecraft:custom_hit_test` 設定寬 0.8、高 0.2、中心 `[0, 0.1, 0]`；[官方元件說明](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_custom_hit_test?view=minecraft-bedrock-stable)描述近戰／遠程命中，不能據此推定所有右鍵與觸控互動。腳本也支援點支撐桌面收盤，兩種入口均需實機驗收。

進食約 5 秒後，第四階段髒盤留在原位直到店主／員工領取；沒有顯示實體自動掉一個髒盤的規則。權威記錄在 `restaurant.pendingDishes`，領取先保存 claim，再由腳本給一個 `dirty_plate`，因此重建 helper 或重複 visual ID 不應再次發盤。提前收盤、同一位置舊盤阻擋新餐及重啟邊界見 [RUNTIME_ADAPTATIONS.md](RUNTIME_ADAPTATIONS.md#餐盤進食收盤與付款)。

打單機的原 blockstate 為空，候選直接使用完整 `order_machine.geo.json` 與 `order_machine_geo.png`。`neworder` 的 1 秒升紙、機身縮放及晃動取樣成 16 個 printing 姿態，加 idle／waiting 共 18 個；idle 隱藏紙，waiting 保留原紙張升到 Y=15 的終點。程式遵循 20 tick 內升紙、PRINTING 共 45 tick 及普通候選單未領完時持續留紙。外賣袋同樣改用原 `takeout_bag_placed.geo.json`、專用 32×32 PNG 與 0.5 秒 `maked`：完成姿態為 frame 0，frame 1–10 每 tick 推進；區塊卸載期間暫停。爐火使用原六張 PNG，由各爐自己的 `fire_frame` 選擇熄火、爆火與四張循環畫格：15 tick 等待、5 tick 爆火、每 8 tick 循環；不再共用全域 flipbook。點火骨骼的非均勻 squash 尚未渲染。


### 顧客、騎乘與保留片段

顧客使用原 `drive_idle`／`drive_idle_alex` 骨架及兩張預設顧客皮膚。等待與坐姿各有 4 個原片段，按照獨立的 `ordertocook:animation_variant` 1–4 選擇，原機率為 55／15／15／15；`ordertocook:action` 0–7 另選無特殊動作、坐姿／站立生成、坐姿／站立取餐、爆炸進食、普通進食及中斷離場。7 個 action 直接對應原片段，不再用 action 取餘數混作 idle 變體。進食分別保留 6 秒 `npc_eat&boom` 與 5.5 秒 `npc_eat&scale` 的名義長度。

顧客服務端 movement 為 0，符合原直接生成的預設。動作完成由已保存的時序控制，客戶端按 `action_elapsed` 定位原片段並停留末幀；重載不重播開頭，也不延後服務端離場。idle 在完成片段後才按原權重選下一段，避免未播完便改變動作。服務端每 5 tick 同步，與 Java 客戶端的連續時序仍有取樣差異。

電單車輪子另以移動距離驅動轉動。車燈採原生 `entity_emissive_alpha`，原 Java 燈光的 9 個像素轉為較低 alpha，RGB 不變；[官方材質文件](https://learn.microsoft.com/en-us/minecraft/creator/documents/material-files?view=minecraft-bedrock-stable)說明此材質以 alpha 決定發光程度。實際亮度仍需客戶端確認。

匯入的動畫 JSON 將 GeckoLib `{ "vector": [...] }` 包裝轉為原生向量，正規化 `&` 等識別碼字元，移除原生 schema 不接受的 `easing`／`easingArgs`；保留骨骼姿態與時間。使用 easing 的方塊另由來源原檔取樣，並未因匯入 JSON 移除標籤而失去曲線。顧客原骨骼軌跡保持，action 另加入時鐘定位及末幀保持。來源洗碗動畫引用未定義粒子效果 `3`，該孤立事件不輸出；實際遊戲粒子由服務端音效／粒子邏輯接線。

玩家安坐、拍手與刷盤已由原片段生成可達的native姿勢；原rig及classic／slim64UV入口、上臂／前臂與整臂端點適配、FP相機及共享接線的實際範圍統一查 [PARITY](PARITY.md#玩家動作的來源與骨架)。`preserve_imported_geometry`另保留兩組完整原rig，不代表玩家Geometry.default已切換。5個騎車姿勢／喇叭動作與爐灶完整GeckoLib片段仍只保存。餐盤放置已作實體動畫；冰箱、洗碗機、打單機與外賣袋已用原片段生成方塊姿態，保留JSON本身不會逐幀驅動方塊。線上下載玩家皮膚及女僕模組替換不在本包實作範圍內。

## Block state 與實體契約

所有自訂狀態採 `ordertocook:` 前綴。方塊有 `minecraft:cardinal_direction` 放置 trait；朝向與模型的旋轉集中在 BP permutations。

| 方塊 | 狀態／邏輯範圍 |
|---|---|
| order_machine | `mode`: idle／printing／waiting；`frame`: 0–15，idle／waiting 忽略 frame |
| takeout_bag | `frame`: 0–10；0 為完成姿態，1–10 為原放置動畫的逐 tick 取樣 |
| shelf | `papers`: 0–10 |
| plate_shelf | `plates` + 16 × `plates_high`: 0–18 |
| washingtable | `plates`: 0–10 |
| food_plate_display | `stage` + 16 × `stage_high`: 0–40 |
| dishwasher | `phase`: 0–6；6 只作預覽，持久工作 phase 為 0–5；`frame`: 0–15；`plates` + 16 × `plates_high`: 0–16 |
| refrigerator | `half`: lower／upper；`open`: 目標開關；`closing`: 活動關門片段；`frame`: 0–10 |
| stove | `lit`: false／true；`fire_frame`: 0–5（原六張貼圖） |

超過 16 個值的整數狀態拆成低位與高位，以免單一 block state 超出允許值數。`plates_high` 是布林值，`stage_high` 是 0–2；真實數量仍由 script 保存。盤數 16 必須寫低位 0、高位 true，不能寫低位 15、高位 true。未使用的高低位組合不由 script 產生。

顧客的 stage、皮膚 variant、animation_variant 1–4、action 0–7、action_elapsed，以及電單車的 color／light 均同步到客戶端。用餐餐盤的 `ordertocook:stage` 是 **entity int property 0–40**，不需要拆高低位；`placement_age` 同步放置動畫時間。它們與 `food_plate_display` 方塊的 state 編碼不可混用。storage／seat 是無重力、無碰撞、不可受傷的隱形持久實體；storage 具 81 格真正 inventory，motorcycle 具 54 格真正 inventory。五種實體均提供 `ordertocook:despawn` 事件供 script 清理。

所有功能方塊註冊 `ordertocook:interact` v2 元件。可使用的訂單、指南、控制器、料理、袋、機車、工具箱物品使用 `ordertocook:use` v2 元件，統一由 script 的 custom onUse 處理；不能只依賴 `use_modifiers` 自動形成可用動作。帶訂單身份的物品最大堆疊為 1。外賣袋及餐盤展示方塊的原生掉落表為空，由 script 返還含身份的實際物品，避免生成額外的無身份成品。

外賣袋僅在 frame > 0 時同時掛上 `minecraft:tick` 與專用 `ordertocook:bag_motion`，完成後移除活動 tick。立牌與打單機仍掉落普通家具物品，尚未像 Java 保留菜單／餐廳資料及機器 ID 的 NBT；原生掉落表存在不代表這項元資料還原已完成。

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
