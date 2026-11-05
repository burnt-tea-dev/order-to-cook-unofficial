# 未交付成品的完整物品保存

觀察時間：2026-11-06 HKT。受檢 runtime 固定為 `65315a573137576a8bb1c54054fa00dd083eaa8f`／0.1.25-alpha.1，BDS **1.26.60.6**，stable server2.11.0／UI2.0.0，實際啟用 Upcoming Creator Features。目前行為與Java來源分界統一查 [PARITY](../../PARITY.md#未交付的展示餐點)；結構化結果見 [display-stack-native.json](display-stack-native.json)。

正式 `prepareOrderAtCountertop → pickupDisplay → placeParcel → pickupDisplay` 使用真 native ItemStack／方塊 inventory。actor 的背包是測試用 native storage entity；這不是 native Player、真人輸入或 GUI 驗收。只在隔離的單一025 QA世界執行，沒有複製正式世界或載入完整家族，沒有改023候選／LIVE。診斷 BP／RP 使用自己的UUID及1.0.0，不冒稱正式pack身份；除診斷manifest與測試entry／observer外，正式runtime檔案直接來自固定commit。

已驗證：

- 正常準備的餐盤與外送袋只產生一件carrier；加入名稱、lore、dynamic properties及keepOnDeath後，正式取放保留原物品資料。
- 真正 `setblock … air destroy` 只掉一份完整餐盤；直接換成stone也掉同一件，物品會被擠到方塊側下方。腳本不再按訂單另造副本。
- 正常保存並重啟同一世界後，兩種展示成品的完整測試資料都相同，取回不另掉一份；已移空的native槽保持空，沒有憑舊連結再造物。
- 舊link-only格式的一次採用完成後，其carrier經同世界重啟可取回一次，沒有額外掉落。這不能補回舊版本早已丟掉的玩家備註。
- 普通箱子→下方漏斗40tick正向對照成功；同場下方漏斗未抽走展示餐點。這只涵蓋本引擎／入口／設定，沒有證明所有自動化方向或其他版本。

失敗記錄沒有刪除或改成通過：0.1.24第一次載入因新格式不接受布林 `ambient_occlusion` 而在玩法前失敗，修正生成器並以新025身份重測。025第一個observer只找1.3格範圍，漏掉被stone擠至約1.8格外的原餐盤；同世界觀察找到唯一原物品。第一次續測又用重啟後會補期限的訂單重建預期值，與原餐盤不符；改用最初物品基準，同時記錄expected／actual後通過。其間沿用同一025世界及已通過的取放／真破壞結果，只續未完成場景。沒有為湊成功重播整套場景或另起小世界。

最終續測11項與同世界restart9項通過；先前seed已通過的準備／取放／真destroy保留原範圍，不把整份初次seed失敗報告冒稱成功。所有stage都正常stop／Quit correctly／exit0且無OOM，最終兩階段playersAfter0。活動cgroup實核MemoryMax2684354560／High2147483648／Swap0，PrivateNetwork與IPAddressDeny=any、獨立netns且僅lo；主機QA埠無listener。QA engine/world已刪，原始inputs／logs／失敗與成功reports保留，shared flock已交還。

本機及必要遠端CI通過535項邏輯測試、tsc／實際pack檢查、配對build與合規；生成器新增直接呼叫真factory的材質型別回歸。沒有重跑020／021或完整63包。沒有從服務端結果推定client畫面、聲音或原生GUI取消已驗收。
