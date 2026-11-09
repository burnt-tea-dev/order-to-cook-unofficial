# 冰箱共同 root：未發布來源修復

2026-11-08。基於主線 `11280a09d232a3dd7e7d1e6f5ae42e5a9e5c53d7`。
本報告保留 source-ready 階段：當時版本暫留 `0.1.46-alpha.1`，沒有 freeze baseline、改 UUID/API、推送、PR 或發布，因此不能匯出為 .46 套件。
其後獨立審查通過 `dcee546b7b918e3deb0163ec607f280cef2880d4`，另按正常流程凍結 [.47 候選身份](../0.1.47-alpha.1/FRIDGE_SHARED_ROOT.md)。下述舊 guard 結果屬來源準備階段，不是 .47 的 build 結果。

## 已核實的來源

- OTC 固定版本：[`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。
- `refrigerator.geo.json` Git blob：`30a92337a06df621d66c3156d1d81be537626a65`；root `bone` pivot `[0,0,0]`。
- `refrigerator.animation.json` Git blob：`a8c06567396965b28ef214d50760b6953f525387`。
  `up_close` 與 `down_close` 的 root 完全相同，只有 Z scale/position；至 .375s 中性，.5s 是 .95／.25 modelpx，.6667s 回中性。
  .5s incoming easing 是 `easeInBounce`、參數 .1。Open clips 沒有 root channel。
- [`RefrigeratorBlockEntity.registerControllers`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L323-L336)
  先註冊 upper，再 lower；blob `3a9cffa65bdd24f62057aae039138de5a86c8e36`。
- GeckoLib 4.8.3 固定 commit `e81962eefd04e0cab90445d3df37b477d2767ffd`：
  [`AnimatableManager`](https://github.com/bernie-g/geckolib/blob/e81962eefd04e0cab90445d3df37b477d2767ffd/core/src/main/java/software/bernie/geckolib/core/animation/AnimatableManager.java)
  blob `57dd4881d580a97de7d100e343ce717173061315`，registrar 以 `ObjectArrayList.addAll` 收集，再依序 `put` 到 `Object2ObjectArrayMap`，不是 HashMap 或排序過的 controller 列表。
  [`AnimationProcessor`](https://github.com/bernie-g/geckolib/blob/e81962eefd04e0cab90445d3df37b477d2767ffd/core/src/main/java/software/bernie/geckolib/core/animation/AnimationProcessor.java)
  blob `123a7c4341a928b7b68f4d54d383df5bec21a4c0`，依 `values()` 逐 controller 直接 `setPos*`／`setScale*`。
  後面的 lower 寫入覆蓋 upper，即使其值為中性；不能取最大變形、相乘、平均，或略過零變形。

以上來源只讀取核對，未執行 Java 或下載依賴。原始素材、貼圖、授權與 attribution 保留。
原冰箱 PNG SHA-256：`a545ea6a2c2ef3c25d48fd65051bf00e01382b01a97ef4f295b6d3b171e02039`，bytes 未變。

## 實作與精確生成差

`fridge_root_samples` 從來源取 0.1s 樣本，完整浮點精度保留至幾何序列化：

| root_frame | 來源時間 | scale Z | position Z (modelpx) |
|---|---:|---:|---:|
| 0 | 中性 | 1 | 0 |
| 1 | .4s | .984875 | .075625 |
| 2 | .5s | .95 | .25 |
| 3 | .6s | .97999400119976 | .10002999400119975 |

Close frame→root 對應為 `[0,0,0,0,1,2,3,0,0,0,0]`，由生成資料接入 runtime。
每半自己的 open/close/frame 與四個 root 完整組合；原 neutral identifier 保留，新增 `_root_1..3`。

- 模型 44 → 176（+132）；未壓縮 geometry bytes 503,500 → 2,170,126（+1,666,626）。
- Geometry conditions 合計 66 → 264；lower/legacy definition 44 → 176，upper definition 22 → 88。
- 含四方向的完整 BP permutations 合計 74 → 272（各 180／92）。
- 含 half/open/closing/frame/root/facing 的兩個 definition 合計狀態 528 → 2,112。
- `refrigerator.json` 17,093 → 68,497 bytes；`refrigerator_upper.json` 10,702 → 38,235 bytes。
- 兩個 block 的預設 components 及四個 facing permutations 與基準完全相同：沒有加入 `minecraft:transformation.scale` 或 translation，collision/selection、容器容量、材質與 loot 不變。
- 22 個 root-neutral opening 模型 bytes 保留；close 中性模型不再自行附帶本門 root。所有新增模型都有原 geo／animation provenance 條目。

`tickFridge` 先算兩半門姿態，再呼叫純函式 `fridgeRootFrame(upper, lower)`，最後分別寫入共同 root。
每半的 closing/frame/root 在同一 permutation 寫入。原 watcher、聲音、20 tick 進度、反向播放、物品與烹飪流程沒有更改。
`native_fridge.js` 未修改；新增 state 不建立、搬移、複製或清空庫存。

## 數值驗證

完整資料：[measurements.json](measurements.json)。測試的是 source affine → cuboid fit → bounded shipped mesh 的三層差異，不是互相比較兩份轉換器輸出便宣稱相同。

- 176 姿態 × 4 facings，每個 facing 8,448 個角點；獨立 forward S/R/T oracle 使用已核 root 數值。
- affine → cuboid fit 最大距離 **0.20155644370746567 modelpx**：upper open frame 5、root 2。完全打開 upper frame 10 同樣約 .201556px。舊 .086177px 上限不適用這個完整交叉集合。
- fit → bounded mesh 的門片平移最大 **0.08611500000000305 modelpx**，不是 shear 殘差。
- affine → 最終 bounded mesh 最大仍為 **0.20155644370746567 modelpx**；本集合的兩類最大值不在同一姿態，沒有把兩者錯加成新的實測數字。
- 只有四個姿態需要邊界平移，保持原 .126px 防護上限；完整清單在 JSON。
- 共享 root 下兩半櫃體 Y=16 seam 的角點差 **0**；所有 own-frame 組合不改 seam。
- 直接比較 split-source 與最終模型逐 cube UV：**0** 改動。既有獨立 signed-cavity corner/UV 四方向測試也通過，保留負尺寸內壁對應。
- 全部正式 block meshes 的四方向 double／Float32 bounds 測試通過，未用 `minecraft:transformation` 的 rotation-only reviewer 去假驗縮放。

## 測試與重產

- `node --test tests/appliance-motion.test.js`：18/18；初版新增7項，獨立審查補修再新增2項。
- `python -m unittest discover -s tests -p test_fridge_shared_root.py`：3/3，涵蓋176姿態／2,112實際 BP dispatch、來源 pins／映射與拒絕來源不一致。
- `python -m unittest discover -s tests -p test_appliance_geometry.py`：33/33。
- dining assets 4/4、guide languages 3/3、CI scope 9/9。
- 原 `asset-motion.test.js` 的舊126模型篩選已擴至258（176冰箱＋82洗碗機），最後追加聚焦重跑7/7；完整四方向／Float32 checks 仍掃描全部正式 block meshes。
- 最終程式以 `node --test --test-concurrency=1 tests/*.test.js` 完整串行驗證：937/937；`npm run check` 通過（519 JSON、450 geometries、578 permutations、0 errors）。原樣 `npm run verify` 曾整套測試935/935及check通過，但最終並行重跑有下述程序失敗；沒有將串行命令冒稱原樣verify全綠。`npm run build` 必須且確實停在 `BP payload changed; freeze a fresh paired release identity before exporting`。沒有繞過 .46 hash guard，也沒有產出可發布的新包。
- 較早並行完整執行曾在 `delivery-config.test.js` 檔案程序失敗，另一輪為 `carried-order-alerts.test.js` 與 `delivery-config.test.js`，均無具體 assertion 訊息；單檔重跑13/13、兩檔串行39/39，補修後最終全部串行937/937。未將那些失敗隱藏為通過，也未對原因作未證實的歸因。
- 初版三個 runtime mutation 在隔離複本執行：反轉 controller 順序，13 pass／3 fail；忽略 neutral lower，13／3；漏掉 root 寫入，10／6。皆由正式 service 回歸抓住，不只是測未使用 helper。
- 從最後 converter 乾淨重產：本次176 meshes、兩個 BP definitions、pose data 與 conversion manifest 逐 byte 相同。完整 generator 另會重排三語 `.lang` 中既有附加鍵的位置；已用未修改的基準 generator 複現同樣差異。本修復保留那三份語言檔原 bytes，不混入無關排序變更。
- 兩個現有 CI 工作均加入新 `test_fridge_shared_root.py`；沒有安裝額外套件，使用已有依賴。

## 獨立審查補修：上半讀取丟例外

初版 `e544f563062bf92e58afaa057a9ee52fd7ccbdc8` 只測了上半 `getBlock` 回傳 undefined；獨立審查以真實丟例外分支發現，外層 `nativeFridge.ensure` 會先中止整站本 tick，讓仍可讀取的 lower 留著 upper 的舊 root2，並漏清 upper viewer/motion cache。原「不可讀上半不影響 remaining lower root 重算」聲明在此分支不成立。

補修僅在 `appliances.js` 將 storage ensure 的 catch/log 與 cosmetic `tickFridge` 隔開。仍保留原警告及外層錯誤處理，不修改 `native_fridge.js`、庫存遷移檢查、getStorage、已滿目的槽保護或遷移完成條件。可讀 lower 繼續重算，`fridgeBlock` 的既有讀取防護把上半視為不可讀，清其 viewers/motion。

- 獨立審查三個正式service repro：修前2/3，修後3/3。upper close frame5/root2 → upper讀取例外 → lower root0 → 恢復一tick後兩半root3。
- 新增正式service回歸另外保持upper viewer開啟與open frame10 cache，於不可讀期間把persisted姿態改為close frame4；恢復後必須關閉失效viewer並讀到frame5/root2，不能重用舊cache。
- occupied destination的既有migration拒絕測試補驗service tick：cosmetic繼續更新，但storageId、nativeFridge旗標、helper、容器identity與兩邊cargo均保留，不把ensure失敗當成功。
- 補修後正式appliance-motion與native-fridge聚焦測試31/31，全suite串行937/937；check零錯、Python cross-product 3/3，build仍由.46 payload guard攔住。隔離複本還原舊ensure-before-cosmetic接線的mutation為28 pass／3 fail，正好抓住兩個新增不可讀回歸與occupied migration下的cosmetic進度。
- RP geometry/texture、兩個block definitions、converter及生成manifest與初版逐byte相同；原數值量測繼續適用。沒有新增GUI／原生驗收聲明。

## 必須保留的限制

- 本輪沒有操作 GUI、Minecraft、Java 或 BDS client，沒有修後原生／材質／時序驗收。
- 有限每2 tick取樣，不是 Java 每幀 renderer。沿用中途反向播放當前片段與端點切換；Java 的 `forceAnimationReset`、STOP 與 bone reset、reopen 起點並未完全模擬。
- 兩個 block 的 permutation 寫入**非原子**。其中一半失敗，另一半可能已更新；下一個成功載入 tick 比對實際 state 後收斂，包括 idle endpoint。沒有宣稱零瞬間接縫。
- 上半缺失／不可讀時不沿用其 cache root，剩餘 lower 重算；下方 station anchor 缺失／不可讀時整個站點暫停並清 viewer／motion cache，不能保證當下更新獨存 upper。重載從 persisted door frame/closing 重算 root，不信任舊 root state。第一個零 elapsed tick 若保留 lower close frame0／frame10，其活動中性值仍覆寫 upper；之後原進度函式會在終點清掉 closing。
- 原生庫存視窗即時撤權、最多8件內部食品陳列、真實多玩家及透明材質時序仍維持既有未驗收／未實作界線。
- .47 凍結與 clean package 驗證另見[版本報告](../0.1.47-alpha.1/FRIDGE_SHARED_ROOT.md)。本來源報告不代表已發布、已移動主線或原生驗收。
