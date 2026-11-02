# 未發布：26.60 POI 工作站搜尋候選

日期：2026-11-02（香港）。基於主線 `a118cd5a15cd02652b66d91a0524ca8c04cbbb03`。
本頁對應未發布 `0.1.3-alpha.1` 候選來源；BP／RP 均升為 `[0,1,3]` 並保留 UUID，不重用 alpha.3 舊下載、舊雜湊或舊客戶端驗收。
沒有發布 Release、部署 LIVE 或修改既有使用者世界。

## 問題與修復範圍

既有 `nearbyStations()`、立牌及椅子搜尋展開全部工作站記錄後再篩選；餐廳數與設備數增加時，重複處理的記錄也增加。此候選把附近候選位置交給引擎 POI，將結果按座標接回原本單一 canonical 記錄。

- 五種定義直接放在本 BP 的 `poi/blocks/`：立牌、椅子、冰箱、包裝架、餐盤架。每種用自己的 block ID 作 POI identifier，`tickets: 0`；不新增配套私包。
- `station_poi.js` 只查詢、篩選與排序，不保存第二份位置名冊，不以 `addTemporary` 建立持久資料。
- 立牌／冰箱／供應架仍須有原 canonical 工作站記錄；發現位置不建立或覆寫店主、菜單、庫存及供應量。食材交易與失敗回復仍由既有 inventory 邏輯負責。
- 椅子候選仍經實際方塊、頭頂空間、附近玩家／顧客及 rider 驗證。POI ticket 不代表已坐下，也不取代座位 entity 或訂單關聯。
- `nearestRestaurant()` 保留原 canonical 記錄搜尋，供 `beforeOnPlayerPlace` 和 `playerBreakBlock` 在同一事件取消放置／破壞。這兩條安全路徑不讀 POI manager。
- 啟動時缺少 POI 能力會明確停止並保留存檔。執行期短暫查詢失敗會延後新顧客／新候選；餐點到期、已完成刷新仍保存，不把查詢失敗當成「沒有設備」或站立 fallback。

## Java 規則與範圍

| 搜尋 | 幾何與選擇 |
| --- | --- |
| 菜單立牌 | 水平圓半徑24、Y±8；最高總營養優先，同分較近者優先。修正舊 Bedrock 版本納入正方形角落的差異。 |
| 顧客椅子 | 水平圓半徑24、Y±8；實際空椅中均勻隨機選取，修正舊移植總取最近者的差異。 |
| 冰箱 | 三維球形半徑24；只採下半格，避免同一庫存因上／下兩格重複出現。 |
| 包裝架／餐盤架 | 三維球形半徑5；按距離搜尋，再檢查供應量與使用權。 |

固定來源：Java [OrderMachineBlockEntity.findBestBoardPos](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java)、[OrderNpcManager.findEmptyChair](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java)。目前仍定期重新選菜單牌；原版已綁立牌尚在時維持綁定的完整行為不在此修復範圍。

## 版本與引擎契約

- 最低引擎：`[1,26,60]`；manifest 模組：`@minecraft/server 2.12.0-beta`、`@minecraft/server-ui 2.0.0`。
- 編譯宣告固定：`@minecraft/server@2.12.0-beta.1.26.60-stable`，不跟隨浮動 `beta`。
- 世界須啟用 Beta APIs 與 Points of Interest。BDS 實測旗標為 `gametest=1`、`poi=1`，啟動日誌顯示 `gtst, epoi`。不新增未經文件化的 manifest 實驗欄位。
- POI 定義：`format_version: 1.26.40`，根鍵 `minecraft:poi_block`，使用已驗證的 `blocks: [blockId]`。
- 查詢使用 `dimension.poiManager.blocks.getInRange()`／`getInSquare()`；從 `hit.position` 取得位置，再讀實際 block。26.60.6 原生 `hit.type` 會是 `undefined`，即使 npm 宣告有該屬性，因此不依賴它。
- `getInSquare()` 提供包圍立方體，腳本再精篩 Java 圓柱幾何。結果包含位置不代表該區塊此刻可用，必須保留 `getBlock()`／類型／狀態檢查；索引失效或卸載不能造成幽靈庫存。

