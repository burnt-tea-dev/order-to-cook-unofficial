# 低記憶體與性能審核（2026-11-09）

基線：`78c615f219314f719489987d59b51c678cc42095` 的 main／0.1.48-alpha.1。
本候選：0.1.49-alpha.1。保留 pack UUID、Bedrock 26.60、stable server 2.11.0，
不改 Java 規則、餐盤物權、保存回滾、動畫或資源品質。

## 修復與可重現的操作數

### 已完成餐盤的顧客查詢

原 `dining.tick` 每 5 ticks 對所有非 claiming 餐盤呼叫 `resumeCustomerMeal`；
`entities.loadedCustomers` 每次都查詢三個維度，即使餐盤已保存
`reactionPending=false`。使用正式 dining 與 entity service 接入現有 API doubles，
80 張已完成髒盤預熱後，一次 pass 的這條顧客查詢路徑由 **240 次 getEntities 降為 0 次**。
原路徑在正常 20 TPS 下相當於每秒 960 次；這是呼叫頻率，並非實測 TPS。

現在只有 `reactionPending !== false || bonusPlayerId` 才重試。明確的 false 來自既有
`main.settleMealBonus` 完成並保存反應；未知舊資料、尚未完成反應及未支付 bonus 保留原流程。
餐盤顯示／取回、孤兒清理及食物 100-tick 計數仍照常，沒有按牆鐘猜測舊顧客已完成。

### 活躍餐盤定位

原 `tickFood → atBlock` 對每次原生餐盤 tick 重掃所有餐廳和待收盤。
現在在同一 `system.currentTick` 內為各餐廳暫存座標索引，每次查詢仍重新枚舉權威餐廳。
令 P 是查詢數、M 是全部待收盤、R 是餐廳數，meal 掃描由 P×M 降為約 M，
總成本仍包含 P×R，即 **O(M + P×R)**。

以下為直接匯入固定基線／候選正式 dining 模組，用 Proxy 統計 meal row reads，
並對權威餐廳迭代計數的同 tick 合成查詢。所有查詢結果一致。

| R | M | P | 原 meal reads | 候選 meal reads | 兩版仍有的 restaurant visits |
| --- | --- | --- | --- | --- | --- |
| 1 | 80 | 32 | 2,560 | 80 | 32 |
| 8 | 800 | 64 | 51,200 | 800 | 512 |
| 32 | 3,200 | 256 | 819,200 | 3,200 | 8,192 |
| 3,200 | 3,200 | 32 | 102,400 | 3,200 | 102,400 |

WeakMap 以 canonical restaurant 物件為 key；保存 rollback／整筆替換會重新索引，
pendingDishes 陣列替換或長度變化亦會重建。同 tick 的 queue、migration、claim、cleanup
及 startedAt 變更在寫入前清索引。每個新 tick 重建，既有 5-tick housekeeping 清除最後批次；
沒有新增 interval、持久索引或原生物件引用。沒有 tick clock 時保持逐次掃描。
原最早 startedAt／同時間陣列和餐廳次序，以及點擊下方桌面的行為均保留。
未來新增原地改餐盤位置、排序或同長度替換 meal 的寫入者，必須接入同一失效契約。

索引增加 O(M) 的短暫 key／引用記憶體；本次證明減少重複掃描與暫時分配，
沒有量測 Bedrock heap 的淨下降量，也沒有消除很多餐廳時的 P×R 成本。

### 空場洗碗機預覽

原 `updateDishwasherPreviews` 每 2 ticks 即使沒有閒置洗碗機，仍枚舉全部玩家並讀主副手。
現在 idle map 為空時先清舊 preview 再返回，省去這條路徑每秒 10 次玩家枚舉及約 20P 次物品讀取。
重返 idle 會開始新預覽；工作中抽屜、庫存、權限、聲音和動畫時序保留。

## 尚存風險

- `store.js` 把全世界餐廳、設備與 profile 全部載入 Map，另留完整 JSON snapshot 供失敗回滾。
  常駐量隨整世界歷史資料增長，尚未做分區冷資料策略。不能直接刪除 snapshot 或未收盤來省 RAM。
- 廚電仍每 2 ticks 遍歷所有已登記設備；冰箱、爐灶及恢復巡檢的成本仍存在。
- 每秒餐廳進度對歷史玩家深拷貝 profile 並核對來源帳本。未來應在正式 store owner 上建立
  已驗證 revision／dirty queue，保留失敗重試與防重付；不能隨意剪掉 checkpoint。
- `entities.hornTimes` 以鳴笛車輛 ID 保存 cooldown，缺少淘汰；屬小型長期累積風險，
  沒有證據顯示單獨足以 OOM。本輪保留由 #11／#77 同檔開發線協調後處理。
- #11 的舊原生 POI 密集場景性能仍退化；其歷史數據不可套用本次 main／.49。

