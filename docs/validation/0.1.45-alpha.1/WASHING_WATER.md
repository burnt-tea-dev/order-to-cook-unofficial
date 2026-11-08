# 0.1.45 洗碗檯水面與指南來源整合

2026-11-08。基底為已合併 `.44` 的 `57b439ed111e3ad3e359626c3113e1fbbf2e2204`。這是未正式發布的來源候選，沒有操作 LIVE、使用者本機、Minecraft 或 BDS。

## 合入範圍

- 固定 Java renderer 的水片補入全部 11 個洗碗檯盤數狀態；上下兩面保留物理角點 UV、原始透明貼圖，沒有變動原本體／盤子的 geometry。世界材料統一 blend，物品另用乾檯 item_visual。
- 8 個實際雲端 Blockbench 場景、16 張原始 GUI 圖，涵蓋 0／5／10 盤前後及乾檯物品。5 盤 preview 遮擋差異保留，沒有把編輯器當原生透明排序證明。[GUI 證據與限制](../visual-audio/blockbench-20261108/washing-water/README.md)。
- 修正三語各 4 個裝袋指南可編輯來源值，避免完整重產把已完成的堂食裝袋文案覆蓋成舊外送文案。converter 演算法與正式 RP 語系 bytes 不因這項來源同步而變動；測試實際呼叫生成器。[來源同步與回歸測試](../UNRELEASED-bagging-guide-source-sync.md)。
- 既有 `.43` 改名及 `.44` 提醒的全部 gameplay scripts、正式語系 bytes 都與基底逐位元組相同。沒有修改車輛、NPC、其他設備資產、API 版本或 pack UUID。

## 身分與驗證

配對版本 `0.1.45-alpha.1`。BP／RP header、module、相互依賴與 baseline 同步；release-history 只追加 `0.1.45`，舊身分不覆寫。

- BP：101 files，SHA-256 `f666f1867d57abfd67480e24c441321bd3169b510633459848c4005e8c93dc7c`。
- RP：395 files，SHA-256 `f5b42e013bbaa9b3eb62c0eca107aa6f8abd4561c5324011ff482ca9bda6d7ee`。
- 完整 runtime tree：`70c4ca76037ed392b2724321b69644cb395ceb44663fb217c347a0ea8ab4c147`。

實際本地執行：

- `npm run verify`：908 JavaScript tests、TypeScript、資源檢查與完整 pack 建置通過。資源檢查為 368 JSON、14 blocks、17 items、5 entities、299 geometries、46 animations、361 permutations，errors 為空。
- Python：appliance 28、dining 4、guide languages 3、CI scope 8、segmented player source 13，全部通過。segmented 測試使用既有固定 Mojang 來源輸入，沒有啟用 player override。
- `check_compliance.py`、`tests/check_release_policy.py` 通過；保留既有來源授權 advisory，沒有把它寫成作者背書或正式 Release。
- 完整 converter 生成 457 檔：454 檔與正式輸出逐 bytes 相同，3 份語系僅既有 key 順序不同。每語 202 個 key/value 完全相同，包含 `.43`／`.44` 的新文字；沒有回寫這些排序差異。
- 本輪 GUI scene builder／verifier 重現 8 場景，核對 30 個 source/runtime inputs 與 27 個 fixtures/scenes/screenshots hashes。原 PNG bytes 保持。`git diff --check` 通過。

最初未凍結水面候選的 `npm run verify` 曾按預期被舊 `.42` 身分守門阻擋；這不是本次 `.45` 的結果。其歷史 812 tests 與限制仍在[來源契約](../UNRELEASED-washingtable-water.md)保留，不冒充最新套件測試。PR 發布前另核乾淨提交的 sourceRevision、sourceDirty=false 與以上 runtime fingerprint，精確遠端 head CI 全綠後才合併；本文件不建立 Release 或標籤。

## 舊視覺證據的範圍

較早 stage-review verifier 將整份 converter SHA 列入 81 個來源身分。水面函式新增後，它在 converter 的舊 hash 檢查停止是預期的歷史身分差異，不能宣稱舊 verifier 對新 converter 全過。原 manifest 沒被改寫；其餘 80 個輸入仍完全相同，舊 65 份 Blockbench 文件只有入口 README 增加新報告連結，其餘原圖與證據逐 bytes 保留。完整舊 verifier 可在原報告的來源提交重現；它不是新水面材質的驗收。

## 仍開放的原生門檻

整個方塊 blend 與 Java 獨立 translucent renderer 不是同一渲染管線。水下盤／池壁的透明排序、背面是否只混合一次、四方向、遠距離、全部盤數，以及乾檯在物品欄／手持／地上的效果未經原生客戶端驗收。Blockbench 的 5 盤 source 等價／候選遮擋差異已有保留圖，分組及 inactive pivots 是可能因素而非已證實原因。不得把此批來源修復與測試升格為完整 Java parity 或實機視覺通過。
