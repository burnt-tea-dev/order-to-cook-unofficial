# 椅上喝彩：0.1.13-alpha.1

觀察日期：2026-11-05。來源版本由[package.json](../../../package.json)持有。

玩家坐在本包椅子時，以原生攻擊／挖掘動作觸發三秒喝彩，期間重複訊號不延長或重抽。音效在0／12／20tick播放；離座、換座或離線停止。只取消本包椅上玩家的近戰傷害與挖掘，不取消投射物、站立或載具操作。訂單、金幣、背包及存檔格式不變。

## 原作依據與適配

固定Java提交e59e3dbc的[OrderToCookModClient](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/OrderToCookModClient.java)在椅上攔截攻擊鍵，以新按下的滑鼠左鍵觸發喝彩。[RiderAnimatable](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/gecko/RiderAnimatable.java)保留60tick動作與0／12／20tick三次村民聲音、三組音高範圍。

Bedrock依[PlayerSwingStart](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerswingstartaftereventsignal?view=minecraft-bedrock-stable)的Attack／Mine訊號；這不是原作原始滑鼠按鍵狀態，持續挖掘在三秒結束後可能再觸發。聲音使用既有Bedrock村民idle／yes：Java celebrate原本重用yes樣本，trade亦以yes適配；不宣稱兩平台聲場完全一樣。

動畫由既有轉換器讀原player_sit&clap的左右手臂關鍵幀，映射至原生rightArm／leftArm，生成有限三秒clip與同controller停止clip。不更換player.json；原作分段前臂、完整身體及第一人稱renderer仍未還原。

## 實際驗證

- 實際服務41項實體回歸通過，包含四項新增喝彩案例：單次啟動及三次聲音時序、重複訊號、椅上傷害與挖掘取消、其他動作／載具不受影響、離座／換座／離線、動畫API失敗不改訂單或物品。
- 既有轉換器15項測試通過，新增案例直接比較原始雙臂關鍵幀及生成clip，沒有重新實作動畫演算法。
- BDS1.26.60.6、stable server2.11.0／server-ui2.0.0，加QA專用gametest1.0.0-beta；gametest與upcoming_creator_features開啟，私有網路隔離。15項原生檢查通過：真正模擬玩家坐椅、Attack／Mine訊號、椅上近戰取消且豬不扣血、離座後正常扣血、挖掘取消且石頭保留、三秒後可再觸發、離座拒絕、原生playAnimation接受起停請求及玩家清除。
- 引擎正常停服exit0，無內容錯誤或OOM，峰值545,722,368 bytes／swap0。首回在引擎啟動前因操作命令未給memory.high而停止；補上既有設定後才取得上述結果，未改產品程式以遷就測試。
- [原生觀察器](../../../tests/bedrock-chair-clap-checks.js)只放在獨立QA entry，不進入產品runtime。此改動不新增保存資料，沒有以無關的重啟測試充當畫面驗收。

以上不是實際客戶端姿勢、第一人稱、聲場或鍵鼠／手機／手把的驗收。OTC尚未首次安裝LIVE；本版沒有觸發正式服部署或首次選包。
