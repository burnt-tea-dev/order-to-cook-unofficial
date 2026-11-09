# 冰箱內容物展示與取放：來源核對及資料保護

2026-11-09（香港）。起點為 `main@8008294306180ece040b908684bf4fa11afb75c8`；其版本為 `0.1.48-alpha.1`。Java 固定為 [`breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)，只以 **Forge 1.20.1** 的本次路徑作玩法基準。候選身份、最終提交與測試結果由下方本輪驗證欄記錄，不套用舊版本的通過紀錄。

**內容物展示仍未實作。** 本輪核對來源、正式 API 與既有證據，另處理舊儲物 helper 在拆除／孤立回收時的身份驗證缺口。沒有以掉落物、真實裝備副本或簡化 JSON 庫存補畫面，也不聲稱任意第三方物品已支援。所有本輪 BDS、Minecraft 客戶端、使用者電腦及 LIVE 操作均為 **NOT RUN**。

## 範圍與協作

已先讀 `AGENTS.md`、`docs/PARITY.md`、最新 main、開放 PR 及[既有展示契約](visual-audio/FRIDGE_ITEM_DISPLAY_CONTRACT_20261109.md)。該契約的數量、位置、根骨與 metadata 界線經固定 Java 來源再次核對，沒有發現需反轉的結論。

- 開放 [PR #80](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/80) 也修改 `appliances.js`，內容是 `updateDishwasherPreviews` 的空集合提前返回。本輪 helper 身份處理位於不同函式；檔案重疊仍須在整合時重查，不把不同 hunk 當成已完成跨代理協調。
- #80 使用 `0.1.49-alpha.1`；本輪採新的 `0.1.50-alpha.1` 配對身份以滿足既有建置守門，保留 UUID／API／引擎依賴。版本、manifest、baseline 及 append-only history 是另一組共用檔案；未合併 #80，整合時須保留雙方歷史並重新凍結實際合併 payload，不能直接沿用任一方雜湊。
- [PR #11](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11) 涉及 POI、`main.js`、`store.js` 與共用 harness；本輪不改這些檔案、不導入 POI。
- 不改凍結的舊證據、共用 PARITY／README、模型、紋理、動畫或第三方 item owner；新發現集中記於本文件。

## Java 每半展示的實際規則

[`RefrigeratorBlockEntity`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L53-L137) 有上半 27 格、下半 54 格；`getDisplayItems` 依各半槽位順序取前八個非空堆疊。中間空槽不佔展示位置；相同 ID 在不同槽仍分別展示；不於此階段再篩食品。每個記憶體顯示副本數量為一，沒有移動或減少真實庫存。

[`RefrigeratorRenderer`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/renderer/RefrigeratorRenderer.java#L19-L100) 的上、下限各為八；排序是壓縮後的展示序號，並非固定展示原槽 0–7，也不是按物品種類排序。

| 展示序號 | X | 上半 Y | 下半 Y | Z |
| --- | --- | --- | --- | --- |
| 1、2 | −0.24、+0.24 | 1.625 | 0.75 | −0.18 |
| 3、4 | −0.24、+0.24 | 1.3125 | 0.1875 | −0.18 |
| 5、6 | −0.24、+0.24 | 1.75 | 0.9375 | −0.18 |
| 7、8 | −0.24、+0.24 | 1.4375 | 0.375 | −0.18 |

這些是 **已置中的 renderer frame** 座標，不是方塊角落的世界偏移。[GeckoLib 4.8.3 `GeoBlockRenderer`](https://github.com/bernie-g/geckolib/blob/e81962eefd04e0cab90445d3df37b477d2767ffd/Forge/src/main/java/software/bernie/geckolib/renderer/GeoBlockRenderer.java#L145-L165) 先平移 `(0.5, 0, 0.5)` 再套朝向；其 `rotateBlock` 為北 0°、南 180°、西 90°、東 270°。其後還有根骨變換，不能只抄表格便聲稱 Bedrock 世界座標相同。

每件再依序平移、正 X 軸旋轉 60°、統一縮放 0.28，交給 Java `ItemRenderer.renderStatic` 的 `FIXED` context；使用傳入光照、`NO_OVERLAY` 及零起點展示序號作 seed。物品模型、tint、透明層屬 native item renderer，不來自冰箱貼圖。下半後四項的高度增量是 **3/16 block（3 model px）**；原註解的「+4px」不能覆寫實際數字。

## 動畫與內容更新

renderer 只在根骨 `bone` 畫內容。[Gecko `renderRecursively`](https://github.com/bernie-g/geckolib/blob/e81962eefd04e0cab90445d3df37b477d2767ffd/Forge/src/main/java/software/bernie/geckolib/renderer/GeoRenderer.java#L245-L256) 先套根骨、畫 layer，再畫 children，因此內容跟隨共同 root 與方塊朝向，不跟門片旋轉。

Java [`isUpperOpenForDisplay`／`isLowerOpenForDisplay`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L119-L137) 只檢查 state 非零。開門 state=1；關門 state=2、倒數 20 tick 完成才變零，內容在關門中仍提交渲染，不必等門全開。

四段[來源動畫](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/assets/ordertocook/animations/refrigerator.animation.json) 均為一秒、`hold_on_last_frame`，上／下門開啟終點為 −135°／−125°。兩個關門片段都寫 shared root；upper controller 先註冊、lower 後註冊，後者可覆寫前者的中性值。既有[共同 root 修復](fridge-shared-root/README.md)與 [.47 證據](0.1.47-alpha.1/FRIDGE_SHARED_ROOT.md)保留其有限取樣、STOP／反向播放和兩方塊非原子更新限制，本輪不重做此部分。

Java 一般 container 寫入／移除會經 `setChanged`／`sync` 發送 block update；[`getUpdateTag`／packet](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L433-L456) 重走下述簡化存取。已有門事件不能證明 Bedrock 新內容 renderer 已同步；亦不能將 Java 自動化路徑概括成每 tick 都同步所有物品。

## GUI、排序、自動化與資料保存須分開判讀

| 路徑 | 固定 Java 行為 | 本輪判斷 |
| --- | --- | --- |
| 食品判定 | `isAllowedFoodStorage`：自訂菜單營養大於零，或 `ItemStack.isEdible()` | 不是僅查 vanilla 食品，也不是等同 Bedrock 目錄。 |
| GUI 整理 | `compactRefrigerator` 按 `isSameItemSameTags` 分組，保留首次出現順序，每組拆成最多 128 件，僅整理開啟的那一半 | 現有 Bedrock 以 native `isStackableWith`／`clone` 保留 opaque data，並遵守 native `maxAmount`；不強塞 128。 |
| GUI 快速移物 | 先合併相同 item+tags，再找空槽；存入先驗食品；取到玩家遵守其目標槽上限 | 原生 Bedrock GUI 輸入仍由引擎處理；本輪未驗收玩家操作。 |
| Forge 自動化 | 81 槽，upper 0–26、lower 27–80，slot limit 128，支援 simulate | 不能因此宣稱 Bedrock 女僕或其他自動化包已接入。 |
| 儲存與 client update | 只寫 Slot／id／Count，load 以新 ItemStack 重建 | 會失去這條路徑未保存的 metadata；不可移植此限制。 |

GUI 來源為 [`RefrigeratorScreenHandler`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/screen/RefrigeratorScreenHandler.java#L122-L211)。server 上限是 128；client prediction 為解決 signed-byte 表示才使用 127，不能將兩者混寫。

[`RefrigeratorAutomationItemHandler`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorAutomationItemHandler.java#L12-L53) 另有煙火烤串熱度合併：限指定 namespace／ID，忽略 `HotUntil`、`SkewerModelVariants` 與作者欄位比較，要求同為熱／冷且熱度差不超過五分鐘，再加權平均熱度。這與 GUI 的嚴格 tags 分組不同，沒有證據可把這些忽略規則套到任意 Bedrock 第三方物品。自動化取放另將該半的關閉期限續到 gameTime+40；不是冰箱額外複製庫存的機制。

[`saveAdditional`／`writeSimpleStackList`／`readSimpleStackList`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/RefrigeratorBlockEntity.java#L356-L430) 確實只保存 Slot、registry id、short Count。記憶體 `copyWithCount` 不代表磁碟與 update packet 保留名稱、lore、作者或其他 tag。本輪不以 typeId＋amount 序列化替換 native cargo，也不復刻上游資料遺失。

拆除由 [`RefrigeratorBlock.onRemove`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/RefrigeratorBlock.java#L148-L173) 呼叫下半 BE `dropContents`；上半 loot 為空，破上半再拆下半。BE 將兩半物品移入臨時 vanilla containers、清來源，再呼叫原生掉落。這是來源流程證據，並未執行 Java 引擎驗證任意 item 的完整掉落生命週期。

## Bedrock 權威庫存與正式 API 界線

目前使用 stable `@minecraft/server 2.11.0`／`server-ui 2.0.0`、Bedrock 26.60，native block container 需要 Upcoming Creator Features。完整選型與固定官方 schema 見 [NATIVE-CONTAINERS.md](../NATIVE-CONTAINERS.md)。

| 真實位置 | 方塊／槽位 | 操作台聯合讀取索引 |
| --- | --- | --- |
| 上半 | `ordertocook:refrigerator_upper`，27 槽 | 0–26 |
| 下半 | `ordertocook:refrigerator`，54 槽 | 27–80 → 下半 0–53 |

[`native_fridge.js`](../../runtime/BP/scripts/native_fridge.js) 的聯合 view 只轉發到上述真實槽位。`peek()` 不建立或移物；舊 81 槽 helper 只在確認載入、身份、容量與目的槽後，以 native `moveItem` 逐槽遷移。未完成時保留原引用，已佔目的槽不覆寫；全部搬完及保存 station 後才退休空 helper。

官方 [`Container`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container?view=minecraft-bedrock-stable) 的 `getItem` 是讀取，並不移除來源；[`ItemStack.clone`](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable#clone) 保留完整副本資料。API 支援原生堆疊存取，不等於所有未知 addon 的特殊語義、原生 GUI、跨區塊及崩潰恢復均已逐一證實。

官方 [26.50 容器說明](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.50?view=minecraft-bedrock-stable)規定儲存內容、同 ID state 變更保留 block entity、換 ID 掉出內容。門動畫維持同 ID；原生貨物掉落由引擎處理，腳本不得再生成一份。`spawnItem` 建立可存在世界中的真物品，不能拿來作唯讀展示。手動「spawn 後清槽」是兩次操作，沒有跨庫存／實體／世界存檔的原子交易保證。

原生容器沒有本版本已證明可用的食品槽位白名單與每格 128 覆寫；已開視窗也沒有可用的即時強制關閉方法。名稱、lore、動態資料等應保留在 native ItemStack；不能為食品篩選、排序、視覺或撤權而重建、丟棄或覆寫未知物品。

## 本輪資料保護修復：舊 helper 的身份驗證

起點 `appliances.js::ensureStorage` 在正常 getStorage／遷移時已核對 helper 的 type、`station_id`、dimension 及相對錨點距離；但是 `onBreak` 直接依 `storageId` 取實體後掉落其內容並移除，沒有重用該核對。孤立回收則依 helper tag 與 `storage_anchor` 找舊位置，亦需核對它們與實體／station 的一致性。錯誤或過期引用可能因此使另一份 helper cargo 被當成本設備回收；這是來源可達風險，不冒稱玩家世界曾發生。

本輪修復範圍是共用既有身份條件，在正常使用、拆除與孤立回收入口一致拒絕錯配；上述四項錯配或讀取該身份時拋出例外會保留 helper 貨物與站點引用，不把可找到某個實體當成具有取物權。原生冰箱貨物仍留在方塊，沒有新 inventory owner、顯示副本、資料格式或第三方白名單。錯配資料可能需要另行查明與修復，本輪沒有擅自重新綁定。最終行為與故障注入範圍以本輪定點結果為準。

孤立回收把 `storage_anchor` 當作待驗證的身份資料，將其中 stationId／dimensionId／location 與實體 type、`station_id`、dimension／位置核對。它不查找另一份 canonical station，也不要求原方塊仍存在；真正孤立的 helper 仍可依法清理。不能只守 `onBreak`，讓下一次回收掃描繞過同一身份檢查。

**既有掉落非原子性仍未修復。** `dropContainerContents` 的順序是 `spawnItem(stack)` 後清來源槽。隔離 API double 故障注入已顯示：生成成功後若清槽失敗，世界副本與原槽可以同時存在，重試又可能再生成。這是離線注入的失敗語義，沒有觀察到本次引擎實際發生；身份守門只阻止錯配 helper 被操作，不能使合法 helper 的兩步掉落成為原子交易，也不能把此限制說成新增展示行為。

## 既有證據不能代替本輪驗收

| 既有來源 | 已記錄的範圍 | 不能外推之處 |
| --- | --- | --- |
| [.5 原生容器報告](0.1.5-alpha.1/CONTAINER_GUI.md) | 固定來源 `ad3c06e…`、BDS 1.26.60.6；舊 fixture 8、新來源升級 43、正常重啟 28 項；實際 metadata、上下槽位及 command／adapter 拆除 | 不是本輪候選、真 Player GUI、所有第三方物品或任意崩潰恢復。 |
| [.12 CHANGELOG](../../CHANGELOG.md#0112-alpha1)／[PR #28](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/28) | 原生同層整理：BDS 首次 7、同世界正常重啟 4 項，名稱／lore／動態資料／耐久／keepOnDeath | 是該舊來源的記錄，未測本輪修復或新內容 renderer。 |
| [.47 共同 root](0.1.47-alpha.1/FRIDGE_SHARED_ROOT.md)／[視覺證據](fridge-shared-root-visual/README.md) | 有限模型、來源矩陣與 Blockbench 畫面；含量測殘差與原生材質限制 | 模型畫面不證明物品 storage、取放、生命週期或 native renderer。 |
| [11-09 展示契約](visual-audio/FRIDGE_ITEM_DISPLAY_CONTRACT_20261109.md) | 固定 Java／Gecko 來源、官方持物能力與 holder 安全待證事項 | 明確未實作任意物品展示，沒有 native holder 成功結果。 |

## 仍未實現及本輪不聲稱的能力

1. **上下各八件動態 native 物品模型仍缺少安全、已驗證的顯示路徑。** 裝備 API 接受真 ItemStack，但一般 attachable／armor stand 範例不證明自訂 holder 支援所有 item、FIXED transform、禁取出與死亡／爆炸／重載安全；參見[展示契約的官方來源](visual-audio/FRIDGE_ITEM_DISPLAY_CONTRACT_20261109.md#bedrock-capability-and-safety-boundary)。
2. `transient` 與 `remove()` 有各自生命週期能力，不能單獨證明存活期間無取出路徑或 script reload 後無殘留。尚未建立安全證據前不接真 cargo，不用掉落物或真裝備副本補展示。
3. 無物品的有限幾何映射可以避免真物品副本，但不等於任意 ItemRenderer，也未在本輪採用。未知物品不能冒充另一款食品，亦不能因無對應模型便跳過它而補上第九堆。
4. 來源測試／API double 不能證明實際卸載重載、磁碟保存、手機／手把／多人 GUI、燈光／透明材質或其他 addon 自訂邏輯。既有正常保存證據不保證任何斷電時刻都零損失。

## 本輪驗證與提交

| 項目 | 本輪結果 |
| --- | --- |
| 候選身份 | `0.1.50-alpha.1`；BP／RP `[0,1,50]`。分支 `fix/fridge-storage-identity-20261109`；最終 commit／PR／CI URL 隨 PR Checks 記錄。未發布 Tag／Release。 |
| 修前反例 | 在未修改的 main runtime 上執行同一新測試檔：**15 項，14 PASS／1 FAIL**。錯配類型／station／維度／位置 × 上／下破壞共 8 個組合，在 break 與 service 重建後 recovery 共 16 次觀察均暴露貨物被掉出／helper 被移除。合法 helper 正向控制在修前已通過。 |
| 修後冰箱定點 | `node --test tests/native-fridge.test.js`：**15/15 PASS**。僅新增 2 個測試；核對錯配貨物、原槽位 metadata 與引用保留，以及合法 helper 拆除／命令回收恰好掉落一次。既有 npm glob 實際執行，未改測試入口。 |
| 獨立相關回歸 | `node --test tests/native-fridge.test.js tests/appliances.test.js tests/stove-controls.test.js`：**42/42 PASS**；另核對合法爐灶 helper 的拆除／service 重建控制。 |
| 獨立反向控制 | 在臨時副本分別只移除新 `onBreak` 檢查、只移除新 recovery 檢查，兩者均退回 **14/15**；同一新增案例能各自攔住兩條旁路。正式工作樹未受 mutation 影響。 |
| 完整本地驗證 | Node **24.22.1**、Python **3.12.14**；`npm run verify`：**939/939**，0 fail／0 skipped；官方 stable 2.11.0 型別、519 JSON／450 geometry、配對 build 通過；`python tools/check_compliance.py`、`python tests/check_release_policy.py` 與 `git diff --check` 通過。 |
| 既有來源證據完整性 | `python -B docs/validation/visual-audio/placement-poses-20261109/verify_integrity.py`：123 檔、76 exact inputs、16 fridge sources 通過。僅核對已存在檔案／圖片身份；沒有重新拍攝 GUI 或將圖片雜湊當作本輪視覺驗收。 |
| GitHub CI | 提交後由該 PR 的 Checks 與 PR 說明記錄實際 head／tree／run；本文不預填遠端 PASS。 |
| BDS／Minecraft 客戶端／LIVE | **NOT RUN**；本輪沒有原生或遊戲內驗收聲明。 |

本輪受測 runtime SHA-256 為 `b0c129351f0e97443560e09f92a66a438b8b67e7a04ae0efd152fc5aeb514d29`。API double 使用的 metadata fingerprint 只證明已列出的欄位與控制流程；service 重建並非原生區塊卸載／世界磁碟重載。共用保存與手動掉落的非原子界線仍如上文所述。
