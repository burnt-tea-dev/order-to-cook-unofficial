# 玩家手洗動作：雙臂最小適配

來源核對日期：2026-11-05。Java 固定提交仍為 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`；公開正式版1.3.6與此來源自稱1.3.7a分開，不以版號代替行為證據。

## 原作與本次範圍

原作 `OrderToCookModClient.beginWashing/stopWashing` 會在真正洗碗開始／停止時切換玩家動作；`RiderAnimatable` 給80tick有效期，`player_wash.animation.json` 是2秒loop。Java客戶端需持續按住使用、雙手空、望向池子，並排除本包椅子與小電驢；目前Bedrock仍沿既有「點擊開始，保持空手／視線，4秒完成，再點取消」輸入適配。本次補回椅子／小電驢的開始與中途取消限制。

原作實際用 `HumanoidAnimationAssets` 選取 `drive_idle.geo.json`／`drive_idle_alex.geo.json`，肩軸±4，有獨立手／前臂。不能把未使用的 `player.geo.json` 當成實際玩家rig。原生玩家骨架參考為 Mojang [v1.26.60.5](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json)，`rightArm/leftArm` 肩軸±5，而且是剛性整臂。

因此本次只取原雙臂rotation／position關鍵幀，轉成原生`rightArm/leftArm`，連續兩次原2秒節拍，產生**有限4秒**clip；使用專屬`ordertocook_handwash` controller，不改任何player.json。停止時用同controller的0.05秒空clip取代；即使玩家已離線、停止請求不可發送，原clip也不會永久循環。

全身縮放／俯身、分段前臂／手部、肩軸／臂長差異和原作第一人稱校準仍未還原。這是雙臂適配，不是完整Java姿勢。`override_previous_animation`只重設動畫中列出的兩臂，沒有覆寫其他玩家骨骼。

## 執行生命週期與證據界線

開始只送一次播放請求；完成、看開、持物、撤權、再點、拆池、盤子清空及離線均走同一停止入口。動畫請求失敗屬顯示問題，不更動洗碗成功／失敗或物品數量。既有盤子保存格式未變，不新增持久玩家狀態、全域玩家框架或跨包特例。

定向Node測試呼叫真appliance service，記錄原生IO替身收到的請求與盤子結果；Python測試用真生成器重建檔案，核對原關鍵角、2秒接點與4秒終點。這些不是實際渲染證據。

官方能力來源：[Entity.playAnimation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable#playanimation)、[PlayAnimationOptions](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playanimationoptions?view=minecraft-bedrock-stable)、[Actor Animation](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_animation.v1.8.0?view=minecraft-bedrock-stable)。選用的stable Server API 2.11.0型別含此方法；原生Player請求的實際受理結果另由隔離probe記錄。Server接受呼叫不能證明客戶端姿勢、動作取消畫面、第一人稱、GUI或聲音。

測試源頭：[bedrock-handwashing-checks.js](../../../tests/bedrock-handwashing-checks.js)。GameTest模組／gametest旗標只加入隔離QA副本，生產仍為stable2.11.0；未取得隔離時段不啟動BDS，不在LIVE測試。

## 實際原生結果

[原生觀察](player-handwash-native.json) 記錄BDS1.26.60.6、stable2.11.0及QA-only GameTest1.0.0-beta的9項通過。對象確實是原生QA SimulatedPlayer，不是一般Entity或覆寫方法的物件。直接開始／同controller空clip替換停止請求皆受理；正式adapter在原生庫存／視線下80tick完成一盤，望開取消保留髒盤，最後模擬玩家數0。這些只證明API受理與遊戲接線，不能觀察客戶端停止或姿勢畫面。

首輪測試驅動在通用`Player.lookAt`呼叫處失敗，原log只保存stack、未保存完整錯誤訊息；不是把動畫功能判成不可用。換成官方`SimulatedPlayer.lookAtLocation`後沿同一QA小世界完成，production程式與動畫資產沒有為測試改動。兩次原始結果分開保留。成功輪正常stop／Quit correctly／exit0，沒有引擎或內容錯誤、OOM；受控unit inactive／MainPID0後只清該小世界，沒有改LIVE或重跑前批保存場景。

診斷副本使用獨立BP/RP UUID及1.0.0→1.0.1測試身份，不偽裝成0.1.10升級；凍結0.1.11前已核對正式appliance程式與生成動畫逐檔相同於成功測試輸入。既有0.1.10來源與歷史不回寫，沒有新增持久化欄位，故不另造未受影響的存檔重啟週期。
