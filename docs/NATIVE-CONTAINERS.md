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

目前 schema 只有通用容器布局，沒有逐槽角色／可放物品篩選，不能禁止玩家把物品放入燃料槽或輸出槽；也沒有 Java 專用燃燒／進度條。腳本只按上述七槽分工烹調，不清掉放錯的物品。這次僅有來源回歸結果，未新增 BDS、真客戶端七槽畫面或完整 Java UI 驗證。

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
| 爐灶 3 輸入＋燃料＋3 輸出的專用槽位 | 已使用真正七槽方塊 inventory，移物交給原生 GUI；沒有 Java 專用布局、燃燒／進度條、燃料限定及輸出鎖，不使用按鈕列表補成假專用槽位。 |
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
