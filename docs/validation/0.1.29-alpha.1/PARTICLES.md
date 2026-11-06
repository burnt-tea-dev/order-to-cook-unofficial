# 粒子初始化修復：0.1.29-alpha.1

2026-11-06，新客戶端 ContentLog 有 3 則 Molang 錯誤，指向 sparkle／splash 的
`creation_expression`，明確拒絕 `??` 左側不是直接變數的寫法。這是正式028來源
仍可生成的缺陷；不歸為舊快取，也不以舊 BDS errors=0 否定它。
同一日誌的 UI 錯誤由其功能來源另行處理，不由本修復聲稱消除。

## 實際修正

`tools/convert_assets.py:make_feedback_particles` 的九種短發射器共用初始化。
原 `variable.spread.x/y/z` 改為 `variable.spread_x/y/z`，預設仍為0；數量預設1，
速度預設0。offset 使用同一組直接變數。實際重新執行該生成器產生九份JSON，
沒有直接手改生成檔，也沒有改不受此模板影響的 explosion。

`runtime/BP/scripts/audiovisual.js:playEffects` 同時以 `MolangVariableMap.setFloat`
傳入三軸原值，取代原 `setVector3`。兩種 API 的輸出名稱按目前
[@minecraft/server 文件](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/molangvariablemap?view=minecraft-bedrock-stable)
及倉庫固定2.11.0型別核對；[Molang預設值語義](https://learn.microsoft.com/en-us/minecraft/creator/documents/molang/syntax-guide?view=minecraft-bedrock-stable#null-coalescing-operator)
與本次客戶端限制分開記錄，沒有聲稱文件保證所有struct分量可作該運算。
既有原生 smoke fixture 也改用同名數值，但本輪沒有重開BDS。

粒子數量、Gaussian計算、三軸幅度、blocks/tick到blocks/s換算、位置、事件時序、
壽命、材質及音效保留。沒有新增排程、持久欄位、相容分支或全域覆寫。

## 驗證與範圍

- 新Python回歸直接呼叫真粒子生成器到暫存目錄，核對每份生成資料等於提交資源，
  並核對九種初始化及三軸offset契約。修前九種均失敗，修後通過。
- 新Node回歸直接匯入並執行真 `playEffects` 和正式事件cue來源，記錄傳入map的
  數字及實際 `spawnParticle`；涵蓋全部十種粒子，另以三軸不同的輸入確認沒有交換分量。
  不抽取、替換或執行截出的業務原碼。修前無法滿足scalar契約，修後通過。
- 既有appliance-particles與audiovisual回歸共十項通過，保留原數量／時序／位置行為；
  必要完整verify、生成器及發布檢查由本PR的CI執行。

BP／RP／modules／相依配對0.1.29，UUID／API／最低引擎及實驗要求不變。
精確payload只查 `baseline.json` 及append-only `release-history.json`。
未改幾何、指南、保存或玩家資料，沿用它們未受影響的有效證據；沒有重播保存、
啟BDS或改LIVE。客戶端重新載入後的ContentLog、可見粒子及FPS沒有新結果；
這不新增真人驗收門檻。整批保存／部署仍由共同端持有。
