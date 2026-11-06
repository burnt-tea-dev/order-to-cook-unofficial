# 分段玩家骨架與第一人稱：來源原型

2026-11-07 HKT。沿c84／PR49的分段矩陣原型，改為明確選定各自的native classic／customSlim基底，不再共用classic改寬度。這仍是後續有效owner接線的來源原型：普通資源轉換不呼叫它；只有明確指定兩份外部native輸入、相機框架及runtime外的輸出目錄才生成。runtime、目前配對版本、descriptor、baseline及release-history不變。來源合併不代表已接通玩家或安裝；現在可用的玩法與仍未完成項由 [PARITY](PARITY.md#玩家動作的來源與骨架) 負責。

## 輸入與重現

兩個原生輸入均固定 Mojang bedrock-samples `15701fa9c13923f12662984c32c124327e40e3d3`／1.26.60.5：classic讀 [humanoid.custom.geo.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json) 的 `geometry.humanoid.custom`；slim讀 [models/mobs.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/mobs.json) 的獨立 `geometry.humanoid.customSlim`。後者本身包含完整骨鏈，沒有繼承後綴；只將legacy外層格式正規化，逐骨保留原定義，不補造骨、不展開或借用另一個帶繼承的classic定義。其 [LICENSE.md](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/LICENSE.md) 引用Minecraft EULA，並非MIT；完整輸入只在本地／CI臨時目錄，不加入公開倉庫或遊戲包。作者動作仍分別讀pinned `drive_idle`／`drive_idle_alex` 父鏈。明確選定native來源不等於已辨識目前玩家skin。

目前主機可重現：

```sh
OTC_NATIVE_PLAYER_GEOMETRY=/root/senluo-baseline-20260930/java-parity-20261105/source/otc-player-actions-026/segmented-prototype/inputs/native-humanoid.geo.json \
OTC_NATIVE_SLIM_GEOMETRY=/root/senluo-baseline-20260930/java-parity-20261105/source/otc-native-variants-20261107/inputs/mobs.json \
  python3 -m unittest discover -s tests -p test_segmented_player.py
python3 -m unittest discover -s tests -p test_appliance_geometry.py
```

第一個命令需提供上述兩份固定原生檔。原型測試已進必要CI，CI只將兩份輸入下載至臨時目錄，不加入倉庫或打包輸出。第二個命令的完整既有生成回歸沿必要CI執行，本機只重跑受影響原型。本機Python3.14.4／Pillow12.1.1通過；沒有新BDS、客戶端、native Player或skin query結果。原c84的六項／026二十項結果保留其歷史範圍。

重現整套全身與第一人稱來源：

```sh
python3 tools/convert_assets.py --segmented-player-native /path/native-humanoid.geo.json \
  --segmented-player-slim /path/mobs.json \
  --segmented-camera-frames /path/camera-frames.json --output /path/outside-runtime
```

相機框架必須明確提供左右兩邊的 `rotation`／`position`，使用JSON模型座標軸及像素，例如 `{"right":{"rotation":[0,0,0],"position":[0,0,0]},"left":{"rotation":[0,0,0],"position":[0,0,0]}}`。這是呼叫者選定的模型空間參考框架，不是自動取得的客戶端相機。輸出各native基底的geometry／pose及 `player-rig-source.json`，列明native識別碼、空繼承鏈及source座標框差；沒有manifest、player、selector或新遊戲身份，且拒絕寫入runtime。缺少任一native輸入時不退回共用classic。

原c84及PR49的失敗／結果繼續保留；本次真native差異的修前失敗、成功及生成物在 `/root/senluo-baseline-20260930/java-parity-20261105/source/otc-native-variants-20261107/`。這些只供來源比較，不是可安裝的runtime或候選包。

## 最小骨名映射

`segmented_player_geometry(native, source_rig, identifier)` 保留所有原生骨名、pivot及既有非肢體網格；root／waist／body、head／hat、jacket、cape均保留。對每一側（right／left）增加下列骨，沒有新增player definition，也沒有覆寫 `geometry.humanoid.custom`。

| 原控制骨／來源骨 | 新網格與動畫目標 | 保留的連接 |
| --- | --- | --- |
| `body` → `rightArm` | 中間插入 `ordertocook_right_arm_view`／`ordertocook_right_arm_body` | TP及中性時均為單位變換；FP分開承接該手相機框架與原body矩陣 |
| `rightArm`／`right_arm` | 上臂仍在 `rightArm`；下臂為 `ordertocook_right_forearm` | 下臂在上臂下 |
| `rightSleeve` | 上袖仍在 `rightSleeve`；下袖為 `ordertocook_right_forearm_sleeve` | 下袖在原袖控制骨下，沿同一前臂矩陣 |
| `rightLeg`／`right_leg` | 大腿仍在 `rightLeg`；小腿為 `ordertocook_right_shin` | 小腿在大腿下 |
| `rightPants` | 上褲仍在 `rightPants`；下褲為 `ordertocook_right_shin_pants` | 下褲在原褲控制骨下，沿同一小腿矩陣 |
| `rightItem`／`leftItem` | 名稱、pivot及原locator不變；parent改為對應forearm | 新關節為零時與原路徑的座標等價；彎曲時隨前臂走 |

left側名稱直接對稱。原 `rightItem.locators.lead_hold` 原值保留。測試對原生root、waist、body及上臂加旋轉／位移／縮放後，正向計算原Item與locator位置；插入中性前臂不改其值。這是模型矩陣證據，沒有把它稱為遊戲內slot binding或牽繩畫面已驗證。

`segmented_player_action_pose` 轉換原洗盤、安坐及拍手的模型局部矩陣。source body移到native root；waist中性；source torso映到body。head／上臂原是torso同級，轉到native body下時消除該父變換；兩個新相機／body骨明確歸零。此處只處理已選片段的固定X／零torso旋轉，不是通用Euler逆矩陣。前臂保留原hand關節完整旋轉／位移；原生腿中心±1.9對原±2的0.1px差由整個腿座標框補償，小腿仍保留原foot矩陣。skin與overlay分別對照來源父鏈，涵蓋兩個寬度、三個動作、來源轉折、整tick及中間時間的實際網格角點。單側前臂／足部擾動會改下節及Item，保持上節與另一側。

customSlim的肩pivot為21.5，網格為Y11.5–23.5，Item／lead為14.5；classic對應22、12–24與15。生成器以真網格頂端計算source座標框差，保留原生中性外殼，slim手肘在17.5分段。TP／FP將原生點先平移至作者座標框，再經原上臂／前臂父鏈，而非只改pivot數字；前臂的關節框同時平移，持物錨點仍保留原值。native兩基底的cape Z亦各自保留3／−3。

## 真分段第一人稱矩陣及交接契約

`segmented_player_first_person_pose` 對每手依序保留「明確傳入的view → 原body縮放／位移 → 上臂 → 前臂 → Item／locator」，不是把肘彎曲擬合回一條整臂。左右相機獨立，避免用同一root移動兩手；native root／waist／body在FP明確中性。測試以原來源各網格角點先走完整父鏈，再投影至各自參考框架，比對生成骨架；另擾動單側肘關節，確認只改該前臂、下袖及持物，保留上臂及另一手。

`player-rig-source.json` 列出兩寬度geometry／pose及新下半肢體需跟隨的原控制骨可見條件。前臂跟Arm、下袖跟Sleeve、小腿跟Leg、下褲跟Pants；不得用Arm條件取代衣物條件。每個variant同時輸出只重設新增骨的reset片段。有效owner仍需沿原排程選擇TP／FP、動作窗口、停止及切回default；本原型不新增共用旗標或覆寫現行controller。

這些pose沒有自行接進現行 `player-presentation.json`。接入者需保留現有獨立動作request、FP／非VR／非UI／主副手皆空的條件及停止清除；原拍手與手洗不能互相抹除request。不能僅將geometry alias寫進低優先player，就宣稱實際renderer已採用。

skin仍需沿該有效owner的 `Texture.default`，不是改用Steve貼圖。原native Item／lead定位資料不變，彎曲後跟前臂；這是矩陣證據，未證明client slot／attachable實景。原生armor獨立幾何與骨名保持，沒有聲稱也有分段手肘。classic與customSlim現在各用真native底座，仍不代表客戶端自動選型或玩家中性外觀實景已驗。

## 中性外表與UV

上、下兩塊若各留原inflate，接縫會重疊，且UV會各自拉伸。原型先把膨脹量烘進實際外殼，再按對應關節框切開及裁側面UV；classic肘18、slim肘17.5，膝均6。測試逐面比固定來源UV及切前後原生外殼／接縫；外露蓋面使用固定native box-UV例子。box面配置及Bedrock蓋面方向分別核對 [Blockbench cube](https://github.com/JannisX11/blockbench/blob/ec0b2827104d0799c153bfb5f867579c0c44652f/js/outliner/types/cube.js#L1302) 與 [Bedrock exporter](https://github.com/JannisX11/blockbench/blob/ec0b2827104d0799c153bfb5f867579c0c44652f/js/formats/bedrock/bedrock.js#L966)，不是在測試裡再寫一份UV生成算法。

真customSlim的leftLeg另有 `mirror=true`，leftPants沒有。按[官方mirror語義](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/geometry.v1.12.0?view=minecraft-bedrock-stable#bones)，將其反向U及east／west交換烘入上下節的明確UV後移除原鏡射旗標，避免下節丟失或重複鏡射。這個native皮膚映射與作者未鏡射的左腿不同，保留原生中性外表並明記適配，不改作者資產來消除差異。

原作者的foot skin有−0.05 inflate；這與保持未彎native外殼的目標不同，不能把作者縮小的皮膚塊當成native外表基準。Slim手臂側面UV與作者相同，左腿鏡射差異如上；左上袖蓋面原為 `[53,48]`／3×4，native box為 `[52,48]`／3×4，左前臂袖底面原為 `[56,52]`／4×−4，native為 `[55,52]`／3×−4。原型維持native box定義，沒有為通過比較改動上游資產；原作者個別內部蓋面差異也沒有冒充native標準。這是來源適配取捨，尚未由真client觀察接縫或蓋面。

## 共享selector仍缺的證據

有效owner需保留原default／皮膚／普通FP、TP及持槍副手路由，再按實際動作選新幾何。新增下半骨的顯示對應已由來源contract列明，並非假設「顯示原Arm／Sleeve就一定覆蓋新的子骨」。本原型已完成分段FP的模型空間矩陣，原026的rigid FP仍是當前runtime；Java ACTION到Bedrock絕對攝影機的投影未校準。原生armor依原骨名與自身幾何保留，不把所有armor分節。

目前仍缺真player的classic／slim／客製avatar選擇值與查詢時機、實際skin／slot binding、FP投影、可見子骨與切回default的client證據。有效025輸入沒有queryable_geometry或slim偵測；官方欄位／bone查詢的存在不能當作這些值已成立，也不構成不支援的結論。下一步由同一effective owner核定最小selector與動作接口；此原型不新增全域geometry替換、第二player、持久狀態或機器專屬開關。
