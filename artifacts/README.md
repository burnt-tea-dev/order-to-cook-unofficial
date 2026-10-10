# 安裝包

目前版本：**0.1.2-alpha.3**，行為包及資源包的數字版本均為 **0.1.2**。

- [整合 mcaddon](OrderToCook-Bedrock-0.1.2-alpha.3.mcaddon)：一般玩家及 dot 下載此檔，以 Minecraft 匯入兩個包。
- [獨立行為包](OrderToCook-BP-0.1.2-alpha.3.mcpack)／[獨立資源包](OrderToCook-RP-0.1.2-alpha.3.mcpack)：手動管理時使用，兩包必須配對。
- [SHA256SUMS.txt](SHA256SUMS.txt)／[build-info.json](build-info.json)：本版下載雜湊與 runtime 指紋。
- [dot 客戶端交接](../docs/DOT_HANDOFF.md)／[回報模板](../docs/validation/DOT_REPORT_TEMPLATE.md)：執行順序與未驗收案例。

GitHub 檔案頁可用 **Download raw file** 取得原始檔；不要將網頁另存成 `.mcaddon`。先備份整個舊世界，再更新兩個包。安裝及玩法見 [README](../README.md)，本輪實際驗證範圍見 [VALIDATION](../docs/VALIDATION.md)。alpha.3 已跑的 CI 不代表 BDS 或客戶端已測，dot 的案例仍待執行。

## 舊版

- [0.1.1-alpha.2 整合包](OrderToCook-Bedrock-0.1.1-alpha.2.mcaddon)、原 BP／RP 包、[SHA-256](SHA256SUMS-0.1.1-alpha.2.txt)、[建置資訊](build-info-0.1.1-alpha.2.json)、[當時驗證](../docs/VALIDATION_ALPHA2.md)。
- [0.1.0-alpha.1 整合包](OrderToCook-Bedrock-0.1.0-alpha.1.mcaddon)、原 BP／RP 包、[SHA-256](SHA256SUMS-0.1.0-alpha.1.txt)、[建置資訊](build-info-0.1.0-alpha.1.json)。

回退到舊包不保證能讀取新狀態；需要回退時還原升級前的完整世界備份。
