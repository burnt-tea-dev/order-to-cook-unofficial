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
| Farmer's Delight、Let's Do、Cookery 的其他煙燻配方 | 尚無本次可核對的已安裝 Bedrock 供應目錄；須由供應商透過下述契約明確提交有效 ID |

已逐檔核對 Tavern
[`5b209aa9b365735bcbfcb42eea232fb90bf71c10`](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/tree/5b209aa9b365735bcbfcb42eea232fb90bf71c10)：
162 份 Bedrock 原生配方及 156 份 Java 來源配方均無煙燻配方。
世界名酒
[`3424205a3c4a68b93316d15516594a2f3fb1c14d`](https://github.com/burnt-tea-dev/kaleidoscope-world-liquor-unofficial/tree/3424205a3c4a68b93316d15516594a2f3fb1c14d)
的 41 份 Bedrock 原生配方及 84 份 Java 來源配方亦無煙燻配方。
飲品可否加入餐廳菜單與能否在爐灶生產，是兩個獨立問題。

Java 對外部鍋具的熱源 tag 相容，不代表那些鍋具的專屬料理會成為
`RecipeType.SMOKING`。本次只接入已核實的單原料煙燻製程；不改外部 Addon。

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
