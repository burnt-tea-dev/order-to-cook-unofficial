# 可行性與原作還原對照

## 結論

Order To Cook 的訂單、菜單、等級、餐盤及設備狀態均能以 Bedrock 行為包、資源包及穩定 Script API 重寫；本輪原生冰箱另需啟用 Upcoming Creator Features。原作已有 GeckoLib／Blockbench 格式資源，因此能保留大量原模型、UV、紋理及聲音；跨平台主要成本在程式、介面與動畫驅動。

本文件對應 [package.json 的目前整合來源](../package.json)。冰箱改用 Bedrock 26.60 的上下獨立原生容器；爐灶改為直接存入及單頁七槽控制，操作台支援持訂單直接製作與同頁缺料，洗碗機沿用批次操作並補強寫入失敗回退。使用 stable `@minecraft/server 2.11.0`／`@minecraft/server-ui 2.0.0`，不要求 Beta APIs。**完整一比一仍未達成**，尤其原生冰箱已開介面的即時撤權沒有可用 API；入口攔截、鍵鼠／觸控／手把及真實多人 GUI 仍需客戶端驗收。官方能力核對見 [NATIVE-CONTAINERS.md](NATIVE-CONTAINERS.md)，容器既有實測見 [0.1.5 驗證報告](validation/0.1.5-alpha.1/CONTAINER_GUI.md)。

2026-11-05 原生 BDS 1.26.60.6 載入抓到 0.1.8／0.1.9 共用物品元件的 `onConsume` 註冊錯誤；兩版不適用遊戲交付。0.1.10 將此回呼只掛到具有 `minecraft:food` 的包裹；修正後固定來源已通過原生命令破壞、完整metadata及同一QA世界正常保存／重啟；具體範圍與原失敗見 [原生報告](validation/0.1.10-alpha.1/PORTABLE_NATIVE.md)，不以來源CI或fixture actor冒稱真人輸入。

本文件包含 alpha.3 玩法基線及 **已整合的視覺／音效修復**。本輪修正、離線對照與可重現測試見 [VISUAL_AUDIO_PARITY.md](VISUAL_AUDIO_PARITY.md)；alpha.3 的實機失敗記錄仍保留，不能由新來源測試推定已通過實機複驗。**完整一比一仍未達成**：Java 的 GUI、GeckoLib renderer、玩家動畫、物理與跨模組 API 仍有適配差異；本候選尚未執行 Blockbench 互動檢視及 Java／Bedrock 客戶端畫面驗收。

