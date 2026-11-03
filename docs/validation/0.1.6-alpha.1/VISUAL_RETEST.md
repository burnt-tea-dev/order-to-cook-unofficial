# 0.1.6-alpha.1 視覺／音效重測記錄

## 範圍與證據層級

固定 Java 基準為 `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`。
改動前基準為本倉庫 `main@ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49`。
本候選保留既有 BP／RP UUID，pack version 為 `[0,1,6]`，npm 版本為 `0.1.6-alpha.1`。

**本記錄沒有把模型渲染圖或無頭伺服器輸出稱作遊戲畫面驗收。**

| 證據 | 能證明的內容 | 本次狀態 |
| --- | --- | --- |
| 固定 Java 程式、模型、動畫和貼圖 | renderer 真正使用的模型、UV、時間、事件數值 | 已逐項比對，見[修正說明](../../VISUAL_AUDIO_PARITY.md)與[音效事件審核](../visual-audio/SOUND_PARTICLE_AUDIT.md)。 |
| 腳本化離線圖 | 相同相機下的來源模型／舊轉換／新轉換形狀及像素貼圖 | 已生成，下方每張圖及 manifest 都標示非遊戲截圖。 |
| Node／Python／資源驗證 | 正式腳本狀態、物品不重複扣除、事件時點、轉換與幾何合法範圍 | 最終結果見「執行結果」。 |
| Bedrock Dedicated Server | 原生 block state、實體 property、存取及重啟後帳務 | 最終結果見 `native-initial.json`／`native-reload.json`。伺服器沒有畫面或音訊。 |
| Blockbench UI | 匯入後 GPU 材質與可視操作 | **未完成。**開啟 Blockbench Web 5.2.2 時回報 `Error creating WebGL context`；重載仍同樣失敗。來源 exporter 與資料結構可查，但不能報成 UI 驗收。 |
| 真 Java／Bedrock 客戶端 | 光照、透明面、連續播放、聽感、準星、多人的可見結果 | **未完成。**本工作環境沒有可用的遊戲客戶端畫面；不能以 BDS、CPU 圖替代。 |

## 離線差異圖

所有圖片使用 CPU 三角形深度緩衝、最近鄰像素取樣及固定正交相機。來源欄直接計算原始
signed cube 與完整骨骼 affine transform，不呼叫候選的姿態烘焙函式。Java Geo 材質原為
雙面；這份檢視也採雙面，因此不驗證 Bedrock GPU 剔除、光照、霧或透明混合。

- [focused-before-after.png](visual/focused-before-after.png)：Java 來源／舊 main／候選三欄；冰箱開口、洗碗機一盤／兩盤／機身縮放、原放盤外形、打單機和外送袋。
- [plates-41-stages.png](visual/plates-41-stages.png)：全 41 個餐盤階段，標示 stage 與餐點變體。
- [blocks-12-four-directions.png](visual/blocks-12-four-directions.png)：12 類方塊 × 北東南西，共 48 個姿態；圖中有方向軸與具體 state。
- [customers-two-skins.png](visual/customers-two-skins.png)：原兩套顧客皮膚，來源／候選的站姿、坐姿及背面檢查，包含外層 inflate。
- [manifest.json](visual/manifest.json)：每格來源、frame／time、state、相機、所有輸入和輸出 SHA-256；`is_game_screenshot=false`。

圖中最直接的修正是：冰箱內部不再被錯面背板封住；洗碗機一／兩盤不再顯示六片；
餐點放置起始外形不再被乾淨空盤替代；打單機與外送袋使用原作真正由 renderer 載入的
完整 Geo 模型及 PNG。沒有新畫食品或 AI 圖像。

## 執行結果

2026-11-03 UTC，在隔離的 Linux 工作目錄執行：

