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

API 模組使用 stable 與方塊需要實驗是兩件事。本版仍採上述 26.60 能力；較新的可撤權虛擬容器候選見下方 [26.70.24 API 重審](#267024-api-重審2026-11-16)，不能把本版的限制推成所有 Bedrock API 都無法實現。

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

目前 schema 只有通用容器布局，沒有逐槽角色／可放物品篩選，不能禁止玩家把物品放入燃料槽或輸出槽；也沒有 Java 專用燃燒／進度條。腳本只按上述七槽分工烹調，不清掉放錯的物品。這次僅有來源回歸結果，未新增 BDS、真客戶端七槽畫面或完整 Java UI 驗證。

## 權限與多人界線

程式在 [`playerInteractWithBlock` before-event][before-interact] 檢查設備、距離、權限與遷移狀態，必要時設定 `cancel`。**26.60 真 Player 是否會因此阻止原生容器視窗，仍需客戶端實測**；模擬 before-event 或無玩家的原生容器測試不足以證明。

`blockContainerOpened`／`blockContainerClosed` 是開關後事件，用來更新各分區觀看者與門姿態，不能取消已開介面。玩家離線、離開、撤權、區塊卸載或拆除時清理動畫 session，也不等於阻止原生槽位交易。

26.60 可用的 [Player API][player]／[Container API][container]沒有原生容器的 `closeInventory`、`closeContainer` 或可用的強制關閉入口；[`UIManager.closeAllForms`][ui-manager]只針對 server-ui 表單，不能當作 native container close。**已開容器無法保證在撤權瞬間停止操作。** 店主改權限前應先讓使用者關閉冰箱與爐灶；此流程仍依賴玩家配合，不能視為安全性保證。原生容器不適合作為已驗證的私人保險箱。

操作台等腳本動作仍會在表單返回後重新核對距離、設備存在及權限；冰箱供操作台取料也重新驗權。爐灶在原生容器開啟前驗權；原生視窗內的引擎移物無逐槽 before-event 可套用同一套檢查。

[26.70.20 Preview 紀錄][preview70]才新增 `show_ui_on_interaction` 與自訂容器遵守 chest permissions 等修正；它們不是本輪 26.60 的能力，也不代表餐廳自訂員工權限可直接交給引擎。

## 目前保留的差異

| Java 行為／需求 | 26.60 的實際處理 |
| --- | --- |
| 冰箱 27／54 格原生格子 | 已使用兩個 native block containers；格子移物交給 Bedrock 原生輸入。 |
| 只收食品 | schema 沒有 allowed-items／槽位篩選，冰箱可收其他物品；操作台仍只消耗訂單匹配的食品。 |
| 同層整理 | 蹲下空手點擊目前上／下層，按 Java 初次出現順序合併同資料物品；不跨層搬運。原生可堆疊判定及完整 ItemStack 副本保留名稱、lore 與額外資料；寫入失敗時回復觸及格子。 |
| 每格 128 件 | 整理仍遵守 Bedrock 原生堆疊上限；不將 128 件寫進原生 64 件格子，也不改成分頁儲物表單。 |
| 爐灶 3 輸入＋燃料＋3 輸出的專用槽位 | 已使用真正七槽方塊 inventory，移物交給原生 GUI；沒有 Java 專用布局、燃燒／進度條、燃料限定及輸出鎖，不使用按鈕列表補成假專用槽位。 |
| 操作台原 12 格與進度布局 | 持有效票據直接製作，或同頁顯示訂單菜名／數量／缺料；沿用現有食品變體與交易。 |
| 洗碗機批次介面 | 既有手持髒盤裝入最多 16 盤，雙手空領整批；本輪補強保存錯誤回退，並非首次改為直接互動。 |
| 撤權即關閉已開原生容器 | 缺少可用 API；已列明限制，沒有以回滾快照或刪容器偽造保證。 |
| 鍵鼠、觸控、手把、多玩家 GUI | 採原生輸入與單頁表單；需逐裝置及真雙人驗收，不能由 CI 或 BDS 探針代填通過。 |

## 26.70.24 API 重審（2026-11-16）

[2026-11-10 的官方 Preview 公告][preview7024]新增 beta `VirtualContainer`、
`World.virtualContainerManager`、`open`／`close` 及內容變動／關閉事件。
本次下載並查閱官方 npm **`@minecraft/server@2.13.0-beta.1.26.70-preview.24`**
的型別宣告；正式依賴仍是 2.11.0，沒有升級世界或啟用新的實驗。
這提供了**可由伺服器撤回操作權的容器介面路徑**，不再將「任何容器都不能關閉」
當作通用引擎結論。它不能直接關閉另一個現有方塊的原生容器。

### 已有能力及邊界

- `create({size, title})` 建立 1–54 格記憶體容器，畫面每行九格；同一容器可由多位玩家共看。
  `size`／`title` 建立後固定。沒有任意槽位座標、逐槽輸入規則或燃燒／烹調進度欄位；
  它本身不補齊 Java 爐灶專用布局。現有 [#91 JSON UI 原型][stove-ui-pr]仍是另一條路線。
- `close(player?)` 開始關閉後，指定觀看者便不能再經畫面改動容器；
  客戶端關屏及已在途庫存請求完成後才發 close event，可能跨 tick。
  撤權可只關閉該玩家，不能在請求關閉的當刻就假定所有在途交易已排清。
- `open` 正常返回只表示已送出請求。`ContainerScreenOpen`、`PreviousScreenClosing`
  等失敗以及稍後 `UserBusy` 都要保留既有庫存，不能把呼叫成功當成已顯示。
- `virtualContainerItemChange` 是玩家 GUI 改物**之後**的通知；腳本寫入不會觸發它，
  也沒有 `cancel`。無法單靠這個事件安全仿造燃料限定或輸出槽禁止放入。
- 這個容器**不會保存到世界**。無腳本引用且無觀看者時可銷毀；世界關閉／script reload
  會直接關屏而不發 close event。`PlayerLeft` close event 的玩家也已失效。
  因此不能以「最後一位玩家關閉才寫回」保證物品安全。

### 改善計劃：保留一份權威貨物，再評估 UI 所有權

虛擬容器是可以研究的 UI 能力，現階段不把它接到冰箱／爐灶真實貨物。
把原生 ItemStack **移入**記憶體會在 reload／崩潰時失去原持久承載；
把它**複製進去**再等 after-event 回寫會產生可取出的第二份貨物。
同一設備同時有多位玩家、操作台取料、爐灶加工、漏斗及拆除時，這兩種簡單接線都不成立。

後續需先確認原生單一權威容器能否直接作介面 backing，或找到可完整保存任意
ItemStack（含 bundles 等內部庫存）的明確交易路徑，再決定是否採用。
本次型別的 `VirtualContainerOptions` 只有 size／title，沒有外部 container backing 參數。
官方類別註解提及 shutdown 保存，但同一套 `ShutdownBeforeEventSignal` 明列 restricted callback，
`Container.moveItem`／`setItem` 仍不允許 restricted execution；不能由該建議推定關服時能搬回原生槽。
一般 JSON 屬性保存也不等於完整 ItemStack 的序列化或跨玩家背包原子提交。

若以後建立可用的承載契約，原型應先處理每設備唯一 session、同容器多人觀看、
撤權／拆除後等待 close 完成、`PlayerLeft` 的失效玩家、`UserBusy`、reload／shutdown
及斷電資料歸屬；不能用過期 close 快照覆蓋其他玩家或加工的新內容。
這些是尚待解決的具體 API 組合問題，分類為**有新能力、資料安全未證明**，
不分類為「基岩永久不支援」。本次沒有新增測試、fixtures、常駐同步器或持久庫存副本。

效能也需分別核對：虛擬容器可少用表單往返，但內容快照、事件回寫及跨容器同步可能增加成本。
本次僅核對官方宣告，沒有原生執行、多人 GUI、記憶體或 FPS 收益結論。

可重查的官方輸入：

- [官方 npm 套件][virtual-types]：tarball SHA-256 `836357f5b46a82f1b15dbafcbca8d803846876e820ab11ff5467e14fdd622ae2`；
  `index.d.ts` SHA-256 `88fb2ff9d0a1adf4b85e7f4cb05b8fea006967407e3ce47eff9403dfbdb7b9e8`。
- 宣告項：`VirtualContainer`／`VirtualContainerManager`／`VirtualContainerOptions`、
  `VirtualContainerCloseAfterEvent`／`VirtualContainerItemChangeAfterEvent`、
  `ShutdownBeforeEventSignal` 及 `Container`。部分 Learn 類別頁此次未能開啟，
  因此細節以這個固定官方套件為準，沒有由類別名稱猜功能。
- [官方模組版本索引][server-module]與 [WorldAfterEvents][world-after-events]
  列出新類別／事件；頁面選到 stable 不代表其中標為 pre-release 的 API 已進入 2.11.0。

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
[preview7024]: https://feedback.minecraft.net/hc/en-us/articles/50285693907213-Minecraft-Beta-Preview-26-70-24
[virtual-types]: https://registry.npmjs.org/@minecraft/server/-/server-2.13.0-beta.1.26.70-preview.24.tgz
[server-module]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/minecraft-server?view=minecraft-bedrock-experimental
[world-after-events]: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-experimental
[stove-ui-pr]: https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/91
