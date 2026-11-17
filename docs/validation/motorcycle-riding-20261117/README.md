# 機車乘坐曲線：接續目前共享分段來源

2026-11-17 HKT。基準 main：`1c47c5779e6b7a7ef111c70a276541d84468eb74`，
OTC 配對 `0.1.70-alpha.1`。Java 固定
`breezeth-CN/OrdertoCook@e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`，Forge 1.20.1。

## 本輪選擇與舊 PR 的處理

先重讀 AGENTS、PARITY、最新 main 及全部 15 個開放 PR 的檔案清單。
main 的 P208 來源整合已包含正向 wheel X、`drive_action` caller、五個片段的
classic/slim 分段人物 exporter。因此舊 PR #82 的 rigid idle 模組及獨立
`playAnimation` 路徑不再適合覆加。本輪沿同一 PR 合併最新 main，以其完整內容
為基準，退役舊 PR 專用的 runtime、生成器分支及對應測試／預覽入口。
舊證據完整保留在 [b8d078b 歷史提交](https://github.com/burnt-tea-dev/order-to-cook-unofficial/commit/b8d078b89d694669866ac869d7f5f9b2cebe724f)，不改寫舊數字。

本次只修目前 `make_player_riding_source` 的來源曲線遺失。沒有第二個人物定義、
另一套 idle 控制器、車座／眼位補償或速度積分。`runtime/`、manifest、baseline
及 release history 保留目前 main；共享人物生成結果仍須由既有 Grilling/Core
owner 組裝和配對。本次未修改那些倉庫或部署其產物。

## 可重現的來源差異

固定 [drive.animation.json](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/common/src/main/resources/assets/ordertocook/animations/drive.animation.json)
五個片段包含下列曲線 metadata：

| 片段 | 長度（秒） | Catmull-Rom 節點 | easeOutElastic 節點 | pre 節點 |
| --- | ---: | ---: | ---: | --- |
| drive_idle | 8 | 26 | 0 | head rotation，4.0 |
| drive_back | 8 | 0 | 0 | 無 |
| drive_didi | 1.3333 | 12 | 3 | right_arm rotation，1.3333 |
| drive_didi_repeat | 1.06 | 10 | 3 | right_arm rotation，1.06 |
| drive_didi_light | 0.8333 | 12 | 3 | right_arm rotation，0.8333 |

原路徑先 `unwrap_vectors`，會丟失 vector wrapper 的 easing／easingArgs；
之後 generic `sample_channel` 沒有處理 `lerp_mode`，且讀到 post 就忽略 pre。
這令需要重新計算父座標的上臂／頭部變成線性過渡，部分下肢則仍留原始
Bedrock metadata，形成不一致的曲線解讀。

實際 decoder 以固定 GeckoLib 4.8.3 為準，不能只採相同名字的通用曲線：

- [BakedAnimationsAdapter.java](../visual-audio/placement-poses-20261109/source/gecko/BakedAnimationsAdapter.java)：
  `addBedrockKeyframes` 把非零時間的 pre 放在 `t−0.001`，post 的 lerp_mode
  轉成 easing；`buildKeyframeStack` 由目的節點選 easing；`addSplineArgs`
  以該段起點及下一段終點補 Catmull-Rom anchors。
- [EasingType.java](../visual-audio/placement-poses-20261109/source/gecko/EasingType.java)：
  `CatmullRomEasing.getPointOnSpline` 及原 elastic 公式。兩份既有來源快照固定於
  GeckoLib `e81962eefd04e0cab90445d3df37b477d2767ffd`。

新路徑先讀 raw source，僅為五個 riding 片段預烘來源曲線，再交原分段父鏈轉換。
時間集合為 20 TPS 加來源／展開節點；常量收斂成單一向量。使用普通 Bedrock
線性向量 keyframes，不依賴新增實驗 API。[正式動畫 schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/actor_animation.v1.8.0?view=minecraft-bedrock-stable)
支援 position／rotation／scale 的時間 keyframes。取樣點間仍是線性近似，
不宣稱連續時間與 Java 完全相等。

`drive_back` 的 Java controller 使用 `thenLoop`，所以保留現 exporter 的 loop
政策；不因原 JSON 的 hold-on-last-frame 改回停止。原 selector、`q.state_time`、
clip length、模型 root、雙骨架、Item／衣物路由及共享 composer 契約都不改。

## 開放 PR 重疊

| 範圍 | 其他 PR | 本輪界線 |
| --- | --- | --- |
| entities.js | #11、#77、#92、#98 | 已讀實際 patch；本輪不改 runtime，保留 main 的 caller。 |
| convert_assets.py | #87、#88、#95 | 已讀實際 patch；它們是幾何／冰箱物品／副手物品段落，沒有 riding exporter hunk。只在原 riding 入口接專用 helper。 |
| README／PARITY | 多個候選 | 只加本輪來源說明及更新機車列，不整檔替換別人段落。 |
| 原型、配方、爐灶 UI、AGENTS | #63、#93、#91、#89 | 不修改。 |
| 冰箱／洗碗機 | #81、#96、#97 | 不修改。 |

檔案層級重疊不等於已取得排他 owner 批准。整合仍須保留各 PR 的獨立 hunk。
本輪不以新包版本覆蓋其他候選，也沒有把任何 open PR 當成已合併。

## 轉向與倒車輪速的 API 重查

2026-11-17 重新檢查正式 stable [InputInfo](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputinfo?view=minecraft-bedrock-stable)、
[InputButton](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputbutton?view=minecraft-bedrock-stable)
與官方 samples。getMovementVector 仍只宣告 Vector2；按鍵 enum 仍為 Jump／Sneak。
本次沒有建立自訂乘座下輸入軸正負、不同裝置／控制模式與 Java strafe 的橋接。
這是已查來源的界線，不是宣稱平台永遠無法做到。

固定 Forge 來源位置與資料流如下；Java 的變量符號沒有直接套到基岩輸入軸：

| 用途 | 固定 Java 來源與正負 | 現行基岩界線 |
| --- | --- | --- |
| 轉向 | [MotorcycleEntity.java:180–195](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L180-L195)：`player.xxa > 0` 對應 target −45°，負值對應 +45°，每 tick 逼近 4.5°。 | 尚未證明正式 `getMovementVector` 在自訂乘座下對應這個來源；不綁把手／前輪。 |
| 輪子相位 | [同檔:197–207](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L197-L207) 以 `player.zza` 更新獨立 `internalSpeed`；[284–287](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L284-L287) 在其絕對值大於 .001 時累加 `internalSpeed × 25`。 | 現有 `q.modified_distance_moved × 114.6` 保留無方向距離語義；正 X binding 已在 main，仍非 signed speed parity。 |
| 倒車人物姿勢 | [RiderAnimatable.java:288–317](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/gecko/RiderAnimatable.java#L288-L317)：實際 `getDeltaMovement` 在 `−directionFromRotation` 的投影小於 −.01 時選 `drive_back`；idle/back 使用 `thenLoop`。 | main 的 caller 使用基岩車輛實際 velocity 在原生車頭軸的投影；不能拿這個資料替代上一列的 internalSpeed。 |

Java 的把手／前輪 Y 與前後輪 X binding 可查
[MotorcycleModel.java:93–105](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java#L93-L105)。
基岩官方 [yaw 定義](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/commandsreference/examples/commandtypes/type_rval?view=minecraft-bedrock-stable)
為 0° 南、90° 西、180° 北、−90° 東，支持現 caller 的
`−sin(yaw) × vx + cos(yaw) × vz` 原生前向投影。
[Entity.getVelocity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable#getvelocity)
頁面只稱目前 velocity vector，未提供本次可據以證明的跨引擎單位等價；不補上 Java 特有的負向車頭因子。

目前 main 的倒車**人物姿勢**讀實際車輛 velocity／yaw；其方向與 Java rider
的實際 motion projection 是同類數據。Java **車輪相位**卻讀獨立 internalSpeed，
碰撞／空轉／推動時不可用位移或原生速度替代。因此本輪不為車輪接上推測的正負號，
也不把現行 −0.01 門檻稱為已驗證的跨引擎數值等價。

## 驗證與預覽

| 檢查 | 本輪結果 |
| --- | --- |
| `npm run verify` 的既有 core lane | 328/328 Node tests，0 fail、0 skipped；TypeScript、526 JSON／452 geometry／45 animation 靜態檢查及 .70 配對建置通過。這不是 `verify:full`。 |
| `test_segmented_player.py` | 16/16，含新增 3 個經實際 exporter 的回歸；classic/slim 都測試。 |
| 舊實作負向控制 | 在記憶體用固定 main 的原 `make_player_riding_source` 取代修正入口，新曲線／pre 兩個測試均如預期 FAIL、0 errors；idle 右臂角點誤差 0.0121960 > 0.0001，另一例缺少 3.999 key。 |
| CLI／身份 | 從 `/tmp` 呼叫正式 CLI 成功，5 個 JSON 均符合預覽 hashes，license 相同；模型／controller／共享 contract 與 main 相同。 |
| 合規／發布政策 | 968 source references，errors=[]；既有 release-policy 通過。 |
| 語法／差異 | 四個本輪 Python 檔案可編譯；`git diff --check` 通過。 |

新增測試以手算來源向量及既有獨立父鏈／角點計算核對輸出，沒有把新 baker
當作期望值。涵蓋 idle 的 Catmull、三種 horn 的 Catmull／elastic、可區分的
pre/post 變異、easingArgs 變異及未知 curve 拒絕；`drive_back`、常量與原 loop／clock
政策都有回歸。測試證明取樣資料與模型空間轉換，不證明原生 controller 播放。

例如 classic 匯出的 idle 0.5 秒右上臂 X 由 −91.648075° 改為 −91.491825°，
左上臂 X 由 −94.148075° 改為 −94.460575°；horn 0.2 秒右前臂 Z 由
−44.933612905° 改為 −61.852955°。來源 idle 兩臂的獨立 Catmull X witness
為 −73.59375°／−76.5625°；它們與匯出值屬不同父座標，不能直接相減當誤差。

完整 runtime 與 main byte-identical，`runtimeTreeSha256` 保持
`89e88a4dbb3fb2a19af38740114a76be6a9bc01b2097446fa3cae35e33d5f2fe`。
沒有重新編號候選包，亦未重寫先前 PR 的測試數字。遠端 CI 的具體 head／run 結果
在 PR 描述記錄，未執行的 full／assets／rig lanes 不列作通過。

### 重現命令

先取得下節列出的固定 Mojang 輸入與 license，放在 repository 外。以下三個
`OTC_NATIVE_*` 變量指向其絕對路徑，`OTC_REPO` 指向本 checkout，輸出放在倉庫外。

```sh
npm ci --ignore-scripts
npm run verify
OTC_NATIVE_PLAYER_GEOMETRY="$OTC_NATIVE_CLASSIC" \
OTC_NATIVE_SLIM_GEOMETRY="$OTC_NATIVE_SLIM" \
python3 -B -m unittest discover -s tests -p test_segmented_player.py
python3 tools/check_compliance.py
python3 tests/check_release_policy.py
git diff --check

# 可從 /tmp 執行；需要同時提供兩套真正的 native geometry 及 license。
python3 "$OTC_REPO/tools/convert_assets.py" --player-riding-only \
  --segmented-player-native "$OTC_NATIVE_CLASSIC" \
  --segmented-player-slim "$OTC_NATIVE_SLIM" \
  --native-player-license "$OTC_NATIVE_LICENSE" --output "$OTC_RIDING_OUTPUT"
python3 "$OTC_REPO/docs/validation/motorcycle-riding-20261117/preview.py" \
  --native-classic "$OTC_NATIVE_CLASSIC" --native-slim "$OTC_NATIVE_SLIM" \
  --native-license "$OTC_NATIVE_LICENSE" --output "$OTC_PREVIEW_OUTPUT"
```

CPU 預覽另需 NumPy／Pillow；讀取固定 main 的 Git object，需 checkout 保有該歷史。
此處路徑變量只為重現，並非需要部署至使用者電腦。

### 真實匯出與檔案身份

由 repository 外的 `/tmp` 執行正式 `--player-riding-only` CLI，輸出 5 個 JSON
及所供應的 Mojang license，共 40 個動畫片段（2 種骨架 × 5 動作 × 4 parts）。
所有 5 個 JSON 的 SHA-256 均與預覽使用的 candidate 匯出吻合，license 原樣複製。
動畫 JSON 為 1,373,672 bytes，SHA-256
`84adc07d1af39d8e92ae761c458606b819d6887a1d6402808dc57bac08b79770`。
原 main 為 734,792 bytes，增加 638,880 bytes（86.95%），原因是曲線預烘成數值 keys；
常量通道已收斂。這是未壓縮共享來源檔大小，沒有測量客戶端 RAM、FPS 或載入耗時。
修前／修後的 controller、classic/slim geometry 與 `player-riding.json` 全部 byte-identical。

輸入為 Mojang/bedrock-samples 固定
`15701fa9c13923f12662984c32c124327e40e3d3` 的
[humanoid.custom.geo.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json)、
[mobs.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/mobs.json)
及 [LICENSE.md](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/LICENSE.md)。
原生輸入及生成幾何均留在 repository 外，沒有隨 PR 重新分發。
[preview-manifest.json](preview-manifest.json) 記錄 source/helper/renderer、原生輸入、
全部修前／修後匯出與圖檔的完整 hashes。其 candidate git head 是製作時尚未提交的
父提交，候選身份應以所列 working-tree hashes 及包含它的最終 PR commit 為準。

### 模型／動畫預覽

[修前／修後姿勢圖](riding-before-after.png) 使用實際 main／candidate exporter，
把 body、head、right、left 四個輸出 parts 合併後渲染同一組分段人物。
[喇叭 GIF](horn-before-after.gif) 有 28 幀、800 × 884，使用明確片段時間；
為方便比較而重播 GIF，不代表遊戲裡的單次喇叭動畫循環。

| 模型角點最大位移（model pixels） | Classic | Slim |
| --- | ---: | ---: |
| idle，0.5 秒 | 0.0545784 | 0.0538696 |
| horn，0.2 秒 | 2.1223685 | 2.0679768 |
| back，0.5 秒 | 3.33e−7 | 3.33e−7 |

這是修前／修後的差值，不是 Java parity 誤差；back 的微小值來自取樣數值捨入。
28 幀喇叭比較中的最大差值為 3.0488108 model pixels。已實際檢視 PNG 及 GIF
代表幀，圖中採除錯色，沒有 skin、衣物覆層、盔甲或持物材質的驗收。預覽不包含車輛、
原生 look、controller blending、網路或相機；模型及各項時間樣本的來源正確性另由測試核對。

## 未驗證範圍

本輪沒有使用 BDS、Minecraft 客戶端、使用者電腦或 LIVE。沒有重新組裝／安裝
共享玩家 pair；可見 skin 選型、衣物／盔甲／持物、姿勢轉換、座位接觸與攝影機
均未觀察。既有 `q.state_time` 循環邊界與中斷／重啟時機也未作原生驗證。
轉向、帶符號 wheel/internalSpeed、FP、自動頭盔與原生物理差距保留。
另有獨立 caller 差異：[main 的 motorcycleGesture](https://github.com/burnt-tea-dev/order-to-cook-unofficial/blob/1c47c5779e6b7a7ef111c70a276541d84468eb74/runtime/BP/scripts/entities.js#L703-L724)
每次 gesture 立即切換 phase；即使 reverse 優先序抑制了 horn/light，也可能切換 back
的 controller state。上列 Java reverse 分支沒有相應 `forceAnimationReset`。
本輪不改由其他 PR 同時處理的 runtime caller；這項差異保留待獨立修正與原生確認。
沒有合併至 main、Tag、Release 或部署。
