# Java 來源模型的 Blockbench 對照取樣

本頁接續 [正式 RP 取樣](../README.md)。圖片是同一台雲端 Blockbench Desktop 5.2.2 的原始視窗截圖。
**這是 Java 專案來源模型在 Blockbench 中的預覽，不是 Java Minecraft／GeckoLib 執行畫面，也不是逐像素一致性證明。**

## 輸入及預覽轉接

- 固定上游：`breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`，見 `upstream/source.lock.json`，保留 GPL-3.0-only 歸屬。
- 直接開啟 `upstream/reference/common/src/main/resources/assets/ordertocook/geo/block/` 的原始 `refrigerator.geo.json`、`dishwasher.geo.json`，再匯入同來源的原 PNG。沒有對來源幾何、UV 或 PNG 作修改。
- 對照的正式 RP 資產在 `71d8952`（.37）、`4bd2772`（.38）、`a1037b6`（.39）、`7373238`（.40）間相同。已核 `models`、`textures`、`animations`、`entity`、`animation_controllers`、轉換器及 appliance geometry 測試的 Git 差異為空。
- Blockbench 5.2.2 原生 Bedrock 動畫匯入器的 `getKeyframeDataPoints` 接受陣列、數值、`pre`／`post`，不直接處理 GeckoLib 的 `vector` 包裝；也不執行其自訂 easing。因此不能直接把原動畫載入後的靜止／線性結果稱為 Java 動作。
- 本目錄兩個 `.animation.json` **僅供驗收預覽**，不在 runtime、不打包、不供遊戲使用。動畫名稱加上 `animation.qa_java.` 前綴。
  - `java-dishwasher.animation.json`：僅遞迴拆除單一 `vector` 包裝，保留時間鍵、向量、loop、長度和其餘欄位。原檔沒有 easing。已逐結構比對與此轉換完全相等。
  - `java-refrigerator-open.animation.json`：只包含原始 `up_open`、`down_open`。以 Molang 表達原 GeckoLib 4 預設 `easeInElastic`：`1 - cos(t*pi/2)^3*cos(t*pi)`；Molang 的三角函數使用度數，故寫成 `90*t`、`180*t`。上門目標 -135 度、下門 -125 度，長度一秒。未轉接或測試 closing bounce／整櫃 squash。
- 轉接檢查可執行本目錄的 `verify_preview_adapters.py`。它同時在 1,001 個時間點核對冰箱表達式與既有來源曲線取樣器的數值，這只是數值檢查，不代替 GUI 或遊戲實測。

Blockbench 匯入器來源：[v5.2.2 bedrock_animation.js](https://github.com/JannisX11/blockbench/blob/v5.2.2/js/animations/bedrock_animation.js)。
GeckoLib 曲線的既有來源核對及誤差限制見 `tools/convert_assets.py` 與 [VISUAL_AUDIO_PARITY](../../../../VISUAL_AUDIO_PARITY.md)。

## 實際取樣及結果

| 原來源預覽 | 對照正式姿態 | 本次觀察 |
| --- | --- | --- |
| [冰箱中性](java-refrigerator-neutral.png) | 原來源完整櫃體 | 原 PNG、上下門及櫃體正常顯示。 |
| [上門 0.60 秒](java-refrigerator-upper-open-060.png) | `refrigerator_upper_6`，0.60 秒 | 內壁、層板及門架方向相符，未見正式姿態把內腔封死的表象。原來源是整櫃，正式 RP 上下半獨立，構圖不同。 |
| [下門 0.70 秒](java-refrigerator-lower-open-070.png) | `refrigerator_lower_7`，0.70 秒 | 內腔開口、層板與門內面相符。沒有據此驗收完整開關、反轉或上下半共同 squash。 |
| [髒盤投入 0.50 秒](java-dishwasher-dirty-in-050.png) | `dishwasher_2_5`，0.50 秒 | 原來源也有盤子懸於籃上方的投入中段，正式姿態不是錯誤漂浮。GUI 關閉 `clear_dish`，顯示六個 `drity_dish` cube。 |
| [乾淨盤輸出 0.78 秒](java-dishwasher-clean-out-078.png) | `dishwasher_4_10`，0.7778 秒 | 抽屜、籃框與乾淨盤的相對姿態一致；相差約 0.0022 秒，不當成精確同時間逐像素比較。GUI 關閉 `drity_dish`。 |
| [空抽屜 0.70 秒](java-dishwasher-empty-out-070.png) | `dishwasher_6_9`，0.70002 秒 | 原來源關閉兩組盤骨，空籃與突出抽屜相符。時間差 0.00002 秒。 |
| [原來源等角](java-dishwasher-empty-isometric.png)／[正式 RP 等角](bedrock-dishwasher-empty-isometric.png) | 同一 `Isometric Right (2:1)` 相機方向 | 籃框透明缺口與內壁材質均可見。不同視窗模式的中心／縮放構圖不同，不把像素差直接當資產差異。 |

本批八張新增圖及兩個轉接檔的雜湊見 [manifest.json](manifest.json)。沒有重存正式／來源模型，也沒有新增已確認的資產 bug。

## 尚未涵蓋

- 這次只依 phase 手動切換兩組盤骨，未套用 Java renderer 或 Bedrock `bone_visibility` 的 1／2／3／8／16 盤數條件。
- 原來源與正式 RP 不是同一原生引擎、同一世界、同一光線；不宣稱 Java／Bedrock 100% 視覺一致。
- 冰箱食物陳列、上下半共同 squash、有限姿態的剪切近似、完整反轉、多人預覽、原生透明面排序等既有缺口仍保留。
- 沒有啟動 Minecraft、BDS、LIVE 或用戶個人電腦。完整遊戲、聲音、粒子及控制器驗收仍未執行。
