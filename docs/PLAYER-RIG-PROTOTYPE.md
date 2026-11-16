# 分段玩家骨架、機車接線與第一人稱原型

2026-11-11 HKT。classic／customSlim 各讀完整 native 基底，不共用 classic 改寬度。機車 TP 現有定向 exporter 與共享 composer／完整玩家 prepare 來源接線，見下節；一般資源生成不會偷偷切換玩家。手洗、安坐、拍手及 FP 的分段參考仍是來源原型。本批 OTC 本機固化記錄見 [CHANGELOG](../CHANGELOG.md#0155-alpha1-local-integration-unpublished)，配對身份以 [baseline.json](../baseline.json) 為準；共享玩家 pair 尚未組裝或安裝，沒有本次測試、CI 或客戶端觀察。玩法差距由 [PARITY](PARITY.md#玩家動作的來源與骨架) 負責。

## 機車第三人稱的共享來源接線

`make_player_riding_source` 由 `player-presentation.json.riding` 讀取車種、動作 property 與五個原片段。它沿既有雙骨架、分段 UV／Item／lead parent 轉換，生成供同一共享 composer 使用的本地 RP 資料與 `player-riding.json`，不產生第二個玩家或假乘客。一般動作原型的相機框架不被拿來猜機車 FP。

```sh
python3 -B tools/convert_assets.py --player-riding-only \
  --segmented-player-native /path/native-humanoid.geo.json \
  --segmented-player-slim /path/mobs.json \
  --native-player-license /path/MOJANG-LICENSE.md --output /path/local-riding-input
```

Grilling 的 `tools/compose_held_player.py::compose_riding` 是唯一人物接線 owner。Core 的 `tools/install_player_presentation.py::compose_players` 仍經它組裝；新增 `behavior_player` 入口可直接擴充選中的完整 BP／RP，保留已接受的 IE／TACZ 改動。private 的 `tools/prepare_first_person_inputs.py::prepare_pair` 已接此入口，收回全部輸出，分別寫回同一對原 owner。若宿主檔只含 FP controller，呼叫者要另供相同引擎的 native controller；Core 合併時以現有宿主同名條目優先。不能只取回 `player.entity.json`。

選型保留 `Geometry.default`／`Texture.default`，以 `queryable_geometry: default` 的左右 `q.bone_origin` 比對兩份真 native 肩 pivot；這不是 `skin_id` 或假造 `is_slim`。僅在非 UI／非 spectator 的真 motorcycle TP 乘座且形狀匹配時，選對應分段模型。Persona／premium 與不匹配的形狀保留原模型；查詢能否讀到玩家實際當前 skin、換皮膚時機及特殊 avatar 仍未由 client 確認。[bone_origin](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_bone_origin?view=minecraft-bedrock-stable) 與 [Persona 查詢](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_is_persona_or_premium_skin?view=minecraft-bedrock-stable) 的官方欄位本身不能替代這份觀察。

`entities.js` 在真 `addRider` 成功、重載／spawn 恢復後追蹤該乘客，沿既有五 tick 服務讀車速與車 yaw；用 `ordertocook:drive_action` 傳遞 idle／back／horn／repeat horn／light。這個欄位只在選中完整 BP 玩家宣告，沒有 DP 或保存 ID 登記。controller 以真乘座決定啟停；離座、換視角與不再匹配立即不再施加 drive。原騎乘 root／legs 被此狀態替換，空手的原騎乘 arms 也讓出；其他載具仍走原動畫。有物品的手臂保留原生／IE／TACZ 路由，空手的另一側才播 drive 前臂。頭部補原片段的相對變換，保留原生 look 動作，不改 camera／玩家旋轉。

模型 root 只套 Forge 真 `LivingEntityRendererMixin → renderGeoRiderBody → RiderGeoRenderer.preRender` 的模型框架。原作鎖定 GeckoLib 4.8.3，其 `GeoObjectRenderer.preRender` 的 `(0.5,0.51,0.5)` 被 rider 抵銷；再合併 vanilla `-1.501`、站立身高 `1.8` 與 DRIVE 額外下移 `-4/16`，得到模型局部 Y `16*(1.501-1.8+4/16)`。沒有套未被此 caller 使用的 `renderIfAnimated` 的 `-0.68`，也沒有移動 seat 或推算眼位。這是站立玩家的來源座標轉換，未證明本機 BDS 的臀部／車座或鏡頭已對齊。

FP 模型、眼位及 Java 上下車一次切換視角仍未接成等價行為。本地 bundle／prepare 程式存在不代表選包已固化、已安裝或已達 Java parity；須由總協調把新來源 pin 與完整 owner 輸入串行選定。本次保留原聲音與按鍵／面板入口，因此喇叭原有 12 tick 節流／即時發聲、切燈即時改光與 Java 的完整時序差距仍存在。

## 輸入與重現

兩個原生輸入均固定 Mojang bedrock-samples `15701fa9c13923f12662984c32c124327e40e3d3`／1.26.60.5：classic讀 [humanoid.custom.geo.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/entity/humanoid.custom.geo.json) 的 `geometry.humanoid.custom`；slim讀 [models/mobs.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/models/mobs.json) 的獨立 `geometry.humanoid.customSlim`。後者本身包含完整骨鏈，沒有繼承後綴；只將legacy外層格式正規化，逐骨保留原定義，不補造骨、不展開或借用另一個帶繼承的classic定義。其 [LICENSE.md](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/LICENSE.md) 引用Minecraft EULA，並非MIT；完整輸入只在本地／CI臨時目錄，不加入公開倉庫或遊戲包。作者動作仍分別讀pinned `drive_idle`／`drive_idle_alex` 父鏈。明確選定native來源不等於已辨識目前玩家skin。

2026-11-07 的歷史測試命令如下；目前禁止執行，不作本輪門檻：

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

## 尚未觀察的客戶端部分

有效owner需保留原default／皮膚／普通FP、TP及持槍副手路由，再按實際動作選新幾何。新增下半骨的顯示對應已由來源contract列明，並非假設「顯示原Arm／Sleeve就一定覆蓋新的子骨」。本原型已完成分段FP的模型空間矩陣，原026的rigid FP仍是當前runtime；Java ACTION到Bedrock絕對攝影機的投影未校準。原生armor依原骨名與自身幾何保留，不把所有armor分節。

機車 selector 的現行來源見本文件前節；025 當時沒有 queryable_geometry 只是歷史輸入，不能當成目前宿主的事實。仍缺真 player 的 classic／slim／客製 avatar 選擇值與查詢時機、實際 skin／slot binding、FP 投影、可見子骨與切回 default 的 client 證據。機車接線不擴大為其他動作或 FP 已完成。
