# 顧客、載具與廚房設備：基岩版實作及差異

本文件對應 `runtime/BP/scripts/entities.js`、`appliances.js`。這是可執行的基岩版改編；Java 的介面、實體物理和 GeckoLib 方塊動畫並不能原樣載入基岩版。**型別檢查及模擬測試通過，不等於已在 Minecraft 客戶端完成遊玩驗證。**

上游基準為 [breezeth-CN/OrdertoCook，提交 e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。下列 Java 檔案均位於 `fabric-1.21.1/src/main/java/cn/breezeth/ordertocook/`。

## 版本與 API

目標最低版本為 **Minecraft Bedrock 1.21.100**；依賴固定為穩定版 `@minecraft/server 2.0.0`、`@minecraft/server-ui 2.0.0`，不要求 Beta APIs 或 Upcoming Creator Features。Microsoft 的 [1.21.90 創作者更新說明](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.21.90?view=minecraft-bedrock-stable)已列明 Script API 2.0 與 Custom Components V2 正式推出。本專案選用稍後的 1.21.100 作共同的資源格式及相容基準。

方塊及物品自訂元件由 `main.js` 在 `system.beforeEvents.startup` 註冊；世界存檔讀取及服務建立在 `world.afterEvents.worldLoad` 執行。服務的 `init()` 接著排程各自的 5 tick 更新，不再等待另一個 `worldLoad`。這遵循 [Script V2 的 early execution 限制](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/v2-overview?view=minecraft-bedrock-stable)。

介面使用 [ActionFormData](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/actionformdata?view=minecraft-bedrock-stable)；遊戲內 UI 能以鍵鼠、控制器和觸控操作，但排列、拖曳、快捷移動及動畫不同於 Java 容器視窗。本模組沒有覆寫 `player.json`。

## 冰箱

| 項目 | 本版行為 |
| --- | --- |
| 放置 | 同一 ID `ordertocook:refrigerator` 的上下兩格；上半格沒有獨立掉落。放置前需確保上方空間。 |
| 儲存 | 保留原版 **上層 27 格、下層 54 格**，共 81 格。點上半開上層；點下半開下層。 |
| 可存物品 | 已知原版食品、設定中登記的食品、具有可讀食物 component 的自訂食品。 |
| 存取 | 原生表單選擇整疊存入或取出；分頁顯示格子。每次操作再次核對玩家距離、設備是否存在、即時店主／員工權限及所選物品；開啟表單後被撤權也不能繼續取物。 |
| 開門 | 上下門同時開合。原版下門幾何跨越兩個基岩方塊的切分線，本版同步兩半以避免門片斷開。上、下庫存仍獨立。 |
| 拆除 | 破壞任一半都拆除另一半，只掉落一個冰箱物品，並掉出庫存中的真實物品堆疊。 |

原版源碼 `block/entity/RefrigeratorBlockEntity.java` 額外允許每疊 128 件。**本版遵守各 Bedrock 物品自己的最大堆疊數**，一般食品通常為 64；因此相同格數不代表相同的總件數。原版門打開後直接展示內部食品的效果、本版獨立開其中一扇門及完整平滑門動畫均未聲稱一比一完成。

庫存實際保存在不可見的 `ordertocook:storage` 實體原生 inventory 裡，沒有把食物簡化成「ID + 數量」後重造。餐點、包裹的唯一訂單 proof、動態屬性、名稱、lore、耐久及其他原生堆疊資料會隨 ItemStack 保留。已記錄的庫存實體尚未載入時，程式保留其 ID 並拒絕建立空櫃，避免把暫時未載入誤認成從未有貨物。

技術依據：[EntityInventoryComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityinventorycomponent?view=minecraft-bedrock-stable)、[minecraft:inventory](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_inventory?view=minecraft-bedrock-stable)。原生容器資料與世界動態屬性不是資料庫交易，突然終止程序時的原子落盤保證不能由本套測試推出。

## 三槽爐灶

依 `block/entity/StoveBlockEntity.java`，保留 7 格結構：3 格食材、1 格共用燃料、3 格對應成品。**每 200 tick（正常 20 TPS 下為 10 秒），三条能出菜的槽同時完成一次烹調**。成品格已滿或物品不相容時，該槽不消耗食材。燃料只在至少一槽能烹調時點燃；燃燒中的燃料會繼續計時。失火後未完成進度以每 tick 2 點回退。

穩定 Script API 2.0 沒有提供此處可用的通用煙燻配方 registry 查詢，因此本版使用明確的配方表：

| 食材 | 成品 |
| --- | --- |
| 牛肉、豬肉、雞肉、羊肉、兔肉 | 各自的熟肉 |
| 鱈魚、鮭魚 | 熟鱈魚、熟鮭魚 |
| 馬鈴薯 | 烤馬鈴薯 |
| 海帶 | 乾海帶 |

已支援煤炭、木炭、煤炭方塊、乾海帶塊、烈焰棒、木棒、竹子、熔岩桶及程式列出的木材燃料。熔岩桶燃燒後留下空桶。支援表在 `SMOKING_RECIPES`、`FUEL_TICKS`；服務建立時可透過 `ctx.smokingRecipes`、`ctx.fuelTicks` 擴充。**其他附加包的食品能加入餐廳菜單，不代表它們的烹調配方會自動加入爐灶。**

火焰狀態與煙霧已有對應；完整 Java 火焰骨骼、短暫爆火、任意模組燃料與配方載入仍屬差異。爐灶介面是逐槽操作表單，不能在同一視窗拖曳多個格子。

## 洗碗池及洗碗機

洗碗池依 `block/WashingTableBlock.java`、`core/WashingTableManager.java`，最多放 **10 個髒盤子**。手持髒盤點擊加入 1 個；騰空雙手後點擊開始洗 1 個，保持距離 4 格內、空手及望著洗碗池 **80 tick / 4 秒**。看向別處、換物品、離開、斷線、權限被撤銷或再次點擊會中止；未完成的盤子留在池內。

原版採「持續按住使用鍵」。本版為「點擊開始並保持望著池子」，避免依賴 Java 自訂封包與客戶端按鍵事件。未改 `player.json`，所以也沒有聲稱保留原版玩家上身洗碗動作。水花、聲音及 action bar 進度提供操作回饋。

洗碗機依 `block/entity/DishwasherBlockEntity.java`，一次從玩家背包收取最多 **16 個**髒盘子：

| phase | 狀態 | 時間 |
| --- | --- | --- |
| 0 | idle，可接收髒盤 | 等待操作 |
| 2 | dirty_in，放入髒盤 | 30 tick |
| 3 | washing | 1–8 個：40 tick；9–16 個：80 tick |
| 4 | clear_out，推出乾淨盤 | 24 tick |
| 5 | clear_ready，等候取出 | 等待操作 |
| 1 | empty_in，取走後收回 | 14 tick |

因此最多 8 個盤子需 94 tick，9–16 個需 134 tick 到達可取出狀態；腳本以 5 tick 間隔更新，畫面狀態切換可能落在下一次更新。庫存不足以領取整批時，不會取走或刪除機內盤子。方塊 state 每個最多 16 種值，16 個盤子的視覺計數拆為 `plates = count % 16` 與 `plates_high = count >= 16`；實際存檔數量仍為 16。

方塊資源以狀態姿勢呈現開關與盤子；原版「只把準星移上去便預覽開門」及每一幀 GeckoLib 動畫並未完整移植。

## 顧客及椅子

`entities.js` 在已載入區域生成顧客，並把 `restaurant_id`、`order_id` 保存在實體動態屬性。普通機器候選單尚未接取時不產生顧客；**到店單在 offered 階段便生成顧客**，玩家可直接點顧客接單。堂食顧客使用 24 格水平、8 格垂直範圍內的空椅子；座位上方需兩格空間。玩家也可以點椅子坐下。

椅子使用不可見的原生 rideable 輔助實體，並以 [EntityRideableComponent.addRider](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityrideablecomponent?view=minecraft-bedrock-stable) 掛上乘客。空座、椅子被拆除及訂單結束會清理輔助實體。顧客交付成功後播放已匯入的 `npc_eat&scale` 動作，保留完整 110 tick 動畫長度後離場。**金幣、小費和髒盤只由主訂單系統產生一次**，實體服務不重複付費或掉盤。

外送顧客只在玩家進入目的地附近、相關區塊已載入時嘗試生成，不使用 `tickingarea` 強載远方區塊。若候選座標高度不合地形，腳本搜尋已載入的可站立地面，並回存最後座標；找不到安全位置會延後重試。

差異：首版直接在可用座位或外送地址安排顧客，**未重現 Java 顧客完整的進門尋路、移動過程與任意第三方 AI**；遠方海洋地址也可能需要更完善的重新選址。使用包內固定的兩套模型/貼圖，沒有線上玩家皮膚下载、自動 Mojang 帳號皮膚、女僕模組人物，以及「好吃到爆炸」的額外獎勵流程。顧客訂單互動可執行不代表上述沉浸細節已一致。

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

車燈切換控制發光材質和灯面顯示；**沒有地形上的動態投射光**，沒有臨時放置光源方塊。頭盔的玩家穿戴顯示、專用鳴笛手勢等需要額外相容方案，目前沒有透過覆寫玩家定義實作。

## 食物辨識及持久化邊界

Microsoft 的 [ItemFoodComponent 文件](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemfoodcomponent?view=minecraft-bedrock-stable) 明確限定其適用於 data-driven items。本版以已核對的原版食品清單為基礎，再加可讀 component 及管理員登記規則；不能據此宣稱任意已安裝附加包食品都會自動被正確識別。

設備狀態、餐廳及訂單使用世界 dynamic properties，容器 ItemStack 使用原生實體 inventory。[官方多人腳本指南](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/multiplayer-scripts?view=minecraft-bedrock-stable)說明 dynamic properties 會跨伺服器重新啟動保留。套件 header UUID 需要保持固定。讀取異常資料時保留原值，不以清空存檔作「修復」。

設備只有載入時處理；離線、遠離區塊或重新載入不補算大量烹飪 tick。這與訂單期限使用真實時間、離線期間仍計時是兩個不同機制。

## 本次已執行的驗證

`npm run verify` 已通過：92 個自動化測試、使用真正 2.0.0 官方型別的 TypeScript 檢查、套件驗證及建置均成功。其中 `node --test tests/appliances.test.js tests/entities.test.js` 包含 25 個聚焦回歸測試，全部通過：它們匯入實際發布腳本，只替換 Minecraft/表單依賴為可控的模擬器，沒有複製另一份業務實作當作被測代碼。

測試涵蓋不可堆疊包裹的 proof 保留、舊表單拒絕已變更物品、冰箱分區容量、寫入失敗回退、缺失庫存不重建空櫃、冰箱重複初始化、三槽同步出菜、滿成品槽不燒燃料、16 盤洗碗機計時、洗碗取消、表單選物及洗碗途中撤銷員工權限、到店候選 NPC、單一訂單不重複 NPC、遠距地址延後生成、進食回呼不重複產生獎勵，以及物品重複回呼不重複生成車輛。

另已在 **Bedrock Dedicated Server 1.26.52.3** 執行首輪原生引擎探針，**80／80 項通過**。驗證涵蓋正式腳本入口載入、方塊與物品註冊、雙格冰箱放置、方塊狀態編碼、原生顧客及椅子騎乘、81 格儲物與 54 格車輛容器、不可堆疊餐點的名稱／lore／proof 存取、三槽爐灶出菜，以及 16 盤洗碗機流程。探針也直接呼叫正式訂單與操作台服務，確認接單、精確扣除食品與餐盤、產生成品、取走餐點、交付付款、拒絕複製餐包再次領款及定時產生一個髒盤。

這次服務端探針使用原生方塊、實體及 ItemStack；呼叫玩家相關服務時，以持有原生容器的測試物件代替真實 Player。**因此尚未驗證真實玩家連線、鍵鼠／手機／控制器输入、GUI 表單操作、多人同時操作或資源包實際渲染。** NPC 座姿與進食動畫的畫面、騎乘與下車手感、五次命中回收、雙格拆除及區塊邊界、外送地形、幾何與粒子仍需客戶端驗收。最低宣告版本 **1.21.100 客戶端亦未實測**；較新服務端通過不能證明最低版本的完整相容性。

原生首輪與重新啟動探針的分項結果、版本及適用範圍請參閱 [驗證紀錄](VALIDATION.md)。後續真實玩家驗收請依 [遊玩測試清單](PLAYTEST.md) 執行。
