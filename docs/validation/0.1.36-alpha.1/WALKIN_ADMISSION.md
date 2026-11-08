# 到店嘗試未找到可用已載入空椅

2026-11-08，基底main `7fe3ca6ca12a863e0e4afa2f35c9c7c604d4df38`。
配對身份0.1.36-alpha.1，保留UUID、stable API 2.11.0／UI2.0.0及Upcoming
Creator Features；release-history僅追加新身份。

## 依據與窄範圍

固定Java [WalkInNpcManager L24–53](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/WalkInNpcManager.java#L24-L53)
無空椅或createNpc失敗時返回false。[機器 L254–289](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/entity/OrderMachineBlockEntity.java#L254-L289)
先刷新普通單，重設到店冷卻後再嘗試。Bedrock原本先生成offered單再spawn，
即使滿座或頭部受阻、未配置實體，也把新單保存成pending。

`spawnCustomer`保留entity／undefined回傳契約，只增加可選`onNoEligibleChair`。
它只在walk-in的findChair未找到合格椅子分支回報，位於location／claim／
customer／seat配置之前。main接收此明確訊號，僅在餐廳仍為canonical物件時，
以物件identity移除這次生成的order，不碰舊pending或其他訂單。

arrival回呼的true是「需要保存」，不是成功入店：新單已消耗orderSequence
並更新updatedAt，撤回後仍保存兩者，避免重用ID，也保留同tick普通刷新。
計數器、冷卻及0.1.34的stale canonical guard不變。
保留已消耗ID是Bedrock的適配帳務選擇，不代表Java的ID配置時機完全相同。

## 回歸

新增28項使用正式main／core／store／timing與真正entity service保存路徑；
Minecraft IO以doubles模擬，其餘無關UI／appliance harness stub保留。

- 滿座、第一／第二格頭阻、頭部未載入、前置檢查後椅子卸載，各測有／無
  同tick刷新。無新增實體、僅撤回本次單，保留序號／updatedAt／刷新origin，
  沒有錯誤到店成功音效。
- 舊pending仍在，透過真正service init／tick排程重試並去重；可選reporter
  未傳入的既有重試呼叫不會撤單。
- 冷卻保持原來的下一次到期時機，到期後空間恢復可成功生成一名顧客／座位。
- 無附近玩家、原生拒絕、實體建立後才拋錯、metadata拒絕、顧客／座位清理
  靜默失敗、清理拋錯、選椅後頭部才受阻，皆保留原有pending／錯誤路徑。
- chunk／root／靜默root最終保存失敗恢復最後提交快照，下tick普通刷新仍可
  重試；實際提交後setter才拋錯仍成功。菜單先行保存不隨新單回滾。
- 相同28項在未改main隔離來源：14通過、14失敗；修後28項通過。
  既有canonical occupied控制更新為撤回此次新單，spawn-rejected仍保留。
- `npm run verify`：747項Node、stable型別、367份JSON、配對建置通過；幾何23、
  固定外部來源分段13、CI範圍8、合規及release-policy通過。
- 獨立唯讀審查核對訊號邊界、保存與測試；本機Node24.22.1／Python3.12.14／
  Pillow13.0.0，遠端CI另驗固定環境。

## 未修與證據限制

findChair只看已註冊、當下已載入且通過檢查的椅子，未找到不代表整個世界
完全無空椅。這不是全面Java admission還原，也不改普通顧客選椅／站立適配。

其他undefined不能當成「原生一定沒建立」。注入反例會留下顧客或座位，因此
本批保留原有流程，不把不確定結果變成刪單；這些清理問題沒有被修好，也不
聲稱自動恢復已證實。不新增清理掃描、整tick回滾或世界交易保證。

沒有BDS、LIVE、引擎／磁碟崩潰、多人或客戶端驗收，未建立tag／Release。
POI #11仍未整合；這批沒有性能測量或性能改善結論。
