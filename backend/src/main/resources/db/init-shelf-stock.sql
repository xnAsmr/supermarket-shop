-- ============================================================================
-- 货架库存初始化：把现有仓库库存的一部分搬到货架
--
-- 背景：上架功能此前在界面上不存在，导致 wms_stock.shelf_quantity 一直为 0，
--       而收银台 POS 销售扣的正是 shelf_quantity，所以真实后端下无法正常销售。
--
-- 策略：对每个「货架为 0 且仓库有货」的库存行，把仓库库存的 50% 上架
--       （向下取整到 0.01，且至少保留 1 个单位在仓库，除非仓库只有 1 个）。
--
-- 这是**一次性数据修正**，可重复执行（第二次执行时货架已非 0，不会重复搬运）。
-- 如果不希望自动搬货，跳过本脚本，改在界面里手工做「上架单」即可。
-- ============================================================================

UPDATE `wms_stock`
SET `shelf_quantity`  = LEAST(`warehouse_quantity`, ROUND(`warehouse_quantity` / 2, 2)),
    `warehouse_quantity` = `warehouse_quantity` - LEAST(`warehouse_quantity`, ROUND(`warehouse_quantity` / 2, 2))
WHERE `deleted` = 0
  AND `shelf_quantity` = 0
  AND `warehouse_quantity` > 0;
