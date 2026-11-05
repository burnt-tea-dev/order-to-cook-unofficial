# 打單機的營業運作進度

## 原作與反例

固定來源 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642` 的 Forge1.20.1 與 NeoForge1.21.1 `OrderMachineBlockEntity.tick` 都先檢查 active，再於實際 blockEntity tick 累加 progress、遞減 walkInTimer。刷新間隔讀實際 config；progress 寫 NBT，walkInTimer 不寫 NBT，新載入 instance 從原常數1200tick開始，之後按設定的間隔重置。來源：[Forge](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L234)、[NeoForge](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L370)。

0.1.20 的正式 main harness 可重現：世界 tick 保持0，只將 Date.now 推後一小時，tickRestaurants 就把 orderSequence 從1增至2並推後到店期限。把 Unix 時間改成全世界 tick deadline 仍不對，因為機器區域停止運作時，世界 tick 會繼續，但 Java 機器進度不會。

## 本次行為與資料

- 原生 order_machine 每個方塊 tick 呼叫自己的 timing component，只有營業中才累積。暫停、區域停止模擬及停服不補算；普通／加急訂單仍沿0.1.19的全世界 tick期限，兩者不混用。
- 沿餐盤既有的小數值保存方式，`ordertocook:machine_ticks:<restaurant id>` 記錄機器累積的營業 callback 數。`restaurant.machineRefreshOrigin` 是上次刷新時的讀數；它與新候選單在同份 restaurant 保存提交。保存失敗會恢復舊候選／原點，下一次仍到期，可重試；不用每tick重寫整份菜單／訂單資料。
- 舊 nextRefreshAt 僅首次按當下剩餘時間向上取整接續，然後移除；舊 nextWalkInAt 不再控制到店。既存紀錄無法倒推出升級前已流逝的關服時間，沒有補造舊歷史。原記錄、unknown metadata、UUID和物品不重置，機器永久刪除時只清自己的 counter。
- 到店剩餘值只在本次載入期間記憶。營業暫停或機器仍載入但停止模擬時保留餘時；worldLoad 或現有巡查確實找不到機器後重起原始等待。單純漏一段 callback 不當成卸載。未新增全域 clock、輪詢、每版 shim 或退休 ID登錄。
- UI 剩餘時間讀營業進度，開始營業的提示使用實際設定，不再固定宣稱600秒。機器刷新與到店仍沿現有菜單／32個存活訂單／座位等可用條件，不藉本次計時修正改寫其他玩法。

原生 adapter 不再使用 wall deadlines。`core.js` 的受支持純核心數字 timestamp 介面仍可回 nextRefreshAt；這不是原生機器的運作時鐘。對外介面與原生 adapter 的適用範圍分開。

## 驗證與未確認

定向測試呼叫真 main／store／core／timing：牆鐘跳動、暫停、callback停止、同資料重新載入、partial tick的 legacy一次接續、刷新保存失敗重試、到店首次／設定間隔及卸載／重開 reset，以及counter清理／壞資料保留。printer、store及0.1.19訂單世界tick回歸沿本次涉及範圍一起執行。

原生 observer 是 `tests/bedrock-machine-timing-checks.js`：同QA小世界先用3秒fixture間隔保存中途進度，正常停服超過3秒再開，檢查同counter／origin／metadata及實際區域停止／恢復。這只是短測設定，不改600秒預設。來源 PR37 合併後，主協調依既定隊列明示交槽，本輪實際完成 [seed4／同世界restart7，共11項](machine-timing-native.json)。兩次正常 stop／Quit correctly／exit0、players0，無引擎錯誤或OOM；unit inactive/dead/MainPID0後刪自己的世界／引擎，已交還時段。正式受測 runtime 四檔的內容與0.1.21來源相同；GameTest1.0.0-beta只在診斷副本，production仍為server2.11.0。沒有冒用舊訂單／餐盤結果或改LIVE選包。

既有載入巡查每20tick；短於此間隔的完整卸載再載入是否仍能重起暫態到店等待，尚未確認。實際NPC到店呈現、聲畫與真人輸入未驗證，不新增真人等待門檻。舊0.1.19報告所寫的現實時間差異保留當時範圍，現況由本文件與當前程式負責。