基線 RP 為 546 檔、7,843,095 bytes；79 張 PNG 按 width×height×4 的 RGBA8 base level
合計 3,569,808 bytes（含 pack icon）。這些是檔案／像素算術，沒有包含 atlas、mipmap、
引擎複製或真實載入集合，不能稱為 GPU／RAM 實測。410 個 geo JSON 合計 3,213 cubes；
`dining_plate.geo.json` 內 41 個 geometry 定義合計 293 cubes，單一定義最多 14 cubes；
全 RP 單一定義最多的是 motorcycle（41 cubes）。沒有量測出需要犧牲 Java 視覺的資源瓶頸，
故不降貼圖或砍模型。

## 驗證

- 定點 dining＋dishwasher preview：48/48 PASS。
- `npm run verify`：941/941 PASS，0 fail、0 skipped；型別、519 JSON（errors=[]）、paired build PASS。
- 4 個新增案例由現有 `tests/*.test.js` 入口實際執行，另擴充既有 rollback／排序案例。
  涵蓋同 tick 新盤、刪除、整筆／陣列替換、平手次序、failed-save rollback、跨 tick 索引與無時鐘 fallback。
- `check_compliance.py`：errors=[]；`check_release_policy.py`：PASS。既有 rights clarification advisory 保留。
- 本地 Node v24.22.1；遠端 CI 使用 Node 22，結果另行確認。

這是程式審核、正式服務接 API doubles 的操作數與離線驗證；未執行 BDS、Minecraft 客戶端、
用戶本機或 LIVE。手機 FPS、實際常駐 RAM、GC、GPU、熱降頻、多人與觸控均未實測。
候選及 Draft PR 不代表遊戲驗收或已發佈。

## 獨立驗收補充

[獨立重現、80,000 次差分、負控制與計時原始數據](validation/low-memory-20261109/README.md) 已補齊。稀疏查詢時建立索引可能更慢，並非所有負載均改善；原生 BDS／手機性能仍未測。


## 冰箱整理只提交有變化的原生槽位（2026-11-16）

基線為 main `379dbab5c6fadf9e73e376a1db7db89fcf705737`；此獨立 Draft 候選
配對為 **0.1.59-alpha.1**。原 `native_fridge.js::compactFridgeInventory`
每次整理上半／下半都寫 27／54 格，空櫃與已整理的櫃亦然。現在沿用同次完整
snapshot 的既有分組結果，只提交最後物品或數量有變的格；不保留跨次貨物快取。

### 來源、API 與相等判斷

