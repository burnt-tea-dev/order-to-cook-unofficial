# 原生冰箱與廚電介面：26.60 能力核對

適用於 [package.json 的目前來源](../package.json)。冰箱與爐灶均使用原生方塊容器；爐灶已移除七槽按鈕列表及手持直接投入，操作台與洗碗機仍沿既有腳本操作。這份文件記錄選型與引擎界線，**不等於客戶端驗收通過**。[0.1.5 冰箱驗證報告](validation/0.1.5-alpha.1/CONTAINER_GUI.md)是歷史冰箱結果，不涵蓋本次原生七槽爐灶。

## 安裝要求與 API 選擇

| 項目 | 本輪設定與依據 |
| --- | --- |
| 遊戲版本 | Bedrock **26.60**；兩份 manifest 的 `min_engine_version` 為 `[1, 26, 60]`，目前配對版本見 [BP manifest](../runtime/BP/manifest.json)／[RP manifest](../runtime/RP/manifest.json)，UUID 不變。 |
| 腳本 | stable `@minecraft/server 2.11.0`；[26.60 更新紀錄][release]列明該 stable 版本。使用原生 container 開關 after-events，不需改為 beta。 |
| 表單 | stable `@minecraft/server-ui 2.0.0` 沿用於操作台等腳本介面；冰箱及爐灶不由 ActionFormData 繪製儲物格。 |
| 必要實驗 | **Upcoming Creator Features**。`minecraft:block_entity.container` 在 [26.50][update50]加入且要求此實驗；本輪沒有要求 Beta APIs 或 POI 實驗。 |
| 方塊格式 | 兩個冰箱與爐灶定義使用 `format_version: "1.26.60"`；本地化容器 `title` 於 26.60 加入。其他未變更方塊可保留既有格式版本。 |
| 材質格式 | `ambient_occlusion` 自 format 1.26.20 起只接受 0–10 數值，不能再寫 `false`。兩個冰箱使用 `0`，舊格式設備維持原值；依據 [官方 material_instances 文件][materials]。 |

API 模組使用 stable 與方塊需要實驗是兩件事。啟用更多 Test／Beta 功能並不會自動提供缺少的槽位篩選或容器關閉方法；本輪只啟用實際所需能力。

## 為什麼上下層使用不同方塊 ID

26.60 的原生容器 schema 提供 `slot_count`（1–54）與 `title`，`minecraft:block_entity` 必須放在根 `components`，不能在 permutations 覆寫。[容器 schema][container-schema]、[根元件 schema][block-entity-schema]與 [permutation schema][permutation-schema]均固定到官方樣本提交，避免之後文件更新改變判讀。

| 分區 | 方塊 ID | 容量與標題 |
| --- | --- | --- |
| 下半 | `ordertocook:refrigerator` | 54 格；`container.ordertocook.refrigerator.lower` |
| 上半 | `ordertocook:refrigerator_upper` | 27 格；`container.ordertocook.refrigerator.upper` |

兩個標題均有繁中／簡中／英文翻譯。上半是隱藏定義，不新增可單獨取得的冰箱物品，方塊 loot 為空；上下拆除只應掉一個冰箱物品。原 ID 仍保留舊 `half=upper` 狀態供世界升級辨識，正常新放置使用上方專用 ID。

真正的物品存在各方塊的 native inventory。操作台看到的 81 格介面只把上層映射為 0–26、下層映射為 27–80，讀寫仍落在原生槽位，沒有第二份「物品 ID＋數量」庫存。點上／下半直接交由引擎開啟相應格子視窗，不使用翻頁式冰箱表單。

[26.50 官方說明][update50]規定容器保存內容、換成不同方塊 ID 時掉出內容；改變同 ID 方塊狀態保留 block entity。因此門的 `open`／`frame` 只改 state，腳本不再複製並掉落另一份原生貨物。

## 舊世界 81 格庫存遷移

先備份世界，於 26.60 測試副本啟用 UCF 並載入同 UUID 的新包。設備服務採以下順序：

1. 確認下半具備預期的 54 格原生 inventory。缺少 UCF／元件時停止，保留舊上半 ID 與儲物 helper，不先替換方塊。
2. 將舊上半替換成 27 格專用 ID；若舊上半原生槽已有物品，拒絕替換以免換 ID 造成掉物。
3. 尋回已記錄的舊 81 格 `ordertocook:storage` helper。若它尚未載入，保留 ID 並等待，不創建空庫存；遷移未完成時不允許開櫃或供操作台取料。
4. 以 [`Container.moveItem`][container] 將來源 0–26 移至上層，27–80 移至下層。目的槽非空則停止，不能覆寫。每次是原生物品移動，不是先序列化再重建；中斷後從來源剩餘槽繼續。
5. 全部搬完並保存遷移標記後才移除空 helper。HUD 只讀取已完成的原生庫存，不會因看向設備而觸發搬移。

