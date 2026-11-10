# 可行性與原作還原對照

## 受阻台面的打包掉袋（0.1.52）

PACK 與 PLATE 分開處理輸出。打包時上方為空氣，沿用原展示方塊與原生實物格；上方已有方塊或另一份餐點時，保留原物件，將同一 `parcelFor` 完整袋子掉在操作台中心上方 1.2 格，清除隨機初速再給向上 0.2 的原生 impulse。外送與明確選擇的堂食袋均適用；裝盤仍需空位。介面文字跟隨兩種操作，不再一律顯示台上受阻。

這與固定 Java 的 [Forge PACK](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java)及[NeoForge PACK](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java)同分支。沿原權限、期限、proof、食品抽取及 `countertopConsumeLeather` 設定；同一訂單只完成一次。掉落／速度設定的已知失敗走原交易回復，只移除本次新掉落物或新展示，不清除被擋住的原成品。未新增 timer、物品 ID、registry 或保存格式。

新增回歸直接走原 `countertopForm` 與正式 main/core/store/factory；確定失敗及可撤回掉落實體的補償由原生 I/O doubles 驗證，不表示原生跨儲存層原子性。尚未新增 BDS／客戶端掉落軌跡、聲畫或 FPS 結果。具體來源與測試見 [052 驗證說明](validation/0.1.52-alpha.1/BLOCKED_PACK_OUTPUT.md)。

## 已接外送單的壞地址恢復（0.1.51）

050 只為新單驗地形；已接／已備妥的海上單原本仍會重試原地址。051 在同一顧客重試 owner 中補上恢復：原目的地已載入且確定是水面或受阻、訂單尚未逾時、沒有顧客或保存 anchor 時，最多嘗試四個原短／長距離候選，只接受附近真玩家已載入的安全地面。沿每單至少 40 tick、每輪最多四單的既有重試，不新增 timer、registry 或強制載入。未載入不是水；既有顧客／anchor 不搬移。沒有找到安全候選就保留原待辦，原期限繼續計時，不宣稱所有海單都已恢復。

只在原 spawn＋save 提交成功時更新地址與顧客關聯，失敗走原回復。orderId、狀態、食品、proof、已接報酬、原距離報價、長距離分類、建立／接取／打包時間與兩種期限不重建。原袋直接沿正式交付 owner 扣物與付款，不能藉修復重置倒數、補發袋子或再次領款。

HUD／使用查看詳情讀目前 `order.destination`。外送袋在原 `onUse` 才讀回同一件現存物品，僅替換「座標行＋原 factory 操作提示」可辨識的自有 lore；名稱、其他 lore、DP、數量和完整 stack 保留。文字已正確、自訂 lore、過期／終態或已消耗的袋子不寫回。箱內未使用物品不掃描；紙單／自訂文字的靜態 lore 不會批量改寫，查看詳情與導航仍以目前訂單為準。

現有真 main/core/entity/store harness 覆蓋海水／阻塞恢復、四候選與原 cooldown、未載入／anchor／逾時不變、spawn／save 失敗回復，以及同袋更新自有行、走正式交付一次付款、晚到 callback 不復活袋子。Minecraft 邊界仍由既有 harness 替代，這不是新 Native／世界重啟／client 結果。這些來源回歸不改寫既有原生結果的範圍。

## 取消點擊後的設備互動（0.1.50）

菜單立牌與餐盤架共用的 before-event 入口原先先取消原生操作，再只在 `isFirstEvent=true` 時排程，因此 false 事件沒有管理選單／補盤動作，取消後的 custom component 也不能補接。現在每個已接管的設備點擊都交回原互動 owner，由既有三 tick 去重；權限、距離、主手讀回、餐盤扣取與保存格式不變。既有 main fixture 直接呼叫正式已註冊事件，涵蓋 true／false 的開選單與補一盤，以及重複事件／component 不雙扣。這是來源回歸，尚不代表使用者 client／正式世界已恢復。

同批來源亦包含以下修正；它們仍需由共同流程選入候選，不能以本表當作已安裝：

