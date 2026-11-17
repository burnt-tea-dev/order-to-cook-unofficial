# 保留乘坐曲線品質的資料精簡

2026-11-18 HKT。接續同一 Draft PR #82，量測基準為已修正 Gecko 曲線的
`ff19994ba426341c310d76839f13f605a5dbcbb7`。main 仍為
`1c47c5779e6b7a7ef111c70a276541d84468eb74`，配對仍為 `0.1.70-alpha.1`。
Java 固定 `breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`
的 Forge 1.20.1；[前輪來源曲線修正與預覽](../motorcycle-riding-20261117/README.md)
保留原提交與原數字。

## 改善的原因與範圍

前輪為保留 Gecko Catmull／elastic／pre，先用 20 TPS 加來源／展開節點預烘，
再計算分段人物的父座標轉換。這樣能保留來源樣本，但最後輸出仍留下大量
全程相同的數值及完全線性的中間 key。對應的動畫檔因而增至 1,373,672 bytes。

本輪僅在 `segmented_player_action_pose` 完成原有 rounding 之後呼叫
`tools/motorcycle_curves.py::compact_linear_bones`：

1. 從零秒開始、每個向量完全相同的 track，改成同值常量向量。
2. 以 `Fraction(time_key)` 及 `Fraction(str(number))` 讀取實際序列化的十進位值。
   只有三軸都符合精確共線交叉乘法時，才刪除中間點；不設 epsilon 或品質誤差預算。
3. 所有變動 track 保留首末 key。保留每個 bone／channel，包含 neutral 值；
   保留 clip length、loop、clock、override、40 個片段與全部 alias。

精簡在非線性的父座標轉換**之後**進行。來源的 20 TPS／展開節點仍全部參與轉換，
沒有降低取樣頻率、貼圖解析度、骨架或模型精度。Fraction 只在離線生成工具使用，
不會增加遊戲每 tick／每 frame 的 Python 或 Script API 工作。

## 正式格式依據與等價界線