訂單 proof、動態屬性、名稱、lore、耐久等 native ItemStack 資料隨原堆疊移動。測試必須比較實際數量與 metadata，不能只比 type ID。正常重啟的持久化與任意程序崩潰的跨存檔原子性不同：方塊／實體 inventory 和 world dynamic properties 沒有共同提交交易，不能宣稱任意強制終止都零損失。

## 原生七槽爐灶

Forge 1.20.1 與 NeoForge 1.21.1 的原爐灶均由方塊互動開啟七槽 GUI，不是按鈕列表。現在的 Bedrock 爐灶使用同一方塊的 `minecraft:block_entity.container`，`slot_count=7`、標題 `container.ordertocook.stove`。原生順序 0–2 是三路食材，3 是共用燃料，4–6 是各路對應成品。玩家直接在原生格子移物；拿著食材點方塊不再由腳本扣物存入。

新放置只建立容器與設備記錄；首次互動仍由原 owner 流程認領及驗權。若這一次被 before-event 擋住，成功準備後會提示再點一次；已就緒的正常互動直接交由引擎開容器，不反覆發訊息。原共用 200 tick 烹調、配對產量、單路堵塞、換料重置、燃料及保存邏輯保持。

舊爐灶的七個實物槽以原生 `moveItem` 移入相同編號的方塊槽位，保留完整 ItemStack。目的槽有物、舊 helper 未載入、額外貨物或保存失敗時保留兩端；只有來源已空且新 owner 狀態成功保存後才移除空 helper。沒有重建空貨物來取代未載入的原記錄。

目前生成源已提供爐灶專用原生七槽布局候選：桌面使用 Java 原圖與槽位座標；觸控保留原生左右背包分區與 28px 格子，按同樣角色排成三輸入、下方燃料、右側三輸出。仍沒有逐槽可放物品篩選，也沒有真燃燒／料理進度條。腳本只按上述七槽分工烹調，不清掉放錯的物品。2026-11-12 的使用者截圖仍是原生通用七格單排，不能把舊候選視為成功。最新來源已修正同路徑 UI 入口與連續槽號並正常生成；**修後真客戶端尚未看過，不代表完整爐灶 parity**。沒有新增或執行測試。

### 原操作與畫面接口核對（2026-11-11）

本題指定 **BDS 1.26.60.6**，沿既有 Upcoming Creator Features。此處是來源核對，不是重新讀取 staging 安裝或客戶端結果。Java 固定於 [source.lock.json](../upstream/source.lock.json) 的 `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`；本機已讀 Forge 1.20.1、NeoForge 1.21.1 的 `StoveBlock`、`StoveBlockEntity`、`StoveScreenHandler` 與 `StoveScreen`，兩分支的七槽位置與進度繪製相同。

真呼叫鏈為 `StoveBlock.use`（NeoForge：`useWithoutItem`）→ `player.openMenu(stove)` → `StoveBlockEntity.createMenu` → `StoveScreenHandler`；client 的 `MenuScreens.register(..., StoveScreen::new)` 才把這個 menu 接到畫面。不能只複製 PNG 就稱為已接入。

| Java 槽位 | 原畫面內座標（x, y） | 玩家放入規則 | 現有 Bedrock 實物槽 |
| --- | --- | --- | --- |
| 輸入 0／1／2 | (38,17)／(56,17)／(74,17) | 全部允許，非煙燻原料留在原槽 | 0／1／2，同序 |
| 燃料 3 | (56,53) | Forge `ForgeHooks.getBurnTime(stack, SMOKING)>0`；NeoForge `stack.getBurnTime(SMOKING)>0` | 3，目前無原生放入篩選 |
| 輸出 4／5／6 | (116,35)／(134,35)／(152,35) | `OutputSlot.mayPlace=false`；block entity 的 `canPlaceItem` 也拒絕 | 4／5／6，目前仍可由玩家放入 |

