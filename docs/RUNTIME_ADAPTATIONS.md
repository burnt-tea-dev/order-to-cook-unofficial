# 顧客、載具與廚房設備：基岩版實作及差異

本文件對應 **0.1.7-alpha.1（整合來源）** 的 `entities.js`、`dining.js`、`appliances.js`、`appliance_motion.js`、`native_fridge.js` 與 `stove_controls.js`。這是基岩版改編；Java 的介面、實體物理和 GeckoLib 方塊動畫不能原樣載入。**型別檢查、模擬測試及原生服務端探針均不能代替真實 Player 的容器操作、客戶端畫面與觸控驗收。**

本文件涵蓋 alpha.3 玩法基線與 **視覺／音效修復**的 `runtime/BP/scripts/`。本輪修正及實際驗證範圍見 [VISUAL_AUDIO_PARITY.md](VISUAL_AUDIO_PARITY.md)。Java 的介面、實體物理和 GeckoLib 方塊動畫需要基岩適配；**型別檢查、模擬測試、離線渲染及原生服務端探針，均不能代替 Blockbench 互動檢視、Minecraft 客戶端畫面、表單及觸控驗收。** 本候選尚未執行這些客戶端視覺驗收，歷史記錄不改寫為通過。

上游基準為 [breezeth-CN/OrdertoCook，提交 e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。下列 Java 規則以 `forge-1.20.1/src/main/java/cn/breezeth/ordertocook/` 為依據，共用模型與動畫位於 `common/src/main/resources/assets/ordertocook/`。

## 版本與 API

目標最低版本為 **Minecraft Bedrock 26.60（manifest：1.26.60）**；固定使用 stable `@minecraft/server 2.11.0` 與 `@minecraft/server-ui 2.0.0`。冰箱的 `minecraft:block_entity.container` **需要 Upcoming Creator Features**，不需要 Beta APIs 或 POI 實驗。原生容器在 [26.50 創作者更新](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.50?view=minecraft-bedrock-stable)加入；[26.60 更新紀錄](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog)列明 server 2.11.0 與容器標題能力。完整 API／schema 版本核對與限制見 [NATIVE-CONTAINERS.md](NATIVE-CONTAINERS.md)。原 0.1.2 的 1.21.100／無實驗設定只屬歷史要求，不適用本輪。

方塊及物品自訂元件由 `main.js` 在 `system.beforeEvents.startup` 註冊；世界存檔讀取及服務建立在 `world.afterEvents.worldLoad` 執行。服務的 `init()` 接著啟動更新，不再等待另一個 `worldLoad`；設備每 2 tick 更新，顧客與餐盤每 5 tick 更新。這遵循 [Script V2 的 early execution 限制](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/v2-overview?view=minecraft-bedrock-stable)。

冰箱直接使用原生方塊容器視窗，鍵鼠、控制器、觸控交由 Bedrock 庫存操作處理；爐灶與操作台以直接互動及單頁 [ActionFormData](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/actionformdata?view=minecraft-bedrock-stable) 縮短操作。表單使用現有 stable UI 2.0 即可，不需要測試版表單 API。各裝置實際操作仍待驗收，不能宣稱相同於 Java 拖曳、快捷移動及專用槽位佈局。本模組沒有覆寫 `player.json`。

## 冰箱

| 項目 | 本版行為 |
| --- | --- |
| 放置 | 下半保留 `ordertocook:refrigerator`，上半改為隱藏的 `ordertocook:refrigerator_upper`；上半沒有獨立方塊掉落。原 ID 保留舊 `half=upper` 狀態供升級辨識。 |
| 儲存 | **上層 27 格、下層 54 格**直接保存在各方塊的原生 inventory，共 81 格。點哪一半就開哪一半的原生視窗，沒有儲物翻頁選單。 |
| 可存物品 | 遵守原生容器規則；26.60 schema 不提供食品限定槽，其他物品也可存入。操作台仍僅按訂單所需的有效食品及變體取料。 |
| 存取 | 引擎處理格子移物；腳本在 before-event 檢查入口、權限與遷移完成狀態。該取消是否可靠阻止 26.60 原生 GUI，仍需真 Player 驗收；已開容器無可用強制關閉 API。 |
| 開門 | stable `blockContainerOpened`／`blockContainerClosed` 驅動各分區觀看者；每扇門開／關各 11 姿態，正常 20 TPS 下約 1 秒完成，途中可反轉。移除無效觀看者只管理動畫，不代表強制關閉原生視窗。 |
| 拆除 | 破壞任一半會清理另一半，只掉一個冰箱物品；原生容器內容交由引擎掉落，腳本不能再複製一份貨物。舊 helper 的清理另依遷移狀態處理。 |

原版源碼 `block/entity/RefrigeratorBlockEntity.java` 額外允許每疊 128 件。**本版遵守各 Bedrock 物品自己的最大堆疊數**，一般食品通常為 64；因此相同格數不代表相同的總件數。

模型只把櫃體在 Y=16 分格，整扇下門保留在下半模型並跨至 Y=19.5。上下門分別取樣原 open／close 片段，保留 −135°／−125° 開門終點、GeckoLib Elastic／Bounce 曲線及關門機身縮放。`closing` 表示目前使用哪個片段，不是目標方向；中途反轉倒播當前片段，避免切到另一條曲線時跳角度。從端點開始才換用對應的原開／關片段。負尺寸內壁的面與 UV 已一起正規化。少數姿態平移完整門片不足 0.126 像素以符合幾何邊界；尺寸、UV 及端點不變。詳見 [素材轉換說明](ASSET_PROVENANCE.md#冰箱)。

仍缺原 Java 上／下層各最多 8 件庫存食品的內部陳列。Java 關門縮放作用於整座櫃體，本版兩個方塊只跟隨各自分區的關門片段，尚未同步另一半櫃體；有限姿態及靜態立方體的剩餘剪切近似也不等於逐幀 renderer。

門 frame 保存在方塊狀態，重啟後從該姿態收回；觀看者不跨重啟保留。玩家離線、離開、失去權限或區塊卸載會清理動畫觀看者。**這不是原生 GUI 撤權**：26.60 沒有公開的 native container close API，不能把移除觀看者當作已阻止取物。權限變更須考慮已開容器仍可操作的限制；其他腳本取料／表單操作會重新核對權限。入口取消及原生多人畫面列為待驗收。

新冰箱直接使用兩個方塊 inventory；81 格介面只是按「上層 0–26、下層 27–80」映射原生槽位，沒有另一份虛擬庫存。舊世界的不可見 `ordertocook:storage` helper 使用 [Container.moveItem](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container?view=minecraft-bedrock-stable) 逐槽移入；不以 ID＋數量重造物品，訂單 proof、動態屬性、名稱、lore、耐久等 native ItemStack 資料隨物品移動。遷移中途失敗可從來源剩餘槽繼續；目的槽有物品時停止，不能覆寫。

舊 helper 尚未載入時保留其 ID 並等待，期間不允許開櫃或操作台取料，不建立替代空櫃。沒有 Upcoming Creator Features、下半缺少原生 inventory 時，在替換舊上半 ID 之前停止，保留舊方塊及 helper。搬完並保存遷移標記後才移除空 helper。僅看向設備的 HUD 不會啟動遷移。

原生方塊容器 schema、容量與持久化行為見 [官方 block_entity 文件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_block_entity?view=minecraft-bedrock-stable)。它不能放進 permutations，因此使用兩個 ID，而不是在同一 ID 的上下狀態切換容量。方塊狀態變更保留 inventory，換成不同方塊 ID 則會掉出貨物；詳細版本依據及無法 1:1 的項目見 [NATIVE-CONTAINERS.md](NATIVE-CONTAINERS.md)。原生庫存與 world dynamic properties 不是同一筆原子交易，不能宣稱任意強制中止都零損失。

## 三槽爐灶

依固定提交的 [StoveBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/StoveBlockEntity.java)，
保留 7 格：輸入 0／1／2、共用燃料 3、對應成品 4／5／6。
**三路共用 200 tick 批次進度，正常 20 TPS 下為 10 秒**；來源煙燻配方的
`cookingtime` 不改變這個數值，原作的 `getTotalCookTime` 並未被呼叫。

| 情境 | 執行規則 |
| --- | --- |
| 正常出菜 | 每條可加工路線各消耗原料 1 個，產量按配方 `count`，只寫入該路對應成品格。 |
| 部分成品格滿／物品不相容 | 只堵塞該路；其他路照常推進共用進度。容量不足整份產量時不扣原料。 |
| 全部堵塞 | 已燃燃料繼續消耗，進度停住；不消耗下一份燃料。 |
| 燃料用盡 | 每 tick 先扣剩餘燃料，再決定能否出菜；無下一份燃料時進度每 tick 回退 2。 |
| 無效原料 | 與 Java 一樣可以放入，但留在原格，不加工、不產生物品，也不觸發新燃料。 |
| 換料／取空 | 成功改變輸入種類或 metadata、取空輸入時重置共用進度。同身份補量、取成品、取消或滿背包失敗不重置。內部烹調扣料亦不當作換料。 |
| 關閉表單 | 不會暫停烹調；要停止某路須取走原料。已點燃燃料仍會燒完。 |
| 卸載／重啟 | 庫存沿用原生 helper；保存已處理的剩餘 tick，不補算離線時間。卸載使舊表單 session 失效，重載不讓它重新取得權限。 |

原版九條煙燻配方保留，另以原生 `ItemTypes.get` 逐筆確認煙火兩條實際配方的輸入及輸出
存在後，接入烤雞翅、烤番薯。完整 ID、原始 JSON、供應商契約及排除製程見
[STOVE-RECIPES.md](STOVE-RECIPES.md)。`main.js` 將唯一的 live registry 交給
`ctx.smokingRecipes`，服務不再 spread 成初始化快照；供應商的 Server script event
可更新或撤銷已放置爐灶的配方。舊的 `input: outputId` 接入格式仍有效。
不從食品目錄、可食用標籤或料理名稱推導製程。

現有燃料表的單件時長如下；這是明確支持清單，尚未等同 Java 的整個原生／模組燃料 registry。

| 燃料 | tick | 正常 20 TPS 時長 |
| --- | ---: | ---: |
| 煤炭、木炭 | 1600 | 80 秒 |
| 煤炭方塊 | 16000 | 800 秒 |
| 乾海帶塊 | 4000 | 200 秒 |
| 烈焰棒 | 2400 | 120 秒 |
| 木棒 | 100 | 5 秒 |
| 竹子 | 50 | 2.5 秒 |
| 熔岩桶 | 20000 | 1000 秒 |
| `FUEL_TICKS` 已列出的木板、原木 | 300 | 15 秒 |

熔岩桶點燃後在燃料槽留下空桶。Java 的原料烹調只有 `shrink(1)`，並不額外返還碗、瓶等容器，
本版也不自行生成；需要容器或多原料語義的配方繼續由原工作站負責。
`ctx.fuelTicks` 保留既有數值擴充入口，沒有宣稱自動識別任意模組燃料及其 remainder。

爐火改為各爐獨立的 `firePhase / fireTicks / cycleFrame`，保存到原 `station.appliance`。
點火後 15 tick 等待、5 tick 爆火，再以每 8 tick 循環四張原圖。
爆火使用 Bedrock 官方 `item.firecharge.use` 聲音，發射 12 個 flame／6 個 smoke；
穩態每 8 tick 發射 3 個 flame，位置按爐口朝向偏移 0.375、Y+0.4。
六張 Java 原 PNG 保持原檔 bytes，方塊 `fire_frame` 選擇畫面；移除原先全域 2 tick flipbook
及 Java 沒有的 7 點照明。載入仍燃燒的爐灶直接恢復穩態，不補播點火。
原始粒子擴散／速度與 GeckoLib 點火骨骼 squash 尚未逐幀重建，客戶端視聽仍待驗收。

新存檔欄位只增加在既有 appliance 記錄；缺少 `inputKeys` 的舊記錄首次讀取會建立身份基線，
不清零合法舊進度。每個有變動的設備更新（現行每 2 tick）保存一次，避免只在 20 tick
checkpoint 保存而使正常重啟倒退。點火扣燃料、批次出菜與玩家換料均在同次同步操作保存；
不依賴不可寫入世界的 shutdown before-event。存檔仍由既有 `store.js` 單獨持有，UUID、
設備 ID 與七槽原生物品不遷移；世界突然斷電時，原生 inventory 與世界屬性仍不是共同原子交易。

手持支援的食材／燃料點擊，直接把該堆疊存入可用輸入槽／燃料槽；放不下則保留原堆疊。空手或手持其他物品時開啟單頁七槽控制：點槽取出、收全部成品、從背包補料、刷新或關閉，不需進入槽位子選單。整批取出先核對背包容量；槽位已被其他玩家改動時拒絕舊選擇並刷新。表單返回後重新驗證距離、權限及設備；取消、設備移除或失去權限直接退出。同步寫入例外嘗試回復原 ItemStack，完整成敗邊界以本輪測試報告為準。

## 洗碗池及洗碗機

洗碗池依 `block/WashingTableBlock.java`、`core/WashingTableManager.java`，最多放 **10 個髒盤子**。手持髒盤點擊加入 1 個；騰空雙手後點擊開始洗 1 個，保持距離 4 格內、空手及望著洗碗池 **80 tick / 4 秒**。看向別處、換物品、離開、斷線、權限被撤銷或再次點擊會中止；未完成的盤子留在池內。

原版採「持續按住使用鍵」。本版為「點擊開始並保持望著池子」，避免依賴 Java 自訂封包與客戶端按鍵事件。手洗保留原身體／前臂端點適配，第一人稱左右臂資料及共用顯示請求的目前範圍、接線要求與未確認項統一見 [PARITY](PARITY.md#手洗第一人稱左臂)；真肘關節另列，未改 `player.json`。水花、聲音及 action bar 進度提供操作回饋。

洗碗機依 `block/entity/DishwasherBlockEntity.java`，沿用既有的直接批次操作：**手持髒盤點擊**，一次從玩家背包收取最多 **16 個**髒盤子；洗好後必須**雙手空**才可點擊領取整批。這不是本輪才加入的無表單介面；本輪補強手持條件與保存錯誤時的回退。

| phase | 狀態 | 時間 |
| --- | --- | --- |
| 0 | idle，可接收髒盤 | 等待操作 |
| 2 | dirty_in，放入髒盤 | 30 tick |
| 3 | washing | 1–8 個：40 tick；9–16 個：80 tick |
| 4 | clear_out，推出乾淨盤 | 24 tick |
| 5 | clear_ready，等候取出 | 等待操作 |
| 1 | empty_in，取走後收回 | 14 tick |

因此最多 8 個盤子需 94 tick，9–16 個需 134 tick 到達可取出狀態；設備腳本以 2 tick 間隔更新，畫面狀態切換受此取樣間隔影響。庫存不足以領取整批時，不會取走或刪除機內盤子。裝入／領取遇到已知保存錯誤會回復盤數、phase 及玩家庫存，仍不承諾程序任意崩潰時的跨存檔原子性。方塊 state 每個最多 16 種值，16 個盤子的視覺計數拆為 `plates = count % 16` 與 `plates_high = count >= 16`；實際存檔數量仍為 16。

方塊資源共有 **82 個姿態**：原 66 個工作姿態加 `empty_out` 預覽的 16 個姿態。`frame` 0–15 由已保存的剩餘 tick 計算，洗滌姿態以原 40 tick 週期重複；保留原 easing、非均勻機身縮放、抽屜／門動作及洗滌抖動。靜態立方體不能精確表示旋轉子部件的剪切，取樣測試最大頂點殘差約 0.260 像素。盤數 1／2／至少 3 分別按 Java 規則顯示第 2 個、第 2＋5 個、全部 6 個盤子，避免一盤也顯示整排。重啟恢復工作 phase／時間，不額外領盤。

預覽要求主手或副手持髒盤、6 格視線命中、設備 idle 且有權限。`phase=6` 只作畫面狀態，持久設備 phase 仍為 0–5；任一合資格玩家看向設備便保留預覽。Java 為每位客戶端獨立預覽，本版為多人共用方塊姿態，預覽聲音只播給觸發玩家。這不變更機內盤數，也不是連續逐幀 GeckoLib 渲染。

## 打單機與外賣袋

Java 這兩種方塊的 blockstate 是空模型，由完整 Geo renderer 顯示。候選來源改用原機身／袋子 Geo 與各自專用材質，沒有把動態部件疊在另一套靜態外形上。打單機使用 16 個 `neworder` 姿態加 idle／waiting 端點，共 18 個；紙張在 20 tick 內升起，保持至原 PRINTING 的 45 tick 結束，再以 waiting 顯示普通候選單。候選已取完便隱藏紙張，到店單不延長它。列印時序是記憶體中的外觀計時，重啟後恢復待取紙張，不重播已開始的列印。

外賣袋的 `maked` 在正常 20 TPS 下播放 0.5 秒，共 11 個姿態；`frame=0` 是完成姿態，保留既有方塊的穩定外觀，`frame=1..10` 每 tick 推進，只有活動姿態要求方塊 tick。區塊卸載會暫停這段短動畫，恢復後從已保存 frame 繼續，並不追補離線播放；有限取樣、客戶端插值與原動畫的實際節奏仍待比對。

## 操作台裝盤與外送打包

未交付展示成品改由一格原生 inventory 持有完整 ItemStack；正常擺放／取回、舊連結採用、拆除與空槽不重造的權威範圍見 [PARITY 展示餐點保存](PARITY.md#未交付的展示餐點)。顧客已開始用餐後仍按 Java 換新髒盤，不能把兩種保存語義混為一談。

手持有效的本店已接訂單點擊操作台，可直接製作該單。空手開啟單頁列表，每張訂單同時顯示菜名、數量、可製作或缺少的食品／包材／乾淨盤，以及台面是否受阻；點選即製作，沒有另開確認子頁。取消表單不扣料。

食品仍取自玩家背包及有權使用的 24 格內冰箱，耗材取自 5 格內對應架子；上方需空置以擺放原生盤／袋。送出後重新核對餐廳、訂單期限／狀態、權限、距離、設備及完整物品需求。沿用現有食品變體匹配、ItemStack 核對、同步扣料及失敗回退，不把菜單食品註冊當作烹調配方。成品仍帶唯一訂單 proof，點台取走後交給相應顧客。

## 顧客及椅子

玩家安坐循環及拍手的全身／前臂／足端、TP／FP起停與持物分界統一見 [PARITY 安坐與拍手](PARITY.md#安坐與拍手)。沿既有seat服務的短暫外觀狀態恢復／停止，不增玩家屬性或保存格式；client圖層／可見動作尚未觀察，舊013原生報告保留原範圍。

`entities.js` 在已載入區域生成顧客，並把 `restaurant_id`、`order_id` 保存在實體動態屬性。普通機器候選單尚未接取時不產生顧客；**到店單在 offered 階段便生成顧客**，玩家可直接點顧客接單。空椅搜尋採水平半徑 24 格、垂直 ±8 格，座位上方需兩格空間。普通餐廳顧客無椅時會在打單機 5 格內尋找可站立位置；walk-in 到店顧客必須有空椅才生成。玩家也可以點椅子坐下。

這個直接安排位置的流程符合上游。[OrderNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java) 的 `spawnPreparedNpc` 直接定位並入座，`findSpawnPosNormal` 包含 5 格無椅 fallback；[WalkInNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/WalkInNpcManager.java) 無椅即返回失敗。[CustomerEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/entity/CustomerEntity.java) 的 movement speed 為 0，僅有看向玩家／隨機看向目標的 goals；原作預設並沒有入店尋路可供移植。

椅子使用不可見的原生 rideable 輔助實體，並以 [EntityRideableComponent.addRider](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityrideablecomponent?view=minecraft-bedrock-stable) 掛上乘客。空座、椅子被拆除及訂單結束會清理輔助實體。站立與坐姿等待各有 4 個原片段，`animation_variant` 依原 55／15／15／15 權重選擇；它與 action 分開。

| action | 原作動作 | 名義時間（20 TPS） |
| --- | --- | --- |
| 0 | 無特殊動作，使用當前等待／坐姿變體 | 持續等待 |
| 1 | sit_spawn，坐姿生成 | 12 tick／0.6 秒 |
| 2 | stand_spawn，站立生成 | 12 tick／0.6 秒 |
| 3 | sit_take，坐姿取走外帶 | 40 tick／2 秒 |
| 4 | stand_take，站立取餐 | 60 tick／3 秒 |
| 5 | eat_boom，好吃到爆炸 | 120 tick／6 秒 |
| 6 | eat_scale，普通進食 | 110 tick／5.5 秒 |
| 7 | interrupted，提前收盤後離場 | 10 tick／0.5 秒 |

完成動作保存開始／結束的絕對毫秒時間，服務端重載不延長原完成期限；客戶端按同步的 `action_elapsed` 定位片段，完成後保留原末幀縮小／消失，避免等待服務刪除時重新出現。idle 只在一段播完後按原權重重新選擇。服務端每 5 tick 同步動作時間、效果與離場，畫面可能落在下一次取樣。**顧客實體服務不產生金幣、小費或髒盤**；付款由訂單交易負責，髒盤由持久餐盤記錄核准。

外送顧客只在玩家進入目的地附近、相關區塊已載入時嘗試生成，不使用 `tickingarea` 強載远方區塊。若候選座標高度不合地形，腳本搜尋已載入的可站立地面，並回存最後座標；找不到安全位置會延後重試。

地形搜尋只檢查已載入區域，以有上限的短支撐射線及候選位置尋找安全地面；不等同 Java 的全部地形判定，遠方海洋地址仍可能找不到可用位置。使用包內固定的兩套模型／貼圖，沒有線上玩家皮膚下載、自動 Mojang 帳號皮膚或女僕模組人物。這些差異與預設顧客直接生成是不同問題。

## 餐盤進食、收盤與付款

`dining.js` 的用餐餐盤是 `ordertocook:dining_plate_block` 原生方塊，依原 [FoodPlateBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 的 15／60／80／100 tick 門檻切換外形。型號 `v` 為 0–9，階段範圍為 0–40；方塊使用 `stage + 16 * stage_high`，避免單一方塊狀態超過16值：

| 交餐後經過時間 | 本型進食階段 | 合成 stage |
| --- | --- | --- |
| 0 至不足 0.75 秒 | 原放置食物模型及短動畫 | 0 |
| 0.75 至不足 3 秒 | 第 1 階段 | 4 × v + 1 |
| 3 至不足 4 秒 | 第 2 階段 | 4 × v + 2 |
| 4 至不足 5 秒 | 第 3 階段 | 4 × v + 3 |
| 5 秒起，直到收盤 | 第 4 階段，髒盤 | 4 × v + 4 |

Java stage 0 的 blockstate 為空，實際由 `FoodPlatePlacedRenderer` 顯示食物。本版stage 0沿用原 `ordertocook:dining_plate` helper、32×32材質與0.5秒 `maked`，按 `placement_age` 恢復；stage 1–40由方塊直接顯示原模型及256×256原像素atlas，移除舊helper。027把零cube的方塊空模型改成unit內有合法邊界的mesh，透過原生geometry bone_visibility隱藏，仍只讓helper顯示stage 0；可見階段與未用編碼值的範圍、客戶端限制見 [027來源驗證](validation/0.1.27-alpha.1/CLIENT_ASSETS.md)。原實體ID與屬性保留以讀取舊世界，已不用實體命中／互動元件收盤。

碰撞保留 `FoodPlateBlock.SHAPE` 的兩部分：底盤14×2×14像素、中央10×3×10像素（中央頂部高5像素）。26.60原生collision array承載兩層；選取框元件只用一個外接長方體14×5×14，因此角落的游標框不是Java的聯集形狀。原作沒有重力，本版亦不因下方桌面拆掉而下墜。用餐餐盤仍由餐廳記錄核准一次新髒盤，沒有新增可領取的helper庫存；未交付展示成品的完整ItemStack已由025原生庫存保存，分界見 [PARITY](PARITY.md#未交付的展示餐點)。客戶端畫面、UV朝向及硬體輸入仍不由服務端探針推定。

用餐位置優先選椅前方，受阻時嘗試相鄰可用桌面／空位，最後保留椅前的整格錨點；若仍被佔用便拒絕新交餐；不沿用 Java 為放盤直接破壞佔位方塊的行為。餐盤保存維度、位置、方向、型號、開始時間及唯一 token。區塊未載入時等待，重新載入後從記錄恢復方塊；遇到玩家其他方塊會等待，不覆蓋；重複或失去對應記錄的顯示實體會清理。所有餐廳共用位置佔用判斷，避免互相蓋盤。**同一位置尚有未收餐盤時，下一餐在扣除承載物、改訂單及付款之前便拒絕交付。**

髒盤在第 5 秒起持續留在原處，由店主／員工點盤或其支撐桌面領取一個髒盤，沒有定時向玩家背包自動補盤。打破或命令替換餐盤會在原處掉出一盤，沿原作 `onRemove` 保留顧客原動作及時間；普通回收若背包已滿亦落地，保持普通可堆疊物品，不改背包其他格子。椅上喝彩及載具攻擊輸入不會拆盤。提前收盤也只給一個髒盤，並把顧客改成 action 7，再過約 0.5 秒離場。中斷時序同步保存在訂單及 pending meal，已領盤記錄會作為不可再次發盤的短暫 tombstone 保留至中斷完成；因此訂單歷史被裁剪或重啟不會把顧客改回舊進食動作。

站立堂食仍會放盤，但顧客使用 action 4，在約 3 秒離場；餐盤獨立到第 5 秒變髒。這是原 [TakeoutBagItem.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java) 中 `submitDineInWithPlacedPlate`、`resolveCompletionAnimation` 與餐盤獨立 tick 組合出的行為。

普通椅上堂食按原 10% 機率選 action 5，加賞為 1–4 加實際餐廳級別；只有明確標記彩蛋顧客才使用原 60%，目前來源會透過既有顧客選擇器生成彩蛋人物，皮膚限制見[PARITY.md](PARITY.md)。0.1.16起，加賞在約6秒用餐結束後另付，0.1.17提前收盤改依原作的附近方盒查找第一位進食者，取消該人的加賞，可能是另一桌；食品進度與顧客反應時間分開。第5秒後取髒盤或直接打破方塊不取消待付加賞。離線者不收個人幣／收益，餐廳仍計入加賞。保存、重啟、舊版已付款與原生範圍由[用餐加賞](validation/0.1.16-alpha.1/MEAL_BONUS.md)負責。效果不產生傷害或破壞方塊。

收盤先持久化 claim，再把髒盤寫入背包或生成原生世界掉落。可堆疊髒盤不能寫ItemStack動態屬性；掉落失敗時以同一同步呼叫前後的原生物品實體識別已接受寫入，只有確認未生成才回退重試。可識別的同步失敗會回退；無法確認世界物品生成回執時保留已領狀態。原生 inventory 與世界動態屬性沒有共同原子提交：若程序恰在 claim 保存後、給物之前中止，可能損失該一個盤子，不能保證任意強制關服都零損失。拆除餐廳遇到未載入錨點時會保留「移除中」記錄並封鎖新交易，待舊盤清理後才移除餐廳。

## 小電驢

原版參照 `vehicle/motorcycle/MotorcycleEntity.java`。本版已有：

- 使用車輛物品在前方安全地面放置；右鍵上車，移動鍵駕駛，蹲下離座。
- 白、紅、藍、黃四種車身；持對應染料點車染色，消耗一個染料。
- **54 格真實 inventory** 保溫箱；蹲下點車或使用遙控器開啟操作表單，餐點與外送包裹的 proof 會保留。
- 遙控器優先控制正在騎乘的車，否則選面前或 12 格內最近的車；表單可以鳴笛及切換車燈。
- 駕駛時用跳躍鍵鳴笛。這是基岩版按鍵映射，並非原版自訂鍵位。
- 收車前要求車上無乘客、保溫箱已清空且玩家有背包空間；回收物品保留顏色。
- 實作原版累積 5 次近戰命中後拆車、掉回車輛及貨物的腳本邏輯；它仍需實機確認 `entityHitEntity` 與免傷實體的實際命中事件配合。

基岩版使用官方 [minecraft:input_ground_controlled](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_input_ground_controlled?view=minecraft-bedrock-stable) 駕駛模型。加速度、轉向、慣性、碰撞與乘客姿勢不同於 Java 自訂載具程式，尚未實機調校成相同手感。

車燈切換控制發光材質和燈面顯示；**沒有地形上的動態投射光**，沒有臨時放置光源方塊。頭盔物品已有 attachable，但原作騎車自動頭盔屬 `client/render/feature/HelmetFeatureRenderer.java` 的純渲染層，不是替玩家換掉背包裝備。本版未重建該玩家渲染層及專用鳴笛手勢，也不透過改玩家盔甲欄或覆寫玩家定義模擬它。

## 設備準星資訊與個人進度

`equipment_inspection.js` 自 alpha.3 起提供唯讀快照，由 main 的單一 action bar 更新器每 10 ticks 合併顯示。6 格射線命中後，仍需同維度、設備中心 6 格內、已載入且有使用權限。架子容量為包材 10／盤架 18；洗碗池 10、洗碗機 16；冰箱直接讀取上 27／下 54 原生容器的已用槽位，遷移未完成時顯示尚未載入，不觸發搬移。爐灶 helper 仍需與設備 ID、維度及原 anchor 相符。檢視不建立 station、替代庫存或修復壞資料。

第一行優先手洗百分比／20 tick 中止訊息，否則顯示設備資訊；若主手票據／包裹有進行中的外送，第二行顯示方向、座標及時間。手洗仍要求空手，完成後重新手持外送物品才能恢復導航。無任何本包提示時只清除上一次 HUD 一次，不持續清空閒置玩家 action bar。兩行排版與不同裝置可讀性待 dot 實測。

Jade 來源是固定提交的 [OrderToCookJadePlugin.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/compat/jade/OrderToCookJadePlugin.java)。爐灶讀數是現有 Bedrock 表單的 HUD 適配。洗碗機的原 `empty_out` 預覽已獨立接線，條件和多人共用姿態限制見上節；HUD 仍只讀設備資料。

個人進度的 11 個原作定義、10 個可觸發條件，以及玩家歸屬／同維度金牌判定見 [PROGRESSION.md](PROGRESSION.md)。訂單累積帳簿與餐廳同時保存；profile 以來源 checkpoint 取差值，分玩家重試，保留壞資料。操作型事件也在餐廳／設備上保留至個人進度保存成功，不能以重做升級代替重試通知。

## 食物辨識及持久化邊界

Microsoft 的 [ItemFoodComponent 文件](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemfoodcomponent?view=minecraft-bedrock-stable) 明確限定其適用於 data-driven items。本版以已核對的原版食品清單為基礎，再加可讀 component 及管理員登記規則；不能據此宣稱任意已安裝附加包食品都會自動被正確識別。

設備狀態、餐廳及訂單使用世界 dynamic properties；冰箱 ItemStack 使用原生方塊 inventory，爐灶及載具使用原生實體 inventory。[官方多人腳本指南](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/multiplayer-scripts?view=minecraft-bedrock-stable)說明 dynamic properties 會跨伺服器重新啟動保留。套件 header UUID 需要保持固定。讀取異常資料時保留原值，不以清空存檔作「修復」。

設備只有載入時處理；離線、遠離區塊或重新載入不補算大量烹飪 tick。訂單期限、餐盤進食及顧客完成時間使用真實毫秒，離線期間仍推進。餐盤名義 0.75／3／4／5 秒對應原 20 TPS 的門檻，但世界卡頓或暫停時並不保證與 Java 世界 tick 完全同步。

仍有掉落元資料差異：Java 立牌掉落物保留精簡菜單 NBT，打單機掉落物保留餐廳資料及機器 ID；本版拆除後的普通家具掉落物尚未攜帶這些資料。本輪修正模型、材質、音效與粒子，未將這項持久化缺口標為完成。

## 驗證範圍與記錄

回歸測試直接匯入正式腳本，並用可控配接器代替 Minecraft／表單依賴；它能檢查交易分支、回退及狀態，但不能證明原生 GUI 的真 Player 事件順序。原生服務端探針使用真方塊、容器與 ItemStack，仍不能代替玩家連線、原生拖放、觸控、手把、雙人競爭及 RP 渲染驗收。

**0.1.5-alpha.1 的實際命令、結果、指紋及尚未執行的案例以 [CONTAINER_GUI.md](validation/0.1.5-alpha.1/CONTAINER_GUI.md) 為準。** 本文不把腳本實作描述當作已通過測試的聲明。26.60 入口 before-event 取消原生容器、各輸入裝置及雙人視窗仍需真 Player 證據；已開視窗即時撤權屬已知引擎限制。

[VALIDATION.md](VALIDATION.md)、[DOT_HANDOFF.md](DOT_HANDOFF.md) 及 [PLAYTEST.md](PLAYTEST.md) 保留歷史版本的結果與交接範圍。alpha.2 原生斷言及 alpha.3 限定客戶端結果均不直接套用到 0.1.5-alpha.1；較新服務端通過也不能證明所有客戶端／裝置相容。
