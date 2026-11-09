# 餐盤來源測試的 CI 覆蓋修正

## 實際發現

在 `main@4914962ed9be585614f0aca495433a1b9cc6fbc6` 獨立執行
`python -m unittest discover -s tests -p test_dining_assets.py -v`：四項測試中一項失敗。
`test_native_plate_keeps_java_collision_and_all_stable_models` 還期待舊版 geometry 字串。

`6cfcd47876a6fab82db8ee27cf0c28f33ca59921`（0.1.27）已為實際客戶端的零尺寸模型錯誤，
改用有有限大小的占位網格，並以 `bone_visibility: {root: false}` 隱藏。
正式資產與生成器採用物件形式是正確的；這次不是新發現餐盤破圖，也沒有還原該修復。

一般驗證及候選打包兩份 workflow 只執行 appliance geometry suite，沒有呼叫 dining assets suite，
所以舊斷言和該 suite 專屬的 40 階段 UV／原像素核對沒有在這兩條 CI 路徑持續執行。

## 修正

- 更新斷言為精確的 geometry identifier 及 `root: false` 可見性物件，不是放寬為「只要 identifier 一樣」。
- 在 `build.yml` 及 `prepare-candidate.yml` 現有 Python 幾何步驟加入 dining assets suite。
- 沿用既有固定 Pillow 版本、觸發條件及權限，沒有增加下載來源或 workflow 寫入權限。
- 不改 runtime、轉換器、版本、模型、材質、動畫或發布產物。

## 本機驗證

- 修正前：dining assets 3 通過、1 失敗（舊字串預期與實際物件不符）。
- 修正後：dining assets 4／4、appliance geometry 23／23、CI scope 8／8 通過。
- 初始 .40 基線的 `npm run verify`：784／784 Node 測試、TypeScript、資源檢查及建置通過。
- 發布前整合 .41 `15d8b3d41d7a12ccf1b29f99a3e19044fa3208d7`；此四檔修正不含 runtime 改動，並重跑完整驗證：799／799 Node 測試、TypeScript、資源檢查及建置通過；Python 4／23／8 全數重跑通過。
- 兩個記憶體內反向測試，把正確設定分別替換成舊字串及 `root: true`；新的測試都確實失敗，沒有寫入正式資產。
- 沒有新做 Minecraft、BDS 或 GUI 渲染驗收。此修正補回自動化測試覆蓋，不會把先前未測視覺項改成通過。
