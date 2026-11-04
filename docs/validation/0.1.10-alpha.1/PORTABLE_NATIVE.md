# 0.1.10：原生拆除與同世界保存結果

2026-11-05，BDS 1.26.60.6／stable Server API 2.11.0，啟用實際宣告的 Upcoming Creator Features。固定來源為 `dfdd5809bbbaa8471a950f05a7863de0a6b98ff8`，不是活動工作區。逐項實際結果、模組／實驗條件及停止狀態以 [portable-native.json](portable-native.json) 為準。

## 真正測到的行為

- 引擎執行 `setblock ... air destroy`，觸發生產 `onBreak`；observer 沒有直接呼叫破壞 adapter。立牌和打單機各只生成一件可讀取持久資料的原生 ItemStack，並非用普通掉落物假裝帶資料。
- 150 個菜單變體、原店主／等級／全部統計在掉落物內保留。物品存入原生庫存，正常 stop，再啟動**同一個 QA 小世界**後，完整資料、nameTag、lore 和包裹期限均能讀回。
- 重放使用真正的原生物品、庫存與方塊，配合 fixture actor 呼叫正式放置 adapter；確認持久資料還原，沒有把 fixture 說成真人玩家輸入。
- 新產生彩蛋訂單的姓名、帳號、UUID、特殊旗標及寬版選擇亦能在同次正常保存／重啟後保留。

兩次都正常 stop／`Quit correctly`／exit 0；沒有引擎或內容錯誤、OOM。服務停止讀回完成後，只刪掉此 QA 小世界，保留原始 logs、observer、來源輸入及報告。沒有改動 LIVE，也沒有裝入新 LIVE pack。

## 本輪原生測試找到並修正的錯誤

最早的隔離啟動因 offline authentication 搭配 allow-list 被引擎拒絕；只修正隔離設定，保留該失敗。下一次才真的載入 0.1.8，抓到共用 `ordertocook:use` 將 `onConsume` 掛到沒有 `minecraft:food` 的指南、餐盤等物品；0.1.9 繼承此問題。這是不同的兩個失敗，沒有把舊結果改成通過。

[PR25](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/25) 以新配對版本 0.1.10 修復：普通使用保留在共用元件，食用完成移到包裹專用元件。之後沿同一世界，用本文件固定來源完成上述 first／reload；沒有為修正額外生成另一個世界。0.1.8／0.1.9 仍不適合遊戲交付。

## 尚未證明的部分

沒有真 Player 的挖掘、放置或吃完輸入，沒有 GUI、聲音或畫面比較；命令 destroy 不是玩家滑鼠操作證據。測試亦不是正式既存世界的完整家族遷移或首次 LIVE 啟用。這些範圍保持分開，不新增真人驗收門檻。

測試源頭為 [bedrock-portable-checks.js](../../../tests/bedrock-portable-checks.js)，只能沿既有隔離流程使用，不能安裝到 LIVE。
