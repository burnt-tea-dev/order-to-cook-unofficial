# Order To Cook 26.60 POI：本輪來源、修復與性能審查

日期：2026-11-04（香港）。開發線：[PR #11](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11)。

## 來源與範圍

本輪開始時 PR #11 為 Draft、未合併，head `dd54ea33d12d058108098288165042af1b692169`；最新 main 為 `ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`。本輪把該 main 整合回同一分支，保留三語 README、獨立指南及 candidate workflow 的主線改動，沒有另開平行 POI PR。

候選 **0.1.5-alpha.1**，BP／RP **[0,1,5]**，保留 UUID。0.1.3-alpha.1 已有歷史證據，0.1.4-alpha.1 已由另一 stable crafting 開發線使用，因此這次來源使用不同身份。

被測 runtime tree SHA-256：

```text
e3c36f652ba50e7c646d2955109222de7f48a07503bd83ac48d39321026b00f1
```

原生／性能 JSON 以該指紋綁定實際測量來源；原生工具注入的 QA entry 只在隔離測試目錄，不進正式 BP。歷史 [0.1.3 報告](../UNRELEASED-poi-discovery.md)保留原指紋，不能作為本輪新來源成功證據。

## 本輪已修復的實際問題

1. `upgradeForm()` 兩次忽略 `syncMenu()` 的變更回傳，取消升級或確認時未達條件會留下只存在記憶體的菜單換綁；管理員刷新遇到空菜單亦會漏存。三個修復前失敗的回歸，修復後通過；沿用唯一 `saveRestaurant()`，沒有第二個存檔 owner。
2. 固定 Java `RestaurantSupplyCompatApi.targets()` 對每軸 ±5 全部掃描，沒有排除立方角落。舊 Bedrock／原 POI PR 的球形供應架搜尋錯誤；現在操作台以 POI `getInSquare()` 加逐軸精篩，恢復兩種架子的立方範圍。冰箱範圍沒有擴大。幾何及正式打包／裝盤三個回歸同樣經修復前失敗、修復後成功。
3. 三語安裝說明統一新版本／Beta APIs／POI 需求，避免整合主線後英文／簡中仍指示 1.21.100 stable API 與關閉實驗。

## 查詢規則與權威資料

| 類型 | 最終搜尋規則 | 權限／資料判定 |
|---|---|---|
| 立牌 | 水平圓半徑 24、Y±8；總營養優先，同分按距離 | 實際載入方塊＋原 station；店主／員工擁有或無 owner；未授權立牌不納入 |
| 椅子 | 水平圓半徑 24、Y±8；從可用空椅隨機選 | 原 rider、頭頂空間及座位規則；POI ticket 不代表使用權 |
| 冰箱 | 三維半徑 24，只接下半格 | 原 station＋原生 inventory；上半不重複計庫存；提交取料仍驗權 |
| 包裝架 | 各軸 ±5，按三維距離排序 | 原供應量、餐廳／使用者權限 |
| 餐盤架 | 各軸 ±5，按三維距離排序 | 原供應量、餐廳／使用者權限 |

五份 POI 定義只使用 `ordertocook:*`，tickets=0、空 tags。查詢不執行 take/release/addTemporary；不宣告 vanilla 村民標籤，也不改寫其他 Addon 或 `player.json`。POI 位置必須重新讀取實際方塊，然後以座標接回原 canonical Map。沒有記錄的方塊不會自動建 owner／庫存；陳舊類型不會被視為新設備。

新增的正式模組測試確認：五種設備的員工撤權；鄰店較近的冰箱／兩種架子不會被越權耗用；缺 canonical 記錄與方塊類型不符時保持原資料。這些是實際 runtime 模組加可控世界／玩家替身，不是原生多人驗收。

`nearbyStations()` 已不再展開所有工作站；但 `nearestRestaurant()` 的同步權限查詢、每秒餐廳巡檢與 station 進度巡檢仍存在，設備加工、實體與保存成本亦未消失。不能把一條搜尋改動稱為完整伺服器成本已下降。

## 驗證結果

本輪 `npm run verify`：**362／362** Node 測試，官方固定 beta 型別檢查、291 JSON 靜態檢查及 BP／RP／mcaddon 建置通過；Python **12／12**、compliance／release policy 通過。

原生功能、生命週期與性能的完成結果及數據在測試完成後填入本節；沒有完成的項目不標 PASS。

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
