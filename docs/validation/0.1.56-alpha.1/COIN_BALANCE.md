# 貨幣餘額：一次掃描原生背包

日期：2026-11-16。基線 main `a4176b193294d8f57234b3b316ad6b092acf5d5b`，
候選 **0.1.56-alpha.1**。本候選只從此 main 加入本次改善；版本較大不代表它包含
#81／#82／#87／#88／#92 等其他候選，也不代表已部署。

## 問題與來源

`runtime/BP/scripts/inventory.js::coinBalance` 原本為五種廚師幣各呼叫一次
`countItem`，每次都從頭讀同一個原生背包。36 槽一次查額要呼叫 180 次 `getItem`。
使用者打開需要餘額的操作介面時，這些重複跨 API 讀取沒有提供額外玩法資料。

固定 Java [CoinUtils.countCoins(Inventory)][java-coins] 已採一次掃描，按實際物品面額
乘數量。Bedrock [Container.getItem][container] 可取得每格完整 stack，足以保留
現有五種廚師幣語義。本次改成一次掃描及固定 ID → 面額查表。

查表只包含原 `[10000, 100, 20, 5, 1]`，不從任意 ID 字尾推算幣值。
命名、lore 或額外資料不影響同一廚師幣的計值；計值本身不寫任何物品。
付款、找零、找零的 metadata 可堆疊判斷、完整 stack 回退及自訂實物貨幣入口不變。
玩家餘額及背包內容不跨呼叫快取；每次都重讀當下原生槽位。

## 已量度的讀取成本

同一個 36 槽輸入依序包含五種面額、普通食品及空槽；廚師幣均有名稱與附加資料。
直接載入基線及候選的正式 `inventory.js`，只替換 Minecraft import，
在 `getItem` 邊界計數；每次讀取回傳完整副本。每位餘額均為 **3,880,320**。

| 情境 | 基線 getItem 次數 | 候選 getItem 次數 | 兩邊餘額 |
| --- | ---: | ---: | ---: |
| 1 次 36 槽餘額查詢 | 180 | 36 | 3,880,320 |
| 32 次相同查詢 | 5,760 | 1,152 | 124,170,240 合計 |

原生槽讀取次數減少 **80%**，一般 N 槽由 5N 降至 N。
這是正式函式的 API 呼叫量度，**不是 BDS 執行時間、FPS、RAM 或手機效能測量**。
固定五項查表是一份小型模組資料，沒有每位玩家的常駐索引。

量度可在這兩個版本的正式模組包住 container 的 `getItem` 後重跑；輸入為
`Array.from({length:36})`，依 `i % 7` 放入 64 個面額 10000／100／20／5／1 的幣、
64 個 `minecraft:bread`、空槽。先以 `git show a4176b193294d8f57234b3b316ad6b092acf5d5b:runtime/BP/scripts/inventory.js`
載入基線，再讀候選同一檔案；以現有 `tests/inventory.test.js` 的正式模組載入方式
替換唯一 Minecraft import 即可。沒有把新量度工具、測試或 fixture 加入來源。

## 驗證及配對身份

- `npm ci --ignore-scripts`：固定依賴安裝完成。
- `npm run verify`：既有核心 **328／328** 通過，0 失敗、0 skip；TypeScript 通過；
  520 JSON／450 geometry 靜態驗證無錯誤；BP／RP 成對 build 成功。
- `python tools/check_compliance.py`：通過；既有作者素材來源註記保留。
- `python tests/check_release_policy.py`：通過；沒有建立 tag 或 Release。
- `git diff --check`：通過。

未新增或修改任何 tests、CI、fixtures、模型、材質或動畫。
開始前查過 11 個開放 OTC PR 的 changed filenames，`inventory.js` 沒有同檔工作。
全部遠端分支的 package 版號亦已讀取，最高已佔用為 #88 的 0.1.55；
本分支使用新 0.1.56，保留所有 UUID，版本 ledger 只追加。
manifest／package／baseline／history 是必要配對變更，日後與其他候選整合須重新
凍結組合後的配對；不得用此候選覆蓋較早版本號但含其他功能的部署。

功能來源仍由原使用者入口、`inventory.js`、原生 ItemStack 及既有付款交易持有；
沒有加入環境判斷、輪詢、持久資料遷移或新模組依賴。
沒有使用 BDS、Minecraft 客戶端、使用者電腦或 LIVE。

[java-coins]: https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/util/CoinUtils.java
[container]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container?view=minecraft-bedrock-stable
