-- ============================================================================
-- 库存预警 / 出库管理（合并上架）：菜单与权限
--
-- 依赖：upgrade-shelf-inventory.sql（先建表，再插权限）
--
-- 变更（仓库菜单合并）：
--   - 706 上架单菜单移除，功能并入 703 出库管理（销售出库）
--   - 761/762/763 按钮迁移至 703 下（新增销售出库 / 确认上架 / 撤销上架）
--   - 新增 764 预警设置，挂在 707 库存预警下
--
-- 排序：库存查询(701) → 入库管理(702) → 出库管理(703) → 库存预警(707)
-- ============================================================================

INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (707, 7, '库存预警', 1, '/warehouse/stock-warning', '/warehouse/stock-warning', 'wms:stock:warning:list', 'ri:alarm-warning-line', 4, 1, 1, 0, NOW(), NOW()),
       (761, 703, '新增销售出库', 2, NULL, NULL, 'wms:stock:shelf-up:add', NULL, 2, 1, 1, 0, NOW(), NOW()),
       (762, 703, '确认上架', 2, NULL, NULL, 'wms:stock:shelf-up:edit', NULL, 3, 1, 1, 0, NOW(), NOW()),
       (763, 703, '撤销上架', 2, NULL, NULL, 'wms:stock:shelf-up:delete', NULL, 4, 1, 1, 0, NOW(), NOW()),
       (764, 707, '预警设置', 2, NULL, NULL, 'wms:stock:warning:settings', NULL, 1, 1, 1, 0, NOW(), NOW());

-- 兼容已执行过旧版脚本的库：移除 706 上架单菜单、迁移按钮并校正 707
UPDATE `sys_menu` SET `deleted` = 1, `update_time` = NOW() WHERE `id` = 706;
UPDATE `sys_menu` SET `parent_id` = 703, `sort` = 2, `update_time` = NOW() WHERE `id` = 761;
UPDATE `sys_menu` SET `parent_id` = 703, `sort` = 3, `update_time` = NOW() WHERE `id` = 762;
UPDATE `sys_menu` SET `parent_id` = 703, `sort` = 4, `update_time` = NOW() WHERE `id` = 763;
UPDATE `sys_menu` SET `sort` = 4, `component` = '/warehouse/stock-warning', `update_time` = NOW() WHERE `id` = 707;

-- 角色授权（INSERT IGNORE 可重复执行）
-- sysAdmin(9) / TENANT_ADMIN(1) / STORE_MANAGER(2)：全部新增项
-- WAREHOUSE_KEEPER(4)：预警查看与设置 + 销售出库操作（不含撤销上架 763）
DELETE FROM `sys_role_menu` WHERE `menu_id` = 706;
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
VALUES (9, 707), (9, 761), (9, 762), (9, 763), (9, 764),
       (1, 707), (1, 761), (1, 762), (1, 763), (1, 764),
       (2, 707), (2, 761), (2, 762), (2, 763), (2, 764),
       (4, 707), (4, 761), (4, 762), (4, 764);
