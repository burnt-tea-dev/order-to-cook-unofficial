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
