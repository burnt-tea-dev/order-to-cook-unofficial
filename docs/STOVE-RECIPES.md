# 三槽爐灶：配方來源與供應契約

## 執行範圍

Java 基準為 Order To Cook
[`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/StoveBlockEntity.java)。
原爐灶查詢 `RecipeType.SMOKING`，使用共用的 **200 tick 批次進度**，
三個輸入分別對應三個輸出。這不是三種原料合成一道菜的工作站。
一般煙燻配方自己的 `cookingtime` 不改變 OTC 的批次耗時。

`runtime/BP/scripts/smoking_recipes.js` 建立唯一的即時配方物件，直接交給
`ctx.smokingRecipes`。既有 `input: outputId` 字串寫法仍可供本機接入；
本模組的正式值統一為 `{output, count}`。執行與供應端都使用這個物件，
不保存第二份配方快取，也不從食品營養目錄、物品名稱或可食用標籤推導配方。

## 已實作的配方對照

每列每次消耗輸入 1 個；成品數量均為 1。全數使用 OTC 的 200 tick 批次，
正常 20 TPS 下為 10 秒。沒有食材容器返還。

| 輸入 ID | 輸出 ID | 接入條件 |
| --- | --- | --- |
| `minecraft:beef` | `minecraft:cooked_beef` | 原有內建配方 |
| `minecraft:porkchop` | `minecraft:cooked_porkchop` | 原有內建配方 |
| `minecraft:chicken` | `minecraft:cooked_chicken` | 原有內建配方 |
| `minecraft:mutton` | `minecraft:cooked_mutton` | 原有內建配方 |
| `minecraft:rabbit` | `minecraft:cooked_rabbit` | 原有內建配方 |
| `minecraft:cod` | `minecraft:cooked_cod` | 原有內建配方 |
| `minecraft:salmon` | `minecraft:cooked_salmon` | 原有內建配方 |
| `minecraft:potato` | `minecraft:baked_potato` | 原有內建配方 |
| `minecraft:kelp` | `minecraft:dried_kelp` | 原有內建配方 |
| `kaleidoscope_grilling:chicken_wing` | `kaleidoscope_grilling:roasted_chicken_wing` | 啟動時核實輸入與輸出均在原生物品註冊表 |
| `kaleidoscope_grilling:sweet_potato` | `kaleidoscope_grilling:roasted_sweet_potato` | 啟動時核實輸入與輸出均在原生物品註冊表 |

Grilling 兩筆不是烤串配方。已核對的 Bedrock 原生配方含 `smoker` 標籤，
其來源為 Grilling
[`7ba0c6ac0461f56d4de4d4aafd15baaddedc05af`](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/tree/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af)：

- [烤雞翅原生配方](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/recipes/roasted_chicken_wing.json)
  與 [雞翅物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/chicken_wing.json)。
- [烤地瓜原生配方](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/recipes/roasted_sweet_potato.json)
  與 [地瓜物品](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/blob/7ba0c6ac0461f56d4de4d4aafd15baaddedc05af/projects/grilling/gameplay_core/behavior_pack/items/sweet_potato.json)。

Grilling Java 基準 `9a1acdab27698457bec16c9362678e574895a28c` 的
[雞翅煙燻配方](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipes/roasted_chicken_wing_smoking.json)
與 [地瓜煙燻配方](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/common/src/main/resources/data/kaleidoscope_grilling/recipes/roasted_sweet_potato_smoking.json)
均是 `minecraft:smoking`，源 `cookingtime=100`、`experience=0.35`，預設產量 1。
OTC 使用自己的 200 tick 時鐘，沒有按來源時間加速，也沒有新增來源經驗獎勵。
Java 的 ingredient tag 不會直接拿來猜其他 Bedrock Addon 的物品 ID；這裡只接入
上面兩份原生配方明確列出的實際輸入。

## 製程邊界與未接入供應商

| 供應端／製程 | OTC 三槽爐灶處理 |
| --- | --- |
| Grilling 的上述兩筆原生 smoker 配方 | 可用；逐筆檢查輸入、輸出存在 |
| Grilling 烤架、烤串、翻面、撒料 | 保持 Grilling 工作站製程，不註冊到爐灶 |
| Cookery 炒鍋、湯鍋、砧板、磨坊 | 保持 Cookery 工作站製程，不轉成單槽煙燻 |
| Tavern 酒桶、壓榨槽、雪克杯 | 不註冊到爐灶 |
| 世界名酒釀造、調酒、冷凍櫃 | 不註冊到爐灶 |
| Cookery、Chinese Food、Nether、End、Sculk 的原生 smoker 配方 | 可用下述公開工具從實際作者 BP 產生供應模組；不是 OTC 內建白名單，也不會在未接入的原包上自動生效 |
| Farmer's Delight、Let's Do 及其他供應商 | 同一工具可讀明確的原生 smoker 配方；專屬腳本製程仍須由供應端提供有效目錄 |

已逐檔核對 Tavern
[`5b209aa9b365735bcbfcb42eea232fb90bf71c10`](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/tree/5b209aa9b365735bcbfcb42eea232fb90bf71c10)：
162 份 Bedrock 原生配方及 156 份 Java 來源配方均無煙燻配方。
世界名酒
[`3424205a3c4a68b93316d15516594a2f3fb1c14d`](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/tree/3424205a3c4a68b93316d15516594a2f3fb1c14d)
的 41 份 Bedrock 原生配方及 84 份 Java 來源配方亦無煙燻配方。
飲品可否加入餐廳菜單與能否在爐灶生產，是兩個獨立問題。

Java 對外部鍋具的熱源 tag 相容，不代表那些鍋具的專屬料理會成為
`RecipeType.SMOKING`。爐灶只接入已核實的單原料煙燻製程，作者工作站保持其原有行為。

## 從原作者配方產生可選接入

[`tools/build_smoking_provider.py`](../tools/build_smoking_provider.py) 讀取實際
BP 的 `recipes/`，只選有 `smoker` 標籤的 `minecraft:recipe_furnace`，
將可表達的單原料／明確產量交給下方既有 v1 介面。沒有作者名稱白名單、
另外抄寫的九條 runtime 配方或額外相容包。腳本加入原 BP 已宣告的唯一入口；
保留原作者程式內容、配方、資源和存檔 ID；OTC runtime 不改寫。

公開本機用法只需要合法作者 BP/RP、OTC 及公開 Core 來源。若已有其他相容
處理，應使用**目前有效的整個作者 BP/RP**，不要從舊原包重建並蓋掉它：

```sh
python3 tools/build_smoking_provider.py \
  --bp /inputs/author/BP --rp /inputs/author/RP \
  --core-source /sources/senluo-bedrock-core \
  --version 1.6.30001 --output /outputs/author-with-otc
```

版本只是範例，須選高於輸入 BP/RP 且未用過的配對身份。工具沿用 Core
`tools/paired_release.py::plan_pair` 更新兩側及既有互相相依，保留 UUID、
其他依賴和資產，輸出新的 `author-with-otc-smoking.mcaddon` 與來源摘要。
原輸入保持不變。使用新作者配對時，其他明確鎖定該作者舊版本的包仍須
沿既有配套工具同步相依；本工具不猜其他包的版本，也不部署世界。

供既有組裝器使用的純函式為
`compile_smoking_provider(bp_files)`，輸入是 BP 相對路徑到 bytes 的 mapping，
回傳 `updates`、`removals`、`recipes`、`duplicates`、`skipped`。沒有可接入配方時不產生
腳本；有配方時僅更新入口 import 與自有 `scripts/otc_smoking_provider.js`。
組裝器負責在既有作者配對中採用這兩個輸出。作者撤除全部相關配方時，退役
先前生成的自有模組及入口 import，避免留下舊供應資料；同名非自有檔案拒絕覆蓋。

相同輸入／產量／輸出的重複原生配方只發布一次；競爭輸出、衝突 recipe ID、
tag 材料、物品 data、額外條件及跨 namespace／原版輸入列入摘要而不猜測。
這保留 OTC 的原版配方和其他供應商的責任。生成模組只在 `worldLoad` 及
OTC request 事件時發布，逐筆檢查原生輸入和輸出存在，訊息切成最多
2048 字元的完整快照，沒有輪詢。分組使用該供應商 `native_smoker_0`、`native_smoker_1`…，
保留作者自行提供的 `main` 分組；若同一輸入已有其他分組擁有，既有 registry 會拒絕新快照，不會覆蓋；
同一作者不要同時載入兩份相互競爭的 v1 publisher。

### 已核對的原始作者來源

2026-11-13 對原始歸檔的只讀編譯找到下列 **9 個不同輸入**；測試把生成
publisher 的事件送入正式 OTC registry，再讓正式爐灶每三路跑完 200 tick。
這是來源與離線行為範圍，尚未新增這些配對的 BDS、存檔或玩家畫面結果。

| 原始來源 | 本機 SHA-256 | 可接入輸入 → 輸出（省略同欄 namespace） |
| --- | --- | --- |
| [Cookery 1.6.6，file 9511094](https://edge.forgecdn.net/files/9511/94/Kaleidoscope-Cookery-v1.6.6.mcaddon) | `4bd85c214d063e07ea66639edcff367337db12d59b430b26595c71d1b61b3b64` | `kaleidoscope_cookery`: `stuffed_dough_food → samsa` |
| [Chinese Food 1.1.2，file 9511115](https://edge.forgecdn.net/files/9511/115/Kaleidoscope-Chinese-Food-v1.1.2.mcaddon) | `7d26fbb8af615ac8c531d8c76f0a49620dcfd8a427d3e38ab8fc14bfea8b4949` | `kaleidoscope_chinesefood`: `raw_mooncake → mooncake`；三份等價配方合一 |
| [Nether 1.0.3，file 9227368](https://edge.forgecdn.net/files/9227/368/Kaleidoscope%20Nether%20v1.0.3.mcaddon) | `62b8e598780d60c909d3bc3448c31a77327d8b43419ad034529bc257c364ff24` | `kaleidoscope_nether`: `raw_piglin_meat → cooked_piglin_meat`、`raw_strider_meat → cooked_strider_meat`、`ghast_tentacle → roasted_ghast_tentacle`、`ham → roasted_ham` |
| [End 1.0.3，file 9227361](https://edge.forgecdn.net/files/9227/361/Kaleidoscope%20End%20v1.0.3.mcaddon) | `5cb77a000ed0f42c820602c50b67c208e85e99634d3454fb969aa39d5c2d903a` | `kaleidoscope_end`: `raw_ender_dragon_meat → cooked_ender_dragon_meat`、`raw_endermite_meat → roasted_endermite_meat` |
| [Sculk 1.0.0，file 9317015](https://edge.forgecdn.net/files/9317/15/Kaleidoscope%20Sculk%20v1.0.0.mcaddon) | `15b64840f20c0ab7da26c6af4f5108512345a5947f381f202594a7f04137c4dd` | `kaleidoscope_sculk`: `eerie_meat → cooked_eerie_meat`；兩份等價配方合一 |

Chinese Food 的 `minecraft:water_bucket → kaleidoscope_chinesefood:salt_bucket`
因原版輸入責任而保持未接入。原料／輸出不是食品的 smoker 配方也不能僅憑
名稱斷言可加入餐廳菜單；菜單營養和料理製程仍各自走其契約。

## 供應商契約 v1

OTC 接收伺服器 Script Event `ordertocook:smoking_recipes_v1` 的 JSON 訊息。
初始化後會發出 `ordertocook:request_smoking_recipes_v1`，供已訂閱的供應商重送。
較晚啟動的供應商也可在自己的 `worldLoad` 後主動送出一次快照。

以下是 **Grilling 已核對的 `main` 分組完整快照範例**；現有兩筆內建接入不要求另裝供應腳本：

```json
{
  "version": 1,
  "provider": "kaleidoscope_grilling",
  "catalog": "main",
  "recipes": [
    {
      "id": "kaleidoscope_grilling:roasted_chicken_wing",
      "process": "smoking",
      "input": "kaleidoscope_grilling:chicken_wing",
      "output": "kaleidoscope_grilling:roasted_chicken_wing",
      "count": 1
    },
    {
      "id": "kaleidoscope_grilling:roasted_sweet_potato",
      "process": "smoking",
      "input": "kaleidoscope_grilling:sweet_potato",
      "output": "kaleidoscope_grilling:roasted_sweet_potato",
      "count": 1
    }
  ]
}
```

供應端使用 `system.sendScriptEvent(eventId, JSON.stringify(snapshot))` 發送。
接收端只接受 `sourceType === "Server"`；這是受信任伺服器模組的約定，
不提供模組身份認證。有權發出 Server 事件的程式仍需對自己的聲明負責。

官方 `@minecraft/server` 2.0.0 型別定義 `System.sendScriptEvent` 的 `message`
參數明確限制為 **2048 字元**，可在本專案安裝後的
`node_modules/@minecraft/server/index.d.ts` 查到。方法見官方
[System API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/system?view=minecraft-bedrock-stable#sendscriptevent)，
官方 [Script Event 訊息說明](https://learn.microsoft.com/en-us/minecraft/creator/commands/commands/scriptevent?view=minecraft-bedrock-stable)
亦列出 2048 字元限制。

供應商應將較大的目錄分成名稱固定的小組，例如 `fish`、`meat`、`vegetables`，
讓每組 `JSON.stringify(snapshot).length <= 2048`，然後各自發送。
`catalog` 省略時為 `main`；它是一般分組名稱，不是版本或依賴鎖。
每個分組包含完整可解析 JSON，不使用分段拼接，也不等待其他組。
**每組獨立驗證、獨立替換，不提供跨組交易。**

| 欄位 | 規則 |
| --- | --- |
| `version` | 固定為數字 `1`，代表本契約版本 |
| `provider` | 供應商 namespace，例如 `kaleidoscope_grilling`；不接受 `minecraft` |
| `catalog` | 可省略，預設 `main`；固定分組名，只用小寫英數字、底線、點及連字號 |
| `recipes` | 該 `provider + catalog` 的完整快照，空陣列只撤銷該組目前全部配方 |
| `id` | 穩定且不重複的配方 ID，namespace 必須等於 `provider` |
| `process` | 只接受 `smoking` |
| `input` | 一個真實、已註冊的物品 ID，namespace 必須等於 `provider`；每次只消耗 1 個 |
| `output` | 一個真實、已註冊的物品 ID |
| `count` | 明確的整數產量 `1..64`；實際成品格仍遵守該物品的原生堆疊上限 |

快照內一個輸入只能對應一條配方。v1 沒有材料替代、物品 tag 展開、
容器返還、多原料、品質、額外動態資料、時間或特殊燃料欄位；多出的欄位會被拒絕，
避免把一個專屬製程悄悄簡化。需要這些條件的配方繼續由原工作站負責。
需要處理原版輸入的第三方新配方，亦應另提有來源證據的接入變更，不能透過此契約
覆寫原版或其他供應商的輸入。

有效快照會整批替換相同 `provider + catalog` 的舊項；重送相同內容無額外效果，
供應商可提交自己的分組更新。任一配方無效或物品未安裝，只拒絕這組快照並
保留該組上一個有效版本。不同組可以同時存在，但不能佔用另一組的輸入，
即使兩組同屬一個供應商亦然。移動配方至另一組時，先在原組明確撤除該配方。
停用整個供應商時，對其每個已發布分組送出 `recipes: []`。
錯誤原因由 OTC 記錄於 Content Log。
工廠的同步回傳值為 `{ok:true, provider, catalog, registered}` 或 `{ok:false, reason}`；
Script Event 目前沒有逐筆回覆事件。

### 供應端發布範例

以下程式可放進供應商自己的服務端入口。兩筆真實 Grilling 配方只需要一個
`main` 分組；大型供應目錄可在 `catalogs` 中加入其他名稱固定、訊息不超限的分組。
此例在世界載入後主動發布，也會回應 OTC 的重新要求，不作每 tick 輪詢。
現有 Grilling 內建接入無需安裝此例；它展示供應商獨立 PR 的接線方式。

```js
import { system, world } from '@minecraft/server';

const catalogs = [{
  version: 1,
  provider: 'kaleidoscope_grilling',
  catalog: 'main',
  recipes: [
    { id: 'kaleidoscope_grilling:roasted_chicken_wing', process: 'smoking',
      input: 'kaleidoscope_grilling:chicken_wing',
      output: 'kaleidoscope_grilling:roasted_chicken_wing', count: 1 },
    { id: 'kaleidoscope_grilling:roasted_sweet_potato', process: 'smoking',
      input: 'kaleidoscope_grilling:sweet_potato',
      output: 'kaleidoscope_grilling:roasted_sweet_potato', count: 1 },
  ],
}];
let loaded = false;

function publish() {
  if (!loaded) return;
  for (const snapshot of catalogs) {
    const message = JSON.stringify(snapshot);
    if (message.length > 2048) {
      console.warn(`Smoking catalog ${snapshot.catalog} exceeds 2048 characters; split this catalog.`);
      continue;
    }
    system.sendScriptEvent('ordertocook:smoking_recipes_v1', message);
  }
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.sourceType === 'Server' && event.id === 'ordertocook:request_smoking_recipes_v1') {
    system.run(publish);
  }
});
world.afterEvents.worldLoad.subscribe(() => {
  loaded = true;
  system.run(publish);
});
```

登記只存在本次腳本生命週期。重新啟動時先重建原版及可用的已審核配方，再要求
供應商重新發布，避免卸載後殘留配方宣告。這個過程不清空爐灶庫存或改造既有物品。
供應商 runtime 的新增介面應以該供應商的獨立 PR 提交；OTC 不寫入它們的資料或配方。

## 驗證範圍

`node --test tests/smoking-recipes.test.js` 覆蓋無供應商、只安裝部分物品、
延遲登記、重送、同供應商更新及撤銷、無效快照的整批保留、跨 namespace
覆蓋拒絕、錯誤製程及未知物品拒絕、重啟重建、同供應商不同分組並存及
單組撤銷、跨分組輸入衝突拒絕。
爐灶烹調、庫存、燃料與重載的執行驗證由爐灶測試覆蓋。
上述 Node 測試不能證明真實客戶端 UI、聲音、效果或實際世界重啟已通過。

`tests/smoking-provider.test.js` 在既有核心入口執行真編譯器、生成模組及正式
registry／爐灶，覆蓋原作者 bytes 保留、可重播輸出、九條來源配方的三路烹調、
跨包無效輸入／衝突拒絕、延遲要求、可選物品缺席和大型目錄訊息限制。
