# 洗碗檯遺漏水面：Blockbench 前後證據

2026-11-08，官方桌面 Blockbench 5.2.2，雲端隔離開發環境。基線為 `8979974bd4e1117e583bcbc705592065b3163a3d`，候選資產為 `46fd0f32035f73013acfae8f9aeb6ed241a61b4e`。沒有啟動 Java、Minecraft、BDS，沒有操作使用者電腦或 LIVE。

## 有限結論

固定 Java 的已註冊 `WashingTableWaterRenderer` 在模型之外畫水；舊正式輸出雖有水貼圖和材質，11 個盤數模型卻沒有任何水面。這是來源繪製路徑未被移植，不是原模型本來就沒有水。候選加入來源的 10×9 px、Y=15.08 平面，沒有改本體／盤子形狀或 PNG。物品另保持 Java 原本的乾檯。

此批實際開啟 8 個 review-only `.bbmodel` 場景，留下 16 張未經修改的應用程式截圖。0、5、10 盤的前後場景都能看見補回的水面；乾檯物品對照沒有被加入水。**這些證據只確認模型、面的位置與原始貼圖載入，並不證明 Bedrock 的透明排序、材質、物品顯示或遊戲運作已驗收。**

原版參考不是 Java 遊戲截圖：場景直接讀固定原 Java body／plate JSON，再按照固定 renderer 的常數另建平面。它不執行 Java renderer。正式側直接讀基線或候選 Bedrock geometry，以 Blockbench 座標解碼和純平移並排。原 PNG bytes 保留；body 為 64×64，水為 32×32，geometry 的 16 虛擬 UV 依各 PNG 尺寸縮放。沒有重繪材質、改水的 alpha=133，或用 Python 渲染代替 GUI。

來源與 runtime 轉換細節、官方 uniform render_method / item_visual 依據，以及 28 項 appliance 測試見[來源契約](../../../UNRELEASED-washingtable-water.md)。

## 畫面如何讀

所有 source／runtime 配對的 source 位置是模型 X=-14，runtime 是 X=+14。**頂視圖原版等價在左、runtime 在右；預設斜視圖原版等價在右前、runtime 在左後。** 請勿把斜視畫面的位置看反。相機預設／縮放並非像素對齊，尤其 0 盤頂視縮放不同，不能以兩張截圖的像素差當作幾何差。

| 場景 | 斜視 | 頂視 | 實際看到的範圍 |
| --- | --- | --- | --- |
| 0 盤，修正前 | [圖](screenshots/before-0-isometric.png) | [圖](screenshots/before-0-top.png) | 原版等價有水，正式乾池缺水 |
| 0 盤，候選 | [圖](screenshots/after-0-isometric.png) | [圖](screenshots/after-0-top.png) | 候選水片補回池內 |
| 5 盤，修正前 | [圖](screenshots/before-5-isometric.png) | [圖](screenshots/before-5-top.png) | 中間盤數的缺水與盤子位置 |
| 5 盤，候選 | [圖](screenshots/after-5-isometric.png) | [圖](screenshots/after-5-top.png) | 水片存在；水下盤的 preview 遮擋差異見下文 |
| 10 盤，修正前 | [圖](screenshots/before-10-isometric.png) | [圖](screenshots/before-10-top.png) | 滿盤遮住部分池面，仍能辨識缺水 |
| 10 盤，候選 | [圖](screenshots/after-10-isometric.png) | [圖](screenshots/after-10-top.png) | 水片留在原高度，不抬升／移動盤子 |
| 同一 5 盤候選兩份 | [圖](screenshots/identical-candidates-5-isometric.png) | [圖](screenshots/identical-candidates-5-top.png) | 相同候選在兩位置的診斷對照 |
| 乾檯物品 | [圖](screenshots/dry-item-isometric.png) | [圖](screenshots/dry-item-top.png) | source idle 與候選 item geometry 均無水、無盤 |

## 不能隱藏的 preview 差異

5 盤頂視中，source 等價場景的水下盤被遮住較多；候選側可見較多水下輪廓。獨立資料核對確認兩側本體／盤子 cube bounds、rotation、有效 pivot、face UV 相同；兩個相同候選的 control 也已實際開啟並保存。source 等價側把不同 Java 模型及 renderer 放在不同 review group，候選側是單一骨架。分組／透明繪製順序是可能原因，但本輪沒有證明其根因，不把差異忽略或包裝成「全部視覺一致」。

尤其 Blockbench free 格式不執行 Bedrock `minecraft:material_instances`，也不執行 Java `entityTranslucent`。官方要求一個方塊使用相同 render_method，因此候選的整個世界洗碗檯使用 blend，而 Java 的水由獨立 renderer 畫出。這仍是平台差異，需在授權的原生客戶端檢查水下盤／池壁遮擋、雙面是否只混合一次、遠距離、四個朝向、全部盤數，以及 item_visual 在物品欄／手持／地上的實際結果。沒有用此批 GUI 消除此限制。

## 可再現與保全

- `manifest.json` 記錄 30 個來源／候選輸入與 27 個 evidence 檔的 SHA-256。3 份舊正式 geometry 固定在 `fixtures/`，不依賴後續主線仍保留舊水面狀態。
- `build_scenes.py` 及 `scene_lib.py` 可重建這 8 個已檢視場景。source water 常數由精確 Git blob `a47acf4717344c0196066cccbf199c8c21347585` 解析，body 不經本專案 converter 重轉。helper 遇到不支援的 parent／rescale／box UV／inflate／mirror 會拒絕，不默默略過。
- `python docs/validation/visual-audio/blockbench-20261108/washing-water/build_scenes.py` 後執行同目錄 `verify_scenes.py`：所有場景 byte hash 重現；source/runtime 在 0／5／10 盤各 10／15／20 個 body cubes 的位置、UV、旋轉／有效 pivot 一致，只有平面缺漏差異；全部嵌入 PNG 與來源 bytes 相同，source／候選水面頂部 UV 相同。
- 水貼圖是單一 RGBA 色，GUI 無法判斷 UV 是否鏡像。上下兩面逐物理角點 UV 的數值測試位於 `tests/test_appliance_geometry.py`，不以這張純色圖代替 UV 驗證。
- 截圖為 `app.getScreenshot()` 的原始 bytes，沒有裁切、補畫或將預渲染圖放進 Blockbench 視窗。開啟過的分頁全部保留，沒有覆寫原資產或他人分頁。

本批沒有把未載入 GUI 的 1–4／6–9 盤算作 GUI 通過；這些狀態只受生成與數值回歸測試覆蓋。沒有新增發布身分或宣稱完整 Java 100% 視覺相同。
