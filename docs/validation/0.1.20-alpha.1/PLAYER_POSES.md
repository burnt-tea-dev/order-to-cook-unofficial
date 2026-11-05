# 手洗：身體姿勢、前臂端點及第一人稱

本次從 0.1.19 接續。Java main 已重新核對，仍為 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`；`player_wash`、實際 `drive_idle.geo.json` 與第一人稱 renderer 分別核對，不以未使用的 `player.geo.json` 當玩家骨架。

## 本次實作與仍有的差異

| 範圍 | 本次處理 | 沒有聲稱完成的部分 |
|---|---|---|
| 身體 | 保留原 body 的 Y=0.95 縮放、torso 前傾 7.5°、頭部節拍、雙腿位移；解開原生 body 對頭／手臂的額外父層變換 | Java 自訂 renderer 的整體落點、皮膚／盔甲／各客製玩家骨架與實際畫面仍未比對；這不是完整玩家 renderer |
| 前臂 | 原 lower-arm 的旋轉及 0.75 像素位移參與肩膀到手端的目標；原生整臂旋轉／長度匹配兩端，不再丟棄前臂資料 | 原生整臂仍沒有肘關節；中間輪廓、彎肘及皮膚變形不等價。沒有新增骨骼或覆寫原生 geometry |
| 第一人稱 | 獨立有限 clip，在官方原生空手右臂基準上重播原手洗相對節拍；不把第三人稱身體縮放／前傾套入鏡頭手臂 | 原生空手 renderer 隱藏左臂；Java ACTION 校準、雙臂畫面及分段前臂未移植。VR 保留原生，不套本次校準；可見動作尚未觀察 |

第三人稱與第一人稱各用專屬 controller，同一洗碗開始時送兩個請求；client 用 `query.is_first_person` 選當前視角，所以中途換視角不用重開 session。四秒有限動畫，完成及每個既有取消入口對兩個 controller 各送停止替換；其中一個動畫請求失敗不妨礙另一個，也不影響盤子交付。沒有新玩家循環、持久欄位、裝備替換或跨包分支。

生成器只做本段手洗 retarget，不建立通用玩家框架。原始骨架與動畫是生成來源，提交的 RP 是生成產物。20 Hz 取樣保留兩輪原兩秒節拍；測試以獨立的正向骨架計算檢查實際生成檔案，在原關鍵點及中間取樣時刻，肩膀／手端／頭／身體／腿的位置差小於 0.02 像素。這是模型資料檢查，不是渲染截圖。原生手臂仍有中段形狀誤差。

## 原生限制的依據

官方 [1.26.60.5 玩家骨架](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json) 的 `rightArm/leftArm` 是各一個完整 cuboid，沒有 lower-arm 子骨。原作則把上臂與前臂分成兩段。官方[動畫結構](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_animation.v1.8.0?view=minecraft-bedrock-stable)只提供既有骨骼的 position／rotation／scale，不能用 animation 新建肘關節。

官方[第一人稱 render controller](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/render_controllers/player.render_controllers.json) 的空手 `leftArm/leftSleeve` 顯示條件為 false；持地圖或特定使用狀態才顯示。洗碗又要求雙手空，故不能把「已有左臂動畫資料」當成「第一人稱會顯示左手」。動畫不能改 `part_visibility`。

右臂基準取自官方 [player_firstperson.animation.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/animations/player_firstperson.animation.json) 的 `empty_hand`：rotation `[95,-45,115]`、position `[13.5,-10,12]`。本次保留此原生基準，再疊原作相對節拍，沒有直接照抄 Java 的攝影機座標。

Java 第一人稱用 [HeldItemRendererMixin](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/mixin/client/vehicle/HeldItemRendererMixin.java)／`RiderFirstPersonArmRenderer` 取代原生雙手 renderer，另用 `FirstPersonArmCalibration.ACTION`、完整玩家皮膚及分段 geometry。本包沒有同等 renderer 入口；也不藉覆寫 player.json、全域 humanoid geometry／render controller 或改玩家背包去假裝已等價。

新出的 [server-graphics](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-graphics/minecraft-server-graphics?view=minecraft-bedrock-experimental) 是氣氛／色彩／光照／水面設定，沒有玩家 geometry／骨骼或 part visibility 的 API，不能靠加該模組解決此問題。正式模組仍為 server 2.11.0／UI 2.0.0，實驗要求不變。

## 驗證範圍

- 真 appliance service 測試：兩個 controller 的開始／80 tick 完成／全部取消入口／每路動畫失敗都不改盤子結果。
- 真生成器重建：身體與肩膀／手端的正向比對、兩輪端點、第一人稱原生首幀及視角分流。
- 本輪[原生報告](player-poses-native.json)：BDS 1.26.60.6／stable server 2.11.0，真 QA SimulatedPlayer 的兩個 controller 起／停請求均受理，正式 appliance adapter 配合原生視線／庫存完成洗碗與望開取消，共 9/9。20 tick 時仍在清洗，再等 65 tick 後交一盤；精確 79／80 tick 分界由 service 測試覆蓋。observer 是 `tests/bedrock-handwashing-checks.js`。正常 stop／Quit correctly／exit0、無引擎錯誤或 OOM；unit inactive/dead/MainPID0 後已刪自己的 QA 世界及引擎並交還時段。GameTest 1.0.0-beta 只在 QA 副本，沒有加入正式依賴。
- 實際 client 畫面、第一人稱左右手、視角切換及可見停止仍未觀察，不新增真人等待門檻。原生 JSON 記錄受測正式程式／動畫的相同內容，沒有冒用 0.1.11 單 controller 的歷史結果。

沒有存檔格式變更，不重跑已有效的設備保存、訂單時鐘或餐盤遷移場景。本批 OTC 沒有被選入 LIVE，來源合併不等於首次安裝。
