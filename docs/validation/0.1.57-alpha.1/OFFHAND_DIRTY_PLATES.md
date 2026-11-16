# 副手髒盤：設備互動缺口與修復

## 問題與候選

基於 `main a4176b193294d8f57234b3b316ad6b092acf5d5b` 的獨立候選
**0.1.57-alpha.1**。主線已讀副手髒盤並播放洗碗機預覽，但物品沒有允許玩家
放入副手，兩種設備投入也只接受主手。這是可用穩定 API 補回的互動缺失。

原 `make_items` 只為 `dirty_plate` 加入 `minecraft:allow_off_hand: true`。
`interactSink` 先選主手，空時才選副手；`interactDishwasher` 接受任一手髒盤，
原主背包單次遍歷後再使用副手剩餘容量。沒有新增物品、容器、存檔欄位或輪詢。
原有容量、兩手空領盤、權限、三 tick 點擊去重與批次時長保持。

## 固定 Java 與官方能力

2026-11-16 重新核對上游 main，仍是
[`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)
（1.3.7a）。以下依 Forge 1.20.1；沒有把各平台 renderer 或輸入聲稱完全相同。

- [`DishwasherBlock.use`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/DishwasherBlock.java#L90-L113)
  由任一手髒盤啟動；取成品要求兩手空。
- [`DishwasherBlockEntity.insertDirtyPlates / removeDirtyPlates`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/DishwasherBlockEntity.java)
  以原 inventory 順序收取最多十六盤，沒有創造模式免扣。
- [`WashingTableBlock.use`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/WashingTableBlock.java#L85-L112)
  主手非空便以主手為準，空時選副手，每次加一盤，容量十。
- [官方 allow_off_hand](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_allow_off_hand?view=minecraft-bedrock-stable)
  支援布林值，最低 item format 1.20.30；本物品仍為 1.21.100。
- [官方 EntityEquippableComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityequippablecomponent?view=minecraft-bedrock-stable)
  的 `getEquipment`／`setEquipment` 可讀寫玩家副手；後者回傳 boolean、可拋錯，
  不可在 restricted execution 執行。此路徑沿原 before-event 取消後的
  `system.run`／custom component owner，並非在 before-event 寫入。
  正規安裝的 `@minecraft/server 2.11.0` 型別亦確認這兩個方法，無須 Beta API。

## 原物品與失敗範圍

副手讀回原 ItemStack；扣取部分時 clone 後只調整 amount，沒有以物品 ID＋數量
重造剩餘品。主背包已足十六盤時不寫副手。同步寫入失敗會恢復本次原 stack，
設備狀態先恢復再進行槽位回復；已知保存失敗同樣回復。副手元件缺席時，
合法主手操作仍可執行，沒有元件則不能假定存在可扣取的副手物品。

這是既有同步補償邊界，不是原生共同交易。回復也失敗、玩家離線／實體失效、
原生存檔寫入後結果不明或程序突然中止，仍不能保證任意時刻零損失。
原 dirty→clean 加工本來就生成乾淨盤，沒有承諾把已消耗盤子的 metadata 傳到成品。

洗碗池創造模式仍實扣，是既有倉儲規則；Java `instabuild` 免扣的差異保留，
本候選沒有借副手接線改變經濟規則。手洗持續 Use 的輸入差異及洗碗機相位
timer 歸零後下一 tick 才轉換的差異仍未修，見 [既有差異](../../VISUAL_AUDIO_PARITY.md#洗碗機)。

## 比較與驗證

臨時離線比較直接載入 main 與候選的正式 `appliances.js`，沿既有 Minecraft
I/O doubles，未加入或修改 repository tests、fixtures 或 CI。

| 同一輸入 | main | 候選 |
| --- | --- | --- |
| 副手 20 具名髒盤，主手空，點洗碗機 | 不投入，副手 20 | 投入 16，副手餘 4，名稱與 lore 保留 |
| 主背包 11、副手 12 | 投入 11，副手 12 | 投入 16，副手餘 7 |
| 主背包 20、副手 12 | 投入 16，主背包餘 4 | 相同，副手零寫入 |
| 主手 3 鑽石、副手 5 髒盤，點洗碗機 | 不投入 | 投入 5，鑽石不改 |
| 主手空、副手 7，點洗碗池 | 不投入 | 投入 1，副手餘 6 |
| 主手其他物品、副手髒盤，點洗碗池 | 不投入 | 相同 |
| 主手 3、副手 7 髒盤，點洗碗池 | 主手扣 1 | 相同，副手零寫入 |

比較共 **23 個情境**：另含兩種設備的 `setEquipment=false`、單次拋錯、
單次寫入後拋錯、已知提交前保存拒絕後的完整槽位／狀態恢復與成功重試；
元件缺席而主手可用；撤權、滿池、領盤需兩手空；原副手 preview 到投入。
最後一項把正式 service 接到既有 main harness 的原 owner，注入重複
before-event 後確認池內只加一盤、副手只扣一次。這些注入不是原生故障發生率、
引擎磁碟或多人驗收的證據。

既有廚電／動作／聲畫定點 **42/42 通過**。完整 `npm run verify`：
**328/328 通過**，TypeScript、520 JSON 檢查（無錯誤）及成對 build 通過；
合規、release-policy、`git diff --check` 通過。第二次原生成器執行後，
全部 **649 個 runtime 檔案 byte-identical**。沒有增加驗證入口。

本地受測 runtime SHA-256：
`74a09d9f7ae13b2352929fbcb090b8d62d2c6fd69d89ca85811a1c86f7e22c45`。
遠端 head／CI 狀態列在 PR，不能借用其他候選的成功結果。

## 成本與並行整合

正式 tick 與 preview 無變更。只有投入互動增讀副手；副手供貨最多一個槽位寫入，
主背包仍只遍歷一次、最多 36 格，整批仍限十六盤。沒有額外服務 tick、實體、
持久快取或跨容器同步，沒有 FPS／RAM／原生延遲改善數字。
玩家可直接使用副手中的髒盤，省去搬到快捷欄的操作；實際手機／手把輸入體感未觀察。

已讀全部十二個 open PR 的 changed paths。`appliances.js` 與 #81 同檔，
此次只改 sink／washer 投入，不改其 helper 身份、拆除及回收；`convert_assets.py`
與 #87／#88 同檔，此次只改 `make_items`，沒有幾何、UV、手持冰箱或動畫改動。
已核對彼此 patch hunk；仍需合併時保留各方變更，不能用整檔覆蓋。

全部遠端分支基線最高為 0.1.56，本候選以既有 Core
`paired_release.plan_pair` 正規產生 0.1.57 配對；UUID 保持、history 僅追加。
此 main-based 分支不包含 #81／#87／#88／#94 等 open PR，較大版號不表示
可覆蓋它們的已選候選。整合後應為實際 combined payload 再凍結配對。

保持 Draft。沒有 BDS、Minecraft 客戶端、用戶電腦、LIVE、安裝、merge、Tag 或 Release。
