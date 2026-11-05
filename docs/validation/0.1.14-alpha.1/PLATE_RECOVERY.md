# 餐盤回收：0.1.14-alpha.1

2026-11-05。用餐餐盤可由有權限的玩家打破並落地一個髒盤；普通回收在背包已滿時亦落地。沿用同一持久claim及早收盤中斷，不重複發盤；椅上／載具輸入、訂單付款和其他背包格保持原行為。

## 本次核實的不一致

| 問題 | 依據及採用行為 | 尚未解決 |
|---|---|---|
| 舊差異表把餐盤無重力當作Java缺口 | 固定Java的FoodPlateBlock繼承BaseEntityBlock，沒有重力；修正文案，保留固定餐盤 | 原方塊碰撞及完整BlockEntity ItemStack仍不同 |
| 打破不能回收、滿包被拒 | 原FoodPlateBlock.use／onRemove會生成一份物品；本版沿既有claim接入原生hit與滿包落地 | 客戶端命中、觸控與完整原方塊破壞生命周期未確認 |
| 拆機在可堆疊髒盤上寫DP | 官方[ItemStack API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable)及本次真引擎均拒絕；改掉普通可堆疊髒盤，必要失敗讀回使用同呼叫的物品實體身份 | claim與世界物品仍不是同一筆原子交易 |
| 同段舊文案稱未生成彩蛋人物 | 現有顧客選擇器已接入，PARITY.md及現有回歸持有此事實；只更正過期文字 | 網路皮膚仍未移植 |

原作函式及完整語義見[來源契約](../../UPSTREAM_RULES.md#餐盤破壞與滿包回收)，不把新重力當成修復。

## 實際驗證

- 實際dining／main服務66項定向測試通過。涵蓋新增打破回調、滿包完整格子保留、提前中斷與重載、重複輸入、座椅／車輛／權限、失敗前回退及未知寫入不重發。
- BDS1.26.60.6、stable server2.11.0／UI2.0.0，加QA專用gametest1.0.0-beta；gametest及upcoming_creator_features開啟。首次13項、同世界重啟7項通過，兩輪正常stop／exit0，無內容錯誤或OOM。
- 原生首次：模擬玩家滿包回收落地一盤且所有格不變；真正attackEntity命中已註冊的事件回調，移除盤面並多掉一盤，手持名稱及數量不變；拆餐廳再掉一盤。三者皆為普通原生可堆疊髒盤，沒有ItemStack DP；重複呼叫不再發物。
- 原生重啟：同一餐廳沒有未領盤重生，三份實際掉落物保留；再次同步不新增盤面或物品，物品仍可堆疊；最後清掉QA物品。
- [觀察器](../../../tests/bedrock-plate-recovery-checks.js)使用測試專用完成訂單記錄及正式dining／store，不是完整接單至交餐的真人流程。獨立QA包只換診斷身份／entry及加入GameTest，正式玩法程式未重寫。

沒有變更保存格式、UUID或新設保存鎖。未首次安裝OTC至LIVE；沒有客戶端碰撞、觸控、聲畫或一般硬體輸入的完成聲明。
