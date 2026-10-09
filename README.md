# Order To Cook／下單了 — 非官方基岩版移植

**可安裝的 `0.1.1-alpha.2`：新增逐段進食與手動收盤、原作顧客動作、上下獨立的冰箱門及洗碗機動畫。餐廳、外送與廚電核心已有實作；真實客戶端的畫面、表單與觸控操作仍待驗收。**

原作由 **breezeth** 製作：[CurseForge 官方頁面](https://www.curseforge.com/minecraft/mc-mods/order-to-cook) · [Java 原始碼](https://github.com/breezeth-CN/OrdertoCook)。本專案由 `casama233` 維護，依 GPLv3 保留原作署名、原資源及完整移植來源。

## 下載與安裝

[下載 OrderToCook-Bedrock-0.1.1-alpha.2.mcaddon](artifacts/OrderToCook-Bedrock-0.1.1-alpha.2.mcaddon) · [變更紀錄](CHANGELOG.md) · [SHA-256](artifacts/SHA256SUMS.txt)

1. 下載 `.mcaddon`，用 Minecraft 開啟匯入。
2. 在新測試世界同時啟用 **Order To Cook — Bedrock (Unofficial Alpha)** 行為包及其資源包。
3. 目標最低版本為 **Bedrock 1.21.100**，依賴穩定版 `@minecraft/server 2.0.0`、`@minecraft/server-ui 2.0.0`；不需要 Beta APIs 或 Upcoming Creator Features。
4. 首次加入會收到指南，也能在工作台合成指南與基本設備。

已執行原生測試的引擎是 **Bedrock Dedicated Server 1.26.52.3**。1.21.100 是本包宣告的最低相容目標，尚未逐一在每個中間版本／裝置測試。正式世界使用前，請先完成 [客戶端驗收表](docs/PLAYTEST.md)。

安裝包亦可由本專案的 GitHub Actions 建置工作取得；完整可重現建置方法見下方。不要把這個基岩版包當作 Java／Forge／Fabric 模組匯入。

### 從 alpha.1 升級

先備份世界，再匯入 alpha.2，確認世界使用的行為包及資源包均為 **0.1.1**。兩包沿用 alpha.1 的 UUID，餐廳、庫存、訂單身份及設定可沿原存檔讀取。不要同時啟用舊版與新版副本。

新版吃完的餐盤會留在桌前，需由店主或員工點擊餐盤／下方桌面收取。舊版已完成的訂單歷史不會憑空補發餐盤；尚未歸還的舊餐盤記錄會按保存期限遷移。升級與正常重啟的實測範圍見 [驗證紀錄](docs/VALIDATION.md)。

## 生存開店流程

1. **建立餐廳。** 合成並放置打單機、菜單立牌、操作台、包裝架、餐盤架、椅子及洗碗池。每家餐廳的打單機相隔超過 24 格。
2. **設定菜單。** 用食品點擊立牌加入菜式；不消耗食品。空手／蹲下點擊管理菜單。每種菜只算一份營養，不按手上堆疊數量計算。
3. **補充物資。** 用皮革補包裝架、乾淨餐盤補餐盤架。兩架要在操作台 **5 格內**；操作台、椅子及相關冰箱在餐廳附近 **24 格內**。
4. **開始營業並接單。** 點打單機開始營業，選一張候選單。接下打單機的一單後，同輪其他候選會消失；到店顧客的單獨訂單保留。
5. **準備成品食品。** 將訂單要求的食物放在背包或可使用的附近冰箱，再點操作台裝盤／打包。**操作台不是自動合成整道菜的機器**，它消耗的是已做好的食品。
6. **取成品交付。** 保持操作台上方空置；完成的盤子／包裹會擺在台上。點擊取走，拿在手上點擊相應顧客。外送包裹與訂單可顯示目的地及方向。
7. **收款、收盤與洗碗。** 完成訂單取得 oTc 幣及可能的小費。堂食餐點約 5 秒吃完，髒盤會保留在桌前；店主或員工點擊餐盤或下方桌面收取，再放進洗碗池，空手點擊開始並保持望著池子 4 秒。把乾淨盤補回餐盤架後可再次使用。同一桌前的舊盤須先收好才能交下一餐。
8. **擴建。** 用金幣升級餐廳、在打單機內買設備。工具箱可把兩格高的空木桶升為冰箱、空煙燻爐升為三槽爐灶、沒有盤子的洗碗池升為洗碗機。

普通單 **30 分鐘**、加急單 **10 分鐘**，從生成時計時。打單機每 **10 分鐘**刷新；餐廳最高 **8 級**。本版期限採真實時間，離開世界期間仍會到期；廚電在未載入時不補算烹調。

> 原版的營養門檻有意鼓勵更多料理。預設立牌只有四道菜；本包內建的 40 種原版食品總營養為 159，所以只靠這份原版食品表，預設門檻最多升至 Lv.3。繼續升級需要更多附加包料理、虛擬營養設定，或管理員調整門檻。

## 本版包含什麼

| 系統 | 本版可執行內容 |
| --- | --- |
| 訂單 | 普通／堂食／外送／加急／遠距／到店訂單；五種品質；候選互斥、逾時、取消、打包、交付和防重複領款 |
| 經營 | Lv.0–8、原版升級成本與營養門檻、營養及等級報酬倍率、小費、實物幣面額及找零、餐廳排行 |
| 菜單 | 最多 150 道不消耗食品的範本；40 種原版食品基礎表、自訂 food component 及管理員虛擬營養 |
| 操作台 | 背包與允許使用的 24 格內冰箱取料，5 格內供應架耗材，原生盤／袋擺放與再次拿取 |
| 餐盤 | 十種餐點逐段吃完、持續存在的髒盤、店主／員工收盤、提前收盤中斷動作、手動及自動清洗 |
| 廚電 | 27＋54 格冰箱上下獨立開門、每門 11 個姿勢；三槽爐灶；最多 16 盤及 66 個動畫姿勢的洗碗機；工具箱升級 |
| 顧客 | 兩套原版外觀、四種閒置變體、七個出場／取餐／用餐動作；普通無椅站立、到店需椅；原作普通坐席顧客的驚喜反應與加賞 |
| 小電驢 | 原車模型、四種染色、原生騎乘、54 格保溫箱、鳴笛、燈面發光、遙控器與回收 |
| 多人 | 餐廳店主／員工、供應來源權限、表單返回後重新驗權、跨重啟存檔保留 |
| 資源 | 12 方塊、15 顯式自訂物品加方塊自帶物品、5 實體、240 geometry、38 動畫定義；保留原 67 張 PNG 和 12 個 OGG |

「資源存在」和「完整原版動畫已由玩法驅動」是不同狀態。請參閱 [完整還原對照與缺口](docs/PARITY.md)、[視覺素材來源](docs/ASSET_PROVENANCE.md) 和 [實體／廚電適配說明](docs/RUNTIME_ADAPTATIONS.md)。

## 明確的改編與未完成項

- Java 的容器視窗改為基岩原生表單，沒有相同的拖曳、Shift 點擊與快捷鍵佈局。
- 冰箱保留上下分區與格數，堆疊上限遵守各 Bedrock 物品規則，沒有原版每格 128 件或內部食品展示。上下門各自開關；動畫由原作關鍵影格離散取樣，洗碗機未套用非等比例的機身擠壓效果。
- 核對源碼後確認原作顧客也是直接生成，並非進門尋路。普通堂食優先安排 24 格內的椅子，無椅才在 5 格內站立；到店顧客必須有椅子。特殊彩蛋人物、線上皮膚下載及女僕聯動仍未完成。
- 一般坐席堂食顧客有原作 10% 驚喜反應及 `1–4＋餐廳等級` 加賞；本版在交餐時一併付款，沒有延後至動畫末尾。提前收盤不扣回已付加賞。同位置的舊盘需先收走，Java 則會替換並掉落舊盘。
- 洗碗改為點擊開始並保持視線；沒有覆寫 `player.json`，因此玩家洗碗、拍手和專屬騎車姿勢並未全面還原。
- 小電驢採基岩原生載具物理；跳躍鍵／控制面板鳴笛。燈面會發光，沒有照亮周圍地形的動態投射光。
- 爐灶內建 9 條明確烹調對應，不會自動讀取任意其他附加包的配方。食物能放進菜單也不代表它的配方已能在爐灶烹調。
- Java 專屬 Jade、SDM Currency、Touhou Little Maid、Aeronautics／Sable 等聯動沒有直接移植。可以改用已安裝的基岩貨幣物品，並註冊特殊食品。
- 本版增加基本設備合成及商店取得途徑，避免生存開局無法取得第一批設備。商店價格屬首版適配值。

## 已做的驗證與界線

- `npm test`：**180 項通過**；直接測試發布用純邏輯與服務，包括訂單狀態、逾時、重複結算、找零、庫存、權限撤銷、廚電、顧客、餐盤及分片存檔。
- `npm run check`：真正的官方 stable 2.0.0 型別檢查，以及 JSON／geometry／動畫／圖標／recipe／custom component 引用驗證。
- `tools/bedrock_smoke.py`：以官方 BDS 載入本包，測試**真正的原生方塊、實體、ItemStack、庫存與發布用腳本配接器**，並重啟檢查存檔。
- 原生報告保存在 [docs/validation](docs/validation)，按版本保存，附引擎版本及測試時 runtime 檔案樹 SHA-256。

原生探針用真實容器配合程式化的玩家替身呼叫業務函式；**沒有真玩家連線，也未執行客戶端畫面、表單點擊、觸控、騎乘手感或網路延遲驗收**。詳細結果及不可推論的範圍見 [VALIDATION.md](docs/VALIDATION.md)。

存檔與原生物品欄不是同一個原子交易。收盤先保存已領取標記，防止重試或正常重啟後重領；若剛好在保存標記後、寫入物品欄前強制終止程序，可能少一個盤子。已知同步寫入錯誤有回復處理，但不宣稱任意崩潰時刻都能零損失。

## 管理員設定及相容

只有創造模式玩家、具有 `otc_admin` 標籤的玩家或伺服器端指令可更改全域設定。伺服器主控台沒有玩家時不能發放個人套組。

```mcfunction
/tag @s add otc_admin
/scriptevent ordertocook:kit
/scriptevent ordertocook:refresh
```

`kit` 是測試套組，`refresh` 是 24 格內打單機的測試刷新；**正常生存開店不需要它們**。

特殊食品／沒有可讀 food component 的飲品，需要先確保對應附加包已啟用，再登記：

```mcfunction
/scriptevent ordertocook:food {"typeId":"example:your_dish","nutrition":12,"label":"你的料理"}
/scriptevent ordertocook:config {"currencyItem":"minecraft:emerald"}
/scriptevent ordertocook:config {"currencyItem":""}
```

`example:your_dish` 是說明用佔位 ID，必須替換成真的已安裝物品。空貨幣 ID 恢復 oTc 幣。自訂貨幣每件視為 1 單位；更改只影響之後的付款，不會把已持有的舊貨幣自動兌換。

測試刷新間隔及門檻也可調整，例如：

```mcfunction
/scriptevent ordertocook:config {"refreshSeconds":30,"upgradeNutrition":[0,25,40,60,80,100,120,140,159]}
```

上例**會偏離原版平衡**。原版門檻為 `[0,40,80,120,160,200,300,400,600]`，刷新 600 秒。烹調對應擴充入口見 `SMOKING_RECIPES`、`FUEL_TICKS` 及 [RUNTIME_ADAPTATIONS.md](docs/RUNTIME_ADAPTATIONS.md)。

## 開發與重現

需求：Node.js 22+、Python 3.12+。已生成的資源納入版本控制，正常建置不需要下載原作或安裝美術工具。

```sh
npm ci
npm run verify
```

輸出位於 `dist/`，包含 `.mcaddon`、獨立 `.mcpack`、`SHA256SUMS.txt` 及 runtime 指紋。若修改來源模型或轉換器：

```sh
python -m pip install Pillow==12.3.0
python tools/convert_assets.py
npm run verify
```

轉換器預設使用 `upstream/reference/` 的固定來源子集，也可用 `--source /path/to/full/OrdertoCook` 指定完整上游 checkout。固定基準記錄於 [upstream/source.lock.json](upstream/source.lock.json)。

原生服務端測試需要從 [Minecraft 官方網站](https://www.minecraft.net/en-us/download/server/bedrock) 自行取得 Linux BDS，解壓到**沒有其他世界的獨立測試目錄**：

```sh
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode initial
python tools/bedrock_smoke.py --server-dir /path/to/disposable-bds --mode reload
```

探針不隨正式安裝包啟用；它只會被測試工具注入一次性的測試副本。

## 原作版本與授權

本次比對的 CurseForge 公開版是 **1.3.6**；選取的較新 GitHub 固定提交 `e59e3db` 的 Forge 版本欄位為 **1.3.7a**，兩者沒有混稱為同一版。已翻譯的規則及來源行號見 [UPSTREAM_RULES.md](docs/UPSTREAM_RULES.md)。

**GPL-3.0-only**。完整授權見 [LICENSE](LICENSE)，原作署名與修改說明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。不分發原版 Java JAR；本包包含的是基岩版派生作品。