Java 仍固定 `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`；
本輪讀回上游 HEAD 仍為此提交。[Forge RefrigeratorScreenHandler.java 的
compactRefrigerator，122–143 行](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/screen/RefrigeratorScreenHandler.java#L122-L143)
按首次遇見順序分組、合併相同資料，再依序填回；[NeoForge 的相同 owner，88–110 行](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/screen/RefrigeratorScreenHandler.java#L88-L110)
使用同樣順序及 item components 相等性。本候選沒有重寫這套分組／輸出算法。
原 Java 每格 128 與 Bedrock `maxAmount` 的容量差異繼續保留，沒有把容量適配說成已修。

2026-11-16 核對官方 [ItemStack](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable)
與 [Container](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container?view=minecraft-bedrock-stable)，
也以本庫鎖定 server **2.11.0** 型別完成編譯：

- `getItem` 取得原生物品快照；`clone` 保留物品的自訂資料及屬性。
- `isStackableWith` 比較類型及自訂資料／屬性，忽略 amount；不可堆疊物品會回傳 false。
- 本輪只記錄原分組過程已產生的 group reference。原槽 group 與輸出 group 相同，
  且 amount 一致，便保留該格。這沒有新增 native equality 呼叫，也沒有自行列出
  name/lore 欄位冒充完整相等性。每件不可堆疊物有自己的獨立 group；只有同件原位
  才免寫，不會依 typeId 合併不可堆疊物。
- 生成輸出仍先完成 clone／amount 計算，所有比較均在第一次寫入前完成。
  尾段只清有貨格；空位 `undefined` 不會被寫一次空值。
- 每個實際嘗試槽先加入 attempted，再呼叫 `setItem`，故寫後拋錯的格也會回退。
  逆序回復僅本次嘗試過的格。回退再次失敗仍拋出原有明確錯誤，不吞掉失敗。

額外工作是最多每格一個短期 group reference 與 changed／attempted 槽號陣列；
沒有新增 timer、helper、世界 DP、保存 schema、整櫃持久快取或玩家資料。
這減少 native 寫入，並非已量測 RAM、GC、CPU、FPS、TPS、網絡封包或手機載入改善。
原生視窗正在操作時的並發輸入、磁碟中止與跨容器原子性沒有新增保證。

### 相同正式函式的離線 A/B

以 `git show 379dbab5:runtime/BP/scripts/native_fridge.js` 載入 main 正式函式，
與本候選正式函式共同使用現有 `tests/appliances.harness.js` 的 FakeContainer／FakeItem。
只包住 `getItem`、`setItem` 及原 `isStackableWith` 計數；用完整可序列化物品快照
比較所有槽位的結果與順序。沒有新增測試、fixture 或 CI 檔案。

| 場景 | getItem，main → 候選 | setItem，main → 候選 | isStackableWith，main → 候選 |
| --- | ---: | ---: | ---: |
| 27 格空上層 | 27 → 27 | 27 → 0 | 0 → 0 |
| 54 格空下層 | 54 → 54 | 54 → 0 | 0 → 0 |
| 下層已整理的三堆可堆疊物 | 54 → 54 | 54 → 0 | 2 → 2 |
| 上層第 26 格的 8 個蘋果 | 27 → 27 | 27 → 2 | 0 → 0 |
| 下層稀疏混合物品 | 54 → 54 | 54 → 9 | 7 → 7 |
| 下層原位單件不可堆疊包裹 | 54 → 54 | 54 → 0 | 0 → 0 |
| 200 個生成排列，首次整理總計 | 8,100 → 8,100 | 8,100 → 7,626 | 42,614 → 42,614 |

三堆已整理物為 slot 0: apple×64、1: apple×16、2: bread×5。
稀疏例為 slot 3: apple×40／A、7: bread×2、9: apple×30／A、
11: apple×4／B、53: takeout_bag×1／proof；名稱標記另有 `['saved', tag]` lore
與 `sample:identity=tag` DP。兩版輸出皆為 apple×64／A、apple×6／A、bread×2、
apple×4／B、原 proof 包裹；其餘空格相同。不可堆疊的原位例為 slot 0 的該包裹。

200 排列使用 27／54 格各 100 次；先做 main／候選比較，再將每次候選結果再次
交給候選整理，200 次全部 **0 次寫入**。首次生成排列僅減少 **474 次／5.85%**
寫入；密集且大多位置要改時收益有限，不能把空櫃的 100% 寫入減量泛稱全部整理。
所有 getter 與 native equality 次數一致。

可重現生成規則：seed=59261116，單一序列 `seed=(1664525*seed+1013904223)>>>0`，
每次 `random(n)=seed%n`。size 先 27 再 54，每組 100 次，每格先 `random(4)`，
為 0 就空置；否則 `t=random(5)` 選 `[apple,bread,carrot,apple,takeout_bag]`，
包裹數量 1，其餘 `1+random(64)`；之後 `random(3)===0` 才取 `M+random(3)`
作上述 name/lore/DP，否則無標記。包裹另設 keepOnDeath=true、lockMode=inventory、
damage=random(10)。所有物品類型分別用 `minecraft:` 及 `ordertocook:` 前綴。
以現有 FakeItem clone 與 setItem 寫入兩個相同初始容器後歸零計數。
這些固定資料只驗相同正式算法的可觀察差異，不是原生物品 renderer 或真實玩家負載。

稀疏例的變動槽 `[0,1,2,3,4,7,9,11,53]` 各注入一次寫前及寫後拋錯，
共 **18 個情境**全部回復原 snapshot。另確認原 equality 在分組階段拋錯時仍零寫；
回退再次拋錯保留原「冰箱整理回復未完成」提示。這些有界 API doubles 不代表
任意原生錯誤、磁碟中止或回退失敗時零損失。

### 現有檢查、配對及並行範圍

- `node --test tests/native-fridge.test.js tests/appliances.test.js`：**30/30** 通過，
  包含原冰箱 13 項；沒有修改時長或資料保護斷言。
- `npm run verify`：**328/328**、TypeScript、**520 JSON**（零錯誤）及 paired build 通過。
- `python tools/check_compliance.py`、`python tests/check_release_policy.py`、
  `git diff --check` 通過。原作者權利記錄未改。
- 讀取 99 個遠端 branch heads 的 74 份現有 baseline（25 個早期分支沒有此檔），
  最高為 .58；由 Core `tools/paired_release.py::plan_pair` 生成 .59 manifests，
  同步 package／lock／baseline 並只追加 release history。UUID、API、引擎保持。
- runtime fingerprint：`235178e42573c523888961baa5710ff55dfda450b718569facbb3f0735d0aacb`。
- 已核對當時 OTC 的 13 個 open PR 及完整改動檔；沒有其他 PR 修改 `native_fridge.js`。
  #81 是 appliances.js 的舊 helper 身份保護；#95／#96 是副手投入及洗碗機視覺 owner，
  #87／#88 是模型／生成器 owner。本候選不複製它們的功能；文件與 paired metadata
  的並行 hunk 應整合後重新 freeze，不能以較大版號覆蓋另一候選。

沒有 BDS、Minecraft 客戶端、用戶電腦、真多人、LIVE、部署、合併、Tag 或 Release。
模型、動畫、貼圖未改；現有視覺證據不擴大。維持 Draft，遠端既有 CI 結果記於 PR。
