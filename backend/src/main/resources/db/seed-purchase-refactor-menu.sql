-- ============================================================================
-- 采购业务模块重构：新增菜单与权限
--
-- 依赖：upgrade-purchase-refactor.sql（先建表，再插权限）
--
-- 新增：
--   631 采购退货   /purchase/returns   （挂在退货退款 602 下）
--   632 收货单     /purchase/receipts  （挂在退货退款 602 下）
--   641/642/643   新增/编辑/删除 采购退货
--   651/652/653   新增/编辑/删除 收货单
--   722/723       编辑/删除 入库单（原有 702/721 之外补充）
--
-- 授权：TENANT_ADMIN 与 STORE_MANAGER 给全部；WAREHOUSE_KEEPER 给收货相关
-- ============================================================================

INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (631, 602, '采购退货', 1, '/purchase/returns', '/purchase/PurchaseReturns.vue', 'pms:purchase:return:list', 'ri:arrow-go-back-line', 1, 1, 1, 0, NOW(), NOW()),
       (632, 602, '收货单', 1, '/purchase/receipts', '/purchase/PurchaseReceipts.vue', 'wms:purchase:receipt:list', 'ri:download-2-line', 2, 1, 1, 0, NOW(), NOW()),
       (641, 631, '新增退货', 2, NULL, NULL, 'pms:purchase:return:add', NULL, 1, 1, 1, 0, NOW(), NOW()),
       (642, 631, '编辑退货', 2, NULL, NULL, 'pms:purchase:return:edit', NULL, 2, 1, 1, 0, NOW(), NOW()),
       (643, 631, '删除退货', 2, NULL, NULL, 'pms:purchase:return:delete', NULL, 3, 1, 1, 0, NOW(), NOW()),
       (651, 632, '新增收货', 2, NULL, NULL, 'wms:purchase:receipt:add', NULL, 1, 1, 1, 0, NOW(), NOW()),
       (652, 632, '编辑收货', 2, NULL, NULL, 'wms:purchase:receipt:edit', NULL, 2, 1, 1, 0, NOW(), NOW()),
       (653, 632, '删除收货', 2, NULL, NULL, 'wms:purchase:receipt:delete', NULL, 3, 1, 1, 0, NOW(), NOW()),
       (722, 702, '编辑入库', 2, NULL, NULL, 'wms:stock:inbound:edit', NULL, 2, 1, 1, 0, NOW(), NOW()),
       (723, 702, '删除入库', 2, NULL, NULL, 'wms:stock:inbound:delete', NULL, 3, 1, 1, 0, NOW(), NOW());

-- 角色授权（INSERT IGNORE 可重复执行）
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
VALUES (1, 631), (1, 632), (1, 641), (1, 642), (1, 643), (1, 651), (1, 652), (1, 653), (1, 722), (1, 723),
       (2, 631), (2, 632), (2, 641), (2, 642), (2, 643), (2, 651), (2, 652), (2, 653),
       (4, 631), (4, 632), (4, 651), (4, 652);
