# 視聽還原：實際事件、音量及粒子核對

基線：Bedrock main `ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`，Java
[`breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642)。
本文件記錄這次修改的聲音／粒子；不把 OGG 數量或 Node 測試當作客戶端已聽到／看到的證據。

## 已修正的來源與播放位置

實作在 `runtime/BP/scripts/audiovisual.js`；正式 `appliances.js`、`entities.js`、`main.js` 呼叫同一組效果定義。
所有原作 OGG 原檔保留，不重製／替換聲音，不新增 AI 圖像。粒子 JSON 由 `tools/convert_assets.py::make_feedback_particles` 重產，引用遊戲原有 `textures/particle/particles` atlas，不散發另一份 Minecraft 粒子 PNG。

| 使用事件 | 固定 Java 的規則 | 這次 Bedrock 修正 |
| --- | --- | --- |
| 打單機刷新 | `order_refresh`，volume 1／pitch 1；機器 Y+0.85，10 個 END_ROD | 初次開店及定時刷新發聲、10 粒閃光；修正聲音中心原在方塊角落 |
| 打單機升級 | `order_refresh`，1／1.2 | 移除錯配的 `prestige_get`，改原事件與音高 |
| 到店顧客生成 | 在打單機發 `order_refresh`，1／1 | 移除所有顧客出生時在顧客腳下播放的低音量打單聲，只在成功生成到店客時於機器播放 |
| 到店接單 | 顧客位置 EXPERIENCE_ORB_PICKUP，1／1 | 接取成功後補 `random.orb` |
| 包裝架補料 | `bag_place`，1／1 | 保留原事件 |
| 盤架／洗碗池補盤 | `plate_place`，0.75／隨機 0.95–1.05 | 補原音量／音高 |
| 操作台裝盤 | `food_plate_place`，0.9／1；成品位置 Y+0.35，6 個 CLOUD | 補蒸氣及音量；取外送袋的同一蒸氣也接上 |
| 操作台打包 | `tryPackOrder` 只明確發蒸氣，無 `bag_place` 呼叫 | 移除額外加上的打包聲，保留原 6 粒蒸氣 |
| 取台上成品 | 袋：`bag_pickup` 1／1；餐盤：`food_plate_place` 1／1 | 不再所有成品一律用袋聲 |
| 交付餐盤 | 顧客位置 `food_plate_place` 1／1 | 交付成功後補原聲音；外送不虛構同一個盤聲 |
| 正常交餐回饋 | 30 個 HAPPY_VILLAGER，Y+0.5；yes／ambient／celebrate 三選一，0.9／隨機 0.95–1.05 | 明確發 30 粒；恢復音量／音高及原三分支，而非單一 yes 0.7 |
| 提早／變髒後收盤 | 提早：`food_plate_place` 1／1；髒盤：`plate_place` 0.75／隨機 0.95–1.05 | 依 `early` 結果發原聲音；提早中斷不再重播成功交餐的綠色粒子與歡呼 |
| 冰箱上／下開門 | `dishwasher_out`，0.35，pitch 分別 2.0／1.7 | 取代統一 1.5 音高；兩門都以 Java 的下半方塊為音源 |
| 冰箱上／下關門 | `dishwasher_in`，0.35，pitch 分別 1.1／0.9 | 取代統一 1.5 音高 |
| 洗碗機準星預覽 | 本地 `dishwasher_out`，0.75／1，機器中心 Y+0.6 | 由看向設備的玩家本地播放；不在服務端替所有旁觀者重複播放 |
| 放髒盤入洗碗機 | dirty_in 第 14 tick：`plate_place`，0.75／隨機 0.95–1.05 | 不再點擊當下過早發聲；在盤子接觸抽屜的原時點播放 |
| 洗碗機運轉 | washing 第 0 tick；超過 8 盤時第 40 tick再播 `dishwasher_washing`，0.9／1 | 補第二個洗滌週期的聲音 |
| 洗碗機推清盤 | clear_out 第 0 tick，`dishwasher_clear_out`，0.95／1 | 原 0.9 修為 0.95，補原白色粒子 |
| 洗碗機取清盤 | `plate_place`，0.75／0.95–1.05；`dishwasher_in`，0.85／1.05 | 補盤聲及收回聲音數值 |
| 手洗水聲 | 0.5／1／2／3 秒，FISHING_BOBBER_SPLASH，0.22／0.9–1.1 | `random.splash` 同時點；不再在 0 或 4 秒多播 |
| 進食 | 第 49／56／63／70／77／84／91 tick，GENERIC_EAT，0.7／0.9–1.1 | 保留節點，補隨機音高；服務原 5 tick 更新仍量化播放時間 |
| 傳送離場 | sit_take 35、stand_take 55、eat_scale 105、中斷 5 tick；ENDERMAN_TELEPORT，1／1 | 原 0.8 修為 1，補正高度／數量的紫色粒子 |
| 好吃到爆炸 | 第 97 tick CREEPER_PRIMED 0.9／1；118 tick GENERIC_EXPLODE 1／1 | 引信保留；爆炸原 0.7 修為 1，補 CLOUD18，爆炸 emitter 明確在 0.4 秒後停止 |
| 取消／逾時離場 | LARGE_SMOKE20，Y+0.5；FIRE_EXTINGUISH 1／1 | 補大煙及 `random.fizz`；正常完成與孤立實體清理不套失敗聲 |
| 喇叭 | 原 `horn.ogg`，1／1，Players 類別 | 保留；聲音定義類別由 block 修為 player |
| 車燈 | LEVER_CLICK，0.8／1（Java 服務端廣播） | 補 `random.click`；此處採服務端音高，未重建騎手本地延遲／0.9 或 1.1 音高層 |
| 車輛受擊 | 在車身高度 60% 發 SMOKE3＋POOF2 | 不再腳下單一 smoke；保留五次受擊回收邏輯 |
| 放置車輛 | 原 `MotorcycleItem.useOn` 無袋聲 | 移除額外 `bag_place` |

`prestige_get` 在固定 Forge 基準只有註冊，沒有實際播放呼叫；仍保存事件與原檔，不以替其他事件播放它來宣稱接線完成。
`bag_place`／`bag_pickup` 原本共用同一 OGG；`plate_place` 原本隨機使用三份 OGG。本次仍保留這些別名關係。

### 村民 celebrate 的實際音檔

Java 1.20.1 官方聲音清單
[`minecraft/sounds.json`, object `40a4222b7ada165fa98cb9215129aeb8d9b6b379`](https://resources.download.minecraft.net/40/40a4222b7ada165fa98cb9215129aeb8d9b6b379)
明確把 `entity.villager.celebrate` 與 `entity.villager.yes` 都指向 `mob/villager/yes1/2/3`。
Bedrock 官方清單沒有 `mob.villager.celebrate`，因此三個等權分支應映射為
`mob.villager.yes`／`mob.villager.idle`／`mob.villager.yes`，不能呼叫不存在的事件。

## 粒子數量、偏移、顏色及時序

`spread` 是 Java `sendParticles` 的 X/Y/Z Gaussian 標準差，`speed` 為原每 tick 速度尺度。
新 emitter 用相同 Gaussian 分布，並將速度轉為 Bedrock 每秒單位；各粒子的後續物理和生命週期仍屬下節列出的跨引擎適配。

| 事件 | 種類／數量 | 中心及 spread | 原 speed |
| --- | --- | --- | ---: |
| 新訂單 | 白色 END_ROD10 | 機器中心 Y+0.85；0.22／0.18／0.22 | 0.015 |
| 洗碗機取盤收回 | 白色 END_ROD7，empty_in 開始 | 中心 Y+0.85；0.28／0.22／0.28 | 0.015 |
| 洗碗機放盤 | 白色 END_ROD10，dirty_in tick14 | 同上 | 0.015 |
| 洗碗機洗滌 | tick0、超8盤時tick40：12；其餘每10tick：4 | 同上 | 0.015 |
| 洗碗機推出 | CLOUD18，POOF8，END_ROD12 | 門外水平0.56、Y+0.62：0.18／0.15／0.18；POOF另高0.05：0.12／0.1／0.12；END_ROD同上 | 0.025／0.01／0.015 |
| 手洗 | BUBBLE_POP10–15、SPLASH2 | 水面矩形 X=3..13px、Z=3..12px，隨朝向旋轉；Y+0.94，泡沫另加隨機0..0.05 | 0（SPLASH Y spread0.01） |
| 裝盤／打包 | 白色 CLOUD6 | 成品中心 Y+0.35；0.18／0.05／0.18 | 0.01 |
| 成功交餐 | 綠色 HAPPY30 | 顧客 Y+0.5；0.3／0.5／0.3 | 0.1 |
| 傳送 | 紫色 PORTAL40 | 顧客 Y+0.8；0.35／0.5／0.35 | 0.2 |
| 爆炸 | EXPLOSION_EMITTER1＋白色 CLOUD18 | 顧客 Y+0.8；cloud0.3／0.4／0.3 | cloud0.05 |
| 取消／逾時 | 灰色 LARGE_SMOKE20 | 顧客 Y+0.5；0.3／0.5／0.3 | 0 |
| 車輛受擊 | 灰色 SMOKE3＋POOF2 | 車Y+0.72；0.24／0.12／0.24、0.18／0.096／0.18 | 0.005／0.01 |

手洗原 `for` 條件每輪重新讀 `nextInt(6)`；本版同樣在迴圈條件評估，沒有把10–15描述為均勻抽樣。
原生 `water_splash_particle` 自帶 Y+0.5 位移，先前只傳 Y+0.94 會抬高發射點。
新 SPLASH emitter 直接用盆面位置，沒有額外半格偏移，也不依賴未初始化的 `variable.direction`。

## 十種 emitter 的來源與真實限制

素材座標依
[Mojang/bedrock-samples@15701fa9c13923f12662984c32c124327e40e3d3](https://github.com/Mojang/bedrock-samples/tree/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/particles)
的 `endrod.json`、`basic_smoke.json`、`villager_happy.json`、`basic_portal.json`、`basic_bubble.json`、`water_splash.json`、`huge_explosion_level.json` 核對。
只使用 atlas UV／原生渲染材質參考，JSON 行為由本專案轉換器生成；沒有把這些新版完整檔案原樣帶入最低版本包。
生成格式仍為 `1.10.0`，根據
[官方粒子元件說明](https://mojang.github.io/bedrock-samples/Particles.html) 的 instant／once emitter 及速度向量。

- 白色星點、灰煙、白霧、綠色星點、紫色傳送及水滴均由原像素 atlas 顯示，不使用新插畫。
- `endrod`、`villager_happy`、`mob_portal`、`basic_smoke_particle` 原生定義使用 manual emitter；`mob_portal` 還需要 native 生成的 size/color。新 OTC 定義明確帶入 count／spread／speed，不靠缺少資料的 manual emitter 猜測顯示。
- `bubble_pop` 使用原泡泡環 UV 與0.2秒縮小；**尚未逐幀複製 Java 專屬泡泡破裂 sprite 序列**。
- 雲／煙／閃光的顏色、初始分布及數量已接入；阻力、尺寸、生命週期及 portal 彎曲軌跡仍需實機對比調整，不能宣稱畫面逐像素等價。
- EXPLOSION_EMITTER 對應一次0.4秒、120/s的短 emitter，隨後粒子自消失；不產生傷害、方塊破壞或遊戲實體爆炸。
- 洗碗機保留現有名義30／40或80／24／14 tick流程。Java `tickServer` 在扣 timer 前處理效果，且 timer=0 的 transition 額外佔一個 tick；Bedrock仍按既有2tick排程合併邊界效果。這是相位邊界的取樣差異，未改庫存／工作時間以強行匹配。
- 顧客服務仍每5tick取樣，7tick吃聲及97／118等節點會在下一個服務更新播放；離線重載不重播已過期效果。原玩家騎車手勢／椅子歡呼音訊與骨骼同步由玩家動畫代理負責。
- 爐灶點火／火焰已由未合併 [PR #19](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/19) 處理；本 PR 保留 main 的爐灶邏輯，不把另一分支結果當作這份候選已包含。整合時仍須帶入其正確 firecharge 事件與爐火時序。

## 十二類方塊的原生操作聲材質

依固定 `registry/ModBlocks.java` 的 `Properties.copy`，轉換器不再將非木製四項以外全部指定為金屬。

| 類別 | 原作複製對象 | Bedrock sound |
| --- | --- | --- |
| order_machine | STONECUTTER | stone |
| countertop | CRAFTING_TABLE | wood |
| washingtable | BRICKS | stone |
| chair | OAK_SLAB | wood |
| shelf／plate_shelf／board | OAK_PLANKS | wood |
| takeout_bag／food_plate_display | WHITE_WOOL | cloth |
| dishwasher／refrigerator | IRON_BLOCK | metal |
| stove | CRAFTING_TABLE | wood |

## 固定 Java 查核入口

所有相對位置均在固定提交的 `forge-1.20.1/src/main/java/cn/breezeth/ordertocook/`：

- `block/entity/OrderMachineBlockEntity.java`: `refreshOrders`／`spawnNewOrderSparkles`／升級成功事件。
- `core/WalkInNpcManager.java`、`OrderToCookMod.java`: 到店生成及接單聲。
- `block/entity/TakeoutBoxBlockEntity.java`: `tryPackOrder`／`tryPlateOrder`／`spawnFreshSteam`。
- `block/FoodPlateBlock.java`、`block/TakeoutBagBlock.java`、`item/TakeoutBagItem.java`: 取盤／取袋／提交聲音。
- `block/entity/RefrigeratorBlockEntity.java`: `openCompartment`／`closeCompartment` 的分門音高。
- `block/entity/DishwasherBlockEntity.java`: `handleTimedEffects`／`takeCleanPlates`／`playClientPreviewOutSound`。
- `core/WashingTableManager.java`: `tick`／`spawnWashEffects`／`getRandomWaterSurfacePos`。
- `entity/CustomerEntity.java`: `tickTeleportEffects`／`tickEatEffects`；`core/OrderNpcManager.java`: 完成與失敗離場。
- `vehicle/motorcycle/MotorcycleEntity.java`: `spawnHitParticles`；`item/MotorcycleItem.java`: 放置；`network/ModNetworking.java`: 喇叭及車燈。

## 可重現驗證

```sh
node --test tests/appliance-particles.test.js tests/audiovisual.test.js
```

本次上述 **10／10** 通過，涵蓋正式服務手洗時點、取消、16盤洗滌第二週期、粒子數量／來源位置、取盤音效、四向盆面、失效粒子不改盤數、顧客傳送只觸發一次、提前收盤不再歡呼、生成物的 instant／once與原生atlas。
另執行當前 `tests/entities.test.js`、`tests/main.test.js` 與手洗測試，原69項全部通過；完整候選驗證以主報告最終指紋為準。
這些結果驗證實際腳本送出的事件與資源資料，**未驗證客戶端實際聲音、色彩、粒子shader或音量聽感**。

實機對照請固定同一朝向／時刻：先錄打單／升級；手洗錄0–4.2秒；洗碗機分8與16盤；冰箱四種開關；顧客普通吃／爆炸／中斷；車燈與五次敲擊。以20TPS逐幀錄影同時記下來源版本，關閉其他資源包覆蓋，勿將原生伺服器可載入當作畫面通過。
