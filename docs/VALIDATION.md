# 0.1.2-alpha.3 驗證紀錄

驗證日期：2026-10-10。**本輪 254／254 項回歸、stable API 型別、靜態資源檢查及可重現建置通過；原生 BDS 與真實客戶端未執行。** 客戶端測試交接文件已為 dot 準備，尚無其實機回報。

[本輪 CI 工作](https://github.com/casama233/order-to-cook-unofficial/actions/runs/38016889591) · [機器可讀紀錄](validation/0.1.2-alpha.3/ci.json) · [dot 交接](DOT_HANDOFF.md) · [客戶端回報模板](validation/DOT_REPORT_TEMPLATE.md)

## 已執行的檢查

| 檢查 | 結果 | 證據及適用範圍 |
|---|---|---|
| JavaScript 回歸 | **254／254 通過** | Node.js 22 `node:test`，直接匯入發布腳本；Minecraft 世界、Player 與表單採可控替身。 |
| Stable Script API 型別 | **通過** | TypeScript 5.8.3、`@minecraft/server 2.0.0`、`@minecraft/server-ui 2.0.0`；無 Beta API。 |
| 靜態包／資源驗證 | **通過** | 285 JSON、12 方塊、15 顯式物品、5 實體、10 配方、240 geometry、38 動畫、228 permutations；errors 為空。 |
| 安裝包建置 | **通過** | BP、RP、mcaddon 都由同一份來源建置，附 GPL、原作署名及對應來源。 |
| 已提交下載檔核對 | **通過** | CI 比對 `artifacts/build-info.json` 與 `dist/build-info.json`，再逐一檢查三包 checksum。 |
| alpha.3 原生 BDS | **未執行** | 本輪本機環境離線，沒有新的引擎載入、重啟或世界升級報告。 |
| 真玩家／客戶端／多人 | **未執行** | dot 的 29 個增補與既有 73 個完整案例皆待實際填報，不能用 CI 代替。 |
| 完整素材轉換器重產 | **未重跑** | 本輪未變更模型、PNG、OGG 或動畫資產；沿用原始來源與生成物，靜態／來源姿態測試仍有執行。 |

`npm run verify` 的測試、型別、靜態檢查與建置全部完成後，候選工作才把產物保存到分支。此工作只對指定候選分支寫入 `artifacts/`，不直接改 main、不跳過既有 PR／main 建置檢查。測試數不是獨立功能數或程式碼覆蓋率。

首輪工作 [38016237209](https://github.com/casama233/order-to-cook-unofficial/actions/runs/38016237209) 為 243／244 通過，新放置案例的測試替身缺少既有 `normalizeBlock` 方法。已補完整替身；之後也加入對審查發現問題的回歸，最終 254 項全過。沒有將首輪失敗隱藏為通過。

## 來源、產物與指紋

執行驗證的來源 commit：

```text
91d4a0f0c44fdc6a34f8c9b4f234c11c616602c5
```

CI 保存安裝包的 commit：

```text
66768e0a64b80a4226924cbe580e3144793796f9
```

後續文件／整合提交可由 git 歷史追溯至這兩個提交。測試來源、已提交包及最終版本的 `runtime/` 指紋為：

```text
f77209e0fa441e7ee16d400d57d596556fd70f6eea8b73b3fcf0a14225c3b2c4
```

算法依路徑排序，逐一對 `runtime/` 檔案的相對路徑、NUL 分隔符及原始內容計算 SHA-256。完整包清單見 [build-info.json](../artifacts/build-info.json)／[SHA256SUMS.txt](../artifacts/SHA256SUMS.txt)。

`OrderToCook-Bedrock-0.1.2-alpha.3.mcaddon` 的 SHA-256：

```text
13ebbb92d4848565bcfb22aa944ec4a3db9c02630f09ac696602b81200001d7b
```

行為包及資源包均使用數字版本 **0.1.2**；既有 UUID 沿用。最低引擎宣告仍為 **1.21.100**，不是最低版本客戶端已測通過的聲明。

## 新增回歸確認了什麼

### 個人進度及保存

訂單進度由正式 `customerInteract` 在原餐廳完成訂單的同次保存內追加交餐玩家累積帳簿。測試確認原 proof 防重複結算仍生效；重點顧客、重播帳簿、跨店同步、正常存檔再載入、已完成歷史裁剪及同址重建都不重計个人收益。

個人 profile 保存暫時失敗時，已提交餐廳帳簿仍保留；後續對帳一次補入，不再次給幣。讀取未知版本、反向 checkpoint、零完成單卻有收益或對帳總和不一致的資料會拒絕，保留原記錄。個人狀態與来源 checkpoint 共用分片雙緩衝保存，測試包含多片 Unicode、提交前失败與提交已套用後拋錯。

操作型進度的待處理事件隨機器／餐廳一起保存。正式 main 流程測試涵蓋：Lv.8 成功後 profile 失敗，由 tick 補發而不重扣費；首次放置補發；洗碗機升級消耗一次工具箱，待確認事件會攔下正常拆除並先保存進度。來源確認保存失敗可重播，解鎖通知不重複。餐廳升級本身保存失敗則退回費用，不留下八星事件。

同餐廳某玩家的壞 profile 不會阻塞其他健康玩家入帳；只要仍有未同步帳簿，拆店清理就保留原記錄。這些保證針對測試中可辨識的同步寫入結果與保存重試，並不宣稱任意世界磁碟崩潰時都零損失。

金牌規則測試涵蓋：同一玩家、同一維度至少 4 店；並列最高及 0 收益並列；未載入但仍放置的店；已知位置被拆、不同玩家及跨維度 2＋2 店的負例。原作來源與全部 11 項定義見 [PROGRESSION.md](PROGRESSION.md)。

### 設備 HUD 及表單接線

服務測試確認看向設備只讀取快照，不建立 station、helper 或替代庫存，不改物品／存檔。每次重新驗權、檢查維度／距離，冰箱按上 27／下 54 的占用槽位計數。helper 身份錯配、維度不同、移出 anchor 或未載入均不能讀取外來庫存。

main 測試確認單一 HUD 寫者把手洗／設備資訊與外送導航合併，準星查詢失敗不連帶隱藏導航；失去全部目標只清除一次。表單測試只檢查真正產生的標題、11 條選項、未移植標記及返回清單控制流，**沒有真實 Player 點擊表單**。

手洗需要空手；一般客戶端在完成後要重新拿起票據／包裹才會恢復導航。mock 的合併測試不能證明玩家可以持包裹同時洗碗。兩行 HUD 的排版、字元、觸控與手把可讀性由 dot 實測。

## 未驗證及保留的界線

原生 BDS、真實玩家事件、資源包渲染、音效、實體／方塊點擊、表單焦點、騎乘輸入、雙人網路競爭，以及 alpha.2 → alpha.3 真世界升級仍待測試。本輪沒有把任何原生探針或客戶端結果標成通過。

歷史 alpha.2 的 BDS 1.26.52.3 報告為初始 127、重啟 15、alpha.1 升級 12 個斷言，僅適用其原 runtime 指紋 `a281a8285266923de1a99ad51c163e1c9fabbd8e1adb6034969affe4843d6cc4`，詳見 [VALIDATION_ALPHA2.md](VALIDATION_ALPHA2.md)。其 Player 也是程式化替身，並非客戶端。更早結果見 [VALIDATION_ALPHA1.md](VALIDATION_ALPHA1.md)。

餐廳／profile 的單筆保存與原生物品欄不是同一個原子交易。個人帳簿代表成功交單的結算金額；任意強制終止時點不能保證與背包／地面實物幣完全一致。領髒盤先保存不可重領標記、再寫物品的狹窄崩潰窗口仍可能少一個盤子。這些既有界線不因新增進度而消失。

## 重現

```sh
npm ci --ignore-scripts
npm run verify
diff -u artifacts/build-info.json dist/build-info.json
```

接著在 `artifacts/` 執行 `sha256sum --check SHA256SUMS.txt`。需要準備新的版本下載檔時，先完成驗證再執行 `python tools/stage_artifacts.py`；工具保留歷史版本包及對應建置資訊。

本輪沒有執行的 BDS 重現入口仍在 `tools/bedrock_smoke.py`，只應使用已準備好的獨立官方 BDS 測試目錄。dot 請依 [DOT_HANDOFF.md](DOT_HANDOFF.md) 先固定包與世界，再複製回報模板；所有未做的案例保留「未執行」或「阻塞」。
