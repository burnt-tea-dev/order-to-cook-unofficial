# 0.1.1-alpha.2 驗證紀錄

驗證日期：2026-10-09。此為 alpha.2 歷史證據，最新版本見 [VALIDATION.md](VALIDATION.md)。此頁記錄 alpha.2 實際執行的自動化及原生引擎檢查；[alpha.1 的原紀錄](VALIDATION_ALPHA1.md) 另行保留。[客戶端驗收表](PLAYTEST.md) 仍標示未執行，不能以伺服器測試代替。

## 結果

| 檢查 | 實際結果 | 證據與範圍 |
| --- | --- | --- |
| JavaScript 回歸測試 | **180／180 通過** | `npm test`；直接載入發布用訂單、庫存、存檔、廚電、顧客、餐盤及 main adapters，含錯誤注入 |
| 官方穩定 API 型別 | **通過** | TypeScript 5.8.3、`@minecraft/server 2.0.0`、`@minecraft/server-ui 2.0.0`；`checkJs` 與 `tsc --noEmit` |
| 資源靜態驗證 | **通過，0 errors** | 285 JSON、12 方塊、15 顯式物品、5 實體、10 配方、240 geometry、38 動畫、228 permutations；另核對版本相依性 |
| 新世界原生操作 | **127／127 通過，無本包錯誤** | 官方 BDS **1.26.52.3**；[native-initial.json](validation/0.1.1-alpha.2/native-initial.json) |
| 同一世界正常重啟 | **15／15 通過，無本包錯誤** | 保留餐廳、庫存與尚在進食的第二份餐點；[native-reload.json](validation/0.1.1-alpha.2/native-reload.json) |
| alpha.1 世界升級 | **12／12 通過，無本包錯誤** | 使用 alpha.1 原生測試留下的世界；[native-upgrade.json](validation/0.1.1-alpha.2/native-upgrade.json) |
| 原素材離線重產 | **377 個產物完全相同；483 筆來源雜湊有效** | 隨倉庫的固定上游輸入、Pillow 12.3.0；[asset-rebuild.json](validation/0.1.1-alpha.2/asset-rebuild.json) |
| 可重現安裝包 | **通過** | BP、RP、mcaddon、[SHA-256](../artifacts/SHA256SUMS-0.1.1-alpha.2.txt) 及 [build-info.json](../artifacts/build-info-0.1.1-alpha.2.json)；CI 另比對已提交下載檔 |
| 真實玩家、客戶端、多人 | **未執行** | 表單、滑鼠／觸控、顯示、聲音、騎乘及網路條件仍須人工驗收 |

測試數是套件中的案例或斷言數，不是獨立功能數或程式碼覆蓋率。`npm run verify` 執行 JavaScript 測試、型別、靜態驗證及建置；原生 BDS 需另外執行。所有原生斷言使用真正的引擎方塊、實體、ItemStack 及容器，玩家介面由程式化替身提供；部分顧客動作測試注入時鐘以越過固定動畫期限。

## 發布內容與測試內容一致

三份原生報告和建置資訊記錄相同的 `runtimeTreeSha256`：

```text
a281a8285266923de1a99ad51c163e1c9fabbd8e1adb6034969affe4843d6cc4
```

指紋按路徑排序，對 `runtime/` 每個檔案的相對路徑、NUL 分隔符及原始內容計算 SHA-256。原生工具在独立副本注入探針，正式包仍以 `scripts/main.js` 啟動；不分發 QA 指令入口、測試世界、BDS 二進位檔或 Java JAR。

整合安裝包 `OrderToCook-Bedrock-0.1.1-alpha.2.mcaddon` 的 SHA-256：

```text
a43bff9efcfd49589db6bbdc3a4912d4587e498f641e5c0ff5be175281cb5c7b
```

每個 mcpack 附有 GPL 授權、原作署名、修改說明及完整對應來源網址。CI 從提交的來源重建，對照 `build-info.json`，並驗證已提交下載檔的 checksum。

## 原生測試涵蓋範圍

### 訂單、餐盤及廚電

- 載入正式入口，建立 12 種方塊、自訂物品及 40 個基礎食物的原生 ItemStack，檢查雙格冰箱、盤架高低位和餐點 stage 編碼。
- 在未放任何椅子時正式接取普通堂食，之後呼叫操作台、取餐及交付函式：消耗正確食品和一個餐盤、放置成品、保留不可堆疊 proof、只付款一次；再次打包與複製包裹不能重扣或重領。
- 原生坐席顧客啟動保存的完成動作；餐盤實體按排程到達四個進食階段，顧客離開後仍保留髒盤，不自動多掉一個物品。
- 人工建立重複顯示實體後，正式清理會保留一份；店主收盘得到一個髒盤，舊餐盤參考不能再次領取。
- 真實儲物實體及冰箱有 81 格、機車貨箱有 54 格；不可堆疊餐包轉入／轉出後名稱、lore 與 dynamic properties 均保留。
- 真正三槽爐灶完成三路烹調；洗碗機完成 16 盤並選取新的最終姿勢。原生升級檢查確認上下冰箱及洗碗機接受新 frame 狀態。

冰箱表單多開、反向開合與分區權限由服務測試覆蓋；沒有宣稱原生探針開啟了真實 Player 的表單。動畫幾何引用與姿勢範圍可由靜態檢查確認，視覺平滑度仍須客戶端目視。

### 顧客生命週期