基準：[官方作品頁](https://www.curseforge.com/minecraft/mc-mods/order-to-cook)，Java [e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。證據分層：源碼對照、單元／服務回歸、原生伺服器探針、客戶端驗收。前三者不能代替最後一層。

## 核心玩法

| 原作特性 | 候選來源狀態 | 實作與差異 |
| --- | --- | --- |
| 拆除與重放 | 已實作並適配 | 立牌完整菜單快照、打單機原店主／員工／等級／全部統計隨掉落物保存；個人帳簿由原世界對帳，不複製到物品；重放不複製訂單、顧客或髒盤。兩種設備每格一個；原生命令破壞回呼、完整metadata及同QA世界重啟已通過；重放用fixture actor走正式adapter，玩家輸入未確認。見 [原生報告](validation/0.1.10-alpha.1/PORTABLE_NATIVE.md)。 |
| 立牌決定菜單 | 已實作 | 每牌最多150種；不耗材範本、按每道一份營養；在允許的附近牌中取最高營養單牌。 |
| 五階候選單 | 已實作並適配 | 刷新按營業中的原生機器tick累計並保存，暫停／停止模擬／關服不補算；同QA原生seed4／restart7及真離區停止／恢復通過，見[機器計時](validation/0.1.21-alpha.1/MACHINE_TIMING.md)。原權重50/25/15/8/2、菜種數與每種數量範圍、等級加成。不同平台亂數序列不逐位相同。 |
| 接單互斥 | 已實作 | 接打單機的一張後取消同輪其他普通候選，到店單獨立。 |
| 普通、加急、外送、遠距 | 已實作 | 36000／12000世界tick（20 TPS時30／10分鐘），關服不倒數；30%基礎配送、配送中10%遠距、50–450與1500–3000格等來源常數。 |
| 到店顧客 | 已實作並適配 | 到店等待按營業機器callback遞減，重新載入重起初始等待；20tick載入觀察間隔內完整卸載／重載未確認。按原等級機率判定；offered 就有可點顧客，必須有空椅。Java 本來就直接生成並入座，沒有需補回的預設入店路線。 |
| 普通顧客與座位 | 已實作 | 優先使用水平 24 格、垂直 ±8 格內空椅；沒有椅子時在打單機 5 格內找可站位置。顧客 movement 為 0，依上游直接安排位置。 |
| 訂單物品／包裹／餐盤 | 已實作 | 真ItemStack附餐廳、訂單和proof；存入載具保留元資料；核心狀態防重複結算。 |
| 操作台取料 | 已實作並適配 | 取玩家背包與可使用的附近原生冰箱；持有效訂單直接裝盤／打包，空手同頁顯示菜名、數量、可製作／缺料。沿用完整需求、食品變體與交易核對，不照搬原 12 格 GUI。 |
| 真實擺放成品 | 已實作 | 在操作台上方生成原盤／袋模型；點取、蹲下擺放、破壞掉回有效成品。 |
| 菜品模型的逐段變化 | 已實作並適配 | stage 0 使用原放盤食物模型、材質與 0.5 秒 `maked` 動畫；按原生方塊計數第15／60／80／100 tick依次切換該型1–4階段。10 種 ×4 形狀由原像素 entity atlas 顯示，第 4 階段為髒盤。區域停止模擬及關服時不補算進度；保存後重開接續計數。 |
| 收盤與洗碗循環 | 已實作並適配 | 髒盤持續留在用餐位置，店主／員工點餐盤或下方桌面取回；打破餐盤及滿包回收時落地一盤；同一位置先清舊盤才可交下一餐。食品第100 tick前收盤同樣返一個髒盤，並按原生查詢順序中斷盤周圍方盒內第一位進食者約0.5秒；可能是另一桌，其食品進度保持原值。洗碗採點擊開始並保持空手／視線4秒；本包椅子／小電驢上不可洗，中途騎乘即取消。 |
| 8級餐廳 | 已實作 | Lv0起步、原成本／營養門檻；營養下降使收益福利降階，不退款已買等級。 |
| 金幣、小費及排行 | 已實作並適配 | 1/5/20/100/10000 面額、可回滾找零、多維統計；雨天由穩定 weatherChange 事件追蹤。「好吃到爆炸」加賞在顧客原生計數120 tick完成後另付；提前收盤按原作的附近查找中斷第一位進食者並取消其加賞；離線者不收個人幣／收益但餐廳照記加賞。舊版已支付餐點不重付。見[計時與付款範圍](validation/0.1.18-alpha.1/LOADED_MEALS.md)。 |
| 「好吃到爆炸」 | 已實作並適配 | 普通椅上堂食 10% 機率、加賞 1–4＋實際餐廳級別，使用原120 tick動作；不造成真實爆炸、傷害或方塊破壞。 |
| 特殊彩蛋人物 | 已實作並適配 | 原七人姓名／帳號／UUID、預設10%抽選、紅色姓名、特殊小費與60%驚喜動作已接入普通和到店訂單，選定後隨訂單保存，不在重生時重抽。網路玩家皮膚未移植，目前用已內附寬版外觀；原生聲畫尚未確認。普通顧客用原姓名名單、預設50%窄版比例。 |
| 原作進度 | 已實作 11／11 並適配 | 包內個人清單／通知，不是 Xbox 平台成就、不加獎勵。依實際交餐玩家累積結算；首單／加急／遠距、三個收益門檻、放置機器／洗碗機升級／八星／金牌均已接線。逾時包裹由原生食用完成事件解鎖，零營養／零飽和；新包裹自帶到期時間，訂單歷史裁剪後仍可食用。詳見 [PROGRESSION.md](PROGRESSION.md)。 |

## 設備、畫面及操作

| 項目 | 保留內容 | 已知差異／待驗收 |
| --- | --- | --- |
| 打單機／立牌／桌椅／架子 | 原模型紋理、朝向、容量可見狀態、音效 | 打單機改為完整 Geo 機身與原材質，16 個列印姿態加 idle／waiting 共 18 個；紙張依普通候選單持續顯示。各方向 UV 仍須實機確認。菜單及店主／員工／等級／統計已隨掉落物保存，見上方「拆除與重放」；放置座標識別仍不同於 Java 數字機器 ID。 |
| 外賣袋 | 完整原放置 Geo、專用材質、11 個姿態 | 原 0.5 秒放置動作逐 tick 取樣；既有方塊預設為完成姿態。區塊卸載時暫停，有限姿態的畫面節奏仍待實機比對。 |
| 冰箱 | 上 27／下 54 格原生方塊容器、上下門獨立；蹲下空手點擊可整理目前那層 | 整理依 Java `RefrigeratorScreenHandler.compactRefrigerator` 的初次出現順序分組，僅合併 native 可堆疊物品並保留 metadata；寫入失敗回復已觸及格子。`native-fridge.test.js` 13項通過；BDS1.26.60.6首次7項、同世界重啟4項通過，真實cargo含名稱、lore、自訂資料、耐久與keepOnDeath。控制入口由實際adapter測試，未宣稱真人輸入或GUI畫面驗收。仍無食品限定槽、每格 128 件及內部食品陳列；原生容器已開啟時無法強制關閉。 |
| 洗碗機 | 16 盤容量、原 phase／時間、82 個門／抽屜姿態 | 批次存取失敗保留物品，補回非均勻機身變形、原盤數可見規則與 `empty_out` 預覽。預覽由合資格玩家共用方塊狀態，與 Java 每客戶端獨立預覽不同；旋轉子部件的剩餘剪切誤差與有限取樣詳見素材說明。 |
| 三槽爐灶 | 3輸入＋1燃料＋3配對輸出、共用200 tick；實際產量、堵塞、換料重置與保存；15／5／8 tick獨立爐火 | 原版9條＋有效安裝時煙火2條，其他供應商以明確smoking契約接入；單頁控制與直接存取，點火骨骼與粒子分布仍有適配，客戶端待驗收。 |
| 顧客 | 兩款原皮膚／骨架、等待與坐姿各 4 變體、7 個 action | idle 權重 55／15／15／15，完成片段後再選變體；action 按原生實體已模擬的tick定位，保留12／40／60／120／110／10 tick時長及保存進度；完成通知下一tick處理，原生測試中10 tick中斷至移除共13 tick；不下載網路皮膚。 |
| 用餐餐盤 | 原生方塊、原兩層碰撞、40個進食模型；stage 0沿用原食物與放盤短動畫 | 舊記錄及token保留，穩定階段舊helper會移除；點取／拆除走唯一領取記錄。Java 用餐中或完成後刻意回傳新髒盤；未交付成品的完整物品另見[展示餐點保存](#未交付的展示餐點)。選取框是兩層形狀的外接長方體，原作沒有重力。用餐部分見[原生餐盤](validation/0.1.15-alpha.1/NATIVE_PLATE.md)，不由服務端推定客戶端聲畫。 |
| 椅子／玩家動作 | 玩家可坐、手洗身體／端點轉換、獨立第一人稱左右臂節拍、顧客原姿勢 | 手洗身體／前臂端點沿用原適配，0.1.22 補第一人稱左臂資料及共用顯示請求；可見性須由有效共享 player/controller 接線，單包不保證空手左臂。真肘關節、Java ACTION 校準、客製玩家骨架及可見姿勢／停止仍未完成或未確認。沒有 player.json 或 renderer 覆寫；目前範圍見[下節](#手洗第一人稱左臂)，[0.1.20 原生證據](validation/0.1.20-alpha.1/PLAYER_POSES.md)保留原範圍。椅上喝彩起停及聲音不變，見[喝彩範圍](validation/0.1.13-alpha.1/CHAIR_CLAP.md)。 |
| 小電驢 | 原Java模型、四車色、保溫箱、燈面、喇叭 | 原生載具物理及按鍵；燈面發光但不照亮地形。原騎車自動頭盔屬玩家渲染層，本版未重建該層及完整玩家姿勢。 |
| 原始美術 | 67原PNG、12原OGG原樣保留；原geo／動畫正規化存档 | 保存未使用片段不等於其在玩法中已被觸發；動畫清單詳見ASSET_PROVENANCE。 |

## 未交付的展示餐點

操作台做好的餐盤／外送袋，以及玩家蹲下擺放的同一件成品，直接保存在展示方塊的一格原生 inventory。準備時只建立一次成品；擺放與取回使用 `Container.moveItem` 搬動完整 ItemStack，保留名稱、lore、自訂資料與原訂單 proof，不列舉欄位重建。訂單後來失效也可取回格子中的實物，交付仍由原訂單檢查決定。滿包保留原處；拆除／替換由原生容器掉出真物品，腳本不另造副本。

舊展示只有訂單連結，首次載入或操作時可一次轉入原先會回傳的成品；先前已丟的額外名稱等資料無法補回。`nativeParcel` 表示物品已交給原生 inventory；此後空槽就是空槽，包括其他移物入口取走後，不再憑舊連結造物。舊展示尚未轉入就拆除時，保留原來一次回收路徑。這是舊存檔採用，不是物品 ID 相容鎖或退休登記表。原生庫存與 world dynamic properties 仍不是跨儲存層的原子交易。

正常點取沿原腳本動作；before-event 取消原生容器介面。沿用冰箱已需的 [Upcoming Creator Features 與容器能力](NATIVE-CONTAINERS.md)，不新增模組依賴。Java FoodPlateBlockEntity 不公開普通 Inventory／ItemHandler，不能因此宣稱漏斗等價；adapter 測試也不能證明引擎漏斗或介面取消。

原生容器所需的新方塊格式中，材質的 `ambient_occlusion` 必須用數字。生成器將原 false／true 等義轉為0／1，包含階段 permutations；[官方材質文件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable) 明列1.26.20起不再接受布林值。0.1.24首次原生載入因此失敗，保留失敗證據；沒有改引擎或關掉檢查。

原作分界：[Forge 操作台](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java) 存放待取的成品 copy；[FoodPlateBlock](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)／[BlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 完整保存及回傳。顧客用餐後，提早回收／拆除及100tick完成都換新髒盤。[NeoForge1.21.1 Block](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)及[BlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 已分別核對相同分界。本次不改用餐髒盤流程，也不為原作本來就消耗的每件原料保存 metadata。

2026-11-06 正式 adapter 反例：正常製作並取走成品，用 [ItemStack nameTag／setLore／非堆疊 setDynamicProperty](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable) 加資料，再正常擺放取回。修前名稱、lore、自訂資料全失，修後餐盤及共用 adapter 的外送袋都保留；並驗證失敗回復、掉落不重建、舊展示採用及移物後不重造。這不是任意 NBT 或手造 BlockEntity 反例。原生引擎與同世界重啟仍待共同時段實測，未宣稱真人介面或畫面驗收。

## 手洗第一人稱左臂

0.1.22 由 `tools/convert_assets.py::make_player_handwashing_animation` 生成真正的 FP `leftArm` channel，使用原 `left_arm`／`left_hand` 的相對節拍。右臂的官方空手基準與曲線、第三人稱 clip 保持原資料；左臂攝影機基準採右側的左右鏡射。這是明列的適配，尚未等價 Java ACTION 雙臂校準或其分段肘關節。

有限四秒 FP clip 先直接寫入 `variable.senluo_fp_left_arm_request`，再回傳已賦值的同一條件作為實際 blend：第一人稱、非 VR、非 UI 預覽、主副手皆空，且 `0 <= query.anim_time < 4`。因此拿起地圖／副手物品到既有 server cancel 到達前，洗盤姿勢也會收回，不只關閉顯示請求。這擴充了 FP blend 條件，不能稱整個 FP 行為未變。既有 stop replacement／0.1 秒退場保留，stop clip 直接清零，不先讀取可能尚未定義的共用變量。

可見性由公共 [Core 共用 contract](https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/7e8185177d7a8d58991bccd76d32bce2276e5f57/docs/PORT-ADAPTERS.md#shared-first-person-left-arm-request)擁有：`compose_first_person_arm_request` 同時處理有效 client-player 與 FP controller。OTC 不包含該兩個 owner 檔案，不新增 player 屬性、保存資料或輪詢；只有姿勢與短暫請求。未接入 helper 的獨立安裝不能宣稱空手左臂可見，來源合併也不會自動為既有安裝接線。

測試執行真生成器並擾動原左臂來源，確認左臂跟隨自己的資料、右側與其他骨骼不變；既有身體／端點正向計算仍保留。實際生成的 boolean／assignment expression 亦以相同 JavaScript 子集執行，驗證 FP／TP／VR／UI、兩手持物、時間邊界、未定義旗標及停止清除。這是來源與條件測試，並非原生 Molang 執行或 renderer 求值順序的證明。

`appliances.js`、洗盤取物／數量／取消／付款及 BP API 請求均未改，沿用 [0.1.20 原生 API 接受與 session 證據](validation/0.1.20-alpha.1/player-poses-native.json)，不為新 bone／Molang 字串重開同一 headless BDS。所選 client 對注入 clip → part visibility 的同幀傳遞、左臂落點、換視角與可見停止仍未觀察，不新增真人等待門檻。

## 可選光影模式的相容宣告

0.1.23 的 RP manifest 加入 `capabilities: ["pbr"]`，保留原最低版本 1.26.60，符合官方 [Vibrant Visuals 宣告要求](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/vvresourcepacks?view=minecraft-bedrock-stable)的 1.21.120 以上門檻。這讓要求所有 RP 明確宣告該模式的組合通過相容檢查，並非聲稱所有普通資源包都必須採用它。

本包保留原紋理，沒有新增 Texture Set、材質圖或全域光影設定；官方[反射／fallback 說明](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/reflectionscustomization?view=minecraft-bedrock-stable)允許沒有 Texture Set 的物件使用所選模式的預設值。實際反射、皮膚／物品與第一人稱畫面仍未驗證；這不是 PBR 美術完成或 client PASS。

## 互通與資料

| 原作能力 | Bedrock 路線 |
| --- | --- |
| 食物自動識別 | 未發布來源加入可選供應目錄：40 種原版＋森羅 67 種正營養食品，合計 490；秘製串、串盤、花椒按 Java 基礎營養各 1。另有 72 種飲品／282 個實際 ID，以明示的 Bedrock 擴充允許營養 0 的飲品進入訂單，僅沿用既有服務報酬。森羅共 139 種／425 個實際 ID，品質／呈現別名合併；每牌仍限 150 道。實際持有即可登記，其他 Addon 可自動發布供應資料，保留原管理員覆寫。完整清單、花椒手持食用與取得限制見 [FOOD-CATALOG.md](FOOD-CATALOG.md)，協議見 [FOOD-PROVIDERS.md](FOOD-PROVIDERS.md)。喜糖排除後為 470，仍不足 Lv.8 的 600，未宣稱新世界全部可取得。 |
| Java mod cooking integration | 共用既有ctx.smokingRecipes；已核對煙火烤雞翅／番薯，Server事件提供可撤回的供應目錄，輸入輸出須實際存在。只收單料smoking，烤架／調酒／鍋具留原製程。Farmer's Delight、Let's Do、其他Cookery煙燻及外部鍋具熱源尚待各供應端明確接入，詳見[配方契約](STOVE-RECIPES.md)。 |
| 自訂貨幣 | 可指定一個已安裝的物品作貨幣，每件一單位。沒有直接呼叫SDM數位帳本。 |
| Jade 顯示 | 改為看向設備的唯讀 action bar：包材／盤數、洗碗 phase、冰箱分區占用槽、爐灶進度。權限即時重新檢查；手洗優先一行，外送另一行；6 格視線、10 tick 更新，不是 Jade 原介面。 |
| 女僕、航空學等API | 沒有直接移植。需要對相應基岩附加包建立各自的協議。 |
| 多人資料 | 餐廳、設備與個人進度用固定 UUID 下的分片 world dynamic properties；冰箱實物在方塊原生 inventory，爐灶／載具使用實體 inventory。兩 buffer 最後提交 manifest；原生冰箱已開視窗不具有即時撤權保證。 |
| 跨版本／重啟 | 舊 81 格冰箱 helper 以 native moveItem 逐槽移入上下容器，未載入時等待且不重建空庫存；門姿態與廚電剩餘 tick 恢復。執行範圍見 [本輪報告](validation/0.1.5-alpha.1/CONTAINER_GUI.md)；歷史結果仍在 [VALIDATION.md](VALIDATION.md)，真客戶端卸載、手機及多人待驗收。 |

存檔分片保證單筆記錄切換完整快照；**世界磁碟、玩家背包、方塊庫存和實體庫存並不是可跨服務提交的同一筆資料庫交易**。目前同步操作預檢及回退能防止常見競態／扣物失敗，不能把它描述成任何強制斷電時刻都絕不丟失物品的保證。

領髒盤先保存不可重複領取的 claim，再寫入玩家背包。已知的同步寫入例外會回退；若程序恰在 durable claim 與物品寫入之間終止，可能損失該一個盤子。提前收盤的10 tick中斷進度由原生實體保存，未完成狀態另存於不可再發盤的待清理記錄，避免歷史裁剪或重啟把顧客恢復成舊進食動作。拆機時若舊盤位置未載入，餐廳維持移除中，暫停新營業與交易，待原錨點清理完畢。

## 直接生成與動作的源碼依據

固定提交的 [OrderNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java) 在 `spawnPreparedNpc` 直接定位並掛上座位；`findSpawnPosNormal` 無椅時呼叫 5 格範圍的 fallback。[WalkInNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/WalkInNpcManager.java) 無空椅即停止生成。[CustomerEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/entity/CustomerEntity.java) 設 movement speed 0、只加入看向玩家／隨機看向目標，並分開管理 idle 變體及特殊 action。完整數值與餐盤依據見 [UPSTREAM_RULES.md](UPSTREAM_RULES.md)。

站立堂食顧客原生計數60 tick完成action 4離場，盤子仍獨立到第100 tick變髒；這來自原作的放盤、完成動畫及餐盤 tick 三個獨立流程，並非移植新增的提前離場。原呼叫鏈與具體函式同樣記於 [UPSTREAM_RULES.md](UPSTREAM_RULES.md#十顧客餐盤與動畫的來源契約)。

## 後續驗收優先順序

1. Bedrock 26.60 真 Player 確認冰箱原生開啟／入口取消、兩人同櫃、移物與拆除，並測鍵鼠／觸控／手把；已開容器即時撤權列為引擎限制。再跑完整生存循環與兩人同時裝盤／打包／取貨。
2. 對照Java固定視角核對所有家具方向、UV、盤面與顧客姿勢。
3. 調校載具碰撞與輸入、完成手機／控制器操作及跨區塊重啟測試。
4. 實機比對餐盤放置與全部階段、7 個顧客 action、打單機／外賣袋及有限取樣廚電動畫；核對修正後的 easing、機身變形、音效和粒子時序，再逐項建立其他基岩料理／貨幣包的聯動。

0.1.5-alpha.1 的原生容器與控制項執行結果見 [本輪報告](validation/0.1.5-alpha.1/CONTAINER_GUI.md)，不能由原生服務端探針推定 GUI 已驗收。歷史 alpha.3 交接入口為 [DOT_HANDOFF.md](DOT_HANDOFF.md)，完整舊基線在 [PLAYTEST.md](PLAYTEST.md)；[VALIDATION.md](VALIDATION.md) 保留舊版指紋及實際結果，均不可直接套用到本輪。


## 尚未發布：Order To Cook 專屬遊玩指南

保留原 `ordertocook:guide` 物品與合成配方，改用六章／十三分類／二十六篇教程的獨立三級導覽與三語文字；可由指南物品或打單機入口開啟，沒有改動 Cookery 作者指南。使用 `@minecraft/server-ui` 原生表單搭配已存在的本包圖示，故導航層級與章節佈局類似 Cookery，但不是相同書頁 renderer 或像素級復刻。新來源的自動化驗證不得替代 Windows／手機與真實客戶端的字體、圖示及返回流程驗收。參見 [GUIDEBOOK.md](GUIDEBOOK.md)。
