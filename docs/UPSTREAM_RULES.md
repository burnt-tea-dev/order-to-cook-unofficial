# 上游規則與移植契約

## 核對基線

本次實作對照 **breezeth-CN/OrdertoCook 的 main 提交 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`**，提交日期為 2026-08-24 UTC。主要規則來源為 Forge 1.20.1 目錄；[版本檔](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/gradle.properties)標記 **1.3.7a**。[CurseForge 項目頁](https://www.curseforge.com/minecraft/mc-mods/order-to-cook)在 2026-10-09 查閱時的公開正式檔為 **1.3.6，2026-08-12**。因此這份移植的程式規則基線比公開 1.3.6 發行檔更新，沒有宣稱已逐幀比對該 JAR。

授權基線為上游 [LICENSE.txt](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/LICENSE.txt) 的 GNU GPL v3。上游 README 也聲明程式碼使用 GPL v3；檢查目錄後未發現另外的素材授權排除文件。本移植保留上游作者 breezeth、來源及修改聲明，派生程式使用 GPL-3.0-only。發行包不含上游 Java JAR。這是非官方基岩版移植，與上游 Java 模組分別維護。

本文件描述目前[配對manifest](../runtime/BP/manifest.json)所對應來源。領域規則由 `runtime/BP/scripts/core.js`、`config.js` 實作，世界配接由 `main.js`、`entities.js`、`dining.js` 及 `appliances.js` 處理。下文區分上游規則與有意適配；原版 GUI、玩家動畫、家電畫面、實體物理及模組聯動不能由純邏輯測試推定完成。實際驗證範圍以 [VALIDATION.md](VALIDATION.md) 為準，真實客戶端、表單與觸控仍待驗收。

## 一、餐廳與立牌

新餐廳是 **Lv.0、關閉營業**。立牌預設四種模板：熟豬肉 8、熟雞肉 6、熟羊肉 6、麵包 5，合計 **25 點營養**。菜單模板上限 150，按物品 ID 去重，每道菜只計一份營養，不會因持有 64 個同種食物而增加門檻進度。菜單設定是模板，不是消耗式食材庫。

原版在初次／綁定失效時，於機器水平半徑24的圓形、高度±8範圍選營養最高立牌；同營養取3D距離較近者，完全平手保留x、z、y掃描順序。有效綁定持續供應菜品，不因另一立牌更豐富就換牌。升級門檻與有效收益等級另用範圍內**單一立牌的最高總營養**，不是多牌相加，也不一定等於已綁菜單。0.1.32以 `restaurant.menu` 保存已綁菜品、`nearbyBoardNutrition` 保存最近可確認的單牌最高值；舊純核心資料缺後者時沿用菜單營養。Bedrock繼續要求owner／staff／範圍資格及已載入類型確認，不強制載入區塊，保留0.1.31的未載入綁定延後保護；未複製Java的200tick掃描快取。[本輪驗證](validation/0.1.32-alpha.1/BOARD_SELECTION.md)。

來源：[BoardBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/BoardBlockEntity.java#L35)、同檔 L142–181、L223–229；[OrderMachineBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L390) L390–435、L566–591。

### 等級表

「升級金幣」表示從前一級升至該級時一次支付的金額，不是累積收入門檻。完成訂單本身不會自動升級。

| 等級 | 升級金幣 | 菜單最低營養 | 每輪候選單 | 營養獎勵率 | 加急機率 | 到店判定機率 |
|---|---:|---:|---:|---:|---:|---:|
| 0 | — | 0 | 1 | 0% | 10% | 0% |
| 1 | 2 | 40 | 2 | 10% | 10% | 0% |
| 2 | 20 | 80 | 3 | 15% | 10% | 0% |
| 3 | 40 | 120 | 3 | 20% | 15% | 10% |
| 4 | 100 | 160 | 4 | 25% | 15% | 15% |
| 5 | 300 | 200 | 5 | 30% | 20% | 20% |
| 6 | 500 | 300 | 5 | 40% | 25% | 25% |
| 7 | 500 | 400 | 5 | 50% | 35% | 30% |
| 8 | 800 | 600 | 5 | 75% | 40% | 35% |

到店機率是在每 60 秒一次的到店嘗試中判定，並非每張一般訂單的機率。升級不刷新候選單，也不重置打單冷卻；原版已有的訂單仍按原刷新節奏替換。

移除高營養菜單後，已購買的餐廳等級保留；可享獎勵的有效等級會降到目前菜單支援的級別。候選單槽數與稀有度權重仍以購買等級計算。已接受的訂單報價固定，不因之後修改菜單而改價。

來源：[OrderMachineBlockEntity.java L130–137、L446–564、L774–794](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L446)；[ModConfig.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ModConfig.java) L8–38。

## 二、生成、接受與到期

一般候選在營業機器實際運作 **12000tick（20 TPS時600秒）**後刷新；進度保存，停業／停止模擬時不前進。普通單 **30 分鐘**到期，加急單 **10 分鐘**到期，**從生成時開始計時**；接單、打包、存檔重載都不會延長期限。到店顧客訂單固定為堂食、加急，期限從顧客到店生成時開始。

接下一張打單機候選單，就放棄同一輪其餘機器候選單。到店顧客是獨立來源，接受到店單不會清掉機器候選，接受機器候選也不清掉到店單。每輪槽數只限制可選候選數，不等於玩家最多可持有多少尚未完成的訂單。

| 品質 | 基礎權重 | 菜種上限 | 每種件數 | 基礎金幣 |
|---|---:|---:|---:|---:|
| 白 | 50 | 1 | 1–2 | 1 |
| 綠 | 25 | 2 | 1–3 | 2 |
| 藍 | 15 | 3 | 1–4 | 3 |
| 紫 | 8 | 4 | 1–5 | 4 |
| 紅 | 2 | 6 | 1–6 | 6 |

食物從去重後的菜單隨機取不重複種類，實際菜種數不超過菜單大小。上游在菜單池為空時回退為蘋果；核心保留這個行為。上游營養 API 允許具有正營養值的食物，並沒有額外把腐肉、河豚等排除；菜單管理者自行決定是否供應。

高等級給紫、紅色增加**抽籤權重**，不是直接增加最終百分比：

| 等級 | 最終預設權重：白／綠／藍／紫／紅 |
|---|---|
| 0–2 | 50／25／15／8／2 |
| 3 | 50／25／15／13／4 |
| 4 | 50／25／15／13／5 |
| 5 | 50／25／15／16／5 |
| 6 | 50／25／15／18／7 |
| 7 | 50／25／15／28／12 |
| 8 | 50／25／15／28／22 |

例如 Lv.8 紅單實際機率是 22/140，而非 22%。若配置關閉某稀有品質的基礎權重，高等級不會把它重新啟用。

生命周期為 `offered → accepted → packed → completed`。尚未完成的訂單可過期或取消；終態不能再次領款。剛好等於 `expiresAt` 的操作已屬過期。配接層必須完成所有權、食材、供應物品、承載物身分與交付位置的核對，才呼叫相應成功轉移。

來源：[OrderGenerator.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderGenerator.java) L30–142、L156–198、L274–321；[OrderMachineScreenHandler.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/screen/OrderMachineScreenHandler.java#L152) L152–205；[ModConstants.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/ModConstants.java#L57) L57–78。

## 三、配送、報酬與小費

一般單有 30% 為外送，外送之中再有 10% 是超遠距離。兩個判定相乘，所以基礎條件下約 3% 的一般單是超遠外送。短途半徑 50–450 格，超遠半徑 1500–3000 格；角度均勻隨機、半徑均勻隨機，之後四捨五入為整數座標。這不是面積均勻取樣。

原版會嘗試避開海洋／河流，並在玩家靠近、區塊載入後安排配送顧客。純核心只負責候選座標，不執行地形或載入區塊探測；這些是遊戲配接層的責任。

預設報酬公式：

```text
基礎額 = 品質基礎金幣 +（加急 ? 3 : 0）
配送額 = 外送 ? ceil(基礎額 × 配送倍率 × 等級倍率) : 基礎額
營養額 = ceil(Σ(每菜營養 × 要求件數) × 有效等級營養獎勵率)
訂單報價 = 配送額 + 營養額
交餐支付 = 訂單報價 + 本次小費
用餐結束另付 = 本次爆炸加賞（未中斷且原交餐玩家在線）
```

短途配送倍率為 1.8，超遠為 4。等級倍率在 Lv.0–4 為 1、Lv.5 為 1.3、Lv.6 為 1.4、Lv.7 為 1.5、Lv.8 為 2；**短途與超遠都會套用**。營養額在預設規則中最後加上，不參與配送倍率。上游另有預設關閉的 VanillaEraFaresChron 相容選項會改變此公式，本核心沒有實作那個 Java 相容模組。

小費機率：普通單 10%、加急單 50%、彩蛋顧客 100%。成功後一般天氣小費為 1–3 枚，下雨為 3–5 枚，端點皆包含。小費只結算一次，並包含在餐廳收益排行。正常天氣／一般顧客是未提供環境資訊時的預設值；配接層可提供 `raining` 與 `easterEgg`。

貨幣面額為 **1、5、20、100、10000**，對應 `ordertocook:chef_coin_N`。上游也支援自訂實物貨幣及額外的 SDM 數位貨幣相容功能；本核心提供金額及面額分解，不把累積收入當成可花費錢包。

餐盤進食的原版額外效果：一般椅上顧客 10%、彩蛋顧客 60% 出現「好吃到爆炸」，並另加 **1–4＋實際餐廳等級**的金幣，不使用菜單不足時降低的有效收益等級。alpha.2 已在 `rollCustomerCompletion` 保留此機率、加賞及動作選擇；配接層提供已選定並保存的 `easterEgg` 身份以使用特殊機率；目前來源已接入顧客選擇器，皮膚差異見[PARITY.md](PARITY.md)。這與一般小費是兩筆不同的計算項。

Java 的 `TakeoutBagItem.prepareBoomBonus` 先選定加賞，`CustomerEntity.tickServerAction` 在120 tick動作結束時呼叫 `grantPendingBoomBonus`。0.1.16已移除舊版提前付款差異；付款與保存細節由[用餐加賞](validation/0.1.16-alpha.1/MEAL_BONUS.md)負責。視覺效果不產生真正爆炸傷害或方塊破壞。

來源：[OrderGenerator.java L200–272、L323–427](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderGenerator.java#L323)；[TakeoutBagItem.java L352–465、L512–596](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java#L352)；[CustomerEntity.java L379–432](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/entity/CustomerEntity.java#L379)；[CoinUtils.java L29–48、L155–189](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/util/CoinUtils.java#L155)。

## 四、食材與廚房供應的上游規則

| 機制 | 上游行為 |
|---|---|
| 打包 | 消耗訂單要求的已做成食物及一份包裝供應 |
| 供應架 | 皮革補充，容量 10；並不是一張紙可直接代替皮革 |
| 裝盤 | 只允許非外送單，消耗一個乾淨餐盤 |
| 餐盤架 | 容量 18 |
| 食材搜尋 | 操作台內 12 個食材格，加半徑 24 的可用食材來源 |
| 供應搜尋 | 半徑 5 的包裝架／餐盤架，按距離順序提取 |
| 冰箱 | 是獨立外部食材來源，原版有雙格、128 堆疊等額外能力 |
| 洗碗機 | 最多 16 盤；進料 30 tick、洗滌 40 tick（超過 8 盤為 80）、出料 24 tick |

純核心的 `packOrder` 只變更狀態，不擅自消耗背包。遊戲配接層要先驗證全部物品，再執行可回滾的扣料與承載物建立。打包輸出保留原訂單 ID 及截止時間，不能靠換成外帶袋重新計時，也不能複製 ID 重複領獎。原版裝盤禁止外送；配接層也必須保留這個區分。

來源：[TakeoutBoxBlockEntity.java L64–196、L257–332、L378–437](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java#L378)；[ShelfBlock.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/ShelfBlock.java#L26)；[PlateShelfBlock.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/PlateShelfBlock.java#L29)；[DishwasherBlockEntity.java L41–46](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/DishwasherBlockEntity.java#L41)。

## 五、原版食品目錄來源

`VANILLA_FOODS` 的格式為 `[{typeId,nutrition,label}]`，包含 40 種有正營養值的基礎食品。營養值來自 [Mojang 官方 Bedrock samples 食物定義](https://github.com/Mojang/bedrock-samples/tree/46ba6ea985fb5a92d79a9419198f10dda14c199d/behavior_pack/items)，實際 ID 另與同提交的 [mojang-items.json 官方登錄表](https://github.com/Mojang/bedrock-samples/blob/46ba6ea985fb5a92d79a9419198f10dda14c199d/metadata/vanilladata_modules/mojang-items.json)核對，沒有把舊檔名直接當成現行物品 ID。

| 舊 sample 名稱 | 目前使用的基岩 ID |
|---|---|
| fish | minecraft:cod |
| cooked_fish | minecraft:cooked_cod |
| clownfish | minecraft:tropical_fish |
| melon | minecraft:melon_slice |
| muttonRaw | minecraft:mutton |
| muttonCooked | minecraft:cooked_mutton |
| appleEnchanted | minecraft:enchanted_golden_apple |

這 40 種各一份營養合計只有 **159**。因此僅使用此食品目錄且保留上游預設升級要求時，只能升至 Lv.3；Lv.4 需要 160，Lv.8 需要 600。未發布的 [可選食品目錄](FOOD-CATALOG.md) 加入 67 種正營養森羅食品，使完整目錄合計達到 **490**；秘製串、串盤與花椒均依 Java 基礎食品屬性計 1。喜糖活動已結束，扣除後為 **470**，另有初始食材取得缺口。這仍不足 600，不能透過別名、品質或堆疊重複計數補足。其他 Addon 可用 [供應介面](FOOD-PROVIDERS.md) 自動登記真實食品，不需玩家逐項執行管理員指令；原覆寫能力仍保留。基岩版不會自動繼承 Java 的食物註冊、Jade、女僕、SDM、Aeronautics 等模組 API。

另有 **72 種零營養飲品／282 個實際 ID** 接入供應目錄。Java 的 `Result.allowed()`、立牌與訂單池都要求正營養，這項 `servingKind: 'drink'` 支援是**明示的 Bedrock 擴充**。飲品的營養貢獻維持 0，既有基本服務報酬、急單與外送結算規則仍適用，不新增品質、酒精、熱度或調味倍率。每牌容量仍為 150；含原版共有 179 種可選範本，玩家選擇其中的菜單組合。來源方法與四款世界名酒後備甜點各 5 的 Java 核對見 [飲品來源查核](validation/UNRELEASED-drinks-source-audit.md)。

## 六、核心呼叫契約

事件紀錄仍使用Unix毫秒。正式期限輸入為`{wall: Date.now(), tick: system.currentTick}`，核心以保存的`expiresTick`判斷剩餘時間；其餘建立／完成時間仍記wall。純核心舊呼叫可傳毫秒，但含tick期限的訂單必須提供上述時鐘。餐廳與訂單均可JSON保存，核心不持有Minecraft物件。`orderRemainingMs`是唯一剩餘時間算法；`adoptOrderDeadline`只轉換尚無tick期限的舊單，按原剩餘毫秒向上取整至tick。

| 匯出 | 結果及副作用 |
|---|---|
| createRestaurant(spec, now) | 建立關閉的 Lv.0 餐廳；允許指定 id、name、owner、dimensionId、location、menu、config |
| generateOrder(r, now, rng) | 建立並**加入** r.orders，直接回傳 order |
| generateWalkInOrder(r, now, rng) | 同上，增加 source=walk_in、walkIn=true，固定堂食／加急 |
| refreshOrders(r, now, rng) | 取消舊機器候選，保留工作中訂單及到店單，產生新的候選；回 {ok,orders,nextRefreshAt} |
| acceptOrder(r, id, now) | 只接受 offered；接機器單會取消其他機器候選 |
| packOrder(r, id, now) | 只接受 accepted；扣料、供應與承載物由配接層管理 |
| completeOrder(r, id, now, options?) | 只接受 packed；回 {ok,order,reward,baseReward,tip,boomBonus,completion}；reward 僅含交餐報價與小費；boomBonus 是用餐結束前尚未支付的已選定加賞 |
| cancelOrder(r, id, now) | 取消非終態訂單，不退款或重新發食材 |
| expireOrders(r, now) | 回 {ok,orders,expired,failed}；orders 為本次過期清單、expired 為數量 |
| getUpgradeQuote(r) | 只讀：{ok,reason?,level,nextLevel,cost,requiredNutrition,currentNutrition} |
| upgradeRestaurant(r, now?) | 確認營養後提高等級；配接層須先同步驗證並扣除 quote.cost |
| synchronizeOfferRewards(r) | 依目前菜單重算尚未接受單的有效獎勵 |
| splitCoins(amount) | 回 [{typeId,amount,value}]，配接層處理物品最大堆疊 |

`completeOrder` 的可選參數為 `{rng,raining,easterEgg,customerSeated}`。未提供前三者時使用 Math.random、一般天氣與一般顧客；`customerSeated` 必須由遊戲配接層明確核對。提供此布林值時，核心保存 `completion = {startedAt,finishAt,action,boomBonus,clock:"loaded"}`；堂食另保存 `order.meal` 供餐盤與顧客恢復。未提供 `customerSeated` 的純核心呼叫保留 alpha.1 的相容契約，不另抽顧客動作或爆炸加賞，不能以省略資訊推定坐姿堂食。

成功後 `order.reward` 保留原報價，`order.paidReward` 記錄實付，`order.tip`、`order.boomBonus` 分別記錄小費與加賞。正式交餐配接在修改前確認目前 canonical 餐廳記錄、顧客、位置、有效承載物 proof 及餐盤位置空缺，並以可回退流程協調狀態與物品；交餐不因 UI 重試或重載再次付款；用餐加賞的獨立待付狀態只可結清一次。接單、設備管理及收盤另有店主／員工權限；目前交付按有效實物身份允許持有人代交，不能把撤銷員工權限描述成自動作廢其持有的有效餐點。

`restaurant.stats` 包含 completed、delivery、longDistance、earnings、failed，以及 walkIn、deliveryEarnings、maxDeliveryDistance。failed 是本移植新增的觀察值：已接受／已打包後取消或到期計一次；未接候選過期或刷新淘汰不算失敗。

## 七、有意的平台差異與驗證界線

1. **時鐘與範圍**：0.1.19起，訂單期限依原生`system.currentTick`世界總tick保存，關服不倒數；伺服器運行時，即使離開區域，訂單仍會到期。新實物包裹另保存`ordertocook:expires_tick`，歷史裁剪後仍可獨立判斷食用；舊資料第一次接觸時接續舊剩餘時間。0.1.18起，餐盤／顧客反應按各自原生區域模擬tick，停服及區域停止模擬不補算。打單機刷新與到店間隔改由原生機器運作callback累計，刷新進度保存、到店等待保持暫態；其同QA原生保存／重啟及離區停止／恢復11項已通過、短於20tick的卸載／重載仍未確認，見[機器計時](validation/0.1.21-alpha.1/MACHINE_TIMING.md)。見[訂單期限](validation/0.1.19-alpha.1/ORDER_DEADLINES.md)。
2. **報價重算時機**：Java 在開啟打單界面時降低有效利益；核心在生成、接受及明確同步時處理，避免配接層忘記 UI 回調造成高報價。恢復菜單後可重新提高仍未接受的報價。這比上游只在低於實際等級時重算的 UI 行為更一致。
3. **隨機序列**：選菜與機率分布相同，但 Java RandomSource 與 JavaScript RNG 不追求逐 seed 相同的序列。
4. **虛擬營養**：每張單會快照菜品營養，已接受單不因之後修改註冊資料而變價。
5. **世界操作**：地形找位、顧客與椅子關聯、物品交易、動畫、洗碗、騎乘、完整排行榜呈現不屬於純核心。上游提供的 Java 相容 API 也需逐項重建。
6. **一次領款保護**：核心保證同一持久狀態中的訂單只能 completed 一次；存檔持久化失敗、玩家背包例外、伺服器在付款中止等跨系統交易，仍需配接層處理，不能只靠領域測試宣稱全面安全。

`tests/core.test.js` 覆蓋等級 0 起步、模板去重、菜單 159 點限制、權重正規化、最大訂單量、獎勵先後順序、遠近配送、候選互斥、到店單獨立、時間保留、禁止跳過狀態、重複完成、到期邊界、取消終態、刷新保留工作、菜單降利益、報價鎖定、八級成本、設定門檻、小費端點、JSON 重載、無效時鐘與貨幣分解；顧客完成動作和加賞另有對應回歸。各版實際數量及執行結果見 [VALIDATION.md](VALIDATION.md)。這些測試不能替代 Windows／Android 的畫面、表單或多人互動驗收。


## 八、背包交易驗證

`inventory.js` 的找零交易會複製玩家全部背包格，在記憶體中模擬原幣扣除、相容堆疊及空格安排。全部找零放得下才驗證即將寫入的原始格，並同步提交；寫入途中出錯會反向回復已嘗試寫入的格。找零不會丟到世界地面，因此背包沒有足夠空間時可安全拒絕整筆付款。

同類物品合堆使用官方 `ItemStack.isStackableWith`，保留自訂名稱、說明與物品資料；一般扣料會先彙總重複要求，去重相同容器並確認所有來源，缺少任一食材就不開始扣除。

`tests/inventory.test.js` 透過最小 ItemStack／Container 配接模擬執行正式 helper 函式，涵蓋重複容器與要求、缺料零寫入、無效數量、來源變動、扣料寫入前後故障回復、物品資料保留、負數扣物、混合面額、滿背包使用已釋放格、找零無空間、零額／不足額、找零寫入前後故障回復，以及一般獎勵的最大堆疊。執行結果不與舊版本數量混算。

這是單一 JavaScript 呼叫內的可回滾交易，不是跨世界存檔、背包存檔和伺服器斷電的資料庫交易。如果容器失效到連回復都不能寫入，程式會記錄錯誤；實際跨存檔一致性仍需遊戲環境驗證。

## 九、存檔分片與失敗回復

`store.js` 將每間餐廳及每個工作站的 JSON 按 UTF-8 位元組拆成最多 30,000 bytes 的字串；切點使用 Unicode code point，保留中文字及 emoji。大型菜單和進行中的訂單可以跨多個屬性保存，不會因單一字串的長度上限拒絕正常遊戲資料。餐廳仍保留所有 offered／accepted／packed 訂單，並保留最後 12 筆終態歷史。

每個記錄有 `a`／`b` 兩組分片。保存時先寫入目前未使用的一組，全部成功後，才用一次根屬性寫入切換 `{__otcParts:true,id,buffer,parts}` manifest；成功切換後清除舊組。寫到一半的片段不會被讀作有效存檔，清理舊片段失敗也不會回滾已成功的新記錄。舊版單一 JSON 屬性仍可直接讀取，下一次正常保存才遷移。

若新快照尚未提交就出錯，canonical Map 會以最近一次成功保存的 JSON 重建物件，避免未保存的變更繼續影響遊戲。持有舊物件的非同步選單必須重新確認 `getRestaurant(id)`／工作站記錄的物件身分。無法解析、manifest 不完整或身分不一致的根記錄會保留原始資料並拒絕保存及刪除，交由恢復程序處理。

餐盤的 `pendingDishes` 與終態訂單歷史分開保存。即使完成單超過保留上限，未領髒盤仍存在；提前收盤時，已claim記錄保留至原生action 7完成其10 tick計數，期間只恢復顧客中斷動作，不能再次給盤。收盤同樣重驗 canonical 物件身分，保存失败後的舊 UI／舊餐廳引用不可再操作。

餐盤 helper 的 entity ID 只是顯示索引，唯一 token 與持久記錄才是領取依據。載入後清理多餘／無主顯示實體，未載入的錨點先等待。餐廳拆除若需等待舊盤位置載入，保留移除中狀態，期間拒絕重開、取得新餐廳操作及新交易，直到清理完成。

領盤先保存 durable claim，再向原生背包給物；已知同步寫入例外會回退，無法確定世界掉落回執的失敗保留 claim。若程序在保存 claim 後、實際給物前突然中止，可能失去該一個盤子。這是跨存檔原子性缺口，不能把防重複領盤聲稱成任意強制中斷都不丟物。

`tests/store.test.js` 以動態屬性配接器直接執行正式 store，涵蓋舊資料遷移、150 菜的多 byte 自訂資料、32 筆有效訂單與 12 筆歷史、分片及 manifest 中斷、重載、重試、清理失敗、寫入已提交後的例外、序列化失敗與記憶體快照回復、壞資料封鎖，以及刪除順序；`tests/dining.test.js` 核對餐盤生命週期及領取失敗。這個協定提供同步屬性寫入過程的完整快照切換，不能推論成背包、實體與世界磁碟之間的共同交易保證。

## 十、顧客、餐盤與動畫的來源契約

### 顧客直接生成、空椅與站立 fallback

上游 `OrderNpcManager.findEmptyChair` 搜尋水平圓形半徑 24 格、Y±8 格，`spawnPreparedNpc` 直接設定位置並掛上座位。普通餐廳顧客在 `findSpawnPosNormal` 無椅時呼叫 `findFallbackPosNearMachine(machine, 5)`；`WalkInNpcManager.spawn` 沒有椅子便返回失敗。`CustomerEntity.createCustomerAttributes` 的 movement speed 為 0，`registerGoals` 僅加入看向玩家及隨機看向目標。因此直接安排顧客符合原作，沒有「尚待補回的預設入店尋路」。基岩版搜尋限制於已載入位置，站立地形以有上限的候選及短支撐射線檢查，未聲稱所有 Java 地形判斷逐點一致。

來源：[OrderNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderNpcManager.java) 的 `findEmptyChair`、`spawnPreparedNpc`、`findSpawnPosNormal`、`findFallbackPosNearMachine`；[WalkInNpcManager.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/WalkInNpcManager.java) 的 `spawn`；[CustomerEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/entity/CustomerEntity.java) 的屬性、goals 及 `rollWeightedAnimationVariant`。

站立／坐姿 idle 各 4 個變體，權重為 55／15／15／15；基岩版以 `animation_variant` 1–4 單獨同步，與 action 無關。action 0 表示無特殊動作，其餘對應如下：

| action | 原動作 | 時長 |
| --- | --- | --- |
| 1 | sit_spawn | 12 tick |
| 2 | stand_spawn | 12 tick |
| 3 | sit_take | 40 tick |
| 4 | stand_take | 60 tick |
| 5 | eat_boom | 120 tick |
| 6 | eat_scale | 110 tick |
| 7 | interrupted | 10 tick |

名義時長來自 `CustomerEntity` 的常數及 completion animation 選擇。基岩版從服務端已保存的毫秒時序決定結束，每 5 tick 取樣；客戶端重載可能從當前片段開頭播放，未實作 mid-save 動畫 seek，原離場期限不延長。

### 餐盤進食與提前收盤

`FoodPlateBlockEntity` 的門檻為 15／60／80／100 tick，即正常 20 TPS 下 0.75／3／4／5 秒。前段是共用 stage 0，之後十種型號各有 1–4 階段，實際 state 為 `(型號 − 1) × 4 + 階段`。到 100 tick 時內部 stack 改為髒盤、停止進食計數並留在原位置，沒有定時自動返還背包。`FoodPlateBlock.use` 提前點取改給髒盤，並在 `new AABB(platePos).inflate(3)` 中按原查詢順序找到第一位 action5／6／7 顧客重新開始10tick中斷；不限定為該盤訂單。`onRemove`只掉盤，不中斷。

來源：[FoodPlateBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 的 `startEatingSequence`、`tick`、`stageForPhase`；[FoodPlateBlock.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java) 的取盤／中斷處理。

`TakeoutBagItem.submitDineInWithPlacedPlate` 只按 `FoodPlateItem` 判斷是否放盤，不要求已坐下；`resolveCompletionAnimation` 才讓站立顧客選 action 4。因此站立堂食顧客約 3 秒離場，盤子仍獨立到第 5 秒變髒，這也是原作呼叫鏈的結果。[TakeoutBagItem.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/item/TakeoutBagItem.java) 的 `placeSubmittedPlate` 則啟動獨立餐盤序列。

0.1.18以原生實體timer／保存property計顧客反應，以餐盤原生onTick及`ordertocook:food_tick:<meal token>`保存食品進度。餐廳記錄的`reactionPending`維持已領餐盤的未完反應；完成回呼才結算及清理。舊毫秒記錄第一次讀取時接續舊進度，之後只用保存計數；原本已到期的舊中斷claim可直接清理。中斷另一桌不改其食品計數。見[計時範圍](validation/0.1.18-alpha.1/LOADED_MEALS.md)。附近查找及原生端點語義由[鄰桌收盤](validation/0.1.17-alpha.1/NEARBY_PICKUP.md)負責；方塊兩層碰撞與階段資源由[原生餐盤](validation/0.1.15-alpha.1/NATIVE_PLATE.md)負責。`pendingDishes`仍是唯一領盤來源。

### 家電關鍵姿態

冰箱上下庫存與觀看者獨立，每門 11 個姿態（frame 0–10），從原 `up_open`／`down_open` 的 0–1 秒線性取樣，關門反向播放同一組姿態。櫃體分為兩格，整扇下門保留跨過 Y=16 的形狀；少數中間角度最多平移 0.125 像素以符合 Bedrock 邊界。原機身關門擠壓／回彈與內部食品顯示尚未移植。

洗碗機保留 empty_in 14、dirty_in 30、washing 40／80、clear_out 24 tick 與 16 盤容量。4 個活動 phase 各 16 姿態，加 idle／clear_ready，共 66 個。保留剛體門／抽屜運動、盤子均勻縮放及洗滌抖動，省略非均勻機身 squash/stretch；`empty_out` 準星預覽未接線。設備每 2 tick 更新，姿態由儲存的 phase／剩餘 tick 計算，不能把有限取樣聲稱成連續 GeckoLib 渲染。

來源：[refrigerator.animation.json](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/assets/ordertocook/animations/refrigerator.animation.json)、[dishwasher.animation.json](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/assets/ordertocook/animations/dishwasher.animation.json) 及 [DishwasherBlockEntity.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/DishwasherBlockEntity.java)。完整材質、geometry 與 helper 限制見 [ASSET_PROVENANCE.md](ASSET_PROVENANCE.md)，實際操作差異見 [RUNTIME_ADAPTATIONS.md](RUNTIME_ADAPTATIONS.md)。



### 餐盤破壞與滿包回收

固定來源[FoodPlateBlock.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)繼承BaseEntityBlock，沒有餐盤重力。`use`在背包放不下時生成ItemEntity；`onRemove`在移除餐盤且仍有內容時掉回一份，進食中轉為新髒盤，離地速度Y0.1。拆掉下方桌面不應被當作新增餐盤重力的理由。

原 `use` 的提前點取會中斷顧客；`onRemove` 只掉物，不觸發該中斷。基岩版點取與原生方塊移除共用不可重領的claim，但僅點取走提前中斷；滿包轉原生世界掉落，打破一律落地，保留店主／員工權限。拆餐廳同樣生成普通可堆疊髒盤，不寫入不受支援的ItemStack動態屬性。已生成後的未知失敗不盲目重試，仍有原來跨世界資料／物品原子提交的限制。原生方塊採原兩層碰撞與穩定階段模型；選取框用外接長方體。當前[原生與重啟範圍](validation/0.1.15-alpha.1/NATIVE_PLATE.md)不等於客戶端聲畫驗收；0.1.14的實體回收結果只作歷史。


### 訂單期限的原作依據

固定提交的`OrderGenerator.java`以`world.getGameTime()`加上36000／12000 tick產生`ExpiryTick`，保留Unix毫秒欄位作相容。`OrderItem.java`的tooltip與inventoryTick優先使用世界tick，舊資料的`ensureExpiryTick`按剩餘毫秒向上取整轉換。基岩版對應`expiresTick`與`ordertocook:expires_tick`；完整原生及保存範圍見[訂單期限](validation/0.1.19-alpha.1/ORDER_DEADLINES.md)。