Java 快捷移動把設備內物品移至玩家背包；從背包移入時先辨認燃料，燃料只嘗試槽 3，其他物品只嘗試槽 0–2。這是原生 menu 的交易規則，重排格子的外觀不會令 Bedrock 引擎自動採用它。`canPlaceItem` 也是 Java 自動化可用的限制；本題沒有改動 Bedrock 自動化，也沒有將既有通用移物宣稱為相同規則。

Java 的四個同步數值為 `litTime`、`litDuration`、`cookProgress`、`cookTotalTime=200`。`StoveScreenHandler.litProgress()` 取整數 `litTime*13/litDuration`；`cookProgress(lane)` 實際不使用 lane，取整數 `cookProgress*24/cookTotalTime`，所以三路共用一支箭頭。`StoveScreen.renderBg` 只在數值大於零時裁切原圖：火焰目的地 `(57,48-flame)`、來源 `(176,12-flame)`、尺寸 `14×(flame+1)`；箭頭目的地 `(79,35)`、來源 `(176,14)`、尺寸 `(progress+1)×16`。不是依時間自行循環的動畫。

現有真 consumer 與生成責任：

- [stove_controls.js](../runtime/BP/scripts/stove_controls.js) 的 `createNativeStoveStorage` 只管理七槽實物與舊 helper 遷移；[appliances.js](../runtime/BP/scripts/appliances.js) 的 `getStorage`、`canOpenStove`、`interact`、`tickStove` 使用同一方塊容器。`tickStove` 持有既有料理及燃料數值，仍由原設備更新與 `ctx.saveStation` 保存。`lit`／爐火貼圖／點火姿態不是料理進度的資料通道。
- [main.js](../runtime/BP/scripts/main.js) 的爐灶 before-interact 分支沿 `canOpenStove` 決定放行原生操作；未就緒時沿原 owner 認領／遷移流程處理。本題沒有修改共用訂閱。
- [convert_assets.py](../tools/convert_assets.py) 的 `make_blocks` 爐灶段生成同 ID 的七槽與標題 `container.ordertocook.stove`，現在同段呼叫 `make_stove_ui` 生成下面的 UI 接線；`make_textures_and_sounds` 已將原 `textures/gui/stove.png` 正常複製到 [RP 原貼圖](../runtime/RP/textures/ordertocook/gui/stove.png)。已直接檢視原 256×256 圖：含設備背景、背包區、火焰與箭頭區域；本題沿用原圖，沒有新造或修改 PNG。

官方同代樣本固定到 `15701fa9c13923f12662984c32c124327e40e3d3`（1.26.60.5），不能冒稱取得了 1.26.60.6 客戶端內部程式。其 [`_ui_defs.json`][ui-defs] 載入 [`data_driven_container_screen.json`][data-driven-ui]：`data_driven_container.screen` 的桌面／觸控分支各選 `desktop_panel`／`pocket_containers.data_driven_container_panel`。官方註解明示 `$container_size` 由 `ChestScreenController::addStaticScreenVars` 發布；同檔 `container_label` 與 [chest_label][chest-ui] 讀 `$container_title` 並以 `$localize_title` 控制顯示翻譯。因此不能把舊畫面失敗直接歸咎於「size 變數不存在」或「標題已翻譯」。本次保留前輪 `$container_size = 7` 分支以隔離入口／槽號修正；本包其他原生設備不是七槽。這不是跨所有第三方 addon 的唯一身份契約，其他七槽 data-driven 容器會匹配同一分支，仍需收斂為經 client 證實的精確身份。原生資料集合仍是 `container_items`，不是另一份腳本庫存。

| 所需接口 | 已讀接口與確定邊界 | 本題決定 |
| --- | --- | --- |
| 選擇爐灶畫面 | 官方登記的入口是 `ui/data_driven_container_screen.json`，controller 提供 `$container_size`。 | 改在同路徑覆寫 screen；不再於另一檔重複宣告同名 screen。保留七槽分支，非七槽仍用原 panel；其他 addon 的七槽識別及真 client 選窗仍未確認。 |
| 真燃料／料理進度 | `tickStove` 已有真數值；已讀 data-driven UI 沒有對應這四個數值的 binding，block container schema 也沒有自訂進度通道。 | 不接普通熔爐的進度 binding，不加玩家 HUD／lore carrier、第二份保存或 timer。這是本次已讀接口的缺口，不是未來 API 的永久結論。 |
| 燃料限定、輸出禁止放入 | 固定 container schema 無逐槽 filter。現用 server 2.11.0 的 `Container.containerRules` 是唯讀可選屬性；`ContainerRules` 描述整個容器的 allowed／banned items、巢狀儲物及重量，沒有逐槽 `mayPlace`／fuel／output 設定入口。 | 不靠修改 rules 快照、鎖住成品 ItemStack 或事後搬回物品冒充原生交易限制；保留現有可用槽位。 |

