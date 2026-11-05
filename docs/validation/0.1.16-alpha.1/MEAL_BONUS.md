# 用餐加賞：0.1.16-alpha.1

2026-11-05，BDS1.26.60.6／stable server2.11.0／ui2.0.0。原生冰箱仍需Upcoming Creator Features；本次隔離測試另啟用gametest與QA模組1.0.0-beta。正式包沒有增加API模組、player.json、全域排程或替代貨幣。

原作固定提交[e59e3dbc 的 CustomerEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/entity/CustomerEntity.java)的 `tickServerAction` 在120 tick動作結束時呼叫 `grantPendingBoomBonus`；[TakeoutBagItem](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java)在交餐時只準備金額及原交餐玩家身份。舊文件所寫「交餐合併付款」已由這項Java行為取代。

交餐只付報價及一般小費；普通10%／彩蛋60%、1–4加實際餐廳等級的抽選不變。新餐點在既有 `pendingDishes` 記錄保存 `bonusPlayerId`，約6秒結束時移除待付標記、更新餐廳收入及在線原交餐者的既有個人收益，再保存並透過既有貨幣路徑給幣。一般交單次數、加急／外送計數不再增加。玩家離線則只計餐廳收入，不等重登補付。

5秒前點取餐盤取消待付加賞，原交餐款與小費保留。5秒後取髒盤、打破／替換方塊只領一次盤子，待付加賞仍保留到用餐結束；訂單歷史裁剪亦不會刪掉它。舊版已付款餐點沒有待付標記，載入後不重付。保存失敗不先給幣，恢復原記錄後可重試；失敗的提前收盤亦恢復原待付狀態。

[原生結果](meal-bonus-native.json)為同一QA世界首次14項、磁碟保存重啟5項，全數通過且正常停止，無內容錯誤或OOM。[可重現觀察器](../../../tests/bedrock-meal-bonus-checks.js)載入正式交餐、餐盤、保存及進度實作，使用真實原生庫存與SimulatedPlayer。涵蓋5秒不付款、取髒盤仍保留加賞、6秒付款、提前收盤取消、離線餐廳收入、重啟不重付。互動由adapter驅動，不冒稱硬體輸入或客戶端聲畫。來源回歸另涵蓋歷史裁剪、未載入錨點、保存／庫存失敗及舊餐點。

仍有兩項界線：計時沿用既有持久毫秒時間與每5 tick取樣，並非Java只計已載入遊戲tick的時鐘；因此服務停機時間亦會跨過期限。世界記錄與原生物品沒有共同原子提交，待付標記已保存而給幣前強制終止或原生給幣例外可能丟失該筆加賞，保留已結清狀態以免重複發幣；沒有宣稱任意崩潰都零損失。這些限制沒有被本次原生成功掩蓋。