API 依據：[PoiBlockManager](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/poiblockmanager?view=minecraft-bedrock-experimental)、[26.60 更新日誌](https://www.minecraft.net/en-us/article/minecraft--bedrock-edition-26-60-changelog)。此 PR 沒有宣稱 POI 自動提供顧客尋路、GUI、庫存、動畫或加工排程。

## 已完成驗證

1. `npm run verify`：18個 Node 測試檔通過；官方26.60型別檢查通過；291份 JSON、12種方塊、5種實體、240份 geometry 的靜態檢查無錯；BP／RP／mcaddon 建置成功。
2. 新 `tests/station-poi.test.js` 的11例檢查範圍、排序、舊／卸載命中、冰箱下半、缺API啟動、canonical資料不變、before-event零POI存取，以及菜單／椅子查詢故障後的持久化與重試。
3. `tests/entities.test.js` 共36例通過，含隨機空椅、升高邊界，以及單筆椅子查詢故障不走站立 fallback、不阻擋外送顧客重試。
4. Python 幾何重建與 QA 世界保護測試共12例、compliance 與 release-policy 檢查通過。兩個既有 CI workflow 均執行 `test_*.py`，涵蓋新增7例 QA 世界保護；不代表畫面驗收。
5. 已直接檢查建出的 BP zip，包含全部5份 `poi/blocks/*.json`。
6. **真實 BDS 1.26.60.6 的最終候選探針10／10通過**：5種ticket零的索引、近架排序、canonical資料join、冰箱不重複、高低椅子邊界、正方形角落排除、菜單同分近者、真實顧客／座位騎乘及拆除失效。機器、方塊、POI、實體、rider均為原生；只有「附近存在玩家」條件使用測試替身，沒有真玩家連線。詳見 [原生結果](UNRELEASED-poi-native.json) 與 [探針來源](../../tests/bedrock-poi-checks.js)。
7. 修復既有 `tools/bedrock_smoke.py`：全新隔離 BDS 先生成無附加包的 QA 世界、正常停服，才備份並設定 Beta APIs／POI，再載入候選與探針。拒絕未標記既有世界、非 QA 世界、符號連結及仍在運行的同目錄伺服器。用未經手動預置的 BDS 1.26.60.6 對最終來源執行 [initial 127／127](0.1.3-alpha.1/native-initial.json) 與同一 QA 世界 [reload 15／15](0.1.3-alpha.1/native-reload.json)，均無 addonErrors，runtime 指紋與下方一致。這是同候選存檔重載，不是舊版世界升級驗收。

最終來源的 `runtimeTreeSha256`：

```text
cd7fa5e5d124f31ca5a30ef7ba6b356df81e738ebd7dfa469788bf54ec5d62f0
```

原生探針首輪在沒有玩家的 QA 世界未通過顧客生成前置條件；補上與既有 native harness 相同的附近玩家替身後，再對最終候選重跑10項全部通過。沒有為取得通過結果修改正式服務的玩家距離保護。

## 重現與尚未完成的驗收

在獨立可棄置世界啟用上述兩個實驗，載入此來源建出的 BP／RP。僅在 QA 副本，把 `tests/bedrock-poi-checks.js` 複製到 BP scripts 旁，以 QA entry 先匯入 `main.js`、再匯入該探針；它在原點附近的 Y70–79 放置測試設備並輸出 `OTC_POI_REPORT`。不得把探針載入玩家世界；正式建置只收錄 runtime，不含 tests。

既有 native runner 可直接依 README 執行 `initial`／`reload`，無需手動編輯世界旗標。它只修改有工具標記的獨立 QA 世界，正常玩家仍應透過遊戲世界設定啟用兩項實驗。

以下仍須在此候選包完成，PR維持draft：

- 真客戶端及雙人操作：放置限制、撤權後破壞保護、搶椅、裝盤扣料、跨餐廳供應範圍。
- 既有0.1.2 OTC世界的完整跨版本資料升級，以及真實遊玩中區塊卸載／重載、重啟後owner/menu/inventory/order一致性；本輪同候選 QA 存檔重載及一般POI探針不能替代舊世界整包資料驗收。
- 沒有進行TPS／CPU基準測量，故不宣稱具體效能改善百分比。設備加工／動畫的既有tick排程不由POI自動取代。