### 布局候選的生成與接入（2026-11-12 修正）

使用者截圖顯示的是原生通用 176×130 單排面板，沒有進入候選 176×166 爐灶面板。staging 的 0.1.60 確有前輪 sparse grid 與 size selector，但這不證明 client 載入了哪份定義。跨檔同名 screen 的勝出順序未獲官方文件保證，因此本次移除歧義入口；沒有把這個推論寫成已重現的引擎根因。另將 sparse 9×3 改回連續索引 0–6，避免把位置索引當成控制陣列順序。Java 槽座標及料理、保存、原生庫存 owner 均未改。

正常定向生成命令（在本 repo 根目錄執行）是：

```sh
python3 tools/convert_assets.py --stove-ui-only
```

此命令只寫下面三個 RP UI 檔，不呼叫測試、lint/typecheck、打包或服務。完整既有 `python3 tools/convert_assets.py` 也會由 `make_blocks` 的爐灶段呼叫相同 `make_stove_ui`；本題只執行定向生成，避免重產無關資產。

- [`ui/_ui_defs.json`](../runtime/RP/ui/_ui_defs.json) 只登記新增的 pocket 定義。桌面入口沿用官方已登記的同路徑，不重複登記，也不複製官方 UI 清單。
- [`ui/data_driven_container_screen.json`](../runtime/RP/ui/data_driven_container_screen.json) 在官方原路徑覆寫同一 `data_driven_container.screen`，保留傷害關閉、桌面背景與觸控 toast；四個互斥分支按 desktop／pocket 及七槽條件選內容。原 `ordertocook_stove.json` 由生成器移除，避免留下第二個 screen writer。未覆寫官方普通 panel 或任何 `chest.*` 定義。
- 桌面專用 panel 用原 `stove.png` 的 `(0,0,176,166)` 區域作底圖。七個 cell 外框座標比 Java 的 16px 物品座標各減一，讓 native 18px cell 內的物品正好落在上表位置。玩家背包與 hotbar 仍用 `common` 的原生集合及控件，只對齊原圖位置。
- [`ui/ordertocook_stove_pocket.json`](../runtime/RP/ui/ordertocook_stove_pocket.json) 在原 `pocket_containers` namespace 繼承 data-driven panel，保留標頭、關閉按鈕、左側 36 格玩家庫存、原生捲動、手把 helpers、selected item、item lock、cursor、tooltip 與 flying item 路徑。只有右側容器內容改成三個 28px 輸入、下方燃料、右側三個輸出；輸出靠右隨可用寬度移動，不將觸控格縮成桌面大小。觸控沿原生格子底圖，不硬拉伸 Java 整頁背景。

集合索引沿官方 [brewing_output_slots][brewing-ui] 與 [armor_grid][inventory-ui] 的接法：有 `collection_name` 的 grid，用顯式 `grid_position` 指定槽號，在 cell 的 panel 內 offset 原生 item 控件。桌面 `[7,1]` 的 `[0,0]`–`[6,0]`、觸控 `[1,7]` 的 `[0,0]`–`[0,6]` 都對應**同一** `container_items` 0–6；位移施於完整 `common.container_item` input_panel，其子樹包含背景、物品、按鈕與選取控制，不是只移圖示；不搬貨。桌面 item 沿 `chest.chest_grid_item → common.container_item`；觸控沿 `common.pocket_ui_container_item → common.container_item`，原拖放、數量、耐久、focus、鎖定與 bundle 控件均保留。

來源與三個 RP 產物已更新並直接對照原版控件與 Java 座標，未執行測試、lint/typecheck、CI 或 gameplay probe；僅作未改版的本機布局候選，manifest、baseline、發版與 staging 安裝由總協調接手。真客戶端、不同 GUI 比例／小螢幕的觸控顯示、手把導航與實際移物仍未觀察。真進度還缺原 `tickStove` 到 native container UI 的資料接口；逐槽放入／快捷移動分流仍缺引擎交易接口。沒有接普通 furnace binding、另造 timer／DP／lore／HUD carrier、假火焰循環或事後回搬。既有按鈕列表與手持投入沒有復活。

