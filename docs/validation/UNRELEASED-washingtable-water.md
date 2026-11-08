# 洗碗檯水面：來源契約與離線驗證

日期：2026-11-08。基線 `8979974bd4e1117e583bcbc705592065b3163a3d`；本修正未變更版本、pack UUID、玩法腳本或發布身分。

以上是凍結身分前的來源候選紀錄。其後已整合 `.44` 並建立新的 `.45` 配對候選；最新 908 tests、建置及來源同步結果見[整合報告](0.1.45-alpha.1/WASHING_WATER.md)，不要把本頁最初的身分守門結果當作最新狀態。

## 已確認缺口

固定上游 [`e59e3db` 的 Forge renderer](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/WashingTableWaterRenderer.java) 在原本模型以外繪製水面：

- X=3–13、Z=3–12、Y=15.08 像素，無厚度；始終存在，與盤數／手洗 phase 無關。
- 頂點 `(3,3)→(13,3)→(13,12)→(3,12)` 的 UV 依次為 `(0,0)→(1,0)→(1,1)→(0,1)`。
- `entityTranslucent`、白色頂點、`disableCull`；原 water.png 為 32×32，alpha=133；原本體為 64×64，alpha 僅有 0／255。原檔像素不修改。
- north／east／south／west 的 renderer 旋轉為 0／270／180／90 度，與現有 Bedrock 0／−90／180／90 的數值契約相同。
- Java 物品模型只繼承 `washingtable_idle`，不執行方塊實體 renderer。

舊 Bedrock 的 11 個世界模型只有本體／髒盤面的 material_instance；即使 water.png 已複製及材質已宣告，也沒有任何面引用水材質。這是可由來源與實際輸出確認的漏轉，並非新設計的水效果。

原 renderer 原封不動收入來源子集，Git blob `a47acf4717344c0196066cccbf199c8c21347585`，SHA-256 `f6f7b7b7781e30acded9d3e2cf17ad6d8ab01d234dd1e2b2d517fd4ea9130d1d`。來源檔的既有亂碼註解亦保留，以維持精確位元組和雜湊。

## 修正及材質界線

`add_washingtable_water` 只解析已知 Java 常數／頂點契約，不執行 Java。全部 11 個世界模型增加一個 origin `[-5,15.08,-5]`、size `[10,0,9]` 的 cube，只有 up／down 兩面。兩面繞序相反，各自覆蓋 90 平方像素；不是沒有面積的 `[0,0,0]` 佔位。頂面 UV `[16,16]`、size `[-16,-16]`；底面 UV `[16,0]`、size `[-16,16]`。它們對應同一物理角點，不以水圖純色為由省略方向測試。

[官方 Material Instance 定義](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/content/forms/block/material_instance.form.json) 說明同一方塊每個材質必須使用相同 render_method；`alpha_test` 不支援半透明，`blend` 支援。因此世界本體、水及 wildcard 均為 blend，不混合 alpha_test／blend。水面不作朝向調暗；原本體其他光照欄位保持。沒有聲稱 blend 的透明排序與 Java 的獨立 renderer 相同。

另從原 `models/item/washingtable.json` 生成 10 個本體 cube 的乾檯 `washingtable_item`，以 `minecraft:item_visual` 指定其 geometry 與 alpha_test 材質，避免把世界水面加到持物／物品欄。元件依據[官方 item_visual 文件](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/creator/Reference/Content/BlockReference/Examples/BlockComponents/minecraftBlock_item_visual.md)：最低 format 1.21.60；本方塊為 1.21.100、包目標為 1.26.60。官方[1.26.30 更新](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/creator/Documents/Update1.26.30.md)另記載已修正世界 material_instances 覆蓋持物 item_visual 材質的問題；本輪沒有啟動客戶端驗證其實際效果。

本體／髒盤 geometry、原 PNG、世界狀態、碰撞、選取、互動、配方、掉落及其他設備產物不變。每個水面 geometry、方塊材質與乾檯物品均記錄來源 provenance。

## 實際驗證

- `python -m unittest discover -s tests -p test_appliance_geometry.py`：28 項通過，其中新增 5 項水面測試，實際呼叫 make_blocks 後比對正式輸出。
- 11 個世界狀態 × 4 個方向 × 2 面逐角點／UV 契約比對；來源 emitVertex 的角點為獨立 oracle，未把 converter 自己生成的 UV 當成預期答案。此測試核對數值和狀態分派，不聲稱已證實原生引擎旋轉行為。
- 原 10 個本體 cube、0–10 個髒盤 cube 保持；每個世界模型只有新增水片，所有材質一致 blend；item_visual 仍是無水、無盤、alpha_test 的原乾檯。
- renderer Git blob／SHA-256、來源子集、12 個 renderer provenance 條目、原 PNG／alpha 逐一核對。來源尺寸變動會改動生成平面；不支援的 UV／材質變更會明確拒絕。
- 完整離線轉換到 `/tmp` 後，洗碗檯相關產物與工作樹位元組一致。另發現三份語言檔有既有生成來源／正式輸出差異：重產會把裝袋指南 title／step1–3 改回較舊的僅外送措辭，並移動機器數量 key；不只是排序。這些重產語系輸出未納入本修正，整合時不可覆蓋已完成的堂食裝袋文字。
- `npm run verify`：812 項 JavaScript 測試、TypeScript 及 pack 靜態檢查通過；368 個 JSON、299 個 geometry、361 個 permutation，資源錯誤為零。build 因仍沿用基線身分，正確停止於 `BP payload changed; freeze a fresh paired release identity before exporting`。沒有把此結果記為整套 verify 通過，也沒有輸出舊身分的包。
- Dining 4 項及 CI scope 8 項通過。`check_compliance.py` 的來源／授權檢查錯誤為零，保留既有權利範圍 advisory 及無 dist 的警告；`check_release_policy.py` 因無新 build-info／包而未通過發布檢查。整合者須先建立新的配對身分，再重跑建置及發布檢查。
- 完整轉換同時校正 manifest 中三份既有 guidebook 來源的過期 SHA-256，沒有修改其原檔或對應語言產物。水面之外的 11 個原有 geometry 移除新增水片後與基線 JSON 完全相同。

## 尚未驗收

後續已補[雲端 Blockbench 前後證據](visual-audio/blockbench-20261108/washing-water/README.md)：0／5／10 盤、乾檯物品與同候選診斷共 8 場景／16 張原始 GUI 截圖。5 盤 source 等價／候選側的水下盤遮擋並不完全相同，原因未證實，報告保留此差異，不以它宣稱原生透明材質通過。

本輪未啟動 Java、Minecraft、BDS 或修改 LIVE；未建立新發布身分。Blockbench 的模型／場景檢視不等於 Bedrock 遊戲畫面驗收。仍需原生客戶端確認全部方向與盤數、水片背面是否只混合一次、整體 blend 的本體遮擋／透明排序、與池壁的邊緣、遠距離取樣，以及乾檯物品欄／手持／地上物品。這些限制不以服務端載入或離線測試消除。
