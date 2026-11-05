# 原生餐盤：0.1.15-alpha.1

2026-11-05。用餐餐盤改為原生方塊，維持原作底盤與中央食物兩層碰撞。stage 1–40直接使用原模型；stage 0空方塊配原食物helper及放盤動畫。沒有新增物品、player.json或重力。

## 修正與限制

| 項目 | 現行行為 |
|---|---|
| 舊世界 | 保留餐廳／餐盤ID、token、時間、型號及額外欄位；載入後補原生方塊，退休穩定階段的舊helper |
| 位置 | 一個餐盤占一格，跨餐廳檢查重疊；玩家其他方塊不被覆蓋，卸載／受阻時保留記錄等待 |
| 點取與打破 | 點取提前收盤會中斷顧客；打破、命令替換及拆機只掉一盤，保留原動作。沿原來不可重領claim，不另設保存格式 |
| 碰撞與選取 | 原碰撞為14×2×14及10×3×10像素兩盒；游標選取仍為14×5×14外接長方體，不宣稱Java聯集選取輪廓一致 |
| 內容 | 髒盤權威仍在餐廳記錄，未等價保存原BlockEntity任意ItemStack資料；跨世界資料與物品欄仍不是原子交易 |

依據為固定Java來源的[FoodPlateBlock.SHAPE／use／onRemove](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/block/FoodPlateBlock.java)。原onRemove沒有提前收盤中斷；0.1.14把打破送入點取路徑，本輪修正。Bedrock26.60 [collision_box](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_collision_box?view=minecraft-bedrock-stable)使用origin/size陣列，未使用需實驗的min/max格式。

## 實際原生範圍

BDS1.26.60.6、server2.11.0／UI2.0.0；QA加入gametest1.0.0-beta，開啟gametest與upcoming_creator_features。獨立診斷身份，同一個LevelDB先載0.1.14，再換本輪來源，最後正常重啟；未動LIVE。

- 舊版seed4項通過：三份真持久記錄及helper，沒有新方塊。
- 升級先通過三份餐盤token／額外資料保留、原模型stage、舊helper移除、原生碰撞中央高5/16格及邊緣高2/16格、模擬玩家方塊視線／點取、命令替換一份掉落且保留新箱子、放盤helper生成。碰撞用QA專屬微小重力實體在三個位置實際落地量高，沒有覆寫正式生物。
- 該次最後的打破綜合斷言失敗，未宣稱整個migrate通過。保留同一世界，讀回確認該盤已移除且原顧客動作未被中斷；失敗的落地數量斷言不改寫為成功。
- 隔離該場景，讓模擬玩家懸停在新餐盤上方3格，避免接觸掉落物。7項通過：原生breakBlock受理、只多掉一盤、pending移除、原動作／時間保留、放盤helper移除及玩家斷線。使用既有世界，不重跑已通過的碰撞／升級場景。
- 同世界restart8項通過：剩餘舊餐盤token／資料／原生方塊保留、已領盤及helper不回來、兩份實際掉落物保留；重複拆機清理只多一盤，盤塊移除，最後移除QA物品。
- seed、隔離打破及restart均正常stop／exit0，沒有內容錯誤或OOM。最初失敗的斷言及一次測試記錄檔名衝突保留原狀，不冒充成功。

完整 `npm run verify` 493項通過；15項生成器及4項餐盤素材測試、compliance與發布政策檢查通過。自動測試覆蓋真dining／main服務、玩家權限、滿包、移除／重試、跨餐廳位置、舊helper轉換及受阻保存；素材測試比較原像素／模型及生成的兩層碰撞。測試觀察器在[現行餐盤測試](../../../tests/bedrock-plate-recovery-checks.js)。

不宣稱客戶端畫面、硬體操作、手機／手把或任意強制斷電零損失。OTC尚未首次安裝至LIVE。
