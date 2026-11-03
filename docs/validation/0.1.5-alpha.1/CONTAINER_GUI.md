# 0.1.5-alpha.1：廚電容器與 GUI 驗證

日期：2026-11-04（香港）。這是未發布的 GUI／容器來源候選。Java 基準為 `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`。

## 改動及協作範圍

先核對 `main@ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`、PARITY、RUNTIME_ADAPTATIONS 與開啟中的 PR。執行期間食品 PR #18 更新，最終 GUI 分支以它的 `fc2fccd5b4f7e640ed24f3acf11f450d0be91a79` 為依賴，保留食品／飲品目錄、aliases、nativeVariant 與營養規則。

| 既有工作 | 本次邊界 |
| --- | --- |
| 食品 PR #18 | 保留其食品／飲品解析、core、inventory 及 provider；本次只接操作台 UI 和冰箱容器。 |
| POI PR #11 | 尚未合併；本分支不導入 POI。整合時保留本次原生上／下冰箱定義，POI 僅索引下半的原 ID；以實際使用的 POI API 決定 beta 依賴，不把本次 stable 2.11.0 說成足夠支援 POI。 |
| 保存 PR #16 | 不改 store.js，也不複製另一套 persistence owner。 |
| 合成 PR #15 | 不改其摩托車／硬幣配方；本候選使用獨立 0.1.5-alpha.1，沒有重用 0.1.3／0.1.4 包身份。 |
| 爐灶配方工作 | `SMOKING_RECIPES`、`FUEL_TICKS`、`canCook`、`cookLane`、`tickStove` 不變；新 `stove_controls.js` 只注入食材／燃料判斷與容器存取，避免另寫烹調規則。 |

沒有新增 CI 工作流程或發布門鎖。本輪使用既有 verify 流程，以及手動 opt-in 的真 BDS 容器探針；沒有操作玩家伺服器或其他 Addon。

## 玩家操作

| 設備 | 操作與庫存 |
| --- | --- |
| 冰箱 | 點上半開 27 格、點下半開 54 格原生容器；由遊戲提供拖曳及各輸入方式的容器操作。不再呼叫翻頁表單。 |
| 爐灶 | 手持支援的食材／燃料直接存入；空手同頁列七個有效槽位，可直接取一槽、一鍵收全部成品或補料。輸出仍不可經腳本存料，燃料仍只入燃料槽。 |
| 洗碗機 | 主手持髒盤點擊，從背包取最多 16 個；完成後雙手空點擊領取整批。滿背包留在機內。入盤與出盤遇保存失敗都回復本次物品與設備狀態。 |
| 操作台 | 手持本餐廳有效訂單直接裝盤／打包；空手是一頁訂單列表，保留菜名數量並顯示可製作、缺食品、缺包材／餐盤或台面受阻。取消不扣物，提交前仍走原交易重驗。 |

爐灶物品仍是既有 helper 的原生 ItemStack，只有 0–6 七格供爐灶使用；表單不另存虛擬數量。洗碗機遵循原作的盤數／phase 轉換：髒盤消耗後產出普通乾淨盤，並非保存任意髒盤 NBT 的儲物設備；未消耗的堆疊、取消或回退則保留原 metadata。

## 原生冰箱及遷移

下半沿用 `ordertocook:refrigerator`、上半新增隱藏的 `ordertocook:refrigerator_upper`。兩個方塊根元件各自宣告 54／27 格。26.60 不允許在 permutation 改 `minecraft:block_entity`，所以不是同 ID 的假容量分區。

舊 helper 的 0–26 搬到新上層 0–26；27–80 搬到新下層 0–53。每槽以原生 `Container.moveItem` 搬動，保留完整 ItemStack；完成後才保存 canonical station 指向原生庫存，最後移除已空的 helper。中途錯誤留下尚未搬的來源，重試只搬剩餘槽，不以 ID＋數量重造食品。已保存 helper 未載入、身份錯配或目的槽被佔用時保留原物品並拒絕開啟。

正常重啟由引擎保存原生容器；門狀態變化只改同 ID 的 state。破壞／替換方塊時內容由引擎掉落，腳本只處理另一半及尚未遷移的 legacy helper，避免同一份內容掉兩次。命令移除後亦清理另一半；區塊未載入不當作已拆除。

## API 及無法 1:1 的部分