- [Animations Overview / Key frames](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationsoverview?view=minecraft-bedrock-stable#key-frames)
  說明 keyframes 間的線性插值；其旋轉範例為 0→180→360 度，故不擅自取 modulo
  或改成角度最短路徑。各軸數值先疊加，之後才產生 transform。
- [Animation Controllers / Channels](https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationcontroller?view=minecraft-bedrock-stable#channels-rotation-position-scale)
  說明沒有時間 keys 時建立 `t=0.0` 的單 key；常量向量屬正式動畫格式。
- [Actor animation schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_animation.v1.8.0?view=minecraft-bedrock-stable#animations)
  定義 `loop`、`anim_time_update`、`override_previous_animation`；本輪全部保留。

依上述線性語義，兩端之間的精確共線中點可移除而保持同一函數，這是數學推論，
不是官方對壓縮工具的保證。核對以已修正曲線的 ff19994 匯出為基準；原先 20 TPS
對 Java 連續曲線的近似界線仍存在。原生浮點計算順序可能有微量捨入差異，
不聲稱 GPU／客戶端逐 bit 相同。

## 實際資料量

兩版都經正式 exporter 產出，採相同 `indent=2` 格式。數字不是只靠移除空白取得。

| 指標 | ff19994 | 精簡後 | 變化 |
| --- | ---: | ---: | ---: |
| 動畫 JSON bytes | 1,373,672 | 345,674 | −74.84% |
| 同樣移除空白的 JSON bytes | 379,697 | 113,303 | −70.16% |
| Time keys | 13,352 | 2,746 | −79.43% |
| 向量記錄 | 13,728 | 3,174 | −76.88% |
| Channel 數值項 | 41,184 | 9,522 | −76.88% |
| 動畫片段／bone channels | 40／518 | 40／518 | 相同 |

其中 52 條全常量 tracks 原有 3,574 keys；收斂後只需 52 個向量。
其餘移除了 7,032 個精確共線中間 keys。原 main 在曲線修正前為 734,792 bytes；
目前保留修正後品質的匯出比它還小 52.96%。

JSON 資料記錄、數值與索引減少，可減少輸入解析及儲存的原始資料負擔。
引擎可能另行編譯／壓縮動畫，官方沒有提供每個 key 對應的 RAM 或 CPU 成本。
**74.84% 檔案減量不等於 RAM 減少 74.84%，也不能換算 FPS、卡頓或載入時間。**
本輪沒有量測這些原生指標，亦未拿 Python／Node heap 代替 Bedrock 記憶體。

## 品質驗證與預覽

[measure.py](measure.py) 從固定 ff19994 的 converter **及 helper** 建立隔離的基準，
與當前正式 exporter 使用相同來源和原生輸入；沒有讓基準偷用新 helper。
獨立 evaluator 不匯入 production compactor，只讀兩版實際輸出。
[results.json](results.json) 包含完整分動作統計、來源與輸出 hashes。

| 核對 | 結果 |
| --- | --- |
| 全通道曲線 | 518 channels、13,210 個線性區間、54,394 次有理數向量核對，全數精確相同。 |
| 核對時間 | 所有原／新 key 聯集、各段 1/4／1/2／3/4、首尾外延；各分段邊界相等可證明段內線性函數相等。 |
| 普通浮點求值 | 最大分量差 `1.4210854715202004e−14`；這是離線算術捨入，不是 native 實測。 |
| 完整模型 | 兩種骨架共 42 個姿勢、20,160 個 face corners；含所有輸出 cubes／衣物／hat／cape，最大差 `5.102196573270515e−15` model pixels。Face corners 會重複計算共用頂點。 |
| 六組預覽圖格 | before／after changed pixels 全部為 0；已檢視 PNG，無文字／模型裁切。 |
| 其他生成檔 | classic/slim geometry、controller、player-riding.json 與基準逐 byte 相同；正式 CLI 另確認 license 原樣複製。 |
| 既有分段人物回歸 | 16/16 PASS；未改斷言，前輪 curve／pre／easingArgs／back／loop／clock 案例保持。 |
| 正式 CLI | 從 `/tmp` 成功匯出 40 clips、5 JSON 及 license；動畫 hash 與 audit candidate 相同。 |

[poses-before-after.png](poses-before-after.png) 為 1440 × 1285 的 CPU 模型圖，使用
除錯色、neutral look 與空手。圖格為看清姿態而隱藏覆層；上表完整模型角點核對
沒有排除覆層。預覽不包含原生動畫 controller、混合、皮膚／持物材質或網路行為。

動畫 SHA-256：

- ff19994：`84adc07d1af39d8e92ae761c458606b819d6887a1d6402808dc57bac08b79770`
- 精簡後：`b45d464e3c874a41bbec7b3f439750899652171761b5c3396035fca62123160c`

結果檔的 candidate git head 是製作時尚未提交的父提交；候選身份以所列 working-tree
source hashes 及包含它的最終 PR commit 為準。既有 `npm run verify` core 流程
328/328、TypeScript、526 JSON／452 geometry／45 animation 靜態檢查與配對 build
通過；合規 968 source references、release policy、Python 編譯及 diff check 通過。
這不是 `verify:full`；遠端 CI 的具體 head／run 與 skipped lanes 在 PR 描述記錄。

## 重現

沿前輪同一固定 Mojang/bedrock-samples
`15701fa9c13923f12662984c32c124327e40e3d3` 的 classic geometry、mobs.json 中
獨立 customSlim 及 LICENSE.md；全部放在 repository 外。
以下路徑變量均使用絕對路徑：

```sh
OTC_NATIVE_PLAYER_GEOMETRY="$OTC_NATIVE_CLASSIC" \
OTC_NATIVE_SLIM_GEOMETRY="$OTC_NATIVE_SLIM" \
python3 -B -m unittest discover -s tests -p test_segmented_player.py

python3 "$OTC_REPO/tools/convert_assets.py" --player-riding-only \
  --segmented-player-native "$OTC_NATIVE_CLASSIC" \
  --segmented-player-slim "$OTC_NATIVE_SLIM" \
  --native-player-license "$OTC_NATIVE_LICENSE" --output "$OTC_RIDING_OUTPUT"

python3 "$OTC_REPO/docs/validation/motorcycle-riding-20261118/measure.py" \
  --native-classic "$OTC_NATIVE_CLASSIC" --native-slim "$OTC_NATIVE_SLIM" \
  --native-license "$OTC_NATIVE_LICENSE" --output "$OTC_REVIEW_OUTPUT"

npm run verify
python3 tools/check_compliance.py
python3 tests/check_release_policy.py
git diff --check
```

量測腳本需要 NumPy／Pillow 及包含 ff19994 的 Git 歷史。它從該提交讀取固定
converter／helper，使用同一來源及原生輸入與當前正式 exporter 作 A/B；
模型輸入與生成幾何只在 repository 外／暫存目錄，未隨 PR 重新分發。

## 整合與仍未驗證的部分

重新核對 AGENTS、PARITY、最新 main 與全部 15 個 open PR。#87／#88／#95 的
converter patches 沒有 riding exporter hunk；本輪只在既有 PR 的專用 helper
及該入口加最小修改，不改其他 generator／runtime。沿用既有測試，沒有新增或修改
tests、CI、版本或配對資料。前輪歷史預覽與證據未重寫。

共享來源仍須由既有 Grilling/Core owner 重新組裝才會進入實際玩家 RP；本輪未改
那些倉庫、安裝包或世界。OTC runtime／配對與 main 完全相同，沒有部署收益聲明。
轉向、signed wheel、FP、skin／衣物／盔甲、持物、camera、controller blending、
長時間 loop、gesture restart 及網路等先前差距維持原紀錄。

沒有使用 Minecraft 客戶端、BDS、使用者電腦或 LIVE；未作原生 RAM／FPS／載入驗收。
保持 Draft，沒有合併、部署、Tag 或 Release。
