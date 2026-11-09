# 視覺、模型、音效與粒子還原：0.1.6-alpha.1

本輪從 `main ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49` 開始，固定對照
[Java e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。
修正位於原 BP 程式、`tools/convert_assets.py` 和可編輯輸入；不是另一個覆蓋用補丁包。
保留原像素 PNG／OGG，不生成替代插畫。本輪不處理玩家骨骼。

**這是可重現的來源／資源修正候選，並非已完成真客戶端視聽驗收。**
離線比較圖和 BDS 探針的證據層級見 [本輪驗證](validation/0.1.6-alpha.1/VISUAL_RETEST.md)。

## 12 類方塊：方向、材質與掉落

Java 各水平 blockstate 的 north/east/south/west 為 0/90/180/270 度。
依 [Blockbench Bedrock exporter](https://github.com/JannisX11/blockbench/blob/master/js/formats/bedrock/bedrock.js)
的 X 座標反射，Bedrock 對應 0/−90/180/90 度；放置 trait 的 180 度偏移對應原作
`getHorizontalDirection().getOpposite()`。逐面材質沿用原來源 alias；原位圖不重畫。

| 方塊 | 核對與本輪處理 | 實際掉落／尚存差異 |
| --- | --- | --- |
| 打單機 order_machine | 改回完整 Geo 機身／原材質，18 個原升紙／縮放／晃動姿態、四向；修正石材聲音族與刷新聲／粒子 | 本體一個；**Java 帶走機器 ID／餐廳資料的 NBT 未移植**，現版拆機仍清理餐廳記錄。 |
| 菜單立牌 board | 原面板逐面 UV、四向、木材聲音族 | 本體一個；**Java 菜單隨掉落物保存的 NBT 未移植**，重放會建立初始菜單。 |
| 操作台 countertop | 原幾何、UV、四向、木材聲音族；成品冒煙位置修正 | 本體一個；台上帶身份成品由既有顯示記錄處理。 |
| 包裝架 shelf | 原 0–10 份包材外形、四向 | 本體＋尚存皮革；未改容量。 |
| 餐盤架 plate_shelf | 原 0–18 盤外形、高低位 state、四向 | 本體＋尚存乾淨盤；未改容量。 |
| 洗碗池 washingtable | 原 0–10 髒盤、四向；補入原 renderer 的靜態半透明水面，物品保留乾檯；水花／泡泡改為池內旋轉座標 | 本體＋尚存髒盤；原手洗操作仍為點擊開始。世界材質共用 blend，透明排序／背面尚待原生驗收，見[水面契約](validation/UNRELEASED-washingtable-water.md)。 |
| 椅子 chair | 原背板、腿、UV、四向；既有乘座 helper 保留 | 本體一個，既有騎乘清理。 |
| 洗碗機 dishwasher | 修負 X cuboid 的物理面／UV、非均勻變形、盤數可見性與預覽；見下節 | 本體＋機內盤子，clear_out／ready 為乾淨盤；未新增自動掉落。 |
| 冰箱 refrigerator | 修負 Z 內壁、上下門、獨立開關曲線；見下節 | 拆任一半只給一個冰箱＋原生庫存，頂半 loot 為空。 |
| 爐灶 stove | 原模型、四向、木材聲音族 | 本體＋七槽真實物品；爐火時序／點火音由 [PR #19](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/19) 處理，本 PR 不重疊該實作。 |
| 外送袋 takeout_bag | 改用完整 placed Geo 袋身及原材質、四向、布料聲音族；恢復 0.5 秒放置動作 | 原生 loot 為空；script 返還含訂單 proof 的同一份成品。有限姿態播放，不另建庫存。 |
| 餐盤 food_plate_display | 全 41 個 state；stage 0 改回原放盤模型，四向／UV | 原生 loot 為空；成品／用餐餐盤由各自既有權威記錄返還，避免重複發盤。 |

上表的兩項 NBT 掉落缺口是本輪查出的**未修正差異**，不是視覺已通過或正常等價的聲明。
它們涉及移動餐廳身份、訂單與進度的玩法契約，不能只把資料塞進普通掉落物就聲稱完成。
各方塊四方向的實際引擎排列、透明面與破壞後拾取，仍須按驗收清單觀察。

## 打單機與外送袋

固定 Java 的打單機和外送袋 blockstate 都使用空模型，完整外形由 Geo renderer 繪製。
舊版 Bedrock 用另一套靜態模型；本輪改用真正的 `order_machine.geo.json`／
`order_machine_geo.png` 和 `takeout_bag_placed.geo.json`／`takeout_bag_placed.png`，
不是在舊機身或袋身上重複疊放動畫覆層。

打單機有 idle 一個、printing 十六個和 waiting 一個姿態。普通候選訂單刷新時啟動原
`neworder`：一秒升紙、機身 0.95→1.05→0.95→1 縮放及初段晃動，然後保持到 Java
45 tick 的 PRINTING 狀態結束。接走普通機器訂單時立即藏紙，獨立到店單不會冒出一張紙。
重載已有候選單保持末端，不從頭重印。升級與到店提示音也不會觸發列印。

外送袋以 `maked` 的 0.5 秒原縮放、位移與晃動生成十一個姿態；frame 0 是完成姿態，
既有袋子不會重新彈動。只有成功擺放的新成品進入有限播放。方塊原生 tick 推進動畫，
成品 proof、領取與拆除仍沿用同一份權威記錄，沒有新增虛擬物品或庫存。

來源：固定 Java 的 `OrderMachineRenderer.java`、`OrderMachineBlockEntity.java`、
`OrderMachineBlock.java`、`TakeoutBagPlacedRenderer.java` 及對應 `*.animation.json`。

2026-11-09 補充：[六個放置／姿態比較](validation/visual-audio/placement-poses-20261109/README.md)
核對打單機兩個實際 NORTH 有限幀、外送袋正負晃動及 stage 0 餐盤。
數值與編輯器證據分開記錄；不取代原生時序、材質與互動驗收。

## 冰箱

### 修正

原模型內壁包含負 Z 尺寸。舊轉換器只移動原點並取尺寸絕對值，卻沒有交換物理表面和 UV，
使原本透明的前開口換成不透明背板。現在按負軸交換相對面並修正 UV 端點方向；
來源原點、角點和每個角的 UV 有獨立對照。原 96×96 貼圖 bytes 不變。

櫃體仍在 Y=16 分為兩格，原下門最高 Y=19.5，整扇門不再被櫃體切線裁斷。
上下門各有 **11 個 open＋11 個 close** 門姿態，與四個共同 root 組合共 176 個模型；使用來源的 `easeInElastic`、
`easeInBounce` 和 `easingArgs`，不是把關門當成線性開門的逆放。完整一程仍為 20 tick。
關門原有的 Z 壓縮到 0.95 及 0.25 像素位移以 `root_frame` 同步作用到兩半，包括另一扇完全打開的門。下門 close 活動時覆寫上門 root，即使下門的當前樣本是中性。

觀看者計數仍逐層分開。完整開／關使用各自原片段；**中途改目標沿當前片段反向**，
不把當前角度瞬間跳到另一曲線的端點。`closing` state 表示正在使用 close 片段，
不是「當前目標為關門」。重載由保存的 frame／closing 恢復後收回，不改庫存。

原作四個聲音音高為上門開 2.0、下門開 1.7、上門關 1.1、下門關 0.9，音量皆 0.35；
已取代原本統一的 1.5。聲源使用原下半方塊中心。

### 仍有差異

方塊是有限姿態，不是 GeckoLib 每幀骨骼 renderer。門片某些中間角度需至多 0.126 像素
整片平移，以留在 Bedrock 幾何範圍；原尺寸、UV 和端點不變。非均勻父縮放加子旋轉會產生
剪切，靜態 cuboid 只能近似。與來源完整 affine 變換的最大頂點差，冰箱為
本次完整 own-frame × root 量測為 0.201556444 像素（舊 0.086177 上限不再適用）、洗碗機既有量測為 0.259642 像素；這是數學量測，不是遊戲畫面驗收。

兩半現在共用根樣本；完整 176 姿態的邊界平移最大為 0.086115 像素，與 affine→cuboid 殘差分開量測，櫃體接縫差為零。兩個方塊寫入仍非原子，失敗後下一次成功 tick 才收斂；下方 anchor 不可讀時整個站點暫停。原食品陳列尚未加入，Java 的 STOP/reset 及 reopen 起點也非完全等價。見[共同 root 修復驗證](validation/fridge-shared-root/README.md)，不能以模型數量代替原生驗收。

來源：[RefrigeratorBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java)
及同提交 `refrigerator.geo.json`、`refrigerator.animation.json`。

2026-11-09 補充：[食品陳列來源／API 契約](validation/visual-audio/FRIDGE_ITEM_DISPLAY_CONTRACT_20261109.md)
釐清每半部前八個非空疊、關門期間可見及共同 root。Bedrock 有原生 held-item／attachable
能力，但自訂 holder 的通用呈現、普通取出／掉落與生命週期仍未驗證；本次沒有新增實作。

## 洗碗機

原六個 gameplay phase 保持不變，新增的 **phase 6 僅供方塊外觀**，從不寫入
`station.appliance.phase`。完整資源有 **82 個姿態**：原 66 個加 `empty_out` 預覽 16 個。
原 dirty／clean plate 的縮放、抽屜、門及機身的 per-axis squash/stretch 都進入來源轉換；
不再整段略去非均勻縮放。轉換器以完整父子 affine 變換擬合可合法輸出的 cuboid，保留 UV。

Java renderer 的盤數規則已接回：一盤只顯示原 cube #2，兩盤顯示 #2／#5，三盤以上六片皆可見；
髒盤只在 dirty_in，乾淨盤只在 clear_out／ready。所有姿態都保留所引用的子骨骼，未使用者為空，
base geometry 和 permutation 都帶 `bone_visibility`。既有 count=16 高低位不變。

玩家主手或副手持髒盤、準星命中 6 格內可使用的閒置洗碗機時，按原 `empty_out` 1.1667 秒
預覽；移開、換物品、撤權、離線、開始洗滌或區塊不可用時撤銷。預覽不扣盤、不建立庫存、
不保存一份虛擬批次。音效只對新進入預覽的玩家播放一次。

**多人適配：**Java 預覽是個別客戶端的本地外觀，Bedrock 方塊 state 對附近玩家共享；
本版只要仍有合格玩家看向它，就保持共同預覽。未宣稱已還原每位玩家各自看到不同門姿態。

時間、盤數和保存沿用現行 nominal phase 時長：14／30／40 或 80／24 tick。
音效／粒子用「跨過指定時間點」觸發，避免 2 tick 服務更新漏過第 14 tick，超過八盤時在
洗滌第 40 tick 再播一次原洗滌聲。Java 在 timer 歸零後下一 tick 切 phase 的差異仍存在，
本輪沒有重定義烹調／批次時長。

來源：[DishwasherBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/DishwasherBlockEntity.java)、
同提交 `DishwasherRenderer.java`、`OrderToCookModClient.java` 的 `findDishwasherPreviewTarget`。

## 餐盤 41 階段

stage 0 從舊的乾淨盤替代品改回原 `food_plate_placed.geo.json` 的九個 cube、
`food_plate_placed.png` 及 0.5 秒 `maked` 動作。原像素機械合併進 atlas，不重新畫菜。
用餐實體的 `placement_age` 追上餐點已有時間；晚載入不重播一個不存在的空盤階段。
靜態 `food_plate_display_0` 使用原放盤末端模型，真正短暫動作由用餐 entity 播放。

| 交餐後名義時間 | 實體 stage | 結果 |
| --- | --- | --- |
| 0–0.75 秒 | 0 | 原放盤動作，0.5 秒後保持末端。 |
| 0.75–3 秒 | 4×v＋1 | v=0…9 的完整食品階段。 |
| 3–4 秒 | 4×v＋2 | 原第二階段食品。 |
| 4–5 秒 | 4×v＋3 | 原第三階段食品。 |
| 5 秒起 | 4×v＋4 | 髒盤留在原位置，等待領取。 |

40 個食品階段的 284 個 cube 及 1,476 個貼圖面逐一對照來源；未改進食形狀、食物位置或髒盤時機。
提前收盤依原流程觸發 action 7，原領盤權威、token 和防重複領取保留。
餐盤仍以真實毫秒推進；低 TPS／世界暫停與 Java tick 不逐位等同。

來源：[FoodPlateBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java)、
同提交 `FoodPlatePlacedRenderer.java` 和共用 `food_plate_display.json`。

2026-11-09 補充的[餐盤 settled／rebound 比較](validation/visual-audio/placement-poses-20261109/README.md)
保留九個 cube、原 PNG→atlas 像素與刻意 +0.2 model-pixel 高度。此偏移是既有防穿插設計，
不是本次新增缺陷；anchor-local 比較不證明原生 actor yaw、接地觀感或切換時沒有跳動。

## 顧客兩套外觀、等待與七種動作

原兩張皮膚逐 byte 保留；修正明確指定 `customerVariant=0` 時錯誤地重新雜湊的行為。
補回原八格看向玩家和隨機環顧的目標行為。原作顧客 movement=0、直接安排站位／座位，
本輪沒有新增原作沒有的入店路線。

等待／坐姿各四段，以原 55／15／15／15 權重選擇。控制器在片段開始固定該次變體，
播完才選下一段，避免服務端變體更新在片段中途換動作。

| action | 原片段 | 時長 |
| --- | --- | --- |
| 1 | sit_spawn | 動畫 0.5833 秒；服務狀態 12 tick。 |
| 2 | stand_spawn | 動畫 0.5833 秒；服務狀態 12 tick。 |
| 3 | sit_take | 2 秒 |
| 4 | stand_take | 3 秒 |
| 5 | npc_eat&boom | 6 秒 |
| 6 | npc_eat&scale | 5.5 秒 |
| 7 | interrupted | 0.5 秒 |

七種動作的原骨骼關鍵幀、pre/post 和 catmullrom 不改；新增 `action_elapsed` 同步權威已過時間，
客戶端重載追上當前片段，末端保持至服務端移除，避免縮小消失後又跳回原大小。
提前收盤切 action 7 會重置該動作時鐘。服務端五 tick 更新／網路插值仍需客戶端確認。
特殊彩蛋人物、網路皮膚和女僕替換仍未移植。

來源：[CustomerEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/entity/CustomerEntity.java)
及同提交 `CustomerEntityModel.java`、`npc.animation.json`、`npc.transition.animation.json`。

## 音效與粒子

事件接線、音量／音高、數量、顏色、旋轉座標及時點在 `runtime/BP/scripts/audiovisual.js`
集中描述，正式設備／餐盤／顧客服務執行這些描述；不是只檢查 OGG 檔案是否存在。
詳細逐項對照見 [音效與粒子事件審核](validation/visual-audio/SOUND_PARTICLE_AUDIT.md)。原音檔 bytes 不變。

粒子改為本包明確數量的短發射器，引用遊戲自帶 particle atlas，不打包 Minecraft 原貼圖。
這避免把需要原生 emitter 資料的 manual-rate vanilla particle 當作「呼叫一次就有一粒」。
Script API 只決定播放事件；**未聲稱不同引擎的粒子積分、光照、隨機序列與透明混合完全一致**。

| 事件 | 還原的來源數值 |
| --- | --- |
| 手洗 | 第 0.5／1／2／3 秒，各 10–15 個 bubble pop＋2 個 splash；在原水盆區域抽樣後依四向旋轉，Y≈0.94。第 0／4 秒不再誤播。 |
| 洗碗機取盤收回 | 7 個白色 end-rod 外觀粒子。 |
| 洗碗機放髒盤 | phase 第 14 tick，原盤聲＋10 個白色粒子。 |
| 洗滌 | 開始／第二輪 12 個，其餘每 10 tick 4 個白色粒子；原中心 Y＋0.85、spread 0.28/0.22/0.28。 |
| 乾淨盤推出 | 朝向門口偏移 0.56、Y＋0.62；cloud 18＋poof 8＋白色粒子 12。 |
| 操作台成品 | 成品位置 Y＋0.35、cloud 6。 |
| 顧客完成、傳送與爆炸 | 改回原完成／傳送／爆炸事件的數量與時點，不用一次任意的通用粒子代替整個 burst。 |

## 可編輯來源與重產

`assets/guidebook/` 保存 main 已有的三語指南文字與 16×16 像素書圖示，修復重產時遺失文字、
回退成訂單紙圖示的問題。這些是現有移植素材，不偽記為 Java 原素材。

```sh
npm ci --ignore-scripts
python tools/convert_assets.py
npm run verify
python -m unittest discover -s tests -p 'test_*.py'
python tools/check_compliance.py
python tests/check_release_policy.py
```

生成物來自轉換器；日後應改固定來源旁的轉換規則，不在數十個 `.geo.json` 手工重複修補。
候選保留 BP／RP UUID，版本為 `[0,1,6]`；完整建置與本輪實測指紋以驗證記錄為準。

## Later stove ignition repair

Version .46 restores the registered Java stove renderer’s sampled ignition poses rather than only its texture phases. [Source/service and version scope](validation/0.1.46-alpha.1/STOVE_IGNITION.md) and [actual cloud editor comparisons](validation/visual-audio/blockbench-20261108/remaining-static/README.md) retain the 10Hz publication, continuous animation, packet/reset and native-rendering limitations. Other unreviewed assets and real clients remain open.

## Later customer static-pose review

[Seven frozen customer scenes and eight original editor photographs](validation/visual-audio/customer-static-20261109/README.md) add independently inspected wrist, eating, shrink, boom, spawn-rebound, standing-take and synthetic idle3 body-turn samples. This is source/RP data in the same Blockbench cube renderer, not native Java/Bedrock acceptance. The original preparation and earlier GUI receipts remain unchanged; three renderer diagnostics are separate. No runtime change is proposed, and the known mathematical 1 ms pre/post edge is not a demonstrated native defect.

### Additional customer frozen poses (2026-11-09)

[Seven additional customer scenes and nine original model photographs](validation/visual-audio/customer-remaining-20261109/README.md)
now have separate capture and independent pixel-review records, plus one Render
Sides Auto diagnostic. The source/RP pair uses the same Blockbench renderer;
scene05's shared sleeve stippling is retained with a reproducible coplanar-overlap
diagnostic, not treated as a verified port-only bug. Historical preparation
receipts remain unchanged. Portable identity/static checks reconstruct all seven
scenes byte-for-byte using authenticated prior-bundle dependencies. No runtime,
version, native rendering, playback, transition, query-convention, material,
sound or particle acceptance is added.

### Later helmet inactive-pivot diagnostic (2026-11-09)

A separate [helmet A → B → A control](validation/visual-audio/blockbench-20261108/helmet-pivot-control/README.md) records reversible visor-preview behavior after changing only fifteen inactive SOURCE shell cube origins. Independent inspection covers all three original photographs, exact scene differences, unchanged runtime/source inputs and 320 matching corners. This is a common-editor preview diagnostic, not a runtime repair, proof of an internal sorting algorithm or native/worn-head transparency acceptance. The earlier static-review result is retained unchanged.

## 小電驢靜態來源映射補驗（2026-11-09）

[9 張原始 Blockbench 圖與可重現 fixture](validation/visual-audio/motorcycle-source-mapping-20261109/README.md)
確認舊版前柱的 V 形折位；候選修正 7 根靜態骨骼的 X 旋轉符號與 41 個 box UV 鏡像。
白色前後斜視／頂視、最小辨識控制及紅藍黃候選色均保留原圖。這是中立姿態的模型與
貼圖配置驗證，不代表轉向、輪速、發光、透明／背面或原生遊戲已通過；既有動態差距仍保留。

## 顧客 standing idle2／seated idle3：四個靜態姿態

[新增公開證據包](validation/visual-audio/customer-missing-idles-20261109/README.md)
補上 `customer_wait_2` 與 `customer_sit_3` 的 wide／slim 組合，包含八張原始模型照片
及一張 Auto 設定診斷，均已逐張獨立檢視。可見面未發現新的 port-only 大面積缺紋理
或破面；遮擋面仍未驗收。來源與 RP 共用 Blockbench CubeRenderer；query 和時間是
synthetic frozen inputs，不是原生追蹤或播放測試。既有 historical pending 記錄保留。
17 個輸入對 main `dbb2574` 有 commit/tree membership；16 個不變，converter 僅有
機車函式的 context 差異且未執行。公開只讀重現會檢查 1,280 corners、960 face-UV
及場景逐 byte 重建。沒有 runtime／版本變更，也不代表原生引擎、音效、粒子、
連續動畫、控制器或透明排序已通過。