原生顧客測試使用獨立的暫存餐廳、真實區塊與實體，並限定世界查詢範圍。檢查完整支撐面的射線、普通無椅站立、到店無椅拒絕、24 格圓形座位邊界、實際座位掛載、獨立閒置變體，以及取餐／兩種用餐／提前收盤動作的屬性、期限與清理。

完成動作的重複呼叫不能延長期限；完成中的顧客不再進入交付；驚喜動作不破壞椅子。損壞的 `seat_id` 指向載有鑽石的原生機車時，顧客清理不刪除該機車與貨物。

本輪原生測試曾捕捉到過短的地面射線在實際引擎沒有命中，以及測試在下一個 tick 前讀取 entity property 的問題。發布前已針對實際 API 行為修正支撐檢查與探針時序，並重新跑完驗證；不是只保留通過的子項目。

### 重啟與舊世界升級

新世界測試在第二張已付款訂單仍在進食時停止伺服器。重新啟動同一世界後，檢查餐廳完成數、收益、原生庫存、餐包身份與名稱；餐盤沿用原 token 和開始／結束時間，恢復成唯一髒盤，不重生已離場顧客。再次收盤只取得一個物品。

升級基準是 alpha.1 提交 `8713db4d6616f84cc5137e2d3d39e553b6fe9430` 的原生 QA 世界，其 runtime 指紋為 `1a2a9b55ed611889ff2270b9cd83a3d1951e07dd014e0382ef84ec0a81588aeb`。換用 alpha.2 的同 UUID／新版本包後，檢查舊餐廳收入、包裹 proof、名稱／lore、冰箱的命名食品、洗碗機的 16 個已洗餐盤及新狀態編碼均保留。舊已完成訂單歷史沒有被當作新餐盤重新補發。

這個 alpha.1 世界的原餐盤已在舊測試中歸還，**沒有以它驗證「正在進食中的 alpha.1 餐盤」升級**。該舊 `pendingDishes.dueAt` 格式的遷移、已到期記錄及重複記錄，另由服務回歸測試覆蓋。兩者不可混稱。

## 回歸測試補上的錯誤情境

訂單核心檢查普通坐席顧客的驚喜機率、一次選取並保存加賞、站立／配送分支及重複結算。餐盤服務檢查十種餐點的精確階段界線、未知或損壞記錄保留、歷史裁剪、顯示遺失／重複、未載入位置、滿背包、權限撤銷及領取前後寫入失敗。

正式 main adapters 的測試涵蓋餐廳／訂單／物品类型／proof 身份、實體餐包先扣後完成、扣料前後拋例外、保存失敗回復、展示方塊初始保存失敗、重複擺放及收盤。舊盤尚未清理時，新交餐在扣物／付款前拒絕；拆機後清理尚未完成時，重放機器不能繼續經營舊記錄。

提前收盤會保存 action 7 的半秒中斷期限，即使完成歷史已裁剪，或最後清理保存失敗，也不把顧客恢復成舊進食動作。餐盘的已領取標記先保存，再寫入原生庫存；已知同步寫入異常會嘗試精確回復，結果不確定時保留已領取狀態以避免複製。

## 測試不能證明的事項

- **沒有真實 Player 連線。**未驗證玩家事件在滑鼠、鍵盤、控制器及觸控上的實際觸發順序，或表單顯示／返回、HUD、收盤命中與載具操控。餐盤實體點擊另提供下方桌面的替代入口，仍待客戶端確認。
- **BDS 不渲染資源包。**240 個 geometry 與 38 個動畫可解析，不代表 UV、透明面、骨骼方向、頭盔、燈光或聲音已目視／聽覺驗收。門與洗碗機姿勢由原作取樣，但非等比例機身擠壓及 Geckolib easing 尚未等同。
- **沒有多人延遲、長期大世界或任意崩潰時點測試。**單筆世界屬性的完整快照切換不等於世界磁碟、背包和實體之間的原子交易。在已保存領取標記、尚未寫入物品的狹窄崩潰窗口，可能少一個盤子；正常重啟通過不能排除此限制。
- **宣告最低 1.21.100，實測只有 BDS 1.26.52.3。**沿用穩定 API 2.0.0，沒有 Beta APIs 或 `player.json` 覆寫；最低版本、主機及行動裝置仍須實测。

## 重現

```sh
npm ci
npm run verify
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode initial
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode reload
```

目錄需預先放入官方 Linux BDS，且不得含其他世界。`initial` 會重建工具已標記的 `otc-qa`；`reload` 和 `upgrade` 都要求既有 QA 世界。報告寫至 `docs/validation/<package-version>/`。只對獨立測試副本使用。

重現 alpha.1 升級需先在該固定提交的獨立 checkout 執行 `initial`，保留 BDS 的 QA 世界；再從 alpha.2 checkout 對同一測試目錄執行：

```sh
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode upgrade
```

`reload` 探針完成後會收取它測試的餐盤；再次驗證同一完整重啟流程，應由 `initial` 重新建立其前置條件。

素材可在另一個輸出目錄重產：

```sh
python -m pip install Pillow==12.3.0
python tools/convert_assets.py --output /path/to/offline-rebuild
```

逐檔比較該目錄與 `runtime/` 中的同路徑檔案，可重現本次 377 份輸出的一致性檢查。原生 probe 及客戶端人工測試不在 GitHub Actions 的執行範圍內。
