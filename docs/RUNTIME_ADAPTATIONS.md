# 顧客、載具與廚房設備：基岩版實作及差異

本文件對應 **0.1.2-alpha.3** 的 `runtime/BP/scripts/entities.js`、`dining.js`、`appliances.js` 與 `appliance_motion.js`。這是基岩版改編；Java 的介面、實體物理和 GeckoLib 方塊動畫不能原樣載入基岩版。**型別檢查、模擬測試及原生服務端探針，均不能代替 Minecraft 客戶端畫面、表單及觸控驗收。**

上游基準為 [breezeth-CN/OrdertoCook，提交 e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。下列 Java 規則以 `forge-1.20.1/src/main/java/cn/breezeth/ordertocook/` 為依據，共用模型與動畫位於 `common/src/main/resources/assets/ordertocook/`。

## 版本與 API

目標最低版本為 **Minecraft Bedrock 1.21.100**；依賴固定為穩定版 `@minecraft/server 2.0.0`、`@minecraft/server-ui 2.0.0`，不要求 Beta APIs 或 Upcoming Creator Features。Microsoft 的 [1.21.90 創作者更新說明](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.21.90?view=minecraft-bedrock-stable)已列明 Script API 2.0 與 Custom Components V2 正式推出。本專案選用稍後的 1.21.100 作共同的資源格式及相容基準。

方塊及物品自訂元件由 `main.js` 在 `system.beforeEvents.startup` 註冊；世界存檔讀取及服務建立在 `world.afterEvents.worldLoad` 執行。服務的 `init()` 接著啟動更新，不再等待另一個 `worldLoad`；設備每 2 tick 更新，顧客與餐盤每 5 tick 更新。這遵循 [Script V2 的 early execution 限制](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/v2-overview?view=minecraft-bedrock-stable)。

介面使用 [ActionFormData](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/actionformdata?view=minecraft-bedrock-stable)，交由原生表單提供鍵鼠、控制器和觸控入口；各裝置的實際操作仍待驗收。排列、拖曳、快捷移動及動畫不同於 Java 容器視窗。本模組沒有覆寫 `player.json`。

## 冰箱

| 項目 | 本版行為 |
| --- | --- |
| 放置 | 同一 ID `ordertocook:refrigerator` 的上下兩格；上半格沒有獨立掉落。放置前需確保上方空間。 |
| 儲存 | 保留原版 **上層 27 格、下層 54 格**，共 81 格。點上半開上層；點下半開下層。 |
| 可存物品 | 已知原版食品、設定中登記的食品、具有可讀食物 component 的自訂食品。 |
| 存取 | 原生表單選擇整疊存入或取出；分頁顯示格子。每次操作再次核對玩家距離、設備是否存在、即時店主／員工權限及所選物品；開啟表單後被撤權也不能繼續取物。 |
| 開門 | 每個分區各自計算觀看者；上下門獨立開合，每扇門有 11 個關鍵姿態，正常 20 TPS 下約 1 秒完成。最後一位觀看者關閉該分區後才關門，可在途中反轉。 |
| 拆除 | 破壞任一半都拆除另一半，只掉落一個冰箱物品，並掉出庫存中的真實物品堆疊。 |

原版源碼 `block/entity/RefrigeratorBlockEntity.java` 額外允許每疊 128 件。**本版遵守各 Bedrock 物品自己的最大堆疊數**，一般食品通常為 64；因此相同格數不代表相同的總件數。

模型只把櫃體在 Y=16 分格，整扇下門保留在下半模型並跨至 Y=19.5，避免獨立開門時把門片截斷。上下門分別取樣原 `up_open`／`down_open`，終點角度為 −135°／−125°；關門反向走同一組姿態。原 GeckoLib easing 改用線性取樣，未保留關門機身擠壓、回彈及櫃內食品陳列。少數中間姿態對整扇門施加不超過 0.125 像素的位移，使旋轉後幾何留在 Bedrock 30 像素邊界內；門片尺寸、UV 與端點姿態不變。詳見 [素材轉換說明](ASSET_PROVENANCE.md#冰箱)。

每次開表單都綁定獨立的觀看 session。玩家離線、走遠、撤權或設備區塊卸載會使舊 session 失效；重新載入後，舊表單不能恢復取物權限。當前門 frame 保存在方塊狀態，重啟從該姿態收回；觀看者不跨重啟保留。這些動畫狀態不改寫庫存。

庫存實際保存在不可見的 `ordertocook:storage` 實體原生 inventory 裡，沒有把食物簡化成「ID + 數量」後重造。餐點、包裹的唯一訂單 proof、動態屬性、名稱、lore、耐久及其他原生堆疊資料會隨 ItemStack 保留。已記錄的庫存實體尚未載入時，程式保留其 ID 並拒絕建立空櫃，避免把暫時未載入誤認成從未有貨物。

技術依據：[EntityInventoryComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityinventorycomponent?view=minecraft-bedrock-stable)、[minecraft:inventory](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_inventory?view=minecraft-bedrock-stable)。原生容器資料與世界動態屬性不是資料庫交易，突然終止程序時的原子落盤保證不能由本套測試推出。

## 三槽爐灶

依 `block/entity/StoveBlockEntity.java`，保留 7 格結構：3 格食材、1 格共用燃料、3 格對應成品。**每 200 tick（正常 20 TPS 下為 10 秒），三條能出菜的槽同時完成一次烹調**。成品格已滿或物品不相容時，該槽不消耗食材。燃料只在至少一槽能烹調時點燃；燃燒中的燃料會繼續計時。失火後未完成進度以每 tick 2 點回退。

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

洗碗機依 `block/entity/DishwasherBlockEntity.java`，一次從玩家背包收取最多 **16 個**髒盤子：

| phase | 狀態 | 時間 |
| --- | --- | --- |
| 0 | idle，可接收髒盤 | 等待操作 |
| 2 | dirty_in，放入髒盤 | 30 tick |
| 3 | washing | 1–8 個：40 tick；9–16 個：80 tick |
| 4 | clear_out，推出乾淨盤 | 24 tick |
| 5 | clear_ready，等候取出 | 等待操作 |
| 1 | empty_in，取走後收回 | 14 tick |

因此最多 8 個盤子需 94 tick，9–16 個需 134 tick 到達可取出狀態；設備腳本以 2 tick 間隔更新，畫面狀態切換受此取樣間隔影響。庫存不足以領取整批時，不會取走或刪除機內盤子。方塊 state 每個最多 16 種值，16 個盤子的視覺計數拆為 `plates = count % 16` 與 `plates_high = count >= 16`；實際存檔數量仍為 16。

方塊資源共有 **66 個姿態**：4 個活動 phase 各 16 個，加 idle／clear_ready 兩個端點。`frame` 0–15 由已保存的剩餘 tick 計算，洗滌姿態以原 40 tick 週期重複。轉換保留原門、抽屜、盤子的剛體位移／旋轉、均勻縮放與洗滌抖動，省略無法在此方塊幾何中精確表示的非均勻機身 squash/stretch，並採線性關鍵幀取樣。重啟恢復 phase／時間，不額外領盤。原 `empty_out` 片段仍保存，但「只把準星移上去便預覽開門」尚未接線；有限姿態不等同逐幀 GeckoLib 渲染。

## 顧客及椅子

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

完成動作保存開始／結束的絕對毫秒時間，服務端重載不延長原完成期限；客戶端沒有按已經過時間 seek 動畫，重載時片段可能從頭播放。服務端每 5 tick 更新效果與離場，畫面效果可能落在下一次取樣。**顧客實體服務不產生金幣、小費或髒盤**；付款由訂單交易負責，髒盤由持久餐盤記錄核准。

外送顧客只在玩家進入目的地附近、相關區塊已載入時嘗試生成，不使用 `tickingarea` 強載远方區塊。若候選座標高度不合地形，腳本搜尋已載入的可站立地面，並回存最後座標；找不到安全位置會延後重試。

地形搜尋只檢查已載入區域，以有上限的短支撐射線及候選位置尋找安全地面；不等同 Java 的全部地形判定，遠方海洋地址仍可能找不到可用位置。使用包內固定的兩套模型／貼圖，沒有線上玩家皮膚下載、自動 Mojang 帳號皮膚或女僕模組人物。這些差異與預設顧客直接生成是不同問題。

## 餐盤進食、收盤與付款

`dining.js` 的用餐餐盤是 `ordertocook:dining_plate` 輔助實體，依原 [FoodPlateBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 的 15／60／80／100 tick 門檻切換外形。型號 `v` 為 0–9，實體的單一 `ordertocook:stage` 整數範圍為 0–40：

| 交餐後經過時間 | 本型進食階段 | 實體 stage |
| --- | --- | --- |
| 0 至不足 0.75 秒 | 共用起始盤 | 0 |
| 0.75 至不足 3 秒 | 第 1 階段 | 4 × v + 1 |
| 3 至不足 4 秒 | 第 2 階段 | 4 × v + 2 |
| 4 至不足 5 秒 | 第 3 階段 | 4 × v + 3 |
| 5 秒起，直到收盤 | 第 4 階段，髒盤 | 4 × v + 4 |

原 stage 0 為空 geometry，另有短暫放盤渲染；本版用可見乾淨盤代替這個起始段。其餘形狀取原 40 個 food stage 模型，以一張 256×256 原像素 atlas 供 entity 渲染，不能把方塊的逐面材質別名直接交給 entity。餐盤無庫存、物理碰撞、重力或自動掉落。實體 hit test 已定義，但官方元件說明只描述命中範圍，不能由此推定右鍵／觸控已可用；另有點下方支撐桌面收盤的入口。材質、高度、各朝向 UV 與兩種操作都待客戶端驗收。

用餐位置優先選椅前方，受阻時嘗試相鄰可用桌面／空位，最後使用顧客附近的固定錨點；不沿用 Java 為放盤直接破壞佔位方塊的行為。餐盤保存維度、位置、方向、型號、開始時間及唯一 token。區塊未載入時等待，重新載入後從記錄恢復顯示；重複或失去對應記錄的顯示實體會清理。**同一位置尚有未收餐盤時，下一餐在扣除承載物、改訂單及付款之前便拒絕交付。**

髒盤在第 5 秒起持續留在原處，由店主／員工點盤或其支撐桌面領取一個髒盤，沒有定時向玩家背包自動補盤。提前收盤也只給一個髒盤，並把顧客改成 action 7，再過約 0.5 秒離場。中斷時序同步保存在訂單及 pending meal，已領盤記錄會作為不可再次發盤的短暫 tombstone 保留至中斷完成；因此訂單歷史被裁剪或重啟不會把顧客改回舊進食動作。

站立堂食仍會放盤，但顧客使用 action 4，在約 3 秒離場；餐盤獨立到第 5 秒變髒。這是原 [TakeoutBagItem.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java) 中 `submitDineInWithPlacedPlate`、`resolveCompletionAnimation` 與餐盤獨立 tick 組合出的行為。

普通椅上堂食按原 10% 機率選 action 5，加賞為 1–4 加實際餐廳級別；只有明確標記彩蛋顧客才使用原 60%，本版不主動生成特殊彩蛋人物。本版把加賞與訂單報酬、小費合併，**在交餐成功時一次支付**，Java 則在爆炸動畫末尾另付。提前收盤不取消已付加賞。效果不產生傷害或破壞方塊。

收盤先持久化 claim，再把髒盤寫入背包。可識別的同步失敗會回退；無法確認世界物品生成回執時保留已領狀態。原生 inventory 與世界動態屬性沒有共同原子提交：若程序恰在 claim 保存後、給物之前中止，可能損失該一個盤子，不能保證任意強制關服都零損失。拆除餐廳遇到未載入錨點時會保留「移除中」記錄並封鎖新交易，待舊盤清理後才移除餐廳。

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

alpha.3 用 `equipment_inspection.js` 與設備服務提供唯讀快照，再由 main 的單一 action bar 更新器每 10 ticks 合併顯示。6 格射線命中後，仍需同維度、設備中心 6 格內、已載入且有使用權限。架子容量為包材 10／盤架 18；洗碗池 10、洗碗機 16；冰箱顯示上 27／下 54 的已用槽位。儲物 helper 必須與設備 ID、維度及原搜尋 anchor 相符，缺失時顯示尚未載入；檢視不建立 station、替代庫存或修復坏資料。

第一行優先手洗百分比／20 tick 中止訊息，否則顯示設備資訊；若主手票據／包裹有進行中的外送，第二行顯示方向、座標及時間。手洗仍要求空手，完成後重新手持外送物品才能恢復導航。無任何本包提示時只清除上一次 HUD 一次，不持續清空閒置玩家 action bar。兩行排版與不同裝置可讀性待 dot 實測。

Jade 來源是固定提交的 [OrderToCookJadePlugin.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/compat/jade/OrderToCookJadePlugin.java)。爐灶讀数是現有 Bedrock 表單的 HUD 適配。洗碗機持髒盤看向時的 `empty_out` 是 Java 客戶端本地預覽，現有 66 姿態不包含它，本輪仍未還原。

個人進度的 11 個原作定義、10 個可觸發條件，以及玩家歸屬／同維度金牌判定見 [PROGRESSION.md](PROGRESSION.md)。訂單累積帳簿與餐廳同時保存；profile 以來源 checkpoint 取差值，分玩家重試，保留壞資料。操作型事件也在餐廳／設備上保留至個人進度保存成功，不能以重做升級代替重試通知。

## 食物辨識及持久化邊界

Microsoft 的 [ItemFoodComponent 文件](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemfoodcomponent?view=minecraft-bedrock-stable) 明確限定其適用於 data-driven items。本版以已核對的原版食品清單為基礎，再加可讀 component 及管理員登記規則；不能據此宣稱任意已安裝附加包食品都會自動被正確識別。

設備狀態、餐廳及訂單使用世界 dynamic properties，容器 ItemStack 使用原生實體 inventory。[官方多人腳本指南](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/multiplayer-scripts?view=minecraft-bedrock-stable)說明 dynamic properties 會跨伺服器重新啟動保留。套件 header UUID 需要保持固定。讀取異常資料時保留原值，不以清空存檔作「修復」。

設備只有載入時處理；離線、遠離區塊或重新載入不補算大量烹飪 tick。訂單期限、餐盤進食及顧客完成時間使用真實毫秒，離線期間仍推進。餐盤名義 0.75／3／4／5 秒對應原 20 TPS 的門檻，但世界卡頓或暫停時並不保證與 Java 世界 tick 完全同步。

## 驗證範圍與記錄

回歸測試直接匯入正式腳本，把 Minecraft／表單依賴換成可控配接器。設備測試涵蓋原生堆疊保留、分區容量、存取回退、舊表單失效、多人觀看、動畫反轉、卸載恢復及洗碗機原 phase 時序；餐盤與顧客測試涵蓋各階段邊界、動作選擇、持續髒盤、提前收盤、舊記錄拒絕、重複領取與存檔失敗。資源檢查另核對原檔雜湊、atlas 像素、幾何邊界及離線重產。當次版本、實際執行結果與數量統一記於 [VALIDATION.md](VALIDATION.md)，不能把 alpha.2 的原生結果直接沿用為 alpha.3 通過。

原生服務端探針使用真實方塊、實體及 ItemStack；需要玩家介面的部分仍可能由持有原生容器的測試物件代替 Player。**真實玩家連線、鍵鼠／手機／控制器輸入、GUI 表單、雙人競爭與 RP 渲染尚未完成驗收。** 最低宣告版本 **1.21.100 客戶端亦未實測**；較新服務端通過不能證明最低版本完整相容。alpha.3 本輪沒有重跑原生服務端；dot 依 [DOT_HANDOFF.md](DOT_HANDOFF.md) 與 [PLAYTEST.md](PLAYTEST.md) 執行並記錄客戶端驗收。
