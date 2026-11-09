# NPC 生成：Forge 固定來源、獨立規則候選與待接線差異

## 身分與範圍

Java 基準固定為 `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`，**Forge 1.20.1**。本輪對照 main `dbb2574154a54cc5ad69e75e71d23900a98a79fe`（0.1.48-alpha.1），接續同一 Draft PR #63。

前輪誤以 Fabric 檔案作這份 Forge 任務的直接來源，並將支撐條件概括為「完整實體方塊」。現予更正：Forge 明確呼叫 `state.isRedstoneConductor(world, below)`，或接受原作椅子例外；不能把名稱不同的 API、完整碰撞面、Bedrock `isSolid` 或四角射線自行當作等價證據。

**本 PR 沒有改變遊戲中的生成行為。** `prototypes/npc-spawn/rules.js` 是待整合的純規則候選，不被 runtime 引入，也不打入 BP。前輪 `tests/helpers/npc-spawn-rules.js` 已由此檔取代，避免維護兩套候選算法。生產 `entities.js`／`main.js`／`config.js`、共用 PARITY／README、版本、manifest、CI 工作流程皆沒有本線修改。同步最新 main 不代表取得共用檔案編輯權。

## 直接來源

全部連結固定到上述 Java 提交，不用浮動 main：

- [Forge OrderNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java)：`findSpawnPosNormal`、`findFallbackPosNearMachine`、`findSpawnPosDelivery`、`tryFindDrySpot`、`checkLoadedDeliveryColumn`、`isHeadClear`、`isSpawnBaseValid`、`isDry`、`spawnForDelivery`；另核對 `findEmptyChair`／`isChairOccupied`。
- [Forge LongDistanceDeliveryNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/LongDistanceDeliveryNpcManager.java)：`spawn` 只使用主要配送搜尋，失敗回傳 false。
- [核對的 Bedrock entities.js](https://github.com/burnt-tea-dev/order-to-cook-unofficial/blob/dbb2574154a54cc5ad69e75e71d23900a98a79fe/runtime/BP/scripts/entities.js)：`hasFullStandingSupport`、`findChair`、`standPosition`、`spawnCustomer`。

## 來源規則與主線差異

| 範圍 | Forge 固定來源 | 核對主線／本輪候選界線 |
| --- | --- | --- |
| 普通顧客椅子 | 水平圓半徑 24（含邊界）、機器 Y±8 並裁切世界範圍；x 升、z 升、y 降，首個合格即停 | 主線已註冊椅子的範圍及順序已有測試，不重寫；未登記世界椅子仍未發現，顯式世界 Y／fluid 規則未補齊 |
| 椅子安全 | 普通單檢查兩格空氣、支撐、腳部與下方流體、佔用 | 主線 `findChair` 只明查椅子、claim、佔用及兩格空氣，沒有普通單的明確椅子流體檢查 |
| 到店椅子 | `findEmptyChair` 收集後隨機；它沒有普通單的獨立 `isDry` 呼叫 | 不把普通單的 dryness 規則無條件套到到店，也不移除到店無椅 admission 保護 |
| 佔用 | 椅子 AABB 向上下擴 1；有乘客的 SeatEntity／ArmorStand，以及非盔甲座 LivingEntity | 主線檢查 seat 乘客及 player/customer 的位置條件；不是所有 LivingEntity 或相同 AABB。既有玩家／顧客測試不能證明完整佔用等價 |
| 普通無合格椅子 | 半徑 5 圓盤，共 81 個 XZ 柱；每柱用 `MOTION_BLOCKING_NO_LEAVES` 的 spawn Y；收齊安全點再均勻抽一個 | 主線先按距離找 requested Y±4，再只射線查前 24 柱。新候選提供完整候選池，但尚未接線 |
| fallback 佔用 | `findFallbackPosNearMachine` 本身不呼叫 `isChairOccupied`，支撐仍有原作椅子例外 | 不自行加新玩法條件；本候選只返回座標，沒有重寫後續創建／入座 |
| 配送主要搜尋 | 先測目標 XZ 的高度圖 spawn Y；失敗再 8／64 的方形周界圈搜尋 | 主線是半徑 2 圓盤與局部 Y 搜尋，之後射線查前 5 柱；新候選保留 Java 周界順序 |
| 普通配送重試 | 主要失敗後重新查 10／64，再重新查 50／256 | 新候選分階段且不去重；遠距只走主要階段 |
| 高度 | spawn Y 直接取高度圖，不取目標／機器 Y±4；feet Y>=maxBuildHeight 失敗；lowY 只記診斷 | 候選要求呼叫方提供真正語義的 topY。它不把 `getTopmostBlock`、射線或頂面 +1 的假設冒充已驗證高度圖 |
| 流體／支撐 | 腳及頭須空氣；支撐非空氣且為椅子或 `isRedstoneConductor`；腳及下方 fluid state 須空 | 新候選使用明確 BlockFacts 契約，未知／讀取例外拒絕。不是已完成 Bedrock 方塊分類 |
| 沒有安全點 | 普通返回不生成；配送全部適用階段失敗回 false；不回傳未驗證目標兜底 | 候選返回 undefined，不配置實體或寫入；生產既有 pending／重試生命週期不變 |

### 不要誤讀半徑與次數

每圈 8r 個柱，順序為 dx 升序交替 z=-r/+r，再 dz 升序交替 x=-r/+r，角落不重複。64 次在第 4 圈中途結束，最後偏移 `(3,4)`；256 次在第 8 圈中途結束，最後 `(7,8)`。因此 8／64 與 10／64 在地形不變時讀同一序列，50／256 也不是完整搜尋到 50 格。普通配送失敗最多 1+64+64+256=385 個柱探測，遠距最多 65；**這是規則計數，不是性能量測**。未載入柱仍消耗次數，後續重試重讀舊柱，可能觀察到新狀態。

### 明示載入適配

Java 明確的 loaded gate 位於配送 ring-column helper，不能因此聲稱所有 Java 高度圖讀取都先驗載入。為遵守本移植不強載的限制，候選對普通 fallback、配送原目標、所有 ring 柱都要求 `isLoadedColumn===true`，再讀高度及方塊。讀取中卸載／例外時跳過；沒有命令、tickingarea、ticket 或原生生成呼叫。

此候選沒有生產 Bedrock world adapter。[官方 Dimension 文件](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable) 的 `getTopmostBlock` 只保證取得最高方塊，沒有保證 `MOTION_BLOCKING_NO_LEAVES` 等價；[Block 文件](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/block?view=minecraft-bedrock-experimental) 將 `isSolid` 標為 pre-release，且明說 `isLiquid` 不含 waterlogged 方塊。不能悄悄增加 Beta 依賴或用這些名稱替代 Forge predicate。世界上緣的 out-of-build air 在純 Java 契約 fixture 中明示；Bedrock 無法讀取時應拒絕，不能讓測試假裝原生讀取已成功。

## owner 與未整合原因

核對時開放 PR 為 #11、#63；#11 仍有 `entities.js`／`main.js` 重疊。已有 [分工協調留言](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11#issuecomment-6731781713)，但未收到排他 owner／交接批准。前輪稱「#11 擁有這些檔案」過於肯定：PR 重疊只能證明需協調，不能代表授權或排他 ownership。`config.js` 也不因沒有開放 diff 就自動授權本線修改。

未登記椅子的探索另見 [獨立設計](../design/UNREGISTERED_CHAIR_DISCOVERY.md)，本輪沒有加入掃描或聲稱 POI 性能改善。

## 測試入口與證據分層

`npm test` 的既有 `node --test tests/*.test.js` 會執行兩個定點檔，沒有另改入口或 CI：

- `tests/npc-spawn-rules.test.js`：12 項候選規則案例，固定 RNG、圓盤邊界、負座標、高度圖 Y、完整隨機池、環順序／實際上限、重複重試、普通與遠距分流、未載入與中途例外、未知資料、流體／非導體支撐／椅子例外、世界 Y 和無安全點。隔離 Node v22.16.0 已執行 **12/12 PASS**。
- `tests/npc-spawn-preservation.test.js`：對未修改的正式 entity service 增加 4 項案例，普通入座及配送的保存拒絕回退／資源清理／重試去重、配送無安全點不保存、含水支撐在形狀射線之前拒絕。仍使用既有 `appliances.harness.js`，不複製 service，也不把候選冒充正式 runtime。
- 已有 `entities.test.js`、`chair-parity.test.js`、`normal-chair-scan.test.js` 的佔用、範圍、未載入 anchor、claim、去重及薄支撐覆蓋繼續沿用，沒有重新複製相同案例。

正式 service 的新增測試及完整 `npm run verify` 結果以 **#63 該次 head 的 CI 日誌／PR 留言**為準；不將前輪 d26aeb6 的成功 CI 借用為本輪結果。初輪 ff9cadc 曾因未接線模組進入 BP 而觸發配對發布身分守門失敗；該歷史保留，本輪不改版本來隱藏它。

保存注入只涵蓋「提交前明確拋錯」，不包含原生寫入已生效後拋錯、remove 拋錯、實體配置已生效後拋錯或原生磁碟重啟。候選未連接 `spawnCustomer`，因此通過是規則／既有保護的離線證據，不是遊戲修復驗收、跨平台高度圖／支撐驗證或 100% 還原。

## 接線時的最小邊界

取得 owner 協調後才替換 NPC 專用位置選擇；不要全域替換也供載具使用的 `standPosition`。保留原 `loadedCustomers`／persisted anchor、player-near gate、chairClaims、save rollback 和排程重試；fallback 模組不持有訂單／餐廳副本，不自行存檔或刪單。先解決高度圖／Forge 支撐 predicate 的 Bedrock 能力證據，再由整合代理處理配對版本及實際接線驗證。
