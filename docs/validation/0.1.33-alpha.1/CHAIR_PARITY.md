# 到店椅子範圍與空椅選取

2026-11-08。基底main為 `e0d15d3e3485d1c92b5796f5f8182a26df964e6d`。
配對身份更新到0.1.33-alpha.1，保留UUID、stable API 2.11.0／UI2.0.0及
Upcoming Creator Features要求，release-history僅追加新身份。

## 兩項修正

固定Java [OrderNpcManager.findEmptyChair L220–253](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java#L220)
使用水平半徑24、Y±8的圓柱；檢查頭部空間與佔用，最後
`random.nextInt(candidates.size())`，不是固定最近椅子。

1. 顧客服務原本已是該圓柱，但到店生成及接單的`nearbyStations`前置
   判斷仍用3D球形，拒絕例如(24,8,0)的合法座位，反而接受(0,9,0)。
   新增明確cylinder／halfHeight選項，只有這兩處椅子入口使用。
   預設sphere及操作台cube不變，維度／類型／loadedBlock檢查沿用。
2. 到店顧客的`findChair`不再依距離排序後回傳第一張。先保留原有claim、佔用、
   載入、方塊及兩格上方空間檢查，再對所有合格椅子等機率抽取。
   沿用可注入的`ctx.random`；不追求與Java逐seed相同序列。

普通機器單不使用隨機；獨立審查確認 [NormalOrderNpcManager L16](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/NormalOrderNpcManager.java#L16) 呼叫的是 [findSpawnPosNormal L1528–1565](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java#L1528)，按x、z、y向下掃描找到第一個合格椅便返回。本批保留普通單原nearest-first適配，尚未對齊這個固定掃描順序。

到店隨機選取需要驗證所有空椅候選，不是性能優化。這次沒有原生高密度
性能測量、POI、空間索引或新輪詢；#11的原生性能及合併衝突仍未解。

## 回歸與界線

39項新測試使用正式main／store／entities來源及隔離native IO doubles：

- 四個水平邊界各Y±8，均測實際接單入口與原生machine tick回呼的到店
  前置判斷；拒絕水平圓外、Y±9，保留冰箱預設sphere。
- 三張不同距離椅子的六個RNG區間邊界，確認等寬區間且不固定取最近。
- 佔用、上方第一／第二格受阻、移除、未載入、不同維度及超範圍候選
  先排除；連續生成兩名顧客坐在不同可用椅子。另以第一名NPC尚不可查詢時重入生成，驗證in-flight claim排除；普通單三個RNG輸入保持原nearest-first，不被改為隨機。
- 相同39項對未修改main：14通過、25失敗；修後39項通過。
- `npm run verify`：676項Node、官方stable型別、367份JSON資源與配對建置全過；幾何23、固定輸入分段來源13、CI範圍8及合規／release-policy全過。
- 獨立審查抓到普通單不可一起隨機，修正後複審無阻擋；另重跑83項相關測試、676項全量及check。mutation退回普通單隨機會失敗2項，移除chairClaims會使新重入案例失敗。
- 本機Node24.22.1／Python3.12.14／Pillow13.0.0；遠端CI另驗固定環境。

mainFixture的到店測試刻意使用既有entity service stub，只證明前置
範圍與回呼接線；獨立entity service案例才執行真正選椅／座位建立。
兩者都不是引擎或真人輸入證據。沒有BDS、LIVE、多人、客戶端或Release。

**未在此修復的生命週期差異：**到店前置判斷只確認範圍內有已載入椅子，
不保證空座或成功生成。現有流程先建立offered order，再嘗試spawn，
失敗可留下待重試訂單；固定Java [WalkInNpcManager.spawn L24–53](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/WalkInNpcManager.java#L24)
在找不到空椅／建立顧客失敗時直接返回false。應另以持久化與生成失敗
測試處理，不能把本次空間／選取修正當成這個交易問題已解決。