| 問題 | 本批實作與界線 |
| --- | --- |
| 音效太小 | 既有播放入口統一乘 1.2；音檔、音調、次數與時序不改。未宣稱已量測玩家聽感或 FPS。 |
| 爐灶按鈕列表 | 改為真七槽方塊容器，沿原權限認領、完整物品遷移及 200 tick 烹調；首次被攔住後提示再點。操作及 Java 專用槽位／進度條差距見 [原生容器](NATIVE-CONTAINERS.md#原生七槽爐灶)。 |
| 顧客站在設備頂面 | 非入座的站立顧客不採 OTC 設備表面作地板，保留原椅子入座及載具支撐規則。 |
| 外送目標在水面／找不到顧客 | 首次開業、手動刷新與原生機器 tick 共用地形解析；每筆新外送單最多嘗試 4 個原距離候選，每處只看附近已載入表面及完整站立空間。水面、水下空隙或受阻位置不發單；未載入仍是未知，延至下一輪，不耗新單 ID、不印紙或播放新單成功音。手動操作才提示原因，自動刷新不洗聊天。不加強制載入、計時器或持久地形快取；既有已接／已備妥目標與 proof、已生成顧客不搬移。舊海上壞單仍保留，沒有假稱已遷移。 |
| 創造物品混雜 | 編輯來源由 `tools/convert_assets.py` 產生原生分類目錄：建築頁放置物架／座椅，裝備頁放載具／頭盔，物品頁分餐廳設備、餐盤外賣、訂單、廚師幣及指南。內部展示方塊隱藏，真餐盤物品與保存 ID 保留。三語名稱及排序有來源／生成回歸，不代表客戶端分類畫面已確認。 |

## 結論

Order To Cook 的訂單、菜單、等級、餐盤及設備狀態均能以 Bedrock 行為包、資源包及穩定 Script API 重寫；原生冰箱與爐灶另需啟用 Upcoming Creator Features。原作已有 GeckoLib／Blockbench 格式資源，因此能保留大量原模型、UV、紋理及聲音；跨平台主要成本在程式、介面與動畫驅動。

本文件對應 [package.json 的目前整合來源](../package.json)。冰箱改用 Bedrock 26.60 的上下獨立原生容器；爐灶改用原生方塊七槽容器，不再使用按鈕列表或手持直接投入，操作台支援持訂單直接製作與同頁缺料，洗碗機沿用批次操作並補強寫入失敗回退。使用 stable `@minecraft/server 2.11.0`／`@minecraft/server-ui 2.0.0`，不要求 Beta APIs。**完整一比一仍未達成**，原生爐灶缺少 Java 專用布局、燃燒／進度條及逐槽放入限制；冰箱與爐灶已開介面的即時撤權沒有可用 API。入口攔截、鍵鼠／觸控／手把及真實多人 GUI 仍需客戶端驗收。官方能力核對見 [NATIVE-CONTAINERS.md](NATIVE-CONTAINERS.md)，冰箱既有實測見 [0.1.5 驗證報告](validation/0.1.5-alpha.1/CONTAINER_GUI.md)，不將該歷史結果當作新爐灶 GUI 通過。

2026-11-05 原生 BDS 1.26.60.6 載入抓到 0.1.8／0.1.9 共用物品元件的 `onConsume` 註冊錯誤；兩版不適用遊戲交付。0.1.10 將此回呼只掛到具有 `minecraft:food` 的包裹；修正後固定來源已通過原生命令破壞、完整metadata及同一QA世界正常保存／重啟；具體範圍與原失敗見 [原生報告](validation/0.1.10-alpha.1/PORTABLE_NATIVE.md)，不以來源CI或fixture actor冒稱真人輸入。

本文件包含 alpha.3 玩法基線及 **已整合的視覺／音效修復**。本輪修正、離線對照與可重現測試見 [VISUAL_AUDIO_PARITY.md](VISUAL_AUDIO_PARITY.md)；alpha.3 的實機失敗記錄仍保留，不能由新來源測試推定已通過實機複驗。**完整一比一仍未達成**：Java 的 GUI、GeckoLib renderer、玩家動畫、物理與跨模組 API 仍有適配差異；已完成部分雲端 Blockbench 互動檢視，包括[顧客與設備抽樣](validation/visual-audio/blockbench-20261108/README.md)及[40階餐盤、訂單機與袋子有限姿態](validation/visual-audio/blockbench-20261108/stage-review/README.md)；仍未完成全項視覺或 Java／Bedrock 客戶端畫面驗收。

基準：[官方作品頁](https://www.curseforge.com/minecraft/mc-mods/order-to-cook)，Java [e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。證據分層：源碼對照、單元／服務回歸、原生伺服器探針、客戶端驗收。前三者不能代替最後一層。

0.1.47 候選已將冰箱共同 root 修復凍結為新配對身份，讓上下兩個方塊使用同一樣本，仍由各自 frame 決定門角。四個 root × 44 個 door pose 共 176 模型，active lower close 覆寫 upper，包含中性樣本。原生排序、非原子寫入、STOP／反轉差異與視覺驗收仍未關閉，見[來源測試與量測](validation/fridge-shared-root/README.md)及[.47 配對身份與驗證](validation/0.1.47-alpha.1/FRIDGE_SHARED_ROOT.md)。

## 核心玩法

0.1.44 來源候選補上隨身紙單／外帶包的 5 分鐘、1 分鐘及逾時具名提醒，狀態保存在實體物品，不要求選中；新打包物不繼承紙單的提醒旗標。沿用每 20 tick 排程，通常比 Java 逐 tick 觀察晚不到 20 tick；一般背包最多 36 格，餐盤、掉落物及世界容器不走此提醒。保留紀錄會擋掉已完成／取消／已打包補印紙單；孤立紙單不提醒，自含期限的孤立包裹仍提醒，但不能重建已裁掉的完成／取消歷史。這些防舊物政策、臨時查表成本及保存／聊天非原子性都是明示適配，並非 Java 100% 等同。見[來源驗證與界線](validation/0.1.44-alpha.1/CARRIED_ORDER_ALERTS.md)。

0.1.43 來源候選補上餐廳命名收費：目前無自訂名稱免費，有名稱時每次確認（包含同名及清除）收 1 單位目前實物貨幣；清除後下次命名恢復免費。僅店主或本移植既有管理員覆寫可操作，普通員工不可改名。新舊 JSON／portable 的名稱區別、保存失敗退款及不可保證的原生交易界線見 [命名修復驗證](validation/0.1.43-alpha.1/RESTAURANT_RENAME.md)。此段不代表已發布版本或原生／客戶端驗收。

0.1.42 接上 Java 全域 `deliveryRate`，預設 `0.3`，僅接受 `0..1` 有限 JSON 數字。沿用 Server／創造模式／`otc_admin` 的 `ordertocook:config` 入口；Java 已核對的是啟動時讀取全域設定檔，不是假設兩端有相同 GUI。零讓未來打單機候選全為堂食，一讓其全為外送；普通到店單仍是堂食。首次開業、管理員刷新及原生 tick 生成都在 canonical 身分檢查後套目前全域值。新機器與 portable 還原直接繼承；舊存檔、部分餐廳傳播或日後保存回退留下的舊 config 在下次生成時覆蓋，不復活舊物件。設定本身不重抽／重定型既有候選、已接、已備妥或已完成單，不改 proof、期限、承載物。缺值／無效欄位安全使用預設且不重寫文件，損壞文件保留並停止初始化。

全域已提交、餐廳保存後續失敗時，仍以已提交值控制未來生成，不聲稱所有記錄一起原子提交。寫入後例外／讀回失敗可能保留新存檔但舊即時值，重載後才生效；.40 不確定原生結果界線與 .41 count-only 不遷移餐廳規則不變。未開放其他機率欄位，未改 core 取樣、機車或 NPC 生成，也未完成原生／客戶端驗收。[固定來源、紅綠測試及限制](validation/0.1.42-alpha.1/DELIVERY_RATE.md)。

0.1.40 接上 Java 全域 `countertopConsumeLeather`（預設 true）。管理員設定為 false 時，外送與選擇堂食袋的製作不查找／修改任何包裝架，食品與原生完整成品交易、權限、期限及 proof 仍核對；裝盤照常消耗乾淨盤。設定保存於同一世界屬性，表單關閉後才讀取最新值；缺值／錯誤型別安全預設 true，損壞文件保留而停止初始化。沒有新增每餐廳選項；該 .40 修正未接入機器數量或配送比例，機器數量與配送比例由後續修正分別補上。當時仍需台上空置的 PACK 限制已由 [0.1.52](#受阻台面的打包掉袋0152)補回；裝盤仍需空位。僅來源／adapter 驗證，非原生存檔、效能或客戶端驗收。[來源、設定與保存界線](validation/0.1.40-alpha.1/LEATHER_CONFIG.md)。

0.1.38 堂食打包來源修正：普通入口仍預設裝盤，蹲下點台可改選袋；canonical 訂單獨立保存 carrier 並與 proof 一起驗證。堂食袋保留堂食／到店報酬與統計，只走坐姿或站姿取餐，沒有用餐盤、髒盤或 boom。已備妥舊單缺 carrier 時按原 type 推定；擺放與交付不會把明確錯誤值降級為預設承載物。[來源、回歸與未驗證界線](validation/0.1.38-alpha.1/DINE_IN_TAKEOUT.md)。

0.1.37只減少最近餐廳查找與洗碗機視覺更新的重複世界讀取，沒有持久索引或權限／載入快取。正常選店、保存及加工不變；偶發cosmetic錯誤不再同回合重試，而在下一次正常更新重試。只證實來源API呼叫數，未測原生MSPT/TPS，#11性能仍未解。[數據與限制](validation/0.1.37-alpha.1/WORLD_READS.md)。

0.1.36只補到店的無可用已載入椅子分支：在任何實體配置前回報明確訊號，main僅從canonical餐廳撤回此次新單，仍保存已消耗序號／updatedAt及同tick刷新。舊pending與排程重試保留；其餘undefined／例外仍走原流程，不擴成不確定原生結果的刪單。不是完整admission／清理原子性或POI性能修復。[回歸與界線](validation/0.1.36-alpha.1/WALKIN_ADMISSION.md)。

0.1.35把普通機器訂單的已註冊椅子選取改為固定Java的x↑、z↑、y↓首合格順序，保留metadata過濾與首個合格即停止方塊驗證；到店顧客隨機池不變。未加入Java世界方塊掃描、顯式fluid／世界Y規則或heightmap隨機fallback，不宣稱完整生成還原、原生性能或客戶端驗收。[來源與回歸](validation/0.1.35-alpha.1/NORMAL_CHAIR_SCAN.md)。

0.1.34在機器計時器最終保存前核對餐廳是否仍為store的canonical物件，防止顧客保存失敗、回滾後又提交過期狀態。它保護最後成功提交的快照，不改一般spawn miss的pending／冷卻，也不保證整tick原子性。Java到店admission差異仍未解；沒有POI性能或原生／客戶端驗收結論。[回歸與界線](validation/0.1.34-alpha.1/CANONICAL_COMMIT.md)。

0.1.33補正到店生成／接單前置椅子範圍為水平24／Y±8，和顧客服務一致；到店顧客的空椅選取改為通過載入／佔用／空間驗證後等機率選取，不固定取最近。冰箱sphere／供應架cube不變。沒有POI性能結論或客戶端驗收；生成失敗時的訂單生命週期仍是分開的待辦。[驗證](validation/0.1.33-alpha.1/CHAIR_PARITY.md)。

0.1.32將選牌與升級／收益分開：有效綁定保留；初選與失效重選使用水平24圓形、Y±8，依營養、3D距離及Java掃描順序決定。另保存附近單牌最高營養，訂單菜品仍取已綁菜單，不合併多牌營養。權限與未載入保護維持，未整合POI。[來源及回歸](validation/0.1.32-alpha.1/BOARD_SELECTION.md)。

0.1.31補正菜單換綁與候選報酬變更的持久化，涵蓋閒置、取消／失敗升級及空菜單刷新；已綁立牌未載入時保留快照、延後相關操作，且不阻止已到期訂單先保存。選牌範圍／排序不變，未整合POI或宣稱性能改善。[驗證與限制](validation/0.1.31-alpha.1/MENU_PERSISTENCE.md)。

0.1.30獨立修正設備在認領前先驗餐廳權限，以及操作台兩種供應架的每軸±5立方範圍（含角落）；冰箱預設球形搜尋不變。保留既有供應架選取順序，未接入仍為Draft的POI路線或宣稱性能改善。[來源回歸與界線](validation/0.1.30-alpha.1/STATION_BOUNDARIES.md)。

| 原作特性 | 候選來源狀態 | 實作與差異 |
| --- | --- | --- |
| 拆除與重放 | 已實作並適配 | 立牌完整菜單快照、打單機原店主／員工／等級／全部統計隨掉落物保存；個人帳簿由原世界對帳，不複製到物品；重放不複製訂單、顧客或髒盤。兩種設備每格一個；原生命令破壞回呼、完整metadata及同QA世界重啟已通過；重放用fixture actor走正式adapter，玩家輸入未確認。見 [原生報告](validation/0.1.10-alpha.1/PORTABLE_NATIVE.md)。 |
| 立牌決定菜單 | 已實作 | 每牌最多150種；不耗材範本、按每道一份營養；在允許的附近牌中取最高營養單牌。 |
| 五階候選單 | 已實作並適配 | 刷新按營業中的原生機器tick累計並保存，暫停／停止模擬／關服不補算；同QA原生seed4／restart7及真離區停止／恢復通過，見[機器計時](validation/0.1.21-alpha.1/MACHINE_TIMING.md)。原權重50/25/15/8/2、菜種數與每種數量範圍、等級加成。不同平台亂數序列不逐位相同。 |
| 接單互斥 | 已實作 | 接打單機的一張後取消同輪其他普通候選，到店單獨立。 |
| 普通、加急、外送、遠距 | 已實作 | 36000／12000世界tick（20 TPS時30／10分鐘），關服不倒數；30%基礎配送、配送中10%遠距、50–450與1500–3000格等來源常數。 |
| 到店顧客 | 已實作並適配 | 到店等待按營業機器callback遞減，重新載入重起初始等待；20tick載入觀察間隔內完整卸載／重載未確認。按原等級機率判定；offered 就有可點顧客，必須有空椅。Java 本來就直接生成並入座，沒有需補回的預設入店路線。 |
| 普通顧客與座位 | 已實作 | 優先使用水平 24 格、垂直 ±8 格內空椅；沒有椅子時在打單機 5 格內找可站位置。顧客 movement 為 0，依上游直接安排位置。 |
| 訂單物品／包裹／餐盤 | 已實作 | 真ItemStack附餐廳、訂單和proof；存入載具保留元資料；核心狀態與獨立 carrier 防重複或錯誤承載物結算；堂食可用盤或袋，外送只用袋。 |
| 操作台取料 | 已實作並適配 | 取玩家背包與可使用的附近原生冰箱；持有效訂單直接裝盤／打包，空手同頁顯示菜名、數量、可製作／缺料；蹲下點台額外選擇堂食裝盤或打包。沿用完整需求、食品變體與交易核對，不照搬原 12 格 GUI。 |
| 真實擺放成品 | 已實作 | 在操作台上方生成原盤／袋模型；點取、蹲下擺放、破壞掉回有效成品。 |
| 菜品模型的逐段變化 | 已實作並適配 | stage 0 使用原放盤食物模型、材質與 0.5 秒 `maked` 動畫；按原生方塊計數第15／60／80／100 tick依次切換該型1–4階段。10 種 ×4 形狀由原像素 entity atlas 顯示，第 4 階段為髒盤。區域停止模擬及關服時不補算進度；保存後重開接續計數。 |
| 收盤與洗碗循環 | 已實作並適配 | 髒盤持續留在用餐位置，店主／員工點餐盤或下方桌面取回；打破餐盤及滿包回收時落地一盤；裝盤交付時同一位置先清舊盤；打包堂食不占用桌面，不留下髒盤。食品第100 tick前收盤同樣返一個髒盤，並按原生查詢順序中斷盤周圍方盒內第一位進食者約0.5秒；可能是另一桌，其食品進度保持原值。洗碗採點擊開始並保持空手／視線4秒；本包椅子／小電驢上不可洗，中途騎乘即取消。 |
| 8級餐廳 | 已實作 | Lv0起步、原成本／營養門檻；營養下降使收益福利降階，不退款已買等級。 |
| 金幣、小費及排行 | 已實作並適配 | 1/5/20/100/10000 面額、可回滾找零、多維統計；雨天由穩定 weatherChange 事件追蹤。「好吃到爆炸」加賞在顧客原生計數120 tick完成後另付；提前收盤按原作的附近查找中斷第一位進食者並取消其加賞；離線者不收個人幣／收益但餐廳照記加賞。舊版已支付餐點不重付。見[計時與付款範圍](validation/0.1.18-alpha.1/LOADED_MEALS.md)。 |
| 「好吃到爆炸」 | 已實作並適配 | 普通椅上堂食 10% 機率、加賞 1–4＋實際餐廳級別，使用原120 tick動作；不造成真實爆炸、傷害或方塊破壞。 |
| 特殊彩蛋人物 | 已實作並適配 | 原七人姓名／帳號／UUID、預設10%抽選、紅色姓名、特殊小費與60%驚喜動作已接入普通和到店訂單，選定後隨訂單保存，不在重生時重抽。網路玩家皮膚未移植，目前用已內附寬版外觀；原生聲畫尚未確認。普通顧客用原姓名名單、預設50%窄版比例。 |
| 原作進度 | 已實作 11／11 並適配 | 包內個人清單／通知，不是 Xbox 平台成就、不加獎勵。依實際交餐玩家累積結算；首單／加急／遠距、三個收益門檻、放置機器／洗碗機升級／八星／金牌均已接線。逾時包裹由原生食用完成事件解鎖，零營養／零飽和；新包裹自帶到期時間，訂單歷史裁剪後仍可食用。詳見 [PROGRESSION.md](PROGRESSION.md)。 |

## 新打單機的放置範圍

全域 `maxOrderMachinesWithin24` 預設 1，接受 signed 32-bit JSON 整數，依 Java `Math.max(1, value)` 將小於 1 的輸入保存／生效為 1；零不是無上限。設定 2 時，附近已有一台仍可放置，已有兩台便取消。Server／創造模式／`otc_admin` 沿用既有管理入口；普通玩家不能改設定。缺值／錯誤型別使用 1，損壞文件保留並停止初始化；重新載入保留有效設定，重設 1 只影響未來嘗試，不刪除、遷移或停用密集舊餐廳，也不重寫其記錄。

沿用 .39 幾何：其他機器的「舊位置減新放置位置」，每軸都落在 **[-24, +25]**（含邊界）才計入，不分店主／員工／管理員；自身座標不計。不是半徑 24 的球，也不是對稱 ±24 盒。每次直接讀最新全域值，不使用附近餐廳、店主或 portable 的 config。只遍歷當前 canonical 登記記錄，先篩同維度及座標，再讀仍為打單機的方塊，達指定數量即停；不排序、不快取、不掃描 125000 個世界格。較大上限可能讀取更多登記候選，這不是原生效能或 POI 改善的證據。

設備綁定／權限用的 `nearestRestaurant` 球形半徑 24、排序及權限保持不變；密集佈局可能改變共用設備選中的最近餐廳。未登記／未載入實體機器的探索仍未實作。取消仍在可取消的同步 preflight，保留 portable 完整原物品及移除日誌；沒有加入預約、退款或事後拆機。兩次 preflight 先於兩次完成回呼的合成排序限制仍存在，尚非原生已證實競態。設定寫入前失敗或靜默省略不改當前限制；寫入後例外／讀回失敗等不確定結果仍不保證原子性。[固定來源、紅綠回歸及未驗證範圍](validation/0.1.41-alpha.1/MACHINE_COUNT.md)。

## 設備、畫面及操作

粒子初始化的當前來源修復及驗證範圍見 [0.1.29粒子修復](validation/0.1.29-alpha.1/PARTICLES.md)；客戶端新日誌仍須與來源測試、舊BDS結果分開判讀。

| 項目 | 保留內容 | 已知差異／待驗收 |
| --- | --- | --- |
| 打單機／立牌／桌椅／架子 | 原模型紋理、朝向、容量可見狀態、音效 | 打單機改為完整 Geo 機身與原材質，16 個列印姿態加 idle／waiting 共 18 個；紙張依普通候選單持續顯示。各方向 UV 仍須實機確認。菜單及店主／員工／等級／統計已隨掉落物保存，見上方「拆除與重放」；放置座標識別仍不同於 Java 數字機器 ID。 |
| 外賣袋 | 完整原放置 Geo、專用材質、11 個姿態 | 原 0.5 秒放置動作逐 tick 取樣；既有方塊預設為完成姿態。區塊卸載時暫停，有限姿態的畫面節奏仍待實機比對。 |
| 洗碗檯水面 | 原 renderer 的 10×9 像素平面、Y=15.08、完整原 UV／alpha；0–10 盤世界狀態均包含，物品保留乾檯 | 為符合原生同方塊材質規則，世界材質全部改用 blend；兩面、透明排序、池壁／盤子遮擋及乾檯 item_visual 尚待原生客戶端驗收。[來源與測試](validation/UNRELEASED-washingtable-water.md)。 |
| 冰箱 | 上 27／下 54 格原生方塊容器、上下門獨立；蹲下空手點擊可整理目前那層 | 整理依 Java `RefrigeratorScreenHandler.compactRefrigerator` 的初次出現順序分組，僅合併 native 可堆疊物品並保留 metadata；寫入失敗回復已觸及格子。`native-fridge.test.js` 13項通過；BDS1.26.60.6首次7項、同世界重啟4項通過，真實cargo含名稱、lore、自訂資料、耐久與keepOnDeath。控制入口由實際adapter測試，未宣稱真人輸入或GUI畫面驗收。仍無食品限定槽、每格 128 件及內部食品陳列；原生容器已開啟時無法強制關閉。 |
| 洗碗機 | 16 盤容量、原 phase／時間、82 個門／抽屜姿態 | 批次存取失敗保留物品，補回非均勻機身變形、原盤數可見規則與 `empty_out` 預覽。預覽由合資格玩家共用方塊狀態，與 Java 每客戶端獨立預覽不同；旋轉子部件的剩餘剪切誤差與有限取樣詳見素材說明。 |
| 三槽爐灶 | 原生方塊7槽：0–2輸入、3燃料、4–6配對輸出；共用200 tick，保留實際產量、堵塞、換料重置與保存；15／5／8 tick獨立爐火 | Forge／NeoForge 原作確有七槽 GUI。目前交由 Bedrock 通用原生容器移物，沒有 Java 專用布局、燃燒／進度條、燃料限定或輸出槽放入鎖。首次互動沿原規則認領，若此次開啟被攔截則提示再次點擊；不再用按鈕列表或手持直接扣物。舊 helper 原生逐槽移入並成功保存後才退役，異常保留貨物。原版9條＋有效安裝時煙火2條，其他供應商沿既有smoking契約；爐火來源與其餘畫面限制見[來源驗證](validation/stove-ignition/README.md)。新七槽僅來源回歸通過，未宣稱 Native／客戶端 GUI 通過。 |
| 顧客 | 兩款原皮膚／骨架、等待與坐姿各 4 變體、7 個 action | idle 權重 55／15／15／15，完成片段後再選變體；action 按原生實體已模擬的tick定位，保留12／40／60／120／110／10 tick時長及保存進度；完成通知下一tick處理，原生測試中10 tick中斷至移除共13 tick；不下載網路皮膚。 |
| 用餐餐盤 | 原生方塊、原兩層碰撞、40個進食模型；stage 0沿用原食物與放盤短動畫 | 舊記錄及token保留，穩定階段舊helper會移除；點取／拆除走唯一領取記錄。Java 用餐中或完成後刻意回傳新髒盤；未交付成品的完整物品另見[展示餐點保存](#未交付的展示餐點)。選取框是兩層形狀的外接長方體，原作沒有重力。用餐部分見[原生餐盤](validation/0.1.15-alpha.1/NATIVE_PLATE.md)，不由服務端推定客戶端聲畫。 |
| 椅子／玩家動作 | 原安坐循環、拍手全身／前臂／足端轉換、手洗身體及獨立FP雙臂 | 原生整臂／整腿匹配分段來源的兩端；手洗FP補回臂長及肩端補位，拍手TP／FP分開，安坐保持同一身體高度。可見性仍須共享player/controller接線；單包不保證空手左臂。真肘／膝、Java ACTION絕對校準、Slim／客製骨架及可見姿勢／停止仍未完成或未確認。沒有player.json覆寫；目前範圍見[玩家來源與骨架](#玩家動作的來源與骨架)、[手洗FP](#手洗第一人稱左臂)及[安坐與拍手](#安坐與拍手)。[020](validation/0.1.20-alpha.1/PLAYER_POSES.md)／[013](validation/0.1.13-alpha.1/CHAIR_CLAP.md)原生證據保留原範圍，不回填新畫面結論。 |
| 小電驢 | 原Java模型、四車色、保溫箱、燈面、喇叭 | 原生載具物理及按鍵；現版未綁把手／前輪轉向，輪轉以無方向累積距離驅動，與 Java 的帶方向內部速度、倒車及碰撞語義不同，見[來源與GUI對照](validation/visual-audio/MOTORCYCLE_VISUAL_BINDING_20261108.md)。燈面發光但不照亮地形。原騎車自動頭盔屬玩家渲染層，本版未重建該層及完整玩家姿勢。 |
| 原始美術 | 67原PNG、12原OGG原樣保留；原geo／動畫正規化存档 | 保存未使用片段不等於其在玩法中已被觸發；動畫清單詳見ASSET_PROVENANCE。 |

## 未交付的展示餐點

操作台做好的餐盤／外送袋，以及玩家蹲下擺放的同一件成品，直接保存在展示方塊的一格原生 inventory。準備時只建立一次成品；擺放與取回使用 `Container.moveItem` 搬動完整 ItemStack，保留名稱、lore、自訂資料與原訂單 proof，不列舉欄位重建。訂單後來失效也可取回格子中的實物，交付仍由原訂單檢查決定。滿包保留原處；拆除／替換由原生容器掉出真物品，腳本不另造副本。

舊展示只有訂單連結，首次載入或操作時可一次轉入原先會回傳的成品；先前已丟的額外名稱等資料無法補回。`nativeParcel` 表示物品已交給原生 inventory；此後空槽就是空槽，包括其他移物入口取走後，不再憑舊連結造物。舊展示尚未轉入就拆除時，保留原來一次回收路徑。這是舊存檔採用，不是物品 ID 相容鎖或退休登記表。原生庫存與 world dynamic properties 仍不是跨儲存層的原子交易。

正常點取沿原腳本動作；before-event 取消原生容器介面。沿用冰箱已需的 [Upcoming Creator Features 與容器能力](NATIVE-CONTAINERS.md)，不新增模組依賴。Java FoodPlateBlockEntity 不公開普通 Inventory／ItemHandler。BDS1.26.60.6下方漏斗觀察40tick未抽取展示物品，同場普通箱子→漏斗正向對照成功；這只證明本次入口與設定，不能推成所有方向／版本的自動化結論。fixture actor不證明真Player介面取消。

原生容器所需的新方塊格式中，材質的 `ambient_occlusion` 必須用數字。生成器將原 false／true 等義轉為0／1，包含階段 permutations；[官方材質文件](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable) 明列1.26.20起不再接受布林值。0.1.24首次原生載入因此失敗，保留失敗證據；沒有改引擎或關掉檢查。

原作分界：[Forge 操作台](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/TakeoutBoxBlockEntity.java) 存放待取的成品 copy；[FoodPlateBlock](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)／[BlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 完整保存及回傳。顧客用餐後，提早回收／拆除及100tick完成都換新髒盤。[NeoForge1.21.1 Block](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)及[BlockEntity](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/main/java/cn/breezeth/ordertocook/block/entity/FoodPlateBlockEntity.java) 已分別核對相同分界。本次不改用餐髒盤流程，也不為原作本來就消耗的每件原料保存 metadata。

2026-11-06 正式 adapter 反例：正常製作並取走成品，用 [ItemStack nameTag／setLore／非堆疊 setDynamicProperty](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable) 加資料，再正常擺放取回。修前名稱、lore、自訂資料全失，修後餐盤及共用 adapter 的外送袋都保留；並驗證失敗回復、掉落不重建、舊展示採用及移物後不重造。這不是任意 NBT 或手造 BlockEntity 反例。[0.1.25原生證據](validation/0.1.25-alpha.1/DISPLAY_STACKS.md) 已核真ItemStack／native container、正式adapter取放、真destroy／ID替換唯一掉落、同QA世界正常重啟、空槽不重造及舊link採用。真Player輸入／GUI與client畫面不在本次範圍。

## 玩家動作的來源與骨架

本批反例、執行版本與來源檢查結果見 [0.1.26 驗證](validation/0.1.26-alpha.1/PLAYER_ACTIONS.md)。

目前共用 `tools/convert_assets.py::player_action_pose`／`player_limb_pose` 轉換洗盤、安坐與拍手。body根位移／縮放轉到native root；原head、手臂是torso的同級，native則在body下面，因此手洗先消除父torso變換，避免重算一次。native腿在root下；腿網格／pivot中心為±1.9，原rig為±2，已修正原先0.1像素的中心差。拍手／安坐使用原body下移2像素，前臂與foot的旋轉／位移參與末端目標。這是模型局部位置的轉換；沒有改玩家碰撞、椅子世界錨點或直接照抄Java世界高度。

兩組完整原rig一直保留在 `player-presentation.json.rig_references` 指向的RP檔案，由 `preserve_imported_geometry` 生成；classic與slim都是64×64皮膚UV，手臂寬分別4／3像素。兩者都有 `body → upper arm → hand` 與 `body → leg → foot`；其中 `hand` 是分段前臂。native參考骨架為 `root → waist → body → Arm/head`、`root → Leg`。因此不能直接替換Geometry.default：原rig的body是根，現native clip的body是胸部。保留rig檔案不代表它已成為玩家有效geometry；本次沒有切換geometry，rigid轉換仍以經核對的classic native骨架為準。

Java選定source與API版本查 [upstream鎖](../upstream/source.lock.json)。Forge1.20.1的實際全身入口是[LivingEntityRendererMixin](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/mixin/client/vehicle/LivingEntityRendererMixin.java)，在已完成vanilla父矩陣的model renderToBuffer處替換；其[RiderGeoRenderer.preRender](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/gecko/RiderGeoRenderer.java)另含X180／Y180、super、中心抵銷及依玩家身高／模式下移。NeoForge1.21.1則由[PlayerRenderer HEAD](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/client/java/cn/breezeth/ordertocook/mixin/client/vehicle/PlayerEntityRendererMixin.java)進[Bridge.renderIfAnimated](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/client/java/cn/breezeth/ordertocook/client/gecko/RiderRenderBridge.java)，洗盤先下移0.58、拍手／安坐下移1.125再作yaw／中心變換，其GeoRenderer沒有Forge的該preRender。兩分支已分別核對，不能把單一數字套到Bedrock來聲稱世界或鏡頭等價。

第一人稱兩分支皆由HeldItemRendererMixin按手別先做ACTION平移與X/Y/Z旋轉，再由RiderFirstPersonArmRenderer加ROOT_Y（−27/16）且只畫body及該手的兩節骨。校準值來源為[Forge FirstPersonArmCalibration](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/gecko/FirstPersonArmCalibration.java)及[NeoForge同類別](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/neoforge-1.21.1/src/client/java/cn/breezeth/ordertocook/client/gecko/FirstPersonArmCalibration.java)。本版仍用既有native空手鏡頭基準，不將這些Java常數假裝成已驗證的Bedrock投影。

共享顯示producer的唯一資料源是 [player-presentation.json](../player-presentation.json) 的 `first_person_arm_requests`；生成器由它取得各動作的旗標名。公共Core的[多request contract](https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/e8dbc451d307625d1859ac863b4299665449eb52/docs/PORT-ADAPTERS.md#shared-first-person-left-arm-request)接收這些values，每幀各自reset並OR入有效FP的leftArm／leftSleeve。各動作只清自己的旗標，不能用拍手stop抹掉另一個尚有效的request。整批producer何時採用新Core／descriptor由共享owner決定；來源合併不自動改既有候選或LIVE。

### 分段rig的接入邊界（2026-11-06來源查證）

所選025整批候選的有效owner仍啟用attachables；普通FP、TP及持槍副手FP均讀 `Geometry.default`／`Texture.default`。普通FP以 `rightArm`／`rightSleeve`／`leftArm`／`leftSleeve` 控可見性，TP還沿既有armor layer條件。原分段rig只有原作者骨名，沒有native的 `root`／`waist`、Arm／Item／Leg／Sleeve／Pants等骨名，也沒有locator。因此只把default改成imported rig，並不能同時保留原有姿勢、持物錨點及衣物顯示。這是已選輸入的來源結構差異，不是平台禁止分段骨架的證據；本版未做該切換。

所選官方[原生骨架](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json)保留 `rightItem`／`leftItem` 及lead locator。[原生胸甲attachable](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/attachables/iron_chestplate.player.json)另設 `chest_layer_visible=0`，使用[armor geometry](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/player_armor.json)的native body／waist／Arm等骨名；不能只看玩家皮膚網格。Java也須分支核對：上述Forge入口只替換base model的renderToBuffer；Neo則在自訂renderer成功後取消整個PlayerRenderer。所選兩分支RiderGeoRenderer只自加motorcycle helmet layer，沒有另加一般armor／held-item layer。這不等於已觀察兩分支穿甲實景，也不要求額外重做所有盔甲分節。

classic／slim的原rig與UV已存在，但自動選取仍需證據。[官方skin pack規格](https://learn.microsoft.com/en-us/minecraft/creator/documents/packagingaskinpack?view=minecraft-bedrock-stable)把 `geometry.humanoid.custom`／`customSlim` 分別當Steve／Alex；該metadata不是client_entity的slim query。所選[Molang參考](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/documentation/Molang.html)有bone_aabb、bone_origin、get_default_bone_pivot；skin_id則關聯實體skin_id component。有效owner目前沒有骨架／slim偵測，也未宣告queryable_geometry；官方[client schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_resource_definition.v1.10.0?view=minecraft-bedrock-stable)雖列出該欄位，尚未驗證這些查詢在所選玩家skin／取樣階段的值，不能直接拿它們決定粗細手臂，也不能由此斷言它們不支援玩家。

全身、前臂及分段FP的可重現生成與矩陣測試現已具備，見[來源原型與接入契約](PLAYER-RIG-PROTOTYPE.md)。classic與customSlim已各讀固定Mojang真基底，補償slim網格／樞紐／持物的半像素座標框差並保留其鏡射UV，不再共用classic只改寬度。它保留分段上下肢、下袖／褲、持物錨點及每手獨立view／body矩陣；參考相機框架明確傳入，未自動選native skin或校準Bedrock絕對相機。這些來源未進runtime，現行rigid姿勢不變。後續接入沿共同持有的Core／既有composer保留同一有效owner的default、皮膚與native骨名，再按實際動作選相容geometry；native自動選型／客製avatar、持物／armor與相機未核清前，不加入全域geometry替換、額外player覆寫或機器專屬玩法。

## 手洗第一人稱左臂

`make_player_handwashing_animation` 使用原left／right arm與hand的相對節拍。0.1.26修正FP原只旋轉／移位而未套臂長的差異：原右肩到手端11.183676像素、左11.161967像素，native整臂卻仍12。現在FP也套來源長度比例，並補償頂端位移以維持原鏡頭肩端。既有native空手旋轉基準、左右鏡射、blend gate與stop不變；TP只另修真native腿網格中心差。這仍不是Java ACTION絕對校準或分段肘關節。

有限四秒 FP clip 先直接寫入 `variable.senluo_fp_left_arm_request`，再回傳已賦值的同一條件作為實際 blend：第一人稱、非 VR、非 UI 預覽、主副手皆空，且 `0 <= query.anim_time < 4`。因此拿起地圖／副手物品到既有 server cancel 到達前，洗盤姿勢也會收回，不只關閉顯示請求。這擴充了 FP blend 條件，不能稱整個 FP 行為未變。既有 stop replacement／0.1 秒退場保留，stop clip 直接清零，不先讀取可能尚未定義的共用變量。

可見性由上節公共Core contract擁有：`compose_first_person_arm_request` 同時處理有效client-player與FP controller。OTC不包含該兩個owner檔案，不新增player屬性、保存資料或輪詢；只有姿勢與短暫請求。未接入helper的獨立安裝不能宣稱空手左臂可見。

測試執行真生成器並擾動原左臂來源，確認左臂跟隨自己的資料、右側與其他骨骼不變；既有身體／端點正向計算仍保留。實際生成的 boolean／assignment expression 亦以相同 JavaScript 子集執行，驗證 FP／TP／VR／UI、兩手持物、時間邊界、未定義旗標及停止清除。這是來源與條件測試，並非原生 Molang 執行或 renderer 求值順序的證明。

`appliances.js`、洗盤取物／數量／取消／付款及 BP API 請求均未改，沿用 [0.1.20 原生 API 接受與 session 證據](validation/0.1.20-alpha.1/player-poses-native.json)，不為新 bone／Molang 字串重開同一 headless BDS。所選 client 對注入 clip → part visibility 的同幀傳遞、左臂落點、換視角與可見停止仍未觀察，不新增真人等待門檻。

## 安坐與拍手

安坐沿原 `player_sit` 的4.5秒TP循環，拍手沿 `player_sit&clap` 的3秒片段。source body兩者都下移2像素；先接回安坐基底，再由拍手暫時覆蓋，結束重起安坐，避免只在拍手期間換身體高度。共用姿勢生成器保留source knot及20TPS取樣，包含不落在整tick的拍手轉折與非循環末幀；原foot移動也參與native整腿的端點近似。手洗／拍手都以完整肩手距修FP長度；真肘膝的輪廓仍未重建。

安坐loop只在自有chair啟動；同一既有服務tick清理離座／換成非chair seat的短暫外觀狀態。native stopExpression另在離開seat類型時停止。script重載及playerSpawn恢復已有安坐，不新增world DP、玩家property、持久ID登記或輪詢服務。拍手仍60tick、聲音仍0／12／20tick，不改顧客、交易、庫存或動作輸入規則；一個視角的動畫API失敗不阻止另一個視角或正常遊戲。

Java拍手可持物，兩分支HeldItemRendererMixin會取消原held-item繪製並畫ACTION雙臂。本版BP同樣不要求空手；目前只對FP姿勢使用「雙空手、非VR／UI、0≤時間<3」render gate，持物時保留native held-item畫面，TP／拍手session及聲音照常。這是尚未完全等價的渲染適配，不能寫成Java也要求空手。各視角各自的controller起停，拍手只清自己的request；空手左臂仍需上節多producer共享接線。新循環、圖層優先與可見停止尚未由真client觀察；原013服務端證據不冒充本批畫面證明。

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
| 多人資料 | 餐廳、設備與個人進度用固定 UUID 下的分片 world dynamic properties；冰箱與新爐灶實物在方塊原生 inventory，載具沿用實體 inventory；爐灶舊 helper 遷移未完成時保留原來源。兩 buffer 最後提交 manifest；原生容器已開視窗不具有即時撤權保證。 |
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


## Order To Cook 專屬遊玩指南

保留原 `ordertocook:guide` 物品與合成配方，改用六章／十三分類／二十六篇教程的獨立三級導覽與三語文字；可由指南物品或打單機入口開啟，沒有改動 Cookery 作者指南。使用 `@minecraft/server-ui` 原生表單搭配已存在的本包圖示，故導航層級與章節佈局類似 Cookery，但不是相同書頁 renderer 或像素級復刻。新來源的自動化驗證不得替代 Windows／手機與真實客戶端的字體、圖示及返回流程驗收。參見 [GUIDEBOOK.md](GUIDEBOOK.md)。
