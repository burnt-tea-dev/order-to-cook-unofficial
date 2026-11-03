# Order To Cook 26.60 POI：本輪來源、修復與性能審查

日期：2026-11-04（香港）。開發線：[PR #11](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11)。

**結論：本輪完成同線修復及新來源驗證，但不合併 PR #11，維持 Draft。** 密集五類站點查詢在配對 helper 與整包對照均退化；部分刷新情境改善，仍不足證明整體伺服器受益。真實玩家、多人及玩家舊世界驗收未執行。未發布 Release，未更新 LIVE。

## 來源與範圍

本輪開始時 PR #11 為 Draft、未合併，head `dd54ea33d12d058108098288165042af1b692169`；最新 main 為 `ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`。本輪把該 main 整合回同一分支，保留三語 README、獨立指南及 candidate workflow 的主線改動，沒有另開平行 POI PR。

候選 **0.1.5-alpha.1**，BP／RP **[0,1,5]**，保留 UUID。0.1.3-alpha.1 已有歷史證據，0.1.4-alpha.1 已由另一 stable crafting 開發線使用，因此這次來源使用不同身份。

測量時的本機最終功能來源 commit 為 `3cdd7f7039ea6d857cab944ef97452b1e2ab6f4e`；可從 GitHub 取得的等價功能來源為 [05229d7376db7079384dc433652ba07f1b65087e](https://github.com/burnt-tea-dev/order-to-cook-unofficial/commit/05229d7376db7079384dc433652ba07f1b65087e)。兩者完整 Git tree 均為 `ee0117d85adf222ef3dd3116d6e0f97060c03ff2`，檔案內容完全一致。此次透過 GitHub API 提交，同一份來源因提交 metadata／parents 不同而得到不同 commit SHA；後續證據／文檔提交不改 runtime。

測量 JSON 保留原來的 `gitHeadAtMeasurement`／`verifiedRuntimeCommit`，另以 `publishedEquivalentRuntimeCommit`、`publishedEquivalentGitTreeSha` 和 `publicationSourceLocalCommit` 記錄遠端對應。這個對應證明來源內容相同，不表示重新執行了一次測試，也不把本機測量歷史改寫為遠端 commit。

被測 runtime tree SHA-256：

```text
0fe26e9c410e8fea354a6fac5ace43ad0aa2b81af7bfdc46d76b63db8ed4a4b6
```

最終候選原生／性能 JSON 以該指紋綁定實際測量來源；舊版基線和中斷的初輪報告各自保留真正的來源指紋。原生工具注入的 QA entry 只在隔離測試目錄，不進正式 BP。歷史 [0.1.3 報告](../UNRELEASED-poi-discovery.md)保留原指紋，不能作為本輪新來源成功證據。

## 本輪已修復的實際問題

1. `upgradeForm()` 兩次忽略 `syncMenu()` 的變更回傳，取消升級或確認時未達條件會留下只存在記憶體的菜單換綁；管理員刷新遇到空菜單亦會漏存。三個修復前失敗的回歸，修復後通過；沿用唯一 `saveRestaurant()`，沒有第二個存檔 owner。
2. 固定 Java `RestaurantSupplyCompatApi.targets()` 對每軸 ±5 全部掃描，沒有排除立方角落。舊 Bedrock／原 POI PR 的球形供應架搜尋錯誤；現在操作台以 POI `getInSquare()` 加逐軸精篩，恢復兩種架子的立方範圍。冰箱範圍沒有擴大。幾何及正式打包／裝盤三個回歸同樣經修復前失敗、修復後成功。
3. 三語安裝說明統一新版本／Beta APIs／POI 需求，避免整合主線後英文／簡中仍指示 1.21.100 stable API 與關閉實驗。
4. 訪客點擊無 owner 的舊立牌時，原 `claimStation()` 會先建立／認領 station 再拒絕訪客。現在先判斷附近餐廳權限，未授權時不建立或修改 canonical 記錄；保留店主／員工的合法認領。兩個互動事件回歸修復前失敗，修復後成功，另有合法操作對照。
5. 初輪原生壓力測試實際發現 POI 比原全表掃描更慢。排序比較器每次讀取原生 `Block.location`，造成大量跨引擎呼叫；現在僅在當次查詢以已驗證的 POI 座標計算一次距離，排序普通數值後回傳原 Block。沒有跨查詢快取或持久位置資料庫。

## 查詢規則與權威資料

| 類型 | 最終搜尋規則 | 權限／資料判定 |
|---|---|---|
| 立牌 | 水平圓半徑 24、Y±8；總營養優先，同分按距離 | 實際載入方塊＋原 station；店主／員工擁有或無 owner；未授權立牌不納入 |
| 椅子 | 水平圓半徑 24、Y±8；從可用空椅隨機選 | 原 rider、頭頂空間及座位規則；POI ticket 不代表使用權 |
| 冰箱 | 三維半徑 24，只接下半格 | 原 station＋原生 inventory；上半不重複計庫存；提交取料仍驗權 |
| 包裝架 | 各軸 ±5，按三維距離排序 | 原供應量、餐廳／使用者權限 |
| 餐盤架 | 各軸 ±5，按三維距離排序 | 原供應量、餐廳／使用者權限 |

椅子的玩家互動仍走餐廳／設備授權；NPC 選椅依原作空椅與 rider 規則，不把 POI ticket 或新的座位 owner 當成額外門檻。

五份 POI 定義只使用 `ordertocook:*`，tickets=0、空 tags。查詢不執行 take/release/addTemporary；不宣告 vanilla 村民標籤，也不改寫其他 Addon 或 `player.json`。POI 位置必須重新讀取實際方塊；菜單、耗材與冰箱資料再以座標接回原 canonical Map。沒有記錄的方塊不會自動建 owner／庫存；陳舊類型不會被視為新設備。

新增的正式模組測試確認：五種設備的員工撤權；鄰店較近的冰箱／兩種架子不會被越權耗用；缺 canonical 記錄與方塊類型不符時保持原資料。這些是實際 runtime 模組加可控世界／玩家替身，不是原生多人驗收。

`nearbyStations()` 已不再展開所有工作站；但 `nearestRestaurant()` 的同步權限查詢、每秒餐廳巡檢與 station 進度巡檢仍存在，設備加工、實體與保存成本亦未消失。不能把一條搜尋改動稱為完整伺服器成本已下降。

## 驗證結果

本輪 `npm run verify`：**365／365** Node 測試，官方固定 beta 型別檢查、291 JSON 靜態檢查及 BP／RP／mcaddon 建置通過；Python **12／12**、compliance／release policy 通過。

| 原生場景 | 實際結果 | 證據 |
|---|---|---|
| 最終候選全新 QA 世界 | 127/127；POI 10/10；0 addon errors | [native-initial.json](native-initial.json) |
| 同候選正常停服再啟動 | 20/20；0 addon errors | [native-reload.json](native-reload.json) |
| 真歷史 0.1.2-alpha.3 來源先建立 QA 世界 | 127/127；舊 runtime `77a9d188…` | [native-upgrade-baseline.json](native-upgrade-baseline.json) |
| 將上述已保存世界升級到最終候選 | 20/20；0 addon errors，舊站點不用重放 | [native-upgrade.json](native-upgrade.json) |
| 五類設備、立方角落、上下冰箱具名食品、實際接受訂單 | 9/9 | [native-poi-lifecycle.json](native-poi-lifecycle.json) prepare |
| 原生區塊確實不可讀→重新載入，保留 menu/owner/order/supply/食品 | 10/10 | 同檔 unload |
| Beta 開、POI 關 | 2/2；初始化拒絕，保存的 fixture records 未變 | 同檔 poi-off |
| Beta 關 | 2/2；引擎明確拒載，QA 模組入口沒有執行 | 同檔 beta-off |
| 重新開啟兩項實驗 | 6/6；原有五類 POI、菜單、訂單及上下冰箱食品恢復 | 同檔 restore |

生命週期合計 **29/29**。關閉實驗的「通過」是確認拒載／資料保留及重新啟用恢復，並非功能可在關閉實驗時正常運作。原生卸載先觀察 `getBlock()` 不可讀，不以空 POI 查詢代替卸載證據。

以下另列性能的實測範圍與結果。

## 性能方法與查詢路徑結果

硬體是本次測試環境的 AMD EPYC 9V74、9 個可見邏輯 CPU（cgroup 8 CPU 配額）、8 GiB 記憶體上限；BDS `max-threads=2`，固定 flat seed `26600011`、view-distance=5、tick-distance=4。**不是 Cary 的 Xeon 伺服器實測。**

[最終查詢路徑 A/B](native-performance-after.json) 完整 **72/72 段**；80／800／3200 個實際原生站點，五種類型均勻分布在單層密集格點，1／8／32 個合成查詢來源。來源不是玩家，也沒有放置對應數量的打單機；80 站點／32 來源只有 8 個不同位置，其餘重複發出相同位置查詢，實際位置數記在每段 `distinctQueryLocations`。每組依 scan→POI→POI→scan 執行，各測 40 ticks。舊 scan helper 逐字提取自 `ce8a45e`，兩條路徑共用同一 canonical store，候選 ID 集合及固定工作量 checksum 一致。

為保持搜尋工作量可比，此 helper 測試對兩種供應架都使用共同的球形半徑 5；**正式操作台已修成 Java 立方 ±5**，不能把這份球形查詢數據稱為實際裝盤流程的全部成本。所有立牌只有一個 bread 菜單項，冰箱／椅子等有實際方塊但沒有真人互動。

| 站點／合成查詢來源 | 每批五類查詢：scan→POI (ms) | Native active MSPT：scan→POI | 觀測 TPS：scan→POI | 固定每段全部工作的 CPU：scan→POI (秒) |
|---|---:|---:|---:|---:|
| 80／1 | 1.26 → 1.85 | 4.20 → 4.61 | 19.99 → 20.00 | 0.210 → 0.225 |
| 80／32 | 16.15 → 40.69 | 17.50 → 38.86 | 19.99 → 19.95 | 0.795 → 1.755 |
| 800／8 | 40.39 → 98.43 | 48.85 → 101.47 | 18.04 → 8.78 | 2.210 → 4.565 |
| 3200／32 | 553.95 → 1060.53 | 552.66 → 1013.91 | 1.65 → 0.90 | 24.295 → 44.590 |

工作批次、MSPT 及 CPU 數值為每條路徑兩段的平均；TPS 統一用兩段總 ticks／總實際秒數，並非平均分段速率。短窗口的毫秒計時會出現略高於 20 TPS 的取樣誤差。CPU 是 `/proc` BDS user+system CPU 時間，包含背景工作；並非單一函式的 exclusive CPU。每段查詢數為 `40 × 來源 × 5`。高負載下雙方均約用滿一核心，**不能用約 100% 的相同 CPU 佔用率聲稱消耗相同或節省 CPU**。

原生 MSPT 來自官方 diagnostics 的 `level_tick + script_tick + script_job_tick`，由微秒換算毫秒；沒有把 50ms 節拍等待當成工作時間。獨立覆核發現 diagnostics tick 與 Script tick 在邊界有偏差，因此最終統一使用每段**完整原生擷取窗口**（42–46 個完整 native samples），保留啟停邊界，確保不漏掉首個刷新尖峰。MSPT 的窗口與 40 ticks 的 workload／CPU／TPS 窗口分開標明；原始 samples、時間範圍與 capture SHA-256 都在 JSON。

### 訂單刷新與保存

另一組測量是在共同的候選規則上做菜單選擇，再執行真正 `core.refreshOrders()` 與 `saveRestaurant()`。每 20 ticks 強制一次刷新，測量段各有兩批；這仍是壓力負載，**不是預設每 600 秒一次的自然刷新頻率**，也不是完整 `tickRestaurants()`、顧客或玩家交易測試。

| 站點／合成查詢來源 | 每次整批刷新＋保存：scan→POI (ms) | 觀測 TPS：scan→POI |
|---|---:|---:|
| 80／1 | 3.00 → 2.25 | 20.01 → 20.01 |
| 800／8 | 191.75 → 153.75 | 18.05 → 18.73 |
| 800／32 | 743.75 → 569.75 | 12.05 → 13.47 |
| 3200／32 | 2699.25 → 2170.00 | 5.20 → 6.10 |

所以結果並不是「所有路徑都更慢」：部分菜單／刷新組合有收益，但五類站點合併查詢的負擔顯著增加，生成訂單與保存本身仍有大尖峰。這份受控負載不足以聲稱整個玩家伺服器 TPS 會提高。

### 初輪退化與修正

[初輪、尚未優化的來源](native-performance-before.json) 綁定 runtime `e3c36f65…`／本機 commit `0cff2c79b178de787b260bff5d618eca6e1e1743`；其遠端等價來源為 [df2539914857b742eb1584f765a78b984cc6c811](https://github.com/burnt-tea-dev/order-to-cook-unofficial/commit/df2539914857b742eb1584f765a78b984cc6c811)，兩者完整 Git tree 均為 `a37bafe5d4d376cfa41c75c8aa22ed094d9f00d4`。這是初輪來源，與最終候選各自對應。初輪在確認密集場景的明顯退化後中止；只保留 62 段完整結果，整體狀態是 **INTERRUPTED / passed=false**，原 Python 程序未落盤的 CPU 指標標為 unavailable，沒有補造。它的原生資料亦按相同完整 capture 口徑重新解析。

排序修正移除了重複原生位置 getter，最終來源仍未消除上表的整體查詢退化。初輪刷新是每 tick 強制執行，與最終每 20 ticks 不同，**兩者刷新數字不可直接計算加速比例**。正式新來源的功能／重啟／升級與上述完整 A/B 已另行重驗。

### 整包對照與記憶體

同程序 helper A/B 兩條路徑共用已載入的 POI 索引，不能用其 RSS 差值估算引入 POI 的記憶體代價。因此另做相同 seed、probe、主機設定及場景的獨立整包啟動：

- [stable main 整包](native-performance-main.json)：`ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`，runtime `828e3f0c39f8b5c9698c507481253ceb401372c08fa0e57aed740de95c61644b`，不開實驗。
- [最終候選整包](native-performance-candidate.json)：測量時本機 commit `3cdd7f7039ea6d857cab944ef97452b1e2ab6f4e`，遠端等價 commit `05229d7376db7079384dc433652ba07f1b65087e`，runtime `0fe26e9c410e8fea354a6fac5ace43ad0aa2b81af7bfdc46d76b63db8ed4a4b6`，開 Beta APIs／POI。

兩組都從指定 commit 的 git archive 取出完整 runtime，來源前後不變，各 **12/12 段**、0 addon errors、正常停服。每個場景／工作負載做兩個 40-tick 測量段。這是載入整個實際包、使用其正式查詢 helper 的受控負載，**不是整個遊戲流程端到端測試**；刷新仍由 harness 選菜單後呼叫正式核心與保存。整包差異包含本 PR 既有保存讀回確認等，不全是 POI 索引的差異。

| 站點／合成查詢來源 | 每批五類查詢：main→候選 (ms) | 原生 MSPT：main→候選 | 觀測 TPS：main→候選 | 每段 CPU：main→候選 (秒) |
|---|---:|---:|---:|---:|
| 80／1 | 0.88 → 1.93 | 3.77 → 4.70 | 20.01 → 19.99 | 0.190 → 0.240 |
| 800／8 | 40.73 → 82.51 | 48.56 → 88.16 | 17.82 → 10.37 | 2.210 → 3.855 |
| 3200／32 | 562.19 → 980.68 | 571.70 → 962.90 | 1.63 → 0.97 | 24.615 → 41.395 |

兩包的五類查詢結果與工作量可比。800／8 的總 BDS CPU 攤分成本是每查詢 **1.381 → 2.409 ms**，不是查詢函式的 exclusive CPU；3200／32 是 **3.846 → 6.468 ms**。與配對 helper 一致，密集搜尋成本增加，沒有達成本輪性能目標。

| 站點／合成查詢來源 | 每次整批刷新＋保存：main→候選 (ms) | 原生 MSPT：main→候選 | 觀測 TPS：main→候選 | 每段 CPU：main→候選 (秒) |
|---|---:|---:|---:|---:|
| 80／1 | 2.75 → 2.75 | 2.94 → 3.66 | 20.00 → 20.01 | 0.160 → 0.185 |
| 800／8 | 176.00 → 135.75 | 21.37 → 20.10 | 18.38 → 19.05 | 0.950 → 0.900 |
| 3200／32 | 2383.75 → 2428.75 | 152.74 → 162.96 | 5.92 → 5.57 | 6.675 → 7.170 |

整包刷新只有中間場景有一致改善；最高密度沒有重現 helper 的刷新收益。不得把單獨查詢 helper 的局部改善寫成整包或正常營業成本下降。

| 查詢場景 | main 峰值 sampled RSS (MiB) | 候選峰值 sampled RSS (MiB) |
|---|---:|---:|
| 80／1 | 520.45 | 466.25 |
| 800／8 | 526.33 | 476.88 |
| 3200／32 | 563.08 | 519.25 |

RSS 取相同查詢場景兩段的最高取樣值。此次候選較低，但每包只有一個獨立啟動、短測量段；載入、allocator 及其他來源差異都可能影響記憶體，**不能歸因為 POI 節省 RAM**，亦未驗證長時間洩漏。刷新段 RSS 和其餘完整數值可在 JSON／[彙總 CSV](native-performance-summary.csv) 查閱。

所有最終報告的 `passed=true` 指測量完成、來源一致、checksum 一致及無 addon error，**不是性能門檻通過**。最終 paired helper 72 段加整包 24 段的原始 captures、樣本、CPU 分母與指紋均經獨立覆核。沒有真人玩家，也沒有對 Cary 實際伺服器的承載量作結論。

### 重現性能測量

每次使用獨立、全新解壓的官方 BDS 1.26.60.6 目錄；工具會建立有標記的可棄置 QA 世界，拒絕既有世界。先取得包含本文件及新增 QA 工具的 PR #11 證據提交，再執行下列命令；`--runtime-ref` 指向已發布的等價功能來源，不要求工具也存在於該功能提交。保留 probe SHA，完整命令的關鍵參數如下。不得指向 LIVE 或玩家存檔。`v0.1.5-alpha.1` 只是 build-info 的候選版本標籤文字，本輪未建立該 Git tag、未發布 Release；重現應使用下列 commit。

```bash
# 同程序 helper 配對：72 段
python tools/bedrock_performance.py --server-dir /tmp/otc-perf-helper \
  --runtime-ref 05229d7376db7079384dc433652ba07f1b65087e \
  --stations 80,800,3200 --origins 1,8,32 \
  --ticks 40 --warmup-ticks 5 --refresh-every-ticks 20 --timeout 1800

# main 整包：12 段
python tools/bedrock_performance.py --server-dir /tmp/otc-perf-main \
  --runtime-ref ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49 \
  --production-only --disable-experiments --scenarios 80:1,800:8,3200:32 \
  --ticks 40 --warmup-ticks 5 --refresh-every-ticks 20 --timeout 1800

# 候選整包：12 段
python tools/bedrock_performance.py --server-dir /tmp/otc-perf-candidate \
  --runtime-ref 05229d7376db7079384dc433652ba07f1b65087e \
  --production-only --scenarios 80:1,800:8,3200:32 \
  --ticks 40 --warmup-ticks 5 --refresh-every-ticks 20 --timeout 1800
```

## 實驗與部署相容性

- 本候選支援基線是 **Bedrock 26.60 / BDS 1.26.60.6**；manifest `@minecraft/server 2.12.0-beta`，開發型別 `2.12.0-beta.1.26.60-stable`，UI `2.0.0`。POI 在 26.50 已出現，並非 26.60 首次引入。
- Beta APIs 與 Points of Interest 都必須開啟。關閉 Beta APIs 時，引擎可能在腳本入口前拒絕 beta 相依；只有 POI 不可用時，production startup guard 才有機會停止初始化。這不是自動降級為 stable 掃描版本。
- Beta 模組不承諾向後相容或自動升級。`min_engine_version` 是最低要求，不是承諾所有以後版本；BDS／客戶端升級時核對可用 beta 模組。
- before-place／before-break 不讀 POI，因官方查詢也不能在 restricted execution 執行。同步取消和權限仍由原資料判定。
- 本修改不需要 server-net/server-admin 權限，不更改其他包；真實跨包、客戶端和多人結果以另行實測為準。
- 菜單定期重新選牌仍是既有 Bedrock 適配；Java 有效綁定優先保留的行為尚未改回，因此不宣稱完整 Java 一致。

## 主要來源

- [Java 供應架範圍](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/RestaurantSupplyCompatApi.java)
- [Java 冰箱範圍](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/IngredientSourceCompatApi.java)
- [Java 操作台呼叫半徑](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java)
- [Microsoft POI 方法、查詢形狀及執行限制](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/poiblockmanager?view=minecraft-bedrock-experimental)
- [Microsoft Beta API 版本規則](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/versioning?view=minecraft-bedrock-stable)
- [26.60 官方更新紀錄](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog)
- [Mojang 原生 Server Tick Time 計算](https://github.com/Mojang/minecraft-debugger/blob/075c0ed8086e0dbd939d15210c594113323c6e19/webview-ui/src/diagnostics_panel/prefabs/tabs/ServerTiming.tsx)

## 尚未完成

真實玩家客戶端、雙人同時操作、實際玩家舊世界與真多人性能尚未執行，見 [CLIENT_RETEST.md](CLIENT_RETEST.md)。不更新 LIVE，不以原生成功代填這些結果。
