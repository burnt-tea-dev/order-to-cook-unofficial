# 選牌、綁定及附近單牌營養

2026-11-08。基底為0.1.31的main
`0a8d24da30a5c5182ea590ab1403b7086bcced9e`，新配對身份
`0.1.32-alpha.1`。UUID、stable API 2.11.0／UI 2.0.0、Upcoming Creator
Features與既有持久資料保存不變。未發布Release或安裝到世界。

## 固定Java規則

來源均為原作固定提交 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`：

- [ensureBoundBoard L370–386](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L370)：既有有效立牌繼續供應菜品，不每輪改綁更高營養牌。
- [findBestBoardPos L390–418](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L390)：水平圓形、垂直範圍，營養優先、再取3D近者，完全平手保留x/z/y迴圈先遇到的座標。
- [tryUpgrade L457–500](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L457)、同檔L566–591及L774–780：升級與有效收益等級另查範圍內單牌最高營養，不限於已綁立牌，也不相加。
- [ModConstants L68–71](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/ModConstants.java#L68)：水平半徑24、垂直±8、Java掃描快取200tick。

## 實作及適配界線

將原本每軸±24方形改為水平圓形；保留有效綁定，包括仍存在但菜單已空的
立牌。初選與確認失效後重選才使用營養／距離／座標排序。舊方形角落的
不合資格綁定會重選；既有owner／staff、維度、範圍及實體方塊類型檢查
繼續適用，撤權牌不能持續供菜或貢獻升級營養。

`nearbyBoardNutrition`是同次正式同步取得的單牌最高營養快照，和綁定／
菜單／offered報酬一起保存。它單獨變動也會保存；失敗仍回滾canonical
record並可重試，穩定狀態不反覆寫root。缺此欄位的舊核心資料沿用菜單營養，
首次adapter同步補正。新生成菜品仍只從已綁`restaurant.menu`取樣；
accepted／packed訂單不因其他立牌消失而改寫。

原本有效綁定暫未載入時仍保留快照並延後相關操作，沿用0.1.31保護；
未綁定的高營養牌若無法確認載入，不以舊最高值繼續給予升級／收益。
重新載入會重算最高值，但不改走另一份菜單。可攜打單機的既有欄位白名單
不帶走座標綁定、菜單或這個衍生最高值。

這仍是Bedrock安全適配：不強制載入區塊、不移入Java200tick快取、不新增
POI或修改排程。本輪沒有原生性能測試；#11的衝突及性能問題仍未解。

## 驗證

- 相同26項新回歸對未修改main：6通過、20失敗；修後26項通過。
- 覆蓋圓形邊界／高度、3D距離、三軸完全平手、有效／空菜單綁定、實際移除、舊角落綁定、撤權、真正升級扣幣、訂單菜品來源、單牌最大值而非總和、候選與已提交報酬分離、僅營養變更存檔／回滾／重試、舊核心fallback、可攜排除及未綁高營養牌兩種暫不可讀行為。
- 舊持久化測試的reload後預期更新為保留原牌並另更新最高營養；不移除未載入、原子存檔、expiry、printer及progress回歸。
- `npm run verify`：637項Node、官方stable型別、367份JSON資源及配對建置全過；幾何23、固定輸入分段來源13、CI範圍8及合規／release-policy全過。舊release-history不變。
- 獨立唯讀審查無blocking finding，另跑53項選牌／持久化測試全過，核對固定Java來源、portable排除及兩種unload邊界。
- 本機Node24.22.1／Python3.12.14／Pillow13.0.0，遠端必要CI另驗固定環境。
- 未執行BDS、LIVE、真實Player／多人或客戶端；不能用本輪來源測試宣稱這些已驗收。
