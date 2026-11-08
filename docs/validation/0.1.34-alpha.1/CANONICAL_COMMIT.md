# 機器計時器的保存回滾保護

2026-11-08。基底main為 `c1aa612ea5d63d57823efcf417d34d9238d6430a`。
配對身份更新為0.1.34-alpha.1，保留UUID、stable API 2.11.0／UI2.0.0、
Upcoming Creator Features及舊release-history記錄，只追加新身份。

## 可重現缺陷與最小修補

機器到店回呼先建立訂單，再呼叫真實`spawnCustomer`。顧客服務保存失敗時，
store恢復最後提交快照、換掉canonical物件；顧客服務清理本次顧客／座位，
吞掉該錯誤並返回。舊計時器仍拿著原物件，最終保存會復活剛回滾的訂單。
若同tick也刷新機器單，該過期物件還包含刷新結果及新的刷新origin。

計時器現在於最後保存前比對`getRestaurant(id) === restaurant`；若已換成
回滾快照就拋錯、停止提交舊物件。main唯一建構點傳入正式store getter，
每個後續tick重新取得canonical物件。這是來源缺陷修正，不把Java語義差異
混進同一批。

## 驗證

新增11項測試，使用正式main／core／store／timing及真正entity service。
mainFixture原有entity stub會被正式service替換，本回歸保存路徑採正式實作。
Minecraft IO以doubles模擬；其餘無關的appliances／UI harness stub保留。

- chunk、root及靜默root寫入失敗，各測同tick有／沒有機器刷新，確認保存與
  canonical快照完全保留、無新增顧客／座位，不復活回滾訂單。
- 同tick刷新失敗後，下個tick從canonical快照重試正常機器刷新。
- 佔用及原生spawn拒絕控制案例保留原有pending訂單、同tick機器刷新。
- setter實際提交manifest後才拋錯仍視為成功，不誤回滾。
- 已存在pending不被新到店失敗刪除；直接重試真正spawnCustomer不重複顧客。
- 內層保存成功、外層第二次保存失敗，保留已提交的顧客關聯及顧客／座位實體。
- 相同11項對未修改main：4通過、7失敗；修後11項通過。
- `npm run verify`：687項Node、官方stable型別、367份JSON及配對建置通過。
  幾何23、固定輸入分段來源13、CI範圍8、合規及release-policy通過。
- 獨立唯讀審查無阻擋，另跑687項全量及check，核對單一建構點與保存邊界。
  本機Node24.22.1／Python3.12.14／Pillow13.0.0；遠端CI另驗固定環境。

## 未改變與限制

此guard只防止stale物件再次提交，保護最後成功提交快照，不是整tick的原子
交易。獨立machine tick counter仍前進，arrival cooldown仍重新計時；已成功
提交的中間快照不會整批撤回。一般空位不足／spawn miss仍可留下pending，
既有後續重試保留；測試中的舊pending重試直接呼叫service，不是完整排程器。

固定Java [WalkInNpcManager.spawn L24–53](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/WalkInNpcManager.java#L24)
找不到空椅／建立失敗時返回false。Bedrock目前建立pending後再spawn的admission
差異未在本批改動；普通顧客椅子固定掃描順序亦另待對齊。

沒有BDS、LIVE、引擎磁碟／崩潰原子性、多人、客戶端或Release驗證。
沒有POI改動／性能測量，#11仍未整合，不能從這些測試宣稱性能已修復。