| 檢查 | 結果 |
| --- | --- |
| `npm run verify` | **354／354 Node 測試通過**；stable 2.0.0 型別檢查、資源檢查及建置通過。 |
| Python 幾何／餐盤／原生 schema 回歸 | **16／16 通過**；其中 13 項幾何、3 項餐盤與 float 屬性。 |
| 資源驗證 | 353 JSON、12 blocks、15 自訂 item 定義、5 entities、10 recipes、297 geometry identifiers、38 animation definitions、287 permutations；錯誤為零。數量只作盤點。 |
| 幾何邊界 | 全 241 個方塊模型 × 四方向，Double／Float32 的 Bedrock envelope 與 30px extent 通過。 |
| 原生首次載入 | **BDS 1.26.60.6：138／138 通過，content errors=0**，見 [native-initial.json](native-initial.json)。 |
| 原生重啟 | **同一 QA 世界 15／15 通過，content errors=0**，見 [native-reload.json](native-reload.json)。 |
| 來源／授權／發布政策檢查 | `check_compliance.py` 與 `check_release_policy.py` 通過；沒有建立 Release 或 tag。 |
| 離線圖重現 | 4 張圖、122 格、91 個輸入雜湊；連續重產圖片 SHA-256 一致，輸入指紋符合候選。 |

上述兩輪原生探針與最後建置的 **runtime tree SHA-256** 均為：

```text
931d32db4f08016ec633fc494292aa4b9326da72628a9e278a37fa5a342b6b57
```

原生探針實際抓到 `action_elapsed`／`placement_age` 的 float 預設值被序列化成整數 `0`
而拒絕載入的問題。已在轉換器改為 `0.0` 與浮點 range，並加入生成 JSON 型別回歸測試；
上表列的是修正後重新載入與重啟的結果，沒有把首次失敗抹成通過。

原生新增覆蓋包含 12 類四向 blockstate、冰箱 close selector、洗碗機預覽、打單機末端姿態、
外送袋原生 tick 自行完成、41 種餐盤 property 寫入、顧客 action 時鐘和十個粒子 API 呼叫。
既有測項繼續檢查原生 inventory／proof、餐盤實際時序、重啟及重複領取。粒子 API 接受呼叫
只能證明事件能送出，不能證明客戶端實際顏色、數量或聽感已驗收。

## 可重現步驟

### 程式／資源／幾何

需要 Node、Python、Pillow；離線渲染另用 NumPy 與 DejaVu Sans。版本與依賴沿用倉庫鎖檔，
不需要 Java mod JAR，也不在候選包中散布原版 Minecraft 貼圖。

```sh
npm ci --ignore-scripts
python tools/convert_assets.py
npm run verify
python -m unittest discover -s tests -p 'test_*.py'
python tools/check_compliance.py
python tests/check_release_policy.py
```

原始來源與可編輯轉換器已在倉庫內。重新生成後用 `git diff --exit-code -- runtime` 檢查
生成資源一致；不要逐個手改輸出的 `.geo.json`。

### 產生相同離線對照圖

在乾淨 clone 根目錄，先建立固定 baseline 的暫存目錄：

```sh
mkdir -p /tmp/otc-visual-baseline
git archive ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49 runtime tools/convert_assets.py upstream/reference | tar -x -C /tmp/otc-visual-baseline
python tools/render_visual_review.py --baseline /tmp/otc-visual-baseline
```

工具輸出附輸入雜湊，沒有依賴本次工作機的絕對路徑。這能重現**離線模型圖**，不會啟動遊戲。

### 原生伺服器探針

使用自行從官方取得、獨立解壓的 Bedrock Dedicated Server；此目錄不能是實際玩家伺服器。
runner 拒絕含非 QA 世界的目錄，僅綁測試埠 24981／24982，使用空 allowlist。

```sh
python tools/bedrock_smoke.py --server-dir /tmp/otc-visual-bds --mode initial
python tools/bedrock_smoke.py --server-dir /tmp/otc-visual-bds --mode reload
```

