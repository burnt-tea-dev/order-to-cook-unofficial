# 0.1.0-alpha.1 驗證紀錄

驗證日期：2026-10-09。這份紀錄說明實際執行過的檢查，以及它們不能證明的範圍。客戶端人工驗收另見 [PLAYTEST.md](PLAYTEST.md)，目前全部標為未執行。

## 結果

| 檢查 | 實際結果 | 證據與範圍 |
| --- | --- | --- |
| JavaScript 回歸測試 | **92／92 通過** | `npm test`，測試直接載入發布用邏輯及服務；核心 31、庫存 21、存檔 15、廚電與實體合計 25 |
| 官方 API 型別 | **通過** | TypeScript 5.8.3、`@minecraft/server 2.0.0`、`@minecraft/server-ui 2.0.0`，`checkJs` 與 `tsc --noEmit` |
| 資源靜態檢查 | **通過，0 errors** | 203 個 JSON、12 方塊、15 顯式物品、4 實體、10 配方、121 geometry、38 動畫、150 permutations |
| 原生伺服器初次載入與操作 | **80／80 通過，無本包錯誤** | 官方 BDS **1.26.52.3**；[native-initial.json](validation/native-initial.json) |
| 同一世界正常重啟 | **6／6 通過，無本包錯誤** | 關閉並重新啟動同一 BDS；[native-reload.json](validation/native-reload.json) |
| 離線素材重產 | **294 個轉換產物逐檔 SHA-256 相同** | 以倉庫隨附的 `upstream/reference/` 和 Pillow 12.3.0 重產至獨立目錄；273 個轉換清單來源引用均可解析 |
| 發行包建置 | **通過** | `npm run build`；[安裝包與雜湊](../artifacts/)、[build-info.json](../artifacts/build-info.json) |
| 真實客戶端、多人連線 | **未執行** | 見下方界線及 [62 個人工驗收案例](PLAYTEST.md) |

上述「測試數」是各套件內的斷言／案例數，不代表相同數目的獨立功能，也不是程式碼覆蓋率。一般 `npm run verify` 執行 JavaScript 測試、型別檢查、靜態驗證及建置；原生 BDS 測試需要另外執行。

## 發布內容與原生測試一致性

兩份原生報告和建置資訊中的 `runtimeTreeSha256` 相同：

```text
1a2a9b55ed611889ff2270b9cd83a3d1951e07dd014e0382ef84ec0a81588aeb
```

指紋按路徑排序，對 `runtime/` 每個檔案的相對路徑、NUL 分隔符和原始內容計算 SHA-256。正式包的 Script API 入口仍是 `scripts/main.js`；測試工具只在獨立副本注入探針，沒有把測試指令入口或測試世界放入發行包。

整合安裝包 `OrderToCook-Bedrock-0.1.0-alpha.1.mcaddon` 的 SHA-256：

```text
a0ccac0e5132281042bc824a18a7274fea7da24dae3cea8a17e640f899afb977
```

每個 `.mcpack` 都附有 `LICENSE`、`THIRD_PARTY_NOTICES.md` 和對應來源網址。來源、轉換器及其固定上游輸入一同保存在此倉庫；原 Java JAR 和 BDS 遊戲伺服器二進位檔均未再分發。

## 原生測試實際做了什麼

測試工具建立有明確標記的獨立世界，以主控台載入小範圍測試區域。它實際呼叫本包的發布用腳本，操作引擎內的 Block、BlockPermutation、Entity、ItemStack、Container 及 dynamic properties。

初次載入的 80 項檢查涵蓋：

- 正式入口完成初始化，12 種方塊與自訂物品完成註冊，40 個內建原版食物 ID 可建立真正的 ItemStack。
- 雙格冰箱放置及重複放置事件處理、18 盤的高低位狀態、餐點 stage 37 的高低位狀態。
- 81 格原生儲物實體與冰箱、54 格機車貨箱，以及原生可騎乘元件存在。
- 從發布用打單／操作台函式完成接單、扣除正確食品及一個餐盤、產生實際展示方塊、取回不可堆疊成品，再交付並獲得記錄的報酬。
- 同一訂單再次打包不再扣料；複製餐包不能重複領款。
- 不可堆疊餐包轉進、轉出真正的機車貨箱後，名稱、lore 與 dynamic-property 身份仍完整。
- 真正顧客實體與原生座位掛載、用餐計時後只產生一個髒盤。
- 真正三槽爐灶完成三路烹調，洗碗機完成一批 16 盤。

重新啟動同一伺服器後，6 項檢查確認正式入口重新初始化、餐廳完成數及收入恢復、原生儲物實體恢復、餐包身份恢復、ItemStack 名稱與 lore 恢復，以及打單機方塊仍存在。

## 回歸測試的重點

純邏輯與服務測試覆蓋訂單生成和期限、候選互斥、五品質與升級規則、菜單營養、重複結算；庫存測試涵蓋重複需求合併、去重容器、預先檢查、找零空間不足及寫入失敗回滾；存檔測試涵蓋 UTF-8 大資料分片、雙緩衝寫入、舊格式遷移與損壞資料不被清空。

廚電與實體測試使用 Minecraft API 替身，驗證冰箱容量及物品身份、三槽爐灶、洗碗機、手動洗碗的視線與時間、表單返回後撤權、顧客與載具生命週期。它們可檢查服務決策，但不能單獨證明 Bedrock 引擎接受所有呼叫；上述原生探針補上部分引擎執行證據。

## 不能由這些結果推論的事項

原生探針使用**真實容器加程式化的玩家替身**呼叫業務函式。測試時沒有真實 Player 連線，因此未驗證 `playerInteractWithBlock`／custom `onUse` 在各種輸入裝置上的實際事件順序、真實表單開啟與返回、HUD 視覺、物品手持外觀或觸控按鈕。

BDS 不渲染資源包。121 個 geometry 與 38 個動畫定義可解析且引用有效，不代表逐面 UV、透明面、骨骼朝向、頭盔位置、燈光亮度、顧客動作及聲音已經由客戶端目視確認。原作的部分動畫目前只保留資源，未由玩法逐幀驅動；詳見 [PARITY.md](PARITY.md) 和 [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md)。

本次也沒有實測真正載具操控、遠距外送時的玩家移動與區塊串流、兩名玩家同時操作、網路延遲、伺服器崩潰中途恢復或長期大規模世界。正常重啟通過不能作為跨世界／庫存交易具備崩潰原子性的證明。

宣告最低版本 **1.21.100**，採穩定 API 2.0.0，沒有 Beta APIs 或 `player.json` 覆寫；實際原生測試版本只有 **1.26.52.3**。最低版及其他裝置的相容性仍需實測。

## 重現方式

```sh
npm ci
npm run verify
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode initial
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode reload
```

原生測試目錄需預先放入官方 Linux BDS，且不得包含其他世界。`initial` 會重新建立工具標記下的 `otc-qa` 測試世界；`reload` 保留它以檢查存檔。只在專用測試副本執行這些指令。

重產素材可使用以下指令；指定其他輸出目錄便不會覆寫已生成的 runtime 資源：

```sh
python -m pip install Pillow==12.3.0
python tools/convert_assets.py --output /path/to/offline-rebuild
```

GitHub Actions 的 `Validate and build Bedrock add-on` 工作會重新執行 `npm run verify` 並提供建置 artifact；它不包含 BDS 二進位檔，也不會替代客戶端驗收。