## 權限與多人界線

程式在 [`playerInteractWithBlock` before-event][before-interact] 檢查設備、距離、權限與遷移狀態，必要時設定 `cancel`。**26.60 真 Player 是否會因此阻止原生容器視窗，仍需客戶端實測**；模擬 before-event 或無玩家的原生容器測試不足以證明。

`blockContainerOpened`／`blockContainerClosed` 是開關後事件，用來更新各分區觀看者與門姿態，不能取消已開介面。玩家離線、離開、撤權、區塊卸載或拆除時清理動畫 session，也不等於阻止原生槽位交易。

26.60 可用的 [Player API][player]／[Container API][container]沒有原生容器的 `closeInventory`、`closeContainer` 或可用的強制關閉入口；[`UIManager.closeAllForms`][ui-manager]只針對 server-ui 表單，不能當作 native container close。**已開容器無法保證在撤權瞬間停止操作。** 店主改權限前應先讓使用者關閉冰箱與爐灶；此流程仍依賴玩家配合，不能視為安全性保證。原生容器不適合作為已驗證的私人保險箱。

操作台等腳本動作仍會在表單返回後重新核對距離、設備存在及權限；冰箱供操作台取料也重新驗權。爐灶在原生容器開啟前驗權；原生視窗內的引擎移物無逐槽 before-event 可套用同一套檢查。

[26.70.20 Preview 紀錄][preview70]才新增 `show_ui_on_interaction` 與自訂容器遵守 chest permissions 等修正；它們不是本輪 26.60 的能力，也不代表餐廳自訂員工權限可直接交給引擎。

## 無法 1:1 的項目

| Java 行為／需求 | 26.60 的實際處理 |
| --- | --- |
| 冰箱 27／54 格原生格子 | 已使用兩個 native block containers；格子移物交給 Bedrock 原生輸入。 |
| 只收食品 | schema 沒有 allowed-items／槽位篩選，冰箱可收其他物品；操作台仍只消耗訂單匹配的食品。 |
| 同層整理 | 蹲下空手點擊目前上／下層，按 Java 初次出現順序合併同資料物品；不跨層搬運。原生可堆疊判定及完整 ItemStack 副本保留名稱、lore 與額外資料；寫入失敗時回復觸及格子。 |
| 每格 128 件 | 整理仍遵守 Bedrock 原生堆疊上限；不將 128 件寫進原生 64 件格子，也不改成分頁儲物表單。 |
| 爐灶 3 輸入＋燃料＋3 輸出的專用槽位 | 已使用真正七槽方塊 inventory；本機來源與 RP 已生成專用布局候選，真 client 未看。燃燒／進度條、燃料限定、輸出鎖與 Java 快捷移動分流仍未解，不以按鈕列表或事後回搬冒充。 |
| 操作台原 12 格與進度布局 | 持有效票據直接製作，或同頁顯示訂單菜名／數量／缺料；沿用現有食品變體與交易。 |
| 洗碗機批次介面 | 既有手持髒盤裝入最多 16 盤，雙手空領整批；本輪補強保存錯誤回退，並非首次改為直接互動。 |
| 撤權即關閉已開原生容器 | 缺少可用 API；已列明限制，沒有以回滾快照或刪容器偽造保證。 |
| 鍵鼠、觸控、手把、多玩家 GUI | 採原生輸入與單頁表單；需逐裝置及真雙人驗收，不能由 CI 或 BDS 探針代填通過。 |

[release]: https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog
[update50]: https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.50?view=minecraft-bedrock-stable
[materials]: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable
[container-schema]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/json_schemas/server/common/1.26.20/container.json
[block-entity-schema]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/json_schemas/server/block_components/1.26.60/block_entity.json
[permutation-schema]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/json_schemas/server/block/1.26.60/Permutation.json
[container]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container?view=minecraft-bedrock-stable
[before-interact]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerinteractwithblockbeforeevent?view=minecraft-bedrock-stable
[player]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-experimental
[ui-manager]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/uimanager?view=minecraft-bedrock-stable
[preview70]: https://feedback.minecraft.net/hc/en-us/articles/49576818675597-Minecraft-Beta-Preview-26-70-20
[ui-defs]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/ui/_ui_defs.json
[data-driven-ui]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/ui/data_driven_container_screen.json
[chest-ui]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/ui/chest_screen.json
[brewing-ui]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/ui/brewing_stand_screen.json
[inventory-ui]: https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/ui/inventory_screen.json
