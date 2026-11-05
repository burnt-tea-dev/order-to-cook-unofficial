# 世界tick訂單期限（0.1.19-alpha.1）

2026-11-05，BDS1.26.60.6、stable server2.11.0。僅診斷副本加入GameTest1.0.0-beta；正式包沒有新增API、實驗或常駐計時器。

原作固定提交的[OrderGenerator.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderGenerator.java)使用世界gameTime加36000／12000 tick；[OrderItem.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/OrderItem.java)優先讀取ExpiryTick，只有舊資料使用Unix期限換算。

本版用原生`system.currentTick`，存檔原生`currentTick`亦會保存。訂單存`expiresTick`，實物存`ordertocook:expires_tick`，原Unix欄位留作相容與事件時間。關服不消耗期限；伺服器運行時，離開區域仍會倒數。剩餘時間、接單、裝盤、交單、顧客移除及過期包裹食用共用世界tick。固定UTC到期lore改成引導使用詳情查看剩餘時間。

舊餐廳訂單在啟動時按當時餘時向上取整至tick；舊手持包裹在正常使用時接續期限，保留原完整ItemStack。從未接觸且已無餐廳歷史的舊包裹仍只能按其舊Unix資料轉換，與原作相容讀法相同。新包裹不依賴保留訂單歷史。

完整`npm run verify`：518項、型別、JSON及配對打包通過。[原生結果](order-deadlines-native.json)為首次8項、同世界重開主流程8項、續測4項，共20項成功行為斷言。重開測試曾因observer把包裹放進原付款槽而誤判，原失敗保留；改用空槽後，到期拒收、原生開始／完成食用和舊包裹metadata通過。關服逾7秒後，同一個設定5秒期限的訂單、箱內包裹與顧客仍可交付；5秒／12tick只作QA短期限，未改預設30／10分鐘。

[主要observer](../../../tests/bedrock-order-deadline-checks.js)只能在隔離QA入口匯入；同一世界正常stop，停逾6秒後重開。停止日夜與time指令不會改變世界總tick期限。日夜absolute time及測試自訂WorldClock在dodaylightcycle=false時會停止，沒有採用它們作期限來源。

這不等於真客戶端畫面或真人輸入驗收。打單機刷新／到店判定間隔仍有現實時間適配；跨庫存原子付款及其他[剩餘差異](../../PARITY.md)未宣稱完成。OTC仍未首次安裝LIVE。