runner 把正式 BP／RP 和原生探針複製到獨立目錄，完成後關閉伺服器，輸出 JSON 記錄
server version、runtime tree SHA-256、逐項結果及 content log 錯誤。重啟使用同一個 QA 世界。

## 真客戶端重測清單（本次未完成）

Java 端使用固定提交；Bedrock 端使用本候選包。兩邊保持原像素材質、相同視角與相近光照，
以 60 fps 擷取，保留未裁切畫面、遊戲版本、座標、方向、操作時間和影片時間碼。
可在測試世界以 `/tag @s add otc_admin`、`/scriptevent ordertocook:kit` 取得 Bedrock 測試設備。

| 場景 | 具體操作與應觀察內容 |
| --- | --- |
| 12 類／四方向／掉落 | 面向四方向各放一件，拍正面、側面及頂面；破壞並數本體／庫存。冰箱上下各拆一次；帶 proof 成品只能回收一次。立牌／打單機 NBT 掉落差異仍存在。 |
| 冰箱 | 分別開上、下門；在約 0.2／0.5／0.8 秒關閉再打開；拍內壁和門邊，聽四個音高；檢查多人分層觀看者及重載後收門。櫃內食物和整櫃共同 squash 尚未等價。 |
| 洗碗機 | 分別放 1／2／3／8／16 盤；拍門、抽屜和機身壓縮，檢查第 14 tick 放盤音及第二洗滌週期。主／副手持髒盤準星看向、移開、換手；預覽不扣盤。兩人視角下本版共享預覽。 |
| 打單機 | 刷新普通候選單，錄升紙一秒和末端保持；接單立即收紙；只留到店單時不顯示紙；升級提示音不重印；重載候選單保持末端。 |
| 外送袋 | 成功裝包、桌面領取、手持重新擺放；錄 0.5 秒彈動，檢查原貼圖。動畫期間取回或拆掉，仍只有一份有 proof 成品。 |
| 餐盤 41 階段 | 覆蓋十種 variant，逐一錄 0、0.75、3、4、5 秒附近，確認食物位置、消失和髒盤；第 5 秒前／後收盤、重載及客戶端晚加入不重播空盤。 |
| 顧客 | 兩套皮膚、站／坐四個 idle；七個 action 分別錄完整片段。驗證產生、交餐、爆炸／縮小、提前收盤的播放點與消失；晚加入應追上當前 action。 |
| 音效／粒子 | 依[事件表](../visual-audio/SOUND_PARTICLE_AUDIT.md)逐個操作，核對聲源、音量、音高、數量／色彩／位置／時間；喇叭按 Player 類別。錄影不能只證明素材檔存在。 |

## 已知剩餘差異

1. 冰箱內八個食品 stack 陳列尚未實作；上下半櫃尚未共用一次根骨骼 squash。
2. 方塊有限姿態與 Java 連續骨骼渲染存在取樣差；冰箱中途反轉倒播當前片段以保持角度連續。
3. 原非均勻父縮放造成 shear，cuboid 擬合上限為洗碗機 0.259641614 px、冰箱 0.086176984 px。
   少數冰箱中間姿態另有至多 0.126 px 的整扇門邊界平移；原端點／尺寸／UV 不變。
4. 洗碗機預覽為多人共享的 block state；Java 為個別客戶端。原 timer=0 轉 phase 多一 tick 的邊界仍有差。
5. Java 粒子後續速度衰減、生命週期、portal 曲線和 bubble-pop sprite 動畫未逐幀等價；顧客服務仍每五 tick 更新。
6. 立牌菜單及打單機身份／餐廳 NBT 尚未隨掉落物保存，不能標為完整掉落 parity。
7. 爐灶火焰／點火聲的另一份工作見 [PR #19](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/19)，沒有在本分支重複合入。
8. 特殊彩蛋人物／網路皮膚不在已保留的兩套基本顧客外觀內。玩家骨骼由另一代理處理。

上述項目與 Blockbench／實際 Java、Bedrock 畫面驗收仍待完成；本候選應按這個範圍審查。
