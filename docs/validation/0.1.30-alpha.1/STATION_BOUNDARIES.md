# 設備認領與供應架範圍修正

2026-11-08。從 stable main `9c6d73a80795ad8ee102dab4793966ceba04eb72`
重現並修正兩項仍存在的問題。這兩個修正曾包含在未合併的
[POI PR #11](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11)，
現在以目前主線實作獨立交付；沒有整合其 beta API、索引、排程或舊存檔流程。

## 先驗權，再認領

`claimStation` 原先先呼叫 `getStation`，並把無 owner 設備認領給點擊者，
才判斷附近餐廳權限。訪客雖收到拒絕訊息，仍會新增 station 或改寫舊立牌 owner，
使原本可用的無 owner 菜單不再符合餐廳選牌條件。現在先使用既有
`nearestRestaurant`／`canManage` 驗權，拒絕時不建立或寫入 station。
店主、仍有權限的員工、管理員及餐廳外既有認領規則保持不變。

回歸經實際 `playerInteractWithBlock` 訂閱與延後回呼進入正式 adapter，
涵蓋未登記方塊、舊無 owner 立牌、撤權員工、店主／員工正向對照及餐廳外設備。
拒絕前後比較完整測試 world properties，並確認原菜單不因訪客操作失去綁定。
這是 native IO doubles，不是原生 Player 或多人封包驗收。

## 操作台兩種供應架使用每軸 ±5

固定 Java [RestaurantSupplyCompatApi.targets](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/api/RestaurantSupplyCompatApi.java)
對三個軸分別掃描 `-radius` 到 `+radius`。主線原球形條件錯誤排除了
例如 `(5,5,5)` 的架子。既有 `nearbyStations` 增加明確的 cube 選項，
只由操作台的缺料預覽及實際製作使用；預設仍為球形，冰箱半徑不擴大。
同維度、載入方塊類型、供應量、權限及製作前重新核對沿原路徑執行。
此修改不調整供應架之間的既有選取順序，也沒有增加索引或輪詢。

兩種架子的八個立方角落均測預覽「可製作」及真正扣料／裝盤或打包；
六個面外一格均不顯示可製作且不扣料。另核對鄰店的角落架子不能由
表單或持單入口耗用，及冰箱仍排除球形半徑外的點。

## 已執行的驗證

- 修前：58項聚焦測試中37通過、21失敗（包含兩個角落父測試、16個角落子測試及3個權限案例）。
- 修後：相同58項全部通過。
- `npm run verify`：584項 Node、官方 stable型別檢查、367份JSON資源驗證及配對建置通過，資源錯誤為零。
- 既有幾何／生成器23項、分段玩家來源13項、CI範圍8項通過；分段測試使用固定Mojang輸入的臨時副本，不新增打包資產。
- 合規、release-policy、`git diff --check`及舊release-history不變檢查通過；獨立審查未發現需修正問題，另重跑58項聚焦測試通過。
- 本機 Node24.22.1／Python3.12.14／Pillow13.0.0；必要遠端CI使用其固定環境另驗。

使用新配對身份 `0.1.30-alpha.1`，保留UUID、2.11.0／2.0.0 API相依與
Upcoming Creator Features要求；baseline更新，release-history只新增030。
沒有發布Tag／Release、安裝到玩家世界、執行BDS或客戶端。

## POI仍未完成

核查時 #11 head為 `f903580ffa30370d1219ef824e3a6c3ddce50d13`，
落後目前main84個提交且有合併衝突。原生密集查詢退化的既有結果仍成立，
此次沒有重測或宣稱解決性能問題，也沒有把舊POI原生結果套用到030。
該分支需要獨立處理新主線整合及原生性能證據，維持Draft。
