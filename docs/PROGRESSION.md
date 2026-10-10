# 個人進度：原作規則與基岩版適配

此功能把原作的 advancements 轉成附加包內的個人進度清單與通知。它不會授予 Minecraft／Xbox 平台成就，也不會額外發放金幣、物品或經驗。

原作來源為 [breezeth-CN/OrdertoCook](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)，固定 commit 為 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`。採用該 commit 的 common advancement 資料與 Forge 1.20.1 觸發程式；保留 breezeth 的 GPL-3.0 來源歸屬。基岩版標題使用繁體中文，條件說明以實際觸發程式為準。

## 11 個原作進度

| 原作短 ID | 顯示名稱 | 精確條件與本版處理 |
|---|---|---|
| `root` | 開始營業啦 | 玩家親自放置打單機；開啟既有機器、持有機器物品、切換營業狀態均不等於放置。 |
| `first_order` | 首單達成 | 玩家親自成功交付第一張訂單。普通、加急、遠距、堂食、到店均可。 |
| `first_urgent` | 別餓，我來了 | 玩家親自成功交付第一張加急訂單。單純接取、打包或超時不算。 |
| `first_long_distance` | 千山萬水總是情，給個好評行不行 | 玩家親自成功交付第一張帶遠距標記的訂單。 |
| `earn_100` | 小賺一筆 | 玩家的訂單累積收益達到 100。 |
| `earn_1000` | 我要開分店 | 玩家的訂單累積收益達到 1,000。 |
| `earn_10000` | 世界首富要從一家外賣店開始說起 | 玩家的訂單累積收益達到 10,000。 |
| `dishwasher` | 全自動洗碗機 | 玩家親自用工具箱把洗碗池成功升級為洗碗機。直接放置洗碗機、使用或完成一次清洗不會觸發。 |
| `eight_star_restaurant` | 八星級餐廳 | 玩家親自成功將打單機由 Lv.7 升至原作上限 Lv.8。持有、查看或接手一台既有 Lv.8 機器不會補發。 |
| `golden_restaurant` | 金牌餐廳 | 同一玩家在同一維度擁有至少 4 間已放置餐廳，其中至少一間的總利潤等於該維度的最高值；並列可，0 收益並列亦可。 |
| `expired_bag_eaten` | 你的外賣員正在攻擊你的外賣！ | 原作需要真的食用一個已逾時的外送包裹。目前未移植食用行為，清單明確標示「尚未移植」，不以查看或丟棄包裹代替解鎖。 |

原作各 JSON 的 `parent` 只描述展示樹。它不是完成其他進度的前置條件：沒有親自放過打單機的員工，仍可透過交餐取得首單；取得首單不會自動補發 `root`。逾時包裹的原作父節點是 Minecraft 的 `adventure/root`。

全部 11 個定義來自 [common advancement 目錄](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/data/ordertocook/advancements/ordertocook)。基岩版的固定清單在 [progression.js](../runtime/BP/scripts/progression.js)，每個定義保留完整 `sourceId` 與 `sourcePath`。10 個條件有執行層事件介面，1 個保留為未移植狀態。

## 收益屬於實際交餐的玩家

`earn_*` 比較的是玩家個人的累積 Prestige，不是餐廳的總營業額，也不是背包當前持有的金幣。原作交餐後先加玩家 Prestige，再觸發 `TOTAL_COIN`；坐姿顧客的爆炸加賞也會加 Prestige 並重新檢查收益門檻。

因此，跨多間餐廳工作的同一名玩家可以累積進度；員工替店主完成交餐時，由交餐員工取得個人收益進度。購買設備、花掉收入、丟出金幣不會使累積收益倒退。測試套組、指令給幣、撿起他人的金幣或換零不增加訂單進度。成功交單即使結算為 0，仍可取得首單；本版既有 `result.reward` 包含基本收益、小費與驚喜加賞，所以只記一次該結算總額。

來源：

- [TakeoutBagItem.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java)：三條交單路徑都在加 Prestige 後觸發訂單與收益進度；食用逾時包裹另有真正的 `finishUsingItem` 觸發。
- [OrderNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java)：爆炸加賞對玩家 Prestige 與 `TOTAL_COIN` 的處理。
- [OrderCompletedCriterion.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/advancement/OrderCompletedCriterion.java)、[TotalCoinCriterion.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/advancement/TotalCoinCriterion.java)：加急／遠距標記判斷與包含等號的收益門檻。
- [PrestigeManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/PrestigeManager.java)、[PlayerEntityMixin.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/mixin/PlayerEntityMixin.java)：原作的玩家個人欄位與存檔。

## 金牌餐廳的兩個文字落差

原作中文敘述寫「全服擁有超過 3 個餐廳」。但 [RestaurantRegistry.tryGrantGoldenRestaurant](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/RestaurantRegistry.java) 的實際程式先計算**同一玩家擁有的餐廳數量**，不足 4 間即跳過。它再找該玩家是否擁有一間利潤等於最高值的餐廳；比較單間利潤，不把 4 間店的利潤相加。沒有嚴格領先或正利潤要求。

此外，[MachineRankingState.get(world)](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/MachineRankingState.java) 使用傳入 `ServerLevel` 的 `world.getDataStorage()`。`allPersistedWithOnline(world)` 遍歷的是該維度的持久記錄，並非把所有維度的存檔餐廳合併。基岩版依此**逐維度**檢查，同一玩家任一維度達標即可；主世界 2 間加地獄 2 間不算 4 間，其他維度的競爭餐廳也不影響這一維度的第一名。既有全世界餐廳排行榜的展示範圍與此條件不同。

已放置、但區塊尚未載入的餐廳仍在原作持久名冊內；休息中的餐廳也不被排除。本版不因 `loadedBlock` 沒有結果排除餐廳；若已載入位置確定不是打單機，當次排行快照不計入。已移除／移除中的記錄不計入。本版用穩定玩家 `ownerId` 對應原作玩家名稱判斷，避免玩家改名或顯示名稱碰撞改變所有權。餐廳記錄需有 `id`、`ownerId`、`dimensionId`、非負安全整數 `stats.earnings`，以及可選 `removing`。重複 ID 或不合法排行資料會使判定不通過，不能藉此多算店數。

升級觸發另見 [OrderMachineBlockEntity.tryUpgrade](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java) 與 [OtcUpgradeBoxItem.tryUpgradeWashingTable](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/OtcUpgradeBoxItem.java)。進度授予實際操作玩家，不是自動授予設備主人。

## 純模組與執行層的約定

`progression.js` 不引用 Minecraft API，不讀寫世界、不處理訂單物證、不授予貨幣。其介面如下：

| API | 用途 |
|---|---|
| `createProgress(now)` | 建立版本 1 的空白個人進度。 |
| `parseProgress(raw, now)` | 解析 JSON；僅 `undefined` 表示新記錄。壞 JSON、不支援的版本或不合法資料直接拒絕，呼叫端須保留原始存檔。 |
| `applyProgressEvent(state, event, now)` | 回傳 `{state, newlyUnlocked, changed}`；不修改輸入。`newlyUnlocked` 是定義物件陣列，包含 `id`、`title`、`description`、`frame`、`sourceId` 等欄位。 |
| `qualifiesGoldenRestaurant(playerId, restaurants)` | 依上面的所有權、維度、店數及並列利潤規則判斷。 |
| `progressRows(state)` | 產生清單顯示資料，包含 `unlocked`、`unlockedAt`、`current`、`target`、`status`。 |

固定個人狀態為：

~~~json
{
  "version": 1,
  "startedAt": 1800000000000,
  "updatedAt": 1800000000000,
  "totals": { "earned": 0, "completed": 0, "urgent": 0, "longDistance": 0 },
  "unlocked": {}
}
~~~

執行層只應傳入可信且已提交的事件：

| `event.type` | 其他欄位 | 檢查 |
|---|---|---|
| `order_machine_placed` | 無 | 實際玩家放置事件。 |
| `order_totals` | `earned`、`completed`、`urgent`、`longDistance` | 已對帳的個人累積絕對值。全部須為非負安全整數，任何一欄倒退都拒絕；加急／遠距計數不得超過完成單數。一次檢查 6 個訂單進度，同一快照重播不重複記數或通知。 |
| `order_completed` | `reward`、可選布林 `rush`、`longDistance` | 僅供可信的一次完成事件。執行層正式對帳使用 `order_totals`，不重播此增量事件。 |
| `restaurant_upgraded` | `level` | 成功升級事件，只有 `level === 8` 解鎖。 |
| `dishwasher_upgraded` | 無 | 成功的洗碗池轉換事件。 |
| `restaurant_ranking` | `playerId`、`restaurants` | 傳入所有已登記餐廳，模組自行按維度分組。 |

訂單真實性、權限、物品消耗、一次結算及跨存檔對帳由執行層負責。個人 `state` 與每家餐廳已對帳 checkpoint 應分開保存；在原餐廳完成訂單的同一次保存內追加個人帳簿，再以絕對累積值更新個人進度。只有個人存檔成功後才顯示新進度通知；重啟後重試相同 checkpoint 不應再增加收益。移除餐廳前也需要完成該帳簿的對帳，避免拆店遺失尚未同步的個人收益。

升級自 alpha.2 時，餐廳既有營業額沒有交餐玩家歸屬，不能可靠推算個人的歷史收入。新個人計數從首次記錄本功能之後開始，不把餐廳累積金額灌入任意店主或員工。這不妨礙金牌餐廳以目前仍然存在的餐廳名冊判定；其條件本來就是目前所有權與排行。拆店、搬遷或新建同址餐廳的帳簿必須有不同識別，舊 checkpoint 保留以避免回放。

操作型進度也隨原遊戲記錄保存待處理事件：放置與八星升級寫入餐廳，洗碗池升級寫入設備。個人進度暫時寫入失敗時，tick 重試事件，不重做升級或再次扣工具箱／金幣；解鎖確認保存失敗可安全重播。待確認的設備在正常玩家拆除前先完成進度保存；失敗保留設備及事件。各玩家獨立對帳，單一壞存檔不阻塞其他員工，但餐廳仍保留未同步的帳簿直到可安全清理。

帳簿表示成功交單的**結算金額**。原有訂單保存與實物發幣之間不是跨服務原子交易，不能推論任意強制終止時點都與背包及地面實物幣完全相同；詳細界線見 [VALIDATION.md](VALIDATION.md)。

## 驗證與 dot 的客戶端驗收

純模組測試在 [progression.test.js](../tests/progression.test.js)，涵蓋收益門檻、絕對對帳重播／倒退、同一事件跨多門檻、玩家所有權、4 店數量、同維度／跨維度、並列與零收益、區塊卸載、升級事件、未知／逾時包裹事件、壞存檔及時鐘倒退。這些測試不等於客戶端驗收；本功能仍需隨整合版執行 `npm run verify`，以該次 CI 實際結果為準。

dot 需特別檢查：

- 同一筆交餐重點顧客、重開清單、離開再進入、重啟後，進度與通知都不重複。
- 同一玩家跨店交餐可以累積；兩位玩家分工時，店主與交餐員工的個人收益分開。
- 花幣、撿幣、測試給幣不改動訂單累積；普通訂單不誤觸加急／遠距。
- 新放機器、工具箱成功升級、實際升至 Lv.8 的通知與清單一致；查看舊機器不冒領操作型進度。
- 同維度 4 間、跨維度 2 + 2 間、並列 0 收益、遠處未載入店、拆店與同址重建，符合上述規則。
- 11 項清單可讀，逾時包裹項明確標示未移植；使用觸控及手把時，詳情可返回個人清單；關閉或取消回遊戲，需要時重新使用指南／機器入口。

客戶端的實際通過／失敗與裝置資訊由 dot 回報；此文件沒有聲稱任何客戶端測試已通過。
