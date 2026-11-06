# 指南圖示與空盤模型修正

2026-11-06 HKT。這批依真用戶指南截圖，以及所選0.1.26的客戶端ContentLog修來源；日誌26條Blocks錯誤都指向 `dining_plate_empty`，包括unit／31px邊界及後續找不到geometry。這不是修後的客戶端結果；本機沒有新開BDS或client。配對版本為 `0.1.27-alpha.1`，原分段玩家rig仍保存在獨立本地prototype branch，沒有混入本批。

## 圖示

指南原直接把料理檯、餐盤與頭盔的模型UV展開圖當成按鈕圖片，檔案雖存在，畫面卻像拆散的零件。指南現沿實際物品texture registry使用盤／頭盔縮圖；料理檯、冰箱、爐灶由既有 `render_item_icon` 使用原模型與原像素生成三張128×128縮圖。生成器與provenance一併更新，沒有新畫替代美術。三張PNG合計9,559 bytes；原生表單的icon／文字尺寸與導航不改。

實際指南screen回歸先重現餐盤icon與真inventory icon不一致，修後通過；所有按鈕引用的PNG現在都檢查存在，包括 `textures/items` 與新 `textures/guide`，不再只檢查原資產目錄。source前後對照存在本機既有證據的 `source/otc-client-027/guide-icons-before-after.png`，並非遊戲實機截圖。修後原生表單畫面尚未觀察。

## 空盤

`make_dining_plate` 原為 `geometry.ordertocook.dining_plate_empty` 寫出 `root.cubes=[]`；受影響block引用它作stage 0與未映射編碼值的基底。原生成器回歸可確認該模型完全沒有網格角點；現改為unit內的正尺寸cube，再使用官方 [minecraft:geometry.bone_visibility](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_geometry?view=minecraft-bedrock-stable) 的 `root=false` 隱藏。此原生欄位自1.19.80可用，所選block格式維持1.26.60；不靠空geometry或修改保存資料模擬不可見。

真factory測試先在舊輸出失敗，再對實際生成的permutation條件求值、選到的mesh及四方向變換作檢查。引擎可編譯的低位16值／高位3值都涵蓋：stage 0與41–47仍隱藏，1–40仍使用原可見食物模型；全部有網格，變換後在unit內。這是來源及Molang常數條件子集的計算，不能代替client block loader。資源檢查器亦拒絕再次引用零cube的block geometry。受影響block模型目錄沒有第二個零cube模型。

原階段時間、碰撞／選取框、方塊及實體ID、actor恢復、領盤與025完整物品保存均不變。`dining.js::syncVisual` 仍僅在前15 ticks使用helper；stage >0即移除helper，1–40由native block呈現。原生及保存證據保留各版原範圍，不為本批新bone_visibility字串重播舊BDS。

## 能效與驗證界線

這次新增的圖片只在離線生成；指南沒有新輪詢、計時器或遊戲API呼叫。空盤採固定bone visibility，可見食物mesh、native tick及script hot path完全不變，沒有增加第二層可見餐盤。相關來源窄查未發現需要再改的重複actor渲染路徑；沒有進行FPS、GPU或用戶端耗時量測，因此不宣稱效能提升幅度。

本機受影響檢查為6項指南screen／資源測試與21項生成器／幾何測試，型別／連結資源、配對build、compliance及release-policy按既有流程驗證；完整必要套件交PR CI執行。真client是否消除26條ContentLog與圖示實際顯示，由共同owner收新回測；這不是等待真人的交付門檻。
