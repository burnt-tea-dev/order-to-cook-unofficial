# 普通機器顧客的首張合格椅子

2026-11-08。基底main `e1c1b6406a79d8b41b437e4c46fb4a4c4fe95e1d`。
配對身份0.1.35-alpha.1，UUID與stable API 2.11.0／UI2.0.0不變，仍需
Upcoming Creator Features；release-history只追加新身份。

## 固定來源與小批範圍

[NormalOrderNpcManager L14–16](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/NormalOrderNpcManager.java#L14-L16)
呼叫[findSpawnPosNormal L1528–1566](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java#L1528-L1566)。
原碼依dx升序、dz升序、y降序掃描水平24圓形、Y±8中的椅子，第一個通過
head／dry／occupancy的候選即返回。它不是到店顧客的隨機空椅池。

Bedrock原本對普通單按3D距離排序，會選較近但在Java掃描順序較後的椅子。
本批只把已註冊候選的metadata排序改為x升序、z升序、y降序。維度／類型／
範圍過濾、載入檢查、實際方塊確認、chairClaims、佔用與兩格頭部空間保護
均保留；首張合格仍立即return。到店顧客的全部空椅驗證與隨機池不變。

## 回歸證據

新增32項，執行真正entity service與既有Minecraft IO doubles：

- x、z、y各層優先及x高於z、z高於y，包含上下Y邊界。
- 三張椅子的六種註冊順序、三個RNG輸入、機器平移至負座標。
- 佔用、兩格頭部受阻、移除、整椅未載入、不同維度、水平圓外、Y範圍外、
  類型不符，均跳過前面的候選；另測讀取兩格頭部時才卸載。
- 首合格之後不再讀後方候選的方塊；重入spawn尚無可查詢顧客時尊重claim。
- packed普通單照常選椅，offered非到店單仍不生成；spawn拒絕後釋放claim，
  下次重試仍選正確椅且只建立一名顧客／座位。
- 同樣32項在未改main的隔離來源：13通過、19失敗；修後32項全通過。
- `npm run verify`：719項Node、stable型別、367份JSON及配對建置通過。
  幾何23、固定外部輸入分段來源13、CI範圍8、合規及release-policy通過。
- 獨立審查核對固定Java、全量719及check；本機Node24.22.1／Python3.12.14／
  Pillow13.0.0，遠端CI另驗固定環境。

0.1.33原有三個ordinary控制案例的x=10／2／24剛好讓nearest及scan都選2；
本批只更新其名稱，沒有把它們算成新回歸。辨識證據來自上述32項。

## 尚未對齊與限制

只對齊已註冊、已載入且通過現有Bedrock座位檢查的椅子順序，不是Java
整個世界方塊掃描。未註冊椅子、世界Y裁切、fluid檢查、原生佔用幾何與
實體種類、heightmap隨機fallback都仍有差異或待原生核對。Java ChairBlock
沒有waterlogged屬性，缺少顯式dry判斷不等於已重現進水椅缺陷。

Java [head／dry與fallback L1618–1663](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java#L1618-L1663)
對半徑5的heightmap合格位置等機率抽選；fallback沒有相同佔用檢查，且
[spawnPreparedNpc L1222–1287](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java#L1222-L1287)
仍會依腳下是否椅子決定坐／站，不能稱fallback一定站立。本批保留Bedrock
原有安全適配，沒有取消佔用保護或改動站立尋位、pending、admission、保存。

仍是metadata排序O(k log k)，與原最近排序同階；排序不同可能改變首合格前
的世界讀取數，沒有原生性能改善證據。未執行BDS、LIVE、多人或客戶端驗收，
未建立tag／Release。POI #11仍為未整合路線，性能及衝突問題未在本批修復。