最低 Bedrock 26.60，`@minecraft/server 2.11.0` stable、`@minecraft/server-ui 2.0.0` stable；世界須啟用 **Upcoming Creator Features**。這條容器路線不要求 Beta APIs 或 POI。

- 26.60 容器沒有食品白名單、輸出專用槽或 Java 自訂槽位版面。因此冰箱接受原生可存放物品，遵守物品自身堆疊上限；沒有宣稱 food-only、128 堆疊或 Java 整理按鈕。
- 爐灶仍是單頁表單加直接操作，保留有效槽位規則；未宣稱復刻 Java 可拖曳的專用爐灶 GUI。
- 操作台沿用背包＋附近冰箱取料，沒有 Java 的訂單槽＋12 格暫存 GUI，堂食仍按既有規則裝盤，外送打包。
- 新原生開啟入口先檢查 ready、站點 owner、距離與即時使用權；未準備好先取消並在正常 tick 遷移／認領。**真 Player 的原生開窗路徑是否完全遵守 before-event cancel，仍未驗證。**
- 官方 26.60 沒有可核實的強制關閉原生容器方法。已開容器後撤權，腳本後續交易會拒絕，但既有原生視窗的槽位操作無法保證立刻停止。觀看者集合清理僅控制門動畫，不能當成權限封鎖證據。
- 26.70.20 的 `show_ui_on_interaction` 和容器權限修正不算 26.60 能力；本次沒有使用這些未符合最低版本的欄位。
- world dynamic properties、玩家背包與原生容器沒有對外提供跨服務原子落盤交易；沒有宣稱任意斷電時刻零損失。

官方能力及 Java 原作來源連結見 [NATIVE-CONTAINERS.md](../../NATIVE-CONTAINERS.md)。

## 驗證結果

最終來源、測試數、原生報告與 runtime 指紋在提交前由本次實際執行結果填入。

本輪真 BDS 探索曾發現新 block format 不接受 `ambient_occlusion:false`，先判為失敗；依官方新版數值格式改為 `0` 並同步生成器，再從舊版世界 checkpoint 重跑。這不是略過內容錯誤。探索結果不冒充最後來源的驗收，最終 upgrade／reload 必須使用同一凍結來源。

## 客戶端仍待驗收

1. Windows 鍵鼠、觸控、手把分別點上下門，確認 27／54 格原生畫面、快速移動、拖曳及關閉；各次操作後對數量與 metadata。
2. 兩名有權玩家同開同一分區：互相移動同一堆疊、塞滿容器及背包，最後關閉者才關門。這是實際網路驗收，不能由事件替身代填。
3. 未獲授權玩家新開原生容器須被拒；測試開啟中撤權並記錄 26.60 限制，不能只看門關閉便算通過。
4. 正常遊玩中拆任一半、區塊卸載／重載及舊世界升級，檢查視窗、音效、渲染和自動掉落。原生伺服器探針不等於玩家破壞封包驗收。
5. 實際操作爐灶直存／同頁收成品，洗碗機持盤入／空手出，及操作台有效票據直製作；確認取消、台面阻擋、撤權或另一玩家已完成後不再扣物。

## 重現

`npm ci --ignore-scripts` 後執行 `npm run verify`，再跑既有幾何來源與合規檢查。新 GUI／遷移回歸位於 `tests/stove-controls.test.js`、`tests/countertop-controls.test.js`、`tests/native-fridge.test.js`。

真引擎探針為 `tests/bedrock-fridge-checks.js`，只複製到獨立 QA 行為包 scripts，令測試入口依序 import `main.js` 與此探針。使用官方 BDS 1.26.60.6、正常建立並停服的空 QA 世界，啟用 Upcoming Creator Features；保持空 allowlist，不接入玩家世界。主控台建立測試 tickingarea 後依序：

- 固定舊 `ce8a45e` runtime：`scriptevent ordertocook:qa_fridge legacy`，等待 `OTC_FRIDGE_REPORT` 後正常 stop，保存整個世界 checkpoint。
- 在同一正常停服世界掛本次凍結來源：`scriptevent ordertocook:qa_fridge upgrade`，等報告後正常 stop。
- 不換來源再次啟動：`scriptevent ordertocook:qa_fridge reload`，等報告後正常 stop。

每輪記錄 BDS 版本、完整 runtime 路徑＋NUL＋bytes 的 SHA-256、probe SHA-256、content errors 和正常停止結果。JavaScript probe 不加入正常發行入口；不散發 BDS binary 或 QA 世界。
