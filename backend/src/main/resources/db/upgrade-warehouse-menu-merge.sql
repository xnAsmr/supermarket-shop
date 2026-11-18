-- ============================================================================
-- 仓库管理模块菜单合并改造（增量升级脚本，可重复执行）
--
-- 适用：已初始化过的存量库；全新安装请执行 seed-sys-menu.sql 后再执行本脚本
--       （或直接执行 seed-shelf-inventory-menu.sql，二者目标结构等价）
--
-- 目标结构（仓库管理 目录 id=7）：
--   701 库存查询 → 702 入库管理 → 703 出库管理 → 707 库存预警
--
-- 变更明细：
--   1. 702「入库单」更名「入库管理」、703「出库单」更名「出库管理」，
--      component 统一为目录式（/warehouse/inbound、/warehouse/outbound）
--   2. 移除 704 调拨（transfer）、705 盘点（stocktake）及其按钮 741/751 与角色授权
--      （调拨功能并入 703 出库管理的「调拨出库」类型）
--   3. 新增 707 库存预警页面（parent=7，sort=4）
--   4. 新增按钮 761 新增销售出库 / 762 确认上架 / 763 撤销上架（parent=703，
--      原上架单功能并入 703 出库管理的「销售出库」类型）
--   5. 新增按钮 764 预警设置（parent=707）
--   6. 角色授权：sysAdmin(9)、TENANT_ADMIN(1)、STORE_MANAGER(2) 全部新增项；
--      WAREHOUSE_KEEPER(4) 授予 707/761/762/764（不含 763 撤销上架）
--
-- 执行顺序：先 upgrade-shelf-inventory.sql（建 wms_shelf_up 等表），再执行本脚本
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 702 / 703 更名与组件修正
-- ----------------------------------------------------------------------------
UPDATE `sys_menu` SET `menu_name` = '入库管理', `path` = '/warehouse/inbound', `component` = '/warehouse/inbound', `sort` = 2, `update_time` = NOW() WHERE `id` = 702;
UPDATE `sys_menu` SET `menu_name` = '出库管理', `path` = '/warehouse/outbound', `component` = '/warehouse/outbound', `sort` = 3, `update_time` = NOW() WHERE `id` = 703;

-- ----------------------------------------------------------------------------
-- 2. 移除调拨 / 盘点菜单与授权（菜单软删、授权硬删）
-- ----------------------------------------------------------------------------
UPDATE `sys_menu` SET `deleted` = 1, `update_time` = NOW() WHERE `id` IN (704, 705, 741, 751);
DELETE FROM `sys_role_menu` WHERE `menu_id` IN (704, 705, 741, 751, 706);

-- ----------------------------------------------------------------------------
-- 3. 新增菜单（幂等：已存在则忽略，随后统一校正归属与状态）
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (707, 7, '库存预警', 1, '/warehouse/stock-warning', '/warehouse/stock-warning', 'wms:stock:warning:list', 'ri:alarm-warning-line', 4, 1, 1, 0, NOW(), NOW()),
       (761, 703, '新增销售出库', 2, NULL, NULL, 'wms:stock:shelf-up:add', NULL, 2, 1, 1, 0, NOW(), NOW()),
       (762, 703, '确认上架', 2, NULL, NULL, 'wms:stock:shelf-up:edit', NULL, 3, 1, 1, 0, NOW(), NOW()),
       (763, 703, '撤销上架', 2, NULL, NULL, 'wms:stock:shelf-up:delete', NULL, 4, 1, 1, 0, NOW(), NOW()),
       (764, 707, '预警设置', 2, NULL, NULL, 'wms:stock:warning:settings', NULL, 1, 1, 1, 0, NOW(), NOW());

-- 兼容历史版本：706 上架单菜单移除；761-764 归位（parent / sort / deleted 校正）
UPDATE `sys_menu` SET `deleted` = 1, `update_time` = NOW() WHERE `id` = 706;
UPDATE `sys_menu` SET `parent_id` = 703, `sort` = 2, `deleted` = 0, `update_time` = NOW() WHERE `id` = 761;
UPDATE `sys_menu` SET `parent_id` = 703, `sort` = 3, `deleted` = 0, `update_time` = NOW() WHERE `id` = 762;
UPDATE `sys_menu` SET `parent_id` = 703, `sort` = 4, `deleted` = 0, `update_time` = NOW() WHERE `id` = 763;
UPDATE `sys_menu` SET `parent_id` = 707, `sort` = 1, `deleted` = 0, `update_time` = NOW() WHERE `id` = 764;
UPDATE `sys_menu` SET `parent_id` = 7, `sort` = 4, `component` = '/warehouse/stock-warning', `deleted` = 0, `update_time` = NOW() WHERE `id` = 707;

-- ----------------------------------------------------------------------------
-- 4. 角色授权（幂等：uk_role_menu 冲突时恢复 deleted=0）
-- ----------------------------------------------------------------------------
INSERT INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
VALUES (9, 707, 0), (9, 761, 0), (9, 762, 0), (9, 763, 0), (9, 764, 0),
       (1, 707, 0), (1, 761, 0), (1, 762, 0), (1, 763, 0), (1, 764, 0),
       (2, 707, 0), (2, 761, 0), (2, 762, 0), (2, 763, 0), (2, 764, 0),
       (4, 707, 0), (4, 761, 0), (4, 762, 0), (4, 764, 0)
ON DUPLICATE KEY UPDATE `deleted` = 0;
