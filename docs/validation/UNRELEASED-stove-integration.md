# 未發布：三槽爐灶與煙燻配方接入驗證

基線 main：`ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`。
Java 固定基準：`breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`。
本次直接修改原 OTC BP／RP，沒有額外修復包、供應 Addon 修改或正式世界操作。
包版本及 UUID 保持原值；本次建置只驗證來源，不發布另一份同版本下載。

## 已修正的可重現問題

新增爐灶回歸最初在未修改 main 上得到 **10 pass／7 fail**，重現：

1. 點火已從原生庫存扣燃料，保存的燃燒狀態仍為零。
2. 換原料種類或 metadata 沒有清除舊共用進度。
3. 取空輸入後進度仍保留，也沒有即時保存。
4. 卸載前只有 20 tick checkpoint，最後處理到的 37 tick 沒有保存。
5. 卸載後重新載入，舊表單能重新取得操作權。
6. `{output, count}` 配方沒有被加工，產量固定為 1。
7. 初始化後新增配方無效，因為 `ctx.smokingRecipes` 被複製成靜態快照。

以上案例已轉綠。另加一項舊記錄測試：移除四個新欄位後，保留舊進度 73、
燃燒剩餘 1200、同一原生 helper 及七槽物品；首次補欄位後再 JSON 重載，累計
餘下 127 tick 只完成一批，沒有重複扣燃料。原有全堵、部分堵、末燃料 tick、
失火回退、熔岩桶返還、取消、滿背包、掉落及輸入 metadata 行為亦有針對性案例。

## 本地驗證

| 驗證 | 結果／範圍 |
| --- | --- |
| `npm run verify` | 370 個 Node 測試、官方 stable 2.0 型別、286 JSON 資源檢查、BP／RP／mcaddon 建置通過。 |
| 新爐灶執行回歸 | `tests/stove.test.js`：18 項，直接匯入正式 service；表單及引擎是替身。 |
| 配方供應契約 | `tests/smoking-recipes.test.js`：11 項，含雙端 ID 存在、更新／撤回、catalog 分組及製程限制。 |
| 正式入口接線 | `tests/smoking-integration.test.js`：4 項，載入正式 main，核對 live ctx、單次啟動請求、Server 來源及缺失物品；事件傳輸仍是替身。 |
| 爐火／資源 | `tests/stove-fire.test.js`：4 項，15／5／8 tick、獨立相位、重載、六張原圖 bytes 及無額外照明。 |
| 既有幾何重產 | `python -m unittest discover -s tests -p test_appliance_geometry.py`：5／5。 |
| 來源與封包 | 既有 compliance、release-policy、`git diff --check` 通過；沒有新增 CI gate。 |

Node 的保存案例使用獨立 JSON 深快照，沒有以同一個可變物件引用當作重啟證據。
原生 inventory 與世界 dynamic properties 仍非共同原子交易，未宣稱突然斷電時絕無損失。

## BDS 原生結果

使用官方 **BDS 1.26.60.6** 與 stable `@minecraft/server 2.0.0`，在獨立的
`otc-qa` 測試世界跑初次及正常停服後的另一個 BDS 程序。兩份報告皆 `passed: true`，
`addonErrors: []`：

- [初次載入：15／15](stove-integration/native-stove-initial.json)。
- [真實停服重啟：4／4](stove-integration/native-stove-reload.json)。

兩份原生報告及本次建置的 production runtime SHA-256 相同：

```text
b2794c2064cd600e2975c64836f27335e7b4cb5105ee11fa5b6a084dc52b69d8
```

報告另記錄 QA 腳本及 runner SHA-256。初次啟動曾因測試目錄漏複製官方
`server_library`／`server_ui_library` 而無法載入模組；補齊官方庫後重跑。
另修正 QA fixture 對可堆疊食材使用 dynamic properties 的錯誤，改以原生支援的
name／lore 測試。這兩次探針準備失敗不計入上述通過報告，也沒有改正式 runtime 來隱藏錯誤。

原生確認內容：

- 正式 `main.js` 排程在 200 tick 前不出菜，之後三個不同原料各出到對應格，共用一份煤。
- 原生 script event 的晚到供應公告會影響已放置爐灶，實際產量為 2；錯誤製程、缺失輸出 ID 被拒絕；撤回後原料保留。
- 使用真實 ItemStack／容器及可控 service 時鐘，檢查 count=2 堵塞／恢復、無效原料、不同名稱成品不混疊、燃料用盡及最後 1 tick 的順序、熔岩桶與換料重置。
- 真實七槽容器與名稱／lore 跨正常停服保存；進度 **73**、剩餘燃燒 **1528** 精確還原，再處理餘下 **127 tick** 僅完成一次，不再扣燃料或補播點火。
- 六種 `fire_frame` 均能由引擎解析；滿 36 格的原生容器拒絕領取，來源物品完整保留。

供應公告在 QA copy 內使用兩個明確的合成測試物品 `otc_stove_probe:raw/cooked`，
它們不加入 `runtime/`、正式建置或另一個料理 Addon。這證明原生公告入口與物品製程，
**不等於已安裝完整 Grilling 包的跨包驗收**。多數邊界案例為真實引擎物件配可控時鐘；
三路出菜與供應事件另使用真 main 排程。重載 fixture 直接保存到隔離世界屬性並沿用正式
appliance service；通用 `store.js` 的分片交易由既有 Node 回歸覆蓋，未冒稱全部路徑都是實機。

重現命令（`/path/to/disposable-bds` 須為新的官方 Linux BDS 完整解壓目錄）：

```sh
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --suite stove --mode initial
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --suite stove --mode reload
```

runner 保持原 full suite 預設，新增的 stove suite 及報告目錄不覆蓋歷史 alpha.3 報告。

## 未宣稱完成的驗收

真實玩家 GUI、鍵鼠／觸控、多人競爭、實際區塊物理卸載、客戶端聲音與渲染：**未執行**。
區塊卸載與舊表單測試目前使用引擎替身。未測任意真實舊玩家世界升級或最低 1.21.100 客戶端；
本次真 BDS 重啟是同候選 QA 世界。

Farmer's Delight、Let's Do、其他 Cookery 煙燻來源及外部鍋具熱源協議尚待供應端提供
實際 Bedrock ID／配方，不能用本次 9＋2 配方宣稱全部料理相容。
爐火骨骼 squash 與原始粒子分布仍有適配差異。完整配方、燃料及容器規則見
[STOVE-RECIPES.md](../STOVE-RECIPES.md) 和 [RUNTIME_ADAPTATIONS.md](../RUNTIME_ADAPTATIONS.md#三槽爐灶)。
