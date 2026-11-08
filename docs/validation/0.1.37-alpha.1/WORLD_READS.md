# 減少最近餐廳與洗碗機的重複讀取

2026-11-08，基底main `6a896d2ba4d2dc8d673bf6e667a9ff256da27d76`。
配對身份0.1.37-alpha.1；UUID、stable API 2.11.0／UI2.0.0及Upcoming Creator
Features要求不變，release-history僅追加新身份。

## 兩項來源修正

1. `nearestRestaurant`原先讀取半徑內每間店的原生方塊後才排序、取首項。
   現在先做同樣的維度／3D半徑過濾與穩定距離排序，逐項驗證原生方塊，
   找到第一間有效店即停止。最近候選未載入、已移除或類型不符仍繼續找。
   沒有新增索引、載入狀態或權限快取，每次讀取目前canonical資料。
2. `tickDishwasher`結尾原本呼叫`updateVisual`，唯一呼叫端緊接著又呼叫一次，
   中間沒有phase／保存變動。刪除內層尾端的一次，保留外層；idle及完成階段
   的early return仍有外層更新，正常加工／音效／保存／permutation寫入不改。

## 精確呼叫數，而非原生速度測量

正式store／appliance模組配合Minecraft IO doubles前後比較：

- 20個有效近店的合成查找：getBlock由20次降為1次。它不是20名玩家，亦不
  表示一般新世界放置規則允許該餐廳密度。同距離仍依原插入順序選取。
- 最近幾間無效便依距離繼續查；全部3間無效時仍讀3次，不會返回虛構店。
- 工作中的洗碗機phase1–4每次更新：getBlock由4次降為3次、getState由9次
  降為5次；保存與setPermutation次數相同。phase0／5的2次／4次維持不變。
- phase1→0、4→5及中間phase／frame／盤數結果相同。單項cosmetic API若
  暫時失敗，以前可能在同回合重複pass中重試；現在下一次正常2tick更新再試。
  這個錯誤情況的視覺恢復時機有變，不宣稱所有fault時序完全一致。
  外觀讀取／寫入若持續失敗或區塊卸載，不保證兩tick內恢復。

## 回歸與界線

新增6項有目的的回歸：兩個讀取預算、無效候選／每次載入狀態、metadata及
canonical rollback／刪除、正式main的最近店權限與staff即時撤權，以及
cosmetic失敗下次更新恢復。正常六個洗碗機phase在同一案例中檢查。

相同6項對未改main：3通過、3失敗；失敗包含兩個呼叫預算，以及明確改變的
cosmetic重試時機，不代表發現三個玩法bug。修後6項通過。
`npm run verify`：753項Node、stable型別、367份JSON與配對建置通過；幾何23、
固定外部來源分段13、CI範圍8、合規及release-policy通過。另有獨立唯讀審查。
審查另跑63項相關、753項全量，以及實際base／候選查找函式的10,000組
metadata／載入狀態差分：回傳canonical物件相同，世界讀取數未增加。
本機Node24.22.1／Python3.12.14／Pillow13.0.0；遠端CI另驗固定環境。

全部候選無效時原生讀取不減，排序還可能增加JavaScript成本。因此不從此
推定MSPT、TPS或FPS改善。未改HUD的全表掃描，因現有store容許id/location
不一致，直接點查會改變這些記錄的語義；也沒有加入持久索引或改動POI。

沒有可直接使用的已確認隔離BDS binary，本批未下載／啟動引擎，未操作LIVE、
客戶端或個人電腦，未建立tag／Release。#11仍為獨立未整合路線，原有性能及
衝突問題不能由這些來源讀取數宣稱已修復。
