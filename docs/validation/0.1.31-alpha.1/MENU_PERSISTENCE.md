# 菜單換綁持久化及未載入保留

2026-11-08。基底為 #51 合併後 stable main
`e31322581c031b41f3bfb03de3969a92aed6e39a`，使用新配對來源身份
`0.1.31-alpha.1`。保留 UUID、stable server 2.11.0／UI 2.0.0 及
Upcoming Creator Features 要求；baseline 更新，release-history 只追加 0.1.31。
本輪不是 Release、安裝或客戶端驗收。

## 修正範圍

舊 `syncMenu` 會改記憶體中的 `boardId`、完整菜品快照與候選訂單報酬，
卻沒有回報變更。當餐廳休息、表單取消／升級失敗或菜單已空，沒有其他
存檔動作便會在重載後恢復舊菜單。現在比較綁定、完整正規化菜單與
`offered` 訂單的 reward／benefitLevel，所有正式呼叫點只在有變更時存檔。
已接取／已裝盤訂單不隨菜單重算，穩定狀態不反覆寫 restaurant root。

舊路徑把 `getBlock` 回傳 undefined／拋錯視同立牌已消失，可能改綁其他
立牌或清空記憶體。現在先查 canonical bound station，若仍符合既有
維度／範圍／權限／類型但無法載入，就保留原快照並延後換綁與依賴菜單
的操作。已載入的 air／其他方塊可確認移除；失去資格的舊綁定不因
未載入而永久保留。過期訂單在可能延後的菜單檢查之前獨立保存。

只新增 canonical station ID 查詢，不新增 POI、索引快取或排程。
現有最高營養排序、平手順序及 X/Z 每軸 ±24、Y ±8 選牌範圍保持不變。
Java 圓柱形範圍與平手距離排序差異仍未在此修復。

## 回歸覆蓋

`tests/menu-persistence.test.js` 透過現有 mainFixture 載入正式 adapter，
world／block／UI 使用隔離 doubles，涵蓋：

- 閒置首次綁定、同營養不同食品變體、`getMachine` 提前返回。
- offered-only 報酬變動；accepted／packed 快照不變；穩定狀態零 root writes。
- 升級取消、營養不足、資金不足、滿級及表單中途改菜單。
- 管理員空刷新、原生 tick refresh／arrive 回呼不產生訂單時仍保存空綁定。
- getBlock 拋錯與 undefined 都保留原綁定，且不提前改綁較高營養立牌。
- 載入後恢復選牌、air／stone 確認移除、owner／維度／範圍／類型失去資格。
- 立牌未載入時升級延後，既有訂單過期仍保存且不重複計失敗。
- chunk／root 寫入失敗回滾原快照及 canonical cache，下次 tick 重試。
- 將已存 dynamic-property chunks 載入全新的正式 store 模組，檢查綁定、
  食品變體與確認移除均保留。這是程序內重新載入，不是 BDS 世界重啟。

## 證據與限制

- 相同27項聚焦回歸，未改 runtime 的 main：1通過、26失敗；修後27項通過。
- 獨立審查指出菜單延後不應阻止打單機顯示及個人進度；已新增局部捕捉特定未載入錯誤及兩項回歸。存檔失敗仍停止該輪，不以失效物件續存。
- `npm run verify`：611項Node、官方stable型別、367份JSON資源及配對建置全部通過，資源錯誤為零。
- 既有幾何／生成器23項、分段來源13項、CI範圍8項通過；分段來源使用固定Mojang臨時輸入。合規、release-policy、舊release-history不變及 `git diff --check` 通過。
- 獨立複審無新增阻擋項，另重跑101項相關測試通過。本機Node24.22.1／Python3.12.14／Pillow13.0.0；遠端CI另驗固定環境。
- 沒有執行 BDS、LIVE、原生 Player、多人或客戶端測試。
- [POI #11](https://github.com/burnt-tea-dev/order-to-cook-unofficial/pull/11)
  仍是未合併 Draft，有已知主線衝突與原生高密度性能退步；本輪不修改
  它或宣稱性能已修。其舊回歸僅作缺陷線索，本修正以當前 stable main
  重現與實作，不移入其 beta API 或歷史計時／容器路徑。
