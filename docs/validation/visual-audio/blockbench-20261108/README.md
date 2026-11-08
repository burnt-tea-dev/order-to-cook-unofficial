# Blockbench 實際 GUI 視覺取樣：2026-11-08

本輪使用雲端 Linux 的 **Blockbench 桌面版 5.2.2**，直接開啟正式 RP 的幾何、原 PNG 及顧客動畫。
下列圖片是實際應用程式視窗擷取，沒有以離線渲染、示意圖或生成圖片代替。

**結果：本次取樣未發現缺材質、明顯 UV 錯置或破面。這是編輯器取樣，不是完整動畫、真實 Minecraft 客戶端或 BDS 驗收。**
本輪沒有修改、重新匯出任何正式模型／材質／動畫，沒有建立新的 runtime 版本或發布包。

## 固定輸入與環境

- 最初載入：`71d8952a9d38cc9df9ad557e41338fbbc2f656ab`，`0.1.37-alpha.1`。
- 整理報告時主線：`4bd27721b56f5f11d9049da1fb6b0a371be68e52`，`0.1.38-alpha.1`。
- 兩提交的 `runtime/RP/models`、`textures`、`animations`、`entity`、`animation_controllers`、`tools/convert_assets.py` 及 `tests/test_appliance_geometry.py` 經 `git diff --exit-code` 比較，全部相同。以下觀察因此適用於這兩個提交的同一批資產，不延伸為新玩法測試。
- [官方 Blockbench v5.2.2](https://github.com/JannisX11/blockbench/releases/tag/v5.2.2) 的 `Blockbench_5.2.2.deb` SHA-256：`76ea903a2d0086a112f177586efdeba9a1a87ea0218b2f1bbb4b2dc3ce177031`，與官方 release asset digest 一致。
- 桌面版使用獨立設定目錄，未安裝 Blockbench MCP 外掛，未建立對外服務，未停用安全沙箱。未使用個人電腦、LIVE、Minecraft 客戶端或玩家世界。
- 網頁版先遇到 WebGL context 建立失敗，重載一次仍失敗，見 [網頁版錯誤畫面](evidence/blockbench-web-webgl-error.png)。桌面版隨後成功顯示模型；不把網頁版失敗算成資產錯誤。
- [manifest.json](manifest.json) 記錄正式輸入與原始截圖的 SHA-256、尺寸及基線。圖片保留完整 Blockbench 應用程式視窗。

## 已觀察的顧客

兩套模型均以各自的正式皮膚載入，64×64 材質顯示正常。兩張 PNG 與固定上游來源逐 byte 相同。
以預設斜前方及時間軸定點取樣觀察頭部、衣服、手臂、手部和腿部。沒有執行 controller 的完整遊戲狀態切換。

| 模型／片段 | 實際取樣 | 畫面 |
| --- | --- | --- |
| wide 中性外觀 | 正式 `customer.geo.json`／`otc_zombie_custom.png` | [中性](evidence/customer-wide-neutral.png) |
| slim 中性外觀 | 正式 `customer_slim.geo.json`／`otc_zombie_custom2.png` | [中性](evidence/customer-slim-neutral.png) |
| wide `customer_sit_1` | 約 0.58 秒的坐姿 | [坐姿](evidence/customer-wide-sit1.png) |
| slim `customer_sit_1` | 1.50 秒 | [坐姿](evidence/customer-slim-sit1.png) |
| slim `customer_sit_4` | 2.00 秒 | [另一坐姿](evidence/customer-slim-sit4-mid.png) |
| wide `npc_sitspawn` | 0.31 秒 | [坐姿產生](evidence/customer-wide-sitspawn-mid.png) |
| wide `npc_standspawn` | 0.31 秒 | [站姿產生](evidence/customer-wide-standspawn-mid.png) |
| wide `npc_sittake` | 1.00 秒 | [坐姿交餐](evidence/customer-wide-sittake-mid.png) |
| wide `npc_standtake` | 0.53 秒，另觀察 1.50 秒；3.00 秒末端縮至不可見 | [中段](evidence/customer-wide-standtake-mid.png)、[末端](evidence/customer-wide-standtake-end.png) |
| wide `npc_eat_scale_interrupt` | 0.25 秒，尚在縮小前的保持段 | [中斷片段](evidence/customer-wide-interrupt-mid.png) |
| wide `npc_eat_scale` | 2.53 秒，尚在最後縮小前的進食段 | [進食片段](evidence/customer-wide-eat-scale-mid.png) |
| wide `npc_eat_boom` | 5.81 秒末段膨脹；6.00 秒不可見 | [末段](evidence/customer-wide-eat-boom-late.png)、[末端](evidence/customer-wide-eat-boom-end.png) |

上表七種 action 都曾在 Blockbench 載入及取樣，但**沒有覆蓋每一幀、全部起迄過渡或兩套皮膚的所有動作組合**。
末端不可見符合對應動畫的零縮放；沒有測試遊戲裡實體的實際移除、粒子與晚加入追時鐘。

### 18 項 smooth／spline 提示

[編輯器提示畫面](evidence/customer-animation-warnings.png) 顯示 18 項插值提示，例如單一 smooth keyframe、最後 smooth keyframe 早於片段終點。
對照正式 JSON 後，18 個通道都來自固定腿部旋轉：四個 seated idle，以及 `npc_eat_boom`、`npc_eat_scale`、`npc_eat_scale_interrupt`、`npc_sittake`、`npc_sitspawn` 的左右腿。

逐通道移除上游 GeckoLib 的單層 `vector` 包裝後，時間鍵、角度及 `catmullrom` 標記與固定上游完全相同；每個通道內的角度亦為常數。
本輪沒有把這些提示當成新破圖，沒有為了消除提示改動原作者動作。這項來源核對不代替原生引擎的插值／循環測試。

## 已觀察的冰箱與洗碗機

均開啟正式的單一 `.geo.json`，再從原路徑匯入 PNG。只調整編輯器相機與縮放，沒有改 UV 或模型。

| 正式模型 | 本次觀察 | 畫面 |
| --- | --- | --- |
| `refrigerator_lower_7` | 已修數值邊界的下門中間姿態。可見櫃體內壁、層板、開口、門內面；沒有舊轉換器把開口填成實心背板的表象。 | [下門內側](evidence/refrigerator-lower7-interior.png) |
| `refrigerator_upper_6` | 已修數值邊界的上門中間姿態。上蓋、層板、內壁、門架與門面顯示完整。 | [上門內側](evidence/refrigerator-upper6-interior.png) |
| `dishwasher_6_9` | `empty_out` 預覽取樣。空籃與抽屜突出，籃框透明缺口可見。 | [空抽屜預覽](evidence/dishwasher-empty-preview.png) |
| `dishwasher_4_10` | `clear_out` 取樣。乾淨盤、抽屜、籃框與機身材質可見。 | [乾淨盤輸出](evidence/dishwasher-clean-output.png) |
| `dishwasher_2_5` | `dirty_in` 取樣。含髒污的盤子位於投入途中，尚未落入籃內。這是該片段姿態，不當成靜止完成狀態。 | [髒盤投入](evidence/dishwasher-dirty-input.png) |

冰箱上下半分別載入，沒有把這兩張圖說成整台冰箱同時開關。洗碗機原始幾何含多個盤骨，本輪未套用遊戲的 `bone_visibility` 盤數條件，不能據此宣稱 1／2／3／8／16 盤呈現全數通過。

## 同輪程式與來源檢查

- `python -m unittest discover -s tests -p 'test_appliance_geometry.py'`：23／23 通過。
- `node --test tests/audiovisual.test.js tests/customer-profile.test.js`：9／9 通過。
- 在 `4bd2772` 來源執行 `npm run verify`：764／764 JavaScript 測試、TypeScript、資源檢查及建置通過。這是完整既有測試套件，沒有新增 runtime 修正。
- 來源與截圖雜湊見 [manifest.json](manifest.json)。本輪在正式 RP 沒有未提交改動，GUI 預覽沒有寫回原始檔案。
- 本機建置產物僅用於既有檢查，未發布或重新分發同名 `0.1.38-alpha.1` 包。

## 仍待驗收，按價值排序

1. **冰箱完整開關曲線與反轉**：44 個有限姿態、完整上下半組合、四方向及中途改目標；同時對照原來源動畫。兩個中間姿態的 GUI 正常不會關閉歷史客戶端 FAIL。
2. **洗碗機完整循環與盤數可見性**：預覽進退、投入／洗滌／取出全部時序，盤數 1／2／3／8／16 的骨骼顯示與多人共享預覽。這次只觀察三個姿態。
3. **顧客完整組合**：wide／slim × 四個 standing idle／四個 seated idle × 七個 action 的完整片段、停止及重入；實際 controller、看向玩家、late join 與 action clock 留待原生環境。
4. **其他現有資產**：餐盤 41 階段、打單機升紙／收紙、外送袋放置動作，以及其餘方塊四面材質，仍按既有 [VISUAL_RETEST](../../0.1.6-alpha.1/VISUAL_RETEST.md) 清單繼續。未重複宣稱這些已驗收。
5. **只靠編輯器不能關閉的項目**：Bedrock 原生透明面排序／邊界接受度、實際聲音與粒子、觸控／手把、多玩家、玩家骨架有效 owner、Java／Bedrock 同畫面比較。這一輪沒有啟動 Minecraft 或 BDS。

已知剩餘來源差異，例如冰箱食物陳列、上下半共同 squash、有限姿態的剪切近似及多人預覽適配，仍見 [VISUAL_AUDIO_PARITY](../../../VISUAL_AUDIO_PARITY.md)。本次沒有把取樣通過升格為完整 parity。

## 後續 Java 來源模型對照

同日補充的 [Java 來源模型對照](source-comparison/README.md) 記錄八張新增 GUI 截圖、預覽轉接限制及等角抽屜比較。正式資產另核至 `7373238`（0.1.40）仍相同；含 .40 的純文件合併樹已通過 `npm run verify`：784／784 JavaScript 測試、TypeScript、資源檢查與建置；另重跑 23／23 appliance geometry 測試。此本機診斷包不發布。
