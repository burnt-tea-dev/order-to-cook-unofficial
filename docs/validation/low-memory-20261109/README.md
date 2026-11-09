# #80 獨立性能驗收與整合記錄

來源基線：`8008294306180ece040b908684bf4fa11afb75c8`（main，0.1.48）。
受測候選 runtime：`afbf47cb518412564b330ab2da20117c3063884b`（#80，0.1.49）。
最新 main 的 #79 為文件與離線證據；合入本分支後 runtime 逐 byte 不變，保留 .49 配對身份與既有 history。
#81／#82 為獨立開發線，這份驗收沒有合入其冰箱或機車變更。

## 行為及負控制

- 候選 dining + dishwasher preview：48/48 PASS。
- 把同一測試檔套到未修 main runtime：45/48，恰好三個新增性能守門失敗（查詢索引、已結算顧客查詢、空洗碗機預覽），其餘通過。
- 確定性 seed 80261109，100 組 × 20 次變動 × 40 次查詢，共 80,000 次與舊正式函式結果相同。覆蓋三維度、負座標、上下層支持面、平手次序、無效數值、claiming、陣列增減／替換、整筆餐廳替換、跨 tick 及無 clock fallback。
- 80 張已結算盤的正式 dining + entity service：每次維護由 240 次顧客 getEntities 降到 0；把狀態改回 legacy unknown 時，兩版都維持 240，沒有跳過恢復。
- 無洗碗機，100 個模擬 ticks 依正式頻率執行 50 次 service callback：玩家枚舉 50 → 0。既有定點另驗證工作／idle 轉換及清除舊 preview。
- 五個查詢矩陣均符合 meal reads `P×M → M`，權威餐廳枚舉仍為 `P×R`。不是省掉所有遍歷。

## Node 計時與明確退化情境

以下為共享雲端環境 Node v24.22.1 的正式函式合成測試，**不是 Bedrock 原生 tick、CPU 用量或端到端遊玩測試**。每次建立服務，先暖身三 tick，再量十 tick；ABBA／BAAB 交替六輪，兩版各十二個樣本。欄位為每個模擬 tick 的 elapsed wall time 中位數（毫秒），含同樣的查詢結果 assert，不含 fixture 建構；原始樣本在 [results.json](results.json)。

| 餐廳 R | 餐盤 M | 每 tick 查詢 P | main ms | #80 ms |
| --- | --- | --- | --- | --- |
| 1 | 80 | 32 | 0.2242 | 0.0825 |
| 8 | 800 | 64 | 3.1126 | 0.4215 |
| 32 | 3200 | 256 | 46.8171 | 2.5156 |
| 3200 | 3200 | 32 | 10.3338 | 10.1858 |
| 1 | 3200 | 1 | 0.1498 | 0.7567 |

**只有一次查詢時沒有 meal-read 節省，建立整個座標索引反而更慢。** 此次 3,200 張盤／1 次查詢約 0.15 → 0.76 ms；這是可重現的取捨，不能寫成所有負載都更快或手機性能已通過。3,200 餐廳／32 次查詢兩版接近，P×R 仍主導。重複原生餐盤 callback 的矩陣改善明顯，但 wall time 會受共享主機／JIT／GC 影響，不作跨裝置改善百分比或性能門檻。

索引另外保存 O(M) key／引用；這輪沒有原生 heap、常駐 RAM、GC、GPU、熱降頻、觸控或真多人測量。保存快照、全世界資料常駐、廚電巡檢、進度重算與 POI 的既有風險仍未消除。索引失效依賴正式寫入流程；未來新增同長度原地替換、排序或座標變動時，仍須遵守既有失效契約。

## 重現

在獨立目錄 materialize 上述 main 與候選完整來源，執行：

```sh
node docs/validation/low-memory-20261109/measure.mjs BASELINE_ROOT CANDIDATE_ROOT results.json
```

腳本記錄實際 dining/core/appliances/entities 與 harness 的 SHA-256，以免拿錯來源。沒有修改 runtime、呼叫 BDS、啟動客戶端或接觸 LIVE；結果檔須用新名稱，勿覆寫這份原始歷史樣本。

## 整包檢查

- `taskset -c 0-1 npm run verify`：941/941，0 fail／0 skipped；型別、519 JSON／450 geometry、配對 build 通過。
- 最初預設平行 Node run 有多個測試 worker 終止；未判定根因，不能當通過。個別檔案及上述限制平行的完整命令重跑通過。未因測試失敗修改產品程式或取消案例。
- Python CI 入口：scope 9、appliance 33、motorcycle 9、fridge 3、dining 4、guide 3、segmented 13，共 74/74 通過。native neutral geometry 使用既有固定 Mojang 來源 hash；沒有將這些外部測試輸入納入 runtime。
- 合規 errors=[]；release-policy PASS；既有授權範圍詢問 advisory 保留。
- 原候選 clean build：runtime SHA-256 `79c5569779c7f805a82cb9d85158597689aa27d3dfd26f6c114f6900cc80b2c4`，sourceDirty=false。後續僅文件／測量工具與 main 文件整合，不更改此 runtime。

本頁完成的是離線獨立驗收。尚未執行 BDS、Minecraft 客戶端、使用者電腦、手機或 LIVE，也沒有建立 Tag／Release。合併後 CI 結果另以 PR 的實際 commit／run 記錄，不把原候選的成功結果冒稱合併後結果。
