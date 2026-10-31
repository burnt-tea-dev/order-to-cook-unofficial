# 0.1.2-alpha.3 客戶端第一輪 checkpoint — 2026-11-01 HKT

**部分實機結果，非 complete。三項 FAIL 保留；11 批單人工作仍待做。** 本公開摘要不附私人原圖、完整日誌、世界識別或帳戶資料；原件另行私人封存。不得據此將整份 PLAYTEST、全部裝置或 Java 等價標 PASS。

## 固定候選及條件
- 來源 commit：`66768e0a64b80a4226924cbe580e3144793796f9`。
- `OrderToCook-Bedrock-0.1.2-alpha.3.mcaddon`，906656 bytes，SHA256 `13ebbb92d4848565bcfb22aa944ec4a3db9c02630f09ac696602b81200001d7b`；manifest 0.1.2。下載與來源已核對，測試未改包。
- runtimeTreeSha256：`f77209e0fa441e7ee16d400d57d596556fd70f6eea8b73b3fcf0a14225c3b2c4`。
- Linux launcher / Android Bedrock **1.26.60.4**，鍵鼠、windowed 1180×812（含20px launcher選單），FOV60、UI0、Classic、13 chunks。
- 隔離世界僅啟用對應 BP/RP；Creative 建 Classic Flat、seed314159、cheats ON、Always Day、mobs OFF、experiments OFF；部分操作切 Survival 核扣料。診斷 kit 不等於預設生存配方閉環。
- Creator GUI/file ON，最高等級 **Verbose**（此版本沒有名為 Debug 的選項）。GUI Copy 無時間戳；操作 UTC+8 為香港時間，原始檔案鐘面本次需+15h換算香港時間，原文保留。

## 逐項限定結果
| 實際子項 | 結論 | 範圍 |
|---|---|---|
| 指南首次開啟、關閉、重開 | bounded PASS | 僅本次鍵鼠流程。 |
| 架容量0/1/full與扣料 | bounded PASS | 盤架18、包架10；皮革64→54。短shift初次只入2，其後正常操作補滿，不誤報批量失敗。 |
| 菜單板重複菜互動 | bounded PASS | 兩次提示「菜單已有這道菜」，食物64未扣；不據早期檔名誤判互動失敗。 |
| 首筆堂食、真成品領取交付、結算 | bounded PASS | 雞2豬6麵包6羊2，報價6；準備後豬58雞62羊62麵包58；1單/營業額6/餘額6。 |
| 台上成品重複製作拒絕 | bounded PASS | 實際重點提示已備妥；非所有並發時序。 |
| entity髒盤回收 | bounded PASS | 收1，重點不增；單一樣本。 |
| 手洗移動取消、完成、回架 | bounded PASS | 池髒1；D橫移1200ms令準星離池取消且髒1保留；重新望池4秒完成乾淨1；盤架17+手1→18。轉頭及其他中斷 NOT-RUN。 |
| 個人進度計數、返回與關閉 | bounded PASS | 首單後2/10達成、首單1/1、收入6；原作11項中1項明示未移植，不把展示當實作。 |
| 個人進度未選中標題可讀性 | FAIL | 未達成且未選中標題與灰背景近同色，筆畫難辨；綠底焦點與數字可讀，不否定計數。 |
| 未交成品完整程序重啟保存 | bounded PASS | 第二單豬1/報價1，豬58→57，未取成品即正常退世界、終止程序、重啟同客戶端、重入；成品與顧客自動恢復，庫存57/62/62/58。無replay或補發。 |
| 第二單交付會計 | bounded PASS | 恢復後真成品交付1幣，最後2單/營業額7/餘額7。 |
| 髒盤世界重進、支撐桌面回收 | bounded PASS | 另次保存世界重入仍見髒盤；瞄準支撐側面收1，重點不增。此段不是完整程序重啟。 |
| runtime零錯誤 | FAIL | 冰箱geometry及手洗時段Molang .x/.y/.z錯誤；功能成功不消除此失敗。 |
| 全部資源包可用、完整Java視覺/玩法等價 | NOT-RUN／尚未核實 | 本輪不足且仍有FAIL。 |
| 原始影片 | NOT-RUN | 定時截圖序列不當影片、固定FPS或逐幀流暢證據。 |

最終存量豬57、雞62、羊62、麵包58；包架10、皮革54；盤架17+背包髒盤1。正常退出已確認；不補造stdout正常exit尾行。上述只涵蓋 D-S02–04、D-S08、D-H01/H04、D-P01 的實際子項，不是整列通過。

## 三項 FAIL：最短重現及日誌界線
1. **冰箱幾何**：僅啟用固定候選BP/RP進隔離世界，查看內容日誌。實際錯誤片段（去除時間前綴）：
   - `Block name = 'ordertocook:refrigerator' | geometry.ordertocook.refrigerator_lower_7 contains 1 boxes outside the error bounds of (-0.875, -0.875, -0.875) to (1.875, 1.875, 1.875).`
   - `Block name = 'ordertocook:refrigerator' | Error with geometry component: cannot find geometry.ordertocook.refrigerator_lower_7 geometry JSON.`
   第一原生檔案L17首error，L17–39共12條；不阻塞與幾何無關的庫存測試。
2. **手洗粒子Molang**：正常將髒盤放入池並執行手洗；原生日誌本次手洗時段L41起：
   - `Error: unable to find member variable .x`
   - `Error: unhandled request for unknown variable '.x'`
   - 同類 .y/.z 訊息；這是本次時序定位，非故障注入或修正版驗證。
3. **進度灰字**：開個人進度，將焦點移到其他列；未達成且未選中標題與灰背景近同色難辨。選中綠底/數字可讀不代表未選中狀態可讀。

GUI Copy、原生Content Log、launcher stdout分開保存，沒有拼接。兩份已取得原生檔案各4096B，末行截斷，只能稱完整已取得位元組，不能稱完整會話尾段；此前0B觀測保留歷史。stdout另有大量unknown image type及JNI/音效環境訊息，不稱零錯誤。公開摘要僅引用必要錯誤字串，不公開原始日誌。

## 未完成範圍
完整後續集合見 [REMAINING-SINGLEPLAYER.md](REMAINING-SINGLEPLAYER.md)，11批全部仍待做：
1. 外送/HUD/真成品容器身份；2. 機車完整生命週期；3. 工具箱成功與拒絕/冰箱庫存；4. 洗碗機邊界與活動保存；5. 爐灶三槽/燃料/堵塞；6. 滿包及交易拒絕；7. 無椅/拆椅/真正卸載；8. 升級拆建與進度；9. 有限視覺語言整合；10. 預設生存配方閉環；11. 舊alpha2升級。

可達的單人工作是待做，不冒稱登入阻塞。隨機未遇分支 PENDING_RANDOM；alpha2輸入未備為 INPUT_PENDING。第二同時真人、物理觸控/控制器、原生Windows/最低版本/固定Java對照依實際環境 BLOCKED 或 NOT-RUN，不由單帳號代填。過期包裹實際食用進度、手洗玩家刷盤骨骼、洗碗機empty_out預覽等已知未實作，保持 NOT_IMPLEMENTED。後續修正須另固定候選hash重測，歷史FAIL不可覆寫為PASS。
