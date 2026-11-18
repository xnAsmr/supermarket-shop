-- ============================================================================
-- 采购流程简化：「采购订单 → 入库 → 出库」
--
-- 收货单（wms_purchase_receipt）退役：
--   1. 采购订单页「收货入库」直接生成采购入库单（wms_purchase_in）并完成入库，
--      入库确认动作即验收审核，不再经过收货单的 提交/审核/入库 三步。
--   2. 历史收货单数据只读保留在 wms_purchase_receipt 表中，不迁移、不删除。
--   3. 入库管理页统一展示 wms_purchase_in（来源采购订单 / 手动入库）。
--
-- 本脚本：
--   1. wms_purchase_in 增加来源采购订单列（NULL = 手动入库）
--   2. 下线收货单菜单与按钮权限（632 菜单、651/652/653 按钮）
--
-- 执行顺序：若曾执行过 seed-purchase-refactor-menu.sql（创建收货单菜单），
--           请在该脚本之后执行本脚本，避免菜单被重新创建。
--
-- 注意：ALTER COLUMN 部分只能执行一次，重复执行会报「Duplicate column」。
-- ============================================================================

ALTER TABLE `wms_purchase_in`
    ADD COLUMN `source_order_id` bigint NULL DEFAULT NULL COMMENT '来源采购订单ID（NULL=手动入库）' AFTER `store_id`,
    ADD COLUMN `source_order_no` varchar(32) NULL DEFAULT NULL COMMENT '来源采购订单号（NULL=手动入库）' AFTER `source_order_id`;

-- 收货单菜单下线（菜单标记删除，历史数据不动）
UPDATE `sys_menu` SET `deleted` = 1, `update_time` = NOW() WHERE `id` IN (632, 651, 652, 653);
DELETE FROM `sys_role_menu` WHERE `menu_id` IN (632, 651, 652, 653);
