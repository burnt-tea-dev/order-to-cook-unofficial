# 鄰桌收盤：0.1.17-alpha.1

2026-11-05，BDS1.26.60.6／stable server2.11.0／ui2.0.0。QA另用gametest1.0.0-beta及gametest／Upcoming Creator Features；正式包沒有增加API、player.json或排程。

固定Java [FoodPlateBlock.use／handleEarlyPickupPenalty](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)在5秒前點取時，先交付髒盤，再從 `new AABB(platePos).inflate(3.0)` 找第一個仍在action5／6／7的顧客，重新開始10tick中斷。它不按餐盤訂單或最近距離排序。兩桌鄰近時，取第二盤可能中斷第一桌；無目標則不假稱有人提前離開。`onRemove`仍只掉盤，5秒後取髒盤也不執行這個提前中斷。

0.1.17沿原生查詢順序選目標，只取消該人的待付加賞。餐盤 `foodStartedAt` 與反應 `startedAt` 分開：中斷另一桌不會重播或延長其食品階段。被中斷者即使已取髒盤、沒有pending meal，既有訂單仍保存新反應；歷史裁剪時仍可由native actor保留已送出的中斷時間。舊餐盤缺少新欄位時沿用原 `startedAt`，不產生新餐盤。

同一tick的 `setProperty` 尚未反映在native視覺getter時，已提交餐點的反應才是依據，避免剛交餐立即收盤漏選。native `volume` 包含端點格，因此extent6對應Java邊長7的box；不是半徑3的球。實際0.6寬顧客中心在邊界外0.2仍因身體重疊而入選，外0.4則排除；對角也能入選。相關能力入口見[EntityQueryOptions](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityqueryoptions?view=minecraft-bedrock-stable)，具體端點行為採本次BDS觀察。

[原生資料](nearby-pickup-native.json)保留最終同世界refine首次20項及磁碟重啟5項，均正常stop、exit0、無內容錯誤或OOM。[觀察器](../../../tests/bedrock-nearby-meal-checks.js)以 `scriptevent ordertocook:qa_nearby_meal refine` 重用同一QA世界與前段有效對照；省略refine可在新的隔離世界執行完整前段。需載入測試座標區域，例如 `tickingarea add circle 56 5 0 3 otc_nearby_qa true`。測試只可在可刪除QA世界執行。

最終場景覆蓋兩個相鄰餐廳、實際被選者的native反應與金幣、另一盤食品階段、方盒角落及身體邊界、已收盤仍在吃的顧客，以及同世界保存重啟不重付。先前漏選、錯QA世界名稱和volume7過大各自保留失敗，不改記通過；七個位置的volume觀察只是API量測，沒有另算玩法測試。單元／服務回歸還涵蓋顧客已移開、等待者、重複action7、保存／庫存失敗及歷史裁剪。

這是伺服器與adapter驅動的SimulatedPlayer範圍，不推定真人輸入或客戶端聲畫。原毫秒時鐘／5tick取樣、原生給幣與世界記錄非共同原子提交，以及未移植的女僕整合仍在。兩個已終止QA引擎／世界副本在測試後清理，原始日誌及來源保留；沒有安裝LIVE。
