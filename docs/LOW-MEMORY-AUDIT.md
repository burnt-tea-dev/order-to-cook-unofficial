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

## 洗碗機單次視覺狀態提交（2026-11-16）

此續輪以 main `a4176b193294d8f57234b3b316ad6b092acf5d5b` 為基線，
候選配對身份為 **0.1.58-alpha.1**。上文 0.1.49 的歷史數字與驗證範圍保持原樣。
本次只修改 `runtime/BP/scripts/appliances.js` 的視覺提交：洗碗機原本按
phase、frame、plates、plates_high 依次寫入，同一完整 pose 最多有四次
`setPermutation`。現在共用爐灶已存在的合成方法，先在本地導出完整 permutation，
有變化才一次寫回；爐灶原有合成行為保留。單欄洗碗池與冰箱 open 入口不變。

### 原作與現行 API 依據

本輪重新讀取的上游 HEAD 仍為 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`。
[Forge DishwasherBlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/DishwasherBlockEntity.java)
與 [NeoForge DishwasherBlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/entity/DishwasherBlockEntity.java)
的 insert／take 先變更 storedPlates，`setState` 同時確定 state／timer 後再 `sync`；
原作沒有要求消費逐欄混合畫面的中間態。Bedrock 的 dishwasher JSON 這四個 state
只選 geometry／bone visibility；permutations 的 component 僅 geometry、transformation，
沒有 redstone producer、容器或逐欄鄰居回調。既有 interaction owner 也沒有依賴這些中間態。

官方 [BlockPermutation.withState](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockpermutation?view=minecraft-bedrock-stable#withstate)
返回導出的 permutation；[Block.setPermutation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/block?view=minecraft-bedrock-stable#setpermutation)
一次接收完整狀態。兩項亦在本庫鎖定的 `@minecraft/server 2.11.0` 型別中，
本次未借用較新 preview 能力。withState 與寫回都可能拋錯，不能把一次 API 呼叫宣稱為跨資料層原子交易。

### 呼叫數與資料一致性

以同一既有 `tests/appliances.harness.js` 的 I/O doubles 匯入固定 main 和候選的
正式 service；純 helper 仍匯入正式來源。這是離線 API 邊界操作數，未量測 native
更新封包數、CPU、RAM、FPS、TPS 或畫面閃爍。

| 場景 | main setPermutation | 候選 setPermutation | 保留的內容 |
| --- | --- | --- | --- |
| 714 個合法欄位組合的首次視覺對齊 | 2,061 | 712 | 每案完整終態、方向、gameplay 資料相同；候選每次最多一寫 |
| 1 盤完整投入→洗滌→取出→收回 | 60 | 52 | 每 2 tick 的 phase／剩餘時間／pose、完整背包及音效紀錄相同 |
| 8 盤同流程 | 60 | 52 | 同上 |
| 9 盤同流程 | 76 | 68 | 同上 |
| 16 盤同流程 | 76 | 68 | 同上 |

714 案由 phase 0–5、盤數 0–16、該 phase 剩餘時間的 0／中點／全長（去重），
各配三種已存在 pose（idle0、ready16、preview8）組成；包含合法但未必自然到達的
恢復組合。每案再用原 `onPlace` 視覺入口重讀，第二次均零寫入。
完整循環先將預覽推進 24 tick，再投入；其後每 2 tick 呼叫正式 service，直到
ready，立即領盤並再推進 14 tick。以上正常循環少 8 次寫入，不能宣稱所有更新都少 75%。
該循環內全部 block.permutation 屬性讀取也由 580→344（1／8 盤）、772→460（9／16 盤）；
這包含既有服務與 API double 的讀取，不等同只計四欄比較的 getter。
洗碗機現在每次視覺更新會建立一個短期 states 物件與 `Object.entries` 陣列；
這沿用原爐灶實作，沒有新增常駐記憶體，也沒有證明 heap／GC 的淨下降。

重現現有驗證命令：`node --test tests/appliances.test.js tests/appliance-motion.test.js tests/audiovisual.test.js tests/dishwasher-preview.test.js tests/stove-fire.test.js`，
以及 `npm run verify`。操作數比較在 scratch 臨時載入兩份正式 source，對同一 FakeBlock 的
`setPermutation` 包裝計數，沒有新增或修改倉庫 tests、CI、fixture。
原 native timer／資產規則的既有檢查保持，未改斷言迎合新程式。

### 失敗語義與現有差距

- withState 導出任何一欄失敗時，候選不發布較早幾欄的半份 snapshot；main 原先可能已逐欄寫出一部分。
  這是有意收斂視覺提交，保存的盤數／phase／timer 不受影響。資源恢復後由下一次既有視覺更新重讀並提交。
- setPermutation 寫前拋錯時沒有成功狀態快取；重試一次補齊。臨時注入「寫後才拋錯」時，下次真實讀回已相符，零重寫。
  同樣核對外部改 pose、service 重建後恢復。這些故障注入沒有證明原生 API 的任意部分寫入或程序崩潰語義。
- 固定 Java 的 phase 在 timer 歸零後下一 tick 才轉換，因此小批／大批／收回為 97／137／15 邏輯 tick；
  現行 94／134／14 的邊界差距仍屬另一項來源修復。此處不改 timer、抽樣頻率、盤數、扣料、音效及 82 個姿態資產。
- 單次方塊狀態提交減少程式的中間請求；原生鄰居通知、封包合併、多人可見性及客戶端是否閃爍尚未觀察。
  沒有降低材質或模型品質，也沒有新的常駐快取、helper、interval 或世界保存 key。

### 版本、並行工作與驗證結果

重新讀取 74 份遠端分支 baseline，最高為 0.1.57；使用 Core
`0fe3f59f85b30da2426078680d0e6ea8908386c8` 的既有 `tools/paired_release.py::plan_pair`
產生 0.1.58 成對 manifest，保留 BP／RP UUID 和 module API，歷史只追加。
此候選以 main 為起點，並未自動納入 #94 coin 或 #95 offhand 的改動；
較高版本號不能用來覆蓋其他已選候選，整合輸出仍需重新配對。

讀過當時 13 個 open PR 的 paths。`appliances.js` 與 #81 helper 身份、#95 投入交易為不同 hunk；
#11 為較舊 POI 分支，整合時須保留現行視覺 owner。#87／#88 資產工作不在本次修改範圍。
共享 README／PARITY／version metadata 仍須按 hunk 正常整合。

已執行既有定點 **51/51**，`npm run verify` **328/328**、TypeScript、**520 JSON**
及成對 build 通過；既有 compliance、release-policy 與 `git diff --check` 結果另隨 PR 記錄。
本次沒有 BDS、Minecraft 客戶端、用戶裝置、LIVE、合併或發布操作；候選保持 Draft。
